// Draws Saltwake from above: water, coast, streets, lots, buildings and props,
// then cars and people, all under a high midday sun with hard, short shadows.

import {
  T, COLS, ROWS, WATER, SAND, ROAD, WALK, LOT, BUILDING, PIER, GRASS,
  ROAD_ROWS, ROAD_COLS, districtAt, DISTRICTS,
} from './city.js';
import { drawCar } from './cars.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { jobMarker } from './jobs.js';

const LOT_COLORS = new Map([
  [DISTRICTS.YARD, '#d8cdb4'],
  [DISTRICTS.QUAY, '#c4d3dc'],
  [DISTRICTS.MARKET, '#f6d39a'],
  [DISTRICTS.RIDGE, '#62c94c'],
]);

function tileColor(tile, x, y) {
  switch (tile) {
    case WATER: return '#14a6d6';
    case SAND: return '#ffe3a1';
    case ROAD: return '#4f5562';
    case WALK: return '#eee8db';
    case PIER: return '#cf9452';
    case GRASS: return '#62c94c';
    default: return LOT_COLORS.get(districtAt(x, y));
  }
}

function nearLand(city, c, r) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      const rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
      if (city.tiles[rr * COLS + cc] !== WATER) return true;
    }
  }
  return false;
}

function drawTiles(ctx, city, c0, r0, c1, r1, time) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = city.tiles[r * COLS + c];
      const x = c * T;
      const y = r * T;
      const shallow = tile === WATER && nearLand(city, c, r);
      ctx.fillStyle = shallow ? '#39cbe0' : tileColor(tile, x + T / 2, y + T / 2);
      ctx.fillRect(x, y, T + 1, T + 1);
      if (tile === WATER) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 4;
        const o = Math.sin(time * 1.5 + c * 0.7 + r * 1.3) * 8;
        ctx.beginPath();
        ctx.moveTo(x + 10 + o, y + 22);
        ctx.quadraticCurveTo(x + 22 + o, y + 14, x + 34 + o, y + 22);
        ctx.stroke();
      } else if (tile === PIER) {
        ctx.strokeStyle = '#8e5c2a';
        ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y + k * 16 + 8);
          ctx.lineTo(x + T, y + k * 16 + 8);
          ctx.stroke();
        }
      } else if (tile === WALK) {
        ctx.strokeStyle = 'rgba(90,80,64,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
      }
    }
  }
}

function drawRoadMarks(ctx, c0, r0, c1, r1) {
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 5;
  ctx.setLineDash([26, 22]);
  const left = ROAD_COLS[0] * T;
  const right = (ROAD_COLS[ROAD_COLS.length - 1] + 2) * T;
  const top = ROAD_ROWS[0] * T;
  const bottom = (ROAD_ROWS[ROAD_ROWS.length - 1] + 2) * T;
  for (const rr of ROAD_ROWS) {
    if (rr + 1 < r0 || rr > r1) continue;
    const y = (rr + 1) * T;
    ctx.beginPath();
    ctx.moveTo(Math.max(left, c0 * T), y);
    ctx.lineTo(Math.min(right, (c1 + 1) * T), y);
    ctx.stroke();
  }
  for (const cc of ROAD_COLS) {
    if (cc + 1 < c0 || cc > c1) continue;
    const x = (cc + 1) * T;
    ctx.beginPath();
    ctx.moveTo(x, Math.max(top, r0 * T));
    ctx.lineTo(x, Math.min(bottom, (r1 + 1) * T));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  for (const rr of ROAD_ROWS) {
    for (const cc of ROAD_COLS) {
      if (cc < c0 - 2 || cc > c1 + 1 || rr < r0 - 2 || rr > r1 + 1) continue;
      for (let k = 0; k < 6; k++) {
        ctx.fillRect(cc * T + 6 + k * 20, rr * T - 18, 10, 14);
        ctx.fillRect(cc * T + 6 + k * 20, (rr + 2) * T + 4, 10, 14);
      }
    }
  }
}

function drawBuilding(ctx, b) {
  const x = b.c0 * T + 4;
  const y = b.r0 * T + 4;
  const w = (b.c1 - b.c0 + 1) * T - 8;
  const h = (b.r1 - b.r0 + 1) * T - 8;
  const d = 16;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x + d + 8, y + d + 10, w, h);
  const right = [[x + w, y], [x + w + d, y + d], [x + w + d, y + h + d], [x + w, y + h]];
  const bottom = [[x, y + h], [x + w, y + h], [x + w + d, y + h + d], [x + d, y + h + d]];
  for (const [face, shade] of [[right, 'rgba(0,0,0,0.42)'], [bottom, 'rgba(0,0,0,0.26)']]) {
    ctx.beginPath();
    ctx.moveTo(face[0][0], face[0][1]);
    for (let i = 1; i < face.length; i++) ctx.lineTo(face[i][0], face[i][1]);
    ctx.closePath();
    ctx.fillStyle = b.roof;
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = b.roof;
  ctx.strokeStyle = '#1a1620';
  ctx.lineWidth = 5;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.fillRect(x, y, w, 8);
  ctx.fillRect(x, y, 8, h);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(x, y + h - 8, w, 8);
  ctx.fillRect(x + w - 8, y, 8, h);
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 4;
  if (b.style === 'house') {
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h / 2);
    ctx.lineTo(x + w - 8, y + h / 2);
    ctx.stroke();
    ctx.fillStyle = '#5a4a44';
    ctx.fillRect(x + w - 26, y + 10, 12, 14);
  } else if (b.style === 'warehouse') {
    for (let k = 18; k < w - 8; k += 22) {
      ctx.beginPath();
      ctx.moveTo(x + k, y + 6);
      ctx.lineTo(x + k, y + h - 6);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let k = 0; k < w; k += 24) ctx.fillRect(x + k, y + h - 16, 12, 12);
    ctx.fillStyle = '#4a3a30';
    ctx.fillRect(x + w / 2 - 14, y + 12, 28, 18);
  }
}

