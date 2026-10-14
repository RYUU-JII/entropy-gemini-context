import {
  FEED_TEMPO_PROFILE_PERSISTENCE,
  buildFeedTempoCheckpointProfileKey,
  requireFeedTempoCheckpointProfile,
} from '../../../../platform/storage/model/FeedTempoProfileCheckpointContract.js';
import {
  applyEligibleEpisodeToFeedTempoCheckpoint,
  evaluateFeedTempoEpisodeAgainstProfile,
  restoreFeedTempoAdaptiveProfile,
  summarizeFeedTempoAdaptiveProfile,
} from './feedTempoAdaptiveProfileModel.js';
import {
  FEED_TEMPO_METRIC_GRAIN,
  FEED_TEMPO_PROFILE_STATUSES,
  FEED_TEMPO_PROFILE_VERSION,
  buildFeedTempoProfileKey,
  normalizeFeedTempoLearningEpisodeFact,
  normalizeFeedTempoSurface,
} from './feedTempoContracts.js';

function requireClock(now) {
  if (typeof now !== 'function') {
    throw new Error('FEED_TEMPO_PROFILE_CLOCK_REQUIRED');
  }
  return now;
}

function requireCheckpointRevision(value) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('FEED_TEMPO_PROFILE_CHECKPOINT_REVISION_INVALID');
  }
  return value;
}

function createEmptySnapshot(surface) {
  return restoreFeedTempoAdaptiveProfile({
    checkpoint: null,
    profileEpoch: 'projection-only',
    surface,
    now: 0,
  }).profile;
}

export class FeedTempoProfileLearner {
  constructor({
    now = () => Date.now(),
  } = {}) {
    this._now = requireClock(now);
    this.reset();
  }

  reset() {
    this._profiles = new Map();
    this._excludedEpisodeCounts = new Map();
    this._excludedEpisodeCount = 0;
    this._checkpointStateRevision = null;
  }

  prepareCheckpointUpdate(options) {
    return applyEligibleEpisodeToFeedTempoCheckpoint(options);
  }

  hydrateProfileState(surface, profileState, {
    checkpointStateRevision,
    now = this._now(),
  } = {}) {
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    const key = buildFeedTempoCheckpointProfileKey(normalizedSurface);
    this._checkpointStateRevision = requireCheckpointRevision(
      checkpointStateRevision,
    );
    if (profileState === null) {
      this._profiles.delete(key);
      return this.getProfileSnapshot(normalizedSurface, { now });
    }
    const normalized = requireFeedTempoCheckpointProfile(profileState, {
      checkpointUpdatedAt: now,
    });
    if (
      normalized.key !== key
      || buildFeedTempoCheckpointProfileKey(normalized.surface) !== key
    ) {
      throw new Error('FEED_TEMPO_PROFILE_HYDRATION_SURFACE_MISMATCH');
    }
    this._profiles.set(key, normalized);
    return this.getProfileSnapshot(normalizedSurface, { now });
  }

  evaluateEpisode(rawFact, {
    now = this._now(),
  } = {}) {
    const fact = normalizeFeedTempoLearningEpisodeFact(rawFact);
    const key = buildFeedTempoCheckpointProfileKey(fact.surface);
    return evaluateFeedTempoEpisodeAgainstProfile({
      fact,
      profile: this._profiles.get(key) || null,
      now,
    });
  }

  evaluateAndObserve() {
    throw new Error('FEED_TEMPO_PROFILE_DURABLE_COMMIT_REQUIRED');
  }

  observeEpisode() {
    throw new Error('FEED_TEMPO_PROFILE_DURABLE_COMMIT_REQUIRED');
  }

  recordExcludedEpisode(surface) {
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    const key = buildFeedTempoCheckpointProfileKey(normalizedSurface);
    const count = (this._excludedEpisodeCounts.get(key) || 0) + 1;
    this._excludedEpisodeCounts.set(key, count);
    this._excludedEpisodeCount += 1;
    return count;
  }

  getProfileSnapshot(surface, {
    now = this._now(),
  } = {}) {
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    if (!['paged', 'continuous'].includes(normalizedSurface.surfaceMode)) {
      return {
        ...createEmptySnapshot(normalizedSurface),
        excludedEpisodeCount: 0,
        checkpointStateRevision: this._checkpointStateRevision,
      };
    }
    const key = buildFeedTempoProfileKey(normalizedSurface);
    const profile = this._profiles.get(key) || null;
    const excludedEpisodeCount = this._excludedEpisodeCounts.get(key) || 0;
    if (profile === null) {
      return {
        ...createEmptySnapshot(normalizedSurface),
        excludedEpisodeCount,
        checkpointStateRevision: this._checkpointStateRevision,
      };
    }
    return summarizeFeedTempoAdaptiveProfile(profile, {
      now,
      excludedEpisodeCount,
      checkpointStateRevision: this._checkpointStateRevision,
    });
  }

  getSnapshot({
    now = this._now(),
  } = {}) {
    return {
      version: FEED_TEMPO_PROFILE_VERSION,
      metricGrain: FEED_TEMPO_METRIC_GRAIN,
      persistence: FEED_TEMPO_PROFILE_PERSISTENCE,
      status: this._profiles.size > 0
        ? 'restored'
        : FEED_TEMPO_PROFILE_STATUSES.SPARSE,
      profileCount: this._profiles.size,
      excludedEpisodeCount: this._excludedEpisodeCount,
      checkpointStateRevision: this._checkpointStateRevision,
      profiles: Array.from(this._profiles.values(), (profile) => (
        this.getProfileSnapshot(profile.surface, { now })
      )),
    };
  }
}

export default FeedTempoProfileLearner;
