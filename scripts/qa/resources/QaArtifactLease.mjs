import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createDevExtensionInputFingerprint,
  DEV_EXTENSION_INPUT_PATHS,
  DEV_EXTENSION_PUBLICATION_FILE,
  DEV_EXTENSION_PUBLICATION_VERSION,
  resolveDevExtensionArtifactSource,
  withDevExtensionPublicationLock,
} from '../../dev/devExtensionArtifactPublisher.mjs';

const LOWERCASE_GIT_OBJECT_ID = /^[0-9a-f]{40}$/u;
const LOWERCASE_SHA256 = /^[0-9a-f]{64}$/u;

function assertSafeDevArtifactOutput(rootDir, distPath) {
  if (!path.isAbsolute(distPath || '')) {
    throw new Error('QA_ARTIFACT_DEV_EXTENSION_ABSOLUTE_REQUIRED');
  }
  const artifactToRoot = path.relative(distPath, rootDir);
  if (
    artifactToRoot === ''
    || (!artifactToRoot.startsWith('..') && !path.isAbsolute(artifactToRoot))
  ) {
    throw new Error('QA_ARTIFACT_DEV_OUTPUT_PROJECT_ANCESTOR_FORBIDDEN');
  }
}

async function assertDevArtifactOutputFileSystemShape(distPath) {
  const stat = await fs.lstat(distPath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (!stat) return;
  if (stat.isSymbolicLink()) {
    throw new Error('QA_ARTIFACT_DEV_OUTPUT_SYMLINK_FORBIDDEN');
  }
  if (!stat.isDirectory()) {
    throw new Error('QA_ARTIFACT_DEV_OUTPUT_DIRECTORY_REQUIRED');
  }
}

async function readJson(filePath, code) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${code}:${filePath}`, { cause: error });
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${code}:${filePath}`, { cause: error });
  }
}

export async function fingerprintQaArtifactInputs({
  rootDir,
  inputPaths = DEV_EXTENSION_INPUT_PATHS,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) {
    throw new Error('QA_ARTIFACT_ROOT_ABSOLUTE_REQUIRED');
  }
  return createDevExtensionInputFingerprint(rootDir, inputPaths);
}

function runGit(rootDir, args) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `QA_ARTIFACT_SOURCE_GIT_UNAVAILABLE:${args.join(' ')}:${String(result.stderr || '').trim()}`,
    );
  }
  return String(result.stdout || '').trim();
}

async function readPublicSourceProvenance(rootDir) {
  const worktreeStatus = runGit(rootDir, [
    '--no-optional-locks',
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]);
  if (worktreeStatus) {
    throw new Error('QA_ARTIFACT_SOURCE_WORKTREE_DIRTY');
  }
  const lockfile = await fs.readFile(path.join(rootDir, 'package-lock.json')).catch((error) => {
    throw new Error('QA_ARTIFACT_SOURCE_LOCKFILE_UNAVAILABLE', { cause: error });
  });
  return Object.freeze({
    gitCommitSha: runGit(rootDir, ['rev-parse', 'HEAD']),
    gitTreeSha: runGit(rootDir, ['rev-parse', 'HEAD^{tree}']),
    lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
  });
}

