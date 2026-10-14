import { normalizeDomain } from '../../../lib/domain.js';
import { DEFAULT_COOLING_CURVE, normalizeCoolingCurve } from './coolingCurvePolicy.js';

const NON_WEB_SCHEMES = new Set([
  'chrome:',
  'chrome-extension:',
  'moz-extension:',
  'edge:',
  'edge-extension:',
  'about:',
  'file:',
  'devtools:',
]);

const DISALLOWED_PSEUDO_DOMAINS = new Set([
  'chrome-extension',
  'moz-extension',
  'edge-extension',
  'chrome',
  'edge',
  'about',
  'file',
  'devtools',
]);

function normalizeRuleDomainCandidate(candidate) {
  const raw = String(candidate || '').trim();
  if (!raw) return '';

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const protocol = String(parsed.protocol || '').toLowerCase();
      if (NON_WEB_SCHEMES.has(protocol)) return '';
      if (protocol !== 'http:' && protocol !== 'https:') return '';
    } catch {
      return '';
    }
  }

  const normalized = normalizeDomain(raw);
  if (!normalized) return '';
  if (DISALLOWED_PSEUDO_DOMAINS.has(normalized)) return '';
  return normalized;
}

export const PRODUCT_RULES_MODE = 'managed';
export const DEFAULT_RULES_MODE = PRODUCT_RULES_MODE;

export const GLOBAL_GOAL_MAX_MINUTES = 8 * 60;
export const DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED = false;
export const SITE_RULE_TIMELINE_TYPES = Object.freeze({
  BLOCKED: 'blocked',
  ALLOWED: 'allowed',
});

export const SYNC_SETTINGS_DEFAULTS = {
  blockedUrls: [],
  allowedUrls: [],
  globalGoal: 0,
  globalCapNotifyOnExceeded: DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
  coolingCurve: DEFAULT_COOLING_CURVE,
  rulesMode: DEFAULT_RULES_MODE,
  siteGoals: {},
  siteGoalMeta: {},
  siteRuleTimeline: {},
  historyCleanupForBlocked: false,
  concealBlockedBookmarks: false,
};

export const MEMORY_PURGE_SETTINGS_DEFAULTS = Object.freeze({
  historyCleanupForBlocked: false,
  concealBlockedBookmarks: false,
  tabEvaporationForBlocked: false,
  tabEvaporationTimeoutMinutes: 5,
});

export const VALID_TAB_EVAPORATION_TIMEOUTS = Object.freeze([3, 5, 10, 15]);

function resolveBooleanSetting(value, fallback = false) {
  return typeof value === 'boolean' ? value : !!fallback;
}

function resolveTimeoutMinutesSetting(value, fallback = 5) {
  const num = Number(value);
  return VALID_TAB_EVAPORATION_TIMEOUTS.includes(num) ? num : fallback;
}

export function resolveMemoryPurgeSettings(
  raw,
  fallback = MEMORY_PURGE_SETTINGS_DEFAULTS,
) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fallbackHistoryCleanup = resolveBooleanSetting(
    fallback?.historyCleanupForBlocked,
    MEMORY_PURGE_SETTINGS_DEFAULTS.historyCleanupForBlocked,
  );
  const fallbackBookmarkConceal = resolveBooleanSetting(
    fallback?.concealBlockedBookmarks,
    MEMORY_PURGE_SETTINGS_DEFAULTS.concealBlockedBookmarks,
  );
  const fallbackTabEvaporation = resolveBooleanSetting(
    fallback?.tabEvaporationForBlocked,
    MEMORY_PURGE_SETTINGS_DEFAULTS.tabEvaporationForBlocked,
  );
  const fallbackTabEvaporationTimeoutMinutes = resolveTimeoutMinutesSetting(
    fallback?.tabEvaporationTimeoutMinutes,
    MEMORY_PURGE_SETTINGS_DEFAULTS.tabEvaporationTimeoutMinutes,
  );

  const hasExplicitHistoryCleanup = typeof source.historyCleanupForBlocked === 'boolean';
  const hasExplicitBookmarkConceal = typeof source.concealBlockedBookmarks === 'boolean';
  const hasExplicitTabEvaporation = typeof source.tabEvaporationForBlocked === 'boolean';
  const hasExplicitTabEvaporationTimeoutMinutes = Number.isFinite(Number(source.tabEvaporationTimeoutMinutes));

  return {
    historyCleanupForBlocked: hasExplicitHistoryCleanup
      ? source.historyCleanupForBlocked
      : fallbackHistoryCleanup,
    concealBlockedBookmarks: hasExplicitBookmarkConceal
      ? source.concealBlockedBookmarks
      : fallbackBookmarkConceal,
    tabEvaporationForBlocked: hasExplicitTabEvaporation
      ? source.tabEvaporationForBlocked
      : fallbackTabEvaporation,
    tabEvaporationTimeoutMinutes: hasExplicitTabEvaporationTimeoutMinutes
      ? resolveTimeoutMinutesSetting(source.tabEvaporationTimeoutMinutes, fallbackTabEvaporationTimeoutMinutes)
      : fallbackTabEvaporationTimeoutMinutes,
  };
}

