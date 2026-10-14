import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EXTENSION_ARTIFACT_CHECK_PATHS } from '../ci/extensionArtifactCheckCatalog.mjs';

const OWNER_DIR_NAME = 'dev-extension-builds';
export const DEV_EXTENSION_PUBLICATION_FILE = 'entropy-dev-publication.json';
export const DEV_EXTENSION_PUBLICATION_VERSION = 1;
export const DEV_EXTENSION_REAL_USE_PIN_VERSION = 1;
const SHA256 = /^[0-9a-f]{64}$/u;
const DIGEST_IO_BATCH_SIZE = 8;
const PIN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REQUIRED_ARTIFACT_FILES = Object.freeze([
  'manifest.json',
  'entropy-build-info.json',
  'service-worker-loader.js',
  'src/apps/content/loader.js',
  'src/apps/content/bootstrap.js',
]);

export const DEV_EXTENSION_INPUT_PATHS = Object.freeze([
  'src',
  'public',
  'vite.config.js',
  'package.json',
  'package-lock.json',
  '.nvmrc',
  'tailwind.config.js',
  ...EXTENSION_ARTIFACT_CHECK_PATHS,
  'scripts/ci/extensionArtifactCheckCatalog.mjs',
  'scripts/ci/run-vite-build-with-content-bootstrap-check.mjs',
  'scripts/i18n/runtimeI18nChunkContract.mjs',
  'scripts/release/prepaintVisualAssetsPlugin.mjs',
  'scripts/release/workerRuntimeChunkContract.mjs',
  'scripts/dev/visual-harness/visualHarnessViteContract.mjs',
  'scripts/dev/generate-zen-pond-static-assets.mjs',
  'scripts/dev/devExtensionArtifactPublisher.mjs',
  'scripts/dev/build-dev-extension.mjs',
  'scripts/dev/runtimeProfile.mjs',
]);

function createFailure(code, message = code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function requireAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw createFailure(code, `${code}:${String(value || '')}`);
  }
  return path.normalize(value);
}

function assertPathInside(parentDir, targetPath, code) {
  const relative = path.relative(parentDir, targetPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createFailure(code, `${code}:${targetPath}`);
  }
}

async function readJsonFile(filePath, code) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (cause) {
    throw createFailure(code, `${code}:${filePath}`, cause);
  }
}

async function requireRegularFile(filePath, code) {
  let entry;
  try {
    entry = await fs.lstat(filePath);
  } catch (cause) {
    throw createFailure(code, `${code}:${filePath}`, cause);
  }
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw createFailure(code, `${code}:${filePath}`);
  }
}

async function readOptionalEntry(filePath) {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function assertPlainDirectory(directoryPath, code) {
  const entry = await readOptionalEntry(directoryPath);
  if (!entry || !entry.isDirectory() || entry.isSymbolicLink()) {
    throw createFailure(code, `${code}:${directoryPath}`);
  }
  return entry;
}

// Metadata and file bytes may arrive concurrently; digest records always retain
// the original sorted depth-first order, including empty directory markers.
async function* walkDigestEntries(rootDir, relativePath, knownEntry = null) {
  const absolutePath = path.resolve(rootDir, relativePath);
  const entry = knownEntry === null ? await fs.lstat(absolutePath) : knownEntry;
  if (entry.isSymbolicLink()) {
    throw createFailure(
      'DEV_EXTENSION_BUILD_INPUT_SYMLINK_FORBIDDEN',
      `DEV_EXTENSION_BUILD_INPUT_SYMLINK_FORBIDDEN:${relativePath}`,
    );
  }
  if (entry.isDirectory()) {
    yield { type: 'directory', relativePath };
    const children = (await fs.readdir(absolutePath)).sort();
    for (let offset = 0; offset < children.length; offset += DIGEST_IO_BATCH_SIZE) {
      const childPaths = children.slice(offset, offset + DIGEST_IO_BATCH_SIZE)
        .map((child) => path.join(relativePath, child));
      const metadata = await Promise.allSettled(childPaths.map((childPath) => (
        fs.lstat(path.resolve(rootDir, childPath))
      )));
      for (let index = 0; index < childPaths.length; index += 1) {
        if (metadata[index].status === 'rejected') throw metadata[index].reason;
        yield* walkDigestEntries(rootDir, childPaths[index], metadata[index].value);
      }
    }
    return;
  }
  if (!entry.isFile()) {
    throw createFailure(
      'DEV_EXTENSION_BUILD_INPUT_TYPE_INVALID',
      `DEV_EXTENSION_BUILD_INPUT_TYPE_INVALID:${relativePath}`,
    );
  }
  yield { type: 'file', relativePath, absolutePath };
}

async function consumeDigestBatch(hash, entries, state, copyRoot) {
  const reads = await Promise.allSettled(entries.map((entry) => (
    entry.type === 'file' ? fs.readFile(entry.absolutePath) : Promise.resolve(null)
  )));
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const read = reads[index];
    if (read.status === 'rejected') throw read.reason;
    if (entry.type === 'directory') {
      hash.update(`directory\0${entry.relativePath}\0`);
    } else {
      hash.update(`file\0${entry.relativePath}\0${read.value.byteLength}\0`);
      hash.update(read.value);
      state.fileCount += 1;
    }
  }
  if (!copyRoot) return;
  // Copy only the buffers already consumed by the digest. Drain every write
  // before propagating an error so snapshot cleanup cannot race pending writes.
  const copies = await Promise.allSettled(entries.map(async (entry, index) => {
    const destination = path.join(copyRoot, entry.relativePath);
    if (entry.type === 'directory') {
      await fs.mkdir(destination, { recursive: true });
      return;
    }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, reads[index].value, { flag: 'wx' });
  }));
  for (const copy of copies) {
    if (copy.status === 'rejected') throw copy.reason;
  }
}

