import { reportClickIntentGateSelectorFailure } from './interactionDiagnostics.js';

export function getDocumentRef() {
  return typeof document === 'undefined' ? null : document;
}

export function safeMatchesSelector(el, selector) {
  if (!(el instanceof Element) || !selector) return false;
  try {
    return el.matches(selector);
  } catch (error) {
    reportClickIntentGateSelectorFailure('matches', selector, error);
    return false;
  }
}

export function safeClosest(el, selector) {
  if (!(el instanceof Element) || !selector) return null;
  try {
    return el.closest(selector);
  } catch (error) {
    reportClickIntentGateSelectorFailure('closest', selector, error);
    return null;
  }
}

export function safeHasDescendant(el, selector) {
  if (!(el instanceof Element) || !selector) return false;
  try {
    return !!el.querySelector(selector);
  } catch (error) {
    reportClickIntentGateSelectorFailure('query', selector, error);
    return false;
  }
}

export function safeQuerySelectorAll(el, selector) {
  if (!(el instanceof Element) || !selector) return [];
  try {
    return Array.from(el.querySelectorAll(selector));
  } catch (error) {
    reportClickIntentGateSelectorFailure('query_all', selector, error);
    return [];
  }
}

export function consumeClickEvent(event) {
  if (!event) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function isMouseLeftClick(event) {
  if (!event || typeof event.button !== 'number') return true;
  return event.button === 0;
}

export function isPrimaryPress(event) {
  if (!event) return false;
  if (event.type && event.type.startsWith('pointer') && event.isPrimary === false) return false;
  if (typeof event.button === 'number' && event.button !== 0) return false;
  return true;
}

export function shouldBypassModifiedClick(event) {
  if (!event) return false;
  return !!(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
