// The start screen: SALTWAKE over a slow drift across the evening town, the three jobs of the
// night, the controls, and what the save holds (Enter carries on from it, N starts over).
import { JOBS } from './jobs.js';

const FONT = 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif';

/** Where the title camera drifts: a slow loop over the Market and the Quay. */
export function titleCameraPoint(time) {
  return { x: 1300 + Math.cos(time * 0.05) * 420, y: 1450 + Math.sin(time * 0.05) * 300, zoom: 0.8 };
}

function line(ctx, text, x, y, weight, size, color, align) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align ?? 'left';
  ctx.fillText(text, x, y);
}

function key(ctx, label, x, y) {
  ctx.font = `800 14px ${FONT}`;
  const w = Math.max(30, ctx.measureText(label).width + 16);
  ctx.fillStyle = '#efe6cf';
  ctx.beginPath();
  ctx.roundRect(x, y - 18, w, 26, 5);
  ctx.fill();
  ctx.fillStyle = '#16181d';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y);
  return w;
}

/** Paint the start screen over the already-drawn town. */
export function drawTitle(ctx, w, h, save, time) {
  ctx.save();
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  const shade = ctx.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, 'rgba(6,10,20,0.94)');
  shade.addColorStop(0.62, 'rgba(6,10,20,0.78)');
  shade.addColorStop(1, 'rgba(6,10,20,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  const x = 72;
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '6px';
  line(ctx, 'AN ISLAND PORT · ONE EVENING · THREE JOBS', x + 4, 92, 800, 15, '#ffb35a');
  ctx.letterSpacing = '14px';
  ctx.font = `900 112px ${FONT}`;
  const grad = ctx.createLinearGradient(0, 110, 0, 210);
  grad.addColorStop(0, '#fff4dc');
  grad.addColorStop(1, '#e8b86a');
  ctx.fillStyle = grad;
  ctx.textAlign = 'left';
  ctx.fillText('SALTWAKE', x, 200);
  ctx.letterSpacing = '0px';
  // The wake under the name.
  ctx.strokeStyle = 'rgba(120,210,230,0.7)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 3; k += 1) {
    ctx.beginPath();
    for (let s = 0; s <= 600; s += 10) {
      const yy = 222 + k * 10 + Math.sin(s * 0.03 + time * 2 + k) * 3;
      if (s === 0) ctx.moveTo(x + s + k * 30, yy);
      else ctx.lineTo(x + s + k * 30, yy);
    }
    ctx.stroke();
  }
  line(ctx, 'You are Ivo Pell, a courier who doesn’t ask what’s in the bag.', x, 282, 500, 19, '#d8d0bd');
  ctx.letterSpacing = '3px';
  line(ctx, 'TONIGHT', x, 326, 800, 13, '#8d8878');
  ctx.letterSpacing = '0px';
  for (let i = 1; i <= 3; i += 1) {
    const y = 330 + i * 40;
    const done = save && save.job > i;
    const active = save ? save.job === i : i === 1;
    ctx.fillStyle = done ? '#3f7a52' : active ? '#ffb35a' : '#30343c';
    ctx.beginPath();
    ctx.arc(x + 14, y - 7, 14, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, done ? '✓' : String(i), x + 14, y - 1, 900, 16, done || active ? '#14161b' : '#c9c2b0', 'center');
    line(ctx, JOBS[i].title, x + 40, y - 1, 900, 22, done ? '#7f9a86' : '#f4ecd8');
  }
  line(ctx, 'The harbor watch patrols the ring. Hit someone or blow a job and they come for you.', x, 498, 500, 16, '#b9b3a6');
  const cx = x;
  let cy = 548;
  const rows = [
    [['W', 'A', 'S', 'D'], 'walk · drive'],
    [['SHIFT'], 'run'],
    [['E'], 'steal a car · get out'],
    [['SPACE', 'CLICK'], 'strike on foot · handbrake in a car'],
    [['MOUSE'], 'face on foot'],
    [['M'], 'mute'],
    [['P'], 'pause'],
  ];
  rows.forEach((row, i) => {
    const col = i < 4 ? 0 : 1;
    const yy = cy + (i % 4) * 34;
    let kx = cx + col * 470;
    for (const k of row[0]) kx += key(ctx, k, kx, yy) + 6;
    line(ctx, row[1], kx + 6, yy, 600, 15, '#d8d0bd');
  });
  const pulse = 0.65 + Math.sin(time * 4) * 0.35;
  ctx.globalAlpha = pulse;
  const start = save && save.job > 1 ? `PRESS ENTER — CARRY ON: ${save.job > 3 ? 'FREE ROAM' : `JOB ${save.job}`} · $${save.cash.toLocaleString('en-US')}` : 'PRESS ENTER TO START THE EVENING';
  line(ctx, start, w - 60, h - 52, 900, 22, '#ffcf4a', 'right');
  ctx.globalAlpha = 1;
  if (save) line(ctx, 'N — new evening (clears the save)', w - 60, h - 26, 600, 14, '#8d8878', 'right');
  ctx.restore();
}
