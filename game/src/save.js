// The save (one small JSON entry, no position): which job Ivo is on and the cash in his pocket, kept in localStorage so the evening
// picks up where it was left. Storage can be off (a private window); the game then just forgets.

const KEY = 'saltwake.save.v1';

/** The stored progress, or null when there is none (or it cannot be read). */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const job = Number(data.job);
    const cash = Number(data.cash);
    if (!Number.isInteger(job) || job < 1 || job > 4 || !Number.isFinite(cash)) return null;
    return { job, cash: Math.max(0, Math.floor(cash)) };
  } catch {
    return null;
  }
}

export function writeSave(job, cash) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ job, cash: Math.floor(cash), at: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored to clear.
  }
}
