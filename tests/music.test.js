import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHORDS,
  KEYS,
  LANES,
  MAJOR_SCALE,
  chordInfo,
  chordVoicing,
  laneLabel,
  laneMidi,
  parseChords,
  parseMelody,
  sequenceLength,
} from '../src/music.js';
import { Run } from '../src/run.js';
import { SONGS } from '../src/songs.js';

describe('parseMelody', () => {
  it('reads degrees, low sol and durations', () => {
    assert.deepEqual(parseMelody('1 L-2 8-.5'), [
      { lane: 1, beat: 0, duration: 1 },
      { lane: 0, beat: 1, duration: 2 },
      { lane: 8, beat: 3, duration: 0.5 },
    ]);
  });

  it('rejects unknown notes and bad durations', () => {
    assert.throws(() => parseMelody('9'), /Unknown melody note/);
    assert.throws(() => parseMelody('1-0'), /Invalid duration/);
    assert.throws(() => parseMelody('1-x'), /Invalid duration/);
  });
});

describe('parseChords', () => {
  it('rejects unknown numerals', () => {
    assert.throws(() => parseChords('I-4 VIII-4'), /Unknown chord/);
  });
});

describe('laneMidi', () => {
  it('maps lanes to the C major scale from low G to high C', () => {
    const notes = LANES.map((_, lane) => laneMidi('C', lane));
    assert.deepEqual(notes, [55, 60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('keeps the same whole and half step pattern in every key', () => {
    const steps = (key) => LANES.slice(1).map((_, i) => laneMidi(key, i + 1) - laneMidi(key, i));
    for (const key of Object.keys(KEYS)) assert.deepEqual(steps(key), steps('C'), key);
  });
});

describe('laneLabel', () => {
  it('labels lanes by solfège, letter or scale degree', () => {
    assert.equal(laneLabel('G', 'solfege', 3), 'mi');
    assert.equal(laneLabel('G', 'letters', 7), 'F♯');
    assert.equal(laneLabel('G', 'numbers', 5), '5');
  });
});

describe('chords', () => {
  it('names chords in the current key', () => {
    assert.equal(chordInfo('F', 'IV').name, 'B♭ major');
    assert.equal(chordInfo('C', 'vi').name, 'A minor');
    assert.equal(chordInfo('D', 'V7').name, 'A7');
  });

  it('voices C major chords smoothly below the melody', () => {
    assert.deepEqual(chordVoicing('C', 'I'), { notes: [52, 55, 60], bass: 48 });
    assert.deepEqual(chordVoicing('C', 'IV'), { notes: [53, 57, 60], bass: 41 });
    assert.deepEqual(chordVoicing('C', 'V'), { notes: [50, 55, 59], bass: 43 });
  });

  it('voices every chord with the right pitches in a one-octave window', () => {
    for (const [key, { tonic }] of Object.entries(KEYS)) {
      for (const [roman, degrees] of Object.entries(CHORDS)) {
        const { notes, bass } = chordVoicing(key, roman);
        const expected = degrees.map((d) => (tonic + MAJOR_SCALE[d - 1]) % 12).sort((a, b) => a - b);
        const actual = notes.map((n) => n % 12).sort((a, b) => a - b);
        assert.deepEqual(actual, expected, `${roman} in ${key}`);
        for (const note of notes) assert.ok(note >= tonic - 10 && note < tonic + 2, `${roman} in ${key}`);
        assert.equal(bass % 12, (tonic + MAJOR_SCALE[degrees[0] - 1]) % 12, `${roman} bass in ${key}`);
        assert.ok(bass < notes[0], `${roman} bass in ${key}`);
      }
    }
  });
});

describe('song library', () => {
  for (const song of SONGS) {
    describe(song.title, () => {
      const melody = parseMelody(song.melody);
      const chords = parseChords(song.chords);

      it('has chords covering exactly the melody', () => {
        assert.equal(sequenceLength(chords), sequenceLength(melody));
      });

      it('fills every bar', () => {
        assert.equal(sequenceLength(melody) % song.beatsPerBar, 0);
      });

      it('fits a whole number of felt beats in a bar', () => {
        assert.ok(Number.isInteger(song.beatsPerBar / song.pulse));
      });
    });
  }

  it('uses unique ids', () => {
    assert.equal(new Set(SONGS.map((song) => song.id)).size, SONGS.length);
  });
});

describe('Run count-in', () => {
  const countIn = (song) => {
    const run = new Run(song);
    const ticks = [];
    for (let i = 0; i < 400 && run.beat < 0; i++) run.advance(0.01, () => 1, { onTick: (accent) => ticks.push(accent) });
    return ticks;
  };

  it('clicks four beats in 4/4, accenting the downbeat', () => {
    assert.deepEqual(countIn(SONGS.find((s) => s.meter === '4/4')), [true, false, false, false]);
  });

  it('clicks two dotted-quarter beats in 6/8', () => {
    assert.deepEqual(countIn(SONGS.find((s) => s.meter === '6/8')), [true, false]);
  });
});
