import { useCallback, useEffect, useMemo, useState } from 'react';

import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { ensureBookmarksPermissionStrict } from '../../../platform/security/capabilityGate.js';
import {
  assertArtifactConfigObject,
  createArtifactBinaryChildHandlers,
  createArtifactBinaryChildState,
  createArtifactChoiceChildHandlers,
  createArtifactChoiceChildState,
} from './artifactSettings/shared.js';
import { describeProtectionArtifactWorkflowError } from './protectionArtifactWorkflowErrors.js';
import { useProtectionArtifactWorkflowGeneration } from './useProtectionArtifactWorkflowGeneration.js';

const EMPTY_STATUS = Object.freeze({ text: '', detail: '', tone: 'muted' });
const ECHO_CONFIG_SCHEMA = Object.freeze({
  historyCleanupEnabled: 'boolean',
  bookmarkConcealEnabled: 'boolean',
  tabEvaporationEnabled: 'boolean',
  tabEvaporationTimeoutMinutes: 'number',
});

function resolveToggleChecked(nextValue) {
  if (typeof nextValue === 'boolean') return nextValue;
  if (nextValue?.target && typeof nextValue.target.checked === 'boolean') {
    return nextValue.target.checked;
  }
  return !!nextValue;
}

function normalizeHistoryToggleResult(result, nextValue) {
  if (result && typeof result === 'object') {
    return {
      ok: result.ok !== false,
      committed: !!result.committed,
      pendingConfirmation: !!result.pendingConfirmation,
      value: typeof result.value === 'boolean' ? result.value : !!nextValue,
      error: result.error || null,
    };
  }

  const accepted = !!result;
  return {
    ok: accepted,
    committed: accepted && !nextValue,
    pendingConfirmation: accepted && !!nextValue,
    value: accepted ? !!nextValue : !nextValue,
    error: accepted ? null : 'HISTORY_TOGGLE_REJECTED',
  };
}

function normalizePreviewItems(items = [], countKey = 'count') {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort((left, right) => Number(right?.[countKey] ?? right?.count) - Number(left?.[countKey] ?? left?.count));
}

function summarizeBookmarkPreview(items = []) {
  const normalizedItems = normalizePreviewItems(items, 'bookmarkCount');
  return {
    items: normalizedItems,
    total: normalizedItems.reduce((sum, item) => (
      sum + (Number(item?.bookmarkCount) || Number(item?.count) || 0)
    ), 0),
    domains: normalizedItems.length,
  };
}

function downloadHtmlFile({ html, filename }) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    throw new Error('DOWNLOAD_UNAVAILABLE');
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'entropy-memory-purge-bookmarks.html';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function buildBookmarkPendingStatus(t, items) {
  const { total, domains } = summarizeBookmarkPreview(items);
  return {
    text: t('status.bookmark_pending_destroy', { count: total }),
    detail: t('status.bookmark_pending_destroy_detail', { domains }),
    tone: 'warning',
  };
}

function buildBookmarkDisabledStatus(t) {
  return {
    text: t('status.bookmark_destroy_disabled'),
    detail: t('status.bookmark_destroy_disabled_detail'),
    tone: 'muted',
  };
}

function readBookmarkApplication(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.changedKeys)) {
    throw new Error('BOOKMARK_SETTING_ACK_INVALID');
  }
  if (result.propagation === undefined && result.changedKeys.length === 0) {
    return { applied: false, status: 'unchanged' };
  }
  const status = result.propagation?.status;
  if (!['succeeded', 'failed', 'schedule_failed', 'timed_out', 'scheduled'].includes(status)) {
    throw new Error('BOOKMARK_APPLICATION_RECEIPT_INVALID');
  }
  return { applied: status === 'succeeded', status };
}

