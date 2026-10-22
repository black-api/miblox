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

### The page is served over http://127.0.0.1, not file://

This is the single most important rule for this host, and it was learned the
hard way: **loading `file:///android_asset/...` in the system WebView does not
work on several ROMs.** The navigation either fails or the WebView paints its
own error page, which is a blank **grey** rectangle — the user sees a grey
screen and nothing else.

The host therefore runs a small loopback HTTP server (`HeAssetServer`) that
serves `assets/heui/` on `127.0.0.1` and loads
`http://127.0.0.1:<port>/index.html` from it. A real origin also fixes the
second problem with `file://`: a `file://` page has a null origin, so **every
`fetch()` of the game's own assets is blocked by CORS**. Over loopback the
page and its assets share an origin and the palette loads normally.

Consequences that must not be forgotten:

- The app needs the `INTERNET` permission (creating a socket requires it).
- Cleartext must be allowed for the loopback interface only, via
  `res/xml/network_security_config.xml`. On Android 9+ cleartext is blocked by
  default and the WebView would show another grey error page.
- `setAllowFileAccess(false)` is deliberate: the game never needs `file://`.

### The rest

- `setJavaScriptEnabled(true)` with `addJavascriptInterface` limited to the
  `HeUiHost` object, which is only ever handed our own asset bundle.
- `setDomStorageEnabled(true)`: the game may use `localStorage` for saves, and
  a same-origin page (unlike `file://`) gets a stable, writable origin.
- `setCacheMode(LOAD_NO_CACHE)` so an updated bundle is never masked by a
  stale WebView cache after an app update.
- A load failure is never silent: `onReceivedError` for the main frame and a
  failure to start the server both replace the WebView with a readable error
  message. A blank screen is a bug, not a state.
- The build verifies that the APK really contains `classes.dex`, the game
  bundle and the network security config, so a packaging mistake fails the
  build instead of shipping a grey screen.

## 6. Input

- Touch input uses pointer events, so a stylus, a mouse (via USB-OTG) and a
  finger all work without branching.
- The virtual joystick in Gem Hunt is drawn inside the game layer, so it
  scales with the screen and never fights with system gestures.
- The back button is forwarded to the script host first; the game decides
  whether to consume it.

## 7. Signing: one key for one package

Android refuses to replace an installed app with a build signed by a
**different** key. The failure is reported as *"There was a problem parsing
the package"* (`INSTALL_PARSE_FAILED_INCONSISTENT_CERTIFICATES`) — which looks
like a broken APK but is really a key mismatch.

The key therefore lives **outside every repository**, in
`~/.android/heui-debug.keystore`, and is created once by the build script.
Any checkout of the engine, in any project, signs `dev.heui.gemhunt` with the
same certificate, so an update always replaces the previous build.

Rules:

- Never put a keystore inside a repository, and never generate one per
  checkout — that is exactly how the two-certificate situation appears.
- `heui doctor` prints the key path and the certificate fingerprint; compare
  it when an install is refused.
- `HEUI_KEYSTORE=/path/to/key.jks` overrides the location.
- If the key is lost, the old app can no longer be updated: uninstall it
  first (`adb uninstall dev.heui.gemhunt`), then install the new build.
- The build prints the fingerprint and records it in `release.json`, so a
  released artifact can always be traced to the key that signed it.

## 8. What to test on a real device

1. Background the app during play and return: the score and the arena must
   be intact, and no time may be lost.
2. Rotate the device: the arena rebuilds, the score is kept.
3. Turn the screen off and on: the surface is recreated without a crash.
4. Enable MIUI battery saver: the game must remain responsive.
5. Install on a de-Googled device: the game must start.
