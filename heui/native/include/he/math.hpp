// HeUi — 2D math primitives.
#pragma once

#include "he/he.hpp"

#include <cmath>

namespace he {

struct Vec2 {
  f32 x = 0.0f;
  f32 y = 0.0f;

  constexpr Vec2() = default;
  constexpr Vec2(f32 x_, f32 y_) : x(x_), y(y_) {}

  constexpr Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
  constexpr Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
  constexpr Vec2 operator*(f32 s) const { return {x * s, y * s}; }
  constexpr Vec2 operator/(f32 s) const { return {x / s, y / s}; }
  Vec2& operator+=(const Vec2& o) { x += o.x; y += o.y; return *this; }
  Vec2& operator-=(const Vec2& o) { x -= o.x; y -= o.y; return *this; }
  Vec2& operator*=(f32 s) { x *= s; y *= s; return *this; }

  bool operator==(const Vec2& o) const { return x == o.x && y == o.y; }
  bool operator!=(const Vec2& o) const { return !(*this == o); }

  f32 length() const { return std::sqrt(x * x + y * y); }
  f32 lengthSquared() const { return x * x + y * y; }
  f32 dot(const Vec2& o) const { return x * o.x + y * o.y; }
  f32 cross(const Vec2& o) const { return x * o.y - y * o.x; }
};

inline Vec2 operator*(f32 s, const Vec2& v) { return {v.x * s, v.y * s}; }

inline f32 length(const Vec2& v) { return v.length(); }
inline f32 distance(const Vec2& a, const Vec2& b) { return (a - b).length(); }

inline Vec2 normalize(const Vec2& v) {
  const f32 len = v.length();
  return len > 1e-6f ? v / len : Vec2{0.0f, 0.0f};
}

inline Vec2 lerp(const Vec2& a, const Vec2& b, f32 t) {
  return {a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t};
}

inline f32 dot(const Vec2& a, const Vec2& b) { return a.dot(b); }

/// 2D rotation, counter-clockwise, radians.
struct Mat3 {
  // Column-major: m[col * 3 + row].
  f32 m[9] = {1, 0, 0, 0, 1, 0, 0, 0, 1};

  static Mat3 identity() { return Mat3{}; }

  static Mat3 translation(const Vec2& t) {
    Mat3 r;
    r.m[6] = t.x;
    r.m[7] = t.y;
    return r;
  }

  static Mat3 scaling(const Vec2& s) {
    Mat3 r;
    r.m[0] = s.x;
    r.m[4] = s.y;
    return r;
  }

  static Mat3 rotation(f32 radians) {
    Mat3 r;
    const f32 c = std::cos(radians);
    const f32 s = std::sin(radians);
    // Column-major: m[0] = m00, m[1] = m10, m[3] = m01, m[4] = m11.
    r.m[0] = c;  r.m[1] = s;
    r.m[3] = -s; r.m[4] = c;
    return r;
  }

  Mat3 operator*(const Mat3& o) const {
    Mat3 r;
    for (int col = 0; col < 3; ++col) {
      for (int row = 0; row < 3; ++row) {
        f32 sum = 0.0f;
        for (int k = 0; k < 3; ++k) sum += m[k * 3 + row] * o.m[col * 3 + k];
        r.m[col * 3 + row] = sum;
      }
    }
    return r;
  }

  Vec2 transformPoint(const Vec2& p) const {
    return {m[0] * p.x + m[3] * p.y + m[6],
            m[1] * p.x + m[4] * p.y + m[7]};
  }

  Vec2 transformVector(const Vec2& v) const {
    return {m[0] * v.x + m[3] * v.y, m[1] * v.x + m[4] * v.y};
  }
};

/// 4-component vector, used for colours and screen-space rects.
struct Vec4 {
  f32 x = 0.0f;
  f32 y = 0.0f;
  f32 z = 0.0f;
  f32 w = 0.0f;

  constexpr Vec4() = default;
  constexpr Vec4(f32 x_, f32 y_, f32 z_, f32 w_) : x(x_), y(y_), z(z_), w(w_) {}
};

/// Axis-aligned rectangle described by its min corner and its size.
struct Rect {
  Vec2 origin{0.0f, 0.0f};
  Vec2 size{0.0f, 0.0f};

  constexpr Rect() = default;
  constexpr Rect(const Vec2& o, const Vec2& s) : origin(o), size(s) {}
  constexpr Rect(f32 x, f32 y, f32 w, f32 h) : origin(x, y), size(w, h) {}

  f32 minX() const { return origin.x; }
  f32 minY() const { return origin.y; }
  f32 maxX() const { return origin.x + size.x; }
  f32 maxY() const { return origin.y + size.y; }
  Vec2 center() const { return {origin.x + size.x * 0.5f, origin.y + size.y * 0.5f}; }

  bool contains(const Vec2& p) const {
    return p.x >= minX() && p.x <= maxX() && p.y >= minY() && p.y <= maxY();
  }

  bool intersects(const Rect& o) const {
    return minX() <= o.maxX() && maxX() >= o.minX() &&
           minY() <= o.maxY() && maxY() >= o.minY();
  }

  Rect expanded(f32 by) const {
    return {origin.x - by, origin.y - by, size.x + by * 2.0f, size.y + by * 2.0f};
  }
};

inline f32 clampf(f32 v, f32 lo, f32 hi) { return v < lo ? lo : (v > hi ? hi : v); }
inline f32 lerpf(f32 a, f32 b, f32 t) { return a + (b - a) * t; }
inline f32 radians(f32 degrees) { return degrees * 3.14159265358979323846f / 180.0f; }
inline f32 degrees(f32 rad) { return rad * 180.0f / 3.14159265358979323846f; }

/// Shortest signed angular difference, in radians, in (-pi, pi].
inline f32 angleDelta(f32 from, f32 to) {
  f32 d = std::fmod(to - from + 3.14159265358979323846f,
                    6.28318530717958647692f);
  if (d < 0.0f) d += 6.28318530717958647692f;
  return d - 3.14159265358979323846f;
}

}  // namespace he
