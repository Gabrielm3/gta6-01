// One evening in Saltwake (deterministic for a given seed): the state of the whole town and the fixed-step update that runs every
// system in order (Ivo, traffic, the watch, car physics, people, fists, wanted, jobs) and
// collects this step's events for the sound and the screen reader.
import { buildCity, SAFEHOUSE } from './city.js';
import { carSpeed, collideCars, stepCar } from './cars.js';
import { officerAttacks, playerStrike } from './combat.js';
import { startJob, say, updateJobs } from './jobs.js';
import { runOverPeople, spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, exitCar, hurtPlayer, updatePlayer } from './player.js';
import { createRandom } from './random.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { createWanted, raiseWanted, updateWanted } from './wanted.js';
import { updateWatch } from './watch.js';

export const STEP = 1 / 60;
export const START_CASH = 120;

let sharedCity = null;

/** A fresh evening from `seed`, resuming at `progress.job` with `progress.cash` when given. */
export function createGame(seed, progress) {
  sharedCity ??= buildCity();
  const state = {
    rng: createRandom(seed), time: 0, city: sharedCity, cars: [], peds: [], effects: [], skids: [], events: [],
    player: createPlayer(), wanted: createWanted(), job: { id: 1, cool: 0, flash: 0 }, cash: progress?.cash ?? START_CASH,
    message: null, alarm: 0, down: 0, downCause: '', stats: { officersDropped: 0, peopleHit: 0 }, yardVan: null,
  };
  spawnTraffic(state);
  spawnPedestrians(state);
  startJob(state, progress?.job ?? 1);
  if (state.job.id === 3) say(state, 'YOU STILL HAVE THE LEDGER — THE WATCH IS OUT', 3, 'bad');
  state.events.length = 0;
  return state;
}

function knockOut(state) {
  state.down = 3.2;
  state.events.push('down');
  if (state.player.car) exitCar(state);
}

/** Ivo wakes at the Quay safehouse: lighter of pocket, heat off, and the ledger gone if he had it. */
function respawn(state) {
  const p = state.player;
  p.x = SAFEHOUSE.x;
  p.y = SAFEHOUSE.y;
  p.health = 100;
  state.cash = Math.max(0, state.cash - Math.min(80, Math.floor(state.cash * 0.1)));
  state.cars = state.cars.filter((c) => c.kind !== 'watch');
  state.peds = state.peds.filter((o) => o.kind !== 'officer');
  state.wanted.level = 0;
  const lostLedger = state.job.id === 3;
  startJob(state, lostLedger ? 2 : state.job.id);
  state.wanted.level = 0;
  say(state, lostLedger ? 'THE WATCH TOOK THE LEDGER — LIFT IT AGAIN' : 'BACK AT THE QUAY', 3, 'bad');
}

/** Advance the evening one fixed step under `controls`. Returns this step's events. */
export function stepGame(state, controls, dt) {
  state.events.length = 0;
  state.time += dt;
  if (state.down > 0) {
    state.down -= dt;
    if (state.down <= 0) respawn(state);
    return state.events;
  }
  const p = state.player;
  updatePlayer(state, controls, dt);
  if (controls.strike && p.onFoot) playerStrike(state);
  updateTraffic(state, dt);
  updateWatch(state, dt);
  for (const car of state.cars) {
    if (car.parked && !car.vx && !car.vy) continue;
    const impact = stepCar(car, state.city, dt, state.skids);
    if (car.driver === 'player' && impact > 120) {
      state.events.push('crash');
      car.damage = Math.min(1, car.damage + impact / 1500);
      if (impact > 200 && hurtPlayer(state, Math.floor(impact / 40))) state.downCause = 'crash';
    }
  }
  for (const hit of collideCars(state.cars)) {
    const mine = hit.a.driver === 'player' || hit.b.driver === 'player';
    if (mine) state.events.push('crash');
  }
  if (p.car) {
    p.x = p.car.x;
    p.y = p.car.y;
  }
  for (const person of runOverPeople(state)) {
    state.stats.peopleHit += 1;
    state.events.push('hit');
    raiseWanted(state, 1, person.kind === 'officer' ? 'officer' : 'hit');
  }
  // Watch cars that run Ivo down on foot hurt him.
  if (p.onFoot && p.hurtCool <= 0) {
    for (const car of state.cars) {
      if (car.driver === 'player' || carSpeed(car) < 90) continue;
      if (Math.hypot(car.x - p.x, car.y - p.y) < car.spec.len * 0.5) {
        p.hurtCool = 1;
        if (hurtPlayer(state, 20)) state.downCause = 'crash';
      }
    }
  }
  updatePedestrians(state, dt);
  if (officerAttacks(state, dt)) state.downCause = 'watch';
  updateWanted(state, dt);
  updateJobs(state, dt);
  if (p.health <= 0) knockOut(state);
  else if (state.wanted.level === 0 && p.health < 100) p.health = Math.min(100, p.health + dt * 2);
  for (const e of state.effects) e.life -= dt;
  state.effects = state.effects.filter((e) => e.life > 0);
  for (const s of state.skids) s.life -= dt;
  while (state.skids.length && state.skids[0].life <= 0) state.skids.shift();
  if (state.message) {
    state.message.life -= dt;
    if (state.message.life <= 0) state.message = null;
  }
  return state.events;
}
