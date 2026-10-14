import {
  countVisitHours,
  sumVisits,
  toNumber,
} from './sitePullMath.js';

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toCount(value) {
  return Math.max(0, Math.floor(toNumber(value)));
}

function normalize24hCountSeries(values = []) {
  return Array.from({ length: 24 }, (_, hour) => toCount(values?.[hour]));
}

function summarizeVisitSource(source = {}, coverage = {}) {
  const todayHourlyVisits = normalize24hCountSeries(source.todayHourlyVisits);
  const todayVisits = Object.hasOwn(source, 'todayVisits')
    ? toCount(source.todayVisits) : sumVisits(todayHourlyVisits);
  const weeklyVisits = toCount(source.weeklyVisits);
  const visitHoursToday = Math.max(
    countVisitHours(todayHourlyVisits),
    toCount(source.visitHoursToday),
  );
  const hasVisitFacts = coverage.hasEntryFacts === true
    || source.hasVisitFacts === true
    || todayVisits > 0
    || weeklyVisits > 0;

  return {
    hasEntryFacts: hasVisitFacts,
    hasVisitFacts,
    todayVisits,
    weeklyVisits,
    todayHourlyVisits,
    visitHoursToday,
  };
}

export function resolveSitePullEntryVisitSummary({
  facts = null,
} = {}) {
  if (isObjectRecord(facts)) {
    return summarizeVisitSource(facts.entry || {}, facts.dataCoverage || {});
  }
  return summarizeVisitSource();
}
