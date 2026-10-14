import fs from 'node:fs/promises';
import path from 'node:path';

import {
  analyzeFeedConsumptionResearchSuite,
  createFeedConsumptionResearchMarkdownReport,
  projectFeedConsumptionResearchSensitivity,
} from '../e2e/feed-consumption-research/feedConsumptionResearchAnalysis.mjs';

const MATRICES = Object.freeze({
  cross_platform_core: Object.freeze({
    id: 'cross_platform_core',
    entries: Object.freeze([
      Object.freeze({ platform: 'tiktok', siteId: 'tiktok', surfaceMode: 'paged' }),
      Object.freeze({
        platform: 'youtube-shorts',
        siteId: 'youtube',
        surfaceMode: 'paged',
      }),
      Object.freeze({
        platform: 'instagram-reels',
        siteId: 'instagram',
        surfaceMode: 'paged',
      }),
      Object.freeze({ platform: 'x-home', siteId: 'x', surfaceMode: 'continuous' }),
    ]),
    journeys: Object.freeze([
      'skim_forward',
      'steady_forward',
      'deliberate_watch',
      'burst_pause_burst',
      'revisit_deliberate',
    ]),
  }),
  x_completion: Object.freeze({
    id: 'x_completion',
    entries: Object.freeze([
      Object.freeze({ platform: 'x-home', siteId: 'x', surfaceMode: 'continuous' }),
    ]),
    journeys: Object.freeze([
      'deliberate_watch',
      'burst_pause_burst',
      'revisit_deliberate',
    ]),
  }),
});

export function getFeedConsumptionResearchMatrix(matrixId) {
  const matrix = MATRICES[matrixId];
  if (!matrix) {
    throw new Error(`QA_FEED_RESEARCH_MATRIX_UNKNOWN:${String(matrixId || '')}`);
  }
  return matrix;
}

function curveToTrace(curve) {
  return {
    journeyId: curve.journeyId,
    surfaceMode: curve.surfaceMode,
    checkpoints: curve.points.map((point) => ({
      index: point.index,
      elapsedMs: point.elapsedMs,
      step: { kind: point.stepKind, direction: point.stepDirection },
      observation: {
        loopSignals: {
          directionality: point.observationDirectionality,
        },
      },
      model: {
        evidence: {
          behaviorLoad: point.behaviorLoad,
          measurementConfidence: point.measurementConfidence,
          components: {
            resumedBurst: point.resumedBurstSignal,
          },
          amplification: {
            resumedBurst: point.resumedBurstLift,
          },
          measurements: {
            interstitialBackwardAdvanceCount: point.interstitialBackwardAdvanceCount,
          },
        },
        detection: {
          pressure: point.pressure,
          confidence: point.detectionConfidence,
          state: point.state,
          candidate: point.candidate,
        },
        feedDecision: {
          state: point.feedDecisionState,
          candidateState: point.feedDecisionCandidateState,
          metrics: point.feedDecisionDirectionality,
          reasons: point.feedDecisionBacktrackSignal
            ? ['backtrack_signal_present']
            : [],
        },
        admission: point.admissionStatus === null
          ? null
          : {
            status: point.admissionStatus,
            reasons: point.admissionReasons,
          },
        matureSessionAdmission: point.matureSessionProjectionStatus === null
          ? null
          : {
            status: point.matureSessionProjectionStatus,
            admission: point.matureSessionAdmissionStatus === null
              ? null
              : {
                status: point.matureSessionAdmissionStatus,
                reasons: point.matureSessionAdmissionReasons,
              },
          },
      },
    })),
  };
}

