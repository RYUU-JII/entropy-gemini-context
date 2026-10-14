export function getVisibleArtifactFamilyIds(snapshot) {
  return snapshot.orderedFamilyIds.filter((id) => snapshot.entriesByFamilyId[id].visible);
}

function normalizeArtifactSelectionId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveArtifactSelectionId(item = null) {
  const artifactId = normalizeArtifactSelectionId(item?.artifactId);
  if (artifactId) return artifactId;
  return normalizeArtifactSelectionId(item?.canonicalId);
}

function normalizeGalleryIndex(index, itemCount) {
  if (!itemCount) return 0;
  const parsedIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  return ((parsedIndex % itemCount) + itemCount) % itemCount;
}

export function resolveArtifactGallerySelectedIndex(items = [], selectedArtifactId = '') {
  const itemCount = Array.isArray(items) ? items.length : 0;
  if (!itemCount) return 0;

  const targetArtifactId = normalizeArtifactSelectionId(selectedArtifactId);
  if (!targetArtifactId) return 0;

  const matchedIndex = items.findIndex((item) => resolveArtifactSelectionId(item) === targetArtifactId);
  return matchedIndex >= 0 ? matchedIndex : 0;
}

export function resolveArtifactGallerySelectedArtifactId(items = [], selectedArtifactId = '', nextIndex = 0) {
  const itemCount = Array.isArray(items) ? items.length : 0;
  if (!itemCount) return '';

  const currentIndex = resolveArtifactGallerySelectedIndex(items, selectedArtifactId);
  const requestedIndex = typeof nextIndex === 'function' ? nextIndex(currentIndex) : nextIndex;
  const safeIndex = normalizeGalleryIndex(requestedIndex, itemCount);
  return resolveArtifactSelectionId(items[safeIndex]);
}
