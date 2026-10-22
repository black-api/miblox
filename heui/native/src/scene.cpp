// HeUi — scene graph implementation.
#include "he/scene.hpp"

#include <algorithm>
#include <cmath>

namespace he {

Node::Node(std::string name) : name_(std::move(name)) { world_ = Mat3::identity(); }

Node::~Node() = default;

Node* Node::createChild(const std::string& name) {
  auto child = std::make_unique<Node>(name);
  Node* raw = child.get();
  raw->parent_ = this;
  raw->scene_ = scene_;
  children_.push_back(std::move(child));
  markDirty();
  return raw;
}

Node* Node::childByName(const std::string& name) const {
  for (const auto& child : children_) {
    if (child->name() == name) return child.get();
  }
  return nullptr;
}

void Node::removeChild(Node* child) {
  if (!child) return;
  auto it = std::find_if(children_.begin(), children_.end(),
                         [child](const std::unique_ptr<Node>& c) { return c.get() == child; });
  if (it == children_.end()) return;
  (*it)->parent_ = nullptr;
  children_.erase(it);
  markDirty();
}

void Node::destroy() {
  if (parent_) parent_->removeChild(this);
}

f32 Node::worldRotation() const {
  f32 angle = localRotation_;
  for (const Node* node = parent_; node; node = node->parent_) {
    angle += node->localRotation_;
  }
  return angle;
}

Vec2 Node::worldScale() const {
  Vec2 s = localScale_;
  for (const Node* node = parent_; node; node = node->parent_) {
    s.x *= node->localScale_.x;
    s.y *= node->localScale_.y;
  }
  return s;
}

void Node::updateWorldTransform(const Mat3& parent) {
  Mat3 local = Mat3::translation(localPosition_) * Mat3::rotation(localRotation_) *
               Mat3::scaling(localScale_);
  world_ = parent * local;
  for (auto& child : children_) {
    child->updateWorldTransform(world_);
  }
}

void Node::forEachDepthFirst(const std::function<void(Node*)>& fn) {
  fn(this);
  for (auto& child : children_) {
    child->forEachDepthFirst(fn);
  }
}

// ---------------------------------------------------------------- Scene ----

Scene::Scene(std::string name) : name_(std::move(name)) {
  root_ = std::make_unique<Node>("root");
}

Scene::~Scene() = default;

void Scene::onEnter() {
  if (entered_) return;
  entered_ = true;
  time_ = 0.0f;
}

void Scene::onExit() {
  entered_ = false;
}

void Scene::update(f32 dt) {
  time_ += dt;
  root_->updateWorldTransform(Mat3::identity());
}

}  // namespace he
