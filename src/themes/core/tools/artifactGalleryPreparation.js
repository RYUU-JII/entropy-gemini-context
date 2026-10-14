import { assertCanonicalThemeId, THEME_IDS } from '../ids.js';

// Gallery-specific module preparation; standalone themes have no additional
// runtime beyond their registry widget. Rendering/resource lifetime stays local.
const PREPARERS = Object.freeze({
  [THEME_IDS.MATRIX]: null,
  [THEME_IDS.ENTROPY]: null,
  [THEME_IDS.CYBERPUNK]: null,
  [THEME_IDS.CLINICAL]: null,
  [THEME_IDS.SCP]: null,
  [THEME_IDS.ZEN]: async visualKey => {
    const { preloadZenArtifactGalleryModules } = await import('../../plugins/zen/presentation/artifacts/engine/zenArtifactModules.js');
    await preloadZenArtifactGalleryModules(visualKey);
  },
});

export async function preloadArtifactGalleryRuntime(themeId, visualKey = null) {
  const id = assertCanonicalThemeId(themeId, 'artifact gallery preparation');
  const prepare = PREPARERS[id];
  if (prepare === null) return Object.freeze({ themeId: id, status: 'not_declared' });
  if (typeof prepare !== 'function') throw new Error('ARTIFACT_GALLERY_PREPARATION_OWNER_MISSING');
  await prepare(visualKey);
  return Object.freeze({ themeId: id, status: 'ready' });
}
