import { requireCanonicalClseHmacJwk, requireCanonicalDomainHmacSecret,
  requireCanonicalLogCryptoJwk, requireCanonicalSecurityKeyring } from './keyMaterialContract.js';
import {
  decodeBase64Url, requireEncryptedEnvelope, requireExactKeys, securityError,
  LOG_KEY_ENVELOPE_FORMAT, LOG_KEY_VAULT_FORMAT, SECURITY_VAULT_FORMAT, VAULT_WRAPPED_KEY_MAX_BYTES,
} from '../../security/vaultCryptography.js';

export const LOCAL_SECURITY_KEYRING_FORMAT = 'entropy-local-keyring';

export function requireProtectionKeys(value) {
  requireExactKeys(value, ['version', 'domainHmacSecret', 'clseHmacJwk'], 'SECURITY_PROTECTION_KEYS_INVALID');
  if (value.version !== 1) throw securityError('SECURITY_PROTECTION_KEYS_VERSION_UNSUPPORTED');
  return { version: 1, domainHmacSecret: requireCanonicalDomainHmacSecret(value.domainHmacSecret),
    clseHmacJwk: requireCanonicalClseHmacJwk(value.clseHmacJwk) };
}

export function requireLogKeyPayload(value) {
  requireExactKeys(value, ['version', 'logCryptoJwk'], 'SECURITY_LOG_KEY_PAYLOAD_INVALID');
  if (value.version !== 1) throw securityError('SECURITY_LOG_KEY_PAYLOAD_VERSION_UNSUPPORTED');
  return { version: 1, logCryptoJwk: requireCanonicalLogCryptoJwk(value.logCryptoJwk) };
}

// All variants are current formats under one typed storage owner. Presence of
// an invalid or retired record never authorizes generating replacement keys.
export function requireSecurityKeyRecord(record) {
  if (record?.format === LOCAL_SECURITY_KEYRING_FORMAT) {
    requireExactKeys(record, ['format', 'version', 'id', 'keyring'], 'SECURITY_LOCAL_KEYRING_INVALID');
    if (record.version !== 1) throw securityError('SECURITY_LOCAL_KEYRING_VERSION_UNSUPPORTED');
    decodeBase64Url(record.id, { exactBytes: 16 });
    return { format: record.format, version: 1, id: record.id,
      keyring: requireCanonicalSecurityKeyring(record.keyring) };
  }
  if (record?.format === LOG_KEY_VAULT_FORMAT) {
    requireExactKeys(record, ['format', 'version', 'id', 'protectionKeys', 'envelope'], 'SECURITY_LOG_KEY_VAULT_INVALID');
    if (record.version !== 1) throw securityError('SECURITY_LOG_KEY_VAULT_VERSION_UNSUPPORTED');
    decodeBase64Url(record.id, { exactBytes: 16 });
    const protectionKeys = requireProtectionKeys(record.protectionKeys);
    const envelope = requireEncryptedEnvelope(record.envelope, {
      format: LOG_KEY_ENVELOPE_FORMAT, maxBytes: VAULT_WRAPPED_KEY_MAX_BYTES,
    });
    if (envelope.id !== record.id) throw securityError('SECURITY_LOG_KEY_VAULT_ID_MISMATCH');
    return { format: record.format, version: 1, id: record.id, protectionKeys, envelope };
  }
  return requireEncryptedEnvelope(record, {
    format: SECURITY_VAULT_FORMAT, maxBytes: VAULT_WRAPPED_KEY_MAX_BYTES,
  });
}
