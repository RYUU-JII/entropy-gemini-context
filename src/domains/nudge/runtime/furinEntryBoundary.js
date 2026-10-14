import { isEnsoGateEligibleClickBoundary } from '../interaction/ClickBoundaryClassifier.js';
import { resolveClickIntentGateTarget } from '../interaction/clickTargetResolver.js';
import GenericSurfaceClassifier from '../feed-flow/classify/GenericSurfaceClassifier.js';
import FeedSurfaceRegistry, { validateResolvedFeedSurface } from '../feed-flow/registry/feedSurfaceRegistry.js';
import { FEED_SEMANTIC_SURFACE_IDS, FEED_SURFACE_MODES } from '../feed-flow/registry/feedSurfaceProfiles.js';
import { isTabMediaElement, readMediaSourceIdentity } from '../media/pageMediaElements.js';
import { getMediaShadowRootAccessCapabilities, readMediaShadowRoot } from '../media/mediaShadowRootAccess.js';
import { normalizeSiteHostname } from '../targeting/siteIdentityCatalog.js';

export const FURIN_ENTRY_SURFACE_MODES = Object.freeze({
  FEED_REQUIRED: 'feed_required',
  ACTION_BOUNDARY: 'action_boundary',
  UNSUPPORTED: 'unsupported',
});

const FEED_MODES = new Set([
  FEED_SURFACE_MODES.CONTINUOUS,
  FEED_SURFACE_MODES.PAGED,
  FEED_SURFACE_MODES.HYBRID,
]);

function requireMediaInventory(snapshot, documentRef) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
    || !['videos', 'audio', 'frames', 'roots'].every(key => Array.isArray(snapshot[key]))) {
    throw new Error('FURIN_ENTRY_MEDIA_INVENTORY_REQUIRED');
  }
  // An uninitialized passive registry can return empty arrays. The entry owner
  // must first acquire synchronousInitialInventory on the canonical observer.
  if (!snapshot.roots.includes(documentRef)) {
    throw new Error('FURIN_ENTRY_MEDIA_INVENTORY_UNOBSERVED');
  }
  const media = [...snapshot.videos, ...snapshot.audio];
  const content = [...media, ...snapshot.frames];
  if (media.some(element => !isTabMediaElement(element))
    || snapshot.frames.some(element => element?.nodeType !== 1 || element.localName !== 'iframe')
    || new Set(content).size !== content.length || content.some(element => (
    element.ownerDocument !== documentRef
    || element.isConnected !== true
  ))) throw new Error('FURIN_ENTRY_MEDIA_INVENTORY_STALE');
  // A frame can own primary playback without exposing its content here. Its
  // exact declared role is classified below; silence or absent parent-document
  // video alone never proves that an uncontained frame is harmless.
  return content;
}

function isYoutubeShortsSurface(surface) {
  return surface.profileId === 'youtube'
    && surface.semanticSurfaceId === FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_SHORTS
    && surface.routeFamily === 'shorts'
    && surface.surfaceMode === FEED_SURFACE_MODES.PAGED;
}

