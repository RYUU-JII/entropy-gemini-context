import FaviconRepository from '@/platform/storage/assets/FaviconRepository.js';
import {
    extractFaviconColorMixFromDataUrl,
    hashColorMix,
    resolveKoiAppearanceVisualProfile,
} from '../../model/koi/koiFaviconColorProfile.js';
import {
    KOI_APPEARANCE_RESOLVER_VERSION,
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
} from './appearanceStore.js';

const FAVICON_REFRESH_RETRY_MS = 60_000;
const FAVICON_REFRESH_ATTEMPT_RETENTION_MS = FAVICON_REFRESH_RETRY_MS * 10;
const MAX_FAVICON_REFRESH_ATTEMPT_ENTRIES = 512;

const faviconRefreshInflightMap = new Map();
const faviconRefreshAttemptedAtMap = new Map();
let appearanceRefreshGeneration = 0;

const faviconRepository = FaviconRepository.getInstance();

const pruneFaviconRefreshAttemptedAtMap = (now = Date.now()) => {
    for (const [domainKey, attemptedAt] of faviconRefreshAttemptedAtMap.entries()) {
        const safeAttemptedAt = Number(attemptedAt);
        if (
            !Number.isFinite(safeAttemptedAt)
            || safeAttemptedAt <= 0
            || (now - safeAttemptedAt) > FAVICON_REFRESH_ATTEMPT_RETENTION_MS
        ) {
            faviconRefreshAttemptedAtMap.delete(domainKey);
        }
    }
    if (faviconRefreshAttemptedAtMap.size <= MAX_FAVICON_REFRESH_ATTEMPT_ENTRIES) {
        return;
    }
    const entries = Array.from(faviconRefreshAttemptedAtMap.entries())
        .sort((left, right) => (Number(left[1]) || 0) - (Number(right[1]) || 0));
    const overflowCount = faviconRefreshAttemptedAtMap.size - MAX_FAVICON_REFRESH_ATTEMPT_ENTRIES;
    for (let index = 0; index < overflowCount; index += 1) {
        const entry = entries[index];
        if (!entry) continue;
        faviconRefreshAttemptedAtMap.delete(entry[0]);
    }
};

const shouldAttemptFaviconRefresh = (domainKey, profile) => {
    if (!domainKey) return false;
    const hasColorMix = Array.isArray(profile?.colorMix) && profile.colorMix.length >= 2;
    const resolverVersion = String(profile?.resolverVersion || '');
    const hasColorMixHash = typeof profile?.colorMixHash === 'string' && profile.colorMixHash.trim().length > 0;
    if (hasColorMix && resolverVersion === KOI_APPEARANCE_RESOLVER_VERSION && hasColorMixHash) {
        return false;
    }
    const now = Date.now();
    pruneFaviconRefreshAttemptedAtMap(now);
    const lastAttempt = Number(faviconRefreshAttemptedAtMap.get(domainKey) || 0);
    return (now - lastAttempt) >= FAVICON_REFRESH_RETRY_MS;
};

const refreshZenKoiAppearanceFromFavicon = async (domainKey) => {
    if (!domainKey) return null;
    if (faviconRefreshInflightMap.has(domainKey)) {
        return faviconRefreshInflightMap.get(domainKey);
    }
    const refreshGeneration = appearanceRefreshGeneration;

    const task = (async () => {
        const attemptAt = Date.now();
        faviconRefreshAttemptedAtMap.set(domainKey, attemptAt);
        pruneFaviconRefreshAttemptedAtMap(attemptAt);

        let faviconEntry = null;
        try {
            faviconEntry = await faviconRepository.getByDomain(domainKey);
        } catch (_) {
            return null;
        }
        if (refreshGeneration !== appearanceRefreshGeneration) return null;

        const dataUrl = typeof faviconEntry?.dataUrl === 'string'
            ? faviconEntry.dataUrl.trim()
            : '';
        if (!dataUrl) return null;

        let colorMix = null;
        try {
            colorMix = await extractFaviconColorMixFromDataUrl(dataUrl);
        } catch (_) {
            colorMix = null;
        }
        if (!colorMix || colorMix.length < 2) return null;
        if (refreshGeneration !== appearanceRefreshGeneration) return null;

        const faviconUpdatedAt = normalizeFaviconUpdatedAt(faviconEntry?.updatedAt);
        const currentMap = readZenKoiDomainAppearanceMap();
        const baseProfile = currentMap[domainKey] || normalizeAppearanceProfile(domainKey, null);
        const appearanceMode = normalizeAppearanceMode(baseProfile?.appearanceMode);
        const fallbackPaletteIndex = resolveProfilePaletteIndex(baseProfile, domainKey);
        const resolvedAppearance = resolveKoiAppearanceVisualProfile({
            colorMix,
            strategy: appearanceMode,
            fallbackPaletteIndex,
            variationSeed: baseProfile?.seed,
        });
        const nextBreedMatch = normalizeBreedMatch(
            resolvedAppearance?.breedMatch || baseProfile?.breedMatch,
        );
        const nextColorMixHash = typeof resolvedAppearance?.colorMixHash === 'string'
            ? resolvedAppearance.colorMixHash
            : hashColorMix(colorMix);
        const nextResolverVersion = normalizeResolverVersion(resolvedAppearance?.resolverVersion);

        const existingUpdatedAt = normalizeFaviconUpdatedAt(baseProfile?.faviconUpdatedAt);
        const sameUpdatedAt = (
            faviconUpdatedAt !== null
            && existingUpdatedAt !== null
            && faviconUpdatedAt === existingUpdatedAt
        );
        const sameColorMix = areColorMixesEqual(baseProfile?.colorMix, colorMix);
        const sameBreedMatch = areBreedMatchesEqual(baseProfile?.breedMatch, nextBreedMatch);
        const sameColorMixHash = String(baseProfile?.colorMixHash || '') === String(nextColorMixHash || '');
        const sameResolverVersion = String(baseProfile?.resolverVersion || '')
            === String(nextResolverVersion || '');
        if (sameUpdatedAt && sameColorMix && sameBreedMatch && sameColorMixHash && sameResolverVersion) {
            return baseProfile;
        }

        const nextProfile = normalizeAppearanceProfile(domainKey, {
            ...baseProfile,
            colorMix,
            appearanceMode,
            breedMatch: nextBreedMatch,
            colorMixHash: nextColorMixHash,
            resolverVersion: nextResolverVersion,
            faviconUpdatedAt,
            updatedAt: Date.now(),
        }, Number(baseProfile?.rerollCount || 0));
        if (refreshGeneration !== appearanceRefreshGeneration) return null;

        writeZenKoiDomainAppearanceMap({
            ...currentMap,
            [domainKey]: nextProfile,
        });
        return nextProfile;
    })().finally(() => {
        faviconRefreshInflightMap.delete(domainKey);
    });

    faviconRefreshInflightMap.set(domainKey, task);
    return task;
};

const resetZenKoiAppearanceRefreshService = () => {
    appearanceRefreshGeneration += 1;
    faviconRefreshInflightMap.clear();
    faviconRefreshAttemptedAtMap.clear();
    return appearanceRefreshGeneration;
};

export {
    shouldAttemptFaviconRefresh,
    refreshZenKoiAppearanceFromFavicon,
    resetZenKoiAppearanceRefreshService,
};
