import {
  SITE_PULL_MINUTE_MS,
  clamp,
  clamp01,
  countActiveHours,
  durationNorm,
  maxRollingSum,
  smooth01,
  toNumber,
} from '../sitePullMath.js';
import { buildSitePullSustainedBlockEvidenceProfile } from './sitePullSustainedBlockEvidenceProfile.js';
import { resolveSitePullSessionShape } from './sitePullSessionFactSource.js';
import { resolveSitePullContentFlowObservations } from '../sitePullContentFlowObservations.js';

export const SITE_PULL_IMMERSION_EVIDENCE_PROFILE_VERSION = 'site-pull-immersion-evidence-profile-v3';

export const SITE_PULL_IMMERSION_STATUSES = Object.freeze({
  INSUFFICIENT: 'insufficient_immersion_evidence',
  LONG_SESSION_OBSERVED: 'long_session_observed',
  LONG_SESSION_WITH_MOVEMENT: 'long_session_with_movement',
  LONG_SESSION_WITH_RETURNS: 'long_session_with_returns',
});

const MIN_TOTAL_MS = 35 * SITE_PULL_MINUTE_MS;
const MIN_SUSTAINED_BLOCK_MS = 30 * SITE_PULL_MINUTE_MS;
const MIN_DURATION_CONCENTRATION = 0.42;
const MIN_ABSORPTION_SCORE = 0.58;
const MIN_SUPPORT_SCORE = 0.32;
const MIN_RETURN_CONTEXT_SCORE = 0.48;
const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function createImmersionEvidenceSourceError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function resolveNavigationFacts(facts = {}) {
  if (!hasOwn(facts, 'navigation')) return {};
  if (isObjectRecord(facts.navigation)) return facts.navigation;
  throw createImmersionEvidenceSourceError('SITE_PULL_IMMERSION_NAVIGATION_FACTS_INVALID', {
    factKey: 'navigation',
  });
}

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function round2(value) {
  return Number(clamp01(value).toFixed(2));
}

function round4(value) {
  return Number(clamp01(value).toFixed(4));
}

function resolveSessionShape(_featureVector, facts) {
  return resolveSitePullSessionShape(facts, { errorCode: 'SITE_PULL_IMMERSION_SESSION_FACTS_INVALID' });
}

function buildDurationConcentration({
  activeHoursToday,
  blockShare,
  session,
  sustainedBlockMs,
  todayTotalMs,
}) {
  const longSessionRatio = session.sessionCount > 0
    ? session.longSessionCount / session.sessionCount
    : 0;
  const blockDurationScore = durationNorm(sustainedBlockMs, 30, 150);
  const blockShareScore = smooth01(blockShare, 0.45, 0.85);
  const totalDurationScore = durationNorm(todayTotalMs, 45, 180);
  const sessionDepthScore = Math.max(
    durationNorm(session.maxSessionMs, 30, 120),
    durationNorm(session.averageSessionMs, 18, 75) * 0.8,
    smooth01(longSessionRatio, 0.2, 0.75) * 0.7,
  );
  const compactnessScore = activeHoursToday > 0
    ? 1 - smooth01(activeHoursToday, 5, 12)
    : 0;

  return {
    blockDurationScore,
    blockShareScore,
    totalDurationScore,
    sessionDepthScore,
    compactnessScore,
    durationConcentrationScore: clamp01(
      (blockDurationScore * 0.42)
      + (blockShareScore * 0.26)
      + (totalDurationScore * 0.18)
      + (sessionDepthScore * 0.1)
      + (compactnessScore * 0.04),
    ),
  };
}

