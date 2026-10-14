#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { collectRepositoryFiles, extractImportSpecifiers } from './sourceScanUtils.mjs';

const rootDir = process.cwd();
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const scanRoots = Object.freeze([
  'src',
]);
const callerPrefixes = Object.freeze([
  'src/apps/',
  'src/domains/',
  'src/platform/',
  'src/lib/',
  'src/ui-kit/',
]);
const requiredPublicFiles = Object.freeze([
  'src/themes/core/runtime/dashboardRenderRuntime.js',
  'src/themes/core/catalog.js',
  'src/themes/core/documentTheme.js',
  'src/themes/core/documentThemeProjection.js',
  'src/themes/core/widgets/shared/homeBrief/index.js',
  'src/themes/core/motion/index.js',
  'src/themes/core/presentation/ThemeAmbientPresentationContext.jsx',
  'src/themes/core/presentation/ThemeTemporalAuthorityContext.jsx',
  'src/themes/core/presentation/installationPresentation.js',
  'src/themes/core/presentation/installationPresentationContract.js',
  'src/themes/core/registry/index.js',
  'src/themes/core/profile.js',
  'src/themes/core/toolsVisualPolicy.js',
  'src/themes/core/scheduleVisualPolicy.js',
  'src/themes/core/friction/presentationCatalog.js',
  'src/themes/plugins/zen/api/environment.js',
  'src/themes/plugins/zen/api/landing.js',
  'src/themes/plugins/zen/api/learning.js',
  'src/themes/plugins/zen/api/researchLearning.js',
  'src/themes/plugins/zen/api/waterLily.js',
  'src/themes/plugins/zen/api/petalField.js',
  'src/themes/plugins/zen/api/petalSource.js',
  'src/themes/plugins/zen/api/artifactControls.js',
  'src/themes/plugins/zen/api/gardenWorkspace.js',
  'src/themes/plugins/zen/api/homeCanopyReading.js',
  'src/themes/plugins/zen/api/homeReadingSpace.js',
  'src/themes/plugins/zen/api/bonsaiFirstBloom.js',
  'src/themes/plugins/zen/api/bonsaiFirstBloomPreview.js',
  'src/themes/plugins/zen/api/shishiOdoshiPresentation.js',
  'src/themes/plugins/zen/api/shishiOdoshiMotion.js',
  'src/themes/plugins/zen/api/furin.js',
  'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.dev.js',
  'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.public.js',
  'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.dev.js',
  'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.public.js',
]);
const forbiddenExactTargets = Object.freeze([
  {
    target: 'src/themes/core/index',
    message: 'Use "@/themes/core/catalog.js" for theme reads and "@/themes/core/documentTheme.js" for document theme side effects.',
  },
  {
    target: 'src/themes/index',
    message: 'Use "@/themes/core/catalog.js" or "@/themes/core/documentTheme.js" instead of the retired top-level theme alias.',
  },
  {
    target: 'src/themes/core/loaders/widgets',
    message: 'Use "@/themes/core/registry/index.js" for theme widget lookup and preload APIs.',
  },
  {
    target: 'src/themes/components/widgets/index',
    message: 'Use "@/themes/core/registry/index.js" instead of retired theme widget loader surfaces.',
  },
  {
    target: 'src/themes/core/schedule/policyContract',
    message: 'Use "@/themes/core/scheduleVisualPolicy.js" for public Schedule visual policy reads; policyContract.js is the plugin declaration seam.',
  },
  {
    target: 'src/themes/core/schedule/textureLibrary',
    message: 'Use "@/themes/core/scheduleVisualPolicy.js" for public Schedule visual policy reads; textureLibrary.js is the plugin declaration seam.',
  },
]);

function fail(message) {
  console.error(`[theme-public-entry-boundaries] FAIL: ${message}`);
  process.exit(1);
}

function normalizeResolvedTarget(relativePath) {
  return relativePath
    .replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/u, '')
    .replace(/\/index$/u, '/index');
}

function resolveProjectRelativeImport(relativePath, specifier) {
  if (typeof specifier !== 'string' || !specifier.trim()) return null;

  if (specifier.startsWith('@/')) {
    return `src/${specifier.slice(2)}`;
  }

  if (specifier.startsWith('src/')) {
    return specifier;
  }

  if (!specifier.startsWith('.')) {
    return null;
  }

  return path.relative(
    rootDir,
    path.resolve(path.dirname(path.resolve(rootDir, relativePath)), specifier),
  ).replaceAll(path.sep, '/');
}

