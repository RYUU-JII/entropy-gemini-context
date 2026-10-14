import { STORAGE_SESSION_KEYS } from '../../../../platform/storage/runtime/RuntimeSessionRepository.js';

const SCHEMA_VERSION = 1;
export const STATS_RUNTIME_HEALTH_SAVE_PERSIST_INTERVAL_MS = 5_000;
const COALESCED_ACTIVE_SEAL_STATUSES = new Set(['pass', 'watch', 'skipped']);
const IMMEDIATE_ACTIVE_SEAL_INCIDENT_CODES = new Set([
  'foreground_segment_resume_ambiguous',
]);
const PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
  QUIESCE_FAILED: 'quiesce_failed',
});

function toTimestamp(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function toCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : 0;
}

function toPositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function estimateJsonPayloadBytes(value) {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return null;
    if (typeof TextEncoder === 'function') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch (_error) {
    return null;
  }
}

function serializeError(error) {
  if (!error) return null;
  return {
    name: error?.name || 'Error',
    message: error?.message || String(error),
    code: error?.code || null,
  };
}

function resolveActiveSealPersistMode(diagnostic) {
  const status = typeof diagnostic?.status === 'string' ? diagnostic.status : '';
  const code = typeof diagnostic?.code === 'string' ? diagnostic.code : '';
  if (status === 'fail' || IMMEDIATE_ACTIVE_SEAL_INCIDENT_CODES.has(code)) {
    return 'immediate';
  }
  return COALESCED_ACTIVE_SEAL_STATUSES.has(status) ? 'throttled' : 'immediate';
}

function createCounters(source = {}) {
  return {
    alarmSeen: toCount(source.alarmSeen),
    tickStarted: toCount(source.tickStarted),
    tickCompleted: toCount(source.tickCompleted),
    tickFailed: toCount(source.tickFailed),
    activeSealCompleted: toCount(source.activeSealCompleted),
    activeSealWatch: toCount(source.activeSealWatch),
    activeSealFailed: toCount(source.activeSealFailed),
    saveStarted: toCount(source.saveStarted),
    saveCompleted: toCount(source.saveCompleted),
    saveFailed: toCount(source.saveFailed),
    foregroundResumeAmbiguous: toCount(source.foregroundResumeAmbiguous),
  };
}

function createEmptyStatsRuntimeHealth(now = Date.now()) {
  const initializedAt = toTimestamp(now) || Date.now();
  return {
    schemaVersion: SCHEMA_VERSION,
    available: true,
    initializedAt,
    updatedAt: initializedAt,
    startupReason: null,
    lastAlarmSeenAt: null,
    lastAlarmName: null,
    lastAlarmScheduledTime: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    lastTickFailedAt: null,
    lastTickSource: null,
    lastTickError: null,
    lastTickBatchSummary: null,
    lastActiveSealAt: null,
    lastActiveSealStatus: null,
    lastActiveSealCode: null,
    lastActiveSealHostname: null,
    lastActiveSealElapsedMs: null,
    lastActiveSealReason: null,
    lastForegroundResumeIncident: null,
    lastSaveStartedAt: null,
    lastSaveCompletedAt: null,
    lastSaveFailedAt: null,
    lastSaveForce: null,
    lastSaveError: null,
    lastHealthPayloadBytes: null,
    maxHealthPayloadBytes: null,
    lastHealthPayloadKeys: null,
    counters: createCounters(),
    lastHealthWriteError: null,
  };
}

