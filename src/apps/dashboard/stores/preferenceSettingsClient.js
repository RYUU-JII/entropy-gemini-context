import {
  assertSettingsCommandBusReadAdmission,
  createSettingsCommandChannelClient,
  getSettingsCommandSyncState,
  SETTINGS_COMMAND_CHANNELS,
} from './settingsCommandBus.js';

const preferenceSettingsClient = createSettingsCommandChannelClient(
  SETTINGS_COMMAND_CHANNELS.PREFERENCE,
);

export function assertPreferenceSettingsReadAdmission() {
  return assertSettingsCommandBusReadAdmission();
}

export function getPendingPreferenceSettingsPatch() {
  return preferenceSettingsClient.getPendingPatch();
}

export function getPreferenceSettingsSyncState() {
  return getSettingsCommandSyncState(SETTINGS_COMMAND_CHANNELS.PREFERENCE);
}

export function dispatchPreferenceSettingsPatch(patch = {}, pendingKeys = []) {
  return preferenceSettingsClient.dispatchPatch(patch, pendingKeys);
}

export default {
  dispatchPreferenceSettingsPatch,
  getPendingPreferenceSettingsPatch,
};
