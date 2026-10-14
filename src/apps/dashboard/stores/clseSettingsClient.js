import {
  createSettingsCommandChannelClient,
  SETTINGS_COMMAND_CHANNELS,
} from './settingsCommandBus.js';

const clseSettingsClient = createSettingsCommandChannelClient(SETTINGS_COMMAND_CHANNELS.CLSE);

export function dispatchClseSettingsPatch(patch = {}, pendingKeys = []) {
  return clseSettingsClient.dispatchPatch(patch, pendingKeys);
}

export default {
  dispatchClseSettingsPatch,
};
