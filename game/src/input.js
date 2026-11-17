// Keyboard and mouse. Held keys give movement (WASD or arrows), running and the handbrake (Shift,
// Space in a car); one-shot presses (E to get in or out, Space or left click to strike, Enter to
// start, N for a new evening, M to mute, P or Esc to pause) are queued and taken once per frame.
// The mouse position, turned into a world point by the caller, is where Ivo faces on foot.

const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'], space: ['Space'],
};
const PRESSES = { KeyE: 'enter', KeyF: 'enter', Space: 'strike', Enter: 'confirm', KeyN: 'fresh', KeyM: 'mute', KeyP: 'pause', Escape: 'pause' };

export function createInput(target) {
  const held = new Set();
  let presses = new Set();
  let mouse = null;
  let mouseSeen = 0;

  window.addEventListener('keydown', (event) => {
    const press = PRESSES[event.code];
    const known = press || Object.values(KEYS).some((codes) => codes.includes(event.code));
    if (!known) return;
    event.preventDefault();
    held.add(event.code);
    if (press && !event.repeat) presses.add(press);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointermove', (event) => {
    mouse = { x: event.clientX, y: event.clientY };
    mouseSeen = performance.now();
  });
  target.addEventListener('pointerdown', (event) => {
    mouse = { x: event.clientX, y: event.clientY };
    mouseSeen = performance.now();
    if (event.button === 0) presses.add('click');
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  const any = (name) => KEYS[name].some((code) => held.has(code));

  return {
    /** The held controls this frame; `toWorld` turns the mouse's screen point into a world point. */
    controls(toWorld) {
      const taken = presses;
      presses = new Set();
      const aim = mouse && performance.now() - mouseSeen < 4000 ? toWorld(mouse.x, mouse.y) : null;
      return {
        moveX: (any('right') ? 1 : 0) - (any('left') ? 1 : 0),
        moveY: (any('down') ? 1 : 0) - (any('up') ? 1 : 0),
        run: any('run'),
        brake: any('space'),
        aim,
        enter: taken.has('enter'),
        strike: taken.has('strike') || taken.has('click'),
        confirm: taken.has('confirm') || taken.has('click'),
        fresh: taken.has('fresh'),
        mute: taken.has('mute'),
        pause: taken.has('pause'),
      };
    },
  };
}

/** Controls with nothing pressed, for the title screen and staged shots. */
export function idleControls() {
  return { moveX: 0, moveY: 0, run: false, brake: false, aim: null, enter: false, strike: false, confirm: false, fresh: false, mute: false, pause: false };
}
