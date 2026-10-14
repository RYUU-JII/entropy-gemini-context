const preparedStatsHourlyBucketRegistrations = new WeakMap();
const domainsDeltaRevisions = new WeakMap();
const transitionEdgesDeltaRevisions = new WeakMap();

function requireHourlyBucket(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('STATS_PREPARED_HOURLY_BUCKET_INVALID');
    error.code = 'STATS_PREPARED_HOURLY_BUCKET_INVALID';
    throw error;
  }
  return value;
}

function requireProjectionMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('STATS_PREPARED_HOURLY_BUCKET_MAPS_REQUIRED');
    error.code = 'STATS_PREPARED_HOURLY_BUCKET_MAPS_REQUIRED';
    throw error;
  }
  return value;
}

function bumpProjectionMapRevision(revisions, projectionMap) {
  const revision = (revisions.get(projectionMap) || 0) + 1;
  revisions.set(projectionMap, revision);
  return revision;
}

function captureShallowBucketSnapshot(bucket) {
  const keys = Object.keys(bucket);
  return {
    keys,
    values: new Map(keys.map((key) => [key, bucket[key]])),
  };
}

function isShallowBucketSnapshotCurrent(bucket, snapshot) {
  const currentKeys = Object.keys(bucket);
  return currentKeys.length === snapshot.keys.length
    && snapshot.keys.every((key) => (
      Object.prototype.hasOwnProperty.call(bucket, key)
      && Object.is(bucket[key], snapshot.values.get(key))
    ));
}

function isPreparedRegistrationCurrent(bucket, registration) {
  return isShallowBucketSnapshotCurrent(bucket, registration.snapshot)
    && domainsDeltaRevisions.get(registration.domainsDelta)
      === registration.domainsDeltaRevision
    && transitionEdgesDeltaRevisions.get(registration.transitionEdgesDelta)
      === registration.transitionEdgesDeltaRevision;
}

export function registerPreparedStatsHourlyBucket(bucket) {
  const preparedBucket = requireHourlyBucket(bucket);
  const domainsDelta = requireProjectionMap(preparedBucket.domainsDelta);
  const transitionEdgesDelta = requireProjectionMap(preparedBucket.transitionEdgesDelta);
  preparedStatsHourlyBucketRegistrations.set(preparedBucket, {
    domainsDelta,
    domainsDeltaRevision: bumpProjectionMapRevision(domainsDeltaRevisions, domainsDelta),
    transitionEdgesDelta,
    transitionEdgesDeltaRevision: bumpProjectionMapRevision(
      transitionEdgesDeltaRevisions,
      transitionEdgesDelta,
    ),
    snapshot: captureShallowBucketSnapshot(preparedBucket),
  });
  return preparedBucket;
}

export function isPreparedStatsHourlyBucket(bucket) {
  if (!bucket || typeof bucket !== 'object') return false;
  const registration = preparedStatsHourlyBucketRegistrations.get(bucket);
  return !!registration && isPreparedRegistrationCurrent(bucket, registration);
}

export function consumePreparedStatsHourlyBucket(bucket) {
  if (!bucket || typeof bucket !== 'object') return false;
  const registration = preparedStatsHourlyBucketRegistrations.get(bucket);
  if (!registration) return false;
  preparedStatsHourlyBucketRegistrations.delete(bucket);
  if (!isPreparedRegistrationCurrent(bucket, registration)) {
    const error = new Error('STATS_PREPARED_HOURLY_BUCKET_INVALIDATED');
    error.code = 'STATS_PREPARED_HOURLY_BUCKET_INVALIDATED';
    throw error;
  }
  return true;
}
