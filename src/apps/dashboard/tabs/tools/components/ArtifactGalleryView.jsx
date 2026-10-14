import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { resolveProgressionFamilyUnlockDay } from '@/domains/progression/policy/progressionJourneyPolicy.js';
import { motion, useReducedMotion } from 'framer-motion';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
  buildDashboardSurfaceMotion,
  getDashboardSurfaceMotionStyle,
  getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import { getThemeWidget } from '@/themes/core/registry/index.js';
import { hasDeclaredThemeWidget } from '@/themes/core/surfaceDescriptor.js';
import ArtifactNavigationSigil from '@/themes/core/tools/ArtifactNavigationSigil.jsx';
import ArtifactPathIndex from './ArtifactPathIndex.jsx';
import { useArtifactPathGestures } from './artifactPathGestures.js';
import ArtifactRenderer from './ArtifactRenderer.jsx';
import './artifactWorkspace.css';

const DASHBOARD_SURFACE_MOTION_STYLE = getDashboardSurfaceMotionStyle();
const ARTIFACT_PANEL_MOTION_STYLE = Object.freeze({ willChange: 'opacity' });
const ARTIFACT_LOCAL_3D_SELECTION_MOTION_STYLE = Object.freeze({
  willChange: 'transform',
});
const ARTIFACT_LOCAL_3D_SELECTION_MOTION_PROPS = Object.freeze({
  initial: false,
  animate: { opacity: 1 },
  transition: { duration: 0 },
});
const ARTIFACT_GALLERY_NAV_INTERACTION_STYLE = getInteractionMotionStyle('stable', {
  properties: ['color', 'background-color', 'border-color', 'opacity', 'transform', 'box-shadow', 'filter'],
});

function buildArtifactNavigationSlots({
  items = [],
  orderedFamilyIds = [],
  lockedItemCount = 0,
} = {}) {
  const itemIndexByFamilyId = new Map(items.map((item, index) => [item?.canonicalId, index]));
  if (orderedFamilyIds.length > 0) {
    return orderedFamilyIds.map((familyId) => {
      const itemIndex = itemIndexByFamilyId.get(familyId);
      return Number.isInteger(itemIndex)
        ? { kind: 'artifact', familyId, itemIndex, item: items[itemIndex] }
        : { kind: 'locked', familyId };
    });
  }

  return [
    ...items.map((item, itemIndex) => ({
      kind: 'artifact',
      familyId: item?.canonicalId || `artifact-${itemIndex}`,
      itemIndex,
      item,
    })),
    ...Array.from({ length: lockedItemCount }, (_, lockedIndex) => ({
      kind: 'locked',
      familyId: `locked-${lockedIndex}`,
    })),
  ];
}

const ArtifactSelectionLayer = React.memo(function ArtifactSelectionLayer({
  anchorX,
  anchorY,
  offsetX,
  offsetY,
  selectionKey,
  selectionMotionProps,
  selectionMotionStyle,
  usesLocal3d,
  rendererProps,
  onReady,
}) {
  const renderFrame = useCallback((children) => (
    <div
      className="absolute left-1/2 z-20 overflow-visible"
      style={{
        left: `${anchorX}px`,
        top: `${anchorY}px`,
        transform: 'translate(-50%, -100%)',
        transformOrigin: 'center bottom',
      }}
    >
      <div
        style={{
          transform: `translate(${offsetX || 0}px, ${offsetY || 0}px)`,
          transformOrigin: 'center center',
        }}
      >
        <motion.div
          key={rendererProps.systemMode === 'zen' ? 'zen-retained-artifacts' : selectionKey || 'artifact-selection'}
          {...selectionMotionProps}
          className="relative overflow-visible pointer-events-none"
          data-artifact-gallery-render-space={usesLocal3d ? 'local-3d' : 'flat-2d'}
          style={selectionMotionStyle}
        >
          {children}
        </motion.div>
      </div>
    </div>
  ), [anchorX, anchorY, offsetX, offsetY, selectionMotionProps, selectionMotionStyle,
    usesLocal3d, rendererProps.systemMode, selectionKey]);

  return <ArtifactRenderer {...rendererProps} renderFrame={renderFrame} onReady={onReady} />;
});

