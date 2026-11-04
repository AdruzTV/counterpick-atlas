/* The site (index.html) as the Overwolf desktop window. index.html loads this only when window.overwolf exists.
   Adds a title bar to drag, minimise, maximise and close the frameless window, a rail on the right with a random
   hero line, how to use the overlay with a link to the support page (support.html on GitHub Pages, so that it opens
   in the player's browser and this window keeps its title bar) and the app's ad at the bottom, opens outside links in
   the real browser, and loads hero images that this app version doesn't ship (heroes added later) from GitHub Pages.
   Its texts follow the site's language (js/i18n.js).

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

  // The page hides what is for the web only (store links) by this class; index.html sets it early too.
  document.documentElement.classList.add('in-app');
  document.head.insertAdjacentHTML('beforeend', `<style>
    body { padding-top: ${BAR}px; padding-right: ${RAIL}px; }
    .top { top: ${BAR}px !important; }
    html { scroll-padding-top: ${BAR + 84}px; }
    /* The ad sits in the bottom right corner, clear of the resize grip; when the window is short, the how-to above
       it scrolls instead, so the ad is always fully on screen. */
    .ow-rail { position: fixed; z-index: 90; top: ${BAR}px; right: 0; bottom: 0; width: ${RAIL}px; padding: 12px 12px 22px;
      box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; background: var(--ground); border-left: 1px solid var(--line); }
    .ow-ad-wrap { flex: none; padding-top: 12px; }
    .ow-rail .ad-label { display: block; margin-bottom: 4px; color: var(--ink-2); font: 500 12px/1 var(--f-ui); }
    .ow-ad-box { width: ${AD.width}px; height: ${AD.height}px; background: transparent; }
    #ow-ad { width: ${AD.width}px; height: ${AD.height}px; }
    .ow-how { flex: 0 1 auto; min-height: 0; overflow: auto; margin: auto 0; padding: 12px 16px 14px; background: var(--surface); border-radius: 12px; font-size: 14.5px; color: var(--ink-2); }
    .ow-how h2 { margin: 0; color: var(--ink); font: 600 18px/1.2 var(--f-ui); }
    .ow-how ol { margin: 8px 0 12px; padding-left: 20px; display: grid; gap: 8px; line-height: 1.45; }
    .ow-how kbd { font-size: 13px; line-height: 20px; padding: 0 5px; background: var(--surface); }
    .ow-how button { display: inline-flex; align-items: center; height: 44px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--soft); color: var(--ink); font: 600 15px/1 var(--f-ui); cursor: pointer; }
    .ow-how button:hover { background: var(--line); }
    .ow-how .ow-support { display: block; margin-top: 12px; color: var(--ally); font-size: 14px; }
    /* A hero line on top. When the window is short it gives way first (the large flex-shrink) and hides rather than
       showing cut; then the how-to scrolls. The ad always stays whole. */
    .ow-quote { flex: 0 1000 auto; min-height: 0; overflow: hidden; display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 12px; align-items: center;
      margin: 0; padding: 12px 14px; background: var(--surface); border-radius: 12px; }
    .ow-quote.ow-cut { display: none; }
    .ow-quote img { display: block; width: 56px; height: 56px; border-radius: 8px; object-fit: cover; background: var(--soft); }
    .ow-quote blockquote { margin: 0; font: italic 800 21px/1.1 var(--f-game); color: var(--ink); overflow-wrap: anywhere; }
    .ow-quote blockquote .q { color: var(--orange); }
    .ow-quote figcaption { margin-top: 5px; font: 500 13px/1.2 var(--f-ui); color: var(--ink-2); }
    .ow-bar { position: fixed; z-index: 100; top: 0; left: 0; right: 0; height: ${BAR}px; display: flex; align-items: center; gap: 4px;
      padding-left: 12px; background: #05070B; color: var(--night-fg); user-select: none; cursor: default; }
    .ow-bar .t { font: italic 800 15px/1 var(--f-game); text-transform: uppercase; letter-spacing: .03em; }
    .ow-bar .t span { color: var(--orange); }
    .ow-bar .h { margin-left: 16px; flex: 1; min-width: 0; color: var(--night-mute); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ow-bar .h b { color: var(--night-fg); font-weight: 600; }
    .ow-bar button { height: ${BAR}px; min-width: 44px; padding: 0 12px; border: 0; background: none; color: var(--night-mute); font: 500 13px var(--f-ui); cursor: pointer; }
    .ow-bar button:hover { background: var(--night-2); color: var(--night-fg); }
    .ow-bar button.x:hover { background: #C4323A; color: #FFFFFF; }
    .ow-bar svg { width: 14px; height: 14px; display: block; margin: auto; }
    .ow-grip { position: fixed; z-index: 100; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, var(--edge) 50%); }
  </style>`);

  const icon = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
  // A random hero line on top of the rail, picked each time the app opens, never the same one twice in a row.
  const QUOTES = [
    ['Good kitty', 'ana', 'Ana'], ['Come hereee', 'reinhardt', 'Reinhardt'], ['Ahh, it’s snowing!', 'junkrat', 'Junkrat'],
    ['Baaawwb!!! Do something!!!', 'ashe', 'Ashe'], ['Bzzzz bzt?', 'bastion', 'Bastion'], ['Listen to your mummy', 'ana', 'Ana'],
    ['Meow meow meow', 'jetpack-cat', 'Jetpack Cat'],
  ];
  const QUOTE_KEY = 'cpa:ow:quote';
  let last = -1;
  try { const v = localStorage.getItem(QUOTE_KEY); if (v !== null) last = Number(v); } catch (e) { /* storage blocked */ }
  let qi = Math.floor(Math.random() * QUOTES.length);
  if (qi === last) qi = (qi + 1) % QUOTES.length;
  try { localStorage.setItem(QUOTE_KEY, String(qi)); } catch (e) { /* storage blocked */ }
  const [quoteText, quoteHero, quoteName] = QUOTES[qi];
  // data-i18n: I18n.apply() words them again when the language changes.
  document.body.insertAdjacentHTML('afterbegin', `<div class="ow-bar" id="ow-bar">
      <span class="t">Counter<span>Atlas</span></span>
      <span class="h"></span>
      <button type="button" data-ow="calib" data-i18n="ow.calib" data-i18n-attr="title:ov.calib"></button>
      <button type="button" data-ow="min" data-i18n-attr="title:ow.min; aria-label:ow.min">${icon('<path d="M5 12h14"/>')}</button>
      <button type="button" data-ow="max" data-i18n-attr="title:ow.max; aria-label:ow.max">${icon('<rect x="5" y="5" width="14" height="14" rx="1"/>')}</button>
      <button type="button" class="x" data-ow="close" data-i18n-attr="title:ov.close; aria-label:ov.close">${icon('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
    </div><div class="ow-grip" id="ow-grip" aria-hidden="true"></div>
    <aside class="ow-rail" id="ow-rail">
      <figure class="ow-quote" id="ow-quote">
        <img src="p/${quoteHero}.jpg" alt="" width="56" height="56">
        <div><blockquote><span class="q">“</span>${quoteText}<span class="q">”</span></blockquote><figcaption>— ${quoteName}</figcaption></div>
      </figure>
      <div class="ow-how"><h2 data-i18n="ow.howTitle"></h2><ol id="ow-how"></ol>
        <button type="button" data-ow="calib" data-i18n="ow.calib"></button>
        <a class="ow-support" href="${SITE}support.html" data-i18n="site.support"></a></div>
      <div class="ow-ad-wrap"><span class="ad-label" data-i18n="ow.ad"></span>
        <div class="ow-ad-box"><div id="ow-ad"></div></div></div>
    </aside>`);
  I18n.apply(document.getElementById('ow-bar'));
  I18n.apply(document.getElementById('ow-rail'));

  // The quote shows only when it fits whole; a clipped card is worse than none.
  const quoteCard = document.getElementById('ow-quote');
  const fitQuote = () => {
    quoteCard.classList.remove('ow-cut');
    if (quoteCard.scrollHeight > quoteCard.clientHeight + 1) quoteCard.classList.add('ow-cut');
  };
  new ResizeObserver(fitQuote).observe(document.getElementById('ow-rail'));
  window.addEventListener('resize', fitQuote);
  fitQuote();

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