// YouTube retains its unloaded Watch player beside the active Shorts surface.
// This proves only that exact residue is dormant now; it never removes media from
// the canonical inventory or treats hidden playback as completed content.
function isDormantYoutubeWatchResidue(element, surface, windowRef) {
  if (element.localName !== 'video'
    || !isYoutubeShortsSurface(surface)) return false;
  const container = element.closest('ytd-watch-flexy[hidden]');
  if (!container || container.hidden !== true
    || element.paused !== true
    || element.readyState !== element.HAVE_NOTHING
    || element.networkState !== element.NETWORK_EMPTY) return false;
  const identity = readMediaSourceIdentity(element);
  if (identity.currentSrc !== '' || identity.src !== null || identity.srcObject !== null
    || identity.sources.some(source => source.src !== null)) return false;
  if (typeof windowRef?.getComputedStyle !== 'function') {
    throw new Error('FURIN_ENTRY_MEDIA_VISIBILITY_API_REQUIRED');
  }
  if (windowRef.getComputedStyle(container).display !== 'none'
    || element.getClientRects().length !== 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0;
}

function isPassiveYoutubeAuthSource(source) {
  if (!URL.canParse(source)) return false;
  const location = new URL(source);
  if (location.origin !== 'https://accounts.google.com' || location.pathname !== '/ServiceLogin'
    || location.username !== '' || location.password !== '') return false;
  const query = location.searchParams;
  if (query.getAll('service').length !== 1 || query.get('service') !== 'youtube'
    || query.getAll('passive').length !== 1 || query.get('passive') !== 'true'
    || query.getAll('continue').length !== 1 || query.has('redirect_uri')) return false;
  const continuation = query.get('continue');
  if (!URL.canParse(continuation)) return false;
  const destination = new URL(continuation);
  return destination.protocol === 'https:' && destination.hostname === 'www.youtube.com'
    && destination.port === '' && destination.pathname === '/signin'
    && destination.username === '' && destination.password === '';
}

function isDeclaredYoutubeShortsAuxiliaryFrame(element, surface, windowRef) {
  if (element.localName !== 'iframe' || !isYoutubeShortsSurface(surface)
    || element.parentElement !== element.ownerDocument.body
    || ['srcdoc', 'allow', 'allowfullscreen', 'webkitallowfullscreen', 'mozallowfullscreen']
      .some(attribute => element.hasAttribute(attribute))) return false;
  const source = element.src;
  const sandbox = element.getAttribute('sandbox');
  // This exact auth endpoint is a declared opaque helper role, not an inferred
  // absence of frame media. Other Google paths/hosts are never covered.
  const authHelper = sandbox === null && isPassiveYoutubeAuthSource(source);
  const emptySandbox = element.getAttribute('src') === 'about:blank'
    && source === 'about:blank' && sandbox === 'allow-same-origin';
  if (!authHelper && !emptySandbox) return false;
  if (typeof windowRef?.getComputedStyle !== 'function') {
    throw new Error('FURIN_ENTRY_MEDIA_VISIBILITY_API_REQUIRED');
  }
  if (windowRef.getComputedStyle(element).display !== 'none'
    || element.getClientRects().length !== 0) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width !== 0 || rect.height !== 0) return false;
  if (authHelper) return true;
  if (!getMediaShadowRootAccessCapabilities().closedShadowSupported) return false;
  const frameDocument = element.contentDocument;
  if (!frameDocument || frameDocument.URL !== 'about:blank'
    || frameDocument.readyState !== 'complete') return false;
  const { documentElement, head, body } = frameDocument;
  return documentElement?.localName === 'html' && head?.localName === 'head' && body?.localName === 'body'
    && frameDocument.childElementCount === 1 && documentElement.childElementCount === 2
    && head.parentElement === documentElement && body.parentElement === documentElement
    && head.childElementCount === 0 && body.childElementCount === 0
    && [documentElement, head, body].every(node => readMediaShadowRoot(node) === null);
}

/** Capability only. The feed owner still proves placement, encounter and fresh
 * continuation. Media activity counts cannot certify a primary-content end. */
export function classifyFurinEntrySurface(documentRef, {
  url = documentRef?.location?.href,
  windowRef = documentRef?.defaultView,
  resolvedSurface = null,
  mediaSnapshot,
} = {}) {
  if (!documentRef || typeof documentRef.querySelectorAll !== 'function') {
    throw new Error('FURIN_ENTRY_DOCUMENT_REQUIRED');
  }
  const location = new URL(url);
  const result = (mode, reason, surface = null) => Object.freeze({
    mode, reason, surface, documentRef, url: location.href,
  });
  if (!['https:', 'http:'].includes(location.protocol)) {
    return result(FURIN_ENTRY_SURFACE_MODES.UNSUPPORTED, 'non_web_surface');
  }
  const media = requireMediaInventory(mediaSnapshot, documentRef);
  const surface = resolvedSurface === null
    ? new FeedSurfaceRegistry({ genericClassifier: new GenericSurfaceClassifier({ documentRef, windowRef }) })
      .resolve({ hostname: location.hostname, pathname: location.pathname, documentRef })
    : validateResolvedFeedSurface(resolvedSurface);
  if (surface.hostname !== normalizeSiteHostname(location.hostname) || surface.pathname !== location.pathname) {
    throw new Error('FURIN_ENTRY_SURFACE_LOCATION_MISMATCH');
  }
  // Watch routes remain primary-media contexts even before the player mounts.
  // P1 has no exact primary identity/natural-end/successor proof for these.
  if (surface.semanticSurfaceId === FEED_SEMANTIC_SURFACE_IDS.YOUTUBE_WATCH) {
    return result(FURIN_ENTRY_SURFACE_MODES.UNSUPPORTED, 'primary_media_boundary_unproven', surface);
  }
  if (media.length > 0 && (surface.profileId === 'default'
    || !FEED_MODES.has(surface.surfaceMode)
    || media.some(element => !element.closest(surface.candidateItemSelectors)
      && !isDormantYoutubeWatchResidue(element, surface, windowRef)
      && !isDeclaredYoutubeShortsAuxiliaryFrame(element, surface, windowRef)))) {
    return result(FURIN_ENTRY_SURFACE_MODES.UNSUPPORTED, 'primary_media_boundary_unproven', surface);
  }
  if (FEED_MODES.has(surface.surfaceMode) || surface.contentClass === 'feed') {
    // Unknown/unsafe feed topology must wait for its shared Horizon owner; it
    // never acquires the less restrictive non-feed action path.
    return result(FURIN_ENTRY_SURFACE_MODES.FEED_REQUIRED, 'horizon_required', surface);
  }
  if (surface.surfaceMode === FEED_SURFACE_MODES.DOCUMENT) {
    return result(FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY, 'classified_new_content_required', surface);
  }
  return result(FURIN_ENTRY_SURFACE_MODES.UNSUPPORTED, 'surface_not_declared', surface);
}

