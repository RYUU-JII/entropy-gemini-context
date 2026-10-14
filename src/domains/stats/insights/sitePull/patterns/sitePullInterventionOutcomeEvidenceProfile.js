import { smooth01 } from '../sitePullMath.js';
import { resolveSitePullInterventionCohortConfidence, resolveSitePullInterventionWindows, selectSitePullInterventionReentryWindow } from '../sitePullInterventionFacts.js';

export const SITE_PULL_INTERVENTION_OUTCOME_EVIDENCE_PROFILE_VERSION = 'site-pull-intervention-outcome-evidence-profile-v2';
export const SITE_PULL_INTERVENTION_OUTCOME_STATUSES = Object.freeze({
  INSUFFICIENT_INTERVENTION_EVIDENCE: 'insufficient_intervention_evidence',
  INTERVENTION_REENTRY_OBSERVED: 'intervention_reentry_observed',
  REPEATED_INTERVENTION_REENTRY: 'repeated_intervention_reentry',
  INTERVENTION_LEAVE_OBSERVED: 'intervention_leave_observed',
  MIXED_INTERVENTION_OUTCOME: 'mixed_intervention_outcome',
});

function windowEvidence(window) {
  return {
    frictionShown: window.frictionShown, continued: window.continued, left: window.left,
    escapeClosed: window.escapeClosed, reenteredWithin5m: window.reenteredWithin5m,
    reenteredWithin30m: window.reenteredWithin30m,
    selectedReentry30Rate: window.reentry30Rate, selectedReentry5Rate: window.reentry5Rate,
    selectedContinueRate: window.continuedRate, selectedLeftRate: window.leftRate,
    selectedExitRate: window.exitRate,
  };
}

export function buildSitePullInterventionOutcomeEvidenceProfile({ facts = {} } = {}) {
  const intervention = facts.intervention || {};
  const windows = resolveSitePullInterventionWindows(intervention, 'resistanceEligible');
  const choices = resolveSitePullInterventionWindows(intervention, 'effectivenessEligible');
  const selection = selectSitePullInterventionReentryWindow(windows);
  const { today, weekly } = windows;
  const { selected } = selection;
  const hasInterventionFacts = intervention.hasInterventionFacts === true;
  const canEmitReentryAtomic = selection.score >= 0.55 || selection.repeated;
  // A leave is an observed choice. Aggregate absence of reentry is neither a
  // mature follow-up cohort nor evidence that an intervention succeeded.
  const leave = choices.today;
  const canEmitRecoveryAtomic = leave.validChoiceCohort && leave.frictionShown >= 2 && leave.left >= 2;
  const leaveScore = canEmitRecoveryAtomic ? smooth01(leave.left, 1, 4) : 0;
  const reentryStatus = selection.repeated
    ? SITE_PULL_INTERVENTION_OUTCOME_STATUSES.REPEATED_INTERVENTION_REENTRY
    : selected.validReentryCohort && selected.reentryCount > 0
      ? SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INTERVENTION_REENTRY_OBSERVED
      : SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INSUFFICIENT_INTERVENTION_EVIDENCE;
  const status = canEmitReentryAtomic ? reentryStatus : canEmitRecoveryAtomic
    ? SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INTERVENTION_LEAVE_OBSERVED : reentryStatus;
  const caveats = ['followup_maturity_unavailable', 'choice_not_success_or_failure',
    'reentry_buckets_nested', 'no_causal_effect_estimate'];
  if (!windows.filtered) caveats.push('coarse_intervention_cohort_unclassified');
  if (!selected.validReentryCohort && selected.reentryCount > 0) caveats.push('invalid_reentry_population');
  const confidence = selected.validReentryCohort ? resolveSitePullInterventionCohortConfidence(windows) : 0;
  const evidence = {
    ...windowEvidence(selected),
    interventionOutcomeStatus: reentryStatus, interventionWindow: selection.name,
    evidenceWindow: selection.name, evidenceCohort: windows.cohort,
    interventionFactsSource: windows.source, hasFilteredInterventionFacts: windows.filtered,
    evidenceFamilyIds: ['intervention_exposure_response'], compositionBasis: 'single_family_intensity',
    temporalAssociation: windows.filtered ? 'exposure_linked_return' : 'window_cooccurrence',
    followupMaturity: 'unavailable',
    interventionOutcomeScore: selection.score * 100,
    interventionReentryScore: selection.score * 100, interventionRecoveryScore: 0,
    todayFrictionShown: today.frictionShown, todayContinued: today.continued, todayLeft: today.left,
    todayReenteredWithin5m: today.reenteredWithin5m, todayReenteredWithin30m: today.reenteredWithin30m,
    weeklyFrictionShown: weekly.frictionShown, weeklyContinued: weekly.continued, weeklyLeft: weekly.left,
    weeklyReenteredWithin5m: weekly.reenteredWithin5m, weeklyReenteredWithin30m: weekly.reenteredWithin30m,
    todayRepeatedReentryPressure: selection.todayRepeated,
    weeklyRepeatedReentryPressure: selection.weeklyRepeated, repeatedReentryPressure: selection.repeated,
    resistanceOutcomePressure: false, caveats,
  };
  const leaveEvidence = {
    ...evidence, ...windowEvidence(leave),
    interventionOutcomeStatus: SITE_PULL_INTERVENTION_OUTCOME_STATUSES.INTERVENTION_LEAVE_OBSERVED,
    interventionWindow: 'today', evidenceWindow: 'today', evidenceCohort: choices.cohort,
    temporalAssociation: choices.filtered ? 'exposure_linked_choice' : 'window_cooccurrence',
    interventionOutcomeScore: leaveScore * 100, interventionRecoveryScore: leaveScore * 100,
    interventionReentryScore: 0, repeatedReentryPressure: false,
  };
  return {
    version: SITE_PULL_INTERVENTION_OUTCOME_EVIDENCE_PROFILE_VERSION,
    status, score: Math.max(selection.score, leaveScore), confidence, hasInterventionFacts,
    selectedWindow: selection.name, selected, today, weekly,
    canEmitReentryAtomic, canEmitRecoveryAtomic,
    hasRepeatedReentryPressure: selection.repeated, hasResistanceOutcomePressure: false, evidence,
    reentry: { status: reentryStatus, canEmitAtomic: canEmitReentryAtomic, strength: selection.score, evidence },
    recovery: { status: leaveEvidence.interventionOutcomeStatus, canEmitAtomic: canEmitRecoveryAtomic,
      strength: leaveScore, confidence: leave.validChoiceCohort ? resolveSitePullInterventionCohortConfidence(choices) : 0,
      evidence: leaveEvidence },
    resistance: { status: reentryStatus, canSupportComposite: canEmitReentryAtomic && selection.repeated,
      strength: selection.score, evidence },
  };
}