function createSuiteMarkdown(report) {
  const lines = [
    '# Feed Consumption Research Matrix',
    '',
    `- Matrix: ${report.matrixId}`,
    `- Status: ${report.status}`,
    `- Research verdict: ${report.researchVerdict}`,
    `- Runs: ${report.runs.length}`,
    `- Passed: ${report.runs.filter((run) => run.status === 'PASS').length}`,
    `- Inconclusive: ${report.runs.filter((run) => run.status === 'INCONCLUSIVE').length}`,
    `- Excluded from pairwise analysis: ${report.excludedFromPairwiseAnalysis.length}`,
    '',
    '## Runs',
    '',
    '| Platform | Journey | Status | Coverage | Mean load | Peak load | First candidate | Actual admit | Mature admit | Expectation |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];
  report.runs.forEach((run) => {
    const curve = run.curve || {};
    lines.push(
      `| ${run.platform} | ${run.journeyId} | ${run.status}`
      + ` | ${run.measurement.coverage} | ${curve.meanBehaviorLoad ?? '-'}`
      + ` | ${curve.peakBehaviorLoad ?? '-'}`
      + ` | ${curve.firstCandidateCheckpoint ?? '-'}`
      + ` | ${curve.firstActualAdmissionCheckpoint ?? '-'}`
      + ` | ${curve.firstMatureSessionAdmissionCheckpoint ?? '-'}`
      + ` | ${curve.researchExpectation?.status || 'INSUFFICIENT_EVIDENCE'} |`,
    );
  });
  Object.entries(report.analysisByPlatform).forEach(([platform, analysis]) => {
    lines.push('', createFeedConsumptionResearchMarkdownReport(analysis, {
      title: `Pairwise separation: ${platform}`,
    }).trim());
    const sensitivity = report.sensitivityByPlatform[platform];
    lines.push('', `## Threshold sensitivity: ${platform}`, '');
    lines.push(
      '| Threshold | Required misses | Forbidden hits |',
      '| ---: | ---: | ---: |',
    );
    sensitivity.detectorProjections.forEach((projection) => {
      lines.push(
        `| ${projection.candidateThreshold}`
        + ` | ${projection.requiredCandidateMissingCount}`
        + ` | ${projection.forbiddenCandidatePresentCount} |`,
      );
    });
  });
  return `${lines.join('\n')}\n`;
}

function createEmptyPlatformAnalysis() {
  return Object.freeze({
    version: 2,
    curveCount: 0,
    curves: Object.freeze([]),
    comparisons: Object.freeze([]),
    collisions: Object.freeze([]),
    semanticCollisions: Object.freeze([]),
    semanticCollisionSummary: Object.freeze({
      actionableCount: 0,
      reviewCount: 0,
      informationalCount: 0,
    }),
    timerOnlyViolationCount: 0,
    expectationSummary: Object.freeze({
      matchCount: 0,
      mismatchCount: 0,
      insufficientEvidenceCount: 0,
    }),
  });
}

export function createFeedConsumptionResearchMatrixReport({
  matrixId,
  runs,
  candidateThresholdPercent,
  referenceDwellMs,
} = {}) {
  const matrix = getFeedConsumptionResearchMatrix(matrixId);
  if (!Array.isArray(runs) || runs.length !== matrix.entries.length * matrix.journeys.length) {
    throw new Error('QA_FEED_RESEARCH_MATRIX_RUN_COUNT_INVALID');
  }
  const analysisByPlatform = Object.fromEntries(matrix.entries.map(({ platform }) => {
    const traces = runs
      .filter((run) => run.platform === platform && run.status === 'PASS')
      .map((run) => curveToTrace(run.curve));
    return [platform, traces.length > 0
      ? analyzeFeedConsumptionResearchSuite(traces)
      : createEmptyPlatformAnalysis()];
  }));
  const hasInconclusive = runs.some((run) => run.status === 'INCONCLUSIVE');
  const sensitivityByPlatform = Object.fromEntries(
    Object.entries(analysisByPlatform).map(([platform, analysis]) => [
      platform,
      projectFeedConsumptionResearchSensitivity(analysis),
    ]),
  );
  const excludedFromPairwiseAnalysis = runs
    .filter((run) => run.status !== 'PASS')
    .map((run) => Object.freeze({
      platform: run.platform,
      journeyId: run.journeyId,
      status: run.status,
      reason: run.measurement?.diagnostics?.failureModes?.[0]
        || 'insufficient_dom_measurement',
    }));
  const expectationStatuses = Object.values(analysisByPlatform)
    .flatMap((analysis) => analysis.curves)
    .map((curve) => curve.researchExpectation.status);
  const researchVerdict = expectationStatuses.includes('MISMATCH')
    ? 'REVIEW_REQUIRED'
    : hasInconclusive || expectationStatuses.includes('INSUFFICIENT_EVIDENCE')
      ? 'INCONCLUSIVE'
      : 'MATCH';
  return Object.freeze({
    version: 3,
    matrixId,
    status: hasInconclusive ? 'INCONCLUSIVE' : 'PASS',
    researchVerdict,
    createdAt: new Date().toISOString(),
    candidateThresholdPercent,
    referenceDwellMs,
    runs: Object.freeze(runs.map((run) => Object.freeze({ ...run }))),
    analysisByPlatform: Object.freeze(analysisByPlatform),
    sensitivityByPlatform: Object.freeze(sensitivityByPlatform),
    excludedFromPairwiseAnalysis: Object.freeze(excludedFromPairwiseAnalysis),
  });
}

export async function writeFeedConsumptionResearchMatrixReport(outputDir, report) {
  const jsonPath = path.join(outputDir, 'matrix.json');
  const markdownPath = path.join(outputDir, 'matrix.md');
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(markdownPath, createSuiteMarkdown(report), 'utf8');
  return Object.freeze({ jsonPath, markdownPath });
}
