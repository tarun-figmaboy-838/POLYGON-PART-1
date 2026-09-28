/* OGG OPUS ALONGSIDE EVERY MP3.
 *
 *     node tools/make-ogg.mjs            # convert anything that has no Opus twin yet, or a stale one
 *     node tools/make-ogg.mjs --force    # convert everything again
 *
 * WHY BOTH AND NOT A SWAP. Ogg is the format the game asks for, and Opus is the codec for it:
 * under half the mp3's size across the set at the same or better quality, and no patent
 * history. Chrome, Edge, Firefox and Android play Ogg Opus; Safari plays it only lately, so a
 * swap would take the sound away from an older iPad — which in a classroom is not a rounding
 * error. So the ogg is what nearly every browser fetches and the mp3 stays as the fallback.
 * Only one of the pair is ever downloaded: engine.js `assetUrl` rewrites .mp3 to .ogg once, at
 * boot, after asking the browser whether it plays Opus in Ogg (and mp3Url is there for a
 * browser that says yes and then cannot decode one).
 *
 * THE BITRATE, BY WHAT THE FILE IS. The voice take is speech: Opus's speech mode at 40 kbps
 * mono. The music bed is 48 kbps stereo. The short effects are 64 kbps stereo. Each is tried
 * down a short ladder, and the first rate at which the Opus file is SMALLER than what it
 * replaces (the Vorbis file it succeeds, or its mp3) is kept — one that is smaller at no rate
 * keeps the file it had, which every Opus-capable browser also plays. Never a bigger file.
 *
 * Every source is already a lossy mp3, so this is a second lossy pass; Opus at these rates is
 * transparent on speech and clean on effects, and the voice windows do not move (below).
 */
import { readdirSync, statSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const DIR = 'game/assets/audio';
const force = process.argv.includes('--force');

const mp3s = readdirSync(DIR).filter(f => f.endsWith('.mp3')).sort();
if (!mp3s.length) { console.error('no mp3 under ' + DIR); process.exit(1); }

const probe = (p, entries) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', entries, '-of', 'csv=p=0', p], { encoding: 'utf8' }).stdout.trim();
const ladderFor = f => f.startsWith('vo-') ? { rates: [40, 32, 24], app: 'voip' }
                     : f.startsWith('bgm') ? { rates: [48, 40], app: 'audio' }
                     : { rates: [64, 48, 32], app: 'audio' };

let made = 0, kept = 0, before = 0, after = 0;
const refused = [];
for (const f of mp3s) {
  const src = join(DIR, f), out = src.replace(/\.mp3$/, '.ogg'), tmp = out + '.tmp.ogg';
  const srcStat = statSync(src);
  const isOpus = existsSync(out) && probe(out, 'stream=codec_name') === 'opus';
  // stale means the mp3 is newer than the ogg beside it — a re-delivered take must not keep an old twin
  const fresh = !force && isOpus && statSync(out).mtimeMs >= srcStat.mtimeMs;
  const had = existsSync(out) ? statSync(out).size : Infinity;
  before += isFinite(had) ? had : 0;
  if (fresh) { kept++; after += had; console.log('  kept ' + f.replace(/\.mp3$/, '.ogg')); continue; }
  const bar = isOpus ? srcStat.size : Math.min(had, srcStat.size);
  const { rates, app } = ladderFor(f);
  let got = 0;
  for (const kb of rates) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-map', '0:a:0', '-c:a', 'libopus', '-b:a', kb + 'k',
      '-vbr', 'on', '-application', app, '-map_metadata', '-1', '-f', 'ogg', tmp], { encoding: 'utf8' });
    if (r.status !== 0) { console.error('ffmpeg failed on ' + f + '\n' + r.stderr); process.exit(1); }
    if (statSync(tmp).size < bar) { got = kb; break; }
  }
  if (!got) { refused.push(f); try { unlinkSync(tmp); } catch (e) {} after += isFinite(had) ? had : 0; continue; }
  renameSync(tmp, out);
  made++;
  const os = statSync(out).size;
  after += os;
  console.log('  made ' + f.replace(/\.mp3$/, '.ogg').padEnd(56) + (os / 1024).toFixed(0).padStart(6) + 'kB  opus ' + got + 'k  ' +
    (isFinite(had) ? Math.round(100 * os / had) + '% of the file it replaces' : ''));
}

/* Both formats have to decode to the same LENGTH, because CFG.vo.lines cuts the voice take
   into windows by the second: an encoder that padded the front would move every line. (Opus
   records its own encoder delay and every decoder trims it; this is the check that it did.) */
const dur = p => Number(probe(p, 'format=duration') || spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' }).stdout.trim());
let worst = 0, worstFile = '';
for (const f of mp3s) {
  const src = join(DIR, f), out = src.replace(/\.mp3$/, '.ogg');
  const d = Math.abs(dur(src) - dur(out));
  if (d > worst) { worst = d; worstFile = f; }
}
console.log('\n' + made + ' made, ' + kept + ' already current' + (refused.length ? ', kept as they were (no smaller at any rate): ' + refused.join(' ') : '') +
  ';  ' + (before / 1024 / 1024).toFixed(2) + 'MB ogg before -> ' + (after / 1024 / 1024).toFixed(2) + 'MB');
console.log('largest length difference between a pair: ' + worst.toFixed(3) + 's (' + worstFile + ')');
if (worst > 0.05) { console.error('A PAIR DRIFTED: the voice windows are cut by the second and would not line up.'); process.exit(1); }
