import KeyStore from '../internal/chrome-storage/stores/KeyStore.js';
import SecurityVaultSessionStore from '../internal/chrome-storage/session/SecurityVaultSessionStore.js';
import { KEY_MATERIAL_FIELDS } from '../internal/chrome-storage/storageKeyRegistry.js';
import { initializeTrustedLocalStorageAccess, initializeTrustedSessionStorageAccess } from './StorageTrustCapability.js';
import { requireCanonicalSecurityKeyring } from './keyMaterialContract.js';
import { requireSecurityVaultStatus } from '../../security/securityVaultStatusContract.js';
import { LOCAL_SECURITY_KEYRING_FORMAT, requireLogKeyPayload, requireProtectionKeys,
  requireSecurityKeyRecord } from './securityKeyRecordContract.js';
import {
  decodeBase64Url, decryptSecurityEnvelope, encodeBase64Url, encryptSecurityEnvelope,
  requireExactKeys, securityError, VAULT_WRAPPED_KEY_MAX_BYTES,
  LOG_KEY_ENVELOPE_FORMAT, LOG_KEY_VAULT_FORMAT, SECURITY_VAULT_FORMAT,
} from '../../security/vaultCryptography.js';

export { STORAGE_LOCAL_KEY_KEYS, KEY_MATERIAL_FIELDS } from '../internal/chrome-storage/storageKeyRegistry.js';
export { SECURITY_VAULT_FORMAT } from '../../security/vaultCryptography.js';
const VAULT_OPTIONS = Object.freeze({ format: SECURITY_VAULT_FORMAT, maxBytes: VAULT_WRAPPED_KEY_MAX_BYTES });

function protectionKeysFor(keyring) {
  return requireProtectionKeys({ version: 1, domainHmacSecret: keyring.domainHmacSecret,
    clseHmacJwk: keyring.clseHmacJwk });
}

function logVaultContext(record) {
  return { format: LOG_KEY_VAULT_FORMAT, version: 1, id: record.id,
    protectionKeys: requireProtectionKeys(record.protectionKeys) };
}

function wrappingOptions(record) {
  return record.format === LOG_KEY_VAULT_FORMAT
    ? { format: LOG_KEY_ENVELOPE_FORMAT, maxBytes: VAULT_WRAPPED_KEY_MAX_BYTES,
      id: record.id, authenticatedContext: logVaultContext(record) } : VAULT_OPTIONS;
}

async function envelopeDigest(record) {
  const envelope = record.format === LOG_KEY_VAULT_FORMAT ? record.envelope : record;
  const fields = [
    envelope.format, envelope.version, envelope.id, envelope.cipher,
    envelope.kdf.name, envelope.kdf.hash, envelope.kdf.iterations,
    envelope.salt, envelope.iv, envelope.ciphertext,
  ];
  if (record.format === LOG_KEY_VAULT_FORMAT) fields.push(logVaultContext(record));
  const encoded = new TextEncoder().encode(JSON.stringify(fields));
  return encodeBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)));
}

async function logKeyRecord(keyring, passphrase, id = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))) {
  const record = { format: LOG_KEY_VAULT_FORMAT, version: 1, id, protectionKeys: protectionKeysFor(keyring) };
  const envelope = await encryptSecurityEnvelope(requireLogKeyPayload({ version: 1, logCryptoJwk: keyring.logCryptoJwk }),
    passphrase, wrappingOptions(record));
  return requireSecurityKeyRecord({ ...record, envelope });
}

async function unwrapKeyring(record, passphrase) {
  const value = await decryptSecurityEnvelope(record.format === LOG_KEY_VAULT_FORMAT ? record.envelope : record,
    passphrase, wrappingOptions(record));
  return record.format === LOG_KEY_VAULT_FORMAT
    ? requireCanonicalSecurityKeyring({ ...record.protectionKeys, ...requireLogKeyPayload(value) })
    : requireCanonicalSecurityKeyring(value);
}

function vaultStatus(state, mode, lockScope, protectionReady, reason) {
  return requireSecurityVaultStatus({ state, version: 1, mode, lockScope, protectionReady, ...(reason ? { reason } : {}) });
}

function newKeyring() {
  const randomKey = () => encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return requireCanonicalSecurityKeyring({
    version: 1,
    logCryptoJwk: { alg: 'A256GCM', ext: true, k: randomKey(), key_ops: ['encrypt', 'decrypt'], kty: 'oct' },
    domainHmacSecret: randomKey(),
    clseHmacJwk: { alg: 'HS256', ext: true, k: randomKey(), key_ops: ['sign'], kty: 'oct' },
  });
}

