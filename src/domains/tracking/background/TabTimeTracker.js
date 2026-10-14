import { createTrackingProfileMutationRuntime } from './trackingProfileMutationRuntime.js';
import { getHostname } from '../../../lib/index.js';
/**
 * TabTimeTracker
 *
 * 탭별 시간 추적, 세션 관리, 활성 탭 상태 관리를 담당합니다.
 * tracking runtime owner들을 조립하는 facade입니다.
 */

import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import { TrackingConsumptionRepository } from '../../../platform/storage/runtime/TrackingConsumptionRepository.js';
import { createTrackingConsumptionLedger } from './TrackingConsumptionLedger.js';
import { createTrackingConsumptionScopeReader } from './trackingConsumptionScope.js';
import {
    createTrackingActiveTabRuntimeState,
} from './trackingActiveTabRuntimeState.js';
import {
    createTrackingDomainSessionRuntimeState,
} from './trackingDomainSessionRuntimeState.js';
import {
    createTrackingDomainSessionCollectionAdmission,
} from './trackingDomainSessionCollectionAdmission.js';
import {
    createTrackingProfileMutationAdmissionOwner,
} from './trackingProfileMutationAdmission.js';
import { TRACKING_DOMAIN_SESSION_PHASES } from './trackingDomainSessionCheckpoint.js';
import {
    createTrackingStatsSettlement,
} from './trackingStatsSettlement.js';
import {
    createTrackingIdleLifecycle,
} from './trackingIdleLifecycle.js';
import {
    createTrackingPrecisionSignalRecorder,
} from './trackingPrecisionSignalRecorder.js';
import {
    getSiteCategory,
    resolveStatsCategoryIdFromModeState,
    resolveTimedFilteringMode,
    shouldTrackHostname,
} from './trackingScopePolicy.js';

const SESSION_ACTIVE_TAB_KEY = STORAGE_SESSION_KEYS.ACTIVE_TAB;
const SESSION_DOMAIN_SESSION_KEY = STORAGE_SESSION_KEYS.DOMAIN_SESSION;
export { SITE_CATEGORY } from './trackingScopePolicy.js';

function requireTabTimeTrackerOwner(owner, errorCode) {
    if (typeof owner !== 'function') {
        const error = new Error(errorCode);
        error.code = errorCode;
        throw error;
    }
    return owner;
}

