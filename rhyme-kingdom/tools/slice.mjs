// Cuts the generated sprite sheets (3x3 grids on transparent backgrounds) into
// individual WebP sprites, and converts the scene paintings to WebP.
// Needs Playwright (uses a headless browser canvas for image work).
//   node tools/slice.mjs
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'art-src');
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });

const SHEETS = [
  { file: 'cut-tiles.png', size: 256, names: ['t0', 't1', 't2', 't3', 't4', 't5', 'v', 'x', 'd'] },
  { file: 'cut-obstacles.png', size: 256, names: ['crown', 'pl', 'c1', 'c2', 'c3', 'static', 'tape', 'floor', 'cushion'] },
  { file: 'cut-cast.png', size: 384, names: ['kingFlow', 'queenCadence', 'djDuchess', 'princeBreaks', 'countessCanvas', 'griot', 'buzzkill', 'lipsync', 'static-boss'], portrait: true,
    // characters touch across cells, so their crops are measured by hand (x0, y0, x1, y1 in sheet pixels)
    boxes: [[50, 0, 445, 281], [480, 0, 815, 281], [845, 0, 1225, 281], [80, 284, 350, 510], [485, 284, 760, 510], [845, 284, 1205, 510], [55, 513, 380, 720], [415, 513, 805, 720], [830, 512, 1195, 720]] },
];
SHEETS.push({ file: 'cut-icons.png', size: 128, names: ['i-coin', 'i-star', 'i-lock', 'i-hammer', 'i-row', 'i-col', 'i-shuffle', 'i-hand', 'i-trophy'] });
const SCENES = ['block', 'shop', 'blacktop', 'wall', 'arena'];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
// Gemini paints sprites on flat magenta: turn that into transparency (soft edges, no pink fringe).
await page.evaluate(() => {
  window.keyMagenta = (g, W, H) => {
    const id = g.getImageData(0, 0, W, H), a = id.data;
    if (a[3] < 250) return; // already transparent
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], gg = a[i + 1], b = a[i + 2];
      const m = Math.min(r, b) - gg; // how magenta this pixel is
      if (m <= 40) continue;
      const k = Math.min(1, (m - 40) / 110);
      a[i + 3] = Math.round(a[i + 3] * (1 - k));
      // pull leftover pink toward neutral
      const n = Math.max(gg, Math.round((r + b) / 2 - m * 0.8));
      a[i] = Math.min(r, n + 30); a[i + 2] = Math.min(b, n + 30);
    }
    g.putImageData(id, 0, 0);
  };
});
const dataUrl = (f) => 'data:image/png;base64,' + readFileSync(join(src, f)).toString('base64');

const singles = SHEETS[2].names.filter((n) => existsSync(join(src, `portrait-${n}.png`)));
if (singles.length === SHEETS[2].names.length) SHEETS.splice(2, 1);

