import React from 'react';
import JourneyNotificationsControl from '@/apps/dashboard/guidance/JourneyNotificationsControl.jsx';
import {
  SettingsFeedback,
  SettingsGroup,
  SettingsRow,
  SettingsSwitch,
} from './SettingsControlPrimitives.jsx';

function requireVisibleToggleHandler(handler) {
  if (typeof handler !== 'function') {
    throw new Error('NOTIFICATIONS_PANEL_MASTER_HANDLER_REQUIRED');
  }
  return handler;
}

export function NotificationsPanel({
  t,
  notificationsConfig,
  onToggleEnabled,
  statusMessage = '',
  capabilityReady = true,
  capabilityMessage = '',
}) {
  const notificationsEnabled = notificationsConfig?.enabled === true;
  const resolvedOnToggleEnabled = capabilityReady
    ? requireVisibleToggleHandler(onToggleEnabled)
    : null;
  const visibleStatusMessage = capabilityReady
    ? statusMessage
    : (statusMessage || capabilityMessage);

  return (
    <SettingsGroup
      title={t('settings_workspace.notifications.title')}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <SettingsRow
        title={t('settings_workspace.notifications.toggle_title')}
        description={t('settings_workspace.notifications.toggle_desc')}
        className="flex-1"
      >
        <SettingsSwitch
          checked={notificationsEnabled}
          onCheckedChange={resolvedOnToggleEnabled}
          disabled={!capabilityReady}
          label={t('settings_workspace.notifications.toggle_title')}
          errorCode="NOTIFICATIONS_PANEL_MASTER_HANDLER_REQUIRED"
        />
      </SettingsRow>

      <SettingsFeedback
        message={visibleStatusMessage}
        tone={capabilityReady ? 'danger' : 'warning'}
      />
      <JourneyNotificationsControl disabled={!capabilityReady} />
    </SettingsGroup>
  );
}

export default NotificationsPanel;
