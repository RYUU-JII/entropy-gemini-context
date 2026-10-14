import React from 'react';

import ThemeBootScreen from './ThemeBootScreen.jsx';
import { getThemeBootPresentation } from './presentationCatalog.js';

function toDisplayName(themeId) {
  return String(themeId || '')
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

export function createThemeBootLoader(themeId) {
  const presentation = getThemeBootPresentation(themeId);

  function ThemeBootLoader() {
    return React.createElement(ThemeBootScreen, { presentation });
  }

  ThemeBootLoader.displayName = `${toDisplayName(themeId)}SoftBootLoader`;
  return ThemeBootLoader;
}

export default createThemeBootLoader;
