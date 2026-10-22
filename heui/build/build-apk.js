// HeUi — APK build pipeline.
//
//   node build/build-apk.js apps/gem-hunt [--out build/out] [--release]
//
// The pipeline is Gradle-free on purpose: aapt2 compiles the resources and
// links the manifest, javac + d8 produce the dex, and apksigner signs the
// result. The native core (libhe.so) is compiled with the NDK and packaged
// for every supported ABI.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildBundle } from '../converter/src/cli.js';
import { loadManifest, stripComments } from '../converter/src/manifest.js';
import { AndroidSdk, findSdk } from './lib/android.js';
import { createGemIcon } from './lib/png.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const ANDROID_SCREENS = {
  portrait: 'portrait',
  landscape: 'landscape',
  any: 'unspecified',
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Copies a directory tree. */
function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      count += copyDir(src, dst);
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      count += 1;
    }
  }
  return count;
}

/** Renders the manifest template with the project's values. */
function renderTemplate(text, values) {
  return text.replace(/\$\{(\w+)\}/g, (match, key) =>
    values[key] !== undefined ? values[key] : match,
  );
}

/**
 * Compiles the native core for every supported ABI.
 * @returns {string[]} paths of the built .so files
 */
export function buildNative(sdk, { debug = false } = {}) {
  if (!sdk.ndk) {
    log('  ! NDK not found — the APK will ship without the native core');
    return [];
  }
  const abis = [
    { abi: 'arm64-v8a', target: 'aarch64-linux-android' },
    { abi: 'armeabi-v7a', target: 'armv7a-linux-androideabi' },
    { abi: 'x86_64', target: 'x86_64-linux-android' },
  ];
  const outputs = [];
  for (const { abi, target } of abis) {
    const buildDir = path.join(repoRoot, 'build', 'native', abi);
    const toolchain = path.join(
      sdk.ndk,
      'build',
      'cmake',
      'android.toolchain.cmake',
    );
    const args = [
      '-S',
      path.join(repoRoot, 'native'),
      '-B',
      buildDir,
      '-DCMAKE_TOOLCHAIN_FILE=' + toolchain,
      `-DANDROID_ABI=${abi}`,
      `-DANDROID_PLATFORM=android-24`,
      `-DCMAKE_BUILD_TYPE=${debug ? 'Debug' : 'Release'}`,
      '-DANDROID_STL=c++_static',
    ];
    execFileSync('cmake', args, { stdio: 'ignore' });
    execFileSync('cmake', ['--build', buildDir, '--target', 'he', '-j'], {
      stdio: 'ignore',
    });
    const so = path.join(buildDir, 'libhe.so');
    if (fs.existsSync(so)) outputs.push(so);
  }
  return outputs;
}

/**
 * Resolves the signing keystore.
 *
 * The key lives OUTSIDE any repository, in `~/.android/heui-debug.keystore`,
 * so that every build of the same package — in any checkout, on any machine
 * that has the key — is signed identically. Android refuses to replace an
 * installed app with a build signed by a different key, and a per-checkout
 * throwaway key produces exactly that failure ("There was a problem parsing
 * the package"). Override with HEUI_KEYSTORE.
 */
export function resolveKeystore() {
  if (process.env.HEUI_KEYSTORE) return path.resolve(process.env.HEUI_KEYSTORE);
  return path.join(os.homedir(), '.android', 'heui-debug.keystore');
}

