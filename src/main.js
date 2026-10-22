import { Synth } from './audio.js';
import { Effects } from './effects.js';
import { KEYS, LANES, SOLFEGE, chordInfo, chordVoicing, laneLabel, laneMidi, parseMelody } from './music.js';
import { Layout, Renderer, clamp } from './render.js';
import { Run } from './run.js';
import { SONGS } from './songs.js';

const DIFFICULTIES = [
  { name: 'Bunny slope', tempoScale: 0.8 },
  { name: 'Blue run', tempoScale: 1 },
  { name: 'Black diamond ◆', tempoScale: 1.22 },
];
const LABEL_STYLES = [
  { id: 'solfege', name: 'do re mi' },
  { id: 'letters', name: 'C D E' },
  { id: 'numbers', name: '1 2 3' },
];
const STORAGE_KEY = 'do-re-ski:best-stars';
const STEER_RESPONSE = 13;
const TRAIL_LENGTH = 400;

const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $('slope');
const layout = new Layout();
const renderer = new Renderer(canvas, layout, { reducedMotion });
const synth = new Synth();
const effects = new Effects({ reducedMotion });

const settings = { song: 0, key: 'C', labels: 'solfege', difficulty: 1 };
const bestStars = loadBestStars();

/** @type {'menu' | 'playing' | 'paused' | 'results'} */
let screen = 'menu';
let run = createRun({ demo: true });
let scroll = 0;
let trail = [];
const skier = { x: 0, targetX: 0, vx: 0 };
const pulse = new Array(LANES.length).fill(0);

// ---------- Persistence ----------

/** Best star rating per song id. Anything unexpected in storage is discarded. */
function loadBestStars() {
  const stars = {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    for (const { id } of SONGS) {
      const value = saved?.[id];
      if (Number.isInteger(value) && value >= 0 && value <= 3) stars[id] = value;
    }
  } catch {
    // Storage can be unavailable (private mode) or corrupt; start fresh.
  }
  return stars;
}

function saveBestStars() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bestStars));
  } catch {
    // Best scores are a convenience; ignore write failures.
  }
}

// ---------- Game ----------

function createRun({ demo }) {
  const { tempoScale } = DIFFICULTIES[settings.difficulty];
  return new Run(SONGS[settings.song], { tempoScale, demo });
}

const labelFor = (lane) => laneLabel(settings.key, settings.labels, lane);
const currentLane = () => layout.laneAt(skier.x);

const runHandlers = {
  onTick: (accent) => synth.tick(accent),

  onChord(chord, seconds) {
    synth.chord(chordVoicing(settings.key, chord.roman), seconds + 0.2);
    updateChordDisplay({ animate: true });
  },

  onNote(note, lane, correct) {
    pulse[lane] = 1;
    const seconds = Math.max(0.4, (note.duration / run.beatsPerSecond) * 1.15);
    // You hear the lane you are in, so a wrong lane sounds wrong.
    synth.note(laneMidi(settings.key, lane), seconds, correct ? {} : { volume: 0.55, muffled: true });

    if (correct) {
      effects.burst(layout.laneCenter(note.lane), layout.skierY, renderer.laneColor(note.lane), 12);
      if (run.streak % 8 === 0) {
        effects.text(skier.x, layout.skierY - 54, `${run.streak} in a row!`, renderer.colors.accent, 18);
      }
    } else {
      effects.burst(skier.x, layout.skierY + 10, renderer.colors.lane, 8);
      effects.text(layout.laneCenter(note.lane), layout.skierY - 40, `needed ${labelFor(note.lane)}`, renderer.colors.inkSoft, 13);
    }
    updateScoreDisplay();
  },
};

const demoHandlers = {
  onNote: (note, lane) => { pulse[lane] = 1; },
};

function update(seconds) {
  if (screen === 'paused') return;

  run.advance(seconds, currentLane, run.demo ? demoHandlers : runHandlers);
  scroll += layout.pxPerSecond * seconds;

  // In the demo the skier steers itself toward the next gate.
  if (run.demo && run.upcomingNote) skier.targetX = layout.laneCenter(run.upcomingNote.lane);

  const nextX = skier.x + (skier.targetX - skier.x) * (1 - Math.exp(-seconds * STEER_RESPONSE));
  skier.vx = seconds > 0 ? (nextX - skier.x) / seconds : 0;
  skier.x = nextX;

  trail.push({ x: skier.x, y: scroll + layout.skierY });
  if (trail.length > TRAIL_LENGTH) trail.shift();

  effects.update(seconds, layout.pxPerSecond);
  for (let i = 0; i < pulse.length; i++) pulse[i] = Math.max(0, pulse[i] - seconds * 3);

  if (run.finished) {
    if (run.demo) run = createRun({ demo: true });
    else finishRun();
  }
}

