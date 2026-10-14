import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../settings/config/index.js';
import { DEFAULT_COOLING_CURVE, normalizeCoolingCurve } from '../../settings/config/coolingCurvePolicy.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../settings/config/nudgeConfig.js';
import {
  resolveCollectionPolicySnapshot, resolveSitesRecordingPolicy, resolveDomainUsageRecording,
} from '../../settings/config/dataCollectionPolicy.js';
import {
  DEFAULT_GATE_CONFIG,
  isGateConfigEnabled,
  normalizeGateConfig,
} from '../../settings/config/gateConfig.js';
import {
  DEFAULT_ARTIFACT_CONTROL_STATE,
  normalizeArtifactControlState,
} from '../../settings/config/artifactControlState.js';
import {
  DEFAULT_RULES_MODE,
  normalizeRulesMode,
  resolveMemoryPurgeSettings,
} from '../../settings/config/siteRules.js';
import {
  evaluateProtectionGlobalCapState,
  getBasicRecentUsageDateWindow,
} from '../domain/index.js';
import {
  buildDomainHashCandidates,
  getDomainValueFromHashMap,
  isDomainInHashList,
} from '../../../platform/security/domainRuleMatcher.js';
import {
  ensureNumber,
  getHostname,
  getLocalDateStr,
} from '../../../lib/index.js';
import {
  STORAGE_SESSION_KEYS,
} from '../../../platform/storage/runtime/RuntimeFlagRepository.js';
import {
  normalizeSpecialSessionState,
} from '../../settings/config/specialSession.js';
import { resolveProtectionScope } from './protocol/engine/ProtectionScopeResolver.js';
import { resolveProtectedHostnameScope } from './protectedHostnameScope.js';
import { projectGateConsumedContexts } from './runtime/gateConsumedContextProjection.js';
import { describeArtifactControlStateForFamily } from '../runtime/ArtifactControlService.js';
import { projectProtectedConsumptionContext } from '../../behavior/consumption/consumptionContext.js';
import { projectConsumptionExposureContext } from '../../behavior/consumption/consumptionExposureContext.js';
import { requireConsumptionMemoryRead } from '../../behavior/consumption/consumptionMemoryModel.js';
import { readActivityDaySiteCharge, requireProtectionCharge } from '../../stats/projection/projectProtectionBudget.js';
import {
  normalizeGateProtectedContextSnapshot,
  normalizeGateRuntimeSnapshot,
} from './runtime/GateRuntimeSnapshotContract.js';

const SIGNAL_CACHE_TTL_MS = 10_000;
const SIGNAL_WINDOW_MS = 3 * 60_000;
const SIGNAL_LIMIT = 120;

const PROTECTION_SETTINGS_DEFAULTS = Object.freeze({
  allowedUrlHashes: [],
  allowedUrls: [],
  blockedUrlHashes: [],
  blockedUrls: [],
  concealBlockedBookmarks: false,
  domainHmacSecret: '',
  filterSettings: CONFIG_DEFAULT_FILTER_SETTINGS,
  artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
  filteringMode: null,
  gateConfig: DEFAULT_GATE_CONFIG,
  coolingCurve: DEFAULT_COOLING_CURVE,
  globalGoal: 0,
  globalCapNotifyOnExceeded: false,
  relaxationSchedule: null,
  historyCleanupForBlocked: false,
  nudgeConfig: DEFAULT_NUDGE_SETTINGS,
  protectionPresetAssignments: {},
  protectionPresetCatalog: {},
  rulesMode: null,
  siteGoalHashes: {},
  siteGoalMeta: {},
  siteGoals: {},
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireRuntimeInputFunction(candidate, errorCode) {
  if (typeof candidate !== 'function') {
    throw new Error(errorCode);
  }
  return candidate;
}

function requireRuntimeFlagSessionResult(session) {
  if (!isPlainObject(session)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_RUNTIME_FLAG_SESSION_INVALID');
  }
  return session;
}

function readNullableRuntimeFlagObject(session, key, errorCode) {
  const value = session[key];
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireRuntimeInputOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireRuntimeStateCoordinator(runtimeStateCoordinator) {
  [
    'getAggressionSignalCache',
    'setAggressionSignalCache',
    'getFeedFlowSnapshot',
    'getGateHostSnapshot',
    'getGateEntryApproval',
    'getGateReturnLock',
    'observeGateSitePresence',
    'observeGateDetourSpreadLevel',
  ].forEach((methodName) => {
    if (!runtimeStateCoordinator || typeof runtimeStateCoordinator[methodName] !== 'function') {
      throw new Error('PROTECTION_RUNTIME_INPUT_STATE_COORDINATOR_OWNER_REQUIRED');
    }
  });
}

function resolveSettingsSourceOwner({ settingsService, settingsCache }) {
  if (isPlainObject(settingsCache)) {
    return {
      settingsCache,
      ...(settingsService ? {
        ensureSettingsCache: requireRuntimeInputOwnerMethod(
          settingsService,
          'ensureSettingsCache',
          'PROTECTION_RUNTIME_INPUT_SETTINGS_CACHE_OWNER_REQUIRED',
        ),
      } : {}),
    };
  }

  return {
    ensureSettingsCache: requireRuntimeInputOwnerMethod(
      settingsService,
      'ensureSettingsCache',
      'PROTECTION_RUNTIME_INPUT_SETTINGS_CACHE_OWNER_REQUIRED',
    ),
    getSettingsCache: requireRuntimeInputOwnerMethod(
      settingsService,
      'getSettingsCache',
      'PROTECTION_RUNTIME_INPUT_SETTINGS_CACHE_OWNER_REQUIRED',
    ),
  };
}

function buildSettingsValuePath(path, key) {
  return `${path}.${key}`;
}

function buildSettingsArrayPath(path, index) {
  return `${path}[${index}]`;
}

function assertJsonLikeSettingsValue(value, path, seen = new WeakSet()) {
  if (value === undefined) {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_UNDEFINED:${path}`);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_NON_FINITE:${path}`);
    }
    return;
  }
  if (
    typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
  ) {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_UNCLONEABLE:${path}`);
  }
  if (typeof value !== 'object') {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_UNSUPPORTED:${path}`);
  }
  if (seen.has(value)) {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_CYCLE:${path}`);
  }
  if (Array.isArray(value)) {
    seen.add(value);
    value.forEach((entry, index) => {
      assertJsonLikeSettingsValue(entry, buildSettingsArrayPath(path, index), seen);
    });
    seen.delete(value);
    return;
  }
  if (!isPlainObject(value)) {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_VALUE_NON_PLAIN:${path}`);
  }
  seen.add(value);
  Object.entries(value).forEach(([key, entry]) => {
    assertJsonLikeSettingsValue(entry, buildSettingsValuePath(path, key), seen);
  });
  seen.delete(value);
}

