import { normalizeFilteringMode } from '../../settings/config/blockingPolicy.js';
import { normalizeInsightsConsent, normalizeInsightsMode } from '../../settings/config/insightsMode.js';
import { normalizeProtectionPresetAssignments } from '../../protection/catalog/presetContract.js';
import {
  DEFAULT_DATA_COLLECTION_MODE,
  normalizeDataCollectionMode,
} from '../../settings/config/dataCollectionPolicy.js';
import {
  DEFAULT_RULES_MODE,
  normalizeGlobalGoal,
  normalizeRulesMode,
  normalizeSiteGoals,
  normalizeSiteRuleTimeline,
  normalizeUrlList,
} from '../../settings/config/siteRules.js';

function normalizePolicyList(value) {
  return normalizeUrlList(value, []).map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
}

export function buildStatsAnalysisPolicyInput(source = {}) {
  const dashboardPolicy = buildStatsDashboardPolicyInput(source);
  return {
    blockedUrls: dashboardPolicy.blockedUrls,
    allowedUrls: dashboardPolicy.allowedUrls,
    trackingExcludedUrls: dashboardPolicy.trackingExcludedUrls,
    filteringMode: dashboardPolicy.filteringMode,
    globalGoal: dashboardPolicy.globalGoal,
    siteRuleTimeline: dashboardPolicy.siteRuleTimeline,
  };
}

export function buildStatsDashboardPolicyInput(source = {}) {
  const candidate = source && typeof source === 'object' ? source : {};
  return {
    blockedUrls: normalizePolicyList(candidate.blockedUrls),
    allowedUrls: normalizePolicyList(candidate.allowedUrls),
    trackingExcludedUrls: normalizePolicyList(candidate.trackingExcludedUrls),
    filteringMode: normalizeFilteringMode(candidate.filteringMode || 'blocklist'),
    globalGoal: normalizeGlobalGoal(candidate.globalGoal),
    siteGoals: normalizeSiteGoals(candidate.siteGoals),
    siteRuleTimeline: normalizeSiteRuleTimeline(candidate.siteRuleTimeline),
    rulesMode: normalizeRulesMode(candidate.rulesMode, DEFAULT_RULES_MODE),
    dataCollectionMode: normalizeDataCollectionMode(
      candidate.dataCollectionMode,
      DEFAULT_DATA_COLLECTION_MODE,
    ),
    insightsConsent: normalizeInsightsConsent(candidate.insightsConsent),
    insightsMode: normalizeInsightsMode(candidate.insightsMode),
    protectionPresetAssignments: normalizeProtectionPresetAssignments(candidate.protectionPresetAssignments),
  };
}

export function buildStatsAnalysisGoals(source = {}) {
  const policy = buildStatsAnalysisPolicyInput(source);
  return {
    globalGoal: policy.globalGoal,
  };
}

export function buildStatsAnalysisPolicyFingerprint(source = {}) {
  const policy = buildStatsAnalysisPolicyInput(source);
  const blocked = [...policy.blockedUrls].sort();
  const allowed = [...policy.allowedUrls].sort();
  const excluded = [...policy.trackingExcludedUrls].sort();
  const siteRuleTimeline = Object.entries(policy.siteRuleTimeline || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, entries]) => `${domain}:${JSON.stringify(entries)}`)
    .join('|');
  return `mode:${policy.filteringMode}|goal:${policy.globalGoal}|blocked:${blocked.join('|')}|allowed:${allowed.join('|')}|excluded:${excluded.join('|')}|siteRuleTimeline:${siteRuleTimeline}`;
}

export function buildStatsDashboardPolicyFingerprint(source = {}) {
  const policy = buildStatsDashboardPolicyInput(source);
  const blocked = [...policy.blockedUrls].sort();
  const allowed = [...policy.allowedUrls].sort();
  const excluded = [...policy.trackingExcludedUrls].sort();
  const siteGoals = Object.entries(policy.siteGoals)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, minutes]) => `${domain}:${minutes}`)
    .join('|');
  const siteRuleTimeline = Object.entries(policy.siteRuleTimeline)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, entries]) => `${domain}:${JSON.stringify(entries)}`)
    .join('|');
  const assignments = { ...policy.protectionPresetAssignments, sitePresetIds: Object.fromEntries(
    Object.entries(policy.protectionPresetAssignments.sitePresetIds).sort(([left], [right]) => left.localeCompare(right)),
  ) };
  return `mode:${policy.filteringMode}|goal:${policy.globalGoal}|collection:${policy.dataCollectionMode}|consent:${policy.insightsConsent}|insights:${policy.insightsMode}|presets:${JSON.stringify(assignments)}|blocked:${blocked.join('|')}|allowed:${allowed.join('|')}|excluded:${excluded.join('|')}|rules:${policy.rulesMode}|siteGoals:${siteGoals}|siteRuleTimeline:${siteRuleTimeline}`;
}
