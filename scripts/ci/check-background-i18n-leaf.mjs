#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  I18N_NAMESPACES,
  I18N_SUPPORTED_LOCALES,
} from '../../src/i18n/metadata.js';
import {
  BACKGROUND_LOCALE_PROJECTION,
  projectBackgroundLocaleResources,
} from '../i18n/background-locale-projection.mjs';
import {
  createBackgroundResourcesModuleContent,
} from '../i18n/generate-locale-modules.mjs';

const ROOT = process.cwd();
const failures = [];

async function read(relativePath) {
  return readFile(path.resolve(ROOT, relativePath), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(source, token, filePath) {
  if (!source.includes(token)) fail(`${filePath}: missing required token ${token}`);
}

function assertExcludes(source, token, filePath) {
  if (source.includes(token)) fail(`${filePath}: forbidden broad-runtime token ${token}`);
}

function assertEquals(actual, expected, filePath, message) {
  if (actual !== expected) fail(`${filePath}: ${message}`);
}

function sorted(values) {
  return [...values].sort();
}

function collectStaticKeys(source, pattern) {
  return new Set([...source.matchAll(pattern)].map((match) => match[1]));
}

const nudgeCopyPath = 'src/domains/settings/i18n/nudgeCopy.js';
const notificationCatalogPath = 'src/domains/notifications/background/notificationCatalog.js';
const notificationServicePath = 'src/domains/notifications/background/NotificationService.js';
const notificationCopyResolverPath = (
  'src/domains/notifications/background/notificationCopyResolver.js'
);
const backgroundResourcesPath = 'src/i18n/backgroundResources.js';
const backgroundRuntimePath = 'src/domains/settings/i18n/backgroundRuntime.js';
const coreServicesPath = 'src/apps/background/services/runtime/backgroundKernelCoreServices.js';

const [
  nudgeCopySource,
  notificationCatalogSource,
  notificationServiceSource,
  notificationCopyResolverSource,
  backgroundResourcesSource,
  backgroundRuntimeSource,
  coreServicesSource,
] = await Promise.all([
  read(nudgeCopyPath),
  read(notificationCatalogPath),
  read(notificationServicePath),
  read(notificationCopyResolverPath),
  read(backgroundResourcesPath),
  read(backgroundRuntimePath),
  read(coreServicesPath),
]);

const expectedNotificationKeys = new Set(
  BACKGROUND_LOCALE_PROJECTION.settings.map((key) => `settings:${key}`),
);
const catalogNotificationKeys = collectStaticKeys(
  notificationCatalogSource,
  /(?:titleKey|messageKey):\s*['"]([^'"]+)['"]/gu,
);
try {
  assert.deepEqual(sorted(catalogNotificationKeys), sorted(expectedNotificationKeys));
} catch {
  fail('notification catalog copy keys must exactly match the background settings projection');
}

const expectedNudgeKeys = new Set(
  BACKGROUND_LOCALE_PROJECTION.tools.map((key) => `tools:${key}`),
);
const nudgeCopyKeys = collectStaticKeys(
  nudgeCopySource,
  /['"](tools:sentinel_flare_protocol\.[A-Za-z0-9_]+)['"]/gu,
);
try {
  assert.deepEqual(sorted(nudgeCopyKeys), sorted(expectedNudgeKeys));
} catch {
  fail('Sentinel nudge copy keys must exactly match the background tools projection');
}

const broadLocaleModuleTokens = I18N_SUPPORTED_LOCALES.flatMap((locale) => (
  I18N_NAMESPACES.map((namespace) => `locales/${locale}/${namespace}.js`)
));
const broadToolsModuleTokens = I18N_SUPPORTED_LOCALES.map(
  (locale) => `locales/${locale}/tools.js`,
);

for (const [source, filePath, forbiddenTokens] of [
  [notificationServiceSource, notificationServicePath, [
    'settings/i18n/runtime.js',
    'i18n/resources.js',
    'i18n/locales/',
  ]],
  [nudgeCopySource, nudgeCopyPath, [
    ...broadToolsModuleTokens,
    "from './runtime.js'",
    'i18n/resources.js',
  ]],
  [backgroundRuntimeSource, backgroundRuntimePath, [
    'i18n/resources.js',
    ...broadLocaleModuleTokens,
  ]],
]) {
  for (const token of forbiddenTokens) assertExcludes(source, token, filePath);
}

assertIncludes(nudgeCopySource, "from './backgroundRuntime.js'", nudgeCopyPath);
assertIncludes(notificationServiceSource, 'NOTIFICATION_COPY_RESOLVER_REQUIRED', notificationServicePath);
assertIncludes(notificationServiceSource, 'resolveLocalizedCopy', notificationServicePath);
assertIncludes(
  notificationCopyResolverSource,
  "from '../../settings/i18n/backgroundRuntime.js'",
  notificationCopyResolverPath,
);
assertIncludes(
  notificationCopyResolverSource,
  'runtimeLanguageRepository.get(I18N_FALLBACK_LANGUAGE)',
  notificationCopyResolverPath,
);
assertEquals(
  backgroundResourcesSource,
  createBackgroundResourcesModuleContent(),
  backgroundResourcesPath,
  'generated locale registry must exactly match I18N_SUPPORTED_LOCALES metadata',
);
assertIncludes(coreServicesSource, 'createNotificationCopyResolver({', coreServicesPath);
assertIncludes(coreServicesSource, 'runtimeLanguageRepository,', coreServicesPath);
assertIncludes(coreServicesSource, 'resolveLocalizedCopy: resolveNotificationCopy', coreServicesPath);

for (const locale of I18N_SUPPORTED_LOCALES) {
  const resourcesByNamespace = {};
  for (const namespace of Object.keys(BACKGROUND_LOCALE_PROJECTION)) {
    resourcesByNamespace[namespace] = JSON.parse(
      await read(`src/i18n/locales/${locale}/${namespace}.json`),
    );
  }
  const expectedLeaf = projectBackgroundLocaleResources(resourcesByNamespace);
  const leafPath = `src/i18n/locales/${locale}/backgroundRuntime.js`;
  const leafModule = await import(
    `${pathToFileURL(path.resolve(ROOT, leafPath)).href}?guard=${Date.now()}-${locale}`
  );
  try {
    assert.deepEqual(leafModule.default, expectedLeaf);
  } catch {
    fail(`${leafPath}: generated leaf does not match canonical locale JSON projection`);
  }

  for (const namespace of Object.keys(BACKGROUND_LOCALE_PROJECTION)) {
    const namespacePath = `src/i18n/locales/${locale}/${namespace}.js`;
    const namespaceSource = await read(namespacePath);
    assertIncludes(namespaceSource, "from './backgroundRuntime.js'", namespacePath);
    const namespaceModule = await import(
      `${pathToFileURL(path.resolve(ROOT, namespacePath)).href}?guard=${Date.now()}-${locale}`
    );
    try {
      assert.deepEqual(namespaceModule.default, resourcesByNamespace[namespace]);
    } catch {
      fail(`${namespacePath}: UI namespace assembly must reconstruct canonical locale JSON exactly`);
    }
  }
}

if (failures.length > 0) {
  console.error('[background-i18n-leaf] Contract violation detected:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  '[background-i18n-leaf] PASS: notification and Sentinel copy use generated narrow locale leaves shared with UI namespace assembly.',
);
