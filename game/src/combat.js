// Close combat on foot: Ivo's shove-punch against pedestrians, and the damage
// he takes when a car clips him.

import { knockDown } from './pedestrians.js';
import { carRadius } from './cars.js';

const REACH = 52;
const ARC = 1.1;

export function punch(world, events) {
  const p = world.player;
  if (p.car || p.punchCool > 0) return false;
  p.punchCool = 0.35;
  p.swing = 0.2;
  let landed = false;
  for (const ped of world.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > REACH) continue;
    let diff = Math.atan2(dy, dx) - p.face;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > ARC) continue;
    ped.hp -= 1;
    if (ped.hp <= 0) {
      knockDown(ped, p.x, p.y, 260);
      events.push({ type: 'pedHit', ped, byPlayer: true });
    } else {
      ped.fear = 3;
      ped.x += dx / (d || 1) * 18;
      ped.y += dy / (d || 1) * 18;
      events.push({ type: 'punch', ped });
    }
    landed = true;
    break;
  }
  return landed;
}

export function footHazards(world, dt, events) {
  const p = world.player;
  if (p.car) return;
  p.hurtCool = Math.max(0, (p.hurtCool || 0) - dt);
  for (const car of world.cars) {
    if (Math.abs(car.speed) < 80 || p.hurtCool > 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < carRadius(car) + 12) {
      const dmg = Math.min(60, Math.abs(car.speed) / 6);
      p.health -= dmg;
      p.hurtCool = 0.8;
      const ux = (p.x - car.x) / (d || 1);
      const uy = (p.y - car.y) / (d || 1);
      p.x += ux * 40;
      p.y += uy * 40;
      car.speed *= 0.6;
      events.push({ type: 'hurt', amount: dmg });
    }
  }
}

export function tickCombat(world, dt) {
  const p = world.player;
  p.punchCool = Math.max(0, (p.punchCool || 0) - dt);
  p.swing = Math.max(0, (p.swing || 0) - dt);
}
