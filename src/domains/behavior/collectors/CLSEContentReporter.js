import ClseSettingsQueryService from '../../../platform/storage/clse/ClseSettingsQueryService.js';
import { hasChromeRuntime, runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';

const REPORT_INTERVAL_MS = 1000;
const MAX_VELOCITY_SAMPLES_PER_FLUSH = 40;
const clseSettingsQueryService = ClseSettingsQueryService.getInstance();

export class CLSEContentReporter {
    constructor({
        hasRuntime = hasChromeRuntime,
        sendMessage = runtimeSendMessage,
        onCollectionDemandChange = null,
        settingsQueryService = clseSettingsQueryService,
    } = {}) {
        this._hasRuntime = hasRuntime;
        this._sendMessage = sendMessage;
        this._onCollectionDemandChange = typeof onCollectionDemandChange === 'function'
            ? onCollectionDemandChange
            : null;
        this._settingsQueryService = settingsQueryService;
        this._started = false;
        this._enabled = false;
        this._reportInterval = null;
        this._unbindFeatureFlag = null;

        this._scroll = {
            eventCount: 0,
            absDeltaSum: 0,
            dirChangeCount: 0,
            lastDirection: null,
            velocitySamples: [],
        };

        this._media = {
            seekCount: 0,
            rateChangeCount: 0,
            pausePlayCount: 0,
        };

        this._content = {
            addCount: 0,
            feedItemCount: 0,
        };

        this._handleFeatureFlagChange = (enabled) => {
            if (!this._started) return;
            this._setEnabled(enabled);
        };
    }

    start() {
        if (this._started) return;
        if (!this._hasRuntime()) return;
        this._started = true;

        this._unbindFeatureFlag = this._settingsQueryService.subscribeFeatureEnabled(
            this._handleFeatureFlagChange,
            { emitCurrent: true, fallback: false },
        );

        this._reportInterval = setInterval(() => this._flush(), REPORT_INTERVAL_MS);
    }

    stop() {
        if (!this._started) return;
        this._started = false;
        if (this._reportInterval) {
            clearInterval(this._reportInterval);
            this._reportInterval = null;
        }
        if (this._enabled) {
            this._flush();
        } else {
            this._reset();
        }
        this._setEnabled(false);
        if (typeof this._unbindFeatureFlag === 'function') {
            this._unbindFeatureFlag();
            this._unbindFeatureFlag = null;
        }
    }

    recordScrollSample({ deltaY, dtMs }) {
        if (!this._enabled) return;
        if (!Number.isFinite(deltaY) || deltaY === 0) return;

        const absDelta = Math.abs(deltaY);
        this._scroll.eventCount += 1;
        this._scroll.absDeltaSum += absDelta;

        const direction = deltaY > 0 ? 'down' : 'up';
        if (this._scroll.lastDirection && direction !== this._scroll.lastDirection) {
            this._scroll.dirChangeCount += 1;
        }
        this._scroll.lastDirection = direction;

        if (Number.isFinite(dtMs) && dtMs > 0 && dtMs < 1000) {
            const velocity = absDelta / (dtMs / 1000);
            if (this._scroll.velocitySamples.length < MAX_VELOCITY_SAMPLES_PER_FLUSH) {
                this._scroll.velocitySamples.push(velocity);
            }
        }
    }

    recordMediaEvent(type) {
        if (!this._enabled) return;
        switch (type) {
            case 'seek':
                this._media.seekCount += 1;
                break;
            case 'rate':
                this._media.rateChangeCount += 1;
                break;
            case 'play':
            case 'pause':
                this._media.pausePlayCount += 1;
                break;
            default:
                break;
        }
    }

    recordContentMutation({ addedNodes, feedItems } = {}) {
        if (!this._enabled) return;
        const addCount = Number(addedNodes);
        if (Number.isFinite(addCount) && addCount > 0) {
            this._content.addCount += Math.floor(addCount);
        }
        const feedCount = Number(feedItems);
        if (Number.isFinite(feedCount) && feedCount > 0) {
            this._content.feedItemCount += Math.floor(feedCount);
        }
    }

    _setEnabled(enabled) {
        this._enabled = !!enabled;
        if (!this._enabled) {
            this._reset();
        }
        this._onCollectionDemandChange?.(this._enabled);
    }

    _flush() {
        if (!this._enabled) return;

        const hasScroll = this._scroll.eventCount > 0 || this._scroll.velocitySamples.length > 0;
        if (hasScroll) {
            const payload = {
                event_count: this._scroll.eventCount,
                abs_delta_sum: this._scroll.absDeltaSum,
                dir_change_count: this._scroll.dirChangeCount,
                velocity_samples: this._scroll.velocitySamples.slice(0, 20),
            };
            try {
                this._sendMessage({ type: 'CLSE_SCROLL_DATA', payload });
            } catch {
                // Ignore send failures (inactive extension context)
            }
        }

        const hasMedia = this._media.seekCount > 0
            || this._media.rateChangeCount > 0
            || this._media.pausePlayCount > 0;
        if (hasMedia) {
            const payload = {
                seek_count: this._media.seekCount,
                rate_change_count: this._media.rateChangeCount,
                pause_play_count: this._media.pausePlayCount,
            };
            try {
                this._sendMessage({ type: 'CLSE_MEDIA_DATA', payload });
            } catch {
                // Ignore send failures (inactive extension context)
            }
        }

        const hasContent = this._content.addCount > 0 || this._content.feedItemCount > 0;
        if (hasContent) {
            const payload = {
                content_add_count: this._content.addCount,
                feed_item_add_count: this._content.feedItemCount,
            };
            try {
                this._sendMessage({ type: 'CLSE_CONTENT_DATA', payload });
            } catch {
                // Ignore send failures (inactive extension context)
            }
        }

        this._reset();
    }

    _reset() {
        this._scroll.eventCount = 0;
        this._scroll.absDeltaSum = 0;
        this._scroll.dirChangeCount = 0;
        this._scroll.lastDirection = null;
        this._scroll.velocitySamples = [];

        this._media.seekCount = 0;
        this._media.rateChangeCount = 0;
        this._media.pausePlayCount = 0;

        this._content.addCount = 0;
        this._content.feedItemCount = 0;
    }
}
