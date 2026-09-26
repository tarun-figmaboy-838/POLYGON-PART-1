/* PART 2, CROSSING 2 — "Draw all the diagonals."
 *
 * The second replaced crossing, and the first with a different mechanic. The learner
 * draws EVERY diagonal of the slab rather than one; when they are all there the shape
 * is solved and splits into four pieces across two crevasses.
 *
 * The diagonals cross, leaving four triangles. Two pieces seat in each crevasse,
 * with a slot sized for each piece.
 */
import { test, expect } from '@playwright/test';
import { boot, G, waitState, jsErrors } from './helpers.mjs';

/** Drop the game onto Part 2's crossing `n` (1-based), at the moment it goes live. */
async function enterCrossing(page, n) {
  await page.evaluate(i => {
    const g = window.iceAgeGame, G = g.debug();
    G.phase = 7; G.phasesDone = 7; G.l1 = null; G.gapsThisPhase = null;
    G.p2i = i;                       // which Part 2 crossing
    // A fast boot may already be in GLACIER_BREAK_2. Leave that state first so
    // _force rebuilds the gaps and slots for this crossing's own slab.
    g._force('RUN_SEGMENT_2');
    g._force('GLACIER_BREAK_2');
  }, n - 1);
  await waitState(page, ['LEVEL_2_ACTIVE'], 60_000);
  return G(page);
}

