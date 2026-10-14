#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const scanRoots = [
  'src/apps/background',
  'src/apps/content',
  'src/platform',
];
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs']);
const allowedRawGlobalFiles = new Set([
  'src/platform/extension/extensionApi.js',
  'src/apps/content/loader.js',
  'src/apps/content/mediaFrameProbe.js',
]);

const rawGlobalPattern = /\btypeof\s+(?:chrome|browser)\b|\bglobalThis\.(?:chrome|browser)\b|\b(?:chrome|browser)\?\./g;
const directApiPattern = /\b(?:chrome|browser)\.(?:runtime|tabs|storage|scripting|permissions|alarms|notifications|history|bookmarks|idle|webNavigation|windows)\b/g;
const failures = [];

const toPosix = (targetPath) => path.relative(rootDir, targetPath).split(path.sep).join('/');

async function listSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(entryPath));
    } else if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function scanPattern(filePath, text, pattern, message) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    failures.push(`${toPosix(filePath)}:${lineForOffset(text, match.index)} ${message} [match=${match[0]}]`);
  }
}

function stripCommentsAndStrings(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
    .replace(/\/\/[^\n\r]*/g, (match) => ' '.repeat(match.length))
    .replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, (match) => ' '.repeat(match.length));
}

for (const root of scanRoots) {
  const rootPath = path.resolve(rootDir, root);
  const files = await listSourceFiles(rootPath);
  for (const filePath of files) {
    const relPath = toPosix(filePath);
    if (allowedRawGlobalFiles.has(relPath)) continue;
    const text = stripCommentsAndStrings(await fs.readFile(filePath, 'utf8'));
    scanPattern(
      filePath,
      text,
      rawGlobalPattern,
      'Raw extension namespace probing must stay in src/platform/extension/extensionApi.js.',
    );
    scanPattern(
      filePath,
      text,
      directApiPattern,
      'Direct extension API access must go through platform extension/browser ports.',
    );
  }
}

if (failures.length) {
  console.error('[extension-api-boundaries] FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[extension-api-boundaries] PASS');
