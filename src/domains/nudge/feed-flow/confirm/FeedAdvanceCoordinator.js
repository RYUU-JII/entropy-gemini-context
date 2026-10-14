import {
  DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG,
  requireEnsoFeedHorizonRuntimeConfig,
} from '../config/ensoFeedHorizonRuntimeConfig.js';
import GenericFeedItemDiscovery from '../discovery/GenericFeedItemDiscovery.js';
import FeedContinuousReferenceDiscovery from '../discovery/FeedContinuousReferenceDiscovery.js';
import { buildStableItemContentKey } from '../discovery/feedItemContentIdentity.js';
import { readProgrammaticScrollWriteState } from '../../../../lib/dom/programmaticScrollWrites.js';
import { FEED_SURFACE_MODES } from '../registry/feedSurfaceProfiles.js';
import {
  readContainerHeight as resolveContainerHeight,
  readViewportHeight as resolveViewportHeight,
  readViewportWidth as resolveViewportWidth,
  resolveScrollContainer,
  resolveObservedScrollContainer,
  normalizeScroller,
} from '../resolve/ActiveScrollContainerResolver.js';
import {
  readFeedFlowDiagnosticElapsedMs,
  recordFeedFlowDiagnosticEvent,
  startFeedFlowDiagnosticMeasure,
} from '../diagnostics/feedFlowDiagnosticState.js';

const RECENT_GESTURE_WINDOW_MS = 2500;
const PAGED_SCAN_SETTLE_MS = 140;
const PAGED_BASELINE_MAX_SETTLE_MS = 320;
const PAGED_SCAN_MAX_GESTURE_LATENCY_MS = 1400;
const MAX_DOM_CANDIDATES = 48;
const MAX_DOMINANT_CONTENT_IDENTITIES = 128;
const RECENT_ACTIVITY_LIMIT = 24;
const VIEWPORT_HIT_TEST_RATIOS = Object.freeze([0.2, 0.5, 0.8]);

const KEY_SCROLL_RATIOS = Object.freeze({
  ArrowDown: 0.38,
  PageDown: 0.96,
  End: 1.2,
  ' ': 0.82,
  Spacebar: 0.82,
  j: 0.38,
});

function isElement(node) {
  return typeof Element !== 'undefined' && node instanceof Element;
}

function resolveIntentDeltaY(intent, containerHeight) {
  if (!intent) return 0;

  if (intent.kind === 'scroll') {
    return Math.abs(Number(intent.deltaY) || 0);
  }

  if (intent.kind === 'keydown') {
    const ratio = KEY_SCROLL_RATIOS[intent.key] || 0;
    return ratio > 0 ? Math.round(containerHeight * ratio) : 0;
  }

  return Math.abs(Number(intent.deltaY) || 0);
}

function normalizeSelector(selector) {
  return typeof selector === 'string' && selector.trim() ? selector.trim() : '';
}

