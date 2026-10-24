"""Add new heroes from OverFast API to the site (run by .github/workflows/patch-notes.yml).

A hero that OverFast lists but data/heroes.json doesn't gets a record like the others: name, role, description,
hit points, abilities and perks from /heroes/<key>, the Stadium flag from the game modes in the hero list. Its
ability and perk icons go to data/icons.json under the next free ids, its portrait to p/<key>.jpg (what
js/scoreboard.js matches the scoreboard against) and its artwork to art/<key>.jpg, in the sizes the existing ones
have. data/status.json gets the new heroCount. Existing heroes are never changed or removed. A network error only
prints a warning, so the other steps in the same workflow still run; a hero that fails is left out whole and tried
again on the next run. Resizing the images needs Pillow (pip install pillow).

Testing: --dry-run downloads and converts everything but writes nothing. --readd <key> handles an existing hero as
if it were new and compares the result with its record. It rewrites that hero, so use it with --dry-run or on a
copy of the site (the workflow does this when run by hand with test_hero):
    mkdir /tmp/site && cp -r data p art /tmp/site && python3 scripts/update_heroes.py --root /tmp/site --readd ana
"""
import argparse
import base64
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parent.parent
API = 'https://overfast-api.tekrop.fr/heroes'
UA = 'Mozilla/5.0 (compatible; CounterpickAtlas/1.0; +https://adruztv.github.io/counterpick-atlas/)'
ICON_SIZE = 64  # longer side of the icons in data/icons.json
PORTRAIT_SIZE = (160, 160)
ART_SIZE = (1280, 608)  # index.html shows art/<key>.jpg at this size


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def clean(text):
    """Joins runs of whitespace into one space like the existing data (the API has double and no-break spaces)."""
    return ' '.join(text.split()) if isinstance(text, str) else text


