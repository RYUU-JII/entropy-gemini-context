import { ROOT_ATTRS, removeRootAttribute, setRootAttribute } from './core/index.js';
import {
  applyInlineStyles,
  removeAttribute,
  setAttribute,
} from './visual/FastStyleEngine.js';
import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  advanceInkBrushSession,
  clearInkBrushSession,
  commitInkBrushPoint,
  createInkBrushSession,
  INK_BRUSH_PHASES,
  liftInkBrushSession,
  observeInkBrushInput,
  setInkBrushCompositionActive,
} from './input-visual-brake/InkBrushSession.js';
import {
  createInkBrushCanvasRenderer,
  disposeInkBrushCanvasRenderer,
  renderInkBrushFrame,
  resizeInkBrushCanvas,
} from './input-visual-brake/InkBrushCanvasRenderer.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
} from '@runtime-contention-ledger';

const DISALLOWED_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'submit',
  'button',
  'image',
  'reset',
  'hidden',
]);

const PRECISE_CARET_INPUT_TYPES = new Set(['text', 'search']);
const ACTIVE_BRUSH_FRAME_INTERVAL_MS = 15;
const SETTLED_BRUSH_FRAME_INTERVAL_MS = 32;
const REDUCED_MOTION_FRAME_INTERVAL_MS = 48;

function runInputVisualBrakeOwnerWork(phase, source, work) {
  if (!isRuntimeContentionSessionActive()) return work();
  const startedAt = performance.now();
  try {
    return work();
  } finally {
    recordRuntimeOwnerWork({
      ownerId: 'inputVisualBrake',
      phase,
      source,
      units: 1,
      startedAt,
      endedAt: performance.now(),
    });
  }
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function parsePx(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value || ''));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getInputVisualBrakeErrorMessage(error, fallback = 'INPUT_VISUAL_BRAKE_FAILURE') {
  return String(error?.message || error || fallback);
}

function describeInputVisualElement(el) {
  if (el instanceof Element) return String(el.tagName || '').toLowerCase() || 'element';
  return 'unknown';
}

function reportInputVisualBrakeFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getInputVisualBrakeErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('inputVisualBrake', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[InputVisualBrakeManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createInputVisualBrakeLifecycleError(message, errors) {
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

function isTextInputSurface(el) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (!(el instanceof HTMLInputElement)) return false;
  const type = String(el.type || 'text').toLowerCase();
  if (DISALLOWED_INPUT_TYPES.has(type)) return false;
  return !el.readOnly && !el.disabled;
}

function isSensitiveInputSurface(el) {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  const type = el instanceof HTMLInputElement ? String(el.type || 'text').toLowerCase() : '';
  if (type === 'password' || type === 'email' || type === 'tel') return true;
  const autocompleteTokens = String(el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
  return autocompleteTokens.some((token) => token.includes('password')
    || token === 'one-time-code'
    || token === 'username'
    || token === 'email'
    || token === 'tel'
    || token.startsWith('tel-')
    || token.startsWith('cc-'));
}

function supportsPreciseCaretPlacement(el) {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return PRECISE_CARET_INPUT_TYPES.has(String(el.type || 'text').toLowerCase());
}

function isCompositionInputType(inputType) {
  return typeof inputType === 'string' && inputType.toLowerCase().includes('composition');
}

function getComputedStyleSafe(el) {
  try {
    return getComputedStyle(el);
  } catch (error) {
    reportInputVisualBrakeFailure('style_read', error, {
      tagName: describeInputVisualElement(el),
    });
    return null;
  }
}

function measureAverageGlyphWidth(el, cs = null) {
  const fontSize = parsePx(cs?.fontSize, 16);
  const fallback = Math.max(8, fontSize * 0.78);
  const root = document.documentElement || document.body;
  if (!root) return fallback;

  let probe = null;
  try {
    probe = document.createElement('span');
    probe.textContent = '가나다abc123';
    applyInlineStyles(probe, {
      position: 'fixed',
      left: '-9999px',
      top: '-9999px',
      visibility: 'hidden',
      whiteSpace: 'pre',
      font: cs?.font || '',
      letterSpacing: cs?.letterSpacing || '',
      pointerEvents: 'none',
    });
    root.appendChild(probe);
    const width = probe.getBoundingClientRect?.().width || 0;
    return width > 0 ? Math.max(8, width / 9) : fallback;
  } catch (error) {
    reportInputVisualBrakeFailure('glyph_measure', error, {
      tagName: describeInputVisualElement(el),
    });
    return fallback;
  } finally {
    try {
      probe?.remove?.();
    } catch (error) {
      reportInputVisualBrakeFailure('glyph_probe_cleanup', error, {
        tagName: describeInputVisualElement(el),
      });
    }
  }
}

function createOverlayElement() {
  const overlay = document.createElement('div');
  overlay.className = 'friction-input-ink-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  applyInlineStyles(overlay, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483647',
    overflow: 'hidden',
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
  });

  const canvas = document.createElement('canvas');
  canvas.className = 'friction-input-ink-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  applyInlineStyles(canvas, {
    position: 'absolute',
    inset: '0',
    display: 'block',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });
  overlay.appendChild(canvas);

  (document.documentElement || document.body).appendChild(overlay);
  return { overlay, canvas };
}

