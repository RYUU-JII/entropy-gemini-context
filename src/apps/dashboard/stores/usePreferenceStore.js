import { ZEN_RENDER_PRESET_STORAGE_KEY, DEFAULT_ZEN_RENDER_PRESET, requireZenRenderPreset } from '../../../domains/settings/config/zenRenderPreset.js';
import { requireCanonicalRuntimeLanguage } from '../../../domains/settings/i18n/language.js';
import { RUNTIME_LANGUAGE_STORAGE_KEY } from '../../../domains/settings/i18n/constants.js';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
    THEME_ID_MAP,
    getDefaultThemeId,
    getThemeDefinition,
    resolveThemeDefinitionId,
} from '../../../themes/core/catalog.js';
import { applyDocumentTheme } from '../../../themes/core/documentTheme.js';
import {
    assertCanonicalThemeId,
    normalizeThemeId,
} from '../../../themes/core/ids.js';
import { getThemeProfile } from '../../../themes/core/profile.js';
import {
    THEME_PREFERENCE_STORAGE_KEY,
    readStoredThemePreferenceFromSnapshot,
} from '../../../themes/core/state/themePreferenceRepository.js';
import { readThemePreferenceSettingsSnapshot } from '../../../platform/storage/settings/ThemePreferenceSettingsQueryService.js';
import {
    DEFAULT_SIDEBAR_DISPLAY_MODE,
    SIDEBAR_DISPLAY_MODE_STORAGE_KEY,
    normalizeSidebarDisplayMode,
} from '../../../domains/settings/config/sidebarDisplayMode.js';
import { resolveBootPrewarmSection } from '../bootstrap/bootPrewarmSnapshot.js';
import {
    assertPreferenceSettingsReadAdmission,
    dispatchPreferenceSettingsPatch,
    getPendingPreferenceSettingsPatch,
    getPreferenceSettingsSyncState,
} from './preferenceSettingsClient.js';

/**
 * Preference Store
 * 
 * Manages user preferences, UI states, and theme configurations.
 * Replaces useUIStore and handles all cross-cutting UI/Preference concerns.
 */

const FALLBACK_THEME_ID = getDefaultThemeId();
const INVALID_THEME_SENTINEL = '__invalid_theme__';
const PREFERENCE_SETTINGS_QUERY = Object.freeze({
    [THEME_PREFERENCE_STORAGE_KEY]: null,
    [SIDEBAR_DISPLAY_MODE_STORAGE_KEY]: DEFAULT_SIDEBAR_DISPLAY_MODE,
    [ZEN_RENDER_PRESET_STORAGE_KEY]: DEFAULT_ZEN_RENDER_PRESET,
});

let initializePromise = null;
let preferenceReconciliationPromise = null;
const preferenceReconciliationKeys = new Set();
const preferenceReadRevisions = new Map();
const preferenceReconcilingReceipts = new Set();
const preferenceReadFailures = new Map();

async function reconcilePreferenceSetting(set, result, key) {
    const receipt = { key };
    preferenceReconcilingReceipts.add(receipt);
    preferenceReadRevisions.set(key, (preferenceReadRevisions.get(key) || 0) + 1);
    try {
        await syncPreferenceSettingsFromStorage(set, [key]);
        const error = preferenceReadFailures.has(key) ? preferenceReadFailures.get(key) : null;
        if (error) {
            const reconciliationError = new Error('SETTINGS_COMMITTED_RECONCILIATION_FAILED', { cause: error });
            reconciliationError.code = 'SETTINGS_COMMITTED_RECONCILIATION_FAILED';
            reconciliationError.committed = true;
            reconciliationError.committedResult = result;
            reconciliationError.reconciliation = { status: 'failed', error };
            throw reconciliationError;
        }
    } finally {
        preferenceReconcilingReceipts.delete(receipt);
    }
}

