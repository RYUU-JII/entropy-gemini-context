import { ExtensionChromiumHarness } from '../../e2e/extensionChromiumHarness.mjs';
import { defineEntropyQaAttachedArtifactStage, ENTROPY_QA_TRUSTED_PAGE_PATH } from '../../e2e/qaProfileArtifactSlot.mjs';
import { proveEntropyAttachedArtifactRuntimeReadiness } from './attachOnlyActivePageAdapter.mjs';
import { ServiceWorkerCdpDiagnostics } from '../../perf/cwsServiceWorkerDiagnostics.mjs';

// Infrastructure preparation only. Product settings, sessions and site tabs
// remain operator-owned; the harness closes its exact helper targets.
export async function executeQaProtocol({ plan, artifact, browser, evidence,
  recoveryJournal, registerCleanup, reportBrowserGpuCapability }) {
  const artifactIdentity = { artifactId: artifact.id, inputDigest: artifact.inputDigest,
    buildId: artifact.buildId, releaseProfile: artifact.releaseProfile };
  const temporaryManifest = { requiredPermissions: [], requiredHostPermissions: [] };
  const attachedArtifactStage = defineEntropyQaAttachedArtifactStage({ browser,
    browserExecution: plan.browserExecution, sourceDir: artifact.path,
    artifactIdentity, temporaryManifest });
  const harness = new ExtensionChromiumHarness({ chromePath: browser.chrome,
    distDir: browser.extensionSlot, rootDir: plan.rootDir, headless: plan.browserExecution.headless,
    browserExecution: plan.browserExecution, audioPolicy: plan.browserExecution.audioPolicy,
    launchEnvironment: browser.launchEnvironment, renderingRequirement: plan.browserExecution.renderingRequirement,
    cdpEndpoint: browser.cdpEndpoint, expectedBrowserIdentity: browser.browserIdentity,
    attachedArtifactStage, keepTemp: false, qaProfileDir: browser.profile,
    qaProfileDirectory: browser.profileDirectory, loadInPlace: true,
    trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH,
    attachedArtifactRuntimeReadiness: proveEntropyAttachedArtifactRuntimeReadiness, recoveryJournal });
  registerCleanup('extension_reload_browser', () => harness.close());
  await harness.start();
  await reportBrowserGpuCapability(harness.gpuCapability);
  const activation = harness.attachedArtifactSyncReceipt;
  if (activation?.status !== 'managed_artifact_runtime_ready' || activation.runtimeReadyProved !== true
    || typeof activation.runtimeRefresh !== 'boolean') {
    throw new Error('QA_EXTENSION_RELOAD_ACTIVATION_RECEIPT_REQUIRED');
  }
  let reload = null;
  let readiness = activation.runtimeReadiness;
  if (!activation.runtimeRefresh) {
    reload = await harness.reloadExtensionFromSource();
    readiness = await proveEntropyAttachedArtifactRuntimeReadiness({
      harness, stageAction: activation.stageAction, activationAction: 'reloaded_exact_slot',
      contentIdentityDigest: activation.contentIdentityDigest, browserEpoch: activation.browserEpoch,
      extensionId: activation.extensionId, artifactIdentity, temporaryManifest,
      trustedPagePath: ENTROPY_QA_TRUSTED_PAGE_PATH, runtimeRefresh: true, reloadIssued: true,
    });
  }
  if (readiness?.runtimeReady !== true
    || readiness.artifactRuntimeIdentity?.buildId !== artifact.buildId) {
    throw new Error('QA_EXTENSION_RELOAD_LIVE_BUILD_UNPROVEN');
  }
  // Attach only after readiness has responded. Reading the existing bounded
  // telemetry must not pause or add work to the startup being measured.
  const worker = await harness.getServiceWorker();
  if (!worker?.targetId) throw new Error('QA_EXTENSION_RELOAD_WORKER_MISSING');
  const diagnostics = new ServiceWorkerCdpDiagnostics(harness.cdp, activation.extensionId);
  registerCleanup('extension_reload_worker_diagnostics', async () => {
    await diagnostics.detachTarget(worker.targetId);
    diagnostics.stop();
    if (diagnostics.collectorErrors.length > 0) {
      throw new Error('QA_EXTENSION_RELOAD_WORKER_DIAGNOSTICS_FAILED');
    }
  });
  if (await diagnostics.attachForRead(worker) !== true) {
    throw new Error('QA_EXTENSION_RELOAD_WORKER_DIAGNOSTICS_FAILED');
  }
  const wakeTelemetry = await diagnostics.readRuntimeTelemetry(worker.targetId);
  if (wakeTelemetry?.schemaVersion !== 1) {
    throw new Error('QA_EXTENSION_RELOAD_WAKE_TELEMETRY_MISSING');
  }
  await evidence.event('QA_EXTENSION_RELOAD_WAKE_TELEMETRY', { workerId: worker.targetId, wakeTelemetry });
  const receipt = { status: 'PASS', buildId: artifact.buildId, extensionId: activation.extensionId,
    verdictScope: 'infrastructure',
    activationAction: reload ? 'reloaded_exact_slot' : activation.activationAction,
    runtimeReadyProved: true, reload, readiness,
    scope: 'development artifact activation and live background readiness; no product behavior verdict' };
  await evidence.event('QA_EXTENSION_RELOAD_READY', receipt);
  return receipt;
}
