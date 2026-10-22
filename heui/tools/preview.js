#!/usr/bin/env node
// HeUi — headless desktop preview.
//
//   node tools/preview.js apps/gem-hunt [--frames 120]
//
// The project is bundled, loaded into a fake browser environment and stepped
// frame by frame. The resulting arena is printed to the terminal, which
// makes it possible to see the game running without a display.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { buildBundle } from '../converter/src/cli.js';
import { createBrowserEnv } from './lib/fake-dom.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

/**
 * Loads a project bundle into a fake browser environment.
 * @param {string} projectDir
 */
export async function createHeadlessPreview(projectDir, { width = 480, height = 270 } = {}) {
  const outDir = path.join(repoRoot, 'tmp', 'preview');
  const bundle = buildBundle(projectDir, outDir);
  const code = fs.readFileSync(path.join(outDir, 'heui.js'), 'utf8');
  const env = createBrowserEnv({ width, height });

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
  vm.runInContext('globalThis.window = window;', context);
  vm.runInContext(code, context);

  return { env, context, bundle, outDir };
}

/** Renders the arena of a Gem Hunt style game as ASCII. */
function renderAscii(state) {
  if (!state || !state.gems) return null;
  const cols = state.cols;
  const rows = state.rows;
  const cell = state.cell;
  const grid = [];
  for (let row = 0; row < rows; row += 1) {
    grid.push(new Array(cols).fill('·'));
  }
  for (const hazard of state.hazards) {
    grid[hazard.row][hazard.col] = '#';
  }
  for (const gem of state.gems) {
    grid[gem.row][gem.col] = '*';
  }
  const playerCol = Math.min(cols - 1, Math.max(0, Math.floor(state.player.x / cell)));
  const playerRow = Math.min(rows - 1, Math.max(0, Math.floor(state.player.y / cell)));
  grid[playerRow][playerCol] = '@';
  return grid.map((row) => row.join(' ')).join('\n');
}

/**
 * Runs a project headlessly and prints an ASCII preview.
 * @param {string} projectDir
 * @param {number} frames how many frames to simulate
 */
export async function runPreview(projectDir, frames = 120) {
  const preview = await createHeadlessPreview(projectDir);
  const { env, context } = preview;

  env.tick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  if (context.window.HEUI_ERROR) {
    throw new Error(`boot failed: ${context.window.HEUI_ERROR}`);
  }

  process.stdout.write(`heui preview — ${path.basename(projectDir)}\n`);
  process.stdout.write(`bundle: ${preview.bundle.modules.length} modules\n\n`);

  // Drive the player towards the nearest gem so the preview shows action.
  const game = context.window.HEUI_GAME;
  for (let frame = 0; frame < frames; frame += 1) {
    if (game && game.state.status === 'playing' && game.state.gems.length > 0) {
      const gem = game.state.gems[0];
      const dx = gem.x - game.state.player.x;
      const dy = gem.y - game.state.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 6) {
        game.state.player.x = gem.x;
        game.state.player.y = gem.y;
      } else {
        game.state.player.x += (dx / distance) * 2.2;
        game.state.player.y += (dy / distance) * 2.2;
      }
    }
    env.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const state = game ? game.state : null;
  const ascii = renderAscii(state);
  if (ascii) {
    process.stdout.write(`${ascii}\n\n`);
  }
  if (state) {
    process.stdout.write(
      `score: ${state.score}   gems: ${state.collected}   time left: ${state.timeLeft.toFixed(1)}s   status: ${state.status}\n`,
    );
  }
  const engine = context.window.HEUI_ENGINE;
  if (engine) {
    process.stdout.write(
      `frames rendered: ${engine.renderer.stats.frames}   draw calls/frame: ${engine.renderer.stats.drawCalls}\n`,
    );
  }
  return 0;
}

async function main(argv) {
  const projectDir = path.resolve(
    argv.find((arg) => !arg.startsWith('--')) || path.join(repoRoot, 'apps', 'gem-hunt'),
  );
  const frameIndex = argv.indexOf('--frames');
  const frames = frameIndex >= 0 ? Number(argv[frameIndex + 1]) : 120;
  return runPreview(projectDir, frames);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exit(1);
    });
}
