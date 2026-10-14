import observerHub from '../../lib/dom/ObserverHub.js';
import { isFrictionDebugEnabled } from '@friction-debug-flags';
import { recordRuntimeOwnerWork } from '@runtime-contention-ledger';
import { recordProtectionFeatureError } from '../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { ROOT_ATTRS, removeRootAttribute, setRootAttribute } from './core/index.js';
import { requireTextRhythmShuffleProfile } from '../settings/config/textRhythmProfile.js';
import { createSeededRandom, shuffleWords } from '../../lib/textShuffle.js';
import { createTextShuffleMutationQueue } from './text/textShuffleMutationQueue.js';
import { createTextShuffleOwnershipLedger } from './text/textShuffleOwnershipLedger.js';
import { createTextShufflePresentation } from './text/textShufflePresentation.js';
import { createCooperativeMutationBatchQueue } from '../../platform/scheduling/cooperativeMutationBatchQueue.js';
import {
  createMainThreadSliceDeadline,
  yieldMainThreadContinuation,
} from '../../platform/scheduling/mainThreadCooperativeScheduler.js';
import {
  collapseTextShuffleMutationNodes,
  createTextShuffleTargetResolver,
} from './text/textShuffleTargetResolver.js';

function getTextShuffleErrorMessage(error, fallback = 'TEXT_SHUFFLE_MANAGER_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportTextShuffleFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getTextShuffleErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('textPipeline', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[TextShuffleManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createTextShuffleLifecycleError(message, errors) {
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

export function createTextShuffleManager({
  observerOwner = observerHub,
  debugEnabled = isFrictionDebugEnabled,
  recordRuntimeWork = recordRuntimeOwnerWork,
  createLedger = createTextShuffleOwnershipLedger,
  createResolver = createTextShuffleTargetResolver,
  createMutationQueue = createTextShuffleMutationQueue,
  createMutationIngress = createCooperativeMutationBatchQueue,
  createPresentation = createTextShufflePresentation,
  yieldContinuation = yieldMainThreadContinuation,
  createSliceDeadline = createMainThreadSliceDeadline,
} = {}) {
  if (!observerOwner || typeof observerOwner.subscribe !== 'function') {
    throw new Error('TEXT_SHUFFLE_MANAGER_OBSERVER_OWNER_REQUIRED');
  }
  if (
    typeof debugEnabled !== 'function'
    || typeof recordRuntimeWork !== 'function'
    || typeof createLedger !== 'function'
    || typeof createResolver !== 'function'
    || typeof createMutationQueue !== 'function'
    || typeof createMutationIngress !== 'function'
    || typeof createPresentation !== 'function'
    || typeof yieldContinuation !== 'function'
    || typeof createSliceDeadline !== 'function'
  ) {
    throw new Error('TEXT_SHUFFLE_MANAGER_COLLABORATOR_REQUIRED');
  }

  let enabled = false;
  let distanceDistribution = null;
  let wordOrder = null;
  let innerWord = null;
  let protectInformationalTokens = true;
  let observerUnsubscribe = null;
  let initialPassDone = false;
  let lastConfigSignature = null;
  let initialDebugStats = null;
  let highlightDebugEnabled = false;

  const ledger = createLedger({ presentation: createPresentation({ transformText: shuffleOriginal }) });
  const resolver = createResolver({
    reportSelectorFailure(operation, selector, error) {
      reportTextShuffleFailure(`selector_${operation}`, error, { operation, selector });
    },
  });
  const queue = createMutationQueue({
    isRuntimeEnabled: () => enabled,
    processTextNode: (node) => shuffleTextNode(node),
    resolveSubtreeRoots: (rootNode) => resolver.resolveSubtreeRoots(rootNode),
    recordRuntimeWork,
  });
  const mutationIngress = createMutationIngress({
    isCurrent: () => enabled && !!observerUnsubscribe,
    consumeBatch: processObserverMutationBatch,
    reportFailure: (error) => {
      reportTextShuffleFailure('observer_cooperative_drain', error);
    },
    yieldContinuation,
  });

  function refreshDebugMode() {
    const nextDebugEnabled = debugEnabled() === true;
    queue.setDebugEnabled(nextDebugEnabled);
    return nextDebugEnabled;
  }

  function syncDebugMarkerState() {
    if (!document.documentElement) return;
    if (enabled && debugEnabled() && highlightDebugEnabled) {
      setRootAttribute(ROOT_ATTRS.TEXT_SHUFFLE_DEBUG, '1');
      return;
    }
    removeRootAttribute(ROOT_ATTRS.TEXT_SHUFFLE_DEBUG);
  }

  function createTextSeed(text) {
    const host = typeof location !== 'undefined' ? location.hostname || '' : '';
    return `${host}|${text}`;
  }

  function shuffleOriginal(original) {
    return shuffleWords(original, {
      distanceDistribution, wordOrder, innerWord, protectInformationalTokens,
      random: createSeededRandom(createTextSeed(original)),
    });
  }

  function resolveCurrentContext() {
    return resolver.resolveContext(window.location?.hostname || '');
  }

  function maybeShieldInitialPaint() {
    if (initialPassDone || document.readyState !== 'loading' || !document.documentElement) return;
    setRootAttribute(ROOT_ATTRS.TEXT_SHUFFLE_PENDING, '1');
  }

  function removeInitialPaintShield() {
    if (!document.documentElement) return;
    removeRootAttribute(ROOT_ATTRS.TEXT_SHUFFLE_PENDING);
  }

  function finalizeInitialDebugStats() {
    removeInitialPaintShield();
    if (!initialDebugStats) return;
    if (!debugEnabled()) {
      syncDebugMarkerState();
      initialDebugStats = null;
      return;
    }
    const snapshot = queue.getDebugSnapshot();
    syncDebugMarkerState();
    console.debug('[TextShuffle] applied', {
      processed: Math.max(
        0,
        snapshot.stats.processedNodes - initialDebugStats.processedBefore,
      ),
      roots: initialDebugStats.roots,
      durationMs: Math.round(performance.now() - initialDebugStats.start),
    });
    initialDebugStats = null;
  }

  function applyAll() {
    if (!enabled) return;
    const costDebugEnabled = refreshDebugMode();
    syncDebugMarkerState();
    const context = resolveCurrentContext();
    queue.cancelInitialPass();
    const roots = resolver.resolveApplyRoots(document, context);
    if (costDebugEnabled) {
      initialDebugStats = {
        start: performance.now(),
        processedBefore: queue.getDebugSnapshot().stats.processedNodes,
        roots: roots.length,
      };
    }
    queue.startInitialPass(roots, { onComplete: finalizeInitialDebugStats });
  }

  function shuffleTextNode(node) {
    if (!ledger.canPresent(node)) {
      if (ledger.hasTrackedNode(node)) ledger.restoreTrackedNode(node);
      return false;
    }
    if (ledger.hasTrackedNode(node) && node.nodeValue === ledger.getOriginalText(node)) {
      const ownership = resolver.resolveTrackedTextNodeOwnership(node);
      if (!ownership) {
        ledger.restoreTrackedNode(node);
        return false;
      }
      return ledger.reapplyTrackedShuffle(node, ownership);
    }
    if (!ledger.shouldProcessTrackedNode(node)) return false;
    const qualification = resolver.qualifyTextNode(node);
    if (!qualification) return false;
    const { original, parent, targetOwner } = qualification;
    const shuffled = shuffleOriginal(original);
    if (!ledger.shouldApplyShuffle(node, original, shuffled)) return false;
    ledger.applyShuffle(node, {
      original,
      shuffled,
      parent,
      targetOwner,
    });
    return true;
  }

  function enqueueNode(node) {
    if (!node) return;
    const enqueueTarget = resolver.resolveMutationEnqueueTarget(node);
    if (!enqueueTarget) return;
    if (enqueueTarget.kind === 'text') {
      if (ledger.isShuffleApplied(node)) return;
      queue.enqueueTextNode(node);
      return;
    }
    if (enqueueTarget.kind === 'fragment') {
      for (const child of Array.from(node.childNodes || [])) enqueueNode(child);
      return;
    }
    queue.enqueueSubtree(enqueueTarget.node);
  }

  function shouldRetainTrackedSubtree(nodes) {
    return nodes.length > 0
      && nodes.every((node) => ledger.canPresent(node) && resolver.isTrackedTextNodeEligible(node));
  }

  function requestSliceContinuation(
    deadline,
    processed,
    isCurrent,
    diagnostics = null,
  ) {
    if (deadline.hasTime(processed)) return isCurrent();
    const pausedAt = diagnostics ? performance.now() : 0;
    return yieldContinuation()
      .then(() => {
        if (!isCurrent()) return false;
        deadline.reset();
        return true;
      })
      .finally(() => {
        if (diagnostics) {
          diagnostics.pausedDurationMs += Math.max(0, performance.now() - pausedAt);
        }
      });
  }

  async function revalidateTrackedMutationRoots(roots, schedulingState) {
    if (!roots || typeof roots !== 'object') return;
    const attributeRoots = Array.isArray(roots.attributeRoots) ? roots.attributeRoots : [];
    const childListRoots = Array.isArray(roots.childListRoots) ? roots.childListRoots : [];
    const revalidationSteps = ledger.iterateMutationRevalidation({
      attributeRoots,
      childListRoots,
    });
    let processedInSlice = schedulingState.processedInSlice;
    for (const { node } of revalidationSteps) {
      const continuation = requestSliceContinuation(
        schedulingState.deadline,
        processedInSlice,
        schedulingState.isCurrent,
        schedulingState,
      );
      if (
        continuation === false
        || (continuation !== true && !await continuation)
      ) return false;
      if (!schedulingState.deadline.hasTime(processedInSlice)) processedInSlice = 0;
      processedInSlice += 1;
      // Empty ancestry/element visits consume the same slice budget as matches.
      if (!node || !ledger.hasTrackedNode(node)) continue;
      const ownership = resolver.resolveTrackedTextNodeOwnership(node);
      if (!ownership || !ledger.canPresent(node)) {
        ledger.restoreTrackedNode(node);
      } else {
        ledger.rebaseTrackedOwnership(node, ownership);
      }
    }
    for (const rootNode of [...attributeRoots, ...childListRoots]) {
      const continuation = requestSliceContinuation(
        schedulingState.deadline,
        processedInSlice,
        schedulingState.isCurrent,
        schedulingState,
      );
      if (
        continuation === false
        || (continuation !== true && !await continuation)
      ) return false;
      if (!schedulingState.deadline.hasTime(processedInSlice)) processedInSlice = 0;
      enqueueNode(rootNode);
      processedInSlice += 1;
    }
    schedulingState.processedInSlice = processedInSlice;
    return true;
  }

  async function processObserverMutationBatch({
    addedNodes = [],
    removedNodes = [],
    textNodes = [],
    attributeTargets = [],
    mutations = [],
    queueWaitMs = 0,
  } = {}, { isCurrent }) {
    const ingressStartedAt = performance.now();
    const schedulingState = {
      deadline: createSliceDeadline(),
      isCurrent,
      pausedDurationMs: 0,
      processedInSlice: 0,
    };
    try {
      refreshDebugMode();

      // Site renderers can write the source back on hover, either in place or
      // by replacing an owned subtree. Repair these in one bounded ingress
      // slice instead of exposing the source through another debounce + idle.
      let hasTextRewrite = textNodes.some((node) => (
        ledger.hasTrackedNode(node) && !ledger.isShuffleApplied(node)
      ));

      for (const nextNode of collapseTextShuffleMutationNodes(removedNodes)) {
        const continuation = requestSliceContinuation(
          schedulingState.deadline,
          schedulingState.processedInSlice,
          isCurrent,
          schedulingState,
        );
        if (
          continuation === false
          || (continuation !== true && !await continuation)
        ) return;
        if (!schedulingState.deadline.hasTime(schedulingState.processedInSlice)) {
          schedulingState.processedInSlice = 0;
        }
        const trackedNodes = ledger.collectTrackedNodesInSubtree(nextNode);
        if (shouldRetainTrackedSubtree(trackedNodes)) {
          for (const node of trackedNodes) {
            const trackedContinuation = requestSliceContinuation(
              schedulingState.deadline,
              schedulingState.processedInSlice,
              isCurrent,
              schedulingState,
            );
            if (
              trackedContinuation === false
              || (trackedContinuation !== true && !await trackedContinuation)
            ) return;
            if (!schedulingState.deadline.hasTime(schedulingState.processedInSlice)) {
              schedulingState.processedInSlice = 0;
            }
            const ownership = resolver.resolveTrackedTextNodeOwnership(node);
            ledger.rebaseTrackedOwnership(node, ownership);
            schedulingState.processedInSlice += 1;
          }
        } else {
          if (trackedNodes.length > 0 && addedNodes.length > 0) hasTextRewrite = true;
          queue.releasePendingWorkInSubtree(nextNode);
          for (const node of trackedNodes) {
            const trackedContinuation = requestSliceContinuation(
              schedulingState.deadline,
              schedulingState.processedInSlice,
              isCurrent,
              schedulingState,
            );
            if (
              trackedContinuation === false
              || (trackedContinuation !== true && !await trackedContinuation)
            ) return;
            if (!schedulingState.deadline.hasTime(schedulingState.processedInSlice)) {
              schedulingState.processedInSlice = 0;
            }
            ledger.restoreTrackedNode(node);
            schedulingState.processedInSlice += 1;
          }
        }
        schedulingState.processedInSlice += 1;
      }

      const revalidationCompleted = await revalidateTrackedMutationRoots(
        resolver.normalizeMutationRevalidationRoots(mutations, attributeTargets),
        schedulingState,
      );
      if (revalidationCompleted === false || !isCurrent()) return;

      for (const nextNode of collapseTextShuffleMutationNodes([
        ...addedNodes,
        ...textNodes,
      ])) {
        const continuation = requestSliceContinuation(
          schedulingState.deadline,
          schedulingState.processedInSlice,
          isCurrent,
          schedulingState,
        );
        if (
          continuation === false
          || (continuation !== true && !await continuation)
        ) return;
        if (!schedulingState.deadline.hasTime(schedulingState.processedInSlice)) {
          schedulingState.processedInSlice = 0;
        }
        enqueueNode(nextNode);
        schedulingState.processedInSlice += 1;
      }
      if (!isCurrent()) return;
      if (hasTextRewrite) {
        const continuation = requestSliceContinuation(
          schedulingState.deadline,
          schedulingState.processedInSlice,
          isCurrent,
          schedulingState,
        );
        if (
          continuation === false
          || (continuation !== true && !await continuation)
        ) return;
        queue.cancelPendingFlush();
        queue.flushPending(queueWaitMs, {
          didTimeout: false,
          timeRemaining: () => schedulingState.deadline.hasTime(1) ? 2 : 0,
        });
      } else {
        queue.scheduleFlush();
      }
    } finally {
      const activeDurationMs = Math.max(
        0,
        performance.now() - ingressStartedAt - schedulingState.pausedDurationMs,
      );
      recordRuntimeWork({
        ownerId: 'textShuffle',
        phase: 'observer_ingress',
        source: 'observer_ingress',
        startedAt: ingressStartedAt,
        endedAt: ingressStartedAt + activeDurationMs,
        units: addedNodes.length
          + removedNodes.length
          + textNodes.length
          + attributeTargets.length
          + mutations.length,
        queueWaitMs,
      });
    }
  }

  function ensureObserver() {
    if (observerUnsubscribe) return;
    try {
      const attributeFilter = resolver.resolveObserverAttributeFilter();
      observerUnsubscribe = observerOwner.subscribe(
        ({
          addedNodes = [],
          removedNodes = [],
          textNodes = [],
          attributeTargets = [],
          mutations = [],
        } = {}) => {
          refreshDebugMode();
          queue.recordObserverPayload({
            addedNodes,
            removedNodes,
            textNodes,
            attributeTargets,
          });
          mutationIngress.enqueue({
            addedNodes,
            removedNodes,
            textNodes,
            attributeTargets,
            mutations,
          });
        },
        {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter,
          debugLabel: 'TextShuffleManager.observer',
        },
      );
    } catch (error) {
      observerUnsubscribe = null;
      reportTextShuffleFailure('observer_subscribe', error);
      throw error;
    }
  }

  function teardownObserver() {
    const errors = [];
    mutationIngress.cancel();
    if (observerUnsubscribe) {
      try {
        observerUnsubscribe();
        observerUnsubscribe = null;
      } catch (error) {
        errors.push(error);
        reportTextShuffleFailure('observer_unsubscribe', error);
      }
    }
    try {
      queue.cancelPendingFlush();
    } catch (error) {
      errors.push(error);
      reportTextShuffleFailure('pending_flush_cancel', error);
    }
    if (errors.length > 0) {
      throw createTextShuffleLifecycleError('TEXT_SHUFFLE_OBSERVER_TEARDOWN_FAILED', errors);
    }
  }

  function resetRuntimeState() {
    enabled = false;
    distanceDistribution = null;
    wordOrder = null;
    innerWord = null;
    protectInformationalTokens = true;
    lastConfigSignature = null;
    initialPassDone = false;
    initialDebugStats = null;
    queue.resetMutationState();
    mutationIngress.cancel();
    resolver.reset();
  }

  function runCleanupStep(phase, cleanup, errors) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
      reportTextShuffleFailure(phase, error);
    }
  }

  function cleanupInFlight({
    deactivate = false,
    throwOnFailure = false,
    preserveStateOnFailure = false,
  } = {}) {
    const previousState = {
      enabled,
      distanceDistribution,
      wordOrder,
      innerWord,
      protectInformationalTokens,
      lastConfigSignature,
      initialPassDone,
      context: resolver.getContext(),
    };
    const errors = [];
    runCleanupStep('cleanup_observer', teardownObserver, errors);
    if (errors.length > 0 && throwOnFailure && deactivate && preserveStateOnFailure) {
      throw createTextShuffleLifecycleError('TEXT_SHUFFLE_MANAGER_CLEANUP_FAILED', errors);
    }
    runCleanupStep('cleanup_apply_state', () => queue.cancelInitialPass(), errors);
    runCleanupStep('cleanup_initial_paint_shield', removeInitialPaintShield, errors);
    runCleanupStep('cleanup_text_nodes', () => ledger.restoreAll(), errors);

    if (errors.length > 0 && throwOnFailure && deactivate && preserveStateOnFailure) {
      enabled = previousState.enabled;
      distanceDistribution = previousState.distanceDistribution;
      wordOrder = previousState.wordOrder;
      innerWord = previousState.innerWord;
      protectInformationalTokens = previousState.protectInformationalTokens;
      lastConfigSignature = previousState.lastConfigSignature;
      initialPassDone = previousState.initialPassDone;
      if (previousState.context) resolver.setContext(previousState.context);
      throw createTextShuffleLifecycleError('TEXT_SHUFFLE_MANAGER_CLEANUP_FAILED', errors);
    }
    if (deactivate) resetRuntimeState();
    runCleanupStep('cleanup_debug_marker', syncDebugMarkerState, errors);
    if (errors.length > 0 && throwOnFailure) {
      throw createTextShuffleLifecycleError('TEXT_SHUFFLE_MANAGER_CLEANUP_FAILED', errors);
    }
  }

  function applyUpdate(rawShuffleProfile) {
    const shuffleProfile = requireTextRhythmShuffleProfile(rawShuffleProfile);
    const nextEnabled = shuffleProfile.enabled === true;
    const nextDistanceDistribution = shuffleProfile.distanceDistribution;
    const nextProtectInformationalTokens = shuffleProfile.protectInformationalTokens;
    const nextWordOrder = shuffleProfile.wordOrder;
    const nextInnerWord = shuffleProfile.innerWord;
    const nextConfigSignature = [
      nextDistanceDistribution.join(','),
      nextProtectInformationalTokens ? 'protect-info' : 'move-info',
      nextWordOrder?.enabled ? 'wo:1' : 'wo:0',
      nextInnerWord?.enabled ? `iw:${nextInnerWord.intensity}` : 'iw:0',
    ].join('|');

    if (!nextEnabled) {
      disable();
      return;
    }
    resolveCurrentContext();
    if (enabled && lastConfigSignature === nextConfigSignature) {
      syncDebugMarkerState();
      ensureObserver();
      initialPassDone = true;
      return;
    }
    if (enabled && lastConfigSignature !== nextConfigSignature) {
      mutationIngress.cancel();
      queue.resetMutationState();
      ledger.restoreAll();
    }

    enabled = true;
    distanceDistribution = nextDistanceDistribution;
    wordOrder = nextWordOrder;
    innerWord = nextInnerWord;
    protectInformationalTokens = nextProtectInformationalTokens;
    lastConfigSignature = nextConfigSignature;
    syncDebugMarkerState();
    maybeShieldInitialPaint();
    applyAll();
    ensureObserver();
    initialPassDone = true;
  }

  function update(shuffleProfile) {
    try {
      return applyUpdate(shuffleProfile);
    } catch (error) {
      reportTextShuffleFailure('manager_update', error);
      try {
        cleanupInFlight({ deactivate: true, throwOnFailure: true });
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      throw error;
    }
  }

  function disable() {
    if (!enabled && ledger.getTrackedNodeCount() === 0 && ledger.getTrackedElementCount() === 0) {
      return;
    }
    try {
      cleanupInFlight({
        deactivate: true,
        throwOnFailure: true,
        preserveStateOnFailure: true,
      });
    } catch (error) {
      const disableError = createTextShuffleLifecycleError(
        'TEXT_SHUFFLE_MANAGER_DISABLE_FAILED',
        error?.errors || [error],
      );
      reportTextShuffleFailure('manager_disable', disableError);
      throw disableError;
    }
  }

  function getDebugSnapshot() {
    const costDebugEnabled = refreshDebugMode();
    const queueSnapshot = queue.getDebugSnapshot();
    return {
      loaded: true,
      available: true,
      debugEnabled: costDebugEnabled,
      highlightEnabled: highlightDebugEnabled,
      active: enabled,
      observerAttached: !!observerUnsubscribe,
      observerIngress: mutationIngress.getSnapshot(),
      ...queueSnapshot,
    };
  }

  function resetDebugSnapshot() {
    queue.resetDebugSnapshot();
    refreshDebugMode();
  }

  function setHighlightDebugEnabled(value) {
    highlightDebugEnabled = value === true;
    syncDebugMarkerState();
    return highlightDebugEnabled;
  }

  function isHighlightDebugEnabled() {
    return highlightDebugEnabled;
  }

  return Object.freeze({
    disable,
    getDebugSnapshot,
    isHighlightDebugEnabled,
    resetDebugSnapshot,
    setHighlightDebugEnabled,
    update,
  });
}

const TextShuffleManager = createTextShuffleManager();

export default TextShuffleManager;
