import { DEFAULT_THEME_ID, normalizeThemeId } from '../../../themes/core/ids.js';
import { readThemePreferenceMirror } from '../../../themes/core/state/themePreferenceMirror.js';

/**
 * Resolve the startup shell theme from the synchronous preference mirror only.
 * The background prewarm snapshot does not exist when this first-paint seam runs.
 */
export function resolveDashboardBootShellThemeId({
  fallbackThemeId = DEFAULT_THEME_ID,
  storage,
} = {}) {
  return readThemePreferenceMirror(
    normalizeThemeId(fallbackThemeId, DEFAULT_THEME_ID),
    { storage },
  );
}
