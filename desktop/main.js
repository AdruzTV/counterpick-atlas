/* Counterpick Atlas as a standalone Windows app, without Overwolf. Windows on the site's own files:
   - the site (index.html), the same as on GitHub Pages
   - the overlay (overlay/ingame.html), always on top; over the game only in Borderless Windowed mode
   - calibration (overlay/calibrate.html), on demand
   Global hotkeys (the player changes them in the scan settings, ⚙ in the overlay; settings.json in the app data
   folder keeps them):
   - Alt+C photographs the screen under the mouse (the scoreboard while Tab is held) and shows the overlay without
     taking the mouse from the game
   - Alt+X moves the mouse into the overlay; pressed again it hides the overlay
   Files are served as cpa://atlas/..., so the pages run as on the web and js/counterpick-core.js loads data/*.json
   from GitHub Pages first. Closing the site window leaves the app in the tray so the hotkeys keep working.
   Czech or English: the pages switch with the CZ / EN buttons on the site, the tray menu has the same choice. Both
   ends tell each other (desktop/preload.js) and settings.json keeps it; the texts are js/i18n.js, shared with the pages.
   `electron . --smoke=<image>` is a developer check: shows the image full screen, scans it, saves pictures of the
   windows next to the image and prints what the overlay read. */
const {
  app, BrowserWindow, Menu, Tray, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage,
  nativeTheme, net, protocol, screen, shell,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const SITE_DIR = path.resolve(app.isPackaged ? path.join(process.resourcesPath, 'site') : path.join(__dirname, '..'));
const I18N = require(path.join(SITE_DIR, 'js', 'i18n.js'));
const ORIGIN = 'cpa://atlas/';
const ICON = path.join(SITE_DIR, 'overwolf', 'icons', 'icon.png');
const MAX_HEIGHT = 1080;          // screenshots are scaled down to this; recognition works in screen heights anyway
const SMOKE = (process.argv.find(a => a.startsWith('--smoke=')) || '').slice('--smoke='.length);
// The developer check runs on its own throw-away profile: next to the player's running app, without its samples.
if (SMOKE) app.setPath('userData', path.join(app.getPath('temp'), 'counterpick-atlas-smoke'));
const SETTINGS = path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { keys: { scan: 'Alt+C', toggle: 'Alt+X' }, overlay: null, trayHintShown: false, lang: null };

protocol.registerSchemesAsPrivileged([
  { scheme: 'cpa', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let settings = readSettings();
let main = null, overlay = null, calib = null, tray = null, quitting = false;
let lastScan = null, scanning = false;

function readSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
    return { ...DEFAULTS, ...s, keys: { ...DEFAULTS.keys, ...(s && s.keys) } };
  } catch (e) { return { ...DEFAULTS, keys: { ...DEFAULTS.keys } }; }
}
function saveSettings() {
  try { fs.mkdirSync(path.dirname(SETTINGS), { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 1)); } catch (e) { /* read-only profile */ }
}

/* ---------- language ---------- */
// Until the player chooses: Czech on a Czech or Slovak Windows, else English (like the pages).
const lang = () => I18N.LANGS.includes(settings.lang) ? settings.lang : I18N.systemLang(app.getLocale());
const t = (key, params) => I18N.translate(lang(), key, params);

// Chosen on a page (`from` is its webContents) or in the tray menu: remembered, the menu redrawn, the other pages told.
function setLang(l, from) {
  if (!I18N.LANGS.includes(l)) return;
  if (settings.lang !== l) { settings.lang = l; saveSettings(); }
  trayMenu();
  for (const w of [main, overlay, calib]) if (w && !w.isDestroyed() && w.webContents !== from) w.webContents.send('lang', l);
}

/* ---------- files as cpa://atlas/ ---------- */
function serveSite() {
  protocol.handle('cpa', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(SITE_DIR, rel);
    if (!file.startsWith(SITE_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

// Links out of the app (official patch notes and the like) open in the player's browser.
function keepLinksOutside(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(ORIGIN)) return;
    e.preventDefault();
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
  });
}

const prefs = () => ({ preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true });

/* ---------- windows ---------- */
function createMain() {
  main = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600, show: !SMOKE,
    title: 'Counterpick Atlas', icon: ICON, backgroundColor: '#0d1320', autoHideMenuBar: true, webPreferences: prefs(),
  });
  keepLinksOutside(main);
  main.loadURL(ORIGIN + 'index.html');
  main.on('close', e => {
    if (quitting) return;
    e.preventDefault();
    main.hide();
    if (!settings.trayHintShown && tray) {
      tray.displayBalloon({ iconType: 'info', title: t('app.trayTitle'), content: t('app.trayText', { key: settings.keys.scan }) });
      settings.trayHintShown = true;
      saveSettings();
    }
  });
}

function showMain() {
  main.show();
  if (main.isMinimized()) main.restore();
  main.focus();
}

// The overlay sits by the right edge, away from the scoreboard; after that wherever the player moves it.
function overlayBounds() {
  const saved = settings.overlay;
  if (saved && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return saved.x < a.x + a.width - 50 && saved.x + saved.width > a.x + 50 && saved.y >= a.y - 10 && saved.y < a.y + a.height - 50;
  })) return saved;
  const a = screen.getPrimaryDisplay().workArea, height = Math.min(780, a.height - 80);
  return { width: 470, height, x: a.x + a.width - 470 - 40, y: a.y + 60 };
}

