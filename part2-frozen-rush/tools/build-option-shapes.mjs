// THE OPTION SHAPES: art in, geometry and a game-sized texture out.
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_DIR = join(ROOT, 'art-source', 'option-shape');
const DIR = join(ROOT, 'game', 'assets', 'option-shape');
const CHECK = process.argv.includes('--check');
const ALPHA = 80;
const OUT_MAX = 560;              // a chunk never renders wider than ~280px

const MAP = {
  regularTriangle:         'regularTriangle.avif',
  regularQuadrilateral:    'regularQuadrilateral.avif',
  regularPentagon:         'regularPentagon.avif',
  regularHexagon:          'regularHexagon.avif',        // built
  regularHeptagon:         'regularHeptagon.avif',
  regularOctagon:          'regularOctagon.avif',
  irregularPentagon:       'irregularPentagon.avif',
  irregularConvexPentagon: 'irregularPentagon-2.avif',
  irregularHexagon:        'irregularHexagon.avif',
  irregularConvexHexagon:  'irregularHexagon-2.avif',
  irregularConvexOctagon:  'irregularOctagon.avif',
  concavePentagon:         'concavePentagon.avif',       // built
  concaveHexagon:          'concaveHexagon.avif',        // built
  concaveHeptagon:         'concaveHeptagon.avif',
  concavePentagon2:        'concavePentagon2.avif',
  iceQuadrilateral:        'iceQuadrilateral.avif'
};

/* What each id has to be, so a wrong picture cannot pass silently. */
const EXPECT = {
  regularTriangle: [3, true, true], regularQuadrilateral: [4, true, true],
  regularPentagon: [5, true, true], regularHexagon: [6, true, true],
  regularHeptagon: [7, true, true], regularOctagon: [8, true, true],
  irregularPentagon: [5, false, true], irregularConvexPentagon: [5, false, true],
  irregularHexagon: [6, false, true], irregularConvexHexagon: [6, false, true],
  irregularConvexOctagon: [8, false, true],
  concavePentagon: [5, false, false], concaveHexagon: [6, false, false],
  concaveHeptagon: [7, false, false],
  concavePentagon2: [5, false, false],
  iceQuadrilateral: [4, false, true]
};

function contour(mask, W, H) {
  let start = -1;
  for (let p = 0; p < W * H && start < 0; p++) if (mask[p]) start = p;
  if (start < 0) return [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = start % W, sy = (start - (start % W)) / W;
  const out = [[sx, sy]];
  let cx = sx, cy = sy, dir = 0, guard = 0;
  do {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8;
      const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !mask[ny * W + nx]) continue;
      cx = nx; cy = ny; dir = d; out.push([cx, cy]); moved = true; break;
    }
    if (!moved) break;
  } while ((cx !== sx || cy !== sy) && ++guard < W * H * 4);
  return out;
}

function simplify(pts, eps) {
  const seg = (a, b, p) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (!l2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
  };
  const rdp = list => {
    if (list.length < 3) return list;
    let worst = 0, wi = 0;
    for (let i = 1; i < list.length - 1; i++) {
      const d = seg(list[0], list[list.length - 1], list[i]);
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst <= eps) return [list[0], list[list.length - 1]];
    return [...rdp(list.slice(0, wi + 1)).slice(0, -1), ...rdp(list.slice(wi))];
  };
  let far = 0, fi = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > far) { far = d; fi = i; }
  }
  const ring = [...rdp(pts.slice(0, fi + 1)).slice(0, -1), ...rdp(pts.slice(fi)).slice(0, -1)];
  const keep = [];
  for (let i = 0; i < ring.length; i++) {
    const p0 = ring[(i - 1 + ring.length) % ring.length], p1 = ring[i], p2 = ring[(i + 1) % ring.length];
    const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 0.20) keep.push(p1);
  }

  let ring2 = keep;
  for (let guard = 0; guard < 40 && ring2.length > 3; guard++) {
    const lens = ring2.map((p, i) => {
      const q = ring2[(i + 1) % ring2.length];
      return Math.hypot(q[0] - p[0], q[1] - p[1]);
    });
    const longest = Math.max(...lens);
    let si = -1, sv = Infinity;
    for (let i = 0; i < lens.length; i++) if (lens[i] < sv) { sv = lens[i]; si = i; }
    if (sv >= longest * 0.14) break;
    const a = ring2[si], b = ring2[(si + 1) % ring2.length];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ring2 = ring2.filter((_, i) => i !== si && i !== (si + 1) % ring2.length);
    ring2.splice(Math.min(si, ring2.length), 0, mid);
  }
  return ring2;
}

