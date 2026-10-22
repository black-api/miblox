# Running HeUi on MIUI (and other aggressive Android ROMs)

MIUI is not "Android with a different skin". It changes process lifetime,
GPU behaviour, permissions and power management. An engine that ignores this
ships a game that dies in the background or renders black after a phone call.
The rules below are implemented in `main/src/main/java/dev/heui/`.

## 1. Process lifetime

MIUI kills backgrounded processes aggressively — often within seconds of the
app leaving the foreground, and *without* calling `onDestroy`.

**Rule:** assume the process can die at any moment after `onPause`.

- `onPause` stops the WebView timers and tells the script host to pause, so
  the game stops simulating and mutes audio immediately.
- Nothing important is kept only in memory. The native core keeps CPU-side
  copies of every resource so a recreated surface can be rebuilt from them.
- The engine's frame delta is clamped (0.25 s) so a process that is frozen
  and then resumed does not simulate minutes of physics in one frame.

## 2. GPU and surface loss

MIUI can tear down the GL context when the app is backgrounded or when the
screen is turned off.

- The engine treats "context lost" as an event, not a crash: the resource
  cache is purged of GPU objects and re-uploaded from its CPU-side copies.
- The activity is never recreated on rotation (`configChanges` covers
  orientation, density and UI mode). The runtime is asked to resize instead,
  so the game keeps its state.

## 3. Power management

- `FLAG_KEEP_SCREEN_ON` is set while the game runs, otherwise MIUI dims the
  screen after a few seconds of no touch input.
- Immersive sticky mode hides the navigation bar, but it is re-applied on
  every `onWindowFocusChanged` because MIUI restores the bars after
  notifications and dialogs.
- The app declares no Google dependencies, so it runs on de-Googled and
  AOSP builds as well.

## 4. Permissions

- Permissions are requested lazily, only when a game feature needs them, and
  the engine degrades gracefully when a request is denied.
- The default project asks for `VIBRATE` only. Haptics are wrapped in a
  try/catch because MIUI's battery saver can block the vibrator.

## 5. WebView specifics

The JavaScript runtime runs inside a `WebView`.

- `setJavaScriptEnabled(true)` with `addJavascriptInterface` limited to the
  `HeUiHost` object, which is only ever handed our own asset bundle.
- `setDomStorageEnabled(false)`: the game keeps no state in the DOM storage,
  so a WebView data wipe cannot corrupt a save.
- The page is loaded from `file:///android_asset/heui/index.html`. ES modules
  are blocked over `file://` by CORS, which is why the converter emits a
  single classic script instead of a module graph.
- `setCacheMode(LOAD_NO_CACHE)` so an updated bundle is never masked by a
  stale WebView cache after an app update.

## 6. Input

- Touch input uses pointer events, so a stylus, a mouse (via USB-OTG) and a
  finger all work without branching.
- The virtual joystick in Gem Hunt is drawn inside the game layer, so it
  scales with the screen and never fights with system gestures.
- The back button is forwarded to the script host first; the game decides
  whether to consume it.

## 7. What to test on a real device

1. Background the app during play and return: the score and the arena must
   be intact, and no time may be lost.
2. Rotate the device: the arena rebuilds, the score is kept.
3. Turn the screen off and on: the surface is recreated without a crash.
4. Enable MIUI battery saver: the game must remain responsive.
5. Install on a de-Googled device: the game must start.
