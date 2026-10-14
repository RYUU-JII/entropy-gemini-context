import {
  createPlatformSettingsCommandService,
} from '../settings/SettingsCommandService.js';

export class ProtocolSettingsCommandService {
  constructor({
    settingsCommandService = createPlatformSettingsCommandService(),
  } = {}) {
    this.settingsCommandService = settingsCommandService;
  }

  static getInstance() {
    if (!ProtocolSettingsCommandService.instance) {
      ProtocolSettingsCommandService.instance = new ProtocolSettingsCommandService();
    }
    return ProtocolSettingsCommandService.instance;
  }

  async upsertSiteRule(input = {}, options = {}) {
    return this.settingsCommandService.upsertSiteRule(input, options);
  }

  async setCoolingCurvePreset(preset, options = {}) {
    return this.settingsCommandService.setCoolingCurvePreset(preset, options);
  }
  async setGoalEndEnabled(scope, enabled, options = {}) {
    return this.settingsCommandService.setGoalEndEnabled(scope, enabled, options);
  }
  async setCoolingCurveFamilyMode(family, mode, options = {}) {
    return this.settingsCommandService.setCoolingCurveFamilyMode(family, mode, options);
  }
  async setCoolingCurveAdvanced(advanced, options = {}) {
    return this.settingsCommandService.setCoolingCurveAdvanced(advanced, options);
  }

  async completeFirstUse(input = {}, options = {}) {
    return this.settingsCommandService.completeFirstUse(input, options);
  }

  async removeSiteRule(input = {}, options = {}) {
    return this.settingsCommandService.removeSiteRule(input, options);
  }

  async updateSiteRule(input = {}, options = {}) {
    return this.settingsCommandService.updateSiteRule(input, options);
  }

  async createProtectionPreset(input = {}, options = {}) {
    return this.settingsCommandService.createProtectionPreset(input, options);
  }

  async updateProtectionPreset(input = {}, options = {}) {
    return this.settingsCommandService.updateProtectionPreset(input, options);
  }

  async deleteProtectionPreset(input = {}, options = {}) {
    return this.settingsCommandService.deleteProtectionPreset(input, options);
  }

  async assignGlobalProtectionPreset(input = {}, options = {}) {
    return this.settingsCommandService.assignGlobalProtectionPreset(input, options);
  }
}

export async function upsertProtocolSiteRule(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().upsertSiteRule(input, options);
}

export async function completeProtocolFirstUse(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().completeFirstUse(input, options);
}

export async function removeProtocolSiteRule(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().removeSiteRule(input, options);
}

export async function updateProtocolSiteRule(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().updateSiteRule(input, options);
}

export async function createProtocolProtectionPreset(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().createProtectionPreset(input, options);
}

export async function updateProtocolProtectionPreset(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().updateProtectionPreset(input, options);
}

export async function deleteProtocolProtectionPreset(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().deleteProtectionPreset(input, options);
}

export async function assignProtocolGlobalProtectionPreset(input = {}, options = {}) {
  return ProtocolSettingsCommandService.getInstance().assignGlobalProtectionPreset(input, options);
}

export default ProtocolSettingsCommandService;

export const setProtocolCoolingCurvePreset = (preset, options) => ProtocolSettingsCommandService.getInstance().setCoolingCurvePreset(preset, options);
export const setProtocolCoolingCurveFamilyMode = (family, mode, options) => ProtocolSettingsCommandService.getInstance().setCoolingCurveFamilyMode(family, mode, options);
export const setProtocolCoolingCurveAdvanced = (advanced, options) => ProtocolSettingsCommandService.getInstance().setCoolingCurveAdvanced(advanced, options);
export const setProtocolGoalEndEnabled = (scope, enabled, options) => ProtocolSettingsCommandService.getInstance().setGoalEndEnabled(scope, enabled, options);
