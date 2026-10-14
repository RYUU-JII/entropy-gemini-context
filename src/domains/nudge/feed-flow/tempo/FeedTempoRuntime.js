import {
  FEED_TEMPO_PROFILE_PERSISTENCE,
} from '../../../../platform/storage/model/FeedTempoProfileCheckpointContract.js';
import FeedTempoEpisodeAssembler from './FeedTempoEpisodeAssembler.js';
import FeedTempoPersistenceClient from './FeedTempoPersistenceClient.js';
import FeedTempoProfileLearner from './FeedTempoProfileLearner.js';
import {
  isFeedTempoEpisodeEligibleForPersistence,
} from './feedTempoAdaptiveProfileModel.js';
import {
  FEED_TEMPO_SNAPSHOT_VERSION,
  FEED_TEMPO_STATES,
  buildFeedTempoProfileKey,
  cloneFeedTempoEpisodeFact,
  normalizeFeedTempoSurface,
  summarizeFeedTempoEpisodeFact,
} from './feedTempoContracts.js';

const CHECKPOINT_STATES = Object.freeze({
  DISABLED: 'disabled',
  INACTIVE: 'inactive',
  RESTORING: 'restoring',
  READY: 'ready',
  UPDATING: 'updating',
  FAILED: 'failed',
});

function requireModuleMethod(owner, method, errorCode) {
  if (!owner || typeof owner[method] !== 'function') throw new Error(errorCode);
}

function roundDurationMs(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function cloneEvaluation(evaluation) {
  if (!evaluation) return null;
  return {
    ...evaluation,
    reasons: [...evaluation.reasons],
  };
}

function cloneProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    surface: profile.surface ? { ...profile.surface } : null,
  };
}

export class FeedTempoRuntime {
  constructor({
    episodeAssembler = new FeedTempoEpisodeAssembler(),
    profileLearner = new FeedTempoProfileLearner(),
    persistenceClient = new FeedTempoPersistenceClient(),
    onSnapshot = null,
    onEpisodeFinalized = null,
    historyAllowed = false,
    performanceNow = () => globalThis?.performance?.now?.() ?? Date.now(),
    now = () => Date.now(),
  } = {}) {
    [
      'start',
      'stop',
      'setSurface',
      'recordIntent',
      'recordActivity',
      'recordAdvance',
      'setInterventionExposure',
      'handleVisibilityChange',
      'getSnapshot',
      'setEpisodeObserver',
    ].forEach((method) => {
      requireModuleMethod(
        episodeAssembler,
        method,
        `FEED_TEMPO_EPISODE_ASSEMBLER_METHOD_REQUIRED:${method}`,
      );
    });
    [
      'reset',
      'hydrateProfileState',
      'evaluateEpisode',
      'recordExcludedEpisode',
      'getProfileSnapshot',
      'getSnapshot',
    ].forEach((method) => {
      requireModuleMethod(
        profileLearner,
        method,
        `FEED_TEMPO_PROFILE_LEARNER_METHOD_REQUIRED:${method}`,
      );
    });
    ['restoreSurface', 'commitEpisode'].forEach((method) => {
      requireModuleMethod(
        persistenceClient,
        method,
        `FEED_TEMPO_PERSISTENCE_CLIENT_METHOD_REQUIRED:${method}`,
      );
    });
    if (onSnapshot !== null && typeof onSnapshot !== 'function') {
      throw new Error('FEED_TEMPO_SNAPSHOT_OBSERVER_INVALID');
    }
    if (onEpisodeFinalized !== null && typeof onEpisodeFinalized !== 'function') {
      throw new Error('FEED_TEMPO_FINALIZED_EPISODE_OBSERVER_INVALID');
    }
    if (typeof performanceNow !== 'function') {
      throw new Error('FEED_TEMPO_PERFORMANCE_CLOCK_REQUIRED');
    }
    if (typeof now !== 'function') {
      throw new Error('FEED_TEMPO_RUNTIME_CLOCK_REQUIRED');
    }
    this._episodeAssembler = episodeAssembler;
    this._profileLearner = profileLearner;
    this._persistenceClient = persistenceClient;
    this._onSnapshot = onSnapshot;
    this._onEpisodeFinalized = onEpisodeFinalized;
    this._performanceNow = performanceNow;
    this._now = now;
    this._active = false;
    if (typeof historyAllowed !== 'boolean') throw new Error('FEED_TEMPO_HISTORY_POLICY_INVALID');
    this._historyAllowed = historyAllowed;
    this._historyEpoch = 0;
    this._historyTaintedEpisode = !historyAllowed;
    this._surface = null;
    this._lastEpisode = null;
    this._lastEvaluation = null;
    this._failure = null;
    this._researchPersistenceSuppressed = false;
    this._researchTaintedEpisode = false;
    this._researchSuppressedEpisodeCount = 0;
    this._persistenceTail = Promise.resolve();
    this._restoredProfileKeys = new Set();
    this._checkpoint = this._createCheckpointState();
    this._cost = {
      operationCount: 0,
      advanceOperationCount: 0,
      finalizedEpisodeCount: 0,
      totalMs: 0,
      maximumMs: 0,
    };
    this._episodeAssembler.setEpisodeObserver((fact) => {
      this._handleEpisodeFinalized(fact);
    });
  }

