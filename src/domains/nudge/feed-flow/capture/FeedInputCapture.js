import {
  getRootScroller,
  isRootLikeScroller,
  readScrollerPosition,
  resolveScrollContainer,
  resolveObservedScrollContainer,
} from '../resolve/ActiveScrollContainerResolver.js';
import scrollInputOrchestrator from '../../behavior/scrollInputOrchestrator.js';
import observerHub from '../../../../lib/dom/ObserverHub.js';
import { isTextEntryKeyboardEvent } from '../../../../lib/dom/textEntryTarget.js';
import { readEditorObservationState, isObservedEditorInput } from '../../../../lib/dom/editorObservationTarget.js';
import { EditorObservationChannel } from '../observation/EditorObservationJournal.js';
import { readProgrammaticScrollWriteState } from '../../../../lib/dom/programmaticScrollWrites.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
} from '@runtime-contention-ledger';

const FORWARD_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar', 'j']);
const BACKWARD_KEYS = new Set(['ArrowUp', 'PageUp', 'Home', 'k']);
const MIN_POINTER_TRAVEL_PX = 12;

function runFeedFlowOwnerWork(phase, source, work) {
  if (!isRuntimeContentionSessionActive()) return work();
  const startedAt = performance.now();
  try {
    return work();
  } finally {
    recordRuntimeOwnerWork({
      ownerId: 'feedFlow',
      phase,
      source,
      units: 1,
      startedAt,
      endedAt: performance.now(),
    });
  }
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target?.isContentEditable;
}

function reportCaptureSelectorFailure(onRuntimeFailure, phase, selector, error) {
  if (typeof onRuntimeFailure !== 'function') return;
  onRuntimeFailure(phase, error, {
    phase,
    error: String(error?.message || error || 'FEED_INPUT_CAPTURE_SELECTOR_FAILURE'),
    selector,
  });
}

function safeClosest(target, selector, onRuntimeFailure = null) {
  if (!(target instanceof Element) || typeof selector !== 'string' || !selector.trim()) return null;
  try {
    return target.closest(selector);
  } catch (error) {
    reportCaptureSelectorFailure(onRuntimeFailure, 'feed_input_closest_selector', selector, error);
    return null;
  }
}

function isInteractiveTarget(target, onRuntimeFailure = null) {
  return !!safeClosest(
    target,
    'a[href], button, summary, select, textarea, input, [role="button"], [role="link"], [role="menuitem"], [role="tab"]',
    onRuntimeFailure,
  );
}

function isNavigationLikeTarget(target, onRuntimeFailure = null) {
  return !!safeClosest(
    target,
    'a[href], button, summary, [role="button"], [role="link"], [aria-controls], [data-e2e], [data-item-id], [data-video-id]',
    onRuntimeFailure,
  );
}

function buildElementPath(element) {
  if (!(element instanceof Element)) return [];
  const path = [];
  let current = element;

  while (current instanceof Element && path.length < 5) {
    path.push(current.tagName?.toLowerCase() || 'element');
    current = current.parentElement;
  }

  return path;
}

function buildTargetPath(event) {
  if (Array.isArray(event?.targetPath)) {
    return event.targetPath.slice(0, 5);
  }
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
  const resolvedPath = path
    .filter((node) => node instanceof Element)
    .slice(0, 5)
    .map((node) => node.tagName?.toLowerCase() || 'element');
  if (resolvedPath.length > 0) return resolvedPath;
  return buildElementPath(event?.target instanceof Element ? event.target : null);
}

function buildIntent(base = {}) {
  return {
    kind: 'wheel',
    ts: Date.now(),
    direction: 'forward',
    deltaY: null,
    key: null,
    pointerType: null,
    targetPath: [],
    sourceElement: null,
    sourceScroller: null,
    ...base,
  };
}

function buildActivity(base = {}) {
  return {
    kind: 'click',
    ts: Date.now(),
    targetPath: [],
    sourceElement: null,
    isEditable: false,
    isInteractive: false,
    isNavigationLike: false,
    ...base,
  };
}