function countdownText() {
  if (run.demo || screen !== 'playing' || run.beat >= 0.6) return null;
  if (run.beat >= 0) return 'Go!';
  const remaining = run.countInRemaining;
  return remaining > 3 ? 'Ready' : String(remaining);
}

let lastFrame = performance.now();
function frame(now) {
  const seconds = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(seconds);
  renderer.draw({
    run,
    skier,
    scroll,
    trail,
    effects,
    pulse,
    label: labelFor,
    countdown: countdownText(),
    time: now / 1000,
  });
  requestAnimationFrame(frame);
}

// ---------- Screens ----------

function showScreen(name) {
  screen = name;
  $('menu').hidden = name !== 'menu';
  $('results').hidden = name !== 'results';
  $('pause').hidden = name !== 'paused';
  $('hud').hidden = name !== 'playing' && name !== 'paused';
}

function startRun() {
  synth.unlock();
  run = createRun({ demo: false });
  effects.clear();
  skier.targetX = layout.laneCenter(1);
  $('hud-song').textContent = run.song.title;
  $('hud-key').textContent = `${settings.key} major · ${DIFFICULTIES[settings.difficulty].name}`;
  updateScoreDisplay();
  updateChordDisplay({ animate: false });
  showScreen('playing');
}

function finishRun() {
  const { accuracy, hits, bestStreak, song, notes } = run;
  const stars = accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : accuracy >= 0.5 ? 1 : 0;
  if (stars > (bestStars[song.id] ?? 0)) {
    bestStars[song.id] = stars;
    saveBestStars();
  }

  const titles = ['Wipeout! Try the bunny slope', 'Made it down', 'Nice carving', 'Fresh tracks!'];
  renderStars($('result-stars'), stars);
  $('result-title').textContent = accuracy === 1 ? 'Perfect powder!' : titles[stars];
  $('result-hits').textContent = `${hits}/${notes.length}`;
  $('result-accuracy').textContent = `${Math.round(accuracy * 100)}%`;
  $('result-streak').textContent = String(bestStreak);
  $('result-lesson').textContent = song.lesson;

  const otherKeys = Object.keys(KEYS).filter((key) => key !== settings.key);
  const nextKey = otherKeys[Math.floor(Math.random() * otherKeys.length)];
  $('result-key-tip').textContent =
    `Try it in ${nextKey} major next. Every pitch moves, but the gates stay in the same lanes, ` +
    'because every major key uses the same pattern of whole and half steps.';

  run = createRun({ demo: true });
  showScreen('results');
}

function pause() {
  if (screen === 'playing') showScreen('paused');
}

function resume() {
  synth.unlock();
  showScreen('playing');
}

function returnToMenu() {
  run = createRun({ demo: true });
  buildMenu();
  showScreen('menu');
}

// ---------- HUD ----------

function updateScoreDisplay() {
  $('hud-score').textContent = `${run.hits}/${run.resolvedCount}`;
  $('hud-streak').textContent = run.streak >= 3 ? `${run.streak} in a row` : '';
}

function updateChordDisplay({ animate }) {
  if (!run.chord) {
    $('chord-numeral').textContent = '–';
    $('chord-name').textContent = 'count-in';
    return;
  }
  const { numeral, name } = chordInfo(settings.key, run.chord.roman);
  $('chord-numeral').textContent = numeral;
  $('chord-name').textContent = name;
  if (animate && !reducedMotion) {
    const chip = $('chord');
    chip.classList.add('pop');
    setTimeout(() => chip.classList.remove('pop'), 140);
  }
}

function renderStars(container, count) {
  const stars = [];
  for (let i = 0; i < 3; i++) {
    const star = document.createElement('span');
    star.textContent = '★';
    if (i >= count) star.className = 'off';
    stars.push(star);
  }
  container.replaceChildren(...stars);
  container.setAttribute('aria-label', `${count} of 3 stars`);
}

// ---------- Menu ----------

