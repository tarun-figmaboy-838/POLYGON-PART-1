import { test, expect } from '@playwright/test';
import { boot } from './helpers.mjs';

/* THE GAME IN HINDI SPEAKS HINDI (?lan=hi): its own take (game/js/vo-hi.js, assembled from the
   user's Hindi recordings by part1-swiftee-lesson/tools/build-vo-hindi.js), every word timed off
   the Hindi voice. The English take is never fetched in Hindi, and its windows are not played. */
test.describe('Part 2 voice in Hindi', () => {
  test.setTimeout(120_000);

  test('every recorded line has a Hindi window with one onset per Hindi word shown', async ({ page }) => {
    await boot(page, { query: 'lan=hi' });
    const lines = await page.evaluate(async () => {
      const { CFG } = await import('/js/engine.js');
      const I = window.I18N;
      const prompts = [...CFG.levelOne.phases, ...CFG.levelTwo.levels].map(p => ({ id: p.voId, text: p.instruction }));
      for (const k in CFG.levelTwo.hintVo) prompts.push({ id: CFG.levelTwo.hintVo[k], text: CFG.levelTwo.instructions[k] });
      const audio = new AudioContext();
      const decoded = await audio.decodeAudioData(await (await fetch('/' + CFG.vo.src)).arrayBuffer());
      await audio.close();
      return { lang: I.lang, voice: I.voice, src: CFG.vo.src, duration: decoded.duration,
               prompts: prompts.map(p => ({ ...p, shown: String(I.html(p.text)).replace(/<\/?strong>/g, ''), window: CFG.vo.lines[p.id] })) };
    });
    expect(lines.lang).toBe('hi');
    expect(lines.voice, 'Hindi is a voiced language').toBe(true);
    expect(lines.src, 'the Hindi take').toBe('assets/audio/vo-lines-hi.mp3');
    expect(lines.prompts).toHaveLength(14);
    for (const { id, shown, window: w } of lines.prompts) {
      expect(w, `${id} has Hindi speech`).toBeDefined();
      expect(shown, `${id} is shown in Hindi`).toMatch(/[ऀ-ॿ]/);
      const [at, dur, onsets] = w;
      expect(at + dur, `${id} fits in the Hindi take`).toBeLessThanOrEqual(lines.duration + 0.02);
      const words = shown.trim().split(/\s+/);
      expect(onsets, `${id}: one onset per Hindi word ("${shown}")`).toHaveLength(words.length);
      for (let i = 1; i < onsets.length; i++) {
        if (words[i - 1] === '—') expect(onsets[i]).toBeGreaterThanOrEqual(onsets[i - 1]);
        else expect(onsets[i], `${id} word ${i + 1} after word ${i}`).toBeGreaterThan(onsets[i - 1]);
      }
      expect(onsets[onsets.length - 1]).toBeLessThan(dur);
    }
  });

  test('the diagonal prompt reveals its Hindi words with the Hindi voice, and no English is fetched', async ({ page }) => {
    const asked = [];
    page.on('request', r => { if (/vo-lines/.test(r.url())) asked.push(r.url()); });
    await boot(page, { sound: true, query: 'lan=hi' });
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
        if (at >= 0 && /एक विकर्ण पर काटें/.test(document.getElementById('instruction-text').textContent)) rows.push({
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
    expect(rows.length, 'the Hindi line was sampled while playing').toBeGreaterThan(8);
    expect(rows.some(r => r.shown > 0 && r.shown < 4), 'words appear individually').toBe(true);
    for (const r of rows) {
      expect(r.shown, 'text never gets ahead of speech').toBeLessThanOrEqual(r.spoken);
      expect(r.spoken - r.shown, 'no more than one slow render frame behind').toBeLessThanOrEqual(2);
    }
    expect(asked.length, 'the take was fetched').toBeGreaterThan(0);
    expect(asked.every(u => /vo-lines-hi\.(ogg|mp3)/.test(u)), 'only the Hindi take: ' + asked.join(', ')).toBe(true);
  });

  test('the tutorial is spoken in Hindi, line by line', async ({ page }) => {
    await boot(page, { sound: true, tutorial: true, query: 'lan=hi' });
    await page.evaluate(() => window.iceAgeGame.sfx('ui'));
    await page.waitForFunction(() => {
      const v = window.iceAgeGame._voice();
      return v.ready && v.ctx === 'running';
    }, null, { timeout: 60_000 });
    // the first lines are said as the tutorial plays, each from its Hindi window
    await page.waitForFunction(() => window.iceAgeGame._voice().said.some(s => /^tut-2-goal/.test(s)), null, { timeout: 60_000 });
    const v = await page.evaluate(() => window.iceAgeGame._voice());
    const said = v.said.filter(s => /^tut-/.test(s));
    expect(said.length).toBeGreaterThan(1);
    expect(said.filter(s => /no-window|muted/.test(s)), 'every tutorial line has its Hindi window').toEqual([]);
  });
});
