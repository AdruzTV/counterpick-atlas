/* Scan settings: the hotkeys (in the apps), and calibration, which shows where js/scoreboard.js cuts the portraits
   on a real screenshot. The scoreboard is found automatically; if that ever misses, drag the blue boxes onto the
   teammates' portraits and the red ones onto the enemies' (the sliders set portrait size and row spacing), which
   switches to this hand-placed layout. Changes save at once. Also manages learned samples: copy them out to share
   them in data/scoreboard-refs.json, or wipe them. Texts come from js/i18n.js and follow the language chosen on the
   site at once. */
(() => {
  const { esc, HOST, KEYS } = CPApp;
  const { t } = I18n;
  const IN_APP = HOST !== 'browser';
  const stage = document.getElementById('stage');
  const side = document.getElementById('side');
  const statusEl = document.getElementById('status');

  const S = {
    atlas: null, matcher: null,
    frame: null, src: null, result: null,
    layout: CPApp.layout(),
    rows: CPApp.read(CPApp.PREFS, {}).mode === '6v6' ? 6 : 5,
    auto: CPApp.autoLayout(), found: false,
    zoom: true, view: null, active: 'ally', drag: null, wipeArmed: false,
    capture: null, keyMsg: null,     // the hotkey waiting for new keys ('scan' | 'toggle'), the last word about it
  };
  let canvas = null, ctx = null;

  // The status line, kept as a text key so that a language switch can word it again.
  let said = null;
  const say = (key, cls = '', params) => {
    said = { key, cls, params };
    statusEl.textContent = t(key, params);
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  };

  /* ---------- frame and view ---------- */
  function setFrame(f) {
    S.frame = { width: f.width, height: f.height, data: new Uint8ClampedArray(f.data) };
    S.src = Scoreboard.frameCanvas(S.frame);
    stage.innerHTML = `<canvas id="cv" tabindex="0" aria-label="${t('cal.canvas')}"></canvas>`;
    canvas = stage.querySelector('canvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('keydown', nudge);
    locate();
    fitView();
    update();
  }

  // Automatic mode: take the layout found on the screenshot (the saved one stays as the fallback).
  function locate() {
    S.found = false;
    if (!S.auto || !S.frame) return;
    const found = Scoreboard.findLayout(S.frame);
    if (!found) return;
    S.found = true;
    S.layout = found.layout;
    S.rows = found.rows;
  }

  // Any hand adjustment switches to the hand-placed layout.
  function manual() {
    if (!S.auto) return;
    S.auto = false;
    S.found = false;
    CPApp.setAutoLayout(false);
  }

  // The part of the frame on screen: the whole frame, or zoomed onto the left half of the scoreboard.
  // Recomputed only on purpose (new frame, zoom toggle, reset), never while dragging.
  function fitView() {
    if (!S.frame) return;
    const { width: W, height: H } = S.frame, l = S.layout, s = l.size * H;
    let v = { x: 0, y: 0, w: W, h: H };
    if (S.zoom) {
      const cx = W / 2 + l.cx * H;
      v = { x: cx - 3 * s, y: (Math.min(l.ally, l.enemy) - 1.5 * l.pitch) * H, w: 14 * s, h: 0 };
      v.h = (Math.max(l.ally, l.enemy) + (S.rows + 0.5) * l.pitch) * H - v.y;
      v.x = Math.max(0, v.x); v.y = Math.max(0, v.y);
      v.w = Math.min(W - v.x, v.w); v.h = Math.min(H - v.y, v.h);
    }
    S.view = v;
    sizeCanvas();
  }

  function sizeCanvas() {
    if (!canvas) return;
    const v = S.view, k = Math.min(stage.clientWidth / v.w, stage.clientHeight / v.h);
    canvas.width = Math.max(1, Math.floor(v.w * k));
    canvas.height = Math.max(1, Math.floor(v.h * k));
    S.view.k = k;
  }

  const toCanvas = (x, y) => [(x - S.view.x) * S.view.k, (y - S.view.y) * S.view.k];
  const toFrame = e => {
    const r = canvas.getBoundingClientRect(), sx = canvas.width / r.width, sy = canvas.height / r.height;
    return [(e.clientX - r.left) * sx / S.view.k + S.view.x, (e.clientY - r.top) * sy / S.view.k + S.view.y];
  };

  function draw() {
    if (!ctx) return;
    const v = S.view, k = v.k;
    ctx.imageSmoothingEnabled = k < 1;
    ctx.drawImage(S.src, v.x, v.y, v.w, v.h, 0, 0, canvas.width, canvas.height);
    const bx = Scoreboard.boxes(S.layout, S.frame.width, S.frame.height, S.rows);
    ctx.font = `700 ${Math.max(11, Math.min(16, 0.35 * bx.ally[0].s * k))}px "Barlow Condensed", sans-serif`;
    for (const sideKey of ['ally', 'enemy']) {
      const colour = sideKey === 'ally' ? '#5ab6ff' : '#ff626a';
      bx[sideKey].forEach((b, i) => {
        const [x, y] = toCanvas(b.x - b.s / 2, b.y - b.s / 2), s = b.s * k;
        ctx.lineWidth = S.active === sideKey ? 2.5 : 1.5;
        ctx.strokeStyle = colour;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, s, s);
        // the strip the row colour is read from
        const st = Scoreboard.stripOf(b), [sx, sy] = toCanvas(st[0], st[1]);
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.strokeRect(sx, sy, (st[2] - st[0]) * k, (st[3] - st[1]) * k);
        const slot = S.result && S.result[sideKey][i], h = slot && slot.key && S.atlas.HM[slot.key];
        const label = slot ? (slot.empty ? '–' : slot.hidden ? t('ov.unknown') : h ? h.name + (slot.sure ? '' : ' ?') : '') : '';
        if (label) {
          const w = ctx.measureText(label).width + 8;
          ctx.fillStyle = 'rgba(13,19,32,.85)';
          ctx.fillRect(x - w - 4, y + s / 2 - 9, w, 18);
          ctx.fillStyle = slot.sure ? '#eef2f8' : '#f99e1a';
          ctx.fillText(label, x - w, y + s / 2 + 5);
        }
      });
    }
  }

  function update() {
    if (S.frame && S.matcher) S.result = S.matcher.read(S.frame, S.layout, { rows: S.rows, auto: false });
    draw();
    renderSide();
    if (!S.result) return;
    if (S.auto && S.found) say('cal.found');
    else if (S.auto) say('cal.notFound', 'warn');
    else if (!S.result.scoreboard) say('cal.noColors', 'warn');
    else say('cal.manual');
  }

  let saveTimer = 0;
  function changed() {
    manual();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => CPApp.saveLayout(S.layout), 250);
    update();
  }

  /* ---------- dragging and nudging ---------- */
  function down(e) {
    if (e.button !== 0) return;
    const [x, y] = toFrame(e), H = S.frame.height, l = S.layout;
    const mid = (l.ally + (S.rows - 1) * l.pitch / 2 + l.enemy + (S.rows - 1) * l.pitch / 2) / 2 * H;
    const allyFirst = l.ally < l.enemy;
    S.active = (y < mid) === allyFirst ? 'ally' : 'enemy';
    S.drag = { x, y, cx: l.cx, top: l[S.active] };
    canvas.classList.add('dragging');
    e.preventDefault();
  }
  document.addEventListener('mousemove', e => {
    if (!S.drag) return;
    const [x, y] = toFrame(e), H = S.frame.height;
    S.layout.cx = S.drag.cx + (x - S.drag.x) / H;
    S.layout[S.active] = S.drag.top + (y - S.drag.y) / H;
    S.layout = Scoreboard.cleanLayout(S.layout);
    S.result = null;   // full read on release, the boxes follow the mouse right away
    draw();
  });
  document.addEventListener('mouseup', () => {
    if (!S.drag) return;
    S.drag = null;
    canvas.classList.remove('dragging');
    changed();
  });
  function nudge(e) {
    const step = (e.shiftKey ? 5 : 1) / S.frame.height;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    S.layout.cx += d[0];
    S.layout[S.active] += d[1];
    S.layout = Scoreboard.cleanLayout(S.layout);
    changed();
  }
  window.addEventListener('resize', () => { if (S.view) { sizeCanvas(); draw(); } });

  /* ---------- side panel ---------- */
  const px = v => S.frame ? `${Math.round(v * S.frame.height)} px` : v.toFixed(3);
  const seg = (attr, value, label, on) => `<button type="button" class="seg-btn" data-${attr}="${value}" aria-pressed="${on}">${label}</button>`;

  function previews(sideKey) {
    if (!S.result || !S.src) return '';
    return `<div class="prev${sideKey === 'enemy' ? ' enemy' : ''}" style="--n:${S.rows}">${S.result[sideKey].map(s => {
      const h = s.key && S.atlas.HM[s.key];
      return `<div class="${s.sure ? 'sure' : ''}"><img src="${Scoreboard.cropURL(S.src, s.box, 44)}" alt=""><span>${s.empty ? t('cal.emptyRow') : s.hidden ? t('ov.unknown') : h ? esc(h.name) + (s.sure ? '' : ' ?') : ''}</span></div>`;
    }).join('')}</div>`;
  }

  const keyRow = (name, label) => `<div class="keyrow"><span>${label}</span>
    <button type="button" class="btn key${S.capture === name ? ' on' : ''}" data-key="${name}">${S.capture === name ? t('cal.keyPress') : `<kbd>${esc(KEYS[name])}</kbd>`}</button></div>`;

  function renderSide() {
    const st = S.matcher ? S.matcher.stats() : null, l = S.layout;
    side.innerHTML = `
      ${IN_APP ? `<span class="lbl">${t('cal.keys')}</span>
        ${keyRow('scan', t('cal.keyScan'))}${keyRow('toggle', t('cal.keyToggle'))}
        <p class="small${S.keyMsg && S.keyMsg.bad ? ' bad' : ''}">${t(S.keyMsg ? S.keyMsg.key : 'cal.keysHint')}</p>
        <div class="btns"><button type="button" class="btn" data-act="keys-default">${t('cal.keysDefault')}</button></div>
        <span class="lbl" style="margin-top:22px">${t('cal.calib')}</span>` : ''}
      <ol class="steps">
        <li>${IN_APP ? t('cal.step1App', { key: KEYS.scan }) : t('cal.step1Browser')}</li>
        <li>${t('cal.step2')}</li>
        <li>${t('cal.step3')}</li>
      </ol>
      <span class="lbl">${t('cal.find')}</span>
      <div class="seg">${seg('findmode', 'auto', t('cal.auto'), S.auto)}${seg('findmode', 'manual', t('cal.byHand'), !S.auto)}</div>
      <span class="lbl">${t('cal.rows')}</span>
      <div class="seg">${seg('rows', 5, '5v5', S.rows === 5)}${seg('rows', 6, '6v6', S.rows === 6)}</div>
      <span class="lbl">${t('cal.size')}</span>
      <div class="range"><input type="range" id="size" min="0.02" max="0.1" step="0.0005" value="${l.size}"><output>${px(l.size)}</output></div>
      <span class="lbl">${t('cal.pitch')}</span>
      <div class="range"><input type="range" id="pitch" min="0.03" max="0.1" step="0.0005" value="${l.pitch}"><output>${px(l.pitch)}</output></div>
      <div class="btns">
        <button type="button" class="btn" data-act="zoom">${t(S.zoom ? 'cal.whole' : 'cal.zoom')}</button>
        <button type="button" class="btn" data-act="reset">${t('cal.reset')}</button>
      </div>
      ${S.result ? `<span class="lbl">${t('cal.seen')}</span>${previews('ally')}<div style="height:4px"></div>${previews('enemy')}
        <p class="small">${t('cal.fixInOverlay')}</p>` : ''}
      <span class="lbl">${t('cal.samples')}</span>
      ${st ? `<p class="small" style="margin-top:0">${t('cal.stats', st)}</p>` : ''}
      <div class="btns">
        <button type="button" class="btn" data-act="export">${t('cal.export')}</button>
        <button type="button" class="btn" data-act="wipe">${t(S.wipeArmed ? 'cal.wipeSure' : 'cal.wipe')}</button>
      </div>
      <p class="small">${t('cal.share')}</p>`;
  }

  side.addEventListener('input', e => {
    if (e.target.id !== 'size' && e.target.id !== 'pitch') return;
    S.layout[e.target.id] = Number(e.target.value);
    e.target.nextElementSibling.textContent = px(S.layout[e.target.id]);
    S.layout = Scoreboard.cleanLayout(S.layout);
    if (S.auto) { manual(); renderSide(); }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { CPApp.saveLayout(S.layout); update(); }, 150);
    S.result = null;
    draw();
  });

  /* ---------- hotkeys ---------- */
  // The key a hotkey ends with, as the scan settings name it, or null for a modifier alone or a key that can't be
  // one. Letters as the keyboard layout has them (Y and Z on a Czech one), digits and the rest by their place.
  function keyName(e) {
    const c = e.code || '';
    if (/^Key[A-Z]$/.test(c)) return /^[a-z]$/i.test(e.key) ? e.key.toUpperCase() : c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^Numpad\d$/.test(c)) return 'num' + c.slice(6);
    if (/^F([1-9]|1\d|2[0-4])$/.test(c)) return c;
    return { Space: 'Space', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }[c] || null;
  }

  function startCapture(name) {
    S.capture = name;
    S.keyMsg = null;
    CPApp.pauseKeys(true);
    renderSide();
  }
  function stopCapture() {
    if (!S.capture) return;
    S.capture = null;
    S.keyMsg = null;
    CPApp.pauseKeys(false);
    renderSide();
  }
  const keyResult = r => {
    S.keyMsg = r.ok ? { key: 'cal.keySaved' } : { key: r.error === 'same' ? 'cal.keySame' : 'cal.keyOverwolf', bad: true };
    renderSide();
  };

  // The next combination pressed becomes the hotkey: Ctrl, Alt or Shift with a key, or an F key alone (a plain
  // letter would also type in the game's chat). Esc keeps the old one.
  document.addEventListener('keydown', e => {
    if (!S.capture) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') return stopCapture();
    const key = keyName(e);
    if (!key) return;
    const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
    if (!mods.length && !/^F\d+$/.test(key)) { S.keyMsg = { key: 'cal.keyNeedMod', bad: true }; renderSide(); return; }
    const name = S.capture;
    S.capture = null;
    CPApp.pauseKeys(false);
    CPApp.setKeys({ ...KEYS, [name]: [...mods, key].join('+') }).then(keyResult);
  }, true);
  window.addEventListener('blur', stopCapture);
  window.addEventListener('beforeunload', () => { if (S.capture) CPApp.pauseKeys(false); });

  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act !== 'wipe') S.wipeArmed = false;
    if (b.dataset.key) { if (S.capture === b.dataset.key) stopCapture(); else startCapture(b.dataset.key); return; }
    if (S.capture) stopCapture();
    if (act === 'keys-default') CPApp.setKeys(CPApp.DEFAULT_KEYS).then(keyResult);
    else if (act === 'close') CPApp.closeWindow();
    else if (act === 'zoom') { S.zoom = !S.zoom; fitView(); update(); }
    else if (act === 'reset') { S.layout = { ...Scoreboard.DEFAULT_LAYOUT }; fitView(); changed(); }
    else if (act === 'export') {
      const json = S.matcher.exportPack();
      CPApp.copyText(json).then(() => say('cal.copied'), () => {
        // No clipboard (a browser without permission): save the file instead.
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'scoreboard-refs.json' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        say('cal.downloaded');
      });
    } else if (act === 'wipe') {
      if (!S.wipeArmed) { S.wipeArmed = true; renderSide(); return; }
      S.wipeArmed = false;
      S.matcher.forget();
      update();
      say('cal.wiped');
    } else if (b.dataset.rows) { manual(); S.rows = Number(b.dataset.rows); fitView(); update(); }
    else if (b.dataset.findmode === 'auto') {
      S.auto = true;
      CPApp.setAutoLayout(true);
      locate();
      if (!S.found) S.layout = CPApp.layout();
      fitView();
      update();
    } else if (b.dataset.findmode === 'manual') {
      // Start the hand-placed layout from wherever the boxes are now.
      manual();
      CPApp.saveLayout(S.layout);
      update();
    }
  });

  /* ---------- start ---------- */
  CPApp.dragBy(document.getElementById('drag'));
  CPApp.resizeBy(document.getElementById('grip'));

  const noShot = () => `<p class="empty-msg">${IN_APP ? t('cal.noShotApp', { key: KEYS.scan }) : t('cal.noShotBrowser')}</p>`;
  CPApp.onKeys(() => {
    if (!S.matcher) return;
    renderSide();
    if (!canvas) stage.innerHTML = noShot();
  });
  // The language was switched on the site.
  I18n.onChange(() => {
    if (said) say(said.key, said.cls, said.params);
    if (!S.matcher) return;
    renderSide();
    if (canvas) canvas.setAttribute('aria-label', t('cal.canvas'));
    else stage.innerHTML = noShot();
  });

  CPApp.loadAtlas()
    .then(atlas => { S.atlas = atlas; S.matcher = new Scoreboard.Matcher(atlas); return S.matcher.ready; })
    .then(() => {
      renderSide();
      stage.innerHTML = noShot();
      CPApp.onScan(setFrame, message => say('ov.shotFail', 'err', { msg: message || '' }));
    })
    .catch(e => say('ov.dataFail', 'err', { msg: String(e && e.message || e) }));
})();
