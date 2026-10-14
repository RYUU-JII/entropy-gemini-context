import fs from 'node:fs/promises';
import path from 'node:path';
import { ExtensionChromiumHarness } from '../../e2e/extensionChromiumHarness.mjs';
import { defineEntropyQaAttachedArtifactStage, ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { proveEntropyAttachedArtifactRuntimeReadiness, requireEntropyTrackingRuntimeReadiness,
  openEntropyAttachOnlyActivePage, requireEntropyAttachedPageExecution } from './attachOnlyActivePageAdapter.mjs';
import { sendTrustedRuntimeMessage } from './gateRuntimeQaProtocol.mjs';

// Exercises QA's infrastructure through its owners. No product session, settings,
// usage, focus emulation or personal-site input is created by this protocol.
export async function executeQaProtocol({ plan, artifact, browser, evidence,
  recoveryJournal, registerCleanup, reportBrowserGpuCapability, runChild }) {
  const attachedArtifactStage = defineEntropyQaAttachedArtifactStage({ browser,
    browserExecution: plan.browserExecution, sourceDir: artifact.path,
    artifactIdentity: { artifactId: artifact.id, inputDigest: artifact.inputDigest,
      buildId: artifact.buildId, releaseProfile: artifact.releaseProfile },
    temporaryManifest: { requiredPermissions: [], requiredHostPermissions: [] } });
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome,
    distDir: browser.extensionSlot, rootDir: plan.rootDir, headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution, audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment, renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint, expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage, keepTemp: false, qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory, loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: proveEntropyAttachedArtifactRuntimeReadiness, recoveryJournal });
  registerCleanup('runtime_stability_browser', () => harness.close());
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const expectedBuild = { buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  const verify = async (stage) => {
    await requireEntropyTrackingRuntimeReadiness(harness, { expectedBuild });
    const reply = await sendTrustedRuntimeMessage(harness, { action: 'DEBUG_GET_TRACKING_RUNTIME_STATE' });
    if (reply.buildInfo?.buildId !== artifact.buildId) throw new Error('QA_STABILITY_RUNNING_BUILD_CHANGED');
    await evidence.event('QA_RUNTIME_STABILITY_BOUNDARY', { stage,
      buildInfo: reply.buildInfo, activation: harness.attachedArtifactSyncReceipt,
      developerModePreparation: harness.managedDeveloperModeReceipt });
    return reply.buildInfo;
  };
  await verify('prepared');
  const { page } = await openEntropyAttachOnlyActivePage({ harness, url: 'about:blank',
    browserExecution: plan.browserExecution, observation: 'document' });
  const execution = await requireEntropyAttachedPageExecution(harness, page, 'document');
  await evidence.event('QA_RUNTIME_STABILITY_DOCUMENT', execution);
  const previousWorker = await harness.stopServiceWorker();
  await verify('worker_restarted');
  const replacement = await harness.waitForServiceWorker({ previousTargetId: previousWorker.targetId });
  let publishedBuildId = artifact.buildId;
  if (plan.parameters.rebuildDuringRun) {
    await runChild({ command: process.execPath,
      args: [process.env.npm_execpath, 'run', 'build', '--', '--artifact-only'] });
    const published = JSON.parse(await fs.readFile(path.join(artifact.sourcePath, 'entropy-build-info.json'), 'utf8'));
    publishedBuildId = published.buildId;
    if (publishedBuildId === artifact.buildId) throw new Error('QA_STABILITY_NEW_PUBLICATION_REQUIRED');
    const pinned = JSON.parse(await fs.readFile(path.join(artifact.path, 'entropy-build-info.json'), 'utf8'));
    if (pinned.buildId !== artifact.buildId) throw new Error('QA_STABILITY_PIN_CHANGED');
    await verify('dist_rebuilt_runtime_preserved');
    const beforeSecondWake = await harness.stopServiceWorker();
    await verify('worker_restarted_after_dist_rebuild');
    await harness.waitForServiceWorker({ previousTargetId: beforeSecondWake.targetId });
  }
  return { status: 'PASS', buildId: artifact.buildId, publishedBuildId,
    verdictScope: 'infrastructure',
    previousWorkerId: previousWorker.targetId, replacementWorkerId: replacement.targetId,
    osFocusRequested: false, documentExecution: execution,
    scope: 'managed preparation, live build identity, worker wake and optional concurrent dist publication' };
}
