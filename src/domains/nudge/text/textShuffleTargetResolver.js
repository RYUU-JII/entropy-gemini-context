import { isMeaningfulText } from '../../../lib/textFilters.js';
import { getTextTargets } from './textTargetProfiles.js';

function getSelectorErrorMessage(error) {
  return String(error?.message || error || 'TEXT_SHUFFLE_SELECTOR_FAILURE');
}

export function collapseTextShuffleMutationNodes(nodes = []) {
  const uniqueNodes = [];
  const candidateSet = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    if (!(node instanceof Node) || candidateSet.has(node)) return;
    candidateSet.add(node);
    uniqueNodes.push(node);
  });
  const ancestorCandidateCache = new WeakMap();
  const hasCandidateAncestor = (node) => {
    const visited = [];
    let current = node?.parentNode || null;
    let result = false;
    while (current) {
      if (candidateSet.has(current)) {
        result = true;
        break;
      }
      if (ancestorCandidateCache.has(current)) {
        result = ancestorCandidateCache.get(current);
        break;
      }
      visited.push(current);
      current = current.parentNode;
    }
    visited.forEach((ancestor) => ancestorCandidateCache.set(ancestor, result));
    return result;
  };
  return uniqueNodes.filter((node) => {
    const collapsed = hasCandidateAncestor(node);
    ancestorCandidateCache.set(node, true);
    return !collapsed;
  });
}

function collapseTextShuffleDependencyNodes(nodes = []) {
  const uniqueNodes = [];
  const candidateSet = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    if (!(node instanceof Node) || candidateSet.has(node)) return;
    candidateSet.add(node);
    uniqueNodes.push(node);
  });
  const ancestorCandidates = new Set();
  const traversedNodes = new WeakSet();
  uniqueNodes.forEach((node) => {
    let current = node.parentNode;
    while (current) {
      if (candidateSet.has(current)) ancestorCandidates.add(current);
      if (traversedNodes.has(current)) break;
      traversedNodes.add(current);
      current = current.parentNode;
    }
  });
  return uniqueNodes.filter((node) => !ancestorCandidates.has(node));
}

function requireSelectorContext(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('TEXT_SHUFFLE_TARGET_CONTEXT_REQUIRED');
  }
  const context = {
    overlayExemptSelector: value.overlayExemptSelector,
    excludedClosestSelector: value.excludedClosestSelector,
    textVisualSelector: value.textVisualSelector,
  };
  if (
    Object.values(context).some((selector) => (
      typeof selector !== 'string'
      || selector.length === 0
      || selector !== selector.trim()
    ))
  ) {
    throw new Error('TEXT_SHUFFLE_TARGET_CONTEXT_INVALID');
  }
  return Object.freeze(context);
}

