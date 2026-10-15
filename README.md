# Counterpick Atlas

Neoficiální český fanouškovský průvodce ke hře Overwatch: patch notes, countery, schopnosti a perky všech hrdinů.

- `index.html` – celá stránka
- `data/patches.json` – česká shrnutí patch notes (nejnovější nahoře)
- `js/blizzard-patches.js` – jQuery scraper oficiálních patch notes; patche novější než poslední české shrnutí se načtou při návštěvě a drží se 12 h v cache prohlížeče
- `data/blizzard-patch-notes.html` – kopie oficiálních patch notes, kterou každých 12 h obnovuje GitHub Action (`.github/workflows/patch-notes.yml`, `scripts/mirror_patch_notes.py`)
- `data/matchups.json` – countery: u každého hrdiny seznam hrdinů, proti kterým je silný, s krátkým důvodem
- `data/heroes.json`, `data/icons.json` – hrdinové, schopnosti a perky (z OverFast API)
- `data/status.json` – kdy byla data naposledy zkontrolována a kdy se naposledy změnily patch notes
- `art/`, `p/` – artworky a portréty hrdinů

Countery jsou orientační odhady podle schopností, ne statistiky zápasů.

Není spojeno s Blizzard Entertainment. Obrázky hrdinů, názvy a popisy schopností © Blizzard Entertainment.

## Automatické patch notes

Prohlížeč nesmí stáhnout stránku Blizzardu napřímo (chybí CORS), proto ji každých 12 hodin zkopíruje GitHub Action do `data/blizzard-patch-notes.html` a commitne jen tehdy, když se něco změnilo. Web si kopii při návštěvě rozparsuje přes jQuery a podrží v cache prohlížeče 12 hodin. Když Action přinese novou verzi, cache se zahodí hned.

Na webu se automaticky ukazují jen patche novější než poslední české shrnutí v `data/patches.json` (se štítkem „Auto · EN“). Jakmile české shrnutí dopíšeš, automatické anglické verze do jeho data včetně zmizí. Ručně jde Action spustit v záložce Actions → Patch notes → Run workflow.
