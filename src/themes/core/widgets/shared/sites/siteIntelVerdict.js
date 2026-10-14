import { requireSitePullInterpretation } from '../../../../../domains/stats/insights/sitePull/sitePullInterpretation.js';

export const SITE_INTEL_VERDICT_STATUSES = Object.freeze({
  SCORED: 'scored',
  OBSERVING: 'observing',
  UNAVAILABLE: 'unavailable',
});

export const SITE_INTEL_RISK_BANDS = Object.freeze(['low', 'watch', 'elevated', 'high']);

/**
 * State of the personal comparison band behind the Zone B chart. `forming` means
 * the site's own baseline exists but disowns its percentiles; `unavailable`
 * means detail evidence has not been loaded for this site yet. Neither is
 * collapsed into a zero band, because a reference the model will not stand
 * behind is worse than no reference at all.
 */
export const USAGE_BAND_STATUSES = Object.freeze({
  AVAILABLE: 'available',
  FORMING: 'forming',
  UNAVAILABLE: 'unavailable',
});

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function buildSiteIntelVerdict({
  behaviorProfile = null,
  intel = null,
  viewModel = null,
  t,
} = {}) {
  if (typeof t !== 'function') {
    throw new Error('SITE_INTEL_VERDICT_TRANSLATOR_REQUIRED');
  }

  const sitePullProfile = intel?.sitePullProfile;
  const observedDayCount = Math.max(0, Math.floor(toNumber(viewModel?.observedDayCount)));

  if (!behaviorProfile || !sitePullProfile || typeof sitePullProfile !== 'object') {
    return {
      status: SITE_INTEL_VERDICT_STATUSES.UNAVAILABLE,
      score: null,
      level01: 0,
      band: null,
      tone: 'neutral',
      bandLabel: '',
      confidencePercent: 0,
      confidenceLabel: '',
      headline: t('site_workspace.verdict_pending_headline', {}),
      caption: t('site_workspace.verdict_pending_caption', {}),
      observedDayCount,
    };
  }

  const interpretation = requireSitePullInterpretation(sitePullProfile);
  const confidence = clamp01(toNumber(sitePullProfile.confidence));
  const confidencePercent = Math.round(confidence * 100);

  return {
    status: SITE_INTEL_VERDICT_STATUSES.OBSERVING,
    score: null,
    scoreMeaning: interpretation.score.meaning,
    level01: 0,
    band: null,
    tone: behaviorProfile.tone || 'neutral',
    bandLabel: behaviorProfile.riskLabel || '',
    confidencePercent,
    confidenceLabel: behaviorProfile.confidenceLabel || '',
    headline: behaviorProfile.headline || '',
    caption: t('target_profile.reading_observation_scope', {}),
    observedDayCount,
  };
}

export default buildSiteIntelVerdict;
