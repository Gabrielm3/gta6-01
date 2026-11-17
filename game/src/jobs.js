// The evening's three jobs for Ivo Pell, in order: take the Yard's van, lift the ledger at the
// Market drop without stopping, then carry it to the end of the north pier with the harbor
// watch on him. Job 4 is the free evening after. Each job knows its banner, its target and how
// it is done or blown.
import { carSpeed } from './cars.js';
import { MARKET_DROP, PIER } from './city.js';
import { raiseWanted } from './wanted.js';

export const JOBS = [
  null,
  { title: 'STEAL THE YARD VAN', brief: 'The orange van is parked in the Yard, north-west. Walk up and press E.', pay: 250 },
  { title: 'LIFT THE LEDGER — DON’T STOP', brief: 'Drive through the Market drop at speed. Stop in it and the job is blown.', pay: 400 },
  { title: 'DELIVER IT TO THE NORTH PIER', brief: 'The harbor watch is on you. Get the ledger to the end of the pier.', pay: 1500 },
  { title: 'THE EVENING IS YOURS', brief: 'Ledger delivered. Saltwake is yours to roam.', pay: 0 },
];

const GRAB_SPEED = 90;
const STOP_SPEED = 30;
const PIER_REACH = 46;

/** Set up job `id` (used both when a job follows the last and when a save is loaded). */
export function startJob(state, id) {
  state.job = { id, cool: 0, flash: 2.5 };
  state.wanted.floor = id === 3 ? 2 : 0;
  if (id === 3) raiseWanted(state, Math.max(0, 3 - state.wanted.level), 'ledger');
  state.events.push('job');
}

/** Where the active job wants Ivo to go, or null. */
export function jobTarget(state) {
  const id = state.job.id;
  if (id === 1) return { x: state.yardVan.x, y: state.yardVan.y, label: 'YARD VAN' };
  if (id === 2) return { x: MARKET_DROP.x, y: MARKET_DROP.y, label: 'LEDGER DROP' };
  if (id === 3) return { x: PIER.endX, y: PIER.endY, label: 'NORTH PIER' };
  return null;
}

export function say(state, text, seconds, tone) {
  state.message = { text, life: seconds, max: seconds, tone };
}

function finish(state, text) {
  const job = JOBS[state.job.id];
  state.cash += job.pay;
  say(state, `${text}  +$${job.pay}`, 3.2, 'good');
  state.events.push('done');
  startJob(state, state.job.id + 1);
}

/** Check the active job against where Ivo is and what he is doing. */
export function updateJobs(state, dt) {
  const job = state.job;
  const p = state.player;
  job.flash = Math.max(0, job.flash - dt);
  job.cool = Math.max(0, job.cool - dt);
  if (job.id === 1) {
    if (p.car === state.yardVan) finish(state, 'YARD VAN TAKEN');
  } else if (job.id === 2) {
    if (job.cool > 0) return;
    const d = Math.hypot(p.x - MARKET_DROP.x, p.y - MARKET_DROP.y);
    if (d > MARKET_DROP.r) return;
    const speed = p.car ? carSpeed(p.car) : 0;
    if (speed >= GRAB_SPEED) {
      finish(state, 'LEDGER LIFTED');
    } else if (speed < STOP_SPEED) {
      job.cool = 6;
      raiseWanted(state, 2, 'blown');
      say(state, 'BLOWN — YOU STOPPED IN THE DROP', 3, 'bad');
      state.events.push('blown');
    }
  } else if (job.id === 3) {
    if (Math.hypot(p.x - PIER.endX, p.y - PIER.endY) < PIER_REACH) {
      finish(state, 'LEDGER DELIVERED');
      state.wanted.floor = 0;
    }
  }
}
