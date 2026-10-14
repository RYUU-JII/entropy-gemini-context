import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { buildProtectionRuntimeSnapshotResponse } from '../../../protection/contracts/protectionRuntimeSnapshotBridge.js';
import {
  buildProtectionProtocolStateSnapshot,
  PROTOCOL_SCOPE_BUDGET_ROLES,
  PROTOCOL_TARGET_SOURCES,
} from '../../../protection/runtime/protocolStateSnapshot.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import { resolveDomainUsageRecording } from '../../../settings/config/dataCollectionPolicy.js';
import { readActivityDaySiteCharge, requireProtectionCharge } from '../../../stats/projection/projectProtectionBudget.js';
import {
  ensureNumber,
  getHostname,
} from '../../../../lib/index.js';
import { runAsyncHandler } from './runtimeHandlerUtils.js';
import {
  resolveSenderPageUrl,
  resolveTrustedSenderTabId,
} from '../../../../platform/security/senderTrust.js';
import {
  INTERVENTION_PHASES,
  isInterventionSurfaceId,
} from '../../../protection/contracts/interventionLedgerContract.js';

const RITUAL_SURFACE_LEDGER_PHASES = new Set([
  INTERVENTION_PHASES.SHOWN,
  INTERVENTION_PHASES.SUPPRESSED,
  INTERVENTION_PHASES.RESOLVED,
]);
const MAX_RITUAL_SURFACE_LEDGER_RECORDS = 64;

/**
 * Turns one reported surface episode into a ledger draft.
 *
 * The report comes from a content script, so nothing in it is trusted for
 * addressing: the tab is taken from the message sender, and a record naming an
 * unknown surface or an inapplicable phase is refused rather than stored. A
 * page cannot write arbitrary rows into the ledger this way.
 */
function buildRitualSurfaceLedgerDraft(record, tabId) {
  if (!isPlainObject(record)) return null;
  if (!isInterventionSurfaceId(record.surfaceId)) return null;
  if (!RITUAL_SURFACE_LEDGER_PHASES.has(record.phase)) return null;
  const at = Number(record.at);
  if (!Number.isInteger(at) || at < 0) return null;
  return {
    surfaceId: record.surfaceId,
    phase: record.phase,
    scope: {
      hostname: typeof record.hostname === 'string' ? record.hostname : '',
      tabId,
    },
    reason: typeof record.reason === 'string' ? record.reason : '',
    sessionId: typeof record.sessionId === 'string' ? record.sessionId : '',
    at,
  };
}

