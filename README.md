# Counterpick Atlas

**Čeština** · [English](README.en.md)

Neoficiální český fanouškovský průvodce ke hře Overwatch: patch notes, countery, schopnosti a perky všech hrdinů.

- `index.html` – celá stránka
- `js/i18n.js` – texty rozhraní česky a anglicky (web, overlay, kalibrace, Overwolf lišta i menu aplikace pro Windows)
- `js/counterpick-core.js` – výpočet doporučení pro stránku Counterpick (countery, komba, styl týmu, tipy k mapě); sdílí ho web i overlay ve hře, takže doporučují stejně
- `data/patches.json` – česká shrnutí patch notes (nejnovější nahoře)
- `js/blizzard-patches.js` – jQuery scraper oficiálních patch notes; patche novější než poslední české shrnutí se načtou při návštěvě a drží se 12 h v cache prohlížeče
- `data/blizzard-patch-notes.html` – kopie oficiálních patch notes, kterou každých 12 h obnovuje GitHub Action (`.github/workflows/patch-notes.yml`, `scripts/mirror_patch_notes.py`)
- `data/matchups.json` – countery: u každého hrdiny seznam hrdinů, proti kterým je silný, s krátkým důvodem
- `data/synergies.json` – pro stránku Counterpick: herní styl každého hrdiny (dive / brawl / poke) a známá komba dvojic s důvodem
- `data/maps.json` – pro stránku Counterpick: soutěžní mapy (seznam doplňuje Action z OverFast API, `scripts/update_maps.py`), jejich vlastnosti (dlouhé výhledy, úzké prostory, výšky, flanky, srázy), co která vlastnost a strana (útok / obrana) zvýhodňuje, a štítky hrdinů (sniper, létá, odhazuje, engage, drží pozici). Nová mapa přibude bez vlastností a nic nepřidává, dokud jí je někdo nepřipíše.
- `data/heroes.json`, `data/icons.json` – hrdinové, schopnosti a perky (z OverFast API, nové hrdiny doplňuje Action, `scripts/update_heroes.py`)
- `data/status.json` – kdy byla data naposledy zkontrolována, kdy se naposledy změnily patch notes a počet hrdinů
- `art/`, `p/` – artworky a portréty hrdinů (u nového hrdiny je stáhne stejná Action)
- `overlay/`, `js/scoreboard.js`, `data/scoreboard-refs.json` – overlay do hry: rozpoznání hrdinů ze screenshotu scoreboardu a doporučení (viz níže)
- `desktop/` – aplikace pro Windows s overlayem; `manifest.json`, `overwolf/` – totéž jako Overwolf aplikace

Countery jsou orientační odhady podle schopností, ne statistiky zápasů.

Stránka **Counterpick** (`#counterpick`) doporučí hrdinu podle toho, koho zadáš do svého a nepřátelského týmu. Za každého nepřítele, kterého kandidát counteruje, dostane body (tvrdý counter víc), za každého, kdo counteruje jeho, body ztratí. Body přidá i kombo se spoluhráčem a styl, který sedí ke zbytku týmu; v 6v6 navíc chybějící role. Mapa a nepovinná volba útok / obrana (jen na mapách Escort a Hybrid, nebo když mapa není vybraná) body nepřidávají, jsou jen tip: stránka ukáže, kteří hrdinové z tvé role se na mapu a stranu hodí (na útoku dive a rychlý engage, na obraně poke a hrdinové, kteří drží průchod), a u doporučených hrdinů je označí ✓.

Není spojeno s Blizzard Entertainment. Obrázky hrdinů, názvy a popisy schopností © Blizzard Entertainment.

## Jazyk

Web, overlay i aplikace jsou česky a anglicky. Přepíná se tlačítky **CZ / EN** v liště webu; volba se pamatuje v prohlížeči (`localStorage`) a overlay s kalibrací se na stejném webu nebo v aplikaci přepnou hned s ním. Dokud nikdo nevybral, rozhoduje jazyk systému: čeština pro češtinu a slovenštinu, jinak angličtina. Texty rozhraní jsou v `js/i18n.js`, u každého česká a anglická verze vedle sebe; když anglická chybí, ukáže se česká. Doporučení na stránce Counterpick vychází v obou jazycích stejně, jazyk mění jen slova.

