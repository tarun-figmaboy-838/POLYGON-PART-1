// Pack the newly generated 4x4 angle-performance sheet. Preserve its alpha;
// use a single scale for every frame so the character never changes size.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage();
    const source = fs.readFileSync(path.join(root, 'assets/source/swiftee-angle-generated.png')).toString('base64');
    const result = await page.evaluate(async source => {
      const image = new Image(); image.src = 'data:image/png;base64,' + source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, image.width, image.height).data;
      const bounds = [];
      for (let i = 0; i < 16; i++) {
        const x0 = Math.round(i % 4 * image.width / 4), x1 = Math.round((i % 4 + 1) * image.width / 4);
        const y0 = Math.round(Math.floor(i / 4) * image.height / 4), y1 = Math.round((Math.floor(i / 4) + 1) * image.height / 4);
        let left = x1, right = x0, top = y1, bottom = y0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          if (data[(y * image.width + x) * 4 + 3] > 16) {
            left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
          }
        }
        if (right <= left || bottom <= top) throw new Error('Missing generated frame ' + i);
        bounds.push({ left, top, width: right - left + 1, height: bottom - top + 1 });
      }
      const scale = Math.min(218 / Math.max(...bounds.map(b => b.width)), 204 / Math.max(...bounds.map(b => b.height)));
      const packed = document.createElement('canvas'); packed.width = 1024; packed.height = 1024;
      const out = packed.getContext('2d'); out.imageSmoothingQuality = 'high';
      bounds.forEach((b, i) => {
        const w = b.width * scale, h = b.height * scale;
        out.drawImage(image, b.left, b.top, b.width, b.height, i % 4 * 256 + (256 - w) / 2, Math.floor(i / 4) * 256 + 230 - h, w, h);
      });
      return { png: packed.toDataURL('image/png').split(',')[1], webp: packed.toDataURL('image/webp', 0.94).split(',')[1], bounds };
    }, source);
    fs.writeFileSync(path.join(root, 'assets/source/swiftee-angle-measuring.png'), Buffer.from(result.png, 'base64'));
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-measuring.webp'), Buffer.from(result.webp, 'base64'));
    const spec = { image: 'assets/swiftee/swiftee-angle-measuring.webp', cell: 256, cols: 4, rows: 4, frames: 16,
      phases: { carry: [0, 1, 2, 3, 2, 1, 0], position: [4, 5, 6, 7], align: [8, 9], hold: [9, 10, 11, 10, 9], lift: [12, 13, 14, 15] } };
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-measuring.json'), JSON.stringify(spec, null, 2) + '\n');
    fs.writeFileSync(path.join(root, 'src/character/angle-measuring-frames.js'), '// Newly generated angle-performance frames; packed by tools/build-angle-measuring.js\n(function(g){g.AngleMeasuringFrames=' + JSON.stringify(spec) + ';})(typeof window!=="undefined"?window:globalThis);\n');
    console.log('Packed 16 new angle-measuring frames with preserved alpha.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
