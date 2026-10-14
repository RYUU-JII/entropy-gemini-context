import { create } from 'zustand';
import {
    readAppearanceMap,
    writeAppearanceMap,
    ensureAppearanceProfile,
    rerollAppearanceWithinBreed,
    rerollAppearanceBreed,
    rerollAppearanceFull,
    subscribeAppearanceChanges,
} from '../../storage/repositories/zenAppearanceRepository.js';

let appearanceStoreUnsubscribe = null;
let appearanceStoreSubscriberCount = 0;

const useZenAppearanceStore = create((set) => ({
    // Hydration is explicitly activated by a non-isolated pond surface. Store
    // construction must stay side-effect free so First Vision never opens model
    // state merely because the scanner module was imported.
    domainAppearanceMap: {},
    revision: 0,

    refreshFromPersistence: () => {
        const next = readAppearanceMap();
        set((state) => ({
            domainAppearanceMap: next,
            revision: state.revision + 1,
        }));
        return next;
    },

    writeDomainAppearanceMap: (candidate) => {
        return writeAppearanceMap(candidate);
    },

    ensureDomainProfile: (domain) => {
        const profile = ensureAppearanceProfile(domain);
        return profile;
    },

    rerollWithinBreed: (domain, options = {}) => {
        return rerollAppearanceWithinBreed(domain, options);
    },

    rerollBreed: (domain, options = {}) => {
        return rerollAppearanceBreed(domain, options);
    },

    rerollFull: (domain, options = {}) => {
        return rerollAppearanceFull(domain, options);
    },

    bindPersistenceEvents: () => {
        appearanceStoreSubscriberCount += 1;
        if (!appearanceStoreUnsubscribe) {
            appearanceStoreUnsubscribe = subscribeAppearanceChanges((nextAppearances) => {
                set((state) => ({
                    domainAppearanceMap: nextAppearances,
                    revision: state.revision + 1,
                }));
            });
        }
        return () => {
            appearanceStoreSubscriberCount = Math.max(0, appearanceStoreSubscriberCount - 1);
            if (appearanceStoreSubscriberCount === 0 && appearanceStoreUnsubscribe) {
                appearanceStoreUnsubscribe();
                appearanceStoreUnsubscribe = null;
            }
        };
    },
}));

export {
    useZenAppearanceStore,
};
