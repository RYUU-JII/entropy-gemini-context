import { PREPAINT_VISUAL_STYLES } from '../../src/domains/protection/content/prepaintVisualAssets.js';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isArtifactBuildEvidenceDirectory } from './artifactEvidenceBoundary.mjs';

const modulePath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(modulePath), '../..');
const DEFAULT_DIST_DIR = path.resolve(rootDir, 'dist-prod');
const DEFAULT_PROVENANCE_LEDGER_PATH = path.resolve(
  rootDir,
  'docs/operations/release-asset-provenance.json',
);
const MANIFEST_FILE = 'manifest.json';
const BUILD_INFO_FILE = 'entropy-build-info.json';
const VITE_MANIFEST_FILE = '.vite/manifest.json';
const VITE_MODULE_INVENTORY_FILE = '.vite/entropy-module-inventory.json';
const VITE_WORKER_INVENTORY_DIRECTORY = '.vite/entropy-worker-module-inventory';
const MAX_ZIP_FILE_COUNT = 0xffff;
const MAX_ZIP_FILE_SIZE = 0xffffffff;

const ALLOWED_TOP_LEVEL_FILES = new Set([
  BUILD_INFO_FILE,
  MANIFEST_FILE,
  'THIRD_PARTY_NOTICES.txt',
  'service-worker-loader.js',
]);

const ALLOWED_TOP_LEVEL_DIRECTORIES = new Set([
  '_locales',
  'assets',
  'chunks',
  'icons',
  'src',
]);

const REVIEWED_ARTIFACT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mp3',
  '.png',
  '.woff2',
]);

const DOCUMENT_EXTENSION_PATTERN = /\.(?:adoc|markdown|md|rst)$/iu;
const DOCUMENT_BASENAME_PATTERN = /^(?:changelog|code_of_conduct|contributing|license|readme|security)(?:\.|$)/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const REVIEWED_PUBLIC_RUNTIME_PATHS = new Set([
  ...PREPAINT_VISUAL_STYLES.map(({ path }) => path),
  'THIRD_PARTY_NOTICES.txt',
]);
const REVIEWED_SOURCE_WAR_PATTERNS = new Set([
  'src/apps/content/*.js',
]);

function fail(code, detail = '') {
  const suffix = detail ? `:${detail}` : '';
  throw new Error(`${code}${suffix}`);
}

function compareArtifactPaths(left, right) {
  return Buffer.compare(Buffer.from(String(left), 'utf8'), Buffer.from(String(right), 'utf8'));
}

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeArtifactPath(value) {
  if (typeof value !== 'string' || !value) {
    fail('CWS_RC_ARCHIVE_PATH_INVALID', String(value || ''));
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    fail('CWS_RC_ARCHIVE_PATH_CONTROL_CHARACTER', JSON.stringify(value));
  }
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '');
  if (
    !normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:\//u.test(normalized)
  ) {
    fail('CWS_RC_ARCHIVE_PATH_INVALID', normalized);
  }
  const segments = normalized.split('/');
  if (
    segments.some((segment) => (
      !segment
      || segment === '.'
      || segment === '..'
      || /[. ]$/u.test(segment)
    ))
  ) {
    fail('CWS_RC_ARCHIVE_PATH_INVALID', normalized);
  }
  return normalized;
}

export function assertAllowedArtifactPath(value) {
  const normalized = normalizeArtifactPath(value);
  const segments = normalized.split('/');
  const [topLevel] = segments;
  const isAllowedFile = segments.length === 1 && ALLOWED_TOP_LEVEL_FILES.has(normalized);
  const isAllowedDirectoryEntry = segments.length > 1
    && ALLOWED_TOP_LEVEL_DIRECTORIES.has(topLevel);
  if (!isAllowedFile && !isAllowedDirectoryEntry) {
    fail('CWS_RC_ARTIFACT_PATH_NOT_ALLOWLISTED', normalized);
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    fail('CWS_RC_ARTIFACT_HIDDEN_PATH_FORBIDDEN', normalized);
  }
  if (/\.map$/iu.test(normalized)) {
    fail('CWS_RC_ARTIFACT_SOURCE_MAP_FORBIDDEN', normalized);
  }
  const basename = segments.at(-1);
  if (
    normalized !== 'THIRD_PARTY_NOTICES.txt'
    && (
      DOCUMENT_EXTENSION_PATTERN.test(basename)
      || DOCUMENT_BASENAME_PATTERN.test(basename)
    )
  ) {
    fail('CWS_RC_ARTIFACT_DOCUMENT_FORBIDDEN', normalized);
  }
  if (
    normalized !== 'THIRD_PARTY_NOTICES.txt'
    && !REVIEWED_ARTIFACT_EXTENSIONS.has(path.posix.extname(basename).toLowerCase())
  ) {
    fail('CWS_RC_ARTIFACT_EXTENSION_UNREVIEWED', normalized);
  }
  return normalized;
}

