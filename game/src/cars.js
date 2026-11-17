// Cars: kinds, arcade top-down handling, collision with the map and each
// other, and drawing.

import { tileAt, blocksCar } from './city.js';

export const KINDS = {
  hatch: { w: 52, h: 28, top: 330, accel: 300, grip: 3.2, mass: 1 },
  sedan: { w: 60, h: 30, top: 380, accel: 320, grip: 3.0, mass: 1.1 },
  van: { w: 70, h: 34, top: 320, accel: 260, grip: 2.6, mass: 1.6 },
  watch: { w: 62, h: 31, top: 430, accel: 380, grip: 3.4, mass: 1.3 },
};

const PAINTS = ['#e8e1d0', '#d94f3d', '#3d7fd9', '#f2c14e', '#57b86b', '#8a5fc2', '#ef8a3c', '#4fc2c2'];

let nextId = 1;

export function makeCar(kind, x, y, angle, color) {
  const k = KINDS[kind];
  return {
    id: nextId++, kind, x, y, angle, speed: 0, steer: 0,
    w: k.w, h: k.h, color: color || PAINTS[nextId % PAINTS.length],
    health: 100, driver: null, ai: null, siren: 0, skid: 0, bump: 0,
  };
}

export function randomPaint(rng) {
  return PAINTS[Math.floor(rng() * PAINTS.length)];
}

export function driveCar(car, ctrl, dt, city) {
  const k = KINDS[car.kind];
  const wrecked = car.health <= 0;
  const throttle = wrecked ? 0 : ctrl.throttle;
  if (throttle > 0) {
    car.speed += k.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (throttle < 0) {
    car.speed += k.accel * throttle * dt * (car.speed > 0 ? 2 : 0.6);
  } else {
    car.speed *= Math.pow(0.35, dt);
  }
  if (ctrl.brake) car.speed *= Math.pow(0.04, dt);
  const top = k.top * (wrecked ? 0.2 : 1);
  car.speed = Math.max(-top * 0.4, Math.min(top, car.speed));

  const turnRate = k.grip * Math.min(1, Math.abs(car.speed) / 140);
  car.steer += (ctrl.steer - car.steer) * Math.min(1, dt * 10);
  car.angle += car.steer * turnRate * dt * Math.sign(car.speed || 1) * (ctrl.brake ? 1.35 : 1);
  car.skid = ctrl.brake && Math.abs(car.speed) > 160 ? 1 : Math.max(0, car.skid - dt * 3);

  moveCar(car, dt, city);
  car.bump = Math.max(0, car.bump - dt);
}

export function moveCar(car, dt, city) {
  const vx = Math.cos(car.angle) * car.speed * dt;
  const vy = Math.sin(car.angle) * car.speed * dt;
  const nx = car.x + vx;
  const ny = car.y + vy;
  if (!hitsMap(car, nx, ny, city)) {
    car.x = nx;
    car.y = ny;
    return false;
  }
  const slideX = !hitsMap(car, nx, car.y, city);
  const slideY = !hitsMap(car, car.x, ny, city);
  if (slideX) car.x = nx;
  else if (slideY) car.y = ny;
  const impact = Math.abs(car.speed);
  if (impact > 120 && car.bump <= 0) {
    car.health -= impact / 40;
    car.bump = 0.3;
  }
  car.speed *= slideX || slideY ? 0.7 : -0.25;
  return impact > 120;
}

function hitsMap(car, x, y, city) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hw = car.w * 0.45;
  const hh = car.h * 0.42;
  const pts = [[hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh], [hw, 0], [-hw, 0]];
  for (const [px, py] of pts) {
    const wx = x + px * c - py * s;
    const wy = y + px * s + py * c;
    if (blocksCar(tileAt(city, wx, wy))) return true;
  }
  return false;
}

export function carRadius(car) {
  return (car.w + car.h) * 0.27;
}

export function collideCars(cars) {
  const hits = [];
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r = carRadius(a) + carRadius(b);
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (r - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
      const rel = Math.abs(a.speed - b.speed) + Math.abs(a.speed + b.speed) * 0.3;
      const ma = KINDS[a.kind].mass;
      const mb = KINDS[b.kind].mass;
      const avg = (a.speed * ma + b.speed * mb) / (ma + mb);
      a.speed = avg * 0.6;
      b.speed = avg * 0.6;
      if (rel > 90) {
        if (a.bump <= 0) a.health -= rel / 45;
        if (b.bump <= 0) b.health -= rel / 45;
        a.bump = 0.25;
        b.bump = 0.25;
        hits.push({ a, b, force: rel });
      }
    }
  }
  return hits;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawCar(ctx, car, time) {
  const w = car.w;
  const h = car.h;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -w / 2 + 4, -h / 2 + 5, w, h, 8);
  ctx.fill();

  const body = car.kind === 'watch' ? '#f4f1e8' : car.color;
  ctx.fillStyle = car.health <= 0 ? '#3a3a3a' : body;
  ctx.strokeStyle = '#14141c';
  ctx.lineWidth = 4;
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();

  if (car.kind === 'watch') {
    ctx.fillStyle = '#16a3a3';
    ctx.fillRect(-w / 2 + 3, -4, w - 6, 8);
  }

  const cabinFront = car.kind === 'van' ? w * 0.42 : w * 0.18;
  const cabinBack = car.kind === 'van' ? w * 0.14 : -w * 0.3;
  ctx.fillStyle = shade(car.kind === 'watch' ? '#f4f1e8' : car.color, 0.62);
  roundRect(ctx, cabinBack, -h / 2 + 5, cabinFront - cabinBack, h - 10, 5);
  ctx.fill();
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(cabinFront - 9, -h / 2 + 6, 7, h - 12);
  if (car.kind !== 'van') ctx.fillRect(cabinBack + 2, -h / 2 + 7, 5, h - 14);

  ctx.fillStyle = '#fff6c2';
  ctx.fillRect(w / 2 - 6, -h / 2 + 3, 5, 7);
  ctx.fillRect(w / 2 - 6, h / 2 - 10, 5, 7);
  ctx.fillStyle = '#ff3b3b';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 3, 4, 6);
  ctx.fillRect(-w / 2 + 1, h / 2 - 9, 4, 6);

  if (car.kind === 'watch') {
    const flip = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = car.siren > 0 ? (flip ? '#ffb300' : '#ff5a1f') : '#8a6a2a';
    ctx.fillRect(-6, -h / 2 + 4, 10, h - 8);
    if (car.siren > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = flip ? 'rgba(255,180,0,0.35)' : 'rgba(255,90,30,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
}

export function drawHeadlights(ctx, car) {
  if (car.health <= 0) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const g = ctx.createLinearGradient(car.w / 2, 0, car.w / 2 + 150, 0);
  g.addColorStop(0, 'rgba(255,240,190,0.38)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(car.w / 2, -car.h / 2 + 4);
  ctx.lineTo(car.w / 2 + 150, -car.h / 2 - 40);
  ctx.lineTo(car.w / 2 + 150, car.h / 2 + 40);
  ctx.lineTo(car.w / 2, car.h / 2 - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
