import observerHub from '../../../lib/dom/ObserverHub.js';
import { isFrictionDebugEnabled } from '@friction-debug-flags';
import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';
import { createMainThreadSliceDeadline, yieldMainThreadContinuation } from '../../../platform/scheduling/mainThreadCooperativeScheduler.js';
import { getMediaShadowRootAccessCapabilities, readMediaShadowRoot } from '../media/mediaShadowRootAccess.js';
import {
  collectOpenShadowRootsFromNode,
  isMediaObservationExcludedNode,
  isQueryableRoot,
} from '../media/pageMediaElements.js';

export { collectOpenShadowRootsFromNode };

const OBSERVER_DEBUG_LABEL = 'VideoElementObserver.observer';
const SUBSCRIBER_RETRY_DELAYS_MS = Object.freeze([50, 250, 1000]);
const MAX_RECENT_VIDEO_OPERATIONS = 24;
const RECOVERY_EVENT_PATH_LIMIT = 16;
const RECOVERY_EVENTS = Object.freeze(['pointerdown', 'keydown', 'focusin', 'play', 'loadedmetadata']);
export const MEDIA_DISCOVERY_ATTRIBUTE_FILTER = Object.freeze([
  'class', 'id', 'role', 'type', 'min', 'max', 'aria-label', 'aria-valuemin',
  'aria-valuemax', 'aria-controls', 'data-testid', 'data-e2e', 'data-video-player',
  'data-media-player', 'data-media-control', 'part',
]);
const MEDIA_OBSERVATION_OPTIONS = Object.freeze({
  childList: true, subtree: true, attributes: true,
  attributeFilter: MEDIA_DISCOVERY_ATTRIBUTE_FILTER,
});

function createVideoObserverDebugState() {
  return {
    startedAt: Date.now(),
    operations: 0,
    initialScans: 0,
    discoveryVisits: 0,
    discoverySlices: 0,
    removalReplayChecks: 0,
    removalReplaysQueued: 0,
    removalReplaysAvoided: 0,
    maxDiscoverySliceMs: 0,
    totalDiscoveryMs: 0,
    reconcileScans: 0,
    observerBatches: 0,
    shadowObserverBatches: 0,
    scannedRoots: 0,
    shadowRoots: 0,
    videosFound: 0,
    inventoryVisits: 0,
    uniqueVideos: 0,
    addedVideos: 0,
    removedVideos: 0,
    deliveryAttempts: 0,
    deliveries: 0,
    removalDeliveries: 0,
    deliverySkips: 0,
    retriesScheduled: 0,
    retryAttempts: 0,
    retryExhausted: 0,
    totalMs: 0,
    maxMs: 0,
    recentOperations: [],
  };
}

function getVideoObservationErrorMessage(error, fallback = 'VIDEO_ELEMENT_OBSERVER_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportVideoObservationFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getVideoObservationErrorMessage(error),
    ...details,
  };
  if (typeof console !== 'undefined') {
    console.warn?.('[VideoElementObserver] runtime failure', diagnostic);
  }
  return diagnostic;
}

