import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
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
import { resolveSitePullSessionShape } from './sitePullSessionFactSource.js';

export const SITE_PULL_SUSTAINED_BLOCK_PROFILE_VERSION = 'site-pull-sustained-block-profile-v3';

export const SITE_PULL_SUSTAINED_BLOCK_INTERPRETATIONS = Object.freeze({
  SUSTAINED_DOMAIN: 'sustained_domain_block',
  WITH_SWITCHING: 'sustained_block_with_switching',
});

const MIN_TOTAL_MS = 25 * SITE_PULL_MINUTE_MS;
const MIN_BLOCK_MS = 20 * SITE_PULL_MINUTE_MS;
const MIN_BLOCK_SHARE = 0.55;

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
  return resolveSitePullSessionShape(facts, { errorCode: 'SITE_PULL_SUSTAINED_BLOCK_SESSION_FACTS_INVALID' });
}

function resolveBehaviorShape(facts = {}) {
  const behavior = facts.behavior || {};
  const entry = resolveSitePullEntryVisitSummary({ facts });
  const hasBehaviorFacts = Boolean(behavior.hasBehaviorFacts);
  const todayVisits = entry.todayVisits;
  const switchIns = toCount(behavior.switchIns);
  const switchOuts = toCount(behavior.switchOuts);
  const switchChurn = switchIns + switchOuts;
  const switchBackWithin10m = toCount(behavior.switchBackWithin10m);
  const revisitWithin10m = toCount(behavior.revisitWithin10m);

  return {
    hasBehaviorFacts,
    todayVisits,
    switchIns,
    switchOuts,
    switchChurn,
    switchBackWithin10m,
    revisitWithin10m,
  };
}

function computeDriftScore({
  activeHoursToday,
  blockShareScore,
  behavior,
  session,
}) {
  const denominator = Math.max(behavior.todayVisits, session.sessionCount, 1);
  const switchChurnPerEntrance = behavior.switchChurn / denominator;
  const switchChurnScore = behavior.hasBehaviorFacts
    ? smooth01(switchChurnPerEntrance, 0.45, 1.8) * smooth01(behavior.switchChurn, 2, 12)
    : 0;
  const quickReturnCount = Math.max(behavior.switchBackWithin10m, behavior.revisitWithin10m);
  const quickReturnScore = behavior.hasBehaviorFacts
    ? smooth01(quickReturnCount, 1, 5)
    : 0;
  const shortSessionScore = session.hasSessionFacts
    ? smooth01(session.shortSessionRate, 0.2, 0.7) * smooth01(session.shortSessionCount, 1, 5)
    : 0;
  const spreadAgainstBlockScore = smooth01(activeHoursToday, 4, 9) * (1 - blockShareScore);

  return {
    driftScore: clamp01(
      (switchChurnScore * 0.32)
      + (quickReturnScore * 0.28)
      + (shortSessionScore * 0.26)
      + (spreadAgainstBlockScore * 0.14),
    ),
    switchChurnPerEntrance,
    switchChurnScore,
    quickReturnScore,
    shortSessionScore,
    spreadAgainstBlockScore,
  };
}

function resolveInterpretation({ behavior, driftScore }) {
  return behavior.hasBehaviorFacts && behavior.switchChurn >= 4 && driftScore >= 0.55
    ? SITE_PULL_SUSTAINED_BLOCK_INTERPRETATIONS.WITH_SWITCHING
    : SITE_PULL_SUSTAINED_BLOCK_INTERPRETATIONS.SUSTAINED_DOMAIN;
}

function buildCaveats({
  behavior,
  driftScore,
  session,
  max3hTodayMs,
}) {
  const caveats = [];
  if (!behavior.hasBehaviorFacts) caveats.push('behavior_facts_unavailable');
  if (!session.hasMeasuredSessionFacts) caveats.push('strict_session_unavailable');
  if (session.maxSessionMs > 0 && session.maxSessionMs < max3hTodayMs * 0.5) {
    caveats.push('hourly_block_exceeds_strict_session');
  }
  if (driftScore >= 0.45) caveats.push('same_day_switching_context');
  caveats.push('intent_not_observed', 'day_level_context_not_linked_to_session');
  return caveats;
}

