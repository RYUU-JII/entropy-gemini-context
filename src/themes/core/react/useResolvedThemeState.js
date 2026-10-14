import { useSyncExternalStore } from 'react';

import {
  getDefaultThemeId,
  getThemeDefinition,
  resolveThemeDefinitionId,
} from '@/themes/core/catalog.js';
import { getCurrentDocumentTheme } from '@/themes/core/documentTheme.js';
import { getThemeProfile } from '@/themes/core/profile.js';

const FALLBACK_THEME_ID = getDefaultThemeId();
let lastSnapshot = null;

function resolveThemeId(themeId) {
  return resolveThemeDefinitionId(themeId, FALLBACK_THEME_ID);
}

function getSnapshot() {
  const themeId = resolveThemeId(getCurrentDocumentTheme(FALLBACK_THEME_ID));
  if (lastSnapshot?.themeId === themeId) {
    return lastSnapshot;
  }
  lastSnapshot = {
    themeId,
    themeObject: getThemeDefinition(themeId),
    themeProfile: getThemeProfile(themeId),
  };
  return lastSnapshot;
}

function subscribe(onStoreChange) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener('themechange', onStoreChange);
  return () => window.removeEventListener('themechange', onStoreChange);
}

export function useResolvedThemeState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export default useResolvedThemeState;
