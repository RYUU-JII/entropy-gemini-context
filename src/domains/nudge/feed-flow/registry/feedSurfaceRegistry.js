import GenericSurfaceClassifier from '../classify/GenericSurfaceClassifier.js';
import {
  normalizeSiteHostname,
  resolveSiteId,
} from '../../targeting/siteIdentityCatalog.js';
import {
  FEED_SURFACE_MODES,
  getFeedDiscoveryItemSelector,
  getFeedSurfaceProfile,
  requireFeedSurfacePathname,
  resolveFeedSurfaceRoute,
} from './feedSurfaceProfiles.js';

const GENERIC_CONTENT_CLASSES = new Set(['document', 'feed', 'unknown']);
const FEED_SCROLLER_HINTS = new Set(['auto', 'root', 'viewport']);
const RESOLVED_FEED_SURFACE_KEYS = Object.freeze([
  'candidateItemSelectors',
  'contentClass',
  'dominantItemSelectors',
  'genericSignals',
  'hostname',
  'pathname',
  'profileId',
  'routeFamily',
  'scrollerHint',
  'semanticSurfaceId',
  'surfaceConfidence',
  'surfaceMode',
]);

function isNonEmptyCanonicalString(value, pattern = null) {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && (pattern === null || pattern.test(value));
}

function validateGenericSignals(signals) {
  if (signals === null) return null;
  if (signals && typeof signals === 'object' && !Array.isArray(signals)) {
    Reflect.ownKeys(signals).forEach((key) => {
      if (typeof key !== 'string') {
        throw new Error('FEED_RESOLVED_SURFACE_INVALID:genericSignals');
      }
      const descriptor = Object.getOwnPropertyDescriptor(signals, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new Error('FEED_RESOLVED_SURFACE_INVALID:genericSignals');
      }
    });
  }
  if (
    !signals
    || typeof signals !== 'object'
    || Array.isArray(signals)
    || Object.keys(signals).sort().join(',') !== 'dominantCoverage,repeatedItemCount'
    || !Number.isInteger(signals.repeatedItemCount)
    || signals.repeatedItemCount < 0
    || !Number.isFinite(signals.dominantCoverage)
    || signals.dominantCoverage < 0
    || signals.dominantCoverage > 1
  ) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:genericSignals');
  }
  if (Object.isFrozen(signals)) return signals;
  return Object.freeze({
    repeatedItemCount: signals.repeatedItemCount,
    dominantCoverage: signals.dominantCoverage,
  });
}

export function validateResolvedFeedSurface(surface) {
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:surface_object_required');
  }
  Reflect.ownKeys(surface).forEach((key) => {
    if (typeof key !== 'string') {
      throw new Error('FEED_RESOLVED_SURFACE_INVALID:surface_shape');
    }
    const descriptor = Object.getOwnPropertyDescriptor(surface, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new Error('FEED_RESOLVED_SURFACE_INVALID:surface_shape');
    }
  });
  const keys = Object.keys(surface).sort();
  if (
    keys.length !== RESOLVED_FEED_SURFACE_KEYS.length
    || keys.some((key, index) => key !== RESOLVED_FEED_SURFACE_KEYS[index])
  ) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:surface_shape');
  }
  resolveSiteId(surface.hostname);
  if (normalizeSiteHostname(surface.hostname) !== surface.hostname) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:hostname');
  }
  requireFeedSurfacePathname(surface.pathname);
  if (!isNonEmptyCanonicalString(
    surface.profileId,
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u,
  )) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:profileId');
  }
  if (!isNonEmptyCanonicalString(
    surface.semanticSurfaceId,
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*:[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u,
  )) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:semanticSurfaceId');
  }
  if (!isNonEmptyCanonicalString(
    surface.routeFamily,
    /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u,
  )) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:routeFamily');
  }
  if (!Object.values(FEED_SURFACE_MODES).includes(surface.surfaceMode)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:surfaceMode');
  }
  if (!FEED_SCROLLER_HINTS.has(surface.scrollerHint)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:scrollerHint');
  }
  if (!GENERIC_CONTENT_CLASSES.has(surface.contentClass)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:contentClass');
  }
  const contentClassMatchesMode = surface.surfaceMode === FEED_SURFACE_MODES.DOCUMENT
    ? surface.contentClass === 'document'
    : surface.surfaceMode === FEED_SURFACE_MODES.UNKNOWN
      ? surface.contentClass === 'feed' || surface.contentClass === 'unknown'
      : surface.contentClass === 'feed';
  if (!contentClassMatchesMode) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:contentClass_surfaceMode_mismatch');
  }
  if (
    !Number.isFinite(surface.surfaceConfidence)
    || surface.surfaceConfidence < 0
    || surface.surfaceConfidence > 1
  ) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:surfaceConfidence');
  }
  if (surface.surfaceMode === FEED_SURFACE_MODES.DOCUMENT) {
    if (surface.candidateItemSelectors !== null) {
      throw new Error('FEED_RESOLVED_SURFACE_INVALID:candidateItemSelectors');
    }
  } else if (!isNonEmptyCanonicalString(surface.candidateItemSelectors)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:candidateItemSelectors');
  }
  if (!isNonEmptyCanonicalString(surface.dominantItemSelectors)) {
    throw new Error('FEED_RESOLVED_SURFACE_INVALID:dominantItemSelectors');
  }

  const genericSignals = validateGenericSignals(surface.genericSignals);
  if (Object.isFrozen(surface) && genericSignals === surface.genericSignals) return surface;
  return Object.freeze({
    ...surface,
    genericSignals,
  });
}