export function validatePublicQaArtifactProvenance({
  buildInfo,
  sourceProvenance = null,
} = {}) {
  const createdAt = new Date(buildInfo?.createdAt);
  if (
    !buildInfo
    || typeof buildInfo !== 'object'
    || Array.isArray(buildInfo)
    || buildInfo.schemaVersion !== 1
    || typeof buildInfo.buildId !== 'string'
    || !buildInfo.buildId
    || buildInfo.command !== 'build'
    || buildInfo.releaseProfile !== 'public'
    || buildInfo.extensionTarget !== 'chrome'
    || typeof buildInfo.createdAt !== 'string'
    || Number.isNaN(createdAt.getTime())
    || createdAt.toISOString() !== buildInfo.createdAt
    || !LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitCommitSha || '')
    || !LOWERCASE_GIT_OBJECT_ID.test(buildInfo.gitTreeSha || '')
    || !LOWERCASE_SHA256.test(buildInfo.lockfileSha256 || '')
  ) {
    throw new Error('QA_ARTIFACT_PUBLIC_BUILD_INFO_CONTRACT_INVALID');
  }
  if (buildInfo.dirty !== false || !buildInfo.buildId.includes('-clean')) {
    throw new Error('QA_ARTIFACT_PUBLIC_BUILD_DIRTY');
  }
  const buildTimestamp = buildInfo.createdAt.replace(/[-:.TZ]/gu, '').slice(0, 14);
  const expectedBuildId = `${buildTimestamp}-${buildInfo.gitCommitSha.slice(0, 12)}-clean`;
  if (buildInfo.buildId !== expectedBuildId) {
    throw new Error('QA_ARTIFACT_PUBLIC_BUILD_IDENTITY_INVALID');
  }
  if (sourceProvenance) {
    if (buildInfo.gitCommitSha !== sourceProvenance.gitCommitSha) {
      throw new Error('QA_ARTIFACT_PUBLIC_SOURCE_COMMIT_MISMATCH');
    }
    if (buildInfo.gitTreeSha !== sourceProvenance.gitTreeSha) {
      throw new Error('QA_ARTIFACT_PUBLIC_SOURCE_TREE_MISMATCH');
    }
    if (buildInfo.lockfileSha256 !== sourceProvenance.lockfileSha256) {
      throw new Error('QA_ARTIFACT_PUBLIC_SOURCE_LOCKFILE_MISMATCH');
    }
  }
  return buildInfo;
}

async function readBuildInfo(distPath, expectedProfile) {
  const manifestPath = path.join(distPath, 'manifest.json');
  const buildInfoPath = path.join(distPath, 'entropy-build-info.json');
  const [manifest, buildInfo] = await Promise.all([
    readJson(manifestPath, 'QA_ARTIFACT_MANIFEST_UNAVAILABLE'),
    readJson(buildInfoPath, 'QA_ARTIFACT_BUILD_INFO_UNAVAILABLE'),
  ]);
  if (buildInfo?.releaseProfile !== expectedProfile) {
    throw new Error(
      `QA_ARTIFACT_RELEASE_PROFILE_MISMATCH:${expectedProfile}:${buildInfo?.releaseProfile || 'missing'}`,
    );
  }
  if (buildInfo?.schemaVersion !== 1 || typeof buildInfo?.buildId !== 'string') {
    throw new Error('QA_ARTIFACT_BUILD_INFO_CONTRACT_INVALID');
  }
  if (expectedProfile === 'public') {
    validatePublicQaArtifactProvenance({ buildInfo });
  }
  if (!manifest || typeof manifest !== 'object' || manifest.manifest_version !== 3) {
    throw new Error('QA_ARTIFACT_MANIFEST_CONTRACT_INVALID');
  }
  return Object.freeze({
    distPath,
    buildInfoPath,
    manifestPath,
    buildInfo,
    buildId: buildInfo.buildId,
    releaseProfile: buildInfo.releaseProfile,
  });
}

async function readPublicBuildInfo(rootDir, distPath) {
  const artifact = await readBuildInfo(distPath, 'public');
  const sourceProvenance = await readPublicSourceProvenance(rootDir);
  validatePublicQaArtifactProvenance({
    buildInfo: artifact.buildInfo,
    sourceProvenance,
  });
  return artifact;
}

function readQaArtifactErrorCode(error) {
  const explicit = typeof error?.code === 'string' ? error.code.trim() : '';
  if (explicit) return explicit;
  const message = error instanceof Error ? error.message : String(error || '');
  const candidate = message.split(':', 1)[0];
  return /^[A-Z][A-Z0-9_]+$/u.test(candidate)
    ? candidate
    : 'QA_ARTIFACT_INSPECTION_FAILED';
}