Anglické texty dat jsou ve stejných souborech hned za českými, v poli s příponou `_en`: důvody counterů a komb `r_en` (`data/matchups.json`, `data/synergies.json`), poznámka `review.reason_en`, vlastnosti map a strany `label_en`, `desc_en`, `badDesc_en` (`data/maps.json`) a u českých shrnutí patchů `title_en`, `summary_en`, `kind_en`, u zajímavostí `tag_en`, `title_en`, `text_en` a u změn `a_en`, `t_en` (`data/patches.json`; čísla jako „6,5“ nebo „35 %“ se v angličtině převedou samy). Kde `_en` chybí, ukáže se čeština, takže nový counter nebo patch jde napsat nejdřív jen česky. GitHub Actions tato pole nechávají beze změny. Automaticky stažené patch notes jsou v angličtině rovnou.

## Automatické patch notes

Prohlížeč nesmí stáhnout stránku Blizzardu napřímo (chybí CORS), proto ji každých 12 hodin zkopíruje GitHub Action do `data/blizzard-patch-notes.html` a commitne jen tehdy, když se něco změnilo. Web si kopii při návštěvě rozparsuje přes jQuery a podrží v cache prohlížeče 12 hodin. Když Action přinese novou verzi, cache se zahodí hned.

Na webu se automaticky ukazují jen patche novější než poslední české shrnutí v `data/patches.json` (se štítkem „Auto · EN“). Jakmile české shrnutí dopíšeš, automatické anglické verze do jeho data včetně zmizí. Ručně jde Action spustit v záložce Actions → Patch notes → Run workflow.

### Noví hrdinové

Stejná Action porovná seznam hrdinů v OverFast API s `data/heroes.json` (`scripts/update_heroes.py`). Chybějícího hrdinu přidá se vším, co mají ostatní: role, popis, životy, schopnosti, perky a příznak Stadium. Ikony schopností a perků uloží do `data/icons.json`, portrét do `p/` (podle něj ho pozná overlay) a artwork do `art/`. Web i aplikace si je stáhnou z GitHub Pages, takže nového hrdinu poznají bez nové verze. V `data/status.json` se zvedne `heroCount`.

- Stávající hrdiny Action nemění ani nemaže. Když patch změní životy nebo schopnosti, je potřeba je přepsat ručně.
- Countery a styl (`data/matchups.json`, `data/synergies.json`) nový hrdina nedostane, ty se dopisují ručně.
- Když OverFast nebo stahování obrázků selže, Action jen vypíše varování, zbytek doběhne a hrdina se zkusí přidat znovu za 12 hodin.
- **Test**: Actions → Patch notes → Run workflow, do pole *test_hero* napiš klíč existujícího hrdiny (třeba `ana`). Action ho přidá znovu do kopie dat mimo repozitář, v logu kroku *Test adding a hero* ukáže nový záznam a jeho rozdíly proti stávajícímu, a kopii dat i obrázků dá do Artifacts. Do repozitáře z testu nic nejde. Lokálně (s Pythonem a Pillow) totéž bez zápisu: `python scripts/update_heroes.py --dry-run --readd ana`.

## Overlay do hry

Ve hře umí Counterpick Atlas ze screenshotu scoreboardu poradit, koho hrát. Běží ve dvou aplikacích, které ukazují stejné stránky (`overlay/`): **aplikace pro Windows** (`desktop/`, funguje hned) a **Overwolf aplikace** (`manifest.json`, `overwolf/`, čeká na schválení od Overwolfu). Mimo hru ukážou obě stejný web jako GitHub Pages.

