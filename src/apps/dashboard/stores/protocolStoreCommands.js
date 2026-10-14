import { DEFAULT_COOLING_CURVE } from '../../../domains/settings/config/coolingCurvePolicy.js';
import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../platform/build/releaseCapabilities.js';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '../../../platform/diagnostics/settingsFlowTiming.js';
import {
    createFilterSettingsMutationPatch,
    mergeFilterSettingsMutationPatches,
} from '../../../domains/settings/config/filterSettingsMutation.js';
import { mergeSettingsCommandPatches } from '../../../domains/settings/config/settingsDashboardCommandContract.js';
import {
    DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    DEFAULT_RULES_MODE,
} from '../../../domains/settings/config/siteRules.js';
import {
    DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
    DEFAULT_PROTECTION_PRESET_CATALOG,
} from '../../../domains/protection/catalog/presetContract.js';
import { FILTERING_MODES } from '../../../domains/settings/config/blockingPolicy.js';
import { CONFIG_DEFAULT_FILTER_SETTINGS } from '../../../domains/settings/config/index.js';
import { DEFAULT_INDICATOR_CONFIG } from '../../../domains/settings/config/indicator.js';
import { DEFAULT_GATE_CONFIG } from '../../../domains/settings/config/gateConfig.js';
import { DEFAULT_TAB_MANAGEMENT } from '../../../domains/settings/config/tabManagement.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../../domains/settings/config/nudgeConfig.js';
import { DEFAULT_NOTIFICATIONS_CONFIG } from '../../../domains/settings/config/notificationsConfig.js';
import { DEFAULT_DEBUG_CONFIG } from '../../../domains/settings/config/debugConfig.js';
import { DEFAULT_ARTIFACT_CONTROL_STATE } from '../../../domains/settings/config/artifactControlState.js';
import {
    DEFAULT_SOLAR_LOCATION_PROFILE,
    SOLAR_LOCATION_STORAGE_KEY,
} from '../../../domains/settings/config/solarLocation.js';
import {
    INSIGHTS_CONSENT,
    INSIGHTS_MODES,
} from '../../../domains/settings/config/insightsMode.js';
import {
    DEFAULT_DATA_COLLECTION_MODE,
    DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    DEFAULT_PRECISION_INSIGHTS_MODE,
} from '../../../domains/settings/config/dataCollectionPolicy.js';
import {
    assertProtocolSettingsReadAdmission,
    dispatchProtocolSettingsPatch,
    getPendingProtocolSettingsPatch,
    getProtocolSettingsSyncState,
    readProtocolSettingsSnapshot,
    runProtocolSettingsCommand,
} from './protocolSettingsClient.js';
import {
    DEFAULT_SCHEDULE,
    buildProtocolSettingsPatch,
    buildProtocolSyncResult,
} from './protocolStoreHelpers.js';

// Shared plumbing for the protocol store: read defaults, the effective-state
// projection (store state merged with any in-flight settings patch), the
// settings-command runners that every setter delegates to, and the external
// storage sync. Each command takes the store's `get`/`set` explicitly so it can
// live outside the store closure.

let externalProtocolSettingsSyncPromise = null;
let externalProtocolSettingsSyncRequested = false;
let externalProtocolSettingsFullSyncRequested = false;
const externalProtocolSettingsSyncKeys = new Set();
const protocolCommitRevisions = new Map();
const protocolReconcilingIntents = new Map();
const protocolUnacknowledgedIntents = new Map();
const protocolDeferredStorageKeys = new Set();
const protocolAcknowledgedIntentSequences = new Map();
const protocolReadFailures = new Map();
const protocolUncertainFilterFields = new Set();
let nextProtocolIntentId = 1;

