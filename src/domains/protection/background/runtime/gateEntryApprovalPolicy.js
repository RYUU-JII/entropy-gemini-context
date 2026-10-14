// Operational entry intent, not a consumption/pressure model. Only ordinary
// Gate decisions and existing browser observations change this policy state.
export const GATE_ENTRY_DEPARTURE_MS = 10 * 60_000;
export const GATE_ENTRY_OBSERVATION_GAP_MS = 120_000;

export function createGateEntryApproval() {
  return { version: 1, decisionAt: 0, sessionId: null, approved: false,
    observedAt: null, awaySince: null };
}

export function requireGateEntryApproval(value) {
  const keys = ['version', 'decisionAt', 'sessionId', 'approved', 'observedAt', 'awaySince'];
  if (!value || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))
    || value.version !== 1 || !Number.isSafeInteger(value.decisionAt) || value.decisionAt < 0
    || typeof value.approved !== 'boolean'
    || (value.sessionId !== null && (typeof value.sessionId !== 'string' || !value.sessionId.trim()))
    || ['observedAt', 'awaySince'].some((key) => value[key] !== null && (!Number.isSafeInteger(value[key]) || value[key] < 0))
    || (value.approved && (value.sessionId === null || value.decisionAt === 0))
    || ((value.sessionId === null) !== (value.decisionAt === 0))
    || (value.approved && value.observedAt === null)
    || (value.observedAt !== null && value.observedAt < value.decisionAt)
    || (value.awaySince !== null && (!value.approved || value.observedAt === null
      || value.awaySince < value.decisionAt || value.awaySince > value.observedAt))) {
    throw new Error('GATE_ENTRY_APPROVAL_INVALID');
  }
  return value;
}

export function approveGateEntry(previous, { sessionId, now }) {
  requireGateEntryApproval(previous);
  if (typeof sessionId !== 'string' || !sessionId.trim() || !Number.isSafeInteger(now) || now <= 0) {
    throw new Error('GATE_ENTRY_DECISION_INVALID');
  }
  // Replayed or older completion cannot renew an ended flow or replace a newer decision.
  if (sessionId === previous.sessionId || now < previous.decisionAt) return previous;
  return requireGateEntryApproval({ ...previous, sessionId, decisionAt: now,
    approved: true, observedAt: now, awaySince: null });
}

export function observeGateEntryApproval(previous, { observedAt, presence }) {
  requireGateEntryApproval(previous);
  if (!Number.isSafeInteger(observedAt) || observedAt < 0
    || !['engaged', 'away', 'unknown'].includes(presence)) {
    throw new Error('GATE_ENTRY_PRESENCE_INVALID');
  }
  if (observedAt < previous.decisionAt
    || (previous.observedAt !== null && observedAt < previous.observedAt)) return previous;
  if (observedAt === previous.observedAt && presence !== 'engaged') return previous;
  let awaySince = null;
  if (previous.approved && presence === 'away') {
    awaySince = previous.awaySince !== null && previous.observedAt !== null
      && observedAt - previous.observedAt <= GATE_ENTRY_OBSERVATION_GAP_MS
      ? previous.awaySince : observedAt;
  }
  const ended = awaySince !== null && observedAt - awaySince >= GATE_ENTRY_DEPARTURE_MS;
  return requireGateEntryApproval({ ...previous, observedAt,
    approved: previous.approved && !ended, awaySince: ended ? null : awaySince });
}
