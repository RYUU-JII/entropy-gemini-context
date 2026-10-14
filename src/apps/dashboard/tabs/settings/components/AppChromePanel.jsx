import React, { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { usePreferenceStore } from '../../../stores/index.js';
import {
  SIDEBAR_DISPLAY_MODES,
  normalizeSidebarDisplayMode,
} from '../../../../../domains/settings/config/sidebarDisplayMode.js';
import {
  SettingsChoiceGroup,
  SettingsFeedback,
  SettingsGroup,
} from './SettingsControlPrimitives.jsx';

function describeAppChromeActionError(error, fallbackCode) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const message = String(error || '').trim();
  return message || fallbackCode;
}

export function AppChromePanel() {
  const { t } = useAppTranslation('settings');
  const { sidebarDisplayMode, setSidebarDisplayMode } = usePreferenceStore(useShallow((state) => ({
    sidebarDisplayMode: normalizeSidebarDisplayMode(state.sidebarDisplayMode),
    setSidebarDisplayMode: state.setSidebarDisplayMode,
  })));
  const [statusMessage, setStatusMessage] = useState('');

  const handleSidebarDisplayModeChange = useCallback(async (nextMode) => {
    try {
      await setSidebarDisplayMode(nextMode);
      setStatusMessage('');
    } catch (error) {
      setStatusMessage(describeAppChromeActionError(error, 'SETTINGS_APP_CHROME_SAVE_FAILED'));
    }
  }, [setSidebarDisplayMode]);

  return (
    <SettingsGroup
      title={t('app_chrome.title')}
      className="h-full min-h-0"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <SettingsChoiceGroup
        label={t('app_chrome.title')}
        value={sidebarDisplayMode}
        onValueChange={handleSidebarDisplayModeChange}
        className="flex-1"
        options={[
          {
            id: SIDEBAR_DISPLAY_MODES.EXPANDED,
            label: t('app_chrome.expanded_label'),
            description: t('app_chrome.expanded_desc'),
          },
          {
            id: SIDEBAR_DISPLAY_MODES.ICONS,
            label: t('app_chrome.icons_label'),
            description: t('app_chrome.icons_desc'),
          },
        ]}
      />
      <SettingsFeedback message={statusMessage} tone="danger" />
    </SettingsGroup>
  );
}

export default AppChromePanel;
