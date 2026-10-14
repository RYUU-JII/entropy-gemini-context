import {
  getRootScroller,
  isRootLikeScroller,
  readScrollerPosition,
  readViewportHeight,
  resolveScrollContainer,
} from '../resolve/ActiveScrollContainerResolver.js';
import scrollInputOrchestrator from '../../behavior/scrollInputOrchestrator.js';
import FeedSupplyObserver from './FeedSupplyObserver.js';

let containerSeq = 0;
const containerKeys = new WeakMap();

function describeContainer(el, documentRef) {
  if (isRootLikeScroller(el, documentRef)) return 'root';
  if (!(el instanceof Element)) return 'root';
  let key = containerKeys.get(el);
  if (!key) {
    containerSeq += 1;
    key = `c${containerSeq}`;
    containerKeys.set(el, key);
  }
  return key;
}

function createEmptyFeedSnapshot() {
  return {
    active: false,
    readout: null,
    interaction: null,
  };
}

function createUnavailableFeedSnapshot(reason) {
  return { ...createEmptyFeedSnapshot(), availability: 'unavailable', reason };
}

export class FeedSupplyProbe {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    observer = new FeedSupplyObserver(),
  } = {}) {
    for (const method of ['reset', 'invalidateGeometry', 'observe', 'getReadout']) {
      if (typeof observer?.[method] !== 'function') {
        throw new Error(`FEED_SUPPLY_OBSERVER_METHOD_REQUIRED:${method}`);
      }
    }
    this._window = windowRef;
    this._document = documentRef;
    this._observer = observer;
    this._running = false;
    this._listeners = new Map();
    this._cleanupPending = false;
    this._geometryAvailable = true;
    this._lastScrollTarget = null;
    this._lastSnapshot = createEmptyFeedSnapshot();
    this._boundScroll = (event) => {
      if (!this._running) return;
      this._lastScrollTarget = event?.target instanceof Element ? event.target : this._lastScrollTarget;
    };
    this._boundVisibility = () => {
      if (!this._running || !this._document.hidden) return;
      this._observer.invalidateGeometry();
      this._lastSnapshot = createUnavailableFeedSnapshot('document_hidden');
    };
  }

  start() {
    if (this._running) return;
    if (this._cleanupPending || this._listeners.size > 0) throw new Error('FEED_SUPPLY_CLEANUP_PENDING');
    if (!this._window || !this._document) return;
    this._observer.reset();
    this._running = true;
    try {
      for (const binding of [
        { target: this._window, type: 'scroll', listener: this._boundScroll, options: { capture: true, passive: true } },
        { target: this._window, type: 'wheel', listener: this._boundScroll, options: { capture: true, passive: true } },
        { target: this._document, type: 'visibilitychange', listener: this._boundVisibility, options: true },
      ]) {
        // An acquisition may attach and then throw; retain the attempted owner
        // until removal is confirmed.
        this._listeners.set(binding.type, binding);
        binding.target.addEventListener(binding.type, binding.listener, binding.options);
      }
    } catch (error) {
      try { this.stop(); } catch (cleanupError) { error.cleanupError = cleanupError; }
      throw error;
    }
  }

  stop() {
    if (!this._running && this._listeners.size === 0) return;
    this._running = false;
    this._lastScrollTarget = null;
    this._lastSnapshot = createEmptyFeedSnapshot();
    const errors = [];
    for (const [type, binding] of this._listeners) {
      try {
        binding.target.removeEventListener(type, binding.listener, true);
        this._listeners.delete(type);
      } catch (error) { errors.push(error); }
    }
    this._cleanupPending = errors.length > 0;
    if (errors.length) throw new AggregateError(errors, 'FEED_SUPPLY_STOP_FAILED');
  }

  reset() {
    this._observer.reset();
    this._lastSnapshot = createEmptyFeedSnapshot();
  }

  setGeometryAvailable(available) {
    if (typeof available !== 'boolean') throw new Error('FEED_SUPPLY_GEOMETRY_AVAILABILITY_INVALID');
    if (available === this._geometryAvailable) return;
    // Entry closes before invalidation; release opens only after invalidation
    // succeeds. A failing observer cannot reopen unsupported height deltas.
    if (!available) this._geometryAvailable = false;
    this._lastSnapshot = createUnavailableFeedSnapshot('endpoint_layout');
    // Invalidate at each actual layout edge, including a complete commit and
    // release between polls. Never subtract guessed tail/collapse dimensions.
    this._observer.invalidateGeometry();
    this._geometryAvailable = available;
    this._lastSnapshot = createUnavailableFeedSnapshot(
      available ? 'geometry_reseed_pending' : 'endpoint_layout',
    );
  }

  sample(now = Date.now()) {
    if (!this._running || !this._window || !this._document) {
      return this._lastSnapshot;
    }
    if (this._document.hidden) {
      this._observer.invalidateGeometry();
      this._lastSnapshot = createUnavailableFeedSnapshot('document_hidden');
      return this._lastSnapshot;
    }
    if (!this._geometryAvailable) {
      this._lastSnapshot = createUnavailableFeedSnapshot('endpoint_layout');
      return this._lastSnapshot;
    }
    const container = this._resolveActiveContainer();
    const sample = this._measure(container);
    const interaction = scrollInputOrchestrator?.getInteractionState?.() || null;
    this._observer.observe(sample, interaction || {}, now);
    this._lastSnapshot = {
      active: true,
      readout: this._observer.getReadout(now),
      interaction,
    };
    return this._lastSnapshot;
  }

  getSnapshot() {
    return this._lastSnapshot;
  }

  _resolveActiveContainer() {
    const documentRef = this._document;
    const resolved = resolveScrollContainer({
      sourceElement: this._lastScrollTarget,
      eventTarget: this._lastScrollTarget,
      deltaY: 1,
      documentRef,
    });
    return resolved || getRootScroller(documentRef);
  }

  _measure(container) {
    const documentRef = this._document;
    const viewportHeight = readViewportHeight(this._window, documentRef);
    if (!container || isRootLikeScroller(container, documentRef)) {
      const root = getRootScroller(documentRef);
      return {
        containerKey: 'root',
        scrollHeight: Math.max(0, Number(root?.scrollHeight) || 0),
        scrollTop: readScrollerPosition(root, this._window, documentRef),
        clientHeight: viewportHeight,
        viewportHeight,
      };
    }
    return {
      containerKey: describeContainer(container, documentRef),
      scrollHeight: Math.max(0, Number(container.scrollHeight) || 0),
      scrollTop: Math.max(0, Number(container.scrollTop) || 0),
      clientHeight: Math.max(1, Number(container.clientHeight) || viewportHeight),
      viewportHeight,
    };
  }
}

export default FeedSupplyProbe;