function createLifecycleError(message, errors) {
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

export class FeedInputCapture {
  constructor({
    windowRef = typeof window !== 'undefined' ? window : null,
    documentRef = typeof document !== 'undefined' ? document : null,
    onAdvanceIntent = null,
    onActivity = null,
    onMutation = null,
    onVisibilityChange = null,
    onScrollObservation = null,
    onGeometryInvalidated = null,
    onRuntimeFailure = null,
    wheelInput = scrollInputOrchestrator,
  } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._onAdvanceIntent = onAdvanceIntent;
    this._onActivity = onActivity;
    this._onMutation = onMutation;
    this._onVisibilityChange = onVisibilityChange;
    this._onScrollObservation = onScrollObservation;
    this._onGeometryInvalidated = onGeometryInvalidated;
    this._scrollObservationSequence = 0;
    this._onRuntimeFailure = onRuntimeFailure;
    this._wheelInput = wheelInput;
    this._wheelUnsub = null;
    this._mutationUnsub = null;
    this._active = false;
    this._editorObservation = new EditorObservationChannel();
    this._touchStartY = null;
    this._activePointer = null;
    this._rootScrollPosition = null;
    this._scrollPositionByElement = new WeakMap();
    this._rootScrollWriteRevision = null;
    this._scrollWriteRevisionByElement = new WeakMap();

    this._boundWheel = (event) => this._handleWheel(event);
    this._boundScroll = (event) => this._handleScroll(event);
    this._boundKeyDown = (event) => this._handleKeyDown(event);
    this._boundTouchStart = (event) => this._handleTouchStart(event);
    this._boundTouchMove = (event) => this._handleTouchMove(event);
    this._boundPointerDown = (event) => this._handlePointerDown(event);
    this._boundPointerUp = (event) => this._handlePointerUp(event);
    this._boundPointerCancel = (event) => this._handlePointerCancel(event);
    this._boundClick = (event) => this._handleClick(event);
    this._boundFocusIn = (event) => this._handleFocusIn(event);
    this._boundFocusOut = () => this.sampleEditorObservation();
    this._boundInput = (event) => this._handleInput(event);
    this._boundSelectionChange = () => this._handleSelectionChange();
    this._boundMediaPlay = (event) => this._handleMediaEvent(event, 'media_play');
    this._boundMediaPause = (event) => this._handleMediaEvent(event, 'media_pause');
    this._boundVisibility = () => this._handleVisibilityChange();
    this._boundResize = () => this._onGeometryInvalidated?.();
  }

  start() {
    if (this._active || !this._window || !this._document) return;
    this._active = true;
    try {
      this._resetContinuity(this._document.visibilityState === 'visible');
      this._editorObservation.start(performance.now());
      this.sampleEditorObservation();

      if (typeof this._wheelInput?.subscribe === 'function') {
        this._wheelUnsub = this._wheelInput.subscribe(this._boundWheel);
      }
      this._getListenerBindings().forEach((binding) => {
        binding.target.addEventListener(binding.type, binding.listener, binding.addOptions);
      });
      this._startMutationSubscription();
    } catch (error) {
      const cleanupError = this._stopInternal();
      if (cleanupError) error.cleanupError = cleanupError;
      throw error;
    }
  }

  stop() {
    if (!this._active || !this._window || !this._document) return;
    const cleanupError = this._stopInternal();
    if (cleanupError) throw cleanupError;
  }

  setEditorObservationAllowed(allowed) {
    this._editorObservation.setAllowed(allowed, performance.now());
    this.sampleEditorObservation();
  }

  getEditorObservationSnapshot() { return this._editorObservation.getSnapshot(); }

  sampleEditorObservation() {
    if (!this._active || !this._editorObservation.enabled) return;
    this._editorObservation.recordState(readEditorObservationState(this._document), performance.now());
  }

  _getListenerBindings() {
    return [
      { target: this._document, type: 'focusout', listener: this._boundFocusOut, addOptions: true, removeOptions: true },
      { target: this._window, type: 'resize', listener: this._boundResize, addOptions: true, removeOptions: true },
      {
        target: this._window,
        type: 'scroll',
        listener: this._boundScroll,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._window,
        type: 'keydown',
        listener: this._boundKeyDown,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._window,
        type: 'touchstart',
        listener: this._boundTouchStart,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._window,
        type: 'touchmove',
        listener: this._boundTouchMove,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._window,
        type: 'pointerdown',
        listener: this._boundPointerDown,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._window,
        type: 'pointerup',
        listener: this._boundPointerUp,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._window,
        type: 'pointercancel',
        listener: this._boundPointerCancel,
        addOptions: { capture: true, passive: true },
        removeOptions: { capture: true },
      },
      {
        target: this._document,
        type: 'click',
        listener: this._boundClick,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'focusin',
        listener: this._boundFocusIn,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'input',
        listener: this._boundInput,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'selectionchange',
        listener: this._boundSelectionChange,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'play',
        listener: this._boundMediaPlay,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'pause',
        listener: this._boundMediaPause,
        addOptions: true,
        removeOptions: true,
      },
      {
        target: this._document,
        type: 'visibilitychange',
        listener: this._boundVisibility,
        addOptions: true,
        removeOptions: true,
      },
    ];
  }

  _startMutationSubscription() {
    if (typeof MutationObserver !== 'function' || typeof this._onMutation !== 'function') return;
    this._mutationUnsub = observerHub.subscribe(({
      mutations = [],
      addedNodes = [],
    } = {}) => {
      if (!this._active || this._document.visibilityState !== 'visible') return;
      this.sampleEditorObservation();
      this._onMutation({
        ts: Date.now(),
        mutations,
        addedNodes: addedNodes.length,
      });
    }, {
      childList: true,
      subtree: true,
      debugLabel: 'FeedInputCapture.observer',
    });
  }

  _stopInternal() {
    const errors = [];
    this._active = false;
    try { this._editorObservation.stop(performance.now()); } catch (error) { errors.push(error); }

    if (typeof this._wheelUnsub === 'function') {
      const unsubscribe = this._wheelUnsub;
      this._wheelUnsub = null;
      try {
        unsubscribe();
      } catch (error) {
        errors.push(error);
      }
    }

    this._getListenerBindings().forEach((binding) => {
      try {
        binding.target.removeEventListener(binding.type, binding.listener, binding.removeOptions);
      } catch (error) {
        errors.push(error);
      }
    });

    if (typeof this._mutationUnsub === 'function') {
      const unsubscribe = this._mutationUnsub;
      this._mutationUnsub = null;
      try {
        unsubscribe();
      } catch (error) {
        errors.push(error);
      }
    }
    this._resetContinuity(false);
    return errors.length > 0
      ? createLifecycleError('FEED_INPUT_CAPTURE_STOP_FAILED', errors)
      : null;
  }

  _emitIntent(intent) {
    if (!this._active || this._document.visibilityState !== 'visible') return false;
    return runFeedFlowOwnerWork(
      'advance_intent',
      intent?.kind || 'unknown',
      () => this._onAdvanceIntent?.(intent),
    );
  }

  _emitActivity(activity) {
    if (!this._active || this._document.visibilityState !== 'visible') return false;
    return runFeedFlowOwnerWork(
      'activity',
      activity?.kind || 'unknown',
      () => this._onActivity?.(activity),
    );
  }

  _handleWheel(event) {
    const deltaY = Number(event?.deltaY);
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const sourceElement = event?.target instanceof Element ? event.target : null;
    const sourceScroller = resolveScrollContainer({
      sourceElement,
      eventTarget: event?.target,
      deltaY,
      documentRef: this._document,
    });

    this._emitIntent(buildIntent({
      kind: 'wheel',
      ts: Date.now(),
      direction: deltaY > 0 ? 'forward' : 'backward',
      deltaY,
      pointerType: 'mouse',
      targetPath: buildTargetPath(event),
      sourceElement,
      sourceScroller,
    }));
  }

  _handleScroll(event) {
    if (!this._active) return;
    const sourceElement = event?.target instanceof Element ? event.target : null;
    const sourceScroller = resolveObservedScrollContainer(event?.target, this._document);
    if (!sourceScroller) return;
    const nextPosition = readScrollerPosition(sourceScroller, this._window, this._document);
    const writeState = readProgrammaticScrollWriteState(sourceScroller, this._document);
    this._onScrollObservation?.({
      sequence: ++this._scrollObservationSequence,
      scroller: sourceScroller,
      position: nextPosition,
      source: 'unknown',
    });
    if (this._document.visibilityState !== 'visible') {
      this._resetContinuity(false);
      return;
    }
    const rootScroller = isRootLikeScroller(sourceScroller, this._document);
    const lastPosition = rootScroller
      ? this._rootScrollPosition
      : this._scrollPositionByElement.get(sourceScroller);
    const lastWriteRevision = rootScroller
      ? this._rootScrollWriteRevision
      : this._scrollWriteRevisionByElement.get(sourceScroller);

    if (rootScroller) {
      this._rootScrollPosition = nextPosition;
      this._rootScrollWriteRevision = writeState.adjustmentRevision;
    } else {
      this._scrollPositionByElement.set(sourceScroller, nextPosition);
      this._scrollWriteRevisionByElement.set(sourceScroller, writeState.adjustmentRevision);
    }
    // The interval may mix an effect adjustment and native movement. Rebase instead of
    // subtracting guessed pixels or calling the remaining movement user input.
    if (writeState.adjustmentInProgress || lastWriteRevision !== writeState.adjustmentRevision) return;
    // The first event from an unknown container establishes a position, not
    // movement from an invented zero. The live sensor owns its separate sample.
    if (lastPosition === null || lastPosition === undefined) return;
    const deltaY = nextPosition - lastPosition;
    if (!deltaY) return;

    this._emitIntent(buildIntent({
      kind: 'scroll',
      ts: Date.now(),
      direction: deltaY > 0 ? 'forward' : 'backward',
      deltaY,
      targetPath: buildTargetPath(event),
      sourceElement,
      sourceScroller,
    }));
  }

  _handleKeyDown(event) {
    if (isTextEntryKeyboardEvent(event)) return;
    const isShiftSpace = (event.key === ' ' || event.key === 'Spacebar') && event.shiftKey;

    if (FORWARD_KEYS.has(event.key) && !isShiftSpace) {
      const sourceElement = event?.target instanceof Element ? event.target : null;
      this._emitIntent(buildIntent({
        kind: 'keydown',
        ts: Date.now(),
        direction: 'forward',
        deltaY: 1,
        key: event.key,
        targetPath: buildTargetPath(event),
        sourceElement,
        sourceScroller: resolveScrollContainer({
          sourceElement,
          eventTarget: event?.target,
          deltaY: 1,
          documentRef: this._document,
        }),
      }));
      return;
    }

    if (BACKWARD_KEYS.has(event.key) || isShiftSpace) {
      const sourceElement = event?.target instanceof Element ? event.target : null;
      this._emitIntent(buildIntent({
        kind: 'keydown',
        ts: Date.now(),
        direction: 'backward',
        deltaY: -1,
        key: event.key,
        targetPath: buildTargetPath(event),
        sourceElement,
        sourceScroller: resolveScrollContainer({
          sourceElement,
          eventTarget: event?.target,
          deltaY: -1,
          documentRef: this._document,
        }),
      }));
    }
  }

  _handleTouchStart(event) {
    const touch = event?.touches?.[0];
    this._touchStartY = touch ? touch.clientY : null;
  }

  _handleTouchMove(event) {
    const touch = event?.touches?.[0];
    if (!touch || !Number.isFinite(this._touchStartY)) {
      this._touchStartY = touch ? touch.clientY : null;
      return;
    }
    const deltaY = this._touchStartY - touch.clientY;
    this._touchStartY = touch.clientY;
    if (!deltaY) return;
    if (this._activePointer?.pointerType === 'touch') {
      this._activePointer.advanceEmitted = true;
    }
    const sourceElement = event?.target instanceof Element ? event.target : null;

    this._emitIntent(buildIntent({
      kind: 'touch',
      ts: Date.now(),
      direction: deltaY > 0 ? 'forward' : 'backward',
      deltaY,
      pointerType: 'touch',
      targetPath: buildTargetPath(event),
      sourceElement,
      sourceScroller: resolveScrollContainer({
        sourceElement,
        eventTarget: event?.target,
        deltaY,
        documentRef: this._document,
      }),
    }));
  }

  _handlePointerDown(event) {
    if (event?.isPrimary === false) return;
    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientY)) {
      this._activePointer = null;
      return;
    }
    const sourceElement = event?.target instanceof Element ? event.target : null;
    this._activePointer = {
      pointerId: Number.isFinite(Number(event?.pointerId)) ? Number(event.pointerId) : null,
      pointerType: event?.pointerType || null,
      startY: clientY,
      sourceElement,
      targetPath: buildTargetPath(event),
      advanceEmitted: false,
    };
  }

  _handlePointerUp(event) {
    const pointer = this._activePointer;
    if (!pointer) return;
    const pointerId = Number.isFinite(Number(event?.pointerId)) ? Number(event.pointerId) : null;
    if (
      pointer.pointerId !== null
      && pointerId !== null
      && pointer.pointerId !== pointerId
    ) return;
    this._activePointer = null;
    if (pointer.advanceEmitted) return;

    const clientY = Number(event?.clientY);
    if (!Number.isFinite(clientY)) return;
    const deltaY = pointer.startY - clientY;
    if (Math.abs(deltaY) < MIN_POINTER_TRAVEL_PX) return;
    const sourceElement = event?.target instanceof Element
      ? event.target
      : pointer.sourceElement;
    const targetPath = buildTargetPath(event);
    this._emitIntent(buildIntent({
      kind: 'pointer',
      ts: Date.now(),
      direction: deltaY > 0 ? 'forward' : 'backward',
      deltaY,
      pointerType: event?.pointerType || pointer.pointerType,
      targetPath: targetPath.length > 0 ? targetPath : pointer.targetPath,
      sourceElement,
      sourceScroller: resolveScrollContainer({
        sourceElement,
        eventTarget: event?.target,
        deltaY,
        documentRef: this._document,
      }),
    }));
  }

  _handlePointerCancel(event) {
    const pointer = this._activePointer;
    if (!pointer) return;
    const pointerId = Number.isFinite(Number(event?.pointerId)) ? Number(event.pointerId) : null;
    if (
      pointer.pointerId !== null
      && pointerId !== null
      && pointer.pointerId !== pointerId
    ) return;
    this._activePointer = null;
  }

  _handleClick(event) {
    const sourceElement = event?.target instanceof Element ? event.target : null;
    if (!sourceElement) return;

    this._emitActivity(buildActivity({
      kind: 'click',
      ts: Date.now(),
      targetPath: buildTargetPath(event),
      sourceElement,
      isEditable: isEditableTarget(sourceElement),
      isInteractive: isInteractiveTarget(sourceElement, this._onRuntimeFailure),
      isNavigationLike: isNavigationLikeTarget(sourceElement, this._onRuntimeFailure),
    }));
  }

  _handleFocusIn(event) {
    this.sampleEditorObservation();
    const sourceElement = event?.target instanceof Element ? event.target : null;
    if (!sourceElement) return;

    const isEditable = isEditableTarget(sourceElement);
    const isInteractive = isInteractiveTarget(sourceElement, this._onRuntimeFailure);
    if (!isEditable && !isInteractive) return;

    this._emitActivity(buildActivity({
      kind: 'focus',
      ts: Date.now(),
      targetPath: buildTargetPath(event),
      sourceElement,
      isEditable,
      isInteractive,
      isNavigationLike: isNavigationLikeTarget(sourceElement, this._onRuntimeFailure),
    }));
  }

  _handleInput(event) {
    if (this._active && this._editorObservation.enabled && isObservedEditorInput(event)) {
      this.sampleEditorObservation();
      this._editorObservation.recordInput(performance.now());
    }
    const sourceElement = event?.target instanceof Element ? event.target : null;
    if (!sourceElement || !isEditableTarget(sourceElement)) return;

    this._emitActivity(buildActivity({
      kind: 'input',
      ts: Date.now(),
      targetPath: buildTargetPath(event),
      sourceElement,
      isEditable: true,
      isInteractive: true,
      isNavigationLike: false,
    }));
  }

  _handleSelectionChange() {
    const selection = this._window?.getSelection?.();
    const text = selection?.toString?.() || '';
    if (!text.trim()) return;

    const sourceElement = this._document?.activeElement instanceof Element
      ? this._document.activeElement
      : (selection?.anchorNode?.parentElement || null);

    this._emitActivity(buildActivity({
      kind: 'selection',
      ts: Date.now(),
      targetPath: buildElementPath(sourceElement),
      sourceElement,
      isEditable: isEditableTarget(sourceElement),
      isInteractive: isInteractiveTarget(sourceElement, this._onRuntimeFailure),
      isNavigationLike: false,
    }));
  }

  _handleMediaEvent(event, kind) {
    const sourceElement = event?.target instanceof Element ? event.target : null;
    if (!sourceElement) return;

    this._emitActivity(buildActivity({
      kind,
      ts: Date.now(),
      targetPath: buildTargetPath(event),
      sourceElement,
      isEditable: false,
      isInteractive: false,
      isNavigationLike: false,
    }));
  }

  _handleVisibilityChange() {
    if (!this._active) return;
    this.sampleEditorObservation();
    this._resetContinuity(this._document.visibilityState === 'visible');
    this._onVisibilityChange?.({
      ts: Date.now(),
      visibilityState: this._document?.visibilityState || 'visible',
    });
  }

  _resetContinuity(seedRoot) {
    this._touchStartY = null;
    this._activePointer = null;
    this._scrollPositionByElement = new WeakMap();
    this._scrollWriteRevisionByElement = new WeakMap();
    this._rootScrollWriteRevision = seedRoot
      ? readProgrammaticScrollWriteState(getRootScroller(this._document), this._document).adjustmentRevision
      : null;
    this._rootScrollPosition = seedRoot
      ? readScrollerPosition(getRootScroller(this._document), this._window, this._document)
      : null;
  }
}

export default FeedInputCapture;