function readOverlayMetrics(el) {
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyleSafe(el);
  const fontSize = parsePx(cs?.fontSize, 16);
  return {
    rect,
    direction: cs?.direction || 'ltr',
    borderRadius: cs?.borderRadius || '4px',
    boxSizing: cs?.boxSizing || 'border-box',
    cssWidth: cs?.width || `${Math.max(1, rect?.width || 1)}px`,
    cssHeight: cs?.height || `${Math.max(1, rect?.height || 1)}px`,
    overflowX: cs?.overflowX || 'hidden',
    overflowY: cs?.overflowY || 'hidden',
    borderTopWidth: cs?.borderTopWidth || '0px',
    borderRightWidth: cs?.borderRightWidth || '0px',
    borderBottomWidth: cs?.borderBottomWidth || '0px',
    borderLeftWidth: cs?.borderLeftWidth || '0px',
    borderStyle: cs?.borderStyle || 'solid',
    font: cs?.font || '',
    fontStyle: cs?.fontStyle || 'normal',
    fontVariant: cs?.fontVariant || 'normal',
    fontWeight: cs?.fontWeight || '400',
    fontStretch: cs?.fontStretch || 'normal',
    fontSize,
    fontSizeCss: cs?.fontSize || `${fontSize}px`,
    fontFamily: cs?.fontFamily || 'sans-serif',
    letterSpacing: cs?.letterSpacing || '',
    wordSpacing: cs?.wordSpacing || '',
    textAlign: cs?.textAlign || 'start',
    textTransform: cs?.textTransform || 'none',
    textIndent: cs?.textIndent || '0px',
    textDecoration: cs?.textDecoration || 'none',
    whiteSpace: cs?.whiteSpace || '',
    overflowWrap: cs?.overflowWrap || 'break-word',
    wordBreak: cs?.wordBreak || 'normal',
    tabSize: cs?.tabSize || '8',
    paddingLeft: parsePx(cs?.paddingLeft, 0),
    paddingRight: parsePx(cs?.paddingRight, 0),
    paddingTop: parsePx(cs?.paddingTop, 0),
    paddingBottom: parsePx(cs?.paddingBottom, 0),
    lineHeight: parsePx(cs?.lineHeight, 20),
    lineHeightCss: cs?.lineHeight || 'normal',
    scrollLeft: Number.isFinite(el?.scrollLeft) ? el.scrollLeft : 0,
    scrollTop: Number.isFinite(el?.scrollTop) ? el.scrollTop : 0,
  };
}

function readCaretIndex(el) {
  try {
    const rawStart = el.selectionStart;
    const rawEnd = el.selectionEnd;
    const selectionDirection = el.selectionDirection;
    const start = typeof rawStart === 'number' ? rawStart : null;
    const end = typeof rawEnd === 'number' ? rawEnd : null;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return selectionDirection === 'backward' ? start : end;
    }
    if (Number.isFinite(start)) return start;
    if (Number.isFinite(end)) return end;
  } catch (error) {
    reportInputVisualBrakeFailure('caret_metadata', error, {
      tagName: describeInputVisualElement(el),
    });
    return null;
  }
  return null;
}

