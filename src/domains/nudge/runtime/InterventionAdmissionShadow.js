import {
  INTERVENTION_ADMISSION_EVENTS,
  createInterventionAdmissionState,
  reduceInterventionAdmission,
} from './interventionAdmissionKernel.js';

export const INTERVENTION_ADMISSION_SHADOW_VERSION = 1;
export const DEFAULT_INTERVENTION_SHADOW_EPOCH_MS = 160;

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeEpochMs(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 40 || numeric > 2_000) {
    throw new Error(`INTERVENTION_ADMISSION_SHADOW_EPOCH_INVALID:${String(value)}`);
  }
  return numeric;
}

function requireCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('INTERVENTION_ADMISSION_SHADOW_CANDIDATE_REQUIRED');
  }
  const requestId = typeof candidate.requestId === 'string'
    ? candidate.requestId.trim()
    : '';
  const kind = typeof candidate.kind === 'string' ? candidate.kind.trim() : '';
  if (!requestId || !kind) {
    throw new Error('INTERVENTION_ADMISSION_SHADOW_CANDIDATE_INVALID');
  }
  return Object.freeze({ ...candidate, requestId, kind });
}

function requireActualAdmission(actualAdmission, candidate) {
  if (!actualAdmission || typeof actualAdmission !== 'object') {
    throw new Error('INTERVENTION_ADMISSION_SHADOW_ACTUAL_ADMISSION_REQUIRED');
  }
  const decision = actualAdmission.decision;
  if (
    !decision
    || decision.requestId !== candidate.requestId
    || decision.kind !== candidate.kind
    || typeof decision.decision !== 'string'
    || typeof decision.reason !== 'string'
  ) {
    throw new Error('INTERVENTION_ADMISSION_SHADOW_ACTUAL_DECISION_MISMATCH');
  }
  return Object.freeze({
    accepted: actualAdmission.accepted === true,
    decision: decision.decision,
    reason: decision.reason,
    notBefore: normalizeNow(
      decision.notBefore,
      'INTERVENTION_ADMISSION_SHADOW_ACTUAL_NOT_BEFORE_INVALID',
    ),
  });
}

function summarizeProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  return Object.freeze({
    version: profile.version,
    evaluatedAt: profile.evaluatedAt,
    mode: profile.mode,
    dominantIntervention: profile.dominantIntervention,
    weights: Object.freeze({ ...profile.weights }),
    signals: Object.freeze({ ...profile.signals }),
  });
}

function freezeProposal(proposal) {
  return Object.freeze({
    requestId: proposal.candidate.requestId,
    kind: proposal.candidate.kind,
    requestedAt: proposal.candidate.requestedAt,
    validUntil: proposal.candidate.validUntil,
    priority: proposal.candidate.priority,
    weight: proposal.candidate.weight,
    attemptCount: proposal.attemptCount,
    actual: proposal.actual,
    consumptionProfile: proposal.consumptionProfile,
  });
}

function freezeCollectingEpoch(epoch) {
  if (!epoch) return null;
  return Object.freeze({
    epochId: epoch.epochId,
    openedAt: epoch.openedAt,
    closesAt: epoch.closesAt,
    proposals: Object.freeze(epoch.proposals.map(freezeProposal)),
  });
}

function createSnapshot({
  currentEpoch,
  lastCompletedEpoch,
  nextEpochSerial,
}) {
  return Object.freeze({
    version: INTERVENTION_ADMISSION_SHADOW_VERSION,
    enabled: true,
    phase: currentEpoch ? 'collecting' : 'idle',
    nextEpochSerial,
    currentEpoch: freezeCollectingEpoch(currentEpoch),
    lastCompletedEpoch,
  });
}

function candidateIdentityMatches(left, right) {
  return left.requestId === right.requestId
    && left.kind === right.kind
    && left.evidenceRevision === right.evidenceRevision
    && left.priority === right.priority
    && left.exclusivity === right.exclusivity;
}

export class InterventionAdmissionShadow {
  constructor({
    epochMs = DEFAULT_INTERVENTION_SHADOW_EPOCH_MS,
    now = () => Date.now(),
    schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    cancel = (handle) => globalThis.clearTimeout(handle),
  } = {}) {
    if (typeof now !== 'function') {
      throw new Error('INTERVENTION_ADMISSION_SHADOW_CLOCK_REQUIRED');
    }
    if (typeof schedule !== 'function' || typeof cancel !== 'function') {
      throw new Error('INTERVENTION_ADMISSION_SHADOW_SCHEDULER_REQUIRED');
    }
    this._epochMs = normalizeEpochMs(epochMs);
    this._now = now;
    this._schedule = schedule;
    this._cancel = cancel;
    this._nextEpochSerial = 1;
    this._currentEpoch = null;
    this._lastCompletedEpoch = null;
    this._timerHandle = null;
    this._subscribers = new Map();
    this._nextSubscriberId = 1;
  }

  getSnapshot() {
    return createSnapshot({
      currentEpoch: this._currentEpoch,
      lastCompletedEpoch: this._lastCompletedEpoch,
      nextEpochSerial: this._nextEpochSerial,
    });
  }

