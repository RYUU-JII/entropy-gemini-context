import { getInteractionTargetProfile } from './interactionTargetProfiles.js';
import {
  CLICK_BOUNDARY_BRAKES,
  classifyClickBoundary,
  isRewardClickBoundary,
} from './ClickBoundaryClassifier.js';
import {
  FORM_CONTROL_SELECTOR,
  SENSITIVE_AUTOCOMPLETE_TOKENS,
  SENSITIVE_FORM_FIELD_SELECTOR,
  SPECIAL_LINK_SELECTOR,
} from './interactionConstants.js';
import { reportClickIntentGateSelectorFailure } from './interactionDiagnostics.js';
import {
  safeClosest,
  safeHasDescendant,
  safeMatchesSelector,
  safeQuerySelectorAll,
} from './interactionDom.js';

function isActionableTarget(el, selectors) {
  if (!(el instanceof Element)) return false;
  if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  if (safeMatchesSelector(el, selectors.clickDelayActionableTargets)) return true;

  const tagName = (el.tagName || '').toLowerCase();
  if (tagName === 'a') return true;
  if (tagName === 'button') return true;
  if (tagName === 'summary') return true;
  if (safeMatchesSelector(el, selectors.actionableFormControls.inputSubmit)) return true;
  if (safeMatchesSelector(el, selectors.actionableFormControls.inputImage)) return true;
  if (safeMatchesSelector(el, 'input[type="button"]')) return true;

  if (el.hasAttribute('href')) return true;
  if (el.hasAttribute('onclick')) return true;

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (
    role === 'link'
    || role === 'button'
    || role === 'article'
    || role === 'menuitem'
    || role === 'option'
    || role === 'tab'
    || role === 'checkbox'
    || role === 'radio'
    || role === 'switch'
  ) {
    return true;
  }

  if (tagName === 'article' || tagName === 'figure') {
    if (el.hasAttribute('tabindex')) return true;
    if (role) return true;
    if (el.hasAttribute('onclick')) return true;
  }

  return false;
}

function summarizeClassName(el) {
  const raw = typeof el?.className === 'string' ? el.className : '';
  return raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('.');
}

function describeElementLabel(el) {
  if (!(el instanceof Element)) return null;
  const tagName = String(el.tagName || '').toLowerCase() || 'element';
  const id = el.id ? `#${el.id}` : '';
  const className = summarizeClassName(el);
  const classText = className ? `.${className}` : '';
  const attrs = [
    el.getAttribute('role') ? `role=${el.getAttribute('role')}` : '',
    el.getAttribute('type') ? `type=${el.getAttribute('type')}` : '',
    el.getAttribute('aria-label') ? `aria=${el.getAttribute('aria-label')}` : '',
    el.getAttribute('title') ? `title=${el.getAttribute('title')}` : '',
  ].filter(Boolean);
  return `${tagName}${id}${classText}${attrs.length ? `[${attrs.join(' ')}]` : ''}`;
}

function getEventPathElements(event, rawTarget) {
  const out = [];
  const seen = new Set();
  const add = (node) => {
    if (!(node instanceof Element) || seen.has(node)) return;
    seen.add(node);
    out.push(node);
  };
  const path = typeof event?.composedPath === 'function' ? event.composedPath() : null;
  if (Array.isArray(path)) {
    for (const node of path) add(node);
  }
  let current = rawTarget instanceof Element ? rawTarget : null;
  while (current) {
    add(current);
    current = current.parentElement;
  }
  return out;
}

function createPathSelectorMatcher(event, rawTarget) {
  const path = getEventPathElements(event, rawTarget);
  const matches = new Map();
  return {
    path,
    remember(selector, match) {
      if (selector) matches.set(selector, match || null);
    },
    find(selector) {
      if (!(rawTarget instanceof Element) || !selector) return null;
      if (matches.has(selector)) return matches.get(selector);
      const match = path.find((node) => safeMatchesSelector(node, selector)) || null;
      matches.set(selector, match);
      return match;
    },
  };
}

function getSelectorMatchSummary(selectorMatcher, selector) {
  const node = selectorMatcher.find(selector);
  return {
    matched: !!node,
    node: describeElementLabel(node),
  };
}

function getTrustedGestureBypassMatch(selectorMatcher, selectors) {
  const explicit = selectorMatcher.find(selectors.clickDelayBypassTargets);
  if (explicit) {
    return {
      family: 'explicit_bypass',
      node: describeElementLabel(explicit),
    };
  }
  const nativeGesture = selectorMatcher.find(selectors.clickDelayNativeGestureBypassTargets);
  if (nativeGesture) {
    return {
      family: 'native_gesture_bypass',
      node: describeElementLabel(nativeGesture),
    };
  }
  return null;
}

