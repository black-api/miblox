#include "test_util.hpp"

#include "he/physics2d.hpp"

using namespace he;

int main() {
  PhysicsWorld world;

  // A dynamic body falls under gravity.
  Body falling;
  falling.position = {0, 10};
  falling.size = {1, 1};
  falling.gravity = true;
  const Handle a = world.addBody(falling);
  world.step(1.0f);
  const Body* body = world.body(a);
  HE_CHECK(body != nullptr);
  HE_CHECK(body->velocity.y < 0.0f);
  HE_CHECK(body->position.y < 10.0f);

  // Two overlapping bodies generate a contact and are pushed apart.
  PhysicsWorld contacts;
  Body left;
  left.position = {0, 0};
  left.size = {2, 2};
  const Handle l = contacts.addBody(left);
  Body right;
  right.position = {1, 0};
  right.size = {2, 2};
  const Handle r = contacts.addBody(right);
  contacts.step(1.0f / 60.0f);
  HE_CHECK(contacts.contacts().size() == 1);
  HE_CHECK(contacts.contacts()[0].a == l);
  HE_CHECK(contacts.contacts()[0].b == r);
  HE_CHECK(contacts.body(l)->position.x < 0.0f);
  HE_CHECK(contacts.body(r)->position.x > 1.0f);

  // A static body does not move.
  PhysicsWorld statics;
  Body ground;
  ground.position = {0, 0};
  ground.size = {4, 1};
  ground.type = BodyType::Static;
  const Handle g = statics.addBody(ground);
  statics.step(1.0f);
  HE_CHECK(statics.body(g)->position == Vec2(0, 0));

  // Ray casting finds the first body along the ray.
  PhysicsWorld rays;
  Body target;
  target.position = {5, 0};
  target.size = {1, 1};
  const Handle t = rays.addBody(target);
  HE_CHECK(raycast(rays, {0, 0}, {10, 0}) == t);
  HE_CHECK(raycast(rays, {0, 5}, {10, 5}) == kInvalidHandle);

  // Query returns overlapping bodies only.
  PhysicsWorld queries;
  Body inside;
  inside.position = {0, 0};
  inside.size = {1, 1};
  queries.addBody(inside);
  Body outside;
  outside.position = {100, 100};
  outside.size = {1, 1};
  queries.addBody(outside);
  HE_CHECK(queries.query(Rect(-5, -5, 10, 10)).size() == 1);

  // Bodies in the same group never collide.
  PhysicsWorld groups;
  Body g1; g1.position = {0, 0}; g1.size = {2, 2}; g1.group = 7;
  Body g2; g2.position = {1, 0}; g2.size = {2, 2}; g2.group = 7;
  groups.addBody(g1);
  groups.addBody(g2);
  groups.step(1.0f / 60.0f);
  HE_CHECK(groups.contacts().empty());

  return he_test::summary("physics");
}
