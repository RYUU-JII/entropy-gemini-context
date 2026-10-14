import { listSettingsOwnerCommandContracts } from '../../../domains/settings/config/settingsCommandContract.js';
import { requireSettingsCommitAcknowledgement } from '../../../domains/settings/config/settingsCommitAcknowledgement.js';
import { isTransientSettingsApplyError } from '../internal/chrome-storage/settingsTransport.js';
import createPlatformSettingsTransport from './createPlatformSettingsTransport.js';
import { normalizeStoredNudgeConfig } from '../../../domains/settings/config/nudgeConfig.js';

export class SettingsCommandService {
  constructor({ settingsTransport } = {}) {
    const ownerTransportMethods = listSettingsOwnerCommandContracts()
      .map((contract) => contract.transportMethod);
    if (
      !settingsTransport
      || typeof settingsTransport.applySettingsPatchViaRuntime !== 'function'
      || ownerTransportMethods.some((method) => typeof settingsTransport[method] !== 'function')
    ) {
      throw new Error('SETTINGS_COMMAND_TRANSPORT_REQUIRED');
    }
    this.settingsTransport = settingsTransport;
  }

  async applyPatch(items = {}, options = {}) {
    return this.settingsTransport.applySettingsPatchViaRuntime(items, options);
  }

  async setGoalEndEnabled(scope, enabled, options = {}) {
    const result = await this.applyPatch({ nudgeConfig: { operation: 'set_goal_end_enabled', scope, enabled } }, options);
    const items = requireSettingsCommitAcknowledgement(result?.committedItems, ['nudgeConfig']);
    normalizeStoredNudgeConfig(items.nudgeConfig);
    return { ...result, items };
  }

  async setCoolingCurvePreset(preset, options = {}) {
    return this.applyCoolingCurveCommand({ operation: 'set_preset', preset }, options);
  }
  async setCoolingCurveFamilyMode(family, mode, options = {}) {
    return this.applyCoolingCurveCommand({ operation: 'set_family_mode', family, mode }, options);
  }
  async setCoolingCurveAdvanced(advanced, options = {}) {
    return this.applyCoolingCurveCommand({ operation: 'set_advanced', advanced }, options);
  }
  async applyCoolingCurveCommand(command, options) {
    const result = await this.applyPatch({ coolingCurve: command }, options);
    return { ...result, items: requireSettingsCommitAcknowledgement(result?.committedItems, ['coolingCurve']) };
  }

  async upsertSiteRule(input = {}, options = {}) {
    return this.settingsTransport.upsertSiteRuleViaRuntime(input, options);
  }

  async completeFirstUse(input = {}, options = {}) {
    return this.settingsTransport.completeFirstUseViaRuntime(input, options);
  }

  async removeSiteRule(input = {}, options = {}) {
    return this.settingsTransport.removeSiteRuleViaRuntime(input, options);
  }

  async updateSiteRule(input = {}, options = {}) {
    return this.settingsTransport.updateSiteRuleViaRuntime(input, options);
  }

  async createProtectionPreset(input = {}, options = {}) {
    return this.settingsTransport.createProtectionPresetViaRuntime(input, options);
  }

  async updateProtectionPreset(input = {}, options = {}) {
    return this.settingsTransport.updateProtectionPresetViaRuntime(input, options);
  }

  async deleteProtectionPreset(input = {}, options = {}) {
    return this.settingsTransport.deleteProtectionPresetViaRuntime(input, options);
  }

  async assignGlobalProtectionPreset(input = {}, options = {}) {
    return this.settingsTransport.assignGlobalProtectionPresetViaRuntime(input, options);
  }
}

export function createSettingsCommandService(options = {}) {
  return new SettingsCommandService(options);
}

export { isTransientSettingsApplyError };

export function createPlatformSettingsCommandService() {
  return createSettingsCommandService({
    settingsTransport: createPlatformSettingsTransport(),
  });
}

export async function applySettingsPatchViaRuntime(items = {}, options = {}) {
  return createPlatformSettingsCommandService().applyPatch(items, options);
}

export async function upsertSiteRuleViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().upsertSiteRule(input, options);
}

export async function removeSiteRuleViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().removeSiteRule(input, options);
}

export async function updateSiteRuleViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().updateSiteRule(input, options);
}

export async function createProtectionPresetViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().createProtectionPreset(input, options);
}

export async function updateProtectionPresetViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().updateProtectionPreset(input, options);
}

export async function deleteProtectionPresetViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().deleteProtectionPreset(input, options);
}

export async function assignGlobalProtectionPresetViaRuntime(input = {}, options = {}) {
  return createPlatformSettingsCommandService().assignGlobalProtectionPreset(input, options);
}

export const applySettingsPatch = applySettingsPatchViaRuntime;

export default SettingsCommandService;