  start({
    surface,
    visibilityState = 'visible',
    now = Date.now(),
  } = {}) {
    return this._measureOperation('start', () => {
      this._surface = normalizeFeedTempoSurface(surface);
      this._active = true;
      this._lastEpisode = null;
      this._lastEvaluation = null;
      this._failure = null;
      this._researchTaintedEpisode = this._researchPersistenceSuppressed;
      this._historyTaintedEpisode = !this._historyAllowed;
      this._profileLearner.reset();
      this._restoredProfileKeys.clear();
      this._checkpoint = this._createCheckpointState();
      try {
        this._episodeAssembler.start({
          surface: this._surface,
          visibilityState,
          now,
        });
      } catch (error) {
        this._active = false;
        this._surface = null;
        this._failure = error;
        throw error;
      }
      this._queueSurfaceRestore(this._surface);
      return this._publishSnapshot();
    });
  }

  stop({
    now = Date.now(),
    reason = 'runtime_stop',
  } = {}) {
    if (!this._active) return null;
    return this._measureOperation('stop', () => {
      let finalized = null;
      try {
        finalized = this._episodeAssembler.stop({ now, reason });
      } finally {
        this._active = false;
        this._surface = null;
      }
      this._publishSnapshot();
      return finalized;
    });
  }

  setSurface(surface, options = {}) {
    return this._measureOperation('set_surface', () => {
      const nextSurface = normalizeFeedTempoSurface(surface);
      const result = this._episodeAssembler.setSurface(nextSurface, options);
      this._surface = nextSurface;
      this._queueSurfaceRestore(nextSurface);
      this._publishSnapshot();
      return result;
    });
  }

  recordIntent(intent = {}) {
    return this._measureOperation('intent', () => {
      const snapshot = this._episodeAssembler.recordIntent(intent);
      this._publishSnapshot(snapshot);
      return snapshot;
    });
  }

  recordActivity(activity = {}) {
    return this._measureOperation('activity', () => {
      const snapshot = this._episodeAssembler.recordActivity(activity);
      this._publishSnapshot(snapshot);
      return snapshot;
    });
  }

  recordAdvance(event = {}) {
    return this._measureOperation('advance', () => {
      const snapshot = this._episodeAssembler.recordAdvance(event);
      this._publishSnapshot(snapshot);
      return snapshot;
    });
  }

  setInterventionExposure(active, options = {}) {
    return this._measureOperation('intervention', () => {
      const snapshot = this._episodeAssembler.setInterventionExposure(active, options);
      this._publishSnapshot(snapshot);
      return snapshot;
    });
  }

  setResearchPersistenceSuppressed(enabled) {
    if (typeof enabled !== 'boolean') {
      throw new Error('FEED_TEMPO_RESEARCH_PERSISTENCE_SUPPRESSION_INVALID');
    }
    this._researchPersistenceSuppressed = enabled;
    if (enabled) this._researchTaintedEpisode = true;
    return this._publishSnapshot();
  }

