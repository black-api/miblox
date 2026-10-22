// Gem Hunt — game logic.
//
// This module is deliberately free of any engine dependency: it takes a
// delta time and a set of commands and returns the new state. That keeps it
// unit-testable headlessly and lets the same code run in the browser
// preview, in the Android WebView and (through the native core) on device.

export const GEM_COLORS = ['#ff4d6d', '#4dc9ff', '#ffd166', '#8affc1', '#c08bff'];
export const GEM_VALUES = [1, 1, 1, 2, 3];

/**
 * Applies a palette loaded from `assets/gems.json`.
 * The game works without it; the palette only changes the colours and the
 * value of a gem.
 */
export function applyPalette(state, palette) {
  if (!palette || !Array.isArray(palette.gems) || palette.gems.length === 0) return state;
  for (const gem of state.gems) {
    const entry = palette.gems[Math.floor(state.random() * palette.gems.length)];
    if (entry.color) gem.color = entry.color;
    if (entry.value) gem.value = entry.value;
  }
  return state;
}

/** Small, fast, deterministic PRNG (mulberry32). */
export function createRandom(seed = 1) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STATUS = {
  PLAYING: 'playing',
  OVER: 'over',
};

export function createGame({
  seed = 20261022,
  cols = 16,
  rows = 9,
  cell = 20,
  duration = 60,
  gemCount = 5,
  hazardCount = 4,
} = {}) {
  const random = createRandom(seed);

  const state = {
    cols,
    rows,
    cell,
    width: cols * cell,
    height: rows * cell,
    duration,
    timeLeft: duration,
    score: 0,
    collected: 0,
    status: STATUS.PLAYING,
    player: { x: (cols * cell) / 2, y: (rows * cell) / 2, vx: 0, vy: 0, radius: 7 },
    gems: [],
    hazards: [],
    particles: [],
    speed: 78,
    random,
  };

  const occupied = () => {
    const taken = new Set();
    for (const gem of state.gems) taken.add(`${gem.col},${gem.row}`);
    for (const hazard of state.hazards) taken.add(`${hazard.col},${hazard.row}`);
    return taken;
  };

  const freeCell = () => {
    const taken = occupied();
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const col = Math.floor(random() * cols);
      const row = Math.floor(random() * rows);
      if (!taken.has(`${col},${row}`)) return { col, row };
    }
    return { col: 0, row: 0 };
  };

  const spawnGem = () => {
    const { col, row } = freeCell();
    const value = GEM_VALUES[Math.floor(random() * GEM_VALUES.length)];
    state.gems.push({
      col,
      row,
      x: col * cell + cell / 2,
      y: row * cell + cell / 2,
      value,
      color: GEM_COLORS[Math.floor(random() * GEM_COLORS.length)],
      radius: 5 + value,
      phase: random() * Math.PI * 2,
    });
  };

  const spawnHazard = () => {
    const { col, row } = freeCell();
    state.hazards.push({
      col,
      row,
      x: col * cell + cell / 2,
      y: row * cell + cell / 2,
      radius: 8,
    });
  };

  for (let i = 0; i < gemCount; i += 1) spawnGem();
  for (let i = 0; i < hazardCount; i += 1) spawnHazard();

  const burst = (x, y, color) => {
    for (let i = 0; i < 10; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 20 + random() * 45;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        color,
      });
    }
  };

  const collide = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const radius = a.radius + b.radius;
    return dx * dx + dy * dy <= radius * radius;
  };

  /**
   * Advances the game.
   * @param {number} dt seconds
   * @param {{move?: {x: number, y: number}, restart?: boolean}} commands
   */
  const update = (dt, commands = {}) => {
    if (commands.restart) {
      state.score = 0;
      state.collected = 0;
      state.timeLeft = state.duration;
      state.status = STATUS.PLAYING;
      state.particles.length = 0;
      state.gems.length = 0;
      state.hazards.length = 0;
      for (let i = 0; i < gemCount; i += 1) spawnGem();
      for (let i = 0; i < hazardCount; i += 1) spawnHazard();
      state.player.x = state.width / 2;
      state.player.y = state.height / 2;
      return state;
    }

    if (state.status === STATUS.OVER) return state;

    // --- timer ---
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.status = STATUS.OVER;
      return state;
    }

    // --- movement ---
    const move = commands.move || { x: 0, y: 0 };
    const length = Math.hypot(move.x, move.y);
    const nx = length > 1 ? move.x / length : move.x;
    const ny = length > 1 ? move.y / length : move.y;
    const player = state.player;
    player.vx = nx * state.speed;
    player.vy = ny * state.speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Keep the player inside the arena.
    player.x = Math.max(player.radius, Math.min(state.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(state.height - player.radius, player.y));

    // --- gems ---
    for (let i = state.gems.length - 1; i >= 0; i -= 1) {
      const gem = state.gems[i];
      gem.phase += dt * 3;
      if (collide(player, gem)) {
        state.score += gem.value;
        state.collected += 1;
        state.timeLeft = Math.min(state.duration, state.timeLeft + 1.5);
        burst(gem.x, gem.y, gem.color);
        state.gems.splice(i, 1);
        spawnGem();
        // Every eight gems the hunt speeds up.
        if (state.collected % 8 === 0) state.speed += 4;
      }
    }

    // --- hazards push the player away and cost time ---
    for (const hazard of state.hazards) {
      if (collide(player, hazard)) {
        let dx = player.x - hazard.x;
        let dy = player.y - hazard.y;
        let len = Math.hypot(dx, dy);
        if (len < 1e-4) {
          // Dead centre: push along a deterministic direction.
          dx = 1;
          dy = 0;
          len = 1;
        }
        player.x = hazard.x + (dx / len) * (hazard.radius + player.radius);
        player.y = hazard.y + (dy / len) * (hazard.radius + player.radius);
        state.timeLeft = Math.max(0, state.timeLeft - 0.35);
        burst(player.x, player.y, '#ffffff');
      }
    }

    // --- particles ---
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    return state;
  };

  return { state, update };
}

/**
 * Turns raw input into game commands.
 * Keyboard (desktop) and a virtual joystick (touch) both produce a `move`
 * vector in the range [-1, 1].
 */
export function readCommands(input, { joystick } = {}) {
  let x = 0;
  let y = 0;
  if (input) {
    if (input.keyDown('ArrowLeft') || input.keyDown('a')) x -= 1;
    if (input.keyDown('ArrowRight') || input.keyDown('d')) x += 1;
    if (input.keyDown('ArrowUp') || input.keyDown('w')) y -= 1;
    if (input.keyDown('ArrowDown') || input.keyDown('s')) y += 1;
  }
  if (joystick && joystick.active) {
    x += joystick.x;
    y += joystick.y;
  }
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { move: { x, y } };
}
