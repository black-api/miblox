// HeUi — bridge to the native core.
//
// On Android the host injects a `HeUiHost` object into the WebView. Every
// method it exposes is a thin wrapper over the C++ core (see
// native/src/jni/he_jni.cpp). When the object is missing — desktop preview,
// browser, or a device where libhe.so could not be loaded — the bridge
// degrades to a no-op and the JavaScript runtime keeps working.

export class NativeBridge {
  /**
   * @param {object|null} host the injected host object (window.HeUiHost)
   */
  constructor(host = null) {
    this.host = host || null;
    this.available = Boolean(host && typeof host.nativeVersion === 'function');
    this.version = 'none';
    this.abiVersion = 0;
    if (this.available) {
      try {
        this.version = host.nativeVersion() || 'unknown';
        this.abiVersion = host.nativeAbiVersion() || 0;
      } catch (error) {
        this.available = false;
      }
    }
  }

  /** Creates a bridge from the current global scope. */
  static detect(scope = typeof globalThis !== 'undefined' ? globalThis : {}) {
    return new NativeBridge(scope.HeUiHost || null);
  }

  log(level, tag, message) {
    if (!this.available) return false;
    try {
      this.host.nativeLog(level, tag, message);
      return true;
    } catch (error) {
      return false;
    }
  }

  init(width, height) {
    if (!this.available) return false;
    try {
      return this.host.nativeInit(width, height) === 1;
    } catch (error) {
      return false;
    }
  }

  frame(deltaSeconds) {
    if (!this.available) return false;
    try {
      this.host.nativeFrame(deltaSeconds);
      return true;
    } catch (error) {
      return false;
    }
  }

  stepPhysics(dt) {
    if (!this.available) return 0;
    try {
      this.host.nativePhysicsStep(dt);
      return this.host.nativePhysicsContactCount();
    } catch (error) {
      return 0;
    }
  }

  createNode(name) {
    if (!this.available) return 0;
    try {
      return this.host.nativeNodeCreate(name);
    } catch (error) {
      return 0;
    }
  }

  setNodePosition(node, x, y) {
    if (!this.available) return false;
    try {
      this.host.nativeNodeSetPosition(node, x, y);
      return true;
    } catch (error) {
      return false;
    }
  }

  vibrate(milliseconds) {
    if (!this.available) return false;
    try {
      this.host.vibrate(milliseconds);
      return true;
    } catch (error) {
      return false;
    }
  }
}
