import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { writeProgrammaticScroll } from '../../../lib/dom/programmaticScrollWrites.js';
import {
  FROSTED_STONE_MATERIAL,
  advanceFrostedStoneMotion,
  applyFrostedStoneImpulse,
  createFrostedStoneMotionState,
  createFrostedStoneStepOutput,
  dissipateFrostedStoneMotion,
  estimateFrostedStoneStoppingMotion,
  getFrostedStoneKineticEnergy,
  getFrostedStoneRegime,
  getFrostedStoneSpeed,
  hasFrostedStoneMotion,
  resetFrostedStoneMotionState,
  resolveScrollDynamicsMaterial,
  zeroFrostedStoneMomentumAxis,
} from './frostedStoneDynamics.js';
import {
  SCROLL_GESTURE_POLICY,
  allowsScrollBoundaryHandoff,
  createScrollGestureOwnershipState,
  isScrollGestureAxisLeaseActive,
  resolveScrollGestureInput,
} from './scrollGestureOwnership.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
  recordRuntimeScrollFrame,
} from '@runtime-contention-ledger';
import {
  PAGED_SCROLL_INTENT_POLICY,
  createPagedScrollIntentActuator,
  resolvePagedScrollIntentSurface,
} from './pagedScrollIntentActuator.js';

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
const DEFAULT_LINE_DELTA_PX = 16;
const PAGE_DELTA_RATIO = 0.85;
const MIDDLE_MOUSE_BUTTON = 1;
const CUSTOM_SCROLL_CANDIDATE_STREAK = 3;
const SCROLL_WRITE_SUPPRESSION_MS = 220;
const MOTION_DELTA_EPSILON_PX = 0.02;
const MANAGED_SCROLL_UNDERREAD_MIN_DELTA_PX = 1.5;
const MANAGED_SCROLL_UNDERREAD_RATIO = 0.16;
const MANAGED_SCROLL_SEVERE_UNDERREAD_RATIO = 0.08;
const MANAGED_SCROLL_UNDERREAD_STREAK = 2;
const MANAGED_SCROLL_BYPASS_TTL_MS = 1800;
const MIDDLE_AUTOSCROLL_DEADZONE_PX = 12;
const MIDDLE_AUTOSCROLL_FULL_SPEED_DISTANCE_PX = 220;
const MIDDLE_AUTOSCROLL_SPEED_CURVE = 1.35;
const MIDDLE_AUTOSCROLL_MIN_MAX_VELOCITY_PX_PER_S = 720;
const MIDDLE_AUTOSCROLL_MAX_MAX_VELOCITY_PX_PER_S = 1900;
const MIDDLE_AUTOSCROLL_MAX_VIEWPORTS_PER_SECOND = 2.2;
const MIDDLE_AUTOSCROLL_AUXCLICK_SUPPRESS_MS = 900;
const MIDDLE_AUTOSCROLL_EXCLUDED_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[draggable="true"]',
  'video',
  'audio',
  'canvas',
  'iframe',
  'embed',
  'object',
  '[role="application"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[data-friction-click-delay-bypass="1"]',
  '[data-friction-click-delay-sensitive="1"]',
  '[data-entropy-click-delay-sensitive="1"]',
].join(', ');
const reportedSelectorFailureSignatures = new Set();

