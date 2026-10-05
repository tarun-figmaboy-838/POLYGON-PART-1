/* THE PROGRESS TRAIL IS GONE (the user: "remove the left side progress bar").
 *
 * The journey card that sat in the sky at the top left — Momo, nine stones and the cave —
 * was taken out of the game on request, and since then its markup, its code and its styles have
 * gone too (hud.js). This checks that nothing brings it back as the game runs, into a crossing
 * and its question. The tests that measured the card's
 * proportions, its whoosh and its ?panel editor went with it. */
import { test, expect } from '@playwright/test';
import { boot } from './helpers.mjs';

test.setTimeout(240000);

test('the progress trail never shows', async ({ page }) => {
  await boot(page);
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const s = await page.evaluate(() => {
      const t = document.getElementById('trail');
      const r = t ? t.getBoundingClientRect() : null;
      return {
        state: window.iceAgeGame && window.iceAgeGame.state && window.iceAgeGame.state(),
        hidden: !t || t.hidden,
        w: r ? Math.round(r.width) : 0,
        built: document.querySelectorAll('#trail-rail .trail-node, #trail-rail .trail-goal').length
      };
    });
    seen.add(s.state);
    expect(s.hidden, 'hidden at ' + s.state).toBe(true);
    expect(s.w, 'no box at ' + s.state).toBe(0);
    expect(s.built, 'nothing built into it at ' + s.state).toBe(0);
    await page.waitForTimeout(750);
  }
  console.log('states seen:', [...seen].join(' '));
  expect(seen.size, 'the game moved on while it was watched').toBeGreaterThan(1);
});
