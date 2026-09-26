/* Append generated Part 2 speech to the original take, preserving every old window.
 * The timing manifest was captured from SpeechSynthesizer.SpeakProgress during generation. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(import.meta.dirname, '..');
const src = path.join(root, 'art-source/audio-source/vo-lines-take-2026-09-10.mp3');
const dir = path.join(root, 'art-source/audio-source/part2-vo');
const rows = JSON.parse(fs.readFileSync(path.join(dir, 'timings.json'), 'utf8').replace(/^\uFEFF/, ''));
const rate = 44100;
const gap = Buffer.alloc(Math.round(rate * 0.65) * 2);
function run(args, input) {
  const p = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], {
    input, maxBuffer: 40 * 1024 * 1024
  });
  if (p.status !== 0) throw new Error(p.stderr.toString());
  return p.stdout;
}
function pcm(file) {
  return run(['-i', file, '-ac', '1', '-ar', String(rate), '-f', 's16le', '-']);
}
function voicedLevel(buffer) {
  const s = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
  const window = 441, powers = [];
  for (let at = 0; at + window <= s.length; at += window) {
    let power = 0;
    for (let i = 0; i < window; i++) power += s[at + i] ** 2;
    const rms = Math.sqrt(power / window);
    if (rms > 260) powers.push(rms);
  }
  powers.sort((a, b) => a - b);
  return powers[Math.floor(powers.length * 0.6)];
}
function gain(buffer, factor) {
  const result = Buffer.from(buffer);
  for (let i = 0; i < result.length; i += 2) {
    const n = Math.max(-32768, Math.min(32767, Math.round(result.readInt16LE(i) * factor)));
    result.writeInt16LE(n, i);
  }
  return result;
}

const original = pcm(src);
const takes = rows.map(row => pcm(path.join(root, row.file)));
const originalLevel = voicedLevel(original);
const generatedLevel = voicedLevel(Buffer.concat(takes));
const factor = Math.max(0.5, Math.min(1.8, originalLevel / generatedLevel));
let samples = original.length / 2;
const parts = [original, gap];
samples += gap.length / 2;
const windows = [];
rows.forEach((row, index) => {
  const take = takes[index];
  windows.push({ id: row.id, text: row.text,
    at: +(samples / rate).toFixed(3), dur: +(take.length / 2 / rate).toFixed(3),
    words: row.words.map(word => +word.at.toFixed(3)) });
  parts.push(gain(take, factor));
  samples += take.length / 2;
  if (index < rows.length - 1) { parts.push(gap); samples += gap.length / 2; }
});
const all = Buffer.concat(parts);
const input = ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', '-'];
const audioDir = path.join(root, 'game/assets/audio');
run([...input, '-c:a', 'libmp3lame', '-b:a', '128k', path.join(audioDir, 'vo-lines.mp3')], all);
run([...input, '-c:a', 'libvorbis', '-q:a', '4', path.join(audioDir, 'vo-lines.ogg')], all);
fs.writeFileSync(path.join(dir, 'windows.json'), JSON.stringify(windows, null, 2) + '\n');
console.log(`Appended ${rows.length} lines at ${factor.toFixed(2)}x gain. ${windows.length} windows through ${(samples / rate).toFixed(2)}s.`);
for (const w of windows) console.log(`${w.id}: [${w.at}, ${w.dur}, [${w.words.join(', ')}]]`);