function freezeArtifactInspection(value) {
  return Object.freeze({ contractVersion: 1, ...value });
}

function publicArtifactRepair(plan) {
  return Object.freeze({
    automatic: false,
    path: plan.artifactPaths.publicExtension,
    requiredProfile: 'public',
    requiresCleanWorktree: true,
    requiresCurrentCommitTreeAndLockfile: true,
    manualBrowserReloadRequired: false,
    instructions: Object.freeze([
      'Review and commit the intended changes in the chosen checkout; all non-ignored tracked and untracked changes must be resolved. Do not discard unrelated work.',
      'Build the public Chrome artifact from that clean checkout with npm run build:prod. If the configured artifact path differs from dist-prod, set ENTROPY_EXTENSION_OUT_DIR to the configured path for that build.',
      'Run doctor again with the same target, mode, and parameters. When READY, run the same named target; its browser owner loads the artifact without a manual reload.',
    ]),
  });
}

async function readDevPublication(distPath) {
  const publicationPath = path.join(distPath, DEV_EXTENSION_PUBLICATION_FILE);
  try {
    const entry = await fs.lstat(publicationPath);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('DEV_PUBLICATION_FILE_INVALID');
    const publication = JSON.parse(await fs.readFile(publicationPath, 'utf8'));
    if (
      publication?.contractVersion !== DEV_EXTENSION_PUBLICATION_VERSION
      || publication.artifactId !== 'dev_extension'
      || typeof publication.buildId !== 'string' || !publication.buildId
      || !LOWERCASE_SHA256.test(publication.inputDigest || '')
    ) throw new Error('DEV_PUBLICATION_CONTRACT_INVALID');
    return publication;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`QA_ARTIFACT_PUBLICATION_INVALID:${publicationPath}`, { cause: error });
  }
}

