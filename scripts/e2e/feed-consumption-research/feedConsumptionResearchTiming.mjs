import {
  ENSO_FEED_SURFACE_ENTRY_GRACE_MS,
} from '../../../src/domains/nudge/interaction/EnsoFeedSurfaceEntryGrace.js';
import {
  resolveEnsoFeedEpisodeAdmission,
} from '../../dev/enso-model-research/legacy-feed/ensoFeedEpisodeAdmission.js';
import {
  CLICK_REWARD_DRIFT_FIRST_GRACE_MS,
} from '../../../src/domains/nudge/interaction/interactionConstants.js';
import {
  FEED_CONSUMPTION_RESEARCH_SURFACE_MODES,
} from './feedConsumptionResearchContract.mjs';

export const FEED_CONSUMPTION_RESEARCH_TIMING_PROJECTION_VERSION = 2;

function createClearedSpawnPolicyDecision() {
  return Object.freeze({
    source: 'feed_horizon',
    allowed: true,
    reason: 'available',
    firstGraceRemainingMs: 0,
    cooldownRemainingMs: 0,
    lastPresentedSource: null,
    activeEpisode: null,
  });
}

function createClearedSurfaceEntryGraceDecision(surfaceMode) {
  return Object.freeze({
    semanticSurfaceId: `research:${surfaceMode}`,
    enteredAt: 0,
    graceMs: 0,
    remainingMs: 0,
    allowed: true,
    reason: 'available',
  });
}

function createProjectedFeedHorizonOpportunity(feedDecision) {
  return Object.freeze({
    ...feedDecision,
    state: 'interrupt',
    armed: true,
    opportunityReady: true,
    inhibitors: Object.freeze([]),
    seam: Object.freeze({
      fire: true,
      decision: 'research_projected_confirmed_advance_seam',
    }),
  });
}

/**
 * Research-only counterfactual: preserve the current detector and endpoint
 * readiness/safety facts while asking whether the same checkpoint would be
 * admissible in a mature session at an otherwise eligible Feed Horizon seam.
 * The projected seam is explicit because the deterministic detector replay has
 * no production FeedFlow cadence owner. It neither advances a virtual clock nor
 * mutates production state, and must never be reported as an observed gate.
 */
export function projectMatureSessionFeedAdmission({
  surfaceMode,
  detection = null,
  feedDecision = null,
  now = Date.now(),
} = {}) {
  if (!FEED_CONSUMPTION_RESEARCH_SURFACE_MODES.includes(surfaceMode)) {
    throw new Error(
      `FEED_CONSUMPTION_RESEARCH_TIMING_SURFACE_INVALID:${String(surfaceMode || '')}`,
    );
  }
  const missingInputs = [
    detection ? null : 'detection_missing',
    feedDecision ? null : 'feed_decision_missing',
  ].filter(Boolean);
  const assumptions = Object.freeze({
    projectionKind: 'mature_session_feed_horizon_opportunity',
    configuredSurfaceEntryGraceMs: ENSO_FEED_SURFACE_ENTRY_GRACE_MS,
    defaultFirstGraceMs: CLICK_REWARD_DRIFT_FIRST_GRACE_MS,
    surfaceEntryGrace: 'clear',
    firstGrace: 'clear',
    cooldown: 'clear',
    activeEpisode: 'none',
    feedHorizonSensing: 'projected_armed',
    feedHorizonSeam: 'projected_confirmed_advance',
    feedHorizonInhibitors: 'clear',
    currentDetectorEvidencePreserved: true,
    currentEndpointReadinessSafetyPreserved: true,
    virtualClockAdvanced: false,
  });
  if (missingInputs.length > 0) {
    return Object.freeze({
      version: FEED_CONSUMPTION_RESEARCH_TIMING_PROJECTION_VERSION,
      authority: 'research_only',
      status: 'unavailable',
      productionInfluence: false,
      assumptions,
      reasons: Object.freeze(missingInputs),
      admission: null,
    });
  }
  const admission = resolveEnsoFeedEpisodeAdmission({
    detection,
    feedDecision: createProjectedFeedHorizonOpportunity(feedDecision),
    spawnPolicyDecision: createClearedSpawnPolicyDecision(),
    surfaceEntryGraceDecision: createClearedSurfaceEntryGraceDecision(surfaceMode),
    now,
  });
  return Object.freeze({
    version: FEED_CONSUMPTION_RESEARCH_TIMING_PROJECTION_VERSION,
    authority: 'research_only',
    status: 'projected',
    productionInfluence: false,
    assumptions,
    reasons: Object.freeze([]),
    admission,
  });
}
