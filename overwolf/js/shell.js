/* The site (index.html) as the Overwolf desktop window. index.html loads this only when window.overwolf exists.
   Adds a title bar to drag, minimise, maximise and close the frameless window, opens outside links in the real
   browser, and loads hero images that this app version doesn't ship (heroes added later) from GitHub Pages. */
(() => {
  const SITE = (window.CounterpickCore && CounterpickCore.SITE) || 'https://adruztv.github.io/counterpick-atlas/';
  const BAR = 32;

  document.head.insertAdjacentHTML('beforeend', `<style>
    body { padding-top: ${BAR}px; }
    .bar { top: ${BAR}px !important; }
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

  document.body.insertAdjacentHTML('afterbegin', `<div class="ow-bar" id="ow-bar">
      <span class="t">Counterpick <span>Atlas</span></span>
      <span class="h">Ve hře podrž <b>Tab</b> a zmáčkni <b>Alt+C</b> · <b>Alt+X</b> skryje overlay</span>
      <button type="button" data-ow="calib" title="Kalibrace scoreboardu">Kalibrace</button>
      <button type="button" data-ow="min" title="Minimalizovat" aria-label="Minimalizovat">–</button>
      <button type="button" data-ow="max" title="Maximalizovat" aria-label="Maximalizovat">□</button>
      <button type="button" class="x" data-ow="close" title="Zavřít" aria-label="Zavřít">×</button>
    </div><div class="ow-grip" id="ow-grip" aria-hidden="true"></div>`);

  const current = cb => overwolf.windows.getCurrentWindow(r => r && r.success && cb(r.window));
  const api = () => overwolf.windows.getMainWindow().CPA_api;

  document.getElementById('ow-bar').addEventListener('mousedown', e => {
    if (e.button === 0 && !e.target.closest('button')) current(w => overwolf.windows.dragMove(w.id));
  });
  document.getElementById('ow-grip').addEventListener('mousedown', e => {
    if (e.button === 0) current(w => overwolf.windows.dragResize(w.id, 'BottomRight'));
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
