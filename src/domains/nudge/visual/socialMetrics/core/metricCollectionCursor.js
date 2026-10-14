import { collapseMutationSourceNodes } from './dirtyRootReducer.js';

const NODES_PER_STEP = 32;

// Mechanical traversal only. The host adapter owns candidate meaning and any
// managed subtree admission. All state lives in this scan's collection plan.
export function createMetricCollectionPlan({ roots, resolveElement, getOwnedSubtree } = {}) {
  if (typeof resolveElement !== 'function') throw new Error('SOCIAL_METRIC_COLLECTION_RESOLVER_REQUIRED');
  const scopes = collapseMutationSourceNodes(Array.isArray(roots)
    ? roots : [document.documentElement]);
  const seenCandidates = new Set();
  const seenSubtrees = new WeakSet();
  return Object.freeze({
    scopes: Object.freeze(scopes),
    createScopeCursor(scope) {
      const iterators = [];
      function addSubtree(root) {
        if (!root || seenSubtrees.has(root)) return;
        seenSubtrees.add(root);
        iterators.push({ root, iterator: root.ownerDocument.createNodeIterator(root, NodeFilter.SHOW_ELEMENT) });
      }
      addSubtree(scope);
      let index = 0;
      return Object.freeze({
        next() {
          for (let visited = 0; visited < NODES_PER_STEP; visited += 1) {
            const current = iterators[index];
            if (!current) return { done: true, value: undefined };
            if (!current.root.isConnected) { index += 1; continue; }
            const element = current.iterator.nextNode();
            if (!element) { index += 1; continue; }
            if (typeof getOwnedSubtree === 'function') addSubtree(getOwnedSubtree(element));
            const candidates = resolveElement(element);
            if (candidates === null) continue;
            if (!Array.isArray(candidates)) throw new Error('SOCIAL_METRIC_COLLECTION_CANDIDATES_INVALID');
            const value = candidates.filter((candidate) => {
              if (!(candidate instanceof Element) || !candidate.isConnected || seenCandidates.has(candidate)) return false;
              seenCandidates.add(candidate);
              return true;
            });
            // At most one owner qualification per step, including a rejection.
            return { done: false, value };
          }
          return { done: false, value: [] };
        },
      });
    },
  });
}

export function collectMetricCollectionPlan(plan) {
  const candidates = [];
  for (const scope of plan.scopes) {
    const cursor = plan.createScopeCursor(scope);
    for (let step = cursor.next(); !step.done; step = cursor.next()) candidates.push(...step.value);
  }
  return candidates;
}
