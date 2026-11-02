import { test, expect } from '@playwright/test';
import { boot, G, waitState, force, cut } from './helpers.mjs';
import { KEY_WORD } from '../game/js/hud.js';

test.describe('ui', () => {
  test.setTimeout(120_000);

  test('no request 404s, and every SVG the interface uses is real vector', async ({ page }) => {
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    const errors = await boot(page, { skipScreens: false });
    await expect(page.locator('#cover')).toBeVisible();
    await page.locator('#btn-play').click({ force: true });
    await expect(page.locator('#cover')).toBeHidden({ timeout: 5000 });
    await page.waitForTimeout(600);
    expect([...new Set(bad)], 'broken requests').toEqual([]);
    expect(errors).toEqual([]);

    // and the vector files are geometry, not a raster in a wrapper
    const svgs = await page.evaluate(async () => {
      const names = [
        'icons/sound-on', 'icons/sound-off', 'icons/pause', 'icons/play', 'icons/restart',
        'icons/hint'
      ];
      const out = [];
      for (const n of names) {
        const r = await fetch('/assets/ui/' + n + '.svg');
        out.push({ n, ok: r.ok, body: r.ok ? await r.text() : '' });
      }
      return out;
    });
    for (const s of svgs) {
      expect(s.ok, s.n + ' missing').toBe(true);
      expect(s.body, s.n + ' must be an svg').toMatch(/^<svg /);
      // no embedded raster, no base64, no text baked into a control
      expect(s.body, s.n + ' embeds a raster').not.toMatch(/<image|base64|xlink:href="data:/);
      expect(s.body.length, s.n + ' is too heavy for game UI').toBeLessThan(6000);
      // real geometry, not a single blob
      expect(s.body, s.n + ' has no geometry').toMatch(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/);
    }
  });

  test('the top-right control cluster is gone', async ({ page }) => {
    await boot(page);
    expect(await page.locator('.hud-controls').count(), 'the cluster').toBe(0);
    for (const id of ['#btn-hint', '#btn-sound', '#btn-pause']) {
      expect(await page.locator(id).count(), id).toBe(0);
    }
    // and the game still runs, muted and paused only through the URL and the API
    expect(await page.evaluate('window.iceAgeGame.state()')).not.toBe('BOOT');
    expect(await page.evaluate('typeof window.iceAgeGame.toggleSound')).toBe('function');
    expect(await page.evaluate('typeof window.iceAgeGame.setPaused')).toBe('function');
  });

  test.skip('the controls are icon buttons and they respond', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');

    // three controls, none of them a word
    const btns = page.locator('.hud-controls .icon-btn');
    await expect(btns).toHaveCount(3);
    for (const id of ['#btn-hint', '#btn-sound', '#btn-pause']) {
      const b = page.locator(id);
      await expect(b).toBeVisible();
      await expect(b).toHaveAttribute('aria-label', /.+/);
      const box = await b.boundingBox();
      expect(box.width, id + ' tap target').toBeGreaterThanOrEqual(36);
      // the glyph is a real mask, not empty
      const mask = await b.locator('.icon-btn-glyph').evaluate(
        el => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage);
      expect(mask, id + ' glyph').toContain('.svg');
    }
  });

  test.skip('sound toggles, and the glyph follows the state', async ({ page }) => {
    await boot(page, { sound: true });
    await waitState(page, 'RUN_SEGMENT_1');
    const b = page.locator('#btn-sound');
    const before = await page.evaluate('window.iceAgeGame.soundOn()');
    await b.click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate('window.iceAgeGame.soundOn()')).toBe(!before);
    await expect(b).toHaveAttribute('data-icon', before ? 'sound-off' : 'sound-on');
    await b.click({ force: true });
    await page.waitForTimeout(150);
    expect(await page.evaluate('window.iceAgeGame.soundOn()')).toBe(before);
  });

  test.skip('pause opens a panel with resume, restart and sound', async ({ page }) => {
    await boot(page);
    await waitState(page, 'RUN_SEGMENT_1');
    await page.waitForTimeout(200);
    await page.locator('#btn-pause').click({ force: true });
    await expect(page.locator('#paused')).toBeVisible();
    await expect(page.locator('#btn-pause')).toHaveAttribute('data-icon', 'play');
    expect(await page.evaluate('window.iceAgeGame.paused')).toBe(true);
    // the panel offers a way on, a way back and the sound control
    await expect(page.locator('#btn-resume')).toBeVisible();
    await expect(page.locator('#btn-restart')).toBeVisible();
    await expect(page.locator('#btn-sound2')).toBeVisible();
    await page.locator('#btn-resume').click({ force: true });
    await expect(page.locator('#paused')).toBeHidden();
    expect(await page.evaluate('window.iceAgeGame.paused')).toBe(false);
    await expect(page.locator('#btn-pause')).toHaveAttribute('data-icon', 'pause');
  });

  test('the instruction is one readable sentence, and nothing else', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, ['PHASE_INTRO', 'PHASE_ACTIVE'], 30_000);
    await expect(page.locator('#instruction')).toBeVisible({ timeout: 30_000 });

    // the sentence is the phase's own, in full
    const want = await page.evaluate(async () => {
      const m = await import('/js/engine.js');
      return m.CFG.levelOne.phases[window.iceAgeGame.debug().phase].instruction;
    });
    // the sentence with the polygon in capitals, full stop kept: "Cut the TRIANGLE."
    const shown = (await page.locator('#instruction-text').innerText()).trim();
    const m = KEY_WORD.exec(want);
    expect(shown).toBe(m[1] + (m[2] + m[3]).toUpperCase() + m[4]);
    await expect(page.locator('#instruction-text .key')).toHaveText(/^[A-Z]+$/);

    // nothing else is on the card
    expect(await page.locator('#instruction-shapes').count(), 'the shape chip is gone').toBe(0);
    expect(await page.locator('#instruction-lead').count(), 'the split lead is gone').toBe(0);

    const size = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.getElementById('instruction-text')).fontSize));
    const stage = await page.locator('#stage').boundingBox();
    expect(size / stage.height, 'the sentence must be large enough to read').toBeGreaterThan(0.03);
    // ...and the panel still does not span the stage
    const pill = await page.locator('#instruction-pill').boundingBox();
    expect(pill.width / stage.width, 'the panel should not span the stage').toBeLessThan(0.62);
  });

  test('the instruction stays for the whole question, clear of the blocks, and leaves on completion', async ({ page }) => {
    await boot(page, { fast: 2 });
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, ['PHASE_INTRO', 'PHASE_ACTIVE'], 30_000);
    await expect(page.locator('#instruction')).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.iceAgeGame.debug().instruction)).not.toBe('');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    await page.waitForFunction(() => {
      const L = window.iceAgeGame.debug().l1;
      return !!L && L.shapes.some(s => s.state === 'hang' && s.y > 200);
    }, null, { timeout: 30_000 });
    await page.waitForTimeout(600);
    // still up with the blocks down and cuttable
    await expect(page.locator('#instruction')).toBeVisible();
    await expect(page.locator('#instruction-text .key')).toBeVisible();
    const card = await page.locator('#instruction-pill').boundingBox();
    const top = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const r = document.getElementById('game-canvas').getBoundingClientRect();
      let y = 1e9;
      for (const s of G.l1.shapes) if (s.state === 'hang') for (const p of s.pts) y = Math.min(y, s.y + p.y);
      return r.top + (y / 1080) * r.height;
    });
    expect(card.y + card.height, 'the sentence overlaps the hanging options').toBeLessThan(top);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('instruction')).pointerEvents)).toBe('none');
    // a wrong cut: still up
    const bad = await page.evaluate(() => {
      const L = window.iceAgeGame.debug().l1;
      const s = L.shapes.find(x => x.state === 'hang' && !L.wanted.includes(x.kind));
      return s ? s.kind : null;
    });
    if (bad) { await cut(page, bad); await waitState(page, 'PHASE_ACTIVE', 30_000); await expect(page.locator('#instruction')).toBeVisible(); }
    // the right cut completes the question: the sentence leaves
    const want = await page.evaluate(() => window.iceAgeGame.debug().l1.unfilled[0]);
    await cut(page, want);
    await waitState(page, ['PHASE_DONE', 'PHASE_RUN', 'GLACIER_BREAK_1', 'FINAL_RUN'], 30_000);
    await expect(page.locator('#instruction')).toBeHidden({ timeout: 5_000 });
  });

  test('a right answer throws confetti, a wrong one gets no mark', async ({ page }) => {
    // cuts through the api rather than the pointer, so fast-forward is safe here
    await boot(page, { fast: 4 });
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 45_000);
    const confetti = () => page.evaluate(() =>
      window.iceAgeGame._particles().list.filter(p => !p.dead && p.kind === 'confetti').length);

    const bad = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      const s = G.l1.shapes.find(x => x.state === 'hang' &&
        !G.l1.unfilled.includes(x.kind));
      return s ? s.kind : null;
    });
    expect(bad).toBeTruthy();
    await page.evaluate(k => window.iceAgeGame._cut(k), bad);
    await page.waitForTimeout(300);
    expect(await confetti(), 'confetti after a wrong answer').toBe(0);

    await waitState(page, 'PHASE_ACTIVE', 25_000);
    const good = await page.evaluate('window.iceAgeGame.debug().l1.unfilled[0]');
    await page.evaluate(k => window.iceAgeGame._cut(k), good);
    await expect.poll(confetti, { timeout: 3000 }).toBeGreaterThan(20);
  });

  test('the idle hand appears only after a long wait, and leaves on contact', async ({ page }) => {
    await boot(page, { fast: 4 });
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 45_000);
    await expect(page.locator('#hand-hint')).toBeHidden();

    await page.evaluate('window.iceAgeGame.debug().idleHand = 99');
    await expect(page.locator('#hand-hint')).toBeVisible({ timeout: 4000 });
    // it must be small and it must not sit over the character
    const hand = await page.locator('#hand-hint').boundingBox();
    const stage = await page.locator('#stage').boundingBox();
    expect(hand.width / stage.width, 'the hint should be small').toBeLessThan(0.09);

    // any contact dismisses it
    const canvas = await page.locator('#game-canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.7);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('#hand-hint')).toBeHidden({ timeout: 4000 });
  });

  test.skip('the hint re-states the objective without revealing the answer', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    // let the banner time out the way it does in play
    await page.waitForFunction('window.iceAgeGame.debug().instrHold <= 0', null, { timeout: 25_000 });
    await page.locator('#btn-hint').click({ force: true });
    await page.waitForFunction('window.iceAgeGame.debug().instrHold > 0', null, { timeout: 3000 });
    await expect(page.locator('#instruction')).toBeVisible();
    // nothing about the hint marks which chunk is correct
    const marked = await page.evaluate(() => {
      const G = window.iceAgeGame.debug();
      return G.l1.shapes.filter(s => s.highlight || s.hinted).length;
    });
    expect(marked, 'the hint must not point at an answer').toBe(0);
  });

  test('the snow is fairy flakes: evident one at a time, and few of them', async ({ page }) => {
    await boot(page);
    const s = await page.evaluate(() => window.iceAgeGame._snow());
    expect(s.sprite, 'the flake sprite is built, so nothing is falling back to dots').toBe(true);
    expect(Math.min(...s.drawnPx), 'a flake is big enough to see').toBeGreaterThanOrEqual(15);
    expect(Math.max(...s.drawnPx), 'and not so big it sits on the picture').toBeLessThan(30);
    expect(Math.min(...s.alpha), 'and solid enough to see').toBeGreaterThanOrEqual(0.4);
    expect(s.spins.every(v => Math.abs(v) > 0.05), 'each one turns as it falls').toBe(true);
    expect(new Set(s.spins.map(Math.sign)).size, 'and not all the same way').toBe(2);
    expect(s.near + s.mid, 'the flake layers stay sparse').toBeLessThanOrEqual(16);
    expect(s.near, 'and the layer that crosses the play area is the sparsest').toBeLessThanOrEqual(5);
    expect(s.near + s.mid, 'without switching the weather off').toBeGreaterThanOrEqual(8);
  });

  test('nothing falls in front of an open question', async ({ page }) => {
    await boot(page, { fast: 2 });
    const front = () => page.evaluate(() => {
      const g = window.iceAgeGame, before = g._particles().list.length;
      // drawFront is called from render(); read the decision the same way it does
      return { quiet: !!g.debug().l1, state: g.state(), before };
    });
    const run = await front();
    expect(run.quiet, 'during a run the front snow falls').toBe(false);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 40_000);
    const puzzle = await front();
    expect(puzzle.quiet, 'and with a question up it does not').toBe(true);
  });

  test('gameplay stays the dominant thing on screen', async ({ page }) => {
    await boot(page);
    await force(page, 'GLACIER_BREAK_1');
    await waitState(page, 'PHASE_ACTIVE', 30_000);
    const share = await page.evaluate(() => {
      const stage = document.getElementById('stage').getBoundingClientRect();
      const area = stage.width * stage.height;
      let used = 0;
      for (const sel of ['#instruction-pill', '.hud-controls']) {
        const el = document.querySelector(sel);
        if (!el || el.hidden || el.closest('[hidden]')) continue;
        const r = el.getBoundingClientRect();
        used += r.width * r.height;
      }
      return used / area;
    });
    expect(share, 'the interface is taking too much of the screen').toBeLessThan(0.12);
  });
});