function buildOpaqueDiagnosticToken(value) {
  const normalized = typeof value === 'string' ? value : '';
  if (!normalized) return '';
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `item-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function reportSelectorFailure(onSelectorFailure, phase, error, details = {}) {
  if (typeof onSelectorFailure !== 'function') return;
  onSelectorFailure(phase, error, {
    phase,
    error: String(error?.message || error || 'FEED_FLOW_SELECTOR_FAILURE'),
    ...details,
  });
}

function safeQueryAll(root, selector, onSelectorFailure = null) {
  if (!root || !selector || typeof root.querySelectorAll !== 'function') return [];
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    reportSelectorFailure(onSelectorFailure, 'feed_flow_query_selector', error, { selector });
    return null;
  }
}

function collapseNestedCandidates(elements = []) {
  const connectedElements = elements.filter((element) => (
    isElement(element) && element.isConnected
  ));
  const candidateSet = new Set(connectedElements);
  return connectedElements.filter((element) => {
    let ancestor = element.parentElement;
    while (ancestor) {
      if (candidateSet.has(ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

function collectBoundaryCandidates(elements = [], limit = MAX_DOM_CANDIDATES) {
  if (elements.length <= limit) return elements;
  const leadingCount = Math.floor(limit / 2);
  return [
    ...elements.slice(0, leadingCount),
    ...elements.slice(-(limit - leadingCount)),
  ];
}

function resolveOutermostViewportCandidate(candidate, outermostCandidateSet) {
  let current = candidate;
  while (isElement(current)) {
    if (outermostCandidateSet.has(current)) return current;
    current = current.parentElement;
  }
  return null;
}

function isRenderedDominantCandidate(element, windowRef) {
  if (!isElement(element)) return false;
  if (element.closest('[hidden], [inert]')) return false;
  if (typeof windowRef?.getComputedStyle !== 'function') {
    throw new Error('FEED_FLOW_DOMINANT_VISIBILITY_API_REQUIRED');
  }
  const style = windowRef.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && style.visibility !== 'collapse'
    && style.contentVisibility !== 'hidden';
}

function getElementRect(node) {
  if (!isElement(node) || typeof node.getBoundingClientRect !== 'function') return null;
  const rect = node.getBoundingClientRect();
  if (!rect) return null;
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return rect;
}

function computeVisibleScore(rect, viewportWidth, viewportHeight) {
  const visibleLeft = Math.max(0, rect.left);
  const visibleTop = Math.max(0, rect.top);
  const visibleRight = Math.min(viewportWidth, rect.right);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);
  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const visibleArea = visibleWidth * visibleHeight;
  if (visibleArea <= 0) return 0;

  const viewportArea = Math.max(1, viewportWidth * viewportHeight);
  const areaScore = Math.min(1, visibleArea / viewportArea);
  const rectCenterY = rect.top + (rect.height / 2);
  const viewportCenterY = viewportHeight / 2;
  const centerDistance = Math.abs(rectCenterY - viewportCenterY);
  const centerScore = Math.max(0, 1 - (centerDistance / Math.max(1, viewportHeight)));
  return (areaScore * 0.55) + (centerScore * 0.45);
}

function resolvePreferredVideo(node) {
  if (!isElement(node)) return null;
  const videos = node.matches?.('video')
    ? [node]
    : Array.from(node.querySelectorAll?.('video') || []);
  return videos.find((video) => (
    video?.paused === false
    && video?.ended !== true
    && Number(video?.readyState) >= 2
  )) || videos[0] || null;
}

function isActiveReadyVideo(video) {
  return !!(
    video
    && video.paused === false
    && video.ended !== true
    && Number(video.readyState) >= 2
  );
}

function buildVideoKey(node) {
  if (!isElement(node)) return '';
  const video = resolvePreferredVideo(node);
  if (!video) return '';
  const source = video.currentSrc || video.getAttribute?.('src') || '';
  if (source) {
    const queryIndex = source.search(/[?#]/);
    return `src:${queryIndex >= 0 ? source.slice(0, queryIndex) : source}`;
  }
  const poster = video.getAttribute?.('poster') || '';
  if (!poster) return '';
  const queryIndex = poster.search(/[?#]/);
  return `poster:${queryIndex >= 0 ? poster.slice(0, queryIndex) : poster}`;
}

function cloneIntent(intent) {
  if (!intent || typeof intent !== 'object') return null;
  return {
    kind: intent.kind || 'wheel',
    ts: Math.max(0, Number(intent.ts) || Date.now()),
    direction: intent.direction || 'forward',
    deltaY: Number.isFinite(Number(intent.deltaY)) ? Number(intent.deltaY) : null,
    key: intent.key || null,
    pointerType: intent.pointerType || null,
    targetPath: Array.isArray(intent.targetPath) ? [...intent.targetPath] : [],
    sourceElement: intent.sourceElement || null,
    sourceScroller: intent.sourceScroller || null,
  };
}

function cloneActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;
  return {
    kind: typeof activity.kind === 'string' && activity.kind ? activity.kind : 'click',
    ts: Math.max(0, Number(activity.ts) || Date.now()),
    targetPath: Array.isArray(activity.targetPath) ? [...activity.targetPath] : [],
    sourceElement: activity.sourceElement || null,
    isEditable: !!activity.isEditable,
    isInteractive: !!activity.isInteractive,
    isNavigationLike: !!activity.isNavigationLike,
  };
}

export class FeedAdvanceCoordinator {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    continuousAdapter,
    pagedAdapter,
    hybridAdapter,
    onAdvanceEvent = null,
    onRuntimeFailure = null,
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._continuousAdapter = continuousAdapter;
    this._pagedAdapter = pagedAdapter;
    this._hybridAdapter = hybridAdapter;
    this._onAdvanceEvent = onAdvanceEvent;
    this._onRuntimeFailure = onRuntimeFailure;
    this._config = DEFAULT_ENSO_FEED_HORIZON_RUNTIME_CONFIG;
    this._surface = null;
    this._genericDiscovery = new GenericFeedItemDiscovery({
      documentRef: this._document,
      onSelectorFailure: (phase, error, details) => this._reportRuntimeFailure(phase, error, details),
    });
    this._continuousReferenceDiscovery = new FeedContinuousReferenceDiscovery({
      windowRef: this._window,
      documentRef: this._document,
      onRuntimeFailure: (phase, error, details) => this._reportRuntimeFailure(phase, error, details),
    });
    this._lastForwardIntent = null;
    this._lastForwardIntentTs = 0;
    this._lastActiveVideoKey = '';
    this._pagedScanTimer = null;
    this._pagedScanScheduledAt = 0;
    this._forwardIntentCount = 0;
    this._backwardIntentCount = 0;
    this._reverseScrollDistance = 0;
    this._revisitCount = 0;
    this._recentInteractiveActions = [];
    this._lastClickThroughAt = 0;
    this._lastInputFocusAt = 0;
    this._lastTypingAt = 0;
    this._lastSelectionAt = 0;
    this._lastMediaPlayAt = 0;
    this._lastMediaPauseAt = 0;
    this._mediaPlayStartedAt = 0;
    this._sustainedMediaWatchMs = 0;
    this._activeVideoChangedCount = 0;
    this._dominantIdentityByElement = new WeakMap();
    this._dominantItemKeyByContentKey = new Map();
    this._nextDominantElementToken = 1;
    this._seenDominantItemKeys = new Set();
    this._seenContinuousItemKeys = new Set();
    this._lastDominantItemKey = '';
    this._lastImmediatePagedScanTs = 0;
    this._pendingPagedAdvanceDiagnostic = null;
    this._scrollWriteRevisions = new WeakMap();
    this._pendingIntentScroller = null;
    this._scrollWriteBaselineScroller = null;
  }

  setSurface(surface = null) {
    this._surface = surface && typeof surface === 'object' ? { ...surface } : null;
    this._genericDiscovery.setSurface(this._surface);
    this._resetSurfaceState();
    this._seedKnownItems();
    this._seedScrollWriteBaseline();
    this._synchronizePagedBaseline(Date.now());
  }

  setConfig(runtimeConfig) {
    this._config = requireEnsoFeedHorizonRuntimeConfig(runtimeConfig);
  }

  reset() {
    this._resetSurfaceState();
    this._genericDiscovery.setSurface(this._surface);
    this._seedKnownItems();
    this._seedScrollWriteBaseline();
    this._synchronizePagedBaseline(Date.now());
  }

  stop() {
    this._resetSurfaceState();
    this._genericDiscovery.setSurface(null);
  }

  handleIntent(rawIntent = null) {
    const intent = cloneIntent(rawIntent);
    if (!intent) return null;
    const writeContinuity = this._reconcileScrollWriteContinuity(intent.ts, intent);
    if (writeContinuity.inProgress || (writeContinuity.changed && intent.kind === 'scroll')) return null;
    recordFeedFlowDiagnosticEvent('intent', {
      ts: intent.ts,
      kind: intent.kind,
      direction: intent.direction,
    });
    const surfaceMode = this._resolveSurfaceMode();
    const pagedScrollMotion = (
      surfaceMode === FEED_SURFACE_MODES.PAGED
      && intent.kind === 'scroll'
    );
    const pagedBaselineReconciliationAttempted = (
      surfaceMode === FEED_SURFACE_MODES.PAGED
      && !pagedScrollMotion
      && this._pagedBaselineReconciliationRequired
    );
    if (pagedBaselineReconciliationAttempted) {
      this._reconcilePagedBaselineBeforeGesture(intent.ts);
    }

    if (intent.direction !== 'forward') {
      if (pagedScrollMotion) {
        this._schedulePagedScan(intent.ts, { trigger: 'scroll_settle' });
        return null;
      }
      this._recordBackwardIntent(intent);
      this._continuousAdapter?.reset?.();
      this._lastForwardIntent = null;
      this._lastForwardIntentTs = 0;
      return null;
    }

    if (!pagedScrollMotion) {
      this._forwardIntentCount += 1;
      this._lastForwardIntent = intent;
      this._lastForwardIntentTs = intent.ts;
      this._pendingIntentScroller = normalizeScroller(this._resolveActiveScroller(intent), this._document);
      if (surfaceMode === FEED_SURFACE_MODES.PAGED) {
        this._pagedGestureSequence += 1;
        this._pagedScanDeadlineTs = intent.ts + PAGED_SCAN_MAX_GESTURE_LATENCY_MS;
      }
    }

    const shouldThrottleWheelImmediate = (
      intent.kind === 'wheel'
      && this._lastImmediatePagedScanTs > 0
      && (intent.ts - this._lastImmediatePagedScanTs) < PAGED_SCAN_SETTLE_MS
    );
    if (!shouldThrottleWheelImmediate && intent.kind === 'wheel') {
      this._lastImmediatePagedScanTs = intent.ts;
    }

    const continuousEvent = this._shouldEvaluateContinuous(intent, surfaceMode)
      ? this._buildContinuousEventFromIntent(intent)
      : null;
    const pagedEvent = this._shouldEvaluatePaged(intent, surfaceMode)
      && !pagedBaselineReconciliationAttempted
      && !shouldThrottleWheelImmediate
      ? this._capturePagedTransition(intent.ts, {
        confirmationReason: 'intent_immediate',
        gestureSequence: this._pagedGestureSequence,
      })
      : null;

    if (this._shouldSchedulePagedScan(surfaceMode)) {
      this._schedulePagedScan(intent.ts, {
        trigger: pagedScrollMotion ? 'scroll_settle' : 'intent_settle',
      });
    }

    return this._emitSurfaceEvent({
      surfaceMode,
      continuousEvent,
      pagedEvent,
    });
  }

  handleMutation(payload = null) {
    const ts = Math.max(0, Number(payload?.ts) || Date.now());
    const writeContinuity = this._reconcileScrollWriteContinuity(ts);
    if (writeContinuity.changed || writeContinuity.inProgress) return null;
    const surfaceMode = this._resolveSurfaceMode();
    if (surfaceMode === FEED_SURFACE_MODES.CONTINUOUS) return null;
    const supply = this._observeSupplyMutation(payload);
    if (!supply.needsRevalidation) {
      if (
        surfaceMode === FEED_SURFACE_MODES.PAGED
        && (
          this._hasRecentForwardIntent(ts)
          || !this._lastDominantItemKey
        )
      ) {
        this._schedulePagedScan(ts, { trigger: 'mutation_settle' });
      }
      return null;
    }

    // Added DOM is supply, not displacement or exposure. Continuous novelty is
    // sampled from the visible reference at actual forward scroll observations.
    const pagedEvent = (
      surfaceMode !== FEED_SURFACE_MODES.CONTINUOUS
      && surfaceMode !== FEED_SURFACE_MODES.PAGED
    )
      ? this._capturePagedTransition(ts, {
        confirmationReason: 'mutation_immediate',
        gestureSequence: this._pagedGestureSequence,
      })
      : null;

    if (this._shouldSchedulePagedScan(surfaceMode)) {
      this._schedulePagedScan(ts, { trigger: 'mutation_settle' });
    }

    return this._emitSurfaceEvent({
      surfaceMode,
      pagedEvent,
    });
  }

  handleActivity(rawActivity = null) {
    const activity = cloneActivity(rawActivity);
    if (!activity) return null;
    this._reconcileScrollWriteContinuity(activity.ts);

    this._pruneRecentInteractiveActions(activity.ts);

    switch (activity.kind) {
      case 'click':
        if (activity.isInteractive || activity.isNavigationLike) {
          this._recordInteractiveAction(activity.ts);
        }
        if (activity.isNavigationLike) {
          this._lastClickThroughAt = activity.ts;
        }
        break;
      case 'focus':
        if (activity.isInteractive || activity.isEditable) {
          this._recordInteractiveAction(activity.ts);
        }
        if (activity.isEditable) {
          this._lastInputFocusAt = activity.ts;
        }
        break;
      case 'input':
        this._recordInteractiveAction(activity.ts);
        this._lastTypingAt = activity.ts;
        break;
      case 'selection':
        this._recordInteractiveAction(activity.ts);
        this._lastSelectionAt = activity.ts;
        break;
      case 'media_play':
        this._lastMediaPlayAt = activity.ts;
        if (this._mediaPlayStartedAt <= 0) {
          this._mediaPlayStartedAt = activity.ts;
        }
        if (this._resolveSurfaceMode() === FEED_SURFACE_MODES.PAGED) {
          if (this._hasRecentForwardIntent(activity.ts)) {
            this._schedulePagedScan(activity.ts, { trigger: 'media_play_settle' });
          } else {
            this._capturePagedTransition(activity.ts, {
              allowBaselineSync: true,
              confirmationReason: 'baseline_sync',
            });
          }
        }
        break;
      case 'media_pause':
        this._lastMediaPauseAt = activity.ts;
        this._reconcileMediaWatch(activity.ts, { closeSession: true });
        break;
      default:
        break;
    }

    return null;
  }

  handleVisibilityChange(payload = null) {
    if (payload?.visibilityState && payload.visibilityState !== 'visible') {
      this._reconcileMediaWatch(Math.max(0, Number(payload?.ts) || Date.now()), { closeSession: true });
      this.reset();
    }
  }

  _emitSurfaceEvent({ surfaceMode, continuousEvent = null, pagedEvent = null } = {}) {
    let event = null;
    if (surfaceMode === FEED_SURFACE_MODES.HYBRID) {
      // Each component is emitted once. A later callback must not replay the
      // displacement that was already published by an earlier callback.
      event = this._hybridAdapter.merge({
        continuousEvent,
        pagedEvent,
      });
    } else {
      event = pagedEvent || continuousEvent;
    }

    if (!event) return null;
    const decoratedEvent = this._decorateAdvanceEvent(event);
    const pagedAdvanceDiagnostic = pagedEvent
      ? this._pendingPagedAdvanceDiagnostic
      : null;
    recordFeedFlowDiagnosticEvent('advance', {
      ts: decoratedEvent.ts,
      surfaceMode: decoratedEvent.surfaceMode,
      source: decoratedEvent.source,
      itemTransitions: decoratedEvent.itemTransitionCount,
      screenfulDelta: decoratedEvent.screenfulDelta,
      ...pagedAdvanceDiagnostic,
    });
    if (pagedEvent) this._pendingPagedAdvanceDiagnostic = null;
    this._onAdvanceEvent?.(decoratedEvent);
    return decoratedEvent;
  }

  _shouldEvaluateContinuous(intent, surfaceMode) {
    if (!intent || surfaceMode === FEED_SURFACE_MODES.PAGED || surfaceMode === FEED_SURFACE_MODES.DOCUMENT) {
      return false;
    }
    return intent.kind === 'scroll';
  }

  _shouldEvaluatePaged(intent, surfaceMode) {
    if (!intent || surfaceMode === FEED_SURFACE_MODES.CONTINUOUS || surfaceMode === FEED_SURFACE_MODES.DOCUMENT) {
      return false;
    }
    if (surfaceMode === FEED_SURFACE_MODES.PAGED && intent.kind === 'scroll') {
      return false;
    }
    return ['wheel', 'scroll', 'keydown', 'touch', 'pointer'].includes(intent.kind);
  }

  _shouldSchedulePagedScan(surfaceMode) {
    return surfaceMode === FEED_SURFACE_MODES.PAGED
      || surfaceMode === FEED_SURFACE_MODES.HYBRID
      || surfaceMode === FEED_SURFACE_MODES.UNKNOWN;
  }

  _buildContinuousEventFromIntent(intent) {
    const scroller = this._resolveActiveScroller(intent);
    const containerHeight = resolveContainerHeight(scroller, this._window, this._document);
    const deltaY = resolveIntentDeltaY(intent, containerHeight);
    const referenceNode = this._resolveContinuousReferenceNode(intent.sourceElement, scroller);
    const freshItemsSeen = deltaY > 0
      ? this._observeContinuousReference(referenceNode, scroller)
      : 0;
    const event = this._continuousAdapter.recordProgress({
      ts: intent.ts,
      deltaY,
      containerHeight,
      freshItemsSeen,
      recentGesture: this._hasRecentForwardIntent(intent.ts),
      referenceNode,
      activeScroller: scroller,
    });
    return event;
  }

  _synchronizePagedBaseline(ts) {
    if (this._resolveSurfaceMode() !== FEED_SURFACE_MODES.PAGED) return;
    this._capturePagedTransition(ts, {
      allowBaselineSync: true,
      confirmationReason: 'baseline_sync',
    });
    if (!this._lastDominantItemKey) {
      this._pagedBaselineScanDeadlineTs = ts + PAGED_BASELINE_MAX_SETTLE_MS;
      this._schedulePagedScan(ts, { trigger: 'baseline_settle' });
    }
  }

  _capturePagedTransition(ts, {
    allowBaselineSync = false,
    confirmationReason = 'unknown',
    gestureSequence = this._pagedGestureSequence,
  } = {}) {
    const writeContinuity = this._reconcileScrollWriteContinuity(ts);
    if (writeContinuity.changed || writeContinuity.inProgress) return null;
    const requireRecentGesture = this._config.sensing.paged.requireRecentGesture;
    const recentGesture = this._hasRecentForwardIntent(ts);
    if (requireRecentGesture && !recentGesture && !allowBaselineSync) return null;

    const dominant = this._resolveDominantItem();
    if (!dominant?.itemKey) return null;
    this._pagedBaselineScanDeadlineTs = 0;

    const previousDominantItemKey = this._lastDominantItemKey;
    const previouslySeen = this._seenDominantItemKeys.has(dominant.itemKey);
    const revisited = previouslySeen && dominant.itemKey !== this._lastDominantItemKey;
    if (previouslySeen) this._seenDominantItemKeys.delete(dominant.itemKey);
    this._seenDominantItemKeys.add(dominant.itemKey);
    if (this._seenDominantItemKeys.size > MAX_DOMINANT_CONTENT_IDENTITIES) {
      const oldestItemKey = this._seenDominantItemKeys.values().next().value;
      this._seenDominantItemKeys.delete(oldestItemKey);
    }
    this._lastDominantItemKey = dominant.itemKey;

    const activeVideoChanged = !!(
      dominant.activeVideoKey
      && this._lastActiveVideoKey
      && dominant.activeVideoKey !== this._lastActiveVideoKey
    );
    this._lastActiveVideoKey = dominant.activeVideoKey || this._lastActiveVideoKey;

    if (this._pagedBaselineReconciliationRequired) {
      if (
        this._pagedGestureSequence
        > this._pagedBaselineReconciliationAfterGestureSequence
      ) {
        this._synchronizeResolvedPagedBaseline(dominant, ts);
        return false;
      }
      return null;
    }

    if (requireRecentGesture && !recentGesture) {
      this._pagedAdapter.synchronizeBaseline({
        itemKey: dominant.itemKey,
        ts,
      });
      return false;
    }

    const sameGestureTransitionSuppressed = (
      dominant.itemKey !== previousDominantItemKey
      && this._resolveSurfaceMode() === FEED_SURFACE_MODES.PAGED
      && requireRecentGesture
      && this._lastEmittedPagedGestureSequence === this._pagedGestureSequence
    );
    if (sameGestureTransitionSuppressed) {
      this._pagedBaselineReconciliationRequired = true;
      this._pagedBaselineReconciliationAfterGestureSequence = this._pagedGestureSequence;
      recordFeedFlowDiagnosticEvent('paged_transition_suppressed', { ts });
      return null;
    }

    const event = this._pagedAdapter.recordTransition({
      itemKey: dominant.itemKey,
      ts,
      recentGesture,
      activeVideoChanged,
      referenceNode: dominant.referenceNode,
    });
    if (
      event
      && this._resolveSurfaceMode() === FEED_SURFACE_MODES.PAGED
      && requireRecentGesture
      && this._lastEmittedPagedGestureSequence === this._pagedGestureSequence
    ) {
      this._pagedBaselineReconciliationRequired = true;
      this._pagedBaselineReconciliationAfterGestureSequence = this._pagedGestureSequence;
      recordFeedFlowDiagnosticEvent('paged_transition_suppressed', { ts });
      return null;
    }
    if (
      event
      && this._resolveSurfaceMode() === FEED_SURFACE_MODES.PAGED
      && requireRecentGesture
    ) {
      this._lastEmittedPagedGestureSequence = this._pagedGestureSequence;
    }
    if (event && revisited) {
      this._revisitCount += 1;
      this._lastRevisitAt = ts;
    }
    if (event && activeVideoChanged) this._activeVideoChangedCount += 1;
    if (event) {
      this._pendingPagedAdvanceDiagnostic = {
        gestureSequence,
        gestureKind: this._lastForwardIntent?.kind || 'unknown',
        confirmationReason,
        confirmationDelayMs: this._lastForwardIntentTs > 0
          ? Math.max(0, ts - this._lastForwardIntentTs)
          : 0,
        previousWinnerToken: buildOpaqueDiagnosticToken(previousDominantItemKey),
        winnerToken: buildOpaqueDiagnosticToken(dominant.itemKey),
        winnerActiveMedia: dominant.activeMedia === true,
        winnerIdentitySource: dominant.identitySource,
        activeVideoChanged,
      };
    }
    return event;
  }

  _reconcilePagedBaselineBeforeGesture(ts) {
    const dominant = this._resolveDominantItem();
    if (!dominant?.itemKey) return false;
    this._synchronizeResolvedPagedBaseline(dominant, ts);
    return true;
  }

  _synchronizeResolvedPagedBaseline(dominant, ts) {
    this._lastDominantItemKey = dominant.itemKey;
    this._lastActiveVideoKey = dominant.activeVideoKey || this._lastActiveVideoKey;
    this._pagedAdapter.synchronizeBaseline({
      itemKey: dominant.itemKey,
      ts,
    });
    this._pagedBaselineReconciliationRequired = false;
    this._pagedBaselineReconciliationAfterGestureSequence = -1;
    recordFeedFlowDiagnosticEvent('paged_baseline_reconciled', { ts });
  }

  _schedulePagedScan(ts, {
    deadlineOnly = false,
    gestureSequence = this._pagedGestureSequence,
    trigger = 'unknown',
  } = {}) {
    const surfaceMode = this._resolveSurfaceMode();
    const baselinePending = (
      surfaceMode === FEED_SURFACE_MODES.PAGED
      && !this._lastDominantItemKey
    );
    if (
      baselinePending
      && this._pagedBaselineScanDeadlineTs <= ts
    ) {
      this._pagedBaselineScanDeadlineTs = ts + PAGED_BASELINE_MAX_SETTLE_MS;
    }
    const requestedScanTs = deadlineOnly
      ? this._pagedScanDeadlineTs
      : ts + PAGED_SCAN_SETTLE_MS;
    const ownsCurrentPagedGesture = (
      surfaceMode === FEED_SURFACE_MODES.PAGED
      && this._hasRecentForwardIntent(ts)
      && this._pagedScanDeadlineTs > 0
      && gestureSequence === this._pagedGestureSequence
      && this._pagedDeadlineScanSequence !== this._pagedGestureSequence
    );
    if (deadlineOnly && !ownsCurrentPagedGesture) return;

    const gestureDeadlineTs = ownsCurrentPagedGesture
      ? this._pagedScanDeadlineTs
      : baselinePending
        ? this._pagedBaselineScanDeadlineTs
        : requestedScanTs;
    const requestedScanTargetTs = Math.min(
      requestedScanTs,
      Math.max(ts, gestureDeadlineTs),
    );
    const coalesced = !!this._pagedScanTimer;
    const awaitingFirstGestureConfirmation = ownsCurrentPagedGesture
      && this._lastEmittedPagedGestureSequence !== this._pagedGestureSequence;
    const preserveEarlierScan = coalesced
      && (baselinePending || awaitingFirstGestureConfirmation)
      && this._pagedScanScheduledAt > 0;
    const scheduledScanTs = Math.max(
      ts,
      preserveEarlierScan
        ? Math.min(this._pagedScanScheduledAt, requestedScanTargetTs)
        : requestedScanTargetTs,
    );
    const delayMs = Math.max(0, scheduledScanTs - ts);
    const deadlineCapped = ownsCurrentPagedGesture
      && scheduledScanTs === this._pagedScanDeadlineTs;
    const scheduledGestureSequence = gestureSequence;
    if (this._pagedScanTimer) {
      clearTimeout(this._pagedScanTimer);
      this._pagedScanTimer = null;
    }
    recordFeedFlowDiagnosticEvent('paged_scan_scheduled', {
      ts,
      coalesced,
    });

    this._pagedScanScheduledAt = scheduledScanTs;
    const timerArmedAt = Date.now();
    this._pagedScanTimer = setTimeout(() => {
      this._pagedScanTimer = null;
      this._pagedScanScheduledAt = 0;
      try {
        const timerLatenessMs = Math.max(
          0,
          Date.now() - timerArmedAt - delayMs,
        );
        const scanTs = scheduledScanTs + timerLatenessMs;
        if (
          deadlineCapped
          && scheduledGestureSequence === this._pagedGestureSequence
        ) {
          this._pagedDeadlineScanSequence = scheduledGestureSequence;
        }
        recordFeedFlowDiagnosticEvent('paged_scan_executed', {
          ts: scanTs,
        });
        const currentSurfaceMode = this._resolveSurfaceMode();
        const pagedEvent = this._capturePagedTransition(scanTs, {
          allowBaselineSync: currentSurfaceMode === FEED_SURFACE_MODES.PAGED,
          confirmationReason: deadlineOnly ? 'gesture_deadline' : trigger,
          gestureSequence: scheduledGestureSequence,
        });
        if (!pagedEvent) {
          const shouldConfirmAtDeadline = (
            currentSurfaceMode === FEED_SURFACE_MODES.PAGED
            && scheduledGestureSequence === this._pagedGestureSequence
            && this._lastEmittedPagedGestureSequence !== scheduledGestureSequence
            && this._pagedDeadlineScanSequence !== scheduledGestureSequence
            && scanTs < this._pagedScanDeadlineTs
          );
          if (shouldConfirmAtDeadline) {
            this._schedulePagedScan(scanTs, {
              deadlineOnly: true,
              gestureSequence: scheduledGestureSequence,
              trigger: 'gesture_deadline',
            });
          }
          return;
        }

        this._emitSurfaceEvent({
          surfaceMode: currentSurfaceMode,
          continuousEvent: null,
          pagedEvent,
        });
      } catch (error) {
        this._reportRuntimeFailure('feed_flow_paged_scan', error, {
          scheduledAt: Math.max(0, Number(ts) || 0),
          settleMs: PAGED_SCAN_SETTLE_MS,
          deadlineOnly,
        });
        throw error;
      }
    }, delayMs);
  }

  _reportRuntimeFailure(phase, error, details = {}) {
    if (typeof this._onRuntimeFailure !== 'function') return;
    try {
      this._onRuntimeFailure(phase, error, {
        phase,
        error: String(error?.message || error || 'FEED_FLOW_COORDINATOR_FAILURE'),
        ...details,
      });
    } catch (reportError) {
      if (error && typeof error === 'object') {
        error.reportError = reportError;
      }
    }
  }

  _seedScrollWriteBaseline() {
    const scroller = normalizeScroller(this._resolveActiveScroller(null), this._document);
    this._scrollWriteBaselineScroller = scroller;
    this._scrollWriteRevisions.set(
      scroller,
      readProgrammaticScrollWriteState(scroller, this._document).adjustmentRevision,
    );
  }

  _reconcileScrollWriteContinuity(ts, intent = null) {
    const incomingScroller = intent
      ? normalizeScroller(this._resolveActiveScroller(intent), this._document) : null;
    const scrollers = new Set([
      this._pendingIntentScroller,
      incomingScroller,
      this._scrollWriteBaselineScroller,
    ].filter(Boolean));
    let changed = false;
    let inProgress = false;
    for (const scroller of scrollers) {
      const state = readProgrammaticScrollWriteState(scroller, this._document);
      const previousRevision = this._scrollWriteRevisions.get(scroller);
      // Effect adjustments invalidate provisional displacement. Input assistance
      // retains existing confirmation behavior; its purpose is not attribution.
      // No prior sample is explicitly a zero (no known adjustment) baseline.
      if (state.adjustmentRevision !== (previousRevision === undefined ? 0 : previousRevision)) changed = true;
      if (state.adjustmentInProgress) inProgress = true;
      this._scrollWriteRevisions.set(scroller, state.adjustmentRevision);
    }
    if (incomingScroller) this._scrollWriteBaselineScroller = incomingScroller;
    if (changed || inProgress) this._discardWriteDiscontinuousInference(ts, { inProgress });
    return { changed, inProgress };
  }

  _discardWriteDiscontinuousInference(ts, { inProgress }) {
    if (this._pagedScanTimer) clearTimeout(this._pagedScanTimer);
    this._pagedScanTimer = null;
    this._pagedScanScheduledAt = 0;
    this._pagedScanDeadlineTs = 0;
    this._pagedBaselineScanDeadlineTs = 0;
    this._pagedDeadlineScanSequence = -1;
    this._lastEmittedPagedGestureSequence = -1;
    this._pendingPagedAdvanceDiagnostic = null;
    this._pagedBaselineReconciliationRequired = false;
    this._pagedBaselineReconciliationAfterGestureSequence = -1;
    this._lastImmediatePagedScanTs = 0;
    this._lastForwardIntent = null;
    this._lastForwardIntentTs = 0;
    this._pendingIntentScroller = null;
    this._continuousAdapter?.reset?.();
    this._pagedAdapter?.reset?.();
    this._hybridAdapter?.reset?.();
    this._lastDominantItemKey = '';
    this._lastActiveVideoKey = '';
    this._mediaPlayStartedAt = 0;
    // Directionality, observed media totals and identity history are retained.
    // A changed DOM winner is a new baseline, never a transition or revisit.
    if (inProgress) return;
    this._seedKnownItems();
    if (this._shouldSchedulePagedScan(this._resolveSurfaceMode())) {
      const dominant = this._resolveDominantItem();
      if (dominant?.itemKey) this._synchronizeResolvedPagedBaseline(dominant, ts);
    }
  }

  _resolveActiveScroller(intent) {
    if (intent?.kind === 'scroll' && intent.sourceScroller) {
      return resolveObservedScrollContainer(intent.sourceScroller, this._document);
    }
    const directionDelta = Number(intent?.deltaY) || 1;
    return resolveScrollContainer({
      sourceElement: intent?.sourceElement || null,
      eventTarget: intent?.sourceScroller || intent?.sourceElement || null,
      deltaY: directionDelta,
      documentRef: this._document,
    });
  }

  _resolveContinuousReferenceNode(sourceElement, scroller) {
    const candidateSelector = normalizeSelector(this._surface?.candidateItemSelectors);
    if (isElement(sourceElement) && sourceElement.isConnected) {
      if (candidateSelector) {
        try {
          const candidate = sourceElement.closest(candidateSelector);
          if (candidate && candidate.isConnected) return candidate;
        } catch (error) {
          this._reportRuntimeFailure('feed_flow_closest_selector', error, { selector: candidateSelector });
        }
      }
      if (
        sourceElement !== this._document?.body
        && sourceElement !== this._document?.documentElement
        && sourceElement !== scroller
      ) {
        return sourceElement;
      }
    }

    if (!candidateSelector || !this._document) return null;
    const candidates = safeQueryAll(
      this._document,
      candidateSelector,
      (phase, error, details) => this._reportRuntimeFailure(phase, error, details),
    );
    if (!candidates) return null;
    const viewportWidth = resolveViewportWidth(this._window, this._document);
    const viewportHeight = resolveViewportHeight(this._window, this._document);
    const viewportCandidates = this._collectViewportHitCandidates(
      candidateSelector,
      scroller,
      viewportWidth,
      viewportHeight,
    );
    const boundedCandidates = collectBoundaryCandidates(
      collapseNestedCandidates(candidates),
    );
    let winner = null;
    let bestScore = 0;
    Array.from(new Set([...viewportCandidates, ...boundedCandidates]))
      .slice(0, MAX_DOM_CANDIDATES)
      .forEach((candidate) => {
        if (
          !candidate.isConnected
          || (
            isElement(scroller)
            && scroller.isConnected
            && !scroller.contains(candidate)
          )
        ) return;
        const rect = getElementRect(candidate);
        if (!rect) return;
        const score = computeVisibleScore(rect, viewportWidth, viewportHeight);
        if (score <= bestScore) return;
        winner = candidate;
        bestScore = score;
      });
    if (winner) return winner;
    const structuralReference = this._continuousReferenceDiscovery.inspect({
      surface: this._surface,
      activeScroller: scroller,
    });
    return structuralReference.status === 'resolved' ? structuralReference.referenceNode : null;
  }

  _collectViewportHitCandidates(
    candidateSelector,
    scroller,
    viewportWidth,
    viewportHeight,
  ) {
    const documentRef = this._document;
    const elementsFromPoint = typeof documentRef?.elementsFromPoint === 'function'
      ? documentRef.elementsFromPoint.bind(documentRef)
      : null;
    const elementFromPoint = typeof documentRef?.elementFromPoint === 'function'
      ? documentRef.elementFromPoint.bind(documentRef)
      : null;
    if (!elementsFromPoint && !elementFromPoint) return [];

    const candidates = new Set();
    for (const xRatio of VIEWPORT_HIT_TEST_RATIOS) {
      for (const yRatio of VIEWPORT_HIT_TEST_RATIOS) {
        let hits = [];
        try {
          const x = Math.max(1, Math.min(viewportWidth - 1, viewportWidth * xRatio));
          const y = Math.max(1, Math.min(viewportHeight - 1, viewportHeight * yRatio));
          hits = elementsFromPoint
            ? elementsFromPoint(x, y)
            : [elementFromPoint(x, y)];
        } catch (error) {
          this._reportRuntimeFailure('feed_flow_viewport_hit_test', error, {
            selector: candidateSelector,
          });
          return [];
        }

        for (const hit of hits) {
          if (!isElement(hit)) continue;
          let candidate = null;
          try {
            candidate = hit.matches(candidateSelector)
              ? hit
              : hit.closest(candidateSelector);
          } catch (error) {
            this._reportRuntimeFailure('feed_flow_closest_selector', error, {
              selector: candidateSelector,
            });
            return [];
          }
          if (
            !isElement(candidate)
            || !candidate.isConnected
            || (
              isElement(scroller)
              && scroller.isConnected
              && !scroller.contains(candidate)
            )
          ) continue;
          candidates.add(candidate);
        }
      }
    }
    return Array.from(candidates);
  }

  _resolveDominantItem() {
    const dominantSelector = normalizeSelector(this._surface?.dominantItemSelectors);
    if (!dominantSelector || !this._document) return null;

    const measurementStartedAt = startFeedFlowDiagnosticMeasure();
    const viewportWidth = resolveViewportWidth(this._window, this._document);
    const viewportHeight = resolveViewportHeight(this._window, this._document);
    const candidateSelector = normalizeSelector(this._surface?.candidateItemSelectors);
    const rawElements = safeQueryAll(
      this._document,
      dominantSelector,
      (phase, error, details) => this._reportRuntimeFailure(phase, error, details),
    ) || [];
    const outermostElements = collapseNestedCandidates(rawElements);
    const outermostElementSet = new Set(outermostElements);
    const viewportElements = this._collectViewportHitCandidates(
      dominantSelector,
      null,
      viewportWidth,
      viewportHeight,
    ).map((candidate) => (
      resolveOutermostViewportCandidate(candidate, outermostElementSet)
    )).filter(Boolean);
    const elements = Array.from(new Set([
      ...viewportElements,
      ...collectBoundaryCandidates(outermostElements),
    ])).slice(0, MAX_DOM_CANDIDATES);

    let winner = null;
    let bestScore = 0;
    let geometryReads = 0;

    for (const element of elements) {
      if (!isElement(element) || !element.isConnected) continue;
      const rect = getElementRect(element);
      if (!rect) continue;
      geometryReads += 1;
      const visibleScore = computeVisibleScore(rect, viewportWidth, viewportHeight);
      if (
        visibleScore <= 0
        || !isRenderedDominantCandidate(element, this._window)
      ) continue;
      const candidateVideo = resolvePreferredVideo(element);
      const activeMedia = isActiveReadyVideo(candidateVideo);
      const score = (activeMedia ? 1 : 0) + visibleScore;
      if (score <= bestScore) continue;

      let referenceNode = element;
      if (candidateSelector) {
        try {
          referenceNode = element.closest(candidateSelector) || element;
        } catch (error) {
          this._reportRuntimeFailure('feed_flow_closest_selector', error, { selector: candidateSelector });
          referenceNode = element;
        }
      }

      const activeVideoKey = buildVideoKey(referenceNode) || buildVideoKey(element);
      const contentKey = buildStableItemContentKey(referenceNode);
      winner = {
        itemKey: this._resolveDominantItemKey(referenceNode, activeVideoKey, contentKey),
        referenceNode,
        activeVideoKey,
        activeMedia,
        identitySource: contentKey
          ? 'content_key'
          : activeVideoKey ? 'media_revision' : 'node_token',
      };
      bestScore = score;
      if (bestScore >= 1.8) break;
    }

    recordFeedFlowDiagnosticEvent('dominant_scan', {
      candidateCount: elements.length,
      rawCandidateCount: rawElements.length,
      nestedCandidateCount: Math.max(0, rawElements.length - outermostElements.length),
      geometryReads,
      winnerFound: !!winner,
      winnerToken: buildOpaqueDiagnosticToken(winner?.itemKey),
      winnerActiveMedia: winner?.activeMedia === true,
      durationMs: readFeedFlowDiagnosticElapsedMs(measurementStartedAt),
    });
    return winner;
  }

  _resolveDominantItemKey(referenceNode, activeVideoKey = '', contentKey = null) {
    if (!isElement(referenceNode)) return '';
    const resolvedContentKey = typeof contentKey === 'string'
      ? contentKey
      : buildStableItemContentKey(referenceNode);
    let identity = this._dominantIdentityByElement.get(referenceNode);
    if (!identity) {
      const token = this._nextDominantElementToken;
      const canonicalItemKey = resolvedContentKey
        ? this._dominantItemKeyByContentKey.get(resolvedContentKey)
        : '';
      identity = {
        token,
        revision: 0,
        contentKey: resolvedContentKey,
        activeVideoKey,
        itemKey: canonicalItemKey
          ? canonicalItemKey
          : `node:${token}|revision:0`,
      };
      this._nextDominantElementToken += 1;
      this._dominantIdentityByElement.set(referenceNode, identity);
      if (resolvedContentKey) {
        this._rememberDominantContentIdentity(resolvedContentKey, identity.itemKey);
      }
      return identity.itemKey;
    }

    if (resolvedContentKey && resolvedContentKey !== identity.contentKey) {
      const canonicalItemKey = this._dominantItemKeyByContentKey.get(resolvedContentKey);
      if (canonicalItemKey) {
        identity.itemKey = canonicalItemKey;
      } else if (identity.contentKey) {
        identity.revision += 1;
        identity.itemKey = `node:${identity.token}|revision:${identity.revision}`;
      }
      identity.contentKey = resolvedContentKey;
      this._rememberDominantContentIdentity(resolvedContentKey, identity.itemKey);
    } else if (resolvedContentKey) {
      this._rememberDominantContentIdentity(resolvedContentKey, identity.itemKey);
    }

    const videoChanged = !resolvedContentKey
      && !identity.contentKey
      && !!activeVideoKey
      && !!identity.activeVideoKey
      && activeVideoKey !== identity.activeVideoKey;
    if (videoChanged) {
      identity.revision += 1;
      identity.itemKey = `node:${identity.token}|revision:${identity.revision}`;
    }
    if (activeVideoKey) identity.activeVideoKey = activeVideoKey;
    return identity.itemKey;
  }

  _rememberDominantContentIdentity(contentKey, itemKey) {
    if (!contentKey || !itemKey) return;
    if (this._dominantItemKeyByContentKey.has(contentKey)) {
      this._dominantItemKeyByContentKey.delete(contentKey);
    }
    this._dominantItemKeyByContentKey.set(contentKey, itemKey);
    if (this._dominantItemKeyByContentKey.size <= MAX_DOMINANT_CONTENT_IDENTITIES) return;
    const oldestContentKey = this._dominantItemKeyByContentKey.keys().next().value;
    this._dominantItemKeyByContentKey.delete(oldestContentKey);
  }

  _observeSupplyMutation(payload) {
    const measurementStartedAt = startFeedFlowDiagnosticMeasure();
    const scan = this._genericDiscovery.observeMutations(payload);
    recordFeedFlowDiagnosticEvent('mutation_scan', {
      ts: payload?.ts,
      ...scan,
      durationMs: readFeedFlowDiagnosticElapsedMs(measurementStartedAt),
    });
    return scan;
  }

  _seedKnownItems() {
    if (this._resolveSurfaceMode() !== FEED_SURFACE_MODES.CONTINUOUS) {
      this._genericDiscovery.seedKnownItems();
    }
    if (![FEED_SURFACE_MODES.CONTINUOUS, FEED_SURFACE_MODES.HYBRID, FEED_SURFACE_MODES.UNKNOWN]
      .includes(this._resolveSurfaceMode())) return;
    const scroller = this._resolveActiveScroller(null);
    this._observeContinuousReference(this._resolveContinuousReferenceNode(null, scroller), scroller);
  }

  _isVisibleContinuousReference(node, scroller) {
    if (!node?.isConnected || !isRenderedDominantCandidate(node, this._window)) return false;
    const rect = getElementRect(node);
    if (!rect || computeVisibleScore(rect,
      resolveViewportWidth(this._window, this._document),
      resolveViewportHeight(this._window, this._document)) <= 0) return false;
    if (scroller && scroller !== this._document?.body && scroller !== this._document?.documentElement) {
      const clip = getElementRect(scroller);
      if (!clip || !scroller.contains(node)
        || Math.min(rect.bottom, clip.bottom) <= Math.max(rect.top, clip.top)
        || Math.min(rect.right, clip.right) <= Math.max(rect.left, clip.left)) return false;
    }
    return true;
  }

  _observeContinuousReference(referenceNode, scroller) {
    let visibleNode = referenceNode;
    if (!this._isVisibleContinuousReference(visibleNode, scroller)) {
      visibleNode = this._resolveContinuousReferenceNode(null, scroller);
      if (!this._isVisibleContinuousReference(visibleNode, scroller)) return 0;
    }
    const itemKey = this._resolveDominantItemKey(visibleNode);
    const previouslySeen = this._seenContinuousItemKeys.has(itemKey);
    // Keep continuous exposure separate from paged transition/revisit history.
    // A sampled reference is evidence of exposure, never a count of DOM supply.
    this._seenContinuousItemKeys.delete(itemKey);
    this._seenContinuousItemKeys.add(itemKey);
    if (this._seenContinuousItemKeys.size > MAX_DOMINANT_CONTENT_IDENTITIES) {
      this._seenContinuousItemKeys.delete(this._seenContinuousItemKeys.values().next().value);
    }
    return previouslySeen ? 0 : 1;
  }

  _decorateAdvanceEvent(event = null) {
    if (!event || typeof event !== 'object') return null;
    const ts = Math.max(0, Number(event.ts) || Date.now());
    return { ...event, loopSignals: this.getBehaviorSignals(ts) };
  }

  // Current intent/activity is observable without a new consumption advance.
  // Polling also prunes elapsed inhibitors rather than retaining their counts.
  getBehaviorSignals(ts = Date.now()) {
    this._pruneRecentInteractiveActions(ts);
    this._reconcileMediaWatch(ts);

    return {
      context: {
        surfaceMode: this._resolveSurfaceMode(),
        surfaceProfileId: this._surface?.profileId || '',
        semanticSurfaceId: this._surface?.semanticSurfaceId || '',
        surfaceConfidence: Math.max(0, Number(this._surface?.surfaceConfidence) || 0),
        contentClass: this._surface?.contentClass || 'feed',
      },
      directionality: this._buildDirectionalitySignals(),
      intentionality: {
        recentInteractiveActionCount: this._recentInteractiveActions.length,
        recentClickThroughAt: this._lastClickThroughAt,
        recentInputFocusAt: this._lastInputFocusAt,
        recentTypingAt: this._lastTypingAt,
        recentSelectionAt: this._lastSelectionAt,
      },
      media: {
        activeVideoChangedCount: this._activeVideoChangedCount,
        recentMediaPlayAt: this._lastMediaPlayAt,
        recentMediaPauseAt: this._lastMediaPauseAt,
        sustainedMediaWatchMs: this._resolveSustainedMediaWatchMs(ts),
      },
    };
  }

  _buildDirectionalitySignals() {
    const forwardIntentCount = Math.max(0, this._forwardIntentCount);
    const totalIntentCount = forwardIntentCount + this._backwardIntentCount;
    const backtrackRatio = totalIntentCount > 0
      ? (this._backwardIntentCount / totalIntentCount)
      : 0;

    return {
      forwardIntentCount,
      backwardIntentCount: this._backwardIntentCount,
      reverseScrollDistance: this._reverseScrollDistance,
      backtrackRatio,
      revisitCount: this._revisitCount,
      recentBackwardIntentAt: this._lastBackwardIntentAt,
      recentRevisitAt: this._lastRevisitAt,
    };
  }

  _recordBackwardIntent(intent) {
    const ts = Math.max(0, Number(intent?.ts) || Date.now());
    const scroller = this._resolveActiveScroller(intent);
    const containerHeight = resolveContainerHeight(scroller, this._window, this._document);
    const deltaMagnitude = resolveIntentDeltaY(intent, containerHeight);
    this._backwardIntentCount += 1;
    this._lastBackwardIntentAt = ts;
    this._reverseScrollDistance += Math.max(0, deltaMagnitude);
    this._pruneRecentInteractiveActions(ts);
  }

  _recordInteractiveAction(ts) {
    const normalizedTs = Math.max(0, Number(ts) || Date.now());
    this._recentInteractiveActions.push(normalizedTs);
    this._pruneRecentInteractiveActions(normalizedTs);
  }

  _pruneRecentInteractiveActions(now = Date.now()) {
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    const cutoff = normalizedNow - this._config.inhibitors.intentionalityWindowMs;
    this._recentInteractiveActions = this._recentInteractiveActions
      .filter((ts) => ts >= cutoff)
      .slice(-RECENT_ACTIVITY_LIMIT);
  }

  _resolveSustainedMediaWatchMs(now = Date.now()) {
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    if (this._mediaPlayStartedAt <= 0) return this._sustainedMediaWatchMs;
    return this._sustainedMediaWatchMs + Math.max(0, normalizedNow - this._mediaPlayStartedAt);
  }

  _reconcileMediaWatch(now = Date.now(), { closeSession = false } = {}) {
    const normalizedNow = Math.max(0, Number(now) || Date.now());
    if (this._mediaPlayStartedAt > 0) {
      this._sustainedMediaWatchMs += Math.max(0, normalizedNow - this._mediaPlayStartedAt);
      this._mediaPlayStartedAt = closeSession ? 0 : normalizedNow;
    }
  }

  _hasRecentForwardIntent(ts) {
    return !!(
      this._lastForwardIntent
      && this._lastForwardIntent.direction === 'forward'
      && (ts - this._lastForwardIntentTs) <= RECENT_GESTURE_WINDOW_MS
    );
  }

  _resolveSurfaceMode() {
    if (this._surface?.contentClass === 'document') {
      return FEED_SURFACE_MODES.DOCUMENT;
    }

    const forcedMode = this._config.sensing.mode;
    if (forcedMode && forcedMode !== 'auto') {
      return Object.values(FEED_SURFACE_MODES).includes(forcedMode)
        ? forcedMode
        : FEED_SURFACE_MODES.UNKNOWN;
    }

    const mode = this._surface?.surfaceMode;
    return Object.values(FEED_SURFACE_MODES).includes(mode)
      ? mode
      : FEED_SURFACE_MODES.UNKNOWN;
  }

  _resetSurfaceState() {
    if (this._pagedScanTimer) {
      clearTimeout(this._pagedScanTimer);
      this._pagedScanTimer = null;
    }
    this._pagedScanScheduledAt = 0;
    this._continuousAdapter?.reset?.();
    this._pagedAdapter?.reset?.();
    this._hybridAdapter?.reset?.();
    this._lastForwardIntent = null;
    this._lastForwardIntentTs = 0;
    this._lastActiveVideoKey = '';
    this._forwardIntentCount = 0;
    this._backwardIntentCount = 0;
    this._lastBackwardIntentAt = 0;
    this._reverseScrollDistance = 0;
    this._revisitCount = 0;
    this._lastRevisitAt = 0;
    this._recentInteractiveActions = [];
    this._lastClickThroughAt = 0;
    this._lastInputFocusAt = 0;
    this._lastTypingAt = 0;
    this._lastSelectionAt = 0;
    this._lastMediaPlayAt = 0;
    this._lastMediaPauseAt = 0;
    this._mediaPlayStartedAt = 0;
    this._sustainedMediaWatchMs = 0;
    this._activeVideoChangedCount = 0;
    this._dominantIdentityByElement = new WeakMap();
    this._dominantItemKeyByContentKey = new Map();
    this._nextDominantElementToken = 1;
    this._seenDominantItemKeys = new Set();
    this._seenContinuousItemKeys = new Set();
    this._lastDominantItemKey = '';
    this._lastImmediatePagedScanTs = 0;
    this._pendingPagedAdvanceDiagnostic = null;
    this._pagedBaselineReconciliationRequired = false;
    this._pagedBaselineReconciliationAfterGestureSequence = -1;
    this._pagedGestureSequence = 0;
    this._lastEmittedPagedGestureSequence = -1;
    this._pagedScanDeadlineTs = 0;
    this._pagedBaselineScanDeadlineTs = 0;
    this._pagedDeadlineScanSequence = -1;
    this._scrollWriteRevisions = new WeakMap();
    this._pendingIntentScroller = null;
    this._scrollWriteBaselineScroller = null;
  }
}

export default FeedAdvanceCoordinator;
