#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import {
  getDomFastTests,
  getCriticalDomTests,
  getCriticalLogicTests,
  getRootThemeLogicFastTests,
  isRootThemeLogicFastTest,
} from '../dev/fastTestProfile.mjs';

const repoRoot = process.cwd();
const lockDir = path.join(os.tmpdir(), 'entropy-pre-push-verify.lock');
const lockInfoPath = path.join(lockDir, 'owner.json');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const gitExecutable = 'git';
const verifyMode = String(process.env.ENTROPY_PRE_PUSH_MODE || 'fast').trim().toLowerCase();
const rawPrePushBuildMode = String(process.env.ENTROPY_PRE_PUSH_BUILD || 'manual').trim().toLowerCase();
const verifyScriptByMode = {
  fast: 'verify:pre-push',
  strict: 'verify:pre-push:strict',
  full: 'verify:pre-push:full',
};
const verifyScript = verifyScriptByMode[verifyMode];
const normalizePrePushBuildMode = (mode) => {
  if (['always', 'all', 'force', '1', 'true', 'yes'].includes(mode)) return 'always';
  if (['manual', 'skip', 'none', '0', 'false', 'off'].includes(mode)) return 'manual';
  if (['critical', 'auto', 'default'].includes(mode)) return 'critical';
  return null;
};
const prePushBuildMode = normalizePrePushBuildMode(rawPrePushBuildMode);
const ZERO_SHA = /^0+$/u;
const DOM_FAST_TESTS = new Set(getDomFastTests());
const CRITICAL_LOGIC_TESTS = getCriticalLogicTests();
const CRITICAL_DOM_TESTS = getCriticalDomTests();
const ROOT_THEME_LOGIC_TESTS = new Set(getRootThemeLogicFastTests());
const PACKAGE_JSON_BUILD_SAFE_SCRIPT_PREFIXES = Object.freeze([
  '"doctor:',
  '"dev',
  '"hooks:',
  '"lint',
  '"prepare"',
  '"profile:',
  '"test',
  '"verify:',
]);

const readJson = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const processExists = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const removeLockDir = () => {
  fs.rmSync(lockDir, { recursive: true, force: true });
};

const acquireLock = () => {
  try {
    fs.mkdirSync(lockDir);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;

    const owner = readJson(lockInfoPath);
    if (owner?.repoRoot === repoRoot && processExists(owner?.pid)) {
      console.error(
        `[pre-push] Another verify is already running for this repo (pid ${owner.pid}).`,
      );
      process.exit(1);
    }

    removeLockDir();
    fs.mkdirSync(lockDir);
  }

  fs.writeFileSync(
    lockInfoPath,
    JSON.stringify({
      pid: process.pid,
      repoRoot,
      startedAt: new Date().toISOString(),
    }),
  );
};

const cleanupAndExit = (code = 0) => {
  removeLockDir();
  process.exit(code);
};

const readStdin = async () => {
  if (process.stdin.isTTY) {
    return '';
  }

  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
};

const runGit = (args) => {
  const result = spawnSync(gitExecutable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return null;
  }
  return String(result.stdout || '').trim();
};

const normalizePath = (filePath) => String(filePath || '').replace(/\\/g, '/');

const parseHookRefs = (stdinText) => String(stdinText || '')
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/u);
    return {
      localRef,
      localSha,
      remoteRef,
      remoteSha,
    };
  })
  .filter((entry) => entry.localSha && entry.remoteSha);