async function updateDigestFromPath(hash, rootDir, relativePath, state, copyRoot = null) {
  let batch = [];
  for await (const entry of walkDigestEntries(rootDir, relativePath)) {
    batch.push(entry);
    if (batch.length === DIGEST_IO_BATCH_SIZE) {
      await consumeDigestBatch(hash, batch, state, copyRoot);
      batch = [];
    }
  }
  if (batch.length > 0) await consumeDigestBatch(hash, batch, state, copyRoot);
}

export function resolveDevExtensionPublicationPaths(rootDir) {
  const canonicalRoot = requireAbsolutePath(rootDir, 'DEV_EXTENSION_ROOT_INVALID');
  const ownerDir = path.join(canonicalRoot, '.artifacts', OWNER_DIR_NAME);
  return Object.freeze({
    rootDir: canonicalRoot,
    activeDir: path.join(canonicalRoot, 'dist'),
    ownerDir,
    stagingRoot: path.join(ownerDir, 'staging'),
    inputsRoot: path.join(ownerDir, 'inputs'),
    previousDir: path.join(ownerDir, 'previous'),
    latestDir: path.join(ownerDir, 'latest'),
    latestPreviousDir: path.join(ownerDir, 'latest-previous'),
    realUsePinPath: path.join(ownerDir, 'real-use-pin.json'),
    lockPath: path.join(ownerDir, 'publish.lock'),
  });
}

export async function createDevExtensionInputFingerprint(
  rootDir,
  inputPaths = DEV_EXTENSION_INPUT_PATHS,
) {
  return fingerprintInputs(rootDir, inputPaths);
}

async function fingerprintInputs(rootDir, inputPaths, copyRoot = null) {
  const canonicalRoot = requireAbsolutePath(rootDir, 'DEV_EXTENSION_ROOT_INVALID');
  const hash = crypto.createHash('sha256');
  const state = { fileCount: 0 };
  for (const relativePath of [...inputPaths].sort()) {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
      throw createFailure(
        'DEV_EXTENSION_BUILD_INPUT_PATH_INVALID',
        `DEV_EXTENSION_BUILD_INPUT_PATH_INVALID:${String(relativePath || '')}`,
      );
    }
    assertPathInside(canonicalRoot, path.resolve(canonicalRoot, relativePath), 'DEV_EXTENSION_BUILD_INPUT_PATH_INVALID');
    await updateDigestFromPath(
      hash,
      canonicalRoot,
      path.normalize(relativePath),
      state,
      copyRoot,
    );
  }
  return Object.freeze({
    digest: hash.digest('hex'),
    fileCount: state.fileCount,
  });
}

export async function createDevExtensionInputDigest(
  rootDir,
  inputPaths = DEV_EXTENSION_INPUT_PATHS,
) {
  const fingerprint = await createDevExtensionInputFingerprint(rootDir, inputPaths);
  return fingerprint.digest;
}

