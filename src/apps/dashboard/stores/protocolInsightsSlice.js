import {
    INSIGHTS_CONSENT,
    INSIGHTS_MODES,
    normalizeInsightsConsent,
    normalizeInsightsMode,
} from '../../../domains/settings/config/insightsMode.js';
import {
    DEFAULT_DATA_COLLECTION_MODE,
    DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    DEFAULT_PRECISION_INSIGHTS_MODE,
    normalizeDataCollectionMode,
    normalizePrecisionInsightsSignals,
    normalizePrecisionInsightsMode,
} from '../../../domains/settings/config/dataCollectionPolicy.js';
import {
    normalizeSolarLocationProfile,
    SOLAR_LOCATION_STORAGE_KEY,
} from '../../../domains/settings/config/solarLocation.js';
import {
    commitProtocolSettingsPatch,
    getEffectiveProtocolState,
    isProtocolSettingsIntentAcknowledged,
} from './protocolStoreCommands.js';
import {
    buildProtocolSyncResult,
} from './protocolStoreHelpers.js';

// Insights / privacy domain: insights consent + mode, precision-insights
// policy/signals, data-collection mode, permission mode, and solar location.
export function createProtocolInsightsSlice(set, get) {
    return {
        setInsightsConsent: (next) => {
            const current = getEffectiveProtocolState(get).insightsConsent;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeInsightsConsent(value, current || INSIGHTS_CONSENT.UNSET);
            if (isProtocolSettingsIntentAcknowledged(get, { insightsConsent: resolved })) return;
            return commitProtocolSettingsPatch(
                get,
                set,
                { insightsConsent: resolved },
                { pendingKeys: ['insightsConsent'] },
            );
        },

        setPrecisionInsightsPolicy: (nextPatch = {}) => {
            const patch = nextPatch && typeof nextPatch === 'object' && !Array.isArray(nextPatch)
                ? nextPatch
                : {};
            const pendingKeys = [];
            if (Object.prototype.hasOwnProperty.call(patch, 'dataCollectionMode')) {
                pendingKeys.push('dataCollectionMode');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'precisionInsightsMode')) {
                pendingKeys.push('precisionInsightsMode');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'precisionInsightsSignals')) {
                pendingKeys.push('precisionInsightsSignals');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'insightsMode')) {
                pendingKeys.push('insightsMode');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'insightsConsent')) {
                pendingKeys.push('insightsConsent');
            }
            if (pendingKeys.length === 0) return Promise.resolve(buildProtocolSyncResult());
            if (isProtocolSettingsIntentAcknowledged(get, patch)) return Promise.resolve(buildProtocolSyncResult());
            return commitProtocolSettingsPatch(get, set, patch, {
                pendingKeys: Array.from(new Set(pendingKeys)),
            });
        },

        setPrecisionInsightsSignals: (next) => {
            const current = getEffectiveProtocolState(get).precisionInsightsSignals;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizePrecisionInsightsSignals(
                value,
                current || DEFAULT_PRECISION_INSIGHTS_SIGNALS,
            );
            if (isProtocolSettingsIntentAcknowledged(get, { precisionInsightsSignals: resolved })) return;
            return commitProtocolSettingsPatch(get, set, {
                precisionInsightsSignals: resolved,
            }, { pendingKeys: ['precisionInsightsSignals'] });
        },

        setDataCollectionMode: (next) => {
            const current = getEffectiveProtocolState(get).dataCollectionMode;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeDataCollectionMode(value, current || DEFAULT_DATA_COLLECTION_MODE);
            if (isProtocolSettingsIntentAcknowledged(get, { dataCollectionMode: resolved })) return;
            return commitProtocolSettingsPatch(get, set, {
                dataCollectionMode: resolved,
            }, { pendingKeys: ['dataCollectionMode'] });
        },

        setPrecisionInsightsMode: (next) => {
            const current = getEffectiveProtocolState(get).precisionInsightsMode;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizePrecisionInsightsMode(value, current || DEFAULT_PRECISION_INSIGHTS_MODE);
            if (isProtocolSettingsIntentAcknowledged(get, { precisionInsightsMode: resolved })) return;
            return commitProtocolSettingsPatch(get, set, {
                precisionInsightsMode: resolved,
            }, { pendingKeys: ['precisionInsightsMode'] });
        },

        setInsightsMode: (next) => {
            const current = getEffectiveProtocolState(get).insightsMode;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeInsightsMode(value, current || INSIGHTS_MODES.OFF);
            if (isProtocolSettingsIntentAcknowledged(get, { insightsMode: resolved })) return;
            return commitProtocolSettingsPatch(get, set, {
                insightsMode: resolved,
            }, { pendingKeys: ['insightsMode'] });
        },

        setPermissionMode: (next) => {
            const current = getEffectiveProtocolState(get).permissionMode;
            const value = typeof next === 'function' ? next(current) : next;
            if (value !== 'selective') {
                throw new Error('PERMISSION_MODE_CONTRACT_INVALID');
            }
            if (isProtocolSettingsIntentAcknowledged(get, { permissionMode: value })) return;
            return commitProtocolSettingsPatch(get, set, { permissionMode: value }, { pendingKeys: ['permissionMode'] });
        },

        setSolarLocationProfile: (next) => {
            const current = getEffectiveProtocolState(get).solarLocationProfile;
            const value = typeof next === 'function' ? next(current) : next;
            const resolved = normalizeSolarLocationProfile(value, current);
            if (isProtocolSettingsIntentAcknowledged(get, { [SOLAR_LOCATION_STORAGE_KEY]: resolved })) return;
            return commitProtocolSettingsPatch(get, set, { [SOLAR_LOCATION_STORAGE_KEY]: resolved }, {
                pendingKeys: [SOLAR_LOCATION_STORAGE_KEY],
            });
        },
    };
}
