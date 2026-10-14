import { normalizeDomain } from '../../../lib/domain.js';
import { normalizeStatsDomainKey } from './statsContracts.js';
import { requireStatsRuntimeEpoch } from './statsRuntimeEpochContracts.js';
import { requireSitesDomainRecording, requireSitesCapAvailability } from './sitesRecordingContracts.js';

export const SITES_SITE_DETAIL_ERROR = Object.freeze({
  DOMAIN_REQUIRED: 'STATS_SITES_SITE_DETAIL_DOMAIN_REQUIRED',
  DOMAIN_INVALID: 'STATS_SITES_SITE_DETAIL_DOMAIN_INVALID',
  REVISION_REQUIRED: 'STATS_SITES_SITE_DETAIL_REVISION_REQUIRED',
  REVISION_INVALID: 'STATS_SITES_SITE_DETAIL_REVISION_INVALID',
  QUERY_RESULT_INVALID: 'SITES_SITE_DETAIL_QUERY_RESULT_INVALID',
});

export const SITES_SITE_DETAIL_REVISION_VERSION = 2;
const SITES_SITE_DETAIL_REVISION_PREFIX = `sites-site-detail:v${SITES_SITE_DETAIL_REVISION_VERSION}`;

function createSitesSiteDetailContractError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeSitesSiteDetailDomain(value) {
  const normalized = normalizeDomain(value);
  if (!normalized) return '';
  const statsDomain = normalized.includes(':') && !normalized.startsWith('[')
    ? `[${normalized}]`
    : normalized;
  return normalizeStatsDomainKey(statsDomain) || '';
}

export function requireSitesSiteDetailDomain(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.DOMAIN_REQUIRED);
  }
  const normalized = normalizeSitesSiteDetailDomain(value);
  if (!normalized) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.DOMAIN_INVALID);
  }
  return normalized;
}

export function createSitesSiteDetailRevision({
  factsRuntimeEpoch,
  factsRuntimeRevision,
  policyFingerprint,
  insightsMode,
  cycleFingerprint,
} = {}) {
  let normalizedFactsRuntimeEpoch;
  try {
    normalizedFactsRuntimeEpoch = requireStatsRuntimeEpoch(factsRuntimeEpoch);
  } catch {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  if (!Number.isSafeInteger(factsRuntimeRevision) || factsRuntimeRevision < 0) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  const normalizedPolicyFingerprint = typeof policyFingerprint === 'string'
    ? policyFingerprint.trim()
    : '';
  const normalizedInsightsMode = typeof insightsMode === 'string' ? insightsMode.trim() : '';
  const normalizedCycleFingerprint = typeof cycleFingerprint === 'string'
    ? cycleFingerprint.trim()
    : '';
  if (!normalizedPolicyFingerprint || !normalizedInsightsMode || !normalizedCycleFingerprint) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  return [
    SITES_SITE_DETAIL_REVISION_PREFIX,
    `epoch:${normalizedFactsRuntimeEpoch}`,
    `facts:${factsRuntimeRevision}`,
    `policy:${normalizedPolicyFingerprint}`,
    `insights:${normalizedInsightsMode}`,
    `cycle:${normalizedCycleFingerprint}`,
  ].join('::');
}

export function requireSitesSiteDetailRevision(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_REQUIRED);
  }
  const normalized = value.trim();
  const prefix = `${SITES_SITE_DETAIL_REVISION_PREFIX}::`;
  if (!normalized.startsWith(prefix)) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  const revisionMatch = /^epoch:([0-9a-f]{32})::facts:(\d+)::policy:(.+)::insights:([^:]+)::cycle:(.+)$/u.exec(
    normalized.slice(prefix.length),
  );
  const factsRuntimeRevision = Number(revisionMatch?.[2]);
  if (!revisionMatch || !Number.isSafeInteger(factsRuntimeRevision)) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  try {
    requireStatsRuntimeEpoch(revisionMatch[1]);
  } catch {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.REVISION_INVALID);
  }
  return normalized;
}

export function requireSitesSiteDetailQueryResult(value) {
  if (!isRecord(value) || !isRecord(value.sitesSiteDetail)) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.QUERY_RESULT_INVALID);
  }
  try {
    requireSitesSiteDetailRevision(value.siteDetailRevision);
  } catch {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.QUERY_RESULT_INVALID);
  }
  const detail = value.sitesSiteDetail;
  requireSitesDomainRecording(detail.recording);
  requireSitesCapAvailability(detail.capAvailability);
  requireSitesDomainRecording(detail.registryEntry?.recording);
  requireSitesCapAvailability(detail.registryEntry?.capAvailability);
  const detailDomain = normalizeSitesSiteDetailDomain(detail.domain);
  const intelDomain = normalizeSitesSiteDetailDomain(detail.intel?.domain);
  const registryDomain = normalizeSitesSiteDetailDomain(detail.registryEntry?.domain);
  const validPolicyOnly = detail.mode === 'policy_only'
    && detail.intel === null && detail.recording?.enabled === false;
  const validAnalysis = detail.mode === 'analysis'
    && detail.recording?.enabled === true && isRecord(detail.intel)
    && detail.intel.detailTier === 'full' && intelDomain === detailDomain;
  if (
    !detailDomain
    || detail.domain !== detailDomain
    || (!validPolicyOnly && !validAnalysis)
    || !isRecord(detail.registryEntry)
    || registryDomain !== detailDomain
  ) {
    throw createSitesSiteDetailContractError(SITES_SITE_DETAIL_ERROR.QUERY_RESULT_INVALID);
  }
  return value;
}
