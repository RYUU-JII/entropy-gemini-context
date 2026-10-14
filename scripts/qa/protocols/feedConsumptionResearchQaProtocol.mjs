import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {
  createBrowserExecutionEnvironment,
} from '../../browser-qa/contracts/browserExecutionContract.mjs';
import {
  getFeedConsumptionResearchMatrix,
  createFeedConsumptionResearchMatrixReport,
  writeFeedConsumptionResearchMatrixReport,
} from '../feedConsumptionResearchSuite.mjs';
import {
  QA_RUN_STATUSES,
} from '../contracts/qaTargetContract.mjs';
import {
  isWindowsChromeExecutable,
} from '../../e2e/extensionChromiumHarness.mjs';
import {
  executeQaProtocol as executeFeedHorizonQaProtocol,
} from './feedHorizonQaProtocol.mjs';

const COMPLETION_MARKER = 'FEED_CONSUMPTION_RESEARCH_COMPLETE';
const RECOVERABLE_MATRIX_TARGET_LOSS = 'Session with given id not found';

function errorTreeIncludes(error, text) {
  if (!error) return false;
  if (String(error.message || error).includes(text)) return true;
  return error instanceof AggregateError
    && Array.isArray(error.errors)
    && error.errors.some((entry) => errorTreeIncludes(entry, text));
}

export function isRecoverableFeedResearchMatrixJourneyFailure(error) {
  return errorTreeIncludes(error, RECOVERABLE_MATRIX_TARGET_LOSS);
}

function createInconclusiveMatrixJourney({
  platform,
  siteId,
  surfaceMode,
  journeyId,
  featureProfile = 'feed_only',
}) {
  return Object.freeze({
    platform,
    siteId,
    surfaceMode,
    journeyId,
    featureProfile,
    status: 'INCONCLUSIVE',
    researchVerdict: 'INSUFFICIENT_EVIDENCE',
    modelBlind: true,
    measurement: Object.freeze({
      requestedAdvanceCount: 0,
      performedAdvanceCount: 0,
      measuredAdvanceCount: 0,
      coverage: 0,
      diagnostics: Object.freeze({
        version: 1,
        status: 'degraded',
        initialConditions: Object.freeze([]),
        failureModes: Object.freeze(['browser_target_session_lost']),
      }),
    }),
    curve: null,
    researchWriteFence: null,
    osFocusGuard: null,
    artifacts: null,
  });
}

function closeTranscriptStream(stream) {
  if (stream.closed) return Promise.resolve();
  return new Promise((resolve) => {
    stream.once('close', resolve);
    stream.end();
  });
}

function observeJsonLines(onPayload) {
  let buffer = '';
  const observe = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return;
    try {
      onPayload(JSON.parse(trimmed));
    } catch {
      // Non-protocol child output remains available in the transcript.
    }
  };
  return {
    write(chunk) {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() || '';
      lines.forEach(observe);
    },
    flush() {
      if (buffer) observe(buffer);
      buffer = '';
    },
  };
}

function createChildArgs({
  plan,
  artifact,
  browser,
  siteId,
  journeyId,
  outputDir,
}) {
  return [
    path.join(plan.rootDir, 'scripts/e2e/feedHorizonInspectionE2E.mjs'),
    '--mode=agent',
    `--site=${siteId}`,
    `--profile=${browser.profile}`,
    `--profile-directory=${browser.profileDirectory}`,
    `--chrome=${browser.chrome}`,
    `--cdp-endpoint=${browser.cdpEndpoint}`,
    `--profile-slot-id=${browser.profileSlotId}`,
    `--extension-slot-admission=${browser.extensionSlotAdmission}`,
    `--artifact-id=${artifact.id}`,
    `--artifact-input-digest=${artifact.inputDigest}`,
    `--artifact-build-id=${artifact.buildId}`,
    `--artifact-release-profile=${artifact.releaseProfile}`,
    '--no-build',
    `--diagnostic-dist=${artifact.path}`,
    `--research-journey=${journeyId}`,
    `--research-output-dir=${outputDir}`,
    `--research-candidate-threshold=${plan.parameters.candidateThresholdPercent / 100}`,
    `--research-reference-dwell-ms=${plan.parameters.referenceDwellMs}`,
    `--research-feature-profile=${plan.parameters.featureProfile}`,
  ];
}

