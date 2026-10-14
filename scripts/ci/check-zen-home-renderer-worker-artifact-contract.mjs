#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const CHECK_PREFIX = '[zen-home-renderer-worker-artifact]';
const PUBLIC_RELEASE_PROFILE = 'public';
const DEV_RELEASE_PROFILE = 'dev';
const WORKER_INVENTORY_SCHEMA_VERSION = 2;
const WORKER_INVENTORY_RELATIVE_DIR = '.vite/entropy-worker-module-inventory';
const ZEN_HOME_RENDERER_WORKER_ENTRY = 'src/themes/plugins/zen/runtime/worker/zenHomeRenderer.worker.js';
const RETIRED_INDEPENDENT_RENDERER_WORKER_ENTRIES = new Set([
  'src/themes/plugins/zen/pond/renderers/worker/zenPondRenderer.worker.js',
  'src/themes/plugins/zen/runtime/worker/zenBonsaiRenderer.worker.js',
]);
const FORBIDDEN_RUNTIME_SOURCE_FRAGMENTS = Object.freeze([
  'globalThis.devicePixelRatio',
  'self.devicePixelRatio',
  'window.devicePixelRatio',
  'zen_bonsai_init_timing_v1',
  'zen_pond_first_tick_render_calls_v1',
  'zen_pixi_program_gl_calls_v1',
  'ZEN_POND_CANOPY_PREPARATION_RESEARCH',
  'canopy_pre_draw_prepare',
]);
const BUDGET_METRICS = Object.freeze([
  Object.freeze({ key: 'entryRawBytes', hardLimitKey: 'maxEntryRawBytes' }),
  Object.freeze({ key: 'entryGzipBytes', hardLimitKey: 'maxEntryGzipBytes' }),
  Object.freeze({ key: 'closureRawBytes', hardLimitKey: 'maxClosureRawBytes' }),
  Object.freeze({ key: 'closureGzipBytes', hardLimitKey: 'maxClosureGzipBytes' }),
  Object.freeze({ key: 'projectModules', hardLimitKey: 'maxProjectModules' }),
]);
const MODULE_OWNER = Object.freeze({
  POND: 'pond',
  BONSAI: 'bonsai',
  ARTIFACTS: 'artifacts',
  SHARED: 'shared',
  VENDOR: 'vendor',
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

const assertSafeRelativePath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (
    normalized.includes('\0')
    || path.posix.isAbsolute(normalized)
    || /^[A-Za-z]:\//.test(normalized)
    || normalized === '..'
    || normalized.startsWith('../')
    || normalized.includes('/../')
  ) {
    throw new Error(`${label} must be a safe project-relative path: ${JSON.stringify(value)}`);
  }
};

const readPositiveInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
};

const readNonNegativeInteger = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value;
};

const readGrowthPct = (value, label) => {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new Error(`${label} must be a number greater than 0 and less than 1.`);
  }
  return value;
};

const validateReleaseProfile = (buildInfo) => {
  assertObject(buildInfo, 'entropy build info');
  if (buildInfo.releaseProfile === PUBLIC_RELEASE_PROFILE) return PUBLIC_RELEASE_PROFILE;
  if (buildInfo.releaseProfile === DEV_RELEASE_PROFILE) return DEV_RELEASE_PROFILE;
  throw new Error(
    `entropy build info has missing or unknown releaseProfile: ${String(buildInfo.releaseProfile)}`,
  );
};

