/*!
 * story-data.js — the Momo and Popo story that opens the game, as data.
 *
 * Five scenes, in order, then the lesson. story.js plays them; nothing here runs.
 *
 * THE WORDS ARE THE SCRIPT, EXACTLY. Every `text` below is the approved script, letter for
 * letter — the curly apostrophes, the em dash in "route— through" — and is not to be tidied.
 *
 * EVERY COORDINATE IS A PIXEL OF THE PAINTING (1672 x 941, the size the art was supplied at;
 * see story-art.js). The story is drawn in that space and scaled whole to the lesson's 16:9
 * board, so a speech bubble or a hanging shape is placed once and lands on the same spot on
 * every screen. Read a coordinate off the painting and it is right here.
 *
 *   lines[]      who speaks, what, the voice clip it plays (assets/vo/<vo>.mp3; silent if
 *                there is none, paced as it is read), where it sits, and what moves as it
 *                begins (`start`) or on one of its words (`at`)
 *     parts      a long line shown in pieces one after another, split where its voice
 *                pauses; joined they must be the line word for word, or they are ignored.
 *                Never a scrap of a word or two ("Popo," alone looked like a mistake):
 *                Momo's and Popo's lines are short, and each is shown whole.
 *     key        its focus words, exactly as written in `text`, shown in colour
 *     box        { x | cx, top | bottom, w1 }: its left edge or its centre, its top or its
 *                bottom edge, and the widest its one line may run (the painting less its
 *                margins if not given). Bubbles hang by the bottom, over the speaker's head.
 *     tip        the point a speech bubble's tail reaches: the top of the speaker's head
 *   regions      parts of the painting that move: `poly` is the outline, `origin` the point
 *                it turns or stretches about, `feather` how softly its edge meets the still
 *                painting behind; `parent` nests one in another (the basket in the trunk)
 *   sway         a region that swings for as long as the scene is up (the hanging shapes)
 *   sheens       a soft light that crosses an outline once when asked (the sign, the ice);
 *                a cue's `twinkle` adds a star that flashes once at [x, y, delay]
 *   glints       small twinkles on the ice
 *   camera       a slow push, and the point it pushes toward
 *   enter        what happens once the scene has settled, before the first line
 *
 * WHY PARTS OF THE PAINTING MOVE AND NOT CUT-OUT CHARACTERS. The art is five flat
 * paintings; there are no separate layers of Momo or Popo to animate. So a character is
 * never moved off his own spot (that would uncover a second Momo painted underneath);
 * the painting itself flexes a few pixels there — a squash and stretch from the feet, a
 * basket swinging from the trunk that holds it, a rope turning about its knot — which is
 * the same picture, alive, with nothing added and nothing taken away.
 */