function clonePlainValue(value, fallback, path = 'settings') {
  const candidate = value === undefined ? fallback : value;
  if (candidate === undefined) return undefined;
  assertJsonLikeSettingsValue(candidate, path);
  if (candidate === null || typeof candidate !== 'object') return candidate;
  try {
    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(candidate);
    }
  } catch (error) {
    throw new Error(`PROTECTION_RUNTIME_INPUT_SETTINGS_CLONE_FAILED:${path}`, { cause: error });
  }
  return JSON.parse(JSON.stringify(candidate));
}

function resolveCapStateOverride(capStateOverride, buildDefault) {
  if (capStateOverride === null || capStateOverride === undefined) {
    return buildDefault();
  }
  if (!isPlainObject(capStateOverride)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_CAP_STATE_OVERRIDE_INVALID');
  }
  return capStateOverride;
}

function normalizeDirectTriggers(directTriggers = []) {
  if (directTriggers === null || directTriggers === undefined) {
    return [];
  }
  if (!Array.isArray(directTriggers)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_DIRECT_TRIGGERS_INVALID');
  }
  return directTriggers.map((trigger, index) => {
    if (typeof trigger !== 'string' || !trigger.trim()) {
      throw new Error(`PROTECTION_RUNTIME_INPUT_DIRECT_TRIGGER_INVALID:${index}`);
    }
    return trigger.trim();
  });
}

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeAggressionSignalCache(snapshot = null) {
  if (!isPlainObject(snapshot)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_AGGRESSION_CACHE_INVALID:snapshot');
  }
  if (!Number.isInteger(snapshot.checkedAt) || snapshot.checkedAt < 0) {
    throw new Error('PROTECTION_RUNTIME_INPUT_AGGRESSION_CACHE_INVALID:checkedAt');
  }
  if (!Array.isArray(snapshot.scores)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_AGGRESSION_CACHE_INVALID:scores');
  }
  const scores = snapshot.scores.map((value, index) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`PROTECTION_RUNTIME_INPUT_AGGRESSION_CACHE_INVALID:scores.${index}`);
    }
    return value;
  });

  return {
    checkedAt: snapshot.checkedAt,
    scores,
  };
}

function isWebUrl(url = '') {
  return typeof url === 'string'
    && (url.startsWith('http://') || url.startsWith('https://'));
}

