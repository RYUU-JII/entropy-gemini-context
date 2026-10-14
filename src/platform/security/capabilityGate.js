import {
  permissionsContains,
  permissionsContainsStrict,
  permissionsRequest,
  permissionsRequestStrict,
} from '../chrome/ChromeService.js';
import {
  buildOriginPatternsForDomain,
  buildExactOriginPatternForUrl,
  normalizePermissionDomainInput,
  requireConcreteOriginPermissions,
} from '../../lib/permissions.js';

async function ensureRequest(request) {
  const granted = await permissionsContains(request);
  if (granted) return true;
  return permissionsRequest(request);
}

async function ensureRequestStrict(request) {
  const granted = await permissionsContainsStrict(request);
  if (granted) return true;
  return permissionsRequestStrict(request);
}

// Called directly from the popup's explicit embed-access click. Do not await a
// read before requesting: the browser permission prompt requires that gesture.
// This grants browser access only and never registers a protection target.
export function requestEmbeddedMediaOriginPermissionStrict(origin) {
  if (typeof origin !== 'string' || !URL.canParse(origin)) {
    throw new Error('EMBED_MEDIA_PERMISSION_ORIGIN_INVALID');
  }
  const parsed = new URL(origin);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.hostname.includes('*')) {
    throw new Error('EMBED_MEDIA_PERMISSION_ORIGIN_INVALID');
  }
  // Browser host permissions cannot limit access to a non-default port. Do not
  // silently broaden a permission requested for one such origin to all ports.
  if (parsed.port) throw new Error('EMBED_MEDIA_PERMISSION_PORT_UNSUPPORTED');
  const pattern = buildExactOriginPatternForUrl(origin);
  if (!pattern) throw new Error('EMBED_MEDIA_PERMISSION_ORIGIN_INVALID');
  return permissionsRequestStrict({ permissions: ['scripting'], origins: [pattern] });
}

export async function ensureScriptingPermission() {
  return ensureRequest({ permissions: ['scripting'] });
}

export async function ensureScriptingPermissionStrict() {
  return ensureRequestStrict({ permissions: ['scripting'] });
}

export async function ensureHistoryPermission() {
  return ensureRequest({ permissions: ['history'] });
}

export async function ensureHistoryPermissionStrict() {
  return ensureRequestStrict({ permissions: ['history'] });
}

export async function ensureNotificationsPermission() {
  return ensureRequest({ permissions: ['notifications'] });
}

export async function ensureNotificationsPermissionStrict() {
  return ensureRequestStrict({ permissions: ['notifications'] });
}

export async function ensureBookmarksPermission() {
  return ensureRequest({ permissions: ['bookmarks'] });
}

export async function ensureBookmarksPermissionStrict() {
  return ensureRequestStrict({ permissions: ['bookmarks'] });
}

export async function ensureOriginEnforcementPermissions(origins = []) {
  const uniqueOrigins = requireConcreteOriginPermissions(origins);
  if (!uniqueOrigins.length) return ensureScriptingPermission();
  return ensureRequest({
    permissions: ['scripting'],
    origins: uniqueOrigins,
  });
}

export async function ensureOriginEnforcementPermissionsStrict(origins = []) {
  const uniqueOrigins = requireConcreteOriginPermissions(origins);
  if (!uniqueOrigins.length) return ensureRequestStrict({ permissions: ['scripting'] });
  return ensureRequestStrict({
    permissions: ['scripting'],
    origins: uniqueOrigins,
  });
}

export async function ensureMemoryPurgePermissions() {
  return ensureRequest({ permissions: ['history', 'bookmarks'] });
}

export async function ensurePrecisionInsightsPermissionBundle() {
  return ensureRequest({ permissions: ['idle', 'webNavigation'] });
}

export async function ensurePrecisionInsightsPermissionBundleStrict() {
  return ensureRequestStrict({ permissions: ['idle', 'webNavigation'] });
}

export async function ensureAnalysisPermissionBundle() {
  return ensurePrecisionInsightsPermissionBundle();
}

export async function ensureDomainEnforcementPermission(domain) {
  const normalized = normalizePermissionDomainInput(domain);
  if (!normalized) return false;

  const origins = buildOriginPatternsForDomain(normalized);
  if (!origins.length) return false;

  return ensureOriginEnforcementPermissions(origins);
}

export async function ensureDomainEnforcementPermissionStrict(domain) {
  const normalized = normalizePermissionDomainInput(domain);
  if (!normalized) return false;

  const origins = buildOriginPatternsForDomain(normalized);
  if (!origins.length) return false;

  return ensureOriginEnforcementPermissionsStrict(origins);
}
