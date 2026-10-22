// HeUi — resources: bytes, textures, atlases, fonts.
#pragma once

#include "he/he.hpp"
#include "he/math.hpp"

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

namespace he {

class Platform;

/// A blob of bytes owned by the core.
struct Buffer {
  std::vector<u8> data;
  size_t size() const { return data.size(); }
};

/// A GPU-resident texture, or a CPU-side image description when no GPU is present.
struct Texture {
  Handle id = kInvalidHandle;
  i32 width = 0;
  i32 height = 0;
  bool hasAlpha = true;
  bool valid() const { return id != kInvalidHandle; }
};

/// A sub-rectangle of a texture (sprite sheet frame).
struct TextureRegion {
  Handle texture = kInvalidHandle;
  Rect rect;
  Vec2 pivot{0.5f, 0.5f};
  bool rotate = false;
};

/// An atlas: one texture plus named regions.
struct Atlas {
  Handle texture = kInvalidHandle;
  std::unordered_map<std::string, TextureRegion> regions;
};

class ResourceCache {
 public:
  explicit ResourceCache(Platform* platform) : platform_(platform) {}

  /// Loads raw bytes from the bundle. Results are cached by path.
  const Buffer* loadBuffer(const std::string& path);
  /// Loads an image and uploads it. Returns a handle (0 on failure).
  Handle loadTexture(const std::string& path);
  /// Loads a texture atlas description (JSON) referencing already-loaded textures.
  Handle loadAtlas(const std::string& path);
  const TextureRegion* region(Handle atlas, const std::string& name) const;
  /// Looks a region up by the atlas path, as used by the C ABI.
  const TextureRegion* regionByPath(const std::string& atlasPath,
                                    const std::string& name) const;

  /// Drops GPU resources but keeps the CPU-side copies, so the renderer can
  /// rebuild them after a GL context loss (common on MIUI after a background
  /// switch).
  void purgeGpuResources();
  void clear();

  size_t textureCount() const { return textures_.size(); }
  size_t atlasCount() const { return atlases_.size(); }

 private:
  Platform* platform_;
  std::unordered_map<std::string, Buffer> buffers_;
  std::unordered_map<std::string, Texture> textures_;
  std::unordered_map<Handle, Atlas> atlases_;
  std::unordered_map<std::string, Handle> atlasPaths_;
  Handle nextHandle_ = 1;
};

}  // namespace he
