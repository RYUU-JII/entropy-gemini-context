import { FurinDailyReceiptStore } from '../internal/chrome-storage/stores/FurinDailyReceiptStore.js';

// Only the background nudge session lane writes this daily presentation receipt.
// It is independent of pending/debt/session lifecycle and excluded from exports.
export class FurinDailyReceiptRepository {
  constructor({ store = new FurinDailyReceiptStore() } = {}) { this.store = store; }
  read() { return this.store.read(); }
  write(receipt) { return this.store.write(receipt); }
  clear() { return this.store.clear(); }
}
