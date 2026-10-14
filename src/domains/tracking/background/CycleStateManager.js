import { getVirtualDayByBoundary } from '../../../lib/sleepPattern.js';
import { createCycleResetPolicySettingsOwner } from './cycleResetPolicySettingsOwner.js';
import { createCycleRuntimeCheckpointOwner } from './cycleRuntimeCheckpointOwner.js';
import { DEFAULT_ACTIVITY_DAY_RESET_HOUR } from '../../stats/shared/activityDay.js';

const CYCLE_MIN_DURATION = 2 * 60 * 60 * 1000;
const DEFAULT_RESET_HOUR = DEFAULT_ACTIVITY_DAY_RESET_HOUR;
const RESET_HISTORY_LIMIT = 60;
const RESET_RECOMMENDATION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});

function clampHour(value, fallback = DEFAULT_RESET_HOUR) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const floored = Math.floor(numeric);
  return Math.min(23, Math.max(0, floored));
}

function isAdaptiveStage(value) {
  return value === 'adaptive';
}

function normalizeRecommendation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidateHour = clampHour(raw.candidateHour, Number.NaN);
  const createdAt = Number(raw.createdAt);
  const reliability = typeof raw.reliability === 'string' ? raw.reliability : 'LOW';
  if (!Number.isFinite(candidateHour) || !Number.isFinite(createdAt) || createdAt <= 0) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `rec-${createdAt}`,
    candidateHour,
    reliability,
    basedOnDays: Math.max(0, Number(raw.basedOnDays) || 0),
    createdAt,
  };
}

function createDefaultResetPolicy(now = Date.now()) {
  return {
    version: 1,
    mode: 'manual',
    stage: 'bootstrap',
    effectiveResetHour: DEFAULT_RESET_HOUR,
    manualResetHour: DEFAULT_RESET_HOUR,
    bootstrapStartedAt: now,
    recommendation: null,
    pending: null,
    cooldownUntil: 0,
    history: [],
  };
}

function createDefaultCycleCheckpoint(now = Date.now()) {
  return {
    currentCycleStart: now,
    lastActivityAt: now,
    previousCycleStats: null,
    habitualWakeHour: 7,
    mode: 'fixed',
  };
}

function createDefaultCycleSettings(now = Date.now()) {
  return {
    resetPolicy: createDefaultResetPolicy(now),
  };
}

