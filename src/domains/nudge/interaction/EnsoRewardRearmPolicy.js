import {
  advanceRewardDriftEvidence,
  createRewardDriftEvidenceState,
  projectRewardDriftEvidence,
  summarizeRewardDriftEvidence,
} from '../attention/rewardDriftEvidence.js';

// Admission memory only. Reuses the existing accumulation law, but its reset
// boundary is a presentation fact. Never publish this state as observations.
export class EnsoRewardRearmPolicy {
  constructor() { this.clear(); }

  clear() {
    this._memory = null;
    this._scopeKey = null;
    this._presentationRevision = null;
    this._pending = false;
    this._pendingSince = 0;
    this._pendingReason = null;
    this._pendingClearedReason = null;
  }

  project({ scopeKey, presentationRevision, now, tuning, pendingMaxAgeMs }) {
    if (typeof scopeKey !== 'string' || !scopeKey
      || !Number.isSafeInteger(presentationRevision) || presentationRevision < 0
      || !Number.isFinite(now) || now < 0
      || !Number.isFinite(pendingMaxAgeMs) || pendingMaxAgeMs < 1000) {
      throw new Error('ENSO_REWARD_REARM_CONTEXT_INVALID');
    }
    if (this._presentationRevision !== null && presentationRevision < this._presentationRevision) {
      throw new Error('ENSO_REWARD_REARM_PRESENTATION_REVERSED');
    }
    if (this._memory === null || scopeKey !== this._scopeKey
      || presentationRevision !== this._presentationRevision) {
      const afterPresentation = this._presentationRevision !== null
        && presentationRevision !== this._presentationRevision;
      this._scopeKey = scopeKey;
      this._presentationRevision = presentationRevision;
      this._memory = createRewardDriftEvidenceState({ scopeKey, now });
      this.clearPending(afterPresentation ? 'enso_presentation' : null);
    }
    this._memory = projectRewardDriftEvidence(this._memory, { now, ...tuning });
    if (this._pending && now - this._pendingSince > pendingMaxAgeMs) this.clearPending('pending_expired');
    if (this._pending && this._memory.score < tuning.threshold) this.clearPending('evidence_receded');
    return this.getSnapshot(tuning);
  }

  record(context, { kind, confidence }) {
    this.project(context);
    this._memory = advanceRewardDriftEvidence(this._memory, { now: context.now, kind, confidence }, context.tuning);
    if (this._pending && this._memory.score < context.tuning.threshold) this.clearPending('evidence_receded');
    return this.getSnapshot(context.tuning);
  }

  armPending(now, reason) {
    if (this._pending) return;
    this._pending = true;
    this._pendingSince = now;
    this._pendingReason = reason;
    this._pendingClearedReason = null;
  }

  clearPending(reason) {
    this._pending = false;
    this._pendingSince = 0;
    this._pendingReason = null;
    this._pendingClearedReason = reason;
  }

  getSnapshot(tuning) {
    if (this._memory === null) throw new Error('ENSO_REWARD_REARM_NOT_INITIALIZED');
    const summary = summarizeRewardDriftEvidence(this._memory, tuning);
    return Object.freeze({
      kind: 'enso_reward_rearm',
      presentationRevision: this._presentationRevision,
      score: summary.score,
      lastIntervalMs: summary.lastIntervalMs,
      lastIntervalBucket: summary.lastIntervalBucket,
      lastDelta: summary.lastDelta,
      reason: summary.reason,
      pending: this._pending,
      pendingSince: this._pendingSince,
      pendingReason: this._pendingReason,
      pendingClearedReason: this._pendingClearedReason,
    });
  }
}
