import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const PROJECT_HARNESS_CONTRACT_VERSION = 1;
export const PROJECT_HARNESS_RUNTIME_REVISION = 'project-harness-runtime@1';
export const PROJECT_HARNESS_INTELLIGENCE_POLICY = Object.freeze({
  default: 'none',
  review: 'operator_requested',
});

const RUN_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const TERMINAL_STATUSES = new Set([
  'PASS',
  'FAIL',
  'BLOCKED',
  'INCONCLUSIVE',
]);
const REQUEST_KEYS = new Set([
  'contractVersion',
  'targetId',
  'mode',
  'parameters',
  'configPath',
  'runId',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function cloneProjectHarnessJsonData(value, pathLabel = 'value') {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail('PROJECT_HARNESS_NON_JSON_VALUE', pathLabel);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((entry, index) => (
        cloneProjectHarnessJsonData(entry, `${pathLabel}[${index}]`)
      )),
    );
  }
  if (!isPlainObject(value)) {
    fail('PROJECT_HARNESS_NON_JSON_VALUE', pathLabel);
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      cloneProjectHarnessJsonData(entry, `${pathLabel}.${key}`),
    ]),
  ));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function requireString(value, code) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
    fail(code);
  }
  return value;
}

function normalizeRevision(value, code) {
  const revision = requireString(value, code);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._@/-]{0,159}$/u.test(revision)) {
    fail(code, revision);
  }
  return revision;
}

function createResultRefs(runRoot) {
  return Object.freeze({
    runRoot,
    events: path.join(runRoot, 'events.jsonl'),
    cleanup: path.join(runRoot, 'cleanup.json'),
    report: path.join(runRoot, 'run.json'),
    attachments: path.join(runRoot, 'attachments'),
  });
}

function resolveReviewDisposition(report) {
  const reviewRecommended = report.status === 'BLOCKED'
    || report.status === 'INCONCLUSIVE';
  if (!reviewRecommended) {
    return Object.freeze({
      reviewRecommended: false,
      reasonCode: null,
    });
  }
  const explicitCode = typeof report.error?.code === 'string'
    ? report.error.code.trim()
    : '';
  const messageCode = typeof report.error?.message === 'string'
    ? report.error.message.match(/^[A-Z][A-Z0-9_]+/u)?.[0] || ''
    : '';
  return Object.freeze({
    reviewRecommended: true,
    reasonCode: explicitCode
      || messageCode
      || `PROJECT_HARNESS_${report.status}`,
  });
}

export function normalizeProjectHarnessRequest(rawRequest) {
  if (!isPlainObject(rawRequest)) fail('PROJECT_HARNESS_REQUEST_INVALID');
  const unknownKey = Object.keys(rawRequest).find((key) => !REQUEST_KEYS.has(key));
  if (unknownKey) fail('PROJECT_HARNESS_REQUEST_KEY_UNKNOWN', unknownKey);
  REQUEST_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(rawRequest, key)) {
      fail('PROJECT_HARNESS_REQUEST_KEY_REQUIRED', key);
    }
  });
  if (rawRequest.contractVersion !== PROJECT_HARNESS_CONTRACT_VERSION) {
    fail(
      'PROJECT_HARNESS_REQUEST_CONTRACT_VERSION_INVALID',
      String(rawRequest.contractVersion),
    );
  }
  const targetId = requireString(
    rawRequest.targetId,
    'PROJECT_HARNESS_REQUEST_TARGET_REQUIRED',
  );
  const mode = requireString(
    rawRequest.mode,
    'PROJECT_HARNESS_REQUEST_MODE_REQUIRED',
  );
  if (!isPlainObject(rawRequest.parameters)) {
    fail('PROJECT_HARNESS_REQUEST_PARAMETERS_INVALID');
  }
  const configPath = rawRequest.configPath;
  if (
    configPath !== null
    && (typeof configPath !== 'string' || !path.isAbsolute(configPath))
  ) {
    fail('PROJECT_HARNESS_REQUEST_CONFIG_ABSOLUTE_REQUIRED');
  }
  const runId = requireString(
    rawRequest.runId,
    'PROJECT_HARNESS_REQUEST_RUN_ID_REQUIRED',
  );
  if (!RUN_ID_PATTERN.test(runId)) {
    fail('PROJECT_HARNESS_REQUEST_RUN_ID_INVALID', runId);
  }
  return Object.freeze({
    contractVersion: PROJECT_HARNESS_CONTRACT_VERSION,
    targetId,
    mode,
    parameters: cloneProjectHarnessJsonData(
      rawRequest.parameters,
      'request.parameters',
    ),
    configPath: configPath === null ? null : path.normalize(configPath),
    runId,
  });
}

