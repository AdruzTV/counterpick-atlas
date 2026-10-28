/* Reads hero portraits off a screenshot of the Overwatch scoreboard (held Tab). Used by the in-game overlay
   (overlay/ingame.html) and its calibration page. Works on raw frames { width, height, data: RGBA bytes }.

   Layout: centre of the first ally and the first enemy portrait, row pitch and portrait size, all in screen
   heights, x measured from the horizontal centre. findLayout() finds it on every screenshot by itself (the ally
   rows are one wide block in the team colour, the enemy rows another one below; any colours, as colour filters
   change them), so a new game version that moves the scoreboard still works, in 5v5 and 6v6. A saved layout
   (overlay/calibrate.html) or DEFAULT_LAYOUT, measured on the late 2026 scoreboard (level rings next to the
   portraits), is the fallback.

   Every row also shows a role icon (shield, three bars, plus) left of the portrait; roleOf() reads it, so a
   tank row only considers tanks even in open queue. Early in a match the enemy rows show a "?" silhouette and no
   icon instead: such slots are marked hidden and get no hero.

   Matching: every portrait is cut with the row colour masked to grey, so a hero seen on the blue (ally) rows still
   matches on the red (enemy) rows. References per hero:
   - samples: 16×16 thumbnails cut from real scoreboards, saved when the player confirms or corrects a scan, or
     learned from Overwolf's roster of the player's own team. Compared by correlation; a close match wins outright.
   - portrait: p/<hero>.jpg is the same artwork as the in-game icon, framed a little differently and sometimes
     mirrored. Compared by colours in three horizontal bands (hair, face, shoulders) and by shape against the
     portrait shifted, scaled and mirrored. Tested on real scoreboards: 27 of 29 heroes right with no samples.
   data/scoreboard-refs.json can ship samples for everybody (calibrate.html exports them).
   Exposes window.Scoreboard. */
