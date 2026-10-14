import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';
import { requireGateReturnLockState } from '../../../domains/protection/background/runtime/gateReturnLockPolicy.js';

export class GateReturnLockRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }
  async read() {
    const result = await this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.GATE_RETURN_LOCK);
    if (!result || typeof result.found !== 'boolean') throw new Error('GATE_RETURN_LOCK_READ_INVALID');
    if (result.found) requireGateReturnLockState(result.value);
    return result;
  }
  write(value) {
    return this.sessionRepository.set({ [STORAGE_SESSION_KEYS.GATE_RETURN_LOCK]: requireGateReturnLockState(value) });
  }
}
