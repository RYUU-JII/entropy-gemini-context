import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeFlagRepository.js';
import {
  addTemporaryAllowedHostToSpecialSession,
  createSpecialSessionState,
  normalizeSpecialSessionState,
} from '../../settings/config/specialSession.js';

function requireRuntimeFlagRepository(repository) {
  if (
    !repository
    || typeof repository.get !== 'function'
    || typeof repository.set !== 'function'
  ) {
    throw new Error('SPECIAL_SESSION_RUNTIME_FLAG_REPOSITORY_REQUIRED');
  }
  return repository;
}

export function createSpecialSessionRuntime({
  runtimeFlagRepository,
  sessionKey = STORAGE_SESSION_KEYS.SPECIAL_SESSION,
} = {}) {
  const repository = requireRuntimeFlagRepository(runtimeFlagRepository);

  async function readSession({ now = Date.now() } = {}) {
    const session = await repository.get({ [sessionKey]: null });
    return normalizeSpecialSessionState(session[sessionKey], { now });
  }

  async function writeSession(nextSession) {
    const session = normalizeSpecialSessionState(nextSession);
    await repository.set({ [sessionKey]: session.active ? session : null });
    return session;
  }

  async function startSession(payload = {}, { now = Date.now() } = {}) {
    const nextSession = createSpecialSessionState(payload, { now });
    await repository.set({ [sessionKey]: nextSession });
    return nextSession;
  }

  async function endSession() {
    await repository.set({ [sessionKey]: null });
    return normalizeSpecialSessionState(null);
  }

  async function addTemporaryAllowedHost(host, { now = Date.now() } = {}) {
    const currentSession = await readSession({ now });
    const nextSession = addTemporaryAllowedHostToSpecialSession(currentSession, host, { now });
    return writeSession(nextSession);
  }

  return {
    addTemporaryAllowedHost,
    endSession,
    readSession,
    startSession,
  };
}

export default createSpecialSessionRuntime;
