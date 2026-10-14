import createPlatformSettingsTransport from './createPlatformSettingsTransport.js';

export class SettingsQueryService {
  constructor({ settingsTransport } = {}) {
    if (!settingsTransport || typeof settingsTransport.readSettingsSnapshot !== 'function') {
      throw new Error('SETTINGS_QUERY_TRANSPORT_REQUIRED');
    }
    this.settingsTransport = settingsTransport;
  }

  async readSnapshot(defaults = {}) {
    return this.settingsTransport.readSettingsSnapshot(defaults);
  }
}

export function createSettingsQueryService(options = {}) {
  return new SettingsQueryService(options);
}

export function createPlatformSettingsQueryService() {
  return createSettingsQueryService({
    settingsTransport: createPlatformSettingsTransport(),
  });
}

export async function readSettingsSnapshot(defaults = {}) {
  return createPlatformSettingsQueryService().readSnapshot(defaults);
}

export default SettingsQueryService;
