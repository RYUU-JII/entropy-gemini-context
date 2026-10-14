import {
  createPlatformSettingsCommandService,
  isTransientSettingsApplyError,
} from '../settings/SettingsCommandService.js';
import {
  createPlatformSettingsQueryService,
} from '../settings/SettingsQueryService.js';
import {
  SETTINGS_CONTENT_PATCH_CONTRACT,
} from '../../../domains/settings/config/settingsCommandContract.js';

export const NUDGE_SETTINGS_KEYS = Object.freeze({
  ANCHOR_UNLOCK: 'isAnchorUnlocked',
  INDICATOR_CONFIG: 'indicatorConfig',
});

export const DEFAULT_ANCHOR_UNLOCK_SETTING = false;

// Content runtimes do not own the Dashboard profile-generation lease. Keep
// this command to one delivery so the background runtime gate is its only
// admission owner; a client timer must never replay it into a later profile.
const CONTENT_SINGLE_ATTEMPT_NUDGE_SETTINGS_OPTIONS = SETTINGS_CONTENT_PATCH_CONTRACT.delivery;

export class NudgeSettingsService {
  constructor({
    settingsCommandService = createPlatformSettingsCommandService(),
    settingsQueryService = createPlatformSettingsQueryService(),
  } = {}) {
    this.settingsCommandService = settingsCommandService;
    this.settingsQueryService = settingsQueryService;
  }

  static getInstance() {
    if (!NudgeSettingsService.instance) {
      NudgeSettingsService.instance = new NudgeSettingsService();
    }
    return NudgeSettingsService.instance;
  }

  async applySingleAttemptBestEffortPatch(items) {
    try {
      return await this.settingsCommandService.applyPatch(
        items,
        CONTENT_SINGLE_ATTEMPT_NUDGE_SETTINGS_OPTIONS,
      );
    } catch (error) {
      if (isTransientSettingsApplyError(error?.code || error?.message || '')) {
        return null;
      }
      throw error;
    }
  }

  async persistIndicatorConfig(indicatorConfig) {
    return this.applySingleAttemptBestEffortPatch({
      [NUDGE_SETTINGS_KEYS.INDICATOR_CONFIG]: indicatorConfig,
    });
  }

  async readAnchorUnlockSetting(fallback = null) {
    const snapshot = await this.settingsQueryService.readSnapshot({
      [NUDGE_SETTINGS_KEYS.ANCHOR_UNLOCK]: fallback,
    });
    const stored = snapshot?.[NUDGE_SETTINGS_KEYS.ANCHOR_UNLOCK];
    return typeof stored === 'boolean' ? stored : fallback;
  }

  async ensureAnchorUnlockSettingInitialized() {
    const stored = await this.readAnchorUnlockSetting(null);
    if (typeof stored === 'boolean') {
      return stored;
    }

    await this.applySingleAttemptBestEffortPatch({
      [NUDGE_SETTINGS_KEYS.ANCHOR_UNLOCK]: DEFAULT_ANCHOR_UNLOCK_SETTING,
    });
    return DEFAULT_ANCHOR_UNLOCK_SETTING;
  }
}

export async function persistNudgeIndicatorConfig(indicatorConfig) {
  return NudgeSettingsService.getInstance().persistIndicatorConfig(indicatorConfig);
}

export async function ensureAnchorUnlockSettingInitialized() {
  return NudgeSettingsService.getInstance().ensureAnchorUnlockSettingInitialized();
}

export default NudgeSettingsService;
