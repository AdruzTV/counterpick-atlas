/* Patch notes scraped from the official Overwatch site with jQuery.
   Blizzard sends no CORS headers, so a GitHub Action copies its pages into data/blizzard-patch-notes.html
   every 12 hours (scripts/mirror_patch_notes.py). Parsed patches are cached in localStorage for 12 hours.
   They are parsed in the language chosen in js/i18n.js: in Czech stat names and units are translated, in English
   they stay as Blizzard wrote them. Each language has its own cache.
   Exposes window.BlizzardPatches.load(heroes, version). */
(function ($) {
  'use strict';

  // In the Overwolf app js/counterpick-core.js points data files at GitHub Pages; on the site REMOTE is ''.
  const SOURCE = ((window.CounterpickCore && CounterpickCore.REMOTE) || '') + 'data/blizzard-patch-notes.html';
  const BASE = 'https://overwatch.blizzard.com/en-us/news/patch-notes/';
  const TTL = 12 * 60 * 60 * 1000;
  const STORE = 'cpa:blizzard-patches:v1';
  const MAX_HIGHLIGHTS = 8;
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const t = (key, params) => I18n.t(key, params);
  const cs = () => I18n.lang === 'cs';

  // English stat names from the patch notes -> Czech. Unknown stats stay in English.
  const STATS = {
    'damage': 'poškození', 'healing': 'léčení', 'damage and healing': 'poškození a léčení',
    'damage per second': 'poškození za sekundu', 'healing per second': 'léčení za sekundu',
    'healing over time': 'léčení v čase', 'damage per projectile': 'poškození projektilu',
    'explosion damage': 'poškození výbuchu', 'impact damage': 'poškození zásahem',
    'center projectile damage': 'středový projektil', 'total damage per volley': 'celkové poškození dávky',
    'critical damage multiplier': 'násobič kritického poškození', 'headshot multiplier': 'násobič zásahu do hlavy',
    'cooldown': 'cooldown', 'duration': 'trvání', 'max duration': 'maximální trvání', 'maximum duration': 'maximální trvání',
    'stealth duration': 'trvání stealthu', 'stun duration': 'trvání omráčení', 'decay duration': 'trvání úbytku',
    'overhealth and debuff duration': 'trvání overhealth a debuffu', 'overhealth': 'overhealth',
    'health': 'zdraví', 'base health': 'základní zdraví', 'armor': 'zbroj', 'base armor': 'základní zbroj',
    'shields': 'štíty', 'shield health': 'zdraví štítu', 'transformation duration': 'trvání transformace',
    'ammo': 'náboje', 'ammo reloaded': 'nabité náboje', 'reload time': 'doba přebíjení',
    'movement speed': 'rychlost pohybu', 'projectile speed': 'rychlost projektilu', 'projectile range': 'dosah projektilu',
    'attack speed': 'rychlost útoku', 'fire rate': 'rychlost střelby', 'drone fire rate': 'rychlost střelby dronů',
    'swing speed': 'rychlost švihu', 'cast time': 'doba seslání', 'recovery': 'zotavení', 'recovery time': 'doba zotavení',
    'ultimate cost': 'cena ultimátky', 'ultimate charge': 'nabíjení ultimátky', 'damage reduction': 'redukce poškození',
    'radius': 'poloměr', 'range': 'dosah', 'spread': 'rozptyl', 'maximum spread': 'maximální rozptyl',
    'knockback': 'odhození', 'charges': 'nabití', 'lifesteal': 'vysávání života', 'ability lifesteal': 'vysávání života ze schopností',
    'falloff range': 'pokles poškození se vzdáleností', 'minimum falloff distance': 'začátek poklesu poškození',
    'minimum falloff range': 'začátek poklesu poškození',
    'shotgun pellet count': 'počet broků', 'shotgun pellet damage': 'poškození broku',
  };
  // For these stats a smaller number is better for the hero.
  const LOWER_BETTER = /cooldown|cast time|recovery|reload time|spread|ultimate cost|wind-?up|delay|time to|charge time|self[- ]damage|damage taken|hit volume|experience required/i;
  // Section titles -> short tags, update titles -> headings (texts in js/i18n.js).
  const SECTION_TAGS = {
    'general updates': 'bp.general', 'core game updates': 'bp.core', 'competitive play updates': 'bp.competitive',
    'stadium updates': 'bp.stadium', 'hero updates': 'bp.heroes', 'map updates': 'bp.map', 'bug fixes': 'bp.fixes',
  };
  const UPDATE_TITLES = { 'general': 'bp.generalChanges', 'general changes': 'bp.generalChanges', 'item changes': 'bp.itemChanges' };
  const GENERIC_SECTIONS = /^(general updates|hotfix update|hero updates|hero reworks|tank|damage|support|bug fixes|core game updates|competitive play updates|stadium updates|map updates)$/i;

  const clean = s => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const num = s => { const m = String(s).match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;

  /* ---------- cache ---------- */
  const storeKey = () => cs() ? STORE : `${STORE}:${I18n.lang}`;
  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(storeKey()));
      return c && typeof c.t === 'number' && Array.isArray(c.patches) ? c : null;
    } catch (e) { return null; }
  }
  function writeCache(c) {
    try { localStorage.setItem(storeKey(), JSON.stringify(c)); } catch (e) { /* private mode or full storage */ }
  }

  /* ---------- values ---------- */
  // "6 seconds" -> "6 s"; in Czech also "1.25" -> "1,25", "35%" -> "35 %"
  function fmtVal(v) {
    const short = clean(v)
      .replace(/\s*meters per second\b/gi, ' m/s').replace(/\s*per second\b/gi, '/s')
      .replace(/\s*seconds?\b/gi, ' s').replace(/\s*meters?\b/gi, ' m').replace(/\s*degrees?\b/gi, '°');
    if (!cs()) return short;
    return short.replace(/\s*shots\b/gi, ' střel').replace(/\s*of current health\b/gi, ' aktuálního zdraví')
      .replace(/\s*of max(?:imum)? health\b/gi, ' max. zdraví')
      .replace(/(\d)\s*%/g, '$1 %').replace(/(\d)\.(\d)/g, '$1,$2');
  }
  const statCs = s => (cs() && STATS[clean(s).toLowerCase()]) || clean(s);
  const isBuff = (stat, up) => LOWER_BETTER.test(stat) ? !up : up;

  // One <li> of the patch notes -> { a, t, from?, to? } plus a buff/nerf guess.
  function parseChange(a, raw) {
    const line = clean(raw).replace(/\.$/, '');
    // "Armor reduced from 325 to 300. (6v6)" -> the trailing note goes after the stat name
    const noted = line.match(/^(.*?)\.?\s*\(([^)]+)\)$/);
    const body = noted ? noted[1] : line;
    let m = body.match(/^(.+?)\s+(?:(?:has|have) been\s+)?(?:increased|decreased|reduced|lowered|raised|reverted|changed|adjusted)\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+(in|for|on|while|during|when)\s+(.+))?$/i);
    if (m) {
      let [, stat, from, to, word, rest] = m;
      const unit = to.replace(/^[\d.,\-–\s]+/, '');
      if (/^[\d.,]+$/.test(from) && /^[a-z %°/]+$/i.test(unit)) from += ' ' + unit;   // "from 6 to 5 seconds"
      const where = [word ? (/^\d+v\d+$/i.test(rest) ? rest : `${word} ${rest}`) : '', noted ? noted[2] : ''].filter(Boolean).join(', ');
      const f = num(from), t = num(to);
      return {
        change: { a, from: fmtVal(from), t: statCs(stat) + (where ? ` (${where})` : ''), to: fmtVal(to) },
        effect: isNaN(f) || isNaN(t) || f === t ? null : (isBuff(stat, t > f) ? 'buff' : 'nerf'),
      };
    }
    // Only short stat names; "During Whole Hog, Chain Hook's cooldown is reduced by 80%" stays as written.
    m = line.match(/^([^,]+?)\s+(?:(?:has|have) been\s+)?(increased|decreased|reduced|lowered|raised)\s+by\s+(.+)$/i);
    if (m && m[1].split(' ').length <= 5 && !/\b(is|are)$/i.test(m[1])) {
      const up = /increased|raised/i.test(m[2]);
      return { change: { a, t: `${statCs(m[1])} ${up ? '+' : '−'}${fmtVal(m[3])}` }, effect: isBuff(m[1], up) ? 'buff' : 'nerf' };
    }
    if (/^removed$/i.test(line)) return { change: { a, t: t('bp.removed') }, effect: null };
    if (/^new(\.| minor perk| major perk| passive)?$/i.test(line)) return { change: { a, t: t('bp.new') }, effect: null };
    return { change: { a, t: line }, effect: null };
  }

  /* ---------- page parsing ---------- */
  // Texts of <p>/<li> inside $el, without developer comments.
  function texts($el, sel) {
    return $el.find(sel).filter(function () {
      return !$(this).closest('.PatchNotes-dev').length && !/^developer comments/i.test(clean($(this).text()));
    });
  }

  function heroChanges($h) {
    const out = [];
    let label = '';
    // Perks and general lines: a short <p> names the perk, the <li> items below belong to it.
    texts($h.find('.PatchNotesHeroUpdate-generalUpdates'), 'p, li').each(function () {
      const $el = $(this), txt = clean($el.text());
      if ($el.is('p')) {
        if ($el.closest('li').length || !txt || txt.length > 60) return;
        label = txt.replace(/\s*[–-]\s*minor perk$/i, t('bp.minorPerk')).replace(/\s*[–-]\s*major perk$/i, t('bp.majorPerk'));
      } else out.push(parseChange(label || t('bp.general'), txt));
    });
    $h.find('.PatchNotesAbilityUpdate').each(function () {
      const a = clean($(this).find('.PatchNotesAbilityUpdate-name').first().text()) || t('bp.general');
      texts($(this).find('.PatchNotesAbilityUpdate-detailList'), 'li').each(function () {
        out.push(parseChange(a, $(this).text()));
      });
    });
    return out;
  }

  function patchDate($p) {
    const m = String($p.find('[id^="patch-"]').first().attr('id') || '').match(/^patch-(\d{4}-\d{2}-\d{2}(?:-[\w-]+)?)$/);
    if (m) return { id: m[1], date: m[1].slice(0, 10) };
    const d = clean($p.find('.PatchNotes-date').first().text()).toLowerCase().match(/^([a-z]+) (\d{1,2}), (\d{4})$/);
    const mo = d ? MONTHS.indexOf(d[1]) : -1;
    if (mo < 0) return null;
    const iso = `${d[3]}-${String(mo + 1).padStart(2, '0')}-${d[2].padStart(2, '0')}`;
    return { id: iso, date: iso };
  }

  function parsePatch($p, pageUrl, heroKey) {
    const when = patchDate($p);
    if (!when) return null;
    const heroes = {}, order = [], highlights = [], titles = [];

    $p.find('.PatchNotes-section').each(function () {
      const $s = $(this);
      const title = clean($s.find('.PatchNotes-sectionTitle').first().text());
      const $heroes = $s.find('.PatchNotesHeroUpdate');
      titles.push(title);
      const section = SECTION_TAGS[title.toLowerCase()];
      const tag = section ? t(section) : $s.find('.PatchNotesMapUpdate').length ? t('bp.map') : /season \d+/i.test(title) ? t('bp.season') : title;

      if (/bug fix/i.test(title)) {
        const n = texts($s, 'li').length;
        if (n) highlights.push({ tag: t('bp.fixes'), title: t('bp.fixesTitle'), text: t('bp.fixesText', { n }) });
        return;
      }
      if (/hit volume/i.test(title)) {
        highlights.push({ tag: t('bp.hitboxes'), title, text: t('bp.hitboxText', { n: $heroes.length }) });
        return;
      }

      $heroes.each(function () {
        const key = heroKey[norm(clean($(this).find('.PatchNotesHeroUpdate-name').first().text()))];
        if (!key) return;
        if (!heroes[key]) { heroes[key] = { changes: [], buff: 0, nerf: 0, rework: false }; order.push(key); }
        const h = heroes[key];
        if (/rework/i.test(title)) h.rework = true;
        for (const c of heroChanges($(this))) {
          h.changes.push(c.change);
          if (c.effect) h[c.effect]++;
        }
      });

      $s.find('.PatchNotesGeneralUpdate').each(function () {
        const $g = $(this);
        const text = clean(texts($g, 'p, li').first().text());
        const name = clean($g.find('.PatchNotesGeneralUpdate-title').first().text()) || title;
        const heading = UPDATE_TITLES[name.toLowerCase()];
        if (text) highlights.push({ tag, title: heading ? t(heading) : name, text: cut(text, 220) });
      });
      if (!$heroes.length && !$s.find('.PatchNotesGeneralUpdate').length && !/hotfix/i.test(title)) {
        const text = clean(texts($s, 'li, p').first().text());
        if (text) highlights.push({ tag, title, text: cut(text, 220) });
      }
    });

    const list = order.map(key => {
      const h = heroes[key];
      const verdict = h.rework ? 'rework' : h.buff && !h.nerf ? 'buff' : h.nerf && !h.buff ? 'nerf' : 'mixed';
      return { changes: h.changes, key, verdict };
    });
    const count = v => list.filter(h => h.verdict === v).length;
    const tally = [['buff', 'buff'], ['nerf', 'nerf'], ['rework', 'rework'], ['mixed', t('bp.mixed')]]
      .filter(([v]) => count(v)).map(([v, label]) => `${label} ${count(v)}`).join(', ');
    const season = titles.join(' ').match(/season (\d+)/i);
    const kind = titles.some(s => /hotfix/i.test(s)) ? 'Hotfix' : season ? t('bp.seasonN', { n: season[1] }) : 'Patch';
    const special = titles.find(s => s && !GENERIC_SECTIONS.test(s) && !/hit volume/i.test(s));

    return {
      date: when.date,
      heroes: list,
      highlights: highlights.slice(0, MAX_HIGHLIGHTS),
      kind,
      summary: t('bp.summary') + (list.length ? t('bp.summaryHeroes', { n: list.length, tally }) : ''),
      title: special || (kind === 'Hotfix' ? 'Hotfix' : t('bp.update')),
      url: `${pageUrl}#patch-${when.id}`,
      id: when.id,
      auto: true,
    };
  }

  // The copy holds one <section data-source="..."> per Blizzard page (current and previous month).
  function parsePage(html, heroKey) {
    // Parse into an inert document: no scripts run and no images load.
    const doc = document.implementation.createHTMLDocument('');
    const $root = $(doc.body).append($.parseHTML(html, doc, false));
    const seen = {};
    return $root.find('section[data-source]').map(function () {
      const src = String($(this).attr('data-source') || '');
      const pageUrl = src.indexOf(BASE) === 0 ? src : BASE;
      return $(this).find('.PatchNotes-patch').map(function () { return parsePatch($(this), pageUrl, heroKey); }).get();
    }).get()
      .filter(p => p && !seen[p.id] && (seen[p.id] = true))
      .sort((x, y) => y.date.localeCompare(x.date));
  }

  /* ---------- loading ---------- */
  // `version` is patchNotesUpdated from data/status.json: when the Action brings a new copy, the cache is dropped.
  // Resolves to { patches, fetchedAt }.
  function load(heroes, version) {
    const v = version ? String(version) : null;
    const cached = readCache();
    if (cached && (!v || cached.v === v) && Date.now() - cached.t < TTL) return Promise.resolve({ patches: cached.patches, fetchedAt: cached.t });

    const heroKey = {};
    for (const h of heroes) { heroKey[norm(h.name)] = h.key; heroKey[norm(h.key)] = h.key; }
    return Promise.resolve($.ajax({ url: SOURCE + (v ? '?v=' + encodeURIComponent(v) : ''), dataType: 'text', timeout: 20000 }))
      .then(html => {
        const patches = parsePage(html, heroKey), t = Date.now();
        writeCache({ t, v, patches });
        return { patches, fetchedAt: t };
      })
      .catch(err => {
        if (cached) return { patches: cached.patches, fetchedAt: cached.t };   // stale beats nothing
        throw err;
      });
  }

  window.BlizzardPatches = { load };
})(jQuery);
