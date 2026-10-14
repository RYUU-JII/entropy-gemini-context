import { normalizeCoolingCurve } from '../../domains/settings/config/coolingCurvePolicy.js';
import { ZEN_RENDER_PRESET_IDS } from '../../domains/settings/config/zenRenderPreset.js';
import {
  CONFIG_DEFAULT_FILTER_SETTINGS,
  normalizeFilterSettings,
} from '../../domains/settings/config/index.js';
import {
  DEFAULT_INDICATOR_CONFIG,
  normalizeIndicatorConfig,
} from '../../domains/settings/config/indicator.js';
import { normalizeGateConfig } from '../../domains/settings/config/gateConfig.js';
import { normalizeTabManagement } from '../../domains/settings/config/tabManagement.js';
import { normalizeArtifactControlState } from '../../domains/settings/config/artifactControlState.js';
import {
  DEFAULT_NOTIFICATIONS_CONFIG,
  normalizeNotificationsConfig,
} from '../../domains/settings/config/notificationsConfig.js';
import {
  DEFAULT_DEBUG_CONFIG,
  normalizeDebugConfig,
} from '../../domains/settings/config/debugConfig.js';
import {
  DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  normalizeGlobalCapNotifyOnExceeded,
  resolveMemoryPurgeSettings,
  normalizeGlobalGoal,
  normalizeProductRulesMode,
  normalizeSiteGoalMeta,
  normalizeSiteGoals,
  normalizeSiteRuleTimeline,
  normalizeUrlList,
} from '../../domains/settings/config/siteRules.js';
import { normalizeSentinelStayDecisions } from '../../domains/settings/config/sentinelStayDecisions.js';
import {
  normalizeProtectionPresetAssignments,
  normalizeProtectionPresetCatalog,
} from '../../domains/protection/catalog/presetContract.js';
import {
  FILTERING_MODES,
  normalizeFilteringMode,
} from '../../domains/settings/config/blockingPolicy.js';
import {
  DEFAULT_SOLAR_LOCATION_PROFILE,
  normalizeSolarLocationProfile,
} from '../../domains/settings/config/solarLocation.js';
import {
  INSIGHTS_CONSENT,
  INSIGHTS_MODES,
  normalizeInsightsConsent,
  normalizeInsightsMode,
} from '../../domains/settings/config/insightsMode.js';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  DEFAULT_PRECISION_INSIGHTS_SIGNALS,
  DEFAULT_PRECISION_INSIGHTS_MODE,
  normalizeDataCollectionMode,
  normalizePrecisionInsightsSignals,
  normalizePrecisionInsightsMode,
} from '../../domains/settings/config/dataCollectionPolicy.js';
import {
  SCHEDULE_PLAN_SCHEMA_VERSION,
  normalizeSchedulePlan,
} from '../../domains/schedule/core/schedulePlan.js';
import { requireCanonicalCLSEControlSnapshot } from '../../domains/behavior/clseStatusContract.js';
import { isCanonicalThemeId } from '../../themes/core/ids.js';
import { SIDEBAR_DISPLAY_MODES } from '../../domains/settings/config/sidebarDisplayMode.js';

export const BOOT_PREWARM_SCHEMA_VERSION = 2;

export const BOOT_PREWARM_SECTION_KEYS = Object.freeze([
  'preference',
  'protocol',
  'analysis',
  'clse',
]);

const BOOT_PREWARM_SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'source',
  'generatedAtEpochMs',
  'staleAfterEpochMs',
  'reason',
  ...BOOT_PREWARM_SECTION_KEYS,
  'meta',
]);
const BOOT_PREWARM_ANALYSIS_KEYS = Object.freeze([
  'cycleState',
  'cycleSnapshot',
  'statusSnapshot',
]);
const BOOT_PREWARM_BUILD_STEP_ORDER = Object.freeze([
  'ensureSettingsCache',
  'readThemePreference',
  'readThemePreferenceSettings',
  'readSettingsCache',
  'resolvePrewarmFilterSettings',
  'readAnalysisBootstrapSnapshot',
  'readCLSEStatus',
  'buildProtocolSnapshot',
]);
const BOOT_PREWARM_DELIVERY_MODES = new Set(['build', 'cache_hit', 'in_flight']);
const SIDEBAR_DISPLAY_MODE_VALUES = new Set(Object.values(SIDEBAR_DISPLAY_MODES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function areCanonicalValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areCanonicalValuesEqual(value, right[index]));
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(right, key)
      && areCanonicalValuesEqual(left[key], right[key])
    ));
}

