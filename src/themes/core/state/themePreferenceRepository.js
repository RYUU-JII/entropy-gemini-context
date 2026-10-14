import { readThemePreferenceSettingsSnapshot } from '../../../platform/storage/settings/ThemePreferenceSettingsQueryService.js';
import { STORAGE_LOCAL_DOC_KEYS } from '../../../platform/storage/settings/SettingsDocumentRepository.js';
import {
  addChromeStorageChangedListener,
  removeChromeStorageChangedListener,
} from '../../../platform/storage/internal/chrome-storage/storageChangeBus.js';
import { DEFAULT_THEME_ID, normalizeThemeId } from '../ids.js';
import {
  THEME_PREFERENCE_STORAGE_KEY,
  readThemePreferenceMirrorCandidate as readCanonicalThemePreferenceMirrorCandidate,
  resolveThemePreferenceMirrorCandidate,
  writeThemePreferenceMirror as writeCanonicalThemePreferenceMirror,
} from './themePreferenceMirror.js';

export { THEME_PREFERENCE_STORAGE_KEY };

export const THEME_PREFERENCE_SETTINGS_QUERY = Object.freeze({
  [THEME_PREFERENCE_STORAGE_KEY]: null,
});

const FALLBACK_THEME_ID = DEFAULT_THEME_ID;

function getDocumentRef() {
  return typeof document === 'undefined' ? null : document;
}

function getWindowRef() {
  return typeof window === 'undefined' ? null : window;
}

function readThemeIdFromNode(node) {
  if (!node) return '';
  const dataTheme = node.dataset?.theme;
  if (typeof dataTheme === 'string' && dataTheme.trim()) {
    return dataTheme;
  }
  if (typeof node.getAttribute === 'function') {
    const attrTheme = node.getAttribute('data-theme');
    if (typeof attrTheme === 'string' && attrTheme.trim()) {
      return attrTheme;
    }
  }
  return '';
}

function getCustomEventCtor() {
  if (typeof CustomEvent === 'function') return CustomEvent;
  const windowRef = getWindowRef();
  return typeof windowRef?.CustomEvent === 'function' ? windowRef.CustomEvent : null;
}

function resolveFallbackThemeId(fallback = FALLBACK_THEME_ID) {
  return normalizeThemeId(fallback, FALLBACK_THEME_ID);
}

export function resolveKnownThemeId(themeId, fallback = FALLBACK_THEME_ID) {
  const resolvedFallback = resolveFallbackThemeId(fallback);
  return normalizeThemeId(themeId, resolvedFallback);
}

export function resolveCandidateThemeId(themeId) {
  const normalizedThemeId = resolveThemePreferenceMirrorCandidate(themeId);
  return normalizedThemeId || null;
}

export function readDocumentThemePreference() {
  const documentRef = getDocumentRef();
  if (!documentRef) return null;
  const candidateThemeId = readThemeIdFromNode(documentRef.documentElement)
    || readThemeIdFromNode(documentRef.body);
  return resolveCandidateThemeId(candidateThemeId);
}

export function getCurrentThemePreference(fallback = FALLBACK_THEME_ID) {
  return readDocumentThemePreference() || resolveKnownThemeId(fallback);
}

export function readThemePreferenceMirrorCandidate({ storage } = {}) {
  return resolveCandidateThemeId(readCanonicalThemePreferenceMirrorCandidate({ storage }));
}

export function readThemePreferenceMirror(fallback = FALLBACK_THEME_ID, options = {}) {
  return readThemePreferenceMirrorCandidate(options) || resolveKnownThemeId(fallback);
}

export function resolveThemePreferenceMirrorStorageEvent(event) {
  const eventKey = typeof event?.key === 'string' ? event.key.trim() : '';
  if (eventKey && eventKey !== THEME_PREFERENCE_STORAGE_KEY) {
    return {
      matches: false,
      themeId: null,
    };
  }

  return {
    matches: true,
    themeId: resolveCandidateThemeId(event?.newValue),
  };
}

export function writeThemePreferenceMirror(themeId, fallback = FALLBACK_THEME_ID) {
  return writeCanonicalThemePreferenceMirror(themeId, fallback);
}

export function dispatchThemePreferenceChange(themeId, fallback = FALLBACK_THEME_ID) {
  const resolvedThemeId = resolveKnownThemeId(themeId, fallback);
  const windowRef = getWindowRef();
  const CustomEventCtor = getCustomEventCtor();
  if (!windowRef || typeof windowRef.dispatchEvent !== 'function' || !CustomEventCtor) {
    return resolvedThemeId;
  }
  windowRef.dispatchEvent(
    new CustomEventCtor('themechange', { detail: { theme: resolvedThemeId } }),
  );
  return resolvedThemeId;
}

export async function readStoredThemePreferenceCandidate({
  readSettings = readThemePreferenceSettingsSnapshot,
} = {}) {
  const readThemeSettings = typeof readSettings === 'function'
    ? readSettings
    : readThemePreferenceSettingsSnapshot;
  const settings = await readThemeSettings(THEME_PREFERENCE_SETTINGS_QUERY);
  return readStoredThemePreferenceCandidateFromSnapshot(settings);
}

export function readStoredThemePreferenceCandidateFromSnapshot(settingsSnapshot) {
  return resolveCandidateThemeId(settingsSnapshot?.[THEME_PREFERENCE_STORAGE_KEY]);
}

export async function readStoredThemePreference(
  fallback = FALLBACK_THEME_ID,
  options = {},
) {
  const storedThemeId = await readStoredThemePreferenceCandidate(options);
  return storedThemeId || resolveKnownThemeId(fallback);
}

export function readStoredThemePreferenceFromSnapshot(
  settingsSnapshot,
  fallback = FALLBACK_THEME_ID,
) {
  return readStoredThemePreferenceCandidateFromSnapshot(settingsSnapshot)
    || resolveKnownThemeId(fallback);
}

function readThemePreferenceFromUiDocument(documentValue) {
  if (!documentValue || typeof documentValue !== 'object' || Array.isArray(documentValue)) {
    return null;
  }
  return readStoredThemePreferenceCandidateFromSnapshot(documentValue);
}

export function subscribeStoredThemePreference(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  const handleStorageChange = (changes = {}, areaName) => {
    if (areaName && areaName !== 'local') return;

    const uiDocumentChange = changes?.[STORAGE_LOCAL_DOC_KEYS.UI];
    const nextThemeId = uiDocumentChange
      ? readThemePreferenceFromUiDocument(uiDocumentChange.newValue)
      : null;
    const previousThemeId = uiDocumentChange
      ? readThemePreferenceFromUiDocument(uiDocumentChange.oldValue)
      : null;

    if (nextThemeId || previousThemeId) {
      listener(nextThemeId, {
        previousThemeId,
        source: STORAGE_LOCAL_DOC_KEYS.UI,
      });
    }
  };

  if (!addChromeStorageChangedListener(handleStorageChange)) {
    return () => {};
  }
  return () => {
    removeChromeStorageChangedListener(handleStorageChange);
  };
}

export function resolveRuntimeThemeIdSync(fallback = FALLBACK_THEME_ID) {
  return readDocumentThemePreference() || resolveKnownThemeId(fallback);
}

export async function resolveRuntimeThemeId(fallback = FALLBACK_THEME_ID, options = {}) {
  const documentThemeId = readDocumentThemePreference();
  if (documentThemeId) return documentThemeId;
  return readStoredThemePreference(fallback, options);
}
