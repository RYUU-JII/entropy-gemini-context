import { requireSentinelFlareDeliveryForm } from '../sentinelFlareDeliveryForm.js';
import { requireGoalEpisodeBinding } from '../goalEpisodeBinding.js';

export const NUDGE_PENDING_TTL_MS = 90 * 1000;
export const NUDGE_LEASE_TTL_MS = 2 * 60 * 1000;
export const NUDGE_PENDING_PHASES = Object.freeze({
  DISPATCHING: 'dispatching',
  ENTRY_WAITING: 'entry_waiting',
  ENTRY_CANCELLING: 'entry_cancelling',
  PRESENTED: 'presented',
  EPISODE_COMPLETED: 'episode_completed',
});

export function isValidKey(key) {
  return typeof key === 'string' && key.length > 0;
}

export function isValidRunId(runId) {
  return typeof runId === 'string' && runId.length > 0;
}

export function normalizeNudgeOwnerHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function coercePositiveTs(value, fallback = 0) {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return fallback;
  return ts;
}

export function coerceTabId(value, fallback = null) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return fallback;
  return value;
}

export function isValidTabId(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export const NUDGE_PROTOCOL_CLAIM_SCOPES = Object.freeze({
  SITE: 'site',
  GLOBAL: 'global',
});

export const NUDGE_PROTOCOL_CLAIM_PRIORITIES = Object.freeze({
  [NUDGE_PROTOCOL_CLAIM_SCOPES.SITE]: 10,
  [NUDGE_PROTOCOL_CLAIM_SCOPES.GLOBAL]: 100,
});

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : '';
}

function normalizeProtocolClaimScope(value) {
  const normalized = normalizeString(value);
  if (!normalized) return NUDGE_PROTOCOL_CLAIM_SCOPES.SITE;
  if (normalized === NUDGE_PROTOCOL_CLAIM_SCOPES.GLOBAL) {
    return NUDGE_PROTOCOL_CLAIM_SCOPES.GLOBAL;
  }
  if (normalized === NUDGE_PROTOCOL_CLAIM_SCOPES.SITE) {
    return NUDGE_PROTOCOL_CLAIM_SCOPES.SITE;
  }
  throw new Error(`nudge_protocol_claim_scope_invalid:${String(value)}`);
}

function normalizeProtocolClaimVariant(value, scope) {
  const normalized = normalizeString(value);
  const expected = scope === NUDGE_PROTOCOL_CLAIM_SCOPES.GLOBAL
    ? 'global_sentinel'
    : 'site_furin';
  if (!normalized) return expected;
  if (normalized !== expected) {
    throw new Error(`nudge_protocol_claim_variant_scope_mismatch:${scope}:${normalized}`);
  }
  return expected;
}

export function normalizeNudgeProtocolClaim(raw = null) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const protocolScope = normalizeProtocolClaimScope(source.protocolScope);
  const triggerSource = normalizeString(source.triggerSource || source.source) || 'unknown';
  return {
    protocolScope,
    protocolVariant: normalizeProtocolClaimVariant(source.protocolVariant, protocolScope),
    protocolIntensity: Number.isFinite(Number(source.protocolIntensity))
      ? Math.max(0.35, Math.min(1, Number(source.protocolIntensity)))
      : (protocolScope === NUDGE_PROTOCOL_CLAIM_SCOPES.GLOBAL ? 0.88 : 0.62),
    triggerSource,
    priority: NUDGE_PROTOCOL_CLAIM_PRIORITIES[protocolScope],
  };
}

export function buildNudgeProtocolClaim({
  protocolProfile = null,
  triggerTarget = null,
} = {}) {
  return normalizeNudgeProtocolClaim({
    protocolScope: protocolProfile?.protocolScope,
    protocolVariant: protocolProfile?.protocolVariant,
    protocolIntensity: protocolProfile?.protocolIntensity,
    triggerSource: triggerTarget?.source,
  });
}

export function canNudgeProtocolClaimPreempt(candidate = null, current = null) {
  normalizeNudgeProtocolClaim(candidate);
  normalizeNudgeProtocolClaim(current);
  // Both are behavioral interventions. Scope/priority never grants preemption.
  return false;
}

export function normalizeDebtEntry(raw, now = Date.now()) {
  if (raw && typeof raw === 'object') {
    const createdAt = coercePositiveTs(raw.createdAt, now);
    const updatedAt = coercePositiveTs(raw.updatedAt, createdAt);
    const reason = typeof raw.reason === 'string' && raw.reason ? raw.reason : 'unknown';
    const protocolClaim = raw.protocolClaim && typeof raw.protocolClaim === 'object'
      ? normalizeNudgeProtocolClaim(raw.protocolClaim)
      : null;
    return {
      createdAt,
      updatedAt,
      reason,
      ...(protocolClaim ? { protocolClaim } : {}),
    };
  }
  return null;
}

