// Painting the town each frame: a camera that leads the way Ivo is going and pulls back with
// speed, the ground, skid marks and job markers, people and cars, buildings with walls leaning
// away from the eye (a fake height), then dusk over all of it with holes cut by street lamps,
// headlights and the watch's light bars, and lit windows and glows on top.
import { isLand, LAND, MARGIN, MARKET_DROP, PIER } from './city.js';
import { carSpeed, drawCar, headlightPoint } from './cars.js';
import { drawPerson } from './pedestrians.js';
import { jobTarget } from './jobs.js';
import { carInReach } from './player.js';

const LEAN = 0.0011;

export function createCamera() {
  return { x: 1050, y: 1050, zoom: 1, w: 1280, h: 720 };
}

/** Ease the camera toward Ivo (or snap to him when `snap`). */
export function followCamera(cam, state, dt, snap) {
  const p = state.player;
  const car = p.car;
  const speed = car ? carSpeed(car) : 0;
  const lead = car ? 0.45 : 0;
  const tx = p.x + (car ? car.vx : 0) * lead;
  const ty = p.y + (car ? car.vy : 0) * lead;
  const fight = !car && state.peds.some((o) => o.kind === 'officer' && Math.hypot(o.x - p.x, o.y - p.y) < 160);
  const tz = (car ? 1.12 - Math.min(0.25, speed / 1000) : fight ? 1.6 : 1.3) * Math.min(cam.w / 1280, cam.h / 720) ** 0.5;
  const k = snap ? 1 : 1 - Math.exp(-4 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.zoom += (tz - cam.zoom) * (snap ? 1 : 1 - Math.exp(-2 * dt));
}

export function screenToWorld(cam, sx, sy) {
  return { x: cam.x + (sx - cam.w / 2) / cam.zoom, y: cam.y + (sy - cam.h / 2) / cam.zoom };
}

export function worldToScreen(cam, x, y) {
  return { x: (x - cam.x) * cam.zoom + cam.w / 2, y: (y - cam.y) * cam.zoom + cam.h / 2 };
}

function viewBox(cam, pad) {
  const hw = cam.w / 2 / cam.zoom + pad;
  const hh = cam.h / 2 / cam.zoom + pad;
  return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}

function inView(v, x, y) {
  return x > v.x0 && x < v.x1 && y > v.y0 && y < v.y1;
}

function lean(cam, b) {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return { ox: (cx - cam.x) * b.h * LEAN, oy: (cy - cam.y) * b.h * LEAN };
}

function quad(ctx, a, b, c, d) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fill();
}

function drawBox(ctx, cam, b) {
  if (b.kind === 'trunk') return;
  const { ox, oy } = lean(cam, b);
  const { x0, y0, x1, y1 } = b;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x0 + 6, y0 + 6, x1 - x0, y1 - y0);
  ctx.fillStyle = b.wallA;
  if (ox < 0) quad(ctx, [x1, y0], [x1, y1], [x1 + ox, y1 + oy], [x1 + ox, y0 + oy]);
  else quad(ctx, [x0, y0], [x0, y1], [x0 + ox, y1 + oy], [x0 + ox, y0 + oy]);
  ctx.fillStyle = b.wallB;
  if (oy < 0) quad(ctx, [x0, y1], [x1, y1], [x1 + ox, y1 + oy], [x0 + ox, y1 + oy]);
  else quad(ctx, [x0, y0], [x1, y0], [x1 + ox, y0 + oy], [x0 + ox, y0 + oy]);
  const rx = x0 + ox;
  const ry = y0 + oy;
  const w = x1 - x0;
  const h = y1 - y0;
  ctx.fillStyle = b.roof;
  ctx.fillRect(rx, ry, w, h);
  ctx.strokeStyle = b.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(rx + 1, ry + 1, w - 2, h - 2);
  if (b.kind === 'warehouse' || b.kind === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let x = rx + 6; x < rx + w - 2; x += 8) ctx.fillRect(x, ry + 3, 2, h - 6);
  } else if (b.kind === 'stall') {
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = (x / 8) % 2 ? '#f0e6cf' : b.roof;
      ctx.fillRect(rx + x, ry, Math.min(8, w - x), h);
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(rx + w * 0.18, ry + h * 0.2, Math.min(26, w * 0.3), Math.min(18, h * 0.25));
    ctx.fillRect(rx + w * 0.6, ry + h * 0.55, Math.min(14, w * 0.2), Math.min(14, h * 0.2));
  }
}

