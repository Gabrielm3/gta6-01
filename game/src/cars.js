// Cars: the kinds on Saltwake's streets, their arcade driving model (throttle, steering, grip and a
// handbrake slide), pushing them out of walls and off each other, and painting them from above.
import { resolveCircle } from './city.js';

export const CAR_KINDS = {
  sedan: { len: 36, wid: 18, top: 300, accel: 250, turn: 2.7, label: 'SEDAN', mass: 1 },
  hatch: { len: 31, wid: 17, top: 270, accel: 270, turn: 3.0, label: 'HATCH', mass: 0.8 },
  cab: { len: 36, wid: 18, top: 285, accel: 240, turn: 2.7, label: 'HARBOR CAB', mass: 1 },
  van: { len: 46, wid: 21, top: 250, accel: 210, turn: 2.2, label: 'YARD VAN', mass: 1.6 },
  watch: { len: 39, wid: 19, top: 320, accel: 300, turn: 2.8, label: 'WATCH CRUISER', mass: 1.3 },
};

export const CAR_COLORS = ['#c8553d', '#e0b04a', '#5b8e7d', '#3d5a80', '#e8e1d1', '#7d4e57', '#8a9ba8', '#4a4e57'];

let nextId = 1;

export function createCar(kind, x, y, angle, color) {
  const spec = CAR_KINDS[kind];
  return {
    id: nextId++, kind, spec, x, y, angle, vx: 0, vy: 0,
    color: color ?? (kind === 'van' ? '#e07b28' : kind === 'cab' ? '#e3c23c' : kind === 'watch' ? '#e9eef0' : '#8a9ba8'),
    driver: null, throttle: 0, steer: 0, handbrake: false, damage: 0, siren: kind === 'watch',
    hitCool: 0, deployed: 0, deployCool: 0, route: null, node: null, mode: 'chase', stuck: 0,
  };
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

/** One physics step: apply the car's controls, move it, keep it out of walls. Returns the wall impact speed. */
export function stepCar(car, city, dt, skids) {
  const s = car.spec;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let fwd = car.vx * fx + car.vy * fy;
  let lat = car.vx * -fy + car.vy * fx;
  const t = car.throttle;
  if (t > 0) fwd += t * s.accel * dt * (fwd < 0 ? 2 : 1);
  else if (t < 0) fwd += t * s.accel * dt * (fwd > 0 ? 2.2 : 0.6);
  fwd -= fwd * (car.handbrake ? 1.6 : 0.45) * dt;
  if (!t && Math.abs(fwd) < 8) fwd = 0;
  fwd = Math.max(-s.top * 0.35, Math.min(s.top, fwd));
  const grip = car.handbrake ? 1.8 : 9;
  lat *= Math.exp(-grip * dt);
  const turnScale = Math.max(-1, Math.min(1, fwd / 110));
  car.angle += car.steer * s.turn * dt * turnScale * (car.handbrake ? 1.35 : 1);
  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  car.vx = nfx * fwd - nfy * lat;
  car.vy = nfy * fwd + nfx * lat;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (skids && Math.abs(lat) > 70) {
    skids.push({ x: car.x - nfx * s.len * 0.35, y: car.y - nfy * s.len * 0.35, a: car.angle, life: 6 });
    if (skids.length > 260) skids.shift();
  }
  // Two circles, front and back, stand in for the body against walls.
  let impact = 0;
  const r = s.wid / 2 + 1;
  for (const k of [0.28, -0.28]) {
    const px = car.x + nfx * s.len * k;
    const py = car.y + nfy * s.len * k;
    const res = resolveCircle(city, px, py, r);
    if (!res.hit) continue;
    car.x += res.x - px;
    car.y += res.y - py;
    const into = car.vx * res.nx + car.vy * res.ny;
    if (into < 0) {
      impact = Math.max(impact, -into);
      car.vx -= into * res.nx * 1.3;
      car.vy -= into * res.ny * 1.3;
      car.vx *= 0.8;
      car.vy *= 0.8;
    }
  }
  if (car.hitCool > 0) car.hitCool -= dt;
  return impact;
}

/** Push overlapping cars apart and trade momentum. Returns the pairs that struck hard. */
export function collideCars(cars) {
  const hits = [];
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = (a.spec.len + b.spec.len) * 0.5;
      if (dx * dx + dy * dy > reach * reach) continue;
      for (const ka of [0.25, -0.25]) {
        for (const kb of [0.25, -0.25]) {
          const ax = a.x + Math.cos(a.angle) * a.spec.len * ka;
          const ay = a.y + Math.sin(a.angle) * a.spec.len * ka;
          const bx = b.x + Math.cos(b.angle) * b.spec.len * kb;
          const by = b.y + Math.sin(b.angle) * b.spec.len * kb;
          const ddx = bx - ax;
          const ddy = by - ay;
          const min = (a.spec.wid + b.spec.wid) / 2;
          const d = Math.hypot(ddx, ddy);
          if (d >= min || d < 1e-4) continue;
          const nx = ddx / d;
          const ny = ddy / d;
          const overlap = min - d;
          const ma = a.parked ? 4 : a.spec.mass;
          const mb = b.parked ? 4 : b.spec.mass;
          const wa = mb / (ma + mb);
          const wb = ma / (ma + mb);
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb;
          b.y += ny * overlap * wb;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const jimp = -1.3 * rel / (1 / ma + 1 / mb);
            a.vx -= (jimp / ma) * nx;
            a.vy -= (jimp / ma) * ny;
            b.vx += (jimp / mb) * nx;
            b.vy += (jimp / mb) * ny;
            if (-rel > 60) hits.push({ a, b, speed: -rel });
          }
        }
      }
    }
  }
  return hits;
}

