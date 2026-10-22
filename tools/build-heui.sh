#!/usr/bin/env bash
# Build the HeUi sample game (Gem Hunt) as an installable APK.
#
#   ./tools/build-heui.sh            -> dist/gem-hunt-debug.apk
#
# The HeUi engine lives in heui/ and drives the plain Android SDK toolchain
# (aapt2 -> javac -> d8 -> zipalign -> apksigner), the same way tools/build.sh
# does for MIBLOX. The native core (libhe.so) is compiled with the NDK when
# one is installed; without it the APK still runs, using the JS renderer.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="$ROOT/heui"
DIST="$ROOT/dist"
PROJECT="${HEUI_PROJECT:-$ENGINE/apps/gem-hunt}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BT="${BT_DIR:-$SDK/build-tools/35.0.0}"

if [ ! -d "$ENGINE" ]; then
  echo "missing: $ENGINE" >&2
  exit 1
fi

mkdir -p "$DIST"

echo "==> bundling $PROJECT"
node "$ENGINE/converter/src/cli.js" bundle "$PROJECT" --out "$ENGINE/tmp/bundle/gem-hunt"

echo "==> building the APK"
node "$ENGINE/build/build-apk.js" "$PROJECT" --out "$DIST"

APK="$DIST/gem-hunt-debug.apk"
[ -f "$APK" ] || { echo "build failed: $APK missing" >&2; exit 1; }

if [ -x "$BT/apksigner" ]; then
  "$BT/apksigner" verify "$APK" && echo "    signature verified"
fi
echo "==> built $APK ($(du -h "$APK" | cut -f1))"
