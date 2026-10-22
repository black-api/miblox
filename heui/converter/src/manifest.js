// HeUi — project manifest handling.

import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST_NAME = 'project.heui.json';

/** Removes // and /* *\/ comments so manifests can be annotated. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Loads and validates a project manifest.
 * @param {string} projectDir
 */
export function loadManifest(projectDir) {
  const file = path.join(projectDir, MANIFEST_NAME);
  if (!fs.existsSync(file)) {
    throw new Error(`not a HeUi project: ${file} is missing`);
  }
  const manifest = JSON.parse(stripComments(fs.readFileSync(file, 'utf8')));
  const required = ['name', 'entry'];
  for (const key of required) {
    if (!manifest[key]) throw new Error(`manifest is missing "${key}"`);
  }
  manifest.dir = projectDir;
  manifest.android = manifest.android || {};
  manifest.assets = manifest.assets || [];
  return manifest;
}

/** Absolute path of a project file. */
export function projectPath(projectDir, relative) {
  return path.join(projectDir, relative);
}

/** Finds every project file matching a predicate, relative to the project. */
export function listFiles(projectDir, predicate = () => true) {
  const results = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else if (predicate(rel)) results.push(rel);
    }
  };
  walk(projectDir, '');
  return results;
}