async function ensureRequiredFiles() {
  for (const relativePath of requiredPublicFiles) {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
    } catch (_error) {
      fail(`missing required public entry file: ${relativePath}`);
    }
  }
}

async function ensureReleaseSelectedZenEntryContracts() {
  const contractSources = Object.fromEntries(await Promise.all([
    'src/themes/plugins/zen/widgets/core/ZenCoreStatus.jsx',
    'src/themes/plugins/zen/widgets/core/ZenCoreStatusClassic.jsx',
    'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.dev.js',
    'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.public.js',
    'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.dev.js',
    'src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.public.js',
    'src/themes/plugins/zen/api/learning.js',
    'src/themes/plugins/zen/api/researchLearning.js',
    'src/themes/core/friction/context.js',
  ].map(async (relativePath) => [
    relativePath,
    await fs.readFile(path.resolve(rootDir, relativePath), 'utf8'),
  ])));

  const vnextWrapper = contractSources['src/themes/plugins/zen/widgets/core/ZenCoreStatus.jsx'];
  const classicWrapper = contractSources['src/themes/plugins/zen/widgets/core/ZenCoreStatusClassic.jsx'];
  if (!vnextWrapper.includes("from '@zen-core-status-vnext-entry'")) {
    fail('ZenCoreStatus.jsx must load VNext through the build-selected Zen entry.');
  }
  if (!classicWrapper.includes("from '@zen-core-status-classic-experiment-entry'")) {
    fail('ZenCoreStatusClassic.jsx must load ClassicExperiment through the build-selected Zen entry.');
  }
  if (vnextWrapper.includes("import('./ZenCoreStatusVNext")) {
    fail('ZenCoreStatus.jsx must not retain a literal VNext dynamic import.');
  }
  if (classicWrapper.includes("import('./ZenCoreStatusClassicExperiment")) {
    fail('ZenCoreStatusClassic.jsx must not retain a literal ClassicExperiment dynamic import.');
  }

  const entryPairs = [
    {
      label: 'VNext',
      dev: contractSources['src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.dev.js'],
      public: contractSources['src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusVNext.public.js'],
      researchModule: 'ZenCoreStatusVNext.jsx',
    },
    {
      label: 'ClassicExperiment',
      dev: contractSources['src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.dev.js'],
      public: contractSources['src/themes/plugins/zen/runtime/buildEntries/zenCoreStatusClassicExperiment.public.js'],
      researchModule: 'ZenCoreStatusClassicExperiment.jsx',
    },
  ];
  for (const entry of entryPairs) {
    if (!entry.dev.includes('import(') || !entry.dev.includes(entry.researchModule)) {
      fail(`${entry.label} dev build entry must preserve its research dynamic import.`);
    }
    if (entry.public.includes('import(') || entry.public.includes(entry.researchModule)) {
      fail(`${entry.label} public build entry must not reference its research module.`);
    }
  }

  const backgroundLearning = contractSources['src/themes/plugins/zen/api/learning.js'];
  for (const forbiddenResearchModule of [
    'SakuraSpecies',
    'SakuraCompiler',
    'VNextPreferenceModel',
    'model/vnext',
  ]) {
    if (backgroundLearning.includes(forbiddenResearchModule)) {
      fail(`Zen background learning entry must not reference ${forbiddenResearchModule}.`);
    }
  }

  const frictionContext = contractSources['src/themes/core/friction/context.js'];
  for (const forbiddenBroadEntry of ['../catalog.js', '../profile.js', 'pluginCatalog.js']) {
    if (frictionContext.includes(forbiddenBroadEntry)) {
      fail(`friction/context.js must not import broad theme entry ${forbiddenBroadEntry}.`);
    }
  }
  if (!frictionContext.includes("from './presentationCatalog.js'")) {
    fail('friction/context.js must use the narrow friction presentation catalog.');
  }
}

