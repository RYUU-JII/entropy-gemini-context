const HOUR_COUNT = 24;

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeHour = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const hour = Math.floor(numeric);
  return hour >= 0 && hour < HOUR_COUNT ? hour : null;
};

const resolveRhythmDayProjection = (ctrl) => (
  ctrl?.rhythmDayProjection || null
);

const resolveCalendarTodayProjection = (ctrl) => (
  ctrl?.calendarTodayProjection || null
);

function getProjectionBuckets(projection) {
  if (Array.isArray(projection?.hourlyBuckets) && projection.hourlyBuckets.length > 0) {
    return projection.hourlyBuckets;
  }
  return [];
}

function findBucketDomainEntry(bucket, domain) {
  if (!domain || !Array.isArray(bucket?.domains)) return null;
  return bucket.domains.find((entry) => entry?.domain === domain) || null;
}

function resolveProjectionStartHour(projection, defaultHour = 0) {
  const rangeStartHour = normalizeHour(projection?.range?.startHour);
  if (rangeStartHour !== null) return rangeStartHour;
  const resetHour = normalizeHour(projection?.resetHour);
  if (resetHour !== null) return resetHour;
  const firstBucketHour = normalizeHour(getProjectionBuckets(projection)[0]?.hour);
  return firstBucketHour === null ? defaultHour : firstBucketHour;
}

function getBucketForDisplayIndex(buckets, index, startHour) {
  const expectedHour = (startHour + index) % HOUR_COUNT;
  const indexedBucket = buckets[index] || null;
  if (normalizeHour(indexedBucket?.hour) === expectedHour) {
    return indexedBucket;
  }
  return buckets.find((bucket) => normalizeHour(bucket?.hour) === expectedHour) || null;
}

function buildTopDomainSummaries(bucket) {
  const preferred = Array.isArray(bucket?.topDomains) && bucket.topDomains.length > 0
    ? bucket.topDomains
    : Array.isArray(bucket?.domains)
      ? bucket.domains
      : [];
  return preferred
    .map((entry) => ({
      domain: typeof entry?.domain === 'string' ? entry.domain.trim().toLowerCase() : '',
      activeMs: Math.max(0, toNumber(entry?.activeMs)),
    }))
    .filter((entry) => entry.domain && entry.activeMs > 0)
    .sort((left, right) => {
      const activeDiff = right.activeMs - left.activeMs;
      if (activeDiff !== 0) return activeDiff;
      return left.domain.localeCompare(right.domain);
    })
    .slice(0, 3);
}

function findPeakHour(series, key) {
  let peak = {
    hour: null,
    valueMs: 0,
  };
  for (const entry of Array.isArray(series) ? series : []) {
    const valueMs = Math.max(0, toNumber(entry?.[key]));
    if (valueMs <= peak.valueMs) continue;
    peak = {
      hour: normalizeHour(entry?.hour),
      valueMs,
    };
  }
  return peak.hour === null ? null : peak;
}

export function buildLensHourlySeries(ctrl, domain) {
  const rhythmProjection = resolveRhythmDayProjection(ctrl);
  const rhythmBuckets = getProjectionBuckets(rhythmProjection);
  const hasRhythmBoundary = resolveProjectionStartHour(rhythmProjection, null) !== null;
  if (rhythmBuckets.length > 0 || hasRhythmBoundary) {
    const startHour = resolveProjectionStartHour(rhythmProjection, 0);
    return Array.from({ length: HOUR_COUNT }, (_, index) => {
      const bucket = getBucketForDisplayIndex(rhythmBuckets, index, startHour);
      const entry = findBucketDomainEntry(bucket, domain);
      const expectedHour = (startHour + index) % HOUR_COUNT;
      const hour = normalizeHour(bucket?.hour);
      return {
        displayIndex: index,
        hour: hour === null ? expectedHour : hour,
        activeMs: toNumber(entry?.activeMs),
      };
    });
  }

  return Array.from({ length: HOUR_COUNT }, (_, hour) => ({
    displayIndex: hour,
    hour,
    activeMs: 0,
  }));
}

