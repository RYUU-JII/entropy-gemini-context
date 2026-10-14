#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const LANDING_APP_ENTRY = 'src/apps/landing/main.jsx';
const LANDING_PRESENTATION_ROOT = 'src/themes/plugins/zen/presentation/landing';
const LANDING_LENS_PROJECTION = 'src/apps/landing/experience/resolveLandingLensTextProjection.js';
const LANDING_KOI_SEAM = 'src/themes/plugins/zen/api/landingKoi.js';
const ZEN_ARTIFACT_COLOR_SEAM = 'src/themes/core/tools/zenArtifactColorTokens.js';
const ARTIFACT_COLOR_SYSTEM = 'src/themes/core/tools/artifactColorSystem.js';
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const STYLE_EXTENSIONS = new Set(['.css']);
const RESOLVABLE_EXTENSIONS = Object.freeze([
  '',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
]);
const ALLOWED_PACKAGES = new Set(['react']);
const ALLOWED_CLOSURE_PACKAGES = new Map([
  ['react', 'shared React presentation components'],
  ['react-dom', 'public landing React root'],
  ['framer-motion', 'shared artifact scene primitives'],
  ['@fontsource-variable/noto-sans-kr', 'locally bundled Korean webfont CSS'],
]);
const ALLOWED_TOOLS_RECIPE_CLOSURE = new Set([
  'src/themes/plugins/zen/widgets/tools/recipes/zenFurinSceneRecipe.jsx',
  'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js',
  'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiGeometry.js',
  'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiWaterMaterial.js',
  'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiSceneRecipe.jsx',
]);
const ALLOWED_ZEN_ENVIRONMENT_RUNTIME_CLOSURE = new Set([
  'src/themes/plugins/zen/runtime/environment/zenWorldAmbientGrammar.js',
  'src/themes/plugins/zen/runtime/environment/zenWorldEnvironmentRuntimeTarget.js',
  'src/themes/plugins/zen/runtime/environment/zenWorldMaterialPalette.js',
]);
const ALLOWED_SHARED_SOURCE_IMPORTS = new Map([
  [
    ZEN_ARTIFACT_COLOR_SEAM,
    'dependency-free canonical Zen artifact colors',
  ],
  [
    LANDING_KOI_SEAM,
    'landing-bounded canonical koi appearance, material, silhouette, and appendage seam',
  ],
  [
    'src/themes/plugins/zen/model/SakuraSpecies.js',
    'Sakura Canvas2D species renderer and deterministic topology recipe',
  ],
  [
    'src/themes/plugins/zen/model/SeededRandom.js',
    'deterministic synthetic landing seed',
  ],
  [
    'src/themes/plugins/zen/model/ZenBonsaiGrowthProjection.js',
    'pure bonsai growth projection',
  ],
  [
    'src/themes/plugins/zen/model/ZenBonsaiLifeState.js',
    'pure bonsai life-state normalization',
  ],
  [
    'src/themes/plugins/zen/model/ZenBonsaiStageContract.js',
    'storage-free bonsai stage contract',
  ],
  [
    'src/themes/plugins/zen/model/ZenCoreConfigAssetCache.js',
    'render-local Sakura asset cache',
  ],
  [
    'src/themes/plugins/zen/model/ZenPotStyleIds.js',
    'canonical garden-bed pot style identifier',
  ],
  [
    'src/themes/plugins/zen/model/bonsai/rendering/resolveBonsaiCamera.js',
    'pure anchored Canvas2D camera projection',
  ],
  [
    'src/themes/plugins/zen/model/bonsai/rendering/zenHomeGardenBedGeometry.js',
    'pure garden-bed geometry and material recipe',
  ],
  [
    'src/themes/plugins/zen/model/bonsai/rendering/zenHomeGardenBedProjectionContract.js',
    'pure garden-bed device projection contract',
  ],
  [
    'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js',
    'pure Classic2 development projection',
  ],
  [
    'src/themes/plugins/zen/model/zenBonsaiSceneEnvironment.js',
    'pure render-time wind projection',
  ],
  [
    'src/themes/plugins/zen/model/sakura/sakuraRenderPlan.js',
    'pure Sakura Canvas2D render-plan contract',
  ],
  [
    'src/themes/plugins/zen/presentation/artifacts/shoji/ZenShojiVisualCore.jsx',
    'shared Shoji paper and cube presentation core',
  ],
  [
    'src/themes/plugins/zen/runtime/environment/zenWorldMaterialPalette.js',
    'canonical Zen ambient palette',
  ],
  [
    'src/themes/plugins/zen/widgets/tools/presentation/ZenFurinScene.jsx',
    'shared stateless Furin presentation scene',
  ],
  [
    'src/themes/plugins/zen/widgets/tools/presentation/ZenShishiOdoshiScene.jsx',
    'shared stateless Shishi-odoshi presentation scene',
  ],
  [
    'src/themes/plugins/zen/widgets/tools/recipes/zenShishiOdoshiRuntimeRecipe.js',
    'pure Shishi-odoshi pose and timing math',
  ],
]);
const ALLOWED_LENS_SOURCE_IMPORTS = new Map([
  [
    'src/domains/settings/config/frictionIntensityBands.js',
    'dependency-free canonical intensity-band vocabulary; no settings reads',
  ],
  [
    'src/domains/settings/config/textRhythmProfile.js',
    'pure canonical text-rhythm profile resolver',
  ],
  [
    'src/lib/textShuffle.js',
    'pure deterministic text shuffle utility',
  ],
]);
const EXPECTED_LANDING_KOI_RE_EXPORTS = new Map([
  [
    'src/themes/plugins/zen/pond/model/koi/koiAppearanceCore.js',
    new Set(['createCanonicalKoiAppearance:createCanonicalKoiAppearance']),
  ],
  [
    'src/themes/plugins/zen/pond/model/koi/koiBodyMaterialCore.js',
    new Set([
      'resolveCanonicalKoiBodyMaterialTones:resolveCanonicalKoiBodyMaterialTones',
    ]),
  ],
  [
    'src/themes/plugins/zen/pond/model/koi/koiAppendageGeometryCore.js',
    new Set([
      'buildCanonicalKoiAppendageGeometry:buildCanonicalKoiAppendageGeometry',
      'DEFAULT_KOI_APPENDAGE_PROFILE:DEFAULT_KOI_APPENDAGE_PROFILE',
      'traceKoiAppendagePath:traceKoiAppendagePath',
    ]),
  ],
  [
    'src/themes/plugins/zen/pond/model/koi/koiSilhouetteCore.js',
    new Set([
      'buildKoiBodyContour:buildKoiBodyContour',
      'resolveKoiBodyRadius:resolveKoiBodyRadius',
      'traceKoiBodyContourPath:traceKoiBodyContourPath',
    ]),
  ],
]);
const EXPECTED_ZEN_ARTIFACT_COLOR_EXPORTS = new Set([
  'ZEN_ARTIFACT_COLOR_TOKENS',
  'getZenArtifactColorTokens',
]);
const EXPECTED_ZEN_ARTIFACT_COLOR_IDS = new Set([
  'barrier',
  'brake',
  'echo',
  'flare',
  'gate',
  'lens',
  'resonance',
  'veil',
]);

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function fail(messages) {
  const details = Array.isArray(messages) ? messages : [messages];
  details.forEach((message) => {
    console.error(`[zen-landing-reuse-boundary] FAIL: ${message}`);
  });
  process.exit(1);
}

