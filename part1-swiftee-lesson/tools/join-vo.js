#!/usr/bin/env node
/*!
 * join-vo.js — build the lines in tools/vo-joins.js out of recorded words.
 *
 *   node tools/join-vo.js [id …]      → assets/vo/<id>.mp3 + .ogg, word starts, index
 *
 * WHERE A WORD IS CUT. The aligner's word times (docs/vo-masters/<master>.json) are 20 ms
 * frames and a word's sound runs past its last letter's frame — a final "p" or "s" has a
 * release. So each part is cut a little outside its words, and the cut is moved to the
 * quietest 10 ms step near that point, never closer than half way to the word on either side:
 * a cut in the middle of a word clicks, and a cut that takes a neighbour's first sound along
 * says a word that is not there. A part that ends its source line keeps the take's own tail
 * up to the next quiet. Each part gets a short fade at both ends, then the parts are laid
 * end to end with their `gap` of silence, brought to the lesson's level (split-vo.js TARGET)
 * and written the way every other clip is (64k mp3, 40k Opus).
 *
 * THE WORD STARTS are the aligner's, moved with their part, in ms from the clip's start, so the
 * bubble reveals the joined line on its own syllables like any recorded one.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VO = path.join(ROOT, 'assets', 'vo');
const RATE = 44100, STEP = 0.01;
const TARGET = -20.5, PEAK_DB = -1.5;
const LEAD = 0.06, TAIL = 0.09, LAST_TAIL = 0.25, FADE = 0.008;
const masters = require('./vo-masters');
const only = process.argv.slice(2);
const joins = require('./vo-joins').filter((j) => !only.length || only.includes(j.id));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vo-join-'));

/* each master once: its samples and its loudness in 10 ms steps (peak dBFS) */
const takes = {};
function take(name) {
  if (takes[name]) return takes[name];
  const m = masters.find((x) => x.name === name);
  if (!m) throw new Error('no master take "' + name + '" in tools/vo-masters.js');
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'vo-masters', name + '.json'), 'utf8'));
  const raw = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(ROOT, m.source), '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'],
                        { maxBuffer: 1 << 29 }).stdout;
  const pcm = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
  const per = Math.round(RATE * STEP), steps = Math.floor(pcm.length / per), peak = new Float32Array(steps);
  for (let k = 0; k < steps; k++) { let v = 0; for (let j = k * per; j < (k + 1) * per; j++) v = Math.max(v, Math.abs(pcm[j])); peak[k] = 20 * Math.log10(v / 32768 + 1e-9); }
  return (takes[name] = { tl, pcm, peak, steps });
}
/* the quietest step between a and b (seconds); ties go to the one nearest `want` */
function quietest(t, a, b, want) {
  let best = want, bv = Infinity;
  for (let s = Math.max(0, Math.ceil(a / STEP)); s <= Math.min(t.steps - 1, Math.floor(b / STEP)); s++) {
    const v = t.peak[s] + Math.abs(s * STEP - want) * 2;           // 2 dB a second of distance
    if (v < bv) { bv = v; best = s * STEP; }
  }
  return best;
}

joins.forEach((j) => {
  const pieces = [], words = [];
  let at = 0;
  j.parts.forEach((p) => {
    const t = take(p.master);
    const line = t.tl.lines.find((l) => l.id === p.line);
    if (!line) throw new Error(j.id + ': no line ' + p.line + ' in ' + p.master);
    const ws = line.words, a = ws[p.words[0]], b = ws[p.words[1]];
    if (!a || !b) throw new Error(j.id + ': no words ' + p.words.join('-') + ' in ' + p.line);
    const prev = ws[p.words[0] - 1], next = ws[p.words[1] + 1];
    // the start: before the first word, not into the one before it
    const lo = prev ? (prev.end + a.start) / 2 : a.start - 0.2;
    const s0 = Math.max(lo, quietest(t, Math.max(lo, a.start - LEAD - 0.04), a.start - 0.01, a.start - LEAD));
    // the end: after the last word, not into the one after it (or the take's tail, if it ends the line)
    const hi = next ? (b.end + next.start) / 2 : b.end + LAST_TAIL;
    const s1 = Math.min(hi, quietest(t, b.end + 0.02, Math.min(hi, b.end + (next ? TAIL : LAST_TAIL)), b.end + (next ? TAIL * 0.6 : LAST_TAIL * 0.7)));
    const gap = (p.gap || 0) / 1000;
    if (gap > 0) { pieces.push({ silence: gap }); at += gap; }
    for (let k = p.words[0]; k <= p.words[1]; k++) words.push(Math.round((at + ws[k].start - s0) * 1000));
    pieces.push({ master: p.master, from: s0, to: s1 });
    at += s1 - s0;
  });
  // the pieces, as raw samples, end to end
  const parts = pieces.map((pc) => {
    if (pc.silence) return Buffer.alloc(Math.round(pc.silence * RATE) * 2);
    const t = take(pc.master), i0 = Math.round(pc.from * RATE), i1 = Math.round(pc.to * RATE);
    const seg = Int16Array.from(t.pcm.subarray(i0, i1));
    const nf = Math.round(FADE * RATE);
    for (let i = 0; i < nf && i < seg.length; i++) { seg[i] = Math.round(seg[i] * i / nf); seg[seg.length - 1 - i] = Math.round(seg[seg.length - 1 - i] * i / nf); }
    return Buffer.from(seg.buffer);
  });
  const tail = Buffer.alloc(Math.round(0.12 * RATE) * 2);            // room after the last word, as a cut clip has
  const raw = path.join(tmp, j.id + '.raw');
  fs.writeFileSync(raw, Buffer.concat(parts.concat([tail])));
  const input = ['-f', 's16le', '-ar', String(RATE), '-ac', '1', '-i', raw];
  // the lesson's level (split-vo.js TARGET), never past the peak limit
  const r = spawnSync('ffmpeg', ['-hide_banner'].concat(input, ['-af', 'ebur128=peak=sample', '-f', 'null', '-']), { encoding: 'utf8' });
  const log = r.stderr || '';
  const I = /I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(log), P = /Peak:\s+(-?[\d.]+) dBFS/.exec(log.slice(log.lastIndexOf('Summary')));
  let gain = I ? TARGET - parseFloat(I[1]) : 0;
  if (P) gain = Math.min(gain, PEAK_DB - parseFloat(P[1]));
  const af = ['-af', 'volume=' + gain.toFixed(2) + 'dB', '-ac', '1'];
  ff(input.concat(af, ['-c:a', 'libmp3lame', '-b:a', '64k', path.join(VO, j.id + '.mp3')]));
  ff(input.concat(af, ['-c:a', 'libopus', '-b:a', '40k', '-vbr', 'on', '-application', 'voip', path.join(VO, j.id + '.ogg')]));
  const timingsFile = path.join(VO, 'word-timings.json');
  const timings = JSON.parse(fs.readFileSync(timingsFile, 'utf8'));
  timings[j.id] = words;
  const sorted = {}; Object.keys(timings).sort().forEach((k) => { sorted[k] = timings[k]; });
  fs.writeFileSync(timingsFile, JSON.stringify(sorted, null, 2) + '\n');
  console.log(j.id.padEnd(5) + ' +' + (at + 0.12).toFixed(2) + 's  ' + words.length + ' words at ' + words.join(' ') + ' ms, ' +
              (gain >= 0 ? '+' : '') + gain.toFixed(1) + ' dB  "' + j.text + '"');
});
fs.rmSync(tmp, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(__dirname, 'build-vo-index.js')], { stdio: 'inherit' });
