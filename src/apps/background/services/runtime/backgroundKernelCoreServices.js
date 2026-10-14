import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../../domains/settings/config/index.js';
import { shouldCollectDomainUsage } from '../../../../domains/settings/config/dataCollectionPolicy.js';
import { createConsumptionMemoryService } from '../../../../domains/behavior/consumption/ConsumptionMemoryService.js';
import { ConsumptionMemoryCheckpointRepository } from '../../../../platform/storage/model/ConsumptionMemoryCheckpointRepository.js';
import { getInterventionAdmissionService } from '../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import { configureCLSEBrowserPort, getCLSEStatus } from '../../../../domains/behavior/CLSEServiceClient.js';
import FaviconRepository from '../../../../platform/storage/assets/FaviconRepository.js';
import ClseRepository from '../../../../platform/storage/clse/ClseRepository.js';
import ClseSettingsQueryService from '../../../../platform/storage/clse/ClseSettingsQueryService.js';
import ClseSignalQueryService from '../../../../platform/storage/clse/ClseSignalQueryService.js';
import KeyMaterialRepository from '../../../../platform/storage/security/KeyMaterialRepository.js';
import ModelStateRepository from '../../../../platform/storage/model/ModelStateRepository.js';
import FeedTopologyCertificateCheckpointRepository from '../../../../platform/storage/model/FeedTopologyCertificateCheckpointRepository.js';
import CycleRuntimeCheckpointRepository from '../../../../platform/storage/runtime/CycleRuntimeCheckpointRepository.js';
import RuntimeSessionRepository from '../../../../platform/storage/runtime/RuntimeSessionRepository.js';
import ProfileResetLifecycleRepository, { resolveProfileResetGeneration } from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import SettingsDocumentRepository from '../../../../platform/storage/settings/SettingsDocumentRepository.js';
import SettingsPersistenceCapability from '../../../../platform/storage/settings/SettingsPersistenceCapability.js';
import RuntimeLanguageRepository from '../../../../platform/storage/settings/RuntimeLanguageRepository.js';
import EventLogRepository from '../../../../platform/storage/logs/EventLogRepository.js';
import StatsAggregateRepository from '../../../../platform/storage/stats/StatsAggregateRepository.js';
import StatsFeaturePackRepository from '../../../../platform/storage/stats/StatsFeaturePackRepository.js';
import InterventionEffectRepository from '../../../../platform/storage/stats/InterventionEffectRepository.js';
import StorageInspectorCapability from '../../../../platform/storage/support/StorageInspectorCapability.js';
import StorageSnapshotCapability from '../../../../platform/storage/support/StorageSnapshotCapability.js';
import RuntimeFlagRepository from '../../../../platform/storage/runtime/RuntimeFlagRepository.js';
import GateInterventionSessionRepository from '../../../../platform/storage/runtime/GateInterventionSessionRepository.js';
import InterventionLedgerRepository from '../../../../platform/storage/runtime/InterventionLedgerRepository.js';
import BootstrapSnapshotRepository from '../../../../platform/storage/bootstrap/BootstrapSnapshotRepository.js';
import ProgressionRepository from '../../../../platform/storage/progression/ProgressionRepository.js';
import { GuidanceRepository } from '../../../../platform/storage/guidance/GuidanceRepository.js';
import { createGuidanceService } from '../../../../domains/guidance/background/GuidanceService.js';
import { buildProgressionStateChangedMessage } from '../../../../domains/progression/contracts/progressionStateChanged.js';
import { NOTIFICATION_EVENT_TYPES } from '../../../../domains/notifications/contracts/notificationTypes.js';
import { MESSAGE_TYPES } from '../../../../platform/messaging/messageTypes.js';
import ZenModelRepository from '../../../../platform/storage/themes/zen/ZenModelRepository.js';
import ZenArtifactRepository from '../../../../platform/storage/themes/zen/ZenArtifactRepository.js';
import { STORAGE_SESSION_KEYS } from '../../../../platform/storage/runtime/RuntimeSessionRepository.js';
import {
  permissionsGetAllStrict,
} from '../../../../platform/chrome/ChromeService.js';
import { fetchFaviconDataUrl } from '@/platform/browser/faviconFetch.js';
import {
  resolveRetentionCutoffDateStr,
  resolveRetentionCutoffTimestamp,
  STORAGE_RETENTION_DAYS,
} from '../../../../platform/storage/retention/storageRetentionPolicy.js';
import { createSettingsService } from '../SettingsService.js';
import { createTacticalIntelligenceLogger } from '../../../../domains/tracking/background/TacticalIntelligenceLogger.js';
import { createStatsRuntimeService } from '../../../../domains/stats/background/runtime/statsRuntimeService.js';
import { createStatsRuntimeHealthLedger } from '../../../../domains/stats/background/runtime/statsRuntimeHealthLedger.js';
import { createStatsRepository } from '../../../../domains/stats/background/persistence/statsRepository.js';
import { createStatsRetentionJob } from '../../../../domains/stats/background/persistence/statsRetentionJob.js';
import { createStatsCollector } from '../../../../domains/stats/background/collection/statsCollector.js';
import { createSiteInterventionStatsRecorder } from '../../../../domains/stats/background/collection/siteInterventionStatsRecorder.js';
import { createTabTimeTracker } from '../../../../domains/tracking/background/TabTimeTracker.js';
import { createIdleDetector } from '../../../../domains/tracking/background/IdleDetector.js';
import { createCycleRecommendationService } from '../../../../domains/tracking/background/cycleRecommendationService.js';
import { createCycleStateManager } from '../../../../domains/tracking/background/CycleStateManager.js';
import { createTrackingPopupBlockFlow } from '../../../../domains/tracking/background/trackingPopupBlockFlow.js';
import { createSiteRuleCommandService } from '../../../../domains/tracking/background/siteRuleCommandService.js';
import { createFaviconService } from '../../../../domains/tracking/background/FaviconService.js';
import { createBootPrewarmService } from '../boot/BootPrewarmService.js';
import { createBackgroundKernelStatsQueryServices } from './backgroundKernelStatsQueryServices.js';
import { createNotificationService } from '../../../../domains/notifications/background/NotificationService.js';
import {
  createNotificationCopyResolver,
} from '../../../../domains/notifications/background/notificationCopyResolver.js';
import {
  createArtifactDisclosureCoordinator,
  createProgressionFactsProvider,
  createProgressionService,
} from '../../../../domains/progression/index.js';
import { getProgressionUnlockDebugRepository } from '@progression-debug-repository';
import { getNotificationCapabilityState } from '../../../../domains/notifications/capability/notificationCapability.js';
import { createSentinelProtocolTimeline } from '../../../../domains/protection/debug/SentinelProtocolTimeline.js';
import { createSpecialSessionRuntime } from '../../../../domains/protection/background/specialSessionRuntime.js';
import {
  createFeedTopologyPersistentCertificationService,
} from '../../../../domains/nudge/feed-flow/topology/FeedTopologyPersistentCertificationService.js';
import { createBackgroundKernelTrackingBrowserPort } from './backgroundKernelTrackingBrowserPort.js';
import { createBackgroundKernelNotificationBrowserPort } from './backgroundKernelNotificationBrowserPort.js';
import { createBackgroundKernelRuntimeMessageBrowserPort } from './backgroundKernelRuntimeMessageBrowserPort.js';
import { createBackgroundKernelBehaviorBrowserPort } from './backgroundKernelBehaviorBrowserPort.js';
import { createNotificationClickAction } from './backgroundKernelNotificationClickAction.js';
import { createArtifactDisclosureBootstrap } from './artifactDisclosureBootstrap.js';
import { createBackgroundGuidanceSettingsReader } from './backgroundKernelGuidanceSettings.js';

