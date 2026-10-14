import {
  PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS,
  PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} from '../policy/progressionPolicy.js';
import { resolveActivityDayWindow } from '../../stats/shared/activityDay.js';
import { resolveProgressionFamilyUnlockDay } from '../policy/progressionJourneyPolicy.js';

const CAUSALITY_SIGNAL_KEYS = Object.freeze([
  'intentThreshold',
  'textRhythm',
  'detourSpreadGuard',
]);

const EMPTY_OBJECT = Object.freeze({});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clampHour(value, fallback = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(23, Math.max(0, Math.floor(numeric)));
}

function normalizeArtifactId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueArtifactIds(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(normalizeArtifactId)
      .filter(Boolean),
  ));
}

function normalizeSignalValue(value) {
  if (value === true) return 1;
  if (value === false || value == null) return 0;
  if (typeof value === 'number') return clamp01(value);
  if (isPlainObject(value)) {
    for (const key of ['score', 'ratio', 'intensity', 'weight']) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        return clamp01(value[key]);
      }
    }
    if (Object.prototype.hasOwnProperty.call(value, 'count')) {
      return clamp01(Number(value.count) / 3);
    }
  }
  return 0;
}

function resolveConfiguredCausalitySignalScale(policy) {
  return clamp01(policy.sequence?.barrierEvidence?.configuredSignalScale);
}

function normalizeCausalitySignalValue(value, policy) {
  const configuredSignalScale = resolveConfiguredCausalitySignalScale(policy);
  const configured = isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'configured')
    ? normalizeSignalValue(value.configured)
    : 0;
  const observed = isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, 'observed')
    ? normalizeSignalValue(value.observed)
    : normalizeSignalValue(value);
  const score = Math.max(observed, clamp01(configured * configuredSignalScale));

  return Object.freeze({
    configured,
    observed,
    score,
  });
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function resolveCadencePolicy(policy) {
  const cadence = policy.sequence?.disclosureCadence || {};
  const resetHour = clampHour(cadence.resetHour, 4);
  return Object.freeze({
    mode: cadence.mode === 'activity_day' ? 'activity_day' : 'activity_day',
    resetHour,
    initialVisibleCount: Math.max(1, Math.floor(Number(cadence.initialVisibleCount) || 1)),
    artifactsPerCycle: Math.max(1, Math.floor(Number(cadence.artifactsPerCycle) || 1)),
    boundaryContinuityGraceMs: Math.max(0, Math.floor(Number(cadence.boundaryContinuityGraceMs) || 0)),
  });
}

function resolveActivityCycleStartMs(timestamp, resetHour) {
  if (timestamp === null || typeof timestamp === 'undefined' || timestamp === '') return null;
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return resolveActivityDayWindow({
    now: Math.floor(numeric),
    resetHour,
  }).startEpochMs;
}

export function resolveProgressionArtifactDisclosureCycleKey({
  atMs = Date.now(),
  resetHour = 4,
} = {}) {
  const cycleStartMs = resolveActivityCycleStartMs(atMs, clampHour(resetHour, 4));
  return cycleStartMs === null
    ? ''
    : resolveActivityDayWindow({ now: cycleStartMs, resetHour }).startDateStr;
}

function projectDurableArtifactDisclosure({
  orderedArtifactIds = [],
  disclosedArtifactIds = [],
  qualifiedActivityDayCount = 0,
  lastProcessedActivityDayKey = '',
  nowMs = Date.now(),
  policy,
} = {}) {
  const cadence = resolveCadencePolicy(policy);
  const disclosedSet = new Set(uniqueArtifactIds(disclosedArtifactIds));
  const disclosedCount = orderedArtifactIds.filter((artifactId) => disclosedSet.has(artifactId)).length;

  return Object.freeze({
    enabled: true,
    mode: cadence.mode,
    resetHour: cadence.resetHour,
    startedAtMs: null,
    nowMs,
    startedCycleKey: '',
    currentCycleKey: resolveProgressionArtifactDisclosureCycleKey({
      atMs: nowMs,
      resetHour: cadence.resetHour,
    }),
    elapsedCycleCount: Math.max(0, Math.floor(Number(qualifiedActivityDayCount) || 0)),
    initialVisibleCount: cadence.initialVisibleCount,
    artifactsPerCycle: cadence.artifactsPerCycle,
    boundaryContinuityGraceMs: 0,
    lastProcessedActivityDayKey,
    disclosedCount,
    pendingCount: Math.max(0, orderedArtifactIds.length - disclosedCount),
  });
}

function resolveSignalRoot(signalSnapshot = null) {
  return isPlainObject(signalSnapshot) ? signalSnapshot : EMPTY_OBJECT;
}

