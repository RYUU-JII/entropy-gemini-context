import {
  readPageLocalJsonItem,
  writePageLocalJsonItem,
} from '@/platform/browser/pageLocalStorage.js';

// Where the viewer last stood on the artifact path. UI-only: it picks the
// artifact the gallery opens on and is never read as disclosure, progression
// or artifact configuration. Disclosure stays the background snapshot's call.
export const ARTIFACT_GALLERY_POSITION_STORAGE_KEY = 'dashboard.artifact_gallery_position.v1';

export function readArtifactGalleryPosition() {
  const record = readPageLocalJsonItem(ARTIFACT_GALLERY_POSITION_STORAGE_KEY, null);
  return typeof record?.artifactId === 'string' ? record.artifactId.trim() : '';
}

export function writeArtifactGalleryPosition(artifactId) {
  if (typeof artifactId !== 'string' || !artifactId.trim()) {
    throw new Error('ARTIFACT_GALLERY_POSITION_ID_REQUIRED');
  }
  return writePageLocalJsonItem(ARTIFACT_GALLERY_POSITION_STORAGE_KEY, { artifactId: artifactId.trim() });
}

// The artifact the gallery opens on: the remembered one when it is disclosed,
// otherwise the next disclosed artifact further along the canonical order
// (wrapping), as if the closed gate had been walked past. Without a remembered
// position the path starts at its first disclosed artifact.
export function resolveArtifactGalleryEntryArtifactId(snapshot, preferredArtifactId = '') {
  const { orderedFamilyIds, entriesByFamilyId } = snapshot;
  const startIndex = orderedFamilyIds.indexOf(preferredArtifactId);
  for (let step = 0; step < orderedFamilyIds.length; step += 1) {
    const familyId = orderedFamilyIds[(Math.max(0, startIndex) + step) % orderedFamilyIds.length];
    if (entriesByFamilyId[familyId].visible) return familyId;
  }
  return '';
}
