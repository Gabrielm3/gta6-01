// Harbor-watch heat: crimes add heat, heat maps to zero to five pips, and the
// pips cool off once the watch has lost sight of the player for long enough.

export const MAX_PIPS = 5;
const HEAT_PER_PIP = 100;
const COOL_DELAY = 6;

export function makeWanted() {
  return { heat: 0, level: 0, unseen: 0, flash: 0 };
}

export function addHeat(w, amount) {
  const before = w.level;
  w.heat = Math.min(MAX_PIPS * HEAT_PER_PIP, w.heat + amount);
  w.level = Math.min(MAX_PIPS, Math.ceil(w.heat / HEAT_PER_PIP - 0.001));
  w.unseen = 0;
  if (w.level > before) w.flash = 1.5;
  return w.level > before;
}

export function setLevel(w, level) {
  w.heat = level * HEAT_PER_PIP;
  w.level = level;
  w.unseen = 0;
}

export function clearWanted(w) {
  w.heat = 0;
  w.level = 0;
  w.unseen = 0;
}

export function updateWanted(w, dt, seen) {
  w.flash = Math.max(0, w.flash - dt);
  if (w.level === 0) return;
  if (seen) {
    w.unseen = 0;
    return;
  }
  w.unseen += dt;
  if (w.unseen > COOL_DELAY) {
    const floor = (w.level - 1) * HEAT_PER_PIP;
    w.heat = Math.max(floor, w.heat - dt * 40);
    if (w.heat <= floor + 0.5) {
      w.level -= 1;
      w.heat = w.level * HEAT_PER_PIP;
      w.unseen = COOL_DELAY * 0.5;
    }
  }
}

export function coolingProgress(w) {
  if (w.level === 0) return 0;
  return Math.min(1, w.unseen / COOL_DELAY);
}
