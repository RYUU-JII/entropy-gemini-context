import { buildStableItemContentKey } from '../discovery/feedItemContentIdentity.js';
import { FEED_OBSERVATION_LIMITS } from './feedObservationLimits.js';

const LAYOUTS = new Set(['vertical_list', 'paged_item', 'grid']);
const CLIPPING = new Set(['auto', 'scroll', 'hidden', 'clip']);

function readRect(element) {
  const rect = element.getBoundingClientRect();
  if (!['left', 'top', 'right', 'bottom', 'width', 'height'].every((key) => Number.isFinite(rect[key]))) {
    throw new Error('FEED_REGION_RECT_INVALID');
  }
  return rect;
}

function intersect(rect, clip, clipX = true, clipY = true) {
  return {
    left: clipX ? Math.max(rect.left, clip.left) : rect.left,
    right: clipX ? Math.min(rect.right, clip.right) : rect.right,
    top: clipY ? Math.max(rect.top, clip.top) : rect.top,
    bottom: clipY ? Math.min(rect.bottom, clip.bottom) : rect.bottom,
  };
}

function area(rect) {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
}

// Passive content-local geometry seam. Callers supply a region and already
// resolved item boundaries. No observer, timer, storage, or consumption decision.
export function readFeedRegionSnapshot({ region, items, layout, boundarySource, at }) {
  const documentRef = region?.ownerDocument;
  const windowRef = documentRef?.defaultView;
  if (!windowRef || !region.isConnected || !LAYOUTS.has(layout)
    || !['declared', 'heuristic'].includes(boundarySource)
    || !Number.isFinite(at) || at < 0 || !Array.isArray(items) || items.length > FEED_OBSERVATION_LIMITS.items) {
    throw new Error('FEED_REGION_SNAPSHOT_INPUT_INVALID');
  }
  if (new Set(items).size !== items.length || items.some((item) => (
    !item?.isConnected || !region.contains(item)
    || items.some((other) => other !== item && other.contains(item))
  ))) throw new Error('FEED_REGION_ITEM_BOUNDARIES_INVALID');
  const { innerWidth: width, innerHeight: height } = windowRef;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('FEED_REGION_VIEWPORT_UNAVAILABLE');
  }
  const visibility = documentRef.visibilityState;
  if (!['visible', 'hidden'].includes(visibility)) throw new Error('FEED_REGION_VISIBILITY_UNAVAILABLE');
  const viewport = { left: 0, top: 0, right: width, bottom: height };
  const styleCache = new Map();
  const rectCache = new Map();
  const cachedRect = (element) => {
    if (!rectCache.has(element)) rectCache.set(element, readRect(element));
    return rectCache.get(element);
  };
  const cachedStyle = (element) => {
    if (!styleCache.has(element)) styleCache.set(element, windowRef.getComputedStyle(element));
    return styleCache.get(element);
  };
  const regionClip = intersect(cachedRect(region), viewport);
  const observations = items.map((element) => {
    const rect = cachedRect(element);
    let clipped = intersect(rect, regionClip);
    let rendered = visibility === 'visible';
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      const style = cachedStyle(ancestor);
      if (ancestor.hidden || style.display === 'none' || style.visibility === 'hidden'
        || style.visibility === 'collapse' || style.opacity === '0'
        || style.contentVisibility === 'hidden') rendered = false;
      if (ancestor !== element) {
        const clipX = CLIPPING.has(style.overflowX) || CLIPPING.has(style.overflow);
        const clipY = CLIPPING.has(style.overflowY) || CLIPPING.has(style.overflow);
        if (clipX || clipY) clipped = intersect(clipped, cachedRect(ancestor), clipX, clipY);
      }
    }
    const contentKey = buildStableItemContentKey(element);
    const measurable = area(rect) > 0 && area(regionClip) > 0;
    const visibleArea = rendered && measurable ? area(clipped) : 0;
    return {
      element,
      contentKey,
      identityBasis: contentKey ? 'content_hint' : 'node_only',
      geometryStatus: !rendered ? 'hidden' : measurable ? 'measured' : 'unavailable',
      itemFraction: measurable && rendered ? visibleArea / area(rect) : null,
      regionFraction: measurable && rendered ? visibleArea / area(regionClip) : null,
    };
  });
  return {
    at, layout, boundarySource, documentVisibility: visibility,
    items: observations,
    visibleItems: observations.filter((item) => item.itemFraction > 0),
    limitations: ['occlusion_unmeasured', 'user_progression_unmeasured', 'reading_unmeasured'],
  };
}
