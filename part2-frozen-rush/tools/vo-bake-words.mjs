// BAKE PER-WORD TIMINGS FOR THE VOICE-OVER.
import fs from 'node:fs';
import { decode, envelope, words as splitWords, HOP, SR } from './vo-words.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAKE = arg('--take', 'game/assets/audio/vo-lines.ogg');
const WRITE = process.argv.includes('--write');

const TEXT = {
  'tut-1-meet': 'This is Momo. He needs to find his friend.',
  'tut-2-goal': 'Help Momo cross the Frozen Pass!',
  'tut-3-watch': 'Watch out!',
  'tut-4-jump': 'Tap to jump over obstacles.',
  'tut-5-broken': 'Oh no! The path is broken.',
  'tut-6-use': 'Use the right ice piece to fix the path.',
  'tut-7-fit': 'Perfect fit! Keep going!',
  'sign-triangle': 'Cut the triangle.',
  'sign-quadrilateral': 'Cut the quadrilateral.',
  'sign-pentagon': 'Cut the pentagon.',
  'sign-hexagon': 'Cut the hexagon.',
  'sign-heptagon': 'Cut the heptagon.',
  'sign-pentagons': 'Cut all the pentagons.',
  'sign-hexagons': 'Cut all the hexagons.'
};

const P = 'game/js/engine.js';
const raw = fs.readFileSync(P, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.split('\r\n').join('\n');

/* the shipped windows, exactly as the engine reads them */
const windows = [...s.matchAll(/'((?:tut|sign)-[a-z0-9-]+)':\s*\[\s*([\d.]+),\s*([\d.]+)/g)]
  .map(m => ({ id: m[1], at: +m[2], dur: +m[3] }));
if (!windows.length) { console.error('no vo windows found in ' + P); process.exit(2); }

const env = envelope(decode(TAKE));
const frameOf = t => Math.max(0, Math.min(env.length - 1, Math.round(t / (HOP / SR))));

const out = [];
console.log('take ' + TAKE + '  (' + (env.length * 0.01).toFixed(2) + 's)\n');
console.log('  id                    at    dur   n   word offsets');
for (const w of windows) {
  const text = TEXT[w.id];
  if (!text) { console.error('no script text for ' + w.id); process.exit(2); }
  const list = text.trim().split(/\s+/).filter(Boolean);
  const a = frameOf(w.at), b = frameOf(w.at + w.dur);

  const inWin = Array.from(env.slice(a, b + 1));
  const peak = Math.max(...inWin);
  let sa = a; while (sa < b && env[sa] < peak * 0.08) sa++;
  let sb = b; while (sb > sa && env[sb] < peak * 0.08) sb--;

  const onsets = splitWords(env, sa, sb, list.length);
  if (onsets.length !== list.length) {
    console.error('\n' + w.id + ': found ' + onsets.length + ' onsets for ' + list.length +
      ' words — the envelope does not separate them. Nothing written.');
    process.exit(2);
  }
  const rel = onsets.map(f => +Math.max(0, f * 0.01 - w.at).toFixed(2));
  out.push({ ...w, rel, list });
  console.log('  ' + w.id.padEnd(20) + ' ' + w.at.toFixed(2).padStart(5) + ' ' + w.dur.toFixed(2).padStart(6) +
    '  ' + String(list.length).padStart(2) + '   ' + rel.map(v => v.toFixed(2)).join(' '));
}

/* the checks a person would do by eye */
for (const r of out) {
  for (let i = 1; i < r.rel.length; i++) {
    if (r.rel[i] <= r.rel[i - 1]) throw new Error(r.id + ': word ' + i + ' (' + r.list[i] + ') does not come after ' + r.list[i - 1]);
  }
  if (r.rel[r.rel.length - 1] > r.dur) throw new Error(r.id + ': the last word starts after the clip ends');
}
console.log('\nchecked: every word starts after the one before it, and inside its own clip');

if (!WRITE) { console.log('\n(report only — pass --write to put these in engine.js)'); process.exit(0); }

let n = 0;
for (const r of out) {
  const re = new RegExp("('" + r.id + "':\\s*)\\[[^\\][]*(?:\\[[^\\]]*\\])?[^\\][]*\\]");
  if (!re.test(s)) throw new Error('no window for ' + r.id + ' in engine.js');
  s = s.replace(re, "$1[" + r.at.toFixed(2) + ", " + r.dur.toFixed(2) + ", [" + r.rel.map(v => v.toFixed(2)).join(', ') + "]]");
  n++;
}
fs.writeFileSync(P, crlf ? s.split('\n').join('\r\n') : s);
console.log('wrote ' + n + ' windows with per-word timings into ' + P);
