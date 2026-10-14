import { MESSAGE_ACTIONS } from '../../../platform/messaging/contracts/messageTypes.js';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createCommandInputError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function requireDomain(input) {
  const domain = typeof input?.domain === 'string' ? input.domain.trim() : '';
  if (!domain) throw createCommandInputError('INVALID_DOMAIN');
  return domain;
}

function requirePresetId(input) {
  const presetId = typeof input?.presetId === 'string' ? input.presetId.trim() : '';
  if (!presetId) throw createCommandInputError('INVALID_PROTECTION_PRESET_ID');
  return presetId;
}

function buildUpsertSiteRuleRequest(source) {
  const domain = requireDomain(source);
  if (source.type !== 'blocked' && source.type !== 'allowed') {
    throw createCommandInputError('INVALID_SITE_RULE_TYPE');
  }
  const payload = {
    action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
    domain,
    type: source.type,
  };
  if (Number.isFinite(Number(source.goalMinutes)) && Number(source.goalMinutes) > 0) {
    payload.goalMinutes = Math.floor(Number(source.goalMinutes));
  }
  if (source.confirmExactMove === true) payload.confirmExactMove = true;
  if (Object.hasOwn(source, 'firstUseRecording')) {
    if (typeof source.firstUseRecording !== 'boolean') throw createCommandInputError('FIRST_USE_RECORDING_CHOICE_INVALID');
    payload.firstUseRecording = source.firstUseRecording;
  }
  return { payload, logContext: { domain, type: source.type } };
}

function buildRemoveSiteRuleRequest(source) {
  const domain = requireDomain(source);
  if (source.type !== null && source.type !== undefined
    && source.type !== 'blocked' && source.type !== 'allowed') {
    throw createCommandInputError('INVALID_SITE_RULE_TYPE');
  }
  const payload = { action: MESSAGE_ACTIONS.REMOVE_SITE_RULE, domain };
  if (source.type) payload.type = source.type;
  return { payload, logContext: { domain, type: source.type ?? null } };
}

function buildUpdateSiteRuleRequest(source) {
  const domain = requireDomain(source);
  const payload = { action: MESSAGE_ACTIONS.UPDATE_SITE_RULE, domain };
  if (Object.prototype.hasOwnProperty.call(source, 'goalMinutes')) {
    const goalMinutes = Math.floor(Number(source.goalMinutes));
    payload.goalMinutes = Number.isFinite(goalMinutes) && goalMinutes > 0 ? goalMinutes : null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'policy')) {
    payload.policy = source.policy ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'presetId')) {
    payload.presetId = source.presetId == null ? '' : String(source.presetId);
  }
  const mutationKeys = Object.keys(payload).filter((key) => key !== 'action' && key !== 'domain');
  return mutationKeys.length === 0
    ? { noopFields: { domain }, logContext: { domain, mutationKeys } }
    : { payload, logContext: { domain, mutationKeys } };
}

function buildCreateProtectionPresetRequest(source) {
  const payload = {
    action: MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET,
    label: typeof source.label === 'string' ? source.label : '',
    sourcePresetId: typeof source.sourcePresetId === 'string' ? source.sourcePresetId : '',
  };
  return {
    payload,
    logContext: { label: payload.label, sourcePresetId: payload.sourcePresetId },
  };
}

function buildUpdateProtectionPresetRequest(source) {
  const presetId = requirePresetId(source);
  return {
    payload: {
      action: MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET,
      presetId,
      patch: isPlainObject(source.patch) ? { ...source.patch } : {},
    },
    logContext: { presetId },
  };
}

function buildPresetIdRequest(action, source) {
  const presetId = requirePresetId(source);
  return { payload: { action, presetId }, logContext: { presetId } };
}

const SETTINGS_COMMAND_REQUEST_BUILDERS = Object.freeze({
  [MESSAGE_ACTIONS.COMPLETE_FIRST_USE]: () => ({ payload: { action: MESSAGE_ACTIONS.COMPLETE_FIRST_USE }, logContext: {} }),
  [MESSAGE_ACTIONS.UPSERT_SITE_RULE]: buildUpsertSiteRuleRequest,
  [MESSAGE_ACTIONS.REMOVE_SITE_RULE]: buildRemoveSiteRuleRequest,
  [MESSAGE_ACTIONS.UPDATE_SITE_RULE]: buildUpdateSiteRuleRequest,
  [MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET]: buildCreateProtectionPresetRequest,
  [MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET]: buildUpdateProtectionPresetRequest,
  [MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET]: (source) => buildPresetIdRequest(
    MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET,
    source,
  ),
  [MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET]: (source) => {
    const presetId = typeof source.presetId === 'string' ? source.presetId : '';
    return {
      payload: { action: MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET, presetId },
      logContext: { presetId },
    };
  },
});

export function buildSettingsRuntimeCommandRequest(action, input = {}) {
  const builder = SETTINGS_COMMAND_REQUEST_BUILDERS[action];
  if (typeof builder !== 'function') {
    throw createCommandInputError('SETTINGS_COMMAND_REQUEST_BUILDER_REQUIRED');
  }
  return builder(isPlainObject(input) ? input : {});
}
