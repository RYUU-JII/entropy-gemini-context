function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function findNonCanonicalValuePath(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) && !Object.is(value, -0) ? null : path;
  }
  if (typeof value !== 'object') return path;
  if (ancestors.has(value)) return path;

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) return `${path}[${index}]`;
        const invalidPath = findNonCanonicalValuePath(
          value[index],
          `${path}[${index}]`,
          ancestors,
        );
        if (invalidPath) return invalidPath;
      }
      return null;
    }
    if (!isPlainObject(value)) return path;
    for (const key of Object.keys(value)) {
      const invalidPath = findNonCanonicalValuePath(value[key], `${path}.${key}`, ancestors);
      if (invalidPath) return invalidPath;
    }
    return null;
  } finally {
    ancestors.delete(value);
  }
}

export function findStatsStatusSnapshotNonCanonicalPath(value) {
  if (!isPlainObject(value)) return 'status';
  return findNonCanonicalValuePath(value, 'status', new WeakSet());
}

export function requireCanonicalStatsStatusSnapshot(
  value,
  errorCode = 'STATS_STATUS_SNAPSHOT_NON_CANONICAL',
) {
  const invalidPath = findStatsStatusSnapshotNonCanonicalPath(value);
  if (invalidPath) {
    const error = new Error(`${errorCode}:${invalidPath}`);
    error.code = errorCode;
    error.path = invalidPath;
    throw error;
  }
  return value;
}
