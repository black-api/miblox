#include "test_util.hpp"

#include "he/math.hpp"

using namespace he;

int main() {
  // Vector basics.
  HE_CHECK(Vec2(3, 4).length() == 5.0f);
  HE_CHECK(Vec2(3, 4).lengthSquared() == 25.0f);
  HE_CHECK(dot(Vec2(1, 0), Vec2(0, 1)) == 0.0f);
  HE_CHECK(normalize(Vec2(0, 5)).length() == 1.0f);
  HE_CHECK(normalize(Vec2(0, 0)) == Vec2(0, 0));

  // Mat3: translation, then rotation of a local point.
  const Mat3 m = Mat3::translation({10, 20}) * Mat3::rotation(radians(90.0f));
  const Vec2 p = m.transformPoint({1, 0});
  HE_CHECK(std::fabs(p.x - 10.0f) < 1e-4f);
  HE_CHECK(std::fabs(p.y - 21.0f) < 1e-4f);

  // Rect intersection and containment.
  const Rect a(0, 0, 10, 10);
  const Rect b(5, 5, 10, 10);
  const Rect c(20, 20, 2, 2);
  HE_CHECK(a.intersects(b));
  HE_CHECK(!a.intersects(c));
  HE_CHECK(a.contains({5, 5}));
  HE_CHECK(!a.contains({15, 5}));
  HE_CHECK(a.maxX() == 10.0f);
  HE_CHECK(a.center() == Vec2(5, 5));

  // Angle helpers.
  HE_CHECK(std::fabs(angleDelta(0.0f, radians(90.0f)) - radians(90.0f)) < 1e-4f);
  HE_CHECK(std::fabs(angleDelta(radians(350.0f), radians(10.0f)) -
                     radians(20.0f)) < 1e-4f);
  HE_CHECK(clampf(5.0f, 0.0f, 1.0f) == 1.0f);
  HE_CHECK(lerpf(0.0f, 10.0f, 0.5f) == 5.0f);

  return he_test::summary("math");
}
