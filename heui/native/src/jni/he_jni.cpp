// HeUi — JNI bridge.
//
// The Android host (Java) calls into the C++ core through this file. The
// functions are deliberately thin: they forward to the stable C ABI so the
// JavaScript runtime, the Java host and any future tool all drive the same
// engine.

#include <jni.h>

#include <string>

#include "he/capi.h"
#include "he/engine.hpp"
#include "he/log.hpp"
#include "he/platform.hpp"

extern "C" {

JNIEXPORT jstring JNICALL
Java_dev_heui_HeNative_nativeVersion(JNIEnv* env, jobject) {
  return env->NewStringUTF(he_version());
}

JNIEXPORT jint JNICALL
Java_dev_heui_HeNative_nativeAbiVersion(JNIEnv*, jobject) {
  return he_abi_version();
}

JNIEXPORT jint JNICALL
Java_dev_heui_HeNative_nativeInit(JNIEnv*, jobject, jint width, jint height) {
  return he_init(width, height) ? 1 : 0;
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativeShutdown(JNIEnv*, jobject) {
  he_shutdown();
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativeFrame(JNIEnv*, jobject, jdouble delta) {
  he_frame(delta);
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativeLog(JNIEnv* env, jobject, jint level, jstring tag,
                                 jstring message) {
  const char* tagChars = tag ? env->GetStringUTFChars(tag, nullptr) : "he";
  const char* messageChars = message ? env->GetStringUTFChars(message, nullptr) : "";
  he_log(level, tagChars, messageChars);
  if (tag) env->ReleaseStringUTFChars(tag, tagChars);
  if (message) env->ReleaseStringUTFChars(message, messageChars);
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativePostEvent(JNIEnv* env, jobject, jstring name,
                                       jstring payload) {
  const char* nameChars = name ? env->GetStringUTFChars(name, nullptr) : "";
  const char* payloadChars = payload ? env->GetStringUTFChars(payload, nullptr) : "";
  he_post_event(nameChars, payloadChars);
  if (name) env->ReleaseStringUTFChars(name, nameChars);
  if (payload) env->ReleaseStringUTFChars(payload, payloadChars);
}

JNIEXPORT jint JNICALL
Java_dev_heui_HeNative_nativeNodeCreate(JNIEnv* env, jobject, jstring name) {
  const char* nameChars = name ? env->GetStringUTFChars(name, nullptr) : "node";
  const he_Handle handle = he_node_create(he::kInvalidHandle, nameChars);
  if (name) env->ReleaseStringUTFChars(name, nameChars);
  return static_cast<jint>(handle);
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativeNodeSetPosition(JNIEnv*, jobject, jint node, jfloat x,
                                             jfloat y) {
  he_node_set_position(static_cast<he_Handle>(node), x, y);
}

JNIEXPORT void JNICALL
Java_dev_heui_HeNative_nativePhysicsStep(JNIEnv*, jobject, jfloat dt) {
  he_physics_step(dt);
}

JNIEXPORT jint JNICALL
Java_dev_heui_HeNative_nativePhysicsContactCount(JNIEnv*, jobject) {
  return he_physics_contact_count();
}

}  // extern "C"
