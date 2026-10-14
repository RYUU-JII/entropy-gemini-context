#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { getBuildCheckPlan } from './buildCheckManifest.mjs';

const rootDir = process.cwd();
const failures = [];
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);

const CANONICAL_OWNER_FILE = 'src/themes/core/state/themePreferenceRepository.js';

const APPROVED_THEME_PREFERENCE_KEY_FILES = new Set([
  CANONICAL_OWNER_FILE,
  'src/themes/core/state/themePreferenceMirror.js',
  'src/apps/dashboard/stores/usePreferenceStore.js',
  'src/domains/settings/config/settingsCommandContract.js',
  'src/domains/settings/config/settingsConfig.js',
  'src/platform/storage/internal/chrome-storage/storageKeyRegistry.js',
  'src/themes/core/state/themeStateRegistry.js',
]);

const APPROVED_THEME_PREFERENCE_REPOSITORY_IMPORT_FILES = new Set([
  'src/apps/background/services/boot/BootPrewarmService.js',
  'src/apps/dashboard/stores/usePreferenceStore.js',
  'src/domains/nudge/indicator/themeAdapter.js',
  'src/domains/protection/background/ProtectionDispatcher.js',
  'src/themes/core/documentTheme.js',
  'src/themes/core/friction/context.js',
]);

const REQUIRED_SOURCE_CONTRACTS = Object.freeze([
  {
    file: 'src/themes/core/state/themePreferenceRepository.js',
    includes: [
      '../../../platform/storage/settings/ThemePreferenceSettingsQueryService.js',
      '../../../platform/storage/internal/chrome-storage/storageChangeBus.js',
      'addChromeStorageChangedListener',
      'removeChromeStorageChangedListener',
    ],
  },
  {
    file: 'src/themes/core/state/themePreferenceRepository.js',
    includes: [
      './themePreferenceMirror.js',
      'readCanonicalThemePreferenceMirrorCandidate',
      'writeCanonicalThemePreferenceMirror',
    ],
  },
  {
    file: 'src/themes/core/state/themePreferenceMirror.js',
    includes: [
      'THEME_PREFERENCE_STORAGE_KEY',
      'readThemePreferenceMirror',
      'resolveThemePreferenceMirrorCandidate',
      'writeThemePreferenceMirror',
    ],
  },
  {
    file: 'src/apps/background/services/boot/BootPrewarmService.js',
    includes: [
      '../../../../themes/core/state/themePreferenceRepository.js',
      'readStoredThemePreference',
      'resolveKnownThemeId',
    ],
  },
  {
    file: 'src/apps/dashboard/bootstrap/dashboardBootShellThemeContext.js',
    includes: [
      '../../../themes/core/state/themePreferenceMirror.js',
      'readThemePreferenceMirror',
    ],
  },
  {
    file: 'src/domains/nudge/indicator/themeAdapter.js',
    includes: [
      '../../../themes/core/state/themePreferenceRepository.js',
      'resolveThemePreferenceMirrorStorageEvent',
      'subscribeStoredThemePreference',
    ],
  },
  {
    file: 'src/domains/protection/background/ProtectionDispatcher.js',
    includes: [
      '../../../themes/core/state/themePreferenceRepository.js',
      'readStoredThemePreference',
    ],
  },
]);

const FORBIDDEN_SOURCE_CONTRACTS = Object.freeze([
  {
    file: 'src/themes/core/state/themePreferenceRepository.js',
    excludes: [
      'platform/storage/settings/SettingsQueryService.js',
      'readSettingsSnapshot(',
    ],
  },
]);

const REQUIRED_DOC_CONTRACTS = Object.freeze([
  {
    file: 'docs/governance/import-boundaries.md',
    includes: [
      'src/themes/core/state/themePreferenceRepository.js',
      'app-theme read',
      'storageChangeBus.js',
    ],
  },
  {
    file: 'docs/system-architecture/03-theme-plugin-and-zen.md',
    includes: [
      'src/themes/core/state/themePreferenceRepository.js',
      'canonical read owner for `app-theme`',
      'storageChangeBus.js',
    ],
  },
]);

const REQUIRED_PACKAGE_CONTRACTS = Object.freeze([
  {
    script: 'check:theme-preference:owner-architecture',
    includes: ['node ./scripts/ci/check-theme-preference-owner-architecture.mjs'],
  },
  {
    script: 'dev',
    includesAny: [
      'npm run check:theme-preference:owner-architecture',
      'node ./scripts/ci/run-build-checks.mjs',
    ],
  },
  {
    script: 'prebuild:release',
    includesAny: [
      'npm run check:theme-preference:owner-architecture',
      'node ./scripts/ci/run-build-checks.mjs',
    ],
  },
  {
    script: 'build:release',
    includesAny: [
      'npm run check:theme-preference:owner-architecture',
      'node ./scripts/ci/run-build-checks.mjs',
    ],
  },
]);