function requireRetentionTaskMethod(ownerName, dependency, methodName) {
  if (!dependency || typeof dependency[methodName] !== 'function') {
    throw new Error(`BACKGROUND_RETENTION_${ownerName}_${methodName}_REQUIRED`);
  }
}

export function createBackgroundStorageRetentionTasks({
  tacticalLogger,
  statsFeaturePackRepository,
  interventionEffectRepository,
  clseRepository,
} = {}) {
  requireRetentionTaskMethod('TACTICAL_LOGGER', tacticalLogger, 'cleanupOldIntelligenceLogs');
  requireRetentionTaskMethod('STATS_FEATURE_PACK_REPOSITORY', statsFeaturePackRepository, 'pruneBefore');
  requireRetentionTaskMethod('INTERVENTION_EFFECT_REPOSITORY', interventionEffectRepository, 'pruneExposuresBefore');
  requireRetentionTaskMethod('INTERVENTION_EFFECT_REPOSITORY', interventionEffectRepository, 'pruneEffectsBefore');
  requireRetentionTaskMethod('CLSE_REPOSITORY', clseRepository, 'pruneTiers');

  return [
    ({ now }) => tacticalLogger.cleanupOldIntelligenceLogs({ now }),
    ({ now }) => statsFeaturePackRepository.pruneBefore(resolveRetentionCutoffDateStr({
      now,
      days: STORAGE_RETENTION_DAYS.STATS_FEATURE_PACK_DAILY,
      fallbackDays: STORAGE_RETENTION_DAYS.STATS_FEATURE_PACK_DAILY,
    })),
    ({ now }) => interventionEffectRepository.pruneExposuresBefore(resolveRetentionCutoffTimestamp({
      now,
      days: STORAGE_RETENTION_DAYS.INTERVENTION_EXPOSURES,
      fallbackDays: STORAGE_RETENTION_DAYS.INTERVENTION_EXPOSURES,
    })),
    ({ now }) => interventionEffectRepository.pruneEffectsBefore(resolveRetentionCutoffDateStr({
      now,
      days: STORAGE_RETENTION_DAYS.INTERVENTION_EFFECT_DAILY,
      fallbackDays: STORAGE_RETENTION_DAYS.INTERVENTION_EFFECT_DAILY,
    })),
    ({ now }) => clseRepository.pruneTiers({
      buckets60sBefore: resolveRetentionCutoffTimestamp({
        now,
        days: STORAGE_RETENTION_DAYS.CLSE_60S_BUCKETS,
        fallbackDays: STORAGE_RETENTION_DAYS.CLSE_60S_BUCKETS,
      }),
      buckets5minBefore: resolveRetentionCutoffTimestamp({
        now,
        days: STORAGE_RETENTION_DAYS.CLSE_5MIN_BUCKETS,
        fallbackDays: STORAGE_RETENTION_DAYS.CLSE_5MIN_BUCKETS,
      }),
      loopEventsBefore: resolveRetentionCutoffTimestamp({
        now,
        days: STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS,
        fallbackDays: STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS,
      }),
      aggressionLogsBefore: resolveRetentionCutoffTimestamp({
        now,
        days: STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS,
        fallbackDays: STORAGE_RETENTION_DAYS.CLSE_DIAGNOSTICS,
      }),
      dailySummariesBefore: resolveRetentionCutoffDateStr({
        now,
        days: STORAGE_RETENTION_DAYS.CLSE_DAILY_SUMMARIES,
        fallbackDays: STORAGE_RETENTION_DAYS.CLSE_DAILY_SUMMARIES,
      }),
    }),
  ];
}

