import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const LANDING_BUILD_INFO_FILE = 'entropy-landing-build-info.json';
const LOWERCASE_GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/u;

function fail(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function comparePath(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

async function collectFiles(currentDir, rootDir, output = []) {
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    fail('LANDING_BUILD_DIRECTORY_UNAVAILABLE', `${currentDir}:${error?.message || error}`);
  }
  entries.sort((left, right) => comparePath(left.name, right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      fail('LANDING_BUILD_SYMLINK_FORBIDDEN', entry.name);
    }
    const absolutePath = path.resolve(currentDir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(absolutePath, rootDir, output);
      continue;
    }
    if (!entry.isFile()) fail('LANDING_BUILD_ENTRY_UNSUPPORTED', entry.name);
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
    if (!relativePath || relativePath.startsWith('../') || path.isAbsolute(relativePath)) {
      fail('LANDING_BUILD_PATH_INVALID', relativePath);
    }
    const data = await fs.readFile(absolutePath);
    output.push(Object.freeze({
      bytes: data.length,
      path: relativePath,
      sha256: sha256(data),
    }));
  }
  return output;
}

function validateBuildInfo(buildInfo, {
  expectedCwsIdentity,
  expectedLockfileSha256,
  expectedSourceIdentity,
  expectedSupportUrl,
}) {
  if (!buildInfo || typeof buildInfo !== 'object' || Array.isArray(buildInfo)) {
    fail('LANDING_BUILD_INFO_INVALID');
  }
  if (buildInfo.schemaVersion !== 1) fail('LANDING_BUILD_INFO_SCHEMA_INVALID');
  if (buildInfo.kind !== 'entropy-public-landing-build') {
    fail('LANDING_BUILD_INFO_KIND_INVALID', buildInfo.kind);
  }
  if (buildInfo.dirty !== false) fail('LANDING_BUILD_IS_DIRTY', buildInfo.buildId);
  if (
    !LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitCommitSha || '')
    || buildInfo.gitCommitSha !== expectedSourceIdentity?.gitCommitSha
  ) {
    fail(
      'LANDING_BUILD_COMMIT_MISMATCH',
      `expected=${expectedSourceIdentity?.gitCommitSha}:actual=${buildInfo.gitCommitSha}`,
    );
  }
  if (
    !LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitTreeSha || '')
    || buildInfo.gitTreeSha !== expectedSourceIdentity?.gitTreeSha
  ) {
    fail(
      'LANDING_BUILD_TREE_MISMATCH',
      `expected=${expectedSourceIdentity?.gitTreeSha}:actual=${buildInfo.gitTreeSha}`,
    );
  }
  if (
    !LOWERCASE_SHA256.test(buildInfo.lockfileSha256 || '')
    || buildInfo.lockfileSha256 !== expectedLockfileSha256
  ) {
    fail(
      'LANDING_BUILD_LOCKFILE_MISMATCH',
      `expected=${expectedLockfileSha256}:actual=${buildInfo.lockfileSha256}`,
    );
  }
  const createdAt = new Date(buildInfo.createdAt);
  if (
    typeof buildInfo.createdAt !== 'string'
    || Number.isNaN(createdAt.getTime())
    || createdAt.toISOString() !== buildInfo.createdAt
  ) {
    fail('LANDING_BUILD_TIMESTAMP_INVALID', buildInfo.createdAt);
  }
  const timestamp = buildInfo.createdAt.replace(/[-:.TZ]/gu, '').slice(0, 14);
  const expectedPrefix = `${timestamp}-${buildInfo.gitCommitSha.slice(0, 12)}-`;
  if (
    typeof buildInfo.buildId !== 'string'
    || !buildInfo.buildId.startsWith(expectedPrefix)
    || !buildInfo.buildId.endsWith('-clean')
  ) {
    fail('LANDING_BUILD_IDENTITY_INVALID', buildInfo.buildId);
  }
  if (
    buildInfo.chromeWebStore?.extensionId !== expectedCwsIdentity?.extensionId
    || buildInfo.chromeWebStore?.url !== expectedCwsIdentity?.storeUrl
  ) {
    fail(
      'LANDING_BUILD_CWS_IDENTITY_MISMATCH',
      `expected=${expectedCwsIdentity?.extensionId}/${expectedCwsIdentity?.storeUrl}`,
    );
  }
  if (buildInfo.supportUrl !== expectedSupportUrl) {
    fail(
      'LANDING_BUILD_SUPPORT_URL_MISMATCH',
      `expected=${expectedSupportUrl}:actual=${buildInfo.supportUrl}`,
    );
  }
  return buildInfo;
}

export async function collectLandingBuildSnapshot({
  distDir,
  expectedCwsIdentity,
  expectedLockfileSha256,
  expectedSourceIdentity,
  expectedSupportUrl,
} = {}) {
  if (typeof distDir !== 'string' || !path.isAbsolute(distDir)) {
    fail('LANDING_BUILD_DIRECTORY_INVALID', distDir);
  }
  const files = await collectFiles(distDir, distDir);
  if (files.length === 0) fail('LANDING_BUILD_EMPTY');
  const buildInfoEntry = files.find((entry) => entry.path === LANDING_BUILD_INFO_FILE);
  if (!buildInfoEntry) fail('LANDING_BUILD_INFO_MISSING');

  let buildInfo;
  try {
    buildInfo = JSON.parse(await fs.readFile(
      path.resolve(distDir, LANDING_BUILD_INFO_FILE),
      'utf8',
    ));
  } catch (error) {
    fail('LANDING_BUILD_INFO_READ_FAILED', error?.message || error);
  }
  validateBuildInfo(buildInfo, {
    expectedCwsIdentity,
    expectedLockfileSha256,
    expectedSourceIdentity,
    expectedSupportUrl,
  });

  const digest = createHash('sha256');
  let bytes = 0;
  for (const file of files) {
    bytes += file.bytes;
    digest.update(file.path, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(String(file.bytes), 'utf8');
    digest.update('\0', 'utf8');
    digest.update(file.sha256, 'utf8');
    digest.update('\n', 'utf8');
  }
  return Object.freeze({
    buildId: buildInfo.buildId,
    bytes,
    fileCount: files.length,
    files: Object.freeze(files),
    sha256: digest.digest('hex'),
  });
}

export function assertLandingBuildSnapshotUnchanged(expected, actual) {
  if (
    expected?.buildId !== actual?.buildId
    || expected?.bytes !== actual?.bytes
    || expected?.fileCount !== actual?.fileCount
    || expected?.sha256 !== actual?.sha256
  ) {
    fail(
      'LANDING_BUILD_CHANGED_AFTER_VALIDATION',
      `expected=${expected?.buildId}/${expected?.sha256}:actual=${actual?.buildId}/${actual?.sha256}`,
    );
  }
}
