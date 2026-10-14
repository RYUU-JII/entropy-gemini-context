import { GATE_ENTRY_DEPARTURE_MS } from './gateEntryApprovalPolicy.js';
import { DEFAULT_ENSO_INTERVAL_PRESET, ENSO_INTERVAL_PRESETS, resolveEnsoIntervalMs } from '../../../settings/config/ensoIntervalPolicy.js';

export const ENSO_CADENCE_MAX_OBSERVATION_GAP_MS = 120_000;
const INTERVALS = Object.freeze(Object.values(ENSO_INTERVAL_PRESETS));
export const ENSO_CADENCE_MAX_INTERVAL_MS = Math.max(...INTERVALS);

export function createEnsoCadenceState() {
  return { version: 1, consumedMs: 0, observedAt: 0, resetAt: 0, awaySince: null, revision: 0,
    enabled: false, intervalMs: resolveEnsoIntervalMs(DEFAULT_ENSO_INTERVAL_PRESET) };
}

export function requireEnsoCadenceState(state) {
  const keys = ['version', 'consumedMs', 'observedAt', 'resetAt', 'awaySince', 'revision', 'enabled', 'intervalMs'];
  if (!state || Object.keys(state).length !== keys.length || keys.some(key => !Object.hasOwn(state, key))
    || state.version !== 1 || ['consumedMs', 'observedAt', 'resetAt', 'revision'].some(key => !Number.isSafeInteger(state[key]) || state[key] < 0)
    || typeof state.enabled !== 'boolean' || !INTERVALS.includes(state.intervalMs)
    || state.consumedMs > ENSO_CADENCE_MAX_INTERVAL_MS || state.resetAt > state.observedAt
    || (state.awaySince !== null && (!Number.isSafeInteger(state.awaySince) || state.awaySince < 0 || state.awaySince > state.observedAt))) {
    throw new Error('ENSO_CADENCE_STATE_INVALID');
  }
  return state;
}

export function configureEnsoCadence(previous, policy, at) {
  requireEnsoCadenceState(previous);
  if (!policy || typeof policy.enabled !== 'boolean' || !INTERVALS.includes(policy.intervalMs)) throw new Error('ENSO_CADENCE_POLICY_INVALID');
  if (policy.enabled === previous.enabled && policy.intervalMs === previous.intervalMs) return previous;
  const next = policy.enabled === previous.enabled ? previous : resetEnsoCadence(previous, Math.max(at, previous.observedAt));
  return requireEnsoCadenceState({ ...next, enabled: policy.enabled, intervalMs: policy.intervalMs, revision: next.revision + 1 });
}

export function requireEnsoCadencePoint(point) {
  if (!point || !Number.isSafeInteger(point.observedAt) || point.observedAt < 0
    || !['consuming', 'paused', 'away', 'unknown'].includes(point.mode)
    || (point.tabId !== null && (!Number.isSafeInteger(point.tabId) || point.tabId < 0))) throw new Error('ENSO_CADENCE_POINT_INVALID');
  return point;
}

// Only observed intervals enter this reducer. A read never extrapolates time.
export function advanceEnsoCadence(previous, { point, interval = null, intervalMs, occupied = false, continuity = false }) {
  requireEnsoCadenceState(previous); requireEnsoCadencePoint(point);
  if (!INTERVALS.includes(intervalMs)) throw new Error('ENSO_CADENCE_INTERVAL_INVALID');
  if (point.observedAt < previous.observedAt) return previous;
  let elapsed = 0;
  if (interval !== null) {
    if (!Number.isSafeInteger(interval.startedAt) || !Number.isSafeInteger(interval.endedAt)
      || interval.startedAt < 0 || interval.endedAt < interval.startedAt || interval.endedAt > point.observedAt) throw new Error('ENSO_CADENCE_RECEIPT_INVALID');
    if (interval.endedAt - interval.startedAt <= ENSO_CADENCE_MAX_OBSERVATION_GAP_MS) {
      elapsed = Math.max(0, interval.endedAt - Math.max(interval.startedAt, previous.observedAt, previous.resetAt));
    }
  }
  const awaySince = point.mode === 'away'
    ? continuity && previous.awaySince !== null && point.observedAt - previous.observedAt <= ENSO_CADENCE_MAX_OBSERVATION_GAP_MS
      ? previous.awaySince : point.observedAt
    : null;
  const departed = awaySince !== null && point.observedAt - awaySince >= GATE_ENTRY_DEPARTURE_MS;
  return requireEnsoCadenceState({ ...previous, observedAt: point.observedAt,
    consumedMs: departed ? 0 : Math.min(intervalMs, previous.consumedMs + (occupied || !previous.enabled ? 0 : elapsed)),
    resetAt: departed ? point.observedAt : previous.resetAt,
    awaySince, revision: previous.revision + 1 });
}

export function resetEnsoCadence(previous, at) {
  requireEnsoCadenceState(previous);
  if (!Number.isSafeInteger(at) || at < previous.observedAt) throw new Error('ENSO_CADENCE_RESET_TIME_INVALID');
  return { ...previous, consumedMs: 0, observedAt: at, resetAt: at, awaySince: null, revision: previous.revision + 1 };
}

export function isEnsoReflection(owner) {
  // A required goal Horizon occupies the shared lane, but only its final Furin
  // earns a completed-reflection credit. Attachment/encounter are not Furin.
  if (owner.source === 'goal_feed_horizon') return owner.manual === false && owner.finalPresentedAt > 0;
  return owner.manual === false && (['enso_gate', 'site_furin', 'global_sentinel'].includes(owner.kind)
    || (owner.kind === 'gate_interstitial' && owner.gateKind !== 'isolation'));
}

export function projectEnsoCadence(state, intervalMs, reason = null) {
  requireEnsoCadenceState(state);
  if (!INTERVALS.includes(intervalMs)) throw new Error('ENSO_CADENCE_INTERVAL_INVALID');
  const consumedMs = Math.min(state.consumedMs, intervalMs);
  const ready = consumedMs >= intervalMs;
  return { version: 1, eligible: ready && reason === null, consumedMs, intervalMs,
    remainingMs: Math.max(0, intervalMs - consumedMs), observedAt: state.observedAt,
    reason: reason || (ready ? 'consumption_interval_due' : 'consumption_interval_pending'), revision: state.revision };
}
