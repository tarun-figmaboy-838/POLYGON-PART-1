/* THE AVIF TWINS (tools/build-avif.mjs): the same picture in fewer bytes where the browser shows
 * AVIF, the .webp everywhere else — and never both, which would cost more than either.
 *
 *   - the twins on disk are the ones the list made, from the .webp files as they are now
 *   - where the probe says AVIF, every twinned picture the run loads is fetched as its twin and
 *     its .webp is never fetched; a picture with no twin is fetched as its .webp
 *   - where it says no (?avif=0 here), the scripts' pictures are the .webp, exactly as before
 *   - a twin that will not load falls back to its .webp, and the game still plays
 *   - the cover's early warm-up asks for the PLAY button the way the stylesheet does
 */
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { boot, READY } from './helpers.mjs';

test.setTimeout(180_000);

const TWINS = JSON.parse(await readFile(resolve('tools/avif-twins.json'), 'utf8'));
// the twins the scripts load on every run (the stylesheets' own come with the screens that use them)
const WORLD = Object.keys(TWINS).filter(f => f.startsWith('assets/env/'));
const fetched = page => {
  const got = [];
  page.on('request', r => { const m = /\/(assets\/[^?#]+)/.exec(new URL(r.url()).pathname); if (m) got.push(m[1]); });
  return got;
};
const real = errors => errors.filter(e => !/Failed to load resource/.test(e));

test('the twins are the files the list made, from the pictures as they are now', async () => {
  const { problems } = await import('../tools/build-avif.mjs');
  expect(await problems(), 'run: node tools/build-avif.mjs').toEqual([]);
  expect(WORLD.length, 'the world art has twins').toBeGreaterThan(3);
});

test('where the browser shows AVIF, a twinned picture is fetched as its twin and never as its .webp', async ({ page }) => {
  const got = fetched(page);
  const errors = await boot(page);
  expect(await page.evaluate(() => window.ImgFormat && window.ImgFormat.avif), 'this browser shows AVIF').toBe(true);
  for (const webp of WORLD) {
    expect(got, webp.replace('.webp', '.avif') + ' is fetched').toContain(webp.replace('.webp', '.avif'));
    expect(got, webp + ' is not fetched as well').not.toContain(webp);
  }
  // a picture without a twin is the .webp it always was
  expect(got).toContain('assets/env/obs-log-arch.webp');
  expect(got.filter(u => u.endsWith('.avif') && !TWINS[u.replace('.avif', '.webp')]), 'no AVIF without a twin').toEqual([]);
  expect(errors).toEqual([]);
});

test('where it does not (?avif=0), the scripts fetch every picture as the .webp, as before', async ({ page }) => {
  const got = fetched(page);
  const errors = await boot(page, { query: 'avif=0' });
  expect(await page.evaluate(() => window.ImgFormat.avif)).toBe(false);
  for (const webp of WORLD) {
    expect(got, webp + ' is fetched').toContain(webp);
    expect(got, webp.replace('.webp', '.avif') + ' is not').not.toContain(webp.replace('.webp', '.avif'));
  }
  expect(errors).toEqual([]);
});

test('a twin that will not load falls back to its .webp, and the run goes on', async ({ page }) => {
  await page.route('**/assets/env/path.avif*', route => route.fulfill({ status: 404, body: 'gone' }));
  const got = fetched(page);
  const errors = await boot(page);
  expect(got).toContain('assets/env/path.avif');
  expect(got, 'the .webp is asked for instead').toContain('assets/env/path.webp');
  // the ground is built from it and the journey starts
  await page.waitForFunction(() => window.iceAgeGame.state() !== 'BOOT' && window.iceAgeGame.state() !== 'TITLE', null, { timeout: 60_000 });
  expect(real(errors)).toEqual([]);
});

test("the cover's warm-up asks for the PLAY button as the stylesheet does, once", async ({ page }) => {
  const got = fetched(page);
  const errors = await boot(page, { skipScreens: false });
  await page.waitForFunction(READY, null, { timeout: 60_000 });
  await page.waitForTimeout(500);
  expect(got).toContain('assets/ui/btn-play.avif');
  expect(got, 'and never the .webp beside it').not.toContain('assets/ui/btn-play.webp');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.btn-play-face')).backgroundImage);
  expect(bg).toContain('btn-play.avif');
  expect(errors).toEqual([]);
});
