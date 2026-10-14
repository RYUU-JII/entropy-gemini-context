/**
 * CLSE observed personal baseline owner.
 *
 * A detector may compare a completed bucket only with the profile learned from
 * the same bucket grain. The completed bucket is observed after detection, so
 * an anomalous sample cannot move the reference used to classify itself.
 */

import ClseRepository from '../../../platform/storage/clse/ClseRepository.js';
import {
    PERSONAL_BASELINE_STATUSES,
} from '../../../lib/personalBaselineContract.js';
import {
    CLSE_BASELINE_FEATURES,
    CLSE_BASELINE_GRAINS,
    createEmptyClseBaselineValue,
} from '../../../platform/storage/clse/clseBaselineStorageContract.js';
import {
    buildCLSEBaselineSummary,
} from '../clseBaselineReadContract.js';
import {
    CLSE_BASELINE_GRAIN_POLICIES,
    getCLSEBaselineFeatureSigma,
} from '../clseBaselineStatePolicy.js';
import {
    loadOrCreateCanonicalCLSEBaseline,
} from '../clseMaintenanceStorage.js';

const defaultClseRepository = ClseRepository.getInstance();

const HUBER_CLIP_SIGMA = 3;
const ROBUST_WARMUP_SAMPLES = 5;
const STABLE_LEARNING_RATE = 0.08;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function requireGrain(grain) {
    const policy = CLSE_BASELINE_GRAIN_POLICIES[grain];
    if (!policy) throw new Error(`CLSE_BASELINE_GRAIN_INVALID:${String(grain)}`);
    return policy;
}

function requireFeature(feature) {
    if (!CLSE_BASELINE_FEATURES.includes(feature)) {
        throw new Error(`CLSE_BASELINE_FEATURE_INVALID:${String(feature)}`);
    }
    return feature;
}

function requireNonNegativeNumber(value, field) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new Error(`CLSE_BASELINE_BUCKET_FIELD_INVALID:${field}`);
    }
    return value;
}

function requireBucketTimestamp(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error('CLSE_BASELINE_BUCKET_TIMESTAMP_INVALID');
    }
    return value;
}

function isInvalidStoredBaselineError(error) {
    return error?.message === 'CLSE_STORE_BASELINE_CONTRACT_INVALID';
}

function toLocalDateKey(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function get10sScrollVolatility(bucket) {
    const sampleCount = requireNonNegativeNumber(bucket.scroll_n, 'scroll_n');
    if (!Number.isSafeInteger(sampleCount)) {
        throw new Error('CLSE_BASELINE_BUCKET_FIELD_INVALID:scroll_n');
    }
    const m2 = requireNonNegativeNumber(bucket.scroll_velocity_var, 'scroll_velocity_var');
    if (sampleCount > 1) return Math.sqrt(m2 / (sampleCount - 1));
    return m2 > 0 ? Math.sqrt(m2) : 0;
}

function get60sScrollVolatility(bucket) {
    return Math.sqrt(requireNonNegativeNumber(
        bucket.scroll_velocity_var,
        'scroll_velocity_var',
    ));
}

/**
 * Build the only observation vector accepted by CLSE baseline learning and
 * comparisons. Ineligible exposure is explicit and never converted into a
 * zero-valued observation.
 */
export function buildCLSEBaselineObservation(grain, bucket) {
    const policy = requireGrain(grain);
    if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
        throw new Error('CLSE_BASELINE_BUCKET_INVALID');
    }
    const timestamp = requireBucketTimestamp(bucket.ts_start);
    if (bucket.duration_ms !== policy.durationMs) {
        throw new Error(`CLSE_BASELINE_BUCKET_DURATION_INVALID:${grain}`);
    }
    const activeMs = requireNonNegativeNumber(bucket.active_ms, 'active_ms');
    if (activeMs > policy.durationMs) {
        throw new Error(`CLSE_BASELINE_BUCKET_EXPOSURE_INVALID:${grain}`);
    }
    if (activeMs < policy.minimumActiveMs) {
        return {
            grain,
            timestamp,
            activeMs,
            eligible: false,
            values: null,
        };
    }

    const activeSeconds = activeMs / 1000;
    const tabSwitchCount = requireNonNegativeNumber(bucket.tab_switch_count, 'tab_switch_count');
    const navCount = requireNonNegativeNumber(bucket.nav_count, 'nav_count');
    const seekCount = requireNonNegativeNumber(bucket.media_seek_count, 'media_seek_count');
    const scrollVolatility = grain === CLSE_BASELINE_GRAINS.BUCKET_10S
        ? get10sScrollVolatility(bucket)
        : get60sScrollVolatility(bucket);

    return {
        grain,
        timestamp,
        activeMs,
        eligible: true,
        values: {
            tab_switch_rate: tabSwitchCount / activeSeconds,
            nav_rate: navCount / activeSeconds,
            scroll_volatility: scrollVolatility,
            seek_rate: seekCount / activeSeconds,
        },
    };
}

