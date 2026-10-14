import { createSettingsTransport } from '../internal/chrome-storage/settingsTransport.js';
import KeyMaterialRepository from '../security/KeyMaterialRepository.js';
import SettingsDocumentRepository from './SettingsDocumentRepository.js';
import SettingsPersistenceCapability from './SettingsPersistenceCapability.js';

export function createPlatformSettingsTransport() {
  return createSettingsTransport({
    settingsStore: SettingsDocumentRepository.getInstance(),
    keyStore: KeyMaterialRepository.getInstance(),
    settingsPersistence: SettingsPersistenceCapability.getInstance(),
  });
}

export default createPlatformSettingsTransport;
