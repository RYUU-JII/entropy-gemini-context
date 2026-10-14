import { useCallback, useEffect, useState } from 'react';

import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import {
  CEREMONY_IDS,
  requestCeremony,
} from '../../../platform/ceremony/index.js';
import { MESSAGE_ACTIONS } from '../../../platform/messaging/messageTypes.js';
import { ensureHistoryPermissionStrict } from '../../../platform/security/capabilityGate.js';
import { useSecurityStore } from '../stores/useSecurityStore.js';
import { readDashboardDestructiveActionAuthPolicy } from '../utils/destructiveActionAuthPolicy.js';
import { describeProtectionArtifactWorkflowError } from './protectionArtifactWorkflowErrors.js';
import { useProtectionArtifactWorkflowGeneration } from './useProtectionArtifactWorkflowGeneration.js';
import { useRuntimeParkedStoreSlice } from './useRuntimeParkedStoreSlice.js';

const DESTRUCTIVE_AUTH_FAILURE_CODES = new Set([
  'RESET_AUTH_REQUIRED',
  'RESET_AUTH_FAILED',
  'UNAUTHORIZED_RUNTIME_SENDER',
]);
const EMPTY_STATUS = Object.freeze({ text: '', detail: '', tone: 'muted' });
const selectBlockedHistorySecuritySlice = (state) => ({
  getDestructiveActionAuthPolicy: state.getDestructiveActionAuthPolicy,
});

function resolveToggleChecked(nextValue) {
  if (typeof nextValue === 'boolean') return nextValue;
  if (nextValue?.target && typeof nextValue.target.checked === 'boolean') {
    return nextValue.target.checked;
  }
  return !!nextValue;
}

function normalizePreviewItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort((left, right) => Number(right?.count) - Number(left?.count));
}

function summarizePreviewItems(items = []) {
  const normalizedItems = normalizePreviewItems(items);
  return {
    items: normalizedItems,
    total: normalizedItems.reduce((sum, item) => sum + (Number(item?.count) || 0), 0),
    domains: normalizedItems.length,
  };
}

