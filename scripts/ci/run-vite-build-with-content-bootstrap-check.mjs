#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  EXTENSION_RELEASE_PROFILES,
  normalizeExtensionBuildTarget,
  normalizeExtensionReleaseProfile,
  resolveExtensionOutDir,
} from '../../src/platform/build/extensionManifestProfile.js';
import { EXTENSION_ARTIFACT_CHECK_PATHS } from './extensionArtifactCheckCatalog.mjs';

const rootDir = process.cwd();
const viteBinPath = path.resolve(rootDir, 'node_modules/vite/bin/vite.js');
const rawBuildArgs = process.argv.slice(2);
const skipBuild = rawBuildArgs.includes('--skip-build');
const buildArgs = rawBuildArgs.filter((arg) => arg !== '--skip-build');

const fail = (message) => {
  console.error(`[vite-build-content-bootstrap-check] FAIL: ${message}`);
  process.exit(1);
};

const resolveOutDir = (args, env = process.env) => {
  for (let index = 0; index < args.length; index += 1) {
    const current = String(args[index] || '').trim();
    if (!current) continue;
    if (current.startsWith('--outDir=')) {
      return current.slice('--outDir='.length).trim() || 'dist-prod';
    }
    if (current === '--outDir') {
      return String(args[index + 1] || '').trim() || 'dist-prod';
    }
  }
  const envOutDir = String(env.ENTROPY_EXTENSION_OUT_DIR || '').trim();
  const target = normalizeExtensionBuildTarget(env.ENTROPY_EXTENSION_TARGET);
  const releaseProfile = normalizeExtensionReleaseProfile(
    env.ENTROPY_RELEASE_PROFILE,
    EXTENSION_RELEASE_PROFILES.PUBLIC,
  );
  return resolveExtensionOutDir(target, envOutDir, { releaseProfile });
};

const runNodeScript = (scriptPath, args = []) => (
  spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: rootDir,
    stdio: 'inherit',
  })
);

const main = () => {
  if (!fs.existsSync(viteBinPath)) {
    fail(`vite binary not found at ${path.relative(rootDir, viteBinPath)}.`);
  }
  for (const relativePath of EXTENSION_ARTIFACT_CHECK_PATHS) {
    if (!fs.existsSync(path.resolve(rootDir, relativePath))) {
      fail(`artifact check script not found at ${relativePath}.`);
    }
  }

  const outDir = resolveOutDir(buildArgs);
  if (!skipBuild) {
    const buildResult = runNodeScript(viteBinPath, ['build', ...buildArgs]);
    const buildStatus = Number.isInteger(buildResult.status) ? buildResult.status : 1;
    if (buildStatus !== 0) {
      process.exit(buildStatus);
      return;
    }
  }

  for (const relativePath of EXTENSION_ARTIFACT_CHECK_PATHS) {
    const result = runNodeScript(path.resolve(rootDir, relativePath), [outDir]);
    const status = Number.isInteger(result.status) ? result.status : 1;
    if (status !== 0) {
      process.exit(status);
      return;
    }
  }
};

main();
