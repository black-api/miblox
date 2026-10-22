// HeUi — Android SDK discovery and tool wrappers.
//
// The build talks to the SDK directly (aapt2 / d8 / apksigner / zipalign)
// instead of Gradle, so a full APK can be produced with nothing but the
// command line tools and a JDK.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Locates the Android SDK. */
export function findSdk() {
  const explicit = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  const candidates = [
    explicit,
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    '/usr/lib/android-sdk',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'platforms')) || fs.existsSync(path.join(candidate, 'build-tools'))) {
      return candidate;
    }
  }
  return null;
}

/** Resolves the newest build-tools directory. */
export function findBuildTools(sdk) {
  const dir = path.join(sdk, 'build-tools');
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort((a, b) => (a === b ? 0 : parseFloat(b) - parseFloat(a)));
  return versions.length > 0 ? path.join(dir, versions[0]) : null;
}

/** Resolves the newest installed platform (android-35 etc.). */
export function findPlatform(sdk) {
  const dir = path.join(sdk, 'platforms');
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('android-'))
    .sort((a, b) => parseInt(b.split('-')[1], 10) - parseInt(a.split('-')[1], 10));
  return versions.length > 0 ? path.join(dir, versions[0]) : null;
}

/** Resolves the NDK (optional: only needed for the native core). */
export function findNdk(sdk) {
  const dir = path.join(sdk, 'ndk');
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .sort((a, b) => parseFloat(b) - parseFloat(a));
  return versions.length > 0 ? path.join(dir, versions[0]) : null;
}

export class AndroidSdk {
  constructor(sdkRoot) {
    this.root = sdkRoot;
    this.buildTools = findBuildTools(sdkRoot);
    this.platform = findPlatform(sdkRoot);
    this.ndk = findNdk(sdkRoot);
    if (!this.buildTools) throw new Error(`no build-tools found in ${sdkRoot}`);
    if (!this.platform) throw new Error(`no platform found in ${sdkRoot}`);
  }

  tool(name) {
    const file = path.join(this.buildTools, name);
    if (!fs.existsSync(file)) throw new Error(`missing build tool: ${file}`);
    return file;
  }

  get androidJar() {
    return path.join(this.platform, 'android.jar');
  }

  get cmakeToolchain() {
    if (!this.ndk) return null;
    return path.join(this.ndk, 'build', 'cmake', 'android.toolchain.cmake');
  }

  /** Runs a tool and returns its stdout. */
  run(command, args, options = {}) {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });
  }
}