def icon(data):
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    scale = ICON_SIZE / max(img.size)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    out = io.BytesIO()
    img.resize(size, Image.Resampling.LANCZOS).save(out, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode('ascii')


def jpeg(data, size, background, **options):
    """Fills size with the image (cropping the overflow), transparent parts become background."""
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    img = Image.alpha_composite(Image.new('RGBA', img.size, background), img).convert('RGB')
    out = io.BytesIO()
    ImageOps.fit(img, size, Image.Resampling.LANCZOS).save(out, 'JPEG', optimize=True, **options)
    return out.getvalue()


def fetch_hero(summary, icon_ids, next_id):
    """Downloads one hero. Returns its record, the icons it adds ({url: (id, data URI)}) and its images
    ({path: JPEG}); raises on any error, so a hero is added whole or not at all. icon_ids maps icons added earlier
    in this run to their ids: an icon two heroes share is stored once, like Genji's and Hazard's climbing."""
    key = summary['key']
    d = json.loads(get(f'{API}/{key}'))
    added = {}

    def icon_id(url):
        if url in icon_ids:
            return icon_ids[url]
        if url not in added:
            added[url] = (f'i{next_id + len(added)}', icon(get(url)))
        return added[url][0]

    def entries(items):
        return [{'name': clean(a['name']), 'desc': clean(a['description']), 'icon': icon_id(a['icon'])}
                for a in items or []]

    hp = d.get('hitpoints') or {}
    hp = {f: hp.get(f) or 0 for f in ('health', 'armor', 'shields', 'total')}
    hp['total'] = hp['total'] or hp['health'] + hp['armor'] + hp['shields']
    record = {
        'key': key,
        'name': clean(d.get('name') or summary['name']),
        'role': d.get('role') or summary.get('role'),
        'subrole': d.get('subrole') or summary.get('subrole'),
        'desc': clean(d.get('description')),
        'location': clean(d.get('location')),
        'age': d.get('age'),
        'hp': hp,
        'stadium': 'stadium' in (summary.get('gamemodes') or []),
        'abilities': entries(d.get('abilities')),
        'perks': {kind: entries((d.get('perks') or {}).get(kind)) for kind in ('minor', 'major')},
    }

    portrait = d.get('portrait') or summary['portrait']
    images = {f'p/{key}.jpg': jpeg(get(portrait), PORTRAIT_SIZE, 'white', quality=90)}
    backgrounds = d.get('backgrounds') or []
    art = next((b for b in backgrounds if 'md' in (b.get('sizes') or [])), backgrounds[-1] if backgrounds else None)
    if art:
        images[f'art/{key}.jpg'] = jpeg(get(art['url']), ART_SIZE, 'black', quality=85, progressive=True)
    else:
        print(f'Warning: {record["name"]} has no artwork in OverFast, art/{key}.jpg is missing', file=sys.stderr)
    return record, added, images


def differences(record, old):
    """Fields in which a re-added hero differs from its existing record. Icon ids are new, so they don't count."""
    mask = lambda v: re.sub(r'"icon":"i\d+"', '"icon":""', json.dumps(v, ensure_ascii=False, separators=(',', ':')))
    return [f for f in record if mask(record[f]) != mask(old.get(f))]


def main():
    parser = argparse.ArgumentParser(description='Add new heroes from OverFast API to the site.')
    parser.add_argument('--dry-run', action='store_true', help='download and convert everything, but write nothing')
    parser.add_argument('--root', type=Path, default=ROOT, help='site folder to update (default: this repository)')
    parser.add_argument('--readd', metavar='KEY', action='append', default=[],
                        help='test: handle this existing hero as new (with --dry-run or on a copy, see --root)')
    args = parser.parse_args()
    if args.readd and not args.dry_run and args.root.resolve() == ROOT:
        parser.error('--readd rewrites the hero, use it with --dry-run or on a copy of the site (--root)')

    data_dir = args.root / 'data'
    heroes_file, icons_file, status_file = (data_dir / f for f in ('heroes.json', 'icons.json', 'status.json'))
    heroes = json.loads(heroes_file.read_text(encoding='utf-8'))
    known = {h['key'] for h in heroes} - set(args.readd)
    try:
        new = [h for h in json.loads(get(API)) if h['key'] not in known]
    except Exception as e:
        print(f'Warning: hero list not updated ({e})', file=sys.stderr)
        return
    for key in set(args.readd) - {h['key'] for h in new}:
        print(f'Warning: {key} is not in the OverFast hero list', file=sys.stderr)
    if new and Image is None:
        print(f'Warning: Pillow is missing, new heroes not added: {", ".join(map(str, (h["key"] for h in new)))}',
              file=sys.stderr)
        new = []

    added = []
    if new:
        icons = json.loads(icons_file.read_text(encoding='utf-8'))
        next_id = max((int(k[1:]) for k in icons if re.fullmatch(r'i\d+', k)), default=-1) + 1
        icon_ids, images = {}, {}
        for summary in new:
            key = summary['key']
            try:
                if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', key):  # it becomes a file name
                    raise ValueError(f'unexpected key {key!r}')
                record, new_icons, files = fetch_hero(summary, icon_ids, next_id)
            except Exception as e:
                print(f'Warning: hero {key} not added ({e})', file=sys.stderr)
                continue
            for url, (iid, uri) in new_icons.items():
                icons[iid] = uri
                icon_ids[url] = iid
            next_id += len(new_icons)
            images.update(files)
            pos = next((i for i, h in enumerate(heroes) if h['key'] == key), None)
            if pos is None:  # sorted by key like the others
                heroes.insert(next((i for i, h in enumerate(heroes) if h['key'] > key), len(heroes)), record)
            else:  # --readd
                old, heroes[pos] = heroes[pos], record
            added.append(record)

            ids = [iid for iid, _ in new_icons.values()]
            print(f'{record["name"]}: {len(ids)} new icons' + (f' ({ids[0]} to {ids[-1]})' if ids else '')
                  + ''.join(f', {path} {len(data) // 1024} kB' for path, data in files.items()))
            print(json.dumps(record, ensure_ascii=False, indent=1))
            if pos is not None:
                diff = differences(record, old)
                print('Same as the existing record' if not diff else 'Differs from the existing record (old -> new):')
                dump = lambda v: json.dumps(v, ensure_ascii=False)
                for f in diff:
                    print(f'  {f}: {dump(old.get(f))} -> {dump(record[f])}')

        if added and not args.dry_run:
            for path, data in images.items():
                (args.root / path).parent.mkdir(parents=True, exist_ok=True)
                (args.root / path).write_bytes(data)
            icons_file.write_text(json.dumps(icons, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            heroes_file.write_text(json.dumps(heroes, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    status = json.loads(status_file.read_text(encoding='utf-8'))
    if status.get('heroCount') != len(heroes) and not args.dry_run:
        status['heroCount'] = len(heroes)
        status_file.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'{len(heroes)} heroes' + (f', new: {", ".join(h["name"] for h in added)}' if added else ', no new heroes')
          + (' (dry run, nothing written)' if args.dry_run else ''))


if __name__ == '__main__':
    main()