function createYouTubeControlContract(selectorMatcher) {
  const player = getSelectorMatchSummary(selectorMatcher, ':is(#movie_player, .html5-video-player)');
  const chromeBottom = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-chrome-bottom, .ytp-chrome-bottom *)');
  const chromeControls = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-chrome-controls, .ytp-chrome-controls *)');
  const button = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-button, .ytp-button *)');
  const progress = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-progress-bar-container, .ytp-progress-bar-container *)');
  const menu = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-settings-menu, .ytp-settings-menu *, .ytp-panel, .ytp-panel *, .ytp-popup, .ytp-popup *, .ytp-menuitem, .ytp-menuitem *)');
  const volume = getSelectorMatchSummary(selectorMatcher, ':is(.ytp-volume-area, .ytp-volume-area *, .ytp-volume-panel, .ytp-volume-panel *, .ytp-volume-slider, .ytp-volume-slider *)');
  return {
    insidePlayer: player.matched,
    playerNode: player.node,
    insideChromeBottom: chromeBottom.matched,
    chromeBottomNode: chromeBottom.node,
    insideChromeControls: chromeControls.matched,
    chromeControlsNode: chromeControls.node,
    insideButton: button.matched,
    buttonNode: button.node,
    insideProgress: progress.matched,
    progressNode: progress.node,
    insideMenu: menu.matched,
    menuNode: menu.node,
    insideVolume: volume.matched,
    volumeNode: volume.node,
  };
}

function createClickBoundarySummary(clickBoundary) {
  if (!clickBoundary || typeof clickBoundary !== 'object') return null;
  const selectorFailures = Array.isArray(clickBoundary.selectorFailures)
    ? clickBoundary.selectorFailures
      .slice(0, 4)
      .map((failure) => `${failure.operation || '-'}:${failure.selector || '-'}`)
      .join(' | ')
    : '';
  return {
    kind: clickBoundary.kind || 'unknown',
    brake: clickBoundary.brake || 'unknown',
    confidence: Number.isFinite(Number(clickBoundary.confidence))
      ? Number(clickBoundary.confidence)
      : null,
    evidence: Array.isArray(clickBoundary.evidence) ? clickBoundary.evidence.slice(0, 8).join(', ') : '',
    selectorFailures,
  };
}

function createClickRoutingSnapshot({ event, rawTarget, target, selectors, siteId, selectorMatcher, clickBoundary = null }) {
  const interactive = getSelectorMatchSummary(selectorMatcher, selectors.interactiveTargets);
  const actionable = getSelectorMatchSummary(selectorMatcher, selectors.clickDelayActionableTargets);
  const explicitBypass = getSelectorMatchSummary(selectorMatcher, selectors.clickDelayBypassTargets);
  const nativeGestureBypass = getSelectorMatchSummary(selectorMatcher, selectors.clickDelayNativeGestureBypassTargets);
  const trustedBypass = getTrustedGestureBypassMatch(selectorMatcher, selectors);
  return {
    eventType: event?.type || null,
    button: Number.isFinite(Number(event?.button)) ? Number(event.button) : null,
    isTrusted: event?.isTrusted === true,
    pointerType: typeof event?.pointerType === 'string' ? event.pointerType : null,
    rawTarget: describeElementLabel(rawTarget),
    target: describeElementLabel(target),
    domPath: selectorMatcher.path.slice(0, 8).map((node) => describeElementLabel(node)).filter(Boolean),
    selectorMatches: {
      interactive: interactive.matched,
      interactiveNode: interactive.node,
      actionable: actionable.matched,
      actionableNode: actionable.node,
      explicitBypass: explicitBypass.matched,
      explicitBypassNode: explicitBypass.node,
      nativeGestureBypass: nativeGestureBypass.matched,
      nativeGestureBypassNode: nativeGestureBypass.node,
      trustedBypassFamily: trustedBypass?.family || null,
      trustedBypassNode: trustedBypass?.node || null,
    },
    youtube: siteId === 'youtube' ? createYouTubeControlContract(selectorMatcher) : null,
    clickBoundary: createClickBoundarySummary(clickBoundary),
  };
}

function isEditableSurface(el) {
  const editable = safeClosest(el, '[contenteditable]');
  if (!editable) return false;
  return String(editable.getAttribute('contenteditable') || '').toLowerCase() !== 'false';
}

