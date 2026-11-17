// Fists on the street, the only weapon in Saltwake: Ivo's short strike drops whoever is in the arc in front of him (a watch
// officer for ten seconds, a passer-by for longer, wanted either way), and officers who reach
// him land blows of their own.
import { knockDown } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { raiseWanted } from './wanted.js';

export const STRIKE_REACH = 34;
const STRIKE_ARC = 1.1;
const STRIKE_COOL = 0.38;
const OFFICER_REACH = 17;
const OFFICER_DAMAGE = 9;

/** Swing at the arc in front of Ivo. Returns the person struck, or null. */
export function playerStrike(state) {
  const p = state.player;
  if (!p.onFoot || p.strikeCool > 0) return null;
  p.strikeCool = STRIKE_COOL;
  p.strikeTime = 0.18;
  state.events.push('swing');
  let target = null;
  let bestD = STRIKE_REACH;
  for (const person of state.peds) {
    if (person.mode === 'down') continue;
    const dx = person.x - p.x;
    const dy = person.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    let diff = Math.atan2(dy, dx) - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > STRIKE_ARC) continue;
    target = person;
    bestD = d;
  }
  if (!target) return null;
  knockDown(target, p.x, p.y, 160, target.kind === 'officer' ? 10 : 12);
  state.effects.push({ kind: 'impact', x: target.x, y: target.y, life: 0.5, max: 0.5 });
  state.events.push('strike');
  if (target.kind === 'officer') {
    state.stats.officersDropped += 1;
    raiseWanted(state, 1, 'officer');
  } else {
    raiseWanted(state, 1, 'assault');
    const wallet = 5 + Math.floor(state.rng() * 20);
    state.cash += wallet;
    state.effects.push({ kind: 'cash', x: target.x, y: target.y - 10, life: 1.2, max: 1.2, text: `+$${wallet}` });
  }
  return target;
}

/** Officers in reach hit Ivo. Returns true when he goes down. */
export function officerAttacks(state, dt) {
  const p = state.player;
  if (!p.onFoot) return false;
  for (const o of state.peds) {
    if (o.kind !== 'officer' || o.mode !== 'chase') continue;
    o.attackCool = Math.max(0, o.attackCool - dt);
    if (o.attackCool > 0) continue;
    if (Math.hypot(o.x - p.x, o.y - p.y) > OFFICER_REACH) continue;
    o.attackCool = 1.1;
    state.effects.push({ kind: 'impact', x: p.x, y: p.y, life: 0.3, max: 0.3, small: true });
    if (hurtPlayer(state, OFFICER_DAMAGE)) {
      state.downCause = 'watch';
      return true;
    }
  }
  return false;
}
