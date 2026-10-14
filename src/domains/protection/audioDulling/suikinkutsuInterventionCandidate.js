import {
  MEDIA_CONSUMPTION_EVIDENCE_KIND,
  MEDIA_CONSUMPTION_EVIDENCE_VERSION,
} from '../../nudge/media/mediaConsumptionEvidence.js';

export const SUIKINKUTSU_INTERVENTION_KIND = 'suikinkutsu';
export const SUIKINKUTSU_INTERVENTION_PRIORITY = 30;

const DEFAULT_CANDIDATE_TTL_MS = 2_000;

function normalizeNow(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function normalizeDuration(value, label) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`${label}:${String(value)}`);
  }
  return numeric;
}

function requireMediaEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('SUIKINKUTSU_MEDIA_EVIDENCE_REQUIRED');
  }
  if (
    evidence.version !== MEDIA_CONSUMPTION_EVIDENCE_VERSION
    || evidence.kind !== MEDIA_CONSUMPTION_EVIDENCE_KIND
  ) {
    throw new Error('SUIKINKUTSU_MEDIA_EVIDENCE_CONTRACT_INVALID');
  }
  return evidence;
}

export function evaluateSuikinkutsuInterventionCandidate({
  mediaEvidence,
  now = mediaEvidence?.observedAt,
  revealDelayMs = 0,
  candidateTtlMs = DEFAULT_CANDIDATE_TTL_MS,
} = {}) {
  const evidence = requireMediaEvidence(mediaEvidence);
  const evaluatedAt = normalizeNow(now, 'SUIKINKUTSU_CANDIDATE_NOW_INVALID');
  const delayMs = normalizeDuration(
    revealDelayMs,
    'SUIKINKUTSU_CANDIDATE_REVEAL_DELAY_INVALID',
  );
  const ttlMs = normalizeDuration(
    candidateTtlMs,
    'SUIKINKUTSU_CANDIDATE_TTL_INVALID',
  );
  const evidenceValidUntil = normalizeNow(
    evidence.validUntil,
    'SUIKINKUTSU_MEDIA_EVIDENCE_VALID_UNTIL_INVALID',
  );
  if (evidenceValidUntil <= evaluatedAt) {
    return Object.freeze({
      eligible: false,
      reason: 'media_evidence_stale',
      evaluatedAt,
      notBefore: 0,
      candidate: null,
    });
  }
  const audibleCandidateCount = normalizeDuration(
    evidence.audibleCandidateCount,
    'SUIKINKUTSU_MEDIA_EVIDENCE_AUDIBLE_COUNT_INVALID',
  );
  if (evidence.audibleCandidate !== true || audibleCandidateCount <= 0) {
    return Object.freeze({
      eligible: false,
      reason: 'audible_media_inactive',
      evaluatedAt,
      notBefore: 0,
      candidate: null,
    });
  }
  const activeSince = normalizeNow(
    evidence.activeSince,
    'SUIKINKUTSU_CANDIDATE_ACTIVE_SINCE_INVALID',
  );
  if (activeSince <= 0 || activeSince > evaluatedAt) {
    throw new Error('SUIKINKUTSU_CANDIDATE_ACTIVE_SINCE_UNAVAILABLE');
  }
  const notBefore = activeSince + delayMs;
  if (evaluatedAt < notBefore) {
    return Object.freeze({
      eligible: false,
      reason: 'sustained_media_pending',
      evaluatedAt,
      notBefore,
      candidate: null,
    });
  }
  const evidenceRevision = normalizeDuration(
    evidence.evidenceRevision,
    'SUIKINKUTSU_CANDIDATE_EVIDENCE_REVISION_INVALID',
  );
  return Object.freeze({
    eligible: true,
    reason: 'audible_media_sustained',
    evaluatedAt,
    notBefore,
    candidate: Object.freeze({
      requestId: `suikinkutsu:${activeSince}:${evidenceRevision}`,
      kind: SUIKINKUTSU_INTERVENTION_KIND,
      requestedAt: evaluatedAt,
      validUntil: Math.min(evidenceValidUntil, evaluatedAt + ttlMs),
      evidenceRevision,
      priority: SUIKINKUTSU_INTERVENTION_PRIORITY,
      weight: 1,
      exclusivity: 'exclusive',
    }),
  });
}

export default evaluateSuikinkutsuInterventionCandidate;