const problems = [], out = {};

for (const [id, file] of Object.entries(MAP)) {
  const src = join(SRC_DIR, file);
  const { data, info } = await sharp(src).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const mask = new Uint8Array(W * H);
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let p = 0; p < W * H; p++) {
    if (data[p * C + 3] <= ALPHA) continue;
    mask[p] = 1;
    const x = p % W, y = (p - x) / W;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const ring = simplify(contour(mask, W, H), Math.max(2, Math.max(bw, bh) * 0.006));
  const n = ring.length;

  const k = 2 / Math.max(bw, bh);
  const pts = ring.map(([px, py]) => ({
    x: +(((px - x0) - bw / 2) * k).toFixed(5),
    y: +(((py - y0) - bh / 2) * k).toFixed(5)
  }));

  // ---- verify against what the curriculum calls this shape ----
  const [wantN, wantReg, wantConvex] = EXPECT[id];
  const lens = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    return Math.hypot(q.x - p.x, q.y - p.y);
  });
  const spread = (Math.max(...lens) - Math.min(...lens)) / Math.max(...lens);
  const turns = pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const convex = !(turns.some(t => t > 0) && turns.some(t => t < 0));
  const regular = spread <= 0.12;

  if (n !== wantN) problems.push(`${id}: traced ${n} sides from ${file}, curriculum says ${wantN}`);
  if (convex !== wantConvex) problems.push(`${id}: traced ${convex ? 'convex' : 'concave'}, curriculum says ${wantConvex ? 'convex' : 'concave'}`);
  const shortest = Math.min(...lens) / Math.max(...lens);
  if (shortest < 0.10) problems.push(`${id}: shortest side is ${(shortest * 100) | 0}% of the longest — it will not read as a side`);

  const angles = pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  const flattest = Math.min(...angles);
  if (flattest < 0.16) {                       // about 9 degrees
    problems.push(`${id}: its flattest corner turns only ${(flattest * 180 / Math.PI).toFixed(1)} degrees — ` +
                  `those two sides will read as one, so it counts as ${n - 1}`);
  }

  // ---- the texture: trimmed to the silhouette, game-sized, WebP ----
  const scale = Math.min(1, OUT_MAX / Math.max(bw, bh));
  const outName = id + '.webp';
  if (!CHECK) {
    await sharp(src)
      .extract({ left: x0, top: y0, width: bw, height: bh })
      .resize(Math.round(bw * scale), Math.round(bh * scale), { kernel: 'lanczos3' })
      .webp({ quality: 86, effort: 6, alphaQuality: 100 })
      .toFile(join(DIR, outName));
  }

  out[id] = {
    image: 'assets/option-shape/' + outName,
    sides: n, regular: wantReg, convex,
    aspect: +(bw / bh).toFixed(5),
    points: pts
  };
  console.log(`  ${id.padEnd(24)} ${n} sides  ${convex ? 'convex ' : 'CONCAVE'}  ` +
              `${wantReg ? 'regular  ' : 'irregular'}  traced spread ${String((spread * 100) | 0).padStart(2)}%  ` +
              `${bw}x${bh} -> ${Math.round(bw * scale)}x${Math.round(bh * scale)}`);
}

if (problems.length) {
  console.log('\nPROBLEMS:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const body = `/* GENERATED by tools/build-option-shapes.mjs — do not edit by hand.
 *
 * One entry per shape the curriculum names. \`points\` is the ring TRACED OFF THE
 * ARTWORK, normalised so -1..1 spans the longer side of the image's trimmed box —
 * which means the ring and the texture describe the same rectangle, and the engine can
 * lay one over the other with a single drawImage.
 *
 * \`sides\`, \`convex\` and \`regular\` are measured from that ring, not declared, and the
 * build fails if any of them disagrees with what the curriculum calls the shape. So the
 * number a learner counts on screen is the number the game is checking.
 */
export const optionShapes = ${JSON.stringify(out, null, 2)};
`;
if (!CHECK) {
  await writeFile(join(ROOT, 'game', 'js', 'option-shapes.js'), body);
  console.log('\nwrote game/js/option-shapes.js  (' + Object.keys(out).length + ' shapes)');
} else {
  console.log('\ncheck only: ' + Object.keys(out).length + ' shapes, no problems');
}
