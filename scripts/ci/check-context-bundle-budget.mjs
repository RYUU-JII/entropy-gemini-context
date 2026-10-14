#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const CHECK_PREFIX = '[context-bundle-budget]';
const PUBLIC_RELEASE_PROFILE = 'public';
const DEV_RELEASE_PROFILE = 'dev';
const MODULE_INVENTORY_SCHEMA_VERSION = 1;
const MODULE_INVENTORY_RELATIVE_PATH = '.vite/entropy-module-inventory.json';

export const CONTEXT_ENTRY_KEYS = Object.freeze({
  background: 'src/apps/background/index.js',
  popup: 'src/pages/popup.html',
  dashboardMain: 'src/apps/dashboard/main.jsx',
  zenHome: 'src/themes/plugins/zen/widgets/core/ZenCoreStatusClassicHome.jsx',
});

const readJson = async (filePath, label) => {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${label} is unreadable: ${filePath}: ${error?.message || error}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${filePath}: ${error?.message || error}`);
  }
};

const assertObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
};

const readPositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
};

const validateContextConfig = (config, contextId) => {
  assertObject(config, `bundle.contextStaticClosures.${contextId}`);

  if (config.fileCountPolicy !== 'enforced' && config.fileCountPolicy !== 'advisory') {
    throw new Error(
      `bundle.contextStaticClosures.${contextId}.fileCountPolicy must be "enforced" or "advisory".`,
    );
  }

  const forbiddenAssetFragments = config.forbiddenAssetFragments;
  if (!Array.isArray(forbiddenAssetFragments)) {
    throw new Error(
      `bundle.contextStaticClosures.${contextId}.forbiddenAssetFragments must be an array.`,
    );
  }
  forbiddenAssetFragments.forEach((fragment, index) => {
    if (typeof fragment !== 'string' || fragment.length === 0) {
      throw new Error(
        `bundle.contextStaticClosures.${contextId}.forbiddenAssetFragments[${index}] `
        + 'must be a non-empty string.',
      );
    }
  });

  return Object.freeze({
    fileCountPolicy: config.fileCountPolicy,
    maxFiles: readPositiveInteger(
      config.maxFiles,
      `bundle.contextStaticClosures.${contextId}.maxFiles`,
    ),
    maxRawBytes: readPositiveInteger(
      config.maxRawBytes,
      `bundle.contextStaticClosures.${contextId}.maxRawBytes`,
    ),
    maxGzipBytes: readPositiveInteger(
      config.maxGzipBytes,
      `bundle.contextStaticClosures.${contextId}.maxGzipBytes`,
    ),
    forbiddenAssetFragments: Object.freeze([...forbiddenAssetFragments]),
  });
};

const validateConfig = (qualityGateConfig) => {
  assertObject(qualityGateConfig, 'quality gate config');
  assertObject(qualityGateConfig.bundle, 'bundle');
  assertObject(
    qualityGateConfig.bundle.contextStaticClosures,
    'bundle.contextStaticClosures',
  );

  return Object.fromEntries(Object.keys(CONTEXT_ENTRY_KEYS).map((contextId) => [
    contextId,
    validateContextConfig(qualityGateConfig.bundle.contextStaticClosures[contextId], contextId),
  ]));
};

const validateReleaseProfile = (buildInfo) => {
  assertObject(buildInfo, 'entropy build info');
  const { releaseProfile } = buildInfo;
  if (releaseProfile === DEV_RELEASE_PROFILE) return releaseProfile;
  if (releaseProfile === PUBLIC_RELEASE_PROFILE) return releaseProfile;
  throw new Error(
    `entropy build info has missing or unknown releaseProfile: ${String(releaseProfile)}`,
  );
};

const assertSafeInventoryPath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.includes('\0')
    || path.posix.isAbsolute(normalized)
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    throw new Error(`${label} must be a safe project-relative path: ${value}`);
  }
};

const validateModuleInventory = (moduleInventory) => {
  assertObject(moduleInventory, 'artifact module inventory');
  if (moduleInventory.schemaVersion !== MODULE_INVENTORY_SCHEMA_VERSION) {
    throw new Error(
      `artifact module inventory schemaVersion must equal ${MODULE_INVENTORY_SCHEMA_VERSION}.`,
    );
  }
  assertObject(moduleInventory.chunks, 'artifact module inventory chunks');

  for (const [artifactFile, moduleIds] of Object.entries(moduleInventory.chunks)) {
    assertSafeInventoryPath(artifactFile, 'artifact module inventory chunk path');
    if (!Array.isArray(moduleIds)) {
      throw new Error(`artifact module inventory chunk must contain an array: ${artifactFile}`);
    }
    moduleIds.forEach((moduleId, index) => {
      assertSafeInventoryPath(
        moduleId,
        `artifact module inventory ${artifactFile}[${index}]`,
      );
    });
  }

  return moduleInventory.chunks;
};

const getStaticImports = (entry, manifestKey) => {
  if (entry.imports === undefined) return [];
  if (!Array.isArray(entry.imports)) {
    throw new Error(`manifest entry imports must be an array: ${manifestKey}`);
  }
  entry.imports.forEach((importKey, index) => {
    if (typeof importKey !== 'string' || importKey.length === 0) {
      throw new Error(`manifest entry has an invalid static import: ${manifestKey}[${index}]`);
    }
  });
  return entry.imports;
};

export function collectStaticManifestClosure(manifest, rootKey) {
  assertObject(manifest, 'Vite manifest');
  if (!Object.hasOwn(manifest, rootKey)) {
    throw new Error(`manifest context root is missing: ${rootKey}`);
  }

  const pending = [rootKey];
  const visited = new Set();
  while (pending.length > 0) {
    const manifestKey = pending.pop();
    if (visited.has(manifestKey)) continue;

    const entry = manifest[manifestKey];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`manifest static import is missing: ${manifestKey}`);
    }
    if (typeof entry.file !== 'string' || entry.file.length === 0) {
      throw new Error(`manifest entry file is missing: ${manifestKey}`);
    }

    visited.add(manifestKey);
    getStaticImports(entry, manifestKey).forEach((importKey) => {
      if (!Object.hasOwn(manifest, importKey)) {
        throw new Error(`manifest static import is missing: ${manifestKey} -> ${importKey}`);
      }
      if (!visited.has(importKey)) pending.push(importKey);
    });
  }

  return visited;
}

export function resolveContextManifestRootKey({
  manifest,
  moduleInventoryChunks,
  rootSourceId,
}) {
  assertObject(manifest, 'Vite manifest');
  assertObject(moduleInventoryChunks, 'artifact module inventory chunks');
  if (Object.hasOwn(manifest, rootSourceId)) return rootSourceId;

  const owningArtifactFiles = Object.entries(moduleInventoryChunks)
    .filter(([, moduleIds]) => Array.isArray(moduleIds) && moduleIds.includes(rootSourceId))
    .map(([artifactFile]) => artifactFile);
  if (owningArtifactFiles.length === 0) {
    throw new Error(
      `manifest context root source is missing from module inventory: ${rootSourceId}`,
    );
  }
  if (owningArtifactFiles.length !== 1) {
    throw new Error(
      `manifest context root source has ambiguous artifact ownership: ${rootSourceId}`
      + ` -> ${owningArtifactFiles.join(',')}`,
    );
  }

  const [owningArtifactFile] = owningArtifactFiles;
  const manifestEntryKeys = Object.entries(manifest)
    .filter(([, entry]) => (
      entry?.file === owningArtifactFile
      && (entry?.isEntry === true || entry?.isDynamicEntry === true)
    ))
    .map(([manifestKey]) => manifestKey);
  if (manifestEntryKeys.length === 0) {
    throw new Error(
      `manifest context root artifact has no entry identity: ${rootSourceId}`
      + ` -> ${owningArtifactFile}`,
    );
  }
  if (manifestEntryKeys.length !== 1) {
    throw new Error(
      `manifest context root artifact has ambiguous entry identity: ${rootSourceId}`
      + ` -> ${owningArtifactFile} -> ${manifestEntryKeys.join(',')}`,
    );
  }
  return manifestEntryKeys[0];
}

const resolveArtifactPath = (distDir, artifactFile) => {
  if (path.isAbsolute(artifactFile)) {
    throw new Error(`manifest artifact path must be relative: ${artifactFile}`);
  }
  const artifactPath = path.resolve(distDir, artifactFile);
  const relativePath = path.relative(distDir, artifactPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
    throw new Error(`manifest artifact escapes the build output: ${artifactFile}`);
  }
  return artifactPath;
};

const measureContext = async ({
  contextId,
  rootKey,
  manifest,
  moduleInventoryChunks,
  distDir,
  limits,
  maxOverheadPct = 0,
}) => {
  const manifestRootKey = resolveContextManifestRootKey({
    manifest,
    moduleInventoryChunks,
    rootSourceId: rootKey,
  });
  const closureKeys = collectStaticManifestClosure(manifest, manifestRootKey);
  const assetsByFile = new Map();

  closureKeys.forEach((manifestKey) => {
    const artifactFile = manifest[manifestKey].file;
    if (!artifactFile.endsWith('.js')) return;
    const existing = assetsByFile.get(artifactFile);
    if (existing) {
      existing.manifestKeys.push(manifestKey);
      return;
    }
    assetsByFile.set(artifactFile, {
      file: artifactFile,
      manifestKeys: [manifestKey],
    });
  });

  const assets = await Promise.all([...assetsByFile.values()].map(async (asset) => {
    const moduleIds = moduleInventoryChunks[asset.file];
    if (!Array.isArray(moduleIds)) {
      throw new Error(`artifact module inventory is missing a static chunk: ${asset.file}`);
    }
    const artifactPath = resolveArtifactPath(distDir, asset.file);
    let source;
    try {
      source = await fs.readFile(artifactPath);
    } catch (error) {
      throw new Error(
        `manifest artifact is unreadable: ${asset.file}: ${error?.message || error}`,
      );
    }
    return Object.freeze({
      ...asset,
      moduleIds: Object.freeze([...moduleIds]),
      rawBytes: source.byteLength,
      gzipBytes: gzipSync(source, { mtime: 0 }).byteLength,
    });
  }));

  assets.sort((left, right) => left.file.localeCompare(right.file));
  const metrics = Object.freeze({
    files: assets.length,
    rawBytes: assets.reduce((sum, asset) => sum + asset.rawBytes, 0),
    gzipBytes: assets.reduce((sum, asset) => sum + asset.gzipBytes, 0),
  });

  const violations = [];
  const warnings = [];

  const checkMetric = (name, actual, limit) => {
    if (actual > limit) {
      const hardLimit = limit + Math.floor(limit * maxOverheadPct);
      if (actual > hardLimit) {
        violations.push(`${name}=${actual} limit=${limit} (hard=${hardLimit})`);
      } else {
        warnings.push(`${name}=${actual} limit=${limit} (hard=${hardLimit})`);
      }
    }
  };

  if (limits.fileCountPolicy === 'advisory') {
    if (metrics.files > limits.maxFiles) {
      warnings.push(`files=${metrics.files} reference=${limits.maxFiles} (policy=advisory)`);
    }
  } else {
    checkMetric('files', metrics.files, limits.maxFiles);
  }
  checkMetric('rawBytes', metrics.rawBytes, limits.maxRawBytes);
  checkMetric('gzipBytes', metrics.gzipBytes, limits.maxGzipBytes);

  for (const fragment of limits.forbiddenAssetFragments) {
    const forbiddenAsset = assets.find((asset) => (
      asset.file.includes(fragment)
      || asset.manifestKeys.some((manifestKey) => manifestKey.includes(fragment))
      || asset.moduleIds.some((moduleId) => moduleId.includes(fragment))
    ));
    if (forbiddenAsset) {
      const reachableModule = forbiddenAsset.moduleIds.find((moduleId) => (
        moduleId.includes(fragment)
      ));
      violations.push(
        `forbiddenAssetFragment=${fragment} reachableAsset=${forbiddenAsset.file}`
        + (reachableModule ? ` reachableModule=${reachableModule}` : ''),
      );
    }
  }

  return Object.freeze({
    contextId,
    rootKey,
    manifestRootKey,
    metrics,
    limits,
    assets: Object.freeze(assets),
    violations: Object.freeze(violations),
    warnings: Object.freeze(warnings),
  });
};

export async function checkContextBundleBudget(distDir, options = {}) {
  const resolvedDistDir = path.resolve(distDir);
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : process.cwd();
  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.resolve(rootDir, 'scripts/ci/quality-gate.config.json');
  const buildInfoPath = path.resolve(resolvedDistDir, 'entropy-build-info.json');
  const buildInfo = await readJson(buildInfoPath, 'entropy build info');
  const releaseProfile = validateReleaseProfile(buildInfo);

  if (releaseProfile === DEV_RELEASE_PROFILE) {
    return Object.freeze({ skipped: true, releaseProfile, contexts: Object.freeze({}) });
  }

  const qualityGateConfig = await readJson(configPath, 'quality gate config');
  const contextLimits = validateConfig(qualityGateConfig);
  const manifestPath = path.resolve(resolvedDistDir, '.vite/manifest.json');
  const manifest = await readJson(manifestPath, 'Vite manifest');
  const moduleInventoryPath = path.resolve(resolvedDistDir, MODULE_INVENTORY_RELATIVE_PATH);
  const moduleInventory = await readJson(moduleInventoryPath, 'artifact module inventory');
  const moduleInventoryChunks = validateModuleInventory(moduleInventory);

  const maxOverheadPct = typeof qualityGateConfig.bundle?.maxOverheadPct === 'number'
    ? qualityGateConfig.bundle.maxOverheadPct
    : 0;

  const contextReports = await Promise.all(Object.entries(CONTEXT_ENTRY_KEYS).map(
    ([contextId, rootKey]) => measureContext({
      contextId,
      rootKey,
      manifest,
      moduleInventoryChunks,
      distDir: resolvedDistDir,
      limits: contextLimits[contextId],
      maxOverheadPct,
    }),
  ));

  const violations = contextReports.flatMap((report) => report.violations.map(
    (violation) => `${report.contextId}: ${violation}`,
  ));
  const warnings = contextReports.flatMap((report) => report.warnings.map(
    (warning) => `${report.contextId}: ${warning}`,
  ));
  if (violations.length > 0) {
    throw new Error(`context static closure contract failed:\n- ${violations.join('\n- ')}`);
  }

  return Object.freeze({
    skipped: false,
    releaseProfile,
    contexts: Object.freeze(Object.fromEntries(
      contextReports.map((report) => [report.contextId, report]),
    )),
    warnings: Object.freeze(warnings),
  });
}

export async function runContextBundleBudgetCli(distDir, io = {}) {
  const writeStdout = io.writeStdout ?? ((message) => console.log(message));
  const writeStderr = io.writeStderr ?? ((message) => console.error(message));

  try {
    const report = await checkContextBundleBudget(distDir, io);
    if (report.skipped) {
      writeStdout(`${CHECK_PREFIX} SKIP: releaseProfile=${report.releaseProfile}`);
      return 0;
    }

    Object.values(report.contexts).forEach((context) => {
      writeStdout(
        `${CHECK_PREFIX} PASS ${context.contextId}: files=${context.metrics.files} `
        + `raw=${context.metrics.rawBytes}B gzip=${context.metrics.gzipBytes}B`,
      );
    });

    if (report.warnings && report.warnings.length > 0) {
      report.warnings.forEach((warning) => {
        writeStdout(`${CHECK_PREFIX} WARN: ${warning}`);
      });
    }

    writeStdout(`${CHECK_PREFIX} PASS: context static closure budgets satisfied.`);
    return 0;
  } catch (error) {
    writeStderr(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
    return 1;
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const distDir = path.resolve(process.cwd(), process.argv[2] || 'dist-prod');
  process.exitCode = await runContextBundleBudgetCli(distDir);
}
