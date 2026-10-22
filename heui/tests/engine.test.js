// HeUi — engine unit tests (JS runtime).

import test from 'node:test';
import assert from 'node:assert/strict';

import { Clock } from '../src/core/clock.js';
import { InputState, KEY } from '../src/core/input.js';
import { Renderer, HeadlessBackend, DrawKind } from '../src/core/renderer.js';
import { EventEmitter } from '../src/core/events.js';
import { Node, Scene } from '../src/core/scene.js';
import { Vec2, Rect, clamp, lerp, lengthDelta } from '../src/core/math.js';

test('clock: fixed steps accumulate from real time', () => {
  const clock = new Clock({ fixedStep: 1 / 60 });
  const first = clock.advance(1 / 30);
  assert.equal(first.steps, 2);
  assert.equal(first.fixed, 1 / 60);
});

test('clock: long frames are clamped so the simulation never spirals', () => {
  const clock = new Clock({ fixedStep: 1 / 60, maxDelta: 0.25, maxSteps: 5 });
  const result = clock.advance(30);
  assert.ok(result.steps <= 5);
  assert.ok(result.variable <= 0.25);
});

test('clock: time scale slows the simulation', () => {
  const clock = new Clock({ fixedStep: 1 / 60 });
  clock.timeScale = 0.5;
  const result = clock.advance(1 / 60);
  assert.equal(result.steps, 0);
});

test('input: key press and release edges are reported once', () => {
  const input = new InputState();
  input.beginFrame();
  input.setKey(KEY.SPACE, true);
  assert.ok(input.keyDown(KEY.SPACE));
  assert.ok(input.keyPressed(KEY.SPACE));

  input.beginFrame();
  assert.ok(input.keyDown(KEY.SPACE));
  assert.ok(!input.keyPressed(KEY.SPACE));

  input.setKey(KEY.SPACE, false);
  assert.ok(input.keyReleased(KEY.SPACE));
  assert.ok(!input.keyDown(KEY.SPACE));
});

test('input: actions map to keys', () => {
  const input = new InputState();
  input.bindAction('jump', [KEY.SPACE, KEY.UP]);
  input.setKey(KEY.UP, true);
  assert.ok(input.actionDown('jump'));
  assert.ok(input.actionPressed('jump'), 'the press edge is reported on the frame it happens');
});

test('input: pointers track down, move and up', () => {
  const input = new InputState();
  input.pointerDown(1, 10, 10);
  assert.equal(input.activePointers().length, 1);
  input.pointerMove(1, 20, 30);
  assert.equal(input.primaryPointer().x, 20);
  input.pointerUp(1, 20, 30);
  assert.equal(input.activePointers().length, 0);
});

test('renderer: commands are sorted by layer', () => {
  const backend = new HeadlessBackend();
  const renderer = new Renderer(backend, { width: 100, height: 100 });
  renderer.beginFrame();
  renderer.rect({ x: 0, y: 0, width: 1, height: 1, layer: 5 });
  renderer.rect({ x: 0, y: 0, width: 1, height: 1, layer: 1 });
  renderer.endFrame();
  assert.equal(backend.commands.length, 2);
  assert.equal(backend.commands[0].layer, 1);
  assert.equal(renderer.stats.drawCalls, 2);
});

test('events: handlers can be removed', () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const off = emitter.on('tick', () => {
    calls += 1;
  });
  emitter.emit('tick');
  off();
  emitter.emit('tick');
  assert.equal(calls, 1);
});

test('scene: world transforms compose down the tree', () => {
  const scene = new Scene('test');
  const player = scene.root.createChild('player');
  const gem = player.createChild('gem');
  player.position = { x: 100, y: 50 };
  gem.position = { x: 10, y: 0 };
  scene.update(1 / 60);
  assert.equal(gem.worldPosition.x, 110);
  assert.equal(gem.worldPosition.y, 50);
  assert.equal(scene.root.childByName('player'), player);
});

test('math: vectors, rects and helpers', () => {
  const v = new Vec2(3, 4);
  assert.equal(v.length, 5);
  assert.equal(new Vec2(0, 5).normalize().length, 1);
  assert.equal(clamp(9, 0, 1), 1);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.ok(Math.abs(lengthDelta(0, Math.PI * 2 - 0.1) + 0.1) < 1e-9);
  const rect = new Rect(0, 0, 10, 10);
  assert.ok(rect.contains({ x: 5, y: 5 }));
  assert.ok(rect.intersects(new Rect(5, 5, 10, 10)));
  assert.ok(!rect.intersects(new Rect(20, 20, 1, 1)));
});

test('draw kinds are stable strings (the C ABI mirrors them)', () => {
  assert.equal(DrawKind.RECT, 'rect');
  assert.equal(DrawKind.SPRITE, 'sprite');
});
