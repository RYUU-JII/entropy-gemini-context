import { removeAttribute, setAttribute } from '../visual/FastStyleEngine.js';

export const TEXT_SHUFFLE_MARKER_ATTRIBUTE = 'data-friction-shuffled';

function isElementNode(node) {
  return !!node && node.nodeType === Node.ELEMENT_NODE;
}

function isTrackableTextNode(node) {
  return !!node
    && node.nodeType === Node.TEXT_NODE
    && typeof node.nodeValue === 'string';
}

export function createTextShuffleOwnershipLedger({
  setElementAttribute = setAttribute,
  removeElementAttribute = removeAttribute,
  presentation = null,
} = {}) {
  if (typeof setElementAttribute !== 'function') {
    throw new Error('TEXT_SHUFFLE_LEDGER_SET_ATTRIBUTE_OWNER_REQUIRED');
  }
  if (typeof removeElementAttribute !== 'function') {
    throw new Error('TEXT_SHUFFLE_LEDGER_REMOVE_ATTRIBUTE_OWNER_REQUIRED');
  }

  const trackedNodes = new Set();
  const touchedElements = new Set();
  let originalTextByNode = new WeakMap();
  let shuffledTextByNode = new WeakMap();
  let trackedParentByNode = new WeakMap();
  let trackedTargetOwnerByNode = new WeakMap();
  let trackedNodesByParent = new WeakMap();
  let trackedNodesByTargetOwner = new WeakMap();
  let trackedNodeCountByElement = new WeakMap();

  function isNodeWithinSubtree(rootNode, node) {
    if (!rootNode || !node) return false;
    if (rootNode === node) return true;
    return typeof rootNode.contains === 'function' && rootNode.contains(node);
  }

  function releaseTrackedParent(node) {
    const parent = trackedParentByNode.get(node);
    trackedParentByNode.delete(node);
    if (!parent) return false;

    const parentNodes = trackedNodesByParent.get(parent);
    parentNodes?.delete(node);
    const currentCount = parentNodes?.size || 0;
    if (currentCount > 0) {
      trackedNodeCountByElement.set(parent, currentCount);
      return true;
    }
    trackedNodesByParent.delete(parent);
    trackedNodeCountByElement.delete(parent);
    removeElementAttribute(parent, TEXT_SHUFFLE_MARKER_ATTRIBUTE);
    touchedElements.delete(parent);
    return true;
  }

  function rebaseTrackedParent(node, parent) {
    if (!isTrackableTextNode(node)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TEXT_NODE_REQUIRED');
    }
    if (!isElementNode(parent)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_PARENT_ELEMENT_REQUIRED');
    }
    const previousParent = trackedParentByNode.get(node);
    if (previousParent === parent) return false;
    if (previousParent) releaseTrackedParent(node);
    if (previousParent && presentation?.appliesTo(node)) {
      presentation.apply(node, originalTextByNode.get(node), shuffledTextByNode.get(node));
    }

    trackedParentByNode.set(node, parent);
    let parentNodes = trackedNodesByParent.get(parent);
    if (!parentNodes) {
      parentNodes = new Set();
      trackedNodesByParent.set(parent, parentNodes);
    }
    parentNodes.add(node);
    const nextCount = parentNodes.size;
    trackedNodeCountByElement.set(parent, nextCount);
    setElementAttribute(parent, TEXT_SHUFFLE_MARKER_ATTRIBUTE, '1');
    touchedElements.add(parent);
    return true;
  }

  function releaseTrackedTargetOwner(node) {
    const targetOwner = trackedTargetOwnerByNode.get(node);
    trackedTargetOwnerByNode.delete(node);
    if (!targetOwner) return false;
    const ownerNodes = trackedNodesByTargetOwner.get(targetOwner);
    ownerNodes?.delete(node);
    if (ownerNodes?.size === 0) trackedNodesByTargetOwner.delete(targetOwner);
    return true;
  }

  function rebaseTrackedTargetOwner(node, targetOwner) {
    if (!isTrackableTextNode(node)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TEXT_NODE_REQUIRED');
    }
    if (!isElementNode(targetOwner)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TARGET_OWNER_REQUIRED');
    }
    const previousOwner = trackedTargetOwnerByNode.get(node);
    if (previousOwner === targetOwner) return false;
    if (previousOwner) releaseTrackedTargetOwner(node);

    trackedTargetOwnerByNode.set(node, targetOwner);
    let ownerNodes = trackedNodesByTargetOwner.get(targetOwner);
    if (!ownerNodes) {
      ownerNodes = new Set();
      trackedNodesByTargetOwner.set(targetOwner, ownerNodes);
    }
    ownerNodes.add(node);
    return true;
  }

  function rebaseTrackedOwnership(node, { parent, targetOwner } = {}) {
    if (!isTrackableTextNode(node)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TEXT_NODE_REQUIRED');
    }
    if (!isElementNode(parent)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_PARENT_ELEMENT_REQUIRED');
    }
    if (!isElementNode(targetOwner)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TARGET_OWNER_REQUIRED');
    }
    const parentChanged = rebaseTrackedParent(node, parent);
    const targetOwnerChanged = rebaseTrackedTargetOwner(node, targetOwner);
    return parentChanged || targetOwnerChanged;
  }

  function releaseTrackedNode(node) {
    if (!trackedNodes.has(node)) return false;
    if (presentation) presentation.release(node);
    originalTextByNode.delete(node);
    shuffledTextByNode.delete(node);
    releaseTrackedParent(node);
    releaseTrackedTargetOwner(node);
    trackedNodes.delete(node);
    return true;
  }

  function applyShuffle(node, {
    original,
    shuffled,
    parent = node?.parentElement || null,
    targetOwner = parent,
  } = {}) {
    if (!isTrackableTextNode(node)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TEXT_NODE_REQUIRED');
    }
    if (typeof original !== 'string' || typeof shuffled !== 'string'
      || (original === shuffled && !presentation?.hasReadingPrefix(node))) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TEXT_PAIR_INVALID');
    }
    if (!isElementNode(parent)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_PARENT_ELEMENT_REQUIRED');
    }
    if (!isElementNode(targetOwner)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_TARGET_OWNER_REQUIRED');
    }
    if (trackedNodes.has(node)) {
      throw new Error('TEXT_SHUFFLE_LEDGER_NODE_ALREADY_TRACKED');
    }

    if (presentation?.appliesTo(node)) presentation.apply(node, original, shuffled);
    else node.nodeValue = shuffled;
    originalTextByNode.set(node, original);
    shuffledTextByNode.set(node, shuffled);
    trackedNodes.add(node);
    rebaseTrackedParent(node, parent);
    rebaseTrackedTargetOwner(node, targetOwner);
    return true;
  }

  function shouldProcessTrackedNode(node) {
    if (!originalTextByNode.has(node)) return true;
    if (isShuffleApplied(node)) return false;

    // SPA components can rewrite an owned text node in place. That write is the
    // new canonical source; release only Entropy ownership and never overwrite it.
    releaseTrackedNode(node);
    return true;
  }

  function reapplyTrackedShuffle(node, ownership) {
    if (!trackedNodes.has(node) || node.nodeValue !== originalTextByNode.get(node)) {
      return false;
    }
    // A host render of the same source is maintenance, not a new shuffle.
    // Keep ownership/markers intact; callers must revalidate live eligibility.
    rebaseTrackedOwnership(node, ownership);
    if (presentation?.appliesTo(node)) {
      if (!presentation.canPresent(node)) return restoreTrackedNode(node);
      if (!isShuffleApplied(node)) {
        presentation.apply(node, originalTextByNode.get(node), shuffledTextByNode.get(node));
      }
    } else node.nodeValue = shuffledTextByNode.get(node);
    return true;
  }

  function restoreTrackedNode(node) {
    if (!trackedNodes.has(node)) return false;
    const original = originalTextByNode.get(node);
    const shuffled = shuffledTextByNode.get(node);
    if (
      typeof original === 'string'
      && typeof shuffled === 'string'
      && !presentation?.appliesTo(node)
      && node.nodeValue === shuffled
    ) {
      node.nodeValue = original;
    }
    releaseTrackedNode(node);
    return true;
  }

  function isShuffleApplied(node) {
    if (!trackedNodes.has(node)) return false;
    const original = originalTextByNode.get(node);
    const shuffled = shuffledTextByNode.get(node);
    return presentation?.appliesTo(node)
      ? presentation.isApplied(node, original, shuffled)
      : node.nodeValue === shuffled;
  }

  function collectTrackedNodesInSubtree(rootNode) {
    if (!rootNode) return [];
    if (rootNode.nodeType === Node.TEXT_NODE) {
      return trackedNodes.has(rootNode) ? [rootNode] : [];
    }
    if (
      rootNode.nodeType !== Node.ELEMENT_NODE
      && rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) return [];

    const matches = [];
    const seen = new Set();
    const appendParentNodes = (parent) => {
      const parentNodes = trackedNodesByParent.get(parent);
      if (!parentNodes) return;
      parentNodes.forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        matches.push(node);
      });
    };
    if (rootNode.nodeType === Node.ELEMENT_NODE) appendParentNodes(rootNode);
    rootNode.querySelectorAll?.('*')
      .forEach((parent) => appendParentNodes(parent));
    return matches;
  }

  // Each yielded step accounts for an ancestry/element visit or one indexed
  // text node. Discovery must share the caller's budget, including empty areas.
  function* iterateMutationRevalidation({
    attributeRoots = [],
    childListRoots = [],
  } = {}) {
    if (trackedNodes.size === 0) return;
    const seenNodes = new Set();
    const visitedAncestryNodes = new WeakSet();
    const visitedTrackedParents = new WeakSet();
    function* visitIndexedNodes(nodes) {
      if (!nodes) return;
      for (const node of nodes) {
        if (!trackedNodes.has(node) || seenNodes.has(node)) {
          yield { node: null };
        } else {
          seenNodes.add(node);
          yield { node };
        }
      }
    }
    function* visitMutationTargetOwners(rootNode) {
      let current = rootNode?.nodeType === Node.TEXT_NODE
        ? rootNode.parentElement
        : rootNode;
      while (current instanceof Element) {
        if (visitedAncestryNodes.has(current)) break;
        visitedAncestryNodes.add(current);
        yield { node: null };
        yield* visitIndexedNodes(trackedNodesByTargetOwner.get(current));
        current = current.parentElement;
      }
    }
    function* visitTrackedSubtree(rootNode) {
      if (
        rootNode?.nodeType !== Node.ELEMENT_NODE
        && rootNode?.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
      ) return;
      // NodeIterator retains its traversal position when its reference node is
      // removed during a yield. No public marker or eager subtree query is used.
      const cursor = rootNode.ownerDocument.createNodeIterator(rootNode, NodeFilter.SHOW_ELEMENT);
      let parent;
      while ((parent = cursor.nextNode())) {
        yield { node: null };
        if (visitedTrackedParents.has(parent)) continue;
        visitedTrackedParents.add(parent);
        yield* visitIndexedNodes(trackedNodesByParent.get(parent));
      }
    }

    for (const rootNode of attributeRoots) {
      yield* visitMutationTargetOwners(rootNode);
      yield* visitTrackedSubtree(rootNode);
    }
    for (const rootNode of childListRoots) yield* visitMutationTargetOwners(rootNode);
  }

  function restoreTrackedSubtree(rootNode, nodes = null) {
    if (!rootNode) return 0;
    const tracked = nodes || collectTrackedNodesInSubtree(rootNode);
    let restored = 0;
    tracked.forEach((node) => {
      if (restoreTrackedNode(node)) restored += 1;
    });
    return restored;
  }

  function restoreAll() {
    let restored = 0;
    for (const node of Array.from(trackedNodes)) {
      if (restoreTrackedNode(node)) restored += 1;
    }
    for (const element of Array.from(touchedElements)) {
      removeElementAttribute(element, TEXT_SHUFFLE_MARKER_ATTRIBUTE);
    }
    touchedElements.clear();
    trackedNodes.clear();
    if (presentation) presentation.dispose();
    originalTextByNode = new WeakMap();
    shuffledTextByNode = new WeakMap();
    trackedParentByNode = new WeakMap();
    trackedTargetOwnerByNode = new WeakMap();
    trackedNodesByParent = new WeakMap();
    trackedNodesByTargetOwner = new WeakMap();
    trackedNodeCountByElement = new WeakMap();
    return restored;
  }

  return Object.freeze({
    applyShuffle,
    reapplyTrackedShuffle,
    collectTrackedNodesInSubtree,
    iterateMutationRevalidation,
    getOriginalText: (node) => originalTextByNode.get(node),
    getShuffledText: (node) => shuffledTextByNode.get(node),
    getTrackedElementCount: () => touchedElements.size,
    getTrackedNodeCount: () => trackedNodes.size,
    getTrackedNodes: () => Array.from(trackedNodes),
    getTrackedParent: (node) => trackedParentByNode.get(node),
    getTrackedParentRefCount: (element) => trackedNodeCountByElement.get(element) || 0,
    getTrackedTargetOwner: (node) => trackedTargetOwnerByNode.get(node),
    hasTrackedNode: (node) => trackedNodes.has(node),
    isShuffleApplied,
    canPresent: (node) => !presentation || presentation.canPresent(node),
    shouldApplyShuffle: (node, original, shuffled) => original !== shuffled
      || presentation?.hasReadingPrefix(node) === true,
    isNodeWithinSubtree,
    rebaseTrackedParent,
    rebaseTrackedOwnership,
    rebaseTrackedTargetOwner,
    releaseTrackedNode,
    restoreAll,
    restoreTrackedNode,
    restoreTrackedSubtree,
    shouldProcessTrackedNode,
  });
}
