// HeUi — engine loop and subsystem ownership.
#include "he/engine.hpp"

#include "he/log.hpp"

#include <algorithm>

namespace he {

Engine::Engine() = default;

Engine::~Engine() { shutdown(); }

bool Engine::init(const EngineConfig& config) {
  if (initialized_) return true;
  config_ = config;

  platform_ = createPlatform();
  if (!platform_) {
    logError("no platform backend available");
    return false;
  }

  resources_ = std::make_unique<ResourceCache>(platform_);
  renderer_ = std::make_unique<Renderer>(createRenderBackend());
  physics_ = std::make_unique<PhysicsWorld>(config.fixedStep);
  audio_ = std::make_unique<AudioSystem>(platform_);
  scene_ = std::make_unique<Scene>("main");

  lastTime_ = platform_->now();
  initialized_ = true;
  running_ = true;
  logInfo("engine initialised (core " HE_VERSION_STRING ")");
  return true;
}

void Engine::shutdown() {
  if (!initialized_) return;
  scene_.reset();
  audio_.reset();
  physics_.reset();
  renderer_.reset();
  resources_.reset();
  platform_ = nullptr;
  initialized_ = false;
  running_ = false;
}

void Engine::setActiveScene(std::unique_ptr<Scene> scene) {
  if (scene_) scene_->onExit();
  scene_ = std::move(scene);
  if (scene_) scene_->onEnter();
}

void Engine::postEvent(const std::string& name, const std::string& payload) {
  if (platform_) platform_->postEvent(name, payload);
  if (name == "app.paused" && audio_) audio_->suspend();
  if (name == "app.resumed" && audio_) audio_->resume();
  if (name == "gl.contextLost" && resources_) resources_->purgeGpuResources();
}

void Engine::frame(f32 deltaSeconds) {
  if (!initialized_) return;

  // Clamp: after a long pause (MIUI backgrounding) the first frame must not
  // simulate minutes of physics in one go.
  deltaSeconds = std::min(deltaSeconds, config_.maxFrameTime);

  input_.beginFrame();

  if (config_.enablePhysics) {
    accumulator_ += deltaSeconds;
    int steps = 0;
    while (accumulator_ >= config_.fixedStep && steps < 5) {
      physics_->step(config_.fixedStep);
      accumulator_ -= config_.fixedStep;
      ++steps;
    }
  }

  if (scene_) scene_->update(deltaSeconds);

  renderer_->beginFrame(config_.windowSize);
  // Scene traversal fills the queue. The renderer draws in layer order.
  renderer_->endFrame();

  if (config_.enableAudio) audio_->mix(deltaSeconds);

  ++frameCount_;
  if (frameCount_ % 30 == 0) {
    const double now = platform_->now();
    if (now > lastTime_) fps_ = 30.0f / static_cast<f32>(now - lastTime_);
    lastTime_ = now;
  }
}

void Engine::run() {
  while (running_) {
    const double now = platform_->now();
    const f32 dt = static_cast<f32>(now - lastTime_);
    lastTime_ = now;
    frame(dt);
  }
}

}  // namespace he