function isNativeFormControlSurface(rawTarget) {
  return !!safeClosest(rawTarget, FORM_CONTROL_SELECTOR) || isEditableSurface(rawTarget);
}

function hasSensitiveAutocompleteToken(el) {
  if (!(el instanceof Element)) return false;
  const raw = String(el.getAttribute('autocomplete') || '').toLowerCase();
  if (!raw || raw === 'off' || raw === 'on') return false;
  return raw
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith('cc-'));
}

const COMPOSER_CONTAINER_SELECTOR = [
  'form',
  '[role="form"]',
  '[data-testid*="comment" i]',
  '[data-testid*="reply" i]',
  '[data-testid*="tweet" i]',
  '[data-testid*="composer" i]',
  '[data-testid*="post" i]',
  '[class*="comment" i]',
  '[class*="reply" i]',
  '[class*="composer" i]',
  '[class*="editor" i]',
  '[id*="comment" i]',
  '[id*="reply" i]',
  '[id*="composer" i]',
  'ytd-commentbox',
  'ytd-comment-simplebox-renderer',
  'ytd-comment-dialog-renderer',
].join(', ');

const SUBMISSION_ACTION_PATTERN = /\b(submit|comment|reply|send|post|publish|save|tweet)\b|^(등록|게시|작성|댓글|답글|전송|보내기|저장)$|((댓글|답글|게시|의견|메시지|글)\s*(등록|작성|게시|달기|남기기|전송|보내기)|(post|submit|send|add)\s*(comment|reply|message|tweet))/i;

const EXPLICIT_SUBMIT_ATTRIBUTE_SELECTOR = [
  '[data-testid*="submit" i]',
  '[data-testid*="tweetButton" i]',
  '[data-testid*="send" i]',
  '[data-action*="submit" i]',
  '[data-action*="send" i]',
  '[id*="submit" i]',
  '[class*="btn_register" i]',
  '[class*="btn_submit" i]',
  '[class*="btn_save" i]',
  '[class*="btn_regist" i]',
].join(', ');

function formHasSensitiveFields(form) {
  if (!(form instanceof Element)) return false;
  if (safeHasDescendant(form, SENSITIVE_FORM_FIELD_SELECTOR)) return true;
  return safeQuerySelectorAll(form, 'input[autocomplete], textarea[autocomplete], select[autocomplete]')
    .some((field) => hasSensitiveAutocompleteToken(field));
}

function isStateChangingForm(form) {
  if (!(form instanceof HTMLFormElement)) return false;
  const method = String(form.getAttribute('method') || 'get').trim().toLowerCase();
  if (!method || method === 'get' || method === 'dialog') return false;
  return true;
}

function getSubmitControl(target) {
  const control = safeClosest(target, 'button, input[type="submit"], input[type="image"], [role="button"]');
  if (!(control instanceof Element)) return null;
  const tagName = (control.tagName || '').toLowerCase();
  if (tagName === 'input') return control;
  const type = String(control.getAttribute('type') || '').trim().toLowerCase();
  if (type === 'reset') return null;
  return control;
}

function getAssociatedForm(control) {
  if (!control) return null;
  if (control instanceof HTMLButtonElement || control instanceof HTMLInputElement) {
    if (control.form instanceof HTMLFormElement) return control.form;
  }
  const formId = control.getAttribute?.('form');
  if (formId && typeof document !== 'undefined') {
    const matched = document.getElementById(formId);
    if (matched instanceof HTMLFormElement) return matched;
  }
  const form = safeClosest(control, 'form');
  return form instanceof HTMLFormElement ? form : null;
}

function isFormSubmitControl(control, form) {
  if (!control) return false;
  const tagName = (control.tagName || '').toLowerCase();
  if (tagName === 'input') {
    const type = String(control.getAttribute('type') || '').toLowerCase();
    return type === 'submit' || type === 'image';
  }
  const type = String(control.getAttribute('type') || '').toLowerCase();
  if (type === 'submit') return true;
  if (form && type !== 'button' && type !== 'reset') return true;
  return false;
}