export function createTabTimeTracker({
    settingsService,
    sessionStore,
    idleDetector,
    browserPort,
    statsCollector,
    statsRuntimeHealthLedger,
    recordManagedProtectedVisit,
    consumptionMemoryService,
} = {}) {
    for (const method of ['initialize', 'observe', 'getSnapshot', 'reset', 'discard', 'recordFailure', 'captureAdmission']) {
        requireTabTimeTrackerOwner(consumptionMemoryService?.[method], 'TAB_TIME_TRACKER_CONSUMPTION_MEMORY_OWNER_REQUIRED');
    }
    requireTabTimeTrackerOwner(settingsService?.getSettingsChangeVersion, 'TAB_TIME_TRACKER_SETTINGS_VERSION_REQUIRED');
    if (!settingsService || typeof settingsService.ensureSettingsCache !== 'function') {
        throw new Error('TAB_TIME_TRACKER_SETTINGS_SERVICE_REQUIRED');
    }
    if (
        !sessionStore
        || typeof sessionStore.get !== 'function'
        || typeof sessionStore.readOptional !== 'function'
        || typeof sessionStore.set !== 'function'
        || typeof sessionStore.remove !== 'function'
    ) {
        throw new Error('TAB_TIME_TRACKER_SESSION_STORE_REQUIRED');
    }
    if (
        !statsCollector
        || typeof statsCollector.collectBatch !== 'function'
        || typeof statsCollector.ensureDomainTrackingState !== 'function'
        || typeof statsCollector.touchDomainTrackPoint !== 'function'
        || typeof statsCollector.recordDomainElapsed !== 'function'
        || typeof statsCollector.recordDomainVisit !== 'function'
        || typeof statsCollector.recordDaySwitch !== 'function'
        || typeof statsCollector.recordDaySession !== 'function'
        || typeof statsCollector.recordDomainNavigationIntent !== 'function'
        || typeof statsCollector.recordDomainTabContext !== 'function'
        || typeof statsCollector.recordDomainContentFlow !== 'function'
    ) {
        throw new Error('TAB_TIME_TRACKER_STATS_COLLECTOR_REQUIRED');
    }
    if (!idleDetector || typeof idleDetector.getIdleState !== 'function'
        || typeof idleDetector.getCurrentIdleState !== 'function' || typeof idleDetector.isActive !== 'function') {
        throw new Error('TAB_TIME_TRACKER_IDLE_DETECTOR_REQUIRED');
    }
    if (!browserPort || typeof browserPort.tabsQuery !== 'function' || typeof browserPort.getRuntimeId !== 'function') {
        throw new Error('TAB_TIME_TRACKER_BROWSER_PORT_REQUIRED');
    }
    if (!statsRuntimeHealthLedger || typeof statsRuntimeHealthLedger.recordActiveSealDiagnostic !== 'function') {
        throw new Error('TAB_TIME_TRACKER_RUNTIME_HEALTH_REQUIRED');
    }
    const profileMutationAdmissionOwner = createTrackingProfileMutationAdmissionOwner();
    const consumptionLedger = createTrackingConsumptionLedger({
        repository: new TrackingConsumptionRepository({ sessionRepository: sessionStore }),
        profileMutationAdmissionOwner,
    });
    const resolveConsumptionScope = createTrackingConsumptionScopeReader({ sessionStore });
    const activeTabRuntimeState = createTrackingActiveTabRuntimeState({
        sessionStore,
        sessionActiveTabKey: SESSION_ACTIVE_TAB_KEY,
        idleDetector,
        queryTabs: browserPort.tabsQuery,
        windowIdNone: browserPort.windowIdNone,
        profileMutationAdmissionOwner,
    });
    const { setActiveTabSegmentStartedAt } = activeTabRuntimeState;
    const domainSessionRuntimeState = createTrackingDomainSessionRuntimeState({
        sessionStore,
        sessionDomainSessionKey: SESSION_DOMAIN_SESSION_KEY,
        profileMutationAdmissionOwner,
    });

    let recordActiveTabDurationRef = null;
    let recordSessionDurationRef = null;
    const domainSessionCollectionAdmission = createTrackingDomainSessionCollectionAdmission({
        settingsService,
        domainSessionRuntimeState,
        shouldTrackHostname,
        recordSessionDuration: (sessionCommit, options) => {
            const recordSessionDurationOwner = requireTabTimeTrackerOwner(
                recordSessionDurationRef,
                'TAB_TIME_TRACKER_SESSION_DURATION_OWNER_REQUIRED',
            );
            return recordSessionDurationOwner(sessionCommit, options);
        },
    });

    const {
        getActiveTabInfo,
        getLastActiveTabId,
        getFocusedWindowId,
        setFocusedWindowId,
        getTabEntryTime,
        setTabEntryTime,
        deleteTabEntryTime,
        setTabLastActiveAt,
        deleteTabLastActiveAt,
        getTabLastActiveAt,
        rememberLastDomainUrl,
        updateDomainCache,
        getDomainCache,
        getLastDomainUrl,
        persistActiveTabInfo,
        getActiveTabAudible,
        buildBackgroundContext,
        checkAndResetEntryTime,
        handleTabClosed,
    } = activeTabRuntimeState;

    async function init() {
        await activeTabRuntimeState.init();
        await domainSessionRuntimeState.init();
    }

    async function startActiveSession(hostname, now) {
        if (!hostname || !Number.isFinite(now)) return;
        const settingsCache = settingsService.getSettingsCache();
        if (!shouldTrackHostname(hostname, settingsCache)) return;
        return domainSessionRuntimeState.startActiveSession(hostname, now);
    }

    async function finalizeActiveSession(now, { skipCacheLoad = false, dateStr = null } = {}) {
        return domainSessionCollectionAdmission.finalizeActiveSession(now, {
            skipCacheLoad,
            dateStr,
        });
    }

    async function replayPendingSessionCommit({ skipCacheLoad = false } = {}) {
        return domainSessionCollectionAdmission.replayPendingSessionCommit({
            skipCacheLoad,
        });
    }

    const precisionSignalRecorder = createTrackingPrecisionSignalRecorder({
        settingsService,
        statsCollector,
        shouldTrackHostname,
    });

    function getDomainSessionCursor() {
        return domainSessionRuntimeState.getSessionCursor();
    }

    function getActiveSessionElapsedMs(hostname, now = Date.now()) {
        const observedAt = Number(now);
        if (!Number.isSafeInteger(observedAt) || observedAt < 0) {
            throw new Error('TAB_TIME_TRACKER_SESSION_OBSERVED_AT_INVALID');
        }
        const cursor = domainSessionRuntimeState.getSessionCursor();
        if (
            cursor?.phase !== TRACKING_DOMAIN_SESSION_PHASES.ACTIVE
            || cursor.hostname !== hostname
        ) {
            return 0;
        }
        return Math.max(0, observedAt - cursor.startedAt);
    }

    const trackingIdleLifecycle = createTrackingIdleLifecycle({
        activeTabRuntimeState,
        recordActiveTabDuration: (now, options) => {
            const recordActiveTabDurationOwner = requireTabTimeTrackerOwner(
                recordActiveTabDurationRef,
                'TAB_TIME_TRACKER_ACTIVE_DURATION_OWNER_REQUIRED',
            );
            return recordActiveTabDurationOwner(now, options);
        },
        finalizeActiveSession,
        startActiveSession,
    });
    const {
        onIdleStateChange,
        setActiveTabAudible,
    } = trackingIdleLifecycle;

    const trackingStatsSettlement = createTrackingStatsSettlement({
        readWindow: (windowId) => {
            const read = requireTabTimeTrackerOwner(browserPort.windowsGet, 'TRACKING_CONSUMPTION_WINDOW_PORT_REQUIRED');
            return read(windowId);
        },
        consumptionLedger,
        resolveConsumptionScope,
        settingsService,
        idleDetector,
        statsCollector,
        activeTabRuntimeState,
        domainSessionRuntimeState,
        shouldTrackHostname,
        getSiteCategory,
        resolveTimedFilteringMode,
        resolveStatsCategoryIdFromModeState,
        setActiveTabAudible,
        finalizeActiveSession,
        queryTabs: browserPort.tabsQuery,
        windowIdNone: browserPort.windowIdNone,
        getExtensionId: browserPort.getRuntimeId,
        statsRuntimeHealthLedger,
        recordManagedProtectedVisit,
    });
    const {
        calculateTabTime,
        getLastPreviousTabSettlementDiagnostic,
        getLastTabActivityBatchSummary,
        openForegroundTab,
        primeActiveTrackingBoundary,
        primeNewDayAt,
        reconcileForegroundSegmentForObservedTab,
        recordActiveTabDuration,
        recordSessionDuration,
        recordTabSwitch,
        settlePreviousTab,
        settleTabTime,
        trackAllTabsBatch: settleAllTabsBatch,
        prepareTabActivityObservation,
        settleTabActivityObservation: settlePreparedTabActivity,
        prepareRolloverTabActivityObservation,
        settleRolloverTabActivityObservation: settlePreparedRolloverActivity,
    } = trackingStatsSettlement;
    function scheduleConsumptionMemory(browserObservation, now) {
        let admission;
        try {
            admission = consumptionMemoryService.captureAdmission();
        } catch (error) {
            return { ...browserObservation, memoryCompletion: Promise.resolve(consumptionMemoryService.recordFailure(error)) };
        }
        const memoryCompletion = consumptionLedger.runAfterFacts(now, async (flow) => {
            // This lane owns its completion and profile drain; stats/protection never await it.
            if (admission.enabled) await consumptionMemoryService.initialize();
            return consumptionMemoryService.observe(flow, now, admission);
        }).catch(consumptionMemoryService.recordFailure);
        return { ...browserObservation, memoryCompletion };
    }
    async function trackAllTabsBatch(nowOverride = null, options = {}) {
        const now = typeof nowOverride === 'number' ? nowOverride : Date.now();
        return scheduleConsumptionMemory(await settleAllTabsBatch(now, options), now);
    }
    async function settleTabActivityObservation(observation, now) {
        return scheduleConsumptionMemory(await settlePreparedTabActivity(observation, now), now);
    }
    async function settleRolloverTabActivityObservation(observation, context) {
        return scheduleConsumptionMemory(await settlePreparedRolloverActivity(observation, context), context.boundaryTs);
    }
    function isConsumptionObservationCurrent(receipt) {
        const current = consumptionLedger.captureMediaObservation(settingsService.getSettingsChangeVersion());
        if (!receipt || !Number.isSafeInteger(receipt.revision) || !Number.isSafeInteger(receipt.settingsVersion)) {
            throw new Error('TRACKING_BROWSER_OBSERVATION_RECEIPT_INVALID');
        }
        return receipt.revision === current.revision && receipt.settingsVersion === current.settingsVersion;
    }
    async function readProtectedTabScope(tab, now) {
        if (!tab || typeof tab.url !== 'string' || !/^https?:\/\//u.test(tab.url)) return null;
        await settingsService.ensureSettingsCache();
        const scope = await resolveConsumptionScope({ hostname: getHostname(tab.url), now,
            settings: settingsService.getSettingsCache() });
        if (!scope || typeof scope.ok !== 'boolean' || typeof scope.isBlockedDomain !== 'boolean') {
            throw new Error('TRACKING_PROTECTED_TAB_SCOPE_INVALID');
        }
        return scope.ok ? scope.isBlockedDomain : null;
    }
    recordActiveTabDurationRef = requireTabTimeTrackerOwner(
        recordActiveTabDuration,
        'TAB_TIME_TRACKER_ACTIVE_DURATION_OWNER_REQUIRED',
    );
    recordSessionDurationRef = requireTabTimeTrackerOwner(
        recordSessionDuration,
        'TAB_TIME_TRACKER_SESSION_DURATION_OWNER_REQUIRED',
    );

    async function updateActiveTabInfo(tab, now, options = {}) {
        return openForegroundTab(tab, now, options);
    }

    async function resetState() {
        await consumptionLedger.resetAfterFacts(async () => {
            await consumptionMemoryService.reset(Date.now(), profileMutationAdmissionOwner.assertOpen);
            await activeTabRuntimeState.resetState();
            await domainSessionRuntimeState.resetState();
            await consumptionLedger.resetState();
        });
    }

    const { quiesceForProfileMutation, runTerminalProfileMutationReset } = createTrackingProfileMutationRuntime({
        profileMutationAdmissionOwner, consumptionLedger, activeTabRuntimeState, domainSessionRuntimeState, consumptionMemoryService,
    });

    return {
        getConsumptionFlowSnapshot: consumptionLedger.getSnapshot,
        getOperationalIdleState: () => idleDetector.getCurrentIdleState(),
        getConsumptionMemorySnapshot: ({ now = Date.now() } = {}) => consumptionMemoryService.getSnapshot(now),
        invalidateConsumptionMediaObservation: consumptionLedger.invalidateMediaObservation,
        buildBackgroundContext,
        calculateTabTime,
        checkAndResetEntryTime,
        deleteTabEntryTime,
        deleteTabLastActiveAt,
        finalizeActiveSession,
        getActiveSessionElapsedMs,
        getActiveTabAudible,
        getActiveTabInfo,
        getDomainCache,
        getDomainSessionCursor,
        getFocusedWindowId,
        getLastActiveTabId,
        getLastPreviousTabSettlementDiagnostic,
        getLastTabActivityBatchSummary,
        getLastDomainUrl,
        getSiteCategory,
        getTabEntryTime,
        getTabLastActiveAt,
        handleTabClosed,
        init,
        onIdleStateChange,
        openForegroundTab,
        persistActiveTabInfo,
        primeActiveTrackingBoundary,
        primeNewDayAt,
        quiesceForProfileMutation,
        reconcileForegroundSegmentForObservedTab,
        recordActiveTabDuration,
        recordContentFlow: precisionSignalRecorder.recordContentFlow,
        recordNavigationIntent: precisionSignalRecorder.recordNavigationIntent,
        recordSessionDuration,
        recordTabContext: precisionSignalRecorder.recordTabContext,
        recordTabSwitch,
        rememberLastDomainUrl,
        replayPendingSessionCommit,
        runTerminalProfileMutationReset,
        resetState,
        setActiveTabAudible,
        setActiveTabSegmentStartedAt,
        setFocusedWindowId,
        setTabEntryTime,
        setTabLastActiveAt,
        settlePreviousTab,
        settleTabTime,
        startActiveSession,
        trackAllTabsBatch,
        prepareTabActivityObservation,
        settleTabActivityObservation,
        prepareRolloverTabActivityObservation,
        settleRolloverTabActivityObservation,
        isConsumptionObservationCurrent,
        readProtectedTabScope,
        updateActiveTabInfo,
        updateDomainCache,
    };
}
