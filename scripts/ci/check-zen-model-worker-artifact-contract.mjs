#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK_PREFIX = '[zen-model-worker-artifact]';
const DEV_RELEASE_PROFILE = 'dev';
const PUBLIC_RELEASE_PROFILE = 'public';
const WORKER_INVENTORY_SCHEMA_VERSION = 2;
const WORKER_INVENTORY_RELATIVE_DIR = '.vite/entropy-worker-module-inventory';
const PRODUCT_MODEL_WORKER_ENTRY = 'src/themes/plugins/zen/workers/zenBonsaiModel.worker.js';
const REQUIRED_WORKER_ENTRY_MODULES = Object.freeze([
  'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js',
  'src/themes/plugins/zen/workers/zenLatentOptimizer.worker.js',
]);
const REQUIRED_MODULE_FRAGMENTS = Object.freeze([
  'src/platform/storage/themes/zen/ZenWorkerModelRepository.js',
  'src/platform/storage/themes/zen/ZenThemeProfileGenerationLease.js',
]);
const FORBIDDEN_MODULE_FRAGMENTS = Object.freeze([
  'src/platform/storage/runtime/ProfileResetLifecycleRepository.js',
  'src/platform/storage/themes/zen/ZenThemeLifecycleProfileGenerationLease.js',
  'src/platform/storage/themes/zen/ZenModelRepository.js',
  'src/themes/plugins/zen/state/ZenModelRepository.js',
  'src/platform/storage/internal/chrome-storage/',
]);
const REQUIRED_MODULE_FRAGMENTS_BY_ENTRY = Object.freeze({
  [PRODUCT_MODEL_WORKER_ENTRY]: Object.freeze([
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeGeneratedRequest.js',
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeModelOperationCore.js',
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeSpecies.js',
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeProductStudy.js',
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeProjectionTransport.js',
    'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeLifeAppearance.js',
    'src/themes/plugins/zen/model/bonsai/plume/cloud/zenGeneratedRhythmObservationCopy.js',
  ]),
  'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js': Object.freeze([
    'src/themes/plugins/zen/model/SakuraStructuralABSpecies.js',
    'src/themes/plugins/zen/model/sakura/sakuraStructuralBranchGenerator.js',
    'src/themes/plugins/zen/model/sakura/sakuraTrunkScaffoldGenerator.js',
    'src/themes/plugins/zen/model/bonsai/scoring/candidateScoreBlending.js',
  ]),
});
const FORBIDDEN_MODULE_FRAGMENTS_BY_ENTRY = Object.freeze({
  [PRODUCT_MODEL_WORKER_ENTRY]: Object.freeze([
    'ZenBonsaiPlumeModelOperations.js',
    'src/platform/storage/', 'src/themes/plugins/zen/state/',
    'node_modules/react/', 'node_modules/react-dom/',
    'src/themes/plugins/zen/pond/', 'src/themes/plugins/zen/runtime/worker/',
    'ZenBonsaiPlumeRenderSpecies.js', 'ZenBonsaiPlumeSpeciesDescriptor.js',
    'api/researchLearning.js',
  ]),
  'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js': Object.freeze([
    'src/themes/plugins/zen/api/researchLearning.js',
    'src/themes/plugins/zen/model/SakuraSpecies.js',
    'src/themes/plugins/zen/model/SakuraStructuralSpecies.js',
    'src/themes/plugins/zen/model/sakura/sakuraRenderer.js',
    'src/themes/plugins/zen/model/sakura/sakuraCanopyBloom.js',
    'src/themes/plugins/zen/model/sakura/sakuraTwigPass.js',
    'src/themes/plugins/zen/model/sakura/sakuraTwigBranchEmitter.js',
    'src/themes/plugins/zen/model/bonsai/rendering/measureBonsaiSceneBounds.js',
    'src/themes/plugins/zen/model/ZenPotRenderer.js',
    'src/themes/plugins/zen/model/ZenCoreConfigAssetCache.js',
    'src/themes/plugins/zen/model/TreeAnalyzer.js',
  ]),
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

const requireObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
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
    const inventory = requireObject(
      await readJson(inventoryPath, 'worker module inventory'),
      `worker module inventory ${inventoryPath}`,
    );
    if (inventory.schemaVersion !== WORKER_INVENTORY_SCHEMA_VERSION) {
      throw new Error(
        `worker module inventory schemaVersion must equal `
        + `${WORKER_INVENTORY_SCHEMA_VERSION}: ${inventoryPath}`,
      );
    }
    if (typeof inventory.entryModuleId !== 'string' || !inventory.entryModuleId) {
      throw new Error(`worker module inventory entryModuleId is invalid: ${inventoryPath}`);
    }
    const chunks = requireObject(inventory.chunks, `worker module inventory chunks ${inventoryPath}`);
    const modules = [];
    Object.entries(chunks).forEach(([chunkFile, chunk]) => {
      requireObject(chunk, `worker module inventory chunk ${chunkFile}`);
      if (!Array.isArray(chunk.modules)) {
        throw new Error(`worker module inventory chunk modules must be an array: ${chunkFile}`);
      }
      if (!Array.isArray(chunk.moduleRenderedBytes)) {
        throw new Error(
          `worker module inventory chunk moduleRenderedBytes must be an array: ${chunkFile}`,
        );
      }
      if (chunk.moduleRenderedBytes.length !== chunk.modules.length) {
        throw new Error(
          `worker module inventory chunk moduleRenderedBytes must align one-to-one with modules: `
          + chunkFile,
        );
      }
      chunk.modules.forEach((moduleId) => {
        if (typeof moduleId !== 'string' || !moduleId) {
          throw new Error(`worker module inventory module id is invalid: ${chunkFile}`);
        }
        modules.push(moduleId.replaceAll('\\', '/'));
      });
      chunk.moduleRenderedBytes.forEach((renderedBytes) => {
        if (!Number.isSafeInteger(renderedBytes) || renderedBytes < 0) {
          throw new Error(
            `worker module inventory rendered byte count is invalid: ${chunkFile}`,
          );
        }
      });
    });
    return Object.freeze({
      entryModuleId: inventory.entryModuleId.replaceAll('\\', '/'),
      modules: Object.freeze([...new Set(modules)].sort()),
    });
  }));
};

