#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadESLint } from 'eslint';

const args = process.argv.slice(2);
if (args[0] === '--files-from-stdin') {
  if (args.length !== 1) throw new Error('LINT_FILE_LIST_OPTIONS_INVALID');
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  const files = JSON.parse(input);
  if (!Array.isArray(files) || files.length === 0 || files.some(file => typeof file !== 'string' || !file.trim())) {
    throw new Error('LINT_FILE_LIST_INVALID');
  }
  // Keep pushed ranges larger than Windows' command-line limit in-process.
  const ESLint = await loadESLint();
  const eslint = new ESLint({ cache: true });
  const results = await eslint.lintFiles(files);
  const formatter = await eslint.loadFormatter('stylish');
  const output = formatter.format(results);
  if (output) process.stdout.write(output);
  process.exit(results.some(result => result.errorCount > 0 || result.fatalErrorCount > 0) ? 1 : 0);
}

const require = createRequire(import.meta.url);
const eslintBin = path.join(path.dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js');
const lintResult = spawnSync(
  process.execPath,
  [
    eslintBin,
    ...(args.length > 0 ? args : ['src']),
    '--ext',
    '.js,.jsx',
    '--cache',
  ],
  { stdio: 'inherit' },
);

if (lintResult.error) console.error(lintResult.error);
process.exit(lintResult.status ?? 1);
