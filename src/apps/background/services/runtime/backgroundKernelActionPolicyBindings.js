export function createBackgroundKernelActionPolicyBindings({
  settingsService,
  settingsCache,
  settingsPersistence,
  schedulePostCommitSettingsEffects,
  runtimeFlagRepository,
  tacticalLogger,
  browserPort,
} = {}) {
  if (!settingsPersistence || typeof settingsPersistence.get !== 'function') {
    throw new Error('BACKGROUND_ACTION_SETTINGS_READ_OWNER_REQUIRED');
  }
  if (typeof schedulePostCommitSettingsEffects !== 'function') {
    throw new Error('BACKGROUND_ACTION_SETTINGS_PROPAGATION_OWNER_REQUIRED');
  }
  const readSettingsSnapshot = settingsPersistence.get.bind(settingsPersistence);

  return {
    policy: {
      settingsService,
      settingsCache,
      schedulePostCommitSettingsEffects,
      runtimeFlagRepository,
      readSettingsSnapshot,
      browserPort,
    },
    settings: { settingsService, updateOperationalTimestamp: () => tacticalLogger.updateOperationalTimestamp() },
  };
}
