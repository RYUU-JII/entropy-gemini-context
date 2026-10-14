import { DEFAULT_COOLING_CURVE, normalizeCoolingCurve } from '../../../domains/settings/config/coolingCurvePolicy.js';
import { create } from 'zustand';
import { DEFAULT_TAB_MANAGEMENT, normalizeTabManagement } from '../../../domains/settings/config/tabManagement.js';
import {
    DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
    MEMORY_PURGE_SETTINGS_DEFAULTS,
    DEFAULT_RULES_MODE,
    normalizeGlobalCapNotifyOnExceeded,
    normalizeProductRulesMode,
    normalizeUrlList,
    normalizeSiteRuleTimeline,
    normalizeSiteGoalMeta,
    normalizeSiteGoals,
    normalizeGlobalGoal,
    resolveMemoryPurgeSettings,
} from '../../../domains/settings/config/siteRules.js';
import {
    DEFAULT_PROTECTION_PRESET_ASSIGNMENTS,
    DEFAULT_PROTECTION_PRESET_CATALOG,
    normalizeProtectionPresetAssignments,
    normalizeProtectionPresetCatalog,
} from '../../../domains/protection/catalog/presetContract.js';
import {
    FILTERING_MODES,
    normalizeFilteringMode,
} from '../../../domains/settings/config/blockingPolicy.js';
import {
    CONFIG_DEFAULT_FILTER_SETTINGS,
    normalizeFilterSettings
} from '../../../domains/settings/config/index.js';
import {
    DEFAULT_INDICATOR_CONFIG,
    normalizeIndicatorConfig,
} from '../../../domains/settings/config/indicator.js';
import {
    DEFAULT_GATE_CONFIG,
    normalizeGateConfig,
} from '../../../domains/settings/config/gateConfig.js';
import {
    DEFAULT_NUDGE_SETTINGS,
    normalizeStoredNudgeConfig,
} from '../../../domains/settings/config/nudgeConfig.js';
import {
    DEFAULT_NOTIFICATIONS_CONFIG,
    normalizeNotificationsConfig,
} from '../../../domains/settings/config/notificationsConfig.js';
import {
    DEFAULT_DEBUG_CONFIG,
    normalizeDebugConfig,
} from '../../../domains/settings/config/debugConfig.js';
import {
    DEFAULT_ARTIFACT_CONTROL_STATE,
    normalizeArtifactControlState,
} from '../../../domains/settings/config/artifactControlState.js';
import {
    DEFAULT_SOLAR_LOCATION_PROFILE,
    normalizeSolarLocationProfile,
    SOLAR_LOCATION_STORAGE_KEY,
} from '../../../domains/settings/config/solarLocation.js';
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
    normalizePrecisionInsightsSignals,
    normalizePrecisionInsightsMode,
    normalizeDataCollectionMode,
} from '../../../domains/settings/config/dataCollectionPolicy.js';
import { resolveBootPrewarmSection } from '../bootstrap/bootPrewarmSnapshot.js';
import { readProtocolSettingsSnapshot } from './protocolSettingsClient.js';
import { subscribeProtocolSettingsChanges } from '../../../platform/storage/protocol/ProtocolSettingsSubscriptionService.js';
import {
    DEFAULT_SCHEDULE,
    normalizeSchedule,
    requireCanonicalSchedule,
    requireProtocolFilterSettingsPayload,
} from './protocolStoreHelpers.js';
import {
    buildProtocolSettingsReadDefaults,
    syncProtocolSettingsFromStorage,
    syncProtocolSettingsFromStorageChanges,
} from './protocolStoreCommands.js';
import { createProtocolRulesSlice } from './protocolRulesSlice.js';
import { createProtocolPresetSlice } from './protocolPresetSlice.js';
import { createProtocolConfigSlice } from './protocolConfigSlice.js';
import { createProtocolInsightsSlice } from './protocolInsightsSlice.js';

/**
 * Protocol Store
 *
 * Manages all blocking rules, schedules, and filter configurations.
 * Consolidates rules, schedule, and filter modules in a single source of truth.
 *
 * Composition root: this file owns the initial state, the load/sync/subscribe
 * lifecycle, and composes the setter slices (rules, presets, config, insights).
 * The command engine lives in ./protocolStoreCommands.js.
 */