export function assertNoArtifactPathCollisions(values) {
  if (!Array.isArray(values)) fail('CWS_RC_ARTIFACT_PATHS_INVALID');
  const seenPrefixes = new Map();
  const seenFiles = new Set();
  for (const value of values) {
    const normalized = normalizeArtifactPath(value);
    const segments = normalized.split('/');
    for (let index = 0; index < segments.length; index += 1) {
      const prefix = segments.slice(0, index + 1).join('/');
      const foldedPrefix = prefix.normalize('NFC').toLowerCase();
      const previous = seenPrefixes.get(foldedPrefix);
      if (previous && previous !== prefix) {
        fail('CWS_RC_ARTIFACT_CASE_COLLISION', `${previous}:${prefix}`);
      }
      seenPrefixes.set(foldedPrefix, prefix);
    }
    const foldedFile = normalized.normalize('NFC').toLowerCase();
    if (seenFiles.has(foldedFile)) {
      fail('CWS_RC_ARTIFACT_DUPLICATE_PATH', normalized);
    }
    seenFiles.add(foldedFile);
  }
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

async function pathType(filePath) {
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink()) return 'symlink';
    if (stat.isFile()) return 'file';
    if (stat.isDirectory()) return 'directory';
    return 'other';
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing';
    throw error;
  }
}

async function walkFiles(currentDir, root, {
  files,
  skipViteDirectory = false,
  symlinkErrorCode,
} = {}) {
  let dirEntries;
  try {
    dirEntries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    fail('CWS_RC_ARTIFACT_DIRECTORY_READ_FAILED', `${currentDir}:${error?.message || error}`);
  }
  dirEntries.sort((left, right) => compareArtifactPaths(left.name, right.name));
  for (const entry of dirEntries) {
    const absolutePath = path.resolve(currentDir, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join('/');
    if (entry.isSymbolicLink()) fail(symlinkErrorCode, relativePath);
    if (entry.isDirectory()) {
      if (skipViteDirectory && isArtifactBuildEvidenceDirectory(relativePath)) continue;
      await walkFiles(absolutePath, root, {
        files,
        skipViteDirectory,
        symlinkErrorCode,
      });
      continue;
    }
    if (!entry.isFile()) fail('CWS_RC_ARTIFACT_ENTRY_TYPE_INVALID', relativePath);
    files.push(Object.freeze({ absolutePath, relativePath }));
  }
}

async function collectPublicSourcePaths(repoRoot) {
  const publicDir = path.resolve(repoRoot, 'public');
  const type = await pathType(publicDir);
  if (type === 'missing') return new Set();
  if (type !== 'directory') fail('CWS_RC_PUBLIC_DIRECTORY_INVALID', publicDir);
  const files = [];
  await walkFiles(publicDir, publicDir, {
    files,
    symlinkErrorCode: 'CWS_RC_PUBLIC_ASSET_SYMLINK_FORBIDDEN',
  });
  return new Set(files.map(({ relativePath }) => normalizeArtifactPath(relativePath)));
}

function addAuthorizedPath(authorizedPaths, candidate) {
  if (typeof candidate !== 'string' || !candidate || candidate.includes('*')) return;
  authorizedPaths.add(assertAllowedArtifactPath(candidate));
}

function addManifestPathValues(authorizedPaths, value) {
  if (typeof value === 'string') {
    addAuthorizedPath(authorizedPaths, value);
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  for (const candidate of Object.values(value)) {
    if (typeof candidate === 'string') addAuthorizedPath(authorizedPaths, candidate);
  }
}

function collectManifestOwnedPaths(builtManifest) {
  const ownedPaths = new Set();
  addManifestPathValues(ownedPaths, builtManifest?.background?.service_worker);
  addManifestPathValues(ownedPaths, builtManifest?.action?.default_popup);
  addManifestPathValues(ownedPaths, builtManifest?.action?.default_icon);
  addManifestPathValues(ownedPaths, builtManifest?.options_ui?.page);
  addManifestPathValues(ownedPaths, builtManifest?.side_panel?.default_path);
  addManifestPathValues(ownedPaths, builtManifest?.devtools_page);
  addManifestPathValues(ownedPaths, builtManifest?.icons);
  addManifestPathValues(ownedPaths, builtManifest?.chrome_url_overrides);
  for (const contentScript of builtManifest?.content_scripts || []) {
    for (const candidate of [...(contentScript?.js || []), ...(contentScript?.css || [])]) {
      addAuthorizedPath(ownedPaths, candidate);
    }
  }
  for (const resourceGroup of builtManifest?.web_accessible_resources || []) {
    for (const candidate of resourceGroup?.resources || []) {
      if (!String(candidate).includes('*')) addAuthorizedPath(ownedPaths, candidate);
    }
  }
  return ownedPaths;
}

function addViteManifestRecordPaths(authorizedPaths, viteManifest) {
  if (!viteManifest || typeof viteManifest !== 'object' || Array.isArray(viteManifest)) {
    fail('CWS_RC_VITE_MANIFEST_INVALID');
  }
  for (const record of Object.values(viteManifest)) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      fail('CWS_RC_VITE_MANIFEST_INVALID');
    }
    addAuthorizedPath(authorizedPaths, record.file);
    for (const candidate of [...(record.css || []), ...(record.assets || [])]) {
      addAuthorizedPath(authorizedPaths, candidate);
    }
  }
}

