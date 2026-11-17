// Pedestrians: walkers that stroll the sidewalks, scatter from fast cars and
// the player's fists, and fall when hit.

import { T, COLS, ROWS, WALK, PIER, tileAt, isWalkable, blocksFoot } from './city.js';
import { carRadius } from './cars.js';

const SHIRTS = ['#f25f5c', '#ffe066', '#70c1b3', '#247ba0', '#f3a712', '#b388eb', '#ff8fab', '#9bd770'];
const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function makePed(x, y, rng) {
  return {
    x, y, dir: Math.floor(rng() * 4), speed: 40 + rng() * 30,
    shirt: SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKIN[Math.floor(rng() * SKIN.length)],
    fear: 0, down: 0, step: rng() * 10, turnIn: 1 + rng() * 3, hp: 2,
  };
}

export function spawnPeds(world, count, rng) {
  const spots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (world.city.tiles[r * COLS + c] === WALK) spots.push([c, r]);
    }
  }
  for (let i = 0; i < count && spots.length; i++) {
    const [c, r] = spots[Math.floor(rng() * spots.length)];
    world.peds.push(makePed(c * T + T / 2, r * T + T / 2, rng));
  }
}

export function knockDown(ped, fromX, fromY, power) {
  const d = Math.hypot(ped.x - fromX, ped.y - fromY) || 1;
  ped.vx = (ped.x - fromX) / d * power;
  ped.vy = (ped.y - fromY) / d * power;
  ped.down = 6;
  ped.hp = 0;
}

export function updatePeds(world, dt, rng, events) {
  const { city, player, cars } = world;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const pSpeed = player.car ? Math.abs(player.car.speed) : 0;

  for (const p of world.peds) {
    if (p.down > 0) {
      p.down -= dt;
      if (p.vx) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      }
      continue;
    }
    for (const car of cars) {
      const hitR = carRadius(car) + 10;
      if (Math.abs(car.speed) > 90 && Math.hypot(car.x - p.x, car.y - p.y) < hitR) {
        knockDown(p, car.x, car.y, Math.abs(car.speed) * 0.8);
        car.speed *= 0.85;
        events.push({ type: 'pedHit', ped: p, byPlayer: car.driver === 'player' });
        break;
      }
    }
    if (p.down > 0) continue;

    const dp = Math.hypot(px - p.x, py - p.y);
    if ((pSpeed > 200 && dp < 220) || (world.wanted.level >= 3 && dp < 260)) p.fear = 2.5;
    p.step += dt * (p.fear > 0 ? 14 : 7);

    let vx;
    let vy;
    if (p.fear > 0) {
      p.fear -= dt;
      const d = dp || 1;
      vx = (p.x - px) / d * 150;
      vy = (p.y - py) / d * 150;
    } else {
      p.turnIn -= dt;
      const [dx, dy] = DIRS[p.dir];
      const ahead = tileAt(city, p.x + dx * T * 0.55, p.y + dy * T * 0.55);
      if (!isWalkable(ahead) || p.turnIn <= 0) {
        p.turnIn = 2 + rng() * 4;
        const choices = [];
        for (let k = 0; k < 4; k++) {
          const [ex, ey] = DIRS[k];
          if (isWalkable(tileAt(city, p.x + ex * T * 0.55, p.y + ey * T * 0.55))) choices.push(k);
        }
        if (choices.length) p.dir = choices[Math.floor(rng() * choices.length)];
        else p.dir = (p.dir + 2) % 4;
      }
      const [ddx, ddy] = DIRS[p.dir];
      vx = ddx * p.speed;
      vy = ddy * p.speed;
      if (ddx !== 0) vy = (Math.floor(p.y / T) * T + T / 2 - p.y) * 2;
      if (ddy !== 0) vx = (Math.floor(p.x / T) * T + T / 2 - p.x) * 2;
    }
    const nx = p.x + vx * dt;
    const ny = p.y + vy * dt;
    if (!blocksFoot(tileAt(city, nx, p.y))) p.x = nx;
    if (!blocksFoot(tileAt(city, p.x, ny))) p.y = ny;
    p.face = Math.atan2(vy, vx);
  }
}

export function respawnFarPeds(world, rng) {
  const { player } = world;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  for (let i = 0; i < world.peds.length; i++) {
    const p = world.peds[i];
    if (p.down > 0 && p.down < 0.1 && Math.hypot(p.x - px, p.y - py) > 900) {
      const tile = tileAt(world.city, p.x, p.y);
      if (tile === WALK || tile === PIER) {
        world.peds[i] = makePed(p.x, p.y, rng);
      }
    }
  }
}

export function drawPed(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.down > 0 && p.hp <= 0) {
    ctx.rotate(p.face || 0);
    ctx.fillStyle = 'rgba(120,20,30,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.strokeStyle = '#14141c';
    ctx.lineWidth = 3;
    ctx.fillRect(-14, -7, 22, 14);
    ctx.strokeRect(-14, -7, 22, 14);
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(12, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.rotate((p.face || 0) + Math.PI / 2);
  const swing = Math.sin(p.step) * 5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b3a';
  ctx.fillRect(-8, -2 + swing, 6, 10);
  ctx.fillRect(2, -2 - swing, 6, 10);
  ctx.fillStyle = p.shirt;
  ctx.strokeStyle = '#14141c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(0, -1, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
