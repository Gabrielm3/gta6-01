// The staged screenshots behind ?shot=chase|street|title|pier (with &seed=N). Each starts a real
// evening and runs the real systems forward, with an autopilot at the controls where Ivo has to
// act, until the moment the shot is about: a watch cruiser on the bumper, Ivo beside a car he
// can steal in the Market, the start screen, a strike dropping an officer on the north pier.
import { LINES, PIER } from './city.js';
import { carSpeed, createCar } from './cars.js';
import { createGame, STEP, stepGame } from './game.js';
import { idleControls } from './input.js';
import { enterCar } from './player.js';
import { clearAhead, laneCorners, steerToward } from './traffic.js';
import { titleCameraPoint } from './title.js';

const RING = { a: LINES[0], b: LINES[4] };

function driveRing(state, corners, pilot) {
  const car = state.player.car;
  let target = corners[pilot.next];
  if (Math.hypot(target.x - car.x, target.y - car.y) < 40) {
    pilot.next = (pilot.next + 1) % 4;
    target = corners[pilot.next];
  }
  const { steer } = steerToward(car, target.x, target.y);
  const gap = clearAhead(state, car, 120);
  const controls = idleControls();
  controls.moveX = steer;
  controls.moveY = gap < 70 ? 1 : carSpeed(car) < 235 ? -1 : 0;
  return controls;
}

function stageChase(seed) {
  const state = createGame(seed, { job: 3, cash: 1840 });
  const corners = laneCorners(RING, -1);
  const car = createCar('sedan', corners[1].x, 1760, -Math.PI / 2, '#c8553d');
  state.cars = state.cars.filter((c) => Math.hypot(c.x - car.x, c.y - car.y) > 80);
  state.cars.push(car);
  enterCar(state, car);
  const pilot = { next: 2 };
  for (let i = 0; i < 60 / STEP; i += 1) {
    stepGame(state, driveRing(state, corners, pilot), STEP);
    if (state.time < 5) continue;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const behind = state.cars.some((c) => {
      if (c.kind !== 'watch') return false;
      const dx = c.x - car.x;
      const dy = c.y - car.y;
      const d = Math.hypot(dx, dy);
      return d > 70 && d < 190 && (dx * fx + dy * fy) < -0.7 * d;
    });
    if (behind && carSpeed(car) > 150) break;
  }
  return { state, screen: 'play' };
}

function stageStreet(seed) {
  const state = createGame(seed, { job: 2, cash: 640 });
  const p = state.player;
  p.x = 1553;
  p.y = 1258;
  const controls = idleControls();
  controls.aim = { x: 1531, y: 1290 };
  for (let i = 0; i < 6 / STEP; i += 1) stepGame(state, controls, STEP);
  return { state, screen: 'play' };
}

function stageTitle(seed) {
  const state = createGame(seed, { job: 2, cash: 370 });
  for (let i = 0; i < 4 / STEP; i += 1) stepGame(state, idleControls(), STEP);
  return { state, screen: 'title', save: { job: 2, cash: 370 }, cam: titleCameraPoint(state.time) };
}

function stagePier(seed) {
  const state = createGame(seed, { job: 3, cash: 1840 });
  const p = state.player;
  p.x = PIER.endX;
  p.y = -170;
  p.angle = Math.PI / 2;
  let after = -1;
  for (let i = 0; i < 60 / STEP; i += 1) {
    const controls = idleControls();
    let nearest = null;
    let nd = Infinity;
    for (const o of state.peds) {
      if (o.kind !== 'officer' || o.mode === 'down') continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < nd) {
        nd = d;
        nearest = o;
      }
    }
    if (nearest && nd < 90) controls.aim = { x: nearest.x, y: nearest.y };
    else controls.aim = { x: p.x, y: p.y + 10 };
    if (nearest && nd < 26 && after < 0) controls.strike = true;
    stepGame(state, controls, STEP);
    if (after < 0 && state.stats.officersDropped > 0) after = 7;
    if (after > 0 && --after === 0) break;
  }
  return { state, screen: 'play' };
}

/** Build the named scene. Returns the state, which screen to draw, and any staged save or camera. */
export function stageShot(name, seed) {
  if (name === 'street') return stageStreet(seed);
  if (name === 'title') return stageTitle(seed);
  if (name === 'pier') return stagePier(seed);
  return stageChase(seed);
}