async function buildProtectedTabSnapshot(tabs = [], settingsSnapshot = {}, now = Date.now(), specialSession = null, skippedOccurrenceId = null) {
  if (!Array.isArray(tabs)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_TABS_QUERY_INVALID');
  }
  const scopeByHost = new Map();
  const protectedTabs = [];
  const seenTabIds = new Set();

  for (const tab of tabs) {
    // A new background tab can still report about:blank while its first web
    // navigation is pending. Count that requested protected tab immediately.
    const rawTabUrl = isWebUrl(tab?.url)
      ? tab.url
      : (typeof tab?.pendingUrl === 'string' ? tab.pendingUrl : '');
    if (!rawTabUrl || !isWebUrl(rawTabUrl)) continue;
    const hostname = normalizeHost(getHostname(rawTabUrl));
    if (!hostname) continue;

    if (!scopeByHost.has(hostname)) {
      const scope = await resolveProtectedHostnameScope(hostname, settingsSnapshot, now, specialSession, skippedOccurrenceId);
      scopeByHost.set(hostname, scope.ok && scope.isBlockedDomain);
    }
    if (!scopeByHost.get(hostname)) continue;

    const tabId = Number(tab.id);
    if (!Number.isInteger(tabId) || tabId < 0) continue;
    if (seenTabIds.has(tabId)) continue;
    seenTabIds.add(tabId);

    const protectedTab = {
      tabId,
      hostname,
      url: rawTabUrl,
      title: typeof tab.title === 'string' ? tab.title : '',
      favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
      active: tab.active === true,
    };
    if (Number.isInteger(Number(tab.windowId)) && Number(tab.windowId) >= 0) {
      protectedTab.windowId = Number(tab.windowId);
    }
    if (Number.isInteger(Number(tab.index)) && Number(tab.index) >= 0) {
      protectedTab.index = Number(tab.index);
    }
    if (Number.isInteger(Number(tab.openerTabId)) && Number(tab.openerTabId) >= 0) {
      protectedTab.openerTabId = Number(tab.openerTabId);
    }
    protectedTabs.push(protectedTab);
  }

  protectedTabs.sort((left, right) => (
    (left.windowId ?? Number.MAX_SAFE_INTEGER) - (right.windowId ?? Number.MAX_SAFE_INTEGER)
    || (left.index ?? Number.MAX_SAFE_INTEGER) - (right.index ?? Number.MAX_SAFE_INTEGER)
    || left.tabId - right.tabId
  ));

  return {
    protectedTabCount: protectedTabs.length,
    protectedTabHostCount: new Set(protectedTabs.map((entry) => entry.hostname)).size,
    protectedTabs,
  };
}

function buildGateSessionProtectedTabCandidates(gateSessions = [], tabs = []) {
  if (!Array.isArray(gateSessions)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_GATE_SESSIONS_INVALID');
  }
  const tabsById = new Map(
    (Array.isArray(tabs) ? tabs : [])
      .map((tab) => [Number(tab?.id), tab])
      .filter(([tabId]) => Number.isInteger(tabId) && tabId >= 0),
  );

  return gateSessions.reduce((acc, session) => {
    if (!isPlainObject(session)) return acc;
    const status = typeof session.status === 'string' ? session.status.trim().toLowerCase() : 'pending';
    if (status !== 'pending' && status !== 'resuming') return acc;
    const tabId = Number(session.tabId);
    const originalUrl = typeof session.originalUrl === 'string' ? session.originalUrl.trim() : '';
    if (!Number.isInteger(tabId) || tabId < 0 || !isWebUrl(originalUrl)) return acc;
    const hostname = normalizeHost(session.hostname || getHostname(originalUrl));
    if (!hostname) return acc;

    const currentTab = tabsById.get(tabId);
    // Session cleanup follows browser events asynchronously. A closed tab or a
    // tab that went Back elsewhere must not be resurrected by its old session.
    // Web documents are already counted from the browser inventory above.
    if (!currentTab || typeof session.gatePageUrl !== 'string'
      || currentTab.url !== session.gatePageUrl) return acc;
    const sessionProtectedTab = Array.isArray(session.protectedTabs)
      ? session.protectedTabs.find((entry) => Number(entry?.tabId) === tabId) || {}
      : {};
    acc.push({
      id: tabId,
      url: originalUrl,
      title: typeof sessionProtectedTab.title === 'string' && sessionProtectedTab.title.trim()
        ? sessionProtectedTab.title.trim()
        : (typeof currentTab.title === 'string' ? currentTab.title : ''),
      favIconUrl: typeof sessionProtectedTab.favIconUrl === 'string' && sessionProtectedTab.favIconUrl.trim()
        ? sessionProtectedTab.favIconUrl.trim()
        : (typeof currentTab.favIconUrl === 'string' ? currentTab.favIconUrl : ''),
      active: currentTab.active === true,
      windowId: currentTab.windowId,
      index: currentTab.index,
      openerTabId: currentTab.openerTabId,
    });
    return acc;
  }, []);
}

