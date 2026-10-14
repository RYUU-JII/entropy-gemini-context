#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import {
  ENTROPY_QA_PROFILE_MARKER,
  ExtensionChromiumHarness,
  readEntropyQaProfileMarker,
} from './extensionChromiumHarness.mjs';
import {
  ENTROPY_QA_TRUSTED_PAGE_PATH,
  stageEntropyQaArtifact,
} from './qaProfileArtifactSlot.mjs';
import { sendHarnessMessage } from './sites/siteRuntimeBrowser.mjs';
import { MODEL_STATE_INITIAL_PROFILE_EPOCH } from '../../src/platform/storage/model/ProfileEpochContract.js';
import { ARTIFACT_DISCLOSURE_FAMILY_ORDER } from '../../src/domains/progression/policy/artifactDisclosurePolicy.js';
import { MESSAGE_ACTIONS } from '../../src/platform/messaging/messageTypes.js';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');
const TARGET_DAY_COUNT = 5;
const QA_PROVISION_ACTION = 'QA_PROVISION_CANONICAL_PROGRESSION';
const QA_DEBUG_ACTION = 'DEBUG_SET_PROGRESSION_UNLOCK_DAY';

function parseInteger(value, errorCode) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${errorCode}:${value}`);
  return number;
}

export function parseProvisionSiteQaProfileArgs(argv) {
  const options = {
    profile: null,
    progressionDay: TARGET_DAY_COUNT,
    chromePath: null,
    qaDist: null,
    releaseDist: null,
    build: true,
    headless: true,
  };
  for (const arg of argv) {
    if (arg === '--no-build') options.build = false;
    else if (arg === '--headed') options.headless = false;
    else if (arg === '--headless') options.headless = true;
    else if (arg.startsWith('--profile=')) options.profile = arg.slice('--profile='.length);
    else if (arg.startsWith('--progression-day=')) {
      options.progressionDay = parseInteger(
        arg.slice('--progression-day='.length),
        'SITE_E2E_QA_PROGRESSION_DAY_INVALID',
      );
    } else if (arg.startsWith('--chrome=')) options.chromePath = arg.slice('--chrome='.length);
    else if (arg.startsWith('--qa-dist=')) options.qaDist = arg.slice('--qa-dist='.length);
    else if (arg.startsWith('--release-dist=')) {
      options.releaseDist = arg.slice('--release-dist='.length);
    } else {
      throw new Error(`SITE_E2E_QA_PROVISION_ARGUMENT_UNKNOWN:${arg}`);
    }
  }
  if (!options.profile || !path.isAbsolute(options.profile)) {
    throw new Error('SITE_E2E_QA_PROFILE_ABSOLUTE_PATH_REQUIRED');
  }
  if (options.progressionDay !== TARGET_DAY_COUNT) {
    throw new Error(`SITE_E2E_QA_PROGRESSION_DAY_UNSUPPORTED:${options.progressionDay}`);
  }
  if (!options.build && (!options.qaDist || !options.releaseDist)) {
    throw new Error('SITE_E2E_QA_PROVISION_DIST_REQUIRED');
  }
  return options;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createPastActivityDayKeys({
  nowMs = Date.now(),
  count = TARGET_DAY_COUNT,
} = {}) {
  const now = new Date(nowMs);
  const currentActivityDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - (now.getHours() < 4 ? 1 : 0),
  );
  const keys = [];
  for (let offset = count; offset >= 1; offset -= 1) {
    keys.push(formatLocalDate(new Date(
      currentActivityDay.getFullYear(),
      currentActivityDay.getMonth(),
      currentActivityDay.getDate() - offset,
    )));
  }
  return Object.freeze(keys);
}

function buildMarker(activityDayKeys, status) {
  return {
    purpose: ENTROPY_QA_PROFILE_MARKER.purpose,
    schemaVersion: ENTROPY_QA_PROFILE_MARKER.schemaVersion,
    fixtures: {
      canonicalProgression: {
        qualifiedUseDayCount: TARGET_DAY_COUNT,
        synthetic: true,
        status,
        activityDayKeys: [...activityDayKeys],
      },
    },
  };
}

async function writeMarker(markerPath, marker) {
  const temporaryPath = `${markerPath}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, {
    flag: 'wx',
  });
  await fs.rename(temporaryPath, markerPath);
}

