#!/usr/bin/env node
// split-vo.js — cut the recorded take into the per-line clips the game plays.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VO = path.join(ROOT, 'assets', 'vo');
const mi = process.argv.indexOf('--master'), MASTER = mi > 0 ? process.argv[mi + 1] : null;
const master = MASTER ? require('./vo-masters').find((m) => m.name === MASTER) : null;
if (MASTER && !master) throw new Error('no master take "' + MASTER + '" in tools/vo-masters.js');
const SRC = path.resolve(ROOT, master ? master.source : (process.argv.slice(2).find((a) => !a.startsWith('--')) || 'assets/source/gamevo.mp3'));
const TIMELINE = master ? path.join(ROOT, 'docs', 'vo-masters', master.name + '.json') : path.join(ROOT, 'docs', 'vo-timeline.json');
const ROOM = 0.06, POST = 0.28, HUSH = 0.15, QUIET_DB = -45, LEAD = 60, TEMPO = master ? (master.tempo || 1) : 0.88;
const TARGET = -20.5, MATCH = 0.8, MAX_DB = 3, PEAK_DB = -1.5;
const LOUD_DB = -35;                                // a word's sound has begun
const STRETCH = TEMPO === 1 ? null : 'rubberband=tempo=' + TEMPO + ':detector=soft:formant=preserved:pitchq=quality:window=standard';
// (a master take voices only its own lines: every other clip is left as it is)
const KEEP_OTHERS = !!master || process.argv.includes('--keep-others');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);

const tl = JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));
const lines = tl.lines;
const cutIt = (l) => !/~/.test(l.id);
const DERIVED = (tl.derived || []).map((d) => [d.id, d.from, d.words[0], d.words[1]]);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vo-cut-'));
const wav = path.join(tmp, 'take.wav');
ff(['-i', SRC, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', wav]);

// the take's loudness in 10 ms steps: the peak of each step, in dBFS
const pcm = (() => { const b = fs.readFileSync(wav); let o = 12; while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'data') return new Int16Array(b.buffer.slice(b.byteOffset + o + 8, b.byteOffset + o + 8 + n)); o += 8 + n; } throw new Error('no audio in the decoded take'); })();
const STEP = 0.01, per = Math.round(44100 * STEP), steps = Math.floor(pcm.length / per);
const peak = new Float32Array(steps);
for (let k = 0; k < steps; k++) { let m = 0; for (let j = k * per; j < (k + 1) * per; j++) { const v = Math.abs(pcm[j]); if (v > m) m = v; } peak[k] = 20 * Math.log10(m / 32768 + 1e-9); }
const quiet = (t, len) => { for (let k = Math.floor(t / STEP); k < Math.ceil((t + len) / STEP); k++) if (k >= steps || peak[k] > QUIET_DB) return false; return true; };

function onsetOf(w, floor) {
  const hi = Math.min(steps - 6, Math.floor((w.start + 0.02) / STEP));
  const lo = Math.max(5, Math.ceil(Math.max(w.start - 0.3, floor) / STEP));
  for (let j = hi; j >= lo; j--) {
    if (peak[j] <= LOUD_DB || peak[j - 1] > LOUD_DB) continue;
    let q = j - 1; if (peak[q] > QUIET_DB) q--;
    if (q - 2 < lo - 3 || peak[q] > QUIET_DB || peak[q - 1] > QUIET_DB || peak[q - 2] > QUIET_DB) continue;
    let held = 0; for (let z = j; z < j + 5; z++) if (peak[z] > -30) held++;
    if (held >= 3) return (q + 1) * STEP;
  }
  return null;
}
const snapped = (words, clipStart) => words.map((w, k) => {
  const at = onsetOf(w, k ? words[k - 1].start + 0.1 : clipStart);
  return at == null ? { start: w.start, lead: LEAD } : { start: at, lead: 0 };
});

const segs = lines.map((l, i) => ({ id: l.id, start: l.start, end: l.end, words: l.words,
                                    before: i ? lines[i - 1].end : 0, after: lines[i + 1] ? lines[i + 1].start : null }));
DERIVED.forEach(([id, from, a, b]) => {
  const i = lines.findIndex((l) => l.id === from); if (i < 0) return;
  const l = lines[i], ws = l.words.slice(a, b + 1);
  segs.push({ id, start: ws[0].start, end: ws[ws.length - 1].end, words: ws,
              before: a ? l.words[a - 1].end : (i ? lines[i - 1].end : 0),
              after: l.words[b + 1] ? l.words[b + 1].start : (lines[i + 1] ? lines[i + 1].start : null) });
});
const cuts = segs.filter(cutIt).map((l) => {
  // the start: the latest quiet stretch (30 ms) that ends before the first word
  let start = null;
  for (let t = l.start - 0.08; t >= l.start - 0.6 && t >= 0; t -= STEP) {
    if (!quiet(t, 0.03)) continue;
    start = t;
    while (start - STEP >= t - ROOM && start - STEP >= 0 && quiet(start - STEP, STEP)) start -= STEP;
    break;
  }
  if (start == null) start = l.start - 0.18;
  if (l.before) start = Math.max(start, l.before + 0.06);
  start = Math.max(0, start);
  // the end: once the take has stayed quiet for HUSH after the last word
  const limit = l.after != null ? l.after : l.end + 1.5;
  let end = null, hush = null;
  for (let t = l.end; t < limit; t += STEP) {
    if (!quiet(t, HUSH)) continue;
    hush = t; end = t + POST;
    // (but not into a breath or a sound that comes after the quiet)
    for (let u = t + HUSH; u < t + POST; u += STEP) if (!quiet(u, STEP)) { end = u - 0.03; break; }
    break;
  }
  if (end == null) for (let t = l.end; t < limit; t += STEP) {
    if (!quiet(t, 0.05)) continue;
    let u = t; while (u < t + POST && quiet(u, STEP)) u += STEP;
    hush = t; end = u - 0.02;
    break;
  }
  if (end == null) end = l.end + POST;
  // and never into the sound that follows
  if (l.after != null) end = Math.min(end, l.after - 0.08);
  end = Math.max(end, l.end + 0.06);
  // true silence after the fade, so every clip ends on POST of quiet
  const pad = hush != null ? Math.max(0, hush + POST - end) : 0;
  return { id: l.id, start, end, pad, words: snapped(l.words, start) };
});

