#!/usr/bin/env node
import { chmodSync, constants, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const gitEntry = path.join(repoRoot, '.git');
const sourceHook = path.join(repoRoot, '.githooks', 'pre-push');

if (!existsSync(gitEntry)) {
  console.log('[hooks] .git entry not found. Skipping hook install.');
  process.exit(0);
}

if (!existsSync(sourceHook)) {
  console.log('[hooks] Source hook not found:', sourceHook);
  process.exit(1);
}

// Git owns hook placement, including linked worktrees and core.hooksPath.
const gitHooksPath = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
if (!gitHooksPath) throw new Error('GIT_HOOKS_PATH_REQUIRED');
const hooksDir = path.resolve(repoRoot, gitHooksPath);
const targetHook = path.join(hooksDir, 'pre-push');

mkdirSync(hooksDir, { recursive: true });
if (sourceHook !== targetHook) {
  copyFileSync(sourceHook, targetHook, constants.COPYFILE_FICLONE);
}

if (process.platform !== 'win32') {
  chmodSync(targetHook, 0o755);
}

console.log('[hooks] Installed pre-push hook:', targetHook);
