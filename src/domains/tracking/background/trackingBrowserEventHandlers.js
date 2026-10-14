import { getHostname } from '../../../lib/index.js';
import { isProtectionForegroundDispatchCancellation } from '../../protection/background/protocol/dispatch/ProtectionForegroundDispatch.js';
import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import { PRECISION_INSIGHTS_SIGNAL_IDS } from '../../settings/config/dataCollectionPolicy.js';
import {
    consumeProtectionTabUpdatedDispatchOutcome,
    isProtectionTabUpdatedDispatchOutcome,
} from '../../protection/background/protocol/dispatch/ProtectionTabUpdatedDispatchProtocol.js';
import { getAlarmName, getNudgeSweepAlarmName } from './AlarmScheduler.js';
import { createNavigationContinuityService } from './NavigationContinuityService.js';
import { createTabLifecycleEventQueue } from './TabLifecycleEventQueue.js';
import {
    readTabContextSnapshot,
} from './trackingTabContextSnapshot.js';

function warnBestEffortBrowserEventFailure(code, error) {
    console.warn('[trackingBrowserEventHandlers] best-effort browser event step failed', {
        code,
        error: error?.message || String(error || code),
    });
}

function resolveTickRuntimeService(tickRuntimeService) {
    if (
        !tickRuntimeService
        || typeof tickRuntimeService.runStatsMutationBatch !== 'function'
    ) {
        throw new Error('TRACKING_BROWSER_EVENTS_TICK_RUNTIME_SERVICE_REQUIRED');
    }
    return tickRuntimeService;
}

function requireBrowserEventOwnerMethod(owner, methodName, errorCode) {
    if (!owner || typeof owner[methodName] !== 'function') {
        throw new Error(errorCode);
    }
}

function requireBrowserEventOwnerMethods(owner, methodNames, errorCode) {
    methodNames.forEach((methodName) => requireBrowserEventOwnerMethod(owner, methodName, errorCode));
}

function requireBrowserEventSessionKey(sessionKey, errorCode) {
    if (typeof sessionKey !== 'string' || !sessionKey.trim()) {
        throw new Error(errorCode);
    }
    return sessionKey;
}

function requireBrowserEventFunction(fn, errorCode) {
    if (typeof fn !== 'function') {
        throw new Error(errorCode);
    }
    return fn;
}

function requireStatsMutationTimestamp(context) {
    const now = Number(context?.now);
    if (!Number.isSafeInteger(now) || now < 0) {
        throw new Error('TRACKING_BROWSER_EVENTS_MUTATION_TIMESTAMP_REQUIRED');
    }
    return now;
}

const TRACKING_BROWSER_EVENT_TAB_TIME_TRACKER_METHODS = [
    'checkAndResetEntryTime',
    'finalizeActiveSession',
    'getActiveTabInfo',
    'getFocusedWindowId',
    'getLastActiveTabId',
    'handleTabClosed',
    'recordActiveTabDuration',
    'recordNavigationIntent',
    'recordTabContext',
    'recordTabSwitch',
    'setActiveTabAudible',
    'setFocusedWindowId',
    'setTabEntryTime',
    'settlePreviousTab',
    'settleTabTime',
    'updateActiveTabInfo',
    'invalidateConsumptionMediaObservation',
];

const FOREGROUND_SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS = 1500;

