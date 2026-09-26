import { test, expect } from '@playwright/test';
import { boot } from './helpers.mjs';

test.describe('Part 2 voice', () => {
  test.setTimeout(120_000);

  test('all ten new lines have audio windows and one onset per displayed word', async ({ page }) => {
    await boot(page);
    const lines = await page.evaluate(async () => {
      const { CFG } = await import('/js/engine.js');
      const prompts = [...CFG.levelOne.phases, ...CFG.levelTwo.levels]
        .map(p => ({ id: p.voId, text: p.instruction }));
      prompts.push({ id: 'p2-tut-6-cut', text: 'Cut this ice block to fix the path.' });
      const audio = new AudioContext();
      const decoded = await audio.decodeAudioData(await (await fetch('/assets/audio/vo-lines.mp3')).arrayBuffer());
      await audio.close();
      return { duration: decoded.duration, prompts: prompts.map(p => ({
        ...p, window: CFG.vo.lines[p.id]
      })) };
    });
    expect(lines.prompts).toHaveLength(10);
    for (const { id, text, window: w } of lines.prompts) {
      expect(w, `${id} has speech`).toBeDefined();
      const [at, dur, onsets] = w;
      expect(at, `${id} follows the original take`).toBeGreaterThan(36);
      expect(at + dur, `${id} fits in the audio`).toBeLessThanOrEqual(lines.duration + 0.02);
      expect(onsets, `${id} has one timestamp per word`).toHaveLength(text.split(/\s+/).length);
      for (let i = 0; i < onsets.length; i++) {
        expect(onsets[i], `${id} word ${i + 1} is inside the line`).toBeGreaterThanOrEqual(0);
        expect(onsets[i]).toBeLessThan(dur);
        if (i) expect(onsets[i]).toBeGreaterThan(onsets[i - 1]);
      }
    }
  });

  test('the diagonal prompt reveals words with the spoken audio', async ({ page }) => {
    await boot(page, { sound: true });
    await page.evaluate(() => window.iceAgeGame.sfx('ui'));
    await page.waitForFunction(() => {
      const v = window.iceAgeGame._voice();
      return v.ready && v.ctx === 'running';
    }, null, { timeout: 60_000 });
    await page.evaluate(() => {
      const g = window.iceAgeGame, G = g.debug();
      G.phase = 7; G.phasesDone = 7; G.l1 = null; G.gapsThisPhase = null;
      g._force('GLACIER_BREAK_2');
    });
    const rows = await page.evaluate(async () => {
      const g = window.iceAgeGame, id = 'p2-1-diagonal';
      const words = g.voWords(id), rows = [];
      for (let i = 0; i < 300; i++) {
        const at = g.voAt(id);
        if (at >= 0 && /Cut along a diagonal/.test(document.getElementById('instruction-text').textContent)) rows.push({
          spoken: words.filter(t => t <= at + 0.025).length,
          shown: [...document.querySelectorAll('#instruction-text .iw')].filter(s => {
            const animation = s.getAnimations()[0];
            return animation && (animation.currentTime || 0) >= animation.effect.getComputedTiming().delay;
          }).length
        });
        await new Promise(resolve => setTimeout(resolve, 60));
        if (rows.length && g.voAt(id) < 0) break;
      }
      return rows;
    });
    expect(rows.length, 'the line was sampled while playing').toBeGreaterThan(8);
    expect(rows.some(r => r.shown > 0 && r.shown < 4), 'words appear individually').toBe(true);
    for (const r of rows) {
      expect(r.shown, 'text never gets ahead of speech').toBeLessThanOrEqual(r.spoken);
      expect(r.spoken - r.shown, 'no more than one slow render frame behind').toBeLessThanOrEqual(2);
    }
    expect(rows.filter(r => r.spoken - r.shown > 1).length / rows.length,
      'a two-word delay is brief').toBeLessThan(0.2);
  });
});
