// The heads-up display over play: the job banner (top left), the harbor watch's wanted pips (top
// right), the island minimap (bottom left), Ivo's health, cash and car (bottom right), an arrow
// at the screen edge toward the job, the district name on entering one, and the knock-out and
// pause cards.
import { DISTRICTS, districtAt, LAND, LINES, PIER, ROAD_HALF } from './city.js';
import { carSpeed } from './cars.js';
import { JOBS, jobTarget } from './jobs.js';
import { worldToScreen } from './render.js';
import { MAX_WANTED } from './wanted.js';

const FONT = 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif';
const MAP_SIZE = 214;
const MAP_X0 = -260;
const MAP_Y0 = -380;
const MAP_SPAN = 2680;

function font(weight, size) {
  return `${weight} ${size}px ${FONT}`;
}

function panel(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Paint the island map once, for the minimap's base. */
export function paintMinimap(city) {
  const c = document.createElement('canvas');
  c.width = MAP_SIZE;
  c.height = MAP_SIZE;
  const g = c.getContext('2d');
  const s = MAP_SIZE / MAP_SPAN;
  g.fillStyle = '#0f2f44';
  g.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
  g.setTransform(s, 0, 0, s, -MAP_X0 * s, -MAP_Y0 * s);
  g.fillStyle = '#4b4a46';
  g.fillRect(0, 0, LAND, LAND);
  for (const b of city.blocks) {
    g.fillStyle = DISTRICTS[b.district].tint;
    g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (const b of city.boxes) if (b.h > 0) g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  g.fillStyle = '#d9d3c2';
  for (const l of LINES) {
    g.fillRect(l - ROAD_HALF * 0.7, LINES[0], ROAD_HALF * 1.4, LINES[4] - LINES[0]);
    g.fillRect(LINES[0], l - ROAD_HALF * 0.7, LINES[4] - LINES[0], ROAD_HALF * 1.4);
  }
  g.fillStyle = '#b08a5a';
  g.fillRect(PIER.x0, PIER.y0, PIER.x1 - PIER.x0, -PIER.y0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = font(800, 10);
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  const at = (x, y) => [(x - MAP_X0) * s, (y - MAP_Y0) * s];
  for (const [key, x, y] of [['yard', 600, 830], ['ridge', 1500, 830], ['quay', 600, 1730], ['market', 1500, 1730]]) {
    const [px, py] = at(x, y);
    g.fillText(DISTRICTS[key].name.replace('THE ', ''), px, py);
  }
  return c;
}

function mapPoint(x, y, ox, oy) {
  const s = MAP_SIZE / MAP_SPAN;
  return [ox + (x - MAP_X0) * s, oy + (y - MAP_Y0) * s];
}

function drawMinimap(ctx, state, ox, oy) {
  const time = state.time;
  panel(ctx, ox - 6, oy - 6, MAP_SIZE + 12, MAP_SIZE + 12, 12, 'rgba(10,14,20,0.85)');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ox, oy, MAP_SIZE, MAP_SIZE, 8);
  ctx.clip();
  ctx.drawImage(state.city.minimap, ox, oy);
  const target = jobTarget(state);
  if (target) {
    const [tx, ty] = mapPoint(target.x, target.y, ox, oy);
    const r = 7 + Math.sin(time * 6) * 2;
    ctx.fillStyle = state.job.id === 3 ? '#5ef0b4' : '#ffcf4a';
    ctx.beginPath();
    ctx.moveTo(tx, ty - r);
    ctx.lineTo(tx + r, ty);
    ctx.lineTo(tx, ty + r);
    ctx.lineTo(tx - r, ty);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const car of state.cars) {
    if (car.kind !== 'watch') continue;
    const [cx, cy] = mapPoint(car.x, car.y, ox, oy);
    ctx.fillStyle = Math.floor(time * 6) % 2 ? '#ffb300' : '#38d6ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  const [px, py] = mapPoint(p.x, p.y, ox, oy);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.font = font(800, 11);
  ctx.fillStyle = '#c9c2b0';
  ctx.textAlign = 'left';
  ctx.fillText('SALTWAKE', ox + 6, oy + 14);
  ctx.textAlign = 'right';
  ctx.fillText('N ▲', ox + MAP_SIZE - 6, oy + 14);
}

function drawBanner(ctx, state) {
  const id = state.job.id;
  const job = JOBS[id];
  const x = 22;
  const y = 20;
  ctx.font = font(900, 28);
  const w = Math.max(470, ctx.measureText(job.title).width + 48);
  const glowing = state.job.flash > 0;
  panel(ctx, x, y, w, 104, 10, 'rgba(12,16,22,0.88)');
  if (glowing) {
    ctx.strokeStyle = `rgba(255,190,80,${Math.min(1, state.job.flash)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 104, 10);
    ctx.stroke();
  }
  ctx.fillStyle = id === 3 ? '#5ef0b4' : '#ffb35a';
  ctx.fillRect(x, y + 12, 6, 80);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(800, 14);
  ctx.letterSpacing = '3px';
  ctx.fillText(id <= 3 ? `ACTIVE JOB  ${id} / 3` : 'ALL JOBS DONE', x + 22, y + 28);
  ctx.letterSpacing = '0px';
  ctx.font = font(900, 28);
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(job.title, x + 22, y + 62);
  ctx.font = font(500, 15);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillText(job.brief, x + 22, y + 88);
}

function drawWanted(ctx, state, w) {
  const level = state.wanted.level;
  const flash = state.wanted.flash > 0 && Math.floor(state.time * 8) % 2 === 0;
  const pw = 274;
  const x = w - pw - 22;
  const y = 20;
  panel(ctx, x, y, pw, 78, 10, 'rgba(12,16,22,0.88)');
  ctx.font = font(800, 13);
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'left';
  ctx.fillStyle = level > 0 ? '#ffcf4a' : '#8d8878';
  ctx.fillText('HARBOR WATCH', x + 16, y + 24);
  ctx.letterSpacing = '0px';
  for (let i = 0; i < MAX_WANTED; i += 1) {
    const cx = x + 34 + i * 50;
    const cy = y + 52;
    const on = i < level;
    ctx.beginPath();
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17);
    }
    ctx.closePath();
    ctx.fillStyle = on ? (flash ? '#38d6ff' : i % 2 ? '#ffb300' : '#ffc640') : '#262a31';
    ctx.fill();
    ctx.strokeStyle = on ? '#fff3c4' : '#4a4f58';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = on ? '#1a1406' : '#3a3f48';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStatus(ctx, state, w, h) {
  const p = state.player;
  const pw = 300;
  const x = w - pw - 22;
  const y = h - 128;
  panel(ctx, x, y, pw, 106, 10, 'rgba(12,16,22,0.88)');
  ctx.textAlign = 'left';
  ctx.font = font(900, 34);
  ctx.fillStyle = '#9dff8a';
  ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, x + 18, y + 46);
  ctx.font = font(800, 12);
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#c9c2b0';
  ctx.textAlign = 'right';
  ctx.fillText(p.car ? p.car.spec.label : 'ON FOOT', x + pw - 16, y + 24);
  if (p.car) {
    ctx.font = font(900, 17);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillText(`${Math.round(carSpeed(p.car) * 0.36)} KM/H`, x + pw - 16, y + 46);
  }
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
  ctx.font = font(800, 12);
  ctx.fillStyle = '#c9c2b0';
  ctx.fillText('IVO PELL', x + 18, y + 74);
  panel(ctx, x + 18, y + 82, pw - 36, 12, 6, '#2a2e35');
  const frac = p.health / 100;
  panel(ctx, x + 18, y + 82, Math.max(12, (pw - 36) * frac), 12, 6, frac > 0.35 ? '#e2574c' : '#ff2d1a');
}

function drawArrow(ctx, state, cam, w, h) {
  const target = jobTarget(state);
  if (!target) return;
  const s = worldToScreen(cam, target.x, target.y);
  if (s.x > 0 && s.x < w && s.y > 0 && s.y < h) return;
  const cx = w / 2;
  const cy = h / 2;
  const a = Math.atan2(s.y - cy, s.x - cx);
  const r = Math.min((w / 2 - 60) / Math.abs(Math.cos(a) || 1e-6), (h / 2 - 140) / Math.abs(Math.sin(a) || 1e-6));
  const ax = cx + Math.cos(a) * r;
  const ay = cy + Math.sin(a) * r;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(a);
  ctx.fillStyle = state.job.id === 3 ? '#5ef0b4' : '#ffcf4a';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-10, -14);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const dist = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y) / 10) * 10;
  ctx.font = font(800, 13);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(`${dist} m`, ax - Math.cos(a) * 30, ay - Math.sin(a) * 30 + 4);
}

function drawMessage(ctx, state, w) {
  const m = state.message;
  if (!m) return;
  const alpha = Math.min(1, m.life * 2, (m.max - m.life) * 6);
  ctx.globalAlpha = alpha;
  ctx.font = font(900, 30);
  const tw = ctx.measureText(m.text).width + 48;
  panel(ctx, w / 2 - tw / 2, 150, tw, 52, 10, m.tone === 'bad' ? 'rgba(120,24,20,0.9)' : 'rgba(18,70,44,0.9)');
  ctx.fillStyle = '#fff6e0';
  ctx.textAlign = 'center';
  ctx.fillText(m.text, w / 2, 187);
  ctx.globalAlpha = 1;
}

function drawDistrict(ctx, state, w, h, hud) {
  const d = districtAt(state.player.x, state.player.y);
  if (d !== hud.district) {
    hud.district = d;
    hud.districtTime = 2.6;
  }
  if (hud.districtTime <= 0) return;
  ctx.globalAlpha = Math.min(1, hud.districtTime);
  ctx.font = font(900, 26);
  ctx.letterSpacing = '8px';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4ecd8';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 5;
  ctx.strokeText(DISTRICTS[d].name, w / 2, h - 46);
  ctx.fillText(DISTRICTS[d].name, w / 2, h - 46);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}

export function createHudState() {
  return { district: null, districtTime: 0 };
}

/** Paint the whole HUD in screen pixels (w by h, CSS pixels). */
export function drawHud(ctx, state, cam, hud, dt, paused) {
  const w = cam.w;
  const h = cam.h;
  hud.districtTime -= dt;
  ctx.save();
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.textBaseline = 'alphabetic';
  drawArrow(ctx, state, cam, w, h);
  drawBanner(ctx, state);
  drawWanted(ctx, state, w);
  drawMinimap(ctx, state, 28, h - MAP_SIZE - 28);
  drawStatus(ctx, state, w, h);
  drawDistrict(ctx, state, w, h, hud);
  drawMessage(ctx, state, w);
  if (state.down > 0) {
    ctx.fillStyle = 'rgba(70,8,8,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = font(900, 54);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff1dc';
    ctx.fillText(state.downCause === 'watch' ? 'TAKEN IN BY THE WATCH' : 'IVO WENT DOWN', w / 2, h / 2);
    ctx.font = font(600, 18);
    ctx.fillText('Waking up at the Quay safehouse…', w / 2, h / 2 + 36);
  }
  if (paused) {
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = font(900, 54);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ecd8';
    ctx.fillText('PAUSED', w / 2, h / 2);
    ctx.font = font(600, 18);
    ctx.fillText('P or Esc to carry on · progress is saved', w / 2, h / 2 + 36);
  }
  ctx.restore();
}
