import {
  QA_RUN_STATUSES,
} from './qaTargetContract.mjs';
import { isQaArtifactAdmissionCode } from './qaArtifactAdmissionContract.mjs';

function readExplicitQaErrorCode(error) {
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  return '';
}

function readNamedQaErrorCode(error) {
  const explicit = readExplicitQaErrorCode(error);
  if (explicit) return explicit;
  const message = error instanceof Error
    ? error.message
    : String(error || '');
  const candidate = message.split(':', 1)[0];
  return /^[A-Z][A-Z0-9_]+$/u.test(candidate) ? candidate : '';
}

function readQaErrorStage(error) {
  return typeof error?.stage === 'string'
    && /^[a-z][a-z0-9_]{0,63}$/u.test(error.stage)
    ? error.stage
    : '';
}

const QA_ARTIFACT_RECOVERY_STATUSES = new Set([
  'retired_slot_preserved',
  'published_slot_active_retired_slot_preserved',
]);
const QA_TARGET_RECOVERY_STATUSES = new Set([
  'creation_not_attempted',
  'creation_token_quarantined',
  'ambiguous_creation_target_closed',
  'ambiguous_creation_event_target_already_absent',
  'response_target_quarantined',
]);
const QA_TARGET_OWNERSHIP_TOKEN_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const QA_TARGET_ID_PATTERN = /^[a-z0-9_-]{1,128}$/iu;

function serializeQaAggregateErrors(error) {
  if (!(error instanceof AggregateError) || !Array.isArray(error.errors)) return null;
  return Object.freeze(error.errors.slice(0, 4).map((nestedError) => Object.freeze({
    code: readNamedQaErrorCode(nestedError),
    stage: readQaErrorStage(nestedError),
  })));
}

function serializeQaRecoveryReceipt(error) {
  const status = error?.recovery?.status;
  if (QA_ARTIFACT_RECOVERY_STATUSES.has(status)) {
    if (error.recovery?.retiredSlotPreserved !== true) return null;
    return Object.freeze({ status, retiredSlotPreserved: true });
  }
  if (!QA_TARGET_RECOVERY_STATUSES.has(status)) return null;
  const ownershipToken = error.recovery?.ownershipToken;
  const ownerPurpose = error.recovery?.ownerPurpose;
  const browserEpoch = error.recovery?.browserEpoch;
  const targetId = error.recovery?.targetId ?? null;
  if (
    !QA_TARGET_OWNERSHIP_TOKEN_PATTERN.test(ownershipToken || '')
    || typeof ownerPurpose !== 'string'
    || !/^[a-z][a-z0-9_]{2,63}$/u.test(ownerPurpose)
    || typeof browserEpoch !== 'string'
    || !browserEpoch
    || browserEpoch !== browserEpoch.trim()
    || (targetId !== null && !QA_TARGET_ID_PATTERN.test(targetId))
  ) return null;
  return Object.freeze({
    status,
    ownershipToken,
    ownerPurpose,
    browserEpoch,
    targetId,
    exactTargetCount: Number.isSafeInteger(error.recovery?.exactTargetCount)
      ? error.recovery.exactTargetCount
      : null,
    observedTargetCount: Number.isSafeInteger(error.recovery?.observedTargetCount)
      ? error.recovery.observedTargetCount
      : null,
  });
}

export function serializeQaError(error) {
  return Object.freeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: readExplicitQaErrorCode(error),
    stage: readQaErrorStage(error),
    stack: typeof error?.stack === 'string' ? error.stack : '',
    cause: error?.cause
      ? {
        name: error.cause?.name || 'Error',
        message: error.cause?.message || String(error.cause),
        code: readNamedQaErrorCode(error.cause),
        stage: readQaErrorStage(error.cause),
      }
      : null,
    errors: serializeQaAggregateErrors(error),
    recovery: serializeQaRecoveryReceipt(error),
    startupEvidence: serializeQaBrowserStartupEvidence(error?.startupEvidence),
  });
}

function serializeQaBrowserStartupEvidence(evidence) {
  if (!evidence || !['saved', 'write_failed'].includes(evidence.status)) return null;
  if (evidence.status === 'saved' && !/^\.artifacts\/qa\/browser-startup\/[a-f0-9-]{36}\.json$/u.test(evidence.relativePath)) return null;
  const summary = {};
  for (const key of ['stage', 'cdpStatus', 'cdpErrorCode', 'signalCode', 'rollback', 'leaseRelease']) {
    const value = evidence.summary?.[key];
    if (value !== null && (typeof value !== 'string' || !/^[a-zA-Z0-9_]{1,80}$/u.test(value))) return null;
    summary[key] = value;
  }
  for (const key of ['elapsedMs', 'timeoutMs', 'pollCount', 'pid', 'exitCode']) {
    const value = evidence.summary?.[key];
    if (value !== null && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) return null;
    summary[key] = value;
  }
  return Object.freeze({
    status: evidence.status,
    relativePath: evidence.status === 'saved' ? evidence.relativePath : null,
    summary: Object.freeze(summary),
  });
}