function normalizeStatsRuntimeHealth(snapshot, { now = Date.now(), missing = false } = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return missing
      ? {
        ...createEmptyStatsRuntimeHealth(now),
        available: false,
        reason: 'stats_runtime_health_missing',
      }
      : createEmptyStatsRuntimeHealth(now);
  }

  const normalized = {
    ...createEmptyStatsRuntimeHealth(now),
    schemaVersion: SCHEMA_VERSION,
    available: snapshot.available !== false,
    initializedAt: toTimestamp(snapshot.initializedAt) || toTimestamp(now) || Date.now(),
    updatedAt: toTimestamp(snapshot.updatedAt) || toTimestamp(snapshot.initializedAt) || toTimestamp(now),
    startupReason: typeof snapshot.startupReason === 'string' ? snapshot.startupReason : null,
    lastAlarmSeenAt: toTimestamp(snapshot.lastAlarmSeenAt),
    lastAlarmName: typeof snapshot.lastAlarmName === 'string' ? snapshot.lastAlarmName : null,
    lastAlarmScheduledTime: toTimestamp(snapshot.lastAlarmScheduledTime),
    lastTickStartedAt: toTimestamp(snapshot.lastTickStartedAt),
    lastTickCompletedAt: toTimestamp(snapshot.lastTickCompletedAt),
    lastTickFailedAt: toTimestamp(snapshot.lastTickFailedAt),
    lastTickSource: typeof snapshot.lastTickSource === 'string' ? snapshot.lastTickSource : null,
    lastTickError: snapshot.lastTickError && typeof snapshot.lastTickError === 'object'
      ? snapshot.lastTickError
      : null,
    lastTickBatchSummary: snapshot.lastTickBatchSummary && typeof snapshot.lastTickBatchSummary === 'object'
      ? {
        activeElapsedMs: toCount(snapshot.lastTickBatchSummary.activeElapsedMs),
        backgroundElapsedMs: toCount(snapshot.lastTickBatchSummary.backgroundElapsedMs),
        activeClassifiedTabs: toCount(snapshot.lastTickBatchSummary.activeClassifiedTabs),
        backgroundClassifiedTabs: toCount(snapshot.lastTickBatchSummary.backgroundClassifiedTabs),
      }
      : null,
    lastActiveSealAt: toTimestamp(snapshot.lastActiveSealAt),
    lastActiveSealStatus: typeof snapshot.lastActiveSealStatus === 'string' ? snapshot.lastActiveSealStatus : null,
    lastActiveSealCode: typeof snapshot.lastActiveSealCode === 'string' ? snapshot.lastActiveSealCode : null,
    lastActiveSealHostname: typeof snapshot.lastActiveSealHostname === 'string' ? snapshot.lastActiveSealHostname : null,
    lastActiveSealElapsedMs: toPositiveNumber(snapshot.lastActiveSealElapsedMs),
    lastActiveSealReason: typeof snapshot.lastActiveSealReason === 'string' ? snapshot.lastActiveSealReason : null,
    lastForegroundResumeIncident: snapshot.lastForegroundResumeIncident && typeof snapshot.lastForegroundResumeIncident === 'object'
      ? snapshot.lastForegroundResumeIncident
      : null,
    lastSaveStartedAt: toTimestamp(snapshot.lastSaveStartedAt),
    lastSaveCompletedAt: toTimestamp(snapshot.lastSaveCompletedAt),
    lastSaveFailedAt: toTimestamp(snapshot.lastSaveFailedAt),
    lastSaveForce: typeof snapshot.lastSaveForce === 'boolean' ? snapshot.lastSaveForce : null,
    lastSaveError: snapshot.lastSaveError && typeof snapshot.lastSaveError === 'object'
      ? snapshot.lastSaveError
      : null,
    lastHealthPayloadBytes: toPositiveNumber(snapshot.lastHealthPayloadBytes),
    maxHealthPayloadBytes: toPositiveNumber(snapshot.maxHealthPayloadBytes),
    lastHealthPayloadKeys: toPositiveNumber(snapshot.lastHealthPayloadKeys),
    counters: createCounters(snapshot.counters),
    lastHealthWriteError: snapshot.lastHealthWriteError && typeof snapshot.lastHealthWriteError === 'object'
      ? snapshot.lastHealthWriteError
      : null,
  };
  return normalized;
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function attachPayloadDiagnostics(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  snapshot.lastHealthPayloadKeys = Object.keys(snapshot).length;
  const bytes = estimateJsonPayloadBytes(snapshot);
  snapshot.lastHealthPayloadBytes = bytes;
  if (bytes !== null) {
    snapshot.maxHealthPayloadBytes = Math.max(
      Number(snapshot.maxHealthPayloadBytes) || 0,
      bytes,
    );
  }
  return snapshot;
}