function cloneFeatureStats(featureStats) {
    return Object.fromEntries(CLSE_BASELINE_FEATURES.map((feature) => [
        feature,
        { ...featureStats[feature] },
    ]));
}

function cloneProfile(profile) {
    return {
        ...profile,
        feature_stats: cloneFeatureStats(profile.feature_stats),
    };
}

function cloneBaseline(baseline) {
    return {
        ...baseline,
        profiles: baseline.profiles.map(cloneProfile),
    };
}

function getProfile(baseline, grain) {
    const profile = baseline.profiles.find((entry) => entry.grain === grain);
    if (!profile) throw new Error(`CLSE_BASELINE_PROFILE_MISSING:${grain}`);
    return profile;
}

function getFeatureStandardDeviation(feature, stats) {
    return getCLSEBaselineFeatureSigma(feature, stats.variance);
}

function updateFeatureStats(feature, stats, value) {
    const sampleCount = stats.sample_count;
    if (sampleCount === 0) {
        return { sample_count: 1, mean: value, variance: 0 };
    }

    const residual = value - stats.mean;
    const boundedResidual = sampleCount < ROBUST_WARMUP_SAMPLES
        ? residual
        : clamp(
            residual,
            -HUBER_CLIP_SIGMA * getFeatureStandardDeviation(feature, stats),
            HUBER_CLIP_SIGMA * getFeatureStandardDeviation(feature, stats),
        );
    const alpha = sampleCount < ROBUST_WARMUP_SAMPLES
        ? 1 / (sampleCount + 1)
        : STABLE_LEARNING_RATE;
    const mean = stats.mean + (alpha * boundedResidual);
    const variance = (1 - alpha) * (
        stats.variance + (alpha * boundedResidual * boundedResidual)
    );

    return {
        sample_count: sampleCount + 1,
        mean,
        variance: Math.max(0, variance),
    };
}

export class BaselineManager {
    constructor({
        repository = defaultClseRepository,
        now = () => Date.now(),
    } = {}) {
        this.repository = repository;
        this.now = now;
        this.baseline = null;
        this._initPromise = null;
        this._lastInitializationError = null;
        this._dirty = false;
        this._revision = 0;
        this._persistenceMutationTail = Promise.resolve();
    }

    async init() {
        if (this.baseline) return this.getStatusSummary();
        if (!this._initPromise) {
            this._initPromise = (async () => {
                this.baseline = await loadOrCreateCanonicalCLSEBaseline({
                    repository: this.repository,
                    now: this.now(),
                });
            })();
        }
        const pendingInit = this._initPromise;
        try {
            await pendingInit;
            this._lastInitializationError = null;
        } catch (error) {
            this._lastInitializationError = error;
            throw error;
        } finally {
            if (this._initPromise === pendingInit) this._initPromise = null;
        }
        return this.getStatusSummary();
    }

    _requireInitialized() {
        if (!this.baseline) throw new Error('CLSE_BASELINE_NOT_INITIALIZED');
        return this.baseline;
    }

    getStatusSummary() {
        const baseline = this._requireInitialized();
        return buildCLSEBaselineSummary(baseline, { evaluatedAt: this.now() });
    }

    isBaselineStable(grain) {
        requireGrain(grain);
        const profile = this.getStatusSummary().profiles.find((entry) => (
            entry.grain === grain
        ));
        return profile.status === PERSONAL_BASELINE_STATUSES.STABLE;
    }

