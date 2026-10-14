import { ROOT_ATTRS, removeRootAttribute, setRootAttribute } from './core/index.js';
import {
  applyInlineStyles,
  removeAttribute,
  removeStyleProperty,
  setAttribute,
  setInlineStyle,
  setStyleProperty,
  setText,
} from './visual/FastStyleEngine.js';
import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { getInteractionTargets } from './interaction/interactionTargetProfiles.js';
import {
  isRuntimeContentionSessionActive,
  recordRuntimeOwnerWork,
} from '@runtime-contention-ledger';

const CLIPPED_OVERFLOW = new Set(['auto', 'scroll', 'hidden', 'clip']);
const MAX_VISUAL_QUEUE_LENGTH = 3;
const MAX_VISUAL_LAG_MS = 1600;
const COMPOSITION_DELAY_CLAMP_MS = 40;
const RECENT_COMPOSITION_END_MS = 80;
const INPUT_DELAY_IDLE_RESET_MS = 1400;
const INPUT_DELAY_BURST_COOLDOWN_MIN_MS = 800;
const INPUT_DELAY_BURST_COOLDOWN_MAX_MS = 2200;
const INPUT_DELAY_WARMUP_INPUTS = 1;
const INPUT_DELAY_LEVEL_THREE_MS = 1200;

function runInputDelayOwnerWork(phase, source, work) {
  if (!isRuntimeContentionSessionActive()) return work();
  const startedAt = performance.now();
  try {
    return work();
  } finally {
    recordRuntimeOwnerWork({
      ownerId: 'inputDelay',
      phase,
      source,
      units: 1,
      startedAt,
      endedAt: performance.now(),
    });
  }
}

function isClippedOverflow(value) {
  return CLIPPED_OVERFLOW.has(String(value || '').toLowerCase());
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : min;
  return Math.max(min, Math.min(max, base));
}

function getInputDelayErrorMessage(error, fallback = 'INPUT_DELAY_FAILURE') {
  return String(error?.message || error || fallback);
}

function describeInputDelayElement(el) {
  if (el instanceof Element) return String(el.tagName || '').toLowerCase() || 'element';
  return 'unknown';
}

function reportInputDelayFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getInputDelayErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('inputDelay', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[InputDelayManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createInputDelayLifecycleError(message, errors) {
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

function randInt(a, b) {
  const lo = Math.round(Math.min(a, b));
  const hi = Math.round(Math.max(a, b));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function readElementScroll(el) {
  const scrollLeft = Number(el?.scrollLeft);
  const scrollTop = Number(el?.scrollTop);
  return {
    scrollLeft: Number.isFinite(scrollLeft) ? scrollLeft : 0,
    scrollTop: Number.isFinite(scrollTop) ? scrollTop : 0,
  };
}

function createDelayProfileState() {
  return {
    lastPickAt: 0,
    warmupRemaining: INPUT_DELAY_WARMUP_INPUTS,
    burstRemaining: 0,
    burstUntil: 0,
    cooldownUntil: 0,
  };
}

function isLowRiskImmediateInput(snapshot) {
  const inputType = String(snapshot?.inputType || '').toLowerCase();
  return inputType.includes('delete')
    || inputType.includes('history')
    || inputType.includes('composition')
    || inputType === 'insertlinebreak'
    || inputType === 'insertparagraph'
    || inputType === 'insertfromdrop';
}

function startDelayBurst(profile, max, strength, now) {
  if (strength >= 0.75) {
    profile.burstRemaining = randInt(3, 5);
  } else if (strength >= 0.45) {
    profile.burstRemaining = randInt(2, 4);
  } else {
    profile.burstRemaining = randInt(1, 2);
  }
  profile.burstUntil = now + randInt(520 + max * 0.35, 1100 + max * 0.7);
}

function finishDelayBurst(profile, now, strength = 0) {
  profile.burstRemaining = 0;
  profile.burstUntil = 0;
  const cooldownMin = Math.max(500, Math.round(INPUT_DELAY_BURST_COOLDOWN_MIN_MS - strength * 300));
  const cooldownMax = Math.max(cooldownMin, Math.round(INPUT_DELAY_BURST_COOLDOWN_MAX_MS - strength * 600));
  profile.cooldownUntil = now + randInt(
    cooldownMin,
    cooldownMax,
  );
}

function pickBurstDelay(profile, max, strength, now) {
  profile.burstRemaining = Math.max(0, profile.burstRemaining - 1);
  const floor = Math.max(220, Math.round(max * (0.9 + strength * 0.18)));
  const ceiling = Math.min(
    MAX_VISUAL_LAG_MS,
    Math.max(360, Math.round(max * (1.45 + strength * 0.45))),
  );
  const delay = randInt(floor, Math.max(floor, ceiling));
  if (profile.burstRemaining <= 0) finishDelayBurst(profile, now, strength);
  return delay;
}

function intersectRect(base, clip, clipX, clipY) {
  const left = clipX ? Math.max(base.left, clip.left) : base.left;
  const right = clipX ? Math.min(base.right, clip.right) : base.right;
  const top = clipY ? Math.max(base.top, clip.top) : base.top;
  const bottom = clipY ? Math.min(base.bottom, clip.bottom) : base.bottom;
  return { left, right, top, bottom };
}

function getVisibleRect(el) {
  if (!el || !el.getBoundingClientRect) return null;
  const rect = el.getBoundingClientRect();
  let view = {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
  };

  let current = el.parentElement;
  while (current && current !== document.documentElement && current !== document.body) {
    const style = getComputedStyle(current);
    const clipX = isClippedOverflow(style.overflowX);
    const clipY = isClippedOverflow(style.overflowY);
    if (clipX || clipY) {
      const clipRect = current.getBoundingClientRect();
      view = intersectRect(view, clipRect, clipX, clipY);
      if (view.right <= view.left || view.bottom <= view.top) return null;
    }
    current = current.parentElement;
  }

  const viewport = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  view = intersectRect(view, viewport, true, true);
  if (view.right <= view.left || view.bottom <= view.top) return null;

  return {
    left: view.left,
    top: view.top,
    width: view.right - view.left,
    height: view.bottom - view.top,
  };
}

function getStyleNumber(value) {
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getLineHeightPx(style, rect) {
  const fontSize = parseFloat(style.fontSize);
  const safeFontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16;
  const rawLineHeight = String(style.lineHeight || '').trim().toLowerCase();
  let lineHeight = NaN;
  if (rawLineHeight.endsWith('px')) {
    lineHeight = parseFloat(rawLineHeight);
  } else if (rawLineHeight.endsWith('%')) {
    lineHeight = safeFontSize * (parseFloat(rawLineHeight) / 100);
  } else {
    const numeric = parseFloat(rawLineHeight);
    if (Number.isFinite(numeric) && numeric > 0) {
      lineHeight = numeric <= 8 ? numeric * safeFontSize : numeric;
    }
  }

  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    lineHeight = Math.round(safeFontSize * 1.2);
  }

  const paddingTop = getStyleNumber(style.paddingTop);
  const paddingBottom = getStyleNumber(style.paddingBottom);
  const borderTop = getStyleNumber(style.borderTopWidth);
  const borderBottom = getStyleNumber(style.borderBottomWidth);
  const height = rect.height - paddingTop - paddingBottom - borderTop - borderBottom;
  const maxHeight = height > 0 ? height : rect.height;
  const upper = Math.max(10, maxHeight);
  const lower = Math.min(upper, Math.max(10, safeFontSize * 0.8));
  return clampNumber(lineHeight, lower, upper);
}

function clearQueuedRenderTimer(state) {
  if (!state?.timerId) return;
  clearTimeout(state.timerId);
  state.timerId = null;
  state.running = false;
  state.currentItem = null;
}

function clampSelectionIndex(value, length, fallback = 0) {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(0, Math.min(length, Math.floor(base)));
}

function readSelectionSnapshot(el, value) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  const length = text.length;
  let start = length;
  let end = length;
  let direction = 'none';

  try {
    if (typeof el.selectionStart === 'number') start = el.selectionStart;
    if (typeof el.selectionEnd === 'number') end = el.selectionEnd;
    if (typeof el.selectionDirection === 'string') direction = el.selectionDirection;
  } catch (error) {
    reportInputDelayFailure('selection_snapshot', error, {
      tagName: describeInputDelayElement(el),
    });
  }

  const selectionStart = clampSelectionIndex(start, length, length);
  const selectionEnd = clampSelectionIndex(end, length, selectionStart);
  return {
    selectionStart: Math.min(selectionStart, selectionEnd),
    selectionEnd: Math.max(selectionStart, selectionEnd),
    selectionDirection: direction || 'none',
  };
}

function isCompositionInputType(inputType) {
  return typeof inputType === 'string' && inputType.toLowerCase().includes('composition');
}

function safeClosest(el, selector) {
  if (!(el instanceof Element) || !selector) return null;
  try {
    return el.closest(selector);
  } catch (error) {
    reportInputDelayFailure('selector_match', error, {
      tagName: describeInputDelayElement(el),
      selector: String(selector).slice(0, 160),
    });
    return null;
  }
}

function createInputSnapshot(el, event = null, options = {}) {
  const value = typeof el?.value === 'string' ? el.value : String(el?.value ?? '');
  const inputType = typeof options.inputType === 'string'
    ? options.inputType
    : (typeof event?.inputType === 'string' ? event.inputType : null);
  const isComposing = options.isComposing === true
    || event?.isComposing === true
    || isCompositionInputType(inputType);

  return {
    value,
    ...readSelectionSnapshot(el, value),
    ...readElementScroll(el),
    inputType,
    isComposing,
    capturedAt: Date.now(),
  };
}

function applyDisplayedSnapshot(state, snapshot) {
  if (!state || !snapshot) return;
  state.displayedValue = snapshot.value;
  state.displayedSelectionStart = snapshot.selectionStart;
  state.displayedSelectionEnd = snapshot.selectionEnd;
  state.displayedSelectionDirection = snapshot.selectionDirection;
  state.displayedScrollLeft = snapshot.scrollLeft;
  state.displayedScrollTop = snapshot.scrollTop;
  state.displayedSnapshot = snapshot;
}

function isVisualLagging(state) {
  if (!state?.el) return false;
  return state.el.value !== state.displayedValue || state.running || state.queue.length > 0;
}

const InputDelayManager = {
  active: false,
  maxDelayMs: 0,
  boundInput: null,
  boundFocusIn: null,
  boundFocusOut: null,
  boundKeyDown: null,
  boundScroll: null,
  boundResize: null,
  boundSelectionChange: null,
  boundCompositionStart: null,
  boundCompositionEnd: null,
  rafPending: false,
  activeEl: null,
  tracked: new Set(),
  stateByEl: new WeakMap(),
  delayProfile: createDelayProfileState(),

  apply(value) {
    const maxDelayMs = Number(value) || 0;

    if (maxDelayMs <= 0) {
      this.remove();
      return;
    }

    const previousMaxDelayMs = this.maxDelayMs;
    this.maxDelayMs = maxDelayMs;
    if (previousMaxDelayMs !== maxDelayMs) this.resetDelayProfile();
    if (this.active) {
      recordProtectionFeatureEvent('inputDelay', 'manager_apply', {
        maxDelayMs,
        alreadyActive: true,
      });
      return;
    }

    try {
      setRootAttribute(ROOT_ATTRS.INPUT_DELAY, '1');

      this.boundInput = this.handleInput.bind(this);
      this.boundFocusIn = this.handleFocusIn.bind(this);
      this.boundFocusOut = this.handleFocusOut.bind(this);
      this.boundKeyDown = this.handleKeyDown.bind(this);
      this.boundScroll = this.handleAnyScroll.bind(this);
      this.boundResize = this.scheduleAllOverlaysUpdate.bind(this);
      this.boundSelectionChange = this.handleSelectionChange.bind(this);
      this.boundCompositionStart = this.handleCompositionStart.bind(this);
      this.boundCompositionEnd = this.handleCompositionEnd.bind(this);

      this.attachRuntimeListeners();
      document.fonts?.ready?.then?.(() => {
        if (this.active) this.scheduleAllOverlaysUpdate();
      })?.catch?.((error) => {
        reportInputDelayFailure('font_ready', error);
      });
      this.active = true;
      recordProtectionFeatureEvent('inputDelay', 'manager_apply', {
        maxDelayMs,
        alreadyActive: false,
      });
    } catch (error) {
      reportInputDelayFailure('manager_apply', error, { maxDelayMs });
      try {
        this.rollbackFailedApply();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  },

  remove() {
    if (!this.active) {
      this.maxDelayMs = 0;
      this.resetDelayProfile();
      return;
    }

    try {
      this.detachRuntimeListeners();
      this.activeEl = null;

      for (const el of Array.from(this.tracked)) {
        this.cleanupElement(el);
      }
      this.tracked.clear();
      this.stateByEl = new WeakMap();
      this.resetDelayProfile();

      removeRootAttribute(ROOT_ATTRS.INPUT_DELAY);

      this.clearRuntimeBindings();
      this.maxDelayMs = 0;
      this.active = false;
      recordProtectionFeatureEvent('inputDelay', 'manager_remove');
    } catch (error) {
      const removeError = createInputDelayLifecycleError(
        'INPUT_DELAY_MANAGER_REMOVE_FAILED',
        error?.errors || [error]
      );
      reportInputDelayFailure('manager_remove', removeError);
      throw removeError;
    }
  },

  runtimeListenerEntries() {
    return [
      { target: document, type: 'focusin', handler: this.boundFocusIn, options: true },
      { target: document, type: 'focusout', handler: this.boundFocusOut, options: true },
      { target: document, type: 'keydown', handler: this.boundKeyDown, options: true },
      { target: document, type: 'input', handler: this.boundInput, options: true },
      { target: document, type: 'scroll', handler: this.boundScroll, options: true },
      { target: document, type: 'selectionchange', handler: this.boundSelectionChange, options: true },
      { target: document, type: 'compositionstart', handler: this.boundCompositionStart, options: true },
      { target: document, type: 'compositionend', handler: this.boundCompositionEnd, options: true },
      { target: window, type: 'resize', handler: this.boundResize, options: true },
      { target: window.visualViewport, type: 'resize', handler: this.boundResize, options: true },
      { target: window.visualViewport, type: 'scroll', handler: this.boundResize, options: true },
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
        reportInputDelayFailure('listener_attach', error, { eventType: entry.type });
        break;
      }
    }
    if (errors.length > 0) {
      throw createInputDelayLifecycleError('INPUT_DELAY_LISTENER_ATTACH_FAILED', errors);
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
        reportInputDelayFailure('listener_detach', error, { eventType: entry.type });
      }
    }
    if (errors.length > 0) {
      throw createInputDelayLifecycleError('INPUT_DELAY_LISTENER_DETACH_FAILED', errors);
    }
  },

  clearRuntimeBindings() {
    this.boundInput = null;
    this.boundFocusIn = null;
    this.boundFocusOut = null;
    this.boundKeyDown = null;
    this.boundScroll = null;
    this.boundResize = null;
    this.boundSelectionChange = null;
    this.boundCompositionStart = null;
    this.boundCompositionEnd = null;
  },

  rollbackFailedApply() {
    const errors = [];
    try {
      this.detachRuntimeListeners();
    } catch (error) {
      errors.push(...(error?.errors || [error]));
    }
    try {
      removeRootAttribute(ROOT_ATTRS.INPUT_DELAY);
    } catch (error) {
      errors.push(error);
      reportInputDelayFailure('root_marker_cleanup', error);
    }
    this.clearRuntimeBindings();
    this.activeEl = null;
    this.maxDelayMs = 0;
    this.active = false;
    this.resetDelayProfile();
    if (errors.length > 0) {
      throw createInputDelayLifecycleError('INPUT_DELAY_MANAGER_APPLY_ROLLBACK_FAILED', errors);
    }
  },

  isTextInput(el) {
    if (!el) return false;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (!(el instanceof HTMLInputElement)) return false;
    const disallowedTypes = new Set([
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
      'password',
    ]);
    if (disallowedTypes.has(el.type)) return false;
    return !el.readOnly && !el.disabled;
  },

  isInputDelayBypassTarget(el) {
    if (!(el instanceof Element)) return false;
    const targets = getInteractionTargets(window.location?.hostname);
    return !!safeClosest(el, targets.inputDelayBypassTargets);
  },

  pickDelayMs(snapshot = null) {
    const max = Math.max(0, this.maxDelayMs || 0);
    if (max <= 0) return 0;
    if (isLowRiskImmediateInput(snapshot)) return 0;

    const now = Date.now();
    const profile = this.delayProfile || createDelayProfileState();
    this.delayProfile = profile;

    if (profile.lastPickAt > 0 && now - profile.lastPickAt > INPUT_DELAY_IDLE_RESET_MS) {
      profile.burstRemaining = 0;
      profile.burstUntil = 0;
      profile.warmupRemaining = INPUT_DELAY_WARMUP_INPUTS;
    }
    profile.lastPickAt = now;

    const strength = clampNumber(max / INPUT_DELAY_LEVEL_THREE_MS, 0, 1);
    const isWarmup = profile.warmupRemaining > 0;
    if (profile.warmupRemaining > 0) profile.warmupRemaining -= 1;

    if (profile.burstRemaining > 0 && now <= profile.burstUntil) {
      return pickBurstDelay(profile, max, strength, now);
    }
    if (profile.burstRemaining > 0) finishDelayBurst(profile, now, strength);

    const burstChance = isWarmup ? 0 : 0.05 + strength * 0.17;
    if (now >= profile.cooldownUntil && Math.random() < burstChance) {
      startDelayBurst(profile, max, strength, now);
      return pickBurstDelay(profile, max, strength, now);
    }

    const noDelayChance = clampNumber(0.78 - strength * 0.7, 0.08, 0.62);
    if (Math.random() < noDelayChance) return 0;

    const floor = Math.max(75, Math.round(max * (0.2 + strength * 0.12)));
    const ceiling = Math.max(floor, Math.round(110 + max * (0.36 + strength * 0.18)));
    return randInt(floor, ceiling);
  },

  resetDelayProfile() {
    this.delayProfile = createDelayProfileState();
  },

  ensureElementState(el) {
    const existing = this.stateByEl.get(el);
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.className = 'friction-input-overlay';
    applyInlineStyles(overlay, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      overflow: 'hidden',
      background: 'transparent',
      margin: '0',
      boxSizing: 'border-box',
    });
    const inner = document.createElement('div');
    inner.className = 'friction-input-overlay__inner';
    applyInlineStyles(inner, {
      boxSizing: 'border-box',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: el instanceof HTMLInputElement ? 'center' : 'flex-start',
      justifyContent: 'flex-start',
      overflow: 'hidden',
    });
    const content = document.createElement('div');
    content.className = 'friction-input-overlay__content';
    applyInlineStyles(content, {
      boxSizing: 'border-box',
      minWidth: '100%',
      minHeight: '100%',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      willChange: 'transform',
    });

    if (el instanceof HTMLInputElement) {
      applyInlineStyles(content, {
        display: 'inline-flex',
        alignItems: 'center',
        whiteSpace: 'pre',
        overflow: 'visible',
        width: 'max-content',
      });
    } else {
      applyInlineStyles(content, {
        display: 'block',
        whiteSpace: 'pre-wrap',
      });
    }

    const textBefore = document.createElement('span');
    textBefore.className = 'friction-input-overlay__text friction-input-overlay__text--before';
    applyInlineStyles(textBefore, {
      display: 'inline-block',
      flex: '0 0 auto',
      whiteSpace: 'inherit',
    });
    const caretEl = document.createElement('span');
    caretEl.className = 'friction-input-overlay__caret';
    applyInlineStyles(caretEl, {
      display: 'inline-block',
      width: '1px',
      minWidth: '1px',
      maxWidth: '1px',
      flex: '0 0 1px',
      alignSelf: 'center',
      background: 'var(--friction-overlay-caret, currentColor)',
      pointerEvents: 'none',
    });
    const textAfter = document.createElement('span');
    textAfter.className = 'friction-input-overlay__text friction-input-overlay__text--after';
    applyInlineStyles(textAfter, {
      display: 'inline-block',
      flex: '0 0 auto',
      whiteSpace: 'inherit',
    });

    content.appendChild(textBefore);
    content.appendChild(caretEl);
    content.appendChild(textAfter);
    inner.appendChild(content);
    overlay.appendChild(inner);
    (document.documentElement || document.body).appendChild(overlay);

    let caret = '';
    let placeholderColor = '';
    const snapshot = {
      padding: '',
      font: '',
      letterSpacing: '',
      textAlign: '',
      lineHeight: '',
      color: '',
      textIndent: '',
      direction: '',
      borderTopWidth: '',
      borderRightWidth: '',
      borderBottomWidth: '',
      borderLeftWidth: '',
      borderRadius: '',
    };
    try {
      const cs = getComputedStyle(el);
      caret = cs.caretColor && cs.caretColor !== 'auto' ? cs.caretColor : cs.color;
      snapshot.padding = cs.padding;
      snapshot.font = cs.font;
      snapshot.letterSpacing = cs.letterSpacing;
      snapshot.textAlign = cs.textAlign;
      snapshot.lineHeight = cs.lineHeight;
      snapshot.color = cs.color;
      snapshot.textIndent = cs.textIndent;
      snapshot.direction = cs.direction;
      snapshot.borderTopWidth = cs.borderTopWidth;
      snapshot.borderRightWidth = cs.borderRightWidth;
      snapshot.borderBottomWidth = cs.borderBottomWidth;
      snapshot.borderLeftWidth = cs.borderLeftWidth;
      snapshot.borderRadius = cs.borderRadius;
    } catch (error) {
      reportInputDelayFailure('style_snapshot', error, {
        tagName: describeInputDelayElement(el),
      });
    }

    if (caret) setStyleProperty(el, '--friction-caret-color', caret);
    if (placeholderColor) setStyleProperty(el, '--friction-placeholder-color', placeholderColor);
    setAttribute(el, 'data-friction-input-delay', '1');

    if (caret) setStyleProperty(overlay, '--friction-overlay-caret', caret);

    const initialSnapshot = createInputSnapshot(el);
    const state = {
      el,
      overlay,
      inner,
      content,
      textBefore,
      textAfter,
      caretEl,
      displayedValue: initialSnapshot.value,
      displayedSelectionStart: initialSnapshot.selectionStart,
      displayedSelectionEnd: initialSnapshot.selectionEnd,
      displayedSelectionDirection: initialSnapshot.selectionDirection,
      displayedScrollLeft: initialSnapshot.scrollLeft,
      displayedScrollTop: initialSnapshot.scrollTop,
      displayedSnapshot: initialSnapshot,
      latestSnapshot: initialSnapshot,
      snapshot,
      placeholderColor,
      lastInputValue: initialSnapshot.value,
      lastInputTime: 0,
      isComposing: false,
      lastCompositionEndAt: 0,
      lastCompositionEndValue: '',
      queue: [],
      running: false,
      timerId: null,
      currentItem: null,
      boundElementScroll: null,
      resizeObserver: null,
    };

    state.boundElementScroll = () => this.updateOverlay(state);
    el.addEventListener?.('scroll', state.boundElementScroll, { passive: true });
    if (typeof ResizeObserver === 'function') {
      state.resizeObserver = new ResizeObserver(() => this.updateOverlay(state));
      state.resizeObserver.observe(el);
    }

    this.renderOverlay(state);
    this.stateByEl.set(el, state);
    this.tracked.add(el);
    this.updateOverlay(state);
    return state;
  },

  cleanupElement(el) {
    const st = this.stateByEl.get(el);
    if (!st) return;

    clearQueuedRenderTimer(st);
    st.queue.length = 0;
    st.currentItem = null;

    try {
      st.overlay.remove();
    } catch (error) {
      reportInputDelayFailure('overlay_cleanup', error, {
        tagName: describeInputDelayElement(el),
      });
    }

    try {
      if (st.boundElementScroll) {
        el.removeEventListener?.('scroll', st.boundElementScroll);
      }
      st.resizeObserver?.disconnect?.();
      removeAttribute(el, 'data-friction-input-delay');
      removeStyleProperty(el, '--friction-caret-color');
      removeStyleProperty(el, '--friction-placeholder-color');
    } catch (error) {
      reportInputDelayFailure('element_cleanup', error, {
        tagName: describeInputDelayElement(el),
      });
    }

    this.stateByEl.delete(el);
    this.tracked.delete(el);
  },

  pruneDisconnected() {
    for (const el of Array.from(this.tracked)) {
      if (!el || !el.isConnected) {
        this.cleanupElement(el);
      }
    }
  },

  renderOverlay(state) {
    if (!state || !state.el || !state.content) return;
    const value = typeof state.displayedValue === 'string' ? state.displayedValue : String(state.displayedValue ?? '');

    // Placeholder Logic
    const phText = state.el.getAttribute('placeholder');
    const showPlaceholder = !value && phText;

    if (showPlaceholder) {
      setText(state.textBefore, '');
      setText(state.textAfter, phText);
      applyInlineStyles(state.textAfter, {
        color: state.placeholderColor || 'rgba(0, 0, 0, 0.54)',
      });
      applyInlineStyles(state.textBefore, { color: state.snapshot.color }); // reset
    } else {
      const selectionStart = typeof state.displayedSelectionStart === 'number'
        ? state.displayedSelectionStart
        : (typeof state.el.selectionStart === 'number' ? state.el.selectionStart : value.length);
      const selectionEnd = typeof state.displayedSelectionEnd === 'number'
        ? state.displayedSelectionEnd
        : selectionStart;

      const start = clampSelectionIndex(selectionStart, value.length, value.length);
      const end = clampSelectionIndex(selectionEnd, value.length, start);
      const caretIndex = start === end
        ? start
        : (state.displayedSelectionDirection === 'backward' ? start : end);

      setText(state.textBefore, value.slice(0, caretIndex));
      setText(state.textAfter, value.slice(caretIndex));

      applyInlineStyles(state.textBefore, { color: 'inherit' });
      applyInlineStyles(state.textAfter, { color: 'inherit' });
    }

    const isFocused = document.activeElement === state.el;
    applyInlineStyles(state.caretEl, { display: isFocused ? 'inline-block' : 'none' });
  },

  updateOverlay(state) {
    if (!state || !state.el) return;
    if (!state.el.isConnected) {
      this.cleanupElement(state.el);
      return;
    }
    if (!state.overlay || !state.content) return;
    const el = state.el;
    const rect = el.getBoundingClientRect();
    const visibleRect = getVisibleRect(el);
    if (!visibleRect || rect.width === 0 || rect.height === 0) {
      setInlineStyle(state.overlay, 'visibility', 'hidden');
      return;
    }
    applyInlineStyles(state.overlay, {
      visibility: 'visible',
      left: `${visibleRect.left}px`,
      top: `${visibleRect.top}px`,
      width: `${visibleRect.width}px`,
      height: `${visibleRect.height}px`,
    });

    const cs = getComputedStyle(el);
    const snap = state.snapshot;
    const offsetX = visibleRect.left - rect.left;
    const offsetY = visibleRect.top - rect.top;
    const currentScroll = readElementScroll(el);
    const visualLagging = isVisualLagging(state);
    const scrollLeft = visualLagging
      ? (Number.isFinite(Number(state.displayedScrollLeft)) ? Number(state.displayedScrollLeft) : 0)
      : currentScroll.scrollLeft;
    const scrollTop = visualLagging
      ? (Number.isFinite(Number(state.displayedScrollTop)) ? Number(state.displayedScrollTop) : 0)
      : currentScroll.scrollTop;
    if (!visualLagging) {
      state.displayedScrollLeft = scrollLeft;
      state.displayedScrollTop = scrollTop;
    }
    const caretHeight = Math.min(getLineHeightPx(cs, rect), rect.height);

    applyInlineStyles(state.content, {
      padding: snap.padding || cs.padding,
      font: snap.font || cs.font,
      letterSpacing: snap.letterSpacing || cs.letterSpacing,
      textAlign: snap.textAlign || cs.textAlign,
      lineHeight: snap.lineHeight || cs.lineHeight,
      color: snap.color || cs.color,
      textIndent: snap.textIndent || cs.textIndent,
      direction: snap.direction || cs.direction,
      borderTopWidth: snap.borderTopWidth || cs.borderTopWidth,
      borderRightWidth: snap.borderRightWidth || cs.borderRightWidth,
      borderBottomWidth: snap.borderBottomWidth || cs.borderBottomWidth,
      borderLeftWidth: snap.borderLeftWidth || cs.borderLeftWidth,
      borderRadius: snap.borderRadius || cs.borderRadius,
      transform: `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`,
    });
    applyInlineStyles(state.overlay, {
      padding: '0',
      margin: '0',
      border: cs.border,
      boxSizing: cs.boxSizing,
      borderRadius: snap.borderRadius || cs.borderRadius,
      pointerEvents: 'none',
    });
    applyInlineStyles(state.inner, {
      transform: `translate3d(${-offsetX}px, ${-offsetY}px, 0)`,
    });
    applyInlineStyles(state.caretEl, {
      height: `${caretHeight}px`,
      lineHeight: `${caretHeight}px`,
      width: '1px',
      minWidth: '1px',
      maxWidth: '1px',
      flex: '0 0 1px',
    });
    this.renderOverlay(state);
  },

  scheduleAllOverlaysUpdate() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      try {
        this.pruneDisconnected();
        const active = this.activeEl;
        if (!active) return;
        const st = this.stateByEl.get(active);
        if (st) this.updateOverlay(st);
      } catch (error) {
        reportInputDelayFailure('overlay_update_frame', error);
      }
    });
  },

  commitSnapshotNow(state, snapshot) {
    clearQueuedRenderTimer(state);
    state.queue.length = 0;
    applyDisplayedSnapshot(state, snapshot);
    this.updateOverlay(state);
  },

  enqueueSnapshot(state, snapshot, options = {}) {
    if (!state || !snapshot) return;
    const pickedDelayMs = this.pickDelayMs(snapshot);
    const maxDelayMs = Number.isFinite(options.maxDelayMs) ? Math.max(0, options.maxDelayMs) : null;
    const delayMs = maxDelayMs === null ? pickedDelayMs : Math.min(pickedDelayMs, maxDelayMs);

    if (delayMs <= 0 || snapshot.isComposing) {
      this.commitSnapshotNow(state, snapshot);
      return;
    }

    const queuedAt = Date.now();
    state.queue.push({
      snapshot,
      queuedAt,
      releaseTime: queuedAt + delayMs,
    });
    recordProtectionFeatureEvent('inputDelay', 'input_snapshot_delayed', {
      delayMs,
      inputType: snapshot.inputType || null,
      queueLength: state.queue.length,
    });

    if (state.queue.length > MAX_VISUAL_QUEUE_LENGTH) {
      state.queue.splice(0, state.queue.length - MAX_VISUAL_QUEUE_LENGTH);
    }

    this.runQueue(state);
  },

  runQueue(state) {
    if (state.running) return;
    const item = state.queue.shift();
    if (!item) return;

    state.running = true;
    state.currentItem = item;
    const waitMs = Math.max(0, item.releaseTime - Date.now());
    state.timerId = setTimeout(() => {
      state.timerId = null;
      state.running = false;
      state.currentItem = null;
      if (!state.el || !state.el.isConnected) {
        if (state.el) this.cleanupElement(state.el);
        return;
      }

      const latestQueued = state.queue[state.queue.length - 1];
      const hasNewerSnapshot = !!latestQueued
        && latestQueued.snapshot?.capturedAt >= item.snapshot?.capturedAt;
      const isStale = (Date.now() - (item.snapshot?.capturedAt || 0)) > MAX_VISUAL_LAG_MS;
      if (hasNewerSnapshot || (isStale && state.queue.length > 0)) {
        this.runQueue(state);
        return;
      }

      applyDisplayedSnapshot(state, item.snapshot);
      this.updateOverlay(state);
      this.runQueue(state);
    }, waitMs);
  },

  handleSelectionChange() {
    if (!this.active) return;
    const active = this.activeEl || document.activeElement;
    if (!active) return;
    const st = this.stateByEl.get(active);
    if (!st) return;

    const now = Date.now();
    const isRecentInput = (now - (st.lastInputTime || 0)) < 100;

    if (st.isComposing || isRecentInput || isVisualLagging(st)) {
      return;
    }

    const snapshot = createInputSnapshot(active);
    st.latestSnapshot = snapshot;
    applyDisplayedSnapshot(st, snapshot);
    this.updateOverlay(st);
  },

  handleFocusIn(e) {
    if (!this.active || this.maxDelayMs <= 0) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.isContentEditable) {
      recordProtectionFeatureEvent('inputDelay', 'unsupported_contenteditable', {
        tagName: String(target.tagName || '').toLowerCase(),
      });
      return;
    }
    if (!this.isTextInput(target)) return;
    if (this.isInputDelayBypassTarget(target)) {
      this.cleanupElement(target);
      recordProtectionFeatureEvent('inputDelay', 'input_surface_bypassed', {
        reason: 'selector',
        tagName: String(target.tagName || '').toLowerCase(),
      });
      return;
    }

    this.activeEl = target;
    for (const el of Array.from(this.tracked)) {
      if (el === target) continue;
      this.cleanupElement(el);
    }

    this.ensureElementState(target);
    this.scheduleAllOverlaysUpdate();
  },

  handleFocusOut(e) {
    if (!this.active) return;
    const target = e.target;
    if (!this.isTextInput(target)) return;
    if (this.activeEl === target) {
      this.activeEl = null;
    }
    this.cleanupElement(target);
  },

  handleKeyDown(e) {
    if (!this.active || this.maxDelayMs <= 0) return;
    if (e?.key !== 'Enter') return;
    const target = e.target;
    if (!this.isTextInput(target)) return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    if (this.isInputDelayBypassTarget(target)) {
      this.cleanupElement(target);
      return;
    }

    const st = this.stateByEl.get(target);
    if (!st) return;
    const snapshot = createInputSnapshot(target, e, {
      inputType: 'enterKey',
      isComposing: st.isComposing || e?.isComposing === true,
    });
    st.lastInputValue = snapshot.value;
    st.lastInputTime = snapshot.capturedAt;
    st.latestSnapshot = snapshot;
    this.commitSnapshotNow(st, snapshot);
  },

  handleInput(e) {
    return runInputDelayOwnerWork('input_event', e?.inputType || 'input', () => {
      if (!this.active || this.maxDelayMs <= 0) return;
      const target = e.target;
      if (!this.isTextInput(target)) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (this.isInputDelayBypassTarget(target)) {
        this.cleanupElement(target);
        return;
      }

      const st = this.ensureElementState(target);
      const inputType = typeof e?.inputType === 'string' ? e.inputType : null;
      const snapshot = createInputSnapshot(target, e, {
        isComposing: st.isComposing || e?.isComposing === true || isCompositionInputType(inputType),
      });
      const isRecentCompositionCommit = !snapshot.isComposing
        && st.lastCompositionEndValue === snapshot.value
        && (snapshot.capturedAt - st.lastCompositionEndAt) <= RECENT_COMPOSITION_END_MS;

      st.lastInputValue = snapshot.value;
      st.lastInputTime = snapshot.capturedAt;
      st.latestSnapshot = snapshot;

      this.enqueueSnapshot(st, snapshot, isRecentCompositionCommit
        ? { maxDelayMs: COMPOSITION_DELAY_CLAMP_MS }
        : {});
      this.updateOverlay(st);
    });
  },

  handleCompositionStart(e) {
    if (!this.active || this.maxDelayMs <= 0) return;
    const target = e.target;
    if (!this.isTextInput(target)) return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    if (this.isInputDelayBypassTarget(target)) {
      this.cleanupElement(target);
      return;
    }

    const st = this.ensureElementState(target);
    st.isComposing = true;
    const snapshot = createInputSnapshot(target, e, {
      isComposing: true,
      inputType: 'compositionstart',
    });
    st.latestSnapshot = snapshot;
    st.lastInputValue = snapshot.value;
    this.commitSnapshotNow(st, snapshot);
  },

  handleCompositionEnd(e) {
    if (!this.active || this.maxDelayMs <= 0) return;
    const target = e.target;
    if (!this.isTextInput(target)) return;
    if (target instanceof HTMLElement && target.isContentEditable) return;
    if (this.isInputDelayBypassTarget(target)) {
      this.cleanupElement(target);
      return;
    }

    const st = this.ensureElementState(target);
    st.isComposing = false;
    const snapshot = createInputSnapshot(target, e, {
      isComposing: false,
      inputType: 'compositionend',
    });

    st.lastCompositionEndAt = snapshot.capturedAt;
    st.lastCompositionEndValue = snapshot.value;
    st.lastInputValue = snapshot.value;
    st.latestSnapshot = snapshot;

    this.enqueueSnapshot(st, snapshot, { maxDelayMs: COMPOSITION_DELAY_CLAMP_MS });
    this.updateOverlay(st);
  },

  handleAnyScroll(e) {
    if (!this.active) return;
    const target = e.target;
    if (this.isTextInput(target)) {
      const st = this.stateByEl.get(target);
      if (st) this.updateOverlay(st);
      return;
    }
    const active = this.activeEl;
    if (!active) return;
    const st = this.stateByEl.get(active);
    if (st) this.updateOverlay(st);
  },
};

export default InputDelayManager;
