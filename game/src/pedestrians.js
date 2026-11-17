// People on foot: Saltwake's walkers loop the sidewalk round their block, scatter from a fast car
// or a fight, and lie where a car or a strike drops them. drawPerson paints anyone on foot,
// Ivo and the harbor watch's officers included.
import { resolveCircle, SIDEWALK } from './city.js';
import { carSpeed } from './cars.js';

const SHIRTS = ['#c94f3d', '#3d7ea6', '#e0c25a', '#6a8f4e', '#9b5d8a', '#d9d2c3', '#4b4f63', '#c97b3d'];
const SKINS = ['#f1c9a5', '#d7a27a', '#a86f48', '#7a4b2e', '#e6b48f'];
const HAIR = ['#2a1d15', '#5a3a22', '#c9a46a', '#1b1b1b', '#8a8a8a'];

export const PERSON_RADIUS = 7;

function loopPoint(loop, p) {
  const w = loop.x1 - loop.x0;
  const h = loop.y1 - loop.y0;
  const per = 2 * (w + h);
  let t = ((p % per) + per) % per;
  if (t < w) return { x: loop.x0 + t, y: loop.y0 };
  t -= w;
  if (t < h) return { x: loop.x1, y: loop.y0 + t };
  t -= h;
  if (t < w) return { x: loop.x1 - t, y: loop.y1 };
  t -= w;
  return { x: loop.x0, y: loop.y1 - t };
}

function nearestLoopParam(loop, x, y) {
  const w = loop.x1 - loop.x0;
  const h = loop.y1 - loop.y0;
  const cx = Math.max(loop.x0, Math.min(x, loop.x1));
  const cy = Math.max(loop.y0, Math.min(y, loop.y1));
  const d = [Math.abs(cy - loop.y0), Math.abs(cx - loop.x1), Math.abs(cy - loop.y1), Math.abs(cx - loop.x0)];
  const m = Math.min(...d);
  if (m === d[0]) return cx - loop.x0;
  if (m === d[1]) return w + (cy - loop.y0);
  if (m === d[2]) return w + h + (loop.x1 - cx);
  return 2 * w + h + (loop.y1 - cy);
}

