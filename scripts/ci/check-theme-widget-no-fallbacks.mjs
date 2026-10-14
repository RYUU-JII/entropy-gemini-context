#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { getThemePluginList } from '../../src/themes/core/runtime/pluginCatalog.js';
import { getThemeSurfaceDescriptorList } from '../../src/themes/core/runtime/surfaceDescriptorCatalog.js';
import { resolveThemePluginModuleKey } from '../../src/themes/core/runtime/pluginModulePath.js';

const rootDir = process.cwd();
const violations = [];
const REQUIRED_SITES_WIDGET_TYPES = Object.freeze([
  'SitesRegistry',
  'SitesTargetPanel',
]);
const FILTER_TEST_WIDGET_TYPE = 'FilterTest';
const PUBLIC_WIDGET_DIRECTORIES = Object.freeze(new Set([
  'core',
  'main',
  'sites',
  'signals',
  'tools',
]));
const WIDGET_GLOB_LITERAL_PATTERN = /['"]([^'"]+)['"]/gu;

const readSource = (relativePath) => fs.readFile(
  path.resolve(rootDir, relativePath),
  'utf8',
);

const [
  sitesManagementSource,
  sitesNotebookTargetSource,
  widgetLoaderSource,
  publicWidgetModuleMapSource,
  devWidgetModuleMapSource,
] = await Promise.all([
  readSource('src/apps/dashboard/workspaces/sites/SitesManagementSurface.jsx'),
  readSource('src/apps/dashboard/tabs/sites/components/SitesNotebookTarget.jsx'),
  readSource('src/themes/core/loaders/widgets.js'),
  readSource('src/themes/core/loaders/widgetModuleMap.public.js'),
  readSource('src/themes/core/loaders/widgetModuleMap.dev.js'),
]);

const extractWidgetGlobs = (source) => Array.from(
  source.matchAll(WIDGET_GLOB_LITERAL_PATTERN),
  (match) => match[1],
).filter((pattern) => (
  pattern.startsWith('../../plugins/')
  || pattern.startsWith('!../../plugins/')
));

const splitWidgetGlobs = (source) => {
  const patterns = extractWidgetGlobs(source);
  return Object.freeze({
    positive: patterns.filter((pattern) => !pattern.startsWith('!')),
    negative: patterns
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => pattern.slice(1)),
  });
};

const isModuleKeyMapped = (moduleKey, globs) => (
  globs.positive.some((pattern) => path.matchesGlob(moduleKey, pattern))
  && !globs.negative.some((pattern) => path.matchesGlob(moduleKey, pattern))
);

const publicWidgetMapGlobs = splitWidgetGlobs(publicWidgetModuleMapSource);
const devWidgetMapGlobs = splitWidgetGlobs(devWidgetModuleMapSource);
const publicWidgetGlobs = publicWidgetMapGlobs.positive;
const devWidgetGlobs = devWidgetMapGlobs.positive;

