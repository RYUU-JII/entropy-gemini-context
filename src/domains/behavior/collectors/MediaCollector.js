/**
 * MediaCollector - Media Playback Event Collector
 * 
 * Collects (via message from content script):
 * - media_seek_count: Number of seek events
 * - media_rate_change_count: Playback rate changes
 * - media_pause_play_count: Pause/play toggles
 * 
 * Runs in: Background Service Worker (receives messages from content scripts)
 */

import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationMessageIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveMediaBrowserPort(browserPort) {
    if (
        typeof browserPort?.runtimeOnMessageAddListener !== 'function'
        || typeof browserPort?.runtimeOnMessageRemoveListener !== 'function'
    ) {
        throw new Error('CLSE_MEDIA_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

export class MediaCollector {
    constructor(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted } = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveMediaBrowserPort(browserPort);
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

        // Listen for media data from content scripts
        this._listener = (message, sender, sendResponse) => {
            if (message?.type !== 'CLSE_MEDIA_DATA') return false;
            return runCLSEProfileMutationMessageIngress(
                this.profileMutationRuntimeAdmission,
                {
                    label: 'clse_media_runtime_message',
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

                        if (typeof data.seek_count === 'number') {
                            this.ringBuffer.add('media_seek_count', data.seek_count);
                        }
                        if (typeof data.rate_change_count === 'number') {
                            this.ringBuffer.add('media_rate_change_count', data.rate_change_count);
                        }
                        if (typeof data.pause_play_count === 'number') {
                            this.ringBuffer.add('media_pause_play_count', data.pause_play_count);
                        }

                        await this.onRuntimeMutationCommitted?.();
                        return { received: true };
                    },
                },
            );
        };

        this.browserPort.runtimeOnMessageAddListener(this._listener);
        console.debug('[CLSE:MediaCollector] Started');
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._listener) {
            this.browserPort.runtimeOnMessageRemoveListener(this._listener);
            this._listener = null;
        }
        console.debug('[CLSE:MediaCollector] Stopped');
    }
}
