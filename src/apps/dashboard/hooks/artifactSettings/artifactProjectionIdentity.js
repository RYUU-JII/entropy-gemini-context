// Structural sharing for bounded, read-only artifact projections. Functions and
// non-data objects retain identity semantics; this is not a state/storage cache.
export function retainArtifactProjection(previous, next) {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object') return next;
  const isArray = Array.isArray(next);
  if (Array.isArray(previous) !== isArray) return next;
  if (!isArray && (Object.getPrototypeOf(next) !== Object.prototype
    || Object.getPrototypeOf(previous) !== Object.prototype)) return next;
  const keys = Object.keys(next);
  const result = isArray ? [] : {};
  let equal = keys.length === Object.keys(previous).length;
  for (const key of keys) {
    result[key] = retainArtifactProjection(previous[key], next[key]);
    if (!Object.hasOwn(previous, key) || result[key] !== previous[key]) equal = false;
  }
  return equal ? previous : result;
}

export function createArtifactProjectionSelector(select) {
  let previous;
  return (source) => {
    previous = retainArtifactProjection(previous, select(source));
    return previous;
  };
}
