import {
  setProtocolGoalEndEnabled as setProtocolGoalEndEnabledViaStorage,
  setProtocolCoolingCurvePreset as setProtocolCoolingCurvePresetViaStorage,
  setProtocolCoolingCurveFamilyMode as setProtocolCoolingCurveFamilyModeViaStorage,
  setProtocolCoolingCurveAdvanced as setProtocolCoolingCurveAdvancedViaStorage,
  completeProtocolFirstUse as completeProtocolFirstUseViaStorage,
  assignProtocolGlobalProtectionPreset as assignProtocolGlobalProtectionPresetViaStorage,
  createProtocolProtectionPreset as createProtocolProtectionPresetViaStorage,
  deleteProtocolProtectionPreset as deleteProtocolProtectionPresetViaStorage,
  removeProtocolSiteRule as removeProtocolSiteRuleViaStorage,
  updateProtocolProtectionPreset as updateProtocolProtectionPresetViaStorage,
  updateProtocolSiteRule as updateProtocolSiteRuleViaStorage,
  upsertProtocolSiteRule as upsertProtocolSiteRuleViaStorage,
} from '../../../platform/storage/protocol/ProtocolSettingsCommandService.js';
import {
  readProtocolSettingsSnapshot as readProtocolSettingsSnapshotViaStorage,
} from '../../../platform/storage/protocol/ProtocolSettingsQueryService.js';
import {
  assertSettingsCommandBusReadAdmission,
  createSettingsCommandChannelClient,
  getSettingsCommandSyncState,
  SETTINGS_COMMAND_CHANNELS,
} from './settingsCommandBus.js';

const protocolSettingsClient = createSettingsCommandChannelClient(
  SETTINGS_COMMAND_CHANNELS.PROTOCOL,
);

const DASHBOARD_PROPAGATION_OPTIONS = Object.freeze({
  waitForPropagation: true,
  timeoutMs: 20_000,
});

export function assertProtocolSettingsReadAdmission() {
  return assertSettingsCommandBusReadAdmission();
}

function withDashboardPropagation(options = {}) {
  return {
    ...options,
    ...DASHBOARD_PROPAGATION_OPTIONS,
  };
}

export function getPendingProtocolSettingsPatch() {
  return protocolSettingsClient.getPendingPatch();
}

export function getProtocolSettingsSyncState() {
  return getSettingsCommandSyncState(SETTINGS_COMMAND_CHANNELS.PROTOCOL);
}

export function readProtocolSettingsSnapshot(defaults = {}) {
  return readProtocolSettingsSnapshotViaStorage(defaults);
}

export function dispatchProtocolSettingsPatch(patch = {}, pendingKeys = []) {
  return protocolSettingsClient.dispatchPatch(patch, pendingKeys);
}

export function runProtocolSettingsCommand({
  pendingKeys = [],
  execute,
} = {}) {
  return protocolSettingsClient.runOwnerCommand({
    pendingKeys,
    execute,
  });
}

export async function upsertProtocolSiteRule(input = {}, options = {}) {
  const result = await upsertProtocolSiteRuleViaStorage(input, withDashboardPropagation(options));
  if (Object.hasOwn(input, 'firstUseRecording') && !['registered', 'already_protected'].includes(result.firstUseResult)) {
    throw new Error('FIRST_USE_SITE_ACK_INVALID');
  }
  return result;
}

export function completeProtocolFirstUse(input = {}, options = {}) {
  return completeProtocolFirstUseViaStorage(input, withDashboardPropagation(options));
}

export function removeProtocolSiteRule(input = {}, options = {}) {
  return removeProtocolSiteRuleViaStorage(input, withDashboardPropagation(options));
}

export function updateProtocolSiteRule(input = {}, options = {}) {
  return updateProtocolSiteRuleViaStorage(input, withDashboardPropagation(options));
}

export function createProtocolProtectionPreset(input = {}, options = {}) {
  return createProtocolProtectionPresetViaStorage(input, withDashboardPropagation(options));
}

export function updateProtocolProtectionPreset(input = {}, options = {}) {
  return updateProtocolProtectionPresetViaStorage(input, withDashboardPropagation(options));
}

export function deleteProtocolProtectionPreset(input = {}, options = {}) {
  return deleteProtocolProtectionPresetViaStorage(input, withDashboardPropagation(options));
}

export function assignProtocolGlobalProtectionPreset(input = {}, options = {}) {
  return assignProtocolGlobalProtectionPresetViaStorage(input, withDashboardPropagation(options));
}

export default {
  assignProtocolGlobalProtectionPreset,
  createProtocolProtectionPreset,
  deleteProtocolProtectionPreset,
  dispatchProtocolSettingsPatch,
  getPendingProtocolSettingsPatch,
  readProtocolSettingsSnapshot,
  removeProtocolSiteRule,
  runProtocolSettingsCommand,
  updateProtocolProtectionPreset,
  updateProtocolSiteRule,
  upsertProtocolSiteRule,
};

const coolingCommandOptions = options => withDashboardPropagation({ ...options, expectedProfileGeneration: assertProtocolSettingsReadAdmission() });
export const setProtocolCoolingCurvePreset = (preset, options) => setProtocolCoolingCurvePresetViaStorage(preset, coolingCommandOptions(options));
export const setProtocolCoolingCurveFamilyMode = (family, mode, options) => setProtocolCoolingCurveFamilyModeViaStorage(family, mode, coolingCommandOptions(options));
export const setProtocolCoolingCurveAdvanced = (advanced, options) => setProtocolCoolingCurveAdvancedViaStorage(advanced, coolingCommandOptions(options));
export const setProtocolGoalEndEnabled = (scope, enabled, options) => setProtocolGoalEndEnabledViaStorage(scope, enabled, coolingCommandOptions(options));
