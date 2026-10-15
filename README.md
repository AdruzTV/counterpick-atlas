# Counterpick Atlas

Neoficiální český fanouškovský průvodce ke hře Overwatch: patch notes, countery, schopnosti a perky všech hrdinů.

- `index.html` – celá stránka
- `data/patches.json` – česká shrnutí patch notes (nejnovější nahoře)
- `js/blizzard-patches.js` – jQuery scraper oficiálních patch notes; patche novější než poslední české shrnutí se stáhnou při návštěvě a drží se 12 h v cache prohlížeče
- `proxy/worker.js` – Cloudflare Worker, přes který se patch notes stahují (Blizzard nepovoluje CORS)
- `data/matchups.json` – countery: u každého hrdiny seznam hrdinů, proti kterým je silný, s krátkým důvodem
- `data/heroes.json`, `data/icons.json` – hrdinové, schopnosti a perky (z OverFast API)
- `data/status.json` – kdy byla data naposledy zkontrolována
- `art/`, `p/` – artworky a portréty hrdinů

Countery jsou orientační odhady podle schopností, ne statistiky zápasů.

Není spojeno s Blizzard Entertainment. Obrázky hrdinů, názvy a popisy schopností © Blizzard Entertainment.

## Automatické patch notes

Prohlížeč nesmí stáhnout stránku Blizzardu napřímo (chybí CORS), proto jde request přes vlastní Cloudflare Worker. Free plán (100 000 requestů denně) bohatě stačí a nechce kartu.

1. Na [dash.cloudflare.com](https://dash.cloudflare.com) otevři **Workers & Pages → Create → Create Worker**, pojmenuj ho třeba `counterpick-proxy` a dej **Deploy**.
2. **Edit code**, obsah nahraď souborem `proxy/worker.js` a znovu **Deploy**.
3. Adresu Workeru (např. `https://counterpick-proxy.tvuj-ucet.workers.dev`) vlož do `js/blizzard-patches.js`:
   `const PROXY = 'https://counterpick-proxy.tvuj-ucet.workers.dev/?url=';`

Dokud je `PROXY` prázdné, web ukazuje jen česká shrnutí z `data/patches.json`. Jakmile do `data/patches.json` dopíšeš české shrnutí, automatické anglické verze do jeho data včetně zmizí.
