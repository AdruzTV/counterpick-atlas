/* Overwolf controller, alive for the whole app session (the background window from manifest.json).
   - Alt+C (cpa_scan): grabs the game frame while the player holds Tab, then shows the overlay, which reads it.
   - Alt+X (cpa_toggle): shows or hides the overlay.
   - Game events: Overwolf reports the player's own team (heroes, who is the player) and the kill feed, which
     names enemy heroes too. The overlay uses them next to the screenshot.
   Other windows reach this one with overwolf.windows.getMainWindow() and read window.CPA. */
(() => {
  const OW_CLASS = 1084;              // Overwatch: game id 10844 = class 1084, instance 4
  const FEATURES = ['game_info', 'match_info', 'roster', 'kill', 'death'];

  const CPA = window.CPA = {
    frame: null,                      // last scan: { width, height, data: RGBA }
    frameAt: 0,
    scanId: 0,
    error: '',
    inGame: false,
    match: newMatch(),
  };

  function newMatch() {
    return { id: 0, startedAt: Date.now(), queue: '', map: '', roster: {}, heroes: '', killfeed: [] };
  }

  const log = (...a) => console.log('[CPA]', ...a);
  const isOW = info => !!info && (info.classId === OW_CLASS || Math.floor(info.id / 10) === OW_CLASS);
  const parse = v => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return v; } };

  /* ---------- windows ---------- */
  const obtain = name => new Promise((resolve, reject) =>
    overwolf.windows.obtainDeclaredWindow(name, r => r && r.success ? resolve(r.window) : reject(new Error(r && r.error || name))));
  const stateOf = name => new Promise(resolve =>
    overwolf.windows.getWindowState(name, r => resolve(r && (r.window_state_ex || r.window_state) || 'closed')));

  async function show(name) {
    const w = await obtain(name);
    await new Promise(r => overwolf.windows.restore(w.id, r));
    if (name === 'ingame') placeOverlay(w);
    return w;
  }

  // First time in game the overlay goes to the right edge, away from the scoreboard on the left; after that it
  // stays wherever the player drags it (keep_window_location in manifest.json).
  function placeOverlay(w) {
    try { if (localStorage.getItem('cpa:overlay:placed')) return; } catch (e) { return; }
    overwolf.games.getRunningGameInfo(info => {
      const width = info && (info.logicalWidth || info.width);
      if (!width) return;
      overwolf.windows.changePosition(w.id, Math.max(0, width - (w.width || 470) - 40), 60, () => {});
      try { localStorage.setItem('cpa:overlay:placed', '1'); } catch (e) { /* storage blocked */ }
    });
  }
  async function hide(name) {
    const w = await obtain(name);
    await new Promise(r => overwolf.windows.minimize(w.id, r));
  }
  async function isVisible(name) {
    return ['normal', 'maximized'].includes(await stateOf(name));
  }
  function send(name, id, content) {
    obtain(name).then(w => overwolf.windows.sendMessage(w.id, id, content, () => {})).catch(() => {});
  }

  /* ---------- screenshot ---------- */
  let buffer = null;   // reusable handle from overwolf.media.createScreenshotBuffer (raw pixels, newer clients)

  function capture() {
    const media = overwolf.media;
    const fromUrl = () => new Promise((resolve, reject) => {
      media.getScreenshotUrl({ roundAwayFromZero: true }, r => {
        if (!r || !(r.success || r.status === 'success') || !r.url) return reject(new Error(r && (r.error || r.status) || 'getScreenshotUrl'));
        const img = new Image();
        img.onload = () => { try { resolve(Scoreboard.frameFromImage(img)); } catch (e) { reject(e); } };
        img.onerror = () => reject(new Error('screenshot image did not load'));
        img.src = r.url;
      });
    });
    const fromBuffer = handle => new Promise((resolve, reject) => handle.capture(r => {
      if (!r || !r.success) return reject(new Error(r && r.error || 'capture'));
      const data = new Uint8ClampedArray(r.buffer);
      if (r.format === 'bgra') for (let i = 0; i < data.length; i += 4) { const t = data[i]; data[i] = data[i + 2]; data[i + 2] = t; }
      resolve({ width: r.width, height: r.height, data });
    }));
    if (!media.createScreenshotBuffer) return fromUrl();
    const handle = buffer ? Promise.resolve(buffer) : new Promise(resolve => media.createScreenshotBuffer({ format: 'rgba' }, r => {
      if (r && r.success) buffer = r.screenshotBuffer;
      resolve(buffer);
    }));
    return handle.then(h => h ? fromBuffer(h) : fromUrl()).catch(e => { log('raw capture failed, trying URL', e); return fromUrl(); });
  }

  let scanning = false;
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      CPA.frame = await capture();
      CPA.frameAt = Date.now();
      CPA.error = '';
    } catch (e) {
      CPA.error = String(e && e.message || e);
      log('scan failed', CPA.error);
    }
    CPA.scanId++;
    scanning = false;
    await show('ingame').catch(e => log(e));
    send('ingame', 'scan', { scanId: CPA.scanId });
    if (await stateOf('calibrate') !== 'closed') send('calibrate', 'scan', { scanId: CPA.scanId });
  }

  async function toggleOverlay() {
    if (await isVisible('ingame')) hide('ingame').catch(() => {});
    else show('ingame').catch(() => {});
  }

  /* ---------- game events ---------- */
  function setFeatures(tries = 0) {
    overwolf.games.events.setRequiredFeatures(FEATURES, r => {
      if (r && r.success) return log('features', r.supportedFeatures);
      if (tries < 30) setTimeout(() => setFeatures(tries + 1), 2000);
    });
  }

  function onInfo(e) {
    const info = e && e.info;
    if (!info) return;
    if (info.roster) {
      for (const [k, v] of Object.entries(info.roster)) {
        const p = parse(v);
        if (p && typeof p === 'object') CPA.match.roster[k] = p;
        else delete CPA.match.roster[k];
      }
      // Roster entries change with every kill and heal; the overlay only cares when a hero changes.
      const heroes = Object.values(CPA.match.roster).map(p => `${p.hero_name || ''}:${p.is_local}:${p.is_teammate}`).sort().join('|');
      if (heroes !== CPA.match.heroes) { CPA.match.heroes = heroes; send('ingame', 'roster', {}); }
    }
    for (const cat of ['match_info', 'game_info']) {
      const c = info[cat];
      if (!c) continue;
      if (c.game_queue_type) CPA.match.queue = c.game_queue_type;
      if (c.map) CPA.match.map = String(c.map);
    }
  }

  function onEvents(e) {
    for (const ev of (e && e.events) || []) {
      if (ev.name === 'match_start') { CPA.match = newMatch(); CPA.match.id = Date.now(); send('ingame', 'match', {}); }
      else if (ev.name === 'kill_feed') {
        const k = parse(ev.data);
        if (k && typeof k === 'object') CPA.match.killfeed.push({ ...k, at: Date.now() });
        if (CPA.match.killfeed.length > 200) CPA.match.killfeed.shift();
      }
    }
  }

  function onGame(info) {
    const running = isOW(info) && info.isRunning;
    if (running === CPA.inGame) return;
    CPA.inGame = running;
    log('Overwatch running:', running);
    if (running) setFeatures();
    else { CPA.match = newMatch(); hide('ingame').catch(() => {}); }
  }

  /* ---------- entry points for the other windows ---------- */
  window.CPA_api = {
    scan,
    toggleOverlay,
    hideOverlay: () => hide('ingame'),
    openCalibration: () => show('calibrate'),
    openDesktop: () => show('desktop'),
    // Closing the site window outside the game ends the app; in game the hotkeys keep working.
    closeDesktop: async () => {
      const w = await obtain('desktop');
      overwolf.windows.close(w.id, () => { if (!CPA.inGame) window.close(); });
    },
  };

  overwolf.settings.hotkeys.onPressed.addListener(e => {
    if (e.name === 'cpa_scan') scan();
    else if (e.name === 'cpa_toggle') toggleOverlay();
  });
  overwolf.games.events.onInfoUpdates2.addListener(onInfo);
  overwolf.games.events.onNewEvents.addListener(onEvents);
  overwolf.games.onGameInfoUpdated.addListener(e => { if (e && e.gameInfo && (e.runningChanged || e.gameChanged)) onGame(e.gameInfo); });
  overwolf.extensions.onAppLaunchTriggered.addListener(() => (CPA.inGame ? show('ingame') : show('desktop')).catch(() => {}));

  overwolf.games.getRunningGameInfo(info => {
    onGame(info);
    if (!CPA.inGame) show('desktop').catch(e => log(e));   // launched by hand: open the site window
  });
})();
