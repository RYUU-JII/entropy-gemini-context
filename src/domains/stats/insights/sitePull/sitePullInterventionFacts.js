import { smooth01, toCount } from './sitePullMath.js';

// Presentation/exposure is context, not a user's response to that exposure.
export function hasSitePullInterventionResponse(intervention) {
  return ['continued', 'left', 'reenteredWithin5m', 'reenteredWithin30m', 'escapeClosed']
    .some((field) => intervention?.[field] > 0
      || intervention?.[`weekly${field[0].toUpperCase()}${field.slice(1)}`] > 0);
}

function summarizeWindow(source, shownKey) {
  const frictionShown = toCount(source[shownKey]);
  const continued = toCount(source.continued);
  const left = toCount(source.left);
  const escapeClosed = toCount(source.escapeClosed);
  const reenteredWithin5m = toCount(source.reenteredWithin5m);
  const reenteredWithin30m = toCount(source.reenteredWithin30m);
  const validReentryCohort = frictionShown > 0 && reenteredWithin5m <= reenteredWithin30m
    && reenteredWithin30m <= frictionShown;
  const validChoiceCohort = frictionShown > 0 && continued <= frictionShown
    && left <= frictionShown && escapeClosed <= frictionShown;
  const ratio = (value, valid) => valid ? value / frictionShown : null;
  return {
    frictionShown, continued, left, escapeClosed, reenteredWithin5m, reenteredWithin30m,
    reentryCount: reenteredWithin30m, validReentryCohort, validChoiceCohort,
    reentry5Rate: ratio(reenteredWithin5m, validReentryCohort),
    reentry30Rate: ratio(reenteredWithin30m, validReentryCohort),
    continuedRate: ratio(continued, validChoiceCohort), leftRate: ratio(left, validChoiceCohort),
    // Choice counters can overlap over an exposure's lifetime; do not sum them.
    exitRate: ratio(Math.max(left, escapeClosed), validChoiceCohort),
  };
}

export function resolveSitePullInterventionWindows(intervention = {}, cohort = 'resistanceEligible') {
  if (!['resistanceEligible', 'effectivenessEligible'].includes(cohort)) {
    throw new Error('SITE_PULL_INTERVENTION_COHORT_INVALID');
  }
  const filtered = intervention.hasFilteredInterventionFacts === true;
  const read = (window) => {
    if (filtered) {
      const source = intervention.effectSummary?.[window]?.[cohort];
      if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new Error(`SITE_PULL_INTERVENTION_COHORT_MISSING:${window}:${cohort}`);
      }
      return summarizeWindow(source, 'shown');
    }
    // The existing coarse-counter seam is explicit. Never mix it into a
    // filtered window, including an observed zero in an eligible cohort.
    const prefix = window === 'weekly' ? 'weekly' : '';
    const fields = ['frictionShown', 'continued', 'left', 'escapeClosed', 'reenteredWithin5m', 'reenteredWithin30m'];
    return summarizeWindow(Object.fromEntries(fields.map((field) => [field,
      intervention[prefix ? `${prefix}${field[0].toUpperCase()}${field.slice(1)}` : field]])), 'frictionShown');
  };
  return { today: read('today'), weekly: read('weekly'), filtered,
    cohort: filtered ? cohort : 'unclassified_coarse',
    source: filtered ? 'exposure_linked_effects' : 'flat_stats' };
}

export function computeSitePullInterventionReentryIntensity(window) {
  if (!window.validReentryCohort || window.frictionShown < 2 || window.reentryCount < 2) return 0;
  // The five-minute bucket is nested in the thirty-minute bucket. Continue
  // and Escape are choices, not additional resistance evidence.
  return smooth01(window.reentry30Rate, 0.15, 0.8);
}

export function resolveSitePullInterventionCohortConfidence(windows) {
  // A heuristic for provenance, not a calibrated causal-effect probability.
  return windows.filtered ? 0.82 : 0.55;
}

export function selectSitePullInterventionReentryWindow(windows) {
  const repeated = (window, minimum) => window.validReentryCohort
    && window.frictionShown >= minimum && window.reentryCount >= minimum && window.reentry30Rate >= 0.4;
  const todayRepeated = repeated(windows.today, 2);
  const weeklyRepeated = repeated(windows.weekly, 3);
  const name = todayRepeated ? 'today' : weeklyRepeated ? 'weekly'
    : windows.today.reentryCount > 0 ? 'today' : 'weekly';
  const selected = windows[name];
  return { name, selected, todayRepeated, weeklyRepeated,
    repeated: name === 'today' ? todayRepeated : weeklyRepeated,
    score: name === 'weekly' && selected.frictionShown < 3 ? 0
      : computeSitePullInterventionReentryIntensity(selected) };
}
