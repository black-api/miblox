// HeUi — audio.
//
// A bus-based mixer. The browser backend uses WebAudio; the Node backend is a
// no-op that still tracks playback state so the game logic is identical.

export class AudioBus {
  constructor(name, volume = 1) {
    this.name = name;
    this.volume = volume;
    this.muted = false;
  }
}

export class AudioManager {
  constructor(platform = null) {
    this.platform = platform;
    this.buses = new Map();
    this.clips = new Map();
    this.players = new Map();
    this.suspended = false;
    this._nextId = 1;
  }

  bus(name, volume = 1) {
    if (!this.buses.has(name)) this.buses.set(name, new AudioBus(name, volume));
    return this.buses.get(name);
  }

  /**
   * Registers a sound. On the browser the URL is fetched lazily; on Node the
   * clip is metadata only.
   */
  register(name, { url = null, duration = 1, looping = false } = {}) {
    const clip = { name, url, duration, looping };
    this.clips.set(name, clip);
    return clip;
  }

  play(name, { bus = 'sfx', volume = 1, rate = 1, loop = false } = {}) {
    const clip = this.clips.get(name);
    if (!clip) return null;
    const id = this._nextId++;
    const player = {
      id,
      clip,
      bus: this.bus(bus),
      volume,
      rate,
      loop: loop || clip.looping,
      position: 0,
      state: 'playing',
    };
    this.players.set(id, player);

    if (this.platform && this.platform.playSound) {
      this.platform.playSound(clip, player);
    }
    return player;
  }

  stop(id) {
    const player = this.players.get(id);
    if (player) player.state = 'stopped';
  }

  /** Advances playback state; called once per frame. */
  update(dt) {
    if (this.suspended) return;
    for (const player of this.players.values()) {
      if (player.state !== 'playing') continue;
      player.position += dt * player.rate;
      if (player.position >= player.clip.duration) {
        if (player.loop) {
          player.position = player.position % player.clip.duration;
        } else {
          player.state = 'stopped';
        }
      }
    }
  }

  suspend() {
    this.suspended = true;
    for (const player of this.players.values()) {
      if (player.state === 'playing') player.state = 'paused';
    }
  }

  resume() {
    this.suspended = false;
    for (const player of this.players.values()) {
      if (player.state === 'paused') player.state = 'playing';
    }
  }
}
