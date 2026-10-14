import {
  normalizeSiteGoalMeta,
  normalizeSiteGoals,
  normalizeSiteRuleTimeline,
  normalizeUrlList,
  reconcileSiteRuleTimeline,
  reconcileSiteGoalMeta,
  resolveMemoryPurgeSettings,
} from '../../../domains/settings/config/siteRules.js';
import {
  canonicalizeSettingsCommandItems,
} from '../../../domains/settings/config/settingsCommandContract.js';

export function prepareCanonicalSettingsItems(payload = {}, settingsCache = {}, { now = Date.now() } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const next = canonicalizeSettingsCommandItems(source, settingsCache);
  const hasMemoryPurgeSettings = (
    Object.prototype.hasOwnProperty.call(source, 'historyCleanupForBlocked')
    || Object.prototype.hasOwnProperty.call(source, 'concealBlockedBookmarks')
    || Object.prototype.hasOwnProperty.call(source, 'tabEvaporationForBlocked')
    || Object.prototype.hasOwnProperty.call(source, 'tabEvaporationTimeoutMinutes')
  );

  if (hasMemoryPurgeSettings) {
    const memoryPurgeSettings = resolveMemoryPurgeSettings(source, settingsCache);
    next.historyCleanupForBlocked = memoryPurgeSettings.historyCleanupForBlocked;
    next.concealBlockedBookmarks = memoryPurgeSettings.concealBlockedBookmarks;
    next.tabEvaporationForBlocked = memoryPurgeSettings.tabEvaporationForBlocked;
    next.tabEvaporationTimeoutMinutes = memoryPurgeSettings.tabEvaporationTimeoutMinutes;
  }

  if (
    Object.prototype.hasOwnProperty.call(source, 'blockedUrls')
    || Object.prototype.hasOwnProperty.call(source, 'allowedUrls')
    || Object.prototype.hasOwnProperty.call(source, 'siteRuleTimeline')
  ) {
    const nextBlockedUrls = Object.prototype.hasOwnProperty.call(source, 'blockedUrls')
      ? normalizeUrlList(source.blockedUrls, [])
      : normalizeUrlList(settingsCache?.blockedUrls, []);
    const nextAllowedUrls = Object.prototype.hasOwnProperty.call(source, 'allowedUrls')
      ? normalizeUrlList(source.allowedUrls, [])
      : normalizeUrlList(settingsCache?.allowedUrls, []);
    next.siteRuleTimeline = reconcileSiteRuleTimeline({
      previousBlockedUrls: settingsCache?.blockedUrls,
      previousAllowedUrls: settingsCache?.allowedUrls,
      nextBlockedUrls,
      nextAllowedUrls,
      previousTimeline: Object.prototype.hasOwnProperty.call(source, 'siteRuleTimeline')
        ? normalizeSiteRuleTimeline(source.siteRuleTimeline)
        : settingsCache?.siteRuleTimeline,
      now,
    });
  }

  if (Object.prototype.hasOwnProperty.call(source, 'siteGoals')) {
    const normalizedSiteGoals = normalizeSiteGoals(source.siteGoals);
    next.siteGoals = normalizedSiteGoals;
    next.siteGoalMeta = reconcileSiteGoalMeta({
      previousGoals: settingsCache?.siteGoals,
      nextGoals: normalizedSiteGoals,
      previousMeta: Object.prototype.hasOwnProperty.call(source, 'siteGoalMeta')
        ? normalizeSiteGoalMeta(source.siteGoalMeta)
        : settingsCache?.siteGoalMeta,
      now,
    });
  } else if (Object.prototype.hasOwnProperty.call(source, 'siteGoalMeta')) {
    next.siteGoalMeta = normalizeSiteGoalMeta(source.siteGoalMeta);
  }

  return next;
}

export default prepareCanonicalSettingsItems;
