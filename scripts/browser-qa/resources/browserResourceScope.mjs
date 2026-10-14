import fs from 'node:fs';
import path from 'node:path';

const GIT_DIR_PREFIX = 'gitdir:';

function fail(code, detail = '', cause = undefined) {
  throw new Error(detail ? `${code}:${detail}` : code, cause ? { cause } : undefined);
}

function canonicalExistingPath(candidate, code) {
  try {
    return fs.realpathSync.native(candidate);
  } catch (error) {
    fail(code, `${candidate}:${error?.code || 'unknown'}`, error);
  }
}

function resolveGitDirectory(projectRoot) {
  const marker = path.join(projectRoot, '.git');
  let markerStat;
  try {
    markerStat = fs.statSync(marker);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    fail('QA_BROWSER_PROJECT_GIT_MARKER_INVALID', marker, error);
  }
  if (markerStat.isDirectory()) return canonicalExistingPath(
    marker,
    'QA_BROWSER_PROJECT_GIT_DIRECTORY_INVALID',
  );
  if (!markerStat.isFile()) fail('QA_BROWSER_PROJECT_GIT_MARKER_INVALID', marker);

  let markerText;
  try {
    markerText = fs.readFileSync(marker, 'utf8').trim();
  } catch (error) {
    fail('QA_BROWSER_PROJECT_GIT_MARKER_INVALID', marker, error);
  }
  if (!markerText.startsWith(GIT_DIR_PREFIX)) {
    fail('QA_BROWSER_PROJECT_GIT_MARKER_INVALID', marker);
  }
  const declaredGitDir = markerText.slice(GIT_DIR_PREFIX.length).trim();
  if (!declaredGitDir || /[\r\n]/u.test(declaredGitDir)) {
    fail('QA_BROWSER_PROJECT_GIT_MARKER_INVALID', marker);
  }
  return canonicalExistingPath(
    path.resolve(projectRoot, declaredGitDir),
    'QA_BROWSER_PROJECT_GIT_DIRECTORY_INVALID',
  );
}

function resolveGitCommonDirectory(gitDirectory) {
  const commonDirFile = path.join(gitDirectory, 'commondir');
  let commonDir;
  try {
    commonDir = fs.readFileSync(commonDirFile, 'utf8').trim();
  } catch (error) {
    if (error?.code === 'ENOENT') return gitDirectory;
    fail('QA_BROWSER_PROJECT_GIT_COMMON_DIR_INVALID', commonDirFile, error);
  }
  if (!commonDir || /[\r\n]/u.test(commonDir)) {
    fail('QA_BROWSER_PROJECT_GIT_COMMON_DIR_INVALID', commonDirFile);
  }
  return canonicalExistingPath(
    path.resolve(gitDirectory, commonDir),
    'QA_BROWSER_PROJECT_GIT_COMMON_DIR_INVALID',
  );
}

export function resolveBrowserQaProjectScope(rootDir) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    fail('QA_BROWSER_PROJECT_ROOT_REQUIRED');
  }
  const projectRoot = canonicalExistingPath(
    path.resolve(rootDir),
    'QA_BROWSER_PROJECT_ROOT_INVALID',
  );
  const gitDirectory = resolveGitDirectory(projectRoot);
  const scopePath = gitDirectory
    ? resolveGitCommonDirectory(gitDirectory)
    : projectRoot;
  return Object.freeze({
    projectRoot,
    scopePath,
    scopeKind: gitDirectory ? 'git_common_directory' : 'project_root',
  });
}

export function normalizeBrowserQaCdpEndpoint(cdpEndpoint) {
  if (typeof cdpEndpoint !== 'string' || !cdpEndpoint.trim()) {
    fail('QA_BROWSER_CDP_ENDPOINT_REQUIRED');
  }
  let endpoint;
  try {
    endpoint = new URL(cdpEndpoint);
  } catch (error) {
    fail('QA_BROWSER_CDP_ENDPOINT_INVALID', cdpEndpoint, error);
  }
  if (
    endpoint.protocol !== 'http:'
    || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)
    || endpoint.username
    || endpoint.password
    || endpoint.search
    || endpoint.hash
    || (endpoint.pathname !== '/' && endpoint.pathname !== '')
    || !endpoint.port
  ) {
    fail('QA_BROWSER_CDP_ENDPOINT_INVALID', cdpEndpoint);
  }
  const port = Number(endpoint.port);
  if (!Number.isSafeInteger(port) || port < 1_024 || port > 65_535) {
    fail('QA_BROWSER_CDP_ENDPOINT_INVALID', cdpEndpoint);
  }
  return `http://127.0.0.1:${port}`;
}

