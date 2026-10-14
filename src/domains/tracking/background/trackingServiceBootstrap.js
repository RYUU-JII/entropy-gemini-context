import { ensureAlarm } from './AlarmScheduler.js';
import {
    isHostnameMatch,
    normalizeDomain,
} from '../../../lib/domain.js';
import { getHostname } from '../../../lib/url.js';
import { CEREMONY_IDS } from '../../../platform/ceremony/ceremonyContracts.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';

async function primeFocusedWindowState({
    TabTimeTracker,
    faviconService,
    idleDetector = null,
    eventLogStore = null,
    runDetachedBootstrapTask,
    readLastFocusedWindow,
    windowIdNone = -1,
} = {}) {
    let faviconTab = null;
    try {
        if (typeof readLastFocusedWindow !== 'function') {
            throw new Error('TRACKING_BOOTSTRAP_FOCUSED_WINDOW_READER_REQUIRED');
        }
        if (!idleDetector || typeof idleDetector.getIdleState !== 'function') {
            throw new Error('TRACKING_BOOTSTRAP_IDLE_DETECTOR_REQUIRED');
        }

        const win = await readLastFocusedWindow({ populate: true });
        const now = Date.now();
        if (!win || win.id === windowIdNone || win.focused !== true) {
            TabTimeTracker.setFocusedWindowId(null);
            await TabTimeTracker.reconcileForegroundSegmentForObservedTab(null, now, {
                foregroundObserved: false,
                reason: 'service_startup_unfocused',
            });
            return;
        }

        TabTimeTracker.setFocusedWindowId(win.id);
        const activeTab = win.tabs?.find((tab) => tab.active);
        if (!activeTab) {
            await TabTimeTracker.reconcileForegroundSegmentForObservedTab(null, now, {
                foregroundObserved: false,
                reason: 'service_startup_no_active_tab',
            });
            return;
        }

        const idleState = await idleDetector.getIdleState({ force: true });
        const foregroundObserved = idleState === 'active' || !!activeTab.audible;
        await TabTimeTracker.reconcileForegroundSegmentForObservedTab(activeTab, now, {
            foregroundObserved,
            reason: 'service_startup_reconcile',
        });
        await TabTimeTracker.updateActiveTabInfo(activeTab, now, {
            foregroundObserved,
        });
        faviconTab = activeTab;
    } catch (error) {
        await recordBootstrapDiagnostic({
            eventLogStore,
            label: 'focused_window_startup_state',
            error,
        });
    }
    if (faviconTab) {
        runDetachedBootstrapTask({
            label: 'favicon_startup_capture',
            task: () => faviconService.captureTabFavicon(faviconTab),
        });
    }
}

function serializeBootstrapError(error) {
    return {
        name: error?.name || 'Error',
        message: error?.message || String(error || 'UNKNOWN_BOOTSTRAP_ERROR'),
    };
}

function extractDestroyedBookmarkDomains(result) {
    const entries = Array.isArray(result?.destroyed) ? result.destroyed : [];
    return Array.from(new Set(entries
        .map((entry) => normalizeDomain(entry?.domain))
        .filter(Boolean)));
}

function findMatchingDestroyedDomain(hostname, domains = []) {
    return domains.find((domain) => isHostnameMatch(hostname, domain)) || '';
}

async function notifyBookmarkNeutralizedCeremony({
    browserPort,
    sourceUrl,
    syncResult,
    now = Date.now(),
} = {}) {
    const sourceHostname = getHostname(sourceUrl);
    if (!sourceHostname) return;

    const destroyedDomains = extractDestroyedBookmarkDomains(syncResult);
    const sourceDomain = findMatchingDestroyedDomain(sourceHostname, destroyedDomains);
    if (!sourceDomain) return;

    const tabs = await browserPort.tabsQuery({});
    const targets = (Array.isArray(tabs) ? tabs : [])
        .filter((tab) => Number.isFinite(Number(tab?.id)))
        .filter((tab) => {
            const tabHostname = getHostname(tab?.url);
            return tabHostname && isHostnameMatch(tabHostname, sourceDomain);
        });

    await Promise.all(targets.map((tab) => browserPort.tabsSendMessage(tab.id, {
        type: MESSAGE_TYPES.CEREMONY_PLAY,
        payload: {
            ceremonyId: CEREMONY_IDS.BOOKMARK_NEUTRALIZED,
            source: 'memory_purge_bookmark_destroyed',
            seed: now + Number(tab.id),
        },
    })));
}

