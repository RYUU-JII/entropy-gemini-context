import {
  clamp01,
  smooth01,
} from '../sitePullMath.js';
import { resolveSitePullContentFlowObservations } from '../sitePullContentFlowObservations.js';

export const SITE_PULL_CONTENT_FLOW_EVIDENCE_PROFILE_VERSION =
  'site-pull-content-flow-evidence-profile-v3';

export const SITE_PULL_CONTENT_FLOW_STATUSES = Object.freeze({
  INSUFFICIENT_CONTENT_FLOW_EVIDENCE: 'insufficient_content_flow_evidence',
  CONTENT_FLOW_CONTEXT: 'content_flow_context',
  FEED_SUPPLY_CONTEXT: 'feed_supply_context',
  FAST_SKIMMING_CONTEXT: 'fast_skimming_context',
});

const MIN_FEED_LOOP_SCORE = 0.58;

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function buildCaveats({
  behavior,
  feedSupplyChannel,
  skimChannel,
  scrollVelocityChannel,
}) {
  const caveats = [];
  if (!behavior.hasBehaviorFacts) caveats.push('behavior_facts_unavailable');
  if (feedSupplyChannel) caveats.push('feed_supply_signal_site_dependent');
  if (scrollVelocityChannel && !skimChannel) caveats.push('scroll_velocity_without_skim_context');
  if (skimChannel && !feedSupplyChannel) caveats.push('skim_signal_without_supply_context');
  if (feedSupplyChannel || skimChannel || scrollVelocityChannel) {
    caveats.push('feed_progression_signals_share_lineage');
    caveats.push('independent_feed_loop_evidence_unavailable');
  }
  return caveats;
}

function resolveStatus({
  hasContentFlowFacts,
  feedLoopScore,
  feedSupplyChannel,
  skimChannel,
  scrollVelocityChannel,
}) {
  if (!hasContentFlowFacts || feedLoopScore < 0.35) {
    return SITE_PULL_CONTENT_FLOW_STATUSES.INSUFFICIENT_CONTENT_FLOW_EVIDENCE;
  }
  if (feedSupplyChannel && feedLoopScore >= MIN_FEED_LOOP_SCORE) {
    return SITE_PULL_CONTENT_FLOW_STATUSES.FEED_SUPPLY_CONTEXT;
  }
  if ((skimChannel || scrollVelocityChannel) && feedLoopScore >= 0.45) {
    return SITE_PULL_CONTENT_FLOW_STATUSES.FAST_SKIMMING_CONTEXT;
  }
  return SITE_PULL_CONTENT_FLOW_STATUSES.CONTENT_FLOW_CONTEXT;
}

export function buildSitePullContentFlowEvidenceProfile({
  facts = {},
} = {}) {
  const behavior = facts?.behavior || {};
  const observations = resolveSitePullContentFlowObservations(behavior);
  const {
    feedAdvanceBursts,
    feedSkimSignals,
    fastScrollBursts,
    scrollSpikeBursts,
    shortMediaAttentionSignals,
    shortMediaWatchMs,
    maxFeedScreenfuls,
    maxFeedItemTransitions,
    evidenceFamilyIds,
  } = observations;
  const scrollBurstCount = Math.max(fastScrollBursts, scrollSpikeBursts);
  const feedSupplyScore = Math.max(smooth01(feedAdvanceBursts, 1, 4),
    smooth01(maxFeedScreenfuls, 3, 8) * 0.85, smooth01(maxFeedItemTransitions, 4, 14) * 0.9);
  const skimScore = Math.max(smooth01(feedSkimSignals, 1, 3),
    smooth01(maxFeedItemTransitions, 6, 18) * 0.8, smooth01(maxFeedScreenfuls, 4, 10) * 0.75);
  const scrollVelocityScore = Math.max(smooth01(fastScrollBursts, 1, 4),
    smooth01(scrollSpikeBursts, 2, 8) * 0.88);
  const feedSupplyChannel = feedAdvanceBursts >= 2
    || maxFeedScreenfuls >= 5
    || maxFeedItemTransitions >= 8;
  const skimChannel = feedSkimSignals >= 1;
  const scrollVelocityChannel = fastScrollBursts >= 2 || scrollSpikeBursts >= 4;
  const corroboratingEvidenceFamilyCount = evidenceFamilyIds.length;
  // Overlapping descriptions may explain intensity; they cannot corroborate
  // each other. No alias-count or detector-decision bonus enters this score.
  const feedLoopScore = Math.max(feedSupplyScore, skimScore, scrollVelocityScore * 0.88);
  const hasContentFlowFacts = Boolean(
    behavior.hasBehaviorFacts
    && observations.hasContentFlowFacts
  );
  const status = resolveStatus({
    hasContentFlowFacts,
    feedLoopScore,
    feedSupplyChannel,
    skimChannel,
    scrollVelocityChannel,
  });
  const canEmitFeedLoopComposite = Boolean(
    hasContentFlowFacts
    && feedLoopScore >= MIN_FEED_LOOP_SCORE
    && status !== SITE_PULL_CONTENT_FLOW_STATUSES.INSUFFICIENT_CONTENT_FLOW_EVIDENCE
    && corroboratingEvidenceFamilyCount >= 2
  );
  const canEmitSkimSupport = Boolean(
    hasContentFlowFacts
    && (skimChannel || (feedSkimSignals >= 1 && maxFeedItemTransitions >= 4))
  );
  const canEmitScrollSupport = Boolean(
    hasContentFlowFacts
    && scrollVelocityChannel
  );

  return {
    version: SITE_PULL_CONTENT_FLOW_EVIDENCE_PROFILE_VERSION,
    status,
    score: round4(feedLoopScore),
    confidence: hasContentFlowFacts ? 0.74 : 0,
    canEmitFeedLoopComposite,
    canEmitSkimSupport,
    canEmitScrollSupport,
    evidence: {
      evidenceWindow: 'today', temporalAssociation: 'day_cooccurrence', orderedSequenceObserved: false,
      contentFlowStatus: status,
      contentFlowScore: round4(feedLoopScore),
      feedSupplyScore: round4(feedSupplyScore),
      skimScore: round4(skimScore),
      scrollVelocityScore: round4(scrollVelocityScore),
      feedAdvanceBursts,
      feedSkimSignals,
      shortMediaAttentionSignals,
      shortMediaWatchMs,
      fastScrollBursts,
      scrollSpikeBursts,
      maxFeedScreenfuls,
      maxFeedItemTransitions,
      scrollBurstCount,
      corroboratingEvidenceFamilyIds: evidenceFamilyIds,
      corroboratingEvidenceFamilyCount,
      feedSupplyChannel,
      skimChannel,
      scrollVelocityChannel,
      hasContentFlowFacts,
      caveats: buildCaveats({
        behavior,
        feedSupplyChannel,
        skimChannel,
        scrollVelocityChannel,
      }),
    },
  };
}