export function createTrackingBrowserEventHandlers({
    getInitPromise,
    runProfileMutationAdmittedTask,
    captureProfileMutationRuntimeAdmission,
    runCapturedProfileMutationRuntimeTask,
    runTick,
    runNudgePendingSweep,
    clearNudgeWindowBlurTimer,
    cycleStateManager,
    TabTimeTracker,
    tickRuntimeService,
    shouldCollectBehaviorForHostname,
    shouldCollectBehaviorForActiveTab,
    recordCLSEShortDwell,
    faviconService,
    sendProtectionUpdate,
    maybeTriggerProtectionNudge,
    handleWindowBlurNudgeAbort,
    maybeDeleteHistoryForUrl,
    cleanupRecentBlockedHistory,
    runMemoryPurgeArtifactCleanup,
    sweepStaleTabs,
    recentHistorySweepWindowMs,
    nudgeWindowBlurController,
    protectionDispatcher,
    gateInterstitialController,
    noteGateActiveNavigation,
    observeGateEntryPresence,
    observeGateSitePresence,
    noteGateForegroundTab,
    noteGateForegroundBlur,
    noteGateTabClosed,
    noteFeedFlowTabNavigation,
    noteFeedFlowTabClosed,
    contentScriptOrchestrator,
    waitForSettingsPropagationIdle,
    flushTacticalLogsWrapper,
    tacticalLogger,
    browserPort,
    statsRuntimeHealthLedger,
    sessionStore,
    contentProtectionSync,
    runCLSEHeartbeat,
    ensoCadenceBridge = null,
    tabNavigationStateSessionKey = STORAGE_SESSION_KEYS.TAB_NAVIGATION_STATE,
} = {}) {
    const resolvedTacticalLogger = tacticalLogger || {
        incrementPageLoad() { },
        incrementTabSwitch() { },
    };
    const resolvedGetInitPromise = requireBrowserEventFunction(
        getInitPromise,
        'TRACKING_BROWSER_EVENTS_INIT_PROMISE_OWNER_REQUIRED',
    );
    const resolvedRunProfileMutationAdmittedTask = requireBrowserEventFunction(
        runProfileMutationAdmittedTask,
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED',
    );
    const resolvedCaptureProfileMutationRuntimeAdmission = requireBrowserEventFunction(
        captureProfileMutationRuntimeAdmission,
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_CAPTURE_REQUIRED',
    );
    const resolvedRunCapturedProfileMutationRuntimeTask = requireBrowserEventFunction(
        runCapturedProfileMutationRuntimeTask,
        'TRACKING_BROWSER_EVENTS_PROFILE_MUTATION_RUNTIME_CAPTURED_RUNNER_REQUIRED',
    );
    const resolvedTickRuntimeService = resolveTickRuntimeService(tickRuntimeService);
    requireBrowserEventOwnerMethod(
        statsRuntimeHealthLedger,
        'recordAlarmSeen',
        'TRACKING_BROWSER_EVENTS_RUNTIME_HEALTH_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        TabTimeTracker,
        TRACKING_BROWSER_EVENT_TAB_TIME_TRACKER_METHODS,
        'TRACKING_BROWSER_EVENTS_TAB_TIME_TRACKER_REQUIRED',
    );
    requireBrowserEventFunction(
        cleanupRecentBlockedHistory,
        'TRACKING_BROWSER_EVENTS_RECENT_HISTORY_CLEANUP_REQUIRED',
    );
    requireBrowserEventFunction(
        maybeDeleteHistoryForUrl,
        'TRACKING_BROWSER_EVENTS_HISTORY_DELETE_REQUIRED',
    );
    requireBrowserEventFunction(
        runMemoryPurgeArtifactCleanup,
        'TRACKING_BROWSER_EVENTS_MEMORY_PURGE_ARTIFACT_CLEANUP_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        contentScriptOrchestrator,
        ['markTabNavigated', 'refreshTabUrl', 'evictTab'],
        'TRACKING_BROWSER_EVENTS_CONTENT_SCRIPT_ORCHESTRATOR_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        contentProtectionSync,
        ['invalidateTab', 'evictTab'],
        'TRACKING_BROWSER_EVENTS_CONTENT_PROTECTION_SYNC_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        gateInterstitialController,
        ['handleTabNavigation', 'removeTabSession'],
        'TRACKING_BROWSER_EVENTS_GATE_INTERSTITIAL_CONTROLLER_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        protectionDispatcher,
        [
            'captureTabUpdatedIngress',
            'evictTab',
            'invalidateTabForRemoval',
            'isTabUpdatedIngressCurrent',
            'markTabNavigated',
            'markTabUrlChanged',
            'stopNudgeForTab',
            'terminalizeNudgesForTab',
            'revalidateNudgesForTab',
        ],
        'TRACKING_BROWSER_EVENTS_PROTECTION_DISPATCHER_REQUIRED',
    );
    const resolvedNoteGateActiveNavigation = requireBrowserEventFunction(
        noteGateActiveNavigation,
        'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedNoteGateForegroundTab = requireBrowserEventFunction(
        noteGateForegroundTab,
        'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedNoteGateForegroundBlur = requireBrowserEventFunction(
        noteGateForegroundBlur,
        'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedNoteGateTabClosed = requireBrowserEventFunction(
        noteGateTabClosed,
        'TRACKING_BROWSER_EVENTS_GATE_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedObserveGateSitePresence = requireBrowserEventFunction(
        observeGateSitePresence,
        'TRACKING_BROWSER_EVENTS_GATE_SITE_PRESENCE_OWNER_REQUIRED',
    );
    const resolvedNoteFeedFlowTabNavigation = requireBrowserEventFunction(
        noteFeedFlowTabNavigation,
        'TRACKING_BROWSER_EVENTS_FEED_FLOW_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedNoteFeedFlowTabClosed = requireBrowserEventFunction(
        noteFeedFlowTabClosed,
        'TRACKING_BROWSER_EVENTS_FEED_FLOW_RUNTIME_STATE_OWNER_REQUIRED',
    );
    const resolvedSweepStaleTabs = requireBrowserEventFunction(sweepStaleTabs, 'TRACKING_TAB_EVAPORATION_OWNER_REQUIRED');
    const resolvedWaitForSettingsPropagationIdle = requireBrowserEventFunction(
        waitForSettingsPropagationIdle,
        'TRACKING_BROWSER_EVENTS_SETTINGS_PROPAGATION_OWNER_REQUIRED',
    );
    requireBrowserEventOwnerMethods(
        browserPort,
        ['tabsGet', 'tabsQuery', 'windowsGet'],
        'TRACKING_BROWSER_EVENTS_BROWSER_PORT_REQUIRED',
    );
    if (typeof browserPort.windowIdNone !== 'number') {
        throw new Error('TRACKING_BROWSER_EVENTS_BROWSER_PORT_REQUIRED');
    }
    requireBrowserEventOwnerMethods(
        sessionStore,
        ['get', 'set'],
        'TRACKING_BROWSER_EVENTS_SESSION_STORE_REQUIRED',
    );
    const resolvedTabNavigationStateSessionKey = requireBrowserEventSessionKey(
        tabNavigationStateSessionKey,
        'TRACKING_BROWSER_EVENTS_TAB_NAVIGATION_STATE_KEY_REQUIRED',
    );
    const navigationContinuity = createNavigationContinuityService({
        sessionStore,
        sessionKey: resolvedTabNavigationStateSessionKey,
    });
    const tabLifecycleEventQueue = createTabLifecycleEventQueue();

    async function sendTabUpdatedProtectionUpdate(tabId, url, receipt, gateEntryObserved = false) {
        const entryOptions = gateEntryObserved ? { gateEntryObserved: true } : {};
        const result = receipt
            ? await sendProtectionUpdate(tabId, url, { tabUpdatedIngressReceipt: receipt, ...entryOptions })
            : gateEntryObserved ? await sendProtectionUpdate(tabId, url, entryOptions) : await sendProtectionUpdate(tabId, url);
        if (!receipt) {
            return Object.freeze({ terminal: false, result });
        }
        if (!isProtectionTabUpdatedDispatchOutcome(result)) {
            throw new Error('PROTECTION_TAB_UPDATED_DISPATCH_OUTCOME_REQUIRED');
        }
        const outcome = consumeProtectionTabUpdatedDispatchOutcome(result, { receipt });
        return Object.freeze({
            terminal: outcome.status === 'superseded',
            result: outcome.status === 'applied' ? outcome.dispatchResult : outcome,
        });
    }
    function queueBestEffortBrowserEventTask(code, task) {
        if (typeof task !== 'function') {
            warnBestEffortBrowserEventFailure(code, `${code}:TASK_UNAVAILABLE`);
            return;
        }
        void resolvedRunProfileMutationAdmittedTask({
            label: `browser_event_task:${code}`,
            task,
        })
            .catch((error) => {
                warnBestEffortBrowserEventFailure(code, error);
            });
    }

    // The return lock reads which protected sites still have a real tab after
    // any tab leaves, arrives or changes site. It reads the inventory when it
    // runs, so a queued observation is never older than the tabs it sees.
    function observeGateSitePresenceBestEffort(code) {
        queueBestEffortBrowserEventTask(code, () => resolvedObserveGateSitePresence({ now: Date.now() }));
    }

    function captureTabFaviconBestEffort(tab, code) {
        queueBestEffortBrowserEventTask(code, () => faviconService.captureTabFavicon(tab));
    }

    async function waitForForegroundSettingsPropagation(reason) {
        try {
            const result = await resolvedWaitForSettingsPropagationIdle({
                reason,
                timeoutMs: FOREGROUND_SETTINGS_PROPAGATION_WAIT_TIMEOUT_MS,
            });
            if (result?.timedOut) {
                warnBestEffortBrowserEventFailure(
                    'FOREGROUND_SETTINGS_PROPAGATION_WAIT_TIMED_OUT',
                    `${reason}:timeout`,
                );
            }
        } catch (error) {
            warnBestEffortBrowserEventFailure('FOREGROUND_SETTINGS_PROPAGATION_WAIT_FAILED', error);
        }
    }

    async function waitForInit() {
        const initPromise = resolvedGetInitPromise();
        if (initPromise) {
            if (typeof initPromise.then !== 'function') {
                throw new Error('TRACKING_BROWSER_EVENTS_INIT_PROMISE_INVALID');
            }
            await initPromise;
        }
    }

    function normalizeTimestamp(value, fallback = Date.now()) {
        const timestamp = Number(value);
        return Number.isFinite(timestamp) ? timestamp : fallback;
    }

    function normalizeTransitionType(transitionType, fallback = null) {
        return typeof transitionType === 'string' && transitionType.trim()
            ? transitionType.trim()
            : fallback;
    }

    function normalizeTransitionQualifiers(transitionQualifiers) {
        return Array.isArray(transitionQualifiers)
            ? transitionQualifiers.filter((qualifier) => typeof qualifier === 'string' && qualifier.trim())
            : [];
    }

    function triggerMemoryPurgeArtifactCleanup({
        hostname = '',
        trigger = 'SITE_EXIT',
        now = Date.now(),
    } = {}) {
        if (!hostname) return;
        queueBestEffortBrowserEventTask(
            'MEMORY_PURGE_ARTIFACT_CLEANUP_FAILED',
            () => runMemoryPurgeArtifactCleanup({ hostname, trigger, now }),
        );
    }

    async function handleAlarm(alarm) {
        const tickAlarmName = getAlarmName();
        const nudgeSweepAlarmName = getNudgeSweepAlarmName();

        if (alarm.name === tickAlarmName) {
            queueBestEffortBrowserEventTask('TICK_ALARM_HEALTH_RECORD_FAILED', () => statsRuntimeHealthLedger.recordAlarmSeen({
                alarmName: alarm.name,
                scheduledTime: alarm.scheduledTime,
            }));
            try {
                await runTick('alarm');
            } catch (error) {
                warnBestEffortBrowserEventFailure('TICK_ALARM_RUN_FAILED', error);
            }
            if (typeof runCLSEHeartbeat === 'function') {
                queueBestEffortBrowserEventTask('CLSE_HEARTBEAT_RUN_FAILED', () => runCLSEHeartbeat());
            }
            queueBestEffortBrowserEventTask(
                'RECENT_HISTORY_CLEANUP_FAILED',
                () => cleanupRecentBlockedHistory({
                    windowMs: recentHistorySweepWindowMs,
                }),
            );
            queueBestEffortBrowserEventTask('TAB_EVAPORATION_SWEEP_FAILED', resolvedSweepStaleTabs);
            return;
        }

        if (alarm.name === nudgeSweepAlarmName) {
            queueBestEffortBrowserEventTask(
                'NUDGE_PENDING_SWEEP_FAILED',
                () => runNudgePendingSweep('alarm'),
            );
        }
    }

    async function handleTabActivated(activeInfo) {
        await navigationContinuity.ensureLoaded();
        let now = Date.now();
        clearNudgeWindowBlurTimer();
        await cycleStateManager.touchActivity(now);

        let lastTabId = null;
        let prevHostname = null;
        let didSwitch = false;
        await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
            now = requireStatsMutationTimestamp(mutationContext);
            lastTabId = TabTimeTracker.getLastActiveTabId();
            const activeInfoState = TabTimeTracker.getActiveTabInfo();
            prevHostname = activeInfoState?.hostname || null;
            didSwitch = activeInfo.tabId !== lastTabId;
            await TabTimeTracker.settlePreviousTab(now);
            if (didSwitch) {
                await TabTimeTracker.finalizeActiveSession(now);
            }
            const currentFocusedWindowId = TabTimeTracker.getFocusedWindowId();
            if (currentFocusedWindowId !== null && activeInfo.windowId !== currentFocusedWindowId) {
                TabTimeTracker.setFocusedWindowId(activeInfo.windowId);
            }
        });
        if (didSwitch) {
            if (Number.isInteger(lastTabId) && lastTabId >= 0) {
                try {
                    await protectionDispatcher.stopNudgeForTab(lastTabId, {
                        reason: 'tab_switch',
                        now,
                    });
                } catch (error) {
                    warnBestEffortBrowserEventFailure('TAB_SWITCH_NUDGE_STOP_FAILED', error);
                }
            }
        }

        if (didSwitch) {
            if (lastTabId && TabTimeTracker.checkAndResetEntryTime(lastTabId, now)) {
                if (shouldCollectBehaviorForHostname(prevHostname, PRECISION_INSIGHTS_SIGNAL_IDS.CLSE)) {
                    recordCLSEShortDwell();
                }
            }
            resolvedTacticalLogger.incrementTabSwitch();
        }

        const tab = await browserPort.tabsGet(activeInfo.tabId);
        if (tab && tab.url) {
            const nextHostname = getHostname(tab.url);
            let foregroundTransitionApplied = false;
            await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
                now = requireStatsMutationTimestamp(mutationContext);
                const focusedWindowId = TabTimeTracker.getFocusedWindowId();
                const activeOwnerUnchanged = TabTimeTracker.getLastActiveTabId() === lastTabId;
                const tabStillForeground = tab.active === true
                    && (focusedWindowId === null || tab.windowId === focusedWindowId);
                if (!activeOwnerUnchanged || !tabStillForeground) return;
                TabTimeTracker.setTabEntryTime(activeInfo.tabId, now);
                await TabTimeTracker.updateActiveTabInfo(tab, now, { foregroundObserved: true });
                if (didSwitch && nextHostname) {
                    await TabTimeTracker.recordTabSwitch(prevHostname, nextHostname, now);
                }
                foregroundTransitionApplied = true;
            });
            if (!foregroundTransitionApplied) return;
            const continuity = navigationContinuity.noteForegroundTab({
                hostname: nextHostname,
                tabId: tab.id,
                url: tab.url,
                now,
                audible: tab.audible === true,
            });
            await navigationContinuity.persist(now);
            await noteProtectedEntryActivity(tab, now);
            resolvedNoteGateForegroundTab({
                hostname: nextHostname,
                tabId: tab.id,
                now,
                continuity,
            });
            captureTabFaviconBestEffort(tab, 'TAB_ACTIVATED_FAVICON_CAPTURE_FAILED');

            if (didSwitch && prevHostname && nextHostname && prevHostname !== nextHostname) {
                triggerMemoryPurgeArtifactCleanup({
                    hostname: prevHostname,
                    trigger: 'SITE_EXIT',
                    now,
                });
            }
            await waitForForegroundSettingsPropagation('tab_activated');
            const options = { foregroundSource: 'tabs.onActivated' };
            await sendProtectionUpdate(tab.id, tab.url, options);
        }
    }

    async function handleWindowFocusChanged(windowId) {
        await navigationContinuity.ensureLoaded();
        let now = Date.now();
        if (windowId !== browserPort.windowIdNone) {
            clearNudgeWindowBlurTimer();
            await cycleStateManager.touchActivity(now);
        }
        let activeInfoState = null;
        let prevHostname = null;
        await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
            now = requireStatsMutationTimestamp(mutationContext);
            activeInfoState = TabTimeTracker.getActiveTabInfo();
            prevHostname = activeInfoState?.hostname || null;
            await TabTimeTracker.settlePreviousTab(now);
            await TabTimeTracker.finalizeActiveSession(now);
            TabTimeTracker.setFocusedWindowId(
                windowId === browserPort.windowIdNone ? null : windowId,
            );
        });

        if (windowId === browserPort.windowIdNone) {
            navigationContinuity.noteForegroundBlur({ now });
            await navigationContinuity.persist(now);
            resolvedNoteGateForegroundBlur({ now });
            triggerMemoryPurgeArtifactCleanup({
                hostname: prevHostname,
                trigger: 'SESSION_END',
                now,
            });
            await handleWindowBlurNudgeAbort(activeInfoState?.tabId, now);
            return;
        }

        const win = await browserPort.windowsGet(windowId, { populate: true });
        const activeTab = win?.tabs?.find((tab) => tab.active);
        if (activeTab) {
            const nextHostname = getHostname(activeTab.url || '');
            let foregroundTransitionApplied = false;
            await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
                now = requireStatsMutationTimestamp(mutationContext);
                if (TabTimeTracker.getFocusedWindowId() !== windowId) return;
                await TabTimeTracker.updateActiveTabInfo(activeTab, now, { foregroundObserved: true });
                if (nextHostname) {
                    await TabTimeTracker.recordTabSwitch(prevHostname, nextHostname, now);
                }
                foregroundTransitionApplied = true;
            });
            if (!foregroundTransitionApplied) return;

            if (activeTab.url) {
                captureTabFaviconBestEffort(activeTab, 'WINDOW_FOCUS_FAVICON_CAPTURE_FAILED');
                const continuity = navigationContinuity.noteForegroundTab({
                    hostname: nextHostname,
                    tabId: activeTab.id,
                    url: activeTab.url,
                    now,
                    audible: activeTab.audible === true,
                });
                await navigationContinuity.persist(now);
                await noteProtectedEntryActivity(activeTab, now);
                resolvedNoteGateForegroundTab({
                    hostname: nextHostname,
                    tabId: activeTab.id,
                    now,
                    continuity,
                });
                await waitForForegroundSettingsPropagation('window_focus_changed');
                const options = { foregroundSource: 'windows.onFocusChanged' };
                await sendProtectionUpdate(activeTab.id, activeTab.url, options);
            }
        }
    }

    async function noteProtectedEntryActivity(tab, now, { audible = false } = {}) {
        if (typeof observeGateEntryPresence !== 'function') throw new Error('TRACKING_GATE_ENTRY_OWNER_REQUIRED');
        if (!audible && (tab?.active !== true || TabTimeTracker.getFocusedWindowId() === null
            || tab.windowId !== TabTimeTracker.getFocusedWindowId())) return;
        const protectedScope = await TabTimeTracker.readProtectedTabScope(tab, now);
        // Outside transitions cannot assert the absence of protected audio in other tabs.
        if (protectedScope !== true) return;
        if (audible) await ensoCadenceBridge?.interruptDeparture(now);
        await observeGateEntryPresence({
            point: { observedAt: now, presence: 'engaged' },
            isCurrent: () => true,
        });
    }

    async function handleTabUpdated(tabId, changeInfo, tab, observation = {}) {
        // History belongs to the completed visit URL, independently of the
        // current document's protection transport or lifecycle settlement.
        if (changeInfo.status === 'complete' && tab.url) {
            try {
                await maybeDeleteHistoryForUrl(tab.url);
            } catch (error) {
                warnBestEffortBrowserEventFailure('TAB_COMPLETE_HISTORY_DELETE_FAILED', error);
            }
        }
        if (
            observation.tabUpdatedIngressReceipt
            && !protectionDispatcher.isTabUpdatedIngressCurrent(
                observation.tabUpdatedIngressReceipt,
            )
        ) {
            return;
        }
        if (typeof changeInfo.url === 'string' || changeInfo.status === 'loading') {
            observeGateSitePresenceBestEffort('TAB_UPDATED_GATE_SITE_PRESENCE_FAILED');
        }
        await navigationContinuity.ensureLoaded();
        let now = Date.now();
        const observedAt = Number(observation?.observedAt);
        if (!Number.isSafeInteger(observedAt) || observedAt < 0) {
            throw new Error('TRACKING_BROWSER_EVENTS_TAB_UPDATE_OBSERVATION_REQUIRED');
        }

        if (changeInfo.status !== 'complete' && typeof changeInfo.favIconUrl === 'string' && tab.url) {
            captureTabFaviconBestEffort(tab, 'TAB_FAVICON_CHANGED_CAPTURE_FAILED');
        }

        if (typeof changeInfo.audible === 'boolean') {
            if (changeInfo.audible) await noteProtectedEntryActivity(tab, now, { audible: true });
            navigationContinuity.noteTabAudible({
                hostname: getHostname(tab?.url || ''),
                tabId,
                audible: changeInfo.audible,
                now,
            });
            await navigationContinuity.persist(now);
            await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
                now = requireStatsMutationTimestamp(mutationContext);
                const activeInfo = TabTimeTracker.getActiveTabInfo();
                if (activeInfo?.tabId === tabId) {
                    await TabTimeTracker.setActiveTabAudible(changeInfo.audible, now);
                }
            });
        }

        if ((changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.url) {
            await protectionDispatcher.revalidateNudgesForTab(tabId, { now });
        }

        if (changeInfo.status === 'loading' && tab.url) {
            const nextHostname = getHostname(tab.url);
            resolvedNoteFeedFlowTabNavigation({
                hostname: nextHostname,
                tabId,
                now,
            });
            let activeInfo = null;
            // Two different questions used to share one answer, and widening it
            // for one of them broke the other.
            //
            //   isForegroundLoadingTab - "is this load the one the user is
            //     looking at?" Asked by the gate and by navigation continuity.
            //     Both are per-tab, so a permissive answer costs nothing.
            //
            //   ownsForegroundCursor - "may this tab take the domain session?"
            //     That cursor is a single browser-wide slot and only one window
            //     holds focus, so this one has to stay focus-aware. `tab.active`
            //     alone is true for the active tab of *every* window, which is
            //     how two hosts ended up claiming the same slot.
            let isForegroundLoadingTab = false;
            let ownsForegroundCursor = false;
            await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
                now = requireStatsMutationTimestamp(mutationContext);
                activeInfo = TabTimeTracker.getActiveTabInfo();
                const focusedWinId = TabTimeTracker.getFocusedWindowId();
                isForegroundLoadingTab = tab.active === true || activeInfo?.tabId === tabId;
                ownsForegroundCursor = focusedWinId !== null
                    ? (tab.active === true
                        && (tab.windowId === focusedWinId
                            || focusedWinId === browserPort.windowIdNone
                            || activeInfo?.tabId === tabId))
                    : (activeInfo?.tabId === tabId || tab.active === true);
                if (!ownsForegroundCursor) return;
                if (activeInfo?.hostname && nextHostname && activeInfo.hostname !== nextHostname) {
                    await TabTimeTracker.settlePreviousTab(now, tabId);
                    await TabTimeTracker.finalizeActiveSession(now);
                }
                await TabTimeTracker.updateActiveTabInfo(tab, now, { foregroundObserved: true });
            });
            // A site the user left: only the tab that actually held the session
            // can report one ending.
            if (ownsForegroundCursor
                && activeInfo?.hostname && nextHostname && activeInfo.hostname !== nextHostname) {
                triggerMemoryPurgeArtifactCleanup({
                    hostname: activeInfo.hostname,
                    trigger: 'SITE_EXIT',
                    now,
                });
            }
            if (isForegroundLoadingTab) {
                const continuity = navigationContinuity.noteActiveNavigation({
                    hostname: nextHostname,
                    tabId,
                    url: tab.url,
                    now,
                    audible: tab.audible === true,
                });
                await navigationContinuity.persist(now);
                await noteProtectedEntryActivity(tab, now);
                resolvedNoteGateActiveNavigation({
                    hostname: nextHostname,
                    tabId,
                    now,
                    continuity,
                });
            }
            const gateNavigationState = await gateInterstitialController.handleTabNavigation({
                tabId,
                url: tab.url,
                observedAt,
                documentId: observation.tabUpdatedIngressReceipt?.observedDocumentId ?? null,
            });
            if (gateNavigationState?.skipProtectionDispatch) {
                return;
            }

            if (TabTimeTracker.checkAndResetEntryTime(tabId, now)) {
                const targetHostname = getHostname(tab.url);
                if (shouldCollectBehaviorForHostname(targetHostname, PRECISION_INSIGHTS_SIGNAL_IDS.CLSE)) {
                    recordCLSEShortDwell();
                }
            }
            resolvedTacticalLogger.incrementPageLoad();

            const dispatch = await sendTabUpdatedProtectionUpdate(
                tabId,
                tab.url,
                observation.tabUpdatedIngressReceipt,
                isForegroundLoadingTab,
            );
            if (dispatch.terminal) return dispatch.result;
        }

        if (changeInfo.status === 'complete' && tab.url) {
            await navigationContinuity.ensureLoaded();
            const gateNavigationState = await gateInterstitialController.handleTabNavigation({
                tabId,
                url: tab.url,
                observedAt,
                documentId: observation.tabUpdatedIngressReceipt?.observedDocumentId ?? null,
            });
            if (gateNavigationState?.skipProtectionDispatch) {
                return;
            }
            captureTabFaviconBestEffort(tab, 'TAB_COMPLETE_FAVICON_CAPTURE_FAILED');
            const hostname = getHostname(tab.url);

            const dispatch = await sendTabUpdatedProtectionUpdate(
                tabId,
                tab.url,
                observation.tabUpdatedIngressReceipt,
            );
            if (dispatch.terminal) return dispatch.result;
            let isForegroundActive = false;
            let visitIntent = null;
            await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
                now = requireStatsMutationTimestamp(mutationContext);
                const activeInfo = TabTimeTracker.getActiveTabInfo();
                const focusedWinId = TabTimeTracker.getFocusedWindowId();
                isForegroundActive = focusedWinId !== null
                    ? (tab.active && tab.windowId === focusedWinId)
                    : false;
                const idleOverride = isForegroundActive && !!tab.audible;
                visitIntent = navigationContinuity.resolveTabCompleteVisitIntent({
                    tabId,
                    hostname,
                    url: tab.url,
                    now,
                });
                TabTimeTracker.setTabEntryTime(tabId, now);
                await TabTimeTracker.settleTabTime(
                    tab.url,
                    isForegroundActive,
                    visitIntent.shouldRecordVisit,
                    now,
                    { idleOverride, visitIntent },
                );

                if (isForegroundActive) {
                    if (activeInfo?.hostname && hostname && activeInfo.hostname !== hostname) {
                        await TabTimeTracker.settlePreviousTab(now, tabId);
                        await TabTimeTracker.finalizeActiveSession(now);
                    } else {
                        await TabTimeTracker.recordActiveTabDuration(now);
                    }
                    await TabTimeTracker.updateActiveTabInfo(tab, now, { foregroundObserved: true });
                }
            });
            let continuity = null;
            if (isForegroundActive) {
                continuity = navigationContinuity.noteForegroundTab({
                    hostname,
                    tabId,
                    url: tab.url,
                    now,
                    audible: tab.audible === true,
                });
            }
            await navigationContinuity.persist(now);
            if (continuity) {
                await noteProtectedEntryActivity(tab, now);
                resolvedNoteGateForegroundTab({
                    hostname,
                    tabId,
                    now,
                    continuity,
                });
                await maybeTriggerProtectionNudge(tabId, tab.url);
            }
        }

    }

    async function recordWebNavigationSignal(details = {}, {
        includeTabContext = true,
        transitionTypeFallback = null,
    } = {}) {
        await navigationContinuity.ensureLoaded();
        const now = normalizeTimestamp(details?.timeStamp);
        if (Number(details?.frameId) !== 0) return;
        const url = typeof details?.url === 'string' ? details.url : '';
        const hostname = getHostname(url);
        if (!hostname) return;
        const transitionType = normalizeTransitionType(details.transitionType, transitionTypeFallback);
        const transitionQualifiers = normalizeTransitionQualifiers(details.transitionQualifiers);
        navigationContinuity.noteCommittedNavigation({
            ...details,
            transitionType,
            transitionQualifiers,
        }, { hostname, url, now });
        await resolvedTickRuntimeService.runStatsMutationBatch((mutationContext) => TabTimeTracker.recordNavigationIntent({
            hostname,
            transitionType,
            transitionQualifiers,
            now: requireStatsMutationTimestamp(mutationContext),
        }));
        let tabContext = null;
        let fromNewTab = false;
        if (includeTabContext) {
            fromNewTab = navigationContinuity.consumeNewTabSignal({
                tabId: details?.tabId,
                now,
            });
            tabContext = await readTabContextSnapshot(browserPort, {
                hostname,
                tabId: details?.tabId,
                url,
            });
            if (!tabContext) return;
            await resolvedTickRuntimeService.runStatsMutationBatch((mutationContext) => TabTimeTracker.recordTabContext({
                hostname,
                fromNewTab,
                sameDomainOpenTabs: tabContext.sameDomainOpenTabs,
                totalOpenTabs: tabContext.totalOpenTabs,
                now: requireStatsMutationTimestamp(mutationContext),
            }));
        }
        await navigationContinuity.persist(now);
    }

    async function handleWebNavigationCommitted(details = {}) {
        if (Number(details?.frameId) === 0) {
            await protectionDispatcher.revalidateNudgesForTab(details.tabId, { now: Date.now() });
        }
        await recordWebNavigationSignal(details, {
            includeTabContext: true,
        });
    }

    async function handleWebNavigationHistoryStateUpdated(details = {}) {
        await recordWebNavigationSignal(details, {
            includeTabContext: false,
            transitionTypeFallback: 'generated',
        });
    }

    async function handleTabCreated(tab = {}) {
        await navigationContinuity.ensureLoaded();
        const now = Date.now();
        navigationContinuity.noteTabCreated({
            tabId: tab?.id,
            now,
        });
        await navigationContinuity.persist(now);

    }

    function evictRemovedTabRuntimeOwners(tabId, reason) {
        try {
            protectionDispatcher.evictTab(tabId, { reason });
        } finally {
            contentScriptOrchestrator.evictTab(tabId);
        }
    }

    async function handleTabRemoved(tabId) {
        let now = Date.now();
        try {
            await protectionDispatcher.terminalizeNudgesForTab(tabId, {
                reason: 'tab_removed',
                now,
            });
            await navigationContinuity.ensureLoaded();
            if (navigationContinuity.evictTab({ tabId, now })) {
                await navigationContinuity.persist(now);
            }
        } finally {
            evictRemovedTabRuntimeOwners(tabId, 'tab_removed');
        }
        resolvedNoteFeedFlowTabClosed({ tabId, now });
        resolvedNoteGateTabClosed({ tabId, now });
        observeGateSitePresenceBestEffort('TAB_REMOVED_GATE_SITE_PRESENCE_FAILED');
        queueBestEffortBrowserEventTask(
            'TAB_REMOVED_GATE_SESSION_REMOVE_FAILED',
            async () => {
                await gateInterstitialController.removeTabSession(tabId, { reason: 'tab_removed', observedAt: now });
                await gateInterstitialController.refreshDetourSessions({ now });
            },
        );
        if (nudgeWindowBlurController.getPendingTabId() === tabId) {
            clearNudgeWindowBlurTimer();
        }

        let shortDwell = false;
        let activeInfo = null;
        await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
            now = requireStatsMutationTimestamp(mutationContext);
            shortDwell = TabTimeTracker.handleTabClosed(tabId, now);
            activeInfo = TabTimeTracker.getActiveTabInfo();
            if (activeInfo?.tabId !== tabId) return;
            await TabTimeTracker.recordActiveTabDuration(now, {
                reopen: false,
                reason: 'tab_removed',
            });
            await TabTimeTracker.finalizeActiveSession(now);
            await TabTimeTracker.updateActiveTabInfo(null, now);
        });

        if (shortDwell) {
            if (shouldCollectBehaviorForActiveTab(PRECISION_INSIGHTS_SIGNAL_IDS.CLSE)) {
                recordCLSEShortDwell();
            }
        }

        if (activeInfo?.tabId === tabId) {
            triggerMemoryPurgeArtifactCleanup({
                hostname: activeInfo.hostname,
                trigger: 'SESSION_END',
                now,
            });
        }

        queueBestEffortBrowserEventTask(
            'TAB_REMOVED_TACTICAL_LOG_FLUSH_FAILED',
            () => flushTacticalLogsWrapper({ reason: 'tab_closed', requireSuccess: true }),
        );
    }

    async function handleTabReplaced(addedTabId, removedTabId) {
        let now = Date.now();
        try {
            await protectionDispatcher.terminalizeNudgesForTab(removedTabId, {
                reason: 'tab_replaced',
                now,
            });
            await navigationContinuity.ensureLoaded();
            if (navigationContinuity.evictTab({ tabId: removedTabId, now })) {
                await navigationContinuity.persist(now);
            }
        } finally {
            evictRemovedTabRuntimeOwners(removedTabId, 'tab_replaced');
        }
        resolvedNoteFeedFlowTabClosed({ tabId: removedTabId, now });
        resolvedNoteGateTabClosed({ tabId: removedTabId, now });
        observeGateSitePresenceBestEffort('TAB_REPLACED_GATE_SITE_PRESENCE_FAILED');
        queueBestEffortBrowserEventTask(
            'TAB_REPLACED_GATE_SESSION_REMOVE_FAILED',
            () => gateInterstitialController.removeTabSession(removedTabId, {
                reason: 'tab_replaced',
                observedAt: now,
            }),
        );
        await resolvedTickRuntimeService.runStatsMutationBatch((mutationContext) => {
            now = requireStatsMutationTimestamp(mutationContext);
            TabTimeTracker.handleTabClosed(removedTabId, now);
        });
        if (nudgeWindowBlurController.getPendingTabId() === removedTabId) {
            clearNudgeWindowBlurTimer();
        }

        const replacementTab = await browserPort.tabsGet(addedTabId);
        if (!replacementTab?.url) return;
        const nextHostname = getHostname(replacementTab.url);
        resolvedNoteFeedFlowTabNavigation({
            hostname: nextHostname,
            tabId: addedTabId,
            now,
        });
        let isForegroundReplacement = false;
        await resolvedTickRuntimeService.runStatsMutationBatch(async (mutationContext) => {
            now = requireStatsMutationTimestamp(mutationContext);
            const focusedWindowId = TabTimeTracker.getFocusedWindowId();
            const activeInfo = TabTimeTracker.getActiveTabInfo();
            isForegroundReplacement = focusedWindowId !== null
                && replacementTab.active === true && replacementTab.windowId === focusedWindowId;
            if (isForegroundReplacement) {
                if (activeInfo?.hostname && nextHostname && activeInfo.hostname !== nextHostname) {
                    await TabTimeTracker.settlePreviousTab(now, removedTabId);
                    await TabTimeTracker.finalizeActiveSession(now);
                }
                await TabTimeTracker.updateActiveTabInfo(replacementTab, now, { foregroundObserved: true });
            }
        });
        if (isForegroundReplacement) {
            const continuity = navigationContinuity.noteActiveNavigation({
                hostname: nextHostname,
                tabId: addedTabId,
                url: replacementTab.url,
                now,
                audible: replacementTab.audible === true,
            });
            await navigationContinuity.persist(now);
            await noteProtectedEntryActivity(replacementTab, now);
            resolvedNoteGateActiveNavigation({
                hostname: nextHostname,
                tabId: addedTabId,
                now,
                continuity,
            });
            await waitForForegroundSettingsPropagation('tab_replaced');
        }
        const gateNavigationState = await gateInterstitialController.handleTabNavigation({
            tabId: addedTabId,
            url: replacementTab.url,
        });
        if (gateNavigationState?.skipProtectionDispatch) return;
        const options = { foregroundSource: 'tabs.onReplaced' };
        const result = await sendProtectionUpdate(addedTabId, replacementTab.url, options);
        if (isProtectionForegroundDispatchCancellation(result)) return;
        if (isForegroundReplacement && replacementTab.status === 'complete') {
            TabTimeTracker.setTabEntryTime(addedTabId, now);
            captureTabFaviconBestEffort(replacementTab, 'TAB_REPLACED_FAVICON_CAPTURE_FAILED');
        }
    }

    const createAdmittedBrowserEventHandler = (
        label,
        handler,
        {
            onAdmissionRejected = null,
            resolveTabId = null,
        } = {},
    ) => (...args) => {
        // Ingress fence precedes async admission/initialization and per-tab queues.
        // An event observed during an inventory breaks its continuity proof.
        if (label !== 'alarms.onAlarm') TabTimeTracker.invalidateConsumptionMediaObservation();
        const cadenceReceipt = ensoCadenceBridge?.capture(label, args);
        let admissionPromise;
        try {
            admissionPromise = Promise.resolve(resolvedCaptureProfileMutationRuntimeAdmission({
                label: `browser_event:${label}`,
            }));
        } catch (error) {
            admissionPromise = Promise.reject(error);
        }
        const admissionOutcome = admissionPromise.then(
            (admission) => ({ ok: true, admission }),
            (error) => ({ ok: false, error }),
        );

        const runAdmittedHandler = () => admissionOutcome.then(async (outcome) => {
            if (!outcome.ok) {
                if (typeof onAdmissionRejected === 'function') {
                    onAdmissionRejected(...args);
                }
                throw outcome.error;
            }
            await waitForInit();
            return resolvedRunCapturedProfileMutationRuntimeTask({
                admission: outcome.admission,
                task: async () => {
                    await ensoCadenceBridge?.settle(cadenceReceipt);
                    const result = await handler(...args);
                    await ensoCadenceBridge?.refresh(cadenceReceipt);
                    return result;
                },
            });
        });
        const tabId = typeof resolveTabId === 'function'
            ? Number(resolveTabId(...args))
            : null;
        if (!Number.isSafeInteger(tabId) || tabId < 0) {
            return runAdmittedHandler();
        }
        return tabLifecycleEventQueue.enqueue(tabId, runAdmittedHandler);
    };

    const admittedTabUpdatedHandler = createAdmittedBrowserEventHandler(
        'tabs.onUpdated',
        handleTabUpdated,
        { resolveTabId: (tabId) => tabId },
    );
    const admittedWebNavigationCommittedHandler = createAdmittedBrowserEventHandler(
        'webNavigation.onCommitted',
        handleWebNavigationCommitted,
        { resolveTabId: (details) => details?.tabId },
    );
    const admittedWebNavigationHistoryStateUpdatedHandler = createAdmittedBrowserEventHandler(
        'webNavigation.onHistoryStateUpdated',
        handleWebNavigationHistoryStateUpdated,
        { resolveTabId: (details) => details?.tabId },
    );
    const admittedTabRemovedHandler = createAdmittedBrowserEventHandler(
        'tabs.onRemoved',
        handleTabRemoved,
        {
            resolveTabId: (tabId) => tabId,
            onAdmissionRejected: (tabId) => {
                evictRemovedTabRuntimeOwners(tabId, 'tab_removed');
            },
        },
    );
    const admittedTabReplacedHandler = createAdmittedBrowserEventHandler(
        'tabs.onReplaced',
        handleTabReplaced,
        {
            resolveTabId: (_addedTabId, removedTabId) => removedTabId,
            onAdmissionRejected: (_addedTabId, removedTabId) => {
                evictRemovedTabRuntimeOwners(removedTabId, 'tab_replaced');
            },
        },
    );

    return {
        handleAlarm: createAdmittedBrowserEventHandler('alarms.onAlarm', handleAlarm),
        handleTabActivated: createAdmittedBrowserEventHandler(
            'tabs.onActivated',
            handleTabActivated,
            { resolveTabId: (activeInfo) => activeInfo?.tabId },
        ),
        handleWindowFocusChanged: createAdmittedBrowserEventHandler(
            'windows.onFocusChanged',
            handleWindowFocusChanged,
        ),
        handleTabUpdated: (tabId, changeInfo, tab) => {
            const observation = {
                observedAt: Date.now(),
            };
            observation.tabUpdatedIngressReceipt = protectionDispatcher.captureTabUpdatedIngress(
                tabId,
                {
                    status: changeInfo?.status,
                    url: tab?.url,
                    observedAt: observation.observedAt,
                },
            );
            return admittedTabUpdatedHandler(
                tabId,
                changeInfo,
                tab,
                Object.freeze(observation),
            );
        },
        handleWebNavigationCommitted: (details = {}) => {
            if (Number(details?.frameId) === 0) {
                contentProtectionSync.invalidateTab(details?.tabId, {
                    documentId: typeof details?.documentId === 'string'
                        ? details.documentId
                        : null,
                    reason: 'web_navigation_committed',
                });
                protectionDispatcher.markTabNavigated(details?.tabId, {
                    url: typeof details?.url === 'string' ? details.url : null,
                    documentId: typeof details?.documentId === 'string'
                        ? details.documentId
                        : null,
                    observedAt: Date.now(),
                });
                contentScriptOrchestrator.markTabNavigated(details?.tabId, {
                    url: typeof details?.url === 'string' ? details.url : '',
                    reason: 'web_navigation_committed',
                });
            }
            return admittedWebNavigationCommittedHandler(details);
        },
        handleWebNavigationHistoryStateUpdated: (details = {}) => {
            if (Number(details?.frameId) === 0) {
                protectionDispatcher.markTabUrlChanged(details?.tabId, {
                    url: typeof details?.url === 'string' ? details.url : null,
                    documentId: typeof details?.documentId === 'string'
                        ? details.documentId
                        : null,
                    observedAt: Date.now(),
                });
                contentScriptOrchestrator.refreshTabUrl(details?.tabId, {
                    url: typeof details?.url === 'string' ? details.url : '',
                    reason: 'web_navigation_history_state_updated',
                });
            }
            return admittedWebNavigationHistoryStateUpdatedHandler(details);
        },
        handleTabCreated: createAdmittedBrowserEventHandler(
            'tabs.onCreated',
            handleTabCreated,
            { resolveTabId: (tab) => tab?.id },
        ),
        handleTabRemoved: (tabId) => {
            contentProtectionSync.evictTab(tabId, { reason: 'tab_removed' });
            protectionDispatcher.invalidateTabForRemoval(tabId, { reason: 'tab_removed' });
            return admittedTabRemovedHandler(tabId);
        },
        handleTabReplaced: (addedTabId, removedTabId) => {
            contentProtectionSync.evictTab(removedTabId, { reason: 'tab_replaced' });
            protectionDispatcher.invalidateTabForRemoval(removedTabId, { reason: 'tab_replaced' });
            return admittedTabReplacedHandler(addedTabId, removedTabId);
        },
    };
}