async function recordBootstrapDiagnostic({ eventLogStore, label, error }) {
    const serializedError = serializeBootstrapError(error);
    console.warn(`[BackgroundBootstrap] ${label} failed:`, error);

    if (!eventLogStore || typeof eventLogStore.append !== 'function') return;
    try {
        const receipt = await eventLogStore.append({
            id: `background-bootstrap-${label}-${Date.now()}`,
            timestamp: Date.now(),
            type: 'background_bootstrap_diagnostic',
            severity: 'warn',
            label,
            error: serializedError,
        });
        if (receipt?.accepted === false && receipt.reason === 'data_locked') return;
        if (receipt?.accepted !== true) throw new Error('BACKGROUND_BOOTSTRAP_DIAGNOSTIC_RECEIPT_INVALID');
    } catch (diagnosticError) {
        console.warn('[BackgroundBootstrap] Failed to record diagnostic:', diagnosticError);
    }
}

async function runBestEffortBootstrapTask({ label, task, eventLogStore }) {
    if (typeof task !== 'function') return;
    try {
        await task();
    } catch (error) {
        await recordBootstrapDiagnostic({ eventLogStore, label, error });
    }
}

function collectStatsRetentionDiagnostics(result) {
    if (!result || typeof result !== 'object') {
        return [{
            label: 'stats_retention_result',
            error: new Error('TRACKING_BOOTSTRAP_STATS_RETENTION_RESULT_INVALID'),
        }];
    }

    const diagnostics = [];
    const markerReadValid = (
        result.markerRead
        && typeof result.markerRead === 'object'
        && typeof result.markerRead.ok === 'boolean'
        && typeof result.markerRead.skipped === 'boolean'
    );
    const cleanupResultsValid = Array.isArray(result.cleanupResults);
    const ranRetention = result.ran === true;
    const skippedRetention = result.skipped === true;
    const statsCleanupValid = (
        result.statsCleanup
        && typeof result.statsCleanup === 'object'
        && typeof result.statsCleanup.ok === 'boolean'
    );
    const markerValid = (
        result.marker
        && typeof result.marker === 'object'
        && typeof result.marker.ok === 'boolean'
    );
    if (
        (!ranRetention && !skippedRetention)
        || !markerReadValid
        || !cleanupResultsValid
        || (ranRetention && (!statsCleanupValid || !markerValid))
    ) {
        diagnostics.push({
            label: 'stats_retention_result',
            error: new Error('TRACKING_BOOTSTRAP_STATS_RETENTION_RESULT_INVALID'),
        });
    }
    if (result.markerRead?.ok === false) {
        diagnostics.push({
            label: 'stats_retention_marker_read',
            error: new Error(result.markerRead.error || 'STATS_RETENTION_MARKER_READ_FAILED'),
        });
    }
    if (result.statsCleanup?.ok === false) {
        diagnostics.push({
            label: 'stats_retention_stats_cleanup',
            error: new Error(result.statsCleanup.error || 'STATS_RETENTION_STATS_CLEANUP_FAILED'),
        });
    }
    if (result.marker?.ok === false) {
        diagnostics.push({
            label: 'stats_retention_marker_write',
            error: new Error(result.marker.error || 'STATS_RETENTION_MARKER_WRITE_FAILED'),
        });
    }
    const cleanupResults = cleanupResultsValid ? result.cleanupResults : [];
    cleanupResults.forEach((entry, index) => {
        if (entry?.ok !== false) return;
        diagnostics.push({
            label: `stats_retention_cleanup_task_${index}`,
            error: new Error(entry.error || 'STATS_RETENTION_CLEANUP_TASK_FAILED'),
        });
    });
    return diagnostics;
}

async function recordStatsRetentionDiagnostics({ eventLogStore, result }) {
    const diagnostics = collectStatsRetentionDiagnostics(result);
    for (const diagnostic of diagnostics) {
        await recordBootstrapDiagnostic({
            eventLogStore,
            label: diagnostic.label,
            error: diagnostic.error,
        });
    }
}

