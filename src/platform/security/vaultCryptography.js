import { requireCanonicalClseHmacJwk, requireCanonicalDomainHmacSecret } from '../storage/security/keyMaterialContract.js';

// Fixed, bounded formats for local key wrapping and encrypted backups.
export const VAULT_KDF_ITERATIONS = 600_000;
export const SECURITY_VAULT_FORMAT = 'entropy-security-vault';
export const LOG_KEY_VAULT_FORMAT = 'entropy-log-key-vault';
export const LOG_KEY_ENVELOPE_FORMAT = 'entropy-log-key-envelope';
export const VAULT_MIN_PASSPHRASE_CHARACTERS = 16;
export const VAULT_MAX_PASSPHRASE_BYTES = 128;
export const VAULT_WRAPPED_KEY_MAX_BYTES = 16 * 1024;
// Base64 plus the fixed envelope must fit Chrome's 64 MiB JSON message limit.
export const ENCRYPTED_BACKUP_MAX_BYTES = 32 * 1024 * 1024;
export const ENCRYPTED_BACKUP_MAX_FILE_BYTES = Math.ceil((ENCRYPTED_BACKUP_MAX_BYTES + 16) * 4 / 3) + 2048;

export function securityError(code, cause) {
  const error = new Error(code);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

export function requireExactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw securityError(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw securityError(code);
  }
  return value;
}

export function requireStrongPassphrase(value) {
  if (typeof value !== 'string') throw securityError('SECURITY_PASSPHRASE_INVALID');
  const length = [...value].length;
  const bytes = new TextEncoder().encode(value);
  if (new TextDecoder().decode(bytes) !== value) {
    bytes.fill(0);
    throw securityError('SECURITY_PASSPHRASE_INVALID');
  }
  if (length < VAULT_MIN_PASSPHRASE_CHARACTERS || bytes.length > VAULT_MAX_PASSPHRASE_BYTES
    || new Set([...value]).size === 1) {
    bytes.fill(0);
    throw securityError('SECURITY_PASSPHRASE_WEAK');
  }
  return bytes;
}

export function encodeBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function decodeBase64Url(value, { exactBytes = null, maxBytes, minBytes = 1 } = {}) {
  const bound = exactBytes ?? maxBytes;
  if (typeof value !== 'string' || !Number.isSafeInteger(bound)
    || value.length > Math.ceil(bound * 4 / 3) || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw securityError('SECURITY_ENVELOPE_ENCODING_INVALID');
  }
  let bytes;
  try {
    bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0));
  } catch (cause) {
    throw securityError('SECURITY_ENVELOPE_ENCODING_INVALID', cause);
  }
  if (bytes.length < minBytes || bytes.length > bound
    || (exactBytes !== null && bytes.length !== exactBytes) || encodeBase64Url(bytes) !== value) {
    throw securityError('SECURITY_ENVELOPE_ENCODING_INVALID');
  }
  return bytes;
}

function headerFor(envelope) {
  return {
    format: envelope.format,
    version: envelope.version,
    id: envelope.id,
    cipher: envelope.cipher,
    kdf: { name: envelope.kdf.name, hash: envelope.kdf.hash, iterations: envelope.kdf.iterations },
    salt: envelope.salt,
    iv: envelope.iv,
  };
}

function envelopeAdditionalData(envelope, authenticatedContext) {
  const header = headerFor(envelope);
  if (envelope.format !== LOG_KEY_ENVELOPE_FORMAT) {
    if (authenticatedContext !== undefined) throw securityError('SECURITY_ENVELOPE_CONTEXT_FORBIDDEN');
    return new TextEncoder().encode(JSON.stringify(header));
  }
  requireExactKeys(authenticatedContext, ['format', 'version', 'id', 'protectionKeys'], 'SECURITY_LOG_KEY_CONTEXT_INVALID');
  requireExactKeys(authenticatedContext.protectionKeys, ['version', 'domainHmacSecret', 'clseHmacJwk'], 'SECURITY_LOG_KEY_CONTEXT_INVALID');
  if (authenticatedContext.format !== LOG_KEY_VAULT_FORMAT || authenticatedContext.version !== 1
    || authenticatedContext.id !== envelope.id || authenticatedContext.protectionKeys.version !== 1) {
    throw securityError('SECURITY_LOG_KEY_CONTEXT_INVALID');
  }
  const context = { format: LOG_KEY_VAULT_FORMAT, version: 1, id: authenticatedContext.id,
    protectionKeys: { version: 1,
      domainHmacSecret: requireCanonicalDomainHmacSecret(authenticatedContext.protectionKeys.domainHmacSecret),
      clseHmacJwk: requireCanonicalClseHmacJwk(authenticatedContext.protectionKeys.clseHmacJwk) } };
  return new TextEncoder().encode(JSON.stringify({ header, authenticatedContext: context }));
}

export function requireEncryptedEnvelope(envelope, { format, maxBytes }) {
  requireExactKeys(envelope, ['format', 'version', 'id', 'cipher', 'kdf', 'salt', 'iv', 'ciphertext'], 'SECURITY_ENVELOPE_INVALID');
  requireExactKeys(envelope.kdf, ['name', 'hash', 'iterations'], 'SECURITY_ENVELOPE_KDF_INVALID');
  if (envelope.format !== format || envelope.version !== 1 || envelope.cipher !== 'AES-256-GCM'
    || envelope.kdf.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256'
    || envelope.kdf.iterations !== VAULT_KDF_ITERATIONS) {
    throw securityError('SECURITY_ENVELOPE_VERSION_UNSUPPORTED');
  }
  decodeBase64Url(envelope.id, { exactBytes: 16 });
  decodeBase64Url(envelope.salt, { exactBytes: 16 });
  decodeBase64Url(envelope.iv, { exactBytes: 12 });
  decodeBase64Url(envelope.ciphertext, { maxBytes: maxBytes + 16, minBytes: 17 });
  return envelope;
}

async function deriveWrappingKey(passphrase, salt) {
  const bytes = requireStrongPassphrase(passphrase);
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: VAULT_KDF_ITERATIONS, salt },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally {
    bytes.fill(0);
  }
}

export async function encryptSecurityEnvelope(value, passphrase, { format, maxBytes, id = null, authenticatedContext }) {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  try {
    if (plaintext.length > maxBytes) throw securityError('SECURITY_ENVELOPE_SIZE_LIMIT');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const envelope = {
      format, version: 1, id: id ?? encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
      cipher: 'AES-256-GCM',
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: VAULT_KDF_ITERATIONS },
      salt: encodeBase64Url(salt), iv: encodeBase64Url(iv),
    };
    const additionalData = envelopeAdditionalData(envelope, authenticatedContext);
    const key = await deriveWrappingKey(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData, tagLength: 128 }, key, plaintext);
    return { ...envelope, ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) };
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptSecurityEnvelope(value, passphrase, options) {
  const envelope = requireEncryptedEnvelope(value, options);
  const additionalData = envelopeAdditionalData(envelope, options.authenticatedContext);
  const key = await deriveWrappingKey(passphrase, decodeBase64Url(envelope.salt, { exactBytes: 16 }));
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM',
      iv: decodeBase64Url(envelope.iv, { exactBytes: 12 }),
      additionalData, tagLength: 128 }, key,
    decodeBase64Url(envelope.ciphertext, { maxBytes: options.maxBytes + 16, minBytes: 17 })));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
  } catch (cause) {
    throw securityError('SECURITY_ENVELOPE_AUTHENTICATION_FAILED', cause);
  } finally {
    plaintext?.fill(0);
  }
}
