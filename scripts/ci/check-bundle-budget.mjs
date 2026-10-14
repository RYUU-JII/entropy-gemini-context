#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { isArtifactBuildEvidenceDirectory } from '../release/artifactEvidenceBoundary.mjs';

const rootDir = process.cwd();
const configPath = path.resolve(rootDir, 'scripts/ci/quality-gate.config.json');
const distDir = path.resolve(rootDir, process.argv[2] || 'dist-prod');

const readJson = async (targetPath) => {
  const payload = await fs.readFile(targetPath, 'utf8');
  return JSON.parse(payload);
};

const walkFiles = async (dirPath, artifactRoot = dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      const relativePath = path.relative(artifactRoot, entryPath).split(path.sep).join('/');
      if (isArtifactBuildEvidenceDirectory(relativePath)) return [];
      return walkFiles(entryPath, artifactRoot);
    }
    return [entryPath];
  }));
  return nested.flat();
};

const main = async () => {
  let config;
  try {
    config = await readJson(configPath);
  } catch (error) {
    console.error(`[bundle-budget] Failed to read config: ${configPath}`);
    console.error(`[bundle-budget] ${error?.message || error}`);
    process.exit(1);
    return;
  }

  let filePaths;
  try {
    filePaths = await walkFiles(distDir);
  } catch (error) {
    console.error(`[bundle-budget] Failed to scan dist directory: ${distDir}`);
    console.error('[bundle-budget] Run `npm run build` before this check, or pass an existing build output directory.');
    console.error(`[bundle-budget] ${error?.message || error}`);
    process.exit(1);
    return;
  }

  if (filePaths.length === 0) {
    console.error('[bundle-budget] build output directory has no files.');
    process.exit(1);
    return;
  }

  const stats = await Promise.all(filePaths.map(async (filePath) => {
    const fileStat = await fs.stat(filePath);
    return { filePath, size: fileStat.size };
  }));

  const allFiles = stats.filter((entry) => Number.isFinite(entry.size));
  const jsFiles = allFiles.filter((entry) => entry.filePath.endsWith('.js'));
  const cssFiles = allFiles.filter((entry) => entry.filePath.endsWith('.css'));

  const sumBytes = (entries) => entries.reduce((sum, entry) => sum + entry.size, 0);
  const maxJsFile = jsFiles.reduce(
    (largest, entry) => (entry.size > largest.size ? entry : largest),
    { filePath: '', size: 0 },
  );

  const metrics = {
    maxJsAssetBytes: maxJsFile.size,
    maxJsAssetPath: maxJsFile.filePath ? path.relative(rootDir, maxJsFile.filePath) : '(none)',
    maxTotalJsBytes: sumBytes(jsFiles),
    maxTotalCssBytes: sumBytes(cssFiles),
    maxTotalDistBytes: sumBytes(allFiles),
  };

  const limits = config?.bundle ?? {};
  const warnAtPct = Number(limits.warnAtPct ?? 0.9);
  const checks = [
    {
      name: 'maxJsAssetBytes',
      actual: metrics.maxJsAssetBytes,
      limit: Number(limits.maxJsAssetBytes),
      context: `path=${metrics.maxJsAssetPath}`,
    },
    {
      name: 'maxTotalJsBytes',
      actual: metrics.maxTotalJsBytes,
      limit: Number(limits.maxTotalJsBytes),
      context: '',
    },
    {
      name: 'maxTotalCssBytes',
      actual: metrics.maxTotalCssBytes,
      limit: Number(limits.maxTotalCssBytes),
      context: '',
    },
    {
      name: 'maxTotalDistBytes',
      actual: metrics.maxTotalDistBytes,
      limit: Number(limits.maxTotalDistBytes),
      context: '',
    },
  ];

  const namedJsAssets = Array.isArray(limits.namedJsAssets) ? limits.namedJsAssets : [];
  namedJsAssets.forEach(({ id, fileNamePrefix, maxBytes }) => {
    if (!id || !fileNamePrefix || !Number.isFinite(Number(maxBytes))) {
      checks.push({
        name: `namedJsAsset:${id || '(unnamed)'}`,
        actual: Number.NaN,
        limit: Number(maxBytes),
        context: 'invalid namedJsAssets configuration',
      });
      return;
    }

    const matches = jsFiles.filter((entry) => path.basename(entry.filePath).startsWith(fileNamePrefix));
    if (matches.length !== 1) {
      checks.push({
        name: `namedJsAsset:${id}`,
        actual: Number.NaN,
        limit: Number(maxBytes),
        context: `expected exactly one asset with prefix=${fileNamePrefix} found=${matches.length}`,
      });
      return;
    }

    const [asset] = matches;
    checks.push({
      name: `namedJsAsset:${id}`,
      actual: asset.size,
      limit: Number(maxBytes),
      context: `path=${path.relative(rootDir, asset.filePath)}`,
    });
  });

  let hasError = false;
  checks.forEach(({ name, actual, limit, context }) => {
    if (!Number.isFinite(actual) || !Number.isFinite(limit)) {
      console.error(`[bundle-budget] Invalid metric for ${name}. actual=${actual} limit=${limit}`);
      hasError = true;
      return;
    }

    const status = actual <= limit ? 'PASS' : 'FAIL';
    const printer = status === 'PASS' ? console.log : console.error;
    printer(
      `[bundle-budget] ${status} ${name}: actual=${actual}B limit=${limit}B ${context}`.trim(),
    );
    if (
      status === 'PASS'
      && Number.isFinite(warnAtPct)
      && warnAtPct > 0
      && warnAtPct < 1
      && limit > 0
      && (actual / limit) >= warnAtPct
    ) {
      const usagePct = ((actual / limit) * 100).toFixed(2);
      const headroomBytes = limit - actual;
      console.warn(
        `[bundle-budget] WARN ${name}: usage=${usagePct}% headroom=${headroomBytes}B ${context}`.trim(),
      );
    }
    if (status === 'FAIL') hasError = true;
  });

  if (hasError) {
    process.exit(1);
    return;
  }

  console.log('[bundle-budget] PASS: bundle budgets satisfied.');
};

main().catch((error) => {
  console.error('[bundle-budget] Unexpected error:', error);
  process.exit(1);
});
