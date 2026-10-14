import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
  normalizeObservation,
} from './protectionContracts.js';
import { normalizeCompiledRuntimeInterventionPlan } from './compiledRuntimeFilterPlanContract.js';
import {
  normalizeStrategyDecision,
  STRATEGY_LIFECYCLE_PHASES,
  STRATEGY_RECOVERY_ACTIONS,
  STRATEGY_STATES,
} from '../strategy/contracts/strategyContracts.js';
import { buildCanonicalProtectionArtifactTelemetry } from '../runtime/canonicalArtifactTelemetry.js';
import { normalizeOptionalGoalEndSummary } from './goalEndSummaryContract.js';
import { normalizeOptionalCoolingCurveRuntimeState } from './coolingCurveRuntimeContract.js';

const RECOVERY_STATES = Object.freeze(['armed', 'presented', 'cooldown', 'idle']);
const RECOVERY_OUTCOMES = Object.freeze(['stay', 'leave', 'aborted']);

const STRATEGY_STATE_SET = new Set(STRATEGY_STATES);
const STRATEGY_RECOVERY_ACTION_SET = new Set(STRATEGY_RECOVERY_ACTIONS);
const STRATEGY_LIFECYCLE_PHASE_SET = new Set(STRATEGY_LIFECYCLE_PHASES);
const RECOVERY_STATE_SET = new Set(RECOVERY_STATES);
const RECOVERY_OUTCOME_SET = new Set(RECOVERY_OUTCOMES);

function normalizeHost(hostname) {
  return typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
}

function normalizeExplicitEnum(value, {
  allowed,
  fallback,
  errorCode,
  nullable = false,
  lowercase = false,
}) {
  if (value === null || value === undefined || value === '') {
    return nullable ? null : fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`${errorCode}:${typeof value}`);
  }
  const normalized = lowercase ? value.trim().toLowerCase() : value.trim();
  if (!normalized) return nullable ? null : fallback;
  if (!allowed.has(normalized)) {
    throw new Error(`${errorCode}:${normalized}`);
  }
  return normalized;
}

