#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const scopedRoots = Object.freeze([
  'src/themes/plugins/zen/widgets/core',
  'src/themes/plugins/zen/widgets/signals/signalScanner',
  'src/themes/plugins/zen/widgets/tools',
]);

const forbiddenMatchers = Object.freeze([
  {
    id: 'window.alert',
    re: /\bwindow\s*\.\s*alert\s*\(/g,
    message: 'native alert is forbidden; use shared toast API.',
  },
  {
    id: 'window.confirm',
    re: /\bwindow\s*\.\s*confirm\s*\(/g,
    message: 'native confirm is forbidden; use shared confirm dialog API.',
  },
  {
    id: 'bare alert',
    re: /(^|[^.\w$])alert\s*\(/gm,
    message: 'bare alert(...) is forbidden; use shared toast API.',
  },
]);

const supportedFileRe = /\.(js|jsx|ts|tsx)$/;
const failures = [];

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const walkFiles = async (relativePath) => {
  const abs = absolute(relativePath);
  const stats = await fs.stat(abs);

  if (stats.isFile()) {
    return supportedFileRe.test(relativePath) ? [relativePath] : [];
  }

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nestedPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(nestedPath)));
      continue;
    }
    if (entry.isFile() && supportedFileRe.test(entry.name)) {
      files.push(nestedPath);
    }
  }
  return files;
};

const computeLine = (source, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
};

const collectMatches = (content, matcher) => {
  const matches = [];
  matcher.re.lastIndex = 0;

  let result = matcher.re.exec(content);
  while (result) {
    matches.push({
      index: result.index,
      line: computeLine(content, result.index),
    });
    result = matcher.re.exec(content);
  }

  matcher.re.lastIndex = 0;
  return matches;
};

const scanFile = async (relativePath) => {
  const content = await fs.readFile(absolute(relativePath), 'utf8');

  forbiddenMatchers.forEach((matcher) => {
    const matches = collectMatches(content, matcher);
    matches.forEach(({ line }) => {
      failures.push(`${relativePath}:${line} ${matcher.id} -> ${matcher.message}`);
    });
  });
};

const main = async () => {
  const scopedFiles = [];

  for (const scopedRoot of scopedRoots) {
    try {
      const files = await walkFiles(scopedRoot);
      scopedFiles.push(...files);
    } catch {
      // Skip roots that are absent in current branch.
    }
  }

  const uniqueFiles = [...new Set(scopedFiles)];
  await Promise.all(uniqueFiles.map((file) => scanFile(file)));

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`[no-native-dialogs] ${failure}`);
    });
    process.exit(1);
    return;
  }

  console.log(`[no-native-dialogs] PASS: scanned ${uniqueFiles.length} files without native alert/confirm usage.`);
};

main().catch((error) => {
  console.error('[no-native-dialogs] Unexpected error:', error);
  process.exit(1);
});
