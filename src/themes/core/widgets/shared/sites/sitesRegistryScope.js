export const SITES_REGISTRY_SCOPE_IDS = Object.freeze({
  ALL: 'all',
  BLOCKED: 'blocked',
  ALLOWED: 'allowed',
  TRACKED: 'tracked',
});

const VALID_SITES_REGISTRY_SCOPES = new Set(Object.values(SITES_REGISTRY_SCOPE_IDS));

export function isSitesRegistryScope(scope) {
  return VALID_SITES_REGISTRY_SCOPES.has(scope);
}

export function requireSitesRegistryScope(scope) {
  if (!isSitesRegistryScope(scope)) {
    throw new Error(`SITES_REGISTRY_SCOPE_INVALID:${String(scope)}`);
  }
  return scope;
}
