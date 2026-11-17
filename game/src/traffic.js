// Through traffic: cars that drive the ring road (and an inner loop round the middle of town) in
// their own lane, both ways, braking for whatever is in front of them; plus the cars parked along
// the curbs that anyone can steal, the Yard's van among them.
import { LANE, LINES, MARKET_CAR_SPOT, PARK, ROAD_HALF, YARD_VAN_SPOT } from './city.js';
import { CAR_COLORS, carSpeed, createCar } from './cars.js';

const LOOPS = [
  { a: LINES[0], b: LINES[4], cars: 14 },
  { a: LINES[1], b: LINES[3], cars: 6 },
];
const CRUISE = 120;

/** The corner points a car on `loop` follows, in order, for direction 1 (clockwise) or -1. */
export function laneCorners(loop, dir) {
  const off = dir === 1 ? LANE : -LANE;
  const a = loop.a + off;
  const b = loop.b - off;
  const corners = [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }];
  return dir === 1 ? corners : corners.reverse();
}

function placeOnLoop(car, corners, t) {
  const seg = Math.floor(t * 4) % 4;
  const f = t * 4 - Math.floor(t * 4);
  const p = corners[seg];
  const q = corners[(seg + 1) % 4];
  car.x = p.x + (q.x - p.x) * f;
  car.y = p.y + (q.y - p.y) * f;
  car.angle = Math.atan2(q.y - p.y, q.x - p.x);
  car.route = { corners, next: (seg + 1) % 4 };
}

/** Fill the ring and the inner loop with moving cars and the curbs with parked ones. */
export function spawnTraffic(state) {
  const { rng } = state;
  for (const loop of LOOPS) {
    for (let k = 0; k < loop.cars; k += 1) {
      const dir = k % 2 === 0 ? 1 : -1;
      const kind = rng() < 0.2 ? 'cab' : rng() < 0.5 ? 'hatch' : 'sedan';
      const car = createCar(kind, 0, 0, 0, kind === 'cab' ? undefined : CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]);
      car.driver = 'traffic';
      placeOnLoop(car, laneCorners(loop, dir), (k / loop.cars + rng() * 0.03) % 1);
      const s = CRUISE * 0.8;
      car.vx = Math.cos(car.angle) * s;
      car.vy = Math.sin(car.angle) * s;
      state.cars.push(car);
    }
  }
  const van = createCar('van', YARD_VAN_SPOT.x, YARD_VAN_SPOT.y, YARD_VAN_SPOT.angle);
  van.parked = true;
  state.cars.push(van);
  state.yardVan = van;
  const marketCar = createCar('sedan', MARKET_CAR_SPOT.x, MARKET_CAR_SPOT.y, MARKET_CAR_SPOT.angle, '#5b8e7d');
  marketCar.parked = true;
  state.cars.push(marketCar);
  // Curbside spots on the side streets (x = 1050 runs north to south; y = 1050 and y = 600 run east to west).
  const spots = [];
  for (const y of [260, 480, 760, 940, 1180, 1380, 1640, 1820]) spots.push({ x: 1050 + (y % 3 ? PARK : -PARK), y, angle: Math.PI / 2 });
  for (const x of [260, 460, 820, 1280, 1680, 1860]) spots.push({ x, y: 1050 + (x % 3 ? PARK : -PARK), angle: 0 });
  for (const x of [300, 860, 1300, 1760]) spots.push({ x, y: 1500 - PARK, angle: Math.PI });
  for (const spot of spots) {
    if (Math.abs(spot.x - 1050) < ROAD_HALF + 30 && Math.abs(spot.y - 1050) < ROAD_HALF + 30) continue;
    const kind = rng() < 0.3 ? 'hatch' : 'sedan';
    const car = createCar(kind, spot.x, spot.y, spot.angle, CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)]);
    car.parked = true;
    state.cars.push(car);
  }
}

/** Steer `car` toward a point: returns the steering value in [-1, 1] and how far the nose is off. */
export function steerToward(car, x, y) {
  const want = Math.atan2(y - car.y, x - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { steer: Math.max(-1, Math.min(1, diff * 2.4)), off: Math.abs(diff) };
}

/** Distance to the nearest car or person in this car's path, Infinity when the way is clear. */
export function clearAhead(state, car, range) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let best = Infinity;
  const check = (x, y, width) => {
    const dx = x - car.x;
    const dy = y - car.y;
    const along = dx * fx + dy * fy;
    if (along <= 0 || along > range) return;
    if (Math.abs(dx * -fy + dy * fx) < width) best = Math.min(best, along);
  };
  for (const other of state.cars) if (other !== car) check(other.x, other.y, 16);
  if (state.player.onFoot) check(state.player.x, state.player.y, 14);
  for (const person of state.peds) if (person.mode !== 'down' && person.kind === 'civ') check(person.x, person.y, 10);
  return best;
}

/** Drive every traffic car round its loop. */
export function updateTraffic(state) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || !car.route) continue;
    const { corners } = car.route;
    let target = corners[car.route.next];
    if ((target.x - car.x) ** 2 + (target.y - car.y) ** 2 < 26 * 26) {
      car.route.next = (car.route.next + 1) % 4;
      target = corners[car.route.next];
    }
    // Aim a little past the line between corners so cars hold their lane.
    const prev = corners[(car.route.next + 3) % 4];
    const lx = target.x - prev.x;
    const ly = target.y - prev.y;
    const ll = Math.hypot(lx, ly) || 1;
    const along = ((car.x - prev.x) * lx + (car.y - prev.y) * ly) / ll;
    const aim = Math.min(ll, along + 60);
    const ax = prev.x + (lx / ll) * aim;
    const ay = prev.y + (ly / ll) * aim;
    const { steer, off } = steerToward(car, ax, ay);
    const gap = clearAhead(state, car, 90);
    const speed = carSpeed(car);
    const want = gap < 40 ? 0 : gap < 90 ? CRUISE * 0.4 : off > 0.5 ? CRUISE * 0.5 : CRUISE;
    car.steer = steer;
    car.throttle = speed < want - 5 ? 0.7 : speed > want + 10 ? -0.8 : 0.05;
    car.handbrake = false;
  }
}
