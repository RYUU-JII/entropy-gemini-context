#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectRepositoryFiles, extractImportSpecifiers } from './sourceScanUtils.mjs';

const rootDir = process.cwd();
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const scanRoots = Object.freeze([
  'src',
  'tests',
  'scripts',
]);
const sharedInternalPrefixes = Object.freeze([
  'src/themes/core/widgets/shared/',
  'src/themes/core/react/',
  'src/themes/core/motion/',
]);
const requiredPublicFiles = Object.freeze([
  'src/themes/core/widgets/shared/sites/index.js',
  'src/themes/core/widgets/shared/filter/index.js',
  'src/themes/core/widgets/shared/preview/Common.jsx',
  'src/themes/core/widgets/shared/homeBrief/index.js',
  'src/themes/core/react/useResolvedThemeState.js',
  'src/themes/core/motion/index.js',
]);
const sitesRegistryListContractFiles = Object.freeze({
  source: 'src/themes/core/widgets/shared/sites/SitesRegistryList.jsx',
  test: 'tests/sitesRegistryList.scalability.test.jsx',
});
const exactDirectoryInventories = Object.freeze([
  {
    directory: 'src/themes/core/react',
    allowedFiles: new Set(['useResolvedThemeState.js']),
    message: 'themes/core/react is reserved for the resolved theme hook seam only.',
  },
  {
    directory: 'src/themes/core/widgets/shared/preview',
    allowedFiles: new Set(['Common.jsx']),
    message: 'shared preview seam is fixed to Common.jsx until the public contract is explicitly widened.',
  },
  {
    directory: 'src/themes/core/widgets/shared/homeBrief',
    allowedFiles: new Set(['SharedHomeBriefCard.jsx', 'index.js']),
    message: 'shared home brief seam inventory changed; update the contract intentionally before widening it.',
  },
  {
    directory: 'src/themes/core/widgets/shared/filter',
    allowedFiles: new Set(['ThemeFilterTestScaffold.jsx', 'useLabSimulationState.js', 'index.js']),
    message: 'shared filter seam inventory changed; update the contract intentionally before widening it.',
  },
  {
    directory: 'src/themes/core/motion',
    allowedFiles: new Set(['dashboard.js', 'index.js', 'interaction.js']),
    message: 'theme motion seam inventory changed; update the contract intentionally before widening it.',
  },
]);
const publicImportRules = Object.freeze([
  {
    segment: 'themes/core/widgets/shared/sites/',
    allowedSegment: 'themes/core/widgets/shared/sites/index.js',
    message: 'external callers must use "@/themes/core/widgets/shared/sites/index.js".',
  },
  {
    segment: 'themes/core/widgets/shared/filter/',
    allowedSegment: 'themes/core/widgets/shared/filter/index.js',
    message: 'external callers must use "@/themes/core/widgets/shared/filter/index.js".',
  },
  {
    segment: 'themes/core/widgets/shared/preview/',
    allowedSegment: 'themes/core/widgets/shared/preview/Common.jsx',
    message: 'external callers must use "@/themes/core/widgets/shared/preview/Common.jsx".',
  },
  {
    segment: 'themes/core/widgets/shared/homeBrief/',
    allowedSegment: 'themes/core/widgets/shared/homeBrief/index.js',
    message: 'external callers must use "@/themes/core/widgets/shared/homeBrief/index.js".',
  },
  {
    segment: 'themes/core/react/',
    allowedSegment: 'themes/core/react/useResolvedThemeState.js',
    message: 'external callers must use "@/themes/core/react/useResolvedThemeState.js".',
  },
  {
    segment: 'themes/core/motion/',
    allowedSegment: 'themes/core/motion/index.js',
    message: 'external callers must use "@/themes/core/motion/index.js".',
  },
  {
    segment: 'themes/shared/',
    allowedSegment: 'themes/core/widgets/shared/',
    message: 'src/themes/shared is retired; use a canonical theme-core shared public exit.',
  },
]);
const forbiddenSharedInternalSegments = Object.freeze([
  {
    segment: '/apps/',
    message: 'shared theme seams must not import app owners directly.',
  },
  {
    segment: '/themes/plugins/',
    message: 'shared theme seams must not import theme plugin implementations directly.',
  },
  {
    segment: '/platform/',
    message: 'shared theme seams must stay presentational and must not import platform owners directly.',
  },
]);

function fail(message) {
  console.error(`[theme-shared-seams-architecture] FAIL: ${message}`);
  process.exit(1);
}

function isSharedInternalFile(relativePath) {
  return sharedInternalPrefixes.some((prefix) => relativePath.startsWith(prefix));
}

async function ensureRequiredFiles() {
  for (const relativePath of requiredPublicFiles) {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
    } catch (_error) {
      fail(`missing required shared seam public file: ${relativePath}`);
    }
  }
}

