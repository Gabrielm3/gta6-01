// Ivo Pell, courier: walks, runs, takes cars (empty, civilian or watch), and
// drives them.

import { driveCar, carRadius } from './cars.js';
import { tileAt, blocksFoot } from './city.js';
import { makePed } from './pedestrians.js';
import { addHeat } from './wanted.js';
import { axes, isHeld, wasPressed } from './input.js';

const WALK = 125;
const RUN = 200;
const GRAB = 78;

export function makePlayer(x, y) {
  return { x, y, face: 0, car: null, health: 100, step: 0, punchCool: 0, swing: 0, speed: 0 };
}

function exitSpot(car, city) {
  const tries = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];
  for (const off of tries) {
    const a = car.angle + off;
    const d = (off === 0 || off === Math.PI ? car.w : car.h) / 2 + 22;
    const x = car.x + Math.cos(a) * d;
    const y = car.y + Math.sin(a) * d;
    if (!blocksFoot(tileAt(city, x, y))) return { x, y };
  }
  return { x: car.x, y: car.y };
}

export function enterOrExit(world, rng, events) {
  const p = world.player;
  if (p.car) {
    const car = p.car;
    const spot = exitSpot(car, world.city);
    car.driver = null;
    p.car = null;
    p.x = spot.x;
    p.y = spot.y;
    events.push({ type: 'door' });
    return;
  }
  let best = null;
  let bd = Infinity;
  for (const car of world.cars) {
    if (car.health <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y) - carRadius(car);
    if (d < GRAB && d < bd) { bd = d; best = car; }
  }
  if (!best) return;
  if (best.kind === 'watch' && best.driver === 'watch') {
    addHeat(world.wanted, 150);
    events.push({ type: 'crime', what: 'took a watch cruiser' });
  } else if (best.ai) {
    const spot = exitSpot(best, world.city);
    const ped = makePed(spot.x, spot.y, rng);
    ped.fear = 4;
    world.peds.push(ped);
    addHeat(world.wanted, 45);
    events.push({ type: 'crime', what: 'jacked a car' });
  }
  best.ai = null;
  best.chase = null;
  best.siren = 0;
  best.driver = 'player';
  p.car = best;
  events.push({ type: 'door' });
}

export function updatePlayer(world, dt) {
  const p = world.player;
  const a = axes();
  if (p.car) {
    driveCar(p.car, { throttle: -a.y, steer: a.x, brake: isHeld('brake') }, dt, world.city);
    p.x = p.car.x;
    p.y = p.car.y;
    p.speed = Math.abs(p.car.speed);
    return;
  }
  const len = Math.hypot(a.x, a.y);
  if (len === 0) {
    p.speed = 0;
    return;
  }
  const sp = isHeld('run') ? RUN : WALK;
  const vx = a.x / len * sp;
  const vy = a.y / len * sp;
  p.face = Math.atan2(vy, vx);
  p.step += dt * (sp / 12);
  p.speed = sp;
  const stuck = blocksFoot(tileAt(world.city, p.x, p.y));
  const nx = p.x + vx * dt;
  const ny = p.y + vy * dt;
  if (stuck || !blocksFoot(tileAt(world.city, nx, p.y))) p.x = nx;
  if (stuck || !blocksFoot(tileAt(world.city, p.x, ny))) p.y = ny;
}

export function playerWantsEnter() {
  return wasPressed('enter');
}

export function drawPlayer(ctx, p, time) {
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(255,211,77,0.28)';
  ctx.beginPath();
  ctx.arc(0, 0, 30 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.face + Math.PI / 2);
  const swing = p.speed > 0 ? Math.sin(p.step) * 6 : 0;
  ctx.fillStyle = '#1d1d28';
  ctx.fillRect(-9, -2 + swing, 7, 12);
  ctx.fillRect(2, -2 - swing, 7, 12);
  ctx.strokeStyle = '#0d0d14';
  ctx.lineWidth = 4;
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (p.swing > 0) {
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.arc(9, -20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#8d5524';
  ctx.beginPath();
  ctx.arc(0, -1, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a10';
  ctx.beginPath();
  ctx.arc(0, 1, 5, 0, Math.PI);
  ctx.fill();
  ctx.restore();
}
