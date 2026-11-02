// THE BUTTON ART, from the supplied normal/pressed pairs.
import sharp from 'sharp';
import { writeFileSync, existsSync } from 'node:fs';

const BUTTONS = {
  play: {
    normal: 'art-source/btn-play-raw.webp',
    outNormal: 'game/assets/ui/btn-play.webp',
    outW: 900
  }
};

/** Opaque bounds of an image, alpha > 8. */
async function bounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error(file + ' is fully transparent');
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

async function build(name, cfg) {
  // a single-state button (no pressed art) is fine — see the tryagain note above
  const states = cfg.pressed ? ['normal', 'pressed'] : ['normal'];
  for (const st of states) {
    if (!existsSync(cfg[st])) {
      console.log(`SKIP ${name}: ${cfg[st]} is not there yet`);
      return;
    }
  }
  const b = { normal: await bounds(cfg.normal) };
  if (cfg.pressed) b.pressed = await bounds(cfg.pressed);
  const boxW = Math.max(...states.map(st => b[st].width));
  const boxH = Math.max(...states.map(st => b[st].height));

  for (const state of states) {
    const t = b[state];
    const trimmed = await sharp(state === 'normal' ? cfg.normal : cfg.pressed)
      .extract(t).png().toBuffer();
    const placed = await sharp({
      create: { width: boxW, height: boxH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: trimmed, left: Math.round((boxW - t.width) / 2), top: boxH - t.height }])
      .png()
      .toBuffer();
    const buf = await sharp(placed).resize({ width: cfg.outW }).webp({ quality: 94, effort: 6 }).toBuffer();
    const dest = state === 'normal' ? cfg.outNormal : cfg.outPressed;
    writeFileSync(dest, buf);
    const m = await sharp(buf).metadata();
    console.log(`  ${dest}  ${m.width}x${m.height}  ${(buf.length / 1024).toFixed(1)}kB` +
                `  (source opaque ${t.width}x${t.height})`);
  }
  console.log(`  ${name}: common box ${boxW}x${boxH} -> aspect-ratio: ${boxW} / ${boxH}` +
              `  (${(boxW / boxH).toFixed(4)})`);
}

const only = process.argv[2];
for (const [name, cfg] of Object.entries(BUTTONS)) {
  if (only && only !== name) continue;
  console.log(name + ':');
  await build(name, cfg);
}