    getZScore(grain, feature, value) {
        requireGrain(grain);
        requireFeature(feature);
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            throw new Error(`CLSE_BASELINE_COMPARISON_VALUE_INVALID:${feature}`);
        }
        const profile = getProfile(this._requireInitialized(), grain);
        const stats = profile.feature_stats[feature];
        if (stats.sample_count < 2) {
            throw new Error(`CLSE_BASELINE_PROFILE_NOT_READY:${grain}:${feature}`);
        }
        return (value - stats.mean) / getFeatureStandardDeviation(feature, stats);
    }

    observeCompletedBucket(grain, bucket) {
        const policy = requireGrain(grain);
        const observation = buildCLSEBaselineObservation(grain, bucket);
        const evaluatedAt = this.now();
        if (!Number.isSafeInteger(evaluatedAt) || evaluatedAt < 0) {
            throw new Error('CLSE_BASELINE_EVALUATED_AT_INVALID');
        }
        const completedAt = observation.timestamp + policy.durationMs;
        if (!Number.isSafeInteger(completedAt) || completedAt > evaluatedAt) {
            throw new Error(`CLSE_BASELINE_BUCKET_NOT_COMPLETED:${grain}`);
        }
        if (!observation.eligible) {
            return { accepted: false, reason: 'insufficient_exposure' };
        }

        const baseline = this._requireInitialized();
        const profile = getProfile(baseline, grain);
        if (observation.timestamp < baseline.reset_epoch) {
            return { accepted: false, reason: 'before_reset_epoch' };
        }
        if (
            profile.last_observed_at !== null
            && observation.timestamp <= profile.last_observed_at
        ) {
            return { accepted: false, reason: 'not_newer' };
        }

        CLSE_BASELINE_FEATURES.forEach((feature) => {
            profile.feature_stats[feature] = updateFeatureStats(
                feature,
                profile.feature_stats[feature],
                observation.values[feature],
            );
        });

        const observedDate = toLocalDateKey(observation.timestamp);
        if (profile.last_observed_date !== observedDate) {
            profile.observed_days += 1;
            profile.last_observed_date = observedDate;
        }
        profile.eligible_observations += 1;
        profile.total_active_ms += observation.activeMs;
        profile.first_observed_at ??= observation.timestamp;
        profile.last_observed_at = observation.timestamp;
        baseline.updated_at = Math.max(baseline.created_at, evaluatedAt);

        this._dirty = true;
        this._revision += 1;
        return { accepted: true, reason: null };
    }

    _enqueuePersistenceMutation(operation) {
        const pending = this._persistenceMutationTail.then(operation);
        this._persistenceMutationTail = pending.catch(() => undefined);
        return pending;
    }

    flush() {
        return this._enqueuePersistenceMutation(async () => {
            const baseline = this._requireInitialized();
            if (!this._dirty) return false;
            const revision = this._revision;
            await this.repository.setBaseline(cloneBaseline(baseline));
            if (revision === this._revision) this._dirty = false;
            return true;
        });
    }

    reloadFromStorage() {
        return this._enqueuePersistenceMutation(async () => {
            const pendingInit = this._initPromise;
            if (pendingInit) {
                try {
                    await pendingInit;
                } catch (error) {
                    // An explicit completed import replaces the old baseline;
                    // its invalid pre-import value cannot block the fresh read.
                    this._lastInitializationError = error;
                }
            }

            // Invalidate before the canonical read. If that read fails, the
            // singleton manager must not retain the pre-import baseline and a
            // later init() must re-enter storage instead of passing its fast path.
            this.baseline = null;
            this._initPromise = null;
            this._lastInitializationError = null;
            this._dirty = false;
            this._revision += 1;

            let reloaded;
            try {
                reloaded = await loadOrCreateCanonicalCLSEBaseline({
                    repository: this.repository,
                    now: this.now(),
                });
            } catch (error) {
                this._lastInitializationError = error;
                throw error;
            }
            this.baseline = reloaded;
            this._lastInitializationError = null;
            return this.getStatusSummary();
        });
    }

    reset() {
        return this._enqueuePersistenceMutation(async () => {
            const pendingInit = this._initPromise;
            let initializationError = this._lastInitializationError;
            if (pendingInit) {
                try {
                    await pendingInit;
                    initializationError = null;
                } catch (error) {
                    initializationError = error;
                }
            }

            if (!this.baseline && !isInvalidStoredBaselineError(initializationError)) {
                try {
                    await this.init();
                } catch (error) {
                    if (!isInvalidStoredBaselineError(error)) throw error;
                }
            }

            await this.repository.init();
            const currentResetEpoch = this.baseline?.reset_epoch ?? null;
            if (currentResetEpoch === Number.MAX_SAFE_INTEGER) {
                throw new Error('CLSE_BASELINE_RESET_EPOCH_EXHAUSTED');
            }
            const resetEpoch = currentResetEpoch === null
                ? this.now()
                : Math.max(this.now(), currentResetEpoch + 1);
            const replacement = createEmptyClseBaselineValue({ now: resetEpoch });
            await this.repository.resetBaseline(replacement, {
                expectedResetEpoch: currentResetEpoch,
            });
            this.baseline = replacement;
            this._initPromise = null;
            this._lastInitializationError = null;
            this._dirty = false;
            this._revision += 1;
            return this.getStatusSummary();
        });
    }
}

let instance = null;

export function getBaselineManager() {
    if (!instance) instance = new BaselineManager();
    return instance;
}