async function prepareProfileMarker(profileDir) {
  const normalizedProfileDir = path.normalize(profileDir);
  const stat = await fs.lstat(normalizedProfileDir).catch(() => null);
  if (stat?.isSymbolicLink() || (stat && !stat.isDirectory())) {
    throw new Error(`SITE_E2E_QA_PROFILE_DIRECTORY_INVALID:${normalizedProfileDir}`);
  }
  const markerPath = path.join(
    normalizedProfileDir,
    ENTROPY_QA_PROFILE_MARKER.fileName,
  );
  if (!stat) {
    await fs.mkdir(normalizedProfileDir);
    const activityDayKeys = createPastActivityDayKeys();
    await writeMarker(markerPath, buildMarker(activityDayKeys, 'provisioning'));
    return readEntropyQaProfileMarker(normalizedProfileDir, { allowProvisioning: true });
  }
  const current = await readEntropyQaProfileMarker(normalizedProfileDir, {
    allowProvisioning: true,
  });
  if (current.marker.schemaVersion === ENTROPY_QA_PROFILE_MARKER.schemaVersion) {
    return current;
  }
  const activityDayKeys = createPastActivityDayKeys();
  await writeMarker(markerPath, buildMarker(activityDayKeys, 'provisioning'));
  return readEntropyQaProfileMarker(normalizedProfileDir, { allowProvisioning: true });
}

async function runCommand(command, args, { env = process.env } = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(
        `SITE_E2E_QA_PROVISION_COMMAND_FAILED:${command}:${code ?? signal ?? 'unknown'}`,
      ));
    });
  });
}

async function readBuildInfo(distDir, expectedProfile) {
  const buildInfo = JSON.parse(await fs.readFile(
    path.join(distDir, 'entropy-build-info.json'),
    'utf8',
  ));
  if (buildInfo?.releaseProfile !== expectedProfile) {
    throw new Error(
      `SITE_E2E_QA_BUILD_PROFILE_MISMATCH:${expectedProfile}:${buildInfo?.releaseProfile || 'missing'}`,
    );
  }
  return buildInfo;
}

async function buildArtifacts(options, buildRoot) {
  const qaDist = options.qaDist
    ? path.resolve(rootDir, options.qaDist)
    : path.join(buildRoot, 'qa-dist');
  const releaseDist = options.releaseDist
    ? path.resolve(rootDir, options.releaseDist)
    : path.join(buildRoot, 'release-dist');
  if (options.build && !options.qaDist) {
    await runCommand('npm', ['run', 'build:bundle', '--', '--emptyOutDir'], {
      env: {
        ...process.env,
        ENTROPY_RELEASE_PROFILE: 'dev',
        ENTROPY_EXTENSION_OUT_DIR: qaDist,
      },
    });
  }
  if (options.build && !options.releaseDist) {
    await runCommand('npm', ['run', 'build:bundle', '--', '--emptyOutDir'], {
      env: {
        ...process.env,
        ENTROPY_RELEASE_PROFILE: 'public',
        ENTROPY_EXTENSION_OUT_DIR: releaseDist,
      },
    });
  }
  const [qaBuildInfo, releaseBuildInfo] = await Promise.all([
    readBuildInfo(qaDist, 'dev'),
    readBuildInfo(releaseDist, 'public'),
  ]);
  await runCommand(process.execPath, [
    path.join(rootDir, 'scripts/ci/check-public-build-debug-surface.mjs'),
    releaseDist,
  ]);
  return { qaDist, releaseDist, qaBuildInfo, releaseBuildInfo };
}

function resolveChromePath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_BIN,
    process.env.GOOGLE_CHROME_BIN,
    chromium.executablePath(),
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const selected = candidates.find((candidate) => fsSync.existsSync(candidate));
  if (!selected) throw new Error('SITE_E2E_CHROMIUM_EXECUTABLE_NOT_FOUND');
  return path.resolve(selected);
}

