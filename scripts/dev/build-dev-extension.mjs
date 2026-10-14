#!/usr/bin/env node

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSpawnEnv } from './runtimeProfile.mjs';
import { buildAndPublishDevExtension, captureDevExtensionBuildInputs } from './devExtensionArtifactPublisher.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRootDir = path.resolve(path.dirname(scriptPath), '../..');

function runNodeScript(rootDir, relativeScriptPath, args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(rootDir, relativeScriptPath), ...args], {
      cwd: rootDir,
      env: buildSpawnEnv(env),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        const error = new Error(`DEV_EXTENSION_BUILD_COMMAND_SIGNALED:${signal}`);
        error.code = 'DEV_EXTENSION_BUILD_COMMAND_SIGNALED';
        reject(error);
        return;
      }
      if (code !== 0) {
        const error = new Error(`DEV_EXTENSION_BUILD_COMMAND_FAILED:${relativeScriptPath}:${code}`);
        error.code = 'DEV_EXTENSION_BUILD_COMMAND_FAILED';
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function executeDevExtensionBuild({
  rootDir = defaultRootDir,
  verification = 'full',
  captureInputs = captureDevExtensionBuildInputs,
} = {}) {
  if (!['full', 'artifact'].includes(verification)) {
    const error = new Error(`DEV_EXTENSION_BUILD_VERIFICATION_INVALID:${verification}`);
    error.code = 'DEV_EXTENSION_BUILD_VERIFICATION_INVALID';
    throw error;
  }
  const prepareBuild = async () => {
    await runNodeScript(rootDir, 'scripts/dev/generate-zen-pond-static-assets.mjs');
    if (verification === 'full') {
      await runNodeScript(rootDir, 'scripts/dev/check-runtime.mjs');
      await runNodeScript(rootDir, 'scripts/ci/run-build-checks.mjs', ['--phase=prebuild']);
      await runNodeScript(rootDir, 'scripts/ci/run-build-checks.mjs', ['--phase=build']);
    }
  };
  return buildAndPublishDevExtension({
    rootDir,
    prepareBuild,
    captureInputs: async (sourceRoot) => {
      console.log(JSON.stringify({ event: 'DEV_EXTENSION_INPUT_CAPTURE_STARTED' }));
      const snapshot = await captureInputs(sourceRoot);
      console.log(JSON.stringify({ event: 'DEV_EXTENSION_INPUT_CAPTURED',
        inputDigest: snapshot.inputDigest, inputFileCount: snapshot.inputFileCount }));
      return snapshot;
    },
    runBuild: async ({ stagingDir, buildRoot }) => {
      await runNodeScript(
        buildRoot,
        'scripts/ci/run-vite-build-with-content-bootstrap-check.mjs',
        [],
        {
          ...process.env,
          ENTROPY_EXTENSION_TARGET: 'chrome',
          ENTROPY_RELEASE_PROFILE: 'dev',
          ENTROPY_EXTENSION_OUT_DIR: stagingDir,
        },
      );
    },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const verification = args.includes('--artifact-only') ? 'artifact' : 'full';
  const unknownArgs = args.filter((arg) => arg !== '--artifact-only');
  if (unknownArgs.length > 0) {
    throw new Error(`DEV_EXTENSION_BUILD_ARGUMENT_INVALID:${unknownArgs.join(',')}`);
  }
  const result = await executeDevExtensionBuild({ verification });
  console.log(JSON.stringify({
    event: 'DEV_EXTENSION_BUILD_PUBLISHED',
    status: result.status,
    buildId: result.buildId,
    activeDir: path.relative(defaultRootDir, result.activeDir),
    previousArtifactPreserved: result.previousArtifactPreserved,
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error('[dev-extension-build]', error);
    process.exit(1);
  });
}
