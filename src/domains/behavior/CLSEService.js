/**
 * CLSEService - Cognitive Load Sensing Engine Service
 * 
 * Main entry point for the CLSE system.
 * Initializes collectors, manages the aggregation pipeline,
 * and provides an API for detection results.
 * 
 * Runs in: Background Service Worker
 */
import ClseRepository from '../../platform/storage/clse/ClseRepository.js';
import ClseRuntimeCheckpointRepository from '../../platform/storage/runtime/ClseRuntimeCheckpointRepository.js';
import { clearAllCLSEStorage, clearCLSEHistoricalData } from './clseMaintenanceStorage.js';
import {
    completeCLSEDailySummaries,
    getCLSECalendarDayStart,
    getCLSEDailySummaryCompletionBoundary,
} from './clseDailySummary.js';
import { runCLSEStorageMutationLifecycle } from './clseStorageMutationLifecycle.js';
import { CLSE_BASELINE_GRAINS } from '../../platform/storage/clse/clseBaselineStorageContract.js';
import {
    getLocalDateStr,
} from '../../lib/index.js';
import {
    CLSE_CONSTANTS,
    createBucket5min,
    createBucket60s,
} from './clseSchema.js';
import {
    CLSE_ALERT_COOLDOWN_DEFAULT_MS,
    CLSE_ALERT_COOLDOWN_KEY,
    normalizeCLSEAlertCooldown,
    normalizeCLSESensitivityScale,
    readCLSESettingsSnapshot,
} from './clseSettings.js';
import { initializeCollectors } from './collectors/index.js';
import { getBaselineManager } from './detection/BaselineManager.js';
import { LoadSpikeDetector } from './detection/LoadSpikeDetector.js';
import { SustainedLoadDetector } from './detection/SustainedLoadDetector.js';
import { LoopDetector } from './detection/LoopDetector.js';
import {
    scoreCLSEBucketAggression,
} from './detection/BehaviorAggressionScorer.js';
import {
    createCLSEDetectionPolicy,
} from './detection/clseDetectionPolicy.js';
import { RingBuffer10s } from './data/RingBuffer.js';
import { ClseCheckpointWriteScheduler } from './runtime/ClseCheckpointWriteScheduler.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationIngress,
} from './clseProfileMutationRuntimeAdmission.js';

// ============================================================
// STATE
// ============================================================

let isInitialized = false;
let initPromise = null;
let isEnabled = false;
let collectors = null;
let ringBuffer = null;
let sensitivityScale = CLSE_CONSTANTS.SENSITIVITY_SCALE_DEFAULT || 1;
let lastDailySummaryDayStart = null;

// Detectors
let baselineManager = null;
let spikeDetector = null;
let sustainedDetector = null;
let loopDetector = null;
let lastSpikeAnalyzedTs = null;
let lastRollup60sTs = null;
let lastRollup5minTs = null;
let lastPruneDayStart = null;
let lastAggressionLoggedTs = null;

export const CLSE_CHECKPOINT_MIN_WRITE_INTERVAL_MS = 5_000;
export const CLSE_CHECKPOINT_MAX_CLOSED_BUCKETS = 3;

// Event buffer for debug/UI (in-memory)
const RECENT_EVENT_LIMIT = 50;
let recentEvents = [];
let lastAlert = null;
let lastAlertAt = 0;
let clseBrowserPort = null;
let clseProfileMutationRuntimeAdmission = null;
let clseRuntimeStorageWorkTail = Promise.resolve();
let clseStorageMutationTail = Promise.resolve();
let isStorageMutationInProgress = false;
const CLSE_PROFILE_MUTATION_PHASES = Object.freeze({
    OPEN: 'open',
    QUIESCING: 'quiescing',
    QUIESCED: 'quiesced',
    QUIESCE_FAILED: 'quiesce_failed',
});
let clseProfileMutationPhase = CLSE_PROFILE_MUTATION_PHASES.OPEN;
let clseProfileMutationQuiescePromise = null;

let alertCooldownMs = CLSE_ALERT_COOLDOWN_DEFAULT_MS;

function getCurrentCLSEDetectionPolicy() {
    return createCLSEDetectionPolicy({ sensitivityScale });
}

function enqueueCLSERuntimeStorageWork(operation) {
    if (typeof operation !== 'function') {
        throw new Error('CLSE_RUNTIME_STORAGE_OPERATION_REQUIRED');
    }
    const pending = clseRuntimeStorageWorkTail.then(operation);
    clseRuntimeStorageWorkTail = pending.catch(() => undefined);
    return pending;
}

