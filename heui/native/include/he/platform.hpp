// HeUi — platform abstraction (files, assets, time, display, lifecycle).
#pragma once

#include "he/he.hpp"
#include "he/log.hpp"
#include "he/math.hpp"

#include <functional>
#include <string>
#include <vector>

namespace he {

enum class LifecycleState { Created, Resumed, Paused, Stopped, Destroyed };

/// Host services the core needs. Implemented once per platform.
class Platform {
 public:
  virtual ~Platform() = default;

  /// Reads a file from the platform bundle (assets on Android, cwd on desktop).
  virtual bool readAsset(const std::string& path, std::string& out) = 0;
  virtual bool readBinary(const std::string& path, std::vector<u8>& out) = 0;
  virtual bool writeFile(const std::string& path, const void* data, size_t size) = 0;
  virtual bool exists(const std::string& path) = 0;

  /// Seconds since an arbitrary epoch, monotonic.
  virtual double now() = 0;
  /// Wall-clock time in seconds since the Unix epoch.
  virtual double unixTime() = 0;

  virtual Vec2 displaySize() = 0;
  virtual f32 displayScale() = 0;
  /// Safe-area insets (notches, gesture bars) in pixels.
  virtual Vec4 safeArea() = 0;

  virtual void log(LogLevel level, const std::string& tag, const std::string& text) = 0;
  virtual void vibrate(f32 seconds) = 0;

  /// Posted by the host when the app is paused/resumed or loses its GL context.
  virtual void postEvent(const std::string& name, const std::string& payload) = 0;

  /// Set by the host to receive lifecycle events.
  std::function<void(LifecycleState)> onLifecycle;
};

/// Creates the platform implementation compiled into this build.
Platform* createPlatform();

}  // namespace he