/** Where a car's headlights point, for the lighting pass. */
export function headlightPoint(car, ahead) {
  return { x: car.x + Math.cos(car.angle) * ahead, y: car.y + Math.sin(car.angle) * ahead };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Paint one car, nose along +x after rotation. */
export function drawCar(ctx, car, time) {
  const { len, wid } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 3, len, wid, 5);
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 5);
  if (car.kind === 'van') {
    ctx.fillStyle = '#2b2b2b';
    roundRect(ctx, len / 2 - 13, -wid / 2 + 2, 8, wid - 4, 2);
    ctx.fillStyle = '#b85c1c';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 2, len - 20, wid - 4);
    ctx.fillStyle = '#f3e7c9';
    ctx.fillRect(-len / 2 + 6, -2, len - 26, 4);
  } else {
    ctx.fillStyle = 'rgba(20,28,36,0.85)';
    roundRect(ctx, len * 0.08, -wid / 2 + 2.5, len * 0.2, wid - 5, 2);
    roundRect(ctx, -len * 0.38, -wid / 2 + 3, len * 0.14, wid - 6, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(-len * 0.22, -wid / 2 + 3, len * 0.28, wid - 6);
  }
  if (car.kind === 'watch') {
    ctx.fillStyle = '#1d3b4f';
    ctx.fillRect(-len * 0.12, -wid / 2, len * 0.36, 3);
    ctx.fillRect(-len * 0.12, wid / 2 - 3, len * 0.36, 3);
    ctx.fillRect(len * 0.32, -wid / 2 + 1, len * 0.16, wid - 2);
    const blink = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ffb300' : '#5a4a20';
    ctx.fillRect(-4, -wid / 2 + 2, 6, wid / 2 - 2);
    ctx.fillStyle = blink ? '#1d3a48' : '#38d6ff';
    ctx.fillRect(-4, 0, 6, wid / 2 - 2);
  }
  if (car.kind === 'cab') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-3, -4, 7, 8);
  }
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 2, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 6, 2, 4);
  ctx.fillStyle = car.throttle < 0 ? '#ff4b3a' : '#8a2a22';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 2, 4);
  ctx.fillRect(-len / 2, wid / 2 - 6, 2, 4);
  if (car.damage > 0.3) {
    ctx.fillStyle = 'rgba(30,20,15,0.5)';
    ctx.fillRect(len * 0.2, -wid / 2, len * 0.25, wid * Math.min(1, car.damage));
  }
  ctx.restore();
}
