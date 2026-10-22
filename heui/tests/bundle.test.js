// HeUi — end-to-end test: the bundled game runs in a fake browser.
//
// This is the same code path the Android WebView uses: the converter produces
// one classic script, the script boots the engine, and the game reacts to
// input. If this test passes, the APK payload is proven to work.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { buildBundle } from '../converter/src/cli.js';
import { createBrowserEnv } from './harness.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function buildAndLoad() {
  const outDir = path.join(repoRoot, 'tmp', 'test-bundle');
  buildBundle(path.join(repoRoot, 'apps', 'gem-hunt'), outDir);
  const code = fs.readFileSync(path.join(outDir, 'heui.js'), 'utf8');
  const env = createBrowserEnv({ width: 480, height: 270 });

  const context = vm.createContext({
    window: env.window,
    document: env.document,
    navigator: env.navigator,
    performance: env.performance,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    console: env.console,
  });
  // The bundle expects a global `window` and `globalThis` aliasing.
  vm.runInContext('globalThis.window = window;', context);
  vm.runInContext(code, context);

  return { env, context, outDir };
}

/** Lets pending promise chains inside the bundle settle. */
async function flush(times = 5) {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test('bundle: the converter emits a runnable single-file bundle', () => {
  const { outDir } = buildAndLoad();
  const code = fs.readFileSync(path.join(outDir, 'heui.js'), 'utf8');
  assert.ok(code.length > 1000, 'the bundle has content');
  assert.ok(!/^\s*import\s/m.test(code), 'no ESM import statements survive');
  assert.ok(!/^\s*export\s/m.test(code), 'no ESM export statements survive');
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
});

test('game: the bundled game boots and starts rendering', async () => {
  const { env, context } = buildAndLoad();
  env.tick();
  await flush();

  assert.equal(context.window.HEUI_ERROR, undefined, `boot error: ${context.window.HEUI_ERROR}`);
  assert.equal(context.window.HEUI_READY, true, 'the engine reported ready');
  assert.ok(context.window.HEUI_ENGINE, 'the engine is exposed');
  assert.ok(context.window.HEUI_GAME, 'the game is exposed');

  env.run(3);
  await flush();
  assert.ok(env.canvas.getContext().calls.fillRect > 0, 'frames are drawn');
  assert.ok(env.canvas.getContext().calls.fillText > 0, 'the HUD is drawn');
});

test('game: collecting a gem raises the score in the bundled build', async () => {
  const { env, context } = buildAndLoad();
  env.tick();
  await flush();

  const game = context.window.HEUI_GAME;
  const gem = game.state.gems[0];
  game.state.player.x = gem.x;
  game.state.player.y = gem.y;

  env.run(3);
  await flush();

  assert.equal(game.state.collected, 1);
  assert.equal(game.state.score, gem.value);
  assert.ok(context.window.HEUI_ENGINE.renderer.stats.frames >= 3);
});

test('game: the touch joystick moves the player', async () => {
  const { env, context } = buildAndLoad();
  env.tick();
  await flush();

  const game = context.window.HEUI_GAME;
  const before = game.state.player.x;

  env.canvas.dispatch('pointerdown', { pointerId: 1, clientX: 200, clientY: 100 });
  env.canvas.dispatch('pointermove', { pointerId: 1, clientX: 260, clientY: 100 });
  env.run(10);
  await flush();

  assert.ok(game.state.player.x > before, 'the player moved right');
});