function createCaretMirror(overlay) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('data-friction-input-caret-mirror', '1');
  applyInlineStyles(host, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    width: '1px',
    height: '1px',
    visibility: 'hidden',
    pointerEvents: 'none',
    overflow: 'visible',
    contain: 'layout style paint',
  });

  const shadowRoot = host.attachShadow({ mode: 'closed' });
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  applyInlineStyles(marker, {
    position: 'relative',
    padding: '0',
    margin: '0',
    border: '0',
  });
  shadowRoot.appendChild(mirror);
  overlay.appendChild(host);
  return { host, mirror, marker };
}

function ensureCaretMirror(state) {
  if (!state || state.isSensitive || !supportsPreciseCaretPlacement(state.el)) return null;
  if (state.caretMirror) return state.caretMirror;
  if (state.preciseCaretUnavailable) return null;
  try {
    state.caretMirror = createCaretMirror(state.overlay);
    return state.caretMirror;
  } catch (error) {
    state.preciseCaretUnavailable = true;
    reportInputVisualBrakeFailure('caret_mirror_create', error, {
      tagName: describeInputVisualElement(state.el),
    });
    return null;
  }
}

function refreshInputSurfaceSensitivity(state) {
  const wasSensitive = state.isSensitive;
  // Pages can reuse a focused field for credentials or payment entry. This
  // admission check reads only current element metadata, never its contents.
  state.isSensitive = isSensitiveInputSurface(state.el);
  if (state.caretMirror && (state.isSensitive || !supportsPreciseCaretPlacement(state.el))) {
    try {
      state.caretMirror.marker.textContent = '';
      state.caretMirror.mirror.textContent = '';
      state.caretMirror.host.remove();
      state.caretMirror = null;
    } catch (error) {
      reportInputVisualBrakeFailure('caret_mirror_cleanup', error, {
        tagName: describeInputVisualElement(state.el),
      });
      throw error;
    }
  }
  if (state.isSensitive === wasSensitive) return;
  if (state.isSensitive) {
    setAttribute(state.overlay, 'data-friction-input-ink-sensitive', '1');
  } else {
    removeAttribute(state.overlay, 'data-friction-input-ink-sensitive');
  }
}

function applyCaretMirrorStyles(mirror, metrics, isSingleLine) {
  applyInlineStyles(mirror, {
    position: 'relative',
    display: 'block',
    boxSizing: metrics.boxSizing,
    width: metrics.cssWidth,
    height: metrics.cssHeight,
    overflowX: metrics.overflowX,
    overflowY: metrics.overflowY,
    borderTopWidth: metrics.borderTopWidth,
    borderRightWidth: metrics.borderRightWidth,
    borderBottomWidth: metrics.borderBottomWidth,
    borderLeftWidth: metrics.borderLeftWidth,
    borderStyle: metrics.borderStyle,
    paddingTop: `${metrics.paddingTop}px`,
    paddingRight: `${metrics.paddingRight}px`,
    paddingBottom: `${metrics.paddingBottom}px`,
    paddingLeft: `${metrics.paddingLeft}px`,
    fontStyle: metrics.fontStyle,
    fontVariant: metrics.fontVariant,
    fontWeight: metrics.fontWeight,
    fontStretch: metrics.fontStretch,
    fontSize: metrics.fontSizeCss,
    lineHeight: metrics.lineHeightCss,
    fontFamily: metrics.fontFamily,
    textAlign: metrics.textAlign,
    textTransform: metrics.textTransform,
    textIndent: metrics.textIndent,
    textDecoration: metrics.textDecoration,
    letterSpacing: metrics.letterSpacing,
    wordSpacing: metrics.wordSpacing,
    tabSize: metrics.tabSize,
    direction: metrics.direction,
    whiteSpace: isSingleLine ? 'pre' : (metrics.whiteSpace || 'pre-wrap'),
    overflowWrap: isSingleLine ? 'normal' : metrics.overflowWrap,
    wordBreak: isSingleLine ? 'normal' : metrics.wordBreak,
  });
}

