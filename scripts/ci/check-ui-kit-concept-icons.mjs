#!/usr/bin/env node

// Domain concepts own exactly one glyph, exported by name from the ui-kit icon
// seam. The lucide shield family once stood for five unrelated concepts; it is
// now reserved for site protection inside the seam, so any other lucide Shield*
// import is a regression to the overloaded vocabulary.

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const scanRoot = 'src';
const iconSeam = 'src/ui-kit/Icons.jsx';
const supportedFileRe = /\.(js|jsx|ts|tsx|mjs|cjs)$/;
const lucideImportRe = /import\s+([^;]*?)\s+from\s+['"](lucide-react(?:\/[^'"]*)?)['"]/gs;
const shieldBindingRe = /\b(?:Lucide)?Shield\w*/g;
const shieldDeepPathRe = /\/icons\/shield[\w-]*(?:\.js)?$/;

async function walkFiles(relativePath) {
  const entries = await fs.readdir(path.resolve(rootDir, relativePath), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nestedPath = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(nestedPath)));
    } else if (entry.isFile() && supportedFileRe.test(entry.name)) {
      files.push(nestedPath);
    }
  }
  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

const failures = [];
for (const file of await walkFiles(scanRoot)) {
  if (file === iconSeam) continue;
  const source = await fs.readFile(path.resolve(rootDir, file), 'utf8');
  lucideImportRe.lastIndex = 0;
  let match = lucideImportRe.exec(source);
  while (match) {
    const [, clause, specifier] = match;
    const names = clause.match(shieldBindingRe) ?? [];
    if (shieldDeepPathRe.test(specifier)) names.push(specifier);
    for (const name of names) {
      failures.push(`${file}:${lineOf(source, match.index)} imports lucide ${name}`);
    }
    match = lucideImportRe.exec(source);
  }
}

if (failures.length > 0) {
  console.error('[ui-kit-concept-icons] FAIL: lucide Shield* icons belong to the icon seam only.');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`Import the concept icon (SiteProtectionIcon, ProtectionReleaseIcon, ...) from ${iconSeam}.`);
  process.exit(1);
}

console.log('[ui-kit-concept-icons] PASS');
