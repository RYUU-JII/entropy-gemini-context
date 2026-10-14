import React, { useCallback, useEffect, useState } from 'react';
import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  SettingsActionButton, SettingsInlineTask, SettingsFeedback,
  SettingsGroup, SettingsRow, SettingsTextInput,
} from './SettingsControlPrimitives.jsx';

function requireDataLifecycleHandler(handler, propName) {
  if (typeof handler !== 'function') throw new Error(`[DataLifecyclePanel] Missing required handler "${propName}".`);
  return handler;
}

export function DataLifecyclePanel({
  requirePasscode, securityBlocked = false, onResetAnalytics, onResetEverything,
  actionBusy, resultMessage, resultTone = 'neutral', pendingDangerAction, onDangerConfirm, onDangerCancel,
}) {
  const { t } = useAppTranslation('settings');
  const [passcodeInput, setPasscodeInput] = useState('');
  const isPendingDanger = Boolean(pendingDangerAction);
  const controlsDisabled = Boolean(actionBusy || isPendingDanger || securityBlocked);
  const resetAnalyticsHandler = requireDataLifecycleHandler(onResetAnalytics, 'onResetAnalytics');
  const resetEverythingHandler = requireDataLifecycleHandler(onResetEverything, 'onResetEverything');
  const dangerConfirmHandler = isPendingDanger ? requireDataLifecycleHandler(onDangerConfirm, 'onDangerConfirm') : onDangerConfirm;
  const dangerCancelHandler = isPendingDanger ? requireDataLifecycleHandler(onDangerCancel, 'onDangerCancel') : onDangerCancel;
  useEffect(() => { setPasscodeInput(''); }, [pendingDangerAction?.action]);
  const handleDangerCancel = useCallback(() => {
    setPasscodeInput('');
    dangerCancelHandler();
  }, [dangerCancelHandler]);
  const actions = [
    { key: MESSAGE_ACTIONS.RESET_ANALYTICS_DATA, title: t('data.analytics_title'), description: t('data.analytics_desc'),
      label: t('data.clear_history'), request: resetAnalyticsHandler, tone: 'neutral' },
    { key: MESSAGE_ACTIONS.RESET_APP_DATA, title: t('data.factory_reset_title'), description: t('data.factory_reset_desc'),
      label: t('data.reset_everything'), request: resetEverythingHandler, tone: 'danger' },
  ];
  return (
    <SettingsGroup title={t('data.title')} description={t('data.desc')}
      bodyClassName="divide-y divide-border/25">
      {securityBlocked ? <SettingsFeedback message={t('data.security_blocked_desc')} tone="danger" /> : null}
      {actions.map((action) => (
        <div key={action.key}>
          <SettingsRow title={action.title} description={action.description} tone={action.tone}>
            <SettingsActionButton tone={action.tone} onClick={() => action.request()} disabled={controlsDisabled}>
              {action.label}
            </SettingsActionButton>
          </SettingsRow>
          {pendingDangerAction?.action === action.key ? (
            <SettingsInlineTask title={pendingDangerAction.title} description={pendingDangerAction.message}
              tone="danger" busy={actionBusy} onClose={handleDangerCancel}
              actions={<>
                <SettingsActionButton onClick={handleDangerCancel} disabled={actionBusy}>{t('dialogs.cancel')}</SettingsActionButton>
                <SettingsActionButton tone="danger" type="submit" form="settings-data-lifecycle-form"
                  disabled={Boolean(actionBusy || (requirePasscode && !passcodeInput))}>
                  {pendingDangerAction.confirmLabel || t('dialogs.confirm')}
                </SettingsActionButton>
              </>}>
              <form id="settings-data-lifecycle-form" onSubmit={(event) => {
                event.preventDefault();
                if (!actionBusy && (!requirePasscode || passcodeInput)) dangerConfirmHandler(passcodeInput);
              }}>
                {requirePasscode ? <>
                  <label className="block text-sm">
                    {t('data.auth_passcode')}
                    <SettingsTextInput type="password" autoComplete="current-password" value={passcodeInput}
                      onChange={(event) => setPasscodeInput(event.target.value)} placeholder={t('data.passcode_placeholder')}
                      disabled={actionBusy} data-settings-task-autofocus="true" />
                  </label>
                  <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">{t('data.passcode_dialog_hint')}</p>
                </> : null}
              </form>
              <SettingsFeedback message={resultMessage} tone={resultTone} />
            </SettingsInlineTask>
          ) : null}
        </div>
      ))}
      {!isPendingDanger ? <SettingsFeedback message={resultMessage} tone={resultTone} /> : null}
    </SettingsGroup>
  );
}

export default DataLifecyclePanel;