export function normalizeUrlList(raw, fallback = []) {
  const safeFallback = Array.isArray(fallback) ? fallback : [];
  const candidateList = [];

  if (Array.isArray(raw)) {
    candidateList.push(...raw);
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([domain, enabled]) => {
      if (!enabled) return;
      candidateList.push(domain);
    });
  } else {
    return safeFallback.slice();
  }

  const next = [];
  const seen = new Set();
  candidateList.forEach((item) => {
    const candidate = item && typeof item === 'object' ? (item.domain ?? item.host ?? item.url) : item;
    const normalized = normalizeRuleDomainCandidate(candidate);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}

export function normalizeSiteGoals(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [domain, value] of Object.entries(raw)) {
    const normalized = normalizeDomain(domain);
    if (!normalized) continue;
    const minutes = Math.floor(Number(value));
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    next[normalized] = minutes;
  }
  return next;
}

function normalizeSiteGoalTimestamp(value) {
  const timestamp = Math.floor(Number(value));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

export function normalizeSiteGoalMeta(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const next = {};
  for (const [domain, value] of Object.entries(raw)) {
    const normalized = normalizeDomain(domain);
    if (!normalized) continue;
    const source = value && typeof value === 'object' ? value : {};
    const createdAt = normalizeSiteGoalTimestamp(source.createdAt);
    const updatedAt = normalizeSiteGoalTimestamp(source.updatedAt);
    const normalizedCreatedAt = createdAt || updatedAt;
    const normalizedUpdatedAt = Math.max(updatedAt || normalizedCreatedAt, normalizedCreatedAt);
    if (!normalizedCreatedAt || !normalizedUpdatedAt) continue;
    next[normalized] = {
      createdAt: normalizedCreatedAt,
      updatedAt: normalizedUpdatedAt,
    };
  }
  return next;
}

export function reconcileSiteGoalMeta({
  previousGoals = {},
  nextGoals = {},
  previousMeta = {},
  now = Date.now(),
} = {}) {
  const normalizedPreviousGoals = normalizeSiteGoals(previousGoals);
  const normalizedNextGoals = normalizeSiteGoals(nextGoals);
  const normalizedPreviousMeta = normalizeSiteGoalMeta(previousMeta);
  const timestamp = normalizeSiteGoalTimestamp(now) || Date.now();

  return Object.keys(normalizedNextGoals).reduce((acc, domain) => {
    const previousGoal = Number(normalizedPreviousGoals?.[domain] || 0);
    const nextGoal = Number(normalizedNextGoals?.[domain] || 0);
    const previousEntry = normalizedPreviousMeta?.[domain] || null;
    const createdAt = previousEntry?.createdAt || timestamp;
    const updatedAt = previousEntry
      ? (previousGoal !== nextGoal ? timestamp : (previousEntry.updatedAt || createdAt))
      : timestamp;

    acc[domain] = {
      createdAt,
      updatedAt: Math.max(updatedAt, createdAt),
    };
    return acc;
  }, {});
}

function normalizeSiteRuleTimelineType(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw === SITE_RULE_TIMELINE_TYPES.ALLOWED
    ? SITE_RULE_TIMELINE_TYPES.ALLOWED
    : SITE_RULE_TIMELINE_TYPES.BLOCKED;
}

function normalizeTimelineTimestamp(value, fallback = null) {
  const timestamp = Math.floor(Number(value));
  if (!Number.isFinite(timestamp) || timestamp < 0) return fallback;
  return timestamp;
}

function normalizeSiteRuleTimelineEntry(value) {
  const source = value && typeof value === 'object' ? value : {};
  const startEpochMs = normalizeTimelineTimestamp(
    source.startEpochMs ?? source.activeSinceEpochMs ?? source.createdAt,
    null,
  );
  if (startEpochMs === null) return null;

  const endEpochMs = normalizeTimelineTimestamp(
    source.endEpochMs ?? source.inactiveAtEpochMs ?? source.removedAt,
    null,
  );
  const normalized = {
    type: normalizeSiteRuleTimelineType(source.type ?? source.role),
    startEpochMs,
  };
  if (endEpochMs !== null && endEpochMs > startEpochMs) {
    normalized.endEpochMs = endEpochMs;
  }
  return normalized;
}

export function normalizeSiteRuleTimeline(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next = {};

  for (const [domain, value] of Object.entries(raw)) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) continue;
    const entries = Array.isArray(value)
      ? value
      : (value && typeof value === 'object' ? [value] : []);
    const normalizedEntries = entries
      .map(normalizeSiteRuleTimelineEntry)
      .filter(Boolean)
      .sort((left, right) => (
        left.startEpochMs - right.startEpochMs
        || String(left.type).localeCompare(String(right.type))
      ));
    if (normalizedEntries.length > 0) {
      next[normalizedDomain] = normalizedEntries;
    }
  }

  return next;
}

function getActiveTimelineEntry(entries = []) {
  if (!Array.isArray(entries)) return null;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry || Number.isFinite(Number(entry.endEpochMs))) continue;
    return entry;
  }
  return null;
}

