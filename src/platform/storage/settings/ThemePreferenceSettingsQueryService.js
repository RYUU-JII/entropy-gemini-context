import { createPlatformSettingsQueryService } from './SettingsQueryService.js';

export class ThemePreferenceSettingsQueryService {
  constructor({
    settingsQueryService = createPlatformSettingsQueryService(),
  } = {}) {
    this.settingsQueryService = settingsQueryService;
  }

  static getInstance() {
    if (!ThemePreferenceSettingsQueryService.instance) {
      ThemePreferenceSettingsQueryService.instance = new ThemePreferenceSettingsQueryService();
    }
    return ThemePreferenceSettingsQueryService.instance;
  }

  async readSnapshot(defaults = {}) {
    return this.settingsQueryService.readSnapshot(defaults);
  }
}

export async function readThemePreferenceSettingsSnapshot(defaults = {}) {
  return ThemePreferenceSettingsQueryService.getInstance().readSnapshot(defaults);
}

export default ThemePreferenceSettingsQueryService;
