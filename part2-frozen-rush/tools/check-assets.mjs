// EVERY FILE IN game/assets, AGAINST EVERY WAY THE GAME COULD ASK FOR IT.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ASSETS = 'game/assets';
const strict = process.argv.includes('--strict');

const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

const gameSources = [
  ...walk('game/js').filter(f => f.endsWith('.js') &&
    !f.endsWith('asset-versions.js') && !f.endsWith('game.bundle.js')),
  ...walk('game/css').filter(f => f.endsWith('.css')),
  'game/index.html'
];
const toolSources = walk('tools').filter(f => f.endsWith('.mjs') && !f.endsWith('check-assets.mjs'));
const hay = gameSources.map(f => readFileSync(f, 'utf8')).join('\n');
const toolHay = toolSources.map(f => readFileSync(f, 'utf8')).join('\n');

/** Does a haystack name this file, by exact path or exact quoted basename? */
const names = (h, rel, name) => h.includes(rel) || h.includes('/' + name) ||
  h.includes("'" + name + "'") || h.includes('"' + name + '"');

const DYNAMIC = [
  { dir: 'assets/env', prefix: 'obs-', built: "engine.js: 'assets/env/obs-' + kind" },
  { dir: 'assets/option-shape', only: '.webp', built: 'option-shapes.js: one webp per polygon name' },
  { dir: 'assets/sky', prefix: '', built: 'engine.js: the sky set, keyed by time of day' },
  { ext: '.avif', twin: '.webp', built: "engine.js assetUrl(): the .webp's AVIF twin" }
];

const orphans = [], dynamic = [], toolOnly = [];
let total = 0, orphanBytes = 0;

for (const file of walk(ASSETS)) {
  if (/\.(wav|opus)$/i.test(file)) continue;
  const rel = relative('game', file).split('\\').join('/');
  const name = basename(file);
  total++;
  // the exact path, or the exact filename in quotes — nothing looser
  if (names(hay, rel, name)) continue;

  const dyn = DYNAMIC.find(d => {
    if (d.ext) {
      if (!rel.endsWith(d.ext)) return false;
      const src = rel.slice(0, -d.ext.length) + d.twin;
      return names(hay, src, basename(src));
    }
    if (d.only && !rel.endsWith(d.only)) return false;
    return rel.startsWith(d.dir + '/') && (!d.prefix || name.startsWith(d.prefix));
  });
  const size = statSync(file).size;
  if (dyn) { dynamic.push({ rel, size, by: dyn.built }); continue; }
  if (names(toolHay, rel, name)) { toolOnly.push({ rel, size }); orphanBytes += size; continue; }
  orphans.push({ rel, size });
  orphanBytes += size;
}

const kb = n => (n / 1024).toFixed(0).padStart(6) + ' KB';

console.log(`${total} assets in ${ASSETS}\n`);
if (dynamic.length) {
  console.log(`${dynamic.length} loaded by a path built at run time (not orphans):`);
  const by = {};
  for (const d of dynamic) (by[d.by] ||= []).push(d);
  for (const [built, list] of Object.entries(by)) {
    console.log(`  ${list.length} files — ${built}`);
  }
  console.log('');
}
if (toolOnly.length) {
  console.log(`${toolOnly.length} BUILD OUTPUT ONLY — a tool writes these, nothing in the game loads them:`);
  for (const o of toolOnly.sort((a, b) => b.size - a.size)) console.log(`  ${kb(o.size)}  ${o.rel}`);
  console.log('  Keep the recipe in tools/ if the art may come back; the OUTPUT does not belong here.\n');
}
if (orphans.length) {
  console.log(`${orphans.length} UNREFERENCED — nothing in the game asks for these:`);
  for (const o of orphans.sort((a, b) => b.size - a.size)) console.log(`  ${kb(o.size)}  ${o.rel}`);
  console.log('  Source art belongs in art-source/, which is outside the deployed folder.\n');
}
if (orphans.length || toolOnly.length) {
  console.log(`  ${(orphanBytes / 1024 / 1024).toFixed(2)} MB shipped for nothing.`);
} else {
  console.log('No unreferenced assets. Everything in game/assets is loaded by the game itself.');
}

if (strict && (orphans.length || toolOnly.length)) process.exit(1);
