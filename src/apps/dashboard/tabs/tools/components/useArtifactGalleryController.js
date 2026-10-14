import { useEffect, useLayoutEffect, useMemo, useState, useCallback, useRef } from 'react';

import { useResizeObserver } from '@/ui-kit/hooks/useResizeObserver.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  getThemeWidget,
  getThemeWidgetChunkState,
  preloadThemeWidgetChunk,
} from '@/themes/core/registry/index.js';
import { getToolsVisualPolicy } from '@/themes/core/toolsVisualPolicy.js';
import { hasDeclaredThemeWidget } from '@/themes/core/surfaceDescriptor.js';
import { getArtifactColorTokens } from '@/themes/core/tools/artifactColorSystem.js';
import { getArtifactGalleryWidgetType } from '@/themes/core/tools/artifactGalleryRenderer.js';
import { preloadArtifactGalleryRuntime } from '@/themes/core/tools/artifactGalleryPreparation.js';
import { resolveArtifactPreviewRenderState } from '@/themes/core/tools/artifactPresentation.js';
import { useThemeAmbientPresentation } from '@/themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { useAnalysisStore, useThemeId } from '../../../stores/index.js';
import { useRuntimeParkedStoreSlice } from '../../../hooks/useRuntimeParkedStoreSlice.js';
import ArtifactPanel from './ArtifactPanel.jsx';
import DefaultArtifactCanvas from './DefaultArtifactCanvas.jsx';
import { normalizeArtifactGallerySceneSpec } from './sceneRuntime.js';
import { resolveArtifactGalleryIndexLayout } from './artifactGalleryIndexLayout.js';

const WARNED_ARTIFACT_PRELOAD_KEYS = new Set();
const EMPTY_ARTIFACT_FAMILY_IDS = Object.freeze([]);
const DEFAULT_CAN_SELECT_ARTIFACT_INDEX = () => true;
const DEFAULT_ARTIFACT_CONTROLLER_READY = () => true;
const DEFAULT_PRELOAD_ARTIFACT_CONTROLLER = (artifactId) => Promise.resolve(Object.freeze({
  artifactId,
  loaded: true,
  required: false,
}));
const DEFAULT_RETRY_ARTIFACT_CONTROLLER = DEFAULT_PRELOAD_ARTIFACT_CONTROLLER;
const IDLE_ARTIFACT_SELECTION_REQUEST = Object.freeze({
  phase: 'idle',
  pendingIndex: null,
  errorIndex: null,
  errorMessage: '',
});
const selectArtifactGalleryAnalysisSlice = (state) => ({
  cycleState: state.cycleState,
});

function buildArtifactIdentityKey({ safeIndex, canonicalId, visualKey }) {
  return `${safeIndex}:${canonicalId || visualKey || `idx_${safeIndex}`}`;
}

function isTypingTarget(target) {
  if (!target) return false;
  const el = target;
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === 'function' && el.closest('[contenteditable="true"]')) return true;
  return false;
}

function normalizeGalleryIndex(index, itemCount) {
  if (!itemCount) return 0;
  const parsedIndex = Number.isFinite(index) ? index : 0;
  return ((parsedIndex % itemCount) + itemCount) % itemCount;
}

function resolveArtifactWidgetType(item, themeId) {
  const visualKey = typeof item?.visualKey === 'string' && item.visualKey
    ? item.visualKey
    : item?.canonicalId;
  return getArtifactGalleryWidgetType(themeId, visualKey);
}

function warnArtifactPreloadFailureOnce(themeId, widgetType, error) {
  const key = `${themeId}:${widgetType}`;
  if (WARNED_ARTIFACT_PRELOAD_KEYS.has(key)) return;
  WARNED_ARTIFACT_PRELOAD_KEYS.add(key);
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  console.warn(`[ArtifactGallery] Failed to preload artifact widget "${key}".`, error);
}