export function createTextShuffleTargetResolver({
  resolveTextTargets = getTextTargets,
  reportSelectorFailure,
} = {}) {
  if (typeof resolveTextTargets !== 'function') {
    throw new Error('TEXT_SHUFFLE_TARGET_PROFILE_OWNER_REQUIRED');
  }
  if (typeof reportSelectorFailure !== 'function') {
    throw new Error('TEXT_SHUFFLE_TARGET_DIAGNOSTICS_OWNER_REQUIRED');
  }

  let currentContext = null;
  let selectorFailureCount = 0;
  const selectorFailureKeys = new Set();

  function setContext(context) {
    currentContext = requireSelectorContext(context);
    return currentContext;
  }

  function resolveContext(hostname = '') {
    const targets = resolveTextTargets(hostname);
    return setContext({
      overlayExemptSelector: targets.overlayExempt,
      excludedClosestSelector: targets.textShuffleExcludedClosest,
      textVisualSelector: targets.textShuffleTargets,
    });
  }

  function requireContext(context = currentContext) {
    if (!currentContext || !context) {
      throw new Error('TEXT_SHUFFLE_TARGET_CONTEXT_REQUIRED');
    }
    if (context === currentContext) return currentContext;
    const suppliedContext = requireSelectorContext(context);
    if (
      suppliedContext.overlayExemptSelector !== currentContext.overlayExemptSelector
      || suppliedContext.excludedClosestSelector !== currentContext.excludedClosestSelector
      || suppliedContext.textVisualSelector !== currentContext.textVisualSelector
    ) {
      throw new Error('TEXT_SHUFFLE_TARGET_CONTEXT_MISMATCH');
    }
    return currentContext;
  }

  function recordSelectorFailure(operation, selector, error) {
    selectorFailureCount += 1;
    const selectorText = String(selector || '');
    const errorText = getSelectorErrorMessage(error);
    const key = `${operation}|${selectorText.slice(0, 240)}|${errorText}`;
    if (selectorFailureKeys.has(key)) return;
    selectorFailureKeys.add(key);
    reportSelectorFailure(operation, selector, error);
  }

  function didSelectorFailSince(previousCount) {
    return selectorFailureCount > previousCount;
  }

  function matchesResult(element, selector, operation = 'matches') {
    if (!element || !selector || !(element instanceof Element)) {
      return { matched: false, failed: false };
    }
    try {
      return { matched: element.matches(selector), failed: false };
    } catch (error) {
      recordSelectorFailure(operation, selector, error);
      return { matched: false, failed: true };
    }
  }

  function closestResult(element, selector, operation = 'closest') {
    if (!element || !selector || !(element instanceof Element)) {
      return { element: null, failed: false };
    }
    try {
      return { element: element.closest(selector), failed: false };
    } catch (error) {
      recordSelectorFailure(operation, selector, error);
      return { element: null, failed: true };
    }
  }

  function queryAllResult(root, selector, operation = 'query_all') {
    if (!root || !selector || typeof root.querySelectorAll !== 'function') {
      return { elements: [], failed: false };
    }
    try {
      return { elements: Array.from(root.querySelectorAll(selector)), failed: false };
    } catch (error) {
      recordSelectorFailure(operation, selector, error);
      return { elements: [], failed: true };
    }
  }

  function rejectsByClosest(element, selector, operation) {
    if (!selector) return false;
    const result = closestResult(element, selector, operation);
    return result.failed || !!result.element;
  }

  function isOverlayExemptElement(element, context = currentContext) {
    const resolvedContext = requireContext(context);
    return rejectsByClosest(
      element,
      resolvedContext.overlayExemptSelector,
      'overlay_exempt_closest',
    );
  }

  function collectTopLevelTextRoots(rootNode, context = currentContext) {
    const resolvedContext = requireContext(context);
    const { textVisualSelector } = resolvedContext;
    if (!rootNode || !textVisualSelector) return { roots: [], failed: false };
    const previousCount = selectorFailureCount;
    const roots = [];
    const addRoot = (candidate) => {
      if (!(candidate instanceof Element)) return;
      if (isOverlayExemptElement(candidate, resolvedContext)) return;
      roots.push(candidate);
    };

    const rootMatch = matchesResult(rootNode, textVisualSelector, 'top_level_root_matches');
    if (rootMatch.matched) addRoot(rootNode);
    const queryResult = queryAllResult(rootNode, textVisualSelector, 'top_level_query');
    queryResult.elements.forEach(addRoot);

    const topLevelRoots = roots.filter((node) => {
      const parent = node.parentElement;
      if (!parent) return true;
      const parentResult = closestResult(
        parent,
        textVisualSelector,
        'top_level_parent_closest',
      );
      return !parentResult.failed && !parentResult.element;
    });
    return {
      roots: topLevelRoots,
      failed: didSelectorFailSince(previousCount),
    };
  }

  function resolveApplyRoots(rootDocument = document, context = currentContext) {
    const resolvedContext = requireContext(context);
    const result = collectTopLevelTextRoots(rootDocument, resolvedContext);
    return result.roots;
  }

  function resolveSubtreeRoots(rootNode, context = currentContext) {
    const resolvedContext = requireContext(context);
    if (
      !rootNode
      || (
        rootNode.nodeType !== Node.ELEMENT_NODE
        && rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
      )
    ) return [];

    const result = collectTopLevelTextRoots(rootNode, resolvedContext);
    if (result.failed || result.roots.length > 0) return result.roots;
    if (!(rootNode instanceof Element)) return [];
    const closest = closestResult(
      rootNode,
      resolvedContext.textVisualSelector,
      'pending_subtree_closest',
    );
    return closest.failed || !closest.element ? [] : [rootNode];
  }

  function resolveMutationEnqueueTarget(node, context = currentContext) {
    const resolvedContext = requireContext(context);
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent) return null;
      const target = closestResult(
        parent,
        resolvedContext.textVisualSelector,
        'within_text_target_closest',
      );
      return !target.failed && target.element
        ? Object.freeze({ kind: 'text', node })
        : null;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      return Object.freeze({ kind: 'fragment', node });
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (isOverlayExemptElement(node, resolvedContext)) return null;

    const selector = resolvedContext.textVisualSelector;
    const match = matchesResult(node, selector, 'enqueue_match');
    if (match.failed) return null;
    if (match.matched) return Object.freeze({ kind: 'subtree', node });
    const closest = closestResult(node, selector, 'enqueue_closest');
    if (closest.failed) return null;
    if (closest.element) {
      return Object.freeze({ kind: 'subtree', node: closest.element });
    }
    if (node.childElementCount <= 0) return null;
    const descendants = queryAllResult(node, selector, 'enqueue_query_all');
    if (descendants.failed || descendants.elements.length === 0) return null;
    return Object.freeze({ kind: 'subtree', node });
  }

  function qualifyTextNode(node, context = currentContext) {
    const resolvedContext = requireContext(context);
    if (!node || typeof node.nodeValue !== 'string' || !node.isConnected) return null;
    const parent = node.parentElement;
    if (!parent || parent.isContentEditable) return null;
    if (rejectsByClosest(
      parent,
      resolvedContext.overlayExemptSelector,
      'shuffle_overlay_exempt',
    )) return null;
    if (rejectsByClosest(
      parent,
      resolvedContext.excludedClosestSelector,
      'shuffle_excluded_closest',
    )) return null;
    const target = closestResult(
      parent,
      resolvedContext.textVisualSelector,
      'shuffle_text_target_closest',
    );
    if (target.failed || !target.element) return null;
    const original = node.nodeValue ?? '';
    if (!isMeaningfulText(original)) return null;
    return Object.freeze({ original, parent, targetOwner: target.element });
  }

  function resolveTrackedTextNodeOwnership(
    node,
    context = currentContext,
    rootDocument = document,
  ) {
    const resolvedContext = requireContext(context);
    if (
      !node
      || !node.isConnected
      || node.ownerDocument !== rootDocument
      || node.getRootNode?.() !== rootDocument
    ) return null;
    const parent = node.parentElement;
    if (!parent || parent.isContentEditable) return null;
    if (isOverlayExemptElement(parent, resolvedContext)) return null;
    if (rejectsByClosest(
      parent,
      resolvedContext.excludedClosestSelector,
      'reparent_excluded_closest',
    )) return null;
    const target = closestResult(
      parent,
      resolvedContext.textVisualSelector,
      'reparent_text_target_closest',
    );
    if (target.failed || !target.element) return null;
    return Object.freeze({ parent, targetOwner: target.element });
  }

  function isTrackedTextNodeEligible(node, context = currentContext, rootDocument = document) {
    return !!resolveTrackedTextNodeOwnership(node, context, rootDocument);
  }

  function normalizeMutationRevalidationRoots(mutations = [], attributeTargets = []) {
    const attributeMutations = mutations
      .filter((mutation) => mutation?.type === 'attributes');
    const attributeRoots = collapseTextShuffleMutationNodes([
      ...attributeMutations
        .map((mutation) => mutation.target),
      ...(attributeMutations.length === 0 ? attributeTargets : []),
    ]).filter((candidate) => candidate instanceof Element && candidate.isConnected);
    const childListRoots = collapseTextShuffleDependencyNodes(
      mutations
        .filter((mutation) => mutation?.type === 'childList')
        .map((mutation) => mutation.target),
    ).filter((candidate) => candidate instanceof Element && candidate.isConnected);
    const attributeRootSet = new Set(attributeRoots);
    return Object.freeze({
      attributeRoots,
      childListRoots: childListRoots.filter((root) => !attributeRootSet.has(root)),
    });
  }

  function resolveObserverAttributeFilter(context = currentContext) {
    const resolvedContext = requireContext(context);
    const selectorText = [
      resolvedContext.textVisualSelector,
      resolvedContext.overlayExemptSelector,
      resolvedContext.excludedClosestSelector,
    ].filter(Boolean).join(', ');
    const attributes = new Set();
    const attributePattern = /\[\s*([^\s~|^$*=\]]+)/g;
    let match = attributePattern.exec(selectorText);
    while (match) {
      attributes.add(String(match[1]).toLowerCase());
      match = attributePattern.exec(selectorText);
    }
    if (/(^|[^\\])\.[_a-zA-Z]/.test(selectorText)) attributes.add('class');
    if (/(^|[^\\])#[_a-zA-Z]/.test(selectorText)) attributes.add('id');
    return Array.from(attributes).sort();
  }

  function reset() {
    currentContext = null;
    selectorFailureCount = 0;
    selectorFailureKeys.clear();
  }

  return Object.freeze({
    collectTopLevelTextRoots,
    getContext: () => currentContext,
    getSelectorFailureCount: () => selectorFailureCount,
    isOverlayExemptElement,
    isTrackedTextNodeEligible,
    normalizeMutationRevalidationRoots,
    qualifyTextNode,
    reset,
    resolveApplyRoots,
    resolveContext,
    resolveMutationEnqueueTarget,
    resolveObserverAttributeFilter,
    resolveSubtreeRoots,
    resolveTrackedTextNodeOwnership,
    setContext,
  });
}
