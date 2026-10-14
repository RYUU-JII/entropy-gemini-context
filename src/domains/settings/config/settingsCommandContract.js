import { ZEN_RENDER_PRESET_STORAGE_KEY, requireZenRenderPreset } from './zenRenderPreset.js';
import { requireCoolingCurve, applyCoolingCurveCommand } from './coolingCurvePolicy.js';
import { requireTabManagement } from './tabManagement.js';
import { FIRST_USE_POLICY_KEYS } from './firstUsePolicy.js';
import { CLSE_CONSTANTS } from '../../behavior/clseSchema.js';
import { requireCanonicalCLSEControlSnapshot } from '../../behavior/clseStatusContract.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/contracts/messageTypes.js';
import {
  CYCLE_SETTINGS_KEY,
  readCycleSettingsRecord,
} from '../../../platform/storage/runtime/cycleStateStorageContracts.js';
import {
  DEFAULT_ARTIFACT_CONTROL_STATE,
  normalizeArtifactControlState,
  requireArtifactControlState,
} from './artifactControlState.js';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  DEFAULT_PRECISION_INSIGHTS_MODE,
  DEFAULT_PRECISION_INSIGHTS_SIGNALS,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsMode,
  normalizePrecisionInsightsSignals,
} from './dataCollectionPolicy.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from './debugConfig.js';
import {
  DEFAULT_GATE_CONFIG,
  normalizeGateConfig,
} from './gateConfig.js';
import { applyFilterSettingsMutationPatch, mergeFilterSettingsMutationPatches } from './filterSettingsMutation.js';
import { requireCanonicalRuntimeLanguage } from '../i18n/language.js';
import {
  INSIGHTS_CONSENT,
  INSIGHTS_MODES,
  normalizeInsightsConsent,
  normalizeInsightsMode,
} from './insightsMode.js';
import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  normalizeNotificationsConfig,
} from './notificationsConfig.js';
import {
  DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  normalizeGlobalCapNotifyOnExceeded,
  normalizeProductRulesMode,
  normalizeUrlList,
  requireGlobalGoal,
  normalizeSiteGoals,
  normalizeSiteGoalMeta,
  normalizeSiteRuleTimeline,
} from './siteRules.js';
import {
  DEFAULT_SIDEBAR_DISPLAY_MODE,
  normalizeSidebarDisplayMode,
} from './sidebarDisplayMode.js';
import { assertCanonicalThemeId } from '../../../themes/core/ids.js';
import { normalizeFilterSettings } from './index.js';
import { normalizeFilteringMode, normalizeRelaxationSchedule } from './blockingPolicy.js';
import { normalizeIndicatorConfig } from './indicator.js';
import { normalizeStoredNudgeConfig, applyNudgeConfigCommand } from './nudgeConfig.js';
import { normalizeSolarLocationProfile } from './solarLocation.js';
import { normalizeSentinelStayDecisions } from './sentinelStayDecisions.js';
import {
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
} from '../../protection/catalog/presetContract.js';
import {
  requireCanonicalDomainGoalHashMap,
  requireCanonicalDomainHashList,
} from '../../../platform/security/domainHashing.js';

export const SETTINGS_COMMAND_CHANNELS = Object.freeze({
  PROTOCOL: 'protocol',
  PREFERENCE: 'preference',
  SECURITY: 'security',
  CLSE: 'clse',
});

export const SETTINGS_COMMAND_KINDS = Object.freeze({
  DASHBOARD_PATCH: 'dashboard_patch',
  OWNER_COMMAND: 'owner_command',
  RUNTIME_PATCH: 'runtime_patch',
});

export const SETTINGS_COMMAND_SENDER_SCOPES = Object.freeze({
  EXTENSION_PAGE: 'extension_page',
  TRUSTED_EXTENSION_SENDER: 'trusted_extension_sender',
});

export const SETTINGS_MUTATION_OWNERS = Object.freeze({
  SITE_RULE: 'site_rule',
  PROTECTION_PRESET: 'protection_preset',
  SENTINEL_DECISION_HISTORY: 'sentinel_decision_history',
  CYCLE_RESET_POLICY: 'cycle_reset_policy',
  DOMAIN_HASH_ARTIFACT: 'domain_hash_artifact',
});

export const SETTINGS_SECURITY_KEYS = Object.freeze({
  MASTER_PASSCODE: 'masterPasscodeHash',
  RESET_GUARD: 'requirePasscodeForReset',
  HIGH_SECURITY_MODE: 'highSecurityMode',
});