const validateLimits = (qualityGateConfig) => {
  assertObject(qualityGateConfig, 'quality gate config');
  assertObject(qualityGateConfig.bundle, 'bundle');
  assertObject(qualityGateConfig.bundle.workerClosures, 'bundle.workerClosures');
  const limits = qualityGateConfig.bundle.workerClosures.zenHomeRenderer;
  assertObject(limits, 'bundle.workerClosures.zenHomeRenderer');
  assertObject(limits.baseline, 'bundle.workerClosures.zenHomeRenderer.baseline');
  assertObject(
    limits.baselineGrowth,
    'bundle.workerClosures.zenHomeRenderer.baselineGrowth',
  );
  assertObject(limits.hardLimits, 'bundle.workerClosures.zenHomeRenderer.hardLimits');
  if (!Array.isArray(limits.forbiddenModuleFragments)) {
    throw new Error(
      'bundle.workerClosures.zenHomeRenderer.forbiddenModuleFragments must be an array.',
    );
  }
  limits.forbiddenModuleFragments.forEach((fragment, index) => {
    if (typeof fragment !== 'string' || fragment.length === 0) {
      throw new Error(
        `bundle.workerClosures.zenHomeRenderer.forbiddenModuleFragments[${index}] `
        + 'must be a non-empty string.',
      );
    }
  });
  const baseline = Object.freeze(Object.fromEntries(BUDGET_METRICS.map(({ key }) => [
    key,
    readPositiveInteger(
      limits.baseline[key],
      `bundle.workerClosures.zenHomeRenderer.baseline.${key}`,
    ),
  ])));
  const baselineGrowth = Object.freeze({
    warnAtPct: readGrowthPct(
      limits.baselineGrowth.warnAtPct,
      'bundle.workerClosures.zenHomeRenderer.baselineGrowth.warnAtPct',
    ),
    failAtPct: readGrowthPct(
      limits.baselineGrowth.failAtPct,
      'bundle.workerClosures.zenHomeRenderer.baselineGrowth.failAtPct',
    ),
  });
  if (baselineGrowth.warnAtPct >= baselineGrowth.failAtPct) {
    throw new Error(
      'bundle.workerClosures.zenHomeRenderer.baselineGrowth.failAtPct '
      + 'must be greater than warnAtPct.',
    );
  }
  const hardLimits = Object.freeze(Object.fromEntries(BUDGET_METRICS.map(({
    hardLimitKey,
  }) => [
    hardLimitKey,
    readPositiveInteger(
      limits.hardLimits[hardLimitKey],
      `bundle.workerClosures.zenHomeRenderer.hardLimits.${hardLimitKey}`,
    ),
  ])));
  BUDGET_METRICS.forEach(({ key, hardLimitKey }) => {
    if (baseline[key] >= hardLimits[hardLimitKey]) {
      throw new Error(
        `bundle.workerClosures.zenHomeRenderer.baseline.${key} must be below `
        + `hardLimits.${hardLimitKey}.`,
      );
    }
    // Absolute and relative ceilings are independent. Reapproving a baseline
    // must not force an increase to an otherwise stricter absolute ceiling.
  });
  return Object.freeze({
    baseline,
    baselineGrowth,
    hardLimits,
    forbiddenModuleFragments: Object.freeze([...limits.forbiddenModuleFragments]),
  });
};

const validateStringArray = (value, label, pathKind = 'artifact') => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  value.forEach((entry, index) => {
    assertSafeRelativePath(entry, `${label}[${index}]`);
    if (pathKind === 'artifact' && !entry.endsWith('.js')) {
      throw new Error(`${label}[${index}] must reference a JavaScript chunk: ${entry}`);
    }
  });
  return value;
};

const validateNonNegativeIntegerArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
  return value.map((entry, index) => readNonNegativeInteger(entry, `${label}[${index}]`));
};

const validateWorkerInventory = (inventory, inventoryPath) => {
  assertObject(inventory, `worker inventory ${inventoryPath}`);
  if (inventory.schemaVersion !== WORKER_INVENTORY_SCHEMA_VERSION) {
    throw new Error(
      `worker inventory schemaVersion must equal ${WORKER_INVENTORY_SCHEMA_VERSION}: ${inventoryPath}`,
    );
  }
  assertSafeRelativePath(inventory.entryModuleId, 'worker inventory entryModuleId');
  assertSafeRelativePath(inventory.entryFile, 'worker inventory entryFile');
  assertObject(inventory.chunks, 'worker inventory chunks');

  const chunks = {};
  for (const [chunkFile, rawChunk] of Object.entries(inventory.chunks)) {
    assertSafeRelativePath(chunkFile, 'worker inventory chunk path');
    assertObject(rawChunk, `worker inventory chunk ${chunkFile}`);
    const modules = validateStringArray(
      rawChunk.modules,
      `worker inventory chunk ${chunkFile}.modules`,
      'module',
    );
    const moduleRenderedBytes = validateNonNegativeIntegerArray(
      rawChunk.moduleRenderedBytes,
      `worker inventory chunk ${chunkFile}.moduleRenderedBytes`,
    );
    if (moduleRenderedBytes.length !== modules.length) {
      throw new Error(
        `worker inventory chunk ${chunkFile}.moduleRenderedBytes must align one-to-one with modules.`,
      );
    }
    chunks[chunkFile] = Object.freeze({
      isEntry: rawChunk.isEntry === true,
      imports: Object.freeze([
        ...validateStringArray(rawChunk.imports, `worker inventory chunk ${chunkFile}.imports`),
      ]),
      dynamicImports: Object.freeze([
        ...validateStringArray(
          rawChunk.dynamicImports,
          `worker inventory chunk ${chunkFile}.dynamicImports`,
        ),
      ]),
      modules: Object.freeze([...modules]),
      moduleRenderedBytes: Object.freeze([...moduleRenderedBytes]),
    });
  }

  const entryChunk = chunks[inventory.entryFile];
  if (!entryChunk) {
    throw new Error(`worker inventory entry chunk is missing: ${inventory.entryFile}`);
  }
  if (entryChunk.isEntry !== true) {
    throw new Error(`worker inventory entry chunk must declare isEntry=true: ${inventory.entryFile}`);
  }
  return Object.freeze({
    entryModuleId: inventory.entryModuleId,
    entryFile: inventory.entryFile,
    chunks: Object.freeze(chunks),
  });
};

