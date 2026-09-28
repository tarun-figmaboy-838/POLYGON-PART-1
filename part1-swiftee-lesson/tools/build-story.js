#!/usr/bin/env node
/*!
 * build-story.js — the five story paintings, as the game loads them.
 *
 *   node tools/build-story.js
 *
 *   reads   assets/source/story/scene1-friends.png … scene5-the-way.png   (the supplied art)
 *   writes  assets/story/scene-<n>.webp        the painting, at its own 1672 x 941
 *           assets/story/scene-<n>-around.webp the painting mirrored out past its edges and
 *                                              blurred, small: what the band shows (below)
 *           src/story/story-art.js             the list the game reads, with a ?v= hash on each
 *
 * THE SUPPLIED FILES, AND WHICH SCENE EACH IS. They arrived as five "ChatGPT Image
 * Sep 28, 2026 at …" PNGs whose times do not run in story order, so they were matched to
 * the script by what they show and renamed for it:
 *   01_24_28 PM  scene1-friends      Momo and Popo face each other, deciding what to do
 *   01_24_45 PM  scene2-snacks       the basket in Momo's trunk, Popo pointing on ahead
 *   01_32_40 PM  scene3-signpost     FROZEN PASS / Shortest Route, Snowy Ridge / Longer Route
 *   01_32_22 PM  scene4-frozen-pass  the ice cave, polygons hanging on brown ropes
 *   01_31_49 PM  scene5-the-way      the whole icy route, wide
 * Nothing in the paintings is changed: no text is drawn on them, nothing is retouched.
 *
 * WEBP AT 82, NOT THE PNG. The paintings are 1.9-2.4 MB each as PNG, which is most of a
 * minute on a school line for the first thing the child sees after Start. Lossy WebP at
 * this quality keeps the fur and the ice grain and is about a tenth of the size.
 *
 * THE BAND. The story is a 16:9 picture fitted inside the window like the lesson, so a
 * 4:3 tablet or a wide phone leaves a strip it does not reach. The strip is the painting
 * carried on past its own edge: mirrored outward from the edge (so the colour at the join
 * is the picture's own, pixel for pixel), then blurred, so it reads as the same scene out
 * of focus. Built here once, small — it is blurred, so a quarter of the size loses nothing
 * — and drawn under the picture, lined up with it; no filter runs in the page.
 *   Tried first and dropped: a blurred copy of the whole painting scaled to cover the window
 * (it cannot line up with the sharp one, so a line showed at the join), and the edge rows
 * stretched outward (every row became a streak: stripes down the sides of a phone).
 * AROUND is how far past each edge it reaches, in the painting's pixels: past that the band
 * would need a window over 2.8:1 or narrower than 1:1, and is plain colour.
 *
 * sharp is Part 2's (part2-frozen-rush/node_modules), as for its make-ledges tool; this
 * folder has no image library of its own.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
let sharp;
try { sharp = require('sharp'); }
catch (e) { sharp = require(path.join(ROOT, '..', 'part2-frozen-rush', 'node_modules', 'sharp')); }

const SRC = path.join(ROOT, 'assets', 'source', 'story');
const OUT = path.join(ROOT, 'assets', 'story');
const MANIFEST = path.join(ROOT, 'src', 'story', 'story-art.js');
const SCENES = ['scene1-friends', 'scene2-snacks', 'scene3-signpost', 'scene4-frozen-pass', 'scene5-the-way'];
const QUALITY = 82;
const AROUND = { x: 480, y: 380 };   // painting px mirrored out past each edge (see THE BAND)
const AROUND_K = 4;                  // built at a quarter of the size
const AROUND_BLUR = 7;               // sigma, at that size: 28 of the painting's pixels

const hash = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  const list = [];
  let w = 0, h = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const src = path.join(SRC, SCENES[i] + '.png');
    const meta = await sharp(src).metadata();
    if (!w) { w = meta.width; h = meta.height; }
    if (meta.width !== w || meta.height !== h) throw new Error(SCENES[i] + ' is ' + meta.width + 'x' + meta.height + ', not ' + w + 'x' + h);
    const n = i + 1;
    const art = path.join(OUT, 'scene-' + n + '.webp');
    const around = path.join(OUT, 'scene-' + n + '-around.webp');
    await sharp(src).removeAlpha().webp({ quality: QUALITY, effort: 6, smartSubsample: true }).toFile(art);
    // mirrored out past every edge, then shrunk and blurred (in two steps: extend and resize
    // do not chain in one sharp pipeline in the order this needs)
    const mirrored = await sharp(src).removeAlpha()
      .extend({ top: AROUND.y, bottom: AROUND.y, left: AROUND.x, right: AROUND.x, extendWith: 'mirror' })
      .png().toBuffer();
    await sharp(mirrored)
      .resize(Math.round((w + 2 * AROUND.x) / AROUND_K), Math.round((h + 2 * AROUND.y) / AROUND_K), { kernel: 'lanczos3' })
      .blur(AROUND_BLUR).webp({ quality: 72, effort: 6 }).toFile(around);
    list.push({ src: 'assets/story/scene-' + n + '.webp?v=' + hash(art), around: 'assets/story/scene-' + n + '-around.webp?v=' + hash(around) });
    console.log('scene-' + n + '.webp  ' + (fs.statSync(art).size / 1024).toFixed(0) + ' KB   around ' + (fs.statSync(around).size / 1024).toFixed(1) + ' KB   (' + SCENES[i] + ')');
  }
  const js = '/* generated by tools/build-story.js from assets/source/story — do not edit by hand */\n' +
    'window.StoryArt = ' + JSON.stringify({ w: w, h: h, around: AROUND, scenes: list }, null, 2) + ';\n';
  fs.writeFileSync(MANIFEST, js);
  console.log('src/story/story-art.js  ' + list.length + ' scenes at ' + w + 'x' + h);
})().catch((e) => { console.error(e); process.exit(1); });
