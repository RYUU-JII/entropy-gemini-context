import { SETTINGS_SYNC_STATUS } from '../stores/settingsSyncState.js';

function normalizeSyncStates(syncStates = []) {
  if (!Array.isArray(syncStates)) return [];
  return syncStates.filter((syncState) => !!syncState && typeof syncState === 'object');
}

export function resolveSettingsSyncNotice(syncStates = [], t) {
  const states = normalizeSyncStates(syncStates);
  if (states.length === 0) return null;

  const savingState = states.find((syncState) => syncState.status === SETTINGS_SYNC_STATUS.SAVING);
  if (savingState) {
    return {
      tone: 'saving',
      message: t('status.settings_sync_saving', { }),
      detail: null,
    };
  }

  const applyingState = states.find((syncState) => syncState.status === SETTINGS_SYNC_STATUS.APPLYING);
  if (applyingState) {
    return {
      tone: 'saving',
      message: t('status.settings_sync_applying', { }),
      detail: null,
    };
  }

  const dirtyState = states.find((syncState) => syncState.status === SETTINGS_SYNC_STATUS.DIRTY);
  if (dirtyState) {
    return {
      tone: 'saving',
      message: t('status.settings_sync_retrying', { }),
      detail: null,
    };
  }

  const errorState = states.find((syncState) => syncState.status === SETTINGS_SYNC_STATUS.ERROR);
  if (errorState) {
    // Final failures are emitted by the global app feedback overlay.
    // The settings surface keeps only in-progress sync state inline.
    return null;
  }


  const applyErrorState = states.find(
    (syncState) => syncState.status === SETTINGS_SYNC_STATUS.APPLY_ERROR,
  );
  if (applyErrorState) {
    // The commit succeeded; the global warning explains delayed tab application and retry.
    return null;
  }

  const syncedState = states.find((syncState) => syncState.status === SETTINGS_SYNC_STATUS.SYNCED);
  if (syncedState) {
    return null;
  }

  return null;
}