function snapshotProtectionSettings(source = {}, { filterSettings, defaultFilterSettings } = {}) {
  const settingsSource = source && typeof source === 'object' ? source : {};
  if (Object.hasOwn(settingsSource, 'globalFrictionLevel')) throw new Error('GLOBAL_FRICTION_LEVEL_RETIRED_PROFILE_RESET_REQUIRED');
  const memoryPurgeSettings = resolveMemoryPurgeSettings(settingsSource);
  const resolvedFilterSettings = filterSettings === undefined
    ? (settingsSource.filterSettings ?? defaultFilterSettings)
    : filterSettings;

  return {
    ...resolveCollectionPolicySnapshot(settingsSource),
    trackingExcludedUrls: clonePlainValue(settingsSource.trackingExcludedUrls, [], 'trackingExcludedUrls'),
    allowedUrlHashes: clonePlainValue(
      settingsSource.allowedUrlHashes,
      PROTECTION_SETTINGS_DEFAULTS.allowedUrlHashes,
      'allowedUrlHashes',
    ),
    allowedUrls: clonePlainValue(
      settingsSource.allowedUrls,
      PROTECTION_SETTINGS_DEFAULTS.allowedUrls,
      'allowedUrls',
    ),
    blockedUrlHashes: clonePlainValue(
      settingsSource.blockedUrlHashes,
      PROTECTION_SETTINGS_DEFAULTS.blockedUrlHashes,
      'blockedUrlHashes',
    ),
    blockedUrls: clonePlainValue(
      settingsSource.blockedUrls,
      PROTECTION_SETTINGS_DEFAULTS.blockedUrls,
      'blockedUrls',
    ),
    concealBlockedBookmarks: memoryPurgeSettings.concealBlockedBookmarks,
    domainHmacSecret: typeof settingsSource.domainHmacSecret === 'string'
      ? settingsSource.domainHmacSecret
      : PROTECTION_SETTINGS_DEFAULTS.domainHmacSecret,
    filterSettings: clonePlainValue(resolvedFilterSettings, defaultFilterSettings, 'filterSettings'),
    artifactControlState: normalizeArtifactControlState(settingsSource.artifactControlState, {
      defaults: PROTECTION_SETTINGS_DEFAULTS.artifactControlState,
    }),
    filteringMode: settingsSource.filteringMode ?? PROTECTION_SETTINGS_DEFAULTS.filteringMode,
    gateConfig: normalizeGateConfig(settingsSource.gateConfig, {
      defaults: PROTECTION_SETTINGS_DEFAULTS.gateConfig,
    }),
    coolingCurve: normalizeCoolingCurve(settingsSource.coolingCurve),
    globalGoal: settingsSource.globalGoal ?? PROTECTION_SETTINGS_DEFAULTS.globalGoal,
    globalCapNotifyOnExceeded: settingsSource.globalCapNotifyOnExceeded ?? PROTECTION_SETTINGS_DEFAULTS.globalCapNotifyOnExceeded,
    relaxationSchedule: clonePlainValue(
      settingsSource.relaxationSchedule,
      PROTECTION_SETTINGS_DEFAULTS.relaxationSchedule,
      'relaxationSchedule',
    ),
    historyCleanupForBlocked: memoryPurgeSettings.historyCleanupForBlocked,
    nudgeConfig: clonePlainValue(
      settingsSource.nudgeConfig,
      PROTECTION_SETTINGS_DEFAULTS.nudgeConfig,
      'nudgeConfig',
    ),
    protectionPresetAssignments: clonePlainValue(
      settingsSource.protectionPresetAssignments,
      PROTECTION_SETTINGS_DEFAULTS.protectionPresetAssignments,
      'protectionPresetAssignments',
    ),
    protectionPresetCatalog: clonePlainValue(
      settingsSource.protectionPresetCatalog,
      PROTECTION_SETTINGS_DEFAULTS.protectionPresetCatalog,
      'protectionPresetCatalog',
    ),
    rulesMode: settingsSource.rulesMode ?? PROTECTION_SETTINGS_DEFAULTS.rulesMode,
    siteGoalHashes: clonePlainValue(
      settingsSource.siteGoalHashes,
      PROTECTION_SETTINGS_DEFAULTS.siteGoalHashes,
      'siteGoalHashes',
    ),
    siteGoalMeta: clonePlainValue(
      settingsSource.siteGoalMeta,
      PROTECTION_SETTINGS_DEFAULTS.siteGoalMeta,
      'siteGoalMeta',
    ),
    siteGoals: clonePlainValue(
      settingsSource.siteGoals,
      PROTECTION_SETTINGS_DEFAULTS.siteGoals,
      'siteGoals',
    ),
  };
}

function createStatsSnapshot({
  statsCache,
  hostname,
  now,
  rules,
} = {}) {
  const normalizedHostname = normalizeHost(hostname);
  if (!isPlainObject(statsCache) || !isPlainObject(statsCache.dates)) {
    throw new Error('PROTECTION_RUNTIME_INPUT_STATS_RANGE_INVALID');
  }
  const dates = statsCache.dates;
  const {
    currentDateStr: dateStr,
    completedDateStrs,
  } = getBasicRecentUsageDateWindow(now, statsCache);
  const selectedDateStrs = [...completedDateStrs, dateStr];

  return {
    basis: statsCache.basis,
    resetHour: statsCache.resetHour,
    dateStr,
    dates: selectedDateStrs.reduce((acc, entryDate) => {
      if (!Object.prototype.hasOwnProperty.call(dates, entryDate)) return acc;
      const dayStats = dates[entryDate];
      if (!isPlainObject(dayStats) || !isPlainObject(dayStats.domains)) {
        throw new Error(`PROTECTION_RUNTIME_INPUT_STATS_DAY_INVALID:${entryDate}`);
      }
      const hasDomainFact = Boolean(normalizedHostname)
        && Object.prototype.hasOwnProperty.call(dayStats.domains, normalizedHostname);
      const domainStats = hasDomainFact ? dayStats.domains[normalizedHostname] : null;
      const protectedActive = normalizedHostname
        ? readActivityDaySiteCharge(dayStats, normalizedHostname, rules) : 0;
      if (hasDomainFact
        && (!isPlainObject(domainStats)
          || typeof domainStats.active !== 'number'
          || !Number.isFinite(domainStats.active)
          || domainStats.active < 0)) {
        throw new Error(
          `PROTECTION_RUNTIME_INPUT_STATS_DOMAIN_ACTIVE_INVALID:${entryDate}:${normalizedHostname}`,
        );
      }
      acc[entryDate] = {
        domains: hasDomainFact || protectedActive > 0
          ? {
            [normalizedHostname]: {
              active: hasDomainFact ? domainStats.active : 0,
              protectedActive,
              ...(hasDomainFact && Object.hasOwn(domainStats,'reflection') ? { reflection:domainStats.reflection } : {}),
            },
          }
          : {},
        totals: {
          blockedActive: requireProtectionCharge(dayStats.totals?.blockedActive, `${entryDate}:global`),
        },
      };
      return acc;
    }, {}),
  };
}

