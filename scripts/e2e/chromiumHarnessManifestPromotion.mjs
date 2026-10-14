const TEMPORARY_MANIFEST_KEYS = Object.freeze([
  'requiredHostPermissions',
  'requiredPermissions',
]);
const ALLOWLISTED_HOST_PERMISSION_PATTERN = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\/\*$/iu;
// Explicit loopback fixtures can use HTTP. This never admits a wildcard host,
// LAN address, arbitrary HTTP origin or a hostname merely containing localhost.
const LOOPBACK_HOST_PERMISSION_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.localhost)\/\*$/iu;
// Sites registration requests both schemes and subdomains. The integrated
// journey pregrants that product permission shape only for its named loopback
// fixture; arbitrary wildcard hosts remain forbidden.
const INTEGRATED_FIXTURE_HOST_PERMISSIONS = new Set([
  '*://native-video.localhost/*',
  '*://*.native-video.localhost/*',
]);

function sortedUniqueStrings(values, errorCode) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    throw new Error(`${errorCode}_ARRAY_REQUIRED`);
  }
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(`${errorCode}_INVALID:${String(value)}`);
    }
    return value;
  });
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

export function normalizeChromiumHarnessTemporaryManifest(temporaryManifest) {
  if (temporaryManifest === null || temporaryManifest === undefined) {
    return Object.freeze({
      requiredHostPermissions: Object.freeze([]),
      requiredPermissions: Object.freeze([]),
    });
  }
  if (typeof temporaryManifest !== 'object' || Array.isArray(temporaryManifest)) {
    throw new Error('CHROMIUM_HARNESS_TEMPORARY_MANIFEST_OBJECT_REQUIRED');
  }
  const unknownKeys = Object.keys(temporaryManifest)
    .filter((key) => !TEMPORARY_MANIFEST_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `CHROMIUM_HARNESS_TEMPORARY_MANIFEST_OPTION_UNKNOWN:${unknownKeys.sort().join(',')}`,
    );
  }
  const requiredPermissions = sortedUniqueStrings(
    temporaryManifest.requiredPermissions,
    'CHROMIUM_HARNESS_REQUIRED_PERMISSION',
  );
  for (const permission of requiredPermissions) {
    if (!/^[a-z][a-z0-9_.-]*$/iu.test(permission)) {
      throw new Error(`CHROMIUM_HARNESS_REQUIRED_PERMISSION_INVALID:${permission}`);
    }
  }
  const requiredHostPermissions = sortedUniqueStrings(
    temporaryManifest.requiredHostPermissions,
    'CHROMIUM_HARNESS_REQUIRED_HOST_PERMISSION',
  );
  for (const hostPermission of requiredHostPermissions) {
    if (
      hostPermission === '<all_urls>'
      || hostPermission === '*://*/*'
      || (!ALLOWLISTED_HOST_PERMISSION_PATTERN.test(hostPermission)
        && !LOOPBACK_HOST_PERMISSION_PATTERN.test(hostPermission)
        && !INTEGRATED_FIXTURE_HOST_PERMISSIONS.has(hostPermission))
    ) {
      throw new Error(
        `CHROMIUM_HARNESS_REQUIRED_HOST_PERMISSION_NOT_ALLOWLISTED:${hostPermission}`,
      );
    }
  }
  return Object.freeze({
    requiredHostPermissions: Object.freeze(requiredHostPermissions),
    requiredPermissions: Object.freeze(requiredPermissions),
  });
}

export function hasChromiumHarnessManifestPromotion(temporaryManifest) {
  return temporaryManifest.requiredPermissions.length > 0
    || temporaryManifest.requiredHostPermissions.length > 0;
}

export function promoteManifestForChromiumHarness(manifest, temporaryManifest = null) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('CHROMIUM_HARNESS_MANIFEST_OBJECT_REQUIRED');
  }
  const promotion = normalizeChromiumHarnessTemporaryManifest(temporaryManifest);
  const promoted = JSON.parse(JSON.stringify(manifest));
  if (!hasChromiumHarnessManifestPromotion(promotion)) return promoted;

  const requiredPermissions = new Set(
    Array.isArray(promoted.permissions) ? promoted.permissions : [],
  );
  for (const permission of promotion.requiredPermissions) requiredPermissions.add(permission);
  promoted.permissions = [...requiredPermissions];
  if (Array.isArray(promoted.optional_permissions)) {
    promoted.optional_permissions = promoted.optional_permissions.filter(
      (permission) => !requiredPermissions.has(permission),
    );
  }

  const requiredHostPermissions = new Set(
    Array.isArray(promoted.host_permissions) ? promoted.host_permissions : [],
  );
  for (const hostPermission of promotion.requiredHostPermissions) {
    requiredHostPermissions.add(hostPermission);
  }
  promoted.host_permissions = [...requiredHostPermissions];
  if (Array.isArray(promoted.optional_host_permissions)) {
    promoted.optional_host_permissions = promoted.optional_host_permissions.filter(
      (hostPermission) => !requiredHostPermissions.has(hostPermission),
    );
  }
  return promoted;
}