function beginProtocolLocalIntent(keys, patch = {}) {
    const tokens = keys.flatMap((key) => key === 'filterSettings' && patch.filterSettings
        ? Object.entries(patch.filterSettings).flatMap(([feature, fields]) => Object.keys(fields)
            .map((field) => `${key}.${feature}.${field}`))
        : [key]);
    const intent = { id: nextProtocolIntentId++, keys, patch, tokens };
    protocolUnacknowledgedIntents.set(intent.id, intent);
    return intent;
}

function hasUnacknowledgedProtocolKey(key) {
    return [...protocolUnacknowledgedIntents.values()].some((intent) => intent.keys.includes(key));
}

async function finishProtocolLocalIntent(get, set, intent) {
    protocolUnacknowledgedIntents.delete(intent.id);
    protocolReconcilingIntents.delete(intent.id);
    // Failed commands still owe deferred external invalidations a canonical
    // read. A concurrent command covering the key will drain it on settlement.
    const keys = [...protocolDeferredStorageKeys].filter((key) => !hasUnacknowledgedProtocolKey(key));
    keys.forEach((key) => protocolDeferredStorageKeys.delete(key));
    if (keys.length > 0) await syncProtocolSettingsFromStorage(get, set, keys);
}

function registerProtocolReconcilingIntent(intent) {
    intent.tokens.forEach((token) => {
        protocolAcknowledgedIntentSequences.set(token, Math.max(
            intent.id, protocolAcknowledgedIntentSequences.get(token) || 0,
        ));
    });
    protocolReconcilingIntents.set(intent.id, intent);
}

function projectProtocolReconcilingIntent(intent) {
    const patch = {};
    Object.entries(intent.patch).forEach(([key, value]) => {
        if (intent.id < (protocolAcknowledgedIntentSequences.get(key) || 0)) return;
        if (key !== 'filterSettings') {
            patch[key] = value;
            return;
        }
        const features = {};
        Object.entries(value).forEach(([feature, fields]) => {
            const currentFields = Object.fromEntries(Object.entries(fields).filter(([field]) => (
                intent.id >= (protocolAcknowledgedIntentSequences.get(`${key}.${feature}.${field}`) || 0)
            )));
            if (Object.keys(currentFields).length > 0) features[feature] = currentFields;
        });
        if (Object.keys(features).length > 0) patch[key] = features;
    });
    return patch;
}

function acknowledgeProtocolSettings(items) {
    Object.keys(items).forEach((key) => {
        protocolCommitRevisions.set(key, (protocolCommitRevisions.get(key) || 0) + 1);
    });
}

async function reconcileAcknowledgedProtocolSettings(get, set, result, items, intent) {
    const acknowledgedItems = Object.fromEntries(Object.entries(items).filter(([key]) => intent.keys.includes(key)));
    protocolUnacknowledgedIntents.delete(intent.id);
    Object.keys(acknowledgedItems).forEach((key) => protocolDeferredStorageKeys.delete(key));
    acknowledgeProtocolSettings(acknowledgedItems);
    const reconciliationStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
    await syncProtocolSettingsFromStorage(get, set, Object.keys(acknowledgedItems));
    if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
        phase: 'reconciliation', intentId: intent.id, commitVersion: result.version,
        durationMs: performance.now() - reconciliationStarted,
    }));
    const failedKeys = intent.keys.filter((key) => protocolReadFailures.has(key));
    const readError = failedKeys.length > 0 ? protocolReadFailures.get(failedKeys.at(-1)) : null;
    if (readError) {
        if (protocolReadFailures.has('filterSettings')) {
            intent.tokens.filter((token) => token.startsWith('filterSettings.'))
                .forEach((token) => protocolUncertainFilterFields.add(token));
        }
        const error = new Error('SETTINGS_COMMITTED_RECONCILIATION_FAILED', { cause: readError });
        error.code = 'SETTINGS_COMMITTED_RECONCILIATION_FAILED';
        error.committed = true;
        error.committedResult = result;
        error.reconciliation = { status: 'failed', error: readError };
        throw error;
    }
    return { ...result, committed: true, reconciliation: { status: 'succeeded', error: null } };
}

