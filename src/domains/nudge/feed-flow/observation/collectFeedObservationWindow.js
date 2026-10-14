import { FEED_OBSERVATION_LIMITS as LIMITS } from './feedObservationLimits.js';
import { isGenericFeedItemCandidate, isSemanticFeedItemBoundary } from '../discovery/feedItemBoundaries.js';

const PROBE_RATIOS = Object.freeze([0.05, 0.5, 0.95]);
const unavailable = (reason) => ({ status: 'unavailable', reason });
const intersects = (rect, viewport) => rect.width > 0 && rect.height > 0
  && rect.right > viewport.left && rect.left < viewport.right
  && rect.bottom > viewport.top && rect.top < viewport.bottom;

// A viewport-local observation window, never a complete region inventory.
// Native point hits seed current ownership. Nearby DOM branches contribute only
// bounded context; old offscreen history is neither enumerated nor inferred.
export function collectFeedObservationWindow({ region, selector, windowRef, declared }) {
  if (typeof declared !== 'boolean') throw new Error('FEED_OBSERVATION_DECLARATION_REQUIRED');
  region.matches(selector); // A malformed declaration must fail even without hits.
  const documentRef = region.ownerDocument;
  if (typeof documentRef.elementsFromPoint !== 'function') return unavailable('viewport_probe_unavailable');
  const rect = region.getBoundingClientRect();
  const viewport = { left: Math.max(0, rect.left), top: Math.max(0, rect.top),
    right: Math.min(windowRef.innerWidth, rect.right), bottom: Math.min(windowRef.innerHeight, rect.bottom) };
  if (viewport.right <= viewport.left || viewport.bottom <= viewport.top) return unavailable('region_outside_viewport');
  const seeds = new Set();
  for (const xRatio of PROBE_RATIOS) {
    for (const yRatio of PROBE_RATIOS) {
      const hits = documentRef.elementsFromPoint(
        viewport.left + (viewport.right - viewport.left) * xRatio,
        viewport.top + (viewport.bottom - viewport.top) * yRatio,
      );
      if (hits.length > LIMITS.hitLayers) return unavailable('viewport_hit_stack_truncated');
      for (const hit of hits) {
        if (!hit.isConnected || hit === region || !region.contains(hit)) continue;
        const ancestors = [];
        let node = hit;
        let depth = 0;
        while (node && node !== region && depth < LIMITS.ancestorDepth) {
          if (node.matches(selector)) ancestors.push(node);
          node = node.parentElement;
          depth += 1;
        }
        if (node !== region) return unavailable('item_ancestry_truncated');
        // A generic div wrapper is not an item declaration. Prefer semantic
        // ownership; otherwise seed from the nearest qualified local candidate.
        // Shared boundary resolution still owns overlap after acquisition.
        const semantic = declared ? [] : ancestors.filter(isSemanticFeedItemBoundary);
        const candidate = declared ? ancestors.at(-1)
          : semantic.length ? semantic.at(-1) : ancestors.find(isGenericFeedItemCandidate);
        if (candidate) seeds.add(candidate);
      }
    }
  }
  if (seeds.size === 0) return unavailable('viewport_items_unavailable');
  if (seeds.size > LIMITS.items) return unavailable('item_window_truncated');

  const items = new Set(seeds);
  const visited = new Set(seeds);
  let remaining = LIMITS.visitedElements;
  let truncated = false;
  const spend = () => {
    if (remaining <= 0) { truncated = true; return false; }
    remaining -= 1;
    return true;
  };
  function adjacentBranch(node, direction) {
    while (node && node !== region) {
      if (!spend()) return null;
      const sibling = direction < 0 ? node.previousElementSibling : node.nextElementSibling;
      if (sibling) return sibling;
      node = node.parentElement;
    }
    return null;
  }
  function inspectBranch(branch) {
    const found = [];
    const stack = [branch];
    while (stack.length && !truncated) {
      const node = stack.pop();
      if (!spend()) break;
      if (node !== branch && node.nextElementSibling) stack.push(node.nextElementSibling);
      if (node.matches(selector) && (declared || isGenericFeedItemCandidate(node))) {
        if (!items.has(node) && items.size >= LIMITS.items) { truncated = true; break; }
        items.add(node); found.push(node);
        // Only declared/semantic items own descendants outright. Heuristic
        // wrappers must expose their nested candidates to shared resolution.
        if (declared || isSemanticFeedItemBoundary(node)) continue;
      }
      // Push one sibling continuation at a time: a large wrapper must not
      // allocate an unbounded children array before the work budget applies.
      if (node.firstElementChild) stack.push(node.firstElementChild);
    }
    return found;
  }
  for (const seed of seeds) {
    for (const direction of [-1, 1]) {
      let cursor = seed;
      while (!truncated) {
        const branch = adjacentBranch(cursor, direction);
        if (!branch || visited.has(branch)) break;
        visited.add(branch);
        const found = inspectBranch(branch);
        const localRects = found.length ? found.map((node) => node.getBoundingClientRect()) : [branch.getBoundingClientRect()];
        // This closes this local neighborhood, not a claim that later CSS/DOM
        // branches cannot overlap the viewport. Other point hits seed their own.
        if (localRects.every((value) => value.width > 0 && value.height > 0 && !intersects(value, viewport))) break;
        cursor = branch;
      }
    }
  }
  if (truncated) return unavailable('item_window_truncated');
  const ordered = [...items].sort((left, right) => left === right ? 0
    : left.compareDocumentPosition(right) & 4 ? -1 : 1);
  return { status: 'resolved', items: ordered, window: {
    basis: 'viewport_probe_neighborhood', completeRegion: false,
    probePoints: PROBE_RATIOS.length ** 2, seedItems: seeds.size,
    visitedElements: LIMITS.visitedElements - remaining,
  } };
}
