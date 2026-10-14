import { isPlainObject } from './localUtils.js';
import ZenModelRepository from '@/themes/plugins/zen/state/ZenModelRepository.js';
import { ZEN_THEME_MODEL_STATE_KEYS } from '@/themes/plugins/zen/state/ZenThemeModelState.js';

const KOI_ACTIVITY_PROFILE_VERSION = 1;
const KOI_ACTIVITY_QUANTILE_EPSILON = 0.0005;
const MAX_ACTIVITY_PROFILE_ENTRIES = 3000;
const ACTIVITY_PROFILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ZEN_KOI_ACTIVITY_PROFILE_MODEL_STATE_KEY = ZEN_THEME_MODEL_STATE_KEYS.KOI_ACTIVITY_PROFILE_CACHE;

let memoryActivityProfileCache = null;
let activityProfileHydrationPromise = null;
let activityProfileHydrated = false;
let activityProfilePersistInFlight = false;
let pendingActivityProfilePersist = null;
let activityProfileCacheRevision = 0;
let activityProfileStorageError = null;
const activityProfileStorageErrorSubscribers = new Set();
const getActivityProfileModelRepository = () => ZenModelRepository.getInstance();

const publishActivityProfileStorageError = (code, cause) => {
    const error = new Error(code, { cause });
    error.code = code;
    activityProfileStorageError = error;
    activityProfileStorageErrorSubscribers.forEach((listener) => listener(error));
    return error;
};

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const normalizeDomainKey = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const normalizeDayIndex = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const normalizeQuantile = (value, fallback = 0.5) => {
    return clampNumber(
        value,
        KOI_ACTIVITY_QUANTILE_EPSILON,
        1 - KOI_ACTIVITY_QUANTILE_EPSILON,
        fallback,
    );
};

const normalizeRiskSnapshot = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return clampNumber(numeric, 0, 1.2, 0);
};