function getNextBoundaryTimestamp(now, boundaryHour) {
  const next = new Date(now);
  next.setHours(boundaryHour, 0, 0, 0);
  if (next.getTime() <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

function areEquivalentRecommendations(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left.candidateHour === right.candidateHour && left.reliability === right.reliability;
}

function applyPendingResetPolicy(settings, now = Date.now()) {
  const resetPolicy = settings.resetPolicy;
  const pending = resetPolicy.pending;
  if (pending?.reason === 'adaptive') {
    // An automatically scheduled proposal carries no user acceptance. Cancel
    // it at this input boundary, before either hydration or activity can apply
    // it. Fresh observed facts can produce a new recommendation afterwards.
    resetPolicy.pending = null;
    resetPolicy.recommendation = null;
    resetPolicy.manualResetHour = resetPolicy.effectiveResetHour;
    resetPolicy.mode = 'manual';
    return { changed: true, settings };
  }
  if (!pending || now < pending.applyAt) {
    return { changed: false, settings };
  }

  const nextHour = clampHour(pending.nextHour, resetPolicy.effectiveResetHour);
  const fromHour = clampHour(resetPolicy.effectiveResetHour, DEFAULT_RESET_HOUR);
  resetPolicy.effectiveResetHour = nextHour;
  resetPolicy.manualResetHour = clampHour(resetPolicy.manualResetHour, nextHour);
  resetPolicy.pending = null;
  resetPolicy.recommendation = null;
  resetPolicy.history.unshift({
    fromHour,
    toHour: nextHour,
    decidedAt: pending.acceptedAt,
    appliedAt: now,
    reason: pending.reason,
  });
  if (resetPolicy.history.length > RESET_HISTORY_LIMIT) {
    resetPolicy.history = resetPolicy.history.slice(0, RESET_HISTORY_LIMIT);
  }
  return { changed: true, settings };
}

function applyAdaptiveAnalysis(settings, analysis, now) {
  const resetPolicy = settings.resetPolicy;
  let changed = false;
  const nextStage = isAdaptiveStage(analysis?.stage) ? 'adaptive' : 'bootstrap';
  if (resetPolicy.stage !== nextStage) {
    resetPolicy.stage = nextStage;
    changed = true;
  }

  const previousRecommendation = normalizeRecommendation(resetPolicy.recommendation);
  const nextRecommendation = normalizeRecommendation(analysis?.recommendation);
  // Pattern evidence can propose a boundary, never authorize changing it.
  // This applies to every persisted policy mode, including an existing auto policy.
  if (!areEquivalentRecommendations(previousRecommendation, nextRecommendation)) {
    resetPolicy.recommendation = nextRecommendation;
    changed = true;
  }

  return { changed, settings };
}

function createCycleStateError(code, cause = null) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function createCycleStateManager({
  settingsService = null,
  cycleRuntimeStore = null,
  cycleResetPolicyOwner = null,
  cycleRuntimeCheckpointOwner = null,
  cycleRecommendationService = null,
} = {}) {
  if (typeof cycleRecommendationService?.analyzeCycleResetPolicy !== 'function') {
    throw new Error('CYCLE_STATE_MANAGER_RECOMMENDATION_SERVICE_REQUIRED');
  }
  const policyOwner = cycleResetPolicyOwner || createCycleResetPolicySettingsOwner({
    settingsService,
  });
  const checkpointOwner = cycleRuntimeCheckpointOwner || createCycleRuntimeCheckpointOwner({
    cycleRuntimeStore,
  });
  if (
    typeof policyOwner?.commitMutation !== 'function'
    || typeof policyOwner.getRevision !== 'function'
    || typeof policyOwner.getSnapshot !== 'function'
    || typeof policyOwner.hydrate !== 'function'
  ) {
    throw new Error('CYCLE_STATE_MANAGER_POLICY_OWNER_REQUIRED');
  }
  if (
    typeof checkpointOwner?.commitMutation !== 'function'
    || typeof checkpointOwner.drain !== 'function'
    || typeof checkpointOwner.getSnapshot !== 'function'
    || typeof checkpointOwner.hydrate !== 'function'
  ) {
    throw new Error('CYCLE_STATE_MANAGER_CHECKPOINT_OWNER_REQUIRED');
  }

  let initialized = false;
  let initPromise = null;
  let lifecycleRevision = 0;
  let profileMutationPhase = PROFILE_MUTATION_PHASES.OPEN;
  let profileMutationQuiescePromise = null;
  const detachedAdaptiveRefreshes = new Set();

  function assertProfileMutationAdmissionOpen() {
    if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN) {
      throw new Error(
        `CYCLE_STATE_MANAGER_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
      );
    }
  }

  function requireInitialized() {
    assertProfileMutationAdmissionOpen();
    if (!initialized) throw new Error('CYCLE_STATE_MANAGER_NOT_INITIALIZED');
  }

  function getEffectiveResetHour() {
    return clampHour(
      policyOwner.getSnapshot().resetPolicy.effectiveResetHour,
      DEFAULT_RESET_HOUR,
    );
  }

  function getState() {
    requireInitialized();
    const checkpoint = checkpointOwner.getSnapshot();
    const settings = policyOwner.getSnapshot();
    return {
      ...checkpoint,
      ...settings,
    };
  }

  function getPublicState() {
    const state = getState();
    return {
      currentCycleStart: state.currentCycleStart,
      lastActivityAt: state.lastActivityAt,
      previousCycleStats: state.previousCycleStats,
      resetPolicy: state.resetPolicy,
      effectiveResetHour: clampHour(
        state.resetPolicy.effectiveResetHour,
        DEFAULT_RESET_HOUR,
      ),
    };
  }

  async function refreshAdaptiveCycleSignals(now = Date.now()) {
    requireInitialized();
    const invocationLifecycleRevision = lifecycleRevision;
    const policyRevision = policyOwner.getRevision();
    const policySnapshot = policyOwner.getSnapshot();
    const resetPolicy = policySnapshot.resetPolicy;
    const analysis = await cycleRecommendationService.analyzeCycleResetPolicy({
      currentResetHour: clampHour(resetPolicy.effectiveResetHour, DEFAULT_RESET_HOUR),
      cooldownUntil: resetPolicy.cooldownUntil,
      hasPendingReset: !!resetPolicy.pending,
      now,
    });

    if (
      invocationLifecycleRevision !== lifecycleRevision
      || policyRevision !== policyOwner.getRevision()
    ) {
      return { status: 'stale', code: 'CYCLE_ADAPTIVE_RESULT_STALE_REVISION' };
    }

    const preview = applyAdaptiveAnalysis(policySnapshot, analysis, now);
    if (preview.changed) {
      try {
        await policyOwner.commitMutation({
          actionReason: 'cycle_adaptive_policy_refresh',
          expectedRevision: policyRevision,
          prepare: (currentSettings) => applyAdaptiveAnalysis(currentSettings, analysis, now).settings,
        });
      } catch (error) {
        if (
          error?.code === 'CYCLE_RESET_POLICY_REVISION_STALE'
          || error?.code === 'CYCLE_RESET_POLICY_MUTATION_STALE'
        ) {
          return { status: 'stale', code: 'CYCLE_ADAPTIVE_RESULT_STALE_REVISION' };
        }
        throw error;
      }
    }

    const nextHabitualWakeHour = analysis?.habitualWakeHour;
    if (
      invocationLifecycleRevision === lifecycleRevision
      && Number.isFinite(nextHabitualWakeHour)
    ) {
      const wakeHour = clampHour(nextHabitualWakeHour, 7);
      const currentCheckpoint = checkpointOwner.getSnapshot();
      if (wakeHour !== currentCheckpoint.habitualWakeHour) {
        await checkpointOwner.commitMutation({
          actionReason: 'cycle_habitual_wake_hour_refresh',
          prepare: (checkpoint) => ({
            ...checkpoint,
            habitualWakeHour: wakeHour,
          }),
        });
      }
    }
    return { status: 'applied' };
  }

  function scheduleAdaptiveCycleSignalsRefresh(now) {
    if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN) return;
    let trackedRefresh;
    trackedRefresh = refreshAdaptiveCycleSignals(now)
      .catch((error) => {
        console.warn(
          '[CycleStateManager] Adaptive cycle refresh failed:',
          error?.code || error?.message || String(error || 'CYCLE_ADAPTIVE_REFRESH_FAILED'),
        );
      })
      .finally(() => {
        detachedAdaptiveRefreshes.delete(trackedRefresh);
      });
    detachedAdaptiveRefreshes.add(trackedRefresh);
  }

  async function drainDetachedAdaptiveRefreshes() {
    while (detachedAdaptiveRefreshes.size > 0) {
      await Promise.all(Array.from(detachedAdaptiveRefreshes));
    }
  }

  async function flushPendingResetPolicy(now = Date.now()) {
    requireInitialized();
    const currentSettings = policyOwner.getSnapshot();
    const pending = currentSettings.resetPolicy.pending;
    if (!pending || (pending.reason !== 'adaptive' && now < pending.applyAt)) {
      return getPublicState();
    }
    await policyOwner.commitMutation({
      actionReason: pending.reason === 'adaptive'
        ? 'cycle_unconfirmed_reset_cancel'
        : 'cycle_pending_reset_apply',
      prepare: (settings) => applyPendingResetPolicy(settings, now).settings,
    });
    return getPublicState();
  }

  async function hydrateCycleState(now = Date.now(), {
    force = false,
    resetRuntimeCheckpoint = false,
  } = {}) {
    assertProfileMutationAdmissionOpen();
    if (initPromise && !force) return initPromise;
    const invocationRevision = ++lifecycleRevision;
    initialized = false;
    const run = (async () => {
      try {
        await Promise.all([
          policyOwner.hydrate({
            force,
            createDefault: () => createDefaultCycleSettings(now),
          }),
          checkpointOwner.hydrate({
            reset: resetRuntimeCheckpoint,
            createDefault: () => createDefaultCycleCheckpoint(now),
          }),
        ]);
        if (invocationRevision !== lifecycleRevision) {
          throw new Error('CYCLE_STATE_HYDRATION_STALE');
        }
        initialized = true;
        await flushPendingResetPolicy(now);
        scheduleAdaptiveCycleSignalsRefresh(now);
        return getPublicState();
      } catch (cause) {
        initialized = false;
        throw createCycleStateError('CYCLE_STATE_HYDRATION_FAILED', cause);
      }
    })();
    initPromise = run;
    try {
      return await run;
    } finally {
      if (initPromise === run) initPromise = null;
    }
  }

  function init() {
    return hydrateCycleState(Date.now());
  }

  function reload(now = Date.now(), options = {}) {
    return hydrateCycleState(now, { ...options, force: true });
  }

  async function touchActivity(now = Date.now()) {
    requireInitialized();
    await flushPendingResetPolicy(now);
    requireInitialized();
    const effectiveResetHour = getEffectiveResetHour();
    let startedNewCycle = false;
    await checkpointOwner.commitMutation({
      actionReason: 'cycle_activity_touch',
      prepare: (checkpoint) => {
        const lastActivity = checkpoint.lastActivityAt;
        const currentVDay = getVirtualDayByBoundary(now, effectiveResetHour);
        const lastVDay = getVirtualDayByBoundary(lastActivity, effectiveResetHour);
        const cycleStartVDay = getVirtualDayByBoundary(
          checkpoint.currentCycleStart,
          effectiveResetHour,
        );
        const isNewCycle = currentVDay !== lastVDay || cycleStartVDay !== currentVDay;
        const next = { ...checkpoint };

        if (isNewCycle) {
          const cycleDuration = lastActivity - checkpoint.currentCycleStart;
          if (cycleDuration >= CYCLE_MIN_DURATION) {
            next.previousCycleStats = {
              startTime: checkpoint.currentCycleStart,
              endTime: lastActivity,
              duration: cycleDuration,
              vDay: lastVDay,
              mode: checkpoint.mode,
              resetHourUsed: effectiveResetHour,
            };
          }
          next.currentCycleStart = now;
          startedNewCycle = true;
        }
        next.lastActivityAt = now;
        return next;
      },
    });
    if (startedNewCycle) scheduleAdaptiveCycleSignalsRefresh(now);
    return getPublicState();
  }

  async function setResetHour(nextHour, now = Date.now()) {
    requireInitialized();
    if (!Number.isInteger(nextHour) || nextHour < 0 || nextHour > 23) {
      throw createCycleStateError('INVALID_RESET_HOUR');
    }
    const currentSettings = policyOwner.getSnapshot();
    const currentPolicy = currentSettings.resetPolicy;
    const resolvedHour = nextHour;
    const previousManualHour = clampHour(currentPolicy.manualResetHour, resolvedHour);
    if (previousManualHour === resolvedHour && !currentPolicy.pending) {
      return getPublicState();
    }

    await policyOwner.commitMutation({
      actionReason: 'cycle_reset_hour_set',
      prepare: (settings) => {
        const resetPolicy = settings.resetPolicy;
        resetPolicy.manualResetHour = resolvedHour;
        resetPolicy.mode = 'manual';
        resetPolicy.recommendation = null;
        resetPolicy.cooldownUntil = now + RESET_RECOMMENDATION_COOLDOWN_MS;
        resetPolicy.pending = resolvedHour === resetPolicy.effectiveResetHour ? null : {
          nextHour: resolvedHour,
          acceptedAt: now,
          applyAt: getNextBoundaryTimestamp(now, resetPolicy.effectiveResetHour),
          reason: 'manual',
        };
        return settings;
      },
    });
    return getPublicState();
  }

  async function acceptResetRecommendation(now = Date.now()) {
    requireInitialized();
    const recommendation = normalizeRecommendation(
      policyOwner.getSnapshot().resetPolicy.recommendation,
    );
    if (!recommendation) return null;

    await policyOwner.commitMutation({
      actionReason: 'cycle_reset_recommendation_accept',
      prepare: (settings) => {
        const resetPolicy = settings.resetPolicy;
        const currentRecommendation = normalizeRecommendation(resetPolicy.recommendation);
        if (!currentRecommendation) {
          throw new Error('CYCLE_RESET_RECOMMENDATION_UNAVAILABLE');
        }
        resetPolicy.manualResetHour = currentRecommendation.candidateHour;
        resetPolicy.mode = 'manual';
        resetPolicy.pending = {
          nextHour: currentRecommendation.candidateHour,
          acceptedAt: now,
          applyAt: getNextBoundaryTimestamp(now, resetPolicy.effectiveResetHour),
          reason: 'recommendation',
        };
        resetPolicy.recommendation = null;
        resetPolicy.cooldownUntil = now + RESET_RECOMMENDATION_COOLDOWN_MS;
        return settings;
      },
    });
    return getPublicState();
  }

  async function dismissResetRecommendation(now = Date.now()) {
    requireInitialized();
    if (!policyOwner.getSnapshot().resetPolicy.recommendation) {
      return getPublicState();
    }
    await policyOwner.commitMutation({
      actionReason: 'cycle_reset_recommendation_dismiss',
      prepare: (settings) => {
        const resetPolicy = settings.resetPolicy;
        resetPolicy.recommendation = null;
        resetPolicy.cooldownUntil = now + RESET_RECOMMENDATION_COOLDOWN_MS;
        return settings;
      },
    });
    return getPublicState();
  }

  async function reset(now = Date.now()) {
    requireInitialized();
    lifecycleRevision += 1;
    await policyOwner.commitMutation({
      actionReason: 'cycle_reset_policy_reset',
      allowMissing: true,
      prepare: () => createDefaultCycleSettings(now),
    });
    requireInitialized();
    await checkpointOwner.hydrate({
      reset: true,
      createDefault: () => createDefaultCycleCheckpoint(now),
    });
    scheduleAdaptiveCycleSignalsRefresh(now);
    return getState();
  }

  function quiesceForProfileMutation() {
    if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCING) {
      return profileMutationQuiescePromise;
    }
    if (profileMutationPhase === PROFILE_MUTATION_PHASES.QUIESCED) {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (
      profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN
      && profileMutationPhase !== PROFILE_MUTATION_PHASES.QUIESCE_FAILED
    ) {
      return Promise.reject(new Error(
        `CYCLE_STATE_MANAGER_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`,
      ));
    }

    const closesOpenLifetime = profileMutationPhase === PROFILE_MUTATION_PHASES.OPEN;
    profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCING;
    if (closesOpenLifetime) lifecycleRevision += 1;
    initialized = false;

    const activeInitialization = initPromise;
    const run = (async () => {
      await Promise.all([
        activeInitialization?.catch(() => undefined) || Promise.resolve(),
        drainDetachedAdaptiveRefreshes(),
      ]);
      await checkpointOwner.drain();
      await drainDetachedAdaptiveRefreshes();
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCED;
      return Object.freeze({ quiesced: true, reused: false });
    })().catch((cause) => {
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
      throw createCycleStateError(
        'CYCLE_STATE_MANAGER_PROFILE_MUTATION_QUIESCE_FAILED',
        cause,
      );
    });
    profileMutationQuiescePromise = run;
    return run;
  }

  return {
    acceptResetRecommendation,
    dismissResetRecommendation,
    flushPendingResetPolicy,
    getPublicState,
    getState,
    init,
    quiesceForProfileMutation,
    reload,
    reset,
    setResetHour,
    touchActivity,
  };
}
