// HeUi — a tiny synchronous event bus.

export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(name, handler) {
    if (!this._listeners.has(name)) this._listeners.set(name, []);
    this._listeners.get(name).push(handler);
    return () => this.off(name, handler);
  }

  once(name, handler) {
    const off = this.on(name, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(name, handler) {
    const list = this._listeners.get(name);
    if (!list) return;
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  emit(name, payload) {
    const list = this._listeners.get(name);
    if (!list || list.length === 0) return false;
    for (const handler of list.slice()) handler(payload);
    return true;
  }

  listenerCount(name) {
    const list = this._listeners.get(name);
    return list ? list.length : 0;
  }
}
