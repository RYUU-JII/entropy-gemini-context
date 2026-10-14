/**
 * ScrollCollector - Scroll Event Collector
 * 
 * Collects (via message from content script):
 * - scroll_event_count: Number of scroll events
 * - scroll_abs_delta_sum: Absolute sum of scroll deltas
 * - scroll_dir_change_count: Direction changes (up/down)
 * - scroll_velocity_mean/var: Welford online mean/variance
 * 
 * Runs in: Background Service Worker (receives messages from content scripts)
 * 
 * Note: This collector receives aggregated scroll data from content scripts
 * via runtime messaging. Content scripts should batch scroll events
 * and send summaries every ~1 second to minimize overhead.
 */

import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { shouldCollectCLSEEvent } from './CLSEGate.js';
import {
    requireCLSEProfileMutationRuntimeAdmission,
    runCLSEProfileMutationMessageIngress,
} from '../clseProfileMutationRuntimeAdmission.js';

function resolveScrollBrowserPort(browserPort) {
    if (
        typeof browserPort?.runtimeOnMessageAddListener !== 'function'
        || typeof browserPort?.runtimeOnMessageRemoveListener !== 'function'
    ) {
        throw new Error('CLSE_SCROLL_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

export class ScrollCollector {
    constructor(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted } = {}) {
        this.ringBuffer = ringBuffer;
        this.browserPort = resolveScrollBrowserPort(browserPort);
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

        // Listen for scroll data from content scripts
        this._listener = (message, sender, sendResponse) => {
            if (message?.type !== 'CLSE_SCROLL_DATA') return false;
            return runCLSEProfileMutationMessageIngress(
                this.profileMutationRuntimeAdmission,
                {
                    label: 'clse_scroll_runtime_message',
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

                        // Increment counters
                        if (typeof data.event_count === 'number') {
                            this.ringBuffer.add('scroll_event_count', data.event_count);
                        }
                        if (typeof data.abs_delta_sum === 'number') {
                            this.ringBuffer.add('scroll_abs_delta_sum', data.abs_delta_sum);
                        }
                        if (typeof data.dir_change_count === 'number') {
                            this.ringBuffer.add('scroll_dir_change_count', data.dir_change_count);
                        }

                        // Update Welford running mean/variance with new samples
                        if (typeof data.velocity_samples === 'object' && Array.isArray(data.velocity_samples)) {
                            for (const v of data.velocity_samples) {
                                this.ringBuffer.updateWelford('scroll', v);
                            }
                        }

                        await this.onRuntimeMutationCommitted?.();
                        return { received: true };
                    },
                },
            );
        };

        this.browserPort.runtimeOnMessageAddListener(this._listener);
        console.debug('[CLSE:ScrollCollector] Started');
    }

    stop() {
        if (!this._isRunning) return;
        this._isRunning = false;

        if (this._listener) {
            this.browserPort.runtimeOnMessageRemoveListener(this._listener);
            this._listener = null;
        }
        console.debug('[CLSE:ScrollCollector] Stopped');
    }
}

// ============================================================
// Content Script Helper (to be used in content scripts)
// ============================================================

/**
 * ScrollReporter - Content Script side scroll data reporter
 * 
 * Usage in content script:
 * ```
 * const reporter = new ScrollReporter();
 * reporter.start();
 * // ... on page unload:
 * reporter.stop();
 * ```
 */
export class ScrollReporter {
    constructor({ sendMessage = runtimeSendMessage } = {}) {
        this._sendMessage = sendMessage;
        this._events = [];
        this._lastDirection = null;
        this._dirChanges = 0;
        this._absSum = 0;
        this._velocitySamples = [];
        this._lastScrollTime = 0;
        this._lastScrollY = 0;
        this._reportInterval = null;
        this._scrollHandler = null;
    }

    start() {
        this._scrollHandler = (e) => {
            const now = performance.now();
            const deltaY = e.deltaY || 0;
            const absDelta = Math.abs(deltaY);

            this._events.push({ ts: now, delta: deltaY });
            this._absSum += absDelta;

            // Direction change detection
            const direction = deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : null;
            if (direction && this._lastDirection && direction !== this._lastDirection) {
                this._dirChanges++;
            }
            if (direction) this._lastDirection = direction;

            // Velocity calculation
            if (this._lastScrollTime > 0) {
                const dt = (now - this._lastScrollTime) / 1000; // seconds
                if (dt > 0 && dt < 1) { // Ignore if > 1 second gap
                    const velocity = absDelta / dt;
                    this._velocitySamples.push(velocity);
                }
            }
            this._lastScrollTime = now;
        };

        window.addEventListener('wheel', this._scrollHandler, { passive: true });

        // Report every 1 second
        this._reportInterval = setInterval(() => this._report(), 1000);
    }

    stop() {
        if (this._scrollHandler) {
            window.removeEventListener('wheel', this._scrollHandler);
            this._scrollHandler = null;
        }
        if (this._reportInterval) {
            clearInterval(this._reportInterval);
            this._reportInterval = null;
        }
        // Final report
        this._report();
    }

    _report() {
        if (this._events.length === 0 && this._velocitySamples.length === 0) return;

        try {
            this._sendMessage({
                type: 'CLSE_SCROLL_DATA',
                payload: {
                    event_count: this._events.length,
                    abs_delta_sum: this._absSum,
                    dir_change_count: this._dirChanges,
                    velocity_samples: this._velocitySamples.slice(0, 20), // Limit samples
                },
            });
        } catch (err) {
            // Extension context may be invalid
        }

        // Reset for next interval
        this._events = [];
        this._absSum = 0;
        this._dirChanges = 0;
        this._velocitySamples = [];
    }
}
