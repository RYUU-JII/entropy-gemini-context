import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactDisclosureSnapshot } from '../../artifacts/useArtifactDisclosureSnapshot.js';
import { useThemeId } from '../../stores/index.js';
import { buildArtifactNavigationItems } from './artifactNavigationItems.js';
import { resolveArtifactGallerySelectedArtifactId, resolveArtifactGallerySelectedIndex } from './artifactGallerySelectionState.js';
import {
  readArtifactGalleryPosition, resolveArtifactGalleryEntryArtifactId, writeArtifactGalleryPosition,
} from './artifactGalleryPositionState.js';
import { useStorageSupportVisibility } from './useStorageSupportVisibility.js';
import { preloadToolsSelectedArtifactController } from './selectedArtifactControllerResource.js';

const EMPTY_ARTIFACTS = Object.freeze([]);
const DISCLOSURE_REVALIDATE_FRESHNESS_MS = 30_000;

export function useToolsTabController(isActive = true) {
  const themeId = useThemeId();
  const { t } = useAppTranslation('tools');
  const storageSupportVisibility = useStorageSupportVisibility(isActive);
  const { snapshot: artifactDisclosureSnapshot, error: artifactDisclosureSnapshotError,
    loading: artifactDisclosureSnapshotLoading, refresh: refreshArtifactDisclosureSnapshot } = useArtifactDisclosureSnapshot({
    enabled: isActive, revalidateOnEnable: true, revalidateFreshnessMs: DISCLOSURE_REVALIDATE_FRESHNESS_MS,
  });
  // Opens where the viewer last stood on the path (UI-only page-local record).
  const [activeArtifactId, setActiveArtifactId] = useState(readArtifactGalleryPosition);
  const navigationItems = useMemo(() => buildArtifactNavigationItems(artifactDisclosureSnapshot, themeId, t),
    [artifactDisclosureSnapshot, themeId, t]);
  const selectedArtifactId = navigationItems.length
    ? navigationItems[resolveArtifactGallerySelectedIndex(navigationItems,
      resolveArtifactGalleryEntryArtifactId(artifactDisclosureSnapshot, activeArtifactId))].artifactId : '';
  const artifactPresentation = useMemo(() => ({ themeId, artifactDisclosureSnapshot, t }),
    [themeId, artifactDisclosureSnapshot, t]);
  useLayoutEffect(() => {
    if (isActive && selectedArtifactId) void preloadToolsSelectedArtifactController(selectedArtifactId).catch(() => undefined);
  }, [isActive, selectedArtifactId]);
  return {
    activeArtifactId, setActiveArtifactId, selectedArtifactId, navigationItems, artifactPresentation,
    artifactDisclosureSnapshot, artifactGalleryDisclosureSnapshot: artifactDisclosureSnapshot,
    artifactDisclosureSnapshotError, artifactDisclosureSnapshotLoading, refreshArtifactDisclosureSnapshot,
    isActive, t, ...storageSupportVisibility,
  };
}

export function useToolsArtifactGalleryModel(controller, selectedArtifactController = null) {
  const { selectedArtifactId, setActiveArtifactId, navigationItems, isActive } = controller;
  // Admission/removal of a headless family controller must not clear the
  // committed workspace between its mount and its before-paint publication.
  const committedRef = useRef(null);
  const retainedArtifactsRef = useRef(EMPTY_ARTIFACTS);
  const isPrepared = selectedArtifactController?.artifactId === selectedArtifactId
    && Boolean(selectedArtifactController.artifact);
  const committed = isPrepared ? selectedArtifactController : committedRef.current;
  useLayoutEffect(() => {
    if (isPrepared) committedRef.current = selectedArtifactController;
  }, [isPrepared, selectedArtifactController]);
  useEffect(() => {
    if (isActive && isPrepared) writeArtifactGalleryPosition(selectedArtifactId);
  }, [isActive, isPrepared, selectedArtifactId]);
  const activeArtifacts = useMemo(() => {
    if (!committed) return EMPTY_ARTIFACTS;
    if (!navigationItems.some((item) => item.artifactId === committed.artifactId)) {
      return retainedArtifactsRef.current;
    }
    // The committed card replaces its navigation shell, but the index label
    // (canonical function name) is a navigation fact the card does not carry.
    return navigationItems.map((item) => (item.artifactId === committed.artifactId
      ? { ...committed.artifact, navigationLabel: item.navigationLabel }
      : item));
  }, [navigationItems, committed?.artifact, committed?.artifactId]);
  useLayoutEffect(() => { if (isActive) retainedArtifactsRef.current = activeArtifacts; }, [activeArtifacts, isActive]);
  const artifacts = isActive ? activeArtifacts : retainedArtifactsRef.current;
  const selectedArtifactIndex = resolveArtifactGallerySelectedIndex(artifacts, committed?.artifactId);
  const isSelectedArtifactNavigationBlocked = committed?.navigationBlocked === true;
  const canSelectArtifactByIndex = useCallback((nextIndex) => {
    const nextId = resolveArtifactGallerySelectedArtifactId(artifacts, committed?.artifactId, nextIndex);
    return nextId === committed?.artifactId || !isSelectedArtifactNavigationBlocked;
  }, [artifacts, committed?.artifactId, isSelectedArtifactNavigationBlocked]);
  const selectArtifactByIndex = useCallback((nextIndex) => {
    if (!canSelectArtifactByIndex(nextIndex)) return false;
    setActiveArtifactId(resolveArtifactGallerySelectedArtifactId(artifacts, committed?.artifactId, nextIndex));
    return true;
  }, [artifacts, committed?.artifactId, canSelectArtifactByIndex, setActiveArtifactId]);
  return {
    artifacts, selectedArtifactIndex, selectArtifactByIndex, canSelectArtifactByIndex,
    isPreparingInitialArtifact: !committed && Boolean(selectedArtifactId),
  };
}

export default useToolsTabController;