export function createStatsRuntimeHealthLedger({
  sessionStore,
  sessionKey = STORAGE_SESSION_KEYS.STATS_HEALTH,
  now = () => Date.now(),
  scheduleTimeout = (callback, delayMs) => setTimeout(callback, delayMs),
  cancelTimeout = (timerId) => clearTimeout(timerId),
} = {}) {
  if (!sessionStore || typeof sessionStore.get !== 'function' || typeof sessionStore.set !== 'function') {
    throw new Error('STATS_RUNTIME_HEALTH_LEDGER_SESSION_STORE_REQUIRED');
  }

  let health = normalizeStatsRuntimeHealth(null, { missing: true, now: now() });
  let hydrationPhase = 'uninitialized';
  let hydrationPromise = null;
  let hydrationError = null;
  // Fixed-size field overlay, not a queue of events waiting on storage.
  let preHydrationPatch = {};
  let acceptedRevision = 0;
  let persistedRevision = 0;
  let writePromise = null;
  let immediateRequested = false;
  let trailingRequested = false;
  let lastPersistAttemptAt = null;
  let trailingPersistTimer = null;
  let profileMutationPhase = PROFILE_MUTATION_PHASES.OPEN;
  let profileMutationQuiescePromise = null;

  function assertProfileMutationAdmissionOpen() {
    if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN) {
      const error = new Error(
        `STATS_RUNTIME_HEALTH_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
      );
      error.code = 'STATS_RUNTIME_HEALTH_PROFILE_MUTATION_ADMISSION_CLOSED';
      error.phase = profileMutationPhase;
      throw error;
    }
  }

  function cancelTrailingPersistTimer() {
    if (trailingPersistTimer === null) return;
    cancelTimeout(trailingPersistTimer);
    trailingPersistTimer = null;
  }

  function startWrite() {
    if (writePromise) return writePromise;
    cancelTrailingPersistTimer();
    immediateRequested = false;
    trailingRequested = false;
    const revision = acceptedRevision;
    const nextHealth = normalizeStatsRuntimeHealth(health, { now: now() });
    nextHealth.lastHealthWriteError = null;
    attachPayloadDiagnostics(nextHealth);
    lastPersistAttemptAt = toTimestamp(now()) || Date.now();
    const run = Promise.resolve().then(async () => {
      try {
        await sessionStore.set({ [sessionKey]: nextHealth });
        persistedRevision = revision;
        // A completed old write owns mirror metadata only, never newer RAM facts.
        health.lastHealthPayloadBytes = nextHealth.lastHealthPayloadBytes;
        health.maxHealthPayloadBytes = nextHealth.maxHealthPayloadBytes;
        health.lastHealthPayloadKeys = nextHealth.lastHealthPayloadKeys;
        health.lastHealthWriteError = null;
      } catch (cause) {
        health.lastHealthWriteError = {
          name: 'Error', code: 'STATS_RUNTIME_HEALTH_PERSIST_FAILED',
          message: 'STATS_RUNTIME_HEALTH_PERSIST_FAILED', cause: serializeError(cause),
        };
        console.error('[StatsRuntimeHealthLedger] persistence failed', health.lastHealthWriteError);
        throw cause;
      }
    });
    writePromise = run;
    // Observe every detached write. Failure stays dirty and visible, with no
    // automatic retry loop; new demand or an explicit barrier may retry it.
    void run.then(() => {
      writePromise = null;
      schedulePersistence();
    }, () => { writePromise = null; });
    return run;
  }

  function schedulePersistence() {
    if (profileMutationPhase !== PROFILE_MUTATION_PHASES.OPEN
      || hydrationPhase !== 'ready' || writePromise
      || acceptedRevision === persistedRevision) return;
    if (!immediateRequested && !trailingRequested) return;
    const elapsedMs = lastPersistAttemptAt === null
      ? STATS_RUNTIME_HEALTH_SAVE_PERSIST_INTERVAL_MS
      : Math.max(0, now() - lastPersistAttemptAt);
    if (immediateRequested || elapsedMs >= STATS_RUNTIME_HEALTH_SAVE_PERSIST_INTERVAL_MS) {
      startWrite();
    } else if (trailingPersistTimer === null) {
      trailingPersistTimer = scheduleTimeout(() => {
        trailingPersistTimer = null;
        schedulePersistence();
      }, STATS_RUNTIME_HEALTH_SAVE_PERSIST_INTERVAL_MS - elapsedMs);
    }
  }

  function requestPersistence(persistMode) {
    if (persistMode === 'immediate') {
      immediateRequested = true;
      cancelTrailingPersistTimer();
    } else if (persistMode === 'throttled') {
      trailingRequested = true;
    }
    schedulePersistence();
  }

  function hydrate({ reason = 'runtime_health_init' } = {}) {
    if (hydrationPhase === 'ready') return Promise.resolve();
    if (hydrationPromise) return hydrationPromise;
    hydrationPhase = 'loading';
    const run = Promise.resolve().then(async () => {
      try {
        const session = await sessionStore.get({ [sessionKey]: null });
        const nextHealth = normalizeStatsRuntimeHealth(session?.[sessionKey], { now: now() });
        // Session counters are the previous lifetime; RAM counters are this
        // lifetime's accepted delta until this single read succeeds.
        for (const [key, value] of Object.entries(preHydrationPatch)) {
          if (key !== 'counters') nextHealth[key] = value;
        }
        for (const key of Object.keys(nextHealth.counters)) {
          nextHealth.counters[key] += health.counters[key];
        }
        nextHealth.available = true;
        nextHealth.updatedAt = now();
        nextHealth.startupReason = reason;
        health = nextHealth;
        preHydrationPatch = {};
        acceptedRevision += 1;
        hydrationError = null;
        hydrationPhase = 'ready';
      } catch (cause) {
        hydrationPhase = 'failed';
        hydrationError = {
          code: 'STATS_RUNTIME_HEALTH_HYDRATION_FAILED', cause: serializeError(cause),
        };
        console.error('[StatsRuntimeHealthLedger] hydration failed', hydrationError);
        throw cause;
      }
    });
    hydrationPromise = run;
    void run.then(() => { hydrationPromise = null; }, () => { hydrationPromise = null; });
    return run;
  }

  async function flushOwned() {
    const targetRevision = acceptedRevision;
    cancelTrailingPersistTimer();
    while (persistedRevision < targetRevision) {
      await (writePromise || startWrite());
    }
  }

  function init(options = {}) {
    assertProfileMutationAdmissionOpen();
    return hydrate(options).then(async () => {
      await flushOwned();
      return getSnapshot();
    });
  }

  function update(mutator, { persistMode = 'immediate' } = {}) {
    assertProfileMutationAdmissionOpen();
    const timestamp = now();
    const nextHealth = {
      ...(hydrationPhase === 'ready' ? health : preHydrationPatch),
      counters: { ...health.counters },
    };
    mutator(nextHealth, timestamp);
    if (hydrationPhase !== 'ready') preHydrationPatch = nextHealth;
    nextHealth.updatedAt = timestamp;
    health = { ...health, ...nextHealth };
    acceptedRevision += 1;
    requestPersistence(persistMode);
    if (hydrationPhase === 'uninitialized') {
      // Hydration failure is reported by its owner. Records keep their bounded
      // RAM delta; only explicit init/quiesce retries the failed read.
      void hydrate({ reason: 'runtime_health_lazy_init' }).then(
        () => requestPersistence('immediate'), () => undefined,
      );
    }
    return getSnapshot();
  }

  function getSnapshot() {
    return cloneSnapshot({
      ...health,
      // Runtime receipts only: never persisted or used as a stats fact source.
      persistence: {
        hydrationPhase, hydrationError, acceptedRevision, persistedRevision,
        writeInFlight: writePromise !== null,
        pending: acceptedRevision !== persistedRevision,
      },
    });
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
        `STATS_RUNTIME_HEALTH_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`,
      ));
    }

    profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCING;
    cancelTrailingPersistTimer();
    const quiesceRun = (async () => {
      if (hydrationPhase !== 'uninitialized') {
        await hydrate({ reason: 'runtime_health_quiesce' });
        await flushOwned();
      }
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCED;
      return Object.freeze({ quiesced: true, reused: false });
    })().catch((cause) => {
      profileMutationPhase = PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
      const error = new Error('STATS_RUNTIME_HEALTH_PROFILE_MUTATION_QUIESCE_FAILED');
      error.code = 'STATS_RUNTIME_HEALTH_PROFILE_MUTATION_QUIESCE_FAILED';
      error.cause = cause;
      throw error;
    });
    profileMutationQuiescePromise = quiesceRun;
    void quiesceRun.then(
      () => {
        if (profileMutationQuiescePromise === quiesceRun) {
          profileMutationQuiescePromise = null;
        }
      },
      () => {
        if (profileMutationQuiescePromise === quiesceRun) {
          profileMutationQuiescePromise = null;
        }
      },
    );
    return quiesceRun;
  }

  return {
    getSnapshot,
    init,
    quiesceForProfileMutation,
    recordAlarmSeen: ({ alarmName = null, scheduledTime = null, at = now() } = {}) => update((next) => {
      next.lastAlarmSeenAt = toTimestamp(at);
      next.lastAlarmName = typeof alarmName === 'string' ? alarmName : null;
      next.lastAlarmScheduledTime = toTimestamp(scheduledTime);
      next.counters.alarmSeen += 1;
    }, { persistMode: 'throttled' }),
    recordTickStarted: ({ source = 'alarm', at = now() } = {}) => update((next) => {
      next.lastTickStartedAt = toTimestamp(at);
      next.lastTickSource = typeof source === 'string' ? source : null;
      next.counters.tickStarted += 1;
    }, { persistMode: 'throttled' }),
    recordTickCompleted: ({ source = 'alarm', at = now(), batchSummary = null } = {}) => update((next) => {
      next.lastTickCompletedAt = toTimestamp(at);
      next.lastTickSource = typeof source === 'string' ? source : null;
      next.lastTickError = null;
      next.lastTickBatchSummary = batchSummary && typeof batchSummary === 'object'
        ? {
          activeElapsedMs: toCount(batchSummary.activeElapsedMs),
          backgroundElapsedMs: toCount(batchSummary.backgroundElapsedMs),
          activeClassifiedTabs: toCount(batchSummary.activeClassifiedTabs),
          backgroundClassifiedTabs: toCount(batchSummary.backgroundClassifiedTabs),
        }
        : null;
      next.counters.tickCompleted += 1;
    }, { persistMode: 'throttled' }),
    recordTickFailed: ({ source = 'alarm', at = now(), error = null } = {}) => update((next) => {
      next.lastTickFailedAt = toTimestamp(at);
      next.lastTickSource = typeof source === 'string' ? source : null;
      next.lastTickError = serializeError(error);
      next.counters.tickFailed += 1;
    }),
    recordActiveSealDiagnostic: ({ diagnostic = null } = {}) => update((next, timestamp) => {
      const attemptedAt = toTimestamp(diagnostic?.attemptedAt) || timestamp;
      next.lastActiveSealAt = attemptedAt;
      next.lastActiveSealStatus = typeof diagnostic?.status === 'string' ? diagnostic.status : null;
      next.lastActiveSealCode = typeof diagnostic?.code === 'string' ? diagnostic.code : null;
      next.lastActiveSealHostname = typeof diagnostic?.hostname === 'string' ? diagnostic.hostname : null;
      next.lastActiveSealElapsedMs = toPositiveNumber(diagnostic?.elapsedMs);
      next.lastActiveSealReason = typeof diagnostic?.message === 'string' ? diagnostic.message : null;
      if (diagnostic?.status === 'pass') next.counters.activeSealCompleted += 1;
      else if (diagnostic?.status === 'fail') next.counters.activeSealFailed += 1;
      else next.counters.activeSealWatch += 1;
      if (diagnostic?.code === 'foreground_segment_resume_ambiguous') {
        next.lastForegroundResumeIncident = {
          at: attemptedAt,
          targetTabId: diagnostic.targetTabId ?? null,
          hostname: diagnostic.hostname ?? null,
          elapsedMs: toPositiveNumber(diagnostic.elapsedMs),
          reason: diagnostic.message || null,
        };
        next.counters.foregroundResumeAmbiguous += 1;
      }
    }, { persistMode: resolveActiveSealPersistMode(diagnostic) }),
    recordSaveStarted: ({ force = false, at = now() } = {}) => update((next) => {
      next.lastSaveStartedAt = toTimestamp(at);
      next.lastSaveForce = !!force;
      next.counters.saveStarted += 1;
    }, { persistMode: force ? 'immediate' : 'memory' }),
    recordSaveCompleted: ({ force = false, at = now() } = {}) => update((next) => {
      next.lastSaveCompletedAt = toTimestamp(at);
      next.lastSaveForce = !!force;
      next.lastSaveError = null;
      next.counters.saveCompleted += 1;
    }, { persistMode: force ? 'immediate' : 'throttled' }),
    recordSaveFailed: ({ force = false, at = now(), error = null } = {}) => update((next) => {
      next.lastSaveFailedAt = toTimestamp(at);
      next.lastSaveForce = !!force;
      next.lastSaveError = serializeError(error);
      next.counters.saveFailed += 1;
    }),
  };
}
