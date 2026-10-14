import { createBackgroundKernelProtectionDispatcherBindings } from './backgroundKernelProtectionDispatcherBindings.js';
import { createBackgroundKernelProtectionRuntimeBindings } from './backgroundKernelProtectionRuntimeBindings.js';

export function createBackgroundKernelProtectionDispatchBindings({
  interventionAdmission,
  settingsService,
  settingsCache,
  tabTimeTracker,
  runtimeLanguageRepository,
  trackingProtectionService,
  frictionBootstrapCoordinator,
  resolveClseContextHostname,
  contentRuntimeDiagnostics,
  contentScriptOrchestrator,
  gateInterstitialController,
  sentinelProtocolTimeline,
  browserPort,
  runtimeBrowserPort,
  abortNudgesForTab,
  scheduleNudgeTerminalOutboxDrain,
  runProfileMutationAdmittedTask,
  readProfileGeneration,
} = {}) {
  const protectionRuntimeBindings = createBackgroundKernelProtectionRuntimeBindings({
    settingsService,
    tabTimeTracker,
    trackingProtectionService,
    frictionBootstrapCoordinator,
    resolveClseContextHostname,
    runProfileMutationAdmittedTask,
    browserPort: runtimeBrowserPort,
  });
  const protectionDispatcherBindings = createBackgroundKernelProtectionDispatcherBindings({
    interventionAdmission,
    readProfileGeneration,
    settingsService,
    settingsCache,
    runtimeLanguageRepository,
    frictionBootstrapCoordinator,
    resolveProtectionRuntime: protectionRuntimeBindings.resolveProtectionRuntime,
    getGlobalCapState: protectionRuntimeBindings.getGlobalCapState,
    contentRuntimeDiagnostics,
    contentScriptOrchestrator,
    gateInterstitialController,
    sentinelProtocolTimeline,
    browserPort,
    abortNudgesForTab,
    scheduleNudgeTerminalOutboxDrain,
  });
  const { setProtectionDispatcher, ...publicProtectionRuntimeBindings } = protectionRuntimeBindings;
  setProtectionDispatcher(
    protectionDispatcherBindings.protectionDispatcher,
  );

  return {
    ...publicProtectionRuntimeBindings,
    ...protectionDispatcherBindings,
    trackingProtectionService,
  };
}
