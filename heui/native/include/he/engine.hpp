// HeUi — the engine: subsystem ownership and the frame loop.
#pragma once

#include "he/audio.hpp"
#include "he/input.hpp"
#include "he/physics2d.hpp"
#include "he/platform.hpp"
#include "he/renderer.hpp"
#include "he/resource.hpp"
#include "he/scene.hpp"

#include <memory>
#include <string>

namespace he {

struct EngineConfig {
  Vec2 windowSize{1280.0f, 720.0f};
  f32 fixedStep = 1.0f / 60.0f;
  f32 maxFrameTime = 0.25f;   // clamp for backgrounded apps
  bool enablePhysics = true;
  bool enableAudio = true;
};

/// Owns every subsystem. One engine per process.
class Engine {
 public:
  Engine();
  ~Engine();

  bool init(const EngineConfig& config);
  void shutdown();

  /// Runs one frame: input, fixed steps, variable step, render, audio.
  void frame(f32 deltaSeconds);

  /// Runs until `stop()` is called. Used by the desktop preview.
  void run();

  void stop() { running_ = false; }
  bool running() const { return running_; }

  Platform* platform() { return platform_; }
  Renderer& renderer() { return *renderer_; }
  ResourceCache& resources() { return *resources_; }
  PhysicsWorld& physics() { return *physics_; }
  AudioSystem& audio() { return *audio_; }
  InputState& input() { return input_; }
  Scene& activeScene() { return *scene_; }
  void setActiveScene(std::unique_ptr<Scene> scene);

  /// Posts a named event to the host (e.g. "app.paused").
  void postEvent(const std::string& name, const std::string& payload);

  u32 frameCount() const { return frameCount_; }
  f32 fps() const { return fps_; }

 private:
  EngineConfig config_;
  Platform* platform_ = nullptr;
  std::unique_ptr<Renderer> renderer_;
  std::unique_ptr<ResourceCache> resources_;
  std::unique_ptr<PhysicsWorld> physics_;
  std::unique_ptr<AudioSystem> audio_;
  std::unique_ptr<Scene> scene_;
  InputState input_;

  bool running_ = false;
  bool initialized_ = false;
  u32 frameCount_ = 0;
  f32 accumulator_ = 0.0f;
  f32 fps_ = 0.0f;
  double lastTime_ = 0.0;
};

}  // namespace he
