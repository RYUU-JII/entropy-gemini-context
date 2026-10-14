import { toCount, toNumber } from './sitePullMath.js';

// This projection admits observations only. Feed pressure/interrupt are detector
// decisions and remain in historical facts; they are not inputs to interpretation.
// Supply, skimming and scroll velocity can describe the same progression, so
// their transformations share one lineage even when separate sensors report them.
export function resolveSitePullContentFlowObservations(behavior = {}) {
  const observations = {
    feedAdvanceBursts: toCount(behavior.feedAdvanceBursts),
    feedSkimSignals: toCount(behavior.feedSkimSignals),
    fastScrollBursts: toCount(behavior.fastScrollBursts),
    scrollSpikeBursts: toCount(behavior.scrollSpikeBursts),
    maxFeedScreenfuls: Math.max(0, toNumber(behavior.maxFeedScreenfuls)),
    maxFeedItemTransitions: toCount(behavior.maxFeedItemTransitions),
    shortMediaAttentionSignals: toCount(behavior.shortMediaAttentionSignals),
    shortMediaWatchMs: Math.max(0, toNumber(behavior.shortMediaWatchMs)),
  };
  const hasFeedProgressionFacts = observations.feedAdvanceBursts > 0
    || observations.feedSkimSignals > 0
    || observations.fastScrollBursts > 0
    || observations.scrollSpikeBursts > 0
    || observations.maxFeedScreenfuls > 0
    || observations.maxFeedItemTransitions > 0;

  return {
    ...observations,
    hasFeedProgressionFacts,
    hasContentFlowFacts: hasFeedProgressionFacts
      || observations.shortMediaAttentionSignals > 0
      || observations.shortMediaWatchMs > 0,
    // Media attention has no qualifying feed-loop interpretation here. It does
    // not become an extra corroborating family merely because it was recorded.
    evidenceFamilyIds: hasFeedProgressionFacts ? ['feed_progression'] : [],
  };
}