  setHistoryAllowed(allowed) {
    if (typeof allowed !== 'boolean') throw new Error('FEED_TEMPO_HISTORY_POLICY_INVALID');
    if (allowed === this._historyAllowed) return;
    this._historyEpoch += 1;
    this._historyAllowed = allowed;
    // A partially permitted episode is never made eligible by re-enabling.
    this._historyTaintedEpisode = true;
    this._profileLearner.reset();
    this._restoredProfileKeys.clear();
    this._lastEvaluation = null;
    this._lastEpisode = null;
    this._checkpoint = this._createCheckpointState();
    if (allowed && this._active) this._queueSurfaceRestore(this._surface);
    this._publishSnapshot();
  }

  handleVisibilityChange(payload = {}) {
    return this._measureOperation('visibility', () => {
      const result = this._episodeAssembler.handleVisibilityChange(payload);
      this._publishSnapshot();
      return result;
    });
  }

  async waitForPersistence() {
    await this._persistenceTail;
    return this.getSnapshot();
  }

  getSnapshot() {
    const trajectory = this._episodeAssembler.getSnapshot();
    const surface = this._surface || trajectory.surface;
    const profile = surface
      ? this._profileLearner.getProfileSnapshot(surface, { now: this._readNow() })
      : null;
    const state = this._failure || this._checkpoint.state === CHECKPOINT_STATES.FAILED
      ? FEED_TEMPO_STATES.INVALID
      : trajectory.state;
    return {
      version: FEED_TEMPO_SNAPSHOT_VERSION,
      mode: 'observe_only',
      historyAccess: this._historyAllowed ? 'allowed' : 'disabled',
      persistence: FEED_TEMPO_PROFILE_PERSISTENCE,
      state,
      active: this._active,
      cost: this._getCostSnapshot(),
      checkpoint: this._getCheckpointSnapshot(),
      surface: surface ? { ...surface } : null,
      trajectory,
      profile,
      shadowEvaluation: cloneEvaluation(this._lastEvaluation),
      researchWriteFence: {
        active: this._researchPersistenceSuppressed,
        currentEpisodeTainted: this._researchTaintedEpisode,
        suppressedEpisodeCount: this._researchSuppressedEpisodeCount,
        policy: 'exclude_tainted_episode_from_checkpoint_commit',
      },
      lastEpisode: summarizeFeedTempoEpisodeFact(this._lastEpisode),
      failure: this._failure || this._checkpoint.failure
        ? 'feed_tempo_persisted_shadow_failure'
        : null,
    };
  }

  getModules() {
    return {
      episodeAssembler: this._episodeAssembler,
      profileLearner: this._profileLearner,
      persistenceClient: this._persistenceClient,
    };
  }

  _handleEpisodeFinalized(rawFact) {
    const historyEligible = this._historyAllowed && !this._historyTaintedEpisode;
    this._historyTaintedEpisode = !this._historyAllowed;
    if (!historyEligible) return;
    const historyEpoch = this._historyEpoch;
    const fact = cloneFeedTempoEpisodeFact(rawFact);
    const researchPersistenceSuppressed = (
      this._researchPersistenceSuppressed
      || this._researchTaintedEpisode
    );
    this._researchTaintedEpisode = this._researchPersistenceSuppressed;
    this._lastEpisode = fact;
    this._cost.finalizedEpisodeCount += 1;
    this._queuePersistenceOperation(async () => {
      await this._ensureSurfaceRestored(fact.surface, historyEpoch);
      if (!this._isHistoryEpochCurrent(historyEpoch)) return;
      let evaluation;
      let profile;
      if (
        !researchPersistenceSuppressed
        && isFeedTempoEpisodeEligibleForPersistence(fact)
      ) {
        this._checkpoint.state = CHECKPOINT_STATES.UPDATING;
        const result = await this._measurePersistenceRoundTrip(
          () => this._persistenceClient.commitEpisode(fact),
        );
        if (!this._isHistoryEpochCurrent(historyEpoch)) return;
        profile = this._profileLearner.hydrateProfileState(
          fact.surface,
          result.profileState,
          {
            checkpointStateRevision: result.checkpointStateRevision,
            now: result.profileState.decayEvaluatedAt,
          },
        );
        evaluation = result.evaluation;
        this._checkpoint.commitCount += 1;
        this._checkpoint.conflictCount += result.conflictCount;
      } else {
        this._profileLearner.recordExcludedEpisode(fact.surface);
        evaluation = this._profileLearner.evaluateEpisode(fact, {
          now: Math.max(this._readNow(), fact.endedAt),
        });
        profile = this._profileLearner.getProfileSnapshot(fact.surface, {
          now: Math.max(this._readNow(), fact.endedAt),
        });
        this._checkpoint.excludedEpisodeCount += 1;
        if (researchPersistenceSuppressed) {
          this._researchSuppressedEpisodeCount += 1;
        }
      }
      this._lastEvaluation = evaluation;
      this._checkpoint.state = CHECKPOINT_STATES.READY;
      this._checkpoint.failure = null;
      this._onEpisodeFinalized?.(cloneFeedTempoEpisodeFact(fact), {
        evaluation: cloneEvaluation(evaluation),
        profile: cloneProfile(profile),
      });
    });
  }

