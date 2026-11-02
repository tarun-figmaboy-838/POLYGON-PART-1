// screens.js — the storyboard, page by page, as data.
(function (global) {
  'use strict';

  var WRONG = [
    { juice: 'refuse', target: 'answer' },
    { sfx: 'wrong' },
    { swiftee: 'oops' },
    { wait: 400 }
  ];
  var BUZZ = [
    { juice: 'buzz', target: 'answer' },
    { sfx: 'wrong' },
    { swiftee: 'oops' },
    { wait: 400 }
  ];

  var DIAGONAL_RULE = { say: 'A diagonal connects non-adjacent vertices.', vo: 'p14r', after: 1 };

  var FEEDBACK_MS = 900;
  function correct(extra, face, o) {
    extra = extra || [];
    var sounds = extra.some(function (b) { return b && b.sfx; });
    var bursts = !!(o && o.burst === true) && !extra.some(function (b) { return b && b.juice === 'confetti'; });
    return [{ juice: 'collect', target: 'answer' }]
      .concat(sounds ? [] : [{ sfx: 'correct' }])
      .concat(bursts ? [{ juice: 'confetti', target: 'answer', count: 20, fromEdge: true }] : [])
      .concat(extra)
      .concat([{ swiftee: face || 'happySmall' }, { wait: FEEDBACK_MS }]);
  }
  function milestone(extra, face) { return correct(extra, face || 'celebrate', { burst: true }); }

  var SUMMARY = [
    { id: 'vertex',    label: 'Vertex',    text: 'A vertex is a corner where two sides meet.',                          vo: 'p37a' },
    { id: 'side',      label: 'Side',      text: 'A side is a straight line joining two vertices.',                     vo: 'p37b' },
    { id: 'angle',     label: 'Angle',     text: 'An angle is formed where two sides meet.',                            vo: 'p37c' },
    { id: 'diagonal',  label: 'Diagonal',  text: 'A diagonal joins two non-adjacent vertices.',                         vo: 'p37d' },
    { id: 'convex',    label: 'Convex',    text: 'In a convex polygon, all diagonals stay inside.',                     vo: 'p37e' },
    { id: 'concave',   label: 'Concave',   text: 'In a concave polygon, atleast one diagonal goes outside.',           vo: 'p37f' },
    { id: 'regular',   label: 'Regular',   text: 'A regular polygon has all sides and all angles equal.',               vo: 'p37g' },
    { id: 'irregular', label: 'Irregular', text: 'If the sides or angles are not all equal, the polygon is irregular.', vo: 'p37h' }
  ];
  var SUMMARY_DONE = { text: 'Amazing! You explored all these polygon ideas!', vo: 'p37i' };
  var SUMMARY_OPEN = { text: 'Let’s recall what we learned today.', vo: 'p37o' };

  function summaryBeats(list) {
    var out = [{ instruction: null }, { stage: { kind: 'summary' } }];
    out.push(
      { swiftee: 'enter', from: 'below', quick: true, to: 'middle', size: 'small' },
      { say: SUMMARY_OPEN.text, vo: SUMMARY_OPEN.vo },
      { swiftee: 'exit', to: 'below' }
    );
    list.forEach(function (c) {
      out.push(
        { stage: { summary: { card: c.id } } },            // in, and its idea shown (the beat waits for it)
        { swiftee: 'enter', from: 'below', ms: 320 },      // up from behind the card...
        { swiftee: 'present', at: 'summary.card' },        // ...presenting it
        { say: c.text, vo: c.vo, pace: 'recap' },          // the line, then a short reading pause
        { swiftee: 'exit', to: 'below' },                  // back down behind it
        { stage: { summary: { collect: c.id } } }          // into the collection; the next waits for it to land
      );
    });
    out.push(
      { wait: 400 },
      { stage: { summary: { final: true } } },
      { swiftee: 'enter', from: 'below', quick: true, to: 'middle', size: 'medium' },
      { swiftee: 'celebrate' },
      { say: SUMMARY_DONE.text, vo: SUMMARY_DONE.vo },
      { input: { type: 'summary-review', cards: list.map(function (c) { return { id: c.id, say: c.text, vo: c.vo }; }) } }
    );
    return out;
  }

  var SCREENS = [

    {
      id: 'intro-hi', page: 1,
      camera: 'close',
      log: true,
      swiftee: { pos: 'left', size: 'large', purpose: 'introduce'},
      say: 'Hi! I am Swiftee.',
      stage: { kind: 'vista' },
      beats: [
        { stage: { kind: 'vista' } },
        { wait: 500 },
        { swiftee: 'enter', from: 'left' },
        { wait: 300 },
        { say: 'Hi! I am Swiftee.', vo: 'p01' },
        { parallel: [{ swiftee: 'wave' }, { sfx: 'pop' }] },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'intro-remember', page: 2,
      camera: 'close',
      log: true,
      swiftee: { pos: 'left', size: 'large', purpose: 'introduce'},
      say: 'Remember we learned about polygons before.',
      beats: [
        { swiftee: 'recall' },
        { say: 'Remember we learned about polygons before.', vo: 'p02' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'intro-define', page: 3,
      camera: 'close',   // still close; it draws back at the end of this screen (below)
      log: true,
      swiftee: { pos: 'left', size: 'large', purpose: 'concept'},
      say: 'Polygons are closed shapes made from straight lines.',
      beats: [
        // "Ta-da — here is the idea": one open-winged flourish, then talking
        { swiftee: 'present' },
        { say: 'Polygons are closed shapes made from straight lines.', parts: ['Polygons are closed shapes', 'made from straight lines.'], vo: 'p03' },
        { wait: 600 },
        { stage: { camera: 'wide', ms: 1000 } },
        { wait: 250 },
        { swiftee: 'perch' },
        { input: { type: 'tap-anywhere', pause: 650 } }
      ]
    },

    {
      id: 'which-polygons', page: 4,
      transition: false,   // straight on from the intro: no ice between the definition and the first question
      log: true,
      swiftee: { pos: 'log', size: 'large', purpose: 'ask' },
      say: 'Which of these are polygons?',
      stage: {
        kind: 'choice-grid',
        options: [
          { id: 'pentagon', shape: 'pentagon', correct: true },
          // (each wrong card's own clue on its first miss — game.js CLUES)
          { id: 'circle',   shape: 'circle',   correct: false, reason: 'curved' },
          { id: 'open',     shape: 'open-path', correct: false, reason: 'open' },
          { id: 'octagon',  shape: 'octagon',  correct: true }
        ],
        multi: true
      },
      beats: [
        { stage: { kind: 'choice-grid', enter: 'stagger' } },
        { wait: 300 },
        { say: 'Which of these are polygons?', vo: 'p04' },
        // he looks the options over with the child, head on one side
        { swiftee: 'observe', at: 'grid' },
        { input: { type: 'multi-select', until: 'all-correct-selected', outAfter: 2, cheer: { more: 'keepGoing', last: 'levelDone' } } },
        { feedback: [{ swiftee: 'happySmall' }, { wait: FEEDBACK_MS }] }
      ],
      perTap: { correct: [{ sfx: 'correct' },
                          { juice: 'confetti', target: 'option', count: 26, fromEdge: true, speed: 0.3 }],
                wrong:   BUZZ }
    },

    {
      id: 'lets-play', page: 5,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      say: 'Let\u2019s play with this one.',
      stage: { kind: 'polygon', sides: 5, panel: 'right' },
      beats: [
        { stage: { kind: 'polygon', sides: 5, panel: 'right', enter: 'fade' } },
        { sfx: 'pop' },
        { wait: 300 },
        { swiftee: 'present', at: 'polygon' },
        { say: 'Let\u2019s play with this one.', vo: 'p05' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'pick-vertex', page: 6,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      say: 'Select any vertex.',
      beats: [
        { stage: { dots: true } },
        { say: 'Select any vertex.', vo: 'p06' },
        { swiftee: 'point', at: 'polygon' },
        { input: { type: 'vertex-pick', praise: false } },
        { feedback: [{ sfx: 'select' }, { juice: 'pop', target: 'vertex' }, { swiftee: 'nod' }] }
      ]
    },

    {
      id: 'connect', page: 7,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: 'Let’s connect it to another vertex.',
      lines: ['This is a side of the polygon.', 'Yay! You made a diagonal!'],
      stage: { highlight: { vertex: 'picked', color: 'yellow' } },
      beats: [
        { stage: { highlight: { vertex: 'picked', color: 'yellow' } } },
        { instruction: 'Let’s connect it to another vertex.', vo: 'p07i' },
        { swiftee: 'curious', at: 'picked' },
        { input: { type: 'draw-diagonal', from: 'picked', sides: true, praise: false } },
        { branch: true, until: 'correct',
          on: {
            // SIDE_COMPLETE / SECOND_SIDE_COMPLETE: named, its end disabled, and another try
            side: [
              { sfx: 'pop' },
              // the tag arrives on the word "side"
              { stage: { label: { text: 'Side', at: 'segment', arrow: true, enter: 'pop', cue: 'side' } } },
              { swiftee: 'discover' },
              { say: 'This is a side of the polygon.', vo: 'p09' },
              { wait: 1200 },
              { stage: { side: 'done' } },
              { instruction: 'Let’s connect it to a different vertex.', vo: 'p10i' },
              { swiftee: 'point', at: 'picked' },
              { input: { type: 'draw-diagonal', from: 'picked', sides: true, praise: false, retry: true } }
            ],
            // DIAGONAL_CREATED: the line is in, locked, and glowing (stage.js shimmer)
            correct: [
              { sfx: 'correct' },
              { juice: 'collect', target: 'answer' },
              { instruction: null },
              { stage: { label: { text: 'Diagonal', at: 'diagonal', arrow: true, enter: 'pop', cue: 'diagonal' } } },
              { swiftee: 'celebrate' },
              // (the connecting step's last state: the diagonal is locked, and now explained)
              { stage: { connectState: 'EXPLANATION' } },
              { say: 'Yay! You made a diagonal!', vo: 'p12' }
            ]
          },
          otherwise: [{ swiftee: 'hint' }, { input: { type: 'draw-diagonal', from: 'picked', sides: true, praise: false, retry: true } }] },
        { instruction: null },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'define-diagonal', page: 13,
      log: true,
      swiftee: { pos: 'log', size: 'medium', purpose: 'concept' },
      instruction: null,
      say: 'A line segment joining two non-adjacent vertices is a diagonal.',
      beats: [
        { swiftee: 'note' },
        { focus: 'diagonal.endpoints', style: 'pulse' },
        { say: 'A line segment joining two non-adjacent vertices is a diagonal.', parts: ['A line segment joining', 'two non-adjacent vertices', 'is a diagonal.'], vo: 'p13' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'another-diagonal', page: 14,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: 'Let’s draw another diagonal from the same vertex.',
      remind: DIAGONAL_RULE,
      beats: [
        { stage: { label: null } },
        { instruction: 'Let’s draw another diagonal from the same vertex.', vo: 'p14i' },
        { swiftee: 'point', at: 'picked' },
        { input: { type: 'draw-diagonal', from: 'picked' } },
        { branch: true, until: 'correct',
          on: { correct: correct([{ sfx: 'slice' }]) },
          otherwise: WRONG.concat([{ input: { type: 'draw-diagonal', from: 'picked', retry: true } }]) }
      ]
    },

    {
      id: 'hexagon-your-turn', page: 15,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: 'Let’s draw all the diagonals from this vertex.',
      say: 'Your turn! Let’s draw all the diagonals from this vertex.',
      stage: { kind: 'polygon', sides: 6, panel: 'right', label: null, ghost: null },
      beats: [
        { stage: { kind: 'polygon', sides: 6, panel: 'right', enter: 'morph', label: null } },
        { sfx: 'pop' },
        { stage: { dots: true } },
        { wait: 400 },
        { swiftee: 'encourage' },
        { stage: { onWord: [{ word: 'vertex', knob: 0, breathe: true }] } },
        { say: 'Your turn! Let’s draw all the diagonals from this vertex.', parts: ['Your turn!', 'Let’s draw all the diagonals', 'from this vertex.'], vo: 'p15' },
        { instruction: 'Let’s draw all the diagonals from this vertex.', vo: 'p15i' },
        { focus: 'polygon.vertex.0', style: 'pulse' },
        { swiftee: 'step-back' },
        { input: { type: 'draw-diagonals', from: 0, count: 3, sidesOk: true } },
        { feedback: milestone([{ sfx: 'levelUp' }], 'excited') }
      ],
      perTap: { correct: [{ sfx: 'slice' }, { juice: 'pop', target: 'diagonal' }], wrong: WRONG },
      remind: DIAGONAL_RULE
    },

    {
      id: 'look-diagonals', page: 16,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: null,
      originalInstruction: 'Draw another diagonal from the same vertex.',
      say: 'Let\u2019s look at the diagonals of this pentagon.',
      stage: { kind: 'polygon', sides: 5 },
      beats: [
        { instruction: null },
        { stage: { kind: 'polygon', sides: 5, enter: 'morph' } },
        // the line first, a breath, and only then do the diagonals start to draw
        { say: 'Let\u2019s look at the diagonals of this pentagon.', parts: ['Let\u2019s look at the diagonals', 'of this pentagon.'], vo: 'p16b' },
        { wait: 450 },
        { stage: { diagonals: 'all', style: 'dashed', animate: 'sequential', each: 1150, afterReveal: true } },
        { sfx: 'sparkle' },
        { wait: 700 },
        { swiftee: 'observe', at: 'polygon' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'inside-or-outside', page: 17,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: 'Are the diagonals inside or outside?',
      lines: ['The diagonals are inside.'],
      stage: { kind: 'polygon', sides: 5, diagonals: 'all' },
      beats: [
        { stage: { label: null } },
        { parallel: [
          { instruction: 'Are the diagonals inside or outside?', vo: 'p17i' },
          { stage: { choices: ['Inside', 'Outside'], cue: true } }
        ] },
        { swiftee: 'think' },
        { input: { type: 'choice', correct: 'Inside' } },
        { branch: true,
          on: { correct: correct() },
          otherwise: WRONG.concat([
            { input: { type: 'choice', correct: 'Inside', retry: true, quietMiss: true } },
            { branch: true,
              on: { correct: correct() },
              otherwise: [
                { sfx: 'wrong' },
                { wait: 500 },
                { swiftee: 'explain', at: 'polygon' },
                { stage: { onWord: [{ word: 'diagonals', lit: 'diagonals', each: 90 }] } },
                { stage: { merge: 'Inside', cue: 'inside' } },
                // (the beat ends on "inside.", not on the clip's silent tail)
                { say: 'The diagonals are inside.', vo: 'fb54', endsAt: 'words' },
                // (no chime: the answer is shown to them, not given by them — no verdict for it)
                { wait: 1400 }
              ] }
          ]) }
      ]
    },

    {
      id: 'lets-change', page: 18,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      say: 'Let\u2019s make a change.',
      beats: [
        { instruction: null },
        { stage: { choices: null } },
        { swiftee: 'mischief' },
        { say: 'Let\u2019s make a change.', vo: 'p18' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'drag-inward', page: 19,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: 'Help me pull this vertex inside.',
      stage: { highlight: { vertex: 0, color: 'yellow' } },
      beats: [
        { stage: { onWord: [{ word: 'vertex', knob: 0 }] } },
        { instruction: 'Help me pull this vertex inside.', vo: 'p19i' },
        { focus: 'polygon.vertex.0', style: 'pulse' },
        { swiftee: 'curious', at: 'polygon.vertex.0' },
        { input: { type: 'drag-vertex', vertex: 0, until: 'concave', live: 'diagonals' } },
        { feedback: [{ sfx: 'correct' }, { juice: 'wobble', target: 'polygon' }, { juice: 'confetti', target: 'vertex', count: 18 }, { swiftee: 'happySmall' }] }
      ]
    },

    {
      id: 'whoa', page: 20,
      // (on the log, like the screens either side: this card has no rim to peek over)
      log: true,
      swiftee: { pos: 'log', size: 'medium', purpose: 'surprise' },
      say: 'Whoa! One of the diagonals went outside.',
      stage: { highlight: { diagonal: 'outside', color: 'red', style: 'dashed' } },
      beats: [
        { instruction: null },
        { swiftee: 'surprised' },
        { stage: { highlight: { diagonal: 'outside', color: 'red', style: 'dashed', enter: 'flash' } } },
        { sfx: 'honk' },
        { say: 'Whoa! One of the diagonals went outside.', parts: ['Whoa! One of the diagonals', 'went outside.'], vo: 'p20',
          alt: { if: 'manyOutside', say: 'Whoa! Some of the diagonals went outside.', parts: ['Whoa! Some of the diagonals', 'went outside.'], vo: 'fb52' } },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'compare', page: 21,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      instruction: null,
      say: 'Let\u2019s compare the diagonals in both the pentagons.',
      original: 'Both are pentagons.',
      stage: { kind: 'compare', left: { sides: 5 }, right: { sides: 5, dent: 0, made: 'concave' } },
      beats: [
        { instruction: null },
        // THE PAIR ARRIVES, THEN HE SPEAKS OF IT
        { stage: { kind: 'compare', enter: 'split' } },
        { sfx: 'menuWhoosh' },
        { wait: 400 },
        // "both the pentagons": the two shapes answer the word
        { stage: { onWord: { word: 'pentagons', pulse: 'both' } } },
        { parallel: [
          { swiftee: 'compare', at: ['compare.left', 'compare.right'] },
          { say: 'Let\u2019s compare the diagonals in both the pentagons.', vo: 'p21' }
        ] },
        { wait: 300 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'all-inside', page: 22,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      say: 'This one has all the diagonals inside.',
      original: 'This one has all diagonals inside.',
      beats: [
        { instruction: null },
        // the other card steps back a little — still easy to see
        { focus: 'compare.left', style: 'lean' },
        { stage: { onWord: { word: 'inside', sfx: 'sparkle', gain: 0.4 } } },
        // ...and its mark, INSIDE, comes up under it on the same word (not a screen later)
        { stage: { marks: { left: 'Inside', cue: true } } },
        { parallel: [
          // its diagonals grow one after another as he says it
          { stage: { grow: { card: 'left', each: 430, ms: 540 } } },
          { swiftee: 'observe', at: 'compare.left' },
          { say: 'This one has all the diagonals inside.', vo: 'p22' }
        ] },
        { wait: 300 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'one-outside', page: 23,
      log: true,
      swiftee: { pos: 'log', size: 'medium' },
      // FLAG: punctuation. Deck line has no full stop.
      say: 'But this one has atleast one diagonal outside.',
      original: 'This one has at least one diagonal outside',
      beats: [
        { instruction: null },
        { stage: { grow: { card: 'left', instant: true } } },
        { stage: { marks: { left: 'Inside', enter: false } } },
        // the convex one back to normal, only less important
        { focus: 'compare.right', style: 'lean' },
        { stage: { marks: { right: 'Outside', cue: true } } },
        { parallel: [
          { stage: { grow: { card: 'right', each: 430, ms: 540, outsideOn: 'outside' } } },
          { swiftee: 'look', at: 'compare.right' },
          { say: 'But this one has atleast one diagonal outside.', vo: 'p23' }
        ] },
        { stage: { grow: { card: 'right', instant: true } } },
        { focus: 'compare', style: 'even' },
        { swiftee: 'compare', at: ['compare.left', 'compare.right'] },
        { wait: 1000 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'convex', page: 24,
      log: true,
      swiftee: { pos: 'log', size: 'medium', purpose: 'concept' },
      instruction: null,
      say: 'All diagonals inside means convex polygon.',
      original: 'That\u2019s convex polygon.',
      beats: [
        { instruction: null },
        { stage: { grow: { card: 'both', instant: true } } },
        { focus: 'compare.left', style: 'lean' },
        { stage: { badge: { under: 'compare.left', text: 'Convex', tone: 'convex', enter: 'pop', cue: 'convex', sfx: 'correct', sparkle: true, react: 'nod' } } },
        { parallel: [
          // stating the rule
          { swiftee: 'explain', at: 'compare.left' },
          { say: 'All diagonals inside means convex polygon.', vo: 'p24' }
        ] },
        { wait: 300 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'concave', page: 25,
      log: true,
      swiftee: { pos: 'log', size: 'medium', purpose: 'concept' },
      instruction: null,
      // FLAG: grammar and capitalisation. Deck: "So it is Concave polygon."
      say: 'Atleast one diagonal outside means concave polygon.',
      original: 'So it is Concave polygon.',
      beats: [
        { instruction: null },
        { stage: { grow: { card: 'both', instant: true } } },
        { focus: 'compare.right', style: 'lean' },
        { stage: { badge: { under: 'compare.right', text: 'Concave', tone: 'concave', enter: 'pop', cue: 'concave', sfx: 'correct', sparkle: true, react: 'happySmall' } } },
        { parallel: [
          // he points at it
          { swiftee: 'point', at: 'compare.right' },
          { say: 'Atleast one diagonal outside means concave polygon.', parts: ['Atleast one diagonal outside', 'means concave polygon.'], vo: 'p25' }
        ] },
        { focus: 'compare', style: 'even' },
        { wait: 700 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'make-concave', page: 26,
      swiftee: { pos: 'off', size: 'medium', purpose: 'concept' },
      instruction: 'Drag any vertex to make this polygon concave.',
      lines: ['Try again!', 'The diagonals are still inside the shape, so it is still convex.', 'Let me show you. Watch this corner.', 'Now one diagonal goes outside, so the polygon is concave.', 'Great job!'],
      stage: { kind: 'polygon', sides: 4, panel: 'center', badge: { text: 'Convex', live: true } },
      beats: [
        { swiftee: 'exit', to: 'left' },
        { stage: { kind: 'polygon', sides: 4, panel: 'center', enter: 'fade', badge: { text: 'Convex', live: true } } },
        { sfx: 'pop' },
        { instruction: 'Drag any vertex to make this polygon concave.', vo: 'p26i' },
        { input: { type: 'drag-vertex', vertex: 'any', until: 'concave', live: 'badge', attempts: true, praise: false, quietMiss: true } },
        { branch: true,
          on: { correct: [] },
          otherwise: [
            { sfx: 'wrong' },
            { swiftee: 'enter', from: 'left', to: 'left', size: 'small' },
            { say: 'Try again!', vo: 'fb32' },
            { stage: { diagonals: 'all', style: 'dashed', animate: 'sequential', each: 420 } },
            { say: 'The diagonals are still inside the shape, so it is still convex.', vo: 'p26r1' },
            // (a breath to look at the clue before the task comes back — the final pass)
            { wait: 600 },
            // (the task, shown again — not said again)
            { instruction: 'Drag any vertex to make this polygon concave.' },
            { input: { type: 'drag-vertex', vertex: 'any', until: 'concave', live: 'both', attempts: true, retry: true, quietMiss: true, praise: false } },
            { branch: true,
              on: { correct: [] },
              otherwise: [
                { wait: 500 },
                { swiftee: 'enter', from: 'left', to: 'left', size: 'small' },
                { focus: 'polygon.vertex.0', style: 'pulse' },
                { say: 'Let me show you. Watch this corner.', vo: 'fb53' },
                { stage: { autoConcave: { vertex: 0, ms: 1000, settle: 400, hold: 1000 } } },
                { say: 'Now one diagonal goes outside, so the polygon is concave.', vo: 'p26r2' },
                { wait: 1000 }
              ] }
          ] },
        { branch: true,
          on: { correct: [
            { feedback: [{ sfx: 'correct' }, { juice: 'celebrate', target: 'polygon' }] },
            // (in first, so "Great job!" is his — on the same mark as the explanations)
            { swiftee: 'enter', from: 'left', to: 'left', size: 'small' },
            { say: 'Great job!', vo: 'fb03' },
            { swiftee: 'celebrate' }
          ] },
          otherwise: [] }
      ]
    },

    {
      id: 'sort-convex-concave', page: 27,
      swiftee: { pos: 'top-left', size: 'small' },
      say: 'Can you sort these polygons as convex or concave?',
      teach: {
        concave: [{ say: 'Look! This corner goes inward.', vo: 'p27c', show: 'notch', on: 2 },
                  { say: 'Atleast one diagonal outside means concave polygon.', vo: 'p25', shows: [{ what: 'outside', on: 2 }, { what: 'outsideGlow', on: 3 }] }],
        convex:  [{ say: 'Look! No corner goes inward.', vo: 'p27v', show: 'corners', on: 2 },
                  { say: 'All diagonals inside means convex polygon.', vo: 'p24', shows: [{ what: 'inside', on: 1 }, { what: 'insideGlow', on: 2 }] }]
      },
      stage: {
        kind: 'sort',
        bins: [{ id: 'convex', label: 'Convex', tone: 'convex' }, { id: 'concave', label: 'Concave', tone: 'concave' }],
        items: ['square', 'chevron', 'pentagon', 'l-shape', 'hexagon', 'star'],
        mechanic: 'drag-to-bin',
        // "...as convex or concave?": each bin comes in on its word
        binsCue: true
      },
      beats: [
        { instruction: null },
        { stage: { kind: 'sort', enter: 'stagger' } },
        { sfx: 'menuWhoosh' },
        { wait: 300 },
        { say: 'Can you sort these polygons as convex or concave?', vo: 'p27' },
        { swiftee: 'observe', at: 'sort.tray' },
        { input: { type: 'sort', until: 'all-placed-correctly', teach: 2, autoPlace: true } },
        // a finished sort is a milestone
        { feedback: milestone([{ sfx: 'levelUp' }, { juice: 'confetti', target: 'stage' }]) }
      ],
      perTap: { correct: [{ sfx: 'correct' }, { juice: 'pop', target: 'item' }],
                wrong:   [{ sfx: 'wrong' }, { juice: 'refuse', target: 'item' }, { stage: { returnItem: true } }, { swiftee: 'oops' }] }
    },

    {
      id: 'suspicious', page: 28,
      swiftee: { pos: 'corner', size: 'small', purpose: 'hint', arrive: 'fly' },
      say: 'Hmm\u2026 The sides look suspiciously alike.',
      stage: { kind: 'polygon', sides: 5, room: 'measure' },
      beats: [
        { stage: { kind: 'vista' } },
        { stage: { kind: 'polygon', sides: 5, room: 'measure', enter: 'intro', afterReveal: true } },
        { wait: 200 },
        { swiftee: 'enter', from: 'air' },
        { swiftee: 'curious', at: 'polygon' },
        { swiftee: 'inspect' },
        { wait: 400 },
        { say: 'Hmm\u2026 The sides look suspiciously alike.', parts: ['Hmm\u2026', 'The sides look suspiciously alike.'], faces: [null, 'question'], vo: 'p28' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'measure-sides', page: 29,
      swiftee: { pos: 'corner', size: 'tiny', purpose: 'demo' },
      instruction: null,
      say: 'Let\u2019s measure the sides.',
      stage: { kind: 'polygon', sides: 5, room: 'measure' },
      beats: [
        { stage: { kind: 'polygon' } },
        { instruction: null },
        { swiftee: 'inspect' },
        { say: 'Let\u2019s measure the sides.', vo: 'p29s' },
        { input: { type: 'tap-each', targets: 'sides', reveal: 'length', count: 5, auto: true, praise: false } },
        { feedback: [{ sfx: 'correct' }, { swiftee: 'proud' }] }
      ],
      perTap: { correct: [{ sfx: 'tick' }, { juice: 'pop', target: 'side' }] }
    },

    {
      id: 'sides-equal', page: 30,
      swiftee: { pos: 'corner', size: 'tiny', purpose: 'celebrate' },
      instruction: null,
      say: 'Every side is equal. But what about the angles?',
      original: 'Equal sides! Now tap the angles.',
      beats: [
        { instruction: null },
        { swiftee: 'nod' },
        { say: 'Every side is equal. But what about the angles?', parts: ['Every side is equal.', 'But what about the angles?'], vo: 'p30' },
        { swiftee: 'think' },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'measure-angles', page: 31,
      swiftee: { pos: 'corner', size: 'tiny', purpose: 'celebrate' },
      instruction: null,
      say: 'The angles match too!',
      lines: ['Let\u2019s measure the angles.'],
      beats: [
        { instruction: null },
        // (out comes the magnifying glass — the rig's 'learning' — before he sets off)
        { swiftee: 'examine' },
        { say: 'Let\u2019s measure the angles.', vo: 'p31m' },
        { input: { type: 'tap-each', targets: 'angles', reveal: 'arc', count: 5, auto: true, praise: false } },
        // the measuring is done and it all matches: heart eyes
        { swiftee: 'delight' },
        { say: 'The angles match too!', vo: 'p31' },
        { input: { type: 'tap-anywhere' } }
      ],
      perTap: { correct: [{ sfx: 'tick' }, { juice: 'pop', target: 'angle' }] }
    },

    {
      id: 'distort', page: 32, panel: 1,
      swiftee: { pos: 'corner', size: 'tiny', purpose: 'demo' },
      instruction: 'Drag the highlighted vertex.',
      say: 'Help me stretch this corner. Let’s see what happens to the sides and angles.',
      stage: { kind: 'polygon', sides: 5, room: 'measure', highlight: { vertex: 0, color: 'yellow' }, measurements: 'live' },
      beats: [
        { stage: { kind: 'polygon' } },
        { say: 'Help me stretch this corner. Let’s see what happens to the sides and angles.', parts: ['Help me stretch this corner.', 'Let\u2019s see what happens', 'to the sides and angles.'], vo: 'p32a' },
        { instruction: 'Drag the highlighted vertex.', vo: 'p32ai' },
        { focus: 'polygon.vertex.0', style: 'pulse' },
        // "let's see what happens" — curious, before the child pulls
        { swiftee: 'curious', at: 'polygon.vertex.0' },
        { input: { type: 'drag-vertex', vertex: 0, until: 'irregular', minMove: 24, live: 'measurements' } },
        // the numbers changed: a quick "oh!" of discovery
        { feedback: [{ sfx: 'slideWhistle' }, { juice: 'wobble', target: 'polygon' }, { swiftee: 'discover' }] }
      ]
    },

    {
      id: 'stayed-changed', page: 32, panel: 2,
      swiftee: { pos: 'corner', size: 'tiny', purpose: 'ask' },
      instruction: 'Are the sides and angles still equal?',
      say: 'It’s still a pentagon. But are the sides and angles still equal?',
      lines: ['The sides and angles changed, so they are not equal.'],
      // (the answers are dealt by the beats, on the question's words — not by a rebuild)
      stage: {},
      beats: [
        { instruction: null },
        { swiftee: 'think' },
        { say: 'It’s still a pentagon. But are the sides and angles still equal?', parts: ['It\u2019s still a pentagon.', 'But are the sides', 'and angles still equal?'], vo: 'p32b' },
        { parallel: [
          { instruction: 'Are the sides and angles still equal?', vo: 'p32bi' },
          { stage: { choices: ['Still equal', 'Not equal'], cue: { 'Still equal': ['still'], 'Not equal': ['equal'] } } }
        ] },
        { input: { type: 'choice', correct: 'Not equal', reason: 'compare' } },
        { branch: true,
          on: { correct: correct() },
          otherwise: WRONG.concat([
            { input: { type: 'choice', correct: 'Not equal', retry: true, quietMiss: true } },
            { branch: true,
              on: { correct: correct() },
              otherwise: [
                { juice: 'refuse', target: 'answer' }, { sfx: 'wrong' },
                { parallel: [
                  { stage: { merge: 'Not equal', cue: 'equal' } },
                  { swiftee: 'explain', at: 'polygon' },
                  { say: 'The sides and angles changed, so they are not equal.', vo: 'p32r' }
                ] },
                { sfx: 'correct' },
                { wait: 1200 }
              ] }
          ]) }
      ]
    },

    {
      id: 'regular-vs-irregular', page: 32, panel: 3,
      instruction: null,
      swiftee: { pos: 'peek', size: 'small', purpose: 'concept'},
      say: 'Let\u2019s compare these two pentagons.',
      lines: ['All the sides and angles are equal in this pentagon.',
              'But this pentagon has unequal sides and unequal angles.',
              'All sides and angles equal means a regular polygon. Sides and angles unequal means an irregular polygon.'],
      stage: {
        kind: 'compare',
        measured: true,
        left:  { sides: 5, caption: 'Regular',   tone: 'regular', captionCue: 'regular' },
        right: { sides: 5, stretch: 0, made: 'irregular', caption: 'Irregular', tone: 'irregular', captionCue: 'irregular' }
      },
      beats: [
        { instruction: null },
        { stage: { kind: 'compare', enter: 'split' } },
        { stage: { quietWords: true } },
        { sfx: 'menuWhoosh' },
        { wait: 300 },
        // he looks at the pair
        { swiftee: 'present', at: 'compare' },
        { say: 'Let\u2019s compare these two pentagons.', vo: 'fb55' },
        { wait: 500 },
        { focus: 'compare.left', style: 'lean' },
        { stage: { onWord: [{ word: 'sides', evidence: { card: 'left', what: 'sides' } }, { word: 'angles', evidence: { card: 'left', what: 'angles' } }] } },
        { say: 'All the sides and angles are equal in this pentagon.', vo: 'fb56' },
        { wait: 500 },
        { focus: 'compare.right', style: 'lean' },
        { stage: { onWord: [{ word: 'sides', evidence: { card: 'right', what: 'sides' } }, { word: 'angles', evidence: { card: 'right', what: 'angles' } }] } },
        { say: 'But this pentagon has unequal sides and unequal angles.', vo: 'fb57' },
        { wait: 700 },
        { swiftee: 'note' },
        { focus: 'compare.left', style: 'lean' },
        { stage: { onWord: [{ word: 'sides', nth: 2, focus: 'right', glow: 'right' }] } },
        { say: 'All sides and angles equal means a regular polygon. Sides and angles unequal means an irregular polygon.',
          parts: ['All sides and angles equal', 'means a regular polygon.', 'Sides and angles unequal', 'means an irregular polygon.'], vo: 'fb58' },
        // (the pair, evenly, both named: the final Regular / Irregular state)
        { focus: 'compare', style: 'even' },
        { wait: 700 },
        { input: { type: 'tap-anywhere' } }
      ]
    },

    {
      id: 'sort-regular', page: 33,
      swiftee: { pos: 'top-left', size: 'small' },
      say: 'Where does this polygon belong?',
      stage: {
        kind: 'swipe-sort',
        zones: [{ id: 'regular', label: 'Regular' }, { id: 'irregular', label: 'Irregular' }],
        items: ['pentagon', 'rhombus', 'triangle', 'stretched-hexagon', 'square', 'rectangle', 'hexagon', 'l-shape']
      },
      originalMechanic: 'swipe',
      teach: {
        regular: [{ say: 'This one is regular. Every side is equal, and every angle is equal too.', vo: 'fb48', shows: [{ what: 'sides', on: 5 }, { what: 'angles', on: 10 }] }],
        sides:   [{ say: 'This one is irregular. Its sides are not all the same length.', vo: 'fb49', shows: [{ what: 'sides', on: 5 }] }],
        angles:  [{ say: 'This one is irregular. Its sides match, but its angles are not all equal.', vo: 'fb50', shows: [{ what: 'sides', on: 5 }, { what: 'angles', on: 9 }] }],
        both:    [{ say: 'This one is irregular. Its sides are not equal, and its angles are not equal either.', vo: 'fb51', shows: [{ what: 'sides', on: 5 }, { what: 'angles', on: 11 }] }]
      },
      beats: [
        { instruction: null },
        { stage: { kind: 'swipe-sort', enter: 'stagger' } },
        { say: 'Where does this polygon belong?', vo: 'p33' },
        { swiftee: 'exit', to: 'below' },
        { input: { type: 'swipe', until: 'all-classified', praise: false } },
        { swiftee: 'enter', from: 'below', quick: true, to: 'middle', size: 'medium' },
        { feedback: milestone([{ sfx: 'levelUp' }, { juice: 'confetti', target: 'stage' }]) }
      ],
      perTap: { correct: [{ sfx: 'correct' }, { juice: 'pop', target: 'item' }],
                // (his 'oops' comes when he is up, in the pop that answers it)
                wrong:   [{ sfx: 'wrong' }, { juice: 'refuse', target: 'item' }] }
    },

    {
      id: 'summary', page: 37,
      swiftee: { pos: 'peek', size: 'small', purpose: 'celebrate' },
      instruction: null,
      say: SUMMARY[0].text,
      lines: [SUMMARY_OPEN.text].concat(SUMMARY.slice(1).map(function (c) { return c.text; }), [SUMMARY_DONE.text]),
      stage: { kind: 'summary', concepts: SUMMARY.map(function (c) { return { id: c.id, label: c.label }; }) },
      beats: summaryBeats(SUMMARY)
    }
  ];

  var NOT_SCREENS = {
    34: 'Design reference card (five labelled shapes). Not a game screen. ' +
        'FLAG: verify item 5 — it is captioned "Irregular hexagon" but the ' +
        'drawn shape appears to have more than six vertices.',
    36: 'Third-party reference image (SplashLearn watermark). Reference ' +
        'only. Must not ship in the build.'
  };

  var byId = {};
  SCREENS.forEach(function (s, i) { byId[s.id] = s; s.index = i; });

  function flags() {
    var out = [];
    SCREENS.forEach(function (s) {
      if (s.original) out.push({ page: s.page, id: s.id, kind: 'dialogue', from: s.original, to: s.say });
      if (s.originalInstruction !== undefined) out.push({ page: s.page, id: s.id, kind: 'instruction', from: s.originalInstruction, to: s.instruction });
      if (s.originalMechanic) out.push({ page: s.page, id: s.id, kind: 'mechanic', from: s.originalMechanic, to: s.stage.mechanic });
    });
    out.push({ page: 15, id: 'hexagon-your-turn', kind: 'sequence', note: 'pentagon -> hexagon -> pentagon; move or remove' });
    out.push({ page: 15, id: 'hexagon-your-turn', kind: 'answer-leak', note: 'dashed ghosts of all three answers removed' });
    out.push({ page: 34, kind: 'verify', note: NOT_SCREENS[34] });
    out.push({ page: 36, kind: 'do-not-ship', note: NOT_SCREENS[36] });
    return out;
  }

  function voScript() {
    var out = [];
    var find = function (list, text) {
      var vo = null;
      (function walk(bs) {
        (bs || []).forEach(function (b) {
          if (!b || typeof b !== 'object') return;
          if (b.say === text && b.vo) vo = b.vo;
          if (b.on) Object.keys(b.on).forEach(function (k) { walk(b.on[k]); });
          if (b.otherwise) walk(b.otherwise);
          if (b.feedback) walk(b.feedback);
          if (b.parallel) walk(b.parallel);
        });
      }(list));
      return vo;
    };
    SCREENS.forEach(function (s) {
      if (s.say) out.push({ page: s.page, id: s.id, vo: find(s.beats, s.say), text: s.say });
      (s.lines || []).forEach(function (t) { out.push({ page: s.page, id: s.id, vo: find(s.beats, t), text: t }); });
      var r = s.remind;
      if (r && r.vo && !out.some(function (l) { return l.vo === r.vo; })) {
        out.push({ page: s.page, id: s.id, vo: r.vo, text: r.say, remind: true });
      }
    });
    return out;
  }

var SPEAKS = /\b(i|i'll|i'm|i\u2019ll|i\u2019m|we|we'll|we\u2019ll|let's|let\u2019s|you|your|me|us|they|see|look|help)\b/i;
function speaks(screen) {
  if (!screen) return false;
  var lines = [];
  if (typeof screen.say === 'string') lines.push(screen.say);
  (screen.beats || []).forEach(function (b) { if (b && typeof b.say === 'string') lines.push(b.say); });
  return lines.some(function (t) { return SPEAKS.test(t); });
}
var IMPERATIVE = /^(pick|drag|tap|draw|sort|choose|swipe|count|connect|move|pull|press|select|find|put|match|build|drop|place|touch|click|measure|compare|turn)\b/i;
function isOrder(text, screen) {
  var t = String(text || '').trim();
  if (!t) return true;
  if (screen && screen.instruction && t === String(screen.instruction).trim()) return true;
  return IMPERATIVE.test(t);
}
function saysAnything(screen) {
  if (!screen) return false;
  if (typeof screen.say === 'string' && screen.say && !isOrder(screen.say, screen)) return true;
  return (screen.beats || []).some(function (b) { return b && typeof b.say === 'string' && b.say && !isOrder(b.say, screen); });
}
function wantsBuddy(screen) {
  return !!(screen && screen.swiftee && screen.swiftee.purpose) || speaks(screen) || saysAnything(screen);
}

function sceneKindAt(i) {
  var kind = null;
  for (var k = 0; k <= i && k < SCREENS.length; k++) {
    var s = SCREENS[k];
    if (s.stage && s.stage.kind) kind = s.stage.kind;
    (s.beats || []).forEach(function (b) { if (b && b.stage && b.stage.kind) kind = b.stage.kind; });
  }
  return kind;
}

function speaksAll(i) {
  var s = SCREENS[i];
  if (s && s.swiftee && s.swiftee.pos === 'off') return false;
  var kind = sceneKindAt(i);
  return kind === 'polygon' || kind === 'compare' || kind === 'sort' || kind === 'summary';
}
function wantsBuddyAt(i) {
  return wantsBuddy(SCREENS[i]) || speaksAll(i);
}

global.Screens = {
  wantsBuddy: wantsBuddy,
  sceneKindAt: sceneKindAt,
  speaksAll: speaksAll,
  wantsBuddyAt: wantsBuddyAt,
    list: SCREENS,
    byId: byId,
    notScreens: NOT_SCREENS,
    flags: flags,
    voScript: voScript,
    WRONG: WRONG
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Screens;

})(typeof window !== 'undefined' ? window : this);
