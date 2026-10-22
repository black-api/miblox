// HeUi — native bridge tests.
//
// The Android host injects `window.HeUiHost`; these tests use a fake host
// that records the calls, which is exactly what the JNI layer exposes.

import test from 'node:test';
import assert from 'node:assert/strict';

import { NativeBridge } from '../src/platform/native-bridge.js';

function createFakeHost() {
  const calls = [];
  return {
    calls,
    nativeVersion: () => '0.1.0',
    nativeAbiVersion: () => 1,
    nativeLog: (level, tag, message) => calls.push(['log', level, tag, message]),
    nativeInit: (w, h) => {
      calls.push(['init', w, h]);
      return 1;
    },
    nativeFrame: (dt) => calls.push(['frame', dt]),
    nativePhysicsStep: (dt) => calls.push(['physics', dt]),
    nativePhysicsContactCount: () => 2,
    nativeNodeCreate: (name) => {
      calls.push(['node', name]);
      return 7;
    },
    nativeNodeSetPosition: (node, x, y) => calls.push(['move', node, x, y]),
    vibrate: (ms) => calls.push(['vibrate', ms]),
  };
}

test('native bridge: reports the native core version', () => {
  const bridge = new NativeBridge(createFakeHost());
  assert.ok(bridge.available);
  assert.equal(bridge.version, '0.1.0');
  assert.equal(bridge.abiVersion, 1);
});

test('native bridge: degrades to a no-op without a host', () => {
  const bridge = new NativeBridge(null);
  assert.equal(bridge.available, false);
  assert.equal(bridge.version, 'none');
  assert.equal(bridge.init(100, 100), false);
  assert.equal(bridge.frame(0.016), false);
  assert.equal(bridge.createNode('x'), 0);
  assert.equal(bridge.vibrate(10), false);
});

test('native bridge: forwards calls to the host', () => {
  const host = createFakeHost();
  const bridge = new NativeBridge(host);
  assert.equal(bridge.init(320, 240), true);
  bridge.frame(0.016);
  bridge.log(3, 'he', 'hello');
  assert.equal(bridge.createNode('player'), 7);
  bridge.setNodePosition(7, 1, 2);
  assert.equal(bridge.stepPhysics(0.016), 2);
  assert.equal(bridge.vibrate(30), true);

  const names = host.calls.map((call) => call[0]);
  assert.deepEqual(names, ['init', 'frame', 'log', 'node', 'move', 'physics', 'vibrate']);
});

test('native bridge: a throwing host never breaks the game', () => {
  const host = {
    nativeVersion: () => '0.1.0',
    nativeAbiVersion: () => 1,
    nativeFrame: () => {
      throw new Error('boom');
    },
  };
  const bridge = new NativeBridge(host);
  assert.equal(bridge.frame(0.016), false);
});