export async function inspectQaArtifactRequirement(plan) {
  const artifactId = plan?.artifactId ?? null;
  if (!artifactId) {
    const protocolOwned = plan?.protocolOptions?.artifactOwnership
      === 'site_runtime_lane';
    return freezeArtifactInspection({
      artifactId: null,
      status: protocolOwned ? 'DEFERRED' : 'NOT_REQUIRED',
      action: protocolOwned ? 'protocol_owned' : 'not_required',
      reasonCode: protocolOwned
        ? 'QA_ARTIFACT_CHILD_PROTOCOL_OWNED'
        : null,
    });
  }
  if (artifactId === 'source_render') {
    return freezeArtifactInspection({
      artifactId,
      status: 'READY',
      action: 'use_source',
      reasonCode: null,
      path: plan.rootDir,
      buildId: null,
    });
  }
  if (artifactId === 'public_extension') {
    if (plan.parameters?.sourceOnly === true) {
      return freezeArtifactInspection({
        artifactId,
        status: 'NOT_REQUIRED',
        action: 'source_only',
        reasonCode: null,
      });
    }
    try {
      const artifact = await readPublicBuildInfo(
        plan.rootDir,
        plan.artifactPaths.publicExtension,
      );
      return freezeArtifactInspection({
        artifactId,
        status: 'READY',
        action: 'reuse_prebuilt',
        reasonCode: null,
        path: artifact.distPath,
        buildId: artifact.buildId,
        releaseProfile: artifact.releaseProfile,
      });
    } catch (error) {
      return freezeArtifactInspection({
        artifactId,
        status: 'BLOCKED',
        action: 'repair_prebuilt_artifact',
        reasonCode: readQaArtifactErrorCode(error),
        repair: publicArtifactRepair(plan),
      });
    }
  }
  if (artifactId !== 'dev_extension') {
    return freezeArtifactInspection({
      artifactId,
      status: 'BLOCKED',
      action: 'repair_target_contract',
      reasonCode: 'QA_ARTIFACT_UNKNOWN',
    });
  }

  try {
    const distPath = await resolveDevExtensionArtifactSource(plan.rootDir, plan.artifactPaths.devExtension);
    assertSafeDevArtifactOutput(plan.rootDir, distPath);
    await assertDevArtifactOutputFileSystemShape(distPath);
    const input = await fingerprintQaArtifactInputs({ rootDir: plan.rootDir });
    if (plan.parameters?.rebuild === true) {
      return freezeArtifactInspection({
        artifactId,
        status: 'BUILD_REQUIRED',
        action: 'rebuild_forced',
        reasonCode: 'QA_ARTIFACT_REBUILD_REQUESTED',
        path: distPath,
        inputDigest: input.digest,
        inputFileCount: input.fileCount,
      });
    }
    const published = await readDevPublication(distPath);
    let reasonCode = null;
    if (!published) reasonCode = 'QA_ARTIFACT_PUBLICATION_MISSING';
    else if (published.inputDigest !== input.digest) {
      reasonCode = 'QA_ARTIFACT_INPUT_DIGEST_CHANGED';
    }
    if (!reasonCode) {
      const artifact = await readBuildInfo(distPath, 'dev').catch(() => null);
      if (artifact?.buildId === published.buildId) {
        return freezeArtifactInspection({
          artifactId,
          status: 'READY',
          action: 'reuse_exact',
          reasonCode: null,
          path: distPath,
          buildId: artifact.buildId,
          releaseProfile: artifact.releaseProfile,
          inputDigest: input.digest,
          inputFileCount: input.fileCount,
        });
      }
      reasonCode = artifact
        ? 'QA_ARTIFACT_BUILD_ID_CHANGED'
        : 'QA_ARTIFACT_OUTPUT_UNREADABLE';
    }
    return freezeArtifactInspection({
      artifactId,
      status: 'BUILD_REQUIRED',
      action: 'build_on_run',
      reasonCode,
      path: distPath,
      inputDigest: input.digest,
      inputFileCount: input.fileCount,
    });
  } catch (error) {
    return freezeArtifactInspection({
      artifactId,
      status: 'BLOCKED',
      action: 'repair_dev_artifact_contract',
      reasonCode: readQaArtifactErrorCode(error),
    });
  }
}

export class QaArtifactLease {
  constructor({
    plan,
    runChild,
    evidence,
  }) {
    this.plan = plan;
    this.runChild = runChild;
    this.evidence = evidence;
    this.pinnedDir = null;
  }

  async acquire() {
    const { artifactId } = this.plan;
    if (!artifactId) return null;
    if (artifactId === 'source_render') {
      return Object.freeze({
        id: artifactId,
        status: 'ready',
        ownership: 'source',
        buildId: null,
        path: this.plan.rootDir,
      });
    }
    if (artifactId === 'dev_extension') {
      return this.acquireDevExtension();
    }
    if (artifactId === 'public_extension') {
      if (this.plan.parameters.sourceOnly === true) {
        return Object.freeze({
          id: artifactId,
          status: 'not_required',
          ownership: 'source_only',
          path: null,
          buildId: null,
          releaseProfile: null,
        });
      }
      const artifact = await readPublicBuildInfo(
        this.plan.rootDir,
        this.plan.artifactPaths.publicExtension,
      );
      return Object.freeze({
        id: artifactId,
        status: 'ready',
        ownership: 'prebuilt',
        path: artifact.distPath,
        buildId: artifact.buildId,
        releaseProfile: artifact.releaseProfile,
      });
    }
    throw new Error(`QA_ARTIFACT_UNKNOWN:${artifactId}`);
  }

