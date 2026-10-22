#!/usr/bin/env node
// HeUi — command line interface.
//
//   heui create <name>            scaffold a new project in apps/
//   heui bundle <project>         compile a project into a runtime bundle
//   heui run <project>            run a project in the headless desktop preview
//   heui build <project>          build an APK
//   heui test                     run the engine test suites
//   heui doctor                   check the local toolchain

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBundle } from '../../converter/src/cli.js';
import { loadManifest } from '../../converter/src/manifest.js';
import { findSdk, findBuildTools, findNdk } from '../../build/lib/android.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function log(message) {
  process.stdout.write(`${message}\n`);
}

function scaffold(name) {
  const projectDir = path.join(repoRoot, 'apps', name);
  if (fs.existsSync(projectDir)) {
    throw new Error(`project already exists: ${projectDir}`);
  }
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'assets'), { recursive: true });

  const manifest = {
    name,
    displayName: name,
    version: '0.1.0',
    entry: 'src/main.js',
    engine: '0.1.0',
    orientation: 'any',
    width: 480,
    height: 270,
    assets: [],
    android: {
      package: `dev.heui.${name.replace(/[^a-z0-9_]/gi, '').toLowerCase()}`,
      minSdk: 24,
      targetSdk: 35,
      versionCode: 1,
      versionName: '0.1.0',
      permissions: ['android.permission.VIBRATE'],
    },
  };
  fs.writeFileSync(
    path.join(projectDir, 'project.heui.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  fs.writeFileSync(
    path.join(projectDir, 'src', 'main.js'),
    `import { createEngine } from '../../../src/index.js';

async function boot() {
  const canvas = document.getElementById('game');
  const engine = await createEngine({ platform: 'browser', canvas });

  engine.onRender((renderer) => {
    renderer.rect({ x: 0, y: 0, width: canvas.width, height: canvas.height, color: '#101426' });
  });

  await engine.start();
  window.HEUI_READY = true;
}

boot().catch((error) => console.error('heui: boot failed', error));
`,
  );

  fs.writeFileSync(
    path.join(projectDir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>${name}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #101426; overflow: hidden; }
      canvas { display: block; width: 100vw; height: 100vh; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script src="./heui.js"></script>
  </body>
</html>
`,
  );

  log(`created ${path.relative(repoRoot, projectDir)}`);
  log(`  next: node tools/cli/heui.js run apps/${name}`);
  return 0;
}

async function runPreview(projectDir) {
  const { runPreview } = await import('../preview.js');
  return runPreview(projectDir);
}

function doctor() {
  const sdk = findSdk();
  log('heui doctor');
  log(`  node      : ${process.version}`);
  log(`  repo      : ${repoRoot}`);
  log(`  android   : ${sdk || 'not found'}`);
  if (sdk) {
    const tools = findBuildTools(sdk);
    const ndk = findNdk(sdk);
    log(`  build-tools: ${tools || 'not found'}`);
    log(`  ndk       : ${ndk || 'not found'}`);
  }
  log(`  java      : ${hasCommand('java') ? 'yes' : 'no'}`);
  log(`  cmake     : ${hasCommand('cmake') ? 'yes' : 'no'}`);
  log(`  zip       : ${hasCommand('zip') ? 'yes' : 'no'}`);
  return 0;
}

function hasCommand(command) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  return paths.some((dir) => fs.existsSync(path.join(dir, command)));
}

function usage() {
  log(`heui — 2D game engine with an Android exporter

usage:
  heui create <name>          scaffold a new project in apps/
  heui bundle <project>       compile a project into a runtime bundle
  heui run <project>          run a project in the headless preview
  heui build <project>        build an APK (add --release for a release build)
  heui test                   run the JavaScript and native test suites
  heui doctor                 check the local toolchain
`);
  return 0;
}

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'create':
      return scaffold(rest[0] || 'my-game');
    case 'bundle': {
      const projectDir = path.resolve(rest[0] || path.join(repoRoot, 'apps', 'gem-hunt'));
      const outDir = path.join(repoRoot, 'tmp', 'bundle', path.basename(projectDir));
      const result = buildBundle(projectDir, outDir);
      log(`bundled ${result.manifest.name}: ${result.modules.length} modules, ${(result.bytes / 1024).toFixed(1)} kB`);
      log(`  → ${path.relative(repoRoot, outDir)}`);
      return 0;
    }
    case 'run':
      return runPreview(path.resolve(rest[0] || path.join(repoRoot, 'apps', 'gem-hunt')));
    case 'build': {
      const { buildApk } = await import('../../build/build-apk.js');
      const projectDir = path.resolve(rest[0] || path.join(repoRoot, 'apps', 'gem-hunt'));
      const result = buildApk(projectDir, { release: rest.includes('--release') });
      log(`apk: ${result.apk}`);
      return 0;
    }
    case 'test': {
      const { execFileSync } = await import('node:child_process');
      execFileSync('node', ['--test', 'tests/*.test.js'], { cwd: repoRoot, stdio: 'inherit' });
      return 0;
    }
    case 'doctor':
      return doctor();
    case undefined:
    case '--help':
    case '-h':
      return usage();
    default:
      process.stderr.write(`unknown command: ${command}\n`);
      return usage();
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
