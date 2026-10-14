import observerHub from '../../../lib/dom/ObserverHub.js';
import { createCooperativeMutationBatchQueue } from '../../../platform/scheduling/cooperativeMutationBatchQueue.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import { iterateMediaOwnershipScope, resolveMediaTargetingPlan } from './mediaFilterController.js';

function getVisualObserverErrorMessage(error, fallback = 'VISUAL_OBSERVER_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportVisualObserverFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getVisualObserverErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('visualManager', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[VisualManager] observer failure', diagnostic);
  }
  return diagnostic;
}

export function normalizeObservedElementRoots(nodes = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const candidates = new Set();
  nodes.forEach((node) => {
    let element = null;
    if (node instanceof Element) {
      element = node;
    } else if (node?.nodeType === Node.TEXT_NODE) {
      element = node.parentElement;
    }
    if (!(element instanceof Element)) return;
    if (!element.isConnected) return;
    candidates.add(element);
  });

  return Array.from(candidates).filter((element) => {
    let ancestor = element.parentElement;
    while (ancestor instanceof Element) {
      if (candidates.has(ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

function collectShortFormContextPromotionRoots(manager, mutations, selectors) {
  const plan = resolveMediaTargetingPlan(selectors);
  const contextSelector = plan.shortFormDescendantContextSelector;
  if (!contextSelector || !Array.isArray(mutations) || mutations.length === 0) return [];

  const roots = new Set();
  const addContextForTarget = (target) => {
    if (!(target instanceof Element)) return;
    if (manager._safeMatches(target, contextSelector) === true) {
      roots.add(target);
      return;
    }
    const context = manager._safeClosest(target, contextSelector);
    if (context instanceof Element) roots.add(context);
  };
  const containsContextLink = (node) => (
    node instanceof Element
    && (
      manager._safeMatches(node, plan.shortFormLinkSelector) === true
      || manager._safeQuery(node, plan.shortFormLinkSelector) instanceof Element
    )
  );

  for (const mutation of mutations) {
    if (mutation?.type === 'attributes' && mutation.attributeName === 'href') {
      addContextForTarget(mutation.target);
      continue;
    }
    if (mutation?.type !== 'childList') continue;
    const changedLinks = [
      ...Array.from(mutation.addedNodes || []),
      ...Array.from(mutation.removedNodes || []),
    ].some(containsContextLink);
    if (changedLinks) addContextForTarget(mutation.target);
  }
  return Array.from(roots);
}

function collectPendingUnknownDimensionAncestorRoots(manager) {
  const ancestors = new Set();
  for (const media of manager._unknownDimensionMediaRetryElements || []) {
    let current = media;
    while (current instanceof Element) {
      ancestors.add(current);
      current = current.parentElement;
    }
  }
  return ancestors;
}

function collectShortFormStructuralContextRoots(manager, mutations, selectors) {
  const plan = resolveMediaTargetingPlan(selectors);
  const contextSelector = plan.shortFormStructuralContextSelector;
  const evidenceSelector = plan.shortFormStructuralEvidenceSelector;
  if (!contextSelector || !evidenceSelector) return [];

  const roots = new Set();
  const elementChanges = [];
  const removedParents = new Map();
  for (const mutation of mutations) {
    if (mutation.type !== 'childList' || !(mutation.target instanceof Element)) continue;
    let hasElement = false;
    for (const node of mutation.removedNodes || []) {
      if (!(node instanceof Element)) continue;
      hasElement = true;
      const parents = removedParents.get(node) || new Set();
      parents.add(mutation.target);
      removedParents.set(node, parents);
    }
    if (!hasElement) {
      for (const node of mutation.addedNodes || []) {
        if (node instanceof Element) { hasElement = true; break; }
      }
    }
    if (hasElement) elementChanges.push(mutation);
  }
  const contextsByTarget = new Map();
  const contextMatches = new Map();
  const admittedTargets = new Set();
  const removalContexts = new Set();
  for (const mutation of elementChanges) {
    const target = mutation.target;
    if (admittedTargets.has(target)) continue;
    let contexts = contextsByTarget.get(target);
    if (!contexts) {
      contexts = [];
      const pending = [target];
      const visited = new Set();
      // MutationRecord nodes are live, not subtree snapshots. A removed wrapper
      // can lose its evidence before delivery. Its later childList record must
      // still reach the former parent recorded in this same observer batch.
      while (pending.length > 0) {
        const ancestor = pending.pop();
        if (!(ancestor instanceof Element) || visited.has(ancestor)) continue;
        visited.add(ancestor);
        if (ancestor.isConnected) {
          if (!contextMatches.has(ancestor)) {
            const match = manager._safeMatches(ancestor, contextSelector);
            if (match === null) return [];
            contextMatches.set(ancestor, match);
          }
          if (contextMatches.get(ancestor)) contexts.push(ancestor);
        }
        if (ancestor.parentElement) pending.push(ancestor.parentElement);
        for (const parent of removedParents.get(ancestor) || []) pending.push(parent);
      }
      contextsByTarget.set(target, contexts);
    }
    if (contexts.length === 0) continue;
    if (Array.from(mutation.removedNodes || []).some(node => node instanceof Element)) {
      contexts.forEach(context => removalContexts.add(context));
    }
    // Inspect changed subtrees only inside a declared context. Removed evidence
    // is disconnected, but its live record target still owns revalidation.
    let relevant = false;
    for (const nodes of [mutation.addedNodes, mutation.removedNodes]) {
      for (const node of nodes || []) {
        if (!(node instanceof Element)) continue;
        const self = manager._safeMatches(node, evidenceSelector);
        if (self === null) return [];
        const descendant = self ? null : manager._safeQuery(node, evidenceSelector);
        if (descendant === undefined) return [];
        if (self || descendant instanceof Element) { relevant = true; break; }
      }
      if (relevant) break;
    }
    if (relevant) {
      admittedTargets.add(target);
      contexts.forEach(context => roots.add(context));
    }
  }

  // A detached subtree can be rewritten after native delivery, when it is no
  // longer observed, but before this cooperative batch consumes its live nodes.
  // Reconcile lost context from currently owned non-base effects, not from an
  // assumed snapshot of the removed subtree. Retained positive contexts and
  // ordinary base-strength media do not need an additional media scan.
  const revokedContexts = new Set();
  if (manager._mediaFilterElements.size > 0) {
    for (const context of removalContexts) {
      if (roots.has(context)) continue;
      const evidence = manager._safeQuery(context, evidenceSelector);
      if (evidence === undefined) return [];
      if (!(evidence instanceof Element)) revokedContexts.add(context);
    }
  }
  if (revokedContexts.size > 0) {
    for (const context of revokedContexts) {
      for (const media of iterateMediaOwnershipScope(manager, context)) {
        if (!manager._mediaFilterElements.has(media)) continue;
        manager._recordMediaFilterOutcome?.('trackedTargetVisits');
        const owned = manager._mediaFilterCache.get(media);
        if (!media.isConnected || !owned?.active
          || owned.managedFilter === manager._currentMediaFilter) continue;
        roots.add(context);
        break;
      }
    }
  }
  return Array.from(roots);
}

function filterAttributeMutationRoots(manager, targets, mutations, selectors) {
  const targetList = Array.from(targets || []);
  if (targetList.length === 0) return { roots: [], skipped: 0 };

  const attributeNamesByTarget = new Map();
  for (const mutation of mutations || []) {
    if (mutation?.type !== 'attributes' || !(mutation.target instanceof Element)) continue;
    const names = attributeNamesByTarget.get(mutation.target) || new Set();
    if (mutation.attributeName) names.add(mutation.attributeName);
    attributeNamesByTarget.set(mutation.target, names);
  }

  const plan = resolveMediaTargetingPlan(selectors);
  const descendantAttributes = new Set(plan.descendantRevalidationAttributes || []);
  const pendingUnknownDimensionAncestors = collectPendingUnknownDimensionAncestorRoots(manager);
  const roots = targetList.filter((target) => {
    const attributeNames = attributeNamesByTarget.get(target);
    if (!attributeNames || attributeNames.size === 0) return true;
    const isManagedTargetStyleOnly = manager._mediaFilterElements.has(target)
      && attributeNames.size === 1
      && attributeNames.has('style');
    if (isManagedTargetStyleOnly) {
      // Host filter rewrites need no qualification replay: the additive effect
      // already follows the underlying filter. Style is also candidate evidence
      // for background media, so its loss must reach owned-target reconciliation.
      const remainsCandidate = manager._safeMatches(target, plan.discoverySelector);
      if (remainsCandidate === true) {
        manager._recordMediaFilterOutcome?.('managedTargetStyleRootsSkipped');
        return false;
      }
      return remainsCandidate === false;
    }
    if (Array.from(attributeNames).some((name) => descendantAttributes.has(name))) return true;
    if (manager._mediaFilterElements.has(target)) return true;
    if (manager._safeMatches(target, plan.discoverySelector) === true) return true;
    return pendingUnknownDimensionAncestors.has(target);
  });

  return {
    roots,
    skipped: Math.max(0, targetList.length - roots.length),
  };
}

function createMediaFilterMutationQueue(manager) {
  return createCooperativeMutationBatchQueue({
    isCurrent: () => !!manager._mediaFilterObserverUnsub && !!manager._currentSelectors,
    reportFailure: (error) => {
      reportVisualObserverFailure('media_filter_observer_cooperative_drain', error);
    },
    consumeBatch: async ({
      addedNodes,
      removedNodes,
      attributeTargets,
      mutations,
      flushId,
      queueWaitMs,
    }, { isCurrent }) => {
      const selectors = manager._currentSelectors;
      const mediaFilter = manager._currentMediaFilter || '';
      if (!selectors || !isCurrent()) return;

      const runObserverWork = async () => {
        manager._recordMediaFilterQueueWait?.(queueWaitMs);
        const hasDocumentRootAttributeTarget = attributeTargets
          .includes(document.documentElement);
        const hasRelevantDocumentRootAttribute = hasDocumentRootAttributeTarget
          && mutations.some((mutation) => (
            mutation?.type === 'attributes'
            && mutation.target === document.documentElement
            && mutation.attributeName !== 'style'
          ));
        const scopedAttributeTargets = attributeTargets.filter(
          (node) => (
            node !== document.documentElement
            || hasRelevantDocumentRootAttribute
          ),
        );
        const attributeRoots = filterAttributeMutationRoots(
          manager,
          scopedAttributeTargets,
          mutations,
          selectors,
        );
        manager._recordMediaFilterOutcome?.(
          'attributeRootsSkipped',
          attributeRoots.skipped,
        );
        const promotedContextRoots = [
          ...collectShortFormContextPromotionRoots(manager, mutations, selectors),
          ...collectShortFormStructuralContextRoots(manager, mutations, selectors),
        ];
        const hasRemovalWork = removedNodes.length > 0;
        const additionsOnly = !hasRemovalWork
          && attributeRoots.roots.length === 0
          && promotedContextRoots.length === 0;

        const dirtyRoots = normalizeObservedElementRoots([
          ...addedNodes,
          ...attributeRoots.roots,
          ...promotedContextRoots,
        ]);
        const relevantRoots = manager._filterRelevantMediaMutationRoots(
          dirtyRoots,
          selectors,
          { reconcileExistingTargets: !additionsOnly },
        );
        manager._setMediaFilterDebugRootCounts?.(dirtyRoots.length, relevantRoots.length);
        if (additionsOnly) manager._recordMediaFilterOutcome?.('additionOnlyBatches');
        if (relevantRoots.length === 0 && !hasRemovalWork) {
          manager._recordMediaFilterOutcome?.('zeroWorkMutationScans');
        }
        if (relevantRoots.length > 0) {
          const result = await manager._applyMediaFiltersToRootsCooperatively(
            relevantRoots,
            selectors,
            mediaFilter,
            {
              reconcileExistingTargets: !additionsOnly,
              isCurrent: () => (
                isCurrent()
                && manager._currentSelectors === selectors
                && manager._currentMediaFilter === mediaFilter
              ),
            },
          );
          if (result.superseded || !isCurrent()) return;
        }
        if (relevantRoots.length === 0 && !hasRemovalWork) return;
        // Attribute/context revalidation cannot disconnect unrelated targets.
        // Real removals keep the exact global cleanup: detached subtrees may be
        // rewritten after native delivery, so their live descendants alone are
        // insufficient evidence for releasing all removed effects.
        if (hasRemovalWork) {
          manager._cleanupMediaFilters();
          manager._pruneUnknownDimensionMediaRechecks();
        }
      };

      if (typeof manager._runMediaFilterDebugOperation === 'function') {
        await manager._runMediaFilterDebugOperation(
          'observer',
          0,
          0,
          runObserverWork,
          { flushId },
        );
        return;
      }
      await runObserverWork();
    },
  });
}

export function ensureMediaFilterObserver(manager) {
  if (manager._mediaFilterObserverUnsub) return;
  try {
    const observerAttributes = resolveMediaTargetingPlan(
      manager._currentSelectors,
    ).observerAttributes;
    manager._mediaFilterMutationQueue = createMediaFilterMutationQueue(manager);
    manager._mediaFilterObserverUnsub = observerHub.subscribe(
      (payload = {}, debugContext) => {
        manager._mediaFilterMutationQueue?.enqueue(payload, {
          flushId: debugContext?.flushId || null,
        });
      },
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: observerAttributes,
        debugLabel: 'VisualManager.mediaFilterObserver',
      },
    );
  } catch (error) {
    manager._mediaFilterMutationQueue?.cancel();
    manager._mediaFilterMutationQueue = null;
    manager._mediaFilterObserverUnsub = null;
    reportVisualObserverFailure('media_filter_observer_subscribe', error);
    throw error;
  }
}

export function releaseMediaFilterObserver(manager) {
  if (!manager._mediaFilterObserverUnsub) {
    manager._mediaFilterMutationQueue?.cancel();
    manager._mediaFilterMutationQueue = null;
    return;
  }
  manager._mediaFilterMutationQueue?.cancel();
  try {
    manager._mediaFilterObserverUnsub();
    manager._mediaFilterObserverUnsub = null;
    manager._mediaFilterMutationQueue = null;
  } catch (error) {
    reportVisualObserverFailure('media_filter_observer_unsubscribe', error);
    throw error;
  }
}
