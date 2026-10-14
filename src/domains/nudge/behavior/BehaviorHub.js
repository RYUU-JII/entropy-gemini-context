import observerHub from '../../../lib/dom/ObserverHub.js';
import { getBehaviorTargets } from './behaviorTargetProfiles.js';
import { BEHAVIOR_SIGNAL_TYPES, BehaviorJudge } from './BehaviorJudge.js';
import { CLSEContentReporter } from '@content-clse-reporter';
import scrollInputOrchestrator from './scrollInputOrchestrator.js';
import scrollSpikeSignalAggregator, {
  SCROLL_SPIKE_MIN_THRESHOLD_PX,
} from './ScrollSpikeSignalAggregator.js';
import { createScrollSignalTracker } from './ScrollSignalTracker.js';
import signalGate from '../../protection/content/runtime/ProtectionSignalGate.js';
import { SIGNAL_GATE_KEYS } from '../../protection/content/runtime/protectionSignalGateKeys.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { isBehaviorHubDebugEnabled } from '@friction-debug-flags';
import { ensureAnchorUnlockSettingInitialized } from '../nudgeSettingsClient.js';
import {
  areContentFlowSignalsEnabled,
  isContentClseReporterEnabled,
} from '../core/contentBehaviorCapabilities.js';
import {
  videoElementObserver,
} from '../video/VideoElementObserver.js';
import ShortMediaAttentionProbe from '../video/ShortMediaAttentionProbe.js';
import shortMediaAttentionSignalAggregator from '../video/ShortMediaAttentionSignalAggregator.js';

export const BEHAVIOR_HUB_EVENTS = Object.freeze({
  BEHAVIOR_SIGNAL: 'BEHAVIOR_SIGNAL',
});

const ANCHOR_UNLOCK_TESTING_OVERRIDE = false;
const MUTATION_CLEANUP_RETRY_DELAYS_MS = Object.freeze([50, 250, 1000]);
const VIDEO_SKIP_SIGNAL_KEY = SIGNAL_GATE_KEYS.VIDEO_SKIP_GUARD;
const CONTENT_DEBUG_TOOLS_ENABLED = (
  typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
    ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
    : true
);

function getBehaviorHubErrorMessage(error, fallback = 'BEHAVIOR_HUB_FAILURE') {
  return String(error?.message || error || fallback);
}

function createBehaviorHubLifecycleError(message, errors) {
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

function reportBehaviorHubFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getBehaviorHubErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('behaviorHub', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[BehaviorHub] runtime failure', diagnostic);
  }
  return diagnostic;
}

