import { useCallback, useEffect, useState } from 'react';

import { runtimeSendMessage } from '../../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import { STORAGE_SUPPORT_TASKS } from '../../../../platform/storage/support/storageSupportTaskContract.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { readDashboardDestructiveActionAuthPolicy } from '../../utils/destructiveActionAuthPolicy.js';

const DESTRUCTIVE_AUTH_FAILURE_CODES = new Set([
  'RESET_AUTH_REQUIRED',
  'RESET_AUTH_FAILED',
  'UNAUTHORIZED_RUNTIME_SENDER',
]);
const STORAGE_SUPPORT_TASK_SET = new Set(Object.values(STORAGE_SUPPORT_TASKS));

function requirePlainObject(value, errorCode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireArray(value, errorCode) {
  if (!Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value;
}

function requireStorageInspectorSnapshot(value) {
  const snapshot = requirePlainObject(value, 'STORAGE_INSPECTOR_SNAPSHOT_INVALID');
  const local = requirePlainObject(snapshot.local, 'STORAGE_INSPECTOR_SNAPSHOT_LOCAL_INVALID');
  requireArray(local.documents, 'STORAGE_INSPECTOR_SNAPSHOT_LOCAL_DOCUMENTS_INVALID');
  requireArray(local.keyEntries, 'STORAGE_INSPECTOR_SNAPSHOT_LOCAL_KEYS_INVALID');
  requirePlainObject(local.security, 'STORAGE_INSPECTOR_SNAPSHOT_LOCAL_SECURITY_INVALID');
  const session = requirePlainObject(snapshot.session, 'STORAGE_INSPECTOR_SNAPSHOT_SESSION_INVALID');
  requireArray(session.entries, 'STORAGE_INSPECTOR_SNAPSHOT_SESSION_ENTRIES_INVALID');
  const indexedDb = requirePlainObject(snapshot.indexedDb, 'STORAGE_INSPECTOR_SNAPSHOT_INDEXEDDB_INVALID');
  requireArray(indexedDb.stores, 'STORAGE_INSPECTOR_SNAPSHOT_INDEXEDDB_STORES_INVALID');
  requirePlainObject(snapshot.runtime, 'STORAGE_INSPECTOR_SNAPSHOT_RUNTIME_INVALID');
  return snapshot;
}

function getSupportWarningCodes(source) {
  return Array.isArray(source?.warnings)
    ? source.warnings
      .map((warning) => (typeof warning?.code === 'string' ? warning.code.trim() : ''))
      .filter(Boolean)
    : [];
}

function appendSupportWarningCodes(message, ...sources) {
  const codes = sources.flatMap((source) => getSupportWarningCodes(source));
  return codes.length > 0 ? `${message} ${codes.join(' ')}` : message;
}

function requireStorageSupportTask(task) {
  const normalizedTask = typeof task === 'string' ? task.trim() : '';
  if (!STORAGE_SUPPORT_TASK_SET.has(normalizedTask)) {
    throw new Error('UNSUPPORTED_STORAGE_SUPPORT_TASK');
  }
  return normalizedTask;
}

async function readStorageSupportAuthPolicy(getDestructiveActionAuthPolicy) {
  return readDashboardDestructiveActionAuthPolicy(getDestructiveActionAuthPolicy, {
    ownerErrorCode: 'STORAGE_SUPPORT_AUTH_POLICY_OWNER_REQUIRED',
    invalidErrorCode: 'STORAGE_SUPPORT_AUTH_POLICY_INVALID',
    requirePasscodeErrorCode: 'STORAGE_SUPPORT_AUTH_POLICY_REQUIRE_PASSCODE_INVALID',
  });
}

function readRetentionFailureError(result = {}) {
  const retention = result?.retention;
  if (retention?.statsCleanup?.ok === false) {
    return retention.statsCleanup.error || 'STATS_RETENTION_STATS_CLEANUP_FAILED';
  }
  if (retention?.markerRead?.ok === false) {
    return retention.markerRead.error || 'STATS_RETENTION_MARKER_READ_FAILED';
  }
  if (retention?.marker?.ok === false) {
    return retention.marker.error || 'STATS_RETENTION_MARKER_WRITE_FAILED';
  }
  const failedCleanupIndex = Array.isArray(retention?.cleanupResults)
    ? retention.cleanupResults.findIndex((entry) => entry?.ok === false)
    : -1;
  if (failedCleanupIndex >= 0) {
    return retention.cleanupResults[failedCleanupIndex]?.error
      || `STATS_RETENTION_CLEANUP_TASK_${failedCleanupIndex}_FAILED`;
  }
  return '';
}

function describeStorageSupportTaskResult(t, task, result = {}) {
  if (task === STORAGE_SUPPORT_TASKS.ENSURE_DOMAIN_HASH_ARTIFACTS) {
    return result?.repaired
      ? t('support.status.hashes_repaired', {})
      : t('support.status.hashes_ok', {});
  }
  if (task === STORAGE_SUPPORT_TASKS.RUN_STATS_RETENTION) {
    const retentionFailureError = readRetentionFailureError(result);
    if (retentionFailureError) {
      return t('support.status.retention_failed', {
        error: retentionFailureError,
      });
    }
    const removed = Number(result?.retention?.removedStatsDays) || 0;
    return t('support.status.retention_done', {
      removed,
    });
  }
  if (task === STORAGE_SUPPORT_TASKS.CLEAR_RUNTIME_SESSION) {
    const cleared = Array.isArray(result?.clearedKeys) ? result.clearedKeys.length : 0;
    return t('support.status.runtime_cleared', {
      cleared,
    });
  }
  if (task === STORAGE_SUPPORT_TASKS.CLEAR_FAVICON_CACHE) {
    return t('support.status.favicons_cleared', {});
  }
  return t('support.status.action_complete', {});
}

function readStorageSupportTaskTone(task, result = {}) {
  if (task === STORAGE_SUPPORT_TASKS.RUN_STATS_RETENTION && readRetentionFailureError(result)) {
    return 'error';
  }
  return 'success';
}

export function useStorageSupportController({
  isActive = true,
  enabled = false,
  getDestructiveActionAuthPolicy = null,
} = {}) {
  const { t } = useAppTranslation('tools');
  const [storageInspectorSnapshot, setStorageInspectorSnapshot] = useState(null);
  const [storageInspectorBusy, setStorageInspectorBusy] = useState(false);
  const [storageSupportActionBusy, setStorageSupportActionBusy] = useState(false);
  const [storageSupportStatus, setStorageSupportStatus] = useState({ text: '', tone: 'muted' });
  const [storageSupportAuthRequired, setStorageSupportAuthRequired] = useState(false);
  const [storageSupportPasscodeInput, setStorageSupportPasscodeInput] = useState('');

  const refreshStorageInspector = useCallback(async ({ showSuccessStatus = false } = {}) => {
    if (!isActive) return null;
    setStorageInspectorBusy(true);
    try {
      const authPolicy = await readStorageSupportAuthPolicy(getDestructiveActionAuthPolicy);
      setStorageSupportAuthRequired(!!authPolicy.requirePasscode);
      const resp = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.GET_STORAGE_INSPECTOR_SNAPSHOT,
      });
      if (!resp?.success) {
        throw new Error(resp?.error || 'GET_STORAGE_INSPECTOR_SNAPSHOT_FAILED');
      }
      const snapshot = requireStorageInspectorSnapshot(resp?.snapshot);
      setStorageInspectorSnapshot(snapshot);
      if (showSuccessStatus) {
        setStorageSupportStatus({
          text: t('support.status.snapshot_refreshed', {}),
          tone: 'success',
        });
      }
      return snapshot;
    } catch (error) {
      setStorageSupportStatus({
        text: t('support.status.snapshot_failed', {
          error: error?.message || 'UNKNOWN_ERROR',
        }),
        tone: 'error',
      });
      return null;
    } finally {
      setStorageInspectorBusy(false);
    }
  }, [getDestructiveActionAuthPolicy, isActive, t]);

  useEffect(() => {
    if (!isActive || !enabled) return;
    void refreshStorageInspector({ showSuccessStatus: false });
  }, [enabled, isActive, refreshStorageInspector]);

  const runStorageSupportAction = useCallback(async (task) => {
    if (storageSupportActionBusy) return;

    setStorageSupportActionBusy(true);
    try {
      const normalizedTask = requireStorageSupportTask(task);
      const authPolicy = await readStorageSupportAuthPolicy(getDestructiveActionAuthPolicy);
      setStorageSupportAuthRequired(!!authPolicy.requirePasscode);
      if (authPolicy.requirePasscode && !storageSupportPasscodeInput.trim()) {
        setStorageSupportStatus({
          text: t('support.status.auth_required', {}),
          tone: 'error',
        });
        return;
      }
      const resp = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.RUN_STORAGE_SUPPORT_ACTION,
        task: normalizedTask,
        authorization: {
          kind: 'passcode',
          passcode: authPolicy.requirePasscode ? storageSupportPasscodeInput : '',
        },
      });
      if (!resp?.success) {
        const errorCode = String(resp?.error || '');
        if (DESTRUCTIVE_AUTH_FAILURE_CODES.has(errorCode)) {
          setStorageSupportStatus({
            text: t('support.status.auth_failed', {}),
            tone: 'error',
          });
          return;
        }
        throw new Error(errorCode || 'RUN_STORAGE_SUPPORT_ACTION_FAILED');
      }
      const result = requirePlainObject(
        resp?.result,
        'STORAGE_SUPPORT_ACTION_RESULT_INVALID',
      );
      if (result.task !== normalizedTask) {
        throw new Error('STORAGE_SUPPORT_ACTION_TASK_MISMATCH');
      }

      setStorageSupportStatus({
        text: appendSupportWarningCodes(
          describeStorageSupportTaskResult(t, normalizedTask, result),
          resp,
          result,
        ),
        tone: readStorageSupportTaskTone(normalizedTask, result),
      });
      await refreshStorageInspector({ showSuccessStatus: false });
    } catch (error) {
      setStorageSupportStatus({
        text: t('support.status.action_failed', {
          error: error?.message || 'UNKNOWN_ERROR',
        }),
        tone: 'error',
      });
    } finally {
      setStorageSupportActionBusy(false);
    }
  }, [
    getDestructiveActionAuthPolicy,
    refreshStorageInspector,
    storageSupportActionBusy,
    storageSupportPasscodeInput,
    t,
  ]);

  return {
    storageInspectorSnapshot,
    storageInspectorBusy,
    storageSupportActionBusy,
    storageSupportStatus,
    storageSupportAuthRequired,
    storageSupportPasscodeInput,
    setStorageSupportPasscodeInput,
    refreshStorageInspector,
    runStorageSupportAction,
  };
}

export default useStorageSupportController;
