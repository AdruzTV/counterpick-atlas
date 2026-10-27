/* In-game overlay: what the last scoreboard scan found and which hero to pick, scored exactly like the site's
   Counterpick page (js/counterpick-core.js). Every slot can be corrected with a click. Corrections, confirmed
   scans and the player's own team as Overwolf reports it become samples, so recognition (js/scoreboard.js)
   gets better with every match. Runs in Overwolf, in the desktop app (desktop/) or, with a pasted screenshot
   instead of the hotkey, in a browser (overlay/js/app.js). Texts come from js/i18n.js and follow the language
   chosen on the site at once. */
(() => {
  const { ROLES, ROLE_LABEL, ROLE_ORDER, ROLE_SVG, MAP_MODES, SIDED_MODES, norm } = CounterpickCore;
  const { esc, HOST, KEYS } = CPApp;
  const { t } = I18n;
  const IN_APP = HOST !== 'browser';   // Overwolf or the desktop app: scans come from the hotkey
  // Scoreboard rows come sorted by role.
  const ROW_ROLES = { '5v5': ['tank', 'damage', 'damage', 'support', 'support'], '6v6': ['tank', 'tank', 'damage', 'damage', 'support', 'support'] };
  const VERIFY_MARGIN = 0.05;   // lead needed to learn two same-role teammates without asking

  const body = document.getElementById('body');
  const statusEl = document.getElementById('status');
  const picker = document.getElementById('picker');
  const confirmBtn = document.getElementById('confirm');

  const prefs = CPApp.read(CPApp.PREFS, {});
  const S = {
    atlas: null, matcher: null,
    mode: prefs.mode === '6v6' ? '6v6' : '5v5',
    role: ROLE_LABEL[prefs.role] ? prefs.role : null,
    map: typeof prefs.map === 'string' ? prefs.map : '',
    side: prefs.side === 'attack' || prefs.side === 'defense' ? prefs.side : '',
    ally: [], enemy: [], self: null, selfKey: null,
    scannedAt: 0, scoreboardOk: true, error: null, fromGame: false, saved: 0,   // error: { key, msg } of js/i18n.js
    pick: null,                     // { side, i, filter, q } while the hero picker is open
  };
  const rows = () => S.mode === '6v6' ? 6 : 5;
  const blank = () => ({ key: null, src: null, sure: false, empty: false, thumb: null, crop: '', alts: [], learned: false });
  const savePrefs = () => CPApp.write(CPApp.PREFS, { mode: S.mode, role: S.role, map: S.map, side: S.side });

  function fitRows() {
    for (const side of ['ally', 'enemy']) {
      while (S[side].length < rows()) S[side].push(blank());
      S[side].length = rows();
    }
    if (S.self !== null && S.self >= rows()) S.self = null;
  }

  /* ---------- reading a scan ---------- */
  function process(frame) {
    const A = S.atlas, info = CPApp.gameInfo(A);
    const data = new Uint8ClampedArray(frame.data);   // own copy, the frame lives in the background window
    const f = { width: frame.width, height: frame.height, data };
    // Find the scoreboard on the screenshot; its number of rows also tells 5v5 from 6v6.
    const found = CPApp.autoLayout() ? Scoreboard.findLayout(f) : null;
    if (found) { S.mode = found.rows === 6 ? '6v6' : '5v5'; savePrefs(); }
    const roleRows = info.queue === 'OPEN_QUEUE' ? null : ROW_ROLES[S.mode];
    const fullTeam = info.allies.length === rows();
    const opts = {
      auto: false, rows: rows(),
      roles: roleRows && { ally: roleRows, enemy: roleRows },
      allowed: fullTeam ? { ally: info.allies } : null,
      boost: { ally: info.allies, enemy: info.enemiesSeen },
    };
    const res = S.matcher.read(f, found ? found.layout : CPApp.layout(), opts);
    const canvas = Scoreboard.frameCanvas(f);
    const slot = (s, src) => ({
      ...blank(), key: s.key, src: s.key ? src : null, sure: s.key ? src === 'game' || s.sure : false, empty: s.empty,
      thumb: s.empty ? null : s.cut.thumb, crop: Scoreboard.cropURL(canvas, s.box), alts: s.alts, cut: s.cut, role: s.role,
    });
    S.ally = res.ally.map(s => slot(s, fullTeam ? 'game' : 'scan'));
    S.enemy = res.enemy.map(s => slot(s, 'scan'));
    // Who the player is: Overwolf's roster, else the highlighted row, else the hero they were last time.
    const known = info.self || (res.self === null && S.selfKey);
    S.self = known ? S.ally.findIndex(s => s.key === known) : res.self;
    if (S.self < 0) S.self = res.self;
    S.scoreboardOk = found ? true : res.scoreboard;
    S.fromGame = fullTeam;
    S.scannedAt = Date.now();
    S.error = null;
    S.saved = 0;
    // Row roles: the role icons when every row showed one, else the role queue order.
    const icons = res.ally.map(s => s.role);
    const rowRoles = icons.every((r, i) => r || res.ally[i].empty) ? icons : roleRows;
    if (fullTeam && rowRoles && S.scoreboardOk) learnFromRoster(rowRoles);
    syncRole();
    closePicker();
    render();
  }

  // Overwolf named the whole team: each row's role is known (icon or role queue order), so a role with one hero
  // pins its row exactly, and two heroes of one role are told apart when one way round matches clearly better.
  function learnFromRoster(roleRows) {
    const A = S.atlas, slots = S.ally;
    const keys = slots.map(s => s.key).filter(Boolean);
    const want = {}, have = {};
    for (const r of roleRows) want[r] = (want[r] || 0) + 1;
    for (const k of keys) have[A.HM[k].role] = (have[A.HM[k].role] || 0) + 1;
    if (keys.length !== roleRows.length || ROLES.some(r => (want[r.key] || 0) !== (have[r.key] || 0))) return;   // not role queue after all
    for (const r of ROLES) {
      const idx = roleRows.map((x, i) => x === r.key ? i : -1).filter(i => i >= 0);
      const heroes = keys.filter(k => A.HM[k].role === r.key);
      if (idx.some(i => slots[i].empty)) continue;
      let order = heroes;
      if (idx.length === 2) {
        // Both rows must agree: each prefers its own hero, and clearly enough together.
        const sc = (i, k) => (S.matcher.rank(slots[i].cut, { allowed: [k] })[0] || { score: 0 }).score;
        const a = sc(idx[0], heroes[0]) - sc(idx[0], heroes[1]), b = sc(idx[1], heroes[1]) - sc(idx[1], heroes[0]);
        if (a > 0 && b > 0 && a + b >= VERIFY_MARGIN) order = heroes;
        else if (a < 0 && b < 0 && -(a + b) >= VERIFY_MARGIN) order = [heroes[1], heroes[0]];
        else continue;
      } else if (idx.length !== 1) continue;
      idx.forEach((i, j) => {
        slots[i].key = order[j];
        slots[i].sure = true;
        S.matcher.learn(slots[i].thumb, order[j], 'a');
        slots[i].learned = true;
      });
    }
  }

  // In 5v5 your role is the role of the hero you are playing. The hero is remembered for the next scan.
  function syncRole() {
    const me = S.self !== null && S.ally[S.self];
    S.selfKey = me && me.key || null;
    if (S.mode === '5v5' && me && me.key) { S.role = S.atlas.HM[me.key].role; savePrefs(); }
  }

  function onFrame(frame) {
    try { process(frame); } catch (e) { S.error = { key: 'ov.readFail', msg: String(e && e.message || e) }; render(); }
  }
  function onScanError(message) {
    S.error = { key: 'ov.shotFail', msg: message || '' };
    render();
  }
  const errorText = () => S.error ? t(S.error.key, { msg: S.error.msg }) : '';

  // Before the first scan of a match, show the team Overwolf already knows (rows in role order, like the
  // scoreboard). After a scan the scan wins; the next one picks up hero swaps.
  function applyRoster() {
    if (S.scannedAt || S.ally.some(s => s.src === 'manual')) return;
    const info = CPApp.gameInfo(S.atlas);
    if (!info.allies.length) return;
    const keys = [...info.allies].sort((a, b) => ROLE_ORDER[S.atlas.HM[a].role] - ROLE_ORDER[S.atlas.HM[b].role]);
    S.ally = Array.from({ length: rows() }, (_, i) => keys[i] ? { ...blank(), key: keys[i], src: 'game', sure: true } : blank());
    S.self = info.self ? S.ally.findIndex(s => s.key === info.self) : null;
    if (S.self < 0) S.self = null;
    syncRole();
    render();
  }

  /* ---------- rendering ---------- */
  const fmtPts = v => (v > 0 ? '+' : v < 0 ? '−' : '') + I18n.num(Math.abs(v));
  const scoreCls = v => v > 0 ? 'score' : v < 0 ? 'score neg' : 'score zero';
  const seg = (attr, value, label, on) => `<button type="button" class="seg-btn" data-${attr}="${value}" aria-pressed="${on}">${label}</button>`;

  function pickState() {
    return {
      mode: S.mode, role: S.role, map: S.map, side: S.side,
      team: S.ally.filter((s, i) => i !== S.self && s.key).map(s => s.key),
      enemy: S.enemy.filter(s => s.key).map(s => s.key),
    };
  }

  function slotHtml(side, s, i) {
    const h = s.key && S.atlas.HM[s.key];
    const pic = h ? `<img class="hero" src="p/${h.key}.jpg" alt="">` : `<span class="empty">${s.empty ? '–' : '+'}</span>`;
    const label = h ? esc(h.name) : t(s.empty ? 'ov.nobody' : 'ov.fill');
    const badge = side === 'ally' && i === S.self ? `<span class="badge">${t('ov.you')}</span>` : '';
    const game = s.src === 'game' ? `<span class="badge game" title="${t('ov.gameTitle')}">${t('ov.game')}</span>` : '';
    return `<button type="button" class="slot${h && !s.sure ? ' unsure' : ''}" data-slot="${side}:${i}" title="${t('ov.fix')}">
      ${badge}${game}${pic}${s.crop ? `<img class="seen" src="${s.crop}" alt="">` : ''}<span class="nm">${label}</span></button>`;
  }

  function mapSelect() {
    const A = S.atlas;
    if (!A.MAPS.length) return '';
    const groups = MAP_MODES.map(([mode, label]) => {
      const list = A.MAPS.filter(m => m.mode === mode);
      return list.length ? `<optgroup label="${label}">${list.map(m => `<option value="${esc(m.key)}"${m.key === S.map ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    return `<select class="sel" id="map" aria-label="${t('ov.map')}"><option value="">${t('ov.anyMap')}</option>${groups}</select>`;
  }

  function sidePicker() {
    const map = S.atlas.MAP_BY[S.map];
    if (!Object.keys(S.atlas.SIDES).length || (map && !SIDED_MODES.includes(map.mode))) return '';
    return `<div class="seg" role="group" aria-label="${t('cp.attackOrDefense')}">${seg('sidepick', 'attack', t('cp.attack'), S.side === 'attack')}${seg('sidepick', 'defense', t('cp.defense'), S.side === 'defense')}</div>`;
  }

  function whyList(c, max) {
    const main = c.why.filter(w => !w.tip).slice(0, max), tips = c.why.filter(w => w.tip).slice(0, 1);
    const li = w => `<li class="${w.tip ? 'tip-' + w.tip : w.v > 0 ? 'up' : 'down'}"><b>${w.tip ? (w.tip === 'bad' ? '!' : '✓') : fmtPts(w.v)}</b><span>${esc(w.t)}</span></li>`;
    return main.concat(tips).map(li).join('');
  }

  // The hero the player already plays (their row on the scoreboard), scored like the recommendations, with its
  // place among them. Nothing while the player hasn't picked or isn't known.
  function ownHtml(ranked) {
    const me = S.self !== null && S.ally[S.self], key = me && me.key, A = S.atlas, h = key && A.HM[key];
    if (!h) return '';
    const pick = pickState();
    const c = A.scoreHero(h, pick.team, pick.enemy, A.teamStyle(pick.team), A.MAP_BY[pick.map], A.activeSide(pick), pick.mode);
    const pos = ranked.findIndex(x => x.h.key === key), best = ranked[0];
    const note = pos < 0 ? t('ov.ownOtherRole') : pos === 0 ? t('ov.ownBest')
      : best.score > c.score ? t('ov.ownBehind', { name: esc(best.h.name), n: I18n.num(best.score - c.score) }) : '';
    const why = whyList(c, 3) || `<li><span>${t('cp.neutral')}</span></li>`;
    return `<span class="lbl">${t('ov.ownPick')}${pos >= 0 ? ` <small>· ${t('ov.ownRank', { pos: pos + 1, n: ranked.length })}</small>` : ''}</span>
      <article class="rc own"><img src="p/${h.key}.jpg" alt="">
        <div><strong>${esc(h.name)}</strong>${note ? `<p class="own-note">${note}</p>` : ''}<ul class="why">${why}</ul></div>
        <span class="${scoreCls(c.score)}">${fmtPts(c.score)}</span></article>`;
  }

  function recsHtml() {
    if (S.mode === '5v5' && !S.role) return `<p class="note">${t('ov.pickRole')}</p>`;
    const ranked = S.atlas.rankPicks(pickState());
    if (!ranked) return `<p class="empty-msg">${IN_APP ? t('ov.emptyApp', { key: KEYS.scan }) : t('ov.emptyBrowser')}</p>`;
    if (!ranked.length) return ownHtml(ranked) + `<p class="empty-msg">${t('cp.noneLeft')}</p>`;
    if (!ranked.some(c => c.why.some(w => !w.tip))) return ownHtml(ranked) + `<p class="empty-msg">${t('ov.nothing')}</p>`;
    const top = ranked.slice(0, 3);
    const more = ranked.slice(3, 6).filter(c => c.score >= 0);
    const avoid = ranked.filter(c => c.score < 0 && !top.includes(c)).slice(-2).reverse();
    const row = (c, pickWhy) => {
      const w = pickWhy(c.why);
      return `<div class="rr"><img src="p/${c.h.key}.jpg" alt=""><div><strong>${esc(c.h.name)}</strong>${w ? `<p>${esc(w.t)}</p>` : ''}</div><span class="${scoreCls(c.score)}">${fmtPts(c.score)}</span></div>`;
    };
    return `${ownHtml(ranked)}<span class="lbl">${t('cp.recs')} <small>${S.mode === '5v5' ? ROLE_LABEL[S.role] : '6v6'} · ${t('ov.compared', { n: ranked.length })}</small></span>
      <div class="recs">${top.map((c, i) => `<article class="rc"><img src="p/${c.h.key}.jpg" alt="">
        <div><span class="rank">#${i + 1}</span><strong>${esc(c.h.name)}</strong><ul class="why">${whyList(c, 3)}</ul></div>
        <span class="${scoreCls(c.score)}">${fmtPts(c.score)}</span></article>`).join('')}</div>
      ${more.length ? `<span class="lbl">${t('cp.more')}</span><div class="rows">${more.map(c => row(c, why => why.find(w => w.v > 0))).join('')}</div>` : ''}
      ${avoid.length ? `<span class="lbl">${t('cp.avoid')}</span><div class="rows">${avoid.map(c => row(c, why => why.find(w => w.v < 0))).join('')}</div>` : ''}`;
  }

  // "Saved N samples" shows in the status line for a few seconds.
  let savedTimer = 0;
  function flashSaved(n) {
    S.saved = n;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { S.saved = 0; setStatus(); }, 4000);
  }

  function setStatus() {
    let text = t('ov.ready'), cls = '';
    if (S.error) { text = errorText(); cls = 'err'; }
    else if (S.scannedAt) {
      const d = new Date(S.scannedAt), all = S.ally.concat(S.enemy).filter(s => s.key);
      const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      text = t('ov.scanned', { time, sure: all.filter(s => s.sure).length, all: all.length });
      if (!S.scoreboardOk) { text = t('ov.noBoard'); cls = 'warn'; }
    }
    if (S.saved) text = t('ov.saved', S.saved);
    statusEl.textContent = text;
    statusEl.className = 'status' + (cls ? ' ' + cls : '');
  }

  function render() {
    if (!S.atlas) return;
    fitRows();
    const unsure = S.ally.concat(S.enemy).filter(s => s.key && !s.sure).length;
    const selfHint = S.self === null && S.ally.filter(s => s.key).length === rows()
      ? `<p class="note">${t('ov.whoAmI')}</p>` : '';
    body.innerHTML = `
      ${IN_APP ? '' : `<div class="test">${t('ov.test')}</div>`}
      ${S.error ? `<p class="note err">${esc(errorText())}</p>` : ''}
      ${S.scannedAt && !S.scoreboardOk ? `<p class="note">${t('ov.noColors', { key: KEYS.scan })}</p>` : ''}
      <div class="opts">
        <div class="seg" role="group" aria-label="${t('cp.mode')}">${seg('mode', '5v5', '5v5', S.mode === '5v5')}${seg('mode', '6v6', '6v6', S.mode === '6v6')}</div>
        ${S.mode === '5v5' ? `<div class="seg" role="group" aria-label="${t('cp.yourRole')}">${ROLES.map(r => seg('role', r.key, ROLE_SVG[r.key] + r.label, S.role === r.key)).join('')}</div>` : ''}
      </div>
      <div class="opts">${mapSelect()}${sidePicker()}</div>
      <span class="lbl">${t('cp.team')} ${S.fromGame ? `<small>${t('ov.fromGame')}</small>` : ''}</span>
      <div class="slots" style="--n:${rows()}">${S.ally.map((s, i) => slotHtml('ally', s, i)).join('')}</div>
      <span class="lbl">${t('cp.enemies')} ${unsure ? `<small>${t('ov.unsure')}</small>` : ''}</span>
      <div class="slots enemy" style="--n:${rows()}">${S.enemy.map((s, i) => slotHtml('enemy', s, i)).join('')}</div>
      ${selfHint}
      ${recsHtml()}`;
    confirmBtn.disabled = !S.ally.concat(S.enemy).some(s => s.thumb && s.key && !s.learned);
    setStatus();
  }

  /* ---------- hero picker (corrections) ---------- */
  function openPicker(side, i) {
    // Offer the heroes of the row's role: from its icon on the screenshot, else the role queue order.
    const role = S[side][i].role || (S.mode === '5v5' ? ROW_ROLES['5v5'][i] : null);
    S.pick = { side, i, filter: role || 'all', q: '' };
    renderPicker();
    picker.querySelector('#pk-q').focus();
  }
  function closePicker() { S.pick = null; picker.hidden = true; picker.innerHTML = ''; }

  function pickerGrid() {
    const { side, i, filter, q } = S.pick, s = S[side][i];
    // Typing searches every hero; the role tabs only narrow the grid while the search box is empty.
    const list = q ? S.atlas.nameMatch(S.atlas.heroes, norm(q)) : S.atlas.heroes.filter(h => filter === 'all' || h.role === filter);
    return list.map(h => `<button type="button" data-hero="${h.key}" class="${h.key === s.key ? 'cur' : ''}${s.alts.includes(h.key) && h.key !== s.key ? ' alt' : ''}">
      <img src="p/${h.key}.jpg" alt="" loading="lazy"><span>${esc(h.name)}</span></button>`).join('') || `<p class="empty-msg">${t('cp.nobody')}</p>`;
  }

  function renderPicker() {
    const { side, i, filter } = S.pick, s = S[side][i], h = s.key && S.atlas.HM[s.key];
    const tabs = [['all', t('ov.all')]].concat(ROLES.map(r => [r.key, r.label]));
    picker.innerHTML = `<div class="pk-head">
        ${s.crop ? `<img src="${s.crop}" alt="${t('ov.crop')}">` : ''}
        <div><strong>${t('ov.slot', { who: t(side === 'ally' ? 'cp.mate' : 'cp.enemy'), n: i + 1 })}</strong>
          <p>${h ? t('ov.now', { name: esc(h.name) }) : t('ov.empty')}${s.crop ? t('ov.cropHint') : ''}${s.alts.length ? t('ov.altsHint') : ''}</p></div>
        <button type="button" class="ic x" data-pk="close" aria-label="${t('ov.close')}">×</button></div>
      <div class="pk-tools"><input id="pk-q" type="text" placeholder="${t('ov.search')}" autocomplete="off" spellcheck="false" value="${esc(S.pick.q)}">
        <div class="seg">${tabs.map(([k, l]) => seg('pkrole', k, l, filter === k)).join('')}</div></div>
      <div class="pk-tools">${side === 'ally' ? `<button type="button" class="btn" data-pk="self">${t(S.self === i ? 'ov.notMe' : 'ov.me')}</button>` : ''}
        <button type="button" class="btn" data-pk="clear">${t('ov.clear')}</button></div>
      <div class="pk-grid" id="pk-grid">${pickerGrid()}</div>`;
    picker.hidden = false;
  }

  function choose(key) {
    const { side, i } = S.pick, list = S[side], s = list[i];
    const j = key ? list.findIndex((x, n) => n !== i && x.key === key) : -1;
    if (j >= 0) list[j] = { ...list[j], key: s.key, sure: false, src: s.key ? 'manual' : null };   // one hero per team: swap
    list[i] = { ...s, key, src: key ? 'manual' : null, sure: !!key, empty: false };
    if (s.thumb && key) { S.matcher.learn(s.thumb, key, 'u'); list[i].learned = true; flashSaved(1); }
    if (side === 'ally' && i === S.self) syncRole();
    closePicker();
    render();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') { CPApp.hideOverlay(); return; }
    if (b.dataset.act === 'calib') { CPApp.openCalibration(); return; }
    if (b.dataset.act === 'confirm') {
      let n = 0;
      for (const s of S.ally.concat(S.enemy)) if (s.thumb && s.key && !s.learned) { S.matcher.learn(s.thumb, s.key, 'u'); s.learned = true; s.sure = true; n++; }
      flashSaved(n);
      render();
      return;
    }
    if (b.dataset.slot) { const [side, i] = b.dataset.slot.split(':'); openPicker(side, +i); return; }
    if (b.dataset.hero) { choose(b.dataset.hero); return; }
    if (b.dataset.pk === 'close') { closePicker(); return; }
    if (b.dataset.pk === 'clear') { choose(null); return; }
    if (b.dataset.pk === 'self') { const i = S.pick.i; S.self = S.self === i ? null : i; syncRole(); closePicker(); render(); return; }
    if (b.dataset.pkrole) { S.pick.filter = b.dataset.pkrole; renderPicker(); return; }
    if (b.dataset.mode) S.mode = b.dataset.mode;
    else if (b.dataset.role) S.role = b.dataset.role;
    else if (b.dataset.sidepick) S.side = S.side === b.dataset.sidepick ? '' : b.dataset.sidepick;
    else return;
    savePrefs();
    render();
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'pk-q' || !S.pick) return;
    S.pick.q = e.target.value;
    document.getElementById('pk-grid').innerHTML = pickerGrid();
  });
  document.addEventListener('change', e => {
    if (e.target.id !== 'map') return;
    S.map = e.target.value;
    savePrefs();
    render();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'pk-q') { const b = picker.querySelector('[data-hero]'); if (b) choose(b.dataset.hero); }
    if (e.key !== 'Escape') return;
    if (S.pick) closePicker();
    else CPApp.hideOverlay();
  });

  CPApp.dragBy(document.getElementById('drag'));
  CPApp.resizeBy(document.getElementById('grip'));
  const keysHint = () => { document.getElementById('keys').innerHTML = t('ov.keys', { scan: KEYS.scan, toggle: KEYS.toggle, desktop: HOST === 'desktop' }); };
  keysHint();
  // The language was switched on the site (or in the desktop app's tray menu).
  let loadFailed = '';
  I18n.onChange(() => {
    keysHint();
    if (loadFailed) { statusEl.textContent = t('ov.dataFail', { msg: loadFailed }); return; }
    render();
    if (S.pick) renderPicker();
  });

  CPApp.loadAtlas()
    .then(atlas => { S.atlas = atlas; S.matcher = new Scoreboard.Matcher(atlas); return S.matcher.ready; })
    .then(() => {
      fitRows();
      render();
      CPApp.onGame(what => {
        if (what === 'roster') applyRoster();
        else { S.ally = []; S.enemy = []; S.self = null; S.selfKey = null; S.scannedAt = 0; S.map = ''; S.side = ''; savePrefs(); render(); }
      });
      applyRoster();
      CPApp.onScan(onFrame, onScanError);
    })
    .catch(e => { loadFailed = String(e && e.message || e); statusEl.textContent = t('ov.dataFail', { msg: loadFailed }); statusEl.className = 'status err'; });
})();
