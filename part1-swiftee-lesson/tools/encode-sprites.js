#!/usr/bin/env node
// encode-sprites.js — the sprite sheets the game draws, as WebP, from their PNG masters.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let sharp;
try { sharp = require('sharp'); }
catch (e) { sharp = require(path.join(ROOT, '..', 'part2-frozen-rush', 'node_modules', 'sharp')); }

const PAIRS = [
  ['assets/source/intro/sheet1.avif', 'assets/swiftee/intro/sheet1.webp'],
  ['assets/source/intro/sheet2.avif', 'assets/swiftee/intro/sheet2.webp'],
  ['assets/source/intro/sheet3.avif', 'assets/swiftee/intro/sheet3.webp'],
  ['assets/source/swiftee-measuring.png', 'assets/swiftee/swiftee-measuring.webp']
];
const LEVEL = 40;   // near-lossless preprocessing: 100 is lossless, 0 the most

(async () => {
  let failed = 0;
  for (const [src, out] of PAIRS) {
    const from = path.join(ROOT, src), to = path.join(ROOT, out);
    const buf = await sharp(from).webp({ nearLossless: true, quality: LEVEL, effort: 6 }).toBuffer();
    const was = fs.statSync(from).size;
    if (buf.length >= was) { console.error('REFUSED ' + out + ': ' + buf.length + ' bytes is not smaller than ' + was); failed++; continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, buf);
    console.log(out.padEnd(40) + (buf.length / 1024).toFixed(0).padStart(5) + ' KB  (' + (100 * buf.length / was).toFixed(0) + '% of the ' + (was / 1024).toFixed(0) + ' KB png)');
  }
  if (failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
