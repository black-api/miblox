// Gem Hunt — entry point.
//
// Wires the game logic to the HeUi engine: input (keyboard + virtual
// joystick), rendering, audio and the game-over loop. Runs unchanged in the
// desktop browser preview and inside the Android WebView.
//
// The bundle is a classic script (a WebView cannot load ES modules over
// file://), so the entry point is an async function instead of top-level
// await.

import { createEngine } from '../../../src/index.js';
import { createGame, readCommands, applyPalette, GEM_COLORS, STATUS } from './game.js';

const WORLD_COLS = 16;
const CELL = 20;

async function boot() {
  const canvas = document.getElementById('game');
  const manifest = window.HEUI_MANIFEST || { name: 'gem-hunt', displayName: 'Gem Hunt' };

  /** Computes the world layout for the current canvas size. */
  function layout() {
    const width = canvas.width;
    const height = canvas.height;
    const scale = width / (WORLD_COLS * CELL);
    const rows = Math.max(6, Math.round(height / scale / CELL));
    return {
      scale,
      rows,
      worldWidth: WORLD_COLS * CELL,
      worldHeight: rows * CELL,
    };
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width * ratio));
    canvas.height = Math.max(180, Math.floor(rect.height * ratio));
  }

  resizeCanvas();

  const engine = await createEngine({
    platform: 'browser',
    canvas,
    width: canvas.width,
    height: canvas.height,
  });

  let view = layout();
  let game = createGame({ cols: WORLD_COLS, rows: view.rows, cell: CELL });

  // --- virtual joystick ----------------------------------------------------
  const joystick = { active: false, x: 0, y: 0, originX: 0, originY: 0, pointerId: null };
  const RADIUS = 60;

  canvas.addEventListener('pointerdown', (event) => {
    if (game.state.status === STATUS.OVER) {
      game.update(0, { restart: true });
      return;
    }
    joystick.active = true;
    joystick.pointerId = event.pointerId;
    joystick.originX = event.clientX;
    joystick.originY = event.clientY;
    joystick.x = 0;
    joystick.y = 0;
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!joystick.active || event.pointerId !== joystick.pointerId) return;
    const dx = event.clientX - joystick.originX;
    const dy = event.clientY - joystick.originY;
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(length, RADIUS);
    if (length > 0) {
      joystick.x = (dx / length) * (clamped / RADIUS);
      joystick.y = (dy / length) * (clamped / RADIUS);
    }
  });

  const endJoystick = (event) => {
    if (event.pointerId !== joystick.pointerId) return;
    joystick.active = false;
    joystick.x = 0;
    joystick.y = 0;
    joystick.pointerId = null;
  };
  canvas.addEventListener('pointerup', endJoystick);
  canvas.addEventListener('pointercancel', endJoystick);

  window.addEventListener('resize', () => {
    resizeCanvas();
    engine.resize(canvas.width, canvas.height);
    const next = layout();
    if (next.rows !== view.rows) {
      // The arena changed shape: rebuild it but keep the run going.
      const previous = game.state;
      game = createGame({ cols: WORLD_COLS, rows: next.rows, cell: CELL });
      game.state.score = previous.score;
      game.state.collected = previous.collected;
      game.state.timeLeft = previous.timeLeft;
    }
    view = next;
  });

  // --- audio ---------------------------------------------------------------
  engine.audio.register('collect', { duration: 0.18 });
  engine.audio.register('hit', { duration: 0.25 });

  // --- assets --------------------------------------------------------------
  // The palette is optional: the game keeps its built-in colours if the
  // asset cannot be loaded.
  engine.resources.declare('gems', { path: 'assets/gems.json', type: 'json' });
  try {
    const palette = await engine.resources.load('gems');
    applyPalette(game.state, palette);
  } catch (error) {
    console.warn('heui: palette asset unavailable, using defaults');
  }

  // --- game loop -----------------------------------------------------------
  engine.onUpdate((dt) => {
    const commands = readCommands(engine.input, { joystick });
    const before = game.state.collected;
    const beforeTime = game.state.timeLeft;

    game.update(dt, commands);

    if (game.state.collected > before) {
      engine.audio.play('collect', { volume: 0.6 });
      if (engine.platform.vibrate) engine.platform.vibrate(0.03);
    }
    if (game.state.timeLeft < beforeTime - 0.3) {
      engine.audio.play('hit', { volume: 0.4 });
    }
  });

  engine.onRender((renderer) => {
    const state = game.state;
    const { scale } = view;
    const w = canvas.width;
    const h = canvas.height;

    // Background
    renderer.rect({ x: 0, y: 0, width: w, height: h, color: '#0d1020' });

    // Arena floor
    renderer.rect({
      x: 0,
      y: 0,
      width: state.width * scale,
      height: state.height * scale,
      color: '#151a33',
      layer: 0,
    });

    // Grid
    for (let col = 1; col < state.cols; col += 1) {
      renderer.rect({
        x: col * CELL * scale,
        y: 0,
        width: 1,
        height: state.height * scale,
        color: '#1d2342',
        layer: 1,
      });
    }
    for (let row = 1; row < state.rows; row += 1) {
      renderer.rect({
        x: 0,
        y: row * CELL * scale,
        width: state.width * scale,
        height: 1,
        color: '#1d2342',
        layer: 1,
      });
    }

    // Hazards
    for (const hazard of state.hazards) {
      renderer.circle({
        x: hazard.x * scale,
        y: hazard.y * scale,
        radius: hazard.radius * scale,
        color: '#3a4266',
        layer: 2,
      });
    }

    // Gems
    for (const gem of state.gems) {
      const pulse = 1 + Math.sin(gem.phase) * 0.12;
      renderer.circle({
        x: gem.x * scale,
        y: gem.y * scale,
        radius: gem.radius * scale * pulse,
        color: gem.color,
        layer: 3,
      });
      renderer.circle({
        x: gem.x * scale,
        y: gem.y * scale,
        radius: gem.radius * scale * pulse * 0.45,
        color: '#ffffff',
        layer: 4,
      });
    }

    // Particles
    for (const particle of state.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      renderer.circle({
        x: particle.x * scale,
        y: particle.y * scale,
        radius: 3 * scale * alpha,
        color: particle.color,
        layer: 5,
      });
    }

    // Player
    renderer.circle({
      x: state.player.x * scale,
      y: state.player.y * scale,
      radius: state.player.radius * scale,
      color: '#ffffff',
      layer: 6,
    });
    renderer.circle({
      x: state.player.x * scale,
      y: state.player.y * scale,
      radius: state.player.radius * scale * 0.45,
      color: GEM_COLORS[state.collected % GEM_COLORS.length],
      layer: 7,
    });

    // HUD
    renderer.text({
      x: 12,
      y: 10,
      text: `SCORE ${state.score}`,
      font: 'bold 20px monospace',
      color: '#ffffff',
      layer: 10,
    });
    renderer.text({
      x: 12,
      y: 34,
      text: `GEMS ${state.collected}`,
      font: '14px monospace',
      color: '#8affc1',
      layer: 10,
    });
    renderer.text({
      x: w - 12,
      y: 10,
      text: `${Math.ceil(state.timeLeft)}s`,
      font: 'bold 20px monospace',
      color: state.timeLeft < 10 ? '#ff4d6d' : '#ffd166',
      align: 'right',
      layer: 10,
    });

    // Time bar
    const barWidth = (state.timeLeft / state.duration) * (w - 24);
    renderer.rect({ x: 12, y: h - 26, width: w - 24, height: 8, color: '#1d2342', layer: 9 });
    renderer.rect({ x: 12, y: h - 26, width: barWidth, height: 8, color: '#4dc9ff', layer: 10 });

    // Native core status (the C++ engine is running next to the script).
    if (engine.native.available) {
      renderer.text({
        x: 12,
        y: h - 46,
        text: `native core ${engine.native.version}`,
        font: '12px monospace',
        color: '#4dc9ff',
        layer: 10,
      });
    }

    // Joystick
    if (joystick.active) {
      const rect = canvas.getBoundingClientRect();
      const originX = (joystick.originX - rect.left) * (w / rect.width);
      const originY = (joystick.originY - rect.top) * (h / rect.height);
      renderer.circle({ x: originX, y: originY, radius: RADIUS * scale, color: '#ffffff22', layer: 8 });
      renderer.circle({
        x: originX + joystick.x * RADIUS * scale,
        y: originY + joystick.y * RADIUS * scale,
        radius: 22 * scale,
        color: '#ffffff66',
        layer: 9,
      });
    }

    // Game over
    if (state.status === STATUS.OVER) {      renderer.rect({ x: 0, y: 0, width: w, height: h, color: '#05060ecc', layer: 20 });
      renderer.text({
        x: w / 2,
        y: h / 2 - 40,
        text: 'TIME UP',
        font: 'bold 40px monospace',
        color: '#ff4d6d',
        align: 'center',
        layer: 21,
      });
      renderer.text({
        x: w / 2,
        y: h / 2,
        text: `SCORE ${state.score}  ·  ${state.collected} GEMS`,
        font: '20px monospace',
        color: '#ffffff',
        align: 'center',
        layer: 21,
      });
      renderer.text({
        x: w / 2,
        y: h / 2 + 40,
        text: 'TAP TO PLAY AGAIN',
        font: '16px monospace',
        color: '#8affc1',
        align: 'center',
        layer: 21,
      });
    }
  });

  engine.onPause(() => engine.audio.suspend());
  engine.onResume(() => engine.audio.resume());

  await engine.start();
  window.HEUI_ENGINE = engine;
  window.HEUI_GAME = game;
  window.HEUI_READY = true;
}

boot().catch((error) => {
  console.error('heui: boot failed', error);
  window.HEUI_ERROR = String(error && error.stack ? error.stack : error);
});