export function normalizeDebtMap(rawMap, now = Date.now()) {
  const map = rawMap && typeof rawMap === 'object' ? rawMap : {};
  const next = {};
  Object.keys(map).forEach((key) => {
    const entry = normalizeDebtEntry(map[key], now);
    if (entry) next[key] = entry;
  });
  return next;
}

export function normalizePendingEntry(raw) {
  if (raw && typeof raw === 'object') {
    const ts = coercePositiveTs(raw.ts, 0);
    if (!ts) return null;
    const runId = isValidRunId(raw.runId) ? raw.runId : null;
    const tabId = coerceTabId(raw.tabId, null);
    const protocolClaim = normalizeNudgeProtocolClaim(raw.protocolClaim || raw);
    const phase = Object.values(NUDGE_PENDING_PHASES).includes(raw.phase)
      ? raw.phase
      : null;
    if (!phase) {
      throw new Error(`nudge_pending_phase_invalid:${String(raw.phase)}`);
    }
    const cancelling = phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING;
    if (!cancelling && Object.hasOwn(raw, 'cancellationReason')) {
      throw new Error('NUDGE_PENDING_CANCELLATION_REASON_UNEXPECTED');
    }
    const cancellationReason = cancelling ? requireNudgeCancellationReason(raw.cancellationReason) : null;
    const hostname = normalizeNudgeOwnerHostname(raw.hostname);
    const goalBinding = requireGoalEpisodeBinding(raw.goalBinding);
    if (goalBinding.runId !== runId || goalBinding.tabId !== tabId || goalBinding.hostname !== hostname
      || (goalBinding.purpose === 'global_goal' ? 'global' : 'site') !== protocolClaim.protocolScope) {
      throw new Error('NUDGE_PENDING_GOAL_BINDING_MISMATCH');
    }
    return {
      ts,
      runId,
      tabId,
      phase,
      protocolClaim,
      goalBinding,
      ...(cancelling ? { cancellationReason } : {}),
      ...(Object.hasOwn(raw, 'deliveryForm') ? { deliveryForm: requireSentinelFlareDeliveryForm(raw.deliveryForm) } : {}),
      ...(hostname ? { hostname } : {}),
    };
  }
  return null;
}

export function requireNudgeCancellationReason(reason) {
  if (typeof reason !== 'string' || !reason || reason !== reason.trim()) {
    throw new Error('NUDGE_PENDING_CANCELLATION_REASON_INVALID');
  }
  return reason;
}

export function isPendingEntryActive(pendingEntry, now = Date.now()) {
  if (!pendingEntry) return false;
  if (pendingEntry.phase !== NUDGE_PENDING_PHASES.DISPATCHING) return true;
  return now - pendingEntry.ts <= NUDGE_PENDING_TTL_MS;
}

export function canTransitionPendingPhase(currentPhase, nextPhase) {
  if (!Object.values(NUDGE_PENDING_PHASES).includes(currentPhase)) return false;
  if (!Object.values(NUDGE_PENDING_PHASES).includes(nextPhase)) return false;
  if (currentPhase === nextPhase) return true;
  if (currentPhase === NUDGE_PENDING_PHASES.DISPATCHING) {
    return nextPhase === NUDGE_PENDING_PHASES.ENTRY_WAITING
      || nextPhase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING
      || nextPhase === NUDGE_PENDING_PHASES.PRESENTED;
  }
  if (currentPhase === NUDGE_PENDING_PHASES.ENTRY_WAITING) return nextPhase === NUDGE_PENDING_PHASES.PRESENTED
    || nextPhase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING;
  return currentPhase === NUDGE_PENDING_PHASES.PRESENTED
    && nextPhase === NUDGE_PENDING_PHASES.EPISODE_COMPLETED;
}

export function normalizeLeaseEntry(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidRunId(raw.runId)) return null;
  const acquiredAt = coercePositiveTs(raw.acquiredAt, now);
  const expiresAt = coercePositiveTs(raw.expiresAt, acquiredAt + NUDGE_LEASE_TTL_MS);
  const tabId = coerceTabId(raw.tabId, null);
  return {
    runId: raw.runId,
    tabId,
    acquiredAt,
    expiresAt,
  };
}

export function isLeaseActive(lease, now = Date.now()) {
  return !!lease && lease.expiresAt > now;
}