  async acquireDevExtension() {
    assertSafeDevArtifactOutput(this.plan.rootDir, this.plan.artifactPaths.devExtension);
    await assertDevArtifactOutputFileSystemShape(this.plan.artifactPaths.devExtension);
    const input = await fingerprintQaArtifactInputs({ rootDir: this.plan.rootDir });
    // Initial execution admission must also wait for a complete publication.
    // Release this short read lock before requesting a build from its owner.
    let artifact = await withDevExtensionPublicationLock(this.plan.rootDir, async () => {
      const sourcePath = await resolveDevExtensionArtifactSource(this.plan.rootDir, this.plan.artifactPaths.devExtension);
      await assertDevArtifactOutputFileSystemShape(sourcePath);
      const published = await readDevPublication(sourcePath);
      if (this.plan.parameters.rebuild === true || published?.inputDigest !== input.digest) return null;
      const candidate = await readBuildInfo(sourcePath, 'dev').catch(() => null);
      return candidate?.buildId === published.buildId ? candidate : null;
    });
    let rebuilt = false;
    if (!artifact) {
      await this.evidence.event('QA_ARTIFACT_BUILD_STARTED', {
        artifactId: 'dev_extension',
        inputDigest: input.digest,
      });
      if (!process.env.npm_execpath) {
        throw new Error('QA_ARTIFACT_NPM_CLI_REQUIRED');
      }
      await this.runChild({
        command: process.execPath,
        args: [process.env.npm_execpath, 'run', 'build'],
        env: {
          ...process.env,
        },
      });
      rebuilt = true;
    }
    // Share the publisher's lock only while copying a complete publication.
    // Later builds may replace dist while this run consumes its pinned bytes.
    const pinned = await withDevExtensionPublicationLock(this.plan.rootDir, async () => {
      const sourcePath = await resolveDevExtensionArtifactSource(this.plan.rootDir, this.plan.artifactPaths.devExtension);
      artifact = await readBuildInfo(sourcePath, 'dev');
      const publication = await readDevPublication(sourcePath);
      if (!publication || publication.buildId !== artifact.buildId) {
        throw new Error('QA_ARTIFACT_PUBLICATION_MISMATCH');
      }
      const pinsRoot = path.join(this.plan.rootDir, '.artifacts', 'qa', 'artifact-leases');
      await fs.mkdir(pinsRoot, { recursive: true });
      this.pinnedDir = await fs.mkdtemp(path.join(pinsRoot, 'dev-'));
      await fs.cp(sourcePath, this.pinnedDir, { recursive: true });
      const proof = await readBuildInfo(this.pinnedDir, 'dev');
      if (proof.buildId !== publication.buildId) throw new Error('QA_ARTIFACT_PIN_IDENTITY_MISMATCH');
      return Object.freeze({ id: 'dev_extension', status: 'ready',
        ownership: rebuilt ? 'built_for_run' : 'reused', path: this.pinnedDir,
        isolation: 'immutable_run_copy',
        sourcePath, buildId: proof.buildId, releaseProfile: proof.releaseProfile,
        inputDigest: publication.inputDigest, requestedInputDigest: input.digest,
        sourceSnapshotChanged: publication.inputDigest !== input.digest });
    });
    if (rebuilt) await this.evidence.event('QA_ARTIFACT_BUILD_FINISHED', {
      artifactId: 'dev_extension', buildId: pinned.buildId,
    });
    return pinned;
  }

  async release() {
    if (this.pinnedDir === null) return { released: true, pinned: false };
    const pinsRoot = path.join(this.plan.rootDir, '.artifacts', 'qa', 'artifact-leases');
    const relative = path.relative(pinsRoot, this.pinnedDir);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('QA_ARTIFACT_PIN_CLEANUP_PATH_INVALID');
    }
    const entry = await fs.lstat(this.pinnedDir);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('QA_ARTIFACT_PIN_CLEANUP_IDENTITY_INVALID');
    await fs.rm(this.pinnedDir, { recursive: true, force: false });
    this.pinnedDir = null;
    return { released: true, pinned: true };
  }
}
