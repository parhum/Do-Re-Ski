import { parseChords, parseMelody, sequenceLength } from './music.js';

/** Beats to keep scrolling after the last note before a run counts as over. */
const RUN_OUT_BEATS = 1.5;

/**
 * One trip down the slope: the song's timeline, the clock, and the score.
 * Rendering and sound stay outside; `advance` reports what happened through
 * callbacks.
 */
export class Run {
  #nextNote = 0;
  #nextChord = 0;
  #lastTick = -Infinity;

  /**
   * @param {import('./songs.js').Song} song
   * @param {{ tempoScale?: number, demo?: boolean }} [options]
   *   `demo` runs skip the count-in and are never scored by the UI.
   */
  constructor(song, { tempoScale = 1, demo = false } = {}) {
    this.song = song;
    this.demo = demo;
    this.bpm = song.bpm * tempoScale;
    this.beat = demo ? -1 : -song.beatsPerBar;
    this.notes = parseMelody(song.melody).map((note) => ({ ...note, result: null, resolvedAt: 0 }));
    this.chords = parseChords(song.chords);
    this.length = sequenceLength(this.notes);
    this.chord = null;
    this.hits = 0;
    this.streak = 0;
    this.bestStreak = 0;
  }

  get countInPulses() {
    return this.song.beatsPerBar / this.song.pulse;
  }

  /** Felt beats left in the count-in, or 0 once the song has started. */
  get countInRemaining() {
    return this.beat < 0 ? Math.ceil(-this.beat / this.song.pulse) : 0;
  }

  get beatsPerSecond() {
    return this.bpm / 60;
  }

  /** The next gate the skier will reach, or null once all have passed. */
  get upcomingNote() {
    return this.notes[this.#nextNote] ?? null;
  }

  get resolvedCount() {
    return this.#nextNote;
  }

  get accuracy() {
    return this.hits / this.notes.length;
  }

  get finished() {
    return this.beat > this.length + RUN_OUT_BEATS;
  }

  /**
   * Moves the clock forward and resolves every gate and chord it passes.
   *
   * @param {number} seconds
   * @param {() => number} currentLane the skier's lane at the moment a gate passes
   * @param {{
   *   onTick?: (accent: boolean) => void,
   *   onChord?: (chord: { roman: string, duration: number }, seconds: number) => void,
   *   onNote?: (note: object, lane: number, correct: boolean) => void,
   * }} [handlers]
   */
  advance(seconds, currentLane, { onTick, onChord, onNote } = {}) {
    this.beat += seconds * this.beatsPerSecond;

    // The count-in is one bar, clicked on the felt beat with the downbeat accented.
    if (this.beat < 0) {
      const pulse = Math.floor(this.beat / this.song.pulse);
      if (pulse > this.#lastTick) {
        this.#lastTick = pulse;
        onTick?.(pulse === -this.countInPulses);
      }
    }

    while (this.#nextChord < this.chords.length && this.chords[this.#nextChord].beat <= this.beat) {
      this.chord = this.chords[this.#nextChord++];
      onChord?.(this.chord, this.chord.duration / this.beatsPerSecond);
    }

    while (this.#nextNote < this.notes.length && this.notes[this.#nextNote].beat <= this.beat) {
      const note = this.notes[this.#nextNote++];
      const lane = currentLane();
      const correct = lane === note.lane;
      note.result = correct ? 'hit' : 'miss';
      note.resolvedAt = this.beat;
      if (correct) {
        this.hits++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
      } else {
        this.streak = 0;
      }
      onNote?.(note, lane, correct);
    }
  }
}
