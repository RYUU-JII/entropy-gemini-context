import React from 'react';

import { useSecurityStore } from '@/apps/dashboard/stores/useSecurityStore.js';
import StorageSupportPanel from './StorageSupportPanel.jsx';
import { useStorageSupportController } from '../useStorageSupportController.js';

export default function StorageSupportWorkspace({
  isActive = true,
  onClose = null,
}) {
  const getDestructiveActionAuthPolicy = useSecurityStore(
    (state) => state.getDestructiveActionAuthPolicy,
  );
  const {
    storageInspectorSnapshot,
    storageInspectorBusy,
    storageSupportActionBusy,
    storageSupportStatus,
    storageSupportAuthRequired,
    storageSupportPasscodeInput,
    setStorageSupportPasscodeInput,
    refreshStorageInspector,
    runStorageSupportAction,
  } = useStorageSupportController({
    isActive,
    enabled: true,
    getDestructiveActionAuthPolicy,
  });

  return (
    <StorageSupportPanel
      visible
      snapshot={storageInspectorSnapshot}
      inspectorBusy={storageInspectorBusy}
      actionBusy={storageSupportActionBusy}
      status={storageSupportStatus}
      requirePasscode={storageSupportAuthRequired}
      passcodeInput={storageSupportPasscodeInput}
      onPasscodeInputChange={setStorageSupportPasscodeInput}
      onRefresh={() => refreshStorageInspector({ showSuccessStatus: true })}
      onRunTask={runStorageSupportAction}
      onClose={onClose}
    />
  );
}
