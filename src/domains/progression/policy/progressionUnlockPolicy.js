import {
  PROGRESSION_BONSAI_RELEASE_CONTRACT,
  PROGRESSION_BONSAI_RELEASE_STAGE_IDS,
  PROGRESSION_BONSAI_RELEASE_STAGES,
  PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE,
  PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT,
  buildProgressionBonsaiRelease,
  requireProgressionBonsaiRelease,
  isProgressionBonsaiFirstBloomEligible,
} from '../contracts/progressionBonsaiRelease.js';
import {
  PROGRESSION_ARTIFACT_ACCESS_MODES,
  requireProgressionArtifactAccessMode,
  resolveProgressionArtifactAccess,
} from './progressionArtifactAccessPolicy.js';
import {
  PROGRESSION_JOURNEY_FAMILY_ORDER,
  PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
  resolveProgressionJourneyFamilyIds,
  resolveProgressionJourneyStage,
} from './progressionJourneyPolicy.js';
import { PROGRESSION_REPRESENTED_SITE_LIMIT,
  PROGRESSION_REGISTRATION_TARGET_DAY_COUNT,
  PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT,
  resolveProgressionSiteRegistrationBudget } from './progressionRegistrationPolicy.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from './progressionPreviewPolicy.js';
import { buildQualifiedUseFacts, requireQualifiedUseFacts } from '../contracts/qualifiedUseFacts.js';
import { PROGRESSION_QUALIFIED_USE_DAY_POLICY } from './qualifiedUsePolicy.js';

export {
  PROGRESSION_BONSAI_RELEASE_CONTRACT,
  PROGRESSION_BONSAI_RELEASE_STAGE_IDS,
  PROGRESSION_BONSAI_RELEASE_STAGES,
  PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE,
  PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT,
  buildProgressionBonsaiRelease,
  requireProgressionBonsaiRelease,
  PROGRESSION_QUALIFIED_USE_DAY_POLICY,
};

export const PROGRESSION_UNLOCK_SNAPSHOT_CONTRACT = 'progression_unlock_v3';

export const PROGRESSION_UNLOCK_SOURCES = Object.freeze({
  CANONICAL: 'canonical',
  DEBUG_OVERRIDE: 'debug_override',
});

const SOURCE_VALUES = new Set(Object.values(PROGRESSION_UNLOCK_SOURCES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createUnlockProgressContractError(field) {
  const error = new Error(`PROGRESSION_UNLOCK_CONTRACT_INVALID:${field}`);
  error.code = 'PROGRESSION_UNLOCK_CONTRACT_INVALID';
  error.field = field;
  return error;
}

function requireDayCount(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createUnlockProgressContractError(field);
  }
  return value;
}

function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createUnlockProgressContractError(field);
  }
  return value;
}

function requireSiteRegistrationBudget(value, field) {
  if (
    !isPlainObject(value)
    || !['limited', 'unlimited'].includes(value.mode)
    || (value.mode === 'limited'
      && (!Number.isInteger(value.limit) || value.limit < 1 || Object.keys(value).length !== 2))
    || (value.mode === 'unlimited' && Object.keys(value).length !== 1)
  ) throw createUnlockProgressContractError(field);
  return value;
}

