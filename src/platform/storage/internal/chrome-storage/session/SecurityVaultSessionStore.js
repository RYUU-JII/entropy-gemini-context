import { readChromeStorageSession, removeChromeStorageSession, writeChromeStorageSession } from '../sessionArea.js';
import { STORAGE_SESSION_KEYS } from '../storageKeyRegistry.js';

export class SecurityVaultSessionStore {
  async get() {
    const key = STORAGE_SESSION_KEYS.SECURITY_VAULT_KEYRING;
    const values = await readChromeStorageSession([key]);
    return Object.hasOwn(values, key) ? values[key] : null;
  }

  set(value) {
    return writeChromeStorageSession({ [STORAGE_SESSION_KEYS.SECURITY_VAULT_KEYRING]: value });
  }

  clear() {
    return removeChromeStorageSession([STORAGE_SESSION_KEYS.SECURITY_VAULT_KEYRING]);
  }
}

export default SecurityVaultSessionStore;