function resolveRuleTypeForDomain(domain, blockedSet, allowedSet) {
  if (blockedSet.has(domain)) return SITE_RULE_TIMELINE_TYPES.BLOCKED;
  if (allowedSet.has(domain)) return SITE_RULE_TIMELINE_TYPES.ALLOWED;
  return null;
}

function createRuleTypeSet(list = []) {
  return new Set(normalizeUrlList(list, []));
}

function addTimelineEntry(timeline, domain, entry) {
  const entries = Array.isArray(timeline[domain]) ? timeline[domain] : [];
  timeline[domain] = [
    ...entries,
    entry,
  ].sort((left, right) => (
    left.startEpochMs - right.startEpochMs
    || String(left.type).localeCompare(String(right.type))
  ));
}

export function reconcileSiteRuleTimeline({
  previousBlockedUrls = [],
  previousAllowedUrls = [],
  nextBlockedUrls = [],
  nextAllowedUrls = [],
  previousTimeline = {},
  now = Date.now(),
} = {}) {
  const timestamp = normalizeTimelineTimestamp(now, Date.now());
  const timeline = normalizeSiteRuleTimeline(previousTimeline);
  const previousBlockedSet = createRuleTypeSet(previousBlockedUrls);
  const previousAllowedSet = createRuleTypeSet(previousAllowedUrls);
  const nextBlockedSet = createRuleTypeSet(nextBlockedUrls);
  const nextAllowedSet = createRuleTypeSet(nextAllowedUrls);
  const domains = new Set([
    ...Object.keys(timeline),
    ...Array.from(previousBlockedSet),
    ...Array.from(previousAllowedSet),
    ...Array.from(nextBlockedSet),
    ...Array.from(nextAllowedSet),
  ]);

  domains.forEach((domain) => {
    const previousType = resolveRuleTypeForDomain(domain, previousBlockedSet, previousAllowedSet);
    const nextType = resolveRuleTypeForDomain(domain, nextBlockedSet, nextAllowedSet);
    const entries = Array.isArray(timeline[domain]) ? timeline[domain] : [];
    const activeEntry = getActiveTimelineEntry(entries);

    if (previousType && previousType !== nextType && activeEntry) {
      timeline[domain] = entries.map((entry) => (
        entry === activeEntry
          ? { ...entry, endEpochMs: Math.max(timestamp, entry.startEpochMs + 1) }
          : entry
      ));
    }

    if (nextType && (!activeEntry || activeEntry.type !== nextType || previousType !== nextType)) {
      addTimelineEntry(timeline, domain, {
        type: nextType,
        startEpochMs: timestamp,
      });
    }
  });

  return normalizeSiteRuleTimeline(timeline);
}

export function normalizeGlobalGoal(value) {
  const minutes = Math.floor(Number(value));
  if (!Number.isFinite(minutes) || minutes < 0) return 0;
  return Math.min(GLOBAL_GOAL_MAX_MINUTES, minutes);
}

export function requireGlobalGoal(value) {
  if (!Number.isInteger(value) || value < 0 || value > GLOBAL_GOAL_MAX_MINUTES) {
    throw new Error('GLOBAL_GOAL_VALUE_INVALID');
  }
  return value;
}

export function normalizeGlobalCapNotifyOnExceeded(
  value,
  fallback = DEFAULT_GLOBAL_CAP_NOTIFY_ON_EXCEEDED,
) {
  return resolveBooleanSetting(value, fallback);
}

export function normalizeRulesMode(value = null, fallback = DEFAULT_RULES_MODE) {
  const candidate = value === null || typeof value === 'undefined'
    ? fallback
    : value;
  return normalizeProductRulesMode(candidate);
}

export function normalizeProductRulesMode(value) {
  if (value !== PRODUCT_RULES_MODE) {
    throw new Error('RULES_MODE_UNSUPPORTED');
  }
  return value;
}

export function normalizeSyncSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  if (Object.hasOwn(src, 'globalFrictionLevel')) throw new Error('GLOBAL_FRICTION_LEVEL_RETIRED_PROFILE_RESET_REQUIRED');
  const memoryPurgeSettings = resolveMemoryPurgeSettings(src);
  return {
    blockedUrls: normalizeUrlList(src.blockedUrls, []),
    allowedUrls: normalizeUrlList(src.allowedUrls, []),
    globalGoal: normalizeGlobalGoal(src.globalGoal),
    globalCapNotifyOnExceeded: normalizeGlobalCapNotifyOnExceeded(src.globalCapNotifyOnExceeded),
    coolingCurve: normalizeCoolingCurve(src.coolingCurve),
    rulesMode: normalizeRulesMode(src.rulesMode),
    siteGoals: normalizeSiteGoals(src.siteGoals),
    siteGoalMeta: normalizeSiteGoalMeta(src.siteGoalMeta),
    siteRuleTimeline: normalizeSiteRuleTimeline(src.siteRuleTimeline),
    historyCleanupForBlocked: memoryPurgeSettings.historyCleanupForBlocked,
    concealBlockedBookmarks: memoryPurgeSettings.concealBlockedBookmarks,
  };
}
