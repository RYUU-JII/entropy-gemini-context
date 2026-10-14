#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const ledgerPath = path.resolve(rootDir, 'docs/operations/release-asset-provenance.json');
const packageJsonPath = path.resolve(rootDir, 'package.json');
const trackedAssetRoots = Object.freeze([
  path.resolve(rootDir, 'public'),
  path.resolve(rootDir, 'src'),
]);
const SEPARATELY_GUARDED_ASSETS = new Map([
  [
    'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/assets/generated/zen-pond-benthic-detail.png',
    'check:zen:pond-static-assets',
  ],
  [
    'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/assets/generated/zen-pond-benthic-primary.png',
    'check:zen:pond-static-assets',
  ],
  [
    'src/themes/plugins/zen/widgets/core/research/reference/sakura-bonsai.jpg',
    'public research-module artifact guards',
  ],
]);
const TRACKED_EXTENSIONS = new Set([
  '.gif',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.otf',
  '.png',
  '.svg',
  '.ttf',
  '.wav',
  '.webp',
  '.woff',
  '.woff2',
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const failures = [];

function toRepoPath(value) {
  return path.relative(rootDir, value).split(path.sep).join('/');
}

function addFailure(code, detail = '') {
  failures.push(detail ? `${code}:${detail}` : code);
}

async function readJson(filePath, code) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    addFailure(code, `${toRepoPath(filePath)}:${error?.message || error}`);
    return null;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkTrackedAssets(dirPath, files = []) {
  if (!(await pathExists(dirPath))) return files;
  const stat = await fs.stat(dirPath);
  if (stat.isFile()) {
    if (TRACKED_EXTENSIONS.has(path.extname(dirPath).toLowerCase())) {
      files.push(toRepoPath(dirPath));
    }
    return files;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkTrackedAssets(absolutePath, files);
    } else if (entry.isFile() && TRACKED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(toRepoPath(absolutePath));
    }
  }
  return files;
}

async function sha256Path(repoPath) {
  const data = await fs.readFile(path.resolve(rootDir, repoPath));
  return createHash('sha256').update(data).digest('hex');
}

function requireNonEmptyString(value, code, detail) {
  if (typeof value !== 'string' || !value.trim()) addFailure(code, detail);
}

async function validateFamily(family, ledgerFiles, packageJson) {
  const id = typeof family?.id === 'string' && family.id.trim() ? family.id.trim() : '<missing-id>';
  requireNonEmptyString(family?.id, 'ASSET_PROVENANCE_FAMILY_ID_REQUIRED', id);
  requireNonEmptyString(family?.kind, 'ASSET_PROVENANCE_KIND_REQUIRED', id);
  if (!Array.isArray(family?.files)) {
    addFailure('ASSET_PROVENANCE_FILES_INVALID', id);
    return;
  }

  if (family.status !== 'verified') {
    addFailure('ASSET_PROVENANCE_RELEASE_REVIEW_REQUIRED', `${id}:${family.status || 'missing'}`);
  } else {
    requireNonEmptyString(family.rightsBasis, 'ASSET_PROVENANCE_RIGHTS_BASIS_REQUIRED', id);
    requireNonEmptyString(family.license, 'ASSET_PROVENANCE_LICENSE_REQUIRED', id);
    if (family.origin === 'first-party') {
      requireNonEmptyString(
        family.sourcePath,
        'ASSET_PROVENANCE_FIRST_PARTY_SOURCE_PATH_REQUIRED',
        id,
      );
      requireNonEmptyString(
        family.sourceCommit,
        'ASSET_PROVENANCE_FIRST_PARTY_SOURCE_COMMIT_REQUIRED',
        id,
      );
      if (
        typeof family.sourceCommit === 'string'
        && family.sourceCommit.trim()
        && !GIT_COMMIT_PATTERN.test(family.sourceCommit.trim())
      ) {
        addFailure('ASSET_PROVENANCE_FIRST_PARTY_SOURCE_COMMIT_INVALID', id);
      }
      if (
        typeof family.sourcePath === 'string'
        && family.sourcePath.trim()
        && !(await pathExists(path.resolve(rootDir, family.sourcePath)))
      ) {
        addFailure(
          'ASSET_PROVENANCE_FIRST_PARTY_SOURCE_MISSING',
          `${id}:${family.sourcePath}`,
        );
      }
    } else {
      requireNonEmptyString(family.sourceUrl, 'ASSET_PROVENANCE_SOURCE_REQUIRED', id);
      requireNonEmptyString(family.noticePath, 'ASSET_PROVENANCE_NOTICE_REQUIRED', id);
      if (typeof family.noticePath === 'string' && family.noticePath.trim()) {
        if (!(await pathExists(path.resolve(rootDir, family.noticePath)))) {
          addFailure('ASSET_PROVENANCE_NOTICE_MISSING', `${id}:${family.noticePath}`);
        }
      }
    }
  }

  if (family.kind === 'font-package') {
    requireNonEmptyString(family.package, 'ASSET_PROVENANCE_PACKAGE_REQUIRED', id);
    requireNonEmptyString(family.version, 'ASSET_PROVENANCE_PACKAGE_VERSION_REQUIRED', id);
    const actualVersion = packageJson?.devDependencies?.[family.package]
      ?? packageJson?.dependencies?.[family.package];
    if (actualVersion !== family.version) {
      addFailure(
        'ASSET_PROVENANCE_PACKAGE_VERSION_MISMATCH',
        `${id}:expected=${family.version}:actual=${actualVersion ?? 'missing'}`,
      );
    }
  }

  for (const file of family.files) {
    const repoPath = typeof file?.path === 'string' ? file.path.trim() : '';
    if (!repoPath || ledgerFiles.has(repoPath)) {
      addFailure(
        repoPath ? 'ASSET_PROVENANCE_DUPLICATE_FILE' : 'ASSET_PROVENANCE_FILE_PATH_REQUIRED',
        repoPath || id,
      );
      continue;
    }
    ledgerFiles.add(repoPath);
    if (!SHA256_PATTERN.test(file.sha256 || '')) {
      addFailure('ASSET_PROVENANCE_SHA256_INVALID', repoPath);
      continue;
    }
    if (!(await pathExists(path.resolve(rootDir, repoPath)))) {
      addFailure('ASSET_PROVENANCE_FILE_MISSING', repoPath);
      continue;
    }
    const actualSha256 = await sha256Path(repoPath);
    if (actualSha256 !== file.sha256) {
      addFailure(
        'ASSET_PROVENANCE_SHA256_MISMATCH',
        `${repoPath}:expected=${file.sha256}:actual=${actualSha256}`,
      );
    }
  }
}

async function main() {
  const [ledger, packageJson] = await Promise.all([
    readJson(ledgerPath, 'ASSET_PROVENANCE_LEDGER_READ_FAILED'),
    readJson(packageJsonPath, 'ASSET_PROVENANCE_PACKAGE_READ_FAILED'),
  ]);
  if (!ledger || !packageJson) {
    process.exitCode = 1;
    return;
  }
  if (ledger.schemaVersion !== 1) {
    addFailure('ASSET_PROVENANCE_SCHEMA_INVALID', ledger.schemaVersion);
  }
  if (!Array.isArray(ledger.families) || ledger.families.length === 0) {
    addFailure('ASSET_PROVENANCE_FAMILIES_INVALID');
  }

  const ledgerFiles = new Set();
  for (const family of Array.isArray(ledger.families) ? ledger.families : []) {
    await validateFamily(family, ledgerFiles, packageJson);
  }

  const discoveredFiles = [];
  for (const assetRoot of trackedAssetRoots) {
    await walkTrackedAssets(assetRoot, discoveredFiles);
  }
  for (const [repoPath, owner] of SEPARATELY_GUARDED_ASSETS) {
    if (!(await pathExists(path.resolve(rootDir, repoPath)))) {
      addFailure('ASSET_PROVENANCE_SEPARATE_GUARD_ENTRY_MISSING', `${repoPath}:${owner}`);
    }
  }
  const trackedFiles = [...new Set(discoveredFiles)]
    .filter((repoPath) => !SEPARATELY_GUARDED_ASSETS.has(repoPath));
  trackedFiles.sort();
  for (const repoPath of trackedFiles) {
    if (!ledgerFiles.has(repoPath)) {
      addFailure('ASSET_PROVENANCE_UNREGISTERED_FILE', repoPath);
    }
  }
  for (const repoPath of ledgerFiles) {
    if (!trackedFiles.includes(repoPath)) {
      addFailure('ASSET_PROVENANCE_LEDGER_FILE_OUTSIDE_TRACKED_ROOTS', repoPath);
    }
  }

  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`[asset-provenance] FAIL ${failure}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `[asset-provenance] PASS families=${ledger.families.length} files=${trackedFiles.length}`,
  );
}

await main();
