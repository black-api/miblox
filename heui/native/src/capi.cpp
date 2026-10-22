// HeUi — C ABI implementation.
#include "he/capi.h"

#include "he/audio.hpp"
#include "he/engine.hpp"
#include "he/input.hpp"
#include "he/log.hpp"
#include "he/physics2d.hpp"
#include "he/resource.hpp"
#include "he/scene.hpp"

#include <memory>
#include <string>
#include <vector>

namespace {

std::unique_ptr<he::Engine> g_engine;
std::string g_temp;

/// Nodes created through the C ABI are tracked here so a handle can be mapped
/// back to a node and so a child can be attached to the right parent.
std::vector<he::Node*> g_nodes;

he::Node* nodeFor(he_Handle handle) {
  if (handle == he::kInvalidHandle || handle > g_nodes.size()) return nullptr;
  return g_nodes[handle - 1];
}

}  // namespace

extern "C" {

int he_abi_version(void) { return HE_ABI_VERSION; }

const char* he_version(void) { return HE_VERSION_STRING; }

int he_init(int width, int height) {
  if (g_engine) return 1;
  g_engine = std::make_unique<he::Engine>();
  he::EngineConfig config;
  config.windowSize = {static_cast<he::f32>(width), static_cast<he::f32>(height)};
  return g_engine->init(config) ? 1 : 0;
}

void he_shutdown(void) { g_engine.reset(); }

void he_frame(double deltaSeconds) {
  if (g_engine) g_engine->frame(static_cast<he::f32>(deltaSeconds));
}

void he_set_active_scene(const char* name) {
  if (!g_engine) return;
  g_engine->setActiveScene(std::make_unique<he::Scene>(name ? name : "scene"));
}

he_Handle he_node_create(he_Handle parent, const char* name) {
  if (!g_engine) return he::kInvalidHandle;
  he::Scene& scene = g_engine->activeScene();
  he::Node* parentNode = parent == he::kInvalidHandle ? &scene.root() : nodeFor(parent);
  if (!parentNode) return he::kInvalidHandle;
  he::Node* node = parentNode->createChild(name ? name : "node");
  g_nodes.push_back(node);
  return static_cast<he_Handle>(g_nodes.size());
}

void he_node_destroy(he_Handle node) {
  if (!g_engine) return;
  he::Node* n = nodeFor(node);
  if (n) n->destroy();
}

void he_node_set_position(he_Handle node, float x, float y) {
  if (he::Node* n = nodeFor(node)) n->setPosition({x, y});
}

void he_node_set_rotation(he_Handle node, float radians) {
  if (he::Node* n = nodeFor(node)) n->setRotation(radians);
}

void he_node_set_scale(he_Handle node, float x, float y) {
  if (he::Node* n = nodeFor(node)) n->setScale({x, y});
}

void he_node_set_visible(he_Handle node, int visible) {
  if (he::Node* n = nodeFor(node)) n->setVisible(visible != 0);
}

void he_node_get_world_position(he_Handle node, float* outX, float* outY) {
  he::Node* n = nodeFor(node);
  if (!n) return;
  const he::Vec2 p = n->worldPosition();
  if (outX) *outX = p.x;
  if (outY) *outY = p.y;
}

he_Handle he_body_create(float x, float y, float halfWidth, float halfHeight,
                         int isStatic) {
  if (!g_engine) return he::kInvalidHandle;
  he::Body body;
  body.position = {x, y};
  body.size = {halfWidth * 2.0f, halfHeight * 2.0f};
  body.type = isStatic ? he::BodyType::Static : he::BodyType::Dynamic;
  return g_engine->physics().addBody(body);
}

void he_body_set_velocity(he_Handle body, float vx, float vy) {
  if (!g_engine) return;
  if (he::Body* b = g_engine->physics().body(body)) b->velocity = {vx, vy};
}

void he_body_set_gravity(he_Handle body, int enabled) {
  if (!g_engine) return;
  if (he::Body* b = g_engine->physics().body(body)) b->gravity = enabled != 0;
}

void he_physics_step(float dt) {
  if (g_engine) g_engine->physics().step(dt);
}

int he_physics_contact_count(void) {
  return g_engine ? static_cast<int>(g_engine->physics().contacts().size()) : 0;
}

int he_physics_contact(he_Handle* outA, he_Handle* outB, float* outNx, float* outNy,
                       float* outDepth) {
  if (!g_engine) return 0;
  const auto& contacts = g_engine->physics().contacts();
  if (contacts.empty()) return 0;
  const auto& c = contacts.front();
  if (outA) *outA = c.a;
  if (outB) *outB = c.b;
  if (outNx) *outNx = c.normal.x;
  if (outNy) *outNy = c.normal.y;
  if (outDepth) *outDepth = c.penetration;
  return 1;
}

int he_input_pointer_count(void) {
  return g_engine ? static_cast<int>(g_engine->input().pointers().size()) : 0;
}

int he_input_pointer(int index, float* outX, float* outY, float* outPressure) {
  if (!g_engine) return 0;
  const auto& pointers = g_engine->input().pointers();
  if (index < 0 || index >= static_cast<int>(pointers.size())) return 0;
  const auto& p = pointers[static_cast<size_t>(index)];
  if (outX) *outX = p.position.x;
  if (outY) *outY = p.position.y;
  if (outPressure) *outPressure = p.pressure;
  return 1;
}

int he_input_key_down(int keyCode) {
  if (!g_engine) return 0;
  return g_engine->input().keyDown(static_cast<he::KeyCode>(keyCode)) ? 1 : 0;
}

int he_input_key_pressed(int keyCode) {
  if (!g_engine) return 0;
  return g_engine->input().keyPressed(static_cast<he::KeyCode>(keyCode)) ? 1 : 0;
}

he_Handle he_resource_load_texture(const char* path) {
  if (!g_engine || !path) return he::kInvalidHandle;
  return g_engine->resources().loadTexture(path);
}

he_Handle he_resource_load_atlas(const char* path) {
  if (!g_engine || !path) return he::kInvalidHandle;
  return g_engine->resources().loadAtlas(path);
}

int he_resource_region(const char* atlasPath, const char* regionName, float* outU,
                       float* outV, float* outW, float* outH) {
  if (!g_engine || !atlasPath || !regionName) return 0;
  const he::TextureRegion* region =
      g_engine->resources().regionByPath(atlasPath, regionName);
  if (!region) return 0;
  if (outU) *outU = region->rect.origin.x;
  if (outV) *outV = region->rect.origin.y;
  if (outW) *outW = region->rect.size.x;
  if (outH) *outH = region->rect.size.y;
  return 1;
}

void he_resource_purge_gpu(void) {
  if (g_engine) g_engine->resources().purgeGpuResources();
}

he_Handle he_audio_load_clip(const char* path, int looping) {
  if (!g_engine || !path) return he::kInvalidHandle;
  return g_engine->audio().loadClip(path, looping != 0);
}

he_Handle he_audio_create_player(he_Handle clip) {
  if (!g_engine) return he::kInvalidHandle;
  return g_engine->audio().createPlayer(clip);
}

void he_audio_play(he_Handle player) {
  if (g_engine) g_engine->audio().play(player);
}

void he_audio_stop(he_Handle player) {
  if (g_engine) g_engine->audio().stop(player);
}

void he_audio_set_volume(he_Handle player, float volume) {
  if (g_engine) g_engine->audio().setVolume(player, volume);
}

void he_log(int level, const char* tag, const char* message) {
  he::logMessage(static_cast<he::LogLevel>(level), tag ? tag : "he",
                 message ? message : "");
}

void he_vibrate(float seconds) {
  if (g_engine && g_engine->platform()) g_engine->platform()->vibrate(seconds);
}

void he_post_event(const char* name, const char* payload) {
  if (g_engine) g_engine->postEvent(name ? name : "", payload ? payload : "");
}

}  // extern "C"
