import {
  ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT,
  resolveZenBonsaiClassic2TreeIdentityFingerprint,
} from '../../../../themes/plugins/zen/contracts/ZenBonsaiClassic2IdentityContract.js';
import {
  ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT,
  resolveZenBonsaiClassic2CandidateGraphFingerprint,
  resolveZenBonsaiClassic2CandidateGraphRootNodeId,
  validateZenBonsaiClassic2CandidateGraph,
} from '../../../../themes/plugins/zen/contracts/ZenBonsaiClassic2CandidateGraphContract.js';
import {
  validateSakuraSpineGenerationConditionIdV1,
} from '../../../../themes/plugins/zen/contracts/SakuraSpineGenerationConditionContract.js';

export const ZEN_BONSAI_PROFILE_AGGREGATE_MODEL_STATE_KEY = (
  'zen_bonsai_profile_aggregate_v1'
);
export const ZEN_BONSAI_PROFILE_AGGREGATE_KIND = 'zen_bonsai_profile_aggregate';
export const ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT = 'zen_bonsai_profile_aggregate_v1';

const CLASSIC2_BOOTSTRAP_SOURCES = new Set([
  'explicit_first_run_bootstrap',
  'explicit_identity_rotation',
  'ephemeral_preview_bootstrap',
  'ephemeral_preview_identity_rotation',
]);
const CLASSIC2_LINEAGE_SOURCES = new Set([
  ...CLASSIC2_BOOTSTRAP_SOURCES,
  'durable_main_reconcile',
  'ephemeral_preview_reconcile',
]);
const CLASSIC2_DECISION_KEYS = Object.freeze([
  'nodeId', 'parentId', 'role', 'status', 'birthProgress', 'matureProgress',
  'provenance',
]);
const CLASSIC2_PROVENANCE_KEYS = Object.freeze([
  'policyVersion', 'source', 'treeFingerprint', 'identityRevision', 'stateRevision',
  'cohortId', 'historySegmentRef', 'selectionMethod', 'score', 'scoreBreakdown',
  'scoreModelVersion', 'featureContractVersion', 'featureSource',
  'scoreInputFingerprint', 'scoreSignals', 'reason',
]);
const ACTIVE_IDENTITY_KEYS = Object.freeze([
  'contract', 'treeType', 'treeSeed', 'structureDepth', 'structureMode',
  'topologyReferenceHeight', 'candidateGraphContract', 'canonicalLatent',
  'generationInputs',
  'identityRevision',
]);
const CANOPY_DISTRIBUTION_KEYS = Object.freeze([
  'localRatio', 'globalNodeCap', 'repairBudgetScale', 'minPerAnchor',
  'branchAffinitySigmaPx', 'maxGapPx',
]);
const AGGREGATE_KEYS = Object.freeze([
  'kind', 'contract', 'profileEpoch', 'stateRevision', 'identityRevision',
  'activeIdentity', 'activeIdentityFingerprint', 'lineageState',
]);

const isPlainObject = (value) => Boolean(
  value && typeof value === 'object' && !Array.isArray(value)
);
const hasExactKeys = (value, expectedKeys) => {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
};
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isRatio = (value) => isFiniteNumber(value) && value >= 0 && value <= 1;
const isNullableString = (value) => value === null || typeof value === 'string';

const validateClassic2Decision = (nodeId, value, state) => (
  hasExactKeys(value, CLASSIC2_DECISION_KEYS)
  && value.nodeId === nodeId
  && (value.parentId === null || typeof value.parentId === 'string')
  && ['trunk', 'scaffold', 'twig'].includes(value.role)
  && value.status === 'selected'
  && isRatio(value.birthProgress)
  && isRatio(value.matureProgress)
  && value.matureProgress >= value.birthProgress
  && hasExactKeys(value.provenance, CLASSIC2_PROVENANCE_KEYS)
  && value.provenance.policyVersion === 'classic2_development_lineage_release_v1'
  && CLASSIC2_LINEAGE_SOURCES.has(value.provenance.source)
  && value.provenance.treeFingerprint === state.treeFingerprint
  && isPositiveInteger(value.provenance.identityRevision)
  && value.provenance.identityRevision <= state.identityRevision
  && isPositiveInteger(value.provenance.stateRevision)
  && value.provenance.stateRevision <= state.stateRevision
  && typeof value.provenance.cohortId === 'string'
  && isNullableString(value.provenance.historySegmentRef)
  && ['development_observation', 'structural_spine'].includes(
    value.provenance.selectionMethod,
  )
  && (value.provenance.score === null || isFiniteNumber(value.provenance.score))
  && isPlainObject(value.provenance.scoreBreakdown)
  && isNullableString(value.provenance.scoreModelVersion)
  && isNullableString(value.provenance.featureContractVersion)
  && typeof value.provenance.featureSource === 'string'
  && isNullableString(value.provenance.scoreInputFingerprint)
  && isPlainObject(value.provenance.scoreSignals)
  && typeof value.provenance.reason === 'string'
);