async function collectSourceFiles(relativeDirectory) {
  const absoluteDirectory = path.resolve(ROOT, relativeDirectory);
  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absoluteEntry = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(normalizePath(path.relative(ROOT, absoluteEntry))));
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(normalizePath(path.relative(ROOT, absoluteEntry)));
  }

  return files.sort();
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/gu,
    /\bimport\s*['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return Array.from(new Set(specifiers));
}

function extractStyleImportSpecifiers(source) {
  const specifiers = [];
  const pattern = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]\s*\)?/gu;
  let match = pattern.exec(source);
  while (match) {
    specifiers.push(match[1]);
    match = pattern.exec(source);
  }
  return Array.from(new Set(specifiers));
}

function extractNamedReExports(source) {
  const reExports = [];
  const pattern = /\bexport\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/gu;
  let match = pattern.exec(source);
  while (match) {
    const members = match[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    for (const member of members) {
      const memberMatch = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/u.exec(member);
      if (!memberMatch) {
        reExports.push({ specifier: match[2], invalidMember: member });
        continue;
      }
      reExports.push({
        specifier: match[2],
        importedName: memberMatch[1],
        exportedName: memberMatch[2] || memberMatch[1],
      });
    }
    match = pattern.exec(source);
  }
  return reExports;
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

async function assertLandingKoiSeamInventory(failures) {
  const absolutePath = path.resolve(ROOT, LANDING_KOI_SEAM);
  const source = await fs.readFile(absolutePath, 'utf8');
  const actualBySource = new Map();

  if (/\bexport\s+(?:default|\*)/u.test(source)) {
    failures.push(`${LANDING_KOI_SEAM}: default and star exports are forbidden.`);
  }
  if (/\bimport\s*(?:\(|[^'"(])/u.test(source)) {
    failures.push(`${LANDING_KOI_SEAM}: direct imports are forbidden; use exact named re-exports.`);
  }
  if (/\bexport\s+(?:const|let|var|function|class)\b/u.test(source)) {
    failures.push(`${LANDING_KOI_SEAM}: local exports are forbidden; keep this seam declarative.`);
  }

  for (const reExport of extractNamedReExports(source)) {
    if (reExport.invalidMember) {
      failures.push(
        `${LANDING_KOI_SEAM}: unsupported re-export member "${reExport.invalidMember}".`,
      );
      continue;
    }
    const resolvedSource = normalizePath(path.relative(
      ROOT,
      path.resolve(path.dirname(absolutePath), reExport.specifier),
    ));
    const sourceExports = actualBySource.get(resolvedSource) || new Set();
    sourceExports.add(`${reExport.importedName}:${reExport.exportedName}`);
    actualBySource.set(resolvedSource, sourceExports);
  }

  const actualSources = new Set(actualBySource.keys());
  const expectedSources = new Set(EXPECTED_LANDING_KOI_RE_EXPORTS.keys());
  if (!sameSet(actualSources, expectedSources)) {
    failures.push(
      `${LANDING_KOI_SEAM}: source inventory changed. Expected ${[...expectedSources].join(', ')}; `
      + `received ${[...actualSources].join(', ') || '<none>'}.`,
    );
  }
  for (const [sourcePath, expectedExports] of EXPECTED_LANDING_KOI_RE_EXPORTS) {
    const actualExports = actualBySource.get(sourcePath) || new Set();
    if (!sameSet(actualExports, expectedExports)) {
      failures.push(
        `${LANDING_KOI_SEAM}: export inventory changed for ${sourcePath}. Expected `
        + `${[...expectedExports].join(', ')}; received ${[...actualExports].join(', ') || '<none>'}.`,
      );
    }
  }
}

async function assertZenArtifactColorSeam(failures) {
  const absolutePath = path.resolve(ROOT, ZEN_ARTIFACT_COLOR_SEAM);
  const source = await fs.readFile(absolutePath, 'utf8');
  const importSpecifiers = extractImportSpecifiers(source);
  if (importSpecifiers.length > 0 || /\brequire\s*\(/u.test(source)) {
    failures.push(
      `${ZEN_ARTIFACT_COLOR_SEAM}: the landing color seam must remain dependency-free.`,
    );
  }
  if (/\bexport\s+(?:default|\*)/u.test(source) || extractNamedReExports(source).length > 0) {
    failures.push(
      `${ZEN_ARTIFACT_COLOR_SEAM}: default, star, and re-exports are forbidden.`,
    );
  }

  try {
    const colorModule = await import(pathToFileURL(absolutePath).href);
    const actualExports = new Set(Object.keys(colorModule));
    if (!sameSet(actualExports, EXPECTED_ZEN_ARTIFACT_COLOR_EXPORTS)) {
      failures.push(
        `${ZEN_ARTIFACT_COLOR_SEAM}: public export inventory changed. Expected `
        + `${[...EXPECTED_ZEN_ARTIFACT_COLOR_EXPORTS].join(', ')}; received `
        + `${[...actualExports].join(', ') || '<none>'}.`,
      );
    }
    const actualArtifactIds = new Set(Object.keys(colorModule.ZEN_ARTIFACT_COLOR_TOKENS || {}));
    if (!sameSet(actualArtifactIds, EXPECTED_ZEN_ARTIFACT_COLOR_IDS)) {
      failures.push(
        `${ZEN_ARTIFACT_COLOR_SEAM}: canonical artifact inventory changed. Expected `
        + `${[...EXPECTED_ZEN_ARTIFACT_COLOR_IDS].join(', ')}; received `
        + `${[...actualArtifactIds].join(', ') || '<none>'}.`,
      );
    }
  } catch (error) {
    failures.push(
      `${ZEN_ARTIFACT_COLOR_SEAM}: failed to evaluate dependency-free seam: `
      + `${error instanceof Error ? error.message : String(error)}.`,
    );
  }

  const colorSystemSource = await fs.readFile(path.resolve(ROOT, ARTIFACT_COLOR_SYSTEM), 'utf8');
  if (!extractImportSpecifiers(colorSystemSource).includes('./zenArtifactColorTokens.js')) {
    failures.push(
      `${ARTIFACT_COLOR_SYSTEM}: must consume ${ZEN_ARTIFACT_COLOR_SEAM} as the single Zen token truth.`,
    );
  }
  if (/\b(?:const|let|var)\s+ZEN_ARTIFACT_COLOR_TOKENS\s*=/u.test(colorSystemSource)) {
    failures.push(
      `${ARTIFACT_COLOR_SYSTEM}: duplicate Zen artifact token definitions are forbidden.`,
    );
  }
}

function isInsideDirectory(absolutePath, absoluteDirectory) {
  const relative = path.relative(absoluteDirectory, absolutePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveDirectSourcePath(importerPath, specifier) {
  return specifier.startsWith('@/')
    ? path.resolve(ROOT, 'src', specifier.slice(2))
    : path.resolve(path.dirname(importerPath), specifier);
}

function resolvePackageName(specifier) {
  if (specifier.startsWith('@')) {
    return specifier.split('/').slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

async function resolveRelativeImport(importerPath, specifier) {
  const cleanSpecifier = specifier.split(/[?#]/u)[0];
  const unresolvedPath = cleanSpecifier.startsWith('@/')
    ? path.resolve(ROOT, 'src', cleanSpecifier.slice(2))
    : path.resolve(path.dirname(importerPath), cleanSpecifier);
  const candidates = [];

  const explicitExtension = path.extname(unresolvedPath);
  if (explicitExtension && RESOLVABLE_EXTENSIONS.includes(explicitExtension)) {
    candidates.push(unresolvedPath);
  } else {
    RESOLVABLE_EXTENSIONS.forEach((extension) => {
      candidates.push(`${unresolvedPath}${extension}`);
    });
    RESOLVABLE_EXTENSIONS.slice(1).forEach((extension) => {
      candidates.push(path.join(unresolvedPath, `index${extension}`));
    });
  }

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isFile()) return candidate;
    } catch (_error) {
      // Continue through the explicit resolver inventory.
    }
  }
  return null;
}

function resolveForbiddenClosureReason(relativePath) {
  if (
    relativePath.startsWith('src/apps/')
    && !relativePath.startsWith('src/apps/landing/')
  ) {
    return 'non-landing app owner';
  }
  if (relativePath.startsWith('src/domains/') && !ALLOWED_LENS_SOURCE_IMPORTS.has(relativePath)) {
    return 'domain/runtime owner outside the pure Lens profile seam';
  }
  if (relativePath.startsWith('src/platform/')) return 'platform or extension owner';
  if (relativePath.startsWith('src/themes/core/runtime/')) return 'broad theme runtime owner';
  if (relativePath.startsWith('src/themes/core/state/')) return 'theme state owner';
  if (
    relativePath.startsWith('src/themes/plugins/zen/runtime/')
    && !ALLOWED_ZEN_ENVIRONMENT_RUNTIME_CLOSURE.has(relativePath)
  ) {
    return 'Zen runtime owner outside the exact pure environment material closure';
  }
  if (relativePath.startsWith('src/themes/plugins/zen/workers/')) return 'Zen worker owner';
  if (relativePath.startsWith('src/themes/plugins/zen/state/')) return 'Zen state/repository owner';
  if (relativePath.startsWith('src/themes/plugins/zen/bonsai/storage/')) {
    return 'bonsai persistence owner';
  }
  if (relativePath.startsWith('src/themes/plugins/zen/pond/storage/')) {
    return 'pond persistence owner';
  }
  if (relativePath.startsWith('src/themes/plugins/zen/pond/state/')) return 'pond state owner';
  if (relativePath.startsWith('src/themes/plugins/zen/pond/control/')) {
    return 'pond runtime controller';
  }
  if (relativePath.startsWith('src/themes/plugins/zen/pond/renderers/')) {
    return 'pond Pixi or worker renderer owner';
  }
  if (relativePath.startsWith('src/themes/plugins/zen/pond/runtime/')) {
    return 'pond runtime owner';
  }
  if (
    relativePath.startsWith('src/themes/plugins/zen/widgets/tools/')
    && !relativePath.startsWith('src/themes/plugins/zen/widgets/tools/presentation/')
    && !ALLOWED_TOOLS_RECIPE_CLOSURE.has(relativePath)
  ) {
    return 'complete Tools widget or simulation owner';
  }
  if (
    /(?:^|\/)(?:[^/]*(?:Repository|Store|Worker|Admission|RuntimeClient|ExecutionController|WorkspaceRuntime|RuntimeTelemetry)[^/]*)$/u
      .test(relativePath)
  ) {
    return 'repository, worker, or runtime-client owner';
  }
  return null;
}

async function collectRecursiveClosure(entryPaths, failures) {
  const queue = entryPaths.map((relativePath) => path.resolve(ROOT, relativePath));
  const visitedFiles = new Set();
  const usedPackages = new Set();

  while (queue.length > 0) {
    const absolutePath = queue.shift();
    const relativePath = normalizePath(path.relative(ROOT, absolutePath));
    if (visitedFiles.has(relativePath)) continue;
    visitedFiles.add(relativePath);

    const forbiddenReason = resolveForbiddenClosureReason(relativePath);
    if (forbiddenReason) {
      failures.push(`${relativePath}: forbidden transitive landing dependency (${forbiddenReason}).`);
      continue;
    }

    const extension = path.extname(absolutePath);
    if (!SOURCE_EXTENSIONS.has(extension) && !STYLE_EXTENSIONS.has(extension)) continue;
    const source = await fs.readFile(absolutePath, 'utf8');
    const specifiers = SOURCE_EXTENSIONS.has(extension)
      ? extractImportSpecifiers(source)
      : extractStyleImportSpecifiers(source);

    for (const specifier of specifiers) {
      const isRelativeSource = specifier.startsWith('.') || specifier.startsWith('@/');
      if (!isRelativeSource) {
        const packageName = resolvePackageName(specifier);
        if (!ALLOWED_CLOSURE_PACKAGES.has(packageName)) {
          failures.push(
            `${relativePath}: transitive package "${specifier}" is outside the closure allowlist.`,
          );
          continue;
        }
        usedPackages.add(packageName);
        continue;
      }

      const resolvedImport = await resolveRelativeImport(absolutePath, specifier);
      if (!resolvedImport) {
        failures.push(`${relativePath}: cannot resolve transitive import "${specifier}".`);
        continue;
      }
      queue.push(resolvedImport);
    }
  }

  for (const packageName of ALLOWED_CLOSURE_PACKAGES.keys()) {
    if (!usedPackages.has(packageName)) {
      failures.push(
        `stale recursive package allowlist entry: ${packageName}. Remove it before merging.`,
      );
    }
  }

  return Object.freeze({
    fileCount: visitedFiles.size,
    packages: Object.freeze([...usedPackages].sort()),
  });
}

async function main() {
  const absoluteLandingRoot = path.resolve(ROOT, LANDING_PRESENTATION_ROOT);
  const sourceFiles = await collectSourceFiles(LANDING_PRESENTATION_ROOT);
  const usedPackages = new Set();
  const usedSharedSources = new Set();
  const usedLensSources = new Set();
  const failures = [];

  await assertLandingKoiSeamInventory(failures);
  await assertZenArtifactColorSeam(failures);

  for (const [relativePath, purpose] of [
    ...ALLOWED_SHARED_SOURCE_IMPORTS,
    ...ALLOWED_LENS_SOURCE_IMPORTS,
  ]) {
    try {
      await fs.access(path.resolve(ROOT, relativePath));
    } catch (_error) {
      failures.push(`allowlisted shared seam is missing: ${relativePath} (${purpose}).`);
    }
  }

  const lensSource = await fs.readFile(path.resolve(ROOT, LANDING_LENS_PROJECTION), 'utf8');
  for (const specifier of extractImportSpecifiers(lensSource)) {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
      failures.push(
        `${LANDING_LENS_PROJECTION}: package import "${specifier}" is forbidden. `
        + 'Lens projection must remain a pure repository-local adapter.',
      );
      continue;
    }
    const resolvedImport = resolveDirectSourcePath(
      path.resolve(ROOT, LANDING_LENS_PROJECTION),
      specifier,
    );
    const resolvedRelativePath = normalizePath(path.relative(ROOT, resolvedImport));
    if (!ALLOWED_LENS_SOURCE_IMPORTS.has(resolvedRelativePath)) {
      failures.push(
        `${LANDING_LENS_PROJECTION}: import "${specifier}" resolves to non-allowlisted Lens owner `
        + `"${resolvedRelativePath}". DOM scanners, settings/storage owners, and protection runtime `
        + 'are forbidden in the public landing.',
      );
      continue;
    }
    usedLensSources.add(resolvedRelativePath);
  }

  for (const relativePath of sourceFiles) {
    const absolutePath = path.resolve(ROOT, relativePath);
    const source = await fs.readFile(absolutePath, 'utf8');

    for (const specifier of extractImportSpecifiers(source)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
        if (!ALLOWED_PACKAGES.has(specifier)) {
          failures.push(
            `${relativePath}: package import "${specifier}" is outside the landing allowlist.`,
          );
          continue;
        }
        usedPackages.add(specifier);
        continue;
      }

      const resolvedImport = resolveDirectSourcePath(absolutePath, specifier);
      if (isInsideDirectory(resolvedImport, absoluteLandingRoot)) continue;

      const resolvedRelativePath = normalizePath(path.relative(ROOT, resolvedImport));
      if (!ALLOWED_SHARED_SOURCE_IMPORTS.has(resolvedRelativePath)) {
        failures.push(
          `${relativePath}: shared import "${specifier}" resolves to non-allowlisted owner `
          + `"${resolvedRelativePath}". Dashboard/Home widgets, stores or storage, `
          + 'repositories or lineage persistence, workers or admission, user data, and broad '
          + 'runtime owners are forbidden in the public landing presentation.',
        );
        continue;
      }
      usedSharedSources.add(resolvedRelativePath);
    }
  }

  for (const packageName of ALLOWED_PACKAGES) {
    if (!usedPackages.has(packageName)) {
      failures.push(`stale package allowlist entry: ${packageName}. Remove it before merging.`);
    }
  }
  for (const [relativePath] of ALLOWED_SHARED_SOURCE_IMPORTS) {
    if (!usedSharedSources.has(relativePath)) {
      failures.push(`stale shared-source allowlist entry: ${relativePath}. Remove it before merging.`);
    }
  }
  for (const [relativePath] of ALLOWED_LENS_SOURCE_IMPORTS) {
    if (!usedLensSources.has(relativePath)) {
      failures.push(`stale Lens-source allowlist entry: ${relativePath}. Remove it before merging.`);
    }
  }

  const recursiveClosure = await collectRecursiveClosure(
    [LANDING_APP_ENTRY],
    failures,
  );

  if (failures.length > 0) fail(failures);

  console.log(
    `[zen-landing-reuse-boundary] PASS: ${sourceFiles.length} landing source files use only `
    + `${usedSharedSources.size} named shared seams and ${usedPackages.size} package dependency; `
    + `Lens projection uses ${usedLensSources.size} pure source seams; koi and Zen color `
    + `inventories are exact; recursive repository closure is ${recursiveClosure.fileCount} files `
    + `with package entrypoints ${recursiveClosure.packages.join(', ')} only.`,
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
