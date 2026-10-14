import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  getVisualSceneManifest,
  listVisualSceneManifests,
} from '../../../src/apps/visual-harness/sceneCatalog.js';
import {
  getVisualHarnessHelpText,
  parseVisualHarnessCliArgs,
} from './visualHarnessCli.mjs';
import {
  captureVisualScene,
  launchVisualHarnessBrowser,
} from './visualSceneCapture.mjs';
import {
  readVisualHarnessGitState,
  serializeVisualHarnessError,
  writeVisualHarnessJson,
} from './visualHarnessReport.mjs';
import { startVisualHarnessServer } from './visualHarnessServer.mjs';
import { acquireQaBrowserCapacity } from '../../qa/resources/QaBrowserCapacityLease.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '../../..');
const defaultOutputRoot = resolve(rootDir, '.artifacts/visual-harness');

export async function runVisualCapture(options) {
  options.signal?.throwIfAborted();
  const manifests = options.all
    ? listVisualSceneManifests()
    : [getVisualSceneManifest(options.sceneId)];
  const gitState = await readVisualHarnessGitState(rootDir);
  let server = null;
  let browser = null;
  let capacityLease = null;
  let primaryError = null;

  try {
    if (options.captureConcurrency === 'shared_capture') {
      capacityLease = await acquireQaBrowserCapacity({
        rootDir, ownerId: `visual-harness:pid=${process.pid}`, reservationMode: 'shared_capture',
      });
    }
    const harnessServer = await startVisualHarnessServer(rootDir, manifests.map((manifest) => manifest.id));
    server = harnessServer;
    await mkdir(options.outputRoot, { recursive: true });
    await writeVisualHarnessJson(resolve(options.outputRoot, 'source-admission.json'), harnessServer.sourceAdmission);
    options.signal?.throwIfAborted();
    browser = await launchVisualHarnessBrowser(options.headed, {
      executablePath: options.chromePath || null,
      audioPolicy: options.audioPolicy || 'muted',
      launchEnvironment: options.launchEnvironment || {},
      renderingRequirement: options.renderingRequirement || 'headless_ok',
      displayReceipt: options.displayReceipt || null,
      executionPlan: options.browserExecution || null,
      capacityLease,
    });
    const reports = [];
    for (const manifest of manifests) {
      options.signal?.throwIfAborted();
      const report = await captureVisualScene({
        browser,
        gitState,
        manifest,
        origin: harnessServer.origin,
        outputRoot: options.outputRoot,
        sourceCachePath: harnessServer.sourceCachePath,
      });
      reports.push({ ...report, sourceAdmission: harnessServer.sourceAdmission });
      process.stdout.write(`[visual-harness] PASS ${manifest.id} -> ${report.outputDir}\n`);
    }
    options.signal?.throwIfAborted();
    return reports;
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (browser) await browser.close().catch((error) => cleanupErrors.push(error));
    if (server) await server.close().catch((error) => cleanupErrors.push(error));
    // Retain capacity when either startup rollback or owned cleanup is unproved.
    if (capacityLease && cleanupErrors.length === 0
      && primaryError?.code !== 'VISUAL_HARNESS_SERVER_CLEANUP_INCOMPLETE') {
      await capacityLease.release().catch((error) => cleanupErrors.push(error));
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors,
        'VISUAL_HARNESS_CLEANUP_INCOMPLETE', primaryError ? { cause: primaryError } : undefined);
    }
  }
}

async function main() {
  process.chdir(rootDir);
  const options = parseVisualHarnessCliArgs(process.argv.slice(2), {
    defaultOutputRoot,
    rootDir,
  });
  if (options.help) {
    process.stdout.write(getVisualHarnessHelpText());
    return;
  }
  if (options.list) {
    listVisualSceneManifests().forEach((manifest) => {
      process.stdout.write(`${manifest.id}\t${manifest.kind}\t${manifest.title}\n`);
    });
    return;
  }
  await mkdir(options.outputRoot, { recursive: true });
  await runVisualCapture(options);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify(serializeVisualHarnessError(error), null, 2)}\n`);
    process.exitCode = 1;
  });
}
