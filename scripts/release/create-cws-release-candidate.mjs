#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertAllowedArtifactPath,
  collectArtifactEntries,
} from './cwsArtifactInventory.mjs';
import {
  assertCanonicalCwsReleaseTag,
  resolveCwsReleaseIdentity,
} from './cwsReleaseIdentity.mjs';
import {
  assertLandingBuildSnapshotUnchanged,
  collectLandingBuildSnapshot,
} from './landingBuildProvenance.mjs';
import { resolveLandingSupportUrl } from './landingSupportContact.mjs';
import {
  assertCanonicalManifestChromeCompatibility,
} from '../../src/platform/extension/chromeCompatibilityContract.js';

export {
  assertAllowedArtifactPath,
  collectArtifactEntries,
};

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');
const DEFAULT_DIST_DIR = path.resolve(rootDir, 'dist-prod');
const DEFAULT_LANDING_DIST_DIR = path.resolve(rootDir, 'dist-landing');
const DEFAULT_OUTPUT_DIR = path.resolve(rootDir, '.artifacts/cws');
const MANIFEST_FILE = 'manifest.json';
const BUILD_INFO_FILE = 'entropy-build-info.json';
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const ZIP_VERSION_20 = 20;
const ZIP_UNIX_VERSION_20 = (3 << 8) | ZIP_VERSION_20;
const ZIP_MAX_UINT16 = 0xffff;
const ZIP_MAX_UINT32 = 0xffffffff;

export function createSourceReleaseSteps({ evidenceRoot } = {}) {
  if (typeof evidenceRoot !== 'string' || !path.isAbsolute(evidenceRoot)) {
    fail('CWS_RC_EVIDENCE_ROOT_INVALID', evidenceRoot);
  }
  return Object.freeze([
    {
      id: 'clean-install',
      command: 'npm',
      args: ['ci'],
    },
    {
      id: 'production-dependency-audit',
      command: 'npm',
      args: ['audit', '--omit=dev', '--audit-level=moderate'],
    },
    {
      id: 'release-asset-provenance',
      command: 'npm',
      args: ['run', 'check:release:asset-provenance'],
    },
    {
      id: 'quality-gate',
      command: 'npm',
      args: ['run', 'gate:release'],
    },
    {
      id: 'landing-build',
      command: 'npm',
      args: ['run', 'build:landing'],
    },
    {
      id: 'cws-preflight',
      command: 'npm',
      args: ['run', 'cws:preflight', '--', '--no-build'],
    },
    {
      id: 'release-lifecycle-source',
      command: process.execPath,
      args: [
        'scripts/e2e/releaseLifecycleMatrix.mjs',
        '--source-only',
        `--report-dir=${path.join(evidenceRoot, 'source-lifecycle')}`,
      ],
    },
  ]);
}

export function createExactArchiveReleaseSteps({ extractedDir, evidenceRoot } = {}) {
  if (typeof extractedDir !== 'string' || !path.isAbsolute(extractedDir)) {
    fail('CWS_RC_EXTRACTED_DIR_INVALID', extractedDir);
  }
  if (typeof evidenceRoot !== 'string' || !path.isAbsolute(evidenceRoot)) {
    fail('CWS_RC_EVIDENCE_ROOT_INVALID', evidenceRoot);
  }
  return Object.freeze([
    {
      id: 'exact-archive-global-bundle-budget',
      command: process.execPath,
      args: [
        'scripts/ci/check-bundle-budget.mjs',
        extractedDir,
      ],
    },
    {
      id: 'exact-archive-static-preflight',
      command: process.execPath,
      args: [
        'scripts/ci/run-cws-preflight.mjs',
        '--no-build',
        `--dist=${extractedDir}`,
      ],
    },
    {
      id: 'exact-archive-raw-chromium-smoke',
      command: process.execPath,
      args: [
        'scripts/e2e/cwsRawArtifactSmoke.mjs',
        `--dist=${extractedDir}`,
        `--report-dir=${path.join(evidenceRoot, 'raw-artifact-smoke')}`,
        '--headless',
      ],
    },
    {
      id: 'instrumented-archive-runtime-budget',
      command: process.execPath,
      args: [
        'scripts/perf/measureCwsRuntime.mjs',
        '--no-build',
        '--fail-on-warn',
        '--lifecycle',
        `--dist=${extractedDir}`,
        `--report-dir=${path.join(evidenceRoot, 'instrumented-runtime')}`,
      ],
    },
    {
      id: 'instrumented-archive-release-lifecycle',
      command: process.execPath,
      args: [
        'scripts/e2e/releaseLifecycleMatrix.mjs',
        '--browser-only',
        `--dist=${extractedDir}`,
        `--report-dir=${path.join(evidenceRoot, 'browser-lifecycle')}`,
      ],
    },
  ]);
}