const readWorkerInventories = async (distDir) => {
  const inventoryDir = path.resolve(distDir, WORKER_INVENTORY_RELATIVE_DIR);
  let fileNames;
  try {
    fileNames = await fs.readdir(inventoryDir);
  } catch (error) {
    throw new Error(
      `worker module inventory directory is unreadable: ${inventoryDir}: ${error?.message || error}`,
    );
  }
  const inventoryFiles = fileNames.filter((fileName) => fileName.endsWith('.json')).sort();
  if (inventoryFiles.length === 0) {
    throw new Error(`worker module inventory directory has no JSON sidecars: ${inventoryDir}`);
  }
  return Promise.all(inventoryFiles.map(async (fileName) => {
    const inventoryPath = path.resolve(inventoryDir, fileName);
    return validateWorkerInventory(
      await readJson(inventoryPath, 'worker module inventory'),
      inventoryPath,
    );
  }));
};

const collectWorkerChunkClosure = (inventory) => {
  const pending = [inventory.entryFile];
  const visited = new Set();
  while (pending.length > 0) {
    const chunkFile = pending.pop();
    if (visited.has(chunkFile)) continue;
    const chunk = inventory.chunks[chunkFile];
    if (!chunk) {
      throw new Error(
        `worker inventory import is missing from its sub-build: ${inventory.entryFile} -> ${chunkFile}`,
      );
    }
    visited.add(chunkFile);
    pending.push(...chunk.imports, ...chunk.dynamicImports);
  }
  return [...visited].sort();
};

const resolveArtifactPath = (distDir, artifactFile) => {
  assertSafeRelativePath(artifactFile, 'worker artifact path');
  const resolvedDistDir = path.resolve(distDir);
  const artifactPath = path.resolve(resolvedDistDir, artifactFile);
  if (!artifactPath.startsWith(`${resolvedDistDir}${path.sep}`)) {
    throw new Error(`worker artifact resolves outside the dist directory: ${artifactFile}`);
  }
  return artifactPath;
};

const classifyModuleOwner = (moduleId) => {
  if (moduleId.startsWith('node_modules/')) {
    return MODULE_OWNER.VENDOR;
  }
  if (moduleId.startsWith('src/themes/plugins/zen/presentation/artifacts/')
    || moduleId.startsWith('src/themes/plugins/zen/widgets/tools/recipes/')
    || moduleId.endsWith('/ZenEnsoCanvas.js')
    || /\/zenArtifact(?:RendererRuntime|WorkerProtocol|WorkerMessages)\.js$/.test(moduleId)) {
    return MODULE_OWNER.ARTIFACTS;
  }
  if (
    moduleId.startsWith('src/themes/plugins/zen/pond/')
    || moduleId.startsWith('src/domains/nudge/koi/')
  ) {
    return MODULE_OWNER.POND;
  }
  if (
    moduleId.startsWith('src/themes/plugins/zen/model/bonsai/')
    || moduleId.startsWith('src/themes/plugins/zen/model/sakura/')
    || moduleId.includes('/model/ZenPot')
    || /\/[^/]*(?:bonsai|sakura)[^/]*\.[cm]?[jt]sx?$/i.test(moduleId)
  ) {
    return MODULE_OWNER.BONSAI;
  }
  return MODULE_OWNER.SHARED;
};

