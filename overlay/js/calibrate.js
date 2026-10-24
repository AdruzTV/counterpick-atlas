/* Calibration: shows where js/scoreboard.js cuts the portraits on a real screenshot. The scoreboard is found
   automatically; if that ever misses, drag the blue boxes onto the teammates' portraits and the red ones onto the
   enemies' (the sliders set portrait size and row spacing), which switches to this hand-placed layout. Changes save
   at once. Also manages learned samples: copy them out to share them in data/scoreboard-refs.json, or wipe them. */
(() => {
  const { esc, HOST, KEYS } = CPApp;
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
  };
  let canvas = null, ctx = null;

  const say = (text, cls = '') => { statusEl.textContent = text; statusEl.className = 'status' + (cls ? ' ' + cls : ''); };

  /* ---------- frame and view ---------- */
  function setFrame(f) {
    S.frame = { width: f.width, height: f.height, data: new Uint8ClampedArray(f.data) };
    S.src = Scoreboard.frameCanvas(S.frame);
    stage.innerHTML = '<canvas id="cv" tabindex="0" aria-label="Screenshot s rámečky portrétů. Táhni rámečky myší, šipky je posouvají po pixelu."></canvas>';
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
        const label = slot ? (slot.empty ? '–' : h ? h.name + (slot.sure ? '' : ' ?') : '') : '';
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
    if (S.auto && S.found) say('Scoreboard nalezen automaticky.');
    else if (S.auto) say('Scoreboard se automaticky najít nepodařilo: posuň rámečky na portréty ručně, nebo naskenuj znovu s Tab.', 'warn');
    else if (!S.result.scoreboard) say('Řádky nemají barvy scoreboardu: posuň rámečky na portréty, nebo naskenuj znovu s Tab.', 'warn');
    else say('Ruční rozložení, změny se ukládají hned.');
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
      return `<div class="${s.sure ? 'sure' : ''}"><img src="${Scoreboard.cropURL(S.src, s.box, 44)}" alt=""><span>${s.empty ? 'prázdné' : h ? esc(h.name) + (s.sure ? '' : ' ?') : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function renderSide() {
    const st = S.matcher ? S.matcher.stats() : null, l = S.layout;
    side.innerHTML = `
      <ol class="steps">
        <li>${IN_APP ? `Ve hře podrž <b>Tab</b> a zmáčkni <b>${KEYS.scan}</b>. Screenshot se tu objeví sám.` :'Vlož screenshot scoreboardu (<kbd>Ctrl+V</kbd>), přetáhni ho sem, nebo <label class="test" style="padding:0;border:0;background:none"><u>vyber soubor</u><input type="file" accept="image/*" data-shot hidden></label>.'}</li>
        <li>Scoreboard se na screenshotu hledá sám, rámečky ukazují, kde ho našel. Když sedí na portrétech, nic dalšího není potřeba.</li>
        <li>Když nesedí, táhni <b style="color:var(--blue)">modré</b> rámečky na portréty spoluhráčů a <b style="color:var(--bad)">červené</b> na portréty nepřátel (šipky posouvají po pixelu, se Shiftem po pěti) a posuvníky dolaď velikost a rozestup. Tím přepneš na ruční rozložení.</li>
      </ol>
      <span class="lbl">Hledání scoreboardu</span>
      <div class="seg">${seg('findmode', 'auto', 'Automaticky', S.auto)}${seg('findmode', 'manual', 'Ručně', !S.auto)}</div>
      <span class="lbl">Hráčů v týmu</span>
      <div class="seg">${seg('rows', 5, '5v5', S.rows === 5)}${seg('rows', 6, '6v6', S.rows === 6)}</div>
      <span class="lbl">Velikost portrétu</span>
      <div class="range"><input type="range" id="size" min="0.02" max="0.1" step="0.0005" value="${l.size}"><output>${px(l.size)}</output></div>
      <span class="lbl">Rozestup řádků</span>
      <div class="range"><input type="range" id="pitch" min="0.03" max="0.1" step="0.0005" value="${l.pitch}"><output>${px(l.pitch)}</output></div>
      <div class="btns">
        <button type="button" class="btn" data-act="zoom">${S.zoom ? 'Celá obrazovka' : 'Přiblížit scoreboard'}</button>
        <button type="button" class="btn" data-act="reset">Výchozí rozložení</button>
      </div>
      ${S.result ? `<span class="lbl">Co rámečky vidí</span>${previews('ally')}<div style="height:4px"></div>${previews('enemy')}
        <p class="small">Opravy hrdinů dělej v overlayi (klik na hrdinu). Každá oprava se uloží jako vzorek.</p>` : ''}
      <span class="lbl">Naučené vzorky</span>
      ${st ? `<p class="small" style="margin-top:0">Poznám ${st.heroes} z ${st.total} hrdinů · tvých vzorků ${st.own}, ze sdíleného balíčku ${st.pack}.</p>` : ''}
      <div class="btns">
        <button type="button" class="btn" data-act="export">Kopírovat vzorky</button>
        <button type="button" class="btn" data-act="wipe">${S.wipeArmed ? 'Opravdu smazat?' : 'Smazat moje vzorky'}</button>
      </div>
      <p class="small">Zkopírované vzorky vlož do <code>data/scoreboard-refs.json</code> v repozitáři a po nahrání na GitHub je dostanou všichni hráči.</p>`;
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

  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const act = b.dataset.act;
    if (act !== 'wipe') S.wipeArmed = false;
    if (act === 'close') CPApp.closeWindow();
    else if (act === 'zoom') { S.zoom = !S.zoom; fitView(); update(); }
    else if (act === 'reset') { S.layout = { ...Scoreboard.DEFAULT_LAYOUT }; fitView(); changed(); }
    else if (act === 'export') {
      const json = S.matcher.exportPack();
      CPApp.copyText(json).then(() => say('Vzorky jsou ve schránce: vlož je do data/scoreboard-refs.json.'), () => {
        // No clipboard (a browser without permission): save the file instead.
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'scoreboard-refs.json' });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        say('Vzorky jsou uložené jako scoreboard-refs.json: nahraď jím data/scoreboard-refs.json.');
      });
    } else if (act === 'wipe') {
      if (!S.wipeArmed) { S.wipeArmed = true; renderSide(); return; }
      S.wipeArmed = false;
      S.matcher.forget();
      update();
      say('Tvoje vzorky jsou smazané.');
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

  CPApp.loadAtlas()
    .then(atlas => { S.atlas = atlas; S.matcher = new Scoreboard.Matcher(atlas); return S.matcher.ready; })
    .then(() => {
      renderSide();
      stage.innerHTML = IN_APP ? `<p class="empty-msg">Zatím žádný screenshot. Ve hře podrž <kbd>Tab</kbd> a zmáčkni <kbd>${KEYS.scan}</kbd>.</p>`
        : '<p class="empty-msg">Vlož screenshot scoreboardu (<kbd>Ctrl+V</kbd>) nebo ho sem přetáhni.</p>';
      CPApp.onScan(setFrame, message => say(`Screenshot se nepovedl${message ? ': ' + message : ''}.`, 'err'));
    })
    .catch(e => say('Data se nepodařilo načíst: ' + (e && e.message || e), 'err'));
})();
