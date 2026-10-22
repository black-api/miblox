#!/usr/bin/env node
// HeUi — converter CLI.
//
//   heui bundle <project> [--out dir]     compile a project into a runtime bundle
//   heui bundle-all                       compile every project in apps/
//
// The produced bundle is what ships inside the APK under assets/heui/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundler.js';
import { loadManifest, listFiles } from './manifest.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function copyTree(from, to) {
  if (!fs.existsSync(from)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      count += copyTree(src, dst);
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      count += 1;
    }
  }
  return count;
}

/**
 * Checks that the bundle only uses syntax that old Android WebViews can
 * parse.
 *
 * The system WebView on some ROMs (MIUI among them) is not updated with the
 * Play Store, so it can be years behind. Optional chaining (`?.`) needs
 * Chrome 80 (2020); if the bundle contains it, the whole script fails to
 * parse and the game never starts — a silent, flat screen.
 */
export function checkWebViewCompatibility(code) {
  // Inspect code only: string literals (CSS colours, messages) are stripped
  // so that a value like '#ff8fa3' is not mistaken for a private field.
  const source = code
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

  const banned = [
    { pattern: /\?\./, name: 'optional chaining (?.)', since: 'Chrome 80' },
    { pattern: /\?\?/, name: 'nullish coalescing (??)', since: 'Chrome 80' },
    { pattern: /\?\?=/, name: 'logical assignment (??=)', since: 'Chrome 85' },
    { pattern: /\|\|=/, name: 'logical assignment (||=)', since: 'Chrome 85' },
    { pattern: /&&=/, name: 'logical assignment (&&=)', since: 'Chrome 85' },
    { pattern: /#[A-Za-z_$][\w$]*\s*[;=(]/, name: 'private class fields', since: 'Chrome 74' },
    { pattern: /\bstatic\s*\{/, name: 'static class blocks', since: 'Chrome 94' },
    { pattern: /\.at\s*\(/, name: 'Array.prototype.at', since: 'Chrome 92' },
    { pattern: /\bstructuredClone\s*\(/, name: 'structuredClone', since: 'Chrome 98' },
    { pattern: /\.replaceAll\s*\(/, name: 'String.replaceAll', since: 'Chrome 85' },
    { pattern: /\bObject\.hasOwn\s*\(/, name: 'Object.hasOwn', since: 'Chrome 93' },
    { pattern: /\bPromise\.allSettled\b/, name: 'Promise.allSettled', since: 'Chrome 76' },
    { pattern: /\bObject\.fromEntries\s*\(/, name: 'Object.fromEntries', since: 'Chrome 73' },
    { pattern: /\.matchAll\s*\(/, name: 'String.matchAll', since: 'Chrome 73' },
  ];
  const problems = banned
    .filter((rule) => rule.pattern.test(source))
    .map((rule) => `${rule.name} (needs ${rule.since})`);
  return problems;
}

/**
 * Injects a diagnostic bootstrap into the host page.
 *
 * It is written in ES5 on purpose: it has to run on the oldest WebView we
 * support, and it is the only code that still works when the game bundle
 * itself fails to parse. It turns a silent failure into a readable message
 * on the screen: the script error, the user agent and the browser version.
 */
export function injectDiagnostics(html) {
  const bootstrap = `<script>
/* HeUi diagnostics — ES5 on purpose: this must run on any WebView. */
(function () {
  function chromeVersion() {
    var m = navigator.userAgent.match(/Chrome\\/([0-9.]+)/);
    return m ? m[1] : 'unknown';
  }
  function show(title, detail) {
    try {
      var box = document.createElement('div');
      box.setAttribute('style', 'position:fixed;top:0;left:0;right:0;bottom:0;' +
        'background:#0d1020;color:#ff8fa3;font:12px monospace;padding:24px;' +
        'white-space:pre-wrap;overflow:auto;z-index:99999');
      box.appendChild(document.createTextNode(title + '\\n\\n' + detail));
      document.body.appendChild(box);
    } catch (e) {}
  }
  window.onerror = function (message, source, line, column) {
    show('The game failed to start.', 'Error: ' + message + '\\n' +
      'Source: ' + source + '\\nLine: ' + line + ':' + column + '\\n\\n' +
      'Browser: Chrome ' + chromeVersion() + '\\n' +
      'User agent: ' + navigator.userAgent);
    return true;
  };
  setTimeout(function () {
    if (!window.HEUI_READY) {
      show('The game did not start.', 'No frame was rendered.\\n\\n' +
        'Browser: Chrome ' + chromeVersion() + '\\n' +
        'User agent: ' + navigator.userAgent + '\\n' +
        'Errors above, if any, are the reason.');
    }
  }, 4000);
})();
</script>
`;
  if (html.includes('<!-- heui:diagnostics -->')) return html;
  return html.replace('</head>', `${bootstrap}</head>`);
}

/**
 * Builds the runtime bundle for a project.
 * @returns {{outDir: string, modules: string[], bytes: number}}
 */
export function buildBundle(projectDir, outDir) {
  const manifest = loadManifest(projectDir);
  const entry = path.join(projectDir, manifest.entry);
  if (!fs.existsSync(entry)) {
    throw new Error(`entry point not found: ${entry}`);
  }

  // The bundler root is the repository root so that a project can import the
  // engine from ../../src/index.js.
  const result = bundle(entry, repoRoot);
  const assetsDir = path.join(outDir, 'assets');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'heui.js'), result.code, 'utf8');

  // The bundle runs inside the system WebView, which may be very old.
  const incompatibilities = checkWebViewCompatibility(result.code);
  if (incompatibilities.length > 0) {
    throw new Error(
      `the bundle uses syntax that old Android WebViews cannot parse: ${incompatibilities.join(', ')}`,
    );
  }

  // Static assets: everything under the project's assets/ folder, plus any
  // asset declared in the manifest. Both end up at the same place inside the
  // bundle, so the paths a game uses stay stable.
  const declared = new Set();
  for (const asset of manifest.assets) {
    const src = path.join(projectDir, asset.path);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(outDir, asset.path);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    declared.add(asset.path);
  }
  copyTree(path.join(projectDir, 'assets'), assetsDir);
  for (const name of listFiles(assetsDir)) declared.add(name);

  const runtimeManifest = {
    name: manifest.name,
    displayName: manifest.displayName || manifest.name,
    version: manifest.version || '0.0.0',
    engine: manifest.engine || '0.1.0',
    entry: 'heui.js',
    width: manifest.width || 480,
    height: manifest.height || 270,
    orientation: manifest.orientation || 'any',
    assets: [...declared],
  };
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(runtimeManifest, null, 2)}\n`,
    'utf8',
  );

  // The host page. The project may provide its own; otherwise a default one
  // is generated. The manifest is injected so the game can read it.
  const projectHtml = path.join(projectDir, 'index.html');
  const html = fs.existsSync(projectHtml)
    ? fs.readFileSync(projectHtml, 'utf8')
    : DEFAULT_HTML;
  const injected = html.replace(
    /<script src="\.\/heui\.js"><\/script>/,
    `<script>window.HEUI_MANIFEST = ${JSON.stringify(runtimeManifest)};</script>\n` +
      '    <script src="./heui.js"></script>',
  );
  fs.writeFileSync(path.join(outDir, 'index.html'), injectDiagnostics(injected), 'utf8');

  const bytes = fs.statSync(path.join(outDir, 'heui.js')).size;
  return { outDir, modules: result.modules, bytes, manifest: runtimeManifest };
}

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>HeUi</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0d1020; overflow: hidden; }
      canvas { display: block; width: 100vw; height: 100vh; touch-action: none; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <script src="./heui.js"></script>
  </body>
</html>
`;
function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(
      'usage: heui bundle <project-dir> [--out <dir>]\n       heui bundle-all\n',
    );
    return 0;
  }

  if (command === 'bundle') {
    const projectDir = path.resolve(rest.find((a) => !a.startsWith('--')) || '.');
    const outIndex = rest.indexOf('--out');
    const outDir = outIndex >= 0 ? path.resolve(rest[outIndex + 1]) : path.join(repoRoot, 'tmp', 'bundle');
    const result = buildBundle(projectDir, outDir);
    process.stdout.write(
      `bundled ${result.manifest.name}: ${result.modules.length} modules, ` +
        `${(result.bytes / 1024).toFixed(1)} kB → ${path.relative(repoRoot, result.outDir)}\n`,
    );
    return 0;
  }

  if (command === 'bundle-all') {
    const appsDir = path.join(repoRoot, 'apps');
    if (!fs.existsSync(appsDir)) return 0;
    for (const name of fs.readdirSync(appsDir)) {
      const projectDir = path.join(appsDir, name);
      if (!fs.existsSync(path.join(projectDir, 'project.heui.json'))) continue;
      const outDir = path.join(repoRoot, 'tmp', 'bundle', name);
      const result = buildBundle(projectDir, outDir);
      process.stdout.write(
        `bundled ${result.manifest.name}: ${result.modules.length} modules → ${path.relative(repoRoot, outDir)}\n`,
      );
    }
    return 0;
  }

  process.stderr.write(`unknown command: ${command}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
