#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { RENDER_RUNTIME_SURFACES } from './render-runtime-surface-catalog.mjs';

const rootDir = process.cwd();
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const requiredFiles = Object.freeze([
  'src/platform/rendering/renderLoop.js',
  'src/platform/rendering/renderBudgetContract.js',
  'src/platform/rendering/devicePixelRatio.js',
  'src/ui-kit/hooks/useDevicePixelRatio.js',
  'src/platform/rendering/renderHealthSample.js',
  'src/domains/nudge/rendering/nudgeRenderPressureGovernor.js',
  'src/domains/nudge/rendering/nudgeRenderBudget.js',
  'src/domains/nudge/rendering/profiles/nudgeEntityRenderProfile.js',
  'src/domains/nudge/rendering/profiles/nudgeGlobalBackgroundRenderProfile.js',
  'src/domains/nudge/rendering/profiles/nudgeGlobalDisplayRenderProfile.js',
  'src/domains/nudge/rendering/profiles/nudgeKoiRenderProfile.js',
  'src/domains/nudge/engine/nudgeEntityBudget.js',
  'src/themes/plugins/zen/runtime/zenMainWorkerRenderBudget.js',
  'src/themes/plugins/zen/runtime/zenRenderQuality.js',
  'docs/architecture/repository/render-runtime-budget-boundary-map.md',
  'scripts/ci/render-runtime-surface-catalog.mjs',
]);
const retiredFiles = Object.freeze([
  'src/domains/nudge/rendering/profiles/nudgeSiteFurinWaterRenderProfile.js',
  'src/ui-kit/rendering/renderLoop.js',
  'src/platform/rendering/renderPressureGovernor.js',
  'src/domains/nudge/nudge/nudgeGameQuality.js',
  'src/domains/settings/config/zenQuality.js',
]);
const retiredImportFragments = Object.freeze([
  'ui-kit/rendering/renderLoop',
  'platform/rendering/renderPressureGovernor',
  'domains/settings/config/zenQuality',
]);
const nudgeRetiredTokens = Object.freeze([
  'qualityTier',
  'adaptiveQuality',
  'QUALITY_CHANGED',
  'getQualityTier',
  'sampleQuality',
  'normalizeQualityTier',
]);
const zenHomeRetiredTokens = Object.freeze([
  'ZEN_MAIN_WORKER_RENDER_ADAPTIVE_MODES',
  'resolveZenMainWorkerRenderPressure',
  'adaptiveMode',
  'adaptiveEligible',
  'phaseOffsetApplied',
  'mainWorkerCoordination',
  'mainWorkerTelemetry',
  'workerCoordination',
]);
const platformPolicyTokens = Object.freeze([
  'pressureLevel',
  'decorativeDensity',
  'allowExpensivePasses',
  'particleScale',
  'qualityTier',
]);
const nudgeSemanticTokens = Object.freeze([
  'entityUpdateStride',
  'maxSprites',
  'maxTotalSpawned',
  'maxSplits',
  'spawnIntervalMs',
]);

function fail(message) {
  console.error(`[render-runtime-budget-boundary] FAIL: ${message}`);
  process.exit(1);
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.resolve(rootDir, relativePath));
    return true;
  } catch (_error) {
    return false;
  }
}

async function collectSourceFiles(relativeDir) {
  const absoluteDir = path.resolve(rootDir, relativeDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path.relative(rootDir, absolutePath)));
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    files.push(path.relative(rootDir, absolutePath).replaceAll(path.sep, '/'));
  }
  return files;
}

async function assertTokensAbsent(files, tokens, label) {
  for (const relativePath of files) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    for (const token of tokens) {
      if (source.includes(token)) {
        fail(`${label} token "${token}" is retired but appears in ${relativePath}.`);
      }
    }
  }
}

