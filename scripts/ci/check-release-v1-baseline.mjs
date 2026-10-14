#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const violations = [];

const ENTROPY_RELEASE_VERSION_BASELINE_EXCEPTIONS = Object.freeze({
  'src/domains/protection/protocol/contracts/envelope.js': Object.freeze({
    PROTECTION_ENVELOPE_VERSION: 2,
  }),
  'src/apps/boot/bootPrewarmSnapshotContract.js': Object.freeze({
    BOOT_PREWARM_SCHEMA_VERSION: 2,
  }),
  'src/platform/storage/model/FeedTempoProfileCheckpointContract.js': Object.freeze({
    FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION: 2,
  }),
});

const fail = (message) => {
  violations.push(message);
};

const read = async (relativePath) => fs.readFile(path.resolve(rootDir, relativePath), 'utf8');

const pathExists = async (relativePath) => {
  try {
    await fs.access(path.resolve(rootDir, relativePath));
    return true;
  } catch (_error) {
    return false;
  }
};

const collectSourceFiles = async (directory) => {
  const entries = await fs.readdir(path.resolve(rootDir, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(relativePath));
      continue;
    }
    if (/\.(?:js|jsx|mjs)$/u.test(entry.name)) files.push(relativePath);
  }
  return files;
};

const isExtensionReleaseV1Source = (relativePath) => (
  !relativePath.startsWith('src/apps/landing/')
  && relativePath !== 'src/themes/plugins/zen/api/landing.js'
  && !relativePath.startsWith('src/themes/plugins/zen/presentation/landing/')
);

const requirePattern = (source, pattern, message) => {
  if (!pattern.test(source)) fail(message);
};

const forbidPattern = (source, pattern, message) => {
  if (pattern.test(source)) fail(message);
};

async function checkExternalStandardsAndPersistenceBaseline() {
  const [manifest, dbConstants, dbSchema, dbManager, dbImportSnapshot, passcode] = await Promise.all([
    read('src/manifest.json').then(JSON.parse),
    read('src/platform/storage/internal/indexeddb/dbConstants.js'),
    read('src/platform/storage/internal/indexeddb/dbSchema.js'),
    read('src/platform/storage/internal/indexeddb/dbManager.js'),
    read('src/platform/storage/internal/indexeddb/dbImportSnapshot.js'),
    read('src/platform/security/passcode.js'),
  ]);

  if (manifest.manifest_version !== 3) {
    fail(`src/manifest.json: external Chrome Manifest version must remain 3, got ${manifest.manifest_version}.`);
  }
  requirePattern(
    dbConstants,
    /export const DB_VERSION = 1;/u,
    'dbConstants.js: EntropyDB must be the release V1 database.',
  );
  requirePattern(
    dbConstants,
    /export const DB_EXPORT_FORMAT_VERSION = 1;/u,
    'dbConstants.js: IndexedDB export/import must accept release format V1 only.',
  );
  requirePattern(
    dbConstants,
    /export const ENC_ALGO = 'AES-GCM';/u,
    'dbConstants.js: the external AES-GCM algorithm identifier must remain unchanged.',
  );
  requirePattern(
    dbSchema,
    /export function applyIndexedDbV1Schema\(\{ db \}\)/u,
    'dbSchema.js: fresh schema creation must route through applyIndexedDbV1Schema({ db }).',
  );
  forbidPattern(
    dbSchema,
    /oldVersion|openCursor|migrat|sourceVersion|targetVersion/iu,
    'dbSchema.js: release V1 must not contain upgrade-version branches or record migrators.',
  );
  requirePattern(
    dbManager,
    /applyIndexedDbV1Schema\(\{ db: req\.result \}\)/u,
    'dbManager.js: onupgradeneeded must create the complete fresh V1 schema directly.',
  );
  forbidPattern(
    dbManager,
    /oldVersion\s*:/u,
    'dbManager.js: oldVersion must not be forwarded into a runtime upgrade path.',
  );
  forbidPattern(
    dbImportSnapshot,
    /migrateStatsHourlyBucketCursorCheckpoint|normalizeZenClosedDayRecapSnapshotForImport/u,
    'dbImportSnapshot.js: import must validate exact V1 rows without predecessor normalizers.',
  );
  requirePattern(
    passcode,
    /const PASSCODE_HASH_VERSION = 'v1';/u,
    'passcode.js: the Entropy-owned PBKDF2 envelope must be release V1.',
  );
  requirePattern(
    passcode,
    /const PASSCODE_KDF_ALGO = 'pbkdf2-sha256';/u,
    'passcode.js: the external PBKDF2/SHA-256 algorithm identifier must remain unchanged.',
  );

  const sourceFiles = (await collectSourceFiles('src')).filter(isExtensionReleaseV1Source);
  const entropyVersionDeclaration = /\b([A-Z][A-Z0-9_]*(?:SCHEMA|CONTRACT|POLICY|FORMAT|CACHE|PROTOCOL|ENVELOPE)_VERSION)\s*=\s*(\d+)\b/gu;
  const observedVersionBaselineExceptions = new Set();
  for (const relativePath of sourceFiles) {
    const source = await read(relativePath);
    for (const match of source.matchAll(entropyVersionDeclaration)) {
      const declarationName = match[1];
      const expectedVersion = (
        ENTROPY_RELEASE_VERSION_BASELINE_EXCEPTIONS[relativePath]?.[declarationName]
        ?? 1
      );
      if (expectedVersion !== 1) {
        observedVersionBaselineExceptions.add(`${relativePath}:${declarationName}`);
      }
      if (Number(match[2]) !== expectedVersion) {
        fail(`${relativePath}: Entropy-owned ${declarationName} must remain on release baseline V${expectedVersion}.`);
      }
    }
  }
  for (const [relativePath, declarations] of Object.entries(
    ENTROPY_RELEASE_VERSION_BASELINE_EXCEPTIONS,
  )) {
    for (const declarationName of Object.keys(declarations)) {
      const identity = `${relativePath}:${declarationName}`;
      if (!observedVersionBaselineExceptions.has(identity)) {
        fail(`${relativePath}: declared release-version exception ${declarationName} is stale or missing.`);
      }
    }
  }
}

