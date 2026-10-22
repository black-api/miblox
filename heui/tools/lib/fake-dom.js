// HeUi — a tiny fake DOM so a bundle can be exercised outside a browser.
//
// The browser bundle touches exactly this much of the DOM: a canvas element,
// a 2D context, window events and requestAnimationFrame. The environment
// provides a manual frame driver so previews and tests stay deterministic.

export class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.calls = { fillRect: 0, arc: 0, fillText: 0 };
    this.font = '10px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'top';
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalCompositeOperation = 'source-over';
  }

  setTransform() {}
  clearRect() {}
  save() {}
  restore() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  translate() {}
  rotate() {}
  scale() {}

  fillRect() {
    this.calls.fillRect += 1;
  }

  arc() {
    this.calls.arc += 1;
  }

  fill() {}

  fillText() {
    this.calls.fillText += 1;
  }
}

export class FakeCanvas {
  constructor(width = 480, height = 270) {
    this.width = width;
    this.height = height;
    this._ctx = new FakeContext(this);
    this.listeners = new Map();
  }

  getContext() {
    return this._ctx;
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height,
    };
  }

  setPointerCapture() {}

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener() {}

  dispatch(type, event = {}) {
    const list = this.listeners.get(type) || [];
    for (const handler of list) handler({ preventDefault() {}, ...event });
  }
}

/**
 * Creates a fake browser environment.
 * @param {{width?: number, height?: number}} options
 */
export function createBrowserEnv({ width = 480, height = 270 } = {}) {
  const canvas = new FakeCanvas(width, height);
  const frames = [];
  let nextHandle = 1;
  let nowMs = 0;

  const windowListeners = new Map();
  const windowObject = {
    devicePixelRatio: 1,
    innerWidth: width,
    innerHeight: height,
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(handler);
    },
    removeEventListener() {},
    dispatch(type, event = {}) {
      const list = windowListeners.get(type) || [];
      for (const handler of list) handler({ preventDefault() {}, ...event });
    },
  };

  const documentObject = {
    getElementById(id) {
      return id === 'game' ? canvas : null;
    },
    createElement() {
      return new FakeCanvas();
    },
  };

  const env = {
    window: windowObject,
    document: documentObject,
    navigator: { vibrate() {} },
    performance: { now: () => nowMs },
    requestAnimationFrame(callback) {
      const handle = nextHandle++;
      frames.push({ handle, callback });
      return handle;
    },
    cancelAnimationFrame(handle) {
      const index = frames.findIndex((frame) => frame.handle === handle);
      if (index >= 0) frames.splice(index, 1);
    },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    console,
  };

  /** Runs one frame of the requestAnimationFrame loop. */
  env.tick = (dtMs = 16.6667) => {
    nowMs += dtMs;
    const due = frames.splice(0, frames.length);
    for (const frame of due) frame.callback(nowMs);
  };

  /** Runs n frames. */
  env.run = (count = 1, dtMs = 16.6667) => {
    for (let i = 0; i < count; i += 1) env.tick(dtMs);
  };

  env.canvas = canvas;
  return env;
}
