// The wanted level: five pips of harbor-watch attention. It rises when Ivo hits someone, pulls a
// driver out, strikes an officer or blows a job, and falls one pip at a time once no watch car
// or officer has had eyes on him for a while. The delivery job holds it at two or more.

export const MAX_WANTED = 5;
const LOSE_SECONDS = 9;
const SIGHT = 520;

export function createWanted() {
  return { level: 0, calm: 0, flash: 0, floor: 0, reason: '' };
}

export function raiseWanted(state, amount, reason) {
  const w = state.wanted;
  const before = w.level;
  w.level = Math.min(MAX_WANTED, w.level + amount);
  w.calm = 0;
  w.reason = reason;
  if (w.level > before) {
    w.flash = 1.4;
    state.events.push('wanted');
  }
  state.alarm = 2;
}

/** Whether any watch car or officer is close enough to keep the heat on. */
export function watchHasEyes(state) {
  const p = state.player;
  for (const car of state.cars) if (car.kind === 'watch' && (car.x - p.x) ** 2 + (car.y - p.y) ** 2 < SIGHT * SIGHT) return true;
  for (const person of state.peds) if (person.kind === 'officer' && person.mode !== 'down' && (person.x - p.x) ** 2 + (person.y - p.y) ** 2 < 300 * 300) return true;
  return false;
}

export function updateWanted(state, dt) {
  const w = state.wanted;
  w.flash = Math.max(0, w.flash - dt);
  state.alarm = Math.max(0, (state.alarm ?? 0) - dt);
  if (w.level < w.floor) w.level = w.floor;
  if (w.level === 0) return;
  if (watchHasEyes(state)) w.calm = 0;
  else w.calm += dt;
  if (w.calm >= LOSE_SECONDS && w.level > w.floor) {
    w.level -= 1;
    w.calm = 0;
    state.events.push('calm');
  }
}
