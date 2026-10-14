import {
  FEED_ENDPOINT_FORWARD_CONTROL_KINDS,
  FEED_ENDPOINT_FORWARD_CONTROL_POLICIES,
} from '../contracts/feedEndpointPlanContract.js';

const OBSERVE_ONLY_ADAPTER = Object.freeze({
  adapterId: 'observe_only',
  capability: 'observe_only',
  mutationMode: 'none',
});

const X_HOME_TIMELINE_TAIL_ADAPTER = Object.freeze({
  adapterId: 'x_home_timeline_tail',
  capability: 'anchored_continuous',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'absolute_anchor_edge',
  endpointTopology: Object.freeze({
    topologyId: 'x_home_virtual_timeline_lane',
    anchorBranchSelector: 'div[data-testid="cellInnerDiv"]',
    laneSelector:
      '[data-testid="primaryColumn"] section[role="region"] > div[aria-label] > div',
    scrollerSelector: 'html',
    containmentSelector: 'div[data-testid="cellInnerDiv"]',
    boundaryBasis: 'anchor_branch_edge',
  }),
});

const INSTAGRAM_HOME_FEED_TAIL_ADAPTER = Object.freeze({
  adapterId: 'instagram_home_feed_tail',
  capability: 'anchored_continuous',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'flow',
  endpointTopology: Object.freeze({
    topologyId: 'instagram_home_article_lane',
    anchorBranchSelector: 'main[role="main"] article',
    laneSelector: 'main[role="main"] div:has(> article)',
    scrollerSelector: 'html',
    containmentSelector: 'main[role="main"] article',
    boundaryBasis: 'anchor_branch_edge',
  }),
});

const FACEBOOK_HOME_FEED_TAIL_ADAPTER = Object.freeze({
  adapterId: 'facebook_home_feed_tail',
  capability: 'anchored_continuous',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'flow',
  endpointTopology: Object.freeze({
    topologyId: 'facebook_home_article_lane',
    anchorBranchSelector:
      '[role="main"] [role="feed"] > div > div:has([role="article"])',
    laneSelector:
      '[role="main"] [role="feed"] > div:has(> div [role="article"])',
    scrollerSelector: 'html#facebook',
    containmentSelector:
      '[role="main"] [role="feed"] > div > div:has([role="article"])',
    boundaryBasis: 'anchor_branch_edge',
  }),
});

const PAGED_IN_PLACE_TAIL_ADAPTER = Object.freeze({
  adapterId: 'paged_in_place_tail',
  capability: 'paged_hold',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'collapse',
  tailLayout: 'flow',
});

const LOCALLY_CERTIFIED_CONTINUOUS_TAIL_ADAPTER = Object.freeze({
  adapterId: 'locally_certified_continuous_tail_v1',
  capability: 'anchored_continuous',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'flow',
});

const LOCALLY_CERTIFIED_PAGED_TAIL_ADAPTER = Object.freeze({
  adapterId: 'locally_certified_paged_tail_v1',
  capability: 'paged_hold',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'collapse',
  tailLayout: 'flow',
});

const INSTAGRAM_REELS_SNAP_TAIL_ADAPTER = Object.freeze({
  adapterId: 'instagram_reels_snap_tail',
  capability: 'paged_hold',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'flow',
  forwardControl: Object.freeze({
    selector:
      'main[role="main"] > [role="toolbar"] > [role="button"]:nth-child(2):last-child',
    controlKind: FEED_ENDPOINT_FORWARD_CONTROL_KINDS.ARIA_BUTTON,
    policy: FEED_ENDPOINT_FORWARD_CONTROL_POLICIES.NATIVE_DISABLED_DIMMED,
  }),
  endpointTopology: Object.freeze({
    topologyId: 'instagram_reels_snap_lane',
    anchorBranchSelector: 'main[role="main"] > div:first-child > div',
    laneSelector: 'main[role="main"] > div:first-child',
    scrollerSelector: 'main[role="main"] > div:first-child',
    containmentSelector: 'main[role="main"] > div:first-child > div',
    boundaryBasis: 'next_containment_start',
    scrollerScrollSnapAxis: 'y',
    branchScrollSnapAlign: 'start',
  }),
});

const YOUTUBE_SHORTS_SEQUENCE_TAIL_ADAPTER = Object.freeze({
  adapterId: 'youtube_shorts_sequence_tail',
  capability: 'paged_hold',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'collapse',
  tailLayout: 'flow',
  forwardControl: Object.freeze({
    selector: 'ytd-shorts #navigation-button-down button',
    controlKind: FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON,
    policy: FEED_ENDPOINT_FORWARD_CONTROL_POLICIES.NATIVE_DISABLED_DIMMED,
  }),
  endpointTopology: Object.freeze({
    topologyId: 'youtube_shorts_sequence_lane',
    anchorBranchSelector: 'div.reel-video-in-sequence-new',
    laneSelector: '#shorts-inner-container',
    scrollerSelector: '#shorts-container',
    containmentSelector: 'div.reel-video-in-sequence-new',
    boundaryBasis: 'next_containment_start',
  }),
});

