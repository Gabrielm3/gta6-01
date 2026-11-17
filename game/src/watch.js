// The harbor watch, Saltwake's police (how hard they push follows wanted.js): white-and-slate cruisers with amber-and-cyan bars. While
// Ivo is wanted they spawn out of sight at a street corner, run the street grid toward him,
// close in directly once near, and put officers on foot when he is out of his car. They drive
// away when the heat is off.
import { LAND, nearestNode, nodeNeighbours, resolveCircle } from './city.js';
import { carSpeed, createCar } from './cars.js';
import { createPerson, PERSON_RADIUS } from './pedestrians.js';
import { steerToward } from './traffic.js';

const CRUISERS_BY_LEVEL = [0, 1, 2, 3, 3, 4];
const SPAWN_MIN = 620;
const SPAWN_MAX = 1150;
const DIRECT_RANGE = 240;
const OFFICER_SPEED = 128;

export function watchCars(state) {
  return state.cars.filter((car) => car.kind === 'watch');
}

function spawnCruiser(state) {
  const p = state.player;
  const options = state.city.nodes.filter((n) => {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    return d > SPAWN_MIN && d < SPAWN_MAX && n.y > 0 && n.y < LAND;
  });
  if (!options.length) return;
  const node = options[Math.floor(state.rng() * options.length)];
  const car = createCar('watch', node.x, node.y, Math.atan2(p.y - node.y, p.x - node.x));
  car.driver = 'watch';
  car.node = node;
  car.mode = 'chase';
  state.cars.push(car);
  state.events.push('siren');
}

function nextNode(state, car) {
  const p = state.player;
  const options = nodeNeighbours(state.city, car.node);
  let best = options[0];
  let bestD = Infinity;
  for (const n of options) {
    if (car.prevNode && n === car.prevNode && options.length > 1) continue;
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  car.prevNode = car.node;
  car.node = best;
}

function driveCruiser(state, car, dt) {
  const p = state.player;
  const dist = Math.hypot(p.x - car.x, p.y - car.y);
  let tx;
  let ty;
  if (car.mode === 'leave') {
    tx = car.node.x;
    ty = car.node.y;
    if (Math.hypot(tx - car.x, ty - car.y) < 40) nextNodeAway(state, car);
  } else if (dist < DIRECT_RANGE) {
    tx = p.x;
    ty = p.y;
    car.node = nearestNode(state.city, car.x, car.y);
  } else {
    if (!car.node) car.node = nearestNode(state.city, car.x, car.y);
    if (Math.hypot(car.node.x - car.x, car.node.y - car.y) < 45) nextNode(state, car);
    tx = car.node.x;
    ty = car.node.y;
  }
  const { steer, off } = steerToward(car, tx, ty);
  const speed = carSpeed(car);
  car.steer = steer;
  let want = off > 1.2 ? 90 : off > 0.6 ? 170 : 300;
  if (car.mode !== 'leave' && p.onFoot && dist < 120) want = 0;
  if (car.mode !== 'leave' && !p.onFoot && dist < 130) {
    const ahead = (p.x - car.x) * Math.cos(car.angle) + (p.y - car.y) * Math.sin(car.angle) > 0;
    if (ahead) want = Math.min(want, carSpeed(p.car) * (dist < 80 ? 0.85 : 1.05));
  }
  car.throttle = speed < want ? 1 : -1;
  car.handbrake = off > 1.4 && speed > 140;
  // A cruiser stuck nose-first against a wall backs off and picks its way again.
  if (speed < 20 && car.throttle > 0) car.stuck += dt;
  else car.stuck = Math.max(0, car.stuck - dt);
  if (car.stuck > 1.2) {
    car.reverse = 0.8;
    car.stuck = 0;
  }
  if (car.reverse > 0) {
    car.reverse -= dt;
    car.throttle = -1;
    car.steer = -steer;
  }
}

function nextNodeAway(state, car) {
  const p = state.player;
  const options = nodeNeighbours(state.city, car.node);
  let best = options[0];
  let bestD = -1;
  for (const n of options) {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d > bestD) {
      bestD = d;
      best = n;
    }
  }
  car.node = best;
}

function deployOfficers(state, car, dt) {
  const p = state.player;
  car.deployCool = Math.max(0, car.deployCool - dt);
  if (car.mode === 'leave' || !p.onFoot || car.deployed >= 2 || car.deployCool > 0) return;
  if (Math.hypot(p.x - car.x, p.y - car.y) > 270 || carSpeed(car) > 60) return;
  const side = car.deployed === 0 ? 1 : -1;
  const ox = car.x - Math.sin(car.angle) * 16 * side;
  const oy = car.y + Math.cos(car.angle) * 16 * side;
  const res = resolveCircle(state.city, ox, oy, PERSON_RADIUS);
  const officer = createPerson(state.rng, 'officer', res.x, res.y);
  officer.mode = 'chase';
  officer.car = car;
  officer.attackCool = 0.6;
  state.peds.push(officer);
  car.deployed += 1;
  car.deployCool = 0.5;
  state.events.push('deploy');
}

function updateOfficers(state, dt) {
  const p = state.player;
  const hunting = state.wanted.level > 0 && p.onFoot;
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const o = state.peds[i];
    if (o.kind !== 'officer') continue;
    if (o.mode === 'down') {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vx *= Math.exp(-5 * dt);
      o.vy *= Math.exp(-5 * dt);
      o.downTimer -= dt;
      if (o.downTimer <= 0) o.mode = 'chase';
      continue;
    }
    const home = o.car && state.cars.includes(o.car) ? o.car : null;
    const tx = hunting ? p.x : home ? home.x : o.x;
    const ty = hunting ? p.y : home ? home.y : o.y;
    const dx = tx - o.x;
    const dy = ty - o.y;
    const d = Math.hypot(dx, dy);
    o.mode = hunting ? 'chase' : 'return';
    if (!hunting && (!home || d < 20)) {
      if (home) home.deployed = Math.max(0, home.deployed - 1);
      state.peds.splice(i, 1);
      continue;
    }
    if (d > 15) {
      o.angle = Math.atan2(dy, dx);
      o.x += (dx / d) * OFFICER_SPEED * dt;
      o.y += (dy / d) * OFFICER_SPEED * dt;
    }
    const res = resolveCircle(state.city, o.x, o.y, PERSON_RADIUS - 1);
    o.x = res.x;
    o.y = res.y;
  }
}

/** Spawn, drive, deploy and retire the watch for this step. */
export function updateWatch(state, dt) {
  const level = state.wanted.level;
  const cruisers = watchCars(state);
  const chasing = cruisers.filter((c) => c.mode !== 'leave');
  state.watchSpawn = Math.max(0, (state.watchSpawn ?? 0) - dt);
  if (chasing.length < CRUISERS_BY_LEVEL[level] && state.watchSpawn <= 0) {
    spawnCruiser(state);
    state.watchSpawn = 2.2;
  }
  if (chasing.length > CRUISERS_BY_LEVEL[level]) {
    const extra = chasing[chasing.length - 1];
    extra.mode = 'leave';
    extra.siren = false;
  }
  for (const car of cruisers) {
    if (car.driver === 'watch') driveCruiser(state, car, dt);
    deployOfficers(state, car, dt);
  }
  const p = state.player;
  state.cars = state.cars.filter((car) => car.kind !== 'watch' || car.mode !== 'leave' || Math.hypot(car.x - p.x, car.y - p.y) < 1100);
  updateOfficers(state, dt);
}
