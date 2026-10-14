import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  normalizeChromiumHarnessTemporaryManifest,
  promoteManifestForChromiumHarness,
} from './chromiumHarnessManifestPromotion.mjs';
import {
  normalizeBrowserQaComparablePath,
} from '../browser-qa/browser/attachedBrowserIdentity.mjs';
import {
  validateEntropyQaProfile,
} from '../qa/profile/entropyQaProfileMarker.mjs';
import {
  publishEntropyQaArtifactSlotTransaction,
} from './internal/entropyQaArtifactSlotTransaction.mjs';

export const ENTROPY_QA_TRUSTED_PAGE_PATH = 'entropy-e2e.html';
const TRUSTED_PAGE_SOURCE = '<!doctype html><meta charset="utf-8"><title>Entropy MV3 E2E</title>';
export const ENTROPY_QA_ARTIFACT_RECEIPT_FILE = '.entropy-qa-artifact-receipt.json';
const ENTROPY_QA_ARTIFACT_ACTIVATION_RECEIPT_SUFFIX = '.entropy-runtime-activation.json';
const ENTROPY_QA_ARTIFACT_RECEIPT_KIND = 'entropy_qa_artifact_content';
const ENTROPY_QA_ARTIFACT_ACTIVATION_KIND = 'entropy_qa_artifact_runtime_activation';
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireCanonicalString(value, errorCode, { pattern = null } = {}) {
  if (
    typeof value !== 'string'
    || !value
    || value !== value.trim()
    || (pattern && !pattern.test(value))
  ) {
    throw new Error(errorCode);
  }
  return value;
}

export function normalizeEntropyQaArtifactIdentity(artifactIdentity) {
  if (!artifactIdentity || typeof artifactIdentity !== 'object' || Array.isArray(artifactIdentity)) {
    throw new Error('ENTROPY_QA_ARTIFACT_IDENTITY_REQUIRED');
  }
  const unknownKeys = Object.keys(artifactIdentity).filter((key) => ![
    'artifactId',
    'inputDigest',
    'buildId',
    'releaseProfile',
  ].includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`ENTROPY_QA_ARTIFACT_IDENTITY_UNKNOWN:${unknownKeys.sort().join(',')}`);
  }
  return Object.freeze({
    artifactId: requireCanonicalString(
      artifactIdentity.artifactId,
      'ENTROPY_QA_ARTIFACT_ID_INVALID',
      { pattern: /^[a-z][a-z0-9_]*$/u },
    ),
    inputDigest: requireCanonicalString(
      artifactIdentity.inputDigest,
      'ENTROPY_QA_ARTIFACT_INPUT_DIGEST_INVALID',
      { pattern: SHA256_PATTERN },
    ),
    buildId: requireCanonicalString(
      artifactIdentity.buildId,
      'ENTROPY_QA_ARTIFACT_BUILD_ID_INVALID',
    ),
    releaseProfile: requireCanonicalString(
      artifactIdentity.releaseProfile,
      'ENTROPY_QA_ARTIFACT_RELEASE_PROFILE_INVALID',
      { pattern: /^[a-z][a-z0-9_-]*$/u },
    ),
  });
}

export function defineEntropyQaArtifactContentIdentity({
  artifactIdentity,
  temporaryManifest = null,
} = {}) {
  const normalizedArtifact = normalizeEntropyQaArtifactIdentity(artifactIdentity);
  const normalizedTemporaryManifest = normalizeChromiumHarnessTemporaryManifest(
    temporaryManifest,
  );
  const contract = Object.freeze({
    contractVersion: 1,
    artifact: normalizedArtifact,
    temporaryManifest: normalizedTemporaryManifest,
    trustedPage: Object.freeze({
      path: ENTROPY_QA_TRUSTED_PAGE_PATH,
      sourceSha256: sha256(TRUSTED_PAGE_SOURCE),
    }),
  });
  return Object.freeze({
    ...contract,
    digest: sha256(JSON.stringify(contract)),
  });
}