function syncPreferenceSettingsFromStorage(set, keys) {
    keys.forEach((key) => preferenceReconciliationKeys.add(key));
    if (preferenceReconciliationPromise) return preferenceReconciliationPromise;
    preferenceReconciliationPromise = (async () => {
        const allRequestedKeys = new Set();
        do {
            const requestedKeys = [...preferenceReconciliationKeys];
            requestedKeys.forEach((key) => allRequestedKeys.add(key));
            preferenceReconciliationKeys.clear();
            const defaults = Object.fromEntries(requestedKeys.map((key) => [key, PREFERENCE_SETTINGS_QUERY[key]]));
            const revisions = new Map(requestedKeys.map((key) => [key, preferenceReadRevisions.get(key) || 0]));
            try {
                const snapshot = await readThemePreferenceSettingsSnapshot(defaults);
                assertPreferenceSettingsReadAdmission();
                const currentKeys = requestedKeys.filter((key) => (
                    (preferenceReadRevisions.get(key) || 0) === revisions.get(key)
                ));
                const patch = {};
                if (currentKeys.includes(THEME_PREFERENCE_STORAGE_KEY)) {
                    patch.themeId = readStoredThemePreferenceFromSnapshot(snapshot, FALLBACK_THEME_ID);
                }
                if (currentKeys.includes(ZEN_RENDER_PRESET_STORAGE_KEY)) {
                    patch.zenRenderPreset = requireZenRenderPreset(snapshot[ZEN_RENDER_PRESET_STORAGE_KEY]);
                }
                if (currentKeys.includes(SIDEBAR_DISPLAY_MODE_STORAGE_KEY)) {
                    patch.sidebarDisplayMode = normalizeSidebarDisplayMode(snapshot[SIDEBAR_DISPLAY_MODE_STORAGE_KEY]);
                }
                if (Object.hasOwn(patch, 'themeId')) patch.themeId = applyTheme(patch.themeId);
                if (Object.keys(patch).length > 0) set(patch);
                currentKeys.forEach((key) => preferenceReadFailures.delete(key));
            } catch (error) {
                requestedKeys.forEach((key) => preferenceReadFailures.set(key, error));
            }
        } while (preferenceReconciliationKeys.size > 0);
        const errors = [...preferenceReadFailures.entries()].filter(([key]) => allRequestedKeys.has(key));
        const error = errors.length > 0 ? errors.at(-1)[1] : null;
        set({
            reconcileError: preferenceReadFailures.size > 0 ? [...preferenceReadFailures.values()].at(-1) : null,
            reconcileErrorKeys: [...preferenceReadFailures.keys()],
        });
        return error;
    })().finally(() => {
        preferenceReconciliationPromise = null;
        if (preferenceReconciliationKeys.size > 0) {
            return syncPreferenceSettingsFromStorage(set, [...preferenceReconciliationKeys]);
        }
    });
    return preferenceReconciliationPromise;
}

const resolveThemeId = (themeId) => {
    return resolveThemeDefinitionId(themeId, FALLBACK_THEME_ID);
};

const selectThemeState = (themeId) => {
    const resolvedThemeId = resolveThemeId(themeId);
    const themeObject = getThemeDefinition(resolvedThemeId);
    const themeProfile = getThemeProfile(resolvedThemeId);
    return {
        themeId: resolvedThemeId,
        themeObject,
        themeProfile,
    };
};

const applyTheme = (themeId) => {
    const resolvedThemeId = applyDocumentTheme(resolveThemeId(themeId));

    if (typeof window !== 'undefined') {
        window.theme = getThemeDefinition(resolvedThemeId);
    }

    return resolvedThemeId;
};

function isPreferenceSettingAcknowledged(key, committedValue, desiredValue) {
    const pending = getPendingPreferenceSettingsPatch();
    return !preferenceReadFailures.has(key) && committedValue === desiredValue
        && !Object.hasOwn(pending, key)
        && ![...preferenceReconcilingReceipts].some((receipt) => receipt.key === key)
        && !getPreferenceSettingsSyncState().dirtyKeys.includes(key);
}

