import { getLocalDateStr } from '../../../../lib/index.js';
import { STORAGE_RETENTION_DAYS } from '../../../../platform/storage/retention/storageRetentionPolicy.js';

function toTaskList(cleanupTasks) {
  if (cleanupTasks === undefined) return [];
  if (!Array.isArray(cleanupTasks)) {
    throw new Error('STATS_RETENTION_CLEANUP_TASKS_INVALID');
  }
  cleanupTasks.forEach((task) => {
    if (typeof task !== 'function') {
      throw new Error('STATS_RETENTION_CLEANUP_TASK_REQUIRED');
    }
  });
  return cleanupTasks;
}

function requireRetentionOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
}

export function createStatsRetentionJob({
  sessionStore,
  statsRepository,
  cleanupTasks,
  sessionKey,
} = {}) {
  const store = sessionStore;
  const repository = statsRepository;
  requireRetentionOwnerMethod(store, 'get', 'STATS_RETENTION_SESSION_STORE_REQUIRED');
  requireRetentionOwnerMethod(store, 'set', 'STATS_RETENTION_SESSION_STORE_REQUIRED');
  requireRetentionOwnerMethod(repository, 'cleanupOldStatsDays', 'STATS_RETENTION_STATS_REPOSITORY_REQUIRED');
  const tasks = toTaskList(cleanupTasks);
  const normalizedSessionKey = typeof sessionKey === 'string' && sessionKey.trim()
    ? sessionKey.trim()
    : null;
  if (!normalizedSessionKey) {
    throw new Error('STATS_RETENTION_SESSION_KEY_REQUIRED');
  }

  return {
    async run({
      now = Date.now(),
      maxDays = STORAGE_RETENTION_DAYS.STATS_FACTS,
      force = false,
    } = {}) {
      const nowTs = Number.isFinite(Number(now)) ? Number(now) : Date.now();
      const todayDateStr = getLocalDateStr(nowTs);

      let lastRunDateStr = null;
      const markerRead = {
        ok: true,
        error: null,
        skipped: !!force,
      };
      if (!force) {
        try {
          const session = await store.get({ [normalizedSessionKey]: null });
          lastRunDateStr = session?.[normalizedSessionKey] || null;
        } catch (error) {
          markerRead.ok = false;
          markerRead.error = error?.message || String(error);
          console.warn('[StatsRetentionJob] Failed to read daily retention marker:', markerRead.error);
          lastRunDateStr = null;
        }
      }

      if (!force && lastRunDateStr === todayDateStr) {
        return {
          ran: false,
          skipped: true,
          dateStr: todayDateStr,
          removedStatsDays: 0,
          cleanupResults: [],
          markerRead,
        };
      }

      let removedStatsDays = 0;
      const statsCleanup = {
        ok: true,
        error: null,
      };
      try {
        removedStatsDays = await repository.cleanupOldStatsDays(maxDays, { now: nowTs });
      } catch (error) {
        statsCleanup.ok = false;
        statsCleanup.error = error?.message || String(error);
        console.warn('[StatsRetentionJob] Failed to cleanup daily stats:', statsCleanup.error);
      }

      const cleanupResults = [];
      for (const task of tasks) {
        try {
          const result = await task({ now: nowTs, dateStr: todayDateStr, maxDays });
          cleanupResults.push({ ok: true, error: null, result: result ?? null });
        } catch (error) {
          cleanupResults.push({ ok: false, error: error?.message || String(error), result: null });
        }
      }

      const marker = {
        ok: true,
        error: null,
      };
      if (statsCleanup.ok) {
        try {
          await store.set({ [normalizedSessionKey]: todayDateStr });
        } catch (error) {
          marker.ok = false;
          marker.error = error?.message || String(error);
        }
      } else {
        marker.ok = false;
        marker.error = 'STATS_RETENTION_CLEANUP_FAILED';
      }

      return {
        ran: true,
        skipped: false,
        dateStr: todayDateStr,
        removedStatsDays,
        statsCleanup,
        cleanupResults,
        markerRead,
        marker,
      };
    },
  };
}
