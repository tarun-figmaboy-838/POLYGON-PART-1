#!/usr/bin/env node
// build-swiftee-frames.js — turns the Swiftee manifest into the frame table.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = 'assets/swiftee';
const MANIFEST = path.join(ROOT, ASSETS, 'swiftee.manifest.json');
const OUT = path.join(ROOT, 'src/character/swiftee-frames.js');

const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

/** One scale's sheet entry -> the page list the renderer walks. */
function pages(entry) {
  if (entry.pageList) {
    return entry.pageList.map((p) => ({
      image: p.image,
      cols: p.cols,
      rows: p.rows,
      first: p.firstFrame,
      frames: p.frames
    }));
  }
  return [{ image: entry.image, cols: entry.cols, rows: entry.rows, first: 0, frames: entry.frames }];
}

const clips = {};
const names = Object.keys(m.animations).sort();
let missing = [];

for (const name of names) {
  const a = m.animations[name];
  const s1 = m.scales['1x'].sheets[name];
  const s2 = m.scales['2x'].sheets[name];
  if (!s1) { missing.push(name + ' @1x'); continue; }

  for (const p of pages(s1)) {
    if (!fs.existsSync(path.join(ROOT, ASSETS, p.image))) missing.push(p.image);
  }
  if (s2) {
    for (const p of pages(s2)) {
      if (!fs.existsSync(path.join(ROOT, ASSETS, p.image))) missing.push(p.image);
    }
  }

  clips[name] = {
    frames: a.frames,
    fps: a.fps,
    ms: a.durationMs,
    loop: !!a.loop,
    pingpong: !!a.pingpong,
    exitsCell: !!a.exitsCell,
    sheets: { '1x': pages(s1), '2x': s2 ? pages(s2) : null }
  };

  if (s1.frames !== a.frames) missing.push(name + ': 1x frames ' + s1.frames + ' != ' + a.frames);
  if (s2 && s2.frames !== a.frames) missing.push(name + ': 2x frames ' + s2.frames + ' != ' + a.frames);
}

if (missing.length) {
  console.error('  manifest/asset mismatch:\n   ' + missing.join('\n   '));
  process.exit(1);
}

const crypto = require('crypto');
const hashOf = (rel) => crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, ASSETS, rel))).digest('hex').slice(0, 8);
for (const name of Object.keys(clips)) {
  for (const sc of ['1x', '2x']) {
    (clips[name].sheets[sc] || []).forEach((pg) => { pg.image = pg.image + '?v=' + hashOf(pg.image); });
  }
}

const out =
`/*!
 * swiftee-frames.js — GENERATED, DO NOT EDIT.
 *
 * Source: ${ASSETS}/swiftee.manifest.json
 * Rebuild: node build-swiftee-frames.js
 *
 * ${names.length} animations, ${Object.keys(m.states).length} start/loop/stop states,
 * ${m.standalone.length} standalone clips. Cell ${m.cell['2x']}px @2x / ${m.cell['1x']}px @1x,
 * pivot at the exact cell centre, ${m.fps} fps, uniform grid left-to-right
 * then top-to-bottom. Every one of those numbers comes from the manifest.
 */
(function (global) {
  'use strict';

  var FRAMES = {
    base: ${JSON.stringify(ASSETS + '/')},
    fps: ${m.fps},
    cell: ${JSON.stringify(m.cell)},
    pivot: { x: ${m.pivot.x}, y: ${m.pivot.y} },
    baselineY: ${m.baselineY.normalized},
    states: ${JSON.stringify(m.states)},
    standalone: ${JSON.stringify(m.standalone)},
    exitsCell: ${JSON.stringify(m.exitsCell)},
    clips: ${JSON.stringify(clips)}
  };

  global.SwifteeFrames = FRAMES;
  if (typeof module !== 'undefined' && module.exports) module.exports = FRAMES;

})(typeof window !== 'undefined' ? window : this);
`;

if (process.argv.includes('--check')) {
  const onDisk = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
  if (onDisk !== out) {
    console.error('  swiftee-frames.js is not what the manifest produces: rebuild it (node tools/build-swiftee-frames.js), never edit it');
    process.exit(1);
  }
  console.log('  swiftee-frames.js matches the manifest');
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log(`  swiftee-frames.js written — ${names.length} clips, ${Object.keys(m.states).length} states, ${(out.length / 1024).toFixed(0)} KB`);