function resolveArtifactSignalSource(signalSnapshot = null, artifactId = '') {
  const root = resolveSignalRoot(signalSnapshot);
  const support = isPlainObject(root.support) ? root.support : EMPTY_OBJECT;
  const artifacts = isPlainObject(root.artifacts) ? root.artifacts : EMPTY_OBJECT;

  if (isPlainObject(support[artifactId])) return support[artifactId];
  if (isPlainObject(artifacts[artifactId])) return artifacts[artifactId];
  if (isPlainObject(root[artifactId])) return root[artifactId];
  return root;
}

function resolveSupportArtifactIds(policy) {
  const supportSignals = policy.sequence?.supportSignals || {};
  return uniqueArtifactIds([
    ...(Array.isArray(supportSignals.defaultOrder) ? supportSignals.defaultOrder : []),
    ...(Array.isArray(supportSignals.artifactIds) ? supportSignals.artifactIds : []),
  ]);
}

function normalizeSupportArtifactSignals(signalSnapshot = null, policy) {
  const supportSignals = policy.sequence?.supportSignals || {};
  const weightsByArtifact = isPlainObject(supportSignals.signalWeights)
    ? supportSignals.signalWeights
    : EMPTY_OBJECT;
  return resolveSupportArtifactIds(policy).reduce((acc, artifactId) => {
    const weights = isPlainObject(weightsByArtifact[artifactId])
      ? weightsByArtifact[artifactId]
      : EMPTY_OBJECT;
    const source = resolveArtifactSignalSource(signalSnapshot, artifactId);
    acc[artifactId] = Object.freeze(Object.keys(weights).reduce((signalAcc, key) => {
      signalAcc[key] = normalizeSignalValue(source[key]);
      return signalAcc;
    }, {}));
    return acc;
  }, {});
}

