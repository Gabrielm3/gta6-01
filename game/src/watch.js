// The harbor watch: patrol cruisers that spawn with the wanted level, route
// over the road grid toward Ivo, ram, and make the bust when he stops.

import { makeCar, driveCar } from './cars.js';
import { nearestNode } from './city.js';

const CRUISERS_BY_LEVEL = [0, 1, 2, 3, 4, 6];
const SIGHT = 620;
const BUST_RANGE = 95;

function route(nodes, start, goal) {
  if (start === goal) return goal;
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const n = queue.shift();
    if (n === goal) break;
    for (const m of n.links) {
      if (!prev.has(m)) {
        prev.set(m, n);
        queue.push(m);
      }
    }
  }
  let step = goal;
  while (prev.get(step) && prev.get(step) !== start) step = prev.get(step);
  return step;
}

function angleTo(car, x, y) {
  let diff = Math.atan2(y - car.y, x - car.x) - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function spawnCruiser(world, rng) {
  const { nodes, player } = world;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const far = nodes.filter((n) => {
    const d = Math.hypot(n.x - px, n.y - py);
    return d > 720 && d < 1500;
  });
  const pool = far.length ? far : nodes;
  const n = pool[Math.floor(rng() * pool.length)];
  const car = makeCar('watch', n.x, n.y, Math.atan2(py - n.y, px - n.x));
  car.driver = 'watch';
  car.chase = { node: n, stuck: 0, reverse: 0 };
  car.siren = 1;
  world.cars.push(car);
  return car;
}

export function updateWatch(world, dt, rng) {
  const { player, wanted, nodes } = world;
  const target = player.car || player;
  const tx = target.x;
  const ty = target.y;
  const cruisers = world.cars.filter((c) => c.kind === 'watch' && c.driver === 'watch');

  const want = CRUISERS_BY_LEVEL[wanted.level];
  world.spawnTimer = (world.spawnTimer || 0) - dt;
  if (cruisers.filter((c) => c.health > 0).length < want && world.spawnTimer <= 0) {
    cruisers.push(spawnCruiser(world, rng));
    world.spawnTimer = 2.5 - wanted.level * 0.3;
  }

  let seen = false;
  let closest = Infinity;
  for (const car of cruisers) {
    const d = Math.hypot(tx - car.x, ty - car.y);
    if (car.health <= 0) {
      car.siren = 0;
      driveCar(car, { throttle: 0, steer: 0, brake: true }, dt, world.city);
      continue;
    }
    if (wanted.level === 0) {
      car.siren = 0;
      const away = angleTo(car, tx, ty);
      driveCar(car, { throttle: 0.6, steer: away > 0 ? -1 : 1, brake: false }, dt, world.city);
      if (d > 1600) car.remove = true;
      continue;
    }
    car.siren = 1;
    if (d < SIGHT) seen = true;
    closest = Math.min(closest, d);

    let gx = tx;
    let gy = ty;
    if (d > 380) {
      const goal = nearestNode(nodes, tx, ty);
      if (Math.hypot(car.chase.node.x - car.x, car.chase.node.y - car.y) < 70) {
        car.chase.node = route(nodes, nearestNode(nodes, car.x, car.y), goal);
      }
      if (car.chase.node !== goal || Math.hypot(goal.x - car.x, goal.y - car.y) > 70) {
        gx = car.chase.node.x;
        gy = car.chase.node.y;
      }
    }

    const ch = car.chase;
    if (ch.reverse > 0) {
      ch.reverse -= dt;
      driveCar(car, { throttle: -1, steer: angleTo(car, gx, gy) > 0 ? -1 : 1, brake: false }, dt, world.city);
      continue;
    }
    if (Math.abs(car.speed) < 30) ch.stuck += dt;
    else ch.stuck = Math.max(0, ch.stuck - dt);
    if (ch.stuck > 1.2) {
      ch.stuck = 0;
      ch.reverse = 0.9;
    }
    const diff = angleTo(car, gx, gy);
    const steer = Math.max(-1, Math.min(1, diff * 2.5));
    const slow = d < 140 && Math.abs(target.speed || 0) < 60;
    const throttle = slow ? 0.25 : Math.abs(diff) > 1.4 ? 0.45 : 1;
    driveCar(car, { throttle, steer, brake: Math.abs(diff) > 1.8 && car.speed > 200 }, dt, world.city);
  }

  world.cars = world.cars.filter((c) => !c.remove);

  const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
  if (wanted.level > 0 && closest < BUST_RANGE && playerSpeed < 50) {
    world.bustTimer = (world.bustTimer || 0) + dt * (player.car ? 1 : 1.6);
  } else {
    world.bustTimer = Math.max(0, (world.bustTimer || 0) - dt * 0.7);
  }
  return { seen, busted: world.bustTimer >= 2.2 };
}

export function clearWatch(world) {
  world.cars = world.cars.filter((c) => c.kind !== 'watch');
  world.bustTimer = 0;
}
