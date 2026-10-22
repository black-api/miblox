// HeUi — Android platform backend (assets via AAssetManager).
#include "he/platform.hpp"

#if defined(HE_ENABLE_ANDROID)

#include <android/asset_manager.h>
#include <android/log.h>
#include <sys/stat.h>

namespace he {
namespace {

class AndroidPlatform : public Platform {
 public:
  void attachAssetManager(AAssetManager* assets) { assets_ = assets; }

  bool readAsset(const std::string& path, std::string& out) override {
    std::vector<u8> bytes;
    if (!readBinary(path, bytes)) return false;
    out.assign(reinterpret_cast<const char*>(bytes.data()), bytes.size());
    return true;
  }

  bool readBinary(const std::string& path, std::vector<u8>& out) override {
    if (!assets_) return false;
    AAsset* asset = AAssetManager_open(assets_, path.c_str(), AASSET_MODE_BUFFER);
    if (!asset) return false;
    const off_t size = AAsset_getLength(asset);
    out.resize(static_cast<size_t>(size));
    const int read = AAsset_read(asset, out.data(), static_cast<size_t>(size));
    AAsset_close(asset);
    return read == size;
  }

  bool writeFile(const std::string& path, const void* data, size_t size) override {
    // The APK is read-only; the app writes to its private data dir instead.
    return Platform::writeFile(path, data, size);
  }

  bool exists(const std::string& path) override {
    if (!assets_) return false;
    AAsset* asset = AAssetManager_open(assets_, path.c_str(), AASSET_MODE_UNKNOWN);
    if (!asset) return false;
    AAsset_close(asset);
    return true;
  }

  double now() override {
    struct timespec ts{};
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return static_cast<double>(ts.tv_sec) + static_cast<double>(ts.tv_nsec) * 1e-9;
  }

  double unixTime() override {
    struct timespec ts{};
    clock_gettime(CLOCK_REALTIME, &ts);
    return static_cast<double>(ts.tv_sec) + static_cast<double>(ts.tv_nsec) * 1e-9;
  }

  Vec2 displaySize() override { return display_; }
  f32 displayScale() override { return scale_; }
  Vec4 safeArea() override { return safe_; }

  void setDisplay(const Vec2& size, f32 scale, const Vec4& safe) {
    display_ = size;
    scale_ = scale;
    safe_ = safe;
  }

  void log(LogLevel level, const std::string& tag, const std::string& text) override {
    int prio = ANDROID_LOG_INFO;
    switch (level) {
      case LogLevel::Trace: prio = ANDROID_LOG_VERBOSE; break;
      case LogLevel::Debug: prio = ANDROID_LOG_DEBUG; break;
      case LogLevel::Info:  prio = ANDROID_LOG_INFO; break;
      case LogLevel::Warn:  prio = ANDROID_LOG_WARN; break;
      case LogLevel::Error: prio = ANDROID_LOG_ERROR; break;
    }
    __android_log_print(prio, tag.c_str(), "%s", text.c_str());
  }

  void vibrate(f32 seconds) override {
    // Handled by the Java host (Vibrator); the native layer only reports intent.
    postEvent("haptic", std::to_string(seconds));
  }

  void postEvent(const std::string& name, const std::string& payload) override {
    __android_log_print(ANDROID_LOG_DEBUG, "he", "event %s %s", name.c_str(),
                        payload.c_str());
  }

 private:
  AAssetManager* assets_ = nullptr;
  Vec2 display_{1080.0f, 1920.0f};
  f32 scale_ = 2.75f;
  Vec4 safe_{0, 0, 1080, 1920};
};

}  // namespace

Platform* createPlatform() {
  static AndroidPlatform instance;
  return &instance;
}

}  // namespace he

#endif  // HE_ENABLE_ANDROID