function addModuleInventoryPaths(authorizedPaths, inventory) {
  if (
    inventory?.schemaVersion !== 1
    || !inventory.chunks
    || typeof inventory.chunks !== 'object'
    || Array.isArray(inventory.chunks)
  ) {
    fail('CWS_RC_VITE_MODULE_INVENTORY_INVALID');
  }
  for (const candidate of Object.keys(inventory.chunks)) {
    addAuthorizedPath(authorizedPaths, candidate);
  }
}

function addWorkerInventoryPaths(authorizedPaths, inventory, inventoryPath) {
  if (
    inventory?.schemaVersion !== 2
    || typeof inventory.entryFile !== 'string'
    || !inventory.chunks
    || typeof inventory.chunks !== 'object'
    || Array.isArray(inventory.chunks)
  ) {
    fail('CWS_RC_VITE_WORKER_INVENTORY_INVALID', inventoryPath);
  }
  addAuthorizedPath(authorizedPaths, inventory.entryFile);
  for (const [candidate, chunk] of Object.entries(inventory.chunks)) {
    addAuthorizedPath(authorizedPaths, candidate);
    for (const dependency of [...(chunk?.imports || []), ...(chunk?.dynamicImports || [])]) {
      addAuthorizedPath(authorizedPaths, dependency);
    }
  }
}

async function addWorkerInventories(authorizedPaths, distDir) {
  const workerInventoryDir = path.resolve(distDir, VITE_WORKER_INVENTORY_DIRECTORY);
  const type = await pathType(workerInventoryDir);
  if (type === 'missing') return;
  if (type !== 'directory') {
    fail('CWS_RC_VITE_WORKER_INVENTORY_DIRECTORY_INVALID', workerInventoryDir);
  }
  const entries = await fs.readdir(workerInventoryDir, { withFileTypes: true });
  entries.sort((left, right) => compareArtifactPaths(left.name, right.name));
  for (const entry of entries) {
    const inventoryPath = path.resolve(workerInventoryDir, entry.name);
    if (entry.isSymbolicLink()) {
      fail('CWS_RC_VITE_WORKER_INVENTORY_SYMLINK_FORBIDDEN', entry.name);
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      fail('CWS_RC_VITE_WORKER_INVENTORY_ENTRY_INVALID', entry.name);
    }
    const inventory = await readJson(inventoryPath, 'CWS_RC_VITE_WORKER_INVENTORY_READ_FAILED');
    addWorkerInventoryPaths(authorizedPaths, inventory, inventoryPath);
  }
}

