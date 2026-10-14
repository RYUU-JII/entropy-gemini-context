/**
 * FeedTerminusStageMachine — projects an Enso episode admission onto the
 * feed-local horizon presentation.
 *
 * This module does not infer feed demand. Supply geometry, progression,
 * intentionality, structure learning, and actuation safety are decided
 * upstream by FeedFlowRuntime. Presentation admission is owned separately by
 * the Enso runtime episode, so FeedFlow state alone can never dry the feed.
 *
 * The machine owns only still-gate escalation for fresh terminus entries.
 * Cross-episode silence and repeat cooldown belong exclusively to the shared
 * Enso spawn policy.
 */

const DEFAULT_OPTIONS = Object.freeze({
  gateBaseMs: 1000,
  gateStepMs: 800,
  gateMaxMs: 4000,
});

const BLOCKING_READINESS_STATES = new Set([
  'pending',
  'warming',
  'volatile',
  'invalid',
]);

function toFinite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toPositive(value, fallback = 0) {
  return Math.max(0, toFinite(value, fallback));
}

function normalizeDecisionState(value) {
  return value === 'none' || value === 'pressure' || value === 'interrupt'
    ? value
    : 'none';
}

function readStatus(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value && typeof value === 'object' && typeof value.status === 'string') {
    return value.status.trim().toLowerCase();
  }
  return '';
}

function resolveReadinessStatus(decision) {
  const readinessStatus = readStatus(decision?.readiness);
  if (!readinessStatus) return 'missing';
  if (BLOCKING_READINESS_STATES.has(readinessStatus)) return readinessStatus;
  if (readinessStatus === 'ready') return 'ready';
  return 'invalid';
}

function classifyAuthority(feedDecision, admission) {
  const state = normalizeDecisionState(feedDecision?.state);
  const safetyStatus = readStatus(feedDecision?.actuationSafety) || 'missing';
  const readinessStatus = resolveReadinessStatus(feedDecision);
  const admissionStatus = readStatus(admission?.status) || 'missing';
  const reasons = [];

  if (admissionStatus !== 'admitted' || admission?.admitted !== true) {
    reasons.push(`enso_episode_${admissionStatus}`);
  }
  if (feedDecision?.opportunityReady !== true || state !== 'interrupt') {
    reasons.push('feed_horizon_opportunity_pending');
  }
  if (safetyStatus !== 'safe') reasons.push(`actuation_${safetyStatus}`);
  if (readinessStatus !== 'ready') {
    reasons.push(`readiness_${readinessStatus}`);
  }
  return {
    state,
    safetyStatus,
    readinessStatus,
    admissionStatus,
    allowed: reasons.length === 0,
    reasons,
  };
}

export class FeedTerminusStageMachine {
  constructor(options = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...(options && typeof options === 'object' ? options : {}) };
    this._gateBaseMs = toPositive(merged.gateBaseMs, DEFAULT_OPTIONS.gateBaseMs);
    this._gateStepMs = toPositive(merged.gateStepMs, DEFAULT_OPTIONS.gateStepMs);
    this._gateMaxMs = Math.max(
      this._gateBaseMs,
      toPositive(merged.gateMaxMs, DEFAULT_OPTIONS.gateMaxMs),
    );
    this.reset();
  }

  reset() {
    this._stage = 'idle';
    this._terminusCount = 0;
    this._terminusEnteredAt = 0;
    this._gateMs = this._gateBaseMs;
  }

  get terminusCount() {
    return this._terminusCount;
  }

  _gateForCount(count) {
    const n = Math.max(1, count);
    return Math.min(this._gateMaxMs, this._gateBaseMs + (n - 1) * this._gateStepMs);
  }

  /**
   * @param {object} input Enso admission plus feed-local capability decision.
   * @param {number} [now]
   * @returns {{stage:'idle'|'terminus', terminusCount:number, gateMs:number,
   *            terminusEnteredAt:number, enteredTerminus:boolean,
   *            decisionState:string, safetyStatus:string,
   *            readinessStatus:string, reasons:string[]}}
   */
  evaluate({ feedDecision = null, admission = null } = {}, now = Date.now()) {
    const normalizedNow = Math.max(0, toFinite(now, Date.now()));
    const authority = classifyAuthority(
      feedDecision,
      admission,
    );
    const wasTerminus = this._stage === 'terminus';
    const stage = authority.allowed ? 'terminus' : 'idle';

    let enteredTerminus = false;
    if (stage === 'terminus' && !wasTerminus) {
      this._terminusCount += 1;
      this._terminusEnteredAt = normalizedNow;
      this._gateMs = this._gateForCount(this._terminusCount);
      enteredTerminus = true;
    }

    this._stage = stage;

    return {
      stage,
      terminusCount: this._terminusCount,
      gateMs: this._gateMs,
      terminusEnteredAt: this._terminusEnteredAt,
      enteredTerminus,
      decisionState: authority.state,
      safetyStatus: authority.safetyStatus,
      readinessStatus: authority.readinessStatus,
      admissionStatus: authority.admissionStatus,
      reasons: authority.reasons,
    };
  }
}

export default FeedTerminusStageMachine;
