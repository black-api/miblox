// Minimal assertion helpers shared by the native test suites.
#pragma once

#include <cstdio>
#include <cstdlib>
#include <string>

namespace he_test {

inline int& failures() {
  static int count = 0;
  return count;
}

inline void check(bool condition, const char* expr, const char* file, int line) {
  if (condition) return;
  std::fprintf(stderr, "FAIL %s:%d  %s\n", file, line, expr);
  ++failures();
}

inline int summary(const char* suite) {
  if (failures() == 0) {
    std::printf("PASS %s\n", suite);
    return 0;
  }
  std::printf("FAIL %s (%d failing checks)\n", suite, failures());
  return 1;
}

}  // namespace he_test

#define HE_CHECK(expr) he_test::check((expr), #expr, __FILE__, __LINE__)