async function executeJourney(context, {
  platform,
  siteId,
  runtimeSiteId = siteId,
  surfaceMode,
  journeyId,
  outputDir,
}) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    runChild,
    attachmentsDir,
  } = context;
  const transcriptStem = `${platform}-${journeyId}`;
  const stdoutPath = path.join(attachmentsDir, `${transcriptStem}.stdout.log`);
  const stderrPath = path.join(attachmentsDir, `${transcriptStem}.stderr.log`);
  const stdoutStream = fs.createWriteStream(stdoutPath, { encoding: 'utf8' });
  const stderrStream = fs.createWriteStream(stderrPath, { encoding: 'utf8' });
  const transcriptErrors = [];
  stdoutStream.on('error', (error) => transcriptErrors.push(error));
  stderrStream.on('error', (error) => transcriptErrors.push(error));
  let completion = null;
  let osFocusGuard = null;
  const markerEvents = [];
  const observer = observeJsonLines((payload) => {
    if (payload?.status === 'QA_BROWSER_OS_FOCUS_PRESERVED') {
      osFocusGuard = payload;
      markerEvents.push(evidence.event('QA_BROWSER_OS_FOCUS_PRESERVED', {
        applicable: payload.applicable === true,
        preserved: payload.preserved === true,
        platform,
      }).then(() => null, (error) => error));
      return;
    }
    if (payload?.status !== COMPLETION_MARKER) return;
    completion = payload;
    markerEvents.push(evidence.event('QA_FEED_RESEARCH_COMPLETE', {
      phase: COMPLETION_MARKER,
      platform,
      siteId: payload.siteId,
      journeyId: payload.journeyId,
      outcome: payload.outcome,
      featureProfile: payload.featureProfile,
      measurementCoverage: payload.measurementCoverage,
    }).then(() => null, (error) => error));
  });

  try {
    await runChild({
      command: process.execPath,
      args: createChildArgs({
        plan,
        artifact,
        browser,
        siteId,
        journeyId,
        outputDir,
      }),
      env: {
        ...process.env,
        ...browser.launchEnvironment,
        ...createBrowserExecutionEnvironment(plan.browserExecution),
        QA_BROWSER_RENDERING_REQUIREMENT: plan.browserExecution.renderingRequirement,
      },
      onStdout: (chunk) => {
        stdoutStream.write(chunk);
        observer.write(chunk);
      },
      onStderr: (chunk) => stderrStream.write(chunk),
    });
  } finally {
    observer.flush();
    await Promise.all([
      closeTranscriptStream(stdoutStream),
      closeTranscriptStream(stderrStream),
    ]);
    const eventErrors = (await Promise.all(markerEvents)).filter(Boolean);
    const errors = [...transcriptErrors, ...eventErrors];
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `QA_FEED_RESEARCH_FINALIZATION_FAILED:${errors.length}`,
      );
    }
  }

  if (!completion) throw new Error('QA_FEED_RESEARCH_COMPLETION_EVIDENCE_MISSING');
  if (
    isWindowsChromeExecutable(browser.chrome)
    && (
      osFocusGuard?.applicable !== true
      || osFocusGuard?.preserved !== true
    )
  ) {
    throw new Error('QA_FEED_RESEARCH_OS_FOCUS_GUARD_MISSING');
  }
  const summaryPath = path.join(outputDir, 'summary.json');
  const artifactPayload = JSON.parse(await fsPromises.readFile(summaryPath, 'utf8'));
  const summary = artifactPayload?.summary;
  const researchVerdicts = new Set(['MATCH', 'MISMATCH', 'INSUFFICIENT_EVIDENCE']);
  if (
    !summary
    || summary.modelBlind !== true
    || summary.modelOutputsUsedAsBehavioralBranches !== false
    || summary.siteId !== runtimeSiteId
    || summary.surfaceMode !== surfaceMode
    || summary.journeyId !== journeyId
    || summary.featureProfile !== plan.parameters.featureProfile
    || summary.runtimeCostEvidence?.state !== 'measured'
    || summary.stabilityEvidence?.state !== 'measured'
    || summary.stabilityEvidence?.version !== 1
    || summary.researchWriteFence?.active !== true
    || summary.researchWriteFence?.currentEpisodeTainted !== true
    || !researchVerdicts.has(summary.researchVerdict)
    || completion.journeyId !== summary.journeyId
    || completion.siteId !== summary.siteId
    || completion.featureProfile !== summary.featureProfile
    || completion.outcome !== summary.status
    || completion.researchVerdict !== summary.researchVerdict
  ) {
    throw new Error('QA_FEED_RESEARCH_SUMMARY_CONTRACT_INVALID');
  }
  return Object.freeze({
    platform,
    siteId: runtimeSiteId,
    surfaceMode,
    journeyId,
    featureProfile: summary.featureProfile,
    status: summary.status === 'PASS' ? 'PASS' : 'INCONCLUSIVE',
    researchVerdict: summary.researchVerdict,
    modelBlind: true,
    measurement: Object.freeze({
      requestedAdvanceCount: summary.requestedAdvanceCount,
      performedAdvanceCount: summary.performedAdvanceCount,
      measuredAdvanceCount: summary.measuredAdvanceCount,
      coverage: summary.measurementCoverage,
      diagnostics: summary.measurementDiagnostics,
      runtimeCostEvidence: summary.runtimeCostEvidence,
    }),
    curve: summary.analysis,
    researchWriteFence: summary.researchWriteFence,
    osFocusGuard: osFocusGuard
      ? Object.freeze({
        applicable: osFocusGuard.applicable === true,
        preserved: osFocusGuard.preserved === true,
      })
      : null,
    artifacts: Object.freeze({
      tracePath: path.join(outputDir, 'trace.jsonl'),
      summaryPath,
      markdownPath: path.join(outputDir, 'report.md'),
      stdoutPath,
      stderrPath,
    }),
  });
}

