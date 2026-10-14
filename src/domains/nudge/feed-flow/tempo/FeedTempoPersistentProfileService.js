import FeedTempoProfileCheckpointRepository from '../../../../platform/storage/model/FeedTempoProfileCheckpointRepository.js';
import {
  resolveProfileResetGeneration,
} from '../../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  applyEligibleEpisodeToFeedTempoCheckpoint,
  isFeedTempoEpisodeEligibleForPersistence,
  restoreFeedTempoAdaptiveProfile,
} from './feedTempoAdaptiveProfileModel.js';
import {
  normalizeFeedTempoLearningEpisodeFact,
  normalizeFeedTempoSurface,
} from './feedTempoContracts.js';

const DEFAULT_CAS_ATTEMPT_LIMIT = 4;
const PERSISTED_SURFACE_MODES = new Set(['paged', 'continuous']);

function requireOwnerMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
  return owner[method].bind(owner);
}

function requireNow(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TEMPO_PERSISTED_PROFILE_TIME_INVALID');
  }
  return value;
}

function cloneProfileState(profileState) {
  if (profileState === null) return null;
  return {
    ...profileState,
    surface: { ...profileState.surface },
    retainedSamples: profileState.retainedSamples.map((sample) => ({ ...sample })),
  };
}

export class FeedTempoPersistentProfileService {
  constructor({
    checkpointRepository = FeedTempoProfileCheckpointRepository.getInstance(),
    profileLifecycleRepository,
    authorizeHistoryAccess,
    now = () => Date.now(),
    casAttemptLimit = DEFAULT_CAS_ATTEMPT_LIMIT,
  } = {}) {
    this._readCheckpoint = requireOwnerMethod(
      checkpointRepository,
      'read',
      'FEED_TEMPO_PERSISTED_CHECKPOINT_READ_OWNER_REQUIRED',
    );
    this._compareAndSetCheckpoint = requireOwnerMethod(
      checkpointRepository,
      'compareAndSet',
      'FEED_TEMPO_PERSISTED_CHECKPOINT_CAS_OWNER_REQUIRED',
    );
    this._readLifecycle = requireOwnerMethod(
      profileLifecycleRepository,
      'read',
      'FEED_TEMPO_PERSISTED_LIFECYCLE_READ_OWNER_REQUIRED',
    );
    this._assertWriteAdmission = requireOwnerMethod(
      profileLifecycleRepository,
      'assertWriteAdmission',
      'FEED_TEMPO_PERSISTED_LIFECYCLE_ADMISSION_OWNER_REQUIRED',
    );
    if (typeof now !== 'function') {
      throw new Error('FEED_TEMPO_PERSISTED_PROFILE_CLOCK_REQUIRED');
    }
    if (!Number.isSafeInteger(casAttemptLimit) || casAttemptLimit < 1) {
      throw new Error('FEED_TEMPO_PERSISTED_CAS_ATTEMPT_LIMIT_INVALID');
    }
    this._now = now;
    this._casAttemptLimit = casAttemptLimit;
    if (typeof authorizeHistoryAccess !== 'function') {
      throw new Error('FEED_TEMPO_HISTORY_ADMISSION_OWNER_REQUIRED');
    }
    this._authorizeHistoryAccess = authorizeHistoryAccess;
  }

  async restoreSurface(surface, { sender } = {}) {
    const admission = await this._authorizeHistoryAccess(sender);
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    if (!PERSISTED_SURFACE_MODES.has(normalizedSurface.surfaceMode)) {
      throw new Error('FEED_TEMPO_PERSISTED_SURFACE_UNSUPPORTED');
    }
    const restoredAt = requireNow(this._now());
    const profileEpoch = await this._resolveAdmittedProfileEpoch();
    admission.assertCommitAllowed();
    const stored = await this._readCheckpoint({ profileEpoch });
    await this._assertWriteAdmission({ expectedResetId: profileEpoch });
    await admission.assertCurrent();
    const restored = restoreFeedTempoAdaptiveProfile({
      checkpoint: stored.checkpoint,
      profileEpoch,
      surface: normalizedSurface,
      now: restoredAt,
    });
    return Object.freeze({
      historyAdmission: admission.historyAdmission,
      checkpointFound: restored.checkpointFound,
      checkpointStateRevision: restored.checkpointStateRevision,
      checkpointDiscarded: stored.discarded,
      profileState: restored.profileState === null
        ? null
        : Object.freeze(cloneProfileState(restored.profileState)),
    });
  }

  async commitEpisode(rawFact, { sender, historyAdmission } = {}) {
    const admission = await this._authorizeHistoryAccess(sender, { historyAdmission, requireAdmission: true });
    const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
    if (!isFeedTempoEpisodeEligibleForPersistence(fact)) {
      throw new Error('FEED_TEMPO_PERSISTED_EPISODE_INELIGIBLE');
    }
    const profileEpoch = await this._resolveAdmittedProfileEpoch();
    admission.assertCommitAllowed();
    let stored = await this._readCheckpoint({ profileEpoch });

    for (let attempt = 1; attempt <= this._casAttemptLimit; attempt += 1) {
      const updateAt = Math.max(
        requireNow(this._now()),
        fact.endedAt,
        stored.checkpoint ? stored.checkpoint.updatedAt : 0,
      );
      const prepared = applyEligibleEpisodeToFeedTempoCheckpoint({
        checkpoint: stored.checkpoint,
        profileEpoch,
        fact,
        now: updateAt,
      });
      const expectedRevision = stored.checkpoint
        ? stored.checkpoint.stateRevision
        : null;
      await admission.assertCurrent();
      const result = await this._compareAndSetCheckpoint({
        profileEpoch,
        expectedRevision,
        nextCheckpoint: prepared.checkpoint,
        assertCommitAllowed: admission.assertCommitAllowed,
      });
      if (result.outcome === 'committed' && result.written === true) {
        await this._assertWriteAdmission({ expectedResetId: profileEpoch });
        await admission.assertCurrent();
        return Object.freeze({
          checkpointStateRevision: prepared.checkpoint.stateRevision,
          conflictCount: attempt - 1,
          evaluation: prepared.evaluation,
          profileState: Object.freeze(cloneProfileState(prepared.profileState)),
        });
      }
      if (
        result.outcome !== 'conflict'
        || result.latestProfileEpoch !== profileEpoch
      ) {
        throw new Error('FEED_TEMPO_PERSISTED_CHECKPOINT_CAS_RESULT_INVALID');
      }
      if (result.checkpoint === null) {
        stored = Object.freeze({
          found: false,
          profileEpoch,
          checkpoint: null,
        });
      } else {
        stored = Object.freeze({
          found: true,
          profileEpoch,
          checkpoint: result.checkpoint,
        });
      }
    }
    throw new Error('FEED_TEMPO_PERSISTED_CHECKPOINT_CONFLICT_EXHAUSTED');
  }

  async _resolveAdmittedProfileEpoch() {
    const lifecycle = await this._readLifecycle();
    const profileEpoch = resolveProfileResetGeneration(lifecycle);
    await this._assertWriteAdmission({ expectedResetId: profileEpoch });
    return profileEpoch;
  }
}

export function createFeedTempoPersistentProfileService(options) {
  return new FeedTempoPersistentProfileService(options);
}

export default FeedTempoPersistentProfileService;
