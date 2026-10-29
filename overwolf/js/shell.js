/* The site (index.html) as the Overwolf desktop window. index.html loads this only when window.overwolf exists.
   Adds a title bar to drag, minimise, maximise and close the frameless window, a rail on the right with the app's
   ad and how to use the overlay, opens outside links in the real browser, and loads hero images that this app
   version doesn't ship (heroes added later) from GitHub Pages. Its texts follow the site's language (js/i18n.js).

   The ad (Overwolf Ads SDK, dev.overwolf.com → Monetization → Advertising) follows Overwolf's rules: only in this
   desktop window, never over the game (the overlay opens during matches, and the scan settings are a settings
   page); next to the app's content, always on screen while the window is, hidden while it is minimised. Overwolf
   serves real ads once its QA has enabled them for the app; until then the container may stay empty. */
(() => {
  const SITE = (window.CounterpickCore && CounterpickCore.SITE) || 'https://adruztv.github.io/counterpick-atlas/';
  const BAR = 32;
  const AD = { width: 300, height: 250 }, RAIL = AD.width + 25;   // + padding and the rail's left border
  const ADS_SDK = 'https://content.overwolf.com/libs/ads/latest/owads.min.js';
  const log = (...a) => console.log('[CPA]', ...a);

  document.head.insertAdjacentHTML('beforeend', `<style>
    body { padding-top: ${BAR}px; padding-right: ${RAIL}px; }
    .bar { top: ${BAR}px !important; }
    /* The ad sits in the bottom right corner, clear of the resize grip; when the window is short, the how-to above
       it scrolls instead, so the ad is always fully on screen. */
    .ow-rail { position: fixed; z-index: 90; top: ${BAR}px; right: 0; bottom: 0; width: ${RAIL}px; padding: 12px 12px 22px;
      box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; background: #070b13; border-left: 1px solid var(--line); }
    .ow-ad-wrap { flex: none; margin-top: auto; padding-top: 12px; }
    .ow-rail .ad-label { display: block; margin-bottom: 4px; color: var(--dim); font: 600 11px/1 var(--f-body); letter-spacing: .06em; text-transform: uppercase; }
    .ow-ad-box { width: ${AD.width}px; height: ${AD.height}px; background: transparent; }
    #ow-ad { width: ${AD.width}px; height: ${AD.height}px; }
    .ow-how { flex: 0 1 auto; min-height: 0; overflow: auto; padding: 12px 14px; background: var(--panel); border-left: 3px solid var(--accent); font-size: 14px; color: var(--muted); }
    .ow-how strong { display: block; color: var(--fg); font: italic 800 17px/1.1 var(--f-display); text-transform: uppercase; }
    .ow-how ol { margin: 8px 0 12px; padding-left: 18px; display: grid; gap: 6px; }
    .ow-how kbd { font: 600 12px/18px var(--f-body); color: var(--fg); border: 1px solid var(--line); padding: 0 5px; border-radius: 3px; }
    .ow-how button { border: 0; padding: 8px 12px; background: var(--panel-hi); color: var(--fg); font: 700 13px/1 var(--f-display); letter-spacing: .05em; text-transform: uppercase; cursor: pointer; }
    .ow-how button:hover { background: var(--line); }
    .ow-bar { position: fixed; z-index: 100; top: 0; left: 0; right: 0; height: ${BAR}px; display: flex; align-items: center; gap: 4px;
      padding-left: 12px; background: #070b13; border-bottom: 1px solid var(--line); user-select: none; cursor: default; }
    .ow-bar .t { font: italic 800 15px/1 var(--f-display); text-transform: uppercase; letter-spacing: .03em; }
    .ow-bar .t span { color: var(--accent); }
    .ow-bar .h { margin-left: 14px; flex: 1; min-width: 0; color: var(--dim); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ow-bar .h b { color: var(--muted); font-weight: 600; }
    .ow-bar button { height: ${BAR}px; min-width: 42px; padding: 0 12px; border: 0; background: none; color: var(--muted); font: 600 14px var(--f-body); cursor: pointer; }
    .ow-bar button:hover { background: var(--panel-hi); color: var(--fg); }
    .ow-bar button.x:hover { background: #c4323a; color: #fff; }
    .ow-grip { position: fixed; z-index: 100; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, var(--line) 50%); }
  </style>`);

  // data-i18n: I18n.apply() words them again when the language changes.
  document.body.insertAdjacentHTML('afterbegin', `<div class="ow-bar" id="ow-bar">
      <span class="t">Counterpick <span>Atlas</span></span>
      <span class="h"></span>
      <button type="button" data-ow="calib" data-i18n="ow.calib" data-i18n-attr="title:ov.calib"></button>
      <button type="button" data-ow="min" data-i18n-attr="title:ow.min; aria-label:ow.min">–</button>
      <button type="button" data-ow="max" data-i18n-attr="title:ow.max; aria-label:ow.max">□</button>
      <button type="button" class="x" data-ow="close" data-i18n-attr="title:ov.close; aria-label:ov.close">×</button>
    </div><div class="ow-grip" id="ow-grip" aria-hidden="true"></div>
    <aside class="ow-rail" id="ow-rail">
      <div class="ow-how"><strong data-i18n="ow.howTitle"></strong><ol id="ow-how"></ol>
        <button type="button" data-ow="calib" data-i18n="ow.calib"></button></div>
      <div class="ow-ad-wrap"><span class="ad-label" data-i18n="ow.ad"></span>
        <div class="ow-ad-box"><div id="ow-ad"></div></div></div>
    </aside>`);
  I18n.apply(document.getElementById('ow-bar'));
  I18n.apply(document.getElementById('ow-rail'));

  const current = cb => overwolf.windows.getCurrentWindow(r => r && r.success && cb(r.window));
  const api = () => overwolf.windows.getMainWindow().CPA_api;

  document.getElementById('ow-bar').addEventListener('mousedown', e => {
    if (e.button === 0 && !e.target.closest('button')) current(w => overwolf.windows.dragMove(w.id));
  });
  document.getElementById('ow-grip').addEventListener('mousedown', e => {
    if (e.button === 0) current(w => overwolf.windows.dragResize(w.id, 'BottomRight'));
  });
  document.getElementById('ow-rail').addEventListener('click', e => {
    if (e.target.closest('[data-ow="calib"]')) api().openCalibration();
  });

  // How to use the overlay, with the hotkeys as Overwolf has them now (the player can change them).
  const keys = { scan: 'Alt+C', toggle: 'Alt+X' };
  const howTo = () => { document.getElementById('ow-how').innerHTML = I18n.t('ow.how', keys); };
  const readKeys = () => overwolf.settings.hotkeys.get(r => {
    const list = r && r.success ? [...(r.globals || []), ...Object.values(r.games || {}).flat()] : [];
    for (const [k, name] of [['scan', 'cpa_scan'], ['toggle', 'cpa_toggle']]) {
      const h = list.find(x => x && x.name === name);
      if (h && h.binding && !h.IsUnassigned) keys[k] = h.binding;
    }
    howTo();
  });
  howTo();
  readKeys();
  if (overwolf.settings.hotkeys.onChanged) overwolf.settings.hotkeys.onChanged.addListener(readKeys);
  I18n.onChange(howTo);

  // The ad: one container for the window's whole life (the rules ask not to recycle them), out of sight while
  // the window is minimised.
  const adEl = document.getElementById('ow-ad');
  const sdk = document.createElement('script');
  sdk.src = ADS_SDK;
  sdk.async = true;
  sdk.onload = () => {
    if (typeof window.OwAd !== 'function') { log('ads: SDK loaded without OwAd'); return; }
    try {
      const ad = new OwAd(adEl, { size: AD, containerId: 'cpa_300x250_dt_rail' });
      log('ads: container ready');
      for (const ev of ['display_ad_loaded', 'play', 'error']) ad.addEventListener(ev, () => log('ads:', ev));
    } catch (e) { log('ads: container failed', String(e && e.message || e)); }
  };
  sdk.onerror = () => log('ads: SDK not loaded');
  document.head.appendChild(sdk);
  overwolf.windows.onStateChanged.addListener(e => {
    if (!e || e.window_name !== 'desktop') return;
    adEl.style.display = [e.window_state_ex, e.window_state].map(s => String(s || '').toLowerCase()).includes('minimized') ? 'none' : '';
  });

  document.getElementById('ow-bar').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ow === 'calib') api().openCalibration();
    else if (b.dataset.ow === 'min') current(w => overwolf.windows.minimize(w.id));
    else if (b.dataset.ow === 'max') current(w => w.stateEx === 'maximized' || w.state === 'Maximized' ? overwolf.windows.restore(w.id) : overwolf.windows.maximize(w.id));
    else if (b.dataset.ow === 'close') api().closeDesktop();
  });

  // Outside links (official patch notes and the like) open in the player's browser, not inside the app.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || !/^https?:\/\//.test(a.href) || a.href.startsWith(location.origin)) return;
    e.preventDefault();
    overwolf.utils.openUrlInDefaultBrowser(a.href);
  }, true);

  // A hero newer than this app version has no portrait or artwork in it: take the one on GitHub Pages.
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.owRetry) return;
    const src = img.getAttribute('src') || '';
    if (/^(p|art)\//.test(src)) { img.dataset.owRetry = '1'; img.src = SITE + src; }
  }, true);
})();
