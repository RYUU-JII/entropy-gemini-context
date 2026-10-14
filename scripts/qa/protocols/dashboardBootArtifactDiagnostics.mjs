import fs from 'node:fs/promises';
import path from 'node:path';

const DASHBOARD_BOOT_STAGE_ENTRIES = Object.freeze([
  Object.freeze({
    id: 'bootstrap',
    entryKey: 'src/apps/dashboard/main.jsx',
    importerKey: 'src/pages/dashboard.html',
  }),
  Object.freeze({ id: 'react_host', entryKey: 'src/apps/dashboard/dashboardReactHost.jsx' }),
  Object.freeze({ id: 'i18n', entryKey: 'src/i18n/dashboardConfig.js' }),
  Object.freeze({ id: 'document_theme', entryKey: 'src/apps/dashboard/bootstrap/dashboardDocumentThemeInitialization.js' }),
  Object.freeze({ id: 'app', entryKey: 'src/apps/dashboard/App.jsx' }),
]);

function resolveStageManifestKey(manifest, moduleInventory, stage) {
  if (!stage.importerKey) return stage.entryKey;
  const importer = manifest[stage.importerKey];
  if (!importer || typeof importer !== 'object') {
    throw new Error(
      `QA_DASHBOARD_BOOT_ARTIFACT_IMPORTER_MISSING:${stage.importerKey}`,
    );
  }
  const candidates = (importer.dynamicImports || []).filter((manifestKey) => {
    const entry = manifest[manifestKey];
    return (
      entry?.isDynamicEntry === true
      && Array.isArray(moduleInventory?.chunks?.[entry.file])
      && moduleInventory.chunks[entry.file].includes(stage.entryKey)
    );
  });
  if (candidates.length !== 1) {
    throw new Error(
      `QA_DASHBOARD_BOOT_ARTIFACT_ENTRY_PROVENANCE_INVALID`
      + `:${stage.entryKey}:${candidates.length}`,
    );
  }
  return candidates[0];
}

async function readJson(filePath, code) {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${code}:${filePath}`, { cause: error });
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${code}_INVALID:${filePath}`, { cause: error });
  }
}

function collectStaticClosure(manifest, rootKey) {
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    const entry = manifest[key];
    if (!entry || typeof entry !== 'object') {
      throw new Error(`QA_DASHBOARD_BOOT_ARTIFACT_IMPORT_MISSING:${key}`);
    }
    visited.add(key);
    for (const importKey of entry.imports || []) visit(importKey);
  };
  visit(rootKey);
  return visited;
}

async function projectChunk({ artifactPath, key, entry, moduleInventory }) {
  if (typeof entry?.file !== 'string' || !entry.file) {
    throw new Error(`QA_DASHBOARD_BOOT_ARTIFACT_FILE_MISSING:${key}`);
  }
  const filePath = path.join(artifactPath, entry.file);
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    throw new Error(`QA_DASHBOARD_BOOT_ARTIFACT_CHUNK_UNREADABLE:${entry.file}`, {
      cause: error,
    });
  }
  const modules = moduleInventory?.chunks?.[entry.file];
  return Object.freeze({
    key,
    file: entry.file,
    bytes: stat.size,
    moduleCount: Array.isArray(modules) ? modules.length : null,
  });
}

function summarizeChunks(chunks) {
  return Object.freeze({
    chunkCount: chunks.length,
    bytes: chunks.reduce((sum, entry) => sum + entry.bytes, 0),
    moduleCount: chunks.every((entry) => Number.isInteger(entry.moduleCount))
      ? chunks.reduce((sum, entry) => sum + entry.moduleCount, 0)
      : null,
    topChunks: Object.freeze([...chunks]
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 16)),
  });
}

export async function readDashboardBootArtifactGraph({ artifactPath } = {}) {
  if (typeof artifactPath !== 'string' || !path.isAbsolute(artifactPath)) {
    throw new Error('QA_DASHBOARD_BOOT_ARTIFACT_PATH_REQUIRED');
  }
  const manifest = await readJson(
    path.join(artifactPath, '.vite', 'manifest.json'),
    'QA_DASHBOARD_BOOT_ARTIFACT_MANIFEST_UNAVAILABLE',
  );
  const moduleInventory = await readJson(
    path.join(artifactPath, '.vite', 'entropy-module-inventory.json'),
    'QA_DASHBOARD_BOOT_ARTIFACT_MODULE_INVENTORY_UNAVAILABLE',
  );
  const unionKeys = new Set();
  const stages = [];
  for (const stage of DASHBOARD_BOOT_STAGE_ENTRIES) {
    const manifestKey = resolveStageManifestKey(manifest, moduleInventory, stage);
    const closureKeys = collectStaticClosure(manifest, manifestKey);
    closureKeys.forEach((key) => unionKeys.add(key));
    const chunks = await Promise.all([...closureKeys].map((key) => (
      projectChunk({
        artifactPath,
        key,
        entry: manifest[key],
        moduleInventory,
      })
    )));
    stages.push(Object.freeze({
      ...stage,
      manifestKey,
      entryFile: manifest[manifestKey]?.file || null,
      ...summarizeChunks(chunks),
    }));
  }
  const unionChunks = await Promise.all([...unionKeys].map((key) => (
    projectChunk({
      artifactPath,
      key,
      entry: manifest[key],
      moduleInventory,
    })
  )));
  return Object.freeze({
    schemaVersion: 1,
    stages: Object.freeze(stages),
    union: summarizeChunks(unionChunks),
  });
}
