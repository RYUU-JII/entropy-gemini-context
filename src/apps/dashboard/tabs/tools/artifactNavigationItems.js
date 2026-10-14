import { getToolsArtifactDefinition } from '@/themes/core/tools/artifacts.js';
import { getCanonicalArtifactDefinition } from '@/domains/protection/catalog/artifactFamilyCatalog.js';
import { buildToolsArtifactDisplayCopy } from './artifactDisplayCopy.js';
import { getVisibleArtifactFamilyIds } from './artifactGallerySelectionState.js';

export function buildArtifactNavigationItems(snapshot, themeId, t) {
  if (!snapshot) return [];
  return getVisibleArtifactFamilyIds(snapshot).map((artifactId) => {
    const definition = getToolsArtifactDefinition(artifactId);
    const canonical = getCanonicalArtifactDefinition(artifactId);
    if (!definition || !canonical) throw new Error(`ARTIFACT_NAVIGATION_ID_INVALID:${artifactId}`);
    const shell = {
      artifactId, canonicalId: artifactId, themeId,
      visualKey: definition.visualKey, manifestationKey: definition.manifestationKey,
      artifactTitleKey: canonical.titleKey, artifactDescriptionKey: canonical.descriptionKey,
    };
    // The index names what an artifact does, not what it is: the theme title
    // ("백야의 포식자") is the panel's marquee, the canonical base title
    // ("패턴 차단") is how someone looking for a function finds it.
    // Resolved like the rest of the display copy: an unloaded string stays empty
    // and the index shows the display title until the namespace arrives.
    const baseTitle = t(canonical.titleKey);
    const navigationLabel = typeof baseTitle === 'string' && baseTitle !== canonical.titleKey
      ? baseTitle.trim() : '';
    return { ...shell, ...buildToolsArtifactDisplayCopy(shell, t), navigationLabel };
  });
}
