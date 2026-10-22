// HeUi — Gem Hunt game logic tests.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame, createRandom, readCommands, STATUS } from '../apps/gem-hunt/src/game.js';
import { InputState, KEY } from '../src/core/input.js';

test('random: the same seed produces the same sequence', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('game: starts with the requested number of gems and hazards', () => {
  const { state } = createGame({ cols: 16, rows: 9, gemCount: 5, hazardCount: 4 });
  assert.equal(state.gems.length, 5);
  assert.equal(state.hazards.length, 4);
  assert.equal(state.status, STATUS.PLAYING);
  assert.equal(state.timeLeft, state.duration);
  assert.equal(state.score, 0);
});

test('game: gems and hazards never share a cell', () => {
  const { state } = createGame({ cols: 16, rows: 9, gemCount: 6, hazardCount: 5 });
  const cells = new Set();
  for (const gem of state.gems) cells.add(`${gem.col},${gem.row}`);
  for (const hazard of state.hazards) {
    assert.ok(!cells.has(`${hazard.col},${hazard.row}`), 'cell overlap');
    cells.add(`${hazard.col},${hazard.row}`);
  }
});

test('game: collecting a gem scores it, respawns a gem and adds time', () => {
  const { state, update } = createGame({ cols: 16, rows: 9, gemCount: 3, hazardCount: 0 });
  const gem = state.gems[0];
  state.player.x = gem.x;
  state.player.y = gem.y;
  const before = state.gems.length;
  state.timeLeft = 30;
  const timeBefore = state.timeLeft;

  update(1 / 60);

  assert.equal(state.collected, 1);
  assert.equal(state.score, gem.value);
  assert.equal(state.gems.length, before, 'a new gem is spawned in place of the collected one');
  assert.ok(state.timeLeft > timeBefore, 'collecting a gem adds time');
  assert.ok(state.particles.length > 0, 'a particle burst is emitted');
});

test('game: the player stays inside the arena', () => {
  const { state, update } = createGame({ cols: 16, rows: 9 });
  update(10, { move: { x: 1, y: 1 } });
  assert.ok(state.player.x <= state.width - state.player.radius);
  assert.ok(state.player.y <= state.height - state.player.radius);
  assert.ok(state.player.x >= state.player.radius);
  assert.ok(state.player.y >= state.player.radius);
});

test('game: the timer runs out and the game ends', () => {
  const { state, update } = createGame({ duration: 1 });
  for (let i = 0; i < 120; i += 1) update(1 / 60);
  assert.equal(state.status, STATUS.OVER);
  assert.equal(state.timeLeft, 0);
});

test('game: restart resets the run', () => {
  const { state, update } = createGame({ duration: 1 });
  for (let i = 0; i < 120; i += 1) update(1 / 60);
  update(0, { restart: true });
  assert.equal(state.status, STATUS.PLAYING);
  assert.equal(state.score, 0);
  assert.equal(state.collected, 0);
  assert.equal(state.timeLeft, state.duration);
  assert.equal(state.gems.length, 5);
});

test('game: hazards cost time and push the player away', () => {
  const { state, update } = createGame({ cols: 16, rows: 9, gemCount: 0, hazardCount: 1 });
  const hazard = state.hazards[0];
  state.player.x = hazard.x;
  state.player.y = hazard.y;
  const before = state.timeLeft;
  update(1 / 60);
  assert.ok(state.timeLeft < before, 'hitting a hazard costs time');
  const dx = state.player.x - hazard.x;
  const dy = state.player.y - hazard.y;
  assert.ok(Math.hypot(dx, dy) >= hazard.radius, 'the player is pushed out of the hazard');
});

test('commands: keyboard and joystick combine into a move vector', () => {
  const input = new InputState();
  input.setKey(KEY.LEFT, true);
  const commands = readCommands(input);
  assert.equal(commands.move.x, -1);
  assert.equal(commands.move.y, 0);

  const withStick = readCommands(input, { joystick: { active: true, x: 0.5, y: 0.5 } });
  assert.equal(withStick.move.x, -0.5);
  assert.equal(withStick.move.y, 0.5);
});
