import {
  ensureAnchorUnlockSettingInitialized as ensureAnchorUnlockSettingInitializedFromStorage,
  NUDGE_SETTINGS_KEYS,
  persistNudgeIndicatorConfig as persistNudgeIndicatorConfigToStorage,
} from '../../platform/storage/nudge/NudgeSettingsService.js';

export { NUDGE_SETTINGS_KEYS };

export async function persistNudgeIndicatorConfig(indicatorConfig) {
  return persistNudgeIndicatorConfigToStorage(indicatorConfig);
}

export async function ensureAnchorUnlockSettingInitialized() {
  return ensureAnchorUnlockSettingInitializedFromStorage();
}

export default {
  ensureAnchorUnlockSettingInitialized,
  persistNudgeIndicatorConfig,
};