const timings = (() => { try { return JSON.parse(fs.readFileSync(path.join(VO, 'word-timings.json'), 'utf8')); } catch (e) { return {}; } })();
/* how loud a stretch of the take is (integrated LUFS) and its peak (dBFS) */
function levelOf(a, b) {
  const r = require('node:child_process').spawnSync('ffmpeg', ['-hide_banner', '-ss', a.toFixed(3), '-t', (b - a).toFixed(3), '-i', wav,
                                                               '-af', 'ebur128=peak=sample', '-f', 'null', '-'], { encoding: 'utf8' });
  const log = r.stderr || '';
  const I = /I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(log), P = /Peak:\s+(-?[\d.]+) dBFS/.exec(log.slice(log.lastIndexOf('Summary')));
  return { lufs: I ? parseFloat(I[1]) : null, peak: P ? parseFloat(P[1]) : null };
}
const takeLevel = master ? levelOf(0, pcm.length / 44100) : null;
const centre = takeLevel && takeLevel.lufs != null ? TARGET - takeLevel.lufs : -2;
cuts.forEach((c) => {
  const dur = c.end - c.start, out = dur / TEMPO;
  const lv = levelOf(c.start, c.end);
  let gain = lv.lufs == null ? TARGET + 18.4 : master ? (TARGET - lv.lufs) * MATCH + centre * (1 - MATCH) : (TARGET - lv.lufs) * MATCH;
  gain = Math.max(-MAX_DB + centre, Math.min(MAX_DB + centre, gain));   // (around the take's own offset: -2 dB for the old one)
  if (lv.peak != null) gain = Math.min(gain, PEAK_DB - lv.peak);
  c.gain = gain; c.lufs = lv.lufs;
  const af = (STRETCH ? STRETCH + ',' : '') + 'volume=' + gain.toFixed(2) + 'dB,afade=t=in:st=0:d=0.015,afade=t=out:st=' + Math.max(0, out - 0.06).toFixed(3) + ':d=0.06' +
             (c.pad > 0.005 ? ',apad=pad_dur=' + (c.pad / TEMPO).toFixed(3) : '');
  const common = ['-ss', c.start.toFixed(3), '-t', dur.toFixed(3), '-i', wav, '-af', af, '-ac', '1'];
  ff(common.concat(['-c:a', 'libopus', '-b:a', '40k', '-vbr', 'on', '-application', 'voip', path.join(VO, c.id + '.ogg')]));
  timings[c.id] = c.words.map((w) => Math.max(0, Math.round((w.start - c.start) * 1000 / TEMPO - w.lead)));
  c.snaps = c.words.filter((w) => !w.lead).length;
  console.log(c.id.padEnd(6) + ' ' + c.start.toFixed(2).padStart(7) + ' +' + (out + c.pad / TEMPO).toFixed(2) + 's  first word at ' +
              timings[c.id][0] + ' ms, ' + timings[c.id].length + ' words (' + c.snaps + ' on their onset), ' +
              (c.gain >= 0 ? '+' : '') + c.gain.toFixed(1) + ' dB from ' + c.lufs + ' LUFS');
});
if (!KEEP_OTHERS) {
  const made = new Set(cuts.map((c) => c.id)), gone = [];
  fs.readdirSync(VO).forEach((f) => {
    const m = /^(p\d.+)\.(mp3|ogg)$/.exec(f);
    if (!m || made.has(m[1])) return;
    fs.unlinkSync(path.join(VO, f)); if (gone.indexOf(m[1]) < 0) gone.push(m[1]);
  });
  Object.keys(timings).forEach((k) => { if (/^p\d/.test(k) && !made.has(k)) delete timings[k]; });
  if (gone.length) console.log('\nlesson clips not in the take, removed: ' + gone.sort().join(' '));
}
const sorted = {}; Object.keys(timings).sort().forEach((k) => { sorted[k] = timings[k]; });
fs.writeFileSync(path.join(VO, 'word-timings.json'), JSON.stringify(sorted, null, 2) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(cuts.length + ' clips cut from ' + rel(SRC) + '; word starts in assets/vo/word-timings.json');
execFileSync(process.execPath, [path.join(__dirname, 'build-vo-index.js')], { stdio: 'inherit' });
