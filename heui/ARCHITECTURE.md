# HeUi Architecture

## 1. Design goals

1. **One project, many targets.** A game is written once in JavaScript and runs on
   Android (APK), on the desktop (fast dev loop) and, later, in a browser.
2. **Native where it matters.** Rendering, math, physics, resource decoding and audio
   live in C++ so that a mid-range phone holds frame rate. JavaScript owns game logic
   and the authoring surface.
3. **No hidden state.** The engine exposes an explicit lifecycle, an explicit scene
   graph, and an explicit update order. Nothing happens by magic at import time.
4. **MIUI is a first-class target.** Xiaomi's ROM kills background processes, throttles
   wakelocks and ships its own WebView/permission quirks. The engine assumes this from
   day one instead of patching it in at release time.

## 2. Layering

```
┌───────────────────────────────────────────────────────────────────────┐
│ apps/<game>/src            game code: scenes, components, systems      │
├───────────────────────────────────────────────────────────────────────┤
│ src/  (JS runtime)         engine.*, scene.*, resources, input, audio  │
├───────────────────────────────────────────────────────────────────────┤
│ native/ (C++ core)         math, renderer, physics, resource, audio    │
├───────────────────────────────────────────────────────────────────────┤
│ main/ (Android)            Activity, View/SurfaceView, JNI, packaging │
└───────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** layers may only depend downward. The C++ core never knows about
the JavaScript runtime; the JS runtime never calls into Java directly — only through
the C ABI declared in `native/include/he/capi.h`. Android-specific behaviour lives in
`src/platform/browser/` and is selected at boot by a platform probe.

## 3. The C++ core

| Module              | Responsibility                                                           |
| ------------------- | ------------------------------------------------------------------------ |
| `he::math`          | `Vec2`, `Vec3`, `Mat3`, `Rect`, `Transform`, angle/lerp helpers.          |
| `he::scene`         | `Node` tree, transform propagation, `Component` storage, update ordering. |
| `he::physics2d`     | Broadphase (uniform grid), AABB + circle bodies, resolution, ray casts.   |
| `he::render`        | `Renderer` interface, render-queue, `GLRenderer` (GLES3 / desktop GL).   |
| `he::resource`      | Byte buffers, textures, atlases, fonts, streaming from a `Platform`.     |
| `he::audio`         | Stream players, mix graph, music/effects buses.                          |
| `he::input`         | Touch, mouse, keyboard, gyro → normalized `InputState`.                   |
| `he::platform`      | Files, AAsset access, time, logging, display metrics, lifecycle events.   |
| `he::engine`        | Owns the subsystems, runs the fixed-step + variable-step frame loop.      |

The core is exposed to the host through a stable C ABI (`he/capi.h`). The Android app
loads `libhe.so` and the JS host calls into it through `he_jni.cpp`; the desktop
preview links the same core directly. This keeps one implementation of the engine
and avoids a Java/JS duplicate.

## 4. The JavaScript runtime

- `src/core/engine.js` — subsystem registry, fixed-timestep loop, lifecycle events.
- `src/core/scene/*` — `Node`, `Component`, `Scene`, `Transform`. Thin, declarative
  wrappers over the native scene graph where one exists.
- `src/core/time.js` — monotonic clock, time scale, timer/awaitable helpers.
- `src/core/input.js` — input state and action mapping (touch → "jump").
- `src/core/resources/*` — asset manifests, load queues, reference counting.
- `src/core/audio/*` — buses, looping, volume envelopes.
- `src/platform/*` — `Platform` implementations: `browser` (canvas), `node`
  (headless), plus `native-bridge.js`, which talks to `libhe.so` when the
  Android host injects `window.HeUiHost`.
- `src/runtime/*` — script host, module loader, bootstrap.

JavaScript never allocates native memory directly; it asks the C ABI for handles and
the core owns the lifetime.

## 5. The Android exporter

`converter/` compiles a project into a runtime bundle:

```
project.heui.json          → bundle/manifest.json
src/**/*.js                → bundle/heui.js        (ESM → single classic script)
assets/**                  → bundle/assets/...     (packed, hashed, deduped)
index.html                 → bundle/index.html     (manifest injected)
```

The bundle is a *classic script*, not a module graph: a WebView cannot load
ES modules over `file://` (CORS blocks them), so the bundler inlines the
whole graph behind a tiny `__he_require` registry.

`build/build-apk.js` then assembles the APK without Gradle:

```
aapt2 compile --dir res            → compiled resources
aapt2 link --manifest … -I android.jar --java gen
javac  -classpath android.jar      → .class files
d8     --min-api 24                → classes.dex
zip    (assets/, lib/)             → payload added to the linked APK
zipalign -p -f 4                   → page-aligned APK
apksigner sign --ks debug.keystore  → signed APK
```

`native/` is compiled by the NDK into `libhe.so` for `arm64-v8a`,
`armeabi-v7a` and `x86_64` and packaged as `lib/<abi>/libhe.so`.

```
heui build apps/gem-hunt   →  build/out/gem-hunt-debug.apk
heui release               →  build/release/<version>/{apk, SHA256SUMS, release.json}
```

### The Android host

`main/src/main/java/dev/heui/`:

| Class            | Responsibility                                              |
| ---------------- | ----------------------------------------------------------- |
| `HeUiActivity`   | WebView host, immersive mode, lifecycle, back button        |
| `HeBridge`       | `window.HeUiHost`: the JavaScript ↔ native boundary         |
| `HeNative`       | JNI declarations for `libhe.so`                             |
| `HeHaptics`      | vibration, safe on every ROM                                |

### MIUI / Android device notes

- **Aggressive process killing.** The engine pauses rendering and mutes audio on
  `onPause` and restores state in `onResume`; it never assumes it is the foreground
  app.
- **Aggressive GPU teardown.** Context loss is handled: the renderer recreates GL
  resources from the resource cache and re-uploads the atlas.
- **Permissions.** Storage and location are requested lazily, only when a game
  feature asks for them, and the engine degrades gracefully when denied.
- **No Google Play dependency.** The core uses only the NDK and the Android platform
  APIs, so the APK runs on de-Googled and AOSP builds.
- **MIUI's "battery saver"** can throttle the choreographer; the frame loop uses
  `Choreographer` on Android rather than a busy timer.

## 6. Frame loop

```
  ┌─ input pump ────────────────────────────────────────┐
  │  touch/mouse/keyboard → InputState (native)          │
  ├─ fixed steps (1/60 s, accumulator) ──────────────────┤
  │  physics.step(fixedDt)                               │
  │  script.update(fixedDt)                              │
  ├─ variable step (clamped) ────────────────────────────┤
  │  script.lateUpdate(frameDt)                          │
  │  animation/transform integration                     │
  ├─ render ─────────────────────────────────────────────┤
  │  scene → render queue → GL draw calls                │
  └─ audio mix ──────────────────────────────────────────┘
```

Fixed-step keeps physics deterministic; the variable step keeps animation smooth.
Both deltas are clamped so a backgrounded app does not resume with a 30-second jump.

## 7. Versioning and releases

`versions/<semver>/` holds a frozen engine snapshot plus `CHANGELOG.md`. A project
pins an engine version in `project.heui.json`; `heui upgrade` migrates it. `full/`
builds a release: frozen core, signed APK, checksums, changelog.
