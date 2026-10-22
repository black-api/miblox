// HeUi — browser platform adapter (also used inside the Android WebView).

export class BrowserPlatform {
  constructor({ canvas = null, assetBase = '' } = {}) {
    this.canvas = canvas;
    this.assetBase = assetBase;
    this.events = new Map();
    this._bound = [];
    this.native = null;
  }

  now() {
    return performance.now() / 1000;
  }

  loadAsset(path, type = 'text') {
    const url = `${this.assetBase}${path}`;
    if (type === 'json') {
      return fetch(url).then((response) => response.json());
    }
    if (type === 'text') {
      return fetch(url).then((response) => response.text());
    }
    return fetch(url).then((response) => response.arrayBuffer());
  }

  playSound(clip, player) {
    if (!this.audioContext || !clip.url) return;
    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioContext.__buffers?.get(clip.name);
      if (!source.buffer) return;
      source.loop = player.loop;
      const gain = this.audioContext.createGain();
      gain.gain.value = player.volume * player.bus.volume;
      source.connect(gain).connect(this.audioContext.destination);
      source.start(0, player.position % source.buffer.duration);
      player.node = source;
    } catch (error) {
      // Audio is optional: a failure must never break the game loop.
    }
  }

  /** Wires DOM events into the engine input state. */
  attachInput(input) {
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      this._bound.push(() => target.removeEventListener(type, handler, options));
    };

    on(window, 'keydown', (event) => {
      input.setKey(event.key, true);
      if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
    });
    on(window, 'keyup', (event) => input.setKey(event.key, false));
    on(window, 'blur', () => {
      for (const key of [...input.keys]) input.setKey(key, false);
    });

    const canvas = this.canvas;
    if (!canvas) return;
    const toLocal = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      };
    };
    on(canvas, 'pointerdown', (event) => {
      canvas.setPointerCapture?.(event.pointerId);
      const { x, y } = toLocal(event);
      input.pointerDown(event.pointerId, x, y);
    });
    on(canvas, 'pointermove', (event) => {
      const { x, y } = toLocal(event);
      input.pointerMove(event.pointerId, x, y);
    });
    const up = (event) => {
      const { x, y } = toLocal(event);
      input.pointerUp(event.pointerId, x, y);
    };
    on(canvas, 'pointerup', up);
    on(canvas, 'pointercancel', up);
    on(canvas, 'touchstart', (event) => event.preventDefault(), { passive: false });
  }

  /** Runs the frame loop with requestAnimationFrame. */
  startLoop(onFrame) {
    let handle = 0;
    let last = performance.now();
    const tick = (now) => {
      const delta = (now - last) / 1000;
      last = now;
      onFrame(delta);
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return { cancel: () => cancelAnimationFrame(handle) };
  }

  stopLoop() {}

  vibrate(seconds = 0.05) {
    // Prefer the native host: it reaches the device vibrator on Android.
    if (this.native && this.native.vibrate(Math.round(seconds * 1000))) return;
    if (navigator.vibrate) navigator.vibrate(seconds * 1000);
  }

  /**
   * Exposes the engine to the Android host. The Java side calls these
   * functions when the app is paused, resumed or when the surface is
   * recreated.
   */
  installHostBridge(engine) {
    if (typeof window === 'undefined') return;
    window.HEUI = {
      onHostPause: () => engine.pause(),
      onHostResume: () => engine.resume(),
      onHostSurfaceReady: () => engine.emit('surfaceReady'),
      onBackPressed: () => false,
    };
  }

  /** Lifecycle hooks used by the Android shell. */
  onPause() {}
  onResume() {}
}
