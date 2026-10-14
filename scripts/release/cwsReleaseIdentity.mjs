const CHROME_WEB_STORE_HOST = 'chromewebstore.google.com';
const CHROME_EXTENSION_ID_PATTERN = /^[a-p]{32}$/u;
const CHROME_MANIFEST_VERSION_PART_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const PLACEHOLDER_PATTERN = /(?:example|placeholder|replace[-_ ]?me|your[-_ ]?extension|<[^>]+>|\b(?:todo|tbd)\b)/iu;

export const CWS_RELEASE_MODES = Object.freeze({
  FIRST: 'first',
  UPDATE: 'update',
});

function fail(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

export function assertCanonicalCwsExtensionId(value) {
  const extensionId = String(value ?? '').trim();
  if (!extensionId) fail('CWS_RELEASE_EXTENSION_ID_REQUIRED');
  if (
    !CHROME_EXTENSION_ID_PATTERN.test(extensionId)
    || /^([a-p])\1{31}$/u.test(extensionId)
  ) {
    fail('CWS_RELEASE_EXTENSION_ID_INVALID', extensionId);
  }
  return extensionId;
}

export function assertChromeWebStoreDetailUrl(value, { expectedExtensionId } = {}) {
  const candidate = String(value ?? '').trim();
  if (!candidate) fail('CWS_RELEASE_STORE_URL_REQUIRED');
  if (PLACEHOLDER_PATTERN.test(candidate)) {
    fail('CWS_RELEASE_STORE_URL_PLACEHOLDER');
  }

  let storeUrl;
  try {
    storeUrl = new URL(candidate);
  } catch {
    fail('CWS_RELEASE_STORE_URL_INVALID', candidate);
  }

  const pathSegments = storeUrl.pathname.split('/').filter(Boolean);
  const extensionId = pathSegments.at(-1) ?? '';
  const canonicalPath = (
    pathSegments[0] === 'detail'
    && (pathSegments.length === 2 || pathSegments.length === 3)
  );
  if (
    storeUrl.protocol !== 'https:'
    || storeUrl.hostname !== CHROME_WEB_STORE_HOST
    || storeUrl.port
    || storeUrl.username
    || storeUrl.password
    || storeUrl.search
    || storeUrl.hash
    || !canonicalPath
  ) {
    fail('CWS_RELEASE_STORE_URL_NOT_CANONICAL', candidate);
  }

  const canonicalExtensionId = assertCanonicalCwsExtensionId(extensionId);
  if (
    expectedExtensionId !== undefined
    && canonicalExtensionId !== assertCanonicalCwsExtensionId(expectedExtensionId)
  ) {
    fail(
      'CWS_RELEASE_STORE_EXTENSION_ID_MISMATCH',
      `expected=${expectedExtensionId}:actual=${canonicalExtensionId}`,
    );
  }

  return Object.freeze({
    extensionId: canonicalExtensionId,
    url: storeUrl.href,
  });
}

export function parseChromeManifestVersion(value, code = 'CWS_RELEASE_VERSION_INVALID') {
  const version = String(value ?? '').trim();
  const parts = version.split('.');
  if (
    parts.length < 1
    || parts.length > 4
    || parts.some((part) => !CHROME_MANIFEST_VERSION_PART_PATTERN.test(part))
  ) {
    fail(code, version);
  }
  const numericParts = parts.map(Number);
  if (
    numericParts.some((part) => !Number.isInteger(part) || part > 65535)
    || numericParts.every((part) => part === 0)
  ) {
    fail(code, version);
  }
  return Object.freeze({
    parts: Object.freeze([...numericParts, 0, 0, 0].slice(0, 4)),
    version,
  });
}

export function compareChromeManifestVersions(left, right) {
  const leftVersion = parseChromeManifestVersion(left);
  const rightVersion = parseChromeManifestVersion(right);
  for (let index = 0; index < 4; index += 1) {
    const difference = leftVersion.parts[index] - rightVersion.parts[index];
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function assertCanonicalCwsReleaseTag(tags, currentVersion) {
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
    fail('CWS_RELEASE_GIT_TAGS_INVALID');
  }
  const version = parseChromeManifestVersion(
    currentVersion,
    'CWS_RELEASE_CURRENT_VERSION_INVALID',
  ).version;
  const expectedTag = `cws-v${version}`;
  const cwsTags = tags.filter((tag) => tag.startsWith('cws-v'));
  if (cwsTags.length !== 1 || cwsTags[0] !== expectedTag) {
    fail(
      'CWS_RELEASE_GIT_TAG_MISMATCH',
      `expected=${expectedTag}:actual=${cwsTags.join(',') || 'missing'}`,
    );
  }
  return expectedTag;
}

export function resolveCwsReleaseIdentity({ environment, currentVersion } = {}) {
  if (!environment || typeof environment !== 'object') {
    fail('CWS_RELEASE_ENVIRONMENT_REQUIRED');
  }
  const extensionId = assertCanonicalCwsExtensionId(
    environment.ENTROPY_CWS_EXTENSION_ID,
  );
  const store = assertChromeWebStoreDetailUrl(
    environment.VITE_CHROME_STORE_URL,
    { expectedExtensionId: extensionId },
  );
  const releaseMode = String(environment.ENTROPY_CWS_RELEASE_MODE ?? '').trim();
  if (!Object.values(CWS_RELEASE_MODES).includes(releaseMode)) {
    fail('CWS_RELEASE_MODE_INVALID', releaseMode || 'missing');
  }

  const current = parseChromeManifestVersion(
    currentVersion,
    'CWS_RELEASE_CURRENT_VERSION_INVALID',
  );
  const previousCandidate = String(
    environment.ENTROPY_CWS_PREVIOUS_VERSION ?? '',
  ).trim();
  let previousVersion = null;

  if (releaseMode === CWS_RELEASE_MODES.FIRST) {
    if (previousCandidate) {
      fail('CWS_RELEASE_FIRST_PREVIOUS_VERSION_FORBIDDEN', previousCandidate);
    }
  } else {
    if (!previousCandidate) fail('CWS_RELEASE_PREVIOUS_VERSION_REQUIRED');
    previousVersion = parseChromeManifestVersion(
      previousCandidate,
      'CWS_RELEASE_PREVIOUS_VERSION_INVALID',
    ).version;
    if (compareChromeManifestVersions(current.version, previousVersion) <= 0) {
      fail(
        'CWS_RELEASE_VERSION_NOT_MONOTONIC',
        `previous=${previousVersion}:current=${current.version}`,
      );
    }
  }

  return Object.freeze({
    currentVersion: current.version,
    extensionId,
    previousVersion,
    releaseMode,
    storeUrl: store.url,
  });
}