**Ve hře**
- Podrž **Tab** (scoreboard) a zmáčkni **Alt+C**. Aplikace vyfotí obrazovku, pozná hrdiny v obou týmech a ukáže doporučení. Počítá je stejně jako stránka Counterpick, `js/counterpick-core.js` je společný.
- Hrdina s „?“ je tip, který si aplikace není jistá. Klikni na něj a vyber správného. Oprava se uloží jako vzorek a příště ho aplikace pozná. Když sedí všechno, uloží celý sken tlačítko **Sedí, uložit**.
- U tvého řádku je štítek „Ty“ (aplikace ho pozná podle zvýrazněného, světlejšího řádku). Do týmu se nepočítáš a podle tvého hrdiny se nastaví role. Když tě aplikace nepozná, klikni na sebe a zvol „Tohle jsem já“.
- Když už máš hrdinu vybraného, ukáže overlay nad doporučením kartu **Tvůj hrdina**: jeho body, pořadí mezi kandidáty a o kolik je lepší volba číslo 1. Body se počítají stejně jako u doporučení. Bez vybraného hrdiny se karta neukáže.

**Jak pozná hrdiny** (`js/scoreboard.js`)
- Scoreboard na screenshotu najde sám: řádky spoluhráčů tvoří jeden blok v barvě týmu, nepřátel druhý pod ním. Na konkrétní barvě nezáleží, funguje i s barevnými filtry (třeba tyrkysová a fialová). Podle ikon rolí pozná, jestli má tým 5 nebo 6 řádků, a overlay se přepne na 5v5 nebo 6v6. Funguje proto i po tom, co Blizzard scoreboard posune (v roce 2026 se v 5v5 rozšířil a posunul doleva, v 6v6 je zase jinde, na konci roku přibyly kroužky úrovně u portrétů a zelený proužek u hráčů z party). Přesnou polohu portrétů doladí podle ikon rolí. Bannery a chat přes okraj scoreboardu nevadí, řádky pozná podle sloupců se statistikami uprostřed obrazovky.
- U každého řádku přečte ikonu role (štít, tři čárky, plus), takže na řádek tanka zkouší jen tanky, i v open queue.
- Portrét porovná s portréty hrdinů z webu, které jsou stejná kresba jako ikonky ve hře, jen jinak oříznutá a někdy zrcadlová. Porovnává barvy ve třech pásech (vlasy, obličej, ramena) a tvar. Na šesti screenshotech z let 2023 až 2026 (5v5 i 6v6, různé barvy týmů) tak bez jediného vzorku trefil 53 hrdinů ze 63, se vzorky z ostatních screenshotů 59 ze 63. Na třech screenshotech z nejnovější verze hry (ikonky jsou u části hrdinů nově kreslené jinak než portréty na webu) trefil 28 z 30 bez vzorků z nich; zbylé dva měl s otazníkem a správného hrdinu hned na druhém místě. Hrdiny, u kterých si jistý není, označí „?“; hrdina bez otazníku nebyl v testech nikdy špatně.
- Přesnější je s naučenými vzorky ze skutečných scoreboardů: každá oprava i potvrzení se uloží. `data/scoreboard-refs.json` obsahuje vzorky 43 hrdinů z testovacích screenshotů, aplikace si je stáhne sama. Vlastní vzorky jde sdílet: v kalibraci je tlačítko **Kopírovat vzorky**, obsah vlož do `data/scoreboard-refs.json` a commitni.

**Kalibrace** (⚙ v overlayi) ukáže na posledním screenshotu, kde aplikace scoreboard našla a co v kterém řádku vidí. Kdyby ho někdy nenašla nebo rámečky neseděly, přetáhni je na portréty a posuvníky dolaď velikost a rozestup. Tím se přepne na ruční rozložení, zpět jde přes „Automaticky“.

**Data**: aplikace si `data/*.json` i patch notes stahují z GitHub Pages, takže se aktualizují samy, bez nové verze aplikace. Bez internetu použijí kopii, která je v nich přibalená.

**Bez hry**: overlay a kalibrace běží i v prohlížeči (`overlay/ingame.html`, `overlay/calibrate.html` na GitHub Pages) a přijmou vložený screenshot (Ctrl+V nebo přetažení).