function requireArtifactDisclosureInput(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw createUnlockProgressContractError('artifactDisclosureSnapshot');
  }
  if (
    !Array.isArray(snapshot.orderedFamilyIds)
    || snapshot.orderedFamilyIds.length !== PROGRESSION_JOURNEY_FAMILY_ORDER.length
    || snapshot.orderedFamilyIds.some((familyId, index) => familyId !== PROGRESSION_JOURNEY_FAMILY_ORDER[index])
    || !Array.isArray(snapshot.disclosedFamilyIds)
  ) {
    throw createUnlockProgressContractError('orderedFamilyIds');
  }
  if (!isPlainObject(snapshot.entriesByFamilyId)
    || Object.keys(snapshot.entriesByFamilyId).length !== PROGRESSION_JOURNEY_FAMILY_ORDER.length) {
    throw createUnlockProgressContractError('entriesByFamilyId');
  }
  const accessMode = requireProgressionArtifactAccessMode(snapshot.accessMode);
  const seenFamilyIds = new Set();
  snapshot.orderedFamilyIds.forEach((familyId) => {
    const entry = snapshot.entriesByFamilyId[familyId];
    if (
      typeof familyId !== 'string'
      || !familyId.trim()
      || seenFamilyIds.has(familyId)
      || !isPlainObject(entry)
      || entry.familyId !== familyId
      || typeof entry.disclosed !== 'boolean'
      || typeof entry.visible !== 'boolean'
      || typeof entry.configurable !== 'boolean'
      || typeof entry.runtimeEligible !== 'boolean'
    ) {
      throw createUnlockProgressContractError('orderedFamilyIds');
    }
    const expectedAccess = resolveProgressionArtifactAccess(entry.disclosed, { accessMode });
    if (
      entry.visible !== expectedAccess.visible
      || entry.configurable !== expectedAccess.configurable
      || entry.runtimeEligible !== expectedAccess.runtimeEligible
    ) {
      throw createUnlockProgressContractError(`entriesByFamilyId.${familyId}.access`);
    }
    seenFamilyIds.add(familyId);
  });
  const expectedDisclosedFamilyIds = snapshot.orderedFamilyIds.filter(
    (familyId) => snapshot.entriesByFamilyId[familyId].disclosed);
  if (
    snapshot.disclosedFamilyIds.some((familyId) => !seenFamilyIds.has(familyId))
    || new Set(snapshot.disclosedFamilyIds).size !== snapshot.disclosedFamilyIds.length
    || !equalIds(snapshot.disclosedFamilyIds, expectedDisclosedFamilyIds)
  ) {
    throw createUnlockProgressContractError('disclosedFamilyIds');
  }
  requireDayCount(snapshot.qualifiedActivityDayCount, 'qualifiedActivityDayCount');
  requireTimestamp(snapshot.stateUpdatedAtMs, 'stateUpdatedAtMs');
  buildQualifiedUseFacts({ canonicalDayCount: snapshot.qualifiedActivityDayCount,
    effectiveDayCount: snapshot.qualifiedActivityDayCount,
    lastActivityDayKey: snapshot.lastProcessedActivityDayKey });
  if (typeof snapshot.bonsaiFirstBloomOpened !== 'boolean') {
    throw createUnlockProgressContractError('bonsaiFirstBloomOpened');
  }
  if (typeof snapshot.canonicalFirstVisionSpent !== 'boolean') {
    throw createUnlockProgressContractError('canonicalFirstVisionSpent');
  }
  return snapshot;
}

function resolveJourneyFamilyIds(snapshot, {
  qualifiedUseDayCount,
  debugOverrideActive,
} = {}) {
  if (!debugOverrideActive) {
    return Object.freeze([...snapshot.disclosedFamilyIds]);
  }
  return resolveProgressionJourneyFamilyIds(qualifiedUseDayCount, { firstVisionSpent: true });
}

function resolveAccessibleFamilyIds(snapshot, journeyFamilyIds) {
  return snapshot.accessMode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN
    ? Object.freeze([...snapshot.orderedFamilyIds])
    : Object.freeze([...journeyFamilyIds]);
}

export function normalizeProgressionUnlockDebugDay(value) {
  const normalized = requireDayCount(value, 'debugDayCount');
  if (normalized > PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT) {
    throw createUnlockProgressContractError('debugDayCount');
  }
  return normalized;
}

export function resolveProgressionUnlockBonsaiGrowthScore(dayCount) {
  return buildProgressionBonsaiRelease(dayCount).growthScore;
}

