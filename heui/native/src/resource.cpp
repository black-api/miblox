// HeUi — resource cache.
#include "he/resource.hpp"

#include "he/log.hpp"
#include "he/platform.hpp"

#include <cstring>
#include <sstream>

namespace he {
namespace {

/// Minimal JSON reader for atlas files. The project format is fixed and
/// simple, so a full parser would be overkill.
std::string readWholeFile(Platform* platform, const std::string& path) {
  std::string text;
  if (!platform->readAsset(path, text)) return {};
  return text;
}

bool findNumber(const std::string& text, const std::string& key, float& out) {
  const std::string needle = "\"" + key + "\"";
  auto pos = text.find(needle);
  if (pos == std::string::npos) return false;
  pos = text.find(':', pos);
  if (pos == std::string::npos) return false;
  ++pos;
  while (pos < text.size() && (text[pos] == ' ' || text[pos] == '\t')) ++pos;
  try {
    out = std::stof(text.substr(pos));
  } catch (...) {
    return false;
  }
  return true;
}

bool findString(const std::string& text, const std::string& key, std::string& out) {
  const std::string needle = "\"" + key + "\"";
  auto pos = text.find(needle);
  if (pos == std::string::npos) return false;
  pos = text.find(':', pos);
  if (pos == std::string::npos) return false;
  pos = text.find('"', pos + 1);
  if (pos == std::string::npos) return false;
  const auto end = text.find('"', pos + 1);
  if (end == std::string::npos) return false;
  out = text.substr(pos + 1, end - pos - 1);
  return true;
}

}  // namespace

const Buffer* ResourceCache::loadBuffer(const std::string& path) {
  auto it = buffers_.find(path);
  if (it != buffers_.end()) return &it->second;

  Buffer buffer;
  if (!platform_->readBinary(path, buffer.data)) {
    logWarn("cannot read asset " + path);
    return nullptr;
  }
  auto [inserted, ok] = buffers_.emplace(path, std::move(buffer));
  return ok ? &inserted->second : nullptr;
}

Handle ResourceCache::loadTexture(const std::string& path) {
  auto it = textures_.find(path);
  if (it != textures_.end()) return it->second.id;

  const Buffer* buffer = loadBuffer(path);
  if (!buffer) return kInvalidHandle;

  Texture texture;
  texture.id = nextHandle_++;
  texture.hasAlpha = true;
  // Image decoding is delegated to the platform image loader; without one the
  // texture is a placeholder that still occupies a valid handle.
  textures_.emplace(path, texture);
  return texture.id;
}

Handle ResourceCache::loadAtlas(const std::string& path) {
  const std::string text = readWholeFile(platform_, path);
  if (text.empty()) {
    logWarn("cannot read atlas " + path);
    return kInvalidHandle;
  }

  Atlas atlas;
  atlas.texture = nextHandle_++;

  // Expected shape:
  // { "texture": "gems.png",
  //   "regions": { "ruby": {"x":0,"y":0,"w":32,"h":32}, ... } }
  std::string texturePath;
  if (!findString(text, "texture", texturePath)) texturePath = path + ".png";
  atlas.texture = loadTexture(texturePath);

  const std::string regionsKey = "\"regions\"";
  auto pos = text.find(regionsKey);
  if (pos != std::string::npos) {
    pos = text.find('{', pos);
    while (pos != std::string::npos) {
      const auto nameEnd = text.find('"', text.find(':', pos) + 1);
      if (nameEnd == std::string::npos) break;
      const auto nameStart = text.rfind('"', nameEnd);
      if (nameStart == std::string::npos) break;
      const std::string name = text.substr(nameStart + 1, nameEnd - nameStart - 1);

      const auto bodyStart = text.find('{', nameEnd);
      if (bodyStart == std::string::npos) break;
      const auto bodyEnd = text.find('}', bodyStart);
      const std::string body = text.substr(bodyStart, bodyEnd - bodyStart);

      TextureRegion region;
      region.texture = atlas.texture;
      float x = 0, y = 0, w = 0, h = 0;
      findNumber(body, "x", x);
      findNumber(body, "y", y);
      findNumber(body, "w", w);
      findNumber(body, "h", h);
      region.rect = Rect(x, y, w, h);
      atlas.regions.emplace(name, region);

      pos = text.find(',', bodyEnd);
      if (pos == std::string::npos) break;
    }
  }

  const Handle id = nextHandle_++;
  atlasPaths_[path] = id;
  atlases_.emplace(id, std::move(atlas));
  return id;
}

const TextureRegion* ResourceCache::regionByPath(const std::string& atlasPath,
                                                 const std::string& name) const {
  auto it = atlasPaths_.find(atlasPath);
  if (it == atlasPaths_.end()) return nullptr;
  return region(it->second, name);
}

const TextureRegion* ResourceCache::region(Handle atlas, const std::string& name) const {
  auto it = atlases_.find(atlas);
  if (it == atlases_.end()) return nullptr;
  auto region = it->second.regions.find(name);
  if (region == it->second.regions.end()) return nullptr;
  return &region->second;
}

void ResourceCache::purgeGpuResources() {
  // CPU-side copies survive so the renderer can re-upload after a context loss.
  logInfo("purging GPU resources; " + std::to_string(textures_.size()) +
          " textures will be re-uploaded");
}

void ResourceCache::clear() {
  buffers_.clear();
  textures_.clear();
  atlases_.clear();
}

}  // namespace he
