#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const rootDir = process.cwd();
const srcDir = path.resolve(rootDir, 'src');
const sourceFileRe = /\.(js|jsx|ts|tsx|mjs)$/;
const failures = [];
const traverse = traverseModule.default || traverseModule;

async function walk(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(nextPath)));
      continue;
    }
    if (entry.isFile() && sourceFileRe.test(entry.name)) {
      files.push(nextPath);
    }
  }

  return files;
}

const isDefaultValueKey = (node) => (
  node?.computed !== true
  && (
    (node?.key?.type === 'Identifier' && node.key.name === 'defaultValue')
    || (node?.key?.type === 'StringLiteral' && node.key.value === 'defaultValue')
  )
);

const isTranslationCallee = (node) => (
  (node?.type === 'Identifier' && node.name === 't')
  || (
    (node?.type === 'MemberExpression' || node?.type === 'OptionalMemberExpression')
    && node.computed !== true
    && node.property?.type === 'Identifier'
    && node.property.name === 't'
  )
);

export function findTranslationDefaultValueLines(source, relativePath = 'inline.js') {
  const ast = parse(source, {
    sourceType: 'unambiguous',
    sourceFilename: relativePath,
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'importAttributes',
      'topLevelAwait',
    ],
  });
  const lines = new Set();

  traverse(ast, {
    ObjectProperty(propertyPath) {
      if (!isDefaultValueKey(propertyPath.node)) return;

      let ownerPath = propertyPath.parentPath;
      while (ownerPath && !ownerPath.isStatement() && !ownerPath.isProgram()) {
        if (
          (ownerPath.isCallExpression() || ownerPath.isOptionalCallExpression())
          && isTranslationCallee(ownerPath.node.callee)
        ) {
          lines.add(propertyPath.node.loc?.start?.line || 1);
          return;
        }
        ownerPath = ownerPath.parentPath;
      }
    },
  });

  return [...lines].sort((left, right) => left - right);
}

async function main() {
  const files = await walk(srcDir);

  await Promise.all(files.map(async (absolutePath) => {
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
    const source = await fs.readFile(absolutePath, 'utf8');
    findTranslationDefaultValueLines(source, relativePath).forEach((line) => {
      failures.push(`${relativePath}:${line} translation options must not use defaultValue; locale JSON is the only copy source.`);
    });
  }));

  if (failures.length > 0) {
    console.error('[i18n-no-default-value] Contract violation detected:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
    return;
  }

  console.log(`[i18n-no-default-value] PASS: scanned ${files.length} source files without translation defaultValue copy fallbacks.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error('[i18n-no-default-value] Unexpected error:', error);
    process.exit(1);
  });
}
