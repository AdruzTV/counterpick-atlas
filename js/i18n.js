/* Interface texts in Czech and English for the site (index.html), the overlay and calibration (overlay/), the Overwolf
   title bar (overwolf/js/shell.js) and the desktop app's tray menu and dialogs (desktop/main.js requires this file).
   No library and no build: every text is [Czech, English]; a missing English text falls back to Czech. A text is a
   string with {param} slots or, for plurals, a function of the params. Texts may hold HTML, params are inserted as
   given, so callers escape what came from data.
   In pages the choice is kept in localStorage (cpa:lang:v1). Pages of one origin follow each other at once through
   the storage event: in the desktop app the site, the overlay and calibration are all cpa://atlas. The desktop app
   also keeps the choice itself for its tray menu (desktop/preload.js); a choice in either place reaches the other.
   Without a stored choice: Czech on Czech and Slovak systems, English elsewhere.
   Data files carry English next to Czech as <field>_en; pick(obj, 'field') takes it in English where it exists.
   Exposes window.I18n in pages, module.exports in Node. */
(() => {
  const LANGS = ['cs', 'en'];
  const STORE = 'cpa:lang:v1';

  const TEXTS = {
    'lang.name': ['Čeština', 'English'],
    'lang.label': ['Jazyk', 'Language'],

    /* ---------- site: page frame ---------- */
    'site.metaDesc': ['Neoficiální český průvodce k Overwatch: patch notes, countery, schopnosti a perky všech hrdinů.',
      'Unofficial fan guide to Overwatch: patch notes, counters, abilities and perks of every hero.'],
    'site.home': ['Counterpick Atlas – přehled', 'Counterpick Atlas – home'],
    'site.searchPh': ['Najdi hrdinu… třeba Genji nebo Rein', 'Find a hero… e.g. Genji or Rein'],
    'site.searchLabel': ['Najdi hrdinu', 'Find a hero'],
    'site.nav': ['Sekce', 'Sections'],
    'nav.patch': ['Patch notes', 'Patch notes'],
    'nav.heroes': ['Hrdinové', 'Heroes'],
    'nav.counterpick': ['Counterpick', 'Counterpick'],
    'site.loadingHeroes': ['Načítám hrdiny…', 'Loading heroes…'],
    'site.foot1': ['Neoficiální fanouškovský projekt, není spojený s Blizzard Entertainment. Obrázky hrdinů, názvy a anglické popisy schopností © Blizzard Entertainment.',
      'Unofficial fan project, not affiliated with Blizzard Entertainment. Hero images, names and ability descriptions © Blizzard Entertainment.'],
    'site.foot2': ['Data hrdinů z OverFast API. Patch notes jsou česká shrnutí oficiálních poznámek; nejnovější patche se stahují automaticky z webu Blizzardu (v angličtině). Countery jsou orientační: vychází ze schopností hrdinů, ne ze statistik zápasů.',
      'Hero data from OverFast API. Patch notes are summaries of the official notes; the newest patches are downloaded automatically from Blizzard’s website. Counters are a rough guide: they come from the heroes’ abilities, not from match statistics.'],
    'site.fileTitle': ['Tohle je zdrojový soubor webu.', 'This is the site’s source file.'],
    'site.fileText': ['Stránku otevři na její webové adrese. Prohlížeč ze souboru na disku nenačte data hrdinů.',
      'Open the page at its web address. A browser won’t load the hero data from a file on disk.'],
    'site.heroesFail': ['Data hrdinů se nepodařilo načíst. Zkus stránku obnovit.', 'The hero data couldn’t be loaded. Try reloading the page.'],

    /* ---------- site: patch notes ---------- */
    'verdict.buff': ['Buff', 'Buff'],
    'verdict.nerf': ['Nerf', 'Nerf'],
    'verdict.rework': ['Rework', 'Rework'],
    'verdict.mixed': ['Buff i nerf', 'Buff & nerf'],
    'patch.title': ['Patch notes', 'Patch notes'],
    'patch.newest': ['Nejnovější', 'Latest'],
    'patch.auto': ['Auto · EN', 'Auto'],
    'patch.autoTitle': ['Staženo automaticky z oficiálních patch notes, bez českého shrnutí', 'Downloaded automatically from the official patch notes'],
    'patch.official': ['Oficiální znění ↗', 'Official notes ↗'],
    'patch.heroChanges': ['Změny hrdinů · {n}', 'Hero changes · {n}'],
    'patch.loading': ['Načítám patch notes…', 'Loading patch notes…'],
    'patch.failTitle': ['Patch notes se teď nepodařilo načíst.', 'Patch notes couldn’t be loaded right now.'],
    'patch.failText': ['Zkus stránku obnovit, nebo se podívej na <a href="{url}" target="_blank" rel="noopener">oficiální patch notes ↗</a>.',
      'Try reloading the page, or see the <a href="{url}" target="_blank" rel="noopener">official patch notes ↗</a>.'],
    'patch.noneTitle': ['Zatím tu nejsou žádné patch notes.', 'No patch notes here yet.'],
    'patch.noneText': ['Mezitím je najdeš v <a href="{url}" target="_blank" rel="noopener">oficiálních patch notes ↗</a>.',
      'Meanwhile you’ll find them in the <a href="{url}" target="_blank" rel="noopener">official patch notes ↗</a>.'],
    'patch.older': ['Starší patche · {n}', 'Older patches · {n}'],
    'patch.checked': ['Data naposledy zkontrolována: {when}', 'Data last checked: {when}'],
    'home.allPatches': ['Všechny patche v angličtině ↗', 'All patch notes ↗'],
    'home.heroesAside': ['{n} hrdinů · značka v rohu = změna v posledních patchích', '{n} heroes · corner badge = changed in recent patches'],

    /* ---------- site: hero page ---------- */
    'hp.health': ['{n} zdraví', '{n} health'],
    'hp.armor': ['{n} zbroj', '{n} armor'],
    'hp.shields': ['{n} štíty', '{n} shields'],
    'mu.hard': ['Tvrdý counter', 'Hard counter'],
    'mu.review': ['Ke kontrole', 'Under review'],
    'mu.loading': ['Načítám countery…', 'Loading counters…'],
    'mu.fail': ['Countery se teď nepodařilo načíst. Zkus stránku obnovit.', 'Counters couldn’t be loaded right now. Try reloading the page.'],
    'hero.openPatch': ['Otevřít patch', 'Open patch'],
    'hero.review': ['Countery ke kontrole', 'Counters under review'],
    'hero.reviewSince': [' · od {date}', ' · since {date}'],
    'hero.recent': ['V posledních patchích', 'In recent patches'],
    'hero.recentHint': ['Co se s hrdinou nedávno změnilo.', 'What changed for this hero lately.'],
    'hero.perks': ['Perky', 'Perks'],
    'hero.perksHint': ['Během zápasu si vybíráš jeden minor a později jeden major perk.', 'During a match you pick one minor perk and later one major perk.'],
    'hero.minor': ['Minor perky', 'Minor perks'],
    'hero.major': ['Major perky', 'Major perks'],
    'hero.artAlt': ['{name} – artwork', '{name} – artwork'],
    'hero.backShort': ['← Hrdinové', '← Heroes'],
    'hero.back': ['← Všichni hrdinové', '← All heroes'],
    'hero.origin': ['Původ', 'Origin'],
    'hero.age': ['Věk', 'Age'],
    'hero.counters': ['Countery', 'Counters'],
    'hero.by': ['Má problém s', 'Struggles against'],
    'hero.byHint': ['Tyhle hrdiny si vyber, když soupeř hraje {name}.', 'Pick these heroes when the enemy plays {name}.'],
    'hero.byEmpty': ['Zatím tu nejsou žádné countery.', 'No counters here yet.'],
    'hero.vs': ['Silný proti', 'Strong against'],
    'hero.vsHint': ['Proti těmhle hrdinům je {name} dobrá volba.', '{name} is a good pick against these heroes.'],
    'hero.vsEmpty': ['Zatím tu nejsou žádné matchupy.', 'No matchups here yet.'],
    'hero.note': ['Orientační přehled podle schopností hrdinů. Hodně záleží na mapě, složení týmu a skillu hráče.',
      'A rough guide based on the heroes’ abilities. A lot depends on the map, the team composition and the player’s skill.'],
    'hero.abilities': ['Schopnosti', 'Abilities'],
    'hero.abilitiesHint': ['Popisy jsou v angličtině, stejně jako ve hře.', 'Descriptions as in the game.'],

    /* ---------- site: counterpick page ---------- */
    'cp.intro': ['Zadej, kdo hraje s tebou a kdo proti tobě. Poradím, koho si vybrat.', 'Enter who plays with you and against you. I’ll suggest who to pick.'],
    'cp.mode': ['Mód', 'Mode'],
    'cp.playAs': ['Hraju za', 'I play'],
    'cp.yourRole': ['Tvoje role', 'Your role'],
    'cp.reset': ['Nová hra', 'New game'],
    'cp.pickRole': ['Vyber, za jakou roli hraješ. Doporučím ti hrdinu z ní.', 'Choose the role you play. I’ll recommend a hero from it.'],
    'cp.players': [n => `${n} ${n === 1 ? 'hráč' : n < 5 ? 'hráči' : 'hráčů'}`, n => `${n} ${n === 1 ? 'player' : 'players'}`],
    'cp.team': ['Tvůj tým', 'Your team'],
    'cp.enemies': ['Nepřátelé', 'Enemies'],
    'cp.withoutYou': ['bez tebe · ', 'without you · '],
    'cp.mate': ['Spoluhráč', 'Teammate'],
    'cp.enemy': ['Nepřítel', 'Enemy'],
    'cp.hero': ['Hrdina', 'Hero'],
    'cp.remove': ['Odebrat {name}', 'Remove {name}'],
    'cp.nobody': ['Nikdo takový tu není.', 'No hero like that here.'],
    'cp.map': ['Mapa', 'Map'],
    'cp.anyMap': ['Neřešit mapu', 'Any map'],
    'cp.unrated': [' (bez hodnocení)', ' (not rated)'],
    'cp.side': ['Strana · nepovinné', 'Side · optional'],
    'cp.attackOrDefense': ['Útok nebo obrana', 'Attack or defense'],
    'cp.attack': ['Útok', 'Attack'],
    'cp.defense': ['Obrana', 'Defense'],
    'cp.attackTip': ['útok', 'attack'],
    'cp.defenseTip': ['obrana', 'defense'],
    'cp.loading': ['Načítám countery…', 'Loading counters…'],
    'cp.hint': ['Doplň aspoň jednoho nepřítele nebo spoluhráče a ukážu ti, koho si vybrat.', 'Add at least one enemy or teammate and I’ll show you who to pick.'],
    'cp.noneLeft': ['Pro tuhle roli už nezbývá žádný hrdina.', 'There is no hero left for this role.'],
    'cp.nothing': ['U zadaných hrdinů zatím nemám žádný counter ani kombo. Doplň další hrdiny.', 'I don’t know any counter or combo for these heroes yet. Add more heroes.'],
    'cp.recs': ['Doporučení', 'Recommendations'],
    'cp.compared': ['porovnáno {n} hrdinů', '{n} heroes compared'],
    'cp.score': ['Skóre', 'Score'],
    'cp.neutral': ['Žádný counter ani kombo, neutrální volba.', 'No counter or combo, a neutral pick.'],
    'cp.more': ['Další možnosti', 'Other options'],
    'cp.avoid': ['Raději ne', 'Better not'],
    'cp.mapTip': ['Tip k mapě', 'Map tip'],
    'cp.mapUnrated': ['{map} zatím nemá popsané vlastnosti, tip k ní proto není.', '{map} has no traits described yet, so there is no tip for it.'],
    'cp.tip': ['Tip: {what}', 'Tip: {what}'],
    'cp.fits': ['Hodí se', 'Good fit'],
    'cp.misfits': ['Spíš ne', 'Rather not'],
    'cp.note': ['Pořadí určují countery, známá komba a styl týmu. Mapa a strana jsou jen tip, body nepřidávají. Rozhoduje i to, na kom jsi dobrý.',
      'The order comes from counters, known combos and the team’s style. Map and side are only tips, they add no points. It also matters which heroes you are good at.'],
    'search.none': ['Žádný hrdina neodpovídá. Zkus jiný název.', 'No hero matches. Try another name.'],

    /* ---------- reasons from js/counterpick-core.js ---------- */
    'why.hardCounter': ['Tvrdý counter na {name}', 'Hard counter to {name}'],
    'why.strongVs': ['Silný proti {name}', 'Strong against {name}'],
    'why.hardCountered': ['{name} tě tvrdě counteruje', '{name} hard-counters you'],
    'why.countered': ['{name} tě counteruje', '{name} counters you'],
    'why.combo': ['Kombo s {name}', 'Combo with {name}'],
    'why.style': ['Sedí do stylu týmu: {style}', 'Fits the team’s style: {style}'],
    'why.styleOff': ['Tým hraje {style}, {name} spíš {own}', 'The team plays {style}, {name} rather {own}'],
    'why.styleWhy': ['{names} hrají {style} ({info}).', '{names} play {style} ({info}).'],
    'why.roleMissing': ['V týmu chybí {role}', 'The team has no {role}'],
    'why.roleOne': ['V týmu je jen 1× {role}', 'The team has only 1× {role}'],
    'why.roleMany': ['Tým už má {n}× {role}', 'The team already has {n}× {role}'],
    'why.map': ['Mapa: {label}', 'Map: {label}'],
    'style.dive': ['rychlé skoky na zadní linii soupeře', 'quick jumps onto the enemy backline'],
    'style.brawl': ['tlačení dopředu a boj zblízka', 'pushing forward and fighting up close'],
    'style.poke': ['střelba z dálky zpoza krytu', 'shooting from range behind cover'],

    /* ---------- patch notes scraped by js/blizzard-patches.js ---------- */
    'bp.removed': ['odstraněno', 'removed'],
    'bp.new': ['novinka', 'new'],
    'bp.minorPerk': [' (malý perk)', ' (minor perk)'],
    'bp.majorPerk': [' (velký perk)', ' (major perk)'],
    'bp.general': ['Obecné', 'General'],
    'bp.core': ['Systém', 'Core game'],
    'bp.competitive': ['Ranked', 'Competitive'],
    'bp.stadium': ['Stadium', 'Stadium'],
    'bp.heroes': ['Hrdinové', 'Heroes'],
    'bp.map': ['Mapa', 'Map'],
    'bp.fixes': ['Opravy', 'Fixes'],
    'bp.season': ['Sezóna', 'Season'],
    'bp.seasonN': ['Sezóna {n}', 'Season {n}'],
    'bp.hitboxes': ['Hitboxy', 'Hitboxes'],
    'bp.generalChanges': ['Obecné změny', 'General changes'],
    'bp.itemChanges': ['Změny itemů', 'Item changes'],
    'bp.fixesTitle': ['Opravy chyb', 'Bug fixes'],
    'bp.fixesText': ['{n} opravených chyb, celý seznam je v oficiálním znění.', '{n} bugs fixed, the full list is in the official notes.'],
    'bp.hitboxText': ['Upravené zásahové zóny u {n} hrdinů.', 'Adjusted hit volumes for {n} heroes.'],
    'bp.mixed': ['smíšené', 'mixed'],
    'bp.summary': ['Automaticky staženo z oficiálních patch notes, popisy změn jsou v angličtině.', 'Downloaded automatically from the official patch notes.'],
    'bp.summaryHeroes': [p => ` Změny u ${p.n} ${p.n === 1 ? 'hrdiny' : 'hrdinů'} (${p.tally}).`, p => ` Changes for ${p.n} ${p.n === 1 ? 'hero' : 'heroes'} (${p.tally}).`],
    'bp.update': ['Aktualizace hry', 'Game update'],

    /* ---------- overlay (overlay/js/ingame.js) ---------- */
    'ov.title': ['Counterpick · overlay', 'Counterpick · overlay'],
    'ov.loading': ['Načítám data…', 'Loading data…'],
    'ov.calib': ['Nastavení skenu (zkratky, kalibrace)', 'Scan settings (hotkeys, calibration)'],
    'ov.hide': ['Skrýt', 'Hide'],
    'ov.close': ['Zavřít', 'Close'],
    'ov.confirm': ['✓ Sedí, uložit', '✓ All correct, save'],
    'ov.readFail': ['Sken se nepodařilo přečíst: {msg}', 'The scan couldn’t be read: {msg}'],
    'ov.shotFail': [p => `Screenshot se nepovedl${p.msg ? ': ' + p.msg : ''}.`, p => `The screenshot failed${p.msg ? ': ' + p.msg : ''}.`],
    'ov.dataFail': ['Data se nepodařilo načíst: {msg}', 'The data couldn’t be loaded: {msg}'],
    'ov.nobody': ['Nikdo', 'Nobody'],
    'ov.fill': ['Doplnit', 'Add'],
    'ov.you': ['Ty', 'You'],
    'ov.game': ['Hra', 'Game'],
    'ov.gameTitle': ['Podle dat ze hry', 'From the game’s data'],
    'ov.fix': ['Klikni pro opravu', 'Click to correct'],
    'ov.map': ['Mapa', 'Map'],
    'ov.anyMap': ['Mapa: neřešit', 'Map: any'],
    'ov.pickRole': ['Vyber, za jakou roli hraješ (nebo klikni na sebe ve svém týmu a zvol „Tohle jsem já“).',
      'Choose the role you play (or click yourself in your team and choose “This is me”).'],
    'ov.emptyApp': ['Ve hře podrž <kbd>Tab</kbd> a zmáčkni <kbd>{key}</kbd>. Hrdiny můžeš doplnit i ručně kliknutím na slot.',
      'In the game, hold <kbd>Tab</kbd> and press <kbd>{key}</kbd>. You can also fill in heroes by clicking a slot.'],
    'ov.emptyBrowser': ['Vlož screenshot scoreboardu, nebo doplň hrdiny kliknutím na sloty.', 'Paste a screenshot of the scoreboard, or fill in heroes by clicking the slots.'],
    'ov.nothing': ['U zadaných hrdinů zatím nemám žádný counter ani kombo.', 'I don’t know any counter or combo for these heroes yet.'],
    'ov.compared': ['porovnáno {n}', '{n} compared'],
    'ov.ownPick': ['Tvůj hrdina', 'Your hero'],
    'ov.ownRank': ['{pos}. z {n}', '#{pos} of {n}'],
    'ov.ownBest': ['Nejlepší volba, není co měnit.', 'The best pick, nothing to change.'],
    'ov.ownBehind': ['{name} je o {n} lepší.', '{name} scores {n} more.'],
    'ov.ownOtherRole': ['Není z role, kterou máš zvolenou.', 'Not from the role you chose.'],
    'ov.ready': ['Připraveno', 'Ready'],
    'ov.scanned': ['Sken {time} · jistě {sure}/{all}', 'Scan {time} · sure {sure}/{all}'],
    'ov.noBoard': ['Scoreboard nevidím: drž Tab, nebo uprav kalibraci (⚙)', 'I can’t see the scoreboard: hold Tab, or adjust the calibration (⚙)'],
    'ov.saved': [n => `Uloženo ${n} ${n === 1 ? 'vzorek' : n < 5 ? 'vzorky' : 'vzorků'}, příště to poznám líp`,
      n => `Saved ${n} ${n === 1 ? 'sample' : 'samples'}, I’ll recognize it better next time`],
    'ov.whoAmI': ['Nevím, který z tvého týmu jsi ty. Klikni na sebe a zvol „Tohle jsem já“, ať tě nepočítám jako spoluhráče.',
      'I don’t know which one in your team is you. Click yourself and choose “This is me”, so I don’t count you as a teammate.'],
    'ov.test': ['Testovací režim mimo hru: vlož screenshot scoreboardu (<kbd>Ctrl+V</kbd>), přetáhni ho sem, nebo <label>vyber soubor<input type="file" accept="image/*" data-shot></label>.',
      'Test mode outside the game: paste a screenshot of the scoreboard (<kbd>Ctrl+V</kbd>), drop it here, or <label>choose a file<input type="file" accept="image/*" data-shot></label>.'],
    'ov.noColors': ['Na screenshotu nevidím barvy scoreboardu. Při <kbd>{key}</kbd> drž <kbd>Tab</kbd>. Pokud byl scoreboard vidět, sedni si rámečky v kalibraci (⚙).',
      'I can’t see the scoreboard’s colors on the screenshot. Hold <kbd>Tab</kbd> while you press <kbd>{key}</kbd>. If the scoreboard was on screen, line up the boxes in the calibration (⚙).'],
    'ov.fromGame': ['· podle dat ze hry', '· from the game’s data'],
    'ov.unsure': ['· ? = nejisté, klikni a oprav', '· ? = unsure, click to correct'],
    'ov.all': ['Všichni', 'All'],
    'ov.crop': ['Výřez ze screenshotu', 'Cut from the screenshot'],
    'ov.slot': ['{who} {n}', '{who} {n}'],
    'ov.now': ['Teď: {name}', 'Now: {name}'],
    'ov.empty': ['Zatím prázdné', 'Empty so far'],
    'ov.cropHint': [' · vlevo výřez ze screenshotu', ' · on the left, the cut from the screenshot'],
    'ov.altsHint': [' · oranžově tipy', ' · guesses in orange'],
    'ov.search': ['Hledat hrdinu…', 'Search heroes…'],
    'ov.me': ['Tohle jsem já', 'This is me'],
    'ov.notMe': ['Nejsem to já', 'That’s not me'],
    'ov.clear': ['Nikdo / smazat', 'Nobody / clear'],
    'ov.keys': [p => `<kbd>${p.scan}</kbd> sken (drž Tab) · <kbd>${p.toggle}</kbd> ${p.desktop ? 'myš do overlaye / skrýt' : 'skrýt'} · klik na hrdinu = oprava`,
      p => `<kbd>${p.scan}</kbd> scan (hold Tab) · <kbd>${p.toggle}</kbd> ${p.desktop ? 'mouse into the overlay / hide' : 'hide'} · click a hero = correct`],

    /* ---------- scan settings and calibration (overlay/js/calibrate.js) ---------- */
    'cal.title': ['Counterpick · nastavení skenu', 'Counterpick · scan settings'],
    'cal.head': ['Nastavení <span>skenu</span>', 'Scan <span>settings</span>'],
    'cal.keys': ['Klávesové zkratky', 'Hotkeys'],
    'cal.keyScan': ['Sken scoreboardu', 'Scan the scoreboard'],
    'cal.keyToggle': ['Overlay: ukázat / skrýt', 'Overlay: show / hide'],
    'cal.keyPress': ['Stiskni zkratku…', 'Press a hotkey…'],
    'cal.keysHint': ['Klikni na zkratku a stiskni novou, třeba Ctrl+Shift+C nebo F8. Esc změnu zruší.',
      'Click a hotkey and press a new one, e.g. Ctrl+Shift+C or F8. Esc cancels.'],
    'cal.keyNeedMod': ['Přidej Ctrl, Alt nebo Shift, samotná klávesa by psala i do chatu. Bez nich jde jen F1–F24.',
      'Add Ctrl, Alt or Shift, a key on its own would also type in the chat. Only F1–F24 work alone.'],
    'cal.keySaved': ['Uloženo, zkratky platí hned.', 'Saved, the hotkeys work right away.'],
    'cal.keyTaken': ['Tuhle zkratku nejde použít, nejspíš ji má jiná aplikace. Zkus jinou.', 'This hotkey can’t be used, another app probably has it. Try another one.'],
    'cal.keySame': ['Sken a overlay nemůžou mít stejnou zkratku.', 'Scan and overlay can’t share one hotkey.'],
    'cal.keyOverwolf': ['Overwolf zkratku nezměnil. Nastav ji v Overwolfu: Nastavení → Klávesové zkratky.',
      'Overwolf didn’t change the hotkey. Set it in Overwolf: Settings → Hotkeys.'],
    'cal.keysDefault': ['Výchozí zkratky', 'Default hotkeys'],
    'cal.calib': ['Kalibrace scoreboardu', 'Scoreboard calibration'],
    'cal.loading': ['Načítám…', 'Loading…'],
    'cal.canvas': ['Screenshot s rámečky portrétů. Táhni rámečky myší, šipky je posouvají po pixelu.',
      'Screenshot with the portrait boxes. Drag the boxes with the mouse, the arrow keys move them by one pixel.'],
    'cal.found': ['Scoreboard nalezen automaticky.', 'Scoreboard found automatically.'],
    'cal.notFound': ['Scoreboard se automaticky najít nepodařilo: posuň rámečky na portréty ručně, nebo naskenuj znovu s Tab.',
      'The scoreboard couldn’t be found automatically: move the boxes onto the portraits by hand, or scan again with Tab held.'],
    'cal.noColors': ['Řádky nemají barvy scoreboardu: posuň rámečky na portréty, nebo naskenuj znovu s Tab.',
      'The rows don’t have the scoreboard’s colors: move the boxes onto the portraits, or scan again with Tab held.'],
    'cal.manual': ['Ruční rozložení, změny se ukládají hned.', 'Hand-placed layout, changes save at once.'],
    'cal.emptyRow': ['prázdné', 'empty'],
    'cal.step1App': ['Ve hře podrž <b>Tab</b> a zmáčkni <b>{key}</b>. Screenshot se tu objeví sám.',
      'In the game, hold <b>Tab</b> and press <b>{key}</b>. The screenshot shows up here by itself.'],
    'cal.step1Browser': ['Vlož screenshot scoreboardu (<kbd>Ctrl+V</kbd>), přetáhni ho sem, nebo <label class="test" style="padding:0;border:0;background:none"><u>vyber soubor</u><input type="file" accept="image/*" data-shot hidden></label>.',
      'Paste a screenshot of the scoreboard (<kbd>Ctrl+V</kbd>), drop it here, or <label class="test" style="padding:0;border:0;background:none"><u>choose a file</u><input type="file" accept="image/*" data-shot hidden></label>.'],
    'cal.step2': ['Scoreboard se na screenshotu hledá sám, rámečky ukazují, kde ho našel. Když sedí na portrétech, nic dalšího není potřeba.',
      'The scoreboard is found on the screenshot automatically, the boxes show where. If they sit on the portraits, nothing else is needed.'],
    'cal.step3': ['Když nesedí, táhni <b style="color:var(--blue)">modré</b> rámečky na portréty spoluhráčů a <b style="color:var(--bad)">červené</b> na portréty nepřátel (šipky posouvají po pixelu, se Shiftem po pěti) a posuvníky dolaď velikost a rozestup. Tím přepneš na ruční rozložení.',
      'If they don’t, drag the <b style="color:var(--blue)">blue</b> boxes onto your teammates’ portraits and the <b style="color:var(--bad)">red</b> ones onto the enemies’ (arrow keys move by one pixel, with Shift by five) and fine-tune size and spacing with the sliders. This switches to the hand-placed layout.'],
    'cal.find': ['Hledání scoreboardu', 'Finding the scoreboard'],
    'cal.auto': ['Automaticky', 'Automatic'],
    'cal.byHand': ['Ručně', 'By hand'],
    'cal.rows': ['Hráčů v týmu', 'Players per team'],
    'cal.size': ['Velikost portrétu', 'Portrait size'],
    'cal.pitch': ['Rozestup řádků', 'Row spacing'],
    'cal.whole': ['Celá obrazovka', 'Whole screen'],
    'cal.zoom': ['Přiblížit scoreboard', 'Zoom to the scoreboard'],
    'cal.reset': ['Výchozí rozložení', 'Default layout'],
    'cal.seen': ['Co rámečky vidí', 'What the boxes see'],
    'cal.fixInOverlay': ['Opravy hrdinů dělej v overlayi (klik na hrdinu). Každá oprava se uloží jako vzorek.',
      'Correct heroes in the overlay (click a hero). Every correction is saved as a sample.'],
    'cal.samples': ['Naučené vzorky', 'Learned samples'],
    'cal.stats': ['Poznám {heroes} z {total} hrdinů · tvých vzorků {own}, ze sdíleného balíčku {pack}.',
      'I recognize {heroes} of {total} heroes · your samples {own}, from the shared pack {pack}.'],
    'cal.export': ['Kopírovat vzorky', 'Copy samples'],
    'cal.wipe': ['Smazat moje vzorky', 'Delete my samples'],
    'cal.wipeSure': ['Opravdu smazat?', 'Really delete?'],
    'cal.share': ['Zkopírované vzorky vlož do <code>data/scoreboard-refs.json</code> v repozitáři a po nahrání na GitHub je dostanou všichni hráči.',
      'Paste the copied samples into <code>data/scoreboard-refs.json</code> in the repository; once it is on GitHub, every player gets them.'],
    'cal.copied': ['Vzorky jsou ve schránce: vlož je do data/scoreboard-refs.json.', 'The samples are on the clipboard: paste them into data/scoreboard-refs.json.'],
    'cal.downloaded': ['Vzorky jsou uložené jako scoreboard-refs.json: nahraď jím data/scoreboard-refs.json.',
      'The samples are saved as scoreboard-refs.json: replace data/scoreboard-refs.json with it.'],
    'cal.wiped': ['Tvoje vzorky jsou smazané.', 'Your samples are deleted.'],
    'cal.noShotApp': ['Zatím žádný screenshot. Ve hře podrž <kbd>Tab</kbd> a zmáčkni <kbd>{key}</kbd>.', 'No screenshot yet. In the game, hold <kbd>Tab</kbd> and press <kbd>{key}</kbd>.'],
    'cal.noShotBrowser': ['Vlož screenshot scoreboardu (<kbd>Ctrl+V</kbd>) nebo ho sem přetáhni.', 'Paste a screenshot of the scoreboard (<kbd>Ctrl+V</kbd>) or drop it here.'],

    /* ---------- Overwolf title bar (overwolf/js/shell.js) ---------- */
    'ow.hint': ['Ve hře podrž <b>Tab</b> a zmáčkni <b>Alt+C</b> · <b>Alt+X</b> skryje overlay', 'In the game, hold <b>Tab</b> and press <b>Alt+C</b> · <b>Alt+X</b> hides the overlay'],
    'ow.calib': ['Nastavení skenu', 'Scan settings'],
    'ow.min': ['Minimalizovat', 'Minimize'],
    'ow.max': ['Maximalizovat', 'Maximize'],

    /* ---------- desktop app (desktop/main.js) ---------- */
    'app.open': ['Otevřít Counterpick Atlas', 'Open Counterpick Atlas'],
    'app.toggle': ['Ukázat nebo skrýt overlay', 'Show or hide the overlay'],
    'app.quit': ['Ukončit', 'Quit'],
    'app.tooltip': ['Counterpick Atlas · {key} ve hře naskenuje scoreboard', 'Counterpick Atlas · {key} in the game scans the scoreboard'],
    'app.trayTitle': ['Counterpick Atlas běží dál', 'Counterpick Atlas keeps running'],
    'app.trayText': ['Zkratky ve hře fungují dál ({key}). Aplikaci ukončíš přes tuhle ikonu.', 'The in-game hotkeys keep working ({key}). Quit the app from this icon.'],
    'app.keysTaken': ['Zkratku {keys} nejde použít, nejspíš ji má jiná aplikace.', 'The hotkey {keys} can’t be used, another app probably has it.'],
    'app.keysAnd': [' a ', ' and '],
    'app.keysHow': ['Nastav jinou v nastavení skenu: ⚙ v overlayi, nebo Nastavení skenu v menu ikony v oznamovací oblasti.',
      'Set another one in the scan settings: ⚙ in the overlay, or Scan settings in the notification area icon’s menu.'],
    'app.captureFail': ['obrazovku se nepodařilo vyfotit', 'the screen couldn’t be captured'],
  };

  // Czech for Czech and Slovak systems, English for everything else.
  const systemLang = locale => /^(cs|sk)([-_]|$)/i.test(String(locale || '')) ? 'cs' : 'en';

  function translate(lang, key, params) {
    const pair = TEXTS[key];
    if (!pair) return key;
    const v = pair[Math.max(0, LANGS.indexOf(lang))] ?? pair[0];
    if (typeof v === 'function') return v(params === undefined ? {} : params);
    return params && typeof params === 'object' ? v.replace(/\{(\w+)\}/g, (m, k) => k in params ? params[k] : m) : v;
  }

  if (typeof window === 'undefined') { module.exports = { LANGS, TEXTS, systemLang, translate }; return; }

  /* ---------- pages ---------- */
  const valid = l => LANGS.includes(l) ? l : null;
  const stored = () => { try { return valid(localStorage.getItem(STORE)); } catch (e) { return null; } };
  const store = l => { try { localStorage.setItem(STORE, l); } catch (e) { /* storage blocked */ } };
  const desk = window.cpaDesktop || null;   // the desktop app (desktop/preload.js)
  const listeners = [];

  // In the desktop app its own record of the choice wins (the tray menu shows it); the pages' copy follows it.
  let lang = (desk && valid(desk.lang)) || stored() || systemLang((desk && desk.systemLang) || navigator.language);
  if (desk && valid(desk.lang) && stored() !== lang) store(lang);
  else if (desk && !valid(desk.lang) && stored() && desk.setLang) desk.setLang(lang);

  const t = (key, params) => translate(lang, key, params);
  // A data field in the chosen language: obj.field_en in English where it is filled in, else obj.field.
  const pick = (obj, field) => {
    if (!obj) return undefined;
    const en = lang === 'en' && obj[field + '_en'];
    return typeof en === 'string' && en.trim() ? en : obj[field];
  };

  // Static texts: data-i18n="key" sets the element's content, data-i18n-attr="placeholder:key; aria-label:key" attributes.
  function apply(root) {
    const el = root || document;
    el.querySelectorAll('[data-i18n]').forEach(e => { e.innerHTML = t(e.dataset.i18n); });
    el.querySelectorAll('[data-i18n-attr]').forEach(e => {
      for (const part of e.dataset.i18nAttr.split(';')) {
        const [attr, key] = part.split(':').map(s => s.trim());
        if (attr && key) e.setAttribute(attr, t(key));
      }
    });
  }

  function change(l) {
    if (l === lang) return;
    lang = l;
    document.documentElement.lang = l;
    apply();
    for (const cb of listeners) cb(l);
  }

  // The player's choice: remembered, sent to the other pages (storage event) and to the desktop app's tray menu.
  function set(l, fromApp) {
    if (!valid(l)) return;
    store(l);
    if (desk && desk.setLang && !fromApp) desk.setLang(l);
    change(l);
  }

  window.addEventListener('storage', e => { if (e.key === STORE && valid(e.newValue)) change(e.newValue); });
  if (desk && desk.onLang) desk.onLang(l => set(l, true));   // chosen in the tray menu

  /* ---------- formats ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const num = (v, digits = 1) => v.toLocaleString(lang === 'en' ? 'en-US' : 'cs-CZ', { maximumFractionDigits: digits });
  // "2026-10-13" -> "13. 10. 2026" / "Oct 13, 2026"
  const date = iso => {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return lang === 'en' ? `${MONTHS[m - 1]} ${d}, ${y}` : `${d}. ${m}. ${y}`;
  };
  // A moment with its time: "24. 10. 2026 v 10:56" / "Oct 24, 2026, 10:56"
  const stamp = iso => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return lang === 'en' ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${time}` : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} v ${time}`;
  };

  document.documentElement.lang = lang;
  apply();

  window.I18n = {
    LANGS, t, pick, set, apply, num, date, stamp,
    get lang() { return lang; },
    onChange: cb => { listeners.push(cb); },
  };
})();