export function buildDailyFlowViewModel({
  ctrl,
  lensDomain,
  lensUsedMs,
  goalMs,
  hourlyDomainCandidates = [],
}) {
  const targetDomain = typeof lensDomain === 'string' ? lensDomain.trim().toLowerCase() : '';
  // Today's per-hour trace for each visible (koi-roster) domain, so the strip
  // can preview a hovered koi's day without a lens selection.
  const todaySeriesDomains = (Array.isArray(hourlyDomainCandidates) ? hourlyDomainCandidates : [])
    .map((candidate) => (
      typeof candidate === 'string'
        ? candidate.trim().toLowerCase()
        : (typeof candidate?.domain === 'string' ? candidate.domain.trim().toLowerCase() : '')
    ))
    .filter(Boolean);
  const sourceProjection = resolveRhythmDayProjection(ctrl) || resolveCalendarTodayProjection(ctrl);
  const buckets = getProjectionBuckets(sourceProjection);
  const startHour = resolveProjectionStartHour(sourceProjection, 0);
  const totalMs = Math.max(0, toNumber(sourceProjection?.totals?.activeMs ?? ctrl?.todayActiveMs));
  const protectedMs = Math.max(0, toNumber(sourceProjection?.totals?.byCategory?.blocked?.activeMs ?? ctrl?.todayProtectedMs));
  const targetMs = Math.max(
    0,
    toNumber(
      Array.isArray(sourceProjection?.domainTotals)
        ? sourceProjection.domainTotals.find((entry) => entry?.domain === targetDomain)?.activeMs
        : lensUsedMs,
    ),
  );
  const targetGoalMs = Math.max(0, toNumber(goalMs));

  const domainTodayValues = new Map(todaySeriesDomains.map((domain) => [domain, new Array(HOUR_COUNT).fill(0)]));
  const series = Array.from({ length: HOUR_COUNT }, (_, index) => {
    const bucket = getBucketForDisplayIndex(buckets, index, startHour);
    const expectedHour = (startHour + index) % HOUR_COUNT;
    const hour = normalizeHour(bucket?.hour) ?? expectedHour;
    const hourTotalMs = Math.max(0, toNumber(bucket?.activeMs));
    const hourProtectedMs = Math.max(0, toNumber(bucket?.byCategory?.blocked?.activeMs));
    const targetEntry = targetDomain ? findBucketDomainEntry(bucket, targetDomain) : null;
    const hourTargetMs = Math.max(0, toNumber(targetEntry?.activeMs));
    for (const [domain, values] of domainTodayValues) {
      values[index] = Math.max(0, toNumber(findBucketDomainEntry(bucket, domain)?.activeMs));
    }
    return {
      displayIndex: index,
      hour,
      totalMs: hourTotalMs,
      protectedMs: hourProtectedMs,
      targetMs: hourTargetMs,
      targetShare: hourTotalMs > 0 ? hourTargetMs / hourTotalMs : 0,
      topDomains: buildTopDomainSummaries(bucket),
    };
  });

  return {
    targetDomain,
    basis: sourceProjection?.resetHour !== undefined ? 'rhythm-day' : 'calendar-day',
    range: sourceProjection?.range || null,
    startHour,
    resetHour: normalizeHour(sourceProjection?.resetHour),
    totalMs,
    protectedMs,
    targetMs,
    targetGoalMs,
    targetShareOfDay: totalMs > 0 ? targetMs / totalMs : 0,
    protectedShareOfDay: totalMs > 0 ? protectedMs / totalMs : 0,
    targetGoalRatio: targetGoalMs > 0 ? targetMs / targetGoalMs : 0,
    peakTotalHour: findPeakHour(series, 'totalMs'),
    peakTargetHour: findPeakHour(series, 'targetMs'),
    series,
    domainTodaySeries: Object.fromEntries(
      Array.from(domainTodayValues).filter(([, values]) => values.some((value) => value > 0)),
    ),
  };
}
