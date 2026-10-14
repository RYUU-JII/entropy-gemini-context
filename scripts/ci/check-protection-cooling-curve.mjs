import fs from 'node:fs/promises';
import path from 'node:path';
import { CANONICAL_ARTIFACT_RUNTIME_BINDINGS } from '../../src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js';
import { COOLING_CURVE_FAMILY_IDS, DEFAULT_COOLING_CURVE, requireCoolingCurve } from '../../src/domains/settings/config/coolingCurvePolicy.js';

const failures = [];
async function requireTokens(file, tokens) {
  const source = await fs.readFile(file, 'utf8');
  for (const token of tokens) if (!source.includes(token)) failures.push(`${file}: missing cooling contract ${token}`);
  return source;
}
const curve = await requireTokens('src/domains/protection/runtime/coolingCurveResolver.js', [
  'requireCoolingCurve(coolingCurve)', 'requireCoolingCurveRuntimeState', 'COOLING_CURVE_FEATURE_BINDINGS',
  'Math.floor(', 'COOLING_CURVE_STEPS', 'budgetRatio >= 1', 'controlledFeatureKeys',
]);
if (/\b(setTimeout|setInterval|localStorage|chrome\.storage)\b/u.test(curve)
  || /(?:activeMs|siteDayMs|domainActivityMs)\s*\/|(?:getStats|statsSnapshot|trackingTickRunner)/u.test(curve)) {
  failures.push('Cooling resolver must consume the canonical budget ratio without another clock, ratio or storage owner.');
}
requireCoolingCurve(DEFAULT_COOLING_CURVE);
for (const family of COOLING_CURVE_FAMILY_IDS) {
  for (const [child, binding] of Object.entries(CANONICAL_ARTIFACT_RUNTIME_BINDINGS[family].children)) {
    if (!binding.coolingCurve) failures.push(`Unbound cooling child: ${family}.${child}`);
  }
}
await requireTokens('src/platform/storage/internal/chrome-storage/storageKeyRegistry.js', [
  'coolingCurve: STORAGE_LOCAL_DOC_KEYS.CORE',
]);
await requireTokens('src/domains/settings/config/settingsCommandContract.js', [
  'coolingCurve: createKeyContract', 'storedCanonicalize: requireCoolingCurve', 'applyCoolingCurveCommand',
]);
await requireTokens('src/domains/protection/background/runtime/EnvelopeAdapter.js', [
  'requireCoolingCurvePlan', 'controlledFeatureKeys', 'COOLING_CURVE',
]);
await requireTokens('src/domains/protection/runtime/frictionModifierResolver.js', [
  "COOLING_CURVE: 'cooling_curve'", "SCALE_STRENGTH: 'scale_strength'", 'FRICTION_MODIFIER_OPERATION_TARGET_INVALID',
]);
await requireTokens('src/apps/dashboard/tabs/tools/artifactCards/shared.jsx', [
  "'cooling-curve-mode'", '<CoolingCurveFamilyControl',
]);
await requireTokens('src/apps/dashboard/tabs/settings/sections/SettingsProtectionSection.jsx', [
  'useRuntimeParkedStoreSlice', 'requireCoolingCurve', 'requireNudgeGoalEnds',
  'requireProtocolSyncSuccess', 'state.setCoolingCurvePreset', 'state.setGoalEndEnabled',
]);
const filterUi = await fs.readFile('src/apps/dashboard/tabs/filter/FilterTab.jsx', 'utf8');
if (filterUi.includes('setCoolingCurvePreset')) failures.push('Filter preview must not own a second public curve editor.');
const flareUi = await fs.readFile('src/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js', 'utf8');
if (/setNudgeConfig|handleAutoToggle|applyFlareConfig/u.test(flareUi)) failures.push('Tools Furin must not own another goal-policy writer.');
await requireTokens('src/domains/protection/background/runtime/CoolingCurveStepRefreshCoordinator.js', [
  'includeGateSessions: false', 'lastStepByHost', 'needsRefreshForHost',
  'refreshFrictionBootstrapForHostname', 'injectOpenTabs: false',
]);
await requireTokens('src/domains/tracking/background/trackingTickRunner.js', ['await checkCoolingCurveSteps(mutationNow)']);
await requireTokens('src/domains/protection/protocol/contracts/envelope.js', [
  'PROTECTION_ENVELOPE_VERSION = 2', 'requireCoolingCurveRuntimeState',
]);
await requireTokens('src/domains/protection/background/ProtectionDispatcher.js', [
  'getSettingsChangeVersion', 'COOLING_CURVE_BOOTSTRAP_SETTINGS_SUPERSEDED',
]);
await requireTokens('src/domains/protection/background/runtime/FrictionBootstrapCoordinator.js', [
  'assertCurrent', 'needsRefreshForHost',
]);
await requireTokens('src/apps/boot/bootPrewarmSnapshotContract.js', [
  'BOOT_PREWARM_SCHEMA_VERSION = 2', 'normalizeCoolingCurve(source.coolingCurve)',
]);
const forbiddenContentImports = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:coolingCurveResolver|BudgetSnapshotReader|domains\/tracking|stats\/background)/u;
for (const root of ['src/domains/protection/content', 'src/domains/nudge', 'src/apps/content']) {
  for (const relative of await fs.readdir(root, { recursive: true })) {
    if (!/\.(?:js|jsx|mjs)$/u.test(relative)) continue;
    const file = path.join(root, relative);
    if (forbiddenContentImports.test(await fs.readFile(file, 'utf8'))) failures.push(`${file}: content must not own cooling progress.`);
  }
}
if (failures.length) { console.error('[protection-cooling-curve] FAIL:\n' + failures.join('\n')); process.exitCode = 1; }
else console.log('[protection-cooling-curve] PASS: canonical settings, exhaustive bindings and background-only curve ownership.');