function localKeyRecord(keyring, id = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))) {
  return requireSecurityKeyRecord({ format: LOCAL_SECURITY_KEYRING_FORMAT, version: 1, id, keyring });
}

export class KeyMaterialRepository {
  static getInstance() {
    if (!KeyMaterialRepository.instance) KeyMaterialRepository.instance = new KeyMaterialRepository();
    return KeyMaterialRepository.instance;
  }

  constructor({ keyStore = KeyStore.getInstance(), sessionStore = new SecurityVaultSessionStore(),
    initializeStorageTrust = async () => {
      await initializeTrustedLocalStorageAccess();
      await initializeTrustedSessionStorageAccess();
    } } = {}) {
    this.keyStore = keyStore;
    this.sessionStore = sessionStore;
    this.initializeStorageTrust = initializeStorageTrust;
    this.mutationTail = Promise.resolve();
    this.lockListeners = new Set();
    this.protectionKeyListeners = new Set();
    this.sessionAdmissionFailure = null;
  }

  onLock(listener) {
    if (typeof listener !== 'function') throw securityError('SECURITY_VAULT_LISTENER_INVALID');
    this.lockListeners.add(listener);
    return () => this.lockListeners.delete(listener);
  }

  invalidateKeyCaches() {
    this.invalidateLogKeyCaches();
    for (const listener of this.protectionKeyListeners) listener();
  }

  onProtectionKeysInvalidated(listener) {
    if (typeof listener !== 'function') throw securityError('SECURITY_VAULT_LISTENER_INVALID');
    this.protectionKeyListeners.add(listener);
    return () => this.protectionKeyListeners.delete(listener);
  }

  invalidateLogKeyCaches() {
    for (const listener of this.lockListeners) listener();
  }

  invalidateLockedCaches(state) {
    if (state.status.lockScope === 'logs') this.invalidateLogKeyCaches();
    else this.invalidateKeyCaches();
  }

  enqueueMutation(operation) {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.catch(() => undefined);
    return result;
  }

  async readState() {
    // Concurrent readers stay parallel, but each must observe one completed
    // owner mutation. A read overlapping a new mutation retries its snapshot.
    for (;;) {
      const barrier = this.mutationTail;
      await barrier;
      let state;
      try {
        state = await this.#readState();
      } catch (error) {
        if (barrier === this.mutationTail) throw error;
        continue;
      }
      if (barrier === this.mutationTail) return state;
    }
  }

