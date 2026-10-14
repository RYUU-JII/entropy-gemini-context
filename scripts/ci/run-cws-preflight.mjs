#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertCanonicalManifestChromeCompatibility,
} from '../../src/platform/extension/chromeCompatibilityContract.js';
import { resolveCwsReleaseIdentity } from '../release/cwsReleaseIdentity.mjs';
import { inspectPublicPrivacyDisclosures } from './publicPrivacyDisclosureContract.mjs';

const rootDir = process.cwd();

function parseArgs(argv) {
  const options = { build: true, distDir: 'dist-prod' };
  for (const arg of argv) {
    if (arg === '--no-build') {
      options.build = false;
    } else if (arg.startsWith('--dist=')) {
      options.distDir = arg.slice('--dist='.length);
    } else {
      throw new Error(`CWS_PREFLIGHT_UNKNOWN_ARGUMENT:${arg}`);
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const distDir = path.resolve(rootDir, options.distDir);
const manifestPath = path.resolve(distDir, 'manifest.json');
const dynamicCodeCheckPath = path.resolve(rootDir, 'scripts/ci/check-dist-no-dynamic-code.mjs');
const privacyPagePath = path.resolve(rootDir, 'src/apps/landing/privacy/index.html');
const landingCopyPath = path.resolve(rootDir, 'src/apps/landing/content/landingCopy.js');
const readmePath = path.resolve(rootDir, 'README.md');
const forbiddenDebugArtifactPattern = /SentinelFlareDebugLauncher|DebugModePanel/u;

function fail(message) {
  console.error(`[cws-preflight] FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`[cws-preflight] PASS: ${message}`);
}

function run(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  const status = Number.isInteger(result.status) ? result.status : 1;
  if (status !== 0) {
    process.exit(status);
  }
}

function listFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function assertManifestReviewShape() {
  if (!fs.existsSync(manifestPath)) {
    fail(`Built manifest not found: ${path.relative(rootDir, manifestPath)}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let releaseIdentity;
  try {
    releaseIdentity = resolveCwsReleaseIdentity({
      currentVersion: manifest.version,
      environment: process.env,
    });
  } catch (error) {
    fail(error?.message || String(error));
  }
  const permissions = new Set(Array.isArray(manifest.permissions) ? manifest.permissions : []);
  const optionalPermissions = new Set(Array.isArray(manifest.optional_permissions) ? manifest.optional_permissions : []);
  const optionalHosts = Array.isArray(manifest.optional_host_permissions) ? manifest.optional_host_permissions : [];

  try {
    assertCanonicalManifestChromeCompatibility(manifest, {
      source: path.relative(rootDir, manifestPath),
    });
  } catch (error) {
    fail(error?.message || String(error));
  }

  if (permissions.has('notifications')) {
    fail('notifications must remain optional for the public Chrome Web Store build.');
  }
  if (!optionalPermissions.has('notifications')) {
    fail('optional_permissions must include notifications for user-triggered opt-in.');
  }
  if (permissions.has('offscreen')) {
    fail('offscreen must stay absent while protected audio dulling is not a release feature.');
  }
  if (permissions.has('activeTab')) {
    fail('activeTab must stay absent while protected audio dulling is not a release feature.');
  }
  if (permissions.has('tabCapture')) {
    fail('tabCapture must stay absent while protected audio dulling is not a release feature.');
  }
  if (optionalPermissions.has('tabCapture')) {
    fail('tabCapture must stay absent from optional_permissions while protected audio dulling is not a release feature.');
  }
  if (optionalHosts.length !== 1 || optionalHosts[0] !== '*://*/*') {
    fail('optional_host_permissions must use only *://*/* for runtime site-by-site host requests.');
  }
  if (manifest.host_permissions) {
    fail('host_permissions must stay absent; host access belongs in optional_host_permissions.');
  }
  pass(
    `release identity is frozen for ${releaseIdentity.releaseMode} version ${releaseIdentity.currentVersion} and exact Store extension ${releaseIdentity.extensionId}.`,
  );
  pass('built manifest keeps the reviewed Chrome capability floor, notifications optional, audio-capture permissions absent, and host access opt-in.');
}

function assertNoPublicDebugArtifacts() {
  const findings = [];
  for (const filePath of listFiles(distDir)) {
    const extension = path.extname(filePath);
    if (!['.js', '.html', '.json'].includes(extension)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    if (forbiddenDebugArtifactPattern.test(content)) {
      findings.push(path.relative(rootDir, filePath));
    }
  }
  if (findings.length > 0) {
    fail(`public debug artifacts found: ${findings.join(', ')}`);
  }
  pass('public debug UI artifacts are absent from dist-prod.');
}

function assertPublicPrivacyDisclosure() {
  if (!fs.existsSync(privacyPagePath)) {
    fail(`Public privacy page not found: ${path.relative(rootDir, privacyPagePath)}`);
  }
  const failures = inspectPublicPrivacyDisclosures({
    readme: fs.readFileSync(readmePath, 'utf8'),
    landingCopy: fs.readFileSync(landingCopyPath, 'utf8'),
    privacyPage: fs.readFileSync(privacyPagePath, 'utf8'),
  });
  if (failures.length > 0) {
    fail(failures.map(({ path: sourcePath, message }) => `${sourcePath}: ${message}`).join(' | '));
  }
  pass('public disclosures cover local records, user controls, exports, and Limited Use without obsolete remote-icon claims.');
}

function main() {
  assertPublicPrivacyDisclosure();
  if (options.build) {
    if (path.resolve(distDir) !== path.resolve(rootDir, 'dist-prod')) {
      fail('custom --dist requires --no-build; production builds own dist-prod.');
    }
    run('node', [
      'scripts/dev/run-with-env.mjs',
      'ENTROPY_EXTENSION_TARGET=chrome',
      'ENTROPY_RELEASE_PROFILE=public',
      'ENTROPY_EXTENSION_OUT_DIR=dist-prod',
      '--', 'npm', 'run', 'build:prod',
    ]);
  }
  assertManifestReviewShape();
  run('node', [dynamicCodeCheckPath, distDir]);
  assertNoPublicDebugArtifacts();
  pass('Chrome Web Store preflight completed.');
}

main();
