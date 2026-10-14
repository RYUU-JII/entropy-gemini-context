#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertPattern(relativePath, pattern, message) {
  const source = read(relativePath);
  if (!pattern.test(source)) {
    failures.push(`${relativePath}: ${message}`);
  }
}

function assertNoPattern(relativePath, pattern, message) {
  const source = read(relativePath);
  if (pattern.test(source)) {
    failures.push(`${relativePath}: ${message}`);
  }
}

assertPattern(
  'src/domains/settings/i18n/resourceTranslator.js',
  /\[missing i18n:/,
  'missing translations must return an explicit sentinel label.',
);

assertPattern(
  'src/domains/settings/i18n/runtimeUiLanguage.js',
  /Failed to read runtime extension UI language\./,
  'runtime language resolution failures must emit a diagnosable error.',
);

for (const file of [
  'src/domains/settings/i18n/runtime.js',
  'src/domains/settings/i18n/scheduleRuntime.js',
]) {
  assertPattern(file, /from ['"]\.\/runtimeUiLanguage\.js['"]/,
    'full and Schedule runtime projections must share the named UI language owner.');
  assertPattern(file, /resolveLanguage:\s*resolveRuntimeUiLanguage/,
    'runtime resource translators must use the shared UI language chain.');
  assertNoPattern(file, /getUILanguage|reportedExtensionLanguageReadFailure|function resolveLanguage\(/,
    'runtime projections must not duplicate UI language policy or extension-read diagnostics.');
}

assertNoPattern(
  'src/domains/settings/i18n/runtimeUiLanguage.js',
  /i18n\/(?:resources|scheduleResources|backgroundResources)\.js|\.\/(?:runtime|backgroundRuntime|popupRuntime)\.js/,
  'UI language resolution must remain independent of runtime resource projections.',
);

assertNoPattern(
  'src/domains/settings/i18n/language.js',
  /ChromeService|runtimeUiLanguage|\b(?:document|navigator|globalThis)\b/,
  'shared language normalization must stay pure for the background language owner.',
);

assertPattern(
  'src/domains/settings/i18n/resourceTranslator.js',
  /function translateWithResolvedLanguage\(language, key, options = \{\}\) \{/,
  'internal runtime translation must not expose a fallback copy parameter.',
);

assertPattern(
  'src/domains/settings/i18n/runtime.js',
  /export function tRuntime\(key, options = \{\}\) \{/,
  'tRuntime must expose only key and interpolation options.',
);

assertPattern(
  'src/domains/settings/i18n/runtime.js',
  /export function tRuntimeWithLanguage\(language, key, options = \{\}\) \{/,
  'tRuntimeWithLanguage must expose only language, key, and interpolation options.',
);

assertNoPattern(
  'src/domains/settings/i18n/runtime.js',
  /ignore and continue fallback chain/,
  'silent fallback comments are not allowed in canonical runtime i18n paths.',
);

assertNoPattern(
  'src/i18n/config.js',
  /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/,
  'runtime language persistence must not silently swallow promise failures.',
);

assertNoPattern(
  'src/i18n/config.js',
  /catch\s*\(\s*_\s*\)\s*\{\s*(?:\/\/[^\n]*)?\s*\}/,
  'runtime language setup must not silently swallow synchronous failures.',
);

assertPattern(
  'src/apps/popup/main.jsx',
  /import\('\.\.\/\.\.\/i18n\/popupConfig\.js'\)/,
  'Popup boot must admit the narrow Popup i18n initialization profile before React mount.',
);

assertPattern(
  'src/apps/popup/main.jsx',
  /from '\.\.\/\.\.\/domains\/settings\/i18n\/popupRuntime\.js';/,
  'Popup boot copy must use the narrow Popup runtime resource projection.',
);

assertNoPattern(
  'src/apps/popup/main.jsx',
  /(?:i18n\/config|settings\/i18n\/runtime)\.js|^import ['"]\.\.\/\.\.\/i18n\/popupConfig\.js['"];?$/m,
  'Popup boot must not pull the full locale/runtime resource graph into its static closure.',
);

assertNoPattern(
  'src/i18n/popupResources.js',
  /locales\/(?:en|ko)\/(?:dashboard|filter|sites|main|settings|tools|theme|schedule)\.js/,
  'Popup resources must remain a common-only locale projection.',
);

assertNoPattern(
  'src/i18n/popupConfig.js',
  /i18next-browser-languagedetector/,
  'Popup startup must not evaluate the DOM/cookie language detector.',
);

assertPattern(
  'src/i18n/popupConfig.js',
  /runtimeLanguageStore\.get\(fallbackLanguage\)/,
  'Popup startup must hydrate language from the canonical typed settings store.',
);

assertPattern(
  'src/domains/settings/i18n/popupRuntime.js',
  /export function tRuntime\(key, options = \{\}\) \{/,
  'Popup runtime must preserve the canonical tRuntime call shape.',
);

assertNoPattern(
  'src/i18n/dashboardConfig.js',
  /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/,
  'dashboard runtime language persistence must not silently swallow promise failures.',
);

assertNoPattern(
  'src/i18n/dashboardConfig.js',
  /i18next-browser-languagedetector/,
  'dashboard startup must not evaluate the DOM/cookie language detector before first render.',
);

assertPattern(
  'src/i18n/dashboardConfig.js',
  /runtimeLanguageStore\.get\(fallbackLanguage\)/,
  'dashboard startup must hydrate language from the canonical typed settings store.',
);

for (const file of ['src/i18n/config.js', 'src/i18n/dashboardConfig.js', 'src/i18n/popupConfig.js']) {
  assertNoPattern(file, /runtimeLanguageStore\.set\s*\(/,
    'i18n bootstrap and language projection must not write canonical settings from a UI context.');
}
assertNoPattern(
  'src/platform/storage/internal/chrome-storage/stores/RuntimeLanguageStore.js',
  /settingsStore\.set\s*\(/,
  'RuntimeLanguageStore is a read/subscription projection; language mutation belongs to the background settings command lane.',
);
assertPattern(
  'src/domains/settings/config/settingsCommandContract.js',
  /app_language:\s*createKeyContract\(\{\s*channel:\s*SETTINGS_COMMAND_CHANNELS\.PREFERENCE,/,
  'Dashboard language intent must use the generation-bound preference command channel.',
);

assertPattern(
  'src/i18n/dashboardResources.js',
  /import\('\.\/dashboardDeferredResources\.js'\)/,
  'dashboard deferred namespaces must remain outside the bootstrap resource graph.',
);

assertPattern(
  'src/apps/dashboard/loading/preloadDashboardTab.js',
  /preloadDashboardTabI18nResources\(tabId\)/,
  'dashboard tab module readiness must include its i18n resource projection.',
);

assertNoPattern(
  'src/i18n/dashboardResources.js',
  /locales\/(?:en|ko)\/tools\.js/,
  'Tools dictionaries must stay outside the Dashboard bootstrap projection.',
);

assertPattern(
  'src/i18n/dashboardDeferredResources.js',
  /import\('\.\/locales\/en\/tools\.js'\)/,
  'deferred Dashboard resources must own the Tools dictionary through an async namespace loader.',
);

assertNoPattern(
  'src/i18n/dashboardDeferredResources.js',
  /import\s+[^;]+\s+from\s+['"]\.\/locales\//,
  'the deferred namespace catalog must not statically admit every deferred dictionary.',
);

assertPattern(
  'src/i18n/dashboardResources.js',
  /DASHBOARD_I18N_TAB_NOT_DECLARED/,
  'unknown Dashboard tab IDs must reject instead of admitting a blanket namespace set.',
);

assertPattern(
  'src/domains/settings/i18n/scheduleRuntime.js',
  /createRuntimeResourceTranslator/,
  'Schedule runtime copy must preserve the shared translator semantics.',
);

for (const file of [
  'src/apps/dashboard/tabs/schedule/constants.js',
  'src/apps/dashboard/tabs/schedule/utils.js',
]) {
  assertPattern(file, /settings\/i18n\/scheduleRuntime\.js/,
    'Schedule helpers must use the named narrow runtime resource projection.');
  assertNoPattern(file, /settings\/i18n\/runtime\.js/,
    'Schedule helpers must not admit the full UI runtime dictionaries.');
}

assertNoPattern(
  'src/domains/settings/i18n/scheduleRuntime.js',
  /(?:i18n\/resources\.js|\.\/runtime\.js)/,
  'the Schedule runtime projection must stay independent of the full resource assembly.',
);

assertNoPattern(
  'src/i18n/scheduleResources.js',
  /locales\/(?:en|ko)\/(?!common\.js|schedule\.js)[^'"]+\.js/,
  'Schedule runtime resources may admit only Common and Schedule dictionaries.',
);

assertPattern(
  'src/apps/dashboard/layout/DashboardLayout.jsx',
  /bootShellDismissed[\s\S]*<DashboardDevelopmentHud/u,
  'development HUD resources must be admitted only after the boot shell is dismissed.',
);

assertNoPattern(
  'src/platform/storage/internal/chrome-storage/stores/RuntimeLanguageStore.js',
  /catch\s*\(\s*error\s*\)\s*=>\s*\{\s*console\.error\([^)]*\);\s*listener\(/s,
  'emitCurrent must not mask storage read failures by pushing fallback values.',
);

assertNoPattern(
  'src/domains/notifications/background/notificationCatalog.js',
  /\bdefaultTitle\s*:/,
  'notification descriptors must not keep fallback title copy beside locale keys.',
);

assertNoPattern(
  'src/domains/notifications/background/notificationCatalog.js',
  /\bdefaultMessage\s*:/,
  'notification descriptors must not keep fallback message copy beside locale keys.',
);

if (failures.length > 0) {
  console.error('[i18n-robustness] Contract violation detected:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[i18n-robustness] PASS: canonical i18n paths fail loudly and avoid silent fallback regressions.');