function buildFeedContinuity(behavior = {}) {
  const {
    feedAdvanceBursts,
    feedSkimSignals,
    fastScrollBursts,
    scrollSpikeBursts,
    maxFeedScreenfuls,
    maxFeedItemTransitions,
    hasFeedProgressionFacts,
  } = resolveSitePullContentFlowObservations(behavior);
  const scrollBursts = Math.max(fastScrollBursts, scrollSpikeBursts);

  return {
    hasFeedFacts: hasFeedProgressionFacts,
    feedAdvanceBursts,
    feedSkimSignals,
    fastScrollBursts,
    scrollSpikeBursts,
    maxFeedScreenfuls,
    maxFeedItemTransitions,
    feedContinuityScore: Math.max(
      smooth01(feedAdvanceBursts, 1, 8) * 0.8,
      smooth01(feedSkimSignals, 1, 6) * 0.65,
      smooth01(maxFeedItemTransitions, 6, 36) * 0.65,
      smooth01(maxFeedScreenfuls, 3, 14) * 0.5,
      smooth01(scrollBursts, 2, 14) * 0.5,
    ),
  };
}

function buildNavigationContinuity(navigation = {}, {
  activeHoursToday,
  todayTotalMs,
}) {
  const totalNavigations = toCount(navigation.total);
  const linkNavigations = toCount(navigation.link);
  const generatedNavigations = toCount(navigation.generated);
  const formSubmitNavigations = toCount(navigation.formSubmit);
  const forwardBackNavigations = toCount(navigation.forwardBack);
  const directLikeNavigations = toCount(navigation.typed)
    + toCount(navigation.addressBar)
    + toCount(navigation.keyword)
    + toCount(navigation.startPage)
    + toCount(navigation.autoBookmark)
    + toCount(navigation.reload);
  const movementNavigations = Math.max(
    linkNavigations + generatedNavigations + formSubmitNavigations + forwardBackNavigations,
    totalNavigations - directLikeNavigations,
    0,
  );
  const activeHours = Math.max(1, activeHoursToday);
  const activeMinutes = Math.max(1, todayTotalMs / SITE_PULL_MINUTE_MS);
  const movementPerActiveHour = movementNavigations / activeHours;
  const movementPerActiveMinute = movementNavigations / activeMinutes;
  const linkShare = totalNavigations > 0 ? linkNavigations / totalNavigations : 0;
  const hasNavigationFacts = navigation.hasNavigationFacts === true || totalNavigations > 0;

  return {
    hasNavigationFacts,
    totalNavigations,
    movementNavigations,
    linkNavigations,
    generatedNavigations,
    movementPerActiveHour,
    movementPerActiveMinute,
    linkShare,
    navigationContinuityScore: hasNavigationFacts
      ? clamp01(
          (smooth01(movementPerActiveHour, 3, 18) * 0.42)
          + (smooth01(movementNavigations, 4, 28) * 0.24)
          + (smooth01(movementPerActiveMinute, 0.04, 0.24) * 0.18)
          + (smooth01(linkShare, 0.25, 0.75) * 0.16),
        )
      : 0,
  };
}

function buildReturnContext({ behavior = {}, intervention = {} }) {
  const switchOuts = toCount(behavior.switchOuts);
  const switchIns = toCount(behavior.switchIns);
  const switchBackWithin10m = toCount(behavior.switchBackWithin10m);
  const revisitWithin10m = toCount(behavior.revisitWithin10m);
  const reenteredWithin5m = toCount(intervention.reenteredWithin5m);
  const reenteredWithin30m = toCount(intervention.reenteredWithin30m);
  const returnCount = Math.max(switchBackWithin10m, revisitWithin10m,
    intervention.hasInterventionFacts ? Math.max(reenteredWithin5m, reenteredWithin30m) : 0);
  const switchBackRate = switchIns > 0 ? switchBackWithin10m / switchIns : 0;
  return {
    switchOuts, switchIns, switchBackWithin10m, revisitWithin10m,
    reenteredWithin5m, reenteredWithin30m, returnCount,
    // Same-day returns are not evidence of an attempted exit or failed control.
    returnContextScore: Math.max(smooth01(returnCount, 1, 5),
      smooth01(switchBackRate, 0.2, 0.65) * smooth01(switchBackWithin10m, 1, 4)),
  };
}

