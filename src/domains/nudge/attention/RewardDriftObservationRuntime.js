import {
  advanceRewardDriftEvidence,
  copyRewardDriftTuning,
  createRewardDriftEvidenceState,
  projectRewardDriftEvidence,
  summarizeRewardDriftEvidence,
} from './rewardDriftEvidence.js';

function requireScopeKey(scopeKey) {
  if (typeof scopeKey !== 'string' || !scopeKey.trim()) {
    throw new Error('REWARD_DRIFT_OBSERVATION_SCOPE_INVALID');
  }
  return scopeKey.trim();
}

function requireNow(now) {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error('REWARD_DRIFT_OBSERVATION_TIMESTAMP_INVALID');
  }
  return Math.round(now);
}

function sameTuning(left, right) {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

// Content-local transition facts. Presentation, admission and rearm policy have
// no mutation seam here. Projection never replaces the last committed raw state.
export class RewardDriftObservationRuntime {
  constructor() {
    this.clear();
  }

  configure({ scopeKey, now = Date.now(), tuning = {} } = {}) {
    const nextScopeKey = requireScopeKey(scopeKey);
    const ts = requireNow(now);
    const nextTuning = copyRewardDriftTuning(tuning);
    if (!this._evidence || this._evidence.scopeKey !== nextScopeKey) {
      this._evidence = createRewardDriftEvidenceState({ scopeKey: nextScopeKey, now: ts });
      this._tuning = nextTuning;
    } else {
      this._assertCurrentTime(ts);
      if (!sameTuning(this._tuning, nextTuning)) {
        // A real configuration change is an event: finish the preceding period
        // under its old tuning before installing the new tuning. Repeated reads
        // with unchanged config do not create projection checkpoints.
        this._evidence = projectRewardDriftEvidence(this._evidence, { ...this._tuning, now: ts });
        this._tuning = nextTuning;
      }
    }
    return this.getEvidence({ now: ts });
  }

  recordTransition({ scopeKey, now = Date.now(), kind, confidence = 0, tuning = {} } = {}) {
    if (kind !== 'reward_entry' && kind !== 'reward_continuation') {
      throw new Error('REWARD_DRIFT_OBSERVATION_TRANSITION_KIND_INVALID');
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('REWARD_DRIFT_OBSERVATION_CONFIDENCE_INVALID');
    }
    const ts = requireNow(now);
    this.configure({ scopeKey, now: ts, tuning });
    this._evidence = advanceRewardDriftEvidence(this._evidence, { now: ts, kind, confidence }, this._tuning);
    return this.getEvidence({ now: ts });
  }

  getEvidence({ now = Date.now() } = {}) {
    if (!this._evidence) return null;
    const ts = requireNow(now);
    this._assertCurrentTime(ts);
    const projected = projectRewardDriftEvidence(this._evidence, { ...this._tuning, now: ts });
    return summarizeRewardDriftEvidence(projected, this._tuning);
  }

  hasObservation() {
    return this._evidence !== null;
  }

  clear() {
    this._evidence = null;
    this._tuning = null;
  }

  _assertCurrentTime(now) {
    if (now < this._evidence.lastProjectedAt) {
      throw new Error('REWARD_DRIFT_OBSERVATION_TIME_REVERSED');
    }
  }
}

export default RewardDriftObservationRuntime;
