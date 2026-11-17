// Boot: a fixed 1280x720 canvas scaled to the window, the title -> play ->
// pause loop at a fixed 60 Hz step, and the ?shot=NAME staging path used by
// the screenshot tool, which raises window.__shotReady once a frame is drawn.

import { createWorld, stepWorld, snapCamera } from './game.js';
import { drawWorld } from './render.js';
import { drawHud } from './hud.js';
import { drawTitle, titleCamera } from './title.js';
import { stageShot } from './shots.js';
import { installInput, wasPressed, consume, endFrame } from './input.js';
import { loadSave, clearSave } from './save.js';
import { startAudio, updateAudio, sfx, toggleMute, toggleRadio } from './audio.js';

const W = 1280;
const H = 720;
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
}
window.addEventListener('resize', fit);
fit();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1);

function runShot() {
  const { world, mode } = stageShot(shot, seed);
  let frames = 0;
  const draw = () => {
    if (mode === 'title') {
      drawTitle(ctx, world, W, H, 0.2, null);
    } else {
      drawWorld(ctx, world, W, H);
      drawHud(ctx, world, W, H);
    }
    frames += 1;
    if (frames < 2) requestAnimationFrame(draw);
    else window.__shotReady = true;
  };
  requestAnimationFrame(draw);
}

function runGame() {
  let save = loadSave();
  let world = createWorld({ seed });
  let mode = 'title';
  let titleT = 0;
  let last = performance.now();
  let acc = 0;

  installInput(window, startAudio);

  function begin() {
    world = createWorld({ seed: seed + Math.floor(Math.random() * 1000), job: save ? save.job : 0, cash: save ? save.cash : 120 });
    snapCamera(world);
    mode = 'play';
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (consume('mute')) toggleMute();
    if (consume('radio')) toggleRadio();
    let stepped = false;

    if (mode === 'title') {
      titleT += dt;
      world.time += dt;
      titleCamera(world, titleT);
      drawTitle(ctx, world, W, H, titleT, save);
      if (wasPressed('start')) begin();
      if (wasPressed('pause') && save) {
        clearSave();
        save = null;
      }
    } else {
      if (consume('pause')) mode = mode === 'paused' ? 'play' : 'paused';
      if (mode === 'play') {
        acc += dt;
        while (acc >= STEP) {
          stepWorld(world, STEP, sfx);
          acc -= STEP;
          endFrame();
          stepped = true;
        }
      }
      const p = world.player;
      updateAudio(p.car ? p.car.speed : 0, Boolean(p.car), world.wanted.level, dt);
      drawWorld(ctx, world, W, H);
      drawHud(ctx, world, W, H);
      if (mode === 'paused') {
        ctx.fillStyle = 'rgba(16,12,28,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = '900 80px "Trebuchet MS", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd34d';
        ctx.fillText('PAUSED', W / 2, H / 2);
        ctx.font = '800 30px "Trebuchet MS", Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('P or ESC to drive on', W / 2, H / 2 + 60);
      }
    }
    if (mode !== 'play' || stepped) endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot();
else runGame();
