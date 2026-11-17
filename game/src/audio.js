// Every sound in Saltwake, made live with the Web Audio API (no audio files are loaded): an engine note that follows the
// car's speed, the watch's two-tone wail while a cruiser is near, short synthesized hits for
// strikes, crashes and job beats, and an original slow harbor loop (a bass walk and plucked
// minor-key notes) under it all. Nothing is loaded; the context starts on the first key or click.

const SCALE = [0, 3, 5, 7, 10, 12, 15];
const BASS = [45, 45, 43, 41, 45, 45, 48, 43];
const BEAT = 60 / 88;

function midi(n) {
  return 440 * 2 ** ((n - 69) / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let siren = null;
  let noise = null;
  let muted = false;
  let nextBeat = 0;
  let beat = 0;
  let melodyRng = 7;

  function rand() {
    melodyRng = (melodyRng * 16807) % 2147483647;
    return melodyRng / 2147483647;
  }

  function tone(type, freq, start, length, gain, dest, slideTo) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(amp).connect(dest ?? master);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  function burst(start, length, gain, cutoff) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter).connect(amp).connect(master);
    src.start(start, Math.random() * 0.5);
    src.stop(start + length + 0.05);
  }

  function build() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const eo = ctx.createOscillator();
    const ef = ctx.createBiquadFilter();
    const eg = ctx.createGain();
    eo.type = 'sawtooth';
    eo.frequency.value = 40;
    ef.type = 'lowpass';
    ef.frequency.value = 300;
    eg.gain.value = 0;
    eo.connect(ef).connect(eg).connect(master);
    eo.start();
    engine = { osc: eo, filter: ef, gain: eg };
    const so = ctx.createOscillator();
    const sg = ctx.createGain();
    so.type = 'triangle';
    so.frequency.value = 660;
    sg.gain.value = 0;
    so.connect(sg).connect(master);
    so.start();
    siren = { osc: so, gain: sg };
    nextBeat = ctx.currentTime + 0.1;
  }

  function scheduleMusic(intensity) {
    while (nextBeat < ctx.currentTime + 0.25) {
      const t = nextBeat;
      const root = BASS[Math.floor(beat / 4) % BASS.length];
      if (beat % 2 === 0) tone('triangle', midi(root - 12), t, BEAT * 1.6, 0.16);
      if (rand() < 0.55 + intensity * 0.3) {
        const note = root + 12 + SCALE[Math.floor(rand() * SCALE.length)];
        tone('sine', midi(note), t + (rand() < 0.3 ? BEAT / 2 : 0), BEAT * 0.9, 0.05);
      }
      if (intensity > 0 && beat % 2 === 1) burst(t, 0.05, 0.08, 6000);
      if (beat % 8 === 0) tone('sine', midi(root + 24), t, BEAT * 3, 0.025);
      nextBeat += intensity > 0 ? BEAT / 1.5 : BEAT;
      beat += 1;
    }
  }

  return {
    /** Start the audio context; call from a key or click handler. */
    unlock() {
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
      return muted;
    },
    /** Follow the game each frame: engine pitch, siren level, music pace. */
    update(state, playing) {
      if (!ctx) return;
      const now = ctx.currentTime;
      const car = playing && state.player.car;
      const speed = car ? Math.hypot(car.vx, car.vy) : 0;
      engine.osc.frequency.setTargetAtTime(car ? 38 + speed * 0.32 : 30, now, 0.08);
      engine.filter.frequency.setTargetAtTime(car ? 260 + speed * 3 : 200, now, 0.1);
      engine.gain.gain.setTargetAtTime(car ? 0.07 + speed * 0.0003 : 0, now, 0.1);
      let near = Infinity;
      if (playing) for (const c of state.cars) if (c.kind === 'watch' && c.mode !== 'leave') near = Math.min(near, Math.hypot(c.x - state.player.x, c.y - state.player.y));
      const wail = near < 900 ? 0.05 * (1 - near / 900) : 0;
      siren.gain.gain.setTargetAtTime(wail, now, 0.2);
      siren.osc.frequency.setValueAtTime(Math.floor(now * 1.6) % 2 ? 610 : 780, now);
      scheduleMusic(playing && state.wanted.level > 0 ? 1 : 0);
    },
    /** Play the one-off sounds for this frame's game events. */
    play(events) {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const e of events) {
        if (e === 'swing') burst(t, 0.08, 0.12, 2500);
        else if (e === 'strike') { tone('sine', 120, t, 0.18, 0.4, null, 50); burst(t, 0.12, 0.3, 900); }
        else if (e === 'crash') { burst(t, 0.35, 0.45, 700); tone('square', 70, t, 0.2, 0.12, null, 40); }
        else if (e === 'hit') { tone('sine', 160, t, 0.15, 0.3, null, 60); burst(t, 0.1, 0.2, 1200); }
        else if (e === 'hurt') tone('square', 220, t, 0.12, 0.1, null, 110);
        else if (e === 'enter' || e === 'exit') { tone('square', 900, t, 0.04, 0.06); tone('square', 600, t + 0.05, 0.05, 0.06); }
        else if (e === 'wanted') { tone('square', 880, t, 0.09, 0.08); tone('square', 660, t + 0.11, 0.12, 0.08); }
        else if (e === 'done') [0, 4, 7, 12].forEach((n, i) => tone('triangle', midi(69 + n), t + i * 0.09, 0.5, 0.12));
        else if (e === 'blown') [0, -3, -7].forEach((n, i) => tone('sawtooth', midi(57 + n), t + i * 0.14, 0.3, 0.07));
        else if (e === 'down') tone('sawtooth', 300, t, 1.2, 0.12, null, 60);
      }
    },
  };
}