async function validateSurfaceCatalog(srcFiles) {
  const allowedPolicies = new Set(['adaptive', 'fixed', 'local-fixed']);
  const allowedObservations = new Set(['actual-work', 'diagnostic-only', 'none']);
  const catalogIds = new Set();
  const catalogPaths = new Set();
  for (const surface of RENDER_RUNTIME_SURFACES) {
    if (!surface?.id || catalogIds.has(surface.id)) {
      fail(`render surface id is missing or duplicated: ${String(surface?.id || 'missing')}`);
    }
    catalogIds.add(surface.id);
    if (!allowedPolicies.has(surface.policy)) {
      fail(`render surface ${surface.id} has invalid policy ${String(surface.policy)}.`);
    }
    if (!allowedObservations.has(surface.observation)) {
      fail(`render surface ${surface.id} has invalid observation ${String(surface.observation)}.`);
    }
    if (!await pathExists(surface.ownerPath)) {
      fail(`render surface ${surface.id} owner is missing: ${surface.ownerPath}`);
    }
    for (const sourcePath of surface.sourcePaths || []) {
      if (!await pathExists(sourcePath)) {
        fail(`render surface ${surface.id} source is missing: ${sourcePath}`);
      }
      catalogPaths.add(sourcePath);
    }
  }

  const adaptiveSurfaces = RENDER_RUNTIME_SURFACES.filter((surface) => surface.policy === 'adaptive');
  if (
    adaptiveSurfaces.length !== 1
    || adaptiveSurfaces[0].id !== 'nudge-sentinel-protocol'
    || adaptiveSurfaces[0].observation !== 'actual-work'
  ) {
    fail('Nudge Sentinel must remain the only adaptive surface and must use actual-work samples.');
  }

  for (const relativePath of srcFiles) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    const consumesSharedLoop = source.includes("platform/rendering/renderLoop.js'")
      || source.includes('platform/rendering/renderLoop.js"');
    const createsRenderBudget = relativePath !== 'src/platform/rendering/renderBudgetContract.js'
      && (source.includes('createRenderBudget({') || source.includes('resolveRasterResolution({'));
    if ((consumesSharedLoop || createsRenderBudget) && !catalogPaths.has(relativePath)) {
      fail(`render surface catalog does not classify ${relativePath}.`);
    }
  }
}

async function assertActualWorkInstrumentation() {
  for (const relativePath of [
    'src/domains/nudge/runtime/SentinelProtocolHost.js',
    'src/domains/nudge/nudgeSwarm.worker.js',
  ]) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    for (const token of ['createRenderHealthSample', 'updateWorkMs', 'renderWorkMs', 'observeRenderHealth']) {
      if (!source.includes(token)) {
        fail(`Nudge actual-work instrumentation token "${token}" is missing from ${relativePath}.`);
      }
    }
  }
}

async function main() {
  for (const relativePath of requiredFiles) {
    if (!await pathExists(relativePath)) fail(`required canonical file is missing: ${relativePath}`);
  }
  for (const relativePath of retiredFiles) {
    if (await pathExists(relativePath)) fail(`retired file must not return: ${relativePath}`);
  }

  const srcFiles = await collectSourceFiles('src');
  await assertTokensAbsent(srcFiles, retiredImportFragments, 'retired import');
  await assertTokensAbsent(
    await collectSourceFiles('src/domains/nudge'),
    nudgeRetiredTokens,
    'Nudge tier',
  );
  await assertTokensAbsent(
    await collectSourceFiles('src/themes/plugins/zen/runtime'),
    zenHomeRetiredTokens,
    'Zen Home adaptive render',
  );
  await assertTokensAbsent(
    ['src/platform/rendering/renderBudgetContract.js', 'src/platform/rendering/renderHealthSample.js'],
    platformPolicyTokens,
    'platform render policy',
  );
  await assertTokensAbsent(
    ['src/domains/nudge/rendering/nudgeRenderBudget.js'],
    nudgeSemanticTokens,
    'Nudge semantic isolation',
  );

  const engineSource = await fs.readFile(
    path.resolve(rootDir, 'src/domains/nudge/engine/NudgeSwarmEngine.js'),
    'utf8',
  );
  if (engineSource.includes('entityUpdateStride')) {
    fail('render pressure must not change semantic entity simulation cadence.');
  }

  await validateSurfaceCatalog(srcFiles);
  await assertActualWorkInstrumentation();

  console.log(
    '[render-runtime-budget-boundary] PASS: shared measurement/resources, local Nudge adaptation, fixed surface policies, and semantic cadence stay separated.',
  );
}

main().catch((error) => {
  console.error('[render-runtime-budget-boundary] Unexpected error:', error);
  process.exit(1);
});
