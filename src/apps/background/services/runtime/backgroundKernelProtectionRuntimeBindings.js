import { setCLSEGate } from '../../../../domains/behavior/collectors/CLSEGate.js';
import { isPrecisionInsightsEnabledForHostname } from '../../../../domains/settings/config/dataCollectionPolicy.js';
import { createProtectionRuntimeCoordinator } from './ProtectionRuntimeCoordinator.js';

export function createBackgroundKernelProtectionRuntimeBindings({
  settingsService, tabTimeTracker, trackingProtectionService,
  frictionBootstrapCoordinator, resolveClseContextHostname,
  runProfileMutationAdmittedTask, browserPort,
} = {}) {
  const hasSettingsCacheOwner = settingsService
    && typeof settingsService.ensureSettingsCache === 'function'
    && typeof settingsService.getSettingsCache === 'function';
  if (!hasSettingsCacheOwner) {
    throw new Error('BACKGROUND_PROTECTION_RUNTIME_SETTINGS_SERVICE_REQUIRED');
  }
  if (!tabTimeTracker || typeof tabTimeTracker.getActiveTabInfo !== 'function') {
    throw new Error('BACKGROUND_PROTECTION_RUNTIME_TAB_TIME_TRACKER_REQUIRED');
  }

  const getGlobalCapState = async (now = Date.now()) => trackingProtectionService.getGlobalCapState(now);

  let protectionDispatcher = null;
  const protectionRuntimeCoordinator = createProtectionRuntimeCoordinator({
    trackingProtectionService,
    getProtectionDispatcher: () => protectionDispatcher,
    getActiveTabInfo: () => tabTimeTracker.getActiveTabInfo(),
    runProfileMutationAdmittedTask,
    clearFrictionBootstrapSnapshots: (options) => frictionBootstrapCoordinator.invalidateForSettingsChange(options),
    browserPort,
  });
  const {
    broadcastSettingsUpdate, configureSettingsPipeline,
    getProtectionRuntimeSnapshot, maybeTriggerProtectionNudge,
    refreshProtectionRuntimeSnapshot, resolveProtectionRuntime, sendProtectionUpdate,
  } = protectionRuntimeCoordinator;

  setCLSEGate(async (context = {}) => {
    const hostname = await resolveClseContextHostname(context);
    if (!hostname) return false;

    await settingsService.ensureSettingsCache();
    return isPrecisionInsightsEnabledForHostname(hostname, settingsService.getSettingsCache());
  });

  return {
    broadcastSettingsUpdate, configureSettingsPipeline,
    getGlobalCapState, getProtectionRuntimeSnapshot, maybeTriggerProtectionNudge,
    refreshProtectionRuntimeSnapshot, resolveProtectionRuntime, sendProtectionUpdate,
    setProtectionDispatcher: (nextProtectionDispatcher) => {
      protectionDispatcher = nextProtectionDispatcher;
    },
  };
}
