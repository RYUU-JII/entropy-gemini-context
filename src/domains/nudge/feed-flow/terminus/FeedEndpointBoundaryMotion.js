import { readScrollerPosition } from '../resolve/ActiveScrollContainerResolver.js';
import { writeProgrammaticScroll } from '../../../../lib/dom/programmaticScrollWrites.js';
import {
  validateFeedEndpointBoundaryMotionProfile,
} from './feedEndpointBoundaryMotionProfile.js';

const POSITION_EPSILON_PX = 1;
const REST_TOLERANCE_PX = 1;
const MAX_FRAME_MS = 40;
const MAX_SETTLE_CATCH_UP_MS = 1_000;
const FRAME_WATCHDOG_MS = 64;

function defaultScheduleFrame(callback) {
  const handle = {
    frameId: null,
    watchdogId: null,
    settled: false,
  };
  const run = () => {
    if (handle.settled) return;
    handle.settled = true;
    if (handle.frameId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle.frameId);
      handle.frameId = null;
    }
    if (handle.watchdogId !== null) {
      clearTimeout(handle.watchdogId);
      handle.watchdogId = null;
    }
    callback();
  };
  if (typeof requestAnimationFrame === 'function') {
    handle.frameId = requestAnimationFrame(run);
  }
  handle.watchdogId = setTimeout(run, FRAME_WATCHDOG_MS);
  return handle;
}

function defaultCancelFrame(handle) {
  if (!handle || typeof handle !== 'object') {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
    return;
  }
  handle.settled = true;
  if (handle.frameId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.frameId);
  }
  if (handle.watchdogId !== null) clearTimeout(handle.watchdogId);
  handle.frameId = null;
  handle.watchdogId = null;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function isElasticProfile(profile) {
  return ['elastic_tail', 'terminal_snap'].includes(profile?.mode);
}

function isPagedTerminalProfile(profile) {
  return (
    profile?.capability === 'paged_hold'
    && profile?.surfaceMode === 'paged'
    && profile?.endpointEdge === 'tail_start'
  );
}

