// THE INSTRUCTION PLANK, from the delivered board.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'art-source/sign-plank-src.webp';
const OUT = 'game/assets/ui/';

const src = sharp(SRC).ensureAlpha();
const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const A = (x, y) => data[(y * W + x) * C + 3];
const RGB = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };

/* ---- 1. trim to what is actually drawn ---- */
let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 8) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const TW = x1 - x0 + 1, TH = y1 - y0 + 1;

/* ---- 2. the plank's own band: the rows where the art is wide ---- */
let plankTop = -1, plankBot = -1;
for (let y = 0; y < H; y++) {
  let n = 0;
  for (let x = 0; x < W; x++) if (A(x, y) > 8) n++;
  if (n > W * 0.5) { if (plankTop < 0) plankTop = y; plankBot = y; }
}

const woodTop = plankTop + 40, woodBot = plankBot - 10;
const rows = woodBot - woodTop;
const hardware = x => {
  let n = 0;
  for (let y = woodTop; y <= woodBot; y++) {
    if (A(x, y) < 60) continue;
    const [r, g, b] = RGB(x, y);
    if ((r > 215 && g > 180 && b > 130) || b > r) continue;      // pale wood, or snow
    n++;
  }
  return n / rows;
};
const dense = [];
for (let x = 0; x < W; x++) if (hardware(x) > 0.2) dense.push(x);
const runs = [];
for (const x of dense) {
  const last = runs[runs.length - 1];
  if (last && x === last[1] + 1) last[1] = x; else runs.push([x, x]);
}
const real = runs.filter(r => r[1] - r[0] > 3);
const nearL = real.filter(r => r[1] < W * 0.2);
const nearR = real.filter(r => r[0] > W * 0.8);
if (!nearL.length || !nearR.length) {
  throw new Error(`no end furniture found: runs ${JSON.stringify(real)}`);
}
const MARGIN = 40;
const needL = nearL[nearL.length - 1][1] + MARGIN - x0;
const needR = x1 - (nearR[0][0] - MARGIN) + 1;
const capW = Math.max(needL, needR);
const capL = x0 + capW;
const capR = x1 - capW + 1;
if (capR - capL < W * 0.3) throw new Error(`the caps leave only ${capR - capL}px to stretch`);

let paleTop = -1, paleBot = -1;
{
  const from = Math.round(W * 0.32), to = Math.round(W * 0.74), span = to - from;
  for (let y = 0; y < H; y++) {
    let pale = 0;
    for (let x = from; x < to; x++) {
      if (A(x, y) < 200) continue;
      const [r, g, b] = RGB(x, y);
      if (r > 215 && g > 180 && b > 120 && r - b > 25) pale++;
    }
    if (pale / span > 0.8) { if (paleTop < 0) paleTop = y; paleBot = y; }
  }
  if (paleTop < 0) throw new Error('no pale panel found');
}

const M0 = capL, M1 = capR;

/* ---- 5. cut ---- */
await mkdir(OUT, { recursive: true });
const cut = async (name, left, width) => {
  await sharp(SRC).ensureAlpha()
    .extract({ left, top: y0, width, height: TH })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(OUT + name);
  return { name, left, width };
};
const L = await cut('plank-l.webp', x0, capL - x0);
const M = await cut('plank-m.webp', M0, M1 - M0);
const R = await cut('plank-r.webp', capR, x1 - capR + 1);

/* ---- 5b. prove the joins line up, rather than assuming they do ---- */
const profile = async (file, col) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const x = col < 0 ? width + col : col;
  let top = null, bot = null, paleTop = null, paleBot = null;
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * channels;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a > 40) { if (top === null) top = y; bot = y; }
    if (a > 200 && r > 200 && g > 170 && b > 120) { if (paleTop === null) paleTop = y; paleBot = y; }
  }
  return { top, paleTop, paleBot, bot };
};
const seam = async (a, ac, b, bc, name) => {
  const p = await profile(OUT + a, ac), q = await profile(OUT + b, bc);
  const off = ['top', 'paleTop', 'paleBot', 'bot'].map(kk => Math.abs(q[kk] - p[kk]));
  const worst = Math.max(...off);
  console.log(`  ${name} seam: top/paleTop/paleBot/bot out by ${off.join('/')} art px`);
  if (worst > 1) throw new Error(`the ${name} seam is ${worst}px out — the slices would not read as one board`);
};
console.log('');
await seam('plank-l.webp', -2, 'plank-m.webp', 1, 'left');
await seam('plank-m.webp', -2, 'plank-r.webp', 1, 'right');

/* ---- 6. the numbers the stylesheet needs, in TRIMMED art pixels ---- */
const t = v => v - x0;
console.log(`
source            ${SRC}  ${W}x${H}
trimmed art       ${TW} x ${TH}   (opaque x ${x0}..${x1}, y ${y0}..${y1})
the plank's wood  y ${plankTop - y0}..${plankBot - y0}   (${plankBot - plankTop + 1} rows of ${TH})
end furniture     ${JSON.stringify(real.map(r => [t(r[0]), t(r[1])]))}

  slice        art x            width
  plank-l      0..${t(capL)}${' '.repeat(Math.max(1, 12 - String(t(capL)).length))}${L.width}
  plank-m      ${t(M0)}..${t(M1)}${' '.repeat(Math.max(1, 10 - String(t(M1)).length))}${M.width}
  plank-r      ${t(capR)}..${TW}${' '.repeat(Math.max(1, 8 - String(TW).length))}${R.width}

FOR css/style.css (.instruction-pill):
  --k            = --sign-h / ${TH}
  caps           left ${t(capL)}, right ${TW - t(capR)}  (art px, never stretched)
  middle width   calc(100% - ${t(capL) + (TW - t(capR))} * var(--k) + 24px)
  wood centre    art y ${Math.round((plankTop + plankBot) / 2 - y0)}
  PALE PANEL     y ${paleTop - y0}..${paleBot - y0}   centre ${((paleTop + paleBot) / 2 - y0).toFixed(1)}
                 (the light timber the words sit on — NOT the plank band, which counts the
                  snow-covered rows along the top and centres the sentence too high)
  text box       y ${paleTop - y0}..${paleBot - y0}   padding ${paleTop - y0} top, ${TH - (paleBot - y0) - 1} bottom
`);
