// HeUi — logging.
#pragma once

#include "he/he.hpp"

#include <string>

namespace he {

enum class LogLevel { Trace = 0, Debug, Info, Warn, Error };

void setLogLevel(LogLevel level);
LogLevel logLevel();

void logMessage(LogLevel level, const char* tag, const std::string& text);

inline void logTrace(const std::string& s, const char* tag = "he") { logMessage(LogLevel::Trace, tag, s); }
inline void logDebug(const std::string& s, const char* tag = "he") { logMessage(LogLevel::Debug, tag, s); }
inline void logInfo(const std::string& s, const char* tag = "he") { logMessage(LogLevel::Info, tag, s); }
inline void logWarn(const std::string& s, const char* tag = "he") { logMessage(LogLevel::Warn, tag, s); }
inline void logError(const std::string& s, const char* tag = "he") { logMessage(LogLevel::Error, tag, s); }

}  // namespace he
