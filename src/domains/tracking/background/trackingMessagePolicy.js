import { createActionSenderPolicy } from './trackingMessagePolicies/actionSenderPolicy.js';
import { createDestructiveActionPolicy } from './trackingMessagePolicies/destructiveActionPolicy.js';
import { createNudgeCyclePolicy } from './trackingMessagePolicies/nudgeCyclePolicy.js';
import { createProtectionRuntimePolicy } from './trackingMessagePolicies/protectionRuntimePolicy.js';
import { createSettingsAccessPolicy } from './trackingMessagePolicies/settingsAccessPolicy.js';
import { createSupportDebugPolicy } from './trackingMessagePolicies/supportDebugPolicy.js';

export function createTrackingMessagePolicy({
  settingsService,
  settingsCache,
  schedulePostCommitSettingsEffects,
  runtimeFlagRepository = null,
  readSettingsSnapshot = null,
  browserPort,
} = {}) {
  return {
    ...createActionSenderPolicy(),
    ...createSettingsAccessPolicy(),
    ...createDestructiveActionPolicy({ readSecuritySnapshot: readSettingsSnapshot }),
    ...createSupportDebugPolicy({ browserPort, settingsCache }),
    ...createProtectionRuntimePolicy(),
    ...createNudgeCyclePolicy({
      settingsService,
      schedulePostCommitSettingsEffects,
      runtimeFlagRepository,
    }),
    readSettingsSnapshot,
  };
}
