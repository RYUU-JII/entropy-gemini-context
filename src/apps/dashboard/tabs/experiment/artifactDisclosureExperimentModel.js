import {
  PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
  buildProgressionArtifactDisclosurePlan,
  normalizeProgressionArtifactDisclosureSignals,
  scoreProgressionCausalityDisclosure,
  scoreProgressionSupportArtifactDisclosure,
} from '@/domains/progression/index.js';
import {
  buildArtifactDisclosureSignalsFromProtocolState,
} from '@/apps/dashboard/artifacts/artifactDisclosureSignals.js';

export const ARTIFACT_DISCLOSURE_EXPERIMENT_SOURCE = 'current_protocol_runtime_proxy';

export const ARTIFACT_DISCLOSURE_LABEL_KEYS = Object.freeze({
  lens: 'experiment.artifact_disclosure.artifacts.lens',
  brake: 'experiment.artifact_disclosure.artifacts.brake',
  gate: 'experiment.artifact_disclosure.artifacts.gate',
  echo: 'experiment.artifact_disclosure.artifacts.echo',
  flare: 'experiment.artifact_disclosure.artifacts.flare',
  barrier: 'experiment.artifact_disclosure.artifacts.barrier',
  veil: 'experiment.artifact_disclosure.artifacts.veil',
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function freezeContributions(entries) {
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}

function resolveContributionSignal(signal) {
  if (isPlainObject(signal)) {
    return Object.freeze({
      value: roundScore(signal.score),
      configured: roundScore(signal.configured),
      observed: roundScore(signal.observed),
    });
  }
  return Object.freeze({
    value: roundScore(signal),
    configured: null,
    observed: null,
  });
}

function buildContributionRows({
  weights = {},
  signals = {},
} = {}) {
  const sourceWeights = isPlainObject(weights) ? weights : {};
  const sourceSignals = isPlainObject(signals) ? signals : {};
  return freezeContributions(Object.entries(sourceWeights).map(([signalKey, rawWeight]) => {
    const signal = resolveContributionSignal(sourceSignals[signalKey]);
    const value = signal.value;
    const weight = roundScore(rawWeight);
    return {
      signalKey,
      value,
      configured: signal.configured,
      observed: signal.observed,
      weight,
      contribution: roundScore(value * weight),
    };
  }));
}

function resolveSupportRows({
  policy,
  normalizedSignals,
  supportScores,
}) {
  const supportSignals = policy.sequence?.supportSignals || {};
  const artifactIds = Array.isArray(supportSignals.artifactIds) ? supportSignals.artifactIds : [];
  const defaultOrder = Array.isArray(supportSignals.defaultOrder) ? supportSignals.defaultOrder : artifactIds;
  const weightsByArtifact = isPlainObject(supportSignals.signalWeights) ? supportSignals.signalWeights : {};

  return Object.freeze(artifactIds.map((artifactId) => Object.freeze({
    artifactId,
    labelKey: ARTIFACT_DISCLOSURE_LABEL_KEYS[artifactId] || artifactId,
    orderPosition: defaultOrder.indexOf(artifactId) + 1,
    score: roundScore(supportScores[artifactId]),
    contributions: buildContributionRows({
      weights: weightsByArtifact[artifactId],
      signals: normalizedSignals.support?.[artifactId],
    }),
  })));
}

function resolveCausalityModel({
  policy,
  plan,
  normalizedSignals,
  causalityScore,
}) {
  const evidence = policy.sequence?.barrierEvidence || {};
  const artifactId = typeof evidence.artifactId === 'string' ? evidence.artifactId : '';
  return Object.freeze({
    artifactId,
    labelKey: ARTIFACT_DISCLOSURE_LABEL_KEYS[artifactId] || artifactId,
    basePriority: roundScore(evidence.basePriority),
    score: roundScore(causalityScore),
    bandId: plan.causality?.band?.id || '',
    interpretationKey: plan.causality?.interpretationKey || '',
    contributions: buildContributionRows({
      weights: evidence.signalWeights,
      signals: normalizedSignals.causality,
    }),
  });
}

export function buildArtifactDisclosureExperimentModel({
  filterSettings,
  gateConfig,
  nudgeConfig,
  historyCleanupForBlocked,
  concealBlockedBookmarks,
  artifactRuntimeSnapshot = null,
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const signalSnapshot = buildArtifactDisclosureSignalsFromProtocolState({
    filterSettings,
    gateConfig,
    nudgeConfig,
    historyCleanupForBlocked,
    concealBlockedBookmarks,
    artifactRuntimeSnapshot,
  });
  const normalizedSignals = normalizeProgressionArtifactDisclosureSignals(signalSnapshot, { policy });
  const plan = buildProgressionArtifactDisclosurePlan({ signalSnapshot, policy });
  const supportScores = scoreProgressionSupportArtifactDisclosure(signalSnapshot, { policy });
  const causalityScore = scoreProgressionCausalityDisclosure(signalSnapshot, { policy });

  return Object.freeze({
    source: ARTIFACT_DISCLOSURE_EXPERIMENT_SOURCE,
    signalSnapshot,
    normalizedSignals,
    orderedArtifactIds: plan.orderedArtifactIds,
    entries: plan.entries,
    support: Object.freeze({
      mode: plan.support.mode,
      rows: resolveSupportRows({
        policy,
        normalizedSignals,
        supportScores,
      }),
    }),
    causality: resolveCausalityModel({
      policy,
      plan,
      normalizedSignals,
      causalityScore,
    }),
  });
}

export default buildArtifactDisclosureExperimentModel;