export async function readProjectHarnessRequest(requestPath) {
  if (typeof requestPath !== 'string' || !path.isAbsolute(requestPath)) {
    fail('PROJECT_HARNESS_REQUEST_PATH_ABSOLUTE_REQUIRED');
  }
  let rawRequest;
  try {
    rawRequest = JSON.parse(await fs.readFile(requestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `PROJECT_HARNESS_REQUEST_UNAVAILABLE:${requestPath}`,
      { cause: error },
    );
  }
  return normalizeProjectHarnessRequest(rawRequest);
}

export function createProjectHarnessPlanDigest({
  adapterId,
  adapterRevision,
  runtimeRevision = PROJECT_HARNESS_RUNTIME_REVISION,
  plan,
}) {
  const digestInput = Object.freeze({
    adapterId: requireString(
      adapterId,
      'PROJECT_HARNESS_ADAPTER_ID_REQUIRED',
    ),
    adapterRevision: normalizeRevision(
      adapterRevision,
      'PROJECT_HARNESS_ADAPTER_REVISION_REQUIRED',
    ),
    runtimeRevision: normalizeRevision(
      runtimeRevision,
      'PROJECT_HARNESS_RUNTIME_REVISION_REQUIRED',
    ),
    plan: cloneProjectHarnessJsonData(plan, 'plan'),
  });
  const canonicalJson = JSON.stringify(canonicalize(digestInput));
  return `sha256:${createHash('sha256').update(canonicalJson).digest('hex')}`;
}

export function normalizeProjectHarnessPlanDigest(value) {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    fail('PROJECT_HARNESS_PLAN_DIGEST_INVALID', String(value || 'missing'));
  }
  return value;
}

export function createProjectHarnessPlanEnvelope({
  adapterId,
  adapterRevision,
  runtimeRevision = PROJECT_HARNESS_RUNTIME_REVISION,
  request,
  plan,
}) {
  const normalizedAdapterId = requireString(
    adapterId,
    'PROJECT_HARNESS_ADAPTER_ID_REQUIRED',
  );
  const normalizedRequest = normalizeProjectHarnessRequest(request);
  const normalizedAdapterRevision = normalizeRevision(
    adapterRevision,
    'PROJECT_HARNESS_ADAPTER_REVISION_REQUIRED',
  );
  const normalizedRuntimeRevision = normalizeRevision(
    runtimeRevision,
    'PROJECT_HARNESS_RUNTIME_REVISION_REQUIRED',
  );
  const normalizedPlan = cloneProjectHarnessJsonData(plan, 'plan');
  if (normalizedPlan.runId !== normalizedRequest.runId) {
    fail('PROJECT_HARNESS_PLAN_RUN_ID_MISMATCH');
  }
  if (normalizedPlan.targetId !== normalizedRequest.targetId) {
    fail('PROJECT_HARNESS_PLAN_TARGET_MISMATCH');
  }
  if (!path.isAbsolute(normalizedPlan.runRoot || '')) {
    fail('PROJECT_HARNESS_PLAN_RUN_ROOT_ABSOLUTE_REQUIRED');
  }
  if (!Array.isArray(normalizedPlan.resourceClaims)) {
    fail('PROJECT_HARNESS_PLAN_RESOURCE_CLAIMS_REQUIRED');
  }
  const planDigest = createProjectHarnessPlanDigest({
    adapterId: normalizedAdapterId,
    adapterRevision: normalizedAdapterRevision,
    runtimeRevision: normalizedRuntimeRevision,
    plan: normalizedPlan,
  });
  return Object.freeze({
    contractVersion: PROJECT_HARNESS_CONTRACT_VERSION,
    kind: 'project_harness_plan',
    adapterId: normalizedAdapterId,
    adapterRevision: normalizedAdapterRevision,
    runtimeRevision: normalizedRuntimeRevision,
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
    status: 'READY',
    targetId: normalizedPlan.targetId,
    mode: normalizedPlan.mode,
    runId: normalizedPlan.runId,
    planDigest,
    resourceClaims: Object.freeze([...normalizedPlan.resourceClaims]),
    resultRefs: createResultRefs(normalizedPlan.runRoot),
    plan: normalizedPlan,
  });
}

