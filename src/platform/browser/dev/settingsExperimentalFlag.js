import { readPageLocalBooleanFlag } from '../pageLocalStorage.js';

export const SETTINGS_EXPERIMENTAL_FLAG_STORAGE_KEY = 'settingsShowExperimental';

export function isExperimentalSettingsEnabled() {
  return readPageLocalBooleanFlag(SETTINGS_EXPERIMENTAL_FLAG_STORAGE_KEY, {
    fallback: false,
  });
}

export default isExperimentalSettingsEnabled;

