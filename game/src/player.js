// Ivo Pell, the courier: walking (and running) through town, getting into any car that is not
// the watch's (parked ones quietly, moving ones by pulling the driver out), driving it, and
// getting back out on the curb.
import { resolveCircle, SAFEHOUSE } from './city.js';
import { carSpeed, collideCars } from './cars.js';
import { createPerson, PERSON_RADIUS } from './pedestrians.js';
import { raiseWanted } from './wanted.js';

const WALK = 120;
const RUN = 190;
const ENTER_REACH = 44;

export function createPlayer() {
  return {
    x: SAFEHOUSE.x, y: SAFEHOUSE.y, angle: -Math.PI / 2, onFoot: true, car: null, health: 100,
    phase: 0, moving: false, strikeCool: 0, strikeTime: 0, hurtCool: 0, shirt: '#f2a541', skin: '#d7a27a', hair: '#2a1d15', mode: 'walk',
  };
}

/** The car Ivo would take with E from where he stands, or null. */
export function carInReach(state) {
  const p = state.player;
  if (!p.onFoot) return null;
  let best = null;
  let bestD = ENTER_REACH * ENTER_REACH;
  for (const car of state.cars) {
    if (car.kind === 'watch') continue;
    const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(state, car) {
  const p = state.player;
  if (car.driver === 'traffic') {
    const driver = createPerson(state.rng, 'civ', car.x - Math.sin(car.angle) * 20, car.y + Math.cos(car.angle) * 20);
    driver.mode = 'flee';
    driver.timer = 4;
    driver.threat = { x: car.x, y: car.y };
    driver.loop = state.city.blocks[0] && { x0: driver.x - 40, y0: driver.y - 40, x1: driver.x + 40, y1: driver.y + 40 };
    state.peds.push(driver);
    raiseWanted(state, 1, 'carjack');
  }
  car.driver = 'player';
  car.parked = false;
  car.route = null;
  p.car = car;
  p.onFoot = false;
  state.events.push('enter');
}

export function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.throttle = 0;
  car.steer = 0;
  car.handbrake = true;
  p.car = null;
  p.onFoot = true;
  const side = { x: car.x + Math.sin(car.angle) * 22, y: car.y - Math.cos(car.angle) * 22 };
  const res = resolveCircle(state.city, side.x, side.y, PERSON_RADIUS);
  p.x = res.x;
  p.y = res.y;
  p.angle = car.angle;
  state.events.push('exit');
}

/** Read the controls for this step: move or drive, and handle E. */
export function updatePlayer(state, controls, dt) {
  const p = state.player;
  p.strikeCool = Math.max(0, p.strikeCool - dt);
  p.strikeTime = Math.max(0, p.strikeTime - dt);
  p.hurtCool = Math.max(0, p.hurtCool - dt);
  p.phase += dt;
  if (controls.enter) {
    if (p.onFoot) {
      const car = carInReach(state);
      if (car) enterCar(state, car);
    } else if (carSpeed(p.car) < 90) exitCar(state);
  }
  if (!p.onFoot) {
    const car = p.car;
    car.throttle = controls.moveY < 0 ? 1 : controls.moveY > 0 ? -1 : 0;
    car.steer = controls.moveX;
    car.handbrake = controls.brake;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    return;
  }
  const len = Math.hypot(controls.moveX, controls.moveY);
  const speed = controls.run ? RUN : WALK;
  p.moving = len > 0;
  if (len > 0) {
    p.x += (controls.moveX / len) * speed * dt;
    p.y += (controls.moveY / len) * speed * dt;
  }
  if (controls.aim) p.angle = Math.atan2(controls.aim.y - p.y, controls.aim.x - p.x);
  else if (len > 0) p.angle = Math.atan2(controls.moveY, controls.moveX);
  const res = resolveCircle(state.city, p.x, p.y, PERSON_RADIUS);
  p.x = res.x;
  p.y = res.y;
  // Keep Ivo out of car bodies.
  const body = { x: p.x, y: p.y, vx: 0, vy: 0, angle: p.angle, parked: false, spec: { len: 10, wid: 13, mass: 0.15 } };
  collideCars([body, ...state.cars.filter((c) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 2500)]);
  p.x = body.x;
  p.y = body.y;
}

/** Hurt Ivo; returns true when that knocks him out. */
export function hurtPlayer(state, amount) {
  const p = state.player;
  p.health = Math.max(0, p.health - amount);
  state.events.push('hurt');
  return p.health <= 0;
}
