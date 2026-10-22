// HeUi — audio system.
#include "he/audio.hpp"

#include "he/log.hpp"
#include "he/platform.hpp"

namespace he {

Handle AudioSystem::loadClip(const std::string& path, bool looping) {
  AudioClip clip;
  clip.id = nextClip_++;
  clip.path = path;
  clip.looping = looping;
  const auto dot = path.rfind('.');
  if (dot != std::string::npos) {
    const std::string ext = path.substr(dot + 1);
    if (ext == "ogg") clip.format = AudioFormat::Ogg;
    else if (ext == "mp3") clip.format = AudioFormat::Mp3;
    else if (ext == "wav") clip.format = AudioFormat::Wav;
    else if (ext == "raw") clip.format = AudioFormat::Pcm16;
  }
  clips_.push_back(clip);
  return clip.id;
}

const AudioClip* AudioSystem::clip(Handle id) const {
  for (const auto& c : clips_) {
    if (c.id == id) return &c;
  }
  return nullptr;
}

Handle AudioSystem::createPlayer(Handle clipId) {
  AudioPlayer player;
  player.id = nextPlayer_++;
  player.clip = clipId;
  player.loop = clip(clipId) ? clip(clipId)->looping : false;
  players_.push_back(player);
  return player.id;
}

void AudioSystem::play(Handle id) {
  if (AudioPlayer* p = player(id)) {
    p->state = AudioState::Playing;
    p->position = 0.0f;
  }
}

void AudioSystem::pause(Handle id) {
  if (AudioPlayer* p = player(id)) p->state = AudioState::Paused;
}

void AudioSystem::stop(Handle id) {
  if (AudioPlayer* p = player(id)) {
    p->state = AudioState::Stopped;
    p->position = 0.0f;
  }
}

void AudioSystem::setVolume(Handle id, f32 volume) {
  if (AudioPlayer* p = player(id)) p->volume = volume;
}

void AudioSystem::setPosition(Handle id, f32 seconds) {
  if (AudioPlayer* p = player(id)) p->position = seconds;
}

AudioPlayer* AudioSystem::player(Handle id) {
  for (auto& p : players_) {
    if (p.id == id) return &p;
  }
  return nullptr;
}

AudioBus& AudioSystem::bus(const std::string& name) {
  auto it = buses_.find(name);
  if (it == buses_.end()) it = buses_.emplace(name, AudioBus{name, 1.0f, false}).first;
  return it->second;
}

const AudioBus* AudioSystem::bus(const std::string& name) const {
  auto it = buses_.find(name);
  return it == buses_.end() ? nullptr : &it->second;
}

void AudioSystem::mix(f32 dt) {
  if (suspended_) return;
  for (auto& p : players_) {
    if (p.state != AudioState::Playing) continue;
    const AudioClip* c = clip(p.clip);
    const f32 duration = c ? c->duration : 0.0f;
    p.position += dt * std::max(p.pitch, 0.01f);
    if (duration > 0.0f && p.position >= duration) {
      if (p.loop) {
        p.position = std::fmod(p.position, duration);
      } else {
        p.position = duration;
        p.state = AudioState::Stopped;
      }
    }
  }
}

void AudioSystem::suspend() {
  suspended_ = true;
  for (auto& p : players_) {
    if (p.state == AudioState::Playing) p.state = AudioState::Paused;
  }
}

void AudioSystem::resume() {
  suspended_ = false;
  for (auto& p : players_) {
    if (p.state == AudioState::Paused) p.state = AudioState::Playing;
  }
}

}  // namespace he
