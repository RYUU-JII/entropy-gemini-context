#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const outDir = path.resolve(rootDir, process.argv[2] || 'dist-prod');
const dynamicCodePatterns = Object.freeze([
  { label: 'new Function', pattern: /\bnew\s+Function\s*\(/ },
  { label: 'Function(string)', pattern: /(^|[^\w$])Function\s*\(\s*(['"`])/ },
  { label: 'eval', pattern: /(^|[^\w$])eval\s*\(/ },
  { label: 'importScripts', pattern: /(^|[^\w$])importScripts\s*\(/ },
  { label: 'external script', pattern: /<script\b[^>]+\bsrc\s*=\s*(['"])https?:\/\//i },
]);
const scannedExtensions = new Set(['.js', '.mjs', '.cjs', '.html']);
const ignoredExtensions = new Set(['.map']);

const fail = (message) => {
  console.error(`[dist-no-dynamic-code] FAIL: ${message}`);
  process.exit(1);
};

const collectFiles = (dir, files = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    const extension = path.extname(entry.name);
    if (ignoredExtensions.has(extension)) continue;
    if (scannedExtensions.has(extension)) {
      files.push(fullPath);
    }
  }
  return files;
};

const findLine = (content, index) => {
  let line = 1;
  for (let offset = 0; offset < index; offset += 1) {
    if (content.charCodeAt(offset) === 10) {
      line += 1;
    }
  }
  return line;
};

const main = () => {
  if (!fs.existsSync(outDir)) {
    fail(`Output directory not found: ${path.relative(rootDir, outDir)}`);
  }

  const findings = [];
  for (const filePath of collectFiles(outDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const { label, pattern } of dynamicCodePatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(content);
      if (!match) continue;
      findings.push({
        filePath,
        label,
        line: findLine(content, match.index),
      });
    }
  }

  if (findings.length > 0) {
    console.error('[dist-no-dynamic-code] Dynamic-code-like patterns were found in built artifacts:');
    findings.forEach((finding) => {
      console.error(
        `  - ${path.relative(rootDir, finding.filePath)}:${finding.line} (${finding.label})`,
      );
    });
    process.exit(1);
    return;
  }

  console.log(`[dist-no-dynamic-code] PASS: scanned ${path.relative(rootDir, outDir)}.`);
};

main();