class BehaviorHub {
  constructor({
    scrollSpikeAggregator = scrollSpikeSignalAggregator,
    shortMediaAggregator = shortMediaAttentionSignalAggregator,
  } = {}) {
    this._scrollSpikeSignalAggregator = scrollSpikeAggregator;
    this._shortMediaAttentionSignalAggregator = shortMediaAggregator;
    this._initialized = false;
    this._subscribers = new Map();
    this._observerUnsub = null;
    this._videoObserverUnsub = null;
    this._wheelUnsub = null;
    this._scrollListenerAttached = false;
    this._clseReporter = null;
    this._telemetryEnabled = false;
    this._clseMutationDemand = false;
    this._mutationReportingActive = false;
    this._mutationCleanupRetryTimer = null;
    this._mutationCleanupRetryAttempt = 0;

    this._trackedVideos = new Set();
    this._videoHandlers = new Map();
    this._shortMediaAttentionProbe = new ShortMediaAttentionProbe({
      emitEvent: (payload) => this._emitShortMediaAttention(payload),
    });

    this._feedItemSelector = null;
    this._seenFeedItems = new WeakSet();
    this._selectorFailureKeys = new Set();
    this._anchorUnlockState = {
      stored: null,
      isUnlocked: true,
      initialized: false,
    };
    this._context = {}; // 현재 적용된 필터 상태 등을 저장할 컨텍스트
    this._judge = new BehaviorJudge();

    this._scrollRafId = null;
    this._scrollTracker = createScrollSignalTracker({
      recordScrollSample: (sample) => this._clseReporter?.recordScrollSample(sample),
      getWheelScrollDedupMs: () => scrollInputOrchestrator.getWheelScrollDedupMs?.() || 0,
    });

    this._boundOnMouseDown = () => {
      const signal = this._judge.recordClick({ ts: Date.now() });
      this._emitSignal(signal);
    };
    this._boundOnScroll = () => {
      if (this._scrollRafId !== null) return;
      this._scrollRafId = requestAnimationFrame(() => {
        // Release the frame lease before invoking the optional CLSE path. A
        // reporter failure must not permanently suppress later scroll frames.
        this._scrollRafId = null;
        try {
          this._scrollTracker.recordScrollSample();
        } catch (error) {
          reportBehaviorHubFailure('scroll_sample_tracking', error);
        }
      });
    };
    this._boundOnWheel = (event) => {
      const wheelIntensity = Math.abs(Number(event?.deltaY) || 0);
      if (wheelIntensity > SCROLL_SPIKE_MIN_THRESHOLD_PX) {
        try {
          this._scrollSpikeSignalAggregator.record(wheelIntensity);
        } catch (error) {
          reportBehaviorHubFailure('wheel_spike_aggregation', error);
        }
      }
      if (!this._clseReporter) return;
      try {
        // CLSE is an optional consumer of the shared wheel observation. Run it
        // after the coarse source path so its latency or failure cannot delay
        // spike admission/attribution.
        this._scrollTracker.recordWheelInput(event);
      } catch (error) {
        reportBehaviorHubFailure('wheel_sample_tracking', error);
      }
    };
    this._boundOnMutations = (payload) => this._handleMutations(payload);
    this._boundOnVideoSeeking = (e) => this._handleVideoSeeking(e);
    this._boundOnVideoRateChange = (e) => this._handleVideoRateChange(e);
    this._boundOnVideoPlay = (e) => this._handleVideoPlayPause(e, 'play');
    this._boundOnVideoPause = (e) => this._handleVideoPlayPause(e, 'pause');
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      this._installListeners();
      this._initAnchorUnlockState();
    } catch (error) {
      reportBehaviorHubFailure('init', error);
      try {
        this._cleanupAfterInitFailure();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      this._initialized = false;
      throw error;
    }
  }

