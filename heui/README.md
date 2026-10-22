# HeUi

**HeUi** is a 2D game engine with a first-class Android (APK) exporter, built
so that the same project runs on a phone — including MIUI-flavored ROMs — and
on the desktop for fast iteration.

```
        authoring (JavaScript)          runtime                    export
 ┌────────────────────────────┐   ┌────────────────────────┐   ┌──────────────────────┐
 │ apps/gem-hunt/             │   │ native/  (C++ core)    │   │ main/   (APK shell)  │
 │   project.heui.json        │──▶│  math, scene, physics, │──▶│ WebView host + JNI   │
 │   src/game.js  (pure logic)│   │  resources, audio, GL  │   │ Gradle-free pipeline │
 │   src/main.js (entry)      │   ├────────────────────────┤   │ aapt2 → d8 → sign   │
 └────────────────────────────┘   │ src/     (JS runtime)  │   └──────────────────────┘
                                  │  engine, input, render  │            │
                                  └────────────────────────┘      build/out/*.apk
                                            ▲
                                     converter/ (bundler)
```

## Status

| Piece                       | State                                                        |
| --------------------------- | ------------------------------------------------------------ |
| C++ core (`native/`)        | building, 3 test suites green (math, scene, physics)          |
| JS runtime (`src/`)         | engine loop, input, renderer, audio, resources, native bridge  |
| Bundler (`converter/`)      | ESM → single classic script, assets, runtime manifest         |
| Android host (`main/`)      | Java activity, WebView, JNI bridge, MIUI-aware lifecycle      |
| APK pipeline (`build/`)     | aapt2 → javac → d8 → zipalign → apksigner, NDK for 3 ABIs     |
| Sample game (`apps/`)       | Gem Hunt — playable, headless-verified                        |
| Tests                       | 28 JS tests + 3 native suites                                  |

## Layout

| Path         | What lives there                                                        |
| ------------ | ----------------------------------------------------------------------- |
| `apps/`      | Game projects. Each is a self-contained HeUi project.                     |
| `src/`       | The JavaScript engine runtime (scene graph, scripting, asset loading).     |
| `native/`    | The C++ core (NDK). Math, renderer (GLES3), physics, resource, audio.     |
| `main/`      | The Android application module: manifest, Java host, JNI bridge.          |
| `converter/` | Project → runtime bundle compiler (assets, manifest, JS bundle).          |
| `build/`     | Build scripts: bundle assets, assemble and sign the APK.                 |
| `full/`      | Full release pipeline (signed APK, checksums, release manifest).          |
| `tools/`     | `heui` CLI, headless preview, fake DOM.                                   |
| `tests/`     | Engine test suites (JS: `node --test`; C++: `ctest`).                      |
| `versions/`  | Per-version engine releases and their changelogs.                         |
| `docs/`      | Device notes (see [docs/miui.md](docs/miui.md)).                          |
| `tmp/`       | Scratch space for intermediate build artifacts. Never committed.           |

## Quick start

```bash
node tools/cli/heui.js doctor          # check the toolchain
node tools/cli/heui.js test            # JS test suites
npm run test:native                   # C++ test suites (ctest)
node tools/cli/heui.js preview apps/gem-hunt   # run the game headlessly
node tools/cli/heui.js build apps/gem-hunt     # → build/out/gem-hunt-debug.apk
```

The APK lands in `build/out/`. It is signed with the debug key
(`build/debug.keystore`) and installs on any device or emulator with
Android 7.0 (API 24) or newer.

## Writing a game

A project is a folder in `apps/` with a manifest and ES modules:

```
apps/my-game/
  project.heui.json     # name, entry, android package + sdk versions
  index.html            # optional host page
  src/main.js           # entry point: creates the engine, draws, handles input
  src/game.js           # game logic (optional, but recommended to be pure)
```

`project.heui.json`:

```json
{
  "name": "my-game",
  "entry": "src/main.js",
  "width": 480,
  "height": 270,
  "android": {
    "package": "dev.heui.mygame",
    "minSdk": 24,
    "targetSdk": 35,
    "permissions": ["android.permission.VIBRATE"]
  }
}
```

The entry point boots the engine:

```js
import { createEngine } from '../../../src/index.js';

const engine = await createEngine({ platform: 'browser', canvas });

engine.onUpdate((dt) => { /* game logic */ });
engine.onRender((renderer) => {
  renderer.rect({ x: 0, y: 0, width: 320, height: 180, color: '#101426' });
});

await engine.start();
```

## The native core

The C++ core owns the work that must be fast on a phone: math, the scene
graph, physics, resource decoding and (soon) the GLES renderer. It is
exposed through a versioned C ABI (`native/include/he/capi.h`) and reached
from Android through `libhe.so` and a small JNI bridge. The JavaScript
runtime talks to it through `window.HeUiHost`; when the native core is
missing the runtime keeps working with its own renderer.

```js
engine.native.available;   // false on the desktop, true in the APK
engine.native.version;      // "0.1.0"
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — layering, the frame loop, the exporter.
- [docs/miui.md](docs/miui.md) — process killing, GPU loss, permissions.
- [versions/v0.1.0/CHANGELOG.md](versions/v0.1.0/CHANGELOG.md) — what shipped.
