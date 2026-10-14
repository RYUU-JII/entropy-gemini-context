import {
  createSettingsCommandChannelClient,
  assertSettingsCommandBusReadAdmission,
  SETTINGS_COMMAND_CHANNELS,
} from './settingsCommandBus.js';
import { applyDashboardSettingsPatch } from './settingsClient.js';

const securitySettingsClient = createSettingsCommandChannelClient(
  SETTINGS_COMMAND_CHANNELS.SECURITY,
);

export function dispatchSecuritySettingsPatch(patch = {}, pendingKeys = [], authorization = null) {
  if (authorization !== null) {
    const expectedProfileGeneration = assertSettingsCommandBusReadAdmission();
    return securitySettingsClient.runOwnerCommand({
      pendingKeys,
      execute: async () => {
        const result = await applyDashboardSettingsPatch(patch, {
          expectedProfileGeneration,
          authorization,
          retryCount: 0,
          waitForPropagation: true,
          timeoutMs: 20_000,
        });
        return { ...result, items: result.committedItems, patch: result.committedItems };
      },
    });
  }
  return securitySettingsClient.dispatchPatch(patch, pendingKeys);
}

export default {
  dispatchSecuritySettingsPatch,
};
