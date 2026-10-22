// HeUi — renderer.
//
// The renderer collects draw commands in a list and hands them to a backend.
// Backends:
//   * Canvas2DBackend — browser / Android WebView
//   * HeadlessBackend — Node, used by tests and by the headless preview
//
// The native core has its own renderer (GLES3); this list is the contract
// shared with the JavaScript side.

export const DrawKind = {
  RECT: 'rect',
  CIRCLE: 'circle',
  SPRITE: 'sprite',
  LINE: 'line',
  TEXT: 'text',
};

export const BlendMode = {
  NONE: 'none',
  ALPHA: 'alpha',
  ADDITIVE: 'additive',
};

export class DrawCommand {
  constructor(kind, options = {}) {
    this.kind = kind;
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 0;
    this.height = options.height || 0;
    this.radius = options.radius || 0;
    this.color = options.color || '#ffffff';
    this.text = options.text || '';
    this.font = options.font || '16px sans-serif';
    this.align = options.align || 'left';
    this.rotation = options.rotation || 0;
    this.layer = options.layer || 0;
    this.blend = options.blend || BlendMode.ALPHA;
  }
}

export class HeadlessBackend {
  constructor() {
    this.commands = [];
    this.frames = 0;
  }

  beginFrame(size) {
    this.size = size;
    this.commands = [];
  }

  draw(command) {
    this.commands.push(command);
  }

  endFrame() {
    this.frames += 1;
  }

  invalidate() {}

  get name() {
    return 'headless';
  }
}

export class Canvas2DBackend {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = { width: canvas.width, height: canvas.height };
  }

  beginFrame(size) {
    this.size = size;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, size.width, size.height);
  }

  draw(command) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation =
      command.blend === BlendMode.ADDITIVE ? 'lighter' : 'source-over';

    if (command.kind === DrawKind.RECT) {
      ctx.fillStyle = command.color;
      ctx.translate(command.x + command.width / 2, command.y + command.height / 2);
      if (command.rotation) ctx.rotate(command.rotation);
      ctx.fillRect(-command.width / 2, -command.height / 2, command.width, command.height);
    } else if (command.kind === DrawKind.CIRCLE) {
      ctx.fillStyle = command.color;
      ctx.beginPath();
      ctx.arc(command.x, command.y, command.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (command.kind === DrawKind.LINE) {
      ctx.strokeStyle = command.color;
      ctx.lineWidth = command.width || 2;
      ctx.beginPath();
      ctx.moveTo(command.x, command.y);
      ctx.lineTo(command.height, command.width);
      ctx.stroke();
    } else if (command.kind === DrawKind.TEXT) {
      ctx.fillStyle = command.color;
      ctx.font = command.font;
      ctx.textAlign = command.align;
      ctx.textBaseline = 'top';
      ctx.fillText(command.text, command.x, command.y);
    }
    ctx.restore();
  }

  endFrame() {}

  invalidate() {}

  get name() {
    return 'canvas2d';
  }
}

export class Renderer {
  constructor(backend, { width = 1280, height = 720 } = {}) {
    this.backend = backend;
    this.size = { width, height };
    this.commands = [];
    this.stats = { drawCalls: 0, frames: 0 };
  }

  beginFrame() {
    this.commands = [];
    this.stats.drawCalls = 0;
    this.backend.beginFrame(this.size);
  }

  /** @param {DrawCommand} command */
  submit(command) {
    this.commands.push(command);
  }

  endFrame() {
    const sorted = this.commands
      .map((command, index) => ({ command, index }))
      .sort((a, b) => a.command.layer - b.command.layer || a.index - b.index);
    for (const { command } of sorted) {
      this.backend.draw(command);
      this.stats.drawCalls += 1;
    }
    this.backend.endFrame();
    this.stats.frames += 1;
  }

  rect(options) {
    this.submit(new DrawCommand(DrawKind.RECT, options));
  }

  circle(options) {
    this.submit(new DrawCommand(DrawKind.CIRCLE, options));
  }

  text(options) {
    this.submit(new DrawCommand(DrawKind.TEXT, options));
  }

  line(x1, y1, x2, y2, options = {}) {
    const command = new DrawCommand(DrawKind.LINE, options);
    command.x = x1;
    command.y = y1;
    command.width = x2;
    command.height = y2;
    this.submit(command);
  }
}
