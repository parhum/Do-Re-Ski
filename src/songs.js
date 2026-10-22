/**
 * Song library. Every melody here is a traditional or 19th-century tune in
 * the public domain.
 *
 * Melodies are scale degrees (`L` = low sol, `8` = high do) with an optional
 * `-beats` length; chords are Roman numerals in the same format. Beats are
 * quarter notes, so a 6/8 bar is three beats long.
 */

/**
 * @typedef {object} Song
 * @property {string} id
 * @property {string} title
 * @property {string} meter
 * @property {number} beatsPerBar bar length in quarter notes
 * @property {number} pulse length of the felt beat in quarter notes (1.5 in 6/8)
 * @property {number} bpm
 * @property {string} melody
 * @property {string} chords
 * @property {string} lesson
 */

/** @type {readonly Song[]} */
export const SONGS = Object.freeze([
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    meter: '4/4',
    beatsPerBar: 4,
    pulse: 1,
    bpm: 104,
    melody: '3 2 1 2 3 3 3-2 2 2 2-2 3 5 5-2 3 2 1 2 3 3 3 3 2 2 3 2 1-4',
    chords: 'I-4 I-4 V-4 I-4 I-4 I-4 V-4 I-4',
    lesson: 'Mary lives on just four notes: do, re, mi and sol. It moves mostly by step, each note sliding to its neighbor, which is why it is so easy to sing.',
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    meter: '4/4',
    beatsPerBar: 4,
    pulse: 1,
    bpm: 100,
    melody: '3 3 4 5 5 4 3 2 1 1 2 3 3-1.5 2-0.5 2-2 3 3 4 5 5 4 3 2 1 1 2 3 2-1.5 1-0.5 1-2',
    chords: 'I-4 V-4 I-4 V-4 I-4 V-4 I-4 V-2 I-2',
    lesson: 'These two phrases move entirely by step and never leave the five notes from do to sol. The first phrase ends on re over the V chord, so it sounds unfinished. The second lands on do over I and feels like home.',
  },
  {
    id: 'twinkle',
    title: 'Twinkle, Twinkle',
    meter: '4/4',
    beatsPerBar: 4,
    pulse: 1,
    bpm: 96,
    melody: '1 1 5 5 6 6 5-2 4 4 3 3 2 2 1-2 5 5 4 4 3 3 2-2 5 5 4 4 3 3 2-2 1 1 5 5 6 6 5-2 4 4 3 3 2 2 1-2',
    chords: 'I-4 IV-2 I-2 IV-2 I-2 V-2 I-2 I-2 IV-2 I-2 V-2 I-2 IV-2 I-2 V-2 I-4 IV-2 I-2 IV-2 I-2 V-2 I-2',
    lesson: 'That opening jump from do to sol is a perfect fifth, seven half steps wide. The whole song uses three chords, I, IV and V, the same three behind countless folk and pop songs.',
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    meter: '4/4',
    beatsPerBar: 4,
    pulse: 1,
    bpm: 104,
    melody: '1 2 3 1 1 2 3 1 3 4 5-2 3 4 5-2 5-.5 6-.5 5-.5 4-.5 3 1 5-.5 6-.5 5-.5 4-.5 3 1 1 L 1-2 1 L 1-2',
    chords: 'I-4 I-4 I-4 I-4 I-4 I-4 I-1 V-1 I-2 I-1 V-1 I-2',
    lesson: 'The “ding, dang, dong” ending drops to low sol and back up to do. Sol to do is the bass motion of a V–I cadence, the progression that makes music sound finished.',
  },
  {
    id: 'row-your-boat',
    title: 'Row, Row, Row Your Boat',
    meter: '6/8',
    beatsPerBar: 3,
    pulse: 1.5,
    bpm: 128,
    melody: '1-1.5 1-1.5 1 2-.5 3-1.5 3 2-.5 3 4-.5 5-3 8-.5 8-.5 8-.5 5-.5 5-.5 5-.5 3-.5 3-.5 3-.5 1-.5 1-.5 1-.5 5 4-.5 3 2-.5 1-3',
    chords: 'I-3 I-3 I-3 I-3 I-3 I-3 V-3 I-3',
    lesson: 'This one is in 6/8: two big beats per bar, each split into three. “Merrily, merrily” leaps up to high do and comes back down through the notes of the tonic chord: do, sol, mi, do.',
  },
]);
