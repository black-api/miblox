// HeUi — renderer: a command queue plus an optional GL backend.
#pragma once

#include "he/he.hpp"
#include "he/math.hpp"

#include <string>
#include <vector>

namespace he {

enum class BlendMode { None, Alpha, Additive };

enum class DrawKind { Quad, Sprite, Line, Points };

/// One draw command. The queue is built each frame and replayed by a backend.
struct DrawCommand {
  DrawKind kind = DrawKind::Quad;
  Handle texture = kInvalidHandle;
  Mat3 transform;
  Rect source;          // source rect in texture pixels (sprites)
  Vec2 size{1.0f, 1.0f};
  Vec4 color{1, 1, 1, 1};
  BlendMode blend = BlendMode::Alpha;
  f32 lineWidth = 1.0f;
  u32 layer = 0;
};

struct FrameStats {
  u32 drawCalls = 0;
  u32 sprites = 0;
  f32 cpuMs = 0.0f;
  f32 gpuMs = 0.0f;
};

/// Backend interface. A headless backend is used for tests and for the
/// desktop preview before a GL context exists.
class RenderBackend {
 public:
  virtual ~RenderBackend() = default;
  virtual bool beginFrame(const Vec2& targetSize) = 0;
  virtual void draw(const DrawCommand& cmd) = 0;
  virtual void endFrame() = 0;
  virtual void invalidate() = 0;  // GL context was lost — drop GPU objects
  virtual const char* name() const = 0;
};

/// The render queue. Scene traversal fills it; the backend consumes it.
class Renderer {
 public:
  explicit Renderer(RenderBackend* backend) : backend_(backend) {}

  void beginFrame(const Vec2& targetSize);
  void submit(const DrawCommand& cmd);
  void endFrame();

  const FrameStats& stats() const { return stats_; }
  RenderBackend* backend() const { return backend_; }
  void setBackend(RenderBackend* backend) { backend_ = backend; }

  /// Uploads a texture from raw RGBA8 pixels. Returns a handle.
  Handle createTexture(const u8* rgba, i32 width, i32 height);
  void destroyTexture(Handle handle);

 private:
  RenderBackend* backend_;
  std::vector<DrawCommand> queue_;
  FrameStats stats_{};
  Handle nextTexture_ = 1;
  std::vector<Handle> textures_;
};

/// Creates the backend compiled into this build (GL when enabled, else headless).
RenderBackend* createRenderBackend();

}  // namespace he