for (const sh of SHEETS) {
  const res = await page.evaluate(async ({ url, size, portrait, fixed }) => {
    const im = new Image();
    im.src = url;
    await im.decode();
    const W = im.width, H = im.height;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.drawImage(im, 0, 0);
    window.keyMagenta(g, W, H);
    const a = g.getImageData(0, 0, W, H).data;
    // connected components of opaque pixels on a 2px grid
    const S = 2, gw = Math.ceil(W / S), gh = Math.ceil(H / S);
    const solid = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) solid[y * gw + x] = a[((y * S) * W + x * S) * 4 + 3] > 60 ? 1 : 0;
    const lab = new Int32Array(gw * gh).fill(-1);
    const comps = [];
    for (let i = 0; i < gw * gh; i++) {
      if (!solid[i] || lab[i] >= 0) continue;
      const c = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1, sx: 0, sy: 0 };
      const st = [i]; lab[i] = comps.length;
      while (st.length) {
        const j = st.pop(), x = j % gw, y = (j / gw) | 0;
        c.n++; c.sx += x; c.sy += y;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const k = ny * gw + nx;
          if (solid[k] && lab[k] < 0) { lab[k] = comps.length; st.push(k); }
        }
      }
      comps.push(c);
    }
    comps.sort((p, q) => q.n - p.n);
    let major = comps.slice(0, 9).filter((c) => c.n > 400);
    const boxes = [];
    if (fixed) {
      for (const [x0, y0, x1, y1] of fixed) boxes.push({ x0: x0 / S, y0: y0 / S, x1: x1 / S - 1, y1: y1 / S - 1 });
    } else if (major.length === 9) {
      for (const c of major) boxes.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, cx: c.sx / c.n, cy: c.sy / c.n });
      for (const c of comps.slice(9)) {
        if (c.n < 6) continue;
        const cx = c.sx / c.n, cy = c.sy / c.n;
        let best = null, bd = 1e9;
        for (const b of boxes) {
          const dx = Math.max(b.x0 - cx, 0, cx - b.x1), dy = Math.max(b.y0 - cy, 0, cy - b.y1);
          const d = Math.hypot(dx, dy);
          if (d < bd) { bd = d; best = b; }
        }
        if (best && bd < 40) { best.x0 = Math.min(best.x0, c.x0); best.y0 = Math.min(best.y0, c.y0); best.x1 = Math.max(best.x1, c.x1); best.y1 = Math.max(best.y1, c.y1); }
      }
      boxes.sort((p, q) => p.cy - q.cy);
      const rows = [boxes.slice(0, 3), boxes.slice(3, 6), boxes.slice(6, 9)].map((r) => r.sort((p, q) => p.cx - q.cx));
      boxes.length = 0;
      rows.forEach((r) => boxes.push(...r));
    } else {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) boxes.push({ x0: c * gw / 3, y0: r * gh / 3, x1: (c + 1) * gw / 3 - 1, y1: (r + 1) * gh / 3 - 1 });
    }
    const outs = [];
    for (const b of boxes) {
      const x0 = b.x0 * S, y0 = b.y0 * S, w = (b.x1 - b.x0 + 1) * S, h = (b.y1 - b.y0 + 1) * S;
      const o = document.createElement('canvas');
      o.width = size; o.height = size;
      const og = o.getContext('2d');
      og.imageSmoothingQuality = 'high';
      const pad = portrait ? 0.02 : 0.06;
      const k = (size * (1 - pad * 2)) / Math.max(w, h);
      const dw = w * k, dh = h * k;
      // portraits sit on the bottom edge; objects are centered
      const dx = (size - dw) / 2, dy = portrait ? size - dh : (size - dh) / 2;
      og.drawImage(cv, x0, y0, w, h, dx, dy, dw, dh);
      outs.push(o.toDataURL('image/webp', 0.86));
    }
    return { count: major.length, outs };
  }, { url: dataUrl(sh.file), size: sh.size, portrait: !!sh.portrait, fixed: sh.boxes || null });
  res.outs.forEach((d, i) => writeFileSync(join(out, sh.names[i] + '.webp'), Buffer.from(d.split(',')[1], 'base64')));
  console.log(`${sh.file}: ${res.count} objects found -> ${res.outs.length} sprites`);
}

for (const s of SCENES) {
  for (const v of ['', '-off']) {
    const f = `scene-${s}${v}.png`;
    if (!existsSync(join(src, f))) { console.log('missing ' + f); continue; }
    const d = await page.evaluate(async (url) => {
      const im = new Image(); im.src = url; await im.decode();
      const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * im.height / im.width);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return c.toDataURL('image/webp', 0.82);
    }, dataUrl(f));
    writeFileSync(join(out, `scene-${s}${v}.webp`), Buffer.from(d.split(',')[1], 'base64'));
  }
}
console.log('scenes done');

// One sprite per file: keyed, trimmed to its content and fitted into a square
// (portraits sit on the bottom edge) or scaled to a width (logo, backdrops).
async function single(file, out, opts) {
  const d = await page.evaluate(async ({ url, size, width, portrait, key, q }) => {
    const im = new Image(); im.src = url; await im.decode();
    const W = im.width, H = im.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    if (key) window.keyMagenta(g, W, H);
    let x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1;
    if (key) {
      const a = g.getImageData(0, 0, W, H).data;
      x0 = W; y0 = H; x1 = -1; y1 = -1;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (a[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
    }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const o = document.createElement('canvas');
    if (width) { o.width = width; o.height = Math.round(width * h / w); } else { o.width = o.height = size; }
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
    if (width) og.drawImage(cv, x0, y0, w, h, 0, 0, o.width, o.height);
    else {
      const k = (size * 0.96) / Math.max(w, h), dw = w * k, dh = h * k;
      og.drawImage(cv, x0, y0, w, h, (size - dw) / 2, portrait ? size - dh : (size - dh) / 2, dw, dh);
    }
    return o.toDataURL('image/webp', q);
  }, { url: dataUrl(file), ...opts });
  writeFileSync(join(out, opts.name + '.webp'), Buffer.from(d.split(',')[1], 'base64'));
}
for (const n of singles) await single(`portrait-${n}.png`, out, { name: n, size: 384, portrait: true, key: true, q: 0.86 });
for (const s of SCENES) if (existsSync(join(src, `level-${s}.png`))) await single(`level-${s}.png`, out, { name: `level-${s}`, width: 720, key: false, q: 0.8 });
if (existsSync(join(src, 'logo.png'))) await single('logo.png', out, { name: 'logo', width: 900, key: true, q: 0.88 });
console.log(`singles: ${singles.length} portraits`);
await browser.close();
