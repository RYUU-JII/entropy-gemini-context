import { GENERIC_FEED_ITEM_SELECTOR } from '../discovery/genericFeedItemFeatures.js';
import { resolveFeedItemBoundaries } from '../discovery/feedItemBoundaries.js';
import { getRootScroller, isRootLikeScroller } from '../resolve/ActiveScrollContainerResolver.js';
import { collectFeedObservationWindow } from './collectFeedObservationWindow.js';
import { FEED_OBSERVATION_LIMITS } from './feedObservationLimits.js';

// Observation declarations only: no endpoint safety or behavioral authority.
const REGIONS = Object.freeze({
  'x:home': { selector: 'main', layout: 'vertical_list' },
  'facebook:home': { selector: '[role="main"] [role="feed"]', layout: 'vertical_list' },
  'instagram:home': { selector: 'main', layout: 'vertical_list' },
  'instagram:reels': { selector: 'main', layout: 'paged_item' },
  'instagram:explore': { selector: 'main', layout: 'grid' },
  'tiktok:feed': { selector: 'main, [role="main"]', layout: 'paged_item' },
  'youtube:home': { selector: 'ytd-rich-grid-renderer', layout: 'grid' },
  'youtube:browse': { selector: 'ytd-section-list-renderer', layout: null },
  'youtube:shorts': { selector: '#shorts-container', layout: 'paged_item' },
});
function collect(root, selector) {
  root.matches(selector); // Validate even an empty region; never widen a bad selector.
  const nodes = [];
  let visited = 0;
  let node = root;
  while (node && visited < FEED_OBSERVATION_LIMITS.visitedElements && nodes.length < FEED_OBSERVATION_LIMITS.items) {
    visited += 1;
    const matched = node.matches(selector);
    if (matched) nodes.push(node);
    if (!matched && node.firstElementChild) { node = node.firstElementChild; continue; }
    // Outermost declared regions own their descendants. Enumerating their feed
    // history cannot discover another independent region and wasted the budget.
    while (node !== root && !node.nextElementSibling) node = node.parentElement;
    node = node === root ? null : node.nextElementSibling;
  }
  return { nodes, complete: node === null };
}

function readStyle(element, windowRef, styles) {
  if (!styles.has(element)) styles.set(element, windowRef.getComputedStyle(element));
  return styles.get(element);
}

function rendered(element, windowRef, styles) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  for (let node = element; node; node = node.parentElement) {
    const style = readStyle(node, windowRef, styles);
    if (node.hidden || style.display === 'none' || style.visibility === 'hidden'
      || style.opacity === '0' || style.contentVisibility === 'hidden') return false;
  }
  return true;
}

function inferLayout(items) {
  if (items.length < 2) return null;
  const rects = items.map((item) => item.getBoundingClientRect());
  if (rects.some((rect) => rect.width <= 0 || rect.height <= 0)) return null;
  const sideBySide = rects.some((left, i) => rects.some((right, j) => i !== j
    && Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top)
    && (left.right <= right.left || right.right <= left.left)));
  if (sideBySide) return 'grid';
  const stacked = rects.slice(1).every((rect, i) => rect.top >= rects[i].bottom - 1);
  return stacked ? 'vertical_list' : null;
}

function scrollerFor(item, documentRef, windowRef, styles) {
  for (let node = item.parentElement; node; node = node.parentElement) {
    if (isRootLikeScroller(node, documentRef)) break;
    const style = readStyle(node, windowRef, styles);
    if (['auto', 'scroll', 'overlay'].includes(style.overflowY)
      || ['auto', 'scroll', 'overlay'].includes(style.overflow)) return node;
  }
  return getRootScroller(documentRef);
}

const unavailable = (reason) => ({ status: 'unavailable', reason });

export function resolveFeedObservationRegion({ surface, documentRef, windowRef }) {
  if (!surface || !documentRef?.documentElement || !windowRef) return unavailable('surface_unavailable');
  const generic = surface.profileId === 'default';
  const declaration = generic ? { selector: 'main, [role="main"], [role="feed"]', layout: null }
    : REGIONS[surface.semanticSurfaceId];
  if (!declaration) return { status: 'unsupported', reason: 'region_not_declared' };
  if (!generic && (typeof surface.candidateItemSelectors !== 'string' || !surface.candidateItemSelectors.trim())) {
    throw new Error('FEED_OBSERVATION_ITEM_DECLARATION_REQUIRED');
  }
  const roots = collect(documentRef.documentElement, declaration.selector);
  if (!roots.complete) return unavailable('region_scan_truncated');
  const styles = new Map();
  const candidates = roots.nodes.filter((region) => rendered(region, windowRef, styles));
  // Nested declarations describe one region; independent visible regions remain ambiguous.
  const regions = resolveFeedItemBoundaries(candidates, { declared: true });
  if (regions.length !== 1) return unavailable(regions.length ? 'multiple_regions' : 'region_missing');
  const region = regions[0];
  const collected = collectFeedObservationWindow({ region, windowRef, declared: !generic,
    selector: generic ? GENERIC_FEED_ITEM_SELECTOR : surface.candidateItemSelectors });
  if (collected.status !== 'resolved') return collected;
  const items = resolveFeedItemBoundaries(collected.items.filter((item) => item !== region), { declared: !generic });
  if (!items.length) return unavailable('items_missing');
  const geometryItems = items.filter((item) => rendered(item, windowRef, styles));
  const layout = declaration.layout === null ? inferLayout(geometryItems) : declaration.layout;
  if (layout === null) return unavailable('layout_unresolved');
  const scrollers = new Set(items.map((item) => scrollerFor(item, documentRef, windowRef, styles)));
  if (scrollers.size !== 1 || scrollers.has(null)) return unavailable('multiple_item_scrollers');
  const scroller = [...scrollers][0];
  const height = isRootLikeScroller(scroller, documentRef) ? windowRef.innerHeight : scroller.clientHeight;
  if (!Number.isFinite(height) || height <= 0) return unavailable('scroller_geometry_unavailable');
  return {
    status: 'resolved', reason: 'region_resolved', region, items, scroller, scrollerHeight: height,
    layout, boundarySource: generic ? 'heuristic' : 'declared',
    layoutSource: declaration.layout === null ? 'geometry' : 'declared',
    window: collected.window,
  };
}
