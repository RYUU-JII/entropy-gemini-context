import SettingsPersistenceCapability from './SettingsPersistenceCapability.js';

export class SettingsPersistenceAdapter extends SettingsPersistenceCapability {}

export function createSettingsPersistenceAdapter(options = {}) {
  return new SettingsPersistenceAdapter(options);
}

export default SettingsPersistenceAdapter;