function buildProtocolCommandFailureResult(error, changedKeys) {
    return buildProtocolSyncResult({
        ...(error.committed === true ? error.committedResult : { changedKeys }),
        error,
        ...(error.committed === true ? {
            committed: true,
            committedResult: error.committedResult,
            reconciliation: error.reconciliation,
        } : {}),
    });
}

export function buildProtocolSettingsReadDefaults() {
    return {
        blockedUrls: [],
        allowedUrls: [],
        trackingExcludedUrls: [],
        filteringMode: FILTERING_MODES.BLOCKLIST,
        siteGoals: {},
        siteGoalMeta: {},
        siteRuleTimeline: {},
        protectionPresetCatalog: DEFAULT_PROTECTION_PRESET_CATALOG,
        protectionPresetAssignments: DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
        rulesMode: DEFAULT_RULES_MODE,
        coolingCurve: DEFAULT_COOLING_CURVE,
        globalGoal: 0,
        globalCapNotifyOnExceeded: DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
        historyCleanupForBlocked: undefined,
        concealBlockedBookmarks: undefined,
        tabEvaporationForBlocked: undefined,
        tabEvaporationTimeoutMinutes: undefined,
        gateConfig: DEFAULT_GATE_CONFIG,
        tabManagement: DEFAULT_TAB_MANAGEMENT,
        nudgeConfig: DEFAULT_NUDGE_SETTINGS,
        notificationsConfig: DEFAULT_NOTIFICATIONS_CONFIG,
        debugConfig: DEFAULT_DEBUG_CONFIG,
        relaxationSchedule: DEFAULT_SCHEDULE,
        filterSettings: CONFIG_DEFAULT_FILTER_SETTINGS,
        artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
        indicatorConfig: DEFAULT_INDICATOR_CONFIG,
        insightsConsent: INSIGHTS_CONSENT.UNSET,
        insightsMode: INSIGHTS_MODES.OFF,
        dataCollectionMode: DEFAULT_DATA_COLLECTION_MODE,
        precisionInsightsMode: DEFAULT_PRECISION_INSIGHTS_MODE,
        precisionInsightsSignals: DEFAULT_PRECISION_INSIGHTS_SIGNALS,
        permissionMode: 'selective',
        [SOLAR_LOCATION_STORAGE_KEY]: DEFAULT_SOLAR_LOCATION_PROFILE,
    };
}

export function getEffectiveProtocolState(get) {
    const currentState = get();
    let reconcilingPatch = {};
    [...protocolReconcilingIntents.values()].sort((left, right) => left.id - right.id).forEach((intent) => {
        reconcilingPatch = mergeSettingsCommandPatches(reconcilingPatch, projectProtocolReconcilingIntent(intent));
    });
    const pendingPatch = mergeSettingsCommandPatches(reconcilingPatch, getPendingProtocolSettingsPatch());
    if (!pendingPatch || Object.keys(pendingPatch).length === 0) {
        return currentState;
    }

    const { statePatch } = buildProtocolSettingsPatch(currentState, pendingPatch);
    return Object.keys(statePatch).length > 0
        ? { ...currentState, ...statePatch }
        : currentState;
}

export function isProtocolSettingsIntentAcknowledged(get, rawPatch) {
    const { normalizedSettingsPatch: normalized, settingsPatch } = buildProtocolSettingsPatch(get(), rawPatch);
    const keys = Object.keys(rawPatch).map((key) => key === 'schedule' ? 'relaxationSchedule' : key)
        .filter((key) => Object.hasOwn(normalized, key));
    if (keys.some((key) => protocolReadFailures.has(key))) return false;
    const pending = getPendingProtocolSettingsPatch();
    const sync = getProtocolSettingsSyncState();
    const dirtyKeys = sync.dirtyKeys;
    if (keys.some((key) => Object.hasOwn(pending, key) || dirtyKeys.includes(key)
        || sync.pendingKeys.includes(key)
        || [...protocolReconcilingIntents.values()].some((intent) => intent.keys.includes(key)))) return false;
    return Object.keys(settingsPatch).length === 0;
}