function validateGenericSurface(surface) {
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
    throw new Error('FEED_GENERIC_SURFACE_RESULT_INVALID');
  }
  const ownKeys = Reflect.ownKeys(surface);
  if (ownKeys.some((key) => {
    if (typeof key !== 'string') return true;
    const descriptor = Object.getOwnPropertyDescriptor(surface, key);
    return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value');
  })) {
    throw new Error('FEED_GENERIC_SURFACE_RESULT_INVALID');
  }
  const keys = ownKeys.sort();
  if (
    keys.join(',') !== 'confidence,contentClass,dominantCoverage,repeatedItemCount,surfaceMode'
    || !Object.values(FEED_SURFACE_MODES).includes(surface.surfaceMode)
    || !GENERIC_CONTENT_CLASSES.has(surface.contentClass)
    || !Number.isFinite(surface.confidence)
    || surface.confidence < 0
    || surface.confidence > 1
    || !Number.isInteger(surface.repeatedItemCount)
    || surface.repeatedItemCount < 0
    || !Number.isFinite(surface.dominantCoverage)
    || surface.dominantCoverage < 0
    || surface.dominantCoverage > 1
  ) {
    throw new Error('FEED_GENERIC_SURFACE_RESULT_INVALID');
  }
  return surface;
}

function resolvePathname(pathname, documentRef) {
  const suppliedPathname = requireFeedSurfacePathname(pathname);
  if (suppliedPathname) return suppliedPathname;
  const documentPathname = documentRef?.location?.pathname;
  return documentPathname === undefined
    ? ''
    : requireFeedSurfacePathname(documentPathname);
}

export class FeedSurfaceRegistry {
  constructor({
    genericClassifier = null,
    onRuntimeFailure = null,
  } = {}) {
    if (onRuntimeFailure !== null && typeof onRuntimeFailure !== 'function') {
      throw new Error('FEED_RUNTIME_FAILURE_REPORTER_INVALID');
    }
    this._onRuntimeFailure = onRuntimeFailure;
    this._genericClassifier = genericClassifier === null
      ? new GenericSurfaceClassifier({
        onSelectorFailure: (phase, error, details) => this._reportRuntimeFailure(phase, error, details),
      })
      : genericClassifier;
    if (typeof this._genericClassifier?.classify !== 'function') {
      throw new Error('FEED_GENERIC_SURFACE_CLASSIFIER_INVALID');
    }
  }

  _reportRuntimeFailure(phase, error, details = {}) {
    if (!this._onRuntimeFailure) return;
    this._onRuntimeFailure(phase, error, {
      phase,
      error: String(error?.message || error || 'FEED_SURFACE_REGISTRY_FAILURE'),
      ...details,
    });
  }

  resolve({
    hostname = '',
    pathname = '',
    documentRef = typeof document !== 'undefined' ? document : null,
  } = {}) {
    const canonicalHostname = normalizeSiteHostname(hostname);
    const profile = getFeedSurfaceProfile(canonicalHostname);
    const resolvedPathname = resolvePathname(pathname, documentRef);
    const surfaceRoute = resolveFeedSurfaceRoute({
      hostname: canonicalHostname,
      pathname: resolvedPathname,
    });
    const feedDiscoveryItemSelector = getFeedDiscoveryItemSelector(canonicalHostname);
    const genericSurface = profile.id === 'default'
      ? validateGenericSurface(this._genericClassifier.classify({
        feedDiscoveryItemSelector,
      }))
      : null;
    const resolvedSurfaceMode = profile.id === 'default'
      ? genericSurface.surfaceMode
      : surfaceRoute.surfaceMode;
    const isDocumentSurface = resolvedSurfaceMode === 'document';
    const routeOwnsCandidateSelectors = Object.hasOwn(
      surfaceRoute,
      'candidateItemSelectors',
    );
    const routeOwnsDominantSelectors = Object.hasOwn(
      surfaceRoute,
      'dominantItemSelectors',
    );
    const candidateItemSelectors = routeOwnsCandidateSelectors
      ? surfaceRoute.candidateItemSelectors
      : (profile.id === 'default'
        ? feedDiscoveryItemSelector
        : profile.candidateItemSelectors);
    const dominantItemSelectors = routeOwnsDominantSelectors
      ? surfaceRoute.dominantItemSelectors
      : (profile.id === 'default'
        ? feedDiscoveryItemSelector
        : profile.dominantItemSelectors);
    if (
      !isDocumentSurface
      && (
        typeof candidateItemSelectors !== 'string'
        || !candidateItemSelectors.trim()
        || typeof dominantItemSelectors !== 'string'
        || !dominantItemSelectors.trim()
      )
    ) {
      throw new Error(`FEED_SURFACE_TARGET_PROFILE_INVALID:${profile.id}`);
    }

    const genericSignals = genericSurface === null
      ? null
      : Object.freeze({
        repeatedItemCount: genericSurface.repeatedItemCount,
        dominantCoverage: genericSurface.dominantCoverage,
      });
    return validateResolvedFeedSurface({
      profileId: profile.id,
      hostname: canonicalHostname,
      pathname: resolvedPathname,
      semanticSurfaceId: surfaceRoute.semanticSurfaceId,
      routeFamily: surfaceRoute.routeFamily,
      surfaceMode: resolvedSurfaceMode,
      scrollerHint: profile.scrollerHint,
      candidateItemSelectors: isDocumentSurface
        ? null
        : candidateItemSelectors,
      dominantItemSelectors: isDocumentSurface
        ? ':is(main, article, [role="main"])'
        : dominantItemSelectors,
      surfaceConfidence: profile.id === 'default'
        ? genericSurface.confidence
        : 0.96,
      contentClass: isDocumentSurface
        ? 'document'
        : (genericSurface === null ? 'feed' : genericSurface.contentClass),
      genericSignals,
    });
  }
}

export default FeedSurfaceRegistry;