function createArtifactWidgetTypeMissingError(item, index) {
  const identity = item?.canonicalId || item?.visualKey || `index_${index}`;
  return new Error(`ARTIFACT_WIDGET_TYPE_MISSING:${identity}`);
}

function requireDeclaredArtifactWorkspaceWidget(themeId, widgetType) {
  const Widget = getThemeWidget(themeId, widgetType);
  if (!Widget) {
    throw new Error(`ARTIFACT_WORKSPACE_WIDGET_MISSING:${themeId}:${widgetType}`);
  }
  return Widget;
}

function buildStableRendererFx(rendererFx) {
  const source = rendererFx && typeof rendererFx === 'object' ? rendererFx : {};
  const rotateYSource = source.rotateY && typeof source.rotateY === 'object'
    ? source.rotateY
    : {};

  return {
    ...source,
    activeScale: 1,
    inactiveScale: 1,
    entryScale: 1,
    entryReveal: false,
    rotateY: {
      ...rotateYSource,
      enabled: false,
      amplitude: 0,
    },
  };
}

export function useArtifactGalleryController({
  items = [],
  artifactDisclosureSnapshot = null,
  selectedArtifactIndex = 0,
  onSelectArtifactIndex,
  canSelectArtifactIndex = DEFAULT_CAN_SELECT_ARTIFACT_INDEX,
  isArtifactControllerReady = DEFAULT_ARTIFACT_CONTROLLER_READY,
  preloadArtifactController = DEFAULT_PRELOAD_ARTIFACT_CONTROLLER,
  retryArtifactController = DEFAULT_RETRY_ARTIFACT_CONTROLLER,
  isEnabled = true,
} = {}) {
  const themeId = useThemeId();
  const { cycleState } = useRuntimeParkedStoreSlice(
    useAnalysisStore,
    selectArtifactGalleryAnalysisSlice,
    isEnabled,
  );
  const ambientPresentation = useThemeAmbientPresentation();
  const { t } = useAppTranslation('tools');
  const galleryIndexLayout = useMemo(() => resolveArtifactGalleryIndexLayout(themeId), [themeId]);
  const allowsDirectNavigation = galleryIndexLayout.navigation === 'direct';
  const { ActiveArtifactCanvas, ActiveArtifactPanel, usesCustomArtifactCanvas } = useMemo(() => {
    const hasThemeCanvas = hasDeclaredThemeWidget(themeId, 'ArtifactCanvas');
    const hasThemePanel = hasDeclaredThemeWidget(themeId, 'ArtifactPanel');
    return {
      usesCustomArtifactCanvas: hasThemeCanvas,
      ActiveArtifactCanvas: hasThemeCanvas
        ? requireDeclaredArtifactWorkspaceWidget(themeId, 'ArtifactCanvas')
        : DefaultArtifactCanvas,
      ActiveArtifactPanel: hasThemePanel
        ? requireDeclaredArtifactWorkspaceWidget(themeId, 'ArtifactPanel')
        : ArtifactPanel,
    };
  }, [themeId]);
  const itemCount = items.length;
  const orderedFamilyIds = Array.isArray(artifactDisclosureSnapshot?.orderedFamilyIds)
    ? artifactDisclosureSnapshot.orderedFamilyIds
    : EMPTY_ARTIFACT_FAMILY_IDS;
  const lockedItemCount = Math.max(0,
    orderedFamilyIds.length
    - orderedFamilyIds.filter((familyId) => (
      artifactDisclosureSnapshot?.entriesByFamilyId?.[familyId]?.visible === true
    )).length);

  const safeIndex = useMemo(() => {
    if (!itemCount) return 0;
    const normalizedIndex = Number.isFinite(selectedArtifactIndex) ? selectedArtifactIndex : 0;
    return ((normalizedIndex % itemCount) + itemCount) % itemCount;
  }, [selectedArtifactIndex, itemCount]);
  const artifactWidgetSignature = useMemo(
    () => items.map((item, index) => (
      `${index}:${item?.canonicalId || ''}:${item?.visualKey || ''}`
    )).join('|'),
    [items],
  );

  const [ringState, setRingState] = useState({ isVisible: false, pulseToken: 0 });
  const [selectionRequest, setSelectionRequest] = useState(IDLE_ARTIFACT_SELECTION_REQUEST);
  const selectionRequestRevisionRef = useRef(0);
  const canSelectArtifactIndexRef = useRef(canSelectArtifactIndex);
  const onSelectArtifactIndexRef = useRef(onSelectArtifactIndex);
  const hasInitializedDisplayKeyRef = useRef(false);
  const sceneCanvasRef = useRef(null);
  const {
    width: sceneCanvasWidth,
    height: sceneCanvasHeight,
    targetRef: sceneCanvasTargetRef,
  } = useResizeObserver(sceneCanvasRef, { measureBeforePaint: true, enabled: isEnabled });
  // A parked keep-alive tab has a zero-size DOM box. Retain its last measured
  // presentation geometry so hiding it does not dispose the shared canvas.
  const retainedCanvasMetrics = useRef({ width: 0, height: 0 });
  if (sceneCanvasWidth > 0 && sceneCanvasHeight > 0) {
    retainedCanvasMetrics.current = { width: sceneCanvasWidth, height: sceneCanvasHeight };
  }
  const presentationWidth = retainedCanvasMetrics.current.width;
  const presentationHeight = retainedCanvasMetrics.current.height;
  canSelectArtifactIndexRef.current = canSelectArtifactIndex;
  onSelectArtifactIndexRef.current = onSelectArtifactIndex;

  const activeItem = itemCount ? items[safeIndex] : null;
  const artifactData = activeItem || {};
  const canonicalId = artifactData?.canonicalId || '';
  const visualKey = artifactData?.visualKey || '';
  const artifactIdentityKey = buildArtifactIdentityKey({ safeIndex, canonicalId, visualKey });
  const visualPolicy = useMemo(
    () => (itemCount ? getToolsVisualPolicy(themeId, visualKey) : null),
    [itemCount, themeId, visualKey],
  );
  const artifactTheme = useMemo(
    () => (itemCount ? getArtifactColorTokens(themeId, canonicalId) : null),
    [canonicalId, itemCount, themeId],
  );
  const stableRendererFx = useMemo(
    () => buildStableRendererFx(visualPolicy?.rendererFx),
    [visualPolicy?.rendererFx],
  );
  const baseGroundPolicy = useMemo(
    () => ({ ...(visualPolicy?.ground && typeof visualPolicy.ground === 'object' ? visualPolicy.ground : {}) }),
    [visualPolicy?.ground],
  );
  const normalizedSceneSpec = useMemo(
    () => normalizeArtifactGallerySceneSpec(visualPolicy?.sceneSpec),
    [visualPolicy?.sceneSpec],
  );
  const sceneRuntimeInput = useMemo(() => ({
    normalizedSceneSpec,
    artifactKey: visualKey,
    width: presentationWidth,
    height: presentationHeight,
    paintBleedBottomPx: galleryIndexLayout.sceneReserveBottomPx,
  }), [normalizedSceneSpec, visualKey, presentationWidth, presentationHeight,
    galleryIndexLayout.sceneReserveBottomPx]);

  const handleArtifactReady = useCallback(() => {
    setRingState((prev) => ({ isVisible: true, pulseToken: prev.pulseToken + 1 }));
  }, []);

  const isArtifactIndexSelectable = useCallback((index) => {
    if (!itemCount) return false;
    const safeTargetIndex = normalizeGalleryIndex(index, itemCount);
    if (safeTargetIndex === safeIndex) return true;
    return canSelectArtifactIndexRef.current(safeTargetIndex) !== false;
  }, [itemCount, safeIndex]);

  const previewRenderState = useMemo(() => {
    if (!artifactData || !itemCount) return null;
    return artifactData?.artifactPreviewRenderState
      || resolveArtifactPreviewRenderState({
        artifactActivity: artifactData?.artifactActivity || null,
        artifactPresentation: artifactData?.artifactPresentation || null,
        isRuntimeActive: artifactData?.isRuntimeActive === true,
        isPreviewActive: artifactData?.isPreviewActive === true,
      });
  }, [artifactData, itemCount]);

  const isArtifactPreviewActive = previewRenderState?.isActive === true;
  const previewArtifactPresentation = previewRenderState?.artifactPresentation || null;
  const previewArtifactActivity = previewRenderState?.artifactActivity || null;
  const visualActivityWeight = previewRenderState?.visualActivityWeight ?? 0;
  const selectionKey = artifactIdentityKey;
  const artifactVisualState = artifactData.artifactVisualState || null;

  const rendererPropsBase = useMemo(() => {
    if (!itemCount) return null;
    return {
      isEnabled,
      artifactColorTokens: artifactTheme,
      ambientPresentation,
      color: artifactTheme.artifact.color,
      cycleState,
      isActive: isArtifactPreviewActive,
      visualKey: visualKey || artifactIdentityKey,
      artifactVisualState,
      artifactActivity: previewArtifactActivity,
      artifactPresentation: previewArtifactPresentation,
      visualActivityWeight,
      mode: 'stable',
      systemMode: themeId,
      fx: stableRendererFx,
      forcePreviewActive: false,
    };
  }, [
    isEnabled,
    ambientPresentation,
    artifactVisualState,
    artifactIdentityKey,
    artifactTheme,
    cycleState,
    isArtifactPreviewActive,
    itemCount,
    previewArtifactActivity,
    previewArtifactPresentation,
    stableRendererFx,
    themeId,
    visualActivityWeight,
    visualKey,
  ]);

  const canvasPropsBase = useMemo(() => {
    if (!itemCount) return null;
    return {
      themeId,
      artifactTheme,
      ambientPresentation,
      isArtifactActive: isArtifactPreviewActive,
    };
  }, [
    ambientPresentation,
    artifactTheme,
    isArtifactPreviewActive,
    itemCount,
    themeId,
  ]);

  const panelProps = useMemo(() => {
    if (!artifactData || !itemCount || !previewRenderState) return null;
    return {
      title: artifactData.title,
      subtitle: artifactData.subtitle,
      description: artifactData.description,
      index: safeIndex,
      isActive: isArtifactPreviewActive,
      activeColor: artifactTheme.controls.accent,
      controlSurface: artifactData.controlSurface,
      workflowReview: artifactData.workflowReview || null,
      visualKey: artifactData.visualKey || '',
    };
  }, [
    artifactData,
    artifactTheme,
    isArtifactPreviewActive,
    itemCount,
    previewRenderState,
    safeIndex,
  ]);

  const preloadArtifactWidgetAtIndex = useCallback((index) => {
    if (!themeId || !itemCount) {
      return Promise.reject(new Error('ARTIFACT_WIDGET_PRELOAD_CONTEXT_MISSING'));
    }
    const safeTargetIndex = normalizeGalleryIndex(index, itemCount);
    const targetItem = items[safeTargetIndex];
    const widgetType = resolveArtifactWidgetType(targetItem, themeId);
    if (!widgetType) {
      return Promise.reject(createArtifactWidgetTypeMissingError(targetItem, safeTargetIndex));
    }
    return Promise.resolve()
      .then(() => Promise.all([
        preloadThemeWidgetChunk(themeId, widgetType),
        preloadArtifactGalleryRuntime(themeId, targetItem.visualKey),
      ]))
      .then(([ack]) => {
        const chunkState = getThemeWidgetChunkState(themeId, widgetType);
        if (ack?.loaded !== true || chunkState?.status !== 'ready') {
          throw new Error(`ARTIFACT_WIDGET_PRELOAD_NOT_READY:${themeId}:${widgetType}`);
        }
        return ack;
      });
  }, [itemCount, items, themeId]);

  const preloadArtifactControllerAtIndex = useCallback((index) => {
    if (!itemCount) {
      return Promise.reject(new Error('ARTIFACT_CONTROLLER_PRELOAD_CONTEXT_MISSING'));
    }
    const safeTargetIndex = normalizeGalleryIndex(index, itemCount);
    const targetItem = items[safeTargetIndex];
    const artifactId = targetItem?.canonicalId || targetItem?.artifactId || '';
    if (!artifactId) {
      return Promise.reject(new Error(`ARTIFACT_CONTROLLER_ID_MISSING:index_${safeTargetIndex}`));
    }
    return Promise.resolve()
      .then(() => preloadArtifactController(artifactId))
      .then((ack) => {
        if (ack?.loaded !== true || !isArtifactControllerReady(artifactId)) {
          throw new Error(`ARTIFACT_CONTROLLER_PRELOAD_NOT_READY:${artifactId}`);
        }
        return ack;
      });
  }, [isArtifactControllerReady, itemCount, items, preloadArtifactController]);

  const retryArtifactControllerAtIndex = useCallback((index) => {
    if (!itemCount) {
      return Promise.reject(new Error('ARTIFACT_CONTROLLER_RETRY_CONTEXT_MISSING'));
    }
    const safeTargetIndex = normalizeGalleryIndex(index, itemCount);
    const targetItem = items[safeTargetIndex];
    const artifactId = targetItem?.canonicalId || targetItem?.artifactId || '';
    if (!artifactId) {
      return Promise.reject(new Error(`ARTIFACT_CONTROLLER_ID_MISSING:index_${safeTargetIndex}`));
    }
    return Promise.resolve()
      .then(() => retryArtifactController(artifactId))
      .then((ack) => {
        if (ack?.loaded !== true || !isArtifactControllerReady(artifactId)) {
          throw new Error(`ARTIFACT_CONTROLLER_RETRY_NOT_READY:${artifactId}`);
        }
        return ack;
      });
  }, [isArtifactControllerReady, itemCount, items, retryArtifactController]);

  const preloadArtifactSelectionAtIndex = useCallback((index) => Promise.all([
    preloadArtifactWidgetAtIndex(index),
    preloadArtifactControllerAtIndex(index),
  ]), [preloadArtifactControllerAtIndex, preloadArtifactWidgetAtIndex]);

  const retryArtifactSelectionAtIndex = useCallback((index) => Promise.all([
    preloadArtifactWidgetAtIndex(index),
    retryArtifactControllerAtIndex(index),
  ]), [preloadArtifactWidgetAtIndex, retryArtifactControllerAtIndex]);

  const handlePreloadIndex = useCallback((index) => {
    if (!isEnabled || !itemCount) return;
    const safeTargetIndex = normalizeGalleryIndex(index, itemCount);
    const targetItem = items[safeTargetIndex];
    const targetIdentity = targetItem?.canonicalId
      || resolveArtifactWidgetType(targetItem, themeId)
      || `index_${safeTargetIndex}`;
    void preloadArtifactSelectionAtIndex(safeTargetIndex).catch((error) => {
      warnArtifactPreloadFailureOnce(themeId, `selection:${targetIdentity}`, error);
    });
  }, [
    isEnabled,
    itemCount,
    items,
    preloadArtifactSelectionAtIndex,
    themeId,
  ]);

  useEffect(() => {
    selectionRequestRevisionRef.current += 1;
    setSelectionRequest(IDLE_ARTIFACT_SELECTION_REQUEST);
    return () => {
      selectionRequestRevisionRef.current += 1;
    };
  }, [artifactWidgetSignature, isEnabled, itemCount, safeIndex, themeId]);

  const handleSelectIndex = useCallback((nextIndex) => {
    if (!isEnabled || !itemCount) return;
    const safeNextIndex = normalizeGalleryIndex(nextIndex, itemCount);
    if (safeNextIndex === safeIndex) {
      selectionRequestRevisionRef.current += 1;
      setSelectionRequest(IDLE_ARTIFACT_SELECTION_REQUEST);
      return;
    }
    if (!isArtifactIndexSelectable(safeNextIndex)) {
      selectionRequestRevisionRef.current += 1;
      setSelectionRequest(IDLE_ARTIFACT_SELECTION_REQUEST);
      return;
    }
    if (
      selectionRequest.pendingIndex === safeNextIndex
      && (selectionRequest.phase === 'pending' || selectionRequest.phase === 'requested')
    ) return;
    const requestRevision = selectionRequestRevisionRef.current + 1;
    selectionRequestRevisionRef.current = requestRevision;
    const targetItem = items[safeNextIndex];
    const targetWidgetType = resolveArtifactWidgetType(targetItem, themeId);
    const targetArtifactId = targetItem?.canonicalId || targetItem?.artifactId || '';
    if (!targetWidgetType) {
      const error = createArtifactWidgetTypeMissingError(targetItem, safeNextIndex);
      setSelectionRequest({
        phase: 'error',
        pendingIndex: null,
        errorIndex: safeNextIndex,
        errorMessage: error.message,
      });
      return;
    }
    try {
      if (
        getThemeWidgetChunkState(themeId, targetWidgetType)?.status === 'ready'
        && isArtifactControllerReady(targetArtifactId)
      ) {
        if (
          !isArtifactIndexSelectable(safeNextIndex)
          || onSelectArtifactIndexRef.current?.(safeNextIndex) === false
        ) {
          setSelectionRequest(IDLE_ARTIFACT_SELECTION_REQUEST);
          return;
        }
        setSelectionRequest({
          phase: 'requested',
          pendingIndex: safeNextIndex,
          errorIndex: null,
          errorMessage: '',
        });
        return;
      }
    } catch (error) {
      warnArtifactPreloadFailureOnce(themeId, targetWidgetType, error);
      setSelectionRequest({
        phase: 'error',
        pendingIndex: null,
        errorIndex: safeNextIndex,
        errorMessage: error instanceof Error && error.message
          ? error.message
          : 'ARTIFACT_WIDGET_PRELOAD_STATE_FAILED',
      });
      return;
    }
    setSelectionRequest({
      phase: 'pending',
      pendingIndex: safeNextIndex,
      errorIndex: null,
      errorMessage: '',
    });
    const isControllerRetry = (
      selectionRequest.phase === 'error'
      && selectionRequest.errorIndex === safeNextIndex
      && !isArtifactControllerReady(targetArtifactId)
    );
    const prepareSelection = isControllerRetry
      ? retryArtifactSelectionAtIndex
      : preloadArtifactSelectionAtIndex;
    void prepareSelection(safeNextIndex)
      .then(() => {
        if (requestRevision !== selectionRequestRevisionRef.current) return;
        if (
          !isArtifactIndexSelectable(safeNextIndex)
          || onSelectArtifactIndexRef.current?.(safeNextIndex) === false
        ) {
          setSelectionRequest(IDLE_ARTIFACT_SELECTION_REQUEST);
          return;
        }
        setSelectionRequest({
          phase: 'requested',
          pendingIndex: safeNextIndex,
          errorIndex: null,
          errorMessage: '',
        });
      })
      .catch((error) => {
        if (requestRevision !== selectionRequestRevisionRef.current) return;
        const widgetType = resolveArtifactWidgetType(items[safeNextIndex], themeId);
        warnArtifactPreloadFailureOnce(themeId, widgetType || `index_${safeNextIndex}`, error);
        setSelectionRequest({
          phase: 'error',
          pendingIndex: null,
          errorIndex: safeNextIndex,
          errorMessage: error instanceof Error && error.message
            ? error.message
            : 'ARTIFACT_WIDGET_PRELOAD_FAILED',
        });
      });
  }, [
    isEnabled,
    itemCount,
    items,
    isArtifactControllerReady,
    isArtifactIndexSelectable,
    preloadArtifactSelectionAtIndex,
    retryArtifactSelectionAtIndex,
    safeIndex,
    selectionRequest.errorIndex,
    selectionRequest.pendingIndex,
    selectionRequest.phase,
    themeId,
  ]);

  const handleSelectPrevious = useCallback(() => {
    if (!itemCount) return;
    const cursorIndex = Number.isInteger(selectionRequest.pendingIndex)
      ? selectionRequest.pendingIndex
      : safeIndex;
    handleSelectIndex((cursorIndex - 1 + itemCount) % itemCount);
  }, [handleSelectIndex, itemCount, safeIndex, selectionRequest.pendingIndex]);

  const handleSelectNext = useCallback(() => {
    if (!itemCount) return;
    const cursorIndex = Number.isInteger(selectionRequest.pendingIndex)
      ? selectionRequest.pendingIndex
      : safeIndex;
    handleSelectIndex((cursorIndex + 1) % itemCount);
  }, [handleSelectIndex, itemCount, safeIndex, selectionRequest.pendingIndex]);

  useEffect(() => {
    if (!hasInitializedDisplayKeyRef.current) {
      hasInitializedDisplayKeyRef.current = true;
      return;
    }
    setRingState((prev) => ({ ...prev, isVisible: false }));
  }, [artifactIdentityKey]);

  useEffect(() => {
    if (!isEnabled || !itemCount) return undefined;

    const handleKeyDown = (event) => {
      if (!onSelectArtifactIndex) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSelectNext();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSelectPrevious();
      }
      // A sequential (path) gallery has no shortcut to either end.
      if (!allowsDirectNavigation) return;
      if (event.key === 'Home') {
        event.preventDefault();
        handleSelectIndex(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        handleSelectIndex(itemCount - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    allowsDirectNavigation,
    handleSelectIndex,
    handleSelectNext,
    handleSelectPrevious,
    isEnabled,
    itemCount,
    onSelectArtifactIndex,
  ]);

  const selectionBase = useMemo(() => {
    if (
      !artifactData
      || !itemCount
      || !rendererPropsBase
      || !canvasPropsBase
      || !panelProps
    ) {
      return null;
    }

    return {
      key: selectionKey,
      identityKey: artifactIdentityKey,
      usesCustomArtifactCanvas,
      ActiveArtifactCanvas,
      ActiveArtifactPanel,
      artifactTheme,
      groundPolicyBase: baseGroundPolicy,
      isArtifactActive: isArtifactPreviewActive,
      rendererPropsBase,
      canvasPropsBase,
      panelProps,
    };
  }, [
    ActiveArtifactCanvas,
    ActiveArtifactPanel,
    artifactData,
    artifactIdentityKey,
    artifactTheme,
    baseGroundPolicy,
    canvasPropsBase,
    itemCount,
    panelProps,
    rendererPropsBase,
    selectionKey,
    usesCustomArtifactCanvas,
  ]);

  const navigation = useMemo(() => ({
    itemCount,
    items,
    lockedItemCount,
    orderedFamilyIds,
    safeIndex,
    colorTokens: artifactTheme,
    selectionRequest,
    handleSelectIndex,
    handleSelectNext,
    handleSelectPrevious,
    handlePreloadIndex,
    isArtifactIndexSelectable,
  }), [
    artifactTheme,
    handlePreloadIndex,
    handleSelectIndex,
    handleSelectNext,
    handleSelectPrevious,
    isArtifactIndexSelectable,
    itemCount,
    items,
    lockedItemCount,
    orderedFamilyIds,
    safeIndex,
    selectionRequest,
  ]);

  return {
    isEmpty: !itemCount,
    emptyLabel: t('status.no_data'),
    themeId,
    ambientPresentation,
    galleryIndexLayout,
    sceneCanvasRef: sceneCanvasTargetRef,
    sceneRuntimeInput,
    selectionBase,
    ringState,
    navigation,
    handleArtifactReady,
  };
}
