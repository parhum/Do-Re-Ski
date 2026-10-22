import { CHORDS, LANES } from './music.js';

const DISPLAY_FONT = 'Grandstander, system-ui, sans-serif';

/** CSS custom properties the canvas reads, so it follows the page theme. */
const COLOR_TOKENS = [
  'snow', 'snow-shade', 'lane', 'ink', 'ink-soft', 'accent', 'pine', 'pine-dark', 'trunk',
  'skin', 'blush', 'hat', 'scarf', 'eye', 'pompom', 'panel', 'on-dark', 'on-light',
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Deterministic pseudo-random number in [0, 1) for scenery placement. */
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const camelCase = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/** Slope geometry shared by rendering and input. */
export class Layout {
  constructor() {
    this.update(0, 0);
  }

  update(width, height) {
    const margin = clamp(width * 0.07, 18, 90);
    this.width = width;
    this.height = height;
    this.slopeWidth = Math.min(width - 2 * margin, 600);
    this.slopeLeft = (width - this.slopeWidth) / 2;
    this.laneWidth = this.slopeWidth / LANES.length;
    this.stripY = 62;
    this.skierY = clamp(height * 0.3, 150, 250);
    this.pxPerSecond = clamp(height * 0.22, 120, 210);
  }

  laneCenter(lane) {
    return this.slopeLeft + this.laneWidth * (lane + 0.5);
  }

  laneAt(x) {
    return clamp(Math.floor((x - this.slopeLeft) / this.laneWidth), 0, LANES.length - 1);
  }
}

/**
 * @typedef {object} Scene
 * @property {import('./run.js').Run} run
 * @property {{ x: number, vx: number }} skier
 * @property {number} scroll distance travelled down the slope, in px
 * @property {Array<{ x: number, y: number }>} trail ski tracks, y in slope coordinates
 * @property {import('./effects.js').Effects} effects
 * @property {number[]} pulse per-lane flash amount, 0–1
 * @property {(lane: number) => string} label
 * @property {string | null} countdown
 * @property {number} time seconds, for idle animation
 */

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Layout} layout
   */
  constructor(canvas, layout, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.layout = layout;
    this.reducedMotion = reducedMotion;
    this.colors = {};
    this.refreshColors();
  }

  /** Matches the backing store to the canvas's CSS size and device pixel ratio. */
  resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.layout.update(width, height);
  }

  refreshColors() {
    const styles = getComputedStyle(document.documentElement);
    for (const token of COLOR_TOKENS) {
      this.colors[camelCase(token)] = styles.getPropertyValue(`--${token}`).trim();
    }
  }

  laneColor(lane) {
    return this.colors[`d${LANES[lane].degree}`];
  }

  /** Re and mi are light hues, so their labels use dark text. */
  laneTextColor(lane) {
    const { degree } = LANES[lane];
    return degree === 2 || degree === 3 ? this.colors.onLight : this.colors.onDark;
  }

  /** @param {Scene} scene */
  draw(scene) {
    // The stylesheet can finish loading after this module first runs. Until it
    // does the tokens read back empty, and the canvas would draw everything black.
    if (!this.colors.snow) this.refreshColors();

    const chordDegrees = scene.run.chord ? CHORDS[scene.run.chord.roman] : [];
    this.#drawSlope(scene.scroll, chordDegrees);
    this.#drawTrees(scene.scroll);
    this.#drawTrail(scene.trail, scene.scroll);
    this.#drawGates(scene);
    this.#drawSkier(scene.skier, scene.time);
    this.#drawEffects(scene.effects);
    this.#drawNoteStrip(scene, chordDegrees);
    if (scene.countdown) this.#drawCountdown(scene.countdown);
  }

  #drawSlope(scroll, chordDegrees) {
    const ctx = this.context;
    const { width, height, slopeLeft, slopeWidth, laneWidth, stripY, skierY } = this.layout;

    ctx.fillStyle = this.colors.snowShade;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = this.colors.snow;
    ctx.fillRect(slopeLeft - 6, 0, slopeWidth + 12, height);

    // Wind-swept streaks in the snow.
    const band = 46;
    const firstBand = Math.floor(scroll / band);
    ctx.fillStyle = this.colors.lane;
    ctx.globalAlpha = 0.35;
    for (let k = firstBand; k < firstBand + height / band + 2; k++) {
      for (let j = 0; j < 3; j++) {
        const size = hash(k * 3 + j);
        if (size < 0.5) continue;
        ctx.beginPath();
        ctx.ellipse(
          slopeLeft + hash(k * 7 + j) * slopeWidth,
          k * band - scroll + hash(k + j * 13) * band,
          6 + size * 8, 1.6, 0, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }

    // Lanes holding a note of the current chord get a faint tint.
    ctx.globalAlpha = 0.07;
    LANES.forEach((lane, i) => {
      if (!chordDegrees.includes(lane.degree)) return;
      ctx.fillStyle = this.laneColor(i);
      ctx.fillRect(slopeLeft + i * laneWidth, 0, laneWidth, height);
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = this.colors.lane;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = scroll % 12;
    for (let i = 1; i < LANES.length; i++) {
      const x = Math.round(slopeLeft + i * laneWidth) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, stripY + 30);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // The line where gates sound.
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.moveTo(slopeLeft, skierY);
    ctx.lineTo(slopeLeft + slopeWidth, skierY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #drawTrees(scroll) {
    const { width, height, slopeLeft, slopeWidth } = this.layout;
    const spacing = 64;
    const first = Math.floor(scroll / spacing) - 1;
    const leftEdge = slopeLeft - 6;
    const rightEdge = slopeLeft + slopeWidth + 6;

    for (let k = first; k < first + height / spacing + 3; k++) {
      for (const side of [0, 1]) {
        const chance = hash(k * 2 + side * 977);
        if (chance < 0.25) continue;
        const room = side === 0 ? leftEdge : width - rightEdge;
        const size = clamp(room * 0.75, 16, 44) * (0.75 + chance * 0.4);
        const offset = room * (0.25 + hash(k + (side ? 57 : 31)) * 0.6);
        const x = side === 0 ? leftEdge - offset : rightEdge + offset;
        this.#drawTree(x, k * spacing - scroll + hash(k * 5) * 30, size);
      }
    }
  }

  #drawTree(x, y, size) {
    const ctx = this.context;
    ctx.fillStyle = this.colors.trunk;
    ctx.fillRect(x - size * 0.08, y + size * 0.35, size * 0.16, size * 0.25);

    const tiers = [
      [0.62, 0.45, this.colors.pineDark],
      [0.5, 0.1, this.colors.pine],
      [0.36, -0.22, this.colors.pine],
    ];
    for (const [halfWidth, base, color] of tiers) {
      ctx.fillStyle = color;
      this.#triangle(x, y + base * size - size * 0.42, halfWidth * size, y + base * size);
    }
    ctx.fillStyle = this.colors.snow;
    this.#triangle(x, y - 0.64 * size, 0.14 * size, y - 0.47 * size);
  }

  #triangle(apexX, apexY, halfWidth, baseY) {
    const ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + halfWidth, baseY);
    ctx.lineTo(apexX - halfWidth, baseY);
    ctx.closePath();
    ctx.fill();
  }

  #drawTrail(trail, scroll) {
    const ctx = this.context;
    ctx.strokeStyle = this.colors.lane;
    ctx.lineWidth = 2;
    for (const offset of [-5, 5]) {
      ctx.beginPath();
      let started = false;
      for (const point of trail) {
        const y = point.y - scroll;
        if (y < -10) continue;
        if (started) ctx.lineTo(point.x + offset, y);
        else ctx.moveTo(point.x + offset, y);
        started = true;
      }
      ctx.stroke();
    }
  }

  #drawGates({ run, label }) {
    const ctx = this.context;
    const { skierY, height } = this.layout;
    const pxPerBeat = (this.layout.pxPerSecond * 60) / run.bpm;
    const yOf = (note) => skierY + (note.beat - run.beat) * pxPerBeat;
    const visible = run.notes.filter((note) => {
      const y = yOf(note);
      return y > skierY - 120 && y < height + 60;
    });
    const upcoming = visible.filter((note) => note.result === null);

    // Held notes trail a ribbon as long as the note.
    ctx.globalAlpha = 0.22;
    for (const note of upcoming) {
      const length = note.duration * pxPerBeat - 14;
      if (length < 14) continue;
      ctx.fillStyle = this.laneColor(note.lane);
      ctx.beginPath();
      ctx.roundRect(this.layout.laneCenter(note.lane) - 4, yOf(note) + 10, 8, length, 4);
      ctx.fill();
    }

    // A dotted line traces the melody's contour.
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = this.colors.inkSoft;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    upcoming.forEach((note, i) => {
      const x = this.layout.laneCenter(note.lane);
      if (i === 0) ctx.moveTo(x, yOf(note));
      else ctx.lineTo(x, yOf(note));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    for (const note of visible) this.#drawGate(note, yOf(note), run.beat, label(note.lane));
  }

  #drawGate(note, y, beat, text) {
    const ctx = this.context;
    const { laneWidth } = this.layout;
    const x = this.layout.laneCenter(note.lane);
    const width = Math.min(laneWidth * 0.86, 62);
    const color = this.laneColor(note.lane);

    let alpha = 1;
    let spread = 0;
    if (note.result === 'miss') alpha = 0.3;
    if (note.result === 'hit') {
      const progress = Math.min(1, (beat - note.resolvedAt) * 2.5);
      alpha = 1 - progress;
      spread = progress * 8;
    }
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = this.colors.inkSoft;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      const poleX = x + side * (width / 2 + spread);
      ctx.beginPath();
      ctx.moveTo(poleX, y - 16);
      ctx.lineTo(poleX, y + 11);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(poleX, y - 16);
      ctx.lineTo(poleX - side * 9, y - 12);
      ctx.lineTo(poleX, y - 8);
      ctx.closePath();
      ctx.fill();
    }

    const bannerWidth = width - 6 + spread * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - bannerWidth / 2, y - 9, bannerWidth, 18, 9);
    ctx.fill();
    ctx.fillStyle = this.laneTextColor(note.lane);
    ctx.font = `800 ${this.#labelSize()}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.globalAlpha = 1;
  }

  #labelSize() {
    return clamp(this.layout.laneWidth * 0.3, 10, 14);
  }

  #drawSkier({ x, vx }, time) {
    const ctx = this.context;
    const s = clamp(this.layout.laneWidth * 0.5, 15, 26);
    const lean = clamp(vx / 700, -0.55, 0.55);
    const c = this.colors;

    ctx.save();
    ctx.translate(x, this.layout.skierY);

    ctx.globalAlpha = 0.12;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.9, s * 0.75, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Skis point downhill and turn into the direction of travel.
    ctx.fillStyle = c.hat;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.3, s * 0.15);
      ctx.rotate(-lean);
      ctx.beginPath();
      ctx.roundRect(-s * 0.09, -s * 0.55, s * 0.18, s * 1.7, s * 0.09);
      ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle = c.inkSoft;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * s * 0.55, -s * 0.35);
      ctx.lineTo(side * s * 0.8 - lean * s * 0.3, s * 0.55);
      ctx.stroke();
    }

    ctx.rotate(-lean * 0.35);

    // Scarf flutters uphill behind the skier.
    const wave = this.reducedMotion ? 0 : Math.sin(time * 9) * s * 0.12;
    ctx.fillStyle = c.scarf;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.72);
    ctx.quadraticCurveTo(s * 0.45 + wave + lean * s * 0.6, -s * 1.15, s * 0.3 + wave * 1.6 + lean * s, -s * 1.55);
    ctx.lineTo(s * 0.05 + wave + lean * s, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.18 + wave * 0.5, -s * 1.05, -s * 0.12, -s * 0.72);
    ctx.closePath();
    ctx.fill();

    this.#circle(0, -s * 0.3, s * 0.5, c.accent);
    for (const side of [-1, 1]) this.#circle(side * s * 0.55, -s * 0.35, s * 0.13, c.hat);

    this.#circle(0, -s * 0.95, s * 0.38, c.skin);
    ctx.fillStyle = c.scarf;
    ctx.fillRect(-s * 0.3, -s * 0.72, s * 0.6, s * 0.12);
    ctx.globalAlpha = 0.8;
    for (const side of [-1, 1]) this.#circle(side * s * 0.22, -s * 0.86, s * 0.07, c.blush);
    ctx.globalAlpha = 1;
    for (const side of [-1, 1]) this.#circle(side * s * 0.13, -s * 0.96, s * 0.05, c.eye);

    ctx.fillStyle = c.hat;
    ctx.beginPath();
    ctx.arc(0, -s * 1.02, s * 0.4, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    this.#circle(0, -s * 1.44, s * 0.13, c.pompom);

    ctx.restore();
  }

  #circle(x, y, radius, color) {
    const ctx = this.context;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  #drawEffects(effects) {
    const ctx = this.context;
    for (const p of effects.particles) {
      ctx.globalAlpha = clamp(p.life * 1.6, 0, 1);
      this.#circle(p.x, p.y, p.radius, p.color);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of effects.labels) {
      ctx.globalAlpha = Math.min(1, label.life * 2);
      ctx.fillStyle = label.color;
      ctx.font = `800 ${label.size}px ${DISPLAY_FONT}`;
      ctx.fillText(label.text, label.x, label.y);
    }
    ctx.globalAlpha = 1;
  }

  /** The scale laid across the top of the slope, with chord tones lit. */
  #drawNoteStrip({ skier, pulse, label }, chordDegrees) {
    const ctx = this.context;
    const { laneWidth, stripY } = this.layout;
    const currentLane = this.layout.laneAt(skier.x);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${this.#labelSize()}px ${DISPLAY_FONT}`;
    LANES.forEach((lane, i) => {
      const inChord = chordDegrees.includes(lane.degree);
      const flash = pulse[i];
      const x = this.layout.laneCenter(i);
      const width = laneWidth - 4 + flash * 4;

      ctx.fillStyle = inChord ? this.laneColor(i) : this.colors.panel;
      ctx.beginPath();
      ctx.roundRect(x - width / 2, stripY - flash * 2, width, 26 + flash * 4, 8);
      ctx.fill();
      if (i === currentLane) {
        ctx.strokeStyle = this.colors.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = inChord ? this.laneTextColor(i) : this.colors.inkSoft;
      ctx.fillText(label(i), x, stripY + 13);
    });
  }

  #drawCountdown(text) {
    const ctx = this.context;
    const { width, height, skierY } = this.layout;
    ctx.fillStyle = this.colors.accent;
    ctx.font = `800 ${Math.min(64, width * 0.14)}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, Math.min(height * 0.62, skierY + 200));
  }
}
