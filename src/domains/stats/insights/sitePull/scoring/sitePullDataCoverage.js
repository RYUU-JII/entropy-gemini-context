import { requireStatsDomainCollectionObservation } from '../../../contracts/statsContracts.js';

const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function createDataCoverageError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function resolveFactCoverage(facts = null) {
  if (!hasOwn(facts, 'dataCoverage')) {
    throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_MISSING');
  }
  if (!isObjectRecord(facts.dataCoverage)) {
    throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_INVALID');
  }
  return facts.dataCoverage;
}

function requireBooleanCoverageField(factCoverage, field) {
  if (typeof factCoverage[field] === 'boolean') return factCoverage[field];
  throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_FIELD_INVALID', { field });
}

function requirePersonalBaselineStatus(factCoverage) {
  if (typeof factCoverage.personalBaselineStatus === 'string'
    && factCoverage.personalBaselineStatus.length > 0) {
    return factCoverage.personalBaselineStatus;
  }
  throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_FIELD_INVALID', {
    field: 'personalBaselineStatus',
  });
}

function requireDataCollectionMode(factCoverage) {
  if (factCoverage.dataCollectionMode === null
    || typeof factCoverage.dataCollectionMode === 'string') {
    return factCoverage.dataCollectionMode;
  }
  throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_FIELD_INVALID', {
    field: 'dataCollectionMode',
  });
}

function requirePermissionCoverage(factCoverage) {
  if (isObjectRecord(factCoverage.permissionCoverage)) {
    return factCoverage.permissionCoverage;
  }
  throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_FIELD_INVALID', {
    field: 'permissionCoverage',
  });
}

export function buildDataCoverage(featureVector, options, featureConfidences, facts = null, personalBaseline = null) {
  const factCoverage = resolveFactCoverage(facts);
  const collectionObservation = requireStatsDomainCollectionObservation(
    factCoverage.collectionObservation,
    { source: 'sitePullDataCoverage.collectionObservation' },
  );
  const hasHourlyFacts = requireBooleanCoverageField(factCoverage, 'hasHourlyFacts');
  if (hasHourlyFacts !== collectionObservation.observed) {
    throw createDataCoverageError('SITE_PULL_DATA_COVERAGE_COLLECTION_RELATION_INVALID');
  }
  return {
    hasUsageFacts: requireBooleanCoverageField(factCoverage, 'hasUsageFacts'),
    hasWeeklyFacts: requireBooleanCoverageField(factCoverage, 'hasWeeklyFacts'),
    hasPersonalBaselineFacts: requireBooleanCoverageField(factCoverage, 'hasPersonalBaselineFacts'),
    personalBaselineStatus: requirePersonalBaselineStatus(factCoverage),
    hasHourlyFacts,
    hasGoalFacts: requireBooleanCoverageField(factCoverage, 'hasGoalFacts'),
    hasEntryFacts: requireBooleanCoverageField(factCoverage, 'hasEntryFacts'),
    hasSessionFacts: requireBooleanCoverageField(factCoverage, 'hasSessionFacts'),
    hasEstimatedSessionFacts: requireBooleanCoverageField(factCoverage, 'hasEstimatedSessionFacts'),
    hasBehaviorFacts: requireBooleanCoverageField(factCoverage, 'hasBehaviorFacts'),
    hasInterventionFacts: requireBooleanCoverageField(factCoverage, 'hasInterventionFacts'),
    hasNavigationFacts: requireBooleanCoverageField(factCoverage, 'hasNavigationFacts'),
    hasTransitionEdgeFacts: requireBooleanCoverageField(factCoverage, 'hasTransitionEdgeFacts'),
    hasTemporalEvidence: requireBooleanCoverageField(factCoverage, 'hasTemporalEvidence'),
    dataCollectionMode: requireDataCollectionMode(factCoverage),
    collectionObservation,
    permissionCoverage: requirePermissionCoverage(factCoverage),
    confidenceParts: featureConfidences.overallParts || {},
  };
}
