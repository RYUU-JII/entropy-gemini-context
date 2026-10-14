#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parse } from '@babel/parser';
import {
  WORKER_RUNTIME_CONTROL_CHUNK_NAME,
  WORKER_RUNTIME_CONTROL_MODULES,
} from '../release/workerRuntimeChunkContract.mjs';
import {
  collectStaticManifestClosure,
  resolveContextManifestRootKey,
} from './check-context-bundle-budget.mjs';

const CHECK_PREFIX = '[dashboard-boot-artifact-contract]';
const DASHBOARD_ENTRY_KEY = 'src/pages/dashboard.html';
const DASHBOARD_WRAPPER_SOURCE = 'src/apps/dashboard/main.jsx';
const DASHBOARD_BOOT_WORKER_OWNER = 'src/themes/plugins/zen/presentation/ZenSoftBootShell.js';
const POPUP_ENTRY_KEY = 'src/pages/popup.html';
const DASHBOARD_BOOT_STATIC_BUDGET_BYTES = 128 * 1024;
const DASHBOARD_BOOT_STATIC_GZIP_BUDGET_BYTES = 40 * 1024;
const DASHBOARD_BOOT_STATIC_FILE_BUDGET = 6;
const THEME_SURFACE_DESCRIPTOR_CHUNK_NAME = 'dashboard-boot-low-level';
const THEME_SURFACE_DESCRIPTOR_MODULES = Object.freeze([
  'src/themes/core/runtime/createThemeSurfaceDescriptor.js',
  'src/themes/core/runtime/surfaceDescriptorCatalog.js',
  'src/themes/plugins/clinical/surfaceDescriptor.js',
  'src/themes/plugins/cyberpunk/surfaceDescriptor.js',
  'src/themes/plugins/entropy/surfaceDescriptor.js',
  'src/themes/plugins/matrix/surfaceDescriptor.js',
  'src/themes/plugins/scp/surfaceDescriptor.js',
  'src/themes/plugins/zen/surfaceDescriptor.js',
]);

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function resolveArtifactPath(outDir, artifactFile) {
  if (typeof artifactFile !== 'string' || !artifactFile || artifactFile.includes('\0')) {
    throw new Error('artifact path must be a non-empty safe relative path.');
  }
  const normalized = artifactFile.replaceAll('\\', '/');
  if (path.isAbsolute(normalized) || path.posix.isAbsolute(normalized)) {
    throw new Error(`artifact path must be relative: ${artifactFile}`);
  }
  const artifactPath = path.resolve(outDir, normalized);
  const relative = path.relative(outDir, artifactPath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`artifact path escapes output: ${artifactFile}`);
  }
  return artifactPath;
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is unreadable or invalid: ${filePath}: ${error.message}`);
  }
}

function requireManifestList(entry, field, label) {
  const value = entry[field];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item)) {
    throw new Error(`${label} ${field} must be an array of non-empty strings.`);
  }
  return value;
}

function requireSingleManifestOwner(manifest, file, name) {
  const owners = Object.entries(manifest).filter(([, entry]) => entry?.file === file);
  if (owners.length !== 1 || owners[0][1].name !== name) {
    throw new Error(`${name} artifact must retain exactly one named manifest owner.`);
  }
  return owners[0];
}

function hasBroadThemeOwner(moduleId) {
  const sourceId = moduleId.replaceAll('\\', '/').split('?')[0];
  return sourceId === 'src/themes/core/runtime/pluginCatalog.js'
    || sourceId.endsWith('/src/themes/core/runtime/pluginCatalog.js')
    || /(?:^|\/)src\/themes\/plugins\/[^/]+\/manifest\.js$/u.test(sourceId);
}

function collectEmittedImports(source, label) {
  let syntax;
  try {
    syntax = parse(source, { sourceType: 'module' });
  } catch (error) {
    throw new Error(`${label} emitted JavaScript is invalid: ${error.message}`);
  }
  const staticImports = [];
  const dynamicImports = [];
  let hasDynamicImport = false;
  let hasUnresolvedDynamicImport = false;
  const pending = [syntax];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.type === 'ImportDeclaration'
      || (['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source)) {
      staticImports.push(node.source.value);
    }
    if (node.type === 'ImportExpression'
      || (node.type === 'CallExpression' && node.callee?.type === 'Import')) {
      hasDynamicImport = true;
      const sourceNode = node.type === 'ImportExpression' ? node.source : node.arguments[0];
      if (sourceNode?.type === 'StringLiteral') dynamicImports.push(sourceNode.value);
      if (sourceNode?.type === 'TemplateLiteral' && sourceNode.expressions.length === 0) {
        dynamicImports.push(sourceNode.quasis[0].value.cooked);
      }
      if (sourceNode?.type !== 'StringLiteral'
        && !(sourceNode?.type === 'TemplateLiteral' && sourceNode.expressions.length === 0)) {
        hasUnresolvedDynamicImport = true;
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        pending.push(...value.filter(child => child && typeof child.type === 'string'));
      } else if (value && typeof value.type === 'string') {
        pending.push(value);
      }
    }
  }
  return { staticImports, dynamicImports, hasDynamicImport, hasUnresolvedDynamicImport };
}

function resolveEmittedRelativeImport(outDir, ownerFile, specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith('.')) {
    throw new Error(`${ownerFile} has an unowned emitted import: ${String(specifier)}`);
  }
  const importedFile = path.resolve(path.dirname(resolveArtifactPath(outDir, ownerFile)), specifier);
  const relative = path.relative(outDir, importedFile).replaceAll('\\', '/');
  resolveArtifactPath(outDir, relative);
  return relative;
}

async function requireWorkerControlOwner({ manifest, inventoryChunks, outDir, descriptorChunkFile }) {
  const expected = new Set(WORKER_RUNTIME_CONTROL_MODULES);
  const owners = Object.entries(inventoryChunks).filter(([, modules]) => (
    modules.some(moduleId => expected.has(moduleId))
  ));
  if (owners.length !== 1) {
    throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} modules must share exactly one owner chunk.`);
  }
  const [workerChunkFile, modules] = owners[0];
  if (modules.length !== expected.size || new Set(modules).size !== expected.size
    || modules.some(moduleId => !expected.has(moduleId))) {
    throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} must contain only the exact worker control and telemetry owners.`);
  }
  const [, entry] = requireSingleManifestOwner(manifest, workerChunkFile, WORKER_RUNTIME_CONTROL_CHUNK_NAME);
  for (const field of ['dynamicImports', 'css']) {
    if (requireManifestList(entry, field, WORKER_RUNTIME_CONTROL_CHUNK_NAME).length > 0) {
      throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} must not contain dynamic or CSS imports.`);
    }
  }
  const staticImports = requireManifestList(entry, 'imports', WORKER_RUNTIME_CONTROL_CHUNK_NAME);
  const manifestDependencyFiles = new Set(staticImports.map(key => {
    const dependency = manifest[key];
    if (!dependency || dependency.file !== descriptorChunkFile) {
      throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} may statically depend only on the boot-safe base owner.`);
    }
    return dependency.file;
  }));
  const source = await fs.readFile(resolveArtifactPath(outDir, workerChunkFile), 'utf8');
  const emitted = collectEmittedImports(source, WORKER_RUNTIME_CONTROL_CHUNK_NAME);
  if (emitted.hasDynamicImport) {
    throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} must not contain emitted dynamic imports.`);
  }
  const emittedDependencyFiles = new Set(emitted.staticImports.map(specifier => (
    resolveEmittedRelativeImport(outDir, workerChunkFile, specifier)
  )));
  if ([...emittedDependencyFiles].some(file => file !== descriptorChunkFile)) {
    throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} emitted imports may use only the boot-safe base owner.`);
  }
  if (emittedDependencyFiles.size !== manifestDependencyFiles.size
    || [...emittedDependencyFiles].some(file => !manifestDependencyFiles.has(file))) {
    throw new Error(`${WORKER_RUNTIME_CONTROL_CHUNK_NAME} emitted imports must match its manifest dependencies.`);
  }
  return workerChunkFile;
}

async function assertBaseWorkerImportDirection({ manifest, outDir, descriptorChunkFile, workerChunkFile }) {
  const [, entry] = requireSingleManifestOwner(manifest, descriptorChunkFile, THEME_SURFACE_DESCRIPTOR_CHUNK_NAME);
  for (const field of ['imports', 'dynamicImports']) {
    const dependencies = requireManifestList(entry, field, THEME_SURFACE_DESCRIPTOR_CHUNK_NAME);
    for (const key of dependencies) {
      if (!manifest[key]) throw new Error(`${THEME_SURFACE_DESCRIPTOR_CHUNK_NAME} has an unresolved manifest ${field} dependency: ${key}`);
      if (manifest[key].file === workerChunkFile) {
        throw new Error(`${THEME_SURFACE_DESCRIPTOR_CHUNK_NAME} must not import ${WORKER_RUNTIME_CONTROL_CHUNK_NAME}, statically or dynamically.`);
      }
    }
  }
  const emitted = collectEmittedImports(await fs.readFile(resolveArtifactPath(outDir, descriptorChunkFile), 'utf8'), descriptorChunkFile);
  if (emitted.hasUnresolvedDynamicImport) {
    throw new Error(`${THEME_SURFACE_DESCRIPTOR_CHUNK_NAME} dynamic import ownership must be statically provable.`);
  }
  for (const specifier of [...emitted.staticImports, ...emitted.dynamicImports]) {
    if (resolveEmittedRelativeImport(outDir, descriptorChunkFile, specifier) === workerChunkFile) {
      throw new Error(`${THEME_SURFACE_DESCRIPTOR_CHUNK_NAME} emitted imports must not load ${WORKER_RUNTIME_CONTROL_CHUNK_NAME}, statically or dynamically.`);
    }
  }
}

async function checkUiStaticArtifactClosure({ manifest, inventoryChunks, outDir, rootKey, label, workerChunkFile, allowBootShellWorkerAdmission = false }) {
  const keys = collectStaticManifestClosure(manifest, rootKey);
  const files = [...new Set([...keys].map(key => manifest[key].file))];
  for (const file of files) {
    if (!Array.isArray(inventoryChunks[file])) {
      throw new Error(`${label} static chunk is missing module inventory: ${file}`);
    }
  }
  const workerAdmissionAllowed = allowBootShellWorkerAdmission
    && files.some(file => inventoryChunks[file].includes(DASHBOARD_BOOT_WORKER_OWNER));
  const missingBootOwnerError = `${label} worker admission requires the declared ZenSoftBootShell owner in its static closure.`;
  for (const file of files) {
    const modules = inventoryChunks[file];
    if (!workerAdmissionAllowed
      && (file === workerChunkFile || modules.some(moduleId => WORKER_RUNTIME_CONTROL_MODULES.includes(moduleId)))) {
      if (allowBootShellWorkerAdmission) throw new Error(missingBootOwnerError);
      throw new Error(`${label} static closure must not load ${WORKER_RUNTIME_CONTROL_CHUNK_NAME}: ${file}`);
    }
    if (!file.endsWith('.js')) continue;
    const emitted = collectEmittedImports(await fs.readFile(resolveArtifactPath(outDir, file), 'utf8'), file);
    const manifestKey = [...keys].find(key => manifest[key].file === file);
    const manifestImports = requireManifestList(manifest[manifestKey], 'imports', file);
    const declaredFiles = new Set(manifestImports.map(key => manifest[key]?.file));
    for (const specifier of emitted.staticImports) {
      const importedFile = resolveEmittedRelativeImport(outDir, file, specifier);
      if (importedFile === workerChunkFile && !workerAdmissionAllowed) {
        if (allowBootShellWorkerAdmission) throw new Error(missingBootOwnerError);
        throw new Error(`${label} emitted static imports must not load ${WORKER_RUNTIME_CONTROL_CHUNK_NAME}: ${file}`);
      }
      if (!declaredFiles.has(importedFile)) {
        throw new Error(`${label} emitted static import is absent from the manifest: ${file} -> ${importedFile}`);
      }
    }
  }
  return files;
}

export async function checkDashboardBootArtifactContract(outputDir) {
  const outDir = path.resolve(outputDir);
  const manifest = await readJson(path.join(outDir, '.vite/manifest.json'), 'Vite manifest');
  const moduleInventory = await readJson(path.join(outDir, '.vite/entropy-module-inventory.json'), 'module inventory');
  const buildInfo = await readJson(path.join(outDir, 'entropy-build-info.json'), 'build info');
  assertObject(manifest, 'Vite manifest');
  if (!['public', 'dev'].includes(buildInfo?.releaseProfile)) {
    throw new Error(`build info has missing or unknown releaseProfile: ${String(buildInfo?.releaseProfile)}`);
  }
  if (moduleInventory?.schemaVersion !== 1) throw new Error('module inventory schemaVersion must equal 1.');
  const inventoryChunks = moduleInventory.chunks;
  assertObject(inventoryChunks, 'module inventory chunks');
  for (const [file, modules] of Object.entries(inventoryChunks)) {
    resolveArtifactPath(outDir, file);
    if (!Array.isArray(modules) || modules.some(moduleId => typeof moduleId !== 'string' || !moduleId)) {
      throw new Error(`module inventory chunk must contain module IDs: ${file}`);
    }
  }

  const descriptorOwners = Object.entries(inventoryChunks).filter(([, modules]) => (
    modules.some(moduleId => THEME_SURFACE_DESCRIPTOR_MODULES.includes(moduleId))
  ));
  if (descriptorOwners.length !== 1) {
    throw new Error(`theme surface descriptors must resolve to one boot-safe chunk; found=${descriptorOwners.map(([file]) => file).join(',') || 'none'}`);
  }
  const [descriptorChunkFile, descriptorModules] = descriptorOwners[0];
  requireSingleManifestOwner(manifest, descriptorChunkFile, THEME_SURFACE_DESCRIPTOR_CHUNK_NAME);
  const missingDescriptors = THEME_SURFACE_DESCRIPTOR_MODULES.filter(moduleId => !descriptorModules.includes(moduleId));
  if (missingDescriptors.length > 0) {
    throw new Error(`theme surface descriptor chunk is incomplete: ${missingDescriptors.join(',')}`);
  }
  const broadDescriptorLeak = descriptorModules.find(hasBroadThemeOwner);
  if (broadDescriptorLeak) throw new Error(`theme surface descriptor chunk absorbed a full plugin owner: ${broadDescriptorLeak}`);
  if (descriptorModules.some(moduleId => WORKER_RUNTIME_CONTROL_MODULES.includes(moduleId))) {
    throw new Error(`${THEME_SURFACE_DESCRIPTOR_CHUNK_NAME} must not absorb worker control owners.`);
  }

  const workerChunkFile = await requireWorkerControlOwner({ manifest, inventoryChunks, outDir, descriptorChunkFile });
  await assertBaseWorkerImportDirection({ manifest, outDir, descriptorChunkFile, workerChunkFile });
  const bootManagerEntries = Object.entries(manifest).filter(([, entry]) => entry?.name === 'bootManager');
  if (bootManagerEntries.length !== 1) throw new Error('bootManager must have exactly one manifest entry.');
  const bootManagerFiles = [...collectStaticManifestClosure(manifest, bootManagerEntries[0][0])].map(key => manifest[key].file);
  if (!bootManagerFiles.includes(descriptorChunkFile)) {
    throw new Error(`bootManager closure does not use the boot-safe theme surface descriptor owner chunk: ${descriptorChunkFile}`);
  }
  const bootManagerBroadThemeLeak = bootManagerFiles.find(file => {
    const modules = inventoryChunks[file];
    if (!Array.isArray(modules)) throw new Error(`bootManager static chunk is missing module inventory: ${file}`);
    return modules.some(hasBroadThemeOwner);
  });
  if (bootManagerBroadThemeLeak) throw new Error(`bootManager static closure absorbed the full plugin manifest graph: ${bootManagerBroadThemeLeak}`);

  const dashboardWrapperOwners = Object.entries(inventoryChunks).filter(([, modules]) => (
    modules.includes(DASHBOARD_WRAPPER_SOURCE)
  ));
  if (dashboardWrapperOwners.length !== 1) {
    throw new Error('Dashboard runtime wrapper must resolve to exactly one module inventory owner.');
  }
  const dashboardWrapperKey = resolveContextManifestRootKey({ manifest, moduleInventoryChunks: inventoryChunks, rootSourceId: DASHBOARD_WRAPPER_SOURCE });
  if (manifest[dashboardWrapperKey]?.file !== dashboardWrapperOwners[0][0]) {
    throw new Error('Dashboard runtime wrapper manifest entry must resolve to its actual source owner.');
  }
  const roots = [
    [DASHBOARD_ENTRY_KEY, 'dashboard boot'],
    [dashboardWrapperKey, 'Dashboard runtime wrapper'],
    [POPUP_ENTRY_KEY, 'Popup entry'],
  ];
  let dashboardFiles;
  for (const [rootKey, label] of roots) {
    const files = await checkUiStaticArtifactClosure({
      manifest, inventoryChunks, outDir, rootKey, label, workerChunkFile,
      allowBootShellWorkerAdmission: rootKey === DASHBOARD_ENTRY_KEY,
    });
    if (rootKey === DASHBOARD_ENTRY_KEY) dashboardFiles = files;
  }
  const backgroundLeak = dashboardFiles.find(file => (
    file.includes('background-kernel-runtime') || file.includes('background-kernel-storage') || file.includes('zen-pond-rendering')
  ));
  if (backgroundLeak) throw new Error(`dashboard boot statically imports a heavy runtime asset: ${backgroundLeak}`);
  if (dashboardFiles.length > DASHBOARD_BOOT_STATIC_FILE_BUDGET) {
    throw new Error(`dashboard boot static closure has ${dashboardFiles.length} assets; budget=${DASHBOARD_BOOT_STATIC_FILE_BUDGET}; assets=${dashboardFiles.join(',')}`);
  }
  const sizes = await Promise.all(dashboardFiles.map(async file => {
    const source = await fs.readFile(resolveArtifactPath(outDir, file));
    return { raw: source.byteLength, gzip: gzipSync(source).byteLength };
  }));
  const rawBytes = sizes.reduce((sum, entry) => sum + entry.raw, 0);
  const gzipBytes = sizes.reduce((sum, entry) => sum + entry.gzip, 0);
  if (buildInfo.releaseProfile !== 'dev' && rawBytes > DASHBOARD_BOOT_STATIC_BUDGET_BYTES) {
    throw new Error(`dashboard boot static closure is ${rawBytes}B; budget=${DASHBOARD_BOOT_STATIC_BUDGET_BYTES}B; assets=${dashboardFiles.join(',')}`);
  }
  if (buildInfo.releaseProfile !== 'dev' && gzipBytes > DASHBOARD_BOOT_STATIC_GZIP_BUDGET_BYTES) {
    throw new Error(`dashboard boot static gzip closure is ${gzipBytes}B; budget=${DASHBOARD_BOOT_STATIC_GZIP_BUDGET_BYTES}B; assets=${dashboardFiles.join(',')}`);
  }
  return Object.freeze({ files: dashboardFiles.length, rawBytes, gzipBytes, workerChunkFile, descriptorChunkFile });
}

export async function runDashboardBootArtifactContractCli(outputDir, io = {}) {
  const writeStdout = io.writeStdout ?? (message => console.log(message));
  const writeStderr = io.writeStderr ?? (message => console.error(message));
  try {
    const report = await checkDashboardBootArtifactContract(outputDir);
    writeStdout(`${CHECK_PREFIX} PASS: ${report.files} static asset(s), ${report.rawBytes}B raw, ${report.gzipBytes}B gzip, no heavy runtime leakage.`);
    return 0;
  } catch (error) {
    writeStderr(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await runDashboardBootArtifactContractCli(path.resolve(process.cwd(), process.argv[2] || 'dist-prod'));
}