function fail(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(filePath) {
  return sha256Buffer(await fs.readFile(filePath));
}

function runGit(args, { cwd = rootDir } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    fail('CWS_RC_GIT_COMMAND_FAILED', `${args.join(' ')}:${String(result.stderr || '').trim()}`);
  }
  return String(result.stdout || '').trim();
}

export function assertCleanWorktree(statusOutput) {
  const normalized = String(statusOutput || '').trim();
  if (normalized) {
    const firstEntries = normalized.split(/\r?\n/u).slice(0, 8).join(' | ');
    fail('CWS_RC_DIRTY_WORKTREE', firstEntries);
  }
}

function readSourceIdentity() {
  const status = runGit(['status', '--porcelain=v1', '--untracked-files=all']);
  assertCleanWorktree(status);
  const gitTags = runGit(['tag', '--points-at', 'HEAD'])
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort(compareArchivePaths);
  return Object.freeze({
    gitCommitSha: runGit(['rev-parse', 'HEAD']),
    gitTreeSha: runGit(['rev-parse', 'HEAD^{tree}']),
    gitTags: Object.freeze(gitTags),
  });
}

function assertSourceIdentityUnchanged(expected) {
  const actual = readSourceIdentity();
  if (
    actual.gitCommitSha !== expected.gitCommitSha
    || actual.gitTreeSha !== expected.gitTreeSha
    || actual.gitTags.length !== expected.gitTags.length
    || actual.gitTags.some((tag, index) => tag !== expected.gitTags[index])
  ) {
    fail(
      'CWS_RC_SOURCE_IDENTITY_CHANGED',
      `expected=${expected.gitCommitSha}/${expected.gitTreeSha}/${expected.gitTags.join(',')},actual=${actual.gitCommitSha}/${actual.gitTreeSha}/${actual.gitTags.join(',')}`,
    );
  }
  return actual;
}

