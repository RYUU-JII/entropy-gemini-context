import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';
import { requireGateEntryApproval } from '../../../domains/protection/background/runtime/gateEntryApprovalPolicy.js';

export class GateEntryApprovalRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }
  async read() {
    const result = await this.sessionRepository.readOptional(STORAGE_SESSION_KEYS.GATE_ENTRY_APPROVAL);
    if (!result || typeof result.found !== 'boolean') throw new Error('GATE_ENTRY_APPROVAL_READ_INVALID');
    if (result.found) requireGateEntryApproval(result.value);
    return result;
  }
  write(value) {
    return this.sessionRepository.set({ [STORAGE_SESSION_KEYS.GATE_ENTRY_APPROVAL]: requireGateEntryApproval(value) });
  }
}
