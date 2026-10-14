import { getThemeProfile } from '@/themes/core/profile.js';

// The gallery index is declared per theme through `profile.tools.galleryIndexVariant`.
//
// - quickbar: named tiles in their own band below the scene. The scene box
//   ends where the band begins, so nothing needs reserving. Any artifact can be
//   selected directly.
// - path: the gallery is a walked path. Only the neighbouring artifacts are
//   reachable (previous/next, wrapping at the ends). There is no visible position
//   index or bottom reserve; the artifact owns the full scene. The control panel
//   carries its name and ordinal, while the path announces selection accessibly.
//
// `navigation` declares how the gallery may be moved: 'direct' admits any index
// (including Home/End), 'sequential' admits one step at a time.
const ARTIFACT_GALLERY_INDEX_LAYOUTS = Object.freeze({
  quickbar: Object.freeze({ variant: 'quickbar', navigation: 'direct', sceneReserveBottomPx: 0 }),
  path: Object.freeze({ variant: 'path', navigation: 'sequential', sceneReserveBottomPx: 0 }),
});

export function resolveArtifactGalleryIndexLayout(themeId) {
  const variant = getThemeProfile(themeId).tools.galleryIndexVariant;
  const layout = ARTIFACT_GALLERY_INDEX_LAYOUTS[variant];
  if (!layout) {
    throw new Error(
      `[ArtifactGalleryIndex] Theme "${themeId}" declares unknown gallery index variant "${String(variant)}".`,
    );
  }
  return layout;
}