export const SETTINGS_COMMAND_ACK_ERROR_CODE = 'SETTINGS_COMMIT_ACK_INVALID';

const CLSE_ALERT_COOLDOWN_KEY = 'clse_alert_cooldown_ms';
const SETTINGS_RUNTIME_DELIVERY = Object.freeze({
  retryDelayMs: 120,
  retryCount: 0,
  timeoutMs: 5000,
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function freezeList(values = []) {
  return Object.freeze(Array.from(new Set(values)));
}

function createCommandInputError(code, extra = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function createKeyContract(metadata = {}) {
  return Object.freeze({ ...metadata });
}

function requireSelectivePermissionMode(value) {
  if (value !== 'selective') {
    throw new Error('PERMISSION_MODE_CONTRACT_INVALID');
  }
  return value;
}

export const SETTINGS_KEY_COMMAND_CONTRACTS = Object.freeze({
  tabManagement: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: requireTabManagement }),
  relaxationSchedule: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: normalizeRelaxationSchedule }),
  gateConfig: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    storedCanonicalize: normalizeGateConfig,
    canonicalize: (value, cache) => normalizeGateConfig(value, {
      defaults: cache?.gateConfig || DEFAULT_GATE_CONFIG,
    }),
  }),
  filteringMode: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: normalizeFilteringMode }),
  filterSettings: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    storedCanonicalize: normalizeFilterSettings,
    canonicalize: (value, cache) => applyFilterSettingsMutationPatch(cache.filterSettings, value),
    mergePending: mergeFilterSettingsMutationPatches,
  }),
  artifactControlState: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    storedCanonicalize: requireArtifactControlState,
    canonicalize: (value, cache) => normalizeArtifactControlState(value, {
      defaults: cache?.artifactControlState || DEFAULT_ARTIFACT_CONTROL_STATE,
    }),
  }),
  rulesMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: normalizeProductRulesMode,
  }),
  globalGoal: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, canonicalize: requireGlobalGoal }),
  globalCapNotifyOnExceeded: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeGlobalCapNotifyOnExceeded(
      value,
      cache?.globalCapNotifyOnExceeded ?? DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    ),
  }),
  coolingCurve: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: requireCoolingCurve,
    canonicalize: (value, cache) => applyCoolingCurveCommand(value, cache.coolingCurve) }),
  insightsMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeInsightsMode(
      value,
      cache?.insightsMode || INSIGHTS_MODES.OFF,
    ),
  }),
  insightsConsent: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeInsightsConsent(
      value,
      cache?.insightsConsent || INSIGHTS_CONSENT.UNSET,
    ),
  }),
  dataCollectionMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeDataCollectionMode(
      value,
      cache?.dataCollectionMode || DEFAULT_DATA_COLLECTION_MODE,
    ),
  }),
  precisionInsightsMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizePrecisionInsightsMode(
      value,
      cache?.precisionInsightsMode || DEFAULT_PRECISION_INSIGHTS_MODE,
    ),
  }),
  precisionInsightsSignals: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizePrecisionInsightsSignals(
      value,
      cache?.precisionInsightsSignals || DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    ),
  }),
  permissionMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: requireSelectivePermissionMode,
  }),
  historyCleanupForBlocked: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, valueType: 'boolean' }),
  concealBlockedBookmarks: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, valueType: 'boolean' }),
  tabEvaporationForBlocked: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, valueType: 'boolean' }),
  tabEvaporationTimeoutMinutes: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: (value) => {
    if (![3, 5, 10, 15].includes(value)) throw new Error('TAB_EVAPORATION_TIMEOUT_INVALID');
    return value;
  } }),
  indicatorConfig: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    contentWrite: true,
    storedCanonicalize: normalizeIndicatorConfig,
  }),
  debugConfig: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeDebugConfig(value, {
      defaults: cache?.debugConfig || DEFAULT_DEBUG_CONFIG,
    }),
  }),
  nudgeConfig: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: normalizeStoredNudgeConfig,
    canonicalize: (value, cache) => applyNudgeConfigCommand(value, cache.nudgeConfig) }),
  notificationsConfig: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value, cache) => normalizeNotificationsConfig(value, {
      defaults: cache?.notificationsConfig || DEFAULT_NOTIFICATIONS_CONFIG,
    }),
  }),
  solar_location_profile: createKeyContract({ channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL, storedCanonicalize: normalizeSolarLocationProfile }),
  [CYCLE_SETTINGS_KEY]: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.CYCLE_RESET_POLICY,
    canonicalize: readCycleSettingsRecord,
  }),
  isAnchorUnlocked: createKeyContract({ contentWrite: true, valueType: 'boolean' }),
  [CLSE_CONSTANTS.FEATURE_FLAG_KEY]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.CLSE,
    clseControlField: 'isEnabled',
    clseValidationDefault: false,
  }),
  [CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.CLSE,
    clseControlField: 'sensitivityScale',
    clseValidationDefault: CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT,
  }),
  [CLSE_ALERT_COOLDOWN_KEY]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.CLSE,
    clseControlField: 'alertCooldownMs',
    clseValidationDefault: CLSE_CONSTANTS.ALERT_COOLDOWN_DEFAULT_MS,
  }),
  blockedUrls: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.SITE_RULE,
    storedCanonicalize: normalizeUrlList,
  }),
  allowedUrls: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.SITE_RULE,
    storedCanonicalize: normalizeUrlList,
  }),
  trackingExcludedUrls: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalize: (value) => normalizeUrlList(value, []),
  }),
  siteGoals: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.SITE_RULE,
    storedCanonicalize: normalizeSiteGoals,
  }),
  siteGoalMeta: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.SITE_RULE,
    storedCanonicalize: normalizeSiteGoalMeta,
  }),
  siteRuleTimeline: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.SITE_RULE,
    storedCanonicalize: normalizeSiteRuleTimeline,
  }),
  sentinelStayDecisions: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.SENTINEL_DECISION_HISTORY,
    storedCanonicalize: normalizeSentinelStayDecisions,
  }),
  protectionPresetCatalog: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.PROTECTION_PRESET,
    storedCanonicalize: normalizeProtectionPresetCatalog,
  }),
  protectionPresetAssignments: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    mutationOwner: SETTINGS_MUTATION_OWNERS.PROTECTION_PRESET,
    storedCanonicalize: normalizeProtectionPresetAssignments,
  }),
  'app-theme': createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PREFERENCE,
    canonicalize: (value) => assertCanonicalThemeId(
      value,
      'settings app-theme mutation',
    ),
  }),
  app_language: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PREFERENCE,
    canonicalize: requireCanonicalRuntimeLanguage,
  }),
  [ZEN_RENDER_PRESET_STORAGE_KEY]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PREFERENCE,
    canonicalize: requireZenRenderPreset,
  }),
  sidebarDisplayMode: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.PREFERENCE,
    canonicalize: (value, cache) => normalizeSidebarDisplayMode(
      value,
      cache?.sidebarDisplayMode || DEFAULT_SIDEBAR_DISPLAY_MODE,
    ),
  }),
  [SETTINGS_SECURITY_KEYS.MASTER_PASSCODE]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.SECURITY,
    sensitiveRead: true,
    privilegedWriteAcknowledgement: true,
    valueType: 'string',
  }),
  [SETTINGS_SECURITY_KEYS.RESET_GUARD]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.SECURITY,
    sensitiveRead: true,
    privilegedWriteAcknowledgement: true,
    valueType: 'boolean',
  }),
  [SETTINGS_SECURITY_KEYS.HIGH_SECURITY_MODE]: createKeyContract({
    channel: SETTINGS_COMMAND_CHANNELS.SECURITY,
    sensitiveRead: true,
    privilegedWriteAcknowledgement: true,
    valueType: 'boolean',
  }),
  blockedUrlHashes: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.DOMAIN_HASH_ARTIFACT,
    sensitiveRead: true,
    storedCanonicalize: requireCanonicalDomainHashList,
  }),
  allowedUrlHashes: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.DOMAIN_HASH_ARTIFACT,
    sensitiveRead: true,
    storedCanonicalize: requireCanonicalDomainHashList,
  }),
  siteGoalHashes: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.DOMAIN_HASH_ARTIFACT,
    sensitiveRead: true,
    storedCanonicalize: requireCanonicalDomainGoalHashMap,
  }),
  domainHmacSecret: createKeyContract({
    mutationOwner: SETTINGS_MUTATION_OWNERS.DOMAIN_HASH_ARTIFACT,
    sensitiveRead: true,
  }),
});

