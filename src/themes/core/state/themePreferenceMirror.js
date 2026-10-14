import { DEFAULT_THEME_ID, normalizeThemeId } from '../ids.js';

export const THEME_PREFERENCE_STORAGE_KEY = 'app-theme';

function getLocalStorageRef() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch (_error) {
    return null;
  }
}

function resolveMirrorStorage(storage) {
  if (
    storage
    && (
      typeof storage.getItem === 'function'
      || typeof storage.setItem === 'function'
    )
  ) {
    return storage;
  }
  return getLocalStorageRef();
}

export function resolveThemePreferenceMirrorCandidate(themeId) {
  const normalizedThemeId = normalizeThemeId(themeId, '');
  return normalizedThemeId || null;
}

export function readThemePreferenceMirrorCandidate({ storage } = {}) {
  const storageRef = resolveMirrorStorage(storage);
  if (!storageRef?.getItem) return null;
  try {
    return resolveThemePreferenceMirrorCandidate(
      storageRef.getItem(THEME_PREFERENCE_STORAGE_KEY),
    );
  } catch (_error) {
    return null;
  }
}

export function readThemePreferenceMirror(fallback = DEFAULT_THEME_ID, options = {}) {
  return readThemePreferenceMirrorCandidate(options)
    || normalizeThemeId(fallback, DEFAULT_THEME_ID);
}

export function writeThemePreferenceMirror(themeId, fallback = DEFAULT_THEME_ID, options = {}) {
  const resolvedThemeId = normalizeThemeId(
    themeId,
    normalizeThemeId(fallback, DEFAULT_THEME_ID),
  );
  const storageRef = resolveMirrorStorage(options.storage);
  if (!storageRef?.setItem) return resolvedThemeId;
  try {
    storageRef.setItem(THEME_PREFERENCE_STORAGE_KEY, resolvedThemeId);
  } catch (_error) {
    // localStorage is an optional page-local mirror only.
  }
  return resolvedThemeId;
}
