import {
  coercePositiveTs,
  isValidKey,
  isValidRunId,
  isValidTabId,
} from './nudgeSessionCore.js';

export const NUDGE_TERMINAL_OUTBOX_STATES = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
});

export const NUDGE_TERMINAL_OUTBOX_STATUSES = Object.freeze({
  RESOLVED: 'resolved',
  ABORTED: 'aborted',
});

export const NUDGE_TERMINAL_OUTBOX_STAGES = Object.freeze({
  RECOVERY_TRACKING: 'recovery_tracking',
  GLOBAL_OUTCOME: 'global_outcome',
  STAY_DECISION: 'stay_decision',
});

const NUDGE_TERMINAL_OUTBOX_STAGE_SET = new Set(Object.values(NUDGE_TERMINAL_OUTBOX_STAGES));

export const NUDGE_TERMINAL_OUTBOX_COMPLETED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NUDGE_TERMINAL_OUTBOX_MAX_COMPLETED = 256;

function normalizeStatus(value) {
  if (value === NUDGE_TERMINAL_OUTBOX_STATUSES.RESOLVED) return value;
  if (value === NUDGE_TERMINAL_OUTBOX_STATUSES.ABORTED) return value;
  throw new Error(`nudge_terminal_outbox_status_invalid:${String(value)}`);
}

function normalizeState(value) {
  if (value === NUDGE_TERMINAL_OUTBOX_STATES.PENDING) return value;
  if (value === NUDGE_TERMINAL_OUTBOX_STATES.COMPLETED) return value;
  throw new Error(`nudge_terminal_outbox_state_invalid:${String(value)}`);
}

function normalizeReason(value, status) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return status === NUDGE_TERMINAL_OUTBOX_STATUSES.RESOLVED ? 'resolved' : 'aborted';
}

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeDurationMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) return 0;
  return Math.floor(durationMs);
}

function resolveRequiredStages(status) {
  if (status === NUDGE_TERMINAL_OUTBOX_STATUSES.ABORTED) {
    return [NUDGE_TERMINAL_OUTBOX_STAGES.RECOVERY_TRACKING];
  }
  return [
    NUDGE_TERMINAL_OUTBOX_STAGES.RECOVERY_TRACKING,
    NUDGE_TERMINAL_OUTBOX_STAGES.GLOBAL_OUTCOME,
    NUDGE_TERMINAL_OUTBOX_STAGES.STAY_DECISION,
  ];
}

function normalizeStages(value, errorCode) {
  if (!Array.isArray(value)) throw new Error(errorCode);
  const stages = [];
  for (const stage of value) {
    if (!NUDGE_TERMINAL_OUTBOX_STAGE_SET.has(stage)) {
      throw new Error(`${errorCode}:${String(stage)}`);
    }
    if (!stages.includes(stage)) stages.push(stage);
  }
  return stages;
}

function buildInitialAttempts(requiredStages) {
  return requiredStages.reduce((attempts, stage) => {
    attempts[stage] = 0;
    return attempts;
  }, {});
}

function normalizeAttempts(value, requiredStages) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('nudge_terminal_outbox_attempts_invalid');
  }
  const keys = Object.keys(value);
  if (
    keys.length !== requiredStages.length
    || requiredStages.some((stage) => !Object.prototype.hasOwnProperty.call(value, stage))
  ) {
    throw new Error('nudge_terminal_outbox_attempts_stage_mismatch');
  }
  return requiredStages.reduce((attempts, stage) => {
    const count = Number(value[stage]);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`nudge_terminal_outbox_attempt_count_invalid:${stage}`);
    }
    attempts[stage] = count;
    return attempts;
  }, {});
}

function normalizeLastFailure(value, requiredStages) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('nudge_terminal_outbox_last_failure_invalid');
  }
  if (!requiredStages.includes(value.stage)) {
    throw new Error('nudge_terminal_outbox_last_failure_stage_invalid');
  }
  const code = typeof value.code === 'string' && value.code.trim()
    ? value.code.trim()
    : '';
  const at = coercePositiveTs(value.at, 0);
  if (!code || !at) throw new Error('nudge_terminal_outbox_last_failure_shape_invalid');
  return { stage: value.stage, code, at };
}

