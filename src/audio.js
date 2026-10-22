/**
 * A tiny Web Audio synth: a bell-like lead, a soft chord pad and a
 * count-in click. The AudioContext is created lazily on the first user
 * gesture, since browsers block audio before one.
 */

const MASTER_VOLUME = 0.8;

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class Synth {
  #context = null;
  #master = null;
  #muted = false;

  /** Creates or resumes the audio context. Call from a user gesture. */
  unlock() {
    if (!this.#context) {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.#context = new AudioContextClass();
      this.#master = this.#context.createGain();
      this.#master.gain.value = this.#muted ? 0 : MASTER_VOLUME;
      const compressor = this.#context.createDynamicsCompressor();
      this.#master.connect(compressor);
      compressor.connect(this.#context.destination);
    }
    if (this.#context.state === 'suspended') this.#context.resume();
  }

  get muted() {
    return this.#muted;
  }

  set muted(value) {
    this.#muted = value;
    if (this.#master) this.#master.gain.value = value ? 0 : MASTER_VOLUME;
  }

  /**
   * Plays one melody note.
   *
   * @param {number} midi
   * @param {number} seconds
   * @param {{ volume?: number, muffled?: boolean }} [options]
   */
  note(midi, seconds, { volume = 1, muffled = false } = {}) {
    if (!this.#context) return;
    let output = this.#master;
    if (muffled) {
      output = this.#context.createBiquadFilter();
      output.type = 'lowpass';
      output.frequency.value = 650;
      output.connect(this.#master);
    }
    const frequency = midiToHz(midi);
    this.#voice('triangle', frequency, 0.3 * volume, 0.008, seconds, output);
    this.#voice('sine', frequency * 2, 0.09 * volume, 0.005, seconds * 0.6, output);
    this.#voice('sine', frequency * 3, 0.05 * volume, 0.003, 0.15, output);
  }

  /**
   * Plays a sustained chord with a bass note underneath.
   *
   * @param {{ notes: number[], bass: number }} voicing
   * @param {number} seconds
   */
  chord({ notes, bass }, seconds) {
    if (!this.#context) return;
    for (const note of notes) {
      this.#voice('sine', midiToHz(note), 0.045, 0.06, seconds, this.#master);
    }
    this.#voice('triangle', midiToHz(bass), 0.13, 0.02, Math.min(seconds, 1.4), this.#master);
  }

  /** A short metronome click; the accented one marks the final count. */
  tick(accent) {
    if (!this.#context) return;
    this.#voice('sine', accent ? 1568 : 1046, 0.12, 0.004, 0.09, this.#master);
  }

  #voice(type, frequency, peak, attack, seconds, output) {
    const start = this.#context.currentTime;
    const oscillator = this.#context.createOscillator();
    const envelope = this.#context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(peak, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }
}