function measurePreciseCaretPoint(state, metrics, caretIndex) {
  if (!Number.isFinite(caretIndex)) return null;
  const caretMirror = ensureCaretMirror(state);
  if (!caretMirror) return null;

  // Native text controls expose a selection index but no caret rectangle. Read
  // once into the closed local mirror, then erase all mirrored text in finally.
  let value = '';
  try {
    const rawValue = state.el.value;
    value = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
  } catch (error) {
    reportInputVisualBrakeFailure('caret_value_read', error, {
      tagName: describeInputVisualElement(state.el),
    });
    return null;
  }

  const { mirror, marker } = caretMirror;
  try {
    const resolvedIndex = Math.max(0, Math.min(value.length, Math.floor(caretIndex)));
    const isSingleLine = state.el instanceof HTMLInputElement;
    const normalizeSingleLineWhitespace = (text) => (
      isSingleLine ? text.replace(/\s/g, '\u00a0') : text
    );
    const textBefore = normalizeSingleLineWhitespace(value.slice(0, resolvedIndex));
    const textAfter = normalizeSingleLineWhitespace(value.slice(resolvedIndex));

    applyCaretMirrorStyles(mirror, metrics, isSingleLine);
    mirror.textContent = textBefore;
    marker.textContent = textAfter || '\u200b';
    mirror.appendChild(marker);

    const markerLeft = Number(marker.offsetLeft);
    const markerTop = Number(marker.offsetTop);
    if (!Number.isFinite(markerLeft) || !Number.isFinite(markerTop)) {
      throw new Error('INPUT_VISUAL_BRAKE_CARET_MIRROR_OFFSET_INVALID');
    }

    return {
      x: markerLeft + parsePx(metrics.borderLeftWidth, 0) - metrics.scrollLeft,
      y: markerTop + parsePx(metrics.borderTopWidth, 0) - metrics.scrollTop
        + Math.max(12, metrics.lineHeight || metrics.fontSize * 1.24 || 20) * 0.55,
    };
  } catch (error) {
    reportInputVisualBrakeFailure('caret_mirror_measure', error, {
      tagName: describeInputVisualElement(state.el),
    });
    return null;
  } finally {
    value = '';
    marker.textContent = '';
    mirror.textContent = '';
  }
}

