let socialMetricsManagerPromise = null;
let loadedSocialMetricsManager = null;
let socialMetricsInvocationToken = 0;
let socialMetricsDebugAuditMode = 'standard';

function normalizeDebugAuditMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'standard' || normalized === 'deep') return normalized;
  throw new Error(`SOCIAL_METRICS_AUDIT_MODE_INVALID:${normalized || 'empty'}`);
}

export function loadSocialMetricsManager() {
  if (loadedSocialMetricsManager) {
    return Promise.resolve(loadedSocialMetricsManager);
  }
  socialMetricsManagerPromise ||= import('./socialMetricsManager.js')
    .then(({ default: SocialMetricsManager }) => {
      loadedSocialMetricsManager = SocialMetricsManager;
      loadedSocialMetricsManager.setDebugAuditMode?.(socialMetricsDebugAuditMode, { reset: false });
      return loadedSocialMetricsManager;
    })
    .catch((error) => {
      socialMetricsManagerPromise = null;
      console.error('[SocialMetricsManager] Failed to load manager.', error);
      throw error;
    });
  return socialMetricsManagerPromise;
}

function invokeSocialMetricsManager(method, args = [], { loadIfMissing = true } = {}) {
  if (loadedSocialMetricsManager) {
    return loadedSocialMetricsManager[method](...args);
  }
  if (!loadIfMissing) return undefined;
  return loadSocialMetricsManager()
    .then((SocialMetricsManager) => {
      if (typeof SocialMetricsManager?.[method] !== 'function') {
        throw new Error(`SOCIAL_METRICS_MANAGER_METHOD_MISSING:${method}`);
      }
      return SocialMetricsManager[method](...args);
    })
    .catch((error) => {
      console.error(`[SocialMetricsManager] Failed to run ${method}.`, error);
      throw error;
    });
}

export function updateSocialMetricsManager(...args) {
  const invocationToken = ++socialMetricsInvocationToken;
  if (args[0]?.isActive === false && !loadedSocialMetricsManager) {
    // Advancing the token also cancels a pending ON import's application.
    return undefined;
  }
  if (loadedSocialMetricsManager) {
    return invokeSocialMetricsManager('update', args);
  }
  return loadSocialMetricsManager()
    .then((SocialMetricsManager) => {
      if (invocationToken !== socialMetricsInvocationToken) return undefined;
      if (typeof SocialMetricsManager?.update !== 'function') {
        throw new Error('SOCIAL_METRICS_MANAGER_METHOD_MISSING:update');
      }
      return SocialMetricsManager.update(...args);
    })
    .catch((error) => {
      console.error('[SocialMetricsManager] Failed to run update.', error);
      throw error;
    });
}

export function removeLoadedSocialMetricsManager() {
  socialMetricsInvocationToken += 1;
  return invokeSocialMetricsManager('remove', [], { loadIfMissing: false });
}

export function getLoadedSocialMetricsDebugSnapshot() {
  if (!loadedSocialMetricsManager) {
    return { loaded: false, auditMode: socialMetricsDebugAuditMode };
  }
  if (typeof loadedSocialMetricsManager.getDebugSnapshot !== 'function') {
    return { loaded: true, available: false };
  }
  return loadedSocialMetricsManager.getDebugSnapshot();
}

export function setSocialMetricsDebugAuditMode(mode, { reset = true } = {}) {
  const normalized = normalizeDebugAuditMode(mode);
  socialMetricsDebugAuditMode = normalized;
  loadedSocialMetricsManager?.setDebugAuditMode?.(normalized, { reset });
  return normalized;
}

export function resetLoadedSocialMetricsDebugSnapshot() {
  if (typeof loadedSocialMetricsManager?.resetDebugSnapshot === 'function') {
    loadedSocialMetricsManager.resetDebugSnapshot();
  }
}

export function beginLoadedSocialMetricsDebugMeasurementEpoch() {
  return loadedSocialMetricsManager?.beginDebugMeasurementEpoch?.() ?? null;
}
