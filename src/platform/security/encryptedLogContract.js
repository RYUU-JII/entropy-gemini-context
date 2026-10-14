export const ENCRYPTED_LOG_VERSION = 2;
export const ENCRYPTED_LOG_MAX_BYTES = 1024 * 1024;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function encryptedLogAdditionalData(timestamp) {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0) {
    fail('CRYPTO_LOG_TIMESTAMP_INVALID');
  }
  return new TextEncoder().encode(JSON.stringify(['entropy-event-log', ENCRYPTED_LOG_VERSION, timestamp]));
}

export function requireEncryptedLogRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)
    || record.version !== ENCRYPTED_LOG_VERSION) fail('CRYPTO_LOG_VERSION_UNSUPPORTED');
  const fields = Object.keys(record);
  const required = ['version', 'timestamp', 'iv', 'data'];
  if (required.some((field) => !Object.hasOwn(record, field))
    || fields.some((field) => ![...required, 'id'].includes(field))) fail('CRYPTO_DECRYPT_RECORD_INVALID');
  encryptedLogAdditionalData(record.timestamp);
  if (!Array.isArray(record.iv) || record.iv.length !== 12
    || !Array.isArray(record.data) || record.data.length < 17 || record.data.length > ENCRYPTED_LOG_MAX_BYTES + 16
    || [...record.iv, ...record.data].some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    fail('CRYPTO_DECRYPT_RECORD_INVALID');
  }
  return record;
}

export async function encryptLogRecord(key, value) {
  const timestamp = typeof value?.timestamp === 'number' && Number.isFinite(value.timestamp)
    ? value.timestamp : Date.now();
  const additionalData = encryptedLogAdditionalData(timestamp);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  try {
    if (plaintext.length > ENCRYPTED_LOG_MAX_BYTES) fail('CRYPTO_LOG_SIZE_LIMIT');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData, tagLength: 128 }, key, plaintext);
    return { version: ENCRYPTED_LOG_VERSION, timestamp, iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptLogRecord(key, value) {
  const record = requireEncryptedLogRecord(value);
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(record.iv),
      additionalData: encryptedLogAdditionalData(record.timestamp), tagLength: 128 }, key, new Uint8Array(record.data)));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } catch (cause) {
    const error = new Error('CRYPTO_DECRYPT_RECORD_FAILED');
    error.code = 'CRYPTO_DECRYPT_RECORD_FAILED';
    error.cause = cause;
    throw error;
  } finally {
    plaintext?.fill(0);
  }
}
