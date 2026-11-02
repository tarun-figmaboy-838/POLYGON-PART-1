// THE THREE SHAPES THE SUPPLIED SET DOES NOT COVER.
import sharp from 'sharp';
import { join, resolve } from 'node:path';
import { pointsOf } from '../game/js/polygons.js';

const ROOT = resolve(import.meta.dirname, '..');
// the delivered PNGs are source art and live outside the deploy root
const SRC_DIR = join(ROOT, 'art-source', 'option-shape');
const DIR = join(ROOT, 'game', 'assets', 'option-shape');

const S = 1254;                    // same canvas as the delivered art
const PAD = 0.955;                 // the delivered blocks nearly fill their canvas
const OUTLINE = 4;
const BEVEL = 40;
const INNER = 6;

const WANT = [
  { id: 'regularHexagon',  donor: 'regularOctagon.avif' },
  { id: 'concavePentagon', donor: 'regularPentagon.avif' },
  { id: 'concaveHexagon',  donor: 'regularHeptagon.avif' },
  // the second concave pentagon: a different donor, so the pair are not twins
  { id: 'concavePentagon2', donor: 'irregularPentagon.avif' }
];

/** The verified ring, fitted into an S x S canvas with a little padding. */
function ring(id) {
  const pts = pointsOf(id);
  if (!pts.length) throw new Error('no verified geometry for ' + id);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const k = Math.min(S * PAD / (x1 - x0), S * PAD / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return pts.map(p => [S / 2 + (p.x - cx) * k, S / 2 + (p.y - cy) * k]);
}

function shrink(pts, f) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(p => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
}
const poly = pts => pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');

const svg = body =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${body}</svg>`);

for (const { id, donor } of WANT) {
  const outer = ring(id);
  // how much of the half-width the frame eats, so the inset is proportional
  const frameIn = 1 - (OUTLINE + BEVEL + INNER) / (S * 0.5);
  const face = shrink(outer, frameIn);

  const base = await sharp(svg(`
    <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#CCF4FD"/>
      <stop offset="0.45" stop-color="#A6EEFE"/>
      <stop offset="1" stop-color="#1DA3F2"/>
    </linearGradient></defs>
    <polygon points="${poly(outer)}" fill="url(#f)"/>`)).png().toBuffer();

  /* 2. real ice, lifted from a donor and masked to the new face. */
  const texMask = await sharp(svg(`<polygon points="${poly(face)}" fill="#fff"/>`))
    .png().toBuffer();
  const donorFace = await sharp(join(SRC_DIR, donor))
    // pull from the middle of the donor, well inside its own frame
    .extract({ left: 210, top: 210, width: S - 420, height: S - 420 })
    .resize(S, S, { fit: 'fill' })
    .png().toBuffer();
  const texture = await sharp(donorFace)
    .composite([{ input: texMask, blend: 'dest-in' }])
    .png().toBuffer();

  const bevelRing = shrink(outer, 1 - (OUTLINE + BEVEL / 2) / (S * 0.5));
  const innerRing = shrink(outer, 1 - (OUTLINE + BEVEL + INNER / 2) / (S * 0.5));
  const frame = await sharp(svg(`
    <defs><linearGradient id="b" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#7BE2FC"/>
      <stop offset="0.5" stop-color="#6FD4FB"/>
      <stop offset="1" stop-color="#2FB0F8"/>
    </linearGradient></defs>
    <polygon points="${poly(bevelRing)}" fill="none" stroke="url(#b)"
             stroke-width="${BEVEL}" stroke-linejoin="miter"/>
    <polygon points="${poly(innerRing)}" fill="none" stroke="#2AAAF6"
             stroke-width="${INNER}" stroke-linejoin="miter" opacity="0.75"/>
    <polygon points="${poly(outer)}" fill="none" stroke="#0B94F7"
             stroke-width="${OUTLINE}" stroke-linejoin="miter"/>`)).png().toBuffer();

  const out = join(SRC_DIR, id + '.avif');
  await sharp({ create: { width: S, height: S, channels: 4,
                          background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: base }, { input: texture }, { input: frame }])
    .avif({ quality: 95, effort: 6, chromaSubsampling: '4:4:4' }).toFile(out);   // as the delivered blocks are kept
  console.log(`built ${id}.avif  (${pointsOf(id).length} sides, interior from ${donor})`);
}