function hasPendingProgressionSchedule(dayCount) {
  return dayCount < PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT
    || dayCount < PROGRESSION_REGISTRATION_TARGET_DAY_COUNT
    || dayCount < PROGRESSION_DIRECT_REGISTRATION_DAY_COUNT
    || dayCount < PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT;
}

export function buildProgressionUnlockSnapshot(
  artifactDisclosureSnapshot,
  { debugDayCount = null, debugUpdatedAtMs = 0 } = {},
) {
  const snapshot = requireArtifactDisclosureInput(artifactDisclosureSnapshot);
  const qualifiedUseFacts = buildQualifiedUseFacts({
    canonicalDayCount: snapshot.qualifiedActivityDayCount,
    effectiveDayCount: debugDayCount === null ? snapshot.qualifiedActivityDayCount
      : normalizeProgressionUnlockDebugDay(debugDayCount),
    lastActivityDayKey: snapshot.lastProcessedActivityDayKey,
  });
  const canonicalQualifiedUseDayCount = Math.min(
    PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
    qualifiedUseFacts.canonicalDayCount,
  );
  const debugOverrideActive = debugDayCount !== null;
  const qualifiedUseDayCount = Math.min(PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
    qualifiedUseFacts.effectiveDayCount);
  const source = debugOverrideActive
    ? PROGRESSION_UNLOCK_SOURCES.DEBUG_OVERRIDE
    : PROGRESSION_UNLOCK_SOURCES.CANONICAL;
  const journeyFamilyIds = resolveJourneyFamilyIds(snapshot, {
    qualifiedUseDayCount,
    debugOverrideActive,
  });
  const journeyFamilyIdSet = new Set(journeyFamilyIds);
  const effectiveFamilyIds = resolveAccessibleFamilyIds(snapshot, journeyFamilyIds);
  const nextFamilyId = snapshot.orderedFamilyIds.find(
    (familyId) => !journeyFamilyIdSet.has(familyId),
  ) || '';
  const normalizedDebugUpdatedAtMs = debugOverrideActive
    ? requireTimestamp(debugUpdatedAtMs, 'debugUpdatedAtMs')
    : 0;
  const nextDayCount = qualifiedUseFacts.effectiveDayCount + 1;
  const nextStage = !hasPendingProgressionSchedule(qualifiedUseFacts.effectiveDayCount) ? null : Object.freeze({
    qualifiedUseDayCount: nextDayCount,
    newFamilyIds: Object.freeze(resolveProgressionJourneyStage(nextDayCount).newFamilyIds
      .filter((familyId) => !effectiveFamilyIds.includes(familyId))),
    siteRegistrationBudget: resolveProgressionSiteRegistrationBudget(nextDayCount, {
      accessOpen: snapshot.accessMode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN,
    }),
    bonsaiRelease: buildProgressionBonsaiRelease(nextDayCount),
  });

  return Object.freeze({
    contract: PROGRESSION_UNLOCK_SNAPSHOT_CONTRACT,
    targetDayCount: PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
    qualifiedUseFacts,
    canonicalQualifiedUseDayCount,
    qualifiedUseDayCount,
    source,
    debugOverrideActive,
    debugUpdatedAtMs: normalizedDebugUpdatedAtMs,
    lastQualifiedUseDayKey: qualifiedUseFacts.lastActivityDayKey,
    effectiveFamilyIds,
    canonicalDisclosedFamilyIds: Object.freeze([...snapshot.disclosedFamilyIds]),
    nextFamilyId,
    siteRegistrationBudget: resolveProgressionSiteRegistrationBudget(qualifiedUseFacts.effectiveDayCount, {
      accessOpen: snapshot.accessMode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN,
    }),
    representedSiteLimit: PROGRESSION_REPRESENTED_SITE_LIMIT,
    nextStage,
    bonsaiRelease: buildProgressionBonsaiRelease(qualifiedUseFacts.effectiveDayCount),
    canonicalBonsaiRelease: buildProgressionBonsaiRelease(qualifiedUseFacts.canonicalDayCount),
    bonsaiFirstBloomOpened: snapshot.bonsaiFirstBloomOpened,
    bonsaiFirstBloom: Object.freeze({
      canonicalFirstVisionSpent: snapshot.canonicalFirstVisionSpent,
      opened: snapshot.bonsaiFirstBloomOpened,
      eligible: isProgressionBonsaiFirstBloomEligible({
        canonicalMode: source === PROGRESSION_UNLOCK_SOURCES.CANONICAL,
        firstVisionSpent: snapshot.canonicalFirstVisionSpent,
        bonsaiFirstBloomOpened: snapshot.bonsaiFirstBloomOpened,
        bonsaiRelease: buildProgressionBonsaiRelease(qualifiedUseFacts.effectiveDayCount),
      }),
    }),
    qualificationPolicy: PROGRESSION_QUALIFIED_USE_DAY_POLICY,
  });
}

