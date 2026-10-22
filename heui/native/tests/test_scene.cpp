#include "test_util.hpp"

#include "he/scene.hpp"

using namespace he;

int main() {
  Scene scene("test");

  Node* root = &scene.root();
  Node* player = root->createChild("player");
  Node* gem = player->createChild("gem");
  HE_CHECK(player->parent() == root);
  HE_CHECK(gem->parent() == player);
  HE_CHECK(root->childByName("player") == player);
  HE_CHECK(root->children().size() == 1);

  // World transforms compose down the tree.
  player->setPosition({100, 50});
  gem->setPosition({10, 0});
  root->updateWorldTransform(Mat3::identity());
  HE_CHECK(gem->worldPosition().x == 110.0f);
  HE_CHECK(gem->worldPosition().y == 50.0f);

  // Nested rotation adds up.
  player->setRotation(radians(90.0f));
  root->updateWorldTransform(Mat3::identity());
  HE_CHECK(std::fabs(gem->worldRotation() - radians(90.0f)) < 1e-4f);

  // Scale inherits.
  player->setScale({2, 3});
  root->updateWorldTransform(Mat3::identity());
  HE_CHECK(std::fabs(gem->worldScale().x - 2.0f) < 1e-4f);
  HE_CHECK(std::fabs(gem->worldScale().y - 3.0f) < 1e-4f);

  // Removal.
  player->removeChild(gem);
  HE_CHECK(player->children().empty());
  HE_CHECK(gem->parent() == nullptr);

  // Depth-first traversal visits children after their parent.
  int count = 0;
  root->forEachDepthFirst([&](Node*) { ++count; });
  HE_CHECK(count == 2);

  scene.onEnter();
  HE_CHECK(scene.entered());
  scene.update(1.0f / 60.0f);
  scene.onExit();
  HE_CHECK(!scene.entered());

  return he_test::summary("scene");
}