for (const pattern of publicWidgetGlobs) {
  const directoryMatch = pattern.match(/^\.\.\/\.\.\/plugins\/\*\/widgets\/([^/]+)\//u);
  const widgetDirectory = directoryMatch?.[1] || '';
  if (!PUBLIC_WIDGET_DIRECTORIES.has(widgetDirectory)) {
    violations.push(
      `public widget module map: non-production or broad widget directory glob is forbidden (${pattern}).`,
    );
  }
}

if (publicWidgetGlobs.some((pattern) => pattern.includes('/widgets/filter/'))) {
  violations.push('public widget module map: FilterTest modules must be absent from the compile-time import graph.');
}
if (!devWidgetGlobs.some((pattern) => pattern.includes('/widgets/filter/'))) {
  violations.push('development widget module map: the explicit FilterTest module glob is required.');
}
if (widgetLoaderSource.includes(FILTER_TEST_WIDGET_TYPE)) {
  violations.push('theme widget loader: release-specific FilterTest branching belongs in the build-selected module map.');
}

const themePluginList = getThemePluginList();
const themePluginMap = Object.fromEntries(
  themePluginList.map((manifest) => [manifest.id, manifest]),
);

for (const descriptor of getThemeSurfaceDescriptorList()) {
  const manifest = themePluginMap[descriptor.id];
  if (!manifest) {
    violations.push(`${descriptor.id}: full plugin manifest is missing for the surface descriptor.`);
    continue;
  }

  const manifestSourcePath = `src/themes/plugins/${descriptor.id}/manifest.js`;
  const manifestSource = await readSource(manifestSourcePath);
  const descriptorImportMatch = manifestSource.match(
    /import\s+\{\s*([A-Za-z][A-Za-z0-9]*ThemeSurfaceDescriptor)\s*\}\s+from\s+['"]\.\/surfaceDescriptor\.js['"]/u,
  );
  const descriptorBinding = descriptorImportMatch?.[1] || '';
  if (!descriptorBinding) {
    violations.push(`${descriptor.id}: manifest must import its plugin-owned surface descriptor.`);
  } else {
    [
      `tabIcons: ${descriptorBinding}.tabIconVariant`,
      `widgets: { loaders: ${descriptorBinding}.widgetLoaders }`,
    ].forEach((requiredSource) => {
      if (!manifestSource.includes(requiredSource)) {
        violations.push(
          `${descriptor.id}: manifest must derive "${requiredSource}" from its surface descriptor.`,
        );
      }
    });
  }

  const profileImportMatch = manifestSource.match(
    /import\s+\{\s*([A-Za-z][A-Za-z0-9]*ThemeProfileDefinition)\s*\}\s+from\s+['"]\.\/profile\.js['"]/u,
  );
  const profileBinding = profileImportMatch?.[1] || '';
  if (!profileBinding) {
    violations.push(`${descriptor.id}: manifest must import its plugin-owned profile definition.`);
  } else if (!manifestSource.includes(`profile: ${profileBinding}`)) {
    violations.push(
      `${descriptor.id}: manifest must consume "profile: ${profileBinding}" without rebuilding the profile inline.`,
    );
  }
  if (manifestSource.includes('widgets: { main:')) {
    violations.push(
      `${descriptor.id}: manifest must not rebuild profile.widgets.main beside the plugin profile definition.`,
    );
  }

  if (manifest.profile?.widgets?.main !== descriptor.mainWidgetThemeId) {
    violations.push(`${descriptor.id}: manifest/profile main widget owner drifted from the surface descriptor.`);
  }
  if (manifest.contracts?.copy?.tabIcons !== descriptor.tabIconVariant) {
    violations.push(`${descriptor.id}: manifest tab icon variant drifted from the surface descriptor.`);
  }
  if (
    JSON.stringify(manifest.widgets?.loaders || {})
    !== JSON.stringify(descriptor.widgetLoaders)
  ) {
    violations.push(`${descriptor.id}: manifest widget loaders drifted from the surface descriptor.`);
  }

  for (const [widgetType, modulePath] of Object.entries(descriptor.widgetLoaders)) {
    const moduleKey = resolveThemePluginModuleKey(descriptor.id, modulePath);
    const sourcePath = path.resolve(
      rootDir,
      'src/themes/plugins',
      descriptor.id,
      modulePath.slice(2),
    );
    try {
      await fs.access(sourcePath);
    } catch {
      violations.push(`${descriptor.id}:${widgetType}: declared widget module does not exist (${modulePath}).`);
    }

    if (!moduleKey || !isModuleKeyMapped(moduleKey, devWidgetMapGlobs)) {
      violations.push(`${descriptor.id}:${widgetType}: dev module map does not cover ${modulePath}.`);
    }

    const isPublicMapped = moduleKey
      ? isModuleKeyMapped(moduleKey, publicWidgetMapGlobs)
      : false;
    const isExplicitlyPublicExcluded = moduleKey
      ? publicWidgetMapGlobs.negative.some((pattern) => path.matchesGlob(moduleKey, pattern))
      : false;
    if (widgetType === FILTER_TEST_WIDGET_TYPE) {
      if (isPublicMapped) {
        violations.push(`${descriptor.id}:${widgetType}: public module map must not cover ${modulePath}.`);
      }
    } else if (!isPublicMapped && !isExplicitlyPublicExcluded) {
      violations.push(
        `${descriptor.id}:${widgetType}: public module map neither covers nor explicitly excludes ${modulePath}.`,
      );
    }
  }

  const widgetCapability = manifest?.widgets;
  if (!widgetCapability || typeof widgetCapability !== 'object') {
    violations.push(`${manifest?.id || 'unknown'}: widgets capability is missing.`);
    continue;
  }

  if (Object.prototype.hasOwnProperty.call(widgetCapability, 'fallbacks')) {
    violations.push(`${manifest.id}: widgets.fallbacks is forbidden.`);
  }

  for (const widgetType of REQUIRED_SITES_WIDGET_TYPES) {
    const loader = widgetCapability?.loaders?.[widgetType];
    if (typeof loader !== 'string' || !loader.trim()) {
      violations.push(`${manifest.id}: explicit ${widgetType} loader is required.`);
    }
  }

  const filterTestLoader = widgetCapability?.loaders?.[FILTER_TEST_WIDGET_TYPE];
  if (
    typeof filterTestLoader !== 'string'
    || !/^\.\/widgets\/filter\/[A-Za-z0-9_-]+FilterTest\.(?:js|jsx|ts|tsx)$/u.test(filterTestLoader)
  ) {
    violations.push(
      `${manifest.id}: development FilterTest must remain an explicit plugin-owned loader declaration.`,
    );
  }
}

// Both widgets remain mandatory declarations for every theme. Their runtime
// gates differ: the workspace admits its registry first; the named notebook
// boundary admits the selected target's code only when that reading is needed.
for (const { owner, source, widgetType, binding, readiness } of [
  { owner: 'SitesManagementSurface', source: sitesManagementSource, widgetType: 'SitesRegistry', binding: 'RegistryPanel', readiness: 'sitesTabReadiness' },
  { owner: 'SitesNotebookTarget', source: sitesNotebookTargetSource, widgetType: 'SitesTargetPanel', binding: 'TargetPanel', readiness: 'readiness' },
]) {
  if (source.includes('StandardSiteRegistryPanel') || source.includes('TargetProtocolPanel')) {
    violations.push(`${owner}: app-level standard Sites widget substitution is forbidden.`);
  }
  if (/(?:from\s*|import\s*\()\s*['"][^'"]*themes\/plugins\//u.test(source)) {
    violations.push(`${owner}: direct theme implementation imports must not bypass canonical widget resolution.`);
  }
  if (!source.includes('SITES_THEME_WIDGET_REQUIRED')) {
    violations.push(`${owner}: a missing admitted widget must surface SITES_THEME_WIDGET_REQUIRED.`);
  }
  const resolutions = Array.from(source.matchAll(/getThemeWidget\(([^)]*)\)/gu), (match) => match[1]);
  if (resolutions.length !== 1 || resolutions[0] !== `themeId, '${widgetType}'`) {
    violations.push(`${owner}: ${widgetType} must resolve once from the current canonical themeId without another-theme/default lookup.`);
  }
  const admittedResolution = new RegExp(
    `const ${binding}\\s*=\\s*useMemo\\(\\(\\)\\s*=>\\s*\\(\\s*${readiness}\\.ready\\s*\\?\\s*getThemeWidget\\(themeId, ['"]${widgetType}['"]\\)\\s*:\\s*null\\s*\\),\\s*\\[${readiness}\\.ready,\\s*${readiness}\\.readyKey,\\s*themeId\\]\\);`,
    'u',
  );
  if (!admittedResolution.test(source)) {
    violations.push(`${owner}: ${widgetType} resolution must wait for its own code-admission gate; pending code is not a substitute widget.`);
  }
  if (new RegExp(`\\b${binding}\\s*(?:\\|\\||\\?\\?)`, 'u').test(source)) {
    violations.push(`${owner}: ${widgetType} resolution must not default to another component.`);
  }
}

const managementGate = sitesManagementSource.slice(sitesManagementSource.indexOf('export default function SitesManagementSurface('));
const registryMissingGate = managementGate.match(/if\s*\(\s*!RegistryPanel\s*\)\s*\{([\s\S]*?)\n\s*\}/u);
if (!registryMissingGate
  || !registryMissingGate[1].includes("!RegistryPanel ? 'SitesRegistry' : null")
  || !registryMissingGate[1].includes('error={createSitesThemeWidgetError(themeId, missingWidgetTypes)}')
  || managementGate.indexOf(registryMissingGate[0]) > managementGate.indexOf('<SitesManagementContent')) {
  violations.push('SitesManagementSurface: a missing SitesRegistry must return the strict theme-widget error before workspace content mounts.');
}
if (/RegistryPanel\s*\?\s*\(/u.test(sitesManagementSource)) {
  violations.push('SitesManagementSurface: SitesRegistry rendering must not use a substitution branch.');
}
if (!/const missingWidgetError\s*=\s*readiness\.ready\s*&&\s*!TargetPanel\s*\?\s*new Error\(`SITES_THEME_WIDGET_REQUIRED:\$\{themeId\}:SitesTargetPanel`\)\s*:\s*null/u.test(sitesNotebookTargetSource)) {
  violations.push('SitesNotebookTarget: admitted-but-missing SitesTargetPanel must create a strict theme-widget error.');
}
if (!sitesNotebookTargetSource.includes('surfaceId: DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET')
  || !sitesNotebookTargetSource.includes('data-dashboard-async-boundary={DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.SITES_NOTEBOOK_TARGET}')
  || !sitesNotebookTargetSource.includes('isActive: isRuntimeActive')) {
  violations.push('SitesNotebookTarget: selected target code admission must remain in its named runtime-active notebook boundary.');
}
if (!sitesNotebookTargetSource.includes('const error = readiness.error || missingWidgetError;')
  || !/\{error\s*\?\s*\([\s\S]*?role="alert"[\s\S]*?\)\s*:\s*TargetPanel\s*\?\s*<TargetPanel \{\.\.\.props\} \/>\s*:\s*\([\s\S]*?role="status" aria-busy="true"/u.test(sitesNotebookTargetSource)) {
  violations.push('SitesNotebookTarget: widget readiness/missing errors must render before the target; only pending code may render a loading status.');
}

if (violations.length > 0) {
  console.error('[theme-widget-no-fallbacks] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[theme-widget-no-fallbacks] PASS: surface descriptors own widget loading, plugin profile definitions own behavior/layout composition, public packaging excludes FilterTest, and runtime substitution remains forbidden.');
