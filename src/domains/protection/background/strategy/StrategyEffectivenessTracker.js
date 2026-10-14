import {
  STRATEGY_LIFECYCLE_PHASES,
  STRATEGY_RECOVERY_ACTIONS,
  STRATEGY_STATES,
} from '../../strategy/contracts/strategyContracts.js';

const STRATEGY_STATE_SET = new Set(STRATEGY_STATES);
const STRATEGY_RECOVERY_ACTION_SET = new Set(STRATEGY_RECOVERY_ACTIONS);
const STRATEGY_LIFECYCLE_PHASE_SET = new Set(STRATEGY_LIFECYCLE_PHASES);
const RECOVERY_OUTCOME_SET = new Set(['stay', 'leave', 'aborted']);

function normalizeHost(host) {
  return typeof host === 'string' ? host.trim().toLowerCase() : '';
}

function normalizeExplicitEnum(value, {
  allowed,
  fallback,
  errorCode,
  lowercase = false,
}) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') {
    throw new Error(`${errorCode}:${typeof value}`);
  }
  const normalized = lowercase ? value.trim().toLowerCase() : value.trim();
  if (!normalized) return fallback;
  if (!allowed.has(normalized)) {
    throw new Error(`${errorCode}:${normalized}`);
  }
  return normalized;
}

function normalizeStrategySnapshot(strategy = null, observation = null) {
  const source = strategy && typeof strategy === 'object' ? strategy : {};
  const metrics = source.metrics && typeof source.metrics === 'object' ? source.metrics : {};
  const budgetRatio = Number(observation?.budgetRatio);

  return {
    state: normalizeExplicitEnum(source.state, {
      allowed: STRATEGY_STATE_SET,
      fallback: 'observe',
      errorCode: 'strategy_effectiveness_state_invalid',
    }),
    recoveryAction: normalizeExplicitEnum(source.recoveryAction, {
      allowed: STRATEGY_RECOVERY_ACTION_SET,
      fallback: 'none',
      errorCode: 'strategy_effectiveness_recovery_action_invalid',
    }),
    lifecyclePhase: normalizeExplicitEnum(source.lifecyclePhase, {
      allowed: STRATEGY_LIFECYCLE_PHASE_SET,
      fallback: 'stabilize',
      errorCode: 'strategy_effectiveness_lifecycle_phase_invalid',
    }),
    budgetRatio: Number.isFinite(budgetRatio) ? Math.max(0, budgetRatio) : 0,
    declaredTargetMinutes: Math.max(0, Math.floor(Number(source.declaredTargetMinutes) || 0)),
    recommendedTargetMinutes: Math.max(0, Math.floor(Number(source.recommendedTargetMinutes) || 0)),
    effectiveTargetMinutes: Math.max(0, Math.floor(Number(source.effectiveTargetMinutes) || 0)),
    exceededDaysInWindow: Math.max(
      0,
      Math.floor(Number(metrics.exceededDaysInWindow ?? source.exceededDaysInWindow) || 0),
    ),
  };
}

function buildSummary(recentOutcomes = []) {
  const summary = {
    totalOutcomes: recentOutcomes.length,
    stayCount: 0,
    leaveCount: 0,
    abortCount: 0,
    lastOutcome: null,
    lastOutcomeAt: 0,
  };

  recentOutcomes.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    if (entry.outcome === 'stay') summary.stayCount += 1;
    if (entry.outcome === 'leave') summary.leaveCount += 1;
    if (entry.outcome === 'aborted') summary.abortCount += 1;
    if (!summary.lastOutcomeAt || Number(entry.at) >= summary.lastOutcomeAt) {
      summary.lastOutcome = typeof entry.outcome === 'string' ? entry.outcome : null;
      summary.lastOutcomeAt = Number(entry.at) || 0;
    }
  });

  const resolvedTotal = summary.stayCount + summary.leaveCount;
  return {
    ...summary,
    resolvedCount: resolvedTotal,
    leaveRate: resolvedTotal > 0 ? Number((summary.leaveCount / resolvedTotal).toFixed(3)) : 0,
  };
}