export class FeedEndpointBoundaryMotion {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    readNow = () => Date.now(),
    scheduleFrame = defaultScheduleFrame,
    cancelFrame = defaultCancelFrame,
  } = {}) {
    if (
      typeof readNow !== 'function'
      || typeof scheduleFrame !== 'function'
      || typeof cancelFrame !== 'function'
    ) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_RUNTIME_INVALID');
    }
    this._window = windowRef;
    this._document = documentRef;
    this._readNow = readNow;
    this._scheduleFrame = scheduleFrame;
    this._cancelFrame = cancelFrame;
    this._reset();
  }

  engage({
    scroller,
    boundaryPosition,
    inputCapturePosition,
    profile,
    onForwardIntent = null,
    onBoundaryReached = null,
  } = {}) {
    if (this._engaged) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_ALREADY_ENGAGED');
    }
    if (!scroller?.isConnected) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_SCROLLER_INVALID');
    }
    const normalizedBoundary = Number(boundaryPosition);
    if (!Number.isFinite(normalizedBoundary) || normalizedBoundary < 0) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_POSITION_INVALID');
    }
    if (!Number.isFinite(inputCapturePosition) || inputCapturePosition < 0
      || inputCapturePosition > normalizedBoundary) {
      throw new Error('FEED_ENDPOINT_INPUT_CAPTURE_POSITION_INVALID');
    }
    this._profile = validateFeedEndpointBoundaryMotionProfile(profile);
    this._scroller = scroller;
    this._boundaryPosition = normalizedBoundary;
    this._inputCapturePosition = inputCapturePosition;
    this._onForwardIntent = typeof onForwardIntent === 'function'
      ? onForwardIntent
      : null;
    this._onBoundaryReached = typeof onBoundaryReached === 'function'
      ? onBoundaryReached
      : null;
    this._engaged = true;
    this.reconcileExternalPosition(this._readPosition(), this._readNow());
    return true;
  }

  release() {
    if (!this._engaged) return true;
    this._cancelSettleFrame();
    const current = this._readPosition();
    if (current > this._boundaryPosition + POSITION_EPSILON_PX) {
      this._writePosition(this._boundaryPosition);
    }
    this._restorePagedSnapStyle();
    this._reset();
    return true;
  }

  isEngaged() {
    return this._engaged;
  }

  isAtBoundaryPosition() {
    return (
      this._engaged
      && this._readPosition() >= this._boundaryPosition - POSITION_EPSILON_PX
    );
  }

  shouldCaptureForwardInput() {
    if (!this._engaged) return false;
    this.synchronize();
    if (!isPagedTerminalProfile(this._profile)) return true;
    return this._readPosition() >= this._inputCapturePosition - POSITION_EPSILON_PX;
  }

  prepareBackwardInput() {
    if (!this._engaged) return false;
    this.synchronize();
    this._cancelSettleFrame();
    const current = this._readPosition();
    if (current > this._boundaryPosition + POSITION_EPSILON_PX) {
      this._writePosition(this._boundaryPosition);
    }
    this._displacementPx = 0;
    this._velocityPxPerSecond = 0;
    this._restorePagedSnapStyle();
    return true;
  }

  synchronize(ts = this._readNow()) {
    if (!this._engaged) return false;
    const now = Math.max(0, Number(ts) || this._readNow());
    if (this._frameId !== null) {
      if ((now - this._lastFrameAt) < FRAME_WATCHDOG_MS) return false;
      this._cancelSettleFrame();
      this._advanceSettleFrame(now);
      return true;
    }
    if (this._displacementPx > REST_TOLERANCE_PX && isElasticProfile(this._profile)) {
      this._ensureSettleFrame(now);
      return true;
    }
    return false;
  }

  getState() {
    const capturedAt = this._readNow();
    const observedDisplacementPx = this._engaged
      ? Math.max(0, this._readPosition() - this._boundaryPosition)
      : 0;
    return Object.freeze({
      engaged: this._engaged,
      mode: this._profile?.mode || 'inactive',
      boundaryPosition: this._engaged ? this._boundaryPosition : null,
      displacementPx: this._engaged ? this._displacementPx : 0,
      maximumDisplacementPx: this._profile?.maximumDisplacementPx || 0,
      restTolerancePx: REST_TOLERANCE_PX,
      settling: this._frameId !== null,
      diagnostics: this._engaged
        ? Object.freeze({
          observedDisplacementPx,
          velocityPxPerSecond: this._velocityPxPerSecond,
          lastInputAgeMs: Math.max(0, capturedAt - this._lastInputAt),
          lastFrameAgeMs: Math.max(0, capturedAt - this._lastFrameAt),
          lastForwardInputPx: this._lastForwardInputPx,
          forwardInputCount: this._forwardInputCount,
        })
        : null,
    });
  }

  reconcileEndpointEdge({
    endpointEdgePosition,
    restEdgePosition,
  } = {}) {
    if (!this._engaged) return false;
    const endpointEdge = Number(endpointEdgePosition);
    const restEdge = Number(restEdgePosition);
    if (!Number.isFinite(endpointEdge) || !Number.isFinite(restEdge)) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_EDGE_INVALID');
    }
    const current = this._readPosition();
    const nextBoundaryPosition = current + (endpointEdge - restEdge);
    if (!Number.isFinite(nextBoundaryPosition) || nextBoundaryPosition < 0) {
      throw new Error('FEED_ENDPOINT_BOUNDARY_MOTION_REBASE_INVALID');
    }
    if (
      Math.abs(nextBoundaryPosition - this._boundaryPosition)
      <= POSITION_EPSILON_PX
    ) {
      return true;
    }

    const preserveFooterRest = this._boundaryReached
      && current >= this._boundaryPosition - POSITION_EPSILON_PX;
    const preservedDisplacement = this._displacementPx;
    this._inputCapturePosition = Math.max(0,
      this._inputCapturePosition + nextBoundaryPosition - this._boundaryPosition);
    this._boundaryPosition = nextBoundaryPosition;
    // Exposure stays latched, but it is not permission to pull a reader who has
    // gone backward back to the footer when upstream content changes height.
    if (preserveFooterRest) {
      this._writePosition(nextBoundaryPosition + preservedDisplacement);
      if (preservedDisplacement > REST_TOLERANCE_PX && isElasticProfile(this._profile)) {
        this._ensureSettleFrame(this._readNow());
      }
    }
    return true;
  }

  applyForwardIntent(deltaPx, ts = this._readNow(), input) {
    if (!this._engaged) return false;
    const delta = Math.max(0, Number(deltaPx) || 0);
    if (delta <= 0) return false;
    this._lastForwardInputPx = delta;
    this._forwardInputCount += 1;
    const now = Math.max(0, Number(ts) || this._readNow());
    let current = this._readPosition();
    const remainingToBoundary = Math.max(0, this._boundaryPosition - current);
    const passPx = Math.min(delta, remainingToBoundary);
    if (passPx > 0) {
      this._suppressPagedSnapStyle();
      current += passPx;
      this._writePosition(current, 'input_assistance');
    }
    const blockedPx = Math.max(0, delta - passPx);
    if (blockedPx <= 0) {
      this.reconcileExternalPosition(current, now);
      return true;
    }

    this._markBoundaryReached(now);
    this._applyElasticDisplacement(blockedPx, now);
    this._onForwardIntent?.(blockedPx, now, input);
    return true;
  }

  reconcileExternalPosition(rawPosition = this._readPosition(), ts = this._readNow()) {
    if (!this._engaged) return false;
    const now = Math.max(0, Number(ts) || this._readNow());
    let current = Math.max(0, Number(rawPosition) || 0);
    if (current < this._boundaryPosition - POSITION_EPSILON_PX) {
      this._cancelSettleFrame();
      if (current > this._inputCapturePosition + POSITION_EPSILON_PX) {
        this._suppressPagedSnapStyle();
      } else {
        this._restorePagedSnapStyle();
      }
      this._displacementPx = 0;
      this._velocityPxPerSecond = 0;
      return true;
    }
    if (current >= this._boundaryPosition - POSITION_EPSILON_PX) {
      this._markBoundaryReached(now);
    }

    const maximumPosition = this._boundaryPosition
      + this._profile.maximumDisplacementPx;
    if (current > maximumPosition + POSITION_EPSILON_PX) {
      this._suppressPagedSnapStyle();
      current = maximumPosition;
      this._writePosition(current);
    }
    const ownedSettleWrite = (
      this._frameId !== null
      && this._isOwnedWrite(current)
    );
    if (ownedSettleWrite) return true;
    this._displacementPx = clamp(
      current - this._boundaryPosition,
      0,
      this._profile.maximumDisplacementPx,
    );
    if (this._displacementPx > REST_TOLERANCE_PX) {
      this._suppressPagedSnapStyle();
      if (!this._isOwnedWrite(current)) {
        this._lastInputAt = now;
      }
      this._ensureSettleFrame(now);
    }
    return true;
  }

  _applyElasticDisplacement(blockedPx, now) {
    if (!isElasticProfile(this._profile)) {
      if (this._readPosition() > this._boundaryPosition + POSITION_EPSILON_PX) {
        this._writePosition(this._boundaryPosition);
      }
      this._displacementPx = 0;
      return;
    }
    const current = this._readPosition();
    const currentDisplacement = clamp(
      current - this._boundaryPosition,
      0,
      this._profile.maximumDisplacementPx,
    );
    const remainingRatio = clamp(
      1 - (currentDisplacement / this._profile.maximumDisplacementPx),
      0,
      1,
    );
    const coupledPx = blockedPx
      * this._profile.inputCouplingRatio
      * Math.max(0.08, remainingRatio * remainingRatio);
    const nextDisplacement = Math.min(
      this._profile.maximumDisplacementPx,
      currentDisplacement + coupledPx,
    );
    if (nextDisplacement > POSITION_EPSILON_PX) {
      this._suppressPagedSnapStyle();
    }
    this._displacementPx = nextDisplacement;
    this._velocityPxPerSecond = Math.max(
      0,
      this._velocityPxPerSecond + ((nextDisplacement - currentDisplacement) * 8),
    );
    this._lastInputAt = now;
    this._writePosition(this._boundaryPosition + nextDisplacement);
    this._ensureSettleFrame(now);
  }

  _ensureSettleFrame(now) {
    if (this._frameId !== null || !isElasticProfile(this._profile)) return;
    this._lastFrameAt = now;
    this._frameId = this._scheduleFrame(() => this._advanceSettleFrame());
  }

  _advanceSettleFrame(synchronizedNow = null) {
    this._frameId = null;
    if (!this._engaged || !isElasticProfile(this._profile)) return;
    const now = synchronizedNow === null
      ? this._readNow()
      : Math.max(0, Number(synchronizedNow) || this._readNow());
    if ((now - this._lastInputAt) < this._profile.inputHoldMs) {
      this._lastFrameAt = now;
      this._ensureSettleFrame(now);
      return;
    }
    const elapsedMs = clamp(
      now - this._lastFrameAt,
      1,
      MAX_SETTLE_CATCH_UP_MS,
    );
    this._lastFrameAt = now;
    let remainingSeconds = elapsedMs / 1000;
    while (remainingSeconds > 0) {
      const dt = Math.min(remainingSeconds, MAX_FRAME_MS / 1000);
      const acceleration = (
        -(this._profile.springStiffness * this._displacementPx)
        - (this._profile.springDamping * this._velocityPxPerSecond)
      );
      this._velocityPxPerSecond += acceleration * dt;
      this._displacementPx += this._velocityPxPerSecond * dt;
      if (this._displacementPx < 0) {
        this._displacementPx = 0;
        this._velocityPxPerSecond = 0;
        break;
      }
      if (this._displacementPx > this._profile.maximumDisplacementPx) {
        this._displacementPx = this._profile.maximumDisplacementPx;
        this._velocityPxPerSecond = Math.min(0, this._velocityPxPerSecond);
      }
      remainingSeconds -= dt;
    }
    if (this._displacementPx <= REST_TOLERANCE_PX) {
      this._displacementPx = 0;
      this._velocityPxPerSecond = 0;
      this._writePosition(this._boundaryPosition);
      // The readable tail is between native snap points. Keep the same lease
      // until backward navigation or release, rather than snapping the copy away.
      return;
    }
    this._writePosition(this._boundaryPosition + this._displacementPx);
    this._ensureSettleFrame(now);
  }

  _markBoundaryReached(ts) {
    this._suppressPagedSnapStyle();
    if (this._boundaryReached) return;
    this._boundaryReached = true;
    this._onBoundaryReached?.(ts);
  }

  _readPosition() {
    return readScrollerPosition(
      this._scroller,
      this._window,
      this._document,
    );
  }

  _writePosition(position, purpose = 'effect_adjustment') {
    writeProgrammaticScroll({ scroller: this._scroller, windowRef: this._window,
      documentRef: this._document, top: position, purpose });
    this._lastOwnedPosition = position;
  }

  _isOwnedWrite(position) {
    return Math.abs(position - this._lastOwnedPosition) <= POSITION_EPSILON_PX;
  }

  _suppressPagedSnapStyle() {
    if (
      this._pagedSnapStyleOwned
      || !isPagedTerminalProfile(this._profile)
      || !this._scroller?.style
    ) return;
    this._pagedSnapStyleSnapshot = {
      value: this._scroller.style.getPropertyValue('scroll-snap-type'),
      priority: this._scroller.style.getPropertyPriority('scroll-snap-type'),
    };
    this._scroller.style.setProperty('scroll-snap-type', 'none', 'important');
    this._pagedSnapStyleOwned = true;
  }

  _restorePagedSnapStyle() {
    if (!this._pagedSnapStyleOwned || !this._scroller?.style) return;
    const snapshot = this._pagedSnapStyleSnapshot || { value: '', priority: '' };
    if (snapshot.value) {
      this._scroller.style.setProperty(
        'scroll-snap-type',
        snapshot.value,
        snapshot.priority,
      );
    } else {
      this._scroller.style.removeProperty('scroll-snap-type');
    }
    this._pagedSnapStyleOwned = false;
    this._pagedSnapStyleSnapshot = null;
  }

  _cancelSettleFrame() {
    if (this._frameId !== null && this._frameId !== undefined) {
      this._cancelFrame(this._frameId);
    }
    this._frameId = null;
  }

  _reset() {
    this._cancelSettleFrame?.();
    this._restorePagedSnapStyle?.();
    this._engaged = false;
    this._scroller = null;
    this._boundaryPosition = 0;
    this._inputCapturePosition = 0;
    this._profile = null;
    this._onForwardIntent = null;
    this._onBoundaryReached = null;
    this._boundaryReached = false;
    this._displacementPx = 0;
    this._velocityPxPerSecond = 0;
    this._lastInputAt = 0;
    this._lastFrameAt = 0;
    this._lastForwardInputPx = 0;
    this._forwardInputCount = 0;
    this._lastOwnedPosition = 0;
    this._pagedSnapStyleOwned = false;
    this._pagedSnapStyleSnapshot = null;
    this._frameId = null;
  }
}

export default FeedEndpointBoundaryMotion;