export const SETTINGS_CONTENT_PATCH_CONTRACT = Object.freeze({
  canonicalKeys: freezeList(
    Object.entries(SETTINGS_KEY_COMMAND_CONTRACTS)
      .filter(([, contract]) => contract.contentWrite)
      .map(([key]) => key),
  ),
  delivery: Object.freeze({
    quietTransientFailures: true,
    retryCount: 0,
  }),
  profileGeneration: 'background_runtime_gate_only',
});

const ACK_FIELD_TYPES = Object.freeze({
  BOOLEAN: 'boolean',
  ENUM: 'enum',
  MATCHING_OBJECT: 'matching_object',
  NULLABLE_POSITIVE_INTEGER: 'nullable_positive_integer',
  SAME_AS_FIELD: 'same_as_field',
  STRING: 'string',
});

function ackField(name, type, options = {}) {
  return Object.freeze({ name, type, ...options });
}

function ownerCommandContract({
  action,
  canonicalKeys,
  commandFamily,
  fallbackErrorCode,
  resultFields,
  transportMethod,
} = {}) {
  return Object.freeze({
    action,
    kind: SETTINGS_COMMAND_KINDS.OWNER_COMMAND,
    channel: SETTINGS_COMMAND_CHANNELS.PROTOCOL,
    canonicalKeys: freezeList(canonicalKeys),
    commandFamily,
    fallbackErrorCode,
    transportMethod,
    resultFields: Object.freeze(resultFields),
    delivery: SETTINGS_RUNTIME_DELIVERY,
    security: Object.freeze({
      senderScope: SETTINGS_COMMAND_SENDER_SCOPES.EXTENSION_PAGE,
      sensitiveWriteAcknowledgement: false,
    }),
    acknowledgement: Object.freeze({
      committedItemsField: 'items',
      changedKeysAreSemanticEffects: true,
      requireChangedKeyItemCoverage: true,
      requirePendingKeyCoverageAtDashboard: true,
    }),
  });
}