function drawWindows(ctx, cam, b) {
  if (b.kind !== 'building' && b.kind !== 'shed') return;
  const { ox, oy } = lean(cam, b);
  const floors = b.floors;
  ctx.fillStyle = '#ffd98a';
  let bit = 0;
  const wallX = ox < 0 ? b.x1 : b.x0;
  const wallY = oy < 0 ? b.y1 : b.y0;
  for (let f = 1; f <= floors; f += 1) {
    const t = (f - 0.5) / (floors + 0.3);
    for (let y = b.y0 + 8; y < b.y1 - 6; y += 13) {
      if (b.lit[bit++ % 64]) ctx.fillRect(wallX + ox * t - 1.5, y + oy * t, 3, 5);
    }
    for (let x = b.x0 + 8; x < b.x1 - 6; x += 13) {
      if (b.lit[bit++ % 64]) ctx.fillRect(x + ox * t, wallY + oy * t - 1.5, 5, 3);
    }
  }
}

function drawTrees(ctx, city, v) {
  for (const t of city.trees) {
    if (!inView(v, t.x, t.y)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(t.x + 5, t.y + 5, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f5a35';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f7444';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx, city, v, time) {
  ctx.strokeStyle = 'rgba(160,210,230,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const step = 46;
  for (let x = Math.floor(v.x0 / step) * step; x < v.x1; x += step) {
    for (let y = Math.floor(v.y0 / step) * step; y < v.y1; y += step) {
      const wx = x + ((y * 7) % 23);
      if (isLand(city, wx, y) || wx < -MARGIN || y < -MARGIN || wx > LAND + MARGIN || y > LAND + MARGIN) continue;
      const s = Math.sin(time * 1.3 + x * 0.05 + y * 0.03) * 6;
      ctx.moveTo(wx + s, y);
      ctx.lineTo(wx + s + 12, y);
    }
  }
  ctx.stroke();
}

function drawMarkers(ctx, state, time) {
  const job = state.job;
  if (job.id === 2) {
    const live = job.cool <= 0;
    ctx.save();
    ctx.strokeStyle = live ? '#ffcf4a' : 'rgba(255,207,74,0.3)';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -time * 30;
    ctx.beginPath();
    ctx.arc(MARKET_DROP.x, MARKET_DROP.y, MARKET_DROP.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = live ? 'rgba(255,207,74,0.16)' : 'rgba(255,207,74,0.05)';
    ctx.fill();
    ctx.restore();
  }
  if (job.id === 3) {
    const pulse = 30 + Math.sin(time * 5) * 6;
    ctx.fillStyle = 'rgba(80,230,170,0.25)';
    ctx.beginPath();
    ctx.arc(PIER.endX, PIER.endY, pulse + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5ef0b4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(PIER.endX, PIER.endY, pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEffects(ctx, state) {
  const p = state.player;
  if (p.onFoot && p.strikeTime > 0) {
    const t = 1 - p.strikeTime / 0.18;
    ctx.strokeStyle = `rgba(255,240,200,${0.9 - t * 0.6})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 24, p.angle - 1 + t * 0.6, p.angle + 0.4 + t * 0.6);
    ctx.stroke();
  }
  for (const e of state.effects) {
    if (e.kind !== 'impact') continue;
    const t = 1 - e.life / e.max;
    const r = (e.small ? 8 : 14) + t * (e.small ? 10 : 22);
    ctx.strokeStyle = `rgba(255,${e.small ? 90 : 220},80,${1 - t})`;
    ctx.lineWidth = e.small ? 2 : 4;
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      ctx.moveTo(e.x + Math.cos(a) * r * 0.45, e.y + Math.sin(a) * r * 0.45);
      ctx.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
    }
    ctx.stroke();
  }
}

function lightHole(g, x, y, r, a) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(0,0,0,${a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function glow(ctx, x, y, r, color) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawDusk(ctx, dusk, cam, state, v) {
  const g = dusk.getContext('2d');
  if (dusk.width !== ctx.canvas.width || dusk.height !== ctx.canvas.height) {
    dusk.width = ctx.canvas.width;
    dusk.height = ctx.canvas.height;
  }
  const scale = ctx.canvas.width / cam.w;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, dusk.width, dusk.height);
  g.fillStyle = 'rgba(10,16,40,0.6)';
  g.fillRect(0, 0, dusk.width, dusk.height);
  g.setTransform(cam.zoom * scale, 0, 0, cam.zoom * scale, (cam.w / 2 - cam.x * cam.zoom) * scale, (cam.h / 2 - cam.y * cam.zoom) * scale);
  g.globalCompositeOperation = 'destination-out';
  for (const l of state.city.lamps) if (inView(v, l.x, l.y)) lightHole(g, l.x, l.y, 95, 0.85);
  for (const car of state.cars) {
    if (!inView(v, car.x, car.y)) continue;
    if (car.driver) {
      const h = headlightPoint(car, 62);
      lightHole(g, h.x, h.y, 62, 0.75);
    }
    if (car.kind === 'watch') lightHole(g, car.x, car.y, 70, 0.6);
  }
  lightHole(g, state.player.x, state.player.y, 70, 0.55);
  lightHole(g, PIER.endX, PIER.endY, 90, 0.7);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(dusk, 0, 0);
  ctx.restore();
}

function drawGlows(ctx, state, cam, v, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of state.city.lamps) {
    if (!inView(v, l.x, l.y)) continue;
    glow(ctx, l.x, l.y, 34, 'rgba(255,190,110,0.35)');
  }
  for (const car of state.cars) {
    if (!inView(v, car.x, car.y)) continue;
    if (car.driver) glow(ctx, headlightPoint(car, 40).x, headlightPoint(car, 40).y, 40, 'rgba(255,240,190,0.18)');
    if (car.kind === 'watch' && car.siren) {
      const blink = Math.floor(time * 6) % 2 === 0;
      glow(ctx, car.x, car.y, 80, blink ? 'rgba(255,170,0,0.55)' : 'rgba(40,200,255,0.55)');
    }
  }
  if (state.job.id === 3) glow(ctx, PIER.endX, PIER.endY, 70, 'rgba(80,240,170,0.4)');
  if (state.job.id === 2) glow(ctx, MARKET_DROP.x, MARKET_DROP.y, 80, 'rgba(255,200,70,0.25)');
  ctx.restore();
}

function label(ctx, cam, x, y, text, bg, fg) {
  const s = worldToScreen(cam, x, y);
  ctx.font = '800 15px system-ui, "Segoe UI", sans-serif';
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(s.x - w / 2, s.y - 13, w, 24, 6);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, s.x, s.y);
}

function drawLabels(ctx, state, cam, time) {
  const p = state.player;
  ctx.save();
  ctx.setTransform(ctx.canvas.width / cam.w, 0, 0, ctx.canvas.height / cam.h, 0, 0);
  const target = jobTarget(state);
  if (target && state.job.id !== 2) label(ctx, cam, target.x, target.y - 46, target.label, 'rgba(20,24,30,0.85)', state.job.id === 3 ? '#5ef0b4' : '#ffb35a');
  if (state.job.id === 2) label(ctx, cam, MARKET_DROP.x, MARKET_DROP.y - MARKET_DROP.r - 18, state.job.cool > 0 ? 'DROP — WAIT' : 'LEDGER DROP · KEEP MOVING', 'rgba(20,24,30,0.85)', '#ffcf4a');
  const car = carInReach(state);
  if (car && state.down <= 0) {
    const verb = car.driver === 'traffic' ? 'PULL OUT DRIVER' : car === state.yardVan ? 'STEAL YARD VAN' : 'STEAL CAR';
    const dx = car.x - p.x;
    const dy = car.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    label(ctx, cam, car.x + (dx / d) * 30, car.y + (dy / d) * 30 + 6, `E  ${verb}`, '#ffcf4a', '#16181d');
  }
  if (state.down <= 0) {
    const s = worldToScreen(cam, p.x, p.y - (p.car ? 14 : 0));
    const bob = Math.sin(time * 5) * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(s.x - 7, s.y - 24 + bob);
    ctx.lineTo(s.x + 7, s.y - 24 + bob);
    ctx.lineTo(s.x, s.y - 15 + bob);
    ctx.closePath();
    ctx.fill();
  }
  for (const e of state.effects) {
    if (e.kind !== 'cash') continue;
    const s = worldToScreen(cam, e.x, e.y - (1 - e.life / e.max) * 30);
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillStyle = '#9dff8a';
    ctx.textAlign = 'center';
    ctx.fillText(e.text, s.x, s.y);
  }
  ctx.restore();
}

/** Paint the world (everything but the HUD) for this frame. */
export function drawWorld(ctx, dusk, cam, state, labels = true) {
  const { city } = state;
  const time = state.time;
  const scale = ctx.canvas.width / cam.w;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d2738';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(cam.zoom * scale, 0, 0, cam.zoom * scale, (cam.w / 2 - cam.x * cam.zoom) * scale, (cam.h / 2 - cam.y * cam.zoom) * scale);
  const v = viewBox(cam, 40);
  ctx.imageSmoothingEnabled = true;
  const sx = Math.max(0, v.x0 + MARGIN);
  const sy = Math.max(0, v.y0 + MARGIN);
  const sw = Math.min(city.ground.width, v.x1 + MARGIN) - sx;
  const sh = Math.min(city.ground.height, v.y1 + MARGIN) - sy;
  if (sw > 0 && sh > 0) ctx.drawImage(city.ground, sx, sy, sw, sh, sx - MARGIN, sy - MARGIN, sw, sh);
  drawWater(ctx, city, v, time);
  ctx.fillStyle = 'rgba(20,20,20,0.5)';
  for (const s of state.skids) {
    if (!inView(v, s.x, s.y)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.fillRect(-3, -8, 6, 3);
    ctx.fillRect(-3, 5, 6, 3);
    ctx.restore();
  }
  drawMarkers(ctx, state, time);
  for (const person of state.peds) if (person.mode === 'down' && inView(v, person.x, person.y)) drawPerson(ctx, person, time, false);
  for (const person of state.peds) if (person.mode !== 'down' && inView(v, person.x, person.y)) drawPerson(ctx, person, time, true);
  if (state.player.onFoot) drawPerson(ctx, { ...state.player, mode: state.down > 0 ? 'down' : 'walk' }, time, state.player.moving);
  for (const car of state.cars) if (inView(v, car.x, car.y)) drawCar(ctx, car, time);
  drawEffects(ctx, state);
  const boxes = city.boxes.filter((b) => b.x1 > v.x0 && b.x0 < v.x1 && b.y1 > v.y0 && b.y0 < v.y1);
  boxes.sort((a, b) => a.h - b.h);
  for (const b of boxes) drawBox(ctx, cam, b);
  drawTrees(ctx, city, v);
  drawDusk(ctx, dusk, cam, state, v);
  for (const b of boxes) drawWindows(ctx, cam, b);
  drawGlows(ctx, state, cam, v, time);
  if (labels) drawLabels(ctx, state, cam, time);
}

