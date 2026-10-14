import {
    PALETTES,
    pickElegantPaletteIndexByRatio,
} from '../../model/koi/constants.js';
import ZenModelRepository from '@/themes/plugins/zen/state/ZenModelRepository.js';
import { ZEN_THEME_MODEL_STATE_KEYS } from '@/themes/plugins/zen/state/ZenThemeModelState.js';
import {
    normalizeColorMix,
    hashColorMix,
    KOI_APPEARANCE_RESOLVER_VERSION,
    DEFAULT_KOI_COLOR_STRATEGY,
    normalizeKoiColorStrategy,
} from '../../model/koi/koiFaviconColorProfile.js';
import { isPlainObject } from './localUtils.js';

const MAX_APPEARANCE_ENTRIES = 3000;
const APPEARANCE_ENTRY_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;
const ZEN_KOI_DOMAIN_APPEARANCE_MODEL_STATE_KEY = ZEN_THEME_MODEL_STATE_KEYS.KOI_APPEARANCE_CACHE;

let memoryAppearanceCache = null;
let appearanceHydrationPromise = null;
let appearanceHydrated = false;
let appearancePersistInFlight = false;
let pendingAppearancePersist = null;
let appearanceCacheRevision = 0;
let appearanceStorageError = null;
const appearanceSubscribers = new Set();
const appearanceStorageErrorSubscribers = new Set();
const getAppearanceModelRepository = () => ZenModelRepository.getInstance();

const notifyAppearanceSubscribers = (appearances) => {
    appearanceSubscribers.forEach((listener) => {
        try {
            listener(appearances);
        } catch (_) {
        }
    });
};

const publishAppearanceStorageError = (code, cause) => {
    const error = new Error(code, { cause });
    error.code = code;
    appearanceStorageError = error;
    appearanceStorageErrorSubscribers.forEach((listener) => listener(error));
    return error;
};

const normalizeDomainKey = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const hashStringFNV1a = (value) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const randomSeed32 = () => {
    return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
};

const getElegantPaletteCount = () => {
    const pool = Array.isArray(PALETTES?.elegant) ? PALETTES.elegant : [];
    return Math.max(1, pool.length);
};

const clampPaletteIndex = (value, paletteCount = getElegantPaletteCount()) => {
    const count = Math.max(1, Math.floor(Number(paletteCount) || 1));
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(count - 1, Math.floor(numeric)));
};

const resolvePaletteIndexFromSeed = (seed, paletteCount = getElegantPaletteCount()) => {
    const count = Math.max(1, Math.floor(Number(paletteCount) || 1));
    const seed32 = Number(seed) >>> 0;
    const lcg = (Math.imul(seed32, 1664525) + 1013904223) >>> 0;
    const ratio = lcg / 4294967296;
    if (count <= 1) return 0;
    return pickElegantPaletteIndexByRatio(ratio);
};

const resolveProfilePaletteIndex = (profile, domainKey = '') => {
    const paletteCount = getElegantPaletteCount();
    const directIndex = clampPaletteIndex(profile?.paletteIndex, paletteCount);
    if (directIndex !== null) return directIndex;
    const seedValue = Number(profile?.seed);
    const fallbackSeed = Number.isFinite(seedValue)
        ? (seedValue >>> 0)
        : hashStringFNV1a(String(domainKey || 'koi'));
    return resolvePaletteIndexFromSeed(fallbackSeed, paletteCount);
};

const pickRandomPaletteIndex = (excludeIndex = null) => {
    const paletteCount = getElegantPaletteCount();
    if (paletteCount <= 1) return 0;
    return pickElegantPaletteIndexByRatio(Math.random(), { excludeIndex });
};

const normalizeFaviconUpdatedAt = (candidate) => {
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
};

const normalizeAppearanceMode = (candidate) => {
    return normalizeKoiColorStrategy(candidate || DEFAULT_KOI_COLOR_STRATEGY);
};

