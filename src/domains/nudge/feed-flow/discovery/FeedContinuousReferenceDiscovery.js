import FeedLocalTopologyProbe from '../topology/FeedLocalTopologyProbe.js';
import { isFeedTopologyElement } from '../topology/feedTopologyDomFacts.js';
import { isRootLikeScroller, normalizeScroller } from '../resolve/ActiveScrollContainerResolver.js';
import { GENERIC_FEED_ITEM_SELECTOR } from './genericFeedItemFeatures.js';
import {
  readFeedFlowDiagnosticElapsedMs,
  recordFeedFlowDiagnosticEvent,
  startFeedFlowDiagnosticMeasure,
} from '../diagnostics/feedFlowDiagnosticState.js';

const HIT_RATIOS = Object.freeze([0.2, 0.5, 0.8]);
const MAX_ANCESTOR_DEPTH = 8;
const SEMANTIC_ITEM_SELECTOR = 'article,li,[role="article"],[role="listitem"]';
const EXCLUDED_REGION_SELECTOR = 'nav,aside,header,footer,dialog,[role="navigation"],[role="complementary"],[role="dialog"],[role="menu"]';

// Independent, read-only acquisition for an actual continuous scroll. It issues
// no authority: the shipped probe, durable certificate, and final resolver still
// own qualification for intervention.
export default class FeedContinuousReferenceDiscovery {
  constructor({ windowRef, documentRef, onRuntimeFailure = null } = {}) {
    this._window = windowRef;
    this._document = documentRef;
    this._onRuntimeFailure = onRuntimeFailure;
    this._topologyProbe = new FeedLocalTopologyProbe({ windowRef, documentRef });
  }

  inspect({ surface, activeScroller } = {}) {
    const startedAt = startFeedFlowDiagnosticMeasure();
    let result;
    try {
      result = this._inspect({ surface, activeScroller });
      return result;
    } finally {
      recordFeedFlowDiagnosticEvent('topology_probe', {
        phase: 'local_reference_acquisition',
        status: result?.status || 'invalid',
        surfaceMode: surface?.surfaceMode || 'unknown',
        candidateCount: result?.status === 'resolved' ? 1 : 0,
        durationMs: readFeedFlowDiagnosticElapsedMs(startedAt),
      });
    }
  }

  _inspect({ surface, activeScroller }) {
    if (surface?.contentClass !== 'feed' || surface.surfaceMode !== 'continuous') {
      return this._result('unsupported', 'local_reference_surface_unsupported');
    }
    const scroller = normalizeScroller(activeScroller, this._document);
    if (!scroller?.isConnected || scroller.ownerDocument !== this._document) {
      return this._result('unsafe', 'local_reference_scroller_unavailable');
    }
    const width = Number(this._window?.innerWidth);
    const height = Number(this._window?.innerHeight);
    if (!(width > 0 && height > 0)) {
      return this._result('unavailable', 'local_reference_viewport_unavailable');
    }
    const scrollerRect = isRootLikeScroller(scroller, this._document)
      ? { left: 0, top: 0, right: width, bottom: height }
      : scroller.getBoundingClientRect();
    const bounds = {
      left: Math.max(0, scrollerRect.left), top: Math.max(0, scrollerRect.top),
      right: Math.min(width, scrollerRect.right), bottom: Math.min(height, scrollerRect.bottom),
    };
    if (!(bounds.right > bounds.left && bounds.bottom > bounds.top)) {
      return this._result('unavailable', 'local_reference_scroller_not_visible');
    }
    const elementsFromPoint = this._document?.elementsFromPoint;
    const elementFromPoint = this._document?.elementFromPoint;
    if (typeof elementsFromPoint !== 'function' && typeof elementFromPoint !== 'function') {
      return this._result('unavailable', 'local_reference_hit_test_unavailable');
    }
    const HTMLElementCtor = this._document.defaultView?.HTMLElement;
    if (typeof HTMLElementCtor !== 'function') {
      return this._result('unavailable', 'local_reference_dom_realm_unavailable');
    }
    const references = new Set();
    try {
      for (const xRatio of HIT_RATIOS) {
        for (const yRatio of HIT_RATIOS) {
          const x = bounds.left + (bounds.right - bounds.left) * xRatio;
          const y = bounds.top + (bounds.bottom - bounds.top) * yRatio;
          const hits = typeof elementsFromPoint === 'function'
            ? elementsFromPoint.call(this._document, x, y)
            : [elementFromPoint.call(this._document, x, y)];
          if (!Array.isArray(hits)) throw new Error('FEED_REFERENCE_HIT_TEST_RESULT_INVALID');
          // A covered point cannot lend visibility to a lower paint hit. SVG
          // graphics may be the top hit, but only an HTML ancestor owns an item.
          const hit = hits[0];
          if (!this._ownsElement(hit, scroller) || hit.closest(EXCLUDED_REGION_SELECTOR)) continue;
          let node = hit;
          for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && this._ownsElement(node, scroller); depth += 1) {
            if (node instanceof HTMLElementCtor && node.matches(SEMANTIC_ITEM_SELECTOR)) {
              references.add(node);
              break;
            }
            if (node === scroller) break;
            node = node.parentElement;
          }
        }
      }
      const qualified = [];
      const lanes = new Set();
      for (const referenceNode of references) {
        // Future-branch purity and minimum supply are relative to this anchor;
        // another item in the same complete lane cannot lend its verdict.
        const topology = this._topologyProbe.inspect({
          surface: { ...surface, candidateItemSelectors: GENERIC_FEED_ITEM_SELECTOR },
          actuationContext: { referenceNode, activeScroller: scroller },
        });
        if (topology.discovery?.complete === false) {
          return this._result('pending', 'local_reference_topology_incomplete', false);
        }
        if (topology.status !== 'resolved') continue;
        const rect = referenceNode.getBoundingClientRect();
        const area = Math.max(0, Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left))
          * Math.max(0, Math.min(bounds.bottom, rect.bottom) - Math.max(bounds.top, rect.top));
        if (!(area > 0)) continue;
        qualified.push({ referenceNode, area });
        lanes.add(topology.lane);
        if (lanes.size > 1) return this._result('pending', 'local_reference_lane_ambiguous');
      }
      qualified.sort((left, right) => right.area - left.area);
      if (!qualified.length) return this._result('pending', 'local_reference_structure_unresolved');
      return {
        ...this._result('resolved', 'local_reference_structure_resolved'),
        referenceNode: qualified[0].referenceNode,
      };
    } catch (error) {
      this._onRuntimeFailure?.('feed_continuous_reference_discovery', error, {});
      return this._result('unsafe', 'local_reference_inspection_failed');
    }
  }

  _ownsElement(node, scroller) {
    return isFeedTopologyElement(node, this._document)
      && node.isConnected
      && node.ownerDocument === this._document
      && scroller.contains(node);
  }

  _result(status, reason, complete = true) {
    return { status, reasons: [reason], complete, referenceNode: null };
  }
}