function normalizeDelay(value) {
  if (Number.isFinite(value)) return Math.max(0, value);
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function monotonicNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getScrollFrictionErrorMessage(error, fallback = 'SCROLL_FRICTION_FAILURE') {
  return String(error?.message || error || fallback);
}

function describeScrollTarget(target) {
  if (isWindowLikeTarget(target)) return 'window';
  if (target instanceof Element) return target.tagName?.toLowerCase() || 'element';
  return 'unknown';
}

function reportScrollFrictionFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getScrollFrictionErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('scrollFriction', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[ScrollInputOrchestrator] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createScrollLifecycleError(message, errors) {
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

function reportScrollSelectorFailureOnce(operation, selector, error) {
  const signature = `${operation}:${selector}`;
  if (reportedSelectorFailureSignatures.has(signature)) return null;
  reportedSelectorFailureSignatures.add(signature);
  return reportScrollFrictionFailure(operation, error, {
    selector,
  });
}

function getRootScroller() {
  return document.scrollingElement || document.documentElement || document.body;
}

function isRootLikeElement(el) {
  if (!el) return false;
  const root = getRootScroller();
  return el === root || el === document.documentElement || el === document.body;
}

function isScrollableAxis(el, axis, delta) {
  if (!el || !(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  const isRootLike = isRootLikeElement(el);
  if (!isRootLike && !SCROLLABLE_OVERFLOW.has(overflow)) return false;
  if (isRootLike && (overflow === 'hidden' || overflow === 'clip')) return false;

  if (axis === 'y') {
    if (el.scrollHeight <= el.clientHeight) return false;
    if (delta < 0 && el.scrollTop <= 0) return false;
    if (delta > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false;
    return true;
  }

  if (el.scrollWidth <= el.clientWidth) return false;
  if (delta < 0 && el.scrollLeft <= 0) return false;
  if (delta > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) return false;
  return true;
}

function canScrollAxis(el, axis) {
  if (!el || !(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  const isRootLike = isRootLikeElement(el);
  if (!isRootLike && !SCROLLABLE_OVERFLOW.has(overflow)) return false;
  if (isRootLike && (overflow === 'hidden' || overflow === 'clip')) return false;
  if (axis === 'y') return el.scrollHeight > el.clientHeight;
  return el.scrollWidth > el.clientWidth;
}

function resolveStartElement(event) {
  const path = event?.composedPath?.();
  if (Array.isArray(path)) {
    for (const node of path) {
      if (node instanceof Element) return node;
    }
  }
  return event?.target instanceof Element ? event.target : document.activeElement;
}

function resolveLineDeltaPx(startEl) {
  if (startEl instanceof Element) {
    try {
      const lineHeight = parseFloat(getComputedStyle(startEl).lineHeight);
      if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
    } catch (_) { }
  }
  return DEFAULT_LINE_DELTA_PX;
}

function resolvePageDeltaPx(axis) {
  const fallback = axis === 'x' ? DEFAULT_LINE_DELTA_PX * 40 : DEFAULT_LINE_DELTA_PX * 30;
  const size = axis === 'x'
    ? (window.innerWidth || document.documentElement?.clientWidth || fallback)
    : (window.innerHeight || document.documentElement?.clientHeight || fallback);
  return Math.max(DEFAULT_LINE_DELTA_PX, size * PAGE_DELTA_RATIO);
}

function normalizeWheelDelta(event, startEl) {
  const rawDeltaX = Number.isFinite(event?.deltaX) ? event.deltaX : 0;
  const rawDeltaY = Number.isFinite(event?.deltaY) ? event.deltaY : 0;
  const deltaMode = Number.isFinite(event?.deltaMode) ? event.deltaMode : 0;

  if (deltaMode === WHEEL_DELTA_LINE) {
    const linePx = resolveLineDeltaPx(startEl);
    return {
      deltaX: rawDeltaX * linePx,
      deltaY: rawDeltaY * linePx,
      rawDeltaX,
      rawDeltaY,
      deltaMode,
    };
  }

  if (deltaMode === WHEEL_DELTA_PAGE) {
    return {
      deltaX: rawDeltaX * resolvePageDeltaPx('x'),
      deltaY: rawDeltaY * resolvePageDeltaPx('y'),
      rawDeltaX,
      rawDeltaY,
      deltaMode,
    };
  }

  return {
    deltaX: rawDeltaX,
    deltaY: rawDeltaY,
    rawDeltaX,
    rawDeltaY,
    deltaMode,
  };
}

function consumeWheelEvent(event) {
  if (typeof event.preventDefault === 'function' && event.cancelable !== false) {
    event.preventDefault();
  }
  if (typeof event.stopPropagation === 'function') event.stopPropagation();
}

function consumeCancelableEvent(event) {
  if (typeof event?.preventDefault === 'function' && event.cancelable !== false) {
    event.preventDefault();
  }
  if (typeof event?.stopPropagation === 'function') event.stopPropagation();
}

function safeMatchesSelector(el, selector, operation = 'selector_match_failed') {
  if (!(el instanceof Element) || !selector) return false;
  try {
    return el.matches(selector);
  } catch (error) {
    reportScrollSelectorFailureOnce(operation, selector, error);
    return null;
  }
}

function safeClosest(el, selector, operation = 'selector_closest_failed') {
  if (!(el instanceof Element) || !selector) return null;
  try {
    return el.closest(selector);
  } catch (error) {
    reportScrollSelectorFailureOnce(operation, selector, error);
    return undefined;
  }
}

function getComposedParentElement(element) {
  if (!(element instanceof Element)) return null;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode?.();
  return root?.host instanceof Element ? root.host : null;
}

function allowsScrollChainFromTarget(target, axis) {
  if (!(target instanceof Element) || isRootLikeElement(target)) return false;
  const style = getComputedStyle(target);
  const axisBehavior = axis === 'y'
    ? style.overscrollBehaviorY
    : style.overscrollBehaviorX;
  const behavior = axisBehavior || style.overscrollBehavior || '';
  return allowsScrollBoundaryHandoff(behavior);
}

function findScrollableTarget(startEl, axis, delta) {
  let node = startEl instanceof Element ? startEl : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (isScrollableAxis(node, axis, delta)) return node;
    if (canScrollAxis(node, axis) && !allowsScrollChainFromTarget(node, axis)) return null;
    node = getComposedParentElement(node);
  }

  const root = getRootScroller();
  if (root && isScrollableAxis(root, axis, delta)) return root;
  return null;
}

function findOwnedScrollSurface(startEl, axis) {
  let node = startEl instanceof Element ? startEl : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (canScrollAxis(node, axis)) return node;
    node = getComposedParentElement(node);
  }

  const root = getRootScroller();
  return root && canScrollAxis(root, axis) ? root : null;
}

function findScrollableContainer(startEl) {
  let node = startEl instanceof Element ? startEl : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (canScrollAxis(node, 'x') || canScrollAxis(node, 'y')) return node;
    node = getComposedParentElement(node);
  }

  const root = getRootScroller();
  if (root && (canScrollAxis(root, 'x') || canScrollAxis(root, 'y'))) return root;
  return null;
}

function isWindowLikeTarget(target) {
  if (!target) return true;
  const root = getRootScroller();
  return (
    target === window ||
    target === document ||
    target === document.documentElement ||
    target === document.body ||
    target === root
  );
}

function isTargetConnected(target) {
  if (isWindowLikeTarget(target)) return true;
  return !!target?.isConnected;
}

function resolveForwardBoundaryTarget(event, startEl, deltaY, boundaryTarget) {
  if (!boundaryTarget) return null;
  const composedElements = Array.isArray(event?.composedPath?.())
    ? event.composedPath().filter((node) => node instanceof Element)
    : [];
  const boundaryPathIndex = composedElements.indexOf(boundaryTarget);
  if (!isWindowLikeTarget(boundaryTarget) && boundaryPathIndex >= 0) {
    const nestedScrollable = composedElements
      .slice(0, boundaryPathIndex)
      .find((node) => isScrollableAxis(node, 'y', deltaY));
    return nestedScrollable || boundaryTarget;
  }
  if (isWindowLikeTarget(boundaryTarget) && composedElements.length > 0) {
    const nestedScrollable = composedElements.find(
      (node) => !isWindowLikeTarget(node) && isScrollableAxis(node, 'y', deltaY),
    );
    if (nestedScrollable) return nestedScrollable;
    return getRootScroller();
  }
  const nativeTarget = findScrollableTarget(startEl, 'y', deltaY);
  if (isWindowLikeTarget(boundaryTarget)) {
    if (nativeTarget && !isWindowLikeTarget(nativeTarget)) return null;
    return getRootScroller();
  }
  if (
    startEl === boundaryTarget
    || boundaryTarget?.contains?.(startEl) === true
  ) {
    if (
      nativeTarget
      && nativeTarget !== boundaryTarget
      && boundaryTarget.contains(nativeTarget)
    ) {
      return null;
    }
    return boundaryTarget;
  }
  return nativeTarget || getRootScroller();
}

function applyScrollDelta(target, deltaX, deltaY) {
  if (deltaX === 0 && deltaY === 0) return;
  writeProgrammaticScroll({ scroller: target, windowRef: window, documentRef: document,
    left: deltaX, top: deltaY, relative: true, purpose: 'input_assistance' });
}

function scheduleAnimationFrame(callback) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return setTimeout(() => callback(Date.now()), 16);
}

function cancelScheduledAnimationFrame(id) {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

function resolveViewportSpan(target, axis) {
  const fallback = axis === 'x'
    ? (window.innerWidth || document.documentElement?.clientWidth || DEFAULT_LINE_DELTA_PX * 40)
    : (window.innerHeight || document.documentElement?.clientHeight || DEFAULT_LINE_DELTA_PX * 30);
  if (isWindowLikeTarget(target)) return Math.max(DEFAULT_LINE_DELTA_PX, fallback);
  const size = axis === 'x' ? target?.clientWidth : target?.clientHeight;
  return Math.max(DEFAULT_LINE_DELTA_PX, Number(size) || fallback);
}

function hasModifiedMiddleClick(event) {
  return !!(event?.altKey || event?.ctrlKey || event?.metaKey || event?.shiftKey);
}

function isPlainMiddleMouseDown(event) {
  return event?.button === MIDDLE_MOUSE_BUTTON && !hasModifiedMiddleClick(event);
}

function isMiddleAutoScrollExcludedSurface(event, startEl) {
  const path = event?.composedPath?.();
  if (Array.isArray(path)) {
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const matchesExcludedSurface = safeMatchesSelector(
        node,
        MIDDLE_AUTOSCROLL_EXCLUDED_SELECTOR,
        'middle_autoscroll_excluded_selector_match_failed',
      );
      if (matchesExcludedSurface === null) return true;
      if (matchesExcludedSurface) {
        return true;
      }
    }
  }
  const closestExcludedSurface = safeClosest(
    startEl,
    MIDDLE_AUTOSCROLL_EXCLUDED_SELECTOR,
    'middle_autoscroll_excluded_selector_closest_failed',
  );
  return closestExcludedSurface === undefined ? true : !!closestExcludedSurface;
}

function resolveMiddleAutoScrollDelta(offsetPx, dtMs, target, axis) {
  const absoluteOffset = Math.abs(offsetPx);
  if (absoluteOffset <= MIDDLE_AUTOSCROLL_DEADZONE_PX || dtMs <= 0) return 0;

  const span = resolveViewportSpan(target, axis);
  const maxVelocity = clamp(
    span * MIDDLE_AUTOSCROLL_MAX_VIEWPORTS_PER_SECOND,
    MIDDLE_AUTOSCROLL_MIN_MAX_VELOCITY_PX_PER_S,
    MIDDLE_AUTOSCROLL_MAX_MAX_VELOCITY_PX_PER_S,
  );
  const ratio = clamp(
    (absoluteOffset - MIDDLE_AUTOSCROLL_DEADZONE_PX)
      / (MIDDLE_AUTOSCROLL_FULL_SPEED_DISTANCE_PX - MIDDLE_AUTOSCROLL_DEADZONE_PX),
    0,
    1,
  );
  const curvedRatio = Math.pow(ratio, MIDDLE_AUTOSCROLL_SPEED_CURVE);
  return Math.sign(offsetPx) * maxVelocity * curvedRatio * (dtMs / 1000);
}

export class ScrollInputOrchestrator {
  constructor() {
    this._observers = new Set();
    this._controllers = new Map();
    this._lastScrollPos = new Map();
    this._suppressedUntil = new Map();
    this._managedScrollBypassUntil = new Map();
    this._managedScrollUnderreadStreak = new Map();
    this._managedScrollVerification = new WeakMap();
    this._wheelGesture = createScrollGestureOwnershipState();
    this._pagedScrollIntent = createPagedScrollIntentActuator();
    this._actuationLocks = new Set();
    this._resistance = null;
    this._forwardBoundary = null;
    this._delayEnabled = false;
    this._delayMs = 0;
    this._motionMaterial = FROSTED_STONE_MATERIAL;
    this._noNativeTargetStreak = 0;
    this._middleAutoScroll = null;
    this._suppressMiddleAuxClickUntil = 0;
    this._wheelListening = false;
    this._scrollListening = false;
    this._contextListening = false;
    this._boundOnWheel = (event) => this._onWheel(event);
    this._boundOnScroll = (event) => this._onScroll(event);
    this._boundOnScrollContext = (event) => this._seedScrollContextFromEvent(event);
    this._boundOnMiddleAutoScrollMouseDown = (event) => this._onMiddleAutoScrollMouseDown(event);
    this._boundOnMiddleAutoScrollMouseMove = (event) => this._onMiddleAutoScrollMouseMove(event);
    this._boundOnMiddleAutoScrollMouseUp = (event) => this._onMiddleAutoScrollMouseUp(event);
    this._boundOnMiddleAutoScrollKeyDown = (event) => this._onMiddleAutoScrollKeyDown(event);
    this._boundOnMiddleAutoScrollBlur = () => this._stopMiddleAutoScroll();
    this._boundOnMiddleAutoScrollAuxClick = (event) => this._onMiddleAutoScrollAuxClick(event);
    this._boundOnWindowBlur = () => {
      this._resetWheelGesture();
      this._pagedScrollIntent.clear();
    };
    this._boundOnVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this._resetWheelGesture();
        this._pagedScrollIntent.clear();
      }
    };
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this._observers.add(callback);
    try {
      this._syncListening();
    } catch (error) {
      this._observers.delete(callback);
      throw error;
    }
    return () => {
      const removed = this._observers.delete(callback);
      try {
        this._syncListening();
      } catch (error) {
        if (removed) this._observers.add(callback);
        throw error;
      }
    };
  }

  setDelayConfig({ enabled, delayMs, level, material } = {}) {
    const previousDelayEnabled = this._delayEnabled;
    const previousDelayMs = this._delayMs;
    const previousMaterial = this._motionMaterial;
    this._delayEnabled = !!enabled;
    this._delayMs = normalizeDelay(delayMs);
    this._motionMaterial = resolveScrollDynamicsMaterial(material || level || 1);

    try {
      if (this._delayEnabled) {
        this._seedRootScrollPosition();
      } else {
        this._stopMiddleAutoScroll();
        this._clearControllers();
        this._lastScrollPos.clear();
        this._suppressedUntil.clear();
        this._managedScrollBypassUntil.clear();
        this._managedScrollUnderreadStreak.clear();
        this._managedScrollVerification = new WeakMap();
        this._resetWheelGesture();
        this._pagedScrollIntent.clear();
        this._noNativeTargetStreak = 0;
      }

      this._syncListening();
    } catch (error) {
      this._delayEnabled = previousDelayEnabled;
      this._delayMs = previousDelayMs;
      this._motionMaterial = previousMaterial;
      try {
        this._syncListening();
      } catch (rollbackError) {
        if (error && typeof error === 'object') error.rollbackError = rollbackError;
      }
      throw error;
    }

    if (this._delayEnabled) {
      recordProtectionFeatureEvent('scrollFriction', 'delay_enabled', {
        delayMs: this._delayMs,
        mode: this._motionMaterial?.id || 'inertia',
        materialStage: this._motionMaterial?.stage || 'light',
      });
    } else {
      recordProtectionFeatureEvent('scrollFriction', 'delay_disabled');
    }
  }

  getWheelScrollDedupMs() {
    if (!this._delayEnabled) return 0;
    if (this._resolvePagedScrollIntentSurface()) {
      return PAGED_SCROLL_INTENT_POLICY.holdMs + PAGED_SCROLL_INTENT_POLICY.commitLockMs;
    }
    return (this._motionMaterial || FROSTED_STONE_MATERIAL).maxSettleMs;
  }

  setActuationLock(lockId, active = true) {
    const key = typeof lockId === 'string' && lockId ? lockId : 'anonymous';
    if (active) this._actuationLocks.add(key);
    else this._actuationLocks.delete(key);
    if (active) this._pagedScrollIntent.clear();
  }

  _isActuationLocked() {
    return this._actuationLocks.size > 0;
  }

  // Forward-input bridge for the feed terminus. The endpoint lease owns one
  // concrete scroller and may delegate bounded tail motion to its single motion
  // owner. The legacy exact-boundary branch remains for non-motion callers.
  engageForwardBoundary({
    scroller,
    position,
    shouldCaptureForwardInput = null,
    onForwardInput = null,
    onForwardIntent = null,
    onBackwardInput = null,
  } = {}) {
    if (!scroller || !isTargetConnected(scroller)) {
      throw new Error('SCROLL_FORWARD_BOUNDARY_TARGET_INVALID');
    }
    const normalizedPosition = Number(position);
    if (!Number.isFinite(normalizedPosition) || normalizedPosition < 0) {
      throw new Error('SCROLL_FORWARD_BOUNDARY_POSITION_INVALID');
    }
    this._stopMiddleAutoScroll();
    this._pagedScrollIntent.clear();
    const previousBoundary = this._forwardBoundary;
    this._forwardBoundary = {
      target: scroller,
      key: this._resolveTargetKey(scroller),
      position: normalizedPosition,
      shouldCaptureForwardInput: typeof shouldCaptureForwardInput === 'function'
        ? shouldCaptureForwardInput
        : null,
      onForwardInput: typeof onForwardInput === 'function' ? onForwardInput : null,
      onForwardIntent: typeof onForwardIntent === 'function' ? onForwardIntent : null,
      onBackwardInput: typeof onBackwardInput === 'function' ? onBackwardInput : null,
    };
    this._clearControllers();
    try {
      this._syncListening();
    } catch (error) {
      this._forwardBoundary = previousBoundary;
      throw error;
    }
  }

  releaseForwardBoundary() {
    const previousBoundary = this._forwardBoundary;
    this._forwardBoundary = null;
    try {
      this._syncListening();
    } catch (error) {
      this._forwardBoundary = previousBoundary;
      throw error;
    }
  }

  _isForwardBoundaryActive() {
    return !!this._forwardBoundary;
  }

  _applyForwardBoundary(event, startEl, deltaY) {
    if (deltaY === 0 || !this._forwardBoundary) return false;
    const target = resolveForwardBoundaryTarget(
      event,
      startEl,
      deltaY,
      this._forwardBoundary.target,
    );
    if (!target || this._resolveTargetKey(target) !== this._forwardBoundary.key) return false;

    if (deltaY < 0) {
      if (!this._forwardBoundary.onBackwardInput) return false;
      try {
        if (this._forwardBoundary.onBackwardInput(deltaY, Date.now()) !== true) {
          reportScrollFrictionFailure(
            'forward_boundary_backward_prepare',
            new Error('SCROLL_FORWARD_BOUNDARY_BACKWARD_PREPARE_REJECTED'),
            {
              target: describeScrollTarget(target),
              deltaY,
            },
          );
        }
      } catch (error) {
        reportScrollFrictionFailure('forward_boundary_backward_prepare', error, {
          target: describeScrollTarget(target),
          deltaY,
        });
      }
      return true;
    }

    if (this._forwardBoundary.shouldCaptureForwardInput) {
      try {
        if (this._forwardBoundary.shouldCaptureForwardInput() !== true) return false;
      } catch (error) {
        consumeWheelEvent(event);
        reportScrollFrictionFailure('forward_boundary_capture_gate', error, {
          target: describeScrollTarget(target),
          deltaY,
        });
        return true;
      }
    }

    consumeWheelEvent(event);
    if (this._forwardBoundary.onForwardInput) {
      try {
        this._forwardBoundary.onForwardInput(deltaY, Date.now());
      } catch (error) {
        reportScrollFrictionFailure('forward_boundary_motion_callback', error, {
          target: describeScrollTarget(target),
          deltaY,
        });
      }
      return true;
    }
    const current = this._readScrollPosition(target).y;
    const remainingPx = Math.max(0, this._forwardBoundary.position - current);
    const passPx = Math.min(deltaY, remainingPx);
    const blockedPx = Math.max(0, deltaY - passPx);
    if (passPx > 0) {
      try {
        applyScrollDelta(target, 0, passPx);
      } catch (error) {
        reportScrollFrictionFailure('forward_boundary_scroll_apply', error, {
          target: describeScrollTarget(target),
          passPx,
          blockedPx,
        });
        return true;
      }
    }
    if (blockedPx > 0 && this._forwardBoundary.onForwardIntent) {
      try {
        this._forwardBoundary.onForwardIntent(blockedPx, Date.now());
      } catch (error) {
        reportScrollFrictionFailure('forward_boundary_callback', error, {
          target: describeScrollTarget(target),
          blockedPx,
        });
      }
    }
    return true;
  }

  // Viscous forward resistance for the terminus brake. Unlike an actuation lock
  // (which swallows every wheel event and starves a virtualized feed), this lets
  // a small fraction of forward scroll through — the feed still moves a hair, the
  // virtualizer keeps getting scroll events — while reporting the *resisted*
  // magnitude so a deliberate sustained push (pull-past = continue) can be read
  // from the same input stream. Backward (escape) scroll passes untouched.
  engageScrollResistance({ factor = 0.85, onResisted = null } = {}) {
    this._pagedScrollIntent.clear();
    const previousResistance = this._resistance;
    this._resistance = {
      factor: clamp(factor, 0, 0.98),
      onResisted: typeof onResisted === 'function' ? onResisted : null,
    };
    try {
      this._syncListening();
    } catch (error) {
      this._resistance = previousResistance;
      throw error;
    }
  }

  releaseScrollResistance() {
    const previousResistance = this._resistance;
    this._resistance = null;
    try {
      this._syncListening();
    } catch (error) {
      this._resistance = previousResistance;
      throw error;
    }
  }

  _isResistanceActive() {
    return !!this._resistance;
  }

  _applyResistance(event, startEl, deltaY) {
    // Backward / no vertical intent → let native scroll handle it (free escape).
    if (deltaY <= 0) return false;
    const target = findScrollableTarget(startEl, 'y', deltaY) || getRootScroller();
    if (!target) return false;
    consumeWheelEvent(event);
    const factor = this._resistance.factor;
    const passPx = deltaY * (1 - factor);
    const resistedPx = deltaY - passPx;
    if (passPx !== 0) {
      try {
        applyScrollDelta(target, 0, passPx);
      } catch (error) {
        reportScrollFrictionFailure('resistance_scroll_apply', error, {
          target: describeScrollTarget(target),
          passPx,
          resistedPx,
        });
        return true;
      }
    }
    if (this._resistance.onResisted) {
      try {
        this._resistance.onResisted(resistedPx, Date.now());
      } catch (err) {
        reportScrollFrictionFailure('resistance_callback', err, {
          resistedPx,
        });
      }
    }
    return true;
  }

  // Read-only snapshot for diagnostics overlays. Lets observers distinguish a
  // "clean" scroll reading from one shaped by physical motion or an actuation lock.
  getInteractionState() {
    let pendingPx = 0;
    let kineticEnergy = 0;
    let speedPxPerS = 0;
    let physicsRegime = 'rest';
    const now = Date.now();
    for (const controller of this._controllers.values()) {
      const pending = this._estimatePendingPx(controller);
      if (pending > pendingPx) pendingPx = pending;
      if (this._hasKineticEnergy(controller)) {
        const controllerEnergy = getFrostedStoneKineticEnergy(controller.motion);
        const controllerSpeed = getFrostedStoneSpeed(controller.motion);
        if (controllerEnergy > kineticEnergy) {
          kineticEnergy = controllerEnergy;
          physicsRegime = getFrostedStoneRegime(controller.motion);
        }
        if (controllerSpeed > speedPxPerS) speedPxPerS = controllerSpeed;
      }
    }
    const pagedSurface = this._resolvePagedScrollIntentSurface();
    const pagedIntent = this._pagedScrollIntent.getSnapshot();
    pendingPx = Math.max(pendingPx, pagedIntent.pendingPx);
    return {
      delayEnabled: this._delayEnabled,
      delayMs: this._delayMs,
      mode: this._isForwardBoundaryActive()
        ? 'forward_boundary'
        : (this._delayEnabled
          ? (pagedSurface ? PAGED_SCROLL_INTENT_POLICY.stage : 'inertia')
          : 'off'),
      motionMaterial: this._delayEnabled
        ? (pagedSurface ? PAGED_SCROLL_INTENT_POLICY.id : (this._motionMaterial || FROSTED_STONE_MATERIAL).id)
        : null,
      motionStage: this._delayEnabled
        ? (pagedSurface ? PAGED_SCROLL_INTENT_POLICY.stage : (this._motionMaterial || FROSTED_STONE_MATERIAL).stage)
        : 'off',
      physicsRegime,
      kineticEnergy: Math.round(kineticEnergy),
      speedPxPerS: Math.round(speedPxPerS),
      gestureLeaseActive: Number.isFinite(this._wheelGesture.lastInputAt)
        && (now - this._wheelGesture.lastInputAt) <= SCROLL_GESTURE_POLICY.leaseMs,
      gestureLockedAxis: this._wheelGesture.lockedAxis,
      activeControllerCount: this._controllers.size,
      pagedIntentActive: pagedIntent.activeSessionCount > 0,
      pagedIntentLocked: pagedIntent.locked,
      pagedSemanticSurfaceId: pagedSurface?.semanticSurfaceId || null,
      actuationLocked: this._isActuationLocked(),
      forwardBoundaryActive: this._isForwardBoundaryActive(),
      forwardBoundaryPosition: this._forwardBoundary?.position ?? null,
      resistanceActive: this._isResistanceActive(),
      resistanceFactor: this._resistance ? this._resistance.factor : 0,
      middleAutoScrollActive: !!this._middleAutoScroll,
      settling: pendingPx > MOTION_DELTA_EPSILON_PX,
      pendingPx: Math.round(pendingPx),
    };
  }

  _resolvePagedScrollIntentSurface() {
    if (typeof window === 'undefined') return null;
    return resolvePagedScrollIntentSurface({
      hostname: window.location?.hostname || '',
      pathname: window.location?.pathname || '',
    });
  }

  _readPagedScrollMetrics(target) {
    const metricsOwner = isWindowLikeTarget(target) ? getRootScroller() : target;
    return {
      currentPosition: this._readScrollPosition(target).y,
      viewportSpan: resolveViewportSpan(target, 'y'),
      scrollExtent: Number(metricsOwner?.scrollHeight),
    };
  }

  _applyPagedScrollIntent(target, deltaY, surface, { contentionInputAt = null } = {}) {
    this._clearControllers();
    const contentionActive = isRuntimeContentionSessionActive();
    const inputStartedAt = contentionActive ? monotonicNowMs() : 0;
    try {
      return this._pagedScrollIntent.handleInput({
        target,
        deltaY,
        readMetrics: (nextTarget) => this._readPagedScrollMetrics(nextTarget),
        applyDelta: (nextTarget, nextDeltaY) => {
          const commitContentionActive = isRuntimeContentionSessionActive();
          const commitStartedAt = commitContentionActive ? monotonicNowMs() : 0;
          try {
            const applied = this._applyManagedDelta(nextTarget, 0, nextDeltaY);
            if (applied.failed) throw new Error('PAGED_SCROLL_SNAP_APPLY_FAILED');
            return applied.y;
          } finally {
            if (commitContentionActive) {
              const commitEndedAt = monotonicNowMs();
              recordRuntimeOwnerWork({
                ownerId: 'scrollPagedIntent',
                phase: 'snap_commit',
                source: 'intent_hold_timer',
                startedAt: commitStartedAt,
                endedAt: commitEndedAt,
                units: 1,
                queueWaitMs: Number.isFinite(contentionInputAt)
                  ? Math.max(0, commitStartedAt - contentionInputAt)
                  : 0,
              });
            }
          }
        },
        isCurrent: () => (
          this._delayEnabled
          && isTargetConnected(target)
          && this._resolvePagedScrollIntentSurface()?.semanticSurfaceId
            === surface.semanticSurfaceId
        ),
        onError: (error) => {
          reportScrollFrictionFailure('paged_scroll_snap_commit', error, {
            semanticSurfaceId: surface.semanticSurfaceId,
            target: describeScrollTarget(target),
          });
        },
        onSettled: (result) => {
          recordProtectionFeatureEvent('scrollFriction', 'paged_scroll_intent_settled', {
            semanticSurfaceId: surface.semanticSurfaceId,
            target: describeScrollTarget(target),
            ...result,
          });
        },
      });
    } finally {
      if (contentionActive) {
        recordRuntimeOwnerWork({
          ownerId: 'scrollPagedIntent',
          phase: 'intent_input',
          source: 'wheel',
          startedAt: inputStartedAt,
          endedAt: monotonicNowMs(),
          units: 1,
        });
      }
    }
  }

  _syncListening() {
    const shouldWheelListen = this._delayEnabled
      || this._observers.size > 0
      || this._isResistanceActive()
      || this._isForwardBoundaryActive();
    if (shouldWheelListen !== this._wheelListening) {
      if (shouldWheelListen) {
        this._addListenerGroup([this._getWheelListenerBinding()], 'wheel_listener_attach', 'wheel_listener_attach_rollback');
      } else {
        this._removeListenerGroup([this._getWheelListenerBinding()], 'wheel_listener_detach');
      }
      this._wheelListening = shouldWheelListen;
    }

    const shouldScrollListen = this._delayEnabled;
    if (shouldScrollListen !== this._scrollListening) {
      if (shouldScrollListen) {
        this._addListenerGroup([this._getScrollListenerBinding()], 'scroll_listener_attach', 'scroll_listener_attach_rollback');
      } else {
        this._removeListenerGroup([this._getScrollListenerBinding()], 'scroll_listener_detach');
      }
      this._scrollListening = shouldScrollListen;
    }

    const shouldContextListen = this._delayEnabled;
    if (shouldContextListen !== this._contextListening) {
      if (shouldContextListen) {
        this._addListenerGroup(
          this._getContextListenerBindings(),
          'context_listener_attach',
          'context_listener_attach_rollback',
        );
      } else {
        this._stopMiddleAutoScroll();
        this._removeListenerGroup(this._getContextListenerBindings(), 'context_listener_detach');
      }
      this._contextListening = shouldContextListen;
    }
  }

  _getWheelListenerBinding() {
    return {
      type: 'wheel',
      listener: this._boundOnWheel,
      addOptions: { capture: true, passive: false },
      removeOptions: { capture: true },
    };
  }

  _getScrollListenerBinding() {
    return {
      type: 'scroll',
      listener: this._boundOnScroll,
      addOptions: { capture: true, passive: true },
      removeOptions: { capture: true },
    };
  }

  _getContextListenerBindings() {
    return [
      {
        type: 'pointerdown',
        listener: this._boundOnScrollContext,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        type: 'touchstart',
        listener: this._boundOnScrollContext,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        type: 'keydown',
        listener: this._boundOnScrollContext,
        addOptions: { capture: true },
        removeOptions: { capture: true },
      },
      {
        type: 'focusin',
        listener: this._boundOnScrollContext,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        type: 'mousedown',
        listener: this._boundOnMiddleAutoScrollMouseDown,
        addOptions: { capture: true, passive: false },
        removeOptions: { capture: true },
      },
      {
        type: 'auxclick',
        listener: this._boundOnMiddleAutoScrollAuxClick,
        addOptions: { capture: true, passive: false },
        removeOptions: { capture: true },
      },
      {
        target: window,
        type: 'blur',
        listener: this._boundOnWindowBlur,
        addOptions: { capture: true },
        removeOptions: { capture: true },
      },
      {
        target: document,
        type: 'visibilitychange',
        listener: this._boundOnVisibilityChange,
        addOptions: { capture: true },
        removeOptions: { capture: true },
      },
    ];
  }

  _getMiddleAutoScrollActiveListenerBindings() {
    return [
      {
        type: 'mousemove',
        listener: this._boundOnMiddleAutoScrollMouseMove,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        type: 'mouseup',
        listener: this._boundOnMiddleAutoScrollMouseUp,
        addOptions: { capture: true, passive: false },
        removeOptions: { capture: true },
      },
      {
        type: 'keydown',
        listener: this._boundOnMiddleAutoScrollKeyDown,
        addOptions: { capture: true },
        removeOptions: { capture: true },
      },
      {
        type: 'blur',
        listener: this._boundOnMiddleAutoScrollBlur,
        addOptions: undefined,
        removeOptions: undefined,
      },
    ];
  }

  _addListenerGroup(bindings, phase, rollbackPhase) {
    const applied = [];
    try {
      bindings.forEach((binding) => {
        const eventTarget = binding.target || window;
        eventTarget.addEventListener(binding.type, binding.listener, binding.addOptions);
        applied.push(binding);
      });
    } catch (error) {
      reportScrollFrictionFailure(phase, error, {
        eventType: bindings[applied.length]?.type || 'unknown',
      });
      const rollbackErrors = [];
      [...applied].reverse().forEach((binding) => {
        try {
          const eventTarget = binding.target || window;
          eventTarget.removeEventListener(binding.type, binding.listener, binding.removeOptions);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
          reportScrollFrictionFailure(rollbackPhase, rollbackError, {
            eventType: binding.type,
          });
        }
      });
      if (rollbackErrors.length > 0 && error && typeof error === 'object') {
        error.rollbackError = createScrollLifecycleError('SCROLL_INPUT_LISTENER_ROLLBACK_FAILED', rollbackErrors);
      }
      throw error;
    }
  }

  _removeListenerGroup(bindings, phase) {
    const errors = [];
    bindings.forEach((binding) => {
      try {
        const eventTarget = binding.target || window;
        eventTarget.removeEventListener(binding.type, binding.listener, binding.removeOptions);
      } catch (error) {
        errors.push(error);
        reportScrollFrictionFailure(phase, error, {
          eventType: binding.type,
        });
      }
    });
    if (errors.length > 0) {
      throw createScrollLifecycleError('SCROLL_INPUT_LISTENER_DETACH_FAILED', errors);
    }
  }

  _resolveTargetKey(target) {
    if (isWindowLikeTarget(target)) return getRootScroller();
    return target || getRootScroller();
  }

  _readScrollPosition(target) {
    const node = this._resolveTargetKey(target);
    if (isWindowLikeTarget(node)) {
      return {
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0,
      };
    }
    return {
      x: node.scrollLeft || 0,
      y: node.scrollTop || 0,
    };
  }

  _seedRootScrollPosition() {
    const root = getRootScroller();
    const key = this._resolveTargetKey(root);
    this._lastScrollPos.set(key, this._readScrollPosition(root));
  }

  _seedScrollPosition(target) {
    if (!target || !isTargetConnected(target)) return false;
    const key = this._resolveTargetKey(target);
    this._lastScrollPos.set(key, this._readScrollPosition(target));
    return true;
  }

  _seedScrollableAncestors(startEl) {
    let seededCount = 0;
    let node = startEl instanceof Element ? startEl : null;
    while (node && node !== document.body && node !== document.documentElement) {
      if (canScrollAxis(node, 'x') || canScrollAxis(node, 'y')) {
        if (this._seedScrollPosition(node)) seededCount += 1;
      }
      node = getComposedParentElement(node);
    }

    if (this._seedScrollPosition(getRootScroller())) seededCount += 1;
    return seededCount;
  }

  _seedScrollContextFromEvent(event) {
    if (!this._delayEnabled) return;
    const eventType = event?.type || 'unknown';
    if (
      eventType === 'pointerdown'
      || eventType === 'touchstart'
      || eventType === 'keydown'
      || eventType === 'focusin'
    ) {
      this._resetWheelGesture();
    }
    const startEl = resolveStartElement(event);
    const seededCount = this._seedScrollableAncestors(startEl);
    if (seededCount > 0) {
      recordProtectionFeatureEvent('scrollFriction', 'scroll_context_seeded', {
        eventType,
        seededCount,
      });
    }
  }

  _markSuppressed(target, ttlMs = 80) {
    const key = this._resolveTargetKey(target);
    this._suppressedUntil.set(key, Date.now() + Math.max(16, ttlMs));
  }

  _isSuppressed(target) {
    const key = this._resolveTargetKey(target);
    const until = this._suppressedUntil.get(key) || 0;
    if (until <= Date.now()) {
      this._suppressedUntil.delete(key);
      return false;
    }
    return true;
  }

  _getAxisState(map, target) {
    const key = this._resolveTargetKey(target);
    let state = map.get(key);
    if (!state) {
      state = { x: 0, y: 0 };
      map.set(key, state);
    }
    return { key, state };
  }

  _getManagedScrollVerificationState(target) {
    const key = this._resolveTargetKey(target);
    let state = this._managedScrollVerification.get(key);
    if (!state) {
      state = { x: null, y: null };
      this._managedScrollVerification.set(key, state);
    }
    return state;
  }

  _finalizeManagedScrollVerification(target, axis, currentPosition) {
    const key = this._resolveTargetKey(target);
    const state = this._managedScrollVerification.get(key);
    const pending = state?.[axis];
    if (!pending) return false;
    state[axis] = null;
    const bypassed = this._observeManagedScrollApplication(
      target,
      axis,
      pending.requestedDelta,
      currentPosition - pending.beforePosition,
    );
    if (!state.x && !state.y) this._managedScrollVerification.delete(key);
    return bypassed;
  }

  _queueManagedScrollVerification(target, axis, requestedDelta, beforePosition) {
    const state = this._getManagedScrollVerificationState(target);
    state[axis] = { requestedDelta, beforePosition };
  }

  _clearManagedScrollVerification(target, axis) {
    const key = this._resolveTargetKey(target);
    const state = this._managedScrollVerification.get(key);
    if (!state) return;
    state[axis] = null;
    if (!state.x && !state.y) this._managedScrollVerification.delete(key);
  }

  _clearManagedUnderread(target, axis) {
    const key = this._resolveTargetKey(target);
    const state = this._managedScrollUnderreadStreak.get(key);
    if (!state) return;
    state[axis] = 0;
    if (!state.x && !state.y) this._managedScrollUnderreadStreak.delete(key);
  }

  _markManagedScrollBypass(target, axis, details = {}) {
    const { key, state } = this._getAxisState(this._managedScrollBypassUntil, target);
    state[axis] = Date.now() + MANAGED_SCROLL_BYPASS_TTL_MS;
    this._clearManagedScrollVerification(target, axis);
    const controller = this._controllers.get(key);
    if (controller) this._releaseControllerAxis(controller, axis);
    recordProtectionFeatureEvent('scrollFriction', 'managed_scroll_underread_bypass', {
      axis,
      target: describeScrollTarget(target),
      ttlMs: MANAGED_SCROLL_BYPASS_TTL_MS,
      ...details,
    });
  }

  _isManagedScrollBypassActive(target, axis, now = Date.now()) {
    const key = this._resolveTargetKey(target);
    const state = this._managedScrollBypassUntil.get(key);
    if (!state) return false;
    if ((state[axis] || 0) > now) {
      state[axis] = now + MANAGED_SCROLL_BYPASS_TTL_MS;
      return true;
    }
    state[axis] = 0;
    if (!state.x && !state.y) this._managedScrollBypassUntil.delete(key);
    return false;
  }

  _isManagedScrollBypassActiveForDelta(target, deltaX, deltaY, now = Date.now()) {
    return (
      (deltaX !== 0 && this._isManagedScrollBypassActive(target, 'x', now))
      || (deltaY !== 0 && this._isManagedScrollBypassActive(target, 'y', now))
    );
  }

  _observeManagedScrollApplication(target, axis, requestedDelta, appliedDelta) {
    const requestedMagnitude = Math.abs(requestedDelta);
    if (requestedMagnitude < MANAGED_SCROLL_UNDERREAD_MIN_DELTA_PX) return false;

    const requestedDirection = Math.sign(requestedDelta);
    if (!requestedDirection || !isScrollableAxis(target, axis, requestedDirection)) {
      this._clearManagedUnderread(target, axis);
      return false;
    }

    const appliedMagnitude = Math.abs(appliedDelta);
    const ratio = appliedMagnitude / requestedMagnitude;
    if (ratio >= MANAGED_SCROLL_UNDERREAD_RATIO) {
      this._clearManagedUnderread(target, axis);
      return false;
    }

    const { state } = this._getAxisState(this._managedScrollUnderreadStreak, target);
    state[axis] += 1;
    const severe = ratio <= MANAGED_SCROLL_SEVERE_UNDERREAD_RATIO;
    if (!severe && state[axis] < MANAGED_SCROLL_UNDERREAD_STREAK) return false;

    this._clearManagedUnderread(target, axis);
    this._markManagedScrollBypass(target, axis, {
      requestedDelta,
      appliedDelta,
      appliedRatio: Number(ratio.toFixed(4)),
      severe,
    });
    return true;
  }

  _resolveScrollEventTarget(event) {
    const target = event?.target;
    if (
      target === document ||
      target === window ||
      target === document.documentElement ||
      target === document.body
    ) {
      return getRootScroller();
    }
    if (target instanceof Element) return target;
    return getRootScroller();
  }

  _notifyObservers(payload) {
    for (const observer of this._observers) {
      try {
        observer(payload);
      } catch (err) {
        reportScrollFrictionFailure('observer_callback', err, {
          deltaX: payload?.deltaX || 0,
          deltaY: payload?.deltaY || 0,
        });
      }
    }
  }

  _resetWheelGesture() {
    this._wheelGesture = createScrollGestureOwnershipState();
  }

  _resolveWheelGestureDeltas(deltaX, deltaY, now) {
    return resolveScrollGestureInput(this._wheelGesture, deltaX, deltaY, now);
  }

  _resolveWheelTarget(startEl, axis, delta, now) {
    const lease = this._wheelGesture[axis];
    const leaseActive = isScrollGestureAxisLeaseActive(
      this._wheelGesture,
      axis,
      now,
      isTargetConnected(lease.target),
    );

    if (leaseActive) {
      const controller = this._controllers.get(this._resolveTargetKey(lease.target));
      const momentum = axis === 'x'
        ? controller?.motion?.momentumX
        : controller?.motion?.momentumY;
      if (
        (momentum && Math.sign(momentum) !== Math.sign(delta))
        || isScrollableAxis(lease.target, axis, delta)
      ) {
        lease.lastInputAt = now;
        return lease.target;
      }

      lease.lastInputAt = now;
      return lease.target;
    }

    const target = this._findWheelTarget(startEl, axis);
    lease.target = target;
    lease.lastInputAt = target ? now : null;
    return target;
  }

  _findWheelTarget(startEl, axis) {
    return findOwnedScrollSurface(startEl, axis);
  }

  _getController(target) {
    const key = this._resolveTargetKey(target);
    let controller = this._controllers.get(key);
    if (controller) return controller;

    controller = {
      key,
      target,
      motion: createFrostedStoneMotionState(),
      stepOutput: createFrostedStoneStepOutput(),
      rafId: null,
      lastFrameAt: 0,
    };
    this._controllers.set(key, controller);
    return controller;
  }

  _releaseControllerAxis(controller, axis) {
    if (!controller) return;
    zeroFrostedStoneMomentumAxis(controller.motion, axis);
    const lease = this._wheelGesture[axis];
    if (lease.target && this._resolveTargetKey(lease.target) === controller.key) {
      lease.target = null;
      lease.lastInputAt = null;
    }
    this._clearManagedScrollVerification(controller.target, axis);
    if (!this._hasKineticEnergy(controller)) this._cancelController(controller);
  }

  _cancelController(controller) {
    if (!controller) return;
    if (controller.rafId !== null) {
      cancelScheduledAnimationFrame(controller.rafId);
    }
    for (const axis of ['x', 'y']) {
      const lease = this._wheelGesture[axis];
      if (lease.target && this._resolveTargetKey(lease.target) === controller.key) {
        lease.target = null;
        lease.lastInputAt = null;
      }
      this._clearManagedScrollVerification(controller.target, axis);
    }
    this._controllers.delete(controller.key);
  }

  _clearControllers() {
    for (const controller of this._controllers.values()) {
      this._cancelController(controller);
    }
    this._controllers.clear();
  }

  _installMiddleAutoScrollActiveListeners() {
    this._addListenerGroup(
      this._getMiddleAutoScrollActiveListenerBindings(),
      'middle_autoscroll_listener_attach',
      'middle_autoscroll_listener_attach_rollback',
    );
  }

  _removeMiddleAutoScrollActiveListeners() {
    this._removeListenerGroup(
      this._getMiddleAutoScrollActiveListenerBindings(),
      'middle_autoscroll_listener_detach',
    );
  }

  _scheduleMiddleAutoScrollFrame() {
    const session = this._middleAutoScroll;
    if (!session || session.rafId !== null) return;
    session.rafId = scheduleAnimationFrame((now) => this._advanceMiddleAutoScrollFrame(now));
  }

  _startMiddleAutoScroll(event, startEl, scrollContainer) {
    this._stopMiddleAutoScroll();
    this._pagedScrollIntent.clear();
    const now = Date.now();
    this._middleAutoScroll = {
      startEl,
      scrollContainer,
      anchorX: Number(event?.clientX) || 0,
      anchorY: Number(event?.clientY) || 0,
      pointerX: Number(event?.clientX) || 0,
      pointerY: Number(event?.clientY) || 0,
      lastFrameAt: now,
      rafId: null,
    };
    try {
      this._seedScrollableAncestors(startEl);
      this._installMiddleAutoScrollActiveListeners();
      this._scheduleMiddleAutoScrollFrame();
    } catch (error) {
      const session = this._middleAutoScroll;
      if (session && session.rafId !== null) cancelScheduledAnimationFrame(session.rafId);
      this._middleAutoScroll = null;
      this._suppressMiddleAuxClickUntil = Date.now() + MIDDLE_AUTOSCROLL_AUXCLICK_SUPPRESS_MS;
      throw error;
    }
  }

  _stopMiddleAutoScroll() {
    const session = this._middleAutoScroll;
    if (!session) return;
    const scheduledFrame = session.rafId;
    if (scheduledFrame !== null) {
      cancelScheduledAnimationFrame(scheduledFrame);
      session.rafId = null;
    }
    try {
      this._removeMiddleAutoScrollActiveListeners();
    } catch (error) {
      this._scheduleMiddleAutoScrollFrame();
      throw error;
    }
    this._middleAutoScroll = null;
    this._suppressMiddleAuxClickUntil = Date.now() + MIDDLE_AUTOSCROLL_AUXCLICK_SUPPRESS_MS;
  }

  _advanceMiddleAutoScrollFrame(now = Date.now()) {
    const session = this._middleAutoScroll;
    if (!session) return;
    session.rafId = null;

    if (!isTargetConnected(session.scrollContainer) || !isTargetConnected(session.startEl)) {
      this._stopMiddleAutoScroll();
      return;
    }

    const frameNow = Number.isFinite(now) ? now : Date.now();
    const elapsedMs = session.lastFrameAt ? frameNow - session.lastFrameAt : 16;
    const dtMs = clamp(elapsedMs, 0, FROSTED_STONE_MATERIAL.maxFrameSeconds * 1000);
    session.lastFrameAt = frameNow;

    const offsetX = session.pointerX - session.anchorX;
    const offsetY = session.pointerY - session.anchorY;
    const roughX = Math.abs(offsetX) > MIDDLE_AUTOSCROLL_DEADZONE_PX ? Math.sign(offsetX) : 0;
    const roughY = Math.abs(offsetY) > MIDDLE_AUTOSCROLL_DEADZONE_PX ? Math.sign(offsetY) : 0;
    const horizontalTarget = roughX ? findOwnedScrollSurface(session.startEl, 'x') : null;
    const verticalTarget = roughY ? findOwnedScrollSurface(session.startEl, 'y') : null;
    const deltaX = horizontalTarget
      ? resolveMiddleAutoScrollDelta(offsetX, dtMs, horizontalTarget, 'x')
      : 0;
    const deltaY = verticalTarget
      ? resolveMiddleAutoScrollDelta(offsetY, dtMs, verticalTarget, 'y')
      : 0;

    let bypassed = false;
    if (horizontalTarget && verticalTarget && horizontalTarget === verticalTarget) {
      bypassed = this._applyPhysicsScroll(horizontalTarget, deltaX, deltaY)?.bypassed === true;
    } else {
      if (horizontalTarget && deltaX !== 0) {
        bypassed = this._applyPhysicsScroll(horizontalTarget, deltaX, 0)?.bypassed === true || bypassed;
      }
      if (verticalTarget && deltaY !== 0) {
        bypassed = this._applyPhysicsScroll(verticalTarget, 0, deltaY)?.bypassed === true || bypassed;
      }
    }

    if (bypassed) {
      this._stopMiddleAutoScroll();
      return;
    }

    this._scheduleMiddleAutoScrollFrame();
  }

  _onMiddleAutoScrollMouseDown(event) {
    if (this._middleAutoScroll) {
      consumeCancelableEvent(event);
      this._stopMiddleAutoScroll();
      return;
    }
    if (
      !this._delayEnabled
      || this._isActuationLocked()
      || this._isResistanceActive()
      || this._isForwardBoundaryActive()
      || this._resolvePagedScrollIntentSurface()
    ) return;
    if (!isPlainMiddleMouseDown(event) || event?.defaultPrevented || event?.cancelable === false) return;

    const startEl = resolveStartElement(event);
    if (!(startEl instanceof Element)) return;
    if (isMiddleAutoScrollExcludedSurface(event, startEl)) return;

    const scrollContainer = findScrollableContainer(startEl);
    if (!scrollContainer) return;

    consumeCancelableEvent(event);
    try {
      this._startMiddleAutoScroll(event, startEl, scrollContainer);
    } catch (_) {
      // The attach helper has already recorded the concrete listener failure.
    }
  }

  _onMiddleAutoScrollMouseMove(event) {
    const session = this._middleAutoScroll;
    if (!session) return;
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    if (Number.isFinite(clientX)) session.pointerX = clientX;
    if (Number.isFinite(clientY)) session.pointerY = clientY;
  }

  _onMiddleAutoScrollMouseUp(event) {
    if (!this._middleAutoScroll || event?.button !== MIDDLE_MOUSE_BUTTON) return;
    consumeCancelableEvent(event);
  }

  _onMiddleAutoScrollKeyDown(event) {
    if (!this._middleAutoScroll || event?.key !== 'Escape') return;
    consumeCancelableEvent(event);
    this._stopMiddleAutoScroll();
  }

  _onMiddleAutoScrollAuxClick(event) {
    if (event?.button !== MIDDLE_MOUSE_BUTTON) return;
    if (this._middleAutoScroll) {
      consumeCancelableEvent(event);
      return;
    }
    if (this._suppressMiddleAuxClickUntil > Date.now()) {
      consumeCancelableEvent(event);
      this._stopMiddleAutoScroll();
    }
  }

  _estimatePendingPx(controller) {
    return estimateFrostedStoneStoppingMotion(controller.motion).distancePx;
  }

  _hasKineticEnergy(controller) {
    return hasFrostedStoneMotion(controller.motion);
  }

  _applyManagedDelta(target, deltaX, deltaY) {
    if (
      Math.abs(deltaX) <= MOTION_DELTA_EPSILON_PX
      && Math.abs(deltaY) <= MOTION_DELTA_EPSILON_PX
    ) {
      return { x: 0, y: 0 };
    }
    const before = this._readScrollPosition(target);
    const xBypassed = deltaX !== 0
      && this._finalizeManagedScrollVerification(target, 'x', before.x);
    const yBypassed = deltaY !== 0
      && this._finalizeManagedScrollVerification(target, 'y', before.y);
    const appliedDeltaX = xBypassed ? 0 : deltaX;
    const appliedDeltaY = yBypassed ? 0 : deltaY;
    if (appliedDeltaX === 0 && appliedDeltaY === 0) {
      return { x: 0, y: 0, bypassed: true };
    }
    this._markSuppressed(target, SCROLL_WRITE_SUPPRESSION_MS);
    try {
      applyScrollDelta(target, appliedDeltaX, appliedDeltaY);
    } catch (error) {
      const key = this._resolveTargetKey(target);
      this._suppressedUntil.delete(key);
      if (appliedDeltaX !== 0) this._clearManagedScrollVerification(target, 'x');
      if (appliedDeltaY !== 0) this._clearManagedScrollVerification(target, 'y');
      reportScrollFrictionFailure('managed_scroll_apply', error, {
        target: describeScrollTarget(target),
        deltaX: appliedDeltaX,
        deltaY: appliedDeltaY,
      });
      return { x: 0, y: 0, failed: true };
    }
    const key = this._resolveTargetKey(target);
    const after = this._readScrollPosition(target);
    this._lastScrollPos.set(key, after);
    const applied = {
      x: after.x - before.x,
      y: after.y - before.y,
    };
    if (appliedDeltaX !== 0) {
      this._queueManagedScrollVerification(target, 'x', appliedDeltaX, before.x);
    }
    if (appliedDeltaY !== 0) {
      this._queueManagedScrollVerification(target, 'y', appliedDeltaY, before.y);
    }
    return applied;
  }

  _scheduleController(controller) {
    if (!this._hasKineticEnergy(controller)) return;
    if (controller.rafId !== null) return;
    controller.rafId = scheduleAnimationFrame(() => this._advanceControllerFrame(controller));
  }

  _stepController(controller, now = Date.now()) {
    if (!isTargetConnected(controller.target)) {
      this._controllers.delete(controller.key);
      this._lastScrollPos.delete(controller.key);
      this._suppressedUntil.delete(controller.key);
      return false;
    }

    const material = this._motionMaterial || FROSTED_STONE_MATERIAL;
    const elapsedMs = controller.lastFrameAt ? Math.max(0, now - controller.lastFrameAt) : 0;
    const maxFrameMs = material.maxFrameSeconds * 1000;
    const skippedMs = Math.max(0, elapsedMs - maxFrameMs);
    controller.lastFrameAt = now;
    if (skippedMs > 0) {
      dissipateFrostedStoneMotion(controller.motion, skippedMs / 1000, material);
      if (!this._hasKineticEnergy(controller)) return false;
    }
    const dtMs = Math.min(elapsedMs, maxFrameMs);
    if (dtMs <= 0) return this._hasKineticEnergy(controller);

    const step = advanceFrostedStoneMotion(
      controller.motion,
      dtMs / 1000,
      controller.stepOutput,
      material,
    );
    const stepX = step.deltaX;
    const stepY = step.deltaY;
    const applied = this._applyManagedDelta(controller.target, stepX, stepY);
    if (applied.failed) {
      resetFrostedStoneMotionState(controller.motion);
      return false;
    }

    const xBlocked = Math.abs(stepX) > 0.5 && Math.abs(applied.x) < Math.abs(stepX) * 0.35;
    const yBlocked = Math.abs(stepY) > 0.5 && Math.abs(applied.y) < Math.abs(stepY) * 0.35;
    if (xBlocked && !applied.bypassed) {
      const direction = Math.sign(controller.motion.momentumX);
      if (direction && !isScrollableAxis(controller.target, 'x', direction)) {
        this._releaseControllerAxis(controller, 'x');
      }
    }
    if (yBlocked && !applied.bypassed) {
      const direction = Math.sign(controller.motion.momentumY);
      if (direction && !isScrollableAxis(controller.target, 'y', direction)) {
        this._releaseControllerAxis(controller, 'y');
      }
    }
    return this._hasKineticEnergy(controller);
  }

  _advanceControllerFrame(controller) {
    controller.rafId = null;
    const contentionActive = isRuntimeContentionSessionActive();
    const frameStartedAt = contentionActive ? monotonicNowMs() : 0;
    const frameNow = Date.now();
    const previousFrameAt = controller.lastFrameAt;
    const physicsIntervalMs = previousFrameAt
      ? Math.max(0, frameNow - previousFrameAt)
      : 0;
    const material = this._motionMaterial || FROSTED_STONE_MATERIAL;
    const skippedMs = Math.max(
      0,
      physicsIntervalMs - material.maxFrameSeconds * 1000,
    );
    const intervalMs = contentionActive && controller.lastContentionFrameAt
      ? Math.max(0, frameStartedAt - controller.lastContentionFrameAt)
      : 0;
    const inputToFrameMs = contentionActive && controller.lastContentionInputAt
      ? Math.max(0, frameStartedAt - controller.lastContentionInputAt)
      : 0;
    if (contentionActive) controller.lastContentionFrameAt = frameStartedAt;
    else controller.lastContentionFrameAt = null;
    controller.lastContentionInputAt = null;
    const active = this._stepController(controller, frameNow);
    if (contentionActive) {
      recordRuntimeScrollFrame({
        startedAt: frameStartedAt,
        endedAt: monotonicNowMs(),
        intervalMs,
        inputToFrameMs,
        skippedMs,
        activeControllerCount: this._controllers.size,
        targetKind: describeScrollTarget(controller.target),
        activeAfter: active,
      });
    }
    if (!active) {
      this._controllers.delete(controller.key);
      return;
    }
    this._scheduleController(controller);
  }

  _applyPhysicsScroll(target, deltaX, deltaY, { contentionInputAt = null } = {}) {
    if (!target) return;
    if (this._isManagedScrollBypassActiveForDelta(target, deltaX, deltaY)) {
      return {
        bypassed: true,
        pendingPx: 0,
        settleMs: 0,
      };
    }
    const now = Date.now();
    const key = this._resolveTargetKey(target);
    let controller = this._controllers.get(key) || null;
    if (controller && !this._stepController(controller, now)) {
      this._cancelController(controller);
      controller = null;
    }

    const material = this._motionMaterial || FROSTED_STONE_MATERIAL;
    if (!controller) controller = this._getController(target);
    if (Number.isFinite(contentionInputAt) && contentionInputAt > 0) {
      const pendingInputAt = Number(controller.lastContentionInputAt);
      controller.lastContentionInputAt = Number.isFinite(pendingInputAt)
        && pendingInputAt > 0
        && contentionInputAt - pendingInputAt < 1000
        ? Math.min(pendingInputAt, contentionInputAt)
        : contentionInputAt;
    }
    applyFrostedStoneImpulse(controller.motion, deltaX, deltaY, material);
    controller.lastFrameAt = now;
    if (!this._hasKineticEnergy(controller)) {
      this._cancelController(controller);
      return {
        motionMaterial: material.id,
        motionStage: material.stage,
        physicsRegime: 'rest',
        mass: material.mass,
        momentum: 0,
        kineticEnergy: 0,
        speedPxPerS: 0,
        pendingPx: 0,
        settleMs: 0,
      };
    }
    this._scheduleController(controller);

    const stoppingMotion = estimateFrostedStoneStoppingMotion(controller.motion, material);
    const kineticEnergy = getFrostedStoneKineticEnergy(controller.motion, material);
    const speedPxPerS = getFrostedStoneSpeed(controller.motion, material);
    return {
      motionMaterial: material.id,
      motionStage: material.stage,
      physicsRegime: getFrostedStoneRegime(controller.motion, material),
      mass: material.mass,
      momentum: Math.hypot(controller.motion.momentumX, controller.motion.momentumY),
      kineticEnergy,
      speedPxPerS,
      pendingPx: stoppingMotion.distancePx,
      settleMs: stoppingMotion.settleMs,
    };
  }

  _onWheel(event) {
    const contentionInputAt = isRuntimeContentionSessionActive()
      ? monotonicNowMs()
      : null;
    if (this._middleAutoScroll) this._stopMiddleAutoScroll();

    const startEl = resolveStartElement(event);
    const {
      deltaX,
      deltaY,
      rawDeltaX,
      rawDeltaY,
      deltaMode,
    } = normalizeWheelDelta(event, startEl);
    if (deltaX === 0 && deltaY === 0) return;
    if (event?.defaultPrevented) return;

    // Actuation ownership controls whether Entropy may reshape the scroll, not
    // whether downstream consumers may observe the user's intent. Feed-flow
    // directionality must remain measurable while an intervention owns the
    // actuation seam so backward/escape input is not erased by the lock.
    this._notifyObservers({
      deltaX,
      deltaY,
      rawDeltaX,
      rawDeltaY,
      deltaMode,
      ts: Date.now(),
      target: event.target,
    });

    if (this._isActuationLocked()) {
      recordProtectionFeatureEvent('scrollFriction', 'wheel_actuation_locked', {
        deltaX,
        deltaY,
      });
      return;
    }

    if (this._isForwardBoundaryActive() && this._applyForwardBoundary(event, startEl, deltaY)) {
      return;
    }

    if (this._isResistanceActive()) {
      this._applyResistance(event, startEl, deltaY);
      return;
    }

    if (!this._delayEnabled) return;
    const now = Date.now();
    const gestureInput = this._resolveWheelGestureDeltas(deltaX, deltaY, now);
    const impulseDeltaX = gestureInput.deltaX;
    const impulseDeltaY = gestureInput.deltaY;
    const horizontalTarget = impulseDeltaX
      ? this._resolveWheelTarget(startEl, 'x', impulseDeltaX, now)
      : null;
    const verticalTarget = impulseDeltaY
      ? this._resolveWheelTarget(startEl, 'y', impulseDeltaY, now)
      : null;
    if (!horizontalTarget && !verticalTarget) {
      this._noNativeTargetStreak += 1;
      recordProtectionFeatureEvent('scrollFriction', 'wheel_no_scroll_target', {
        deltaX,
        deltaY,
        streak: this._noNativeTargetStreak,
      });
      if (this._noNativeTargetStreak === CUSTOM_SCROLL_CANDIDATE_STREAK) {
        recordProtectionFeatureEvent('scrollFriction', 'custom_scroll_candidate', {
          streak: this._noNativeTargetStreak,
          reason: 'wheel_events_without_native_scrollable_target',
        });
      }
      return;
    }

    this._noNativeTargetStreak = 0;
    if (
      (horizontalTarget && this._isManagedScrollBypassActive(horizontalTarget, 'x', now))
      || (verticalTarget && this._isManagedScrollBypassActive(verticalTarget, 'y', now))
    ) {
      return;
    }

    consumeWheelEvent(event);
    if (horizontalTarget) this._seedScrollPosition(horizontalTarget);
    if (verticalTarget) this._seedScrollPosition(verticalTarget);
    const pagedSurface = impulseDeltaY && verticalTarget
      ? this._resolvePagedScrollIntentSurface()
      : null;
    if (pagedSurface && gestureInput.lockedAxis !== 'x') {
      const pagedResult = this._applyPagedScrollIntent(
        verticalTarget,
        impulseDeltaY,
        pagedSurface,
        { contentionInputAt },
      );
      recordProtectionFeatureEvent('scrollFriction', 'paged_scroll_intent_armed', {
        deltaY,
        impulseDeltaY,
        gestureLockedAxis: gestureInput.lockedAxis,
        semanticSurfaceId: pagedSurface.semanticSurfaceId,
        target: describeScrollTarget(verticalTarget),
        delayMs: this._delayMs,
        holdMs: PAGED_SCROLL_INTENT_POLICY.holdMs,
        commitLockMs: PAGED_SCROLL_INTENT_POLICY.commitLockMs,
        pendingPx: pagedResult.pendingPx,
        locked: pagedResult.locked,
      });
      return;
    }
    this._pagedScrollIntent.clear();
    let result = null;
    if (horizontalTarget && verticalTarget && horizontalTarget === verticalTarget) {
      result = this._applyPhysicsScroll(
        horizontalTarget,
        impulseDeltaX,
        impulseDeltaY,
        { contentionInputAt },
      );
    } else {
      if (horizontalTarget) {
        result = this._applyPhysicsScroll(
          horizontalTarget,
          impulseDeltaX,
          0,
          { contentionInputAt },
        ) || result;
      }
      if (verticalTarget) {
        result = this._applyPhysicsScroll(
          verticalTarget,
          0,
          impulseDeltaY,
          { contentionInputAt },
        ) || result;
      }
    }

    recordProtectionFeatureEvent('scrollFriction', 'wheel_physics_impulse', {
      deltaX,
      deltaY,
      impulseDeltaX,
      impulseDeltaY,
      gestureLockedAxis: gestureInput.lockedAxis,
      hasHorizontalTarget: !!horizontalTarget,
      hasVerticalTarget: !!verticalTarget,
      delayMs: this._delayMs,
      motionMaterial: result?.motionMaterial || null,
      motionStage: result?.motionStage || null,
      physicsRegime: result?.physicsRegime || 'rest',
      settleMs: result?.settleMs || 0,
      mass: result?.mass || 0,
      momentum: result?.momentum || 0,
      kineticEnergy: result?.kineticEnergy || 0,
      speedPxPerS: result?.speedPxPerS || 0,
      pendingPx: result?.pendingPx || 0,
    });
  }

  _onScroll(event) {
    if (!this._delayEnabled) return;

    const target = this._resolveScrollEventTarget(event);
    if (!target || !isTargetConnected(target)) return;

    const key = this._resolveTargetKey(target);
    const current = this._readScrollPosition(target);

    if (this._isSuppressed(target)) {
      this._lastScrollPos.set(key, current);
      return;
    }

    this._lastScrollPos.set(key, current);
  }
}

const scrollInputOrchestrator = new ScrollInputOrchestrator();
export default scrollInputOrchestrator;