const normalizeBreedMatch = (candidate) => {
    if (!isPlainObject(candidate)) return null;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id) return null;
    const scoreValue = Number(candidate.score);
    const score = Number.isFinite(scoreValue)
        ? Math.max(0, Math.min(1, scoreValue))
        : 0;
    const algoVersion = typeof candidate.algoVersion === 'string' && candidate.algoVersion.trim()
        ? candidate.algoVersion.trim()
        : KOI_APPEARANCE_RESOLVER_VERSION;
    if (algoVersion !== KOI_APPEARANCE_RESOLVER_VERSION) return null;
    return Object.freeze({
        id,
        score,
        algoVersion,
    });
};

const normalizeColorMixHash = (candidate, colorMix) => {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    return hashColorMix(colorMix);
};

const normalizeResolverVersion = (candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    return KOI_APPEARANCE_RESOLVER_VERSION;
};

const normalizeAppearanceProfile = (domainKey, candidate, fallbackRerollCount = 0) => {
    const source = isPlainObject(candidate) ? candidate : {};
    const seedValue = Number(source.seed);
    const seed = Number.isFinite(seedValue) ? (seedValue >>> 0) : hashStringFNV1a(domainKey);
    const paletteIndexRaw = Number(source.paletteIndex);
    let paletteIndex = Number.isFinite(paletteIndexRaw)
        ? clampPaletteIndex(paletteIndexRaw, getElegantPaletteCount())
        : null;
    if (paletteIndex === null) {
        paletteIndex = resolvePaletteIndexFromSeed(seed, getElegantPaletteCount());
    }
    const rerollCountRaw = Number(source.rerollCount);
    const rerollCount = Number.isFinite(rerollCountRaw)
        ? Math.max(0, Math.floor(rerollCountRaw))
        : fallbackRerollCount;
    const colorMix = normalizeColorMix(source.colorMix);
    const appearanceMode = normalizeAppearanceMode(source.appearanceMode);
    const breedMatch = normalizeBreedMatch(source.breedMatch);
    const colorMixHash = normalizeColorMixHash(source.colorMixHash, colorMix);
    const resolverVersion = normalizeResolverVersion(source.resolverVersion);
    const faviconUpdatedAt = normalizeFaviconUpdatedAt(source.faviconUpdatedAt);
    const updatedAtRaw = Number(source.updatedAt);
    const updatedAt = Number.isFinite(updatedAtRaw) ? updatedAtRaw : Date.now();
    return Object.freeze({
        seed,
        paletteIndex,
        rerollCount,
        colorMix,
        appearanceMode,
        breedMatch,
        colorMixHash,
        resolverVersion,
        faviconUpdatedAt,
        updatedAt,
    });
};

const pruneAppearanceEntries = (map) => {
    const keys = Object.keys(map || {});
    if (keys.length <= MAX_APPEARANCE_ENTRIES) return map;
    const sorted = keys.sort((a, b) => {
        const aTime = Number(map[a]?.updatedAt || 0);
        const bTime = Number(map[b]?.updatedAt || 0);
        return bTime - aTime;
    });
    const next = {};
    for (let i = 0; i < Math.min(sorted.length, MAX_APPEARANCE_ENTRIES); i += 1) {
        const key = sorted[i];
        next[key] = map[key];
    }
    return next;
};