export async function executeQaProtocol(context) {
  const {
    plan,
    artifact,
    browser,
    evidence,
    initialWindowFocusAnchor,
    attachmentsDir,
  } = context;
  if (artifact?.id !== 'dev_extension' || artifact?.releaseProfile !== 'dev') {
    throw new Error('QA_FEED_RESEARCH_DEV_ARTIFACT_REQUIRED');
  }
  if (browser?.processOwnership !== 'attach_only' || !browser.cdpEndpoint) {
    throw new Error('QA_FEED_RESEARCH_ATTACH_ONLY_BROWSER_REQUIRED');
  }
  if (!Number.isInteger(browser.baselinePageTargetCount)) {
    throw new Error('QA_FEED_RESEARCH_BASELINE_PAGE_COUNT_REQUIRED');
  }

  if (browser.baselinePageTargetCount === 0) {
    if (
      plan.parameters.allowInitialWindowFocusOnce !== true
      || browser.initialWindowFocusOnceAllowed !== true
      || initialWindowFocusAnchor?.status !== 'ready'
    ) {
      throw new Error('QA_FEED_RESEARCH_INITIAL_WINDOW_FOCUS_NOT_AUTHORIZED');
    }
  }

  if (plan.protocolOptions.matrixId) {
    const matrix = getFeedConsumptionResearchMatrix(plan.protocolOptions.matrixId);
    const matrixRoot = path.join(attachmentsDir, 'feed-consumption-research-matrix');
    const runs = [];
    for (const entry of matrix.entries) {
      for (const journeyId of matrix.journeys) {
        try {
          runs.push(await executeJourney(context, {
            ...entry,
            journeyId,
            outputDir: path.join(matrixRoot, entry.platform, journeyId),
          }));
        } catch (error) {
          if (!isRecoverableFeedResearchMatrixJourneyFailure(error)) throw error;
          const inconclusive = createInconclusiveMatrixJourney({
            ...entry,
            journeyId,
          });
          runs.push(inconclusive);
          await evidence.event('QA_FEED_RESEARCH_JOURNEY_INCONCLUSIVE', {
            platform: entry.platform,
            siteId: entry.siteId,
            journeyId,
            reason: 'browser_target_session_lost',
          });
        }
      }
    }
    const matrixReport = createFeedConsumptionResearchMatrixReport({
      matrixId: matrix.id,
      runs,
      candidateThresholdPercent: plan.parameters.candidateThresholdPercent,
      referenceDwellMs: plan.parameters.referenceDwellMs,
    });
    const matrixPaths = await writeFeedConsumptionResearchMatrixReport(
      matrixRoot,
      matrixReport,
    );
    let feedbackCanary = null;
    if (plan.protocolOptions.feedbackCanary) {
      const canary = plan.protocolOptions.feedbackCanary;
      const canaryAttachmentsDir = path.join(attachmentsDir, 'feedback-only-canary');
      await fsPromises.mkdir(canaryAttachmentsDir, { recursive: true });
      feedbackCanary = await executeFeedHorizonQaProtocol({
        ...context,
        attachmentsDir: canaryAttachmentsDir,
        plan: {
          ...plan,
          protocolOptions: {
            siteId: canary.siteId,
            surfaceMode: canary.surfaceMode,
          },
          parameters: {
            ...plan.parameters,
            holdMs: canary.holdMs,
            dwellMs: canary.dwellMs,
          },
        },
      });
    }
    return Object.freeze({
      status: matrixReport.status === 'PASS'
        ? QA_RUN_STATUSES.PASS
        : QA_RUN_STATUSES.INCONCLUSIVE,
      protocol: 'feed_consumption_research',
      matrixId: matrix.id,
      modelBlind: true,
      researchVerdict: matrixReport.researchVerdict,
      runs: matrixReport.runs,
      analysisByPlatform: matrixReport.analysisByPlatform,
      sensitivityByPlatform: matrixReport.sensitivityByPlatform,
      feedbackCanary,
      artifacts: matrixPaths,
      initialWindowFocusAnchor,
      browserProcessPreserved: true,
    });
  }

  const siteId = plan.protocolOptions.siteId;
  const platform = plan.protocolOptions.platform;
  const journey = await executeJourney(context, {
    platform,
    siteId,
    runtimeSiteId: plan.protocolOptions.runtimeSiteId,
    surfaceMode: plan.protocolOptions.surfaceMode,
    journeyId: plan.parameters.journey,
    outputDir: path.join(attachmentsDir, 'feed-consumption-research'),
  });
  return Object.freeze({
    status: journey.status === 'PASS'
      ? QA_RUN_STATUSES.PASS
      : QA_RUN_STATUSES.INCONCLUSIVE,
    protocol: 'feed_consumption_research',
    siteId: journey.siteId,
    surfaceMode: journey.surfaceMode,
    journeyId: journey.journeyId,
    featureProfile: journey.featureProfile,
    modelBlind: true,
    researchVerdict: journey.researchVerdict,
    measurement: journey.measurement,
    curve: journey.curve,
    researchWriteFence: journey.researchWriteFence,
    artifacts: journey.artifacts,
    initialWindowFocusAnchor,
    browserProcessPreserved: true,
  });
}
