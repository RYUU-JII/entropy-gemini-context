import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  SettingsActionButton, SettingsInlineTask, SettingsDisclosure, SettingsFeedback,
  SettingsGroup, SettingsRow, SettingsSwitch, SettingsTextInput,
} from './SettingsControlPrimitives.jsx';

function requireSecurityPanelHandler(handler, propName) {
  if (typeof handler !== 'function') throw new Error(`[SecurityPanel] Missing required handler "${propName}".`);
  return handler;
}

const PASSCODE_TASKS = Object.freeze({
  SET: 'set', CHANGE: 'change', REMOVE: 'remove',
  DISABLE_RESET_GUARD: 'disable_reset_guard', DISABLE_HIGH_SECURITY: 'disable_high_security',
});

export function SecurityPanel({
  hasPasscode, highSecurityMode = false, requireResetPasscode, onSavePasscode, onRemovePasscode,
  onToggleHighSecurityMode, onToggleResetGuard, statusMessage,
  isRuntimeActive = true,
}) {
  const { t } = useAppTranslation('settings');
  const [taskMode, setTaskMode] = useState(null);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [enableResetGuardAfterSave, setEnableResetGuardAfterSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localFailure, setLocalFailure] = useState('');
  const pending = useRef(false);
  const savePasscode = requireSecurityPanelHandler(onSavePasscode, 'onSavePasscode');
  const removePasscode = hasPasscode ? requireSecurityPanelHandler(onRemovePasscode, 'onRemovePasscode') : onRemovePasscode;
  const toggleHighSecurity = requireSecurityPanelHandler(onToggleHighSecurityMode, 'onToggleHighSecurityMode');
  const toggleResetGuard = requireSecurityPanelHandler(onToggleResetGuard, 'onToggleResetGuard');
  const effectiveResetGuard = hasPasscode && (requireResetPasscode || highSecurityMode);
  const closeTask = useCallback(() => {
    setTaskMode(null); setCurrentPasscode(''); setNewPasscode(''); setConfirmPasscode('');
    setEnableResetGuardAfterSave(false); setLocalFailure('');
  }, []);
  useEffect(() => { if (!isRuntimeActive) closeTask(); }, [closeTask, isRuntimeActive]);
  const openTask = (mode, enableResetGuard = false) => {
    if (pending.current || !isRuntimeActive) return;
    setCurrentPasscode(''); setNewPasscode(''); setConfirmPasscode(''); setLocalFailure('');
    setEnableResetGuardAfterSave(enableResetGuard); setTaskMode(mode);
  };
  const isPolicy = taskMode === PASSCODE_TASKS.DISABLE_RESET_GUARD || taskMode === PASSCODE_TASKS.DISABLE_HIGH_SECURITY;
  const isRemove = taskMode === PASSCODE_TASKS.REMOVE;
  const title = isPolicy ? t(taskMode === PASSCODE_TASKS.DISABLE_RESET_GUARD ? 'security.reset_guard' : 'security.lock_policy_title')
    : t(isRemove ? 'security.dialog.remove_title' : taskMode === PASSCODE_TASKS.CHANGE ? 'security.dialog.change_title' : 'security.dialog.set_title');
  const description = isPolicy ? t(taskMode === PASSCODE_TASKS.DISABLE_RESET_GUARD ? 'security.reset_guard_desc' : 'security.lock_policy_desc')
    : t(isRemove ? 'security.dialog.remove_desc' : taskMode === PASSCODE_TASKS.CHANGE ? 'security.dialog.change_desc' : 'security.dialog.set_desc');
  const submitDisabled = isRemove || isPolicy ? !currentPasscode : !newPasscode || !confirmPasscode || (hasPasscode && !currentPasscode);
  const submit = async (event) => {
    event.preventDefault();
    if (pending.current || submitDisabled || !isRuntimeActive) return;
    pending.current = true; setBusy(true); setLocalFailure('');
    try {
      if (isPolicy) {
        const handler = taskMode === PASSCODE_TASKS.DISABLE_RESET_GUARD ? toggleResetGuard : toggleHighSecurity;
        if (await handler(false, currentPasscode) !== false) closeTask();
      } else if (isRemove) {
        if (await removePasscode(currentPasscode) !== false) closeTask();
      } else if (await savePasscode(currentPasscode, newPasscode, confirmPasscode) !== false) {
        const enableGuard = enableResetGuardAfterSave;
        closeTask();
        if (enableGuard) await toggleResetGuard(true);
      }
    } catch (error) {
      setLocalFailure(error instanceof Error ? error.message : 'SECURITY_SETTINGS_ACTION_FAILED');
    } finally { pending.current = false; setBusy(false); }
  };
  const task = taskMode ? (
    <SettingsInlineTask title={title} description={description} tone={isRemove ? 'danger' : 'neutral'}
      busy={busy} onClose={closeTask} actions={<>
        <SettingsActionButton onClick={closeTask} disabled={busy}>{t('dialogs.cancel')}</SettingsActionButton>
        <SettingsActionButton type="submit" form="settings-passcode-form" tone={isRemove ? 'danger' : 'primary'}
          disabled={submitDisabled || busy}>
          {t(isPolicy ? 'dialogs.confirm' : isRemove ? 'security.remove_btn'
            : taskMode === PASSCODE_TASKS.CHANGE ? 'security.update_btn' : 'security.set_btn')}
        </SettingsActionButton>
      </>}>
      <form id="settings-passcode-form" className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        {hasPasscode ? <label className="text-sm sm:col-span-2">
          {t('security.current_passcode')}
          <SettingsTextInput type="password" autoComplete="current-password" disabled={busy} value={currentPasscode}
            onChange={(event) => setCurrentPasscode(event.target.value)} placeholder={t('security.placeholder_current')}
            data-settings-task-autofocus="true" />
        </label> : null}
        {!isRemove && !isPolicy ? <>
          <label className="text-sm">{t('security.new_passcode')}
            <SettingsTextInput type="password" autoComplete="new-password" disabled={busy} value={newPasscode}
              onChange={(event) => setNewPasscode(event.target.value)} placeholder={t('security.placeholder_min_chars')}
              data-settings-task-autofocus={!hasPasscode ? 'true' : undefined} />
          </label>
          <label className="text-sm">{t('security.confirm_passcode')}
            <SettingsTextInput type="password" autoComplete="new-password" disabled={busy} value={confirmPasscode}
              onChange={(event) => setConfirmPasscode(event.target.value)} placeholder={t('security.placeholder_repeat')} />
          </label>
        </> : null}
      </form>
      <SettingsFeedback message={localFailure || statusMessage} tone="danger" />
    </SettingsInlineTask>
  ) : null;
  return (
    <div className="contents">
      <SettingsGroup title={t('security.title')} description={t('security.desc')} bodyClassName="divide-y divide-border/25">
        <SettingsRow title={t(hasPasscode ? 'security.passcode_configured_title' : 'security.passcode_empty_title')}
          description={t(hasPasscode ? 'security.passcode_configured_desc' : 'security.passcode_empty_desc')}
          meta={t(hasPasscode ? 'security.passcode_set' : 'security.passcode_not_set')} contentClassName="flex flex-wrap gap-2">
          {hasPasscode ? <>
            <SettingsActionButton disabled={busy} onClick={() => openTask(PASSCODE_TASKS.CHANGE)}>{t('security.change_btn')}</SettingsActionButton>
            <SettingsActionButton tone="danger" disabled={highSecurityMode || busy} onClick={() => openTask(PASSCODE_TASKS.REMOVE)}>{t('security.remove_btn')}</SettingsActionButton>
          </> : <SettingsActionButton tone="primary" disabled={busy} onClick={() => openTask(PASSCODE_TASKS.SET)}>{t('security.set_btn')}</SettingsActionButton>}
        </SettingsRow>
        {!isPolicy ? task : null}
      </SettingsGroup>
      <SettingsDisclosure title={t('security.policy_title')}
        summary={t(highSecurityMode ? 'security.lock_policy_active' : effectiveResetGuard ? 'security.guard_active' : 'security.guard_disabled')}
        onOpenChange={(open) => { if (!open && isPolicy) closeTask(); }}>
        <SettingsRow title={t('security.reset_guard')} description={t('security.reset_guard_desc')}
          meta={t(!hasPasscode ? 'security.passcode_required_state' : effectiveResetGuard ? 'security.guard_active' : 'security.guard_disabled')}>
          <SettingsSwitch checked={effectiveResetGuard} disabled={highSecurityMode || busy}
            label={t(effectiveResetGuard ? 'security.guard_active' : 'security.guard_disabled')}
            onCheckedChange={(next) => {
              if (next && !hasPasscode) openTask(PASSCODE_TASKS.SET, true);
              else if (!next && hasPasscode) openTask(PASSCODE_TASKS.DISABLE_RESET_GUARD);
              else void toggleResetGuard(next);
            }} errorCode="SECURITY_PANEL_RESET_GUARD_HANDLER_REQUIRED" />
        </SettingsRow>
        {taskMode === PASSCODE_TASKS.DISABLE_RESET_GUARD ? task : null}
        <SettingsRow title={t('security.lock_policy_title')} description={t('security.lock_policy_desc')}
          meta={t(highSecurityMode ? 'security.lock_policy_active' : !hasPasscode ? 'security.passcode_required_state' : 'security.lock_policy_disabled')}>
          <SettingsSwitch checked={highSecurityMode} disabled={!hasPasscode || busy}
            label={t(highSecurityMode ? 'security.lock_policy_active' : 'security.lock_policy_disabled')}
            onCheckedChange={(next) => {
              if (!next && hasPasscode) openTask(PASSCODE_TASKS.DISABLE_HIGH_SECURITY);
              else void toggleHighSecurity(next);
            }} errorCode="SECURITY_PANEL_HIGH_SECURITY_HANDLER_REQUIRED" />
        </SettingsRow>
        {taskMode === PASSCODE_TASKS.DISABLE_HIGH_SECURITY ? task : null}
      </SettingsDisclosure>
      {!taskMode ? <SettingsFeedback message={localFailure || statusMessage} tone="danger" /> : null}
    </div>
  );
}

export default SecurityPanel;
