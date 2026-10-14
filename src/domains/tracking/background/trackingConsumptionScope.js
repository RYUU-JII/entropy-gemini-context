import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';
import { resolveProtectedHostnameScope } from '../../protection/background/protectedHostnameScope.js';

export function createTrackingConsumptionScopeReader({ sessionStore } = {}) {
  if (!sessionStore || typeof sessionStore.get !== 'function') throw new Error('TRACKING_CONSUMPTION_SCOPE_SESSION_REQUIRED');
  return async ({ hostname, settings, now }) => {
    const session = await sessionStore.get({ [STORAGE_SESSION_KEYS.SPECIAL_SESSION]: null });
    if (!session || !Object.hasOwn(session, STORAGE_SESSION_KEYS.SPECIAL_SESSION)) {
      throw new Error('TRACKING_CONSUMPTION_SCOPE_SESSION_INVALID');
    }
    return resolveProtectedHostnameScope(hostname, settings, now, session[STORAGE_SESSION_KEYS.SPECIAL_SESSION]);
  };
}