const SITE_RULE_CANONICAL_KEYS = freezeList([
  'blockedUrls',
  'allowedUrls',
  'siteRuleTimeline',
  'siteGoals',
  'siteGoalMeta',
  'protectionPresetAssignments',
]);

export const SETTINGS_RUNTIME_COMMAND_CONTRACTS = Object.freeze({
  [MESSAGE_ACTIONS.SET_SETTINGS]: Object.freeze({
    action: MESSAGE_ACTIONS.SET_SETTINGS,
    kind: SETTINGS_COMMAND_KINDS.RUNTIME_PATCH,
    channel: null,
    canonicalKeys: freezeList(Object.keys(SETTINGS_KEY_COMMAND_CONTRACTS)),
    resultFields: Object.freeze([]),
    delivery: SETTINGS_RUNTIME_DELIVERY,
    security: Object.freeze({
      senderScope: SETTINGS_COMMAND_SENDER_SCOPES.TRUSTED_EXTENSION_SENDER,
      sensitiveWriteAcknowledgement: true,
    }),
    acknowledgement: Object.freeze({
      committedItemsField: 'committedItems',
      changedKeysAreSemanticEffects: true,
      requireChangedKeyItemCoverage: false,
      requirePendingKeyCoverageAtDashboard: true,
    }),
  }),
  [MESSAGE_ACTIONS.UPSERT_SITE_RULE]: ownerCommandContract({
    action: MESSAGE_ACTIONS.UPSERT_SITE_RULE,
    canonicalKeys: freezeList([...SITE_RULE_CANONICAL_KEYS, ...FIRST_USE_POLICY_KEYS]),
    commandFamily: 'site_rule',
    fallbackErrorCode: 'UPSERT_SITE_RULE_FAILED',
    transportMethod: 'upsertSiteRuleViaRuntime',
    resultFields: [
      ackField('domain', ACK_FIELD_TYPES.STRING),
      ackField('type', ACK_FIELD_TYPES.ENUM, { values: freezeList(['allowed', 'blocked']) }),
      ackField('goalMinutes', ACK_FIELD_TYPES.NULLABLE_POSITIVE_INTEGER),
      ackField('firstUseResult', ACK_FIELD_TYPES.ENUM, {
        values: freezeList(['registered', 'already_protected']), optional: true,
      }),
    ],
  }),
  [MESSAGE_ACTIONS.COMPLETE_FIRST_USE]: ownerCommandContract({
    action: MESSAGE_ACTIONS.COMPLETE_FIRST_USE,
    canonicalKeys: FIRST_USE_POLICY_KEYS,
    commandFamily: 'first_use',
    fallbackErrorCode: 'COMPLETE_FIRST_USE_FAILED',
    transportMethod: 'completeFirstUseViaRuntime',
    resultFields: [],
  }),
  [MESSAGE_ACTIONS.REMOVE_SITE_RULE]: ownerCommandContract({
    action: MESSAGE_ACTIONS.REMOVE_SITE_RULE,
    canonicalKeys: SITE_RULE_CANONICAL_KEYS,
    commandFamily: 'site_rule',
    fallbackErrorCode: 'REMOVE_SITE_RULE_FAILED',
    transportMethod: 'removeSiteRuleViaRuntime',
    resultFields: [
      ackField('domain', ACK_FIELD_TYPES.STRING),
      ackField('type', ACK_FIELD_TYPES.ENUM, {
        values: freezeList(['all', 'allowed', 'blocked']),
      }),
    ],
  }),
  [MESSAGE_ACTIONS.UPDATE_SITE_RULE]: ownerCommandContract({
    action: MESSAGE_ACTIONS.UPDATE_SITE_RULE,
    canonicalKeys: freezeList(['siteGoals', 'siteGoalMeta', 'protectionPresetAssignments']),
    commandFamily: 'site_rule',
    fallbackErrorCode: 'UPDATE_SITE_RULE_FAILED',
    transportMethod: 'updateSiteRuleViaRuntime',
    resultFields: [ackField('domain', ACK_FIELD_TYPES.STRING)],
  }),
  [MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET]: ownerCommandContract({
    action: MESSAGE_ACTIONS.CREATE_PROTECTION_PRESET,
    canonicalKeys: freezeList(['protectionPresetCatalog']),
    commandFamily: 'protection_preset',
    fallbackErrorCode: 'CREATE_PROTECTION_PRESET_FAILED',
    transportMethod: 'createProtectionPresetViaRuntime',
    resultFields: [
      ackField('presetId', ACK_FIELD_TYPES.STRING),
      ackField('preset', ACK_FIELD_TYPES.MATCHING_OBJECT, {
        objectField: 'id',
        referenceField: 'presetId',
      }),
    ],
  }),
  [MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET]: ownerCommandContract({
    action: MESSAGE_ACTIONS.UPDATE_PROTECTION_PRESET,
    canonicalKeys: freezeList(['protectionPresetCatalog']),
    commandFamily: 'protection_preset',
    fallbackErrorCode: 'UPDATE_PROTECTION_PRESET_FAILED',
    transportMethod: 'updateProtectionPresetViaRuntime',
    resultFields: [
      ackField('presetId', ACK_FIELD_TYPES.STRING),
      ackField('preset', ACK_FIELD_TYPES.MATCHING_OBJECT, {
        objectField: 'id',
        referenceField: 'presetId',
      }),
    ],
  }),
  [MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET]: ownerCommandContract({
    action: MESSAGE_ACTIONS.DELETE_PROTECTION_PRESET,
    canonicalKeys: freezeList(['protectionPresetCatalog', 'protectionPresetAssignments']),
    commandFamily: 'protection_preset',
    fallbackErrorCode: 'DELETE_PROTECTION_PRESET_FAILED',
    transportMethod: 'deleteProtectionPresetViaRuntime',
    resultFields: [
      ackField('presetId', ACK_FIELD_TYPES.STRING),
      ackField('deleted', ACK_FIELD_TYPES.BOOLEAN),
    ],
  }),
  [MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET]: ownerCommandContract({
    action: MESSAGE_ACTIONS.ASSIGN_GLOBAL_PROTECTION_PRESET,
    canonicalKeys: freezeList(['protectionPresetAssignments']),
    commandFamily: 'protection_preset',
    fallbackErrorCode: 'ASSIGN_GLOBAL_PROTECTION_PRESET_FAILED',
    transportMethod: 'assignGlobalProtectionPresetViaRuntime',
    resultFields: [
      ackField('presetId', ACK_FIELD_TYPES.STRING),
      ackField('assignedPresetId', ACK_FIELD_TYPES.SAME_AS_FIELD, {
        referenceField: 'presetId',
      }),
    ],
  }),
});

