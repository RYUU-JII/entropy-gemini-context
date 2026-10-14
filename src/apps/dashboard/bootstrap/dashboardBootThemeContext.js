import { DEFAULT_THEME_ID } from '../../../themes/core/ids.js';
import { resolveBootPrewarmSection } from './bootPrewarmSnapshot.js';
import { resolveDashboardBootShellThemeId } from './dashboardBootShellThemeContext.js';

export { resolveDashboardBootShellThemeId } from './dashboardBootShellThemeContext.js';

export function resolveDashboardThemeLaunchHint({
  prewarmSnapshot = null,
  fallbackThemeId = DEFAULT_THEME_ID,
  storage,
} = {}) {
  const prewarmPreference = resolveBootPrewarmSection({ prewarmSnapshot }, 'preference');
  if (prewarmPreference) {
    return prewarmPreference.themeId;
  }

  return resolveDashboardBootShellThemeId({ fallbackThemeId, storage });
}

export function resolveDashboardBootThemeId(options = {}) {
  return resolveDashboardThemeLaunchHint(options);
}