function createOverlay() {
  overlay = new BrowserWindow({
    ...overlayBounds(), minWidth: 380, minHeight: 420, frame: false, show: false, skipTaskbar: true,
    alwaysOnTop: true, fullscreenable: false, maximizable: false, minimizable: false,
    title: 'Counterpick overlay', icon: ICON, backgroundColor: '#0d1320', webPreferences: prefs(),
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  keepLinksOutside(overlay);
  overlay.loadURL(ORIGIN + 'overlay/ingame.html');
  overlay.on('close', e => { if (!quitting) { e.preventDefault(); overlay.hide(); } });
  const remember = () => { settings.overlay = overlay.getBounds(); saveSettings(); };
  overlay.on('moved', remember);
  overlay.on('resized', remember);
}

function openCalibration() {
  if (calib) { calib.show(); calib.focus(); return; }
  calib = new BrowserWindow({
    width: 1240, height: 780, minWidth: 900, minHeight: 560, frame: false,
    title: t('cal.title'), icon: ICON, backgroundColor: '#0d1320', webPreferences: prefs(),
  });
  keepLinksOutside(calib);
  calib.loadURL(ORIGIN + 'overlay/calibrate.html');
  calib.on('closed', () => {
    calib = null;
    if (keysPaused) { keysPaused = false; takeKeys(); }   // closed while waiting for a new hotkey
  });
}

// A game started after the app puts its window into the same always-on-top layer, above the overlay, and showing
// a window keeps its old place in that layer. So the overlay takes the top place back every time it shows.
function raiseOverlay() {
  overlay.setAlwaysOnTop(false);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.moveTop();
}

// Alt+X: show the overlay with the mouse in it, give it the mouse if it only shows, else hide it.
function toggleOverlay() {
  if (!overlay.isVisible()) { overlay.show(); raiseOverlay(); overlay.focus(); }
  else if (!overlay.isFocused()) { raiseOverlay(); overlay.focus(); }
  else overlay.hide();
}

/* ---------- screenshot ---------- */
async function capture() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const full = { width: display.size.width * display.scaleFactor, height: display.size.height * display.scaleFactor };
  const k = Math.min(1, MAX_HEIGHT / full.height);
  const thumbnailSize = { width: Math.round(full.width * k), height: Math.round(full.height * k) };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const src = sources.find(s => s.display_id === String(display.id)) || sources[0];
  if (!src || src.thumbnail.isEmpty()) throw new Error(t('app.captureFail'));
  const { width, height } = src.thumbnail.getSize();
  const bgra = src.thumbnail.toBitmap(), data = new Uint8Array(bgra.length);
  for (let i = 0; i < bgra.length; i += 4) { data[i] = bgra[i + 2]; data[i + 1] = bgra[i + 1]; data[i + 2] = bgra[i]; data[i + 3] = 255; }
  return { width, height, data };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function scan() {
  if (scanning) return;
  scanning = true;
  try {
    if (overlay.isVisible()) { overlay.hide(); await sleep(80); }   // never photograph our own overlay
    lastScan = { frame: await capture(), at: Date.now() };
  } catch (e) {
    lastScan = { error: String(e && e.message || e), at: Date.now() };
  }
  scanning = false;
  overlay.showInactive();   // the game keeps the mouse
  raiseOverlay();
  for (const w of [overlay, calib]) if (w && !w.isDestroyed()) w.webContents.send('scan', lastScan);
}

/* ---------- hotkeys ---------- */
// Off while the scan settings wait for a new hotkey, so that pressing the current one reaches the page.
let keysPaused = false;

// Registers both hotkeys; returns the ones that could not be taken (another app has them).
function takeKeys() {
  globalShortcut.unregisterAll();
  if (keysPaused) return [];
  const take = (accel, fn) => { try { return globalShortcut.register(accel, fn); } catch (e) { return false; } };
  return [[settings.keys.scan, scan], [settings.keys.toggle, toggleOverlay]].filter(([a, fn]) => !take(a, fn)).map(([a]) => a);
}

function registerKeys() {
  const failed = takeKeys();
  if (failed.length && !SMOKE) {
    dialog.showMessageBox(main, {
      type: 'warning', title: 'Counterpick Atlas',
      message: t('app.keysTaken', { keys: failed.join(t('app.keysAnd')) }),
      detail: t('app.keysHow'),
    });
  }
}

// New hotkeys from the scan settings ({ scan, toggle }, a missing one = its default). Kept only when every changed
// one can be registered; then saved, and every window shows them.
function setKeys(keys) {
  const next = {};
  for (const k of Object.keys(DEFAULTS.keys)) next[k] = keys && typeof keys[k] === 'string' && keys[k] ? keys[k] : DEFAULTS.keys[k];
  if (new Set(Object.values(next).map(a => a.toLowerCase())).size < Object.keys(next).length) return { ok: false, error: 'same' };
  const before = settings.keys, changed = Object.keys(next).filter(k => next[k] !== before[k]).map(k => next[k]);
  settings.keys = next;
  keysPaused = false;
  if (takeKeys().some(a => changed.includes(a))) {
    settings.keys = before;
    takeKeys();
    return { ok: false, error: 'taken' };
  }
  saveSettings();
  trayMenu();
  for (const w of [main, overlay, calib]) if (w && !w.isDestroyed()) w.webContents.send('keys', settings.keys);
  return { ok: true, keys: settings.keys };
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  trayMenu();
  tray.on('click', showMain);
}

// The tray menu in the current language, with the language choice in it.
function trayMenu() {
  if (!tray) return;
  tray.setToolTip(t('app.tooltip', { key: settings.keys.scan }));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('app.open'), click: showMain },
    { label: t('app.toggle'), click: toggleOverlay },
    { label: t('ov.calib'), click: openCalibration },
    { type: 'separator' },
    { label: t('lang.label'), submenu: I18N.LANGS.map(l => ({
      label: I18N.translate(l, 'lang.name'), type: 'radio', checked: l === lang(), click: () => setLang(l),
    })) },
    { type: 'separator' },
    { label: t('app.quit'), click: () => app.quit() },
  ]));
}