export function commitProtocolSettingsPatch(get, set, rawPatch, {
    pendingKeys = null,
    acknowledgeUnchangedKeys = [],
} = {}) {
    const currentState = get();
    const { settingsPatch, normalizedSettingsPatch } = buildProtocolSettingsPatch(currentState, rawPatch);
    const requiredKeys = Array.isArray(pendingKeys) ? pendingKeys : acknowledgeUnchangedKeys;
    if (requiredKeys.length > 0 || acknowledgeUnchangedKeys.length > 0) {
        for (const key of new Set([...requiredKeys, ...acknowledgeUnchangedKeys])) {
            if (Object.hasOwn(normalizedSettingsPatch, key)) settingsPatch[key] = normalizedSettingsPatch[key];
        }
    }
    if (protocolUncertainFilterFields.size > 0 && Object.hasOwn(normalizedSettingsPatch, 'filterSettings')) {
        settingsPatch.filterSettings = normalizedSettingsPatch.filterSettings;
    }
    const changedSettingKeys = Object.keys(settingsPatch);
    if (changedSettingKeys.length === 0) {
        return Promise.resolve(buildProtocolSyncResult());
    }

    if (Object.hasOwn(settingsPatch, 'filterSettings')) {
        const desired = settingsPatch.filterSettings;
        settingsPatch.filterSettings = mergeFilterSettingsMutationPatches(
            createFilterSettingsMutationPatch(currentState.filterSettings, desired),
            createFilterSettingsMutationPatch(getEffectiveProtocolState(get).filterSettings, desired),
        );
        const uncertainFields = {};
        protocolUncertainFilterFields.forEach((token) => {
            const [, feature, field] = token.split('.');
            if (desired[feature] && Object.hasOwn(desired[feature], field)) {
                if (!uncertainFields[feature]) uncertainFields[feature] = {};
                uncertainFields[feature][field] = desired[feature][field];
            }
        });
        settingsPatch.filterSettings = mergeFilterSettingsMutationPatches(settingsPatch.filterSettings, uncertainFields);
    }

    const intent = beginProtocolLocalIntent(changedSettingKeys, settingsPatch);
    return dispatchProtocolSettingsPatch(
        settingsPatch,
        Array.isArray(pendingKeys) && pendingKeys.length > 0 ? pendingKeys : changedSettingKeys,
    ).then(async (result) => {
        registerProtocolReconcilingIntent(intent);
        const reconciled = await reconcileAcknowledgedProtocolSettings(get, set, result, result.patch, intent);
        return buildProtocolSyncResult(reconciled);
    })
        .catch((error) => buildProtocolCommandFailureResult(error, changedSettingKeys))
        .finally(() => finishProtocolLocalIntent(get, set, intent));
}

export function runProtocolSiteRuleCommand(get, set, {
    pendingKeys = [],
    execute,
    onAcknowledged = null,
} = {}) {
    const resolvedPendingKeys = Array.isArray(pendingKeys) ? pendingKeys.filter(Boolean) : [];
    if (resolvedPendingKeys.length === 0) {
        return Promise.resolve(buildProtocolSyncResult());
    }

    if (typeof execute !== 'function') {
        return Promise.resolve(buildProtocolSyncResult({
            changedKeys: resolvedPendingKeys,
            error: new Error('PROTOCOL_SITE_RULE_COMMAND_EXECUTE_REQUIRED'),
        }));
    }

    const intent = beginProtocolLocalIntent(resolvedPendingKeys);
    return runProtocolSettingsCommand({
        pendingKeys: resolvedPendingKeys,
        execute,
    }).then(async (result) => {
        intent.patch = result.items;
        registerProtocolReconcilingIntent(intent);
        const reconciled = await reconcileAcknowledgedProtocolSettings(get, set, result, result.items, intent);
        return typeof onAcknowledged === 'function'
            ? onAcknowledged(reconciled)
            : buildProtocolSyncResult(reconciled);
    })
        .catch((error) => buildProtocolCommandFailureResult(error, resolvedPendingKeys))
        .finally(() => finishProtocolLocalIntent(get, set, intent));
}

