/**
 * Music theory primitives: major keys, the lanes of the slope, chords,
 * and the compact text format used to write melodies.
 */

/** Semitone offsets of the major scale from its tonic. */
export const MAJOR_SCALE = Object.freeze([0, 2, 4, 5, 7, 9, 11]);

export const SOLFEGE = Object.freeze(['do', 're', 'mi', 'fa', 'sol', 'la', 'ti']);

/** Supported major keys: the MIDI note of the tonic and the spelled scale. */
export const KEYS = Object.freeze({
  'C':  { tonic: 60, names: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
  'G':  { tonic: 55, names: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'] },
  'D':  { tonic: 62, names: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'] },
  'A':  { tonic: 57, names: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'] },
  'F':  { tonic: 65, names: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'] },
  'B♭': { tonic: 58, names: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'] },
  'E♭': { tonic: 63, names: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'] },
});

/**
 * The slope's lanes, left to right. Lane 0 is low sol, lanes 1–7 are
 * do through ti, and lane 8 is high do.
 */
export const LANES = Object.freeze([
  { degree: 5, octave: -1 },
  { degree: 1, octave: 0 },
  { degree: 2, octave: 0 },
  { degree: 3, octave: 0 },
  { degree: 4, octave: 0 },
  { degree: 5, octave: 0 },
  { degree: 6, octave: 0 },
  { degree: 7, octave: 0 },
  { degree: 1, octave: 1 },
]);

/** Chords by Roman numeral, as scale degrees with the root first. */
export const CHORDS = Object.freeze({
  I: [1, 3, 5],
  ii: [2, 4, 6],
  iii: [3, 5, 7],
  IV: [4, 6, 1],
  V: [5, 7, 2],
  V7: [5, 7, 2, 4],
  vi: [6, 1, 3],
});

/**
 * Parses a space-separated sequence such as `"1 2 3-2"` into timed events.
 * Each token is a value with an optional `-beats` length (default 1).
 *
 * @template T
 * @param {string} text
 * @param {(value: string) => T} mapValue
 * @returns {Array<T & { beat: number, duration: number }>}
 */
export function parseSequence(text, mapValue) {
  let beat = 0;
  return text.trim().split(/\s+/).map((token) => {
    const [value, length] = token.split('-');
    const duration = length === undefined ? 1 : Number(length);
    if (!(duration > 0)) throw new Error(`Invalid duration in token "${token}"`);
    const event = { ...mapValue(value), beat, duration };
    beat += duration;
    return event;
  });
}

/** Melody tokens are scale degrees 1–8, or `L` for low sol. */
export function parseMelody(text) {
  return parseSequence(text, (value) => {
    const lane = value === 'L' ? 0 : Number(value);
    if (!Number.isInteger(lane) || lane < 0 || lane >= LANES.length) {
      throw new Error(`Unknown melody note "${value}"`);
    }
    return { lane };
  });
}

/** Chord tokens are Roman numerals from {@link CHORDS}. */
export function parseChords(text) {
  return parseSequence(text, (roman) => {
    if (!Object.hasOwn(CHORDS, roman)) throw new Error(`Unknown chord "${roman}"`);
    return { roman };
  });
}

/** Total length in beats of a parsed sequence. */
export function sequenceLength(events) {
  const last = events.at(-1);
  return last ? last.beat + last.duration : 0;
}

/** MIDI note number of a lane in the given key. */
export function laneMidi(key, lane) {
  const { degree, octave } = LANES[lane];
  return KEYS[key].tonic + MAJOR_SCALE[degree - 1] + 12 * octave;
}

/**
 * Display label for a lane.
 *
 * @param {string} key
 * @param {'solfege' | 'letters' | 'numbers'} style
 * @param {number} lane
 */
export function laneLabel(key, style, lane) {
  const { degree, octave } = LANES[lane];
  if (style === 'letters') return KEYS[key].names[degree - 1];
  if (style === 'numbers') {
    // Numbered notation marks octaves with a dot below (lower) or above (higher).
    if (octave < 0) return `${degree}̣`;
    if (octave > 0) return `${degree}̇`;
    return String(degree);
  }
  return SOLFEGE[degree - 1];
}

/** Human-readable chord name, e.g. `{ numeral: 'IV', name: 'F major' }`. */
export function chordInfo(key, roman) {
  const degrees = CHORDS[roman];
  const root = KEYS[key].names[degrees[0] - 1];
  if (roman === 'V7') return { degrees, numeral: 'V⁷', name: `${root}7` };
  const minor = roman === roman.toLowerCase();
  return { degrees, numeral: roman, name: `${root} ${minor ? 'minor' : 'major'}` };
}

/**
 * Voices a chord for the accompaniment. Every chord tone is placed in the same
 * octave-wide window just below the melody (re to do in the key's lower
 * octave), so shared notes stay put and the rest move by step between chords.
 * The root is doubled an octave below the window as a bass note.
 *
 * @returns {{ notes: number[], bass: number }} MIDI note numbers
 */
export function chordVoicing(key, roman) {
  const degrees = CHORDS[roman];
  const { tonic } = KEYS[key];
  const windowStart = tonic - 10;
  const placeInWindow = (degree) => {
    const pitch = tonic + MAJOR_SCALE[degree - 1];
    return windowStart + (((pitch - windowStart) % 12) + 12) % 12;
  };

  const notes = degrees.map(placeInWindow).sort((a, b) => a - b);
  return { notes, bass: placeInWindow(degrees[0]) - 12 };
}
