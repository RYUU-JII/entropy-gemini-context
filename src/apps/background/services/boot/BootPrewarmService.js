import { ZEN_RENDER_PRESET_STORAGE_KEY, DEFAULT_ZEN_RENDER_PRESET, requireZenRenderPreset } from '../../../../domains/settings/config/zenRenderPreset.js';
import {
  BOOT_PREWARM_SCHEMA_VERSION,
  buildBootPrewarmProtocolSnapshot,
  requireBootPrewarmDashboardSnapshot,
} from '../../../boot/bootPrewarmSnapshotContract.js';
import { DEFAULT_THEME_ID } from '../../../../themes/core/ids.js';
import {
  readStoredThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  resolveKnownThemeId,
} from '../../../../themes/core/state/themePreferenceRepository.js';
import { readThemePreferenceSettingsSnapshot } from '../../../../platform/storage/settings/ThemePreferenceSettingsQueryService.js';
import {
  DEFAULT_SIDEBAR_DISPLAY_MODE,
  SIDEBAR_DISPLAY_MODE_STORAGE_KEY,
  normalizeSidebarDisplayMode,
} from '../../../../domains/settings/config/sidebarDisplayMode.js';
import { requireCanonicalCLSEStatusSnapshot } from '../../../../domains/behavior/clseStatusContract.js';
import {
  requireCanonicalStatsStatusSnapshot,
} from '../../../../domains/stats/contracts/statsStatusSnapshotContract.js';

const DEFAULT_STATS_DAYS_BACK = 30;
const DEFAULT_TTL_MS = 45_000;

const hasPerformanceNow = () => (
  typeof performance !== 'undefined'
  && typeof performance.now === 'function'
);

const nowMs = () => (hasPerformanceNow() ? performance.now() : Date.now());

const toFixedMs = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const sanitizeNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const normalizeStatsDaysBack = (value) => {
  const parsed = sanitizeNumber(value, DEFAULT_STATS_DAYS_BACK);
  return Math.max(1, Math.min(180, Math.floor(parsed)));
};

const normalizeTtlMs = (value) => {
  const parsed = sanitizeNumber(value, DEFAULT_TTL_MS);
  return Math.max(5_000, Math.min(300_000, Math.floor(parsed)));
};

function requireBootPrewarmFunction(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireBootPrewarmOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isStatusSnapshotCanonicalError = (error) => (
  error?.code === 'STATS_STATUS_SNAPSHOT_NON_CANONICAL'
  || error?.code === 'BOOT_PREWARM_STATUS_SNAPSHOT_NON_CANONICAL'
);

const describeSettingsValueType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

function createMalformedSettingsValueError(key, value) {
  const error = new Error('SETTINGS_MALFORMED_VALUE');
  error.code = 'SETTINGS_MALFORMED_VALUE';
  error.key = key;
  error.valueType = describeSettingsValueType(value);
  return error;
}

function requirePrewarmSettingsCache(settingsCache) {
  if (!isObject(settingsCache)) {
    const error = new Error('BOOT_PREWARM_SETTINGS_CACHE_INVALID');
    error.code = 'BOOT_PREWARM_SETTINGS_CACHE_INVALID';
    throw error;
  }
  return settingsCache;
}

function resolvePrewarmFilterSettings(settingsCache) {
  if (Object.hasOwn(settingsCache, 'filterSettings') && isObject(settingsCache.filterSettings)) {
    return settingsCache.filterSettings;
  }
  throw createMalformedSettingsValueError('filterSettings', settingsCache.filterSettings);
}

const formatPrewarmError = (error) => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string' && error.message.trim()) return error.message;
  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
};

const createPrewarmTimingRecorder = () => {
  const startedAtMs = nowMs();
  const steps = [];
  const timingsMs = {};
  let failedStep = null;

  const recordStep = (step, startedAt, error = null, { recordFailedStep = true } = {}) => {
    const durationMs = toFixedMs(nowMs() - startedAt);
    timingsMs[step] = durationMs;
    const entry = {
      step,
      durationMs,
      ok: !error,
    };
    if (error) {
      entry.error = formatPrewarmError(error);
      if (recordFailedStep) {
        failedStep = step;
      }
    }
    steps.push(entry);
  };

  const measure = async (step, fn, options = {}) => {
    const startedAt = nowMs();
    try {
      const result = await fn();
      recordStep(step, startedAt, null, options);
      return result;
    } catch (error) {
      recordStep(step, startedAt, error, options);
      throw error;
    }
  };

  const measureSync = (step, fn, options = {}) => {
    const startedAt = nowMs();
    try {
      const result = fn();
      recordStep(step, startedAt, null, options);
      return result;
    } catch (error) {
      recordStep(step, startedAt, error, options);
      throw error;
    }
  };

  const snapshot = () => ({
    totalMs: toFixedMs(nowMs() - startedAtMs),
    failedStep,
    timingsMs: { ...timingsMs },
    steps: steps.map((step) => ({ ...step })),
  });

  return {
    measure,
    measureSync,
    snapshot,
  };
};

