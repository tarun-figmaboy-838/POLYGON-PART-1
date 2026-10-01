/*!
 * vo-joins.js — lines nobody recorded whole, JOINED from words Swiftee did record.
 *
 *   node tools/join-vo.js            → assets/vo/<id>.mp3 + .ogg, their word starts
 *
 * Each part names a master take (tools/vo-masters.js), one of its lines (the id its timeline
 * uses, `docs/vo-masters/<master>.json`) and a run of that line's words, [first, last], by index.
 * `gap` is the silence (ms) put before the part. A recording of the whole line replaces its join:
 * add it to a master, cut it with split-vo.js and take the join out of this list.
 *
 * All three takes the parts come from are one session (swiftee-extra), so the joins keep one
 * voice, one room and one level.
 */
'use strict';
module.exports = [
  // Frozen Rush's broken path, before the lesson (the user's kit, step 11)
  { id: 'sw2', text: 'But to help Momo, you need to learn about polygons.', parts: [
    { master: 'swiftee-extra', line: 'p01b~unused', words: [0, 0] },        // "But"
    { master: 'swiftee-extra', line: 'p39', words: [9, 11], gap: 40 },       // "to help Momo."
    { master: 'swiftee-extra', line: 'p01b~unused', words: [4, 9], gap: 170 } // "you need to learn about polygons."
  ] },
  // the first ditch, after the lesson (the kit, return step 7)
  { id: 'sw3', text: 'Now let’s help Momo.', parts: [
    { master: 'swiftee-extra', line: 'p39', words: [0, 0] },                 // "Now"
    { master: 'swiftee-extra', line: 'p37o', words: [0, 0], gap: 20 },       // "Let’s"
    { master: 'swiftee-extra', line: 'p39', words: [10, 11], gap: 20 }       // "help Momo."
  ] }
];