export function createPerson(rng, kind, x, y) {
  return {
    kind, x, y, angle: rng() * Math.PI * 2, vx: 0, vy: 0, mode: 'walk', timer: 0, downTimer: 0,
    shirt: kind === 'officer' ? '#1f3b57' : SHIRTS[Math.floor(rng() * SHIRTS.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    hair: kind === 'officer' ? '#38d6ff' : HAIR[Math.floor(rng() * HAIR.length)],
    phase: rng() * 10, speed: 28 + rng() * 22, loop: null, p: 0, dir: rng() < 0.5 ? 1 : -1,
    attackCool: 0, car: null, threat: null,
  };
}

/** Put walkers on every block's sidewalk; the Market gets the busiest pavements. */
export function spawnPedestrians(state) {
  const { rng, city } = state;
  for (const block of city.blocks) {
    const loop = { x0: block.x0 + SIDEWALK / 2, y0: block.y0 + SIDEWALK / 2, x1: block.x1 - SIDEWALK / 2, y1: block.y1 - SIDEWALK / 2 };
    const count = block.district === 'market' ? 9 : 4;
    for (let k = 0; k < count; k += 1) {
      const person = createPerson(rng, 'civ', 0, 0);
      person.loop = loop;
      person.p = rng() * 2 * (loop.x1 - loop.x0 + loop.y1 - loop.y0);
      const at = loopPoint(loop, person.p);
      person.x = at.x;
      person.y = at.y;
      state.peds.push(person);
    }
  }
}

/** Knock a person flat, sliding them away from the blow. */
export function knockDown(person, fromX, fromY, force, seconds) {
  const dx = person.x - fromX;
  const dy = person.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  person.mode = 'down';
  person.downTimer = seconds;
  person.vx = (dx / d) * force;
  person.vy = (dy / d) * force;
  person.angle = Math.atan2(dy, dx);
}

/** Cars that hit people at speed drop them. Returns the people the player's car dropped. */
export function runOverPeople(state) {
  const dropped = [];
  for (const car of state.cars) {
    const speed = carSpeed(car);
    if (speed < 55) continue;
    for (const person of state.peds) {
      if (person.mode === 'down') continue;
      const dx = person.x - car.x;
      const dy = person.y - car.y;
      const reach = car.spec.len * 0.5 + PERSON_RADIUS;
      if (dx * dx + dy * dy > reach * reach) continue;
      const fx = Math.cos(car.angle);
      const fy = Math.sin(car.angle);
      const side = Math.abs(dx * -fy + dy * fx);
      if (side > car.spec.wid / 2 + PERSON_RADIUS) continue;
      knockDown(person, car.x - car.vx * 0.05, car.y - car.vy * 0.05, speed * 0.6, 7);
      car.vx *= 0.85;
      car.vy *= 0.85;
      if (car.driver === 'player') dropped.push(person);
    }
  }
  return dropped;
}

/** Walk, scatter or lie still, for every civilian. */
export function updatePedestrians(state, dt) {
  const { player, city } = state;
  const threatCar = player.car && carSpeed(player.car) > 120 ? player.car : null;
  for (const person of state.peds) {
    person.phase += dt;
    if (person.kind !== 'civ') continue;
    if (person.mode === 'down') {
      person.x += person.vx * dt;
      person.y += person.vy * dt;
      person.vx *= Math.exp(-5 * dt);
      person.vy *= Math.exp(-5 * dt);
      person.downTimer -= dt;
      if (person.downTimer <= 0) {
        person.mode = 'return';
      }
    } else {
      const tx = threatCar ? threatCar.x : player.x;
      const ty = threatCar ? threatCar.y : player.y;
      const near = (tx - person.x) ** 2 + (ty - person.y) ** 2;
      const scared = (threatCar && near < 110 * 110) || (state.alarm > 0 && near < 220 * 220);
      if (scared) {
        person.mode = 'flee';
        person.timer = 2.5;
        person.threat = { x: tx, y: ty };
      }
      if (person.mode === 'flee') {
        const dx = person.x - person.threat.x;
        const dy = person.y - person.threat.y;
        const d = Math.hypot(dx, dy) || 1;
        person.angle = Math.atan2(dy, dx);
        person.x += (dx / d) * 120 * dt;
        person.y += (dy / d) * 120 * dt;
        person.timer -= dt;
        if (person.timer <= 0) person.mode = 'return';
      } else if (person.mode === 'return') {
        person.p = nearestLoopParam(person.loop, person.x, person.y);
        const at = loopPoint(person.loop, person.p);
        const dx = at.x - person.x;
        const dy = at.y - person.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) person.mode = 'walk';
        else {
          person.angle = Math.atan2(dy, dx);
          person.x += (dx / d) * Math.min(d, 60 * dt);
          person.y += (dy / d) * Math.min(d, 60 * dt);
        }
      } else {
        person.p += person.dir * person.speed * dt;
        const at = loopPoint(person.loop, person.p);
        person.angle = Math.atan2(at.y - person.y, at.x - person.x);
        person.x = at.x;
        person.y = at.y;
      }
    }
    const res = resolveCircle(city, person.x, person.y, PERSON_RADIUS - 2);
    person.x = res.x;
    person.y = res.y;
  }
}

/** Paint a person seen from above: shoulders, head, swinging feet; flat on the ground when down. */
export function drawPerson(ctx, person, time, moving) {
  ctx.save();
  ctx.translate(person.x, person.y);
  if (person.mode === 'down') {
    ctx.rotate(person.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(11, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(person.angle);
  const swing = moving ? Math.sin(person.phase * 12) * 4 : 0;
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(swing - 2, -4.5, 4, 3);
  ctx.fillRect(-swing - 2, 1.5, 4, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 2, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.skin;
  ctx.beginPath();
  ctx.arc(0.5, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.hair;
  ctx.beginPath();
  ctx.arc(-0.6, 0, 3.2, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  ctx.restore();
}