export function runProtocolOwnerCommand(get, set, {
    pendingKeys = [],
    execute,
    onSuccess = null,
    onFailure = null,
} = {}) {
    const resolvedPendingKeys = Array.isArray(pendingKeys) ? pendingKeys.filter(Boolean) : [];
    if (resolvedPendingKeys.length === 0) {
        const fallback = buildProtocolSyncResult();
        return Promise.resolve(typeof onSuccess === 'function' ? onSuccess(fallback) : fallback);
    }

    if (typeof execute !== 'function') {
        const error = new Error('PROTOCOL_OWNER_COMMAND_EXECUTE_REQUIRED');
        const baseResult = buildProtocolSyncResult({
            changedKeys: resolvedPendingKeys,
            error,
        });
        return Promise.resolve(typeof onFailure === 'function'
            ? onFailure(error, baseResult)
            : baseResult);
    }

    const intent = beginProtocolLocalIntent(resolvedPendingKeys);
    return runProtocolSettingsCommand({
        pendingKeys: resolvedPendingKeys,
        execute,
    }).then(async (result) => {
        intent.patch = result.items;
        registerProtocolReconcilingIntent(intent);
        const reconciled = await reconcileAcknowledgedProtocolSettings(get, set, result, result.items, intent);
        return typeof onSuccess === 'function'
            ? onSuccess(reconciled)
            : buildProtocolSyncResult(reconciled);
    })
        .catch((error) => {
            const baseResult = buildProtocolCommandFailureResult(error, resolvedPendingKeys);
            return typeof onFailure === 'function'
                ? onFailure(error, baseResult)
                : baseResult;
        })
        .finally(() => finishProtocolLocalIntent(get, set, intent));
}

export function syncProtocolSettingsFromStorageChanges(get, set, changedKeys) {
    if (!Array.isArray(changedKeys) || changedKeys.some((key) => typeof key !== 'string')) {
        throw new Error('PROTOCOL_SETTINGS_SYNC_KEYS_INVALID');
    }
    const keys = changedKeys.filter((key) => {
        if (!hasUnacknowledgedProtocolKey(key)) return true;
        // The required post-ACK read covers these invalidations. Keep only key
        // names, never event values or a second pending settings projection.
        protocolDeferredStorageKeys.add(key);
        return false;
    });
    return syncProtocolSettingsFromStorage(get, set, keys);
}

function publishProtocolCanonicalRead(get, set, statePatch = {}) {
    const current = get();
    const reconcileError = protocolReadFailures.size > 0 ? [...protocolReadFailures.values()].at(-1) : null;
    const reconcileErrorKeys = [...protocolReadFailures.keys()];
    const patch = { ...statePatch };
    if (current.reconcileError !== reconcileError) patch.reconcileError = reconcileError;
    if (!Array.isArray(current.reconcileErrorKeys)
        || current.reconcileErrorKeys.length !== reconcileErrorKeys.length
        || reconcileErrorKeys.some((key, index) => current.reconcileErrorKeys[index] !== key)) {
        patch.reconcileErrorKeys = reconcileErrorKeys;
    }
    // One canonical read publishes values and its error ledger atomically.
    // An unchanged successful read still occurred but owes no store notification.
    const publishedKeys = Object.keys(patch);
    const publishStarted = beginSettingsFlowTiming();
    if (publishedKeys.length > 0) set(patch);
    endSettingsFlowTiming('canonical_publication', publishStarted, { published: publishedKeys.length > 0 });
}

