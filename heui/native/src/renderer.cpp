// HeUi — render queue and headless backend.
#include "he/renderer.hpp"

#include "he/log.hpp"

#include <algorithm>

namespace he {
namespace {

/// Records commands without touching a GPU. Used by the tests and by the
/// desktop preview when no GL context is available.
class HeadlessBackend : public RenderBackend {
 public:
  bool beginFrame(const Vec2& targetSize) override {
    size_ = targetSize;
    count_ = 0;
    return true;
  }

  void draw(const DrawCommand& cmd) override {
    ++count_;
    last_ = cmd;
  }

  void endFrame() override {}

  void invalidate() override {}

  const char* name() const override { return "headless"; }

  u32 drawn() const { return count_; }
  const DrawCommand& last() const { return last_; }

 private:
  Vec2 size_{0, 0};
  u32 count_ = 0;
  DrawCommand last_{};
};

}  // namespace

void Renderer::beginFrame(const Vec2& targetSize) {
  queue_.clear();
  stats_ = FrameStats{};
  if (backend_) backend_->beginFrame(targetSize);
}

void Renderer::submit(const DrawCommand& cmd) {
  queue_.push_back(cmd);
}

void Renderer::endFrame() {
  if (!backend_) return;
  // Stable ordering: layer first, then submission order.
  std::stable_sort(queue_.begin(), queue_.end(),
                   [](const DrawCommand& a, const DrawCommand& b) {
                     return a.layer < b.layer;
                   });
  for (const auto& cmd : queue_) {
    backend_->draw(cmd);
    ++stats_.drawCalls;
    if (cmd.kind == DrawKind::Sprite) ++stats_.sprites;
  }
  backend_->endFrame();
}

Handle Renderer::createTexture(const u8* rgba, i32 width, i32 height) {
  (void)rgba;
  (void)width;
  (void)height;
  const Handle handle = nextTexture_++;
  textures_.push_back(handle);
  return handle;
}

void Renderer::destroyTexture(Handle handle) {
  textures_.erase(std::remove(textures_.begin(), textures_.end(), handle),
                  textures_.end());
}

RenderBackend* createRenderBackend() {
  static HeadlessBackend instance;
  return &instance;
}

}  // namespace he
