// Pack the generated 4x2 held-protractor performance. Register each frame
// at the center of its gold baseline so the tool never slips off the vertex.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage();
    const source = fs.readFileSync(path.join(root, 'assets/source/swiftee-angle-protractor-v3.png')).toString('base64');
    const result = await page.evaluate(async source => {
      const image = new Image(); image.src = 'data:image/png;base64,' + source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      const bounds = [];
      const packed = document.createElement('canvas'); packed.width = 2048; packed.height = 1024;
      const out = packed.getContext('2d'); out.imageSmoothingQuality = 'high';
      for (let i = 0; i < 8; i++) {
        const x0 = Math.round(i % 4 * image.width / 4), x1 = Math.round((i % 4 + 1) * image.width / 4);
        const y0 = Math.round(Math.floor(i / 4) * image.height / 2), y1 = Math.round((Math.floor(i / 4) + 1) * image.height / 2);
        const lines = [];
        for (let y = y0; y < y1; y++) {
          let run = 0, best = 0, right = 0;
          for (let x = x0 + Math.floor((x1 - x0) * 0.54); x < x1; x++) {
            const at = (y * image.width + x) * 4;
            const gold = data[at + 3] > 100 && data[at] > 150 && data[at + 1] > 90 && data[at + 2] < data[at + 1] * 0.78;
            run = gold ? run + 1 : 0;
            if (run > best) { best = run; right = x; }
          }
          lines.push({ y, width: best, right });
        }
        const longest = Math.max(...lines.map(l => l.width));
        if (longest < (x1 - x0) * 0.2) throw new Error('No horizontal protractor baseline in frame ' + i);
        const baseline = lines.find(l => l.width >= longest * 0.94);
        const anchor = { x: baseline.right - baseline.width / 2, y: baseline.y };
        const scale = 140 / baseline.width;
        out.save(); out.beginPath(); out.rect(i % 4 * 512, Math.floor(i / 4) * 512, 512, 512); out.clip();
        out.drawImage(image, x0, y0, x1-x0, y1-y0,
          i % 4 * 512 + 384 + (x0-anchor.x)*scale,
          Math.floor(i / 4)*512 + 320 + (y0-anchor.y)*scale,
          (x1-x0)*scale, (y1-y0)*scale);
        out.restore(); bounds.push({ anchor, scale });
      }
      // (no clip paths: the drawing is not sliced any more — the whole frame turns about its
      // registration point, stage.js angleMeasurer)
      return { png: packed.toDataURL('image/png').split(',')[1], webp: packed.toDataURL('image/webp', 0.94).split(',')[1], bounds };
    }, source);
    fs.writeFileSync(path.join(root, 'assets/source/swiftee-angle-protractor-v3-packed.png'), Buffer.from(result.png, 'base64'));
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-protractor-v3.webp'), Buffer.from(result.webp, 'base64'));
    const spec = { image: 'assets/swiftee/swiftee-angle-protractor-v3.webp', cell: 512, cols: 4, rows: 2, frames: 8,
      // 0.33: at 0.28 he stood a head shorter than his own tiny self in the corner
      anchor: { x: 384, y: 320 }, radius: 70, scale: 0.33, registered: result.bounds,
      phases: { carry: [0, 7, 0], position: [0, 1, 2], align: [2, 3], hold: [3, 4, 5, 4], lift: [4, 6, 7, 0] } };
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-measuring.json'), JSON.stringify(spec, null, 2) + '\n');
    fs.writeFileSync(path.join(root, 'src/character/angle-measuring-frames.js'), '// Newly generated angle-performance frames; packed by tools/build-angle-measuring.js\n(function(g){g.AngleMeasuringFrames=' + JSON.stringify(spec) + ';})(typeof window!=="undefined"?window:globalThis);\n');
    console.log('Packed 8 new held-protractor frames, registered to the baseline center.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