const createOwnerRenderedBytes = (artifactRecords) => {
  const totals = {
    [MODULE_OWNER.POND]: 0,
    [MODULE_OWNER.BONSAI]: 0,
    [MODULE_OWNER.ARTIFACTS]: 0,
    [MODULE_OWNER.SHARED]: 0,
    [MODULE_OWNER.VENDOR]: 0,
  };
  artifactRecords.forEach((artifact) => {
    artifact.modules.forEach((moduleId, index) => {
      totals[classifyModuleOwner(moduleId)] += artifact.moduleRenderedBytes[index];
    });
  });
  return Object.freeze(totals);
};

const formatPct = (ratio) => (ratio * 100).toFixed(2);

const formatSignedPct = (ratio) => `${ratio >= 0 ? '+' : ''}${formatPct(ratio)}%`;

export async function checkZenHomeRendererWorkerArtifactContract(distDir, options = {}) {
  const resolvedDistDir = path.resolve(distDir);
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : process.cwd();
  const buildInfo = await readJson(
    path.resolve(resolvedDistDir, 'entropy-build-info.json'),
    'entropy build info',
  );
  const releaseProfile = validateReleaseProfile(buildInfo);
  if (releaseProfile === DEV_RELEASE_PROFILE) {
    return Object.freeze({ skipped: true, releaseProfile });
  }

  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.resolve(rootDir, 'scripts/ci/quality-gate.config.json');
  const limits = validateLimits(await readJson(configPath, 'quality gate config'));
  const inventories = await readWorkerInventories(resolvedDistDir);
  const retiredIndependentInventories = inventories.filter(
    (inventory) => RETIRED_INDEPENDENT_RENDERER_WORKER_ENTRIES.has(inventory.entryModuleId),
  );
  if (retiredIndependentInventories.length > 0) {
    throw new Error(
      'retired independent Zen Pond/Bonsai worker inventories must be absent; found '
      + retiredIndependentInventories
        .map((inventory) => inventory.entryModuleId)
        .sort()
        .join(', '),
    );
  }
  const matchingInventories = inventories.filter(
    (inventory) => inventory.entryModuleId === ZEN_HOME_RENDERER_WORKER_ENTRY,
  );
  if (matchingInventories.length !== 1) {
    throw new Error(
      `expected exactly one Zen Home renderer worker inventory for ${ZEN_HOME_RENDERER_WORKER_ENTRY}; `
      + `found ${matchingInventories.length}`,
    );
  }
  const inventory = matchingInventories[0];
  const closureFiles = collectWorkerChunkClosure(inventory);
  const artifactRecords = await Promise.all(closureFiles.map(async (artifactFile) => {
    const artifactPath = resolveArtifactPath(resolvedDistDir, artifactFile);
    let source;
    try {
      source = await fs.readFile(artifactPath);
    } catch (error) {
      throw new Error(
        `worker artifact is unreadable: ${artifactFile}: ${error?.message || error}`,
      );
    }
    return Object.freeze({
      file: artifactFile,
      source: source.toString('utf8'),
      rawBytes: source.byteLength,
      gzipBytes: gzipSync(source, { mtime: 0 }).byteLength,
      modules: inventory.chunks[artifactFile].modules,
      moduleRenderedBytes: inventory.chunks[artifactFile].moduleRenderedBytes,
    });
  }));
  const entryArtifact = artifactRecords.find((artifact) => artifact.file === inventory.entryFile);
  if (!entryArtifact) {
    throw new Error(`Zen Home renderer worker entry artifact is missing: ${inventory.entryFile}`);
  }
  const projectModules = [...new Set(artifactRecords.flatMap((artifact) => artifact.modules))].sort();
  const forbiddenModules = projectModules.flatMap((moduleId) => (
    limits.forbiddenModuleFragments
      .filter((fragment) => moduleId.includes(fragment))
      .map((fragment) => ({ moduleId, fragment }))
  ));
  const metrics = Object.freeze({
    entryRawBytes: entryArtifact.rawBytes,
    entryGzipBytes: entryArtifact.gzipBytes,
    closureFiles: artifactRecords.length,
    closureRawBytes: artifactRecords.reduce((sum, artifact) => sum + artifact.rawBytes, 0),
    closureGzipBytes: artifactRecords.reduce((sum, artifact) => sum + artifact.gzipBytes, 0),
    projectModules: projectModules.length,
    ownerRenderedBytes: createOwnerRenderedBytes(artifactRecords),
  });
  const baselineDeltas = Object.freeze(Object.fromEntries(BUDGET_METRICS.map(({ key }) => {
    const baseline = limits.baseline[key];
    const actual = metrics[key];
    return [key, Object.freeze({
      actual,
      baseline,
      delta: actual - baseline,
      growthPct: (actual - baseline) / baseline,
    })];
  })));
  const warnings = [];
  const violations = [];
  BUDGET_METRICS.forEach(({ key, hardLimitKey }) => {
    const delta = baselineDeltas[key];
    if (metrics[key] > limits.hardLimits[hardLimitKey]) {
      violations.push(
        `hardLimitExceeded metric=${key} actual=${metrics[key]} `
        + `limit=${limits.hardLimits[hardLimitKey]}`,
      );
    }
    if (delta.growthPct > limits.baselineGrowth.failAtPct) {
      violations.push(
        `baselineGrowthExceeded metric=${key} actual=${delta.actual} baseline=${delta.baseline} `
        + `growthPct=${formatPct(delta.growthPct)} `
        + `limitPct=${formatPct(limits.baselineGrowth.failAtPct)}`,
      );
    } else if (delta.growthPct > limits.baselineGrowth.warnAtPct) {
      warnings.push(
        `baselineGrowthWarning metric=${key} actual=${delta.actual} baseline=${delta.baseline} `
        + `growthPct=${formatPct(delta.growthPct)} `
        + `warnAtPct=${formatPct(limits.baselineGrowth.warnAtPct)}`,
      );
    }
  });
  forbiddenModules.forEach(({ moduleId, fragment }) => {
    violations.push(`forbiddenModuleFragment=${fragment} reachableModule=${moduleId}`);
  });
  artifactRecords.forEach((artifact) => {
    FORBIDDEN_RUNTIME_SOURCE_FRAGMENTS.forEach((fragment) => {
      if (artifact.source.includes(fragment)) {
        violations.push(`forbiddenRuntimeSourceFragment=${fragment} artifact=${artifact.file}`);
      }
    });
  });

  return Object.freeze({
    skipped: false,
    releaseProfile,
    entryModuleId: inventory.entryModuleId,
    entryFile: inventory.entryFile,
    metrics,
    limits,
    baselineDeltas,
    projectModules: Object.freeze(projectModules),
    warnings: Object.freeze(warnings),
    violations: Object.freeze(violations),
  });
}

