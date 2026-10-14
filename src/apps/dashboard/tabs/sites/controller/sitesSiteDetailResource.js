import { normalizeDomain } from '../../../../../lib/domain.js';
import {
  requireSitesSiteDetailQueryResult,
  requireSitesSiteDetailRevision,
} from '../../../../../domains/stats/contracts/sitesSiteDetailContracts.js';
import { runtimeSendMessage } from '../../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';

const DETAIL_CACHE_MAX_ENTRIES = 12;
const detailCache = new Map();
const detailInFlight = new Map();

export const SITES_SITE_DETAIL_RESOURCE_ERROR = Object.freeze({
  RESPONSE_REVISION_MISMATCH: 'SITES_SITE_DETAIL_RESPONSE_REVISION_MISMATCH',
});

function createDetailError(response) {
  const code = typeof response?.error?.code === 'string' && response.error.code
    ? response.error.code
    : 'SITES_SITE_DETAIL_QUERY_FAILED';
  const message = typeof response?.error?.message === 'string' && response.error.message
    ? response.error.message
    : code;
  const error = new Error(message);
  error.code = code;
  return error;
}

function createRevisionMismatchError({
  domain,
  requestedSiteDetailRevision,
  responseSiteDetailRevision,
}) {
  const code = SITES_SITE_DETAIL_RESOURCE_ERROR.RESPONSE_REVISION_MISMATCH;
  const error = new Error(code);
  error.code = code;
  error.domain = domain;
  error.requestedSiteDetailRevision = requestedSiteDetailRevision;
  error.responseSiteDetailRevision = responseSiteDetailRevision;
  error.responseCachePrewarmed = true;
  return error;
}

export function isSitesSiteDetailRevisionMismatchError(error) {
  return error?.code === SITES_SITE_DETAIL_RESOURCE_ERROR.RESPONSE_REVISION_MISMATCH
    && typeof error?.requestedSiteDetailRevision === 'string'
    && typeof error?.responseSiteDetailRevision === 'string'
    && error.requestedSiteDetailRevision !== error.responseSiteDetailRevision;
}

function requireDetailRequest({
  domain,
  policyInput,
  policyFingerprint,
  siteDetailRevision,
  telemetrySource = 'render',
} = {}) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    const error = new Error('SITES_SITE_DETAIL_RESOURCE_DOMAIN_REQUIRED');
    error.code = 'SITES_SITE_DETAIL_RESOURCE_DOMAIN_REQUIRED';
    throw error;
  }
  if (!policyInput || typeof policyInput !== 'object' || Array.isArray(policyInput)) {
    const error = new Error('SITES_SITE_DETAIL_RESOURCE_POLICY_REQUIRED');
    error.code = 'SITES_SITE_DETAIL_RESOURCE_POLICY_REQUIRED';
    throw error;
  }
  const normalizedFingerprint = typeof policyFingerprint === 'string'
    ? policyFingerprint.trim()
    : '';
  if (!normalizedFingerprint) {
    const error = new Error('SITES_SITE_DETAIL_RESOURCE_POLICY_FINGERPRINT_REQUIRED');
    error.code = 'SITES_SITE_DETAIL_RESOURCE_POLICY_FINGERPRINT_REQUIRED';
    throw error;
  }
  if (telemetrySource !== 'boot' && telemetrySource !== 'render') {
    const error = new Error('SITES_SITE_DETAIL_RESOURCE_TELEMETRY_SOURCE_INVALID');
    error.code = 'SITES_SITE_DETAIL_RESOURCE_TELEMETRY_SOURCE_INVALID';
    throw error;
  }
  const normalizedSiteDetailRevision = requireSitesSiteDetailRevision(siteDetailRevision);
  return {
    domain: normalizedDomain,
    policyInput,
    policyFingerprint: normalizedFingerprint,
    siteDetailRevision: normalizedSiteDetailRevision,
    telemetrySource,
    key: [
      normalizedFingerprint,
      normalizedSiteDetailRevision,
      normalizedDomain,
    ].join('::'),
  };
}

function writeBoundedCache(key, detail) {
  detailCache.delete(key);
  detailCache.set(key, detail);
  while (detailCache.size > DETAIL_CACHE_MAX_ENTRIES) {
    detailCache.delete(detailCache.keys().next().value);
  }
}

export function peekSitesSiteDetail(request) {
  const { key } = requireDetailRequest(request);
  return detailCache.get(key) || null;
}

export function createSitesSiteDetailResourceKey(request) {
  return requireDetailRequest(request).key;
}

export function preloadSitesSiteDetail(request) {
  const resolved = requireDetailRequest(request);
  const cached = detailCache.get(resolved.key);
  if (cached) {
    recordDashboardTabEntryStage('sites', 'data:sites-site-detail', {
      cacheStatus: 'hit',
      source: resolved.telemetrySource,
    });
    return Promise.resolve(cached);
  }

  const pending = detailInFlight.get(resolved.key);
  if (pending) {
    recordDashboardTabEntryStage('sites', 'data:sites-site-detail', {
      cacheStatus: 'join',
      source: resolved.telemetrySource,
    });
    return pending;
  }

  recordDashboardTabEntryStage('sites', 'data:sites-site-detail', {
    cacheStatus: 'miss',
    ioKind: 'runtime-message',
    source: resolved.telemetrySource,
  });
  const promise = runtimeSendMessage({
    action: MESSAGE_ACTIONS.GET_SITES_SITE_DETAIL,
    domain: resolved.domain,
    policyInput: resolved.policyInput,
    siteDetailRevision: resolved.siteDetailRevision,
  }).then((response) => {
    const detail = response?.sitesSiteDetail;
    if (!response?.success || !detail || typeof detail !== 'object') {
      throw createDetailError(response);
    }
    if (detail.domain !== resolved.domain) {
      const error = new Error('SITES_SITE_DETAIL_RESPONSE_DOMAIN_MISMATCH');
      error.code = 'SITES_SITE_DETAIL_RESPONSE_DOMAIN_MISMATCH';
      throw error;
    }
    requireSitesSiteDetailQueryResult(response);
    const responseRevision = requireSitesSiteDetailRevision(response?.siteDetailRevision);
    const responseKey = requireDetailRequest({
      domain: resolved.domain,
      policyInput: resolved.policyInput,
      policyFingerprint: resolved.policyFingerprint,
      siteDetailRevision: responseRevision,
      telemetrySource: resolved.telemetrySource,
    }).key;
    writeBoundedCache(responseKey, detail);
    if (responseRevision !== resolved.siteDetailRevision) {
      throw createRevisionMismatchError({
        domain: resolved.domain,
        requestedSiteDetailRevision: resolved.siteDetailRevision,
        responseSiteDetailRevision: responseRevision,
      });
    }
    return detail;
  }).finally(() => {
    if (detailInFlight.get(resolved.key) === promise) {
      detailInFlight.delete(resolved.key);
    }
  });
  detailInFlight.set(resolved.key, promise);
  return promise;
}

export function resetSitesSiteDetailResourceCache() {
  detailCache.clear();
  detailInFlight.clear();
}