// Capture only the declared build inputs. Later editor saves belong to the next
// build; they cannot invalidate or alter a build already using this directory.
export async function captureDevExtensionBuildInputs(rootDir, {
  inputPaths = DEV_EXTENSION_INPUT_PATHS,
  attempts = 3,
} = {}) {
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  await fs.mkdir(paths.inputsRoot, { recursive: true });
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const snapshotDir = await fs.mkdtemp(path.join(paths.inputsRoot, 'input-'));
    const release = async () => {
      assertPathInside(paths.inputsRoot, snapshotDir, 'DEV_EXTENSION_INPUT_CLEANUP_PATH_INVALID');
      await fs.rm(snapshotDir, { recursive: true, force: true });
    };
    try {
      const captured = await fingerprintInputs(rootDir, inputPaths, snapshotDir);
      const current = await createDevExtensionInputFingerprint(rootDir, inputPaths);
      if (captured.digest !== current.digest) {
        await release();
        continue;
      }
      // Dependencies are a toolchain, not editable build inputs. The lockfile is
      // captured; concurrent npm install/ci is outside this development contract.
      await fs.symlink(path.join(rootDir, 'node_modules'), path.join(snapshotDir, 'node_modules'), 'junction');
      return Object.freeze({ rootDir: snapshotDir, inputDigest: captured.digest,
        inputFileCount: captured.fileCount, release });
    } catch (error) {
      await release();
      if (error?.code === 'ENOENT' && attempt < attempts) continue;
      throw error;
    }
  }
  throw createFailure('DEV_EXTENSION_INPUT_CAPTURE_BUSY');
}

export async function assertDevExtensionArtifact(artifactDir) {
  const canonicalArtifactDir = requireAbsolutePath(
    artifactDir,
    'DEV_EXTENSION_ARTIFACT_PATH_INVALID',
  );
  await assertPlainDirectory(canonicalArtifactDir, 'DEV_EXTENSION_ARTIFACT_DIRECTORY_INVALID');
  for (const relativePath of REQUIRED_ARTIFACT_FILES) {
    await requireRegularFile(
      path.join(canonicalArtifactDir, relativePath),
      'DEV_EXTENSION_ARTIFACT_FILE_INVALID',
    );
  }

  const [manifest, buildInfo] = await Promise.all([
    readJsonFile(
      path.join(canonicalArtifactDir, 'manifest.json'),
      'DEV_EXTENSION_ARTIFACT_MANIFEST_INVALID',
    ),
    readJsonFile(
      path.join(canonicalArtifactDir, 'entropy-build-info.json'),
      'DEV_EXTENSION_ARTIFACT_BUILD_INFO_INVALID',
    ),
  ]);
  if (
    manifest?.manifest_version !== 3
    || manifest?.background?.service_worker !== 'service-worker-loader.js'
  ) {
    throw createFailure(
      'DEV_EXTENSION_ARTIFACT_MANIFEST_CONTRACT_INVALID',
      'DEV_EXTENSION_ARTIFACT_MANIFEST_CONTRACT_INVALID',
    );
  }
  if (
    buildInfo?.schemaVersion !== 1
    || buildInfo?.command !== 'build'
    || buildInfo?.releaseProfile !== 'dev'
    || typeof buildInfo?.buildId !== 'string'
    || !buildInfo.buildId
  ) {
    throw createFailure(
      'DEV_EXTENSION_ARTIFACT_BUILD_INFO_CONTRACT_INVALID',
      'DEV_EXTENSION_ARTIFACT_BUILD_INFO_CONTRACT_INVALID',
    );
  }
  return Object.freeze({
    artifactDir: canonicalArtifactDir,
    buildId: buildInfo.buildId,
    releaseProfile: buildInfo.releaseProfile,
  });
}

async function readCompleteDevPublication(artifactDir) {
  const artifact = await assertDevExtensionArtifact(artifactDir);
  const publicationPath = path.join(artifactDir, DEV_EXTENSION_PUBLICATION_FILE);
  await requireRegularFile(publicationPath, 'DEV_EXTENSION_PUBLICATION_FILE_INVALID');
  const publication = await readJsonFile(publicationPath, 'DEV_EXTENSION_PUBLICATION_INVALID');
  if (publication?.contractVersion !== DEV_EXTENSION_PUBLICATION_VERSION
    || publication.artifactId !== 'dev_extension'
    || publication.buildId !== artifact.buildId
    || !SHA256.test(publication.inputDigest)) {
    throw createFailure('DEV_EXTENSION_PUBLICATION_CONTRACT_INVALID');
  }
  return publication;
}

