import { toNumber } from './statsAnalysisQueryShared.js';
import { STATS_REENTRY_GAP_BUCKET_KEYS } from '../../contracts/statsContracts.js';

function normalizeReentryGapBuckets(source = {}) {
  const buckets = source && typeof source === 'object' ? source : {};
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = Math.max(0, Math.floor(toNumber(buckets[key])));
    return result;
  }, {});
}

function sumReentryGapBuckets(entries = []) {
  return STATS_REENTRY_GAP_BUCKET_KEYS.reduce((result, key) => {
    result[key] = entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.reentryGapBuckets?.[key]), 0);
    return result;
  }, {});
}

export function normalizeSiteSessionStats(source = {}) {
  return {
    count: Math.max(0, Math.floor(toNumber(source?.count))),
    totalMs: Math.max(0, toNumber(source?.totalMs)),
    shortCount: Math.max(0, Math.floor(toNumber(source?.shortCount))),
    longCount: Math.max(0, Math.floor(toNumber(source?.longCount))),
    maxMs: Math.max(0, toNumber(source?.maxMs)),
  };
}

export function normalizeSiteBehaviorStats(source = {}) {
  return {
    backgroundMediaMs: Math.max(0, toNumber(source?.backgroundMediaMs)),
    backgroundLingerMs: Math.max(0, toNumber(source?.backgroundLingerMs)),
    staleTabMs: Math.max(0, toNumber(source?.staleTabMs)),
    revisitWithin2m: Math.max(0, Math.floor(toNumber(source?.revisitWithin2m))),
    revisitWithin5m: Math.max(0, Math.floor(toNumber(source?.revisitWithin5m))),
    revisitWithin10m: Math.max(0, Math.floor(toNumber(source?.revisitWithin10m))),
    reentryGapBuckets: normalizeReentryGapBuckets(source?.reentryGapBuckets),
    switchIns: Math.max(0, Math.floor(toNumber(source?.switchIns))),
    switchOuts: Math.max(0, Math.floor(toNumber(source?.switchOuts))),
    switchBackWithin10m: Math.max(0, Math.floor(toNumber(source?.switchBackWithin10m))),
    newTabEntrances: Math.max(0, Math.floor(toNumber(source?.newTabEntrances))),
    duplicateTabEntrances: Math.max(0, Math.floor(toNumber(source?.duplicateTabEntrances))),
    highOpenTabEntrances: Math.max(0, Math.floor(toNumber(source?.highOpenTabEntrances))),
    maxSameDomainOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxSameDomainOpenTabs))),
    maxOpenTabs: Math.max(0, Math.floor(toNumber(source?.maxOpenTabs))),
    scrollSpikeBursts: Math.max(0, Math.floor(toNumber(source?.scrollSpikeBursts))),
    fastScrollBursts: Math.max(0, Math.floor(toNumber(source?.fastScrollBursts))),
    feedPressureSignals: Math.max(0, Math.floor(toNumber(source?.feedPressureSignals))),
    feedInterruptSignals: Math.max(0, Math.floor(toNumber(source?.feedInterruptSignals))),
    feedAdvanceBursts: Math.max(0, Math.floor(toNumber(source?.feedAdvanceBursts))),
    feedSkimSignals: Math.max(0, Math.floor(toNumber(source?.feedSkimSignals))),
    shortMediaAttentionSignals: Math.max(0, Math.floor(toNumber(source?.shortMediaAttentionSignals))),
    shortMediaWatchMs: Math.max(0, toNumber(source?.shortMediaWatchMs)),
    maxFeedScreenfuls: Math.max(0, toNumber(source?.maxFeedScreenfuls)),
    maxFeedItemTransitions: Math.max(0, Math.floor(toNumber(source?.maxFeedItemTransitions))),
  };
}

export function normalizeSiteInterventionStats(source = {}) {
  return {
    frictionShown: Math.max(0, Math.floor(toNumber(source?.frictionShown))),
    continued: Math.max(0, Math.floor(toNumber(source?.continued))),
    left: Math.max(0, Math.floor(toNumber(source?.left))),
    reenteredWithin5m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin5m))),
    reenteredWithin30m: Math.max(0, Math.floor(toNumber(source?.reenteredWithin30m))),
    escapeClosed: Math.max(0, Math.floor(toNumber(source?.escapeClosed))),
  };
}

