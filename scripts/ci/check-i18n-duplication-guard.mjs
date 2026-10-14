#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { I18N_SUPPORTED_LOCALES } from '../../src/i18n/metadata.js';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src/i18n/locales');
const DOC_PATH = 'docs/architecture/i18n/locale-duplication-audit.md';
const failures = [];

const promotedCommonPaths = [
  'status.loading',
  'status.error',
  'action.close',
  'prev',
  'next',
];

const retiredDuplicatePaths = [
  ...['main', 'tools'].flatMap((namespace) =>
    ['nav', 'title', 'desc'].flatMap((field) =>
      ['', '_zen', '_clinical', '_entropy', '_matrix', '_cyberpunk', '_scp'].map((suffix) => ({
        namespace,
        key: `${namespace}.${field}${suffix}`,
      })),
    ),
  ),
  { namespace: 'filter', key: 'common.loading' },
  { namespace: 'filter', key: 'common.error' },
  { namespace: 'schedule', key: 'common.loading' },
  { namespace: 'schedule', key: 'common.error' },
  { namespace: 'sites', key: 'common.loading' },
  { namespace: 'sites', key: 'common.error' },
  { namespace: 'sites', key: 'common.prev' },
  { namespace: 'sites', key: 'common.next' },
  { namespace: 'sites', key: 'matrix.common.prev' },
  { namespace: 'sites', key: 'matrix.common.next' },
  { namespace: 'main', key: 'target_protocol.close' },
  { namespace: 'sites', key: 'target_protocol.close' },
];

function readLocale(locale, namespace) {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getAtPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return current[segment];
  }, value);
}

for (const locale of I18N_SUPPORTED_LOCALES) {
  const commonLocale = readLocale(locale, 'common');

  for (const promotedPath of promotedCommonPaths) {
    const promotedValue = getAtPath(commonLocale, promotedPath);
    if (typeof promotedValue !== 'string' || promotedValue.trim().length === 0) {
      failures.push(`${locale}/common.json is missing promoted shared key "${promotedPath}".`);
    }
  }

  for (const retiredPath of retiredDuplicatePaths) {
    const localeValue = readLocale(locale, retiredPath.namespace);
    const duplicateValue = getAtPath(localeValue, retiredPath.key);
    if (typeof duplicateValue !== 'undefined') {
      failures.push(
        `${locale}/${retiredPath.namespace}.json keeps retired duplicate key "${retiredPath.key}". Use the promoted common key instead. See ${DOC_PATH}.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('[i18n-duplication-guard] Contract violation detected:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[i18n-duplication-guard] PASS: promoted shared locale keys remain centralized and retired duplicate paths stay removed.');
