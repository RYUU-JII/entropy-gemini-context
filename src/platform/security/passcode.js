const PASSCODE_HASH_VERSION = 'v1';
const PASSCODE_KDF_ALGO = 'pbkdf2-sha256';
const PASSCODE_KDF_ITERATIONS = 210_000;
const PASSCODE_KDF_SALT_BYTES = 16;
const PASSCODE_KDF_KEY_BYTES = 32;
const PASSCODE_HASH_PARTS = 5;

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '==='.slice((normalized.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto() {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    return crypto.subtle;
  }
  throw new Error('Web Crypto API unavailable');
}

function getRandomBytes(length) {
  if (typeof crypto !== 'undefined' && typeof crypto?.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint8Array(length));
  }
  throw new Error('Secure random generator unavailable');
}

function timingSafeEqualBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left[i] ^ right[i];
  }
  return mismatch === 0;
}

function parseVersionedHash(value) {
  const hash = typeof value === 'string' ? value.trim() : '';
  if (!hash) return null;

  const parts = hash.split('$');
  if (parts.length !== PASSCODE_HASH_PARTS) return null;

  const [version, algorithm, rawIterations, rawSalt, rawDigest] = parts;
  if (version !== PASSCODE_HASH_VERSION || algorithm !== PASSCODE_KDF_ALGO) return null;

  // V1 has one fixed work factor. Treat imported/stored parameters as data,
  // never as instructions to weaken the KDF or run unbounded work.
  if (rawIterations !== String(PASSCODE_KDF_ITERATIONS)) return null;
  const iterations = PASSCODE_KDF_ITERATIONS;
  if (!/^[A-Za-z0-9_-]{22}$/u.test(rawSalt)
    || !/^[A-Za-z0-9_-]{43}$/u.test(rawDigest)) return null;

  let salt;
  let digest;
  try {
    salt = fromBase64Url(rawSalt);
    digest = fromBase64Url(rawDigest);
  } catch {
    return null;
  }

  if (!(salt instanceof Uint8Array) || salt.length !== PASSCODE_KDF_SALT_BYTES) return null;
  if (!(digest instanceof Uint8Array) || digest.length !== PASSCODE_KDF_KEY_BYTES) return null;
  if (toBase64Url(salt) !== rawSalt || toBase64Url(digest) !== rawDigest) return null;

  return { iterations, salt, digest };
}

async function derivePbkdf2Bytes(normalizedPasscode, salt, iterations, keyBytes = PASSCODE_KDF_KEY_BYTES) {
  const subtle = getSubtleCrypto();
  const passcodeBytes = new TextEncoder().encode(normalizedPasscode);
  const keyMaterial = await subtle.importKey('raw', passcodeBytes, 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    keyMaterial,
    keyBytes * 8,
  );
  return new Uint8Array(derivedBits);
}

function resolveHashFlavor(expectedHash) {
  const target = String(expectedHash || '').trim();
  if (!target) return 'none';
  if (parseVersionedHash(target)) return 'pbkdf2_v1';
  return 'unknown';
}

function createPasscodeHashError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function verifyVersionedHash(normalizedPasscode, expectedHash) {
  const parsed = parseVersionedHash(expectedHash);
  if (!parsed) return false;
  const candidate = await derivePbkdf2Bytes(normalizedPasscode, parsed.salt, parsed.iterations, parsed.digest.length);
  return timingSafeEqualBytes(candidate, parsed.digest);
}

export function normalizePasscode(value) {
  return String(value || '').trim();
}

export function isPasscodeValid(value) {
  const normalized = normalizePasscode(value);
  return normalized.length >= 4 && normalized.length <= 64;
}

export function isCanonicalPasscodeHash(value) {
  return typeof value === 'string' && value.trim() === value && parseVersionedHash(value) !== null;
}

export async function hashPasscode(value) {
  const normalized = normalizePasscode(value);
  if (!normalized) return '';

  const salt = getRandomBytes(PASSCODE_KDF_SALT_BYTES);
  const digest = await derivePbkdf2Bytes(normalized, salt, PASSCODE_KDF_ITERATIONS);
  return [
    PASSCODE_HASH_VERSION,
    PASSCODE_KDF_ALGO,
    String(PASSCODE_KDF_ITERATIONS),
    toBase64Url(salt),
    toBase64Url(digest),
  ].join('$');
}

export async function verifyPasscode(passcode, expectedHash) {
  const target = String(expectedHash || '').trim();
  if (!target) {
    return false;
  }
  if (resolveHashFlavor(target) !== 'pbkdf2_v1') {
    return false;
  }
  const normalized = normalizePasscode(passcode);
  if (!normalized) {
    return false;
  }
  return verifyVersionedHash(normalized, target);
}

export async function verifyPasscodeStrict(passcode, expectedHash) {
  const target = String(expectedHash || '').trim();
  if (!target) {
    return false;
  }
  if (resolveHashFlavor(target) !== 'pbkdf2_v1') {
    throw createPasscodeHashError('PASSCODE_HASH_INVALID');
  }
  const normalized = normalizePasscode(passcode);
  if (!normalized) {
    return false;
  }
  return verifyVersionedHash(normalized, target);
}
