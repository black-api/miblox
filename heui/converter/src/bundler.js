// HeUi — project bundler.
//
// Converts an ES-module project into a single classic script that can run in
// a WebView (where `file://` module loading is blocked by CORS) and in the
// desktop preview. Only the subset of ESM that HeUi projects use is
// supported: named imports/exports, namespace imports and a default export.

import fs from 'node:fs';
import path from 'node:path';

const IMPORT_RE = /^\s*import\s+([^'";]+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"];?\s*$/gm;
const EXPORT_LIST_RE = /^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm;

function resolvePath(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null; // bare import: left to the host
  const base = path.dirname(fromFile);
  let target = path.resolve(base, specifier);
  if (!fs.existsSync(target) && fs.existsSync(`${target}.js`)) {
    target = `${target}.js`;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, 'index.js');
  }
  return target;
}

function parseSpecifier(clause) {
  // "a, b as c" | "ns" (namespace) | "Def" (default) | "Def, { a }"
  const namespace = clause.match(/^\*\s+as\s+(\w+)$/);
  if (namespace) return { kind: 'namespace', name: namespace[1] };

  const named = clause.match(/^\{([^}]*)\}$/);
  if (named) {
    const bindings = named[1]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [imported, local] = part.split(/\s+as\s+/).map((s) => s.trim());
        return { imported, local: local || imported };
      });
    return { kind: 'named', bindings };
  }

  const mixed = clause.match(/^(\w+)\s*,\s*\{([^}]*)\}$/);
  if (mixed) {
    const bindings = mixed[2]
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [imported, local] = part.split(/\s+as\s+/).map((s) => s.trim());
        return { imported, local: local || imported };
      });
    return { kind: 'mixed', default: mixed[1], bindings };
  }

  const def = clause.trim();
  if (/^\w+$/.test(def)) return { kind: 'default', name: def };
  throw new Error(`unsupported import clause: ${clause}`);
}

/**
 * Transforms one module's source into a registry entry.
 * @returns {{id: string, source: string, deps: string[]}}
 */
function transformModule(file, root) {
  let source = fs.readFileSync(file, 'utf8');
  const deps = [];
  const exportNames = new Set();
  let hasDefault = false;

  // import { a } from './x.js'  →  const { a } = __he_require('id');
  source = source.replace(IMPORT_RE, (match, clause, specifier) => {
    const resolved = resolvePath(file, specifier);
    const parsed = parseSpecifier(clause);

    if (!resolved) {
      // Bare specifier (e.g. 'node:fs'): resolved from the global scope at
      // runtime. These are optional: a missing module yields undefined.
      deps.push(`external:${specifier}`);
      const external = `__he_external(${JSON.stringify(specifier)})`;
      if (parsed.kind === 'namespace') {
        return `const ${parsed.name} = ${external} || {};`;
      }
      if (parsed.kind === 'default') {
        return `const ${parsed.name} = (${external} || {}).default;`;
      }
      if (parsed.kind === 'mixed') {
        const pairs = parsed.bindings.map((b) => `${b.imported}: ${b.local}`).join(', ');
        return `const { default: ${parsed.default}, ${pairs} } = ${external} || {};`;
      }
      const pairs = parsed.bindings.map((b) => `${b.imported}: ${b.local}`).join(', ');
      return `const { ${pairs} } = ${external} || {};`;
    }

    const id = path.relative(root, resolved).split(path.sep).join('/');
    deps.push(id);
    const request = `__he_require(${JSON.stringify(id)})`;

    if (parsed.kind === 'namespace') {
      return `const ${parsed.name} = ${request};`;
    }
    if (parsed.kind === 'default') {
      return `const ${parsed.name} = ${request}.default;`;
    }
    if (parsed.kind === 'mixed') {
      const pairs = parsed.bindings.map((b) => `${b.imported}: ${b.local}`).join(', ');
      return `const { default: ${parsed.default}, ${pairs} } = ${request};`;
    }
    const pairs = parsed.bindings.map((b) => `${b.imported}: ${b.local}`).join(', ');
    return `const { ${pairs} } = ${request};`;
  });

  // import './x.js';
  source = source.replace(BARE_IMPORT_RE, (match, specifier) => {
    const resolved = resolvePath(file, specifier);
    if (!resolved) return match;
    const id = path.relative(root, resolved).split(path.sep).join('/');
    deps.push(id);
    return `__he_require(${JSON.stringify(id)});`;
  });

  // export { a, b } from './x.js';  →  import + re-export
  source = source.replace(
    /^\s*export\s*\{([^}]*)\}\s*from\s+['"]([^'"]+)['"];?\s*$/gm,
    (match, list, specifier) => {
      const resolved = resolvePath(file, specifier);
      if (!resolved) return match;
      const id = path.relative(root, resolved).split(path.sep).join('/');
      deps.push(id);
      const entries = list
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [imported, exported] = part.split(/\s+as\s+/).map((s) => s.trim());
          return { imported, exported: exported || imported };
        });
      const local = entries.map((e) => `${e.imported}: __he_reexport_${e.exported}`).join(', ');
      const assignments = entries
        .map((e) => `__he_exports.${e.exported} = __he_reexport_${e.exported};`)
        .join(' ');
      return (
        `const { ${local} } = __he_require(${JSON.stringify(id)}); ${assignments}`
      );
    },
  );

  // export function f() {}  /  export class C {}  /  export const a = 1
  source = source.replace(/^\s*export\s+(async\s+)?function\s+(\w+)/gm, (m, asyncKw, name) => {
    exportNames.add(name);
    return `${asyncKw || ''}function ${name}`;
  });
  source = source.replace(/^\s*export\s+class\s+(\w+)/gm, (m, name) => {
    exportNames.add(name);
    return `class ${name}`;
  });
  source = source.replace(/^\s*export\s+(const|let|var)\s+(\w+)/gm, (m, kind, name) => {
    exportNames.add(name);
    return `${kind} ${name}`;
  });
  source = source.replace(/^\s*export\s+default\s+/gm, () => {
    hasDefault = true;
    return 'const __he_default__ = ';
  });

  // export { a, b as c };
  source = source.replace(EXPORT_LIST_RE, (match, list) => {
    const entries = list
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [local, exported] = part.split(/\s+as\s+/).map((s) => s.trim());
        exportNames.add(exported || local);
        return { local, exported: exported || local };
      });
    const assignments = entries.map((e) => `__he_exports.${e.exported} = ${e.local};`).join(' ');
    return assignments;
  });

  const exportList = [...exportNames];
  const footer = [
    ...exportList.map((name) => `__he_exports.${name} = ${name};`),
    hasDefault ? '__he_exports.default = __he_default__;' : '',
  ]
    .filter(Boolean)
    .join('\n');

  const body = `${source}\n${footer}\nreturn __he_exports;`;
  return { id: path.relative(root, file).split(path.sep).join('/'), source: body, deps };
}

