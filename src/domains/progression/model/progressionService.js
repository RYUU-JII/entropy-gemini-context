import {
  buildDegradedProgressionSnapshot,
  evaluateProgressionSnapshot,
} from './progressionEvaluator.js';
import {
  buildDefaultProgressionState,
  recordProgressionEvent,
  resetProgressionFirstVisionState,
} from './progressionSnapshot.js';
import {
  buildArtifactDisclosureSnapshot,
  normalizeArtifactDisclosureActivityDayKey,
} from '../policy/artifactDisclosurePolicy.js';
import {
  PROGRESSION_EVENT_TYPES,
  PROGRESSION_FIRST_VISION_STATES,
  PROGRESSION_MILESTONE_IDS,
} from '../contracts/progressionIds.js';
import {
  resolveProfileResetGeneration,
} from '../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import { createSiteRegistrationLimitError } from '../contracts/siteRegistrationRejection.js';
import { PROGRESSION_REPRESENTED_SITE_LIMIT,
  resolveProgressionNextSiteRegistrationIncreaseDay } from '../policy/progressionRegistrationPolicy.js';
import { buildProgressionBonsaiRelease,
  isProgressionBonsaiFirstBloomEligible } from '../contracts/progressionBonsaiRelease.js';
import {
  buildSiteRegistrationJourneySnapshot,
  hasCompletedSiteRegistrationJourney,
  requireAllowedSiteCount,
  requireProtectedSiteCount,
} from '../policy/siteRegistrationJourneyPolicy.js';

function describeProgressionError(error) {
  return {
    code: typeof error?.code === 'string' && error.code.trim()
      ? error.code.trim()
      : 'PROGRESSION_EVALUATION_FAILED',
    message: typeof error?.message === 'string' && error.message.trim()
      ? error.message.trim()
      : String(error || 'UNKNOWN_ERROR'),
  };
}

function assertProgressionRepository(repository) {
  if (
    !repository
    || typeof repository.readState !== 'function'
    || typeof repository.writeState !== 'function'
  ) {
    throw new Error('PROGRESSION_REPOSITORY_REQUIRED');
  }
}

function assertProgressionFactsProvider(factsProvider) {
  if (!factsProvider || typeof factsProvider.readFacts !== 'function') {
    throw new Error('PROGRESSION_FACTS_PROVIDER_REQUIRED');
  }
}

function assertProgressionUnlockDebugRepository(repository) {
  if (repository === null) return;
  if (
    !repository
    || typeof repository.readProjection !== 'function'
    || typeof repository.setMode !== 'function'
    || typeof repository.setDay !== 'function'
    || typeof repository.setCanonicalMode !== 'function'
    || typeof repository.projectArtifactDisclosureSnapshot !== 'function'
  ) {
    throw new Error('PROGRESSION_UNLOCK_DEBUG_REPOSITORY_INVALID');
  }
}

function assertProfileLifecycleRepository(repository) {
  if (
    !repository
    || typeof repository.read !== 'function'
    || typeof repository.assertWriteAdmission !== 'function'
  ) {
    throw new Error('PROGRESSION_PROFILE_LIFECYCLE_REPOSITORY_REQUIRED');
  }
}

function requireProfileGeneration(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_REQUIRED');
  }
  return value.trim();
}

function requireProgressionTimestamp(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('PROGRESSION_TIMESTAMP_REQUIRED');
  }
  return value;
}

const PROGRESSION_MAINTENANCE_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
});
const NO_EXPECTED_PROFILE_GENERATION = Symbol('no_expected_profile_generation');

function resolveLifecycleGeneration(lifecycle) {
  return requireProfileGeneration(resolveProfileResetGeneration(lifecycle));
}

function createProfileGenerationStaleError(expectedProfileGeneration, currentProfileGeneration) {
  const error = new Error('PROFILE_RESET_GENERATION_STALE');
  error.code = 'PROFILE_RESET_GENERATION_STALE';
  error.expectedProfileGeneration = expectedProfileGeneration;
  error.currentProfileGeneration = currentProfileGeneration;
  return error;
}

function buildFirstVisionProgressionSnapshot(state) {
  return Object.freeze({
    state: state.firstVision.state,
    presentedAtMs: state.firstVision.presentedAtMs,
    spentAtMs: state.firstVision.spentAtMs,
    stateUpdatedAtMs: state.updatedAtMs,
  });
}