export function normalizeSiteNavigationStats(source = {}) {
  return {
    total: Math.max(0, Math.floor(toNumber(source?.total))),
    link: Math.max(0, Math.floor(toNumber(source?.link))),
    typed: Math.max(0, Math.floor(toNumber(source?.typed))),
    reload: Math.max(0, Math.floor(toNumber(source?.reload))),
    generated: Math.max(0, Math.floor(toNumber(source?.generated))),
    keyword: Math.max(0, Math.floor(toNumber(source?.keyword))),
    formSubmit: Math.max(0, Math.floor(toNumber(source?.formSubmit))),
    startPage: Math.max(0, Math.floor(toNumber(source?.startPage))),
    autoBookmark: Math.max(0, Math.floor(toNumber(source?.autoBookmark))),
    other: Math.max(0, Math.floor(toNumber(source?.other))),
    addressBar: Math.max(0, Math.floor(toNumber(source?.addressBar))),
    forwardBack: Math.max(0, Math.floor(toNumber(source?.forwardBack))),
  };
}

export function sumSiteSessionStats(entries = []) {
  return normalizeSiteSessionStats({
    count: entries.reduce((sum, entry) => sum + toNumber(entry?.sessions?.count), 0),
    totalMs: entries.reduce((sum, entry) => sum + toNumber(entry?.sessions?.totalMs), 0),
    shortCount: entries.reduce((sum, entry) => sum + toNumber(entry?.sessions?.shortCount), 0),
    longCount: entries.reduce((sum, entry) => sum + toNumber(entry?.sessions?.longCount), 0),
    maxMs: Math.max(0, ...entries.map((entry) => toNumber(entry?.sessions?.maxMs))),
  });
}

export function sumSiteBehaviorStats(entries = []) {
  return normalizeSiteBehaviorStats({
    backgroundMediaMs: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.backgroundMediaMs), 0),
    backgroundLingerMs: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.backgroundLingerMs), 0),
    staleTabMs: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.staleTabMs), 0),
    revisitWithin2m: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.revisitWithin2m), 0),
    revisitWithin5m: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.revisitWithin5m), 0),
    revisitWithin10m: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.revisitWithin10m), 0),
    reentryGapBuckets: sumReentryGapBuckets(entries),
    switchIns: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.switchIns), 0),
    switchOuts: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.switchOuts), 0),
    switchBackWithin10m: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.switchBackWithin10m), 0),
    newTabEntrances: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.newTabEntrances), 0),
    duplicateTabEntrances: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.duplicateTabEntrances), 0),
    highOpenTabEntrances: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.highOpenTabEntrances), 0),
    maxSameDomainOpenTabs: Math.max(0, ...entries.map((entry) => toNumber(entry?.behavior?.maxSameDomainOpenTabs))),
    maxOpenTabs: Math.max(0, ...entries.map((entry) => toNumber(entry?.behavior?.maxOpenTabs))),
    scrollSpikeBursts: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.scrollSpikeBursts), 0),
    fastScrollBursts: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.fastScrollBursts), 0),
    feedPressureSignals: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.feedPressureSignals), 0),
    feedInterruptSignals: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.feedInterruptSignals), 0),
    feedAdvanceBursts: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.feedAdvanceBursts), 0),
    feedSkimSignals: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.feedSkimSignals), 0),
    shortMediaAttentionSignals: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.shortMediaAttentionSignals), 0),
    shortMediaWatchMs: entries.reduce((sum, entry) => sum + toNumber(entry?.behavior?.shortMediaWatchMs), 0),
    maxFeedScreenfuls: Math.max(0, ...entries.map((entry) => toNumber(entry?.behavior?.maxFeedScreenfuls))),
    maxFeedItemTransitions: Math.max(0, ...entries.map((entry) => toNumber(entry?.behavior?.maxFeedItemTransitions))),
  });
}

export function sumSiteInterventionStats(entries = []) {
  return normalizeSiteInterventionStats({
    frictionShown: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.frictionShown), 0),
    continued: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.continued), 0),
    left: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.left), 0),
    reenteredWithin5m: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.reenteredWithin5m), 0),
    reenteredWithin30m: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.reenteredWithin30m), 0),
    escapeClosed: entries.reduce((sum, entry) => sum + toNumber(entry?.interventions?.escapeClosed), 0),
  });
}

export function sumSiteNavigationStats(entries = []) {
  return normalizeSiteNavigationStats({
    total: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.total), 0),
    link: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.link), 0),
    typed: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.typed), 0),
    reload: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.reload), 0),
    generated: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.generated), 0),
    keyword: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.keyword), 0),
    formSubmit: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.formSubmit), 0),
    startPage: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.startPage), 0),
    autoBookmark: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.autoBookmark), 0),
    other: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.other), 0),
    addressBar: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.addressBar), 0),
    forwardBack: entries.reduce((sum, entry) => sum + toNumber(entry?.navigation?.forwardBack), 0),
  });
}
