/* Counterpick scoring shared by the site (index.html) and the in-game overlay (overlay/ingame.html). No DOM here.
   An Atlas indexes the data files, then ranks heroes for a pick state { mode, role, team, enemy, map, side }.
   Inside the apps (Overwolf, or the desktop app in desktop/ which serves its files as cpa://) the data files load
   from GitHub Pages first, so the apps stay current without an update; the copies shipped with them are the
   fallback. Exposes window.CounterpickCore. */
(() => {
  const SITE = 'https://adruztv.github.io/counterpick-atlas/';
  const REMOTE = typeof window.CPA_REMOTE === 'string' ? window.CPA_REMOTE
    : ['overwolf-extension:', 'cpa:'].includes(location.protocol) ? SITE : '';

  const ROLES = [
    { key: 'tank', label: 'Tank' },
    { key: 'damage', label: 'Damage' },
    { key: 'support', label: 'Support' },
  ];
  const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.key, r.label]));
  const ROLE_ORDER = { tank: 0, damage: 1, support: 2 };
  const ROLE_SVG = {
    tank: '<svg class="role-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5.2v6.1c0 5 3.4 9.3 8 10.7 4.6-1.4 8-5.7 8-10.7V5.2L12 2Z"/></svg>',
    damage: '<svg class="role-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1.4 2.6a7.5 7.5 0 0 1 6 6h-3.1v2.8h3.1a7.5 7.5 0 0 1-6 6v-3.1h-2.8v3.1a7.5 7.5 0 0 1-6-6h3.1v-2.8H4.6a7.5 7.5 0 0 1 6-6v3.1h2.8V4.6Z"/></svg>',
    support: '<svg class="role-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/></svg>',
  };
  const ALIASES = {
    'soldier-76': ['soldier', 's76', '76', 'vojak'], 'wrecking-ball': ['ball', 'hammond', 'koule', 'wb'],
    'junker-queen': ['jq', 'queen'], torbjorn: ['torb'], widowmaker: ['widow', 'wm'], zenyatta: ['zen'],
    baptiste: ['bap', 'bapt'], brigitte: ['brig'], reinhardt: ['rein'], roadhog: ['hog'], symmetra: ['sym', 'symm'],
    lifeweaver: ['lw', 'weaver'], 'jetpack-cat': ['cat', 'kocka', 'jetpack'], dva: ['diva'], dmon: ['demon'],
    cassidy: ['mccree', 'cass'], sojourn: ['soj'], doomfist: ['doom'], ramattra: ['ram'], kiriko: ['kiri'],
    junkrat: ['junk', 'rat'], pharah: ['phara', 'farah'], winston: ['monkey', 'opice'], sigma: ['sig'],
    freja: ['freya'], vendetta: ['vend'], doctrine: ['doc'], lucio: ['lucio'], moira: ['moi'],
  };
  const COMP_5V5 = { tank: 1, damage: 2, support: 2 };
  const STYLE_INFO = {
    dive: 'rychlé skoky na zadní linii soupeře',
    brawl: 'tlačení dopředu a boj zblízka',
    poke: 'střelba z dálky zpoza krytu',
  };
  // Points per reason: [unused, normal, hard/signature].
  const W = { counter: [0, 2, 3], pair: [0, 1.5, 2.5], fit: 1.5, misfit: 1, role: 2 };
  const MAP_MODES = [['control', 'Control'], ['escort', 'Escort'], ['hybrid', 'Hybrid'], ['push', 'Push'], ['flashpoint', 'Flashpoint'], ['clash', 'Clash']];
  const SIDED_MODES = ['escort', 'hybrid'];   // only here do teams take turns attacking and defending

  const arr = v => Array.isArray(v) ? v : [];
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const pairKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;

  // A data file as JSON. `fresh` revalidates with the server instead of trusting the browser cache.
  function loadJSON(path, fresh) {
    const get = url => fetch(url, fresh ? { cache: 'no-cache' } : undefined)
      .then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
    return REMOTE ? get(REMOTE + path).catch(() => get(path)) : get(path);
  }

  class Atlas {
    constructor() {
      this.heroes = []; this.HM = {};
      this.VS = {}; this.BY = {}; this.REVIEW = {};
      this.STYLES = {}; this.PAIRS = {};
      this.MAPS = []; this.MAP_BY = {}; this.MAP_TRAITS = {}; this.SIDES = {}; this.HERO_TAGS = {};
    }

    /* ---------- indexing the data files ---------- */
    setHeroes(list) {
      this.heroes = arr(list).filter(h => h && h.key && h.name).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
      this.HM = {};
      for (const h of this.heroes) { this.HM[h.key] = h; h._n = norm(h.name); h._a = (ALIASES[h.key] || []).map(norm); }
    }

    indexMatchups(docs) {
      const BY = {}, VS = {}, REVIEW = {}, HM = this.HM;
      for (const d of arr(docs)) {
        if (!d || !HM[d.key]) continue;
        if (d.review && d.review.reason) REVIEW[d.key] = { reason: String(d.review.reason), since: isDate(d.review.since) ? d.review.since : null };
        for (const e of arr(d.goodVs)) {
          if (!e || !HM[e.k] || e.k === d.key) continue;
          const s = e.s === 2 ? 2 : 1, r = String(e.r || '');
          (VS[d.key] ||= []).push({ k: e.k, s, r });
          (BY[e.k] ||= []).push({ k: d.key, s, r });
        }
      }
      Object.assign(this, { BY, VS, REVIEW });
    }

    indexSynergies(d) {
      this.STYLES = d && d.styles && typeof d.styles === 'object' ? d.styles : {};
      this.PAIRS = {};
      for (const p of arr(d && d.pairs)) if (p && p.a && p.b) this.PAIRS[pairKey(p.a, p.b)] = { s: p.s === 2 ? 2 : 1, r: String(p.r || '') };
    }

    // data/maps.json: what each map trait and each side (attack / defense) favours, hero tags and the maps with their traits.
    indexMaps(d) {
      this.MAP_TRAITS = d && d.traits && typeof d.traits === 'object' ? d.traits : {};
      this.SIDES = d && d.sides && typeof d.sides === 'object' ? d.sides : {};
      this.HERO_TAGS = {};
      for (const [tag, keys] of Object.entries(d && d.heroTags || {})) for (const k of arr(keys)) (this.HERO_TAGS[k] ||= []).push(tag);
      this.MAPS = arr(d && d.maps).filter(m => m && m.key && m.name)
        .map(m => ({ key: String(m.key), name: String(m.name), mode: String(m.mode), traits: arr(m.traits).filter(t => this.MAP_TRAITS[t]) }));
      this.MAP_BY = Object.fromEntries(this.MAPS.map(m => [m.key, m]));
    }

    /* ---------- names ---------- */
    // Heroes from `list` whose name or alias matches the normalized text, best matches first.
    nameMatch(list, n) {
      const score = h => {
        if (h._n.startsWith(n)) return 0;
        if (h._a.some(a => a.startsWith(n))) return 1;
        if (h._n.includes(n)) return 2;
        if (h._a.some(a => a.includes(n))) return 3;
        return -1;
      };
      return list.map(h => [score(h), h]).filter(([s]) => s >= 0)
        .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'cs')).map(([, h]) => h);
    }

    // Hero key for a name as the game or Overwolf writes it ("D.VA", "Soldier: 76", "Lúcio"), or null.
    heroByName(name) {
      const n = norm(name || '');
      if (!n) return null;
      const h = this.heroes.find(h => h._n === n || norm(h.key) === n || h._a.includes(n));
      return h ? h.key : null;
    }

    /* ---------- slots ---------- */
    // Role of every slot; null = any hero (6v6 open queue). In 5v5 your own role is one slot short in your team.
    slotRoles(pick, side) {
      if (pick.mode === '6v6') return Array(side === 'team' ? 5 : 6).fill(null);
      const n = { ...COMP_5V5 };
      if (side === 'team' && pick.role) n[pick.role]--;
      return ROLES.flatMap(r => Array(n[r.key]).fill(r.key));
    }

    // Keeps entered heroes when the mode or role changes: each goes to the first free slot of its role.
    fitSlots(keys, roles) {
      const out = roles.map(() => null);
      for (const k of arr(keys)) {
        if (!this.HM[k] || out.includes(k)) continue;
        const i = roles.findIndex((r, j) => !out[j] && (!r || r === this.HM[k].role));
        if (i >= 0) out[i] = k;
      }
      return out;
    }

    /* ---------- scoring ---------- */
    teamStyle(team) {
      const by = {};
      for (const k of team) for (const st of arr(this.STYLES[k])) (by[st] ||= []).push(k);
      const ranked = Object.entries(by).sort((a, b) => b[1].length - a[1].length);
      if (!ranked.length || ranked[0][1].length < 2 || (ranked[1] && ranked[1][1].length === ranked[0][1].length)) return null;
      return { style: ranked[0][0], heroes: ranked[0][1] };
    }

    // Does a { tags, styles } rule from maps.json match the hero?
    heroHits(h, rule) {
      const tags = this.HERO_TAGS[h.key] || [], styles = arr(this.STYLES[h.key]);
      return !!rule && (arr(rule.tags).some(t => tags.includes(t)) || arr(rule.styles).some(st => styles.includes(st)));
    }

    // Map and side never change the score, they are only tips: ✓ where they suit the hero, ! where they work against them.
    mapTips(h, map, side) {
      const out = [];
      for (const key of map ? map.traits : []) {
        const t = this.MAP_TRAITS[key];
        if (this.heroHits(h, t.good)) out.push({ v: 0, tip: 'good', t: `Mapa: ${t.label}`, r: `${map.name} – ${t.desc}` });
        else if (this.heroHits(h, t.bad)) out.push({ v: 0, tip: 'bad', t: `Mapa: ${t.label}`, r: `${map.name} – ${t.badDesc || t.desc}` });
      }
      if (side && this.heroHits(h, side.good)) out.push({ v: 0, tip: 'good', t: side.label, r: side.desc });
      return out;
    }

    // The chosen side counts unless the map is one where nobody attacks or defends (Control, Push, ...).
    activeSide(pick) {
      const map = this.MAP_BY[pick.map];
      return this.SIDES[pick.side] && (!map || SIDED_MODES.includes(map.mode)) ? this.SIDES[pick.side] : null;
    }

    scoreHero(h, team, enemy, style, map, side, mode) {
      const HM = this.HM, why = [];
      for (const e of enemy) {
        const win = arr(this.VS[h.key]).find(x => x.k === e);
        if (win) why.push({ v: W.counter[win.s], t: `${win.s === 2 ? 'Tvrdý counter na' : 'Silný proti'} ${HM[e].name}`, r: win.r });
        const loss = arr(this.VS[e]).find(x => x.k === h.key);
        if (loss) why.push({ v: -W.counter[loss.s], t: `${HM[e].name} ${loss.s === 2 ? 'tě tvrdě counteruje' : 'tě counteruje'}`, r: loss.r });
      }
      for (const t of team) {
        const p = this.PAIRS[pairKey(h.key, t)];
        if (p) why.push({ v: W.pair[p.s], t: `Kombo s ${HM[t].name}`, r: p.r });
      }
      if (style) {
        const own = arr(this.STYLES[h.key]);
        const names = style.heroes.map(k => HM[k].name).join(', ');
        if (own.includes(style.style)) why.push({ v: W.fit, t: `Sedí do stylu týmu: ${style.style}`, r: `${names} hrají ${style.style} (${STYLE_INFO[style.style]}).` });
        else if (own.length) why.push({ v: -W.misfit, t: `Tým hraje ${style.style}, ${h.name} spíš ${own.join(' / ')}`, r: `${names} hrají ${style.style} (${STYLE_INFO[style.style]}).` });
      }
      // 6v6 is usually played 2-2-2: fill the role the team is short of.
      if (mode === '6v6' && team.length >= 3) {
        const same = team.filter(k => HM[k].role === h.role).length;
        if (same === 0) why.push({ v: W.role, t: `V týmu chybí ${ROLE_LABEL[h.role]}`, r: '' });
        else if (same === 1) why.push({ v: W.role / 2, t: `V týmu je jen 1× ${ROLE_LABEL[h.role]}`, r: '' });
        else why.push({ v: -W.role, t: `Tým už má ${same}× ${ROLE_LABEL[h.role]}`, r: '' });
      }
      why.sort((a, b) => Math.abs(b.v) - Math.abs(a.v) || b.v - a.v);
      why.push(...this.mapTips(h, map, side));
      return { h, why, score: why.reduce((s, w) => s + w.v, 0) };
    }

    // Heroes you can still pick: your role in 5v5, nobody your team already has.
    candidates(pick) {
      return this.heroes.filter(h => !arr(pick.team).includes(h.key) && (pick.mode === '6v6' || h.role === pick.role));
    }

    // Candidates ranked best first, or null while no hero is entered.
    rankPicks(pick) {
      const team = arr(pick.team).filter(k => this.HM[k]), enemy = arr(pick.enemy).filter(k => this.HM[k]);
      if (!team.length && !enemy.length) return null;
      const style = this.teamStyle(team), map = this.MAP_BY[pick.map], side = this.activeSide(pick);
      return this.candidates(pick)
        .map(h => this.scoreHero(h, team, enemy, style, map, side, pick.mode))
        .sort((a, b) => b.score - a.score || b.why.filter(w => w.v > 0).length - a.why.filter(w => w.v > 0).length || a.h.name.localeCompare(b.h.name, 'cs'));
    }
  }

  window.CounterpickCore = {
    SITE, REMOTE, ROLES, ROLE_LABEL, ROLE_ORDER, ROLE_SVG, COMP_5V5, STYLE_INFO, W, MAP_MODES, SIDED_MODES,
    arr, isDate, norm, loadJSON, Atlas,
  };
})();
