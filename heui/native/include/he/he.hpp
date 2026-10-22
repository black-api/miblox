// HeUi — common definitions for the C++ core.
#pragma once

#include <cstdint>
#include <cstddef>

#if defined(_WIN32)
#  define HE_API __declspec(dllexport)
#else
#  define HE_API __attribute__((visibility("default")))
#endif

#define HE_VERSION_MAJOR 0
#define HE_VERSION_MINOR 1
#define HE_VERSION_PATCH 0
#define HE_VERSION_STRING "0.1.0"

namespace he {

using u8 = std::uint8_t;
using u16 = std::uint16_t;
using u32 = std::uint32_t;
using u64 = std::uint64_t;
using i32 = std::int32_t;
using i64 = std::int64_t;
using f32 = float;
using f64 = double;

/// Opaque handle used by the C ABI and by the JavaScript runtime.
using Handle = u32;

constexpr Handle kInvalidHandle = 0;

}  // namespace he
