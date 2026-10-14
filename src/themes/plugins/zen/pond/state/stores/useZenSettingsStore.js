import { create } from 'zustand';
import { createDefaultSignalTuning } from '@/themes/core/data/signalTuning.js';
import {
    mergeTuningPatchWithBaseline,
    resolveTuningSnapshot,
    TUNING_WRITE_DEBOUNCE_MS,
    TUNING_WRITE_IDLE_TIMEOUT_MS,
} from '../../storage/zenPondStorage/tuningStore.js';
import {
    readTuningSnapshot,
    writeTuningSnapshot,
    readSiteKoiColorStrategy,
    writeSiteKoiColorStrategy,
    normalizeStrategy,
} from '../../storage/repositories/zenTuningRepository.js';
import {
    readZenPondVisualProfile,
    writeZenPondVisualProfile,
} from '../../storage/repositories/zenVisualProfileRepository.js';
import {
    DEFAULT_ZEN_POND_VISUAL_PROFILE,
    patchZenPondVisualProfile,
    requireZenPondVisualProfile,
} from '../../contracts/zenPondVisualProfile.js';

const resolveInitialTuning = () => resolveTuningSnapshot(readTuningSnapshot());
const resolveInitialSiteKoiColorStrategy = () => readSiteKoiColorStrategy();
const resolveInitialVisualProfile = () => readZenPondVisualProfile();

let pendingPersistSnapshot = null;
let persistDebounceTimer = null;
let persistIdleHandle = null;

const cancelScheduledPersist = () => {
    if (persistDebounceTimer !== null) {
        clearTimeout(persistDebounceTimer);
        persistDebounceTimer = null;
    }
    if (persistIdleHandle !== null) {
        if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(persistIdleHandle);
        } else {
            clearTimeout(persistIdleHandle);
        }
        persistIdleHandle = null;
    }
};

const flushPersist = () => {
    const pending = pendingPersistSnapshot;
    if (!pending) return null;
    pendingPersistSnapshot = null;
    return writeTuningSnapshot(pending);
};

const schedulePersist = (snapshot, immediate = false) => {
    pendingPersistSnapshot = snapshot;
    cancelScheduledPersist();
    if (immediate) {
        flushPersist();
        return;
    }
    persistDebounceTimer = setTimeout(() => {
        persistDebounceTimer = null;
        const runPersist = () => {
            persistIdleHandle = null;
            flushPersist();
        };
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            persistIdleHandle = window.requestIdleCallback(runPersist, {
                timeout: TUNING_WRITE_IDLE_TIMEOUT_MS,
            });
        } else {
            persistIdleHandle = setTimeout(runPersist, 0);
        }
    }, TUNING_WRITE_DEBOUNCE_MS);
};

const resolveNextTuning = (baseline, candidate) => {
    const safeBaseline = baseline || resolveInitialTuning();
    const rawCandidate = typeof candidate === 'function'
        ? candidate(safeBaseline)
        : candidate;
    const merged = mergeTuningPatchWithBaseline(safeBaseline, rawCandidate);
    return resolveTuningSnapshot(merged, safeBaseline);
};

const useZenSettingsStore = create((set, get) => ({
    tuning: resolveInitialTuning(),
    siteKoiColorStrategy: resolveInitialSiteKoiColorStrategy(),
    visualProfile: resolveInitialVisualProfile(),

    setTuning: (candidate, { persist = true } = {}) => {
        const baseline = get().tuning;
        const snapshot = resolveNextTuning(baseline, candidate);
        if (persist) {
            schedulePersist(snapshot, false);
        }
        set({ tuning: snapshot });
        return snapshot;
    },

    replaceTuning: (candidate, { persist = true } = {}) => {
        const snapshot = resolveTuningSnapshot(candidate, get().tuning);
        if (persist) {
            schedulePersist(snapshot, false);
        }
        set({ tuning: snapshot });
        return snapshot;
    },

    resetTuning: ({ persist = true } = {}) => {
        const snapshot = resolveTuningSnapshot(createDefaultSignalTuning());
        if (persist) {
            schedulePersist(snapshot, true);
        }
        set({ tuning: snapshot });
        return snapshot;
    },

    setSiteKoiColorStrategy: (strategy, { persist = true } = {}) => {
        const normalized = normalizeStrategy(strategy);
        if (persist) {
            writeSiteKoiColorStrategy(normalized);
        }
        set({ siteKoiColorStrategy: normalized });
        return normalized;
    },

    setVisualProfile: (candidate, { persist = true } = {}) => {
        const profile = requireZenPondVisualProfile(candidate);
        if (persist) {
            writeZenPondVisualProfile(profile);
        }
        set({ visualProfile: profile });
        return profile;
    },

    patchVisualProfile: (patch, { persist = true } = {}) => {
        const profile = patchZenPondVisualProfile(get().visualProfile, patch);
        if (persist) {
            writeZenPondVisualProfile(profile);
        }
        set({ visualProfile: profile });
        return profile;
    },

    resetVisualProfile: ({ persist = true } = {}) => {
        const profile = requireZenPondVisualProfile(DEFAULT_ZEN_POND_VISUAL_PROFILE);
        if (persist) {
            writeZenPondVisualProfile(profile);
        }
        set({ visualProfile: profile });
        return profile;
    },

    hydrateSettings: ({
        tuning = null,
        siteKoiColorStrategy = null,
        visualProfile = null,
    } = {}) => {
        const next = {};
        if (tuning !== null) {
            next.tuning = resolveTuningSnapshot(tuning, get().tuning);
        }
        if (siteKoiColorStrategy !== null) {
            next.siteKoiColorStrategy = normalizeStrategy(siteKoiColorStrategy);
        }
        if (visualProfile !== null) {
            next.visualProfile = requireZenPondVisualProfile(visualProfile);
        }
        if (Object.keys(next).length > 0) {
            set(next);
        }
        return next;
    },
}));

export {
    useZenSettingsStore,
};