function requireBootstrapFunction(fn, errorCode) {
    if (typeof fn !== 'function') {
        throw new Error(errorCode);
    }
}

function requireBootstrapMethod(owner, methodName, errorCode) {
    if (!owner || typeof owner[methodName] !== 'function') {
        throw new Error(errorCode);
    }
}

function validateTrackingServiceBootstrapDependencies({
    statsRetentionJob,
    loadStatsCache,
    initStatsRuntimeHealth,
    setRolloverLifecycle,
    initializeClseLabs,
    settingsService,
    initializeArtifactDisclosure,
    bootPrewarmService,
    reportProfileGenerationBootSettled,
    reportDashboardBootReadReady,
    reportPostDashboardBootStage,
    reconcileNudgeDebtSession,
    runNudgePendingSweep,
    popupBlockFlow,
    reconcileHistoryCleanupOnActivation,
    reconcileHistoryCleanupAfterPermissionAdded,
    reconcileStartupContentScripts,
    invalidateContentPermissions,
    syncBlockedBookmarks,
    restoreSettingsPropagation,
    drainNudgeTerminalOutbox,
    checkGlobalCapStatus,
    setupIdleDetection,
    idleDetector,
    TabTimeTracker,
    cycleStateManager,
    faviconService,
    clearNudgeWindowBlurTimer,
    runStatsMutationBatch,
    flushTacticalLogsWrapper,
    eventLogStore,
    readLastFocusedWindow,
    registerBrowserListeners,
    handleHistoryVisited,
    notificationService,
    waitForFullInit,
    waitForProfileMutationAdmission,
    initializeZenProfileGeneration,
    runProfileMutationAdmittedTask,
    browserPort,
} = {}) {
    requireBootstrapMethod(statsRetentionJob, 'run', 'TRACKING_BOOTSTRAP_STATS_RETENTION_JOB_REQUIRED');
    requireBootstrapFunction(loadStatsCache, 'TRACKING_BOOTSTRAP_LOAD_STATS_CACHE_REQUIRED');
    requireBootstrapFunction(initStatsRuntimeHealth, 'TRACKING_BOOTSTRAP_STATS_RUNTIME_HEALTH_INIT_REQUIRED');
    requireBootstrapFunction(setRolloverLifecycle, 'TRACKING_BOOTSTRAP_ROLLOVER_LIFECYCLE_SETTER_REQUIRED');
    requireBootstrapFunction(initializeClseLabs, 'TRACKING_BOOTSTRAP_CLSE_LABS_INIT_REQUIRED');
    requireBootstrapMethod(settingsService, 'ensureSettingsCache', 'TRACKING_BOOTSTRAP_SETTINGS_SERVICE_REQUIRED');
    requireBootstrapFunction(
        initializeArtifactDisclosure,
        'TRACKING_BOOTSTRAP_ARTIFACT_DISCLOSURE_INITIALIZER_REQUIRED',
    );
    requireBootstrapMethod(bootPrewarmService, 'ensureWarm', 'TRACKING_BOOTSTRAP_BOOT_PREWARM_SERVICE_REQUIRED');
    requireBootstrapFunction(
        reportProfileGenerationBootSettled,
        'TRACKING_BOOTSTRAP_PROFILE_GENERATION_SETTLEMENT_REPORTER_REQUIRED',
    );
    requireBootstrapFunction(reportDashboardBootReadReady, 'TRACKING_BOOTSTRAP_DASHBOARD_BOOT_READINESS_REPORTER_REQUIRED');
    requireBootstrapFunction(reportPostDashboardBootStage, 'TRACKING_BOOTSTRAP_POST_DASHBOARD_STAGE_REPORTER_REQUIRED');
    requireBootstrapFunction(
        reconcileNudgeDebtSession,
        'TRACKING_BOOTSTRAP_NUDGE_DEBT_SESSION_RECONCILIATION_REQUIRED',
    );
    requireBootstrapFunction(runNudgePendingSweep, 'TRACKING_BOOTSTRAP_NUDGE_PENDING_SWEEP_REQUIRED');
    requireBootstrapMethod(popupBlockFlow, 'handlePermissionAdded', 'TRACKING_BOOTSTRAP_POPUP_BLOCK_FLOW_REQUIRED');
    requireBootstrapMethod(popupBlockFlow, 'handlePermissionRemoved', 'TRACKING_BOOTSTRAP_POPUP_BLOCK_FLOW_REQUIRED');
    requireBootstrapFunction(invalidateContentPermissions, 'TRACKING_BOOTSTRAP_PERMISSION_INVALIDATION_REQUIRED');
    requireBootstrapFunction(
        reconcileHistoryCleanupOnActivation,
        'TRACKING_BOOTSTRAP_HISTORY_CLEANUP_ACTIVATION_RECONCILE_REQUIRED',
    );
    requireBootstrapFunction(
        reconcileHistoryCleanupAfterPermissionAdded,
        'TRACKING_BOOTSTRAP_HISTORY_CLEANUP_PERMISSION_RECONCILE_REQUIRED',
    );
    requireBootstrapFunction(
        reconcileStartupContentScripts,
        'TRACKING_BOOTSTRAP_CONTENT_SCRIPT_RECONCILE_REQUIRED',
    );
    requireBootstrapFunction(syncBlockedBookmarks, 'TRACKING_BOOTSTRAP_BLOCKED_BOOKMARK_SYNC_REQUIRED');
    requireBootstrapFunction(restoreSettingsPropagation, 'TRACKING_BOOTSTRAP_SETTINGS_PROPAGATION_RESTORE_REQUIRED');
    requireBootstrapFunction(drainNudgeTerminalOutbox, 'TRACKING_BOOTSTRAP_NUDGE_TERMINAL_OUTBOX_DRAIN_REQUIRED');
    requireBootstrapFunction(checkGlobalCapStatus, 'TRACKING_BOOTSTRAP_GLOBAL_CAP_CHECK_REQUIRED');
    requireBootstrapFunction(setupIdleDetection, 'TRACKING_BOOTSTRAP_IDLE_SETUP_REQUIRED');
    requireBootstrapMethod(idleDetector, 'getIdleState', 'TRACKING_BOOTSTRAP_IDLE_DETECTOR_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'init', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'recordActiveTabDuration', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'finalizeActiveSession', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'replayPendingSessionCommit', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'reconcileForegroundSegmentForObservedTab', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(TabTimeTracker, 'updateActiveTabInfo', 'TRACKING_BOOTSTRAP_TAB_TIME_TRACKER_REQUIRED');
    requireBootstrapMethod(cycleStateManager, 'init', 'TRACKING_BOOTSTRAP_CYCLE_STATE_MANAGER_REQUIRED');
    requireBootstrapMethod(faviconService, 'captureTabFavicon', 'TRACKING_BOOTSTRAP_FAVICON_SERVICE_REQUIRED');
    requireBootstrapFunction(clearNudgeWindowBlurTimer, 'TRACKING_BOOTSTRAP_CLEAR_NUDGE_BLUR_TIMER_REQUIRED');
    requireBootstrapFunction(runStatsMutationBatch, 'TRACKING_BOOTSTRAP_MUTATION_BATCH_REQUIRED');
    requireBootstrapFunction(flushTacticalLogsWrapper, 'TRACKING_BOOTSTRAP_TACTICAL_LOG_FLUSH_REQUIRED');
    requireBootstrapMethod(eventLogStore, 'append', 'TRACKING_BOOTSTRAP_EVENT_LOG_STORE_REQUIRED');
    requireBootstrapMethod(eventLogStore, 'forceFlush', 'TRACKING_BOOTSTRAP_EVENT_LOG_STORE_REQUIRED');
    requireBootstrapFunction(readLastFocusedWindow, 'TRACKING_BOOTSTRAP_FOCUSED_WINDOW_READER_REQUIRED');
    requireBootstrapFunction(registerBrowserListeners, 'TRACKING_BOOTSTRAP_BROWSER_LISTENER_REGISTRATION_REQUIRED');
    requireBootstrapFunction(handleHistoryVisited, 'TRACKING_BOOTSTRAP_HISTORY_EVENT_OWNER_REQUIRED');
    requireBootstrapMethod(notificationService, 'registerListeners', 'TRACKING_BOOTSTRAP_NOTIFICATION_SERVICE_REQUIRED');
    requireBootstrapMethod(notificationService, 'dispose', 'TRACKING_BOOTSTRAP_NOTIFICATION_SERVICE_REQUIRED');
    requireBootstrapFunction(waitForFullInit, 'TRACKING_BOOTSTRAP_FULL_INIT_GATE_REQUIRED');
    requireBootstrapFunction(
        waitForProfileMutationAdmission,
        'TRACKING_BOOTSTRAP_PROFILE_MUTATION_ADMISSION_GATE_REQUIRED',
    );
    requireBootstrapFunction(
        initializeZenProfileGeneration,
        'TRACKING_BOOTSTRAP_ZEN_PROFILE_GENERATION_INITIALIZER_REQUIRED',
    );
    requireBootstrapFunction(
        runProfileMutationAdmittedTask,
        'TRACKING_BOOTSTRAP_PROFILE_MUTATION_RUNTIME_GATE_REQUIRED',
    );
    requireBootstrapMethod(browserPort, 'alarmsGet', 'TRACKING_BOOTSTRAP_BROWSER_PORT_REQUIRED');
    requireBootstrapMethod(browserPort, 'alarmsCreate', 'TRACKING_BOOTSTRAP_BROWSER_PORT_REQUIRED');
    requireBootstrapMethod(browserPort, 'tabsQuery', 'TRACKING_BOOTSTRAP_BROWSER_PORT_REQUIRED');
    requireBootstrapMethod(browserPort, 'tabsSendMessage', 'TRACKING_BOOTSTRAP_BROWSER_PORT_REQUIRED');
}

export function createTrackingServiceBootstrap({
    statsRetentionJob,
    maxDaysStored,
    loadStatsCache,
    initStatsRuntimeHealth,
    setRolloverLifecycle,
    initializeClseLabs,
    rolloverLifecycle,
    settingsService,
    initializeArtifactDisclosure,
    bootPrewarmService,
    reportProfileGenerationBootSettled,
    reportDashboardBootReadReady,
    reportPostDashboardBootStage,
    reconcileNudgeDebtSession,
    runNudgePendingSweep,
    popupBlockFlow,
    reconcileHistoryCleanupOnActivation,
    reconcileHistoryCleanupAfterPermissionAdded,
    reconcileStartupContentScripts,
    invalidateContentPermissions,
    syncBlockedBookmarks,
    restoreSettingsPropagation,
    drainNudgeTerminalOutbox,
    checkGlobalCapStatus,
    setupIdleDetection,
    idleDetector,
    TabTimeTracker,
    cycleStateManager,
    faviconService,
    handleAlarm,
    handleTabActivated,
    handleTabCreated,
    handleWindowFocusChanged,
    handleTabUpdated,
    handleTabRemoved,
    handleTabReplaced,
    handleWebNavigationCommitted,
    handleWebNavigationHistoryStateUpdated,
    handleHistoryVisited,
    handleBuildCapabilityActionClicked,
    combinedMessageHandler,
    notificationService,
    waitForFullInit,
    waitForProfileMutationAdmission,
    initializeZenProfileGeneration,
    runProfileMutationAdmittedTask,
    clearNudgeWindowBlurTimer,
    runStatsMutationBatch,
    flushTacticalLogsWrapper,
    eventLogStore,
    readLastFocusedWindow,
    registerBrowserListeners,
    windowIdNone,
    browserPort,
} = {}) {
    validateTrackingServiceBootstrapDependencies({
        statsRetentionJob,
        loadStatsCache,
        initStatsRuntimeHealth,
        setRolloverLifecycle,
        initializeClseLabs,
        settingsService,
        initializeArtifactDisclosure,
        bootPrewarmService,
        reportProfileGenerationBootSettled,
        reportDashboardBootReadReady,
        reportPostDashboardBootStage,
        reconcileNudgeDebtSession,
        runNudgePendingSweep,
        popupBlockFlow,
        reconcileHistoryCleanupOnActivation,
        reconcileHistoryCleanupAfterPermissionAdded,
        reconcileStartupContentScripts,
        invalidateContentPermissions,
        syncBlockedBookmarks,
        restoreSettingsPropagation,
        drainNudgeTerminalOutbox,
        checkGlobalCapStatus,
        setupIdleDetection,
        idleDetector,
        TabTimeTracker,
        cycleStateManager,
        faviconService,
        clearNudgeWindowBlurTimer,
        runStatsMutationBatch,
        flushTacticalLogsWrapper,
        eventLogStore,
        readLastFocusedWindow,
        registerBrowserListeners,
        handleHistoryVisited,
        notificationService,
        waitForFullInit,
        waitForProfileMutationAdmission,
        initializeZenProfileGeneration,
        runProfileMutationAdmittedTask,
        browserPort,
    });
    let bookmarkImportInProgress = false;
    let browserListenersRegistered = false;
    let notificationListenersRegistered = false;

    function runDetachedBootstrapTask({ label, task } = {}) {
        requireBootstrapFunction(task, 'TRACKING_BOOTSTRAP_TASK_REQUIRED');
        const ownedTask = runProfileMutationAdmittedTask({
            label: `background_bootstrap_detached:${label}`,
            task: () => runBestEffortBootstrapTask({
                label,
                task,
                eventLogStore,
            }),
        });
        if (!ownedTask || typeof ownedTask.then !== 'function') {
            throw new Error('TRACKING_BOOTSTRAP_PROFILE_MUTATION_RUNTIME_TASK_INVALID');
        }
        void ownedTask.catch((error) => {
            console.error(`[BackgroundBootstrap] ${label} admitted task failed:`, error);
        });
        return ownedTask;
    }

    async function syncBlockedBookmarksSafely({
        sourceUrl = '',
        notifyCeremony = false,
    } = {}) {
        let result = null;
        try {
            result = await syncBlockedBookmarks();
        } catch (error) {
            await recordBootstrapDiagnostic({
                eventLogStore,
                label: 'blocked_bookmark_sync',
                error,
            });
            return null;
        }
        if (notifyCeremony && result) {
            try {
                await notifyBookmarkNeutralizedCeremony({
                    browserPort,
                    sourceUrl,
                    syncResult: result,
                });
            } catch (error) {
                await recordBootstrapDiagnostic({
                    eventLogStore,
                    label: 'bookmark_neutralized_ceremony',
                    error,
                });
            }
        }
        return result;
    }

    async function handleBookmarkCreated(_bookmarkId, node) {
        if (bookmarkImportInProgress) return;
        if (typeof node?.url !== 'string' || !node.url) return;
        await syncBlockedBookmarksSafely({
            sourceUrl: node.url,
            notifyCeremony: true,
        });
    }

    async function handleBookmarkChanged(_bookmarkId, changeInfo) {
        if (bookmarkImportInProgress) return;
        if (typeof changeInfo?.url !== 'string' || !changeInfo.url) return;
        await syncBlockedBookmarksSafely({
            sourceUrl: changeInfo.url,
            notifyCeremony: true,
        });
    }

    function handleBookmarkImportBegan() {
        bookmarkImportInProgress = true;
    }

    async function handleBookmarkImportEnded() {
        bookmarkImportInProgress = false;
        await syncBlockedBookmarksSafely();
    }

    function hasPermissionDelta(permissions, permissionName) {
        const permissionList = Array.isArray(permissions?.permissions) ? permissions.permissions : [];
        return permissionList.includes(permissionName);
    }

    async function handlePermissionAdded(permissions) {
        await popupBlockFlow.handlePermissionAdded(permissions);
        const tasks = [];
        if (hasPermissionDelta(permissions, 'history')) {
            tasks.push(reconcileHistoryCleanupAfterPermissionAdded());
        }
        if (hasPermissionDelta(permissions, 'bookmarks')) {
            tasks.push(syncBlockedBookmarksSafely());
        }
        await Promise.all(tasks);
    }

    async function handlePermissionRemoved(permissions) {
        await popupBlockFlow.handlePermissionRemoved(permissions);
        if (hasPermissionDelta(permissions, 'bookmarks')) {
            await syncBlockedBookmarksSafely();
        }
    }

    function createFullInitListener(label, handler) {
        return (...args) => waitForFullInit({
            label,
            task: () => handler(...args),
        });
    }

    const handleHistoryVisitedAfterFullInit = createFullInitListener(
        'history_visited',
        handleHistoryVisited,
    );
    const handleBookmarkCreatedAfterFullInit = createFullInitListener(
        'bookmark_created',
        handleBookmarkCreated,
    );
    const handleBookmarkChangedAfterFullInit = createFullInitListener(
        'bookmark_changed',
        handleBookmarkChanged,
    );
    const handleBookmarkImportBeganAfterFullInit = createFullInitListener(
        'bookmark_import_began',
        handleBookmarkImportBegan,
    );
    const handleBookmarkImportEndedAfterFullInit = createFullInitListener(
        'bookmark_import_ended',
        handleBookmarkImportEnded,
    );
    // Revoke RAM execution authority at ingress. Durable reconciliation still
    // runs under the existing full-init/profile admission and event ordering.
    const createPermissionListener = (label, handler) => {
        const afterFullInit = createFullInitListener(label, handler);
        return (permissions) => {
            if (permissions?.permissions?.includes('scripting') || permissions?.origins?.length > 0) {
                invalidateContentPermissions();
            }
            return afterFullInit(permissions);
        };
    };
    const handlePermissionAddedAfterFullInit = createPermissionListener(
        'permission_added',
        handlePermissionAdded,
    );
    const handlePermissionRemovedAfterFullInit = createPermissionListener(
        'permission_removed',
        handlePermissionRemoved,
    );
    const handleBuildCapabilityActionClickedAfterFullInit = (
        typeof handleBuildCapabilityActionClicked === 'function'
            ? createFullInitListener(
                'build_capability_action_clicked',
                handleBuildCapabilityActionClicked,
            )
            : null
    );

    async function handleSuspend() {
        bookmarkImportInProgress = false;
        clearNudgeWindowBlurTimer();
        const notificationDisposeTask = runBestEffortBootstrapTask({
            label: 'notification_service_suspend_dispose',
            task: () => notificationService.dispose(),
            eventLogStore,
        });

        try {
            await runStatsMutationBatch(async ({ now }) => {
                await TabTimeTracker.recordActiveTabDuration(now, {
                    reopen: false,
                    reason: 'service_worker_suspend',
                });
                await TabTimeTracker.finalizeActiveSession(now);
            }, { force: true });
        } catch (error) {
            await recordBootstrapDiagnostic({
                eventLogStore,
                label: 'foreground_segment_suspend_commit',
                error,
            });
        }

        const tacticalLogFlushTask = runBestEffortBootstrapTask({
            label: 'tactical_log_suspend_flush',
            task: () => flushTacticalLogsWrapper({ reason: 'suspend', requireSuccess: true }),
            eventLogStore,
        });
        const eventLogFlushTask = runBestEffortBootstrapTask({
            label: 'event_log_suspend_flush',
            task: () => eventLogStore.forceFlush(),
            eventLogStore,
        });
        await Promise.all([
            notificationDisposeTask,
            tacticalLogFlushTask,
            eventLogFlushTask,
        ]);
    }

    async function init() {
        const profileMutationLifecycle = await waitForProfileMutationAdmission();
        const profileAggregate = await initializeZenProfileGeneration({
            lifecycle: profileMutationLifecycle,
        });
        reportProfileGenerationBootSettled({
            success: true,
            profileGeneration: profileAggregate.profileEpoch,
        });
        await runBestEffortBootstrapTask({
            label: 'stats_runtime_health_init',
            task: () => initStatsRuntimeHealth({ reason: 'service_init' }),
            eventLogStore,
        });
        await TabTimeTracker.init();
        await cycleStateManager.init();

        const statsRetentionResult = await statsRetentionJob.run({
            now: Date.now(),
            maxDays: maxDaysStored,
        });
        await recordStatsRetentionDiagnostics({
            eventLogStore,
            result: statsRetentionResult,
        });

        setRolloverLifecycle(rolloverLifecycle);
        await loadStatsCache(Date.now());
        await runStatsMutationBatch(
            () => TabTimeTracker.replayPendingSessionCommit({ skipCacheLoad: true }),
        );
        await settingsService.ensureSettingsCache();
        await initializeArtifactDisclosure();
        await restoreSettingsPropagation();
        await runBestEffortBootstrapTask({
            label: 'nudge_terminal_outbox_restore',
            task: drainNudgeTerminalOutbox,
            eventLogStore,
        });
        await runBestEffortBootstrapTask({
            label: 'clse_labs_init',
            task: initializeClseLabs,
            eventLogStore,
        });
        runDetachedBootstrapTask({
            label: 'boot_prewarm_service_init',
            task: () => bootPrewarmService.ensureWarm({ reason: 'service_init' }),
        });
        reportDashboardBootReadReady({
            source: 'tracking_service_bootstrap',
            statsCacheReady: true,
            settingsCacheReady: true,
            artifactDisclosureReady: true,
            cycleStateReady: true,
            clseBootstrapSettled: true,
            bootPrewarmStarted: true,
        });
        runDetachedBootstrapTask({
            label: 'history_cleanup_activation_reconciliation',
            task: reconcileHistoryCleanupOnActivation,
        });
        await runPostDashboardBootStage('bookmark_sync', () => syncBlockedBookmarksSafely());
        await runPostDashboardBootStage('nudge_debt', () => runBestEffortBootstrapTask({
            label: 'nudge_debt_session_reconciliation',
            task: reconcileNudgeDebtSession,
            eventLogStore,
        }));
        await runPostDashboardBootStage('pending_sweep', () => runBestEffortBootstrapTask({
            label: 'nudge_pending_init_sweep',
            task: () => runNudgePendingSweep('init'),
            eventLogStore,
        }));
        await runPostDashboardBootStage('global_cap', () => checkGlobalCapStatus(Date.now(), {
            reportBootPhase: (phase, outcome) => reportPostDashboardBootStage(`global_cap_${phase}`, outcome),
        }));
        await runPostDashboardBootStage('alarm', () => ensureAlarm({ browserPort }));
        await runPostDashboardBootStage('idle', () => setupIdleDetection());
        await runPostDashboardBootStage('focused_prime', () => primeFocusedWindowState({
            TabTimeTracker,
            faviconService,
            idleDetector,
            eventLogStore,
            runDetachedBootstrapTask,
            readLastFocusedWindow,
            windowIdNone,
        }));
        await runPostDashboardBootStage('managed_catchup', () => runDetachedBootstrapTask({
            label: 'managed_content_script_service_sync',
            task: () => reconcileStartupContentScripts({ reason: 'service_init' }),
        }));
    }

    async function runPostDashboardBootStage(stage, task) {
        reportPostDashboardBootStage(stage, { phase: 'started', failed: false });
        let failed = true;
        try {
            const result = await task();
            failed = false;
            return result;
        } finally {
            reportPostDashboardBootStage(stage, { phase: 'settled', failed });
        }
    }

    function registerListeners() {
        if (!browserListenersRegistered) {
            registerBrowserListeners({
                handleAlarm,
                handleTabCreated,
                handleTabActivated,
                handleWindowFocusChanged,
                handleTabUpdated,
                handleTabRemoved,
                handleTabReplaced,
                handleWebNavigationCommitted,
                handleWebNavigationHistoryStateUpdated,
                handleHistoryVisited: handleHistoryVisitedAfterFullInit,
                handleBookmarkCreated: handleBookmarkCreatedAfterFullInit,
                handleBookmarkChanged: handleBookmarkChangedAfterFullInit,
                handleBookmarkImportBegan: handleBookmarkImportBeganAfterFullInit,
                handleBookmarkImportEnded: handleBookmarkImportEndedAfterFullInit,
                handlePermissionAdded: handlePermissionAddedAfterFullInit,
                handlePermissionRemoved: handlePermissionRemovedAfterFullInit,
                handleBuildCapabilityActionClicked:
                    handleBuildCapabilityActionClickedAfterFullInit,
                combinedMessageHandler,
                // onSuspend is a terminal best-effort settlement hook. Waiting for
                // async startup here can consume the service worker's suspend budget.
                handleSuspend: (...args) => runProfileMutationAdmittedTask({
                    label: 'browser_event:runtime.onSuspend',
                    task: () => handleSuspend(...args),
                }),
            });
            browserListenersRegistered = true;
        }
        if (!notificationListenersRegistered) {
            notificationService.registerListeners({ waitForFullInit });
            notificationListenersRegistered = true;
        }
        return {
            browserListenersRegistered,
            notificationListenersRegistered,
        };
    }

    return {
        init,
        registerListeners,
    };
}
