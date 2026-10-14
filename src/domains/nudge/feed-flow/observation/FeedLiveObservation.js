import { resolveFeedObservationRegion } from './resolveFeedObservationRegion.js';
import { readFeedRegionSnapshot } from './readFeedRegionSnapshot.js';
import { FeedItemObservationWindow } from './FeedItemObservationWindow.js';
import { FeedObservationJournal } from './FeedObservationJournal.js';
import { projectFeedObservationSurface } from './feedObservationSurface.js';
import { isRootLikeScroller, readScrollerPosition } from '../resolve/ActiveScrollContainerResolver.js';
import { readProgrammaticScrollWriteState } from '../../../../lib/dom/programmaticScrollWrites.js';

export const FEED_OBSERVATION_MAX_SAMPLE_GAP_MS = 750;

// Single document-local owner. This measures sensor coverage and displacement,
// not consumption, attention, behavioral readiness, or intervention pressure.
export class FeedLiveObservation {
  constructor({
    documentRef = globalThis.document, windowRef = globalThis.window,
    now = () => performance.now(), resolveRegion = resolveFeedObservationRegion,
  } = {}) {
    this._document = documentRef;
    this._window = windowRef;
    this._now = now;
    this._resolveRegion = resolveRegion;
    this._active = false;
    this._epoch = 0;
    this._itemObservation = new FeedItemObservationWindow();
    this._eventJournal = new FeedObservationJournal();
    this._reset();
  }

  _reset() {
    this._itemObservation.reset();
    this._eventJournal.reset();
    this._surface = null;
    this._binding = null;
    this._identityBinding = null;
    this._position = null;
    this._writeRevision = null;
    this._sampleViewport = null;
    this._previousVisible = null;
    this._lastScrollSequence = 0;
    this._sequence = 0;
    this._at = null;
    this._validUntil = null;
    this._status = 'stopped';
    this._reason = 'not_started';
    this._lastGeometry = null;
    this._totals = {
      sampledCoverageMs: 0, unavailableVisibleMs: 0, unsupportedVisibleMs: 0, hiddenMs: 0,
      unknownForwardScreenfuls: 0, unknownBackwardScreenfuls: 0,
      acceptedScrollEvents: 0, nestedOrOutsideScrollEvents: 0, unmeasuredScrollEvents: 0,
      unobservedDisplacements: 0, visibleSetChanges: 0, identityDiscontinuities: 0,
      programmaticAffectedScrollEvents: 0, programmaticContinuityGaps: 0,
      sampleCount: 0, sampleTotalMs: 0, sampleMaxMs: 0,
    };
  }

  start(surface) {
    if (this._active) throw new Error('FEED_LIVE_OBSERVATION_ALREADY_STARTED');
    const projected = projectFeedObservationSurface(surface);
    this._reset();
    this._active = true;
    this._epoch += 1;
    this._at = this._now();
    this._itemObservation.reset({ epoch: this._epoch, at: this._at });
    this._surface = projected;
    this.invalidate('initial_sample_required');
  }

  setSurface(surface) {
    if (!this._active) return;
    const projected = projectFeedObservationSurface(surface);
    const previous = this._surface;
    this._surface = projected;
    if (Object.keys(projected).some((key) => previous[key] !== projected[key])) {
      this._beginEpoch('surface_changed', this._now());
    }
  }

  _beginEpoch(reason, at) {
    this._epoch += 1;
    this.invalidate(reason, at);
    this._identityBinding = null;
    this._itemObservation.reset({ epoch: this._epoch, at });
  }

  _advance(at) {
    if (!Number.isFinite(at) || at < 0 || (this._at !== null && at < this._at)) {
      throw new Error('FEED_LIVE_OBSERVATION_CLOCK_INVALID');
    }
    this._itemObservation.advance(at);
    const elapsed = this._at === null ? 0 : at - this._at;
    if (this._status === 'hidden') this._totals.hiddenMs += elapsed;
    else if (this._status === 'unsupported') this._totals.unsupportedVisibleMs += elapsed;
    else if (this._status === 'sampled') {
      const valid = Math.max(0, Math.min(at, this._validUntil) - this._at);
      this._totals.sampledCoverageMs += valid;
      this._totals.unavailableVisibleMs += elapsed - valid;
    } else if (this._active) this._totals.unavailableVisibleMs += elapsed;
    this._at = at;
    this._sequence += 1;
  }

  _breakItemContinuity(at) {
    this._itemObservation.invalidate(at);
    this._eventJournal.append({ kind: 'observation_gap', at, epoch: this._epoch });
  }

  invalidate(reason, at = this._now()) {
    if (!this._active) return;
    this._advance(at);
    this._breakItemContinuity(at);
    this._binding = null;
    this._position = null;
    this._writeRevision = null;
    this._sampleViewport = null;
    this._previousVisible = null;
    this._validUntil = null;
    this._lastGeometry = null;
    this._status = this._document.visibilityState === 'hidden' ? 'hidden' : 'unavailable';
    this._reason = reason;
  }

