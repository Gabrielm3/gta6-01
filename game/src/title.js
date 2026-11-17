// The start screen: the island slowly drifting behind a big SALTWAKE logo,
// the pitch, the controls and the prompt to start.

import { drawWorld } from './render.js';

const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
const INK = '#14121c';

function line(ctx, str, x, y, size, color, weight = 800, align = 'center') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 5);
  ctx.strokeStyle = INK;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function titleCamera(world, t) {
  world.camera.x = 2300 + Math.cos(t * 0.05) * 700;
  world.camera.y = 1500 + Math.sin(t * 0.07) * 450;
  world.camera.zoom = 0.85;
}

export function drawTitle(ctx, world, W, H, t, save) {
  drawWorld(ctx, world, W, H);

  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(18,12,34,0.82)');
  g.addColorStop(0.62, 'rgba(18,12,34,0.55)');
  g.addColorStop(1, 'rgba(18,12,34,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(80, 170);
  ctx.rotate(-0.04);
  ctx.font = `900 150px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 22;
  ctx.strokeStyle = INK;
  ctx.strokeText('SALTWAKE', 0, 0);
  const lg = ctx.createLinearGradient(0, -70, 0, 70);
  lg.addColorStop(0, '#ffe27a');
  lg.addColorStop(0.55, '#ff8a3d');
  lg.addColorStop(1, '#ff4f8b');
  ctx.fillStyle = lg;
  ctx.fillText('SALTWAKE', 0, 0);
  ctx.restore();

  line(ctx, 'ONE COURIER. ONE LEDGER. ONE NIGHT ON THE ISLAND.', 86, 280, 30, '#ffffff', 800, 'left');
  line(ctx, 'You are Ivo Pell. The harbor watch is already awake.', 86, 330, 26, '#d8d4e8', 700, 'left');

  const rows = [
    ['W A S D / ARROWS', 'drive or walk'],
    ['E', 'take or leave a car'],
    ['SPACE', 'handbrake'],
    ['J', 'shove'],
    ['SHIFT', 'run'],
    ['R / M', 'radio / mute'],
  ];
  rows.forEach(([k, v], i) => {
    line(ctx, k, 86, 400 + i * 40, 26, '#ffd34d', 900, 'left');
    line(ctx, v, 360, 400 + i * 40, 26, '#ffffff', 700, 'left');
  });

  const blink = Math.floor(t * 2) % 2 === 0;
  const prompt = save && save.job > 0 ? `PRESS ENTER — CONTINUE JOB ${Math.min(3, save.job + 1)}` : 'PRESS ENTER TO START';
  if (blink) line(ctx, prompt, 86, H - 60, 40, '#7dff8a', 900, 'left');

  const tags = [['YARD', '#ffb547'], ['RIDGE', '#7fd16b'], ['QUAY', '#5fd4ff'], ['MARKET', '#ff7aa8']];
  tags.forEach(([name, color], i) => line(ctx, name, W - 60, 90 + i * 56, 40, color, 900, 'right'));
}
