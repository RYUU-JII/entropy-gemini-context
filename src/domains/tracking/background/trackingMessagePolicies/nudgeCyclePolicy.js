import { normalizeDomain } from '../../../../lib/domain.js';
import { getLocalDateStr } from '../../../../lib/index.js';
import { STORAGE_SESSION_KEYS } from '../../../../platform/storage/runtime/RuntimeFlagRepository.js';
import { normalizeSentinelStayDecisions } from '../../../settings/config/sentinelStayDecisions.js';
import {
  createGlobalSentinelOutcomeState,
  isGlobalSentinelOutcomeReason,
} from '../../../nudge/runtime/sentinelOutcomeContract.js';

function parseNudgeDayKey(key) {
  if (typeof key !== 'string') return { dateStr: '', hostname: '' };
  const separatorAt = key.indexOf('|');
  if (separatorAt <= 0 || separatorAt >= key.length - 1) {
    return { dateStr: '', hostname: '' };
  }
  const dateCandidate = key.slice(0, separatorAt).trim();
  const hostnameCandidate = normalizeDomain(key.slice(separatorAt + 1));
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(dateCandidate) ? dateCandidate : '';
  return {
    dateStr,
    hostname: hostnameCandidate || '',
  };
}

function normalizeNudgeRunId(runId) {
  if (typeof runId !== 'string') return '';
  return runId.trim();
}

function isNudgeStayReason(reason) {
  const normalized = typeof reason === 'string' ? reason.trim().toLowerCase() : '';
  return normalized === 'stay' || normalized === 'drift';
}

export function createNudgeCyclePolicy({
  settingsService,
  schedulePostCommitSettingsEffects,
  runtimeFlagRepository = null,
} = {}) {
  if (typeof schedulePostCommitSettingsEffects !== 'function') {
    throw new Error('GLOBAL_SENTINEL_OUTCOME_PROPAGATION_OWNER_REQUIRED');
  }
  const persistNudgeStayDecision = async (request, nowTs = Date.now()) => {
    const parsed = parseNudgeDayKey(request?.key);
    const requestHostname = normalizeDomain(request?.hostname || request?.domain || '');
    const hostname = requestHostname || parsed.hostname;
    if (!hostname) return false;

    const dateStr = parsed.dateStr || getLocalDateStr(nowTs);
    await settingsService.commitSettingsMutation({
      actionReason: 'nudge_stay_decision',
      prepare: (canonicalSettingsCache) => {
        const current = normalizeSentinelStayDecisions(
          canonicalSettingsCache.sentinelStayDecisions,
        );
        const existing = current[hostname];
        if (existing && existing.decidedAt >= nowTs) {
          return { sentinelStayDecisions: current };
        }
        return {
          sentinelStayDecisions: normalizeSentinelStayDecisions({
            ...current,
            [hostname]: {
              dateStr,
              decidedAt: nowTs,
            },
          }),
        };
      },
      emitSettingsUpdated: false,
      invalidateFilterCache: false,
      refreshForBroadcast: false,
      reportBroadcastAsRefresh: false,
    });
    return true;
  };

  const persistGlobalSentinelOutcomeDecision = async (request, {
    runId = null,
    tabId = null,
    now = Date.now(),
  } = {}) => {
    const reason = request?.reason || '';
    if (!isGlobalSentinelOutcomeReason(reason)) return false;
    if (!runtimeFlagRepository || typeof runtimeFlagRepository.set !== 'function') return false;

    const parsed = parseNudgeDayKey(request?.key);
    const dateStr = parsed.dateStr || getLocalDateStr(now);
    const outcome = createGlobalSentinelOutcomeState({
      reason,
      now,
      dateStr,
      runId,
      tabId,
    });
    if (!outcome) return false;

    await runtimeFlagRepository.set({
      [STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME]: outcome,
    });
    const propagation = await schedulePostCommitSettingsEffects({
      actionReason: 'global_sentinel_outcome',
      commitVersion: null,
      changedKeys: [STORAGE_SESSION_KEYS.GLOBAL_SENTINEL_OUTCOME],
      shouldRefresh: false,
      shouldAutoPurge: false,
      shouldSyncBlockedBookmarks: false,
      shouldRunRuntimeAdapters: false,
      shouldSyncScripts: false,
      shouldBroadcast: true,
    }, {
      waitForCompletion: false,
    });
    if (propagation?.status !== 'scheduled' || !Number.isInteger(propagation.taskId)) {
      const error = new Error('GLOBAL_SENTINEL_OUTCOME_PROPAGATION_RECEIPT_INVALID');
      error.code = 'GLOBAL_SENTINEL_OUTCOME_PROPAGATION_RECEIPT_INVALID';
      error.propagation = propagation;
      throw error;
    }
    return true;
  };

  return {
    isNudgeStayReason,
    normalizeNudgeRunId,
    persistGlobalSentinelOutcomeDecision,
    persistNudgeStayDecision,
  };
}
