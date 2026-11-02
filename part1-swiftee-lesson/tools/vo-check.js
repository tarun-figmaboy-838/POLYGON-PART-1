#!/usr/bin/env node
// vo-check.js — is every line the game can say, sayable?
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const voLines = require('./vo-lines');

const ROOT = path.resolve(__dirname, '..');
const VO = path.join(ROOT, 'assets', 'vo');
const STRICT = process.argv.includes('--strict');

const rows = voLines();
const idx = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(VO, 'index.json'), 'utf8')); }
  catch (e) { return null; }
})();
if (!idx) { console.error('no assets/vo/index.json — run npm run build:vo'); process.exit(1); }

const listed = new Set(idx.clips);
const on = (id, ext) => fs.existsSync(path.join(VO, id + ext));
const wanted = new Set(rows.map((r) => r.id));

const noClip = [], notListed = [], noOgg = [], orphan = [];
rows.forEach((r) => {
  const mp3 = on(r.id, '.mp3'), ogg = on(r.id, '.ogg');
  if (!mp3 && !ogg) { noClip.push(r); return; }
  if (!listed.has(r.id)) notListed.push(r);
  if (!ogg) noOgg.push(r);
});
fs.readdirSync(VO).filter((f) => /\.(mp3|ogg)$/i.test(f))
  .map((f) => f.replace(/\.(mp3|ogg)$/i, ''))
  .forEach((id) => { if (!wanted.has(id) && orphan.indexOf(id) < 0) orphan.push(id); });

/* how long a line of these words should take, from the clips themselves */
const syll = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0;
  const g = w.replace(/e$/, '').match(/[aeiouy]+/g); return Math.max(1, g ? g.length : 1); };
const sylls = (t) => String(t).trim().split(/\s+/).filter(Boolean).reduce((n, x) => n + syll(x), 0);
const timed = rows.filter((r) => idx.seconds && idx.seconds[r.id] > 0 && sylls(r.text) > 0);
let rate = 0;
if (timed.length >= 6) {
  // the pace that best fits all of them at once, then the odd ones out
  const num = timed.reduce((a, r) => a + idx.seconds[r.id] * sylls(r.text), 0);
  const den = timed.reduce((a, r) => a + sylls(r.text) * sylls(r.text), 0);
  rate = num / den;
}
const odd = [];
if (rate) {
  const misses = timed.map((r) => Math.abs(idx.seconds[r.id] - rate * sylls(r.text)));
  const mean = misses.reduce((a, b) => a + b, 0) / misses.length;
  timed.forEach((r, i) => {
    if (misses[i] > Math.max(1.5, 2.5 * mean)) {
      odd.push({ r, got: idx.seconds[r.id], want: rate * sylls(r.text) });
    }
  });
}

const list = (label, items, fmt) => {
  if (!items.length) return;
  console.log('\n' + label + ' (' + items.length + ')');
  items.forEach((x) => console.log('  ' + fmt(x)));
};

console.log('the game can say ' + rows.length + ' lines; ' + (rows.length - noClip.length) + ' have a clip');
list('NO CLIP — shown but never spoken', noClip, (r) => r.id.padEnd(5) + ' "' + r.text + '"  — ' + r.where);
list('NOT LISTED in index.json — on disk and never asked for', notListed, (r) => r.id + '  (run npm run build:vo)');
list('NO .OGG — silent in Chrome, Firefox and Android', noOgg, (r) => r.id + '  (re-run tools/split-vo.js or tools/make-vo.js)');
list('ORPHAN — a clip nothing asks for', orphan, (id) => id);
if (rate) {
  console.log('\nthis reader runs at about ' + rate.toFixed(2) + 's a syllable');
  list('LENGTH DOES NOT SUIT THE LINE — probably filed against the wrong line',
       odd, (x) => x.r.id.padEnd(5) + ' is ' + x.got.toFixed(2) + 's, these words read in about ' +
                   x.want.toFixed(2) + 's   "' + x.r.text.slice(0, 48) + '"');
}

const bad = noClip.length + notListed.length + noOgg.length;
console.log('');
if (!bad && !odd.length) console.log('every line has a clip, in both formats, and every length suits its line');
else console.log(bad + ' thing' + (bad === 1 ? '' : 's') + ' to fix' + (odd.length ? ', and ' + odd.length + ' clip' + (odd.length === 1 ? '' : 's') + ' to listen to' : ''));
if (STRICT && bad) process.exit(1);