const shouldRetainAppearanceProfile = (profile, nowMs = Date.now()) => {
    const updatedAt = Number(profile?.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
    return (nowMs - updatedAt) <= APPEARANCE_ENTRY_RETENTION_MS;
};

const normalizeDomainAppearanceMap = (candidate) => {
    if (!isPlainObject(candidate)) return {};
    const normalized = {};
    const nowMs = Date.now();
    Object.entries(candidate).forEach(([rawDomain, rawProfile]) => {
        const domainKey = normalizeDomainKey(rawDomain);
        if (!domainKey) return;
        if (!isPlainObject(rawProfile)
            || rawProfile.resolverVersion !== KOI_APPEARANCE_RESOLVER_VERSION) return;
        const profile = normalizeAppearanceProfile(domainKey, rawProfile);
        if (!shouldRetainAppearanceProfile(profile, nowMs)) return;
        normalized[domainKey] = profile;
    });
    return pruneAppearanceEntries(normalized);
};

const commitZenKoiDomainAppearanceMap = (normalized, { notify = true } = {}) => {
    const next = normalizeDomainAppearanceMap(normalized);
    memoryAppearanceCache = next;
    appearanceCacheRevision += 1;
    if (notify) {
        notifyAppearanceSubscribers(next);
    }
    return next;
};

const flushPendingAppearancePersist = async () => {
    if (appearancePersistInFlight) return;
    appearancePersistInFlight = true;
    try {
        while (pendingAppearancePersist !== null) {
            const snapshot = pendingAppearancePersist;
            pendingAppearancePersist = null;
            await getAppearanceModelRepository().setValue(
                ZEN_KOI_DOMAIN_APPEARANCE_MODEL_STATE_KEY,
                snapshot,
            );
        }
    } catch (cause) {
        if (pendingAppearancePersist === null) {
            pendingAppearancePersist = memoryAppearanceCache;
        }
        throw publishAppearanceStorageError(
            'ZEN_KOI_APPEARANCE_STORAGE_PERSIST_FAILED',
            cause,
        );
    } finally {
        appearancePersistInFlight = false;
    }
};

const scheduleZenKoiAppearancePersist = (normalized) => {
    pendingAppearancePersist = normalizeDomainAppearanceMap(normalized);
    return flushPendingAppearancePersist();
};

const requireHydratedZenKoiDomainAppearanceMap = () => {
    if (!appearanceHydrated || memoryAppearanceCache === null) {
        throw new Error('ZEN_KOI_APPEARANCE_STORAGE_NOT_HYDRATED');
    }
    return memoryAppearanceCache;
};

const hydrateZenKoiDomainAppearanceMap = async () => {
    if (appearanceHydrated) {
        return requireHydratedZenKoiDomainAppearanceMap();
    }
    if (appearanceHydrationPromise) {
        return appearanceHydrationPromise;
    }
    const hydrationRevision = appearanceCacheRevision;
    appearanceHydrationPromise = (async () => {
        let canonicalCandidate;
        try {
            canonicalCandidate = await getAppearanceModelRepository().getValue(
                ZEN_KOI_DOMAIN_APPEARANCE_MODEL_STATE_KEY,
            );
        } catch (cause) {
            throw publishAppearanceStorageError(
                'ZEN_KOI_APPEARANCE_STORAGE_HYDRATION_FAILED',
                cause,
            );
        }
        let normalized = normalizeDomainAppearanceMap(canonicalCandidate);
        if (canonicalCandidate === null || canonicalCandidate === undefined) {
            normalized = {};
        }
        if (appearanceCacheRevision !== hydrationRevision) {
            throw publishAppearanceStorageError(
                'ZEN_KOI_APPEARANCE_STORAGE_HYDRATION_CONCURRENT_MUTATION',
            );
        }
        const currentSignature = JSON.stringify(memoryAppearanceCache);
        const nextSignature = JSON.stringify(normalized);
        memoryAppearanceCache = normalized;
        appearanceHydrated = true;
        if (currentSignature !== nextSignature) {
            notifyAppearanceSubscribers(normalized);
        }
        return memoryAppearanceCache;
    })().finally(() => {
        appearanceHydrationPromise = null;
    });
    return appearanceHydrationPromise;
};

const readZenKoiDomainAppearanceMap = () => {
    return requireHydratedZenKoiDomainAppearanceMap();
};

const writeZenKoiDomainAppearanceMap = (candidate) => {
    requireHydratedZenKoiDomainAppearanceMap();
    const normalized = normalizeDomainAppearanceMap(candidate);
    void scheduleZenKoiAppearancePersist(normalized).catch((error) => {
        // The failure has already been published to the runtime error channel;
        // observe the promise here so the same error is not also unhandled.
        if (appearanceStorageError !== error) {
            publishAppearanceStorageError(
                'ZEN_KOI_APPEARANCE_STORAGE_PERSIST_FAILED',
                error,
            );
        }
    });
    return commitZenKoiDomainAppearanceMap(normalized);
};

const ensureZenKoiAppearanceProfileCore = (domain, {
    shouldAttemptRefresh = null,
    requestRefresh = null,
} = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const current = readZenKoiDomainAppearanceMap();
    if (current[domainKey]) {
        const canAttempt = typeof shouldAttemptRefresh === 'function'
            ? shouldAttemptRefresh(domainKey, current[domainKey])
            : false;
        if (canAttempt && typeof requestRefresh === 'function') {
            void requestRefresh(domainKey);
        }
        return current[domainKey];
    }

    const nextProfile = normalizeAppearanceProfile(domainKey, {
        seed: hashStringFNV1a(domainKey),
        paletteIndex: null,
        rerollCount: 0,
        updatedAt: Date.now(),
    });
    writeZenKoiDomainAppearanceMap({
        ...current,
        [domainKey]: nextProfile,
    });

    if (typeof requestRefresh === 'function') {
        void requestRefresh(domainKey);
    }
    return nextProfile;
};

const rerollZenKoiAppearanceWithinBreed = (domain, options = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const current = readZenKoiDomainAppearanceMap();
    const baseProfile = current[domainKey] || normalizeAppearanceProfile(domainKey, null);
    const rerollCount = Math.max(0, Number(baseProfile.rerollCount) || 0) + 1;
    const optionPaletteIndex = clampPaletteIndex(options.paletteIndex, getElegantPaletteCount());
    const paletteIndex = optionPaletteIndex !== null
        ? optionPaletteIndex
        : resolveProfilePaletteIndex(baseProfile, domainKey);
    const seed = (randomSeed32() ^ hashStringFNV1a(`${domainKey}|${rerollCount}`)) >>> 0;
    const nextProfile = normalizeAppearanceProfile(domainKey, {
        seed,
        paletteIndex,
        rerollCount,
        colorMix: baseProfile?.colorMix,
        appearanceMode: baseProfile?.appearanceMode,
        breedMatch: baseProfile?.breedMatch,
        colorMixHash: baseProfile?.colorMixHash,
        resolverVersion: baseProfile?.resolverVersion,
        faviconUpdatedAt: baseProfile?.faviconUpdatedAt,
        updatedAt: Date.now(),
    }, rerollCount);

    writeZenKoiDomainAppearanceMap({
        ...current,
        [domainKey]: nextProfile,
    });
    return nextProfile;
};

const rerollZenKoiAppearanceBreed = (domain, options = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const current = readZenKoiDomainAppearanceMap();
    const baseProfile = current[domainKey] || normalizeAppearanceProfile(domainKey, null);
    const rerollCount = Math.max(0, Number(baseProfile.rerollCount) || 0) + 1;
    const currentPaletteIndex = clampPaletteIndex(options.currentPaletteIndex, getElegantPaletteCount());
    const paletteIndex = pickRandomPaletteIndex(
        currentPaletteIndex !== null
            ? currentPaletteIndex
            : resolveProfilePaletteIndex(baseProfile, domainKey),
    );
    const seed = (randomSeed32() ^ hashStringFNV1a(`${domainKey}|breed|${rerollCount}`)) >>> 0;
    const nextProfile = normalizeAppearanceProfile(domainKey, {
        seed,
        paletteIndex,
        rerollCount,
        colorMix: baseProfile?.colorMix,
        appearanceMode: baseProfile?.appearanceMode,
        breedMatch: baseProfile?.breedMatch,
        colorMixHash: baseProfile?.colorMixHash,
        resolverVersion: baseProfile?.resolverVersion,
        faviconUpdatedAt: baseProfile?.faviconUpdatedAt,
        updatedAt: Date.now(),
    }, rerollCount);

    writeZenKoiDomainAppearanceMap({
        ...current,
        [domainKey]: nextProfile,
    });
    return nextProfile;
};

const rerollZenKoiAppearanceFullCore = (domain, options = {}) => {
    const domainKey = normalizeDomainKey(domain);
    if (!domainKey) return null;

    const current = readZenKoiDomainAppearanceMap();
    const baseProfile = current[domainKey] || normalizeAppearanceProfile(domainKey, null);
    const rerollCount = Math.max(0, Number(baseProfile.rerollCount) || 0) + 1;
    const currentPaletteIndex = clampPaletteIndex(options.currentPaletteIndex, getElegantPaletteCount());
    const paletteIndex = pickRandomPaletteIndex(
        currentPaletteIndex !== null
            ? currentPaletteIndex
            : resolveProfilePaletteIndex(baseProfile, domainKey),
    );
    const seed = (randomSeed32() ^ hashStringFNV1a(`${domainKey}|full|${rerollCount}`)) >>> 0;
    const preserveColorMix = options.preserveColorMix !== false;
    const preserveAppearanceMode = options.preserveAppearanceMode !== false;
    const resetBreedMatch = options.resetBreedMatch !== false;
    const nextProfile = normalizeAppearanceProfile(domainKey, {
        seed,
        paletteIndex,
        rerollCount,
        colorMix: preserveColorMix ? baseProfile?.colorMix : null,
        appearanceMode: preserveAppearanceMode ? baseProfile?.appearanceMode : DEFAULT_KOI_COLOR_STRATEGY,
        breedMatch: resetBreedMatch ? null : baseProfile?.breedMatch,
        colorMixHash: preserveColorMix ? baseProfile?.colorMixHash : null,
        resolverVersion: KOI_APPEARANCE_RESOLVER_VERSION,
        faviconUpdatedAt: preserveColorMix ? baseProfile?.faviconUpdatedAt : null,
        updatedAt: Date.now(),
    }, rerollCount);

    writeZenKoiDomainAppearanceMap({
        ...current,
        [domainKey]: nextProfile,
    });
    return nextProfile;
};

const subscribeZenKoiAppearanceChanges = (listener) => {
    if (typeof listener !== 'function') return () => {};
    appearanceSubscribers.add(listener);
    return () => {
        appearanceSubscribers.delete(listener);
    };
};

const getZenKoiAppearanceStorageError = () => appearanceStorageError;

const subscribeZenKoiAppearanceStorageErrors = (listener) => {
    if (typeof listener !== 'function') {
        throw new Error('ZEN_KOI_APPEARANCE_STORAGE_ERROR_LISTENER_REQUIRED');
    }
    appearanceStorageErrorSubscribers.add(listener);
    return () => appearanceStorageErrorSubscribers.delete(listener);
};

const areColorMixesEqual = (a, b) => {
    const left = normalizeColorMix(a);
    const right = normalizeColorMix(b);
    if (!left && !right) return true;
    if (!left || !right) return false;
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
        if (left[index].hex !== right[index].hex) return false;
        if (Math.abs(Number(left[index].weight) - Number(right[index].weight)) > 1e-6) {
            return false;
        }
    }
    return true;
};

