// HeUi — desktop platform backend (used by the dev preview and the tests).
#include "he/platform.hpp"

#include "he/log.hpp"

#include <chrono>
#include <cstdio>
#include <fstream>
#include <sstream>
#include <sys/stat.h>

namespace he {
namespace {

class DesktopPlatform : public Platform {
 public:
  bool readAsset(const std::string& path, std::string& out) override {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    std::ostringstream ss;
    ss << in.rdbuf();
    out = ss.str();
    return true;
  }

  bool readBinary(const std::string& path, std::vector<u8>& out) override {
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    out.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
    return true;
  }

  bool writeFile(const std::string& path, const void* data, size_t size) override {
    std::ofstream out(path, std::ios::binary);
    if (!out) return false;
    out.write(static_cast<const char*>(data), static_cast<std::streamsize>(size));
    return out.good();
  }

  bool exists(const std::string& path) override {
    struct stat st{};
    return ::stat(path.c_str(), &st) == 0;
  }

  double now() override {
    using clock = std::chrono::steady_clock;
    static const clock::time_point start = clock::now();
    return std::chrono::duration<double>(clock::now() - start).count();
  }

  double unixTime() override {
    using clock = std::chrono::system_clock;
    return std::chrono::duration<double>(clock::now().time_since_epoch()).count();
  }

  Vec2 displaySize() override { return {1280.0f, 720.0f}; }
  f32 displayScale() override { return 1.0f; }
  Vec4 safeArea() override { return {0, 0, 1280, 720}; }

  void log(LogLevel level, const std::string& tag, const std::string& text) override {
    logMessage(level, tag.c_str(), text);
  }

  void vibrate(f32 seconds) override {
    std::fprintf(stderr, "[he] vibrate %.2fs (no-op on desktop)\n", seconds);
  }

  void postEvent(const std::string& name, const std::string& payload) override {
    std::fprintf(stderr, "[he] event %s %s\n", name.c_str(), payload.c_str());
  }
};

}  // namespace

Platform* createPlatform() {
  static DesktopPlatform instance;
  return &instance;
}

}  // namespace he