async function ensureDirectoryInventories() {
  for (const inventory of exactDirectoryInventories) {
    const dirPath = path.resolve(rootDir, inventory.directory);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    for (const fileName of files) {
      if (!inventory.allowedFiles.has(fileName)) {
        fail(`${inventory.directory}/${fileName}: ${inventory.message}`);
      }
    }

    for (const fileName of inventory.allowedFiles) {
      if (!files.includes(fileName)) {
        fail(`${inventory.directory}/${fileName}: required shared seam inventory file is missing.`);
      }
    }
  }
}

async function ensureRulesRegistryListSelectionContract() {
  const [source, testSource] = await Promise.all([
    fs.readFile(path.resolve(rootDir, sitesRegistryListContractFiles.source), 'utf8'),
    fs.readFile(path.resolve(rootDir, sitesRegistryListContractFiles.test), 'utf8'),
  ]);
  const sourceTokens = [
    'const SELECTED_INDEX_UNSET = Symbol(',
    'selectedIndex = SELECTED_INDEX_UNSET',
    'const hasDeclaredSelectedIndex = selectedIndex !== SELECTED_INDEX_UNSET;',
    'if (hasDeclaredSelectedIndex) return -1;',
  ];
  const testTokens = [
    'does not scan offscreen rows when selectedIndex explicitly declares no selection',
    'selectedIndex={-1}',
    'expect(renderItem).toHaveBeenCalledTimes(40);',
    'keeps the omitted selectedIndex element-detection fallback for existing callers',
  ];

  for (const token of sourceTokens) {
    if (!source.includes(token)) {
      fail(`${sitesRegistryListContractFiles.source}: missing bounded selection-admission token "${token}".`);
    }
  }
  for (const token of testTokens) {
    if (!testSource.includes(token)) {
      fail(`${sitesRegistryListContractFiles.test}: missing Rules registry scalability contract "${token}".`);
    }
  }
}

const sitesProjection = Object.freeze({
  entry: 'src/themes/core/widgets/shared/sites/siteIntelPresentation.js',
});

async function ensureSitesProjectionContract() {
  const { entry } = sitesProjection;
  const visited = new Set();
  const pending = [entry];
  while (pending.length) {
    const relativePath = pending.pop();
    if (visited.has(relativePath)) continue;
    visited.add(relativePath);
    if (path.extname(relativePath) !== '.js'
      || /\/src\/(?:apps|platform|ui-kit)\//u.test(`/${relativePath}`)
      || relativePath.startsWith('src/themes/plugins/')) {
      fail(`${entry}: Node-safe projection reaches a UI/platform/plugin owner: ${relativePath}`);
    }
    const moduleSource = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    for (const specifier of extractImportSpecifiers(moduleSource)) {
      if (!specifier.startsWith('.')) fail(`${entry}: pure projection must use explicit local JS owners: ${specifier}`);
      const target = path.relative(rootDir, path.resolve(rootDir, path.dirname(relativePath), specifier)).replaceAll(path.sep, '/');
      if (!target.startsWith('src/')) fail(`${entry}: pure projection dependency leaves its source boundary: ${target}`);
      pending.push(target);
    }
  }
  const publicExports = await import(pathToFileURL(path.resolve(rootDir, entry)).href);
  if (Object.keys(publicExports).length !== 1 || typeof publicExports.buildSiteIntelPresentation !== 'function') {
    fail(`${entry}: Node-only projection must expose exactly buildSiteIntelPresentation.`);
  }
}

async function main() {
  await ensureRequiredFiles();
  await ensureDirectoryInventories();
  await ensureRulesRegistryListSelectionContract();
  await ensureSitesProjectionContract();

  const filesToScan = await collectRepositoryFiles({
    rootDir,
    roots: scanRoots,
    extensions: allowedExtensions,
    excludedEntryNames: new Set(['archive']),
  });

  for (const relativePath of filesToScan) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    const specifiers = extractImportSpecifiers(source);

    if (isSharedInternalFile(relativePath)) {
      for (const specifier of specifiers) {
        for (const restriction of forbiddenSharedInternalSegments) {
          if (specifier.includes(restriction.segment)) {
            fail(`${relativePath}: ${restriction.message} Found "${specifier}".`);
          }
        }
      }
      continue;
    }

    for (const specifier of specifiers) {
      for (const rule of publicImportRules) {
        if (!specifier.includes(rule.segment)) continue;
        if (specifier.includes(rule.allowedSegment)) continue;
        fail(`${relativePath}: ${rule.message} Found "${specifier}".`);
      }
    }
  }

  console.log('[theme-shared-seams-architecture] PASS: shared theme seams stay narrow, public, and owner-safe.');
}

main().catch((error) => {
  console.error('[theme-shared-seams-architecture] Unexpected error:', error);
  process.exit(1);
});