let initializePromise = null;
let externalProtocolSettingsUnsubscribe = null;

function resolveProtocolSnapshotFilterSettings(source, { sourceName = 'protocol.snapshot' } = {}) {
    const snapshot = source && typeof source === 'object' && !Array.isArray(source)
        ? source
        : {};
    if (!Object.prototype.hasOwnProperty.call(snapshot, 'filterSettings')) {
        return CONFIG_DEFAULT_FILTER_SETTINGS;
    }
    return requireProtocolFilterSettingsPayload(snapshot.filterSettings, {
        source: sourceName,
    });
}

export const useProtocolStore = create((set, get) => {
    return ({
    // --- State ---

    // Rules Module
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
    ...MEMORY_PURGE_SETTINGS_DEFAULTS,
    gateConfig: DEFAULT_GATE_CONFIG,
    tabManagement: DEFAULT_TAB_MANAGEMENT,
    nudgeConfig: DEFAULT_NUDGE_SETTINGS,
    notificationsConfig: DEFAULT_NOTIFICATIONS_CONFIG,
    debugConfig: DEFAULT_DEBUG_CONFIG,

    // Schedule Module
    schedule: DEFAULT_SCHEDULE,

    // Filter Module
    filterSettings: CONFIG_DEFAULT_FILTER_SETTINGS,
    artifactControlState: DEFAULT_ARTIFACT_CONTROL_STATE,
    indicatorConfig: DEFAULT_INDICATOR_CONFIG,
    insightsConsent: INSIGHTS_CONSENT.UNSET,
    insightsMode: INSIGHTS_MODES.OFF,
    dataCollectionMode: DEFAULT_DATA_COLLECTION_MODE,
    precisionInsightsMode: DEFAULT_PRECISION_INSIGHTS_MODE,
    precisionInsightsSignals: DEFAULT_PRECISION_INSIGHTS_SIGNALS,
    permissionMode: 'selective',
    solarLocationProfile: DEFAULT_SOLAR_LOCATION_PROFILE,

    loaded: false,
    loadError: null,
    reconcileError: null,
    reconcileErrorKeys: [],

    // --- Lifecycle Actions ---

    initialize: async (bootContext = null) => {
        if (get().loaded) return;
        if (initializePromise) return initializePromise;

        const defaults = buildProtocolSettingsReadDefaults();

        initializePromise = (async () => {
            try {
                const prewarm = resolveBootPrewarmSection(bootContext, 'protocol');
                if (prewarm) {
                    if (prewarm.permissionMode !== 'selective') {
                        throw new Error('PROTOCOL_PREWARM_PERMISSION_MODE_CONTRACT_INVALID');
                    }
                    const memoryPurgeSettings = resolveMemoryPurgeSettings(prewarm);
                    const insightsMode = normalizeInsightsMode(prewarm.insightsMode, INSIGHTS_MODES.OFF);
                    const dataCollectionMode = normalizeDataCollectionMode(
                        prewarm.dataCollectionMode,
                        DEFAULT_DATA_COLLECTION_MODE,
                    );
                    const precisionInsightsMode = normalizePrecisionInsightsMode(
                        prewarm.precisionInsightsMode,
                        DEFAULT_PRECISION_INSIGHTS_MODE,
                    );
                    const precisionInsightsSignals = normalizePrecisionInsightsSignals(
                        prewarm.precisionInsightsSignals,
                        DEFAULT_PRECISION_INSIGHTS_SIGNALS,
                    );
                    set({
                        blockedUrls: normalizeUrlList(prewarm.blockedUrls, []),
                        allowedUrls: normalizeUrlList(prewarm.allowedUrls, []),
                        trackingExcludedUrls: normalizeUrlList(prewarm.trackingExcludedUrls, []),
                        filteringMode: normalizeFilteringMode(prewarm.filteringMode),
                        siteGoals: normalizeSiteGoals(prewarm.siteGoals),
                        siteGoalMeta: normalizeSiteGoalMeta(prewarm.siteGoalMeta),
                        siteRuleTimeline: normalizeSiteRuleTimeline(prewarm.siteRuleTimeline),
                        protectionPresetCatalog: normalizeProtectionPresetCatalog(prewarm.protectionPresetCatalog),
                        protectionPresetAssignments: normalizeProtectionPresetAssignments(prewarm.protectionPresetAssignments),
                        rulesMode: normalizeProductRulesMode(prewarm.rulesMode),
                        coolingCurve: normalizeCoolingCurve(prewarm.coolingCurve),
                        globalGoal: normalizeGlobalGoal(prewarm.globalGoal),
                        globalCapNotifyOnExceeded: normalizeGlobalCapNotifyOnExceeded(
                            prewarm.globalCapNotifyOnExceeded,
                            DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
                        ),
                        historyCleanupForBlocked: memoryPurgeSettings.historyCleanupForBlocked,
                        concealBlockedBookmarks: memoryPurgeSettings.concealBlockedBookmarks,
                        tabEvaporationForBlocked: memoryPurgeSettings.tabEvaporationForBlocked,
                        tabEvaporationTimeoutMinutes: memoryPurgeSettings.tabEvaporationTimeoutMinutes,
                        tabManagement: normalizeTabManagement(prewarm.tabManagement),
                        gateConfig: normalizeGateConfig(prewarm.gateConfig, {
                            defaults: DEFAULT_GATE_CONFIG,
                        }),
                        nudgeConfig: normalizeStoredNudgeConfig(prewarm.nudgeConfig, {
                            defaults: DEFAULT_NUDGE_SETTINGS,
                        }),
                        notificationsConfig: normalizeNotificationsConfig(prewarm.notificationsConfig, {
                            defaults: DEFAULT_NOTIFICATIONS_CONFIG,
                        }),
                        debugConfig: normalizeDebugConfig(prewarm.debugConfig, {
                            defaults: DEFAULT_DEBUG_CONFIG,
                        }),
                        schedule: requireCanonicalSchedule(prewarm.schedule),
                        filterSettings: normalizeFilterSettings(resolveProtocolSnapshotFilterSettings(prewarm, {
                            sourceName: 'protocol.prewarm',
                        })),
                        artifactControlState: normalizeArtifactControlState(prewarm.artifactControlState, {
                            defaults: DEFAULT_ARTIFACT_CONTROL_STATE,
                        }),
                        indicatorConfig: normalizeIndicatorConfig(prewarm.indicatorConfig),
                        insightsConsent: normalizeInsightsConsent(
                            prewarm.insightsConsent,
                            INSIGHTS_CONSENT.UNSET,
                        ),
                        insightsMode,
                        dataCollectionMode,
                        precisionInsightsMode,
                        precisionInsightsSignals,
                        permissionMode: prewarm.permissionMode,
                        solarLocationProfile: normalizeSolarLocationProfile(prewarm.solarLocationProfile),
                        loaded: true,
                        loadError: null,
                    });
                    return;
                }

                const items = await readProtocolSettingsSnapshot(defaults);
                const raw = items || {};
                if (raw.permissionMode !== 'selective') {
                    throw new Error('PROTOCOL_SETTINGS_PERMISSION_MODE_CONTRACT_INVALID');
                }
                const relaxationSchedule = raw.relaxationSchedule && typeof raw.relaxationSchedule === 'object'
                    ? raw.relaxationSchedule
                    : DEFAULT_SCHEDULE;
                const normalizedSchedule = requireCanonicalSchedule(relaxationSchedule);
                const memoryPurgeSettings = resolveMemoryPurgeSettings(raw);
                const insightsMode = normalizeInsightsMode(raw.insightsMode, INSIGHTS_MODES.OFF);
                const dataCollectionMode = normalizeDataCollectionMode(
                    raw.dataCollectionMode,
                    DEFAULT_DATA_COLLECTION_MODE,
                );
                const precisionInsightsMode = normalizePrecisionInsightsMode(
                    raw.precisionInsightsMode,
                    DEFAULT_PRECISION_INSIGHTS_MODE,
                );
                const precisionInsightsSignals = normalizePrecisionInsightsSignals(
                    raw.precisionInsightsSignals,
                    DEFAULT_PRECISION_INSIGHTS_SIGNALS,
                );

                set({
                    blockedUrls: normalizeUrlList(raw.blockedUrls, []),
                    allowedUrls: normalizeUrlList(raw.allowedUrls, []),
                    trackingExcludedUrls: normalizeUrlList(raw.trackingExcludedUrls, []),
                    filteringMode: normalizeFilteringMode(raw.filteringMode),
                    siteGoals: normalizeSiteGoals(raw.siteGoals),
                    siteGoalMeta: normalizeSiteGoalMeta(raw.siteGoalMeta),
                    siteRuleTimeline: normalizeSiteRuleTimeline(raw.siteRuleTimeline),
                    protectionPresetCatalog: normalizeProtectionPresetCatalog(raw.protectionPresetCatalog),
                    protectionPresetAssignments: normalizeProtectionPresetAssignments(raw.protectionPresetAssignments),
                    rulesMode: normalizeProductRulesMode(raw.rulesMode),
                    coolingCurve: normalizeCoolingCurve(raw.coolingCurve),
                    globalGoal: normalizeGlobalGoal(raw.globalGoal),
                    globalCapNotifyOnExceeded: normalizeGlobalCapNotifyOnExceeded(
                        raw.globalCapNotifyOnExceeded,
                        DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
                    ),
                    historyCleanupForBlocked: memoryPurgeSettings.historyCleanupForBlocked,
                    concealBlockedBookmarks: memoryPurgeSettings.concealBlockedBookmarks,
                    tabEvaporationForBlocked: memoryPurgeSettings.tabEvaporationForBlocked,
                    tabEvaporationTimeoutMinutes: memoryPurgeSettings.tabEvaporationTimeoutMinutes,
                    tabManagement: normalizeTabManagement(raw.tabManagement),
                    gateConfig: normalizeGateConfig(raw.gateConfig, {
                        defaults: DEFAULT_GATE_CONFIG,
                    }),
                    nudgeConfig: normalizeStoredNudgeConfig(raw.nudgeConfig, {
                        defaults: DEFAULT_NUDGE_SETTINGS,
                    }),
                    notificationsConfig: normalizeNotificationsConfig(raw.notificationsConfig, {
                        defaults: DEFAULT_NOTIFICATIONS_CONFIG,
                    }),
                    debugConfig: normalizeDebugConfig(raw.debugConfig, {
                        defaults: DEFAULT_DEBUG_CONFIG,
                    }),
                    schedule: normalizedSchedule,
                    filterSettings: normalizeFilterSettings(resolveProtocolSnapshotFilterSettings(raw, {
                        sourceName: 'protocol.snapshot',
                    })),
                    artifactControlState: normalizeArtifactControlState(raw.artifactControlState, {
                        defaults: DEFAULT_ARTIFACT_CONTROL_STATE,
                    }),
                    indicatorConfig: normalizeIndicatorConfig(raw.indicatorConfig),
                    insightsConsent: normalizeInsightsConsent(raw.insightsConsent, INSIGHTS_CONSENT.UNSET),
                    insightsMode,
                    dataCollectionMode,
                    precisionInsightsMode,
                    precisionInsightsSignals,
                    permissionMode: raw.permissionMode,
                    solarLocationProfile: normalizeSolarLocationProfile(raw[SOLAR_LOCATION_STORAGE_KEY]),
                    loaded: true,
                    loadError: null,
                });
            } catch (error) {
                console.error('[ProtocolStore] Failed to initialize:', error);
                set({
                    loaded: false,
                    loadError: error,
                });
                throw error;
            }
        })().finally(() => {
            initializePromise = null;
        });

        return initializePromise;
    },

    syncExternalProtocolSettings: () => syncProtocolSettingsFromStorage(get, set),

    subscribeExternalProtocolSettings: () => {
        if (externalProtocolSettingsUnsubscribe) {
            return () => {};
        }

        externalProtocolSettingsUnsubscribe = subscribeProtocolSettingsChanges(({ changedKeys }) => {
            void syncProtocolSettingsFromStorageChanges(get, set, changedKeys);
        });

        return () => {
            if (!externalProtocolSettingsUnsubscribe) return;
            externalProtocolSettingsUnsubscribe();
            externalProtocolSettingsUnsubscribe = null;
        };
    },

    // --- Setter slices ---

    ...createProtocolRulesSlice(set, get),
    ...createProtocolPresetSlice(set, get),
    ...createProtocolConfigSlice(set, get),
    ...createProtocolInsightsSlice(set, get),
    });
});