async function addExistingViteSourcePaths(authorizedPaths, viteManifest, distDir) {
  for (const [manifestKey, record] of Object.entries(viteManifest)) {
    const candidates = [manifestKey, record?.src];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || candidate.includes('*')) continue;
      let normalized;
      try {
        normalized = assertAllowedArtifactPath(candidate);
      } catch {
        continue;
      }
      if (await pathType(path.resolve(distDir, ...normalized.split('/'))) === 'file') {
        authorizedPaths.add(normalized);
      }
    }
  }
}

async function addReviewedSourceWarPaths(authorizedPaths, repoRoot, builtManifest) {
  const declaredResources = new Set(
    (builtManifest?.web_accessible_resources || [])
      .flatMap((resourceGroup) => resourceGroup?.resources || []),
  );
  for (const reviewedPattern of REVIEWED_SOURCE_WAR_PATTERNS) {
    if (!declaredResources.has(reviewedPattern)) continue;
    const directoryPath = reviewedPattern.slice(0, reviewedPattern.lastIndexOf('/'));
    const extension = reviewedPattern.slice(reviewedPattern.lastIndexOf('.')).toLowerCase();
    const absoluteDirectory = path.resolve(repoRoot, directoryPath);
    if (await pathType(absoluteDirectory) !== 'directory') {
      fail('CWS_RC_REVIEWED_SOURCE_DIRECTORY_MISSING', directoryPath);
    }
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        fail('CWS_RC_REVIEWED_SOURCE_SYMLINK_FORBIDDEN', `${directoryPath}/${entry.name}`);
      }
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) {
        addAuthorizedPath(authorizedPaths, `${directoryPath}/${entry.name}`);
      }
    }
  }
}

async function readRegisteredPublicPaths({
  repoRoot,
  provenanceLedgerPath,
  manifestOwnedPaths,
}) {
  const publicPaths = new Set(REVIEWED_PUBLIC_RUNTIME_PATHS);
  const ledger = await readJson(
    provenanceLedgerPath,
    'CWS_RC_PUBLIC_ASSET_PROVENANCE_READ_FAILED',
  );
  if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.families)) {
    fail('CWS_RC_PUBLIC_ASSET_PROVENANCE_INVALID', provenanceLedgerPath);
  }
  for (const family of ledger.families) {
    if (!Array.isArray(family?.files)) {
      fail('CWS_RC_PUBLIC_ASSET_PROVENANCE_INVALID', String(family?.id || 'unknown'));
    }
    for (const file of family.files) {
      if (typeof file?.path !== 'string' || !file.path.startsWith('public/')) continue;
      const archivePath = normalizeArtifactPath(file.path.slice('public/'.length));
      publicPaths.add(assertAllowedArtifactPath(archivePath));
    }
  }
  const actualPublicPaths = await collectPublicSourcePaths(repoRoot);
  for (const archivePath of manifestOwnedPaths) {
    if (actualPublicPaths.has(archivePath)) publicPaths.add(archivePath);
  }
  for (const archivePath of actualPublicPaths) {
    if (/^_locales\/[A-Za-z0-9_-]+\/messages\.json$/u.test(archivePath)) {
      publicPaths.add(assertAllowedArtifactPath(archivePath));
    }
  }
  return Object.freeze({ actualPublicPaths, registeredPublicPaths: publicPaths });
}

async function createExactBuildInventory({ distDir, repoRoot, builtManifest }) {
  const [viteManifest, moduleInventory] = await Promise.all([
    readJson(path.resolve(distDir, VITE_MANIFEST_FILE), 'CWS_RC_VITE_MANIFEST_READ_FAILED'),
    readJson(
      path.resolve(distDir, VITE_MODULE_INVENTORY_FILE),
      'CWS_RC_VITE_MODULE_INVENTORY_READ_FAILED',
    ),
  ]);
  const authorizedPaths = new Set(ALLOWED_TOP_LEVEL_FILES);
  addViteManifestRecordPaths(authorizedPaths, viteManifest);
  addModuleInventoryPaths(authorizedPaths, moduleInventory);
  await addWorkerInventories(authorizedPaths, distDir);
  await addExistingViteSourcePaths(authorizedPaths, viteManifest, distDir);
  await addReviewedSourceWarPaths(authorizedPaths, repoRoot, builtManifest);
  for (const candidate of collectManifestOwnedPaths(builtManifest)) {
    authorizedPaths.add(candidate);
  }
  return authorizedPaths;
}

