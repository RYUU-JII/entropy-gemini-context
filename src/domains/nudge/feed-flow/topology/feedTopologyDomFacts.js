export function isFeedTopologyElement(node, documentRef) {
  const ElementCtor = documentRef?.defaultView?.Element || globalThis.Element;
  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}
export function directChildWithinFeedTopologyLane(parent, node) {
  if (!parent || !node || !parent.contains(node)) return null;
  let cursor = node;
  while (cursor?.parentNode && cursor.parentNode !== parent) cursor = cursor.parentNode;
  return cursor?.parentNode === parent ? cursor : null;
}

export function readFeedTopologyDepth(ancestor, node, maximumDepth = 8) {
  if (!ancestor || !node || !ancestor.contains(node)) return -1;
  let depth = 0;
  let cursor = node;
  while (cursor && cursor !== ancestor && depth <= maximumDepth) {
    cursor = cursor.parentElement;
    depth += 1;
  }
  return cursor === ancestor && depth <= maximumDepth ? depth : -1;
}

export function findFeedTopologyLowestCommonAncestor(left, right, documentRef) {
  if (
    !isFeedTopologyElement(left, documentRef)
    || !isFeedTopologyElement(right, documentRef)
  ) return null;
  const ancestors = new Set();
  let cursor = left;
  while (cursor) {
    ancestors.add(cursor);
    cursor = cursor.parentElement;
  }
  cursor = right;
  while (cursor) {
    if (ancestors.has(cursor)) return cursor;
    cursor = cursor.parentElement;
  }
  return null;
}

export function isUnsafeFeedTopologyLane(lane, documentRef) {
  return !lane
    || lane === documentRef?.documentElement
    || lane === documentRef?.body;
}

export function resolveFeedTopologyLane(
  referenceItem,
  candidates,
  documentRef,
) {
  const referenceIndex = candidates.indexOf(referenceItem);
  if (referenceIndex < 0) return null;
  const neighbors = [
    candidates[referenceIndex + 1],
    candidates[referenceIndex - 1],
  ].filter(Boolean);

  for (const neighbor of neighbors) {
    const lane = findFeedTopologyLowestCommonAncestor(
      referenceItem,
      neighbor,
      documentRef,
    );
    if (isUnsafeFeedTopologyLane(lane, documentRef)) continue;
    const referenceBranch = directChildWithinFeedTopologyLane(lane, referenceItem);
    const neighborBranch = directChildWithinFeedTopologyLane(lane, neighbor);
    if (
      referenceBranch
      && neighborBranch
      && referenceBranch !== neighborBranch
    ) return lane;
  }
  return null;
}

export function closestFeedTopologyCandidate(
  node,
  selector,
  documentRef,
  { outermost = true } = {},
) {
  if (!isFeedTopologyElement(node, documentRef)) return null;
  let candidate = node.matches(selector) ? node : node.closest(selector);
  if (!candidate || !outermost) return candidate;
  let cursor = candidate.parentElement;
  while (isFeedTopologyElement(cursor, documentRef) && cursor !== documentRef?.body) {
    if (cursor.matches(selector)) candidate = cursor;
    cursor = cursor.parentElement;
  }
  return candidate;
}

export function isNestedFeedTopologyCandidate(node, selector, documentRef) {
  let cursor = node?.parentElement || null;
  while (isFeedTopologyElement(cursor, documentRef) && cursor !== documentRef?.body) {
    if (cursor.matches(selector)) return true;
    cursor = cursor.parentElement;
  }
  return false;
}

export function collectOutermostFeedTopologyCandidates(
  documentRef,
  selector,
  { limit = 320 } = {},
) {
  return Array.from(documentRef?.querySelectorAll?.(selector) || [])
    .filter((node) => isFeedTopologyElement(node, documentRef) && node.isConnected)
    .filter((node) => !isNestedFeedTopologyCandidate(node, selector, documentRef))
    .slice(0, limit);
}
