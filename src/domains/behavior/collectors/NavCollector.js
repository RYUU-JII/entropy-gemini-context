/**
 * NavCollector - Navigation Event Collector
 * 
 * Collects:
 * - nav_count: Total navigation events
 * - back_forward_count: Back/forward navigations
 * - same_site_jump_count: Same-site navigations
 * - cross_site_jump_count: Cross-site navigations
 * 
 * Runs in: Background Service Worker
 */

import { getHostname } from '../../../lib/url.js';
import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveNavBrowserPort(browserPort) {
    const requiredMethods = [
        'webNavigationOnCommittedAddListener',
        'webNavigationOnCommittedRemoveListener',
        'webNavigationOnCompletedAddListener',
        'webNavigationOnCompletedRemoveListener',
        'webNavigationOnHistoryStateUpdatedAddListener',
        'webNavigationOnHistoryStateUpdatedRemoveListener',
    ];
    const missingMethod = requiredMethods.find((methodName) => (
        typeof browserPort?.[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`CLSE_NAV_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
    }
    return browserPort;
}

export class NavCollector {
    constructor(ringBuffer, options = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveNavBrowserPort(options.browserPort);
        this.profileMutationRuntimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
            options.profileMutationRuntimeAdmission,
        );
        this.onRuntimeMutationCommitted = typeof options.onRuntimeMutationCommitted === 'function'
            ? options.onRuntimeMutationCommitted
            : null;
        this._listeners = {};
        this._isRunning = false;
        this._lastDomain = new Map(); // tabId -> last domain
        this._onNavigation = options.onNavigation || null; // Callback for loop detection
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        // Navigation completed
        this._listeners.onCompleted = (details) => {
            // Only track main frame navigations
            if (details.frameId !== 0) return;
            return this._runIngress('clse_navigation_completed', async () => {
                const allowed = await shouldCollectCLSEEvent({ url: details.url, tabId: details.tabId });
                if (!allowed) return;

                this.ringBuffer.increment('nav_count');

                const tabId = details.tabId;
                const currentDomain = getHostname(details.url);
                const lastDomain = this._lastDomain.get(tabId);

                if (lastDomain && currentDomain) {
                    if (currentDomain === lastDomain) {
                        this.ringBuffer.increment('same_site_jump_count');
                    } else {
                        this.ringBuffer.increment('cross_site_jump_count');
                    }
                }

                if (currentDomain) {
                    this._lastDomain.set(tabId, currentDomain);
                }

                // Notify loop detector
                await this._notifyNavigation(details.url);
            });
        };
        this.browserPort.webNavigationOnCompletedAddListener(this._listeners.onCompleted);

        // History state updated (SPA navigations)
        this._listeners.onHistoryStateUpdated = (details) => {
            if (details.frameId !== 0) return;
            return this._runIngress('clse_navigation_history_state_updated', async () => {
                const allowed = await shouldCollectCLSEEvent({ url: details.url, tabId: details.tabId });
                if (!allowed) return;

                this.ringBuffer.increment('nav_count');

                const tabId = details.tabId;
                const currentDomain = getHostname(details.url);
                const lastDomain = this._lastDomain.get(tabId);
                if (lastDomain && currentDomain) {
                    if (currentDomain === lastDomain) {
                        this.ringBuffer.increment('same_site_jump_count');
                    } else {
                        this.ringBuffer.increment('cross_site_jump_count');
                    }
                }
                if (currentDomain) {
                    this._lastDomain.set(tabId, currentDomain);
                }

                await this._notifyNavigation(details.url);
            });
        };
        this.browserPort.webNavigationOnHistoryStateUpdatedAddListener(this._listeners.onHistoryStateUpdated);

        // Back/Forward detection via transitionType
        this._listeners.onCommitted = (details) => {
            if (details.frameId !== 0) return;
            return this._runIngress('clse_navigation_committed', async () => {
                const allowed = await shouldCollectCLSEEvent({ url: details.url, tabId: details.tabId });
                if (!allowed) return;
                const qualifiers = details.transitionQualifiers || [];
                if (qualifiers.includes('forward_back')) {
                    this.ringBuffer.increment('back_forward_count');
                }
            });
        };
        this.browserPort.webNavigationOnCommittedAddListener(this._listeners.onCommitted);

        console.debug('[CLSE:NavCollector] Started');
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._listeners.onCompleted) {
            this.browserPort.webNavigationOnCompletedRemoveListener(this._listeners.onCompleted);
        }
        if (this._listeners.onHistoryStateUpdated) {
            this.browserPort.webNavigationOnHistoryStateUpdatedRemoveListener(this._listeners.onHistoryStateUpdated);
        }
        if (this._listeners.onCommitted) {
            this.browserPort.webNavigationOnCommittedRemoveListener(this._listeners.onCommitted);
        }

        this._listeners = {};
        this._lastDomain.clear();
        console.debug('[CLSE:NavCollector] Stopped');
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
            console.warn('[CLSE:NavCollector] Runtime admission rejected:', error);
        });
    }

    async _notifyNavigation(url) {
        if (!this._onNavigation || !url) return;
        try {
            await this._onNavigation(url);
        } catch (err) {
            console.warn('[CLSE:NavCollector] onNavigation callback failed:', err);
        }
    }
}
