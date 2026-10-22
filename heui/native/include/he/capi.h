/*
 * HeUi — stable C ABI.
 *
 * Everything the JavaScript runtime (or any other host) may call goes through
 * this header. The ABI is versioned: HE_ABI_VERSION must match between the
 * host and libhe.so, otherwise the host refuses to start.
 */
#ifndef HE_CAPI_H
#define HE_CAPI_H

#include <stdint.h>

#ifdef __cplusplus
#  include "he/he.hpp"
typedef he::Handle he_Handle;
extern "C" {
#else
typedef uint32_t he_Handle;
#endif

#define HE_ABI_VERSION 1

/* ---- lifecycle ---- */
int he_abi_version(void);
int he_init(int width, int height);
void he_shutdown(void);
void he_frame(double deltaSeconds);
void he_set_active_scene(const char* name);

/* ---- scene ---- */
he_Handle he_node_create(he_Handle parent, const char* name);
void he_node_destroy(he_Handle node);
void he_node_set_position(he_Handle node, float x, float y);
void he_node_set_rotation(he_Handle node, float radians);
void he_node_set_scale(he_Handle node, float x, float y);
void he_node_set_visible(he_Handle node, int visible);
void he_node_get_world_position(he_Handle node, float* outX, float* outY);

/* ---- physics ---- */
he_Handle he_body_create(float x, float y, float halfWidth, float halfHeight, int isStatic);
void he_body_set_velocity(he_Handle body, float vx, float vy);
void he_body_set_gravity(he_Handle body, int enabled);
void he_physics_step(float dt);
int he_physics_contact_count(void);
int he_physics_contact(he_Handle* outA, he_Handle* outB, float* outNx, float* outNy, float* outDepth);

/* ---- input ---- */
int he_input_pointer_count(void);
int he_input_pointer(int index, float* outX, float* outY, float* outPressure);
int he_input_key_down(int keyCode);
int he_input_key_pressed(int keyCode);

/* ---- resources ---- */
he_Handle he_resource_load_texture(const char* path);
he_Handle he_resource_load_atlas(const char* path);
int he_resource_region(const char* atlasPath, const char* regionName,
                       float* outU, float* outV, float* outW, float* outH);
void he_resource_purge_gpu(void);

/* ---- audio ---- */
he_Handle he_audio_load_clip(const char* path, int looping);
he_Handle he_audio_create_player(he_Handle clip);
void he_audio_play(he_Handle player);
void he_audio_stop(he_Handle player);
void he_audio_set_volume(he_Handle player, float volume);

/* ---- misc ---- */
const char* he_version(void);
void he_log(int level, const char* tag, const char* message);
void he_vibrate(float seconds);
void he_post_event(const char* name, const char* payload);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* HE_CAPI_H */
