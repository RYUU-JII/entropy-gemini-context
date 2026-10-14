import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
    runtimeOnMessageAddListener,
    runtimeOnMessageRemoveListener,
    runtimeSendMessage,
} from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';
import {
    STATS_EVENT_TYPES,
    validateStatsEvent,
} from '../../../domains/stats/contracts/statsEvents.js';
import { STATS_RANGE_DEFAULT_DAYS } from '../../../domains/stats/contracts/statsContracts.js';
import { resolveBootPrewarmSection } from '../bootstrap/bootPrewarmSnapshot.js';
import { subscribeProtocolSettingsChanges } from '../../../platform/storage/protocol/ProtocolSettingsSubscriptionService.js';
import { CYCLE_SETTINGS_KEY } from '../../../platform/storage/runtime/cycleStateStorageContracts.js';
import {
    ANALYSIS_PROJECTION_REFRESH_REASON,
    createAnalysisProjectionRefreshState,
    markAnalysisProjectionRefreshed,
    markAnalysisProjectionRefreshDeferred,
    resolveAnalysisProjectionRefreshDecision,
} from './analysisSnapshotRefreshPolicy.js';
import {
    createAnalysisResponseError,
    requireBootstrapAnalysisPayload,
    requireCycleProjectionPayload,
    requireSitesSnapshotPayload,
    requireStatusSnapshotPayload,
} from './analysisStoreResponseContracts.js';

/**
 * Analysis Store
 * 
 * Manages the dashboard analysis read models sourced from background DTO queries.
 * Keeps cycle/status/sites snapshots in sync without exposing raw stats ranges.
 */

const STATS_DAYS_BACK = STATS_RANGE_DEFAULT_DAYS;
let initializePromise = null;
let analysisReadSequence = 0;
const ANALYSIS_PROJECTIONS = Object.freeze(['cycle', 'status', 'sites']);
const projectionReadSequences = { cycle: 0, status: 0, sites: 0 };
const projectionInvalidations = { cycle: 0, status: 0, sites: 0 };
const projectionDemand = new Map();

function isAnalysisDocumentVisible() {
    return typeof document === 'undefined'
        || (document.hidden !== true && document.visibilityState !== 'hidden');
}

function hasProjectionDemand(projection) {
    return isAnalysisDocumentVisible()
        && [...projectionDemand.values()].some((projections) => projections.includes(projection));
}

function beginAnalysisRead(projections) {
    const sequence = ++analysisReadSequence;
    const invalidations = {};
    for (const projection of projections) {
        projectionReadSequences[projection] = sequence;
        invalidations[projection] = projectionInvalidations[projection];
    }
    return { sequence, invalidations };
}

function isCurrentAnalysisRead(context, projection) {
    return projectionReadSequences[projection] === context.sequence;
}

function sitesReadSupersessionReceipt(context) {
    return {
        status: 'superseded', projection: 'sites',
        requestSequence: context.sequence,
        supersedingSequence: projectionReadSequences.sites,
    };
}

function isAnalysisReadFresh(context, projection) {
    return context.invalidations[projection] === projectionInvalidations[projection];
}

function commitAnalysisPatch(set, get, patch) {
    const next = { ...get(), ...patch };
    set({
        ...patch,
        // Aggregate diagnostics only. Surface readiness uses its own projection error.
        analysisError: next.cycleError || next.statusError || next.sitesError || null,
    });
}

let cycleProjectionRefreshInFlight = null;
let cycleProjectionRefreshQueued = false;
let cycleProjectionRefreshQueuedPolicyInput = null;
let cycleProjectionRefreshQueuedDemandOnly = true;
let cycleProjectionRefreshQueuedForce = false;
let cycleProjectionRefreshState = createAnalysisProjectionRefreshState();
let cycleProjectionTrailingRefreshTimer = null;
let statusSnapshotRefreshInFlight = null;
let statusSnapshotRefreshQueued = false;
let statusSnapshotRefreshQueuedPolicyInput = null;
let statusSnapshotRefreshQueuedForce = false;
let statusSnapshotRefreshQueuedReason = null;
let statusSnapshotRefreshQueuedDemandOnly = true;
let statusSnapshotRefreshState = createAnalysisProjectionRefreshState();
let statusSnapshotTrailingRefreshTimer = null;
let sitesSnapshotRefreshInFlight = null;
let sitesSnapshotRefreshQueued = false;
let sitesSnapshotRefreshQueuedPolicyInput = null;
let statsRealtimeBridgeAttached = false;
let statsRealtimeBridgeListener = null;
let unsubscribeAnalysisSettings = null;
const CYCLE_POLICY_KEYS = new Set(['blockedUrls', 'allowedUrls', 'filteringMode', 'globalGoal', 'siteRuleTimeline']);
const STATUS_POLICY_KEYS = new Set([
    ...CYCLE_POLICY_KEYS,
    'siteGoals', 'rulesMode', 'dataCollectionMode', 'trackingExcludedUrls',
    'insightsMode', 'insightsConsent', 'protectionPresetAssignments',
]);