function buildImmersionChannels({
  duration,
  feed,
  navigation,
  returns,
  sustainedBlockMs,
}) {
  const channelIds = [];
  const supportChannelIds = [];
  if (
    sustainedBlockMs >= MIN_SUSTAINED_BLOCK_MS
    && duration.durationConcentrationScore >= MIN_DURATION_CONCENTRATION
  ) {
    channelIds.push('sustained_block_shape');
  }
  if (feed.hasFeedFacts && feed.feedContinuityScore >= MIN_SUPPORT_SCORE) {
    channelIds.push('feed_continuity');
    supportChannelIds.push('feed_continuity');
  }
  if (navigation.hasNavigationFacts && navigation.navigationContinuityScore >= MIN_SUPPORT_SCORE) {
    channelIds.push('navigation_continuity');
    supportChannelIds.push('navigation_continuity');
  }
  if (returns.returnContextScore >= MIN_RETURN_CONTEXT_SCORE) {
    channelIds.push('same_day_returns');
    supportChannelIds.push('same_day_returns');
  }

  return {
    channelIds,
    supportChannelIds,
  };
}

function resolveStatus({ absorptionScore, consumptionContinuityScore, durationConcentrationScore,
  returnContextScore, todayTotalMs, sustainedBlockMs }) {
  if (todayTotalMs < MIN_TOTAL_MS || sustainedBlockMs < MIN_SUSTAINED_BLOCK_MS
    || durationConcentrationScore < MIN_DURATION_CONCENTRATION) {
    return SITE_PULL_IMMERSION_STATUSES.INSUFFICIENT;
  }
  if (absorptionScore >= MIN_ABSORPTION_SCORE && returnContextScore >= MIN_RETURN_CONTEXT_SCORE) {
    return SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_RETURNS;
  }
  if (absorptionScore >= MIN_ABSORPTION_SCORE && consumptionContinuityScore >= MIN_SUPPORT_SCORE) {
    return SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_MOVEMENT;
  }
  return SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_OBSERVED;
}

function buildCaveats({ feed, navigation, session }) {
  return [
    'intent_not_observed', 'day_level_context_not_linked_to_session',
    ...(!session.hasMeasuredSessionFacts ? ['measured_session_unavailable'] : []),
    ...(!feed.hasFeedFacts ? ['feed_facts_unavailable'] : ['feed_counter_site_dependent']),
    ...(!navigation.hasNavigationFacts ? ['navigation_facts_unavailable'] : []),
  ];
}