const ArtifactCanvasSurface = React.memo(function ArtifactCanvasSurface({ Canvas, canvasProps, renderArtifact }) {
  return <Canvas {...canvasProps} renderArtifact={renderArtifact} />;
});

const ArtifactControlRailRegion = React.memo(function ArtifactControlRailRegion({
  ActiveArtifactPanel,
  panelMotion,
  panelProps,
  selectionKey,
  usesCustomArtifactCanvas,
  themeId,
}) {
  const workflowReview = panelProps?.workflowReview || null;
  return (
    <aside
      aria-label={panelProps?.title || undefined}
      data-artifact-workspace-layer="control-rail"
      data-artifact-control-rail="full-height"
      className="artifact-workspace__control-rail relative z-20 flex h-full min-h-0 min-w-0 flex-col items-stretch overflow-hidden pointer-events-none"
    >
      {!usesCustomArtifactCanvas && (
        <div
          className="absolute inset-0 z-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
      )}

      <motion.div
        key={themeId === 'entropy' ? selectionKey : 'artifact-control-rail'}
        {...panelMotion}
        data-artifact-panel-motion-owner="gallery"
        data-artifact-panel-mode={workflowReview ? 'workflow-review' : 'controls'}
        className="h-full w-full min-w-0 overflow-visible pointer-events-auto"
        style={themeId === 'entropy' ? ARTIFACT_LOCAL_3D_SELECTION_MOTION_STYLE : ARTIFACT_PANEL_MOTION_STYLE}
      >
        {workflowReview?.content || <ActiveArtifactPanel key={selectionKey} {...panelProps} />}
      </motion.div>
    </aside>
  );
});

