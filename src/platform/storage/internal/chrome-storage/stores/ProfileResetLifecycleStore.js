import {
  readChromeStorageLocal,
  writeChromeStorageLocal,
} from '../localArea.js';
import { STORAGE_LOCAL_STATE_KEYS } from '../storageKeyRegistry.js';

export const PROFILE_RESET_LIFECYCLE_STORAGE_KEY = (
  STORAGE_LOCAL_STATE_KEYS.PROFILE_RESET_LIFECYCLE
);

export class ProfileResetLifecycleStore {
  static getInstance() {
    if (!ProfileResetLifecycleStore.instance) {
      ProfileResetLifecycleStore.instance = new ProfileResetLifecycleStore();
    }
    return ProfileResetLifecycleStore.instance;
  }

  constructor({
    readLocal = readChromeStorageLocal,
    writeLocal = writeChromeStorageLocal,
  } = {}) {
    if (typeof readLocal !== 'function' || typeof writeLocal !== 'function') {
      throw new Error('PROFILE_RESET_LIFECYCLE_LOCAL_AREA_REQUIRED');
    }
    this.readLocal = readLocal;
    this.writeLocal = writeLocal;
  }

  async readOptional() {
    const result = await this.readLocal([PROFILE_RESET_LIFECYCLE_STORAGE_KEY]);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('PROFILE_RESET_LIFECYCLE_LOCAL_READ_INVALID');
    }
    return Object.prototype.hasOwnProperty.call(result, PROFILE_RESET_LIFECYCLE_STORAGE_KEY)
      ? { found: true, value: result[PROFILE_RESET_LIFECYCLE_STORAGE_KEY] }
      : { found: false, value: undefined };
  }

  async write(value) {
    await this.writeLocal({
      [PROFILE_RESET_LIFECYCLE_STORAGE_KEY]: value,
    });
    return value;
  }
}

export default ProfileResetLifecycleStore;