export async function runZenHomeRendererWorkerArtifactContractCli(distDir, options = {}) {
  const writeStdout = options.writeStdout || console.log;
  const writeStderr = options.writeStderr || console.error;
  try {
    const report = await checkZenHomeRendererWorkerArtifactContract(distDir, options);
    if (report.skipped) {
      writeStdout(`${CHECK_PREFIX} SKIP: releaseProfile=${report.releaseProfile}`);
      return 0;
    }
    report.warnings.forEach((warning) => writeStderr(`${CHECK_PREFIX} WARN: ${warning}`));
    if (report.violations.length > 0) {
      report.violations.forEach((violation) => writeStderr(`${CHECK_PREFIX} FAIL: ${violation}`));
      return 1;
    }
    writeStdout(
      `${CHECK_PREFIX} PASS: entry=${report.entryFile}`
      + ` raw=${report.metrics.entryRawBytes}`
      + ` gzip=${report.metrics.entryGzipBytes}`
      + ` closureFiles=${report.metrics.closureFiles}`
      + ` closureRaw=${report.metrics.closureRawBytes}`
      + ` closureGzip=${report.metrics.closureGzipBytes}`
      + ` projectModules=${report.metrics.projectModules}`
      + ` baselineGrowth=${BUDGET_METRICS.map(({ key }) => (
        `${key}:${formatSignedPct(report.baselineDeltas[key].growthPct)}`
      )).join(',')}`
      + ` ownerRendered=${Object.entries(report.metrics.ownerRenderedBytes)
        .map(([owner, bytes]) => `${owner}:${bytes}`)
        .join(',')}`,
    );
    return 0;
  } catch (error) {
    writeStderr(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
    return 1;
  }
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const distDir = process.argv[2] || 'dist-prod';
  process.exitCode = await runZenHomeRendererWorkerArtifactContractCli(distDir);
}