function clearCycleProjectionTrailingRefresh() {
    if (cycleProjectionTrailingRefreshTimer === null) return;
    clearTimeout(cycleProjectionTrailingRefreshTimer);
    cycleProjectionTrailingRefreshTimer = null;
}

function scheduleCycleProjectionTrailingRefresh(refreshDecision) {
    if (
        !hasProjectionDemand('cycle')
        || refreshDecision?.reason !== ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED
        || cycleProjectionTrailingRefreshTimer !== null
    ) return;
    const nextAllowedAtMs = Number(refreshDecision.nextAllowedAtMs);
    if (!Number.isFinite(nextAllowedAtMs)) return;
    cycleProjectionTrailingRefreshTimer = setTimeout(() => {
        cycleProjectionTrailingRefreshTimer = null;
        void useAnalysisStore.getState().refreshCycleProjection({
            demandOnly: true,
            throttle: true,
            refreshReason: ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED,
        });
    }, Math.max(0, nextAllowedAtMs - Date.now()));
}

function markCycleProjectionRefresh(reason) {
    clearCycleProjectionTrailingRefresh();
    cycleProjectionRefreshState = markAnalysisProjectionRefreshed(cycleProjectionRefreshState, { reason });
}

function clearStatusSnapshotTrailingRefresh() {
    if (statusSnapshotTrailingRefreshTimer === null) return;
    clearTimeout(statusSnapshotTrailingRefreshTimer);
    statusSnapshotTrailingRefreshTimer = null;
}

function scheduleStatusSnapshotTrailingRefresh(refreshDecision) {
    if (
        !hasProjectionDemand('status')
        || refreshDecision?.reason !== ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED
        || statusSnapshotTrailingRefreshTimer !== null
    ) {
        return;
    }
    const nextAllowedAtMs = Number(refreshDecision?.nextAllowedAtMs);
    if (!Number.isFinite(nextAllowedAtMs)) return;

    statusSnapshotTrailingRefreshTimer = setTimeout(() => {
        statusSnapshotTrailingRefreshTimer = null;
        const store = useAnalysisStore.getState();
        if (typeof store?.refreshStatusSnapshot !== 'function') return;
        void store.refreshStatusSnapshot({
            demandOnly: true,
            throttle: true,
            refreshReason: ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED,
        });
    }, Math.max(0, nextAllowedAtMs - Date.now()));
}

function handleStatsRealtimeMessage(message) {
    if (!message || message.type !== MESSAGE_TYPES.STATS_EVENT) return false;
    const event = message?.payload;
    const validation = validateStatsEvent(event);
    if (!validation.ok) return false;

    const store = useAnalysisStore.getState();
    if (!store) return false;

    const reset = event.type === STATS_EVENT_TYPES.RESET;
    if (reset) {
        // Reject every response captured before the reset, including a boot read.
        beginAnalysisRead(ANALYSIS_PROJECTIONS);
        useAnalysisStore.setState({
            cycleState: null,
            cycleSnapshot: null,
            statusSnapshot: null,
            sitesSnapshot: null,
            cycleLoaded: false,
            statusLoaded: false,
            sitesLoaded: false,
        });
    }
    store.invalidateAnalysisProjections({
        force: reset || event.type === STATS_EVENT_TYPES.ROLLOVER,
        refreshReason: event.type === STATS_EVENT_TYPES.ROLLOVER
            ? ANALYSIS_PROJECTION_REFRESH_REASON.STATS_ROLLOVER
            : ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED,
    });
    return false;
}

function attachStatsRealtimeBridge() {
    if (!unsubscribeAnalysisSettings) {
        unsubscribeAnalysisSettings = subscribeProtocolSettingsChanges(({ changedKeys }) => {
            const cycleSettingsChanged = changedKeys.includes(CYCLE_SETTINGS_KEY);
            const projections = cycleSettingsChanged || changedKeys.some((key) => CYCLE_POLICY_KEYS.has(key))
                ? ANALYSIS_PROJECTIONS
                : changedKeys.some((key) => STATUS_POLICY_KEYS.has(key)) ? ['status', 'sites'] : [];
            if (!projections.length) return;
            beginAnalysisRead(projections);
            useAnalysisStore.getState().invalidateAnalysisProjections({ projections, force: true });
        });
    }
    if (statsRealtimeBridgeAttached) return;
    statsRealtimeBridgeListener = handleStatsRealtimeMessage;
    statsRealtimeBridgeAttached = runtimeOnMessageAddListener(statsRealtimeBridgeListener);
    if (!statsRealtimeBridgeAttached) {
        statsRealtimeBridgeListener = null;
    }
}

