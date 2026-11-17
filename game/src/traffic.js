// Civilian traffic: cars drive node to node on the road grid, keeping to the
// right-hand lane, and slow for whatever is ahead of them.

import { makeCar, moveCar, randomPaint } from './cars.js';
import { T } from './city.js';

const CRUISE = 170;
const LANE = T * 0.5;

function laneTarget(from, to) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  return { x: to.x - dy * LANE, y: to.y + dx * LANE };
}

function pickNext(node, prev, rng) {
  const options = node.links.filter((n) => n !== prev);
  const pool = options.length ? options : node.links;
  return pool[Math.floor(rng() * pool.length)];
}

export function spawnTraffic(world, count, rng) {
  const { nodes } = world;
  for (let i = 0; i < count; i++) {
    const from = nodes[Math.floor(rng() * nodes.length)];
    const to = from.links[Math.floor(rng() * from.links.length)];
    const t = 0.2 + rng() * 0.6;
    const a = laneTarget(to, from);
    const b = laneTarget(from, to);
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    const kind = rng() < 0.2 ? 'van' : rng() < 0.5 ? 'sedan' : 'hatch';
    const car = makeCar(kind, x, y, Math.atan2(to.y - from.y, to.x - from.x), randomPaint(rng));
    car.ai = { from, to, cruise: CRUISE * (0.8 + rng() * 0.4) };
    car.speed = car.ai.cruise * 0.6;
    world.cars.push(car);
  }
}

function blockedAhead(car, others, player) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = Infinity;
  const check = (x, y) => {
    const dx = x - car.x;
    const dy = y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < 140 && side < 30) nearest = Math.min(nearest, along);
  };
  for (const o of others) if (o !== car) check(o.x, o.y);
  if (player && !player.car) check(player.x, player.y);
  return nearest;
}

export function updateTraffic(world, dt, rng) {
  for (const car of world.cars) {
    if (!car.ai || car.driver === 'player' || car.health <= 0) {
      if (!car.driver && car.kind !== 'watch') {
        car.speed *= Math.pow(0.2, dt);
        moveCar(car, dt, world.city);
      }
      continue;
    }
    const ai = car.ai;
    if (ai.panic > 0) ai.panic -= dt;
    const tgt = laneTarget(ai.from, ai.to);
    const dx = tgt.x - car.x;
    const dy = tgt.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      const next = pickNext(ai.to, ai.from, rng);
      ai.from = ai.to;
      ai.to = next;
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1, Math.min(1, diff * 4)) * dt * 3;

    const ahead = blockedAhead(car, world.cars, world.player);
    let target = ai.panic > 0 ? ai.cruise * 1.5 : ai.cruise;
    if (Math.abs(diff) > 0.5) target *= 0.45;
    if (dist < 90) target *= 0.7;
    if (ahead < 140) target *= Math.max(0, (ahead - 50) / 90);
    car.speed += (target - car.speed) * Math.min(1, dt * 2.5);
    moveCar(car, dt, world.city);
  }
}

export function attachTrafficAi(car, nodes) {
  let best = nodes[0];
  let bd = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - car.x, n.y - car.y);
    if (d < bd) { bd = d; best = n; }
  }
  car.ai = { from: best, to: best.links[0], cruise: CRUISE };
}
