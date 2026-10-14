export const LAYOUT_CYCLE_ORACLE_KIND = 'owner_marker_visibility_cycle';
export const LAYOUT_CYCLE_ORACLE_RELATION = 'candidate_scoped';
export const LAYOUT_CYCLE_OPPORTUNITY_KIND = 'youtube_watch_info_view_time_only';
export const LAYOUT_CYCLE_OPPORTUNITY_CONTAINER_SELECTOR = 'ytd-watch-info-text';

const LAYOUT_CYCLE_SAMPLE_KEYS = Object.freeze([
  'markerCount',
  'candidateCount',
  'candidateOwnerMarkerCount',
  'candidateDescendantOwnerMarkerCount',
  'declaredCollapsedContainerMarkerCount',
  'visibleDeclaredCollapsedContainerMarkerCount',
  'collapsedOwnedMetadataContainerCount',
  'nativeOpportunityCount',
  'collapsedOwnedNativeOpportunityCount',
  'visibleNativeOpportunityCount',
  'visibleRestoredAncestorOfCollapsedContainerCount',
  'visibleOwnerMarkedCandidateCount',
  'collapsedCount',
  'visibleRestoredTargetCount',
]);

const LAYOUT_CYCLE_PHASES = Object.freeze([
  Object.freeze({
    id: 'active',
    contractId: 'layout_cycle_active_collapsed',
    mode: 'collapsed',
  }),
  Object.freeze({
    id: 'disabled',
    contractId: 'layout_cycle_disabled_restored',
    mode: 'restored',
  }),
  Object.freeze({
    id: 'reenabled',
    contractId: 'layout_cycle_reenabled_collapsed',
    mode: 'collapsed',
  }),
]);

function fail(code, details = '') {
  throw new Error(details ? `${code}:${details}` : code);
}

function requireCount(value, phaseId, key) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('SITE_LAYOUT_CYCLE_COUNT_INVALID', `${phaseId}:${key}`);
  }
  return value;
}

function requireLayoutCycleSample(observation, phaseId) {
  const rawSample = observation?.layoutCycle;
  if (
    rawSample === null
    || typeof rawSample !== 'object'
    || Array.isArray(rawSample)
    || Object.getPrototypeOf(rawSample) !== Object.prototype
  ) {
    fail('SITE_LAYOUT_CYCLE_SAMPLE_REQUIRED', phaseId);
  }

  const ownKeys = Reflect.ownKeys(rawSample);
  if (
    ownKeys.length !== LAYOUT_CYCLE_SAMPLE_KEYS.length
    || ownKeys.some((key) => (
      typeof key !== 'string'
      || !LAYOUT_CYCLE_SAMPLE_KEYS.includes(key)
      || Object.getOwnPropertyDescriptor(rawSample, key)?.get
      || Object.getOwnPropertyDescriptor(rawSample, key)?.set
    ))
  ) {
    fail('SITE_LAYOUT_CYCLE_SAMPLE_SHAPE_INVALID', phaseId);
  }

  const sample = Object.fromEntries(LAYOUT_CYCLE_SAMPLE_KEYS.map((key) => [
    key,
    requireCount(rawSample[key], phaseId, key),
  ]));
  const relationInvalid = (key) => fail(
    'SITE_LAYOUT_CYCLE_SAMPLE_RELATION_INVALID',
    `${phaseId}:${key}`,
  );
  if (sample.candidateOwnerMarkerCount > sample.candidateCount) {
    relationInvalid('candidateOwnerMarkerCount');
  }
  if (sample.nativeOpportunityCount > sample.candidateCount) {
    relationInvalid('nativeOpportunityCount');
  }
  if (sample.visibleOwnerMarkedCandidateCount > sample.candidateOwnerMarkerCount) {
    relationInvalid('visibleOwnerMarkedCandidateCount');
  }
  if (sample.visibleOwnerMarkedCandidateCount > sample.visibleRestoredTargetCount) {
    relationInvalid('visibleRestoredTargetCount');
  }
  if (
    sample.visibleRestoredAncestorOfCollapsedContainerCount
      > sample.visibleRestoredTargetCount
  ) {
    relationInvalid('visibleRestoredAncestorOfCollapsedContainerCount');
  }
  if (
    sample.visibleDeclaredCollapsedContainerMarkerCount
      > sample.declaredCollapsedContainerMarkerCount
  ) {
    relationInvalid('visibleDeclaredCollapsedContainerMarkerCount');
  }
  if (
    sample.candidateOwnerMarkerCount > sample.markerCount
    || sample.candidateDescendantOwnerMarkerCount > sample.markerCount
    || sample.declaredCollapsedContainerMarkerCount > sample.markerCount
    || sample.collapsedOwnedMetadataContainerCount > sample.markerCount
  ) {
    relationInvalid('markerCount');
  }
  if (
    sample.collapsedOwnedMetadataContainerCount
      > sample.declaredCollapsedContainerMarkerCount
  ) {
    relationInvalid('collapsedOwnedMetadataContainerCount');
  }
  if (
    sample.collapsedOwnedNativeOpportunityCount
      > sample.collapsedOwnedMetadataContainerCount
    || sample.collapsedOwnedNativeOpportunityCount > sample.nativeOpportunityCount
  ) {
    relationInvalid('collapsedOwnedNativeOpportunityCount');
  }
  if (
    sample.visibleNativeOpportunityCount > sample.nativeOpportunityCount
    || sample.visibleNativeOpportunityCount > sample.visibleRestoredTargetCount
  ) {
    relationInvalid('visibleNativeOpportunityCount');
  }
  if (
    sample.candidateDescendantOwnerMarkerCount > 0
    && sample.candidateCount === 0
  ) {
    relationInvalid('candidateDescendantOwnerMarkerCount');
  }
  if (
    sample.collapsedOwnedMetadataContainerCount > 0
    && sample.candidateCount === 0
  ) {
    relationInvalid('collapsedOwnedMetadataContainerCount');
  }
  if (
    sample.visibleRestoredAncestorOfCollapsedContainerCount > 0
    && (
      sample.candidateCount === 0
      || sample.collapsedOwnedMetadataContainerCount === 0
    )
  ) {
    relationInvalid('visibleRestoredAncestorOfCollapsedContainerCount');
  }
  return Object.freeze(sample);
}

