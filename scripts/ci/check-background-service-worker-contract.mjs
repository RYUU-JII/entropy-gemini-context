#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const distArg = String(process.argv[2] || 'dist-prod').trim();
const distDir = path.resolve(rootDir, distArg || 'dist-prod');
const serviceWorkerLoaderPath = path.resolve(distDir, 'service-worker-loader.js');
const MESSAGE_CONTRACT_MODULES = Object.freeze([
  'src/domains/nudge/media/frameMediaProtocol.js',
  'src/domains/schedule/contracts/scheduleRuntimeState.js',
  'src/platform/messaging/contracts/messageTypes.js',
  'src/platform/storage/support/storageSupportTaskContract.js',
]);

const fail = (message) => {
  console.error(`[background-service-worker-contract] FAIL: ${message}`);
  process.exit(1);
};

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function requireReadableFile(filePath, label) {
  try {
    await fs.access(filePath);
  } catch (error) {
    fail(`${label} is missing: ${path.relative(rootDir, filePath)} (${error?.message || error})`);
  }
}

function toRelative(filePath) {
  return path.relative(rootDir, filePath);
}

function collectStaticImportSpecifiers(source) {
  const specifiers = [];
  const importDeclarationPattern = /\bimport\s*(?:[^;"']*?\bfrom\s*)?["']([^"']+)["']/g;
  const exportDeclarationPattern = /\bexport\s+[^;"']*?\bfrom\s*["']([^"']+)["']/g;
  for (const pattern of [importDeclarationPattern, exportDeclarationPattern]) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }
  return specifiers;
}

function resolveBuiltStaticImport(ownerPath, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
    return null;
  }
  const resolvedPath = path.resolve(path.dirname(ownerPath), specifier);
  if (!resolvedPath.startsWith(`${distDir}${path.sep}`)) {
    fail(`${toRelative(ownerPath)} imports outside the built dist directory: ${specifier}`);
  }
  return resolvedPath;
}

async function assertBackgroundGraphHasNoRuntimeImports(entryPath) {
  const visited = new Set();
  const pending = [entryPath];

  while (pending.length > 0) {
    const filePath = pending.pop();
    if (visited.has(filePath)) continue;
    visited.add(filePath);
    await requireReadableFile(filePath, 'background graph module');

    const source = await readUtf8(filePath);
    const fileLabel = toRelative(filePath);
    if (/\bimport\s*\(/.test(source)) {
      fail(`${fileLabel} must not contain runtime import(); MV3 service workers disallow it.`);
    }
    if (/^preload-helper-[A-Za-z0-9_-]+\.js$/.test(path.basename(filePath))) {
      fail(`${fileLabel} must not be reachable from the background service worker graph.`);
    }

    collectStaticImportSpecifiers(source).forEach((specifier) => {
      const resolvedPath = resolveBuiltStaticImport(filePath, specifier);
      if (resolvedPath && !visited.has(resolvedPath)) {
        pending.push(resolvedPath);
      }
    });
  }

  return visited.size;
}

async function assertPureMessageContractChunk() {
  const manifest = JSON.parse(await readUtf8(path.join(distDir, '.vite/manifest.json')));
  const inventory = JSON.parse(await readUtf8(path.join(distDir, '.vite/entropy-module-inventory.json')));
  if (inventory.schemaVersion !== 1 || !inventory.chunks) fail('message contract module inventory is invalid.');
  const owners = Object.entries(inventory.chunks).filter(([, modules]) => (
    Array.isArray(modules) && MESSAGE_CONTRACT_MODULES.some(moduleId => modules.includes(moduleId))
  ));
  if (owners.length !== 1) fail('wire contracts must share exactly one extension-message-contracts chunk.');
  const [artifactFile, modules] = owners[0];
  if (modules.length !== MESSAGE_CONTRACT_MODULES.length
    || MESSAGE_CONTRACT_MODULES.some(moduleId => !modules.includes(moduleId))) {
    fail('extension-message-contracts must contain only the exact message, frame-media, Schedule DTO, and storage-support task contracts; runtime/storage/UI owner absorption is forbidden.');
  }
  const entries = Object.values(manifest).filter(entry => entry.file === artifactFile);
  if (entries.length !== 1 || entries[0].name !== 'extension-message-contracts') {
    fail('wire contract artifact must retain its extension-message-contracts identity.');
  }
  const entry = entries[0];
  const source = await readUtf8(path.resolve(distDir, artifactFile));
  if ((entry.imports?.length ?? 0) !== 0 || (entry.dynamicImports?.length ?? 0) !== 0
    || (entry.css?.length ?? 0) !== 0 || collectStaticImportSpecifiers(source).length !== 0
    || /\bimport\s*\(/.test(source)) {
    fail('extension-message-contracts must remain a pure chunk with no static, dynamic or CSS imports.');
  }
}

async function main() {
  await assertPureMessageContractChunk();
  await requireReadableFile(serviceWorkerLoaderPath, 'built service worker loader');
  const serviceWorkerLoaderSource = await readUtf8(serviceWorkerLoaderPath);
  if (!serviceWorkerLoaderSource.includes('assets/')) {
    fail(`${path.relative(rootDir, serviceWorkerLoaderPath)} must import the built background entry.`);
  }

  const backgroundModuleCount = await assertBackgroundGraphHasNoRuntimeImports(serviceWorkerLoaderPath);

  console.log(
    `[background-service-worker-contract] PASS: ${backgroundModuleCount} background module(s) have no runtime import() or preload-helper reachability.`,
  );
}

main().catch((error) => {
  console.error('[background-service-worker-contract] Unexpected error:', error);
  process.exit(1);
});