const readStoredPreferenceSettings = async () => {
    const snapshot = await readThemePreferenceSettingsSnapshot(PREFERENCE_SETTINGS_QUERY);
    return {
        themeId: readStoredThemePreferenceFromSnapshot(snapshot, FALLBACK_THEME_ID),
        zenRenderPreset: requireZenRenderPreset(snapshot[ZEN_RENDER_PRESET_STORAGE_KEY]),
        sidebarDisplayMode: normalizeSidebarDisplayMode(snapshot?.[SIDEBAR_DISPLAY_MODE_STORAGE_KEY]),
    };
};

export const usePreferenceStore = create((set, get) => {
    return ({
    // --- State ---
    themeId: FALLBACK_THEME_ID,
    sidebarDisplayMode: DEFAULT_SIDEBAR_DISPLAY_MODE,
    zenRenderPreset: DEFAULT_ZEN_RENDER_PRESET,
    loaded: false,
    loadError: null,
    reconcileError: null,
    reconcileErrorKeys: [],
    /**
     * Initialize preferences from the persisted settings snapshot.
     */
    initialize: async (bootContext = null) => {
        if (get().loaded) return get().themeId;
        if (initializePromise) return initializePromise;

        initializePromise = (async () => {
            const prewarm = resolveBootPrewarmSection(bootContext, 'preference');
            const hasPrewarmTheme = typeof prewarm?.themeId === 'string' && prewarm.themeId.trim();
            if (hasPrewarmTheme) {
                const prewarmThemeId = resolveThemeId(prewarm.themeId);
                const prewarmSidebarDisplayMode = normalizeSidebarDisplayMode(prewarm.sidebarDisplayMode);
                try {
                    const appliedThemeId = applyTheme(prewarmThemeId);
                    set({
                        themeId: appliedThemeId,
                        sidebarDisplayMode: prewarmSidebarDisplayMode,
                        zenRenderPreset: requireZenRenderPreset(prewarm.zenRenderPreset),
                        loaded: true,
                        loadError: null,
                    });
                    return appliedThemeId;
                } catch (error) {
                    set({
                        loaded: false,
                        loadError: error,
                    });
                    throw error;
                }
            }

            try {
                const preferenceSettings = await readStoredPreferenceSettings();
                const appliedThemeId = applyTheme(preferenceSettings.themeId);
                set({
                    themeId: appliedThemeId,
                    sidebarDisplayMode: preferenceSettings.sidebarDisplayMode,
                    zenRenderPreset: preferenceSettings.zenRenderPreset,
                    loaded: true,
                    loadError: null,
                });
                return appliedThemeId;
            } catch (error) {
                console.error('[PreferenceStore] Failed to initialize preferences:', error);
                set({
                    loaded: false,
                    loadError: error,
                });
                throw error;
            }
        })()
            .finally(() => {
                initializePromise = null;
            });

        return initializePromise;
    },

    /**
     * Update current theme
     */
    setTheme: async (newThemeId) => {
        const normalizedThemeId = normalizeThemeId(newThemeId, INVALID_THEME_SENTINEL);
        if (normalizedThemeId === INVALID_THEME_SENTINEL) {
            assertCanonicalThemeId(newThemeId, 'dashboard theme preference input');
        }

        const resolvedThemeId = normalizedThemeId;
        if (isPreferenceSettingAcknowledged(THEME_PREFERENCE_STORAGE_KEY, get().themeId, resolvedThemeId)) {
            try {
                const appliedThemeId = applyTheme(resolvedThemeId);
                set({
                    themeId: appliedThemeId,
                    loaded: true,
                    loadError: null,
                });
                return appliedThemeId;
            } catch (error) {
                set({
                    loaded: false,
                    loadError: error,
                });
                throw error;
            }
        }

        try {
            const result = await dispatchPreferenceSettingsPatch(
                { [THEME_PREFERENCE_STORAGE_KEY]: resolvedThemeId },
                [THEME_PREFERENCE_STORAGE_KEY],
            );
            assertCanonicalThemeId(
                result.patch[THEME_PREFERENCE_STORAGE_KEY],
                'dashboard theme preference commit acknowledgement',
            );
            await reconcilePreferenceSetting(set, result, THEME_PREFERENCE_STORAGE_KEY);
            try {
                set({
                    loaded: true,
                    loadError: null,
                });
                return get().themeId;
            } catch (error) {
                set({
                    loaded: false,
                    loadError: error,
                });
                throw error;
            }
        } catch (error) {
            throw error;
        }
    },

    setZenRenderPreset: async (value) => {
        const preset = requireZenRenderPreset(value);
        if (isPreferenceSettingAcknowledged(ZEN_RENDER_PRESET_STORAGE_KEY, get().zenRenderPreset, preset)) return preset;
        const result = await dispatchPreferenceSettingsPatch(
            { [ZEN_RENDER_PRESET_STORAGE_KEY]: preset }, [ZEN_RENDER_PRESET_STORAGE_KEY],
        );
        requireZenRenderPreset(result.patch[ZEN_RENDER_PRESET_STORAGE_KEY]);
        await reconcilePreferenceSetting(set, result, ZEN_RENDER_PRESET_STORAGE_KEY);
        return get().zenRenderPreset;
    },

    setLanguage: async (value) => {
        const language = requireCanonicalRuntimeLanguage(value);
        const result = await dispatchPreferenceSettingsPatch(
            { [RUNTIME_LANGUAGE_STORAGE_KEY]: language },
            [RUNTIME_LANGUAGE_STORAGE_KEY],
        );
        return requireCanonicalRuntimeLanguage(result.patch[RUNTIME_LANGUAGE_STORAGE_KEY]);
    },

    setSidebarDisplayMode: async (nextMode) => {
        const normalizedMode = normalizeSidebarDisplayMode(nextMode);
        if (isPreferenceSettingAcknowledged(SIDEBAR_DISPLAY_MODE_STORAGE_KEY, get().sidebarDisplayMode, normalizedMode)) return normalizedMode;

        try {
            const result = await dispatchPreferenceSettingsPatch(
                { [SIDEBAR_DISPLAY_MODE_STORAGE_KEY]: normalizedMode },
                [SIDEBAR_DISPLAY_MODE_STORAGE_KEY],
            );
            normalizeSidebarDisplayMode(
                result.patch[SIDEBAR_DISPLAY_MODE_STORAGE_KEY],
            );
            await reconcilePreferenceSetting(set, result, SIDEBAR_DISPLAY_MODE_STORAGE_KEY);
            return get().sidebarDisplayMode;
        } catch (error) {
            throw error;
        }
    },
    });
});

