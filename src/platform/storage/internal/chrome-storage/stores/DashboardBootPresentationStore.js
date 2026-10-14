import { readChromeStorageSession, writeChromeStorageSession } from '../sessionArea.js';
import { STORAGE_SESSION_KEYS } from '../storageKeyRegistry.js';

const KEY = STORAGE_SESSION_KEYS.DASHBOARD_BOOT_PRESENTATION;
const COMPLETED = Object.freeze({ version: 1, ensoCompleted: true });

export class DashboardBootPresentationStore {
  constructor({ readSession = readChromeStorageSession, writeSession = writeChromeStorageSession } = {}) {
    this.readSession = readSession;
    this.writeSession = writeSession;
  }

  async readEnsoCompleted() {
    const items = await this.readSession({ [KEY]: null });
    if (!items || !Object.prototype.hasOwnProperty.call(items, KEY)) {
      throw new Error('DASHBOARD_BOOT_PRESENTATION_READ_INVALID');
    }
    const value = items[KEY];
    // Absence explicitly means this browser session has not completed its intro.
    if (value === null) return false;
    if (value.version !== 1 || value.ensoCompleted !== true || Object.keys(value).length !== 2) {
      throw new Error('DASHBOARD_BOOT_PRESENTATION_RECORD_INVALID');
    }
    return true;
  }

  async markEnsoCompleted() {
    // Monotonic/idempotent across concurrent dashboard windows; no RMW mirror.
    await this.writeSession({ [KEY]: COMPLETED });
  }
}
