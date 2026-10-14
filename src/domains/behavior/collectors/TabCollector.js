/**
 * TabCollector - Tab & Window Event Collector
 * 
 * Collects:
 * - tab_switch_count: Number of tab switches (onActivated)
 * - tab_open_count: Number of open tabs at bucket end
 * - visibility_change_count: Document visibility changes
 * 
 * Runs in: Background Service Worker
 */

import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveTabBrowserPort(browserPort) {
    const requiredMethods = [
        'tabsOnActivatedAddListener',
        'tabsOnActivatedRemoveListener',
        'tabsOnCreatedAddListener',
        'tabsOnCreatedRemoveListener',
        'tabsOnRemovedAddListener',
        'tabsOnRemovedRemoveListener',
        'tabsQuery',
        'windowsOnFocusChangedAddListener',
        'windowsOnFocusChangedRemoveListener',
    ];
    const missingMethod = requiredMethods.find((methodName) => (
        typeof browserPort?.[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`CLSE_TAB_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
    }
    return browserPort;
}

export class TabCollector {
    constructor(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted } = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveTabBrowserPort(browserPort);
        this.profileMutationRuntimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
            profileMutationRuntimeAdmission,
        );
        this.onRuntimeMutationCommitted = typeof onRuntimeMutationCommitted === 'function'
            ? onRuntimeMutationCommitted
            : null;
        this._listeners = {};
        this._isRunning = false;
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        // Tab activated (switch)
        this._listeners.onActivated = (activeInfo) => {
            return this._runIngress('clse_tab_activated', async () => {
                const allowed = await shouldCollectCLSEEvent({
                    tabId: activeInfo?.tabId,
                    requireActiveTab: true,
                });
                if (allowed) this.ringBuffer.increment('tab_switch_count');
            });
        };
        this.browserPort.tabsOnActivatedAddListener(this._listeners.onActivated);

        // Tab created
        this._listeners.onCreated = () => {
            // We'll count open tabs at bucket rollup, but can track creation events
            return this._updateTabCount('clse_tab_created');
        };
        this.browserPort.tabsOnCreatedAddListener(this._listeners.onCreated);

        // Tab removed
        this._listeners.onRemoved = () => {
            return this._updateTabCount('clse_tab_removed');
        };
        this.browserPort.tabsOnRemovedAddListener(this._listeners.onRemoved);

        // Window focus change
        this._listeners.onFocusChanged = (windowId) => {
            if (windowId === this.browserPort.windowIdNone) return;
            return this._runIngress('clse_tab_window_focus_changed', async () => {
                const allowed = await shouldCollectCLSEEvent({ requireActiveTab: true });
                if (allowed) {
                    // Focus gained - could be returning from another app
                    this.ringBuffer.increment('visibility_change_count');
                }
            });
        };
        this.browserPort.windowsOnFocusChangedAddListener(this._listeners.onFocusChanged);

        // Initial tab count
        void this._updateTabCount('clse_tab_initial_count');

        console.debug('[CLSE:TabCollector] Started');
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._listeners.onActivated) {
            this.browserPort.tabsOnActivatedRemoveListener(this._listeners.onActivated);
        }
        if (this._listeners.onCreated) {
            this.browserPort.tabsOnCreatedRemoveListener(this._listeners.onCreated);
        }
        if (this._listeners.onRemoved) {
            this.browserPort.tabsOnRemovedRemoveListener(this._listeners.onRemoved);
        }
        if (this._listeners.onFocusChanged) {
            this.browserPort.windowsOnFocusChangedRemoveListener(this._listeners.onFocusChanged);
        }

        this._listeners = {};
        console.debug('[CLSE:TabCollector] Stopped');
    }

    _runIngress(label, task) {
        return runCLSEProfileMutationIngress(
            this.profileMutationRuntimeAdmission,
            {
                label,
                task: async () => {
                    await task();
                    await this.onRuntimeMutationCommitted?.();
                },
            },
        ).catch((error) => {
            console.debug('[CLSE:TabCollector] Runtime admission rejected:', error);
        });
    }

    _updateTabCount(label) {
        return this._runIngress(label, async () => {
            const allowed = await shouldCollectCLSEEvent({ requireActiveTab: true });
            if (!allowed) return;
            const tabs = await this.browserPort.tabsQuery({});
            this.ringBuffer.set('tab_open_count', tabs.length);
        });
    }
}
