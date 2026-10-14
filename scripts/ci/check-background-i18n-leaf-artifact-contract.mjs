#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import {
  RUNTIME_I18N_PRIMITIVES_CHUNK_NAME,
  RUNTIME_I18N_PRIMITIVE_MODULES,
} from '../i18n/runtimeI18nChunkContract.mjs';
import {
  I18N_NAMESPACES,
  I18N_SUPPORTED_LOCALES,
} from '../../src/i18n/metadata.js';

const CHECK_PREFIX = '[background-i18n-leaf-artifact]';
const BACKGROUND_ENTRY_KEY = 'src/apps/background/index.js';

const REQUIRED_BACKGROUND_I18N_CORE_MODULES = Object.freeze([
  'src/domains/notifications/background/notificationCopyResolver.js',
  'src/domains/settings/i18n/backgroundRuntime.js',
  'src/i18n/backgroundResources.js',
]);

const FORBIDDEN_BACKGROUND_I18N_CORE_MODULES = Object.freeze([
  'src/domains/settings/i18n/runtime.js',
  'src/i18n/resources.js',
]);

const LOCALE_MODULE_PREFIX = 'src/i18n/locales/';
const BACKGROUND_LOCALE_CHUNK_NAME = 'background-i18n-locales';

function requireUniqueStrings(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${label} must be a non-empty array.`);
  }
  const normalized = values.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string.`);
    }
    return value;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  return normalized;
}

export function deriveBackgroundI18nArtifactModuleContract({
  supportedLocales = I18N_SUPPORTED_LOCALES,
  namespaces = I18N_NAMESPACES,
} = {}) {
  const localeIds = requireUniqueStrings(supportedLocales, 'supportedLocales');
  const namespaceIds = requireUniqueStrings(namespaces, 'namespaces');
  const localeLeafModules = localeIds.map(
    (locale) => `src/i18n/locales/${locale}/backgroundRuntime.js`,
  );
  const broadLocaleModules = localeIds.flatMap((locale) => namespaceIds.map(
    (namespace) => `src/i18n/locales/${locale}/${namespace}.js`,
  ));

  return Object.freeze({
    supportedLocales: Object.freeze([...localeIds]),
    allowedLocaleModules: Object.freeze([...localeLeafModules]),
    allowedRuntimePrimitiveModules: RUNTIME_I18N_PRIMITIVE_MODULES,
    requiredModules: Object.freeze([
      ...REQUIRED_BACKGROUND_I18N_CORE_MODULES,
      ...RUNTIME_I18N_PRIMITIVE_MODULES,
      ...localeLeafModules,
    ]),
    forbiddenModules: Object.freeze([
      ...FORBIDDEN_BACKGROUND_I18N_CORE_MODULES,
      ...broadLocaleModules,
    ]),
  });
}

function isLocaleModule(moduleId) {
  return typeof moduleId === 'string'
    && moduleId.startsWith(LOCALE_MODULE_PREFIX);
}

async function readJson(filePath, label) {
  let source;
  try {
    source = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`${label} is unreadable: ${filePath}: ${error?.message || error}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${filePath}: ${error?.message || error}`);
  }
}

function collectStaticManifestKeys(manifest, rootKey) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Vite manifest must be an object.');
  }
  const pending = [rootKey];
  const visited = new Set();
  while (pending.length > 0) {
    const key = pending.pop();
    if (visited.has(key)) continue;
    const entry = manifest[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`manifest entry is missing: ${key}`);
    }
    if (typeof entry.file !== 'string' || entry.file.length === 0) {
      throw new Error(`manifest entry file is missing: ${key}`);
    }
    if (entry.imports !== undefined && !Array.isArray(entry.imports)) {
      throw new Error(`manifest imports must be an array: ${key}`);
    }
    visited.add(key);
    for (const importKey of entry.imports || []) {
      if (typeof importKey !== 'string' || importKey.length === 0) {
        throw new Error(`manifest static import is invalid: ${key}`);
      }
      if (!visited.has(importKey)) pending.push(importKey);
    }
  }
  return visited;
}

function assertNoEmittedImports(source, chunkName) {
  let syntax;
  try {
    syntax = parse(source, { sourceType: 'module' });
  } catch (error) {
    throw new Error(`${chunkName} emitted JavaScript is invalid: ${error.message}`);
  }
  const pending = [syntax];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node.type === 'ImportDeclaration' || node.type === 'ImportExpression'
      || (node.type === 'CallExpression' && node.callee?.type === 'Import')
      || (['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source)) {
      throw new Error(`${chunkName} must not contain emitted static or runtime imports.`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        pending.push(...value.filter(child => child && typeof child.type === 'string'));
      } else if (value && typeof value.type === 'string') {
        pending.push(value);
      }
    }
  }
}