async function checkRemovedCompatibilityEntrypoints() {
  const forbiddenPaths = [
    'src/apps/background/services/settingsCacheMigration.js',
    'src/domains/settings/config/filterSettingsEnsoSplitMigration.js',
    'src/domains/settings/config/artifactVisualSettingsTransition.js',
    'src/domains/settings/config/ensoIntervalSettingsTransition.js',
    'tests/artifactVisualSettingsTransition.test.js',
    'src/domains/settings/migrations/deprecatedDevClockSettingsMigration.js',
    'src/themes/plugins/zen/state/ZenRetiredPageLocalCleanup.js',
    'src/platform/storage/themes/zen/ZenRetiredPageLocalCleanup.js',
    'tests/dbSchemaStatsHourlyMigration.test.js',
    'tests/deprecatedDevClockSettingsMigration.test.js',
    'tests/settingsCacheMigration.test.js',
    'tests/zenRetiredPageLocalCleanup.test.js',
    'src/themes/plugins/zen/presentation/ZenEnsoCanvasV52.js',
    'docs/decisions/security/all-urls-security-justification.md',
    'src/platform/storage/internal/indexeddb/stores/ZenClosedDayRecapSnapshotStore.js',
    'src/platform/storage/themes/zen/ZenClosedDayRecapSnapshotContract.js',
    'src/platform/storage/themes/zen/ZenClosedDayRecapSnapshotRepository.js',
    'src/platform/storage/internal/chrome-storage/stores/ZenMainPresentationLedgerStore.js',
    'src/platform/storage/themes/zen/ZenMainPresentationLedgerContract.js',
    'src/platform/storage/themes/zen/ZenMainPresentationLedgerRepository.js',
    'src/domains/stats/background/query/zenClosedDayRecapSnapshotReadModel.js',
    'src/domains/stats/background/query/zenClosedDayRecapSnapshotQueryService.js',
    'src/domains/tracking/background/trackingMessageHandlers/zenPresentationActionHandlers.js',
    'src/apps/background/services/runtime/backgroundKernelActionPresentationBindings.js',
    'docs/product/backlog/schedule-production-prd.md',
    'docs/product/dashboard/permission-and-personalization-release-plan.md',
    'docs/product/dashboard/artifacts-and-protocol-restructure-plan.md',
    'docs/product/dashboard/artifact-six-axis-implementation-plan.md',
  ];

  for (const relativePath of forbiddenPaths) {
    if (await pathExists(relativePath)) {
      fail(`${relativePath}: pre-release migration, cleanup, or predecessor-named entrypoint must not exist in the release V1 tree.`);
    }
  }

  const scopedFiles = [
    'src/apps/background/services/SettingsService.js',
    'src/apps/background/services/settingsCanonicalPatch.js',
    'src/apps/background/services/settingsCacheState.js',
    'src/domains/tracking/background/trackingServiceBootstrap.js',
    'src/platform/storage/internal/chrome-storage/stores/RuntimeLanguageStore.js',
    'src/platform/storage/internal/chrome-storage/stores/ClseSettingsStore.js',
    'src/platform/storage/internal/chrome-storage/stores/KeyStore.js',
    'src/domains/tracking/background/BookmarkConcealManager.js',
  ];
  for (const relativePath of scopedFiles) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /migrateLegacy|settingsCacheMigration|clearLegacyBackups|BOOKMARK_LEGACY_BACKUP_REPOSITORY_REQUIRED/u,
      `${relativePath}: active release V1 runtime must not own predecessor migration or cleanup behavior.`,
    );
  }

  for (const relativePath of [
    'src/apps/dashboard/hooks/artifactSettings/useBarrierArtifactSettingsFamily.js',
    'src/apps/dashboard/tabs/tools/artifactCards/shared.jsx',
    'src/apps/dashboard/tabs/tools/artifactCards/buildBarrierCard.jsx',
  ]) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /\bdistancePx\b|\bviewportRatio\b/u,
      `${relativePath}: scroll-flow artifact state must use the canonical distanceThresholdPx and wheelViewportRatio fields directly.`,
    );
  }

  const sourceFiles = (await collectSourceFiles('src')).filter(isExtensionReleaseV1Source);
  for (const relativePath of sourceFiles) {
    const source = await read(relativePath);
    forbidPattern(source,
      /transitionArtifactVisualSettings|transitionEnsoIntervalSettings|migrateLegacyClickDelayEnsoSplitFilterSettings|migrateSettingsSchema|migrateFilterSettingsSchema|retireSessionAmnesiaSettings/u,
      `${relativePath}: settings reads and hydration must not convert or erase predecessor settings; incompatible development profiles require an explicit reset.`);
    forbidPattern(
      source,
      /\bisSystemActive\b/u,
      `${relativePath}: artifact runtime activity must use only the canonical isRuntimeActive field.`,
    );
    forbidPattern(
      source,
      /globalMaxFilterOnCapExceeded|globalOverflowPolicy|GLOBAL_OVERFLOW_POLICIES|DEFAULT_GLOBAL_OVERFLOW_POLICY|normalizeGlobalOverflowPolicy|resolveGlobalOverflowPolicy|setGlobalBudgetPolicy/u,
      `${relativePath}: global-cap reinforcement is fixed and must not return as a persisted or selectable policy.`,
    );
    forbidPattern(
      source,
      /daily_recap|MAIN_PRESENTATION_RECAP_EVENT_POLICY|MAIN_PRESENTATION_LEDGER_STATES|ZenClosedDayRecap|ZEN_CLOSED_DAY_RECAP|zen_closed_day_recap|ZenMainPresentationLedger|zen\.main_presentation_ledger|closedDayRecap|dailyRecapLedger|recapEventsEnabled|CLOSED_RHYTHM_DAY|CLOSED_DAY_PROJECTION|CLOSED_DAY_BIOTIC_PROFILE|closed_rhythm_day|closed_day_projection|closed_day_summary/u,
      `${relativePath}: release V1 main presentation admits current/first_vision only and must not restore the retired recap snapshot/ledger lane.`,
    );
    forbidPattern(
      source,
      /siteAccessUpgradePromptDismissedAtCount/u,
      `${relativePath}: the removed site-access upgrade prompt dismissal field must not return to release V1 runtime state.`,
    );
    forbidPattern(
      source,
      /EXPLICIT_IDENTITY_CUTOVER|EPHEMERAL_PREVIEW_IDENTITY_CUTOVER|explicit_identity_cutover|ephemeral_preview_identity_cutover|cutoverFromTreeFingerprint|cutoverFromTreeIdentityFingerprint|cutoverFromIdentityRevision|cutoverFromStateRevision|IDENTITY_CUTOVER_REQUIRED/u,
      `${relativePath}: Classic2 current-tree identity changes must use release V1 rotation terminology, not predecessor cutover names.`,
    );
  }

  for (const relativePath of [
    'src/themes/plugins/zen/bonsai/README.md',
    'docs/architecture/repository/main-tab-home-surface-boundary-map.md',
    'docs/architecture/storage/storage-architecture-target.md',
    'docs/architecture/themes/zen/zen-bonsai-vitality-growth-spec.md',
  ]) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /identity[- ]cutover|cross-context cutover|stale\/equal identity cutover|explicit fresh cutover|cutover resolver|Cutover provenance/iu,
      `${relativePath}: Active Classic2 documentation must describe current-tree identity rotation, not a predecessor cutover.`,
    );
  }
}

async function checkScheduleSingleTruthContract() {
  const sourceFiles = await collectSourceFiles('src');
  for (const relativePath of sourceFiles) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /relaxationScheduleEnabled|hardBlockScheduleEnabled|\bisHardBlockActive\b/u,
      `${relativePath}: configured schedule activity must derive from relaxationSchedule.blocks and must not restore an independent enabled flag.`,
    );
  }

  const [storageKeyRegistry, protocolStoreHelpers, scheduleBoundaryDoc, scopeResolver, inputAssembler, scheduleRuntimeOwner] = await Promise.all([
    read('src/platform/storage/internal/chrome-storage/storageKeyRegistry.js'),
    read('src/apps/dashboard/stores/protocolStoreHelpers.js'),
    read('docs/architecture/repository/sites-schedule-boundary-map.md'),
    read('src/domains/protection/background/protocol/engine/ProtectionScopeResolver.js'),
    read('src/domains/protection/background/ProtectionRuntimeInputAssembler.js'),
    read('src/domains/schedule/background/scheduleRuntimeCoordinator.js'),
  ]);
  requirePattern(
    storageKeyRegistry,
    /relaxationSchedule:\s*STORAGE_LOCAL_DOC_KEYS\.CORE/u,
    'storageKeyRegistry.js: relaxationSchedule must remain the single persisted schedule key.',
  );
  forbidPattern(
    protocolStoreHelpers,
    /['"]scheduleActive['"]|scheduleActive\s*:/u,
    'protocolStoreHelpers.js: dashboard schedule input must not carry an independently validated scheduleActive field.',
  );
  requirePattern(
    scheduleBoundaryDoc,
    /Configured activity is[\s\S]{0,220}blocks[\s\S]{0,220}There is no persisted\/cache\/runtime enabled flag/iu,
    'sites-schedule-boundary-map.md: the schedule single-truth contract must remain explicit.',
  );
  requirePattern(scopeResolver, /resolveScheduleRuntimePolicy/u, 'Scope must consume the shared temporal policy.');
  requirePattern(inputAssembler, /scope\.temporalPolicy\.mode === 'relaxation'/u, 'Filter attenuation must consume scope temporal policy.');
  forbidPattern(inputAssembler, /isRelaxationScheduleActive/u, 'Input assembler must not compute a second schedule clock.');
  requirePattern(scheduleRuntimeOwner, /requireApplyResult[\s\S]{0,350}SCHEDULE_STATE/u, 'Schedule receipts must follow successful protection application.');
  forbidPattern(scheduleRuntimeOwner, /alreadyApplied/u, 'Schedule cannot assert application using an unrelated broadcast receipt.');

}