export function requireSettingsRuntimeCommandContract(action) {
  const contract = SETTINGS_RUNTIME_COMMAND_CONTRACTS[action];
  if (!contract) {
    throw createCommandInputError(SETTINGS_COMMAND_ACK_ERROR_CODE, {
      action,
      field: 'action',
    });
  }
  return contract;
}

export function listSettingsOwnerCommandContracts() {
  return Object.values(SETTINGS_RUNTIME_COMMAND_CONTRACTS)
    .filter((contract) => contract.kind === SETTINGS_COMMAND_KINDS.OWNER_COMMAND);
}

export function listSettingsRuntimeActionsBySenderScope(senderScope) {
  return Object.values(SETTINGS_RUNTIME_COMMAND_CONTRACTS)
    .filter((contract) => contract.security.senderScope === senderScope)
    .map((contract) => contract.action);
}

export function collectSettingsKeysByContract(predicate) {
  if (typeof predicate !== 'function') return [];
  return Object.entries(SETTINGS_KEY_COMMAND_CONTRACTS)
    .filter(([key, contract]) => predicate(contract, key))
    .map(([key]) => key);
}

export function collectSettingsOwnerMutationKeys(items = {}) {
  if (!isPlainObject(items)) return [];
  return Object.keys(items).filter((key) => {
    const contract = SETTINGS_KEY_COMMAND_CONTRACTS[key];
    return typeof contract?.mutationOwner === 'string';
  });
}

