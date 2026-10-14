import { TRACKING_OBSERVATION_SUPERSEDED } from './trackingTabActivityObservation.js';

function requireTickRunnerFunction(fn, errorCode) {
    if (typeof fn !== 'function') {
        throw new Error(errorCode);
    }
}

function requireTickRunnerOwnerMethod(owner, methodName, errorCode) {
    if (!owner || typeof owner[methodName] !== 'function') {
        throw new Error(errorCode);
    }
}

const TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES = Object.freeze({
    OPEN: 'open',
    QUIESCING: 'quiescing',
    QUIESCED: 'quiesced',
});

export function createTrackingTickRunner({
    TabTimeTracker,
    trackingIntervalMs,
    loadStatsCache,
    checkScheduleStatus,
    checkGlobalCapStatus,
    checkCoolingCurveSteps,
    maybeTriggerProtectionNudge,
    runStatsMutationBatch,
    flushTacticalLogsWrapper,
    getTacticalBuffer = null,
    browserPort,
    statsRuntimeHealthLedger,
    observeGateEntryPresence,
    ensoCadenceBridge = null,
    skippedTickFlushDelayMs = 1000,
} = {}) {
    let tickInFlight = false;
    let lastTickAt = 0;
    let skippedTickFlushTimeoutId = null;
    let skippedTickFlushWorkTail = Promise.resolve();
    let activeTickPromise = null;
    let profileMutationPhase = TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.OPEN;
    let profileMutationQuiescePromise = null;

    requireTickRunnerFunction(flushTacticalLogsWrapper, 'TRACKING_TICK_RUNNER_TACTICAL_FLUSH_REQUIRED');
    requireTickRunnerOwnerMethod(
        statsRuntimeHealthLedger,
        'recordTickStarted',
        'TRACKING_TICK_RUNNER_RUNTIME_HEALTH_REQUIRED',
    );
    requireTickRunnerOwnerMethod(
        statsRuntimeHealthLedger,
        'recordTickCompleted',
        'TRACKING_TICK_RUNNER_RUNTIME_HEALTH_REQUIRED',
    );
    requireTickRunnerOwnerMethod(
        statsRuntimeHealthLedger,
        'recordTickFailed',
        'TRACKING_TICK_RUNNER_RUNTIME_HEALTH_REQUIRED',
    );
    requireTickRunnerOwnerMethod(
        browserPort,
        'tabsGet',
        'TRACKING_TICK_RUNNER_BROWSER_PORT_REQUIRED',
    );
    requireTickRunnerFunction(runStatsMutationBatch, 'TRACKING_TICK_RUNNER_MUTATION_BATCH_REQUIRED');
    requireTickRunnerFunction(checkCoolingCurveSteps, 'TRACKING_COOLING_CURVE_REFRESH_OWNER_REQUIRED');
    requireTickRunnerFunction(observeGateEntryPresence, 'TRACKING_GATE_ENTRY_OWNER_REQUIRED');
    for (const method of ['prepareTabActivityObservation', 'settleTabActivityObservation']) {
        requireTickRunnerOwnerMethod(TabTimeTracker, method, 'TRACKING_TICK_RUNNER_OBSERVATION_OWNER_REQUIRED');
    }

    function hasNumericPayload(value) {
        return Number.isFinite(Number(value)) && Number(value) > 0;
    }

    function hasObjectNumericPayload(source) {
        if (!source || typeof source !== 'object') return false;
        return Object.values(source).some((value) => hasNumericPayload(value));
    }

    function toErrorMessage(error) {
        return String(error?.message || error || 'UNKNOWN_ERROR');
    }

    function hasPendingTacticalLogPayload() {
        if (typeof getTacticalBuffer !== 'function') return false;
        return hasObjectNumericPayload(getTacticalBuffer());
    }

    function assertTickAdmissionOpen() {
        if (profileMutationPhase !== TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.OPEN) {
            throw new Error(
                `TRACKING_TICK_RUNNER_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
            );
        }
    }

    function clearSkippedTickFlushSchedule() {
        if (!skippedTickFlushTimeoutId) return;
        clearTimeout(skippedTickFlushTimeoutId);
        skippedTickFlushTimeoutId = null;
    }

    async function flushTacticalLogsAndReport(reason, label) {
        try {
            await flushTacticalLogsWrapper({ reason, requireSuccess: true });
        } catch (error) {
            console.error(`[TrackingTickRunner] Failed to flush ${label} tactical logs:`, error);
        }
    }

    function trackSkippedTickFlushWork(work) {
        const previousTail = skippedTickFlushWorkTail;
        const pending = Promise.resolve(work);
        skippedTickFlushWorkTail = Promise.all([previousTail, pending]).then(
            () => undefined,
            () => undefined,
        );
        return pending;
    }

    function scheduleSkippedTickFlush(reason) {
        const hasTacticalPayload = hasPendingTacticalLogPayload();
        if (!hasTacticalPayload) return;
        if (skippedTickFlushTimeoutId) return;

        const delayMs = Number.isFinite(Number(skippedTickFlushDelayMs))
            ? Math.max(0, Number(skippedTickFlushDelayMs))
            : 1000;
        skippedTickFlushTimeoutId = setTimeout(() => {
            skippedTickFlushTimeoutId = null;
            const flushTacticalPayload = hasPendingTacticalLogPayload();
            if (flushTacticalPayload) {
                void trackSkippedTickFlushWork(
                    flushTacticalLogsAndReport(reason, 'skipped'),
                );
            }
        }, delayMs);
    }

    async function recordRuntimeHealth(task, label) {
        if (typeof task !== 'function') return;
        try {
            await task();
        } catch (error) {
            console.warn(`[TrackingTickRunner] Failed to record ${label}:`, error);
        }
    }

    async function runAdmittedTick(source, ingressNow) {
        try {
            const ensoObservationRevision = ensoCadenceBridge?.captureObservation();
            await recordRuntimeHealth(
                () => statsRuntimeHealthLedger.recordTickStarted({ source, at: ingressNow }),
                'tick_started_health',
            );
            let mutationNow = ingressNow;
            let browserObservation;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const observation = await TabTimeTracker.prepareTabActivityObservation();
                await loadStatsCache(Date.now());
                try {
                    await runStatsMutationBatch(async ({ now }) => {
                        mutationNow = now;
                        browserObservation = await TabTimeTracker.settleTabActivityObservation(observation, now);
                    }, { force: true });
                    break;
                } catch (error) {
                    // One fresh observation, outside the queue. Never retry a
                    // partial fact commit, storage failure or unbounded churn.
                    if (attempt !== 0 || error?.code !== TRACKING_OBSERVATION_SUPERSEDED
                        || error.beforeMutation !== true) throw error;
                }
            }
            await observeGateEntryPresence({
                point: browserObservation.gateEntryPresence,
                isCurrent: () => TabTimeTracker.isConsumptionObservationCurrent(browserObservation.observationReceipt),
            });
            await ensoCadenceBridge?.observeBatch({
                point: browserObservation.ensoCadencePoint,
                focusedWindowId: browserObservation.focusedWindowId,
                revision: ensoObservationRevision,
                isCurrent: () => TabTimeTracker.isConsumptionObservationCurrent(browserObservation.observationReceipt),
            });
            await checkScheduleStatus();
            await checkGlobalCapStatus(mutationNow);
            await checkCoolingCurveSteps(mutationNow);

            const lastActiveTabId = TabTimeTracker.getLastActiveTabId();
            if (lastActiveTabId !== null) {
                try {
                    const tab = await browserPort.tabsGet(lastActiveTabId);
                    if (tab?.url) await maybeTriggerProtectionNudge(lastActiveTabId, tab.url);
                } catch (error) {
                    console.warn('[TrackingTickRunner] Failed to resolve last active tab for nudge trigger:', {
                        tabId: lastActiveTabId,
                        error: toErrorMessage(error),
                    });
                }
            }

            await recordRuntimeHealth(
                () => statsRuntimeHealthLedger.recordTickCompleted({
                    source,
                    at: Date.now(),
                    batchSummary: TabTimeTracker.getLastTabActivityBatchSummary?.() ?? null,
                }),
                'tick_completed_health',
            );
        } catch (error) {
            await recordRuntimeHealth(
                () => statsRuntimeHealthLedger.recordTickFailed({ source, at: Date.now(), error }),
                'tick_failed_health',
            );
            console.error('Tick Error:', error);
        } finally {
            await flushTacticalLogsAndReport('heartbeat', 'heartbeat');
            tickInFlight = false;
        }
    }

    function runTick(source = 'alarm') {
        assertTickAdmissionOpen();
        const now = Date.now();
        if (tickInFlight) {
            scheduleSkippedTickFlush('tick_in_flight_skip');
            return Promise.resolve();
        }
        if (lastTickAt && now - lastTickAt < trackingIntervalMs * 0.5) {
            scheduleSkippedTickFlush('tick_throttle_skip');
            return Promise.resolve();
        }
        clearSkippedTickFlushSchedule();
        tickInFlight = true;
        console.log(`[TrackingService] Tick started (${source}) at ${new Date(now).toLocaleTimeString()}`);
        lastTickAt = now;
        const pending = runAdmittedTick(source, now);
        activeTickPromise = pending;
        void pending.then(
            () => {
                if (activeTickPromise === pending) activeTickPromise = null;
            },
            () => {
                if (activeTickPromise === pending) activeTickPromise = null;
            },
        );
        return pending;
    }

    function quiesceForProfileMutation() {
        if (
            profileMutationPhase
            === TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.QUIESCING
        ) {
            return profileMutationQuiescePromise;
        }
        if (
            profileMutationPhase
            === TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.QUIESCED
        ) {
            return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
        }

        profileMutationPhase = TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.QUIESCING;
        clearSkippedTickFlushSchedule();
        const admittedTick = activeTickPromise || Promise.resolve();
        const admittedSkippedFlushWork = skippedTickFlushWorkTail;
        profileMutationQuiescePromise = Promise.all([
            admittedTick,
            admittedSkippedFlushWork,
        ]).then(() => {
            profileMutationPhase = TRACKING_TICK_RUNNER_PROFILE_MUTATION_PHASES.QUIESCED;
            return Object.freeze({ quiesced: true, reused: false });
        });
        return profileMutationQuiescePromise;
    }

    return {
        runTick,
        quiesceForProfileMutation,
    };
}