function createBootPrewarmContractError(field, cause = null) {
  const error = new Error(`BOOT_PREWARM_SNAPSHOT_INVALID:${field}`);
  error.code = 'BOOT_PREWARM_SNAPSHOT_INVALID';
  error.field = field;
  if (cause) error.cause = cause;
  return error;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    throw createBootPrewarmContractError(field);
  }
  return value;
}

function requireNonNegativeNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw createBootPrewarmContractError(field);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw createBootPrewarmContractError(field);
  }
  return value;
}

function cloneJsonObjectOrNull(value, field) {
  if (value === null) return null;
  if (!isPlainObject(value)) throw createBootPrewarmContractError(field);
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') throw new Error('UNSERIALIZABLE');
    const cloned = JSON.parse(serialized);
    if (!areCanonicalValuesEqual(value, cloned)) {
      throw new Error('NON_CANONICAL_JSON_VALUE');
    }
    return cloned;
  } catch (error) {
    throw createBootPrewarmContractError(field, error);
  }
}

function cloneSchedule(schedule) {
  const expectedKeys = [
    'schemaVersion',
    'days',
    'blocks',
    'startMin',
    'endMin',
  ];
  if (
    !hasExactKeys(schedule, expectedKeys)
    || schedule.schemaVersion !== SCHEDULE_PLAN_SCHEMA_VERSION
  ) throw new Error('BOOT_PREWARM_SCHEDULE_CONTRACT_INVALID');
  const normalized = normalizeSchedulePlan({
    schemaVersion: schedule.schemaVersion,
    days: schedule.days,
    windows: schedule.blocks,
    startMin: schedule.startMin,
    endMin: schedule.endMin,
  }, {
    requireNonEmptyDays: true,
    createMissingWindowIds: false,
  });
  const result = {
    schemaVersion: normalized.schemaVersion,
    days: [...normalized.days],
    blocks: normalized.windows.map((block) => ({ ...block })),
    startMin: normalized.startMin,
    endMin: normalized.endMin,
  };
  if (!areCanonicalValuesEqual(schedule, result)) {
    throw new Error('BOOT_PREWARM_SCHEDULE_CONTRACT_INVALID');
  }
  return result;
}

