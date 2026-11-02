// BAKE THE SFX ONSET TIMES INTO THE CONFIG.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const PORT = 8291;
const srv = spawn('node', ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html?skip=1`);
await page.waitForFunction('window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"', null, { timeout: 60000 });

// the loader only runs once the context is unlocked
await page.evaluate(() => window.iceAgeGame.sfx('ui'));
const hits = await page.evaluate(async () => {
  const g = window.iceAgeGame;
  const m = await import('/js/engine.js');
  const expected = Object.keys(m.CFG.sfx || {});
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const s = g._sfxTable && g._sfxTable();
    if (s && expected.every(k => s[k] && s[k].buf)) {
      const out = {};
      for (const [k, v] of Object.entries(s)) {
        out[k] = { hits: (v.hits || []).map(x => +x.toFixed(4)), dur: v.buf ? +v.buf.duration.toFixed(3) : null };
      }
      return out;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  // timed out: report what DID arrive, so a failure names the cue that is missing
  const s = (g._sfxTable && g._sfxTable()) || {};
  return { __incomplete: true, expected, got: Object.keys(s),
           withBuf: Object.keys(s).filter(k => s[k] && s[k].buf) };
});
await browser.close();
srv.kill();

if (!hits) { console.error('no sfx table came back'); process.exit(1); }
if (hits.__incomplete) {
  console.error('the decode did not finish for every cue.');
  console.error('  expected: ' + hits.expected.join(', '));
  console.error('  in table: ' + (hits.got.join(', ') || '(none)'));
  console.error('  decoded:  ' + (hits.withBuf.join(', ') || '(none)'));
  process.exit(1);
}

console.log('onsets found:');
for (const [k, v] of Object.entries(hits)) {
  console.log('  ' + k.padEnd(8) + String(v.hits.length).padStart(3) + ' hits in ' + v.dur + 's   ' +
    v.hits.slice(0, 6).join(', ') + (v.hits.length > 6 ? ' …' : ''));
}

const F = 'game/js/engine.js';
let s = readFileSync(F, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
const START = '/* BAKED-ONSETS-START */';
const END = '/* BAKED-ONSETS-END */';
const a = s.indexOf(START), b = s.indexOf(END);
if (a < 0 || b < 0) {
  console.error('markers not found in ' + F + ' — expected ' + START + ' … ' + END);
  process.exit(1);
}

const lines = Object.entries(hits)
  .filter(([, v]) => v.hits.length)
  .map(([k, v]) => '  ' + k + ': [' + v.hits.join(', ') + '],');

const block = START + NL +
  'export const SFX_HITS = {' + NL + lines.join(NL) + NL + '};' + NL +
  END;

writeFileSync(F, s.slice(0, a) + block + s.slice(b + END.length));
console.log('\nwrote ' + lines.length + ' cues into ' + F + ' between the markers');
console.log('now rebuild the bundle:  node tools/build-bundle.mjs');
