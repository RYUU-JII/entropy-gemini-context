#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const distArg = String(process.argv[2] || 'dist-prod').trim();
const distDir = path.resolve(rootDir, distArg || 'dist-prod');
const artifactPath = path.resolve(distDir, 'assets/content-bootstrap.js');
const rootVisualReaderArtifactPath = path.resolve(distDir, 'assets/content-loader-root-visual-reader.js');
const loaderPath = path.resolve(distDir, 'src/apps/content/loader.js');
const manifestPath = path.resolve(distDir, 'manifest.json');

const fail = (message) => {
  console.error(`[content-runtime-bootstrap-artifact-contract] FAIL: ${message}`);
  process.exit(1);
};

const requireReadableFile = async (filePath, label) => {
  try {
    await fs.access(filePath);
  } catch (error) {
    fail(`${label} is missing: ${path.relative(rootDir, filePath)} (${error?.message || error})`);
  }
};

const readUtf8 = async (filePath) => fs.readFile(filePath, 'utf8');

const collectImportedChunkPaths = (source, ownerPath) => {
  const importedPaths = [];
  [
    /import\s*(?:[^'"]*?\s*from\s*)?["'](\.\/[^"']+\.js)["']/g,
    /import\s*\(\s*["'](\.\/[^"']+\.js)["']\s*\)/g,
  ].forEach((importPattern) => {
    let match = importPattern.exec(source);
    while (match) {
      importedPaths.push(path.resolve(path.dirname(ownerPath), match[1]));
      match = importPattern.exec(source);
    }
  });
  return importedPaths;
};

const readArtifactGraphSource = async (entryPath, visited = new Set()) => {
  const resolvedEntryPath = path.resolve(entryPath);
  if (visited.has(resolvedEntryPath)) return '';
  visited.add(resolvedEntryPath);

  const source = await readUtf8(resolvedEntryPath);
  const importedSources = await Promise.all(
    collectImportedChunkPaths(source, resolvedEntryPath).map((importedPath) => (
      readArtifactGraphSource(importedPath, visited)
    )),
  );
  return [source, ...importedSources].join('\n');
};

const main = async () => {
  await requireReadableFile(artifactPath, 'content bootstrap artifact');
  await requireReadableFile(rootVisualReaderArtifactPath, 'content root visual reader artifact');
  await requireReadableFile(loaderPath, 'built content loader');
  await requireReadableFile(manifestPath, 'built extension manifest');

  const loaderSource = await readUtf8(loaderPath);
  const manifest = JSON.parse(await readUtf8(manifestPath));
  const contentBootstrapSource = await readArtifactGraphSource(artifactPath);
  if (!loaderSource.includes('assets/content-bootstrap.js')) {
    fail(
      `${path.relative(rootDir, loaderPath)} must reference the canonical bundled bootstrap artifact path.`,
    );
  }
  if (!loaderSource.includes('assets/content-loader-root-visual-reader.js')) {
    fail(
      `${path.relative(rootDir, loaderPath)} must reference the canonical bundled root-visual reader artifact path.`,
    );
  }
  if (loaderSource.includes('src/apps/content/bootstrap.js')) {
    fail(
      `${path.relative(rootDir, loaderPath)} must not retain the raw source bootstrap fallback in built output.`,
    );
  }
  if (loaderSource.includes('src/platform/storage/bootstrap/contentLoaderRootVisualReader.js')) {
    fail(
      `${path.relative(rootDir, loaderPath)} must not retain the raw source root-visual reader fallback in built output.`,
    );
  }

  const nudgeWorkerFile = contentBootstrapSource.match(/assets\/nudgeSwarm\.worker-[A-Za-z0-9_-]+\.js/)?.[0] || '';
  if (!nudgeWorkerFile) {
    fail(`${path.relative(rootDir, artifactPath)} must reference the bundled nudge swarm worker entry.`);
  }
  const nudgeWorkerPath = path.resolve(distDir, nudgeWorkerFile);
  await requireReadableFile(nudgeWorkerPath, 'bundled nudge swarm worker');
  const nudgeWorkerSource = await readUtf8(nudgeWorkerPath);
  [
    "from './nudge/",
    "from './zenSentinel/",
    "from './runtime/",
    "from '../settings/",
    "from '../../themes/",
  ].forEach((rawSourceImport) => {
    if (nudgeWorkerSource.includes(rawSourceImport)) {
      fail(
        `${path.relative(rootDir, nudgeWorkerPath)} must be a standalone worker bundle, but retained raw source import ${JSON.stringify(rawSourceImport)}.`,
      );
    }
  });

  const webAccessibleResourceRules = Array.isArray(manifest?.web_accessible_resources)
    ? manifest.web_accessible_resources
    : [];
  if (webAccessibleResourceRules.some((rule) => rule?.use_dynamic_url === true)) {
    fail(
      `${path.relative(rootDir, manifestPath)} must not enable web_accessible_resources.use_dynamic_url while the content loader dynamically imports the content bootstrap module.`,
    );
  }
  const webAccessibleResources = webAccessibleResourceRules.flatMap((rule) => (
    Array.isArray(rule?.resources) ? rule.resources : []
  ));
  const nudgeWorkerIsWebAccessible = webAccessibleResources.some((resource) => (
    resource === 'assets/*'
    || resource === 'assets/**/*'
    || resource === nudgeWorkerFile
  ));
  if (!nudgeWorkerIsWebAccessible) {
    fail(
      `${path.relative(rootDir, manifestPath)} must expose the bundled nudge swarm worker through web_accessible_resources.`,
    );
  }

  const artifactModule = await import(pathToFileURL(artifactPath).href);
  if (typeof artifactModule?.bootstrapContentRuntime !== 'function') {
    const exportedKeys = Object.keys(artifactModule || {});
    fail(
      `${path.relative(rootDir, artifactPath)} must export bootstrapContentRuntime(). exports=${JSON.stringify(exportedKeys)}`,
    );
  }

  const rootVisualReaderArtifactModule = await import(pathToFileURL(rootVisualReaderArtifactPath).href);
  if (typeof rootVisualReaderArtifactModule?.readContentLoaderRootVisualSnapshot !== 'function') {
    const exportedKeys = Object.keys(rootVisualReaderArtifactModule || {});
    fail(
      `${path.relative(rootDir, rootVisualReaderArtifactPath)} must export readContentLoaderRootVisualSnapshot(). exports=${JSON.stringify(exportedKeys)}`,
    );
  }

  console.log(
    `[content-runtime-bootstrap-artifact-contract] PASS: ${path.relative(rootDir, artifactPath)} and ${path.relative(rootDir, rootVisualReaderArtifactPath)} export their canonical content runtime entrypoints.`,
  );
};

main().catch((error) => {
  console.error('[content-runtime-bootstrap-artifact-contract] Unexpected error:', error);
  process.exit(1);
});