async function checkSettingsTransportRelayContract() {
  const relativePath = 'src/platform/storage/internal/chrome-storage/settingsTransport.js';
  const source = await read(relativePath);
  const readStart = source.indexOf('  async function readSettingsSnapshot(defaults = {}) {');
  const readEnd = source.indexOf('\n  async function applySettingsPatchViaRuntime(', readStart);
  if (readStart < 0 || readEnd < 0) {
    fail(`${relativePath}: release V1 settings snapshot transport owner could not be identified.`);
    return;
  }

  const readSource = source.slice(readStart, readEnd);
  forbidPattern(
    readSource,
    /readSettingsSnapshotDirect|Settings runtime relay unavailable|falling back to direct scoped read/iu,
    `${relativePath}: removed relay-to-persistence read-through helper or diagnostics must not return.`,
  );
  requirePattern(
    readSource,
    /if \(!isExtensionOriginFn\(\)\) \{/u,
    `${relativePath}: non-extension settings reads must enter the runtime relay-only branch.`,
  );

  const relayStart = readSource.indexOf('    if (!isExtensionOriginFn()) {');
  const extensionReadMarker = '\n    try {\n      if (!requestedKeys.length) return {};';
  const relayEnd = readSource.indexOf(extensionReadMarker, relayStart);
  if (relayStart < 0 || relayEnd < 0) {
    fail(`${relativePath}: relay-only and extension-origin persistence branches must remain explicit.`);
    return;
  }

  const relayBranch = readSource.slice(relayStart, relayEnd);
  forbidPattern(
    relayBranch,
    /settingsPersistence|readSettingsSnapshotDirect/u,
    `${relativePath}: non-extension relay failures must not read settings persistence directly.`,
  );
  for (const token of [
    'if (!hasChromeRuntimeFn())',
    'runtimeSendMessageFn({',
    'response && response.success === false',
    'SETTINGS_TRANSPORT_READ_ERROR_CODES.RELAY_REJECTED',
  ]) {
    if (!relayBranch.includes(token)) {
      fail(`${relativePath}: non-extension settings relay must preserve fail-loud token ${token}.`);
    }
  }
  const relayReturns = [...relayBranch.matchAll(/\breturn\s+([^;]+);/gu)]
    .map((match) => match[1].trim());
  if (JSON.stringify(relayReturns) !== JSON.stringify(['response.settings'])) {
    fail(`${relativePath}: non-extension settings relay may return only a validated relay response, got ${JSON.stringify(relayReturns)}.`);
  }
}

async function checkGlobalCapReinforcementContract() {
  const source = await read('src/domains/protection/domain/protectionRuntimeDecision.js');
  requirePattern(
    source,
    /const isOverflowReinforce = normalizedCapState\.exceeded;/u,
    'protectionRuntimeDecision.js: every exceeded global cap must select reinforcement without a persisted policy input.',
  );
  requirePattern(
    source,
    /posture: elevateOverflowPosture\(profile\?\.posture\)/u,
    'protectionRuntimeDecision.js: global-cap reinforcement must elevate the effective posture through the canonical level-step owner.',
  );
}

async function checkProtectionCurrentOnlyContract() {
  const [contracts, artifactBindings, policyPayload, popupContract] = await Promise.all([
    read('src/domains/protection/contracts/protectionContracts.js'),
    read('src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js'),
    read('src/domains/protection/background/protocol/dispatch/ProtectionDispatchPolicyPayload.js'),
    read('src/domains/tracking/popup/contracts/popupSiteSnapshot.js'),
  ]);

  requirePattern(
    contracts,
    /INTERVENTION_PLAN_STATE_KEYS = new Set\(\['level', 'reasons'\]\)/u,
    'protectionContracts.js: release V1 plan state must expose exactly level and reasons.',
  );
  requirePattern(
    contracts,
    /ARTIFACT_PREFERENCE_KEYS = new Set\(\['enabled', 'autoTrigger'\]\)/u,
    'protectionContracts.js: release V1 artifact preferences must expose exactly enabled and autoTrigger.',
  );
  requirePattern(
    artifactBindings,
    /CANONICAL_ARTIFACT_PREFERENCE_FIELD_INVALID/u,
    'canonicalArtifactRuntimeBinding.js: unknown artifact preference fields must fail loudly.',
  );
  requirePattern(
    policyPayload,
    /hardBlockWindow: false/u,
    'ProtectionDispatchPolicyPayload.js: the current schedule hard-block window decision must remain explicit.',
  );
  requirePattern(
    policyPayload,
    /PROTECTION_POLICY_PAYLOAD_KEYS/u,
    'ProtectionDispatchPolicyPayload.js: release V1 wire policy must reject unknown fields.',
  );
  requirePattern(
    popupContract,
    /POPUP_PROTECTION_KEYS = new Set\(\[[\s\S]*'standbyArtifacts',[\s\S]*\]\)/u,
    'popupSiteSnapshot.js: popup protection diagnostics must use the current exact field set.',
  );

  const sourceFiles = await collectSourceFiles('src');
  for (const relativePath of sourceFiles) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /hardLock(?:Allowed|Source|Stage|Enabled|Active)?/u,
      `${relativePath}: retired hard-lock DTO, preference, or telemetry fields must not return to active source.`,
    );
    forbidPattern(
      source,
      /hard_lock(?:_title|_hint|_desc|_sources|_stages)?/u,
      `${relativePath}: dead hard-lock translation identities must not return to active source.`,
    );
  }
}

async function checkMainPresentationSceneContract() {
  const [sharedContract, decision, projection] = await Promise.all([
    read('src/themes/core/presentation/mainSceneContract.js'),
    read('src/apps/dashboard/presentation/mainPresentationDecision.js'),
    read('src/themes/plugins/zen/presentation/main/zenMainSceneProjection.js'),
  ]);
  requirePattern(
    sharedContract,
    /MAIN_PRESENTATION_SCENE_KINDS\s*=\s*freeze\(\{\s*CURRENT:\s*'current',\s*FIRST_VISION:\s*'first_vision',\s*\}\)/u,
    'mainSceneContract.js: release V1 must expose exactly current and first_vision scenes.',
  );
  requirePattern(
    decision,
    /themes\/core\/presentation\/mainSceneContract\.js/u,
    'mainPresentationDecision.js: release V1 must consume the shared main-scene contract.',
  );
  requirePattern(
    projection,
    /ZEN_MAIN_SCENE_KINDS\s*=\s*MAIN_PRESENTATION_SCENE_KINDS/u,
    'zenMainSceneProjection.js: release V1 must project the shared current and first_vision scene set.',
  );
}

