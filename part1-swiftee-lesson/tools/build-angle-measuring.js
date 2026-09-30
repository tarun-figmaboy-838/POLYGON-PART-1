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
      // Per-frame semantic clip paths preserve teal feathers overlapping the
      // tool. A fixed semicircle subtraction cuts the pointing wing off.
      const pixels = out.getImageData(0, 0, packed.width, packed.height).data;
      const bodyClips = [], toolClips = [];
      for (let i = 0; i < 8; i++) {
        const offsetX = i % 4 * 512, offsetY = Math.floor(i / 4) * 512;
        /* THE WING IS THE TEAL THAT REACHES IN FROM THE BIRD. Teal was found by colour alone
           inside the tool zone, and the tool's pale face carries cyan-tinted shading that
           passed for feathers — so patches of face, and the tick marks on them, stayed on
           the bird and showed as specks when the drawn protractor turned away. Now the teal
           inside the zone counts only where it is connected to teal outside it (a flood from
           the bird in), then grown by five pixels so the wing keeps its dark outline. */
        const zone = (x, y) => x >= 308 && x <= 460 && y <= 334 && (y >= 320 || (x-384)*(x-384)+(y-320)*(y-320) <= 76*76);
        const teal = new Uint8Array(512 * 512), seen = new Uint8Array(512 * 512), queue = [];
        for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
          const k = ((offsetY+y)*packed.width+offsetX+x)*4;
          const r = pixels[k], g = pixels[k+1], b = pixels[k+2];
          if (pixels[k+3] > 8 && r < 120 && g > r * 1.18 && g > b * 1.025) {
            teal[y*512+x] = 1;
            if (!zone(x, y)) { seen[y*512+x] = 1; queue.push(y*512+x); }
          }
        }
        while (queue.length) {
          const at = queue.pop(), x = at % 512, y = (at - x) / 512;
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx > 511 || ny > 511) return;
            const n = ny*512+nx;
            if (teal[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
          });
        }
        const feather = new Uint8Array(512 * 512);
        for (let y = 230; y <= 338; y++) for (let x = 302; x <= 466; x++) {
          if (seen[y*512+x]) {
            for(let yy=Math.max(0,y-5);yy<=Math.min(511,y+5);yy++) for(let xx=Math.max(0,x-5);xx<=Math.min(511,x+5);xx++) feather[yy*512+xx]=1;
          }
        }
        let body = '', tool = '';
        for (let y = 0; y < 512; y++) {
          let bodyStart = -1, toolStart = -1;
          for (let x = 0; x <= 512; x++) {
            const inTool = x >= 308 && x <= 460 && y <= 334 &&
              (y >= 320 || (x-384)*(x-384)+(y-320)*(y-320) <= 76*76);
            // The wing's own pixels stay with the bird, never the tool's: with the feather
            // region grown to keep the wing's outline, it also reached the gold rim and the
            // pale face beside the wing, and those bits stayed on the bird when the drawn
            // protractor turned away — gold specks beside his face.
            const k = ((offsetY+y)*packed.width+offsetX+x)*4;
            const pr = pixels[k], pg = pixels[k+1], pb = pixels[k+2], pa = pixels[k+3];
            const toolish = x < 512 && pa > 8 && (
              (pr > 150 && pg > 90 && pb < pg * 0.78) ||                 // gold rim and bar
              (pb > 200 && pr > 150 && pg > 190 && pb >= pg) ||          // pale-blue face
              (pr < 150 && pg < 110 && pb < 70 && pr >= pg));            // the dark ticks
            const keepTool = x < 512 && inTool && !feather[y*512+x];
            const keepBody = x < 512 && !keepTool && !(inTool && toolish);
            if (keepBody && bodyStart < 0) bodyStart = x;
            if (!keepBody && bodyStart >= 0) { body += `M${bodyStart} ${y}h${x-bodyStart}v1H${bodyStart}Z`; bodyStart=-1; }
            if (keepTool && toolStart < 0) toolStart = x;
            if (!keepTool && toolStart >= 0) { tool += `M${toolStart} ${y}h${x-toolStart}v1H${toolStart}Z`; toolStart=-1; }
          }
        }
        bodyClips.push(body); toolClips.push(tool);
      }
      return { png: packed.toDataURL('image/png').split(',')[1], webp: packed.toDataURL('image/webp', 0.94).split(',')[1], bounds, bodyClips, toolClip: toolClips[0] };
    }, source);
    fs.writeFileSync(path.join(root, 'assets/source/swiftee-angle-protractor-v3-packed.png'), Buffer.from(result.png, 'base64'));
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-protractor-v3.webp'), Buffer.from(result.webp, 'base64'));
    const spec = { image: 'assets/swiftee/swiftee-angle-protractor-v3.webp', cell: 512, cols: 4, rows: 2, frames: 8,
      // 0.33: at 0.28 he stood a head shorter than his own tiny self in the corner; the
      // protractor is drawn in stage.js (angleMeasurer), so no tool pixels are kept
      anchor: { x: 384, y: 320 }, radius: 70, scale: 0.33, registered: result.bounds, bodyClips: result.bodyClips,
      phases: { carry: [0, 7, 0], position: [0, 1, 2], align: [2, 3], hold: [3, 4, 5, 4], lift: [4, 6, 7, 0] } };
    fs.writeFileSync(path.join(root, 'assets/swiftee/swiftee-angle-measuring.json'), JSON.stringify(spec, null, 2) + '\n');
    fs.writeFileSync(path.join(root, 'src/character/angle-measuring-frames.js'), '// Newly generated angle-performance frames; packed by tools/build-angle-measuring.js\n(function(g){g.AngleMeasuringFrames=' + JSON.stringify(spec) + ';})(typeof window!=="undefined"?window:globalThis);\n');
    console.log('Packed 8 new held-protractor frames, registered to the baseline center.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