export function isObservedVideoElement(value) {
  // An adopted element can retain another realm's constructor.
  return value?.nodeType === 1
    && value.localName === 'video'
    && value.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

export function collectVideoElementsFromNode(node, target = [], shadowRootTarget = null) {
  if (isMediaObservationExcludedNode(node)) return target;
  if (isObservedVideoElement(node)) {
    target.push(node);
    return target;
  }
  if (!isQueryableRoot(node)) return target;

  const seenShadowRoots = new WeakSet();
  const visitRoot = (root) => {
    root.querySelectorAll('*').forEach((candidate) => {
      if (isMediaObservationExcludedNode(candidate)) return;
      if (isObservedVideoElement(candidate)) target.push(candidate);

      const shadowRoot = readMediaShadowRoot(candidate);
      if (
        !isQueryableRoot(shadowRoot)
        || seenShadowRoots.has(shadowRoot)
        || isMediaObservationExcludedNode(shadowRoot)
      ) return;
      seenShadowRoots.add(shadowRoot);
      shadowRootTarget?.push(shadowRoot);
      visitRoot(shadowRoot);
    });
  };

  const directShadowRoot = readMediaShadowRoot(node);
  if (
    isQueryableRoot(directShadowRoot)
    && !isMediaObservationExcludedNode(directShadowRoot)
  ) {
    seenShadowRoots.add(directShadowRoot);
    shadowRootTarget?.push(directShadowRoot);
    visitRoot(directShadowRoot);
  }
  visitRoot(node);
  return target;
}

export function scanExistingVideoElements(root = null) {
  const scanRoot = root || (typeof document !== 'undefined' ? document : null);
  if (!isQueryableRoot(scanRoot)) return [];
  const videos = [];
  collectVideoElementsFromNode(scanRoot, videos);
  return Array.from(new Set(videos));
}

function isConnectedVideo(video, documentRef) {
  if (!isObservedVideoElement(video) || video.ownerDocument !== documentRef) return false;
  if (typeof video.isConnected === 'boolean') return video.isConnected;
  return documentRef?.contains(video) === true;
}

function isInventoryElement(node, localName) {
  return node?.nodeType === 1 && node.localName === localName
    && node.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

// Keep traversal state between slices. Building a querySelectorAll('*') result
// first would still block for the whole subtree before the first yield.
function* visitVideoDiscoveryNodes(root) {
  if (!isQueryableRoot(root) || isMediaObservationExcludedNode(root)) return;
  const documentRef = root.ownerDocument || root;
  const walker = documentRef.createTreeWalker(root, 1, {
    acceptNode: (node) => isMediaObservationExcludedNode(node) ? 2 : 1,
  });
  let node = root;
  do {
    yield node;
    const shadowRoot = readMediaShadowRoot(node);
    if (shadowRoot && !isMediaObservationExcludedNode(shadowRoot)) {
      yield* visitVideoDiscoveryNodes(shadowRoot);
    }
    node = walker.nextNode();
  } while (node);
}

function getObservationAncestor(node) {
  if (!node) return null;
  return node.parentNode || node.host || null;
}

function collectDiscoveryCursorAncestors(node, root) {
  const ancestors = new Map();
  let cursor = node;
  while (cursor) {
    const parent = getObservationAncestor(cursor);
    ancestors.set(cursor, parent);
    if (cursor === root) break;
    cursor = parent;
  }
  return ancestors;
}

export function normalizeVideoMutationRoots(nodes = []) {
  const candidates = Array.from(new Set(Array.from(nodes || []).filter((node) => (
    node?.isConnected === true
    && isQueryableRoot(node)
    && !isMediaObservationExcludedNode(node)
  ))));
  if (candidates.length <= 1) return candidates;

  const candidateSet = new Set(candidates);
  return candidates.filter((node) => {
    let ancestor = getObservationAncestor(node);
    while (ancestor) {
      if (candidateSet.has(ancestor)) return false;
      ancestor = getObservationAncestor(ancestor);
    }
    return true;
  });
}

export class VideoElementObserver {
  constructor({ documentRef = globalThis.document } = {}) {
    this._document = documentRef;
    this._subscribers = new Map();
    this._mediaMutationSubscribers = new Map();
    this._liveVideos = new Set();
    this._liveAudio = new Set();
    this._liveFrames = new Set();
    this._observerUnsub = null;
    this._shadowObservers = new Map();
    this._debugState = createVideoObserverDebugState();
    this._debugOperation = null;
    this._debugEnabled = false;
    this._discoveryJobs = [];
    this._discoveryToken = null;
    this._discoveryTask = null;
    this._discoveryError = null;
    this._activeDiscoveryJob = null;
    this._recoveryBindings = [];
    this._recoveryCandidates = new Set();
    this._recoveryTimer = null;
    this._boundRecoveryEvent = (event) => this._queueEventRecovery(event);
    this._boundLifecycleRecovery = () => {
      if (this._hasObservationConsumers()) this.registerMediaRoot(this._document, { reason: 'document_lifecycle' });
    };
    this._boundOnMutations = (payload) => this._handleMutationPayload(payload, {
      source: 'observer',
    });
  }

  _isDebugEnabled() {
    return isFrictionDebugEnabled();
  }

  _refreshDebugMode() {
    this._debugEnabled = this._isDebugEnabled();
    return this._debugEnabled;
  }

  _runDebugOperation(source, scannedRoots, work) {
    if (!this._refreshDebugMode()) return work();
    if (this._debugOperation) return work();

    const operation = {
      source,
      inventoryVisits: 0,
      scannedRoots: Math.max(0, Number(scannedRoots) || 0),
      shadowRoots: 0,
      videosFound: 0,
      uniqueVideos: 0,
      addedVideos: 0,
      removedVideos: 0,
      deliveryAttempts: 0,
      deliveries: 0,
      removalDeliveries: 0,
      deliverySkips: 0,
      retriesScheduled: 0,
      retryAttempts: 0,
      retryExhausted: 0,
      startedAt: performance.now(),
    };
    this._debugOperation = operation;
    try {
      return work();
    } finally {
      this._debugOperation = null;
      const durationMs = performance.now() - operation.startedAt;
      const summary = {
        source,
        inventoryVisits: operation.inventoryVisits,
        scannedRoots: operation.scannedRoots,
        shadowRoots: operation.shadowRoots,
        videosFound: operation.videosFound,
        uniqueVideos: operation.uniqueVideos,
        addedVideos: operation.addedVideos,
        removedVideos: operation.removedVideos,
        deliveryAttempts: operation.deliveryAttempts,
        deliveries: operation.deliveries,
        removalDeliveries: operation.removalDeliveries,
        deliverySkips: operation.deliverySkips,
        retriesScheduled: operation.retriesScheduled,
        retryAttempts: operation.retryAttempts,
        retryExhausted: operation.retryExhausted,
        durationMs: Number(durationMs.toFixed(2)),
      };
      const state = this._debugState;
      state.operations += 1;
      if (source === 'initial') state.initialScans += 1;
      if (source === 'reconcile') state.reconcileScans += 1;
      if (source === 'observer') state.observerBatches += 1;
      if (source === 'shadow_observer') state.shadowObserverBatches += 1;
      [
        'inventoryVisits',
        'scannedRoots',
        'shadowRoots',
        'videosFound',
        'uniqueVideos',
        'addedVideos',
        'removedVideos',
        'deliveryAttempts',
        'deliveries',
        'removalDeliveries',
        'deliverySkips',
        'retriesScheduled',
        'retryAttempts',
        'retryExhausted',
      ].forEach((key) => {
        state[key] += summary[key];
      });
      state.totalMs += durationMs;
      state.maxMs = Math.max(state.maxMs, durationMs);
      state.recentOperations.push(summary);
      if (state.recentOperations.length > MAX_RECENT_VIDEO_OPERATIONS) {
        state.recentOperations.splice(
          0,
          state.recentOperations.length - MAX_RECENT_VIDEO_OPERATIONS,
        );
      }
    }
  }

  _recordDebugMetric(key, count = 1) {
    const target = this._debugOperation;
    if (!target && !this._debugEnabled) return;
    const resolvedTarget = target || this._debugState;
    if (!Object.prototype.hasOwnProperty.call(resolvedTarget, key)) return;
    resolvedTarget[key] += Number(count) || 0;
  }

  _recordVideoCollection(videos, shadowRoots = []) {
    if (!this._debugOperation && !this._debugEnabled) return;
    const list = Array.from(videos || []);
    this._recordDebugMetric('videosFound', list.length);
    this._recordDebugMetric('uniqueVideos', new Set(list).size);
    this._recordDebugMetric('shadowRoots', new Set(shadowRoots || []).size);
  }

  getDebugSnapshot() {
    this._refreshDebugMode();
    const state = this._debugState;
    let pendingRetryCount = 0;
    this._subscribers.forEach((subscriber) => {
      pendingRetryCount += subscriber.pendingRetries.size;
    });
    return {
      loaded: true,
      available: true,
      debugEnabled: this._debugEnabled,
      active: this._hasObservationConsumers(),
      observerAttached: !!this._observerUnsub,
      subscriberCount: this._subscribers.size,
      mediaMutationSubscriberCount: this._mediaMutationSubscribers.size,
      liveVideoCount: this._liveVideos.size,
      liveAudioCount: this._liveAudio.size,
      liveFrameCount: this._liveFrames.size,
      shadowObserverCount: this._shadowObservers.size,
      discoveryPending: this._discoveryToken !== null,
      discoveryError: this._discoveryError,
      shadowRootAccess: getMediaShadowRootAccessCapabilities(),
      lateShadowDiscovery: 'explicit_registration_or_document_event',
      pendingRetryCount,
      stats: {
        ...state,
        totalMs: Number(state.totalMs.toFixed(2)),
        maxMs: Number(state.maxMs.toFixed(2)),
        recentOperations: state.recentOperations.map((entry) => ({ ...entry })),
      },
    };
  }

  resetDebugSnapshot() {
    this._debugState = createVideoObserverDebugState();
    this._refreshDebugMode();
  }

  subscribe({
    onVideo,
    onVideoRemoved = null,
    includeExisting = false,
    debugLabel = 'VideoElementObserver.subscriber',
    observe = true,
    onObservationState = null,
  } = {}) {
    if (typeof onVideo !== 'function') return () => {};

    const token = Symbol('videoElementObserverSubscriber');
    const subscriber = {
      onVideo,
      onVideoRemoved: typeof onVideoRemoved === 'function' ? onVideoRemoved : null,
      debugLabel: String(debugLabel || 'VideoElementObserver.subscriber'),
      delivered: new WeakSet(),
      retryExhausted: new WeakSet(),
      active: true,
      includeExisting,
      observe,
      onObservationState,
      pendingRetries: new Map(),
      initialDeliveryFailure: null,
    };
    this._subscribers.set(token, subscriber);

    try {
      if (observe) this._ensureObservation();
      if (subscriber.initialDeliveryFailure) throw subscriber.initialDeliveryFailure;
      if (includeExisting) {
        this._runDebugOperation('include_existing_delivery', 0, () => {
          this._liveVideos.forEach((video) => {
            this._deliverAddedToSubscriber(video, subscriber, { throwOnFailure: true });
          });
        });
      }
      this._notifyObservationState();
    } catch (error) {
      this._subscribers.delete(token);
      this._deactivateSubscriber(subscriber);
      if (!this._hasObservationConsumers()) {
        try {
          this._teardownObservation();
        } catch (cleanupError) {
          if (error && typeof error === 'object') error.cleanupError = cleanupError;
        }
      }
      throw error;
    }

    return () => this._unsubscribe(token);
  }

  subscribeMediaMutations({
    onMutation,
    debugLabel = 'VideoElementObserver.mediaMutationSubscriber',
    synchronousInitialInventory = false,
  } = {}) {
    if (typeof onMutation !== 'function') {
      throw new Error('VIDEO_ELEMENT_MEDIA_MUTATION_SUBSCRIBER_REQUIRED');
    }
    const token = Symbol('videoElementObserverMediaMutationSubscriber');
    this._mediaMutationSubscribers.set(token, {
      onMutation,
      debugLabel: String(
        debugLabel || 'VideoElementObserver.mediaMutationSubscriber',
      ),
    });
    try {
      this._ensureObservation({ synchronousInitialInventory });
    } catch (error) {
      this._mediaMutationSubscribers.delete(token);
      if (!this._hasObservationConsumers()) {
        try {
          this._teardownObservation();
        } catch (cleanupError) {
          if (error && typeof error === 'object') error.cleanupError = cleanupError;
        }
      }
      throw error;
    }
    return () => this._unsubscribeMediaMutations(token);
  }

  getLiveVideos() {
    this._pruneDisconnectedVideos('live_snapshot');
    return Array.from(this._liveVideos);
  }

  getMediaSnapshot() {
    this._pruneDisconnectedVideos('media_snapshot');
    this._pruneAuxiliaryInventory();
    return {
      videos: Array.from(this._liveVideos),
      audio: Array.from(this._liveAudio),
      frames: Array.from(this._liveFrames),
      roots: this.getObservedRoots(),
    };
  }

  _pruneAuxiliaryInventory() {
    for (const inventory of [this._liveAudio, this._liveFrames]) {
      for (const node of inventory) {
        if (!this._ownsConnectedNode(node) || isMediaObservationExcludedNode(node)) inventory.delete(node);
      }
    }
  }

  getObservedRoots() {
    this._pruneDetachedShadowRoots();
    return this._observerUnsub
      ? [this._document, ...Array.from(this._shadowObservers.keys()).filter((root) => this._ownsConnectedNode(root))]
      : [];
  }

  _ownsConnectedNode(node) {
    return node?.isConnected === true && (node === this._document || node.ownerDocument === this._document);
  }

  registerMediaRoot(root, { reason = 'explicit_media_root' } = {}) {
    if (!this._hasObservationConsumers()) throw new Error('VIDEO_ELEMENT_ROOT_REQUIRES_CONSUMER');
    if (!isQueryableRoot(root) || (root !== this._document && root.ownerDocument !== this._document)) {
      throw new Error('VIDEO_ELEMENT_ROOT_DOCUMENT_MISMATCH');
    }
    if (!root.isConnected || isMediaObservationExcludedNode(root)) return this._discoveryTask;
    return this._queueDiscovery([root], {
      source: reason, initial: false, addedNodes: [root], removedNodes: [], attributeTargets: [],
    });
  }

  reconcileExistingVideos() {
    if (!this._hasObservationConsumers()) throw new Error('VIDEO_ELEMENT_RECONCILE_REQUIRES_CONSUMER');
    try {
      return this._reconcileMediaInventory();
    } catch (error) {
      this._discoveryError = getVideoObservationErrorMessage(error);
      this._notifyObservationState();
      throw error;
    }
  }

  _reconcileMediaInventory({ source = 'reconcile', initial = false } = {}) {
    // Immediate intervention admission needs one fresh synchronous snapshot.
    // It supersedes an unfinished discovery instead of replaying a second full
    // scan later. Preserve removal/control facts already queued for consumers.
    const pending = [...this._discoveryJobs];
    if (this._activeDiscoveryJob) pending.push(this._activeDiscoveryJob);
    this._discoveryToken = null;
    this._discoveryTask = null;
    this._discoveryJobs = [];
    this._activeDiscoveryJob = null;
    return this._runDebugOperation(source, 1, () => {
      const videos = [];
      const audio = [];
      const frames = [];
      const observedRoots = [this._document];
      for (const node of visitVideoDiscoveryNodes(this._document)) {
        if (!this._ownsConnectedNode(node)) continue;
        this._recordDebugMetric('inventoryVisits');
        if (node.host) {
          this._observeShadowRoot(node);
          // A superseded cooperative job may have enrolled the observer before
          // delivering this root to existing consumers. Project every live root.
          observedRoots.push(node);
        }
        if (isObservedVideoElement(node)) videos.push(node);
        if (isInventoryElement(node, 'audio')) audio.push(node);
        if (isInventoryElement(node, 'iframe')) frames.push(node);
      }
      this._recordVideoCollection(videos, observedRoots.filter(root => root.host));
      const initialDeliveryFailures = [];
      const addedCount = this._registerAddedVideos(videos, { initial, initialDeliveryFailures });
      audio.forEach(node => this._liveAudio.add(node));
      frames.forEach(node => this._liveFrames.add(node));
      this._pruneDisconnectedVideos('reconcile_existing');
      this._pruneAuxiliaryInventory();
      this._deliverMediaMutationPayload({
        source, addedNodes: [this._document],
        removedNodes: [...new Set(pending.flatMap(job => job.removedNodes))],
        attributeTargets: [...new Set(pending.flatMap(job => job.attributeTargets))],
        observedVideos: videos, observedAudio: audio, observedFrames: frames, observedRoots,
      });
      if (initialDeliveryFailures.length > 0) {
        throw new AggregateError(initialDeliveryFailures, 'VIDEO_ELEMENT_INITIAL_DELIVERY_FAILED');
      }
      this._discoveryError = null;
      this._notifyObservationState();
      return {
        ...this.getMediaSnapshot(),
        scanCount: videos.length,
        addedCount,
      };
    });
  }

  _ensureObservation({ synchronousInitialInventory = false } = {}) {
    if (this._observerUnsub) {
      if (synchronousInitialInventory) this.reconcileExistingVideos();
      return;
    }
    if (!this._document) throw new Error('VIDEO_ELEMENT_DOCUMENT_REQUIRED');
    if (this._document === globalThis.document) {
      this._observerUnsub = observerHub.subscribe(this._boundOnMutations, {
        ...MEDIA_OBSERVATION_OPTIONS, debugLabel: OBSERVER_DEBUG_LABEL,
      });
    } else {
      const observer = new MutationObserver((mutations) => this._handleNativeMutations(mutations, 'frame_document_observer'));
      observer.observe(this._document, MEDIA_OBSERVATION_OPTIONS);
      this._observerUnsub = () => observer.disconnect();
    }

    try {
      this._installRecoveryListeners();
      if (synchronousInitialInventory) this._reconcileMediaInventory({ source: 'initial', initial: true });
      else {
        this._queueDiscovery([this._document], {
          source: 'initial', initial: true, addedNodes: [], removedNodes: [], attributeTargets: [],
        });
      }
    } catch (error) {
      const unsubscribe = this._observerUnsub;
      this._observerUnsub = null;
      try {
        unsubscribe?.();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      this._disconnectShadowObservers();
      this._removeRecoveryListeners();
      this._liveVideos.clear();
      this._liveAudio.clear();
      this._liveFrames.clear();
      throw error;
    }
  }

  _unsubscribe(token) {
    const subscriber = this._subscribers.get(token);
    if (!subscriber) return;
    this._subscribers.delete(token);
    if (this._hasObservationConsumers()) {
      this._deactivateSubscriber(subscriber);
      return;
    }

    try {
      this._teardownObservation();
      this._deactivateSubscriber(subscriber);
    } catch (error) {
      this._subscribers.set(token, subscriber);
      if (this._document) {
        try {
          collectOpenShadowRootsFromNode(this._document).forEach((root) => this._observeShadowRoot(root));
        } catch (restoreError) {
          if (error && typeof error === 'object') error.restoreError = restoreError;
        }
      }
      throw error;
    }
  }

  _unsubscribeMediaMutations(token) {
    const subscriber = this._mediaMutationSubscribers.get(token);
    if (!subscriber) return;
    this._mediaMutationSubscribers.delete(token);
    if (this._hasObservationConsumers()) return;
    try {
      this._teardownObservation();
    } catch (error) {
      this._mediaMutationSubscribers.set(token, subscriber);
      if (this._document) {
        try {
          collectOpenShadowRootsFromNode(this._document).forEach(
            (root) => this._observeShadowRoot(root),
          );
        } catch (restoreError) {
          if (error && typeof error === 'object') error.restoreError = restoreError;
        }
      }
      throw error;
    }
  }

  _hasObservationConsumers() {
    return this._mediaMutationSubscribers.size > 0
      || Array.from(this._subscribers.values()).some((subscriber) => subscriber.observe);
  }

  _notifyObservationState() {
    const status = !this._hasObservationConsumers() ? 'inactive'
      : this._discoveryError ? 'failed'
        : this._discoveryToken ? 'observing' : 'observed';
    this._subscribers.forEach((subscriber) => {
      try {
        subscriber.onObservationState?.(status, { observationError: status === 'failed' ? this._discoveryError : null });
      } catch (error) {
        reportVideoObservationFailure('observation_state_subscriber', error, {
          debugLabel: subscriber.debugLabel,
        });
      }
    });
  }

  _installRecoveryListeners() {
    const bind = (target, name, listener, windowLifetime = false) => {
      if (!target?.addEventListener) return;
      // A frame's WindowProxy can navigate outside same-origin DOM reach.
      // Abort the exact native binding without reading its new Window's methods.
      const controller = windowLifetime ? new target.AbortController() : null;
      target.addEventListener(name, listener, controller
        ? { capture: true, signal: controller.signal } : true);
      this._recoveryBindings.push({ target, name, listener, controller });
    };
    RECOVERY_EVENTS.forEach((name) => bind(this._document, name, this._boundRecoveryEvent));
    bind(this._document, 'readystatechange', this._boundLifecycleRecovery);
    bind(this._document.defaultView, 'pageshow', this._boundLifecycleRecovery, true);
  }

  _removeRecoveryListeners() {
    if (this._recoveryTimer !== null) globalThis.clearTimeout(this._recoveryTimer);
    this._recoveryTimer = null;
    this._recoveryCandidates.clear();
    const failures = [];
    this._recoveryBindings = this._recoveryBindings.filter((binding) => {
      try {
        if (binding.controller) binding.controller.abort();
        else binding.target.removeEventListener(binding.name, binding.listener, true);
        return false;
      } catch (error) {
        failures.push(error);
        return true;
      }
    });
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'VIDEO_ELEMENT_RECOVERY_CLEANUP_FAILED');
  }

  _queueEventRecovery(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    for (const node of path.slice(0, RECOVERY_EVENT_PATH_LIMIT)) {
      if (this._recoveryCandidates.size >= RECOVERY_EVENT_PATH_LIMIT) break;
      if (node?.nodeType === 1 && !isMediaObservationExcludedNode(node)) this._recoveryCandidates.add(node);
    }
    if (this._recoveryTimer !== null || this._recoveryCandidates.size === 0) return;
    // One post-dispatch turn also sees roots created by the site's gesture handler.
    this._recoveryTimer = globalThis.setTimeout(() => {
      this._recoveryTimer = null;
      const candidates = Array.from(this._recoveryCandidates);
      this._recoveryCandidates.clear();
      if (!this._hasObservationConsumers()) return;
      try {
        for (const node of candidates) {
          if (!this._ownsConnectedNode(node)) continue;
          if (isObservedVideoElement(node) && !this._liveVideos.has(node)) {
            this.registerMediaRoot(node, { reason: 'media_event_discovery' });
          }
          const root = readMediaShadowRoot(node);
          if (root && !this._shadowObservers.has(root)) {
            this.registerMediaRoot(root, { reason: 'shadow_event_discovery' });
          }
        }
      } catch (error) {
        this._discoveryError = getVideoObservationErrorMessage(error);
        reportVideoObservationFailure('event_discovery', error);
        this._notifyObservationState();
      }
    }, 0);
  }

  _teardownObservation() {
    this._discoveryToken = null;
    this._discoveryJobs = [];
    this._activeDiscoveryJob = null;
    this._disconnectShadowObservers();
    if (this._observerUnsub) {
      const unsubscribe = this._observerUnsub;
      unsubscribe();
      this._observerUnsub = null;
    }
    this._removeRecoveryListeners();
    this._liveVideos.clear();
    this._liveAudio.clear();
    this._liveFrames.clear();
    this._subscribers.forEach((subscriber) => {
      subscriber.delivered = new WeakSet();
      subscriber.pendingRetries.forEach(({ timeoutId }) => globalThis.clearTimeout(timeoutId));
      subscriber.pendingRetries.clear();
      subscriber.retryExhausted = new WeakSet();
    });
    this._notifyObservationState();
  }

  _disconnectShadowObservers() {
    const errors = [];
    this._shadowObservers.forEach((observer, root) => {
      try {
        observer.disconnect();
        this._shadowObservers.delete(root);
      } catch (error) {
        errors.push(error);
        reportVideoObservationFailure('shadow_observer_disconnect', error);
      }
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, 'VIDEO_ELEMENT_SHADOW_OBSERVER_DISCONNECT_FAILED');
    }
  }

  _observeShadowRoot(root) {
    if (
      !root
      || !this._ownsConnectedNode(root)
      || isMediaObservationExcludedNode(root)
      || this._shadowObservers.has(root)
    ) return false;
    if (typeof MutationObserver !== 'function') throw new Error('VIDEO_ELEMENT_MUTATION_OBSERVER_REQUIRED');

    const observer = new MutationObserver((mutations) => this._handleNativeMutations(mutations, 'shadow_observer'));
    observer.observe(root, MEDIA_OBSERVATION_OPTIONS);
    this._shadowObservers.set(root, observer);
    return true;
  }

  _handleNativeMutations(mutations = [], source) {
    const addedNodes = [];
    const removedNodes = [];
    const attributeTargets = [];
    mutations.forEach((mutation) => {
      mutation.addedNodes?.forEach((node) => addedNodes.push(node));
      mutation.removedNodes?.forEach((node) => removedNodes.push(node));
      if (mutation.type === 'attributes') attributeTargets.push(mutation.target);
    });
    return this._handleMutationPayload({ addedNodes, removedNodes, attributeTargets }, { source });
  }

  _handleMutationPayload(
    payload = {},
    options = {},
  ) {
    try {
      return this._processMutationPayload(payload, options);
    } catch (error) {
      this._discoveryError = getVideoObservationErrorMessage(error);
      reportVideoObservationFailure('mutation_discovery', error);
      this._notifyObservationState();
      throw error;
    }
  }

  _processMutationPayload(
    { addedNodes = [], removedNodes = [], attributeTargets = [] } = {},
    { source = 'observer' } = {},
  ) {
    const observableAddedNodes = normalizeVideoMutationRoots(addedNodes)
      .filter((node) => this._ownsConnectedNode(node));
    const observableAttributeTargets = Array.from(new Set(attributeTargets)).filter((node) => (
      this._ownsConnectedNode(node) && !isMediaObservationExcludedNode(node)
    ));
    // Attribute invalidation never rescans a player subtree. It can enroll only
    // an exact target's newly attached root; control consumers resolve ownership.
    observableAttributeTargets.forEach((node) => {
      const root = readMediaShadowRoot(node);
      if (root && !this._shadowObservers.has(root)) observableAddedNodes.push(root);
    });
    const hasObservableRemovedNodes = Array.from(removedNodes || []).some((node) => (
      !isMediaObservationExcludedNode(node)
    ));
    if (hasObservableRemovedNodes) {
      this._pruneDisconnectedVideos('dom_removed');
      this._pruneAuxiliaryInventory();
      this._pruneDetachedShadowRoots();
      this._queueRemovedCursorReplay(removedNodes);
    }
    const discoveryRoots = normalizeVideoMutationRoots(observableAddedNodes);
    return this._queueDiscovery(discoveryRoots, {
      source, initial: false,
      addedNodes: discoveryRoots, removedNodes: [...new Set(removedNodes)],
      attributeTargets: observableAttributeTargets,
    });
  }

  async whenSettled() {
    while (this._discoveryTask) await this._discoveryTask;
    if (this._hasObservationConsumers() && this._discoveryError) throw new Error(this._discoveryError);
  }

  _queueRemovedCursorReplay(removedNodes) {
    const job = this._activeDiscoveryJob;
    if (!job?.cursorRemovalRoots) return;
    const affectedRoots = new Set();
    for (const node of removedNodes) {
      this._recordDebugMetric('removalReplayChecks');
      job.cursorRemovalRoots.get(node)?.forEach((root) => affectedRoots.add(root));
    }
    if (affectedRoots.size === 0) {
      this._recordDebugMetric('removalReplaysAvoided');
      return;
    }
    affectedRoots.forEach((root) => this._queueDiscoveryCursorReplay(job, root));
  }

  _queueDiscoveryCursorReplay(job, root) {
    if (!this._ownsConnectedNode(root) || job.replayRoots.has(root)) {
      this._recordDebugMetric('removalReplaysAvoided');
      return;
    }
    // TreeWalker cannot recover a removed/reparented cursor. Snapshot ancestry
    // before yielding: removed wrappers may have been emptied before delivery,
    // and a shadow cursor can also strand its outer walker's host. Other removals
    // leave traversal intact and must not restart this job or its completed roots.
    job.replayRoots.add(root);
    this._discoveryJobs.push({
      roots: [root], source: 'removal_replay', initial: job.initial,
      addedNodes: [root], removedNodes: [], attributeTargets: [],
    });
    this._recordDebugMetric('removalReplaysQueued');
  }

  _queueDiscovery(roots, details) {
    if (!this._hasObservationConsumers()) return;
    this._discoveryJobs.push({ roots, ...details });
    if (this._discoveryToken) return this._discoveryTask;
    return this._startDiscovery();
  }

  _startDiscovery() {
    const token = Symbol('video-discovery');
    this._discoveryToken = token;
    const task = this._drainDiscovery(token).catch((error) => {
      if (this._discoveryToken === token) {
        this._discoveryError = getVideoObservationErrorMessage(error);
        this._discoveryJobs = [];
      }
      reportVideoObservationFailure('cooperative_discovery', error);
      throw error;
    }).finally(() => {
      if (this._discoveryToken === token) this._discoveryToken = null;
      if (this._discoveryTask === task) this._discoveryTask = null;
      if (!this._discoveryToken && this._hasObservationConsumers() && this._discoveryJobs.length > 0) {
        this._startDiscovery();
      }
      this._notifyObservationState();
    });
    this._discoveryTask = task;
    // The owner reports failures above; callers of whenSettled still receive them.
    void task.catch(() => {});
    this._notifyObservationState();
    return task;
  }

  async _drainDiscovery(token) {
    const isCurrent = () => this._discoveryToken === token && this._hasObservationConsumers();
    const deadline = createMainThreadSliceDeadline();
    let processed = 0;
    this._refreshDebugMode();
    let sliceStartedAt = this._debugEnabled ? performance.now() : 0;
    const finishSlice = () => {
      if (!this._debugEnabled || processed === 0) return;
      const durationMs = performance.now() - sliceStartedAt;
      this._debugState.discoverySlices += 1;
      this._debugState.totalDiscoveryMs += durationMs;
      this._debugState.maxDiscoverySliceMs = Math.max(
        this._debugState.maxDiscoverySliceMs, durationMs,
      );
      recordRuntimeOwnerWork({
        ownerId: 'videoObservation', phase: 'discovery_slice',
        source: 'shared_inventory', startedAt: sliceStartedAt,
        endedAt: sliceStartedAt + durationMs, units: processed,
      });
    };
    try {
      while (isCurrent() && this._discoveryJobs.length > 0) {
        const job = this._discoveryJobs.shift();
        job.replayRoots = new Set();
        job.cursorRemovalRoots = new WeakMap();
        this._activeDiscoveryJob = job;
        const observedVideos = [];
        const observedAudio = [];
        const observedFrames = [];
        const observedRoots = [];
        if (job.initial) observedRoots.push(this._document);
        const initialDeliveryFailures = [];
        for (const root of job.roots) {
          for (const node of visitVideoDiscoveryNodes(root)) {
            if (!isCurrent()) return;
            if (!deadline.hasTime(processed)) {
              const suspendedCursorAncestors = collectDiscoveryCursorAncestors(node, root);
              // A delayed removal may arrive after this root ended and the same
              // job advanced to another root. Keep only weak cursor identities
              // for this job, so the former root still receives exact recovery.
              for (const ancestor of suspendedCursorAncestors.keys()) {
                let roots = job.cursorRemovalRoots.get(ancestor);
                if (!roots) {
                  roots = new Set();
                  job.cursorRemovalRoots.set(ancestor, roots);
                }
                roots.add(root);
              }
              finishSlice();
              processed = 0;
              await yieldMainThreadContinuation();
              if (!isCurrent()) return;
              deadline.reset();
              sliceStartedAt = this._debugEnabled ? performance.now() : 0;
              // ObserverHub delivers on a later frame; a continuation may resume
              // first. A removed or reparented cursor must not strand discovery
              // merely because its mutation payload has not reached us yet.
              for (const [ancestor, parent] of suspendedCursorAncestors) {
                if (ancestor !== root && getObservationAncestor(ancestor) !== parent) {
                  this._queueDiscoveryCursorReplay(job, root);
                  break;
                }
              }
            }
            if (!this._ownsConnectedNode(node)) continue;
            if (node.host && this._observeShadowRoot(node)) observedRoots.push(node);
            this._recordDebugMetric('discoveryVisits');
            this._recordDebugMetric('inventoryVisits');
            processed += 1;
            if (isObservedVideoElement(node)) {
              observedVideos.push(node);
              this._registerAddedVideos([node], { initial: job.initial, initialDeliveryFailures });
            }
            if (isInventoryElement(node, 'audio')) {
              this._liveAudio.add(node);
              observedAudio.push(node);
            }
            if (isInventoryElement(node, 'iframe')) {
              this._liveFrames.add(node);
              observedFrames.push(node);
            }
          }
        }
        if (!isCurrent()) return;
        this._runDebugOperation(job.source, job.roots.length, () => this._recordVideoCollection(observedVideos));
        this._deliverMediaMutationPayload({
          addedNodes: job.addedNodes, removedNodes: job.removedNodes,
          observedVideos: observedVideos.filter((video) => isConnectedVideo(video, this._document)), source: job.source,
          observedAudio, observedFrames, observedRoots, attributeTargets: job.attributeTargets,
        });
        this._activeDiscoveryJob = null;
        if (initialDeliveryFailures.length > 0) {
          throw new AggregateError(initialDeliveryFailures, 'VIDEO_ELEMENT_INITIAL_DELIVERY_FAILED');
        }
        // A partial added-node scan cannot certify an earlier failed inventory.
        if (job.roots.includes(this._document)) this._discoveryError = null;
      }
    } finally {
      finishSlice();
      if (this._discoveryToken === token) this._activeDiscoveryJob = null;
    }
  }

  _deliverMediaMutationPayload(payload) {
    if (this._mediaMutationSubscribers.size === 0) return;
    const frozenPayload = Object.freeze({
      ...payload,
      addedNodes: Object.freeze(payload.addedNodes.filter((node) => this._ownsConnectedNode(node))),
      // Removal facts retain their identity after adoption into another document.
      removedNodes: Object.freeze([...payload.removedNodes]),
      observedVideos: Object.freeze(payload.observedVideos.filter((video) => isConnectedVideo(video, this._document))),
      observedAudio: Object.freeze(payload.observedAudio.filter((node) => this._ownsConnectedNode(node))),
      observedFrames: Object.freeze(payload.observedFrames.filter((node) => this._ownsConnectedNode(node))),
      observedRoots: Object.freeze(payload.observedRoots.filter((root) => this._ownsConnectedNode(root))),
      attributeTargets: Object.freeze(payload.attributeTargets.filter((node) => this._ownsConnectedNode(node))),
    });
    this._mediaMutationSubscribers.forEach((subscriber) => {
      try {
        subscriber.onMutation(frozenPayload);
      } catch (error) {
        reportVideoObservationFailure('media_mutation_subscriber', error, {
          debugLabel: subscriber.debugLabel,
          source: payload.source,
        });
      }
    });
  }

  _registerAddedVideos(videos, { initial = false, initialDeliveryFailures = [] } = {}) {
    let addedCount = 0;
    new Set(videos).forEach((video) => {
      if (!isConnectedVideo(video, this._document)) return;
      if (!this._liveVideos.has(video)) {
        this._liveVideos.add(video);
        addedCount += 1;
      }
      this._subscribers.forEach((subscriber) => {
        if (initial && !subscriber.includeExisting) return;
        if (!initial) {
          this._deliverAddedToSubscriber(video, subscriber);
          return;
        }
        try {
          this._deliverAddedToSubscriber(video, subscriber, { throwOnFailure: true });
        } catch (error) {
          subscriber.initialDeliveryFailure = error;
          initialDeliveryFailures.push(error);
        }
      });
    });
    this._recordDebugMetric('addedVideos', addedCount);
    return addedCount;
  }

  _registerRemovedVideos(videos, reason) {
    let removedCount = 0;
    new Set(videos).forEach((video) => {
      if (!this._liveVideos.has(video) || isConnectedVideo(video, this._document)) return;
      this._liveVideos.delete(video);
      removedCount += 1;
      this._subscribers.forEach((subscriber) => {
        this._deliverRemovedToSubscriber(video, subscriber, reason);
      });
    });
    this._recordDebugMetric('removedVideos', removedCount);
  }

  _pruneDisconnectedVideos(reason) {
    this._registerRemovedVideos(Array.from(this._liveVideos), reason);
  }

  _pruneDetachedShadowRoots() {
    this._shadowObservers.forEach((observer, root) => {
      if (this._ownsConnectedNode(root?.host)) return;
      try {
        observer.disconnect();
        this._shadowObservers.delete(root);
      } catch (error) {
        reportVideoObservationFailure('detached_shadow_observer_disconnect', error);
      }
    });
  }

  _deactivateSubscriber(subscriber) {
    if (!subscriber) return;
    subscriber.active = false;
    subscriber.pendingRetries.forEach(({ timeoutId }) => {
      if (typeof globalThis.clearTimeout === 'function') {
        globalThis.clearTimeout(timeoutId);
      }
    });
    subscriber.pendingRetries.clear();
  }

  _clearSubscriberRetry(video, subscriber) {
    const pending = subscriber?.pendingRetries?.get(video);
    if (!pending) return;
    if (typeof globalThis.clearTimeout === 'function') {
      globalThis.clearTimeout(pending.timeoutId);
    }
    subscriber.pendingRetries.delete(video);
  }

  _scheduleSubscriberDeliveryRetry(video, subscriber, retryAttempt) {
    if (
      !subscriber?.active
      || !isConnectedVideo(video, this._document)
      || subscriber.pendingRetries.has(video)
      || typeof globalThis.setTimeout !== 'function'
    ) return;
    const delayMs = SUBSCRIBER_RETRY_DELAYS_MS[retryAttempt - 1];
    if (!Number.isFinite(delayMs)) {
      subscriber.retryExhausted.add(video);
      this._recordDebugMetric('retryExhausted');
      reportVideoObservationFailure(
        'subscriber_video_added_retry_exhausted',
        new Error('VIDEO_ELEMENT_SUBSCRIBER_RETRY_EXHAUSTED'),
        {
          debugLabel: subscriber.debugLabel,
          retryAttempt: retryAttempt - 1,
        }
      );
      return;
    }
    const timeoutId = globalThis.setTimeout(() => {
      subscriber.pendingRetries.delete(video);
      if (!subscriber.active || !isConnectedVideo(video, this._document)) return;
      this._runDebugOperation('delivery_retry', 0, () => {
        this._deliverAddedToSubscriber(video, subscriber, { retryAttempt });
      });
    }, delayMs);
    subscriber.pendingRetries.set(video, { timeoutId, retryAttempt });
    this._recordDebugMetric('retriesScheduled');
  }

  _deliverAddedToSubscriber(video, subscriber, {
    throwOnFailure = false,
    retryAttempt = 0,
  } = {}) {
    if (
      !subscriber
      || subscriber.delivered.has(video)
      || subscriber.pendingRetries.has(video)
      || subscriber.retryExhausted.has(video)
    ) {
      this._recordDebugMetric('deliverySkips');
      return;
    }
    subscriber.delivered.add(video);
    this._recordDebugMetric('deliveryAttempts');
    if (retryAttempt > 0) this._recordDebugMetric('retryAttempts');
    try {
      subscriber.onVideo(video);
      this._recordDebugMetric('deliveries');
      subscriber.retryExhausted.delete(video);
      this._clearSubscriberRetry(video, subscriber);
    } catch (error) {
      subscriber.delivered.delete(video);
      reportVideoObservationFailure('subscriber_video_added', error, {
        debugLabel: subscriber.debugLabel,
        retryAttempt,
      });
      if (throwOnFailure) throw error;
      this._scheduleSubscriberDeliveryRetry(video, subscriber, retryAttempt + 1);
    }
  }

  _deliverRemovedToSubscriber(video, subscriber, reason) {
    if (!subscriber) return;
    this._clearSubscriberRetry(video, subscriber);
    subscriber.retryExhausted.delete(video);
    if (!subscriber.delivered.has(video)) return;
    subscriber.delivered.delete(video);
    if (!subscriber.onVideoRemoved) return;
    try {
      subscriber.onVideoRemoved(video, { reason });
      this._recordDebugMetric('removalDeliveries');
    } catch (error) {
      reportVideoObservationFailure('subscriber_video_removed', error, {
        debugLabel: subscriber.debugLabel,
        reason,
      });
    }
  }
}

export const videoElementObserver = new VideoElementObserver();

const documentVideoObservers = new WeakMap();

export function getVideoElementObserverForDocument(documentRef) {
  if (documentRef?.nodeType !== 9) throw new Error('VIDEO_ELEMENT_DOCUMENT_REQUIRED');
  if (documentRef === globalThis.document) return videoElementObserver;
  let owner = documentVideoObservers.get(documentRef);
  if (!owner) {
    owner = new VideoElementObserver({ documentRef });
    documentVideoObservers.set(documentRef, owner);
  }
  return owner;
}

export default videoElementObserver;
