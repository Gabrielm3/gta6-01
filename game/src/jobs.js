// The three jobs of the night: take the van in the Yard, lift the ledger at
// the Market without stopping, and run it to the north pier.

import { addHeat } from './wanted.js';

const LIFT_SPEED = 140;
const STALL_SPEED = 35;
const STALL_LIMIT = 0.6;

export const JOBS = [
  {
    title: 'TAKE THE VAN',
    hint: 'The blue van in the Yard. Walk up and press E.',
    reward: 300,
  },
  {
    title: 'LIFT THE LEDGER',
    hint: 'Roll through the Market drop at speed. Do not stop.',
    reward: 700,
  },
  {
    title: 'DELIVER TO THE NORTH PIER',
    hint: 'Get the ledger to the end of the north pier.',
    reward: 4000,
  },
];

export function makeJobs(index = 0) {
  return { index, stall: 0, warn: 0, armed: true, ledger: index === 2, done: index >= JOBS.length, toast: null };
}

export function currentJob(jobs) {
  return JOBS[jobs.index] || null;
}

export function jobMarker(world) {
  const { jobs, city, jobVan } = world;
  if (jobs.index === 0) return jobVan ? { x: jobVan.x, y: jobVan.y, r: 70 } : null;
  if (jobs.index === 1) return { x: city.market.x, y: city.market.y, r: 90 };
  if (jobs.index === 2) return { x: city.pierEnd.x, y: city.pierEnd.y, r: 95 };
  return null;
}

function toast(jobs, text, color, time = 3) {
  jobs.toast = { text, color, time };
}

function complete(world, events) {
  const { jobs } = world;
  const job = JOBS[jobs.index];
  world.cash += job.reward;
  events.push({ type: 'jobDone', index: jobs.index, reward: job.reward });
  toast(jobs, `${job.title}  +$${job.reward}`, '#7dff8a');
  jobs.index += 1;
  jobs.stall = 0;
  jobs.armed = true;
  if (jobs.index >= JOBS.length) {
    jobs.done = true;
    toast(jobs, 'THE LEDGER IS IN. SALTWAKE IS YOURS.', '#ffd34d', 6);
  }
}

export function updateJobs(world, dt, events) {
  const { jobs, player } = world;
  if (jobs.toast) {
    jobs.toast.time -= dt;
    if (jobs.toast.time <= 0) jobs.toast = null;
  }
  jobs.warn = Math.max(0, jobs.warn - dt);
  const m = jobMarker(world);
  if (!m) return;
  const body = player.car || player;
  const d = Math.hypot(body.x - m.x, body.y - m.y);
  const speed = player.car ? Math.abs(player.car.speed) : 0;

  if (jobs.index === 0) {
    if (player.car && player.car === world.jobVan) complete(world, events);
    return;
  }

  if (jobs.index === 1) {
    if (d > m.r) {
      jobs.stall = 0;
      jobs.armed = true;
      return;
    }
    if (!player.car) {
      if (jobs.armed) toast(jobs, 'YOU NEED WHEELS FOR THIS', '#ff6b6b', 2);
      jobs.armed = false;
      return;
    }
    if (!jobs.armed) return;
    if (speed >= LIFT_SPEED) {
      jobs.ledger = true;
      addHeat(world.wanted, 200);
      events.push({ type: 'ledger' });
      complete(world, events);
      return;
    }
    jobs.warn = 0.4;
    if (speed < STALL_SPEED) jobs.stall += dt;
    if (jobs.stall > STALL_LIMIT) {
      jobs.armed = false;
      jobs.stall = 0;
      addHeat(world.wanted, 100);
      toast(jobs, 'YOU STOPPED. LOOP BACK AND HIT IT FAST', '#ff6b6b', 3.5);
      events.push({ type: 'jobFail' });
    }
    return;
  }

  if (jobs.index === 2 && d < m.r && speed < 120) {
    jobs.ledger = false;
    complete(world, events);
  }
}

export function loseLedger(world) {
  const { jobs } = world;
  if (jobs.index === 2) {
    jobs.index = 1;
    jobs.ledger = false;
    jobs.armed = true;
    toast(jobs, 'THE LEDGER IS GONE. LIFT IT AGAIN', '#ff6b6b', 4);
  }
}
