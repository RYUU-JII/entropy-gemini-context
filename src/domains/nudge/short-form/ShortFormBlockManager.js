import observerHub from '../../../lib/dom/ObserverHub.js';
import StatusIndicator from '../visual/statusIndicator.js';
import { ROOT_ATTRS, removeRootAttribute, setRootAttribute } from '../core/index.js';
import {
  getShortFormHideSelectors,
  getShortFormRuleForHostname,
  getShortFormSafeUrl,
  isShortFormUrl,
} from './rules.js';
import {
  isFrictionDebugEnabled,
  isShortFormDebugEnabled,
} from '@friction-debug-flags';
import { recordRuntimeDiscoveryVisit } from '@runtime-discovery-ledger';
import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';
import { recordShortFormTargetOutcome } from '@short-form-target-outcome';
import {
  recordProtectionFeatureError,
  recordProtectionFeatureEvent,
} from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  normalizeShortFormMutationRoots,
  resolveShortFormObserverAttributes,
  resolveShortFormNavigationActionIntent,
  resolveShortFormTargetActionIntents,
} from './shortFormTargetResolver.js';

const HIDDEN_STYLE_ID = 'friction-shortform-hidden-style';
const HIDDEN_TARGET_ATTR = 'data-friction-shortform-hidden';
const COLLAPSED_TARGET_ATTR = 'data-friction-shortform-collapsed';
const INSTAGRAM_HOME_ATTR = 'data-friction-shortform-instagram-home';
const URL_POLL_MS = 700;
const MAX_RECENT_SHORT_FORM_OPERATIONS = 24;

function createShortFormDebugState(generation) {
  return {
    generation,
    startedAt: Date.now(),
    operations: 0,
    observerBatches: 0,
    observerRoots: 0,
    urlRefreshes: 0,
    urlRefreshRoots: 0,
    initialRefreshes: 0,
    initialRoots: 0,
    candidates: 0,
    pruned: 0,
    hidden: 0,
    removed: 0,
    restored: 0,
    noops: 0,
    redirects: 0,
    totalMs: 0,
    maxMs: 0,
    recentOperations: [],
  };
}

function resolveShortFormDiscoveryWorkReason(source) {
  if (source === 'observer') return 'relevant_mutation';
  if (source === 'initial') return 'activation_configuration_transition';
  if (source === 'url_event' || source === 'url_poll') return 'navigation_refresh';
  if (source === 'direct') return 'direct_owner_request';
  return 'unknown';
}

function isElement(value) {
  return value instanceof Element;
}

function withSafeUrl(rawHref) {
  try {
    return new URL(rawHref, window.location.href).href;
  } catch (_) {
    return null;
  }
}


function getShortFormErrorMessage(error, fallback = 'SHORT_FORM_BLOCK_FAILURE') {
  return String(error?.message || error || fallback);
}

function describeShortFormTarget(target) {
  if (!isElement(target)) return { tagName: 'unknown' };
  return {
    tagName: String(target.tagName || '').toLowerCase(),
    id: target.id || null,
    className: typeof target.className === 'string' ? target.className.slice(0, 120) : null,
  };
}

function reportShortFormFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getShortFormErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('shortFormBlock', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[ShortFormBlockManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createShortFormLifecycleError(message, errors) {
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

function isDebugEnabled() {
  return isShortFormDebugEnabled();
}

export default class ShortFormBlockManager {
  constructor() {
    this._active = false;
    this._observerUnsub = null;
    this._pollTimer = null;
    this._lastHref = '';
    this._debug = false;
    this._hiddenStyle = null;
    // Actuation ownership, not a cached semantic verdict. Weak keys permit detached DOM to collect.
    this._hiddenTargetReasons = new WeakMap();
    this._costDebugGeneration = 1;
    this._costDebugState = createShortFormDebugState(this._costDebugGeneration);
    this._costDebugOperation = null;

    this._boundOnClick = (event) => this._handleClick(event);
    this._boundOnUrlEvent = () => this._handleUrlEvent();
  }

  _isCostDebugEnabled() {
    return isFrictionDebugEnabled() || isShortFormDebugEnabled();
  }

  _runPruneDebugOperation(source, rootCount, work, { debugContext = null } = {}) {
    if (!this._isCostDebugEnabled()) return work();
    if (this._costDebugOperation) return work();

    const operation = {
      generation: this._costDebugState.generation,
      operationId: this._costDebugState.operations + 1,
      source,
      flushId: Number.isFinite(Number(debugContext?.flushId))
        ? Number(debugContext.flushId)
        : null,
      deliverySequence: Number.isFinite(Number(debugContext?.deliverySequence))
        ? Number(debugContext.deliverySequence)
        : null,
      roots: Math.max(0, Number(rootCount) || 0),
      candidates: 0,
      pruned: 0,
      hidden: 0,
      removed: 0,
      restored: 0,
      noops: 0,
      redirects: 0,
      startedAt: performance.now(),
    };
    this._costDebugOperation = operation;
    try {
      return work();
    } finally {
      this._costDebugOperation = null;
      const durationMs = performance.now() - operation.startedAt;
      const summary = {
        generation: operation.generation,
        operationId: operation.operationId,
        source,
        flushId: operation.flushId,
        deliverySequence: operation.deliverySequence,
        roots: operation.roots,
        candidates: operation.candidates,
        pruned: operation.pruned,
        hidden: operation.hidden,
        removed: operation.removed,
        restored: operation.restored,
        noops: operation.noops,
        redirects: operation.redirects,
        durationMs: Number(durationMs.toFixed(2)),
      };
      const state = this._costDebugState;
      state.operations += 1;
      if (source === 'observer') {
        state.observerBatches += 1;
        state.observerRoots += summary.roots;
      } else if (source === 'initial') {
        state.initialRefreshes += 1;
        state.initialRoots += summary.roots;
      } else if (source === 'url_poll' || source === 'url_event') {
        state.urlRefreshes += 1;
        state.urlRefreshRoots += summary.roots;
      }
      state.candidates += summary.candidates;
      state.pruned += summary.pruned;
      state.hidden += summary.hidden;
      state.removed += summary.removed;
      state.restored += summary.restored;
      state.noops += summary.noops;
      state.redirects += summary.redirects;
      state.totalMs += durationMs;
      state.maxMs = Math.max(state.maxMs, durationMs);
      recordRuntimeOwnerWork({
        ownerId: 'shortForm',
        phase: 'prune_operation',
        source,
        units: summary.candidates,
        flushId: operation.flushId,
        startedAt: operation.startedAt,
        endedAt: operation.startedAt + durationMs,
      });
      state.recentOperations.push(summary);
      if (state.recentOperations.length > MAX_RECENT_SHORT_FORM_OPERATIONS) {
        state.recentOperations.splice(
          0,
          state.recentOperations.length - MAX_RECENT_SHORT_FORM_OPERATIONS,
        );
      }
    }
  }

  _recordPruneCandidate() {
    if (this._costDebugOperation) this._costDebugOperation.candidates += 1;
  }

  _recordDiscoveryVisit(phase, node, ownerReason) {
    const operation = this._costDebugOperation;
    if (!operation) return false;
    return recordRuntimeDiscoveryVisit({
      ownerId: 'shortForm',
      phase,
      node,
      flushIds: operation.flushId === null ? [] : [operation.flushId],
      workReason: resolveShortFormDiscoveryWorkReason(operation.source),
      ownerReason,
      source: operation.source,
    });
  }

  _recordPruneNoop() {
    if (this._costDebugOperation) this._costDebugOperation.noops += 1;
  }

  _recordPruned(mode, target) {
    if (!this._costDebugOperation) return;
    this._costDebugOperation.pruned += 1;
    this._costDebugOperation[mode === 'remove' ? 'removed' : 'hidden'] += 1;
    recordShortFormTargetOutcome(target, {
      generation: this._costDebugOperation.generation,
      operationId: this._costDebugOperation.operationId,
      flushId: this._costDebugOperation.flushId,
      deliverySequence: this._costDebugOperation.deliverySequence,
      action: 'pruned',
      mode,
    });
  }

  _recordRestored(target) {
    if (!this._costDebugOperation) return;
    this._costDebugOperation.restored += 1;
    recordShortFormTargetOutcome(target, {
      generation: this._costDebugOperation.generation,
      operationId: this._costDebugOperation.operationId,
      flushId: this._costDebugOperation.flushId,
      deliverySequence: this._costDebugOperation.deliverySequence,
      action: 'restored',
    });
  }

  getDebugSnapshot() {
    const state = this._costDebugState;
    return {
      loaded: true,
      available: true,
      debugEnabled: this._isCostDebugEnabled(),
      active: this._active,
      observerAttached: !!this._observerUnsub,
      urlPollerAttached: !!this._pollTimer,
      stats: {
        ...state,
        totalMs: Number(state.totalMs.toFixed(2)),
        maxMs: Number(state.maxMs.toFixed(2)),
        recentOperations: state.recentOperations.map((entry) => ({ ...entry })),
      },
    };
  }

  resetDebugSnapshot() {
    this._costDebugGeneration += 1;
    this._costDebugState = createShortFormDebugState(this._costDebugGeneration);
  }

  apply() {
    if (this._active) return;
    this._active = true;
    this._debug = isDebugEnabled();
    this._lastHref = window.location.href;

    try {
      if (getShortFormRuleForHostname(window.location.hostname)) {
        this._installWindowListeners();
        this._installUrlPoller();
        this._ensureObserver();
      }
      this._refresh('initial');
      recordProtectionFeatureEvent('shortFormBlock', 'manager_apply', {
        hostname: window.location?.hostname || '',
      });
    } catch (error) {
      reportShortFormFailure('manager_apply', error, {
        hostname: window.location?.hostname || '',
      });
      try {
        this._cleanupInFlight({ deactivate: true, throwOnFailure: true });
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      this._active = false;
      throw error;
    }
  }

  remove() {
    if (!this._active) return;
    try {
      this._cleanupInFlight({
        deactivate: true,
        throwOnFailure: true,
        preserveActiveOnFailure: true,
      });
    } catch (error) {
      const removeError = createShortFormLifecycleError(
        'SHORT_FORM_MANAGER_REMOVE_FAILED',
        error?.errors || [error]
      );
      reportShortFormFailure('manager_remove', removeError);
      throw removeError;
    }
    recordProtectionFeatureEvent('shortFormBlock', 'manager_remove');
  }

  _cleanupInFlight({
    deactivate = false,
    throwOnFailure = false,
    preserveActiveOnFailure = false,
  } = {}) {
    const previousActive = this._active;
    if (deactivate && !throwOnFailure) this._active = false;
    const errors = [];

    this._runCleanupStep('cleanup_window_listeners', () => this._teardownWindowListeners(), errors);
    this._runCleanupStep('cleanup_url_poller', () => this._clearUrlPoller(), errors);
    this._runCleanupStep('cleanup_observer', () => this._teardownObserver(), errors);
    this._runCleanupStep('cleanup_notice', () => this._removeNotice(), errors);
    this._runCleanupStep('cleanup_hidden_targets', () => this._restoreHiddenTargets(), errors);
    this._runCleanupStep('cleanup_hidden_style', () => this._removeHiddenStyle(), errors);
    this._runCleanupStep('cleanup_instagram_home_attribute', () => removeRootAttribute(INSTAGRAM_HOME_ATTR), errors);
    this._runCleanupStep('cleanup_root_attribute', () => removeRootAttribute(ROOT_ATTRS.SHORT_FORM), errors);

    const shouldThrow = errors.length > 0 && throwOnFailure;
    if (shouldThrow && deactivate && preserveActiveOnFailure) {
      this._active = previousActive;
      throw createShortFormLifecycleError('SHORT_FORM_MANAGER_CLEANUP_FAILED', errors);
    }
    if (deactivate) this._active = false;
    if (shouldThrow) {
      throw createShortFormLifecycleError('SHORT_FORM_MANAGER_CLEANUP_FAILED', errors);
    }
  }

  _runCleanupStep(phase, cleanup, errors) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
      reportShortFormFailure(phase, error);
    }
  }

  _installWindowListeners() {
    const listeners = [
      ['click', this._boundOnClick, true],
      ['popstate', this._boundOnUrlEvent, false],
      ['hashchange', this._boundOnUrlEvent, false],
    ];
    for (const [eventName, handler, options] of listeners) {
      try {
        window.addEventListener(eventName, handler, options);
      } catch (error) {
        reportShortFormFailure('window_listener_attach', error, { eventName });
        throw error;
      }
    }
  }

  _teardownWindowListeners() {
    const listeners = [
      ['click', this._boundOnClick, true],
      ['popstate', this._boundOnUrlEvent, false],
      ['hashchange', this._boundOnUrlEvent, false],
    ];
    const errors = [];
    for (const [eventName, handler, options] of listeners) {
      try {
        window.removeEventListener(eventName, handler, options);
      } catch (error) {
        errors.push(error);
        reportShortFormFailure('window_listener_detach', error, { eventName });
      }
    }
    if (errors.length > 0) {
      throw createShortFormLifecycleError('SHORT_FORM_WINDOW_LISTENER_DETACH_FAILED', errors);
    }
  }

  _installUrlPoller() {
    try {
      this._pollTimer = window.setInterval(() => {
        if (!this._active) return;
        const href = window.location.href;
        if (href === this._lastHref) return;
        this._lastHref = href;
        try {
          this._refresh('url_poll');
        } catch (error) {
          reportShortFormFailure('url_poller_refresh', error);
          throw error;
        }
      }, URL_POLL_MS);
    } catch (error) {
      reportShortFormFailure('url_poller_install', error);
      throw error;
    }
  }

  _clearUrlPoller() {
    if (!this._pollTimer) return;
    try {
      window.clearInterval(this._pollTimer);
      this._pollTimer = null;
    } catch (error) {
      reportShortFormFailure('url_poller_clear', error);
      throw error;
    }
  }

  _ensureObserver() {
    if (this._observerUnsub) return;
    try {
      this._observerUnsub = observerHub.subscribe(
        (payload, debugContext) => this._handleMutations(
          [
            ...(payload.addedNodes || []),
            ...(payload.attributeTargets || []),
            ...(payload.textNodes || []),
          ],
          debugContext,
          payload,
        ),
        {
          childList: true,
          subtree: true,
          characterData: getShortFormRuleForHostname(window.location.hostname)?.id === 'youtube',
          attributes: true,
          attributeFilter: resolveShortFormObserverAttributes(
            getShortFormRuleForHostname(window.location.hostname),
          ),
          debugLabel: 'ShortFormBlockManager.observer',
        },
      );
    } catch (error) {
      this._observerUnsub = null;
      reportShortFormFailure('observer_subscribe', error);
      throw error;
    }
  }

  _teardownObserver() {
    if (!this._observerUnsub) return;
    try {
      this._observerUnsub();
      this._observerUnsub = null;
    } catch (error) {
      reportShortFormFailure('observer_unsubscribe', error);
      throw error;
    }
  }


  _debugLog(message, payload = null) {
    if (!this._debug) return;
    if (payload && typeof payload === 'object') {
      console.debug(`[ShortFormBlockManager] ${message}`, payload);
      return;
    }
    console.debug(`[ShortFormBlockManager] ${message}`);
  }

  _handleClick(event) {
    if (!this._active) return;
    const rule = getShortFormRuleForHostname(window.location.hostname);
    const intent = resolveShortFormNavigationActionIntent(event?.target, {
      currentUrl: window.location.href,
      rule,
      onSelectorFailure: (error, details) => {
        reportShortFormFailure('selector_query', error, details);
      },
    });
    if (!intent) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }

    this._showNotice();
    recordProtectionFeatureEvent('shortFormBlock', 'navigation_blocked', {
      href: intent.url,
    });
  }

  _handleUrlEvent() {
    if (!this._active) return;
    this._lastHref = window.location.href;
    try {
      this._refresh('url_event');
    } catch (error) {
      reportShortFormFailure('url_event_refresh', error);
      throw error;
    }
  }

  _handleMutations(addedNodes, debugContext = null, mutationPayload = null) {
    if (!this._active) return;
    const rule = getShortFormRuleForHostname(window.location.hostname);
    if (!rule) return;
    const selectors = getShortFormHideSelectors(window.location.hostname);
    if (!selectors.length) return;

    const roots = normalizeShortFormMutationRoots(addedNodes, {
      rule,
      mutationPayload,
      currentUrl: window.location.href,
      readOwnedHideReason: (target) => this._hiddenTargetReasons.get(target),
      onSelectorFailure: (error, details) => {
        reportShortFormFailure('selector_query', error, details);
      },
    });
    if (roots.length === 0) return;
    this._runPruneDebugOperation(
      'observer',
      roots.length,
      () => {
        for (const node of roots) {
          this._pruneTargetsInRoot(node, selectors, { rule });
        }
      },
      { debugContext },
    );
  }

  _refresh(source = 'url_event') {
    return this._runPruneDebugOperation(source, document.documentElement ? 1 : 0, () => {
      const rule = getShortFormRuleForHostname(window.location.hostname);
      const instagramHome = rule?.id === 'instagram' && window.location.pathname === '/';
      if (instagramHome) {
        if (!this._ensureHiddenStyle()) throw new Error('SHORT_FORM_INSTAGRAM_FEED_STYLE_INSTALL_FAILED');
        setRootAttribute(INSTAGRAM_HOME_ATTR, '1');
      } else {
        removeRootAttribute(INSTAGRAM_HOME_ATTR);
      }
      if (!rule) {
        removeRootAttribute(ROOT_ATTRS.SHORT_FORM);
        recordProtectionFeatureEvent('shortFormBlock', 'rule_missing_for_host', {
          hostname: window.location?.hostname || '',
        });
        return;
      }

      setRootAttribute(ROOT_ATTRS.SHORT_FORM, '1');
      if (isShortFormUrl(window.location.href) && this._redirectToSafeUrl()) return;
      this._pruneTargetsInRoot(
        document.documentElement,
        getShortFormHideSelectors(window.location.hostname),
        { rule },
      );
    });
  }

  _redirectToSafeUrl() {
    const safeUrl = getShortFormSafeUrl(window.location.hostname, window.location.origin);
    if (!safeUrl) return false;
    const resolvedCurrentUrl = withSafeUrl(window.location.href);
    const resolvedSafeUrl = withSafeUrl(safeUrl);
    if (!resolvedCurrentUrl || !resolvedSafeUrl || resolvedCurrentUrl === resolvedSafeUrl) {
      return false;
    }
    this._debugLog('redirect_shortform_url', {
      from: resolvedCurrentUrl,
      to: resolvedSafeUrl,
    });
    try {
      window.location.replace(resolvedSafeUrl);
      if (this._costDebugOperation) this._costDebugOperation.redirects += 1;
      recordProtectionFeatureEvent('shortFormBlock', 'shortform_redirected', {
        from: resolvedCurrentUrl,
        to: resolvedSafeUrl,
      });
      return true;
    } catch (error) {
      reportShortFormFailure('shortform_redirect', error, {
        from: resolvedCurrentUrl,
        to: resolvedSafeUrl,
      });
      return false;
    }
  }

  _pruneTargetsInRoot(root, selectors, { rule = null } = {}) {
    if (!root || !selectors || selectors.length === 0) return;
    this._recordDiscoveryVisit('scan_root', root, 'short_form_prune_scope');
    const intents = resolveShortFormTargetActionIntents({
      root,
      selectors,
      rule,
      currentUrl: window.location.href,
      pathname: window.location.pathname,
      documentElement: document.documentElement,
      readOwnedHideReason: (target) => this._hiddenTargetReasons.get(target),
      onSelectorFailure: (error, details) => {
        reportShortFormFailure('selector_query', error, details);
      },
    });
    const positiveTargets = new Set(intents.filter((intent) => intent.type === 'prune').map((intent) => intent.target));
    for (const intent of intents) {
      if (intent.type === 'restore') {
        if (!positiveTargets.has(intent.target)) this._restoreResolvedTarget(intent.target, {
          reason: intent.reason,
          expectedPruneReason: intent.expectedPruneReason,
        });
        continue;
      }
      if (intent.type === 'prune') {
        this._removeTarget(intent.target, {
          candidate: intent.candidate,
          reason: intent.reason,
          rule,
          pruneModeOverride: intent.pruneModeOverride,
        });
      }
    }
  }

  _removeTarget(target, {
    candidate = target,
    reason = 'direct',
    rule = null,
    pruneModeOverride = null,
  } = {}) {
    this._recordPruneCandidate();
    this._recordDiscoveryVisit('candidate_visit', candidate, reason);
    const resolvedRule = rule || getShortFormRuleForHostname(window.location.hostname);
    if (!isElement(target) || !target.isConnected) {
      this._recordPruneNoop();
      return;
    }
    if (target === document.documentElement || target === document.body || target === document.head) {
      this._recordPruneNoop();
      return;
    }
    if (target.hasAttribute('data-friction-indicator')) {
      this._recordPruneNoop();
      return;
    }
    const pruneMode = this._resolvePruneMode(resolvedRule, target, reason, pruneModeOverride);
    if (!pruneMode) {
      this._recordPruneNoop();
      return;
    }
    this._recordDiscoveryVisit('effect_target', target, reason);
    if (
      (pruneMode === 'hide' || pruneMode === 'collapse')
      && target.getAttribute(HIDDEN_TARGET_ATTR) === '1'
      && (target.getAttribute(COLLAPSED_TARGET_ATTR) === '1') === (pruneMode === 'collapse')
    ) {
      if (this._hiddenTargetReasons.has(target)) this._hiddenTargetReasons.set(target, reason);
      this._recordPruneNoop();
      return;
    }

    const pruned = pruneMode === 'remove'
      ? this._removeTargetNode(target)
      : this._hideTarget(target, { collapseFeedSlot: pruneMode === 'collapse' });
    if (!pruned) {
      this._recordPruneNoop();
      return;
    }
    if (pruneMode !== 'remove') this._hiddenTargetReasons.set(target, reason);
    this._recordPruned(pruneMode, target);

    this._debugLog('remove_target', {
      reason,
      tag: String(target.tagName || '').toLowerCase(),
      id: target.id || null,
      className: target.className || null,
      mode: pruneMode,
    });
    recordProtectionFeatureEvent('shortFormBlock', 'target_pruned', {
      reason,
      tagName: String(target.tagName || '').toLowerCase(),
      id: target.id || null,
      mode: pruneMode,
    });
  }

  _restoreResolvedTarget(target, { reason = 'target_no_longer_short_form', expectedPruneReason = null } = {}) {
    if (!isElement(target) || target.getAttribute(HIDDEN_TARGET_ATTR) !== '1') return false;
    if (expectedPruneReason !== null && this._hiddenTargetReasons.get(target) !== expectedPruneReason) return false;
    try {
      target.removeAttribute(HIDDEN_TARGET_ATTR);
      target.removeAttribute(COLLAPSED_TARGET_ATTR);
      this._hiddenTargetReasons.delete(target);
      this._recordRestored(target);
      recordProtectionFeatureEvent('shortFormBlock', 'target_reconciled_visible', {
        reason,
        tagName: String(target.tagName || '').toLowerCase(),
      });
      return true;
    } catch (error) {
      reportShortFormFailure('target_restore', error, {
        reason,
        ...describeShortFormTarget(target),
      });
      return false;
    }
  }

  _resolvePruneMode(rule, target, reason, pruneModeOverride = null) {
    if (pruneModeOverride != null) {
      if (
        pruneModeOverride === 'hide'
        || pruneModeOverride === 'collapse'
        || pruneModeOverride === 'remove'
      ) return pruneModeOverride;
      reportShortFormFailure('prune_mode_override_invalid', new Error('SHORT_FORM_PRUNE_MODE_OVERRIDE_INVALID'), {
        ruleId: rule?.id || null,
        reason,
        pruneModeOverride,
        ...describeShortFormTarget(target),
      });
      return null;
    }
    if (rule?.pruneMode === 'hide' || rule?.pruneMode === 'remove') return rule.pruneMode;
    reportShortFormFailure('prune_mode_missing', new Error('SHORT_FORM_PRUNE_MODE_MISSING'), {
      ruleId: rule?.id || null,
      reason,
      ...describeShortFormTarget(target),
    });
    return null;
  }

  _removeTargetNode(target) {
    try {
      target.remove();
      return true;
    } catch (error) {
      reportShortFormFailure('target_remove', error, describeShortFormTarget(target));
      return false;
    }
  }

  _ensureHiddenStyle() {
    if (this._hiddenStyle?.isConnected) return true;
    let style = document.getElementById(HIDDEN_STYLE_ID);
    try {
      if (!style) {
        style = document.createElement('style');
        style.id = HIDDEN_STYLE_ID;
        style.textContent = `
          /* Instagram owns its virtualized feed offsets. Native anchoring must
             not add a second correction when a mounted Reel shrinks. */
          html[${INSTAGRAM_HOME_ATTR}="1"][${ROOT_ATTRS.SHORT_FORM}="1"] div:has(> article) {
            overflow-anchor: none !important;
          }
          [${HIDDEN_TARGET_ATTR}="1"]:not([${COLLAPSED_TARGET_ATTR}="1"]) {
            display: none !important;
          }
          [${HIDDEN_TARGET_ATTR}="1"][${COLLAPSED_TARGET_ATTR}="1"] {
            box-sizing: border-box !important;
            height: 1px !important;
            min-height: 1px !important;
            max-height: 1px !important;
            margin-block: 0 !important;
            padding-block: 0 !important;
            border-block-width: 0 !important;
            overflow: hidden !important;
            flex-shrink: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            user-select: none !important;
          }
          [${HIDDEN_TARGET_ATTR}="1"][${COLLAPSED_TARGET_ATTR}="1"] > * {
            box-sizing: border-box !important;
            height: 1px !important;
            min-height: 0 !important;
            max-height: 1px !important;
            margin-block: 0 !important;
            padding-block: 0 !important;
            border-block-width: 0 !important;
            overflow: hidden !important;
          }
        `;
      }
      if (!style.isConnected) {
        if (!document.head) throw new Error('SHORT_FORM_HIDDEN_STYLE_HOST_MISSING');
        document.head.appendChild(style);
      }
      this._hiddenStyle = style;
      return true;
    } catch (error) {
      reportShortFormFailure('hidden_style_install', error);
      return false;
    }
  }

  _hideTarget(target, { collapseFeedSlot = false } = {}) {
    if (!isElement(target)) return false;
    if (!this._ensureHiddenStyle()) return false;
    const alreadyHidden = target.getAttribute(HIDDEN_TARGET_ATTR) === '1';
    const previousCollapsedValue = target.getAttribute(COLLAPSED_TARGET_ATTR);
    if (alreadyHidden && (previousCollapsedValue === '1') === collapseFeedSlot) return true;
    try {
      if (collapseFeedSlot) {
        // Keep a measurable native feed slot, without reserving the Reel's
        // original height or detaching Instagram's React-owned article.
        target.setAttribute(COLLAPSED_TARGET_ATTR, '1');
      } else {
        target.removeAttribute(COLLAPSED_TARGET_ATTR);
      }
      if (!alreadyHidden) target.setAttribute(HIDDEN_TARGET_ATTR, '1');
      return true;
    } catch (error) {
      try {
        if (previousCollapsedValue === null) {
          target.removeAttribute(COLLAPSED_TARGET_ATTR);
        } else {
          target.setAttribute(COLLAPSED_TARGET_ATTR, previousCollapsedValue);
        }
      } catch (rollbackError) {
        reportShortFormFailure('target_hide_rollback', rollbackError, describeShortFormTarget(target));
      }
      reportShortFormFailure('target_hide', error, describeShortFormTarget(target));
      return false;
    }
  }

  _restoreHiddenTargets() {
    try {
      document
        .querySelectorAll(`[${HIDDEN_TARGET_ATTR}="1"]`)
        .forEach((target) => {
          target.removeAttribute(HIDDEN_TARGET_ATTR);
          target.removeAttribute(COLLAPSED_TARGET_ATTR);
        });
      this._hiddenTargetReasons = new WeakMap();
    } catch (error) {
      reportShortFormFailure('hidden_targets_restore', error);
      throw error;
    }
  }

  _removeHiddenStyle() {
    const style = this._hiddenStyle || document.getElementById(HIDDEN_STYLE_ID);
    try {
      if (style?.isConnected) style.remove();
      this._hiddenStyle = null;
    } catch (error) {
      reportShortFormFailure('hidden_style_remove', error);
      throw error;
    }
  }

  _showNotice() {
    StatusIndicator.showAttemptReason('shortform').catch((error) => {
      reportShortFormFailure('notice_show', error);
    });
  }

  _removeNotice() {
    StatusIndicator.clearAttemptReason('shortform');
  }
}
