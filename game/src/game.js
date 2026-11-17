// The world of one night in Saltwake and the fixed-step update that ties the
// systems together: player, traffic, pedestrians, the watch, heat and jobs.

import { buildCity, nodeList, makeRng, T } from './city.js';
import { makeCar, collideCars } from './cars.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, respawnFarPeds } from './pedestrians.js';
import { makePlayer, updatePlayer, enterOrExit, playerWantsEnter } from './player.js';
import { makeWanted, addHeat, updateWanted, clearWanted } from './wanted.js';
import { updateWatch, clearWatch } from './watch.js';
import { punch, footHazards, tickCombat } from './combat.js';
import { makeJobs, updateJobs, loseLedger } from './jobs.js';
import { wasPressed } from './input.js';
import { writeSave } from './save.js';

const TRAFFIC = 28;
const PEDS = 80;

export function createWorld(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = makeRng(seed * 977 + 13);
  const city = buildCity(7);
  const nodes = nodeList();
  const world = {
    rng, city, nodes, cars: [], peds: [],
    player: makePlayer(city.spawn.x, city.spawn.y),
    wanted: makeWanted(),
    jobs: makeJobs(opts.job ?? 0),
    cash: opts.cash ?? 120,
    time: 0,
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1 },
    feed: [],
    banner: null,
    bustTimer: 0,
    spawnTimer: 0,
  };
  world.jobVan = makeCar('van', city.yardVan.x, city.yardVan.y, 0, '#2f6fd8');
  world.cars.push(world.jobVan);
  for (const [col, row, ang] of [[23.5, 29.4, 0], [26.5, 29.4, 0], [44.5, 26.6, Math.PI]]) {
    world.cars.push(makeCar('sedan', col * T, row * T, ang));
  }
  spawnTraffic(world, TRAFFIC, rng);
  spawnPeds(world, PEDS, rng);
  return world;
}

function say(world, text, color = '#ffffff') {
  world.feed.unshift({ text, color, time: 3.5 });
  if (world.feed.length > 4) world.feed.length = 4;
}

function respawn(world, reason) {
  const { city, player } = world;
  const lost = Math.floor(world.cash * 0.15);
  world.cash -= lost;
  if (player.car) player.car.driver = null;
  player.car = null;
  player.x = city.spawn.x;
  player.y = city.spawn.y;
  player.health = 100;
  clearWanted(world.wanted);
  clearWatch(world);
  loseLedger(world);
  world.banner = { text: reason, sub: lost > 0 ? `-$${lost}` : 'BACK IN THE YARD', time: 3 };
  writeSave(world.jobs.index, world.cash);
}

function cameraFollow(world, dt) {
  const { player, camera } = world;
  const body = player.car || player;
  const sp = player.car ? player.car.speed : 0;
  const lead = player.car ? 0.55 : 0;
  const tx = body.x + Math.cos(body.angle ?? player.face) * sp * lead;
  const ty = body.y + Math.sin(body.angle ?? player.face) * sp * lead;
  const k = Math.min(1, dt * 4);
  camera.x += (tx - camera.x) * k;
  camera.y += (ty - camera.y) * k;
  const wantZoom = player.car ? 1 - Math.min(0.22, Math.abs(sp) / 1600) : 1.15;
  camera.zoom += (wantZoom - camera.zoom) * Math.min(1, dt * 1.5);
}

export function stepWorld(world, dt, sound) {
  const { rng, player, wanted } = world;
  const events = [];
  world.time += dt;

  if (playerWantsEnter()) enterOrExit(world, rng, events);
  if (wasPressed('punch')) punch(world, events);
  tickCombat(world, dt);

  updatePlayer(world, dt);
  updateTraffic(world, dt, rng);
  const watch = updateWatch(world, dt, rng);

  for (const hit of collideCars(world.cars)) {
    const mine = hit.a === player.car || hit.b === player.car;
    const other = hit.a === player.car ? hit.b : hit.a;
    if (mine) {
      events.push({ type: 'crash' });
      if (other.kind === 'watch' && other.driver === 'watch') addHeat(wanted, 30);
      else if (other.ai) {
        other.ai.panic = 3;
        if (hit.force > 220) addHeat(wanted, 12);
      }
    }
  }
  footHazards(world, dt, events);
  updatePeds(world, dt, rng, events);
  respawnFarPeds(world, rng);

  for (const e of events) {
    if (e.type === 'pedHit' && e.byPlayer) {
      addHeat(wanted, 55);
      say(world, 'A WITNESS CALLED THE WATCH', '#ff8a5c');
    } else if (e.type === 'punch') {
      addHeat(wanted, 15);
    } else if (e.type === 'crime') {
      say(world, `YOU ${e.what.toUpperCase()}`, '#ff8a5c');
    }
  }

  updateWanted(wanted, dt, watch.seen);
  updateJobs(world, dt, events);

  for (const e of events) {
    if (sound) {
      if (e.type === 'crash') sound('crash');
      else if (e.type === 'pedHit') sound('hit');
      else if (e.type === 'punch') sound('punch');
      else if (e.type === 'door') sound('door');
      else if (e.type === 'jobDone') sound('cash');
      else if (e.type === 'jobFail') sound('warn');
    }
    if (e.type === 'jobDone') writeSave(world.jobs.index, world.cash);
  }
  if (world.jobs.warn > 0 && sound && Math.floor(world.time * 6) % 3 === 0) sound('warn');

  if (watch.busted) {
    if (sound) sound('bust');
    respawn(world, 'BUSTED BY THE HARBOR WATCH');
  } else if (player.health <= 0) {
    if (sound) sound('bust');
    respawn(world, 'LAID OUT ON THE STREET');
  }

  const civilians = world.cars.filter((c) => c.ai).length;
  if (civilians < TRAFFIC - 6) spawnTraffic(world, 1, rng);

  for (const f of world.feed) f.time -= dt;
  world.feed = world.feed.filter((f) => f.time > 0);
  if (world.banner) {
    world.banner.time -= dt;
    if (world.banner.time <= 0) world.banner = null;
  }
  cameraFollow(world, dt);
  return events;
}

export function snapCamera(world) {
  const body = world.player.car || world.player;
  world.camera.x = body.x;
  world.camera.y = body.y;
}
