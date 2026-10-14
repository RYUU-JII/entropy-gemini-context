// A frozen description of already committed foreground use, not a new session,
// visit counter, rest detector, pressure model or history writer.
const CONTRACT = 'gate_recent_consumption_v1';

export function unavailableGateRecentConsumption(evaluatedAt, reason) {
  return requireGateRecentConsumption({ contract: CONTRACT, status: 'unavailable',
    evaluatedAt, reason, lastObservedAt: null, foregroundMs: null });
}

export function requireGateRecentConsumption(value) {
  if (!value || value.contract !== CONTRACT
    || !['observed', 'unavailable'].includes(value.status)
    || !Number.isSafeInteger(value.evaluatedAt) || value.evaluatedAt < 0
    || typeof value.reason !== 'string' || !value.reason
    || (value.status === 'observed'
      ? !Number.isSafeInteger(value.lastObservedAt) || value.lastObservedAt < 0
        || value.lastObservedAt > value.evaluatedAt
        || !Number.isSafeInteger(value.foregroundMs) || value.foregroundMs <= 0
        || value.foregroundMs > value.lastObservedAt
      : value.lastObservedAt !== null || value.foregroundMs !== null)) {
    throw new Error('GATE_RECENT_CONSUMPTION_INVALID');
  }
  return value;
}

export function projectGateRecentConsumption(context, now) {
  if (!context || context.contract !== 'protected_consumption_context_v1'
    || !Number.isSafeInteger(context.evaluatedAt) || context.evaluatedAt > now
    || !context.coverage || !context.usage) {
    throw new Error('GATE_RECENT_CONSUMPTION_CONTEXT_REQUIRED');
  }
  if (context.coverage.status !== 'observed') {
    return unavailableGateRecentConsumption(now, context.coverage.status);
  }
  const run = context.usage.latestProtectedRun;
  if (run === null) return unavailableGateRecentConsumption(now, 'no_recorded_use');
  return requireGateRecentConsumption({ contract: CONTRACT, status: 'observed',
    evaluatedAt: now, reason: 'confirmed_foreground',
    lastObservedAt: run.endedAt, foregroundMs: run.foregroundMs });
}
