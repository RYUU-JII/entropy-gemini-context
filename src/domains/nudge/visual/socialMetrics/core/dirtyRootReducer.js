function toObservedElement(node) {
  if (node instanceof Element) return node;
  if (node?.nodeType === Node.TEXT_NODE) return node.parentElement;
  return null;
}

export function collectUniqueMutationSourceNodes(nodes = []) {
  const elements = [];
  const seen = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const element = toObservedElement(node);
    if (!(element instanceof Element) || !element.isConnected || seen.has(element)) return;
    seen.add(element);
    elements.push(element);
  });
  return elements;
}

export function collapseMutationSourceNodes(nodes = []) {
  const elements = collectUniqueMutationSourceNodes(nodes);
  const seen = new Set(elements);
  return elements.filter((element) => {
    let ancestor = element.parentElement;
    while (ancestor) {
      if (seen.has(ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

export function collectRemovalMutationTargets(payload = {}) {
  return (payload.mutations || [])
    .filter((record) => record.type === 'childList' && record.removedNodes?.length > 0)
    .map((record) => record.target);
}

export function collectMutationCausalRoots(payload = {}) {
  return collapseMutationSourceNodes([
    ...(payload.addedNodes || []),
    ...(payload.attributeTargets || []),
    ...(payload.textNodes || []),
    ...collectRemovalMutationTargets(payload),
  ]);
}

function addResolvedRoot(rootSet, root) {
  if (!(root instanceof Element)) return;
  if (!root.isConnected) return;
  rootSet.add(root);
}

function resolveMatchingRoots(element, rootSelector) {
  if (!(element instanceof Element) || !element.isConnected) return [];
  if (!rootSelector) return [element];

  const matches = new Set();
  if (element.matches?.(rootSelector)) {
    matches.add(element);
  }

  const closest = element.closest?.(rootSelector);
  if (closest) {
    matches.add(closest);
  }

  if (matches.size > 0) return Array.from(matches);

  if (typeof element.querySelectorAll === 'function') {
    element.querySelectorAll(rootSelector).forEach((candidate) => matches.add(candidate));
  }

  return Array.from(matches);
}

function addMutationNodeRoots(node, rootSet, rootSelector) {
  const element = toObservedElement(node);
  if (!(element instanceof Element) || !element.isConnected) return;
  resolveMatchingRoots(element, rootSelector).forEach((root) => addResolvedRoot(rootSet, root));
}

export function normalizeRoots(roots) {
  if (!Array.isArray(roots) || roots.length === 0) return [];
  // Keep the first occurrence order of surviving connected Element roots.
  // Document/null full-scan sentinels belong to the caller, not this reducer.
  const candidates = new Set(roots.filter((node) => node instanceof Element && node.isConnected));
  return Array.from(candidates).filter((node) => {
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (candidates.has(ancestor)) return false;
    }
    return true;
  });
}

export function collectMutationRoots(payload = {}, { rootSelector = '' } = {}) {
  const roots = new Set();
  collectMutationCausalRoots(payload)
    .forEach((node) => addMutationNodeRoots(node, roots, rootSelector));
  return normalizeRoots(Array.from(roots));
}
