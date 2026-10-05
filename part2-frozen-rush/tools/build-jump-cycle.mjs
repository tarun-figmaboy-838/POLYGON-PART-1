/* Build a continuous jump take from Momo's original 36-frame GIF.
 * The first ten cells preserve the game's named reaction poses. Frames 10-23
 * are the unbroken take-off, flight and landing performance (GIF frames 14-27).
 * One scale and one foot anchor keep the body from resizing or bobbing on top
 * of the engine's physical jump arc. */
import sharp from 'sharp';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const gif = join(root, 'art-source', 'gif', 'sprite-max-px-frames-36-rows-6-cols-6-2.webp');   // the delivered GIF, kept as a lossless animated WebP
const frames = Array.from({ length: 14 }, (_, i) => i + 14);
const cols = 6;

async function pixels(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  const counts = new Int32Array(info.height);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 3] < 40) continue;
    counts[y]++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const threshold = Math.max(...counts) * 0.25;
  let foot = y1;
  while (foot > y0 && counts[foot] < threshold) foot--;
  return { data, info, box: { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, foot } };
}

const source = new Map();
for (const i of frames) source.set(i, await pixels(await sharp(gif, { page: i }).png().toBuffer()));

for (const set of [
  { dir: join(root, 'game', 'assets', 'char'), old: join(root, 'art-source', 'char-sheets', 'mammoth-jump.webp'), cw: 420, ch: 320, quality: 82 },
  { dir: join(root, 'game', 'assets', 'char', 'hd'), old: join(root, 'art-source', 'char-sheets', 'hd', 'mammoth-jump.webp'), cw: 630, ch: 480, quality: 80 }
]) {
  // the first jump take's sheet, whose first ten cells are the named reaction poses: a build input, kept in art-source
  const old = set.old;
  const base = sharp(old);
  const oldCells = [];
  for (let i = 0; i < 10; i++) oldCells.push(await base.clone().extract({
    left: i % cols * set.cw, top: Math.floor(i / cols) * set.ch,
    width: set.cw, height: set.ch
  }).png().toBuffer());

  const reference = await pixels(oldCells[2]); // old launch pose came from GIF frame 16
  const sourceLaunch = source.get(16).box;
  const scale = reference.box.w / sourceLaunch.w;
  const targetFoot = reference.box.foot;
  const cells = [...oldCells];
  for (const i of frames) {
    const { data, info, box } = source.get(i);
    const cut = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .extract({ left: box.x0, top: box.y0, width: box.w, height: box.h })
      .resize(Math.round(box.w * scale), Math.round(box.h * scale), { kernel: 'lanczos3' })
      .png().toBuffer();
    const meta = await sharp(cut).metadata();
    const left = Math.round((set.cw - meta.width) / 2);
    const top = Math.round(targetFoot - (box.foot - box.y0) * scale);
    if (left < 0 || top < 0 || left + meta.width > set.cw || top + meta.height > set.ch)
      throw new Error(`frame ${i} clips in ${set.cw}x${set.ch}: ${left},${top},${meta.width}x${meta.height}`);
    cells.push(await sharp({ create: { width: set.cw, height: set.ch, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cut, left, top }]).png().toBuffer());
  }
  const out = join(set.dir, 'mammoth-jump-v2.webp');
  await sharp({ create: { width: cols * set.cw, height: 4 * set.ch, channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(cells.map((input, i) => ({ input, left: i % cols * set.cw,
      top: Math.floor(i / cols) * set.ch })))
    .webp({ quality: set.quality, alphaQuality: 100, effort: 5 })
    .toFile(out);
  console.log(`${out}: ${cells.length} cells, scale ${scale.toFixed(3)}, foot ${targetFoot}`);
}
