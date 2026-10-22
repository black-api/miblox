// HeUi — full release pipeline.
//
// Produces the artifacts of a release:
//   * a signed release APK (and an unsigned one for store upload)
//   * SHA-256 checksums
//   * a release manifest describing every artifact
//
//   node full/release.js [--version 0.1.0]

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildApk } from '../build/build-apk.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function main(argv) {
  const versionIndex = argv.indexOf('--version');
  const version = versionIndex >= 0 ? argv[versionIndex + 1] : '0.1.0';
  const projectDir = path.join(repoRoot, 'apps', 'gem-hunt');
  const outDir = path.join(repoRoot, 'build', 'release', version);

  fs.mkdirSync(outDir, { recursive: true });
  process.stdout.write(`heui release ${version}\n`);

  const result = buildApk(projectDir, { release: true, outDir });

  const artifacts = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith('.apk'))
    .map((name) => {
      const file = path.join(outDir, name);
      return { name, bytes: fs.statSync(file).size, sha256: sha256(file) };
    });

  const checksums = artifacts
    .map((artifact) => `${artifact.sha256}  ${artifact.name}`)
    .join('\n');
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS'), `${checksums}\n`, 'utf8');

  const changelog = path.join(repoRoot, 'versions', `v${version}`, 'CHANGELOG.md');
  const release = {
    version,
    builtAt: new Date().toISOString(),
    package: result.manifest.applicationId,
    minSdk: Number(result.manifest.minSdk),
    targetSdk: Number(result.manifest.targetSdk),
    artifacts,
  };
  fs.writeFileSync(
    path.join(outDir, 'release.json'),
    `${JSON.stringify(release, null, 2)}\n`,
    'utf8',
  );
  if (fs.existsSync(changelog)) {
    fs.copyFileSync(changelog, path.join(outDir, 'CHANGELOG.md'));
  }

  process.stdout.write(`\nartifacts in ${path.relative(repoRoot, outDir)}\n`);
  for (const artifact of artifacts) {
    process.stdout.write(`  ${artifact.name}  ${(artifact.bytes / 1024).toFixed(1)} kB  ${artifact.sha256.slice(0, 16)}…\n`);
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
