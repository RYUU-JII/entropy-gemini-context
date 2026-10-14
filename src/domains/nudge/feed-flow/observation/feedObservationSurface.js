// A narrow projection of route/target declarations. Classification fields are
// deliberately not read, retained or passed to the measurement resolver.
const IDENTITY_KEYS = ['hostname', 'pathname', 'profileId', 'semanticSurfaceId'];
function readDeclaration(surface, key) {
  const descriptor = Object.getOwnPropertyDescriptor(surface, key);
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
    throw new Error(`FEED_OBSERVATION_SURFACE_INVALID:${key}`);
  }
  return descriptor.value;
}

export function projectFeedObservationSurface(surface) {
  if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
    throw new Error('FEED_OBSERVATION_SURFACE_INVALID:object');
  }
  const projected = {};
  for (const key of IDENTITY_KEYS) {
    const value = readDeclaration(surface, key);
    if (typeof value !== 'string' || value !== value.trim() || (key !== 'pathname' && !value)) {
      throw new Error(`FEED_OBSERVATION_SURFACE_INVALID:${key}`);
    }
    projected[key] = value;
  }
  // Declared semantic routes already identify a feed family across item URL
  // churn. Generic routes lack that declaration, so retain their exact path.
  if (projected.profileId !== 'default') projected.pathname = null;
  // Generic acquisition owns its geometry selector independently of any
  // classification-dependent selector in the broader resolved surface.
  const selector = projected.profileId === 'default' ? null : readDeclaration(surface, 'candidateItemSelectors');
  if (selector !== null && (typeof selector !== 'string' || !selector || selector !== selector.trim())) {
    throw new Error('FEED_OBSERVATION_SURFACE_INVALID:candidateItemSelectors');
  }
  projected.candidateItemSelectors = selector;
  return Object.freeze(projected);
}
