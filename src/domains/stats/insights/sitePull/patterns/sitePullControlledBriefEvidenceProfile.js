import { SITE_PULL_MINUTE_MS, clamp01, smooth01, toNumber } from '../sitePullMath.js';
import { resolveSitePullEntryVisitSummary } from '../sitePullEntryFacts.js';
import { resolveSitePullSessionShape } from './sitePullSessionFactSource.js';

export const SITE_PULL_CONTROLLED_BRIEF_EVIDENCE_PROFILE_VERSION = 'site-pull-controlled-brief-evidence-profile-v3';
export const SITE_PULL_CONTROLLED_BRIEF_STATUSES = Object.freeze({
  INSUFFICIENT_CONTROL_EVIDENCE: 'insufficient_brief_evidence',
  BRIEF_CHECK_OBSERVED: 'brief_check_observed',
  BRIEF_CHECK_WITH_RETURNS: 'brief_check_with_returns',
});

// Measured brevity does not establish intention, successful control, or a completed exit.
export function buildSitePullControlledBriefEvidenceProfile({ featureVector = {}, facts = {} } = {}) {
  const todayMs = toNumber(featureVector.todayTotalMs);
  const session = resolveSitePullSessionShape(facts, { errorCode: 'SITE_PULL_CONTROLLED_BRIEF_SESSION_FACTS_INVALID' });
  const entry = resolveSitePullEntryVisitSummary({ facts });
  const visitOrSessionCount = Math.max(entry.todayVisits, session.sessionCount);
  const averageSessionMs = session.averageSessionMs;
  const coreWindow = session.hasMeasuredSessionFacts
    && todayMs >= 2 * SITE_PULL_MINUTE_MS && todayMs <= 12 * SITE_PULL_MINUTE_MS
    && visitOrSessionCount >= 1 && visitOrSessionCount <= 3
    && averageSessionMs > 0 && averageSessionMs <= 5 * SITE_PULL_MINUTE_MS
    && session.maxSessionMs > 0 && session.maxSessionMs <= 5 * SITE_PULL_MINUTE_MS;
  const durationFit = smooth01(todayMs, SITE_PULL_MINUTE_MS, 2 * SITE_PULL_MINUTE_MS)
    * (1 - smooth01(todayMs, 10 * SITE_PULL_MINUTE_MS, 15 * SITE_PULL_MINUTE_MS));
  const countFit = visitOrSessionCount >= 1 && visitOrSessionCount <= 2 ? 1 : visitOrSessionCount === 3 ? 0.72 : 0;
  const brevity = averageSessionMs > 0 ? 1 - smooth01(averageSessionMs, 5 * SITE_PULL_MINUTE_MS, 8 * SITE_PULL_MINUTE_MS) : 0;
  const score = coreWindow ? clamp01(durationFit * 0.45 + countFit * 0.25 + brevity * 0.3) : 0;
  const returnCount = Math.max(toNumber(facts.behavior?.revisitWithin10m), toNumber(facts.behavior?.switchBackWithin10m),
    toNumber(facts.transitionEdges?.todayReturnWithin10m));
  const status = !coreWindow ? SITE_PULL_CONTROLLED_BRIEF_STATUSES.INSUFFICIENT_CONTROL_EVIDENCE
    : returnCount > 0 ? SITE_PULL_CONTROLLED_BRIEF_STATUSES.BRIEF_CHECK_WITH_RETURNS
      : SITE_PULL_CONTROLLED_BRIEF_STATUSES.BRIEF_CHECK_OBSERVED;
  return {
    version: SITE_PULL_CONTROLLED_BRIEF_EVIDENCE_PROFILE_VERSION,
    status, score, confidence: session.hasMeasuredSessionFacts ? 0.72 : 0,
    canEmitVisible: coreWindow && score >= 0.62,
    evidence: {
      controlledBriefStatus: status, controlledBriefScore: score,
      todayMs, todayVisits: entry.todayVisits, visitOrSessionCount,
      sessionCount: session.sessionCount, shortSessionCount: session.shortSessionCount,
      averageSessionMs, maxSessionMs: session.maxSessionMs,
      hasMeasuredSessionFacts: session.hasMeasuredSessionFacts,
      hasEstimatedSessionFacts: session.hasEstimatedSessionFacts,
      sessionBasis: session.sessionBasis,
      returnCount, todayRevisitWithin10m: toNumber(facts.behavior?.revisitWithin10m),
      todaySwitchBackWithin10m: toNumber(facts.behavior?.switchBackWithin10m),
      evidenceFamilyIds: session.hasMeasuredSessionFacts ? ['session_duration'] : [],
      intentAssessment: 'not_observed',
      caveats: ['intent_not_observed', 'session_completion_not_observed',
        ...(!session.hasMeasuredSessionFacts ? ['measured_session_unavailable'] : []),
        ...(returnCount > 0 ? ['same_day_returns_not_linked_to_session'] : [])],
    },
  };
}
