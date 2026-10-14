import {
    recordProtectionFeatureError,
    recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
    isExtensionContextInvalidatedError,
} from '../../../platform/messaging/runtime/runtimeMessaging.js';
import {
    describeErrorMessage,
    formatRuntimeDiagnostic,
    reportRuntimeDiagnostic,
} from '../../../platform/diagnostics/runtimeDiagnosticConsole.js';

const READY_STATE_LABELS = Object.freeze({
    0: 'HAVE_NOTHING',
    1: 'HAVE_METADATA',
    2: 'HAVE_CURRENT_DATA',
    3: 'HAVE_FUTURE_DATA',
    4: 'HAVE_ENOUGH_DATA',
});

const NETWORK_STATE_LABELS = Object.freeze({
    0: 'NETWORK_EMPTY',
    1: 'NETWORK_IDLE',
    2: 'NETWORK_LOADING',
    3: 'NETWORK_NO_SOURCE',
});

export function roundMetric(value, digits = 3) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Number(num.toFixed(digits));
}

function getVideoSkipErrorMessage(error, fallback = 'VIDEO_SKIP_GUARD_FAILURE') {
    return describeErrorMessage(error, fallback);
}

function createMediaRangeReadError(error, details = {}) {
    const wrapped = new Error(getVideoSkipErrorMessage(error, 'VIDEO_MEDIA_RANGE_READ_FAILED'));
    wrapped.name = 'VideoMediaRangeReadError';
    wrapped.cause = error;
    wrapped.mediaSnapshotDetails = {
        readKind: 'time_range',
        ...details,
    };
    return wrapped;
}

export function getMediaSnapshotErrorDetails(error) {
    const details = error?.mediaSnapshotDetails;
    return details && typeof details === 'object' ? details : {};
}

export function describeVideoElement(video) {
    if (!(video instanceof HTMLVideoElement)) return { tagName: 'unknown' };
    let currentTime = null;
    let duration = null;
    try {
        currentTime = roundMetric(video.currentTime);
        duration = roundMetric(video.duration);
    } catch (_) {
        // Keep failure reporting focused on the original operation.
    }
    return {
        tagName: 'video',
        currentTime,
        duration,
        hasSrc: !!video.currentSrc || !!video.src,
    };
}

export function reportVideoSkipFailure(phase, error, details = {}) {
    const diagnostic = {
        phase,
        error: getVideoSkipErrorMessage(error),
        ...details,
    };
    // Losing the extension context is how an orphaned content script ends, not a fault it
    // can report or recover from. Keep it in the diagnostics record, off the console.
    if (isExtensionContextInvalidatedError(error)) {
        recordProtectionFeatureEvent('videoSkipGuard', 'extension_context_invalidated', diagnostic);
        return diagnostic;
    }
    recordProtectionFeatureError('videoSkipGuard', error, diagnostic);
    reportRuntimeDiagnostic({
        scope: 'VideoSkipManager',
        severity: 'warn',
        event: 'runtime_failure',
        code: 'VIDEO_SKIP_GUARD_FAILURE',
        error,
        fields: { phase, ...details },
    });
    return diagnostic;
}

function formatMediaState(map, value, fallbackPrefix) {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    const label = map[num];
    return label ? `${label}(${num})` : `${fallbackPrefix}(${num})`;
}

export function formatReadyState(value) {
    return formatMediaState(READY_STATE_LABELS, value, 'READY_STATE');
}

export function formatNetworkState(value) {
    return formatMediaState(NETWORK_STATE_LABELS, value, 'NETWORK_STATE');
}

function readTimeRangeLength(ranges, {
    rangeKind = 'range',
    fallback = 0,
    throwOnReadFailure = false,
} = {}) {
    if (!ranges) return fallback;
    try {
        const length = ranges.length;
        return typeof length === 'number' ? length : fallback;
    } catch (error) {
        if (throwOnReadFailure) {
            throw createMediaRangeReadError(error, {
                rangeKind,
                operation: 'length',
            });
        }
        return fallback;
    }
}

function readTimeRangeValue(ranges, operation, index, {
    rangeKind = 'range',
    throwOnReadFailure = false,
} = {}) {
    try {
        return ranges[operation](index);
    } catch (error) {
        if (throwOnReadFailure) {
            throw createMediaRangeReadError(error, {
                rangeKind,
                operation,
                index,
            });
        }
        return null;
    }
}

function readTimeRanges(ranges, {
    limit = 4,
    rangeKind = 'range',
    throwOnReadFailure = false,
} = {}) {
    const length = readTimeRangeLength(ranges, { rangeKind, fallback: 0, throwOnReadFailure });
    if (!length) return [];
    const snapshot = [];
    const capped = Math.min(length, limit);
    const readOptions = { rangeKind, throwOnReadFailure };
    for (let i = 0; i < capped; i += 1) {
        const start = readTimeRangeValue(ranges, 'start', i, readOptions);
        const end = start === null ? null : readTimeRangeValue(ranges, 'end', i, readOptions);
        if (start === null || end === null) break;
        snapshot.push({
            start: roundMetric(start),
            end: roundMetric(end),
        });
    }
    return snapshot;
}