export function createProjectHarnessResultEnvelope({
  adapterId,
  adapterRevision,
  runtimeRevision = PROJECT_HARNESS_RUNTIME_REVISION,
  plan,
  planDigest,
  report,
  reportEvidence,
}) {
  const normalizedAdapterId = requireString(
    adapterId,
    'PROJECT_HARNESS_ADAPTER_ID_REQUIRED',
  );
  const normalizedAdapterRevision = normalizeRevision(
    adapterRevision,
    'PROJECT_HARNESS_ADAPTER_REVISION_REQUIRED',
  );
  const normalizedRuntimeRevision = normalizeRevision(
    runtimeRevision,
    'PROJECT_HARNESS_RUNTIME_REVISION_REQUIRED',
  );
  const normalizedDigest = normalizeProjectHarnessPlanDigest(planDigest);
  const actualDigest = createProjectHarnessPlanDigest({
    adapterId: normalizedAdapterId,
    adapterRevision: normalizedAdapterRevision,
    runtimeRevision: normalizedRuntimeRevision,
    plan,
  });
  if (normalizedDigest !== actualDigest) {
    fail('PROJECT_HARNESS_RESULT_PLAN_DIGEST_MISMATCH');
  }
  if (!isPlainObject(report)) {
    fail('PROJECT_HARNESS_RESULT_REPORT_INVALID');
  }
  if (report.contractVersion !== 1) {
    fail(
      'PROJECT_HARNESS_RESULT_REPORT_CONTRACT_VERSION_INVALID',
      String(report.contractVersion),
    );
  }
  if (report.runId !== plan.runId) {
    fail('PROJECT_HARNESS_RESULT_RUN_ID_MISMATCH');
  }
  if (report.targetId !== plan.targetId) {
    fail('PROJECT_HARNESS_RESULT_TARGET_MISMATCH');
  }
  if (report.mode !== plan.mode) {
    fail('PROJECT_HARNESS_RESULT_MODE_MISMATCH');
  }
  if (!TERMINAL_STATUSES.has(report.status)) {
    fail('PROJECT_HARNESS_RESULT_STATUS_INVALID', String(report.status));
  }
  if (
    report.durationMs !== undefined
    && (!Number.isFinite(report.durationMs) || report.durationMs < 0)
  ) {
    fail('PROJECT_HARNESS_RESULT_DURATION_INVALID');
  }
  if (
    report.error !== null
    && report.error !== undefined
    && !isPlainObject(report.error)
  ) {
    fail('PROJECT_HARNESS_RESULT_ERROR_INVALID');
  }
  const error = report.error === null || report.error === undefined
    ? null
    : cloneProjectHarnessJsonData(report.error, 'report.error');
  const reviewDisposition = resolveReviewDisposition({
    status: report.status,
    error,
  });
  if (!isPlainObject(reportEvidence)) {
    fail('PROJECT_HARNESS_RESULT_REPORT_EVIDENCE_REQUIRED');
  }
  const reportPath = path.join(plan.runRoot, 'run.json');
  if (reportEvidence.path !== reportPath) {
    fail('PROJECT_HARNESS_RESULT_REPORT_EVIDENCE_PATH_MISMATCH');
  }
  const reportSha256 = normalizeProjectHarnessPlanDigest(
    reportEvidence.sha256,
  );
  return Object.freeze({
    contractVersion: PROJECT_HARNESS_CONTRACT_VERSION,
    kind: 'project_harness_result',
    adapterId: normalizedAdapterId,
    adapterRevision: normalizedAdapterRevision,
    runtimeRevision: normalizedRuntimeRevision,
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
    status: report.status,
    targetId: plan.targetId,
    mode: plan.mode,
    runId: plan.runId,
    planDigest: normalizedDigest,
    durationMs: report.durationMs ?? null,
    error,
    reviewRecommended: reviewDisposition.reviewRecommended,
    reasonCode: reviewDisposition.reasonCode,
    resultRefs: createResultRefs(plan.runRoot),
    evidence: Object.freeze({
      report: Object.freeze({
        path: reportPath,
        contractVersion: report.contractVersion,
        sha256: reportSha256,
      }),
    }),
  });
}

export function createProjectHarnessErrorEnvelope({
  adapterId,
  operation,
  status = 'FAIL',
  error,
}) {
  return Object.freeze({
    contractVersion: PROJECT_HARNESS_CONTRACT_VERSION,
    kind: 'project_harness_error',
    adapterId: typeof adapterId === 'string' && adapterId ? adapterId : null,
    intelligencePolicy: PROJECT_HARNESS_INTELLIGENCE_POLICY,
    operation: typeof operation === 'string' && operation ? operation : null,
    status,
    error: Object.freeze({
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
      code: typeof error?.code === 'string' ? error.code : '',
    }),
  });
}