  teardown() {
    const errors = [];
    this._telemetryEnabled = false;
    this._clseMutationDemand = false;
    this._runCleanupStep(
      'teardown_scroll_spike_aggregation_admission',
      () => this._scrollSpikeSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    this._runCleanupStep(
      'teardown_short_media_aggregation_admission',
      () => this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    if (this._scrollRafId !== null && typeof cancelAnimationFrame === 'function') {
      try {
        cancelAnimationFrame(this._scrollRafId);
      } catch (error) {
        errors.push(error);
        reportBehaviorHubFailure('teardown_cancel_scroll_frame', error);
      }
    }
    this._scrollRafId = null;

    this._runCleanupStep('teardown_video_observer', () => this._teardownVideoObserver(), errors);
    this._runCleanupStep('teardown_tracked_videos', () => this._detachAllTrackedVideos(), errors);
    this._runCleanupStep('teardown_short_media_probe', () => this._shortMediaAttentionProbe.destroy(), errors);
    this._runCleanupStep('teardown_wheel_observer', () => this._teardownWheelObserver(), errors);
    this._runCleanupStep('teardown_listeners', () => this._teardownListeners(), errors);
    this._runCleanupStep(
      'teardown_observer',
      () => this._stopTelemetryMutationReporting(),
      errors,
    );
    this._runCleanupStep('teardown_clse_reporter', () => this._destroyCLSEReporter(), errors);
    if (errors.length > 0) {
      throw createBehaviorHubLifecycleError('BEHAVIOR_HUB_TEARDOWN_FAILED', errors);
    }
    this._subscribers.clear();
    this._feedItemSelector = null;
    this._seenFeedItems = new WeakSet();
    this._selectorFailureKeys.clear();
    this._context = {};
    this._anchorUnlockState = {
      stored: null,
      isUnlocked: true,
      initialized: false,
    };
    this._scrollTracker.destroy();
    this._judge.reset();
    this._initialized = false;
  }

  subscribe(eventName, handler) {
    if (typeof handler !== 'function') return () => {};
    this.init();

    const bucket = this._subscribers.get(eventName) || new Set();
    bucket.add(handler);
    this._subscribers.set(eventName, bucket);

    return () => {
      const current = this._subscribers.get(eventName);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) this._subscribers.delete(eventName);
    };
  }

  /**
   * 현재 활성화된 필터 설정 등 컨텍스트를 업데이트합니다.
   * 모든 행동 이벤트에 이 정보가 태깅됩니다.
   */
  updateContext(context) {
    this._context = { ...this._context, ...context };
    if (context && Object.prototype.hasOwnProperty.call(context, 'precisionInsightsAllowed')) {
      this._setTelemetryEnabled(context.precisionInsightsAllowed === true);
    }
    if (context && Object.prototype.hasOwnProperty.call(context, 'protectionMainActive') && !context.protectionMainActive) {
      signalGate.setFeatureEnabled(VIDEO_SKIP_SIGNAL_KEY, false, { reason: 'protection_main_inactive' });
    }
  }

  _emitShortMediaAttention(payload) {
    if (!this._telemetryEnabled) return;
    this._shortMediaAttentionSignalAggregator.record(Number(payload?.watchMs));
  }

  _emitSignal(signal) {
    if (!signal) return;
    let signalKey = null;
    if (signal?.type === BEHAVIOR_SIGNAL_TYPES.VIDEO_SKIP) {
      signalKey = VIDEO_SKIP_SIGNAL_KEY;
    }

    if (signalKey && !signalGate.isFeatureEnabled(signalKey)) {
      return;
    }
    this._emit(BEHAVIOR_HUB_EVENTS.BEHAVIOR_SIGNAL, signal);
  }

  _emit(eventName, payload) {
    const bucket = this._subscribers.get(eventName);
    if (!bucket || bucket.size === 0) return;

    if (CONTENT_DEBUG_TOOLS_ENABLED && isBehaviorHubDebugEnabled()) {
      console.debug('[BehaviorHub] emit', {
        eventName,
        subscribers: bucket.size,
        payload,
      });
    }

    for (const handler of bucket) {
      try {
        handler(payload);
      } catch (err) {
        reportBehaviorHubFailure('subscriber_callback', err, {
          eventName,
        });
        console.error(`[BehaviorHub] Error in subscriber for ${eventName}:`, err);
      }
    }
  }

  _installListeners() {
    this._addListenerGroup(this._getListenerBindings(), 'listeners_attach', 'listeners_attach_rollback');
  }

  _teardownListeners() {
    this._removeListenerGroup(this._getListenerBindings(), 'listeners_detach');
  }

  _getListenerBindings() {
    return [
      {
        target: document,
        type: 'mousedown',
        listener: this._boundOnMouseDown,
        addOptions: true,
        removeOptions: true,
      },
    ];
  }

  _addListenerGroup(bindings, phase, rollbackPhase) {
    const applied = [];
    try {
      bindings.forEach((binding) => {
        binding.target.addEventListener(binding.type, binding.listener, binding.addOptions);
        applied.push(binding);
      });
    } catch (error) {
      reportBehaviorHubFailure(phase, error, {
        eventType: bindings[applied.length]?.type || 'unknown',
      });
      [...applied].reverse().forEach((binding) => {
        try {
          binding.target.removeEventListener(binding.type, binding.listener, binding.removeOptions);
        } catch (rollbackError) {
          reportBehaviorHubFailure(rollbackPhase, rollbackError, {
            eventType: binding.type,
          });
        }
      });
      throw error;
    }
  }

  _removeListenerGroup(bindings, phase) {
    const errors = [];
    bindings.forEach((binding) => {
      try {
        binding.target.removeEventListener(binding.type, binding.listener, binding.removeOptions);
      } catch (error) {
        errors.push(error);
        reportBehaviorHubFailure(phase, error, {
          eventType: binding.type,
        });
      }
    });
    if (errors.length > 0) {
      throw createBehaviorHubLifecycleError('BEHAVIOR_HUB_LISTENER_DETACH_FAILED', errors);
    }
  }

  _installWheelObserver() {
    if (this._wheelUnsub) return;
    try {
      this._wheelUnsub = scrollInputOrchestrator.subscribe(this._boundOnWheel);
    } catch (error) {
      reportBehaviorHubFailure('wheel_observer_subscribe', error);
      throw error;
    }
  }

  _installScrollObserver() {
    if (this._scrollListenerAttached) return;
    try {
      window.addEventListener('scroll', this._boundOnScroll, { passive: true });
      this._scrollListenerAttached = true;
    } catch (error) {
      reportBehaviorHubFailure('scroll_observer_subscribe', error);
      throw error;
    }
  }

  _teardownWheelObserver() {
    if (!this._wheelUnsub) return;
    try {
      this._wheelUnsub();
      this._wheelUnsub = null;
    } catch (error) {
      reportBehaviorHubFailure('wheel_observer_unsubscribe', error);
      throw error;
    }
  }

  _teardownScrollObserver() {
    if (!this._scrollListenerAttached) return;
    try {
      window.removeEventListener('scroll', this._boundOnScroll, { passive: true });
      this._scrollListenerAttached = false;
    } catch (error) {
      reportBehaviorHubFailure('scroll_observer_unsubscribe', error);
      throw error;
    }
  }

  _initCLSEReporter() {
    if (!this._telemetryEnabled) return;
    if (!isContentClseReporterEnabled()) return;
    if (this._clseReporter) return;
    this._clseReporter = new CLSEContentReporter({
      onCollectionDemandChange: (enabled) => this._handleClseMutationDemandChange(enabled),
    });
    try {
      this._clseReporter.start();
      this._installScrollObserver();
    } catch (error) {
      const reporter = this._clseReporter;
      this._clseReporter = null;
      try {
        this._teardownScrollObserver();
        reporter?.stop();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  }

  _setTelemetryEnabled(enabled) {
    const nextEnabled = enabled === true;
    if (nextEnabled && this._telemetryEnabled) {
      this._scrollSpikeSignalAggregator.setAdmissionEnabled(true);
      this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(true);
      return;
    }
    this._telemetryEnabled = nextEnabled;
    if (this._telemetryEnabled) {
      try {
        this._scrollSpikeSignalAggregator.setAdmissionEnabled(true);
        this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(true);
        this._installWheelObserver();
        this._initCLSEReporter();
        this._shortMediaAttentionProbe.setEnabled(areContentFlowSignalsEnabled());
        this._installVideoObserver();
      } catch (error) {
        const cleanupErrors = [];
        this._telemetryEnabled = false;
        this._clseMutationDemand = false;
        this._runCleanupStep(
          'telemetry_enable_scroll_spike_aggregation_rollback',
          () => this._scrollSpikeSignalAggregator.setAdmissionEnabled(false),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_short_media_aggregation_rollback',
          () => this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(false),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_wheel_observer_rollback',
          () => this._teardownWheelObserver(),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_observer_rollback',
          () => this._stopTelemetryMutationReporting(),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_video_observer_rollback',
          () => this._teardownVideoObserver(),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_tracked_videos_rollback',
          () => this._detachAllTrackedVideos(),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_short_media_probe_rollback',
          () => this._shortMediaAttentionProbe.setEnabled(false),
          cleanupErrors,
        );
        this._runCleanupStep(
          'telemetry_enable_clse_reporter_rollback',
          () => this._destroyCLSEReporter(),
          cleanupErrors,
        );
        if (cleanupErrors.length > 0 && error && typeof error === 'object') {
          error.cleanupError = createBehaviorHubLifecycleError(
            'BEHAVIOR_HUB_TELEMETRY_ENABLE_ROLLBACK_FAILED',
            cleanupErrors,
          );
        }
        reportBehaviorHubFailure('telemetry_enable', error);
        throw error;
      }
      return;
    }
    this._clseMutationDemand = false;
    const errors = [];
    this._runCleanupStep(
      'telemetry_scroll_spike_aggregation_admission',
      () => this._scrollSpikeSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    this._runCleanupStep(
      'telemetry_short_media_aggregation_admission',
      () => this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    this._runCleanupStep(
      'telemetry_wheel_observer',
      () => this._teardownWheelObserver(),
      errors,
    );
    this._runCleanupStep(
      'telemetry_observer',
      () => this._stopTelemetryMutationReporting(),
      errors,
    );
    this._runCleanupStep('telemetry_video_observer', () => this._teardownVideoObserver(), errors);
    this._runCleanupStep('telemetry_tracked_videos', () => this._detachAllTrackedVideos(), errors);
    this._runCleanupStep('telemetry_short_media_probe', () => this._shortMediaAttentionProbe.setEnabled(false), errors);
    this._runCleanupStep('telemetry_clse_reporter', () => this._destroyCLSEReporter(), errors);
    if (errors.length > 0) {
      throw createBehaviorHubLifecycleError('BEHAVIOR_HUB_TELEMETRY_DISABLE_FAILED', errors);
    }
  }

  _destroyCLSEReporter() {
    const errors = [];
    this._runCleanupStep('clse_scroll_observer', () => this._teardownScrollObserver(), errors);
    if (this._clseReporter) {
      const reporter = this._clseReporter;
      this._clseReporter = null;
      this._runCleanupStep('clse_reporter_stop', () => reporter.stop(), errors);
    }
    if (errors.length > 0) {
      throw createBehaviorHubLifecycleError('BEHAVIOR_HUB_CLSE_REPORTER_DESTROY_FAILED', errors);
    }
  }

  _startTelemetryMutationReporting() {
    if (!this._telemetryEnabled || !this._clseMutationDemand || !this._clseReporter) return;
    if (this._mutationReportingActive) return;
    this._cancelMutationCleanupRetry();
    const targets = getBehaviorTargets(window.location?.hostname);
    this._feedItemSelector = targets.feedObservationItemTargets;
    this._seenFeedItems = new WeakSet();
    this._selectorFailureKeys.clear();
    this._installObserver();
    this._seedExistingFeedItems();
    this._mutationReportingActive = true;
  }

  _stopTelemetryMutationReporting() {
    this._mutationReportingActive = false;
    try {
      this._teardownObserver();
    } catch (error) {
      this._scheduleMutationCleanupRetry();
      throw error;
    }
    this._resetTelemetryMutationState();
    this._cancelMutationCleanupRetry();
  }

  _scheduleMutationCleanupRetry() {
    if (!this._observerUnsub || this._mutationCleanupRetryTimer) return;
    const delayMs = MUTATION_CLEANUP_RETRY_DELAYS_MS[this._mutationCleanupRetryAttempt];
    if (!Number.isFinite(delayMs) || typeof globalThis.setTimeout !== 'function') {
      reportBehaviorHubFailure(
        'mutation_cleanup_retry_exhausted',
        new Error('BEHAVIOR_HUB_MUTATION_CLEANUP_RETRY_EXHAUSTED'),
        { attempts: this._mutationCleanupRetryAttempt },
      );
      return;
    }
    this._mutationCleanupRetryAttempt += 1;
    this._mutationCleanupRetryTimer = globalThis.setTimeout(() => {
      this._mutationCleanupRetryTimer = null;
      if (this._mutationReportingActive || (this._telemetryEnabled && this._clseMutationDemand)) {
        this._mutationCleanupRetryAttempt = 0;
        return;
      }
      try {
        this._stopTelemetryMutationReporting();
      } catch (error) {
        reportBehaviorHubFailure('mutation_cleanup_retry', error, {
          attempt: this._mutationCleanupRetryAttempt,
        });
      }
    }, delayMs);
  }

  _cancelMutationCleanupRetry() {
    if (this._mutationCleanupRetryTimer && typeof globalThis.clearTimeout === 'function') {
      globalThis.clearTimeout(this._mutationCleanupRetryTimer);
    }
    this._mutationCleanupRetryTimer = null;
    this._mutationCleanupRetryAttempt = 0;
  }

  _handleClseMutationDemandChange(enabled) {
    this._clseMutationDemand = enabled === true;
    try {
      if (this._telemetryEnabled && this._clseMutationDemand) {
        this._startTelemetryMutationReporting();
        return;
      }
      this._stopTelemetryMutationReporting();
    } catch (error) {
      reportBehaviorHubFailure('clse_mutation_demand', error, {
        enabled: this._clseMutationDemand,
      });
    }
  }

  _resetTelemetryMutationState() {
    this._feedItemSelector = null;
    this._seenFeedItems = new WeakSet();
    this._selectorFailureKeys.clear();
  }

  _installObserver() {
    if (this._observerUnsub) return;
    try {
      this._observerUnsub = observerHub.subscribe(this._boundOnMutations, {
        childList: true,
        subtree: true,
        debugLabel: 'BehaviorHub.observer',
      });
    } catch (error) {
      reportBehaviorHubFailure('observer_subscribe', error);
      throw error;
    }
  }

  _teardownObserver() {
    if (!this._observerUnsub) return;
    try {
      this._observerUnsub();
      this._observerUnsub = null;
    } catch (error) {
      reportBehaviorHubFailure('observer_unsubscribe', error);
      throw error;
    }
  }

  _installVideoObserver() {
    if (this._videoObserverUnsub) return;
    try {
      this._videoObserverUnsub = videoElementObserver.subscribe({
        onVideo: (video) => this._attachVideo(video),
        onVideoRemoved: (video) => this._detachVideo(video),
        includeExisting: true,
        debugLabel: 'BehaviorHub.videoObserver',
      });
    } catch (error) {
      this._videoObserverUnsub = null;
      reportBehaviorHubFailure('video_observer_subscribe', error);
      throw error;
    }
  }

  _teardownVideoObserver() {
    if (!this._videoObserverUnsub) return;
    try {
      this._videoObserverUnsub();
      this._videoObserverUnsub = null;
    } catch (error) {
      reportBehaviorHubFailure('video_observer_unsubscribe', error);
      throw error;
    }
  }

  _runCleanupStep(phase, cleanup, errors) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
      reportBehaviorHubFailure(phase, error);
    }
  }

  _cleanupAfterInitFailure() {
    const errors = [];
    this._telemetryEnabled = false;
    this._clseMutationDemand = false;
    this._runCleanupStep(
      'init_cleanup_scroll_spike_aggregation_admission',
      () => this._scrollSpikeSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    this._runCleanupStep(
      'init_cleanup_short_media_aggregation_admission',
      () => this._shortMediaAttentionSignalAggregator.setAdmissionEnabled(false),
      errors,
    );
    this._runCleanupStep('init_cleanup_wheel_observer', () => this._teardownWheelObserver(), errors);
    this._runCleanupStep('init_cleanup_video_observer', () => this._teardownVideoObserver(), errors);
    this._runCleanupStep('init_cleanup_videos', () => this._detachAllTrackedVideos(), errors);
    this._runCleanupStep('init_cleanup_short_media_probe', () => this._shortMediaAttentionProbe.destroy(), errors);
    this._runCleanupStep('init_cleanup_listeners', () => this._teardownListeners(), errors);
    this._runCleanupStep(
      'init_cleanup_observer',
      () => this._stopTelemetryMutationReporting(),
      errors,
    );
    this._runCleanupStep('init_cleanup_clse_reporter', () => this._destroyCLSEReporter(), errors);
    this._feedItemSelector = null;
    this._seenFeedItems = new WeakSet();
    this._selectorFailureKeys.clear();
    this._scrollTracker.reset();
    this._judge.reset();
    if (errors.length > 0) {
      throw createBehaviorHubLifecycleError('BEHAVIOR_HUB_INIT_CLEANUP_FAILED', errors);
    }
  }

  _seedExistingFeedItems() {
    if (!this._feedItemSelector) return;
    const nodes = this._safeQueryFeedItems(document, 'feed_seed_query');
    if (!nodes) return;
    nodes.forEach((node) => {
      // The synchronous query already established selector membership.
      if (this._isFeedItemRoot(node)) this._seenFeedItems.add(node);
    });
  }

  _handleMutations({ addedNodes } = {}) {
    if (
      !this._telemetryEnabled
      || !this._clseMutationDemand
      || !this._mutationReportingActive
      || !this._clseReporter
    ) return;
    if (!addedNodes || addedNodes.length === 0) return;

    const roots = new Set();
    for (const node of addedNodes) {
      if (node instanceof Element && node.isConnected) roots.add(node);
    }
    const newFeedItems = [];
    for (const node of roots) {
      // Keep only outer roots in the current light-DOM tree. The receipt still
      // reports the original payload size, including non-element additions.
      let ancestor = node.parentElement;
      while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentElement;
      if (ancestor) continue;
      this._collectFeedItems(node, newFeedItems);
    }

    const freshFeedItems = newFeedItems.filter((item) => {
      if (this._seenFeedItems.has(item)) return false;
      this._seenFeedItems.add(item);
      return true;
    });

    this._clseReporter.recordContentMutation({
      addedNodes: addedNodes.length,
      feedItems: freshFeedItems.length,
    });

    // Infinite scroll guard signal is now driven only by cumulative scroll distance.
  }

  _attachVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (this._videoHandlers.has(video)) return;

    const bindings = [
      ['seeking', this._boundOnVideoSeeking],
    ];
    if (this._clseReporter) {
      bindings.push(
        ['ratechange', this._boundOnVideoRateChange],
        ['play', this._boundOnVideoPlay],
        ['pause', this._boundOnVideoPause],
      );
    }
    const applied = [];
    try {
      bindings.forEach(([eventName, listener]) => {
        video.addEventListener(eventName, listener, true);
        applied.push([eventName, listener]);
      });
    } catch (error) {
      [...applied].reverse().forEach(([eventName, listener]) => {
        try {
          video.removeEventListener(eventName, listener, true);
        } catch (rollbackError) {
          reportBehaviorHubFailure('video_listener_attach_rollback', rollbackError, { eventName });
        }
      });
      reportBehaviorHubFailure('video_listener_attach', error, {
        eventName: bindings[applied.length]?.[0] || 'unknown',
      });
      throw error;
    }

    this._trackedVideos.add(video);
    this._videoHandlers.set(video, bindings);
    this._shortMediaAttentionProbe.observeVideo(video);
  }

  _detachVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    const bindings = this._videoHandlers.get(video);
    if (!bindings) return;
    this._shortMediaAttentionProbe.detachVideo(video);
    bindings.forEach(([eventName, listener]) => {
      video.removeEventListener(eventName, listener, true);
    });
    this._videoHandlers.delete(video);
    this._trackedVideos.delete(video);
  }

  _detachAllTrackedVideos() {
    for (const video of this._trackedVideos) {
      this._detachVideo(video);
    }
    this._trackedVideos.clear();
  }

  _handleVideoSeeking(e) {
    const video = e?.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (video?.dataset?.frictionSkipReverting === '1') return;

    this._clseReporter?.recordMediaEvent('seek');
    const ts = Date.now();
    const signal = this._judge.recordVideoSkip({ ts, video });
    this._emitSignal(signal);
  }

  _handleVideoRateChange(e) {
    const video = e?.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (video?.dataset?.frictionSkipReverting === '1') return;
    this._clseReporter?.recordMediaEvent('rate');
  }

  _handleVideoPlayPause(e, type) {
    const video = e?.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (video?.dataset?.frictionSkipReverting === '1') return;
    this._clseReporter?.recordMediaEvent(type);
  }

  async _initAnchorUnlockState() {
    if (this._anchorUnlockState.initialized) return;
    this._anchorUnlockState.initialized = true;
    const stored = await ensureAnchorUnlockSettingInitialized();
    this._anchorUnlockState.stored = stored === true;
    if (ANCHOR_UNLOCK_TESTING_OVERRIDE) {
      this._anchorUnlockState.isUnlocked = true;
    } else {
      this._anchorUnlockState.isUnlocked = stored === true;
    }
  }

  _collectFeedItems(node, out) {
    if (!this._feedItemSelector) return;
    const match = this._matchesFeedItem(node, 'feed_item_match');
    if (match.failed) return;
    if (match.matched && this._isFeedItemRoot(node)) out.push(node);
    if (!node.querySelectorAll) return;
    const matches = this._safeQueryFeedItems(node, 'feed_mutation_query');
    if (!matches) return;
    matches.forEach((match) => {
      if (this._isFeedItemRoot(match)) out.push(match);
    });
  }

  _isFeedItemRoot(node) {
    if (!node || !(node instanceof Element)) return false;

    if (node.tagName === 'MAIN') return false;
    const role = node.getAttribute('role');
    if (role && role.toLowerCase() === 'main') return false;

    return true;
  }

  _matchesFeedItem(node, operation) {
    if (!node || !(node instanceof Element) || !this._feedItemSelector) {
      return { matched: false, failed: false };
    }
    try {
      return {
        matched: node.matches(this._feedItemSelector),
        failed: false,
      };
    } catch (error) {
      this._reportSelectorFailure(operation, this._feedItemSelector, error);
      return { matched: false, failed: true };
    }
  }

  _safeQueryFeedItems(root, operation) {
    if (!root || !this._feedItemSelector || typeof root.querySelectorAll !== 'function') return [];
    try {
      return Array.from(root.querySelectorAll(this._feedItemSelector));
    } catch (error) {
      this._reportSelectorFailure(operation, this._feedItemSelector, error);
      return null;
    }
  }

  _reportSelectorFailure(operation, selector, error) {
    const selectorText = String(selector || '');
    const errorText = getBehaviorHubErrorMessage(error, 'BEHAVIOR_HUB_SELECTOR_FAILURE');
    const key = `${operation}|${selectorText.slice(0, 240)}|${errorText}`;
    if (this._selectorFailureKeys.has(key)) return;
    this._selectorFailureKeys.add(key);
    reportBehaviorHubFailure(`${operation}_selector_failed`, error, {
      operation,
      selector,
    });
  }

}

const behaviorHub = new BehaviorHub();

export { BehaviorHub };
export default behaviorHub;