export function buildBootPrewarmProtocolSnapshot({
  settingsCache,
  filterSettings,
  schedule = settingsCache?.relaxationSchedule,
}) {
  const source = isPlainObject(settingsCache) ? settingsCache : {};
  if (Object.hasOwn(source, 'globalFrictionLevel')) throw new Error('GLOBAL_FRICTION_LEVEL_RETIRED_PROFILE_RESET_REQUIRED');
  if (source.permissionMode !== 'selective') {
    throw new Error('BOOT_PREWARM_PERMISSION_MODE_CONTRACT_INVALID');
  }
  const memoryPurgeSettings = resolveMemoryPurgeSettings(source);
  const insightsMode = normalizeInsightsMode(source.insightsMode, INSIGHTS_MODES.OFF);
  const dataCollectionMode = normalizeDataCollectionMode(
    source.dataCollectionMode,
    DEFAULT_DATA_COLLECTION_MODE,
  );
  const precisionInsightsMode = normalizePrecisionInsightsMode(
    source.precisionInsightsMode,
    DEFAULT_PRECISION_INSIGHTS_MODE,
  );
  const precisionInsightsSignals = normalizePrecisionInsightsSignals(
    source.precisionInsightsSignals,
    DEFAULT_PRECISION_INSIGHTS_SIGNALS,
  );
  return {
    blockedUrls: normalizeUrlList(source.blockedUrls, []),
    allowedUrls: normalizeUrlList(source.allowedUrls, []),
    trackingExcludedUrls: normalizeUrlList(source.trackingExcludedUrls, []),
    filteringMode: normalizeFilteringMode(source.filteringMode || FILTERING_MODES.BLOCKLIST),
    siteGoals: normalizeSiteGoals(source.siteGoals),
    siteGoalMeta: normalizeSiteGoalMeta(source.siteGoalMeta),
    siteRuleTimeline: normalizeSiteRuleTimeline(source.siteRuleTimeline),
    sentinelStayDecisions: normalizeSentinelStayDecisions(source.sentinelStayDecisions),
    protectionPresetCatalog: normalizeProtectionPresetCatalog(source.protectionPresetCatalog),
    protectionPresetAssignments: normalizeProtectionPresetAssignments(source.protectionPresetAssignments),
    rulesMode: normalizeProductRulesMode(source.rulesMode),
    coolingCurve: normalizeCoolingCurve(source.coolingCurve),
    globalGoal: normalizeGlobalGoal(source.globalGoal),
    globalCapNotifyOnExceeded: normalizeGlobalCapNotifyOnExceeded(
      source.globalCapNotifyOnExceeded,
      DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    ),
    historyCleanupForBlocked: memoryPurgeSettings.historyCleanupForBlocked,
    concealBlockedBookmarks: memoryPurgeSettings.concealBlockedBookmarks,
    tabEvaporationForBlocked: memoryPurgeSettings.tabEvaporationForBlocked,
    tabEvaporationTimeoutMinutes: memoryPurgeSettings.tabEvaporationTimeoutMinutes,
    gateConfig: normalizeGateConfig(source.gateConfig),
    tabManagement: normalizeTabManagement(source.tabManagement),
    artifactControlState: normalizeArtifactControlState(source.artifactControlState),
    notificationsConfig: normalizeNotificationsConfig(source.notificationsConfig, {
      defaults: DEFAULT_NOTIFICATIONS_CONFIG,
    }),
    debugConfig: normalizeDebugConfig(source.debugConfig, {
      defaults: DEFAULT_DEBUG_CONFIG,
    }),
    schedule: cloneSchedule(schedule),
    filterSettings: normalizeFilterSettings(filterSettings),
    indicatorConfig: normalizeIndicatorConfig(source.indicatorConfig || DEFAULT_INDICATOR_CONFIG),
    insightsConsent: normalizeInsightsConsent(source.insightsConsent, INSIGHTS_CONSENT.UNSET),
    insightsMode,
    dataCollectionMode,
    precisionInsightsMode,
    precisionInsightsSignals,
    permissionMode: 'selective',
    solarLocationProfile: normalizeSolarLocationProfile(
      source.solarLocationProfile,
      DEFAULT_SOLAR_LOCATION_PROFILE,
    ),
  };
}

export function requireBootPrewarmProtocolSnapshot(value) {
  if (!isPlainObject(value)) {
    throw createBootPrewarmContractError('protocol');
  }
  let canonical;
  try {
    canonical = buildBootPrewarmProtocolSnapshot({
      settingsCache: value,
      filterSettings: value.filterSettings,
      schedule: value.schedule,
    });
  } catch (error) {
    throw createBootPrewarmContractError('protocol', error);
  }
  if (!areCanonicalValuesEqual(value, canonical)) {
    throw createBootPrewarmContractError('protocol');
  }
  return canonical;
}

function requirePreference(value) {
  if (
    !hasExactKeys(value, ['themeId', 'sidebarDisplayMode', 'zenRenderPreset'])
    || !isCanonicalThemeId(value.themeId)
    || !SIDEBAR_DISPLAY_MODE_VALUES.has(value.sidebarDisplayMode)
    || !Object.values(ZEN_RENDER_PRESET_IDS).includes(value.zenRenderPreset)
  ) throw createBootPrewarmContractError('preference');
  return { ...value };
}

function requireAnalysis(value) {
  if (!hasExactKeys(value, BOOT_PREWARM_ANALYSIS_KEYS)) {
    throw createBootPrewarmContractError('analysis');
  }
  return {
    cycleState: cloneJsonObjectOrNull(value.cycleState, 'analysis.cycleState'),
    cycleSnapshot: cloneJsonObjectOrNull(value.cycleSnapshot, 'analysis.cycleSnapshot'),
    statusSnapshot: cloneJsonObjectOrNull(value.statusSnapshot, 'analysis.statusSnapshot'),
  };
}

