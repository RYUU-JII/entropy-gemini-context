#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

// Narrow pre-release contract guard. Explicit user reset, current input
// normalization and scientific evidence projection are intentionally outside
// these retired persisted-format chains. The named, explicit current vault
// credential separation is checked below. A released migration needs its ADR,
// release fixtures and an intentional update to this decision together.
const rules = [
  ['src/platform/storage/internal/chrome-storage/stores/SettingsStore.js', /initializeNotificationJourney|#initializationPromise|migrateNotificationsConfigV1/u],
  ['src/domains/settings/config/notificationsConfig.js', /migrateNotificationsConfigV1/u],
  ['src/platform/storage/internal/chrome-storage/stores/ProgressionStateStore.js', /migrateProgressionState/u],
  ['src/domains/progression/model/progressionSnapshot.js', /migrateProgressionState|migrateArtifactDisclosureState/u],
  ['src/domains/progression/policy/artifactDisclosurePolicy.js', /legacyGrandfatheringPending|releaseContinuityPending|registrationContinuityLimit|completeArtifactDisclosureLegacyGrandfathering|migrateArtifactDisclosureState/u],
  ['src/domains/progression/policy/progressionJourneyPolicy.js', /continuityLimit/u],
  ['src/apps/background/services/runtime/artifactDisclosureBootstrap.js', /legacyGrandfather|historicalCalendar|resolveLegacy|resolveReleaseContinuity/u],
  ['src/domains/progression/debug/ProgressionUnlockDebugRepository.js', /migrateStoredV[12]Projection|LEGACY_PROGRESSION_UNLOCK_DEBUG_CONTRACT/u],
  ['src/themes/plugins/zen/model/NeuralZen.js', /LEGACY_MODEL_VERSIONS|didMigrateState|migrationReason/u],
  ['src/themes/plugins/zen/model/SakuraAdditivePairwiseGPModel.js', /migrationMarker|resolveMigrationReasons|completeHistoryReplayMigration|didMigrateState/u],
  ['src/platform/storage/themes/zen/ZenThemeModelStateContract.js', /migrationMarker|validateSakuraAbHistoryMigration|SAKURA_AB_HISTORY_ENTRY_KEYS_V1/u],
  ['src/themes/plugins/zen/runtime/classic/useZenLearningLab.js', /migrateSakuraV1|SAKURA_V1_AB_HISTORY_VERSION|didMigrate|completeHistoryReplayMigration|replaySakuraV2AbHistoryIntoPairwise|legacyContract/u],
  ['src/platform/storage/model/FeedTempoProfileCheckpointRepository.js', /readFeedTempoCheckpointSchemaVersion|FEED_TEMPO_PROFILE_CHECKPOINT_DISCARD_REASONS/u],
  ['src/platform/storage/internal/storageSnapshotService.js', /initializeLegacyProgression|migrateProgressionState|migrateNotificationsConfigV1/u],
  ['src/domains/nudge/runtime/session/furinDailyPolicy.js', /initializeFurinDailyReceipt|session_shown_transition|session-transition:/u],
  ['src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js', /initializeFurinDailyReceipt/u],
  ['src/platform/storage/nudge/furinDailyReceiptContract.js', /session_shown_transition/u],
];

const failures = [];
const nudgeConfigPath = 'src/domains/settings/config/nudgeConfig.js';
const nudgeConfig = await fs.readFile(path.resolve(nudgeConfigPath), 'utf8');
for (const required of [
  'goalEnds: Object.freeze({ site: false, global: false })',
  "Object.hasOwn(canonicalSource, 'enabled')) throw new Error('NUDGE_CONFIG_RETIRED_FIELD:enabled')",
  "Object.keys(value).sort().join('|') !== 'global|site'",
  "typeof value.site !== 'boolean' || typeof value.global !== 'boolean'",
  'requireNudgeGoalEnds(current?.goalEnds)',
  'goalEnds: { ...canonical.goalEnds, [value.scope]: value.enabled }',
]) {
  if (!nudgeConfig.includes(required)) failures.push(`${nudgeConfigPath}: missing current-only goal-end preference contract ${required}`);
}
if (/canonicalSource\.enabled|source\.enabled|migrate.*GoalEnd|initialize.*GoalEndFromEnabled/u.test(nudgeConfig)) {
  failures.push(`${nudgeConfigPath}: stored master-to-scope conversion is forbidden; incompatible presence must remain untouched.`);
}
const settingsCommandContract = await fs.readFile(path.resolve('src/domains/settings/config/settingsCommandContract.js'), 'utf8');
if (!settingsCommandContract.includes('canonicalize: (value, cache) => applyNudgeConfigCommand(value, cache.nudgeConfig)')) {
  failures.push('Goal-end scope commands must project against the latest serialized canonical settings cache.');
}
await Promise.all(rules.map(async ([file, retiredPattern]) => {
  const source = await fs.readFile(path.resolve(file), 'utf8');
  if (retiredPattern.test(source)) failures.push(`${file}: retired persisted-format chain ${retiredPattern}`);
}));
const policyPath = 'docs/architecture/storage/storage-versioning-and-migration-policy.md';
const policy = await fs.readFile(path.resolve(policyPath), 'utf8');
for (const required of ['- Status: Active', '- Path policy: current-only', '## Release 1 gate',
  '## Public-release transition decision', '## Atomic and resumable transition protocol',
  '## Downgrade, import and lifecycle rules', '## Expiration and removal']) {
  if (!policy.includes(required)) failures.push(`${policyPath}: missing decision section ${required}`);
}
const furinContractPath = 'src/platform/storage/nudge/furinDailyReceiptContract.js';
const furinContract = await fs.readFile(path.resolve(furinContractPath), 'utf8');
for (const required of ['FURIN_DAILY_RECEIPT_VERSION = 2',
  "['version', 'dateStr', 'fullSite', 'global', 'sites', 'siteEnds']",
  'FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED', "value.source === 'actual_presentation'",
  'FURIN_DAILY_SITE_END_MISMATCH', 'FURIN_DAILY_COMBINED_RECEIPT_MISMATCH']) {
  if (!furinContract.includes(required)) failures.push(`${furinContractPath}: missing exact V2 evidence contract ${required}`);
}
if (!policy.includes('FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:1') || !policy.includes('siteEnds')) {
  failures.push('Furin daily V2 cutover must document incompatible V1 preservation and explicit profile reset.');
}
const vaultRepository = await fs.readFile(path.resolve('src/platform/storage/security/KeyMaterialRepository.js'), 'utf8');
const vaultRoutes = await fs.readFile(path.resolve('src/apps/background/services/runtime/messageRoutes/securityVaultMessageRoutes.js'), 'utf8');
const vaultBootstrap = await fs.readFile(path.resolve('src/apps/background/services/runtime/BackgroundBootstrapCoordinator.js'), 'utf8');
if (!policy.includes('SEPARATE_SECURITY_VAULT_PROTECTION_KEYS')
  || !policy.includes('first release compatibility review')
  || !vaultRepository.includes('separateVaultProtectionKeys({ passphrase }')
  || !vaultRoutes.includes('SEPARATE_SECURITY_VAULT_PROTECTION_KEYS')
  || /separateVaultProtectionKeys\s*\(/u.test(vaultBootstrap)) {
  failures.push('Security credential separation must remain an explicitly authorized, documented owner; never startup conversion.');
}
if (failures.length > 0) {
  console.error(`Storage versioning policy failed:\n${failures.sort().join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Storage versioning policy passed (${rules.length} current-only boundaries).`);
}