export function attachProgressionUnlockSnapshot(artifactDisclosureSnapshot) {
  const snapshot = requireArtifactDisclosureInput(artifactDisclosureSnapshot);
  return Object.freeze({
    ...snapshot,
    unlockProgress: buildProgressionUnlockSnapshot(snapshot),
  });
}

export function projectArtifactDisclosureSnapshotForProgressionUnlockDebug(
  artifactDisclosureSnapshot,
  { dayCount, updatedAtMs = 0, accessMode = PROGRESSION_ARTIFACT_ACCESS_MODES.JOURNEY_GATED } = {},
) {
  const canonicalSnapshot = requireArtifactDisclosureInput(artifactDisclosureSnapshot);
  const projectedAccessMode = requireProgressionArtifactAccessMode(accessMode);
  const sourceEntries = canonicalSnapshot.orderedFamilyIds.map((familyId) => {
    const entry = canonicalSnapshot.entriesByFamilyId[familyId];
    return Object.freeze({ ...entry, ...resolveProgressionArtifactAccess(entry.disclosed, { accessMode: projectedAccessMode }) });
  });
  const snapshot = requireArtifactDisclosureInput({
    ...canonicalSnapshot,
    accessMode: projectedAccessMode,
    entries: sourceEntries,
    entriesByFamilyId: Object.fromEntries(sourceEntries.map((entry) => [entry.familyId, entry])),
  });
  const unlockProgress = buildProgressionUnlockSnapshot(snapshot, {
    debugDayCount: normalizeProgressionUnlockDebugDay(dayCount),
    debugUpdatedAtMs: updatedAtMs,
  });
  const journeyFamilyIds = resolveJourneyFamilyIds(snapshot, {
    qualifiedUseDayCount: unlockProgress.qualifiedUseDayCount,
    debugOverrideActive: true,
  });
  const journeyFamilyIdSet = new Set(journeyFamilyIds);
  const entries = Object.freeze(snapshot.orderedFamilyIds.map((familyId) => {
    const sourceEntry = snapshot.entriesByFamilyId[familyId];
    const disclosed = journeyFamilyIdSet.has(familyId);
    const access = resolveProgressionArtifactAccess(disclosed, {
      accessMode: snapshot.accessMode,
    });
    return Object.freeze({
      ...sourceEntry,
      canonicalDisclosed: sourceEntry.disclosed === true,
      disclosed,
      ...access,
      next: familyId === unlockProgress.nextFamilyId,
      effectiveDisclosureSource: PROGRESSION_UNLOCK_SOURCES.DEBUG_OVERRIDE,
    });
  }));
  const entriesByFamilyId = Object.freeze(entries.reduce((acc, entry) => {
    acc[entry.familyId] = entry;
    return acc;
  }, {}));

  return Object.freeze({
    ...snapshot,
    canonicalDisclosedFamilyIds: canonicalSnapshot.disclosedFamilyIds,
    disclosedFamilyIds: journeyFamilyIds,
    nextFamilyId: unlockProgress.nextFamilyId,
    entries,
    entriesByFamilyId,
    unlockProgress,
  });
}

