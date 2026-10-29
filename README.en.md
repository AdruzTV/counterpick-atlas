# Counterpick Atlas

[Čeština](README.md) · **English**

An unofficial fan guide to Overwatch, written in Czech and also available in English: patch notes, counters, abilities and perks of every hero.

- `index.html` – the whole site
- `js/i18n.js` – interface texts in Czech and English (site, overlay, scan settings and the Overwolf app's title bar)
- `js/counterpick-core.js` – how the Counterpick page works out its recommendations (counters, combos, team style, map tips); the site and the in-game overlay share it, so both recommend the same
- `data/patches.json` – Czech summaries of the patch notes (newest first)
- `js/blizzard-patches.js` – jQuery scraper of the official patch notes; patches newer than the last Czech summary load on each visit and stay in the browser cache for 12 h
- `data/blizzard-patch-notes.html` – a copy of the official patch notes, refreshed every 12 h by a GitHub Action (`.github/workflows/patch-notes.yml`, `scripts/mirror_patch_notes.py`)
- `data/matchups.json` – counters: for every hero, the heroes it is strong against, with a short reason
- `data/synergies.json` – for the Counterpick page: each hero's play style (dive / brawl / poke) and known combos of two heroes, with a reason
- `data/maps.json` – for the Counterpick page: competitive maps (the Action adds new ones from OverFast API, `scripts/update_maps.py`), their traits (long sightlines, tight spaces, high ground, flanks, drops), what each trait and side (attack / defense) favours, and hero tags (sniper, flies, knocks back, engage, holds a position). A new map arrives without traits and adds nothing until someone writes them in.
- `data/heroes.json`, `data/icons.json` – heroes, abilities and perks (from OverFast API, the Action adds new heroes, `scripts/update_heroes.py`)
- `data/status.json` – when the data was last checked, when the patch notes last changed, and the number of heroes
- `art/`, `p/` – hero artwork and portraits (the same Action downloads them for a new hero)
- `overlay/`, `js/scoreboard.js`, `data/scoreboard-refs.json` – the in-game overlay: reads the heroes off a scoreboard screenshot and recommends a pick (see below)
- `manifest.json`, `overwolf/` – the Overwolf app: the site as the app window, the overlay in the game, hotkeys and game data

Counters are rough estimates based on abilities, not match statistics.

The **Counterpick** page (`#counterpick`) recommends a hero based on who you enter for your team and the enemy team. A candidate gains points for every enemy it counters (more for a hard counter) and loses points for everyone who counters it. A combo with a teammate and a style that suits the rest of the team add points too; in 6v6, so does a missing role. The map and the optional attack / defense choice (only on Escort and Hybrid maps, or when no map is chosen) add no points, they are just a tip: the page shows which heroes of your role suit the map and side (dive and a quick engage on attack, poke and heroes who hold a choke on defense) and marks them with ✓ among the recommendations.

Not affiliated with Blizzard Entertainment. Hero images, names and ability descriptions © Blizzard Entertainment.

## Language

The site, the overlay and the app are in Czech and English. Switch with the **CZ / EN** buttons in the site's top bar; the browser remembers the choice (`localStorage`), and the overlay and calibration on the same site or in the app follow it right away. Until someone chooses, the system language decides: Czech for Czech and Slovak, English otherwise. The interface texts are in `js/i18n.js`, each with its Czech and English version side by side; when the English one is missing, the Czech one shows. The Counterpick page recommends the same in both languages, only the words change.

English texts of the data sit in the same files right after the Czech ones, in fields ending in `_en`: reasons for counters and combos `r_en` (`data/matchups.json`, `data/synergies.json`), the note `review.reason_en`, map traits and sides `label_en`, `desc_en`, `badDesc_en` (`data/maps.json`), and in the Czech patch summaries `title_en`, `summary_en`, `kind_en`, for trivia `tag_en`, `title_en`, `text_en` and for changes `a_en`, `t_en` (`data/patches.json`; numbers like „6,5“ or „35 %“ are converted to English by themselves). Where `_en` is missing, Czech shows, so a new counter or patch can be written in Czech first. GitHub Actions leave these fields alone. The automatically downloaded patch notes are in English already.

## Automatic patch notes

A browser can't load Blizzard's page directly (no CORS), so every 12 hours a GitHub Action copies it to `data/blizzard-patch-notes.html` and commits only when something changed. The site parses the copy with jQuery on each visit and keeps it in the browser cache for 12 hours. When the Action brings a new version, the cache is dropped right away.

The site shows automatic patches only when they are newer than the last Czech summary in `data/patches.json` (labelled "Auto · EN" in Czech, "Auto" in English). Once the Czech summary is written, the automatic English versions up to and including its date disappear. The Action can be run by hand under Actions → Patch notes → Run workflow.

### New heroes

The same Action compares the hero list in OverFast API with `data/heroes.json` (`scripts/update_heroes.py`). A missing hero is added with everything the others have: role, description, health, abilities, perks and the Stadium flag. Ability and perk icons go into `data/icons.json`, the portrait into `p/` (the overlay recognises the hero by it) and the artwork into `art/`. The site and the app load them from GitHub Pages, so they know a new hero without a new version. `heroCount` in `data/status.json` goes up.

- The Action never changes or removes existing heroes. When a patch changes health or abilities, they have to be updated by hand.
- A new hero gets no counters or style (`data/matchups.json`, `data/synergies.json`), those are written by hand.
- When OverFast or an image download fails, the Action only prints a warning, the rest finishes and the hero is tried again 12 hours later.
- **Test**: Actions → Patch notes → Run workflow, enter the key of an existing hero (say `ana`) in the *test_hero* field. The Action adds it again to a copy of the data outside the repository, shows the new entry and its differences from the existing one in the log of the *Test adding a hero* step, and puts the copy of the data and images in Artifacts. Nothing from the test goes into the repository. Locally (with Python and Pillow) the same without writing anything: `python scripts/update_heroes.py --dry-run --readd ana`.

## In-game overlay

In the game, Counterpick Atlas can tell you whom to play from a screenshot of the scoreboard. It runs as an **Overwolf app** (`manifest.json`, `overwolf/`): in the game as an overlay (`overlay/`), outside the game it shows the same site as GitHub Pages.

**In the game**
- Hold **Tab** (scoreboard) and press **Alt+C**. The app takes a picture of the game, recognises the heroes in both teams and shows its recommendations. They are worked out the same way as on the Counterpick page, `js/counterpick-core.js` is shared. The scoreboard slides in for a moment after Tab goes down, so the app takes up to four pictures in a row and uses one where it already stands still.
- **Alt+X** hides or shows the overlay, Esc hides it too. The overlay works outside a fight as well, and the game doesn't have to be windowed.
- Overwolf itself reports the heroes of your team and which of them is you (the "Game" label) and the map being played, so it gets picked by itself. When it reports the whole team in role queue, the app learns from their portraits by itself, because the rows are ordered tank → damage → support. Overwolf doesn't report enemies, they are read from the screenshot; the kill feed helps too.
- Early in a match the scoreboard doesn't show the enemies yet, there is a silhouette with a question mark instead of a portrait. The overlay marks them **Unknown** and leaves them out of the points, so the recommendations rest on your team alone. Scan again once the enemies show up.
- A hero marked "?" is a guess the app isn't sure about. Click it and choose the right one. The correction is saved as a sample and the app recognises the hero next time. When everything is right, **All correct, save** saves the whole scan.
- Your row has a "You" label (the app finds it by the highlighted, lighter row). You don't count as part of the team, and your hero sets the role. When the app doesn't find you, click yourself and choose "This is me".
- Once you have picked a hero, the overlay shows a **Your hero** card above the recommendations: its points, its place among the candidates and how much better pick number 1 is. The points are counted the same way as for the recommendations. Without a picked hero there is no card.

**How it recognises heroes** (`js/scoreboard.js`)
- It finds the scoreboard on the screenshot by itself: the teammates' rows form one block in the team colour, the enemies' another one below it. The particular colour doesn't matter, colour filters work too (teal and purple, for example). The role icons tell whether a team has 5 or 6 rows, and the overlay switches to 5v5 or 6v6. So it keeps working after Blizzard moves the scoreboard (in 2026 it got wider and moved left in 5v5, 6v6 has it elsewhere again, and at the end of the year level rings appeared next to the portraits and a green strip for party members, the table grows with perk columns, and players "on fire" glow out past its left edge). The role icons also fine-tune where exactly the portraits are. Banners and the chat over the edge of the scoreboard don't matter, the rows are found by the stat columns in the middle of the screen.
- It reads the role icon of every row (shield, three bars, plus), so a tank row only tries tanks, even in open queue.
- It compares each portrait with the hero portraits from the site, which are the same artwork as the in-game icons, just cropped differently and sometimes mirrored. It compares colours in three bands (hair, face, shoulders) and the shape. On six screenshots from 2023 to 2026 (5v5 and 6v6, different team colours) it got 53 heroes of 63 right without a single sample, and 59 of 63 with samples from the other screenshots. On three screenshots from the latest game version (some heroes' icons are now drawn differently from the portraits on the site) it got 28 of 30 right without samples from them; the other two had a question mark and the right hero in second place. Heroes it isn't sure about are marked "?"; a hero without a question mark was never wrong in the tests.
- It is more accurate with samples learned from real scoreboards: every correction and confirmation is saved. `data/scoreboard-refs.json` holds samples of 46 heroes from test screenshots, and the app downloads it by itself. Your own samples can be shared: the scan settings have a **Copy samples** button, paste the result into `data/scoreboard-refs.json` and commit it.

**Scan settings** (⚙ in the overlay) start with the **hotkeys**: click a hotkey and press a new one (Ctrl, Alt or Shift with a key, or F1–F24 alone). It works right away, and "Default hotkeys" brings back Alt+C and Alt+X. Overwolf holds the hotkeys, so they can also be changed in its settings (Hotkeys), and the overlay shows the ones Overwolf has right now. Below the hotkeys is **calibration**: it shows on the last screenshot where the app found the scoreboard and what it sees in each row. If it ever doesn't find it or the frames are off, drag them onto the portraits and fine-tune size and spacing with the sliders. That switches to a manual layout; "Automatic" switches back.

**Data**: the app loads `data/*.json` and the patch notes from GitHub Pages, so it updates by itself, without a new app version. Offline, it uses the copy bundled with it. Overwolf numbers maps its own way; the numbers are in `data/maps.json` (`ow`), and for a new map we don't have there yet, the app remembers the map you pick by hand for its number once.

**Without the game**: the overlay and scan settings also run in a browser (`overlay/ingame.html`, `overlay/calibrate.html` on GitHub Pages) and accept a pasted screenshot (Ctrl+V or drag and drop).

### Developing the Overwolf app

The whole repository is an Overwolf app (`manifest.json` in the root). Players get it from the Overwolf store.

- **Ad**: the main window (the site) has a rail on the right with how to use the overlay and, below it in the bottom right corner, one 300×250 ad through the Overwolf Ads SDK (`overwolf/js/shell.js`). In a small window the how-to scrolls, and the ad stays fully on screen. By Overwolf's rules it is only in that window: the overlay opens during matches and ads during gameplay are forbidden, and the scan settings are a settings page. The site on GitHub Pages has no ad. Real ads start once Overwolf enables them after reviewing the app; until then the space may stay empty.

- **Running it from the folder**: Overwolf installs apps from outside its store only for approved developers (otherwise it says "Unauthorized App"). With the developer account, open Settings → About → Development options → Load unpacked extension in Overwolf and choose the repository folder; after a change in the files, **Reload** is enough. The data (`data/*.json`) still comes from GitHub Pages, so data changes show only after a push.
- **Log**: every scan writes to `%localappdata%\Overwolf\Log\Apps\Counterpick Atlas\background.html.log` which pictures it took, where the scoreboard was on them and which one it used. The logs of the game events (team, map, kill feed) are next to it in the `Overwolf General GameEvents Provider` folder.
- **Testing without the game**: the overlay and scan settings also run in a browser with a pasted screenshot (see above).
- **Package**: `.github/workflows/overwolf.yml` packs `counterpick-atlas.opk` on every change (Actions → Overwolf app → Artifacts). The author uploads it to the Overwolf store through the Developers Console.
- Overwatch has game ID 10844 in Overwolf (`manifest.json`). The running game reports itself as 108441 (the ID plus an instance number), and the `GamesList` file in `%localappdata%\Overwolf` lists it that way too.