function analyzeCollapsedPhase(phaseId, sample) {
  if (sample.visibleDeclaredCollapsedContainerMarkerCount > 0) {
    return {
      status: 'FAIL',
      reason: 'declared_collapsed_container_marker_remains_visible',
    };
  }
  if (sample.visibleRestoredAncestorOfCollapsedContainerCount > 0) {
    return {
      status: 'FAIL',
      reason: 'collapsed_container_retains_visible_layout_ancestor',
    };
  }
  if (sample.candidateCount === 0) {
    return {
      status: 'WARN',
      reason: 'restored_candidate_not_observed',
    };
  }
  if (sample.nativeOpportunityCount === 0) {
    return {
      status: 'WARN',
      reason: 'native_view_time_opportunity_not_observed',
    };
  }
  if (sample.collapsedOwnedNativeOpportunityCount > 0) {
    return {
      status: 'PASS',
      reason: `${phaseId}_collapsed_owned_native_opportunity_observed`,
    };
  }
  return {
    status: 'FAIL',
    reason: 'native_view_time_opportunity_not_collapsed',
  };
}

function analyzeRestoredPhase(sample) {
  if (sample.declaredCollapsedContainerMarkerCount > 0) {
    return {
      status: 'FAIL',
      reason: 'declared_collapsed_container_marker_remains_after_disable',
    };
  }
  if (
    sample.markerCount > 0
    || sample.candidateOwnerMarkerCount > 0
    || sample.candidateDescendantOwnerMarkerCount > 0
  ) {
    return {
      status: 'WARN',
      reason: 'candidate_scoped_owner_relation_not_observed',
    };
  }
  if (sample.candidateCount === 0) {
    return {
      status: 'WARN',
      reason: 'restored_target_not_observed',
    };
  }
  if (sample.nativeOpportunityCount === 0) {
    return {
      status: 'WARN',
      reason: 'native_view_time_opportunity_not_observed',
    };
  }
  if (sample.visibleNativeOpportunityCount > 0) {
    return {
      status: 'PASS',
      reason: 'owner_marker_removed_and_native_opportunity_visible',
    };
  }
  return {
    status: 'FAIL',
    reason: 'native_view_time_opportunity_not_restored',
  };
}

function createPhaseContract(phase, sample) {
  const verdict = phase.mode === 'restored'
    ? analyzeRestoredPhase(sample)
    : analyzeCollapsedPhase(phase.id, sample);
  return Object.freeze({
    id: phase.contractId,
    status: verdict.status,
    evidence: Object.freeze({
      phase: phase.id,
      reason: verdict.reason,
      ...sample,
    }),
    note: null,
  });
}

export function analyzeLayoutCycleOracle({
  activeObservation,
  disabledObservation,
  reenabledObservation,
} = {}) {
  const observationByPhase = {
    active: activeObservation,
    disabled: disabledObservation,
    reenabled: reenabledObservation,
  };
  const contracts = LAYOUT_CYCLE_PHASES.map((phase) => createPhaseContract(
    phase,
    requireLayoutCycleSample(observationByPhase[phase.id], phase.id),
  ));
  const status = contracts.some((contract) => contract.status === 'FAIL')
    ? 'FAIL'
    : contracts.some((contract) => contract.status === 'WARN')
      ? 'WARN'
      : 'PASS';

  return Object.freeze({
    status,
    contracts: Object.freeze(contracts),
  });
}