test.describe('crossing 2 — draw all the diagonals', () => {
  test.setTimeout(180_000);

  test('it is the delivered quadrilateral, over two crevasses', async ({ page }) => {
    const errors = await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    const r = await page.evaluate(() => {
      const g = window.iceAgeGame, L = g.debug().l2;
      return {
        corners: g._l2().corners.length,
        need: L.need,
        gaps: g._l2Gaps().filter(Boolean).length,
        throat: g.debug().gapA.throat,
        mouth: g.debug().gapA.x1 - g.debug().gapA.x0
      };
    });
    expect(r.corners, 'four corners').toBe(4);
    /* A QUADRILATERAL HAS EXACTLY TWO DIAGONALS — n(n-3)/2 — and the level computes
       that from the shape rather than being told, so a different slab needs no edit. */
    expect(r.need, 'two diagonals to find').toBe(2);
    expect(r.gaps, 'two crevasses: two pieces bridge each').toBe(2);
    // and it is a real undercut crevasse, not the flat box the first attempt drew
    expect(r.mouth, 'the mouth flares wider than the neck').toBeGreaterThan(r.throat);
    expect(r.mouth, 'and is too wide to jump').toBeGreaterThan(400);
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('one diagonal is not enough — the crossing stays open', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    await page.evaluate(() => window.iceAgeGame._l2Cut(0, 2));
    const r = await page.evaluate(() => ({
      state: window.iceAgeGame.state(),
      drawn: window.iceAgeGame.debug().l2.drawn.length,
      pieces: window.iceAgeGame._l2().pieces
    }));
    expect(r.state, 'still being drawn on').toBe('LEVEL_2_ACTIVE');
    expect(r.drawn, 'one is recorded').toBe(1);
    expect(r.pieces, 'and nothing has been cut').toBe(0);
  });

  test('both diagonals solve it, in either order', async ({ page }) => {
    for (const order of [[[0, 2], [1, 3]], [[1, 3], [0, 2]]]) {
      await boot(page, { speed: 900, fast: 4 });
      await enterCrossing(page, 2);
      for (const [i, j] of order) {
        await page.evaluate(([a, b]) => window.iceAgeGame._l2Cut(a, b), [i, j]);
      }
      const st = await page.evaluate(() => window.iceAgeGame.state());
      expect(st, 'solved in order ' + JSON.stringify(order)).toBe('LEVEL_2_SUCCESS');
    }
  });

  /* THE SAME DIAGONAL TWICE IS NOT A MISTAKE. The learner has drawn a real diagonal and
     simply drawn it already, so it must not be counted, must not solve the level, and
     must not cost them the slab the way a side does. */
  test('the same diagonal twice counts once and costs nothing', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    await page.evaluate(() => window.iceAgeGame._l2Cut(0, 2));
    await page.evaluate(() => window.iceAgeGame._l2Cut(2, 0));   // the same line, reversed
    const r = await page.evaluate(() => ({
      state: window.iceAgeGame.state(),
      drawn: window.iceAgeGame.debug().l2.drawn.length,
      fall: !!window.iceAgeGame.debug().l2.fall,
      sign: window.iceAgeGame.debug().signSay
    }));
    expect(r.drawn, 'A-B and B-A are one diagonal').toBe(1);
    expect(r.fall, 'and it is not punished like a side').toBe(false);
    expect(r.sign.toLowerCase(), 'it says it is already done').toContain('done');
  });

  test('a side is refused and drops the slab, as on crossing 1', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    await page.evaluate(() => window.iceAgeGame._l2Cut(0, 1));   // a side
    const r = await page.evaluate(() => ({
      state: window.iceAgeGame.state(),
      drawn: window.iceAgeGame.debug().l2.drawn.length,
      badLine: window.iceAgeGame._l2().badLine
    }));
    expect(r.badLine, 'named as a side').toBe('side');
    expect(r.drawn, 'and not counted as a diagonal').toBe(0);
    // it recovers, so the crossing stays winnable
    await waitState(page, ['LEVEL_2_ACTIVE'], 40_000);
    expect(await page.evaluate(() => window.iceAgeGame._l2().corners.length)).toBe(4);
  });

  /* Four triangles floor two crevasses, two pieces and two slots in each. */
  test('the four pieces floor both crevasses, each in its own slot', async ({ page }) => {
    const errors = await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    await page.evaluate(() => { window.iceAgeGame._l2Cut(0, 2); window.iceAgeGame._l2Cut(1, 3); });
    /* READ IN THE FRAME THE BRIDGE COMPLETES. BRIDGE_2_COMPLETE clears gapA/gapB when it
       hands on to the next crossing, and at fast:4 that window can open and close between
       two polls now that the frame loop keeps real time on a slow renderer (sub-stepped,
       not capped). So the measuring happens inside the check, on every animation frame,
       and the numbers come out of the one frame where the pieces are seated. */
    const r = await (await page.waitForFunction(() => {
      const G = window.iceAgeGame.debug();
      if (G.state !== 'BRIDGE_2_COMPLETE') return false;
      const gaps = [G.gapA, G.gapB].filter(Boolean);
      const pieces = gaps.flatMap(g => g.pieces);
      const span = p => { const xs = p.pts.map(q => q.x * p.fit); return Math.max(...xs) - Math.min(...xs); };
      return {
        repaired: gaps.every(g => g.repaired),
        perGap: gaps.map(g => ({ pieces: g.pieces.length, slots: g.slots.length })),
        pieces: pieces.length,
        slots: gaps.reduce((n, g) => n + g.slots.length, 0),
        allFilled: gaps.every(g => g.slots.every(s => s.filled)),
        fits: pieces.map(p => p.fit),
        // each piece against the slot it was flown to
        cover: pieces.map(p => ({ span: span(p), slot: p.x1 - p.x0 })),
        perGapCover: gaps.map(g => ({ throat: g.throat, total: g.pieces.reduce((a, p) => a + span(p), 0) }))
      };
    }, null, { timeout: 60_000, polling: 'raf' })).jsonValue();
    expect(r.pieces, 'four triangles').toBe(4);
    expect(r.slots, 'and a slot for each').toBe(4);
    expect(r.perGap, 'two pieces in each hole').toEqual([{ pieces: 2, slots: 2 }, { pieces: 2, slots: 2 }]);
    expect(r.allFilled, 'every slot taken').toBe(true);
    expect(r.repaired, 'so the crossing is mended').toBe(true);
    // nothing was shrunk to fit — the standing rule
    for (const f of r.fits) expect(f, 'seated at the size it was cut').toBe(1);
    // each piece covers its own lane...
    for (const { span, slot } of r.cover) {
      expect(span, `a ${Math.round(span)}px piece in a ${Math.round(slot)}px slot`)
        .toBeGreaterThanOrEqual(slot - 1);
    }
    // ...and together they cover the opening, which is what makes them a floor
    for (const { total, throat } of r.perGapCover)
      expect(total, 'the pair spans its crevasse').toBeGreaterThanOrEqual(throat - 2);
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('crossing 1 leads on to crossing 2', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 1);
    expect(await page.evaluate(() => window.iceAgeGame.debug().p2i)).toBe(0);
    await page.evaluate(() => window.iceAgeGame._l2Cut(0, 3));   // solve crossing 1
    await waitState(page, ['RUN_SEGMENT_2', 'PHASE_RUN', 'FINAL_RUN'], 60_000);
    const r = await page.evaluate(() => ({
      state: window.iceAgeGame.state(), p2i: window.iceAgeGame.debug().p2i
    }));
    expect(r.state, 'it runs on to the next Part 2 crossing').toBe('RUN_SEGMENT_2');
    expect(r.p2i, 'which is crossing 2').toBe(1);
  });
});