function buildBookmarkApplicationStatus(t, application) {
  if (application.status === 'unchanged') return {
    text: t('status.bookmark_destroy_enabled'),
    detail: t('status.bookmark_destroy_enabled_detail'),
    tone: 'muted',
  };
  if (application.applied) return {
    text: t('status.bookmark_destroy_enabled'),
    detail: t('status.bookmark_destroy_enabled_detail'),
    tone: 'success',
  };
  const failed = application.status === 'failed' || application.status === 'schedule_failed';
  return {
    text: t(failed ? 'status.bookmark_destroy_apply_failed' : 'status.bookmark_destroy_apply_pending'),
    detail: t(failed ? 'status.bookmark_destroy_apply_failed_detail' : 'status.bookmark_destroy_apply_pending_detail'),
    tone: failed ? 'error' : 'warning',
  };
}

export function useProtectionEchoArtifactControl({
  concealBlockedBookmarks,
  setConcealBlockedBookmarks,
  tabEvaporationForBlocked = false,
  setTabEvaporationForBlocked,
  tabEvaporationTimeoutMinutes = 5,
  setTabEvaporationConfig,
  historyState,
  isHistoryConfirmOpen,
  handleHistoryConfirm,
  handleHistoryCleanupToggle,
  handleHistoryCancel,
  isActive = true,
  t,
}) {
  const [pendingHistoryIntent, setPendingHistoryIntent] = useState(null);
  const [echoStatus, setEchoStatus] = useState(EMPTY_STATUS);
  const [bookmarkPreview, setBookmarkPreview] = useState({
    loading: false,
    items: [],
    mode: 'destroy',
  });
  const [bookmarkBackupState, setBookmarkBackupState] = useState({
    loading: false,
    error: null,
  });
  const [isBookmarkConfirmOpen, setIsBookmarkConfirmOpen] = useState(false);
  const [pendingBookmarkValue, setPendingBookmarkValue] = useState(null);
  const {
    captureWorkflowGeneration,
    isWorkflowGenerationCurrent,
  } = useProtectionArtifactWorkflowGeneration(isActive);

  const clearBookmarkPreview = useCallback(() => {
    setBookmarkPreview({ loading: false, items: [], mode: 'destroy' });
    setBookmarkBackupState({ loading: false, error: null });
    setIsBookmarkConfirmOpen(false);
    setPendingBookmarkValue(null);
  }, []);

  useEffect(() => {
    if (isActive) return;
    setPendingHistoryIntent(null);
    setEchoStatus(EMPTY_STATUS);
    clearBookmarkPreview();
  }, [clearBookmarkPreview, isActive]);

  const commitBookmarkConceal = useCallback(async (nextValue) => {
    const result = await Promise.resolve(setConcealBlockedBookmarks(nextValue));
    if (result?.error) {
      throw result.error;
    }
    return result;
  }, [setConcealBlockedBookmarks]);

  const requestBookmarkPreview = useCallback(async () => {
    const response = await runtimeSendMessage({
      action: MESSAGE_ACTIONS.PREVIEW_BLOCKED_BOOKMARKS,
    });
    if (response?.success === false) {
      throw new Error(response?.error || 'PREVIEW_BLOCKED_BOOKMARKS_FAILED');
    }
    return summarizeBookmarkPreview(response?.items);
  }, []);

  const handleEchoHistoryCleanupToggle = useCallback(async (nextValue) => {
    const workflowGeneration = captureWorkflowGeneration();
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setEchoStatus(EMPTY_STATUS);
    }
    return handleHistoryCleanupToggle(nextValue);
  }, [
    captureWorkflowGeneration,
    handleHistoryCleanupToggle,
    isWorkflowGenerationCurrent,
  ]);

  const handleBookmarkConcealToggle = useCallback(async (nextValue) => {
    const workflowGeneration = captureWorkflowGeneration();
    const resolvedNextValue = resolveToggleChecked(nextValue);

    if (!resolvedNextValue) {
      try {
        await commitBookmarkConceal(false);
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          clearBookmarkPreview();
          setEchoStatus(buildBookmarkDisabledStatus(t));
        }
        return {
          ok: true,
          value: false,
          committed: true,
          pendingConfirmation: false,
        };
      } catch (error) {
        const errorText = describeProtectionArtifactWorkflowError(
          error,
          'BOOKMARK_DISABLE_FAILED',
        );
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          clearBookmarkPreview();
          setEchoStatus({ text: t('status.access_denied'), detail: errorText, tone: 'error' });
        }
        return {
          ok: false,
          value: concealBlockedBookmarks,
          pendingConfirmation: false,
          error: errorText,
        };
      }
    }

    let granted = false;
    try {
      granted = await ensureBookmarksPermissionStrict();
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'BOOKMARK_PERMISSION_REQUEST_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setEchoStatus({
          text: t('status.bookmark_permission_denied'),
          detail: errorText,
          tone: 'error',
        });
      }
      return {
        ok: false,
        value: resolvedNextValue,
        pendingConfirmation: false,
        error: errorText,
      };
    }
    if (!granted) {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setEchoStatus({ text: t('status.bookmark_permission_denied'), detail: '', tone: 'error' });
      }
      return {
        ok: false,
        value: resolvedNextValue,
        pendingConfirmation: false,
        error: 'PERMISSION_DENIED',
      };
    }

    try {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setEchoStatus({
          text: t('status.previewing_bookmarks'),
          detail: t('status.previewing_bookmarks_detail'),
          tone: 'muted',
        });
        setBookmarkPreview({ loading: true, items: [], mode: 'destroy' });
        setBookmarkBackupState({ loading: false, error: null });
        setIsBookmarkConfirmOpen(false);
        setPendingBookmarkValue(null);
      }

      const { items } = await requestBookmarkPreview();

      if (items.length > 0) {
        if (!isWorkflowGenerationCurrent(workflowGeneration)) {
          return {
            ok: false,
            value: concealBlockedBookmarks,
            committed: false,
            empty: false,
            pendingConfirmation: false,
            error: 'ARTIFACT_WORKFLOW_INACTIVE',
          };
        }
        setBookmarkPreview({ loading: false, items, mode: 'destroy' });
        setPendingBookmarkValue(true);
        setIsBookmarkConfirmOpen(true);
        setEchoStatus(buildBookmarkPendingStatus(t, items));
        return {
          ok: true,
          value: concealBlockedBookmarks,
          committed: false,
          empty: false,
          pendingConfirmation: true,
        };
      }

      const commitResult = await commitBookmarkConceal(true);
      const application = readBookmarkApplication(commitResult);
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        clearBookmarkPreview();
        setEchoStatus(buildBookmarkApplicationStatus(t, application));
      }
      return {
        ok: application.applied,
        value: true,
        committed: true,
        applied: application.applied,
        propagation: commitResult.propagation,
        empty: true,
        pendingConfirmation: false,
      };
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'BOOKMARK_PREVIEW_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        clearBookmarkPreview();
        setEchoStatus({ text: t('status.access_denied'), detail: errorText, tone: 'error' });
      }
      return {
        ok: false,
        value: concealBlockedBookmarks,
        pendingConfirmation: false,
        error: errorText,
      };
    }
  }, [
    captureWorkflowGeneration,
    clearBookmarkPreview,
    commitBookmarkConceal,
    concealBlockedBookmarks,
    isWorkflowGenerationCurrent,
    requestBookmarkPreview,
    t,
  ]);

  const handleBookmarkConfirm = useCallback(async () => {
    const workflowGeneration = captureWorkflowGeneration();
    const nextValue = pendingBookmarkValue;

    if (nextValue !== true) {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        clearBookmarkPreview();
      }
      return { ok: false, keptOpen: false, reason: 'NO_BOOKMARK_CONFIRMATION_PENDING' };
    }

    try {
      const commitResult = await commitBookmarkConceal(true);
      const application = readBookmarkApplication(commitResult);
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setEchoStatus(buildBookmarkApplicationStatus(t, application));
      }
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        clearBookmarkPreview();
      }
      return {
        ok: application.applied,
        committed: true,
        applied: application.applied,
        propagation: commitResult.propagation,
        keptOpen: false,
        value: true,
      };
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'BOOKMARK_CONFIRM_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setEchoStatus({ text: t('status.access_denied'), detail: errorText, tone: 'error' });
        clearBookmarkPreview();
      }
      return {
        ok: false,
        keptOpen: false,
        reason: errorText,
      };
    }
  }, [
    captureWorkflowGeneration,
    clearBookmarkPreview,
    commitBookmarkConceal,
    isWorkflowGenerationCurrent,
    pendingBookmarkValue,
    t,
  ]);

  const handleBookmarkBackup = useCallback(async () => {
    const workflowGeneration = captureWorkflowGeneration();
    try {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setBookmarkBackupState({ loading: true, error: null });
      }
      const response = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.EXPORT_BLOCKED_BOOKMARKS_HTML,
      });
      if (response?.success === false) {
        throw new Error(response?.error || 'EXPORT_BLOCKED_BOOKMARKS_HTML_FAILED');
      }
      const backup = response?.backup && typeof response.backup === 'object'
        ? response.backup
        : {};
      if (typeof backup.html !== 'string' || !backup.html) {
        throw new Error('BOOKMARK_BACKUP_EMPTY');
      }
      downloadHtmlFile({
        html: backup.html,
        filename: backup.filename,
      });
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setBookmarkBackupState({ loading: false, error: null });
        setEchoStatus({
          text: t('status.bookmark_backup_ready'),
          detail: t('status.bookmark_backup_ready_detail', {
            count: Number(backup.count) || 0,
          }),
          tone: 'success',
        });
      }
      return { ok: true, backup };
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'BOOKMARK_BACKUP_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setBookmarkBackupState({
          loading: false,
          error: errorText,
        });
        setEchoStatus({
          text: t('status.bookmark_backup_failed'),
          detail: errorText,
          tone: 'error',
        });
      }
      return { ok: false, error: errorText };
    }
  }, [captureWorkflowGeneration, isWorkflowGenerationCurrent, t]);

  const handleBookmarkCancel = useCallback(async () => {
    clearBookmarkPreview();
    setEchoStatus(EMPTY_STATUS);
    return { ok: true, cancelled: true };
  }, [clearBookmarkPreview]);

  const handleTabEvaporationToggle = useCallback(async (nextValue) => {
    const nextActive = resolveToggleChecked(nextValue);
    if (typeof setTabEvaporationForBlocked !== 'function') throw new Error('TAB_EVAPORATION_SETTING_OWNER_REQUIRED');
    const result = await setTabEvaporationForBlocked(nextActive);
    if (result?.error) throw result.error;
    return { ok: true, value: nextActive };
  }, [setTabEvaporationForBlocked]);

  const handleTabEvaporationTimeoutChange = useCallback(async (nextTimeout) => {
    if (typeof setTabEvaporationConfig !== 'function') throw new Error('TAB_EVAPORATION_CONFIG_OWNER_REQUIRED');
    const result = await setTabEvaporationConfig({ enabled: true, timeoutMinutes: nextTimeout });
    if (result?.error) throw result.error;
    return { ok: true, value: nextTimeout };
  }, [setTabEvaporationConfig]);

  const applyEchoState = useCallback(async ({
    historyCleanupEnabled = false,
    bookmarkConcealEnabled = false,
    tabEvaporationEnabled = false,
    tabEvaporationTimeoutMinutes: nextTimeout = 5,
  } = {}) => {
    const workflowGeneration = captureWorkflowGeneration();
    const desiredHistoryCleanup = !!historyCleanupEnabled;
    const desiredBookmarkConceal = !!bookmarkConcealEnabled;

    if (tabEvaporationEnabled !== tabEvaporationForBlocked || nextTimeout !== tabEvaporationTimeoutMinutes) {
      if (typeof setTabEvaporationConfig !== 'function') throw new Error('TAB_EVAPORATION_CONFIG_OWNER_REQUIRED');
      const result = await setTabEvaporationConfig({ enabled: tabEvaporationEnabled, timeoutMinutes: nextTimeout });
      if (result?.error) throw result.error;
    }

    if (!desiredHistoryCleanup) {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setPendingHistoryIntent(null);
      }
      if (isHistoryConfirmOpen && !historyState.historyCleanupEnabled) {
        await handleHistoryCancel();
      }
      if (historyState.historyCleanupEnabled) {
        const historyResult = normalizeHistoryToggleResult(
          await handleEchoHistoryCleanupToggle(false),
          false,
        );
        if (!historyResult.ok) {
          return false;
        }
      }
      if (desiredBookmarkConceal !== concealBlockedBookmarks) {
        const bookmarkResult = await handleBookmarkConcealToggle(desiredBookmarkConceal);
        if (!bookmarkResult.ok) {
          return false;
        }
      }
      return true;
    }

    if (!historyState.historyCleanupEnabled) {
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setPendingHistoryIntent({
          desiredBookmarkConcealEnabled: desiredBookmarkConceal,
        });
      }
      const historyResult = normalizeHistoryToggleResult(
        await handleEchoHistoryCleanupToggle(true),
        true,
      );
      if (!historyResult.ok) {
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setPendingHistoryIntent(null);
        }
        return false;
      }
      if (historyResult.pendingConfirmation) {
        return true;
      }
      if (desiredBookmarkConceal !== concealBlockedBookmarks) {
        const bookmarkResult = await handleBookmarkConcealToggle(desiredBookmarkConceal);
        if (!bookmarkResult.ok) {
          if (isWorkflowGenerationCurrent(workflowGeneration)) {
            setPendingHistoryIntent(null);
          }
          return false;
        }
      }
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setPendingHistoryIntent(null);
      }
      return true;
    }

    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setPendingHistoryIntent(null);
    }
    if (desiredBookmarkConceal !== concealBlockedBookmarks) {
      const bookmarkResult = await handleBookmarkConcealToggle(desiredBookmarkConceal);
      if (!bookmarkResult.ok) {
        return false;
      }
    }
    return true;
  }, [
    captureWorkflowGeneration,
    concealBlockedBookmarks,
    handleBookmarkConcealToggle,
    handleEchoHistoryCleanupToggle,
    handleHistoryCancel,
    historyState.historyCleanupEnabled,
    isWorkflowGenerationCurrent,
    isHistoryConfirmOpen,
    setTabEvaporationConfig,
    tabEvaporationForBlocked,
    tabEvaporationTimeoutMinutes,
  ]);

  const handleEchoHistoryConfirm = useCallback(async () => {
    const workflowGeneration = captureWorkflowGeneration();
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setEchoStatus(EMPTY_STATUS);
    }
    const result = await handleHistoryConfirm();
    if (result?.ok) {
      const desiredBookmarkConceal = typeof pendingHistoryIntent?.desiredBookmarkConcealEnabled === 'boolean'
        ? pendingHistoryIntent.desiredBookmarkConcealEnabled
        : concealBlockedBookmarks;
      if (desiredBookmarkConceal !== concealBlockedBookmarks) {
        const bookmarkResult = await handleBookmarkConcealToggle(desiredBookmarkConceal);
        if (!bookmarkResult.ok) {
          if (isWorkflowGenerationCurrent(workflowGeneration)) {
            setPendingHistoryIntent(null);
          }
          return {
            ok: false,
            keptOpen: false,
            reason: bookmarkResult.error || 'BOOKMARK_CONCEAL_UPDATE_FAILED',
          };
        }
      }
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setPendingHistoryIntent(null);
      }
      return result;
    }
    if (result?.keptOpen) {
      return result;
    }
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setPendingHistoryIntent(null);
    }
    return result;
  }, [
    captureWorkflowGeneration,
    concealBlockedBookmarks,
    handleBookmarkConcealToggle,
    handleHistoryConfirm,
    isWorkflowGenerationCurrent,
    pendingHistoryIntent,
  ]);

  const handleEchoHistoryCancel = useCallback(async () => {
    const workflowGeneration = captureWorkflowGeneration();
    const result = await handleHistoryCancel();
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setPendingHistoryIntent(null);
    }
    return result;
  }, [
    captureWorkflowGeneration,
    handleHistoryCancel,
    isWorkflowGenerationCurrent,
  ]);

  const applyEchoConfig = useCallback(async (config = {}) => {
    assertArtifactConfigObject(config, 'echo', ECHO_CONFIG_SCHEMA);
    return applyEchoState(config);
  }, [applyEchoState]);

  const echoWorkflowState = useMemo(() => Object.freeze({
    pendingConfirmation: !!pendingHistoryIntent || !!isHistoryConfirmOpen || !!isBookmarkConfirmOpen,
    status: echoStatus.text ? echoStatus : historyState.historyStatus,
  }), [
    echoStatus,
    historyState.historyStatus,
    isBookmarkConfirmOpen,
    isHistoryConfirmOpen,
    pendingHistoryIntent,
  ]);

  const artifactFamily = useMemo(() => {
    const enabled = historyState.historyCleanupEnabled
      || concealBlockedBookmarks
      || tabEvaporationForBlocked;
    return Object.freeze({
      enabled,
      children: Object.freeze({
        historyCleanup: createArtifactBinaryChildState({
          enabled: !!historyState.historyCleanupEnabled,
        }),
        bookmarkConceal: createArtifactBinaryChildState({
          enabled: !!concealBlockedBookmarks,
        }),
        tabEvaporation: createArtifactChoiceChildState({
          enabled: !!tabEvaporationForBlocked,
          value: Number(tabEvaporationTimeoutMinutes) || 5,
        }),
      }),
    });
  }, [
    concealBlockedBookmarks,
    historyState.historyCleanupEnabled,
    tabEvaporationForBlocked,
    tabEvaporationTimeoutMinutes,
  ]);

  const artifactFamilyHandlers = useMemo(() => Object.freeze({
    commitConfig: applyEchoConfig,
    children: Object.freeze({
      historyCleanup: createArtifactBinaryChildHandlers({
        toggleHistoryCleanup: handleEchoHistoryCleanupToggle,
        toggle: handleEchoHistoryCleanupToggle,
      }),
      bookmarkConceal: createArtifactBinaryChildHandlers({
        toggleBookmarkConceal: handleBookmarkConcealToggle,
        toggle: handleBookmarkConcealToggle,
      }),
      tabEvaporation: createArtifactChoiceChildHandlers({
        toggle: handleTabEvaporationToggle,
        setValue: handleTabEvaporationTimeoutChange,
      }),
    }),
  }), [
    applyEchoConfig,
    handleBookmarkConcealToggle,
    handleEchoHistoryCleanupToggle,
    handleTabEvaporationTimeoutChange,
    handleTabEvaporationToggle,
  ]);

  return {
    artifactFamily,
    artifactFamilyHandlers,
    echoWorkflowState,
    bookmarkPreview,
    bookmarkBackupState,
    isBookmarkConfirmOpen,
    handleBookmarkConfirm,
    handleBookmarkCancel,
    handleBookmarkBackup,
    handleHistoryConfirm: handleEchoHistoryConfirm,
    handleHistoryCancel: handleEchoHistoryCancel,
  };
}

export default useProtectionEchoArtifactControl;