export function createStrategyEffectivenessTracker() {
  const currentByHost = new Map();
  const pendingByRunId = new Map();
  const pendingByHost = new Map();
  const outcomesByHost = new Map();
  const outcomesByRunId = new Map();

  function noteStrategySnapshot({ host = '', strategy = null, observation = null, now = Date.now() } = {}) {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) return null;

    const snapshot = {
      ...normalizeStrategySnapshot(strategy, observation),
      updatedAt: Number(now) || Date.now(),
    };
    currentByHost.set(normalizedHost, snapshot);
    return snapshot;
  }

  function resolveCurrent(host = '') {
    return currentByHost.get(normalizeHost(host)) || null;
  }

  function markRecoveryPresented({ host = '', key = '', runId = '', strategy = null, observation = null, now = Date.now() } = {}) {
    const normalizedHost = normalizeHost(host);
    const normalizedRunId = typeof runId === 'string' ? runId.trim() : '';
    if (!normalizedHost || !normalizedRunId) return null;
    const existing = pendingByRunId.get(normalizedRunId);
    if (existing) return existing;
    if (outcomesByRunId.has(normalizedRunId)) return null;

    const current = resolveCurrent(normalizedHost);
    const pending = {
      host: normalizedHost,
      key: typeof key === 'string' ? key.trim() : '',
      runId: normalizedRunId,
      presentedAt: Number(now) || Date.now(),
      ...(current || normalizeStrategySnapshot(strategy, observation)),
    };

    pendingByRunId.set(pending.runId, pending);
    pendingByHost.set(normalizedHost, pending);
    return pending;
  }

  function markRecoveryOutcome({ host = '', key = '', runId = '', outcome = 'aborted', reason = '', durationMs = 0, now = Date.now() } = {}) {
    const normalizedHost = normalizeHost(host);
    const normalizedRunId = typeof runId === 'string' ? runId.trim() : '';
    const normalizedOutcome = normalizeExplicitEnum(outcome, {
      allowed: RECOVERY_OUTCOME_SET,
      fallback: 'aborted',
      errorCode: 'strategy_effectiveness_outcome_invalid',
      lowercase: true,
    });
    const existingOutcome = normalizedRunId ? outcomesByRunId.get(normalizedRunId) : null;
    if (existingOutcome) {
      const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
      const normalizedDurationMs = Math.max(0, Math.floor(Number(durationMs) || 0));
      if (
        existingOutcome.host !== normalizedHost
        || existingOutcome.outcome !== normalizedOutcome
        || existingOutcome.reason !== normalizedReason
        || existingOutcome.durationMs !== normalizedDurationMs
      ) {
        throw new Error(`strategy_effectiveness_recovery_run_conflict:${normalizedRunId}`);
      }
      return existingOutcome;
    }
    const pending = (normalizedRunId ? pendingByRunId.get(normalizedRunId) : null)
      || pendingByHost.get(normalizedHost)
      || resolveCurrent(normalizedHost);
    const resolvedHost = normalizeHost(pending?.host || normalizedHost);
    if (!resolvedHost) return null;

    const entry = {
      host: resolvedHost,
      key: typeof key === 'string' && key.trim() ? key.trim() : (pending?.key || ''),
      runId: normalizedRunId || pending?.runId || '',
      at: Number(now) || Date.now(),
      outcome: normalizedOutcome,
      reason: typeof reason === 'string' ? reason.trim() : '',
      durationMs: Math.max(0, Math.floor(Number(durationMs) || 0)),
      state: pending?.state || 'observe',
      recoveryAction: pending?.recoveryAction || 'none',
      lifecyclePhase: pending?.lifecyclePhase || 'stabilize',
      budgetRatio: Number.isFinite(Number(pending?.budgetRatio)) ? Math.max(0, Number(pending.budgetRatio)) : 0,
      declaredTargetMinutes: Math.max(0, Math.floor(Number(pending?.declaredTargetMinutes) || 0)),
      recommendedTargetMinutes: Math.max(0, Math.floor(Number(pending?.recommendedTargetMinutes) || 0)),
      effectiveTargetMinutes: Math.max(0, Math.floor(Number(pending?.effectiveTargetMinutes) || 0)),
      exceededDaysInWindow: Math.max(0, Math.floor(Number(pending?.exceededDaysInWindow) || 0)),
    };

    const bucket = outcomesByHost.get(resolvedHost) || [];
    bucket.push(entry);
    const retainedBucket = bucket.slice(-50);
    outcomesByHost.set(resolvedHost, retainedBucket);
    for (const evicted of bucket.slice(0, Math.max(0, bucket.length - retainedBucket.length))) {
      if (evicted?.runId && outcomesByRunId.get(evicted.runId) === evicted) {
        outcomesByRunId.delete(evicted.runId);
      }
    }
    if (entry.runId) outcomesByRunId.set(entry.runId, entry);

    if (entry.runId) {
      pendingByRunId.delete(entry.runId);
    }
    const hostPending = pendingByHost.get(resolvedHost);
    if (hostPending && (!entry.runId || hostPending.runId === entry.runId)) {
      pendingByHost.delete(resolvedHost);
    }

    return entry;
  }

  function getRuntimeSummary(host = '') {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
      return {
        current: null,
        pending: null,
        summary: buildSummary([]),
        recentOutcomes: [],
      };
    }

    const recentOutcomes = (outcomesByHost.get(normalizedHost) || []).slice(-5).reverse();
    return {
      current: resolveCurrent(normalizedHost),
      pending: pendingByHost.get(normalizedHost) || null,
      summary: buildSummary(outcomesByHost.get(normalizedHost) || []),
      recentOutcomes,
    };
  }

  function clear(host = '') {
    const normalizedHost = normalizeHost(host);
    if (!normalizedHost) {
      currentByHost.clear();
      pendingByRunId.clear();
      pendingByHost.clear();
      outcomesByHost.clear();
      outcomesByRunId.clear();
      return;
    }

    const pending = pendingByHost.get(normalizedHost);
    if (pending?.runId) {
      pendingByRunId.delete(pending.runId);
    }
    currentByHost.delete(normalizedHost);
    pendingByHost.delete(normalizedHost);
    outcomesByHost.delete(normalizedHost);
    for (const [runId, entry] of outcomesByRunId.entries()) {
      if (entry.host === normalizedHost) outcomesByRunId.delete(runId);
    }
  }

  return {
    noteStrategySnapshot,
    markRecoveryPresented,
    markRecoveryOutcome,
    getRuntimeSummary,
    clear,
  };
}