### Aplikace pro Windows (`desktop/`)

Samostatná aplikace (Electron), Overwolf nepotřebuje. Ke stažení je v Releases (`desktop-v<verze>`): instalátor `Counterpick-Atlas-Setup-<verze>.exe`, nebo přenosná verze `Counterpick-Atlas-<verze>-portable.exe`, která se nemusí instalovat. Aplikace není podepsaná, takže Windows napoprvé ukážou „Systém Windows ochránil váš počítač“: *Další informace → Přesto spustit*.

- Overwatch musí běžet v režimu **Borderless Windowed** (Nastavení → Video → Režim zobrazení). Přes exkluzivní fullscreen se žádné okno zobrazit nemůže.
- **Alt+C** vyfotí obrazovku, na které je myš, a ukáže overlay. Myš přitom zůstane ve hře, takže hraješ dál.
- **Alt+X** přesune myš do overlaye (opravy, role, mapa), druhým stiskem ho schová. Esc ho schová taky.
- Zavřením hlavního okna aplikace neskončí, zůstane jako ikona v oznamovací oblasti, aby zkratky ve hře fungovaly. Ukončíš ji přes tuto ikonu.
- Jazyk přepneš tlačítky CZ / EN v hlavním okně, nebo v menu ikony v oznamovací oblasti (Jazyk / Language). Obojí drží spolu, overlay i kalibrace se přepnou hned a aplikace si volbu pamatuje v `settings.json`.
- Zkratky jdou změnit v `%APPDATA%\Counterpick Atlas\settings.json` (`keys.scan`, `keys.toggle`, třeba `"Ctrl+Shift+C"`), pak aplikaci spusť znovu.
- Aplikace jen fotí obrazovku jako OBS nebo Discord, do hry nijak nezasahuje.

**Vývoj**: ve složce `desktop/` `npm install`, pak `npm start` spustí aplikaci ze souborů repozitáře a `npm run dist` postaví oba `.exe` do `desktop/dist/`. `npx electron . --smoke=<obrázek>` je rychlá kontrola: ukáže obrázek přes celou obrazovku, naskenuje ho, uloží vedle obrázku snímky oken a vypíše, co overlay přečetl.

**Vydání**: GitHub Action `.github/workflows/desktop.yml` aplikaci postaví při každé změně (Actions → Desktop app → Artifacts). Když v `desktop/package.json` zvedneš `version`, vydá ji i jako release `desktop-v<verze>`.

### Overwolf aplikace

Celý repozitář je zároveň Overwolf aplikace (`manifest.json` v kořeni). Proti verzi pro Windows umí víc: Overwolf sám hlásí hrdiny tvého týmu a kdo z nich jsi ty (štítek „Hra“). Když nahlásí celý tým v role queue, aplikace se z jeho portrétů sama učí, protože řádky jsou seřazené tank → damage → support. Nepřátele Overwolf nehlásí, ti se čtou ze screenshotu; pomáhá i kill feed. Overlay jde v Overwolfu i mimo boj, hra nemusí být v okně.

- **Schválení**: Overwolf nainstaluje aplikaci mimo svůj obchod jen schváleným vývojářům (jinak hlásí „Unauthorized App“). Na dev.overwolf.com se přihlas a pošli formulář *Submit your app idea*. Po schválení se ve stejném účtu v Overwolfu otevře Settings → About → Development options → Load unpacked extension a vybere se složka repozitáře.
- **Zkratky**: Alt+C sken, Alt+X skrýt nebo ukázat overlay. Změnit jdou v nastavení Overwolfu (Hotkeys).
- **Balíček**: `.github/workflows/overwolf.yml` při každé změně zabalí `counterpick-atlas.opk` (Actions → Overwolf app → Artifacts). Do Overwolf obchodu ho po schválení nahraje autor přes Developers Console.
- Overwatch má v Overwolfu ID hry 10844 (`manifest.json`). Kdyby se aplikace ve hře nespustila, ověř ID v souboru gamelist v `%localappdata%\Overwolf`.