function detachStatsRealtimeBridge() {
    unsubscribeAnalysisSettings?.();
    unsubscribeAnalysisSettings = null;
    if (statsRealtimeBridgeListener) {
        runtimeOnMessageRemoveListener(statsRealtimeBridgeListener);
    }
    statsRealtimeBridgeListener = null;
    statsRealtimeBridgeAttached = false;
}

function normalizeCycleState(value) {
    if (!value || typeof value !== 'object') return null;
    return value;
}

function normalizeCycleSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    return value;
}

function normalizeSitesSnapshot(value) {
    if (!value || typeof value !== 'object') return null;
    return value;
}

function normalizeAnalysisError(value, fallbackCode = 'ANALYSIS_REFRESH_FAILED') {
    if (!value) return null;
    if (typeof value === 'object') {
        return {
            code: typeof value.code === 'string' && value.code ? value.code : fallbackCode,
            message: typeof value.message === 'string' && value.message ? value.message : fallbackCode,
        };
    }
    return {
        code: fallbackCode,
        message: String(value),
    };
}

function normalizeCycleMutationError(response, fallbackCode, invalidResponseCode) {
    if (response && response.success === false) {
        return normalizeAnalysisError(response.error, fallbackCode);
    }
    return normalizeAnalysisError({
        code: invalidResponseCode,
        message: invalidResponseCode,
    }, fallbackCode);
}

function buildAnalysisStatePatch(analysis) {
    const patch = {};
    if (analysis && Object.prototype.hasOwnProperty.call(analysis, 'cycleState')) {
        patch.cycleState = normalizeCycleState(analysis.cycleState);
    }
    if (analysis && Object.prototype.hasOwnProperty.call(analysis, 'cycleSnapshot')) {
        patch.cycleSnapshot = normalizeCycleSnapshot(analysis.cycleSnapshot);
    }
    if (analysis && Object.prototype.hasOwnProperty.call(analysis, 'statusSnapshot')) {
        // Response and prewarm transports validate this DTO before the state patch.
        // Preserve the admitted reference instead of repeating an O(N) recursive walk.
        patch.statusSnapshot = analysis.statusSnapshot;
    }
    if (analysis && Object.prototype.hasOwnProperty.call(analysis, 'sitesSnapshot')) {
        patch.sitesSnapshot = normalizeSitesSnapshot(analysis.sitesSnapshot);
    }
    return patch;
}

function markStatusSnapshotRefresh({
    now = Date.now(),
    reason = ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
} = {}) {
    clearStatusSnapshotTrailingRefresh();
    statusSnapshotRefreshState = markAnalysisProjectionRefreshed(statusSnapshotRefreshState, {
        now,
        reason,
    });
}

