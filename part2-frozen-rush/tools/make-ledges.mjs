/* THE TWO LEDGES OF PART 1's HAND-OVER SCREEN, from Frozen Rush's own path art.
 *
 *   consumes  game/assets/env/path.webp, cap-l.webp, cap-r.webp   (Part 2's platform set)
 *   writes    ../part1-swiftee-lesson/assets/bg/ledge-l.webp       (a platform ending in a lip)
 *             ../part1-swiftee-lesson/assets/bg/ledge-r.webp       (a platform starting at one)
 *   prints    the geometry the Part 1 stage places them by
 *
 *     node tools/make-ledges.mjs
 *
 * WHY PART 2's ART. The screen after Part 1's summary says "You're ready! Now let's help
 * Momo." with Swiftee standing on the ground — and the ground he stands on is Momo's: the
 * same snow, ice band and rock as the path Frozen Rush opens on, broken by a gap. The
 * lesson hands over on the look of the game it hands over to.
 *
 * WHY BAKED, NOT STITCHED LIVE. Each ledge is a run of path with a crevasse lip at its end,
 * seated the way Part 2's engine seats them (GroundManager.drawCap): the cap scaled so its
 * snow-to-rock face matches the path's, its snow row a hair above the walking line, and the
 * inner 40% of it faded into the path so the grain has no seam. Doing that once here gives
 * the lesson two plain pictures, instead of a second copy of the engine's cap logic.
 *
 * AND THE ROCK GOES ON DOWN. The path's painted rock ends in a jagged edge, which is fine
 * where the screen ends first — but the lesson letterboxes on a 4:3 or 16:10 screen, and
 * there the ledge would stop in mid-air above the band under the board. See stone().
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const ENV = 'game/assets/env/';
const OUT = '../part1-swiftee-lesson/assets/bg/';

// path.webp, as CFG.path describes it: the walking line at 0.4377 of 530, the paint ending at 0.7321
const P = { tileX: 56, tileW: 1536, H: 530, walk: 232, bottom: 388 };
// cap-l / cap-r, as GroundManager.CAP measures them
const CAP = { w: 150, h: 227, snowTop: 52, rockEnd: 226, fade: 0.4 };
const EXTRA = 150;                                   // rows of stone under the painted rock
const H = P.bottom + EXTRA;                          // every ledge image is this tall
const LEFT_W = 1430, RIGHT_W = 850;                  // source px; see the Part 1 stage for why

const raw = async (file, resize) => {
  let s = sharp(ENV + file).ensureAlpha();
  if (resize) s = s.resize(resize.w, resize.h, { fit: 'fill', kernel: 'lanczos3' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};
const blank = (w, h) => ({ data: Buffer.alloc(w * h * 4), w, h });

/** Source-over, straight alpha, with the source clipped to [clipX0, clipX1) of the target. */
function over(dst, src, dx, dy, clipX0 = 0, clipX1 = dst.w) {
  for (let y = 0; y < src.h; y++) {
    const ty = y + dy; if (ty < 0 || ty >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const tx = x + dx; if (tx < clipX0 || tx >= clipX1 || tx < 0 || tx >= dst.w) continue;
      const si = (y * src.w + x) * 4, di = (ty * dst.w + tx) * 4;
      const sa = src.data[si + 3] / 255; if (!sa) continue;
      const da = dst.data[di + 3] / 255, oa = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) {
        dst.data[di + c] = Math.round((src.data[si + c] * sa + dst.data[di + c] * da * (1 - sa)) / oa);
      }
      dst.data[di + 3] = Math.round(oa * 255);
    }
  }
}

