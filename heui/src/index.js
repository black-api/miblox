// HeUi — public entry point for game code.
//
//   import { createEngine } from 'heui';
//   const engine = await createEngine({ platform: 'browser' });
//
// Game code never imports the native core directly: on device builds the
// native renderer is used when available and the JS renderer is the fallback.

import { Engine } from './core/engine.js';
import { EventEmitter } from './core/events.js';
import { Clock } from './core/clock.js';
import { InputState, KEY } from './core/input.js';
import { Renderer, DrawKind, BlendMode, Canvas2DBackend, HeadlessBackend } from './core/renderer.js';
import { AudioManager } from './core/audio.js';
import { ResourceLoader } from './core/resources.js';
import { Node, Scene } from './core/scene.js';
import { Vec2, Rect, clamp, lerp, lengthDelta, DEG, RAD } from './core/math.js';
import { BrowserPlatform } from './platform/browser.js';
import { NodePlatform } from './platform/node.js';
import { NativeBridge } from './platform/native-bridge.js';

export {
  Engine,
  EventEmitter,
  Clock,
  InputState,
  KEY,
  Renderer,
  DrawKind,
  BlendMode,
  Canvas2DBackend,
  HeadlessBackend,
  AudioManager,
  ResourceLoader,
  Node,
  Scene,
  Vec2,
  Rect,
  clamp,
  lerp,
  lengthDelta,
  DEG,
  RAD,
  BrowserPlatform,
  NodePlatform,
  NativeBridge,
};

export const VERSION = '0.1.0';

/**
 * Creates an engine for the given host.
 * @param {object} options
 * @param {'browser'|'node'} options.platform
 * @param {object} [options.canvas] required for the browser host
 * @param {string} [options.assetBase] prefix for asset URLs
 */
export async function createEngine({ platform = 'browser', canvas = null, assetBase = '', width = 1280, height = 720 } = {}) {
  if (platform === 'node') {
    const nodePlatform = new NodePlatform({ assetBase });
    const engine = new Engine({
      platform: nodePlatform,
      renderer: new HeadlessBackend(),
      width,
      height,
    });
    return engine;
  }

  const browserPlatform = new BrowserPlatform({ canvas, assetBase });
  const engine = new Engine({
    platform: browserPlatform,
    renderer: new Canvas2DBackend(canvas),
    width,
    height,
  });
  browserPlatform.native = engine.native;
  browserPlatform.attachInput(engine.input);
  browserPlatform.installHostBridge(engine);
  return engine;
}
