import { normalizeDomain } from '../../../../lib/domain.js';
import { buildExactOriginPatternForUrl } from '../../../../lib/permissions.js';
import { NUDGE_SESSION_KEYS, readNudgeSessionMap } from '../../../../domains/nudge/runtime/session/nudgeSessionShared.js';
import { projectReadyGoalPriority } from '../../../../domains/nudge/runtime/projectReadyGoalPriority.js';

/** Capture the canonical commit version around the complete asynchronous read.
 * It fences observation only; semantic values decide whether an episode survives.
 * One re-read joins a committed edit without adding a policy mirror or queue. */
export function createBackgroundGoalAuthorizationReaders({ settingsService, trackingProtectionService,
  readProfileGeneration, sessionRepository, readDailyReceipt, browserPort } = {}) {
  if (typeof settingsService?.getSettingsChangeVersion !== 'function'
    || typeof trackingProtectionService?.resolveProtectionRuntime !== 'function'
    || typeof readProfileGeneration !== 'function' || typeof sessionRepository?.get !== 'function'
    || typeof readDailyReceipt !== 'function' || typeof browserPort?.webNavigationGetFrame !== 'function'
    || typeof browserPort?.permissionsContains !== 'function') {
    throw new Error('BACKGROUND_GOAL_AUTHORIZATION_READ_OWNERS_REQUIRED');
  }
  function version() {
    const value = settingsService.getSettingsChangeVersion();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('BACKGROUND_GOAL_SETTINGS_VERSION_INVALID');
    return value;
  }
  async function settled(read) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const before = version();
      const facts = await read();
      if (before === version()) return { ...facts, isCurrent: () => before === version() };
    }
    throw new Error('BACKGROUND_GOAL_AUTHORIZATION_READ_SUPERSEDED');
  }
  const runtime = (hostname, tabId, now) => trackingProtectionService.resolveProtectionRuntime(hostname,
    { now, tabId, includeGoalEpisodeSettings: true });

  return {
    readGoalAuthorization: ({ goalBinding, tabId, now }) => settled(async () => {
      const runtimeSnapshot = await runtime(goalBinding.hostname, tabId, now);
      const session = await sessionRepository.get({ [NUDGE_SESSION_KEYS.PENDING]: {} });
      const frame = await browserPort.webNavigationGetFrame({ tabId: goalBinding.tabId, frameId: 0 });
      const documentCurrent = frame !== null && frame?.documentId === goalBinding.documentId
        && typeof frame.url === 'string' && normalizeDomain(new URL(frame.url).hostname) === goalBinding.hostname
        && (!Object.hasOwn(frame, 'documentLifecycle') || frame.documentLifecycle === 'active');
      let permissionAvailable = false;
      if (documentCurrent) {
        const origins = buildExactOriginPatternForUrl(frame.url);
        if (!origins) throw new Error('BACKGROUND_GOAL_PERMISSION_ORIGIN_REQUIRED');
        const [scripting, host] = await Promise.all([
          browserPort.permissionsContains({ permissions: ['scripting'] }),
          browserPort.permissionsContains({ origins: [origins] }),
        ]);
        if (typeof scripting !== 'boolean' || typeof host !== 'boolean') throw new Error('BACKGROUND_GOAL_PERMISSION_FACTS_INVALID');
        permissionAvailable = scripting && host;
      }
      return { hostname: goalBinding.hostname, activityDay: runtimeSnapshot.activityDay, runtimeSnapshot,
        settings: runtimeSnapshot.goalEpisodeSettings, profileGeneration: await readProfileGeneration(),
        documentCurrent, permissionAvailable,
        pending: readNudgeSessionMap(session, NUDGE_SESSION_KEYS.PENDING)[goalBinding.key] };
    }),
    readGoalPriority: ({ tabId, documentId, now }) => settled(async () => {
      const frame = await browserPort.webNavigationGetFrame({ tabId, frameId: 0 });
      if (frame?.documentId !== documentId || typeof frame.url !== 'string') throw new Error('INTERVENTION_GOAL_PRIORITY_DOCUMENT_CHANGED');
      const url = new URL(frame.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('INTERVENTION_GOAL_PRIORITY_WEB_DOCUMENT_REQUIRED');
      const hostname = normalizeDomain(url.hostname);
      const runtimeSnapshot = await runtime(hostname, tabId, now);
      return projectReadyGoalPriority({ hostname, activityDay: runtimeSnapshot.activityDay, runtimeSnapshot,
        settings: runtimeSnapshot.goalEpisodeSettings, dailyReceipt: await readDailyReceipt() });
    }),
  };
}