(function (global) {
  'use strict';

  global.StoryData = {
    scenes: [
      /* SCENE 1 — FRIENDS DISCUSS A PICNIC. They face each other; each speaks with a small
         happy bounce, Momo first (and his trunk lifts), Popo only once Momo has finished. */
      {
        id: 1,
        regions: {
          momo: { poly: [[300, 380], [420, 280], [540, 196], [680, 196], [730, 290], [744, 360], [800, 360], [872, 372], [880, 446], [862, 488], [842, 530], [806, 610], [764, 656], [700, 684], [664, 818], [240, 818], [218, 700], [246, 460]],
                  origin: [455, 806], feather: 26 },
          /* the trunk's end only: the tusk just under it must not move with it, so the
             outline runs out into the open sky above and beside the tip (where the tip
             goes, and where it was) and hugs the underside */
          trunk: { parent: 'momo', poly: [[748, 448], [754, 424], [772, 394], [804, 372], [846, 372], [874, 396], [878, 440], [860, 464], [828, 462], [804, 460], [786, 470], [764, 480]],
                   origin: [760, 452], feather: 16 },
          popo: { poly: [[1040, 330], [1105, 296], [1172, 312], [1210, 400], [1290, 490], [1298, 660], [1270, 822], [960, 822], [966, 700], [940, 620], [858, 560], [856, 478], [930, 462], [990, 410]],
                  origin: [1110, 808], feather: 26 },
          paw: { parent: 'popo', poly: [[866, 494], [896, 466], [944, 468], [966, 494], [990, 552], [1002, 604], [960, 626], [920, 590], [872, 560]],
                 origin: [962, 596], feather: 14 }
        },
        lines: [
          { who: 'narrator', vo: 'st1-narrator', box: { x: 110, top: 34 },
            // each perks up as he is named — who is who, before either speaks
            at: [{ word: 'Momo', move: 'momo', as: 'perk', after: 120 }, { word: 'Popo', move: 'popo', as: 'perk', after: 120 }],
            parts: ['It was a great day,', 'and Momo and Popo were deciding what to do.'], key: ['great', 'day,', 'Momo', 'Popo'],
            text: 'It was a great day, and Momo and Popo were deciding what to do.' },
          { who: 'momo', vo: 'st1-momo', box: { cx: 548, bottom: 196 }, tip: [648, 240],
            start: [{ move: 'momo', as: 'hop' }, { move: 'trunk', as: 'lift', after: 120 }],
            // "picnic!" — a beat — and Popo's ears go up before he has a word to say
            at: [{ word: 'picnic!', move: 'popo', as: 'perk', after: 320, sfx: 'pop', level: 0.18 }],
            key: ['picnic!'],
            text: 'Popo, let’s go for a picnic!' },
          { who: 'popo', vo: 'st1-popo', box: { cx: 1196, bottom: 296 }, tip: [1098, 338],
            start: [{ move: 'popo', as: 'hop' }, { move: 'paw', as: 'wave', after: 160 }],
            // told it is a great idea, Momo swells a little — and his trunk agrees
            at: [{ word: 'idea,', move: 'momo', as: 'proud', after: 380 }, { word: 'idea,', move: 'trunk', as: 'lift', after: 420 }],
            key: ['Great', 'idea,'],
            text: 'Great idea, Momo!' }
        ]
      },

      /* SCENE 2 — SPLIT THE JOBS (the user's new painting, scene2-ahead: Momo and Popo on the
         snow, each with a pack on his back, Popo pointing the way). Momo's snack line is back
         (the user: "add the snack dialogue that I deleted"): he hops as he claims the snacks —
         the pack on his back is where they go — then Popo speaks, with a little two-step as
         he sets off. */
      {
        id: 2,
        regions: {
          momo: { poly: [[230, 470], [330, 360], [440, 300], [560, 238], [680, 250], [740, 300], [790, 380], [790, 470], [760, 520], [700, 560], [680, 640], [650, 720], [640, 800], [220, 800], [210, 700], [215, 560]],
                  origin: [430, 796], feather: 26 },
          popo: { poly: [[1040, 470], [1070, 410], [1120, 398], [1180, 410], [1230, 470], [1330, 510], [1345, 560], [1300, 600], [1250, 700], [1260, 800], [960, 800], [965, 700], [960, 600], [980, 530]],
                  origin: [1120, 790], feather: 26 }
        },
        lines: [
          { who: 'momo', vo: 'st2-momo', box: { cx: 470, bottom: 226 }, tip: [548, 268],
            start: [{ move: 'momo', as: 'hop' }],
            // "snacks!" — a beat — Popo does a double take at the word (the cheeky one), and
            // Momo, who did not notice, stands a little taller for having thought of it
            at: [{ word: 'snacks!', move: 'popo', as: 'doubletake', after: 300 }, { word: 'snacks!', move: 'momo', as: 'proud', after: 700 }],
            key: ['snacks!'],
            text: 'I’ll bring the snacks!' },
          { who: 'popo', vo: 'st2-popo', box: { cx: 1180, bottom: 372 }, tip: [1120, 404],
            start: [{ move: 'popo', as: 'twostep' }],
            // and Momo nods along with the plan
            at: [{ word: 'spot.', move: 'momo', as: 'nod', after: 260 }],
            key: ['nice', 'spot.'],
            text: 'I’ll go ahead and find us a nice spot.' }
        ]
      },

      /* SCENE 3 — THE ROUTE CHOICE. The signs are the painting's own and are never written
         over. The camera leans in toward FROZEN PASS; on "shortest route—" the sign catches
         the light once, the sheen running the way its arrow points: toward the pass. */
      {
        id: 3,
        camera: { origin: [740, 360], to: 1.02, ms: 4600 },
        regions: {
          momo: { poly: [[300, 440], [440, 330], [590, 350], [640, 440], [690, 480], [748, 580], [746, 690], [640, 772], [580, 818], [180, 818], [170, 640], [226, 520]],
                  origin: [360, 808], feather: 24 }
        },
        sheens: {
          sign: { poly: [[594, 358], [648, 300], [720, 296], [882, 286], [884, 364], [846, 366], [846, 424], [672, 432], [668, 398], [656, 396], [650, 386]],
                  dir: 'rtl', ms: 1300, strength: 0.55 }
        },
        enter: [{ move: 'momo', as: 'bob', after: 500 }],
        lines: [
          { who: 'narrator', vo: 'st3-narrator', box: { cx: 900, top: 30 },
            // "quickly" — an overconfident little nod; the sign lights on "route—" and, a beat
            // later, he leans in to read it; "Pass." — the smallest gulp, and he recovers
            at: [{ word: 'quickly,', move: 'momo', as: 'eager', after: 150 },
                 { word: 'route—', sheen: 'sign', sfx: 'creak', sfx2: 'sparkle' },
                 { word: 'route—', move: 'momo', as: 'lean', after: 420 },
                 { word: 'Pass.', move: 'momo', as: 'gulp', after: 380 }],
            parts: ['Momo wanted to get there quickly,', 'so he took the shortest route—', 'through Frozen Pass.'],
            key: ['quickly,', 'shortest', 'route—', 'Frozen', 'Pass.'],
            text: 'Momo wanted to get there quickly, so he took the shortest route— through Frozen Pass.' }
        ]
      },

      /* SCENE 4 — THE ROUTE AHEAD. The same painting as scene 5 (the user: "use the last scene
         for the second-last too" — scene5-the-way: Momo alone with the basket, the ice blocks
         out across the water). Momo pulls up short — surprised and curious, not frightened. */
      {
        id: 4,
        regions: {
          momo: { poly: [[120, 640], [180, 560], [260, 500], [340, 472], [420, 468], [480, 520], [540, 600], [600, 660], [610, 760], [560, 830], [110, 830], [100, 740]],
                  origin: [300, 822], feather: 24 }
        },
        glints: [[820, 760, 0], [1090, 720, 1500], [1200, 660, 2900], [960, 800, 900]],
        // a slow push-in toward him while he takes it in (the brief: "a slight push-in on a
        // funny reaction … smooth return" — the scene after returns to the wide view)
        camera: { origin: [420, 640], to: 1.018, ms: 3200 },
        // he pulls up short first — a beat — looks AGAIN (the double take, with a small boing),
        // and speaks once he has taken it in
        enter: [{ move: 'momo', as: 'recoil', after: 350, sfx: 'creak', level: 0.5 }, { sfx: 'chime', after: 700, level: 0.6 }, { sfx: 'air', after: 150 },
                { move: 'momo', as: 'doubletake', after: 1400, sfx: 'boing', level: 0.22 }],
        enterHold: 1700,
        lines: [
          { who: 'momo', vo: 'st4-momo', box: { cx: 440, bottom: 430 }, tip: [420, 466],
            // "trickier" — he shrinks a touch; "time!" — and pulls himself together
            at: [{ word: 'trickier', move: 'momo', as: 'gulp', after: 220 }, { word: 'time!', move: 'momo', as: 'bob', after: 320 }],
            key: ['trickier'],
            text: 'This path looks trickier than last time!' }
        ]
      },

      /* SCENE 5 — OVER TO THE CHILD. The same wide view. On "polygons" the ice answers once —
         a light crossing the blocks of the route — and then the lesson. */
      {
        id: 5,
        camera: { origin: [900, 620], to: 1.012, ms: 8000 },
        regions: {
          momo: { poly: [[120, 640], [180, 560], [260, 500], [340, 472], [420, 468], [480, 520], [540, 600], [600, 660], [610, 760], [560, 830], [110, 830], [100, 740]],
                  origin: [300, 822], feather: 24 }
        },
        sheens: {
          block1: { poly: [[640, 700], [1000, 690], [1000, 800], [640, 830]], dir: 'ltr', ms: 900, strength: 0.7, lag: 0 },
          block2: { poly: [[1010, 690], [1180, 680], [1180, 750], [1010, 760]], dir: 'ltr', ms: 900, strength: 0.7, lag: 220 },
          block3: { poly: [[1160, 640], [1250, 635], [1250, 690], [1160, 700]], dir: 'ltr', ms: 800, strength: 0.65, lag: 400 }
        },
        enter: [{ move: 'momo', as: 'bob', after: 600 }],
        lines: [
          { who: 'narrator', vo: 'st5-narrator', box: { x: 66, top: 34, w1: 1440 },
            // "your help" — a hopeful look up at the child; nothing more until the ice answers
            // on "polygons" (the brief: the comedy stops before the hand-over to the lesson)
            at: [{ word: 'help', move: 'momo', as: 'perk', after: 200 },
                 { word: 'polygons.', sheen: ['block1', 'block2', 'block3'], sfx: 'sparkle', level: 0.45,
                   twinkle: [[820, 720, 60], [1090, 700, 260], [1200, 650, 360]] }],
            parts: ['Momo needs your help to reach Popo.', 'But first, you’ll need to learn a little more about polygons.'],
            key: ['help', 'polygons.'],
            text: 'Momo needs your help to reach Popo. But first, you’ll need to learn a little more about polygons.' }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