// Convenience Hooks
export function useUIPreferences() {
    const {
        themeId,
        sidebarDisplayMode,
        loaded,
        setTheme,
        setSidebarDisplayMode,
    } = usePreferenceStore(useShallow((state) => ({
        themeId: state.themeId,
        sidebarDisplayMode: state.sidebarDisplayMode,
        loaded: state.loaded,
        setTheme: state.setTheme,
        setSidebarDisplayMode: state.setSidebarDisplayMode,
    })));
    const themeState = selectThemeState(themeId);

    return {
        ...themeState,
        theme: themeState.themeObject,
        themes: THEME_ID_MAP,
        sidebarDisplayMode: normalizeSidebarDisplayMode(sidebarDisplayMode),
        loaded,
        setTheme,
        setSidebarDisplayMode,
    };
}

export function useActiveTheme() {
    return usePreferenceStore(useShallow((state) => ({
        ...selectThemeState(state.themeId),
        setTheme: state.setTheme,
    })));
}

export function useThemeId() {
    return usePreferenceStore((state) => resolveThemeId(state.themeId));
}

export function useThemeObject() {
    return usePreferenceStore((state) => selectThemeState(state.themeId).themeObject);
}

export function useThemeProfile() {
    return usePreferenceStore((state) => selectThemeState(state.themeId).themeProfile);
}

export function useTheme() {
    const activeTheme = useActiveTheme();
    return {
        theme: activeTheme.themeObject,
        themeId: activeTheme.themeId,
        themeProfile: activeTheme.themeProfile,
        setTheme: activeTheme.setTheme,
    };
}

/**
 * Use this hook to access the preference store directly
 */
export const usePreference = () => usePreferenceStore();