function createSecurityValueContractError(key, value, expectedType) {
  const error = new Error('SECURITY_SETTINGS_MUTATION_VALUE_INVALID');
  error.code = 'SECURITY_SETTINGS_MUTATION_VALUE_INVALID';
  error.key = key;
  error.valueType = value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value);
  error.expectedType = expectedType;
  return error;
}

function createClseValueContractError(key, cause = null) {
  const error = new Error(`CLSE_SETTINGS_VALUE_CONTRACT_INVALID:${key}`);
  error.code = 'CLSE_SETTINGS_VALUE_CONTRACT_INVALID';
  error.key = key;
  if (cause) error.cause = cause;
  return error;
}

export function assertSettingsCommandMutationValues(items = {}) {
  const source = isPlainObject(items) ? items : {};
  Object.entries(source).forEach(([key, value]) => {
    const expectedType = SETTINGS_KEY_COMMAND_CONTRACTS[key]?.valueType;
    if (expectedType && typeof value !== expectedType) {
      throw createSecurityValueContractError(key, value, expectedType);
    }
  });

  const clseFields = Object.entries(SETTINGS_KEY_COMMAND_CONTRACTS)
    .filter(([, contract]) => contract.clseControlField);
  const submittedClseFields = clseFields.filter(([key]) => (
    Object.prototype.hasOwnProperty.call(source, key)
  ));
  if (submittedClseFields.length === 0) return source;
  if (Object.prototype.hasOwnProperty.call(source, CLSE_ALERT_COOLDOWN_KEY)
    && !Number.isSafeInteger(source[CLSE_ALERT_COOLDOWN_KEY])) {
    throw createClseValueContractError(CLSE_ALERT_COOLDOWN_KEY);
  }

  const controls = Object.fromEntries(clseFields.map(([key, contract]) => [
    contract.clseControlField,
    Object.prototype.hasOwnProperty.call(source, key)
      ? source[key]
      : contract.clseValidationDefault,
  ]));
  try {
    requireCanonicalCLSEControlSnapshot(controls, 'CLSE_SETTINGS_VALUE_CONTRACT_INVALID');
  } catch (cause) {
    const [rejectedKey] = submittedClseFields.find(([, contract]) => (
      cause?.message === `CLSE_SETTINGS_VALUE_CONTRACT_INVALID:${contract.clseControlField}`
    )) || submittedClseFields[0];
    throw createClseValueContractError(rejectedKey, cause);
  }
  return source;
}

export function canonicalizeSettingsCommandItems(items = {}, settingsCache = {}) {
  const source = assertSettingsCommandMutationValues(items);
  const next = { ...source };
  Object.entries(source).forEach(([key, value]) => {
    const canonicalize = SETTINGS_KEY_COMMAND_CONTRACTS[key]?.canonicalize;
    if (typeof canonicalize === 'function') {
      next[key] = canonicalize(value, settingsCache);
    }
  });
  return next;
}

// Storage compares this projection with the original record exactly. It is
// validation evidence, never a repaired value or another settings source.
export function projectCanonicalStoredSetting(key, value) {
  const contract = SETTINGS_KEY_COMMAND_CONTRACTS[key];
  if (!contract || value === undefined || value === null) {
    throw new Error('SETTINGS_STORED_VALUE_INVALID:' + key);
  }
  assertSettingsCommandMutationValues({ [key]: value });
  if (typeof contract.storedCanonicalize === 'function') return contract.storedCanonicalize(value);
  if (typeof contract.canonicalize === 'function') return contract.canonicalize(value, {});
  return value;
}

export { ACK_FIELD_TYPES as SETTINGS_ACK_FIELD_TYPES };