async function checkEntropyOwnedV1Signatures() {
  const contracts = [
    {
      file: 'src/themes/plugins/zen/pond/renderers/pixi/entitySync/pixiSceneTextureCache.js',
        // Cache invalidation revisions are independent of the product release.
        required: /const TEXTURE_SIGNATURE_VERSION = 'v2';/u,
        message: 'Pixi scene textures must use the current cache signature revision.',
    },
    {
      file: 'src/themes/plugins/zen/model/ZenCoreConfigAssetCache.js',
      required: /export const ZEN_ASSET_CACHE_VERSION = 'zen_sakura_sprites_v1';/u,
      message: 'Zen sprite assets must use the release V1 cache signature.',
    },
    {
      file: 'src/themes/plugins/zen/model/v2/SakuraSobolColdStartCache.js',
      required: /export const SOBOL_COLD_START_CACHE_VERSION = 1;/u,
      message: 'Sobol cold-start cache must use the release V1 contract.',
    },
    {
      file: 'src/themes/plugins/zen/pond/renderers/worker/core/zenPondWorkerProtocol.js',
      required: /ZEN_POND_WORKER_PROTOCOL_VERSION = 'zen_pond_worker_protocol_v1'/u,
      message: 'Zen pond worker messages must use the release V1 protocol.',
    },
    {
      file: 'src/themes/plugins/zen/runtime/worker/zenBonsaiWorkerProtocol.js',
      required: /ZEN_BONSAI_WORKER_PROTOCOL_VERSION = 'zen_bonsai_worker_protocol_v2'/u,
      message: 'Release V1 Zen bonsai worker messages must use semantic-ack protocol V2.',
    },
    {
      file: 'src/themes/plugins/zen/pond/contracts/zenPondTuningContract.js',
      required: /ZEN_POND_TUNING_CONTRACT_VERSION = 1/u,
      message: 'Zen pond tuning records must use the release V1 contract.',
    },
    {
      file: 'src/themes/plugins/zen/pond/storage/zenPondStorage/tuningStore.js',
      required: /ZEN_POND_TUNING_STORAGE_KEY = 'zen_pond_tuning_v1'/u,
      message: 'Zen pond tuning storage must use the release V1 key.',
    },
    {
      file: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2LineageScoringPolicy.js',
      required: /classic2_candidate_score_v1/u,
      message: 'Classic2 score policy must use its release V1 contract.',
    },
    {
      file: 'src/themes/plugins/zen/model/classic2/ZenBonsaiClassic2DevelopmentModel.js',
      required: /classic2_wood_presentation_v1/u,
      message: 'Classic2 wood presentation must use its release V1 contract.',
    },
    {
      file: 'src/apps/boot/bootPrewarmSnapshotContract.js',
      required: /export const BOOT_PREWARM_SCHEMA_VERSION = 2;[\s\S]*export function requireBootPrewarmDashboardSnapshot\(value\)/u,
      forbidden: /hasSitesSnapshot/u,
      message: 'The cross-entry app boot contract must validate one exact full current-only V2 dashboard snapshot.',
    },
    {
      file: 'src/apps/background/services/boot/BootPrewarmService.js',
      required: /buildBootPrewarmProtocolSnapshot\(\{[\s\S]*requireBootPrewarmDashboardSnapshot\(/u,
      forbidden: /const buildProtocolSnapshot|analysis\.sitesSnapshot|hasSitesSnapshot/u,
      message: 'Boot prewarm production must use the shared V2 protocol builder without optional predecessor sections.',
    },
    {
      file: 'src/apps/dashboard/bootstrap/bootPrewarmSnapshot.js',
      required: /return requireBootPrewarmDashboardSnapshot\(snapshot\);/u,
      forbidden: /normalizeThemeIdFromPreference|cloneSection|\.\.\.source/u,
      message: 'Dashboard boot must reject partial or aliased prewarm snapshots instead of normalizing them.',
    },
    {
      file: 'src/platform/storage/runtime/GateInterventionSessionRepository.js',
      required: /export const GATE_INTERVENTION_SESSION_VERSION = 1;/u,
      message: 'Gate intervention session storage must use the release V1 contract.',
    },
    {
      file: 'src/platform/storage/runtime/videoSkipPoolContract.js',
      required: /export const VIDEO_SKIP_POOL_SCHEMA_VERSION = 1;/u,
      forbidden: /availableSkips|accumulatedTimeSec/u,
      message: 'Video-skip pool contract must expose only the release V1 cooldown shape.',
    },
    {
      file: 'src/platform/storage/runtime/VideoSkipPoolRepository.js',
      required: /videoSkipPoolContract\.js[\s\S]*poolWriter\.merge\(snapshot\)/u,
      forbidden: /availableSkips|accumulatedTimeSec|poolStore\.set\(/u,
      message: 'Video-skip pool storage must consume V1 through the background write owner.',
    },
    {
      file: 'src/platform/storage/runtime/cycleStateStorageContracts.js',
      required: /CYCLE_CHECKPOINT_SCHEMA_VERSION = 1;[\s\S]*CYCLE_SETTINGS_SCHEMA_VERSION = 1;/u,
      forbidden: /cloneCycleCheckpoint|cloneCycleSettings/u,
      message: 'Cycle checkpoint and settings storage must use exact release V1 envelopes.',
    },
    {
      file: 'src/platform/storage/internal/indexeddb/stores/clseRecordContracts.js',
      required: /export const CLSE_RECORD_SCHEMA_VERSION = 1;/u,
      message: 'Every raw CLSE persisted class must use the release V1 record envelope.',
    },
    {
      file: 'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
      required: /normalizeClseImportRow\(row, normalizeClseBucket60sRow\)/u,
      forbidden: /normalizeTimestampKeyImportRow|normalizeClseBaselineImportRow/u,
      message: 'CLSE import must validate exact V1 records without open predecessor helpers.',
    },
    {
      file: 'src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js',
      required: /INTERVENTION_EXPOSURE_SCHEMA_VERSION = 1;[\s\S]*INTERVENTION_EFFECT_DAILY_SCHEMA_VERSION = 1;/u,
      message: 'Intervention exposure and daily-effect records must use release V1.',
    },
    {
      file: 'src/domains/behavior/spike/SpikeSignalSchema.js',
      required: /SPIKE_SIGNAL_V1_CONTRACT_INVALID[\s\S]*hasExactKeys\(candidate, SPIKE_SIGNAL_FIELDS\)/u,
      forbidden: /CLSE_EVENT_TYPE_TO_SPIKE_SIGNAL|candidate\.(?:ts|bucket_ts|started_at|ended_at|duration_ms|aggression|reasons)\b/u,
      message: 'Spike protocol signals must accept only the exact release V1 DTO and must not restore predecessor CLSE shape aliases.',
    },
    {
      file: 'src/domains/ai/contracts/aiRequestProtocol.js',
      required: /AI_TASK_PROTOCOL_VERSION = 1;[\s\S]*hasExactKeys\(request, AI_TASK_REQUEST_FIELDS\)/u,
      forbidden: /return 'en';|AI_TONES\.CALM;/u,
      message: 'AI task protocol requests must use the exact release V1 envelope and reject invalid provided locale or tone values.',
    },
    {
      file: 'src/domains/nudge/textShuffleManager.js',
      required: /requireTextRhythmShuffleProfile[\s\S]*const shuffleProfile = requireTextRhythmShuffleProfile\(rawShuffleProfile\);/u,
      forbidden: /setting\?\.(?:step|level|value)|innerShuffle|textShuffleInner|getTextShuffleTuning/u,
      message: 'Text shuffle runtime must consume only the exact materialized text-rhythm shuffle profile.',
    },
    {
      file: 'src/domains/protection/background/runtime/EnvelopeAdapter.js',
      required: /isAdaptiveFrictionFeatureKey\(featureKey\)[\s\S]*const policyShouldStrengthen = baseActive[\s\S]*&& planActive[\s\S]*createFilterIntensityModifier/u,
      forbidden: /(?:planEntry|baseEntry)\??\.(?:step|level)/u,
      message: 'Protection filter merging must arbitrate named adaptive profiles for user-enabled binary entries, never compare saved levels.',
    },
    {
      file: 'src/domains/ai/tasks/sessionSummary/buildSessionSummaryNarrationInput.js',
      required: /SESSION_SUMMARY_DRAFT_CONTRACT_VERSION = 'home-focus-session-summary-v1'[\s\S]*requireSessionSummaryDraftV1\(summaryDraft\)/u,
      forbidden: /summaryDraft\.(?:draftId|draftVersion|labelIds|copy|narration|status|actionId|recommendedAction)\b|summaryDraft\?\.(?:draftId|draftVersion|labelIds|copy|narration|status|actionId|recommendedAction)\b/u,
      message: 'Session-summary presentation input must accept only the current release V1 draft shape.',
    },
    {
      file: 'src/themes/plugins/zen/model/sakura/sakuraRenderer.js',
      required: /nebari_geometry_v1/u,
      message: 'Sakura nebari geometry identity must use the release V1 signature.',
    },
    {
      file: 'scripts/dev/zen-bonsai-growth-snapshot-matrix.mjs',
      required: /const MATRIX_VERSION = 1;/u,
      message: 'Zen growth diagnostic manifest must use release V1.',
    },
    {
      file: 'scripts/dev/zen-bonsai-lineage-distribution-audit.mjs',
      required: /const AUDIT_VERSION = 1;/u,
      message: 'Zen lineage diagnostic manifest must use release V1.',
    },
    {
      file: 'scripts/perf/zenWaterBaselineBench.mjs',
      required: /benchmark_type: 'zen-water-release-v1-baseline'/u,
      message: 'Zen water diagnostics must generate only the release V1 baseline.',
    },
  ];

  for (const contract of contracts) {
    const source = await read(contract.file);
    requirePattern(source, contract.required, `${contract.file}: ${contract.message}`);
    if (contract.forbidden) {
      forbidPattern(source, contract.forbidden, `${contract.file}: ${contract.message}`);
    }
  }

  const sitePullFiles = [
    'src/domains/stats/insights/sitePull/patterns/sitePullPatternCalibrationAudit.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullPatternThresholdAudit.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullPatternPresenter.js',
    'src/domains/stats/insights/sitePull/patterns/sitePullPatternFeedbackSpec.js',
  ];
  for (const relativePath of sitePullFiles) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /(?:^|[-_])v(?:[2-9]|[1-9][0-9]+)\b/imu,
      `${relativePath}: active site-pull contract contains a pre-release successor version.`,
    );
  }

  // The product release and the computed diagnostic model have separate
  // revisions. Pin the model adopted by the Active site-pull boundary map;
  // do not silently relabel changed analysis as the original model.
  const sitePullModelPath = 'src/domains/stats/insights/sitePull/scoring/sitePullScoreModel.js';
  requirePattern(
    await read(sitePullModelPath),
    /^export const SITE_PULL_MODEL_VERSION = 'site-pull-release-v5';$/mu,
    `${sitePullModelPath}: diagnostic model must match the Active site-pull-release-v5 contract.`,
  );

  const lensArtifactPath = 'src/apps/dashboard/hooks/artifactSettings/useLensArtifactSettingsFamily.js';
  const lensArtifactSource = await read(lensArtifactPath);
  requirePattern(lensArtifactSource, /STRENGTH_SCHEMA = Object.freeze\(\{ enabled: 'boolean', strength: 'number' \}\)/u, lensArtifactPath + ': Lens configuration must persist enabled and numeric strength.');
  requirePattern(lensArtifactSource, /requireVisualFrictionStrength/u, lensArtifactPath + ': Lens strength must use the canonical bounded validator.');
  requirePattern(lensArtifactSource, /controlMode: 'range'/u, lensArtifactPath + ': Lens must expose continuous strength controls.');
  forbidPattern(
    lensArtifactSource,
    /createArtifactLevelChildState|setLevel|\.level\b|\.step\b/u,
    `${lensArtifactPath}: Lens must not restore predecessor level controls.`,
  );

  const fixedArtifactContracts = [
    {
      file: 'src/apps/dashboard/hooks/artifactSettings/useVeilArtifactSettingsFamily.js',
      required: /socialMetrics:\s*createArtifactChoiceChildState[\s\S]*shortformBlock:\s*createArtifactBinaryChildState/u,
      message: 'Veil must expose semantic social scope plus short-form blocking.',
    },
    {
      file: 'src/apps/dashboard/hooks/artifactSettings/useBrakeArtifactSettingsFamily.js',
      required: /scrollFriction:\s*createArtifactBinaryChildState[\s\S]*inputVisualBrake:\s*createArtifactBinaryChildState/u,
      message: 'scroll friction and input visual brake must remain binary.',
    },
    {
      file: 'src/apps/dashboard/hooks/artifactSettings/useBarrierArtifactSettingsFamily.js',
      required: /intentThreshold:\s*createArtifactChoiceChildState[\s\S]*textRhythm:\s*createArtifactBinaryChildState[\s\S]*detourSpreadGuard:\s*createArtifactChoiceChildState/u,
      message: 'Barrier must own the consumption interval, binary text rhythm and protected-tab maximum.',
    },
    {
      file: 'src/apps/dashboard/hooks/artifactSettings/useGateArtifactSettingsFamily.js',
      required: /entryCheckpoint:\s*createArtifactBinaryChildState[\s\S]*returnGuard:\s*createArtifactBinaryChildState/u,
      message: 'Gate entry and return guards must remain binary.',
    },
    {
      file: 'src/apps/dashboard/hooks/artifactSettings/useFlareArtifactSettingsFamily.js',
      required: /sentinelFlare:\s*createArtifactBinaryChildState/u,
      message: 'Flare must remain binary.',
    },
    {
      file: 'src/apps/dashboard/hooks/useProtectionEchoArtifactControl.js',
      required: /historyCleanup:\s*createArtifactBinaryChildState[\s\S]*bookmarkConceal:\s*createArtifactBinaryChildState/u,
      message: 'Echo cleanup and concealment controls must remain binary.',
    },
  ];
  for (const contract of fixedArtifactContracts) {
    const source = await read(contract.file);
    requirePattern(source, contract.required, `${contract.file}: ${contract.message}`);
    forbidPattern(
      source,
      /createArtifactLevelChild(?:State|Handlers)|\bsetLevel\b|\?\.level\b/u,
      `${contract.file}: fixed or semantic artifact controls must not restore a level surface.`,
    );
  }

  const gateConfigPath = 'src/domains/settings/config/gateConfig.js';
  const gateConfigSource = await read(gateConfigPath);
  requirePattern(
    gateConfigSource,
    /detourSpreadGuard:\s*Object\.freeze\(\{[\s\S]*maxProtectedTabs:/u,
    `${gateConfigPath}: detour spread must store the direct protected-tab maximum.`,
  );
  requirePattern(
    gateConfigSource,
    /GATE_DETOUR_SPREAD_GUARD_INVALID[\s\S]*GATE_CONFIG_CHILD_UNKNOWN/u,
    `${gateConfigPath}: stale or unknown Gate shapes must fail loudly.`,
  );
  forbidPattern(
    gateConfigSource,
    /GATE_LEVEL_|GATE_PROTECTED_TAB_BUDGET_BY_LEVEL|normalizeGateLevel|getGateProtectedTabBudget/u,
    `${gateConfigPath}: inverted Gate level compatibility must not return.`,
  );
}

async function checkZenModelStateContracts() {
  const contractPath = 'src/platform/storage/themes/zen/ZenThemeModelStateContract.js';
  const contractUrl = pathToFileURL(path.resolve(rootDir, contractPath)).href;
  const {
    ZEN_THEME_MODEL_STATE_CONTRACTS,
    ZEN_THEME_MODEL_STATE_KEYS,
    ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR,
    ZEN_THEME_MODEL_STATE_VALUE_CLASS,
    requireZenThemeModelStateSnapshotValue,
  } = await import(`${contractUrl}?release-v1-guard=${Date.now()}`);
  const keys = Object.values(ZEN_THEME_MODEL_STATE_KEYS).sort();
  const contractKeys = Object.keys(ZEN_THEME_MODEL_STATE_CONTRACTS).sort();
  if (JSON.stringify(keys) !== JSON.stringify(contractKeys)) {
    fail(`${contractPath}: every canonical Zen model-state key must have exactly one release V1 validator.`);
  }
  const excludedCacheKeys = new Set([
    ZEN_THEME_MODEL_STATE_KEYS.KOI_APPEARANCE_CACHE,
    ZEN_THEME_MODEL_STATE_KEYS.KOI_ACTIVITY_PROFILE_CACHE,
  ]);
  for (const key of keys) {
    const contract = ZEN_THEME_MODEL_STATE_CONTRACTS[key];
    const shouldExclude = excludedCacheKeys.has(key);
    if (shouldExclude) {
      if (
        contract?.valueClass !== ZEN_THEME_MODEL_STATE_VALUE_CLASS.DISCARDABLE_CACHE
        || contract?.snapshotBehavior !== ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.EXCLUDE
      ) {
        fail(`${contractPath}: ${key} must remain a discardable cache excluded from snapshots.`);
      }
    } else if (contract?.snapshotBehavior !== ZEN_THEME_MODEL_STATE_SNAPSHOT_BEHAVIOR.INCLUDE) {
      fail(`${contractPath}: durable/model key ${key} must remain covered by exact snapshot validation.`);
    }
  }
  for (const [key, invalidValue] of [
    [ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY, { schemaVersion: 1 }],
    [ZEN_THEME_MODEL_STATE_KEYS.BONSAI_CULTIVATION_LEDGER, { schemaVersion: 2 }],
    [ZEN_THEME_MODEL_STATE_KEYS.VNEXT_PREFERENCE_MODEL, { version: 1 }],
  ]) {
    let rejected = false;
    try {
      requireZenThemeModelStateSnapshotValue(key, invalidValue);
    } catch (_error) {
      rejected = true;
    }
    if (!rejected) fail(`${contractPath}: ${key} accepted a wrong release V1 contract.`);
  }
  let unknownRejected = false;
  try {
    requireZenThemeModelStateSnapshotValue('zen_unknown_model_state', {});
  } catch (_error) {
    unknownRejected = true;
  }
  if (!unknownRejected) fail(`${contractPath}: unknown model-state keys must fail loudly.`);

  const typedStatePath = 'src/platform/storage/themes/zen/ZenThemeModelState.js';
  const typedStateUrl = pathToFileURL(path.resolve(rootDir, typedStatePath)).href;
  const { ZenThemeModelState } = await import(`${typedStateUrl}?release-v1-guard=${Date.now()}`);
  const profileGenerationLeasePath = 'src/platform/storage/themes/zen/ZenThemeProfileGenerationLease.js';
  const profileGenerationLeaseUrl = pathToFileURL(
    path.resolve(rootDir, profileGenerationLeasePath),
  ).href;
  const { createPinnedZenThemeProfileGenerationLease } = await import(
    `${profileGenerationLeaseUrl}?release-v1-guard=${Date.now()}`
  );
  const missingState = new ZenThemeModelState({
    modelStateStore: {
      async getWithProfileEpoch(defaults = {}) {
        return { ...defaults };
      },
      async setWithProfileEpoch() {
        return [];
      },
      async bootstrapValueWithProfileEpoch(_key, initialValue) {
        return initialValue;
      },
    },
    profileGenerationLease: createPinnedZenThemeProfileGenerationLease({
      profileGeneration: 'profile_epoch:release_v1_baseline:v1',
    }),
  });
  let durableMissingRejected = false;
  try {
    await missingState.getValue(ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY);
  } catch (_error) {
    durableMissingRejected = true;
  }
  if (!durableMissingRejected) {
    fail(`${typedStatePath}: normal durable/model reads must reject a missing key.`);
  }
  if (await missingState.getValueForBootstrap(ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY) !== null) {
    fail(`${typedStatePath}: explicit first-run bootstrap reads must expose missing durable/model state as null.`);
  }
  if (await missingState.getValue(ZEN_THEME_MODEL_STATE_KEYS.KOI_APPEARANCE_CACHE) !== null) {
    fail(`${typedStatePath}: a missing discardable cache must remain a cold-rebuild miss.`);
  }
  let cacheBootstrapRejected = false;
  try {
    await missingState.getValueForBootstrap(ZEN_THEME_MODEL_STATE_KEYS.KOI_APPEARANCE_CACHE);
  } catch (_error) {
    cacheBootstrapRejected = true;
  }
  if (!cacheBootstrapRejected) {
    fail(`${typedStatePath}: discardable caches must not enter the durable-state bootstrap seam.`);
  }
  let readDefaultRejected = false;
  try {
    await missingState.getValue(ZEN_THEME_MODEL_STATE_KEYS.KOI_ROSTER_MEMORY, {});
  } catch (_error) {
    readDefaultRejected = true;
  }
  if (!readDefaultRejected) {
    fail(`${typedStatePath}: caller-provided read-time defaults must remain forbidden.`);
  }

  const [
    typedState,
    snapshotRepository,
    importPreflight,
    modelStateSnapshotContract,
    zenWorkspaceStorage,
    sobolCache,
    sakuraRuntime,
    preferenceModel,
    feedbackStore,
    artifactStore,
  ] = await Promise.all([
    read(typedStatePath),
    read('src/platform/storage/internal/indexeddb/IndexedDbSnapshotRepository.js'),
    read('src/platform/storage/internal/indexeddb/dbImportSnapshot.js'),
    read('src/platform/storage/model/ModelStateSnapshotContract.js'),
    read('src/platform/storage/themes/zen/ZenWorkspaceStorage.js'),
    read('src/themes/plugins/zen/model/v2/SakuraSobolColdStartCache.js'),
    read('src/themes/plugins/zen/model/SakuraV2Runtime.js'),
    read('src/themes/plugins/zen/model/vnext/learn/VNextPreferenceModel.js'),
    read('src/themes/plugins/zen/model/vnext/learn/VNextFeedbackStore.js'),
    read('src/platform/storage/internal/indexeddb/stores/ZenArtifactStore.js'),
  ]);
  requirePattern(typedState, /requireZenThemeModelStateValue\(key, value\)/u, 'ZenThemeModelState: typed writes must validate their per-key release V1 value.');
  requirePattern(typedState, /validateReadValue\(normalizedKey, value\)/u, 'ZenThemeModelState: typed reads must validate their per-key release V1 value.');
  requirePattern(typedState, /ZEN_THEME_MODEL_STATE_VALUE_MISSING/u, 'ZenThemeModelState: durable/model reads must fail loudly when their canonical value is missing.');
  requirePattern(typedState, /ZEN_THEME_MODEL_STATE_READ_DEFAULT_FORBIDDEN/u, 'ZenThemeModelState: generic read-time defaults must remain forbidden.');
  requirePattern(typedState, /getValueForBootstrap/u, 'ZenThemeModelState: first-run missing state must use an explicit bootstrap read seam.');
  forbidPattern(typedState, /getVNextAbTrials\s*\(\s*fallback/u, 'ZenThemeModelState: VNext trials must not regain a read-time empty-list fallback.');
  requirePattern(modelStateSnapshotContract, /isFeedTempoProfileCheckpointKey/u, 'ModelStateSnapshotContract: FeedTempo checkpoints must enter the current per-key snapshot contract.');
  requirePattern(modelStateSnapshotContract, /isZenThemeModelStateSnapshotIncluded/u, 'ModelStateSnapshotContract: existing Zen snapshot admission must remain delegated through the shared owner.');
  requirePattern(modelStateSnapshotContract, /requireZenThemeModelStateSnapshotValue/u, 'ModelStateSnapshotContract: existing Zen value validation must remain delegated through the shared owner.');
  requirePattern(snapshotRepository, /isModelStateSnapshotIncluded/u, 'IndexedDbSnapshotRepository: export must apply shared per-key model-state snapshot admission.');
  requirePattern(snapshotRepository, /requireModelStateSnapshotValue/u, 'IndexedDbSnapshotRepository: export must validate every included model-state value through the shared owner.');
  forbidPattern(snapshotRepository, /isZenThemeModelStateSnapshotIncluded/u, 'IndexedDbSnapshotRepository: export must not bypass the shared model-state snapshot owner with a Zen-only admission path.');
  requirePattern(importPreflight, /requireModelStateSnapshotValue/u, 'dbImportSnapshot: import must apply shared per-key current-schema validation.');
  forbidPattern(importPreflight, /requireZenThemeModelStateSnapshotValue/u, 'dbImportSnapshot: import must not bypass the shared model-state snapshot owner with a Zen-only validator.');
  requirePattern(sobolCache, /parsed\.version !== SOBOL_COLD_START_CACHE_VERSION/u, 'Sakura Sobol cache: cache versions must use strict numeric equality.');
  forbidPattern(sobolCache, /Number\(parsed\.version\)/u, 'Sakura Sobol cache: string cache versions must not be coerced.');
  requirePattern(zenWorkspaceStorage, /SAKURA_V2_RUNTIME_FLAGS: 'zen_sakura_v2_runtime_flags_v1'/u, 'Sakura runtime flags: release V1 must own a collision-free canonical workspace key.');
  forbidPattern(zenWorkspaceStorage, /SAKURA_V2_RUNTIME_FLAGS: 'zen_sakura_v2_runtime_flags'/u, 'Sakura runtime flags: the pre-baseline collision key must remain retired.');
  requirePattern(sakuraRuntime, /must contain exactly the release V1 fields/u, 'Sakura runtime flags: stored records must reject missing/extra fields.');
  requirePattern(sakuraRuntime, /export const SAKURA_V2_RUNTIME_FLAGS_VERSION = 1;/u, 'Sakura runtime flags: release V1 must remain the only stored schema version.');
  requirePattern(sakuraRuntime, /return requireCurrentRuntimeFlags\(parsed\);/u, 'Sakura runtime flags: normal reads must validate only the current release V1 record.');
  forbidPattern(sakuraRuntime, /SAKURA_V2_RUNTIME_FLAGS_LEGACY_VERSION|migrateLegacyRuntimeFlags|migratable version/u, 'Sakura runtime flags: pre-release V1 must not regain a normal-read migration path.');
  requirePattern(preferenceModel, /ZEN_VNEXT_PREFERENCE_MODEL_FIELDS_INVALID/u, 'VNext preference model: exact top-level release V1 fields must be enforced.');
  forbidPattern(preferenceModel, /FEATURE_ALIASES_BY_V2_KEY|resolveWeightsFromFeatureKeys/u, 'VNext preference model: predecessor feature aliases must not return.');
  requirePattern(feedbackStore, /getForBootstrap\(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY\)/u, 'VNextFeedbackStore: missing trials must enter the explicit first-run bootstrap seam.');
  forbidPattern(feedbackStore, /adapter\.get\(ZEN_VNEXT_AB_TRIALS_STORAGE_KEY,\s*\[\]\)/u, 'VNextFeedbackStore: missing trials must not be hidden by a read-time empty-list default.');
  requirePattern(artifactStore, /requireZenArtifactStoredRecord/u, 'ZenArtifactStore: stored artifact/meta rows must pass the exact release V1 validator.');
  requirePattern(artifactStore, /ZEN_ARTIFACT_COMMAND_SHAPE_INVALID/u, 'ZenArtifactStore: artifact writes must reject predecessor or extra command fields.');
  requirePattern(artifactStore, /ZEN_ARTIFACT_COLLECTION_REPLACE_COMMAND_INVALID/u, 'ZenArtifactStore: atomic collection/meta writes must reject predecessor or extra command fields.');
  requirePattern(artifactStore, /record\.treeType !== 'sakura'/u, 'ZenArtifactStore: stored artifacts must admit only the canonical sakura tree type.');
}

async function checkGeneratedDiagnosticBaseline() {
  const reportEntries = await fs.readdir(path.resolve(rootDir, 'reports'));
  for (const entryName of reportEntries) {
    if (/^(?:tomeishi-harness|zen-legacy-|zen-water-(?:d\d|phase))/u.test(entryName)) {
      fail(`reports/${entryName}: staged predecessor diagnostics must not return to the active report set.`);
    }
  }
  const retiredReportArtifacts = [
    'reports/tomeishi-harness',
    'reports/zen-legacy-visual-candidates-20260226.json',
    'reports/zen-water-d2-baseline.json',
    'reports/zen-water-d2-baseline-postfix.json',
    'reports/zen-water-phase0-cause-channel-baseline-20260226.json',
    'reports/zen-water-phase2-core-cause-channel-20260226.json',
    'reports/zen-water-phase3-5-authoring-gate-20260226.json',
    'reports/zen-water-phase6-legacy-adapter-telemetry-20260226.json',
    'reports/zen-water-phase7-cause-channel-final-20260226.json',
  ];
  for (const relativePath of retiredReportArtifacts) {
    if (await pathExists(relativePath)) {
      fail(`${relativePath}: pre-release predecessor diagnostics must not return as active generated reports.`);
    }
  }

  const [growthText, lineageText, bundleText, waterBaselineText] = await Promise.all([
    read('reports/zen-bonsai-growth-matrix/manifest.json'),
    read('reports/zen-bonsai-lineage-distribution/manifest.json'),
    read('reports/zen-bonsai-growth-matrix/matrix.bundle.js'),
    read('reports/zen-water-release-v1-baseline.json'),
  ]);
  const growth = JSON.parse(growthText);
  const lineage = JSON.parse(lineageText);
  const waterBaseline = JSON.parse(waterBaselineText);

  if (growth.version !== 1) {
    fail(`reports/zen-bonsai-growth-matrix/manifest.json: generated matrix version must be release V1, got ${growth.version}.`);
  }
  if (lineage.auditVersion !== 1) {
    fail(`reports/zen-bonsai-lineage-distribution/manifest.json: generated lineage audit version must be release V1, got ${lineage.auditVersion}.`);
  }
  if (lineage.model !== 'classic2' || lineage.modelDisplayName !== 'Main · Classic2') {
    fail('reports/zen-bonsai-lineage-distribution/manifest.json: diagnostic model identity must be classic2 / Main · Classic2.');
  }
  if (
    waterBaseline.formatVersion !== 1
    || waterBaseline.benchmark_type !== 'zen-water-release-v1-baseline'
  ) {
    fail('reports/zen-water-release-v1-baseline.json: water diagnostics must use the release V1 format and benchmark identity.');
  }

  const caseLabels = new Map(
    Array.isArray(growth.cases)
      ? growth.cases.map((item) => [item?.model, item?.modelLabel])
      : [],
  );
  if (caseLabels.get('classic2') !== 'Main · Classic2') {
    fail('reports/zen-bonsai-growth-matrix/manifest.json: Classic2 cases must use the production role-first display name.');
  }
  if (caseLabels.get('classic') !== 'Comparison · Classic') {
    fail('reports/zen-bonsai-growth-matrix/manifest.json: classic cases must use the comparison role-first display name.');
  }

  for (const [relativePath, source] of [
    ['reports/zen-bonsai-growth-matrix/manifest.json', growthText],
    ['reports/zen-bonsai-lineage-distribution/manifest.json', lineageText],
    ['reports/zen-bonsai-growth-matrix/matrix.bundle.js', bundleText],
    ['reports/zen-water-release-v1-baseline.json', waterBaselineText],
  ]) {
    forbidPattern(
      source,
      /classic2_candidate_score_v2|classic2_wood_presentation_v2|const MATRIX_VERSION = 12|const AUDIT_VERSION = 3|EXPLICIT_IDENTITY_CUTOVER|EPHEMERAL_PREVIEW_IDENTITY_CUTOVER|explicit_identity_cutover|ephemeral_preview_identity_cutover|cutoverFromTreeFingerprint|cutoverFromTreeIdentityFingerprint|cutoverFromIdentityRevision|cutoverFromStateRevision|IDENTITY_CUTOVER_REQUIRED/u,
      `${relativePath}: generated diagnostic artifact still records a pre-release contract or generator version.`,
    );
  }
}

async function checkZenModelRoles() {
  const catalogUrl = pathToFileURL(path.resolve(
    rootDir,
    'src/themes/plugins/zen/model/ZenBonsaiModelCatalog.js',
  )).href;
  const {
    ZEN_BONSAI_MODEL_CATALOG,
    ZEN_BONSAI_MODEL_IDS,
    ZEN_BONSAI_MODEL_SURFACES,
    resolveZenBonsaiDefaultModelId,
    resolveZenBonsaiModelForSurface,
    requireZenBonsaiModelAdmission,
    requireZenBonsaiModelId,
  } = await import(`${catalogUrl}?release-v1-guard=${Date.now()}`);

  const ids = Object.keys(ZEN_BONSAI_MODEL_CATALOG).sort();
  const expectedIds = ['classic', 'classic2', 'g15_4', 'plume', 'vnext'];
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    fail(`ZenBonsaiModelCatalog: expected only ${expectedIds.join(', ')}, got ${ids.join(', ')}.`);
    return;
  }

  const expected = {
    plume: { role: 'production', displayName: 'Main · Plume Sakura', main: true, experimentDefault: true },
    g15_4: { role: 'comparison', displayName: 'Comparison · G15.4 Sakura', main: false },
    classic2: { role: 'comparison', displayName: 'Comparison · Classic2', main: false },
    classic: { role: 'comparison', displayName: 'Comparison · Classic', main: false },
    vnext: { role: 'research', displayName: 'Research · vNext', main: false },
  };
  for (const [id, contract] of Object.entries(expected)) {
    const actual = ZEN_BONSAI_MODEL_CATALOG[id];
    for (const [key, value] of Object.entries(contract)) {
      if (actual?.[key] !== value) {
        fail(`ZenBonsaiModelCatalog: ${id}.${key} must be ${JSON.stringify(value)}.`);
      }
    }
  }

  if (resolveZenBonsaiDefaultModelId(ZEN_BONSAI_MODEL_SURFACES.HOME) !== ZEN_BONSAI_MODEL_IDS.PLUME) {
    fail('ZenBonsaiModelCatalog: Home default must be plume.');
  }
  if (resolveZenBonsaiDefaultModelId(ZEN_BONSAI_MODEL_SURFACES.EXPERIMENT) !== ZEN_BONSAI_MODEL_IDS.PLUME) {
    fail('ZenBonsaiModelCatalog: Experiment default/reset must be plume.');
  }
  let unknownRejected = false;
  try {
    requireZenBonsaiModelId('unknown-release-model');
  } catch (_error) {
    unknownRejected = true;
  }
  if (!unknownRejected) {
    fail('ZenBonsaiModelCatalog: unknown model ids must fail loudly.');
  }
  let nullRejected = false;
  try {
    resolveZenBonsaiModelForSurface({
      surface: ZEN_BONSAI_MODEL_SURFACES.HOME,
      requestedModel: null,
    });
  } catch (_error) {
    nullRejected = true;
  }
  if (!nullRejected) {
    fail('ZenBonsaiModelCatalog: explicit null model input must fail loudly.');
  }
  for (const forbiddenMainModel of [ZEN_BONSAI_MODEL_IDS.CLASSIC, ZEN_BONSAI_MODEL_IDS.VNEXT]) {
    let admissionRejected = false;
    try {
      requireZenBonsaiModelAdmission({
        surface: ZEN_BONSAI_MODEL_SURFACES.HOME,
        modelId: forbiddenMainModel,
      });
    } catch (_error) {
      admissionRejected = true;
    }
    if (!admissionRejected) {
      fail(`ZenBonsaiModelCatalog: Home must never admit ${forbiddenMainModel} as a fallback.`);
    }
  }
}

async function checkActiveDocumentationBaseline() {
  const activeDocs = [
    'docs/system-architecture/02-runtime-storage-boundaries.md',
    'docs/system-architecture/03-theme-plugin-and-zen.md',
    'docs/architecture/storage/storage-architecture-target.md',
    'docs/architecture/repository/storage-stats-tracking-boundary-map.md',
    'docs/architecture/repository/settings-command-boundary-map.md',
    'docs/architecture/repository/settings-tab-boundary-map.md',
    'docs/architecture/repository/filter-tab-boundary-map.md',
    'docs/architecture/security/runtime-message-security-hardening.md',
    'docs/architecture/themes/zen/zen-bonsai-architecture-guards.md',
    'docs/architecture/themes/zen/zen-bonsai-vitality-growth-spec.md',
    'docs/architecture/themes/zen/zen-theme-definition.md',
    'docs/architecture/themes/zen/zen-water-surface-field-architecture.md',
    'docs/architecture/themes/zen/zen-main-presentation-scene-architecture.md',
    'docs/architecture/i18n/i18n-architecture-target.md',
    'docs/architecture/runtime/bootstrap-friction-snapshot-architecture.md',
    'docs/architecture/repository/site-pull-pattern-boundary-map.md',
    'docs/architecture/repository/personal-baseline-boundary-map.md',
    'docs/architecture/repository/system-structure-implementation-audit.md',
    'docs/product/dashboard/home-scan-reflect-structure.md',
    'src/platform/storage/README.md',
    'src/themes/plugins/zen/README.md',
    'src/themes/plugins/zen/bonsai/README.md',
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceField/README.md',
    'src/themes/plugins/zen/pond/renderers/pixi/waterSurfaceShader/README.md',
    'src/themes/plugins/zen/widgets/tools/ARTIFACT_WIDGETS.md',
    'docs/decisions/security/selective-host-permission-security-decision.md',
    'docs/domains/protection/protection-settings-propagation-policy.md',
    'docs/product/dashboard/artifact-protocol-runtime-contract.md',
    'docs/product/dashboard/basic-protection-strategy-prd.md',
    'docs/product/dashboard/protection-tab-prd.md',
  ];
  const forbidden = /IndexedDB v1[4-9]|\bv14\b|\bv15\b|settingsCacheMigration\.js|migrateLegacy|classic2_candidate_score_v2|classic2_wood_presentation_v2|zen_pond_tuning_v2|sobol_pool_cache_v2|ZenEnsoCanvasV52|daily_recap|ZenClosedDayRecap|ZenMainPresentationLedger|zen_closed_day_recap|preserves the old ZenBonsaiFeedbackLens|legacy comparison modes|legacy GGX|legacy\/debug umbrella|Legacy `waterHeight|revokeGlobalHostPermissions|reduceGlobalHostAccess|legacy broad host|unsupported legacy hashes|siteAccessUpgradePromptDismissedAtCount|Legacy filter setting shapes|hardLock|hard[_ -]?lock/iu;
  for (const relativePath of activeDocs) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      forbidden,
      `${relativePath}: Active release documentation still describes a removed pre-release version or migration owner.`,
    );
  }

  for (const relativePath of [
    'docs/product/dashboard/basic-mode-automatic-protection-prd.md',
    'docs/product/dashboard/information-architecture-basic-pro-tabs-prd.md',
    'docs/product/dashboard/pro-mode-policy-studio-prd.md',
    'docs/product/dashboard/artifact-six-axis-restructure-prd.md',
    'docs/product/dashboard/basic-strategy-orchestrator-prd.md',
    'docs/product/popup/popup-overview-garden-experience-prd.md',
    'docs/product/garden/garden-ambient-system-prd.md',
  ]) {
    const source = await read(relativePath);
    forbidPattern(
      source,
      /hardLock|hard[_ -]?lock/iu,
      `${relativePath}: retired hard-lock policy and DTO names must not return to release documentation.`,
    );
  }

  const settingsBoundary = await read('docs/architecture/repository/settings-command-boundary-map.md');
  requirePattern(
    settingsBoundary,
    /non-extension documents cannot read[\s\S]{0,180}runtime `GET_SETTINGS` relay/iu,
    'settings-command-boundary-map.md: non-extension reads must document the runtime relay as their only settings owner.',
  );
  requirePattern(
    settingsBoundary,
    /relay unavailable or rejected \| reject; do not read persistence directly/iu,
    'settings-command-boundary-map.md: relay failures must document fail-loud behavior without direct persistence read-through.',
  );
  requirePattern(
    settingsBoundary,
    /no settings migration helper,[\s\S]{0,120}exists in active runtime/iu,
    'settings-command-boundary-map.md: release V1 must keep settings migration helpers out of active runtime.',
  );

  const debugConfig = await read('src/domains/settings/config/debugConfig.js');
  for (const predecessorField of [
    'fieldLauncherEnabled',
    'devTimeOverrideEnabled',
    'devTimeOverrideHour',
  ]) {
    if (!debugConfig.includes(`'${predecessorField}'`)) {
      fail(`debugConfig.js: current-only normalization must reject predecessor field ${predecessorField}.`);
    }
  }

  const i18nTarget = await read('docs/architecture/i18n/i18n-architecture-target.md');
  forbidPattern(
    i18nTarget,
    /one-shot migration of legacy runtime language storage/iu,
    'i18n-architecture-target.md: release V1 must not allow a prior runtime-language storage migration.',
  );
  requirePattern(
    i18nTarget,
    /legacy runtime-language storage migration or alternate storage-key reads/iu,
    'i18n-architecture-target.md: prior runtime-language keys must remain explicitly forbidden.',
  );

  const bootstrapTarget = await read('docs/architecture/runtime/bootstrap-friction-snapshot-architecture.md');
  forbidPattern(
    bootstrapTarget,
    /## 10\) Migration Status|legacy key is not written after final cutover|legacy helper\/key is removed/iu,
    'bootstrap-friction-snapshot-architecture.md: Active docs must not present release V1 as an unfinished predecessor cutover.',
  );
  requirePattern(
    bootstrapTarget,
    /## 10\) Release V1 Status[\s\S]{0,700}normal runtime contains no prior-key read, previous-shape conversion,[\s\S]{0,180}snapshot migration/iu,
    'bootstrap-friction-snapshot-architecture.md: the exact current-only release V1 snapshot contract must stay documented.',
  );

  const [
    artifactBindingOwner,
    artifactRuntimeDoc,
    featureVectorOwner,
    sitePullDoc,
    personalBaselineDoc,
    structureAuditDoc,
    homeStructureDoc,
  ] = await Promise.all([
    read('src/domains/protection/runtime/canonicalArtifactRuntimeBinding.js'),
    read('docs/product/dashboard/artifact-protocol-runtime-contract.md'),
    read('src/domains/stats/insights/features/buildSiteFeatureVector.js'),
    read('docs/architecture/repository/site-pull-pattern-boundary-map.md'),
    read('docs/architecture/repository/personal-baseline-boundary-map.md'),
    read('docs/architecture/repository/system-structure-implementation-audit.md'),
    read('docs/product/dashboard/home-scan-reflect-structure.md'),
  ]);

  requirePattern(
    artifactBindingOwner,
    /RUNTIME_ARTIFACTS:\s*'runtime_artifacts'/u,
    'canonicalArtifactRuntimeBinding.js: runtime_artifacts must remain the current execution-kind owner.',
  );
  requirePattern(
    artifactRuntimeDoc,
    /executionKind:\s*"runtime_artifacts"/u,
    'artifact-protocol-runtime-contract.md: the current runtime execution kind must match its canonical owner.',
  );
  requirePattern(
    artifactRuntimeDoc,
    /canonicalArtifactRuntimeBinding\.js` is the sole canonical-artifact to runtime-execution mapping owner/iu,
    'artifact-protocol-runtime-contract.md: documentation must name the canonical runtime binding owner.',
  );
  forbidPattern(
    artifactRuntimeDoc,
    /legacy_runtime_artifacts|## 6\) Migration target|keep legacy runtime adapters|fallback recomputation from raw snapshot is allowed only for backward compatibility/iu,
    'artifact-protocol-runtime-contract.md: predecessor execution and telemetry compatibility claims must stay removed.',
  );

  forbidPattern(
    featureVectorOwner,
    /SITE_FEATURE_VECTOR_INPUT_ALIASES/u,
    'buildSiteFeatureVector.js: predecessor site-intel alias tables must not return.',
  );
  requirePattern(
    sitePullDoc,
    /There is no alias table or predecessor-key read-through/iu,
    'site-pull-pattern-boundary-map.md: the exact canonical intel input contract must remain explicit.',
  );
  forbidPattern(
    sitePullDoc,
    /SITE_FEATURE_VECTOR_INPUT_ALIASES|feature-vector compatibility aliases|vector-only compatibility input|compatibility projection for public\/profile surfaces/iu,
    'site-pull-pattern-boundary-map.md: removed aliases and current input modes must not be described as compatibility paths.',
  );

  requirePattern(
    personalBaselineDoc,
    /flat summary fields are derived from the metric authority and are never accepted as a second input shape/iu,
    'personal-baseline-boundary-map.md: metrics must remain the sole input authority for flat public summaries.',
  );
  forbidPattern(
    personalBaselineDoc,
    /old flat DTO|compatibility output|output-only compatibility fields|metric-derived compatibility fields/iu,
    'personal-baseline-boundary-map.md: current public projections must not be documented as predecessor compatibility.',
  );

  requirePattern(
    structureAuditDoc,
    /Storage Boundary Is An Exact Release V1 Contract[\s\S]{0,1200}release V1 keeps no dormant migration framework/iu,
    'system-structure-implementation-audit.md: current storage audit must describe the exact release V1 boundary.',
  );
  forbidPattern(
    structureAuditDoc,
    /bounded compatibility budget|storage-internal compatibility read|swallowed legacy migration|migration bootstrap catches/iu,
    'system-structure-implementation-audit.md: removed storage migration budgets must not return as current findings.',
  );

  forbidPattern(
    homeStructureDoc,
    /Legacy `garden` requests should route|preserves compatibility without keeping a separate ambiguous top-level destination/iu,
    'home-scan-reflect-structure.md: the removed garden route alias must not return.',
  );
  requirePattern(
    homeStructureDoc,
    /`garden` is not a dashboard tab ID or release V1 route alias/iu,
    'home-scan-reflect-structure.md: exact registry-owned routing must remain documented.',
  );
}

async function main() {
  await checkExternalStandardsAndPersistenceBaseline();
  await checkRemovedCompatibilityEntrypoints();
  await checkScheduleSingleTruthContract();
  await checkSettingsTransportRelayContract();
  await checkGlobalCapReinforcementContract();
  await checkProtectionCurrentOnlyContract();
  await checkMainPresentationSceneContract();
  await checkEntropyOwnedV1Signatures();
  await checkZenModelStateContracts();
  await checkGeneratedDiagnosticBaseline();
  await checkZenModelRoles();
  await checkActiveDocumentationBaseline();

  if (violations.length > 0) {
    console.error('[release-v1-baseline] Contract violations detected:');
    violations.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log('[release-v1-baseline] PASS: Entropy-owned release contracts match their explicit current-only baselines and external standards remain intact.');
}

main().catch((error) => {
  console.error('[release-v1-baseline] Unexpected error:', error);
  process.exit(1);
});