function resolveEntropyQaArtifactActivationReceiptPath(slotDir) {
  return `${slotDir}${ENTROPY_QA_ARTIFACT_ACTIVATION_RECEIPT_SUFFIX}`;
}

async function readJsonFileStrict(filePath, errorCode) {
  const stat = await fs.lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(errorCode);
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(errorCode, { cause: error });
  }
}

function hasExactObjectKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

async function fingerprintArtifactTree(rootDir, {
  excludedNames = new Set([ENTROPY_QA_ARTIFACT_RECEIPT_FILE]),
} = {}) {
  const files = [];
  async function visit(directory, relativeDirectory = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (!relativeDirectory && excludedNames.has(entry.name)) continue;
      const relativePath = relativeDirectory
        ? path.join(relativeDirectory, entry.name)
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      const stat = await fs.lstat(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`ENTROPY_QA_ARTIFACT_TREE_SYMLINK_FORBIDDEN:${relativePath}`);
      }
      if (stat.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (stat.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`ENTROPY_QA_ARTIFACT_TREE_ENTRY_INVALID:${relativePath}`);
      }
    }
  }
  await visit(rootDir);
  const hash = createHash('sha256');
  for (const relativePath of files) {
    hash.update(relativePath.split(path.sep).join('/'));
    hash.update('\0');
    hash.update(await fs.readFile(path.join(rootDir, relativePath)));
    hash.update('\0');
  }
  return Object.freeze({ digest: hash.digest('hex'), fileCount: files.length });
}

async function validateArtifactBuildIdentity(sourceDir, contentIdentity) {
  const buildInfoPath = path.join(sourceDir, 'entropy-build-info.json');
  const buildInfo = await readJsonFileStrict(
    buildInfoPath,
    'ENTROPY_QA_ARTIFACT_BUILD_INFO_INVALID',
  );
  if (
    buildInfo?.schemaVersion !== 1
    || buildInfo.buildId !== contentIdentity.artifact.buildId
    || buildInfo.releaseProfile !== contentIdentity.artifact.releaseProfile
  ) {
    throw new Error('ENTROPY_QA_ARTIFACT_BUILD_IDENTITY_MISMATCH');
  }
}

async function matchesExistingArtifactReceipt(slotDir, contentIdentity, sourceTree) {
  const receipt = await readJsonFileStrict(
    path.join(slotDir, ENTROPY_QA_ARTIFACT_RECEIPT_FILE),
    'ENTROPY_QA_ARTIFACT_RECEIPT_INVALID',
  );
  if (
    !hasExactObjectKeys(receipt, [
      'schemaVersion',
      'kind',
      'contentIdentityDigest',
      'sourceTreeSha256',
      'sourceFileCount',
      'treeSha256',
      'fileCount',
    ])
    || receipt.schemaVersion !== 1
    || receipt.kind !== ENTROPY_QA_ARTIFACT_RECEIPT_KIND
    || receipt.contentIdentityDigest !== contentIdentity.digest
    || receipt.sourceFileCount !== sourceTree.fileCount
    || receipt.sourceTreeSha256 !== sourceTree.digest
    || !Number.isSafeInteger(receipt.fileCount)
    || receipt.fileCount < 1
    || !SHA256_PATTERN.test(receipt.treeSha256 || '')
  ) {
    return null;
  }
  const tree = await fingerprintArtifactTree(slotDir);
  if (tree.fileCount !== receipt.fileCount || tree.digest !== receipt.treeSha256) return null;
  return Object.freeze({ receipt, tree });
}