/**
 * Bundles a project entry point into a single classic script.
 * @param {string} entry absolute path of the entry module
 * @param {string} root project root (module ids are relative to it)
 * @returns {{code: string, modules: string[]}}
 */
export function bundle(entry, root) {
  const modules = new Map();
  const queue = [path.resolve(entry)];
  const externals = new Set();

  while (queue.length > 0) {
    const file = queue.pop();
    const id = path.relative(root, file).split(path.sep).join('/');
    if (modules.has(id)) continue;
    const module = transformModule(file, root);
    modules.set(id, module);
    for (const dep of module.deps) {
      if (dep.startsWith('external:')) {
        externals.add(dep.slice('external:'.length));
        continue;
      }
      queue.push(path.resolve(root, dep));
    }
  }

  const parts = [];
  parts.push('(function () {');
  parts.push('  "use strict";');
  parts.push('  const __he_modules__ = {};');
  parts.push('  const __he_cache__ = {};');
  parts.push('  function __he_require(id) {');
  parts.push('    if (__he_cache__[id]) return __he_cache__[id];');
  parts.push('    const factory = __he_modules__[id];');
  parts.push('    if (!factory) throw new Error("heui: missing module " + id);');
  parts.push('    const exports = {};');
  parts.push('    __he_cache__[id] = exports;');
  parts.push('    factory(exports, __he_require);');
  parts.push('    return exports;');
  parts.push('  }');

  for (const [id, module] of modules) {
    parts.push(`  __he_modules__[${JSON.stringify(id)}] = function (__he_exports, __he_require) {`);
    parts.push(module.source);
    parts.push('  };');
  }

  parts.push('  const __he_externals__ = {');
  for (const name of externals) {
    parts.push(
      `    ${JSON.stringify(name)}: typeof globalThis !== "undefined" ? globalThis[${JSON.stringify(name)}] : undefined,`,
    );
  }
  parts.push('  };');
  parts.push('  function __he_external(name) { return __he_externals__[name]; }');
  // The entry module runs immediately, like a script would.
  const entryId = path.relative(root, path.resolve(entry)).split(path.sep).join('/');
  parts.push(`  __he_require(${JSON.stringify(entryId)});`);
  parts.push('  return __he_require;');
  parts.push('})();');

  return { code: parts.join('\n'), modules: [...modules.keys()] };
}

export default bundle;