export function useProtectionBlockedHistoryControl({
  historyCleanupForBlocked,
  isActive = true,
  setHistoryCleanupForBlocked,
  t,
}) {
  const [historyStatus, setHistoryStatus] = useState(EMPTY_STATUS);
  const [historyPreview, setHistoryPreview] = useState({ loading: false, items: [] });
  const [historyAuthRequired, setHistoryAuthRequired] = useState(false);
  const [historyPasscodeInput, setHistoryPasscodeInput] = useState('');
  const [isHistoryConfirmOpen, setIsHistoryConfirmOpen] = useState(false);
  const [pendingEnableCommit, setPendingEnableCommit] = useState(false);
  const [historyOperationBusy, setHistoryOperationBusy] = useState(false);
  const {
    captureWorkflowGeneration,
    isWorkflowGenerationCurrent,
  } = useProtectionArtifactWorkflowGeneration(isActive);
  const { getDestructiveActionAuthPolicy } = useRuntimeParkedStoreSlice(
    useSecurityStore,
    selectBlockedHistorySecuritySlice,
    isActive,
  );

  useEffect(() => {
    if (historyCleanupForBlocked) {
      setPendingEnableCommit(false);
    }
  }, [historyCleanupForBlocked]);

  useEffect(() => {
    if (isActive) return;
    setHistoryStatus(EMPTY_STATUS);
    setHistoryPreview({ loading: false, items: [] });
    setHistoryAuthRequired(false);
    setHistoryPasscodeInput('');
    setIsHistoryConfirmOpen(false);
    setPendingEnableCommit(false);
    setHistoryOperationBusy(false);
  }, [isActive]);

  const commitHistoryCleanup = useCallback(async (nextValue) => {
    const result = await Promise.resolve(setHistoryCleanupForBlocked(nextValue));
    if (result?.error) {
      throw result.error;
    }
    return result;
  }, [setHistoryCleanupForBlocked]);

  const handleHistoryCleanupToggle = useCallback(async (nextValue) => {
    const workflowGeneration = captureWorkflowGeneration();
    const nextActive = resolveToggleChecked(nextValue);
    if (nextActive) {
      let granted = false;
      try {
        granted = await ensureHistoryPermissionStrict();
      } catch (error) {
        const errorText = describeProtectionArtifactWorkflowError(
          error,
          'HISTORY_PERMISSION_REQUEST_FAILED',
        );
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setHistoryStatus({
            text: t('status.history_permission_denied'),
            detail: errorText,
            tone: 'error',
          });
        }
        return { ok: false, error: errorText };
      }
      if (!granted) {
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setHistoryStatus({ text: t('status.history_permission_denied'), detail: '', tone: 'error' });
        }
        return { ok: false, error: 'PERMISSION_DENIED' };
      }
      try {
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setHistoryStatus({
            text: t('status.previewing_history'),
            detail: t('status.previewing_history_detail'),
            tone: 'muted',
          });
          setHistoryPreview({ loading: true, items: [] });
          setHistoryAuthRequired(false);
          setHistoryPasscodeInput('');
          setIsHistoryConfirmOpen(false);
        }
        const resp = await runtimeSendMessage({ action: MESSAGE_ACTIONS.PREVIEW_BLOCKED_HISTORY });
        if (resp?.success === false) {
          throw new Error(resp?.error || 'PREVIEW_BLOCKED_HISTORY_FAILED');
        }
        const { items, total, domains } = summarizePreviewItems(resp?.items);

        if (items.length === 0) {
          await commitHistoryCleanup(true);
          if (isWorkflowGenerationCurrent(workflowGeneration)) {
            setPendingEnableCommit(true);
            setHistoryPreview({ loading: false, items: [] });
            setHistoryStatus({
              text: t('status.history_enabled_no_matches'),
              detail: t('status.history_enabled_no_matches_detail'),
              tone: 'success',
            });
          }
          return {
            ok: true,
            committed: true,
            empty: true,
            pendingConfirmation: false,
            value: true,
          };
        }

        const authPolicy = await readDashboardDestructiveActionAuthPolicy(
          getDestructiveActionAuthPolicy,
          {
            ownerErrorCode: 'HISTORY_CLEANUP_AUTH_POLICY_OWNER_REQUIRED',
            invalidErrorCode: 'HISTORY_CLEANUP_AUTH_POLICY_INVALID',
            requirePasscodeErrorCode: 'HISTORY_CLEANUP_AUTH_POLICY_REQUIRE_PASSCODE_INVALID',
          },
        );
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setHistoryAuthRequired(!!authPolicy.requirePasscode);
          setHistoryPasscodeInput('');
          setHistoryPreview({ loading: false, items });
          setHistoryStatus({
            text: t('status.history_pending', { count: total }),
            detail: t('status.history_pending_detail', { domains }),
            tone: 'warning',
          });
          setIsHistoryConfirmOpen(true);
        }
        return {
          ok: true,
          committed: false,
          empty: false,
          pendingConfirmation: true,
          value: false,
        };
      } catch (error) {
        const errorText = describeProtectionArtifactWorkflowError(
          error,
          'PREVIEW_BLOCKED_HISTORY_FAILED',
        );
        if (isWorkflowGenerationCurrent(workflowGeneration)) {
          setHistoryPreview({ loading: false, items: [] });
          setHistoryAuthRequired(false);
          setHistoryPasscodeInput('');
          setIsHistoryConfirmOpen(false);
          setHistoryStatus({ text: t('status.access_denied'), detail: errorText, tone: 'error' });
        }
        return { ok: false, error: errorText };
      }
    }

    try {
      await commitHistoryCleanup(nextActive);
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setPendingEnableCommit(false);
        setHistoryAuthRequired(false);
        setHistoryPasscodeInput('');
        setHistoryStatus({
          text: t('status.history_disabled'),
          detail: t('status.history_disabled_detail'),
          tone: 'muted',
        });
      }
      return {
        ok: true,
        committed: true,
        empty: false,
        pendingConfirmation: false,
        value: false,
      };
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'HISTORY_CLEANUP_SETTING_WRITE_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setHistoryStatus({ text: t('status.access_denied'), detail: errorText, tone: 'error' });
      }
      return { ok: false, error: errorText };
    }
  }, [
    captureWorkflowGeneration,
    commitHistoryCleanup,
    getDestructiveActionAuthPolicy,
    isWorkflowGenerationCurrent,
    t,
  ]);

  const handleHistoryConfirm = useCallback(async () => {
    const workflowGeneration = captureWorkflowGeneration();
    if (historyAuthRequired && !historyPasscodeInput.trim()) {
      setHistoryStatus({ text: t('status.auth_required'), detail: '', tone: 'error' });
      return { ok: false, keptOpen: true, reason: 'AUTH_REQUIRED' };
    }

    setIsHistoryConfirmOpen(false);
    setHistoryOperationBusy(true);
    setHistoryStatus({ text: t('status.purging'), detail: t('status.purging_detail'), tone: 'muted' });
    let resp = null;
    try {
      resp = await runtimeSendMessage({
        action: MESSAGE_ACTIONS.CLEANUP_BLOCKED_HISTORY,
        enableAfterCleanup: true,
        authorization: {
          kind: 'passcode',
          passcode: historyAuthRequired ? historyPasscodeInput : '',
        },
      });
    } catch (error) {
      const errorText = describeProtectionArtifactWorkflowError(
        error,
        'CLEANUP_BLOCKED_HISTORY_FAILED',
      );
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setHistoryOperationBusy(false);
        setPendingEnableCommit(false);
        setHistoryStatus({ text: t('status.purge_failed'), detail: errorText, tone: 'error' });
      }
      return { ok: false, keptOpen: false, reason: errorText };
    }
    if (!resp?.success) {
      const errorCode = String(resp?.error || '');
      if (isWorkflowGenerationCurrent(workflowGeneration)) {
        setHistoryOperationBusy(false);
        setPendingEnableCommit(false);
        if (DESTRUCTIVE_AUTH_FAILURE_CODES.has(errorCode)) {
          setHistoryStatus({ text: t('status.auth_failed'), detail: '', tone: 'error' });
        } else {
          setHistoryStatus({
            text: t('status.purge_failed'),
            detail: errorCode || 'PURGE_FAILED',
            tone: 'error',
          });
        }
      }
      return { ok: false, keptOpen: false, reason: errorCode || 'PURGE_FAILED' };
    }

    const { items, total, domains } = summarizePreviewItems(resp?.items);
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setHistoryOperationBusy(false);
      setPendingEnableCommit(true);
      setHistoryStatus({
        text: total > 0 ? t('status.erased_records', { count: total }) : t('status.history_enabled_no_matches'),
        detail: total > 0
          ? t('status.history_done_detail', { domains })
          : t('status.history_enabled_no_matches_detail'),
        tone: 'success',
      });
    }
    if (total > 0 && isWorkflowGenerationCurrent(workflowGeneration)) {
      requestCeremony({
        ceremonyId: CEREMONY_IDS.MEMORY_PURGE_TIDE,
        source: 'dashboard_history_cleanup',
        metadata: { count: total, domains },
      });
    }
    if (isWorkflowGenerationCurrent(workflowGeneration)) {
      setHistoryPreview({ loading: false, items: [] });
      setHistoryAuthRequired(false);
      setHistoryPasscodeInput('');
    }
    return { ok: true, keptOpen: false, total, value: true };
  }, [
    captureWorkflowGeneration,
    historyAuthRequired,
    historyPasscodeInput,
    isWorkflowGenerationCurrent,
    t,
  ]);

  const handleHistoryCancel = useCallback(() => {
    setIsHistoryConfirmOpen(false);
    setHistoryPreview({ loading: false, items: [] });
    setHistoryAuthRequired(false);
    setHistoryPasscodeInput('');
    setHistoryStatus(EMPTY_STATUS);
    return { ok: true, cancelled: true };
  }, []);

  return {
    state: {
      historyStatus,
      historyCleanupEnabled: !!historyCleanupForBlocked || pendingEnableCommit,
    },
    historyPreview,
    historyAuthRequired,
    historyPasscodeInput,
    historyOperationBusy,
    isHistoryConfirmOpen,
    setHistoryPasscodeInput,
    handleHistoryCleanupToggle,
    handleHistoryConfirm,
    handleHistoryCancel,
  };
}

export default useProtectionBlockedHistoryControl;
