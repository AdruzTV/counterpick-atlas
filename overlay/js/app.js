/* Shared by the overlay (overlay/ingame.html) and calibration (overlay/calibrate.html). The same pages run in three
   hosts, and this file hides the differences:
   - overwolf: the Overwolf app; screenshots and game data come from its background window (overwolf/js/background.js)
   - desktop: the standalone app in desktop/; screenshots come from its main process (desktop/preload.js)
   - browser: a normal browser tab with a pasted or dropped screenshot, for testing without the game
   Both pages set <base href="../">, so every path here is relative to the site root. Exposes window.CPApp. */
(() => {
  const HOST = window.overwolf ? 'overwolf' : window.cpaDesktop ? 'desktop' : 'browser';
  const PREFS = 'cpa:overlay:v1';
  const LAYOUT = 'cpa:scoreboard:layout:v1';
  // Hotkeys as they are now: the defaults (manifest.json, desktop/main.js) unless the player changed them in the
  // scan settings (or, in Overwolf, in Overwolf's own settings). KEYS stays the same object and is updated in place.
  const DEFAULT_KEYS = { scan: 'Alt+C', toggle: 'Alt+X' };
  const KEYS = { ...DEFAULT_KEYS, ...(HOST === 'desktop' && cpaDesktop.keys || {}) };

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; } };
  const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

  // The Overwolf background window's state (window.CPA) and functions (window.CPA_api), or null elsewhere.
  function bg() {
    if (HOST !== 'overwolf') return null;
    try { return overwolf.windows.getMainWindow(); } catch (e) { return null; }
  }

  function loadAtlas() {
    const atlas = new CounterpickCore.Atlas();
    const get = p => CounterpickCore.loadJSON(p, true);
    return Promise.all([get('data/heroes.json'), get('data/matchups.json'), get('data/synergies.json'), get('data/maps.json')])
      .then(([heroes, matchups, synergies, maps]) => {
        atlas.setHeroes(heroes);
        atlas.indexMatchups(matchups);
        atlas.indexSynergies(synergies);
        atlas.indexMaps(maps);
        return atlas;
      });
  }

  // The scoreboard is found on every screenshot unless the player switched that off in calibration and placed
  // the boxes by hand; the saved layout is then used (and is the fallback when finding fails).
  const AUTO = 'cpa:scoreboard:auto:v1';
  const layout = () => Scoreboard.cleanLayout(read(LAYOUT, Scoreboard.DEFAULT_LAYOUT));
  const saveLayout = l => write(LAYOUT, Scoreboard.cleanLayout(l));
  const autoLayout = () => { try { return localStorage.getItem(AUTO) !== 'false'; } catch (e) { return true; } };
  const setAutoLayout = on => write(AUTO, !!on);

  /* ---------- screenshots ---------- */
  // cb(frame) for every new screenshot, onError(message) when taking one failed. In Overwolf and the desktop app
  // they come after the hotkey; in a browser from Ctrl+V, drag and drop or any <input type="file" data-shot>.
  function onScan(cb, onError) {
    if (HOST === 'overwolf') {
      let last = 0;
      const pull = () => {
        const C = bg() && bg().CPA;
        if (!C || C.scanId === last) return;
        last = C.scanId;
        if (C.error || !C.frame) onError(C.error || '');
        else cb(C.frame);
      };
      overwolf.windows.onMessageReceived.addListener(m => { if (m.id === 'scan') pull(); });
      // A message can arrive before the window listens; check again whenever it shows up.
      window.addEventListener('focus', pull);
      document.addEventListener('visibilitychange', pull);
      pull();
    } else if (HOST === 'desktop') {
      const take = r => { if (r) r.error ? onError(r.error) : cb(r.frame); };
      cpaDesktop.onScan(take);
      cpaDesktop.lastScan().then(take);
    } else {
      const take = file => {
        if (!file || !/^image\//.test(file.type)) return;
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => { try { cb(Scoreboard.frameFromImage(img)); } finally { URL.revokeObjectURL(url); } };
        img.src = url;
      };
      document.addEventListener('paste', e => take([...(e.clipboardData && e.clipboardData.files) || []][0]));
      document.addEventListener('dragover', e => e.preventDefault());
      document.addEventListener('drop', e => { e.preventDefault(); take([...(e.dataTransfer && e.dataTransfer.files) || []][0]); });
      document.addEventListener('change', e => { if (e.target.matches('input[type="file"][data-shot]')) take(e.target.files[0]); });
    }
  }

  // Overwolf only: cb('roster') when the player's team changes, cb('match') when a new match starts, cb('map')
  // when Overwolf names the map.
  function onGame(cb) {
    if (HOST === 'overwolf') overwolf.windows.onMessageReceived.addListener(m => { if (['roster', 'match', 'map'].includes(m.id)) cb(m.id); });
  }

  // What Overwolf knows about this match: the player's own team (with who the player is), enemies seen in the
  // kill feed (Overwolf names enemy heroes only there, never in the roster) and the map (its own number, see
  // Atlas.MAP_BY_GAME). Empty elsewhere.
  function gameInfo(atlas) {
    const b = bg(), C = b && b.CPA, m = C && C.match;
    const out = { allies: [], self: null, selfRole: null, enemiesSeen: [], queue: m ? m.queue : '', map: C && C.map || '' };
    if (!m) return out;
    for (const p of Object.values(m.roster || {})) {
      if (!p || typeof p !== 'object') continue;
      const key = atlas.heroByName(p.hero_name);
      const mine = p.is_teammate === true || p.is_teammate === 'true' || p.is_local === true || p.is_local === 'true';
      if (!key || !mine) continue;
      if (p.is_local === true || p.is_local === 'true') { out.self = key; out.selfRole = String(p.hero_role || '').toLowerCase() || null; }
      if (!out.allies.includes(key)) out.allies.push(key);
    }
    const since = Date.now() - 4 * 60 * 1000;   // heroes swap, older kills say little
    for (const k of m.killfeed || []) {
      if (k.at < since) continue;
      for (const [name, mate] of [[k.attacker_hero_name, k.is_attacker_teammate], [k.victim_hero_name, k.is_victim_teammate]]) {
        const key = atlas.heroByName(name);
        if (key && !(mate === true || mate === 'true') && !out.enemiesSeen.includes(key)) out.enemiesSeen.push(key);
      }
    }
    return out;
  }

  /* ---------- hotkeys ---------- */
  // Keys a hotkey can end with, the same in Electron accelerators and Overwolf (with their Windows key codes).
  const VK = { Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, Left: 37, Up: 38, Right: 39, Down: 40, Insert: 45, Delete: 46 };
  const vkOf = key => /^[A-Z0-9]$/.test(key) ? key.charCodeAt(0) : /^num\d$/.test(key) ? 96 + Number(key[3])
    : /^F\d+$/.test(key) ? 111 + Number(key.slice(1)) : VK[key] || 0;

  const keyListeners = [];
  const keysChanged = keys => { Object.assign(KEYS, keys); keyListeners.forEach(cb => cb(KEYS)); };
  // cb(KEYS) whenever the hotkeys change, in this window or another one.
  const onKeys = cb => keyListeners.push(cb);

  // Overwolf keeps the hotkeys of manifest.json in its settings: [{ key, name, gameId, binding }] as they are now.
  const OW_KEYS = { scan: 'cpa_scan', toggle: 'cpa_toggle' };
  function owHotkeys() {
    return new Promise(resolve => overwolf.settings.hotkeys.get(r => {
      const out = [];
      if (r && r.success) {
        for (const h of r.globals || []) out.push({ ...h, gameId: null });
        for (const [id, list] of Object.entries(r.games || {})) for (const h of Array.isArray(list) ? list : []) out.push({ ...h, gameId: Number(id) });
      }
      resolve(out);
    }));
  }
  function readOwKeys() {
    return owHotkeys().then(list => {
      const keys = {};
      for (const [k, name] of Object.entries(OW_KEYS)) {
        const h = list.find(x => x && x.name === name);
        if (h && h.binding && !h.IsUnassigned) keys[k] = h.binding;
      }
      keysChanged(keys);
      return list;
    });
  }

  /* New hotkeys { scan, toggle } (a missing one = its default) → Promise of { ok } or { ok: false, error } with
     error 'same' (both one key), 'taken' (another app has it) or 'overwolf' (Overwolf refused, change it there). */
  function setKeys(keys) {
    const next = { ...DEFAULT_KEYS, ...keys };
    if (next.scan.toLowerCase() === next.toggle.toLowerCase()) return Promise.resolve({ ok: false, error: 'same' });
    if (HOST === 'desktop') return cpaDesktop.setKeys(next).then(r => { if (r.ok) keysChanged(r.keys); return r; });
    if (HOST !== 'overwolf' || !overwolf.settings.hotkeys.assign) return Promise.resolve({ ok: false, error: 'overwolf' });
    return owHotkeys().then(list => Promise.all(Object.keys(OW_KEYS).filter(k => next[k] !== KEYS[k]).map(k => new Promise(resolve => {
      const parts = next[k].split('+'), key = parts.pop(), h = list.find(x => x && x.name === OW_KEYS[k]);
      const hotkey = { name: OW_KEYS[k], virtualKey: vkOf(key), modifiers: { ctrl: parts.includes('Ctrl'), alt: parts.includes('Alt'), shift: parts.includes('Shift') } };
      if (h && h.gameId) hotkey.gameId = h.gameId;
      overwolf.settings.hotkeys.assign(hotkey, r => resolve(!!(r && r.success)));
    }))))
      .then(oks => readOwKeys().then(() => oks.every(Boolean) ? { ok: true } : { ok: false, error: 'overwolf' }));
  }

  // While the scan settings wait for a new hotkey, the current ones do nothing (so pressing them reaches the page).
  function pauseKeys(on) {
    if (HOST === 'desktop') cpaDesktop.pauseKeys(on);
    else if (HOST === 'overwolf') { const C = bg() && bg().CPA; if (C) C.keysPaused = !!on; }
  }

  if (HOST === 'desktop' && cpaDesktop.onKeys) cpaDesktop.onKeys(keysChanged);
  if (HOST === 'overwolf') {
    readOwKeys();
    if (overwolf.settings.hotkeys.onChanged) overwolf.settings.hotkeys.onChanged.addListener(() => readOwKeys());
  }

  /* ---------- windows ---------- */
  function hideOverlay() {
    if (HOST === 'overwolf') bg().CPA_api.hideOverlay();
    else if (HOST === 'desktop') cpaDesktop.hideOverlay();
  }

  function openCalibration() {
    if (HOST === 'overwolf') bg().CPA_api.openCalibration();
    else if (HOST === 'desktop') cpaDesktop.openCalibration();
    else window.open('overlay/calibrate.html', '_blank');
  }

  function closeWindow() {
    if (HOST === 'overwolf') overwolf.windows.getCurrentWindow(r => r && r.success && overwolf.windows.close(r.window.id));
    else window.close();
  }

  // Drag the window by an element: neither app gives these windows a system title bar.
  function dragBy(el) {
    if (!el) return;
    if (HOST === 'desktop') el.style.setProperty('-webkit-app-region', 'drag');
    if (HOST !== 'overwolf') return;
    el.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('button, a, input, select')) return;
      overwolf.windows.getCurrentWindow(r => r && r.success && overwolf.windows.dragMove(r.window.id));
    });
  }

  // Resize from a corner grip. Overwolf windows need it; desktop windows have their own border, so it hides.
  function resizeBy(el) {
    if (!el) return;
    if (HOST !== 'overwolf') { el.hidden = true; return; }
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      overwolf.windows.getCurrentWindow(r => r && r.success && overwolf.windows.dragResize(r.window.id, 'BottomRight'));
    });
  }

  function copyText(text) {
    if (HOST === 'overwolf' && overwolf.utils && overwolf.utils.placeOnClipboard) { overwolf.utils.placeOnClipboard(text); return Promise.resolve(); }
    if (HOST === 'desktop') return cpaDesktop.copyText(text);
    return navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('clipboard'));
  }

  // A hero newer than the app's own files has no portrait in it: show the one on GitHub Pages.
  if (CounterpickCore.REMOTE) document.addEventListener('error', e => {
    const img = e.target, src = img.getAttribute && img.getAttribute('src') || '';
    if (img.tagName === 'IMG' && !img.dataset.retry && /^p\//.test(src)) { img.dataset.retry = '1'; img.src = CounterpickCore.REMOTE + src; }
  }, true);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.CPApp = {
    HOST, KEYS, DEFAULT_KEYS, onKeys, setKeys, pauseKeys, PREFS, read, write, bg, loadAtlas, layout, saveLayout, autoLayout, setAutoLayout,
    onScan, onGame, gameInfo, hideOverlay, openCalibration, closeWindow, dragBy, resizeBy, copyText, esc,
  };
})();