export const DEFAULT_FILTER_SETTINGS = CONFIG_DEFAULT_FILTER_SETTINGS;
export const SESSION_STATS_CLEANUP_KEY = STORAGE_SESSION_KEYS.STATS_CLEANUP_DATE;
export const GLOBAL_CAP_SESSION_KEY = STORAGE_SESSION_KEYS.GLOBAL_CAP_STATE;

export function createBackgroundKernelCoreServices({
  syncManagedContentScripts,
  broadcastSettingsUpdate = null,
  runQualifiedDayFollowup,
} = {}) {
  if (typeof syncManagedContentScripts !== 'function') {
    throw new Error('BACKGROUND_CORE_SERVICES_CONTENT_SCRIPT_SYNC_REQUIRED');
  }
  if (typeof runQualifiedDayFollowup !== 'function') {
    throw new Error('BACKGROUND_CORE_SERVICES_QUALIFIED_DAY_ADMISSION_REQUIRED');
  }

  const trackingBrowserPort = createBackgroundKernelTrackingBrowserPort();
  const notificationBrowserPort = createBackgroundKernelNotificationBrowserPort();
  const runtimeBrowserPort = createBackgroundKernelRuntimeMessageBrowserPort();
  configureCLSEBrowserPort(createBackgroundKernelBehaviorBrowserPort());
  const openNotificationClickAction = createNotificationClickAction({
    browserPort: trackingBrowserPort,
  });

  const runtimeSessionRepository = RuntimeSessionRepository.getInstance();
  const profileResetLifecycleRepository = ProfileResetLifecycleRepository.getInstance();
  const settingsDocumentRepository = SettingsDocumentRepository.getInstance();
  const settingsPersistence = SettingsPersistenceCapability.getInstance();
  const runtimeLanguageRepository = RuntimeLanguageRepository.getInstance();
  const keyMaterialRepository = KeyMaterialRepository.getInstance();
  const modelStateRepository = ModelStateRepository.getInstance();
  const feedTopologyCertificateCheckpointRepository = (
    FeedTopologyCertificateCheckpointRepository.getInstance()
  );
  const zenModelRepository = ZenModelRepository.getInstance();
  const zenArtifactRepository = ZenArtifactRepository.getInstance();
  const faviconRepository = FaviconRepository.getInstance();
  const eventLogRepository = EventLogRepository.getInstance();
  const statsAggregateRepository = StatsAggregateRepository.getInstance();
  const statsFeaturePackRepository = StatsFeaturePackRepository.getInstance();
  const interventionEffectRepository = InterventionEffectRepository.getInstance();
  const clseRepository = ClseRepository.getInstance();
  const clseSettingsQueryService = ClseSettingsQueryService.getInstance();
  const clseSignalQueryService = ClseSignalQueryService.getInstance();
  const storageInspectorQueryService = StorageInspectorCapability.getInstance();
  const storageSnapshotCapability = StorageSnapshotCapability.getInstance();
  const runtimeFlagRepository = RuntimeFlagRepository.getInstance();
  const gateInterventionSessionRepository = GateInterventionSessionRepository.getInstance();
  const interventionLedgerRepository = InterventionLedgerRepository.getInstance();
  const bootstrapSnapshotRepository = BootstrapSnapshotRepository.getInstance();
  const progressionRepository = ProgressionRepository.getInstance();
  const cycleRuntimeCheckpointRepository = CycleRuntimeCheckpointRepository.getInstance();
  const settingsService = createSettingsService({ settingsPersistence });
  const settingsCache = settingsService.getSettingsCache();
  const feedTopologyPersistentCertificationService = (
    createFeedTopologyPersistentCertificationService({
      checkpointRepository: feedTopologyCertificateCheckpointRepository,
      profileLifecycleRepository: profileResetLifecycleRepository,
    })
  );

  const siteRuleCommandService = createSiteRuleCommandService({ settingsService });
  const statsRepository = createStatsRepository({ statsAggregateRepository });
  const statsRuntimeHealthLedger = createStatsRuntimeHealthLedger({
    sessionStore: runtimeSessionRepository,
  });
  const statsRuntimeService = createStatsRuntimeService({
    statsRepository,
    statsAggregateRepository,
    browserPort: runtimeBrowserPort,
    statsRuntimeHealthLedger,
  });
  const progressionFactsProvider = createProgressionFactsProvider({
    getSettingsSnapshot: () => settingsService.getSettingsCache(),
    getStatsFactsRange: statsRuntimeService.getStatsFactsRange,
  });
  const progressionService = createProgressionService({
    repository: progressionRepository,
    profileLifecycleRepository: profileResetLifecycleRepository,
    factsProvider: progressionFactsProvider,
    unlockDebugRepository: getProgressionUnlockDebugRepository(),
    onCommitted: (commit) => runtimeBrowserPort.runtimeSendMessage(buildProgressionStateChangedMessage(commit)),
  });
  settingsService.setSiteRegistrationAdmissionOwner(progressionService.assertSiteRegistrationAdmission);
  settingsService.setSiteRegistrationCommitObserver(progressionService.observeProtectedSiteRegistration);
  const artifactDisclosureCoordinator = createArtifactDisclosureCoordinator({
    progressionService,
    onQualifiedDayRecorded: (result, context) => runQualifiedDayFollowup({
      label: 'guidance_qualified_day_followup', task: async () => {
        if (result.activityDayOutcome.qualifiedDayRecorded === true) {
          await guidanceService.notifyJourneyAdvance(result, context);
        }
      },
    }),
  });
  const artifactDisclosureBootstrap = createArtifactDisclosureBootstrap({
    progressionService,
    getSettingsSnapshot: () => settingsService.getSettingsCache(),
  });
  const idleDetector = createIdleDetector({
    browserPort: trackingBrowserPort,
  });
  const statsCollector = createStatsCollector({
    loadStatsCache: statsRuntimeService.loadStatsCache,
    getStatsCache: statsRuntimeService.getStatsCache,
    getStatsDateStr: statsRuntimeService.getStatsDateStr,
    markStatsDirty: statsRuntimeService.markStatsDirty,
    commitStatsMutation: statsRuntimeService.commitStatsMutation,
  });
  const siteInterventionStatsRecorder = createSiteInterventionStatsRecorder({
    statsCollector,
    interventionEffectRepository,
    isInterventionTelemetryAdmitted: (hostname) => shouldCollectDomainUsage(
      hostname,
      settingsService.getSettingsCache(),
    ),
  });
  const tabTimeTracker = createTabTimeTracker({
    consumptionMemoryService: createConsumptionMemoryService({
      repository: new ConsumptionMemoryCheckpointRepository({ modelStateRepository }),
      beginExposureRecording: () => getInterventionAdmissionService().beginExposureRecording(),
      readExposureSnapshot: (options) => getInterventionAdmissionService().readExposureSnapshot(options),
      resolveProfileEpoch: async () => {
        const epoch = resolveProfileResetGeneration(await profileResetLifecycleRepository.read());
        await profileResetLifecycleRepository.assertWriteAdmission({ expectedResetId: epoch });
        return epoch;
      },
      captureAdmission: () => {
        const version = settingsService.getSettingsChangeVersion();
        const admission = settingsService.getCollectionAdmission();
        return { ...admission, assertCommitAllowed: () => {
          const current = settingsService.getCollectionAdmission();
          if (!admission.enabled || !current.enabled || current.revision !== admission.revision
            || settingsService.getSettingsChangeVersion() !== version) throw new Error('CONSUMPTION_MEMORY_COLLECTION_ADMISSION_CHANGED');
        } };
      },
    }),
    settingsService,
    sessionStore: runtimeSessionRepository,
    idleDetector,
    browserPort: trackingBrowserPort,
    statsCollector,
    statsRuntimeHealthLedger,
    recordManagedProtectedVisit: artifactDisclosureCoordinator.recordManagedProtectedVisit,
  });
  const tacticalLogger = createTacticalIntelligenceLogger({
    eventLogStore: eventLogRepository,
  });
  const statsRetentionJob = createStatsRetentionJob({
    sessionStore: runtimeSessionRepository,
    statsRepository,
    sessionKey: SESSION_STATS_CLEANUP_KEY,
    cleanupTasks: createBackgroundStorageRetentionTasks({
      tacticalLogger,
      statsFeaturePackRepository,
      interventionEffectRepository,
      clseRepository,
    }),
  });
  const cycleRecommendationService = createCycleRecommendationService({
    getStatsFactsRange: statsRuntimeService.getStatsFactsRange,
  });
  const cycleStateManager = createCycleStateManager({
    settingsService,
    cycleRuntimeStore: cycleRuntimeCheckpointRepository,
    cycleRecommendationService,
  });
  const {
    statsAnalysisQueryService,
    statsTrendQueryService,
  } = createBackgroundKernelStatsQueryServices({
    getStatsFactsRange: statsRuntimeService.getStatsFactsRange,
    getInterventionEffectsRange: (options) => interventionEffectRepository.getEffectsRange(options),
    getCycleState: ({ now } = {}) => cycleStateManager.flushPendingResetPolicy(now),
    getSettingsSnapshot: () => settingsService.getSettingsCache(),
  });
  const bootPrewarmService = createBootPrewarmService({
    settingsService,
    getSettingsCache: () => settingsService.getSettingsCache(),
    getAnalysisBootstrapSnapshot: statsAnalysisQueryService.getAnalysisBootstrapSnapshot,
    getCycleState: ({ now } = {}) => cycleStateManager.flushPendingResetPolicy(now),
    getCLSEStatus,
  });
  const popupBlockFlow = createTrackingPopupBlockFlow({
    sessionStore: runtimeSessionRepository,
    settingsCache,
    upsertPendingPopupBlockedSite: ({ domain }) => siteRuleCommandService.upsertSiteRule({
      domain,
      type: 'blocked',
      actionReason: 'popup_block_domain',
    }),
    syncManagedContentScripts: (...args) => syncManagedContentScripts(...args),
    getGrantedPermissions: permissionsGetAllStrict,
    loadStatsCache: statsRuntimeService.loadStatsCache,
    getStatsCache: statsRuntimeService.getStatsCache,
    getStatsDateStr: statsRuntimeService.getStatsDateStr,
    broadcastSettingsUpdate: typeof broadcastSettingsUpdate === 'function'
      ? (...args) => broadcastSettingsUpdate(...args)
      : null,
  });
  const faviconService = createFaviconService({
    faviconRepository,
    shouldCaptureFavicon: popupBlockFlow.shouldCaptureFaviconForPage,
    fetchFaviconDataUrl,
  });
  faviconRepository.subscribe(({ domain }) => runtimeBrowserPort.runtimeSendMessage({
    type: MESSAGE_TYPES.FAVICON_CACHE_CHANGED,
    domain,
  }));
  const resolveNotificationCopy = createNotificationCopyResolver({
    runtimeLanguageRepository,
  });
  const notificationService = createNotificationService({
    runtimeSessionRepository,
    getNotificationsConfig: () => settingsService.getSettingsCache().notificationsConfig,
    ensureNotificationsConfigReady: () => settingsService.ensureSettingsCache(),
    openNotificationClickAction,
    browserPort: notificationBrowserPort,
    resolveNotificationCapability: () => getNotificationCapabilityState({
      browserPort: notificationBrowserPort,
    }),
    resolveLocalizedCopy: resolveNotificationCopy,
    now: () => Date.now(),
  });
  const guidanceService = createGuidanceService({
    repository: new GuidanceRepository(),
    profileLifecycleRepository: profileResetLifecycleRepository,
    progressionService,
    readSettings: createBackgroundGuidanceSettingsReader(settingsService),
    readPresentationBusy: () => getInterventionAdmissionService().readPresentationBusy(),
    notifyJourney: ({ day, activityDayKey }) => notificationService.handleEvent({
      type: NOTIFICATION_EVENT_TYPES.JOURNEY_STAGE_ADVANCED, deliveryKey: `journey:${activityDayKey}:${day}`,
    }),
  });
  const sentinelProtocolTimeline = createSentinelProtocolTimeline();
  const specialSessionRuntime = createSpecialSessionRuntime({
    runtimeFlagRepository,
  });

  return {
    runtimeSessionRepository,
    profileResetLifecycleRepository,
    settingsDocumentRepository,
    settingsPersistence,
    runtimeLanguageRepository,
    keyMaterialRepository,
    modelStateRepository,
    feedTopologyCertificateCheckpointRepository,
    feedTopologyPersistentCertificationService,
    zenModelRepository,
    zenArtifactRepository,
    faviconRepository,
    eventLogRepository,
    statsFeaturePackRepository,
    interventionEffectRepository,
    clseRepository,
    clseSettingsQueryService,
    clseSignalQueryService,
    storageInspectorQueryService,
    storageSnapshotCapability,
    runtimeFlagRepository,
    gateInterventionSessionRepository,
    interventionLedgerRepository,
    bootstrapSnapshotRepository,
    progressionRepository,
    progressionService,
    guidanceService,
    artifactDisclosureCoordinator,
    artifactDisclosureBootstrap,
    settingsService,
    settingsCache,
    statsRepository,
    statsRuntimeHealthLedger,
    statsRuntimeService,
    runtimeBrowserPort,
    statsCollector,
    idleDetector,
    trackingBrowserPort,
    siteInterventionStatsRecorder,
    statsAnalysisQueryService,
    statsTrendQueryService,
    tabTimeTracker,
    tacticalLogger,
    statsRetentionJob,
    cycleStateManager,
    bootPrewarmService,
    popupBlockFlow,
    faviconService,
    notificationService,
    sentinelProtocolTimeline,
    specialSessionRuntime,
  };
}
