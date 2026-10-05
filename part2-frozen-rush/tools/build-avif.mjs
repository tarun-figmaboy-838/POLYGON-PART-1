/* THE AVIF TWINS — the same picture in fewer bytes, for the browsers that can show one.
 *
 *     node tools/build-avif.mjs                remake every twin whose .webp has changed
 *     node tools/build-avif.mjs --add <webp>…  give pictures a twin, where one pays for itself
 *     node tools/build-avif.mjs --check        exit 1 if a twin is missing, stale or unlisted
 *
 * Then `node tools/build-bundle.mjs`, which hashes the new files into asset-versions.js.
 *
 * A TWIN, NOT A SWAP. The .webp stays exactly as it is, and every browser that cannot show
 * AVIF (or is not sure it can: index.html's ImgFormat probe) is given it as before. Where
 * the probe says yes, assetUrl() in engine.js asks for the .avif beside a .webp instead,
 * and the stylesheets do the same with image-set(); an .avif that will not load falls
 * back to its .webp in loadImg.
 *
 * THE SAME PICTURE. A twin is encoded from the .webp's own pixels, 4:4:4 (no colour
 * smear on the outlines), and kept at the lowest quality where it cannot be told apart
 * from it: 45 dB PSNR or better over the whole picture, for colour (premultiplied, so a
 * transparent pixel's colour does not count) and for alpha alike, AND 38 dB or better in
 * its worst 16-pixel square, so no corner of it is softer than the rest. A smooth sky can
 * pass the first test while one hard edge is visibly worse; the second is what catches it.
 * AND THE SAME SHAPE: the box its pixels with alpha over 40 fill is the .webp's to the pixel,
 * because that is what engine.js measureContent seats an obstacle by — a rock a pixel narrower
 * would stand a fraction smaller and collide a fraction differently.
 *
 * AND SMALLER, OR NOT AT ALL. A twin is kept only when it is at most 80% of the .webp and
 * saves at least 2 KB. The painted, flat-coloured sheets compress better as lossless WebP
 * than AVIF can at that quality, and so do the textured ice blocks; they have no twin, and
 * a change that makes a twin stop paying removes it.
 *
 * THE LIST is tools/avif-twins.json: each twin's quality and the hashes of the .webp it was
 * made from and of the .avif itself, so --check (which needs no sharp) can tell a twin made
 * from an older picture from a current one. tests/bundle.spec.mjs runs it.
 */
import { readFile, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve(import.meta.dirname, '..');
const GAME = join(ROOT, 'game');
const LIST = join(ROOT, 'tools', 'avif-twins.json');

export const RULE = { psnr: 45, worst: 38, block: 16, alphaCut: 40, maxShare: 0.8, minSaved: 2048, qMin: 40, qMax: 95, effort: 7 };

const md5 = buf => createHash('md5').update(buf).digest('hex').slice(0, 8);
const twinOf = webp => webp.replace(/\.webp$/, '.avif');
const rel = p => relative(GAME, p).split('\\').join('/');

async function readList() {
  return existsSync(LIST) ? JSON.parse(await readFile(LIST, 'utf8')) : {};
}
async function writeList(list) {
  const sorted = Object.fromEntries(Object.keys(list).sort().map(k => [k, list[k]]));
  await writeFile(LIST, JSON.stringify(sorted, null, 2) + '\n');
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

/** Every problem with the twins on disk, as sentences; [] when all is well. */
export async function problems() {
  const list = await readList();
  const bad = [];
  for (const [webp, t] of Object.entries(list)) {
    const w = join(GAME, webp), a = join(GAME, twinOf(webp));
    if (!existsSync(w)) { bad.push(`${webp}: listed, but the .webp is not there`); continue; }
    if (!existsSync(a)) { bad.push(`${twinOf(webp)}: missing`); continue; }
    if (md5(await readFile(w)) !== t.webp) bad.push(`${twinOf(webp)}: made from an older ${webp}`);
    if (md5(await readFile(a)) !== t.avif) bad.push(`${twinOf(webp)}: not the file the list made`);
  }
  for (const p of await walk(join(GAME, 'assets'))) {
    if (!p.endsWith('.avif')) continue;
    const webp = rel(p).replace(/\.avif$/, '.webp');
    if (!list[webp]) bad.push(`${rel(p)}: not in tools/avif-twins.json`);
  }
  return bad;
}

/* ---- encoding (only these need sharp) ---- */

function score(ref, dec, w, h) {
  const B = RULE.block;
  let se = 0, sa = 0, worst = Infinity;
  for (let i = 0; i < ref.length; i += 4) {
    const ra = ref[i + 3] / 255, da = dec[i + 3] / 255;
    for (let c = 0; c < 3; c++) { const d = ref[i + c] * ra - dec[i + c] * da; se += d * d; }
    const d = ref[i + 3] - dec[i + 3]; sa += d * d;
  }
  for (let by = 0; by < h; by += B) for (let bx = 0; bx < w; bx += B) {
    let s = 0, k = 0, seen = false;
    for (let y = by; y < Math.min(h, by + B); y++) for (let x = bx; x < Math.min(w, bx + B); x++) {
      const i = (y * w + x) * 4;
      if (ref[i + 3] || dec[i + 3]) seen = true;
      const ra = ref[i + 3] / 255, da = dec[i + 3] / 255;
      for (let c = 0; c < 3; c++) { const d = ref[i + c] * ra - dec[i + c] * da; s += d * d; }
      const d = ref[i + 3] - dec[i + 3]; s += d * d; k += 4;
    }
    if (seen && s > 0) worst = Math.min(worst, 10 * Math.log10(255 * 255 / (s / k)));
  }
  const db = (s, n) => s === 0 ? Infinity : 10 * Math.log10(255 * 255 / (s / n));
  return { rgb: db(se, (ref.length / 4) * 3), a: db(sa, ref.length / 4), worst, sameBox: box(ref, w, h) === box(dec, w, h) };
}

/** The box the pixels with alpha over RULE.alphaCut fill, as measureContent finds it. */
function box(px, w, h) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > RULE.alphaCut) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return [x0, x1, y0, y1].join(',');
}