export async function readEntropyQaArtifactActivationReceipt({
  slotDir,
  contentIdentityDigest,
  browserEpoch,
  extensionId,
} = {}) {
  const resolvedSlotDir = requireAbsolutePath(
    slotDir,
    'ENTROPY_QA_ARTIFACT_ACTIVATION_SLOT_INVALID',
  );
  const expected = {
    contentIdentityDigest: requireCanonicalString(
      contentIdentityDigest,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_CONTENT_IDENTITY_INVALID',
      { pattern: SHA256_PATTERN },
    ),
    browserEpoch: requireCanonicalString(
      browserEpoch,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_BROWSER_EPOCH_INVALID',
    ),
    extensionId: requireCanonicalString(
      extensionId,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_EXTENSION_ID_INVALID',
      { pattern: /^[a-p]{32}$/u },
    ),
  };
  const receipt = await readJsonFileStrict(
    resolveEntropyQaArtifactActivationReceiptPath(resolvedSlotDir),
    'ENTROPY_QA_ARTIFACT_ACTIVATION_RECEIPT_INVALID',
  );
  if (
    !hasExactObjectKeys(receipt, [
      'schemaVersion',
      'kind',
      'contentIdentityDigest',
      'browserEpoch',
      'extensionId',
    ])
    || receipt.schemaVersion !== 3
    || receipt.kind !== ENTROPY_QA_ARTIFACT_ACTIVATION_KIND
    || receipt.contentIdentityDigest !== expected.contentIdentityDigest
    || receipt.browserEpoch !== expected.browserEpoch
    || receipt.extensionId !== expected.extensionId
  ) return null;
  return Object.freeze({ ...receipt });
}

