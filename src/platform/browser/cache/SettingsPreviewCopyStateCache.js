import {
  readPageLocalJsonItem,
  writePageLocalJsonItem,
} from '../pageLocalStorage.js';

export const SETTINGS_PREVIEW_COPY_STATE_STORAGE_KEY = 'entropy_preview_copy_state_v1';

export function readSettingsPreviewCopyStateCache() {
  return readPageLocalJsonItem(SETTINGS_PREVIEW_COPY_STATE_STORAGE_KEY, null);
}

export function writeSettingsPreviewCopyStateCache(state) {
  return writePageLocalJsonItem(SETTINGS_PREVIEW_COPY_STATE_STORAGE_KEY, state);
}