  _queueSurfaceRestore(surface) {
    if (!this._historyAllowed) return;
    if (!surface || !['paged', 'continuous'].includes(surface.surfaceMode)) return;
    const key = buildFeedTempoProfileKey(surface);
    if (!this._restoredProfileKeys.has(key)) {
      this._checkpoint.state = CHECKPOINT_STATES.RESTORING;
    }
    const historyEpoch = this._historyEpoch;
    this._queuePersistenceOperation(() => this._ensureSurfaceRestored(surface, historyEpoch));
  }

  _isHistoryEpochCurrent(epoch) {
    return this._historyAllowed && epoch === this._historyEpoch;
  }

  async _ensureSurfaceRestored(surface, historyEpoch) {
    if (!this._isHistoryEpochCurrent(historyEpoch)) return null;
    const normalizedSurface = normalizeFeedTempoSurface(surface);
    if (!['paged', 'continuous'].includes(normalizedSurface.surfaceMode)) return null;
    const key = buildFeedTempoProfileKey(normalizedSurface);
    if (this._restoredProfileKeys.has(key)) {
      return this._profileLearner.getProfileSnapshot(normalizedSurface, {
        now: this._readNow(),
      });
    }
    this._checkpoint.state = CHECKPOINT_STATES.RESTORING;
    const result = await this._measurePersistenceRoundTrip(
      () => this._persistenceClient.restoreSurface(normalizedSurface),
    );
    if (!this._isHistoryEpochCurrent(historyEpoch)) return null;
    const hydrationNow = result.profileState
      ? result.profileState.decayEvaluatedAt
      : this._readNow();
    const profile = this._profileLearner.hydrateProfileState(
      normalizedSurface,
      result.profileState,
      {
        checkpointStateRevision: result.checkpointStateRevision,
        now: hydrationNow,
      },
    );
    this._restoredProfileKeys.add(key);
    this._checkpoint.restoreCount += 1;
    this._checkpoint.state = CHECKPOINT_STATES.READY;
    this._checkpoint.failure = null;
    return profile;
  }

  _queuePersistenceOperation(operation) {
    const historyEpoch = this._historyEpoch;
    const checkpoint = this._checkpoint;
    checkpoint.pendingOperationCount += 1;
    const run = async () => {
      try {
        if (!this._isHistoryEpochCurrent(historyEpoch)) return;
        await operation();
      } catch (error) {
        if (this._isHistoryEpochCurrent(historyEpoch)) {
          checkpoint.state = CHECKPOINT_STATES.FAILED;
          checkpoint.failure = error;
          checkpoint.failureCount += 1;
          if (error?.code === 'FEED_TEMPO_HISTORY_ADMISSION_EXPIRED') {
            // Drop this episode. A future episode must obtain a new canonical
            // restore admission after worker restart or policy change.
            this._restoredProfileKeys.clear();
            this._profileLearner.reset();
            this._lastEvaluation = null;
          }
        }
      } finally {
        checkpoint.pendingOperationCount = Math.max(
          0,
          checkpoint.pendingOperationCount - 1,
        );
        this._publishSnapshot();
      }
    };
    const queued = this._persistenceTail.then(run, run);
    this._persistenceTail = queued;
    return queued;
  }

