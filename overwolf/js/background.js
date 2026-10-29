/* Overwolf controller, alive for the whole app session (the background window from manifest.json).
   - Alt+C (cpa_scan): grabs the game frame while the player holds Tab, then shows the overlay, which reads it.
   - Alt+X (cpa_toggle): shows or hides the overlay.
   - Game events: Overwolf reports the player's own team (heroes, who is the player) and the kill feed, which
     names enemy heroes too. The overlay uses them next to the screenshot.
   Other windows reach this one with overwolf.windows.getMainWindow() and read window.CPA. */
(() => {
  const OW_CLASS = 10844;             // Overwatch: class id 10844 (manifest.json); the running instance is 108441
  const FEATURES = ['game_info', 'match_info', 'roster', 'kill', 'death'];

  const CPA = window.CPA = {
    frame: null,                      // last scan: { width, height, data: RGBA }
    frameAt: 0,
    scanId: 0,
    error: '',
    inGame: false,
    keysPaused: false,                // set by the scan settings while they wait for a new hotkey
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
      resolve({ width: r.width, height: r.height, data, via: 'buffer' });
    }));
    if (!media.createScreenshotBuffer) return fromUrl().then(f => ({ ...f, via: 'url' }));
    const handle = buffer ? Promise.resolve(buffer) : new Promise(resolve => media.createScreenshotBuffer({ format: 'rgba' }, r => {
      if (r && r.success) buffer = r.screenshotBuffer;
      resolve(buffer);
    }));
    return handle.then(h => h ? fromBuffer(h) : fromUrl().then(f => ({ ...f, via: 'url' })))
      .catch(e => { log('raw capture failed, trying URL', e); return fromUrl().then(f => ({ ...f, via: 'url' })); });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Where the scoreboard is on a frame (portrait column, first ally row) and how clearly its role icons show.
  const locate = f => {
    const s = Scoreboard.findLayout(f);
    return s && { rows: s.rows, x: Math.round(f.width / 2 + s.layout.cx * f.height), y: Math.round(s.layout.ally * f.height), fit: +s.fit.toFixed(2) };
  };
  const agree = (a, b) => !!a && !!b && a.rows === b.rows && Math.abs(a.x - b.x) <= 3 && Math.abs(a.y - b.y) <= 3;
  let settled = null;   // where the scoreboard last stood still this match

  /* The scoreboard slides in when Tab goes down and out when it comes up, so a single picture can catch it
     halfway (seen in game: the portrait column 60 px off from one picture to the next, 0.1 s apart). So: up to
     four pictures a moment apart, until two in a row show it in the same place. Failing that, the one where it
     stands where it stood still before this match, else the one whose role icons show most clearly. The log
     says what happened on every scan. */
  async function grab() {
    const t0 = Date.now(), shots = [];
    let pick = null, why = '';
    for (let k = 0; k < 4 && !pick; k++) {
      if (k) await sleep(80);
      const frame = await capture();
      shots.push({ frame, at: locate(frame) });
      if (k && agree(shots[k - 1].at, shots[k].at)) { pick = shots[k]; why = 'still'; settled = pick.at; }
    }
    if (!pick) {
      const found = shots.filter(s => s.at);
      pick = settled && found.find(s => agree(s.at, settled));
      why = pick ? 'where it stood before' : found.length ? 'clearest icons' : 'no scoreboard';
      pick = pick || found.sort((a, b) => b.at.fit - a.at.fit)[0] || shots[0];
    }
    log('scan', JSON.stringify({ via: pick.frame.via, size: `${pick.frame.width}x${pick.frame.height}`, ms: Date.now() - t0,
      shots: shots.map(s => s.at ? `${s.at.rows}r x=${s.at.x} y=${s.at.y} fit=${s.at.fit}` : '-'), used: shots.indexOf(pick), why }));
    return pick.frame;
  }

  let scanning = false;
  async function scan() {
    if (scanning) return;
    scanning = true;
    try {
      CPA.frame = await grab();
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
      if (ev.name === 'match_start') { CPA.match = newMatch(); CPA.match.id = Date.now(); settled = null; send('ingame', 'match', {}); }
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
    else { CPA.match = newMatch(); settled = null; hide('ingame').catch(() => {}); }
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
    if (CPA.keysPaused) return;   // the scan settings are waiting for a new hotkey
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
