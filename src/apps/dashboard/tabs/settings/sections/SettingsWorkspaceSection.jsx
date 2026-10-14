import { ZenRenderQualityPanel } from '../components/ZenRenderQualityPanel.jsx';
import React from 'react';

import { AppChromePanel } from '../components/AppChromePanel.jsx';
import { LanguagePanel } from '../components/LanguagePanel.jsx';
import { NotificationsPanel } from '../components/NotificationsPanel.jsx';
import { DailyRhythmPanel } from '../components/DailyRhythmPanel.jsx';
import {
  SettingsLedger,
  SettingsLedgerColumns,
  SettingsDisclosure,
} from '../components/SettingsControlPrimitives.jsx';

export default function SettingsWorkspaceSection({
  isRuntimeActive,
  capabilityMessage,
  capabilityReady,
  notificationsConfig,
  notificationsStatusMessage,
  onSaveSolarLocation,
  onToggleNotificationsEnabled,
  solarLocationProfile,
  solarStatusMessage,
  t,
}) {
  return (
    <SettingsLedger>
      <DailyRhythmPanel isRuntimeActive={isRuntimeActive} />
      <SettingsLedgerColumns layout="workspace">
        <LanguagePanel
          solarLocationProfile={solarLocationProfile}
          onSaveSolarLocation={onSaveSolarLocation}
          solarStatusMessage={solarStatusMessage}
        />
        <NotificationsPanel
          t={t}
          notificationsConfig={notificationsConfig}
          onToggleEnabled={onToggleNotificationsEnabled}
          statusMessage={notificationsStatusMessage}
          capabilityReady={capabilityReady}
          capabilityMessage={capabilityMessage}
        />
      </SettingsLedgerColumns>
      <SettingsDisclosure title={t('recording.appearance_title')}>
        <AppChromePanel />
        <ZenRenderQualityPanel />
      </SettingsDisclosure>
    </SettingsLedger>
  );
}