/** The SHA-256 fingerprint of the signing certificate, for support requests. */
export function certificateFingerprint(keystore) {
  try {
    const output = execFileSync(
      'keytool',
      ['-list', '-v', '-keystore', keystore, '-storepass', 'android'],
      { encoding: 'utf8' },
    );
    const match = output.match(/SHA256:\s*([0-9A-F:]+)/);
    return match ? match[1] : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Builds an APK for a project.
 * @param {string} projectDir
 * @param {{release?: boolean, outDir?: string, skipNative?: boolean}} options
 */
export function buildApk(projectDir, { release = false, outDir = null, skipNative = false } = {}) {
  const manifest = loadManifest(projectDir);
  const android = manifest.android || {};
  const sdkRoot = findSdk();
  if (!sdkRoot) {
    throw new Error('Android SDK not found (set ANDROID_SDK_ROOT)');
  }
  const sdk = new AndroidSdk(sdkRoot);
  log(`  sdk      : ${sdkRoot}`);
  log(`  platform : ${path.basename(sdk.platform)}`);
  log(`  tools    : ${path.basename(sdk.buildTools)}`);

  const workDir = path.join(repoRoot, 'build', 'staging', manifest.name);
  rmrf(workDir);
  const resDir = path.join(workDir, 'res');
  const genDir = path.join(workDir, 'gen');
  const classesDir = path.join(workDir, 'classes');
  const dexDir = path.join(workDir, 'dex');
  fs.mkdirSync(resDir, { recursive: true });
  fs.mkdirSync(genDir, { recursive: true });
  fs.mkdirSync(classesDir, { recursive: true });
  fs.mkdirSync(dexDir, { recursive: true });

  // --- resources ---------------------------------------------------------
  copyDir(path.join(repoRoot, 'main', 'src', 'main', 'res'), resDir);
  const values = {
    applicationId: android.package || `dev.heui.${manifest.name.replace(/[^a-z0-9_]/gi, '').toLowerCase()}`,
    appLabel: manifest.displayName || manifest.name,
    versionCode: String(android.versionCode || 1),
    versionName: android.versionName || manifest.version || '0.1.0',
    minSdk: String(android.minSdk || 24),
    targetSdk: String(android.targetSdk || 35),
    screenOrientation: ANDROID_SCREENS[android.orientation || 'any'] || 'unspecified',
    engineVersion: manifest.engine || '0.1.0',
    permissions: (android.permissions || [])
      .map((permission) => `    <uses-permission android:name="${permission}" />`)
      .join('\n'),
  };

  const stringsFile = path.join(resDir, 'values', 'strings.xml');
  if (fs.existsSync(stringsFile)) {
    writeFile(stringsFile, renderTemplate(fs.readFileSync(stringsFile, 'utf8'), values));
  }
  const mipmapDir = path.join(resDir, 'mipmap-xxhdpi');
  fs.mkdirSync(mipmapDir, { recursive: true });
  fs.writeFileSync(path.join(mipmapDir, 'ic_launcher.png'), createGemIcon(192));

  // --- manifest ----------------------------------------------------------
  const manifestTemplate = fs.readFileSync(
    path.join(repoRoot, 'main', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  const manifestFile = path.join(workDir, 'AndroidManifest.xml');
  writeFile(manifestFile, renderTemplate(manifestTemplate, values));

  // --- game payload ------------------------------------------------------
  const bundleDir = path.join(workDir, 'bundle');
  const bundleInfo = buildBundle(projectDir, bundleDir);
  log(`  bundle   : ${bundleInfo.modules.length} modules, ${(bundleInfo.bytes / 1024).toFixed(1)} kB`);

  // --- aapt2 -------------------------------------------------------------
  const compiled = path.join(workDir, 'compiled-res.zip');
  execFileSync(sdk.tool('aapt2'), ['compile', '--dir', resDir, '-o', compiled], {
    stdio: 'inherit',
  });
  const baseApk = path.join(workDir, 'base.apk');
  execFileSync(
    sdk.tool('aapt2'),
    [
      'link',
      '-o',
      baseApk,
      '-I',
      sdk.androidJar,
      '--manifest',
      manifestFile,
      '--java',
      genDir,
      '-R',
      compiled,
      '--min-sdk-version',
      values.minSdk,
      '--target-sdk-version',
      values.targetSdk,
      '--version-code',
      values.versionCode,
      '--version-name',
      values.versionName,
      '--auto-add-overlay',
    ],
    { stdio: 'inherit' },
  );

  // --- java --------------------------------------------------------------
  const javaFiles = [];
  const collectJava = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectJava(full);
      else if (entry.name.endsWith('.java')) javaFiles.push(full);
    }
  };
  collectJava(path.join(repoRoot, 'main', 'src', 'main', 'java'));
  collectJava(genDir);
  execFileSync(
    'javac',
    ['-nowarn', '-source', '17', '-target', '17', '-classpath', sdk.androidJar, '-d', classesDir, ...javaFiles],
    { stdio: 'inherit' },
  );

  // --- dex ---------------------------------------------------------------
  const classFiles = [];
  const collectClasses = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectClasses(full);
      else if (entry.name.endsWith('.class')) classFiles.push(full);
    }
  };
  collectClasses(classesDir);
  execFileSync(
    sdk.tool('d8'),
    ['--lib', sdk.androidJar, '--min-api', values.minSdk, '--output', dexDir, ...classFiles],
    { stdio: 'inherit' },
  );

  // --- assemble ----------------------------------------------------------
  // The payload is added to the linked APK: assets for the game, lib/ for the
  // native core.
  const payloadDir = path.join(workDir, 'payload');
  fs.mkdirSync(path.join(payloadDir, 'assets'), { recursive: true });
  copyDir(bundleDir, path.join(payloadDir, 'assets', 'heui'));

  const nativeLibs = skipNative ? [] : buildNative(sdk, { debug: !release });
  for (const so of nativeLibs) {
    const abi = path.basename(path.dirname(so));
    const target = path.join(payloadDir, 'lib', abi);
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(so, path.join(target, 'libhe.so'));
    // Strip the symbols: the APK ships the code, not the debug info.
    const strip = path.join(sdk.ndk, 'toolchains', 'llvm', 'prebuilt', 'linux-x86_64', 'bin', 'llvm-strip');
    if (fs.existsSync(strip)) {
      execFileSync(strip, ['--strip-unneeded', path.join(target, 'libhe.so')], {
        stdio: 'ignore',
      });
    }
  }
  if (nativeLibs.length > 0) {
    log(`  native   : libhe.so for ${nativeLibs.map((f) => path.basename(path.dirname(f))).join(', ')}`);
  }

  // The dex produced by d8 is the application code.
  const dexFiles = fs.readdirSync(dexDir).filter((name) => name.endsWith('.dex'));
  for (const dex of dexFiles) {
    fs.copyFileSync(path.join(dexDir, dex), path.join(payloadDir, dex));
  }

  const unsigned = path.join(workDir, 'unsigned.apk');
  fs.copyFileSync(baseApk, unsigned);
  execFileSync('zip', ['-r', '-q', unsigned, 'assets', 'lib', ...dexFiles], {
    cwd: payloadDir,
    stdio: 'inherit',
  });

  // --- align & sign ------------------------------------------------------
  const aligned = path.join(workDir, 'aligned.apk');
  execFileSync(sdk.tool('zipalign'), ['-p', '-f', '4', unsigned, aligned], {
    stdio: 'inherit',
  });

  const keystore = resolveKeystore();
  const alias = process.env.HEUI_KEY_ALIAS || 'androiddebugkey';
  if (!fs.existsSync(keystore)) {
    fs.mkdirSync(path.dirname(keystore), { recursive: true });
    execFileSync(
      'keytool',
      [
        '-genkeypair',
        '-keystore',
        keystore,
        '-storepass',
        'android',
        '-keypass',
        'android',
        '-alias',
        alias,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '10000',
        '-dname',
        'CN=HeUi Debug, O=HeUi, C=US',
      ],
      { stdio: 'inherit' },
    );
    log(`  signing  : created ${keystore}`);
  }

  const finalDir = outDir || path.join(repoRoot, 'build', 'out');
  fs.mkdirSync(finalDir, { recursive: true });
  const apkName = `${manifest.name}-${release ? 'release' : 'debug'}.apk`;
  const finalApk = path.join(finalDir, apkName);
  execFileSync(
    sdk.tool('apksigner'),
    [
      'sign',
      '--ks',
      keystore,
      '--ks-pass',
      'pass:android',
      '--key-pass',
      'pass:android',
      '--ks-key-alias',
      alias,
      // v2 + v3 cover every device from Android 7.0 (API 24) upwards; apksigner
      // skips the JAR (v1) scheme for that minSdk on its own.
      '--v2-signing-enabled',
      'true',
      '--v3-signing-enabled',
      'true',
      '--out',
      finalApk,
      aligned,
    ],
    { stdio: 'inherit' },
  );

  // --- verify ------------------------------------------------------------
  const verify = execFileSync(sdk.tool('apksigner'), ['verify', '--print-certs', finalApk], {
    encoding: 'utf8',
  });
  const badging = execFileSync(sdk.tool('aapt2'), ['dump', 'badging', finalApk], {
    encoding: 'utf8',
  });

  // The APK must actually contain the game and the host code. A missing
  // entry is the difference between a game and a blank screen.
  const entries = execFileSync('unzip', ['-Z1', finalApk], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const required = [
    'classes.dex',
    'assets/heui/index.html',
    'assets/heui/heui.js',
    'assets/heui/manifest.json',
    'res/xml/network_security_config.xml',
  ];
  const missing = required.filter((entry) => !entries.includes(entry));
  if (missing.length > 0) {
    throw new Error(`the APK is missing required entries: ${missing.join(', ')}`);
  }
  if (!entries.some((entry) => entry.endsWith('/libhe.so'))) {
    throw new Error('the APK contains no native core (libhe.so) — is the NDK missing?');
  }

  const size = fs.statSync(finalApk).size;
  log(`  apk      : ${path.relative(repoRoot, finalApk)} (${(size / 1024).toFixed(1)} kB)`);
  log(`  verify   : ${verify.split('\n')[0]}`);
  log(`  signer   : ${keystore}`);
  log(`  cert     : ${certificateFingerprint(keystore)}`);
  log(`  contents : ${entries.length} entries, game + host + native core present`);

  return {
    apk: finalApk,
    badging,
    verify,
    size,
    entries,
    keystore,
    certificate: certificateFingerprint(keystore),
    manifest: values,
  };
}

function main(argv) {
  const projectDir = path.resolve(
    argv.find((arg) => !arg.startsWith('--')) || path.join(repoRoot, 'apps', 'gem-hunt'),
  );
  const release = argv.includes('--release');
  const skipNative = argv.includes('--skip-native');
  const outIndex = argv.indexOf('--out');
  const outDir = outIndex >= 0 ? path.resolve(argv[outIndex + 1]) : null;
  log(`heui build → ${projectDir}`);
  const result = buildApk(projectDir, { release, skipNative, outDir });
  log('');
  log(result.badging.split('\n').slice(0, 6).join('\n'));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
