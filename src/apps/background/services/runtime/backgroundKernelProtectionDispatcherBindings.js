import { createProtectionDispatcher } from '../../../../domains/protection/background/ProtectionDispatcher.js';
import { createBackgroundKernelProtectionBrowserPort } from './backgroundKernelProtectionBrowserPort.js';
import { mapWithConcurrency } from './backgroundKernelAsync.js';

export function createBackgroundKernelProtectionDispatcherBindings({
  interventionAdmission,
  settingsService,
  settingsCache,
  runtimeLanguageRepository,
  frictionBootstrapCoordinator,
  resolveProtectionRuntime,
  getGlobalCapState,
  contentRuntimeDiagnostics,
  contentScriptOrchestrator,
  gateInterstitialController,
  sentinelProtocolTimeline,
  abortNudgesForTab,
  scheduleNudgeTerminalOutboxDrain,
  readProfileGeneration,
  browserPort = createBackgroundKernelProtectionBrowserPort(),
} = {}) {
  return {
    protectionDispatcher: createProtectionDispatcher({
      interventionAdmission,
      readProfileGeneration,
      settingsService,
      settingsCache,
      resolveProtectionRuntime,
      getGlobalCapState,
      mapWithConcurrency,
      runtimeLanguageStore: runtimeLanguageRepository,
      contentRuntimeDiagnostics,
      contentScriptOrchestrator,
      sentinelProtocolTimeline,
      frictionBootstrapCoordinator,
      gateInterstitialController,
      abortNudgesForTab,
      scheduleNudgeTerminalOutboxDrain,
      browserPort,
    }),
  };
}
