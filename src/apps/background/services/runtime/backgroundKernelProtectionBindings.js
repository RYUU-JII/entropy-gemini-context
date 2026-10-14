import { createBackgroundKernelProtectionDispatchBindings } from './backgroundKernelProtectionDispatchBindings.js';
import { createBackgroundKernelProtectionServiceBindings } from './backgroundKernelProtectionServiceBindings.js';
import { createLazyBackgroundGateInterstitialController } from './backgroundKernelLazyGateInterstitialController.js';
import { createBackgroundKernelProtectionBrowserPort } from './backgroundKernelProtectionBrowserPort.js';
import { createGateInterventionOwnerBindings } from './backgroundKernelGateInterventionOwnerBindings.js';
import { createInterventionLedger } from '../../../../domains/protection/background/runtime/InterventionLedger.js';
import { createTabClosureArbiter } from '../../../../domains/protection/background/runtime/TabClosureArbiter.js';
import { configureInterventionAdmissionService } from '../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import { normalizeEnsoGateEntry, resolveEnsoIntervalMs } from '../../../../domains/settings/config/ensoIntervalPolicy.js';
import { createBackgroundKernelTabManagementBindings } from './backgroundKernelTabManagementBindings.js';
import { resolveProfileResetGeneration } from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import NudgeSessionRepository from '../../../../platform/storage/runtime/NudgeSessionRepository.js';
import { readFurinDailyReceipt } from '../../../../domains/nudge/runtime/session/furinDailyPolicy.js';
import { createBackgroundGoalAuthorizationReaders } from './backgroundGoalAuthorizationReaders.js';

export function createBackgroundKernelProtectionBindings({
  settingsService, settingsCache, runtimeFlagRepository, clseSignalQueryService,
  statsRuntimeService, cycleStateManager, tabTimeTracker, siteInterventionStatsRecorder,
  gateInterventionSessionRepository, interventionLedgerRepository,
  bootstrapSnapshotRepository, runtimeLanguageRepository,
  profileResetLifecycleRepository,
  progressionService,
  defaultFilterSettings, resolveClseContextHostname, contentRuntimeDiagnostics,
  contentScriptOrchestrator, sentinelProtocolTimeline, runtimeBrowserPort,
  abortNudgesForTab,
  scheduleNudgeTerminalOutboxDrain,
  runProfileMutationAdmittedTask,
} = {}) {
  const browserPort = createBackgroundKernelProtectionBrowserPort();
  if (typeof profileResetLifecycleRepository?.read !== 'function') throw new Error('BACKGROUND_PROTECTION_PROFILE_GENERATION_OWNER_REQUIRED');
  const readProfileGeneration = async () => resolveProfileResetGeneration(await profileResetLifecycleRepository.read());
  const goalReaders = createBackgroundGoalAuthorizationReaders({ settingsService,
    trackingProtectionService: { resolveProtectionRuntime: (...args) => trackingProtectionService.resolveProtectionRuntime(...args) },
    readProfileGeneration, sessionRepository: NudgeSessionRepository.getInstance(), readDailyReceipt: readFurinDailyReceipt, browserPort });
  const interventionAdmission = configureInterventionAdmissionService({ browserPort, gateRepository: gateInterventionSessionRepository,
    runProfileMutationAdmittedTask,
    ...goalReaders,
    onGatePresented: (sessionId, tabId, at) => gateInterstitialController.preparePresented(sessionId, tabId, at),
    readEnsoPolicy: async () => {
      await settingsService.ensureSettingsCache();
      const entry = normalizeEnsoGateEntry(settingsService.getSettingsCache().filterSettings.ensoGate);
      return { enabled: entry.isActive, intervalMs: resolveEnsoIntervalMs(entry.value) };
    },
  });
  const protectionServiceBindings = createBackgroundKernelProtectionServiceBindings({
    readProfileGeneration,
    settingsService, settingsCache, runtimeFlagRepository, clseSignalQueryService,
    statsRuntimeService, cycleStateManager, tabTimeTracker, gateInterventionSessionRepository,
    bootstrapSnapshotRepository, progressionService, defaultFilterSettings,
    readInterventionExposureSnapshot: (options) => interventionAdmission.readExposureSnapshot(options),
    browserPort,
  });
  const { trackingProtectionService } = protectionServiceBindings;
  const gateInterventionOwners = createGateInterventionOwnerBindings(trackingProtectionService);
  if (!contentRuntimeDiagnostics || typeof contentRuntimeDiagnostics.record !== 'function') {
    throw new Error('BACKGROUND_PROTECTION_CONTENT_DIAGNOSTICS_REQUIRED');
  }
  const recordContentRuntimeDiagnostic = contentRuntimeDiagnostics.record.bind(contentRuntimeDiagnostics);
  const tabManagement = createBackgroundKernelTabManagementBindings({
    settingsService,
    readProtectedTabInventory: options => trackingProtectionService.readProtectedTabInventory(options),
    gateInterventionSessionRepository,
    runProfileMutationAdmittedTask,
    recordDiagnostic: recordContentRuntimeDiagnostic,
  });
  browserPort.beforeGateNavigation = tabManagement.beforeGateNavigation;
  const interventionLedger = createInterventionLedger({
    interventionLedgerRepository,
    recordDiagnostic: recordContentRuntimeDiagnostic,
    runProfileMutationAdmittedTask,
  });
  const { requestTabClosure } = createTabClosureArbiter({
    browserPort,
    gateInterventionSessionRepository,
    interventionLedger,
    recordDiagnostic: recordContentRuntimeDiagnostic,
  });
  const gateInterstitialController = createLazyBackgroundGateInterstitialController({
    gateInterventionSessionRepository,
    interventionLedger,
    requestTabClosure,
    interventionStatsRecorder: siteInterventionStatsRecorder,
    recordDiagnostic: recordContentRuntimeDiagnostic,
    runProfileMutationAdmittedTask,
    ...gateInterventionOwners,
    readProtectedTabInventory: options => trackingProtectionService.readProtectedTabInventory(options),
    browserPort,
  });
  const protectionDispatchBindings = createBackgroundKernelProtectionDispatchBindings({
    interventionAdmission,
    readProfileGeneration,
    settingsService,
    settingsCache,
    tabTimeTracker,
    runtimeLanguageRepository,
    trackingProtectionService,
    frictionBootstrapCoordinator: protectionServiceBindings.frictionBootstrapCoordinator,
    resolveClseContextHostname,
    contentRuntimeDiagnostics,
    contentScriptOrchestrator,
    sentinelProtocolTimeline,
    gateInterstitialController,
    browserPort,
    runtimeBrowserPort,
    abortNudgesForTab,
    scheduleNudgeTerminalOutboxDrain,
    runProfileMutationAdmittedTask,
  });

  return {
    ...protectionServiceBindings,
    ...protectionDispatchBindings,
    gateInterstitialController,
    interventionLedger,
    requestTabClosure,
    tabManagement,
  };
}
