import { getMediaTargets } from './mediaTargetProfiles.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  ROOT_ATTRS,
  removeRootAttribute,
  setRootAttribute,
  setRootVar,
} from '../core/index.js';
import { getVisualFilterVars } from '../../../lib/filterCssVars.js';
import { MEDIA_VISUAL_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';
import { isFrictionDebugEnabled } from '@friction-debug-flags';
import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';
import {
  applyMediaFilterToElement,
  applyMediaFiltersToRoot,
  applyMediaFiltersToRoots,
  applyMediaFiltersToRootsCooperatively,
  buildMediaFilter,
  cleanupMediaFilters,
  collectMediaTargets,
  filterRelevantMediaMutationRoots,
  getElementDimensions,
  hasKnownElementDimensions,
  hasExcludedMediaKeyword,
  parseDimension,
  passesContentMediaGate,
  resolveMediaFilterForElement,
  restoreAllMediaFilters,
  restoreMediaFilter,
  shouldApplyToMediaElement,
} from './mediaFilterController.js';
import {
  ensureMediaFilterObserver,
  releaseMediaFilterObserver,
} from './observerController.js';
import {
  applyRootFilter,
  buildRootFilter,
  clearRootFilterPreloadState,
  composeRootFilter,
  ensureRootFilterCache,
  ensureRootFilterObserver,
  readRootFilterPreloadState,
  reconcileRootFilter,
  releaseRootFilterObserver,
  restoreRootFilter,
  stripManagedRootFilter,
  writeRootFilterPreloadState,
} from './rootFilterController.js';
const UNKNOWN_DIMENSION_MEDIA_LOAD_GRACE_MS = 15000;
const UNKNOWN_DIMENSION_MEDIA_SETTLE_MS = 120;
const UNKNOWN_DIMENSION_MEDIA_LATE_SETTLE_MS = 1200;
const MAX_RECENT_MEDIA_OPERATIONS = 24;
const MEDIA_FILTER_DEBUG_COUNTER_KEYS = Object.freeze([
  'writes',
  'noops',
  'restores',
  'invalidTargetNoops',
  'exemptTargetNoops',
  'emptyFilterNoops',
  'alreadyAppliedNoops',
  'compositeEffectCreates',
  'compositeEffectUpdates',
  'compositeEffectRecreates',
  'compositeEffectCancels',
  'compositeEffectCreateMs',
  'compositeEffectUpdateMs',
  'compositeEffectCancelMs',
  'zeroWorkMutationScans',
  'attributeRootsSkipped',
  'managedTargetStyleRootsSkipped',
  'rechecksQueued',
  'rechecksCoalesced',
  'rechecksRun',
  'rechecksResolved',
  'rechecksUnresolved',
  'rechecksExpired',
  'settleRechecks',
  'lateRechecks',
  'loadRechecks',
  'metadataRechecks',
  'candidateEvaluations',
  'trackedTargetVisits',
  'ownershipElementVisits',
  'additionOnlyBatches',
  'acceptedEvaluations',
  'overlayExemptRejects',
  'contextRejects',
  'contentGateRejects',
  'emojiIconRejects',
  'keywordRejects',
  'unknownDimensionDeferrals',
  'sizeRejects',
  'videoAccepts',
  'mediaAccepts',
]);

function createMediaFilterDebugState() {
  return {
    startedAt: Date.now(),
    operations: 0,
    fullScans: 0,
    mutationScans: 0,
    recheckScans: 0,
    incomingRoots: 0,
    relevantRoots: 0,
    discoveredTargets: 0,
    uniqueTargets: 0,
    ...Object.fromEntries(MEDIA_FILTER_DEBUG_COUNTER_KEYS.map((key) => [key, 0])),
    totalQueueWaitMs: 0,
    maxQueueWaitMs: 0,
    expiryWaitTotalMs: 0,
    expiryWaitMaxMs: 0,
    totalMs: 0,
    maxMs: 0,
    debugOverheadMs: 0,
    recentOperations: [],
  };
}

function getVisualManagerErrorMessage(error, fallback = 'VISUAL_MANAGER_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportVisualManagerFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getVisualManagerErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('visualManager', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[VisualManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createVisualManagerLifecycleError(message, errors) {
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

const reportedVisualSelectorFailureSignatures = new Set();

function reportVisualSelectorFailure(phase, error, details = {}) {
  const selector = details.selector || '';
  const signature = `${phase}:${selector}`;
  if (reportedVisualSelectorFailureSignatures.has(signature)) return null;
  reportedVisualSelectorFailureSignatures.add(signature);
  return reportVisualManagerFailure(phase, error, details);
}

const VisualManager = {
  _mediaFilterObserverUnsub: null,
  _rootFilterObserver: null,
  _rootFilterCache: null,
  _currentRootFilter: '',
  _mediaFilterElements: new Set(),
  _mediaFilterCache: new WeakMap(),
  _currentMediaFilter: '',
  _currentSelectors: null,
  _didInitialMediaApply: false,
  _unknownDimensionMediaRetries: new WeakMap(),
  _unknownDimensionMediaRetryElements: new Set(),
  _mediaFilterDebugState: createMediaFilterDebugState(),
  _mediaFilterDebugOperation: null,
  _cooperativeUpdateToken: null,
  _mediaFilterMutationQueue: null,

  _isDebugEnabled() {
    return isFrictionDebugEnabled();
  },

  _runMediaFilterDebugOperation(
    source,
    incomingRootCount,
    relevantRootCount,
    work,
    context = {},
  ) {
    if (!this._isDebugEnabled()) return work();
    if (this._mediaFilterDebugOperation) return work();

    const debugSetupStartedAt = performance.now();
    const operation = {
      source,
      startedAt: 0,
      debugSetupMs: 0,
      flushId: context.flushId || null,
      recheckTrigger: context.recheckTrigger || null,
      incomingRoots: Number(incomingRootCount) || 0,
      relevantRoots: Number(relevantRootCount) || 0,
      discoveredTargets: 0,
      uniqueTargets: new Set(),
      ...Object.fromEntries(MEDIA_FILTER_DEBUG_COUNTER_KEYS.map((key) => [key, 0])),
      queueWaitMs: 0,
      pausedAt: null,
      pausedDurationMs: 0,
    };
    operation.debugSetupMs = performance.now() - debugSetupStartedAt;
    operation.startedAt = performance.now();
    this._mediaFilterDebugOperation = operation;
    const finalizeOperation = () => {
      if (this._mediaFilterDebugOperation !== operation) return;
      this._mediaFilterDebugOperation = null;
      const durationMs = Math.max(
        0,
        performance.now() - operation.startedAt - operation.pausedDurationMs,
      );
      const bookkeepingStartedAt = performance.now();
      const summary = {
        source: operation.source,
        flushId: operation.flushId,
        recheckTrigger: operation.recheckTrigger,
        incomingRoots: operation.incomingRoots,
        relevantRoots: operation.relevantRoots,
        discoveredTargets: operation.discoveredTargets,
        uniqueTargets: operation.uniqueTargets.size,
        ...Object.fromEntries(
          MEDIA_FILTER_DEBUG_COUNTER_KEYS.map((key) => [key, operation[key]]),
        ),
        queueWaitMs: Number(operation.queueWaitMs.toFixed(2)),
        durationMs: Number(durationMs.toFixed(2)),
        debugOverheadMs: 0,
      };
      const state = this._mediaFilterDebugState;
      state.operations += 1;
      if (source === 'initial_full') state.fullScans += 1;
      if (source === 'observer') state.mutationScans += 1;
      if (source === 'dimension_recheck') state.recheckScans += 1;
      state.incomingRoots += summary.incomingRoots;
      state.relevantRoots += summary.relevantRoots;
      state.discoveredTargets += summary.discoveredTargets;
      state.uniqueTargets += summary.uniqueTargets;
      MEDIA_FILTER_DEBUG_COUNTER_KEYS.forEach((key) => {
        state[key] += summary[key];
      });
      state.totalQueueWaitMs += operation.queueWaitMs;
      state.maxQueueWaitMs = Math.max(state.maxQueueWaitMs, operation.queueWaitMs);
      state.totalMs += durationMs;
      state.maxMs = Math.max(state.maxMs, durationMs);
      state.recentOperations.push(summary);
      if (state.recentOperations.length > MAX_RECENT_MEDIA_OPERATIONS) {
        state.recentOperations.splice(
          0,
          state.recentOperations.length - MAX_RECENT_MEDIA_OPERATIONS,
        );
      }
      const debugOverheadMs = operation.debugSetupMs
        + (performance.now() - bookkeepingStartedAt);
      state.debugOverheadMs += debugOverheadMs;
      summary.debugOverheadMs = Number(debugOverheadMs.toFixed(2));
      recordRuntimeOwnerWork({
        ownerId: 'visualMedia',
        phase: 'media_filter_operation',
        source: operation.source,
        startedAt: operation.startedAt,
        endedAt: operation.startedAt + durationMs,
        units: summary.uniqueTargets,
        flushId: operation.flushId,
        queueWaitMs: operation.queueWaitMs,
      });
    };
    try {
      const result = work();
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).finally(finalizeOperation);
      }
      finalizeOperation();
      return result;
    } catch (error) {
      finalizeOperation();
      throw error;
    }
  },

  _pauseMediaFilterDebugOperation() {
    const operation = this._mediaFilterDebugOperation;
    if (!operation || operation.pausedAt !== null) return null;
    operation.pausedAt = performance.now();
    this._mediaFilterDebugOperation = null;
    return operation;
  },

  _resumeMediaFilterDebugOperation(operation) {
    if (!operation || operation.pausedAt === null) return;
    operation.pausedDurationMs += Math.max(0, performance.now() - operation.pausedAt);
    operation.pausedAt = null;
    if (!this._mediaFilterDebugOperation) this._mediaFilterDebugOperation = operation;
  },

  _setMediaFilterDebugRootCounts(incomingRootCount, relevantRootCount) {
    const operation = this._mediaFilterDebugOperation;
    if (!operation) return;
    operation.incomingRoots = Number(incomingRootCount) || 0;
    operation.relevantRoots = Number(relevantRootCount) || 0;
  },

  _recordMediaFilterTargets(targets) {
    const operation = this._mediaFilterDebugOperation;
    if (!operation) return;
    const list = targets instanceof Set ? targets : new Set(targets || []);
    operation.discoveredTargets += list.size;
    list.forEach((target) => operation.uniqueTargets.add(target));
  },

  _recordMediaFilterOutcome(outcome, count = 1) {
    const operation = this._mediaFilterDebugOperation;
    if (!operation || !Object.prototype.hasOwnProperty.call(operation, outcome)) return;
    operation[outcome] += Number(count) || 0;
  },

  _runMediaFilterMeasuredPhase(phase, work) {
    const operation = this._mediaFilterDebugOperation;
    if (!operation || !Object.prototype.hasOwnProperty.call(operation, phase)) return work();
    const startedAt = performance.now();
    try {
      return work();
    } finally {
      operation[phase] += performance.now() - startedAt;
    }
  },

  _recordMediaFilterQueueWait(waitMs) {
    const operation = this._mediaFilterDebugOperation;
    if (!operation) return;
    operation.queueWaitMs += Math.max(0, Number(waitMs) || 0);
  },

  getDebugSnapshot() {
    const state = this._mediaFilterDebugState;
    return {
      loaded: true,
      available: true,
      debugEnabled: this._isDebugEnabled(),
      active: !!this._currentMediaFilter,
      observerAttached: !!this._mediaFilterObserverUnsub,
      trackedTargetCount: this._mediaFilterElements.size,
      pendingRecheckCount: this._unknownDimensionMediaRetryElements.size,
      stats: {
        ...state,
        totalQueueWaitMs: Number(state.totalQueueWaitMs.toFixed(2)),
        maxQueueWaitMs: Number(state.maxQueueWaitMs.toFixed(2)),
        expiryWaitTotalMs: Number(state.expiryWaitTotalMs.toFixed(2)),
        expiryWaitMaxMs: Number(state.expiryWaitMaxMs.toFixed(2)),
        totalMs: Number(state.totalMs.toFixed(2)),
        maxMs: Number(state.maxMs.toFixed(2)),
        debugOverheadMs: Number(state.debugOverheadMs.toFixed(2)),
        recentOperations: state.recentOperations.map((entry) => ({ ...entry })),
      },
    };
  },

  resetDebugSnapshot() {
    this._mediaFilterDebugState = createMediaFilterDebugState();
  },

  _ensureMediaFilterObserver() {
    ensureMediaFilterObserver(this);
  },

  _releaseMediaFilterObserver() {
    releaseMediaFilterObserver(this);
  },

  _safeMatches(el, selector) {
    if (!el || !(el instanceof Element) || !selector) return false;
    try {
      return el.matches(selector);
    } catch (error) {
      reportVisualSelectorFailure('visual_matches_selector_failed', error, { selector });
      return null;
    }
  },

  _safeClosest(el, selector) {
    if (!el || !(el instanceof Element) || !selector) return null;
    try {
      return el.closest(selector);
    } catch (error) {
      reportVisualSelectorFailure('visual_closest_selector_failed', error, { selector });
      return undefined;
    }
  },

  _safeQueryAll(root, selector) {
    if (!root || !selector || typeof root.querySelectorAll !== 'function') return [];
    try {
      return root.querySelectorAll(selector);
    } catch (error) {
      reportVisualSelectorFailure('visual_query_selector_failed', error, { selector });
      return null;
    }
  },

  _safeQuery(root, selector) {
    if (!root || !selector || typeof root.querySelector !== 'function') return null;
    try {
      return root.querySelector(selector);
    } catch (error) {
      reportVisualSelectorFailure('visual_query_selector_failed', error, { selector });
      return undefined;
    }
  },

  _parseDimension(value, fallback = 0) {
    return parseDimension(value, fallback);
  },

  _getElementDimensions(el) {
    return getElementDimensions(this, el);
  },

  _hasKnownElementDimensions(el) {
    return hasKnownElementDimensions(this, el);
  },

  _cleanupUnknownDimensionMediaRecheck(el) {
    const state = this._unknownDimensionMediaRetries.get(el);
    if (!state) return;
    if (state.settleTimer) clearTimeout(state.settleTimer);
    if (state.lateTimer) clearTimeout(state.lateTimer);
    if (state.expiryTimer) clearTimeout(state.expiryTimer);
    if (state.loadListener) el.removeEventListener?.('load', state.loadListener);
    if (state.metadataListener) el.removeEventListener?.('loadedmetadata', state.metadataListener);
    this._unknownDimensionMediaRetries.delete(el);
    this._unknownDimensionMediaRetryElements.delete(el);
  },

  _clearUnknownDimensionMediaRechecks() {
    for (const el of Array.from(this._unknownDimensionMediaRetryElements)) {
      this._cleanupUnknownDimensionMediaRecheck(el);
    }
  },

  _pruneUnknownDimensionMediaRechecks() {
    for (const el of Array.from(this._unknownDimensionMediaRetryElements)) {
      if (!el?.isConnected) this._cleanupUnknownDimensionMediaRecheck(el);
    }
  },

  _expireUnknownDimensionMediaRecheck(el) {
    const state = this._unknownDimensionMediaRetries.get(el);
    if (!state) return;
    if (this._isDebugEnabled()) {
      const bookkeepingStartedAt = performance.now();
      const waitMs = Math.max(0, performance.now() - state.queuedAt);
      const debugState = this._mediaFilterDebugState;
      debugState.rechecksExpired += 1;
      debugState.totalQueueWaitMs += waitMs;
      debugState.maxQueueWaitMs = Math.max(debugState.maxQueueWaitMs, waitMs);
      debugState.expiryWaitTotalMs += waitMs;
      debugState.expiryWaitMaxMs = Math.max(debugState.expiryWaitMaxMs, waitMs);
      debugState.debugOverheadMs += performance.now() - bookkeepingStartedAt;
    }
    this._cleanupUnknownDimensionMediaRecheck(el);
  },

  _scheduleUnknownDimensionMediaLateRecheck(el, state) {
    if (state.lateTimer || state.lateFallbackRun) return;
    state.lateTimer = setTimeout(
      () => this._runUnknownDimensionMediaRecheck(el, 'late'),
      UNKNOWN_DIMENSION_MEDIA_LATE_SETTLE_MS,
    );
  },

  _runUnknownDimensionMediaRecheck(el, trigger = 'settle') {
    const state = this._unknownDimensionMediaRetries.get(el);
    if (!state) return;
    return this._runMediaFilterDebugOperation(
      'dimension_recheck',
      1,
      1,
      () => {
        this._recordMediaFilterOutcome('rechecksRun');
        if (trigger === 'load') this._recordMediaFilterOutcome('loadRechecks');
        if (trigger === 'loadedmetadata') this._recordMediaFilterOutcome('metadataRechecks');
        if (trigger === 'settle') this._recordMediaFilterOutcome('settleRechecks');
        if (trigger === 'late') this._recordMediaFilterOutcome('lateRechecks');
        this._recordMediaFilterQueueWait(performance.now() - state.queuedAt);

        const pendingSettleTimer = state.settleTimer;
        state.settleTimer = null;
        if (pendingSettleTimer) clearTimeout(pendingSettleTimer);
        if (trigger === 'late') {
          state.lateFallbackRun = true;
          state.lateTimer = null;
        }

        if (!el?.isConnected || !this._currentMediaFilter || !this._currentSelectors) {
          this._cleanupUnknownDimensionMediaRecheck(el);
          return;
        }

        if (this._hasKnownElementDimensions(el)) {
          this._recordMediaFilterOutcome('rechecksResolved');
          this._cleanupUnknownDimensionMediaRecheck(el);
          this._applyMediaFiltersToRoot(el, this._currentSelectors, this._currentMediaFilter);
          return;
        }

        this._recordMediaFilterOutcome('rechecksUnresolved');
        const readinessEventConsumed = trigger === 'load' || trigger === 'loadedmetadata';
        if (readinessEventConsumed) state.readinessEventConsumed = true;
        if (
          trigger === 'late'
          && (
            !state.hasReadinessEvent
            || state.readinessAlreadySatisfied
            || state.readinessEventConsumed
          )
        ) {
          this._cleanupUnknownDimensionMediaRecheck(el);
          return;
        }
        if (state.readinessEventConsumed && state.lateFallbackRun) {
          this._cleanupUnknownDimensionMediaRecheck(el);
          return;
        }
        if (
          trigger !== 'late'
          && (
            !state.hasReadinessEvent
            || state.readinessAlreadySatisfied
            || readinessEventConsumed
          )
        ) {
          this._scheduleUnknownDimensionMediaLateRecheck(el, state);
        }
      },
      { recheckTrigger: trigger },
    );
  },

  _queueUnknownDimensionMediaRecheck(el) {
    if (!(el instanceof Element)) return;
    if (this._unknownDimensionMediaRetries.has(el)) {
      this._recordMediaFilterOutcome('rechecksCoalesced');
      return;
    }
    this._recordMediaFilterOutcome('rechecksQueued');

    const state = {
      queuedAt: performance.now(),
      settleTimer: null,
      lateTimer: null,
      expiryTimer: null,
      lateFallbackRun: false,
      hasReadinessEvent: false,
      readinessAlreadySatisfied: false,
      readinessEventConsumed: false,
      loadListener: null,
      metadataListener: null,
    };
    state.loadListener = () => this._runUnknownDimensionMediaRecheck(el, 'load');
    state.metadataListener = () => this._runUnknownDimensionMediaRecheck(el, 'loadedmetadata');
    this._unknownDimensionMediaRetries.set(el, state);
    this._unknownDimensionMediaRetryElements.add(el);

    const tagName = el.tagName?.toLowerCase() || '';
    state.hasReadinessEvent = tagName === 'img' || tagName === 'video';
    state.readinessAlreadySatisfied = tagName === 'img'
      ? el.complete === true
      : (tagName === 'video' && Number(el.readyState) >= 1);
    if (tagName === 'img') {
      el.addEventListener?.('load', state.loadListener, { once: true });
    } else if (tagName === 'video') {
      el.addEventListener?.('loadedmetadata', state.metadataListener, { once: true });
    }
    state.settleTimer = setTimeout(
      () => this._runUnknownDimensionMediaRecheck(el, 'settle'),
      UNKNOWN_DIMENSION_MEDIA_SETTLE_MS,
    );
    state.expiryTimer = setTimeout(
      () => this._expireUnknownDimensionMediaRecheck(el),
      UNKNOWN_DIMENSION_MEDIA_LOAD_GRACE_MS,
    );
  },

  _hasExcludedMediaKeyword(el, keywords) {
    return hasExcludedMediaKeyword(el, keywords);
  },

  _passesContentMediaGate(el, selectors) {
    return passesContentMediaGate(this, el, selectors);
  },

  _buildMediaFilter(filters) {
    return buildMediaFilter(filters);
  },

  _resolveMediaFilterForElement(el, selectors, mediaFilter) {
    return resolveMediaFilterForElement(this, el, selectors, mediaFilter);
  },

  _buildRootFilter(filters) {
    return buildRootFilter(filters);
  },

  _readRootFilterPreloadState() {
    return readRootFilterPreloadState();
  },

  _writeRootFilterPreloadState(nextState) {
    return writeRootFilterPreloadState(nextState);
  },

  _clearRootFilterPreloadState() {
    clearRootFilterPreloadState();
  },

  _ensureRootFilterObserver() {
    ensureRootFilterObserver(this);
  },

  _releaseRootFilterObserver() {
    releaseRootFilterObserver(this);
  },

  _ensureRootFilterCache() {
    return ensureRootFilterCache(this);
  },

  _composeRootFilter(baseFilter, rootFilter) {
    return composeRootFilter(baseFilter, rootFilter);
  },

  _stripManagedRootFilter(baseFilter, rootFilter = this._currentRootFilter) {
    return stripManagedRootFilter(baseFilter, rootFilter);
  },

  _reconcileRootFilter() {
    reconcileRootFilter(this);
  },

  _applyRootFilter(rootFilter) {
    applyRootFilter(this, rootFilter);
  },

  _restoreRootFilter() {
    restoreRootFilter(this);
  },

  _shouldApplyToMediaElement(el, selectors, options) {
    return shouldApplyToMediaElement(this, el, selectors, options);
  },

  _collectMediaTargets(root, selectors) {
    return collectMediaTargets(this, root, selectors);
  },

  _filterRelevantMediaMutationRoots(roots, selectors, options) {
    return filterRelevantMediaMutationRoots(this, roots, selectors, options);
  },

  _applyMediaFilterToElement(el, mediaFilter, overlayExemptSelector) {
    applyMediaFilterToElement(this, el, mediaFilter, overlayExemptSelector);
  },

  _applyMediaFiltersToRoot(root, selectors, mediaFilter) {
    return this._runMediaFilterDebugOperation('direct', 1, 1, () => (
      applyMediaFiltersToRoot(this, root, selectors, mediaFilter)
    ));
  },

  _applyMediaFiltersToRoots(roots, selectors, mediaFilter) {
    const rootCount = Array.isArray(roots) ? roots.length : Array.from(roots || []).length;
    return this._runMediaFilterDebugOperation('direct', rootCount, rootCount, () => (
      applyMediaFiltersToRoots(this, roots, selectors, mediaFilter)
    ));
  },

  _applyMediaFiltersToRootsCooperatively(roots, selectors, mediaFilter, options) {
    return applyMediaFiltersToRootsCooperatively(
      this,
      roots,
      selectors,
      mediaFilter,
      options,
    );
  },

  _cleanupMediaFilters() {
    cleanupMediaFilters(this);
  },

  _restoreMediaFilter(el) {
    restoreMediaFilter(this, el);
  },

  _restoreAllMediaFilters() {
    restoreAllMediaFilters(this);
  },

  update(filters) {
    this._cooperativeUpdateToken = null;
    try {
      return this._applyUpdate(filters || {});
    } catch (error) {
      reportVisualManagerFailure('manager_update', error);
      try {
        this._cleanupInFlight({ deactivate: true, throwOnFailure: true });
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  },

  async updateCooperatively(filters) {
    const token = Symbol('visual-manager-cooperative-update');
    this._cooperativeUpdateToken = token;
    try {
      const initialMediaApply = this._applyUpdate(filters || {}, {
        deferInitialMediaApply: true,
      });
      if (!initialMediaApply) return undefined;

      const { root, selectors, mediaFilter } = initialMediaApply;
      const result = await this._runMediaFilterDebugOperation('initial_full', 1, 1, () => this._applyMediaFiltersToRootsCooperatively(
        [root],
        selectors,
        mediaFilter,
        {
          isCurrent: () => (
            this._cooperativeUpdateToken === token
            && this._currentSelectors === selectors
            && this._currentMediaFilter === mediaFilter
          ),
        },
      ));
      if (result.superseded) return result;
      this._didInitialMediaApply = true;
      this._cleanupMediaFilters();
      return result;
    } catch (error) {
      if (this._cooperativeUpdateToken !== token) {
        return Object.freeze({ completed: false, superseded: true });
      }
      reportVisualManagerFailure('manager_update_cooperative', error);
      try {
        this._cleanupInFlight({ deactivate: true, throwOnFailure: true });
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    } finally {
      if (this._cooperativeUpdateToken === token) {
        this._cooperativeUpdateToken = null;
      }
    }
  },

  _applyUpdate(filters, { deferInitialMediaApply = false } = {}) {
    const saturation = filters.saturation;
    const contrast = filters.contrast;
    const mediaActive = MEDIA_VISUAL_FEATURE_KEYS.some((key) => filters[key]?.isActive === true);
    const saturationActive = !!(saturation && saturation.isActive);
    const contrastActive = !!(contrast && contrast.isActive);
    const temporalActive = !!(filters.temporal && filters.temporal.isActive);
    const isActive = mediaActive || saturationActive || temporalActive;

    if (!isActive) {
      this._cleanupInFlight({
        deactivate: true,
        throwOnFailure: true,
        preserveStateOnFailure: true,
      });
      return;
    }

    const visualVars = getVisualFilterVars(filters);
    Object.entries(visualVars).forEach(([key, value]) => {
      setRootVar(key, value);
    });
    setRootAttribute(ROOT_ATTRS.VISUAL, '1');

    const nextRootFilter = this._buildRootFilter(filters);
    this._applyRootFilter(nextRootFilter);

    if (saturationActive) {
      setRootAttribute(ROOT_ATTRS.SATURATION, '1');
    } else {
      removeRootAttribute(ROOT_ATTRS.SATURATION);
    }

    if (contrastActive) {
      setRootAttribute(ROOT_ATTRS.CONTRAST, '1');
    } else {
      removeRootAttribute(ROOT_ATTRS.CONTRAST);
    }

    if (temporalActive) {
      setRootAttribute('data-friction-temporal', '1');
      this._ensureTemporalStyle();
      this._updateTemporalState();
      if (!this._temporalTimer) {
        this._temporalTimer = setInterval(() => this._updateTemporalState(), 60000); // 1 min update
      }
    } else {
      removeRootAttribute('data-friction-temporal');
      if (this._temporalTimer) {
        clearInterval(this._temporalTimer);
        this._temporalTimer = null;
      }
    }

    const nextMediaFilter = this._buildMediaFilter(filters);
    const mediaFilterChanged = nextMediaFilter !== this._currentMediaFilter;
    this._currentMediaFilter = nextMediaFilter;

    const needsScopedTargeting = mediaActive;

    if (!needsScopedTargeting) {
      this._currentSelectors = null;
      this._releaseMediaFilterObserver();
      this._clearUnknownDimensionMediaRechecks();
      if (this._didInitialMediaApply || mediaFilterChanged) {
        this._restoreAllMediaFilters();
      }
      this._didInitialMediaApply = false;
      this._cleanupMediaFilters();
      return null;
    }

    const selectors = getMediaTargets(window.location?.hostname);
    this._currentSelectors = selectors;

    if (this._currentMediaFilter) {
      this._ensureMediaFilterObserver();
    } else {
      this._releaseMediaFilterObserver();
      this._clearUnknownDimensionMediaRechecks();
    }

    if (this._currentMediaFilter) {
      if (!this._didInitialMediaApply || mediaFilterChanged) {
        if (deferInitialMediaApply) {
          return {
            root: document.documentElement,
            selectors,
            mediaFilter: this._currentMediaFilter,
          };
        }
        this._runMediaFilterDebugOperation('initial_full', 1, 1, () => {
          this._applyMediaFiltersToRoot(document.documentElement, selectors, this._currentMediaFilter);
        });
        this._didInitialMediaApply = true;
      }
    } else {
      if (this._didInitialMediaApply || mediaFilterChanged) {
        this._restoreAllMediaFilters();
      }
      this._didInitialMediaApply = false;
    }

    this._cleanupMediaFilters();
    return null;
  },

  _runCleanupStep(phase, cleanup, errors) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
      reportVisualManagerFailure(phase, error);
    }
  },

  _resetRuntimeState() {
    this._cooperativeUpdateToken = null;
    this._mediaFilterMutationQueue = null;
    this._currentSelectors = null;
    this._currentMediaFilter = '';
    this._didInitialMediaApply = false;
    this._unknownDimensionMediaRetries = new WeakMap();
    this._unknownDimensionMediaRetryElements = new Set();
  },

  _clearTemporalTimer() {
    if (!this._temporalTimer) return;
    clearInterval(this._temporalTimer);
    this._temporalTimer = null;
  },

  _removeTemporalStyle() {
    if (!this._temporalStyle) return;
    this._temporalStyle.remove();
    this._temporalStyle = null;
  },

  _cleanupInFlight({
    deactivate = false,
    throwOnFailure = false,
    preserveStateOnFailure = false,
  } = {}) {
    const previousState = {
      currentSelectors: this._currentSelectors,
      currentMediaFilter: this._currentMediaFilter,
      didInitialMediaApply: this._didInitialMediaApply,
      unknownDimensionMediaRetries: this._unknownDimensionMediaRetries,
      unknownDimensionMediaRetryElements: this._unknownDimensionMediaRetryElements,
    };
    const errors = [];

    this._runCleanupStep('cleanup_root_attr_visual', () => removeRootAttribute(ROOT_ATTRS.VISUAL), errors);
    this._runCleanupStep('cleanup_root_attr_saturation', () => removeRootAttribute(ROOT_ATTRS.SATURATION), errors);
    this._runCleanupStep('cleanup_root_attr_contrast', () => removeRootAttribute(ROOT_ATTRS.CONTRAST), errors);
    this._runCleanupStep('cleanup_root_attr_temporal', () => removeRootAttribute('data-friction-temporal'), errors);
    this._runCleanupStep('cleanup_temporal_timer', () => this._clearTemporalTimer(), errors);
    this._runCleanupStep('cleanup_temporal_style', () => this._removeTemporalStyle(), errors);
    this._runCleanupStep('cleanup_root_filter', () => this._restoreRootFilter(), errors);
    this._runCleanupStep('cleanup_media_filters', () => this._restoreAllMediaFilters(), errors);
    this._runCleanupStep('cleanup_media_filter_observer', () => this._releaseMediaFilterObserver(), errors);
    this._runCleanupStep('cleanup_media_dimension_rechecks', () => {
      this._clearUnknownDimensionMediaRechecks();
    }, errors);
    this._runCleanupStep('cleanup_media_filter_state', () => this._cleanupMediaFilters(), errors);

    const shouldThrow = errors.length > 0 && throwOnFailure;
    if (shouldThrow && deactivate && preserveStateOnFailure) {
      this._currentSelectors = previousState.currentSelectors;
      this._currentMediaFilter = previousState.currentMediaFilter;
      this._didInitialMediaApply = previousState.didInitialMediaApply;
      this._unknownDimensionMediaRetries = previousState.unknownDimensionMediaRetries;
      this._unknownDimensionMediaRetryElements = previousState.unknownDimensionMediaRetryElements;
      throw createVisualManagerLifecycleError('VISUAL_MANAGER_CLEANUP_FAILED', errors);
    }
    if (deactivate) this._resetRuntimeState();
    if (shouldThrow) {
      throw createVisualManagerLifecycleError('VISUAL_MANAGER_CLEANUP_FAILED', errors);
    }
  },

  _temporalTimer: null,
  _temporalStyle: null,

  _ensureTemporalStyle() {
    if (this._temporalStyle) return;
    const style = document.createElement('style');
    style.id = 'friction-temporal-style';
    style.textContent = `
      html[data-friction-temporal="1"]::after {
        content: "";
        position: fixed;
        inset: 0;
        background: var(--f-temporal-overlay);
        pointer-events: none;
        z-index: 2147483647;
        mix-blend-mode: overlay;
        transition: background 1s ease;
      }
    `;
    document.head.appendChild(style);
    this._temporalStyle = style;
  },

  _updateTemporalState() {
    const h = new Date().getHours();
    let config = null;
    if (h >= 5 && h < 11) config = TEMPORAL_CONFIG.dawn;
    else if (h >= 11 && h < 16) config = TEMPORAL_CONFIG.day;
    else if (h >= 16 && h < 19) config = TEMPORAL_CONFIG.dusk;
    else config = TEMPORAL_CONFIG.night;

    if (config) {
      setRootVar('--f-temporal-overlay', config.overlay);
    }
  },

  remove() {
    this._cooperativeUpdateToken = null;
    try {
      this._cleanupInFlight({
        deactivate: true,
        throwOnFailure: true,
        preserveStateOnFailure: true,
      });
    } catch (error) {
      const removeError = createVisualManagerLifecycleError(
        'VISUAL_MANAGER_REMOVE_FAILED',
        error?.errors || [error]
      );
      reportVisualManagerFailure('manager_remove', removeError);
      throw removeError;
    }
  },
};

const TEMPORAL_CONFIG = {
  dawn: { overlay: 'linear-gradient(180deg, rgba(227, 242, 253, 0.4) 0%, rgba(255, 255, 255, 0) 100%)' },
  day: { overlay: 'linear-gradient(180deg, rgba(255, 253, 231, 0.5) 0%, rgba(255, 249, 196, 0.1) 100%)' },
  dusk: { overlay: 'linear-gradient(180deg, rgba(232, 234, 246, 0.4) 0%, rgba(197, 202, 233, 0.2) 100%)' },
  night: { overlay: 'linear-gradient(180deg, rgba(38, 50, 56, 0.8) 0%, rgba(20, 20, 20, 0.6) 100%)' },
};

export default VisualManager;