function captureCheckpoint() {
    if (!collectors?.activity || !loopDetector) {
        throw new Error('CLSE_CHECKPOINT_RUNTIME_STATE_REQUIRED');
    }
    return {
        ringBuffer: ringBuffer.serialize({
            maxClosedBuckets: CLSE_CHECKPOINT_MAX_CLOSED_BUCKETS,
        }),
        activity: collectors.activity.serialize(),
        loopDetector: loopDetector.serialize(),
        timestamps: {
            lastSpikeAnalyzedTs,
            lastRollup60sTs,
            lastRollup5minTs,
            lastPruneDayStart,
            lastAggressionLoggedTs,
        },
    };
}

const checkpointWriteScheduler = new ClseCheckpointWriteScheduler({
    capture: captureCheckpoint,
    write: (record) => ClseRuntimeCheckpointRepository.getInstance().set(record),
    minWriteIntervalMs: CLSE_CHECKPOINT_MIN_WRITE_INTERVAL_MS,
});

function commitCheckpoint({ force = false, now = Date.now() } = {}) {
    if (!isEnabled || !ringBuffer) return Promise.resolve();
    return checkpointWriteScheduler.request({ force, now });
}

async function clearCheckpoint() {
    await checkpointWriteScheduler.drain();
    await ClseRuntimeCheckpointRepository.getInstance().clear();
    checkpointWriteScheduler.resetCadence();
}

// Event listeners (for UI consumption)
const eventListeners = new Set();

const clseRepository = ClseRepository.getInstance();

function assertCLSEProfileMutationAdmissionOpen() {
    if (clseProfileMutationPhase !== CLSE_PROFILE_MUTATION_PHASES.OPEN) {
        throw new Error(
            `CLSE_PROFILE_MUTATION_ADMISSION_CLOSED:${clseProfileMutationPhase}`,
        );
    }
}

function assertCLSEProfileMutationQuiesced() {
    if (clseProfileMutationPhase !== CLSE_PROFILE_MUTATION_PHASES.QUIESCED) {
        throw new Error(
            `CLSE_TERMINAL_MUTATION_REQUIRES_QUIESCED:${clseProfileMutationPhase}`,
        );
    }
}