function requireClse(value) {
  if (!hasExactKeys(value, ['isEnabled', 'sensitivityScale', 'alertCooldownMs'])) {
    throw createBootPrewarmContractError('clse');
  }
  try {
    const canonical = requireCanonicalCLSEControlSnapshot(
      value,
      'BOOT_PREWARM_CLSE_STATUS_INVALID',
    );
    if (!areCanonicalValuesEqual(value, canonical)) {
      throw createBootPrewarmContractError('clse');
    }
    return canonical;
  } catch (error) {
    if (error?.code === 'BOOT_PREWARM_SNAPSHOT_INVALID') throw error;
    throw createBootPrewarmContractError('clse', error);
  }
}

function requireAnalysisBootstrapDiagnostics(value) {
  const keys = [
    'available',
    'error',
    'hasCycleState',
    'hasCycleSnapshot',
    'hasStatusSnapshot',
  ];
  if (
    !hasExactKeys(value, keys)
    || typeof value.available !== 'boolean'
    || (value.error !== null && (
      typeof value.error !== 'string' || !value.error.trim() || value.error !== value.error.trim()
    ))
    || typeof value.hasCycleState !== 'boolean'
    || typeof value.hasCycleSnapshot !== 'boolean'
    || typeof value.hasStatusSnapshot !== 'boolean'
    || (!value.available && (
      value.hasCycleState || value.hasCycleSnapshot || value.hasStatusSnapshot
    ))
  ) throw createBootPrewarmContractError('meta.diagnostics.build.analysisBootstrap');
  return { ...value };
}

function requireBuildDiagnostics(value) {
  const keys = [
    'totalMs',
    'failedStep',
    'timingsMs',
    'steps',
    'usedCycleStateDirectRead',
    'analysisBootstrap',
  ];
  if (
    !hasExactKeys(value, keys)
    || value.failedStep !== null
    || !isPlainObject(value.timingsMs)
    || !Array.isArray(value.steps)
    || typeof value.usedCycleStateDirectRead !== 'boolean'
  ) throw createBootPrewarmContractError('meta.diagnostics.build');
  const totalMs = requireNonNegativeNumber(value.totalMs, 'meta.diagnostics.build.totalMs');
  const expectedStepOrder = value.usedCycleStateDirectRead
    ? [
      ...BOOT_PREWARM_BUILD_STEP_ORDER.slice(0, 6),
      'readCycleStateDirect',
      ...BOOT_PREWARM_BUILD_STEP_ORDER.slice(6),
    ]
    : [...BOOT_PREWARM_BUILD_STEP_ORDER];
  if (
    value.steps.length !== expectedStepOrder.length
    || Object.keys(value.timingsMs).length !== expectedStepOrder.length
  ) throw createBootPrewarmContractError('meta.diagnostics.build.steps');
  const steps = value.steps.map((step, index) => {
    const expectedStep = expectedStepOrder[index];
    const expectedKeys = step?.ok === false
      ? ['step', 'durationMs', 'ok', 'error']
      : ['step', 'durationMs', 'ok'];
    if (
      !hasExactKeys(step, expectedKeys)
      || step.step !== expectedStep
      || typeof step.ok !== 'boolean'
      || (step.ok === false && (
        step.step !== 'readAnalysisBootstrapSnapshot'
        || typeof step.error !== 'string'
        || !step.error.trim()
        || step.error !== step.error.trim()
      ))
    ) throw createBootPrewarmContractError(`meta.diagnostics.build.steps.${index}`);
    const durationMs = requireNonNegativeNumber(
      step.durationMs,
      `meta.diagnostics.build.steps.${index}.durationMs`,
    );
    if (
      !Object.prototype.hasOwnProperty.call(value.timingsMs, expectedStep)
      || value.timingsMs[expectedStep] !== durationMs
    ) throw createBootPrewarmContractError(`meta.diagnostics.build.timingsMs.${expectedStep}`);
    return { ...step };
  });
  const analysisBootstrap = requireAnalysisBootstrapDiagnostics(value.analysisBootstrap);
  const analysisStep = steps.find((step) => step.step === 'readAnalysisBootstrapSnapshot');
  if (
    analysisBootstrap.error !== (analysisStep?.ok === false ? analysisStep.error : null)
    || value.usedCycleStateDirectRead !== !analysisBootstrap.hasCycleState
  ) throw createBootPrewarmContractError('meta.diagnostics.build.analysisBootstrap');
  return {
    totalMs,
    failedStep: null,
    timingsMs: { ...value.timingsMs },
    steps,
    usedCycleStateDirectRead: value.usedCycleStateDirectRead,
    analysisBootstrap,
  };
}

