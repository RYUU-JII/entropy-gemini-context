import React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { UiButton } from '@/ui-kit/UiButton.jsx';
import {
  SETTINGS_COMMAND_CHANNELS,
  retrySettingsPropagation,
  useSettingsCommandChannelMap,
} from '../stores/settingsCommandBus.js';
import { SETTINGS_SYNC_STATUS } from '../stores/settingsSyncState.js';

const CHANNELS = Object.freeze([
  SETTINGS_COMMAND_CHANNELS.PROTOCOL,
  SETTINGS_COMMAND_CHANNELS.PREFERENCE,
  SETTINGS_COMMAND_CHANNELS.SECURITY,
  SETTINGS_COMMAND_CHANNELS.CLSE,
]);

export default function SettingsCommandFeedbackBridge({ channels = CHANNELS, includeSaveFailures = true } = {}) {
  if (typeof includeSaveFailures !== 'boolean') throw new Error('SETTINGS_COMMAND_FEEDBACK_SAVE_FAILURE_POLICY_INVALID');
  const { t } = useAppTranslation('common');
  const channelSync = useSettingsCommandChannelMap(useShallow((state) => Object.fromEntries(
    channels.map((channel) => [channel, state.channelSync[channel]]),
  )));

  const recoveryOperations = channels.flatMap((channel) => channelSync[channel].operations
    .filter((operation) => (includeSaveFailures && operation.status === SETTINGS_SYNC_STATUS.ERROR)
      || operation.status === SETTINGS_SYNC_STATUS.APPLY_ERROR
      || operation.status === SETTINGS_SYNC_STATUS.APPLYING)
    .map((operation) => ({ channel, operation })));
  if (recoveryOperations.length === 0) return null;
  const channelScopes = {
    [SETTINGS_COMMAND_CHANNELS.PROTOCOL]: t('feedback.settings.channels.protocol'),
    [SETTINGS_COMMAND_CHANNELS.PREFERENCE]: t('feedback.settings.channels.preference'),
    [SETTINGS_COMMAND_CHANNELS.SECURITY]: t('feedback.settings.channels.security'),
    [SETTINGS_COMMAND_CHANNELS.CLSE]: t('feedback.settings.channels.clse'),
  };
  return (
    <div data-settings-command-feedback className="max-h-[30%] shrink-0 overflow-y-auto border-b border-warning/40 bg-surface px-4 py-3 text-on-surface">
      {recoveryOperations.map(({ channel, operation }) => {
        const scope = channelScopes[channel];
        const applying = operation.status === SETTINGS_SYNC_STATUS.APPLYING;
        const saveFailed = operation.status === SETTINGS_SYNC_STATUS.ERROR;
        const registrationLimit = operation.siteRegistrationRejection;
        return (
          <div key={`${channel}:${operation.commandId}`} className="flex items-center gap-4 py-1" role="status" aria-busy={applying}
            data-settings-command-channel={channel} data-settings-command-status={operation.status}
            data-settings-command-id={operation.commandId} data-settings-command-task-id={operation.propagationTaskId}
            data-settings-command-commit-version={operation.lastAckVersion}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{registrationLimit
                ? t('popup.messages.registration_limit_reached', {
                  limit: registrationLimit.siteRegistrationBudget.limit, nextDay: registrationLimit.nextIncreaseDay,
                }) : applying
                ? t('feedback.settings.apply_failed.retrying')
                : t(saveFailed ? 'feedback.settings.failed.title' : 'feedback.settings.apply_failed.title', { scope })}</p>
              {!applying && !registrationLimit && <p className="mt-1 text-xs text-on-surface-muted">{t(saveFailed
                ? 'feedback.settings.failed.message'
                : 'feedback.settings.apply_failed.message')}</p>}
            </div>
            {!saveFailed && <UiButton
              data-settings-command-retry
              size="sm"
              disabled={applying}
              aria-label={t('feedback.settings.apply_failed.retry', { scope })}
              onClick={() => {
                // The bus retains any rejected retry as a visible operation.
                void retrySettingsPropagation(channel, operation.commandId).catch(() => undefined);
              }}
            >
              {applying ? t('feedback.settings.apply_failed.retrying') : t('dashboard.main_panel.retry')}
            </UiButton>}
          </div>
        );
      })}
    </div>
  );
}