function equalIds(left, right) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function equalBudget(left, right) {
  return left.mode === right.mode && (left.mode === 'unlimited' || left.limit === right.limit);
}

export function requireProgressionUnlockSnapshot(value, { accessMode } = {}) {
  if (!isPlainObject(value) || value.contract !== PROGRESSION_UNLOCK_SNAPSHOT_CONTRACT) {
    throw createUnlockProgressContractError('snapshot.contract');
  }
  if (value.targetDayCount !== PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT) {
    throw createUnlockProgressContractError('targetDayCount');
  }
  const facts = requireQualifiedUseFacts(value.qualifiedUseFacts);
  const canonicalQualifiedUseDayCount = requireDayCount(
    value.canonicalQualifiedUseDayCount,
    'canonicalQualifiedUseDayCount',
  );
  const qualifiedUseDayCount = requireDayCount(
    value.qualifiedUseDayCount,
    'qualifiedUseDayCount',
  );
  if (
    canonicalQualifiedUseDayCount !== Math.min(facts.canonicalDayCount, PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT)
    || qualifiedUseDayCount !== Math.min(facts.effectiveDayCount, PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT)
  ) {
    throw createUnlockProgressContractError('dayCount');
  }
  if (!SOURCE_VALUES.has(value.source)) {
    throw createUnlockProgressContractError('source');
  }
  if (value.debugOverrideActive !== (value.source === PROGRESSION_UNLOCK_SOURCES.DEBUG_OVERRIDE)) {
    throw createUnlockProgressContractError('debugOverrideActive');
  }
  if (
    value.source === PROGRESSION_UNLOCK_SOURCES.CANONICAL
    && facts.effectiveDayCount !== facts.canonicalDayCount
  ) {
    throw createUnlockProgressContractError('qualifiedUseDayCount');
  }
  if (!Number.isInteger(value.debugUpdatedAtMs) || value.debugUpdatedAtMs < 0) {
    throw createUnlockProgressContractError('debugUpdatedAtMs');
  }
  if (value.lastQualifiedUseDayKey !== facts.lastActivityDayKey) {
    throw createUnlockProgressContractError('lastQualifiedUseDayKey');
  }
  if (
    !Array.isArray(value.effectiveFamilyIds)
    || value.effectiveFamilyIds.some((familyId) => !PROGRESSION_JOURNEY_FAMILY_ORDER.includes(familyId))
    || new Set(value.effectiveFamilyIds).size !== value.effectiveFamilyIds.length
  ) {
    throw createUnlockProgressContractError('effectiveFamilyIds');
  }
  if (!Array.isArray(value.canonicalDisclosedFamilyIds)
    || value.canonicalDisclosedFamilyIds.some((familyId) => !PROGRESSION_JOURNEY_FAMILY_ORDER.includes(familyId))
    || new Set(value.canonicalDisclosedFamilyIds).size !== value.canonicalDisclosedFamilyIds.length) {
    throw createUnlockProgressContractError('canonicalDisclosedFamilyIds');
  }
  if (!equalIds(value.canonicalDisclosedFamilyIds,
    PROGRESSION_JOURNEY_FAMILY_ORDER.filter((id) => value.canonicalDisclosedFamilyIds.includes(id)))) {
    throw createUnlockProgressContractError('canonicalDisclosedFamilyIds.order');
  }
  if (value.debugOverrideActive) normalizeProgressionUnlockDebugDay(facts.effectiveDayCount);
  else if (value.debugUpdatedAtMs !== 0) throw createUnlockProgressContractError('debugUpdatedAtMs');
  const journeyFamilyIds = value.debugOverrideActive
    ? resolveProgressionJourneyFamilyIds(facts.effectiveDayCount, { firstVisionSpent: true })
    : value.canonicalDisclosedFamilyIds;
  const nextFamilyId = PROGRESSION_JOURNEY_FAMILY_ORDER.find((id) => !journeyFamilyIds.includes(id)) || '';
  if (value.nextFamilyId !== nextFamilyId) throw createUnlockProgressContractError('nextFamilyId');
  requireProgressionBonsaiRelease(value.bonsaiRelease);
  requireProgressionBonsaiRelease(value.canonicalBonsaiRelease);
  if (value.canonicalBonsaiRelease.qualifiedUseDayCount !== Math.min(facts.canonicalDayCount, PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT)) {
    throw createUnlockProgressContractError('canonicalBonsaiRelease.qualifiedUseDayCount');
  }
  if (typeof value.bonsaiFirstBloomOpened !== 'boolean') {
    throw createUnlockProgressContractError('bonsaiFirstBloomOpened');
  }
  if (!isPlainObject(value.bonsaiFirstBloom) || Object.keys(value.bonsaiFirstBloom).length !== 3
    || value.bonsaiFirstBloom.opened !== value.bonsaiFirstBloomOpened
    || value.bonsaiFirstBloom.eligible !== isProgressionBonsaiFirstBloomEligible({
      canonicalMode: value.source === PROGRESSION_UNLOCK_SOURCES.CANONICAL,
      firstVisionSpent: value.bonsaiFirstBloom.canonicalFirstVisionSpent,
      bonsaiFirstBloomOpened: value.bonsaiFirstBloomOpened,
      bonsaiRelease: value.bonsaiRelease,
    })) {
    throw createUnlockProgressContractError('bonsaiFirstBloom');
  }
  if (value.bonsaiFirstBloom.canonicalFirstVisionSpent
    && resolveProgressionJourneyFamilyIds(facts.canonicalDayCount, { firstVisionSpent: true })
      .some((familyId) => !value.canonicalDisclosedFamilyIds.includes(familyId))) {
    throw createUnlockProgressContractError('canonicalDisclosedFamilyIds.qualifiedUsePrefix');
  }
  if (value.representedSiteLimit !== PROGRESSION_REPRESENTED_SITE_LIMIT) {
    throw createUnlockProgressContractError('representedSiteLimit');
  }
  requireSiteRegistrationBudget(value.siteRegistrationBudget, 'siteRegistrationBudget');
  if (value.bonsaiRelease.qualifiedUseDayCount !== Math.min(facts.effectiveDayCount, PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT)) {
    throw createUnlockProgressContractError('bonsaiRelease.qualifiedUseDayCount');
  }
  if (value.source === PROGRESSION_UNLOCK_SOURCES.CANONICAL
    && accessMode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN) {
    throw createUnlockProgressContractError('canonicalArtifactAccessMode');
  }
  const modes = accessMode === undefined ? (value.source === PROGRESSION_UNLOCK_SOURCES.CANONICAL
    ? [PROGRESSION_ARTIFACT_ACCESS_MODES.JOURNEY_GATED] : Object.values(PROGRESSION_ARTIFACT_ACCESS_MODES))
    : [requireProgressionArtifactAccessMode(accessMode)];
  const matchingModes = modes.filter((mode) => {
    const accessOpen = mode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN;
    return equalIds(value.effectiveFamilyIds, accessOpen ? PROGRESSION_JOURNEY_FAMILY_ORDER : journeyFamilyIds)
      && equalBudget(value.siteRegistrationBudget,
        resolveProgressionSiteRegistrationBudget(facts.effectiveDayCount, { accessOpen }));
  });
  if (matchingModes.length === 0) throw createUnlockProgressContractError('effectiveAccess');
  if (!hasPendingProgressionSchedule(facts.effectiveDayCount)) {
    if (value.nextStage !== null) throw createUnlockProgressContractError('nextStage');
  } else {
    const next = value.nextStage;
    const nextDayCount = facts.effectiveDayCount + 1;
    const expectedFamilyIds = resolveProgressionJourneyStage(nextDayCount).newFamilyIds
      .filter((familyId) => !value.effectiveFamilyIds.includes(familyId));
    if (!isPlainObject(next) || Object.keys(next).length !== 4
      || next.qualifiedUseDayCount !== nextDayCount || !Array.isArray(next.newFamilyIds)
      || next.newFamilyIds.length !== expectedFamilyIds.length
      || next.newFamilyIds.some((familyId, index) => familyId !== expectedFamilyIds[index])) {
      throw createUnlockProgressContractError('nextStage');
    }
    requireSiteRegistrationBudget(next.siteRegistrationBudget, 'nextStage.siteRegistrationBudget');
    requireProgressionBonsaiRelease(next.bonsaiRelease);
    if (next.bonsaiRelease.qualifiedUseDayCount !== Math.min(nextDayCount, PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT)) {
      throw createUnlockProgressContractError('nextStage.bonsaiRelease');
    }
    if (!matchingModes.some((mode) => equalBudget(next.siteRegistrationBudget,
      resolveProgressionSiteRegistrationBudget(nextDayCount, {
        accessOpen: mode === PROGRESSION_ARTIFACT_ACCESS_MODES.OPEN,
      })))) throw createUnlockProgressContractError('nextStage.siteRegistrationBudget');
  }
  if (!isPlainObject(value.qualificationPolicy)
    || Object.keys(value.qualificationPolicy).length !== Object.keys(PROGRESSION_QUALIFIED_USE_DAY_POLICY).length
    || Object.entries(PROGRESSION_QUALIFIED_USE_DAY_POLICY).some(([key, expected]) =>
      value.qualificationPolicy[key] !== expected)) {
    throw createUnlockProgressContractError('qualificationPolicy');
  }
  return value;
}