async function ensureDocumentThemeProjectionClosure() {
  const entry = 'src/themes/core/documentThemeProjection.js';
  const pending = [entry];
  const visited = new Set();
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);
    if (!relativePath.startsWith('src/themes/')
      || relativePath === 'src/themes/core/documentTheme.js'
      || /\/(?:state|runtime|registry|widgets)\//u.test(relativePath)
      || relativePath.endsWith('/manifest.js')
      || relativePath === 'src/themes/core/profile.js') {
      fail(`DOM-only document theme projection must not load preference, storage or runtime owners: ${relativePath}`);
    }
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    const specifiers = extractImportSpecifiers(source);
    for (const match of source.matchAll(/\bimport\s*['"]([^'"]+)['"]/gu)) {
      specifiers.push(match[1]);
    }
    for (const specifier of new Set(specifiers)) {
      const resolved = resolveProjectRelativeImport(relativePath, specifier);
      if (!resolved) fail(`DOM-only document theme projection has an undeclared external dependency: ${specifier}`);
      pending.push(resolved);
    }
  }
  const harnessPath = 'src/apps/visual-harness/main.jsx';
  const harnessSource = await fs.readFile(path.resolve(rootDir, harnessPath), 'utf8');
  const harnessImports = extractImportSpecifiers(harnessSource)
    .map((specifier) => resolveProjectRelativeImport(harnessPath, specifier));
  if (!harnessImports.includes(entry)
    || harnessImports.includes('src/themes/core/documentTheme.js')) {
    fail('Visual harness explicit theme initialization must use the DOM-only projection instead of the preference-aware owner.');
  }
}