function attachDevelopmentProjection(snapshot, developmentProjection) {
  if (developmentProjection === null) return snapshot;
  return Object.freeze({
    ...snapshot,
    developmentProjection,
  });
}

export function createProgressionService({
  repository,
  profileLifecycleRepository,
  factsProvider = null,
  unlockDebugRepository = null,
  onCommitted = null,
  now = () => Date.now(),
} = {}) {
  assertProgressionRepository(repository);
  assertProfileLifecycleRepository(profileLifecycleRepository);
  assertProgressionUnlockDebugRepository(unlockDebugRepository);
  if (onCommitted !== null && typeof onCommitted !== 'function') {
    throw new Error('PROGRESSION_COMMIT_OBSERVER_INVALID');
  }
  let currentOperationCommit = null;
  let operationQueue = Promise.resolve();
  let maintenancePhase = PROGRESSION_MAINTENANCE_PHASES.OPEN;
  let quiescePromise = null;
  let ownedProfileGeneration = null;
  let profileGenerationCaptureFailure = null;
  let profileGenerationCapturePromise = profileLifecycleRepository.read()
    .then((lifecycle) => {
      ownedProfileGeneration = resolveLifecycleGeneration(lifecycle);
      return ownedProfileGeneration;
    })
    .catch((error) => {
      profileGenerationCaptureFailure = error;
    });

  function assertOperationAdmissionOpen() {
    if (maintenancePhase !== PROGRESSION_MAINTENANCE_PHASES.OPEN) {
      throw new Error(`PROGRESSION_MAINTENANCE_ACTIVE:${maintenancePhase}`);
    }
  }

  async function assertNormalOperationAdmission(expectedProfileGeneration) {
    await profileGenerationCapturePromise;
    if (profileGenerationCaptureFailure) {
      throw profileGenerationCaptureFailure;
    }
    await profileLifecycleRepository.assertWriteAdmission({
      expectedResetId: ownedProfileGeneration,
    });
    if (
      expectedProfileGeneration !== NO_EXPECTED_PROFILE_GENERATION
      && expectedProfileGeneration !== ownedProfileGeneration
    ) {
      throw createProfileGenerationStaleError(
        expectedProfileGeneration,
        ownedProfileGeneration,
      );
    }
  }

  function enqueueOperation(
    operation,
    { expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION } = {},
  ) {
    assertOperationAdmissionOpen();
    const pending = operationQueue.then(async () => {
      await assertNormalOperationAdmission(expectedProfileGeneration);
      const commit = { changed: false };
      currentOperationCommit = commit;
      try {
        return await operation();
      } finally {
        currentOperationCommit = null;
        // The observer may query this owner. Never await it from our queue.
        // A successful storage ACK still invalidates readers if later result
        // projection fails; no failed write can publish a commit.
        if (commit.changed && onCommitted !== null) {
          const committedProfileGeneration = ownedProfileGeneration;
          void Promise.resolve().then(() => onCommitted({
            profileGeneration: committedProfileGeneration,
          })).catch(error => console.error('[progression] commit invalidation failed', error));
        }
      }
    });
    operationQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  function markOperationCommitted() {
    if (currentOperationCommit === null) throw new Error('PROGRESSION_COMMIT_OUTSIDE_OPERATION');
    currentOperationCommit.changed = true;
  }

  async function persistProgressionState(current, next, options) {
    if (currentOperationCommit === null) throw new Error('PROGRESSION_COMMIT_OUTSIDE_OPERATION');
    const updatedAtMs = Math.max(next.updatedAtMs, current.updatedAtMs + 1);
    if (!Number.isSafeInteger(updatedAtMs)) throw new Error('PROGRESSION_COMMIT_REVISION_EXHAUSTED');
    const written = await repository.writeState({ ...next, updatedAtMs }, options);
    markOperationCommitted();
    return written;
  }

  async function mutateRepositoryState(mutator, { nowMs }) {
    const current = await repository.readState({ nowMs });
    const next = mutator(current);
    if (JSON.stringify(next) === JSON.stringify(current)) return current;
    return persistProgressionState(current, next, { nowMs });
  }

  async function readFacts(state) {
    return factsProvider.readFacts({ state, nowMs: now() });
  }

  function readDevelopmentProjection() {
    return unlockDebugRepository
      ? unlockDebugRepository.readProjection()
      : Promise.resolve(null);
  }

  async function buildEffectiveArtifactDisclosureSnapshot(state) {
    const canonicalSnapshot = buildArtifactDisclosureSnapshot(state.artifactDisclosure, {
      stateUpdatedAtMs: state.updatedAtMs,
      canonicalFirstVisionSpent: state.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT,
      bonsaiFirstBloomOpened: state.completedMilestoneIds[
        PROGRESSION_MILESTONE_IDS.BONSAI_FIRST_BLOOM_OPENED
      ] === true,
    });
    const developmentProjection = await readDevelopmentProjection();
    const effectiveSnapshot = developmentProjection !== null
      ? unlockDebugRepository.projectArtifactDisclosureSnapshot(
        canonicalSnapshot,
        developmentProjection,
      )
      : canonicalSnapshot;
    return attachDevelopmentProjection(Object.freeze({
      ...effectiveSnapshot,
      registrationJourneyMilestones: readRegistrationJourneyMilestones(state),
    }), developmentProjection);
  }

  function readRegistrationJourneyMilestones(state) {
    return Object.freeze({
      firstProtectedSiteRegistered: !!state.completedMilestoneIds[
        PROGRESSION_MILESTONE_IDS.FIRST_PROTECTED_SITE_REGISTERED
      ],
      directRegistrationUnlocked: !!state.completedMilestoneIds[
        PROGRESSION_MILESTONE_IDS.DIRECT_SITE_REGISTRATION_UNLOCKED
      ],
      admittedInvitationCapacity: [1, 2, 3, 4, 5].reduce((capacity, candidate) => (
        state.completedMilestoneIds[PROGRESSION_MILESTONE_IDS[`SITE_REGISTRATION_INVITATION_CAPACITY_${candidate}`]]
          ? candidate : capacity
      ), 0),
    });
  }

  async function reconcileRegistrationJourneyMilestones(state, protectedSiteCount, timestamp) {
    const milestones = [];
    if (protectedSiteCount > 0) {
      milestones.push(PROGRESSION_MILESTONE_IDS.FIRST_PROTECTED_SITE_REGISTERED);
    }
    if (hasCompletedSiteRegistrationJourney({
      protectedSiteCount,
      // Durable release follows real protected-use days, never a debug day.
      qualifiedUseDayCount: state.artifactDisclosure.qualifiedActivityDayCount,
    })) milestones.push(PROGRESSION_MILESTONE_IDS.DIRECT_SITE_REGISTRATION_UNLOCKED);
    let next = state;
    for (const milestoneId of milestones) {
      if (next.completedMilestoneIds[milestoneId]) continue;
      next = recordProgressionEvent(next, {
        type: PROGRESSION_EVENT_TYPES.MILESTONE_COMPLETED, milestoneId, atMs: timestamp,
      }, { nowMs: timestamp });
    }
    if (next === state) return state;
    const written = await persistProgressionState(state, next, { nowMs: timestamp });
    return written;
  }

  async function readSnapshot() {
    assertProgressionFactsProvider(factsProvider);
    return enqueueOperation(async () => {
      const state = await repository.readState({ nowMs: now() });
      let facts = { nowMs: now() };
      const diagnostics = [];
      try {
        facts = await readFacts(state);
      } catch (error) {
        diagnostics.push(describeProgressionError(error));
      }

      return diagnostics.length > 0
        ? buildDegradedProgressionSnapshot({
          state,
          facts,
          diagnostics,
          nowMs: now(),
        })
        : evaluateProgressionSnapshot({ state, facts });
    });
  }

  function recordFirstVisionEvent(eventType, expectedProfileGeneration) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    return enqueueOperation(async () => {
      const developmentProjection = await readDevelopmentProjection();
      if (
        developmentProjection
        && developmentProjection.dayCount !== null
      ) {
        throw new Error('PROGRESSION_FIRST_VISION_CANONICAL_WRITE_REQUIRES_CANONICAL_MODE');
      }
      const timestamp = now();
      const written = await mutateRepositoryState(
        (current) => {
          if ((eventType === PROGRESSION_EVENT_TYPES.FIRST_VISION_PRESENTED
              && current.firstVision.state !== PROGRESSION_FIRST_VISION_STATES.PENDING)
            || (eventType === PROGRESSION_EVENT_TYPES.FIRST_VISION_SPENT
              && current.firstVision.state === PROGRESSION_FIRST_VISION_STATES.SPENT)) return current;
          return recordProgressionEvent(current, { type: eventType }, { nowMs: timestamp });
        },
        { nowMs: timestamp },
      );
      return attachDevelopmentProjection(
        buildFirstVisionProgressionSnapshot(written),
        developmentProjection,
      );
    }, { expectedProfileGeneration: generation });
  }

  function recordFirstVisionPresented({ expectedProfileGeneration } = {}) {
    return recordFirstVisionEvent(
      PROGRESSION_EVENT_TYPES.FIRST_VISION_PRESENTED,
      expectedProfileGeneration,
    );
  }

  function recordFirstVisionSpent({ expectedProfileGeneration } = {}) {
    return recordFirstVisionEvent(
      PROGRESSION_EVENT_TYPES.FIRST_VISION_SPENT,
      expectedProfileGeneration,
    );
  }

  function resetFirstVisionForDebug({ expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    return enqueueOperation(async () => {
      const developmentProjection = await readDevelopmentProjection();
      if (!developmentProjection || developmentProjection.dayCount !== null) {
        throw new Error('PROGRESSION_FIRST_VISION_DEBUG_RESET_REQUIRES_CANONICAL_MODE');
      }
      const timestamp = now();
      const written = await mutateRepositoryState(
        (current) => resetProgressionFirstVisionState(current, { nowMs: timestamp }),
        { nowMs: timestamp },
      );
      return attachDevelopmentProjection(
        buildFirstVisionProgressionSnapshot(written),
        developmentProjection,
      );
    }, { expectedProfileGeneration: generation });
  }

  function readFirstVisionSnapshot({ expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    return enqueueOperation(async () => {
      const state = await repository.readState({ nowMs: now() });
      const developmentProjection = await readDevelopmentProjection();
      if (developmentProjection !== null && typeof unlockDebugRepository.projectFirstVisionState !== 'function') {
        throw new Error('PROGRESSION_FIRST_VISION_PROJECTION_OWNER_REQUIRED');
      }
      return attachDevelopmentProjection(
        Object.freeze({
          ...buildFirstVisionProgressionSnapshot(state),
          effectiveFirstVisionState: developmentProjection === null
            ? state.firstVision.state
            : unlockDebugRepository.projectFirstVisionState(state.firstVision.state, developmentProjection),
        }),
        developmentProjection,
      );
    }, { expectedProfileGeneration: generation });
  }

  function recordDashboardFirstVisit({ expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    return enqueueOperation(async () => {
      const timestamp = now();
      let state = await repository.readState({ nowMs: timestamp });
      if (!state.completedMilestoneIds[PROGRESSION_MILESTONE_IDS.FIRST_DASHBOARD_VISIT]) {
        const next = recordProgressionEvent(state, {
          type: PROGRESSION_EVENT_TYPES.MILESTONE_COMPLETED,
          milestoneId: PROGRESSION_MILESTONE_IDS.FIRST_DASHBOARD_VISIT, atMs: timestamp,
        }, { nowMs: timestamp });
        state = await persistProgressionState(state, next, { nowMs: timestamp });
      }
      return Object.freeze({ firstDashboardVisitRecorded: true });
    }, { expectedProfileGeneration: generation });
  }

  function claimBonsaiFirstBloom({ expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    return enqueueOperation(async () => {
      const developmentProjection = await readDevelopmentProjection();
      if (developmentProjection !== null && developmentProjection.dayCount !== null) {
        throw new Error('BONSAI_FIRST_BLOOM_CANONICAL_MODE_REQUIRED');
      }
      const timestamp = now();
      const state = await repository.readState({ nowMs: timestamp });
      const release = buildProgressionBonsaiRelease(state.artifactDisclosure.qualifiedActivityDayCount);
      if (state.firstVision.state !== PROGRESSION_FIRST_VISION_STATES.SPENT || !release.fullFormReady) {
        throw new Error('BONSAI_FIRST_BLOOM_NOT_ELIGIBLE');
      }
      const milestoneId = PROGRESSION_MILESTONE_IDS.BONSAI_FIRST_BLOOM_OPENED;
      if (state.completedMilestoneIds[milestoneId] === true) {
        return Object.freeze({ opened: true, newlyOpened: false });
      }
      if (!isProgressionBonsaiFirstBloomEligible({
        firstVisionSpent: true, bonsaiRelease: release,
        bonsaiFirstBloomOpened: false, canonicalMode: true,
      })) throw new Error('BONSAI_FIRST_BLOOM_NOT_ELIGIBLE');
      await persistProgressionState(state, recordProgressionEvent(state, {
        type: PROGRESSION_EVENT_TYPES.MILESTONE_COMPLETED,
        milestoneId,
        atMs: timestamp,
      }, { nowMs: timestamp }), { nowMs: timestamp });
      return Object.freeze({ opened: true, newlyOpened: true });
    }, { expectedProfileGeneration: generation });
  }

  function observeProtectedSiteRegistration({ protectedSiteCount } = {}) {
    const count = requireProtectedSiteCount(protectedSiteCount);
    return enqueueOperation(async () => {
      const timestamp = now();
      const state = await reconcileRegistrationJourneyMilestones(
        await repository.readState({ nowMs: timestamp }), count, timestamp,
      );
      return readRegistrationJourneyMilestones(state);
    });
  }

  function readSiteRegistrationJourney({ protectedSiteCount, allowedSiteCount } = {}) {
    const count = requireProtectedSiteCount(protectedSiteCount);
    const allowedCount = requireAllowedSiteCount(allowedSiteCount);
    return enqueueOperation(async () => {
      const timestamp = now();
      const state = await reconcileRegistrationJourneyMilestones(
        await repository.readState({ nowMs: timestamp }), count, timestamp,
      );
      const snapshot = await buildEffectiveArtifactDisclosureSnapshot(state);
      return buildSiteRegistrationJourneySnapshot({
        unlockProgress: snapshot.unlockProgress,
        protectedSiteCount: count,
        allowedSiteCount: allowedCount,
        ...snapshot.registrationJourneyMilestones,
      });
    });
  }

  function recordSiteRegistrationInvitationsAdmitted({ capacity, expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > PROGRESSION_REPRESENTED_SITE_LIMIT) {
      throw new Error('SITE_REGISTRATION_INVITATION_CAPACITY_INVALID');
    }
    return enqueueOperation(async () => {
      const timestamp = now();
      const state = await repository.readState({ nowMs: timestamp });
      const snapshot = await buildEffectiveArtifactDisclosureSnapshot(state);
      const budget = snapshot.unlockProgress.siteRegistrationBudget;
      if (budget.mode === 'limited' && capacity > budget.limit) {
        throw new Error('SITE_REGISTRATION_INVITATION_CAPACITY_NOT_ADMITTED');
      }
      if (snapshot.unlockProgress.debugOverrideActive) {
        return Object.freeze({ admittedInvitationCapacity: capacity });
      }
      const current = readRegistrationJourneyMilestones(state).admittedInvitationCapacity;
      if (capacity <= current) return Object.freeze({ admittedInvitationCapacity: current });
      const written = await persistProgressionState(state, recordProgressionEvent(state, {
        type: PROGRESSION_EVENT_TYPES.MILESTONE_COMPLETED,
        milestoneId: PROGRESSION_MILESTONE_IDS[`SITE_REGISTRATION_INVITATION_CAPACITY_${capacity}`],
        atMs: timestamp,
      }, { nowMs: timestamp }), { nowMs: timestamp });
      return Object.freeze({ admittedInvitationCapacity:
        readRegistrationJourneyMilestones(written).admittedInvitationCapacity });
    }, { expectedProfileGeneration: generation });
  }

  function readArtifactDisclosureSnapshot({ expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION } = {}) {
    return enqueueOperation(async () => {
      const timestamp = now();
      const state = await reconcileRegistrationJourneyMilestones(
        await repository.readState({ nowMs: timestamp }), 0, timestamp,
      );
      return buildEffectiveArtifactDisclosureSnapshot(state);
    }, { expectedProfileGeneration });
  }

  function assertSiteRegistrationAdmission({ currentDomains, nextDomains } = {}) {
    if (!Array.isArray(currentDomains) || !Array.isArray(nextDomains)
      || [...currentDomains, ...nextDomains].some((domain) => typeof domain !== 'string' || !domain)) {
      throw new Error('PROGRESSION_SITE_REGISTRATION_DOMAINS_REQUIRED');
    }
    return enqueueOperation(async () => {
      const current = new Set(currentDomains);
      const next = new Set(nextDomains);
      const addedDomains = [...next].filter((domain) => !current.has(domain));
      if (addedDomains.length === 0) return Object.freeze({ admitted: true });
      const state = await repository.readState({ nowMs: now() });
      const snapshot = await buildEffectiveArtifactDisclosureSnapshot(state);
      const budget = snapshot.unlockProgress.siteRegistrationBudget;
      if (budget.mode === 'limited' && next.size > budget.limit) {
        throw createSiteRegistrationLimitError({
          siteRegistrationBudget: budget,
          qualifiedUseDayCount: snapshot.unlockProgress.qualifiedUseFacts.effectiveDayCount,
          nextIncreaseDay: resolveProgressionNextSiteRegistrationIncreaseDay(
            snapshot.unlockProgress.qualifiedUseFacts.effectiveDayCount,
          ),
        });
      }
      return Object.freeze({ admitted: true, siteRegistrationBudget: budget });
    });
  }

  function setProgressionUnlockDebugMode({ mode, dayCount = null, expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION } = {}) {
    if (!unlockDebugRepository) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_UNAVAILABLE');
    }
    return enqueueOperation(async () => {
      const timestamp = now();
      await unlockDebugRepository.setMode(mode, {
        dayCount,
        updatedAtMs: timestamp,
      });
      markOperationCommitted();
      const state = await repository.readState({ nowMs: timestamp });
      return buildEffectiveArtifactDisclosureSnapshot(state);
    }, { expectedProfileGeneration });
  }

  function setProgressionUnlockDebugDay({ dayCount, expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION } = {}) {
    if (!unlockDebugRepository) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_UNAVAILABLE');
    }
    return enqueueOperation(async () => {
      const timestamp = now();
      await unlockDebugRepository.setDay(dayCount, { updatedAtMs: timestamp });
      markOperationCommitted();
      const state = await repository.readState({ nowMs: timestamp });
      return buildEffectiveArtifactDisclosureSnapshot(state);
    }, { expectedProfileGeneration });
  }

  function clearProgressionUnlockDebugOverride({ expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION } = {}) {
    if (!unlockDebugRepository) {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_UNAVAILABLE');
    }
    return enqueueOperation(async () => {
      const timestamp = now();
      await unlockDebugRepository.setCanonicalMode({ updatedAtMs: timestamp });
      markOperationCommitted();
      const state = await repository.readState({ nowMs: timestamp });
      return buildEffectiveArtifactDisclosureSnapshot(state);
    }, { expectedProfileGeneration });
  }

  function completeProgressionUnlockDebugReplay({ expectedProjection, expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    if (!unlockDebugRepository || typeof unlockDebugRepository.completeReplay !== 'function') {
      throw new Error('PROGRESSION_UNLOCK_DEBUG_REPLAY_COMPLETION_OWNER_REQUIRED');
    }
    return enqueueOperation(async () => {
      const timestamp = now();
      const completion = await unlockDebugRepository.completeReplay(expectedProjection, { updatedAtMs: timestamp });
      if (completion.applied) markOperationCommitted();
      const state = await repository.readState({ nowMs: timestamp });
      return Object.freeze({ applied: completion.applied,
        snapshot: await buildEffectiveArtifactDisclosureSnapshot(state) });
    }, { expectedProfileGeneration: generation });
  }

  function clearProgressionUnlockDebugSessionForQa({ expectedProfileGeneration } = {}) {
    const generation = requireProfileGeneration(expectedProfileGeneration);
    if (!unlockDebugRepository || typeof unlockDebugRepository.clearStoredProjectionForQaProvisioning !== 'function') {
      throw new Error('PROGRESSION_QA_SESSION_OWNER_REQUIRED');
    }
    return enqueueOperation(async () => {
      const projection = await readDevelopmentProjection();
      if (projection.mode !== 'canonical') throw new Error('PROGRESSION_QA_CANONICAL_SESSION_CLEANUP_REQUIRED');
      const result = await unlockDebugRepository.clearStoredProjectionForQaProvisioning();
      if (result.cleared) markOperationCommitted();
      return result;
    }, { expectedProfileGeneration: generation });
  }

  function recordSuccessfulManagedProtectionActivityDay({
    activityDayKey,
    atMs = now(),
    expectedProfileGeneration = NO_EXPECTED_PROFILE_GENERATION,
  } = {}) {
    return enqueueOperation(async () => {
      const timestamp = requireProgressionTimestamp(atMs);
      const normalizedActivityDayKey = normalizeArtifactDisclosureActivityDayKey(activityDayKey);
      const current = await repository.readState({ nowMs: timestamp });
      const lastProcessedActivityDayKey = current.artifactDisclosure.lastProcessedActivityDayKey;
      if (
        lastProcessedActivityDayKey
        && normalizedActivityDayKey <= lastProcessedActivityDayKey
      ) {
        const snapshot = await buildEffectiveArtifactDisclosureSnapshot(current);
        return Object.freeze({ ...snapshot, activityDayOutcome: Object.freeze({
          qualifiedDayRecorded: false,
          newlyGrantedFamilyIds: Object.freeze([]),
        }) });
      }
      const next = recordProgressionEvent(current, {
        type: PROGRESSION_EVENT_TYPES.ACTIVE_PROTECTION_DAY_RECORDED,
        dateKey: normalizedActivityDayKey,
        atMs: timestamp,
      }, { nowMs: timestamp });
      const written = await reconcileRegistrationJourneyMilestones(
        await persistProgressionState(current, next, { nowMs: timestamp }), 0, timestamp,
      );
      const snapshot = await buildEffectiveArtifactDisclosureSnapshot(written);
      return Object.freeze({ ...snapshot, activityDayOutcome: Object.freeze({
        qualifiedDayRecorded: true,
        newlyGrantedFamilyIds: Object.freeze(snapshot.orderedFamilyIds.filter((familyId) => (
          !current.artifactDisclosure.disclosedByFamilyId[familyId]
          && written.artifactDisclosure.disclosedByFamilyId[familyId]
        ))),
      }) });
    }, { expectedProfileGeneration });
  }

  function initializeArtifactDisclosure() {
    return readArtifactDisclosureSnapshot();
  }

  function quiesceForProfileMutation() {
    if (maintenancePhase === PROGRESSION_MAINTENANCE_PHASES.QUIESCING) {
      return quiescePromise;
    }
    if (maintenancePhase === PROGRESSION_MAINTENANCE_PHASES.QUIESCED) {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (maintenancePhase !== PROGRESSION_MAINTENANCE_PHASES.OPEN) {
      throw new Error(`PROGRESSION_MAINTENANCE_ALREADY_ACTIVE:${maintenancePhase}`);
    }

    maintenancePhase = PROGRESSION_MAINTENANCE_PHASES.QUIESCING;
    quiescePromise = Promise.all([
      profileGenerationCapturePromise,
      operationQueue,
    ]).then(() => {
      maintenancePhase = PROGRESSION_MAINTENANCE_PHASES.QUIESCED;
      return Object.freeze({ quiesced: true, reused: false });
    });
    return quiescePromise;
  }

  async function clearForProfileMutation({ nowMs } = {}) {
    if (maintenancePhase !== PROGRESSION_MAINTENANCE_PHASES.QUIESCED) {
      throw new Error(`PROGRESSION_MAINTENANCE_NOT_QUIESCED:${maintenancePhase}`);
    }
    const timestamp = requireProgressionTimestamp(nowMs);
    if (typeof repository.resetForProfileMutation !== 'function') {
      throw new Error('PROGRESSION_PROFILE_MUTATION_RESET_OWNER_REQUIRED');
    }
    const written = await repository.resetForProfileMutation(
      buildDefaultProgressionState({ nowMs: timestamp }),
      { nowMs: timestamp },
    );
    return written;
  }

  return Object.freeze({
    readSnapshot,
    recordFirstVisionPresented,
    recordFirstVisionSpent,
    resetFirstVisionForDebug,
    readFirstVisionSnapshot,
    recordDashboardFirstVisit,
    claimBonsaiFirstBloom,
    observeProtectedSiteRegistration,
    readSiteRegistrationJourney,
    recordSiteRegistrationInvitationsAdmitted,
    readArtifactDisclosureSnapshot,
    assertSiteRegistrationAdmission,
    setProgressionUnlockDebugMode,
    setProgressionUnlockDebugDay,
    clearProgressionUnlockDebugOverride,
    completeProgressionUnlockDebugReplay,
    clearProgressionUnlockDebugSessionForQa,
    recordSuccessfulManagedProtectionActivityDay,
    initializeArtifactDisclosure,
    quiesceForProfileMutation,
    clearForProfileMutation,
  });
}

export default createProgressionService;