const validateClassic2LineageState = (value) => {
  if (!hasExactKeys(value, [
    'kind', 'contract', 'candidateCarrierMetadata', 'candidateCarrierFingerprint',
    'candidateGraphContract',
    'treeFingerprint', 'treeIdentityFingerprint', 'identityRevision',
    'stateRevision', 'maxObservedGrowth', 'bootstrap', 'candidateGraph',
    'decisions',
  ])
    || value.kind !== 'zen_bonsai_classic2_lineage_state'
    || value.contract !== 'classic2_development_lineage_release_v1'
    || value.candidateGraphContract !== ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT
    || typeof value.candidateCarrierFingerprint !== 'string'
    || !value.candidateCarrierFingerprint.startsWith('classic2_carriers_v1:')
    || typeof value.treeFingerprint !== 'string'
    || !value.treeFingerprint.startsWith('classic2_tree_v1:')
    || typeof value.treeIdentityFingerprint !== 'string'
    || !value.treeIdentityFingerprint.startsWith('classic2_identity_v1:')
    || !isPositiveInteger(value.identityRevision)
    || !isPositiveInteger(value.stateRevision)
    || !isRatio(value.maxObservedGrowth)
    || !hasExactKeys(value.bootstrap, [
      'source', 'initialObservedGrowth', 'initialIdentityRevision',
      'initialStateRevision', 'rotatedFromTreeFingerprint',
      'rotatedFromTreeIdentityFingerprint', 'rotatedFromIdentityRevision',
      'rotatedFromStateRevision', 'highGrowthBootstrap',
    ])
    || !CLASSIC2_BOOTSTRAP_SOURCES.has(value.bootstrap.source)
    || !isRatio(value.bootstrap.initialObservedGrowth)
    || !isPositiveInteger(value.bootstrap.initialIdentityRevision)
    || !isPositiveInteger(value.bootstrap.initialStateRevision)
    || (value.bootstrap.rotatedFromTreeFingerprint !== null
      && (typeof value.bootstrap.rotatedFromTreeFingerprint !== 'string'
        || !value.bootstrap.rotatedFromTreeFingerprint.startsWith('classic2_tree_v1:')))
    || (value.bootstrap.rotatedFromTreeIdentityFingerprint !== null
      && (typeof value.bootstrap.rotatedFromTreeIdentityFingerprint !== 'string'
        || !value.bootstrap.rotatedFromTreeIdentityFingerprint
          .startsWith('classic2_identity_v1:')))
    || (value.bootstrap.rotatedFromIdentityRevision !== null
      && !isPositiveInteger(value.bootstrap.rotatedFromIdentityRevision))
    || (value.bootstrap.rotatedFromStateRevision !== null
      && !isPositiveInteger(value.bootstrap.rotatedFromStateRevision))
    || typeof value.bootstrap.highGrowthBootstrap !== 'boolean'
    || !isPlainObject(value.candidateGraph)
    || !Object.keys(value.candidateGraph).length
    || !validateZenBonsaiClassic2CandidateGraph(value.candidateGraph)
    || !isPlainObject(value.candidateCarrierMetadata)
    || JSON.stringify(Object.keys(value.candidateCarrierMetadata).sort())
      !== JSON.stringify(Object.keys(value.candidateGraph).sort())
    || !Object.values(value.candidateCarrierMetadata).every((metadata) => (
      hasExactKeys(metadata, ['terminalCount', 'flowerTerminalCount'])
      && isNonNegativeInteger(metadata.terminalCount)
      && isNonNegativeInteger(metadata.flowerTerminalCount)
      && metadata.flowerTerminalCount <= metadata.terminalCount
    ))
    || !isPlainObject(value.decisions)
    || !Object.entries(value.decisions).every(([nodeId, decision]) => (
      validateClassic2Decision(nodeId, decision, value)
      && Boolean(value.candidateGraph[nodeId])
      && decision.parentId === value.candidateGraph[nodeId].parentId
      && decision.role === value.candidateGraph[nodeId].role
    ))) return false;
  let rootNodeId;
  let expectedTreeFingerprint;
  try {
    rootNodeId = resolveZenBonsaiClassic2CandidateGraphRootNodeId(
      value.candidateGraph,
    );
    expectedTreeFingerprint = resolveZenBonsaiClassic2CandidateGraphFingerprint(
      rootNodeId,
      value.candidateGraph,
    );
  } catch {
    return false;
  }
  if (value.treeFingerprint !== expectedTreeFingerprint) return false;
  const rootDecision = value.decisions[rootNodeId];
  if (
    !rootDecision
    || rootDecision.parentId !== null
    || rootDecision.role !== 'trunk'
    || rootDecision.birthProgress !== 0
  ) {
    return false;
  }
  for (const decision of Object.values(value.decisions)) {
    if (decision.parentId === null) continue;
    const parentDecision = value.decisions[decision.parentId];
    if (
      !parentDecision
      || decision.birthProgress < parentDecision.birthProgress
    ) {
      return false;
    }
  }
  return true;
};

