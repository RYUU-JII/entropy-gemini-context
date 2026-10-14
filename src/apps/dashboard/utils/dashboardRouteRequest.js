import { getDashboardDefaultTabId, isKnownDashboardTabId } from '../tabs/registry.js';
import { buildSiteRegistrationIntent } from '../../../lib/firstSiteRegistrationIntent.js';
import { SITE_REGISTRATION_JOURNEY_CONTRACT } from '../../../domains/progression/policy/siteRegistrationJourneyPolicy.js';

function normalizeParams(params) {
  return params && typeof params === 'object' && !Array.isArray(params)
    ? params
    : null;
}

export function normalizeDashboardTabRequest(tabId, params = null) {
  const candidate = typeof tabId === 'string' ? tabId.trim().toLowerCase() : '';
  return {
    tabId: isKnownDashboardTabId(candidate) ? candidate : getDashboardDefaultTabId(),
    params: normalizeParams(params),
  };
}

export function buildDashboardSiteRegistrationRequest(options = {}) {
  return {
    tabId: 'main',
    params: { registrationIntent: buildSiteRegistrationIntent(options) },
  };
}

// Route admission uses the same owner projection as Popup and the pond. A URL
// is an uncommitted navigation intent and cannot reopen direct registration.
export function resolveDashboardRegistrationJourneyRoute(request, journey) {
  if (!journey || journey.contract !== SITE_REGISTRATION_JOURNEY_CONTRACT) {
    throw new Error('DASHBOARD_REGISTRATION_JOURNEY_REQUIRED');
  }
  if (request.tabId !== 'sites') return request;
  if (journey.sitesManagementVisible === true) return request;
  if (request.params?.add === true && journey.requiresDashboardRegistration === true) {
    return buildDashboardSiteRegistrationRequest({ domain: request.params?.domain || '' });
  }
  if (journey.sitesManagementVisible === false) return { tabId: 'main', params: null };
  return request;
}

export default normalizeDashboardTabRequest;
