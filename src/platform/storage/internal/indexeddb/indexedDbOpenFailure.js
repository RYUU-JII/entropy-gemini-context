import {
  DB_NAME,
  DB_VERSION,
} from './dbConstants.js';

export const INDEXED_DB_RELEASE_V1_RESET_REQUIRED = 'INDEXED_DB_RELEASE_V1_RESET_REQUIRED';

const INDEXED_DB_V1_SCHEMA_MISMATCH_PATTERNS = Object.freeze([
  /^INDEXED_DB_VERSION_MISMATCH$/,
  /^INDEXED_DB_V1_STORE_SET_MISMATCH$/,
  /^INDEXED_DB_V1_STORE_CONTRACT_MISMATCH:[^:]+$/,
  /^INDEXED_DB_V1_INDEX_SET_MISMATCH:[^:]+$/,
  /^INDEXED_DB_V1_INDEX_CONTRACT_MISMATCH:[^:]+:[^:]+$/,
]);

const RESET_FAILURE_DETAIL_KEYS = Object.freeze([
  'actual',
  'expected',
  'storeName',
  'indexName',
]);

function readResetRequiredReason(error) {
  if (error?.name === 'VersionError') return 'VersionError';
  const code = typeof error?.code === 'string' ? error.code : '';
  return INDEXED_DB_V1_SCHEMA_MISMATCH_PATTERNS.some((pattern) => pattern.test(code))
    ? code
    : null;
}

function formatDiagnosticValue(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function buildIndexedDbOpenFailure(error) {
  if (isIndexedDbReleaseV1ResetRequired(error)) return error;

  const reason = readResetRequiredReason(error);
  if (!reason) {
    return error instanceof Error
      ? error
      : new Error('INDEXED_DB_OPEN_FAILED');
  }

  const diagnosticParts = [
    INDEXED_DB_RELEASE_V1_RESET_REQUIRED,
    `db=${DB_NAME}`,
    `requestedVersion=${DB_VERSION}`,
    `reason=${reason}`,
  ];
  RESET_FAILURE_DETAIL_KEYS.forEach((key) => {
    if (error?.[key] === undefined) return;
    diagnosticParts.push(`${key}=${formatDiagnosticValue(error[key])}`);
  });

  const failure = new Error(diagnosticParts.join(':'), { cause: error });
  failure.name = 'IndexedDbReleaseV1ResetRequiredError';
  failure.code = INDEXED_DB_RELEASE_V1_RESET_REQUIRED;
  failure.reason = reason;
  failure.dbName = DB_NAME;
  failure.requestedVersion = DB_VERSION;
  RESET_FAILURE_DETAIL_KEYS.forEach((key) => {
    if (error?.[key] !== undefined) failure[key] = error[key];
  });
  return failure;
}

export function isIndexedDbReleaseV1ResetRequired(error) {
  return error?.code === INDEXED_DB_RELEASE_V1_RESET_REQUIRED;
}