function runRequiredStep(step, { cwd = rootDir } = {}) {
  const startedAt = Date.now();
  console.log(`[cws-release-candidate] START ${step.id}`);
  const command = process.platform === 'win32' && step.command === 'npm'
    ? 'npm.cmd'
    : step.command;
  const result = spawnSync(command, step.args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - startedAt;
  if (result.status !== 0) {
    fail(
      'CWS_RC_REQUIRED_STEP_FAILED',
      `${step.id}:exit=${Number.isInteger(result.status) ? result.status : 1}:signal=${result.signal || 'none'}`,
    );
  }
  console.log(`[cws-release-candidate] PASS ${step.id} durationMs=${durationMs}`);
  return Object.freeze({ id: step.id, durationMs, status: 'passed' });
}

async function readJson(filePath, code) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    fail(code, `${filePath}:${error?.message || error}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(code, `${filePath}:${error?.message || error}`);
  }
}

function assertLowercaseHex(value, length, code) {
  const pattern = new RegExp(`^[0-9a-f]{${length}}$`, 'u');
  if (typeof value !== 'string' || !pattern.test(value)) {
    fail(code, String(value));
  }
}

export function validateReleaseProvenance({
  buildInfo,
  builtManifest,
  sourceManifest,
  sourceIdentity,
  lockfileSha256,
} = {}) {
  if (!buildInfo || typeof buildInfo !== 'object' || Array.isArray(buildInfo)) {
    fail('CWS_RC_BUILD_INFO_INVALID');
  }
  if (!builtManifest || typeof builtManifest !== 'object' || Array.isArray(builtManifest)) {
    fail('CWS_RC_BUILT_MANIFEST_INVALID');
  }
  if (!sourceManifest || typeof sourceManifest !== 'object' || Array.isArray(sourceManifest)) {
    fail('CWS_RC_SOURCE_MANIFEST_INVALID');
  }
  assertLowercaseHex(sourceIdentity?.gitCommitSha, 40, 'CWS_RC_SOURCE_COMMIT_INVALID');
  assertLowercaseHex(sourceIdentity?.gitTreeSha, 40, 'CWS_RC_SOURCE_TREE_INVALID');
  assertLowercaseHex(lockfileSha256, 64, 'CWS_RC_LOCKFILE_HASH_INVALID');

  if (buildInfo.schemaVersion !== 1) fail('CWS_RC_BUILD_INFO_SCHEMA_INVALID', buildInfo.schemaVersion);
  if (buildInfo.command !== 'build') fail('CWS_RC_BUILD_COMMAND_INVALID', buildInfo.command);
  if (buildInfo.releaseProfile !== 'public') {
    fail('CWS_RC_RELEASE_PROFILE_INVALID', buildInfo.releaseProfile);
  }
  if (buildInfo.extensionTarget !== 'chrome') {
    fail('CWS_RC_EXTENSION_TARGET_INVALID', buildInfo.extensionTarget);
  }
  if (buildInfo.dirty !== false) fail('CWS_RC_BUILD_IS_DIRTY', buildInfo.buildId);
  if (buildInfo.gitCommitSha !== sourceIdentity.gitCommitSha) {
    fail('CWS_RC_BUILD_COMMIT_MISMATCH', `${buildInfo.gitCommitSha}:${sourceIdentity.gitCommitSha}`);
  }
  if (buildInfo.gitTreeSha !== sourceIdentity.gitTreeSha) {
    fail('CWS_RC_BUILD_TREE_MISMATCH', `${buildInfo.gitTreeSha}:${sourceIdentity.gitTreeSha}`);
  }
  if (buildInfo.lockfileSha256 !== lockfileSha256) {
    fail('CWS_RC_BUILD_LOCKFILE_MISMATCH', `${buildInfo.lockfileSha256}:${lockfileSha256}`);
  }
  const createdAt = new Date(buildInfo.createdAt);
  if (
    typeof buildInfo.createdAt !== 'string'
    || Number.isNaN(createdAt.getTime())
    || createdAt.toISOString() !== buildInfo.createdAt
  ) {
    fail('CWS_RC_BUILD_TIMESTAMP_INVALID', buildInfo.createdAt);
  }
  const buildTimestamp = buildInfo.createdAt.replace(/[-:.TZ]/gu, '').slice(0, 14);
  if (typeof buildInfo.buildId !== 'string' || !buildInfo.buildId.includes('-clean')) {
    fail('CWS_RC_BUILD_ID_NOT_CLEAN', buildInfo.buildId);
  }
  if (!buildInfo.buildId.startsWith(`${buildTimestamp}-${sourceIdentity.gitCommitSha.slice(0, 12)}-`)) {
    fail('CWS_RC_BUILD_IDENTITY_INVALID', buildInfo.buildId);
  }
  if (
    typeof builtManifest.version !== 'string'
    || builtManifest.version !== sourceManifest.version
  ) {
    fail(
      'CWS_RC_MANIFEST_VERSION_MISMATCH',
      `source=${sourceManifest.version},built=${builtManifest.version}`,
    );
  }
  if (builtManifest.manifest_version !== 3) {
    fail('CWS_RC_MANIFEST_VERSION_FORMAT_INVALID', builtManifest.manifest_version);
  }
  try {
    assertCanonicalManifestChromeCompatibility(sourceManifest, { source: 'src/manifest.json' });
    assertCanonicalManifestChromeCompatibility(builtManifest, { source: 'release-artifact/manifest.json' });
  } catch (error) {
    fail('CWS_RC_CHROME_COMPATIBILITY_INVALID', error?.message || String(error));
  }
  if (builtManifest.minimum_chrome_version !== sourceManifest.minimum_chrome_version) {
    fail(
      'CWS_RC_MINIMUM_CHROME_VERSION_MISMATCH',
      `source=${sourceManifest.minimum_chrome_version},built=${builtManifest.minimum_chrome_version}`,
    );
  }
  return Object.freeze({
    buildId: buildInfo.buildId,
    extensionVersion: builtManifest.version,
    minimumChromeVersion: builtManifest.minimum_chrome_version,
  });
}

function normalizeArchivePath(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\.\//u, '');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
    fail('CWS_RC_ARCHIVE_PATH_INVALID', normalized);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    fail('CWS_RC_ARCHIVE_PATH_INVALID', normalized);
  }
  return normalized;
}

export function compareArchivePaths(left, right) {
  return Buffer.compare(Buffer.from(String(left), 'utf8'), Buffer.from(String(right), 'utf8'));
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('CWS_RC_ZIP_TIMESTAMP_INVALID', String(value));
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = Math.floor(date.getUTCSeconds() / 2);
  return Object.freeze({
    time: (hour << 11) | (minute << 5) | second,
    date: ((year - 1980) << 9) | (month << 5) | day,
  });
}

function assertZipUint32(value, code) {
  if (!Number.isSafeInteger(value) || value < 0 || value > ZIP_MAX_UINT32) {
    fail(code, value);
  }
}

export function createDeterministicStoredZip(entries, timestamp) {
  if (!Array.isArray(entries) || entries.length === 0) fail('CWS_RC_ZIP_ENTRIES_INVALID');
  if (entries.length > ZIP_MAX_UINT16) fail('CWS_RC_ZIP_ENTRY_COUNT_INVALID', entries.length);
  const normalizedEntries = entries.map((entry) => ({
    archivePath: normalizeArchivePath(entry.archivePath),
    data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data),
  })).sort((left, right) => compareArchivePaths(left.archivePath, right.archivePath));
  const seenPaths = new Set();
  const localParts = [];
  const centralParts = [];
  const dos = toDosDateTime(timestamp);
  let localOffset = 0;

  for (const entry of normalizedEntries) {
    if (seenPaths.has(entry.archivePath)) fail('CWS_RC_ZIP_DUPLICATE_PATH', entry.archivePath);
    seenPaths.add(entry.archivePath);
    const name = Buffer.from(entry.archivePath, 'utf8');
    if (name.length > ZIP_MAX_UINT16) fail('CWS_RC_ZIP_PATH_TOO_LONG', entry.archivePath);
    assertZipUint32(entry.data.length, 'CWS_RC_ZIP_ENTRY_TOO_LARGE');
    const checksum = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
    localHeader.writeUInt16LE(ZIP_VERSION_20, 4);
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8);
    localHeader.writeUInt16LE(dos.time, 10);
    localHeader.writeUInt16LE(dos.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(ZIP_CENTRAL_FILE_HEADER, 0);
    centralHeader.writeUInt16LE(ZIP_UNIX_VERSION_20, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION_20, 6);
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10);
    centralHeader.writeUInt16LE(dos.time, 12);
    centralHeader.writeUInt16LE(dos.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + entry.data.length;
    assertZipUint32(localOffset, 'CWS_RC_ZIP_LOCAL_DIRECTORY_TOO_LARGE');
  }

  const centralDirectory = Buffer.concat(centralParts);
  assertZipUint32(centralDirectory.length, 'CWS_RC_ZIP_CENTRAL_DIRECTORY_TOO_LARGE');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(normalizedEntries.length, 8);
  end.writeUInt16LE(normalizedEntries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function assertEntrySetsEqual(expected, actual) {
  if (expected.length !== actual.length) {
    fail('CWS_RC_EXTRACTED_FILE_COUNT_MISMATCH', `expected=${expected.length},actual=${actual.length}`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const left = expected[index];
    const right = actual[index];
    if (
      left.archivePath !== right.archivePath
      || left.size !== right.size
      || left.sha256 !== right.sha256
    ) {
      fail(
        'CWS_RC_EXTRACTED_FILE_MISMATCH',
        `expected=${left.archivePath}:${left.size}:${left.sha256},actual=${right.archivePath}:${right.size}:${right.sha256}`,
      );
    }
  }
}

function assertZipRange(buffer, offset, length, code) {
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(length)
    || offset < 0
    || length < 0
    || offset + length > buffer.length
  ) {
    fail(code, `offset=${offset},length=${length},buffer=${buffer.length}`);
  }
}

function decodeZipPath(buffer) {
  const value = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  if (!Buffer.from(value, 'utf8').equals(buffer)) {
    fail('CWS_RC_ZIP_PATH_UTF8_INVALID');
  }
  return normalizeArchivePath(value);
}

export function parseDeterministicStoredZip(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  if (buffer.length < 22) fail('CWS_RC_ZIP_TRUNCATED');
  const endOffset = buffer.length - 22;
  if (buffer.readUInt32LE(endOffset) !== ZIP_END_OF_CENTRAL_DIRECTORY) {
    fail('CWS_RC_ZIP_END_RECORD_INVALID');
  }
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const diskEntryCount = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  const commentLength = buffer.readUInt16LE(endOffset + 20);
  if (
    diskNumber !== 0
    || centralDisk !== 0
    || diskEntryCount !== entryCount
    || commentLength !== 0
    || centralOffset + centralSize !== endOffset
  ) {
    fail('CWS_RC_ZIP_END_RECORD_UNSUPPORTED');
  }

  const entries = [];
  const localRanges = [];
  let centralCursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assertZipRange(buffer, centralCursor, 46, 'CWS_RC_ZIP_CENTRAL_HEADER_TRUNCATED');
    if (buffer.readUInt32LE(centralCursor) !== ZIP_CENTRAL_FILE_HEADER) {
      fail('CWS_RC_ZIP_CENTRAL_HEADER_INVALID', index);
    }
    const flags = buffer.readUInt16LE(centralCursor + 8);
    const method = buffer.readUInt16LE(centralCursor + 10);
    const checksum = buffer.readUInt32LE(centralCursor + 16);
    const compressedSize = buffer.readUInt32LE(centralCursor + 20);
    const size = buffer.readUInt32LE(centralCursor + 24);
    const nameLength = buffer.readUInt16LE(centralCursor + 28);
    const extraLength = buffer.readUInt16LE(centralCursor + 30);
    const fileCommentLength = buffer.readUInt16LE(centralCursor + 32);
    const startDisk = buffer.readUInt16LE(centralCursor + 34);
    const externalAttributes = buffer.readUInt32LE(centralCursor + 38);
    const localOffset = buffer.readUInt32LE(centralCursor + 42);
    const centralRecordLength = 46 + nameLength + extraLength + fileCommentLength;
    assertZipRange(
      buffer,
      centralCursor,
      centralRecordLength,
      'CWS_RC_ZIP_CENTRAL_RECORD_TRUNCATED',
    );
    if (
      flags !== ZIP_UTF8_FLAG
      || method !== ZIP_STORE_METHOD
      || compressedSize !== size
      || extraLength !== 0
      || fileCommentLength !== 0
      || startDisk !== 0
      || externalAttributes !== ((0o100644 << 16) >>> 0)
    ) {
      fail('CWS_RC_ZIP_CENTRAL_RECORD_UNSUPPORTED', index);
    }
    const centralName = buffer.subarray(centralCursor + 46, centralCursor + 46 + nameLength);
    const archivePath = decodeZipPath(centralName);

    assertZipRange(buffer, localOffset, 30, 'CWS_RC_ZIP_LOCAL_HEADER_TRUNCATED');
    if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_HEADER) {
      fail('CWS_RC_ZIP_LOCAL_HEADER_INVALID', archivePath);
    }
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localChecksum = buffer.readUInt32LE(localOffset + 14);
    const localCompressedSize = buffer.readUInt32LE(localOffset + 18);
    const localSize = buffer.readUInt32LE(localOffset + 22);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localRecordLength = 30 + localNameLength + localExtraLength + localSize;
    assertZipRange(buffer, localOffset, localRecordLength, 'CWS_RC_ZIP_LOCAL_RECORD_TRUNCATED');
    const localName = buffer.subarray(localOffset + 30, localOffset + 30 + localNameLength);
    if (
      localFlags !== flags
      || localMethod !== method
      || localChecksum !== checksum
      || localCompressedSize !== compressedSize
      || localSize !== size
      || localExtraLength !== 0
      || !localName.equals(centralName)
      || buffer.readUInt16LE(localOffset + 10) !== buffer.readUInt16LE(centralCursor + 12)
      || buffer.readUInt16LE(localOffset + 12) !== buffer.readUInt16LE(centralCursor + 14)
    ) {
      fail('CWS_RC_ZIP_LOCAL_CENTRAL_MISMATCH', archivePath);
    }
    const dataOffset = localOffset + 30 + localNameLength;
    const data = buffer.subarray(dataOffset, dataOffset + size);
    if (crc32(data) !== checksum) fail('CWS_RC_ZIP_CRC_MISMATCH', archivePath);
    entries.push(Object.freeze({
      archivePath,
      data: Buffer.from(data),
      sha256: sha256Buffer(data),
      size,
    }));
    localRanges.push({ start: localOffset, end: localOffset + localRecordLength });
    centralCursor += centralRecordLength;
  }
  if (centralCursor !== endOffset) fail('CWS_RC_ZIP_CENTRAL_SIZE_MISMATCH');
  localRanges.sort((left, right) => left.start - right.start);
  let expectedOffset = 0;
  for (const range of localRanges) {
    if (range.start !== expectedOffset) fail('CWS_RC_ZIP_LOCAL_LAYOUT_NONCONTIGUOUS');
    expectedOffset = range.end;
  }
  if (expectedOffset !== centralOffset) fail('CWS_RC_ZIP_LOCAL_SIZE_MISMATCH');

  for (let index = 1; index < entries.length; index += 1) {
    if (compareArchivePaths(entries[index - 1].archivePath, entries[index].archivePath) >= 0) {
      fail('CWS_RC_ZIP_ENTRY_ORDER_INVALID', entries[index].archivePath);
    }
  }
  return entries;
}

async function extractAndVerifyArchive({ archiveBuffer, expectedEntries, tempRoot }) {
  const extractedDir = path.resolve(tempRoot, 'extracted');
  await fs.mkdir(extractedDir, { recursive: true });
  const parsedEntries = parseDeterministicStoredZip(archiveBuffer);
  assertEntrySetsEqual(expectedEntries, parsedEntries);
  for (const entry of parsedEntries) {
    const outputPath = path.resolve(extractedDir, ...entry.archivePath.split('/'));
    if (!outputPath.startsWith(`${extractedDir}${path.sep}`)) {
      fail('CWS_RC_ARCHIVE_EXTRACTION_PATH_ESCAPE', entry.archivePath);
    }
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, entry.data, { flag: 'wx', mode: 0o644 });
  }
  const actualEntries = await collectArtifactEntries(extractedDir);
  assertEntrySetsEqual(expectedEntries, actualEntries);
  return extractedDir;
}

function readArtifactJson(entries, archivePath, code) {
  const matches = entries.filter((entry) => entry.archivePath === archivePath);
  if (matches.length !== 1) fail(code, `${archivePath}:matches=${matches.length}`);
  try {
    return JSON.parse(matches[0].data.toString('utf8'));
  } catch (error) {
    fail(code, `${archivePath}:${error?.message || error}`);
  }
}

async function readValidatedReleaseInputs(sourceIdentity, entries) {
  const [sourceManifest, lockfileSha256] = await Promise.all([
    readJson(path.resolve(rootDir, 'src/manifest.json'), 'CWS_RC_SOURCE_MANIFEST_READ_FAILED'),
    sha256File(path.resolve(rootDir, 'package-lock.json')),
  ]);
  const buildInfo = readArtifactJson(entries, BUILD_INFO_FILE, 'CWS_RC_BUILD_INFO_READ_FAILED');
  const builtManifest = readArtifactJson(entries, MANIFEST_FILE, 'CWS_RC_BUILT_MANIFEST_READ_FAILED');
  const release = validateReleaseProvenance({
    buildInfo,
    builtManifest,
    sourceManifest,
    sourceIdentity,
    lockfileSha256,
  });
  return Object.freeze({ buildInfo, builtManifest, lockfileSha256, release });
}

function createArtifactBaseName(extensionVersion, gitCommitSha, buildId) {
  const safeVersion = String(extensionVersion || '').replace(/[^0-9A-Za-z._-]/gu, '-');
  if (!safeVersion) fail('CWS_RC_EXTENSION_VERSION_INVALID', extensionVersion);
  const safeBuildId = String(buildId || '').replace(/[^0-9A-Za-z._-]/gu, '-');
  if (!safeBuildId) fail('CWS_RC_BUILD_ID_INVALID', buildId);
  return `entropy-${safeVersion}-${gitCommitSha.slice(0, 12)}-${safeBuildId}`;
}

async function assertOutputPathsAvailable(...outputPaths) {
  for (const outputPath of outputPaths) {
    try {
      await fs.access(outputPath);
      fail('CWS_RC_OUTPUT_ALREADY_EXISTS', outputPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function listJsonFiles(currentDir, root, files = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  entries.sort((left, right) => compareArchivePaths(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path.resolve(currentDir, entry.name);
    if (entry.isDirectory()) {
      await listJsonFiles(absolutePath, root, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push({
        absolutePath,
        relativePath: path.relative(root, absolutePath).split(path.sep).join('/'),
      });
    }
  }
  return files;
}

function summarizeEvidenceReport(report) {
  const budgetChecks = Array.isArray(report?.budgetChecks) ? report.budgetChecks : [];
  const budgetPassed = budgetChecks.length > 0
    ? budgetChecks.every((check) => check?.status === 'pass')
    : null;
  const passed = typeof report?.passed === 'boolean'
    ? report.passed
    : typeof report?.pass === 'boolean'
      ? report.pass
      : budgetPassed;
  const browserProduct = report?.chrome?.product
    || report?.browser?.product
    || (typeof report?.browser === 'string' ? report.browser : null)
    || null;
  return Object.freeze({
    schemaVersion: Number.isInteger(report?.schemaVersion) ? report.schemaVersion : null,
    generatedAt: typeof report?.generatedAt === 'string' ? report.generatedAt : null,
    passed,
    browserProduct,
    budgetChecks: budgetChecks.map((check) => ({
      name: check?.name || null,
      status: check?.status || null,
      actual: check?.actual ?? null,
      limit: check?.limit ?? null,
    })),
  });
}

async function collectReleaseEvidence(evidenceRoot) {
  const files = await listJsonFiles(evidenceRoot, evidenceRoot);
  const evidence = [];
  for (const file of files) {
    const raw = await fs.readFile(file.absolutePath);
    let report;
    try {
      report = JSON.parse(raw.toString('utf8'));
    } catch (error) {
      fail('CWS_RC_EVIDENCE_JSON_INVALID', `${file.relativePath}:${error?.message || error}`);
    }
    evidence.push(Object.freeze({
      path: file.relativePath,
      sha256: sha256Buffer(raw),
      bytes: raw.length,
      ...summarizeEvidenceReport(report),
    }));
  }
  evidence.sort((left, right) => compareArchivePaths(left.path, right.path));
  const failed = evidence.filter((entry) => entry.passed === false);
  if (failed.length > 0) {
    fail('CWS_RC_EVIDENCE_REPORT_FAILED', failed.map((entry) => entry.path).join(','));
  }
  const runtimeEvidence = evidence.find((entry) => entry.path.includes('cws-runtime-'));
  if (
    !runtimeEvidence
    || runtimeEvidence.passed !== true
    || !runtimeEvidence.browserProduct
    || runtimeEvidence.budgetChecks.length === 0
  ) {
    fail('CWS_RC_RUNTIME_EVIDENCE_INCOMPLETE');
  }
  const rawArtifactEvidence = evidence.find((entry) => (
    entry.path.includes('cws-raw-artifact-smoke-')
  ));
  if (
    !rawArtifactEvidence
    || rawArtifactEvidence.passed !== true
    || !rawArtifactEvidence.browserProduct
  ) {
    fail('CWS_RC_RAW_ARTIFACT_EVIDENCE_INCOMPLETE');
  }
  for (const lifecycleRoot of ['source-lifecycle/', 'browser-lifecycle/']) {
    const lifecycleEvidence = evidence.find((entry) => (
      entry.path.startsWith(lifecycleRoot)
      && entry.path.includes('release-lifecycle-matrix-')
    ));
    if (!lifecycleEvidence || lifecycleEvidence.passed !== true) {
      fail('CWS_RC_LIFECYCLE_EVIDENCE_INCOMPLETE', lifecycleRoot);
    }
  }
  return evidence;
}

export async function publishReleaseCandidate({
  tempArchivePath,
  finalArchivePath,
  finalAttestationPath,
  attestation,
} = {}) {
  let createdFinalArchive = false;
  try {
    await fs.copyFile(tempArchivePath, finalArchivePath, fsConstants.COPYFILE_EXCL);
    createdFinalArchive = true;
    await fs.writeFile(
      finalAttestationPath,
      `${JSON.stringify(attestation, null, 2)}\n`,
      { flag: 'wx' },
    );
  } catch (error) {
    if (createdFinalArchive) await fs.rm(finalArchivePath, { force: true });
    throw error;
  }
}

async function createReleaseCandidate() {
  const sourceIdentity = readSourceIdentity();
  const sourceManifest = await readJson(
    path.resolve(rootDir, 'src/manifest.json'),
    'CWS_RC_SOURCE_MANIFEST_READ_FAILED',
  );
  const cwsReleaseIdentity = resolveCwsReleaseIdentity({
    currentVersion: sourceManifest.version,
    environment: process.env,
  });
  const cwsReleaseTag = assertCanonicalCwsReleaseTag(
    sourceIdentity.gitTags,
    cwsReleaseIdentity.currentVersion,
  );
  const landingSupportUrl = resolveLandingSupportUrl({
    command: 'build',
    environment: process.env,
  });
  const gates = [];
  const evidenceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-cws-rc-evidence-'));
  let tempRoot = null;
  try {
    for (const step of createSourceReleaseSteps({ evidenceRoot })) {
      gates.push(runRequiredStep(step));
      assertSourceIdentityUnchanged(sourceIdentity);
    }

    const entries = await collectArtifactEntries(DEFAULT_DIST_DIR);
    const validated = await readValidatedReleaseInputs(sourceIdentity, entries);
    const landingSnapshot = await collectLandingBuildSnapshot({
      distDir: DEFAULT_LANDING_DIST_DIR,
      expectedCwsIdentity: cwsReleaseIdentity,
      expectedLockfileSha256: validated.lockfileSha256,
      expectedSourceIdentity: sourceIdentity,
      expectedSupportUrl: landingSupportUrl,
    });
    const archiveBuffer = createDeterministicStoredZip(entries, validated.buildInfo.createdAt);
    const artifactBaseName = createArtifactBaseName(
      validated.release.extensionVersion,
      sourceIdentity.gitCommitSha,
      validated.buildInfo.buildId,
    );
    await fs.mkdir(DEFAULT_OUTPUT_DIR, { recursive: true });
    const finalArchivePath = path.resolve(DEFAULT_OUTPUT_DIR, `${artifactBaseName}.zip`);
    const finalAttestationPath = path.resolve(DEFAULT_OUTPUT_DIR, `${artifactBaseName}.attestation.json`);
    await assertOutputPathsAvailable(finalArchivePath, finalAttestationPath);

    tempRoot = await fs.mkdtemp(path.resolve(DEFAULT_OUTPUT_DIR, '.candidate-'));
    const tempArchivePath = path.resolve(tempRoot, `${artifactBaseName}.zip`);
    await fs.writeFile(tempArchivePath, archiveBuffer, { flag: 'wx' });
    const extractedDir = await extractAndVerifyArchive({
      archiveBuffer,
      expectedEntries: entries,
      tempRoot,
    });

    const artifactSteps = createExactArchiveReleaseSteps({
      extractedDir,
      evidenceRoot,
    });
    for (const step of artifactSteps) {
      gates.push(runRequiredStep(step));
      assertSourceIdentityUnchanged(sourceIdentity);
    }

    const [currentDistEntries, currentExtractedEntries, currentLandingSnapshot] = await Promise.all([
      collectArtifactEntries(DEFAULT_DIST_DIR),
      collectArtifactEntries(extractedDir),
      collectLandingBuildSnapshot({
        distDir: DEFAULT_LANDING_DIST_DIR,
        expectedCwsIdentity: cwsReleaseIdentity,
        expectedLockfileSha256: validated.lockfileSha256,
        expectedSourceIdentity: sourceIdentity,
        expectedSupportUrl: landingSupportUrl,
      }),
    ]);
    assertEntrySetsEqual(entries, currentDistEntries);
    assertEntrySetsEqual(entries, currentExtractedEntries);
    assertLandingBuildSnapshotUnchanged(landingSnapshot, currentLandingSnapshot);
    assertSourceIdentityUnchanged(sourceIdentity);
    const evidence = await collectReleaseEvidence(evidenceRoot);

    gates.push(Object.freeze({
      id: 'immutable-artifact-rehash',
      durationMs: 0,
      status: 'passed',
    }));
    assertSourceIdentityUnchanged(sourceIdentity);

    const artifactSha256 = sha256Buffer(archiveBuffer);
    const attestation = {
      schemaVersion: 2,
      kind: 'entropy-cws-release-candidate',
      artifact: {
        fileName: path.basename(finalArchivePath),
        sha256: artifactSha256,
        bytes: archiveBuffer.length,
        fileCount: entries.length,
      },
      extension: {
        chromeWebStoreExtensionId: cwsReleaseIdentity.extensionId,
        version: validated.release.extensionVersion,
        minimumChromeVersion: validated.release.minimumChromeVersion,
      },
      chromeWebStore: {
        releaseMode: cwsReleaseIdentity.releaseMode,
        previousVersion: cwsReleaseIdentity.previousVersion,
        storeUrl: cwsReleaseIdentity.storeUrl,
      },
      landing: {
        buildId: landingSnapshot.buildId,
        sha256: landingSnapshot.sha256,
        bytes: landingSnapshot.bytes,
        fileCount: landingSnapshot.fileCount,
        deploymentStatus: 'not-performed-by-release-rc',
        files: landingSnapshot.files,
      },
      source: {
        gitCommitSha: sourceIdentity.gitCommitSha,
        gitTreeSha: sourceIdentity.gitTreeSha,
        gitTag: cwsReleaseTag,
        lockfileSha256: validated.lockfileSha256,
      },
      build: {
        buildId: validated.buildInfo.buildId,
        createdAt: validated.buildInfo.createdAt,
        releaseProfile: validated.buildInfo.releaseProfile,
        extensionTarget: validated.buildInfo.extensionTarget,
      },
      gates,
      evidence,
      files: entries.map((entry) => ({
        path: entry.archivePath,
        sha256: entry.sha256,
        bytes: entry.size,
      })),
    };

    await publishReleaseCandidate({
      tempArchivePath,
      finalArchivePath,
      finalAttestationPath,
      attestation,
    });

    console.log(`[cws-release-candidate] PASS artifact=${path.relative(rootDir, finalArchivePath)}`);
    console.log(`[cws-release-candidate] PASS sha256=${artifactSha256}`);
    console.log(`[cws-release-candidate] PASS attestation=${path.relative(rootDir, finalAttestationPath)}`);
  } finally {
    if (tempRoot) await fs.rm(tempRoot, { recursive: true, force: true });
    await fs.rm(evidenceRoot, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] || '') === scriptPath) {
  createReleaseCandidate().catch((error) => {
    console.error(`[cws-release-candidate] FAIL ${error?.message || error}`);
    process.exitCode = 1;
  });
}
