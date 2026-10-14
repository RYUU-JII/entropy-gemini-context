const normalizedStatsRanges = new WeakSet();

function requireStatsRange(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !value.dates
    || typeof value.dates !== 'object'
    || Array.isArray(value.dates)
  ) {
    const error = new Error('STATS_NORMALIZED_RANGE_REGISTRY_INVALID');
    error.code = 'STATS_NORMALIZED_RANGE_REGISTRY_INVALID';
    throw error;
  }
  return value;
}

export function markStatsRangeNormalized(statsRange) {
  const range = requireStatsRange(statsRange);
  normalizedStatsRanges.add(range);
  return range;
}

export function isStatsRangeNormalized(statsRange) {
  return !!statsRange
    && typeof statsRange === 'object'
    && normalizedStatsRanges.has(statsRange);
}
