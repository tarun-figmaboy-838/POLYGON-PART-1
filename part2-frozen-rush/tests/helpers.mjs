// Shared helpers.

export const READY = 'window.iceAgeGame && window.iceAgeGame.state() !== "BOOT"';

/** Load the game and wait until the world exists and the loader is gone. */
export async function boot(page, { skipScreens = true, sound = false, speed = 0, fast = 0, tutorial = false, query = '' } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const q = [];
  if (skipScreens) q.push('skip=1');
  if (!sound) q.push('sound=0');
  if (speed) q.push('speed=' + speed);
  if (fast) q.push('fast=' + fast);
  q.push('tutorial=' + (tutorial ? '1' : '0'));
  if (query) q.push(query);                 // anything else, e.g. 'rs=2'
  await page.goto('/index.html' + (q.length ? '?' + q.join('&') : ''));
  await page.waitForFunction(READY, null, { timeout: 60_000 });
  return errors;
}

export const jsErrors = errors => errors.filter(e => e.startsWith('pageerror'));

/** The engine's live state object. */
export const G = page => page.evaluate('window.iceAgeGame.debug()');

/** Wait until the game reaches one of these states. */
export async function waitState(page, states, timeout = 30_000) {
  const list = Array.isArray(states) ? states : [states];
  await page.waitForFunction(
    ss => ss.includes(window.iceAgeGame.state()),
    list, { timeout, polling: 50 }
  );
  return page.evaluate('window.iceAgeGame.state()');
}

/** Force a state, the way the in-repo QA harnesses do. */
export const force = (page, s) => page.evaluate(st => window.iceAgeGame._force(st), s);

/** Slice a hanging option by shape name. */
export const cut = (page, kind) => page.evaluate(k => window.iceAgeGame._cut(k), kind);

/** Play the whole of Level 1, answering correctly, and return the state trail. */
export async function playLevelOne(page, { wrongFirst = false, budgetMs = 300_000 } = {}) {
  return page.evaluate(async opts => {
    const g = window.iceAgeGame;
    const trail = [];
    let last = '';
    const t0 = Date.now();
    const triedBad = new Set();

    while (Date.now() - t0 < opts.budgetMs) {
      const G = g.debug();
      const s = G.state;
      if (s !== last) { trail.push(s + '@' + G.phase); last = s; }

      // clear anything in the way
      for (const o of g._obstacles().list) {
        const sx = o.x - G.worldX;
        if (sx > 380 && sx < 700 && !o.passed) g.jump();
      }
      if (s === 'OBSTACLE_HIT') g.retryObstacle();

      if (s === 'LEVEL_2_ACTIVE' && G.l2) {
        const m = G.l2.mechanic;
        if (m === 'cut-diagonal') g._l2Cut(0, 3);
        else if (m === 'draw-all-diagonals') { g._l2Cut(0, 2); g._l2Cut(1, 3); }
        else if (m === 'same-vertex-diagonals') { g._l2Cut(0, 2); g._l2Cut(0, 3); }
      }

      if (s === 'PHASE_ACTIVE' && G.l1) {
        // what the phase still WANTS; any open crevasse will take it
        const target = G.l1.unfilled[0];
        if (opts.wrongFirst && !triedBad.has(G.phase)) {
          const bad = G.l1.shapes.find(x => x.state === 'hang' &&
            !G.l1.unfilled.includes(x.kind));
          if (bad) { triedBad.add(G.phase); g._cut(bad.kind); }
        } else if (target) {
          g._cut(target);
        }
      }

      if (s === 'FINAL_RUN' || s === 'COMPLETE') break;
      await new Promise(r => requestAnimationFrame(r));
    }
    const G = g.debug();
    return {
      trail, state: G.state, phase: G.phase, phasesDone: G.phasesDone,
      // so a caller can tell "the level stalled" from "we ran out of wall clock"
      timedOut: Date.now() - t0 >= opts.budgetMs
    };
  }, { wrongFirst, budgetMs });
}

export const LEVEL_ONE_OVER = ['PHASE_DONE', 'PHASE_RUN', 'RUN_SEGMENT_2', 'FINAL_RUN', 'COMPLETE'];

export async function playLevelTwo(page, { wrongFirst = false, diagonal = 0, budgetMs = 180_000 } = {}) {
  return page.evaluate(async opts => {
    const g = window.iceAgeGame;
    const trail = [];
    let last = '';
    let didWrong = false;
    const t0 = Date.now();
    const i = opts.diagonal % 3, j = i + 3;

    while (Date.now() - t0 < opts.budgetMs) {
      const G = g.debug();
      const s = G.state;
      if (s !== last) { trail.push(s); last = s; }

      for (const o of g._obstacles().list) {
        const sx = o.x - G.worldX;
        if (sx > 380 && sx < 700 && !o.passed) g.jump();
      }
      if (s === 'OBSTACLE_HIT') g.retryObstacle();

      if (s === 'LEVEL_2_ACTIVE') {
        if (opts.wrongFirst && !didWrong) {
          didWrong = true;
          g._l2Cut(0, 1);            // a side
        } else {
          g._l2Cut(i, j);            // a main diagonal: the answer
        }
      }
      if (s === 'RUN_SEGMENT_2' || s === 'PHASE_RUN' || s === 'FINAL_RUN' || s === 'COMPLETE') break;
      await new Promise(r => requestAnimationFrame(r));
    }
    const G = g.debug();
    return {
      trail, state: G.state, gaps: g._l2Gaps(), l2: g._l2(),
      timedOut: Date.now() - t0 >= opts.budgetMs
    };
  }, { wrongFirst, diagonal, budgetMs });
}
