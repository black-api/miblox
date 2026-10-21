#!/usr/bin/env bash
# Build MIBLOX.apk with the plain Android SDK toolchain (no Gradle required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BT="${BT_DIR:-$SDK/build-tools/35.0.0}"
PLATFORM="${PLATFORM_JAR:-$SDK/platforms/android-35/android.jar}"
OUT="$ROOT/build"
DIST="$ROOT/dist"
KS="${MIBLOX_KEYSTORE:-$HOME/.android/miblox-debug.keystore}"

for tool in "$BT/aapt2" "$BT/d8" "$BT/zipalign" "$BT/apksigner" "$PLATFORM"; do
  [ -e "$tool" ] || { echo "missing: $tool" >&2; exit 1; }
done

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex" "$OUT/gen" "$DIST"

echo "==> compiling resources"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"

echo "==> linking resources + assets"
"$BT/aapt2" link \
  -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 35 \
  -A "$ROOT/www" \
  --no-version-vectors \
  --auto-add-overlay

echo "==> compiling java"
# shellcheck disable=SC2046
javac -nowarn -encoding UTF-8 -source 8 -target 8 \
  -bootclasspath "$PLATFORM" \
  -d "$OUT/classes" \
  $(find "$ROOT/android/java" "$OUT/gen" -name '*.java' 2>/dev/null)

echo "==> dexing"
# shellcheck disable=SC2046
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" \
  --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

echo "==> packaging"
(cd "$OUT/dex" && zip -q -X "$OUT/base.apk" classes.dex)

echo "==> aligning + signing"
"$BT/zipalign" -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"

if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -v -keystore "$KS" -storepass android -keypass android \
    -alias miblox -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=MIBLOX, OU=Hyper Edition, O=MIBLOX, L=NA, ST=NA, C=US" >/dev/null 2>&1
  echo "    created signing key: $KS"
fi

"$BT/apksigner" sign \
  --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias miblox \
  --out "$DIST/MIBLOX.apk" "$OUT/aligned.apk"

"$BT/apksigner" verify --print-certs "$DIST/MIBLOX.apk" >/dev/null
echo "==> built $DIST/MIBLOX.apk ($(du -h "$DIST/MIBLOX.apk" | cut -f1))"
"$BT/aapt2" dump badging "$DIST/MIBLOX.apk" | grep -E "^(package|application-label|launchable-activity|sdkVersion|targetSdkVersion)" || true