const themePreferenceKeyPattern = /['"]app-theme['"]/g;
const repositoryImportPattern = /from\s+['"][^'"]*themes\/core\/state\/themePreferenceRepository\.js['"]/g;

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const addFailure = (message) => {
  failures.push(message);
};

const readUtf8 = async (relativePath) => (
  fs.readFile(absolute(relativePath), 'utf8')
);

async function walkFiles(relativePath) {
  const targetPath = absolute(relativePath);
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelativePath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(nextRelativePath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    files.push(nextRelativePath.replaceAll(path.sep, '/'));
  }

  return files;
}

async function ensureCanonicalOwnerExists() {
  try {
    await fs.access(absolute(CANONICAL_OWNER_FILE));
  } catch {
    addFailure(`missing canonical owner file: ${CANONICAL_OWNER_FILE}`);
  }
}

async function ensureRequiredSourceContracts() {
  await Promise.all(REQUIRED_SOURCE_CONTRACTS.map(async ({ file, includes }) => {
    const source = await readUtf8(file);
    includes.forEach((token) => {
      if (!source.includes(token)) {
        addFailure(`${file}: missing required theme preference owner contract token "${token}".`);
      }
    });
  }));
}

async function ensureForbiddenSourceContracts() {
  await Promise.all(FORBIDDEN_SOURCE_CONTRACTS.map(async ({ file, excludes }) => {
    const source = await readUtf8(file);
    excludes.forEach((token) => {
      if (source.includes(token)) {
        addFailure(`${file}: forbidden theme preference owner token "${token}" is still present.`);
      }
    });
  }));
}

async function ensureStrictThemePreferenceReadContract() {
  const source = await readUtf8(CANONICAL_OWNER_FILE);
  const match = source.match(
    /export async function readStoredThemePreferenceCandidate[\s\S]*?\nexport function readStoredThemePreferenceCandidateFromSnapshot/,
  );
  if (!match) {
    addFailure(`${CANONICAL_OWNER_FILE}: missing readStoredThemePreferenceCandidate contract body.`);
    return;
  }
  if (/\bcatch\s*\(/.test(match[0])) {
    addFailure(`${CANONICAL_OWNER_FILE}: canonical app-theme read failures must propagate instead of returning null/default theme.`);
  }
}

async function ensureRequiredDocContracts() {
  await Promise.all(REQUIRED_DOC_CONTRACTS.map(async ({ file, includes }) => {
    const source = await readUtf8(file);
    includes.forEach((token) => {
      if (!source.includes(token)) {
        addFailure(`${file}: missing required theme preference owner documentation token "${token}".`);
      }
    });
  }));
}

async function ensurePackageContracts() {
  const pkg = JSON.parse(await readUtf8('package.json'));
  const scripts = pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};

  for (const phase of ['prebuild', 'release', 'structural']) {
    if (!getBuildCheckPlan(phase, { packageScripts: scripts })
      .some((check) => check.script === 'check:theme-preference:owner-architecture')) {
      addFailure(`Theme preference owner architecture must run in the ${phase} check phase.`);
    }
  }

  REQUIRED_PACKAGE_CONTRACTS.forEach(({ script, includes = [], includesAny = [] }) => {
    const command = scripts[script];
    if (typeof command !== 'string' || !command.trim()) {
      addFailure(`package.json: missing script "${script}" for theme preference owner architecture.`);
      return;
    }
    includes.forEach((token) => {
      if (!command.includes(token)) {
        addFailure(`package.json#scripts.${script}: missing "${token}".`);
      }
    });

    if (
      includesAny.length > 0
      && !includesAny.some((token) => command.includes(token))
    ) {
      addFailure(
        `package.json#scripts.${script}: missing one of ${includesAny.map((token) => `"${token}"`).join(', ')}.`,
      );
    }
  });
}

async function ensureOwnerBoundaries() {
  const files = await walkFiles('src');

  await Promise.all(files.map(async (relativePath) => {
    const source = await readUtf8(relativePath);

    if (
      themePreferenceKeyPattern.test(source)
      && !APPROVED_THEME_PREFERENCE_KEY_FILES.has(relativePath)
    ) {
      addFailure(
        `${relativePath}: raw "app-theme" ownership is restricted to canonical repository, storage metadata, registry coverage, and settings command patch surfaces.`,
      );
    }
    themePreferenceKeyPattern.lastIndex = 0;

    if (
      repositoryImportPattern.test(source)
      && !APPROVED_THEME_PREFERENCE_REPOSITORY_IMPORT_FILES.has(relativePath)
    ) {
      addFailure(
        `${relativePath}: themePreferenceRepository import is restricted to approved theme preference read owners.`,
      );
    }
    repositoryImportPattern.lastIndex = 0;
  }));
}

async function main() {
  await ensureCanonicalOwnerExists();
  await ensureRequiredSourceContracts();
  await ensureForbiddenSourceContracts();
  await ensureStrictThemePreferenceReadContract();
  await ensureRequiredDocContracts();
  await ensurePackageContracts();
  await ensureOwnerBoundaries();

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`[theme-preference-owner-architecture] FAIL: ${failure}`);
    });
    process.exit(1);
  }

  console.log('[theme-preference-owner-architecture] PASS: theme preference read ownership remains locked to the canonical repository seam.');
}

main().catch((error) => {
  console.error('[theme-preference-owner-architecture] Unexpected error:', error);
  process.exit(1);
});