export function createProtectionRuntimeInputProvider({
  settingsService = null,
  settingsCache = null,
  clseSignalQueryService = null,
  runtimeStateCoordinator,
  runtimeFlagRepository,
  getActivityDayUsageRange,
  getActiveSessionElapsedMs,
  getConsumptionFlowSnapshot,
  getConsumptionMemorySnapshot,
  readInterventionExposureSnapshot,
  listTabs,
  listGateInterventionSessions,
  readArtifactDisclosureSnapshot,
  defaultFilterSettings = CONFIG_DEFAULT_FILTER_SETTINGS,
  readFilterSettings = null,
} = {}) {
  requireRuntimeStateCoordinator(runtimeStateCoordinator);
  const readConsumptionFlow = requireRuntimeInputFunction(getConsumptionFlowSnapshot, 'PROTECTION_RUNTIME_INPUT_CONSUMPTION_OWNER_REQUIRED');
  const readConsumptionMemory = requireRuntimeInputFunction(getConsumptionMemorySnapshot, 'PROTECTION_RUNTIME_INPUT_MEMORY_OWNER_REQUIRED');
  const readExposure = requireRuntimeInputFunction(readInterventionExposureSnapshot, 'PROTECTION_RUNTIME_INPUT_EXPOSURE_OWNER_REQUIRED');
  const settingsSourceOwner = resolveSettingsSourceOwner({ settingsService, settingsCache });
  const readClseAggressionLogs = requireRuntimeInputOwnerMethod(
    clseSignalQueryService,
    'getAggressionLogs',
    'PROTECTION_RUNTIME_INPUT_CLSE_QUERY_OWNER_REQUIRED',
  );
  const readRuntimeFlags = requireRuntimeInputOwnerMethod(
    runtimeFlagRepository,
    'get',
    'PROTECTION_RUNTIME_INPUT_RUNTIME_FLAG_OWNER_REQUIRED',
  );
  const readActivityDayUsage = requireRuntimeInputFunction(
    getActivityDayUsageRange,
    'PROTECTION_RUNTIME_INPUT_ACTIVITY_DAY_USAGE_OWNER_REQUIRED',
  );
  const getActiveSessionElapsedMsOwner = requireRuntimeInputFunction(
    getActiveSessionElapsedMs,
    'PROTECTION_RUNTIME_INPUT_ACTIVE_SESSION_ELAPSED_OWNER_REQUIRED',
  );
  const listTabsOwner = requireRuntimeInputFunction(
    listTabs,
    'PROTECTION_RUNTIME_INPUT_TABS_QUERY_OWNER_REQUIRED',
  );
  const listGateInterventionSessionsOwner = requireRuntimeInputFunction(
    listGateInterventionSessions,
    'PROTECTION_RUNTIME_INPUT_GATE_SESSION_OWNER_REQUIRED',
  );
  const readArtifactDisclosureSnapshotOwner = requireRuntimeInputFunction(
    readArtifactDisclosureSnapshot,
    'PROTECTION_RUNTIME_INPUT_ARTIFACT_DISCLOSURE_OWNER_REQUIRED',
  );

  async function readSettingsSource() {
    if (settingsSourceOwner.settingsCache) {
      // A stable injected object is a view of the owner cache, not proof that a
      // persisted mutation or its computed private artifacts hydrated safely.
      if (settingsSourceOwner.ensureSettingsCache) await settingsSourceOwner.ensureSettingsCache();
      return settingsSourceOwner.settingsCache;
    }

    await settingsSourceOwner.ensureSettingsCache();
    const liveSettingsCache = settingsSourceOwner.getSettingsCache();
    if (isPlainObject(liveSettingsCache)) {
      return liveSettingsCache;
    }

    throw new Error('PROTECTION_RUNTIME_INPUT_SETTINGS_CACHE_REQUIRED');
  }

  async function readResolvedFilterSettings(source = {}, overrideFilterSettings) {
    if (isPlainObject(overrideFilterSettings)) {
      return overrideFilterSettings;
    }
    if (isPlainObject(source?.filterSettings)) {
      return source.filterSettings;
    }
    if (typeof readFilterSettings === 'function') {
      const filterSettingsSnapshot = await readFilterSettings();
      if (isPlainObject(filterSettingsSnapshot)) {
        return filterSettingsSnapshot;
      }
      throw new Error('PROTECTION_RUNTIME_INPUT_FILTER_SETTINGS_OWNER_INVALID');
    }
    throw new Error('PROTECTION_RUNTIME_INPUT_FILTER_SETTINGS_REQUIRED');
  }

  async function readRuleHashSnapshot(hostname, settingsSnapshot) {
    const normalizedHostname = normalizeHost(hostname);
    const secret = settingsSnapshot?.domainHmacSecret || '';
    const hashCandidates = secret
      ? await buildDomainHashCandidates(normalizedHostname, secret)
      : null;

    return {
      allowedByHash: await isDomainInHashList(
        normalizedHostname,
        settingsSnapshot?.allowedUrlHashes,
        secret,
        hashCandidates,
      ),
      blockedByHash: await isDomainInHashList(
        normalizedHostname,
        settingsSnapshot?.blockedUrlHashes,
        secret,
        hashCandidates,
      ),
      siteGoalFromHash: await getDomainValueFromHashMap(
        normalizedHostname,
        settingsSnapshot?.siteGoalHashes,
        secret,
        hashCandidates,
      ),
    };
  }

  async function readStatsSnapshot(hostname, now = Date.now(), rules) {
    const statsCache = await readActivityDayUsage({ now, daysBack: 8 });
    if (statsCache?.basis !== 'activity-day') throw new Error('PROTECTION_RUNTIME_INPUT_ACTIVITY_DAY_BASIS_REQUIRED');
    return createStatsSnapshot({
      statsCache,
      hostname,
      now,
      rules,
    });
  }

  function buildCapState(settingsSnapshot, statsSnapshot, now = Date.now()) {
    const dateStr = statsSnapshot?.dateStr || getLocalDateStr(now);
    const available = resolveSitesRecordingPolicy(settingsSnapshot).globalCapAvailable;
    const day = statsSnapshot.dates[dateStr];
    const blockedTodayMs = available && day !== undefined
      ? requireProtectionCharge(day.totals?.blockedActive, `${dateStr}:global`) : 0;

    return evaluateProtectionGlobalCapState({
      globalGoalMin: available ? settingsSnapshot.globalGoal : 0,
      blockedTodayMs,
      now,
      dateStr,
    });
  }

  async function readClseAggressionSnapshot(now = Date.now()) {
    const cachedSignalSnapshot = normalizeAggressionSignalCache(
      runtimeStateCoordinator.getAggressionSignalCache()
    );
    if (now - cachedSignalSnapshot.checkedAt < SIGNAL_CACHE_TTL_MS) {
      return cachedSignalSnapshot;
    }

    try {
      const logs = await readClseAggressionLogs({
        startTs: now - SIGNAL_WINDOW_MS,
        endTs: now,
        limit: SIGNAL_LIMIT,
      });

      if (!Array.isArray(logs)) {
        throw new Error('PROTECTION_RUNTIME_INPUT_CLSE_LOGS_INVALID');
      }

      const scores = logs
        .map((entry) => Math.max(
          Number.isFinite(Number(entry?.score)) ? Number(entry.score) : 0,
          Number.isFinite(Number(entry?.aggressive_score)) ? Number(entry.aggressive_score) : 0,
        ))
        .filter((value) => Number.isFinite(value) && value >= 0);

      return runtimeStateCoordinator.setAggressionSignalCache({
        checkedAt: now,
        scores,
      });
    } catch (error) {
      throw new Error('PROTECTION_RUNTIME_INPUT_CLSE_QUERY_FAILED', { cause: error });
    }
  }

  async function getGlobalCapState(now = Date.now()) {
    const settingsSource = await readSettingsSource();
    const resolvedFilterSettings = await readResolvedFilterSettings(settingsSource);
    const settingsSnapshot = snapshotProtectionSettings(settingsSource, {
      filterSettings: resolvedFilterSettings,
      defaultFilterSettings,
    });
    const statsSnapshot = await readStatsSnapshot('', now);
    return buildCapState(settingsSnapshot, statsSnapshot, now);
  }

  async function readGlobalSentinelOutcome() {
    try {
      const session = requireRuntimeFlagSessionResult(await readRuntimeFlags({
        [STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME]: null,
      }));
      return readNullableRuntimeFlagObject(
        session,
        STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME,
        'PROTECTION_RUNTIME_INPUT_GLOBAL_SENTINEL_OUTCOME_INVALID',
      );
    } catch (error) {
      throw new Error('PROTECTION_RUNTIME_INPUT_GLOBAL_SENTINEL_READ_FAILED', { cause: error });
    }
  }

  async function readSpecialSession(now = Date.now()) {
    try {
      const session = requireRuntimeFlagSessionResult(await readRuntimeFlags({
        [STORAGE_SESSION_KEYS.SPECIAL_SESSION]: null,
      }));
      return normalizeSpecialSessionState(
        readNullableRuntimeFlagObject(
          session,
          STORAGE_SESSION_KEYS.SPECIAL_SESSION,
          'PROTECTION_RUNTIME_INPUT_SPECIAL_SESSION_INVALID',
        ),
        { now },
      );
    } catch (error) {
      throw new Error('PROTECTION_RUNTIME_INPUT_SPECIAL_SESSION_READ_FAILED', { cause: error });
    }
  }

  async function readSkippedOccurrenceId() {
    const flags = requireRuntimeFlagSessionResult(await readRuntimeFlags({
      [STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP]: null,
    }));
    const id = flags[STORAGE_SESSION_KEYS.SCHEDULE_OCCURRENCE_SKIP];
    if (id !== null && typeof id !== 'string') throw new Error('PROTECTION_RUNTIME_INPUT_SCHEDULE_SKIP_INVALID');
    return id;
  }

  function readFeedFlowSnapshot(source = null, now = Date.now()) {
    if (source === null) return null;
    return runtimeStateCoordinator.getFeedFlowSnapshot({
      hostname: source?.hostname,
      tabId: source?.tabId,
      documentId: source?.documentId,
      now,
    });
  }

  async function readProtectedTabInventory({ now = Date.now(), settingsSnapshot, specialSession, skippedOccurrenceId, includeGateSessions = true } = {}) {
    if (typeof includeGateSessions !== 'boolean') throw new Error('PROTECTION_RUNTIME_INPUT_GATE_INVENTORY_MODE_INVALID');
    if (settingsSnapshot === undefined) {
      const source = await readSettingsSource();
      settingsSnapshot = snapshotProtectionSettings(source, {
        filterSettings: await readResolvedFilterSettings(source), defaultFilterSettings,
      });
    }
    if (specialSession === undefined) specialSession = await readSpecialSession(now);
    if (skippedOccurrenceId === undefined) skippedOccurrenceId = await readSkippedOccurrenceId();
    const tabs = await listTabsOwner({});
    if (!Array.isArray(tabs)) throw new Error('PROTECTION_RUNTIME_INPUT_TABS_QUERY_INVALID');
    const projected = includeGateSessions
      ? buildGateSessionProtectedTabCandidates(await listGateInterventionSessionsOwner({}), tabs) : [];
    const inventory = await buildProtectedTabSnapshot(
      [...tabs, ...projected], settingsSnapshot, now, specialSession, skippedOccurrenceId,
    );
    const config = normalizeGateConfig(settingsSnapshot.gateConfig, { defaults: DEFAULT_GATE_CONFIG });
    const barrierControl = describeArtifactControlStateForFamily(settingsSnapshot.artifactControlState, 'barrier');
    return { ...inventory, detourEnabled: config.detourSpreadGuard.enabled && !barrierControl.suppressed,
      protectedTabBudget: config.detourSpreadGuard.maxProtectedTabs };
  }

  /**
   * Feeds the return lock the protected sites that have a real tab open. Gate
   * pages are left out on purpose: a tab held at a Gate has not entered its
   * site, so turning away from the Gate is not leaving it.
   */
  async function observeGateSitePresence({ now = Date.now() } = {}) {
    const source = await readSettingsSource();
    const settingsSnapshot = snapshotProtectionSettings(source, {
      filterSettings: await readResolvedFilterSettings(source), defaultFilterSettings,
    });
    const config = normalizeGateConfig(settingsSnapshot.gateConfig, { defaults: DEFAULT_GATE_CONFIG });
    if (!config.returnGuard.enabled) {
      return runtimeStateCoordinator.observeGateSitePresence({ hostnames: [], observedAt: now, enabled: false });
    }
    const [specialSession, skippedOccurrenceId] = await Promise.all([readSpecialSession(now), readSkippedOccurrenceId()]);
    const tabs = await listTabsOwner({});
    if (!Array.isArray(tabs)) throw new Error('PROTECTION_RUNTIME_INPUT_TABS_QUERY_INVALID');
    const inventory = await buildProtectedTabSnapshot(tabs, settingsSnapshot, now, specialSession, skippedOccurrenceId);
    return runtimeStateCoordinator.observeGateSitePresence({
      hostnames: inventory.protectedTabs.map((tab) => tab.hostname),
      observedAt: now,
      enabled: true,
    });
  }

  async function readGateRuntimeSnapshot(
    hostname,
    settingsSnapshot,
    {
      now = Date.now(),
      specialSession = null,
      skippedOccurrenceId = null,
      gateEntryObserved = false,
      tabId = null,
      consumptionFlow,
    } = {},
  ) {
    const normalizedHostname = normalizeHost(hostname);
    if (!normalizedHostname) return null;

    const normalizedGateConfig = normalizeGateConfig(settingsSnapshot?.gateConfig, {
      defaults: DEFAULT_GATE_CONFIG,
    });
    if (!isGateConfigEnabled(normalizedGateConfig)) {
      return null;
    }

    const returnLock = normalizedGateConfig.returnGuard.enabled
      ? await runtimeStateCoordinator.getGateReturnLock({ hostname: normalizedHostname, now })
      : null;
    const baseSnapshot = {
      ...normalizeGateRuntimeSnapshot(runtimeStateCoordinator.getGateHostSnapshot({
        hostname: normalizedHostname,
        // Names the tab this runtime resolution is for, so a tab-scoped gate
        // kept-tab pass can resolve; ordinary approval has no host or tab scope.
        tabId,
        now,
      }), { allowNull: false }),
      entryApproved: (await runtimeStateCoordinator.getGateEntryApproval()).approved,
      returnLockActive: returnLock?.active === true,
      returnLockLeftAt: returnLock?.leftAt ?? 0,
      returnLockUntil: returnLock?.until ?? 0,
    };
    const contextSnapshot = normalizeGateProtectedContextSnapshot(
      projectGateConsumedContexts(consumptionFlow, now),
    );

    if (!normalizedGateConfig.detourSpreadGuard.enabled) {
      return normalizeGateRuntimeSnapshot({
        ...baseSnapshot,
        hostname: normalizedHostname,
        protectedTabCount: 0,
        protectedTabHostCount: 0,
        protectedTabs: [],
        detourSpreadNoticedCount: 0,
        detourSpreadReviewedCount: 0,
        detourEntryObserved: false,
        consumedProtectedContextCount: contextSnapshot.consumedProtectedContextCount,
        consumeDwellMs: contextSnapshot.consumeDwellMs,
        contextWindowMs: contextSnapshot.contextWindowMs,
      });
    }

    const protectedTabSnapshot = await readProtectedTabInventory({ now, settingsSnapshot, specialSession, skippedOccurrenceId });

    return normalizeGateRuntimeSnapshot({
      ...baseSnapshot,
      hostname: normalizedHostname,
      protectedTabCount: protectedTabSnapshot.protectedTabCount,
      protectedTabHostCount: protectedTabSnapshot.protectedTabHostCount,
      protectedTabs: protectedTabSnapshot.protectedTabs,
      // Reconciled against the live count on the way past, so a level the user
      // already settled stops covering a spread that has since shrunk.
      ...runtimeStateCoordinator.observeGateDetourSpreadLevel({
        protectedTabCount: protectedTabSnapshot.protectedTabCount,
        protectedTabIds: protectedTabSnapshot.protectedTabs.map((tab) => tab.tabId),
      }),
      detourEntryObserved: gateEntryObserved === true && baseSnapshot.isForeground,
      consumedProtectedContextCount: contextSnapshot.consumedProtectedContextCount,
      consumeDwellMs: contextSnapshot.consumeDwellMs,
      contextWindowMs: contextSnapshot.contextWindowMs,
    });
  }

  async function provideRuntimeInput(
    hostname,
    {
      now = Date.now(),
      filterSettings = null,
      capStateOverride = null,
      directTriggers = [],
      feedFlowSource = null,
      gateEntryObserved = false,
      tabId = null,
    } = {},
  ) {
    const normalizedHostname = normalizeHost(hostname);
    const resolvedDirectTriggers = normalizeDirectTriggers(directTriggers);
    const settingsSource = await readSettingsSource();
    const resolvedFilterSettings = await readResolvedFilterSettings(settingsSource, filterSettings);
    const settingsSnapshot = snapshotProtectionSettings(settingsSource, {
      filterSettings: resolvedFilterSettings,
      defaultFilterSettings,
    });
    const [specialSession, skippedOccurrenceId] = await Promise.all([readSpecialSession(now), readSkippedOccurrenceId()]);
    const [consumptionFlow, interventionExposure] = await Promise.all([
      readConsumptionFlow({ now }), readExposure({ now }),
    ]);
    const consumptionContext = {
      ...projectProtectedConsumptionContext(consumptionFlow, now),
      memory: requireConsumptionMemoryRead(readConsumptionMemory({ now })),
      intervention: projectConsumptionExposureContext(consumptionFlow.lastSegment, interventionExposure),
    };
    const [
      ruleHashSnapshot,
      statsSnapshot,
      clseAggressionSnapshot,
      feedFlowSnapshot,
      gateRuntimeSnapshot,
      globalSentinelOutcome,
      artifactDisclosureSnapshot,
    ] = await Promise.all([
      readRuleHashSnapshot(normalizedHostname, settingsSnapshot),
      readStatsSnapshot(normalizedHostname, now, { blockedTargets: settingsSnapshot.blockedUrls, allowedTargets: settingsSnapshot.allowedUrls }),
      readClseAggressionSnapshot(now),
      Promise.resolve(readFeedFlowSnapshot(feedFlowSource, now)),
      readGateRuntimeSnapshot(normalizedHostname, settingsSnapshot, {
        consumptionFlow,
        now,
        specialSession,
        skippedOccurrenceId,
        gateEntryObserved,
        tabId,
      }),
      readGlobalSentinelOutcome(now),
      readArtifactDisclosureSnapshotOwner(),
    ]);

    return {
      artifactDisclosureSnapshot,
      consumptionContext,
      capState: resolveCapStateOverride(
        capStateOverride,
        () => buildCapState(settingsSnapshot, statsSnapshot, now),
      ),
      clseAggressionSnapshot,
      directTriggers: resolvedDirectTriggers,
      feedFlowSnapshot,
      gateRuntimeSnapshot,
      globalSentinelOutcome,
      specialSession,
      skippedOccurrenceId,
      filterSettings: settingsSnapshot.filterSettings,
      hostname: normalizedHostname,
      now,
      ruleHashSnapshot,
      sessionDwellMs: resolveDomainUsageRecording(normalizedHostname, settingsSnapshot).enabled
        ? ensureNumber(getActiveSessionElapsedMsOwner(normalizedHostname, now)) : 0,
      settingsSnapshot,
      statsSnapshot,
    };
  }

  return {
    getGlobalCapState,
    readProtectedTabInventory,
    observeGateSitePresence,
    provideRuntimeInput,
  };
}