export default function ArtifactGalleryView({
  controller,
  className = '',
} = {}) {
  const { t } = useAppTranslation('tools');
  const { t: tGuidance } = useAppTranslation('guidance');
  const shouldReduceMotion = useReducedMotion();
  const resolveLabel = useCallback((key, fallback, options = {}) => {
    const label = typeof t === 'function' ? t(key, options) : '';
    return typeof label === 'string' && label !== key ? label : fallback;
  }, [t]);
  const {
    isEmpty,
    emptyLabel,
    themeId,
    galleryIndexLayout,
    sceneCanvasRef,
    navigation,
    selection,
    handleArtifactReady,
  } = controller;
  const navigationItems = Array.isArray(navigation?.items) ? navigation.items : [];
  const lockedItemCount = Math.max(0, Math.floor(Number(navigation?.lockedItemCount) || 0));
  const orderedFamilyIds = Array.isArray(navigation?.orderedFamilyIds)
    ? navigation.orderedFamilyIds
    : [];
  const navigationSlots = buildArtifactNavigationSlots({
    items: navigationItems,
    orderedFamilyIds,
    lockedItemCount,
  });
  const navigationSlotCount = Math.max(1, navigationSlots.length);
  const navigationColors = navigation?.colorTokens?.navigation;
  if (
    !isEmpty
    && (
      typeof navigationColors?.active !== 'string'
      || typeof navigationColors?.glow !== 'string'
    )
  ) {
    throw new Error('[ArtifactGalleryView] Selected artifact navigation colors are required.');
  }
  const navigationActiveColor = isEmpty ? '#ffffff' : navigationColors.active;
  const navigationGlowColor = isEmpty ? '#ffffff' : navigationColors.glow;
  const usesZenNavigationTone = themeId === 'zen';
  const isLightNavigationSurface = usesZenNavigationTone
    && controller.ambientPresentation?.navigationTone !== 'dark';
  const navigationIdleColor = usesZenNavigationTone
    ? (isLightNavigationSurface ? 'rgba(41, 37, 36, 0.42)' : 'rgba(255, 255, 255, 0.38)')
    : 'var(--color-on-surface-muted)';
  const navigationLabelColor = usesZenNavigationTone
    ? (isLightNavigationSurface ? 'rgba(41, 37, 36, 0.82)' : 'rgba(255, 255, 255, 0.82)')
    : 'var(--color-on-surface)';
  const navigationLineColor = usesZenNavigationTone
    ? (isLightNavigationSurface ? 'rgba(68, 64, 60, 0.18)' : 'rgba(255, 255, 255, 0.14)')
    : 'var(--color-border)';
  const pendingSelectionIndex = Number.isInteger(navigation?.selectionRequest?.pendingIndex)
    ? navigation.selectionRequest.pendingIndex
    : null;
  const failedSelectionIndex = Number.isInteger(navigation?.selectionRequest?.errorIndex)
    ? navigation.selectionRequest.errorIndex
    : null;
  const selectionErrorMessage = typeof navigation?.selectionRequest?.errorMessage === 'string'
    ? navigation.selectionRequest.errorMessage
    : '';
  const selectionRequestPhase = navigation?.selectionRequest?.phase || 'idle';
  const resolveArtifactNavigationLabel = useCallback((idx) => {
    const item = navigationItems[idx] || {};
    const title = typeof item.title === 'string' && item.title.trim()
      ? item.title.trim()
      : `Artifact ${idx + 1}`;
    return resolveLabel(
      'artifact_altar.navigation.select',
      `Select ${title}`,
      { index: idx + 1, title },
    );
  }, [navigationItems, resolveLabel]);
  const selectionMotion = useMemo(() => buildDashboardSurfaceMotion('tools.gallery.selection', {
    family: themeId,
    reduced: shouldReduceMotion,
  }), [shouldReduceMotion, themeId]);
  const panelMotion = useMemo(() => buildDashboardSurfaceMotion('tools.gallery.panel', {
    family: themeId,
    reduced: shouldReduceMotion,
  }), [shouldReduceMotion, themeId]);
  const usesPathIndex = galleryIndexLayout?.variant === 'path';
  const sceneMeasureStyle = useMemo(() => ({
    bottom: `${galleryIndexLayout?.sceneReserveBottomPx || 0}px`,
  }), [galleryIndexLayout?.sceneReserveBottomPx]);
  const ThemeArtifactIcons = useMemo(
    () => (themeId ? getThemeWidget(themeId, 'ArtifactIcons') : null),
    [themeId],
  );
  // Optional theme layer drawn across the threshold and the aperture, under the
  // control rail (Zen's Furin lintel). The theme declares it; the gallery only
  // provides the workspace slot and the stage anchor.
  const ThemeWorkspaceLintel = useMemo(
    () => (themeId && hasDeclaredThemeWidget(themeId, 'ArtifactWorkspaceLintel')
      ? getThemeWidget(themeId, 'ArtifactWorkspaceLintel')
      : null),
    [themeId],
  );
  const ActiveArtifactCanvas = selection?.ActiveArtifactCanvas;
  const ActiveArtifactPanel = selection?.ActiveArtifactPanel;
  const usesLocal3d = selection?.rendererProps?.fx?.usesLocal3d === true;
  const selectionMotionProps = usesLocal3d
    ? ARTIFACT_LOCAL_3D_SELECTION_MOTION_PROPS
    : selectionMotion;
  const selectionMotionStyle = usesLocal3d
    ? ARTIFACT_LOCAL_3D_SELECTION_MOTION_STYLE
    : DASHBOARD_SURFACE_MOTION_STYLE;

  const hasCanvasMetrics = selection?.hasCanvasMetrics;
  const anchorX = selection?.artifactAnchorScreen.x;
  const anchorY = selection?.artifactAnchorScreen.y;
  const offsetX = selection?.artifactOffsetScreen.x;
  const offsetY = selection?.artifactOffsetScreen.y;
  const selectionKey = selection?.key;
  const rendererProps = selection?.rendererProps;
  const renderArtifact = useCallback(() => {
    if (!hasCanvasMetrics) return null;

    return (
      <ArtifactSelectionLayer
        anchorX={anchorX}
        anchorY={anchorY}
        offsetX={offsetX}
        offsetY={offsetY}
        selectionKey={selectionKey}
        selectionMotionProps={selectionMotionProps}
        selectionMotionStyle={selectionMotionStyle}
        usesLocal3d={usesLocal3d}
        rendererProps={rendererProps}
        onReady={handleArtifactReady}
      />
    );
  }, [
    handleArtifactReady,
    hasCanvasMetrics, anchorX, anchorY, offsetX, offsetY, selectionKey, rendererProps,
    selectionMotionProps,
    selectionMotionStyle,
    usesLocal3d,
  ]);

  const isRenderable = !isEmpty && Boolean(selection && ActiveArtifactCanvas && ActiveArtifactPanel);
  const pathItemCount = navigationItems.length;
  const canWalkPath = usesPathIndex && isRenderable && pathItemCount > 1;
  const sceneViewportRef = useRef(null);
  const handlePathStep = useCallback((step) => {
    if (step > 0) navigation.handleSelectNext();
    else navigation.handleSelectPrevious();
  }, [navigation]);
  useArtifactPathGestures(sceneViewportRef, { enabled: canWalkPath, onStep: handlePathStep });
  const activeNavigationIndex = navigation?.safeIndex;
  const previousPathIndex = canWalkPath ? (activeNavigationIndex - 1 + pathItemCount) % pathItemCount : null;
  const nextPathIndex = canWalkPath ? (activeNavigationIndex + 1) % pathItemCount : null;
  const handlePathIntent = useCallback((step) => {
    navigation.handlePreloadIndex?.(step > 0 ? nextPathIndex : previousPathIndex);
  }, [navigation, nextPathIndex, previousPathIndex]);
  // Only the two neighbours are reachable, so warm exactly those once the
  // current step has settled.
  useEffect(() => {
    if (!canWalkPath || selectionRequestPhase !== 'idle') return;
    navigation.handlePreloadIndex?.(nextPathIndex);
    if (previousPathIndex !== nextPathIndex) navigation.handlePreloadIndex?.(previousPathIndex);
  }, [canWalkPath, navigation, nextPathIndex, previousPathIndex, selectionRequestPhase]);

  if (!isRenderable) {
    return <div className="p-10 text-center text-on-surface-muted">{emptyLabel}</div>;
  }

  const renderNavigationIcon = (slot) => {
    const artifactKey = slot.kind === 'artifact'
      ? (slot.item?.canonicalId || slot.item?.visualKey || '')
      : slot.familyId;
    return ThemeArtifactIcons ? (
      <ThemeArtifactIcons artifactKey={artifactKey} data-artifact-navigation-sigil={artifactKey} />
    ) : (
      <ArtifactNavigationSigil artifactId={artifactKey} data-artifact-navigation-sigil={artifactKey} />
    );
  };
  const resolveSlotTitles = (slot) => {
    const title = typeof slot.item?.title === 'string' && slot.item.title.trim()
      ? slot.item.title.trim()
      : `Artifact ${slot.itemIndex + 1}`;
    const functionLabel = typeof slot.item?.navigationLabel === 'string' && slot.item.navigationLabel
      ? slot.item.navigationLabel
      : title;
    return { title, functionLabel };
  };
  const resolvePathPosition = () => {
    if (!usesPathIndex) return '';
    const activeSlot = navigationSlots.find((slot) => (
      slot.kind === 'artifact' && slot.itemIndex === navigation.safeIndex
    ));
    if (!activeSlot) return '';
    const { title, functionLabel } = resolveSlotTitles(activeSlot);
    const spokenTitle = functionLabel === title ? title : `${functionLabel}, ${title}`;
    return resolveLabel(
      'artifact_altar.navigation.position',
      `${activeSlot.itemIndex + 1} / ${pathItemCount} · ${spokenTitle}`,
      { index: activeSlot.itemIndex + 1, count: pathItemCount, title: spokenTitle },
    );
  };
  const pathPositionAnnouncement = resolvePathPosition();
  const resolvePathThreshold = (targetIndex, key, fallback) => ({
    available: canWalkPath,
    blocked: canWalkPath && navigation.isArtifactIndexSelectable?.(targetIndex) === false,
    label: resolveLabel(key, fallback),
  });

  return (
    <div
      data-artifact-workspace-layout="rift-portal-control-rail"
      className={`artifact-workspace relative h-full w-full min-h-0 min-w-0 overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        data-artifact-workspace-layer="threshold"
        data-artifact-workspace-threshold="sidebar-rift"
        className="artifact-workspace__threshold relative z-10 h-full min-h-0"
      />

      <div
        data-artifact-gallery-canvas-region="true"
        data-artifact-workspace-layer="aperture"
        className="artifact-workspace__aperture relative z-0 flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-visible bg-surface-sunken transition-colors duration-1000"
      >
        <div ref={sceneViewportRef} data-artifact-gallery-scene-viewport="true" className="relative min-h-0 w-full flex-1">
        {/* Stage layout box. With an in-scene index it stops short of the
            bottom edge by the declared reserve; the canvas still paints the
            full viewport underneath. */}
        <div
          ref={sceneCanvasRef}
          data-artifact-gallery-stage-layout-box="true"
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={sceneMeasureStyle}
        />
        {hasCanvasMetrics ? (
          <ArtifactCanvasSurface
            Canvas={ActiveArtifactCanvas}
            canvasProps={selection.canvasProps}
            renderArtifact={renderArtifact}
          />
        ) : null}

        {usesPathIndex ? (
          <ArtifactPathIndex
            slots={navigationSlots}
            activeIndex={navigation.safeIndex}
            pendingIndex={pendingSelectionIndex}
            selectionPhase={selectionRequestPhase}
            inkColor={usesZenNavigationTone ? 'var(--zen-ambient-text)' : navigationLabelColor}
            ariaLabel={resolveLabel('artifact_altar.navigation.path_label', 'Artifact path')}
            positionAnnouncement={pathPositionAnnouncement}
            previous={resolvePathThreshold(previousPathIndex, 'artifact_altar.navigation.previous', 'Previous artifact')}
            next={resolvePathThreshold(nextPathIndex, 'artifact_altar.navigation.next', 'Next artifact')}
            onStep={handlePathStep}
            onIntent={handlePathIntent}
            errorContent={failedSelectionIndex !== null ? (
              <div role="alert" className="artifact-path__error">
                <span>
                  {resolveLabel('artifact_altar.navigation.load_failed', 'Artifact could not be prepared.')}
                </span>
                <button type="button" onClick={() => navigation.handleSelectIndex(failedSelectionIndex)}>
                  {resolveLabel('artifact_altar.navigation.retry', 'Retry')}
                </button>
              </div>
            ) : null}
          />
        ) : null}

        </div>

        {!usesPathIndex ? (
        <div
          data-artifact-gallery-quickbar="true"
          data-artifact-gallery-index="quickbar"
          className="relative shrink-0 w-full"
          role="navigation"
          aria-label={resolveLabel('artifact_altar.navigation.label', 'Artifact navigation')}
          style={{
            ...ARTIFACT_GALLERY_NAV_INTERACTION_STYLE,
            '--artifact-gallery-navigation-line': navigationLineColor,
          }}
        >
          <div
            data-artifact-gallery-nav-track="true"
            data-artifact-gallery-horizon="true"
            data-artifact-gallery-slot-count={navigationSlotCount}
            style={{
              ...(usesZenNavigationTone ? {} : {
                borderColor: 'var(--color-border)',
                background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
                boxShadow: 'var(--shadow-md)',
              }),
              '--artifact-gallery-slot-count': navigationSlotCount,
            }}
          >
            {navigationSlots.map((slot) => {
              if (slot.kind === 'locked') {
                return (
                  <div
                    key={slot.familyId}
                    aria-label={`${tGuidance(`families.${slot.familyId}`)} · ${tGuidance('journey.locked', { day: resolveProgressionFamilyUnlockDay(slot.familyId) })}`}
                    aria-disabled="true"
                    data-artifact-gallery-select-slot="locked"
                    data-artifact-gallery-locked-slot="true"
                    data-artifact-gallery-family-id={slot.familyId}
                  >
                    <span data-artifact-gallery-select-marker="true" aria-hidden="true">
                      {ThemeArtifactIcons ? <ThemeArtifactIcons artifactKey={slot.familyId} className="h-full w-full" />
                        : <ArtifactNavigationSigil artifactId={slot.familyId} className="h-full w-full" />}
                    </span>
                    <span data-artifact-gallery-item-label="true" data-artifact-gallery-item-label-trigger="intent">
                      {tGuidance(`families.${slot.familyId}`)} · {tGuidance('journey.locked', { day: resolveProgressionFamilyUnlockDay(slot.familyId) })}
                    </span>
                  </div>
                );
              }

              const { item, itemIndex } = slot;
              const isSelected = itemIndex === navigation.safeIndex;
              const isPending = itemIndex === pendingSelectionIndex
                && selectionRequestPhase === 'pending';
              const isRequested = itemIndex === pendingSelectionIndex
                && selectionRequestPhase === 'requested';
              const hasSelectionError = itemIndex === failedSelectionIndex;
              const isSelectionBlocked = navigation.isArtifactIndexSelectable?.(itemIndex) === false;
              const handleIntentPreload = isSelectionBlocked
                ? undefined
                : () => navigation.handlePreloadIndex?.(itemIndex);
              const title = typeof item?.title === 'string' && item.title.trim()
                ? item.title.trim()
                : `Artifact ${itemIndex + 1}`;
              return (
                <button
                  key={slot.familyId}
                  type="button"
                  data-artifact-gallery-select-slot={isSelected ? 'active' : 'idle'}
                  data-artifact-gallery-load-state={isPending ? 'pending' : isRequested ? 'requested' : hasSelectionError ? 'error' : 'idle'}
                  data-artifact-gallery-family-id={slot.familyId}
                  aria-label={resolveArtifactNavigationLabel(itemIndex)}
                  aria-current={isSelected ? 'true' : undefined}
                  aria-busy={isPending || isRequested ? 'true' : undefined}
                  aria-disabled={isSelectionBlocked ? 'true' : undefined}
                  data-artifact-gallery-navigation-blocked={isSelectionBlocked ? 'true' : 'false'}
                  style={{
                    '--artifact-gallery-slot-color': isSelected
                      ? navigationActiveColor
                      : navigationIdleColor,
                  }}
                  onClick={() => navigation.handleSelectIndex(itemIndex)}
                  onFocus={handleIntentPreload}
                  onPointerDown={handleIntentPreload}
                  onPointerEnter={handleIntentPreload}
                >
                  <span
                    data-artifact-gallery-select-marker="true"
                    className={isPending || isRequested ? 'animate-pulse' : ''}
                    style={{
                      color: isSelected ? navigationActiveColor : navigationIdleColor,
                      filter: isSelected
                        ? `drop-shadow(0 0 7px ${navigationGlowColor}70)`
                        : 'none',
                    }}
                  >
                    {ThemeArtifactIcons ? (
                      <ThemeArtifactIcons
                        artifactKey={item?.canonicalId || item?.visualKey || ''}
                        data-artifact-navigation-sigil={item?.canonicalId}
                        className="h-full w-full"
                      />
                    ) : (
                      <ArtifactNavigationSigil
                        artifactId={item?.canonicalId}
                        data-artifact-navigation-sigil={item?.canonicalId}
                        className="h-full w-full"
                      />
                    )}
                  </span>

                  <span data-artifact-gallery-item-label="true" style={{ color: isSelected ? navigationActiveColor : navigationLabelColor }}>
                    {title}
                  </span>

                </button>
              );
            })}
          </div>
          {failedSelectionIndex !== null ? (
            <div
              role="alert"
              className="flex max-w-full flex-wrap items-center gap-2 px-3 py-2 text-xs text-warning"
            >
              <span className="min-w-0 break-words">
                {resolveLabel(
                  'artifact_altar.navigation.load_failed',
                  'Artifact could not be prepared.',
                )}
              </span>
              <button
                type="button"
                className="shrink-0 underline underline-offset-2"
                onClick={() => navigation.handleSelectIndex(failedSelectionIndex)}
              >
                {resolveLabel('artifact_altar.navigation.retry', 'Retry')}
              </button>
            </div>
          ) : null}
        </div>
        ) : null}

      </div>

      {ThemeWorkspaceLintel && hasCanvasMetrics ? (
        <div aria-hidden="true" data-artifact-workspace-layer="lintel" className="artifact-workspace__lintel">
          <ThemeWorkspaceLintel visualKey={rendererProps?.visualKey} anchorY={anchorY + (offsetY || 0)} />
        </div>
      ) : null}

      <ArtifactControlRailRegion
        ActiveArtifactPanel={ActiveArtifactPanel}
        panelMotion={panelMotion}
        panelProps={selection.panelProps}
        selectionKey={selection.key}
        usesCustomArtifactCanvas={selection.usesCustomArtifactCanvas}
        themeId={themeId}
      />
    </div>
  );
}
