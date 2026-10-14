import {
  getSocialMetricTargets,
  validateSocialMetricTargets,
} from '../adapters/socialMetricTargetProfiles.js';
import {
  SOCIAL_METRIC_GROUPS,
  getMetricGroupForFilterKey,
} from '../contracts/socialMetricContracts.js';
import {
  isFacebookHost,
  isInstagramHost,
  isTikTokHost,
  isXHost,
  isYoutubeHost,
  normalizeSocialMetricsHost,
} from '../adapters/hostUtils.js';

function requireTextPatternResolver(resolveTextPatterns) {
  if (typeof resolveTextPatterns !== 'function') {
    throw new Error('SOCIAL_METRIC_TEXT_PATTERN_RESOLVER_REQUIRED');
  }
  return resolveTextPatterns;
}

function getMetricSelectors(targetProfile) {
  return targetProfile.metricSelectors;
}

function buildSelectorList({ targetProfile, filterKeys }) {
  const metricSelectors = getMetricSelectors(targetProfile);
  return Object.freeze(Array.from(new Set(filterKeys.flatMap((filterKey) => (
    metricSelectors[filterKey]
  )))));
}

function buildRootSelector(targetProfile) {
  return Array.from(new Set(targetProfile.scanRoots)).join(',');
}

export function createCompiledSocialMetricPlans({
  hostname,
  activeMetricKeys = [],
  targetProfile: targetProfileOverride = null,
  resolveTextPatterns,
} = {}) {
  const textPatternResolver = requireTextPatternResolver(resolveTextPatterns);
  const host = normalizeSocialMetricsHost(hostname);
  const targetProfile = targetProfileOverride === null
    ? getSocialMetricTargets(host)
    : validateSocialMetricTargets(targetProfileOverride);
  const instagram = isInstagramHost(host);
  const facebook = isFacebookHost(host);
  const tiktok = isTikTokHost(host);
  const x = isXHost(host);
  const youtube = isYoutubeHost(host);

  const plans = SOCIAL_METRIC_GROUPS.map((group) => {
    const filterKeys = activeMetricKeys.filter((key) => getMetricGroupForFilterKey(key) === group);
    if (filterKeys.length === 0) return null;

    const list = buildSelectorList({
      targetProfile,
      filterKeys,
    });
    if (list.length === 0) return null;

    const patternMap = {};
    filterKeys.forEach((filterKey) => {
      const patterns = textPatternResolver(host, filterKey);
      if (!Array.isArray(patterns)) {
        throw new Error(`SOCIAL_METRIC_TEXT_PATTERN_RESULT_REQUIRED:${filterKey}`);
      }
      if (patterns.length > 0) patternMap[filterKey] = Object.freeze([...patterns]);
    });

    return Object.freeze({
      group,
      filterKeys: Object.freeze(Array.from(new Set(filterKeys))),
      patternMap: Object.freeze(patternMap),
      list,
      joinedSelector: list.join(','),
      isInstagram: instagram,
      isFacebook: facebook,
      isTikTok: tiktok,
      isYoutube: youtube,
      isX: x,
    });
  }).filter(Boolean);

  return Object.freeze({
    host,
    targetProfile,
    rootSelector: buildRootSelector(targetProfile),
    plans: Object.freeze(plans),
  });
}

export function createSocialMetricSignature({
  host,
  engagementActive,
  exposureActive,
  rootSelector,
  plans = [],
} = {}) {
  return JSON.stringify({
    host,
    engagementActive,
    exposureActive,
    rootSelector,
    plans: plans.map((plan) => ({
      group: plan.group,
      filterKeys: plan.filterKeys,
      list: plan.list,
    })),
  });
}