export function buildNudgeTerminalOutboxEntry({
  key,
  runId,
  tabId,
  status,
  reason,
  durationMs = 0,
  hostname = '',
  committedAt = Date.now(),
} = {}) {
  if (!isValidKey(key)) throw new Error('nudge_terminal_outbox_key_invalid');
  if (!isValidRunId(runId)) throw new Error('nudge_terminal_outbox_run_id_invalid');
  if (!isValidTabId(tabId)) throw new Error('nudge_terminal_outbox_tab_id_invalid');
  const normalizedStatus = normalizeStatus(status);
  const normalizedCommittedAt = coercePositiveTs(committedAt, 0);
  if (!normalizedCommittedAt) throw new Error('nudge_terminal_outbox_committed_at_invalid');
  const requiredStages = resolveRequiredStages(normalizedStatus);
  return {
    key,
    runId,
    tabId,
    status: normalizedStatus,
    state: NUDGE_TERMINAL_OUTBOX_STATES.PENDING,
    reason: normalizeReason(reason, normalizedStatus),
    durationMs: normalizeDurationMs(durationMs),
    hostname: normalizeHostname(hostname),
    committedAt: normalizedCommittedAt,
    requiredStages,
    completedStages: [],
    attempts: buildInitialAttempts(requiredStages),
    lastFailure: null,
    completedAt: 0,
  };
}

export function normalizeNudgeTerminalOutboxEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('nudge_terminal_outbox_entry_invalid');
  }
  if (!isValidKey(raw.key)) throw new Error('nudge_terminal_outbox_key_invalid');
  if (!isValidRunId(raw.runId)) throw new Error('nudge_terminal_outbox_run_id_invalid');
  if (!isValidTabId(raw.tabId)) throw new Error('nudge_terminal_outbox_tab_id_invalid');
  const status = normalizeStatus(raw.status);
  const state = normalizeState(raw.state);
  const committedAt = coercePositiveTs(raw.committedAt, 0);
  if (!committedAt) throw new Error('nudge_terminal_outbox_committed_at_invalid');
  const requiredStages = normalizeStages(
    raw.requiredStages,
    'nudge_terminal_outbox_required_stages_invalid',
  );
  const expectedRequiredStages = resolveRequiredStages(status);
  if (
    requiredStages.length !== expectedRequiredStages.length
    || expectedRequiredStages.some((stage) => !requiredStages.includes(stage))
  ) {
    throw new Error('nudge_terminal_outbox_required_stages_status_mismatch');
  }
  const completedStages = normalizeStages(
    raw.completedStages,
    'nudge_terminal_outbox_completed_stages_invalid',
  );
  if (completedStages.some((stage) => !requiredStages.includes(stage))) {
    throw new Error('nudge_terminal_outbox_completed_stage_not_required');
  }
  const attempts = normalizeAttempts(raw.attempts, requiredStages);
  const lastFailure = normalizeLastFailure(raw.lastFailure, requiredStages);
  const completedAt = coercePositiveTs(raw.completedAt, 0);
  if (state === NUDGE_TERMINAL_OUTBOX_STATES.COMPLETED && !completedAt) {
    throw new Error('nudge_terminal_outbox_completed_at_invalid');
  }
  if (state === NUDGE_TERMINAL_OUTBOX_STATES.PENDING && completedAt) {
    throw new Error('nudge_terminal_outbox_pending_completed_at_conflict');
  }
  const allStagesCompleted = requiredStages.every((stage) => completedStages.includes(stage));
  if (state === NUDGE_TERMINAL_OUTBOX_STATES.COMPLETED && !allStagesCompleted) {
    throw new Error('nudge_terminal_outbox_completed_stage_set_incomplete');
  }
  if (state === NUDGE_TERMINAL_OUTBOX_STATES.PENDING && allStagesCompleted) {
    throw new Error('nudge_terminal_outbox_pending_stage_set_complete');
  }
  return {
    key: raw.key,
    runId: raw.runId,
    tabId: raw.tabId,
    status,
    state,
    reason: normalizeReason(raw.reason, status),
    durationMs: normalizeDurationMs(raw.durationMs),
    hostname: normalizeHostname(raw.hostname),
    committedAt,
    requiredStages,
    completedStages,
    attempts,
    lastFailure,
    completedAt,
  };
}

