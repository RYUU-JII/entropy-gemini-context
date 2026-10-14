import { createPlatformSettingsQueryService } from '../settings/SettingsQueryService.js';

export class ProtectionSettingsQueryService {
  constructor({
    settingsQueryService = createPlatformSettingsQueryService(),
  } = {}) {
    this.settingsQueryService = settingsQueryService;
  }

  static getInstance() {
    if (!ProtectionSettingsQueryService.instance) {
      ProtectionSettingsQueryService.instance = new ProtectionSettingsQueryService();
    }
    return ProtectionSettingsQueryService.instance;
  }

  async readSnapshot(defaults = {}) {
    return this.settingsQueryService.readSnapshot(defaults);
  }
}

export async function readProtectionSettingsSnapshot(defaults = {}) {
  return ProtectionSettingsQueryService.getInstance().readSnapshot(defaults);
}

export default ProtectionSettingsQueryService;