function normalizeTabId(tabId) {
  if (tabId === null || tabId === undefined || tabId === '') {
    return null;
  }
  const value = Number(tabId);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function requireSnapshotCapturedAt(value) {
  if (value === null || value === undefined || value === '') {
    throw new Error('protection_snapshot_captured_at_invalid');
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error('protection_snapshot_captured_at_invalid');
  }
  return Math.floor(numeric);
}

function normalizeRecovery(rawRecovery = null) {
  if (!rawRecovery || typeof rawRecovery !== 'object' || Array.isArray(rawRecovery)) {
    return null;
  }

  return {
    host: normalizeHost(rawRecovery.host || ''),
    action: normalizeExplicitEnum(rawRecovery.action, {
      allowed: STRATEGY_RECOVERY_ACTION_SET,
      fallback: 'none',
      errorCode: 'protection_snapshot_recovery_action_invalid',
    }),
    state: normalizeExplicitEnum(rawRecovery.state, {
      allowed: RECOVERY_STATE_SET,
      fallback: 'idle',
      errorCode: 'protection_snapshot_recovery_state_invalid',
      lowercase: true,
    }),
    suggested: rawRecovery.suggested === true,
    strategyState: normalizeExplicitEnum(rawRecovery.strategyState, {
      allowed: STRATEGY_STATE_SET,
      fallback: 'observe',
      errorCode: 'protection_snapshot_recovery_strategy_state_invalid',
    }),
    lifecyclePhase: normalizeExplicitEnum(rawRecovery.lifecyclePhase, {
      allowed: STRATEGY_LIFECYCLE_PHASE_SET,
      fallback: 'stabilize',
      errorCode: 'protection_snapshot_recovery_lifecycle_phase_invalid',
    }),
    lastOutcome: normalizeExplicitEnum(rawRecovery.lastOutcome, {
      allowed: RECOVERY_OUTCOME_SET,
      fallback: null,
      errorCode: 'protection_snapshot_recovery_last_outcome_invalid',
      nullable: true,
      lowercase: true,
    }),
    lastOutcomeAt: Number(rawRecovery.lastOutcomeAt) || 0,
  };
}

function normalizeEffectivenessStateEntry(entry = null, { pending = false } = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return {
    host: normalizeHost(entry.host || ''),
    key: typeof entry.key === 'string' ? entry.key.trim() : '',
    runId: typeof entry.runId === 'string' ? entry.runId.trim() : '',
    state: normalizeExplicitEnum(entry.state, {
      allowed: STRATEGY_STATE_SET,
      fallback: 'observe',
      errorCode: 'protection_snapshot_effectiveness_state_invalid',
    }),
    recoveryAction: normalizeExplicitEnum(entry.recoveryAction, {
      allowed: STRATEGY_RECOVERY_ACTION_SET,
      fallback: 'none',
      errorCode: 'protection_snapshot_effectiveness_recovery_action_invalid',
    }),
    lifecyclePhase: normalizeExplicitEnum(entry.lifecyclePhase, {
      allowed: STRATEGY_LIFECYCLE_PHASE_SET,
      fallback: 'stabilize',
      errorCode: 'protection_snapshot_effectiveness_lifecycle_phase_invalid',
    }),
    budgetRatio: Math.max(0, Number(entry.budgetRatio) || 0),
    declaredTargetMinutes: Math.max(0, Math.floor(Number(entry.declaredTargetMinutes) || 0)),
    recommendedTargetMinutes: Math.max(0, Math.floor(Number(entry.recommendedTargetMinutes) || 0)),
    effectiveTargetMinutes: Math.max(0, Math.floor(Number(entry.effectiveTargetMinutes) || 0)),
    exceededDaysInWindow: Math.max(0, Math.floor(Number(entry.exceededDaysInWindow) || 0)),
    updatedAt: pending ? 0 : (Number(entry.updatedAt) || 0),
    presentedAt: pending ? (Number(entry.presentedAt) || 0) : 0,
  };
}

function normalizeEffectivenessOutcomeEntry(entry = null) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return {
    host: normalizeHost(entry.host || ''),
    key: typeof entry.key === 'string' ? entry.key.trim() : '',
    runId: typeof entry.runId === 'string' ? entry.runId.trim() : '',
    at: Number(entry.at) || 0,
    outcome: normalizeExplicitEnum(entry.outcome, {
      allowed: RECOVERY_OUTCOME_SET,
      fallback: 'aborted',
      errorCode: 'protection_snapshot_effectiveness_outcome_invalid',
      lowercase: true,
    }),
    reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
    durationMs: Math.max(0, Math.floor(Number(entry.durationMs) || 0)),
    state: normalizeExplicitEnum(entry.state, {
      allowed: STRATEGY_STATE_SET,
      fallback: 'observe',
      errorCode: 'protection_snapshot_effectiveness_state_invalid',
    }),
    recoveryAction: normalizeExplicitEnum(entry.recoveryAction, {
      allowed: STRATEGY_RECOVERY_ACTION_SET,
      fallback: 'none',
      errorCode: 'protection_snapshot_effectiveness_recovery_action_invalid',
    }),
    lifecyclePhase: normalizeExplicitEnum(entry.lifecyclePhase, {
      allowed: STRATEGY_LIFECYCLE_PHASE_SET,
      fallback: 'stabilize',
      errorCode: 'protection_snapshot_effectiveness_lifecycle_phase_invalid',
    }),
    budgetRatio: Math.max(0, Number(entry.budgetRatio) || 0),
    declaredTargetMinutes: Math.max(0, Math.floor(Number(entry.declaredTargetMinutes) || 0)),
    recommendedTargetMinutes: Math.max(0, Math.floor(Number(entry.recommendedTargetMinutes) || 0)),
    effectiveTargetMinutes: Math.max(0, Math.floor(Number(entry.effectiveTargetMinutes) || 0)),
    exceededDaysInWindow: Math.max(0, Math.floor(Number(entry.exceededDaysInWindow) || 0)),
  };
}

function normalizeEffectiveness(rawEffectiveness = null) {
  if (!rawEffectiveness || typeof rawEffectiveness !== 'object' || Array.isArray(rawEffectiveness)) {
    return {
      current: null,
      pending: null,
      summary: {
        totalOutcomes: 0,
        resolvedCount: 0,
        stayCount: 0,
        leaveCount: 0,
        abortCount: 0,
        leaveRate: 0,
        lastOutcome: null,
        lastOutcomeAt: 0,
      },
      recentOutcomes: [],
    };
  }

  const summary = rawEffectiveness.summary && typeof rawEffectiveness.summary === 'object'
    ? rawEffectiveness.summary
    : {};

  return {
    current: rawEffectiveness.current ? normalizeEffectivenessStateEntry(rawEffectiveness.current) : null,
    pending: rawEffectiveness.pending ? normalizeEffectivenessStateEntry(rawEffectiveness.pending, { pending: true }) : null,
    summary: {
      totalOutcomes: Math.max(0, Math.floor(Number(summary.totalOutcomes) || 0)),
      resolvedCount: Math.max(0, Math.floor(Number(summary.resolvedCount) || 0)),
      stayCount: Math.max(0, Math.floor(Number(summary.stayCount) || 0)),
      leaveCount: Math.max(0, Math.floor(Number(summary.leaveCount) || 0)),
      abortCount: Math.max(0, Math.floor(Number(summary.abortCount) || 0)),
      leaveRate: Math.max(0, Number(summary.leaveRate) || 0),
      lastOutcome: normalizeExplicitEnum(summary.lastOutcome, {
        allowed: RECOVERY_OUTCOME_SET,
        fallback: null,
        errorCode: 'protection_snapshot_effectiveness_last_outcome_invalid',
        nullable: true,
        lowercase: true,
      }),
      lastOutcomeAt: Number(summary.lastOutcomeAt) || 0,
    },
    recentOutcomes: Array.isArray(rawEffectiveness.recentOutcomes)
      ? rawEffectiveness.recentOutcomes
        .map((entry) => normalizeEffectivenessOutcomeEntry(entry))
        .filter(Boolean)
      : [],
  };
}