function requireDeliveryDiagnostics(value) {
  const keys = [
    'mode',
    'requestDurationMs',
    'force',
    'reason',
    'snapshotAgeMs',
    'snapshotStaleInMs',
  ];
  if (
    !hasExactKeys(value, keys)
    || !BOOT_PREWARM_DELIVERY_MODES.has(value.mode)
    || typeof value.force !== 'boolean'
  ) throw createBootPrewarmContractError('meta.diagnostics.delivery');
  return {
    mode: value.mode,
    requestDurationMs: requireNonNegativeNumber(
      value.requestDurationMs,
      'meta.diagnostics.delivery.requestDurationMs',
    ),
    force: value.force,
    reason: requireNonEmptyString(value.reason, 'meta.diagnostics.delivery.reason'),
    snapshotAgeMs: requireNonNegativeNumber(
      value.snapshotAgeMs,
      'meta.diagnostics.delivery.snapshotAgeMs',
    ),
    snapshotStaleInMs: requireNonNegativeNumber(
      value.snapshotStaleInMs,
      'meta.diagnostics.delivery.snapshotStaleInMs',
    ),
  };
}

function requireMeta(value, snapshot) {
  if (
    !hasExactKeys(value, ['statsDaysBack', 'ttlMs', 'diagnostics'])
    || !Number.isSafeInteger(value.statsDaysBack)
    || value.statsDaysBack < 1
    || value.statsDaysBack > 180
    || !Number.isSafeInteger(value.ttlMs)
    || value.ttlMs < 5_000
    || value.ttlMs > 300_000
    || snapshot.staleAfterEpochMs - snapshot.generatedAtEpochMs !== value.ttlMs
    || !hasExactKeys(value.diagnostics, ['build', 'delivery'])
  ) throw createBootPrewarmContractError('meta');
  return {
    statsDaysBack: value.statsDaysBack,
    ttlMs: value.ttlMs,
    diagnostics: {
      build: requireBuildDiagnostics(value.diagnostics.build),
      delivery: requireDeliveryDiagnostics(value.diagnostics.delivery),
    },
  };
}

export function requireBootPrewarmDashboardSnapshot(value) {
  if (!hasExactKeys(value, BOOT_PREWARM_SNAPSHOT_KEYS)) {
    throw createBootPrewarmContractError('fields');
  }
  if (value.schemaVersion !== BOOT_PREWARM_SCHEMA_VERSION) {
    throw createBootPrewarmContractError('schemaVersion');
  }
  if (value.source !== 'background-prewarm') {
    throw createBootPrewarmContractError('source');
  }
  const generatedAtEpochMs = requirePositiveInteger(
    value.generatedAtEpochMs,
    'generatedAtEpochMs',
  );
  const staleAfterEpochMs = requirePositiveInteger(
    value.staleAfterEpochMs,
    'staleAfterEpochMs',
  );
  if (staleAfterEpochMs <= generatedAtEpochMs) {
    throw createBootPrewarmContractError('staleAfterEpochMs');
  }
  const snapshot = {
    schemaVersion: BOOT_PREWARM_SCHEMA_VERSION,
    source: value.source,
    generatedAtEpochMs,
    staleAfterEpochMs,
    reason: requireNonEmptyString(value.reason, 'reason'),
    preference: requirePreference(value.preference),
    protocol: requireBootPrewarmProtocolSnapshot(value.protocol),
    analysis: requireAnalysis(value.analysis),
    clse: requireClse(value.clse),
    meta: null,
  };
  snapshot.meta = requireMeta(value.meta, snapshot);
  if (!areCanonicalValuesEqual(value, snapshot)) {
    throw createBootPrewarmContractError('canonical');
  }
  return snapshot;
}
