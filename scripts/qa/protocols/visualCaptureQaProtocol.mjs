import path from 'node:path';

import {
  runVisualCapture,
} from '../../dev/visual-harness/captureVisualScene.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';

export async function executeQaProtocol({
  plan,
  artifact,
  browser,
  evidence,
  attachmentsDir,
  signal,
  reportBrowserGpuCapability,
}) {
  if (artifact?.id !== 'source_render') {
    throw new Error('QA_VISUAL_SOURCE_RENDER_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'owned' || !browser.chrome) {
    throw new Error('QA_VISUAL_OWNED_BROWSER_REQUIRED');
  }
  const outputRoot = path.join(attachmentsDir, 'visual');
  await evidence.event('QA_VISUAL_CAPTURE_STARTED', {
    captureConcurrency: plan.captureConcurrency,
    sceneId: plan.protocolOptions.sceneId,
    presentation: plan.browserExecution.presentation,
    headless: plan.browserExecution.headless,
    audioPolicy: plan.browserExecution.audioPolicy,
  });
  const reports = await runVisualCapture({
    all: false,
    headed: plan.browserExecution.headless === false,
    audioPolicy: plan.browserExecution.audioPolicy,
    help: false,
    list: false,
    outputRoot,
    sceneId: plan.protocolOptions.sceneId,
    chromePath: browser.chrome,
    launchEnvironment: browser.launchEnvironment,
    renderingRequirement: plan.browserExecution.renderingRequirement,
    displayReceipt: browser.display,
    browserExecution: plan.browserExecution,
    captureConcurrency: plan.captureConcurrency,
    signal,
  });
  const gpuCapability = reports[0]?.browserOwner?.gpuCapability;
  if (gpuCapability) await reportBrowserGpuCapability(gpuCapability);
  await evidence.event('QA_VISUAL_CAPTURE_FINISHED', {
    sceneId: plan.protocolOptions.sceneId,
    reportCount: reports.length,
  });
  return Object.freeze({
    status: QA_RUN_STATUSES.PASS,
    protocol: 'visual_capture',
    sceneId: plan.protocolOptions.sceneId,
    outputRoot,
    captures: reports.map((report) => ({
      outputDir: report.outputDir,
      status: report.status,
    })),
  });
}