  async _measurePersistenceRoundTrip(operation) {
    const checkpoint = this._checkpoint;
    const startedAt = this._readPerformanceNow();
    let result;
    let operationError = null;
    try {
      result = await operation();
    } catch (error) {
      operationError = error;
    }
    const durationMs = Math.max(0, this._readPerformanceNow() - startedAt);
    checkpoint.roundTripCount += 1;
    checkpoint.roundTripTotalMs += durationMs;
    checkpoint.roundTripMaximumMs = Math.max(
      checkpoint.roundTripMaximumMs,
      durationMs,
    );
    if (operationError) throw operationError;
    return result;
  }

  _readNow() {
    const value = Number(this._now());
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('FEED_TEMPO_RUNTIME_CLOCK_INVALID');
    }
    return value;
  }

  _readPerformanceNow() {
    const value = Number(this._performanceNow());
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('FEED_TEMPO_PERFORMANCE_CLOCK_INVALID');
    }
    return value;
  }

  _measureOperation(kind, operation) {
    const startedAt = this._readPerformanceNow();
    let result;
    let operationError = null;
    try {
      result = operation();
    } catch (error) {
      operationError = error;
    }
    try {
      this._recordOperationCost(kind, startedAt);
    } catch (costError) {
      if (operationError && typeof operationError === 'object') {
        operationError.costError = costError;
        throw operationError;
      }
      throw costError;
    }
    if (operationError) throw operationError;
    return result;
  }

  _recordOperationCost(kind, startedAt) {
    const durationMs = Math.max(0, this._readPerformanceNow() - startedAt);
    this._cost.operationCount += 1;
    if (kind === 'advance') this._cost.advanceOperationCount += 1;
    this._cost.totalMs += durationMs;
    this._cost.maximumMs = Math.max(this._cost.maximumMs, durationMs);
  }

  _getCostSnapshot() {
    const operationCount = this._cost.operationCount;
    return {
      measurementState: operationCount > 0 ? 'measured' : 'armed_idle',
      operationCount,
      advanceOperationCount: this._cost.advanceOperationCount,
      finalizedEpisodeCount: this._cost.finalizedEpisodeCount,
      totalMs: roundDurationMs(this._cost.totalMs),
      averageMs: roundDurationMs(
        operationCount > 0 ? this._cost.totalMs / operationCount : 0,
      ),
      maximumMs: roundDurationMs(this._cost.maximumMs),
    };
  }

  _createCheckpointState() {
    return {
      state: this._historyAllowed ? CHECKPOINT_STATES.INACTIVE : CHECKPOINT_STATES.DISABLED,
      pendingOperationCount: 0,
      restoreCount: 0,
      commitCount: 0,
      excludedEpisodeCount: 0,
      conflictCount: 0,
      failureCount: 0,
      roundTripCount: 0,
      roundTripTotalMs: 0,
      roundTripMaximumMs: 0,
      failure: null,
    };
  }

  _getCheckpointSnapshot() {
    const roundTripCount = this._checkpoint.roundTripCount;
    return {
      mode: 'persisted_shadow',
      backend: 'indexeddb_model_state',
      state: this._checkpoint.state,
      pendingOperationCount: this._checkpoint.pendingOperationCount,
      restoreCount: this._checkpoint.restoreCount,
      commitCount: this._checkpoint.commitCount,
      excludedEpisodeCount: this._checkpoint.excludedEpisodeCount,
      conflictCount: this._checkpoint.conflictCount,
      failureCount: this._checkpoint.failureCount,
      roundTripCount,
      roundTripTotalMs: roundDurationMs(this._checkpoint.roundTripTotalMs),
      roundTripAverageMs: roundDurationMs(
        roundTripCount > 0
          ? this._checkpoint.roundTripTotalMs / roundTripCount
          : 0,
      ),
      roundTripMaximumMs: roundDurationMs(
        this._checkpoint.roundTripMaximumMs,
      ),
      failure: this._checkpoint.failure
        ? 'feed_tempo_checkpoint_failure'
        : null,
    };
  }

  _publishSnapshot(snapshot = null) {
    const next = snapshot && snapshot.version === FEED_TEMPO_SNAPSHOT_VERSION
      ? snapshot
      : this.getSnapshot();
    this._onSnapshot?.(next);
    return next;
  }
}

export default FeedTempoRuntime;
