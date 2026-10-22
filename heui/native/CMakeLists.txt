cmake_minimum_required(VERSION 3.16)
project(heui_core CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

option(HE_BUILD_TESTS "Build the native test suite" OFF)
option(HE_ENABLE_GL "Compile the OpenGL/GLES renderer backend" OFF)
option(HE_ENABLE_ANDROID "Compile the Android platform backend" OFF)

add_library(he_core STATIC
  src/math.cpp
  src/log.cpp
  src/resource.cpp
  src/scene.cpp
  src/renderer.cpp
  src/physics2d.cpp
  src/audio.cpp
  src/input.cpp
  src/engine.cpp
  src/capi.cpp
  src/platform_desktop.cpp
)

target_include_directories(he_core PUBLIC include)
target_compile_definitions(he_core PUBLIC
  $<$<CONFIG:Debug>:HE_DEBUG=1>
)

if(HE_ENABLE_GL)
  find_package(OpenGL REQUIRED)
  target_sources(he_core PRIVATE src/renderer_gl.cpp)
  target_compile_definitions(he_core PUBLIC HE_ENABLE_GL=1)
  target_link_libraries(he_core PUBLIC OpenGL::GL)
endif()

if(HE_ENABLE_ANDROID)
  target_sources(he_core PRIVATE src/platform_android.cpp)
  target_compile_definitions(he_core PUBLIC HE_ENABLE_ANDROID=1)
endif()

# ---- shared library for the Android host -----------------------------------
# Only meaningful with the NDK; on the desktop the core is linked statically.
if(ANDROID)
  add_library(he SHARED src/jni/he_jni.cpp)
  target_link_libraries(he PRIVATE he_core)
  set_target_properties(he PROPERTIES OUTPUT_NAME "he")
endif()

if(HE_BUILD_TESTS)
  enable_testing()
  foreach(suite math scene physics)
    add_executable(he_test_${suite} tests/test_${suite}.cpp)
    target_link_libraries(he_test_${suite} PRIVATE he_core)
    target_include_directories(he_test_${suite} PRIVATE tests)
    add_test(NAME ${suite} COMMAND he_test_${suite})
  endforeach()
endif()