export function buildLeaseEntry({
  runId,
  tabId = null,
  now = Date.now(),
  ttlMs = NUDGE_LEASE_TTL_MS,
}) {
  const ttl = Math.max(5_000, Number(ttlMs) || NUDGE_LEASE_TTL_MS);
  return {
    runId,
    tabId: coerceTabId(tabId, null),
    acquiredAt: now,
    expiresAt: now + ttl,
  };
}

export function normalizeTerminalEntry(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isValidRunId(raw.runId)) return null;
  const endedAt = coercePositiveTs(raw.endedAt, now);
  const status = raw.status === 'resolved' ? 'resolved' : 'aborted';
  if (Object.hasOwn(raw, 'reason') && (typeof raw.reason !== 'string' || !raw.reason)) {
    throw new Error('NUDGE_TERMINAL_REASON_INVALID');
  }
  return {
    runId: raw.runId,
    endedAt,
    status,
    ...(Object.hasOwn(raw, 'reason') ? { reason: raw.reason } : {}),
    ...(Object.hasOwn(raw, 'goalBinding') ? { goalBinding: requireGoalEpisodeBinding(raw.goalBinding) } : {}),
  };
}

export function buildTerminalEntry(
  { runId, status = 'aborted', endedAt = Date.now(), goalBinding = null, reason = null } = {},
) {
  if (!isValidRunId(runId)) return null;
  return {
    runId,
    endedAt: coercePositiveTs(endedAt, Date.now()),
    status: status === 'resolved' ? 'resolved' : 'aborted',
    ...(goalBinding === null ? {} : { goalBinding: requireGoalEpisodeBinding(goalBinding) }),
    ...(reason === null ? {} : { reason }),
  };
}

export function mergeDebtEntries(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function isRunAuthorized(runId, pendingEntry, leaseEntry) {
  if (!isValidRunId(runId)) return false;
  const pendingOwnsRun = pendingEntry?.runId === runId;
  const leaseOwnsRun = leaseEntry?.runId === runId;
  if (!pendingOwnsRun && !leaseOwnsRun) return false;
  if (pendingEntry?.runId && pendingEntry.runId !== runId) return false;
  if (leaseEntry?.runId && leaseEntry.runId !== runId) return false;
  return true;
}

export function isRunTerminated(runId, terminalEntry) {
  if (!isValidRunId(runId)) return false;
  const terminal = normalizeTerminalEntry(terminalEntry, Date.now());
  if (!terminal) return false;
  return terminal.runId === runId;
}

export function isTabAuthorized(tabId, pendingEntry, leaseEntry) {
  const providedTabId = coerceTabId(tabId, null);
  const pendingTabId = coerceTabId(pendingEntry?.tabId, null);
  const leaseTabId = coerceTabId(leaseEntry?.tabId, null);

  if (providedTabId === null || pendingTabId === null) return false;
  if (pendingTabId !== providedTabId) return false;
  if (leaseEntry && leaseTabId !== providedTabId) return false;
  return true;
}

export function isLifecycleAuthorized({
  runId = null,
  tabId = null,
  pendingEntry = null,
  leaseEntry = null,
  terminalEntry = null,
  now = Date.now(),
} = {}) {
  if (!isValidRunId(runId) && isValidRunId(terminalEntry?.runId)) return false;
  if (isRunTerminated(runId, terminalEntry)) return false;
  if (!pendingEntry || !isPendingEntryActive(pendingEntry, now)) return false;
  const activeLeaseEntry = isLeaseActive(leaseEntry, now) ? leaseEntry : null;
  return isRunAuthorized(runId, pendingEntry, activeLeaseEntry)
    && isTabAuthorized(tabId, pendingEntry, activeLeaseEntry);
}

export async function markDebtWithSessionData(
  key,
  {
    reason = 'aborted',
    now = Date.now(),
    sessionNudgeDebt = {},
    sessionNudgeAck = {},
    protocolClaim = null,
  } = {},
) {
  if (sessionNudgeAck[key]) return { nudgeDebt: sessionNudgeDebt, changed: false };
  const nudgeDebt = normalizeDebtMap(sessionNudgeDebt, now);
  const prev = normalizeDebtEntry(nudgeDebt[key], now);
  const nextProtocolClaim = protocolClaim
    ? normalizeNudgeProtocolClaim(protocolClaim)
    : prev?.protocolClaim || null;
  const next = {
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    reason: typeof reason === 'string' && reason ? reason : 'aborted',
    ...(nextProtocolClaim ? { protocolClaim: nextProtocolClaim } : {}),
  };
  const changed = !prev
    || prev.updatedAt !== next.updatedAt
    || prev.reason !== next.reason
    || prev.createdAt !== next.createdAt
    || JSON.stringify(prev.protocolClaim || null) !== JSON.stringify(next.protocolClaim || null);
  nudgeDebt[key] = next;
  return { nudgeDebt, changed };
}