export function buildSitePullImmersionEvidenceProfile({
  featureVector = {},
  subscores = {},
  facts = {},
  personalBaseline = null,
  sustainedBlockEvidenceProfile = null,
} = {}) {
  const todayTotalMs = toNumber(featureVector.todayTotalMs);
  const todayHourly = Array.isArray(featureVector.todayHourly) ? featureVector.todayHourly : [];
  const max3hTodayMs = maxRollingSum(todayHourly, 3);
  const activeHoursToday = countActiveHours(todayHourly);
  const session = resolveSessionShape(featureVector, facts);
  const sustainedProfile = sustainedBlockEvidenceProfile || buildSitePullSustainedBlockEvidenceProfile({
    featureVector,
    subscores,
    facts,
    personalBaseline,
  });
  const sustainedBlockMs = sustainedProfile.evidence.sustainedBlockMs;
  const blockShare = todayTotalMs > 0 ? clamp01(sustainedBlockMs / todayTotalMs) : 0;
  const duration = buildDurationConcentration({
    activeHoursToday,
    blockShare,
    session,
    sustainedBlockMs,
    todayTotalMs,
  });
  const feed = buildFeedContinuity(facts.behavior || {});
  const navigation = buildNavigationContinuity(resolveNavigationFacts(facts), {
    activeHoursToday,
    todayTotalMs,
  });
  const consumptionContinuityScore = Math.max(feed.feedContinuityScore, navigation.navigationContinuityScore * 0.9);
  const returns = buildReturnContext({ behavior: facts.behavior, intervention: facts.intervention });
  const channels = buildImmersionChannels({
    duration,
    feed,
    navigation,
    returns,
    sustainedBlockMs,
  });
  const supportScore = Math.max(
    consumptionContinuityScore,
    returns.returnContextScore,
  );
  const absorptionScore = clamp01(
    (duration.durationConcentrationScore * 0.66) + (supportScore * 0.34),
  );
  const status = resolveStatus({
    absorptionScore,
    consumptionContinuityScore,
    durationConcentrationScore: duration.durationConcentrationScore,
    returnContextScore: returns.returnContextScore,
    todayTotalMs,
    sustainedBlockMs,
  });
  const canEmitAtomic = session.hasMeasuredSessionFacts && (
    status === SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_MOVEMENT
    || status === SITE_PULL_IMMERSION_STATUSES.LONG_SESSION_WITH_RETURNS);
  const confidence = clamp01(
    0.48
    + (session.hasMeasuredSessionFacts ? 0.11 : session.hasSessionFacts ? 0.05 : 0)
    + (feed.hasFeedFacts ? 0.09 : 0)
    + (navigation.hasNavigationFacts ? 0.07 : 0)
    + (facts.behavior?.hasBehaviorFacts ? 0.05 : 0)
    + (duration.durationConcentrationScore * 0.08)
    + (supportScore * 0.06),
  );

  return {
    version: SITE_PULL_IMMERSION_EVIDENCE_PROFILE_VERSION,
    status,
    canEmitAtomic,
    score: clamp((absorptionScore * 100) + (returns.returnContextScore * 8), 0, 100),
    confidence,
    evidence: {
      todayTotalMs,
      max3hTodayMs,
      sustainedBlockMs,
      blockShare: round2(blockShare),
      activeHoursToday,
      strictMaxSessionMs: session.maxSessionMs,
      sessionBasis: session.sessionBasis,
      averageSessionMs: session.averageSessionMs,
      sessionCount: session.sessionCount,
      longSessionCount: session.longSessionCount,
      hasMeasuredSessionFacts: session.hasMeasuredSessionFacts,
      hasEstimatedSessionFacts: session.hasEstimatedSessionFacts,
      hasFeedFacts: feed.hasFeedFacts,
      hasNavigationFacts: navigation.hasNavigationFacts,
      feedAdvanceBursts: feed.feedAdvanceBursts,
      feedSkimSignals: feed.feedSkimSignals,
      fastScrollBursts: feed.fastScrollBursts,
      scrollSpikeBursts: feed.scrollSpikeBursts,
      maxFeedScreenfuls: feed.maxFeedScreenfuls,
      maxFeedItemTransitions: feed.maxFeedItemTransitions,
      totalNavigations: navigation.totalNavigations,
      movementNavigations: navigation.movementNavigations,
      linkNavigations: navigation.linkNavigations,
      generatedNavigations: navigation.generatedNavigations,
      movementPerActiveHour: Number(navigation.movementPerActiveHour.toFixed(4)),
      movementPerActiveMinute: Number(navigation.movementPerActiveMinute.toFixed(4)),
      switchOuts: returns.switchOuts,
      switchBackWithin10m: returns.switchBackWithin10m,
      revisitWithin10m: returns.revisitWithin10m,
      reenteredWithin5m: returns.reenteredWithin5m,
      reenteredWithin30m: returns.reenteredWithin30m,
      durationConcentrationScore: round4(duration.durationConcentrationScore),
      consumptionContinuityScore: round4(consumptionContinuityScore),
      feedContinuityScore: round4(feed.feedContinuityScore),
      navigationContinuityScore: round4(navigation.navigationContinuityScore),
      returnContextScore: round4(returns.returnContextScore),
      returnCount: returns.returnCount,
      evidenceFamilyIds: ['session_duration', ...(consumptionContinuityScore >= MIN_SUPPORT_SCORE ? ['content_movement'] : []),
        ...(returns.returnContextScore >= MIN_RETURN_CONTEXT_SCORE ? ['same_day_returns'] : [])],
      intentAssessment: 'not_observed',
      temporalAssociation: 'day_level_cooccurrence',
      supportScore: round4(supportScore),
      absorptionScore: round4(absorptionScore),
      immersionChannelIds: channels.channelIds,
      immersionChannelCount: channels.channelIds.length,
      absorptionSupportChannelIds: channels.supportChannelIds,
      absorptionSupportChannelCount: channels.supportChannelIds.length,
      immersionStatus: status,
      sustainedBlockInterpretation: sustainedProfile?.interpretation || null,
      caveats: buildCaveats({ feed, navigation, session }),
    },
  };
}
