// HeUi — input: touch, pointer, keyboard, gyroscope.
#pragma once

#include "he/he.hpp"
#include "he/math.hpp"

#include <string>
#include <unordered_map>
#include <vector>

namespace he {

enum class PointerPhase { Down, Moved, Up, Canceled };

struct Pointer {
  i32 id = 0;
  PointerPhase phase = PointerPhase::Down;
  Vec2 position{0.0f, 0.0f};
  Vec2 delta{0.0f, 0.0f};
  f32 pressure = 1.0f;
};

enum class KeyCode { Unknown = 0, A, B, C, D, W, Space, Escape, Enter, Left, Right, Up, Down, Count };

struct Vec3f {
  f32 x = 0, y = 0, z = 0;
};

class InputState {
 public:
  void beginFrame();

  void addPointer(i32 id, PointerPhase phase, const Vec2& position);
  void movePointer(i32 id, const Vec2& position);
  void endPointer(i32 id, PointerPhase phase);
  void clearPointers();

  void setKey(KeyCode key, bool down);
  bool keyDown(KeyCode key) const;
  bool keyPressed(KeyCode key) const;   // pressed this frame
  bool keyReleased(KeyCode key) const;  // released this frame

  void setGyroscope(f32 x, f32 y, f32 z) { gyro_ = {x, y, z}; }
  const Vec3f& gyroscope() const { return gyro_; }
  Vec3f gyro_;

  const std::vector<Pointer>& pointers() const { return pointers_; }
  const Pointer* primaryPointer() const;

  /// Named actions mapped to keys/pointers by the project settings.
  void bindAction(const std::string& action, KeyCode key);
  bool actionDown(const std::string& action) const;
  bool actionPressed(const std::string& action) const;

 private:
  std::vector<Pointer> pointers_;
  std::unordered_map<int, bool> keys_;
  std::unordered_map<int, bool> keysPrev_;
  std::unordered_map<std::string, int> actionKeys_;
};

}  // namespace he
