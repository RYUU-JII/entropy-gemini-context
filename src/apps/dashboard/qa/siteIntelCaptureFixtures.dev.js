import { buildStatsDomainCollectionObservation } from '../../../domains/stats/contracts/statsContracts.js';
import { buildRuleSiteIntel } from '../../../domains/stats/background/query/statsSiteIntelReadModel.js';

// Fixed source observations only. No model output, UI verdict or persisted data
// is accepted as an input. This fixture certifies presentation, not collection.
const INTERPRETATION_CAPTURE_CASES = {
  long: { minutes: 60, sessions: 1 },
  repeated: { minutes: 60, sessions: 40, maxMinutes: 1.5, shortCount: 40 },
  mixed: { minutes: 60, sessions: 10, maxMinutes: 45, shortCount: 8 },
  distributed: { minutes: 120, sessions: 8, distributed: true },
  comparison: { minutes: 180, sessions: 0, reference: true },
  increased: { minutes: 40, sessions: 9, maxMinutes: 32, shortCount: 8 },
  decreased: { minutes: 40, sessions: 9, maxMinutes: 32, shortCount: 8 },
  intervention: { minutes: 10, sessions: 1, intervention: { frictionShown: 4, reenteredWithin30m: 3, reenteredWithin5m: 1 } },
  brief: { minutes: .3, sessions: 1 },
  partial: { minutes: 60, sessions: 0 },
  zero: { minutes: 0, sessions: 0 },
  missing: { minutes: 0, sessions: 0, observed: false },
  unclassified: { minutes: 1, sessions: 0 },
};

// The existing interpretation journeys retain their admitted source cases.
// First-day today notes are exercised by the Zen ledger journey separately.
export const SITE_INTEL_INTERPRETATION_CAPTURE_CASE_IDS = Object.freeze(Object.keys(INTERPRETATION_CAPTURE_CASES));
export const SITE_INTEL_CAPTURE_CASES = Object.freeze({
  'first-day': { minutes: 14, sessions: 8, maxMinutes: 4, shortCount: 6 },
  ...INTERPRETATION_CAPTURE_CASES,
});

const CURRENT_DATE = '2026-09-07';
const MINUTE_MS = 60_000;
const emptySessions = () => ({ count: 0, totalMs: 0, shortCount: 0, longCount: 0, maxMs: 0 });

function dateBeforeCurrent(offset) {
  const date = new Date(2026, 8, 7 - offset, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function collectionObservation(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const capturedAt = new Date(year, month - 1, day, 12).getTime();
  return buildStatsDomainCollectionObservation({
    firstCapturedAt: capturedAt, lastCapturedAt: capturedAt,
    dataCollectionMode: null, precisionInsightsMode: null,
  }, { source: 'siteIntelCaptureFixture' });
}

function sessions({ count = 0, minutes = 0, shortCount = 0, longCount = 0, maxMinutes = 0 } = {}) {
  return { count, totalMs: minutes * MINUTE_MS, shortCount, longCount, maxMs: maxMinutes * MINUTE_MS };
}

function projection(dateStr, domain, observations) {
  if (observations === null) {
    return { hasStatsDay: false, domainTotals: [],
      hourlyBuckets: Array.from({ length: 24 }, (_, hour) => ({ hour, domains: [] })) };
  }
  const collection = collectionObservation(dateStr);
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const entry = observations.find(observation => observation.hour === hour);
    return { domain, collectionObservation: collection, activeMs: (entry?.minutes ?? 0) * MINUTE_MS,
      visits: entry?.visits ?? 0, sessions: entry?.sessions ?? emptySessions() };
  });
  const aggregateSessions = {
    count: hourly.reduce((sum, entry) => sum + entry.sessions.count, 0),
    totalMs: hourly.reduce((sum, entry) => sum + entry.sessions.totalMs, 0),
    shortCount: hourly.reduce((sum, entry) => sum + entry.sessions.shortCount, 0),
    longCount: hourly.reduce((sum, entry) => sum + entry.sessions.longCount, 0),
    maxMs: Math.max(...hourly.map(entry => entry.sessions.maxMs)),
  };
  return { hasStatsDay: true, domainTotals: [{ domain, collectionObservation: collection,
    activeMs: hourly.reduce((sum, entry) => sum + entry.activeMs, 0),
    visits: hourly.reduce((sum, entry) => sum + entry.visits, 0),
    hourlyVisits: hourly.map(entry => entry.visits), sessions: aggregateSessions }],
  hourlyBuckets: hourly.map((entry, hour) => ({ hour, domains: [entry] })) };
}

