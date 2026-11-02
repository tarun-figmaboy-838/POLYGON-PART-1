// An animated GIF of a run cycle -> a padded grid PNG the character slicer can eat.
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CHAR = join(ROOT, 'art-source', 'char-sheets');
const GIF = join(ROOT, 'art-source', 'gif',
  process.argv[2] || 'sprite-max-px-frames-36-rows-6-cols-6.webp');
const OUT = join(CHAR, process.argv[3] || 'run-gif.png');
const GUTTER = 48;
const ALPHA = 40;

const refArg = process.argv.find(a => a.startsWith('--ref='));
const refSize = refArg ? Number(refArg.slice(6)) : 340;
if (!(refSize > 50)) { console.error('bad --ref'); process.exit(1); }
console.log('reference character size (sqrt of opaque area): ' + refSize);

/* ---- the GIF ---- */
const meta = await sharp(GIF).metadata();
const pages = meta.pages || 1;

const { data, info } = await sharp(GIF, { animated: true }).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width, C = info.channels;
const pw = W, ph = info.height / pages;

const boxes = [], areas = [];
for (let p = 0; p < pages; p++) {
  let x0 = pw, x1 = -1, y0 = ph, y1 = -1, n = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(((p * ph + y) * W) + x) * C + 3] <= ALPHA) continue;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  boxes.push({ p, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
  if (n) areas.push(Math.sqrt(n));
}
areas.sort((a, b) => a - b);
const gifSize = areas[areas.length >> 1];
const k = refSize / gifSize;
console.log(`gif: ${pages} frames of ${pw}x${ph}, sqrt(area) median ${gifSize.toFixed(0)}`);
console.log(`pre-scale ${k.toFixed(4)} so the character is ${refSize}px like every other grid`);

/* ---- lay the frames out with gutters, at the matched size ---- */
const cols = 6, rows = Math.ceil(pages / cols);
const cw = Math.round(Math.max(...boxes.map(b => b.w)) * k) + GUTTER;
// tall enough for the whole PAGE, since frames keep their own y within it
const ch = Math.round(ph * k) + GUTTER;
const tiles = [];
for (const b of boxes) {
  if (!b.n) continue;
  const dw = Math.max(1, Math.round(b.w * k)), dh = Math.max(1, Math.round(b.h * k));
  const cut = await sharp(data, { raw: { width: W, height: info.height, channels: C } })
    .extract({ left: b.x0, top: b.p * ph + b.y0, width: b.w, height: b.h })
    .resize(dw, dh, { kernel: 'lanczos3' })
    .png().toBuffer();
  const col = b.p % cols, row = (b.p - col) / cols;
  tiles.push({
    input: cut,
    left: col * cw + Math.round((cw - dw) / 2),
    top: row * ch + Math.round(GUTTER / 2 + b.y0 * k)
  });
}
await sharp({ create: { width: cols * cw, height: rows * ch, channels: 4,
                        background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles)
  .png().toFile(OUT);
console.log(`wrote ${OUT.replace(ROOT + '\\', '')}  ${cols * cw}x${rows * ch}  ` +
            `${cols}x${rows} cells of ${cw}x${ch} (gutter ${GUTTER})`);