function normalizeRuntime(runtime = null, goalEndSummary = null, coolingCurve = null) {
  if (!runtime || typeof runtime !== 'object' || !runtime.plan) {
    return {
      available: false,
      plan: null,
      observation: null,
      strategy: null,
      recovery: null,
      effectiveness: normalizeEffectiveness(null),
      goalEndSummary,
      coolingCurve,
      revision: 0,
    };
  }

  return {
    available: true,
    plan: normalizeCompiledRuntimeInterventionPlan(runtime.plan),
    observation: runtime.observation ? normalizeObservation(runtime.observation) : null,
    strategy: runtime.strategy ? normalizeStrategyDecision(runtime.strategy) : null,
    recovery: normalizeRecovery(runtime.recovery),
    effectiveness: normalizeEffectiveness(runtime.effectiveness),
    goalEndSummary,
    coolingCurve,
    revision: Number(runtime.revision) || 0,
  };
}

export function buildProtectionRuntimeSnapshot({
  hostname = '',
  tabId = null,
  runtime = null,
  telemetryContext = null,
  source = 'active_tab',
  capturedAt = Date.now(),
} = {}) {
  const normalizedHostname = normalizeHost(hostname);
  const snapshot = {
    capturedAt: requireSnapshotCapturedAt(capturedAt),
    scope: {
      host: normalizedHostname,
      tabId: normalizeTabId(tabId),
      source: normalizedHostname ? source : 'none',
    },
    runtime: normalizeRuntime(runtime, normalizeOptionalGoalEndSummary(telemetryContext?.goalEndSummary),
      normalizeOptionalCoolingCurveRuntimeState(telemetryContext?.coolingCurve === undefined
        ? runtime?.coolingCurve : telemetryContext.coolingCurve)),
  };

  return {
    ...snapshot,
    telemetry: buildCanonicalProtectionArtifactTelemetry(snapshot, telemetryContext),
  };
}

export function buildProtectionRuntimeSnapshotResponse(args = {}) {
  return {
    success: true,
    snapshot: buildProtectionRuntimeSnapshot(args),
  };
}

export function buildProtectionRuntimeSnapshotMessage(args = {}) {
  return {
    type: MESSAGE_TYPES.PROTECTION_RUNTIME_SNAPSHOT_UPDATED,
    payload: {
      snapshot: buildProtectionRuntimeSnapshot(args),
    },
  };
}

export function isProtectionRuntimeSnapshotMessage(message) {
  return message?.type === MESSAGE_TYPES.PROTECTION_RUNTIME_SNAPSHOT_UPDATED
    && !!message?.payload
    && typeof message.payload === 'object'
    && isProtectionRuntimeSnapshotPayload(message.payload.snapshot);
}

export function isProtectionRuntimeSnapshotPayload(snapshot) {
  const capturedAt = Number(snapshot?.capturedAt);
  return !!snapshot
    && typeof snapshot === 'object'
    && Number.isFinite(capturedAt)
    && capturedAt >= 0
    && !!snapshot.scope
    && typeof snapshot.scope === 'object'
    && typeof snapshot.scope.host === 'string'
    && (snapshot.scope.tabId === null || Number.isInteger(Number(snapshot.scope.tabId)))
    && typeof snapshot.scope.source === 'string'
    && !!snapshot.runtime
    && typeof snapshot.runtime === 'object'
    && typeof snapshot.runtime.available === 'boolean';
}

export function assertProtectionRuntimeSnapshotPayload(
  snapshot,
  context = 'protection runtime snapshot',
) {
  if (isProtectionRuntimeSnapshotPayload(snapshot)) {
    return snapshot;
  }
  throw new Error(`${context}:PROTECTION_RUNTIME_SNAPSHOT_INVALID`);
}
