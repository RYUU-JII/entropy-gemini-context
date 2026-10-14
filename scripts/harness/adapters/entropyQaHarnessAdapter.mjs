import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  getQaTarget,
  listQaTargets,
} from '../../qa/catalog/qaTargetRegistry.mjs';
import {
  classifyQaErrorStatus,
} from '../../qa/contracts/qaEvidenceContract.mjs';
import {
  compileQaRun,
} from '../../qa/runtime/QaRunCompiler.mjs';
import {
  runQaSession,
} from '../../qa/runtime/QaRunSession.mjs';
import {
  createProjectHarnessPlanDigest,
  createProjectHarnessPlanEnvelope,
  createProjectHarnessResultEnvelope,
  normalizeProjectHarnessPlanDigest,
  normalizeProjectHarnessRequest,
  PROJECT_HARNESS_INTELLIGENCE_POLICY,
  PROJECT_HARNESS_RUNTIME_REVISION,
} from '../contracts/projectHarnessEnvelope.mjs';

export const ENTROPY_QA_HARNESS_ADAPTER_ID = 'entropy-qa';
export const ENTROPY_QA_HARNESS_ADAPTER_REVISION = 'entropy-qa-adapter@1';

function tagHarnessError(error) {
  if (error && typeof error === 'object') {
    error.harnessStatus = classifyQaErrorStatus(error);
  }
  throw error;
}

function assertRunReturnMatchesCanonical(returnedReport, canonicalReport) {
  if (
    !returnedReport
    || typeof returnedReport !== 'object'
    || Array.isArray(returnedReport)
  ) {
    throw new Error('PROJECT_HARNESS_QA_RETURNED_REPORT_INVALID');
  }
  [
    'contractVersion',
    'runId',
    'targetId',
    'mode',
    'status',
  ].forEach((key) => {
    if (returnedReport[key] !== canonicalReport[key]) {
      throw new Error(
        `PROJECT_HARNESS_QA_RETURNED_REPORT_MISMATCH:${key}`,
      );
    }
  });
}

export async function readCanonicalQaReportEvidence(plan) {
  const reportPath = path.join(plan.runRoot, 'run.json');
  let reportBytes;
  try {
    reportBytes = await fs.readFile(reportPath);
  } catch (error) {
    throw new Error(
      `PROJECT_HARNESS_QA_REPORT_UNAVAILABLE:${reportPath}`,
      { cause: error },
    );
  }
  let report;
  try {
    report = JSON.parse(reportBytes.toString('utf8'));
  } catch (error) {
    throw new Error(
      `PROJECT_HARNESS_QA_REPORT_INVALID_JSON:${reportPath}`,
      { cause: error },
    );
  }
  return Object.freeze({
    report,
    evidence: Object.freeze({
      path: reportPath,
      sha256: `sha256:${createHash('sha256').update(reportBytes).digest('hex')}`,
    }),
  });
}

export function createEntropyQaHarnessAdapter({
  compilePlan = compileQaRun,
  runPlan = runQaSession,
  adapterRevision = ENTROPY_QA_HARNESS_ADAPTER_REVISION,
  runtimeRevision = PROJECT_HARNESS_RUNTIME_REVISION,
} = {}) {
  if (typeof compilePlan !== 'function') {
    throw new Error('PROJECT_HARNESS_QA_COMPILER_REQUIRED');
  }
  if (typeof runPlan !== 'function') {
    throw new Error('PROJECT_HARNESS_QA_RUNNER_REQUIRED');
  }

  async function compileRequest(rootDir, rawRequest) {
    const request = normalizeProjectHarnessRequest(rawRequest);
    try {
      const plan = await compilePlan({
        rootDir,
        targetId: request.targetId,
        mode: request.mode,
        rawParameters: request.parameters,
        configPath: request.configPath,
        runId: request.runId,
      });
      return Object.freeze({ request, plan });
    } catch (error) {
      tagHarnessError(error);
    }
  }

  return Object.freeze({
    id: ENTROPY_QA_HARNESS_ADAPTER_ID,
    revision: adapterRevision,
    runtimeRevision,
    title: 'Entropy QA control plane',
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,

    list() {
      return Object.freeze(listQaTargets().map((target) => Object.freeze({
        id: target.id,
        title: target.title,
        family: target.family,
        lane: target.lane,
        supportedModes: target.supportedModes,
      })));
    },

    describe({ targetId } = {}) {
      return getQaTarget(targetId);
    },

    async plan({ rootDir, request: rawRequest } = {}) {
      const { request, plan } = await compileRequest(rootDir, rawRequest);
      return createProjectHarnessPlanEnvelope({
        adapterId: ENTROPY_QA_HARNESS_ADAPTER_ID,
        adapterRevision,
        runtimeRevision,
        request,
        plan,
      });
    },

    async run({
      rootDir,
      request: rawRequest,
      expectedPlanDigest,
      signal = null,
    } = {}) {
      const normalizedExpectedDigest = normalizeProjectHarnessPlanDigest(
        expectedPlanDigest,
      );
      const { plan } = await compileRequest(rootDir, rawRequest);
      const actualPlanDigest = createProjectHarnessPlanDigest({
        adapterId: ENTROPY_QA_HARNESS_ADAPTER_ID,
        adapterRevision,
        runtimeRevision,
        plan,
      });
      if (actualPlanDigest !== normalizedExpectedDigest) {
        const error = new Error(
          `PROJECT_HARNESS_PLAN_CHANGED:${normalizedExpectedDigest}:${actualPlanDigest}`,
        );
        error.code = 'PROJECT_HARNESS_PLAN_CHANGED';
        error.harnessStatus = 'FAIL';
        throw error;
      }
      let returnedReport;
      try {
        returnedReport = await runPlan(plan, { signal });
      } catch (error) {
        tagHarnessError(error);
      }
      const { report, evidence } = await readCanonicalQaReportEvidence(plan);
      assertRunReturnMatchesCanonical(returnedReport, report);
      return createProjectHarnessResultEnvelope({
        adapterId: ENTROPY_QA_HARNESS_ADAPTER_ID,
        adapterRevision,
        runtimeRevision,
        plan,
        planDigest: actualPlanDigest,
        report,
        reportEvidence: evidence,
      });
    },

    classifyError(error) {
      return typeof error?.harnessStatus === 'string'
        ? error.harnessStatus
        : classifyQaErrorStatus(error);
    },
  });
}

export const entropyQaHarnessAdapter = createEntropyQaHarnessAdapter();
