import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readFlowEvaluationHashes } from './flowEvaluationSourceSnapshot.mjs';

export const FLOW_MEASURED_SOURCE_SCOPE = Object.freeze({
  kind: 'broad_repository_input_inventory_not_resolved_import_graph',
  trees: Object.freeze(['src', 'scripts', 'tests']),
  rootInputs: 'package.json, package-lock.json, .nvmrc, optional npm/node config and root Vite/Vitest/CSS configuration',
  limits: Object.freeze(['Installed node_modules bytes and host environment are not hashed.',
    'This inventory is intentionally broader than the imported runtime closure.',
    'Only files present at both endpoints are checked; transient edits restored during execution are not detected.']),
});

const REQUIRED_ROOT_FILES = ['package.json', 'package-lock.json', '.nvmrc'];
const OPTIONAL_ROOT_FILES = new Set(['.npmrc', '.node-version', 'vitest.shared.js',
  'vite.config.js', 'vite.landing.config.js', 'tailwind.config.js']);

async function inventory(root) {
  const files = [];
  async function visit(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    for (const entry of entries) {
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`FLOW_MEASURED_SOURCE_SYMLINK_UNSUPPORTED:${file}`);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
      else throw new Error(`FLOW_MEASURED_SOURCE_TYPE_UNSUPPORTED:${file}`);
    }
  }
  for (const tree of FLOW_MEASURED_SOURCE_SCOPE.trees) await visit(tree);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!REQUIRED_ROOT_FILES.includes(entry.name) && !OPTIONAL_ROOT_FILES.has(entry.name)
      && !/^vite(?:st)?(?:\.[^.]+)*\.config\.[cm]?[jt]s$/.test(entry.name)) continue;
    if (!entry.isFile()) throw new Error(`FLOW_MEASURED_SOURCE_TYPE_UNSUPPORTED:${entry.name}`);
    files.push(entry.name);
  }
  return [...new Set(files)].sort();
}

async function hashInventory(root, files) {
  const hashes = {};
  // Reuse the canonical hash helper without opening the entire broad inventory
  // at once; native Windows file-handle availability is bounded.
  for (let index = 0; index < files.length; index += 64) {
    Object.assign(hashes, await readFlowEvaluationHashes(root, files.slice(index, index + 64)));
  }
  return Object.freeze(hashes);
}

export async function snapshotFlowMeasuredSources(root) {
  const files = await inventory(root);
  const missing = REQUIRED_ROOT_FILES.filter((file) => !files.includes(file));
  if (missing.length) throw new Error(`FLOW_MEASURED_REQUIRED_SOURCES_MISSING:${missing.join(',')}`);
  return Object.freeze({ scope: FLOW_MEASURED_SOURCE_SCOPE, files: Object.freeze(files),
    hashes: await hashInventory(root, files) });
}

export async function assertFlowMeasuredSourcesUnchanged(root, before) {
  const files = await inventory(root);
  const oldPaths = new Set(before.files);
  const newPaths = new Set(files);
  const addedFiles = files.filter((file) => !oldPaths.has(file));
  const removedFiles = before.files.filter((file) => !newPaths.has(file));
  const hashes = await hashInventory(root, files);
  const changedFiles = files.filter((file) => oldPaths.has(file) && hashes[file] !== before.hashes[file]);
  if (addedFiles.length || removedFiles.length || changedFiles.length) {
    const error = new Error('FLOW_MEASURED_SOURCES_CHANGED');
    Object.assign(error, { addedFiles, removedFiles, changedFiles });
    throw error;
  }
}