const BLOCKED_CODES = new Set([
  'QA_EVIDENCE_BUDGET_EXCEEDED',
  'QA_RESOURCE_BUSY', 'QA_BROWSER_BROKER_BUSY', 'QA_BROWSER_CAPACITY_BUSY',
  'QA_ARTIFACT_ADMISSION_TIMEOUT',
  'QA_CDP_UNAVAILABLE', 'CDP_UNAVAILABLE', 'AUTH_REQUIRED',
  'QA_DISPLAY_FOREGROUND_HOST_REQUIRED', 'QA_DISPLAY_XVFB_UNAVAILABLE',
  'QA_DISPLAY_PHYSICAL_GPU_VIRTUAL_DISPLAY_FORBIDDEN', 'QA_BROWSER_PHYSICAL_GPU_REQUIRED',
  'QA_BROWSER_OS_FOCUS_ENVIRONMENT_FORBIDDEN', 'QA_BROWSER_OS_FOCUS_BASELINE_FOREGROUND',
  'QA_ATTACH_ONLY_NO_FOCUS_BASELINE_PAGE_REQUIRED',
  'QA_LOCAL_CONFIG_UNAVAILABLE', 'QA_TARGET_ENVIRONMENT_UNAVAILABLE',
  'QA_BROWSER_ENVIRONMENT_BLOCKED', 'CHROMIUM_EXECUTABLE_NOT_FOUND',
  'QA_AUDIO_DULLING_BROWSER_MUTED', 'QA_AUDIO_DULLING_NATIVE_FOCUS_PERMISSION_REQUIRED',
  'CHROMIUM_HARNESS_MANAGED_EXTENSION_LOAD_BLOCKED',
  'ENTROPY_QA_ARTIFACT_RECEIPT_INVALID', 'ENTROPY_QA_ARTIFACT_ACTIVATION_RECEIPT_INVALID',
  'ENTROPY_QA_ARTIFACT_SLOT_PUBLISH_FAILED', 'ENTROPY_QA_ARTIFACT_SLOT_ROLLBACK_FAILED',
  'ENTROPY_QA_ARTIFACT_SLOT_TRANSACTION_RECOVERY_FAILED',
  'ENTROPY_QA_ARTIFACT_SLOT_RETIRED_CLEANUP_FAILED',
  'BROWSER_QA_MANAGED_INSTALLATION_UNAVAILABLE', 'BROWSER_QA_MANAGED_PROFILE_UNAVAILABLE',
  'BROWSER_QA_CDP_ENDPOINT_OCCUPIED_INVALID', 'BROWSER_QA_CDP_ENDPOINT_IDENTITY_UNVERIFIED',
  'BROWSER_QA_MANAGED_BROWSER_ALREADY_RUNNING', 'BROWSER_QA_MANAGED_PROCESS_ALREADY_PRESENT',
  'BROWSER_QA_MANAGED_PROCESS_SLOT_INSPECTION_BLOCKED',
  'BROWSER_QA_MANAGED_PROCESS_SLOT_NOT_AVAILABLE',
]);
const BLOCKED_CODE_FAMILIES = [
  'QA_CDP_PAGE_TARGET_CREATE_', 'QA_CDP_PAGE_TARGET_CREATION_',
  'QA_ATTACHED_BROWSER_', 'BROWSER_QA_DEDICATED_PROFILE_OWNERSHIP_',
];
const INCONCLUSIVE_CODES = new Set([
  'QA_ATTACH_EXECUTION_UNAVAILABLE', 'QA_RUN_ABORTED', 'BROWSER_QA_LIFECYCLE_ABORTED',
  'BROWSER_QA_MANAGED_BROWSER_START_UNCONFIRMED', 'INCONCLUSIVE',
]);

export function classifyQaErrorStatus(error) {
  // Multiple failures cannot certify safe admission rollback. Classify only the
  // root error identity: nested causes and message details never grant BLOCKED.
  if (error instanceof AggregateError) return QA_RUN_STATUSES.FAIL;
  const code = readNamedQaErrorCode(error);
  if (isQaArtifactAdmissionCode(code) || BLOCKED_CODES.has(code)
    || BLOCKED_CODE_FAMILIES.some((prefix) => code.startsWith(prefix))) {
    return QA_RUN_STATUSES.BLOCKED;
  }
  if (INCONCLUSIVE_CODES.has(code) || code.startsWith('INCONCLUSIVE_')) {
    return QA_RUN_STATUSES.INCONCLUSIVE;
  }
  return QA_RUN_STATUSES.FAIL;
}
