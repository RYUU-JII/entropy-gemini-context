import {
  INTERVENTION_ADMISSION_DECISIONS,
  INTERVENTION_ADMISSION_EVENTS,
  createInterventionAdmissionState,
  reduceInterventionAdmission,
} from './interventionAdmissionKernel.js';

export const DEFAULT_INTERVENTION_GLOBAL_GAP_MS = 45_000;

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function requireLease(lease) {
  if (!lease || typeof lease !== 'object' || Array.isArray(lease)) {
    throw new Error('INTERVENTION_ADMISSION_ARBITER_LEASE_REQUIRED');
  }
  const leaseId = typeof lease.leaseId === 'string' ? lease.leaseId.trim() : '';
  const requestId = typeof lease.requestId === 'string' ? lease.requestId.trim() : '';
  const kind = typeof lease.kind === 'string' ? lease.kind.trim() : '';
  if (!leaseId || !requestId || !kind) {
    throw new Error('INTERVENTION_ADMISSION_ARBITER_LEASE_INVALID');
  }
  return { leaseId, requestId, kind };
}

function freezeSnapshot(state) {
  return Object.freeze({
    enabled: true,
    state,
  });
}

export class InterventionAdmissionArbiter {
  constructor({
    globalMinimumGapMs = DEFAULT_INTERVENTION_GLOBAL_GAP_MS,
    now = () => Date.now(),
  } = {}) {
    if (typeof now !== 'function') {
      throw new Error('INTERVENTION_ADMISSION_ARBITER_CLOCK_REQUIRED');
    }
    this._now = now;
    this._state = createInterventionAdmissionState({ globalMinimumGapMs });
    this._subscribers = new Map();
    this._nextSubscriberId = 1;
  }

  get enabled() {
    return true;
  }

  getSnapshot() {
    return freezeSnapshot(this._state);
  }

  subscribe({
    onChange,
    emitCurrent = false,
  } = {}) {
    if (typeof onChange !== 'function') {
      throw new Error('INTERVENTION_ADMISSION_ARBITER_SUBSCRIBER_REQUIRED');
    }
    const subscriberId = this._nextSubscriberId;
    this._nextSubscriberId += 1;
    this._subscribers.set(subscriberId, onChange);
    if (emitCurrent) onChange(this.getSnapshot());
    return () => this._subscribers.delete(subscriberId);
  }

  request(candidate, { now = this._now() } = {}) {
    const evaluatedAt = normalizeNow(
      now,
      'INTERVENTION_ADMISSION_ARBITER_REQUEST_NOW_INVALID',
    );
    const result = reduceInterventionAdmission(this._state, {
      type: INTERVENTION_ADMISSION_EVENTS.REQUESTED,
      now: evaluatedAt,
      candidates: [candidate],
    });
    this._applyResult(result, 'requested');
    const decision = result.decisions[0] || null;
    if (!decision) {
      throw new Error('INTERVENTION_ADMISSION_ARBITER_DECISION_MISSING');
    }
    const lease = decision.decision === INTERVENTION_ADMISSION_DECISIONS.EMIT
      ? Object.freeze({
          leaseId: decision.leaseId,
          requestId: decision.requestId,
          kind: decision.kind,
        })
      : null;
    return Object.freeze({
      accepted: decision.decision === INTERVENTION_ADMISSION_DECISIONS.EMIT,
      decision,
      lease,
      snapshot: this.getSnapshot(),
    });
  }

  present(lease, { now = this._now() } = {}) {
    return this._transitionLease(
      INTERVENTION_ADMISSION_EVENTS.PRESENTED,
      lease,
      now,
    );
  }

  abort(lease, { now = this._now() } = {}) {
    return this._transitionLease(
      INTERVENTION_ADMISSION_EVENTS.ABORTED,
      lease,
      now,
    );
  }

  release(lease, { now = this._now() } = {}) {
    return this._transitionLease(
      INTERVENTION_ADMISSION_EVENTS.RELEASED,
      lease,
      now,
    );
  }

  setContext(context) {
    const result = reduceInterventionAdmission(this._state, {
      type: INTERVENTION_ADMISSION_EVENTS.CONTEXT_CHANGED,
      context,
    });
    this._applyResult(result, 'context_changed');
    return this.getSnapshot();
  }

  _transitionLease(type, lease, now) {
    const normalizedLease = requireLease(lease);
    const transitionedAt = normalizeNow(
      now,
      `INTERVENTION_ADMISSION_ARBITER_${type.toUpperCase()}_NOW_INVALID`,
    );
    const activeLease = this._state.activeLease;
    if (
      !activeLease
      || activeLease.leaseId !== normalizedLease.leaseId
      || activeLease.requestId !== normalizedLease.requestId
      || activeLease.kind !== normalizedLease.kind
    ) {
      throw new Error('INTERVENTION_ADMISSION_ARBITER_LEASE_MISMATCH');
    }
    const result = reduceInterventionAdmission(this._state, {
      type,
      leaseId: normalizedLease.leaseId,
      now: transitionedAt,
    });
    this._applyResult(result, type);
    return this.getSnapshot();
  }

  _applyResult(result, reason) {
    const previousState = this._state;
    this._state = result.state;
    if (previousState === this._state) return;
    const snapshot = this.getSnapshot();
    this._subscribers.forEach((subscriber) => {
      try {
        subscriber(snapshot, { reason });
      } catch (error) {
        console.warn?.('[InterventionAdmissionArbiter] subscriber failed', {
          reason,
          error: String(
            error?.message || error || 'INTERVENTION_ADMISSION_ARBITER_SUBSCRIBER_FAILED',
          ),
        });
      }
    });
  }
}

export default InterventionAdmissionArbiter;