const SHADOW = 'rgba(16,28,60,0.42)';

function drawProp(ctx, p) {
  if (p.kind === 'container') {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(p.x - p.w / 2 + 7, p.y - p.h / 2 + 8, p.w, p.h);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 4;
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    for (let k = 12; k < p.w - 6; k += 12) {
      ctx.beginPath();
      ctx.moveTo(p.x - p.w / 2 + k, p.y - p.h / 2 + 4);
      ctx.lineTo(p.x - p.w / 2 + k, p.y + p.h / 2 - 4);
      ctx.stroke();
    }
  } else if (p.kind === 'tree') {
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.arc(p.x + 8, p.y + 9, p.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f9e3a';
    ctx.strokeStyle = '#14401c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7fe05c';
    ctx.beginPath();
    ctx.arc(p.x - p.s * 0.3, p.y - p.s * 0.3, p.s * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'stall') {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(p.x - 14, p.y - 9, 40, 32);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 3;
    ctx.fillRect(p.x - 20, p.y - 16, 40, 32);
    ctx.strokeRect(p.x - 20, p.y - 16, 40, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - 20, p.y - 16, 10, 32);
    ctx.fillRect(p.x, p.y - 16, 10, 32);
  }
}

function drawMarker(ctx, m, time) {
  const pulse = 0.5 + Math.sin(time * 5) * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.35 + pulse * 0.2;
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.r + pulse * 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = '#1a1620';
  ctx.lineWidth = 5;
  const by = m.y - m.r - 30 - pulse * 12;
  ctx.beginPath();
  ctx.moveTo(m.x - 22, by - 30);
  ctx.lineTo(m.x + 22, by - 30);
  ctx.lineTo(m.x, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSun(ctx, W, H) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,248,214,0.14)');
  g.addColorStop(0.5, 'rgba(255,248,214,0)');
  g.addColorStop(1, 'rgba(255,200,120,0.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawWorld(ctx, world, W, H) {
  const cam = world.camera;
  const z = cam.zoom;
  const halfW = W / 2 / z;
  const halfH = H / 2 / z;
  const view = {
    x: cam.x, y: cam.y, zoom: z,
    left: cam.x - halfW, right: cam.x + halfW, top: cam.y - halfH, bottom: cam.y + halfH,
  };
  ctx.fillStyle = '#14a6d6';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);

  const c0 = Math.max(0, Math.floor(view.left / T) - 1);
  const r0 = Math.max(0, Math.floor(view.top / T) - 1);
  const c1 = Math.min(COLS - 1, Math.floor(view.right / T) + 1);
  const r1 = Math.min(ROWS - 1, Math.floor(view.bottom / T) + 1);
  drawTiles(ctx, world.city, c0, r0, c1, r1, world.time);
  drawRoadMarks(ctx, c0, r0, c1, r1);

  const inView = (x, y, pad) => x > view.left - pad && x < view.right + pad && y > view.top - pad && y < view.bottom + pad;
  for (const p of world.city.props) if (p.kind !== 'tree' && inView(p.x, p.y, 80)) drawProp(ctx, p);

  const m = jobMarker(world);
  if (m && inView(m.x, m.y, 200)) drawMarker(ctx, m, world.time);

  for (const p of world.peds) if (p.down > 0 && inView(p.x, p.y, 40)) drawPed(ctx, p);
  for (const p of world.peds) if (p.down <= 0 && inView(p.x, p.y, 40)) drawPed(ctx, p);
  drawPlayer(ctx, world.player, world.time);
  for (const car of world.cars) if (inView(car.x, car.y, 80)) drawCar(ctx, car, world.time);

  for (const b of world.city.buildings) {
    const bx = (b.c0 + b.c1 + 1) / 2 * T;
    const by = (b.r0 + b.r1 + 1) / 2 * T;
    if (inView(bx, by, 300)) drawBuilding(ctx, b);
  }
  for (const p of world.city.props) if (p.kind === 'tree' && inView(p.x, p.y, 60)) drawProp(ctx, p);

  const pc = world.player.car;
  if (pc) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, 46, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  drawSun(ctx, W, H);
}

export { ROAD, WALK, LOT, BUILDING, SAND };