const YOUTUBE_HOME_RICH_GRID_TAIL_ADAPTER = Object.freeze({
  adapterId: 'youtube_home_rich_grid_tail',
  capability: 'anchored_continuous',
  mutationMode: 'sibling_inert_isolation',
  isolationLayout: 'preserve',
  tailLayout: 'wrapped_row_flow',
  endpointTopology: Object.freeze({
    topologyId: 'youtube_home_rich_grid_lane',
    anchorBranchSelector:
      'ytd-rich-grid-renderer #contents > ytd-rich-item-renderer',
    laneSelector: 'ytd-rich-grid-renderer #contents',
    scrollerSelector: 'html',
    containmentSelector:
      'ytd-rich-grid-renderer #contents > :is(ytd-rich-item-renderer, '
      + 'ytd-rich-section-renderer, ytd-continuation-item-renderer)',
    boundaryBasis: 'completed_wrap_row_edge',
  }),
});

function createSemanticSurfaceAdapter(
  profileId,
  surfaceMode,
  adapter,
) {
  return Object.freeze({ profileId, surfaceMode, adapter });
}

const SEMANTIC_SURFACE_ADAPTERS = Object.freeze({
  'x:home': createSemanticSurfaceAdapter(
    'x',
    'continuous',
    X_HOME_TIMELINE_TAIL_ADAPTER,
  ),
  'instagram:home': createSemanticSurfaceAdapter(
    'instagram',
    'continuous',
    INSTAGRAM_HOME_FEED_TAIL_ADAPTER,
  ),
  'instagram:reels': createSemanticSurfaceAdapter(
    'instagram',
    'paged',
    INSTAGRAM_REELS_SNAP_TAIL_ADAPTER,
  ),
  'facebook:home': createSemanticSurfaceAdapter(
    'facebook',
    'continuous',
    FACEBOOK_HOME_FEED_TAIL_ADAPTER,
  ),
  'tiktok:feed': createSemanticSurfaceAdapter(
    'tiktok',
    'paged',
    PAGED_IN_PLACE_TAIL_ADAPTER,
  ),
  'youtube:shorts': createSemanticSurfaceAdapter(
    'youtube',
    'paged',
    YOUTUBE_SHORTS_SEQUENCE_TAIL_ADAPTER,
  ),
  'youtube:home': createSemanticSurfaceAdapter(
    'youtube',
    'continuous',
    YOUTUBE_HOME_RICH_GRID_TAIL_ADAPTER,
  ),
});

/**
 * Destructive endpoint actuation is allowlisted by canonical semantic surface,
 * site profile, and surface mode as one exact shipped tuple. Unknown/generic
 * surfaces stay observe-only here; the separate strict certificate seam may
 * derive one local adapter identity only after durable and fresh live proof.
 */
export function resolveFeedEndpointAdapter({
  profileId = '',
  semanticSurfaceId = '',
  surfaceMode = 'unknown',
} = {}) {
  const normalizedProfileId = typeof profileId === 'string' ? profileId : '';
  const normalizedSemanticSurfaceId = typeof semanticSurfaceId === 'string'
    ? semanticSurfaceId
    : '';
  const normalizedSurfaceMode = typeof surfaceMode === 'string' ? surfaceMode : 'unknown';
  const entry = SEMANTIC_SURFACE_ADAPTERS[normalizedSemanticSurfaceId];
  if (
    !entry
    || entry.profileId !== normalizedProfileId
    || entry.surfaceMode !== normalizedSurfaceMode
  ) {
    return OBSERVE_ONLY_ADAPTER;
  }
  return entry.adapter;
}

export function buildLocallyCertifiedFeedTopologyId(fingerprint) {
  if (typeof fingerprint !== 'string' || !fingerprint) {
    throw new Error('FEED_LOCAL_TOPOLOGY_FINGERPRINT_REQUIRED');
  }
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < fingerprint.length; index += 1) {
    const code = fingerprint.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `local_topology_${(first >>> 0).toString(16).padStart(8, '0')}${
    (second >>> 0).toString(16).padStart(8, '0')
  }`;
}

export function resolveLocallyCertifiedFeedEndpointAdapter({
  surfaceMode = 'unknown',
  fingerprint = '',
} = {}) {
  buildLocallyCertifiedFeedTopologyId(fingerprint);
  if (surfaceMode === 'continuous') {
    return LOCALLY_CERTIFIED_CONTINUOUS_TAIL_ADAPTER;
  }
  if (surfaceMode === 'paged') {
    return LOCALLY_CERTIFIED_PAGED_TAIL_ADAPTER;
  }
  return OBSERVE_ONLY_ADAPTER;
}

export {
  FACEBOOK_HOME_FEED_TAIL_ADAPTER,
  INSTAGRAM_HOME_FEED_TAIL_ADAPTER,
  INSTAGRAM_REELS_SNAP_TAIL_ADAPTER,
  LOCALLY_CERTIFIED_CONTINUOUS_TAIL_ADAPTER,
  LOCALLY_CERTIFIED_PAGED_TAIL_ADAPTER,
  OBSERVE_ONLY_ADAPTER,
  PAGED_IN_PLACE_TAIL_ADAPTER,
  X_HOME_TIMELINE_TAIL_ADAPTER,
  YOUTUBE_HOME_RICH_GRID_TAIL_ADAPTER,
  YOUTUBE_SHORTS_SEQUENCE_TAIL_ADAPTER,
};

export default resolveFeedEndpointAdapter;
