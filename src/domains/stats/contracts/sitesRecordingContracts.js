const RECORDING_REASONS = new Set(['recording', 'mode_off', 'consent_required', 'excluded', 'outside_scope']);

export function requireSitesRecordingPolicy(value) {
  if (!value || typeof value !== 'object'
    || !['off', 'protected_sites', 'all_sites_minimal'].includes(value.configuredMode)
    || !['off', 'protected_sites', 'all_sites'].includes(value.effectiveScope)
    || !['recording', 'mode_off', 'consent_required'].includes(value.reason)
    || typeof value.globalCapAvailable !== 'boolean'
    || !Number.isSafeInteger(value.excludedProtectedCount) || value.excludedProtectedCount < 0
    || (value.effectiveScope === 'off' && value.globalCapAvailable)
    || (value.effectiveScope === 'off') === (value.reason === 'recording')
    || (value.configuredMode === 'off' && value.reason !== 'mode_off')
    || (value.effectiveScope === 'all_sites' && value.configuredMode !== 'all_sites_minimal')
    || (value.effectiveScope === 'protected_sites' && value.configuredMode !== 'protected_sites')) {
    throw new Error('SITES_RECORDING_POLICY_INVALID');
  }
  return value;
}

export function requireSitesDomainRecording(value) {
  if (!value || typeof value !== 'object' || typeof value.enabled !== 'boolean'
    || !RECORDING_REASONS.has(value.reason) || value.enabled !== (value.reason === 'recording')) {
    throw new Error('SITES_DOMAIN_RECORDING_INVALID');
  }
  return value;
}

export function requireSitesCapAvailability(value) {
  if (!value || typeof value !== 'object' || typeof value.available !== 'boolean'
    || !['available', 'not_protected', 'mode_off', 'consent_required', 'excluded', 'outside_scope'].includes(value.reason)
    || value.available !== (value.reason === 'available')) throw new Error('SITES_CAP_AVAILABILITY_INVALID');
  return value;
}