function resolveCLSEBrowserPort() {
    const requiredMethods = [
        'tabsQuery',
        'tabsSendMessage',
    ];
    const missingMethod = requiredMethods.find((methodName) => (
        typeof clseBrowserPort?.[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`CLSE_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
    }
    return clseBrowserPort;
}

export function configureCLSEBrowserPort(browserPort) {
    clseBrowserPort = browserPort || null;
}

export function configureCLSEProfileMutationRuntimeAdmission(runtimeAdmission) {
    clseProfileMutationRuntimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
        runtimeAdmission,
    );
}

export async function syncCLSEFromStoredSettings({ changedKeys = null } = {}) {
    assertCLSEProfileMutationAdmissionOpen();
    const relevantKeys = [
        CLSE_CONSTANTS.FEATURE_FLAG_KEY,
        CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY,
        CLSE_ALERT_COOLDOWN_KEY,
    ];
    if (Array.isArray(changedKeys) && changedKeys.length > 0) {
        const hasRelevantKey = changedKeys.some((key) => relevantKeys.includes(key));
        if (!hasRelevantKey) {
            return getCLSEStatus();
        }
    }

    const settings = await readCLSESettingsSnapshot();
    const nextEnabled = !!settings?.[CLSE_CONSTANTS.FEATURE_FLAG_KEY];
    const nextSensitivityScale = normalizeCLSESensitivityScale(
        settings?.[CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY],
    );
    const nextAlertCooldownMs = normalizeCLSEAlertCooldown(settings?.[CLSE_ALERT_COOLDOWN_KEY]);

    sensitivityScale = nextSensitivityScale;

    alertCooldownMs = nextAlertCooldownMs;
    if (spikeDetector?.setCooldown) {
        spikeDetector.setCooldown(nextAlertCooldownMs);
    }

    if (nextEnabled && !isEnabled) {
        isEnabled = true;
        await startCLSERuntimeIfInitialized();
    } else if (!nextEnabled && isEnabled) {
        isEnabled = false;
        await stopCLSERuntime();
    } else {
        isEnabled = nextEnabled;
        await startCLSERuntimeIfInitialized();
    }

    return getCLSEStatus();
}

// ============================================================
// RING BUFFER (10-second buckets in RAM)
// ============================================================

// RingBuffer10s class code moved to ./data/RingBuffer.js

// ============================================================
// INITIALIZATION
// ============================================================

async function startCLSERuntime() {
    if (collectors || isStorageMutationInProgress) return;

    if (!baselineManager) {
        baselineManager = getBaselineManager();
    }
    await baselineManager.init();
    if (isStorageMutationInProgress) return;

    ringBuffer = new RingBuffer10s();

    spikeDetector = new LoadSpikeDetector();
    spikeDetector.addListener((type, data) => emitEvent(type, data));

    sustainedDetector = new SustainedLoadDetector();
    sustainedDetector.addListener((type, data) => emitEvent(type, data));

    loopDetector = new LoopDetector();
    loopDetector.addListener((type, data) => emitEvent(type, data));

    const checkpointRepo = ClseRuntimeCheckpointRepository.getInstance();
    const optionalCheckpoint = await checkpointRepo.readOptional();
    if (optionalCheckpoint.found) {
        ringBuffer.hydrate(optionalCheckpoint.value.ringBuffer);
        loopDetector.hydrate(optionalCheckpoint.value.loopDetector);
        lastSpikeAnalyzedTs = optionalCheckpoint.value.timestamps.lastSpikeAnalyzedTs;
        lastRollup60sTs = optionalCheckpoint.value.timestamps.lastRollup60sTs;
        lastRollup5minTs = optionalCheckpoint.value.timestamps.lastRollup5minTs;
        lastPruneDayStart = optionalCheckpoint.value.timestamps.lastPruneDayStart;
        lastAggressionLoggedTs = optionalCheckpoint.value.timestamps.lastAggressionLoggedTs;
    }

    const browserPort = resolveCLSEBrowserPort();
    const result = initializeCollectors(ringBuffer, {
        browserPort,
        profileMutationRuntimeAdmission: requireCLSEProfileMutationRuntimeAdmission(
            clseProfileMutationRuntimeAdmission,
        ),
        onRuntimeMutationCommitted: () => commitCheckpoint(),
        onNavigation: (url) => {
            const pending = enqueueCLSERuntimeStorageWork(async () => {
                if (loopDetector) {
                    await loopDetector.recordVisit(url);
                }
            });
            pending.catch((error) => {
                console.error('[CLSE] Navigation persistence failed:', error);
            });
            return pending;
        },
    });
    collectors = result.collectors;
    if (optionalCheckpoint.found && optionalCheckpoint.value.activity && collectors.activity) {
        collectors.activity.hydrate(optionalCheckpoint.value.activity);
    }
    await result.startAll();

    await enqueueCLSERuntimeStorageWork(() => handleHeartbeat());
}

async function stopCLSERuntime() {
    const activeCollectors = collectors;
    try {
        if (activeCollectors) {
            await Promise.all(Object.values(activeCollectors).map((collector) => (
                Promise.resolve(collector.stop?.())
            )));
        }

        await clseRuntimeStorageWorkTail;
        await clearCheckpoint();
    } finally {
        collectors = null;
        lastSpikeAnalyzedTs = null;
        lastRollup60sTs = null;
        lastRollup5minTs = null;
        lastPruneDayStart = null;
        lastAggressionLoggedTs = null;
        loopDetector = null;
        spikeDetector = null;
        sustainedDetector = null;
        ringBuffer = null;
    }
}

async function invalidateFailedCLSERuntimeStart() {
    isInitialized = false;
    initPromise = null;
    if (collectors || ringBuffer || spikeDetector || sustainedDetector || loopDetector) {
        try {
            await stopCLSERuntime();
        } catch (cleanupError) {
            console.error('[CLSE] Failed-start cleanup failed:', cleanupError);
        }
    }
    baselineManager = null;
}

async function startCLSERuntimeIfInitialized() {
    if (!isEnabled || !isInitialized || collectors || isStorageMutationInProgress) return;
    try {
        await startCLSERuntime();
    } catch (error) {
        await invalidateFailedCLSERuntimeStart();
        throw error;
    }
}

/**
 * Initialize the CLSE system
 * @returns {Promise<boolean>} - Whether initialization succeeded
 */
export async function initCLSE() {
    assertCLSEProfileMutationAdmissionOpen();
    if (initPromise) return initPromise;

    const pendingInit = (async () => {
        await syncCLSEFromStoredSettings();

        if (!isEnabled) {
            console.debug('[CLSE] Feature disabled, skipping initialization');
            isInitialized = true;
            return false;
        }

        await startCLSERuntime();

        isInitialized = true;
        console.debug('[CLSE] Initialization complete (with detectors)');
        return true;
    })();
    initPromise = pendingInit;

    try {
        return await pendingInit;
    } catch (err) {
        console.error('[CLSE] Initialization failed:', err);
        if (initPromise === pendingInit) await invalidateFailedCLSERuntimeStart();
        throw err;
    }
}

// ============================================================
// HEARTBEAT & AGGREGATION PIPELINE
// ============================================================

export function runCLSEHeartbeat(now = Date.now()) {
    if (!isEnabled) return Promise.resolve();
    return runCLSEProfileMutationIngress(
        clseProfileMutationRuntimeAdmission,
        {
            label: 'clse_heartbeat_alarm',
            task: () => enqueueCLSERuntimeStorageWork(() => handleHeartbeat(now)),
        },
    );
}

async function handleHeartbeat(now = Date.now()) {
    if (!isEnabled || !ringBuffer) return;
    if (collectors?.activity) {
        await collectors.activity.settle(now, { commitCheckpoint: false });
    }
    if (loopDetector) {
        loopDetector.prune(now);
    }
    await analyzeSpikeBuckets(now);
    await maybeRollup60s(now);
    await maybeRollup5min(now);
    await maybeWriteCompletedDailySummary(now);
    await maybePrune(now);
    if (baselineManager) {
        await baselineManager.flush();
    }
    await commitCheckpoint({ force: true, now });
}

async function analyzeSpikeBuckets(now) {
    if (!ringBuffer || !spikeDetector) return;
    const buckets = ringBuffer.getRecentBuckets(CLSE_CONSTANTS.RING_BUFFER_SIZE);
    if (!buckets.length) return;

    const cutoffTs = now - CLSE_CONSTANTS.BUCKET_10S_MS;
    for (const bucket of buckets) {
        if (!bucket || typeof bucket.ts_start !== 'number') continue;
        if (bucket.ts_start > cutoffTs) continue;
        if (lastSpikeAnalyzedTs !== null && bucket.ts_start <= lastSpikeAnalyzedTs) continue;
        const aggressionScores = scoreCLSEBucketAggression(
            bucket,
            baselineManager,
            getCurrentCLSEDetectionPolicy(),
        );
        await logAggressionDiagnostics(bucket, aggressionScores);
        spikeDetector.analyze(bucket, aggressionScores);
        baselineManager.observeCompletedBucket(
            CLSE_BASELINE_GRAINS.BUCKET_10S,
            bucket,
        );
        lastSpikeAnalyzedTs = bucket.ts_start;
    }
}

async function logAggressionDiagnostics(bucket, aggressionScores) {
    if (!bucket) return;
    if (lastAggressionLoggedTs !== null && bucket.ts_start <= lastAggressionLoggedTs) return;

    const scores = Object.entries(aggressionScores).map(([type, data]) => ({ type, data }));

    const entries = scores
        .filter((entry) => entry.data.gate.pass)
        .map((entry, index) => ({
            ts: bucket.ts_start + index,
            bucket_ts: bucket.ts_start,
            type: entry.type,
            score: entry.data.score,
            aggressive_score: entry.data.aggressiveScore,
            meaningless_score: entry.data.meaninglessScore,
            metrics: entry.data.metrics,
            z_scores: entry.data.zScores,
            gate: entry.data.gate,
            reference_mode: entry.data.referenceMode,
            baseline_status: entry.data.baselineStatus,
            baseline_grain: entry.data.baselineGrain,
            baseline_reset_epoch: entry.data.baselineResetEpoch,
        }));

    if (!entries.length) {
        lastAggressionLoggedTs = bucket.ts_start;
        return;
    }

    try {
        await Promise.all(entries.map((entry) => clseRepository.addAggressionLog(entry)));
    } catch (err) {
        console.warn('[CLSE] Aggression log failed:', err);
    } finally {
        lastAggressionLoggedTs = bucket.ts_start;
    }
}

async function maybeRollup60s(now) {
    const tsStart = Math.floor(now / CLSE_CONSTANTS.BUCKET_60S_MS) * CLSE_CONSTANTS.BUCKET_60S_MS
        - CLSE_CONSTANTS.BUCKET_60S_MS;
    if (lastRollup60sTs === tsStart) return;
    try {
        await rollup60s(tsStart);
        lastRollup60sTs = tsStart;
    } catch (err) {
        console.error('[CLSE] 60s rollup error:', err);
        throw err;
    }
}

async function maybeRollup5min(now) {
    const endTs = Math.floor(now / CLSE_CONSTANTS.BUCKET_60S_MS) * CLSE_CONSTANTS.BUCKET_60S_MS;
    const startTs = endTs - CLSE_CONSTANTS.BUCKET_5MIN_MS;
    if (lastRollup5minTs === startTs) return;
    if (startTs < 0) return;
    try {
        await rollup5min(endTs);
        lastRollup5minTs = startTs;
    } catch (err) {
        console.error('[CLSE] 5min rollup error:', err);
        throw err;
    }
}

async function maybePrune(now) {
    const dayStart = getCLSECalendarDayStart(now);
    if (lastPruneDayStart === dayStart) return;
    lastPruneDayStart = dayStart;
    try {
        await clseRepository.pruneTiers({
            buckets60sBefore: now - (CLSE_CONSTANTS.RETENTION_60S_DAYS * 24 * 60 * 60 * 1000),
            buckets5minBefore: now - (CLSE_CONSTANTS.RETENTION_5MIN_DAYS * 24 * 60 * 60 * 1000),
            loopEventsBefore: now - (CLSE_CONSTANTS.RETENTION_DAYS * 24 * 60 * 60 * 1000),
            aggressionLogsBefore: now - (CLSE_CONSTANTS.RETENTION_DAYS * 24 * 60 * 60 * 1000),
            dailySummariesBefore: getLocalDateStr(
                now - (CLSE_CONSTANTS.RETENTION_DAILY_SUMMARY_DAYS * 24 * 60 * 60 * 1000)
            ),
        });
    } catch (err) {
        console.warn('[CLSE] Prune failed:', err);
    }
}

/**
 * Rollup 10-second buckets into a 60-second bucket
 */
async function rollup60s(tsStartOverride) {
    if (!ringBuffer) return;

    const now = Date.now();
    const tsStart = Number.isFinite(tsStartOverride)
        ? tsStartOverride
        : Math.floor(now / CLSE_CONSTANTS.BUCKET_60S_MS) * CLSE_CONSTANTS.BUCKET_60S_MS - CLSE_CONSTANTS.BUCKET_60S_MS;
    const tsEnd = tsStart + CLSE_CONSTANTS.BUCKET_60S_MS;

    const buckets = ringBuffer.getRecentBuckets(12)
        .filter((b) => b && typeof b.ts_start === 'number' && b.ts_start >= tsStart && b.ts_start < tsEnd);
    if (buckets.length < 6) return;

    // Aggregate
    const bucket60s = createBucket60s(tsStart);

    let tabOpenSum = 0;
    let velocityN = 0;
    let velocityMean = 0;
    let velocityM2 = 0;

    for (const b of buckets) {
        bucket60s.active_ms += b.active_ms || 0;
        bucket60s.idle_ms += b.idle_ms || 0;
        bucket60s.tab_switch_count += b.tab_switch_count || 0;
        tabOpenSum += b.tab_open_count || 0;
        bucket60s.visibility_change_count += b.visibility_change_count || 0;
        bucket60s.nav_count += b.nav_count || 0;
        bucket60s.back_forward_count += b.back_forward_count || 0;
        bucket60s.same_site_jump_count += b.same_site_jump_count || 0;
        bucket60s.cross_site_jump_count += b.cross_site_jump_count || 0;
        bucket60s.scroll_event_count += b.scroll_event_count || 0;
        bucket60s.scroll_abs_delta_sum += b.scroll_abs_delta_sum || 0;
        bucket60s.scroll_dir_change_count += b.scroll_dir_change_count || 0;
        bucket60s.content_add_count += b.content_add_count || 0;
        bucket60s.feed_item_add_count += b.feed_item_add_count || 0;
        bucket60s.short_dwell_count += b.short_dwell_count || 0;
        bucket60s.media_seek_count += b.media_seek_count || 0;
        bucket60s.media_rate_change_count += b.media_rate_change_count || 0;
        bucket60s.media_pause_play_count += b.media_pause_play_count || 0;

        // Peak tracking
        if ((b.tab_switch_count || 0) > bucket60s.peak_10s_tab_switch) {
            bucket60s.peak_10s_tab_switch = b.tab_switch_count || 0;
        }
        if ((b.nav_count || 0) > bucket60s.peak_10s_nav) {
            bucket60s.peak_10s_nav = b.nav_count || 0;
        }
        if ((b.scroll_abs_delta_sum || 0) > bucket60s.peak_10s_scroll_abs_delta) {
            bucket60s.peak_10s_scroll_abs_delta = b.scroll_abs_delta_sum || 0;
        }

        // Merge Welford stats (parallel algorithm)
        if (b.scroll_n > 0) {
            const n1 = velocityN;
            const n2 = b.scroll_n;
            const mean1 = velocityMean;
            const mean2 = b.scroll_velocity_mean;
            const m2_1 = velocityM2;
            const m2_2 = b.scroll_velocity_var;

            const n = n1 + n2;
            const delta = mean2 - mean1;
            const newMean = mean1 + delta * n2 / n;
            const newM2 = m2_1 + m2_2 + delta * delta * n1 * n2 / n;

            velocityN = n;
            velocityMean = newMean;
            velocityM2 = newM2;
        }
    }

    bucket60s.tab_open_count_avg = buckets.length > 0 ? tabOpenSum / buckets.length : 0;
    bucket60s.scroll_velocity_mean = velocityMean;
    bucket60s.scroll_velocity_var = velocityN > 1 ? velocityM2 / (velocityN - 1) : 0;

    // Save to IndexedDB
    await clseRepository.addBucket60s(bucket60s);
    console.debug('[CLSE] Saved 60s bucket:', bucket60s.ts_start);

    // Run sustained load detection
    if (sustainedDetector) {
        sustainedDetector.analyze(
            bucket60s,
            getCurrentCLSEDetectionPolicy(),
        );
    }
    baselineManager.observeCompletedBucket(
        CLSE_BASELINE_GRAINS.BUCKET_60S,
        bucket60s,
    );
}

/**
 * Rollup 60-second buckets into a 5-minute bucket
 */
async function rollup5min(endTsOverride) {
    const now = Date.now();
    const endTs = Number.isFinite(endTsOverride)
        ? endTsOverride
        : Math.floor(now / CLSE_CONSTANTS.BUCKET_60S_MS) * CLSE_CONSTANTS.BUCKET_60S_MS;
    const startTs = endTs - CLSE_CONSTANTS.BUCKET_5MIN_MS;

    const buckets60s = await clseRepository.getBuckets60s({ startTs, endTs });
    if (buckets60s.length === 0) return;

    const bucket5min = createBucket5min(startTs);

    let totalActiveMs = 0;
    let tabSwitchSum = 0;
    let navSum = 0;
    let scrollVolatilitySum = 0;
    let seekSum = 0;

    for (const b of buckets60s) {
        const active = b.active_ms || 0;
        totalActiveMs += active;
        bucket5min.idle_ms += b.idle_ms || 0;

        tabSwitchSum += b.tab_switch_count || 0;
        navSum += b.nav_count || 0;
        scrollVolatilitySum += Math.sqrt(b.scroll_velocity_var || 0);
        seekSum += b.media_seek_count || 0;
    }

    bucket5min.active_ms = totalActiveMs;

    // Calculate rates (per second of active time)
    const activeSeconds = totalActiveMs / 1000;
    if (activeSeconds > 0) {
        bucket5min.tab_switch_rate_mean = tabSwitchSum / activeSeconds;
        bucket5min.nav_rate_mean = navSum / activeSeconds;
        bucket5min.scroll_volatility_mean = scrollVolatilitySum / buckets60s.length;
        bucket5min.seek_rate_mean = seekSum / activeSeconds;
    }

    // Count loop events in this window
    const loopEvents = await clseRepository.getLoopEvents({ startTs, endTs });
    bucket5min.loop_detected_count = loopEvents.length;

    // Save to IndexedDB
    await clseRepository.addBucket5min(bucket5min);
    console.debug('[CLSE] Saved 5min bucket:', bucket5min.ts_start);

}

// ============================================================
// API
// ============================================================

async function maybeWriteCompletedDailySummary(ts) {
    const completedBefore = getCLSEDailySummaryCompletionBoundary(ts);
    if (lastDailySummaryDayStart === completedBefore) return;
    lastDailySummaryDayStart = await completeCLSEDailySummaries({
        repository: clseRepository,
        now: ts,
    });
}

const CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS = Object.freeze({
    RESUME: 'resume',
    TERMINATE: 'terminate',
});

/** Serialized suspend owner shared by baseline replacement and profile mutation. */
function runSerializedCLSEStorageMutation(mutationTask, {
    runtimeDisposition = CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.RESUME,
} = {}) {
    if (typeof mutationTask !== 'function') {
        throw new Error('CLSE_STORAGE_MUTATION_TASK_REQUIRED');
    }
    if (!Object.values(CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS).includes(runtimeDisposition)) {
        throw new Error('CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITION_INVALID');
    }
    const pending = clseStorageMutationTail.then(async () => {
        isStorageMutationInProgress = true;
        const quiesce = async () => {
            const pendingInitialization = initPromise;
            if (pendingInitialization) {
                try {
                    await pendingInitialization;
                } catch (error) {
                    console.warn('[CLSE] Storage mutation supersedes failed initialization:', error);
                }
            }
            const managerToFlush = baselineManager;
            const shouldFlushBaseline = isInitialized && managerToFlush !== null;
            isInitialized = false;
            initPromise = null;
            await stopCLSERuntime();
            if (shouldFlushBaseline) await managerToFlush.flush();
            await clseRepository.flushBaselineEpochWrites();
            baselineManager = null;
            lastDailySummaryDayStart = null;
            recentEvents = [];
            lastAlert = null;
            lastAlertAt = 0;
        };
        if (runtimeDisposition === CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.TERMINATE) {
            await quiesce();
            try {
                return await mutationTask();
            } finally {
                // A terminal profile mutation may create a short-lived manager
                // to rewrite the durable baseline. It must not become live
                // state in the retiring worker.
                baselineManager = null;
                isInitialized = false;
                initPromise = null;
            }
        }
        return runCLSEStorageMutationLifecycle({
            mutationTask,
            quiesce,
            reloadBaseline: async () => {
                if (!baselineManager) baselineManager = getBaselineManager();
                await baselineManager.reloadFromStorage();
            },
            resume: async () => {
                isStorageMutationInProgress = false;
                isInitialized = false;
                initPromise = null;
                await initCLSE();
            },
        });
    }).catch((error) => {
        const recoveryError = error?.code === 'CLSE_STORAGE_MUTATION_BASELINE_RELOAD_FAILED'
            ? error
            : error?.clseStorageRecoveryError;
        if (recoveryError?.code === 'CLSE_STORAGE_MUTATION_BASELINE_RELOAD_FAILED') {
            isInitialized = false;
            initPromise = null;
            baselineManager = null;
        }
        throw error;
    }).finally(() => {
        isStorageMutationInProgress = false;
    });
    clseStorageMutationTail = pending.catch(() => undefined);
    return pending;
}

async function runCLSEBaselineResetMutation({
    clearHistorical = false,
    runtimeDisposition = CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.RESUME,
} = {}) {
    return runSerializedCLSEStorageMutation(async () => {
        if (!baselineManager) baselineManager = getBaselineManager();
        await baselineManager.reset();
        if (!clearHistorical) return null;
        return clearCLSEHistoricalData({ repository: clseRepository });
    }, {
        runtimeDisposition,
    });
}

function runSerializedQuiescedCLSETerminalMutation(mutationTask) {
    assertCLSEProfileMutationQuiesced();
    if (typeof mutationTask !== 'function') {
        throw new Error('CLSE_STORAGE_MUTATION_TASK_REQUIRED');
    }
    const pending = clseStorageMutationTail.then(async () => {
        isStorageMutationInProgress = true;
        let result;
        let primaryError = null;
        try {
            await clseRuntimeStorageWorkTail;
            result = await mutationTask();
        } catch (error) {
            primaryError = error instanceof Error ? error : new Error(String(error));
        }

        let flushError = null;
        try {
            await clseRepository.flushBaselineEpochWrites();
        } catch (error) {
            flushError = error instanceof Error ? error : new Error(String(error));
        } finally {
            baselineManager = null;
            isInitialized = false;
            initPromise = null;
            isStorageMutationInProgress = false;
        }

        if (primaryError) {
            if (flushError) primaryError.clseTerminalFlushError = flushError;
            throw primaryError;
        }
        if (flushError) throw flushError;
        return result;
    });
    clseStorageMutationTail = pending.catch(() => undefined);
    return pending;
}

export function quiesceCLSEForProfileMutation() {
    if (clseProfileMutationPhase === CLSE_PROFILE_MUTATION_PHASES.QUIESCING) {
        return clseProfileMutationQuiescePromise;
    }
    if (clseProfileMutationPhase === CLSE_PROFILE_MUTATION_PHASES.QUIESCED) {
        return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (
        clseProfileMutationPhase !== CLSE_PROFILE_MUTATION_PHASES.OPEN
        && clseProfileMutationPhase !== CLSE_PROFILE_MUTATION_PHASES.QUIESCE_FAILED
    ) {
        return Promise.reject(new Error(
            `CLSE_PROFILE_MUTATION_PHASE_INVALID:${clseProfileMutationPhase}`,
        ));
    }

    clseProfileMutationPhase = CLSE_PROFILE_MUTATION_PHASES.QUIESCING;
    clseProfileMutationQuiescePromise = runSerializedCLSEStorageMutation(
        async () => undefined,
        { runtimeDisposition: CLSE_STORAGE_MUTATION_RUNTIME_DISPOSITIONS.TERMINATE },
    ).then(() => {
        clseProfileMutationPhase = CLSE_PROFILE_MUTATION_PHASES.QUIESCED;
        return Object.freeze({ quiesced: true, reused: false });
    }).catch((cause) => {
        clseProfileMutationPhase = CLSE_PROFILE_MUTATION_PHASES.QUIESCE_FAILED;
        const error = new Error('CLSE_PROFILE_MUTATION_QUIESCE_FAILED');
        error.code = 'CLSE_PROFILE_MUTATION_QUIESCE_FAILED';
        error.cause = cause;
        throw error;
    });
    return clseProfileMutationQuiescePromise;
}

/** Explicit user-requested reset; replaces invalid stored state without decoding it. */
export async function resetCLSEBaseline() {
    assertCLSEProfileMutationAdmissionOpen();
    await clearCheckpoint();
    await runCLSEBaselineResetMutation();
    console.debug('[CLSE] Baseline reset');
}

/**
 * Full app-reset owner for an active CLSE runtime. One suspended mutation
 * clears every CLSE store without decoding discarded rows. The enclosing profile
 * mutation terminates this runtime, so collectors remain quiesced until reload.
 */
export async function resetCLSEData() {
    const result = await runSerializedQuiescedCLSETerminalMutation(async () => {
        await clearCheckpoint();
        return clearAllCLSEStorage({ repository: clseRepository });
    });
    console.debug('[CLSE] Baseline and historical data reset:', result);
    return result;
}

/**
 * Snapshot-import lifecycle owner for an active CLSE build. Collection stops
 * before the repository import lane opens, all admitted writes and the learned
 * baseline is flushed, and the old collector graph remains quiesced.
 */
export function runCLSEStorageSnapshotImport(importTask) {
    return runSerializedQuiescedCLSETerminalMutation(importTask);
}

/**
 * Delete all CLSE data (logs only, baseline preserved unless explicitly reset)
 */
export async function deleteCLSEData() {
    const result = await clearCLSEHistoricalData({ repository: clseRepository });
    console.debug('[CLSE] Data deleted:', result);
    return result;
}

/**
 * Record a short dwell event (tab bounce) into the 10s bucket
 */
export function recordCLSEShortDwell(count = 1) {
    assertCLSEProfileMutationAdmissionOpen();
    if (!isEnabled || !ringBuffer) return;
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) return;
    ringBuffer.add('short_dwell_count', n);
}

// ============================================================
// EVENT SYSTEM
// ============================================================

/**
 * Emit an event to all listeners
 * @param {string} type - Event type
 * @param {Object} data - Event data
 */
function emitEvent(type, data) {
    const event = { type, data, ts: Date.now() };
    recentEvents.push(event);
    if (recentEvents.length > RECENT_EVENT_LIMIT) {
        recentEvents = recentEvents.slice(-RECENT_EVENT_LIMIT);
    }

    maybeTriggerAlert(event);

    console.debug('[CLSE] Event:', type, data);

    for (const listener of eventListeners) {
        try {
            listener(event);
        } catch (err) {
            console.warn('[CLSE] Event listener error:', err);
        }
    }
}

function maybeTriggerAlert(event) {
    if (!event) return;
    const now = Date.now();
    if (now - lastAlertAt < alertCooldownMs) return;

    const type = event.type || '';
    const severity = Number(event?.data?.severity);
    const resolvedSeverity = Number.isFinite(severity) ? severity : 0.5;

    const shouldAlert = [
        'COMPOSITE_SPIKE',
        'SUSTAINED_LOAD_START',
        'SUSTAINED_LOAD_ESCALATION',
        'PAGE_LOOP_DETECTED',
        'SITE_LOOP_DETECTED',
        'TAB_SPIKE',
        'NAV_SPIKE',
        'SCROLL_SPIKE',
    ].includes(type);

    if (!shouldAlert) return;

    lastAlertAt = now;
    lastAlert = {
        type,
        severity: Math.min(1, Math.max(0, resolvedSeverity)),
        ts: now,
        data: event.data || null,
    };
    void broadcastCLSEAlert(lastAlert);
}

async function broadcastCLSEAlert(alert) {
    if (!alert) return;
    const browserPort = resolveCLSEBrowserPort();
    try {
        const tabs = await browserPort.tabsQuery({ active: true, lastFocusedWindow: true });
        if (!tabs || tabs.length === 0) return;
        await Promise.all(
            tabs.map((tab) =>
                tab?.id
                    ? browserPort.tabsSendMessage(tab.id, { type: 'CLSE_ALERT', payload: alert }).catch(() => { })
                    : null
            )
        );
    } catch (_) {
        // ignore
    }
}

export function getCLSERecentEvents() {
    return recentEvents.slice();
}

export function getCLSEAlertState() {
    return lastAlert;
}

/**
 * Subscribe to CLSE events
 * @param {Function} listener - (event) => void
 * @returns {Function} - Unsubscribe function
 */
export function addEventListener(listener) {
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
}

/**
 * Record a navigation for loop detection
 * Call this from NavCollector or external code when a page is visited
 * @param {string} url - Full URL of the visited page
 */
export async function recordNavigation(url) {
    if (!isEnabled || !loopDetector) return null;
    return loopDetector.recordVisit(url);
}

/**
 * Get current CLSE status (extended)
 */
export function getCLSEStatus() {
    const baselineSnapshot = baselineManager?.getStatusSummary?.() || null;
    return {
        isInitialized,
        isEnabled,
        bucketCount: ringBuffer?.getBucketCount() || 0,
        sustainedLoadState: sustainedDetector?.getState() || null,
        loopStats: loopDetector?.getStats() || null,
        sensitivityScale,
        alertCooldownMs,
        alert: lastAlert || null,
        baseline: baselineSnapshot,
    };
}
