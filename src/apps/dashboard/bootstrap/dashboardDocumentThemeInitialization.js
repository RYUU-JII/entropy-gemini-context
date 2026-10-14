import { DEFAULT_THEME_ID } from '../../../themes/core/ids.js';
import { initializeDocumentThemeForThemeId } from '../../../themes/core/documentTheme.js';
import { resolveDashboardBootThemeId } from './dashboardBootThemeContext.js';

export function initializeDashboardDocumentTheme() {
  const bootThemeId = resolveDashboardBootThemeId({
    fallbackThemeId: DEFAULT_THEME_ID,
  });
  initializeDocumentThemeForThemeId(bootThemeId, DEFAULT_THEME_ID);
  return bootThemeId;
}