export function normalizeProgressionArtifactDisclosureSignals(signalSnapshot = null, {
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const root = resolveSignalRoot(signalSnapshot);
  const source = isPlainObject(root.causality) ? root.causality : root;
  const causality = CAUSALITY_SIGNAL_KEYS.reduce((acc, key) => {
    acc[key] = normalizeCausalitySignalValue(source[key], policy);
    return acc;
  }, {});

  return Object.freeze({
    causality: Object.freeze(causality),
    support: Object.freeze(normalizeSupportArtifactSignals(signalSnapshot, policy)),
  });
}

export function scoreProgressionCausalityDisclosure(signals = {}, {
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const evidencePolicy = policy.sequence?.barrierEvidence || {};
  const weights = isPlainObject(evidencePolicy.signalWeights)
    ? evidencePolicy.signalWeights
    : {};
  const normalizedSignals = normalizeProgressionArtifactDisclosureSignals(signals, { policy });
  const score = CAUSALITY_SIGNAL_KEYS.reduce((total, key) => (
    total + ((normalizedSignals.causality[key]?.score || 0) * (Number(weights[key]) || 0))
  ), Number(evidencePolicy.basePriority) || 0);

  return roundScore(score);
}

export function scoreProgressionSupportArtifactDisclosure(signals = {}, {
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const supportSignals = policy.sequence?.supportSignals || {};
  const weightsByArtifact = isPlainObject(supportSignals.signalWeights)
    ? supportSignals.signalWeights
    : EMPTY_OBJECT;
  const normalizedSignals = normalizeProgressionArtifactDisclosureSignals(signals, { policy });

  return Object.freeze(resolveSupportArtifactIds(policy).reduce((acc, artifactId) => {
    const weights = isPlainObject(weightsByArtifact[artifactId])
      ? weightsByArtifact[artifactId]
      : EMPTY_OBJECT;
    const artifactSignals = isPlainObject(normalizedSignals.support[artifactId])
      ? normalizedSignals.support[artifactId]
      : EMPTY_OBJECT;
    const score = Object.entries(weights).reduce((total, [key, weight]) => (
      total + (artifactSignals[key] * (Number(weight) || 0))
    ), 0);
    acc[artifactId] = roundScore(score);
    return acc;
  }, {}));
}

function pinFirstAndFinal(order, policy) {
  const firstArtifactId = normalizeArtifactId(policy.sequence?.firstArtifactId);
  const finalArtifactId = normalizeArtifactId(policy.sequence?.finalArtifactId);
  let next = uniqueArtifactIds(order);

  if (firstArtifactId) {
    next = [firstArtifactId, ...next.filter((artifactId) => artifactId !== firstArtifactId)];
  }
  if (finalArtifactId) {
    next = [...next.filter((artifactId) => artifactId !== finalArtifactId), finalArtifactId];
  }
  return next;
}

function resolveCausalityBand(score, policy) {
  const evidence = policy.sequence?.barrierEvidence || {};
  const bands = evidence.bands || {};
  const bandId = score >= Number(bands.strong?.minScore)
    ? 'strong'
    : (score >= Number(bands.moderate?.minScore)
      ? 'moderate'
      : evidence.defaultBand || 'baseline');
  return bands[bandId]
    ? Object.freeze({ id: bandId })
    : null;
}

export function resolveProgressionArtifactDisclosureOrder({
  signalSnapshot = null,
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const sequence = policy.sequence || {};
  const defaultOrder = uniqueArtifactIds(sequence.defaultOrder);
  const evidencePolicy = sequence.barrierEvidence || {};
  const evidenceArtifactId = normalizeArtifactId(evidencePolicy.artifactId);
  const orderedArtifactIds = defaultOrder;
  const supportScores = scoreProgressionSupportArtifactDisclosure(signalSnapshot, { policy });
  let causalityScore = 0;
  let causalityBand = null;

  if (evidenceArtifactId) {
    causalityScore = scoreProgressionCausalityDisclosure(signalSnapshot, { policy });
    causalityBand = resolveCausalityBand(causalityScore, policy);
  }

  return Object.freeze({
    orderedArtifactIds: Object.freeze(pinFirstAndFinal(orderedArtifactIds, policy)),
    causality: Object.freeze({
      artifactId: evidenceArtifactId,
      score: causalityScore,
      band: causalityBand,
      interpretationKey: evidencePolicy.interpretationKey || '',
    }),
    support: Object.freeze({
      artifactIds: Object.freeze(resolveSupportArtifactIds(policy)),
      scores: supportScores,
      mode: 'absolute_signal_only',
    }),
  });
}

function resolveArtifactGroupId(artifactId, policy) {
  const groups = Array.isArray(policy.sequence?.groups) ? policy.sequence.groups : [];
  return groups.find((group) => (
    Array.isArray(group?.artifactIds) && group.artifactIds.includes(artifactId)
  ))?.id || '';
}

export function buildProgressionArtifactDisclosurePlan({
  openedArtifactIds = [],
  disclosedArtifactIds = [],
  disclosureSnapshot = null,
  signalSnapshot = null,
  nowMs = Date.now(),
  policy = PROGRESSION_ARTIFACT_EXPERIMENT_POLICY,
} = {}) {
  const openedSet = new Set(uniqueArtifactIds(openedArtifactIds));
  const order = resolveProgressionArtifactDisclosureOrder({ signalSnapshot, policy });
  const durableDisclosedArtifactIds = uniqueArtifactIds(
    Array.isArray(disclosureSnapshot?.disclosedFamilyIds)
      ? disclosureSnapshot.disclosedFamilyIds
      : disclosedArtifactIds,
  );
  const cadence = projectDurableArtifactDisclosure({
    orderedArtifactIds: order.orderedArtifactIds,
    disclosedArtifactIds: durableDisclosedArtifactIds,
    qualifiedActivityDayCount: disclosureSnapshot?.qualifiedActivityDayCount,
    lastProcessedActivityDayKey: disclosureSnapshot?.lastProcessedActivityDayKey || '',
    nowMs,
    policy,
  });
  const disclosedSet = new Set(durableDisclosedArtifactIds);
  const nextArtifactId = order.orderedArtifactIds.find(
    (artifactId) => !disclosedSet.has(artifactId),
  ) || '';
  const entries = order.orderedArtifactIds.map((artifactId, index) => Object.freeze({
    artifactId,
    position: index + 1,
    groupId: resolveArtifactGroupId(artifactId, policy),
    opened: openedSet.has(artifactId),
    disclosed: disclosedSet.has(artifactId),
    locked: !disclosedSet.has(artifactId),
    next: artifactId === nextArtifactId,
    disclosureCycleIndex: resolveProgressionFamilyUnlockDay(artifactId),
    fixedFirst: artifactId === policy.sequence?.firstArtifactId,
    fixedFinal: artifactId === policy.sequence?.finalArtifactId,
    barrierEvidence: artifactId === order.causality.artifactId,
  }));

  return Object.freeze({
    orderedArtifactIds: order.orderedArtifactIds,
    disclosedArtifactIds: Object.freeze(order.orderedArtifactIds.filter(
      (artifactId) => disclosedSet.has(artifactId),
    )),
    nextArtifactId,
    entries: Object.freeze(entries),
    entriesByArtifactId: Object.freeze(entries.reduce((acc, entry) => {
      acc[entry.artifactId] = entry;
      return acc;
    }, {})),
    groups: Object.freeze({
      foundation: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.FOUNDATION,
      grounding: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.GROUNDING,
      integration: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.INTEGRATION,
      barrierEvidence: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.BARRIER_EVIDENCE,
      finalReflection: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.FINAL_REFLECTION,
    }),
    support: order.support,
    causality: order.causality,
    cadence,
  });
}
