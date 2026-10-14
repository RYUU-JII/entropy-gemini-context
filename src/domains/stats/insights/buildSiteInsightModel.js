import { buildSiteFeatureVector } from './features/buildSiteFeatureVector.js';
import { assertSiteAnalysisSourceInput } from './contracts/siteAnalysisInputContract.js';
import { evaluateSitePatterns } from './patterns/evaluateSitePatterns.js';
import { projectSitePullRecentTrajectory } from './sitePull/personalBaselinePolicy.js';
import { synthesizeSiteInsight } from './synthesis/synthesizeSiteInsight.js';
import { resolveSitePullObservationState } from './sitePull/sitePullObservationState.js';

export function buildSiteInsightModel({
  intel,
  featureVector = null,
  recentTrajectory = null,
  insightsMode,
} = {}) {
  assertSiteAnalysisSourceInput(intel, 'intel');
  assertSiteAnalysisSourceInput(featureVector, 'featureVector');
  if (intel != null && featureVector != null) {
    throw new Error('SITE_INSIGHT_INPUT_AUTHORITY_CONFLICT');
  }
  const resolvedFeatureVector = featureVector || buildSiteFeatureVector({ intel });
  const analysisFeatureVector = recentTrajectory
    ? {
        ...resolvedFeatureVector,
        ...projectSitePullRecentTrajectory(recentTrajectory),
      }
    : resolvedFeatureVector;
  const patterns = resolveSitePullObservationState(analysisFeatureVector).status === 'missing' ? [] : evaluateSitePatterns({
    featureVector: analysisFeatureVector,
    insightsMode,
  });

  return synthesizeSiteInsight({
    featureVector: analysisFeatureVector,
    patterns,
    insightsMode,
  });
}