export function completeNudgeTerminalOutboxStage(rawEntry, stage, now = Date.now()) {
  const entry = normalizeNudgeTerminalOutboxEntry(rawEntry);
  if (!NUDGE_TERMINAL_OUTBOX_STAGE_SET.has(stage)) {
    throw new Error(`nudge_terminal_outbox_stage_invalid:${String(stage)}`);
  }
  if (!entry.requiredStages.includes(stage)) {
    throw new Error(`nudge_terminal_outbox_stage_not_required:${stage}`);
  }
  if (entry.completedStages.includes(stage)) return entry;
  const completedStages = [...entry.completedStages, stage];
  const completed = entry.requiredStages.every((requiredStage) => (
    completedStages.includes(requiredStage)
  ));
  return {
    ...entry,
    state: completed
      ? NUDGE_TERMINAL_OUTBOX_STATES.COMPLETED
      : NUDGE_TERMINAL_OUTBOX_STATES.PENDING,
    completedStages,
    lastFailure: completed ? null : entry.lastFailure,
    completedAt: completed ? coercePositiveTs(now, Date.now()) : 0,
  };
}

export function recordNudgeTerminalOutboxStageFailure(
  rawEntry,
  stage,
  code,
  now = Date.now(),
) {
  const entry = normalizeNudgeTerminalOutboxEntry(rawEntry);
  if (!entry.requiredStages.includes(stage)) {
    throw new Error(`nudge_terminal_outbox_stage_not_required:${String(stage)}`);
  }
  const normalizedCode = typeof code === 'string' && code.trim()
    ? code.trim()
    : 'NUDGE_TERMINAL_OUTBOX_STAGE_FAILED';
  return {
    ...entry,
    attempts: {
      ...entry.attempts,
      [stage]: entry.attempts[stage] + 1,
    },
    lastFailure: {
      stage,
      code: normalizedCode,
      at: coercePositiveTs(now, Date.now()),
    },
  };
}

export function getPendingNudgeTerminalOutboxStages(rawEntry) {
  const entry = normalizeNudgeTerminalOutboxEntry(rawEntry);
  return entry.requiredStages.filter((stage) => !entry.completedStages.includes(stage));
}

export function normalizeNudgeTerminalOutboxMap(rawMap) {
  if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) {
    throw new Error('nudge_terminal_outbox_map_invalid');
  }
  const normalized = {};
  for (const [runId, rawEntry] of Object.entries(rawMap)) {
    const entry = normalizeNudgeTerminalOutboxEntry(rawEntry);
    if (entry.runId !== runId) {
      throw new Error(`nudge_terminal_outbox_map_run_mismatch:${runId}`);
    }
    normalized[runId] = entry;
  }
  return normalized;
}

export function pruneNudgeTerminalOutboxMap(rawMap, now = Date.now()) {
  const normalized = normalizeNudgeTerminalOutboxMap(rawMap);
  const pending = [];
  const completed = [];
  for (const entry of Object.values(normalized)) {
    if (entry.state === NUDGE_TERMINAL_OUTBOX_STATES.PENDING) {
      pending.push(entry);
      continue;
    }
    if (now - entry.completedAt <= NUDGE_TERMINAL_OUTBOX_COMPLETED_TTL_MS) {
      completed.push(entry);
    }
  }
  completed.sort((a, b) => b.completedAt - a.completedAt);
  return [...pending, ...completed.slice(0, NUDGE_TERMINAL_OUTBOX_MAX_COMPLETED)]
    .reduce((map, entry) => {
      map[entry.runId] = entry;
      return map;
    }, {});
}

export function resolveNudgeTerminalOutboxReplay(rawEntry, {
  key,
  runId,
  tabId,
  status,
} = {}) {
  if (!rawEntry) return null;
  const entry = normalizeNudgeTerminalOutboxEntry(rawEntry);
  const normalizedStatus = normalizeStatus(status);
  if (
    entry.key !== key
    || entry.runId !== runId
    || entry.tabId !== tabId
    || entry.status !== normalizedStatus
  ) {
    return {
      outcome: 'conflict',
      reason: 'NUDGE_TERMINAL_OUTBOX_OWNER_CONFLICT',
      entry: null,
    };
  }
  return {
    outcome: 'already_applied',
    reason: null,
    entry,
  };
}
