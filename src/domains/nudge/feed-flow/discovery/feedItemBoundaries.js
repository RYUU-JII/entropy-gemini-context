import { readGenericFeedItemFeatures } from './genericFeedItemFeatures.js';

export function isSemanticFeedItemBoundary(node) {
  return node.matches('article, li, [role="article"], [role="listitem"]');
}

export function isGenericFeedItemCandidate(node) {
  const features = readGenericFeedItemFeatures(node);
  if (!features.eligible) return false;
  if (features.canonicalItem) return true;
  if (features.classHint && (features.media || features.action || features.textLength >= 24)) {
    return true;
  }
  return features.siblingSimilarity >= 0.45 && (
    features.media || (features.action && features.textLength >= 16) || features.textLength >= 48
  );
}

// Callers own candidate eligibility, scan bounds, and the declared region. This
// seam only resolves overlapping candidates; it does not certify a feed.
export function resolveFeedItemBoundaries(candidates, { declared = false } = {}) {
  const unique = Array.from(new Set(candidates));
  const candidateSet = new Set(unique);
  const childrenByParent = new Map(unique.map((node) => [node, []]));
  const roots = [];
  for (const node of unique) {
    let parent = node.parentElement;
    while (parent && !candidateSet.has(parent)) parent = parent.parentElement;
    if (parent) childrenByParent.get(parent).push(node);
    else roots.push(node);
  }
  const visit = (node) => {
    // A declared item or semantic article/list item owns its nested content.
    if (declared || isSemanticFeedItemBoundary(node)) return [node];
    const children = childrenByParent.get(node);
    const containsSemanticItem = unique.some((child) => child !== node && node.contains(child)
      && isSemanticFeedItemBoundary(child));
    if (children.length > 1 || containsSemanticItem) return children.flatMap(visit);
    return [node];
  };
  return roots.flatMap(visit);
}
