// WHAT EACH DRAWING CROSSING WILL AND WILL NOT ACCEPT.
import { test, expect } from '@playwright/test';
import { boot, waitState, jsErrors } from './helpers.mjs';

/** Drop onto Part 2 crossing `n` (1-based) with the slab live and cuttable. */
async function enterCrossing(page, n) {
  await page.evaluate(i => {
    const g = window.iceAgeGame, G = g.debug();
    G.phase = 0; G.phasesDone = 3; G.l1 = null; G.gapsThisPhase = null;
    G.p2i = i; G.l2 = null; G.gapA = null; G.gapB = null;
    g._force('GLACIER_BREAK_2');
  }, n - 1);
  await waitState(page, ['LEVEL_2_ACTIVE'], 60_000);
}

const cut = (page, pairs) => page.evaluate(js => {
  const g = window.iceAgeGame;
  for (const [i, j] of JSON.parse(js)) g._l2Cut(i, j);
  const L = g._l2();
  return {
    state: g.state(),
    solved: !!(L && L.solved),
    wrong: L ? L.wrong : -1,
    badKind: L ? L.badLine : null,
    drawn: L ? L.drawn : null,
    origin: L ? L.origin : undefined,
    mechanic: L ? L.mechanic : null
  };
}, JSON.stringify(pairs));

test.describe('crossing 3 — two diagonals from the SAME vertex', () => {
  test.setTimeout(180_000);

  test('refuses two diagonals that share no corner', async ({ page }) => {
    const errors = await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 3);
    const r = await cut(page, [[0, 2], [1, 3]]);
    expect(r.solved, 'the slab must NOT come apart on a wrong pair').toBe(false);
    expect(r.state, 'it goes to the wrong-answer beat').toBe('LEVEL_2_WRONG_FEEDBACK');
    expect(r.badKind, 'and is refused by name, so the nudge can say why')
      .toBe('sameVertex');
    expect(r.wrong, 'the attempt is counted').toBeGreaterThan(0);
    expect(r.drawn, 'the refused line is not kept').toEqual(['0-2']);
    expect(jsErrors(errors), 'the game threw').toEqual([]);
  });

  test('refuses it the other way round too', async ({ page }) => {
    const errors = await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 3);
    const r = await cut(page, [[1, 3], [0, 2]]);
    expect(r.solved).toBe(false);
    expect(r.badKind).toBe('sameVertex');
    expect(jsErrors(errors)).toEqual([]);
  });

  for (const [name, pairs, origin] of [
    ['from the first line\'s low end', [[0, 2], [0, 3]], 0],
    ['from the first line\'s high end', [[0, 2], [2, 4]], 2]
  ]) {
    test(`accepts two diagonals ${name}`, async ({ page }) => {
      const errors = await boot(page, { speed: 900, fast: 4 });
      await enterCrossing(page, 3);
      const r = await cut(page, pairs);
      expect(r.solved, 'the slab fans on the right answer').toBe(true);
      expect(r.origin, 'and the shared corner is the one they share').toBe(origin);
      expect(r.state).toBe('LEVEL_2_SUCCESS');
      expect(jsErrors(errors)).toEqual([]);
    });
  }

  test('a repeated line is refused as a repeat, not as a wrong corner', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 3);
    const r = await cut(page, [[0, 2], [2, 0]]);
    expect(r.solved).toBe(false);
    expect(r.badKind).toBe('already');
  });
});

test.describe('crossings 1 and 2 still hold their own rules', () => {
  test.setTimeout(180_000);

  test('crossing 1 refuses a side and takes a main diagonal', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 1);
    const bad = await cut(page, [[0, 1]]);
    expect(bad.state, 'a side is not a diagonal').toBe('LEVEL_2_WRONG_FEEDBACK');
    expect(bad.badKind).toBe('side');

    await enterCrossing(page, 1);
    const good = await cut(page, [[0, 3]]);
    expect(good.state, 'the long diagonal is the answer').toBe('LEVEL_2_SUCCESS');
  });

  test('crossing 2 needs EVERY diagonal before it comes apart', async ({ page }) => {
    await boot(page, { speed: 900, fast: 4 });
    await enterCrossing(page, 2);
    const one = await cut(page, [[0, 2]]);
    expect(one.solved, 'one of two is not all of them').toBe(false);
    expect(one.state, 'and it is not a mistake either — the shape stays open')
      .toBe('LEVEL_2_ACTIVE');
    const both = await cut(page, [[1, 3]]);
    expect(both.solved, 'the second one finishes it').toBe(true);
  });
});
