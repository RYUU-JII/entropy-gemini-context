import {
    videoElementObserver,
    isObservedVideoElement,
} from '../video/VideoElementObserver.js';
import {
    setAttribute,
    removeAttribute,
    StatusIndicator,
} from '../visual/index.js';
import signalGate from '../../protection/content/runtime/ProtectionSignalGate.js';
import { SIGNAL_GATE_KEYS } from '../../protection/content/runtime/protectionSignalGateKeys.js';
import VideoSkipPoolRepository from '../../../platform/storage/runtime/VideoSkipPoolRepository.js';
import { BUILD_ENABLE_VIDEO_SKIP_COOLDOWN } from '../../../platform/build/releaseCapabilities.js';
import { isVideoSkipDebugEnabled } from '@friction-debug-flags';
import { resolveVideoSkipGuardProfile } from '../../settings/config/videoSkipGuard.js';
import {
    recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';

import { CONFIG } from './constants.js';
import { clamp, isFinitePositive } from './utils.js';
import {
    buildVideoIndicatorPayload,
    shouldEmitVideoIndicatorUpdate,
} from './videoSkipIndicator.js';
import {
    buildDomEventSnapshot,
    buildFrameContextSnapshot,
    buildMediaSnapshot,
    buildPoolSnapshot,
    buildStateSnapshot,
    describeVideoElement,
    findActiveRangeEnd,
    formatNetworkState,
    formatReadyState,
    getMediaSnapshotErrorDetails,
    reportVideoSkipFailure,
    roundMetric,
} from './videoSkipRuntimeDiagnostics.js';
import {
    buildVideoSkipGestureDiagnostics,
    buildVideoSkipUserGestureContext,
    isVideoSkipMediaSeekGestureRecent,
    isVideoSkipUserGestureRecent,
    resolveVideoSkipMediaGestureHoldUntil,
    resolveVideoSkipGestureVideo,
} from './videoSkipGestureContext.js';
import {
    attachVideoSkipListenerLedger,
    detachVideoSkipListenerLedger,
} from './videoSkipListenerLedger.js';
import {
  resolveVideoSkipMediaAdapter,
  releaseVideoSkipMediaTarget,
  VIDEO_SKIP_MEDIA_ADAPTER_IDS,
} from './videoSkipMediaAdapter.js';
import VideoSkipMainWorldActuatorTransport from './VideoSkipMainWorldActuatorTransport.js';
import {
    createVideoSkipEventHandlers,
} from './videoSkipEventHandlers.js';
import VideoSkipControlSurfaceRuntime from './VideoSkipControlSurfaceRuntime.js';
import {
    resolveVideoSkipControlSurfaceProfile,
} from './videoSkipControlSurfaceCatalog.js';

const VIDEO_SKIP_SIGNAL_KEY = SIGNAL_GATE_KEYS.VIDEO_SKIP_GUARD;
const DEBUG_FLAG_REFRESH_MS = 1000;
const USER_GESTURE_EVENTS = Object.freeze([
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'touchstart',
    'touchend',
    'keydown',
    'pointercancel',
    'touchcancel',
    'lostpointercapture',
    'blur',
]);
function createVideoSkipLifecycleError(message, errors) {
    const normalizedErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
    const AggregateErrorCtor = globalThis?.AggregateError;
    if (typeof AggregateErrorCtor === 'function') {
        return new AggregateErrorCtor(normalizedErrors, message);
    }
    const error = new Error(message);
    error.errors = normalizedErrors;
    if (normalizedErrors[0]) error.cause = normalizedErrors[0];
    return error;
}

function isPromiseLike(value) {
    return value && typeof value.then === 'function';
}

export default class VideoSkipManager {
    constructor({
        youtubeActuator = VideoSkipMainWorldActuatorTransport.getInstance(),
    } = {}) {
        this._active = false;
        this._observerUnsub = null;
        this._states = new WeakMap();
        this._videos = new Set();
        this._pendingListenerCleanup = new Map();
        this._userSettings = resolveVideoSkipGuardProfile();

        // Components
        this.storage = null;
        this._storageTeardownPromise = null;
        this._gestureTrackingOwned = false;
        this._fullscreenTrackingOwned = false;
        this._suppressSignalGateCleanup = false;

        // State
        this._activeVideo = null;
        this._lastUserGestureTs = 0;
        this._lastUserGesture = null;
        this._lastUserGestureVideo = null;
        this._mediaGestureSession = null;
        this._observedGestureEvents = new WeakSet();
        this._indicatorSnapshot = null;
        this._lastIndicatorAt = 0;
        this._indicatorAlertUntil = 0;
        this._indicatorAlertReason = null;
        this._indicatorAlertTimer = null;
        this._skipUiUntil = 0;
        this._skipUiTimer = null;
        this._mediaGestureHoldUntil = 0;
        this._debug = false;
        this._debugLastCheckTs = 0;
        this._youtubeActuator = youtubeActuator;
        this._controlSurface = null;

        // Bindings
        this._boundOnUserGesture = this._onUserGesture.bind(this);
        this._boundOnFullscreenChange = this._onFullscreenChange.bind(this);
        this._boundOnPointerBlock = this._blockPointerDuringRevert.bind(this);

        // UI Targeting
        this._droneTarget = null;
        this._boundOnVideoEnter = this._onVideoEnter.bind(this);
        this._boundOnVideoLeave = this._onVideoLeave.bind(this);

        this._signalGateCleanupUnsub = signalGate.registerCleanup(
            VIDEO_SKIP_SIGNAL_KEY,
            () => {
                if (this._suppressSignalGateCleanup) {
                    this._suppressSignalGateCleanup = false;
                    return null;
                }
                return this._cleanupInFlight({ deactivate: true });
            }
        );
    }

    // --- Public API ---

    apply(userSettings = {}) {
        if (this._storageTeardownPromise) {
            const error = new Error('VIDEO_SKIP_STORAGE_TEARDOWN_PENDING');
            reportVideoSkipFailure('manager_apply_storage_teardown_pending', error);
            throw error;
        }
        if (!this._active && this._hasResidualCleanupOwnership()) {
            const error = new Error('VIDEO_SKIP_CLEANUP_RETRY_REQUIRED');
            reportVideoSkipFailure('manager_apply_cleanup_retry_required', error);
            throw error;
        }
        this._debugLog('apply_called', { active: this._active });
        this._userSettings = resolveVideoSkipGuardProfile(userSettings);
        if (this._active) {
            signalGate.setFeatureEnabled(VIDEO_SKIP_SIGNAL_KEY, true, { reason: 'manager_apply' });
            this._syncControlSurface();
            recordProtectionFeatureEvent('videoSkipGuard', 'manager_apply', {
                mode: this._userSettings.mode,
                ...(BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
                    ? { cooldownMs: this._userSettings.cooldownMs }
                    : {}),
            });
            this._scanExistingVideos('active_reapply');
            this._reportIndicator({ force: true });
            return;
        }
        this._active = true;

        try {
            this._syncDebugMode(true);

            if (BUILD_ENABLE_VIDEO_SKIP_COOLDOWN) {
                this.storage = new VideoSkipPoolRepository();
                this.storage.setCallback(() => this._onStateChange());
                this.storage.setErrorCallback((error, details) => {
                    reportVideoSkipFailure('storage_persist', error, details);
                });
                this.storage.install();
                this._restoreStorageSnapshot();
            }
            this._installControlSurface();
            this._installUserGestureTracking();
            this._installFullscreenTracking();

            this._ensureObserver();
            const scan = this._scanExistingVideos('initial_apply');
            signalGate.setFeatureEnabled(VIDEO_SKIP_SIGNAL_KEY, true, { reason: 'manager_apply' });
            this._syncControlSurface();
            recordProtectionFeatureEvent('videoSkipGuard', 'manager_apply', {
                mode: this._userSettings.mode,
                ...(BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
                    ? { cooldownMs: this._userSettings.cooldownMs }
                    : {}),
            });
            if (this._videos.size === 0) {
                recordProtectionFeatureEvent('videoSkipGuard', 'no_html_video_observed', {
                    reason: 'no_top_frame_video_elements_at_apply',
                    scanCount: scan.scanCount,
                });
            }
            this._reportIndicator({ force: true });
            this._debugLog('manager_applied', {
                hostname: String(window.location?.hostname || ''),
                debugEnabled: this._debug,
            });
        } catch (error) {
            reportVideoSkipFailure('manager_apply', error, {
                mode: this._userSettings.mode,
            });
            try {
                this._cleanupInFlight({ deactivate: true, throwOnFailure: true });
            } catch (cleanupError) {
                if (error && typeof error === 'object') error.cleanupError = cleanupError;
            }
            this._disableSignalGateAfterOwnedCleanup('manager_apply_failed');
            this._active = false;
            throw error;
        }
    }

    remove() {
        if (!this._hasCleanupOwnership()) return this._storageTeardownPromise;
        let storageTeardownPromise = null;
        try {
            storageTeardownPromise = this._cleanupInFlight({
                deactivate: true,
                throwOnFailure: true,
            });
        } catch (error) {
            const removeError = createVideoSkipLifecycleError(
                'VIDEO_SKIP_MANAGER_REMOVE_FAILED',
                error?.errors || [error]
            );
            reportVideoSkipFailure('manager_remove', removeError);
            this._disableSignalGateAfterOwnedCleanup('manager_remove_failed_cleanup_deactivated');
            throw removeError;
        }
        this._disableSignalGateAfterOwnedCleanup('manager_remove');
        if (isPromiseLike(storageTeardownPromise)) {
            void storageTeardownPromise.then(
                () => {
                    recordProtectionFeatureEvent('videoSkipGuard', 'manager_remove');
                },
                (error) => {
                    reportVideoSkipFailure('manager_remove_storage_flush', error);
                }
            );
            return storageTeardownPromise;
        }
        recordProtectionFeatureEvent('videoSkipGuard', 'manager_remove');
        return null;
    }

    _isGateEnabled() {
        return signalGate.isFeatureEnabled(VIDEO_SKIP_SIGNAL_KEY);
    }

    _syncDebugMode(force = false) {
        const now = Date.now();
        if (!force && now - this._debugLastCheckTs < DEBUG_FLAG_REFRESH_MS) return;
        this._debugLastCheckTs = now;
        this._debug = isVideoSkipDebugEnabled();
    }

    _debugLog(message, payload = null) {
        this._syncDebugMode();
        if (!this._debug) return;
        if (payload && typeof payload === 'object') {
            console.debug(`[VideoSkipManager][diag] ${message}`, payload);
            return;
        }
        console.debug(`[VideoSkipManager][diag] ${message}`);
    }

    _debugVideoEvent(video, st, eventName, details = null) {
        this._syncDebugMode();
        if (!this._debug) return false;
        let media = null;
        try {
            media = buildMediaSnapshot(video);
        } catch (error) {
            const diagnostic = reportVideoSkipFailure(
                'debug_media_snapshot',
                error,
                {
                    ...describeVideoElement(video),
                    ...getMediaSnapshotErrorDetails(error),
                }
            );
            media = {
                phase: diagnostic.phase,
                snapshotError: diagnostic.error,
                ...getMediaSnapshotErrorDetails(error),
            };
        }
        const payload = {
            details: details && typeof details === 'object' ? details : null,
            media,
            state: buildStateSnapshot(st),
            pool: buildPoolSnapshot(this.storage?.pool),
            isActiveVideo: this._activeVideo === video,
        };
        recordProtectionFeatureEvent('videoSkipGuard', eventName, payload);
        console.debug(`[VideoSkipManager][diag] ${eventName}`, payload);
        return true;
    }

    _recordVideoEvent(video, st, eventName, details = null) {
        if (this._debugVideoEvent(video, st, eventName, details)) return;
        recordProtectionFeatureEvent('videoSkipGuard', eventName, details);
    }

    _cleanupInFlight({
        deactivate = false,
        throwOnFailure = false,
    } = {}) {
        if (deactivate && !throwOnFailure) this._active = false;
        const errors = [];
        let storageTeardownPromise = this._storageTeardownPromise;

        this._runCleanupStep('cleanup_videos', () => this._detachAllVideos({ throwOnFailure }), errors);
        this._runCleanupStep('cleanup_observer', () => this._teardownObserver(), errors);
        this._runCleanupStep('cleanup_control_surface', () => this._teardownControlSurface(), errors);
        this._runCleanupStep('cleanup_user_gesture_tracking', () => this._teardownUserGestureTracking(), errors);
        this._runCleanupStep('cleanup_fullscreen_tracking', () => this._teardownFullscreenTracking(), errors);
        this._runCleanupStep('cleanup_storage', () => {
            if (!this.storage) return;
            const storageOwner = this.storage;
            const teardownResult = storageOwner.teardown();
            if (isPromiseLike(teardownResult)) {
                storageTeardownPromise = teardownResult;
                this._storageTeardownPromise = teardownResult;
                void teardownResult.then(
                    () => {
                        if (this.storage === storageOwner) {
                            this.storage = null;
                        }
                        if (this._storageTeardownPromise === teardownResult) {
                            this._storageTeardownPromise = null;
                        }
                    },
                    () => {
                        if (this._storageTeardownPromise === teardownResult) {
                            this._storageTeardownPromise = null;
                        }
                    }
                );
            } else if (this.storage === storageOwner) {
                this.storage = null;
            }
        }, errors);
        this._runCleanupStep('cleanup_indicator_timer', () => {
            if (!this._indicatorAlertTimer || typeof globalThis.clearTimeout !== 'function') return;
            globalThis.clearTimeout(this._indicatorAlertTimer);
            this._indicatorAlertTimer = null;
        }, errors);
        this._runCleanupStep('cleanup_skip_ui_window', () => this._clearSkipUiWindow({ clearTarget: true }), errors);
        this._runCleanupStep('cleanup_indicator', () => {
            if (typeof document === 'undefined') return;
            StatusIndicator.update({
                video: {
                    enabled: false,
                    visible: false,
                    hasVideo: false,
                    isPlaying: false,
                    mode: 'hard_block',
                    cooldownRemainingMs: 0,
                    hardBlock: false,
                    rate: 1,
                    alert: false,
                    alertReason: null,
                },
            });
        }, errors);

        const shouldThrow = errors.length > 0 && throwOnFailure;
        if (deactivate) this._active = false;
        this._indicatorSnapshot = null;
        this._lastIndicatorAt = 0;
        this._indicatorAlertUntil = 0;
        this._indicatorAlertReason = null;
        this._lastUserGestureTs = 0;
        this._lastUserGesture = null;
        this._lastUserGestureVideo = null;
        this._mediaGestureSession = null;
        this._observedGestureEvents = new WeakSet();
        this._mediaGestureHoldUntil = 0;
        this._activeVideo = null;
        this._states = new WeakMap();
        this._videos.clear();
        if (shouldThrow) {
            throw createVideoSkipLifecycleError('VIDEO_SKIP_MANAGER_CLEANUP_FAILED', errors);
        }
        return storageTeardownPromise;
    }

    _hasCleanupOwnership() {
        return (
            this._active
            || this._isGateEnabled()
            || this._videos.size > 0
            || this._pendingListenerCleanup.size > 0
            || !!this._observerUnsub
            || !!this.storage
            || !!this._storageTeardownPromise
            || !!this._controlSurface
            || this._gestureTrackingOwned
            || this._fullscreenTrackingOwned
        );
    }

    _hasResidualCleanupOwnership() {
        return (
            this._pendingListenerCleanup.size > 0
            || !!this._observerUnsub
            || !!this.storage
            || !!this._controlSurface
            || this._gestureTrackingOwned
            || this._fullscreenTrackingOwned
        );
    }

    _disableSignalGateAfterOwnedCleanup(reason) {
        this._suppressSignalGateCleanup = true;
        signalGate.setFeatureEnabled(VIDEO_SKIP_SIGNAL_KEY, false, { reason });
        this._suppressSignalGateCleanup = false;
    }

    _runCleanupStep(phase, cleanup, errors) {
        try {
            cleanup();
        } catch (error) {
            errors.push(error);
            reportVideoSkipFailure(phase, error);
        }
    }

    setUserSettings(next = {}) {
        this._userSettings = resolveVideoSkipGuardProfile(next);
        this._syncControlSurface();
        this._reportIndicator({ force: true });
    }

    getRuntimeSnapshot() {
        const policy = this._getPolicy();
        const connectedVideoCount = Array.from(this._videos)
            .filter((video) => this._isVideoConnected(video))
            .length;
        return Object.freeze({
            active: this._active,
            gateEnabled: this._isGateEnabled(),
            mode: policy.mode,
            ...(BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
                ? {
                    cooldownMs: policy.cooldownMs,
                    cooldownUntil: Math.max(0, Math.floor(Number(this.storage?.pool?.cooldownUntil) || 0)),
                    cooldownRemainingMs: this._getCooldownRemainingMs(),
                }
                : {}),
            trackedVideoCount: this._videos.size,
            connectedVideoCount,
            controlSurface: this._controlSurface?.getRuntimeSnapshot?.() || null,
        });
    }

    _getPolicy() {
        return this._userSettings || resolveVideoSkipGuardProfile();
    }

    _readCurrentTime(video) {
        const current = Number(video?.currentTime);
        return Number.isFinite(current) ? current : 0;
    }

    _getSeekAnchor(st) {
        if (!st || typeof st !== 'object') return 0;
        const source = st.reverting && Number.isFinite(st.revertTargetTime)
            ? st.revertTargetTime
            : st.lastStableTime;
        const anchor = Number(source);
        return Number.isFinite(anchor) ? anchor : 0;
    }

    _isAdActive(video) {
        if (!isObservedVideoElement(video)) return false;
        const playerRoot = typeof video.closest === 'function'
            ? video.closest(':is(#movie_player, .html5-video-player, [data-testid*="video-player" i], [class*="video-player" i], ytd-shorts, #shorts-player)')
            : null;
        if (!playerRoot) return false;
        if (typeof playerRoot.matches === 'function' && playerRoot.matches(':is(.ad-showing, .ad-interrupting, [class*="ad-showing" i], [class*="ad-interrupting" i])')) {
            return true;
        }
        if (typeof playerRoot.querySelector === 'function') {
            const adElement = playerRoot.querySelector(
                ':is(.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .video-ads:not(:empty))'
            );
            if (adElement) return true;
        }
        return false;
    }

    _isAdTransitionRecent(video, st, now = Date.now()) {
        if (this._isAdActive(video)) {
            if (st) st.lastAdActiveAt = now;
            return true;
        }
        const lastAd = Number(st?.lastAdActiveAt) || 0;
        return lastAd > 0 && (now - lastAd < 1500);
    }

    _shouldHoldStableAnchorForSeek(video, st, currentTime) {
        if (st?.reverting) return true;
        if (this._isAdActive(video) || this._isAdTransitionRecent(video, st)) return false;
        const from = this._getSeekAnchor(st);
        const delta = currentTime - from;
        if (!(delta > CONFIG.minForwardJumpSec)) return false;
        if (video?.seeking === true) return true;
        return this._isSeekGestureRecent(Date.now(), video);
    }

    _getFullscreenElement() {
        if (typeof document === 'undefined') return null;
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    _rememberMediaGestureWindow(event, context, now) {
        this._mediaGestureHoldUntil = resolveVideoSkipMediaGestureHoldUntil({
            eventType: event?.type || '',
            context,
            now,
            currentHoldUntil: this._mediaGestureHoldUntil,
            mediaSeekGestureWindowMs: CONFIG.mediaSeekGestureWindowMs,
        });
    }

    _buildUserGestureContext(event, now = Date.now()) {
        const gestureVideo = resolveVideoSkipGestureVideo({
            event, trackedVideos: this._videos, activeVideo: this._activeVideo,
        });
        const context = buildVideoSkipUserGestureContext({
            event,
            now,
            activeVideo: gestureVideo || this._activeVideo,
            trackedVideos: this._videos,
            fullscreenElement: this._getFullscreenElement(),
            mediaGestureHoldUntil: this._mediaGestureHoldUntil,
        });
        return { ...context, gestureVideo };
    }

    _isAwayFromRevertTarget(currentTime, targetTime) {
        if (!Number.isFinite(currentTime) || !Number.isFinite(targetTime)) return false;
        return Math.abs(currentTime - targetTime) > CONFIG.revertTargetToleranceSec;
    }

    _captureMediaIdentity(video) {
        return { document: video.ownerDocument, source: video.currentSrc, declaredSource: video.getAttribute('src') };
    }

    _isMediaIdentityCurrent(video, identity) {
        return !!identity && this._isTrackedConnectedVideo(video)
            && video.ownerDocument === identity.document
            && video.currentSrc === identity.source
            && video.getAttribute('src') === identity.declaredSource;
    }

    _isRevertPositionRestored(video, st, target) {
        const current = Number(video.currentTime);
        if (!Number.isFinite(current)) return false;
        const elapsed = Math.max(0, Date.now() - st.revertAcceptedAt) / 1000;
        const playbackAdvance = st.revertWasPlaying
            ? elapsed * Math.max(0, Number(video.playbackRate)) : 0;
        return current >= target - CONFIG.revertTargetToleranceSec
            && current <= target + playbackAdvance + CONFIG.revertTargetToleranceSec;
    }

    _rememberBlockedForwardSeek(st, {
        from,
        to,
        reason = null,
        now = Date.now(),
    } = {}) {
        if (!st || typeof st !== 'object') return null;
        const anchor = Number(from);
        const target = Number(to);
        if (!Number.isFinite(anchor) || !Number.isFinite(target)) return null;
        const blockedAt = Math.max(0, Math.floor(Number(now) || 0));
        const entry = {
            from: anchor,
            to: target,
            reason,
            blockedAt,
            expiresAt: blockedAt + CONFIG.delayedProgrammaticSeekBlockMs,
        };
        st.lastBlockedForwardSeek = entry;
        return entry;
    }

    _matchBlockedForwardSeekFollowup(st, {
        to,
        now = Date.now(),
    } = {}) {
        const blocked = st?.lastBlockedForwardSeek;
        if (!blocked || typeof blocked !== 'object') return null;
        const expiresAt = Number(blocked.expiresAt) || 0;
        if (!(Number(now) <= expiresAt)) {
            st.lastBlockedForwardSeek = null;
            return null;
        }
        const target = Number(to);
        const blockedTarget = Number(blocked.to);
        if (!Number.isFinite(target) || !Number.isFinite(blockedTarget)) return null;
        const tolerance = Math.max(0, Number(CONFIG.delayedProgrammaticSeekTargetToleranceSec) || 0);
        const targetDeltaSec = Math.abs(target - blockedTarget);
        return {
            from: roundMetric(blocked.from),
            to: roundMetric(blocked.to),
            reason: blocked.reason || null,
            blockedAt: Number(blocked.blockedAt) || 0,
            expiresAt,
            remainingMs: Math.max(0, Math.floor(expiresAt - Number(now))),
            targetToleranceSec: tolerance,
            targetDeltaSec: roundMetric(targetDeltaSec),
            targetMatched: targetDeltaSec <= tolerance,
        };
    }

    _reassertRevertTarget(video, st, target, phase) {
        if (!Number.isFinite(target)) return false;
        const current = this._readCurrentTime(video);
        if (!this._isAwayFromRevertTarget(current, target)) return false;
        this._debugVideoEvent(video, st, phase, {
            target: roundMetric(target),
            currentTime: roundMetric(current),
        });
        this._revert(video, st, target);
        return true;
    }

    _getCooldownRemainingMs() {
        if (!BUILD_ENABLE_VIDEO_SKIP_COOLDOWN) return 0;
        const cooldownUntil = Math.max(0, Math.floor(Number(this.storage?.pool?.cooldownUntil) || 0));
        return Math.max(0, cooldownUntil - Date.now());
    }

    _resolveTimelineLockState() {
        if (!this._active || !this._isGateEnabled()) {
            return { locked: false, reason: null, unlockAt: null };
        }
        return { locked: true, reason: 'hard_block', unlockAt: null };
    }

    _isTimelineKeyboardSeekInput(event) {
        const context = this._buildUserGestureContext(event, Date.now());
        if (!context.keyboardMediaSeek) return false;
        const video = context.gestureVideo || this._activeVideo;
        if (this._controlSurface?.profile.timelineValidation === 'native_declared'
            && !this._controlSurface.ownsVideoControls(video)) return false;
        if (video) this._setActiveVideo(video);
        return true;
    }

    _handleTimelineInputBlocked(details = {}) {
        if (!this._active || !this._isGateEnabled()) return;
        const candidateVideo = details.video;
        const activeVideo = this._activeVideo;
        const mayUseActiveVideo = details.inputKind !== 'timeline_pointer';
        const visualTarget = this._isTrackedConnectedVideo(candidateVideo)
            ? candidateVideo
            : (
                mayUseActiveVideo && this._isTrackedConnectedVideo(activeVideo)
                    ? activeVideo
                    : null
            );
        if (visualTarget) {
            this._setActiveVideo(visualTarget);
        }
        recordProtectionFeatureEvent('videoSkipGuard', 'control_surface_input_blocked', {
            profileId: details.profileId || null,
            siteId: details.siteId || null,
            eventType: details.eventType || null,
            inputKind: details.inputKind || null,
            lockReason: details.lockReason || 'hard_block',
            unlockAt: null,
            cooldownRemainingMs: 0,
        });
        this._setAlert('blocked');
        if (visualTarget) {
            this._setSkipUiVisible(visualTarget);
        } else if (typeof document !== 'undefined') {
            this._clearSkipUiWindow({ clearTarget: true });
        }
        StatusIndicator.pulseVideo();
        this._reportIndicator({ force: true });
    }

    _reportControlSurfaceFailure(error, details = {}) {
        const phase = typeof details.phase === 'string' && details.phase
            ? details.phase
            : 'unknown';
        reportVideoSkipFailure(`control_surface_${phase}`, error, {
            profileId: details.profileId || this._controlSurface?.profile?.id || null,
            eventName: details.eventName || null,
        });
    }

    _installControlSurface() {
        if (this._controlSurface) {
            this._controlSurface.sync();
            return;
        }
        const profile = resolveVideoSkipControlSurfaceProfile(this._getHostname());
        if (!profile) return;

        const controlSurface = new VideoSkipControlSurfaceRuntime({
            profile,
            subscribeMediaMutations: (options) => videoElementObserver.subscribeMediaMutations(options),
            resolveLockState: () => this._resolveTimelineLockState(),
            isKeyboardSeekInput: (event) => this._isTimelineKeyboardSeekInput(event),
            onBlockedInput: (details) => this._handleTimelineInputBlocked(details),
            onFailure: (error, details) => this._reportControlSurfaceFailure(error, details),
            onObservedGesture: (event) => this._onUserGesture(event),
        });
        try {
            controlSurface.install();
            this._controlSurface = controlSurface;
        } catch (error) {
            reportVideoSkipFailure('control_surface_install', error, { profileId: profile.id });
            throw error;
        }
    }

    _syncControlSurface() {
        if (!this._controlSurface) return;
        try {
            this._controlSurface.sync();
        } catch (error) {
            reportVideoSkipFailure('control_surface_sync', error, {
                profileId: this._controlSurface.profile?.id || null,
            });
            throw error;
        }
    }

    _teardownControlSurface() {
        if (!this._controlSurface) return;
        this._controlSurface.teardown();
        this._controlSurface = null;
    }

    _buildSeekBlockPayload({ delta, from, to, policy, cooldownRemainingMs = null }) {
        return {
            delta: roundMetric(delta),
            from: roundMetric(from),
            to: roundMetric(to),
            ...(Number.isFinite(cooldownRemainingMs) ? { cooldownRemainingMs } : {}),
        };
    }

    // --- Internal Wiring ---

    _onStateChange() {
        if (!this._active || !this._isGateEnabled()) return;
        this._syncControlSurface();
        this._reportIndicator({ force: true });
    }

    _scanExistingVideos(reason = 'observed_video_snapshot') {
        this._pruneDetachedVideos(`${reason}_before_scan`);
        const videos = videoElementObserver.getLiveVideos();
        const result = {
            reason,
            scanSource: 'observer_registry',
            scanCount: videos.length,
            observerAddedCount: 0,
            attachedCount: 0,
            videosSize: this._videos.size,
        };
        recordProtectionFeatureEvent('videoSkipGuard', 'existing_video_scan', result);
        return result;
    }

    _isVideoConnected(video) {
        if (!isObservedVideoElement(video)) return false;
        return typeof document !== 'undefined' && video.ownerDocument === document && video.isConnected === true;
    }

    _isTrackedConnectedVideo(video) {
        return this._videos.has(video) && this._isVideoConnected(video);
    }

    _detachTrackedVideo(video, reason = 'detach_video') {
        releaseVideoSkipMediaTarget(video);
        if (this._mediaGestureSession?.video === video) this._mediaGestureSession = null;
        if (this._lastUserGestureVideo === video) this._lastUserGestureVideo = null;
        const st = this._states.get(video);
        if (st) {
            this._clearVideoTimer(st, 'revertTimeoutId', 'revert_timeout_cleanup', video);
            this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'revert_recovery_timeout_cleanup', video);
            this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_verification_timeout_cleanup', video);
            this._clearRevertFrame(st, 'revert_frame_cleanup', video);
            if (st.listenerLedger) {
                const result = this._detachVideoHandlers(st.listenerLedger);
                if (result.remainingLedger) {
                    this._pendingListenerCleanup.set(video, result.remainingLedger);
                }
                st.listenerLedger = null;
            }
            this._writeRevertingAttribute(video, false);
        }
        this._controlSurface?.untrackVideo(video);
        this._videos.delete(video);
        this._states.delete(video);
        if (this._activeVideo === video) this._activeVideo = null;
        if (this._droneTarget === video) {
            this._droneTarget = null;
            if (typeof document !== 'undefined') {
                StatusIndicator.setVideoTarget(null);
            }
        }
        recordProtectionFeatureEvent('videoSkipGuard', 'video_detached_stale', {
            reason,
            videosSize: this._videos.size,
            ...describeVideoElement(video),
        });
    }

    _pruneDetachedVideos(reason = 'prune_detached_videos') {
        if (this._videos.size <= 0) return 0;
        let prunedCount = 0;
        Array.from(this._videos).forEach((video) => {
            if (this._isVideoConnected(video)) return;
            this._detachTrackedVideo(video, reason);
            prunedCount += 1;
        });
        if (prunedCount > 0) {
            recordProtectionFeatureEvent('videoSkipGuard', 'video_detached_pruned', {
                reason,
                prunedCount,
                videosSize: this._videos.size,
            });
        }
        return prunedCount;
    }

    _handleObservedVideoRemoved(video) {
        if (!this._videos.has(video) || this._isVideoConnected(video)) return;
        this._detachTrackedVideo(video, 'observer_removed');
        recordProtectionFeatureEvent('videoSkipGuard', 'video_detached_pruned', {
            reason: 'observer_removed',
            prunedCount: 1,
            videosSize: this._videos.size,
        });
    }

    _restoreStorageSnapshot() {
        if (!this.storage || typeof this.storage.restore !== 'function') return;
        let restoreResult = null;
        try {
            restoreResult = this.storage.restore();
        } catch (error) {
            reportVideoSkipFailure('storage_restore_start', error);
            throw error;
        }
        if (isPromiseLike(restoreResult)) {
            void restoreResult.catch((error) => {
                reportVideoSkipFailure('storage_restore', error);
            });
        }
    }

    _ensureObserver() {
        if (this._observerUnsub) return;
        try {
            this._observerUnsub = videoElementObserver.subscribe({
                onVideo: (video) => {
                    this._attachVideo(video);
                },
                onVideoRemoved: (video) => {
                    this._handleObservedVideoRemoved(video);
                },
                includeExisting: true,
                debugLabel: 'VideoSkipManager.videoObserver',
            });
        } catch (error) {
            this._observerUnsub = null;
            reportVideoSkipFailure('observer_subscribe', error);
            throw error;
        }
    }

    _teardownObserver() {
        if (!this._observerUnsub) return;
        try {
            this._observerUnsub();
            this._observerUnsub = null;
        } catch (error) {
            reportVideoSkipFailure('observer_unsubscribe', error);
            throw error;
        }
    }

    _installUserGestureTracking() {
        if (typeof window === 'undefined') return;
        if (this._gestureTrackingOwned) return;
        this._gestureTrackingOwned = true;
        try {
            USER_GESTURE_EVENTS.forEach((eventName) => {
                window.addEventListener(eventName, this._boundOnUserGesture, true);
            });
        } catch (error) {
            reportVideoSkipFailure('gesture_tracking_install', error);
            throw error;
        }
        recordProtectionFeatureEvent('videoSkipGuard', 'gesture_tracking_installed', {
            events: USER_GESTURE_EVENTS,
        });
    }

    _teardownUserGestureTracking() {
        if (!this._gestureTrackingOwned) return;
        if (typeof window === 'undefined') {
            this._gestureTrackingOwned = false;
            return;
        }
        const errors = [];
        USER_GESTURE_EVENTS.forEach((eventName) => {
            try {
                window.removeEventListener(eventName, this._boundOnUserGesture, true);
            } catch (error) {
                errors.push(error);
                reportVideoSkipFailure('gesture_tracking_teardown', error, { eventName });
            }
        });
        if (errors.length > 0) {
            throw createVideoSkipLifecycleError('VIDEO_SKIP_GESTURE_TRACKING_TEARDOWN_FAILED', errors);
        }
        this._gestureTrackingOwned = false;
    }

    _onUserGesture(event) {
        if (!this._active || !this._isGateEnabled()) return;
        if (!USER_GESTURE_EVENTS.includes(event?.type)) return;
        if (this._controlSurface?.shouldDeferGestureToRoot(event)) return;
        if (this._observedGestureEvents.has(event)) return;
        this._observedGestureEvents.add(event);
        const now = Date.now();
        if (['pointercancel', 'touchcancel', 'lostpointercapture', 'blur'].includes(event?.type)) {
            this._mediaGestureSession = null;
            this._mediaGestureHoldUntil = 0;
            this._lastUserGestureVideo = null;
            return;
        }
        const { gestureVideo, ...context } = this._buildUserGestureContext(event, now);
        if (context?.isAdTarget) {
            return;
        }
        let owner = gestureVideo;
        const session = this._mediaGestureSession;
        if (session && (now - session.startedAt > 30000
            || !this._isMediaIdentityCurrent(session.video, session.identity))) {
            this._mediaGestureSession = null;
        }
        if (['pointerdown', 'mousedown', 'touchstart'].includes(event?.type)
            && owner && context.mediaGestureBase) {
            this._mediaGestureSession = {
                video: owner, startedAt: now, pointerId: event.pointerId,
                identity: this._captureMediaIdentity(owner),
            };
        }
        if (['pointerup', 'mouseup', 'touchend'].includes(event?.type) && this._mediaGestureSession) {
            const held = this._mediaGestureSession;
            if (held.pointerId === undefined || event.pointerId === undefined || held.pointerId === event.pointerId) {
                owner = held.video;
                context.mediaSeekContext = true;
                context.dragMediaSeek = true;
                this._mediaGestureSession = null;
            }
        }
        if (!owner && ['mouseup', 'touchend', 'click'].includes(event?.type)
            && this._lastUserGesture?.dragMediaSeek && now - this._lastUserGestureTs < 800
            && this._isTrackedConnectedVideo(this._lastUserGestureVideo)) {
            owner = this._lastUserGestureVideo;
            context.mediaSeekContext = true;
            context.dragMediaSeek = true;
        }
        this._rememberMediaGestureWindow(event, context, now);
        this._lastUserGestureTs = now;
        this._lastUserGestureVideo = owner || (this._videos.size === 1 ? this._videos.values().next().value : null);
        this._lastUserGesture = {
            ts: this._lastUserGestureTs,
            type: event?.type || 'unknown',
            key: typeof event?.key === 'string' ? event.key : null,
            pointerType: typeof event?.pointerType === 'string' ? event.pointerType : null,
            ...context,
        };
    }

    _buildGestureDiagnostics(now = Date.now()) {
        return buildVideoSkipGestureDiagnostics({
            lastGestureTs: this._lastUserGestureTs,
            lastGesture: this._lastUserGesture,
            now,
            userGestureWindowMs: CONFIG.userGestureWindowMs,
            mediaSeekGestureWindowMs: CONFIG.mediaSeekGestureWindowMs,
        });
    }

    _buildSeekDecisionDetails({
        from,
        to,
        delta,
        now = Date.now(),
        event = null,
        video = this._activeVideo,
        reason = null,
        ...extra
    } = {}) {
        const gesture = this._buildGestureDiagnostics(now);
        const userGestureRecent = this._isSeekGestureRecent(now, video);
        const controlCapability = this._controlSurface?.getVideoControlCapability(video);
        return {
            from: roundMetric(from),
            to: roundMetric(to),
            delta: roundMetric(delta),
            minForwardJumpSec: CONFIG.minForwardJumpSec,
            ...gesture,
            userGestureRecent,
            reason,
            seekingEvent: {
                ...buildDomEventSnapshot(event),
                inputAttribution: userGestureRecent ? 'recent_media_input' : 'unattributed',
                nativeControls: video?.controls === true,
                nativeTimelineLockProjected: controlCapability?.nativeTimelineLockProjected === true,
            },
            frame: buildFrameContextSnapshot(),
            ...extra,
        };
    }

    _isUserGestureRecent(now = Date.now()) {
        return isVideoSkipUserGestureRecent({
            lastGestureTs: this._lastUserGestureTs,
            now,
            userGestureWindowMs: CONFIG.userGestureWindowMs,
        });
    }

    _isMediaSeekGestureRecent(now = Date.now()) {
        return isVideoSkipMediaSeekGestureRecent({
            lastGestureTs: this._lastUserGestureTs,
            lastGesture: this._lastUserGesture,
            now,
            mediaSeekGestureWindowMs: CONFIG.mediaSeekGestureWindowMs,
        });
    }

    _isSeekGestureRecent(now = Date.now(), video = null) {
        const session = this._mediaGestureSession;
        if (video && session?.video === video && now - session.startedAt <= 30000
            && this._isMediaIdentityCurrent(video, session.identity)) return true;
        if (video && this._lastUserGestureVideo !== video) return false;
        return this._isUserGestureRecent(now) || this._isMediaSeekGestureRecent(now);
    }

    _installFullscreenTracking() {
        if (this._fullscreenTrackingOwned) return;
        this._fullscreenTrackingOwned = true;
        const listeners = [];
        if (typeof document !== 'undefined') {
            listeners.push([document, 'fullscreenchange', this._boundOnFullscreenChange, false]);
            listeners.push([document, 'webkitfullscreenchange', this._boundOnFullscreenChange, false]);
        }
        if (typeof window !== 'undefined') {
            listeners.push([window, 'click', this._boundOnPointerBlock, true]);
        }
        for (const [target, eventName, handler, options] of listeners) {
            try {
                target.addEventListener(eventName, handler, options);
            } catch (error) {
                reportVideoSkipFailure('fullscreen_tracking_install', error, { eventName });
                throw error;
            }
        }
    }

    _teardownFullscreenTracking() {
        if (!this._fullscreenTrackingOwned) return;
        const listeners = [];
        if (typeof document !== 'undefined') {
            listeners.push([document, 'fullscreenchange', this._boundOnFullscreenChange, false]);
            listeners.push([document, 'webkitfullscreenchange', this._boundOnFullscreenChange, false]);
        }
        if (typeof window !== 'undefined') {
            listeners.push([window, 'click', this._boundOnPointerBlock, true]);
        }
        const errors = [];
        for (const [target, eventName, handler, options] of listeners) {
            try {
                target.removeEventListener(eventName, handler, options);
            } catch (error) {
                errors.push(error);
                reportVideoSkipFailure('fullscreen_tracking_teardown', error, { eventName });
            }
        }
        if (errors.length > 0) {
            throw createVideoSkipLifecycleError('VIDEO_SKIP_FULLSCREEN_TRACKING_TEARDOWN_FAILED', errors);
        }
        this._fullscreenTrackingOwned = false;
    }

    _onFullscreenChange() {
        if (!this._active || !this._isGateEnabled()) return;
        this._trySetActiveFromFullscreen();
        this._reportIndicator({ force: true });
    }

    _trySetActiveFromFullscreen() {
        if (typeof document === 'undefined' || typeof HTMLVideoElement === 'undefined') return;
        const fs = this._getFullscreenElement();
        if (isObservedVideoElement(fs) && this._videos.has(fs)) {
            this._setActiveVideo(fs);
            return;
        }
        if (fs) {
            const v = fs.querySelector('video');
            if (v && this._videos.has(v)) {
                this._setActiveVideo(v);
            }
        }
    }

    _setAlert(reason) {
        const now = Date.now();
        this._indicatorAlertUntil = now + CONFIG.speedModeAutoHideMs;
        this._indicatorAlertReason = reason;
        if (this._indicatorAlertTimer && typeof globalThis.clearTimeout === 'function') {
            globalThis.clearTimeout(this._indicatorAlertTimer);
        }
        if (typeof globalThis.setTimeout !== 'function') return;
        this._indicatorAlertTimer = globalThis.setTimeout(() => {
            this._indicatorAlertTimer = null;
            this._indicatorAlertUntil = 0;
            this._indicatorAlertReason = null;
            this._reportIndicator({ force: true });
        }, CONFIG.speedModeAutoHideMs);
    }

    _clearAlert() {
        if (this._indicatorAlertTimer && typeof globalThis.clearTimeout === 'function') {
            globalThis.clearTimeout(this._indicatorAlertTimer);
            this._indicatorAlertTimer = null;
        }
        this._indicatorAlertUntil = 0;
        this._indicatorAlertReason = null;
    }

    _isSkipUiVisible() {
        return this._skipUiUntil > Date.now();
    }

    _clearSkipUiWindow({ clearTarget = false } = {}) {
        if (this._skipUiTimer && typeof globalThis.clearTimeout === 'function') {
            globalThis.clearTimeout(this._skipUiTimer);
            this._skipUiTimer = null;
        }
        this._skipUiUntil = 0;
        if (clearTarget) {
            this._droneTarget = null;
            if (typeof document !== 'undefined') {
                StatusIndicator.setVideoTarget(null);
            }
        }
    }

    _setSkipUiVisible(video = null) {
        if (!this._active || !this._isGateEnabled()) return;
        const now = Date.now();
        this._skipUiUntil = now + CONFIG.speedModeAutoHideMs;
        if (this._skipUiTimer && typeof globalThis.clearTimeout === 'function') {
            globalThis.clearTimeout(this._skipUiTimer);
        }
        if (typeof globalThis.setTimeout !== 'function') return;
        this._skipUiTimer = globalThis.setTimeout(() => {
            this._clearSkipUiWindow({ clearTarget: true });
            this._reportIndicator({ force: true });
        }, CONFIG.speedModeAutoHideMs);

        if (isObservedVideoElement(video) && this._videos.has(video)) {
            this._droneTarget = video;
            if (typeof document !== 'undefined') {
                StatusIndicator.setVideoTarget(video);
            }
        }
        this._reportIndicator({ force: true });
    }

    _buildIndicatorPayload({ overrideVisible } = {}) {
        const activeVideo = this._activeVideo;
        return buildVideoIndicatorPayload({
            active: this._active,
            videosSize: this._videos.size,
            activeVideo,
            pool: this.storage?.pool,
            policy: this._getPolicy(),
            indicatorAlertUntil: this._indicatorAlertUntil,
            indicatorAlertReason: this._indicatorAlertReason,
            skipUiUntil: this._skipUiUntil,
            overrideVisible,
        });
    }

    _reportIndicator({ force = false, overrideVisible } = {}) {
        if (!this._active) return;
        const payload = this._buildIndicatorPayload({ overrideVisible });
        if (shouldEmitVideoIndicatorUpdate({
            force,
            payload,
            lastSnapshot: this._indicatorSnapshot,
            lastIndicatorAt: this._lastIndicatorAt,
        })) {
            this._lastIndicatorAt = Date.now();
            this._indicatorSnapshot = payload;
            StatusIndicator.update({ video: payload });
        }
    }

    // --- Video Logic ---

    _setActiveVideo(video) {
        if (this._activeVideo === video) return;
        this._activeVideo = video;

        this._getState(video);
        this._reportIndicator({ force: true });
    }

    _getState(video) {
        let st = this._states.get(video);
        if (!st) {
            st = {
                lastChargeTime: video.currentTime || 0,
                lastStableTime: video.currentTime || 0,
                lastSrc: video.currentSrc || video.src || null,
                lastAdActiveAt: this._isAdActive(video) ? Date.now() : 0,
                reverting: false,
                revertTargetTime: null,
                revertTimeoutId: null,
                revertRecoveryTimeoutId: null,
                revertVerificationTimeoutId: null,
                revertFrameId: null,
                revertFrameKind: null,
                revertCommandAccepted: false,
                revertPositionVerified: false,
                revertAcceptedAt: 0,
                revertMediaIdentity: null,
                revertVerificationAdapterId: null,
                revertVerificationDeadline: 0,
                revertTransactionId: 0,
                revertVerificationAttempts: 0,
                revertWasPlaying: false,
                lastProgressLogAt: 0,
                lastProgressBufferedEnd: null,
                listenerLedger: null,
            };
            this._states.set(video, st);
        }
        return st;
    }

    _createVideoEventHandlerPort(video, st) {
        return Object.freeze({
            isOperational: () => this._active && this._isGateEnabled()
                && this._videos.has(video) && this._isVideoConnected(video),
            getActiveVideo: () => this._activeVideo,
            setActiveVideo: () => this._setActiveVideo(video),
            ...(BUILD_ENABLE_VIDEO_SKIP_COOLDOWN
                ? {
                    readPool: () => this.storage?.pool,
                    modifyPool: (updater) => this.storage?.modify(updater),
                    getCooldownRemainingMs: () => this._getCooldownRemainingMs(),
                }
                : {}),
            readCurrentTime: () => this._readCurrentTime(video),
            getSeekAnchor: () => this._getSeekAnchor(st),
            shouldHoldStableAnchorForSeek: (currentTime) => (
                this._shouldHoldStableAnchorForSeek(video, st, currentTime)
            ),
            reassertRevertTarget: (target, phase) => (
                this._reassertRevertTarget(video, st, target, phase)
            ),
            isSeekGestureRecent: (now) => this._isSeekGestureRecent(now, video),
            isAdActive: () => {
                const active = this._isAdActive(video);
                if (active) st.lastAdActiveAt = Date.now();
                return active;
            },
            isAdTransitionRecent: () => this._isAdTransitionRecent(video, st),
            handleMediaSourceChange: () => {
                if (this._mediaGestureSession?.video === video) this._mediaGestureSession = null;
                if (this._lastUserGestureVideo === video) this._lastUserGestureVideo = null;
                releaseVideoSkipMediaTarget(video);
                this._clearVideoTimer(st, 'revertTimeoutId', 'source_revert_cleanup', video);
                this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'source_recovery_cleanup', video);
                this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'source_verification_cleanup', video);
                this._clearRevertFrame(st, 'source_frame_cleanup', video);
                st.revertTransactionId = (st.revertTransactionId || 0) + 1;
                st.revertPositionVerified = false;
                st.revertMediaIdentity = null;
                st.revertWasPlaying = false;
                st.lastBlockedForwardSeek = null;
                this._writeRevertingAttribute(video, false);
                const current = this._readCurrentTime(video);
                st.lastStableTime = current;
                st.lastChargeTime = current;
                st.reverting = false;
                st.revertTargetTime = null;
                st.revertCommandAccepted = false;
                st.lastSrc = video.currentSrc || video.src || null;
                if (this._isAdActive(video)) {
                    st.lastAdActiveAt = Date.now();
                }
            },
            buildSeekDecisionDetails: (input) => this._buildSeekDecisionDetails({ ...input, video }),
            buildSeekBlockPayload: (input) => this._buildSeekBlockPayload(input),
            matchBlockedForwardSeekFollowup: (input) => (
                this._matchBlockedForwardSeekFollowup(st, input)
            ),
            getPolicy: () => this._getPolicy(),
            blockForwardSeek: (info) => this._blockForwardSeek(video, st, info),
            setAlert: (reason) => this._setAlert(reason),
            clearAlert: () => this._clearAlert(),
            showSkipUi: () => this._setSkipUiVisible(video),
            reportIndicator: (options) => this._reportIndicator(options),
            isDebugEnabled: () => {
                this._syncDebugMode();
                return this._debug;
            },
            debugLog: (message, payload) => this._debugLog(message, payload),
            debugVideoEvent: (eventName, details) => (
                this._debugVideoEvent(video, st, eventName, details)
            ),
            commitStablePosition: (currentTime) => {
                st.lastStableTime = currentTime;
                st.lastChargeTime = currentTime;
            },
            commitProgressSample: ({ loggedAt, bufferedEnd }) => {
                st.lastProgressLogAt = loggedAt;
                st.lastProgressBufferedEnd = bufferedEnd;
            },
        });
    }

    _syncIdentity(video, st) {
        // Only implemented if we need unique ID per video.
        // currently just reliance on WeakMap is enough for runtime state.
    }

    _attachVideoHandlers(video, handlers) {
        try {
            const ledger = attachVideoSkipListenerLedger({
                video,
                handlers,
                includeDiagnostics: this._debug,
                targetHandlers: {
                    onVideoEnter: this._boundOnVideoEnter,
                    onVideoLeave: this._boundOnVideoLeave,
                },
            });
            recordProtectionFeatureEvent('videoSkipGuard', 'video_handlers_attached', {
                eventNames: ledger.eventNames,
                listenerProfile: this._debug ? 'diagnostic' : 'runtime',
                ...describeVideoElement(video),
            });
            return ledger;
        } catch (error) {
            const details = error?.videoSkipListenerDetails || {};
            reportVideoSkipFailure('video_listener_attach', error, {
                ...describeVideoElement(video),
                ...details,
            });
            const rollbackFailures = Array.isArray(error?.videoSkipListenerRollbackFailures)
                ? error.videoSkipListenerRollbackFailures
                : [];
            rollbackFailures.forEach(({ binding, error: rollbackError }) => {
                reportVideoSkipFailure('video_listener_attach_rollback', rollbackError, {
                    ...describeVideoElement(video),
                    eventName: binding?.eventName || null,
                    listenerGroup: binding?.group || null,
                });
            });
            throw error;
        }
    }

    _detachVideoHandlers(ledger, { throwOnFailure = false } = {}) {
        const result = detachVideoSkipListenerLedger(ledger);
        result.failures.forEach(({ binding, error }) => {
            reportVideoSkipFailure('video_listener_detach', error, {
                ...describeVideoElement(ledger.video),
                eventName: binding?.eventName || null,
                listenerGroup: binding?.group || null,
            });
        });
        const details = {
            eventNames: result.eventNames,
            failedEventNames: result.failures.map(({ binding }) => binding?.eventName || null),
            failureCount: result.failures.length,
            ...describeVideoElement(ledger.video),
        };
        if (result.failures.length > 0) {
            recordProtectionFeatureEvent('videoSkipGuard', 'video_handlers_detach_incomplete', details);
            if (throwOnFailure) {
                const error = createVideoSkipLifecycleError(
                    'VIDEO_SKIP_LISTENER_DETACH_FAILED',
                    result.failures.map((failure) => failure.error)
                );
                error.remainingLedger = result.remainingLedger;
                throw error;
            }
            return result;
        }
        recordProtectionFeatureEvent('videoSkipGuard', 'video_handlers_detached', details);
        return result;
    }

    _drainPendingListenerCleanup({ throwOnFailure = false } = {}) {
        const errors = [];
        for (const [video, ledger] of Array.from(this._pendingListenerCleanup.entries())) {
            try {
                const result = this._detachVideoHandlers(ledger, { throwOnFailure });
                if (result.remainingLedger) {
                    this._pendingListenerCleanup.set(video, result.remainingLedger);
                } else {
                    this._pendingListenerCleanup.delete(video);
                }
            } catch (error) {
                this._pendingListenerCleanup.set(video, error?.remainingLedger || ledger);
                errors.push(error);
            }
        }
        if (errors.length > 0) {
            throw createVideoSkipLifecycleError('VIDEO_SKIP_PENDING_LISTENER_CLEANUP_FAILED', errors);
        }
    }

    _clearVideoTimer(st, key, phase, video = null) {
        if (!st?.[key]) return;
        try {
            window.clearTimeout(st[key]);
        } catch (error) {
            reportVideoSkipFailure(phase, error, video ? describeVideoElement(video) : {});
        }
        st[key] = null;
    }

    _clearRevertFrame(st, phase, video = null) {
        if (!st || st.revertFrameId === null || st.revertFrameId === undefined) return;
        try {
            if (st.revertFrameKind === 'animation_frame' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(st.revertFrameId);
            } else if (typeof window.clearTimeout === 'function') {
                window.clearTimeout(st.revertFrameId);
            }
        } catch (error) {
            reportVideoSkipFailure(phase, error, video ? describeVideoElement(video) : {});
        }
        st.revertFrameId = null;
        st.revertFrameKind = null;
    }

    _abortRevertTransaction(video, st, {
        reason,
        target,
        currentTime = this._readCurrentTime(video),
    }) {
        this._clearVideoTimer(st, 'revertTimeoutId', 'revert_abort_timeout_cleanup', video);
        this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'revert_abort_recovery_cleanup', video);
        this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_abort_verification_cleanup', video);
        this._clearRevertFrame(st, 'revert_abort_frame_cleanup', video);
        st.reverting = false;
        st.revertCommandAccepted = false;
        st.revertPositionVerified = false;
        st.revertMediaIdentity = null;
        releaseVideoSkipMediaTarget(video);
        st.revertTransactionId = Math.max(0, Number(st.revertTransactionId) || 0) + 1;
        st.revertVerificationAttempts = 0;
        st.revertWasPlaying = false;
        st.revertTargetTime = null;
        st.lastStableTime = currentTime;
        st.lastChargeTime = currentTime;
        st.lastChargeWallMs = Date.now();
        st.lastBlockedForwardSeek = null;
        this._writeRevertingAttribute(video, false);
        this._clearAlert();
        this._reportIndicator({ force: true });
        const details = {
            reason,
            targetTime: roundMetric(target),
            currentTime: roundMetric(currentTime),
        };
        this._recordVideoEvent(video, st, 'revert_aborted', details);
        return false;
    }

    _writeRevertingAttribute(video, active) {
        try {
            if (active) setAttribute(video, 'data-friction-skip-reverting', '1');
            else removeAttribute(video, 'data-friction-skip-reverting');
        } catch (error) {
            reportVideoSkipFailure(active ? 'revert_attribute_set' : 'revert_attribute_remove', error, {
                ...describeVideoElement(video),
            });
        }
    }

    _getHostname() {
        if (typeof window === 'undefined') throw new Error('VIDEO_SKIP_WINDOW_REQUIRED');
        const hostname = String(window.location?.hostname || '').trim().toLowerCase();
        if (!hostname) throw new Error('VIDEO_SKIP_HOSTNAME_REQUIRED');
        return hostname;
    }

    _resolveMediaAdapter(video, phase = 'media_adapter_resolve') {
        let resolution = null;
        try {
            resolution = resolveVideoSkipMediaAdapter({
                video,
                hostname: this._getHostname(),
                youtubeActuator: this._youtubeActuator,
            });
        } catch (error) {
            reportVideoSkipFailure(phase, error, describeVideoElement(video));
            return { ok: false, adapterId: null, reason: 'adapter_resolution_failed' };
        }
        if (!resolution.ok) {
            recordProtectionFeatureEvent('videoSkipGuard', 'youtube_player_adapter_unavailable', {
                hasActuator: resolution.hasActuator,
                hasSeek: resolution.hasSeek,
                hasPlay: resolution.hasPlay,
            });
            reportVideoSkipFailure(
                phase,
                new Error('VIDEO_SKIP_YOUTUBE_PLAYER_ADAPTER_UNAVAILABLE'),
                {
                    ...describeVideoElement(video),
                    adapter: resolution.adapterId,
                    reason: resolution.reason,
                }
            );
        }
        return resolution;
    }

    _seekVideoTo(video, target, phase, options = {}) {
        const resolution = options?.adapterResolution || this._resolveMediaAdapter(video, phase);
        if (!resolution?.ok) return false;
        const adapter = resolution.adapter;
        const transactionId = options.state?.revertTransactionId;
        const acceptSeek = () => {
            if (options.state && !this._isCurrentRevertTransaction(video, options.state, transactionId)) return false;
            recordProtectionFeatureEvent('videoSkipGuard', 'media_adapter_seek_requested', {
                adapter: adapter.id,
                phase,
                targetTime: roundMetric(target),
            });
            if (
                adapter.verifyPosition === true
                && options?.verifyPosition === true
                && options?.state
            ) {
                const state = options.state;
                state.revertAcceptedAt = Date.now();
                state.revertVerificationAdapterId = adapter.id;
                const player = adapter.id === VIDEO_SKIP_MEDIA_ADAPTER_IDS.YOUTUBE_PLAYER;
                state.revertVerificationDeadline = Date.now() + (player
                    ? CONFIG.playerVerificationDelayMs * (CONFIG.playerVerificationMaxAttempts + 1)
                    : CONFIG.revertVerificationDelayMs * (CONFIG.revertVerificationMaxAttempts + 1))
                    + CONFIG.revertProtectionMs;
                this._scheduleRevertPositionVerification(video, state, target, phase);
            }
            return true;
        };
        const rejectSeek = (error) => {
            reportVideoSkipFailure(phase, error, {
                ...describeVideoElement(video),
                adapter: adapter.id,
                targetTime: roundMetric(target),
            });
            return false;
        };
        try {
            const result = adapter.seek(target);
            if (isPromiseLike(result)) {
                return Promise.resolve(result).then(acceptSeek, rejectSeek);
            }
            if (result === false) {
                return rejectSeek(new Error('VIDEO_SKIP_MEDIA_ADAPTER_SEEK_REJECTED'));
            }
            return acceptSeek();
        } catch (error) {
            return rejectSeek(error);
        }
    }

    _scheduleRevertPositionVerification(video, st, target, causePhase) {
        this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_verification_timeout_reschedule', video);
        if (!st || typeof window.setTimeout !== 'function') return;

        const transactionId = st.revertTransactionId;
        const player = st.revertVerificationAdapterId === VIDEO_SKIP_MEDIA_ADAPTER_IDS.YOUTUBE_PLAYER;
        const maxAttempts = player ? CONFIG.playerVerificationMaxAttempts : CONFIG.revertVerificationMaxAttempts;
        const delay = player ? CONFIG.playerVerificationDelayMs : CONFIG.revertVerificationDelayMs;
        st.revertVerificationTimeoutId = window.setTimeout(() => {
            st.revertVerificationTimeoutId = null;
            if (!this._isCurrentRevertTransaction(video, st, transactionId)) return;

            const current = this._readCurrentTime(video);
            if (this._isRevertPositionRestored(video, st, target)) {
                st.revertPositionVerified = true;
                this._recordVideoEvent(video, st, 'revert_position_verified', { targetTime: roundMetric(target) });
                return;
            }

            const attempt = Math.max(0, Number(st.revertVerificationAttempts) || 0) + 1;
            st.revertVerificationAttempts = attempt;
            const details = {
                causePhase,
                targetTime: roundMetric(target),
                currentTime: roundMetric(current),
                delta: roundMetric(current - target),
                attempt,
                maxAttempts,
            };

            if (attempt > maxAttempts || Date.now() > st.revertVerificationDeadline) {
                reportVideoSkipFailure(
                    'revert_position_not_restored',
                    new Error('VIDEO_SKIP_REVERT_POSITION_NOT_RESTORED'),
                    details
                );
                this._debugVideoEvent(video, st, 'revert_position_not_restored', details);
                this._abortRevertTransaction(video, st, {
                    reason: 'position_not_restored',
                    target,
                    currentTime: current,
                });
                return;
            }

            if (player) {
                this._recordVideoEvent(video, st, 'revert_position_verification_pending', details);
                this._scheduleRevertPositionVerification(video, st, target, causePhase);
                return;
            }
            this._recordVideoEvent(video, st, 'revert_position_retry_requested', details);
            const settleRetry = (accepted) => {
                if (!this._isCurrentRevertTransaction(video, st, transactionId)) {
                    return;
                }
                if (!accepted) {
                    this._abortRevertTransaction(video, st, {
                        reason: 'position_retry_failed',
                        target,
                        currentTime: current,
                    });
                    return;
                }
                this._scheduleRevertPositionVerification(video, st, target, causePhase);
            };
            const retryResult = this._seekVideoTo(video, target, 'revert_position_retry', { state: st });
            if (isPromiseLike(retryResult)) {
                void Promise.resolve(retryResult).then(settleRetry);
            } else {
                settleRetry(retryResult);
            }
        }, delay);
    }

    _resumeVideoAfterRevert(video, {
        phase = 'revert_resume_play',
        adapterResolution = null,
    } = {}) {
        const resolution = adapterResolution || this._resolveMediaAdapter(video, phase);
        if (!resolution?.ok) return false;
        const adapter = resolution.adapter;
        const acceptPlay = () => {
            recordProtectionFeatureEvent('videoSkipGuard', 'media_adapter_play_requested', {
                adapter: adapter.id,
                phase,
            });
            return true;
        };
        const rejectPlay = (error) => {
            reportVideoSkipFailure(phase, error, {
                ...describeVideoElement(video),
                adapter: adapter.id,
            });
            return false;
        };
        try {
            const result = adapter.play();
            if (isPromiseLike(result)) {
                return Promise.resolve(result).then(acceptPlay, rejectPlay);
            }
            if (result === false) {
                return rejectPlay(new Error('VIDEO_SKIP_MEDIA_ADAPTER_PLAY_REJECTED'));
            }
            return acceptPlay();
        } catch (error) {
            return rejectPlay(error);
        }
    }

    _buildRevertRecoverySnapshot(video, target) {
        const current = this._readCurrentTime(video);
        let activeBufferedEnd = null;
        try {
            activeBufferedEnd = findActiveRangeEnd(video.buffered, current);
        } catch (error) {
            reportVideoSkipFailure('revert_recovery_snapshot', error, {
                ...describeVideoElement(video),
                ...getMediaSnapshotErrorDetails(error),
            });
        }
        const bufferedAheadSec = Number.isFinite(activeBufferedEnd)
            ? Math.max(0, activeBufferedEnd - current)
            : 0;
        return {
            currentTime: roundMetric(current),
            targetTime: roundMetric(target),
            readyState: formatReadyState(video.readyState),
            networkState: formatNetworkState(video.networkState),
            bufferedAheadSec: roundMetric(bufferedAheadSec),
        };
    }

    _isMediaLikelyStalledAfterRevert(video, target) {
        if (!isObservedVideoElement(video) || video.ended) return false;
        const snapshot = this._buildRevertRecoverySnapshot(video, target);
        const readyState = Number(video.readyState);
        const networkState = Number(video.networkState);
        const bufferedAheadSec = Number(snapshot.bufferedAheadSec);
        const lacksFutureData = !Number.isFinite(readyState) || readyState < 3;
        const lacksUsefulBuffer = !Number.isFinite(bufferedAheadSec)
            || bufferedAheadSec < CONFIG.stalledBufferedAheadSec;
        const loaderIsNotActive = networkState === 0 || networkState === 1;
        return lacksFutureData && lacksUsefulBuffer && loaderIsNotActive;
    }

    _schedulePostRevertRecoveryCheck(video, st, target, wasPlaying) {
        this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'revert_recovery_timeout_reschedule', video);
        if (!wasPlaying || typeof window.setTimeout !== 'function') return;
        const identity = this._captureMediaIdentity(video);
        const transactionId = st.revertTransactionId;

        st.revertRecoveryTimeoutId = window.setTimeout(() => {
            st.revertRecoveryTimeoutId = null;
            if (!this._active || !this._isGateEnabled() || !this._isMediaIdentityCurrent(video, identity)
                || this._states.get(video) !== st || st.revertTransactionId !== transactionId) return;
            if (!this._isMediaLikelyStalledAfterRevert(video, target)) return;

            const snapshot = this._buildRevertRecoverySnapshot(video, target);
            const adapterResolution = this._resolveMediaAdapter(video, 'revert_loader_recovery_seek');
            const adapterId = adapterResolution?.ok
                ? adapterResolution.adapter.id
                : adapterResolution?.adapterId || null;
            const recoveryDetails = {
                ...snapshot,
                adapter: adapterId,
            };
            this._recordVideoEvent(
                video,
                st,
                'revert_loader_recovery_requested',
                recoveryDetails
            );
            const settleRecoverySeek = (accepted) => {
                if (!accepted || !this._active || !this._isGateEnabled()
                    || !this._isMediaIdentityCurrent(video, identity)
                    || this._states.get(video) !== st || st.revertTransactionId !== transactionId) {
                    return;
                }
                const playResult = this._resumeVideoAfterRevert(video, {
                    phase: 'revert_loader_recovery_play',
                    adapterResolution,
                });
                if (isPromiseLike(playResult)) void playResult;
            };
            const seekResult = this._seekVideoTo(
                video,
                target,
                'revert_loader_recovery_seek',
                { adapterResolution }
            );
            if (isPromiseLike(seekResult)) {
                void Promise.resolve(seekResult).then(settleRecoverySeek);
            } else {
                settleRecoverySeek(seekResult);
            }
        }, CONFIG.revertRecoveryCheckMs);
    }

    _attachVideo(video) {
        if (this._states.has(video)) return;
        const pendingLedger = this._pendingListenerCleanup.get(video);
        if (pendingLedger) {
            try {
                this._detachVideoHandlers(pendingLedger, { throwOnFailure: true });
                this._pendingListenerCleanup.delete(video);
            } catch (error) {
                this._pendingListenerCleanup.set(video, error?.remainingLedger || pendingLedger);
                throw error;
            }
        }
        const st = this._getState(video);

        let handlers = null;
        let controlSurfaceProjection = null;
        try {
            handlers = createVideoSkipEventHandlers({
                port: this._createVideoEventHandlerPort(video, st),
                video,
                state: st,
            });
            st.listenerLedger = this._attachVideoHandlers(video, handlers);
            controlSurfaceProjection = this._controlSurface?.trackVideo(video) || null;
        } catch (error) {
            const remainingLedger = error?.videoSkipListenerRemainingLedger;
            if (remainingLedger) this._pendingListenerCleanup.set(video, remainingLedger);
            if (st.listenerLedger) {
                try {
                    const result = this._detachVideoHandlers(st.listenerLedger, { throwOnFailure: true });
                    if (result.remainingLedger) {
                        this._pendingListenerCleanup.set(video, result.remainingLedger);
                    }
                } catch (cleanupError) {
                    this._pendingListenerCleanup.set(
                        video,
                        cleanupError?.remainingLedger || st.listenerLedger
                    );
                    error.listenerCleanupError = cleanupError;
                }
                st.listenerLedger = null;
            }
            try {
                this._controlSurface?.untrackVideo(video);
            } catch (cleanupError) {
                error.controlSurfaceCleanupError = cleanupError;
            }
            this._states.delete(video);
            throw error;
        }

        this._videos.add(video);
        recordProtectionFeatureEvent('videoSkipGuard', 'video_attached', {
            videosSize: this._videos.size,
            hasSrc: !!video.currentSrc || !!video.src,
            controlSurfaceProjection,
        });
        // Initial calls
        handlers.onLoadedMetadata();
        // onTimeUpdate(); // Maybe skip initial tick to avoid instant charge confusion

        if (!this._activeVideo) this._setActiveVideo(video);
    }

    _detachAllVideos({ throwOnFailure = false } = {}) {
        const errors = [];
        try {
            this._drainPendingListenerCleanup({ throwOnFailure });
        } catch (error) {
            errors.push(error);
        }
        for (const video of Array.from(this._videos)) {
            releaseVideoSkipMediaTarget(video);
            const st = this._states.get(video);
            const listenerLedger = st?.listenerLedger;
            this._clearVideoTimer(st, 'revertTimeoutId', 'revert_timeout_cleanup', video);
            this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'revert_recovery_timeout_cleanup', video);
            this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_verification_timeout_cleanup', video);
            this._clearRevertFrame(st, 'revert_frame_cleanup', video);
            this._writeRevertingAttribute(video, false);
            if (listenerLedger) {
                try {
                    const result = this._detachVideoHandlers(listenerLedger, { throwOnFailure });
                    if (result.remainingLedger) {
                        this._pendingListenerCleanup.set(video, result.remainingLedger);
                    }
                } catch (error) {
                    this._pendingListenerCleanup.set(video, error?.remainingLedger || listenerLedger);
                    if (st) st.listenerLedger = null;
                    this._videos.delete(video);
                    this._states.delete(video);
                    if (this._activeVideo === video) this._activeVideo = null;
                    errors.push(error);
                    continue;
                }
            }
            if (st) st.listenerLedger = null;
            try {
                this._controlSurface?.untrackVideo(video);
            } catch (error) {
                errors.push(error);
            }
            this._videos.delete(video);
            this._states.delete(video);
            if (this._activeVideo === video) this._activeVideo = null;
        }
        if (this._videos.size === 0 && typeof document !== 'undefined') {
            StatusIndicator.setVideoTarget(null);
        }
        if (errors.length > 0) {
            throw createVideoSkipLifecycleError('VIDEO_SKIP_LISTENER_DETACH_FAILED', errors);
        }
    }

    _blockForwardSeek(video, st, info) {

        const cooldownRemainingMs = this._getCooldownRemainingMs();
        const policy = this._getPolicy();
        const blockedForwardSeek = this._rememberBlockedForwardSeek(st, {
            from: info?.from,
            to: info?.to,
            reason: info?.reason || null,
        });

        this._debugVideoEvent(video, st, 'block_forward_seek', {
            cooldownRemainingMs,
            mode: policy.mode,
            reason: info?.reason || null,
            revertTo: roundMetric(info?.from),
            blockedTargetTime: roundMetric(info?.to),
            delayedProgrammaticSeekBlockMs: CONFIG.delayedProgrammaticSeekBlockMs,
            blockedForwardSeek: blockedForwardSeek
                ? {
                    from: roundMetric(blockedForwardSeek.from),
                    to: roundMetric(blockedForwardSeek.to),
                    reason: blockedForwardSeek.reason || null,
                    expiresAt: blockedForwardSeek.expiresAt,
                }
                : null,
        });
        this._revert(video, st, info.from);

        this._setAlert('blocked');
        this._setSkipUiVisible(video);
        StatusIndicator.pulseVideo();
        this._reportIndicator({ force: true });
    }

    _isCurrentRevertTransaction(video, st, transactionId) {
        const owned = this._active
            && this._isGateEnabled()
            && this._videos.has(video)
            && this._states.get(video) === st
            && st.reverting === true
            && st.revertTransactionId === transactionId;
        if (!owned) return false;
        if (!this._isMediaIdentityCurrent(video, st.revertMediaIdentity)) {
            this._abortRevertTransaction(video, st, { reason: 'media_target_stale', target: st.revertTargetTime });
            return false;
        }
        return true;
    }

    _scheduleRevertCompletion(video, st, target, transactionId) {
        this._clearVideoTimer(st, 'revertTimeoutId', 'revert_completion_timeout_reschedule', video);
        st.revertTimeoutId = window.setTimeout(() => {
            if (!this._isCurrentRevertTransaction(video, st, transactionId)) return;
            if (!st.revertCommandAccepted) {
                this._abortRevertTransaction(video, st, {
                    reason: 'seek_command_not_accepted',
                    target,
                });
                return;
            }
            if (!st.revertPositionVerified || !this._isRevertPositionRestored(video, st, target)) {
                st.revertPositionVerified = false;
                if (Date.now() > st.revertVerificationDeadline) {
                    this._abortRevertTransaction(video, st, { reason: 'position_not_restored', target });
                    return;
                }
                if (!st.revertVerificationTimeoutId) {
                    this._scheduleRevertPositionVerification(video, st, target, 'revert_completion');
                }
                this._scheduleRevertCompletion(video, st, target, transactionId);
                return;
            }
            st.reverting = false;
            st.revertTimeoutId = null;
            st.revertCommandAccepted = false;
            this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_verification_timeout_cleanup', video);

            const finalTarget = Number.isFinite(st.revertTargetTime) ? st.revertTargetTime : target;
            st.lastStableTime = finalTarget;
            st.lastChargeTime = finalTarget;
            st.lastChargeWallMs = Date.now();
            st.revertTargetTime = null;
            this._writeRevertingAttribute(video, false);
            const shouldResume = st.revertWasPlaying;
            st.revertWasPlaying = false;
            if (shouldResume) {
                const playResult = this._resumeVideoAfterRevert(video);
                if (isPromiseLike(playResult)) void playResult;
            }
            this._schedulePostRevertRecoveryCheck(video, st, finalTarget, shouldResume);
            this._recordVideoEvent(video, st, 'revert_completed', {
                finalTarget: roundMetric(finalTarget),
            });
        }, CONFIG.revertProtectionMs);
    }

    _revert(video, st, revertTo) {
        this._clearVideoTimer(st, 'revertTimeoutId', 'revert_timeout_reschedule', video);
        this._clearVideoTimer(st, 'revertRecoveryTimeoutId', 'revert_recovery_timeout_reschedule', video);
        this._clearVideoTimer(st, 'revertVerificationTimeoutId', 'revert_verification_timeout_reschedule', video);
        this._clearRevertFrame(st, 'revert_frame_reschedule', video);

        const transactionId = Math.max(0, Number(st.revertTransactionId) || 0) + 1;
        st.revertTransactionId = transactionId;
        st.reverting = true;
        st.revertCommandAccepted = false;
        st.revertPositionVerified = false;
        st.revertMediaIdentity = this._captureMediaIdentity(video);
        st.revertVerificationAttempts = 0;
        st.revertWasPlaying = !!st.revertWasPlaying || (!video.paused && !video.ended);
        this._writeRevertingAttribute(video, true);

        const target = clamp(
            revertTo,
            0,
            isFinitePositive(video.duration) ? video.duration : Number.MAX_SAFE_INTEGER
        );
        st.revertTargetTime = target;
        this._debugVideoEvent(video, st, 'revert_scheduled', {
            target: roundMetric(target),
            wasPlaying: st.revertWasPlaying,
        });
        const useAnimationFrame = typeof window.requestAnimationFrame === 'function';
        const schedule = useAnimationFrame
            ? window.requestAnimationFrame.bind(window)
            : (callback) => window.setTimeout(callback, 0);
        st.revertFrameKind = useAnimationFrame ? 'animation_frame' : 'timeout';
        st.revertTimeoutId = window.setTimeout(() => {
            if (!this._isCurrentRevertTransaction(video, st, transactionId)) return;
            if (st.revertCommandAccepted) return;
            this._abortRevertTransaction(video, st, {
                reason: 'seek_command_not_accepted',
                target,
            });
        }, CONFIG.revertCommandTimeoutMs);
        st.revertFrameId = schedule(() => {
            st.revertFrameId = null;
            st.revertFrameKind = null;
            if (!this._isCurrentRevertTransaction(video, st, transactionId)) return;
            const settleCommand = (commandAccepted) => {
                if (!this._isCurrentRevertTransaction(video, st, transactionId)) return;
                if (!commandAccepted) {
                    this._abortRevertTransaction(video, st, {
                        reason: 'initial_seek_failed',
                        target,
                    });
                    return;
                }
                st.revertCommandAccepted = true;
                this._scheduleRevertCompletion(video, st, target, transactionId);
            };
            const commandResult = this._seekVideoTo(video, target, 'revert_current_time', {
                state: st,
                verifyPosition: true,
            });
            if (isPromiseLike(commandResult)) {
                void Promise.resolve(commandResult).then(settleCommand);
            } else {
                settleCommand(commandResult);
            }
        });
    }

    _blockPointerDuringRevert(e) {
        if (!this._active || !this._isGateEnabled()) return;
        if (e?.type !== 'click') return;
        const target = e.target;
        if (target?.nodeType !== 1) return;
        const video = target.closest('video');
        if (!video) return;
        if (video.dataset.frictionSkipReverting !== '1') return;
        try {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        } catch (error) {
            reportVideoSkipFailure('revert_pointer_block', error, describeVideoElement(video));
        }
    }

    _onVideoEnter(e) {
        if (!this._active || !this._isGateEnabled()) return;
        const video = e.target;
        if (!isObservedVideoElement(video)) return;

        this._setActiveVideo(video);
        if (!this._isSkipUiVisible()) return;
        this._droneTarget = video;
        StatusIndicator.setVideoTarget(video);
    }

    _onVideoLeave(e) {
        if (!this._active || !this._isGateEnabled()) return;
        const video = e.target;
        if (!isObservedVideoElement(video)) return;

        if (this._droneTarget === video) {
            this._droneTarget = null;
            if (typeof document !== 'undefined') {
                StatusIndicator.setVideoTarget(null);
            }
        }
    }

}