function isCommentOrPostSubmissionControl(control, rawTarget) {
  if (!(control instanceof Element)) return false;
  const target = rawTarget instanceof Element ? rawTarget : control;
  if (safeClosest(control, EXPLICIT_SUBMIT_ATTRIBUTE_SELECTOR) || safeClosest(target, EXPLICIT_SUBMIT_ATTRIBUTE_SELECTOR)) {
    return true;
  }

  const signalText = [
    control.getAttribute('aria-label'),
    control.getAttribute('title'),
    control.textContent,
  ].filter(Boolean).join(' ').trim();

  if (SUBMISSION_ACTION_PATTERN.test(signalText)) {
    const composer = safeClosest(control, COMPOSER_CONTAINER_SELECTOR);
    if (composer && safeQuerySelectorAll(composer, 'textarea, input:not([type="hidden"]), [contenteditable]:not([contenteditable="false"])').length > 0) {
      return true;
    }
    const parent = control.parentElement;
    if (parent && safeQuerySelectorAll(parent, 'textarea, input:not([type="hidden"]), [contenteditable]:not([contenteditable="false"])').length > 0) {
      return true;
    }
  }

  return false;
}

function resolveSensitiveBypassReason(target, rawTarget) {
  if (safeClosest(rawTarget, '[data-friction-click-delay-sensitive="1"], [data-entropy-click-delay-sensitive="1"]')) {
    return 'explicit_sensitive_surface';
  }

  if (isNativeFormControlSurface(rawTarget)) {
    return 'native_form_control';
  }

  if (safeClosest(rawTarget, SPECIAL_LINK_SELECTOR)) {
    return 'special_link_requires_original_gesture';
  }

  const submitControl = getSubmitControl(target);
  if (submitControl) {
    const form = getAssociatedForm(submitControl);
    if (form) {
      if (formHasSensitiveFields(form)) return 'sensitive_form_submit';
      if (isStateChangingForm(form)) return 'state_changing_form_submit';
      if (isFormSubmitControl(submitControl, form)) return 'form_submit_control';
    } else if (isFormSubmitControl(submitControl, null)) {
      return 'form_submit_control';
    }

    if (isCommentOrPostSubmissionControl(submitControl, rawTarget)) {
      return 'comment_or_post_submit_control';
    }
  }

  return null;
}

function isTrustedGestureBypassClick(selectorMatcher, selectors) {
  return !!getTrustedGestureBypassMatch(selectorMatcher, selectors);
}

export function resolveClickIntentGateTarget(event, { diagnosticFeatureKey = 'clickDelay' } = {}) {
  const selectorProfile = getInteractionTargetProfile(window.location?.hostname);
  const selectors = selectorProfile.targets;
  const interactiveTargets = selectors.interactiveTargets;
  const rawTarget = event?.target instanceof Element ? event.target : null;
  if (!rawTarget) return null;

  const targetEl = safeClosest(rawTarget, interactiveTargets);
  if (!targetEl) return null;
  if (!targetEl.isConnected) return null;
  const selectorMatcher = createPathSelectorMatcher(event, rawTarget);
  selectorMatcher.remember(interactiveTargets, targetEl);
  let clickRouting = createClickRoutingSnapshot({
    event,
    rawTarget,
    target: targetEl,
    selectors,
    siteId: selectorProfile.siteId,
    selectorMatcher,
  });

  if (isNativeFormControlSurface(rawTarget)) {
    return { target: null, bypassReason: 'native_form_control', rawTarget, selectors, clickRouting };
  }

  // Only surfaces that explicitly opt out, or native media controls that rely on
  // the original trusted gesture, bypass the click intent gate.
  if (isTrustedGestureBypassClick(selectorMatcher, selectors)) {
    return { target: null, bypassReason: 'trusted_gesture_or_explicit_surface', rawTarget, selectors, clickRouting };
  }

  const sensitiveBypassReason = resolveSensitiveBypassReason(targetEl, rawTarget);
  if (sensitiveBypassReason) {
    return { target: null, bypassReason: sensitiveBypassReason, rawTarget, selectors, clickRouting };
  }

  if (!isActionableTarget(targetEl, selectors)) return null;
  const clickBoundary = classifyClickBoundary({
    event,
    rawTarget,
    target: targetEl,
    selectors,
    onSelectorFailure: (operation, selector, error) => {
      reportClickIntentGateSelectorFailure(operation, selector, error, diagnosticFeatureKey);
    },
  });
  clickRouting = {
    ...clickRouting,
    clickBoundary: createClickBoundarySummary(clickBoundary),
  };
  if (clickBoundary.brake === CLICK_BOUNDARY_BRAKES.BYPASS) {
    return {
      target: null,
      bypassReason: `click_boundary_${clickBoundary.kind || 'unknown'}`,
      rawTarget,
      selectors,
      clickBoundary,
      clickRouting,
    };
  }
  return {
    target: targetEl,
    bypassReason: null,
    rawTarget,
    selectors,
    clickBoundary,
    clickRouting,
    isRewardTransition: isRewardClickBoundary(clickBoundary),
  };
}
