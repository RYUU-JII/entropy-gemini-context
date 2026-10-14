import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { state } from './interactionState.js';

export function getInteractionErrorMessage(error, fallback = 'CLICK_INTENT_GATE_INTERACTION_FAILURE') {
  return String(error?.message || error || fallback);
}

export function reportClickIntentGateInteractionFailure(
  phase,
  error,
  details = {},
  featureKey = 'clickDelay',
) {
  const diagnostic = {
    phase,
    error: getInteractionErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError(featureKey, error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.(`[${featureKey}] interaction failure`, diagnostic);
  }
  return diagnostic;
}

export function getScrollFrictionManagerErrorMessage(error, fallback = 'SCROLL_FRICTION_MANAGER_FAILURE') {
  return String(error?.message || error || fallback);
}

export function normalizeScrollFrictionDelayMs(value) {
  if (value === null || value === undefined || value === '') {
    throw new Error(`SCROLL_FRICTION_DELAY_INVALID:${typeof value}`);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('SCROLL_FRICTION_DELAY_INVALID:number');
    }
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const match = normalized.match(/^(\d+(?:\.\d+)?)(?:ms)?$/);
    if (!match) {
      throw new Error(`SCROLL_FRICTION_DELAY_INVALID:${normalized || 'empty_string'}`);
    }
    return Math.round(Number(match[1]));
  }
  throw new Error(`SCROLL_FRICTION_DELAY_INVALID:${typeof value}`);
}

export function reportScrollFrictionManagerFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getScrollFrictionManagerErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('scrollFriction', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[scrollFriction] manager failure', diagnostic);
  }
  return diagnostic;
}

export function createInteractionLifecycleError(message, errors) {
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

export function getSelectorDiagnosticSnippet(selector) {
  const text = String(selector || '').replace(/\s+/g, ' ').trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export function reportClickIntentGateSelectorFailure(
  operation,
  selector,
  error,
  featureKey = 'clickDelay',
) {
  if (!selector) return;
  const selectorSnippet = getSelectorDiagnosticSnippet(selector);
  const errorMessage = getInteractionErrorMessage(error, 'CLICK_INTENT_GATE_SELECTOR_FAILURE');
  const failureKey = `${featureKey}:${operation}:${selectorSnippet}:${errorMessage}`;
  if (state.selectorFailureKeys.has(failureKey)) return;
  state.selectorFailureKeys.add(failureKey);
  reportClickIntentGateInteractionFailure(`selector_${operation}`, error, {
    selector: selectorSnippet,
  }, featureKey);
}
