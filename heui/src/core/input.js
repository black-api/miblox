// HeUi — input: keyboard, mouse and touch, plus named actions.

export const KEY = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  SPACE: ' ',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  A: 'a',
  D: 'd',
  W: 'w',
  S: 's',
};

export class Pointer {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.downX = x;
    this.downY = y;
    this.phase = 'down';
    this.pressure = 1;
  }
}

export class InputState {
  constructor() {
    this.keys = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();
    this.pointers = new Map();
    this.actions = new Map();
    this.gyro = { x: 0, y: 0, z: 0 };
  }

  beginFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
  }

  setKey(code, down) {
    if (down) {
      if (!this.keys.has(code)) this.keysPressed.add(code);
      this.keys.add(code);
    } else {
      if (this.keys.has(code)) this.keysReleased.add(code);
      this.keys.delete(code);
    }
  }

  keyDown(code) {
    return this.keys.has(code);
  }

  keyPressed(code) {
    return this.keysPressed.has(code);
  }

  keyReleased(code) {
    return this.keysReleased.has(code);
  }

  pointerDown(id, x, y) {
    const pointer = new Pointer(id, x, y);
    this.pointers.set(id, pointer);
    return pointer;
  }

  pointerMove(id, x, y) {
    const pointer = this.pointers.get(id);
    if (!pointer) return null;
    pointer.x = x;
    pointer.y = y;
    pointer.phase = 'move';
    return pointer;
  }

  pointerUp(id, x, y) {
    const pointer = this.pointers.get(id);
    if (!pointer) return null;
    if (x !== undefined) {
      pointer.x = x;
      pointer.y = y;
    }
    pointer.phase = 'up';
    return pointer;
  }

  /** Pointers that are currently held down. */
  activePointers() {
    return [...this.pointers.values()].filter((p) => p.phase !== 'up');
  }

  primaryPointer() {
    const active = this.activePointers();
    return active.length > 0 ? active[0] : null;
  }

  /**
   * Binds an action to one or more keys. Actions are how a game asks
   * "is jump pressed?" without knowing the device.
   */
  bindAction(action, keys) {
    this.actions.set(action, new Set(Array.isArray(keys) ? keys : [keys]));
    return this;
  }

  actionDown(action) {
    const keys = this.actions.get(action);
    if (!keys) return false;
    for (const key of keys) if (this.keys.has(key)) return true;
    return false;
  }

  actionPressed(action) {
    const keys = this.actions.get(action);
    if (!keys) return false;
    for (const key of keys) if (this.keysPressed.has(key)) return true;
    return false;
  }
}