async function artifactDigest(artifactDir) {
  const hash = crypto.createHash('sha256');
  await updateDigestFromPath(hash, artifactDir, '', { fileCount: 0 });
  return hash.digest('hex');
}

async function assertPublicationOwnerShape(paths) {
  await assertPlainDirectory(paths.rootDir, 'DEV_EXTENSION_ROOT_DIRECTORY_INVALID');
  for (const directory of [path.dirname(paths.ownerDir), paths.ownerDir,
    paths.stagingRoot, paths.latestPreviousDir]) {
    const entry = await readOptionalEntry(directory);
    if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) {
      throw createFailure('DEV_EXTENSION_OWNER_DIRECTORY_INVALID',
        `DEV_EXTENSION_OWNER_DIRECTORY_INVALID:${directory}`);
    }
  }
}

function isTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

async function readRealUsePinRecord(paths) {
  await assertPublicationOwnerShape(paths);
  const entry = await readOptionalEntry(paths.realUsePinPath);
  if (!entry) {
    if (await readOptionalEntry(paths.latestDir)) {
      throw createFailure('DEV_EXTENSION_REAL_USE_PIN_RECORD_MISSING');
    }
    return null;
  }
  await requireRegularFile(paths.realUsePinPath, 'DEV_EXTENSION_REAL_USE_PIN_FILE_INVALID');
  const record = await readJsonFile(paths.realUsePinPath, 'DEV_EXTENSION_REAL_USE_PIN_RECORD_INVALID');
  if (record?.contractVersion !== DEV_EXTENSION_REAL_USE_PIN_VERSION
    || record.consumerId !== 'real_use'
    || !['pinned', 'released'].includes(record.state)
    || !PIN_ID.test(record.pinId)
    || record.consumerDir !== paths.activeDir
    || record.latestDir !== paths.latestDir
    || typeof record.buildId !== 'string' || !record.buildId
    || !SHA256.test(record.inputDigest) || !SHA256.test(record.artifactDigest)
    || !isTimestamp(record.createdAt)
    || (record.state === 'released' && (!isTimestamp(record.releasedAt)
      || typeof record.promotedBuildId !== 'string' || !record.promotedBuildId
      || !SHA256.test(record.promotedInputDigest)))) {
    throw createFailure('DEV_EXTENSION_REAL_USE_PIN_RECORD_INVALID');
  }
  return record;
}

async function readRealUsePin(paths) {
  const record = await readRealUsePinRecord(paths);
  if (!record) return null;
  const latest = await readCompleteDevPublication(paths.latestDir);
  if (record.state === 'pinned') {
    const consumer = await readCompleteDevPublication(paths.activeDir);
    if (consumer.buildId !== record.buildId || consumer.inputDigest !== record.inputDigest
      || await artifactDigest(paths.activeDir) !== record.artifactDigest) {
      throw createFailure('DEV_EXTENSION_REAL_USE_PIN_CONSUMER_CHANGED');
    }
  } else if (latest.buildId !== record.promotedBuildId
    || latest.inputDigest !== record.promotedInputDigest) {
    throw createFailure('DEV_EXTENSION_REAL_USE_RELEASE_RECEIPT_MISMATCH');
  }
  return record;
}

async function renameDevExtensionPublication(from, to, rename = fs.rename) {
  const waits = process.platform === 'win32' ? [100, 500, 2000] : [];
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (error?.code !== 'EPERM' || attempt >= waits.length) throw error;
      console.error(JSON.stringify({ event: 'DEV_EXTENSION_PUBLICATION_RENAME_RETRY',
        from, to, attempt: attempt + 1, code: error.code, waitMs: waits[attempt] }));
      await new Promise(resolve => setTimeout(resolve, waits[attempt]));
    }
  }
}

