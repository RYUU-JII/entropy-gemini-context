import { resolveEnsoFeedSemanticSurfaceId } from './EnsoFeedSurfaceEntryGrace.js';


function readStatus(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value)));
}

function requireSurfaceEntryGraceDecision(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_MISSING');
  }
  const semanticSurfaceId = resolveEnsoFeedSemanticSurfaceId(value);
  const enteredAt = Math.round(value.enteredAt);
  const graceMs = Math.round(value.graceMs);
  const remainingMs = Math.round(value.remainingMs);
  const reason = readStatus(value.reason, 'missing');
  if (typeof value.enteredAt !== 'number' || !Number.isFinite(enteredAt) || enteredAt < 0) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_ENTERED_AT_INVALID');
  }
  if (typeof value.graceMs !== 'number' || !Number.isFinite(graceMs) || graceMs < 0) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_DURATION_INVALID');
  }
  if (typeof value.remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs < 0) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_REMAINING_INVALID');
  }
  if (value.allowed !== true && value.allowed !== false) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_ALLOWED_INVALID');
  }
  if (value.allowed === true && remainingMs !== 0) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_ALLOWED_INCONSISTENT');
  }
  if (value.allowed === false && remainingMs === 0) {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_BLOCKED_INCONSISTENT');
  }
  if (value.allowed === true && reason !== 'available') {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_REASON_INCONSISTENT');
  }
  if (value.allowed === false && reason !== 'surface_entry_grace_active') {
    throw new Error('ENSO_FEED_SURFACE_GRACE_DECISION_REASON_INCONSISTENT');
  }
  return Object.freeze({
    semanticSurfaceId,
    enteredAt,
    graceMs,
    remainingMs,
    allowed: value.allowed === true,
    reason,
  });
}

/**
 * Combines the background consumption receipt, a fresh local boundary and
 * endpoint capability. This local decision cannot replace the shared lease.
 */
export function resolveEnsoFeedEpisodeAdmission({
  manual = false,
  feedDecision = null,
  spawnPolicyDecision = null,
  surfaceEntryGraceDecision = null,
  now = Date.now(),
} = {}) {
  const evaluatedAt = Math.max(0, Math.round(Number(now) || Date.now()));
  const surfaceEntryGrace = requireSurfaceEntryGraceDecision(surfaceEntryGraceDecision);
  const readinessStatus = readStatus(feedDecision?.readiness?.status, 'pending');
  const safetyStatus = readStatus(feedDecision?.actuationSafety?.status, 'pending');
  const capability = readStatus(feedDecision?.actuationSafety?.capability, 'observe_only');
  const spawnPolicyReason = readStatus(spawnPolicyDecision?.reason, 'missing');
  const reasons = [];
  let blockedAt = null;
  const block = (stage, reason) => {
    blockedAt ||= stage;
    reasons.push(reason);
  };

  if (!manual && feedDecision?.cadence?.eligible !== true) block('timing', feedDecision?.cadence?.reason || 'enso_cadence_unavailable');
  if (feedDecision?.opportunityReady !== true || feedDecision?.state !== 'interrupt') {
    block('opportunity', 'feed_horizon_opportunity_pending');
  }
  if (readinessStatus !== 'ready') block('capability', `feed_readiness_${readinessStatus}`);
  if (safetyStatus !== 'safe') block('capability', `feed_actuation_${safetyStatus}`);
  if (capability === 'observe_only') block('capability', 'feed_endpoint_observe_only');
  if (!surfaceEntryGrace.allowed) block('timing', 'enso_feed_surface_entry_grace_active');
  if (spawnPolicyDecision?.source !== 'feed_horizon') {
    block('timing', 'enso_spawn_policy_source_invalid');
  } else if (spawnPolicyDecision?.allowed !== true) {
    block('timing', `enso_spawn_policy_${spawnPolicyReason}`);
  }

  const admitted = reasons.length === 0;
  return Object.freeze({
    version: 1,
    status: admitted ? 'admitted' : 'withheld',
    admitted,
    blockedAt,
    decisionId: feedDecision?.decisionId ?? null,
    source: 'enso_consumption_cadence',
    episodeKind: 'feed_horizon',
    evaluatedAt,
    confidence: feedDecision?.confidence ?? null,
    cadence: feedDecision?.cadence ?? null,
    capability,
    readinessStatus,
    safetyStatus,
    surfaceEntryGrace,
    spawnPolicy: Object.freeze({
      allowed: spawnPolicyDecision?.allowed === true,
      reason: spawnPolicyReason,
      lastPresentedSource: typeof spawnPolicyDecision?.lastPresentedSource === 'string'
        ? spawnPolicyDecision.lastPresentedSource
        : null,
      activeEpisodeSource: typeof spawnPolicyDecision?.activeEpisode?.source === 'string'
        ? spawnPolicyDecision.activeEpisode.source
        : null,
      activeEpisodePhase: typeof spawnPolicyDecision?.activeEpisode?.phase === 'string'
        ? spawnPolicyDecision.activeEpisode.phase
        : null,
    }),
    reasons: Object.freeze(uniqueStrings(
      admitted ? ['enso_feed_episode_admitted'] : reasons,
    )),
  });
}

// Completes the same admission result after its effectful reservation/surface
// boundaries. Never leave a successful local preflight as the final verdict.
export function withholdEnsoFeedEpisodeAdmission(admission, { stage, reason, pending = false }) {
  if (!admission || !['reservation', 'surface'].includes(stage)
    || typeof reason !== 'string' || reason.length === 0) {
    throw new Error('ENSO_FEED_ADMISSION_WITHHOLD_INVALID');
  }
  return Object.freeze({ ...admission, status: pending ? 'pending' : 'withheld', admitted: false,
    blockedAt: stage, reasons: Object.freeze([reason]) });
}

export function isEnsoFeedEpisodeAdmissionActive(admission = null) {
  return admission?.status === 'admitted' && admission?.admitted === true;
}