export async function checkZenModelWorkerArtifactContract(distDir) {
  const resolvedDistDir = path.resolve(distDir);
  const buildInfo = requireObject(
    await readJson(
      path.resolve(resolvedDistDir, 'entropy-build-info.json'),
      'entropy build info',
    ),
    'entropy build info',
  );
  if (![PUBLIC_RELEASE_PROFILE, DEV_RELEASE_PROFILE].includes(buildInfo.releaseProfile)) {
    throw new Error(
      `entropy build info has missing or unknown releaseProfile: ${String(buildInfo.releaseProfile)}`,
    );
  }

  const inventories = await readWorkerInventories(resolvedDistDir);
  const violations = [];
  const requiredEntries = buildInfo.releaseProfile === DEV_RELEASE_PROFILE
    ? [PRODUCT_MODEL_WORKER_ENTRY, ...REQUIRED_WORKER_ENTRY_MODULES]
    : [PRODUCT_MODEL_WORKER_ENTRY];
  const workerReports = requiredEntries.map((entryModuleId) => {
    const matches = inventories.filter((inventory) => inventory.entryModuleId === entryModuleId);
    if (matches.length !== 1) {
      violations.push(`expectedOneWorkerInventory=${entryModuleId} found=${matches.length}`);
      return Object.freeze({ entryModuleId, modules: Object.freeze([]) });
    }
    const modules = matches[0].modules;
    (entryModuleId === PRODUCT_MODEL_WORKER_ENTRY ? [] : REQUIRED_MODULE_FRAGMENTS).forEach((fragment) => {
      if (!modules.some((moduleId) => moduleId.includes(fragment))) {
        violations.push(`requiredModuleFragment=${fragment} worker=${entryModuleId}`);
      }
    });
    (REQUIRED_MODULE_FRAGMENTS_BY_ENTRY[entryModuleId] || []).forEach((fragment) => {
      if (!modules.some((moduleId) => moduleId.includes(fragment))) {
        violations.push(`requiredModuleFragment=${fragment} worker=${entryModuleId}`);
      }
    });
    [
      ...FORBIDDEN_MODULE_FRAGMENTS,
      ...(FORBIDDEN_MODULE_FRAGMENTS_BY_ENTRY[entryModuleId] || []),
    ].forEach((fragment) => {
      modules
        .filter((moduleId) => moduleId.includes(fragment))
        .forEach((moduleId) => {
          violations.push(
            `forbiddenModuleFragment=${fragment} reachableModule=${moduleId} worker=${entryModuleId}`,
          );
        });
    });
    return Object.freeze({ entryModuleId, modules });
  });

  return Object.freeze({
    skipped: false,
    releaseProfile: buildInfo.releaseProfile,
    workers: Object.freeze(workerReports),
    violations: Object.freeze(violations),
  });
}

export async function runZenModelWorkerArtifactContractCli(distDir, options = {}) {
  const writeStdout = options.writeStdout || console.log;
  const writeStderr = options.writeStderr || console.error;
  try {
    const report = await checkZenModelWorkerArtifactContract(distDir);
    if (report.skipped) {
      writeStdout(`${CHECK_PREFIX} SKIP: releaseProfile=${report.releaseProfile}`);
      return 0;
    }
    if (report.violations.length > 0) {
      report.violations.forEach((violation) => writeStderr(`${CHECK_PREFIX} FAIL: ${violation}`));
      return 1;
    }
    writeStdout(
      `${CHECK_PREFIX} PASS: workers=${report.workers.length}`
      + ` modules=${report.workers.reduce((sum, worker) => sum + worker.modules.length, 0)}`,
    );
    return 0;
  } catch (error) {
    writeStderr(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
    return 1;
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const distDir = process.argv[2] || 'dist';
  process.exitCode = await runZenModelWorkerArtifactContractCli(distDir);
}