// Called only with the publication lock held, before build preparation. A
// previous tree is rollback proof, never expendable when its active path is absent.
async function recoverInterruptedDevPublications(paths) {
  const pin = await readRealUsePinRecord(paths);
  const targets = [{ activeDir: paths.activeDir, previousDir: paths.previousDir }];
  if (pin) targets.push({ activeDir: paths.latestDir, previousDir: paths.latestPreviousDir });
  for (const { activeDir, previousDir } of targets) {
    if (await readOptionalEntry(activeDir) || !await readOptionalEntry(previousDir)) continue;
    try {
      const publication = await readCompleteDevPublication(previousDir);
      if (pin?.state === 'pinned' && activeDir === paths.activeDir
        && (publication.buildId !== pin.buildId || publication.inputDigest !== pin.inputDigest
          || await artifactDigest(previousDir) !== pin.artifactDigest)) {
        throw createFailure('DEV_EXTENSION_REAL_USE_PIN_CONSUMER_CHANGED');
      }
      if (pin?.state === 'released' && activeDir === paths.latestDir
        && (publication.buildId !== pin.promotedBuildId
          || publication.inputDigest !== pin.promotedInputDigest)) {
        throw createFailure('DEV_EXTENSION_REAL_USE_RELEASE_RECEIPT_MISMATCH');
      }
      await renameDevExtensionPublication(previousDir, activeDir);
      console.error(JSON.stringify({ event: 'DEV_EXTENSION_PUBLICATION_INTERRUPTED_PROMOTION_RECOVERED',
        activeDir, previousDir, buildId: publication.buildId }));
    } catch (cause) {
      const failure = createFailure('DEV_EXTENSION_ARTIFACT_INTERRUPTED_PROMOTION_RECOVERY_FAILED',
        'DEV_EXTENSION_ARTIFACT_INTERRUPTED_PROMOTION_RECOVERY_FAILED', cause);
      failure.recovery = Object.freeze({ activeDir, previousDir, previousArtifactPreserved: true });
      throw failure;
    }
  }
}

