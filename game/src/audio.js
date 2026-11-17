// Sound with the Web Audio API only: an engine drone tied to speed, the watch
// siren, short effects, and a synthesized loop for the HARBOR FM radio.

let ac = null;
let master = null;
let engine = null;
let siren = null;
let radio = null;
let muted = false;
let radioOn = true;

const SCALE = [0, 3, 5, 7, 10, 12];
const CHORDS = [[45, 52, 57], [41, 48, 53], [43, 50, 55], [40, 47, 52]];

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export function startAudio() {
  if (ac) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    console.warn('saltwake: no Web Audio in this browser');
    return;
  }
  ac = new Ctx();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);

  const eo = ac.createOscillator();
  eo.type = 'sawtooth';
  const ef = ac.createBiquadFilter();
  ef.type = 'lowpass';
  ef.frequency.value = 400;
  const eg = ac.createGain();
  eg.gain.value = 0;
  eo.connect(ef).connect(eg).connect(master);
  eo.start();
  engine = { osc: eo, filter: ef, gain: eg };

  const so = ac.createOscillator();
  so.type = 'square';
  const sg = ac.createGain();
  sg.gain.value = 0;
  so.connect(sg).connect(master);
  so.start();
  siren = { osc: so, gain: sg, phase: 0 };

  const rg = ac.createGain();
  rg.gain.value = 0.16;
  rg.connect(master);
  radio = { gain: rg, next: ac.currentTime + 0.1, step: 0 };
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function toggleRadio() {
  radioOn = !radioOn;
  if (radio) radio.gain.gain.value = radioOn ? 0.16 : 0;
  return radioOn;
}

export function isRadioOn() {
  return radioOn;
}

function note(freq, start, len, type, vol, dest) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + len);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + len + 0.05);
}

function scheduleRadio(inCar) {
  const beat = 60 / 96 / 2;
  while (radio.next < ac.currentTime + 0.3) {
    const t = radio.next;
    const s = radio.step;
    const chord = CHORDS[Math.floor(s / 16) % CHORDS.length];
    if (inCar) {
      if (s % 4 === 0) note(midi(chord[0] - 12), t, beat * 3, 'triangle', 0.9, radio.gain);
      if (s % 2 === 1) note(midi(chord[1 + (s >> 1) % 2] + 12), t, beat * 0.9, 'square', 0.18, radio.gain);
      if (s % 8 === 6) note(midi(chord[0] + 12 + SCALE[(s * 7) % SCALE.length]), t, beat * 1.6, 'sine', 0.3, radio.gain);
    }
    radio.next += beat;
    radio.step = (s + 1) % 64;
  }
}

export function updateAudio(speed, inCar, wantedLevel, dt) {
  if (!ac) return;
  const now = ac.currentTime;
  const s = Math.min(1, Math.abs(speed) / 400);
  engine.osc.frequency.setTargetAtTime(inCar ? 45 + s * 120 : 40, now, 0.05);
  engine.filter.frequency.setTargetAtTime(300 + s * 900, now, 0.05);
  engine.gain.gain.setTargetAtTime(inCar ? 0.08 + s * 0.08 : 0, now, 0.08);

  siren.phase += dt;
  const on = wantedLevel > 0;
  const f = 640 + Math.sin(siren.phase * 4) * 180;
  siren.osc.frequency.setTargetAtTime(f, now, 0.02);
  siren.gain.gain.setTargetAtTime(on ? 0.02 + wantedLevel * 0.006 : 0, now, 0.1);

  scheduleRadio(inCar);
}

export function sfx(name) {
  if (!ac) return;
  const t = ac.currentTime;
  if (name === 'crash') {
    note(70, t, 0.25, 'square', 0.5, master);
    note(45, t, 0.35, 'sawtooth', 0.4, master);
  } else if (name === 'punch') {
    note(180, t, 0.08, 'square', 0.4, master);
  } else if (name === 'hit') {
    note(120, t, 0.18, 'sawtooth', 0.5, master);
  } else if (name === 'cash') {
    note(midi(76), t, 0.12, 'square', 0.25, master);
    note(midi(83), t + 0.1, 0.25, 'square', 0.25, master);
  } else if (name === 'door') {
    note(220, t, 0.06, 'triangle', 0.35, master);
    note(150, t + 0.06, 0.08, 'triangle', 0.3, master);
  } else if (name === 'bust') {
    for (let i = 0; i < 4; i++) note(midi(60 - i * 3), t + i * 0.18, 0.2, 'square', 0.3, master);
  } else if (name === 'warn') {
    note(midi(84), t, 0.08, 'square', 0.18, master);
  }
}
