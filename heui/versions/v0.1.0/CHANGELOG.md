# Changelog — HeUi 0.1.0

The first playable milestone: an engine core, a sample game and an APK
pipeline that produces a signed, installable artifact.

## Engine

- **C++ core** (`native/`): math (`Vec2`, `Mat3`, `Rect`), scene graph with
  composed transforms, 2D physics (AABB bodies, contacts, ray casts),
  resource cache, audio buses, input state, platform abstraction and a
  versioned C ABI (`he/capi.h`).
- **JavaScript runtime** (`src/`): engine loop with a fixed timestep and a
  clamped variable step, clock, input with named actions, renderer with a
  draw-command list, audio manager, resource loader, scene graph and math
  mirroring the native core.
- **Platforms**: browser (canvas), Node (headless), and a native bridge that
  talks to `libhe.so` over JNI when the Android host injects `HeUiHost`.

## Tooling

- `converter/` — a small ES-module bundler that turns a project into a
  single classic script plus an asset bundle and a runtime manifest.
- `build/build-apk.js` — a Gradle-free APK pipeline:
  `aapt2 compile` → `aapt2 link` → `javac` → `d8` → `zipalign` → `apksigner`,
  with the native core compiled by the NDK for `arm64-v8a`, `armeabi-v7a` and
  `x86_64`.
- `tools/cli/heui.js` — `create`, `bundle`, `run`, `build`, `test`, `doctor`.
- `tools/preview.js` — a headless preview that renders the game as ASCII.

## Game

- **Gem Hunt** (`apps/gem-hunt/`): collect gems, avoid hazards, beat the
  clock. Keyboard and a virtual joystick, particle bursts, a HUD and a
  game-over loop. The game logic is engine-independent and unit-tested.

## Tests

- 28 JavaScript tests (engine, game logic, bundler, native bridge, and an
  end-to-end test that boots the *bundled* game in a fake browser).
- 3 native test suites (math, scene, physics) run through `ctest`.

## Known limitations

- The Android host renders through a WebView; the native GLES renderer is
  present in `libhe.so` but is not yet the presentation path.
- The bundler supports the subset of ESM that HeUi projects use
  (named/default/namespace imports, re-exports, named exports).
- The physics broadphase is O(n²); a uniform grid is planned for the
  1.0 milestone.
