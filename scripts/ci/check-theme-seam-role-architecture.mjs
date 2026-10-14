#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { getCanonicalThemeIds } from '../../src/themes/core/ids.js';
import { getBuildCheckPlan } from './buildCheckManifest.mjs';

const rootDir = process.cwd();

const CATALOG_FILE = 'src/themes/core/catalog.js';
const DOCUMENT_THEME_FILE = 'src/themes/core/documentTheme.js';
const DOCUMENT_THEME_PROJECTION_FILE = 'src/themes/core/documentThemeProjection.js';
const THEME_PLUGIN_ROOT = 'src/themes/plugins';
const RETIRED_THEME_PACK_ROOT = 'src/themes/packs';
const RETIRED_THEME_RUNTIME_FACADES = Object.freeze([
  'src/themes/core/runtime/shared.js',
  'src/themes/core/data/tabLabels.js',
]);
const RETIRED_ZEN_ARTIFACT_PRESENTATION_FILES = Object.freeze([
  'src/themes/plugins/zen/widgets/tools/ZenArtifactBeadRailControls.jsx',
  'src/themes/plugins/zen/widgets/tools/ZenArtifactBeadRailControls.css',
  'src/themes/plugins/zen/widgets/tools/hooks/useZenArtifactRailChoice.js',
  'src/themes/plugins/zen/widgets/tools/hooks/useZenArtifactControlCommit.js',
]);
const SCHEDULE_APP_ROOT = 'src/apps/dashboard/tabs/schedule';
const SCHEDULE_VISUAL_POLICY_FILE = 'src/themes/core/scheduleVisualPolicy.js';
const SCHEDULE_VISUAL_POLICY_CONTRACT_FILE = 'src/themes/core/schedule/policyContract.js';
const RETIRED_SCHEDULE_THEME_PROFILE_FILE = `${SCHEDULE_APP_ROOT}/scheduleThemeProfile.js`;
const RETIRED_SCHEDULE_PRESENTATION_FILES = Object.freeze([
  RETIRED_SCHEDULE_THEME_PROFILE_FILE,
  `${SCHEDULE_APP_ROOT}/schedulePressureTraceModel.js`,
  `${SCHEDULE_APP_ROOT}/scheduleStatusModel.js`,
]);
const CANONICAL_THEME_IDS = Object.freeze(getCanonicalThemeIds());
const THEME_SCOPE_SELECTOR_PATTERN = /\[data-theme\s*=\s*(?:'[^']+'|"[^"]+"|[A-Za-z][\w-]*)\][^{}]*/gu;
const RAW_CONTROL_TYPE_SELECTOR_PATTERN = /(?:^|[\s>+~,(])(?:h[1-6]|input|select|textarea|button)(?=$|[\s[\].:#,)>+~])/gu;
const STRICT_THEME_RUNTIME_FILES = Object.freeze([
  {
    file: 'src/themes/core/sound/resolveThemeSoundPack.js',
    includes: ['assertCanonicalThemeId', 'resolveThemeSoundPack',
      '/zen/sound/zenSoundPack.js', '/matrix/sound/matrixSoundPack.js',
      '/entropy/sound/entropySoundPack.js', '/cyberpunk/sound/cyberpunkSoundPack.js',
      '/clinical/sound/clinicalSoundPack.js', '/scp/sound/scpSoundPack.js'],
    excludes: ['runtime/pluginCatalog.js', 'normalizeThemeId', '/manifest.js', '/widgets/'],
  },
  {
    file: 'src/themes/core/presentation/installationPresentation.js',
    includes: ['assertCanonicalThemeId', 'getInstallationPresentation',
      '/zen/presentation/installation/ZenInstallationScene.jsx',
      '/matrix/presentation/installation/MatrixInstallationScene.jsx',
      '/entropy/presentation/installation/EntropyInstallationScene.jsx',
      '/cyberpunk/presentation/installation/CyberpunkInstallationScene.jsx',
      '/clinical/presentation/installation/ClinicalInstallationScene.jsx',
      '/scp/presentation/installation/ScpInstallationScene.jsx'],
    excludes: ['normalizeThemeId', 'mainSceneContract', 'runtime/pluginCatalog.js'],
  },
  {
    file: 'src/themes/core/runtime/pluginCatalog.js',
    includes: ['getThemePluginStrict', 'assertThemePluginId'],
    excludes: ['export function getThemePlugin(', 'normalizeThemeId'],
  },
  {
    file: 'src/themes/core/runtime/surfaceDescriptorCatalog.js',
    includes: [
      'getThemeSurfaceDescriptorStrict',
      'assertThemeSurfaceDescriptorId',
      'getThemeSurfaceDescriptorList',
    ],
    excludes: [
      'runtime/pluginCatalog.js',
      '/manifest.js',
      'normalizeThemeId',
    ],
  },
  {
    file: 'src/themes/core/surfaceDescriptor.js',
    includes: [
      "./runtime/surfaceDescriptorCatalog.js",
      'getThemeSurfaceDescriptorStrict',
      'hasDeclaredThemeWidget',
    ],
    excludes: ['./runtime/pluginCatalog.js', '/manifest.js'],
  },
  {
    file: 'src/themes/core/data/tabIcons.jsx',
    includes: ['getThemeSurfaceDescriptorStrict', 'THEME_TAB_ICON_VARIANT_UNSUPPORTED'],
    excludes: [
      'getThemePluginStrict',
      'getThemePlugin(',
      "|| 'standard'",
      '|| STANDARD_TAB_ICONS',
      '?? STANDARD_TAB_ICONS',
    ],
  },
  {
    file: 'src/themes/core/registry/index.js',
    includes: ['assertThemeSurfaceDescriptorId'],
    excludes: [
      'assertThemePluginId',
      'runtime/pluginCatalog.js',
      '../appearance/index.js',
      'getThemeComponent',
      'BACKGROUNDS',
      'TRANSITIONS',
      'normalizeThemeId(themeId, DEFAULT_THEME_ID)',
    ],
  },
  {
    file: 'src/themes/core/registry/appearance.js',
    includes: ['../appearance/index.js', 'getThemeComponent', 'BACKGROUNDS', 'TRANSITIONS'],
    excludes: [
      'surfaceDescriptorCatalog.js',
      'pluginCatalog.js',
      'loaders/widgets.js',
    ],
  },
  {
    file: 'src/themes/core/loaders/widgets.js',
    includes: ['assertThemeSurfaceDescriptorId', 'getThemeSurfaceDescriptorList'],
    excludes: [
      'assertThemePluginId',
      'runtime/pluginCatalog.js',
      'normalizeThemeId(themeId, DEFAULT_THEME_ID)',
    ],
  },
  {
    file: 'src/themes/core/loaders/bootLoaders.js',
    includes: ['assertThemePluginId', 'getThemePluginStrict'],
    excludes: ['normalizeThemeId(themeId, DEFAULT_THEME_ID)'],
  },
  {
    file: 'src/themes/core/loaders/bootShells.js',
    includes: ['assertCanonicalThemeId', 'THEME_BOOT_SHELL_CATALOG'],
    excludes: ['normalizeThemeId(themeId, DEFAULT_THEME_ID)', 'getThemePluginStrict', 'assertThemePluginId'],
  },
  {
    file: 'src/themes/core/profile.js',
    includes: ['getThemeProfileStrict', './runtime/profileCatalog.js'],
    excludes: [
      'normalizeThemeId(themeId, DEFAULT_THEME_ID)',
      './artifactSignatures.js',
      './runtime/pluginCatalog.js',
      './toolsVisualPolicy.js',
    ],
  },
  {
    file: 'src/themes/core/runtime/profileCatalog.js',
    includes: [
      'getThemeProfileStrict',
      'assertCanonicalThemeId',
      'createThemeProfile',
      '/profile.js',
    ],
    excludes: ['./pluginCatalog.js', '/manifest.js', 'normalizeThemeId'],
  },
  {
    file: 'src/themes/core/toolsVisualPolicy.js',
    includes: [
      'assertThemePluginId',
      'getToolsArtifactSurfacePolicy',
      'getToolsVisualPolicy',
    ],
    excludes: [
      'normalizeThemeId(themeId, DEFAULT_THEME_ID)',
      './artifactSignatures.js',
    ],
  },
  {
    file: 'src/themes/core/tools/artifactColorSystem.js',
    includes: [
      'TOOLS_ARTIFACT_DEFINITIONS',
      'assertArtifactColorId',
      'getArtifactColorTokens',
      'ZEN_ARTIFACT_COLOR_TOKENS',
    ],
    excludes: ['safeIndex', 'selectedArtifactIndex', 'colorToken:'],
  },
  {
    file: 'src/themes/core/motion/dashboard.js',
    includes: ['getThemePluginStrict'],
    excludes: ['normalizeThemeId(themeId, DEFAULT_THEME_ID)'],
  },
  {
    file: 'src/themes/core/boot/createThemeBootShellElement.js',
    includes: ['assertCanonicalThemeId', 'getBootShellActiveVariant'],
    excludes: ['normalizeThemeId(themeId, DEFAULT_THEME_ID)', 'getBootLoaderModuleByVariant', 'getThemePluginStrict', 'assertThemePluginId'],
  },
  {
    file: SCHEDULE_VISUAL_POLICY_FILE,
    includes: [
      'getThemePluginStrict',
      'SCHEDULE_VISUAL_POLICY_REQUIRED',
      './schedule/policyContract.js',
    ],
    excludes: [
      'normalizeThemeId',
      'DEFAULT_THEME_ID',
      'THEME_IDS',
      'getThemePlugin(',
      '/plugins/zen/',
      'zenScheduleVisualPolicy',
      'scheduleThemeProfile',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/loadingPolicy.js',
    includes: [
      '../../../themes/core/surfaceDescriptor.js',
      'hasDeclaredThemeWidget',
    ],
    excludes: [
      '../../../themes/core/runtime/pluginCatalog.js',
      '../../../themes/core/profile.js',
      'getThemePluginMap',
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/main/themeRegistry.js',
    includes: [
      '@/themes/core/surfaceDescriptor.js',
      'getThemeSurfaceDescriptorStrict',
      'assertCanonicalThemeId',
    ],
    excludes: ['@/themes/core/profile.js', 'getThemeProfile'],
  },
]);

const STRICT_NUDGE_THEME_RUNTIME_FILES = Object.freeze([
  {
    file: 'src/domains/nudge/runtime/nudgeRuntimeContext.js',
    includes: ['canonicalizeThemeIdInput', 'assertNudgeRuntimeThemeId', 'assertNudgeRuntimeContext'],
    excludes: ['normalizeThemeId('],
  },
  {
    file: 'src/domains/nudge/runtime/SentinelProtocolHost.js',
    includes: ['canonicalizeThemeIdInput', 'assertNudgeRuntimeThemeId'],
    excludes: [
      'normalizeThemeId(themeId, FALLBACK_THEME_ID)',
      'normalizeThemeId(runtimeContext?.themeId,',
      'themeId || runtimeContext?.themeId || activeThemeId || DEFAULT_THEME_ID',
    ],
  },
  {
    file: 'src/domains/nudge/nudgeSwarm.worker.js',
    includes: ['assertCanonicalThemeId'],
    excludes: [
      'canonicalizeThemeIdInput',
      'normalizeThemeId(themeId, DEFAULT_THEME_ID)',
      'activeThemeId || DEFAULT_THEME_ID',
    ],
  },
  {
    file: 'src/domains/protection/background/ProtectionDispatcher.js',
    includes: ['canonicalizeThemeIdInput', 'assertNudgeRuntimeThemeId', 'assertCanonicalThemeId'],
    excludes: ['normalizeThemeId(await readThemePreference(DEFAULT_THEME_ID), DEFAULT_THEME_ID)'],
  },
  {
    file: 'src/domains/protection/background/GateInterstitialController.js',
    includes: ['resolveGatePresentationThemeId', 'assertCanonicalThemeId'],
    excludes: ['normalizeThemeId(themePresentation?.themeId, DEFAULT_THEME_ID)'],
  },
  {
    file: 'src/apps/gate/GateInterstitialApp.jsx',
    includes: ['resolveGateSessionThemeId', 'canonicalizeThemeIdInput', 'assertCanonicalThemeId'],
    excludes: [
      'initializeDocumentThemeForThemeId(nextSession.themeId || DEFAULT_THEME_ID)',
      'nextSession.gatekeeperStyleVariant || nextSession.themeId || DEFAULT_THEME_ID',
    ],
  },
]);

function fail(message) {
  console.error(`[theme-seam-role-architecture] FAIL: ${message}`);
  process.exit(1);
}

async function readUtf8(relativePath) {
  return fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
}

function ensureIncludes(source, relativePath, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) {
      fail(`${relativePath}: missing required role token "${token}".`);
    }
  }
}

function ensureExcludes(source, relativePath, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) {
      fail(`${relativePath}: forbidden role token "${token}" detected.`);
    }
  }
}

async function collectSourceFiles(relativeDir) {
  const entries = await fs.readdir(path.resolve(rootDir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(relativePath));
      continue;
    }
    if (!/\.(?:js|jsx|ts|tsx)$/u.test(entry.name)) continue;
    files.push(relativePath);
  }

  return files;
}

async function ensureRetiredThemePackFacadesAbsent() {
  let entries;
  try {
    entries = await fs.readdir(path.resolve(rootDir, RETIRED_THEME_PACK_ROOT), {
      withFileTypes: true,
    });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  const facadeFiles = entries
    .filter((entry) => entry.isFile() && /\.(?:js|jsx|ts|tsx)$/u.test(entry.name))
    .map((entry) => `${RETIRED_THEME_PACK_ROOT}/${entry.name}`);
  if (facadeFiles.length > 0) {
    fail(`retired theme pack facades must remain deleted: ${facadeFiles.join(', ')}`);
  }
}

async function ensureRetiredThemeRuntimeFacadesAbsent() {
  await Promise.all(RETIRED_THEME_RUNTIME_FACADES.map(async (relativePath) => {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
      fail(`${relativePath}: retired theme facade must remain deleted.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }));
}

async function ensureRetiredZenArtifactPresentationFilesAbsent() {
  await Promise.all(RETIRED_ZEN_ARTIFACT_PRESENTATION_FILES.map(async (relativePath) => {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
      fail(`${relativePath}: retired Zen artifact presentation file must remain deleted.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }));
}

async function ensureThemeIconDeclarations() {
  await Promise.all(CANONICAL_THEME_IDS.map(async (themeId) => {
    const manifestFile = `${THEME_PLUGIN_ROOT}/${themeId}/manifest.js`;
    const manifestSource = await readUtf8(manifestFile);
    ensureIncludes(manifestSource, manifestFile, [
      'contracts:',
      'copy:',
      'tabIcons:',
    ]);
    ensureExcludes(manifestSource, manifestFile, ['tabLabels:']);
  }));
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return specifiers;
}

function resolveProjectImport(relativePath, specifier) {
  if (specifier.startsWith('@/')) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith('src/')) return specifier;
  if (!specifier.startsWith('.')) return null;
  return path.relative(
    rootDir,
    path.resolve(path.dirname(path.resolve(rootDir, relativePath)), specifier),
  ).replaceAll(path.sep, '/');
}

function normalizeModuleTarget(relativePath) {
  return relativePath?.replace(/\.(?:js|jsx|ts|tsx)$/u, '') || null;
}

function findThemeScopedRawElementSelectors(source) {
  const violations = [];
  for (const match of source.matchAll(THEME_SCOPE_SELECTOR_PATTERN)) {
    const selectorPrelude = match[0].trim();
    if (RAW_CONTROL_TYPE_SELECTOR_PATTERN.test(selectorPrelude)) {
      violations.push(selectorPrelude);
    }
    RAW_CONTROL_TYPE_SELECTOR_PATTERN.lastIndex = 0;
  }
  return violations;
}

function ensureRawSelectorDetectorContract() {
  const rejectedSelectors = [
    "[data-theme='zen'] input { color: red; }",
    "[data-theme='zen'] [data-schedule-tab] input { color: red; }",
    '[data-theme=zen] .feature > select:hover { color: red; }',
    '[data-theme="zen"] :where(button) { color: red; }',
  ];
  const allowedSelectors = [
    "[data-theme='zen'] .ui-input { color: red; }",
    "[data-theme='zen'] [data-slot=input] { color: red; }",
    "[data-theme='zen'] .feature-control { color: red; }",
  ];

  for (const selector of rejectedSelectors) {
    if (findThemeScopedRawElementSelectors(selector).length === 0) {
      fail(`raw theme selector detector missed its contract probe: ${selector}`);
    }
  }
  for (const selector of allowedSelectors) {
    if (findThemeScopedRawElementSelectors(selector).length > 0) {
      fail(`raw theme selector detector rejected an allowed contract probe: ${selector}`);
    }
  }
}

async function ensureScheduleVisualPolicyOwnership() {
  for (const retiredFile of RETIRED_SCHEDULE_PRESENTATION_FILES) {
    try {
      await fs.access(path.resolve(rootDir, retiredFile));
      fail(`${retiredFile}: retired Schedule owner must remain deleted.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  const manifestFactorySource = await readUtf8(
    'src/themes/core/runtime/createThemeManifest.js',
  );
  ensureIncludes(
    manifestFactorySource,
    'src/themes/core/runtime/createThemeManifest.js',
    [
      'scheduleVisualPolicy',
      'requireScheduleVisualPolicy',
      'REQUIRED_COPY_CONTRACT_FIELDS',
      'must declare contracts.copy.',
    ],
  );
  ensureExcludes(
    manifestFactorySource,
    'src/themes/core/runtime/createThemeManifest.js',
    [
      'scheduleVisualPolicy =',
      'BASE_COPY_CONTRACT',
      'createThemePack',
    ],
  );

  const policyContractSource = await readUtf8(SCHEDULE_VISUAL_POLICY_CONTRACT_FILE);
  ensureIncludes(policyContractSource, SCHEDULE_VISUAL_POLICY_CONTRACT_FILE, [
    'createScheduleVisualPolicy',
    'resolveScheduleRecipeVariant',
    'SCHEDULE_TEXTURE_BLEND_MODES',
    'SCHEDULE_VISUAL_POLICY_SCHEMA_VERSION',
    'SCHEDULE_RECIPE_VARIANTS',
  ]);

  await Promise.all(CANONICAL_THEME_IDS.map(async (themeId) => {
    const manifestFile = `${THEME_PLUGIN_ROOT}/${themeId}/manifest.js`;
    const policyFile = `${THEME_PLUGIN_ROOT}/${themeId}/scheduleVisualPolicy.js`;
    const manifestSource = await readUtf8(manifestFile);
    const policySource = await readUtf8(policyFile);

    ensureIncludes(manifestSource, manifestFile, [
      './scheduleVisualPolicy.js',
      './profile.js',
      'scheduleVisualPolicy:',
      'profile:',
    ]);
    ensureIncludes(policySource, policyFile, [
      '../../core/schedule/policyContract.js',
      'createScheduleVisualPolicy',
    ]);
    ensureExcludes(policySource, policyFile, [
      'SCHEDULE_VISUAL_POLICY_SCHEMA_VERSION',
      '../../core/scheduleVisualPolicy.js',
      '../../core/runtime/pluginCatalog.js',
      'getScheduleVisualPolicy',
      'scheduleThemeProfile',
    ]);
  }));

  const scheduleFiles = await collectSourceFiles(SCHEDULE_APP_ROOT);
  const directThemeComparisonPatterns = [
    /\b(?:[A-Za-z_$][\w$]*\??\.)?(?:themeId|normalizedThemeId)\s*(?:===|!==|==|!=)/u,
    /(?:===|!==|==|!=)\s*(?:[A-Za-z_$][\w$]*\??\.)?(?:themeId|normalizedThemeId)\b/u,
    /\bswitch\s*\(\s*(?:[A-Za-z_$][\w$]*\??\.)?(?:themeId|normalizedThemeId)\s*\)/u,
  ];
  const directRecipeComparisonPatterns = [
    /\b(?:variant|recipes\.[A-Za-z_$][\w$]*)\s*(?:===|!==|==|!=)/u,
    /(?:===|!==|==|!=)\s*(?:variant|recipes\.[A-Za-z_$][\w$]*)\b/u,
    /\bswitch\s*\(\s*(?:variant|recipes\.[A-Za-z_$][\w$]*)\s*\)/u,
  ];
  const publicSchedulePolicyTarget = normalizeModuleTarget(SCHEDULE_VISUAL_POLICY_FILE);

  await Promise.all(scheduleFiles.map(async (relativePath) => {
    const source = await readUtf8(relativePath);
    ensureExcludes(source, relativePath, [
      'THEME_IDS',
      'zenVisualRoles',
      'data-schedule-theme',
      'showTimeTrace',
      'pressureTrace',
      'phaseMarkers',
      'buildFieldBackground',
    ]);
    if (/\bisZen(?:Theme)?\b/u.test(source)) {
      fail(`${relativePath}: app-owned Schedule code may not branch through an isZen flag.`);
    }
    if (directThemeComparisonPatterns.some((pattern) => pattern.test(source))) {
      fail(`${relativePath}: app-owned Schedule code may not compare themeId; consume the declared visual recipe.`);
    }
    if (directRecipeComparisonPatterns.some((pattern) => pattern.test(source))) {
      fail(`${relativePath}: Schedule recipe interpretation must use resolveScheduleRecipeVariant().`);
    }
    if (
      source.includes('SCHEDULE_RECIPE_VARIANTS')
      && !source.includes('resolveScheduleRecipeVariant')
    ) {
      fail(`${relativePath}: Schedule recipe variants require the exhaustive public resolver.`);
    }

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveProjectImport(relativePath, specifier);
      const normalized = normalizeModuleTarget(resolved);
      if (
        normalized?.startsWith('src/themes/')
        && normalized.toLowerCase().includes('schedule')
        && normalized !== publicSchedulePolicyTarget
      ) {
        fail(
          `${relativePath}: Schedule app code must import Schedule theme policy only through "${SCHEDULE_VISUAL_POLICY_FILE}". Found "${specifier}".`,
        );
      }
    }
  }));

}

async function ensureThemeCustomCssOwnership() {
  ensureRawSelectorDetectorContract();
  const pluginEntries = await fs.readdir(path.resolve(rootDir, THEME_PLUGIN_ROOT), {
    withFileTypes: true,
  });

  await Promise.all(pluginEntries
    .filter((entry) => entry.isDirectory())
    .map(async (entry) => {
      const relativePath = `${THEME_PLUGIN_ROOT}/${entry.name}/theme.js`;
      let source;
      try {
        source = await readUtf8(relativePath);
      } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
      }
      const rawElementSelectors = findThemeScopedRawElementSelectors(source);
      if (rawElementSelectors.length > 0) {
        fail(
          `${relativePath}: theme customCSS may not acquire feature-control ownership through raw element selectors (${[...new Set(rawElementSelectors)].join(', ')}). Use shell, plugin-owned, or explicit .ui-* selectors.`,
        );
      }
      ensureExcludes(source, relativePath, ['[data-schedule-']);
    }));
}

async function ensureSourceContracts() {
  await ensureRetiredThemePackFacadesAbsent();
  await ensureRetiredThemeRuntimeFacadesAbsent();
  await ensureRetiredZenArtifactPresentationFilesAbsent();
  await ensureThemeIconDeclarations();

  const catalogSource = await readUtf8(CATALOG_FILE);
  const documentThemeSource = await readUtf8(DOCUMENT_THEME_FILE);
  const documentThemeProjectionSource = await readUtf8(DOCUMENT_THEME_PROJECTION_FILE);
  const viteSource = await readUtf8('vite.config.js');

  ensureIncludes(viteSource, 'vite.config.js', [
    'resolveThemeDefinitionManualChunk',
    "return 'theme-definitions'",
    'resolveThemeProfileManualChunk',
    "return 'theme-profiles'",
    'resolveThemePluginRuntimeManualChunk',
  ]);

  ensureIncludes(catalogSource, CATALOG_FILE, [
    "./ids.js",
    'assertThemeDefinitionId',
    'assertCanonicalThemeId',
    '/theme.js',
  ]);
  ensureExcludes(catalogSource, CATALOG_FILE, [
    './runtime/pluginCatalog.js',
    '/manifest.js',
    './state/themePreferenceRepository.js',
    './utils.js',
    'injectCSSVariables',
    'injectCustomCSS',
    'document.',
    'window.',
    'localStorage',
  ]);

  ensureIncludes(documentThemeSource, DOCUMENT_THEME_FILE, [
    "./catalog.js",
    "./documentThemeProjection.js",
    "./state/themePreferenceRepository.js",
    'applyDocumentThemeProjection',
    'writeThemePreferenceMirror',
    'dispatchThemePreferenceChange',
  ]);
  ensureExcludes(documentThemeSource, DOCUMENT_THEME_FILE, [
    './runtime/pluginCatalog.js',
    'getThemePluginList',
    'getThemePluginMap',
    'THEME_CATALOG',
    'THEME_ID_MAP',
    'falling back to',
    './utils.js',
    'injectCSSVariables',
    'injectCustomCSS',
  ]);
  ensureIncludes(documentThemeProjectionSource, DOCUMENT_THEME_PROJECTION_FILE, [
    './catalog.js', './utils.js', 'assertThemeDefinitionId',
    'applyDocumentThemeProjection', 'initializeDocumentThemeProjection',
    'injectCSSVariables', 'injectCustomCSS',
  ]);
  ensureExcludes(documentThemeProjectionSource, DOCUMENT_THEME_PROJECTION_FILE, [
    './state/', './runtime/', './documentTheme.js', 'localStorage',
    'writeThemePreferenceMirror', 'dispatchThemePreferenceChange', 'normalizeThemeId',
  ]);

  await Promise.all(STRICT_THEME_RUNTIME_FILES.map(async ({ file, includes, excludes }) => {
    const source = await readUtf8(file);
    ensureIncludes(source, file, includes);
    ensureExcludes(source, file, excludes);
  }));

  await Promise.all(STRICT_NUDGE_THEME_RUNTIME_FILES.map(async ({ file, includes, excludes }) => {
    const source = await readUtf8(file);
    ensureIncludes(source, file, includes);
    ensureExcludes(source, file, excludes);
  }));

  await ensureScheduleVisualPolicyOwnership();
  await ensureThemeCustomCssOwnership();

  const artifactFamilyCatalogSource = await readUtf8(
    'src/domains/protection/catalog/artifactFamilyCatalog.js',
  );
  ensureExcludes(
    artifactFamilyCatalogSource,
    'src/domains/protection/catalog/artifactFamilyCatalog.js',
    ['colorToken:'],
  );

  const artifactGalleryControllerSource = await readUtf8(
    'src/apps/dashboard/tabs/tools/components/useArtifactGalleryController.js',
  );
  ensureIncludes(
    artifactGalleryControllerSource,
    'src/apps/dashboard/tabs/tools/components/useArtifactGalleryController.js',
    [
      'getArtifactColorTokens(themeId, canonicalId)',
      "import { resolveArtifactGalleryIndexLayout } from './artifactGalleryIndexLayout.js';",
      'resolveArtifactGalleryIndexLayout(themeId)',
      'paintBleedBottomPx: galleryIndexLayout.sceneReserveBottomPx',
    ],
  );
  ensureExcludes(
    artifactGalleryControllerSource,
    'src/apps/dashboard/tabs/tools/components/useArtifactGalleryController.js',
    ['getArtifactSignature(visualKey', 'signatureVariant'],
  );

  const artifactGalleryViewSource = await readUtf8(
    'src/apps/dashboard/tabs/tools/components/ArtifactGalleryView.jsx',
  );
  ensureIncludes(
    artifactGalleryViewSource,
    'src/apps/dashboard/tabs/tools/components/ArtifactGalleryView.jsx',
    [
      'ArtifactNavigationSigil',
      "import ArtifactPathIndex from './ArtifactPathIndex.jsx';",
      "import { useArtifactPathGestures } from './artifactPathGestures.js';",
      "galleryIndexLayout?.variant === 'path'",
      '<ArtifactPathIndex',
      'slots={navigationSlots}',
      'activeIndex={navigation.safeIndex}',
      'pendingIndex={pendingSelectionIndex}',
      'selectionPhase={selectionRequestPhase}',
      'useArtifactPathGestures(sceneViewportRef, { enabled: canWalkPath, onStep: handlePathStep });',
      'navigation.handleSelectNext()',
      'navigation.handleSelectPrevious()',
      'onStep={handlePathStep}',
      'onIntent={handlePathIntent}',
      'data-artifact-gallery-horizon="true"',
      'data-artifact-gallery-select-slot',
      'data-artifact-gallery-locked-slot',
      'resolveProgressionFamilyUnlockDay',
      'data-artifact-gallery-item-label-trigger="intent"',
    ],
  );
  ensureExcludes(
    artifactGalleryViewSource,
    'src/apps/dashboard/tabs/tools/components/ArtifactGalleryView.jsx',
    [
      'ChevronLeft',
      'ChevronRight',
      'data-artifact-gallery-nav-arrow',
      'data-artifact-gallery-index-segment',
      'data-artifact-gallery-locked-divider',
      'title={resolveArtifactNavigationLabel',
      'LockedArtifactIntroduction',
    ],
  );

  // The path presenter reaches only the neighbouring artifacts, announces
  // selection accessibly, and exposes read-only inventory to QA readers.
  const artifactPathIndexFile = 'src/apps/dashboard/tabs/tools/components/ArtifactPathIndex.jsx';
  const artifactPathIndexSource = await readUtf8(artifactPathIndexFile);
  ensureIncludes(artifactPathIndexSource, artifactPathIndexFile, [
    'export default function ArtifactPathIndex(',
    "import './artifactPathIndex.css';",
    '<nav',
    'data-artifact-gallery-index="path"',
    'aria-label={ariaLabel}',
    'data-artifact-path-threshold={threshold.direction}',
    'onStep(threshold.step)',
    'data-artifact-path-order=',
    'data-artifact-path-current=',
    'data-artifact-path-locked=',
    'aria-busy={isSelectionPending',
    "slot.kind === 'locked'",
    'aria-live="polite"',
  ]);
  ensureExcludes(artifactPathIndexSource, artifactPathIndexFile, [
    'onSelect', 'itemIndex)}', 'tabIndex=', 'ChevronLeft', 'ChevronRight', 'data-artifact-gallery-nav-arrow',
    'title={', 'LockedArtifactIntroduction', 'localStorage', 'chrome.storage', 'ResizeObserver',
  ]);
  for (const specifier of extractImportSpecifiers(artifactPathIndexSource)) {
    if (specifier !== 'react'
      && resolveProjectImport(artifactPathIndexFile, specifier)
        !== 'src/apps/dashboard/tabs/tools/components/artifactPathIndex.css') {
      fail(`${artifactPathIndexFile}: the navigation presenter consumes props and its own CSS, not settings, runtime or theme owners.`);
    }
  }

  const zenArtifactPanelSource = await readUtf8(
    'src/themes/plugins/zen/widgets/tools/ZenArtifactPanel.jsx',
  );
  ensureIncludes(
    zenArtifactPanelSource,
    'src/themes/plugins/zen/widgets/tools/ZenArtifactPanel.jsx',
    [
      'ZenArtifactControlGarden',
      'data-artifact-control-garden="true"',
    ],
  );
  ensureExcludes(
    zenArtifactPanelSource,
    'src/themes/plugins/zen/widgets/tools/ZenArtifactPanel.jsx',
    [
      'String(focusedAspect.index + 1).padStart',
      'ZenArtifactBeadRail',
    ],
  );

  const zenArtifactSwitchBandSource = await readUtf8(
    'src/themes/plugins/zen/widgets/tools/ZenArtifactSwitchBand.jsx',
  );
  ensureIncludes(
    zenArtifactSwitchBandSource,
    'src/themes/plugins/zen/widgets/tools/ZenArtifactSwitchBand.jsx',
    [
      'data-zen-artifact-control-box="true"',
      'data-zen-artifact-box-state',
      'data-zen-artifact-detail-kind',
      'row.Control',
      'key={row.childKey}',
      'aria-expanded={expanded}',
      'aria-controls=',
      'aria-labelledby=',
      'hidden={!expanded}',
      'onFeedbackChange={reportFeedback}',
    ],
  );
  ensureExcludes(
    zenArtifactSwitchBandSource,
    'src/themes/plugins/zen/widgets/tools/ZenArtifactSwitchBand.jsx',
    [
      'ZenArtifactBeadRail',
      'useZenArtifactRailChoice',
      'useZenArtifactControlCommit',
      'useArtifactControlCommit(',
      'ArtifactNumberControl',
      'ArtifactRangeControl',
    ],
  );

  // Theme disclosure places the app-injected row.Control. Input semantics,
  // mutation pending/error handling and numeric editors remain app-owned.
  const artifactControlInputFile = 'src/apps/dashboard/tabs/tools/components/ArtifactControlRowInput.jsx';
  const artifactControlInputSource = await readUtf8(artifactControlInputFile);
  ensureIncludes(artifactControlInputSource, artifactControlInputFile, [
    'ArtifactNumberControl',
    'ArtifactRangeControl',
    'useArtifactControlCommit',
    "controlMode === 'binary'",
    "props.controlMode === 'choice'",
    "props.controlMode === 'number'",
    "props.controlMode === 'range'",
    'onToggle',
    'onValueChange',
    'onFeedbackChange',
    'role="radiogroup"',
    'role="radio"',
    'aria-checked=',
    'role="alert"',
  ]);
  ensureExcludes(artifactControlInputSource, artifactControlInputFile, [
    'chrome.storage', 'localStorage', 'dbManager', 'new Worker(',
    'useZenArtifactControlCommit',
  ]);

  const artifactControlCommitSource = await readUtf8(
    'src/themes/core/tools/useArtifactControlCommit.js',
  );
  ensureIncludes(
    artifactControlCommitSource,
    'src/themes/core/tools/useArtifactControlCommit.js',
    [
      'export function useArtifactControlCommit(',
      'const result = onCommit(nextValue);',
      'Promise.resolve(result).then(acknowledge, fail)',
      'sequenceRef.current === sequence',
      'result?.error || result?.ok === false',
      'activeValue: pendingCommit?.value ?? value',
    ],
  );
  ensureExcludes(
    artifactControlCommitSource,
    'src/themes/core/tools/useArtifactControlCommit.js',
    ['localStorage', 'useZenArtifactRailChoice', 'useZenArtifactControlCommit'],
  );

  const artifactSegmentedControlSource = await readUtf8(
    'src/apps/dashboard/tabs/tools/components/ArtifactSegmentedControl.jsx',
  );
  ensureIncludes(
    artifactSegmentedControlSource,
    'src/apps/dashboard/tabs/tools/components/ArtifactSegmentedControl.jsx',
    [
      "import { useArtifactControlCommit } from '@/themes/core/tools/useArtifactControlCommit.js';",
      'useArtifactControlCommit({',
    ],
  );
  ensureExcludes(
    artifactSegmentedControlSource,
    'src/apps/dashboard/tabs/tools/components/ArtifactSegmentedControl.jsx',
    ['useZenArtifactControlCommit', 'useZenArtifactRailChoice'],
  );

  const zenThemeSource = await readUtf8('src/themes/plugins/zen/theme.js');
  ensureIncludes(
    zenThemeSource,
    'src/themes/plugins/zen/theme.js',
    [
      "data-dashboard-active-tab='tools'",
      '--artifact-workspace-threshold-width: 18px',
    ],
  );
  ensureExcludes(
    zenThemeSource,
    'src/themes/plugins/zen/theme.js',
    [
      "[data-theme='zen'] [data-artifact-gallery-quickbar='true']",
      "[data-theme='zen'] [data-artifact-gallery-nav-track='true']",
      "[data-theme='zen'] [data-artifact-gallery-select-slot]",
      "[data-theme='zen'] [data-artifact-gallery-locked-slot='true']",
    ],
  );
}

async function ensureDocumentationContracts() {
  const governanceDoc = await readUtf8('docs/governance/import-boundaries.md');
  const architectureDoc = await readUtf8('docs/system-architecture/03-theme-plugin-and-zen.md');
  const toolsArtifactBoundaryDoc = await readUtf8(
    'docs/architecture/repository/tools-artifact-support-boundary-map.md',
  );
  const themeEngineBoundaryDoc = await readUtf8(
    'docs/architecture/repository/theme-engine-boundary-map.md',
  );
  const sitesScheduleBoundaryDoc = await readUtf8(
    'docs/architecture/repository/sites-schedule-boundary-map.md',
  );
  const agentsDoc = await readUtf8('AGENTS.md');

  ensureIncludes(governanceDoc, 'docs/governance/import-boundaries.md', [
    'theme public surface는 책임별 seam으로 고정한다.',
    '같은 책임이면 기존 seam public surface를 의도적으로 확장한다.',
    '새 책임이면 새 named seam을 추가하고 문서와 CI를 같이 갱신한다.',
    'dashboard/workspace/interaction motion contract는 `@/themes/core/motion/index.js` 로 수렴한다.',
  ]);
  ensureIncludes(architectureDoc, 'docs/system-architecture/03-theme-plugin-and-zen.md', [
    'read concern이면 `catalog.js`, side effect concern이면 `documentTheme.js`',
    '새 concern이 둘 중 어디에도 자연스럽게 들어가지 않으면 새 named seam을 추가한다.',
    'dashboard tab transition, workspace reveal, dashboard state transition, interaction motion policy는 `src/themes/core/motion/index.js` 가 canonical owner다.',
    'core runtime boundary는 `assertCanonicalThemeId`, `assertThemeSurfaceDescriptorId`, `assertThemePluginId`, `assertThemeDefinitionId`로 이미 canonical인 값을 검증한다.',
    '`src/themes/core/surfaceDescriptor.js`만 읽는다.',
    'nudge/protection message boundary는 외부 payload나 debug override만 `canonicalizeThemeIdInput`로 올릴 수 있다.',
    'plugin customCSS는 root token, shell class, plugin-owned selector, 명시적 `.ui-*` primitive만 전역 소유할 수 있다.',
    'feature surface 내부의 raw `input`, `button`, `select`, `textarea`, heading geometry는 해당 surface가 소유한다.',
    'Schedule visual policy lookup은 `src/themes/core/scheduleVisualPolicy.js`의 strict resolver만 사용한다.',
    'app caller는 plugin 파일이나 leaf contract를 직접 import하지 않고 `src/themes/core/scheduleVisualPolicy.js`만 사용한다.',
  ]);
  ensureIncludes(
    themeEngineBoundaryDoc,
    'docs/architecture/repository/theme-engine-boundary-map.md',
    [
      'Schedule visual policy lookup',
      'src/themes/core/scheduleVisualPolicy.js',
      'App-local cross-theme Schedule map',
    ],
  );
  ensureIncludes(
    sitesScheduleBoundaryDoc,
    'docs/architecture/repository/sites-schedule-boundary-map.md',
    [
      'Schedule visual policy',
      'getScheduleVisualPolicy()',
      'Schedule app-local cross-theme palette/profile map',
    ],
  );
  ensureIncludes(
    toolsArtifactBoundaryDoc,
    'docs/architecture/repository/tools-artifact-support-boundary-map.md',
    [
      'src/themes/core/tools/artifactColorSystem.js',
      'canonical artifact id',
      'applies color to the selected artifact',
      'ZenArtifactSwitchBand.jsx',
      'useArtifactControlCommit()',
      'themes/core/tools/useArtifactControlCommit.js',
      'profile.tools.galleryIndexVariant',
      'artifactGalleryIndexLayout.js',
      'ArtifactPathIndex.jsx',
      'artifactPathIndex.css',
      'artifactPathGestures.js',
      'artifactGalleryPositionState.js',
    ],
  );
  ensureIncludes(agentsDoc, 'AGENTS.md', [
    'If a new theme concern does not fit the existing seams, add a new named seam',
  ]);
}

async function ensurePackageContracts() {
  const pkg = JSON.parse(await readUtf8('package.json'));
  const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};

  for (const phase of ['prebuild', 'release', 'structural']) {
    if (!getBuildCheckPlan(phase, { packageScripts: scripts })
      .some((check) => check.script === 'check:theme-seam-role-architecture')) {
      fail(`Theme seam role architecture must run in the ${phase} check phase.`);
    }
  }

  const requiredScripts = [
    {
      scriptName: 'check:theme-seam-role-architecture',
      includesAny: ['node ./scripts/ci/check-theme-seam-role-architecture.mjs'],
    },
    {
      scriptName: 'dev',
      includesAny: [
        'npm run check:theme-seam-role-architecture',
        'node ./scripts/ci/run-build-checks.mjs',
      ],
    },
    {
      scriptName: 'prebuild:release',
      includesAny: [
        'npm run check:theme-seam-role-architecture',
        'node ./scripts/ci/run-build-checks.mjs',
      ],
    },
    {
      scriptName: 'build:release',
      includesAny: [
        'npm run check:theme-seam-role-architecture',
        'node ./scripts/ci/run-build-checks.mjs',
      ],
    },
  ];

  for (const { scriptName, includesAny } of requiredScripts) {
    const command = scripts[scriptName];
    if (typeof command !== 'string' || !includesAny.some((token) => command.includes(token))) {
      fail(
        `package.json#scripts.${scriptName}: missing one of ${includesAny.map((token) => `"${token}"`).join(', ')}.`,
      );
    }
  }
}

async function main() {
  await ensureSourceContracts();
  await ensureDocumentationContracts();
  await ensurePackageContracts();
  console.log('[theme-seam-role-architecture] PASS: theme seam roles stay narrow while allowing explicit new seams.');
}

main().catch((error) => {
  console.error('[theme-seam-role-architecture] Unexpected error:', error);
  process.exit(1);
});