const summarizeAnalysisBootstrap = (analysisSnapshot = null, error = null) => ({
  available: isObject(analysisSnapshot),
  error: formatPrewarmError(error),
  hasCycleState: isObject(analysisSnapshot?.cycleState),
  hasCycleSnapshot: isObject(analysisSnapshot?.cycleSnapshot),
  hasStatusSnapshot: isObject(analysisSnapshot?.statusSnapshot),
});

const attachBootPrewarmErrorDetails = (error, diagnostics) => {
  if (!error || typeof error !== 'object') return;
  const existingDetails = isObject(error.details) ? error.details : {};
  error.details = {
    ...existingDetails,
    bootPrewarm: {
      ...(isObject(existingDetails.bootPrewarm) ? existingDetails.bootPrewarm : {}),
      ...diagnostics,
    },
  };
};

const buildDeliveryDiagnostics = ({
  mode,
  snapshot,
  requestStartedAtMs,
  force,
  reason,
}) => {
  const generatedAt = Number(snapshot?.generatedAtEpochMs);
  const staleAfter = Number(snapshot?.staleAfterEpochMs);
  const nowEpochMs = Date.now();
  return {
    mode,
    requestDurationMs: toFixedMs(nowMs() - requestStartedAtMs),
    force: !!force,
    reason: String(reason || 'dashboard'),
    snapshotAgeMs: Number.isFinite(generatedAt) ? Math.max(0, nowEpochMs - generatedAt) : null,
    snapshotStaleInMs: Number.isFinite(staleAfter) ? Math.max(0, staleAfter - nowEpochMs) : null,
  };
};

const attachDeliveryDiagnostics = (snapshot, deliveryDiagnostics) => {
  if (!isObject(snapshot)) return null;
  const meta = isObject(snapshot.meta) ? snapshot.meta : {};
  const diagnostics = isObject(meta.diagnostics) ? meta.diagnostics : {};
  snapshot.meta = {
    ...meta,
    diagnostics: {
      ...diagnostics,
      delivery: deliveryDiagnostics,
    },
  };
  return snapshot;
};

