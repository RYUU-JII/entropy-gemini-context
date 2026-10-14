#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectChromeStorageAreaAccess } from './chromeStorageAreaContract.mjs';

const rootDir = process.cwd();
const srcDir = path.resolve(rootDir, 'src');
const testsDir = path.resolve(rootDir, 'tests');
const retiredDataManagerPath = path.resolve(rootDir, 'src/shared/storage/DataManager.js');
const retiredSharedStorageDir = path.resolve(rootDir, 'src/shared/storage');
const retiredStatsCachePath = path.resolve(rootDir, 'src/domains/tracking/background/StatsCache.js');
const retiredTrackingTickMetricsBackupPath = path.resolve(rootDir, 'src/domains/tracking/background/TickMetricsBackup.js');
const retiredStatsTickMetricsBackupPath = path.resolve(rootDir, 'src/domains/stats/background/runtime/tickMetricsBackupService.js');
const retiredBehaviorMetricsCollectorPath = path.resolve(rootDir, 'src/domains/stats/background/collection/behaviorMetricsCollector.js');
const retiredBackgroundKernelTickBufferPath = path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelTickBuffer.js');
const retiredTrackingNudgeDebtPersistencePaths = [
  'src/domains/tracking/background/NudgeDebtPersistence.js',
  'src/domains/tracking/background/nudgeDebtPersistence.js',
].map((relativePath) => path.resolve(rootDir, relativePath));
const retiredVideoSkipPoolStoragePath = path.resolve(rootDir, 'src/domains/nudge/video-skip/PoolStorage.js');
const retiredScheduleEnvironmentPath = path.resolve(rootDir, 'src/apps/dashboard/tabs/schedule/useScheduleEnvironment.js');
const retiredBrowserStoragePath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/browserStorage.js');
const retiredChromeStorageValueUtilsPath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/storageUtils.js');
const retiredZenMainStoragePath = path.resolve(rootDir, 'src/themes/plugins/zen/model/ZenMainStorage.js');
const retiredCycleLegacyStatePath = path.resolve(rootDir, 'src/platform/storage/runtime/cycleLegacyState.js');
const retiredSettingsOwnerAcknowledgementPath = path.resolve(
  rootDir,
  'src/platform/storage/internal/chrome-storage/settingsOwnerCommandAcknowledgement.js',
);
const retiredSecuritySettingsMutationSchemaPath = path.resolve(
  rootDir,
  'src/domains/settings/config/securitySettingsMutationSchema.js',
);
const platformStorageAssetsDir = path.resolve(rootDir, 'src/platform/storage/assets');
const storageSnapshotServicePath = path.resolve(rootDir, 'src/platform/storage/internal/storageSnapshotService.js');
const storageInspectorCapabilityPath = path.resolve(rootDir, 'src/platform/storage/support/StorageInspectorCapability.js');
const storageSnapshotCapabilityPath = path.resolve(rootDir, 'src/platform/storage/support/StorageSnapshotCapability.js');
const keyMaterialContractPath = path.resolve(rootDir, 'src/platform/storage/security/keyMaterialContract.js');
const keyStorePath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/stores/KeyStore.js');
const clseHmacKeyPath = path.resolve(rootDir, 'src/domains/behavior/utils/hmacKey.js');
const storageSurfaceRegistryPath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/storageSurfaceRegistry.js');
const indexedDbSchemaPath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/dbSchema.js');
const indexedDbManagerPath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/dbManager.js');
const indexedDbOpenFailurePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/indexedDbOpenFailure.js');
const indexedDbInspectorPath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/IndexedDbInspector.js');
const indexedDbSnapshotRepositoryPath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/IndexedDbSnapshotRepository.js');
const indexedDbImportSnapshotPath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/dbImportSnapshot.js');
const clseStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/ClseStore.js');
const eventLogStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/EventLogStore.js');
const clseServicePath = path.resolve(rootDir, 'src/domains/behavior/CLSEService.js');
const clseCheckpointWriteSchedulerPath = path.resolve(
  rootDir,
  'src/domains/behavior/runtime/ClseCheckpointWriteScheduler.js',
);
const clseRingBufferPath = path.resolve(rootDir, 'src/domains/behavior/data/RingBuffer.js');
const faviconStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/FaviconStore.js');
const interventionEffectStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js');
const modelStateStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/ModelStateStore.js');
const modelStateRepositoryPath = path.resolve(rootDir, 'src/platform/storage/model/ModelStateRepository.js');
const modelStateSnapshotContractPath = path.resolve(rootDir, 'src/platform/storage/model/ModelStateSnapshotContract.js');
const feedTempoCheckpointContractPath = path.resolve(rootDir, 'src/platform/storage/model/FeedTempoProfileCheckpointContract.js');
const feedTempoCheckpointRepositoryPath = path.resolve(rootDir, 'src/platform/storage/model/FeedTempoProfileCheckpointRepository.js');
const feedTempoPersistenceServicePath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/tempo/FeedTempoPersistentProfileService.js');
const feedTempoPersistenceClientPath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/tempo/FeedTempoPersistenceClient.js');
const feedTempoRuntimePath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/tempo/FeedTempoRuntime.js');
const feedTopologyCheckpointContractPath = path.resolve(rootDir, 'src/platform/storage/model/FeedTopologyCertificateCheckpointContract.js');
const feedTopologyCheckpointRepositoryPath = path.resolve(rootDir, 'src/platform/storage/model/FeedTopologyCertificateCheckpointRepository.js');
const feedTopologyPersistenceServicePath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/topology/FeedTopologyPersistentCertificationService.js');
const feedTopologyPersistenceClientPath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/topology/FeedTopologyPersistenceClient.js');
const feedTopologyCertificationRuntimePath = path.resolve(rootDir, 'src/domains/nudge/feed-flow/topology/FeedTopologyCertificationRuntime.js');
const profileCompatibilityContractPath = path.resolve(rootDir, 'src/platform/storage/model/ProfileCompatibilityContract.js');
const profileEpochContractPath = path.resolve(rootDir, 'src/platform/storage/model/ProfileEpochContract.js');
const zenProfilePersistenceDescriptorPath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenProfilePersistenceDescriptor.js');
const statsAggregateStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js');
const statsFeaturePackStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js');
const statsFeaturePackRepositoryPath = path.resolve(rootDir, 'src/platform/storage/stats/StatsFeaturePackRepository.js');
const retiredStatsTransitionEdgeStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/StatsTransitionEdgeStore.js');
const retiredStatsTransitionEdgeRepositoryPath = path.resolve(rootDir, 'src/platform/storage/stats/StatsTransitionEdgeRepository.js');
const zenArtifactStorePath = path.resolve(rootDir, 'src/platform/storage/internal/indexeddb/stores/ZenArtifactStore.js');
const zenArtifactRepositoryPath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenArtifactRepository.js');
const bonsaiRepositoryPath = path.resolve(rootDir, 'src/themes/plugins/zen/model/BonsaiRepository.js');
const zenBonsaiPreviewRuntimePath = path.resolve(rootDir, 'src/themes/plugins/zen/runtime/preview/ZenBonsaiPreviewRuntime.jsx');
const storageRetentionPolicyPath = path.resolve(rootDir, 'src/platform/storage/retention/storageRetentionPolicy.js');
const profileResetLifecycleRepositoryPath = path.resolve(rootDir, 'src/platform/storage/runtime/ProfileResetLifecycleRepository.js');
const profileResetLifecycleStorePath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js');
const profileMutationCoordinatorPath = path.resolve(rootDir, 'src/apps/background/services/runtime/support/ProfileMutationCoordinator.js');
const profileMutationRuntimeGatePath = path.resolve(rootDir, 'src/apps/background/services/runtime/support/ProfileMutationRuntimeGate.js');
const profileMutationBindingsPath = path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProfileMutationBindings.js');
const profileMutationControlBindingsPath = path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProfileMutationControlBindings.js');
const profileMutationRuntimeLifetimePortPath = path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelProfileMutationRuntimeLifetimePort.js');
const profileMutationResponseHandoffPath = path.resolve(rootDir, 'src/platform/messaging/contracts/profileMutationResponseHandoff.js');
const profileMutationResponseAckClientPath = path.resolve(rootDir, 'src/apps/dashboard/bootstrap/profileMutationResponseAckClient.js');
const storageSupportHandlersPath = path.resolve(rootDir, 'src/domains/tracking/background/trackingMessageHandlers/storageSupportHandlers.js');
const zenThemeModelStatePath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenThemeModelState.js');
const zenThemeProfileGenerationLeasePath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenThemeProfileGenerationLease.js');
const zenThemeLifecycleProfileGenerationLeasePath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenThemeLifecycleProfileGenerationLease.js');
const zenModelRepositoryCorePath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenModelRepositoryCore.js');
const zenModelRepositoryPath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenModelRepository.js');
const zenWorkerModelRepositoryPath = path.resolve(rootDir, 'src/platform/storage/themes/zen/ZenWorkerModelRepository.js');
const zenAbTrialEvaluatorWorkerPath = path.resolve(rootDir, 'src/themes/plugins/zen/workers/zenAbTrialEvaluator.worker.js');
const zenLatentOptimizerWorkerPath = path.resolve(rootDir, 'src/themes/plugins/zen/workers/zenLatentOptimizer.worker.js');
const backgroundKernelCoreServicesPath = path.resolve(rootDir, 'src/apps/background/services/runtime/backgroundKernelCoreServices.js');
const backgroundMaintenanceCoordinatorPath = path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js');
const backgroundStorageSnapshotServicePath = path.resolve(rootDir, 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js');
const statsRetentionJobPath = path.resolve(rootDir, 'src/domains/stats/background/persistence/statsRetentionJob.js');
const tacticalIntelligenceLoggerPath = path.resolve(rootDir, 'src/domains/tracking/background/TacticalIntelligenceLogger.js');
const clseSchemaPath = path.resolve(rootDir, 'src/domains/behavior/clseSchema.js');
const settingsCommandContractPath = path.resolve(rootDir, 'src/domains/settings/config/settingsCommandContract.js');
const storageKeyRegistryPath = path.resolve(rootDir, 'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js');
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);
const allowedStorageHelperImportFiles = new Set([
  'src/platform/storage/internal/chrome-storage/settingsTransport.js',
  'src/platform/storage/internal/chrome-storage/stores/BootstrapSnapshotStore.js',
  'src/platform/storage/internal/chrome-storage/stores/ClseSettingsStore.js',
  'src/platform/storage/internal/chrome-storage/stores/KeyStore.js',
  'src/platform/storage/internal/chrome-storage/session/SecurityVaultSessionStore.js',
  'src/platform/storage/internal/chrome-storage/stores/ProfileResetLifecycleStore.js',
  'src/platform/storage/internal/chrome-storage/stores/RuntimeLanguageStore.js',
  'src/platform/storage/internal/chrome-storage/stores/RuntimeSessionStore.js',
  'src/platform/storage/internal/chrome-storage/stores/SettingsStore.js',
  'src/platform/storage/internal/chrome-storage/stores/WorkerRuntimeEventStore.js',
  'src/platform/storage/internal/storageSnapshotService.js',
]);
const allowedRawChromeStorageFiles = new Set([
  'src/platform/storage/internal/chrome-storage/localArea.js',
  'src/platform/storage/internal/chrome-storage/sessionArea.js',
]);
const allowedRawChromeStorageChangedFiles = new Set([
  'src/platform/storage/internal/chrome-storage/storageChangeBus.js',
]);
const allowedDbManagerImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/IndexedDbSnapshotRepository.js',
  'src/platform/storage/internal/indexeddb/stores/ClseStore.js',
  'src/platform/storage/internal/indexeddb/stores/EventLogStore.js',
  'src/platform/storage/internal/indexeddb/stores/FaviconStore.js',
  'src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js',
  'src/platform/storage/internal/indexeddb/stores/ModelStateStore.js',
  'src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js',
  'src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js',
  'src/platform/storage/internal/indexeddb/stores/ZenArtifactStore.js',
]);
const forbiddenPatterns = [
  {
    pattern: /ZenClosedDayRecap|ZEN_CLOSED_DAY_RECAP|zen_closed_day_recap|ZenMainPresentationLedger|zen\.main_presentation_ledger/g,
    message: 'release V1 main presentation is current/first_vision only; retired recap snapshot and presentation-ledger owners are forbidden.',
  },
  {
    pattern: /runtime\.(?:current_day|current_hour|flush_cursor)/g,
    message: 'retired stats runtime cursor keys are forbidden; durable stats facts belong to stats_hourly/stats_daily.',
  },
  {
    pattern: /shared\/storage\/DataManager\.js/g,
    message: 'retired DataManager import path is forbidden in active src.',
  },
  {
    pattern: /platform\/storage\/settings\/index\.js/g,
    message: 'retired settings/index.js facade import path is forbidden; use explicit settings service entrypoints.',
  },
  {
    pattern: /domains\/tracking\/background\/StatsCache\.js/g,
    message: 'retired tracking/background StatsCache import path is forbidden; use src/domains/stats/background/runtime/statsRuntimeService.js.',
  },
  {
    pattern: /domains\/tracking\/background\/TickMetricsBackup\.js/g,
    message: 'retired tracking/background TickMetricsBackup import path is forbidden; tick-metrics backup is removed from the active runtime.',
  },
  {
    pattern: /domains\/tracking\/background\/(?:NudgeDebtPersistence|nudgeDebtPersistence)\.js/g,
    message: 'retired nudge debt persistence modules are forbidden; debt is canonical in the nudge session store.',
  },
  {
    pattern: /\b(?:createNudgeDebtPersistenceController|flushNudgeDebtPersistence|hydrateNudgeDebtFromPersistence|scheduleDebtPersistence|debtPersistenceController)\b/g,
    message: 'retired no-op nudge debt persistence controller plumbing is forbidden; mutate canonical session debt directly.',
  },
  {
    pattern: /platform\/storage\/runtime\/cycleLegacyState\.js/g,
    message: 'retired cycleLegacyState import path is forbidden; use cycleStateStorageContracts.js.',
  },
  {
    pattern: /StatsTransitionEdge(?:Store|Repository)\.js|stats_transition_edges|\bSTORES\.STATS_TRANSITION_EDGES\b|\bstatsTransitionEdgeRepository\b|\bstatsTransitionEdges\b|\bgetStatsTransitionEdgesRange\b|\bnormalizeStatsTransitionEdge(?:Id|Increment|Row)\b/g,
    message: 'retired standalone transition-edge storage is forbidden; transition edges belong to canonical stats_hourly/stats_daily aggregates.',
  },
  {
    pattern: /\bmonitor_cycleState\b/g,
    message: 'retired combined cycle state key is forbidden; use monitor_cycleSettings plus runtime.cycle_checkpoint.',
  },
  {
    pattern: /\bMESSAGE_ACTIONS\.(REFRESH_SETTINGS|SETTINGS_UPDATED|SCHEDULE_UPDATED)\b/g,
    message: 'legacy settings propagation aliases are forbidden in active src.',
  },
  {
    pattern: /\bstorageSync(?:Get|Set|Remove)\b/g,
    message: 'retired ChromeService sync-storage compatibility helpers are forbidden in active src.',
  },
];
const storageHelperImportPattern = /import\s*{[^}]*\bstorage(?:Local|Session)(?:Get|Set|Remove)\b[^}]*}\s*from\s*['"][^'"]*shared\/api\/ChromeService\.js['"]/gs;
const sharedStorageImportPattern = /import\s+[^;]+from\s*['"][^'"]*shared\/storage\//g;
const sharedStorageReferencePattern = /['"][^'"]*shared\/storage\//g;
const rawChromeStoragePattern = /\bchrome\.storage\.(?:local|session)\.(?:get|set|remove)\b/g;
const optionalChainChromeStorageAreaPattern = /\bchrome\?\.storage\?\.(?:local|session)\b/g;
const rawChromeStorageChangedPattern = /(?:\.|\?\.)storage(?:\.|\?\.)onChanged\b/g;
const dbManagerImportPattern = /import\s+[^;]+from\s*['"][^'"]*dbManager\.js['"]/g;
const rawIndexedDbGlobalPattern = /\b(?:indexedDB|IDBKeyRange)\b/g;
const automaticIndexedDbDeletePattern = /\bindexedDB\.deleteDatabase\s*\(/g;
const localStorageAccessPattern = /\b(?:window\.)?localStorage(?:\?\.|\.)(?:getItem|setItem|removeItem|clear)\b/g;
const retiredBrowserStorageImportPattern = /['"][^'"]*chrome-storage\/browserStorage\.js['"]/g;
const chromeServiceStorageFacadePattern = /\bexport function storage(?:Local|Session|OnChanged)[A-Za-z]+\b/g;
const themePreferenceMirrorPattern = /\b(?:window\.)?localStorage(?:\?\.|\.)(?:getItem|setItem|removeItem)\(\s*(?:THEME_PREFERENCE_STORAGE_KEY|THEME_STORAGE_KEY|['"]app-theme['"])\s*\)/g;
const modelStateStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*ModelStateStore\.js['"]/g;
const modelStateRepositoryImportPattern = /import\s+[^;]+from\s*['"][^'"]*ModelStateRepository\.js['"]/g;
const faviconStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*FaviconStore\.js['"]/g;
const clseStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*ClseStore\.js['"]/g;
const bootstrapSnapshotStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*BootstrapSnapshotStore\.js['"]/g;
const clseSettingsStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*ClseSettingsStore\.js['"]/g;
const keyStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*KeyStore\.js['"]/g;
const settingsStoreImportPattern = /import\s+[^;]+from\s*['"](?:[^'"]*\/)?SettingsStore\.js['"]/g;
const eventLogStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*EventLogStore\.js['"]/g;
const statsAggregateStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*StatsAggregateStore\.js['"]/g;
const statsFeaturePackStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*StatsFeaturePackStore\.js['"]/g;
const interventionEffectStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*InterventionEffectStore\.js['"]/g;
const runtimeLanguageStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*RuntimeLanguageStore\.js['"]/g;
const workerRuntimeEventStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*WorkerRuntimeEventStore\.js['"]/g;
const settingsPersistenceAdapterImportPattern = /import\s+[^;]+from\s*['"][^'"]*settingsPersistenceAdapter\.js['"]/g;
const settingsTransportImportPattern = /import\s+[^;]+from\s*['"][^'"]*settingsTransport\.js['"]/g;
const storageInspectorQueryServiceImportPattern = /import\s+[^;]+from\s*['"][^'"]*StorageInspectorQueryService\.js['"]/g;
const faviconQueryServiceImportPattern = /import\s+[^;]+from\s*['"][^'"]*(?:shared\/storage\/query|storage\/query)\/FaviconQueryService\.js['"]/g;
const storageSnapshotServiceImportPattern = /import\s+[^;]+from\s*['"][^'"]*storageSnapshotService\.js['"]/g;
const runtimeSessionStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*RuntimeSessionStore\.js['"]/g;
const runtimeFlagStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*RuntimeFlagStore\.js['"]/g;
const nudgeSessionStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*NudgeSessionStore\.js['"]/g;
const zenArtifactStoreImportPattern = /import\s+[^;]+from\s*['"][^'"]*ZenArtifactStore\.js['"]/g;
const zenModelRepositoryPlatformImportPattern = /['"][^'"]*platform\/storage\/themes\/zen\/ZenModelRepository\.js['"]/g;
const zenWorkspacePlatformImportPattern = /['"][^'"]*platform\/storage\/themes\/zen\/ZenWorkspace(?:Storage|Repository)\.js['"]/g;
const zenUiLocalStoragePlatformImportPattern = /['"][^'"]*platform\/storage\/themes\/zen\/ZenUiLocalStorage\.js['"]/g;
const zenThemeModelStatePlatformImportPattern = /['"][^'"]*platform\/storage\/themes\/zen\/ZenThemeModelState\.js['"]/g;
const zenRetiredPageLocalCleanupPlatformImportPattern = /['"][^'"]*platform\/storage\/themes\/zen\/ZenRetiredPageLocalCleanup\.js['"]/g;
const zenMainStorageCompatImportPattern = /['"][^'"]*ZenMainStorage(?:\.js)?['"]/g;
const allowedZenLocalStorageFiles = new Set([
  'src/themes/plugins/zen/state/ZenWorkspaceState.js',
]);
const allowedZenModelRepositoryPlatformImportFiles = new Set([
  'src/themes/plugins/zen/state/ZenModelRepository.js',
]);
const allowedZenWorkspacePlatformImportFiles = new Set([
  'src/themes/plugins/zen/state/ZenWorkspaceState.js',
]);
const allowedZenUiLocalStoragePlatformImportFiles = new Set([
  'src/themes/plugins/zen/state/ZenProductionUiState.js',
]);
const allowedRawLocalStorageAccessFiles = new Set([
  'src/platform/browser/pageLocalStorage.js',
  'src/platform/storage/themes/zen/ZenUiLocalStorage.js',
  'src/platform/storage/themes/zen/ZenWorkspaceStorage.js',
  'src/themes/core/state/themePreferenceMirror.js',
]);
const allowedThemePreferenceMirrorFiles = new Set([
  'src/themes/core/state/themePreferenceMirror.js',
]);
const allowedZenModelStateFiles = new Set([
  'src/themes/plugins/zen/state/ZenThemeModelState.js',
]);
const allowedZenThemeModelStatePlatformImportFiles = new Set([
  'src/themes/plugins/zen/state/ZenThemeModelState.js',
]);
const allowedModelStateRepositoryImportFiles = new Set([
  'src/platform/storage/model/ConsumptionMemoryCheckpointRepository.js',
  'src/apps/background/services/runtime/backgroundKernelCoreServices.js',
  'src/platform/storage/model/FeedTempoProfileCheckpointRepository.js',
  'src/platform/storage/model/FeedTopologyCertificateCheckpointRepository.js',
  'src/platform/storage/themes/zen/ZenModelRepository.js',
  'src/platform/storage/themes/zen/ZenWorkerModelRepository.js',
]);
const allowedFaviconStoreImportFiles = new Set([
  'src/platform/storage/assets/FaviconRepository.js',
]);
const allowedClseStoreImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  'src/platform/storage/clse/ClseRepository.js',
]);
const allowedBootstrapSnapshotStoreImportFiles = new Set([
  'src/platform/storage/bootstrap/BootstrapSnapshotRepository.js',
]);
const allowedClseSettingsStoreImportFiles = new Set([
  'src/platform/storage/clse/ClseSettingsQueryService.js',
]);
const allowedKeyStoreImportFiles = new Set([
  'src/platform/storage/security/KeyMaterialRepository.js',
  'src/platform/storage/settings/SettingsPersistenceAdapter.js',
  'src/platform/storage/internal/storageSnapshotService.js',
]);
const allowedSettingsStoreImportFiles = new Set([
  'src/platform/storage/settings/SettingsDocumentRepository.js',
  'src/platform/storage/settings/SettingsPersistenceAdapter.js',
  'src/platform/storage/internal/storageSnapshotService.js',
  'src/platform/storage/internal/chrome-storage/stores/ClseSettingsStore.js',
  'src/platform/storage/internal/chrome-storage/stores/RuntimeLanguageStore.js',
]);
const allowedEventLogStoreImportFiles = new Set([
  'src/platform/storage/logs/EventLogRepository.js',
  'src/platform/storage/support/StorageInspectorCapability.js',
]);
const allowedStatsAggregateStoreImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/IndexedDbInspector.js',
  'src/platform/storage/stats/StatsAggregateRepository.js',
]);
const allowedStatsFeaturePackStoreImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  'src/platform/storage/stats/StatsFeaturePackRepository.js',
]);
const allowedInterventionEffectStoreImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  'src/platform/storage/stats/InterventionEffectRepository.js',
]);
const allowedRuntimeLanguageStoreImportFiles = new Set([
  'src/platform/storage/settings/RuntimeLanguageRepository.js',
]);
const allowedWorkerRuntimeEventStoreImportFiles = new Set([
  'src/platform/storage/runtime/WorkerRuntimeEventRepository.js',
  'src/platform/storage/runtime/WorkerRuntimeEventCapability.js',
]);
const allowedSettingsPersistenceAdapterImportFiles = new Set([]);
const allowedSettingsTransportImportFiles = new Set([
  'src/platform/storage/settings/SettingsCommandService.js',
  'src/platform/storage/settings/createPlatformSettingsTransport.js',
]);
const allowedStorageInspectorQueryServiceImportFiles = new Set([
  'src/platform/storage/support/StorageInspectorCapability.js',
]);
const allowedStorageSnapshotServiceImportFiles = new Set([
  'src/platform/storage/support/StorageSnapshotCapability.js',
]);
const allowedRuntimeSessionStoreImportFiles = new Set([
  'src/platform/storage/internal/chrome-storage/session/NudgeSessionStore.js',
  'src/platform/storage/internal/chrome-storage/session/RuntimeFlagStore.js',
  'src/platform/storage/runtime/RuntimeSessionRepository.js',
  'src/platform/storage/runtime/NudgeSessionRepository.js',
  'src/platform/storage/runtime/RuntimeFlagRepository.js',
]);
const allowedRuntimeFlagStoreImportFiles = new Set([
  'src/platform/storage/runtime/RuntimeFlagRepository.js',
]);
const allowedNudgeSessionStoreImportFiles = new Set([
  'src/platform/storage/runtime/NudgeSessionRepository.js',
]);
const allowedZenArtifactStoreImportFiles = new Set([
  'src/platform/storage/internal/indexeddb/dbImportSnapshot.js',
  'src/platform/storage/themes/zen/ZenArtifactRepository.js',
]);
const forbiddenFeatureSettingsServiceReferences = Object.freeze([
  {
    file: 'src/domains/nudge/indicator/view.js',
    tokens: [
      'platform/storage/settings/SettingsCommandService.js',
      'platform/storage/settings/SettingsQueryService.js',
      'applySettingsPatchViaRuntime(',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/nudge/behavior/BehaviorHub.js',
    tokens: [
      'platform/storage/settings/SettingsCommandService.js',
      'platform/storage/settings/SettingsQueryService.js',
      'applySettingsPatchViaRuntime(',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/nudge/nudgeSettingsClient.js',
    tokens: [
      'platform/storage/settings/SettingsCommandService.js',
      'platform/storage/settings/SettingsQueryService.js',
      'applySettingsPatchViaRuntime(',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/apps/background/services/boot/BootPrewarmService.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/protection/background/ProtectionDispatcher.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/protection/background/ProtectionRuntimeInputProvider.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/tracking/background/trackingMessagePolicy.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/tracking/background/trackingMessagePolicies/destructiveActionPolicy.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
  {
    file: 'src/domains/behavior/clseSettings.js',
    tokens: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
]);

const fail = (message) => {
  console.error(`[storage-architecture-boundaries] FAIL: ${message}`);
  process.exit(1);
};

const FROZEN_INDEXED_DB_V1_TOPOLOGY_SHA256 = '66b2161275d836abffbd42632ccbd18d9998e1836458e2fff16ce6bc6bfd4f3a';

function normalizeIndexedDbKeyPath(keyPath) {
  return Array.isArray(keyPath) ? [...keyPath] : keyPath;
}

const scanFrozenIndexedDbV1Contract = async () => {
  const stores = new Map();
  const schemaHarness = {
    get objectStoreNames() {
      return Array.from(stores.keys());
    },
    createObjectStore(name, options = {}) {
      if (stores.has(name)) {
        fail(`src/platform/storage/internal/indexeddb/dbSchema.js: duplicate V1 object store ${name}.`);
      }
      const indexes = [];
      stores.set(name, {
        name,
        keyPath: normalizeIndexedDbKeyPath(options.keyPath),
        autoIncrement: options.autoIncrement === true,
        indexes,
      });
      return {
        createIndex(indexName, keyPath, indexOptions = {}) {
          if (indexes.some((index) => index.name === indexName)) {
            fail(`src/platform/storage/internal/indexeddb/dbSchema.js: duplicate V1 index ${name}.${indexName}.`);
          }
          indexes.push({
            name: indexName,
            keyPath: normalizeIndexedDbKeyPath(keyPath),
            unique: indexOptions.unique === true,
            multiEntry: indexOptions.multiEntry === true,
          });
        },
      };
    },
  };
  const { applyIndexedDbV1Schema } = await import(pathToFileURL(indexedDbSchemaPath).href);
  applyIndexedDbV1Schema({ db: schemaHarness });
  const topology = Array.from(stores.values())
    .map((store) => ({
      ...store,
      indexes: [...store.indexes].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const topologyHash = createHash('sha256')
    .update(JSON.stringify(topology))
    .digest('hex');
  if (topologyHash !== FROZEN_INDEXED_DB_V1_TOPOLOGY_SHA256) {
    fail(
      'src/platform/storage/internal/indexeddb/dbSchema.js: release V1 store/index topology is frozen; '
      + `expected ${FROZEN_INDEXED_DB_V1_TOPOLOGY_SHA256}, got ${topologyHash}. `
      + 'A topology change requires a separate V2 architecture decision and versionchange contract.',
    );
  }

  const [schemaSource, managerSource, openFailureSource, eventLogSource] = await Promise.all([
    fs.readFile(indexedDbSchemaPath, 'utf8'),
    fs.readFile(indexedDbManagerPath, 'utf8'),
    fs.readFile(indexedDbOpenFailurePath, 'utf8'),
    fs.readFile(eventLogStorePath, 'utf8'),
  ]);
  [
    'INDEXED_DB_V1_SCHEMA_REQUIRES_FRESH_DATABASE',
    'INDEXED_DB_V1_STORE_SET_MISMATCH',
    'INDEXED_DB_V1_STORE_CONTRACT_MISMATCH:',
    'INDEXED_DB_V1_INDEX_SET_MISMATCH:',
    'INDEXED_DB_V1_INDEX_CONTRACT_MISMATCH:',
  ].forEach((token) => {
    if (!schemaSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbSchema.js: missing exact V1 schema contract token ${token}.`);
    }
  });
  [
    'INDEXED_DB_V1_SCHEMA_MISMATCH_PATTERNS',
    'INDEXED_DB_VERSION_MISMATCH',
    'INDEXED_DB_V1_STORE_SET_MISMATCH',
    'INDEXED_DB_V1_STORE_CONTRACT_MISMATCH:',
    'INDEXED_DB_V1_INDEX_SET_MISMATCH:',
    'INDEXED_DB_V1_INDEX_CONTRACT_MISMATCH:',
    'failure.reason = reason',
    'RESET_FAILURE_DETAIL_KEYS',
  ].forEach((token) => {
    if (!openFailureSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/indexedDbOpenFailure.js: missing reset-required schema token ${token}.`);
    }
  });
  if (!/this\.db\s*=\s*assertIndexedDbV1Schema\(req\.result\);[\s\S]*?catch \(error\)\s*\{[\s\S]*?req\.result\.close\(\);[\s\S]*?failOpen\(buildIndexedDbOpenFailure\(error\)\);/u.test(managerSource)) {
    fail('src/platform/storage/internal/indexeddb/dbManager.js: same-version exact V1 schema failures must close the handle and enter the canonical open-failure classifier.');
  }
  [
    'this.terminalFailure = null',
    'if (this.terminalFailure) throw this.terminalFailure',
    'isIndexedDbReleaseV1ResetRequired(error)',
    'this.terminalFailure = error',
  ].forEach((token) => {
    if (!managerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: reset-required open failures must remain terminal for the manager lifetime (${token}).`);
    }
  });
  [
    'isIndexedDbReleaseV1ResetRequired(error)',
    'this.terminalFailure = error',
    'if (this.terminalFailure) throw this.terminalFailure',
  ].forEach((token) => {
    if (!eventLogSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/EventLogStore.js: reset-required failures must remain terminal (${token}).`);
    }
  });
};

const toProjectRelative = (filePath) => path.relative(rootDir, filePath).replaceAll(path.sep, '/');
const isPlatformStorageInternalFile = (relativePath) => relativePath.startsWith('src/platform/storage/internal/');

async function collectFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'archive') continue;
    const resolved = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(resolved));
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    files.push(resolved);
  }
  return files;
}

const scanStorageSnapshotSecretDocumentPolicy = async () => {
  const [
    snapshotSource,
    registrySource,
    indexedDbSnapshotRepositorySource,
    indexedDbImportSnapshotSource,
    storageSnapshotCapabilitySource,
    keyMaterialContractSource,
    keyStoreSource,
    clseHmacKeySource,
  ] = await Promise.all([
    fs.readFile(storageSnapshotServicePath, 'utf8'),
    fs.readFile(storageSurfaceRegistryPath, 'utf8'),
    fs.readFile(indexedDbSnapshotRepositoryPath, 'utf8'),
    fs.readFile(indexedDbImportSnapshotPath, 'utf8'),
    fs.readFile(storageSnapshotCapabilityPath, 'utf8'),
    fs.readFile(keyMaterialContractPath, 'utf8'),
    fs.readFile(keyStorePath, 'utf8'),
    fs.readFile(clseHmacKeyPath, 'utf8'),
  ]);

  if (!/id:\s*STORAGE_LOCAL_DOC_KEYS\.SECURITY,[\s\S]*?exportPolicy:\s*'include_in_encrypted_storage_snapshot'/u.test(registrySource)) {
    fail('settings.security must be included only inside encrypted storage snapshots.');
  }

  const snapshotRequirements = [
    { pattern: /entropy-encrypted-storage-snapshot/u, message: 'snapshots must use the current encrypted envelope format.' },
    { pattern: /decryptSecurityEnvelope\(snapshot, backupPassphrase, SNAPSHOT_OPTIONS\)/u,
      message: 'snapshot import must authenticate the complete backup before accepting any payload.' },
    { pattern: /indexedDb: preflightIndexedDbV1ImportSnapshot\(payload\.indexedDb\)/u,
      message: 'snapshot import must strictly preflight every IndexedDB store.' },
    { pattern: /await verifySnapshotLogs\(payload\)/u,
      message: 'snapshot export and preflight must authenticate encrypted event logs with the restored keyring.' },
    { pattern: /await eventLogStore\.forceFlush\(\)/u,
      message: 'snapshot export must finish the event log flush and propagate any failure.' },
    { pattern: /export async function preflightStorageSnapshot\(/u,
      message: 'encrypted snapshot preflight must finish password derivation before the destructive lifecycle.' },
    { pattern: /prepareRestoredVault\(payload\.local\.keyring, restorePassphrase\)/u,
      message: 'restore must prepare its explicit local or passphrase key record before mutation.' },
    { pattern: /preparedImports = new WeakMap\(\)/u,
      message: 'decrypted snapshots must remain ephemeral and cannot cross the runtime response boundary.' },
    { pattern: /preparedImports\.delete\(preparedImport\)/u,
      message: 'prepared imports must be one-shot capabilities.' },
    { pattern: /STORAGE_SNAPSHOT_IMPORT_MODE_INVALID/u,
      message: 'restore must reject merge mode, which would mix incompatible log keys.' },
    { pattern: /requireCanonicalSecurityKeyring/u, message: 'snapshot keys must satisfy the exact current keyring contract.' },
  ];

  snapshotRequirements.forEach(({ pattern, message }) => {
    if (!pattern.test(snapshotSource)) {
      fail(message);
    }
  });

  if (/forceFlush\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/u.test(snapshotSource)) {
    fail('storage snapshot forceFlush failures must not be swallowed with an empty catch.');
  }
  if (/forceFlushEventLogs\(eventLogStore,\s*'import'\)/u.test(snapshotSource)) {
    fail('storage snapshot import must consume the already-quiesced event-log store instead of force-flushing inside the backend mutation.');
  }

  [
    'requireCanonicalLogCryptoJwk',
    'requireCanonicalDomainHmacSecret',
    'requireCanonicalClseHmacJwk',
    'requireCanonicalSecurityKeyring',
  ].forEach((token) => {
    if (!keyMaterialContractSource.includes(token)) {
      fail(`src/platform/storage/security/keyMaterialContract.js: missing exact key-material contract ${token}.`);
    }
  });
  [
    'requireSecurityKeyRecord',
    'RETIRED_PLAINTEXT_KEY_STORAGE_KEYS',
    'readVaultState',
    'replaceVault',
  ].forEach((token) => {
    if (!keyStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/chrome-storage/stores/KeyStore.js: missing current-key-record owner boundary ${token}.`);
    }
  });
  if (/getLogCryptoJwk|setLogCryptoJwk|getDomainHmacSecret|setDomainHmacSecret/u.test(keyStoreSource)) {
    fail('persistent KeyStore must never expose plaintext-key read/write methods.');
  }
  if (/includeSecrets|importSecrets|migrateNotificationsConfigV1|migrateProgressionState/u.test(snapshotSource)) {
    fail('storage snapshots must reject plaintext/portable/legacy paths instead of retaining migration fallbacks.');
  }
  [
    '[CLSE:HMAC] Failed to get/create secret:',
    '[CLSE:HMAC] Signing failed:',
  ].forEach((token) => {
    if (clseHmacKeySource.includes(token)) {
      fail(`src/domains/behavior/utils/hmacKey.js: persisted key/signing failure must propagate instead of using silent-null path ${token}.`);
    }
  });

  [
    'IndexedDbSnapshotRepository',
    'exportSnapshot(',
    'importSnapshot(',
    'targetProfileEpoch',
    'targetProfileAggregate',
    'STORAGE_SNAPSHOT_TARGET_PROFILE_AGGREGATE_INVALID',
  ].forEach((token) => {
    if (!snapshotSource.includes(token)) {
      fail(`src/platform/storage/internal/storageSnapshotService.js: missing IndexedDB snapshot repository token ${token}.`);
    }
  });
  if (snapshotSource.includes('indexeddb/dbManager.js')) {
    fail('src/platform/storage/internal/storageSnapshotService.js: snapshot import/export must use IndexedDbSnapshotRepository, not dbManager.');
  }
  [
    'STORAGE_SNAPSHOT_CAPABILITY_EXPORT_OWNER_REQUIRED',
    'STORAGE_SNAPSHOT_CAPABILITY_IMPORT_OWNER_REQUIRED',
    'STORAGE_SNAPSHOT_CAPABILITY_PREFLIGHT_OWNER_REQUIRED',
    'STORAGE_SNAPSHOT_CAPABILITY_FORMAT_OWNER_REQUIRED',
    'storageSnapshotService.exportStorageSnapshot',
    'storageSnapshotService.importStorageSnapshot',
    'storageSnapshotService.preflightStorageSnapshot',
    'storageSnapshotService.getStorageSnapshotFormat',
  ].forEach((token) => {
    if (!storageSnapshotCapabilitySource.includes(token)) {
      fail(`src/platform/storage/support/StorageSnapshotCapability.js: missing snapshot capability owner token ${token}.`);
    }
  });
  [
    'async () => ({})',
    '() => ({ format: null, formatVersion: null })',
    "typeof storageSnapshotService.exportStorageSnapshot === 'function'",
    "typeof storageSnapshotService.importStorageSnapshot === 'function'",
    "typeof storageSnapshotService.getStorageSnapshotFormat === 'function'",
  ].forEach((token) => {
    if (storageSnapshotCapabilitySource.includes(token)) {
      fail(`src/platform/storage/support/StorageSnapshotCapability.js: snapshot capability must require service owners instead of fallback token ${token}.`);
    }
  });

  [
    'EXPORT_STORE_NAMES',
    'ClseRepository',
    'preflightIndexedDbV1ImportSnapshot',
    'runSnapshotEpochOperation',
    'snapshot.clseBaseline.length === 1',
    'tx.objectStore(STORES.CLSE_AGGRESSION_LOGS).clear()',
    'getStoreCounts()',
    'INDEXED_DB_STORE_COUNT_FAILED',
    'exportSnapshot()',
    'importSnapshot(json',
    'getDatabase()',
    'MODEL_STATE_PROFILE_EPOCH_ROW_KEY',
    'createModelStateProfileEpoch(resolvedTargetProfileEpoch)',
    'rebaseImportedModelStateRows(',
    'INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_MISSING',
    'INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_EPOCH_MISMATCH',
    'INDEXED_DB_SNAPSHOT_MODEL_STATE_PROFILE_AGGREGATE_MISSING',
    'INDEXED_DB_SNAPSHOT_MODEL_STATE_PRIMARY_KEY_DUPLICATE',
    'INDEXED_DB_SNAPSHOT_MODEL_STATE_PREPARED_AGGREGATE_FORBIDDEN',
    'INDEXED_DB_SNAPSHOT_TARGET_PROFILE_AGGREGATE_REQUIRED',
    'INDEXED_DB_SNAPSHOT_TARGET_PROFILE_AGGREGATE_EPOCH_MISMATCH',
    'inspectPersistedModelStateRows',
    'isModelStateDiscardableCacheKey',
    'rebaseModelStateSnapshotValue(',
    'readModelStateSnapshotProfileEpoch(',
    'INDEXED_DB_SNAPSHOT_FEED_TEMPO_PROFILE_EPOCH_MISMATCH',
    'const rowsRequest = modelStateStore.getAll()',
    'modelStateStore.delete(key)',
    'targetProfileAggregateRow',
  ].forEach((token) => {
    if (!indexedDbSnapshotRepositorySource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/IndexedDbSnapshotRepository.js: missing snapshot owner token ${token}.`);
    }
  });
  [
    'createImportFieldSpec',
    'EXPORT_STORE_TO_FIELD',
    'INDEXED_DB_SNAPSHOT_FIELD_MAPPING_MISSING',
    'getIndexedDbV1StoreKeyPath',
    'INDEXED_DB_SNAPSHOT_PRIMARY_KEY_DUPLICATE',
    'STORES.LOGS',
    'statsHourly',
    'statsDaily',
    'statsFeaturePackDaily',
    'STORES.INTERVENTION_EXPOSURES',
    'STORES.INTERVENTION_EFFECT_DAILY',
    'STORES.FAVICONS',
    'STORES.MODEL_STATE',
    'STORES.ZEN_ARTIFACTS',
    'STORES.CLSE_BUCKETS_60S',
    'STORES.CLSE_BUCKETS_5MIN',
    'STORES.CLSE_LOOP_EVENTS',
    'STORES.CLSE_BASELINE',
    'STORES.CLSE_AGGRESSION_LOGS',
    'STORES.CLSE_DAILY_SUMMARIES',
    'requireCanonicalClseEpochRelation',
    'INDEXED_DB_SNAPSHOT_CLSE_BASELINE_CARDINALITY_INVALID',
    'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_BASELINE_REQUIRED',
    'INDEXED_DB_SNAPSHOT_CLSE_AGGRESSION_RESET_EPOCH_MISMATCH',
  ].forEach((token) => {
    if (!indexedDbImportSnapshotSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbImportSnapshot.js: missing exact V1 snapshot preflight token ${token}.`);
    }
  });
};

const scanStorageRetentionPolicy = async () => {
  const [
    policySource,
    registrySource,
    coreServicesSource,
    retentionJobSource,
    tacticalLoggerSource,
    clseSchemaSource,
  ] = await Promise.all([
    fs.readFile(storageRetentionPolicyPath, 'utf8'),
    fs.readFile(storageSurfaceRegistryPath, 'utf8'),
    fs.readFile(backgroundKernelCoreServicesPath, 'utf8'),
    fs.readFile(statsRetentionJobPath, 'utf8'),
    fs.readFile(tacticalIntelligenceLoggerPath, 'utf8'),
    fs.readFile(clseSchemaPath, 'utf8'),
  ]);

  const requirements = [
    {
      source: policySource,
      pattern: /USAGE_LOGS:\s*7/u,
      message: 'usage_logs retention must remain explicitly set to 7 days.',
    },
    {
      source: policySource,
      pattern: /CLSE_DIAGNOSTICS:\s*14/u,
      message: 'CLSE diagnostic retention must remain explicitly set to 14 days.',
    },
    {
      source: policySource,
      pattern: /CLSE_60S_BUCKETS:\s*14/u,
      message: 'CLSE 60-second bucket retention must remain explicitly set to 14 days.',
    },
    {
      source: policySource,
      pattern: /CLSE_5MIN_BUCKETS:\s*90/u,
      message: 'CLSE 5-minute bucket retention must remain explicitly set to 90 days.',
    },
    {
      source: policySource,
      pattern: /CLSE_DAILY_SUMMARIES:\s*365/u,
      message: 'CLSE daily summary retention must remain explicitly set to 365 days.',
    },
    {
      source: policySource,
      pattern: /INTERVENTION_EXPOSURES:\s*30/u,
      message: 'intervention exposure retention must remain explicitly set to 30 days.',
    },
    {
      source: policySource,
      pattern: /INTERVENTION_EFFECT_DAILY:\s*365/u,
      message: 'intervention effect retention must remain explicitly set to 365 days.',
    },
    {
      source: policySource,
      pattern: /STATS_FEATURE_PACK_DAILY:\s*STATS_RANGE_MAX_DAYS/u,
      message: 'dormant stats feature-pack retention must stay bounded by the canonical source-fact horizon.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.USAGE_LOGS/u,
      message: 'storage surface registry must describe usage_logs retention through the canonical retention policy.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.CLSE_DIAGNOSTICS/u,
      message: 'storage surface registry must describe CLSE retention through the canonical retention policy.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.STATS_FEATURE_PACK_DAILY/u,
      message: 'storage surface registry must describe stats feature pack retention through the canonical retention policy.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.INTERVENTION_EXPOSURES/u,
      message: 'storage surface registry must describe intervention exposure retention through the canonical retention policy.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.INTERVENTION_EFFECT_DAILY/u,
      message: 'storage surface registry must describe intervention effect retention through the canonical retention policy.',
    },
    {
      source: registrySource,
      pattern: /STORAGE_RETENTION_DAYS\.CLSE_DAILY_SUMMARIES/u,
      message: 'storage surface registry must describe CLSE daily summary retention through the canonical retention policy.',
    },
    {
      source: coreServicesSource,
      pattern: /createBackgroundStorageRetentionTasks/u,
      message: 'background core services must expose the named storage retention task seam.',
    },
    {
      source: coreServicesSource,
      pattern: /clseRepository\.pruneTiers\(\{/u,
      message: 'background retention tasks must prune CLSE tier owners on the canonical retention clock.',
    },
    {
      source: coreServicesSource,
      pattern: /statsFeaturePackRepository\.pruneBefore\(resolveRetentionCutoffDateStr/u,
      message: 'background retention tasks must prune stats feature packs on the canonical retention clock.',
    },
    {
      source: coreServicesSource,
      pattern: /interventionEffectRepository\.pruneExposuresBefore\(resolveRetentionCutoffTimestamp/u,
      message: 'background retention tasks must prune intervention exposures on the canonical retention clock.',
    },
    {
      source: coreServicesSource,
      pattern: /interventionEffectRepository\.pruneEffectsBefore\(resolveRetentionCutoffDateStr/u,
      message: 'background retention tasks must prune intervention effect aggregates on the canonical retention clock.',
    },
    {
      source: retentionJobSource,
      pattern: /cleanupOldStatsDays\(maxDays,\s*\{\s*now:\s*nowTs\s*\}\)/u,
      message: 'stats retention cleanup must use the retention job clock.',
    },
    {
      source: tacticalLoggerSource,
      pattern: /STORAGE_RETENTION_DAYS\.USAGE_LOGS/u,
      message: 'tactical event log cleanup must use canonical usage log retention days.',
    },
    {
      source: clseSchemaSource,
      pattern: /RETENTION_DAYS:\s*STORAGE_RETENTION_DAYS\.CLSE_DIAGNOSTICS/u,
      message: 'CLSE runtime retention must stay aligned with canonical storage retention policy.',
    },
    {
      source: clseSchemaSource,
      pattern: /RETENTION_DAILY_SUMMARY_DAYS:\s*STORAGE_RETENTION_DAYS\.CLSE_DAILY_SUMMARIES/u,
      message: 'CLSE daily summary retention must stay aligned with canonical storage retention policy.',
    },
  ];

  requirements.forEach(({ source, pattern, message }) => {
    if (!pattern.test(source)) {
      fail(message);
    }
  });
  if (
    /typeof\s+clseRepository\.pruneTiers\s*===\s*['"]function['"]/u.test(coreServicesSource)
    || /clseRepository\.pruneBefore\(/u.test(coreServicesSource)
  ) {
    fail('background retention tasks must not fall back from tiered CLSE retention to a broad prune owner.');
  }
};

const scanFeedTempoCheckpointStorageBoundary = async () => {
  const [
    contractSource,
    repositorySource,
    snapshotContractSource,
    persistenceServiceSource,
    persistenceClientSource,
    runtimeSource,
  ] = await Promise.all([
    fs.readFile(feedTempoCheckpointContractPath, 'utf8'),
    fs.readFile(feedTempoCheckpointRepositoryPath, 'utf8'),
    fs.readFile(modelStateSnapshotContractPath, 'utf8'),
    fs.readFile(feedTempoPersistenceServicePath, 'utf8'),
    fs.readFile(feedTempoPersistenceClientPath, 'utf8'),
    fs.readFile(feedTempoRuntimePath, 'utf8'),
  ]);

  [
    "FEED_TEMPO_PROFILE_CHECKPOINT_KEY = (",
    "'feed_tempo_adaptive_profile_checkpoint_v1'",
    'FEED_TEMPO_PROFILE_CHECKPOINT_SCHEMA_VERSION = 2',
    "FEED_TEMPO_PROFILE_PERSISTENCE = 'indexeddb_checkpoint'",
    "'profileEpoch'",
    "'stateRevision'",
    'requireFeedTempoProfileCheckpoint(value',
    'rebaseFeedTempoProfileCheckpoint(',
  ].forEach((token) => {
    if (!contractSource.includes(token)) {
      fail(`FeedTempo checkpoint contract is missing current-only token ${token}.`);
    }
  });
  [
    'ModelStateRepository',
    'getEntryWithProfileEpoch',
    'compareAndSetValueWithProfileEpoch',
    'FEED_TEMPO_PROFILE_CHECKPOINT_KEY',
    'expectedProfileEpoch',
    'expectedRevision',
    'FEED_TEMPO_CHECKPOINT_NEXT_REVISION_INVALID',
    'FEED_TEMPO_CHECKPOINT_HISTORY_ADMISSION_REQUIRED',
    'assertCommitAllowed',
  ].forEach((token) => {
    if (!repositorySource.includes(token)) {
      fail(`FeedTempo checkpoint repository is missing typed model-state token ${token}.`);
    }
  });
  [
    'isFeedTempoProfileCheckpointKey(key)',
    'requireFeedTempoProfileCheckpoint(value)',
    'rebaseFeedTempoProfileCheckpoint(value, targetProfileEpoch)',
    'readModelStateSnapshotProfileEpoch(key, value)',
  ].forEach((token) => {
    if (!snapshotContractSource.includes(token)) {
      fail(`ModelState snapshot router is missing FeedTempo token ${token}.`);
    }
  });
  [
    'resolveProfileResetGeneration(lifecycle)',
    'this._assertWriteAdmission({ expectedResetId: profileEpoch })',
    'this._readCheckpoint({ profileEpoch })',
    'this._compareAndSetCheckpoint({',
    'FEED_TEMPO_PERSISTED_CHECKPOINT_CONFLICT_EXHAUSTED',
    'FEED_TEMPO_HISTORY_ADMISSION_OWNER_REQUIRED',
    'await admission.assertCurrent()',
    'assertCommitAllowed: admission.assertCommitAllowed',
    'requireAdmission: true',
  ].forEach((token) => {
    if (!persistenceServiceSource.includes(token)) {
      fail(`FeedTempo persistence service is missing epoch-fenced CAS token ${token}.`);
    }
  });
  [
    [persistenceClientSource, 'FeedTempoPersistenceClient'],
    [runtimeSource, 'FeedTempoRuntime'],
  ].forEach(([source, label]) => {
    [
      'indexedDB',
      'chrome.storage',
      'localStorage',
      'session_memory',
    ].forEach((token) => {
      if (source.includes(token)) {
        fail(`${label} must not contain a content-side checkpoint fallback token ${token}.`);
      }
    });
  });
};

const scanFeedTopologyCertificateStorageBoundary = async () => {
  const [
    contractSource,
    repositorySource,
    snapshotContractSource,
    persistenceServiceSource,
    persistenceClientSource,
    certificationRuntimeSource,
  ] = await Promise.all([
    fs.readFile(feedTopologyCheckpointContractPath, 'utf8'),
    fs.readFile(feedTopologyCheckpointRepositoryPath, 'utf8'),
    fs.readFile(modelStateSnapshotContractPath, 'utf8'),
    fs.readFile(feedTopologyPersistenceServicePath, 'utf8'),
    fs.readFile(feedTopologyPersistenceClientPath, 'utf8'),
    fs.readFile(feedTopologyCertificationRuntimePath, 'utf8'),
  ]);

  [
    "FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY = (",
    "'feed_topology_certificate_checkpoint_v1'",
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_SCHEMA_VERSION = 1',
    "FEED_TOPOLOGY_CERTIFICATE_PERSISTENCE = 'indexeddb_checkpoint'",
    'evidenceHalfLifeMs: 14 * 24 * 60 * 60 * 1000',
    'certificateTtlMs: 30 * 24 * 60 * 60 * 1000',
    'minimumObservationCount: 3',
    'minimumObservationDayCount: 2',
    'minimumEffectiveEvidence: 2.4',
    "'profileEpoch'",
    "'stateRevision'",
    'requireFeedTopologyCertificateCheckpoint(',
    'rebaseFeedTopologyCertificateCheckpoint(',
  ].forEach((token) => {
    if (!contractSource.includes(token)) {
      fail(`Feed topology certificate contract is missing current-only token ${token}.`);
    }
  });
  [
    'ModelStateRepository',
    'getEntryWithProfileEpoch',
    'compareAndSetValueWithProfileEpoch',
    'FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY',
    'expectedProfileEpoch',
    'expectedRevision',
    'FEED_TOPOLOGY_CERTIFICATE_NEXT_REVISION_INVALID',
  ].forEach((token) => {
    if (!repositorySource.includes(token)) {
      fail(`Feed topology certificate repository is missing typed model-state token ${token}.`);
    }
  });
  [
    'isFeedTopologyCertificateCheckpointKey(key)',
    'requireFeedTopologyCertificateCheckpoint(value)',
    'rebaseFeedTopologyCertificateCheckpoint(value, targetProfileEpoch)',
    'readModelStateSnapshotProfileEpoch(key, value)',
  ].forEach((token) => {
    if (!snapshotContractSource.includes(token)) {
      fail(`ModelState snapshot router is missing feed topology token ${token}.`);
    }
  });
  [
    'resolveProfileResetGeneration(lifecycle)',
    'this._assertWriteAdmission({ expectedResetId: profileEpoch })',
    'this._readCheckpoint({ profileEpoch })',
    'this._compareAndSetCheckpoint({',
    'FEED_TOPOLOGY_PERSISTED_CERTIFICATE_CONFLICT_EXHAUSTED',
  ].forEach((token) => {
    if (!persistenceServiceSource.includes(token)) {
      fail(`Feed topology persistence service is missing epoch-fenced CAS token ${token}.`);
    }
  });
  [
    [persistenceClientSource, 'FeedTopologyPersistenceClient'],
    [certificationRuntimeSource, 'FeedTopologyCertificationRuntime'],
  ].forEach(([source, label]) => {
    [
      'indexedDB',
      'chrome.storage',
      'localStorage',
      'session_memory',
    ].forEach((token) => {
      if (source.includes(token)) {
        fail(`${label} must not contain a content-side certificate fallback token ${token}.`);
      }
    });
  });
};

async function checkWorkerRuntimeEventOwnership() {
  const owners = [
    ['src/platform/storage/runtime/WorkerRuntimeEventRepository.js', [
      "WORKER_RUNTIME_EVENT_MESSAGE_TYPE = 'WORKER_RUNTIME_EVENT_CACHE'",
      'configureWorkerRuntimeEventPersistencePort(port)',
      'captureWriteAdmission()',
      'this.profileGenerationPromise',
      'WORKER_RUNTIME_EVENTS_ACK_GENERATION_MISMATCH',
      'structuredClone(requireWorkerRuntimeEvents(',
    ], ['new WorkerRuntimeEventStore(', 'WorkerRuntimeEventStore.getInstance(']],
    ['src/platform/storage/runtime/WorkerRuntimeEventCapability.js', [
      'createWorkerRuntimeEventCapability(',
      'runtimeAdmissionGate.runAdmitted(',
      'lifecycleRepository.assertWriteAdmission({ expectedResetId: generation })',
      'WORKER_RUNTIME_EVENTS_PROFILE_GENERATION_STALE',
      'workerRuntimeEventStore.quiesceForProfileMutation()',
      'workerRuntimeEventStore.clearForProfileMutation()',
      'Promise.allSettled(',
    ], ['resumeAfterProfileMutation', 'writeChromeStorageLocal']],
    ['src/platform/storage/internal/chrome-storage/stores/WorkerRuntimeEventStore.js', [
      'this.operationTail',
      'this.writeAdmissionOpen = false',
      'WORKER_RUNTIME_EVENTS_WRITE_ADMISSION_CLOSED',
      'async clearForProfileMutation()',
      'WORKER_RUNTIME_EVENTS_CLEAR_REQUIRES_QUIESCE',
    ], ['resumeAfterProfileMutation']],
    ['src/platform/workers/runtime/WorkerTelemetry.js', [
      'persistedEventStore.captureWriteAdmission()',
      'persistenceAdmissionOpen = false',
      'clearTimeout(pendingPersistTimerId)',
      'await persistenceTail',
      'quiesceWorkerRuntimeTelemetryForProfileMutation',
    ], ['writeChromeStorageLocal', 'WorkerRuntimeEventStore.getInstance(']],
    ['src/apps/background/services/runtime/messageRoutes/workerRuntimeEventMessageRoutes.js', [
      'WORKER_RUNTIME_EVENT_MESSAGE_TYPE',
      'isTrustedExtensionPageSender(sender)',
      'WORKER_RUNTIME_EVENTS_UNTRUSTED_SENDER',
      'workerRuntimeEventCapability.handleAdmittedRequest(message)',
    ], ['writeChromeStorageLocal']],
  ];
  await Promise.all(owners.map(async ([ownerPath, required, prohibited]) => {
    const source = await fs.readFile(path.resolve(rootDir, ownerPath), 'utf8');
    required.forEach((token) => {
      if (!source.includes(token)) fail(`${ownerPath}: worker-event ownership is missing ${token}.`);
    });
    prohibited.forEach((token) => {
      if (source.includes(token)) fail(`${ownerPath}: worker-event ownership forbids ${token}.`);
    });
  }));
}

const main = async () => {
  await checkWorkerRuntimeEventOwnership();
  const platformStorageAssetEntries = await fs.readdir(platformStorageAssetsDir);
  if (platformStorageAssetEntries.includes('faviconQuery.js')) {
    fail('lowercase faviconQuery.js duplicate must not exist beside canonical FaviconQueryService.js.');
  }

  const [settingsCommandContract, storageKeyRegistry] = await Promise.all([
    import(pathToFileURL(settingsCommandContractPath).href),
    import(pathToFileURL(storageKeyRegistryPath).href),
  ]);
  const registeredSettingsKeys = Object.keys(
    settingsCommandContract.SETTINGS_KEY_COMMAND_CONTRACTS || {},
  ).sort();
  const canonicalSettingsKeys = [
    ...(storageKeyRegistry.KNOWN_FLAT_SETTING_KEYS || []),
  ].sort();
  if (
    registeredSettingsKeys.length !== canonicalSettingsKeys.length
    || registeredSettingsKeys.some((key, index) => key !== canonicalSettingsKeys[index])
  ) {
    fail('settingsCommandContract.js must cover every canonical flat settings key exactly once.');
  }

  try {
    await fs.access(retiredDataManagerPath);
    fail('retired DataManager file must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredSharedStorageDir);
    fail('legacy shared/storage directory must not exist.');
  } catch (_error) {
    // Expected: directory is gone.
  }

  try {
    await fs.access(retiredStatsCachePath);
    fail('retired tracking/background StatsCache module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredTrackingTickMetricsBackupPath);
    fail('retired tracking/background TickMetricsBackup module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredStatsTickMetricsBackupPath);
    fail('retired stats tickMetricsBackupService module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredBehaviorMetricsCollectorPath);
    fail('retired write-only behaviorMetricsCollector module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredBackgroundKernelTickBufferPath);
    fail('retired backgroundKernelTickBuffer helper must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  for (const retiredPath of retiredTrackingNudgeDebtPersistencePaths) {
    try {
      await fs.access(retiredPath);
      fail(`retired nudge debt persistence module must not exist: ${toProjectRelative(retiredPath)}`);
    } catch (_error) {
      // Expected: file is gone.
    }
  }

  try {
    await fs.access(retiredVideoSkipPoolStoragePath);
    fail('retired domain-owned video-skip PoolStorage module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredScheduleEnvironmentPath);
    fail('retired dashboard-owned schedule geo cache hook must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredBrowserStoragePath);
    fail('retired mixed browserStorage compatibility module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredChromeStorageValueUtilsPath);
    fail('pure storage value utilities must not live under the Chrome-storage backend.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredZenMainStoragePath);
    fail('retired ZenMainStorage compatibility facade must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  try {
    await fs.access(retiredCycleLegacyStatePath);
    fail('retired cycleLegacyState compatibility module must not exist.');
  } catch (_error) {
    // Expected: file is gone.
  }

  for (const [retiredPath, label] of [
    [retiredSettingsOwnerAcknowledgementPath, 'transport-owned settings owner ACK schema'],
    [retiredSecuritySettingsMutationSchemaPath, 'duplicate security settings mutation schema'],
  ]) {
    try {
      await fs.access(retiredPath);
      fail(`retired ${label} module must not exist.`);
    } catch (_error) {
      // Expected: file is gone.
    }
  }

  for (const [retiredPath, label] of [
    [retiredStatsTransitionEdgeStorePath, 'StatsTransitionEdgeStore'],
    [retiredStatsTransitionEdgeRepositoryPath, 'StatsTransitionEdgeRepository'],
  ]) {
    try {
      await fs.access(retiredPath);
      fail(`retired ${label} module must not exist.`);
    } catch (_error) {
      // Expected: file is gone.
    }
  }

  const backgroundMaintenanceCoordinatorSource = await fs.readFile(backgroundMaintenanceCoordinatorPath, 'utf8');
  const profileResetLifecycleRepositorySource = await fs.readFile(profileResetLifecycleRepositoryPath, 'utf8');
  const profileResetLifecycleStoreSource = await fs.readFile(profileResetLifecycleStorePath, 'utf8');
  const profileMutationCoordinatorSource = await fs.readFile(profileMutationCoordinatorPath, 'utf8');
  const profileMutationRuntimeGateSource = await fs.readFile(profileMutationRuntimeGatePath, 'utf8');
  const profileMutationBindingsSource = await fs.readFile(profileMutationBindingsPath, 'utf8');
  const profileMutationControlBindingsSource = await fs.readFile(
    profileMutationControlBindingsPath,
    'utf8',
  );
  const profileMutationRuntimeLifetimePortSource = await fs.readFile(
    profileMutationRuntimeLifetimePortPath,
    'utf8',
  );
  const profileMutationResponseHandoffSource = await fs.readFile(
    profileMutationResponseHandoffPath,
    'utf8',
  );
  const profileMutationResponseAckClientSource = await fs.readFile(
    profileMutationResponseAckClientPath,
    'utf8',
  );
  const storageSupportHandlersSource = await fs.readFile(storageSupportHandlersPath, 'utf8');
  const zenThemeModelStateSource = await fs.readFile(zenThemeModelStatePath, 'utf8');
  const zenThemeProfileGenerationLeaseSource = await fs.readFile(
    zenThemeProfileGenerationLeasePath,
    'utf8',
  );
  const zenThemeLifecycleProfileGenerationLeaseSource = await fs.readFile(
    zenThemeLifecycleProfileGenerationLeasePath,
    'utf8',
  );
  const zenModelRepositoryCoreSource = await fs.readFile(zenModelRepositoryCorePath, 'utf8');
  const zenModelRepositorySource = await fs.readFile(zenModelRepositoryPath, 'utf8');
  const zenWorkerModelRepositorySource = await fs.readFile(zenWorkerModelRepositoryPath, 'utf8');
  const zenAbTrialEvaluatorWorkerSource = await fs.readFile(zenAbTrialEvaluatorWorkerPath, 'utf8');
  const zenLatentOptimizerWorkerSource = await fs.readFile(zenLatentOptimizerWorkerPath, 'utf8');
  const zenArtifactRepositorySource = await fs.readFile(zenArtifactRepositoryPath, 'utf8');
  const bonsaiRepositorySource = await fs.readFile(bonsaiRepositoryPath, 'utf8');
  const zenBonsaiPreviewRuntimeSource = await fs.readFile(zenBonsaiPreviewRuntimePath, 'utf8');
  const backgroundStorageSnapshotServiceSource = await fs.readFile(backgroundStorageSnapshotServicePath, 'utf8');
  const storageInspectorCapabilitySource = await fs.readFile(storageInspectorCapabilityPath, 'utf8');
  const indexedDbInspectorSource = await fs.readFile(indexedDbInspectorPath, 'utf8');
  const indexedDbManagerSource = await fs.readFile(indexedDbManagerPath, 'utf8');
  [
    "PROFILE_RESET_LIFECYCLE_CONTRACT = 'profile_reset_lifecycle_v1'",
    "RESETTING: 'resetting'",
    "COMMITTED: 'committed'",
    "COMPLETE: 'complete'",
    "FAILED: 'failed'",
    'PROFILE_RESET_WRITE_ADMISSION_CLOSED',
    'PROFILE_RESET_GENERATION_STALE',
    'async assertWriteAdmission({ expectedResetId = null } = {})',
    'recoverInterruptedReset({',
    'const lifecycleWriteAttempts = new WeakMap()',
    'getProfileResetLifecycleWriteAttempt(error, repository)',
    'owned.repository !== repository',
    'EXACT_LIFECYCLE_KEYS.every((key) => left[key] === right[key])',
    'PROFILE_RESET_LIFECYCLE_WRITE_ATTEMPT_REQUIRED',
    'PROFILE_RESET_LIFECYCLE_WRITE_ATTEMPT_STALE',
    'subscribe(listener)',
  ].forEach((token) => {
    if (!profileResetLifecycleRepositorySource.includes(token)) {
      fail(`profile reset lifecycle fence is missing required contract token ${token}.`);
    }
  });
  const assertLifecycleTokenOrder = (source, tokens, label) => {
    let previousIndex = -1;
    for (const token of tokens) {
      const tokenIndex = source.indexOf(token);
      if (tokenIndex <= previousIndex) fail(`${label}: required ordered step ${token}.`);
      previousIndex = tokenIndex;
    }
  };
  const initialLifecycleWriteOwner = profileResetLifecycleRepositorySource.match(
    /async function writeInitialResetLifecycle\([\s\S]*?\n}/,
  );
  if (!initialLifecycleWriteOwner) fail('initial lifecycle write must have a repository-owned failure receipt seam.');
  assertLifecycleTokenOrder(initialLifecycleWriteOwner[0], [
    'await repository.lifecycleStore.write(next)',
    'catch (cause)',
    'lifecycleWriteAttempts.set(error,',
    'attempt: Object.freeze({ lifecycle: next, previousLifecycle })',
    'throw error',
  ], 'initial lifecycle failure receipts must follow an actual write rejection and preserve the original error');
  for (const method of ['beginReset', 'recoverInterruptedReset']) {
    const owner = profileResetLifecycleRepositorySource.match(
      new RegExp(`  ${method}\\([\\s\\S]*?\\n  }\\r?\\n`),
    );
    if (!owner || !owner[0].includes('return writeInitialResetLifecycle(this, next, current);')) {
      fail(`lifecycle ${method} must use the same initial-write receipt owner.`);
    }
  }
  const failedLifecycleWriteOwner = profileResetLifecycleRepositorySource.match(
    /  failResetWriteAttempt\([\s\S]*?\n  }/,
  );
  if (!failedLifecycleWriteOwner) fail('initial lifecycle write failure must expose its typed reconciliation owner.');
  assertLifecycleTokenOrder(failedLifecycleWriteOwner[0], [
    'return this.enqueueMutation(',
    'lifecycleWriteAttempts.get(error)',
    'ownedAttempt.repository !== this',
    'lifecycleWriteAttempts.delete(error)',
    'const current = await this.read()',
    'PROFILE_RESET_LIFECYCLE_WRITE_ATTEMPT_STALE',
    'status: PROFILE_RESET_LIFECYCLE_STATUS.FAILED',
    'await this.lifecycleStore.write(failed)',
    'return failed',
  ], 'failure-fence reconciliation must consume its own receipt and re-read canonical truth before acknowledging FAILED');
  if (!/!areLifecycleStatesEqual\(current, attempted\)\s*&&\s*!areLifecycleStatesEqual\(current, previousLifecycle\)/.test(failedLifecycleWriteOwner[0])) {
    fail('initial-write reconciliation may replace only the exact attempted or exact prior lifecycle journal.');
  }
  [
    'readChromeStorageLocal',
    'writeChromeStorageLocal',
    'STORAGE_LOCAL_STATE_KEYS.PROFILE_RESET_LIFECYCLE',
    'this.readLocal([PROFILE_RESET_LIFECYCLE_STORAGE_KEY])',
    'Object.prototype.hasOwnProperty.call(result, PROFILE_RESET_LIFECYCLE_STORAGE_KEY)',
    '{ found: true, value: result[PROFILE_RESET_LIFECYCLE_STORAGE_KEY] }',
    '{ found: false, value: undefined }',
  ].forEach((token) => {
    if (!profileResetLifecycleStoreSource.includes(token)) {
      fail(`durable profile reset lifecycle store is missing required token ${token}.`);
    }
  });
  [
    'runExclusiveMutation',
    'runStableRead',
    'PROFILE_MUTATION_QUIESCE_FAILED',
    'recoverInterruptedReset',
    'lifecycleRepository.commitReset({',
    'lifecycleRepository.completeReset({',
    'runtimeAdmissionGate.closeAndDrain({',
    'runtimeAdmissionGate.sealForRuntimeReload({ lifecycle: complete })',
    'runtimeAdmissionGate.failClosed({ resetId: lifecycle.resetId })',
    'const lifecycleWriteFailures = new WeakMap()',
    'getProfileMutationLifecycleWriteFailure(error)',
    'reloadRequired: failedLifecycle === null || !runtimeGateFailed',
    'for (const participant of participants)',
    'await participant[method](context)',
  ].forEach((token) => {
    if (!profileMutationCoordinatorSource.includes(token)) {
      fail(`profile mutation coordinator is missing required token ${token}.`);
    }
  });
  [
    'resumeAfterProfileMutation',
    'runtimeAdmissionGate.reopen(',
  ].forEach((token) => {
    if (profileMutationCoordinatorSource.includes(token)) {
      fail(`profile mutation coordinator must not revive the old worker (${token}).`);
    }
  });
  const profileMutationCommitIndex = profileMutationCoordinatorSource.indexOf(
    'await lifecycleRepository.commitReset({',
  );
  const profileMutationCompleteIndex = profileMutationCoordinatorSource.indexOf(
    'await lifecycleRepository.completeReset({',
  );
  const profileMutationReloadSealIndex = profileMutationCoordinatorSource.indexOf(
    'runtimeAdmissionGate.sealForRuntimeReload({ lifecycle: complete })',
  );
  if (
    profileMutationCommitIndex < 0
    || profileMutationCompleteIndex <= profileMutationCommitIndex
    || profileMutationReloadSealIndex <= profileMutationCompleteIndex
  ) {
    fail('profile mutation coordinator must commit durable committed -> complete before sealing the old worker reload_pending.');
  }
  const failedLifecycleQuiesceOwner = profileMutationCoordinatorSource.match(
    /  async function quiesceFailedLifecycleWrite\([\s\S]*?\n  }/,
  );
  if (!failedLifecycleQuiesceOwner) fail('initial lifecycle write failure must have a terminal quiesce owner.');
  assertLifecycleTokenOrder(failedLifecycleQuiesceOwner[0], [
    'resetId: lifecycle.resetId',
    'runtimeAdmissionGate.closeAndDrain(context)',
    'await drain',
    'await runParticipantSequence(',
    'await lifecycleRepository.failResetWriteAttempt({',
    'runtimeAdmissionGate.failClosed({ resetId: lifecycle.resetId })',
    'lifecycleWriteFailures.set(error, Object.freeze({',
  ], 'initial-write failure must drain the exact local generation and every participant before durable reconciliation and diagnostic settlement');
  if (!/try \{\s*\(\{ lifecycle, recovered } = await beginLifecycle\(operation, recoveryGeneration\)\);\s*} catch \(error\) \{\s*const attempt = getProfileResetLifecycleWriteAttempt\(error, lifecycleRepository\);\s*if \(attempt !== null\) await quiesceFailedLifecycleWrite\(error, attempt\);\s*throw error;\s*}/.test(profileMutationCoordinatorSource)) {
    fail('initial lifecycle failure must quiesce only an authenticated repository write receipt and rethrow the original error.');
  }
  [
    'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED',
    'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
    'PROFILE_MUTATION_RUNTIME_LIFECYCLE_READER_REQUIRED',
    'let fenceRevision = 0;',
    'expectedFenceRevision',
    'fenceRevision += 1;',
    'function acquireLocal(',
    'async function acquire(',
    'async function capture(',
    'async function acquireCaptured(',
    'async function runCaptured(',
    'function runAdmittedLocal(',
    'function closeAndDrain(',
    "phase = 'draining'",
    "phase = 'failed'",
    "phase = 'reload_pending'",
    'recovered === true',
    'activeLeaseCount',
    'function sealForRuntimeReload(',
    'function failClosed(',
  ].forEach((token) => {
    if (!profileMutationRuntimeGateSource.includes(token)) {
      fail(`profile mutation runtime admission gate is missing required token ${token}.`);
    }
  });
  if (profileMutationRuntimeGateSource.includes('function reopen(')) {
    fail('profile mutation runtime admission gate must not reopen the old worker.');
  }
  const participantDependencyOrder = [
    "name: 'tracking_tick_runner'",
    "name: 'nudge_window_blur'",
    "name: 'nudge_terminal_effects'",
    "name: 'cycle_state'",
    "name: 'settings'",
    "name: 'settings_propagation'",
    "name: 'clse_runtime'",
    "name: 'tab_time_tracker'",
    "name: 'stats_runtime'",
    "name: 'progression'",
    "name: 'event_log'",
    "name: 'zen_pairwise_gp'",
    "name: 'zen_model_repository'",
    "name: 'worker_runtime_events'",
  ];
  let previousParticipantIndex = -1;
  participantDependencyOrder.forEach((token) => {
    const participantIndex = profileMutationBindingsSource.indexOf(token);
    if (participantIndex <= previousParticipantIndex) {
      fail(`profile mutation participants must remain in producer-before-queue/store order (${token}).`);
    }
    previousParticipantIndex = participantIndex;
  });
  const declaredProfileMutationParticipants = profileMutationBindingsSource.match(
    /name: '[^']+'/g,
  ) || [];
  if (declaredProfileMutationParticipants.length !== participantDependencyOrder.length) {
    fail('every profile mutation participant must be represented in the guarded dependency order.');
  }
  [
    'normalizeProfileMutationResponseHandoff(profileMutationHandoff)',
    'completeProfileMutationRuntimeHandoff({ profileMutationHandoff } = {})',
    'runtime.reload',
    'PROFILE_MUTATION_RUNTIME_RELOAD_HANDOFF_FAILED',
  ].forEach((token) => {
    if (!profileMutationRuntimeLifetimePortSource.includes(token)) {
      fail(`profile mutation runtime lifetime port is missing required token ${token}.`);
    }
  });
  [
    'createProfileMutationResponseHandoffFromLifecycle(',
    'expectedOperation: PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET',
    'expectedOperation: PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT',
    'profileMutationHandoff',
  ].forEach((token) => {
    if (!storageSupportHandlersSource.includes(token)) {
      fail(`storage support terminal response handoff is missing required token ${token}.`);
    }
  });
  if (storageSupportHandlersSource.includes('completeProfileMutationRuntimeHandoff')) {
    fail('terminal storage handlers must return the exact handoff descriptor without reloading the runtime.');
  }
  [
    'PROFILE_MUTATION_RESPONSE_HANDOFF_CONTRACT',
    "'profile_mutation_response_handoff_v1'",
    "'contract'",
    "'operation'",
    "'resetId'",
    'PROFILE_RESET_LIFECYCLE_STATUS.COMPLETE',
    'PROFILE_MUTATION_RESPONSE_HANDOFF_LIFECYCLE_NOT_COMPLETE',
  ].forEach((token) => {
    if (!profileMutationResponseHandoffSource.includes(token)) {
      fail(`profile mutation response handoff contract is missing required token ${token}.`);
    }
  });
  [
    'MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK',
    'isTrustedDashboardPageSender(sender)',
    'let pendingHandoff = null;',
    'pendingHandoff = handoff;',
    "gate.phase !== 'reload_pending'",
    'lifecycle.resetId !== handoff.resetId',
    'lifecycle.operation !== handoff.operation',
    'completeProfileMutationRuntimeHandoff({',
    'profileMutationHandoff: response.profileMutationHandoff',
  ].forEach((token) => {
    if (!profileMutationControlBindingsSource.includes(token)) {
      fail(`profile mutation response ACK control path is missing required token ${token}.`);
    }
  });
  [
    'response?.success !== true',
    'normalizeProfileMutationResponseHandoff(',
    'MESSAGE_ACTIONS.PROFILE_MUTATION_RESPONSE_ACK',
    "typeof acknowledgementTask.then !== 'function'",
    'Promise.resolve(acknowledgementTask).catch(() => undefined)',
    'PROFILE_MUTATION_RESPONSE_ACK_START_FAILED',
  ].forEach((token) => {
    if (!profileMutationResponseAckClientSource.includes(token)) {
      fail(`Dashboard profile mutation response ACK client is missing required token ${token}.`);
    }
  });
  [
    'STORAGE_INSPECTOR_CAPABILITY_INDEXED_DB_OWNER_REQUIRED',
    'STORAGE_INSPECTOR_CAPABILITY_EVENT_LOG_OWNER_REQUIRED',
    'this.getIndexedDbOverviewOwner = requireStorageInspectorCapabilityOwnerMethod(',
    'this.getBufferedLogCountOwner = requireStorageInspectorCapabilityOwnerMethod(',
  ].forEach((token) => {
    if (!storageInspectorCapabilitySource.includes(token)) {
      fail(`src/platform/storage/support/StorageInspectorCapability.js: missing inspector capability owner token ${token}.`);
    }
  });
  [
    'this.indexedDbInspector = indexedDbInspector',
    'this.eventLogRepository = eventLogRepository',
    'this.indexedDbInspector.getOverview()',
    'this.eventLogRepository.getBufferedCount()',
  ].forEach((token) => {
    if (storageInspectorCapabilitySource.includes(token)) {
      fail(`src/platform/storage/support/StorageInspectorCapability.js: inspector capability must validate owners at construction instead of retaining fallback token ${token}.`);
    }
  });
  [
    'INDEXED_DB_INSPECTOR_STORE_COUNTS_OWNER_REQUIRED',
    'INDEXED_DB_INSPECTOR_HOURLY_LEDGER_DIAGNOSTICS_OWNER_REQUIRED',
    'this.getStoreCountsOwner = requireIndexedDbInspectorOwnerMethod(',
    'this.getHourlyLedgerDiagnosticsOwner = requireIndexedDbInspectorOwnerMethod(',
    'const storeCounts = await this.getStoreCountsOwner();',
    'statsHourly = await this.getHourlyLedgerDiagnosticsOwner();',
  ].forEach((token) => {
    if (!indexedDbInspectorSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/IndexedDbInspector.js: missing inspector owner token ${token}.`);
    }
  });
  [
    'this.indexedDbSnapshotRepository = indexedDbSnapshotRepository',
    'this.statsAggregateStore = statsAggregateStore',
    'this.indexedDbSnapshotRepository.getStoreCounts()',
    'this.statsAggregateStore.getHourlyLedgerDiagnostics()',
    "typeof this.statsAggregateStore.getHourlyLedgerDiagnostics === 'function'",
  ].forEach((token) => {
    if (indexedDbInspectorSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/IndexedDbInspector.js: inspector must validate owners at construction instead of retaining fallback token ${token}.`);
    }
  });
  [
    'getStoreCounts(',
    'exportDatabase(',
    'importDatabase(',
    'exportSnapshot(',
    'importSnapshot(',
    'EXPORT_STORE_NAMES',
    'normalizeIndexedDbImportSnapshot',
    'preflightIndexedDbV1ImportSnapshot',
  ].forEach((token) => {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: IndexedDB snapshot/count bulk I/O belongs to IndexedDbSnapshotRepository, not DBManager (${token}).`);
    }
  });
  const clseStoreSource = await fs.readFile(clseStorePath, 'utf8');
  const eventLogStoreSource = await fs.readFile(eventLogStorePath, 'utf8');
  const clseServiceSource = await fs.readFile(clseServicePath, 'utf8');
  const clseCheckpointWriteSchedulerSource = await fs.readFile(
    clseCheckpointWriteSchedulerPath,
    'utf8',
  );
  const clseRingBufferSource = await fs.readFile(clseRingBufferPath, 'utf8');
  const faviconStoreSource = await fs.readFile(faviconStorePath, 'utf8');
  const interventionEffectStoreSource = await fs.readFile(interventionEffectStorePath, 'utf8');
  const modelStateStoreSource = await fs.readFile(modelStateStorePath, 'utf8');
  const modelStateRepositorySource = await fs.readFile(modelStateRepositoryPath, 'utf8');
  const profileCompatibilityContractSource = await fs.readFile(
    profileCompatibilityContractPath,
    'utf8',
  );
  const profileEpochContractSource = await fs.readFile(profileEpochContractPath, 'utf8');
  [
    'MODEL_STATE_PROFILE_DEVELOPMENT_BASELINE = 2',
    "'profile_compatibility_recovery_v1'",
    "'MODEL_STATE_PROFILE_COMPATIBILITY_BASELINE_RESET_REQUIRED'",
    "'MODEL_STATE_PROFILE_COMPATIBILITY_DOWNGRADE_BLOCKED'",
    'resolveProfileCompatibilityRecovery(error)',
  ].forEach((token) => {
    if (!profileCompatibilityContractSource.includes(token)) {
      fail(`profile compatibility contract is missing required token ${token}.`);
    }
  });
  [
    "MODEL_STATE_PROFILE_EPOCH_ROW_KEY = '__model_state_profile_epoch__'",
    "MODEL_STATE_PROFILE_EPOCH_CONTRACT = 'model_state_profile_epoch_v1'",
    "'developmentBaseline'",
    'createProfileCompatibilityResetRequiredError({',
    'createProfileCompatibilityDowngradeBlockedError({',
  ].forEach((token) => {
    if (!profileEpochContractSource.includes(token)) {
      fail(`profile epoch contract is missing required token ${token}.`);
    }
  });
  [
    'async getEntries(keys = [])',
    'async get(defaults = {})',
    'async getAll()',
    'async set(items = {})',
    'async putEntries(entries = [])',
    'async deleteEntries(keys = [])',
    'async compareAndSetEntry(key, options = null)',
    'async getEntryWithProfileEpoch(key, options = null)',
    'async compareAndSetEntryWithProfileEpoch(key, options = null)',
    'async getWithProfileEpoch(defaults = {}, options = null)',
    'async setWithProfileEpoch(items = {}, options = null)',
    'async bootstrapValueWithProfileEpoch(key, initialValue, options = null)',
    'async initializeProfileGeneration(profileEpoch, options = null)',
    'async assertProfileGenerationInitialized(expectedProfileEpoch)',
    'MODEL_STATE_PROFILE_GENERATION_NOT_INITIALIZED',
    'MODEL_STATE_PROFILE_AGGREGATE_TYPED_MUTATION_REQUIRED',
    'MODEL_STATE_PROFILE_GENERATION_RESET_REQUIRED',
    'PROFILE_COMPATIBILITY_RESET_REASONS.PROFILE_HEADER_MISSING',
    'createProfileCompatibilityResetRequiredError({',
    'async resetForProfileEpoch(resetId, options = null)',
    'MODEL_STATE_PROFILE_EPOCH_RESET_EXACT_AGGREGATE_REQUIRED',
    'MODEL_STATE_PROFILE_EPOCH_RESET_AGGREGATE_INVALID',
    'MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN',
    'MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN',
  ].forEach((token) => {
    if (!modelStateStoreSource.includes(token)) {
      fail(`ModelStateStore profile epoch fence is missing required token ${token}.`);
    }
  });
  if (
    modelStateStoreSource.includes('MODEL_STATE_PROFILE_EPOCH_BOOTSTRAP_RESET_REQUIRED')
    || modelStateStoreSource.includes(
      'ZEN_BONSAI_PROFILE_AGGREGATE_CANDIDATE_GRAPH_CONTRACT_RESET_REQUIRED',
    )
  ) {
    fail('ModelStateStore reset classification must come only from the reserved profile compatibility baseline.');
  }
  const {
    ZEN_PROFILE_PERSISTENCE_DESCRIPTOR,
  } = await import(pathToFileURL(zenProfilePersistenceDescriptorPath).href);
  const expectedZenProfilePersistenceDescriptor = {
    contract: 'zen_profile_persistence_descriptor_v1',
    developmentBaseline: 2,
    profileEpochContract: 'model_state_profile_epoch_v1',
    bonsaiProfileAggregateContract: 'zen_bonsai_profile_aggregate_v1',
    bonsaiActiveIdentityContract: 'zen_bonsai_classic2_candidate_identity_v1',
    bonsaiCandidateGraphContract: 'classic2_macro_lineage_graph_v2',
    spineConditionNamespaces: [
      'sakura_macro_spine_guide_condition_v1',
      'sakura_spine_reference_family_condition_v1',
    ],
  };
  if (
    JSON.stringify(ZEN_PROFILE_PERSISTENCE_DESCRIPTOR)
    !== JSON.stringify(expectedZenProfilePersistenceDescriptor)
  ) {
    fail(
      'Zen profile persistence descriptor changed without updating the current development baseline guard.',
    );
  }
  [
    'const stored = await this.getEntries(keys)',
    'await this.putEntries(putEntries)',
    'await this.deleteEntries(deleteKeys)',
  ].forEach((token) => {
    if (modelStateStoreSource.includes(token)) {
      fail(`ModelStateStore epoch-blind CRUD must remain hard-closed (${token}).`);
    }
  });
  [
    'getEntryWithProfileEpoch(key, options)',
    'getWithProfileEpoch(defaults = {}, options)',
    'setWithProfileEpoch(entries = {}, options)',
    'bootstrapValueWithProfileEpoch(key, initialValue, options)',
    'initializeProfileGeneration(profileEpoch, options)',
    'assertProfileGenerationInitialized(expectedProfileEpoch)',
    'compareAndSetValueWithProfileEpoch(key, options)',
    'resetForProfileEpoch(resetId, options)',
  ].forEach((token) => {
    if (!modelStateRepositorySource.includes(token)) {
      fail(`ModelStateRepository profile epoch seam is missing required token ${token}.`);
    }
  });
  [
    'requireProfileGenerationLease()',
    'requireZenThemeProfileGenerationLease(',
    'this.profileGenerationLease.requireCurrent()',
    'modelStateStore.getWithProfileEpoch(',
    'modelStateStore.setWithProfileEpoch(',
    'modelStateStore.bootstrapValueWithProfileEpoch(',
    'ZEN_BONSAI_PROFILE_AGGREGATE_LIFECYCLE_EPOCH_MISMATCH',
  ].forEach((token) => {
    if (!zenThemeModelStateSource.includes(token)) {
      fail(`ZenThemeModelState generic persistence must be profile-epoch bound (${token}).`);
    }
  });
  if (zenThemeModelStateSource.includes('pristineInitialSnapshot')) {
    fail('ZenThemeModelState must not accept an epochless pristine aggregate after background generation initialization became mandatory.');
  }
  if (zenThemeModelStateSource.includes('this.modelStateStore.set(')) {
    fail('ZenThemeModelState must not retain an epoch-blind generic set path.');
  }
  [
    'createPinnedZenThemeProfileGenerationLease',
    'requireZenThemeProfileGenerationLease',
    'ZEN_THEME_PROFILE_GENERATION_LEASE_REQUIRED',
    'ZEN_THEME_PROFILE_GENERATION_LEASE_CLOSED',
  ].forEach((token) => {
    if (!zenThemeProfileGenerationLeaseSource.includes(token)) {
      fail(`Zen profile-generation lease core is missing required token ${token}.`);
    }
  });
  [
    'ProfileResetLifecycleRepository',
    'profileLifecycleRepository.subscribe(',
    'profileLifecycleRepository.assertWriteAdmission({',
    'ZEN_THEME_PROFILE_GENERATION_LEASE_STALE',
  ].forEach((token) => {
    if (!zenThemeLifecycleProfileGenerationLeaseSource.includes(token)) {
      fail(`Zen lifecycle-backed profile-generation lease is missing required token ${token}.`);
    }
  });
  [
    'ZenModelRepositoryCore',
    'createZenThemeLifecycleProfileGenerationLease',
  ].forEach((token) => {
    if (!zenModelRepositorySource.includes(token)) {
      fail(`ZenModelRepository UI/runtime composition is missing required token ${token}.`);
    }
  });
  [
    'ZenModelRepositoryCore',
    'createPinnedZenThemeProfileGenerationLease',
    'requireZenThemeProfileGeneration',
  ].forEach((token) => {
    if (!zenWorkerModelRepositorySource.includes(token)) {
      fail(`ZenWorkerModelRepository pinned worker composition is missing required token ${token}.`);
    }
  });
  [
    ['ZenThemeModelState', zenThemeModelStateSource],
    ['ZenThemeProfileGenerationLease', zenThemeProfileGenerationLeaseSource],
    ['ZenModelRepositoryCore', zenModelRepositoryCoreSource],
    ['ZenWorkerModelRepository', zenWorkerModelRepositorySource],
  ].forEach(([label, source]) => {
    [
      'ProfileResetLifecycleRepository',
      'profileLifecycleRepository',
      'internal/chrome-storage',
    ].forEach((token) => {
      if (source.includes(token)) {
        fail(`${label} must remain independent of the UI/background lifecycle storage seam (${token}).`);
      }
    });
  });
  [
    ['zenAbTrialEvaluator.worker.js', zenAbTrialEvaluatorWorkerSource],
    ['zenLatentOptimizer.worker.js', zenLatentOptimizerWorkerSource],
  ].forEach(([label, source]) => {
    if (!source.includes('ZenWorkerModelRepository')) {
      fail(`${label}: model-capable strict worker must use ZenWorkerModelRepository.`);
    }
    if (source.includes("state/ZenModelRepository.js")) {
      fail(`${label}: model-capable strict worker must not import the lifecycle-backed ZenModelRepository.`);
    }
  });
  const statsAggregateStoreSource = await fs.readFile(statsAggregateStorePath, 'utf8');
  const statsFeaturePackStoreSource = await fs.readFile(statsFeaturePackStorePath, 'utf8');
  const statsFeaturePackRepositorySource = await fs.readFile(statsFeaturePackRepositoryPath, 'utf8');
  const zenArtifactStoreSource = await fs.readFile(zenArtifactStorePath, 'utf8');
  [
    'async replaceArtifactCollectionForProfileGeneration(command = {})',
    '[STORES.ZEN_ARTIFACTS, STORES.MODEL_STATE]',
    'MODEL_STATE_PROFILE_EPOCH_ROW_KEY',
    'ZEN_ARTIFACT_EXPECTED_PROFILE_GENERATION_INVALID',
    'ZEN_ARTIFACT_PROFILE_GENERATION_STALE',
    'artifactStore.put(meta)',
    'async clearForProfileMutation()',
  ].forEach((token) => {
    if (!zenArtifactStoreSource.includes(token)) {
      fail(`ZenArtifactStore generation-fenced collection ownership is missing token ${token}.`);
    }
  });
  [
    'async putArtifact(',
    'async putArtifacts(',
    'async deleteArtifact(',
    'async deleteArtifacts(',
    'async setMeta(',
  ].forEach((token) => {
    if (zenArtifactStoreSource.includes(token)) {
      fail(`ZenArtifactStore must not expose epoch-blind artifact mutation ${token}.`);
    }
  });
  [
    'replaceArtifactCollectionForProfileGeneration(command = {})',
    'clearForProfileMutation()',
  ].forEach((token) => {
    if (!zenArtifactRepositorySource.includes(token)) {
      fail(`ZenArtifactRepository is missing typed artifact mutation owner ${token}.`);
    }
  });
  [
    'putArtifact(',
    'putArtifacts(',
    'deleteArtifact(',
    'deleteArtifacts(',
    'setMeta(',
  ].forEach((token) => {
    if (zenArtifactRepositorySource.includes(token)) {
      fail(`ZenArtifactRepository must not expose epoch-blind artifact mutation ${token}.`);
    }
  });
  [
    'BONSAI_REPOSITORY_EXPECTED_PROFILE_GENERATION_REQUIRED',
    'artifactStore.replaceArtifactCollectionForProfileGeneration({',
    'expectedProfileGeneration,',
  ].forEach((token) => {
    if (!bonsaiRepositorySource.includes(token)) {
      fail(`BonsaiRepository is missing explicit profile-generation mutation token ${token}.`);
    }
  });
  [
    'artifactStore.putArtifacts(',
    'artifactStore.deleteArtifacts(',
    'artifactStore.setMeta(',
  ].forEach((token) => {
    if (bonsaiRepositorySource.includes(token)) {
      fail(`BonsaiRepository must not split collection persistence across mutation ${token}.`);
    }
  });
  if (!zenBonsaiPreviewRuntimeSource.includes(
    'expectedProfileGeneration: activeProfile.profileEpoch',
  )) {
    fail('Zen bonsai preview artifact writes must submit the Dashboard-admitted durable profile epoch.');
  }
  if (!/async \(\) => \{\s*await resetModelStateForProfileEpoch\([\s\S]*?\);\s*await clearZenArtifactsForProfileMutation\(\);\s*\}/u.test(
    backgroundMaintenanceCoordinatorSource,
  )) {
    fail('full reset must rotate model-state profile generation before clearing Zen artifacts in the same required task.');
  }
  const bestEffortStorageSupportSources = [
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
      requiredTokens: [
        'BACKGROUND_MAINTENANCE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_CLEAR_BOOTSTRAP_SNAPSHOTS_REQUIRED',
        'BACKGROUND_MAINTENANCE_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_STATS_FEATURE_PACK_REPOSITORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_INTERVENTION_EFFECT_REPOSITORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_PROGRESSION_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_EVENT_LOG_PROFILE_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_MODEL_STATE_PROFILE_EPOCH_RESET_REQUIRED',
        'BACKGROUND_MAINTENANCE_ZEN_ARTIFACT_PROFILE_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_MAINTENANCE_PROFILE_MUTATION_COORDINATOR_REQUIRED',
        'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
        'BACKGROUND_MAINTENANCE_ZEN_PROFILE_GENERATION_STATE_INVALID',
        'BACKGROUND_MAINTENANCE_DOMAIN_HASH_REPAIR_RESULT_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_RESULT_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_REMOVED_DAYS_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_STATS_CLEANUP_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_CLEANUP_RESULTS_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_READ_INVALID',
        'BACKGROUND_MAINTENANCE_STATS_RETENTION_MARKER_INVALID',
        'runRequiredMaintenanceWave',
        'Promise.allSettled',
        'RESET_APP_HISTORY_CLEAR_PHASE_FAILED',
        'RESET_APP_DURABLE_CLEAR_PHASE_FAILED',
        'runExclusiveProfileMutation({',
        'operation: PROFILE_RESET_LIFECYCLE_OPERATIONS.FULL_RESET',
        'mutate: () => Promise.resolve(runTerminalTrackingReset())',
        '.then(() => runTerminalStatsReset(async () => {',
        'resetModelStateForProfileEpoch(resetLifecycle.resetId, {',
        'initialEntries: profileGenerationState.modelStateInitialEntries',
        'clearZenArtifactsForProfileMutation',
        'resetEventLogsForProfileMutation',
        'clearProgressionForProfileMutation({ nowMs: now })',
        'runBestEffortMaintenanceStep',
        'settingsService.runExclusiveTerminalSettingsMutation({',
        'settingsService.runExclusiveExternalSettingsMutation({',
        "actionReason: 'ensure_domain_hash_artifacts'",
        'RESET_APP_RUNTIME_SESSION_REMOVE_FAILED',
        'CLEAR_RUNTIME_SESSION_REMOVE_SESSION_FAILED',
      ],
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
      requiredTokens: [
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_SETTINGS_MUTATION_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CLEAR_BOOTSTRAP_SNAPSHOTS_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_STATS_RESET_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_TERMINAL_TRACKING_RESET_OWNER_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_CLSE_IMPORT_LIFECYCLE_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_PROFILE_MUTATION_COORDINATOR_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_SERVICE_ZEN_PROFILE_GENERATION_FACTORY_REQUIRED',
        'BACKGROUND_STORAGE_SNAPSHOT_ZEN_PROFILE_GENERATION_STATE_INVALID',
        'const ownedSnapshot = structuredClone(snapshot)',
        'storageSnapshotCapability.preflightImport(ownedSnapshot',
        'storageSnapshotCapability.importSnapshot(ownedSnapshot',
        'STORAGE_SNAPSHOT_IMPORT_MODE_INVALID',
        'profileMutationCoordinator.runStableRead({',
        'profileMutationCoordinator.runExclusiveMutation({',
        'operation: PROFILE_RESET_LIFECYCLE_OPERATIONS.SNAPSHOT_IMPORT',
        'targetProfileEpoch: resetLifecycle.resetId',
        'targetProfileAggregate: profileGenerationState.profileAggregate',
        'settingsService.runExclusiveTerminalSettingsMutation({',
        'runCLSEStorageSnapshotImport(async () => {',
        'mutate: () => Promise.resolve(runTerminalTrackingReset())',
        '.then(() => runTerminalStatsReset(async () => {',
        'runRequiredSnapshotRuntimeCleanup({',
        'BACKGROUND_STORAGE_SNAPSHOT_RUNTIME_CLEANUP_FAILED',
      ],
    },
  ];
  for (const { path: filePath, source, requiredTokens } of bestEffortStorageSupportSources) {
    if (source.includes('.catch(() => {})') || source.includes('.catch(() => { })')) {
      fail(`${filePath}: storage support best-effort steps must report warnings instead of swallowing failures.`);
    }
    for (const token of requiredTokens) {
      if (!source.includes(token)) {
        fail(`${filePath}: missing required best-effort warning contract token ${token}.`);
      }
    }
  }
  if (backgroundStorageSnapshotServiceSource.includes('runBestEffortSnapshotStep')) {
    fail('terminal snapshot import cleanup must fail loudly instead of continuing through a best-effort step.');
  }
  const snapshotPreflightIndex = backgroundStorageSnapshotServiceSource.indexOf('await storageSnapshotCapability.preflightImport(ownedSnapshot');
  const snapshotQuiesceIndex = backgroundStorageSnapshotServiceSource.indexOf('await profileMutationCoordinator.runExclusiveMutation(');
  if (snapshotPreflightIndex < 0 || snapshotQuiesceIndex <= snapshotPreflightIndex) {
    fail('terminal snapshot import must finish pure preflight before profile quiescence begins.');
  }
  [
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
    },
  ].forEach(({ path: filePath, source }) => {
    if (source.includes('mutate: async () => {')) {
      fail(`${filePath}: terminal settings mutation owner must enter synchronously and return its promise chain.`);
    }
    [
      'syncBlockedBookmarks = async () => ({ destroyed: [] })',
      'clearBootstrapSnapshots = async () => {}',
      'statsFeaturePackRepository = null',
      'interventionEffectRepository = null',
      'statsFeaturePackRepository?.clearAll?.()',
      'interventionEffectRepository?.clearAll?.()',
      'progressionRepository?.clear?.()',
    ].forEach((token) => {
      if (source.includes(token)) {
        fail(`${filePath}: support import/reset follow-up owners must be required instead of no-op default ${token}.`);
      }
    });
  });
  [
    {
      path: 'src/apps/background/services/runtime/support/BackgroundMaintenanceCoordinator.js',
      source: backgroundMaintenanceCoordinatorSource,
    },
    {
      path: 'src/apps/background/services/runtime/support/BackgroundStorageSnapshotService.js',
      source: backgroundStorageSnapshotServiceSource,
    },
  ].forEach(({ path: filePath, source }) => {
    [
      'settingsService.refreshSettingsCache',
      'syncCLSEFromStoredSettings',
      'syncBlockedBookmarks',
      'syncManagedContentScripts',
      'broadcastSettingsUpdate',
    ].forEach((token) => {
      if (source.includes(token)) {
        fail(`${filePath}: external settings mutations must reconcile through SettingsService instead of manual effect token ${token}.`);
      }
    });
  });

  const retiredDbManagerStatsAggregateMethods = [
    'putStatsHourlyBuckets(',
    'getStatsHourlyBuckets(',
    'getStatsHourlyReadDiagnostics(',
    'getStatsHourlyLedgerDiagnostics(',
    'clearStatsHourlyByDate(',
    'pruneStatsHourlyBefore(',
    'putStatsDaily(',
    'getStatsDaily(',
    'getStatsDailyRange(',
    'pruneStatsDailyBefore(',
    'clearStatsHourly(',
    'clearStatsDaily(',
    '_clearStore(',
  ];
  for (const token of retiredDbManagerStatsAggregateMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: stats hourly/daily persistence belongs to StatsAggregateStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.STATS_HOURLY',
    'STORES.STATS_DAILY',
    'getDatabase()',
    "db.transaction(STORES.STATS_HOURLY",
    "db.transaction(STORES.STATS_DAILY",
    "store.index(readRequest.indexName)",
    'getHourlyLedgerDiagnostics',
    'async readHourlyBucketsRange(',
    'async readHistoricalMaterializationDateIndex(',
    "hourlyDateIndex.openKeyCursor(dateRange, 'nextunique')",
    'dailyStore.getAllKeys(dateRange)',
    "dailyStore.index('finalizedAt')",
    'dailyFinalizedAtIndex.openKeyCursor()',
    'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_INVALID',
    'STATS_AGGREGATE_STORE_HISTORICAL_DAILY_MARKER_KEY_INVALID',
    'buildStatsHourlyRangeReadDiagnostics({',
    'STATS_AGGREGATE_STORE_DATABASE_REQUIRED',
    'STATS_AGGREGATE_STORE_HOURLY_BUCKET_CANONICAL_REQUIRED',
    'STATS_AGGREGATE_STORE_HOURLY_RANGE_ROW_INVALID',
  ]) {
    if (!statsAggregateStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js: missing stats aggregate store ownership token ${token}.`);
    }
  }
  for (const token of [
    'RuntimeSessionStore',
    'STORAGE_SESSION_KEYS',
    'clearRuntimeCheckpoint',
    'sessionStore',
  ]) {
    if (statsAggregateStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/StatsAggregateStore.js: stats aggregate storage must not depend on runtime-session checkpoints (${token}).`);
    }
  }

  const retiredDbManagerClseMethods = [
    'putCLSEBucket60s(',
    'getCLSEBuckets60s(',
    'putCLSEBucket5min(',
    'getCLSEBuckets5min(',
    'putCLSELoopEvent(',
    'getCLSELoopEvents(',
    'putCLSEAggressionLog(',
    'getCLSEAggressionLogs(',
    'putCLSEDailySummary(',
    'getCLSEDailySummaries(',
    'pruneCLSEDailySummariesBefore(',
    'getCLSEBaseline(',
    'putCLSEBaseline(',
    'deleteCLSEBaseline(',
    'pruneCLSEDataBefore(',
    'pruneCLSEDataByTier(',
    'clearCLSEData(',
  ];
  for (const token of retiredDbManagerClseMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: CLSE persistence belongs to ClseStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.CLSE_BUCKETS_60S',
    'STORES.CLSE_BUCKETS_5MIN',
    'STORES.CLSE_LOOP_EVENTS',
    'STORES.CLSE_BASELINE',
    'STORES.CLSE_AGGRESSION_LOGS',
    'STORES.CLSE_DAILY_SUMMARIES',
    'getDatabase()',
    'db.transaction(storeName',
    'store.index(indexName)',
    'pruneTimestampStore',
    'normalizeClseDailySummaryRow',
    'CLSE_STORE_DATABASE_REQUIRED',
    'CLSE_STORE_DAILY_SUMMARY_REQUIRED',
  ]) {
    if (!clseStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/ClseStore.js: missing CLSE store ownership token ${token}.`);
    }
  }

  const retiredDbManagerEventLogMethods = [
    'putLog(',
    'flushLogs(',
    'forceFlush(',
    'pruneLogsBefore(',
    'clearUsageLogs(',
    'getBufferedLogCount(',
    'getLogs(',
    'getLogTimestampCounts(',
    '_logBuffer',
    '_flushTimer',
    'CryptoService',
  ];
  for (const token of retiredDbManagerEventLogMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: encrypted usage-log buffering belongs to EventLogStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.LOGS',
    'CryptoService',
    'getDatabase()',
    'encryptBatch',
    "db.transaction(STORES.LOGS",
    "store.index('timestamp')",
    'operationTail',
    'EVENT_LOG_APPEND_BATCH_SIZE = 100',
    'maxAppendBatchSize',
    'pendingAppendEntries',
    'queueMicrotask(',
    'enqueuePendingAppendBatches()',
    'encryptedEntries.forEach((entry) => store.add(entry))',
    'EVENT_LOG_STORE_LOG_ENTRY_REQUIRED',
    'EVENT_LOG_STORE_ENCRYPT_BATCH_INVALID',
  ]) {
    if (!eventLogStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/EventLogStore.js: missing event-log store ownership token ${token}.`);
    }
  }
  for (const retiredToken of [
    'setInterval(',
    'setTimeout(',
    'logBuffer',
    'flushTimer',
    'requeuePendingLogs',
  ]) {
    if (eventLogStoreSource.includes(retiredToken)) {
      fail(`src/platform/storage/internal/indexeddb/stores/EventLogStore.js: persistent timer/long-lived buffer ownership is retired (${retiredToken}).`);
    }
  }

  for (const token of [
    'CLSE_CHECKPOINT_MIN_WRITE_INTERVAL_MS = 5_000',
    'CLSE_CHECKPOINT_MAX_CLOSED_BUCKETS = 3',
    'maxClosedBuckets: CLSE_CHECKPOINT_MAX_CLOSED_BUCKETS',
    'checkpointWriteScheduler.request({ force, now })',
    'settle(now, { commitCheckpoint: false })',
    'commitCheckpoint({ force: true, now })',
  ]) {
    if (!clseServiceSource.includes(token)) {
      fail(`src/domains/behavior/CLSEService.js: missing compact checkpoint contract token ${token}.`);
    }
  }
  for (const token of [
    'minWriteIntervalMs',
    'operationTail',
    'lastAcceptedTask',
    'this.capture()',
    'this.write(checkpoint)',
  ]) {
    if (!clseCheckpointWriteSchedulerSource.includes(token)) {
      fail(`src/domains/behavior/runtime/ClseCheckpointWriteScheduler.js: missing timer-free checkpoint scheduler token ${token}.`);
    }
  }
  for (const retiredToken of ['setInterval(', 'setTimeout(']) {
    if (clseCheckpointWriteSchedulerSource.includes(retiredToken)) {
      fail(`src/domains/behavior/runtime/ClseCheckpointWriteScheduler.js: checkpoint coalescing must remain timer-free (${retiredToken}).`);
    }
  }
  for (const token of [
    'serialize({ maxClosedBuckets = this.size } = {})',
    'CLSE_RING_BUFFER_CHECKPOINT_WINDOW_INVALID',
    'currentBucket:',
  ]) {
    if (!clseRingBufferSource.includes(token)) {
      fail(`src/domains/behavior/data/RingBuffer.js: missing compact ring checkpoint token ${token}.`);
    }
  }

  const retiredDbManagerFaviconMethods = [
    'putFavicon(',
    'getFavicon(',
    'getAllFavicons(',
    'clearFavicons(',
  ];
  for (const token of retiredDbManagerFaviconMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: favicon CRUD belongs to FaviconStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.FAVICONS',
    'getDatabase()',
    "db.transaction(STORES.FAVICONS",
  ]) {
    if (!faviconStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/FaviconStore.js: missing favicon store ownership token ${token}.`);
    }
  }

  const retiredDbManagerInterventionEffectMethods = [
    'putInterventionExposure(',
    'getInterventionExposure(',
    'pruneInterventionExposuresBefore(',
    'putInterventionEffectDailyRows(',
    'getInterventionEffectDaily(',
    'getInterventionEffectDailyRange(',
    'pruneInterventionEffectDailyBefore(',
    'clearInterventionExposures(',
    'clearInterventionEffectDaily(',
  ];
  for (const token of retiredDbManagerInterventionEffectMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: intervention exposure/effect CRUD belongs to InterventionEffectStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.INTERVENTION_EXPOSURES',
    'STORES.INTERVENTION_EFFECT_DAILY',
    'getDatabase()',
    "db.transaction(STORES.INTERVENTION_EXPOSURES",
    "db.transaction(STORES.INTERVENTION_EFFECT_DAILY",
    "store.index('shownAt')",
    "store.index('dateStr')",
    'INTERVENTION_OUTCOME_EXPOSURE_REQUIRED',
    'requireInterventionHistoryFacts',
    'historyFacts',
  ]) {
    if (!interventionEffectStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js: missing intervention effect store ownership token ${token}.`);
    }
  }
  [
    "artifactId: normalizeString(row.artifactId, { maxLength: 128, fallback: 'unknown' })",
    "normalizeString(row.artifactFamily, { maxLength: 80, fallback: 'gate' })",
    "artifactId || 'unknown'",
    'current || normalizeInterventionExposureRow({',
  ].forEach((token) => {
    if (interventionEffectStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/InterventionEffectStore.js: intervention effect store must reject missing artifact identity instead of fallback token ${token}.`);
    }
  });

  // Receipt identity stays beside the aggregate, never in a session marker or
  // daily summary used as a second deduplication authority.
  for (const token of ['interventionHistoryReceipts', 'delete summaryDay.interventionHistoryReceipts']) {
    if (!statsAggregateStoreSource.includes(token)) {
      fail(`StatsAggregateStore: missing Gate hourly receipt ownership boundary ${token}.`);
    }
  }

  const retiredDbManagerModelStateMethods = [
    'putModelState(',
    'putModelStates(',
    'deleteModelState(',
    'deleteModelStates(',
    'getModelState(',
    'getModelStates(',
    'getAllModelStates(',
    'clearModelStates(',
    'compareAndSetModelState(',
  ];
  for (const token of retiredDbManagerModelStateMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: model-state CRUD belongs to ModelStateStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.MODEL_STATE',
    'getDatabase()',
    "db.transaction(STORES.MODEL_STATE",
    'MODEL_STATE_CAS_OUTCOMES',
    'async compareAndSetEntry(key, options = null)',
    'MODEL_STATE_CAS_CURRENT_REVISION_INVALID',
    'requireStoredModelStateRecord(currentEntry, {',
    'MODEL_STATE_CAS_NEXT_REVISION_MUST_ADVANCE',
    'MODEL_STATE_CAS_VERIFY_ONLY_NEXT_VALUE_FORBIDDEN',
  ]) {
    if (!modelStateStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/ModelStateStore.js: missing model-state store ownership token ${token}.`);
    }
  }
  if (modelStateStoreSource.includes('async updateEntry(key, updater)')) {
    fail('src/platform/storage/internal/indexeddb/stores/ModelStateStore.js: retired updater-in-transaction seam must not coexist with compareAndSetEntry.');
  }
  for (const token of [
    'compareAndSetValue(key, options)',
    'get(defaults = {})',
    'getAll()',
    'set(entries = {})',
    'clear()',
    'MODEL_STATE_EPOCH_BLIND_ACCESS_FORBIDDEN',
    'MODEL_STATE_EPOCH_BLIND_MUTATION_FORBIDDEN',
  ]) {
    if (!modelStateRepositorySource.includes(token)) {
      fail(`src/platform/storage/model/ModelStateRepository.js: missing model-state CAS repository token ${token}.`);
    }
  }
  for (const token of [
    'this.modelStateStore.compareAndSetEntry(key, options)',
    'this.modelStateStore.get(defaults)',
    'this.modelStateStore.getAll()',
    'this.modelStateStore.set(entries)',
    'this.modelStateStore.clear()',
  ]) {
    if (modelStateRepositorySource.includes(token)) {
      fail(`src/platform/storage/model/ModelStateRepository.js: epoch-blind public mutation delegation is forbidden (${token}).`);
    }
  }
  for (const token of [
    'updateValue(key, updater)',
    'MODEL_STATE_ATOMIC_UPDATE_UNAVAILABLE',
  ]) {
    if (modelStateRepositorySource.includes(token)) {
      fail(`src/platform/storage/model/ModelStateRepository.js: retired updater fallback is forbidden (${token}).`);
    }
  }

  const retiredDbManagerStatsFeaturePackMethods = [
    'putStatsFeaturePacks(',
    'getStatsFeaturePack(',
    'getStatsFeaturePacksRange(',
    'pruneStatsFeaturePacksBefore(',
    'clearStatsFeaturePacks(',
  ];
  for (const token of retiredDbManagerStatsFeaturePackMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: dormant stats feature-pack CRUD must not be reintroduced (${token}).`);
    }
  }

  for (const token of [
    'STORES.STATS_FEATURE_PACK_DAILY',
    'getDatabase()',
    "db.transaction(STORES.STATS_FEATURE_PACK_DAILY",
    "store.index('dateStr')",
    'STATS_FEATURE_PACK_CLEAR_FAILED',
    'STATS_FEATURE_PACK_CLEAR_ABORTED',
    'tx.onabort',
  ]) {
    if (!statsFeaturePackStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js: missing stats feature-pack store ownership token ${token}.`);
    }
  }
  if (statsFeaturePackStoreSource.includes('trackingScope')) {
    fail('src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js: stats feature-pack coverage metadata must use canonical dataCollectionMode, not legacy trackingScope.');
  }
  if (statsFeaturePackStoreSource.includes('req.onsuccess = () => resolve()')) {
    fail('src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js: clearAll must settle on transaction completion, not request success.');
  }
  for (const token of [
    'putPacks(',
    'async read(',
    'readRange(',
    'upsertDailyFeaturePacksFromDay(',
    'getDailyFeaturePack(',
    'getDailyFeaturePacksRange(',
    'store.put(',
    "db.transaction(STORES.STATS_FEATURE_PACK_DAILY, 'readonly')",
  ]) {
    if (statsFeaturePackStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/StatsFeaturePackStore.js: dormant V1 compatibility store must remain lifecycle-delete-only (${token}).`);
    }
  }
  for (const token of [
    'upsertDailyFeaturePacksFromDay(',
    'getDailyFeaturePack(',
    'getDailyFeaturePacksRange(',
    'this.statsFeaturePackStore',
  ]) {
    if (statsFeaturePackRepositorySource.includes(token)) {
      fail(`src/platform/storage/stats/StatsFeaturePackRepository.js: dormant feature-pack runtime upsert/read seam is forbidden (${token}).`);
    }
  }
  for (const token of [
    '#statsFeaturePackStore;',
    'this.#statsFeaturePackStore.pruneBefore(cutoffDateStr)',
    'this.#statsFeaturePackStore.clearAll()',
  ]) {
    if (!statsFeaturePackRepositorySource.includes(token)) {
      fail(`src/platform/storage/stats/StatsFeaturePackRepository.js: lifecycle-only feature-pack repository is missing ${token}.`);
    }
  }

  const retiredDbManagerStatsTransitionEdgeMethods = [
    'incrementStatsTransitionEdges(',
    'getStatsTransitionEdgesForDate(',
    'getStatsTransitionEdgesRange(',
    '_filterStatsTransitionEdges(',
    'pruneStatsTransitionEdgesToTopKForDate(',
    'pruneStatsTransitionEdgesBefore(',
    'clearStatsTransitionEdges(',
  ];
  for (const token of retiredDbManagerStatsTransitionEdgeMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: standalone transition-edge CRUD is retired; canonical transition aggregates belong to StatsAggregateStore (${token}).`);
    }
  }

  const retiredDbManagerZenArtifactMethods = [
    'putZenArtifacts(',
    'getZenArtifact(',
    'getAllZenArtifacts(',
    'deleteZenArtifacts(',
    'clearZenArtifacts(',
  ];
  for (const token of retiredDbManagerZenArtifactMethods) {
    if (indexedDbManagerSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/dbManager.js: Zen artifact CRUD belongs to ZenArtifactStore, not dbManager (${token}).`);
    }
  }

  for (const token of [
    'STORES.ZEN_ARTIFACTS',
    'getDatabase()',
    "db.transaction(STORES.ZEN_ARTIFACTS",
  ]) {
    if (!zenArtifactStoreSource.includes(token)) {
      fail(`src/platform/storage/internal/indexeddb/stores/ZenArtifactStore.js: missing Zen artifact store ownership token ${token}.`);
    }
  }

  await scanStorageSnapshotSecretDocumentPolicy();
  await scanStorageRetentionPolicy();
  await scanFrozenIndexedDbV1Contract();
  await scanFeedTempoCheckpointStorageBoundary();
  await scanFeedTopologyCertificateStorageBoundary();

  const files = await collectFiles(srcDir);
  for (const filePath of files) {
    const relativePath = toProjectRelative(filePath);
    const source = await fs.readFile(filePath, 'utf8');

    if (
      relativePath === 'src/platform/storage/internal/chrome-storage/settingsTransport.js'
      && /return\s+cloneDefaults\(\s*requested\s*\)/g.test(source)
    ) {
      fail(`${relativePath}: canonical settings read failures must surface an explicit error instead of returning requested defaults.`);
    }
    if (
      relativePath === 'src/platform/storage/internal/chrome-storage/settingsTransport.js'
    ) {
      if (!source.includes('RELAY_REJECTED')) {
        fail(`${relativePath}: settings runtime relay rejections must remain explicit instead of falling through to direct reads.`);
      }
      if (!source.includes('response && response.success === false')) {
        fail(`${relativePath}: settings runtime relay failure responses must reject before direct scoped fallback.`);
      }
      [
        'settingsCommandContract.js',
        'settingsRuntimeCommandAcknowledgement.js',
        'requireSettingsRuntimeCommandAcknowledgement(',
        'MESSAGE_ACTIONS.SET_SETTINGS,',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: settings apply transport must validate and forward the canonical commit acknowledgement token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/apps/dashboard/stores/settingsCommandBus.js') {
      [
        'settingsCommitAcknowledgement.js',
        'requireSettingsCommitAcknowledgement(result?.items, dirtyKeys)',
        'settingsDashboardCommandContract.js',
        'assertSettingsCommandChannelPatch(normalizedChannel, nextPatch)',
        'mergeKeys(Object.keys(nextPatch), pendingKeys)',
        'Object.values(channelKeys).flat()',
        'patch: acknowledgedPatch',
        'export function createSettingsCommandChannelClient(channel)',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: dashboard settings success must be derived from canonical committedItems token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/settings/config/settingsCommitAcknowledgement.js') {
      [
        'export function requireSettingsCommitAcknowledgement(',
        'export function createSettingsCommittedItems(items = {})',
        'export function buildSettingsOwnerCommandResponse(action, result = {})',
        'export function completeSettingsOwnerAcknowledgement({',
        'error.missingKeys = normalizeKeys(missingKeys)',
        'requiredCommittedKeys = []',
        'settingsSnapshot',
        'acknowledgementKeys = []',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: canonical settings acknowledgement validation must retain token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/settings/config/settingsRuntimeCommandAcknowledgement.js') {
      [
        'export function requireSettingsRuntimeCommandAcknowledgement(action, response)',
        'export function requireSettingsOwnerCommandAcknowledgement(action, response)',
        'requireSettingsRuntimeCommandContract(action)',
        'contract.acknowledgement.requireChangedKeyItemCoverage',
        'const committedItemsField = contract.acknowledgement.committedItemsField',
        'export function buildSettingsOwnerNoopAcknowledgement(action, resultFields = {})',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: runtime settings acknowledgement validation must retain token ${token}.`);
        }
      });
    }

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(source)) {
        fail(`${relativePath}: ${rule.message}`);
      }
      rule.pattern.lastIndex = 0;
    }

    if (sharedStorageImportPattern.test(source)) {
      fail(`${relativePath}: shared/storage compatibility paths are forbidden; use src/platform/storage/** instead.`);
    }
    sharedStorageImportPattern.lastIndex = 0;

    if (
      storageHelperImportPattern.test(source)
      && !allowedStorageHelperImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: raw Chrome storage helper imports are reserved for storage adapters and approved boundary modules.`);
    }
    storageHelperImportPattern.lastIndex = 0;

    if (retiredBrowserStorageImportPattern.test(source)) {
      fail(`${relativePath}: retired browserStorage compatibility path is forbidden; use localArea.js, sessionArea.js, or storageChangeBus.js.`);
    }
    retiredBrowserStorageImportPattern.lastIndex = 0;

    if (
      relativePath === 'src/platform/chrome/ChromeService.js'
      && chromeServiceStorageFacadePattern.test(source)
    ) {
      fail(`${relativePath}: ChromeService must not re-export storage facades; storage ownership lives under src/platform/storage/internal/chrome-storage/**.`);
    }
    chromeServiceStorageFacadePattern.lastIndex = 0;

    if (
      rawChromeStoragePattern.test(source)
      && !allowedRawChromeStorageFiles.has(relativePath)
    ) {
      fail(`${relativePath}: direct chrome.storage.local/session access is reserved for approved low-level modules.`);
    }
    rawChromeStoragePattern.lastIndex = 0;

    if (optionalChainChromeStorageAreaPattern.test(source)) {
      fail(`${relativePath}: direct chrome?.storage?.local/session area access is reserved for approved low-level modules.`);
    }
    optionalChainChromeStorageAreaPattern.lastIndex = 0;

    if (!allowedRawChromeStorageFiles.has(relativePath)) {
      try {
        for (const access of inspectChromeStorageAreaAccess(source)) {
          fail(`${relativePath}:${access.line}: raw storage.${access.area} area access, including aliased extension APIs, is reserved for approved low-level modules.`);
        }
      } catch (error) {
        fail(`${relativePath}: cannot inspect Chrome storage area ownership: ${error.message}`);
      }
    }

    if (
      rawChromeStorageChangedPattern.test(source)
      && !allowedRawChromeStorageChangedFiles.has(relativePath)
    ) {
      fail(`${relativePath}: raw chrome.storage.onChanged ownership is reserved for the storage change bus owner.`);
    }
    rawChromeStorageChangedPattern.lastIndex = 0;

    if (
      rawIndexedDbGlobalPattern.test(source)
      && !relativePath.startsWith('src/platform/storage/internal/indexeddb/')
    ) {
      fail(`${relativePath}: raw indexedDB/IDBKeyRange access is reserved for src/platform/storage/internal/indexeddb/**.`);
    }
    rawIndexedDbGlobalPattern.lastIndex = 0;

    if (
      /\bsessionAmnesia(?:ForBlocked|Cadence|Enabled)\b/.test(source)
    ) {
      fail(`${relativePath}: retired session-amnesia fields must not return to settings, startup, UI, or runtime policy; incompatible development profiles require an explicit reset.`);
    }

    if (automaticIndexedDbDeletePattern.test(source)) {
      fail(`${relativePath}: release V1 runtime must not delete IndexedDB automatically; use the named developer profile reset runbook.`);
    }
    automaticIndexedDbDeletePattern.lastIndex = 0;

    if (
      dbManagerImportPattern.test(source)
      && !allowedDbManagerImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: direct dbManager imports are reserved for typed stores and approved low-level modules.`);
    }
    dbManagerImportPattern.lastIndex = 0;

    const featureBoundaryRule = forbiddenFeatureSettingsServiceReferences.find(
      (rule) => rule.file === relativePath,
    );
    if (featureBoundaryRule) {
      for (const token of featureBoundaryRule.tokens) {
        if (source.includes(token)) {
          fail(`${relativePath}: feature-owned settings access must route through its named seam, not direct settings primitives (${token}).`);
        }
      }
    }

    if (relativePath === 'src/platform/storage/nudge/NudgeSettingsService.js') {
      if (
        !source.includes('CONTENT_SINGLE_ATTEMPT_NUDGE_SETTINGS_OPTIONS')
        || !source.includes('SETTINGS_CONTENT_PATCH_CONTRACT.delivery')
        || source.includes('retryDelayMs')
      ) {
        fail(`${relativePath}: content nudge settings writes must remain single-attempt so no client timer can replay an old write into a later profile generation.`);
      }
    }

    if (
      relativePath === 'src/apps/background/services/SettingsService.js'
    ) {
      if (!source.includes('./settingsCanonicalPatch.js')) {
        fail(`${relativePath}: canonical persisted patch preparation must route through settingsCanonicalPatch.js.`);
      }
      if (source.includes('./settingsCacheMigration.js')) {
        fail(`${relativePath}: release V1 settings hydration must not import a pre-release cache migration owner.`);
      }
      if (!source.includes('./settingsPostCommitEffects.js')) {
        fail(`${relativePath}: post-commit settings effect planning/diagnostics must route through settingsPostCommitEffects.js.`);
      }
      if (!source.includes('./settingsCacheState.js')) {
        fail(`${relativePath}: settings cache defaults/hydration must route through settingsCacheState.js.`);
      }
      if (source.includes('function prepareCanonicalSettingsItems')) {
        fail(`${relativePath}: prepareCanonicalSettingsItems belongs to settingsCanonicalPatch.js, not the broad service owner.`);
      }
      if (source.includes('const LOCAL_SETTINGS_DEFAULTS')) {
        fail(`${relativePath}: settings cache default shape belongs to settingsCacheState.js, not the broad service owner.`);
      }
      if (source.includes('function normalizeHashList')) {
        fail(`${relativePath}: settings cache hash normalization belongs to settingsCacheState.js, not the broad service owner.`);
      }
      if (source.includes('async function runPostCommitSettingsEffects')) {
        fail(`${relativePath}: post-commit settings effect execution belongs to BackgroundSettingsPropagationCoordinator, not the broad service owner.`);
      }
      if (source.includes('function logSettingsFlowFailure')) {
        fail(`${relativePath}: settings flow failure diagnostics belong to settingsPostCommitEffects.js, not the broad service owner.`);
      }
      if (source.includes('resolveDataCollectionModeFromTrackingScope(')) {
        fail(`${relativePath}: release V1 must not decode the retired trackingScope key.`);
      }
      if (source.includes('const migrationPatch = {}')) {
        fail(`${relativePath}: release V1 settings hydration must not assemble a migration patch.`);
      }
      if (source.includes('next.trackingScope = resolveTrackingScopeFromDataCollectionMode')) {
        fail(`${relativePath}: release V1 settings writes must not emit the retired trackingScope mirror.`);
      }
      if (source.includes('settingsCache.trackingScope =')) {
        fail(`${relativePath}: settings cache must carry canonical dataCollectionMode only.`);
      }
      [
        'let settingsMutationTail = Promise.resolve()',
        'function enqueueSettingsMutation',
        './settingsTrackingPolicyBoundary.js',
        'changesTrackingPolicyBoundary(settingsCache, canonicalItems)',
        'commitResult = await trackingPolicyMutationOwner({ commit })',
        'SETTINGS_TRACKING_POLICY_MUTATION_OWNER_REQUIRED',
        'SETTINGS_TRACKING_POLICY_MUTATION_OWNER_ALREADY_BOUND',
        'if (settingsCacheLoaded) return Promise.resolve()',
        'function settleSettingsCacheHydration(request, error)',
        'settingsCacheLoadSettlement !== request',
        'settingsCacheLoadSettlement === request ? ensureSettingsCacheNow() : undefined',
        'prepareCanonicalSettingsItems(normalizedItems, settingsCache, { now: policyBoundaryAt })',
        'function applySettingsCache(items = {}, { previousScope = null } = {})',
        'function invalidateSettingsObservation()',
        'getSettingsCollectionScopeSignature(settingsCache)',
        'collectionAdmission.beforeChange(settingsCache,',
        'options?.persist === true',
        'if (persist && !settingsCacheLoaded)',
        'function refreshSettingsCacheNow',
        'return enqueueSettingsMutation(refreshSettingsCacheNow)',
        'function commitSettingsMutation',
        'assertGenericSettingsMutationAllowed(options?.items)',
        'const preparedItems = prepare(cloneSettingsMutationSnapshot(settingsCache))',
        'items = cloneSettingsMutationSnapshot(preparedItems)',
        'if (preparedItems instanceof Promise)',
        'SETTINGS_MUTATION_SNAPSHOT_CLONE_REQUIRED',
        'SETTINGS_MUTATION_SNAPSHOT_CLONE_FAILED',
        'SETTINGS_MUTATION_PREPARE_ASYNC_FORBIDDEN',
        'SETTINGS_MUTATION_PREPARE_REENTRANT',
        'function runExclusiveExternalSettingsMutation',
        'requireExternalSettingsMutationOutcome',
        'SETTINGS_EXTERNAL_MUTATION_REENTRANT',
        'SETTINGS_EXTERNAL_MUTATION_ASYNC_OWNER_FORBIDDEN',
        'FULL_SETTINGS_RECONCILE_CHANGED_KEYS',
        'const reconcileRequired = settingsChanged',
        'shouldSyncBlockedBookmarks: true',
        'shouldRunRuntimeAdapters: true',
        'shouldSyncScripts: true',
        'shouldBroadcast: true',
        'waitForCompletion: false',
        'changePipeline.waitForPostCommitSettingsTask(',
        'SETTINGS_EXTERNAL_MUTATION_PROPAGATION_RECEIPT_INVALID',
        'settingsReconciliation',
        'settingsCacheLoaded = false',
        'shouldRunRuntimeSettingsAdapters,',
        'const shouldRunRuntimeAdapters = shouldRunRuntimeSettingsAdapters(nextChangedKeys);',
        'settingsCommitAcknowledgement.js',
        'createSettingsCommittedItems(canonicalItems)',
        'committedItems,',
        'changePipeline.schedulePostCommitSettingsEffects({',
        'waitForCompletion: !persist',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: serialized commit acknowledgement and coordinator scheduling must retain token ${token}.`);
        }
      });
      const publicApiStart = source.lastIndexOf('\n  return {\n');
      if (publicApiStart < 0) {
        fail(`${relativePath}: settings service public API return must remain explicit.`);
      } else {
        const publicApiSource = source.slice(publicApiStart);
        [
          'applySettingsCache',
          'markCacheLoaded',
        ].forEach((token) => {
          const exposedPropertyPattern = new RegExp(`^\\s*${token}\\s*(?:,|:)`, 'mu');
          if (exposedPropertyPattern.test(publicApiSource)) {
            fail(`${relativePath}: canonical cache truth mutation must not be exposed through the public service API token ${token}.`);
          }
        });
        if (!/^\s*runExclusiveExternalSettingsMutation\s*(?:,|:)/mu.test(publicApiSource)) {
          fail(`${relativePath}: external/full-document settings mutations must expose the named exclusive owner seam.`);
        }
      }
    }

    if (relativePath === 'src/domains/settings/config/settingsUpdateKeys.js') {
      [
        'FULL_SETTINGS_RECONCILE_CHANGED_KEYS',
        '...SETTINGS_CACHE_REFRESH_KEYS',
        '...CONTENT_SCRIPT_SYNC_KEYS',
        '...PROTECTION_BROADCAST_KEYS',
        'TRACKING_RUNTIME_ADAPTER_KEYS',
        'CLSE_RUNTIME_ADAPTER_KEYS',
        'RUNTIME_SETTINGS_ADAPTER_KEYS',
        '...RUNTIME_SETTINGS_ADAPTER_KEYS',
        'shouldRunTrackingBoundaryAdapter',
        'shouldRunRuntimeSettingsAdapters',
        "'clse_enabled'",
        "'clse_sensitivity_scale'",
        "'clse_alert_cooldown_ms'",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: full external settings reconciliation must retain token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/apps/background/services/runtime/support/BackgroundTrackingBoundaryAdapter.js') {
      [
        '../../../../../domains/settings/config/settingsUpdateKeys.js',
        'shouldRunTrackingBoundaryAdapter(changedKeys)',
        'export function createTrackingPolicyMutationOwner(',
        'return runStatsMutationBatch(async ({ now, dateStr }) =>',
        'await sealActiveSegment(now, { reopen: true, skipCacheLoad: true, dateStr,',
        'return commit(now, () => primeActiveTrackingBoundary(now))',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: active tracking-boundary routing must use the canonical settings changed-key predicate token ${token}.`);
        }
      });
      if (source.includes('TRACKING_BOUNDARY_CHANGED_KEYS')) {
        fail(`${relativePath}: tracking runtime changed keys belong to settingsUpdateKeys.js, not a duplicate adapter-local set.`);
      }
    }

    if (relativePath === 'src/domains/settings/config/settingsMutationOwnership.js') {
      [
        'settingsCommandContract.js',
        'collectSettingsOwnerMutationKeys as collectRegisteredOwnerMutationKeys',
        "typeof contract.mutationOwner === 'string'",
        "new Error('SETTINGS_OWNER_COMMAND_REQUIRED')",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: generic writes must retain the explicit owner-only settings boundary token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/settings/config/settingsCommandContract.js') {
      [
        'export const SETTINGS_KEY_COMMAND_CONTRACTS = Object.freeze({',
        'export const SETTINGS_RUNTIME_COMMAND_CONTRACTS = Object.freeze({',
        'export function assertSettingsCommandMutationValues(items = {})',
        'export function canonicalizeSettingsCommandItems(items = {}, settingsCache = {})',
        'privilegedWriteAcknowledgement: true',
        'changedKeysAreSemanticEffects: true',
        'requireChangedKeyItemCoverage: false',
        'requireChangedKeyItemCoverage: true',
        '[MESSAGE_ACTIONS.UPSERT_SITE_RULE]',
        '[MESSAGE_ACTIONS.REMOVE_SITE_RULE]',
        '[MESSAGE_ACTIONS.UPDATE_SITE_RULE]',
        '[MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET]',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: domain-owned settings command metadata must retain token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/settings/config/settingsDashboardCommandContract.js') {
      [
        'export const SETTINGS_COMMAND_CHANNEL_CONTRACTS = Object.freeze(Object.fromEntries(',
        'export function requireSettingsCommandChannelContract(channel)',
        'export function assertSettingsCommandChannelPatch(channel, patch = {})',
        'export function assertSettingsCommandChannelKeys(channel, keys = [])',
        'requireAllPendingKeys: true',
        'requireAllSubmittedKeys: true',
        'transportRetryCount: 0',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: dashboard settings command metadata must retain token ${token}.`);
        }
      });
    }

    if (
      source.includes('securitySettingsMutationSchema.js')
      || source.includes('settingsOwnerCommandAcknowledgement.js')
    ) {
      fail(`${relativePath}: retired duplicate settings contract modules must not be referenced.`);
    }

    if (relativePath === 'src/domains/tracking/background/trackingMessagePolicies/settingsAccessPolicy.js') {
      [
        'collectSettingsOwnerMutationKeys(items)',
        "error: 'SETTINGS_OWNER_COMMAND_REQUIRED'",
        'forbiddenKeys: ownerKeys',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: privileged generic SET_SETTINGS writes must still reject owner-only mutation keys token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js') {
      const setSettingsHandlerIndex = source.indexOf('[MESSAGE_ACTIONS.SET_SETTINGS]');
      const validationIndex = source.indexOf(
        'assertSettingsCommandMutationValues(items);',
        setSettingsHandlerIndex,
      );
      const persistenceIndex = source.indexOf(
        'await resolvedSettingsService.applySettingsChange({',
        setSettingsHandlerIndex,
      );
      if (
        setSettingsHandlerIndex < 0
        || validationIndex < 0
        || persistenceIndex < 0
        || validationIndex > persistenceIndex
      ) {
        fail(`${relativePath}: SET_SETTINGS must validate security values before the generic persistence call.`);
      }
    }

    if (
      relativePath === 'src/domains/tracking/background/siteRuleCommandService.js'
      || relativePath === 'src/domains/protection/background/protectionPresetCommandService.js'
    ) {
      [
        'settingsService.commitSettingsMutation({',
        'prepare: (settingsCache) =>',
        'completeSettingsOwnerAcknowledgement({',
        'settingsCommitAcknowledgement.js',
        'committedItems: result?.committedItems',
        'preparedItems',
        'requiredCommittedKeys:',
        'settingsSnapshot',
        'acknowledgementKeys',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: cross-key owner commands must derive and commit inside the serialized settings mutation lane token ${token}.`);
        }
      });
      [
        'settingsService.applySettingsChange({',
        'await settingsService.ensureSettingsCache()',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: cross-key owner commands must not read or commit outside commitSettingsMutation token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/siteRuleCommandService.js') {
      [
        'assessSiteRuleAdmission({',
        'SITE_RULE_ADMISSION_REJECTED',
        'confirmExactMove === true',
        "createSiteRuleCommandError('INVALID_SITE_RULE_TYPE'",
        "createSiteRuleCommandError('SITE_RULE_BLOCKED_TARGET_REQUIRED'",
        'blockedUrls.includes(normalizedDomain)',
        'buildResolvedProtectionPresetCatalog(',
        'PROTECTION_PRESET_NOT_FOUND',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: site-rule owner must enforce latest-cache admission and preset integrity token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/trackingPopupBlockFlow.js') {
      [
        'upsertPendingPopupBlockedSite',
        'await upsertPendingPopupBlockedSite({ domain })',
        'TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_OWNER_REQUIRED',
        'TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_RESULT_INVALID',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: permission-ready popup blocks must route through the canonical site-rule owner token ${token}.`);
        }
      });
      [
        'applyPendingPopupProtectPatch',
        'const nextBlockedUrls',
        'const nextSiteGoals',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: popup queue processing must not derive whole settings arrays/maps outside the site-rule mutation lane token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/apps/background/services/runtime/backgroundKernelCoreServices.js') {
      [
        'createSiteRuleCommandService',
        'const siteRuleCommandService = createSiteRuleCommandService({ settingsService })',
        'upsertPendingPopupBlockedSite: ({ domain }) => siteRuleCommandService.upsertSiteRule({',
        "actionReason: 'popup_block_domain'",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: popup queued block composition must inject the canonical site-rule command owner token ${token}.`);
        }
      });
      if (source.includes('applyPendingPopupProtectPatch:')) {
        fail(`${relativePath}: popup queued blocks must not be wired to the generic settings patch writer.`);
      }
    }

    if (relativePath === 'src/domains/protection/background/protectionPresetCommandService.js') {
      [
        'const hasExplicitSource',
        '!resolvedCatalog[explicitSourceId]',
        'const basePreset = resolvedCatalog[basePresetId]',
        "createProtectionPresetCommandError('PROTECTION_PRESET_NOT_FOUND'",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: selected preset clone sources must fail instead of falling back token ${token}.`);
        }
      });
      if (source.includes('resolvedCatalog[DEFAULT_PROTECTION_PRESET_ID]')) {
        fail(`${relativePath}: a missing selected preset clone source must not silently substitute the default preset.`);
      }
    }

    if (relativePath === 'src/domains/tracking/background/trackingMessageHandlers/settingsHandlers.js') {
      [
        "if (hasOwnProperty(request, 'goalMinutes'))",
        "if (hasOwnProperty(request, 'presetId'))",
        'confirmExactMove: request?.confirmExactMove === true',
        'settleRequestedPropagation(result, {',
        'buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.UPSERT_SITE_RULE, settledResult)',
        'buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.REMOVE_SITE_RULE, settledResult)',
        'buildSettingsOwnerCommandResponse(MESSAGE_ACTIONS.UPDATE_SITE_RULE, settledResult)',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: partial site-rule intent and confirmed move fields must remain explicit token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/platform/storage/internal/chrome-storage/settingsTransport.js') {
      [
        'async function runOwnerRuntimeCommand(',
        'async function runSettingsOwnerCommandViaRuntime(action, input = {}, options = {})',
        'requireSettingsRuntimeCommandAcknowledgement(action, response)',
        'listSettingsOwnerCommandContracts().map((contract)',
        'buildSettingsRuntimeCommandRequest(action, input)',
        "formatSettingsApplyFlowLog('owner_command_ack_invalid'",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: owner-specific settings commands must use the single reliable command runner and reject invalid canonical ACK token ${token}.`);
        }
      });
      [
        'runSiteRuleRuntimeCommand',
        'runProtectionPresetRuntimeCommand',
        'mapResponse:',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: owner-specific settings commands must not restore duplicated runners or response reconstruction token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/apps/dashboard/stores/protocolRulesSlice.js') {
      if (source.includes('buildProtocolSiteRuleMovePatch')) {
        fail(`${relativePath}: site-rule moves must route through the atomic background owner instead of assembling a dashboard cross-key patch.`);
      }
      [
        'moveSiteRule: async',
        'execute: () => upsertProtocolSiteRule({',
        'confirmExactMove: true',
        'performedMove: !result?.error',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: site-rule move ownership must retain atomic owner token ${token}.`);
        }
      });
    }

    if (
      relativePath === 'src/apps/dashboard/stores/protocolStoreHelpers.js'
      && source.includes('function buildProtocolSiteRuleMovePatch')
    ) {
      fail(`${relativePath}: dashboard helpers must not reconstruct the cross-key site-rule move patch.`);
    }

    if (
      relativePath === 'src/apps/background/services/settingsCanonicalPatch.js'
    ) {
      if (!source.includes('canonicalizeSettingsCommandItems(source, settingsCache)')) {
        fail(`${relativePath}: every canonical persistent path must use the domain-owned key validation and canonicalization registry.`);
      }
      if (source.includes('resolveDataCollectionModeFromSettingsInput(') || source.includes('trackingScope')) {
        fail(`${relativePath}: release V1 writes must accept canonical dataCollectionMode only.`);
      }
      if (source.includes('next.trackingScope = resolveTrackingScopeFromDataCollectionMode')) {
        fail(`${relativePath}: release V1 settings writes must not emit the retired trackingScope mirror.`);
      }
      if (source.includes('next.trackingScope = undefined')) {
        fail(`${relativePath}: release V1 writes must not carry retired-key cleanup behavior.`);
      }
    }

    if (relativePath === 'src/domains/settings/config/settingsCommandRequestBuilders.js') {
      [
        'export function buildSettingsRuntimeCommandRequest(action, input = {})',
        '[MESSAGE_ACTIONS.UPSERT_SITE_RULE]',
        '[MESSAGE_ACTIONS.REMOVE_SITE_RULE]',
        '[MESSAGE_ACTIONS.UPDATE_SITE_RULE]',
        '[MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET]',
        '[MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET]',
        "throw createCommandInputError('SETTINGS_COMMAND_REQUEST_BUILDER_REQUIRED')",
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: owner command request construction must retain token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/apps/background/services/settingsCacheMigration.js') {
      fail(`${relativePath}: pre-release settings migration owner must not exist in the release V1 tree.`);
    }

    if (
      relativePath === 'src/apps/background/services/settingsCacheState.js'
    ) {
      if (!source.includes('export function createDefaultSettingsCache')) {
        fail(`${relativePath}: settings cache owner must expose createDefaultSettingsCache().`);
      }
      if (!source.includes('export function buildSettingsCacheDefaults')) {
        fail(`${relativePath}: settings cache owner must expose buildSettingsCacheDefaults().`);
      }
      if (!source.includes('export function applySettingsCacheItems')) {
        fail(`${relativePath}: settings cache owner must expose applySettingsCacheItems().`);
      }
      if (source.includes('resolveDataCollectionModeFromSettingsInput(') || source.includes('trackingScope')) {
        fail(`${relativePath}: release V1 settings cache must accept canonical dataCollectionMode only.`);
      }
      if (!source.includes('SETTINGS_CACHE_STATE_REQUIRED')) {
        fail(`${relativePath}: missing cache state must fail loudly.`);
      }
      if (!source.includes('[CYCLE_SETTINGS_KEY]: undefined') || !source.includes('readCycleSettingsRecord(cycleSettings)')) {
        fail(`${relativePath}: cycle reset policy cache hydration must preserve missing-key bootstrap and exact present-value validation.`);
      }
    }

    if (
      relativePath === 'src/platform/storage/internal/chrome-storage/stores/SettingsStore.js'
    ) {
      [
        '#documentWriteQueue',
        '#enqueueDocumentWrite',
        'this.#enqueueDocumentWrite(() => removeChromeStorageLocal(SETTINGS_DOCUMENT_KEYS))',
        'queuedOperation.catch(() => undefined)',
        'flattenStoredSettingsDocuments as flattenSettingsDocuments',
        'requireSettingsStoredDocument as requireSettingsDocument',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: settings document writes must share the instance serialization queue token ${token}.`);
        }
      });
      // Every typed write reserves its FIFO place synchronously. Current-only
      // storage has no startup repair or initialization write to race this lane.
      const queuedWriterContracts = [
        ['writeDocuments', /(?:^|\n)\s*writeDocuments\(documents\s*=\s*\{\},\s*options\s*=\s*\{\}\)\s*\{\s*return this\.#enqueueDocumentWrite\(async\s*\(\)\s*=>\s*\{\s*return writeSettingsDocuments\(documents,\s*options\);\s*\}\);\s*\}/u],
        ['commitItems', /(?:^|\n)\s*commitItems\(items\s*=\s*\{\}\)\s*\{\s*return this\.#enqueueDocumentWrite\(async\s*\(\)\s*=>\s*\{\s*return setSettingsItems\(items\);\s*\}\);\s*\}/u],
        ['#enqueueDocumentWrite', /(?:^|\n)\s*#enqueueDocumentWrite\(operation\)\s*\{\s*const queuedOperation\s*=\s*this\.#documentWriteQueue\.then\(\(\)\s*=>\s*operation\(\)\);\s*this\.#documentWriteQueue\s*=\s*queuedOperation\.catch\(\(\)\s*=>\s*undefined\);\s*return queuedOperation;\s*\}/u],
        ['set', /(?:^|\n)\s*set\(items\s*=\s*\{\}\)\s*\{\s*return this\.commitItems\(items\)\.then\(\(\{\s*changedKeys\s*\}\)\s*=>\s*changedKeys\);\s*\}/u],
        ['clear', /(?:^|\n)\s*async clear\(\)\s*\{\s*await this\.#enqueueDocumentWrite\(\(\)\s*=>\s*removeChromeStorageLocal\(SETTINGS_DOCUMENT_KEYS\)\);\s*\}/u],
      ];
      queuedWriterContracts.forEach(([method, pattern]) => {
        if (!pattern.test(source)) {
          fail(`${relativePath}: ${method} must preserve invocation-time FIFO admission and the canonical typed writer.`);
        }
      });
      if (/initializeNotificationJourney|#initialize\(|#initializationPromise/u.test(source)) {
        fail(`${relativePath}: current-only settings storage must not retain startup notification repair.`);
      }

    }

    if (relativePath === 'src/platform/storage/settings/settingsStoredValueContract.js') {
      ['projectCanonicalStoredSetting', 'areValuesEqual(canonical, storedValue)',
        'requireSettingsStoredDocument', 'flattenStoredSettingsDocuments'].forEach((token) => {
        if (!source.includes(token)) fail(`${relativePath}: exact physical settings validation must retain ${token}.`);
      });
      if (/\b(?:writeChromeStorageLocal|removeChromeStorageLocal)\b/u.test(source)) {
        fail(`${relativePath}: validation must never repair, persist, or erase a stored value.`);
      }
    }
    if (relativePath === 'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js'
      && /\bfrom\s+['"][^'"]*(?:domains|themes)\//u.test(source)) {
      fail(`${relativePath}: the boot-safe topology registry must not import domain or theme value validators.`);
    }

    if (relativePath === 'src/platform/storage/runtime/CycleSettingsRepository.js') {
      fail(`${relativePath}: cycle reset policy settings belong to the named SettingsService owner; the parallel runtime repository must not return.`);
    }

    if (relativePath === 'src/domains/tracking/background/cycleResetPolicySettingsOwner.js') {
      [
        'resolvedSettingsService.commitSettingsMutation',
        'result?.committedItems?.[CYCLE_SETTINGS_KEY]',
        'CYCLE_RESET_POLICY_COMMIT_FAILED',
        'CYCLE_RESET_POLICY_COMMIT_ACK_INVALID',
        'expectedRevision',
        'mutationTail',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: cycle reset policy must retain canonical SettingsService commit ownership token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/cycleRuntimeCheckpointOwner.js') {
      [
        'resolvedStore.readOptional()',
        'CYCLE_RUNTIME_CHECKPOINT_COMMIT_FAILED',
        'writeTail',
        'enqueueWrite',
        'cloneCheckpoint',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: cycle checkpoint must retain presence-aware serialized snapshot ownership token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/CycleStateManager.js') {
      [
        './cycleResetPolicySettingsOwner.js',
        './cycleRuntimeCheckpointOwner.js',
        "actionReason: 'cycle_activity_touch'",
        'expectedRevision: policyRevision',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: cycle facade must retain split-owner orchestration token ${token}.`);
        }
      });
      ['saveCycleState(', 'cycleSettingsStore.set(', 'void saveCycleState'].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: combined settings/session cycle persistence is forbidden token ${token}.`);
        }
      });
    }

    if (relativePath === 'src/domains/tracking/background/trackingBrowserEventHandlers.js') {
      const awaitedTouches = source.match(/await cycleStateManager\.touchActivity\(now\);/g) || [];
      if (awaitedTouches.length !== 2) {
        fail(`${relativePath}: both foreground activity paths must await the canonical cycle checkpoint commit.`);
      }
    }

    if (
      relativePath === 'src/platform/storage/settings/SettingsPersistenceCapability.js'
    ) {
      if (!source.includes('SETTINGS_MALFORMED_VALUE')) {
        fail(`${relativePath}: malformed canonical settings values must have an explicit boundary error.`);
      }
      if (!source.includes('function assertPlainSettingsValue')) {
        fail(`${relativePath}: canonical object-valued settings must validate owner payload shape before caching or persistence.`);
      }
      [
        'function collectChangedFilterFeatureKeys',
        'const physicalChangedKeySet = new Set(physicalChangedKeys)',
        'if (physicalChangedKeySet.has(key)) nextChangedKeys.add(key)',
        'nextChangedKeys.add(toFilterSettingsFeatureChangedKey(featureKey))',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: settings persistence must preserve semantic changed-key ownership token ${token}.`);
        }
      });
      [
        'items.filterSettings ||',
        'payload.filterSettings ||',
        'filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS',
        'this.filterSettingsCache = payload.filterSettings ||',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: filterSettings must not default malformed canonical payloads through fallback token ${token}.`);
        }
      });
    }

    if (
      relativePath === 'src/apps/background/services/settingsPostCommitEffects.js'
    ) {
      if (!source.includes('export function buildPostCommitSettingsEffectPlan')) {
        fail(`${relativePath}: post-commit planning must expose buildPostCommitSettingsEffectPlan().`);
      }
      [
        'export function hasPostCommitSettingsWork',
        'export function describeSettingsError',
        'export function logSettingsFlowFailure',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: post-commit plan/diagnostic helper must expose token ${token}.`);
        }
      });
      [
        'runPostCommitSettingsEffects',
        'SETTINGS_POST_COMMIT_EFFECT_REQUIRED',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: ordered post-commit execution belongs only to BackgroundSettingsPropagationCoordinator; retired executor token ${token} is forbidden.`);
        }
      });
    }

    if (source.includes('STORAGE_SESSION_KEYS.TAB_EVAPORATION')
      && relativePath !== 'src/platform/storage/runtime/TabEvaporationCheckpointRepository.js') {
      fail(`${relativePath}: tab inactivity checkpoint access belongs only to TabEvaporationCheckpointRepository.`);
    }
    if (relativePath === 'src/platform/storage/runtime/TabEvaporationCheckpointRepository.js') {
      [
        "from './RuntimeSessionRepository.js'",
        'requireTabEvaporationCheckpoint',
        'this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.TAB_EVAPORATION)',
        'this.sessionRepository.remove(STORAGE_SESSION_KEYS.TAB_EVAPORATION)',
        'TAB_EVAPORATION_CHECKPOINT_INVALID',
        'TAB_EVAPORATION_CHECKPOINT_TAB_INVALID',
        'TAB_EVAPORATION_CHECKPOINT_READ_INVALID',
      ].forEach(token => {
        if (!source.includes(token)) fail(`${relativePath}: typed inactivity checkpoint contract is missing ${token}.`);
      });
    }
    if (relativePath === 'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js'
      && !source.includes("TAB_EVAPORATION: 'runtime.tab_evaporation'")) {
      fail(`${relativePath}: tab inactivity must use its registered session checkpoint key.`);
    }

    if (
      relativePath === 'src/platform/storage/runtime/SettingsPropagationCheckpointRepository.js'
    ) {
      [
        'const CHECKPOINT_VERSION = 1',
        'normalizeSettingsPropagationCheckpoint',
        'STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION',
        'async writePending(task)',
        'async writeFailed(task, outcome)',
        'return this.sessionRepository.remove(STORAGE_SESSION_KEYS.SETTINGS_PROPAGATION)',
        'SETTINGS_PROPAGATION_CHECKPOINT_INVALID',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: durable settings propagation checkpoint contract is missing token ${token}.`);
        }
      });
    }

    if (
      relativePath === 'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js'
      && !source.includes("SETTINGS_PROPAGATION: 'runtime.settings_propagation'")
    ) {
      fail(`${relativePath}: runtime.settings_propagation must remain a canonical session checkpoint key.`);
    }

    if (relativePath === 'src/apps/background/services/boot/BootPrewarmService.js') {
      if (source.includes('resolveDataCollectionModeFromSettingsInput(') || source.includes('trackingScope')) {
        fail(`${relativePath}: release V1 prewarm accepts canonical dataCollectionMode only.`);
      }
      [
        'BOOT_PREWARM_SETTINGS_SERVICE_REQUIRED',
        'BOOT_PREWARM_SETTINGS_CACHE_READER_REQUIRED',
        'BOOT_PREWARM_SETTINGS_CACHE_INVALID',
        'BOOT_PREWARM_ANALYSIS_SNAPSHOT_OWNER_REQUIRED',
        'BOOT_PREWARM_CYCLE_STATE_OWNER_REQUIRED',
        'BOOT_PREWARM_CLSE_STATUS_OWNER_REQUIRED',
        'BOOT_PREWARM_CLSE_STATUS_INVALID',
        'sensitivityScale: clseStatus.sensitivityScale',
        'alertCooldownMs: clseStatus.alertCooldownMs',
      ].forEach((token) => {
        if (!source.includes(token)) {
          fail(`${relativePath}: missing prewarm owner visibility token ${token}.`);
        }
      });
      [
        'settingsService?.ensureSettingsCache',
        "typeof getSettingsCache === 'function'",
        "typeof getAnalysisBootstrapSnapshot === 'function'",
        "typeof getCycleState === 'function'",
        "typeof getCLSEStatus === 'function'",
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: prewarm must require owner paths instead of optional fallback token ${token}.`);
        }
      });
      if (source.includes('resolveDataCollectionModeFromTrackingScope(')) {
        fail(`${relativePath}: protocol prewarm must not decode retired trackingScope input.`);
      }
      if (source.includes('resolveTrackingScopeFromDataCollectionMode(')) {
        fail(`${relativePath}: protocol prewarm must carry canonical dataCollectionMode only.`);
      }
      [
        'filterSettings || CONFIG_DEFAULT_FILTER_SETTINGS',
        'CONFIG_DEFAULT_FILTER_SETTINGS',
        'readSettingsCache() || {}',
        'settingsCache?.filterSettings && typeof settingsCache.filterSettings ===',
      ].forEach((token) => {
        if (source.includes(token)) {
          fail(`${relativePath}: protocol prewarm must not default malformed canonical filterSettings through fallback token ${token}.`);
        }
      });
      if (source.includes('[BootPrewarmService] Failed to build prewarm snapshot.')) {
        fail(`${relativePath}: prewarm build failures must reject so bootstrap/debug diagnostics can report them, not return cached snapshots silently.`);
      }
    }

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenMainStorageCompatImportPattern.test(source)
    ) {
      fail(`${relativePath}: Zen theme code must route main workspace selection and latent scratchpad access through the explicit state/classic seams; ZenMainStorage is retired.`);
    }
    zenMainStorageCompatImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenModelRepositoryPlatformImportPattern.test(source)
      && !allowedZenModelRepositoryPlatformImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: Zen theme code must route model repository access through src/themes/plugins/zen/state/ZenModelRepository.js, not platform storage owner modules.`);
    }
    zenModelRepositoryPlatformImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenWorkspacePlatformImportPattern.test(source)
      && !allowedZenWorkspacePlatformImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: Zen theme code must route workspace page-local persistence through src/themes/plugins/zen/state/ZenWorkspaceState.js, not platform storage owner modules.`);
    }
    zenWorkspacePlatformImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenUiLocalStoragePlatformImportPattern.test(source)
      && !allowedZenUiLocalStoragePlatformImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: production Zen UI-local state must route through src/themes/plugins/zen/state/ZenProductionUiState.js.`);
    }
    zenUiLocalStoragePlatformImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenThemeModelStatePlatformImportPattern.test(source)
      && !allowedZenThemeModelStatePlatformImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: Zen theme code must route theme model-state seams through src/themes/plugins/zen/state/ZenThemeModelState.js.`);
    }
    zenThemeModelStatePlatformImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && zenRetiredPageLocalCleanupPlatformImportPattern.test(source)
    ) {
      fail(`${relativePath}: release V1 Zen code must not import the retired page-local cleanup seam.`);
    }
    zenRetiredPageLocalCleanupPlatformImportPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && localStorageAccessPattern.test(source)
      && !allowedZenLocalStorageFiles.has(relativePath)
    ) {
      fail(`${relativePath}: Zen feature code must route localStorage access through ZenWorkspaceState or approved wrappers.`);
    }
    localStorageAccessPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/domains/settings/config/')
      && localStorageAccessPattern.test(source)
    ) {
      fail(`${relativePath}: settings config code must route page-local cache/debug storage through src/platform/browser/**.`);
    }
    localStorageAccessPattern.lastIndex = 0;

    if (
      themePreferenceMirrorPattern.test(source)
      && !allowedThemePreferenceMirrorFiles.has(relativePath)
    ) {
      fail(`${relativePath}: app-theme localStorage mirror access must route through src/themes/core/state/themePreferenceMirror.js.`);
    }
    themePreferenceMirrorPattern.lastIndex = 0;

    if (
      localStorageAccessPattern.test(source)
      && !allowedRawLocalStorageAccessFiles.has(relativePath)
    ) {
      fail(`${relativePath}: raw localStorage access is reserved for explicit page-local wrappers and approved mirror owners.`);
    }
    localStorageAccessPattern.lastIndex = 0;

    if (
      relativePath.startsWith('src/themes/plugins/zen/')
      && modelStateStoreImportPattern.test(source)
      && !allowedZenModelStateFiles.has(relativePath)
    ) {
      fail(`${relativePath}: Zen feature code must route ModelStateStore access through ZenThemeModelState.`);
    }
    modelStateStoreImportPattern.lastIndex = 0;

    if (
      modelStateRepositoryImportPattern.test(source)
      && !allowedModelStateRepositoryImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: direct ModelStateRepository imports are reserved for storage owners and background composition roots.`);
    }
    modelStateRepositoryImportPattern.lastIndex = 0;

    if (
      faviconStoreImportPattern.test(source)
      && !allowedFaviconStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: favicon cache access must route through src/platform/storage/assets/FaviconRepository.js.`);
    }
    faviconStoreImportPattern.lastIndex = 0;

    if (
      /^(?:src\/apps\/|src\/ui-kit\/|src\/themes\/|src\/domains\/(?!tracking\/background\/))/.test(relativePath)
      && source.includes('MESSAGE_ACTIONS.GET_FAVICON_DATA')
    ) {
      fail(`${relativePath}: presentation favicon reads must use platform/storage/assets/FaviconQueryService.js for shared caching and invalidation.`);
    }

    if (
      relativePath === 'src/domains/tracking/background/FaviconService.js'
      && /\btabTimeTracker\b|\.getDomainCache\(|\.updateDomainCache\(/.test(source)
    ) {
      fail(`${relativePath}: favicon bytes and capture state must not use TabTimeTracker URL bookkeeping.`);
    }

    if (
      clseStoreImportPattern.test(source)
      && !allowedClseStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: CLSE persistence access must route through src/platform/storage/clse/ClseRepository.js.`);
    }
    clseStoreImportPattern.lastIndex = 0;

    if (
      bootstrapSnapshotStoreImportPattern.test(source)
      && !allowedBootstrapSnapshotStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: bootstrap snapshot access must route through src/platform/storage/bootstrap/BootstrapSnapshotRepository.js.`);
    }
    bootstrapSnapshotStoreImportPattern.lastIndex = 0;

    if (
      clseSettingsStoreImportPattern.test(source)
      && !allowedClseSettingsStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: CLSE settings access must route through src/platform/storage/clse/ClseSettingsQueryService.js.`);
    }
    clseSettingsStoreImportPattern.lastIndex = 0;

    if (
      keyStoreImportPattern.test(source)
      && !allowedKeyStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: key material access must route through src/platform/storage/security/KeyMaterialRepository.js or approved low-level adapters.`);
    }
    keyStoreImportPattern.lastIndex = 0;

    if (
      settingsStoreImportPattern.test(source)
      && !allowedSettingsStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: settings document access must route through src/platform/storage/settings/SettingsDocumentRepository.js or approved low-level adapters.`);
    }
    settingsStoreImportPattern.lastIndex = 0;

    if (
      eventLogStoreImportPattern.test(source)
      && !allowedEventLogStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: event log access must route through src/platform/storage/logs/EventLogRepository.js.`);
    }
    eventLogStoreImportPattern.lastIndex = 0;

    if (
      statsAggregateStoreImportPattern.test(source)
      && !allowedStatsAggregateStoreImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: stats aggregate access must route through src/platform/storage/stats/StatsAggregateRepository.js.`);
    }
    statsAggregateStoreImportPattern.lastIndex = 0;

    if (
      statsFeaturePackStoreImportPattern.test(source)
      && !allowedStatsFeaturePackStoreImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: dormant stats feature-pack store imports are limited to exact V1 preflight and the lifecycle-only repository.`);
    }
    statsFeaturePackStoreImportPattern.lastIndex = 0;

    if (
      interventionEffectStoreImportPattern.test(source)
      && !allowedInterventionEffectStoreImportFiles.has(relativePath)
    ) {
      fail(`${relativePath}: intervention effect access must route through src/platform/storage/stats/InterventionEffectRepository.js.`);
    }
    interventionEffectStoreImportPattern.lastIndex = 0;

    if (
      runtimeLanguageStoreImportPattern.test(source)
      && !allowedRuntimeLanguageStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: runtime language access must route through src/platform/storage/settings/RuntimeLanguageRepository.js.`);
    }
    runtimeLanguageStoreImportPattern.lastIndex = 0;

    if (
      workerRuntimeEventStoreImportPattern.test(source)
      && !allowedWorkerRuntimeEventStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: worker runtime event persistence must route through src/platform/storage/runtime/WorkerRuntimeEventRepository.js.`);
    }
    workerRuntimeEventStoreImportPattern.lastIndex = 0;

    if (
      /(?:import|export)\s+[^;]+from\s*['"][^'"]*WorkerRuntimeEventCapability\.js['"]/u.test(source)
      && relativePath !== 'src/apps/background/services/runtime/BackgroundAppKernel.js'
    ) {
      fail(`${relativePath}: the worker runtime event writer capability belongs to the background composition root.`);
    }
    if (
      source.includes('configureWorkerRuntimeEventPersistencePort')
      && relativePath !== 'src/platform/storage/runtime/WorkerRuntimeEventRepository.js'
      && relativePath !== 'src/apps/background/services/runtime/BackgroundAppKernel.js'
    ) {
      fail(`${relativePath}: only the background composition root may install the worker-event local persistence port.`);
    }

    if (
      settingsPersistenceAdapterImportPattern.test(source)
      && !allowedSettingsPersistenceAdapterImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: settings persistence adapter is an implementation detail behind src/platform/storage/settings/SettingsPersistenceCapability.js.`);
    }
    settingsPersistenceAdapterImportPattern.lastIndex = 0;

    if (
      settingsTransportImportPattern.test(source)
      && !allowedSettingsTransportImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: settings transport access must route through src/platform/storage/settings/**.`);
    }
    settingsTransportImportPattern.lastIndex = 0;

    if (
      storageInspectorQueryServiceImportPattern.test(source)
      && !allowedStorageInspectorQueryServiceImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: storage inspector access must route through src/platform/storage/support/StorageInspectorCapability.js.`);
    }
    storageInspectorQueryServiceImportPattern.lastIndex = 0;

    if (faviconQueryServiceImportPattern.test(source)) {
      fail(`${relativePath}: favicon query access must route through src/platform/storage/assets/FaviconQueryService.js.`);
    }
    faviconQueryServiceImportPattern.lastIndex = 0;

    if (
      storageSnapshotServiceImportPattern.test(source)
      && !allowedStorageSnapshotServiceImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: storage snapshot access must route through src/platform/storage/support/StorageSnapshotCapability.js.`);
    }
    storageSnapshotServiceImportPattern.lastIndex = 0;

    if (
      runtimeSessionStoreImportPattern.test(source)
      && !allowedRuntimeSessionStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: runtime session access must route through src/platform/storage/runtime/RuntimeSessionRepository.js or approved low-level session adapters.`);
    }
    runtimeSessionStoreImportPattern.lastIndex = 0;

    if (
      runtimeFlagStoreImportPattern.test(source)
      && !allowedRuntimeFlagStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: runtime flag access must route through src/platform/storage/runtime/RuntimeFlagRepository.js.`);
    }
    runtimeFlagStoreImportPattern.lastIndex = 0;

    if (
      nudgeSessionStoreImportPattern.test(source)
      && !allowedNudgeSessionStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: nudge session access must route through src/platform/storage/runtime/NudgeSessionRepository.js.`);
    }
    nudgeSessionStoreImportPattern.lastIndex = 0;

    if (
      zenArtifactStoreImportPattern.test(source)
      && !allowedZenArtifactStoreImportFiles.has(relativePath)
      && !isPlatformStorageInternalFile(relativePath)
    ) {
      fail(`${relativePath}: Zen artifact persistence access must route through src/platform/storage/themes/zen/ZenArtifactRepository.js.`);
    }
    zenArtifactStoreImportPattern.lastIndex = 0;
  }

  try {
    const testFiles = await collectFiles(testsDir);
    for (const filePath of testFiles) {
      const relativePath = toProjectRelative(filePath);
      const source = await fs.readFile(filePath, 'utf8');

      if (sharedStorageReferencePattern.test(source)) {
        fail(`${relativePath}: tests must not reference shared/storage compatibility paths; use src/platform/storage/** instead.`);
      }
      sharedStorageReferencePattern.lastIndex = 0;

      if (retiredBrowserStorageImportPattern.test(source)) {
        fail(`${relativePath}: tests must not reference retired browserStorage compatibility paths.`);
      }
      retiredBrowserStorageImportPattern.lastIndex = 0;

      if (/domains\/tracking\/background\/StatsCache\.js/g.test(source)) {
        fail(`${relativePath}: tests must not reference the retired tracking/background StatsCache path.`);
      }

      if (/domains\/tracking\/background\/TickMetricsBackup\.js/g.test(source)) {
        fail(`${relativePath}: tests must not reference the retired tracking/background TickMetricsBackup path.`);
      }

      if (/domains\/tracking\/background\/(?:NudgeDebtPersistence|nudgeDebtPersistence)\.js/g.test(source)) {
        fail(`${relativePath}: tests must not reference retired nudge debt persistence module paths.`);
      }
    }
  } catch (_error) {
    // No tests directory is also acceptable for this guard.
  }

  console.log('[storage-architecture-boundaries] PASS: active src matches the canonical storage architecture guardrails.');
};

main().catch((error) => {
  console.error('[storage-architecture-boundaries] Unexpected error:', error);
  process.exit(1);
});
