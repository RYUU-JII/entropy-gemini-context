import { createProtectionRuntimeInputAssembler } from '../../../../domains/protection/background/ProtectionRuntimeInputAssembler.js';
import { createProtectionRuntimeInputProvider } from '../../../../domains/protection/background/ProtectionRuntimeInputProvider.js';
import { createTrackingProtectionService } from '../../../../domains/protection/background/TrackingProtectionService.js';
import { createFrictionBootstrapCoordinator } from '../../../../domains/protection/background/runtime/FrictionBootstrapCoordinator.js';
import { createGateInterventionSessionListOwner } from './backgroundKernelGateInterventionOwnerBindings.js';
import { requireBackgroundKernelOwnerMethod } from './backgroundKernelOwnerMethods.js';
import { createProtectionRuntimeStateCoordinator } from './ProtectionRuntimeStateCoordinator.js';
import { createStatsActivityDayUsageQueryService } from '../../../../domains/stats/background/query/statsActivityDayUsageQueryService.js';

function resolveProtectionServiceBrowserPort(browserPort) {
  if (typeof browserPort?.tabsQuery !== 'function') {
    throw new Error('PROTECTION_SERVICE_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

export function createBackgroundKernelProtectionServiceBindings({
  settingsService,
  settingsCache,
  runtimeFlagRepository,
  clseSignalQueryService,
  statsRuntimeService,
  cycleStateManager,
  tabTimeTracker,
  readInterventionExposureSnapshot,
  readProfileGeneration,
  gateInterventionSessionRepository,
  bootstrapSnapshotRepository, progressionService,
  defaultFilterSettings,
  browserPort,
} = {}) {
  const resolvedBrowserPort = resolveProtectionServiceBrowserPort(browserPort);
  const mergeNudgeConfig = requireBackgroundKernelOwnerMethod(
    settingsService,
    'mergeNudgeConfig',
    'BACKGROUND_PROTECTION_SERVICE_NUDGE_CONFIG_OWNER_REQUIRED',
  );
  const readArtifactDisclosureSnapshot = requireBackgroundKernelOwnerMethod(
    progressionService, 'readArtifactDisclosureSnapshot',
    'BACKGROUND_PROTECTION_SERVICE_ARTIFACT_DISCLOSURE_OWNER_REQUIRED',
  );
  const listGateInterventionSessions = createGateInterventionSessionListOwner(gateInterventionSessionRepository);
  const protectionRuntimeStateCoordinator = createProtectionRuntimeStateCoordinator();
  const activityDayUsageQuery = createStatsActivityDayUsageQueryService({
    getStatsFactsRange: statsRuntimeService.getStatsFactsRange,
    getCycleState: ({ now }) => cycleStateManager.flushPendingResetPolicy(now),
    getSettingsSnapshot: () => settingsService.getSettingsCache(),
  });
  const protectionRuntimeInputProvider = createProtectionRuntimeInputProvider({
    settingsService,
    settingsCache,
    runtimeFlagRepository,
    clseSignalQueryService,
    runtimeStateCoordinator: protectionRuntimeStateCoordinator,
    getActivityDayUsageRange: activityDayUsageQuery.getActivityDayUsageRange,
    getActiveSessionElapsedMs: tabTimeTracker.getActiveSessionElapsedMs,
    getConsumptionFlowSnapshot: tabTimeTracker.getConsumptionFlowSnapshot,
    getConsumptionMemorySnapshot: tabTimeTracker.getConsumptionMemorySnapshot,
    readInterventionExposureSnapshot,
    listTabs: async () => resolvedBrowserPort.tabsQuery({}),
    listGateInterventionSessions, readArtifactDisclosureSnapshot,
    defaultFilterSettings,
  });
  const protectionRuntimeInputAssembler = createProtectionRuntimeInputAssembler({
    mergeNudgeConfig,
    defaultFilterSettings,
  });
  const trackingProtectionService = createTrackingProtectionService({
    readProfileGeneration,
    runtimeInputProvider: protectionRuntimeInputProvider,
    runtimeInputAssembler: protectionRuntimeInputAssembler,
    runtimeStateCoordinator: protectionRuntimeStateCoordinator,
    mergeNudgeConfig,
  });
  const frictionBootstrapCoordinator = createFrictionBootstrapCoordinator({
    settingsCache,
    bootstrapSnapshotRepository,
  });
  return {
    frictionBootstrapCoordinator,
    protectionRuntimeStateCoordinator,
    trackingProtectionService,
    readProtectedTabInventory: protectionRuntimeInputProvider.readProtectedTabInventory,
  };
}
