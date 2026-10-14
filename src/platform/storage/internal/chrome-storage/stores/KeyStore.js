import { readChromeStorageLocal, removeChromeStorageLocal, writeChromeStorageLocal } from '../localArea.js';
import { RETIRED_PLAINTEXT_KEY_STORAGE_KEYS, STORAGE_LOCAL_KEY_KEYS } from '../storageKeyRegistry.js';
import { requireSecurityKeyRecord } from '../../../security/securityKeyRecordContract.js';

// One current record: local keys, log-only wrapping, or an existing full wrap.
export class KeyStore {
  static getInstance() {
    if (!KeyStore.instance) KeyStore.instance = new KeyStore();
    return KeyStore.instance;
  }

  async readVaultState() {
    const keys = [STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT, ...RETIRED_PLAINTEXT_KEY_STORAGE_KEYS];
    const items = await readChromeStorageLocal(keys);
    return {
      present: Object.hasOwn(items, STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT),
      envelope: items[STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT],
      retiredKeysPresent: RETIRED_PLAINTEXT_KEY_STORAGE_KEYS.filter((key) => Object.hasOwn(items, key)),
    };
  }

  writeVault(envelope) {
    requireSecurityKeyRecord(envelope);
    return writeChromeStorageLocal({ [STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT]: envelope });
  }

  async replaceVault(envelope) {
    await this.writeVault(envelope);
    await removeChromeStorageLocal(RETIRED_PLAINTEXT_KEY_STORAGE_KEYS);
  }

  async getEntries(storageKeys = Object.values(STORAGE_LOCAL_KEY_KEYS), fallback = null) {
    if (storageKeys.some((key) => key !== STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT)) {
      throw new Error('KEY_STORE_FIELD_UNSUPPORTED');
    }
    const items = await readChromeStorageLocal(storageKeys);
    return Object.fromEntries(storageKeys.map((key) => [key, Object.hasOwn(items, key) ? items[key] : fallback]));
  }

  clear() {
    return removeChromeStorageLocal([STORAGE_LOCAL_KEY_KEYS.SECURITY_VAULT, ...RETIRED_PLAINTEXT_KEY_STORAGE_KEYS]);
  }
}

export default KeyStore;
