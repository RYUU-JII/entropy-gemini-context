import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const failures = [];

function getPathSegments(key) {
  return String(key).split('.').filter(Boolean);
}

function getNestedValue(source, key) {
  return getPathSegments(key).reduce(
    (acc, segment) => (acc && typeof acc === 'object' ? acc[segment] : undefined),
    source,
  );
}

async function readJson(relativePath) {
  const filePath = path.resolve(rootDir, relativePath);
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readText(relativePath) {
  const filePath = path.resolve(rootDir, relativePath);
  return readFile(filePath, 'utf8');
}

function collectTranslationKeys(source) {
  const keys = new Set();
  const matcher = /\b(?:tTabs|t)\(\s*'(main\.[A-Za-z0-9_]+)'/g;
  let match = matcher.exec(source);
  while (match) {
    keys.add(match[1]);
    match = matcher.exec(source);
  }
  return keys;
}

const requiredExperimentKeys = [
  'experiment.lab_module_error_title',
  'experiment.lab_module_retry',
  'experiment.lab_sections.bonsai.label',
  'experiment.lab_sections.bonsai.title',
  'experiment.lab_sections.bonsai.desc',
  'experiment.lab_sections.bonsai_classic.label',
  'experiment.lab_sections.bonsai_classic.title',
  'experiment.lab_sections.bonsai_classic.desc',
  'experiment.lab_sections.bonsai_vnext.label',
  'experiment.lab_sections.bonsai_vnext.title',
  'experiment.lab_sections.bonsai_vnext.desc',
  'experiment.lab_sections.bonsai_render_debug.label',
  'experiment.lab_sections.bonsai_render_debug.title',
  'experiment.lab_sections.bonsai_render_debug.desc',
  'experiment.lab_sections.runtime.label',
  'experiment.lab_sections.runtime.title',
  'experiment.lab_sections.runtime.desc',
  'experiment.lab_sections.clse.label',
  'experiment.lab_sections.clse.title',
  'experiment.lab_sections.clse.desc',
  'experiment.lab_sections.pond.label',
  'experiment.lab_sections.pond.title',
  'experiment.lab_sections.pond.desc',
  'experiment.lab_sections.artifact.label',
  'experiment.lab_sections.artifact.title',
  'experiment.lab_sections.artifact.desc',
  'experiment.artifacts.Artifact_Monolith',
  'experiment.artifacts.Artifact_Gate',
  'experiment.artifacts.Artifact_Lethe',
  'experiment.artifacts.Artifact_SentinelFlare',
  'experiment.artifacts.active',
  'experiment.artifacts.idle',
  'experiment.render_debug.actions.run',
  'experiment.render_debug.status.pass',
  'experiment.render_debug.status.fail',
  'experiment.render_debug.status.not_run',
  'experiment.render_debug.summary.scene_updates',
  'experiment.render_debug.summary.back_layer',
  'experiment.render_debug.summary.front_layer',
  'experiment.render_debug.summary.branch_rig',
  'experiment.render_debug.columns.step',
  'experiment.render_debug.columns.scene',
  'experiment.render_debug.columns.back',
  'experiment.render_debug.columns.front',
  'experiment.render_debug.columns.branch',
  'experiment.render_debug.columns.reason',
  'experiment.render_debug.observations.scene_changed',
  'experiment.render_debug.observations.scene_steady',
  'experiment.render_debug.observations.rebake',
  'experiment.render_debug.observations.reuse',
  'experiment.render_debug.observations.rebuild',
  'experiment.render_debug.steps.baseline',
  'experiment.render_debug.steps.wind_motion',
  'experiment.render_debug.steps.gust_motion',
  'experiment.render_debug.steps.bloom_band',
  'experiment.render_debug.steps.health_band',
  'experiment.render_debug.steps.light_band',
  'experiment.render_debug.steps.canvas_resize',
  'experiment.render_debug.steps.seed_change',
  'experiment.render_debug.steps.version_bump',
  'experiment.render_debug.steps.resume_rehydrate',
  'experiment.render_debug.reasons.initial',
  'experiment.render_debug.reasons.wind_runtime',
  'experiment.render_debug.reasons.bloom_backdrop',
  'experiment.render_debug.reasons.health_full',
  'experiment.render_debug.reasons.light_bake',
  'experiment.render_debug.reasons.canvas_static',
  'experiment.render_debug.reasons.seed_cache',
  'experiment.render_debug.reasons.version_cache',
  'experiment.render_debug.reasons.resume_rig',
  'experiment.render_debug.empty',
];

const requiredWorkerRuntimeKeys = [
  'worker_runtime.title',
  'worker_runtime.subtitle',
  'worker_runtime.refresh',
  'worker_runtime.clear',
  'worker_runtime.events',
  'worker_runtime.fail',
  'worker_runtime.fallback',
  'worker_runtime.circuit',
  'worker_runtime.task_type',
  'worker_runtime.all_task_types',
  'worker_runtime.priority',
  'worker_runtime.all_priorities',
  'worker_runtime.filtered',
  'worker_runtime.reset_filters',
  'worker_runtime.unknown',
  'worker_runtime.worker',
  'worker_runtime.task',
  'worker_runtime.priority_short',
  'worker_runtime.lane',
  'worker_runtime.context_short',
  'worker_runtime.no_events',
];

const requiredToolsSurfaceKeys = [
  'tools.workspace_eyebrow',
  'tools.workspace_desc',
  'tools.scope_artifacts',
  'tools.scope_system',
  'tools.open_sites',
  'tools.open_settings',
  'tools.support_mode',
];

const requiredThemeSurfaceKeys = [
  'theme.workspace_eyebrow',
  'theme.workspace_desc',
  'theme.scope_theme',
  'theme.scope_no_system',
  'theme.open_settings',
];

const dashboardTabsSourceFiles = [
  'src/apps/dashboard/tabs/main/MainTab.jsx',
  'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
  'src/apps/dashboard/tabs/main/home/homeBriefViewModel.js',
  'src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js',
];

const requiredDynamicDashboardTabsKeys = [
  'main.home_site_state_muted',
  'main.home_site_state_alert',
  'main.home_site_state_warn',
  'main.home_site_state_ok',
  'main.bonsai_ambient_watchful',
  'main.bonsai_ambient_clear',
  'main.bonsai_ambient_recovery',
  'main.bonsai_ambient_overcast',
  'main.bonsai_ambient_calm',
];

const requiredDashboardShellFiles = [
  'src/apps/dashboard/DashboardPage.jsx',
  'src/apps/dashboard/layout/Sidebar.jsx',
];

const requiredDashboardShellKeys = [
  'main.nav',
  'main.title',
  'main.desc',
];

const noDefaultValueDashboardFiles = [
  'src/apps/dashboard/layout/Sidebar.jsx',
  'src/apps/dashboard/DashboardPage.jsx',
  'src/apps/dashboard/tabs/sites/SitesTab.jsx',
  'src/apps/dashboard/tabs/main/MainTab.jsx',
  'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
  'src/apps/dashboard/tabs/schedule/ScheduleTab.jsx',
  'src/apps/dashboard/tabs/schedule/components/ScheduleBlockWorkbench.jsx',
  'src/apps/dashboard/tabs/schedule/components/ScheduleRhythmIdentity.jsx',
  'src/apps/dashboard/tabs/schedule/components/ScheduleRhythmWorkspace.jsx',
  'src/apps/dashboard/tabs/schedule/components/TimelineTrack.jsx',
  'src/apps/dashboard/tabs/tools/components/StorageSupportPanel.jsx',
  'src/apps/dashboard/tabs/main/home/homeBriefViewModel.js',
  'src/apps/dashboard/tabs/main/home/buildHomeScanSnapshot.js',
];

for (const locale of ['en', 'ko']) {
  const localeJson = await readJson(`src/i18n/locales/${locale}/tools.json`);
  for (const key of [...requiredExperimentKeys, ...requiredWorkerRuntimeKeys, ...requiredToolsSurfaceKeys]) {
    const value = getNestedValue(localeJson, key);
    if (typeof value !== 'string' || !value.trim()) {
      failures.push(`src/i18n/locales/${locale}/tools.json is missing "${key}".`);
    }
  }
}

for (const locale of ['en', 'ko']) {
  const localeJson = await readJson(`src/i18n/locales/${locale}/theme.json`);
  for (const key of requiredThemeSurfaceKeys) {
    const value = getNestedValue(localeJson, key);
    if (typeof value !== 'string' || !value.trim()) {
      failures.push(`src/i18n/locales/${locale}/theme.json is missing "${key}".`);
    }
  }
}

for (const locale of ['en', 'ko']) {
  const localeJson = await readJson(`src/i18n/locales/${locale}/main.json`);
  const requiredKeys = new Set(requiredDynamicDashboardTabsKeys);

  for (const filePath of dashboardTabsSourceFiles) {
    const source = await readText(filePath);
    collectTranslationKeys(source).forEach((key) => requiredKeys.add(key));
  }

  for (const key of requiredKeys) {
    const value = getNestedValue(localeJson, key);
    if (typeof value !== 'string' || !value.trim()) {
      failures.push(`src/i18n/locales/${locale}/main.json is missing "${key}".`);
    }
  }
}

for (const locale of ['en', 'ko']) {
  const localeJson = await readJson(`src/i18n/locales/${locale}/dashboard.json`);
  for (const key of requiredDashboardShellKeys) {
    const value = getNestedValue(localeJson, key);
    if (typeof value !== 'string' || !value.trim()) {
      failures.push(`src/i18n/locales/${locale}/dashboard.json is missing "${key}".`);
    }
  }
}

const experimentTab = await readText('src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx');
const experimentHubTab = await readText('src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx');
const experimentLabCatalog = await readText('src/apps/dashboard/tabs/experiment/experimentLabCatalog.js');
if (!experimentHubTab.includes("useAppTranslation('tools')") && !experimentHubTab.includes('useAppTranslation("tools")')) {
  failures.push('ExperimentHubTab.jsx must use the "tools" namespace through useAppTranslation().');
}
if (!experimentTab.includes("useAppTranslation('tools')") && !experimentTab.includes('useAppTranslation("tools")')) {
  failures.push('ExperimentWorkspace.jsx must use the "tools" namespace through useAppTranslation().');
}
if (!experimentLabCatalog.includes('experiment.lab_sections.')) {
  failures.push('experimentLabCatalog.js must own Experiment lab section copy keys.');
}
if (!experimentTab.includes('experiment.artifacts.')) {
  failures.push('ExperimentWorkspace.jsx must resolve artifact labels from tools experiment artifact keys.');
}

const workerRuntimePanel = await readText('src/apps/dashboard/tabs/experiment/WorkerRuntimePanel.jsx');
if (!workerRuntimePanel.includes("useAppTranslation('tools')") && !workerRuntimePanel.includes('useAppTranslation("tools")')) {
  failures.push('WorkerRuntimePanel.jsx must use the "tools" namespace through useAppTranslation().');
}
if (!workerRuntimePanel.includes("tRuntimePanel('title'")) {
  failures.push('WorkerRuntimePanel.jsx must resolve panel copy through tRuntimePanel().');
}

const mainTab = await readText('src/apps/dashboard/tabs/main/MainTab.jsx');
if (!mainTab.includes("useAppTranslation('main')") && !mainTab.includes('useAppTranslation("main")')) {
  failures.push('MainTab.jsx must use the "main" namespace through useAppTranslation().');
}

const toolsTab = await readText('src/apps/dashboard/tabs/tools/ToolsTab.jsx');
if (!toolsTab.includes("useAppTranslation('tools')") && !toolsTab.includes('useAppTranslation("tools")')) {
  failures.push('ToolsTab.jsx must use the "tools" namespace through useAppTranslation().');
}
for (const requiredSnippet of [
  "title={tab.title}",
  "tTools('tools.support_mode'",
  "tTools('tools.open_sites'",
  "tTools('tools.open_settings'",
]) {
  if (!toolsTab.includes(requiredSnippet)) {
    failures.push(`ToolsTab.jsx must include ${requiredSnippet}.`);
  }
}
if (mainTab.includes('main.home_title')) {
  failures.push('MainTab.jsx must not use the legacy main.home_title key.');
}
for (const requiredSnippet of [
  "tDashboard('main.title'",
]) {
  if (!mainTab.includes(requiredSnippet)) {
    failures.push(`MainTab.jsx must include ${requiredSnippet}.`);
  }
}

for (const filePath of [
  'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx',
]) {
  const source = await readText(filePath);
  if (!source.includes("useAppTranslation('main')") && !source.includes('useAppTranslation("main")')) {
    failures.push(`${filePath} must use the "main" namespace through useAppTranslation().`);
  }
}

for (const filePath of noDefaultValueDashboardFiles) {
  const source = await readText(filePath);
  if (source.includes('defaultValue:')) {
    failures.push(`${filePath} must not use defaultValue; dashboard/main/tools governed surfaces must resolve copy from locale JSON only.`);
  }
}

const dashboardPagePath = 'src/apps/dashboard/DashboardPage.jsx';
const dashboardPageSource = await readText(dashboardPagePath);
if (
  dashboardPageSource.includes('main.home_nav')
  || dashboardPageSource.includes('main.home_title')
  || dashboardPageSource.includes('main.home_desc')
) {
  failures.push(`${dashboardPagePath} must use tabs.main.nav/title/desc keys instead of legacy home_* keys.`);
}
if (
  !dashboardPageSource.includes("useAppTranslation('dashboard')")
  && !dashboardPageSource.includes('useAppTranslation("dashboard")')
) {
  failures.push(`${dashboardPagePath} must use the "dashboard" namespace through useAppTranslation().`);
}

const dashboardTabRegistryPath = 'src/apps/dashboard/tabs/registry.js';
const dashboardTabRegistrySource = await readText(dashboardTabRegistryPath);
for (const token of [
  "titleKey: 'main.title'",
  "navKey: 'main.nav'",
  "descriptionKey: 'main.desc'",
  'requireDashboardTabCopyValue',
  'DASHBOARD_TAB_ROUTE_COPY_REQUIRED',
]) {
  if (!dashboardTabRegistrySource.includes(token)) {
    failures.push(`${dashboardTabRegistryPath} must keep canonical localized route-copy token ${token}.`);
  }
}
for (const forbiddenToken of ['tabCopyOverrides', "|| ''"]) {
  if (dashboardTabRegistrySource.includes(forbiddenToken)) {
    failures.push(`${dashboardTabRegistryPath} must not retain route-copy fallback ${forbiddenToken}.`);
  }
}

if (failures.length > 0) {
  console.error('[check-dashboard-i18n-contract] Contract violation detected:');
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}