const PROTOCOL_TARGET_SOURCE_VALUES = new Set(Object.values(PROTOCOL_TARGET_SOURCES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function resolveProtectionRuntimeScope(request, tabTimeTracker) {
  const requestedHostname = normalizeDomain(request?.hostname || request?.domain || '');
  if (requestedHostname) {
    return { hostname: requestedHostname, tabId: null, error: null };
  }

  const activeInfo = tabTimeTracker.getActiveTabInfo();
  return {
    hostname: normalizeDomain(activeInfo?.hostname || ''),
    tabId: Number(activeInfo?.tabId),
    error: null,
  };
}

function buildProtectionRuntimeWarning(code, error) {
  return {
    code,
    error: error?.message || String(error || code),
  };
}

function attachProtectionRuntimeWarnings(response, warnings) {
  return warnings.length > 0
    ? { ...response, warnings }
    : response;
}

async function readProtectionRuntimeTelemetryContext({
  readTelemetryContext,
  hostname,
  now,
  warnings,
  code,
} = {}) {
  if (!hostname) return null;
  try {
    return await readTelemetryContext({ hostname, now });
  } catch (error) {
    warnings.push(buildProtectionRuntimeWarning(code, error));
    return null;
  }
}

function requireProtectionRuntimeFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireProtectionRuntimeSettingsService(settingsService) {
  if (!settingsService || typeof settingsService.ensureSettingsCache !== 'function') {
    throw new Error('FILTER_INDICATOR_SETTINGS_SERVICE_REQUIRED');
  }
  return settingsService;
}

function requireProtectionRuntimeSettingsCache(settingsCache) {
  if (!isPlainObject(settingsCache)) {
    throw new Error('FILTER_INDICATOR_SETTINGS_CACHE_REQUIRED');
  }
  return settingsCache;
}

function requireProtectionRuntimeTabTimeTracker(tabTimeTracker) {
  if (typeof tabTimeTracker?.getActiveTabInfo !== 'function') {
    throw new Error('PROTECTION_RUNTIME_SCOPE_OWNER_REQUIRED');
  }
  return tabTimeTracker;
}

function resolveFilterIndicatorStatsCache(statsCache) {
  if (!statsCache || typeof statsCache !== 'object' || statsCache.basis !== 'activity-day' || !statsCache.dates) {
    throw new Error('FILTER_INDICATOR_STATS_CACHE_INVALID');
  }
  return statsCache;
}

function resolveFilterIndicatorStatsDate(dateStr) {
  if (typeof dateStr !== 'string' || !dateStr) {
    throw new Error('FILTER_INDICATOR_STATS_DATE_UNAVAILABLE');
  }
  return dateStr;
}

function createFilterIndicatorSettingsFieldError(fieldName) {
  const error = new Error(`FILTER_INDICATOR_SETTINGS_FIELD_INVALID:${fieldName}`);
  error.code = 'FILTER_INDICATOR_SETTINGS_FIELD_INVALID';
  error.field = fieldName;
  return error;
}

function requireFilterIndicatorSettingsMinutes(settingsCache, fieldName) {
  const value = settingsCache[fieldName];
  if (!Number.isInteger(value) || value < 0) {
    throw createFilterIndicatorSettingsFieldError(fieldName);
  }
  return value;
}

function requireFilterIndicatorSettingsArray(settingsCache, fieldName) {
  const value = settingsCache[fieldName];
  if (!Array.isArray(value)) {
    throw createFilterIndicatorSettingsFieldError(fieldName);
  }
  return value;
}

function requireFilterIndicatorSettingsObject(settingsCache, fieldName) {
  const value = settingsCache[fieldName];
  if (!isPlainObject(value)) {
    throw createFilterIndicatorSettingsFieldError(fieldName);
  }
  return value;
}

function requireFilterIndicatorScheduleState(schedule) {
  if (!isPlainObject(schedule) || !Array.isArray(schedule.blocks)) {
    throw new Error('FILTER_INDICATOR_SCHEDULE_STATE_INVALID');
  }
  return schedule;
}

function requireFilterIndicatorScheduleRestriction(value) {
  if (typeof value !== 'boolean') {
    throw new Error('FILTER_INDICATOR_SCHEDULE_RESTRICTION_INVALID');
  }
  return value;
}

function requireFilterIndicatorProtocolState(protocolState) {
  if (!isPlainObject(protocolState) || !isPlainObject(protocolState.scopes)) {
    throw new Error('FILTER_INDICATOR_PROTOCOL_STATE_INVALID');
  }
  return protocolState;
}

function resolveFilterIndicatorHostname(request, sender) {
  let senderUrl;
  try {
    senderUrl = new URL(resolveSenderPageUrl(sender));
  } catch {
    throw new Error('FILTER_INDICATOR_SENDER_URL_REQUIRED');
  }
  if (!['http:', 'https:'].includes(senderUrl.protocol) || !senderUrl.hostname) {
    throw new Error('FILTER_INDICATOR_SENDER_URL_REQUIRED');
  }
  if (Object.prototype.hasOwnProperty.call(request || {}, 'url')) {
    let requestedUrl;
    try {
      requestedUrl = new URL(request.url);
    } catch {
      throw new Error('FILTER_INDICATOR_REQUEST_URL_INVALID');
    }
    if (!['http:', 'https:'].includes(requestedUrl.protocol)) {
      throw new Error('FILTER_INDICATOR_REQUEST_URL_INVALID');
    }
    if (requestedUrl.hostname !== senderUrl.hostname) {
      throw new Error('FILTER_INDICATOR_SENDER_HOST_MISMATCH');
    }
  }
  return getHostname(senderUrl.href);
}

function resolveFilterIndicatorProtocolScope(protocolState, hostname) {
  if (!hostname) return null;
  const scope = protocolState.scopes[hostname] ?? null;
  if (scope !== null && !isPlainObject(scope)) {
    throw new Error('FILTER_INDICATOR_PROTOCOL_SCOPE_INVALID');
  }
  return scope;
}

function resolveFilterIndicatorProtocolTarget(protocolScope, fieldName) {
  if (!protocolScope) return null;
  const target = protocolScope[fieldName];
  if (!isPlainObject(target)) {
    throw new Error(`FILTER_INDICATOR_PROTOCOL_TARGET_INVALID:${fieldName}`);
  }
  return target;
}

function resolveFilterIndicatorProtocolTargetMinutes(protocolTarget, fieldName) {
  if (!protocolTarget) return 0;
  const targetMinutes = protocolTarget.targetMinutes;
  if (!Number.isInteger(targetMinutes) || targetMinutes < 0) {
    throw new Error(`FILTER_INDICATOR_PROTOCOL_TARGET_INVALID:${fieldName}.targetMinutes`);
  }
  return targetMinutes;
}

function resolveFilterIndicatorReferenceTargetSource(referenceTarget) {
  if (!referenceTarget) return PROTOCOL_TARGET_SOURCES.NONE;
  const targetSource = referenceTarget.targetSource;
  if (!PROTOCOL_TARGET_SOURCE_VALUES.has(targetSource)) {
    throw new Error('FILTER_INDICATOR_PROTOCOL_TARGET_INVALID:referenceTarget.targetSource');
  }
  return targetSource;
}

export function createProtectionRuntimeActionHandlers({
  getGateInterstitialSession,
  closeGateInterstitialProtectedTab,
  getProtectionRuntimeSnapshot,
  getProtectionRuntimeTelemetryContext,
  refreshProtectionRuntimeSnapshot,
  settingsCache,
  settingsService,
  submitGateInterstitialDecision,
  tabTimeTracker,
  isRestrictedAt,
  getActivityDayUsageRange,
  interventionLedger,
} = {}) {
  const readRuntimeSnapshot = requireProtectionRuntimeFunction(
    getProtectionRuntimeSnapshot,
    'PROTECTION_RUNTIME_SNAPSHOT_OWNER_REQUIRED',
  );
  const readTelemetryContext = requireProtectionRuntimeFunction(
    getProtectionRuntimeTelemetryContext,
    'PROTECTION_RUNTIME_TELEMETRY_CONTEXT_OWNER_REQUIRED',
  );
  const refreshRuntimeSnapshot = requireProtectionRuntimeFunction(
    refreshProtectionRuntimeSnapshot,
    'PROTECTION_RUNTIME_REFRESH_OWNER_REQUIRED',
  );
  const recordInterventionLedgerEntries = requireProtectionRuntimeFunction(
    interventionLedger?.recordDetached,
    'PROTECTION_RUNTIME_INTERVENTION_LEDGER_OWNER_REQUIRED',
  ).bind(interventionLedger);
  const resolvedSettingsCache = requireProtectionRuntimeSettingsCache(settingsCache);
  const resolvedSettingsService = requireProtectionRuntimeSettingsService(settingsService);
  const resolvedTabTimeTracker = requireProtectionRuntimeTabTimeTracker(tabTimeTracker);
  const readActivityDayUsage = requireProtectionRuntimeFunction(
    getActivityDayUsageRange,
    'FILTER_INDICATOR_ACTIVITY_DAY_USAGE_OWNER_REQUIRED',
  );
  const resolveScheduleRestriction = requireProtectionRuntimeFunction(
    isRestrictedAt,
    'FILTER_INDICATOR_SCHEDULE_OWNER_REQUIRED',
  );
  const readGateInterstitialSession = requireProtectionRuntimeFunction(
    getGateInterstitialSession,
    'GATE_INTERSTITIAL_SESSION_OWNER_REQUIRED',
  );
  const closeGateInterstitialProtectedTabForSession = requireProtectionRuntimeFunction(
    closeGateInterstitialProtectedTab,
    'GATE_INTERSTITIAL_PROTECTED_TAB_CLOSE_OWNER_REQUIRED',
  );
  const submitGateInterstitialDecisionForSession = requireProtectionRuntimeFunction(
    submitGateInterstitialDecision,
    'GATE_INTERSTITIAL_DECISION_OWNER_REQUIRED',
  );

  return {
    [MESSAGE_ACTIONS.RECORD_RITUAL_SURFACE_LEDGER]: (request, sender, sendResponse) => {
      const senderTabId = resolveTrustedSenderTabId(sender);
      if (senderTabId === null) {
        sendResponse({ success: false, error: 'UNTRUSTED_SENDER' });
        return false;
      }
      const reported = Array.isArray(request?.records) ? request.records : [];
      const drafts = reported
        .slice(0, MAX_RITUAL_SURFACE_LEDGER_RECORDS)
        .map((record) => buildRitualSurfaceLedgerDraft(record, senderTabId))
        .filter(Boolean);
      if (drafts.length) {
        recordInterventionLedgerEntries(drafts);
      }
      sendResponse({
        success: true,
        recorded: drafts.length,
        rejected: reported.length - drafts.length,
      });
      return false;
    },

    [MESSAGE_ACTIONS.GET_PROTECTION_RUNTIME_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const { hostname, tabId } = resolveProtectionRuntimeScope(request, resolvedTabTimeTracker);
        const now = Date.now();
        const warnings = [];
        const runtime = hostname
          ? await readRuntimeSnapshot({ hostname })
          : null;
        const telemetryContext = await readProtectionRuntimeTelemetryContext({
          readTelemetryContext,
          hostname,
          now,
          warnings,
          code: 'PROTECTION_RUNTIME_TELEMETRY_CONTEXT_READ_FAILED',
        });
        return attachProtectionRuntimeWarnings(buildProtectionRuntimeSnapshotResponse({
          hostname,
          tabId,
          runtime,
          telemetryContext,
        }), warnings);
      },
      (error) => ({ success: false, error: error?.message || 'GET_PROTECTION_RUNTIME_SNAPSHOT_FAILED', snapshot: null }),
    ),

    [MESSAGE_ACTIONS.REFRESH_PROTECTION_RUNTIME_SNAPSHOT]: (request, _sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const { hostname, tabId } = resolveProtectionRuntimeScope(request, resolvedTabTimeTracker);
        const now = Date.now();
        const warnings = [];
        const runtime = hostname
          ? await refreshRuntimeSnapshot({ hostname, now })
          : null;
        const telemetryContext = await readProtectionRuntimeTelemetryContext({
          readTelemetryContext,
          hostname,
          now,
          warnings,
          code: 'PROTECTION_RUNTIME_TELEMETRY_CONTEXT_READ_FAILED',
        });
        return attachProtectionRuntimeWarnings(buildProtectionRuntimeSnapshotResponse({
          hostname,
          tabId,
          runtime,
          telemetryContext,
        }), warnings);
      },
      (error) => ({ success: false, error: error?.message || 'REFRESH_PROTECTION_RUNTIME_SNAPSHOT_FAILED', snapshot: null }),
    ),

    [MESSAGE_ACTIONS.GET_FILTER_INDICATOR_INFO]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        const hostname = resolveFilterIndicatorHostname(request, sender);
        await resolvedSettingsService.ensureSettingsCache();
        const now = Date.now();
        const statsCache = resolveFilterIndicatorStatsCache(await readActivityDayUsage({ now, daysBack: 1 }));
        const dateStr = resolveFilterIndicatorStatsDate(statsCache.dateStr);
        const day = statsCache.dates[dateStr];
        const dailyMs = resolveDomainUsageRecording(hostname, resolvedSettingsCache).enabled
          ? readActivityDaySiteCharge(day, hostname, {
            blockedTargets: resolvedSettingsCache.blockedUrls, allowedTargets: resolvedSettingsCache.allowedUrls,
          }) : 0;
        const globalGoalMinutes = requireFilterIndicatorSettingsMinutes(
          resolvedSettingsCache,
          'globalGoal',
        );
        const blockedDomains = requireFilterIndicatorSettingsArray(
          resolvedSettingsCache,
          'blockedUrls',
        );
        const siteGoals = requireFilterIndicatorSettingsObject(
          resolvedSettingsCache,
          'siteGoals',
        );
        const protocolState = requireFilterIndicatorProtocolState(buildProtectionProtocolStateSnapshot({
          recordingPolicy: resolvedSettingsCache,
          globalGoal: globalGoalMinutes,
          blockedDomains,
          siteGoals,
          stats: {
            basis: 'activity-day',
            dateStr,
            dates: {
              [dateStr]: {
                domains: hostname
                  ? {
                    [hostname]: {
                      protectedActive: dailyMs,
                    },
                  }
                  : {},
                totals: {
                  blockedActive: day === undefined ? 0 : requireProtectionCharge(day.totals?.blockedActive, `${dateStr}:global`),
                },
              },
            },
          },
          scopeBudgetRole: PROTOCOL_SCOPE_BUDGET_ROLES.REFERENCE,
          nowTs: now,
        }));
        const protocolScope = resolveFilterIndicatorProtocolScope(protocolState, hostname);
        const referenceTarget = resolveFilterIndicatorProtocolTarget(protocolScope, 'referenceTarget');
        const activeTarget = resolveFilterIndicatorProtocolTarget(protocolScope, 'activeTarget');
        const referenceTargetSource = resolveFilterIndicatorReferenceTargetSource(referenceTarget);
        const protocolTargetMinutes = resolveFilterIndicatorProtocolTargetMinutes(
          activeTarget,
          'activeTarget',
        );
        const referenceTargetMinutes = resolveFilterIndicatorProtocolTargetMinutes(
          referenceTarget,
          'referenceTarget',
        );
        const schedule = requireFilterIndicatorScheduleState(resolvedSettingsCache.relaxationSchedule);
        const inScheduleBlock = requireFilterIndicatorScheduleRestriction(
          resolveScheduleRestriction(await readRuntimeSnapshot({ hostname })),
        );

        return {
          success: true,
          hostname,
          dailyMs,
          statsDateStr: dateStr,
          protocolTargetMinutes,
          referenceTargetMinutes,
          referenceTargetSource,
          scheduleActive: schedule.blocks.length > 0,
          inScheduleBlock,
          globalGoalMinutes,
        };
      },
      (error) => ({ success: false, error: error?.message || 'GET_FILTER_INDICATOR_INFO_FAILED' }),
    ),

    [MESSAGE_ACTIONS.GET_GATE_INTERSTITIAL_SESSION]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        return readGateInterstitialSession({
          sender,
          sessionId: request?.sessionId,
        });
      },
      (error) => ({ success: false, error: error?.message || 'GET_GATE_INTERSTITIAL_SESSION_FAILED', session: null }),
    ),

    [MESSAGE_ACTIONS.CLOSE_GATE_INTERSTITIAL_PROTECTED_TAB]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        return closeGateInterstitialProtectedTabForSession({
          sender,
          sessionId: request?.sessionId,
          tabId: request?.tabId,
          now: Date.now(),
        });
      },
      (error) => ({
        success: false,
        error: error?.message || 'CLOSE_GATE_INTERSTITIAL_PROTECTED_TAB_FAILED',
        session: null,
      }),
    ),

    [MESSAGE_ACTIONS.SUBMIT_GATE_INTERSTITIAL_DECISION]: (request, sender, sendResponse) => runAsyncHandler(
      sendResponse,
      async () => {
        return submitGateInterstitialDecisionForSession({
          sender,
          sessionId: request?.sessionId,
          decision: request?.decision,
          tabIdsToClose: request?.tabIdsToClose,
          now: Date.now(),
        });
      },
      (error) => ({ success: false, error: error?.message || 'SUBMIT_GATE_INTERSTITIAL_DECISION_FAILED' }),
    ),
  };
}
