// Staged scenes for the screenshot tool, picked by ?shot=NAME: a chase on the
// Quay road, a Market street on foot, the title, and the run up the pier.

import { createWorld, snapCamera } from './game.js';
import { makeCar } from './cars.js';
import { makePed } from './pedestrians.js';
import { setLevel } from './wanted.js';
import { T, tileAt, WALK } from './city.js';
import { titleCamera } from './title.js';

function crowd(world, cx, cy, count, radius) {
  let placed = 0;
  for (let i = 0; i < 400 && placed < count; i++) {
    const x = cx + (world.rng() - 0.5) * radius * 2;
    const y = cy + (world.rng() - 0.5) * radius * 2;
    if (tileAt(world.city, x, y) !== WALK) continue;
    const p = makePed(x, y, world.rng);
    p.face = world.rng() * Math.PI * 2;
    p.step = world.rng() * 6;
    world.peds.push(p);
    placed++;
  }
}

function cruiser(world, x, y, angle, speed) {
  const c = makeCar('watch', x, y, angle);
  c.driver = 'watch';
  c.siren = 1;
  c.speed = speed;
  c.chase = { node: world.nodes[0], stuck: 0, reverse: 0 };
  world.cars.push(c);
  return c;
}

function civilian(world, x, y, angle, kind, color) {
  const c = makeCar(kind, x, y, angle, color);
  c.speed = 120;
  world.cars.push(c);
  return c;
}

function boardVan(world, x, y, angle, speed) {
  const van = world.jobVan;
  van.x = x;
  van.y = y;
  van.angle = angle;
  van.speed = speed;
  van.driver = 'player';
  world.player.car = van;
  world.player.x = x;
  world.player.y = y;
}

export function stageShot(name, seed) {
  if (name === 'title') {
    const world = createWorld({ seed });
    world.time = 3.2;
    titleCamera(world, 40);
    return { world, mode: 'title' };
  }
  if (name === 'street') {
    const world = createWorld({ seed, job: 1, cash: 420 });
    world.player.x = 47.5 * T;
    world.player.y = 26 * T + 30;
    world.player.face = -0.4;
    world.player.speed = 125;
    world.player.step = 2;
    const px = world.player.x;
    const py = world.player.y;
    world.cars = world.cars.filter((c) => Math.hypot(c.x - px, c.y - py) > 260);
    crowd(world, px, py, 14, 520);
    civilian(world, 46 * T, 27.5 * T, Math.PI, 'sedan', '#d94f3d');
    civilian(world, 36 * T, 28.5 * T, 0, 'hatch', '#f2c14e');
    civilian(world, 40.5 * T, 31 * T, -Math.PI / 2, 'van', '#57b86b');
    world.time = 12.4;
    snapCamera(world);
    world.camera.zoom = 1.1;
    world.feed.push({ text: 'THE LEDGER DROP IS RIGHT THERE — FIND WHEELS', color: '#ffd34d', time: 3 });
    return { world, mode: 'play' };
  }
  if (name === 'pier') {
    const world = createWorld({ seed, job: 2, cash: 1420 });
    world.jobs.ledger = true;
    boardVan(world, 41 * T, 6.2 * T, -Math.PI / 2, 260);
    setLevel(world.wanted, 2);
    cruiser(world, 40.6 * T, 11.2 * T, -Math.PI / 2 - 0.15, 300);
    cruiser(world, 37 * T, 9.5 * T, -0.1, 280);
    crowd(world, 41 * T, 7 * T, 6, 300);
    world.time = 21.7;
    snapCamera(world);
    world.camera.y += 60;
    world.camera.zoom = 0.92;
    return { world, mode: 'play' };
  }
  const world = createWorld({ seed, job: 2, cash: 1420 });
  world.jobs.ledger = true;
  boardVan(world, 34 * T, 19.5 * T, -0.08, 340);
  setLevel(world.wanted, 3);
  world.wanted.flash = 0;
  cruiser(world, 31.2 * T, 19.6 * T, 0.02, 360);
  cruiser(world, 29.5 * T, 18.4 * T, 0.1, 330);
  cruiser(world, 41.5 * T, 21.5 * T, -Math.PI / 2, 300);
  civilian(world, 38 * T, 18.5 * T, Math.PI, 'sedan', '#8a5fc2');
  civilian(world, 27 * T, 19.5 * T, 0, 'hatch', '#ef8a3c');
  crowd(world, 34 * T, 19 * T, 10, 560);
  world.time = 8.3;
  snapCamera(world);
  world.camera.x += 120;
  world.camera.zoom = 0.9;
  world.feed.push({ text: 'YOU RAMMED A WATCH CRUISER', color: '#ff8a5c', time: 3 });
  return { world, mode: 'play' };
}
