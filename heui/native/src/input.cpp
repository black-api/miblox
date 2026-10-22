// HeUi — input state.
#include "he/input.hpp"

namespace he {

void InputState::beginFrame() {
  keysPrev_ = keys_;
}

void InputState::addPointer(i32 id, PointerPhase phase, const Vec2& position) {
  for (auto& p : pointers_) {
    if (p.id == id) {
      p.phase = phase;
      p.position = position;
      return;
    }
  }
  Pointer pointer;
  pointer.id = id;
  pointer.phase = phase;
  pointer.position = position;
  pointers_.push_back(pointer);
}

void InputState::movePointer(i32 id, const Vec2& position) {
  for (auto& p : pointers_) {
    if (p.id == id) {
      p.delta = position - p.position;
      p.position = position;
      p.phase = PointerPhase::Moved;
      return;
    }
  }
  addPointer(id, PointerPhase::Moved, position);
}

void InputState::endPointer(i32 id, PointerPhase phase) {
  for (auto& p : pointers_) {
    if (p.id == id) {
      p.phase = phase;
      p.delta = {0, 0};
      return;
    }
  }
}

void InputState::clearPointers() { pointers_.clear(); }

void InputState::setKey(KeyCode key, bool down) { keys_[static_cast<int>(key)] = down; }

bool InputState::keyDown(KeyCode key) const {
  auto it = keys_.find(static_cast<int>(key));
  return it != keys_.end() && it->second;
}

bool InputState::keyPressed(KeyCode key) const {
  const int k = static_cast<int>(key);
  const auto now = keys_.find(k);
  const auto prev = keysPrev_.find(k);
  const bool wasDown = prev != keysPrev_.end() && prev->second;
  return now != keys_.end() && now->second && !wasDown;
}

bool InputState::keyReleased(KeyCode key) const {
  const int k = static_cast<int>(key);
  const auto now = keys_.find(k);
  const auto prev = keysPrev_.find(k);
  const bool wasDown = prev != keysPrev_.end() && prev->second;
  return (now == keys_.end() || !now->second) && wasDown;
}

const Pointer* InputState::primaryPointer() const {
  return pointers_.empty() ? nullptr : &pointers_.front();
}

void InputState::bindAction(const std::string& action, KeyCode key) {
  actionKeys_[action] = static_cast<int>(key);
}

bool InputState::actionDown(const std::string& action) const {
  auto it = actionKeys_.find(action);
  if (it == actionKeys_.end()) return false;
  return keyDown(static_cast<KeyCode>(it->second));
}

bool InputState::actionPressed(const std::string& action) const {
  auto it = actionKeys_.find(action);
  if (it == actionKeys_.end()) return false;
  return keyPressed(static_cast<KeyCode>(it->second));
}

}  // namespace he
