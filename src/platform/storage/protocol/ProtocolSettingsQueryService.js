import { createPlatformSettingsQueryService } from '../settings/SettingsQueryService.js';

export class ProtocolSettingsQueryService {
  constructor({
    settingsQueryService = createPlatformSettingsQueryService(),
  } = {}) {
    this.settingsQueryService = settingsQueryService;
  }

  static getInstance() {
    if (!ProtocolSettingsQueryService.instance) {
      ProtocolSettingsQueryService.instance = new ProtocolSettingsQueryService();
    }
    return ProtocolSettingsQueryService.instance;
  }

  async readSnapshot(defaults = {}) {
    return this.settingsQueryService.readSnapshot(defaults);
  }
}

export async function readProtocolSettingsSnapshot(defaults = {}) {
  return ProtocolSettingsQueryService.getInstance().readSnapshot(defaults);
}

export default ProtocolSettingsQueryService;