const resolveDefaultRemoteBranch = () => {
  const symbolicRef = runGit(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (symbolicRef) {
    return symbolicRef.replace(/^refs\/remotes\//u, '');
  }

  for (const candidate of ['origin/main', 'origin/master']) {
    if (runGit(['rev-parse', '--verify', candidate])) {
      return candidate;
    }
  }

  return null;
};

const resolveNewBranchBase = (localSha) => {
  const upstreamRef = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  if (upstreamRef) {
    const mergeBase = runGit(['merge-base', localSha, upstreamRef]);
    if (mergeBase) {
      return mergeBase;
    }
  }

  const defaultRemoteBranch = resolveDefaultRemoteBranch();
  if (defaultRemoteBranch) {
    const mergeBase = runGit(['merge-base', localSha, defaultRemoteBranch]);
    if (mergeBase) {
      return mergeBase;
    }
  }

  return runGit(['rev-parse', `${localSha}^`]);
};

const getEffectiveRefSpecs = (refSpecs) => {
  const fallbackHead = runGit(['rev-parse', 'HEAD']);
  return refSpecs.length > 0
    ? refSpecs
    : [{
      localRef: 'HEAD',
      localSha: fallbackHead,
      remoteRef: '',
      remoteSha: runGit(['rev-parse', '--verify', '@{upstream}']) || '',
    }];
};

const resolveDiffPairs = (refSpecs) => {
  const diffPairs = [];
  for (const entry of getEffectiveRefSpecs(refSpecs)) {
    if (!entry.localSha || ZERO_SHA.test(entry.localSha)) {
      continue;
    }

    const baseSha = entry.remoteSha && !ZERO_SHA.test(entry.remoteSha)
      ? entry.remoteSha
      : resolveNewBranchBase(entry.localSha);

    if (!baseSha) {
      continue;
    }

    diffPairs.push({ baseSha, localSha: entry.localSha });
  }
  return diffPairs;
};

const collectChangedFiles = (diffPairs) => {
  const changedFiles = new Set();

  for (const entry of diffPairs) {
    const diffOutput = runGit([
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      `${entry.baseSha}..${entry.localSha}`,
    ]);

    for (const filePath of String(diffOutput || '').split(/\r?\n/u)) {
      const normalized = normalizePath(filePath.trim());
      if (normalized) {
        changedFiles.add(normalized);
      }
    }
  }

  return [...changedFiles].sort();
};

const collectFileDiffLines = (diffPairs, filePath) => {
  const changedLines = [];

  for (const entry of diffPairs) {
    const diffOutput = runGit([
      'diff',
      '--unified=0',
      `${entry.baseSha}..${entry.localSha}`,
      '--',
      filePath,
    ]);

    for (const line of String(diffOutput || '').split(/\r?\n/u)) {
      if (!line || line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        continue;
      }
      if (line.startsWith('+') || line.startsWith('-')) {
        changedLines.push(line.slice(1).trim());
      }
    }
  }

  return changedLines;
};

const fileExists = (filePath) => {
  try {
    return fs.statSync(path.join(repoRoot, filePath)).isFile();
  } catch {
    return false;
  }
};

const shouldRunDomFast = (changedFiles) => changedFiles.some((filePath) => (
  DOM_FAST_TESTS.has(filePath)
  || filePath.endsWith('.jsx')
  || filePath.startsWith('src/apps/content/')
  || filePath.startsWith('src/pages/')
  || filePath.startsWith('src/domains/nudge/visual/')
  || filePath.startsWith('src/themes/core/loaders/')
  || filePath.includes('/widgets/')
  || filePath === 'vite.config.js'
  || filePath === 'src/manifest.json'
  || filePath.startsWith('public/')
));

const isBuildSafePackageJsonChange = (changedLines) => {
  const meaningfulLines = changedLines.filter(Boolean);
  if (meaningfulLines.length === 0) {
    return false;
  }

  return meaningfulLines.every((line) => {
    if (line.startsWith('"dependencies"') || line.startsWith('"devDependencies"')) {
      return false;
    }
    if (line.startsWith('"build"') || line.startsWith('"build:')) {
      return false;
    }
    if (line.startsWith('"preview"')) {
      return false;
    }
    return PACKAGE_JSON_BUILD_SAFE_SCRIPT_PREFIXES.some((prefix) => line.startsWith(prefix));
  });
};

const shouldRunBuildFast = (changedFiles, diffPairs) => changedFiles.some((filePath) => {
  if (filePath === 'package.json') {
    return !isBuildSafePackageJsonChange(collectFileDiffLines(diffPairs, filePath));
  }
  return filePath === 'vite.config.js'
    || filePath === 'src/manifest.json'
    || filePath.startsWith('public/')
    || filePath.startsWith('src/');
});

const shouldRunCriticalBuildFast = (changedFiles, diffPairs) => changedFiles.some((filePath) => {
  if (filePath === 'package.json') {
    return !isBuildSafePackageJsonChange(collectFileDiffLines(diffPairs, filePath));
  }
  return filePath === 'package-lock.json'
    || filePath === 'vite.config.js'
    || filePath === 'src/manifest.json'
    || filePath.startsWith('public/')
    || filePath.startsWith('src/pages/')
    || filePath.startsWith('src/apps/background/')
    || filePath.startsWith('src/apps/content/')
    || filePath.startsWith('src/platform/chrome/')
    || filePath.startsWith('scripts/ci/run-vite-build')
    || filePath === 'scripts/ci/buildCheckManifest.mjs'
    || filePath.startsWith('scripts/ci/run-build-checks');
});

const shouldRunBuildFastForMode = (changedFiles, diffPairs) => {
  if (prePushBuildMode === 'manual') {
    return false;
  }
  if (prePushBuildMode === 'always') {
    return shouldRunBuildFast(changedFiles, diffPairs);
  }
  return shouldRunCriticalBuildFast(changedFiles, diffPairs);
};

const describeBuildSkipReason = () => {
  if (prePushBuildMode === 'manual') {
    return 'ENTROPY_PRE_PUSH_BUILD=manual.';
  }
  return 'no critical bundle/bootstrap files changed. Set ENTROPY_PRE_PUSH_BUILD=always to force it.';
};

const shouldRunLogicFast = (changedFiles) => changedFiles.some((filePath) => (
  filePath === 'package.json'
  || filePath.startsWith('src/')
  || filePath.startsWith('tests/')
  || filePath.startsWith('scripts/dev/')
  || filePath === 'vitest.config.js'
  || filePath === 'vitest.critical.logic.config.js'
  || filePath === 'vitest.critical.dom.config.js'
  || filePath === 'vitest.fast.logic.config.js'
  || filePath === 'vitest.fast.dom.config.js'
  || filePath === 'vitest.shared.js'
  || filePath === 'vitest.tmp.config.js'
  || filePath === 'vitest.sprint.config.js'
));

const shouldRunThemeLogicFast = (changedFiles) => changedFiles.some((filePath) => (
  filePath === 'package.json'
  || filePath === 'scripts/dev/fastTestProfile.mjs'
  || filePath === 'vitest.fast.logic.config.js'
  || filePath.startsWith('src/themes/')
  || filePath.startsWith('tests/themes/')
  || isRootThemeLogicFastTest(filePath)
));

const shouldRunCoreLogicFast = (changedFiles) => changedFiles.some((filePath) => (
  filePath === 'package.json'
  || filePath.startsWith('src/')
  || filePath.startsWith('tests/')
  || filePath.startsWith('scripts/dev/')
  || filePath.startsWith('scripts/ci/')
  || filePath === 'scripts/lint.mjs'
  || filePath === 'vitest.fast.logic.config.js'
  || filePath === 'vitest.shared.js'
  || filePath === 'vitest.config.js'
  || filePath === 'vitest.tmp.config.js'
  || filePath === 'vitest.sprint.config.js'
)) && !changedFiles.every((filePath) => (
  filePath.startsWith('tests/themes/')
  || ROOT_THEME_LOGIC_TESTS.has(filePath)
  || filePath.startsWith('src/themes/')
));

const collectLintTargets = (changedFiles) => changedFiles
  .filter((filePath) => filePath.startsWith('src/') && /\.(js|jsx)$/u.test(filePath))
  .filter(fileExists);

const runCommand = (label, command, args, envOverrides = {}, input) => new Promise((resolve) => {
  console.error(`[pre-push] ${label}`);
  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  child.on('error', (error) => {
    console.error(`[pre-push] ${label} failed to start: ${error.message}`);
    resolve(1);
  });
  if (input !== undefined) child.stdin.end(input);

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[pre-push] ${label} interrupted by ${signal}.`);
      cleanupAndExit(1);
      return;
    }
    resolve(code ?? 1);
  });
});

const runFastVerify = async () => {
  const stdinText = await readStdin();
  const refSpecs = parseHookRefs(stdinText);
  const diffPairs = resolveDiffPairs(refSpecs);
  const changedFiles = collectChangedFiles(diffPairs);

  if (changedFiles.length === 0) {
    console.error('[pre-push] No changed files detected for pushed refs. Skipping fast checks.');
    return 0;
  }

  console.error(`[pre-push] Changed files: ${changedFiles.length}`);

  const lintTargets = collectLintTargets(changedFiles);
  const domFast = shouldRunDomFast(changedFiles);
  const buildFast = shouldRunBuildFastForMode(changedFiles, diffPairs);
  const logicFast = shouldRunLogicFast(changedFiles);
  const coreLogicFast = shouldRunCoreLogicFast(changedFiles);
  const themeLogicFast = shouldRunThemeLogicFast(changedFiles);

  const tasks = [];

  if (lintTargets.length > 0) {
    tasks.push({
      label: `lint (${lintTargets.length} changed src files)`,
      command: process.execPath,
      args: ['./scripts/dev/check-runtime.mjs'],
    });
    tasks.push({
      label: `eslint (${lintTargets.length} files)`,
      command: process.execPath,
      args: ['./scripts/lint.mjs', '--files-from-stdin'],
      input: JSON.stringify(lintTargets),
    });
  } else {
    console.error('[pre-push] Skipping lint: no changed src/*.js(x) files.');
  }

  if (logicFast && (coreLogicFast || themeLogicFast)) {
    tasks.push({
      label: `critical logic tests (${CRITICAL_LOGIC_TESTS.length} files)`,
      command: process.execPath,
      args: ['./scripts/dev/run-local-command.mjs', 'vitest', 'run', '--config', 'vitest.critical.logic.config.js'],
    });
  }

  if (!logicFast || (!coreLogicFast && !themeLogicFast)) {
    console.error('[pre-push] Skipping critical logic tests: no logic-impacting files changed.');
  }

  if (domFast) {
    tasks.push({
      label: `critical DOM tests (${CRITICAL_DOM_TESTS.length} files)`,
      command: process.execPath,
      args: ['./scripts/dev/run-local-command.mjs', 'vitest', 'run', '--config', 'vitest.critical.dom.config.js'],
    });
  } else {
    console.error('[pre-push] Skipping critical DOM tests: no DOM/UI-impacting files changed.');
  }

  if (buildFast) {
    tasks.push({
      label: `build:quick (${prePushBuildMode} build mode)`,
      command: process.execPath,
      args: ['./scripts/dev/run-local-command.mjs', 'node', './scripts/ci/run-vite-build-with-content-bootstrap-check.mjs'],
    });
  } else {
    console.error(`[pre-push] Skipping build:quick: ${describeBuildSkipReason()}`);
  }

  if (tasks.length === 0) {
    console.error('[pre-push] Fast mode found nothing to verify. Continuing push.');
    return 0;
  }

  for (const task of tasks) {
    const code = await runCommand(task.label, task.command, task.args, task.env, task.input);
    if (code !== 0) {
      return code;
    }
  }

  return 0;
};

acquireLock();

if (!verifyScript) {
  console.error(`[pre-push] Unsupported ENTROPY_PRE_PUSH_MODE="${verifyMode}". Expected one of: ${Object.keys(verifyScriptByMode).join(', ')}.`);
  cleanupAndExit(1);
}

if (!prePushBuildMode) {
  console.error('[pre-push] Unsupported ENTROPY_PRE_PUSH_BUILD. Expected one of: critical, always, manual.');
  cleanupAndExit(1);
}

console.error(`[pre-push] Running ${verifyScript} (${verifyMode} mode, ${prePushBuildMode} build mode).`);

if (verifyMode === 'fast') {
  const exitCode = await runFastVerify();
  if (exitCode !== 0) {
    console.error('pre-push: verify failed. Push aborted.');
    cleanupAndExit(exitCode);
  }
  cleanupAndExit(0);
}

const child = spawn(npmExecutable, ['run', verifyScript], {
  cwd: repoRoot,
  stdio: 'inherit',
  detached: process.platform !== 'win32',
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    try {
      if (process.platform === 'win32') {
        child.kill(signal);
      } else {
        process.kill(-child.pid, signal);
      }
    } catch {
      // Best-effort shutdown.
    }
  }
  cleanupAndExit(1);
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));
process.on('exit', () => {
  removeLockDir();
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[pre-push] verify interrupted by ${signal}.`);
    cleanupAndExit(1);
    return;
  }

  if (code !== 0) {
    console.error('pre-push: verify failed. Push aborted.');
    cleanupAndExit(code ?? 1);
    return;
  }

  cleanupAndExit(0);
});