export function findActiveRangeEnd(ranges, currentTime, {
    rangeKind = 'range',
    throwOnReadFailure = false,
} = {}) {
    const length = readTimeRangeLength(ranges, { rangeKind, fallback: 0, throwOnReadFailure });
    if (!length) return null;
    const current = Number(currentTime);
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const readOptions = { rangeKind, throwOnReadFailure };
    for (let i = 0; i < length; i += 1) {
        const start = readTimeRangeValue(ranges, 'start', i, readOptions);
        const end = start === null ? null : readTimeRangeValue(ranges, 'end', i, readOptions);
        if (start === null || end === null) return null;
        if (safeCurrent >= start && safeCurrent <= end) {
            return end;
        }
    }
    return null;
}

export function buildMediaSnapshot(video) {
    if (!(video instanceof HTMLVideoElement)) return null;
    const currentTime = Number(video.currentTime) || 0;
    const activeBufferedEnd = findActiveRangeEnd(video.buffered, currentTime, {
        rangeKind: 'buffered',
        throwOnReadFailure: true,
    });
    const activeSeekableEnd = findActiveRangeEnd(video.seekable, currentTime, {
        rangeKind: 'seekable',
        throwOnReadFailure: true,
    });
    return {
        currentTime: roundMetric(currentTime),
        duration: roundMetric(video.duration),
        paused: !!video.paused,
        ended: !!video.ended,
        seeking: !!video.seeking,
        playbackRate: roundMetric(video.playbackRate),
        readyState: formatReadyState(video.readyState),
        networkState: formatNetworkState(video.networkState),
        bufferedAheadSec: roundMetric(
            Number.isFinite(activeBufferedEnd) ? Math.max(0, activeBufferedEnd - currentTime) : null
        ),
        seekableAheadSec: roundMetric(
            Number.isFinite(activeSeekableEnd) ? Math.max(0, activeSeekableEnd - currentTime) : null
        ),
        buffered: readTimeRanges(video.buffered, {
            rangeKind: 'buffered',
            throwOnReadFailure: true,
        }),
        seekable: readTimeRanges(video.seekable, {
            rangeKind: 'seekable',
            throwOnReadFailure: true,
        }),
    };
}

export function buildPoolSnapshot(pool) {
    if (!pool || typeof pool !== 'object') return null;
    return {
        cooldownUntil: Math.max(0, Math.floor(Number(pool.cooldownUntil) || 0)),
        updatedAt: Number(pool.updatedAt) || 0,
    };
}

export function buildStateSnapshot(st) {
    if (!st || typeof st !== 'object') return null;
    const blockedForwardSeek = st.lastBlockedForwardSeek && typeof st.lastBlockedForwardSeek === 'object'
        ? {
            from: roundMetric(st.lastBlockedForwardSeek.from),
            to: roundMetric(st.lastBlockedForwardSeek.to),
            reason: st.lastBlockedForwardSeek.reason || null,
            blockedAt: Number(st.lastBlockedForwardSeek.blockedAt) || 0,
            expiresAt: Number(st.lastBlockedForwardSeek.expiresAt) || 0,
            remainingMs: Math.max(
                0,
                Math.floor((Number(st.lastBlockedForwardSeek.expiresAt) || 0) - Date.now())
            ),
        }
        : null;
    return {
        lastStableTime: roundMetric(st.lastStableTime),
        lastChargeTime: roundMetric(st.lastChargeTime),
        reverting: !!st.reverting,
        revertTargetTime: roundMetric(st.revertTargetTime),
        revertWasPlaying: !!st.revertWasPlaying,
        lastBlockedForwardSeek: blockedForwardSeek,
    };
}

export function buildDomEventSnapshot(event) {
    if (!event || typeof event !== 'object') return null;
    return {
        type: typeof event.type === 'string' ? event.type : null,
        isTrusted: event.isTrusted === true,
        timeStamp: roundMetric(event.timeStamp),
    };
}

export function buildFrameContextSnapshot() {
    if (typeof window === 'undefined') return null;
    const snapshot = {};
    try {
        snapshot.topFrame = window.top === window;
    } catch (error) {
        snapshot.topFrame = null;
        snapshot.topFrameError = getVideoSkipErrorMessage(error);
    }
    try {
        snapshot.hasParentFrame = window.parent !== window;
    } catch (error) {
        snapshot.hasParentFrame = null;
        snapshot.parentFrameError = getVideoSkipErrorMessage(error);
    }
    try {
        snapshot.topLocationReadable = window.top === window || !!window.top?.location?.href;
    } catch (_) {
        snapshot.topLocationReadable = false;
    }
    try {
        const frameElement = window.frameElement;
        snapshot.frameElementTagName = frameElement?.tagName
            ? String(frameElement.tagName).toLowerCase()
            : null;
    } catch (error) {
        snapshot.frameElementTagName = null;
        snapshot.frameElementError = getVideoSkipErrorMessage(error);
    }
    if (typeof document !== 'undefined') {
        snapshot.visibilityState = document.visibilityState || null;
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement || null;
        snapshot.fullscreenElementTagName = fullscreenElement?.tagName
            ? String(fullscreenElement.tagName).toLowerCase()
            : null;
    }
    return snapshot;
}
