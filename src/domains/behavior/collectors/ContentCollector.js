/**
 * ContentCollector - DOM/Feed Mutation Collector
 *
 * Collects (via message from content script):
 * - content_add_count: Number of added nodes (coarse DOM growth)
 * - feed_item_add_count: Number of detected feed items added
 *
 * Runs in: Background Service Worker (receives messages from content scripts)
 */

import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationMessageIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveContentBrowserPort(browserPort) {
    if (
        typeof browserPort?.runtimeOnMessageAddListener !== 'function'
        || typeof browserPort?.runtimeOnMessageRemoveListener !== 'function'
    ) {
        throw new Error('CLSE_CONTENT_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

export class ContentCollector {
    constructor(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted } = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveContentBrowserPort(browserPort);
        this.profileMutationRuntimeAdmission = requireCLSEProfileMutationRuntimeAdmission(
            profileMutationRuntimeAdmission,
        );
        this.onRuntimeMutationCommitted = typeof onRuntimeMutationCommitted === 'function'
            ? onRuntimeMutationCommitted
            : null;
        this._listener = null;
        this._isRunning = false;
    }

    start() {
        if (this._isRunning) return;
        this._isRunning = true;

        this._listener = (message, sender, sendResponse) => {
            if (message?.type !== 'CLSE_CONTENT_DATA') return false;
            return runCLSEProfileMutationMessageIngress(
                this.profileMutationRuntimeAdmission,
                {
                    label: 'clse_content_runtime_message',
                    sendResponse,
                    task: async () => {
                        const allowed = await shouldCollectCLSEEvent({
                            url: sender?.tab?.url,
                            tabId: sender?.tab?.id,
                            sender,
                        });
                        if (!allowed) return { received: false, reason: 'blocked' };

                        const data = message.payload;
                        if (!data) return { received: false, reason: 'empty_payload' };

                        if (typeof data.content_add_count === 'number') {
                            this.ringBuffer.add('content_add_count', data.content_add_count);
                        }
                        if (typeof data.feed_item_add_count === 'number') {
                            this.ringBuffer.add('feed_item_add_count', data.feed_item_add_count);
                        }

                        await this.onRuntimeMutationCommitted?.();
                        return { received: true };
                    },
                },
            );
        };

        this.browserPort.runtimeOnMessageAddListener(this._listener);
        console.debug('[CLSE:ContentCollector] Started');
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._listener) {
            this.browserPort.runtimeOnMessageRemoveListener(this._listener);
            this._listener = null;
        }
        console.debug('[CLSE:ContentCollector] Stopped');
    }
}