export function buildSitePullSustainedBlockEvidenceProfile({
  featureVector = {},
  facts = {},
} = {}) {
  const todayTotalMs = toNumber(featureVector.todayTotalMs);
  const todayHourly = Array.isArray(featureVector.todayHourly) ? featureVector.todayHourly : [];
  const hasHourlyShape = todayHourly.length === 24;
  const max3hTodayMs = maxRollingSum(todayHourly, 3);
  const hourlyBlockShare = todayTotalMs > 0 ? clamp01(max3hTodayMs / todayTotalMs) : 0;
  const activeHoursToday = countActiveHours(todayHourly);
  const session = resolveSessionShape(featureVector, facts);
  const behavior = resolveBehaviorShape(facts);
  const sustainedBlockMs = session.maxSessionMs;
  const blockShare = todayTotalMs > 0 ? clamp01(sustainedBlockMs / todayTotalMs) : 0;
  const blockDurationScore = durationNorm(sustainedBlockMs, 20, 120);
  const blockShareScore = smooth01(blockShare, 0.55, 0.85);
  const strictSessionScore = session.maxSessionMs > 0
    ? durationNorm(session.maxSessionMs, 20, 90) * (1 - smooth01(session.shortSessionRate, 0.25, 0.7))
    : 0;
  const shapeScore = clamp01(
    (blockDurationScore * 0.58)
    + (blockShareScore * 0.3)
    + (strictSessionScore * 0.12),
  );
  const drift = computeDriftScore({
    activeHoursToday,
    blockShareScore,
    behavior,
    session,
  });
  const canEmitAtomic = Boolean(
    session.hasMeasuredSessionFacts
    && todayTotalMs >= MIN_TOTAL_MS
    && sustainedBlockMs >= MIN_BLOCK_MS
    && blockShare >= MIN_BLOCK_SHARE
    && (hasHourlyShape || session.hasSessionFacts),
  );
  const interpretation = resolveInterpretation({ behavior, driftScore: drift.driftScore });
  const confidence = clamp01(
    0.5
    + (hasHourlyShape ? 0.06 : 0)
    + (session.hasMeasuredSessionFacts ? 0.12 : session.hasSessionFacts ? 0.05 : 0)
    + (behavior.hasBehaviorFacts ? 0.08 : 0)
    + (shapeScore * 0.1),
  );

  return {
    version: SITE_PULL_SUSTAINED_BLOCK_PROFILE_VERSION,
    canEmitAtomic,
    interpretation,
    evidence: {
      todayTotalMs,
      max3hTodayMs,
      sustainedBlockMs,
      sessionBasis: session.sessionBasis,
      corroboratingEvidenceFamilyIds: session.hasMeasuredSessionFacts ? ['session_duration'] : [],
      focusShare: round2(hourlyBlockShare),
      blockShare: round2(blockShare),
      activeHoursToday,
      sessionCount: session.sessionCount,
      shortSessionCount: session.shortSessionCount,
      longSessionCount: session.longSessionCount,
      shortSessionRate: round4(session.shortSessionRate),
      strictMaxSessionMs: session.maxSessionMs,
      averageSessionMs: session.averageSessionMs,
      hasMeasuredSessionFacts: session.hasMeasuredSessionFacts,
      hasEstimatedSessionFacts: session.hasEstimatedSessionFacts,
      hasBehaviorFacts: behavior.hasBehaviorFacts,
      todaySwitchChurn: behavior.switchChurn,
      todaySwitchBackWithin10m: behavior.switchBackWithin10m,
      todayRevisitWithin10m: behavior.revisitWithin10m,
      switchChurnPerEntrance: Number(drift.switchChurnPerEntrance.toFixed(4)),
      blockShapeScore: round4(shapeScore),
      driftScore: round4(drift.driftScore),
      blockInterpretation: interpretation,
      intentAssessment: 'not_observed',
      caveats: buildCaveats({
        behavior,
        driftScore: drift.driftScore,
        session,
        max3hTodayMs,
      }),
    },
    score: clamp(shapeScore * 100, 0, 100),
    confidence,
  };
}
