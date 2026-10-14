import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';

const KEY = STORAGE_SESSION_KEYS.PROTECTED_TAB_GROUPS;
const emptyState = () => ({ version: 1, groupsByWindowId: {}, processedTabIds: [], memberTabIds: [] });

export function requireProtectedTabGroupsState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 4 || value.version !== 1
    || !value.groupsByWindowId || typeof value.groupsByWindowId !== 'object'
    || Array.isArray(value.groupsByWindowId) || !Array.isArray(value.processedTabIds)
    || value.processedTabIds.some(id => !Number.isInteger(id) || id < 0)
    || new Set(value.processedTabIds).size !== value.processedTabIds.length
    || !Array.isArray(value.memberTabIds) || value.memberTabIds.some(id => !Number.isInteger(id) || id < 0)
    || new Set(value.memberTabIds).size !== value.memberTabIds.length
    || Object.entries(value.groupsByWindowId).some(([windowId, groupId]) => (
      !/^\d+$/.test(windowId) || !Number.isSafeInteger(Number(windowId))
      || !Number.isInteger(groupId) || groupId < 0
    ))) throw new Error('PROTECTED_TAB_GROUPS_STATE_INVALID');
  return { version: 1, groupsByWindowId: { ...value.groupsByWindowId }, processedTabIds: [...value.processedTabIds], memberTabIds: [...value.memberTabIds] };
}

export class ProtectedTabGroupsRepository {
  constructor({ sessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.sessionRepository = sessionRepository;
  }

  async read() {
    const row = await this.sessionRepository.readOptional(KEY);
    return row.found ? requireProtectedTabGroupsState(row.value) : emptyState();
  }

  async write(value) {
    const state = requireProtectedTabGroupsState(value);
    await this.sessionRepository.set({ [KEY]: state });
    return state;
  }
}
