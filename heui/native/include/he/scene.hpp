// HeUi — scene graph.
#pragma once

#include "he/he.hpp"
#include "he/math.hpp"

#include <functional>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace he {

class Scene;

/// A transform node with a local position, rotation, scale and children.
class Node {
 public:
  explicit Node(std::string name = "node");
  ~Node();

  Node(const Node&) = delete;
  Node& operator=(const Node&) = delete;

  const std::string& name() const { return name_; }
  void setName(std::string n) { name_ = std::move(n); }

  Node* parent() const { return parent_; }
  const std::vector<std::unique_ptr<Node>>& children() const { return children_; }

  Node* createChild(const std::string& name);
  Node* childByName(const std::string& name) const;
  void removeChild(Node* child);
  void destroy();

  // --- local transform ---
  const Vec2& position() const { return localPosition_; }
  void setPosition(const Vec2& p) { localPosition_ = p; dirty_ = true; }
  f32 rotation() const { return localRotation_; }
  void setRotation(f32 r) { localRotation_ = r; dirty_ = true; }
  const Vec2& scale() const { return localScale_; }
  void setScale(const Vec2& s) { localScale_ = s; dirty_ = true; }

  // --- world transform ---
  const Mat3& worldMatrix() const { return world_; }
  Vec2 worldPosition() const { return {world_.m[6], world_.m[7]}; }
  f32 worldRotation() const;
  Vec2 worldScale() const;

  /// Recomputes world matrices for this subtree. Called once per frame.
  void updateWorldTransform(const Mat3& parent);

  /// Marks the subtree dirty (called on hierarchy changes).
  void markDirty() { dirty_ = true; }

  bool visible() const { return visible_; }
  void setVisible(bool v) { visible_ = v; }

  int layer() const { return layer_; }
  void setLayer(int l) { layer_ = l; }

  Scene* scene() const { return scene_; }

  /// Data payload attached by scripts (opaque to the core).
  void* userData() const { return userData_; }
  void setUserData(void* data) { userData_ = data; }

  /// Ordered traversal used by the engine for update and render.
  void forEachDepthFirst(const std::function<void(Node*)>& fn);

 private:
  std::string name_;
  Node* parent_ = nullptr;
  Scene* scene_ = nullptr;
  std::vector<std::unique_ptr<Node>> children_;

  Vec2 localPosition_{0.0f, 0.0f};
  f32 localRotation_ = 0.0f;
  Vec2 localScale_{1.0f, 1.0f};

  Mat3 world_;
  bool dirty_ = true;
  bool visible_ = true;
  int layer_ = 0;
  void* userData_ = nullptr;
};

/// A scene owns a root node and the list of registered component scripts.
class Scene {
 public:
  explicit Scene(std::string name = "scene");
  ~Scene();

  const std::string& name() const { return name_; }
  Node& root() { return *root_; }
  const Node& root() const { return *root_; }

  void update(f32 dt);

  /// Called by the engine when the scene becomes active / inactive.
  void onEnter();
  void onExit();
  bool entered() const { return entered_; }

 private:
  std::string name_;
  std::unique_ptr<Node> root_;
  bool entered_ = false;
  f32 time_ = 0.0f;
};

}  // namespace he
