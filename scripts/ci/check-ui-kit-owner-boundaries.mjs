#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const scanRoot = 'src/ui-kit';
const requiredPublicFiles = Object.freeze([
  'src/themes/core/widgets/shared/sites/index.js',
  'src/themes/core/widgets/shared/filter/index.js',
  'src/themes/core/widgets/shared/preview/Common.jsx',
  'src/themes/core/react/useResolvedThemeState.js',
]);
const restrictions = Object.freeze([
  {
    segment: 'apps/dashboard/',
    allowedSegment: null,
    message: 'ui-kit must stay dashboard-neutral.',
  },
  {
    segment: 'themes/core/widgets/shared/sites/',
    allowedSegment: 'themes/core/widgets/shared/sites/index.js',
    message: 'ui-kit must use "@/themes/core/widgets/shared/sites/index.js" instead of deep-importing rules internals.',
  },
  {
    segment: 'themes/core/widgets/shared/filter/',
    allowedSegment: 'themes/core/widgets/shared/filter/index.js',
    message: 'ui-kit must use "@/themes/core/widgets/shared/filter/index.js" instead of deep-importing filter internals.',
  },
  {
    segment: 'themes/core/widgets/shared/preview/',
    allowedSegment: 'themes/core/widgets/shared/preview/Common.jsx',
    message: 'ui-kit must use "@/themes/core/widgets/shared/preview/Common.jsx" as the only preview shared seam.',
  },
  {
    segment: 'themes/core/react/',
    allowedSegment: 'themes/core/react/useResolvedThemeState.js',
    message: 'ui-kit must use "@/themes/core/react/useResolvedThemeState.js" instead of deep-importing theme react internals.',
  },
]);

function fail(message) {
  console.error(`[ui-kit-owner-boundaries] FAIL: ${message}`);
  process.exit(1);
}

function extractImportSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /from\s+['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /vi\.mock\(\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return Array.from(new Set(specifiers));
}

async function collectFiles(relativeDir) {
  const dirPath = path.resolve(rootDir, relativeDir);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'archive') continue;
    const resolved = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(path.relative(rootDir, resolved).replaceAll(path.sep, '/')));
      continue;
    }
    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    files.push(path.relative(rootDir, resolved).replaceAll(path.sep, '/'));
  }

  return files;
}

async function ensureRequiredFiles() {
  for (const relativePath of requiredPublicFiles) {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
    } catch (_error) {
      fail(`missing required public theme seam: ${relativePath}`);
    }
  }
}

async function main() {
  await ensureRequiredFiles();
  const files = await collectFiles(scanRoot);

  for (const relativePath of files) {
    const source = await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
    const specifiers = extractImportSpecifiers(source);

    for (const specifier of specifiers) {
      for (const restriction of restrictions) {
        if (!specifier.includes(restriction.segment)) continue;
        if (restriction.allowedSegment && specifier.includes(restriction.allowedSegment)) continue;
        fail(`${relativePath}: ${restriction.message} Found "${specifier}".`);
      }
    }
  }

  console.log('[ui-kit-owner-boundaries] PASS: ui-kit stays dashboard-neutral and uses only public theme seams.');
}

main().catch((error) => {
  console.error('[ui-kit-owner-boundaries] Unexpected error:', error);
  process.exit(1);
});