function requireCanonicalDayFive(snapshot) {
  const unlock = snapshot?.unlockProgress;
  if (
    unlock?.source !== 'canonical'
    || unlock?.debugOverrideActive !== false
    || unlock?.canonicalQualifiedUseDayCount !== TARGET_DAY_COUNT
    || unlock?.qualifiedUseDayCount !== TARGET_DAY_COUNT
    || snapshot?.qualifiedActivityDayCount !== TARGET_DAY_COUNT
    || !Array.isArray(snapshot?.orderedFamilyIds)
    || snapshot.orderedFamilyIds.some((familyId, index) => (
      familyId !== ARTIFACT_DISCLOSURE_FAMILY_ORDER[index]
    ))
    || snapshot.entriesByFamilyId?.veil?.runtimeEligible !== true
  ) {
    throw new Error('SITE_E2E_QA_CANONICAL_DAY_FIVE_REQUIRED');
  }
  return snapshot;
}

export function requirePublicProgressionSurfacesAbsent({
  qaSurface,
  debugSurface,
}) {
  const probes = [
    [QA_PROVISION_ACTION, qaSurface],
    [QA_DEBUG_ACTION, debugSurface],
  ];
  for (const [action, response] of probes) {
    if (
      response?.success !== false
      || response?.error !== 'UNREGISTERED_RUNTIME_ACTION'
    ) {
      throw new Error(
        `SITE_E2E_QA_PUBLIC_DEBUG_SURFACE_PRESENT:${action}:${response?.error || 'unexpected_response'}`,
      );
    }
  }
}

async function readPublicVerification(harness, expectedBuildInfo) {
  const servedBuildInfo = await harness.evaluateInTrustedPage(
    "fetch(chrome.runtime.getURL('entropy-build-info.json')).then((response) => response.json())",
  );
  if (
    servedBuildInfo?.releaseProfile !== 'public'
    || servedBuildInfo?.buildId !== expectedBuildInfo.buildId
  ) {
    throw new Error('SITE_E2E_QA_PUBLIC_BUILD_PROVENANCE_MISMATCH');
  }
  const snapshotResponse = await sendHarnessMessage(harness, {
    action: MESSAGE_ACTIONS.GET_ARTIFACT_DISCLOSURE_SNAPSHOT,
    profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
  });
  if (snapshotResponse?.success !== true
      || snapshotResponse.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH) {
    throw new Error(
      `SITE_E2E_QA_PUBLIC_PROGRESSION_READ_FAILED:${snapshotResponse?.error || 'unknown'}`,
    );
  }
  const qaSurface = await sendHarnessMessage(harness, {
    action: QA_PROVISION_ACTION,
    profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
    activityDayKeys: [],
  });
  const debugSurface = await sendHarnessMessage(harness, {
    action: QA_DEBUG_ACTION,
    dayCount: TARGET_DAY_COUNT,
  });
  requirePublicProgressionSurfacesAbsent({ qaSurface, debugSurface });
  return Object.freeze({
    buildInfo: servedBuildInfo,
    snapshot: requireCanonicalDayFive(snapshotResponse.snapshot),
    qaProvisioningSurfaceAbsent: true,
    progressionDebugSurfaceAbsent: true,
  });
}

function createHarness({ chromePath, profileDir, slotDir, headless }) {
  return new ExtensionChromiumHarness({
    chromePath,
    distDir: slotDir,
    rootDir: '/',
    headless,
    keepTemp: false,
    loadInPlace: true,
    qaProfileDir: profileDir,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    allowProvisioningQaProfile: true,
  });
}