(() => {
  const N = 16;                       // thumbnail side
  const SAMPLE_OK = 0.72;             // correlation from which a sample match counts
  const SURE_MARGIN = 0.04;           // lead over the runner-up for a "sure" sample match
  const SURE_LEAD = 0.16;             // relative lead for a "sure" match on the portraits alone (no wrong one in tests)
  const MAX_SAMPLES = 8;              // per hero in the player's own store, oldest dropped
  const BG_DIST2 = 48 * 48;           // squared RGB distance to the row colour that still counts as background
  const BANDS = 3;                    // horizontal colour bands of a portrait
  const STORE = 'cpa:scoreboard:samples:v1';
  const DEFAULT_LAYOUT = { cx: -0.585, ally: 0.2065, enemy: 0.5806, pitch: 0.0609, size: 0.0518 };
  const LIMITS = { cx: [-0.9, 0.9], ally: [0, 1], enemy: [0, 1], pitch: [0.01, 0.2], size: [0.01, 0.2] };
  // Role icons as 12×12 grids of white coverage (0–9), averaged from real scoreboards (2023–2026 versions).
  const ROLE_ICONS = {
    tank: ['025666663100', '178889988300', '199999999500', '199999999500', '199999999500', '189999999500',
      '079999999200', '028889995000', '003888870000', '000399600000', '000023000000', '000000000000'],
    damage: ['011011002000', '064046027200', '187079249400', '188089249500', '188089249500', '188089249500',
      '188089249500', '188089249400', '033033113100', '033034124200', '011012002000', '000000000000'],
    support: ['000000000000', '000133200000', '000288600000', '000499700000', '055799965200', '189999999400',
      '189999999400', '013699842000', '000399700000', '000288500000', '000011000000', '000000000000'],
  };
  // A player the scoreboard doesn't show yet (the enemies early in a match): a silhouette with a "?" in the team
  // colour instead of a portrait, and no role icon. Its brightness on the 16×16 thumbnail grid (0–9), from a real
  // scoreboard. It fits that silhouette at 0.96 or more even 4 px off, real portraits at most 0.67 in tests.
  const HIDDEN_ICON = ['0000011111000000', '0000136886310000', '0001599999941000', '0002999999981000',
    '0014973334993000', '0016974734994000', '0026999538993100', '0059999479993100', '0029999589996100',
    '0016999379993000', '0012999999941000', '0002999999710000', '0001799999610000', '0001799999410000',
    '0011899999410000', '1257999999731000'];
  const HIDDEN_OK = 0.8;

  const arr = v => Array.isArray(v) ? v : [];

  function cleanLayout(l) {
    const out = {};
    for (const [k, [lo, hi]] of Object.entries(LIMITS)) {
      const v = Number(l && l[k]);
      out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : DEFAULT_LAYOUT[k];
    }
    return out;
  }

  // Pixel box (centre x, y and side) of every row.
  function boxes(layout, width, height, rows) {
    const l = cleanLayout(layout), s = l.size * height, x = width / 2 + l.cx * height;
    const col = top => Array.from({ length: rows }, (_, i) => ({ x, y: (top + i * l.pitch) * height, s }));
    return { ally: col(l.ally), enemy: col(l.enemy) };
  }

  // The strip right of the portrait where the player name sits: mostly the bare row colour.
  const stripOf = b => [b.x + 1.8 * b.s, b.y - 0.3 * b.s, b.x + 4 * b.s, b.y + 0.3 * b.s];

  function medianRGB(frame, x0, y0, x1, y1) {
    const r = [], g = [], b = [], d = frame.data, w = frame.width;
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    x1 = Math.min(frame.width, Math.round(x1)); y1 = Math.min(frame.height, Math.round(y1));
    const step = Math.max(1, Math.floor((x1 - x0) * (y1 - y0) / 4000));   // a few thousand pixels are plenty
    for (let y = y0, n = 0; y < y1; y++) for (let x = x0; x < x1; x++, n++) {
      if (n % step) continue;
      const i = (y * w + x) * 4;
      r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
    }
    const med = a => { if (!a.length) return 0; a.sort((p, q) => p - q); return a[a.length >> 1]; };
    return [med(r), med(g), med(b)];
  }

  /* ---------- finding the scoreboard ---------- */
  // Row colours: from the bright 2024 rows to the dark, see-through ones of 2026 (around 0,70,100 and 85,15,28).
  // Hue of a clearly coloured pixel in 24 steps of 15°, or -1 for dark and greyish ones. Team colours are a game
  // setting (blue and red by default, teal and magenta and others with colour filters), so only "one strong
  // colour" counts, never a particular one.
  const HUES = 24;
  function hueOf(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 60 || max - min < 0.4 * max) return -1;
    let h;
    if (max === r) h = ((g - b) / (max - min) + 6) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    return Math.min(HUES - 1, (h * HUES / 6) | 0);
  }
  // Within 30°: a team colour drifts that much across its rows (highlighted row, badges, the map behind), while
  // the two teams' colours are always far apart.
  const near = (h, c) => h >= 0 && Math.min((h - c + HUES) % HUES, (c - h + HUES) % HUES) <= 2;

  /* { layout, rows } of the scoreboard on this frame, or null when none is to be seen. The ally rows are one
     wide block of a single strong colour, the enemy rows another one below it; whether a team has 5 or 6 rows
     and where exactly the portraits sit is settled by where the role icons line up. */
  function findLayout(frame) {
    const { width: W, height: H, data: d } = frame;
    const step = Math.max(1, Math.round(H / 540)), xMax = Math.round(W * 0.75), need = W * 0.18;
    const maxGap = Math.max(2, Math.round(0.015 * H / step));   // lines between rows, a stat column, a name
    // The stat columns just left of the screen centre are part of every row in every version (and any aspect
    // ratio); a banner or the chat at the side of the screen never reaches them.
    const c0 = Math.max(0, Math.round(W / 2 - 0.35 * H)), c1 = Math.min(W, Math.round(W / 2 + 0.1 * H));
    // Per sampled line: the colour (3 neighbouring hue steps) covering most of the left part, if it covers enough
    // of it and of the stat columns.
    const lines = [];
    for (let y = 0; y < H; y += step) {
      const count = new Float32Array(HUES), mid = new Float32Array(HUES);
      for (let x = 0; x < xMax; x += step) {
        const i = (y * W + x) * 4, h = hueOf(d[i], d[i + 1], d[i + 2]);
        if (h >= 0) { count[h] += step; if (x >= c0 && x < c1) mid[h] += step; }
      }
      let hue = -1, best = 0;
      for (let c = 0; c < HUES; c++) {
        const n = count[c] + count[(c + 1) % HUES] + count[(c + HUES - 1) % HUES];
        if (n > best) { best = n; hue = c; }
      }
      const inMid = hue < 0 ? 0 : mid[hue] + mid[(hue + 1) % HUES] + mid[(hue + HUES - 1) % HUES];
      lines.push(best >= need && inMid >= 0.3 * (c1 - c0) ? hue : -1);
    }
    // Blocks: runs of lines in one colour. Short interruptions (the thin lines between rows, a name badge in
    // another colour) count as gaps.
    const blocks = [];
    for (let k = 0, start = -1, last = -1, hue = -1, seen = null; k <= lines.length; k++) {
      const h = k < lines.length ? lines[k] : -1;
      if (h >= 0 && start >= 0 && near(h, hue)) { last = k; hue = h; seen[h]++; continue; }
      if (start >= 0 && (k === lines.length || k - last > maxGap)) {
        blocks.push({ top: start * step, bottom: (last + 1) * step, hue: seen.indexOf(Math.max(...seen)) });
        start = -1;
      }
      if (h >= 0 && start < 0) { start = last = k; hue = h; seen = new Array(HUES).fill(0); seen[h]++; }
    }
    const tall = blocks.filter(b => b.bottom - b.top >= 0.2 * H && b.bottom - b.top <= 0.45 * H);
    // Left edge of a block: where its colour starts (the role icon strip). The leftmost x on which at least two
    // of a few lines agree: on the 2026 scoreboard the strip of a row is green for the player's party, so
    // those rows only start in the team colour further right.
    const left = b => {
      const xs = [];
      for (let k = 0; k < 9; k++) {
        const y = Math.round(b.top + (b.bottom - b.top) * (k + 0.5) / 9);
        for (let x = 0, run = 0; x < xMax; x++) {
          const i = (y * W + x) * 4;
          run = near(hueOf(d[i], d[i + 1], d[i + 2]), b.hue) ? run + 1 : 0;
          if (run === 4) { xs.push(x - 3); break; }
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k++) if (xs[k + 1] - xs[k] <= 3) return xs[k];
      return null;
    };
    for (let i = 0; i < tall.length; i++) for (let j = i + 1; j < tall.length; j++) {
      const a = tall[i], e = tall[j], ha = a.bottom - a.top, he = e.bottom - e.top, gap = e.top - a.bottom;
      if (Math.abs(ha - he) > 0.15 * ha || gap < 0.01 * H || gap > 0.25 * H) continue;
      const la = left(a), le = left(e);
      // A whole team in one party has no row starting at the edge: one team's edge is enough.
      if (la === null || le === null || Math.abs(la - le) > 0.06 * W) continue;
      const edge = Math.min(la, le);
      const layoutFor = (rows, dx = 0) => {
        const row = (ha + he) / 2 / rows;
        return cleanLayout({
          cx: (edge + (0.95 + dx) * row - W / 2) / H,
          ally: (a.top + ha / rows / 2) / H, enemy: (e.top + he / rows / 2) / H,
          pitch: row / H, size: 0.85 * row / H,
        });
      };
      // 5 or 6 rows, and the portrait column: where the role icons fit best (the portrait sits 0.7 rows right of
      // its icon; how far from the edge differs between versions). The team whose icons fit better counts: early in
      // a match the enemies' rows have none. Without icons, the usual row heights.
      const iconFit = (rows, dx) => {
        const l = layoutFor(rows, dx), row = l.pitch * H, bx = boxes(l, W, H, rows);
        const fits = { ally: bx.ally.map(b => roleFit(frame, b, row)), enemy: bx.enemy.map(b => roleFit(frame, b, row)) };
        const avg = list => list.reduce((s, f) => s + f[1], 0) / list.length;
        const good = fits.ally.concat(fits.enemy).filter(f => f[1] >= 0.6).map(f => f[3]).sort((p, q) => p - q);
        const shift = good.length ? good[good.length >> 1] : 0;
        return { rows, fit: Math.max(avg(fits.ally), avg(fits.enemy)), layout: { ...l, cx: l.cx + shift / H } };
      };
      let best = null;
      for (const rows of [5, 6]) for (let dx = -0.3; dx <= 0.31; dx += 0.1) {
        const f = iconFit(rows, dx);
        if (!best || f.fit > best.fit) best = f;
      }
      if (best.fit >= 0.6) return { rows: best.rows, layout: cleanLayout(best.layout) };
      const off = (rows, heights) => Math.min(...heights.map(h => Math.abs(ha / rows - h * H)));
      const rows = off(6, [0.0523]) < off(5, [0.0574, 0.0609]) ? 6 : 5;
      return { rows, layout: layoutFor(rows) };
    }
    return null;
  }

  /* ---------- role icons ---------- */
  const ICON_GRID = 12;
  // A G×G grid of digit rows as unit vectors, shifted by up to one cell either way, so a pixel or two off does not
  // matter. What comes in at the edge: nothing (an icon on its own), or the edge itself (a picture going on).
  function shiftedGrid(rows, G, edge) {
    if (rows.length !== G || rows.some(l => l.length !== G)) throw new Error(`icon grid is not ${G}×${G}`);
    const t = Array.from(rows.join(''), Number), out = [];
    const clamp = v => Math.min(G - 1, Math.max(0, v));
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const moved = new Float32Array(G * G);
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
        const sy = y - dy, sx = x - dx;
        if (sy >= 0 && sy < G && sx >= 0 && sx < G) moved[y * G + x] = t[sy * G + sx];
        else if (edge) moved[y * G + x] = t[clamp(sy) * G + clamp(sx)];
      }
      out.push(unit(moved));
    }
    return out;
  }
  const ROLE_GRIDS = Object.fromEntries(Object.entries(ROLE_ICONS).map(([r, rows]) => [r, shiftedGrid(rows, ICON_GRID, false)]));
  const HIDDEN_GRIDS = shiftedGrid(HIDDEN_ICON, N, true);
  const isHidden = c => Math.max(...HIDDEN_GRIDS.map(t => dot(c.lum, t))) >= HIDDEN_OK;

  // 'tank' | 'damage' | 'support' from the white icon left of the portrait, or null when it isn't clear.
  function roleOf(frame, b, row) {
    const [role, fit, lead] = roleFit(frame, b, row);
    return fit >= 0.75 && lead >= 0.1 ? role : null;
  }

  // [best role, its fit (correlation), lead over the second one, how far right of the expected place the icon
  // is in pixels] for the icon left of the portrait. row = row height in pixels: the icon sits about 0.7 rows left
  // of the portrait centre and is 0.3 (2026 scoreboard with level rings) to 0.38 rows wide.
  function roleFit(frame, b, row) {
    let best = null;
    for (const k of [0.3, 0.34, 0.38]) for (const dx of [-0.06, -0.03, 0, 0.03, 0.06]) {
      const f = iconAt(frame, b.x + (dx - 0.7) * row, b.y, k * row);
      if (!best || f[1] > best[1]) best = [...f, dx * row];
    }
    return best;
  }

  // [role, fit, lead] of the icon in the square of side s centred on (cx, cy).
  function iconAt(frame, cx, cy, s) {
    const G = ICON_GRID, x0 = cx - s / 2, y0 = cy - s / 2, n = Math.max(G, Math.round(s));
    const grid = new Float32Array(G * G), cnt = new Float32Array(G * G);
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      const px = Math.round(x0 + xx * s / n), py = Math.round(y0 + yy * s / n);
      if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) continue;
      const i = (py * frame.width + px) * 4, c = ((yy * G / n) | 0) * G + ((xx * G / n) | 0);
      cnt[c]++;
      if (Math.min(frame.data[i], frame.data[i + 1], frame.data[i + 2]) > 190) grid[c]++;
    }
    const cells = unit(grid.map((x, i) => cnt[i] ? x / cnt[i] : 0));
    const scored = Object.entries(ROLE_GRIDS).map(([r, list]) => [r, Math.max(...list.map(t => dot(cells, t)))]).sort((p, q) => q[1] - p[1]);
    return [scored[0][0], scored[0][1], scored[0][1] - scored[1][1]];
  }

  /* ---------- colour histograms: 4 grey levels + 12 hues × 2 saturations × 2 values ---------- */
  const HBINS = 4 + 12 * 2 * 2;
  function bin(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max / 255, s = max ? (max - min) / max : 0;
    if (s < 0.2) return Math.min(3, (v * 4) | 0);
    let h;
    if (max === min) h = 0;
    else if (max === r) h = ((g - b) / (max - min) + 6) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    return 4 + Math.min(11, (h * 2) | 0) * 4 + (s >= 0.55 ? 2 : 0) + (v >= 0.55 ? 1 : 0);
  }
  function normHist(h) {
    let t = 0;
    for (const v of h) t += v;
    if (t) for (let i = 0; i < h.length; i++) h[i] /= t;
    return t ? h : null;
  }
  function histSim(p, q) {
    if (!p || !q) return 0;
    let s = 0;
    for (let i = 0; i < HBINS; i++) s += Math.sqrt(p[i] * q[i]);
    return s;
  }
  const bandSim = (p, q) => p && q ? p.reduce((s, h, i) => s + histSim(h, q[i]), 0) / BANDS : 0;

  /* ---------- thumbnails ---------- */
  // Mean-free unit vector, so a dot product of two is their correlation (-1 … 1).
  function unit(t) {
    const v = new Float32Array(t.length);
    let m = 0;
    for (let i = 0; i < t.length; i++) m += t[i];
    m /= t.length;
    let n = 0;
    for (let i = 0; i < t.length; i++) { v[i] = t[i] - m; n += v[i] * v[i]; }
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }
  function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  const toB64 = t => btoa(String.fromCharCode.apply(null, t));
  function fromB64(s) {
    try {
      const raw = atob(s);
      if (raw.length !== N * N * 3) return null;
      const t = new Uint8ClampedArray(raw.length);
      for (let i = 0; i < raw.length; i++) t[i] = raw.charCodeAt(i);
      return t;
    } catch (e) { return null; }
  }

  // Cut one portrait: thumbnail with the row colour masked to grey, colour bands of the hero pixels, share of
  // hero pixels (an empty slot is almost all row colour), the row colour itself, and the brightness of the
  // unmasked picture (lum, to recognise the silhouette of a hidden player whatever the team colour).
  function cut(frame, b) {
    const bg = medianRGB(frame, ...stripOf(b));
    const d = frame.data, w = frame.width, side = Math.max(4, Math.round(b.s));
    const x0 = Math.round(b.x - side / 2), y0 = Math.round(b.y - side / 2);
    const sum = new Float32Array(N * N * 3), cnt = new Float32Array(N * N), lum = new Float32Array(N * N);
    const bands = Array.from({ length: BANDS }, () => new Float32Array(HBINS));
    let fg = 0, total = 0;
    for (let yy = 0; yy < side; yy++) {
      const py = y0 + yy;
      if (py < 0 || py >= frame.height) continue;
      const row = Math.min(N - 1, (yy * N / side) | 0) * N, band = bands[Math.min(BANDS - 1, (yy * BANDS / side) | 0)];
      for (let xx = 0; xx < side; xx++) {
        const px = x0 + xx;
        if (px < 0 || px >= w) continue;
        const i = (py * w + px) * 4;
        let r = d[i], g = d[i + 1], bl = d[i + 2];
        const c = row + Math.min(N - 1, (xx * N / side) | 0);
        lum[c] += 0.299 * r + 0.587 * g + 0.114 * bl;
        total++;
        const dr = r - bg[0], dg = g - bg[1], db = bl - bg[2];
        if (dr * dr + dg * dg + db * db < BG_DIST2) r = g = bl = 128;
        else { fg++; band[bin(r, g, bl)]++; }
        sum[c * 3] += r; sum[c * 3 + 1] += g; sum[c * 3 + 2] += bl; cnt[c]++;
      }
    }
    const thumb = new Uint8ClampedArray(N * N * 3);
    for (let c = 0; c < N * N; c++) {
      for (let k = 0; k < 3; k++) thumb[c * 3 + k] = cnt[c] ? sum[c * 3 + k] / cnt[c] : 128;
      if (cnt[c]) lum[c] /= cnt[c];
    }
    return { thumb, vec: unit(thumb), bands: bands.map(normHist), fg: total ? fg / total : 0, bg, lum: unit(lum) };
  }

  /* ---------- frames ---------- */
  // Frame from an <img>, <canvas> or ImageBitmap (screenshots pasted in a browser, or a URL from Overwolf).
  function frameFromImage(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height);   // throws if the image taints the canvas
    return { width: id.width, height: id.height, data: id.data };
  }

  // Canvas with the whole frame, for showing it (calibration) or cutting previews from it.
  function frameCanvas(frame) {
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.data.buffer, frame.data.byteOffset, frame.width * frame.height * 4), frame.width, frame.height), 0, 0);
    return c;
  }

  // Small picture of one slot as a data URL (what the scan actually saw).
  function cropURL(source, b, px = 56) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const side = b.s * 1.15;
    c.getContext('2d').drawImage(source, b.x - side / 2, b.y - side / 2, side, side, 0, 0, px, px);
    return c.toDataURL('image/png');
  }

  /* ---------- site portraits as references ---------- */
  // The portrait without its white background: flood fill from the edges, so white hair or armour stays.
  function cutOut(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data, w = c.width, h = c.height;
    const seen = new Uint8Array(w * h), stack = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const p = stack.pop();
      if (seen[p] || d[p * 4] < 232 || d[p * 4 + 1] < 232 || d[p * 4 + 2] < 232) continue;
      seen[p] = 1;
      d[p * 4 + 3] = 0;
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < (h - 1) * w) stack.push(p + w);
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  // Colour bands of the cut-out portrait.
  function portraitBands(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const bands = Array.from({ length: BANDS }, () => new Float32Array(HBINS));
    for (let y = 0; y < c.height; y++) {
      const band = bands[Math.min(BANDS - 1, (y * BANDS / c.height) | 0)];
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i + 3]) band[bin(d[i], d[i + 1], d[i + 2])]++;
      }
    }
    return bands.map(normHist);
  }

  // Thumbnails of the portrait as the game might frame it: mirrored or not, a little smaller or larger, shifted.
  function portraitShapes(c) {
    const S = 64, k = S / N, out = [];
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    for (const flip of [false, true]) for (const z of [0.9, 1, 1.1]) for (const dx of [-0.1, 0, 0.1]) for (const dy of [-0.1, 0, 0.1]) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgb(128,128,128)';
      g.fillRect(0, 0, S, S);
      if (flip) g.setTransform(-1, 0, 0, 1, S, 0);
      const s = S * z;
      g.drawImage(c, (S - s) / 2 + dx * S, (S - s) / 2 + dy * S, s, s);
      const d = g.getImageData(0, 0, S, S).data, t = new Float32Array(N * N * 3);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4, ci = (((y / k) | 0) * N + ((x / k) | 0)) * 3;
        t[ci] += d[i]; t[ci + 1] += d[i + 1]; t[ci + 2] += d[i + 2];
      }
      out.push(unit(t));
    }
    return out;
  }

  /* ---------- references and matching ---------- */
  function readStore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      return s && s.n === N && s.samples && typeof s.samples === 'object' ? s.samples : {};
    } catch (e) { return {}; }
  }

  class Matcher {
    // atlas: CounterpickCore.Atlas with heroes loaded. Paths are relative to the site root (the overlay pages set
    // <base href="../">).
    constructor(atlas) {
      this.atlas = atlas;
      this.own = readStore();          // { key: [{ s: 'u' | 'a', d: base64 }] }  u = player, a = learned from Overwolf
      this.pack = {};                  // { key: [base64] } from data/scoreboard-refs.json
      this.vecs = {};                  // { key: [Float32Array] } own + pack, ready for matching
      this.portraits = {};             // { key: { bands, shapes } }
      this.ready = Promise.all([this.loadPortraits(), this.loadPack()]).then(() => this);
      this.reindex();
      // The overlay and calibration windows share the samples: pick up what the other one learned.
      window.addEventListener('storage', e => { if (e.key === STORE) { this.own = readStore(); this.reindex(); } });
    }

    loadPortraits() {
      return Promise.all(this.atlas.heroes.map(h => new Promise(done => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = cutOut(img);
            this.portraits[h.key] = { bands: portraitBands(c), shapes: portraitShapes(c) };
          } catch (e) { /* no portrait reference, samples only */ }
          done();
        };
        // A hero newer than the Overwolf app's files: take the portrait from GitHub Pages.
        img.onerror = () => {
          if (img.crossOrigin || !CounterpickCore.REMOTE) return done();
          img.crossOrigin = 'anonymous';
          img.src = `${CounterpickCore.REMOTE}p/${h.key}.jpg`;
        };
        img.src = `p/${h.key}.jpg`;
      })));
    }

    loadPack() {
      return CounterpickCore.loadJSON('data/scoreboard-refs.json', true).then(p => {
        if (p && p.n === N && p.samples && typeof p.samples === 'object') { this.pack = p.samples; this.reindex(); }
      }).catch(() => {});
    }

    reindex() {
      this.vecs = {};
      const add = (k, b64) => { const t = fromB64(b64); if (t && this.atlas.HM[k]) (this.vecs[k] ||= []).push(unit(t)); };
      for (const [k, list] of Object.entries(this.pack)) for (const s of arr(list)) add(k, s);
      for (const [k, list] of Object.entries(this.own)) for (const s of arr(list)) add(k, s && s.d);
    }

    save() {
      try { localStorage.setItem(STORE, JSON.stringify({ n: N, samples: this.own })); } catch (e) { /* storage full or blocked */ }
    }

    // Remember what a slot showed. src 'u' = the player said so, 'a' = learned from Overwolf's roster.
    learn(thumb, key, src = 'u') {
      if (!thumb || !this.atlas.HM[key]) return;
      const d = toB64(thumb);
      // The player named this slot: drop samples of other heroes that look just like it (an earlier wrong
      // confirmation or a wrong guess about two same-role teammates would otherwise keep winning).
      if (src === 'u') {
        const v = unit(thumb);
        for (const [k, l] of Object.entries(this.own)) {
          if (k !== key) this.own[k] = arr(l).filter(s => s.d && dot(v, unit(fromB64(s.d) || thumb)) < 0.9);
        }
      }
      const list = (this.own[key] ||= []).filter(s => s.d !== d);
      list.push({ s: src, d });
      // Learned samples never push out the player's own ones.
      while (list.length > MAX_SAMPLES) list.splice(Math.max(0, list.findIndex(s => s.s === 'a')), 1);
      this.own[key] = list;
      this.save();
      this.reindex();
    }

    forget() { this.own = {}; this.save(); this.reindex(); }

    stats() {
      const heroes = this.atlas.heroes.filter(h => this.vecs[h.key] && this.vecs[h.key].length).length;
      const own = Object.values(this.own).reduce((n, l) => n + arr(l).length, 0);
      const pack = Object.values(this.pack).reduce((n, l) => n + arr(l).length, 0);
      return { heroes, total: this.atlas.heroes.length, own, pack };
    }

    // Own samples merged into the shipped pack, as the contents of data/scoreboard-refs.json.
    exportPack() {
      const samples = {};
      for (const h of this.atlas.heroes) {
        const list = [...arr(this.pack[h.key]), ...arr(this.own[h.key]).map(s => s.d)].filter((d, i, a) => d && a.indexOf(d) === i);
        if (list.length) samples[h.key] = list.slice(-MAX_SAMPLES);
      }
      return JSON.stringify({ n: N, note: 'Scoreboard portrait samples for js/scoreboard.js', samples });
    }

    /* Every hero's score for one cut portrait, best first. role: the row's role icon (strong), else expected:
       the role this row has in role queue (weak). allowed: only these heroes. boost: seen in the kill feed. */
    rank(c, { role = null, expected = null, allowed = null, boost = null } = {}) {
      const out = [];
      for (const h of this.atlas.heroes) {
        if (allowed && !allowed.includes(h.key)) continue;
        let ncc = -1;
        for (const v of this.vecs[h.key] || []) ncc = Math.max(ncc, dot(c.vec, v));
        const p = this.portraits[h.key];
        let shape = 0;
        if (p) for (const v of p.shapes) shape = Math.max(shape, dot(c.vec, v));
        const portrait = p ? (bandSim(c.bands, p.bands) + shape) / 2 : 0;
        let score = ncc >= SAMPLE_OK ? 0.6 + 0.4 * ncc : 0.55 * portrait;
        if (role && h.role !== role) score *= 0.5;
        else if (!role && expected && h.role !== expected) score *= 0.85;
        if (boost && boost.includes(h.key)) score *= 1.08;
        out.push({ key: h.key, score, sample: ncc >= SAMPLE_OK });
      }
      return out.sort((a, b) => b.score - a.score);
    }

    /* Reads one scan. The scoreboard is found on the frame when possible (opts.auto, default on), else `layout`
       is used. opts.rows = players per team when not found, opts.roles = { ally, enemy } role per row in role
       queue, opts.allowed = { ally: [keys] } to choose only among known heroes, opts.boost = { enemy: [keys] }.
       Returns { ally: [slot], enemy: [slot], scoreboard, found, layout, rows, self } where
       slot = { box, cut, role, key, score, sure, alts, empty, hidden }; a hidden slot (the "?" silhouette of a
       player the scoreboard doesn't show yet) gets no hero. */
    read(frame, layout, opts = {}) {
      const found = opts.auto === false ? null : findLayout(frame);
      const rows = found ? found.rows : opts.rows || 5, use = found ? found.layout : cleanLayout(layout);
      const bx = boxes(use, frame.width, frame.height, rows), res = { found: !!found, layout: use, rows };
      let colourOk = 0;
      const all = {};
      for (const side of ['ally', 'enemy']) all[side] = bx[side].map((box, i) => {
        const c = cut(frame, box), empty = c.fg < 0.15;
        if (hueOf(...c.bg) >= 0) colourOk++;   // rows sit on a strong team colour
        return { box, cut: c, i, role: roleOf(frame, box, use.pitch * frame.height), empty, hidden: !empty && isHidden(c), key: null, score: 0, sure: false, alts: [] };
      });
      // Where the role icons are readable they decide; the role queue order is only a hint when they are not
      // (6v6 and open queue rows are not sorted by role). Hidden players show no icon.
      const shown = all.ally.concat(all.enemy).filter(s => !s.hidden);
      const order = shown.filter(s => s.role).length < 0.6 * shown.length ? opts.roles : null;
      for (const side of ['ally', 'enemy']) {
        const slots = all[side];
        // Unique heroes per team: repeatedly take the most confident row-hero pair.
        const ranked = slots.map(s => s.empty || s.hidden ? [] : this.rank(s.cut, {
          role: s.role,
          expected: order && order[side] ? order[side][s.i] : null,
          allowed: opts.allowed && opts.allowed[side] || null,
          boost: opts.boost && opts.boost[side] || null,
        }));
        const taken = new Set(), open = new Set(slots.filter(s => !s.empty && !s.hidden).map(s => s.i));
        while (open.size) {
          let best = null;
          for (const i of open) {
            const top = ranked[i].find(x => !taken.has(x.key));
            if (top && (!best || top.score > best.top.score)) best = { i, top };
          }
          if (!best) break;
          const s = slots[best.i], list = ranked[best.i].filter(x => !taken.has(x.key)), next = list[1];
          s.key = best.top.key;
          s.score = best.top.score;
          s.sure = best.top.sample ? !next || best.top.score - next.score >= SURE_MARGIN
            : !!next && best.top.score > 0 && (best.top.score - next.score) / best.top.score >= SURE_LEAD;
          s.alts = ranked[best.i].slice(0, 6).map(x => x.key);
          taken.add(s.key);
          open.delete(best.i);
        }
        res[side] = slots;
      }
      res.scoreboard = found ? true : colourOk >= rows * 2 * 0.6;
      // The player's own row is highlighted: its background is clearly lighter. Read in the stat columns, where no
      // name badge (some are bright purple) gets in the way; 40–60 lighter in every scoreboard version tested.
      const row = use.pitch * frame.height;
      const val = res.ally.map(s => Math.max(...medianRGB(frame, s.box.x + 6 * row, s.box.y - 0.25 * row, s.box.x + 12 * row, s.box.y + 0.25 * row)));
      const sorted = [...val].sort((a, b) => a - b), top = Math.max(...val);
      res.self = top - sorted[sorted.length >> 1] >= 20 ? val.indexOf(top) : null;
      return res;
    }
  }

  window.Scoreboard = { N, DEFAULT_LAYOUT, cleanLayout, boxes, stripOf, findLayout, roleOf, cut, frameFromImage, frameCanvas, cropURL, Matcher };
})();