function completedDayObservations(id, index) {
  if (id === 'missing' || id === 'first-day') return null;
  // One completed day with many short sessions must not become a long-term claim.
  if (id === 'partial') return index === 29
    ? [8, 11, 14, 17, 20].map(hour => ({ hour, minutes: 6, visits: 4,
      sessions: sessions({ count: 4, minutes: 6, shortCount: 4, maxMinutes: 1.5 }) })) : null;
  if (id === 'zero') return [];
  if (id === 'comparison') return [{ hour: 18, minutes: 20, visits: 0, sessions: emptySessions() }];
  if (id === 'increased' || id === 'decreased') {
    // Both halves contain source observations for every completed date. Eight
    // short sessions and one long session coexist with a repeated evening;
    // only the long session's measured duration changes between the halves.
    const referenceMinutes = id === 'increased' ? 22 : 44;
    const recentMinutes = id === 'increased' ? 44 : 22;
    const longMinutes = index < 15 ? referenceMinutes : recentMinutes;
    return [
      ...[8, 12].map(hour => ({ hour, minutes: 4, visits: 4,
        sessions: sessions({ count: 4, minutes: 4, shortCount: 4, maxMinutes: 1 }) })),
      { hour: 20, minutes: longMinutes, visits: 1,
        sessions: sessions({ count: 1, minutes: longMinutes, longCount: 1, maxMinutes: longMinutes }) },
    ];
  }
  if (id === 'unclassified' && index >= 24) return [];
  // The other twelve observed days retain a captured zero, not a missing marker.
  if (index % 5 >= 3) return [];
  if (id === 'long') return [{ hour: index % 3 === 0 ? 14 : 20, minutes: 45, visits: 1,
    sessions: sessions({ count: 1, minutes: 45, longCount: 1, maxMinutes: 45 }) }];
  if (id === 'repeated') return [8, 11, 14, 17, 20].map(hour => ({ hour, minutes: 6, visits: 4,
    sessions: sessions({ count: 4, minutes: 6, shortCount: 4, maxMinutes: 1.5 }) }));
  if (id === 'mixed') return [
    { hour: 11, minutes: 6, visits: 4, sessions: sessions({ count: 4, minutes: 6, shortCount: 4, maxMinutes: 1.5 }) },
    { hour: 15, minutes: 6, visits: 4, sessions: sessions({ count: 4, minutes: 6, shortCount: 4, maxMinutes: 1.5 }) },
    { hour: 17, minutes: 3, visits: 1, sessions: sessions({ count: 1, minutes: 3, maxMinutes: 3 }) },
    { hour: 21, minutes: 45, visits: 1, sessions: sessions({ count: 1, minutes: 45, longCount: 1, maxMinutes: 45 }) },
  ];
  if (id === 'distributed') return [7, 9, 11, 13, 15, 17, 19, 21].map(hour => ({ hour, minutes: 15, visits: 1,
    sessions: sessions({ count: 1, minutes: 15, maxMinutes: 15 }) }));
  if (id === 'intervention') return [{ hour: 10 + index % 12, minutes: 10, visits: 1,
    sessions: sessions({ count: 1, minutes: 10, maxMinutes: 10 }) }];
  if (id === 'brief') return [{ hour: 8 + index % 12, minutes: .3, visits: 1,
    sessions: sessions({ count: 1, minutes: .3, shortCount: 1, maxMinutes: .3 }) }];
  return [{ hour: 8 + index % 12, minutes: 1, visits: 0, sessions: emptySessions() }];
}

function currentDayObservations(config) {
  if (config.observed === false) return null;
  const total = config.minutes * MINUTE_MS;
  const weights = [0, 0, 0, 0, 0, 0, 0, 3, 6, 12, 0, 0, 4, 0, 0, 0, 0, 6, 12, 0, 18, 14, 5, 0];
  const maxMinutes = config.maxMinutes ?? config.minutes / (config.sessions || 1);
  const measured = config.sessions > 0 ? sessions({ count: config.sessions, minutes: config.minutes,
    shortCount: config.shortCount ?? (maxMinutes < 2 ? config.sessions : 0),
    longCount: maxMinutes >= 20 ? 1 : 0, maxMinutes }) : emptySessions();
  return Array.from({ length: 24 }, (_, hour) => ({ hour,
    minutes: (config.distributed ? total * weights[hour] / 80
      : hour >= 12 ? Math.min(60 * MINUTE_MS, Math.max(0, total - (hour - 12) * 60 * MINUTE_MS)) : 0) / MINUTE_MS,
    visits: hour === 12 ? config.sessions : 0, sessions: hour === 12 ? measured : emptySessions(),
  }));
}

export function buildSiteIntelCaptureFixture(id, domain) {
  if (!Object.hasOwn(SITE_INTEL_CAPTURE_CASES, id)) throw new Error('QA_SITES_INTEL_CASE_INVALID');
  const config = SITE_INTEL_CAPTURE_CASES[id];
  const baselineDates = Array.from({ length: 30 }, (_, index) => dateBeforeCurrent(30 - index));
  const baselineDayProjections = Object.fromEntries(baselineDates.map((dateStr, index) => [dateStr,
    projection(dateStr, domain, completedDayObservations(id, index))]));
  const weeklyDates = Array.from({ length: 7 }, (_, index) => dateBeforeCurrent(6 - index));
  const today = projection(CURRENT_DATE, domain, currentDayObservations(config));
  if (config.intervention) today.domainTotals[0].interventions = config.intervention;
  const weeklyDayProjections = { ...baselineDayProjections, [CURRENT_DATE]: today };
  const intel = buildRuleSiteIntel(domain, {
    siteDetails: { [domain]: config.minutes * MINUTE_MS }, siteGoalMap: {},
    blockedSet: new Set([domain]), allowedSet: new Set(), weeklyDates, weeklyDayProjections,
    baselineDates, baselineDayProjections, currentDateStr: CURRENT_DATE,
    transitionEdgeIndex: { byDomain: new Map(), observedDates: new Set() },
    interventionEffectIndex: { byDomainDate: new Map() },
    now: new Date(2026, 8, 7, 23).getTime(),
  });
  return { ...intel, isReady: true, captureFixtureId: id };
}