  async #readState() {
    await this.initializeStorageTrust();
    const persistent = await this.keyStore.readVaultState();
    if (persistent.retiredKeysPresent.length) {
      return { status: vaultStatus('incompatible', null, null, false, 'SECURITY_VAULT_PLAINTEXT_PROFILE_UNSUPPORTED') };
    }
    if (!persistent.present) return { status: vaultStatus('setup_required', null, null, false) };
    let envelope;
    try {
      envelope = requireSecurityKeyRecord(persistent.envelope);
    } catch {
      return { status: vaultStatus('incompatible', null, null, false, 'SECURITY_VAULT_ENVELOPE_INVALID') };
    }
    if (envelope.format === LOCAL_SECURITY_KEYRING_FORMAT) {
      return { record: envelope, keyring: envelope.keyring,
        status: vaultStatus('unlocked', 'local', null, true) };
    }
    const modern = envelope.format === LOG_KEY_VAULT_FORMAT;
    const locked = (reason) => ({ envelope,
      ...(modern ? { protectionKeys: envelope.protectionKeys } : {}),
      status: vaultStatus('locked', 'passphrase', modern ? 'logs' : 'profile', modern, reason) });
    if (this.sessionAdmissionFailure) {
      return locked(this.sessionAdmissionFailure);
    }
    const session = await this.sessionStore.get();
    if (session === null) return locked();
    try {
      requireExactKeys(session, ['vaultId', 'envelopeDigest', 'keyring'], 'SECURITY_VAULT_SESSION_INVALID');
      decodeBase64Url(session.envelopeDigest, { exactBytes: 32 });
      const keyring = requireCanonicalSecurityKeyring(session.keyring);
      if (session.vaultId !== envelope.id || session.envelopeDigest !== await envelopeDigest(envelope)
        || (modern && JSON.stringify(protectionKeysFor(keyring)) !== JSON.stringify(envelope.protectionKeys))) {
        return locked('SECURITY_VAULT_SESSION_MISMATCH');
      }
      return { envelope, keyring, status: vaultStatus('unlocked', 'passphrase', modern ? 'logs' : 'profile', true) };
    } catch {
      return locked('SECURITY_VAULT_SESSION_INVALID');
    }
  }

  async getVaultStatus() {
    return (await this.readState()).status;
  }

  // Explicit pre-init owner. Only genuine absence creates keys, and callers
  // must hold profile-mutation admission. Status/key reads never create keys.
  ensureLocalVault() {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (state.status.state !== 'setup_required') return state.status;
      await this.keyStore.writeVault(localKeyRecord(newKeyring()));
      const prepared = await this.#readState();
      if (prepared.status.state !== 'unlocked' || prepared.status.mode !== 'local') {
        throw securityError('SECURITY_LOCAL_KEYRING_COMMIT_FAILED');
      }
      return prepared.status;
    });
  }

  async requireUnlocked() {
    const state = await this.readState();
    if (state.status.state !== 'unlocked') {
      this.invalidateLockedCaches(state);
      throw securityError(state.status.reason ?? `SECURITY_VAULT_${state.status.state.toUpperCase()}`);
    }
    return state.keyring;
  }

  async requireProtectionKeys() {
    const state = await this.readState();
    if (!state.status.protectionReady) {
      this.invalidateKeyCaches();
      throw securityError(state.status.reason ?? `SECURITY_VAULT_${state.status.state.toUpperCase()}`);
    }
    return state.status.lockScope === 'logs' ? state.envelope.protectionKeys : protectionKeysFor(state.keyring);
  }

  async #installSession(envelope, keyring, { invalidate = true } = {}) {
    if (invalidate) {
      if (envelope.format === LOG_KEY_VAULT_FORMAT) this.invalidateLogKeyCaches();
      else this.invalidateKeyCaches();
    }
    await this.sessionStore.set({ vaultId: envelope.id, envelopeDigest: await envelopeDigest(envelope), keyring });
    const previousAdmissionFailure = this.sessionAdmissionFailure;
    this.sessionAdmissionFailure = null;
    try {
      const status = (await this.#readState()).status;
      if (status.state !== 'unlocked') throw securityError('SECURITY_VAULT_SESSION_COMMIT_FAILED');
      return status;
    } catch (error) {
      this.sessionAdmissionFailure = previousAdmissionFailure;
      throw error;
    }
  }

  setupVault({ passphrase } = {}) {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (state.status.state !== 'setup_required' && state.status.mode !== 'local') {
        throw securityError('SECURITY_VAULT_SETUP_FORBIDDEN');
      }
      const keyring = state.status.mode === 'local' ? state.keyring : newKeyring();
      const envelope = await logKeyRecord(keyring, passphrase, state.record?.id);
      await this.keyStore.writeVault(envelope);
      // Enabling a password rewraps existing data keys without interrupting
      // admitted consumers. A failed session commit must still close admission.
      return this.#commitWrappedSession(envelope, keyring);
    });
  }

  unlockVault({ passphrase } = {}) {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (!state.envelope) throw securityError(state.status.reason ?? 'SECURITY_VAULT_SETUP_REQUIRED');
      const keyring = await unwrapKeyring(state.envelope, passphrase);
      return this.#installSession(state.envelope, keyring);
    });
  }

  lockVault() {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      this.invalidateLockedCaches(state);
      await this.sessionStore.clear();
      this.sessionAdmissionFailure = null;
      return (await this.#readState()).status;
    });
  }

  changeVaultPassphrase({ currentPassphrase, newPassphrase } = {}) {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (!state.envelope) throw securityError(state.status.reason ?? 'SECURITY_VAULT_SETUP_REQUIRED');
      const keyring = await unwrapKeyring(state.envelope, currentPassphrase);
      const envelope = state.envelope.format === LOG_KEY_VAULT_FORMAT
        ? await logKeyRecord(keyring, newPassphrase, state.envelope.id)
        : await encryptSecurityEnvelope(keyring, newPassphrase, { ...VAULT_OPTIONS, id: state.envelope.id });
      // Rewrapping changes credentials, not data keys. Keep active consumers
      // and the old session intact until the new persistent wrap commits.
      await this.keyStore.writeVault(envelope);
      return this.#commitWrappedSession(envelope, keyring);
    });
  }

  async #commitWrappedSession(envelope, keyring) {
    try {
      return await this.#installSession(envelope, keyring, { invalidate: false });
    } catch (cause) {
      const code = 'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_COMMIT_FAILED';
      this.sessionAdmissionFailure = code;
      if (envelope.format === LOG_KEY_VAULT_FORMAT) this.invalidateLogKeyCaches();
      else this.invalidateKeyCaches();
      try {
        await this.sessionStore.clear();
      } catch (clearCause) {
        this.sessionAdmissionFailure = 'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_CLEAR_FAILED';
        throw securityError(this.sessionAdmissionFailure, clearCause);
      }
      throw securityError(code, cause);
    }
  }

  removeVaultPassphrase({ currentPassphrase } = {}) {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (!state.envelope) throw securityError('SECURITY_VAULT_PASSPHRASE_REMOVAL_FORBIDDEN');
      const keyring = await unwrapKeyring(state.envelope, currentPassphrase);
      // Clear the optional session before the durable switch. Failure leaves
      // the encrypted record intact; no second persisted key source is added.
      await this.sessionStore.clear();
      this.sessionAdmissionFailure = null;
      try {
        await this.keyStore.writeVault(localKeyRecord(keyring, state.envelope.id));
      } catch (cause) {
        this.invalidateLockedCaches(state);
        throw securityError('SECURITY_VAULT_PASSPHRASE_REMOVAL_COMMIT_FAILED', cause);
      }
      return (await this.#readState()).status;
    });
  }

  separateVaultProtectionKeys({ passphrase } = {}) {
    return this.enqueueMutation(async () => {
      const state = await this.#readState();
      if (state.envelope?.format !== SECURITY_VAULT_FORMAT) {
        throw securityError('SECURITY_VAULT_SEPARATION_FORBIDDEN');
      }
      const keyring = await unwrapKeyring(state.envelope, passphrase);
      const envelope = await logKeyRecord(keyring, passphrase, state.envelope.id);
      await this.keyStore.writeVault(envelope);
      return this.#commitWrappedSession(envelope, keyring);
    });
  }

  // Backup restore prepares all crypto before a destructive profile lifecycle.
  async prepareRestoredVault(keyring, restorePassphrase) {
    const canonical = requireCanonicalSecurityKeyring(keyring);
    // Omission explicitly selects the normal local mode. A supplied empty or
    // weak password still rejects through the encrypted-envelope validator.
    return restorePassphrase === undefined ? localKeyRecord(canonical)
      : logKeyRecord(canonical, restorePassphrase);
  }

  installRestoredVault(envelope) {
    return this.enqueueMutation(async () => {
      await this.initializeStorageTrust();
      requireSecurityKeyRecord(envelope);
      this.invalidateKeyCaches();
      await this.sessionStore.clear();
      this.sessionAdmissionFailure = null;
      await this.keyStore.replaceVault(envelope);
      // The prepared record explicitly selects local or passphrase admission.
      return (await this.#readState()).status;
    });
  }

  async get(field) {
    if (!Object.values(KEY_MATERIAL_FIELDS).includes(field)) throw securityError('KEY_MATERIAL_FIELD_UNSUPPORTED');
    const keys = field === KEY_MATERIAL_FIELDS.LOG_CRYPTO_JWK
      ? await this.requireUnlocked() : await this.requireProtectionKeys();
    return keys[field];
  }

  async set(field, value) {
    const existing = await this.get(field);
    if (JSON.stringify(existing) !== JSON.stringify(value)) throw securityError('SECURITY_VAULT_KEY_REPLACEMENT_FORBIDDEN');
  }

  getLogCryptoJwk() { return this.get(KEY_MATERIAL_FIELDS.LOG_CRYPTO_JWK); }
  getDomainHmacSecret() { return this.get(KEY_MATERIAL_FIELDS.DOMAIN_HMAC_SECRET); }
  getClseHmacSecret() { return this.get(KEY_MATERIAL_FIELDS.CLSE_HMAC_SECRET); }
  setDomainHmacSecret(value) { return this.set(KEY_MATERIAL_FIELDS.DOMAIN_HMAC_SECRET, value); }
  getEntries(keys, fallback) { return this.keyStore.getEntries(keys, fallback); }

  clear() {
    return this.enqueueMutation(async () => {
      await this.initializeStorageTrust();
      this.invalidateKeyCaches();
      await this.sessionStore.clear();
      this.sessionAdmissionFailure = null;
      await this.keyStore.clear();
    });
  }
}

export default KeyMaterialRepository;