const areBreedMatchesEqual = (a, b) => {
    const left = normalizeBreedMatch(a);
    const right = normalizeBreedMatch(b);
    if (!left && !right) return true;
    if (!left || !right) return false;
    if (left.id !== right.id) return false;
    if (left.algoVersion !== right.algoVersion) return false;
    return Math.abs(Number(left.score) - Number(right.score)) <= 1e-6;
};

const resetZenKoiAppearanceMemoryCache = () => {
    memoryAppearanceCache = null;
    appearanceHydrated = false;
    appearanceStorageError = null;
};

const clearZenKoiDomainAppearanceMap = async () => {
    appearanceHydrated = true;
    const next = commitZenKoiDomainAppearanceMap({});
    pendingAppearancePersist = {};
    await flushPendingAppearancePersist();
    return next;
};

export {
    APPEARANCE_ENTRY_RETENTION_MS,
    ZEN_KOI_DOMAIN_APPEARANCE_MODEL_STATE_KEY,
    DEFAULT_KOI_COLOR_STRATEGY,
    KOI_APPEARANCE_RESOLVER_VERSION,
    normalizeDomainKey,
    hashStringFNV1a,
    normalizeFaviconUpdatedAt,
    normalizeAppearanceMode,
    normalizeBreedMatch,
    normalizeResolverVersion,
    normalizeAppearanceProfile,
    resolveProfilePaletteIndex,
    areColorMixesEqual,
    areBreedMatchesEqual,
    readZenKoiDomainAppearanceMap,
    writeZenKoiDomainAppearanceMap,
    ensureZenKoiAppearanceProfileCore,
    rerollZenKoiAppearanceWithinBreed,
    rerollZenKoiAppearanceBreed,
    rerollZenKoiAppearanceFullCore,
    subscribeZenKoiAppearanceChanges,
    getZenKoiAppearanceStorageError,
    subscribeZenKoiAppearanceStorageErrors,
    resetZenKoiAppearanceMemoryCache,
    clearZenKoiDomainAppearanceMap,
    hydrateZenKoiDomainAppearanceMap,
};
