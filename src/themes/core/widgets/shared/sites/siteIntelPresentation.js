import { requireSitePullInterpretation } from '../../../../../domains/stats/insights/sitePull/sitePullInterpretation.js';
import { formatSiteIntelReading } from './siteIntelReading.js';
import { resolveTargetBehaviorBadgeCopy } from './TargetBehaviorProfile.js';

// Presentation relationships, not pattern admission. Every other admitted
// readout intentionally uses independent numbers, including same-unit counts.
const COMPARISONS = Object.freeze({
  time_heavy_today: ['todayMs:weeklyAverageMs', 'todayMs:p75ReferenceMs'],
  personal_spike: ['todayMs:p75ReferenceMs'],
  session_depth_spike: ['todayMaxSessionMs:maxSessionP75Ms'],
  switch_churn_loop: ['todaySwitchChurn:switchChurnP75'],
  visit_spike: ['todayVisits:visitP75'],
  reentry_spike: ['todayRevisitWithin10m:revisitP75'],
  rising_trend: ['recentAverageMs:previousAverageMs'],
});

// Short observation names for the same terminal-selected claim. These do not
// infer intent or admit a second pattern from the hourly distribution.
const PATTERN_LABEL_KEYS = Object.freeze({
  time_heavy_today: 'usage_reading.pattern_long_use',
  personal_spike: 'usage_reading.pattern_longer_than_usual',
  checking_pattern: 'usage_reading.pattern_repeat_visits',
  habitual_entry: 'usage_reading.pattern_direct_entries',
});

export function buildSiteIntelPresentation({ profile, t }) {
  const interpretation = requireSitePullInterpretation(profile);
  const reading = formatSiteIntelReading(interpretation, t);
  const primary = reading.claims.find((claim) => claim.surfaceItemId === interpretation.headline.surfaceItemId);
  const primarySurface = primary ? profile.feedbackSurfaces.detail.find((item) => item.surfaceItemId === primary.surfaceItemId) : null;
  const metrics = reading.primaryEvidence;
  const pair = metrics.map((metric) => metric.field).join(':');
  const comparable = metrics.length === 2 && COMPARISONS[primary?.patternId]?.includes(pair) === true;
  if (comparable && (metrics[0].unit !== metrics[1].unit
    || metrics[0].provenance.family !== metrics[1].provenance.family)) {
    throw new Error('SITE_INTEL_COMPARISON_SCOPE_INVALID');
  }
  const ceiling = comparable ? Math.max(...metrics.map((metric) => metric.numericValue)) : null;
  const periodIds = [...new Set(metrics.map((metric) => metric.period))];
  if (!periodIds.length) periodIds.push('weekly');
  return {
    state: interpretation.headline.kind === 'pattern' ? 'observed' : interpretation.headline.state,
    headline: reading.headline,
    patternLabel: primary ? (PATTERN_LABEL_KEYS[primary.patternId]
      ? t(PATTERN_LABEL_KEYS[primary.patternId]) : resolveTargetBehaviorBadgeCopy(primarySurface, t).label) : null,
    patternId: primary?.patternId || null,
    surfaceItemId: primary?.surfaceItemId || null,
    kind: comparable ? 'comparison' : metrics.length ? 'measurements' : 'state',
    metrics,
    ceiling,
    periods: periodIds.map((id) => ({ id, ...interpretation.reading.periods[id],
      label: t(`target_profile.reading_period_${id}`, {}) })),
    observation: interpretation.observation,
    claims: interpretation.reading.expandedSurfaceItemIds.map((id) => {
      const claim = reading.claims.find((entry) => entry.surfaceItemId === id);
      if (!claim) throw new Error('SITE_INTEL_EXPANDED_CLAIM_MISSING');
      return claim;
    }),
  };
}
