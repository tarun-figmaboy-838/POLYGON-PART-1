// PART 2 AT EVERY SIZE IT HAS TO SURVIVE.
import { test, expect } from '@playwright/test';
import { boot, waitState, jsErrors } from './helpers.mjs';

const SIZES = [
  { name: '1920x1080', w: 1920, h: 1080 },
  { name: '1366x768', w: 1366, h: 768 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: 'phone landscape', w: 844, h: 390 }
];

/** Drop onto Part 2 crossing `n` (1-based) with the slab live. */
async function enterCrossing(page, n) {
  await page.evaluate(i => {
    const g = window.iceAgeGame, G = g.debug();
    G.phase = 0; G.phasesDone = 3; G.l1 = null; G.gapsThisPhase = null;
    G.p2i = i; G.l2 = null; G.gapA = null; G.gapB = null;
    g._force('GLACIER_BREAK_2');
  }, n - 1);
  await waitState(page, ['LEVEL_2_ACTIVE'], 60_000);
  await page.waitForTimeout(700);          // let the handles fade up
}

for (const s of SIZES) {
  test.describe(`Part 2 at ${s.name}`, () => {
    test.setTimeout(240_000);

    test('the stage keeps 16:9 and fits the window', async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await boot(page);
      const r = await page.evaluate(() => {
        const b = document.getElementById('stage').getBoundingClientRect();
        return { w: b.width, h: b.height, right: b.right, bottom: b.bottom };
      });
      expect(Math.abs(r.w / r.h - 16 / 9), 'the stage is 16:9').toBeLessThan(0.02);
      expect(r.w).toBeLessThanOrEqual(s.w + 1);
      expect(r.h).toBeLessThanOrEqual(s.h + 1);
    });

    for (const n of [1, 2, 3]) {
      test(`crossing ${n}: the slab and its handles stay on the stage`, async ({ page }) => {
        await page.setViewportSize({ width: s.w, height: s.h });
        const errors = await boot(page, { speed: 900, fast: 4 });
        await enterCrossing(page, n);
        const r = await page.evaluate(() => {
          const g = window.iceAgeGame;
          const c = g._l2().corners;
          const xs = c.map(q => q.x), ys = c.map(q => q.y);
          return {
            left: Math.min(...xs), right: Math.max(...xs),
            top: Math.min(...ys), bottom: Math.max(...ys),
            boardBottom: (() => {
              const st = document.getElementById('stage').getBoundingClientRect();
              const ins = document.getElementById('instruction').getBoundingClientRect();
              return (ins.bottom - st.top) / st.height * 1080;
            })()
          };
        });
        const PAD = 20;                       // the handle's reach past its corner
        expect(r.top - PAD, 'the top handles clear the question board')
          .toBeGreaterThan(r.boardBottom);
        expect(r.bottom + PAD, 'the bottom handles are on the stage').toBeLessThan(1080);
        expect(r.left - PAD, 'the left handles are on the stage').toBeGreaterThan(0);
        expect(r.right + PAD, 'the right handles are on the stage').toBeLessThan(1920);
        expect(jsErrors(errors), 'the game threw').toEqual([]);
      });
    }

    test('crossing 1 can still be cut with a real drag', async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      const errors = await boot(page, { speed: 900 });
      await enterCrossing(page, 1);
      const box = await page.locator('#stage').boundingBox();
      const c = await page.evaluate(() => window.iceAgeGame._l2().corners);
      const at = i => ({
        x: box.x + c[i].x / 1920 * box.width,
        y: box.y + c[i].y / 1080 * box.height
      });
      const a = at(0), b = at(3);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let k = 1; k <= 10; k++) {
        await page.mouse.move(a.x + (b.x - a.x) * k / 10, a.y + (b.y - a.y) * k / 10);
      }
      await page.mouse.up();
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        state: window.iceAgeGame.state(), attempts: window.iceAgeGame.debug().attempts
      }));
      expect(after.attempts, 'the drag was read').toBeGreaterThan(0);
      expect(['LEVEL_2_SUCCESS', 'BRIDGE_2_COMPLETE', 'RUN_SEGMENT_2'],
        'the cut was accepted').toContain(after.state);
      expect(jsErrors(errors), 'the game threw').toEqual([]);
    });

    test('the question board stays a small share of the stage', async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await boot(page, { speed: 900, fast: 4 });
      await enterCrossing(page, 1);
      const share = await page.evaluate(() => {
        const st = document.getElementById('stage').getBoundingClientRect();
        const ins = document.getElementById('instruction').getBoundingClientRect();
        return (ins.width * ins.height) / (st.width * st.height);
      });
      expect(share, 'the board covers under 12% of the stage').toBeLessThan(0.12);
    });
  });
}
