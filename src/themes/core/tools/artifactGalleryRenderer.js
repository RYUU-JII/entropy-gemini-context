import { hasDeclaredThemeWidget } from '../surfaceDescriptor.js';
import { getToolsArtifactWidgetTypeByVisualKey } from './artifacts.js';

// A declared gallery renderer has one stable lifetime across artifact families.
// Standalone effect/ritual widgets retain their individual registry entries.
export function getArtifactGalleryWidgetType(themeId, visualKey) {
  const widgetType = getToolsArtifactWidgetTypeByVisualKey(visualKey);
  if (!widgetType) return '';
  return hasDeclaredThemeWidget(themeId, 'ArtifactGalleryVisual') ? 'ArtifactGalleryVisual' : widgetType;
}