const hashStringFNV1a = (value) => {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const resolveQuantileFromSeed = (domainKey, dayIndex = null, salt = 0) => {
    const seed = hashStringFNV1a(`${domainKey}|${dayIndex ?? 'none'}|${salt}`);
    const unit = (seed + 0.5) / 4294967296;
    return normalizeQuantile(unit, 0.5);
};

const normalizeActivityProfile = (domainKey, candidate = null) => {
    const source = isPlainObject(candidate) ? candidate : {};
    const boundDayIndex = normalizeDayIndex(source.boundDayIndex);
    const quantileFallback = resolveQuantileFromSeed(domainKey, boundDayIndex, source.rebindCount ?? 0);
    const quantile = normalizeQuantile(source.quantile, quantileFallback);
    const rebindCount = Math.max(0, Math.floor(Number(source.rebindCount) || 0));
    const updatedAtRaw = Number(source.updatedAt);
    const updatedAt = Number.isFinite(updatedAtRaw) ? Math.floor(updatedAtRaw) : Date.now();
    const riskSnapshot = normalizeRiskSnapshot(source.riskSnapshot);

    return Object.freeze({
        quantile,
        boundDayIndex,
        rebindCount,
        riskSnapshot,
        updatedAt,
        version: KOI_ACTIVITY_PROFILE_VERSION,
    });
};

const pruneActivityEntries = (map) => {
    const keys = Object.keys(map || {});
    if (keys.length <= MAX_ACTIVITY_PROFILE_ENTRIES) return map;
    const sorted = keys.sort((a, b) => {
        const aTime = Number(map[a]?.updatedAt || 0);
        const bTime = Number(map[b]?.updatedAt || 0);
        return bTime - aTime;
    });
    const next = {};
    for (let i = 0; i < Math.min(sorted.length, MAX_ACTIVITY_PROFILE_ENTRIES); i += 1) {
        const key = sorted[i];
        next[key] = map[key];
    }
    return next;
};

const shouldRetainActivityProfile = (profile, nowMs = Date.now()) => {
    const updatedAt = Number(profile?.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
    return (nowMs - updatedAt) <= ACTIVITY_PROFILE_RETENTION_MS;
};

const normalizeActivityProfileMap = (candidate) => {
    if (!isPlainObject(candidate)) return {};
    const normalized = {};
    const nowMs = Date.now();
    Object.entries(candidate).forEach(([rawDomain, rawProfile]) => {
        const domainKey = normalizeDomainKey(rawDomain);
        if (!domainKey) return;
        if (!isPlainObject(rawProfile) || rawProfile.version !== KOI_ACTIVITY_PROFILE_VERSION) return;
        const profile = normalizeActivityProfile(domainKey, rawProfile);
        if (!shouldRetainActivityProfile(profile, nowMs)) return;
        normalized[domainKey] = profile;
    });
    return pruneActivityEntries(normalized);
};

const commitZenKoiActivityProfileMap = (normalized) => {
    const next = normalizeActivityProfileMap(normalized);
    memoryActivityProfileCache = next;
    activityProfileCacheRevision += 1;
    return next;
};

const flushPendingActivityProfilePersist = async () => {
    if (activityProfilePersistInFlight) return;
    activityProfilePersistInFlight = true;
    try {
        while (pendingActivityProfilePersist !== null) {
            const snapshot = pendingActivityProfilePersist;
            pendingActivityProfilePersist = null;
            await getActivityProfileModelRepository().setValue(
                ZEN_KOI_ACTIVITY_PROFILE_MODEL_STATE_KEY,
                snapshot,
            );
        }
    } catch (cause) {
        if (pendingActivityProfilePersist === null) {
            pendingActivityProfilePersist = memoryActivityProfileCache;
        }
        throw publishActivityProfileStorageError(
            'ZEN_KOI_ACTIVITY_PROFILE_STORAGE_PERSIST_FAILED',
            cause,
        );
    } finally {
        activityProfilePersistInFlight = false;
    }
};

const scheduleZenKoiActivityProfilePersist = (normalized) => {
    pendingActivityProfilePersist = normalizeActivityProfileMap(normalized);
    return flushPendingActivityProfilePersist();
};

const requireHydratedZenKoiActivityProfileMap = () => {
    if (!activityProfileHydrated || memoryActivityProfileCache === null) {
        throw new Error('ZEN_KOI_ACTIVITY_PROFILE_STORAGE_NOT_HYDRATED');
    }
    return memoryActivityProfileCache;
};

const hydrateZenKoiActivityProfileMap = async () => {
    if (activityProfileHydrated) {
        return requireHydratedZenKoiActivityProfileMap();
    }
    if (activityProfileHydrationPromise) {
        return activityProfileHydrationPromise;
    }
    const hydrationRevision = activityProfileCacheRevision;
    activityProfileHydrationPromise = (async () => {
        let canonicalCandidate;
        try {
            canonicalCandidate = await getActivityProfileModelRepository().getValue(
                ZEN_KOI_ACTIVITY_PROFILE_MODEL_STATE_KEY,
            );
        } catch (cause) {
            throw publishActivityProfileStorageError(
                'ZEN_KOI_ACTIVITY_PROFILE_STORAGE_HYDRATION_FAILED',
                cause,
            );
        }
        let normalized = normalizeActivityProfileMap(canonicalCandidate);
        if (canonicalCandidate === null || canonicalCandidate === undefined) {
            normalized = {};
        }
        if (activityProfileCacheRevision !== hydrationRevision) {
            throw publishActivityProfileStorageError(
                'ZEN_KOI_ACTIVITY_PROFILE_STORAGE_HYDRATION_CONCURRENT_MUTATION',
            );
        }
        memoryActivityProfileCache = normalized;
        activityProfileHydrated = true;
        return memoryActivityProfileCache;
    })().finally(() => {
        activityProfileHydrationPromise = null;
    });
    return activityProfileHydrationPromise;
};

const readZenKoiActivityProfileMap = () => {
    return requireHydratedZenKoiActivityProfileMap();
};

const writeZenKoiActivityProfileMap = (candidate) => {
    requireHydratedZenKoiActivityProfileMap();
    const normalized = normalizeActivityProfileMap(candidate);
    void scheduleZenKoiActivityProfilePersist(normalized).catch((error) => {
        // The failure has already been published to the runtime error channel;
        // observe the promise here so the same error is not also unhandled.
        if (activityProfileStorageError !== error) {
            publishActivityProfileStorageError(
                'ZEN_KOI_ACTIVITY_PROFILE_STORAGE_PERSIST_FAILED',
                error,
            );
        }
    });
    return commitZenKoiActivityProfileMap(normalized);
};

const buildActivityProfileForBinding = (domainKey, {
    dayIndex = null,
    risk = null,
    previous = null,
} = {}) => {
    const previousRebindCount = Math.max(0, Number(previous?.rebindCount) || 0);
    const rebindCount = previous ? previousRebindCount + 1 : 0;
    const boundDayIndex = normalizeDayIndex(dayIndex);
    return normalizeActivityProfile(domainKey, {
        quantile: resolveQuantileFromSeed(domainKey, boundDayIndex, rebindCount),
        boundDayIndex,
        rebindCount,
        riskSnapshot: normalizeRiskSnapshot(risk),
        updatedAt: Date.now(),
        version: KOI_ACTIVITY_PROFILE_VERSION,
    });
};

const ensureZenKoiActivityProfile = (domain, {
    dayIndex = null,
    risk = null,
} = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const currentMap = readZenKoiActivityProfileMap();
    const current = currentMap[domainKey];
    if (current) return current;

    const created = buildActivityProfileForBinding(domainKey, {
        dayIndex,
        risk,
        previous: null,
    });
    writeZenKoiActivityProfileMap({
        ...currentMap,
        [domainKey]: created,
    });
    return created;
};

const maybeRebindZenKoiActivityProfile = (domain, {
    dayIndex = null,
    risk = null,
} = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const normalizedDayIndex = normalizeDayIndex(dayIndex);
    const currentMap = readZenKoiActivityProfileMap();
    const current = currentMap[domainKey];
    if (!current) {
        const created = buildActivityProfileForBinding(domainKey, {
            dayIndex: normalizedDayIndex,
            risk,
            previous: null,
        });
        writeZenKoiActivityProfileMap({
            ...currentMap,
            [domainKey]: created,
        });
        return created;
    }

    if (normalizedDayIndex === null || current.boundDayIndex === normalizedDayIndex) {
        return current;
    }

    const rebound = buildActivityProfileForBinding(domainKey, {
        dayIndex: normalizedDayIndex,
        risk,
        previous: current,
    });
    writeZenKoiActivityProfileMap({
        ...currentMap,
        [domainKey]: rebound,
    });
    return rebound;
};

const resetZenKoiActivityMemoryCache = () => {
    memoryActivityProfileCache = null;
    activityProfileHydrated = false;
    activityProfileStorageError = null;
};

const getZenKoiActivityProfileStorageError = () => activityProfileStorageError;

const subscribeZenKoiActivityProfileStorageErrors = (listener) => {
    if (typeof listener !== 'function') {
        throw new Error('ZEN_KOI_ACTIVITY_PROFILE_STORAGE_ERROR_LISTENER_REQUIRED');
    }
    activityProfileStorageErrorSubscribers.add(listener);
    return () => activityProfileStorageErrorSubscribers.delete(listener);
};

const clearZenKoiActivityProfileMap = async () => {
    activityProfileHydrated = true;
    const next = commitZenKoiActivityProfileMap({});
    pendingActivityProfilePersist = {};
    await flushPendingActivityProfilePersist();
    return next;
};

export {
    ACTIVITY_PROFILE_RETENTION_MS,
    ZEN_KOI_ACTIVITY_PROFILE_MODEL_STATE_KEY,
    KOI_ACTIVITY_PROFILE_VERSION,
    KOI_ACTIVITY_QUANTILE_EPSILON,
    normalizeDomainKey,
    normalizeDayIndex,
    normalizeQuantile,
    normalizeActivityProfile,
    readZenKoiActivityProfileMap,
    writeZenKoiActivityProfileMap,
    ensureZenKoiActivityProfile,
    maybeRebindZenKoiActivityProfile,
    getZenKoiActivityProfileStorageError,
    subscribeZenKoiActivityProfileStorageErrors,
    resetZenKoiActivityMemoryCache,
    clearZenKoiActivityProfileMap,
    hydrateZenKoiActivityProfileMap,
};
