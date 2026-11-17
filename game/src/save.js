// Progress kept in localStorage: which job Ivo is on and his cash. Storage can
// be unavailable (private mode, file:// in some browsers); that is reported to
// the console and the game runs without a save.

const KEY = 'saltwake.save.v2';

export function loadSave() {
  let raw;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch (err) {
    console.warn('saltwake: save unavailable', err);
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.job !== 'number' || typeof data.cash !== 'number') throw new Error('bad save shape');
    return { job: Math.max(0, Math.min(3, data.job)), cash: Math.max(0, data.cash) };
  } catch (err) {
    console.warn('saltwake: discarding unreadable save', err);
    return null;
  }
}

export function writeSave(job, cash) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ job, cash: Math.round(cash) }));
    return true;
  } catch (err) {
    console.warn('saltwake: could not save', err);
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    console.warn('saltwake: could not clear save', err);
  }
}