export async function collectArtifactEntries(distDir = DEFAULT_DIST_DIR, options = {}) {
  const resolvedDistDir = path.resolve(distDir);
  const repoRoot = path.resolve(options.repoRoot || rootDir);
  const provenanceLedgerPath = path.resolve(
    options.provenanceLedgerPath || (
      repoRoot === rootDir
        ? DEFAULT_PROVENANCE_LEDGER_PATH
        : path.resolve(repoRoot, 'docs/operations/release-asset-provenance.json')
    ),
  );
  const requireBuildInventory = options.requireBuildInventory
    ?? (resolvedDistDir === DEFAULT_DIST_DIR);
  const builtManifest = await readJson(
    path.resolve(resolvedDistDir, MANIFEST_FILE),
    'CWS_RC_BUILT_MANIFEST_READ_FAILED',
  );
  const manifestOwnedPaths = collectManifestOwnedPaths(builtManifest);
  const viteInventoryType = await pathType(path.resolve(resolvedDistDir, VITE_MODULE_INVENTORY_FILE));
  if (requireBuildInventory && viteInventoryType !== 'file') {
    fail('CWS_RC_VITE_MODULE_INVENTORY_REQUIRED', VITE_MODULE_INVENTORY_FILE);
  }
  const exactBuildInventory = viteInventoryType === 'file'
    ? await createExactBuildInventory({ distDir: resolvedDistDir, repoRoot, builtManifest })
    : null;
  const {
    actualPublicPaths,
    registeredPublicPaths,
  } = await readRegisteredPublicPaths({
    repoRoot,
    provenanceLedgerPath,
    manifestOwnedPaths,
  });
  if (exactBuildInventory) {
    for (const candidate of registeredPublicPaths) exactBuildInventory.add(candidate);
  }

  const files = [];
  await walkFiles(resolvedDistDir, resolvedDistDir, {
    files,
    skipViteDirectory: true,
    symlinkErrorCode: 'CWS_RC_ARTIFACT_SYMLINK_FORBIDDEN',
  });
  const archivePaths = files.map(({ relativePath }) => assertAllowedArtifactPath(relativePath));
  assertNoArtifactPathCollisions(archivePaths);

  const entries = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const archivePath = archivePaths[index];
    if (actualPublicPaths.has(archivePath) && !registeredPublicPaths.has(archivePath)) {
      fail('CWS_RC_PUBLIC_ASSET_UNREGISTERED', archivePath);
    }
    if (exactBuildInventory && !exactBuildInventory.has(archivePath)) {
      fail('CWS_RC_ARTIFACT_NOT_IN_BUILD_INVENTORY', archivePath);
    }
    const data = await fs.readFile(file.absolutePath);
    if (data.length > MAX_ZIP_FILE_SIZE) fail('CWS_RC_ARTIFACT_FILE_TOO_LARGE', archivePath);
    entries.push(Object.freeze({
      archivePath,
      data,
      sha256: sha256Buffer(data),
      size: data.length,
    }));
  }

  entries.sort((left, right) => compareArtifactPaths(left.archivePath, right.archivePath));
  if (entries.length === 0) fail('CWS_RC_ARTIFACT_EMPTY');
  if (entries.length > MAX_ZIP_FILE_COUNT) {
    fail('CWS_RC_ARTIFACT_FILE_COUNT_TOO_LARGE', entries.length);
  }
  for (const requiredFile of [MANIFEST_FILE, BUILD_INFO_FILE, 'THIRD_PARTY_NOTICES.txt']) {
    if (!entries.some((entry) => entry.archivePath === requiredFile)) {
      fail('CWS_RC_ARTIFACT_REQUIRED_FILE_MISSING', requiredFile);
    }
  }
  return entries;
}
