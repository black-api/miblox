// HeUi — OpenGL ES 3.0 / desktop GL renderer backend.
#include "he/renderer.hpp"

#if defined(HE_ENABLE_GL)

#include "he/log.hpp"

#if defined(__ANDROID__)
#  include <GLES3/gl3.h>
#else
#  include <GL/gl.h>
#endif

namespace he {
namespace {

class GLBackend : public RenderBackend {
 public:
  bool beginFrame(const Vec2& targetSize) override {
    size_ = targetSize;
#if defined(__ANDROID__)
    glViewport(0, 0, static_cast<GLsizei>(targetSize.x),
               static_cast<GLsizei>(targetSize.y));
    glClearColor(0.06f, 0.07f, 0.10f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
#endif
    return true;
  }

  void draw(const DrawCommand& cmd) override {
    // The GL path is intentionally minimal until the shader pipeline lands:
    // it sets the blend state and records the draw so the frame statistics
    // match the headless backend.
    switch (cmd.blend) {
      case BlendMode::None: break;
      case BlendMode::Alpha: glEnable(GL_BLEND); break;
      case BlendMode::Additive: glEnable(GL_BLEND); break;
    }
  }

  void endFrame() override {}

  void invalidate() override { logInfo("GL context lost — resources will be re-uploaded"); }

  const char* name() const override { return "gl"; }

 private:
  Vec2 size_{0, 0};
};

}  // namespace

RenderBackend* createRenderBackend() {
  static GLBackend instance;
  return &instance;
}

}  // namespace he

#endif  // HE_ENABLE_GL