/** The cap, at the path's scale, with its inner side faded into the platform. */
async function cap(side) {
  const k = (P.bottom - P.walk) / (CAP.rockEnd - CAP.snowTop);
  const w = Math.round(CAP.w * k), h = Math.round(CAP.h * k);
  const c = await raw(side === 'l' ? 'cap-l.webp' : 'cap-r.webp', { w, h });
  const fadeW = Math.round(w * CAP.fade);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inner = side === 'l' ? x : w - 1 - x;      // cap-l's inner side is its left
    const m = Math.min(1, inner / fadeW);
    const i = (y * w + x) * 4 + 3;
    c.data[i] = Math.round(c.data[i] * m);
  }
  // where its carved face is at the foot of the rock: the stone below must stop there
  const footY = Math.min(h - 1, Math.round(CAP.rockEnd * k) - 6);
  let face = side === 'l' ? 0 : w;
  for (let x = 0; x < w; x++) if (c.data[(footY * w + x) * 4 + 3] > 200) {
    if (side === 'l') face = Math.max(face, x); else face = Math.min(face, x);
  }
  return { ...c, k, top: Math.round(P.walk - 3 - CAP.snowTop * k), face };
}

/* THE CLIFF BELOW THE PAINT FALLS AWAY INTO SHADOW. Tiling the path's own stone down it was
   tried first and read as a brick wall: the band is only 28 rows deep, so every course cut
   the rocks through the middle and the seams made stripes, and the longest icicles reach
   into it as rows of blue teeth. A rock face under a lit ledge darkens as it goes down, so
   this is the stone's own colour — the median of rows 340..366, where there is no ice — at
   80% at the top (the rocks' own dark outlines sit on it), deepening to 40% at the foot, with the painted rock's jagged edge laid
   over the top of it. It only ever shows on a screen taller than 16:9, in the band under
   the lesson's board. */
function stoneColour(tile) {
  const px = [];
  for (let y = 340; y < 366; y++) for (let x = 0; x < tile.w; x += 3) {
    const i = (y * tile.w + x) * 4, [r, g, b, a] = tile.data.subarray(i, i + 4);
    if (a > 250 && b < r + 40) px.push([r, g, b]);
  }
  const med = c => px.map(p => p[c]).sort((u, v) => u - v)[px.length >> 1];
  return [med(0), med(1), med(2)];
}
function stone(dst, tile, x0, x1, y0) {
  const top = stoneColour(tile);
  for (let y = y0; y < dst.h; y++) {
    const t = (y - y0) / Math.max(1, dst.h - 1 - y0), k = 0.8 - 0.4 * t;
    for (let x = Math.max(0, x0); x < Math.min(dst.w, x1); x++) {
      const di = (y * dst.w + x) * 4;
      dst.data[di] = Math.round(top[0] * k); dst.data[di + 1] = Math.round(top[1] * k);
      dst.data[di + 2] = Math.round(top[2] * k); dst.data[di + 3] = 255;
    }
  }
}

async function write(img, name) {
  await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(OUT + name);
}

await mkdir(OUT, { recursive: true });
const path = await raw('path.webp');
const tile = blank(P.tileW, P.H);
over(tile, path, -P.tileX, 0);                        // the tile without its tapered ends

// LEFT: path, then the lip at its right end, stone under both up to the carved face
{
  const c = await cap('l');
  const cx = LEFT_W - c.w;                             // the cap's box ends the image
  const img = blank(LEFT_W, H);
  stone(img, tile, 0, cx + c.face - 2, P.bottom - 30);
  over(img, tile, 0, 0, 0, cx + Math.round(c.w * 0.6)); // the path runs in under the cap's solid part
  over(img, c, cx, c.top);
  await write(img, 'ledge-l.webp');
  console.log(`ledge-l.webp  ${LEFT_W}x${H}  walk ${P.walk}  lip face at x ${cx + c.face}`);
}
// RIGHT: the lip at its left end, then the path
{
  const c = await cap('r');
  const img = blank(RIGHT_W, H);
  stone(img, tile, c.face + 2, RIGHT_W, P.bottom - 30);
  over(img, tile, Math.round(c.w * 0.4) - 700, 0, Math.round(c.w * 0.4), RIGHT_W);
  over(img, c, 0, c.top);
  await write(img, 'ledge-r.webp');
  console.log(`ledge-r.webp  ${RIGHT_W}x${H}  walk ${P.walk}  lip face at x ${c.face}`);
}
