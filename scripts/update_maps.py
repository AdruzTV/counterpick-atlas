"""Keep the map list in data/maps.json in sync with OverFast API (run by .github/workflows/patch-notes.yml).

Adds new competitive maps and updates names and modes. Traits written by hand stay untouched, a new map starts
with none (the Counterpick page then gives it no map bonus). Maps are never removed automatically. A network
error only prints a warning, so the patch notes step in the same workflow still runs.
"""
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAPS = ROOT / 'data' / 'maps.json'
API = 'https://overfast-api.tekrop.fr/maps'
MODES = ['control', 'escort', 'hybrid', 'push', 'flashpoint', 'clash']
UA = 'Mozilla/5.0 (compatible; CounterpickAtlas/1.0; +https://adruztv.github.io/counterpick-atlas/)'


def main():
    try:
        req = urllib.request.Request(API, headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as res:
            api = json.load(res)
    except Exception as e:
        print(f'Warning: map list not updated ({e})', file=sys.stderr)
        return

    data = json.loads(MAPS.read_text(encoding='utf-8'))
    known = {m['key']: m for m in data['maps']}
    added = []
    for m in api:
        mode = next((g for g in m.get('gamemodes', []) if g in MODES), None)
        if not mode or not m.get('key'):
            continue
        if m['key'] in known:
            known[m['key']].update(name=m['name'], mode=mode)
        else:
            known[m['key']] = {'key': m['key'], 'name': m['name'], 'mode': mode, 'traits': []}
            added.append(m['name'])
    data['maps'] = sorted(known.values(), key=lambda m: (MODES.index(m['mode']), m['name'].lower()))

    text = json.dumps(data, ensure_ascii=False, indent=1)
    if text != MAPS.read_text(encoding='utf-8'):
        MAPS.write_text(text, encoding='utf-8')
    print(f'{len(data["maps"])} maps' + (f', new: {", ".join(added)}' if added else ', no new maps'))


if __name__ == '__main__':
    main()
