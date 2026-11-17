// Boot and the one loop for SALTWAKE. The canvas fills the window; the town advances in fixed
// 1/60 s steps and is painted once a frame. Screens: the title (the town drifting behind it),
// play, paused. The save is written whenever the job or the cash changes.
//
// ?shot=chase|street|title|pier&seed=N stages that scene instead (no sound, no storage), paints
// it twice and then sets window.__shotReady for the screenshot.
import { paintGround } from './city.js';
import { createAudio } from './audio.js';
import { createGame, STEP, stepGame } from './game.js';
import { createHudState, drawHud, paintMinimap } from './hud.js';
import { createInput, idleControls } from './input.js';
import { JOBS } from './jobs.js';
import { createCamera, drawWorld, followCamera, screenToWorld } from './render.js';
import { clearSave, loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';
import { drawTitle, titleCameraPoint } from './title.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const dusk = document.createElement('canvas');
const cam = createCamera();

function fitCanvas() {
  const dpr = shot ? 1 : Math.min(2, window.devicePixelRatio || 1);
  cam.w = window.innerWidth;
  cam.h = window.innerHeight;
  canvas.width = Math.round(cam.w * dpr);
  canvas.height = Math.round(cam.h * dpr);
}

function prepareCity(state) {
  state.city.ground ??= paintGround(state.city);
  state.city.minimap ??= paintMinimap(state.city);
}

function placeTitleCamera(time) {
  const point = titleCameraPoint(time);
  cam.x = point.x;
  cam.y = point.y;
  cam.zoom = point.zoom;
}

function runShot(name) {
  fitCanvas();
  const scene = stageShot(name, seed);
  prepareCity(scene.state);
  const hud = createHudState();
  if (scene.screen === 'title') placeTitleCamera(scene.state.time);
  else followCamera(cam, scene.state, 0, true);
  let painted = 0;
  function paint() {
    drawWorld(ctx, dusk, cam, scene.state, scene.screen !== 'title');
    if (scene.screen === 'title') drawTitle(ctx, cam.w, cam.h, scene.save, scene.state.time);
    else drawHud(ctx, scene.state, cam, hud, 0, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  const input = createInput(canvas);
  const audio = createAudio();
  let save = loadSave();
  let state = createGame(seed, save);
  prepareCity(state);
  let screen = 'title';
  let hud = createHudState();
  let accumulator = 0;
  let last = performance.now();
  let pending = { enter: false, strike: false };
  let saved = { job: save?.job ?? 0, cash: save?.cash ?? -1 };
  window.__game = { get state() { return state; }, get screen() { return screen; } };

  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  function announce(message) {
    status.textContent = message;
  }

  function begin(fresh) {
    if (fresh) {
      clearSave();
      save = null;
    }
    state = createGame(seed + 1, fresh ? null : save);
    hud = createHudState();
    followCamera(cam, state, 0, true);
    screen = 'play';
    announce(`Job ${state.job.id}: ${JOBS[state.job.id].title}.`);
  }

  function keepSave() {
    if (state.job.id !== saved.job || state.cash !== saved.cash) {
      writeSave(state.job.id, state.cash);
      saved = { job: state.job.id, cash: state.cash };
    }
  }

  function speak(events) {
    for (const e of events) {
      if (e === 'job') announce(`Job ${state.job.id}: ${JOBS[state.job.id].title}. ${JOBS[state.job.id].brief}`);
      else if (e === 'wanted') announce(`Wanted level ${state.wanted.level}.`);
      else if (e === 'blown') announce('Blown. The harbor watch is coming.');
      else if (e === 'down') announce('Knocked out.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const controls = screen === 'title' ? input.controls(() => null) : input.controls((sx, sy) => screenToWorld(cam, sx, sy));
    if (controls.mute) audio.toggleMute();
    if (screen === 'title') {
      if (controls.fresh) begin(true);
      else if (controls.confirm) begin(false);
    } else if (controls.pause) {
      screen = screen === 'paused' ? 'play' : 'paused';
      announce(screen === 'paused' ? 'Paused.' : 'Playing.');
    }
    pending.enter ||= controls.enter;
    pending.strike ||= controls.strike;
    if (screen === 'paused') {
      accumulator = 0;
    } else {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        const stepControls = screen === 'play' ? { ...controls, ...pending } : idleControls();
        pending = { enter: false, strike: false };
        const events = stepGame(state, stepControls, STEP);
        if (screen === 'play') {
          audio.play(events);
          speak(events);
        }
        accumulator -= STEP;
      }
    }
    if (screen === 'title') placeTitleCamera(state.time);
    else {
      followCamera(cam, state, elapsed, false);
      keepSave();
    }
    audio.update(state, screen === 'play');
    drawWorld(ctx, dusk, cam, state, screen !== 'title');
    if (screen === 'title') drawTitle(ctx, cam.w, cam.h, save, state.time);
    else drawHud(ctx, state, cam, hud, elapsed, screen === 'paused');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'paused';
  });
  announce('SALTWAKE. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