const InputVisualBrakeManager = {
  active: false,
  boundFocusIn: null,
  boundFocusOut: null,
  boundInput: null,
  boundCompositionStart: null,
  boundCompositionEnd: null,
  boundViewportChange: null,
  rafPending: false,
  tracked: new Set(),
  stateByEl: new WeakMap(),

  apply() {
    if (this.active) {
      recordProtectionFeatureEvent('inputVisualBrake', 'manager_apply', {
        alreadyActive: true,
      });
      return;
    }

    try {
      setRootAttribute(ROOT_ATTRS.INPUT_VISUAL_BRAKE, '1');

      this.boundFocusIn = this.handleFocusIn.bind(this);
      this.boundFocusOut = this.handleFocusOut.bind(this);
      this.boundInput = this.handleInput.bind(this);
      this.boundCompositionStart = this.handleCompositionStart.bind(this);
      this.boundCompositionEnd = this.handleCompositionEnd.bind(this);
      this.boundViewportChange = this.scheduleOverlayPositionRefresh.bind(this);

      this.attachRuntimeListeners();
      this.active = true;
      recordProtectionFeatureEvent('inputVisualBrake', 'manager_apply', {
        alreadyActive: false,
      });
    } catch (error) {
      reportInputVisualBrakeFailure('manager_apply', error);
      try {
        this.rollbackFailedApply();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  },

  remove() {
    if (!this.active) return;

    try {
      const errors = [];
      try {
        this.detachRuntimeListeners();
      } catch (error) {
        errors.push(...(error?.errors || [error]));
      }
      this.rafPending = false;

      for (const el of Array.from(this.tracked)) {
        try {
          this.cleanupElement(el);
        } catch (error) {
          errors.push(...(error?.errors || [error]));
        }
      }
      if (errors.length > 0) {
        throw createInputVisualBrakeLifecycleError('INPUT_VISUAL_BRAKE_MANAGER_REMOVE_FAILED', errors);
      }
      this.tracked.clear();
      this.stateByEl = new WeakMap();

      removeRootAttribute(ROOT_ATTRS.INPUT_VISUAL_BRAKE);
      this.clearRuntimeBindings();
      this.active = false;
      recordProtectionFeatureEvent('inputVisualBrake', 'manager_remove');
    } catch (error) {
      const removeError = createInputVisualBrakeLifecycleError(
        'INPUT_VISUAL_BRAKE_MANAGER_REMOVE_FAILED',
        error?.errors || [error]
      );
      reportInputVisualBrakeFailure('manager_remove', removeError);
      throw removeError;
    }
  },

  runtimeListenerEntries() {
    return [
      { target: document, type: 'focusin', handler: this.boundFocusIn, options: true },
      { target: document, type: 'focusout', handler: this.boundFocusOut, options: true },
      { target: document, type: 'input', handler: this.boundInput, options: true },
      { target: document, type: 'compositionstart', handler: this.boundCompositionStart, options: true },
      { target: document, type: 'compositionend', handler: this.boundCompositionEnd, options: true },
      { target: window, type: 'scroll', handler: this.boundViewportChange, options: true },
      { target: window, type: 'resize', handler: this.boundViewportChange, options: true },
    ];
  },

  attachRuntimeListeners() {
    const errors = [];
    for (const entry of this.runtimeListenerEntries()) {
      if (!entry.target || !entry.handler) continue;
      try {
        entry.target.addEventListener?.(entry.type, entry.handler, entry.options);
      } catch (error) {
        errors.push(error);
        reportInputVisualBrakeFailure('listener_attach', error, { eventType: entry.type });
        break;
      }
    }
    if (errors.length > 0) {
      throw createInputVisualBrakeLifecycleError('INPUT_VISUAL_BRAKE_LISTENER_ATTACH_FAILED', errors);
    }
  },

  detachRuntimeListeners() {
    const errors = [];
    for (const entry of this.runtimeListenerEntries()) {
      if (!entry.target || !entry.handler) continue;
      try {
        entry.target.removeEventListener?.(entry.type, entry.handler, entry.options);
      } catch (error) {
        errors.push(error);
        reportInputVisualBrakeFailure('listener_detach', error, { eventType: entry.type });
      }
    }
    if (errors.length > 0) {
      throw createInputVisualBrakeLifecycleError('INPUT_VISUAL_BRAKE_LISTENER_DETACH_FAILED', errors);
    }
  },

  clearRuntimeBindings() {
    this.boundFocusIn = null;
    this.boundFocusOut = null;
    this.boundInput = null;
    this.boundCompositionStart = null;
    this.boundCompositionEnd = null;
    this.boundViewportChange = null;
  },

  rollbackFailedApply() {
    const errors = [];
    try {
      this.detachRuntimeListeners();
    } catch (error) {
      errors.push(...(error?.errors || [error]));
    }
    try {
      removeRootAttribute(ROOT_ATTRS.INPUT_VISUAL_BRAKE);
    } catch (error) {
      errors.push(error);
      reportInputVisualBrakeFailure('root_marker_cleanup', error);
    }
    this.clearRuntimeBindings();
    this.rafPending = false;
    this.active = false;
    if (errors.length > 0) {
      throw createInputVisualBrakeLifecycleError(
        'INPUT_VISUAL_BRAKE_MANAGER_APPLY_ROLLBACK_FAILED',
        errors
      );
    }
  },

  ensureElementState(el) {
    const existing = this.stateByEl.get(el);
    if (existing) {
      if (existing.cleanupPending) {
        this.cleanupElement(el);
      } else {
        refreshInputSurfaceSensitivity(existing);
        return existing;
      }
    }

    const { overlay, canvas } = createOverlayElement();
    let renderer = null;
    try {
      renderer = createInkBrushCanvasRenderer(canvas);
    } catch (error) {
      overlay.remove?.();
      reportInputVisualBrakeFailure('canvas_renderer_create', error, {
        tagName: describeInputVisualElement(el),
      });
      throw error;
    }
    const initialStyle = getComputedStyleSafe(el);
    const isSensitive = isSensitiveInputSurface(el);
    const canMeasurePreciseCaret = !isSensitive && supportsPreciseCaretPlacement(el);
    const fontSize = parsePx(initialStyle?.fontSize, 16);
    const state = {
      el,
      overlay,
      canvas,
      renderer,
      session: createInkBrushSession({
        reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
        now: Date.now(),
      }),
      brushFrameId: null,
      lastBrushRenderAt: null,
      overlayGeometrySignature: null,
      inputCount: 0,
      cursorOffsetPx: 0,
      isSensitive,
      averageGlyphWidth: (isSensitive || canMeasurePreciseCaret)
        ? Math.max(8, fontSize * 0.78)
        : measureAverageGlyphWidth(el, initialStyle),
      caretMirror: null,
      preciseCaretUnavailable: false,
      isComposing: false,
    };
    try {
      ensureCaretMirror(state);
      setAttribute(el, 'data-friction-input-visual-brake', '1');
      if (state.isSensitive) setAttribute(overlay, 'data-friction-input-ink-sensitive', '1');
      this.updateOverlayPosition(state);
    } catch (error) {
      disposeInkBrushCanvasRenderer(renderer);
      overlay.remove?.();
      removeAttribute(el, 'data-friction-input-visual-brake');
      reportInputVisualBrakeFailure('element_state_create', error, {
        tagName: describeInputVisualElement(el),
      });
      throw error;
    }

    this.stateByEl.set(el, state);
    this.tracked.add(el);
    return state;
  },

  cleanupElement(el) {
    const state = this.stateByEl.get(el);
    if (!state) return;
    state.cleanupPending = true;
    const errors = [];
    const clean = (phase, operation) => {
      try {
        operation();
      } catch (error) {
        errors.push(error);
        reportInputVisualBrakeFailure(phase, error, { tagName: describeInputVisualElement(el) });
      }
    };
    clean('brush_frame_cleanup', () => {
      if (state.brushFrameId !== null) cancelAnimationFrame(state.brushFrameId);
      state.brushFrameId = null;
    });
    clean('brush_session_cleanup', () => clearInkBrushSession(state.session));
    clean('canvas_renderer_cleanup', () => disposeInkBrushCanvasRenderer(state.renderer));
    clean('overlay_cleanup', () => {
      if (state.overlay?.parentNode) state.overlay.remove();
    });
    clean('element_cleanup', () => {
      removeAttribute(el, 'data-friction-input-visual-brake');
    });
    if (errors.length > 0) {
      throw createInputVisualBrakeLifecycleError('INPUT_VISUAL_BRAKE_ELEMENT_CLEANUP_FAILED', errors);
    }
    this.stateByEl.delete(el);
    this.tracked.delete(el);
  },

  updateOverlayPosition(state) {
    if (!state?.el?.isConnected || !state.overlay) return;
    const metrics = readOverlayMetrics(state.el);
    const { rect } = metrics;
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      applyInlineStyles(state.overlay, { visibility: 'hidden' });
      state.overlayGeometrySignature = null;
      return;
    }

    const geometrySignature = [
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      metrics.borderRadius,
      metrics.direction,
    ].join('|');
    if (geometrySignature !== state.overlayGeometrySignature) {
      applyInlineStyles(state.overlay, {
        visibility: 'visible',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: metrics.borderRadius,
        direction: metrics.direction,
      });
      state.overlayGeometrySignature = geometrySignature;
    }
    state.metrics = metrics;
    try {
      resizeInkBrushCanvas(state.renderer, {
        width: rect.width,
        height: rect.height,
        dpr: globalThis.devicePixelRatio || 1,
      });
    } catch (error) {
      reportInputVisualBrakeFailure('canvas_resize', error, {
        tagName: describeInputVisualElement(state.el),
      });
      throw error;
    }
  },

  scheduleOverlayPositionRefresh() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      try {
        for (const el of Array.from(this.tracked)) {
          const state = this.stateByEl.get(el);
          if (!el?.isConnected) {
            this.cleanupElement(el);
            continue;
          }
          this.updateOverlayPosition(state);
          if (state?.session?.strokes?.length > 0) this.renderBrushState(state, Date.now());
        }
      } catch (error) {
        reportInputVisualBrakeFailure('overlay_position_frame', error);
      }
    });
  },

  resolveBrushPoint(state, profile) {
    this.updateOverlayPosition(state);
    const metrics = state.metrics || readOverlayMetrics(state.el);
    const { rect } = metrics;
    const width = Math.max(1, rect?.width || 1);
    const height = Math.max(1, rect?.height || 1);
    const innerLeft = Math.min(width - 1, Math.max(0, metrics.paddingLeft || 0));
    const innerRight = Math.max(innerLeft + 1, width - Math.max(0, metrics.paddingRight || 0));
    const innerTop = Math.min(height - 1, Math.max(0, metrics.paddingTop || 0));
    const innerBottom = Math.max(innerTop + 1, height - Math.max(0, metrics.paddingBottom || 0));
    const innerWidth = Math.max(1, innerRight - innerLeft);
    const innerHeight = Math.max(1, innerBottom - innerTop);

    if (state.isSensitive) {
      const lane = state.inputCount % 5;
      return {
        x: clampNumber(width * (0.36 + lane * 0.07), innerLeft, innerRight),
        y: height * 0.5,
        direction: 'ltr',
        glyphWidth: Math.max(8, metrics.fontSize * 0.78 || 12),
        lineHeight: Math.max(12, metrics.lineHeight || metrics.fontSize * 1.24 || 20),
        innerHeight,
        caretSource: 'abstract',
      };
    }

    const caretIndex = readCaretIndex(state.el);
    const glyphWidth = Math.max(8, state.averageGlyphWidth || metrics.fontSize * 0.78 || 12);
    const preciseCaretPoint = measurePreciseCaretPoint(state, metrics, caretIndex);

    if (state.el instanceof HTMLInputElement) {
      const fallbackOffset = (state.cursorOffsetPx + profile.fallbackAdvancePx + innerWidth) % innerWidth;
      state.cursorOffsetPx = fallbackOffset;
      const rawX = Number.isFinite(preciseCaretPoint?.x)
        ? preciseCaretPoint.x
        : (Number.isFinite(caretIndex)
          ? innerLeft + (caretIndex * glyphWidth) - metrics.scrollLeft - glyphWidth * 0.32
          : innerLeft + fallbackOffset);
      const x = metrics.direction === 'rtl' && !Number.isFinite(preciseCaretPoint?.x)
        ? innerRight - (rawX - innerLeft)
        : rawX;
      return {
        x: clampNumber(x, innerLeft + glyphWidth * 0.45, innerRight - glyphWidth * 0.25),
        y: height / 2,
        direction: metrics.direction,
        glyphWidth,
        lineHeight: Math.max(12, metrics.lineHeight || metrics.fontSize * 1.24 || 20),
        innerHeight,
        caretSource: preciseCaretPoint ? 'mirror' : 'estimate',
      };
    }

    const lineHeight = Math.max(12, metrics.lineHeight || 20);
    const columns = Math.max(1, Math.floor(innerWidth / glyphWidth));
    const fallbackOffset = (state.cursorOffsetPx + profile.fallbackAdvancePx + innerWidth) % innerWidth;
    state.cursorOffsetPx = fallbackOffset;
    const rawIndex = Number.isFinite(caretIndex) ? caretIndex : state.inputCount;
    const row = Math.floor(rawIndex / columns);
    const col = rawIndex % columns;
    const rawX = Number.isFinite(preciseCaretPoint?.x)
      ? preciseCaretPoint.x
      : (Number.isFinite(caretIndex)
        ? innerLeft + col * glyphWidth - metrics.scrollLeft
        : innerLeft + fallbackOffset);
    const rawY = Number.isFinite(preciseCaretPoint?.y)
      ? preciseCaretPoint.y
      : innerTop + row * lineHeight - metrics.scrollTop + lineHeight * 0.55;
    return {
      x: clampNumber(rawX, innerLeft + glyphWidth * 0.45, innerRight - glyphWidth * 0.25),
      y: clampNumber(rawY, innerTop + lineHeight * 0.45, innerBottom - lineHeight * 0.2),
      direction: metrics.direction,
      glyphWidth,
      lineHeight,
      innerHeight,
      caretSource: preciseCaretPoint ? 'mirror' : 'estimate',
    };
  },

  renderBrushState(state, now = Date.now()) {
    if (!state?.renderer || !state?.session) return null;
    const frame = advanceInkBrushSession(state.session, now);
    renderInkBrushFrame(state.renderer, frame);
    state.lastBrushRenderAt = now;
    if (frame.live) this.scheduleBrushFrame(state);
    return frame;
  },

  scheduleBrushFrame(state) {
    if (!state?.el?.isConnected || state.brushFrameId !== null) return;
    state.brushFrameId = requestAnimationFrame(() => {
      state.brushFrameId = null;
      if (!this.active || !state.el?.isConnected || state.renderer?.disposed) return;
      try {
        const now = Date.now();
        const intervalMs = state.session.reducedMotion
          ? REDUCED_MOTION_FRAME_INTERVAL_MS
          : (state.session.phase === INK_BRUSH_PHASES.DRAWING
            ? ACTIVE_BRUSH_FRAME_INTERVAL_MS
            : SETTLED_BRUSH_FRAME_INTERVAL_MS);
        if (Number.isFinite(state.lastBrushRenderAt)
          && now - state.lastBrushRenderAt < intervalMs) {
          this.scheduleBrushFrame(state);
          return;
        }
        this.renderBrushState(state, now);
      } catch (error) {
        reportInputVisualBrakeFailure('brush_frame', error, {
          tagName: describeInputVisualElement(state.el),
        });
      }
    });
  },

  pulse(state, inputType = null) {
    if (!state?.el || !state.el.isConnected) return;
    if (state.isComposing) return;
    const now = Date.now();
    const decision = observeInkBrushInput(state.session, { now, inputType });
    let stroke = null;
    let point = null;
    if (decision.admitPoint) {
      const profile = state.session.profile;
      point = this.resolveBrushPoint(state, profile);
      stroke = commitInkBrushPoint(state.session, point, {
        now,
        forceNewStroke: decision.forceNewStroke,
      });
    }
    try {
      this.renderBrushState(state, now);
    } catch (error) {
      reportInputVisualBrakeFailure('brush_input_render', error, {
        tagName: describeInputVisualElement(state.el),
      });
      throw error;
    }
    if (!stroke) return;

    recordProtectionFeatureEvent('inputVisualBrake', 'ink_brush_point', {
      renderer: 'arc_length_ribbon',
      strokeId: stroke.id,
      caretSource: point?.caretSource || 'abstract',
      pressure: Number(decision.pressure?.toFixed?.(3) || 0),
      inputType: inputType || null,
      sensitiveSurface: state.isSensitive === true,
    });
  },

  handleFocusIn(e) {
    if (!this.active) return;
    const target = e.target;
    if (!isTextInputSurface(target)) return;
    this.ensureElementState(target);
  },

  handleFocusOut(e) {
    if (!this.active) return;
    const target = e.target;
    if (!this.stateByEl.has(target)) return;
    this.cleanupElement(target);
  },

  handleInput(e) {
    return runInputVisualBrakeOwnerWork('input_event', e?.inputType || 'input', () => {
      if (!this.active) return;
      const target = e.target;
      if (!isTextInputSurface(target)) return;
      const state = this.ensureElementState(target);
      const inputType = typeof e?.inputType === 'string' ? e.inputType : null;
      if (e?.isComposing === true || isCompositionInputType(inputType)) return;
      state.inputCount += 1;
      this.pulse(state, inputType);
    });
  },

  handleCompositionStart(e) {
    if (!this.active) return;
    const target = e.target;
    if (!isTextInputSurface(target)) return;
    const state = this.ensureElementState(target);
    state.isComposing = true;
    const now = Date.now();
    setInkBrushCompositionActive(state.session, true, now);
    this.renderBrushState(state, now);
  },

  handleCompositionEnd(e) {
    if (!this.active) return;
    const target = e.target;
    if (!isTextInputSurface(target)) return;
    const state = this.ensureElementState(target);
    state.isComposing = false;
    setInkBrushCompositionActive(state.session, false, Date.now());
    state.inputCount += 1;
    this.pulse(state, 'compositionend');
  },
};

export default InputVisualBrakeManager;