export function syncProtocolSettingsFromStorage(get, set, changedKeys = null) {
    const allDefaults = buildProtocolSettingsReadDefaults();
    if (changedKeys !== null && (!Array.isArray(changedKeys) || changedKeys.some((key) => typeof key !== 'string'))) {
        throw new Error('PROTOCOL_SETTINGS_SYNC_KEYS_INVALID');
    }
    const keys = changedKeys === null
        ? Object.keys(allDefaults)
        : changedKeys.filter((key) => Object.hasOwn(allDefaults, key));
    if (!keys.length) return Promise.resolve(buildProtocolSyncResult());
    if (changedKeys === null) externalProtocolSettingsFullSyncRequested = true;
    keys.forEach((key) => externalProtocolSettingsSyncKeys.add(key));
    externalProtocolSettingsSyncRequested = true;
    if (externalProtocolSettingsSyncPromise) {
        return externalProtocolSettingsSyncPromise;
    }

    externalProtocolSettingsSyncPromise = (async () => {
        let result = buildProtocolSyncResult();
        const requestedKeys = new Set();

        do {
            externalProtocolSettingsSyncRequested = false;
            const defaults = externalProtocolSettingsFullSyncRequested
                ? buildProtocolSettingsReadDefaults()
                : Object.fromEntries([...externalProtocolSettingsSyncKeys].map((key) => [key, allDefaults[key]]));
            externalProtocolSettingsSyncKeys.clear();
            externalProtocolSettingsFullSyncRequested = false;
            Object.keys(defaults).forEach((key) => requestedKeys.add(key));
            const readRevisions = new Map(Object.keys(defaults).map((key) => [key, protocolCommitRevisions.get(key) || 0]));
            try {
                const readStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
                const raw = await readProtocolSettingsSnapshot(defaults);
                if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
                    phase: 'canonical_read', keys: Object.keys(defaults),
                    durationMs: performance.now() - readStarted,
                }));
                assertProtocolSettingsReadAdmission();
                const projectionStarted = beginSettingsFlowTiming();
                // Only a canonical snapshot advances the committed store. Local
                // intent is projected by getEffectiveProtocolState while its
                // command remains pending, never written into this read result.
                const currentItems = Object.fromEntries(Object.entries(raw).filter(([key]) => (
                    (protocolCommitRevisions.get(key) || 0) === readRevisions.get(key)
                )));
                const { statePatch } = buildProtocolSettingsPatch(
                    get(), currentItems,
                );
                const changedKeys = Object.keys(statePatch);
                endSettingsFlowTiming('canonical_projection', projectionStarted);
                Object.keys(currentItems).forEach((key) => protocolReadFailures.delete(key));
                if (Object.hasOwn(currentItems, 'filterSettings')) protocolUncertainFilterFields.clear();
                publishProtocolCanonicalRead(get, set, statePatch);
                result = buildProtocolSyncResult({
                    changedKeys,
                    applied: {
                        refreshed: true,
                    },
                });
            } catch (error) {
                console.warn('[ProtocolStore] Failed to sync external protocol settings:', error);
                Object.keys(defaults).forEach((key) => protocolReadFailures.set(key, error));
                publishProtocolCanonicalRead(get, set);
                result = buildProtocolSyncResult({
                    error,
                });
            }
        } while (externalProtocolSettingsSyncRequested);
        const errors = [...protocolReadFailures.entries()].filter(([key]) => requestedKeys.has(key));
        const error = errors.length > 0 ? errors.at(-1)[1] : null;
        return error ? buildProtocolSyncResult({ error }) : result;
    })().finally(() => {
        externalProtocolSettingsSyncPromise = null;
        if (externalProtocolSettingsSyncRequested) {
            return syncProtocolSettingsFromStorage(get, set, externalProtocolSettingsFullSyncRequested
                ? null
                : [...externalProtocolSettingsSyncKeys]);
        }
    });

    return externalProtocolSettingsSyncPromise;
}
