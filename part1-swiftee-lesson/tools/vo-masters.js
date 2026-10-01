/*!
 * vo-masters.js — the recorded master takes, and which lines each one reads, in its order.
 *
 *   node tools/align-vo.js --master <name> --modules <dir>   → docs/vo-masters/<name>.json
 *   node tools/split-vo.js --master <name>                   → assets/vo/<id>.mp3 + .ogg
 *
 * Each master is one recording of several lines (assets/source/vo-masters). The ids are the
 * game's own (tools/vo-lines.js); the TEXT aligned against the take is the game's text for that
 * id, so what is on screen and what is cut are the same line. A line the take reads twice is
 * listed twice, the second time as `<id>~2`: the aligner needs it to keep its place in the
 * take, and the cutter uses the first reading only.
 *
 * `tempo` 1: these takes are cut as recorded — no stretch (the old take was slowed to 0.88).
 */
'use strict';
module.exports = [
  { name: 'narrator', source: 'assets/source/vo-masters/narrator.mp3', tempo: 1,
    lines: ['st1-narrator', 'st3-narrator', 'st5-narrator'] },
  { name: 'popo', source: 'assets/source/vo-masters/popo.mp3', tempo: 1,
    lines: ['st1-popo', 'st2-popo'] },
  { name: 'swiftee-feedback', source: 'assets/source/vo-masters/swiftee-feedback.mp3', tempo: 1,
    lines: ['fb46', 'fb47', 'fb03', 'fb32'] },
  { name: 'swiftee-lesson', source: 'assets/source/vo-masters/swiftee-lesson.mp3', tempo: 1,
    lines: [
      'p01', 'p02', 'p03', 'p04', 'fb44', 'fb45', 'p05', 'p06',
      'p07i', 'p09', 'p10i', 'p12', 'p13',
      'p14i', 'fb15', 'p14r', 'p15', 'fb15~2', 'p14r~2', 'p16b',
      'p17i', 'fb54', 'p18', 'p19i', 'fb11', 'p20', 'fb52',
      'p21', 'p22', 'p23', 'p24', 'p25',
      'p26i', 'p26r1', 'fb53', 'p26r2', 'fb03~2',            // ("Great job!" — the feedback take's is used)
      'p27', 'fb42', 'fb43', 'p27c', 'p25~2', 'p27v', 'p24~2',
      'p28', 'p29s', 'p30', 'p31m', 'p31',
      'p32a', 'p32ai', 'fb40', 'p32b', 'fb41', 'p32r',
      'fb55', 'fb56', 'fb57', 'fb58',
      'p33', 'fb35', 'fb48', 'fb36', 'fb49', 'fb37', 'fb50', 'fb38', 'fb51'
    ] }
];
