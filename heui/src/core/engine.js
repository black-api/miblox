// HeUi — the engine: subsystem ownership and the frame loop.
//
// Frame order (identical to the native core, see ARCHITECTURE.md §6):
//   input → fixed steps → variable step → render → audio

import { EventEmitter } from './events.js';
import { Clock } from './clock.js';
import { InputState } from './input.js';
import { Renderer } from './renderer.js';
import { AudioManager } from './audio.js';
import { ResourceLoader } from './resources.js';
import { Scene } from './scene.js';
import { NativeBridge } from '../platform/native-bridge.js';

export class Engine extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.platform host adapter (browser | node)
   * @param {object} [options.renderer] renderer backend
   * @param {number} [options.width] logical width
   * @param {number} [options.height] logical height
   * @param {number} [options.fixedStep]
   */
  constructor({
    platform,
    renderer,
    width = 1280,
    height = 720,
    fixedStep = 1 / 60,
    autoStart = false,
  }) {
    super();
    this.platform = platform;
    this.clock = new Clock({ fixedStep });
    this.input = new InputState();
    this.audio = new AudioManager(platform);
    this.resources = new ResourceLoader(platform);
    this.renderer = new Renderer(renderer, { width, height });
    this.scene = new Scene('main');
    this.native = NativeBridge.detect();
    this.running = false;
    this._loopHandle = null;
    this._frameHook = null;
    this._lastTime = 0;
    this._autoStart = autoStart;
  }

  /** Registers a callback run every fixed step. */
  onFixedUpdate(handler) {
    return this.on('fixedUpdate', handler);
  }

  /** Registers a callback run once per frame with the variable delta. */
  onUpdate(handler) {
    return this.on('update', handler);
  }

  /** Registers a callback run after rendering (for HUDs, telemetry). */
  onLateUpdate(handler) {
    return this.on('lateUpdate', handler);
  }

  /** Registers a callback that fills the render queue for this frame. */
  onRender(handler) {
    return this.on('render', handler);
  }

  /** Registers a callback run when the host reports the app was paused. */
  onPause(handler) {
    return this.on('pause', handler);
  }

  /** Registers a callback run when the host reports the app resumed. */
  onResume(handler) {
    return this.on('resume', handler);
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this._lastTime = this.platform.now();
    this.scene.onEnter();
    this.emit('start');
    if (this.platform.startLoop) {
      this._loopHandle = this.platform.startLoop((delta) => this.frame(delta));
    } else {
      this._loopHandle = this.platform.setLoop((delta) => this.frame(delta));
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._loopHandle && this._loopHandle.cancel) this._loopHandle.cancel();
    if (this.platform.stopLoop) this.platform.stopLoop();
    this._loopHandle = null;
    this.emit('stop');
  }

  /** Runs exactly one frame. Exposed so tests can drive the engine. */
  frame(deltaSeconds) {
    if (!this.running && this._autoStart === false && this._frameHook === null) {
      // Allow manual frames even before start() so headless tests can step.
    }
    this.input.beginFrame();
    const steps = this.clock.advance(deltaSeconds);

    for (let i = 0; i < steps.steps; i += 1) {
      this.emit('fixedUpdate', steps.fixed);
    }
    if (steps.steps > 0) {
      this.scene.update(steps.fixed * steps.steps);
    }
    this.emit('update', steps.variable);

    this.renderer.beginFrame();
    this.emit('render', this.renderer);
    this.renderer.endFrame();

    this.audio.update(steps.variable);
    this.emit('lateUpdate', steps.variable);
  }

  /** Sets the logical resolution, e.g. after a rotation. */
  resize(width, height) {
    this.renderer.size = { width, height };
    this.emit('resize', { width, height });
  }

  /** Suspends audio and stops the loop (app backgrounded). */
  pause() {
    this.audio.suspend();
    this.emit('pause');
  }

  resume() {
    this.audio.resume();
    this._lastTime = this.platform.now();
    this.emit('resume');
  }
}
