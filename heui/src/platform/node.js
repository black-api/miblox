// HeUi — Node platform adapter (desktop preview and headless tests).

import fs from 'node:fs';
import path from 'node:path';

export class NodePlatform {
  constructor({ root = process.cwd(), assetBase = '' } = {}) {
    this.root = root;
    this.assetBase = assetBase;
  }

  now() {
    return Number(process.hrtime.bigint() / 1000n) / 1e6;
  }

  loadAsset(assetPath, type = 'text') {
    const full = path.join(this.root, this.assetBase, assetPath);
    if (type === 'json') {
      return Promise.resolve(JSON.parse(fs.readFileSync(full, 'utf8')));
    }
    if (type === 'binary') {
      return Promise.resolve(fs.readFileSync(full).buffer);
    }
    return Promise.resolve(fs.readFileSync(full, 'utf8'));
  }

  playSound() {
    // No audio device in the headless preview.
  }

  attachInput() {
    // The desktop preview drives the game programmatically.
  }

  /**
   * Runs the loop at a fixed rate. `manual` mode lets a test step the clock
   * without any timers at all.
   */
  startLoop(onFrame, { fps = 60 } = {}) {
    const interval = setInterval(() => onFrame(1 / fps), 1000 / fps);
    return { cancel: () => clearInterval(interval) };
  }

  setLoop(onFrame) {
    return this.startLoop(onFrame);
  }

  stopLoop() {}

  vibrate() {}
}