  _heldBindingFailure() {
    const binding = this._binding;
    if (!binding.region.isConnected || !binding.scroller.isConnected
      || binding.items.some((item) => !item.isConnected || !binding.region.contains(item))) {
      return 'binding_disconnected';
    }
    const height = isRootLikeScroller(binding.scroller, this._document)
      ? this._window.innerHeight : binding.scroller.clientHeight;
    if (height !== binding.scrollerHeight || this._window.innerWidth !== this._sampleViewport.width
      || this._window.innerHeight !== this._sampleViewport.height) return 'geometry_changed';
    return null;
  }

  sample() {
    if (!this._active) return this.getSnapshot();
    const startedAt = performance.now();
    try {
      this._sample();
    } finally {
      const elapsed = performance.now() - startedAt;
      this._totals.sampleCount += 1;
      this._totals.sampleTotalMs += elapsed;
      this._totals.sampleMaxMs = Math.max(this._totals.sampleMaxMs, elapsed);
    }
    return this.getSnapshot();
  }

  _sample() {
    if (!this._active) return;
    const at = this._now();
    const expired = this._validUntil !== null && at > this._validUntil;
    this._advance(at);
    if (this._document.visibilityState !== 'visible') {
      this.invalidate('document_hidden', at);
      return;
    }
    if (expired) {
      this._breakItemContinuity(at);
      this._position = null; this._previousVisible = null; this._binding = null;
      this._writeRevision = null; this._sampleViewport = null;
    }
    if (this._binding && (!this._binding.region.isConnected || !this._binding.scroller.isConnected
      || this._binding.items.some((item) => !item.isConnected || !this._binding.region.contains(item)))) {
      this._breakItemContinuity(at);
      this._binding = null;
      this._position = null;
      this._writeRevision = null;
      this._sampleViewport = null;
      this._previousVisible = null;
    }
    const binding = this._resolveRegion({
      surface: this._surface, documentRef: this._document, windowRef: this._window,
    });
    if (binding.status !== 'resolved') {
      this._breakItemContinuity(at);
      this._binding = null;
      this._position = null;
      this._writeRevision = null;
      this._sampleViewport = null;
      this._previousVisible = null;
      this._status = binding.status;
      this._reason = binding.reason;
      this._validUntil = null;
      this._lastGeometry = null;
      return;
    }
    if (binding.window?.basis !== 'viewport_probe_neighborhood' || binding.window.completeRegion !== false) {
      throw new Error('FEED_OBSERVATION_WINDOW_REQUIRED');
    }
    // Keep the last physical owner through temporary observation gaps. A fresh
    // sample can then distinguish recovery from an actual region/scroller swap.
    if (this._identityBinding && (binding.region !== this._identityBinding.region
      || binding.scroller !== this._identityBinding.scroller)) {
      this._beginEpoch('observation_owner_changed', at);
      this._totals.identityDiscontinuities += 1;
    }
    this._identityBinding = { region: binding.region, scroller: binding.scroller };
    const writeState = readProgrammaticScrollWriteState(binding.scroller, this._document);
    if (writeState.inProgress) {
      if (this._binding?.scroller === binding.scroller) this._totals.programmaticContinuityGaps += 1;
      this.invalidate('programmatic_scroll_in_progress', at);
      return;
    }
    if (this._binding?.scroller === binding.scroller && this._writeRevision !== writeState.revision) {
      // The write's exact time and any overlapping user displacement are not
      // observed here. Close the old hold at detection and seed a new sample.
      this._totals.programmaticContinuityGaps += 1;
      this.invalidate('programmatic_scroll_changed', at);
    }
    if (this._binding && (binding.layout !== this._binding.layout || binding.scrollerHeight !== this._binding.scrollerHeight
      || this._window.innerWidth !== this._sampleViewport.width
      || this._window.innerHeight !== this._sampleViewport.height)) {
      this._breakItemContinuity(at);
      this._position = null;
      this._previousVisible = null;
      this._totals.identityDiscontinuities += 1;
    }
    const geometry = readFeedRegionSnapshot({ ...binding, at });
    if (!geometry.items.some((item) => item.geometryStatus === 'measured')) {
      this.invalidate('geometry_unavailable', at);
      return;
    }
    const position = readScrollerPosition(binding.scroller, this._window, this._document);
    if (this._position !== null && this._position !== position) {
      this._totals.unobservedDisplacements += 1;
      this._breakItemContinuity(at);
    }
    // Polling displacement is a diagnostic gap, not a synthetic scroll event.
    this._position = position;
    this._writeRevision = writeState.revision;
    this._sampleViewport = { width: this._window.innerWidth, height: this._window.innerHeight };
    const visible = geometry.visibleItems.map((item) => ({ node: item.element, key: item.contentKey }));
    if (this._previousVisible) {
      const changed = visible.length !== this._previousVisible.length || visible.some((item, i) => {
        const previous = this._previousVisible[i];
        return !previous || (item.key && previous.key ? item.key !== previous.key : item.node !== previous.node);
      });
      if (changed) this._totals.visibleSetChanges += 1;
      if (visible.some((item) => this._previousVisible.some((previous) => (
        previous.node === item.node && previous.key !== item.key
      )))) this._totals.identityDiscontinuities += 1;
    }
    this._previousVisible = visible;
    this._binding = binding;
    this._lastGeometry = {
      layout: binding.layout, boundarySource: binding.boundarySource, layoutSource: binding.layoutSource,
      window: { ...binding.window },
      itemCount: geometry.items.length, visibleItemCount: visible.length,
      identifiedVisibleItemCount: visible.filter((item) => item.key !== '').length,
      visibleFractions: geometry.visibleItems.map((item) => ({ item: item.itemFraction, region: item.regionFraction })),
    };
    this._status = 'sampled';
    this._reason = 'bounded_geometry_sample';
    this._validUntil = at + FEED_OBSERVATION_MAX_SAMPLE_GAP_MS;
    this._eventJournal.append(this._itemObservation.sample({
      at, epoch: this._epoch, layout: binding.layout, items: geometry.items,
    }, { validUntil: this._validUntil }));
  }

