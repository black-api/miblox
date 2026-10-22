// HeUi — 2D physics: bodies, broadphase, resolution.
#pragma once

#include "he/he.hpp"
#include "he/math.hpp"

#include <vector>

namespace he {

enum class BodyShape { Box, Circle };

enum class BodyType { Static, Dynamic, Kinematic };

struct Body {
  Handle id = kInvalidHandle;
  BodyType type = BodyType::Dynamic;
  BodyShape shape = BodyShape::Box;
  Vec2 position{0.0f, 0.0f};
  Vec2 velocity{0.0f, 0.0f};
  Vec2 size{1.0f, 1.0f};      // box extents
  f32 radius = 0.5f;          // circle radius
  f32 friction = 0.2f;
  f32 restitution = 0.0f;
  bool gravity = true;
  bool sleeping = false;
  u32 group = 0;              // bodies in the same non-zero group never collide
};

struct Contact {
  Handle a = kInvalidHandle;
  Handle b = kInvalidHandle;
  Vec2 normal{0.0f, -1.0f};
  f32 penetration = 0.0f;
};

/// Deterministic fixed-step 2D physics world.
class PhysicsWorld {
 public:
  explicit PhysicsWorld(f32 fixedStep = 1.0f / 60.0f) : fixedStep_(fixedStep) {}

  Handle addBody(const Body& body);
  void removeBody(Handle id);
  Body* body(Handle id);
  const Body* body(Handle id) const;

  void setGravity(const Vec2& g) { gravity_ = g; }
  const Vec2& gravity() const { return gravity_; }

  /// Advances the simulation by one fixed step.
  void step(f32 dt);
  /// Advances by an accumulated real time, running as many fixed steps as fit.
  void stepReal(f32 elapsed, int maxSteps = 5);

  const std::vector<Contact>& contacts() const { return contacts_; }
  size_t bodyCount() const { return entries_.size(); }

  /// Broadphase query: bodies whose bounds overlap the rectangle.
  std::vector<Handle> query(const Rect& area) const;

 private:
  struct Entry {
    Body body;
    Rect bounds;
    bool alive = true;
  };

  std::vector<Entry> entries_;
  std::vector<Contact> contacts_;
  Vec2 gravity_{0.0f, -9.81f};
  f32 fixedStep_;
  Handle nextId_ = 1;

  void integrate(Entry& e, f32 dt);
  bool overlapping(const Entry& a, const Entry& b) const;
  void resolve(Entry& a, Entry& b);
};

/// Ray vs. body bounds. Returns the hit handle or 0.
Handle raycast(const PhysicsWorld& world, const Vec2& from, const Vec2& to);

}  // namespace he
