// HeUi — 2D physics.
#include "he/physics2d.hpp"

#include <algorithm>
#include <cmath>

namespace he {

Handle PhysicsWorld::addBody(const Body& body) {
  Entry entry;
  entry.body = body;
  entry.body.id = nextId_++;
  entry.bounds = Rect(body.position.x - body.size.x * 0.5f,
                      body.position.y - body.size.y * 0.5f,
                      body.size.x, body.size.y);
  entries_.push_back(entry);
  return entry.body.id;
}

void PhysicsWorld::removeBody(Handle id) {
  for (auto& e : entries_) {
    if (e.body.id == id) {
      e.alive = false;
      break;
    }
  }
  entries_.erase(std::remove_if(entries_.begin(), entries_.end(),
                                [](const Entry& e) { return !e.alive; }),
                 entries_.end());
}

Body* PhysicsWorld::body(Handle id) {
  for (auto& e : entries_) {
    if (e.body.id == id) return &e.body;
  }
  return nullptr;
}

const Body* PhysicsWorld::body(Handle id) const {
  for (const auto& e : entries_) {
    if (e.body.id == id) return &e.body;
  }
  return nullptr;
}

void PhysicsWorld::integrate(Entry& e, f32 dt) {
  Body& b = e.body;
  if (b.type == BodyType::Static || b.sleeping) return;
  if (b.gravity) b.velocity += gravity_ * dt;
  b.position += b.velocity * dt;
  e.bounds = Rect(b.position.x - b.size.x * 0.5f, b.position.y - b.size.y * 0.5f,
                  b.size.x, b.size.y);
}

bool PhysicsWorld::overlapping(const Entry& a, const Entry& b) const {
  if (a.body.group != 0 && a.body.group == b.body.group) return false;
  return a.bounds.intersects(b.bounds);
}

void PhysicsWorld::resolve(Entry& a, Entry& b) {
  Body& ba = a.body;
  Body& bb = b.body;
  if (ba.type == BodyType::Static && bb.type == BodyType::Static) return;

  // Axis of least penetration.
  const f32 centerAX = (a.bounds.maxX() + a.bounds.minX()) * 0.5f;
  const f32 centerAY = (a.bounds.maxY() + a.bounds.minY()) * 0.5f;
  const f32 centerBX = (b.bounds.maxX() + b.bounds.minX()) * 0.5f;
  const f32 centerBY = (b.bounds.maxY() + b.bounds.minY()) * 0.5f;
  const f32 distX = centerBX - centerAX;
  const f32 distY = centerBY - centerAY;
  const f32 penX = (a.bounds.size.x + b.bounds.size.x) * 0.5f - std::fabs(distX);
  const f32 penY = (a.bounds.size.y + b.bounds.size.y) * 0.5f - std::fabs(distY);

  // The normal points from A towards B.
  Vec2 normal{0, 0};
  f32 penetration = 0.0f;
  if (penX < penY) {
    normal = {distX >= 0.0f ? 1.0f : -1.0f, 0.0f};
    penetration = penX;
  } else {
    normal = {0.0f, distY >= 0.0f ? 1.0f : -1.0f};
    penetration = penY;
  }

  const bool aStatic = ba.type == BodyType::Static;
  const bool bStatic = bb.type == BodyType::Static;
  const f32 totalInvMass =
      (aStatic ? 0.0f : 1.0f / std::max(ba.size.x * ba.size.y, 1e-3f)) +
      (bStatic ? 0.0f : 1.0f / std::max(bb.size.x * bb.size.y, 1e-3f));
  if (totalInvMass <= 0.0f) return;

  const f32 aInvMass = aStatic ? 0.0f : 1.0f / std::max(ba.size.x * ba.size.y, 1e-3f);
  const f32 bInvMass = bStatic ? 0.0f : 1.0f / std::max(bb.size.x * bb.size.y, 1e-3f);

  // Positional correction: each body moves by its share of the overlap.
  ba.position -= normal * (penetration * (aInvMass / totalInvMass));
  bb.position += normal * (penetration * (bInvMass / totalInvMass));

  // Velocity response.
  const f32 relative = (bb.velocity - ba.velocity).dot(normal);
  if (relative < 0.0f) {
    const f32 restitution = std::min(ba.restitution, bb.restitution);
    const f32 impulse = -(1.0f + restitution) * relative / totalInvMass;
    ba.velocity -= normal * (impulse * aInvMass);
    bb.velocity += normal * (impulse * bInvMass);
  }

  a.bounds = Rect(ba.position.x - ba.size.x * 0.5f, ba.position.y - ba.size.y * 0.5f,
                  ba.size.x, ba.size.y);
  b.bounds = Rect(bb.position.x - bb.size.x * 0.5f, bb.position.y - bb.size.y * 0.5f,
                  bb.size.x, bb.size.y);

  Contact contact;
  contact.a = ba.id;
  contact.b = bb.id;
  contact.normal = normal;
  contact.penetration = penetration;
  contacts_.push_back(contact);
}

void PhysicsWorld::step(f32 dt) {
  contacts_.clear();
  for (auto& e : entries_) integrate(e, dt);

  // Broadphase: O(n^2) for now; a uniform grid replaces this when the body
  // count justifies it.
  for (size_t i = 0; i < entries_.size(); ++i) {
    for (size_t j = i + 1; j < entries_.size(); ++j) {
      if (overlapping(entries_[i], entries_[j])) {
        resolve(entries_[i], entries_[j]);
      }
    }
  }
}

void PhysicsWorld::stepReal(f32 elapsed, int maxSteps) {
  f32 remaining = elapsed;
  int steps = 0;
  while (remaining >= fixedStep_ && steps < maxSteps) {
    step(fixedStep_);
    remaining -= fixedStep_;
    ++steps;
  }
}

std::vector<Handle> PhysicsWorld::query(const Rect& area) const {
  std::vector<Handle> result;
  for (const auto& e : entries_) {
    if (e.bounds.intersects(area)) result.push_back(e.body.id);
  }
  return result;
}

Handle raycast(const PhysicsWorld& world, const Vec2& from, const Vec2& to) {
  const Rect area(std::min(from.x, to.x), std::min(from.y, to.y),
                  std::fabs(to.x - from.x), std::fabs(to.y - from.y));
  Handle best = kInvalidHandle;
  f32 bestT = 2.0f;
  const Vec2 dir = to - from;
  for (Handle id : world.query(area)) {
    const Body* b = world.body(id);
    if (!b) continue;
    // Slab method against the AABB.
    f32 tmin = 0.0f, tmax = 1.0f;
    bool hit = true;
    for (int axis = 0; axis < 2 && hit; ++axis) {
      const f32 d = axis == 0 ? dir.x : dir.y;
      const f32 o = axis == 0 ? from.x : from.y;
      const f32 lo = axis == 0 ? b->position.x - b->size.x * 0.5f
                               : b->position.y - b->size.y * 0.5f;
      const f32 hi = axis == 0 ? b->position.x + b->size.x * 0.5f
                               : b->position.y + b->size.y * 0.5f;
      if (std::fabs(d) < 1e-6f) {
        if (o < lo || o > hi) hit = false;
        continue;
      }
      f32 t1 = (lo - o) / d;
      f32 t2 = (hi - o) / d;
      if (t1 > t2) std::swap(t1, t2);
      tmin = std::max(tmin, t1);
      tmax = std::min(tmax, t2);
      if (tmin > tmax) hit = false;
    }
    if (hit && tmin < bestT) {
      bestT = tmin;
      best = id;
    }
  }
  return best;
}

}  // namespace he