export const useAnalysisStore = create((set, get) => ({
    // --- State ---
    cycleState: null,
    cycleSnapshot: null,
    statusSnapshot: null,
    sitesSnapshot: null,
    cycleLoaded: false,
    statusLoaded: false,
    sitesLoaded: false,
    cycleSnapshotStale: true,
    statusSnapshotStale: true,
    sitesSnapshotStale: true,
    cycleError: null,
    statusError: null,
    sitesError: null,
    analysisError: null,
    loaded: false,

    // --- Actions ---

    subscribeProjectionDemand: (projections) => {
        if (!Array.isArray(projections) || projections.some((key) => !ANALYSIS_PROJECTIONS.includes(key))) {
            throw new Error('ANALYSIS_PROJECTION_DEMAND_INVALID');
        }
        const token = Symbol('analysis-projection-demand');
        projectionDemand.set(token, [...new Set(projections)]);
        if (get().loaded && !initializePromise) {
            get().refreshDemandedAnalysis({ force: true });
        }
        return () => {
            projectionDemand.delete(token);
            if (!hasProjectionDemand('cycle')) clearCycleProjectionTrailingRefresh();
            if (!hasProjectionDemand('status')) clearStatusSnapshotTrailingRefresh();
        };
    },

    refreshDemandedAnalysis: ({
        force = false,
        refreshReason = ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED,
    } = {}) => {
        if (!get().loaded || initializePromise) return;
        if (hasProjectionDemand('cycle') && get().cycleSnapshotStale) {
            void get().refreshCycleProjection({ demandOnly: true, force, throttle: !force, refreshReason });
        }
        if (hasProjectionDemand('status') && get().statusSnapshotStale) {
            void get().refreshStatusSnapshot({ demandOnly: true, force, throttle: !force, refreshReason });
        }
        // Sites owns its coalescing timer and selected-detail resource admission.
    },

    invalidateAnalysisProjections: ({
        projections = ANALYSIS_PROJECTIONS,
        force = false,
        refresh = true,
        refreshReason = ANALYSIS_PROJECTION_REFRESH_REASON.POLICY_CHANGE,
    } = {}) => {
        if (!Array.isArray(projections) || projections.some((key) => !ANALYSIS_PROJECTIONS.includes(key))) {
            throw new Error('ANALYSIS_PROJECTION_INVALIDATION_INVALID');
        }
        const patch = {};
        for (const projection of projections) {
            projectionInvalidations[projection] += 1;
            patch[`${projection}SnapshotStale`] = true;
        }
        set(patch);
        if (refresh) get().refreshDemandedAnalysis({ force, refreshReason });
    },

    /**
     * Complete initialization of all analysis data
     */
    initialize: async (bootContext = null) => {
        attachStatsRealtimeBridge();
        if (get().loaded) return;
        if (initializePromise) return initializePromise;

        initializePromise = (async () => {
            const prewarm = resolveBootPrewarmSection(bootContext, 'analysis');
            const awaitFreshStatusSnapshot = bootContext?.awaitFreshStatusSnapshot === true;
            const hasPrewarmCycle = !!(prewarm && Object.prototype.hasOwnProperty.call(prewarm, 'cycleState'));
            const hasPrewarmCycleSnapshot = prewarm && Object.prototype.hasOwnProperty.call(prewarm, 'cycleSnapshot');
            const hasPrewarmStatusSnapshot = prewarm && Object.prototype.hasOwnProperty.call(prewarm, 'statusSnapshot');
            const hasPrewarmSitesSnapshot = prewarm && Object.prototype.hasOwnProperty.call(prewarm, 'sitesSnapshot');

            if (hasPrewarmCycle || hasPrewarmCycleSnapshot || hasPrewarmStatusSnapshot || hasPrewarmSitesSnapshot) {
                if (hasPrewarmCycleSnapshot) markCycleProjectionRefresh(ANALYSIS_PROJECTION_REFRESH_REASON.BOOTSTRAP);
                commitAnalysisPatch(set, get, {
                    ...buildAnalysisStatePatch(prewarm),
                    ...(hasPrewarmCycleSnapshot ? { cycleLoaded: true, cycleError: null, cycleSnapshotStale: false } : null),
                    ...(hasPrewarmStatusSnapshot ? { statusLoaded: true, statusError: null, statusSnapshotStale: false } : null),
                    ...(hasPrewarmSitesSnapshot ? { sitesLoaded: true, sitesError: null, sitesSnapshotStale: false } : null),
                });
            }

            if (
                hasPrewarmCycle
                && hasPrewarmCycleSnapshot
                && hasPrewarmStatusSnapshot
            ) {
                if (awaitFreshStatusSnapshot) {
                    await get().refreshStatusSnapshot({
                        force: true,
                        throttle: false,
                        refreshReason: ANALYSIS_PROJECTION_REFRESH_REASON.BOOTSTRAP,
                    });
                    set({ loaded: true });
                    return;
                }

                set({ loaded: true });
                queueMicrotask(() => {
                    void get().refreshAnalysisSnapshot({ includeSitesSnapshot: false });
                });
                return;
            }

            await get().refreshAnalysisSnapshot({ includeSitesSnapshot: false });
            set({ loaded: true });
        })()
            .catch((error) => {
                console.error('[AnalysisStore] Failed to initialize:', error);
                const failure = normalizeAnalysisError(error, 'ANALYSIS_INITIALIZE_FAILED');
                commitAnalysisPatch(set, get, {
                    cycleError: failure,
                    statusError: failure,
                    loaded: true,
                });
            })
            .finally(() => {
                initializePromise = null;
                get().refreshDemandedAnalysis({ force: true });
            });

        return initializePromise;
    },

    refreshAnalysisSnapshot: async ({
        daysBack = STATS_DAYS_BACK,
        policyInput = null,
        includeSitesSnapshot = false,
    } = {}) => {
        const projections = includeSitesSnapshot ? ANALYSIS_PROJECTIONS : ['cycle', 'status'];
        const context = beginAnalysisRead(projections);
        try {
            const payload = {
                action: MESSAGE_ACTIONS.GET_ANALYSIS_BOOTSTRAP_SNAPSHOT,
                daysBack,
                includeSitesSnapshot: includeSitesSnapshot === true,
            };
            if (policyInput && typeof policyInput === 'object') {
                payload.policyInput = policyInput;
            }
            const resp = await runtimeSendMessage(payload);
            if (resp?.success && resp?.analysis) {
                const analysis = requireBootstrapAnalysisPayload(resp, { includeSitesSnapshot });
                const patch = {};
                for (const projection of projections) {
                    if (!isCurrentAnalysisRead(context, projection)) continue;
                    patch[`${projection}Snapshot`] = analysis[`${projection}Snapshot`];
                    patch[`${projection}Loaded`] = true;
                    patch[`${projection}Error`] = null;
                    patch[`${projection}SnapshotStale`] = !isAnalysisReadFresh(context, projection);
                    if (projection === 'cycle') {
                        patch.cycleState = normalizeCycleState(analysis.cycleState);
                        markCycleProjectionRefresh(ANALYSIS_PROJECTION_REFRESH_REASON.BOOTSTRAP);
                    }
                    if (projection === 'status') markStatusSnapshotRefresh({ reason: ANALYSIS_PROJECTION_REFRESH_REASON.BOOTSTRAP });
                }
                if (!Object.keys(patch).length) return false;
                commitAnalysisPatch(set, get, patch);
                return projections.every((projection) => isCurrentAnalysisRead(context, projection));
            } else if (resp && resp.success === false) {
                throw normalizeAnalysisError(resp.error, 'ANALYSIS_BOOTSTRAP_FAILED');
            } else {
                throw createAnalysisResponseError('ANALYSIS_BOOTSTRAP_RESPONSE_INVALID');
            }
        } catch (error) {
            console.error('[AnalysisStore] Failed to refresh analysis snapshot:', error);
            const patch = {};
            for (const projection of projections) {
                if (isCurrentAnalysisRead(context, projection)) {
                    patch[`${projection}Error`] = normalizeAnalysisError(error, 'ANALYSIS_BOOTSTRAP_FAILED');
                }
            }
            if (Object.keys(patch).length) commitAnalysisPatch(set, get, patch);
            return false;
        }
    },

    /**
     * Refresh the current cycle context (wake up time, current phase, etc.)
     */
    refreshCycleProjection: async ({
        policyInput = null,
        demandOnly = false,
        force = false,
        throttle = false,
        refreshReason = ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
    } = {}) => {
        if (demandOnly && !hasProjectionDemand('cycle')) return false;
        const refreshDecision = resolveAnalysisProjectionRefreshDecision(cycleProjectionRefreshState, {
            force,
            throttle,
            reason: refreshReason,
        });
        if (!refreshDecision.shouldRefresh) {
            cycleProjectionRefreshState = markAnalysisProjectionRefreshDeferred(cycleProjectionRefreshState, refreshDecision);
            scheduleCycleProjectionTrailingRefresh(refreshDecision);
            return false;
        }
        if (cycleProjectionRefreshInFlight) {
            if (
                !force
                && throttle
                && refreshReason === ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED
                && !policyInput
            ) return cycleProjectionRefreshInFlight;
            cycleProjectionRefreshQueued = true;
            cycleProjectionRefreshQueuedDemandOnly = cycleProjectionRefreshQueuedDemandOnly && demandOnly;
            cycleProjectionRefreshQueuedForce = cycleProjectionRefreshQueuedForce || force;
            cycleProjectionRefreshQueuedPolicyInput = policyInput || cycleProjectionRefreshQueuedPolicyInput || null;
            return cycleProjectionRefreshInFlight;
        }

        const context = beginAnalysisRead(['cycle']);
        cycleProjectionRefreshInFlight = (async () => {
            try {
                const payload = { action: MESSAGE_ACTIONS.GET_CYCLE_PROJECTION };
                if (policyInput && typeof policyInput === 'object') {
                    payload.policyInput = policyInput;
                }
                const resp = await runtimeSendMessage(payload);
                if (!isCurrentAnalysisRead(context, 'cycle')) return false;
                if (resp?.success) {
                    const projection = requireCycleProjectionPayload(resp);
                    markCycleProjectionRefresh(refreshReason);
                    commitAnalysisPatch(set, get, {
                        cycleState: normalizeCycleState(projection.cycleState),
                        cycleSnapshot: projection.cycleSnapshot,
                        cycleLoaded: true,
                        cycleSnapshotStale: !isAnalysisReadFresh(context, 'cycle'),
                        cycleError: null,
                    });
                    if (get().cycleSnapshotStale) {
                        scheduleCycleProjectionTrailingRefresh(resolveAnalysisProjectionRefreshDecision(
                            cycleProjectionRefreshState,
                            { throttle: true, reason: ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED },
                        ));
                    }
                    return true;
                } else if (resp && resp.success === false) {
                    commitAnalysisPatch(set, get, { cycleError: normalizeAnalysisError(resp.error, 'CYCLE_PROJECTION_FAILED') });
                } else {
                    throw createAnalysisResponseError('CYCLE_PROJECTION_RESPONSE_INVALID');
                }
            } catch (error) {
                if (!isCurrentAnalysisRead(context, 'cycle')) return false;
                console.error('[AnalysisStore] Failed to refresh cycle projection:', error);
                commitAnalysisPatch(set, get, { cycleError: normalizeAnalysisError(error, 'CYCLE_PROJECTION_FAILED') });
            } finally {
                cycleProjectionRefreshInFlight = null;
                if (cycleProjectionRefreshQueued) {
                    const nextPolicyInput = cycleProjectionRefreshQueuedPolicyInput;
                    const nextDemandOnly = cycleProjectionRefreshQueuedDemandOnly;
                    const nextForce = cycleProjectionRefreshQueuedForce;
                    cycleProjectionRefreshQueued = false;
                    cycleProjectionRefreshQueuedPolicyInput = null;
                    cycleProjectionRefreshQueuedDemandOnly = true;
                    cycleProjectionRefreshQueuedForce = false;
                    await get().refreshCycleProjection({ policyInput: nextPolicyInput, demandOnly: nextDemandOnly, force: nextForce });
                }
            }
        })();

        return cycleProjectionRefreshInFlight;
    },

    refreshCycle: async () => {
        await get().refreshCycleProjection();
    },

    refreshStatusSnapshot: async ({
        policyInput = null,
        force = false,
        throttle = false,
        refreshReason = ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT,
        demandOnly = false,
    } = {}) => {
        if (demandOnly && !hasProjectionDemand('status')) return false;
        const refreshDecision = resolveAnalysisProjectionRefreshDecision(statusSnapshotRefreshState, {
            force,
            throttle,
            reason: refreshReason,
        });
        if (!refreshDecision.shouldRefresh) {
            statusSnapshotRefreshState = markAnalysisProjectionRefreshDeferred(
                statusSnapshotRefreshState,
                refreshDecision,
            );
            scheduleStatusSnapshotTrailingRefresh(refreshDecision);
            return false;
        }
        if (statusSnapshotRefreshInFlight) {
            if (
                force === true
                || throttle !== true
                || refreshReason !== ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED
                || policyInput
            ) {
                statusSnapshotRefreshQueued = true;
                statusSnapshotRefreshQueuedDemandOnly = statusSnapshotRefreshQueuedDemandOnly && demandOnly;
                statusSnapshotRefreshQueuedPolicyInput = policyInput || statusSnapshotRefreshQueuedPolicyInput || null;
                statusSnapshotRefreshQueuedForce = statusSnapshotRefreshQueuedForce || force === true;
                statusSnapshotRefreshQueuedReason = force === true || !statusSnapshotRefreshQueuedReason
                    ? refreshReason || ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT
                    : statusSnapshotRefreshQueuedReason;
            }
            return statusSnapshotRefreshInFlight;
        }

        const context = beginAnalysisRead(['status']);
        statusSnapshotRefreshInFlight = (async () => {
            try {
                const payload = { action: MESSAGE_ACTIONS.GET_STATUS_SNAPSHOT };
                if (policyInput && typeof policyInput === 'object') {
                    payload.policyInput = policyInput;
                }
                const resp = await runtimeSendMessage(payload);
                if (!isCurrentAnalysisRead(context, 'status')) return false;
                if (resp?.success) {
                    const snapshot = requireStatusSnapshotPayload(resp);
                    if (Object.prototype.hasOwnProperty.call(snapshot, 'statusSnapshot')) {
                        markStatusSnapshotRefresh({ reason: refreshReason });
                    }
                    commitAnalysisPatch(set, get, {
                        statusSnapshot: snapshot.statusSnapshot,
                        statusLoaded: true,
                        statusSnapshotStale: !isAnalysisReadFresh(context, 'status'),
                        statusError: null,
                    });
                    if (get().statusSnapshotStale) {
                        scheduleStatusSnapshotTrailingRefresh(resolveAnalysisProjectionRefreshDecision(
                            statusSnapshotRefreshState,
                            { throttle: true, reason: ANALYSIS_PROJECTION_REFRESH_REASON.STATS_COMMITTED },
                        ));
                    }
                    return true;
                } else if (resp && resp.success === false) {
                    commitAnalysisPatch(set, get, { statusError: normalizeAnalysisError(resp.error, 'STATUS_SNAPSHOT_FAILED') });
                } else {
                    throw createAnalysisResponseError('STATUS_SNAPSHOT_RESPONSE_INVALID');
                }
            } catch (error) {
                if (!isCurrentAnalysisRead(context, 'status')) return false;
                console.error('[AnalysisStore] Failed to refresh status snapshot:', error);
                commitAnalysisPatch(set, get, { statusError: normalizeAnalysisError(error, 'STATUS_SNAPSHOT_FAILED') });
            } finally {
                statusSnapshotRefreshInFlight = null;
                if (statusSnapshotRefreshQueued) {
                    const nextPolicyInput = statusSnapshotRefreshQueuedPolicyInput;
                    const nextForce = statusSnapshotRefreshQueuedForce;
                    const nextReason = statusSnapshotRefreshQueuedReason || ANALYSIS_PROJECTION_REFRESH_REASON.EXPLICIT;
                    const nextDemandOnly = statusSnapshotRefreshQueuedDemandOnly;
                    statusSnapshotRefreshQueued = false;
                    statusSnapshotRefreshQueuedPolicyInput = null;
                    statusSnapshotRefreshQueuedForce = false;
                    statusSnapshotRefreshQueuedReason = null;
                    statusSnapshotRefreshQueuedDemandOnly = true;
                    await get().refreshStatusSnapshot({
                        policyInput: nextPolicyInput,
                        force: nextForce,
                        refreshReason: nextReason,
                        demandOnly: nextDemandOnly,
                    });
                }
            }
        })();

        return statusSnapshotRefreshInFlight;
    },

    refreshSitesSnapshot: async ({ policyInput = null } = {}) => {
        if (sitesSnapshotRefreshInFlight) {
            sitesSnapshotRefreshQueued = true;
            sitesSnapshotRefreshQueuedPolicyInput = policyInput || sitesSnapshotRefreshQueuedPolicyInput || null;
            return sitesSnapshotRefreshInFlight;
        }

        const context = beginAnalysisRead(['sites']);
        sitesSnapshotRefreshInFlight = (async () => {
            try {
                const payload = { action: MESSAGE_ACTIONS.GET_SITES_SNAPSHOT };
                if (policyInput && typeof policyInput === 'object') {
                    payload.policyInput = policyInput;
                }
                const resp = await runtimeSendMessage(payload);
                if (!isCurrentAnalysisRead(context, 'sites')) return sitesReadSupersessionReceipt(context);
                if (resp?.success) {
                    const snapshot = requireSitesSnapshotPayload(resp);
                    commitAnalysisPatch(set, get, {
                        sitesSnapshot: snapshot.sitesSnapshot,
                        sitesSnapshotStale: !isAnalysisReadFresh(context, 'sites'),
                        sitesLoaded: true,
                        sitesError: null,
                    });
                    return true;
                } else if (resp && resp.success === false) {
                    commitAnalysisPatch(set, get, { sitesError: normalizeAnalysisError(resp.error, 'SITES_SNAPSHOT_FAILED') });
                } else {
                    throw createAnalysisResponseError('SITES_SNAPSHOT_RESPONSE_INVALID');
                }
            } catch (error) {
                if (!isCurrentAnalysisRead(context, 'sites')) return sitesReadSupersessionReceipt(context);
                console.error('[AnalysisStore] Failed to refresh Sites snapshot:', error);
                commitAnalysisPatch(set, get, { sitesError: normalizeAnalysisError(error, 'SITES_SNAPSHOT_FAILED') });
            } finally {
                sitesSnapshotRefreshInFlight = null;
                if (sitesSnapshotRefreshQueued) {
                    const nextPolicyInput = sitesSnapshotRefreshQueuedPolicyInput;
                    sitesSnapshotRefreshQueued = false;
                    sitesSnapshotRefreshQueuedPolicyInput = null;
                    await get().refreshSitesSnapshot({ policyInput: nextPolicyInput });
                }
            }
        })();

        return sitesSnapshotRefreshInFlight;
    },

    setResetHour: async (hour) => {
        try {
            const response = await runtimeSendMessage({
                action: MESSAGE_ACTIONS.SET_RESET_HOUR,
                hour,
            });
            if (response?.success && response?.cycleState) {
                beginAnalysisRead(ANALYSIS_PROJECTIONS);
                commitAnalysisPatch(set, get, { cycleState: normalizeCycleState(response.cycleState), cycleError: null });
                get().invalidateAnalysisProjections({ refresh: false });
                await get().refreshCycleProjection();
                get().refreshDemandedAnalysis({ force: true });
                return true;
            }
            commitAnalysisPatch(set, get, {
                cycleError: normalizeCycleMutationError(
                    response,
                    'SET_RESET_HOUR_FAILED',
                    'SET_RESET_HOUR_CYCLE_STATE_INVALID',
                ),
            });
            return false;
        } catch (error) {
            console.error('[AnalysisStore] Failed to set reset hour:', error);
            commitAnalysisPatch(set, get, { cycleError: normalizeAnalysisError(error, 'SET_RESET_HOUR_FAILED') });
            return false;
        }
    },

    acceptResetRecommendation: async () => {
        try {
            const response = await runtimeSendMessage({
                action: MESSAGE_ACTIONS.ACCEPT_RESET_RECOMMENDATION,
            });
            if (response?.success && response?.cycleState) {
                beginAnalysisRead(ANALYSIS_PROJECTIONS);
                commitAnalysisPatch(set, get, { cycleState: normalizeCycleState(response.cycleState), cycleError: null });
                get().invalidateAnalysisProjections({ refresh: false });
                await get().refreshCycleProjection();
                get().refreshDemandedAnalysis({ force: true });
                return true;
            }
            commitAnalysisPatch(set, get, {
                cycleError: normalizeCycleMutationError(
                    response,
                    'ACCEPT_RESET_RECOMMENDATION_FAILED',
                    'ACCEPT_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
                ),
            });
            return false;
        } catch (error) {
            console.error('[AnalysisStore] Failed to accept reset recommendation:', error);
            commitAnalysisPatch(set, get, { cycleError: normalizeAnalysisError(error, 'ACCEPT_RESET_RECOMMENDATION_FAILED') });
            return false;
        }
    },

    dismissResetRecommendation: async () => {
        try {
            const response = await runtimeSendMessage({
                action: MESSAGE_ACTIONS.DISMISS_RESET_RECOMMENDATION,
            });
            if (response?.success && response?.cycleState) {
                beginAnalysisRead(ANALYSIS_PROJECTIONS);
                commitAnalysisPatch(set, get, { cycleState: normalizeCycleState(response.cycleState), cycleError: null });
                get().invalidateAnalysisProjections({ refresh: false });
                await get().refreshCycleProjection();
                get().refreshDemandedAnalysis({ force: true });
                return true;
            }
            commitAnalysisPatch(set, get, {
                cycleError: normalizeCycleMutationError(
                    response,
                    'DISMISS_RESET_RECOMMENDATION_FAILED',
                    'DISMISS_RESET_RECOMMENDATION_CYCLE_STATE_INVALID',
                ),
            });
            return false;
        } catch (error) {
            console.error('[AnalysisStore] Failed to dismiss reset recommendation:', error);
            commitAnalysisPatch(set, get, { cycleError: normalizeAnalysisError(error, 'DISMISS_RESET_RECOMMENDATION_FAILED') });
            return false;
        }
    },
}));

