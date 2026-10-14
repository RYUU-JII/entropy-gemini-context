function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
}

function isCanonicalBase64Url(value, { exactLength = null, minimumLength = 1 } = {}) {
  if (
    typeof value !== 'string'
    || value.length < minimumLength
    || !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    return false;
  }
  if (exactLength !== null && value.length !== exactLength) return false;
  try {
    const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return btoa(decoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '') === value;
  } catch {
    return false;
  }
}

function requireCanonicalOctJwk(value, {
  algorithm,
  keyOperations,
  exactKeyLength = null,
  minimumKeyLength = 1,
  errorCode,
}) {
  const keys = ['alg', 'ext', 'k', 'key_ops', 'kty'];
  if (
    !hasExactKeys(value, keys)
    || value.alg !== algorithm
    || value.ext !== true
    || value.kty !== 'oct'
    || !Array.isArray(value.key_ops)
    || value.key_ops.length !== keyOperations.length
    || keyOperations.some((operation) => !value.key_ops.includes(operation))
    || !isCanonicalBase64Url(value.k, {
      exactLength: exactKeyLength,
      minimumLength: minimumKeyLength,
    })
  ) {
    throw new Error(errorCode);
  }

  return {
    key_ops: [...keyOperations],
    ext: true,
    alg: algorithm,
    kty: 'oct',
    k: value.k,
  };
}

export function requireCanonicalLogCryptoJwk(value) {
  return requireCanonicalOctJwk(value, {
    algorithm: 'A256GCM',
    keyOperations: ['encrypt', 'decrypt'],
    exactKeyLength: 43,
    errorCode: 'LOG_CRYPTO_JWK_CONTRACT_INVALID',
  });
}

export function requireCanonicalDomainHmacSecret(value) {
  if (!isCanonicalBase64Url(value, { exactLength: 43 })) {
    throw new Error('DOMAIN_HMAC_SECRET_CONTRACT_INVALID');
  }
  return value;
}

export function requireCanonicalClseHmacJwk(value) {
  return requireCanonicalOctJwk(value, {
    algorithm: 'HS256',
    keyOperations: ['sign'],
    exactKeyLength: 43,
    errorCode: 'CLSE_HMAC_JWK_CONTRACT_INVALID',
  });
}

export function requireCanonicalSecurityKeyring(value) {
  if (!hasExactKeys(value, ['version', 'logCryptoJwk', 'domainHmacSecret', 'clseHmacJwk']) || value.version !== 1) {
    throw new Error('SECURITY_VAULT_KEYRING_INVALID');
  }
  return {
    version: 1,
    logCryptoJwk: requireCanonicalLogCryptoJwk(value.logCryptoJwk),
    domainHmacSecret: requireCanonicalDomainHmacSecret(value.domainHmacSecret),
    clseHmacJwk: requireCanonicalClseHmacJwk(value.clseHmacJwk),
  };
}
