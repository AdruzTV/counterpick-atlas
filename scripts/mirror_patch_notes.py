"""Copy the official Overwatch patch notes into data/blizzard-patch-notes.html.

Browsers can't load Blizzard's page from our site (no CORS), so .github/workflows/patch-notes.yml runs this
every 12 hours and js/blizzard-patches.js parses the copy with jQuery. Only the patch notes part of the
current and previous month's pages is kept. data/status.json gets lastCheck on every run and
patchNotesUpdated whenever the copy changed (the site drops its 12 h cache when that moves).
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'blizzard-patch-notes.html'
STATUS = ROOT / 'data' / 'status.json'
BASE = 'https://overwatch.blizzard.com/en-us/news/patch-notes/'
UA = 'Mozilla/5.0 (compatible; CounterpickAtlas/1.0; +https://adruztv.github.io/counterpick-atlas/)'


class BodySpan(HTMLParser):
    """Finds <div class="PatchNotes-body"> and its matching </div>."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.depth = 0
        self.start = self.end = None

    def handle_starttag(self, tag, attrs):
        if tag != 'div' or self.end is not None:
            return
        if self.start is None:
            if 'PatchNotes-body' in (dict(attrs).get('class') or '').split():
                self.start, self.depth = self.getpos(), 1
        else:
            self.depth += 1

    def handle_endtag(self, tag):
        if tag != 'div' or self.start is None or self.end is not None:
            return
        self.depth -= 1
        if self.depth == 0:
            self.end = self.getpos()


def patch_notes(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as res:
        html = res.read().decode('utf-8')
    span = BodySpan()
    span.feed(html)
    span.close()
    if span.start is None or span.end is None:
        raise ValueError(f'no patch notes found on {url}')
    lines = [0] + [m.end() for m in re.finditer('\n', html)]
    offset = lambda pos: lines[pos[0] - 1] + pos[1]
    return html[offset(span.start):offset(span.end) + len('</div>')]


def main():
    now = datetime.now(ZoneInfo('Europe/Prague')).replace(microsecond=0)
    prev = now.replace(day=1) - timedelta(days=1)
    sources = [BASE, f'{BASE}live/{prev.year}/{prev.month:02d}']

    parts = []
    for i, url in enumerate(sources):
        try:
            parts.append(f'<section data-source="{url}">\n{patch_notes(url)}\n</section>')
        except Exception as e:
            if i == 0:
                raise  # without the current month there is nothing worth publishing
            print(f'Skipping {url}: {e}', file=sys.stderr)
    html = ('<!-- Copy of the official Overwatch patch notes, refreshed by .github/workflows/patch-notes.yml -->\n'
            + '\n'.join(parts) + '\n')

    changed = not OUT.exists() or OUT.read_text(encoding='utf-8') != html
    if changed:
        OUT.write_text(html, encoding='utf-8')

    status = json.loads(STATUS.read_text(encoding='utf-8'))
    newest = max(re.findall(r'id="patch-(\d{4}-\d{2}-\d{2})', html), default='')
    status['lastCheck'] = now.isoformat()
    if newest > status.get('lastPatchDate', ''):
        status['lastPatchDate'] = newest
    if changed:
        status['patchNotesUpdated'] = now.isoformat()
    y, m, d = (int(x) for x in status['lastPatchDate'].split('-'))
    status['lastChange'] = (f'Automatická kontrola: nejnovější patch je z {d}. {m}. {y}, '
                            + ('patch notes se změnily.' if changed else 'beze změny.'))
    STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'{len(parts)} page(s), newest patch {newest or "none"}, {"changed" if changed else "unchanged"}')


if __name__ == '__main__':
    main()