/* ---------- pages ---------- */
ipcMain.on('keys', e => { e.returnValue = settings.keys; });
ipcMain.handle('set-keys', (e, keys) => setKeys(keys));
ipcMain.on('pause-keys', (e, on) => { keysPaused = !!on; takeKeys(); });
// The pages' language: the player's choice (null until there is one) and the system's.
ipcMain.on('lang', e => { e.returnValue = { lang: settings.lang, system: I18N.systemLang(app.getLocale()) }; });
ipcMain.on('set-lang', (e, l) => setLang(l, e.sender));
ipcMain.handle('last-scan', () => lastScan);
ipcMain.on('hide-overlay', () => overlay && overlay.hide());
ipcMain.on('open-calibration', () => openCalibration());
ipcMain.handle('copy-text', (e, text) => { clipboard.writeText(String(text)); });

/* ---------- developer check ---------- */
async function smoke(image) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const shot = new BrowserWindow({ ...display.bounds, frame: false, fullscreen: true, alwaysOnTop: true, skipTaskbar: true, show: false });
  const page = image + '.smoke.html';   // a file page next to the image may show it, stretched like a game frame
  fs.writeFileSync(page, `<body style="margin:0;background:#000"><img src="${encodeURI(path.basename(image))}" style="width:100vw;height:100vh;display:block">`);
  await shot.loadFile(page);
  shot.show();
  shot.focus();   // like a game started after the app: full screen, always on top, with the focus
  await sleep(1500);
  await scan();
  await sleep(2500);
  const read = sel => overlay.webContents.executeJavaScript(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.innerText.replace(/\\s+/g, ' ').trim())`);
  const out = {
    scan: lastScan && (lastScan.error || `${lastScan.frame.width}x${lastScan.frame.height}`),
    status: (await read('#status'))[0], ally: await read('.slots:not(.enemy) .slot'), enemy: await read('.slots.enemy .slot'),
    recs: await read('.rc strong'), keys: globalShortcut.isRegistered(settings.keys.scan),
    lang: lang(), hint: (await read('#keys'))[0],
  };
  // Is the overlay really on screen, above the full-screen "game", or only drawn somewhere behind it?
  const b = overlay.getBounds(), d = screen.getDisplayMatching(b), k = d.scaleFactor, small = { width: 47, height: 78 };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width * k, height: d.size.height * k } });
  const screenshot = (sources.find(s => s.display_id === String(d.id)) || sources[0]).thumbnail;
  const seen = screenshot.crop({ x: Math.round((b.x - d.bounds.x) * k), y: Math.round((b.y - d.bounds.y) * k), width: Math.round(b.width * k), height: Math.round(b.height * k) }).resize(small).toBitmap();
  const drawn = (await overlay.webContents.capturePage()).resize(small).toBitmap();
  let diff = 0;
  for (let i = 0; i < drawn.length; i++) diff += Math.abs(drawn[i] - seen[i]);
  out.overlayOnTop = diff / drawn.length < 25;
  fs.writeFileSync(image + '.overlay.png', (await overlay.webContents.capturePage()).toPNG());
  shot.close();
  main.show();
  await sleep(3000);
  fs.writeFileSync(image + '.main.png', (await main.webContents.capturePage()).toPNG());
  out.mainTitle = main.getTitle();
  console.log('SMOKE ' + JSON.stringify(out));
  quitting = true;
  app.quit();
}

/* ---------- start ---------- */
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => main && showMain());
  app.setAppUserModelId('io.github.adruztv.counterpickatlas');
  nativeTheme.themeSource = 'dark';
  app.whenReady().then(() => {
    serveSite();
    createMain();
    createOverlay();
    createTray();
    registerKeys();
    if (SMOKE) overlay.webContents.once('did-finish-load', () => setTimeout(() => smoke(path.resolve(SMOKE)), 2500));
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => { /* stays in the tray */ });
}
