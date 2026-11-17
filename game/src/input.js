// Keyboard state: which keys are held, plus one-shot presses consumed once
// per frame.

const held = new Set();
const pressed = new Set();

const ALIAS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'brake',
  KeyE: 'enter', KeyF: 'enter',
  KeyJ: 'punch', KeyK: 'punch', ControlLeft: 'punch',
  ShiftLeft: 'run', ShiftRight: 'run',
  Enter: 'start', KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute', KeyR: 'radio',
};

export function installInput(target, onFirstInput) {
  let first = true;
  target.addEventListener('keydown', (e) => {
    const name = ALIAS[e.code];
    if (!name) return;
    e.preventDefault();
    if (!held.has(name)) pressed.add(name);
    held.add(name);
    if (first) {
      first = false;
      onFirstInput();
    }
  });
  target.addEventListener('keyup', (e) => {
    const name = ALIAS[e.code];
    if (name) held.delete(name);
  });
  target.addEventListener('blur', () => held.clear());
}

export function isHeld(name) {
  return held.has(name);
}

export function wasPressed(name) {
  return pressed.has(name);
}

export function consume(name) {
  return pressed.delete(name);
}

export function endFrame() {
  pressed.clear();
}

export function axes() {
  return {
    x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    y: (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
  };
}