function normalizeDeclaredProfile(profile) {
  if (typeof profile !== 'string' || !path.isAbsolute(profile)) {
    fail('QA_BROWSER_PROFILE_ABSOLUTE_REQUIRED');
  }
  const resolved = path.resolve(profile);
  try {
    return fs.realpathSync.native(resolved);
  } catch (error) {
    if (error?.code === 'ENOENT') return resolved;
    fail('QA_BROWSER_PROFILE_INVALID', resolved, error);
  }
}

function normalizePortableProfilePath(profile) {
  if (typeof profile !== 'string' || !profile.trim() || profile !== profile.trim()) {
    fail('QA_BROWSER_PROFILE_ABSOLUTE_REQUIRED');
  }
  let portable = profile.replaceAll('\\', '/');
  if (process.platform === 'win32') {
    // Interpret an explicit WSL drive path before host path.resolve adds a drive.
    portable = portable.replace(/^\/mnt\/([a-z])\//iu, '$1:/');
  }
  if (/^[a-z]:\//iu.test(portable)) {
    if (process.platform === 'win32') portable = normalizeDeclaredProfile(portable);
    return path.win32.normalize(portable).replaceAll('\\', '/').toLowerCase();
  }
  portable = normalizeDeclaredProfile(profile).replaceAll('\\', '/');
  const wsl = portable.match(/^\/mnt\/([a-z])\/(.*)$/iu);
  if (wsl) {
    return `${wsl[1].toLowerCase()}:/${wsl[2]}`.toLowerCase();
  }
  return process.platform === 'win32' ? portable.toLowerCase() : portable;
}

function normalizeProfileDirectory(profileDirectory, { caseInsensitive = false } = {}) {
  if (
    typeof profileDirectory !== 'string'
    || !profileDirectory.trim()
    || profileDirectory !== profileDirectory.trim()
    || /[\\/\r\n]/u.test(profileDirectory)
  ) {
    fail('QA_BROWSER_PROFILE_DIRECTORY_INVALID');
  }
  return caseInsensitive ? profileDirectory.toLowerCase() : profileDirectory;
}

/**
 * Resolves the independent host-global physical identities behind an attach.
 * Endpoint and user-data root are separate locks: either one naming the same
 * physical browser must serialize, even when the other declaration differs.
 * profileDirectory remains an exact browser-identity field, but it cannot split
 * capacity because Chromium singleton ownership and the extension artifact slot
 * are both rooted at userDataDir.
 */
export function resolveBrowserQaPhysicalResourceIdentities({
  cdpEndpoint,
  userDataDir = null,
  profile = null,
  profileDirectory = null,
} = {}) {
  const normalizedEndpoint = normalizeBrowserQaCdpEndpoint(cdpEndpoint);
  const declaredProfile = userDataDir ?? profile;
  if (declaredProfile === null && profileDirectory !== null) {
    fail('QA_BROWSER_PROFILE_IDENTITY_INCOMPLETE');
  }
  const identities = [JSON.stringify({
    resourceType: 'cdp_origin',
    cdpEndpoint: normalizedEndpoint,
  })];
  if (declaredProfile !== null) {
    const normalizedProfile = normalizePortableProfilePath(declaredProfile);
    if (profileDirectory !== null) {
      normalizeProfileDirectory(profileDirectory, {
        caseInsensitive: /^[a-z]:\//u.test(normalizedProfile),
      });
    }
    identities.push(JSON.stringify({
      resourceType: 'user_data_dir',
      userDataDir: normalizedProfile,
    }));
  }
  return Object.freeze(
    [...new Set(identities)].sort((left, right) => left.localeCompare(right)),
  );
}

export function resolveBrowserQaResourceScope({ environment, rootDir } = {}) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    fail('QA_BROWSER_RESOURCE_ENVIRONMENT_REQUIRED');
  }
  if (environment.processOwnership === 'attach_only') {
    const cdpEndpoint = normalizeBrowserQaCdpEndpoint(environment.cdpEndpoint);
    normalizeDeclaredProfile(environment.profile);
    normalizeProfileDirectory(environment.profileDirectory);
    return Object.freeze({
      scopeKind: 'host_browser_identity',
      scopePath: null,
      resourceIdentity: JSON.stringify({
        processOwnership: 'attach_only',
        cdpEndpoint,
      }),
    });
  }
  if (environment.processOwnership !== 'owned') {
    fail('QA_BROWSER_RESOURCE_PROCESS_OWNERSHIP_INVALID');
  }
  const project = resolveBrowserQaProjectScope(rootDir);
  return Object.freeze({
    scopeKind: project.scopeKind,
    scopePath: project.scopePath,
    resourceIdentity: JSON.stringify({
      processOwnership: 'owned',
      projectScope: project.scopePath,
      environmentId: environment.id,
    }),
  });
}