const selectCycleSlice = (state) => ({
    cycleState: state.cycleState,
    cycleSnapshot: state.cycleSnapshot,
    analysisError: state.cycleError,
    cycleError: state.cycleError,
    loaded: state.cycleLoaded,
    refreshCycle: state.refreshCycle,
    refreshCycleProjection: state.refreshCycleProjection,
    setResetHour: state.setResetHour,
    acceptResetRecommendation: state.acceptResetRecommendation,
    dismissResetRecommendation: state.dismissResetRecommendation,
});

const selectStatusSlice = (state) => ({
    statusSnapshot: state.statusSnapshot,
    analysisError: state.statusError,
    refreshStatusSnapshot: state.refreshStatusSnapshot,
});

const selectSitesSlice = (state) => ({
    sitesSnapshot: state.sitesSnapshot,
    sitesSnapshotStale: state.sitesSnapshotStale,
    analysisError: state.sitesError,
    refreshSitesSnapshot: state.refreshSitesSnapshot,
});

const selectAnalysisErrorSlice = (state) => ({
    analysisError: state.analysisError,
});

// Named exports for consistency with the rest of the app
export const useCycle = () => useAnalysisStore(useShallow(selectCycleSlice));
export const useStatusSnapshot = () => useAnalysisStore(useShallow(selectStatusSlice));
export const useSitesSnapshot = () => useAnalysisStore(useShallow(selectSitesSlice));
export const useAnalysisError = () => useAnalysisStore(useShallow(selectAnalysisErrorSlice));
export const useAnalysis = () => useAnalysisStore();

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        detachStatsRealtimeBridge();
        initializePromise = null;
        analysisReadSequence += 1;
        for (const projection of ANALYSIS_PROJECTIONS) projectionReadSequences[projection] = analysisReadSequence;
        projectionDemand.clear();
        cycleProjectionRefreshInFlight = null;
        cycleProjectionRefreshQueued = false;
        cycleProjectionRefreshQueuedPolicyInput = null;
        clearCycleProjectionTrailingRefresh();
        statusSnapshotRefreshInFlight = null;
        statusSnapshotRefreshQueued = false;
        statusSnapshotRefreshQueuedPolicyInput = null;
        statusSnapshotRefreshQueuedForce = false;
        statusSnapshotRefreshQueuedReason = null;
        clearStatusSnapshotTrailingRefresh();
        sitesSnapshotRefreshInFlight = null;
        sitesSnapshotRefreshQueued = false;
        sitesSnapshotRefreshQueuedPolicyInput = null;
    });
}
