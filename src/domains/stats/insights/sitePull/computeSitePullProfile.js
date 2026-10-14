import {
  assertSitePullFactsInputAuthority,
  SITE_PULL_FACTS_VERSION,
  buildSitePullFacts,
  resolveSitePullFeatureVector,
} from './buildSitePullFacts.js';
import { toPublicPersonalBaseline } from './personalBaselinePublicContract.js';
import {
  buildSitePullDomainFeedbackSurfaceModel,
  buildSitePullPatternDiagnosticReport,
  buildSitePullPatternContext,
  evaluateSitePullPatternLayers,
} from './patterns/evaluateSitePullPatterns.js';
import { buildContributionBreakdown, buildDrivers } from './scoring/sitePullContributionBreakdown.js';
import { buildDataCoverage } from './scoring/sitePullDataCoverage.js';
import { chooseRecommendedNudge } from './scoring/sitePullRecommendedNudge.js';
import {
  computeFeatureConfidences,
  computeOverallConfidence,
  computeRiskBand,
  computeSubscores,
  outputSubscores,
  resolveSitePullModelMetadata,
  resolveTone,
  hasInterventionFacts,
} from './scoring/sitePullScoreModel.js';
import { clamp, toNumber } from './sitePullMath.js';
import { buildSitePullInterpretation } from './sitePullInterpretation.js';
import { resolveSitePullObservationState } from './sitePullObservationState.js';

export {
  SITE_PULL_MODEL_VERSION,
  SITE_PULL_BASELINE_WEIGHTS,
  SITE_PULL_INTERVENTION_AWARE_WEIGHTS,
} from './scoring/sitePullScoreModel.js';

function computeScore(contributionBreakdown) {
  return Math.round(clamp(
    contributionBreakdown.reduce((sum, entry) => sum + toNumber(entry.contribution), 0),
    0,
    100,
  ));
}

function buildPatternLayers(featureVector, subscores, confidence, facts = null, personalBaseline = null) {
  return evaluateSitePullPatternLayers({
    featureVector,
    subscores,
    confidence,
    facts,
    personalBaseline,
  });
}

function buildFeedbackSurfaces(patternSignals) {
  return buildSitePullDomainFeedbackSurfaceModel(patternSignals);
}

function resolveSitePullProfileFacts({
  intel = null,
  featureVector = null,
  facts = null,
  options = {},
} = {}) {
  assertSitePullFactsInputAuthority({ facts, intel, featureVector });
  return facts !== null && facts !== undefined
    ? facts
    : buildSitePullFacts({ intel, featureVector, options });
}

function requireSitePullProfileFactsObject(facts, fieldName) {
  if (!Object.prototype.hasOwnProperty.call(facts, fieldName)) {
    throw new Error(`SITE_PULL_PROFILE_FACT_FIELD_MISSING:${fieldName}`);
  }
  const value = facts[fieldName];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`SITE_PULL_PROFILE_FACT_FIELD_INVALID:${fieldName}`);
  }
  return value;
}

export function computeSitePullProfile({
  intel = null,
  featureVector = null,
  facts = null,
  options = {},
} = {}) {
  const sitePullFacts = resolveSitePullProfileFacts({
    intel,
    featureVector,
    facts,
    options,
  });
  if (sitePullFacts.version !== SITE_PULL_FACTS_VERSION) {
    throw new Error('SITE_PULL_PROFILE_FACTS_VERSION_INVALID');
  }
  const personalBaseline = toPublicPersonalBaseline(
    requireSitePullProfileFactsObject(sitePullFacts, 'personalBaseline'),
  );
  const temporalEvidence = requireSitePullProfileFactsObject(sitePullFacts, 'temporalEvidence');
  const validatedSitePullFacts = {
    ...sitePullFacts,
    personalBaseline,
  };
  const resolvedFeatureVector = resolveSitePullFeatureVector({
    facts: validatedSitePullFacts,
  });
  const { weights, modelVersion } = resolveSitePullModelMetadata(validatedSitePullFacts);
  const subscores01 = computeSubscores(
    resolvedFeatureVector,
    options,
    validatedSitePullFacts,
    personalBaseline,
  );
  const featureConfidences = computeFeatureConfidences(
    resolvedFeatureVector,
    options,
    validatedSitePullFacts,
    personalBaseline,
  );
  const confidence = computeOverallConfidence(resolvedFeatureVector, featureConfidences);
  const contributionBreakdown = buildContributionBreakdown(
    resolvedFeatureVector,
    subscores01,
    featureConfidences,
    weights,
    validatedSitePullFacts,
    personalBaseline,
  );
  const observation = resolveSitePullObservationState(resolvedFeatureVector);
  const score = observation.status === 'missing' ? null : computeScore(contributionBreakdown);
  const riskBand = observation.status === 'missing'
    ? null : computeRiskBand(score, confidence, resolvedFeatureVector.hasAnyActivity);
  const patternLayers = buildPatternLayers(
    resolvedFeatureVector,
    subscores01,
    confidence,
    validatedSitePullFacts,
    personalBaseline,
  );
  const patternSignals = patternLayers.patterns;
  const feedbackSurfaces = buildFeedbackSurfaces(patternSignals);
  const interpretation = buildSitePullInterpretation({
    featureVector: resolvedFeatureVector,
    feedbackSurfaces,
    hasInterventionFacts: hasInterventionFacts(validatedSitePullFacts),
  });
  const badges = feedbackSurfaces.badge;
  const patternDiagnostics = buildSitePullPatternDiagnosticReport(patternLayers, {
    featureVector: resolvedFeatureVector,
    facts: validatedSitePullFacts,
    personalBaseline,
    aggregateAnalysis: options.aggregateAnalysis || null,
  });

  return {
    modelVersion,
    interpretation,
    factsVersion: validatedSitePullFacts?.version || null,
    domain: resolvedFeatureVector.domain || intel?.domain || '',
    score,
    confidence: observation.status === 'missing' ? 0 : Number(confidence.toFixed(2)),
    riskBand,
    labelId: riskBand,
    tone: riskBand === null ? 'neutral' : resolveTone(riskBand),
    subscores: outputSubscores(subscores01),
    weights: { ...weights },
    patterns: patternSignals,
    patternLayers,
    patternDiagnostics,
    patternContext: buildSitePullPatternContext({
      featureVector: resolvedFeatureVector,
      facts: validatedSitePullFacts,
    }),
    badges,
    feedbackSurfaces,
    drivers: buildDrivers(contributionBreakdown, badges),
    contributionBreakdown,
    recommendedNudge: chooseRecommendedNudge(resolvedFeatureVector, subscores01, riskBand),
    sessionSummary: validatedSitePullFacts?.session || null,
    temporalEvidence,
    personalBaseline,
    dataCoverage: buildDataCoverage(
      resolvedFeatureVector,
      options,
      featureConfidences,
      validatedSitePullFacts,
      personalBaseline,
    ),
  };
}

export default computeSitePullProfile;
