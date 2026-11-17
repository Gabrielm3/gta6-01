// The heads-up display, sized to read in a small photo: job panel, cash,
// five wanted pips, health and speed, the minimap, an arrow to the target,
// toasts and the busted banner.

import { T, COLS, ROWS, WATER, SAND, ROAD, PIER, WALK, BUILDING, WORLD_W, WORLD_H, districtAt } from './city.js';
import { currentJob, jobMarker } from './jobs.js';
import { MAX_PIPS } from './wanted.js';

const FONT = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
const INK = '#14121c';

let mapCanvas = null;

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(16,14,26,${alpha})`;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, align = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size / 6);
  ctx.strokeStyle = INK;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bakeMinimap(city) {
  const c = document.createElement('canvas');
  c.width = COLS * 4;
  c.height = ROWS * 4;
  const g = c.getContext('2d');
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      const t = city.tiles[r * COLS + col];
      g.fillStyle = t === WATER ? '#14a6d6' : t === SAND ? '#ffe3a1' : t === ROAD ? '#ffffff'
        : t === PIER ? '#cf9452' : t === WALK ? '#eee8db' : t === BUILDING ? '#8a8496' : '#62c94c';
      g.fillRect(col * 4, r * 4, 4, 4);
    }
  }
  return c;
}

function drawPips(ctx, wanted, x, y, time) {
  const R = 25;
  const gap = 60;
  panel(ctx, x - 22, y - 38, gap * MAX_PIPS + 16, 76);
  for (let i = 0; i < MAX_PIPS; i++) {
    const cx = x + 18 + i * gap;
    const lit = i < wanted.level;
    const blink = wanted.flash > 0 && Math.floor(time * 8) % 2 === 0;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5;
      const rr = k % 2 === 0 ? R : R * 0.46;
      ctx.lineTo(cx + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = lit ? (blink ? '#ffffff' : '#ffb300') : 'rgba(255,255,255,0.14)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.fill();
    ctx.stroke();
  }
}

function drawMinimap(ctx, world, x, y, w, h) {
  if (!mapCanvas) mapCanvas = bakeMinimap(world.city);
  const { player } = world;
  const body = player.car || player;
  const scale = 4 / T;
  const span = 1.6;
  ctx.save();
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.9);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = '#14a6d6';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.scale(span, span);
  ctx.translate(-body.x * scale, -body.y * scale);
  ctx.drawImage(mapCanvas, 0, 0);
  const m = jobMarker(world);
  for (const car of world.cars) {
    if (car.kind === 'watch' && car.driver === 'watch') {
      ctx.fillStyle = Math.floor(world.time * 6) % 2 ? '#ff5a1f' : '#ffb300';
      ctx.beginPath();
      ctx.arc(car.x * scale, car.y * scale, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (m) {
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x * scale, m.y * scale, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  const m2 = jobMarker(world);
  if (m2) {
    const dx = (m2.x - body.x) * scale * span;
    const dy = (m2.y - body.y) * scale * span;
    if (Math.abs(dx) > w / 2 - 10 || Math.abs(dy) > h / 2 - 10) {
      const k = Math.min((w / 2 - 14) / Math.abs(dx || 1), (h / 2 - 14) / Math.abs(dy || 1));
      ctx.fillStyle = '#ffd34d';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx + dx * k, cy + dy * k, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((body.angle ?? player.face) + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const d = districtAt(body.x, body.y);
  text(ctx, d.name, x + w / 2, y + h + 30, 30, d.color, 'center');
}

function drawTargetArrow(ctx, world, W, H) {
  const m = jobMarker(world);
  if (!m) return;
  const cam = world.camera;
  const sx = (m.x - cam.x) * cam.zoom + W / 2;
  const sy = (m.y - cam.y) * cam.zoom + H / 2;
  if (sx > 60 && sx < W - 60 && sy > 60 && sy < H - 60) return;
  const a = Math.atan2(sy - H / 2, sx - W / 2);
  const rx = W / 2 - 90;
  const ry = H / 2 - 90;
  const k = Math.min(rx / Math.abs(Math.cos(a) || 0.001), ry / Math.abs(Math.sin(a) || 0.001));
  ctx.save();
  ctx.translate(W / 2 + Math.cos(a) * k, H / 2 + Math.sin(a) * k);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-18, -24);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-18, 24);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const dist = Math.hypot(m.x - (world.player.car || world.player).x, m.y - (world.player.car || world.player).y);
  const tx = W / 2 + Math.cos(a) * (k - 62);
  const ty = H / 2 + Math.sin(a) * (k - 62);
  text(ctx, `${Math.round(dist / T * 4)}m`, tx, ty, 26, '#ffd34d', 'center');
}

export function drawHud(ctx, world, W, H) {
  const { player, wanted, jobs } = world;
  const job = currentJob(jobs);

  panel(ctx, 20, 20, 560, job ? 118 : 72);
  if (job) {
    text(ctx, `JOB ${jobs.index + 1}/3`, 42, 50, 24, '#ffd34d');
    text(ctx, job.title, 160, 50, 34, '#ffffff');
    text(ctx, job.hint, 42, 104, 21, '#d8d4e8', 'left', 700);
  } else {
    text(ctx, 'FREE ROAM — SALTWAKE AT MIDDAY', 42, 56, 28, '#ffd34d');
  }
  if (jobs.ledger) {
    panel(ctx, 20, 146, 200, 48);
    text(ctx, 'LEDGER ✓', 40, 170, 28, '#7dff8a', 'left', 900);
  }

  drawPips(ctx, wanted, W - 330, 58, world.time);
  if (wanted.level > 0) {
    const cool = Math.min(1, wanted.unseen / 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(W - 340, 92, 290, 8);
    ctx.fillStyle = cool > 0 ? '#5fd4ff' : '#ff5a1f';
    ctx.fillRect(W - 340, 92, 290 * (cool > 0 ? cool : 1), 8);
  }
  panel(ctx, W - 330, 112, 310, 72);
  text(ctx, `$${Math.round(world.cash).toLocaleString('en-US')}`, W - 40, 149, 50, '#7dff8a', 'right', 900);

  panel(ctx, W - 330, 196, 310, 58);
  const live = Boolean(player.car);
  for (let i = 0; i < 4; i++) {
    const h = live ? 10 + Math.abs(Math.sin(world.time * (5 + i * 1.7) + i)) * 22 : 6;
    ctx.fillStyle = live ? '#ff7aa8' : 'rgba(255,122,168,0.4)';
    ctx.fillRect(W - 316 + i * 12, 240 - h, 8, h);
  }
  text(ctx, 'HARBOR FM', W - 260, 225, 30, live ? '#ff7aa8' : '#c7a3b5', 'left', 900);
  text(ctx, live ? '98.4' : 'OFF', W - 34, 225, 18, '#ffffff', 'right', 800);

  drawMinimap(ctx, world, 26, H - 246, 270, 180);

  const hx = W - 330;
  const hy = H - 104;
  panel(ctx, hx, hy, 310, 84);
  const hp = Math.max(0, player.car ? player.car.health : player.health) / 100;
  text(ctx, player.car ? 'CAR' : 'IVO', hx + 22, hy + 26, 22, '#ffffff');
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(hx + 82, hy + 16, 206, 20);
  ctx.fillStyle = hp > 0.35 ? '#5be37a' : '#ff5a4f';
  ctx.fillRect(hx + 82, hy + 16, 206 * hp, 20);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(hx + 82, hy + 16, 206, 20);
  const speed = player.car ? Math.abs(player.car.speed) * 0.25 : 0;
  text(ctx, player.car ? `${Math.round(speed)} KM/H` : 'ON FOOT', hx + 288, hy + 60, 30, '#ffffff', 'right', 900);

  drawTargetArrow(ctx, world, W, H);

  if (jobs.warn > 0) text(ctx, 'KEEP MOVING!', W / 2, H / 2 - 150, 56, '#ff6b6b', 'center', 900);
  if (jobs.toast) text(ctx, jobs.toast.text, W / 2, 200, 38, jobs.toast.color, 'center', 900);
  world.feed.forEach((f, i) => text(ctx, f.text, W / 2, H - 60 - i * 38, 26, f.color, 'center'));

  if (world.bustTimer > 0.2 && wanted.level > 0) {
    text(ctx, 'THE WATCH IS ON YOU — MOVE!', W / 2, H / 2 + 120, 40, '#ffb300', 'center', 900);
  }
  if (world.banner) {
    ctx.fillStyle = 'rgba(20,10,30,0.55)';
    ctx.fillRect(0, H / 2 - 90, W, 180);
    text(ctx, world.banner.text, W / 2, H / 2 - 22, 64, '#ff6b6b', 'center', 900);
    text(ctx, world.banner.sub, W / 2, H / 2 + 48, 34, '#ffffff', 'center');
  }
  if (!player.car) {
    const near = world.cars.some((c) => c.health > 0 && Math.hypot(c.x - player.x, c.y - player.y) < 110);
    if (near) text(ctx, 'E — TAKE CAR', W / 2, H / 2 + 70, 30, '#ffffff', 'center');
  }
}

export const HUD_WORLD = { W: WORLD_W, H: WORLD_H };
