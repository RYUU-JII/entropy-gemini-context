import {
    ZEN_POND_TUNING_STORAGE_KEY,
    readZenPondTuning,
    writeZenPondTuning,
} from './zenPondStorage/tuningStore.js';
import {
    readZenKoiDomainAppearanceMap,
    writeZenKoiDomainAppearanceMap,
    clearZenKoiDomainAppearanceMap,
    hydrateZenKoiDomainAppearanceMap,
    normalizeDomainKey,
    ensureZenKoiAppearanceProfileCore,
    rerollZenKoiAppearanceWithinBreed,
    rerollZenKoiAppearanceBreed,
    rerollZenKoiAppearanceFullCore,
    subscribeZenKoiAppearanceChanges,
    getZenKoiAppearanceStorageError,
    subscribeZenKoiAppearanceStorageErrors,
    resetZenKoiAppearanceMemoryCache,
} from './zenPondStorage/appearanceStore.js';
import {
    readZenKoiActivityProfileMap,
    writeZenKoiActivityProfileMap,
    clearZenKoiActivityProfileMap,
    hydrateZenKoiActivityProfileMap,
    ensureZenKoiActivityProfile,
    maybeRebindZenKoiActivityProfile,
    getZenKoiActivityProfileStorageError,
    subscribeZenKoiActivityProfileStorageErrors,
    resetZenKoiActivityMemoryCache,
} from './zenPondStorage/activityProfileStore.js';
import {
    shouldAttemptFaviconRefresh,
    refreshZenKoiAppearanceFromFavicon,
    resetZenKoiAppearanceRefreshService,
} from './zenPondStorage/faviconRefreshService.js';
import { clearRosterMemory } from './repositories/zenRosterRepository.js';

const ensureZenKoiAppearanceProfile = (domain) => {
    return ensureZenKoiAppearanceProfileCore(domain, {
        shouldAttemptRefresh: shouldAttemptFaviconRefresh,
        requestRefresh: refreshZenKoiAppearanceFromFavicon,
    });
};

const rerollZenKoiAppearanceFull = (domain, options = {}) => {
    const profile = rerollZenKoiAppearanceFullCore(domain, options);
    const preserveColorMix = options.preserveColorMix !== false;
    const domainKey = normalizeDomainKey(domain);
    if (profile && !preserveColorMix && domainKey) {
        void refreshZenKoiAppearanceFromFavicon(domainKey);
    }
    return profile;
};

const hardResetZenPondState = async () => {
    const refreshGeneration = resetZenKoiAppearanceRefreshService();
    await Promise.all([
        clearZenKoiDomainAppearanceMap(),
        clearZenKoiActivityProfileMap(),
        clearRosterMemory(),
    ]);
    resetZenKoiAppearanceMemoryCache();
    resetZenKoiActivityMemoryCache();
    return {
        refreshGeneration,
    };
};

export {
    ZEN_POND_TUNING_STORAGE_KEY,
    readZenPondTuning,
    writeZenPondTuning,
    readZenKoiDomainAppearanceMap,
    writeZenKoiDomainAppearanceMap,
    clearZenKoiDomainAppearanceMap,
    hydrateZenKoiDomainAppearanceMap,
    readZenKoiActivityProfileMap,
    writeZenKoiActivityProfileMap,
    clearZenKoiActivityProfileMap,
    hydrateZenKoiActivityProfileMap,
    ensureZenKoiAppearanceProfile,
    ensureZenKoiActivityProfile,
    maybeRebindZenKoiActivityProfile,
    rerollZenKoiAppearanceWithinBreed,
    rerollZenKoiAppearanceBreed,
    rerollZenKoiAppearanceFull,
    subscribeZenKoiAppearanceChanges,
    getZenKoiAppearanceStorageError,
    subscribeZenKoiAppearanceStorageErrors,
    getZenKoiActivityProfileStorageError,
    subscribeZenKoiActivityProfileStorageErrors,
    hardResetZenPondState,
};
