export const SIDEBAR_DISPLAY_MODE_STORAGE_KEY = 'sidebarDisplayMode';

export const SIDEBAR_DISPLAY_MODES = Object.freeze({
  EXPANDED: 'expanded',
  ICONS: 'icons',
});

export const DEFAULT_SIDEBAR_DISPLAY_MODE = SIDEBAR_DISPLAY_MODES.EXPANDED;

export function normalizeSidebarDisplayMode(value, fallback = DEFAULT_SIDEBAR_DISPLAY_MODE) {
  const normalizedFallback = Object.values(SIDEBAR_DISPLAY_MODES).includes(fallback)
    ? fallback
    : DEFAULT_SIDEBAR_DISPLAY_MODE;
  return Object.values(SIDEBAR_DISPLAY_MODES).includes(value) ? value : normalizedFallback;
}

export function isIconSidebarDisplayMode(value) {
  return normalizeSidebarDisplayMode(value) === SIDEBAR_DISPLAY_MODES.ICONS;
}