const validateActiveIdentity = (value) => (
  hasExactKeys(value, ACTIVE_IDENTITY_KEYS)
  && value.contract === ZEN_BONSAI_CLASSIC2_ACTIVE_IDENTITY_CONTRACT
  && value.treeType === 'sakura'
  && isNonNegativeInteger(value.treeSeed)
  && isPositiveInteger(value.identityRevision)
  && value.topologyReferenceHeight === 360
  && value.candidateGraphContract === ZEN_BONSAI_CLASSIC2_CANDIDATE_GRAPH_CONTRACT
  && ['bonsai', 'tree'].includes(value.structureMode)
  && isPositiveInteger(value.structureDepth)
  && (value.structureMode !== 'bonsai' || value.structureDepth <= 4)
  && (value.structureMode !== 'tree'
    || (value.structureDepth >= 3 && value.structureDepth <= 8))
  && hasExactKeys(value.canonicalLatent, ['version', 'values'])
  && value.canonicalLatent.version === 1
  && isPlainObject(value.canonicalLatent.values)
  && Object.keys(value.canonicalLatent.values).length > 0
  && Object.values(value.canonicalLatent.values).every(isFiniteNumber)
  && hasExactKeys(value.generationInputs, [
    'learningProgress', 'canopyDistributionProfile', 'spineGenerationConditionId',
  ])
  && isRatio(value.generationInputs.learningProgress)
  && validateSakuraSpineGenerationConditionIdV1(
    value.generationInputs.spineGenerationConditionId,
  )
  && hasExactKeys(
    value.generationInputs.canopyDistributionProfile,
    CANOPY_DISTRIBUTION_KEYS,
  )
  && Object.values(value.generationInputs.canopyDistributionProfile)
    .every(isFiniteNumber)
);

export const validateZenBonsaiProfileAggregateStorageValue = (value) => {
  if (!hasExactKeys(value, AGGREGATE_KEYS)
    || value.kind !== ZEN_BONSAI_PROFILE_AGGREGATE_KIND
    || value.contract !== ZEN_BONSAI_PROFILE_AGGREGATE_CONTRACT
    || typeof value.profileEpoch !== 'string'
    || !value.profileEpoch
    || value.profileEpoch.trim() !== value.profileEpoch
    || !isPositiveInteger(value.stateRevision)
    || !isPositiveInteger(value.identityRevision)
    || !validateActiveIdentity(value.activeIdentity)
    || value.activeIdentity.identityRevision !== value.identityRevision
    || typeof value.activeIdentityFingerprint !== 'string') {
    return false;
  }
  let expectedFingerprint;
  try {
    expectedFingerprint = resolveZenBonsaiClassic2TreeIdentityFingerprint(
      value.activeIdentity,
    );
  } catch {
    return false;
  }
  if (value.activeIdentityFingerprint !== expectedFingerprint) return false;
  if (value.lineageState === null) return true;
  return validateClassic2LineageState(value.lineageState)
    && value.lineageState.identityRevision === value.identityRevision
    && value.lineageState.treeIdentityFingerprint === value.activeIdentityFingerprint;
};

export const requireZenBonsaiProfileAggregateStorageValue = (value) => {
  if (!validateZenBonsaiProfileAggregateStorageValue(value)) {
    throw new Error('ZEN_BONSAI_PROFILE_AGGREGATE_STORAGE_VALUE_INVALID');
  }
  return value;
};
