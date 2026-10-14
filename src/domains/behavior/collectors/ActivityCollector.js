/**
 * ActivityCollector - Active/Idle Time Collector
 * 
 * Collects:
 * - active_ms: Time spent with browser/tab active
 * - idle_ms: Time spent idle or with browser unfocused
 * 
 * Runs in: Background Service Worker
 * Uses: browser idle API + window focus tracking
 */

import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveActivityBrowserPort(browserPort) {
    const requiredMethods = [
        'idleOnStateChangedAddListener',
        'idleOnStateChangedRemoveListener',
        'idleQueryState',
        'idleSetDetectionInterval',
        'windowsOnFocusChangedAddListener',
        'windowsOnFocusChangedRemoveListener',
    ];
    const missingMethod = requiredMethods.find((methodName) => (
        typeof browserPort?.[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`CLSE_ACTIVITY_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
    }
    return browserPort;
}

export class ActivityCollector {
    constructor(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted } = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveActivityBrowserPort(browserPort);
        this.profileMutationRuntimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
            profileMutationRuntimeAdmission,
        );
        this.onRuntimeMutationCommitted = typeof onRuntimeMutationCommitted === 'function'
            ? onRuntimeMutationCommitted
            : null;
        this._listeners = {};
        this._isRunning = false;
        this._mutationTail = Promise.resolve();

        // State tracking
        this._isActive = true;
        this._lastStateChange = Date.now();
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        // Idle state detection (15 second threshold)
        this.browserPort.idleSetDetectionInterval(15);

        this._listeners.onStateChanged = (newState) => {
            return this._recordTimeAndSwitch(
                newState === 'active',
                'clse_activity_idle_state_changed',
            );
        };
        this.browserPort.idleOnStateChangedAddListener(this._listeners.onStateChanged);

        // Window focus tracking (more granular than idle)
        this._listeners.onFocusChanged = (windowId) => {
            const isFocused = windowId !== this.browserPort.windowIdNone;
            return this._recordTimeAndSwitch(
                isFocused,
                'clse_activity_window_focus_changed',
            );
        };
        this.browserPort.windowsOnFocusChangedAddListener(this._listeners.onFocusChanged);

        console.debug('[CLSE:ActivityCollector] Started');
        return this._checkInitialState();
    }

    stop() {
        if (!this._isRunning) return this._mutationTail;
        this._isRunning = false;

        if (this._listeners.onStateChanged) {
            this.browserPort.idleOnStateChangedRemoveListener(this._listeners.onStateChanged);
        }
        if (this._listeners.onFocusChanged) {
            this.browserPort.windowsOnFocusChangedRemoveListener(this._listeners.onFocusChanged);
        }

        this._listeners = {};
        console.debug('[CLSE:ActivityCollector] Stopped');
        return this._mutationTail;
    }

    _enqueueMutation(operation) {
        const pending = this._mutationTail.then(operation);
        this._mutationTail = pending.catch(() => undefined);
        return pending;
    }

    _checkInitialState() {
        return this._enqueueMutation(() => (
            runCLSEProfileMutationIngress(
                this.profileMutationRuntimeAdmission,
                {
                    label: 'clse_activity_initial_state',
                    task: async () => {
                        const state = await this.browserPort.idleQueryState(15);
                        const observedAt = Date.now();
                        await this._recordTimeMutation({
                            eventAt: observedAt,
                            nextActive: state === 'active',
                        });
                    },
                },
            )
        )).catch((error) => {
            console.debug('[CLSE:ActivityCollector] Initial-state admission rejected:', error);
            throw error;
        });
    }

    _recordTime({ label, nextActive, targetTs, commitCheckpoint = true } = {}) {
        const eventAt = typeof targetTs === 'number' ? targetTs : Date.now();
        return this._enqueueMutation(() => (
            runCLSEProfileMutationIngress(
                this.profileMutationRuntimeAdmission,
                {
                    label,
                    task: () => this._recordTimeMutation({
                        eventAt,
                        nextActive,
                        commitCheckpoint,
                    }),
                },
            )
        )).catch((error) => {
            console.debug('[CLSE:ActivityCollector] Runtime admission rejected:', error);
            throw error;
        });
    }

    async _recordTimeMutation({ eventAt, nextActive, commitCheckpoint = true } = {}) {
        const previousTs = this._lastStateChange;
        const wasActive = this._isActive;
        const allowed = await shouldCollectCLSEEvent({ requireActiveTab: true });
        if (allowed && previousTs < eventAt) {
            this.ringBuffer.addDuration(wasActive ? 'active_ms' : 'idle_ms', previousTs, eventAt);
        }
        if (typeof nextActive === 'boolean' && eventAt >= previousTs) {
            this._isActive = nextActive;
        }
        this._lastStateChange = Math.max(previousTs, eventAt);
        if (commitCheckpoint) {
            await this.onRuntimeMutationCommitted?.();
        }
    }

    _recordTimeAndSwitch(isNowActive, label) {
        return this._recordTime({ label, nextActive: isNowActive });
    }

    /**
     * Settle active/idle duration up to current time (e.g. on alarm heartbeat)
     * @param {number} now - Target timestamp in ms
     */
    settle(now = Date.now(), { commitCheckpoint = true } = {}) {
        return this._recordTime({
            label: 'clse_activity_heartbeat_settle',
            targetTs: now,
            commitCheckpoint,
        });
    }

    /**
     * Serialize activity collector state
     */
    serialize() {
        return {
            isActive: this._isActive,
            lastStateChange: this._lastStateChange,
        };
    }

    /**
     * Hydrate activity collector state from snapshot
     */
    hydrate(snapshot) {
        if (!snapshot) return;
        if (typeof snapshot.isActive === 'boolean') {
            this._isActive = snapshot.isActive;
        }
        if (typeof snapshot.lastStateChange === 'number') {
            this._lastStateChange = snapshot.lastStateChange;
        }
    }
}
