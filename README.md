# Counterpick Atlas

Neoficiální český fanouškovský průvodce ke hře Overwatch: patch notes, countery, schopnosti a perky všech hrdinů.

- `index.html` – celá stránka
- `data/patches.json` – česká shrnutí patch notes (nejnovější nahoře)
- `js/blizzard-patches.js` – jQuery scraper oficiálních patch notes; patche novější než poslední české shrnutí se načtou při návštěvě a drží se 12 h v cache prohlížeče
- `data/blizzard-patch-notes.html` – kopie oficiálních patch notes, kterou každých 12 h obnovuje GitHub Action (`.github/workflows/patch-notes.yml`, `scripts/mirror_patch_notes.py`)
- `data/matchups.json` – countery: u každého hrdiny seznam hrdinů, proti kterým je silný, s krátkým důvodem
- `data/synergies.json` – pro stránku Counterpick: herní styl každého hrdiny (dive / brawl / poke) a známá komba dvojic s důvodem
- `data/maps.json` – pro stránku Counterpick: soutěžní mapy (seznam doplňuje Action z OverFast API, `scripts/update_maps.py`), jejich vlastnosti (dlouhé výhledy, úzké prostory, výšky, flanky, srázy), co která vlastnost a strana (útok / obrana) zvýhodňuje, a štítky hrdinů (sniper, létá, odhazuje, engage, drží pozici). Nová mapa přibude bez vlastností a nic nepřidává, dokud jí je někdo nepřipíše.
- `data/heroes.json`, `data/icons.json` – hrdinové, schopnosti a perky (z OverFast API)
- `data/status.json` – kdy byla data naposledy zkontrolována a kdy se naposledy změnily patch notes
- `art/`, `p/` – artworky a portréty hrdinů

Countery jsou orientační odhady podle schopností, ne statistiky zápasů.

Stránka **Counterpick** (`#counterpick`) doporučí hrdinu podle toho, koho zadáš do svého a nepřátelského týmu. Za každého nepřítele, kterého kandidát counteruje, dostane body (tvrdý counter víc), za každého, kdo counteruje jeho, body ztratí. Body přidá i kombo se spoluhráčem a styl, který sedí ke zbytku týmu; v 6v6 navíc chybějící role. Mapa a nepovinná volba útok / obrana (jen na mapách Escort a Hybrid, nebo když mapa není vybraná) body nepřidávají, jsou jen tip: stránka ukáže, kteří hrdinové z tvé role se na mapu a stranu hodí (na útoku dive a rychlý engage, na obraně poke a hrdinové, kteří drží průchod), a u doporučených hrdinů je označí ✓.

Není spojeno s Blizzard Entertainment. Obrázky hrdinů, názvy a popisy schopností © Blizzard Entertainment.

## Automatické patch notes

Prohlížeč nesmí stáhnout stránku Blizzardu napřímo (chybí CORS), proto ji každých 12 hodin zkopíruje GitHub Action do `data/blizzard-patch-notes.html` a commitne jen tehdy, když se něco změnilo. Web si kopii při návštěvě rozparsuje přes jQuery a podrží v cache prohlížeče 12 hodin. Když Action přinese novou verzi, cache se zahodí hned.

Na webu se automaticky ukazují jen patche novější než poslední české shrnutí v `data/patches.json` (se štítkem „Auto · EN“). Jakmile české shrnutí dopíšeš, automatické anglické verze do jeho data včetně zmizí. Ručně jde Action spustit v záložce Actions → Patch notes → Run workflow.