function buildMenu() {
  // Rebuilding replaces the buttons, so restore keyboard focus afterwards.
  const focusedId = document.activeElement?.id;
  $('song-list').replaceChildren(...SONGS.map(songButton));
  buildPills('key-options', Object.keys(KEYS).map((key) => ({ id: key, name: key })), 'key');
  buildPills('label-options', LABEL_STYLES, 'labels');
  buildPills('difficulty-options', DIFFICULTIES.map((d, i) => ({ id: i, name: d.name })), 'difficulty');
  if (focusedId) document.getElementById(focusedId)?.focus();
}

function songButton(song, index) {
  const lanes = [...new Set(parseMelody(song.melody).map((note) => note.lane))].sort((a, b) => a - b);
  const button = element('button', { className: 'song', id: `song-${song.id}` });
  button.setAttribute('aria-pressed', String(settings.song === index));

  const dots = element('span', { className: 'dots' });
  for (const lane of lanes) {
    const dot = element('i');
    dot.style.setProperty('background', `var(--d${LANES[lane].degree})`);
    dots.append(dot);
  }

  const noteNames = lanes.map((lane) => {
    const name = SOLFEGE[LANES[lane].degree - 1];
    return lane === 0 ? `low ${name}` : lane === LANES.length - 1 ? `high ${name}` : name;
  });
  const text = element('span', { className: 'text' });
  text.append(
    element('b', { textContent: song.title }),
    element('span', { textContent: `${song.meter} · ${noteNames.join(' ')}` }),
  );

  const best = element('span', { className: 'best' });
  renderStars(best, bestStars[song.id] ?? 0);

  button.append(dots, text, best);
  button.addEventListener('click', () => {
    settings.song = index;
    run = createRun({ demo: true });
    buildMenu();
  });
  return button;
}

function buildPills(containerId, options, setting) {
  const buttons = options.map((option) => {
    const button = element('button', { className: 'pill', id: `${containerId}-${option.id}`, textContent: option.name });
    button.setAttribute('aria-pressed', String(settings[setting] === option.id));
    button.addEventListener('click', () => {
      settings[setting] = option.id;
      if (setting === 'difficulty') run = createRun({ demo: true });
      buildMenu();
    });
    return button;
  });
  $(containerId).replaceChildren(...buttons);
}

function element(tag, properties = {}) {
  return Object.assign(document.createElement(tag), properties);
}

// ---------- Input ----------

function steerToPointer(event) {
  if (screen === 'playing') skier.targetX = event.clientX - canvas.getBoundingClientRect().left;
}

function onKeyDown(event) {
  const isPauseKey = event.key === 'Escape' || event.key.toLowerCase() === 'p';
  if (screen === 'paused' && isPauseKey) {
    resume();
    return;
  }
  if (screen !== 'playing') return;

  const lane = layout.laneAt(skier.targetX);
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    skier.targetX = layout.laneCenter(clamp(lane - 1, 0, LANES.length - 1));
    event.preventDefault();
  } else if (key === 'arrowright' || key === 'd') {
    skier.targetX = layout.laneCenter(clamp(lane + 1, 0, LANES.length - 1));
    event.preventDefault();
  } else if (isPauseKey) {
    pause();
  }
}

function onResize() {
  // Keep the skier in the same lane when the slope changes width.
  const lane = layout.laneAt(skier.x);
  const targetLane = layout.laneAt(skier.targetX);
  renderer.resize();
  skier.x = layout.laneCenter(lane);
  skier.targetX = layout.laneCenter(targetLane);
  trail = [];
}

function toggleMute() {
  synth.muted = !synth.muted;
  const button = $('mute-button');
  button.textContent = synth.muted ? '×' : '♪';
  button.setAttribute('aria-label', synth.muted ? 'Unmute sound' : 'Mute sound');
}

// ---------- Start ----------

$('start-button').addEventListener('click', startRun);
$('again-button').addEventListener('click', startRun);
$('menu-button').addEventListener('click', returnToMenu);
$('resume-button').addEventListener('click', resume);
$('quit-button').addEventListener('click', returnToMenu);
$('pause-button').addEventListener('click', pause);
$('mute-button').addEventListener('click', toggleMute);

canvas.addEventListener('pointermove', steerToPointer);
canvas.addEventListener('pointerdown', steerToPointer);
window.addEventListener('keydown', onKeyDown);
// Observe the canvas rather than the window: its size also changes when the
// stylesheet finishes loading, which no window resize event reports.
new ResizeObserver(onResize).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('load', () => renderer.refreshColors());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderer.refreshColors());

renderer.resize();
skier.x = skier.targetX = layout.laneCenter(1);
buildMenu();
showScreen('menu');
requestAnimationFrame(frame);
