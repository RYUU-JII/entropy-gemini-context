import React from 'react';

import { DataLifecyclePanel } from '../components/DataLifecyclePanel.jsx';
import { SecurityPanel } from '../components/SecurityPanel.jsx';
import EncryptedBackupPanel from '../../../security/EncryptedBackupPanel.jsx';
import {
  SettingsLedger,
  SettingsLedgerColumns,
} from '../components/SettingsControlPrimitives.jsx';

export default function SettingsSafetySection({
  actionBusy,
  dataResultMessage,
  dataResultTone,
  hasPasscode,
  highSecurityMode,
  onDangerCancel,
  onDangerConfirm,
  onRemovePasscode,
  onResetAnalytics,
  onResetEverything,
  onSavePasscode,
  onToggleHighSecurityMode,
  onToggleResetGuard,
  pendingDangerAction,
  requirePasscode,
  requireResetPasscode,
  securityStatusMessage,
  isRuntimeActive,
}) {
  return (
    <SettingsLedger>
      <EncryptedBackupPanel hasPasscode={hasPasscode} kind="vault" isRuntimeActive={isRuntimeActive} />
      <SettingsLedgerColumns layout="safety">
        <SecurityPanel
          isRuntimeActive={isRuntimeActive}
          hasPasscode={hasPasscode}
          highSecurityMode={highSecurityMode}
          requireResetPasscode={requireResetPasscode}
          onSavePasscode={onSavePasscode}
          onRemovePasscode={onRemovePasscode}
          onToggleHighSecurityMode={onToggleHighSecurityMode}
          onToggleResetGuard={onToggleResetGuard}
          statusMessage={securityStatusMessage}
        />
        <EncryptedBackupPanel hasPasscode={hasPasscode} kind="backup" isRuntimeActive={isRuntimeActive} />
        <DataLifecyclePanel
          requirePasscode={requirePasscode}
          securityBlocked={highSecurityMode && !hasPasscode}
          onResetAnalytics={onResetAnalytics}
          onResetEverything={onResetEverything}
          actionBusy={actionBusy}
          pendingDangerAction={pendingDangerAction}
          onDangerConfirm={onDangerConfirm}
          onDangerCancel={onDangerCancel}
          resultMessage={dataResultMessage}
          resultTone={dataResultTone}
        />
      </SettingsLedgerColumns>
    </SettingsLedger>
  );
}
