import { normalizeStoredNudgeConfig, requireNudgeGoalEnds } from '../../../../domains/settings/config/nudgeConfig.js';
// Guidance consumes the canonical goal-end preferences, independently by scope.
export function createBackgroundGuidanceSettingsReader(settingsService) {
  for (const method of ['ensureSettingsCache', 'getSettingsCache']) {
    if (typeof settingsService?.[method] !== 'function') {
      throw new Error(`GUIDANCE_SETTINGS_OWNER_METHOD_REQUIRED:${method}`);
    }
  }
  return async () => {
    await settingsService.ensureSettingsCache();
    const settings = settingsService.getSettingsCache();
    requireNudgeGoalEnds(settings.nudgeConfig?.goalEnds);
    return {
      globalGoal: settings.globalGoal,
      blockedUrls: settings.blockedUrls,
      nudgeConfig: normalizeStoredNudgeConfig(settings.nudgeConfig),
    };
  };
}