export function createBootPrewarmService({
  settingsService,
  getSettingsCache,
  getAnalysisBootstrapSnapshot,
  getCycleState,
  getCLSEStatus,
  readThemePreference = readStoredThemePreference,
  readThemePreferenceSettings = readThemePreferenceSettingsSnapshot,
  statsDaysBack = DEFAULT_STATS_DAYS_BACK,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  const ensureSettingsCache = requireBootPrewarmOwnerMethod(
    settingsService,
    'ensureSettingsCache',
    'BOOT_PREWARM_SETTINGS_SERVICE_REQUIRED',
  );
  const readSettingsCache = requireBootPrewarmFunction(
    getSettingsCache,
    'BOOT_PREWARM_SETTINGS_CACHE_READER_REQUIRED',
  );
  const readAnalysisBootstrapSnapshot = requireBootPrewarmFunction(
    getAnalysisBootstrapSnapshot,
    'BOOT_PREWARM_ANALYSIS_SNAPSHOT_OWNER_REQUIRED',
  );
  const readCycleState = requireBootPrewarmFunction(
    getCycleState,
    'BOOT_PREWARM_CYCLE_STATE_OWNER_REQUIRED',
  );
  const readCLSEStatus = requireBootPrewarmFunction(
    getCLSEStatus,
    'BOOT_PREWARM_CLSE_STATUS_OWNER_REQUIRED',
  );
  const readPreferenceSettings = requireBootPrewarmFunction(
    readThemePreferenceSettings,
    'BOOT_PREWARM_THEME_SETTINGS_OWNER_REQUIRED',
  );
  const resolvedStatsDaysBack = normalizeStatsDaysBack(statsDaysBack);
  const resolvedTtlMs = normalizeTtlMs(ttlMs);
  let snapshotCache = null;
  let inFlightPromise = null;
  let invalidationGeneration = 0;
  let invalidationReason = null;

  const requireCurrentGeneration = (attemptedGeneration) => {
    if (attemptedGeneration === invalidationGeneration) return;
    const error = new Error('BOOT_PREWARM_SNAPSHOT_INVALIDATED');
    error.code = 'BOOT_PREWARM_SNAPSHOT_INVALIDATED';
    error.details = {
      attemptedGeneration,
      currentGeneration: invalidationGeneration,
      invalidationReason,
    };
    throw error;
  };

  const requireCacheableSnapshot = (candidate) => {
    if (!isObject(candidate?.analysis)) {
      throw new Error('BOOT_PREWARM_CACHE_ANALYSIS_REQUIRED');
    }
    if (candidate.analysis.statusSnapshot !== null) {
      requireCanonicalStatsStatusSnapshot(
        candidate.analysis.statusSnapshot,
        'BOOT_PREWARM_STATUS_SNAPSHOT_NON_CANONICAL',
      );
    }
    return candidate;
  };

  const readAdmittedCache = ({ allowStale = false } = {}) => {
    if (!snapshotCache) return null;
    if (!allowStale && !isFresh(snapshotCache)) return null;
    return snapshotCache;
  };

  const buildSnapshot = async ({ reason = 'manual' } = {}) => {
    const timing = createPrewarmTimingRecorder();
    let analysisSnapshot = null;
    let analysisSnapshotError = null;
    let usedCycleStateDirectRead = false;

    try {
      await timing.measure('ensureSettingsCache', () => ensureSettingsCache());

      const storedThemeId = await timing.measure(
        'readThemePreference',
        () => readThemePreference(DEFAULT_THEME_ID),
      );
      const themeId = resolveKnownThemeId(storedThemeId, DEFAULT_THEME_ID);
      const preferenceSettings = await timing.measure(
        'readThemePreferenceSettings',
        () => readPreferenceSettings({
          [THEME_PREFERENCE_STORAGE_KEY]: themeId,
          [SIDEBAR_DISPLAY_MODE_STORAGE_KEY]: DEFAULT_SIDEBAR_DISPLAY_MODE,
          [ZEN_RENDER_PRESET_STORAGE_KEY]: DEFAULT_ZEN_RENDER_PRESET,
        }),
      );
      const sidebarDisplayMode = normalizeSidebarDisplayMode(
        preferenceSettings?.[SIDEBAR_DISPLAY_MODE_STORAGE_KEY],
      );

      const settingsCache = timing.measureSync('readSettingsCache', () => requirePrewarmSettingsCache(readSettingsCache()));
      const filterSettings = timing.measureSync(
        'resolvePrewarmFilterSettings',
        () => resolvePrewarmFilterSettings(settingsCache),
      );

      try {
        const snapshot = await timing.measure(
          'readAnalysisBootstrapSnapshot',
          () => readAnalysisBootstrapSnapshot({
            daysBack: resolvedStatsDaysBack,
            includeSitesSnapshot: false,
          }),
          { recordFailedStep: false },
        );
        analysisSnapshot = isObject(snapshot) ? snapshot : null;
      } catch (error) {
        if (isStatusSnapshotCanonicalError(error)) throw error;
        analysisSnapshotError = error;
        console.warn(
          '[BootPrewarmService] Failed to read analysis bootstrap snapshot:',
          error?.message || String(error || 'BOOT_PREWARM_ANALYSIS_SNAPSHOT_FAILED'),
        );
        analysisSnapshot = null;
      }

      let cycleState = isObject(analysisSnapshot?.cycleState)
        ? analysisSnapshot.cycleState
        : null;
      if (!cycleState) {
        usedCycleStateDirectRead = true;
        cycleState = (await timing.measure(
          'readCycleStateDirect',
          () => Promise.resolve(readCycleState()),
        )) || null;
      }
      const clseStatus = timing.measureSync(
        'readCLSEStatus',
        () => requireCanonicalCLSEStatusSnapshot(
          readCLSEStatus(),
          'BOOT_PREWARM_CLSE_STATUS_INVALID',
        ),
      );
      const protocol = timing.measureSync('buildProtocolSnapshot', () => buildBootPrewarmProtocolSnapshot({
        settingsCache,
        filterSettings,
      }));

      const statusSnapshot = isObject(analysisSnapshot?.statusSnapshot)
        ? requireCanonicalStatsStatusSnapshot(
            analysisSnapshot.statusSnapshot,
            'BOOT_PREWARM_STATUS_SNAPSHOT_NON_CANONICAL',
          )
        : null;
      const generatedAtEpochMs = Date.now();
      const analysis = {
        cycleState: isObject(cycleState)
          ? { ...cycleState }
          : null,
        cycleSnapshot: isObject(analysisSnapshot?.cycleSnapshot)
          ? { ...analysisSnapshot.cycleSnapshot }
          : null,
        statusSnapshot,
      };
      return {
        schemaVersion: BOOT_PREWARM_SCHEMA_VERSION,
        source: 'background-prewarm',
        generatedAtEpochMs,
        staleAfterEpochMs: generatedAtEpochMs + resolvedTtlMs,
        reason,
        preference: {
          themeId,
          sidebarDisplayMode,
          zenRenderPreset: requireZenRenderPreset(preferenceSettings[ZEN_RENDER_PRESET_STORAGE_KEY]),
        },
        protocol,
        analysis,
        clse: {
          isEnabled: clseStatus.isEnabled,
          sensitivityScale: clseStatus.sensitivityScale,
          alertCooldownMs: clseStatus.alertCooldownMs,
        },
        meta: {
          statsDaysBack: resolvedStatsDaysBack,
          ttlMs: resolvedTtlMs,
          diagnostics: {
            build: {
              ...timing.snapshot(),
              usedCycleStateDirectRead,
              analysisBootstrap: summarizeAnalysisBootstrap(
                analysisSnapshot,
                analysisSnapshotError,
              ),
            },
          },
        },
      };
    } catch (error) {
      attachBootPrewarmErrorDetails(error, {
        build: timing.snapshot(),
      });
      throw error;
    }
  };

  const isFresh = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return false;
    const staleAfter = Number(candidate.staleAfterEpochMs);
    if (!Number.isFinite(staleAfter)) return false;
    return Date.now() <= staleAfter;
  };

  const ensureWarm = async ({ force = false, reason = 'manual' } = {}) => {
    const admittedCache = !force ? readAdmittedCache() : null;
    if (admittedCache) {
      return admittedCache;
    }
    if (inFlightPromise) {
      return inFlightPromise;
    }

    const buildGeneration = invalidationGeneration;
    const buildPromise = buildSnapshot({ reason })
      .then((snapshot) => {
        requireCurrentGeneration(buildGeneration);
        const cacheableSnapshot = requireCacheableSnapshot(snapshot);
        snapshotCache = cacheableSnapshot;
        return cacheableSnapshot;
      })
      .finally(() => {
        if (inFlightPromise === buildPromise) inFlightPromise = null;
      });
    inFlightPromise = buildPromise;

    return buildPromise;
  };

  const getSnapshot = ({ allowStale = false } = {}) => {
    return readAdmittedCache({ allowStale });
  };

  return {
    ensureWarm,
    getSnapshot,
    invalidate(reason = 'manual') {
      invalidationGeneration += 1;
      invalidationReason = String(reason || 'manual');
      inFlightPromise = null;
      if (!snapshotCache || typeof snapshotCache !== 'object') return;
      snapshotCache.staleAfterEpochMs = 0;
      snapshotCache.invalidatedReason = invalidationReason;
      snapshotCache.invalidatedAtEpochMs = Date.now();
    },
    async getSnapshotForDashboard({ force = false, reason = 'dashboard' } = {}) {
      const requestStartedAtMs = nowMs();
      const requestGeneration = invalidationGeneration;
      const admittedCache = !force ? readAdmittedCache() : null;
      let mode = admittedCache
        ? 'cache_hit'
        : (inFlightPromise ? 'in_flight' : 'build');
      try {
        let snapshot = admittedCache || await ensureWarm({ force, reason });
        const deliver = () => {
          requireCurrentGeneration(requestGeneration);
          return requireBootPrewarmDashboardSnapshot(
            attachDeliveryDiagnostics(snapshot, buildDeliveryDiagnostics({
              mode,
              snapshot,
              requestStartedAtMs,
              force,
              reason,
            })),
          );
        };
        try {
          return deliver();
        } catch (error) {
          const invalidCachedSnapshot = mode === 'cache_hit'
            && error?.code === 'BOOT_PREWARM_SNAPSHOT_INVALID';
          if (!invalidCachedSnapshot) throw error;
          console.warn(
            '[BootPrewarmService] Invalidated cached dashboard snapshot:',
            error.message,
          );
          snapshotCache = null;
          mode = 'build';
          snapshot = await ensureWarm({ force: true, reason: `${reason}:cache_rebuild` });
          return deliver();
        }
      } catch (error) {
        attachBootPrewarmErrorDetails(error, {
          delivery: {
            mode,
            requestDurationMs: toFixedMs(nowMs() - requestStartedAtMs),
            force: !!force,
            reason: String(reason || 'dashboard'),
          },
        });
        throw error;
      }
    },
  };
}
