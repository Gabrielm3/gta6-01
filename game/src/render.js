// Draws Saltwake from above: water, coast, streets, lots, buildings and props,
// then cars and people, then a light dusk grade with streetlight glow.

import {
  T, COLS, ROWS, WATER, SAND, ROAD, WALK, LOT, BUILDING, PIER, GRASS,
  ROAD_ROWS, ROAD_COLS, districtAt, DISTRICTS,
} from './city.js';
import { drawCar, drawHeadlights } from './cars.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { jobMarker } from './jobs.js';

const LOT_COLORS = new Map([
  [DISTRICTS.YARD, '#9a948a'],
  [DISTRICTS.QUAY, '#8a949c'],
  [DISTRICTS.MARKET, '#c9ad84'],
  [DISTRICTS.RIDGE, '#6faa58'],
]);

function tileColor(tile, x, y) {
  switch (tile) {
    case WATER: return '#2f6f96';
    case SAND: return '#e6cf98';
    case ROAD: return '#50535e';
    case WALK: return '#b3ada3';
    case PIER: return '#a8763f';
    case GRASS: return '#6faa58';
    default: return LOT_COLORS.get(districtAt(x, y));
  }
}

function drawTiles(ctx, city, c0, r0, c1, r1, time) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = city.tiles[r * COLS + c];
      const x = c * T;
      const y = r * T;
      ctx.fillStyle = tileColor(tile, x + T / 2, y + T / 2);
      ctx.fillRect(x, y, T + 1, T + 1);
      if (tile === WATER) {
        ctx.strokeStyle = 'rgba(190,230,255,0.25)';
        ctx.lineWidth = 3;
        const o = Math.sin(time * 1.5 + c * 0.7 + r * 1.3) * 8;
        ctx.beginPath();
        ctx.moveTo(x + 10 + o, y + 22);
        ctx.quadraticCurveTo(x + 22 + o, y + 14, x + 34 + o, y + 22);
        ctx.stroke();
      } else if (tile === PIER) {
        ctx.strokeStyle = '#7a5229';
        ctx.lineWidth = 3;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y + k * 16 + 8);
          ctx.lineTo(x + T, y + k * 16 + 8);
          ctx.stroke();
        }
      } else if (tile === WALK) {
        ctx.strokeStyle = 'rgba(80,70,60,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
      }
    }
  }
}

function drawRoadMarks(ctx, c0, r0, c1, r1) {
  ctx.strokeStyle = '#f2d25c';
  ctx.lineWidth = 4;
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
  ctx.fillStyle = 'rgba(245,245,240,0.8)';
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
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x + 12, y + 14, w, h);
  ctx.fillStyle = b.roof;
  ctx.strokeStyle = '#1a1620';
  ctx.lineWidth = 5;
  ctx.fillRect(x, y, w, h);
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
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < w; k += 24) ctx.fillRect(x + k, y + h - 16, 12, 12);
    ctx.fillStyle = '#4a3a30';
    ctx.fillRect(x + w / 2 - 14, y + 12, 28, 18);
  }
}

function drawProp(ctx, p) {
  if (p.kind === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(p.x - p.w / 2 + 8, p.y - p.h / 2 + 9, p.w, p.h);
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
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(p.x + 7, p.y + 8, p.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8a3a';
    ctx.strokeStyle = '#1f4a22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#58a84c';
    ctx.beginPath();
    ctx.arc(p.x - p.s * 0.3, p.y - p.s * 0.3, p.s * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'stall') {
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 3;
    ctx.fillRect(p.x - 20, p.y - 16, 40, 32);
    ctx.strokeRect(p.x - 20, p.y - 16, 40, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
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

function drawDusk(ctx, world, W, H, view) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#e4d2ec';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,140,80,0.16)');
  g.addColorStop(0.5, 'rgba(255,120,140,0.04)');
  g.addColorStop(1, 'rgba(70,60,140,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(W / 2, H / 2);
  ctx.scale(view.zoom, view.zoom);
  ctx.translate(-view.x, -view.y);
  for (const l of world.city.lights) {
    if (l.x < view.left - 120 || l.x > view.right + 120 || l.y < view.top - 120 || l.y > view.bottom + 120) continue;
    const rg = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, 110);
    rg.addColorStop(0, 'rgba(255,214,140,0.38)');
    rg.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(l.x - 110, l.y - 110, 220, 220);
  }
  for (const car of world.cars) {
    if (car.x < view.left - 200 || car.x > view.right + 200 || car.y < view.top - 200 || car.y > view.bottom + 200) continue;
    drawHeadlights(ctx, car);
  }
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
  ctx.fillStyle = '#2f6f96';
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

  drawDusk(ctx, world, W, H, view);
}

export { ROAD, WALK, LOT, BUILDING, SAND };
