#include "he/log.hpp"

#include <cstdio>

namespace he {
namespace {
LogLevel g_level = LogLevel::Info;

const char* levelName(LogLevel level) {
  switch (level) {
    case LogLevel::Trace: return "T";
    case LogLevel::Debug: return "D";
    case LogLevel::Info:  return "I";
    case LogLevel::Warn:  return "W";
    case LogLevel::Error: return "E";
  }
  return "?";
}
}  // namespace

void setLogLevel(LogLevel level) { g_level = level; }
LogLevel logLevel() { return g_level; }

void logMessage(LogLevel level, const char* tag, const std::string& text) {
  if (level < g_level) return;
  std::fprintf(stderr, "[he/%s] %s: %s\n", levelName(level),
               tag ? tag : "he", text.c_str());
}

}  // namespace he