async function requireExactDependencyFreeOwner({
  manifest, moduleInventory, outDir, chunkName, expectedModules, moduleDescription,
}) {
  const expected = new Set(requireUniqueStrings(expectedModules, `${chunkName} modules`));
  const owners = Object.entries(moduleInventory.chunks).filter(([, modules]) => (
    Array.isArray(modules) && modules.some(moduleId => expected.has(moduleId))
  ));
  if (owners.length !== 1) {
    throw new Error(`${chunkName} modules must share exactly one pure owner chunk.`);
  }
  const [assetPath, modules] = owners[0];
  if (modules.length !== expected.size || new Set(modules).size !== expected.size
    || modules.some(moduleId => !expected.has(moduleId))) {
    throw new Error(`${chunkName} must contain only ${moduleDescription}; other owners are forbidden.`);
  }
  const entries = Object.values(manifest).filter(entry => entry?.file === assetPath);
  if (entries.length !== 1 || entries[0].name !== chunkName) {
    throw new Error(`${chunkName} artifact must retain its ${chunkName} identity.`);
  }
  for (const field of ['imports', 'dynamicImports', 'css']) {
    const imports = entries[0][field];
    if (imports !== undefined && (!Array.isArray(imports) || imports.length !== 0)) {
      throw new Error(`${chunkName} must remain dependency-free with no static, dynamic, or CSS imports.`);
    }
  }
  const source = await fs.readFile(path.resolve(outDir, assetPath), 'utf8');
  assertNoEmittedImports(source, chunkName);
  return assetPath;
}

export async function checkBackgroundI18nLeafArtifactContract(outDir, options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const resolvedOutDir = path.resolve(outDir);
  const manifestPath = path.resolve(resolvedOutDir, '.vite/manifest.json');
  const moduleInventoryPath = path.resolve(
    resolvedOutDir,
    '.vite/entropy-module-inventory.json',
  );
  const manifest = await readJson(manifestPath, 'Vite manifest');
  const moduleInventory = await readJson(moduleInventoryPath, 'module inventory');
  if (!moduleInventory?.chunks || typeof moduleInventory.chunks !== 'object') {
    throw new Error('module inventory must expose a chunks object.');
  }

  const moduleContract = options.moduleContract
    || deriveBackgroundI18nArtifactModuleContract();
  const closureKeys = collectStaticManifestKeys(manifest, BACKGROUND_ENTRY_KEY);
  const closureAssets = [...closureKeys].map((key) => manifest[key].file);
  const closureModules = new Set(closureAssets.flatMap((assetPath) => {
    const modules = moduleInventory.chunks[assetPath];
    if (!Array.isArray(modules)) {
      throw new Error(`module inventory is missing background closure asset: ${assetPath}`);
    }
    return modules;
  }));

  const missingRequiredModules = moduleContract.requiredModules.filter(
    (moduleId) => !closureModules.has(moduleId),
  );
  if (missingRequiredModules.length > 0) {
    throw new Error(
      'background closure is missing metadata-derived narrow i18n owners: '
      + missingRequiredModules.join(', '),
    );
  }

  if (!Array.isArray(moduleContract.allowedLocaleModules)) {
    throw new Error('background i18n module contract must expose allowedLocaleModules.');
  }
  const allowedLocaleModules = new Set(moduleContract.allowedLocaleModules);
  const broadLocaleLeaks = [...new Set([
    ...moduleContract.forbiddenModules.filter((moduleId) => closureModules.has(moduleId)),
    ...[...closureModules].filter((moduleId) => (
      isLocaleModule(moduleId) && !allowedLocaleModules.has(moduleId)
    )),
  ])].sort();
  if (broadLocaleLeaks.length > 0) {
    throw new Error(
      `background closure absorbed broad UI i18n modules: ${broadLocaleLeaks.join(', ')}`,
    );
  }

  await requireExactDependencyFreeOwner({
    manifest, moduleInventory, outDir: resolvedOutDir,
    chunkName: BACKGROUND_LOCALE_CHUNK_NAME,
    expectedModules: moduleContract.allowedLocaleModules,
    moduleDescription: 'metadata-derived background locale leaves',
  });
  await requireExactDependencyFreeOwner({
    manifest, moduleInventory, outDir: resolvedOutDir,
    chunkName: RUNTIME_I18N_PRIMITIVES_CHUNK_NAME,
    expectedModules: RUNTIME_I18N_PRIMITIVE_MODULES,
    moduleDescription: 'the exact resource-independent runtime i18n primitives',
  });

  const leafAssets = closureAssets.filter((assetPath) => (
    moduleInventory.chunks[assetPath].some(
      (moduleId) => moduleContract.requiredModules.includes(moduleId),
    )
  ));

  return Object.freeze({
    outDir: resolvedOutDir,
    supportedLocales: moduleContract.supportedLocales,
    requiredModuleCount: moduleContract.requiredModules.length,
    forbiddenModuleCount: moduleContract.forbiddenModules.length,
    leafAssets: Object.freeze([...leafAssets]),
    rootDir,
  });
}

export async function runBackgroundI18nLeafArtifactContractCli(outDir, io = {}) {
  const writeStdout = io.writeStdout || console.log;
  const writeStderr = io.writeStderr || console.error;
  try {
    const report = await checkBackgroundI18nLeafArtifactContract(outDir, io);
    writeStdout(
      `${CHECK_PREFIX} PASS: ${report.requiredModuleCount} metadata-derived narrow owners `
      + `for ${report.supportedLocales.length} locale(s) across ${report.leafAssets.length} `
      + `closure asset(s); ${report.forbiddenModuleCount} declared broad UI modules plus every `
      + 'non-allowlisted locale module excluded.',
    );
    return 0;
  } catch (error) {
    writeStderr(`${CHECK_PREFIX} FAIL: ${error?.message || error}`);
    return 1;
  }
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const outDir = path.resolve(process.cwd(), process.argv[2] || 'dist-prod');
  process.exitCode = await runBackgroundI18nLeafArtifactContractCli(outDir);
}
