import {
    StatusIndicator,
} from '../visual/index.js';
import {
    recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';

import { CONFIG } from './constants.js';
import { clamp } from './utils.js';
import {
    findActiveRangeEnd,
    roundMetric,
} from './videoSkipRuntimeDiagnostics.js';
import { BUILD_ENABLE_VIDEO_SKIP_COOLDOWN } from '../../../platform/build/releaseCapabilities.js';

const DEBUG_PROGRESS_LOG_INTERVAL_MS = 1200;

const REQUIRED_PORT_METHODS = Object.freeze([
    'isOperational',
    'getActiveVideo',
    'setActiveVideo',
    'readCurrentTime',
    'getSeekAnchor',
    'shouldHoldStableAnchorForSeek',
    'reassertRevertTarget',
    'isSeekGestureRecent',
    'isAdActive',
    'isAdTransitionRecent',
    'handleMediaSourceChange',
    'buildSeekDecisionDetails',
    'buildSeekBlockPayload',
    'matchBlockedForwardSeekFollowup',
    'getPolicy',
    'blockForwardSeek',
    'setAlert',
    'clearAlert',
    'showSkipUi',
    'reportIndicator',
    'isDebugEnabled',
    'debugLog',
    'debugVideoEvent',
    'commitStablePosition',
    'commitProgressSample',
]);

// The cooldown ledger seam. Required only while BUILD_ENABLE_VIDEO_SKIP_COOLDOWN is on;
// with it off no pool exists, so demanding these would fail every port.
const REQUIRED_COOLDOWN_PORT_METHODS = Object.freeze([
    'readPool',
    'modifyPool',
    'getCooldownRemainingMs',
]);

function assertHandlerInputs(port, video, state) {
    if (!port || typeof port !== 'object') {
        throw new Error('VIDEO_SKIP_EVENT_HANDLER_PORT_REQUIRED');
    }
    const requiredMethods = BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
        ? [...REQUIRED_PORT_METHODS, ...REQUIRED_COOLDOWN_PORT_METHODS]
        : REQUIRED_PORT_METHODS;
    requiredMethods.forEach((methodName) => {
        if (typeof port[methodName] !== 'function') {
            throw new Error(`VIDEO_SKIP_EVENT_HANDLER_PORT_METHOD_REQUIRED:${methodName}`);
        }
    });
    if (!video || typeof video.addEventListener !== 'function') {
        throw new Error('VIDEO_SKIP_EVENT_HANDLER_VIDEO_REQUIRED');
    }
    if (!state || typeof state !== 'object') {
        throw new Error('VIDEO_SKIP_EVENT_HANDLER_STATE_REQUIRED');
    }
}

function recordVideoSkipEvent(port, eventName, payload) {
    const recordedWithDebugSnapshot = port.debugVideoEvent(eventName, payload) === true;
    if (!recordedWithDebugSnapshot) {
        recordProtectionFeatureEvent('videoSkipGuard', eventName, payload);
    }
}

export function createVideoSkipEventHandlers({
    port,
    video,
    state,
} = {}) {
    assertHandlerInputs(port, video, state);
    const st = state;
    const isEnabled = () => port.isOperational();

    const onTimeUpdate = () => {
        if (!isEnabled()) return;

        const current = port.readCurrentTime();
        if (port.shouldHoldStableAnchorForSeek(current)) {
            const anchor = port.getSeekAnchor();
            if (st.reverting && current - anchor > CONFIG.minForwardJumpSec) {
                port.reassertRevertTarget(anchor, 'timeupdate_revert_reasserted');
            }
            port.debugVideoEvent('timeupdate_anchor_held_for_seek', {
                from: roundMetric(anchor),
                to: roundMetric(current),
                delta: roundMetric(current - anchor),
                userGestureRecent: port.isSeekGestureRecent(),
                seeking: !!video.seeking,
            });
            port.reportIndicator();
            return;
        }
        port.commitStablePosition(current);
        port.reportIndicator();
    };

    const onSeeking = (event) => {
        if (!isEnabled()) return;
        port.setActiveVideo();

        const now = Date.now();
        const from = port.getSeekAnchor();
        const to = port.readCurrentTime();
        const delta = to - from;
        const userGestureRecent = port.isSeekGestureRecent(now);
        const seekDetails = port.buildSeekDecisionDetails({
            from,
            to,
            delta,
            now,
            event,
            reason: 'seeking_event_observed',
        });

        port.debugVideoEvent('seeking', seekDetails);

        if (st.reverting) {
            const target = Number.isFinite(st.revertTargetTime) ? st.revertTargetTime : from;
            port.reassertRevertTarget(target, 'revert_target_reasserted');

            if (delta > CONFIG.minForwardJumpSec && userGestureRecent) {
                port.setAlert('blocked');
                port.showSkipUi();
                StatusIndicator.pulseVideo();
                port.reportIndicator({ force: true });
                port.debugVideoEvent('seek_blocked_during_revert', {
                    delta: roundMetric(delta),
                    cooldownRemainingMs: 0,
                    mode: port.getPolicy().mode,
                });
            }
            return;
        }

        if (port.isAdActive() || port.isAdTransitionRecent()) {
            const t = clamp(to, 0, Number.MAX_SAFE_INTEGER);
            port.commitStablePosition(t);
            port.reportIndicator();
            const reason = port.isAdActive() ? 'ad_active' : 'ad_transition_recent';
            const payload = {
                ...seekDetails,
                seekingEvent: { ...seekDetails.seekingEvent, inputAttribution: 'ad_transition' },
                reason,
                targetTime: roundMetric(t),
                policyMode: port.getPolicy().mode,
            };
            recordVideoSkipEvent(port, 'seek_allowed_ad_transition', payload);
            return;
        }

        if (!(delta > CONFIG.minForwardJumpSec)) {
            recordProtectionFeatureEvent('videoSkipGuard', 'seek_ignored_small_delta', {
                ...seekDetails,
                reason: 'below_min_forward_jump',
            });
            return;
        }

        if (!userGestureRecent) {
            const followup = port.matchBlockedForwardSeekFollowup({ to, now });
            if (followup) {
                const payload = {
                    ...seekDetails,
                    reason: 'delayed_programmatic_followup',
                    followup,
                    policyMode: port.getPolicy().mode,
                };
                recordVideoSkipEvent(port, 'seek_blocked_delayed_programmatic_followup', payload);
                port.blockForwardSeek({
                    from,
                    to,
                    reason: 'delayed_programmatic_followup',
                });
                return;
            }
            const t = clamp(to, 0, Number.MAX_SAFE_INTEGER);
            port.commitStablePosition(t);
            port.reportIndicator();
            const payload = {
                ...seekDetails,
                reason: 'input_origin_unobserved',
                targetTime: roundMetric(t),
                policyMode: port.getPolicy().mode,
            };
            // A browser-issued seeking event proves a media change, not its
            // origin. Native control input can be hidden inside the UA tree.
            recordVideoSkipEvent(port, 'seek_allowed_unattributed', payload);
            return;
        }

        port.debugLog('seek_detected_user', { delta: roundMetric(delta) });
        recordProtectionFeatureEvent('videoSkipGuard', 'seek_detected_user', {
            ...seekDetails,
            reason: 'recent_user_gesture',
        });
        const policy = port.getPolicy();
        const payload = {
            ...seekDetails,
            ...port.buildSeekBlockPayload({ delta, from, to, policy }),
            reason: 'hard_block',
            policyMode: policy.mode,
        };
        recordVideoSkipEvent(port, 'seek_blocked_hard_block', payload);
        port.blockForwardSeek({ from, to, reason: 'hard_block' });
    };

    const buildDiagnosticHandler = (eventName) => () => {
        if (!isEnabled()) return;
        port.debugVideoEvent(eventName);
    };

    const onLoadedMetadata = () => {
        if (!isEnabled()) return;
        port.handleMediaSourceChange();
        port.reportIndicator({ force: true });
        port.debugVideoEvent('loadedmetadata');
    };

    const onProgress = () => {
        if (!isEnabled()) return;
        if (!port.isDebugEnabled()) return;
        const now = Date.now();
        const currentRangeEnd = findActiveRangeEnd(video.buffered, video.currentTime);
        const lastRangeEnd = st.lastProgressBufferedEnd;
        const hasLastRangeEnd = Number.isFinite(lastRangeEnd);
        const rangeDelta = Number.isFinite(currentRangeEnd) && hasLastRangeEnd
            ? currentRangeEnd - lastRangeEnd
            : null;
        const enoughTimePassed = now - (Number(st.lastProgressLogAt) || 0) >= DEBUG_PROGRESS_LOG_INTERVAL_MS;
        const rangeChangedEnough = !hasLastRangeEnd
            || !Number.isFinite(currentRangeEnd)
            || Math.abs(Number(rangeDelta) || 0) >= 0.75;
        if (!enoughTimePassed && !rangeChangedEnough) return;

        port.commitProgressSample({
            loggedAt: now,
            bufferedEnd: Number.isFinite(currentRangeEnd) ? currentRangeEnd : null,
        });
        port.debugVideoEvent('progress', {
            currentRangeEnd: roundMetric(currentRangeEnd),
            rangeDelta: roundMetric(rangeDelta),
        });
    };

    const onError = () => {
        if (!isEnabled()) return;
        const mediaError = video.error;
        port.debugVideoEvent('error', {
            errorCode: Number(mediaError?.code) || null,
            errorMessage: mediaError?.message || null,
        });
    };

    const onPlay = () => {
        if (!isEnabled()) return;
        port.setActiveVideo();
    };

    const onRateChange = () => {
        if (!isEnabled()) return;
        if (port.getActiveVideo() !== video) return;
        if (Number(video.playbackRate) > 1.25) {
            recordProtectionFeatureEvent('videoSkipGuard', 'playback_rate_fast', {
                playbackRate: roundMetric(video.playbackRate),
            });
        }
        port.reportIndicator({ force: true });
    };

    const reportActiveVideoState = () => {
        if (!isEnabled()) return;
        if (port.getActiveVideo() !== video) return;
        port.reportIndicator({ force: true });
    };

    const onEmptied = () => {
        if (!isEnabled()) return;
        port.handleMediaSourceChange();
        port.debugVideoEvent('emptied');
    };

    return {
        onTimeUpdate,
        onSeeking,
        onLoadedMetadata,
        onSeeked: buildDiagnosticHandler('seeked'),
        onWaiting: buildDiagnosticHandler('waiting'),
        onStalled: buildDiagnosticHandler('stalled'),
        onSuspend: buildDiagnosticHandler('suspend'),
        onEmptied,
        onCanPlay: buildDiagnosticHandler('canplay'),
        onCanPlayThrough: buildDiagnosticHandler('canplaythrough'),
        onPlaying: buildDiagnosticHandler('playing'),
        onProgress,
        onError,
        onPlay,
        onPause: reportActiveVideoState,
        onEnded: reportActiveVideoState,
        onRateChange,
    };
}