export async function writeEntropyQaArtifactActivationReceipt({
  slotDir,
  contentIdentityDigest,
  browserEpoch,
  extensionId,
} = {}) {
  const resolvedSlotDir = requireAbsolutePath(
    slotDir,
    'ENTROPY_QA_ARTIFACT_ACTIVATION_SLOT_INVALID',
  );
  const receipt = Object.freeze({
    schemaVersion: 3,
    kind: ENTROPY_QA_ARTIFACT_ACTIVATION_KIND,
    contentIdentityDigest: requireCanonicalString(
      contentIdentityDigest,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_CONTENT_IDENTITY_INVALID',
      { pattern: SHA256_PATTERN },
    ),
    browserEpoch: requireCanonicalString(
      browserEpoch,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_BROWSER_EPOCH_INVALID',
    ),
    extensionId: requireCanonicalString(
      extensionId,
      'ENTROPY_QA_ARTIFACT_ACTIVATION_EXTENSION_ID_INVALID',
      { pattern: /^[a-p]{32}$/u },
    ),
  });
  const receiptPath = resolveEntropyQaArtifactActivationReceiptPath(resolvedSlotDir);
  const temporaryPath = `${receiptPath}.${process.pid}-${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, receiptPath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
  return receipt;
}

function requireAbsolutePath(value, errorCode) {
  if (typeof value !== 'string' || !value.trim() || !path.isAbsolute(value)) {
    throw new Error(`${errorCode}:${String(value || '')}`);
  }
  return path.normalize(value);
}
export function resolveEntropyQaArtifactSlot(profileDir) {
  const resolvedProfileDir = requireAbsolutePath(
    profileDir,
    'ENTROPY_QA_ARTIFACT_SLOT_PROFILE_PATH_INVALID',
  );
  return `${resolvedProfileDir}.entropy-extension-slot`;
}

export async function admitEntropyQaArtifactStaging({
  browser,
  browserExecution,
} = {}) {
  if (
    browser?.processOwnership !== 'attach_only'
    || browser?.lifecyclePolicy !== 'managed'
    || browser?.browserClass !== 'managed_persistent'
    || browser?.startPolicy !== 'managed_ensure_before_attach'
    || browserExecution?.processOwnership !== 'attach_only'
    || browserExecution?.startPolicy !== 'managed_ensure_before_attach'
    || browserExecution?.extensionRuntime !== 'required'
    || !['ready', 'pending_stage'].includes(browser?.extensionSlotAdmission)
    || browser?.browserIdentity?.status !== 'declared_identity_verified'
  ) {
    throw new Error('ENTROPY_QA_ARTIFACT_STAGING_AUTHORITY_INVALID');
  }
  const profileDir = await validateEntropyQaProfile(browser.profile, {
    allowLocked: true,
    allowProvisioning: false,
  });
  if (path.normalize(profileDir) !== path.normalize(browser.profile)) {
    throw new Error('ENTROPY_QA_ARTIFACT_STAGING_PROFILE_IDENTITY_MISMATCH');
  }
  const slotDir = resolveEntropyQaArtifactSlot(profileDir);
  if (
    requireAbsolutePath(
      browser.extensionSlot,
      'ENTROPY_QA_ARTIFACT_STAGING_SLOT_DECLARATION_REQUIRED',
    ) !== slotDir
  ) {
    throw new Error('ENTROPY_QA_ARTIFACT_STAGING_SLOT_IDENTITY_MISMATCH');
  }
  return Object.freeze({ profileDir, slotDir });
}

export function defineEntropyQaAttachedArtifactStage({
  browser,
  browserExecution,
  sourceDir,
  artifactIdentity,
  temporaryManifest = null,
} = {}) {
  const canonicalSlotDir = resolveEntropyQaArtifactSlot(browser?.profile);
  const declaredSlotDir = requireAbsolutePath(
    browser?.extensionSlot,
    'ENTROPY_QA_MANAGED_EXTENSION_SLOT_DECLARATION_REQUIRED',
  );
  if (declaredSlotDir !== canonicalSlotDir) {
    throw new Error('ENTROPY_QA_MANAGED_EXTENSION_SLOT_IDENTITY_MISMATCH');
  }
  const dedicatedProfileOwnership = browser?.dedicatedProfileOwnership;
  const browserIdentity = browser?.browserIdentity;
  const managed = browser?.lifecyclePolicy === 'managed';
  if (
    browser?.processOwnership !== 'attach_only'
    || !managed
    || browser?.browserClass !== 'managed_persistent'
    || browser?.startPolicy !== 'managed_ensure_before_attach'
    || browserExecution?.startPolicy !== 'managed_ensure_before_attach'
    || browserExecution?.processOwnership !== 'attach_only'
    || browserExecution?.extensionRuntime !== 'required'
    || !['ready', 'pending_stage'].includes(browser?.extensionSlotAdmission)
    || dedicatedProfileOwnership?.status !== 'dedicated_profile_verified'
    || dedicatedProfileOwnership?.profileSlotId !== browser.profileSlotId
    || (path.normalize(dedicatedProfileOwnership?.userDataDir || '')
      !== path.normalize(browser.profile))
    || dedicatedProfileOwnership?.proofType !== 'entropy_qa_profile_marker'
    || !Number.isSafeInteger(dedicatedProfileOwnership?.proofVersion)
    || browserIdentity?.status !== 'declared_identity_verified'
    || browserIdentity?.profileSlotId !== browser.profileSlotId
    || normalizeBrowserQaComparablePath(
      browserIdentity?.userDataDir,
      'ENTROPY_QA_MANAGED_EXTENSION_BROWSER_IDENTITY_PROFILE_INVALID',
    ) !== normalizeBrowserQaComparablePath(
      browser.profile,
      'ENTROPY_QA_MANAGED_EXTENSION_PROFILE_INVALID',
    )
  ) {
    throw new Error('ENTROPY_QA_ATTACHED_ARTIFACT_STAGE_AUTHORITY_INVALID');
  }
  const contentIdentity = defineEntropyQaArtifactContentIdentity({
    artifactIdentity,
    temporaryManifest,
  });
  return Object.freeze({
    contractVersion: 2,
    kind: 'entropy_attached_artifact_stage',
    mutationPolicy: 'managed_atomic_sync',
    profileSlotId: browser.profileSlotId,
    lifecyclePolicy: browser.lifecyclePolicy,
    profileDir: browser.profile,
    slotDir: canonicalSlotDir,
    slotAdmission: browser.extensionSlotAdmission,
    sourceDir: requireAbsolutePath(
      sourceDir,
      'ENTROPY_QA_MANAGED_EXTENSION_ARTIFACT_SOURCE_REQUIRED',
    ),
    artifactIdentity: contentIdentity.artifact,
    contentIdentity,
    contentIdentityDigest: contentIdentity.digest,
    temporaryManifest: contentIdentity.temporaryManifest,
  });
}

async function validateStagingAuthorityFiles(directory) {
  const stat = async (name) => fs.lstat(path.join(directory, name)).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const manifest = await stat('manifest.json');
  if (!manifest?.isFile() || manifest.isSymbolicLink()) {
    throw new Error('ENTROPY_QA_ARTIFACT_MANIFEST_FILE_REQUIRED');
  }
  const trustedPage = await stat(ENTROPY_QA_TRUSTED_PAGE_PATH);
  if (trustedPage && (!trustedPage.isFile() || trustedPage.isSymbolicLink())) {
    throw new Error('ENTROPY_QA_ARTIFACT_TRUSTED_PAGE_FILE_INVALID');
  }
}

export async function stageEntropyQaArtifact({
  profileDir,
  sourceDir,
  expectedSlotDir = null,
  temporaryManifest = null,
  artifactIdentity = null,
  reuseExisting = false,
} = {}) {
  const resolvedSourceDir = requireAbsolutePath(
    sourceDir,
    'ENTROPY_QA_ARTIFACT_SOURCE_PATH_INVALID',
  );
  const resolvedProfileDir = requireAbsolutePath(
    profileDir,
    'ENTROPY_QA_ARTIFACT_SLOT_PROFILE_PATH_INVALID',
  );
  const sourceFromProfile = path.relative(resolvedProfileDir, resolvedSourceDir);
  if (
    sourceFromProfile === ''
    || (!sourceFromProfile.startsWith(`..${path.sep}`) && !path.isAbsolute(sourceFromProfile))
  ) {
    throw new Error('ENTROPY_QA_ARTIFACT_SOURCE_INSIDE_PROFILE_FORBIDDEN');
  }
  const slotDir = resolveEntropyQaArtifactSlot(resolvedProfileDir);
  if (
    expectedSlotDir !== null
    && requireAbsolutePath(
      expectedSlotDir,
      'ENTROPY_QA_ARTIFACT_EXPECTED_SLOT_PATH_INVALID',
    ) !== slotDir
  ) {
    throw new Error('ENTROPY_QA_ARTIFACT_SLOT_IDENTITY_MISMATCH');
  }
  const sourceStat = await fs.lstat(resolvedSourceDir).catch(() => null);
  if (!sourceStat?.isDirectory() || sourceStat.isSymbolicLink()) {
    throw new Error(`ENTROPY_QA_ARTIFACT_SOURCE_DIRECTORY_INVALID:${resolvedSourceDir}`);
  }
  const sourceReceiptStat = await fs.lstat(
    path.join(resolvedSourceDir, ENTROPY_QA_ARTIFACT_RECEIPT_FILE),
  ).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (sourceReceiptStat) {
    throw new Error('ENTROPY_QA_ARTIFACT_SOURCE_RECEIPT_FORBIDDEN');
  }
  const slotStat = await fs.lstat(slotDir).catch(() => null);
  if (slotStat?.isSymbolicLink()) {
    throw new Error(`ENTROPY_QA_ARTIFACT_SLOT_SYMLINK_FORBIDDEN:${slotDir}`);
  }
  if (slotStat && !slotStat.isDirectory()) {
    throw new Error('ENTROPY_QA_ARTIFACT_SLOT_DIRECTORY_REQUIRED');
  }
  // Reject authority symlinks before a platform copy can follow or recreate
  // them. Validate the staged copy again before publishing it.
  await validateStagingAuthorityFiles(resolvedSourceDir);
  if (reuseExisting !== false && reuseExisting !== true) {
    throw new Error('ENTROPY_QA_ARTIFACT_REUSE_POLICY_INVALID');
  }
  if (reuseExisting && artifactIdentity === null) {
    throw new Error('ENTROPY_QA_ARTIFACT_REUSE_IDENTITY_REQUIRED');
  }
  const contentIdentity = artifactIdentity === null
    ? null
    : defineEntropyQaArtifactContentIdentity({
      artifactIdentity,
      temporaryManifest,
    });
  if (contentIdentity) {
    await validateArtifactBuildIdentity(resolvedSourceDir, contentIdentity);
  }
  const sourceTreeBeforeStage = contentIdentity
    ? await fingerprintArtifactTree(resolvedSourceDir)
    : null;
  if (reuseExisting && slotStat) {
    const existing = await matchesExistingArtifactReceipt(
      slotDir,
      contentIdentity,
      sourceTreeBeforeStage,
    );
    if (existing) {
      return Object.freeze({
        slotDir,
        trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
        action: 'reused_exact_slot',
        contentIdentityDigest: contentIdentity.digest,
        fileCount: existing.tree.fileCount,
        treeSha256: existing.tree.digest,
      });
    }
  }
  const stagingDir = `${slotDir}.staging-${randomUUID()}`;
  const retiredDir = `${slotDir}.retired-${randomUUID()}`;
  try {
    if (contentIdentity) {
      await fs.rm(resolveEntropyQaArtifactActivationReceiptPath(slotDir), {
        force: true,
      });
    }
    await fs.cp(resolvedSourceDir, stagingDir, { recursive: true, errorOnExist: true });
    await validateStagingAuthorityFiles(stagingDir);
    const manifestPath = path.join(stagingDir, 'manifest.json');
    const trustedPagePath = path.join(stagingDir, ENTROPY_QA_TRUSTED_PAGE_PATH);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest?.manifest_version !== 3) {
      throw new Error(`ENTROPY_QA_ARTIFACT_MANIFEST_V3_REQUIRED:${manifestPath}`);
    }
    const promotedManifest = promoteManifestForChromiumHarness(manifest, temporaryManifest);
    await fs.writeFile(
      manifestPath,
      `${JSON.stringify(promotedManifest, null, 2)}\n`,
    );
    await fs.writeFile(
      trustedPagePath,
      TRUSTED_PAGE_SOURCE,
    );
    let tree = null;
    if (contentIdentity) {
      const sourceTreeAfterStage = await fingerprintArtifactTree(resolvedSourceDir);
      if (
        sourceTreeAfterStage.fileCount !== sourceTreeBeforeStage.fileCount
        || sourceTreeAfterStage.digest !== sourceTreeBeforeStage.digest
      ) {
        throw new Error('ENTROPY_QA_ARTIFACT_SOURCE_CHANGED_DURING_STAGE');
      }
      await validateArtifactBuildIdentity(stagingDir, contentIdentity);
      tree = await fingerprintArtifactTree(stagingDir);
      const receipt = Object.freeze({
        schemaVersion: 1,
        kind: ENTROPY_QA_ARTIFACT_RECEIPT_KIND,
        contentIdentityDigest: contentIdentity.digest,
        sourceTreeSha256: sourceTreeBeforeStage.digest,
        sourceFileCount: sourceTreeBeforeStage.fileCount,
        treeSha256: tree.digest,
        fileCount: tree.fileCount,
      });
      await fs.writeFile(
        path.join(stagingDir, ENTROPY_QA_ARTIFACT_RECEIPT_FILE),
        `${JSON.stringify(receipt, null, 2)}\n`,
        { flag: 'wx' },
      );
    }
    await publishEntropyQaArtifactSlotTransaction({
      slotDir,
      stagingDir,
      retiredDir,
      retireExisting: !!slotStat,
    });
  } catch (error) {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return Object.freeze({
    slotDir,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    action: contentIdentity ? 'staged_changed' : 'staged_unversioned',
    contentIdentityDigest: contentIdentity?.digest || null,
  });
}
