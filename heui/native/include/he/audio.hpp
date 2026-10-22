// HeUi — audio: buses, players, mixing.
#pragma once

#include "he/he.hpp"

#include <string>
#include <unordered_map>
#include <vector>

namespace he {

class Platform;

enum class AudioFormat { Unknown, Pcm16, Ogg, Mp3, Wav };

struct AudioClip {
  Handle id = kInvalidHandle;
  std::string path;
  AudioFormat format = AudioFormat::Unknown;
  f32 duration = 0.0f;
  bool looping = false;
  f32 volume = 1.0f;
};

enum class AudioState { Idle, Playing, Paused, Stopped };

struct AudioPlayer {
  Handle id = kInvalidHandle;
  Handle clip = kInvalidHandle;
  AudioState state = AudioState::Idle;
  f32 volume = 1.0f;
  f32 pitch = 1.0f;
  f32 position = 0.0f;   // seconds into the clip
  bool loop = false;
};

/// A named mix bus ("music", "sfx", "ui").
struct AudioBus {
  std::string name;
  f32 volume = 1.0f;
  bool muted = false;
};

class AudioSystem {
 public:
  explicit AudioSystem(Platform* platform) : platform_(platform) {}

  Handle loadClip(const std::string& path, bool looping = false);
  const AudioClip* clip(Handle id) const;

  Handle createPlayer(Handle clip);
  void play(Handle player);
  void pause(Handle player);
  void stop(Handle player);
  void setVolume(Handle player, f32 volume);
  void setPosition(Handle player, f32 seconds);
  AudioPlayer* player(Handle id);

  AudioBus& bus(const std::string& name);
  const AudioBus* bus(const std::string& name) const;

  /// Mixes one frame. On a real device this drives the output buffer.
  void mix(f32 dt);
  /// Called when the app is paused — stops hardware output but keeps state.
  void suspend();
  void resume();

  size_t playerCount() const { return players_.size(); }

 private:
  Platform* platform_;
  std::vector<AudioClip> clips_;
  std::vector<AudioPlayer> players_;
  std::unordered_map<std::string, AudioBus> buses_;
  Handle nextClip_ = 1;
  Handle nextPlayer_ = 1;
  bool suspended_ = false;
};

}  // namespace he