function isProtectedCaller(relativePath) {
  return callerPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

async function ensureHomeCanopyReadingContract() {
  const entry = 'src/themes/plugins/zen/api/homeCanopyReading.js';
  const model = 'src/themes/plugins/zen/model/bonsai/rendering/zenHomeCanopyReadingEnvelope.js';
  const [entrySource, modelSource] = await Promise.all([
    fs.readFile(path.resolve(rootDir, entry), 'utf8'),
    fs.readFile(path.resolve(rootDir, model), 'utf8'),
  ]);
  const entryBody = entrySource.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\r\n]*/gmu, '');
  const entryExport = entryBody.match(/^\s*export\s*\{([^}]+)\}\s*from\s*['"]\.\.\/model\/bonsai\/rendering\/zenHomeCanopyReadingEnvelope\.js['"];?\s*$/u);
  const names = entryExport?.[1].split(',').map((name) => name.trim()).filter(Boolean).sort();
  if (!names || names.length !== 2
    || names[0] !== 'requireZenHomeCanopyReadingEnvelope'
    || names[1] !== 'resolveZenHomeCanopyReadingEnvelope') {
    fail('Home canopy reading API must re-export only resolveZenHomeCanopyReadingEnvelope and requireZenHomeCanopyReadingEnvelope from their pure model owner.');
  }

  const allowedModelImports = new Set([
    '../plume/ZenBonsaiPlumeCameraEnvelope.js',
    '../plume/ZenBonsaiPlumeCrownAppearance.js',
    '../plume/ZenBonsaiPlumeHomeFraming.js',
    '../plume/live/motion.js',
    './zenHomeFrameSeamGeometry.js',
    './zenHomeGardenBedProjectionContract.js',
  ]);
  const modelImports = extractImportSpecifiers(modelSource);
  for (const match of modelSource.matchAll(/\bimport\s*['"]([^'"]+)['"]/gu)) {
    modelImports.push(match[1]);
  }
  if (modelImports.length === 0
    || modelImports.some((specifier) => !allowedModelImports.has(specifier))
    || /\b(?:import|require)\s*\(/u.test(modelSource)
    || /export\s+\*/u.test(modelSource)) {
    fail('Home canopy reading model must use only canonical camera/history, Home framing, analytical motion and garden geometry contracts, without React, runtime, storage or broad exports.');
  }
}

async function main() {
  await ensureRequiredFiles();
  await ensureDocumentThemeProjectionClosure();
  await ensureReleaseSelectedZenEntryContracts();
  await ensureHomeCanopyReadingContract();
  const bloomEntry = 'src/themes/plugins/zen/api/bonsaiFirstBloom.js';
  const bloomModel = 'src/themes/plugins/zen/model/bonsai/plume/ZenBonsaiPlumeBloomPresentationContract.js';
  const [bloomEntrySource, bloomModelSource] = await Promise.all([
    fs.readFile(path.resolve(rootDir, bloomEntry), 'utf8'),
    fs.readFile(path.resolve(rootDir, bloomModel), 'utf8'),
  ]);
  const bloomEntryBody = bloomEntrySource.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\r\n]*/gmu, '');
  const bloomExports = bloomEntryBody.match(/^\s*export\s*\{([^}]+)\}\s*from\s*['"]\.\.\/model\/bonsai\/plume\/ZenBonsaiPlumeBloomPresentationContract\.js['"];?\s*$/u);
  const bloomNames = bloomExports?.[1].split(',').map((name) => name.trim()).filter(Boolean).sort();
  const expectedBloomNames = [
    'ZEN_BONSAI_FIRST_BLOOM_DURATION_MS',
    'ZEN_BONSAI_FIRST_BLOOM_FULL_MASK',
    'ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT',
    'requireZenBonsaiFirstBloomRegionId',
  ].sort();
  if (!bloomNames || JSON.stringify(bloomNames) !== JSON.stringify(expectedBloomNames)
    || extractImportSpecifiers(bloomModelSource).length !== 0) {
    fail('Bonsai first-bloom API must expose only its renderer-neutral region/timing contract from the dependency-free owner.');
  }
  const bloomPreviewEntry = await fs.readFile(path.resolve(rootDir,
    'src/themes/plugins/zen/api/bonsaiFirstBloomPreview.js'), 'utf8');
  const bloomPreviewBody = bloomPreviewEntry.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/[^\r\n]*/gmu, '').trim();
  if (!/^export\s*\{\s*ZenBonsaiFirstBloomPreview\s*\}\s*from\s*['"]\.\.\/presentation\/bonsai\/ZenBonsaiFirstBloomPreview\.jsx['"];?$/u.test(bloomPreviewBody)) {
    fail('Bonsai development preview API must expose only the theme-owned preview presentation.');
  }
  const shishiPresentation = await fs.readFile(path.resolve(rootDir, 'src/themes/plugins/zen/api/shishiOdoshiPresentation.js'), 'utf8');
  const shishiImports = extractImportSpecifiers(shishiPresentation);
  if (shishiImports.length !== 1 || shishiImports[0] !== '../widgets/tools/recipes/zenShishiOdoshiGeometry.js'
    || /export\s+\*/u.test(shishiPresentation)) {
    fail('Shishi presentation API must remain a narrow projection of shared geometry without renderer imports or a broad re-export.');
  }

  const shishiMotion = await fs.readFile(path.resolve(rootDir, 'src/themes/plugins/zen/api/shishiOdoshiMotion.js'), 'utf8');
  const shishiMotionImports = extractImportSpecifiers(shishiMotion);
  if (shishiMotionImports.length !== 1 || shishiMotionImports[0] !== '../widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js'
    || /export\s+\*/u.test(shishiMotion) || !shishiMotion.includes('SHISHI_ODOSHI_POUR_STRIKE_SEC as ZEN_SHISHI_POUR_STRIKE_SEC')) {
    fail('Shishi motion API must project only the canonical requested-pour duration, without renderer imports or a broad re-export.');
  }

  const gardenWorkspace = await fs.readFile(path.resolve(rootDir, 'src/themes/plugins/zen/api/gardenWorkspace.js'), 'utf8');
  const gardenImports = extractImportSpecifiers(gardenWorkspace);
  if (gardenImports.length !== 1 || gardenImports[0] !== '../presentation/garden/ZenGardenModeControl.jsx'
    || /export\s+\*/u.test(gardenWorkspace)) {
    fail('Garden workspace API must project only its mode control without runtime or widget imports.');
  }
  const gardenControl = await fs.readFile(path.resolve(rootDir, 'src/themes/plugins/zen/presentation/garden/ZenGardenModeControl.jsx'), 'utf8');
  const gardenControlImports = extractImportSpecifiers(gardenControl);
  if (gardenControlImports.some((specifier) => specifier !== 'react' && specifier !== './zenGardenWorkspace.css')) {
    fail('Garden mode control must remain presentation-only and use callbacks for navigation.');
  }

  const artifactControls = await fs.readFile(path.resolve(rootDir, 'src/themes/plugins/zen/api/artifactControls.js'), 'utf8');
  const artifactControlImports = extractImportSpecifiers(artifactControls);
  if (artifactControlImports.length !== 1 || artifactControlImports[0] !== '../widgets/tools/ZenArtifactSwitchBand.jsx'
    || !/^\s*export\s*\{\s*ZenArtifactControlGarden\s*\}\s*from\s*['"][^'"]+['"];?\s*$/u.test(artifactControls)) {
    fail('Artifact controls API must project only ZenArtifactControlGarden from its canonical control presentation.');
  }

  const filesToScan = await collectRepositoryFiles({
    rootDir,
    roots: scanRoots,
    extensions: allowedExtensions,
    excludedEntryNames: new Set(['archive']),
  });

  for (const relativePath of filesToScan) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    const specifiers = extractImportSpecifiers(source);

    for (const specifier of specifiers) {
      const resolved = resolveProjectRelativeImport(relativePath, specifier);
      if (!resolved) continue;
      const normalized = normalizeResolvedTarget(resolved);

      if (normalized === 'src/themes/plugins/zen/api/bonsaiFirstBloomPreview'
        && relativePath !== 'src/apps/visual-harness/scenes/ZenBonsaiFirstBloomScene.jsx') {
        fail(`${relativePath}: the Bonsai development preview is owned only by its Visual Harness scene; runtime callers must use the lightweight bonsaiFirstBloom contract.`);
      }
      if (normalized === 'src/themes/plugins/zen/presentation/bonsai/ZenBonsaiFirstBloomPreview'
        && relativePath !== 'src/themes/plugins/zen/api/bonsaiFirstBloomPreview.js') {
        fail(`${relativePath}: the Bonsai development preview presentation must be reached through its dedicated development-only API.`);
      }
      if (!isProtectedCaller(relativePath)) continue;

      for (const forbidden of forbiddenExactTargets) {
        if (normalized === forbidden.target) {
          fail(`${relativePath}: ${forbidden.message} Found "${specifier}".`);
        }
      }

      if (
        normalized === 'src/themes/plugins/zen/model/bonsai/plume'
        || normalized.startsWith('src/themes/plugins/zen/model/bonsai/plume/')
        || normalized === 'src/themes/plugins/zen/model/bonsai/rendering/zenHomeCanopyReadingEnvelope'
      ) {
        fail(`${relativePath}: Use "@/themes/plugins/zen/api/homeCanopyReading.js" for Home canopy reading bounds instead of importing Plume camera, framing, motion or the private reading model. Found "${specifier}".`);
      }

      if (
        normalized.startsWith('src/themes/plugins/')
        && normalized.includes('/presentation/installation/')
      ) {
        fail(`${relativePath}: Use "@/themes/core/presentation/installationPresentation.js" for installation presentation lookup instead of importing plugin renderers. Found "${specifier}".`);
      }

      if (
        normalized.startsWith('src/themes/plugins/')
        && normalized.includes('/widgets/')
      ) {
        fail(`${relativePath}: Use "@/themes/core/registry/index.js" or a theme plugin public API instead of importing theme widget internals. Found "${specifier}".`);
      }

      if (
        normalized.startsWith('src/themes/plugins/')
        && normalized.endsWith('/scheduleVisualPolicy')
      ) {
        fail(`${relativePath}: Use "@/themes/core/scheduleVisualPolicy.js" instead of importing a plugin-owned Schedule policy. Found "${specifier}".`);
      }

      if (
        normalized === 'src/themes/plugins/zen/presentation/environment'
        || normalized.startsWith('src/themes/plugins/zen/presentation/environment/')
        || normalized === 'src/themes/plugins/zen/runtime/environment'
        || normalized.startsWith('src/themes/plugins/zen/runtime/environment/')
      ) {
        fail(`${relativePath}: Use "@/themes/plugins/zen/api/environment.js" instead of importing Zen ambient or temporal-authority internals. Found "${specifier}".`);
      }

      if (
        normalized === 'src/themes/plugins/zen/presentation/landing'
        || normalized.startsWith('src/themes/plugins/zen/presentation/landing/')
      ) {
        fail(`${relativePath}: Use "@/themes/plugins/zen/api/landing.js" instead of importing Zen public landing presentation internals. Found "${specifier}".`);
      }
    }
  }

  console.log('[theme-public-entry-boundaries] PASS: non-theme callers use canonical theme public entries instead of retired facades or theme widget internals.');
}

main().catch((error) => {
  console.error('[theme-public-entry-boundaries] Unexpected error:', error);
  process.exit(1);
});
