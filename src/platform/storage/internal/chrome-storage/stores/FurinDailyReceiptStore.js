import { readChromeStorageLocal, writeChromeStorageLocal, removeChromeStorageLocal } from '../localArea.js';
import { STORAGE_LOCAL_STATE_KEYS } from '../storageKeyRegistry.js';
import { requireFurinDailyReceipt } from '../../../nudge/furinDailyReceiptContract.js';

const KEY = STORAGE_LOCAL_STATE_KEYS.FURIN_DAILY_RECEIPT;

export class FurinDailyReceiptStore {
  constructor({ readLocal = readChromeStorageLocal, writeLocal = writeChromeStorageLocal,
    removeLocal = removeChromeStorageLocal } = {}) {
    this.readLocal = readLocal;
    this.writeLocal = writeLocal;
    this.removeLocal = removeLocal;
  }

  async read() {
    const result = await this.readLocal({ [KEY]: null });
    if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, KEY)) {
      throw new Error('FURIN_DAILY_RECEIPT_READ_INVALID');
    }
    return result[KEY] === null ? null : requireFurinDailyReceipt(result[KEY]);
  }

  async write(value) {
    requireFurinDailyReceipt(value);
    await this.writeLocal({ [KEY]: value });
  }
  clear() { return this.removeLocal([KEY]); }
}