  recordScroll({ sequence, scroller, position, source }) {
    if (!this._active) return;
    if (!Number.isSafeInteger(sequence) || sequence <= this._lastScrollSequence
      || !Number.isFinite(position) || position < 0 || source !== 'unknown') {
      throw new Error('FEED_LIVE_SCROLL_OBSERVATION_INVALID');
    }
    this._lastScrollSequence = sequence;
    const at = this._now();
    this._advance(at);
    if (this._document.visibilityState !== 'visible') {
      this.invalidate('document_hidden', at);
      this._totals.unmeasuredScrollEvents += 1;
      return;
    }
    if (this._status !== 'sampled' || at >= this._validUntil || !this._binding) {
      this._breakItemContinuity(at);
      this._totals.unmeasuredScrollEvents += 1;
      this._position = null;
      return;
    }
    const bindingFailure = this._heldBindingFailure();
    if (bindingFailure !== null) {
      this.invalidate(bindingFailure, at);
      this._totals.unmeasuredScrollEvents += 1;
      return;
    }
    if (scroller !== this._binding.scroller) {
      this._totals.nestedOrOutsideScrollEvents += 1;
      return;
    }
    const writeState = readProgrammaticScrollWriteState(scroller, this._document);
    if (writeState.inProgress || writeState.revision !== this._writeRevision) {
      this._totals.programmaticAffectedScrollEvents += 1;
      this._totals.programmaticContinuityGaps += 1;
      this._totals.unmeasuredScrollEvents += 1;
      this.invalidate('programmatic_scroll_changed', at);
      return;
    }
    if (this._position === null) { this._position = position; return; }
    const delta = position - this._position;
    this._position = position;
    if (delta === 0) return;
    const unit = Math.abs(delta) / this._binding.scrollerHeight;
    this._totals[delta > 0 ? 'unknownForwardScreenfuls' : 'unknownBackwardScreenfuls'] += unit;
    this._totals.acceptedScrollEvents += 1;
    this._itemObservation.endHold(at);
    this._eventJournal.append({ kind: 'scroll_displacement', at, epoch: this._epoch,
      source: 'unknown', direction: delta > 0 ? 'forward' : 'backward', screenfuls: unit });
  }

  stop() {
    if (!this._active) return;
    this.invalidate('runtime_stopped');
    this._itemObservation.release(this._at);
    this._identityBinding = null;
    this._active = false;
    this._status = 'stopped';
  }

  getSnapshot() {
    const now = this._now();
    const status = this._status === 'sampled' && now >= this._validUntil ? 'stale' : this._status;
    return {
      version: 1, active: this._active, epoch: this._epoch, sequence: this._sequence, at: this._at,
      status, reason: status === 'stale' ? 'sample_expired' : this._reason, validUntil: this._validUntil,
      coverageBasis: 'bounded_geometry_sample_hold',
      maxSampleHoldMs: FEED_OBSERVATION_MAX_SAMPLE_GAP_MS,
      geometry: this._lastGeometry === null ? null : structuredClone(this._lastGeometry),
      itemObservation: this._itemObservation.getSnapshot({ now }),
      eventJournal: this._eventJournal.getSnapshot(),
      ...this._totals,
      capabilities: { geometry: status === 'sampled' ? 'sampled' : 'unavailable',
        scrollDisplacement: status === 'sampled' ? 'sampled' : 'unavailable',
        consumptionTransitions: 'unsupported', userAttribution: 'unavailable', reading: 'unavailable' },
    };
  }
}