/** The smallest twin of `file` that passes RULE, or null if none is worth keeping. */
export async function encode(file) {
  const sharp = (await import('sharp')).default;
  const webp = await readFile(file);
  const { data: ref, info } = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cache = new Map();
  const at = async q => {
    if (!cache.has(q)) {
      const buf = await sharp(webp).avif({ quality: q, effort: RULE.effort, chromaSubsampling: '4:4:4' }).toBuffer();
      const dec = await sharp(buf).ensureAlpha().raw().toBuffer();
      const s = score(ref, dec, info.width, info.height);
      cache.set(q, { q, buf, ...s, ok: s.rgb >= RULE.psnr && s.a >= RULE.psnr && s.worst >= RULE.worst && s.sameBox });
    }
    return cache.get(q);
  };
  const cap = webp.length * RULE.maxShare;
  // the lowest quality that passes: a binary search, then a walk down from it, because the
  // worst-square test is not quite monotonic in q and a pass must be a real pass
  let lo = RULE.qMin, hi = RULE.qMax, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, t = await at(mid);
    if (t.ok) { best = t; hi = mid - 1; } else { lo = mid + 1; if (t.buf.length > cap) break; }
  }
  if (!best) return null;
  for (let q = best.q - 1; q >= Math.max(RULE.qMin, best.q - 3); q--) { const t = await at(q); if (t.ok) best = t; else break; }
  if (best.buf.length > cap || webp.length - best.buf.length < RULE.minSaved) return null;
  return best;
}

async function make(list, webp) {
  const w = join(GAME, webp), a = join(GAME, twinOf(webp));
  const t = await encode(w);
  const before = (await stat(w)).size;
  if (!t) {
    if (existsSync(a)) await rm(a);
    delete list[webp];
    console.log(`  ${webp}: no twin (AVIF is not smaller at the same quality)`);
    return;
  }
  await writeFile(a, t.buf);
  list[webp] = { q: t.q, webp: md5(await readFile(w)), avif: md5(t.buf) };
  console.log(`  ${twinOf(webp)}  q${t.q}  ${(before / 1024).toFixed(0)} KB -> ${(t.buf.length / 1024).toFixed(0)} KB` +
    `  (${t.rgb.toFixed(1)} dB, worst square ${t.worst.toFixed(1)} dB)`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const bad = await problems();
    if (bad.length) { console.error('the AVIF twins are out of date — run: node tools/build-avif.mjs\n  ' + bad.join('\n  ')); process.exit(1); }
    console.log(`the AVIF twins are up to date (${Object.keys(await readList()).length})`);
    return;
  }
  const list = await readList();
  const add = args.includes('--add') ? args.filter(a => !a.startsWith('--')).map(a => rel(resolve(process.cwd(), a))) : [];
  for (const webp of add) {
    if (!/^assets\/.+\.webp$/.test(webp) || !existsSync(join(GAME, webp))) throw new Error(`not a .webp under game/assets: ${webp}`);
    await make(list, webp);
  }
  for (const [webp, t] of Object.entries(list)) {
    if (add.includes(webp)) continue;
    const w = join(GAME, webp), a = join(GAME, twinOf(webp));
    if (!existsSync(w)) { delete list[webp]; if (existsSync(a)) await rm(a); console.log(`  ${webp}: gone, and its twin with it`); continue; }
    if (existsSync(a) && md5(await readFile(w)) === t.webp && md5(await readFile(a)) === t.avif) continue;
    await make(list, webp);
  }
  await writeList(list);
  console.log(`${Object.keys(list).length} twins. Now run: node tools/build-bundle.mjs`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch(e => { console.error(e.message || e); process.exit(1); });
}