/** A feed item URL is local context, not the feed episode's identity. Both
 * snapshots must come from fresh capability classification; this does not
 * certify encounter, continuation, or the background's exact goal owner. */
export function isSameFurinFeedEntrySurface(initial, current) {
  if (initial.mode !== FURIN_ENTRY_SURFACE_MODES.FEED_REQUIRED
    || current.mode !== FURIN_ENTRY_SURFACE_MODES.FEED_REQUIRED
    || initial.documentRef !== current.documentRef
    || current.documentRef.location.href !== current.url) return false;
  const initialSurface = validateResolvedFeedSurface(initial.surface);
  const currentSurface = validateResolvedFeedSurface(current.surface);
  return new URL(initial.url).origin === new URL(current.url).origin
    && ['hostname', 'profileId', 'semanticSurfaceId', 'routeFamily', 'surfaceMode', 'contentClass']
      .every(key => initialSurface[key] === currentSurface[key]);
}

const refused = reason => ({ allowed: false, reason });

/** Consume only a previously prepared exact permit, synchronously on a native
 * new-content click. This function never prepares, replays or schedules input. */
export function classifyFurinEntryAction(event, evidence) {
  const surface = evidence?.surface;
  if (!surface || surface.mode !== FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY) {
    return refused(surface?.mode === FURIN_ENTRY_SURFACE_MODES.FEED_REQUIRED ? 'horizon_required' : 'surface_unsupported');
  }
  if (event?.type !== 'click' || event.isTrusted !== true || event.button !== 0
    || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) {
    return refused('fresh_primary_click_required');
  }
  const documentRef = surface.documentRef;
  if (documentRef.visibilityState === 'hidden' || documentRef.location.href !== surface.url
    || event.target?.ownerDocument !== documentRef || event.target.isConnected !== true) {
    return refused('document_or_target_changed');
  }
  if (typeof evidence.getMediaSnapshot !== 'function') {
    throw new Error('FURIN_ENTRY_MEDIA_INVENTORY_READER_REQUIRED');
  }
  const current = classifyFurinEntrySurface(documentRef, { mediaSnapshot: evidence.getMediaSnapshot() });
  if (current.mode !== FURIN_ENTRY_SURFACE_MODES.ACTION_BOUNDARY) return refused(current.reason);
  const resolution = resolveClickIntentGateTarget(event);
  if (!resolution?.target || !isEnsoGateEligibleClickBoundary(resolution.clickBoundary)) {
    return refused('classified_new_content_required');
  }
  if (resolution.target.hasAttribute('download')
    || (resolution.target.hasAttribute('target') && resolution.target.getAttribute('target').toLowerCase() !== '_self')) {
    return refused('native_navigation_context');
  }
  if (typeof evidence.consumePreparedPermit !== 'function') return refused('prepared_permit_required');
  const permit = evidence.consumePreparedPermit({ event, target: resolution.target,
    boundary: resolution.clickBoundary, surface: current });
  if (permit && typeof permit.then === 'function') {
    throw new Error('FURIN_ENTRY_SYNCHRONOUS_PERMIT_REQUIRED');
  }
  if (permit?.accepted !== true || !permit.lease || typeof permit.lease !== 'object') {
    return refused('prepared_permit_unavailable');
  }
  return { allowed: true, reason: 'classified_new_content', target: resolution.target,
    boundary: resolution.clickBoundary, surface: current, lease: permit.lease };
}