async function replaceRealUsePinRecord(paths, record) {
  const temporaryPath = path.join(paths.ownerDir, `real-use-pin.${crypto.randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temporaryPath, paths.realUsePinPath);
  } catch (error) {
    await fs.unlink(temporaryPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    throw error;
  }
}

function pinReceipt(paths, action, record) {
  return Object.freeze({ action, consumerId: 'real_use', state: record?.state || 'unpinned',
    consumerDir: paths.activeDir, latestDir: paths.latestDir, ...record,
    reloadRequired: action !== 'status' });
}

// Canonical default consumers resolve the one declared publication location.
// Explicit custom artifact paths keep their own configured authority.
export async function resolveDevExtensionArtifactSource(rootDir, configuredArtifactDir) {
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  const configured = requireAbsolutePath(configuredArtifactDir, 'DEV_EXTENSION_ARTIFACT_PATH_INVALID');
  if (configured !== paths.activeDir) return configured;
  const record = await readRealUsePin(paths);
  return record?.state === 'pinned' ? paths.latestDir : paths.activeDir;
}

export async function inspectDevExtensionRealUsePin(rootDir) {
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  return pinReceipt(paths, 'status', await readRealUsePin(paths));
}

async function stageCompletePublication(paths, sourceDir, prefix) {
  await fs.mkdir(paths.stagingRoot, { recursive: true });
  const stagingDir = await fs.mkdtemp(path.join(paths.stagingRoot, prefix));
  try {
    await fs.cp(sourceDir, stagingDir, { recursive: true, dereference: false });
    await readCompleteDevPublication(stagingDir);
    if (await artifactDigest(sourceDir) !== await artifactDigest(stagingDir)) {
      throw createFailure('DEV_EXTENSION_REAL_USE_PIN_COPY_MISMATCH');
    }
    return stagingDir;
  } catch (error) {
    assertPathInside(paths.stagingRoot, stagingDir, 'DEV_EXTENSION_STAGING_CLEANUP_PATH_INVALID');
    await fs.rm(stagingDir, { recursive: true, force: false });
    throw error;
  }
}

export async function pinDevExtensionForRealUse(rootDir) {
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  return withDevExtensionPublicationLock(rootDir, async () => {
    const existing = await readRealUsePin(paths);
    if (existing?.state === 'pinned') throw createFailure('DEV_EXTENSION_REAL_USE_PIN_ALREADY_ACTIVE');
    const publication = await readCompleteDevPublication(paths.activeDir);
    const record = { contractVersion: DEV_EXTENSION_REAL_USE_PIN_VERSION, consumerId: 'real_use',
      state: 'pinned', pinId: crypto.randomUUID(), consumerDir: paths.activeDir,
      latestDir: paths.latestDir, buildId: publication.buildId, inputDigest: publication.inputDigest,
      artifactDigest: await artifactDigest(paths.activeDir), createdAt: new Date().toISOString() };
    if (await readOptionalEntry(paths.latestDir)) {
      const latest = await readCompleteDevPublication(paths.latestDir);
      // A released consumer may already be the exact latest publication. Pin
      // only the receipt when both provenance and every artifact byte agree.
      if (latest.buildId === publication.buildId && latest.inputDigest === publication.inputDigest
        && await artifactDigest(paths.latestDir) === record.artifactDigest) {
        await replaceRealUsePinRecord(paths, record);
        return pinReceipt(paths, 'pin', record);
      }
    }
    const stagingDir = await stageCompletePublication(paths, paths.activeDir, 'real-use-pin-');
    try {
      await publishDevExtensionArtifactTransaction({ activeDir: paths.latestDir, stagingDir,
        previousDir: paths.latestPreviousDir,
        commitPublication: () => replaceRealUsePinRecord(paths, record) });
      return pinReceipt(paths, 'pin', record);
    } finally {
      if (await readOptionalEntry(stagingDir)) {
        assertPathInside(paths.stagingRoot, stagingDir, 'DEV_EXTENSION_STAGING_CLEANUP_PATH_INVALID');
        await fs.rm(stagingDir, { recursive: true, force: false });
      }
    }
  });
}

export async function releaseDevExtensionRealUsePin(rootDir, { pinId } = {}) {
  if (!PIN_ID.test(pinId)) throw createFailure('DEV_EXTENSION_REAL_USE_PIN_ID_REQUIRED');
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  return withDevExtensionPublicationLock(rootDir, async () => {
    const record = await readRealUsePin(paths);
    if (!record || record.state !== 'pinned') throw createFailure('DEV_EXTENSION_REAL_USE_PIN_NOT_ACTIVE');
    if (record.pinId !== pinId) throw createFailure('DEV_EXTENSION_REAL_USE_PIN_ID_MISMATCH');
    const latest = await readCompleteDevPublication(paths.latestDir);
    const released = { ...record, state: 'released', releasedAt: new Date().toISOString(),
      promotedBuildId: latest.buildId, promotedInputDigest: latest.inputDigest };
    const stagingDir = await stageCompletePublication(paths, paths.latestDir, 'real-use-release-');
    try {
      await publishDevExtensionArtifactTransaction({ activeDir: paths.activeDir, stagingDir,
        previousDir: paths.previousDir,
        commitPublication: () => replaceRealUsePinRecord(paths, released) });
      return pinReceipt(paths, 'release', released);
    } finally {
      if (await readOptionalEntry(stagingDir)) {
        assertPathInside(paths.stagingRoot, stagingDir, 'DEV_EXTENSION_STAGING_CLEANUP_PATH_INVALID');
        await fs.rm(stagingDir, { recursive: true, force: false });
      }
    }
  });
}

export async function publishDevExtensionArtifactTransaction({
  activeDir,
  stagingDir,
  previousDir,
  commitPublication = async () => {},
} = {}, {
  rename = fs.rename,
  remove = fs.rm,
  lstat = fs.lstat,
} = {}) {
  const canonicalActiveDir = requireAbsolutePath(
    activeDir,
    'DEV_EXTENSION_PUBLISH_ACTIVE_PATH_INVALID',
  );
  const canonicalStagingDir = requireAbsolutePath(
    stagingDir,
    'DEV_EXTENSION_PUBLISH_STAGING_PATH_INVALID',
  );
  const canonicalPreviousDir = requireAbsolutePath(
    previousDir,
    'DEV_EXTENSION_PUBLISH_PREVIOUS_PATH_INVALID',
  );
  if (new Set([canonicalActiveDir, canonicalStagingDir, canonicalPreviousDir]).size !== 3) {
    throw createFailure('DEV_EXTENSION_PUBLISH_PATHS_NOT_DISTINCT');
  }
  if (typeof commitPublication !== 'function') {
    throw createFailure('DEV_EXTENSION_PUBLISH_COMMIT_INVALID');
  }

  const statOrNull = async (targetPath) => {
    try {
      return await lstat(targetPath);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };
  const stagingEntry = await statOrNull(canonicalStagingDir);
  if (!stagingEntry?.isDirectory() || stagingEntry.isSymbolicLink()) {
    throw createFailure('DEV_EXTENSION_PUBLISH_STAGING_DIRECTORY_INVALID');
  }
  const activeEntry = await statOrNull(canonicalActiveDir);
  if (activeEntry && (!activeEntry.isDirectory() || activeEntry.isSymbolicLink())) {
    throw createFailure('DEV_EXTENSION_PUBLISH_ACTIVE_DIRECTORY_INVALID');
  }
  const previousEntry = await statOrNull(canonicalPreviousDir);
  if (previousEntry?.isSymbolicLink()) {
    throw createFailure('DEV_EXTENSION_PUBLISH_PREVIOUS_SYMLINK_FORBIDDEN');
  }
  if (!activeEntry && previousEntry) {
    throw createFailure('DEV_EXTENSION_PUBLISH_RECOVERY_REQUIRED');
  }
  if (previousEntry) {
    await remove(canonicalPreviousDir, { recursive: true, force: false });
  }

  let retired = false;
  let promoted = false;
  const renamePublication = (from, to) => renameDevExtensionPublication(from, to, rename);
  try {
    if (activeEntry) {
      await renamePublication(canonicalActiveDir, canonicalPreviousDir);
      retired = true;
    }
    await renamePublication(canonicalStagingDir, canonicalActiveDir);
    promoted = true;
    // The real-use receipt and artifact promotion commit together. A failed
    // receipt replacement leaves the old record and rolls back the exact tree.
    await commitPublication();
  } catch (cause) {
    const publishFailure = createFailure(
      'DEV_EXTENSION_ARTIFACT_PUBLISH_FAILED',
      'DEV_EXTENSION_ARTIFACT_PUBLISH_FAILED',
      cause,
    );
    if (!retired && !promoted) throw publishFailure;
    try {
      if (promoted) await renamePublication(canonicalActiveDir, canonicalStagingDir);
      if (retired) await renamePublication(canonicalPreviousDir, canonicalActiveDir);
    } catch (rollbackCause) {
      const rollbackFailure = createFailure(
        'DEV_EXTENSION_ARTIFACT_ROLLBACK_FAILED',
        'DEV_EXTENSION_ARTIFACT_ROLLBACK_FAILED',
        rollbackCause,
      );
      const aggregate = new AggregateError(
        [publishFailure, rollbackFailure],
        'DEV_EXTENSION_ARTIFACT_TRANSACTION_RECOVERY_FAILED',
      );
      aggregate.code = 'DEV_EXTENSION_ARTIFACT_TRANSACTION_RECOVERY_FAILED';
      aggregate.recovery = Object.freeze({
        activeDir: canonicalActiveDir,
        previousDir: canonicalPreviousDir,
        previousArtifactPreserved: retired,
      });
      throw aggregate;
    }
    throw publishFailure;
  }
  return Object.freeze({
    status: 'published',
    previousArtifactPreserved: Boolean(activeEntry),
  });
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
}

async function acquirePublicationLock(lockPath, { timeoutMs = 180_000 } = {}) {
  const openLock = async () => {
    const temporaryPath = `${lockPath}.${crypto.randomUUID()}.tmp`;
    const handle = await fs.open(temporaryPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
      // Exclusive hard-link publication exposes complete owner metadata at once.
      await fs.link(temporaryPath, lockPath);
      return handle;
    } catch (error) {
      await handle.close();
      throw error;
    } finally { await fs.unlink(temporaryPath); }
  };
  const deadline = Date.now() + timeoutMs;
  const readLockOwner = async () => {
    try {
      const raw = await fs.readFile(lockPath, 'utf8');
      const record = JSON.parse(raw);
      if (!Number.isSafeInteger(record?.pid) || record.pid <= 0
        || typeof record.createdAt !== 'string') throw createFailure('DEV_EXTENSION_BUILD_LOCK_INVALID');
      return { raw, record };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };
  while (true) {
    try { return await openLock(); } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const existing = await readLockOwner();
    if (existing && !isProcessAlive(existing.record.pid)) {
      // Normal release/exit can invalidate the owner snapshot before PID
      // inspection. Retry the same exclusive acquisition without deleting it.
      try { return await openLock(); } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
      const current = await readLockOwner();
      if (current && current.raw === existing.raw && !isProcessAlive(current.record.pid)) {
        // Only the unchanged dead owner's record proves abandonment. Changed
        // successor records use the ordinary bounded wait and remain untouched.
        throw createFailure('DEV_EXTENSION_PUBLICATION_LOCK_ABANDONED',
          `DEV_EXTENSION_PUBLICATION_LOCK_ABANDONED:${lockPath}:pid=${current.record.pid}`);
      }
    }
    if (Date.now() >= deadline) throw createFailure('DEV_EXTENSION_PUBLICATION_LOCK_TIMEOUT');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function withDevExtensionPublicationLock(rootDir, work) {
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  await assertPublicationOwnerShape(paths);
  await fs.mkdir(paths.ownerDir, { recursive: true });
  const handle = await acquirePublicationLock(paths.lockPath);
  try { return await work(); } finally {
    await handle.close();
    await fs.unlink(paths.lockPath);
  }
}

export async function buildAndPublishDevExtension({
  rootDir,
  prepareBuild = async () => {},
  runBuild,
  captureInputs = captureDevExtensionBuildInputs,
} = {}) {
  if (typeof prepareBuild !== 'function' || typeof runBuild !== 'function') {
    throw createFailure('DEV_EXTENSION_BUILD_OPERATIONS_INVALID');
  }
  const paths = resolveDevExtensionPublicationPaths(rootDir);
  assertPathInside(paths.rootDir, paths.ownerDir, 'DEV_EXTENSION_OWNER_PATH_INVALID');
  await assertPublicationOwnerShape(paths);
  await fs.mkdir(paths.stagingRoot, { recursive: true });
  const lockHandle = await acquirePublicationLock(paths.lockPath);
  let stagingDir = '';
  let inputs = null;
  try {
    await recoverInterruptedDevPublications(paths);
    const activeDir = await resolveDevExtensionArtifactSource(paths.rootDir, paths.activeDir);
    const previousDir = activeDir === paths.latestDir ? paths.latestPreviousDir : paths.previousDir;
    await prepareBuild();
    inputs = await captureInputs(paths.rootDir);
    stagingDir = await fs.mkdtemp(path.join(paths.stagingRoot, 'build-'));
    const [ownerDevice, activeParentDevice] = await Promise.all([
      fs.stat(paths.ownerDir).then((entry) => entry.dev),
      fs.stat(paths.rootDir).then((entry) => entry.dev),
    ]);
    if (ownerDevice !== activeParentDevice) {
      throw createFailure('DEV_EXTENSION_PUBLISH_FILESYSTEM_MISMATCH');
    }

    await runBuild({ stagingDir, buildRoot: inputs.rootDir, inputDigestBefore: inputs.inputDigest });
    const artifact = await assertDevExtensionArtifact(stagingDir);
    // Provenance travels atomically with the artifact, regardless of whether
    // the build was requested by npm, watch, or QA. QA owns no parallel cache.
    await fs.writeFile(path.join(stagingDir, DEV_EXTENSION_PUBLICATION_FILE), `${JSON.stringify({
      contractVersion: DEV_EXTENSION_PUBLICATION_VERSION,
      artifactId: 'dev_extension',
      buildId: artifact.buildId,
      inputDigest: inputs.inputDigest,
    }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    const publication = await publishDevExtensionArtifactTransaction({
      activeDir,
      stagingDir,
      previousDir,
    });
    stagingDir = '';
    return Object.freeze({
      ...publication,
      buildId: artifact.buildId,
      activeDir,
      previousDir: publication.previousArtifactPreserved ? previousDir : null,
      inputDigest: inputs.inputDigest,
    });
  } finally {
    try {
      if (inputs) await inputs.release();
      if (stagingDir) {
        const canonicalStagingDir = path.normalize(stagingDir);
        assertPathInside(
          paths.stagingRoot,
          canonicalStagingDir,
          'DEV_EXTENSION_STAGING_CLEANUP_PATH_INVALID',
        );
        await fs.rm(canonicalStagingDir, { recursive: true, force: true });
      }
    } finally {
      await lockHandle.close();
      await fs.unlink(paths.lockPath).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
      });
    }
  }
}
