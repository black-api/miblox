// HeUi — 2D math for the JavaScript runtime.
// Mirrors native/include/he/math.hpp so game code behaves identically on
// every host.

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static of(x, y) {
    return new Vec2(x, y);
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  add(o) {
    this.x += o.x;
    this.y += o.y;
    return this;
  }

  sub(o) {
    this.x -= o.x;
    this.y -= o.y;
    return this;
  }

  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  get length() {
    return Math.hypot(this.x, this.y);
  }

  get lengthSquared() {
    return this.x * this.x + this.y * this.y;
  }

  dot(o) {
    return this.x * o.x + this.y * o.y;
  }

  cross(o) {
    return this.x * o.y - this.y * o.x;
  }

  normalize() {
    const len = this.length;
    if (len > 1e-6) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  distanceTo(o) {
    return Math.hypot(this.x - o.x, this.y - o.y);
  }

  lerp(o, t) {
    this.x += (o.x - this.x) * t;
    this.y += (o.y - this.y) * t;
    return this;
  }

  equals(o, epsilon = 1e-6) {
    return Math.abs(this.x - o.x) <= epsilon && Math.abs(this.y - o.y) <= epsilon;
  }
}

export function vec2(x, y) {
  return new Vec2(x, y);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lengthDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Rect {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get left() {
    return this.x;
  }

  get top() {
    return this.y;
  }

  get right() {
    return this.x + this.width;
  }

  get bottom() {
    return this.y + this.height;
  }

  get center() {
    return new Vec2(this.x + this.width / 2, this.y + this.height / 2);
  }

  contains(point) {
    return (
      point.x >= this.left &&
      point.x <= this.right &&
      point.y >= this.top &&
      point.y <= this.bottom
    );
  }

  intersects(other) {
    return (
      this.left <= other.right &&
      this.right >= other.left &&
      this.top <= other.bottom &&
      this.bottom >= other.top
    );
  }

  expanded(by) {
    return new Rect(this.x - by, this.y - by, this.width + by * 2, this.height + by * 2);
  }
}