export function requireArtifactDisclosureSnapshot(value) {
  const snapshot = requireArtifactDisclosureInput(value);
  const unlock = requireProgressionUnlockSnapshot(snapshot.unlockProgress, { accessMode: snapshot.accessMode });
  if (unlock.qualifiedUseFacts.canonicalDayCount !== snapshot.qualifiedActivityDayCount
    || unlock.qualifiedUseFacts.lastActivityDayKey !== snapshot.lastProcessedActivityDayKey
    || unlock.bonsaiFirstBloomOpened !== snapshot.bonsaiFirstBloomOpened
    || unlock.bonsaiFirstBloom.canonicalFirstVisionSpent !== snapshot.canonicalFirstVisionSpent
    || snapshot.nextFamilyId !== unlock.nextFamilyId) {
    throw createUnlockProgressContractError('artifactDisclosureSnapshot.unlockProgress');
  }
  const expectedDisclosed = unlock.debugOverrideActive
    ? resolveProgressionJourneyFamilyIds(unlock.qualifiedUseFacts.effectiveDayCount, { firstVisionSpent: true })
    : unlock.canonicalDisclosedFamilyIds;
  if (!equalIds(snapshot.disclosedFamilyIds, expectedDisclosed)) {
    throw createUnlockProgressContractError('artifactDisclosureSnapshot.disclosedFamilyIds');
  }
  if (!Array.isArray(snapshot.entries) || snapshot.entries.length !== snapshot.orderedFamilyIds.length
    || snapshot.entries.some((entry, index) => {
      const familyId = snapshot.orderedFamilyIds[index];
      const mapped = snapshot.entriesByFamilyId[familyId];
      return !isPlainObject(entry) || entry.familyId !== familyId
        || Object.keys(entry).length !== Object.keys(mapped).length
        || Object.entries(mapped).some(([key, expected]) => entry[key] !== expected)
        || entry.next !== (familyId === snapshot.nextFamilyId);
    })) throw createUnlockProgressContractError('artifactDisclosureSnapshot.entries');
  return value;
}
