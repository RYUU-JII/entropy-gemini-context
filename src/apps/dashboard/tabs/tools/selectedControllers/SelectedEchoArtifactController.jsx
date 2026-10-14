import { echoCardSchema } from '../artifactCards/schemas/echoCardSchema.js';
import { useSelectedArtifactCard } from './useSelectedArtifactCard.js';
import React, { useMemo } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useProtocolStore } from '@/apps/dashboard/stores/index.js';
import { useRuntimeParkedStoreSlice } from '@/apps/dashboard/hooks/useRuntimeParkedStoreSlice.js';
import { useProtectionBlockedHistoryControl } from '@/apps/dashboard/hooks/useProtectionBlockedHistoryControl.js';
import { useProtectionEchoArtifactControl } from '@/apps/dashboard/hooks/useProtectionEchoArtifactControl.js';
import { useProtectionArtifactsControlPlane } from '@/apps/dashboard/hooks/useProtectionArtifactsControlPlane.js';

const selectEchoProtocolSlice = (state) => ({
  historyCleanupForBlocked: state.historyCleanupForBlocked,
  setHistoryCleanupForBlocked: state.setHistoryCleanupForBlocked,
  concealBlockedBookmarks: state.concealBlockedBookmarks,
  setConcealBlockedBookmarks: state.setConcealBlockedBookmarks,
  tabEvaporationForBlocked: state.tabEvaporationForBlocked,
  setTabEvaporationForBlocked: state.setTabEvaporationForBlocked,
  tabEvaporationTimeoutMinutes: state.tabEvaporationTimeoutMinutes,
  setTabEvaporationConfig: state.setTabEvaporationConfig,
});

export default function SelectedEchoArtifactController({
  children,
  presentation,
  isActive = true,
}) {
  const { t } = useAppTranslation('tools');
  const {
    historyCleanupForBlocked,
    setHistoryCleanupForBlocked,
    concealBlockedBookmarks,
    setConcealBlockedBookmarks,
    tabEvaporationForBlocked,
    setTabEvaporationForBlocked,
    tabEvaporationTimeoutMinutes,
    setTabEvaporationConfig,
  } = useRuntimeParkedStoreSlice(
    useProtocolStore,
    selectEchoProtocolSlice,
    isActive,
  );
  const {
    state: historyState,
    historyPreview,
    historyAuthRequired,
    historyPasscodeInput,
    historyOperationBusy,
    isHistoryConfirmOpen,
    setHistoryPasscodeInput,
    handleHistoryCleanupToggle,
    handleHistoryConfirm: handleBlockedHistoryConfirm,
    handleHistoryCancel: handleBlockedHistoryCancel,
  } = useProtectionBlockedHistoryControl({
    historyCleanupForBlocked,
    isActive,
    setHistoryCleanupForBlocked,
    t,
  });
  const {
    artifactFamily,
    artifactFamilyHandlers,
    echoWorkflowState,
    bookmarkPreview,
    bookmarkBackupState,
    isBookmarkConfirmOpen,
    handleBookmarkConfirm,
    handleBookmarkCancel,
    handleBookmarkBackup,
    handleHistoryConfirm,
    handleHistoryCancel,
  } = useProtectionEchoArtifactControl({
    concealBlockedBookmarks,
    setConcealBlockedBookmarks,
    tabEvaporationForBlocked,
    setTabEvaporationForBlocked,
    tabEvaporationTimeoutMinutes,
    setTabEvaporationConfig,
    historyState,
    isHistoryConfirmOpen,
    handleHistoryConfirm: handleBlockedHistoryConfirm,
    handleHistoryCleanupToggle,
    handleHistoryCancel: handleBlockedHistoryCancel,
    isActive,
    t,
  });

  const navigationBlocked = echoWorkflowState.pendingConfirmation
    || isHistoryConfirmOpen
    || isBookmarkConfirmOpen
    || historyPreview.loading
    || bookmarkPreview.loading
    || bookmarkBackupState.loading
    || historyOperationBusy;

  const controller = useMemo(() => Object.freeze({
    artifactId: 'echo',
    artifactFamily,
    artifactFamilyHandlers,
    navigationBlocked,
    workflowState: echoWorkflowState,
    workflowReview: Object.freeze(isHistoryConfirmOpen ? {
      open: true,
      mode: 'history',
      preview: historyPreview,
      requirePasscode: historyAuthRequired,
      passcodeInput: historyPasscodeInput,
      backupState: null,
    } : (isBookmarkConfirmOpen ? {
      open: true,
      mode: 'bookmark_destroy',
      preview: bookmarkPreview,
      requirePasscode: false,
      passcodeInput: '',
      backupState: bookmarkBackupState,
    } : {
      open: false,
      mode: '',
      preview: null,
      requirePasscode: false,
      passcodeInput: '',
      backupState: null,
    })),
    workflowReviewHandlers: Object.freeze(isHistoryConfirmOpen ? {
      onPasscodeInputChange: setHistoryPasscodeInput,
      onBackupBookmarks: null,
      onConfirm: handleHistoryConfirm,
      onCancel: handleHistoryCancel,
    } : (isBookmarkConfirmOpen ? {
      onPasscodeInputChange: null,
      onBackupBookmarks: handleBookmarkBackup,
      onConfirm: handleBookmarkConfirm,
      onCancel: handleBookmarkCancel,
    } : {
      onPasscodeInputChange: null,
      onBackupBookmarks: null,
      onConfirm: null,
      onCancel: null,
    })),
  }), [
    artifactFamily,
    artifactFamilyHandlers,
    bookmarkBackupState,
    bookmarkPreview,
    echoWorkflowState,
    handleBookmarkBackup,
    handleBookmarkCancel,
    handleBookmarkConfirm,
    handleHistoryCancel,
    handleHistoryConfirm,
    historyAuthRequired,
    historyOperationBusy,
    historyPasscodeInput,
    historyPreview,
    isBookmarkConfirmOpen,
    isHistoryConfirmOpen,
    navigationBlocked,
    setHistoryPasscodeInput,
  ]);

  const selectedController = useProtectionArtifactsControlPlane(controller, isActive);

  const cardController = useSelectedArtifactCard(selectedController, presentation, isActive, echoCardSchema);

  if (typeof children !== 'function') {
    throw new Error('TOOLS_SELECTED_ARTIFACT_CONTROLLER_RENDER_REQUIRED:echo');
  }

  return children(cardController);
}