export async function provisionSiteQaProfile(options) {
  const profile = await prepareProfileMarker(path.normalize(options.profile));
  const fixture = profile.marker.fixtures.canonicalProgression;
  const chromePath = resolveChromePath(options.chromePath);
  const buildRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'entropy-qa-provision-builds-'));
  let firstHarness = null;
  let verificationHarness = null;
  try {
    const artifacts = await buildArtifacts(options, buildRoot);
    const qaSlot = await stageEntropyQaArtifact({
      profileDir: profile.path,
      sourceDir: artifacts.qaDist,
    });
    firstHarness = createHarness({
      chromePath,
      profileDir: profile.path,
      slotDir: qaSlot.slotDir,
      headless: options.headless,
    });
    await firstHarness.start();
    const provisioningUpdate = await firstHarness.reloadExtensionFromSource();
    if (firstHarness.uninstallExtensionOnClose) {
      throw new Error('SITE_E2E_QA_PROVISION_UNINSTALL_LIFECYCLE_FORBIDDEN');
    }
    const extensionId = firstHarness.extensionId;
    if (provisioningUpdate.extensionId !== extensionId) {
      throw new Error('SITE_E2E_QA_PROVISION_EXTENSION_ID_CONTINUITY_FAILED');
    }
    const readiness = await sendHarnessMessage(firstHarness, {
      action: MESSAGE_ACTIONS.GET_PROFILE_GENERATION_READINESS,
      profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
    });
    if (
      readiness?.success !== true
      || readiness.profileGeneration !== MODEL_STATE_INITIAL_PROFILE_EPOCH
    ) {
      throw new Error(
        `SITE_E2E_QA_PROFILE_GENERATION_READINESS_FAILED:${readiness?.error || 'mismatch'}`,
      );
    }
    const provisionResponse = await sendHarnessMessage(firstHarness, {
      action: QA_PROVISION_ACTION,
      profileGeneration: MODEL_STATE_INITIAL_PROFILE_EPOCH,
      activityDayKeys: fixture.activityDayKeys,
    }, { timeoutMs: 30_000 });
    if (provisionResponse?.success !== true) {
      throw new Error(
        `SITE_E2E_QA_CANONICAL_PROVISION_FAILED:${provisionResponse?.error || 'unknown'}`,
      );
    }
    requireCanonicalDayFive(provisionResponse.result?.snapshot);
    if (provisionResponse.result?.firstVision?.state !== 'spent') {
      throw new Error('SITE_E2E_QA_FIRST_VISION_SPENT_REQUIRED');
    }
    if (provisionResponse.result?.sessionCleanup?.absent !== true) {
      throw new Error('SITE_E2E_QA_DEBUG_SESSION_ABSENCE_REQUIRED');
    }

    await stageEntropyQaArtifact({
      profileDir: profile.path,
      sourceDir: artifacts.releaseDist,
    });
    const update = await firstHarness.reloadExtensionFromSource();
    if (update.extensionId !== extensionId) {
      throw new Error('SITE_E2E_QA_EXTENSION_ID_CONTINUITY_FAILED');
    }
    const inPlacePublic = await readPublicVerification(
      firstHarness,
      artifacts.releaseBuildInfo,
    );
    await firstHarness.close();
    firstHarness = null;

    verificationHarness = createHarness({
      chromePath,
      profileDir: profile.path,
      slotDir: qaSlot.slotDir,
      headless: options.headless,
    });
    await verificationHarness.start();
    if (
      verificationHarness.extensionId !== extensionId
      || verificationHarness.uninstallExtensionOnClose
    ) {
      throw new Error('SITE_E2E_QA_PUBLIC_RELAUNCH_CONTINUITY_FAILED');
    }
    await verificationHarness.reloadExtensionFromSource();
    const relaunchedPublic = await readPublicVerification(
      verificationHarness,
      artifacts.releaseBuildInfo,
    );
    await verificationHarness.close();
    verificationHarness = null;

    const readyMarker = buildMarker(fixture.activityDayKeys, 'ready');
    await writeMarker(profile.markerPath, readyMarker);
    return Object.freeze({
      profilePath: profile.path,
      markerPath: profile.markerPath,
      artifactSlot: qaSlot.slotDir,
      extensionId,
      noOp: provisionResponse.result.noOp === true,
      recordedActivityDayKeys: provisionResponse.result.recordedActivityDayKeys,
      sessionCleanup: provisionResponse.result.sessionCleanup,
      qaBuild: artifacts.qaBuildInfo,
      publicBuild: artifacts.releaseBuildInfo,
      inPlacePublic,
      relaunchedPublic,
    });
  } finally {
    await firstHarness?.close().catch(() => {});
    await verificationHarness?.close().catch(() => {});
    await fs.rm(buildRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseProvisionSiteQaProfileArgs(process.argv.slice(2));
  const result = await provisionSiteQaProfile(options);
  console.log(`[site-e2e-profile] PASS profile=${result.profilePath}`);
  console.log(`[site-e2e-profile] extensionId=${result.extensionId} noOp=${result.noOp}`);
  console.log(`[site-e2e-profile] publicBuildId=${result.publicBuild.buildId}`);
  console.log(`[site-e2e-profile] marker=${result.markerPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    console.error(`[site-e2e-profile] FAIL ${error?.stack || error?.message || error}`);
    process.exit(1);
  });
}
