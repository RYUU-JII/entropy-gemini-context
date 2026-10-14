import { clamp01, sumVisits, toCount } from './sitePullMath.js';

export const SITE_PULL_NAVIGATION_INTENT_METRICS_VERSION = 'site-pull-navigation-intent-metrics-v1';

const PRIMARY_NAVIGATION_KEYS = Object.freeze([
  'link',
  'typed',
  'reload',
  'generated',
  'keyword',
  'formSubmit',
  'startPage',
  'autoBookmark',
  'other',
]);
const PLAIN_OBJECT_PROTOTYPE = Object.prototype;

function isObjectRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isObjectRecord(value) && PLAIN_OBJECT_PROTOTYPE.hasOwnProperty.call(value, key);
}

function createNavigationIntentError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function resolveNavigationFacts({ facts = {} } = {}) {
  if (!hasOwn(facts, 'navigation')) return {};
  if (isObjectRecord(facts.navigation)) return facts.navigation;
  throw createNavigationIntentError('SITE_PULL_NAVIGATION_INTENT_FACTS_INVALID', {
    factKey: 'navigation',
  });
}

function resolveEntryFacts({ facts = {} } = {}) {
  if (!hasOwn(facts, 'entry')) return {};
  if (isObjectRecord(facts.entry)) return facts.entry;
  throw createNavigationIntentError('SITE_PULL_NAVIGATION_INTENT_ENTRY_FACTS_INVALID', {
    factKey: 'entry',
  });
}

function sumPrimaryNavigationCounts(navigation = {}) {
  return PRIMARY_NAVIGATION_KEYS.reduce((sum, key) => sum + toCount(navigation[key]), 0);
}

export function buildSitePullNavigationIntentMetrics({
  facts = {},
} = {}) {
  const navigation = resolveNavigationFacts({ facts });
  const entry = resolveEntryFacts({ facts });
  const rawTotalNavigations = toCount(navigation.total);
  const todayVisits = Math.max(
    toCount(entry.todayVisits),
    sumVisits(entry.todayHourlyVisits),
  );
  const typedCount = toCount(navigation.typed);
  const addressBarCount = toCount(navigation.addressBar);
  const keywordCount = toCount(navigation.keyword);
  const reloadCount = toCount(navigation.reload);
  const forwardBackCount = toCount(navigation.forwardBack);
  const primaryNavigationCount = sumPrimaryNavigationCounts(navigation);

  const directEntryCount = Math.max(typedCount, addressBarCount) + keywordCount;
  const navigationDenominator = Math.max(
    rawTotalNavigations,
    todayVisits,
    primaryNavigationCount,
    addressBarCount,
    forwardBackCount,
    directEntryCount,
    reloadCount,
    1,
  );
  const hasNavigationFacts = Boolean(navigation.hasNavigationFacts)
    || rawTotalNavigations > 0
    || primaryNavigationCount > 0
    || addressBarCount > 0
    || forwardBackCount > 0;

  return {
    version: SITE_PULL_NAVIGATION_INTENT_METRICS_VERSION,
    hasNavigationFacts,
    rawTotalNavigations,
    navigationDenominator,
    primaryNavigationCount,
    typedCount,
    addressBarCount,
    keywordCount,
    directEntryCount,
    reloadCount,
    forwardBackCount,
    directEntryShare: clamp01(directEntryCount / navigationDenominator),
    reloadShare: clamp01(reloadCount / navigationDenominator),
  };
}
