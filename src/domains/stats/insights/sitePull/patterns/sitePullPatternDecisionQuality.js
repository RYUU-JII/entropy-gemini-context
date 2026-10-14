import {
  clamp,
  clamp01,
  toNumber,
} from '../sitePullMath.js';

export const SITE_PULL_PATTERN_DECISION_QUALITY_VERSION =
  'site-pull-pattern-decision-quality-v2';

export const SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES = Object.freeze({
  PROVISIONAL: 'provisional',
  SUPPORTED: 'supported',
  STRONG: 'strong',
});

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.length > 0))];
}

function sampleStrength({ sampleCount, minSampleCount, hasSampleGate }) {
  if (!hasSampleGate) return 1;
  const floor = Math.max(0, toNumber(minSampleCount));
  if (floor <= 0) return sampleCount > 0 ? 1 : 0.5;
  return clamp01(toNumber(sampleCount) / (floor * 2));
}

function thresholdHeadroom(value, floor, ceiling) {
  const threshold = Math.max(0, toNumber(floor));
  if (threshold <= 0) return null;
  const current = Math.max(0, toNumber(value));
  if (current <= threshold) return 0;
  return clamp01((current - threshold) / Math.max(ceiling - threshold, threshold));
}

function minimumFinite(values = []) {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length > 0 ? Math.min(...finiteValues) : 1;
}

function resolveStatus(score, boundaryMargin) {
  if (score >= 0.74 && boundaryMargin >= 0.12) {
    return SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES.STRONG;
  }
  if (score >= 0.52) {
    return SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES.SUPPORTED;
  }
  return SITE_PULL_PATTERN_DECISION_QUALITY_STATUSES.PROVISIONAL;
}

export function buildSitePullPatternDecisionQuality(pattern, spec, metrics) {
  const scoreStrength = clamp(toNumber(metrics?.score), 0, 100) / 100;
  const confidenceStrength = clamp01(metrics?.confidence);
  const resolvedSampleStrength = sampleStrength({
    sampleCount: metrics?.sampleCount,
    minSampleCount: spec?.minSampleCount,
    hasSampleGate: Array.isArray(spec?.sampleKeys) && spec.sampleKeys.length > 0,
  });
  const evidenceFamilyIds = uniqueStrings(
    pattern?.evidence?.corroboratingEvidenceFamilyIds
      || pattern?.evidence?.evidenceFamilyIds,
  );
  const caveats = uniqueStrings(pattern?.evidence?.caveats);
  const baseScore = (
    (scoreStrength * 0.42)
    + (confidenceStrength * 0.38)
    + (resolvedSampleStrength * 0.2)
  );
  // Inventories explain a decision; label count and caveat wording are not votes.
  const qualityScore = Math.min(confidenceStrength, clamp01(baseScore));
  const boundaryMargin = minimumFinite([
    thresholdHeadroom(metrics?.score, spec?.minScore, 100),
    thresholdHeadroom(metrics?.confidence, spec?.minConfidence, 1),
    Array.isArray(spec?.sampleKeys) && spec.sampleKeys.length > 0
      ? thresholdHeadroom(metrics?.sampleCount, spec?.minSampleCount, Math.max(
          toNumber(spec?.minSampleCount) * 3,
          toNumber(spec?.minSampleCount) + 1,
        ))
      : null,
  ]);
  const status = resolveStatus(qualityScore, boundaryMargin);

  return {
    version: SITE_PULL_PATTERN_DECISION_QUALITY_VERSION,
    kind: 'heuristic_evidence_quality',
    status,
    score: Number(qualityScore.toFixed(4)),
    scoreStrength: Number(scoreStrength.toFixed(4)),
    confidenceStrength: Number(confidenceStrength.toFixed(4)),
    sampleStrength: Number(resolvedSampleStrength.toFixed(4)),
    boundaryMargin: Number(boundaryMargin.toFixed(4)),
    nearBoundary: boundaryMargin < 0.12,
    evidenceFamilyIds,
    evidenceFamilyCount: evidenceFamilyIds.length,
    caveats,
    caveatCount: caveats.length,
    caveatPenalty: 0,
  };
}

export default buildSitePullPatternDecisionQuality;