  subscribe({
    onChange,
    emitCurrent = false,
  } = {}) {
    if (typeof onChange !== 'function') {
      throw new Error('INTERVENTION_ADMISSION_SHADOW_SUBSCRIBER_REQUIRED');
    }
    const subscriberId = this._nextSubscriberId;
    this._nextSubscriberId += 1;
    this._subscribers.set(subscriberId, onChange);
    if (emitCurrent) onChange(this.getSnapshot(), { reason: 'current' });
    return () => this._subscribers.delete(subscriberId);
  }

  observe({
    candidate,
    actualAdmission,
    consumptionProfile = null,
    now = this._now(),
  } = {}) {
    const observedAt = normalizeNow(
      now,
      'INTERVENTION_ADMISSION_SHADOW_OBSERVED_AT_INVALID',
    );
    const normalizedCandidate = requireCandidate(candidate);
    const normalizedActual = requireActualAdmission(
      actualAdmission,
      normalizedCandidate,
    );
    if (
      this._currentEpoch
      && observedAt >= this._currentEpoch.closesAt
    ) {
      this._finalize(this._currentEpoch.closesAt);
    }
    if (!this._currentEpoch) this._openEpoch(observedAt);

    const existing = this._currentEpoch.proposals.find(
      (proposal) => proposal.candidate.requestId === normalizedCandidate.requestId,
    );
    if (existing) {
      if (!candidateIdentityMatches(existing.candidate, normalizedCandidate)) {
        throw new Error('INTERVENTION_ADMISSION_SHADOW_DUPLICATE_MISMATCH');
      }
      existing.candidate = normalizedCandidate;
      existing.consumptionProfile = summarizeProfile(consumptionProfile);
      existing.attemptCount += 1;
      if (existing.actual.accepted !== true && normalizedActual.accepted === true) {
        existing.actual = normalizedActual;
      }
    } else {
      this._currentEpoch.proposals.push({
        candidate: normalizedCandidate,
        actual: normalizedActual,
        attemptCount: 1,
        consumptionProfile: summarizeProfile(consumptionProfile),
      });
    }
    this._notify('proposal_observed');
    return this.getSnapshot();
  }

  flush({ now = this._now() } = {}) {
    const flushedAt = normalizeNow(
      now,
      'INTERVENTION_ADMISSION_SHADOW_FLUSH_AT_INVALID',
    );
    if (this._currentEpoch && flushedAt >= this._currentEpoch.closesAt) {
      this._finalize(this._currentEpoch.closesAt);
    }
    return this.getSnapshot();
  }

  dispose() {
    this._clearTimer();
    this._currentEpoch = null;
    this._subscribers.clear();
    return true;
  }

  _openEpoch(openedAt) {
    const epochId = `shadow:${this._nextEpochSerial}`;
    this._nextEpochSerial += 1;
    this._currentEpoch = {
      epochId,
      openedAt,
      closesAt: openedAt + this._epochMs,
      proposals: [],
    };
    this._timerHandle = this._schedule(() => {
      this._timerHandle = null;
      if (!this._currentEpoch || this._currentEpoch.epochId !== epochId) return;
      this._finalize(this._currentEpoch.closesAt);
    }, this._epochMs);
  }

  _finalize(closedAt) {
    const epoch = this._currentEpoch;
    if (!epoch) return this.getSnapshot();
    this._clearTimer();
    const candidates = epoch.proposals.map((proposal) => proposal.candidate);
    const result = reduceInterventionAdmission(
      createInterventionAdmissionState({ globalMinimumGapMs: 0 }),
      {
        type: INTERVENTION_ADMISSION_EVENTS.REQUESTED,
        now: closedAt,
        candidates,
      },
    );
    const shadowWinner = result.winner?.candidate || null;
    const actualWinnerProposal = epoch.proposals.find(
      (proposal) => proposal.actual.accepted === true,
    ) || null;
    const actualWinner = actualWinnerProposal?.candidate || null;
    const distinctKinds = new Set(
      epoch.proposals.map((proposal) => proposal.candidate.kind),
    );
    const comparable = shadowWinner !== null && actualWinner !== null;
    this._lastCompletedEpoch = Object.freeze({
      epochId: epoch.epochId,
      openedAt: epoch.openedAt,
      closedAt,
      collision: distinctKinds.size > 1,
      comparable,
      agreement: comparable
        ? shadowWinner.requestId === actualWinner.requestId
        : null,
      actualWinner: actualWinner
        ? Object.freeze({
            requestId: actualWinner.requestId,
            kind: actualWinner.kind,
          })
        : null,
      shadowWinner: shadowWinner
        ? Object.freeze({
            requestId: shadowWinner.requestId,
            kind: shadowWinner.kind,
          })
        : null,
      proposals: Object.freeze(epoch.proposals.map(freezeProposal)),
      decisions: result.decisions,
    });
    this._currentEpoch = null;
    this._notify('epoch_completed');
    return this.getSnapshot();
  }

  _clearTimer() {
    if (this._timerHandle === null) return;
    const handle = this._timerHandle;
    this._timerHandle = null;
    this._cancel(handle);
  }

  _notify(reason) {
    const snapshot = this.getSnapshot();
    this._subscribers.forEach((subscriber) => {
      try {
        subscriber(snapshot, { reason });
      } catch (error) {
        console.warn?.('[InterventionAdmissionShadow] subscriber failed', {
          reason,
          error: String(
            error?.message
              || error
              || 'INTERVENTION_ADMISSION_SHADOW_SUBSCRIBER_FAILED',
          ),
        });
      }
    });
  }
}

export default InterventionAdmissionShadow;
