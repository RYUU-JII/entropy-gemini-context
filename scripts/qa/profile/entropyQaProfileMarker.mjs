import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

const QA_PROFILE_MARKER_FILE = '.entropy-e2e-qa-profile.json';
const QA_PROFILE_MARKER_PURPOSE = 'entropy-site-e2e-qa-profile';
const QA_PROFILE_MARKER_SCHEMA_VERSION = 3;
const QA_PROFILE_LEGACY_MARKER_SCHEMA_VERSION = 1;
const QA_PROFILE_LOCK_FILES = Object.freeze([
  'SingletonCookie',
  'SingletonLock',
  'SingletonSocket',
]);

export const ENTROPY_QA_PROFILE_MARKER = Object.freeze({
  fileName: QA_PROFILE_MARKER_FILE,
  purpose: QA_PROFILE_MARKER_PURPOSE,
  schemaVersion: QA_PROFILE_MARKER_SCHEMA_VERSION,
});

function requireExplicitQaProfilePath(qaProfileDir) {
  if (typeof qaProfileDir !== 'string' || !qaProfileDir.trim()) {
    throw new Error('CHROMIUM_HARNESS_QA_PROFILE_PATH_REQUIRED');
  }
  if (!path.isAbsolute(qaProfileDir)) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_PATH_ABSOLUTE_REQUIRED:${qaProfileDir}`);
  }
  return path.normalize(qaProfileDir);
}

function requireExactObjectKeys(value, expectedKeys, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function requireEntropyQaProfileMarker(marker, markerPath, {
  allowProvisioning = false,
} = {}) {
  if (
    marker?.purpose !== QA_PROFILE_MARKER_PURPOSE
    || ![
      QA_PROFILE_LEGACY_MARKER_SCHEMA_VERSION,
      QA_PROFILE_MARKER_SCHEMA_VERSION,
    ].includes(marker?.schemaVersion)
  ) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`);
  }
  if (marker.schemaVersion === QA_PROFILE_LEGACY_MARKER_SCHEMA_VERSION) {
    requireExactObjectKeys(
      marker,
      ['purpose', 'schemaVersion'],
      `CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`,
    );
    return Object.freeze({
      ...marker,
      fixtureProvenance: Object.freeze({
        kind: 'natural_or_unprovisioned',
        synthetic: false,
      }),
    });
  }
  requireExactObjectKeys(
    marker,
    ['fixtures', 'purpose', 'schemaVersion'],
    `CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`,
  );
  requireExactObjectKeys(
    marker.fixtures,
    ['canonicalProgression'],
    `CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`,
  );
  const fixture = requireExactObjectKeys(
    marker.fixtures.canonicalProgression,
    ['activityDayKeys', 'qualifiedUseDayCount', 'status', 'synthetic'],
    `CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`,
  );
  if (
    fixture.qualifiedUseDayCount !== 5
    || fixture.synthetic !== true
    || !['provisioning', 'ready'].includes(fixture.status)
    || (!allowProvisioning && fixture.status !== 'ready')
    || !Array.isArray(fixture.activityDayKeys)
    || fixture.activityDayKeys.length !== 5
    || fixture.activityDayKeys.some((key, index) => (
      typeof key !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/u.test(key)
      || (index > 0 && key <= fixture.activityDayKeys[index - 1])
    ))
  ) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}`);
  }
  return Object.freeze({
    ...marker,
    fixtures: Object.freeze({
      canonicalProgression: Object.freeze({
        ...fixture,
        activityDayKeys: Object.freeze([...fixture.activityDayKeys]),
      }),
    }),
    fixtureProvenance: Object.freeze({
      kind: 'synthetic_canonical_progression',
      synthetic: true,
      qualifiedUseDayCount: fixture.qualifiedUseDayCount,
      status: fixture.status,
    }),
  });
}

export async function readEntropyQaProfileMarker(qaProfileDir, {
  allowProvisioning = false,
  allowLocked = false,
} = {}) {
  const resolvedPath = requireExplicitQaProfilePath(qaProfileDir);
  const stat = await fs.lstat(resolvedPath).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_DIRECTORY_INVALID:${resolvedPath}`);
  }
  const realPath = await fs.realpath(resolvedPath);
  const markerPath = path.join(realPath, QA_PROFILE_MARKER_FILE);
  const markerStat = await fs.lstat(markerPath).catch(() => null);
  if (!markerStat?.isFile() || markerStat.isSymbolicLink()) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_MARKER_REQUIRED:${markerPath}`);
  }
  let marker = null;
  try {
    marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `CHROMIUM_HARNESS_QA_PROFILE_MARKER_INVALID:${markerPath}:${error?.message || error}`,
    );
  }
  const normalizedMarker = requireEntropyQaProfileMarker(marker, markerPath, {
    allowProvisioning,
  });
  const lockFile = QA_PROFILE_LOCK_FILES.find((fileName) => (
    fsSync.existsSync(path.join(realPath, fileName))
  ));
  if (lockFile && allowLocked !== true) {
    throw new Error(`CHROMIUM_HARNESS_QA_PROFILE_LOCKED:${path.join(realPath, lockFile)}`);
  }
  return Object.freeze({
    path: realPath,
    markerPath,
    marker: normalizedMarker,
  });
}

export async function validateEntropyQaProfile(qaProfileDir, options = {}) {
  return (await readEntropyQaProfileMarker(qaProfileDir, options)).path;
}

export async function verifyEntropyQaDedicatedProfileOwnership({
  profileSlot,
} = {}) {
  if (
    !profileSlot
    || profileSlot.lifecyclePolicy !== 'managed'
    || profileSlot.profileOwnershipPolicy !== 'dedicated_adapter_proof_required'
  ) {
    throw new Error(
      `QA_DEDICATED_PROFILE_SLOT_REQUIRED:${profileSlot?.id || 'missing'}`,
    );
  }
  const markerReceipt = await readEntropyQaProfileMarker(
    profileSlot.userDataDir,
    {
      allowProvisioning: false,
      allowLocked: true,
    },
  );
  return Object.freeze({
    status: 'dedicated_profile_verified',
    profileSlotId: profileSlot.id,
    userDataDir: profileSlot.userDataDir,
    proofType: 'entropy_qa_profile_marker',
    proofVersion: markerReceipt.marker.schemaVersion,
  });
}
