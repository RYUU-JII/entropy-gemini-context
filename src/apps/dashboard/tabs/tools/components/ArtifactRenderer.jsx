// ArtifactRenderer.jsx
// Main renderer that orchestrates artifact display for the selected gallery item.
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { getThemeWidget } from '../../../../../themes/core/registry/index.js';
import { resolveArtifactRenderState } from '../../../../../themes/core/tools/artifactPresentation.js';
import { getArtifactGalleryWidgetType } from '@/themes/core/tools/artifactGalleryRenderer.js';
import ArtifactRenderStage from '@/themes/core/tools/ArtifactRenderStage.jsx';
import { buildArtifactRenderContext } from '@/themes/core/tools/artifactRenderContext.js';
import { useArtifactPresentationCommit } from '@/themes/core/tools/useArtifactPresentationCommit.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';

const WARNED_WIDGET_KEYS = new Set();
const renderUnframed = children => children;

function warnMissingArtifactWidgetOnce(key, details = {}) {
    if (!key || WARNED_WIDGET_KEYS.has(key)) return;
    WARNED_WIDGET_KEYS.add(key);
    if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
    console.warn(`[ArtifactRenderer] Missing artifact widget for "${key}".`, details);
}

function MissingArtifactVisual({ systemMode = '', visualKey = 'unknown', widgetName = '' }) {
    return (
        <div
            className="flex h-[270px] w-[270px] items-center justify-center rounded-[10px] border border-border/25 bg-surface-sunken/35 px-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-on-surface-muted/75"
            data-artifact-renderer-widget-status="missing"
            data-artifact-renderer-theme={systemMode}
            data-artifact-renderer-visual-key={visualKey}
            data-artifact-renderer-widget-name={widgetName}
        >
            {visualKey}
        </div>
    );
}

/**
 * Unified artifact renderer.
 * Theme artifact widgets are prepared at the tab root so this renderer can
 * stay synchronous and avoid nested loading boundaries.
 */
export default function ArtifactRenderer({
    ambientPresentation = null,
    artifactColorTokens = null,
    color,
    isActive,
    visualKey,
    artifactVisualState = null,
    artifactActivity = null,
    artifactPresentation = null,
    visualActivityWeight = null,
    cycleState = null,
    groundProjection,
    onClick,
    onReady,
    renderFrame = renderUnframed,
    mode = 'stable',
    systemMode = 'entropy', // [NEW] Theme Mode
    fx,
    forcePreviewActive = false,
    isEnabled = true,
}) {
    const artifactColor = color || '#8b5cf6';
    const [isComponentReady, setIsComponentReady] = useState(false);
    const hasNotifiedRef = useRef(false);
    const presentedKeyRef = useRef(null);
    const reducedMotion = useReducedMotion();
    const widgetName = useMemo(
        () => getArtifactGalleryWidgetType(systemMode, visualKey),
        [systemMode, visualKey],
    );
    const ArtifactComponent = useMemo(
        () => (widgetName ? getThemeWidget(systemMode, widgetName) : null),
        [systemMode, widgetName],
    );
    const rendererWidgetDiagnostics = useMemo(() => ({
        rendererWidget: {
            status: ArtifactComponent ? 'ready' : 'missing',
            themeId: systemMode,
            visualKey,
            widgetName,
        },
    }), [ArtifactComponent, systemMode, visualKey, widgetName]);

    // Reset ready state on key change before paint to prevent flicker
    useLayoutEffect(() => {
        setIsComponentReady(false);
        hasNotifiedRef.current = false;
    }, [visualKey]);

    useLayoutEffect(() => {
        if (!isEnabled) presentedKeyRef.current = null;
    }, [isEnabled]);

    useEffect(() => {
        if (widgetName && ArtifactComponent) return;
        warnMissingArtifactWidgetOnce(`${systemMode}:${visualKey || 'unknown'}`, {
            systemMode,
            visualKey,
            widgetName,
        });
    }, [ArtifactComponent, systemMode, visualKey, widgetName]);

    const handleComponentReady = useCallback(() => {
        const key = `${systemMode}:${visualKey}`;
        if (isEnabled && presentedKeyRef.current !== key) {
            presentedKeyRef.current = key;
            recordDashboardTabEntryStage('tools', 'presentation:ready', {
                themeId: systemMode, visualKey,
                milestone: widgetName === 'ArtifactGalleryVisual' ? 'bitmap-committed' : 'widget-ready',
            });
        }
        if (hasNotifiedRef.current) return;
        hasNotifiedRef.current = true;
        setIsComponentReady(true);
        onReady?.();
    }, [onReady, isEnabled, systemMode, visualKey, widgetName]);

    const artifactRenderState = useMemo(() => resolveArtifactRenderState({
        artifactActivity,
        artifactPresentation,
        isActive,
        visualActivityWeight,
        // Runtime parking is owned by the tab. Selected motion remains
        // always-on without document/viewport visibility admission here.
        shouldAnimate: isEnabled,
        reducedMotion,
        forcePreviewActive,
    }), [
        artifactActivity,
        artifactPresentation,
        forcePreviewActive,
        isActive,
        isEnabled,
        reducedMotion,
        visualActivityWeight,
    ]);

    const activityWeight = artifactRenderState.visualWeight;
    const artifactRenderContext = useMemo(() => buildArtifactRenderContext({
        ambientPresentation,
        artifactActivity,
        artifactPresentation,
        artifactRenderState,
        artifactVisualState,
        activityWeight,
        colorTokens: artifactColorTokens,
        color: artifactColor,
        cycleState,
        diagnostics: rendererWidgetDiagnostics,
        groundProjection,
        mode,
        systemMode,
        visualKey,
    }), [
        activityWeight,
        ambientPresentation,
        artifactColorTokens,
        artifactActivity,
        artifactColor,
        artifactPresentation,
        artifactRenderState,
        artifactVisualState,
        cycleState,
        rendererWidgetDiagnostics,
        groundProjection,
        mode,
        systemMode,
        visualKey,
    ]);

    const retainsScene = widgetName === 'ArtifactGalleryVisual';
    const requestedPresentation = useMemo(() => ({
        artifactColor, artifactRenderContext, artifactRenderState, rendererFx: fx, renderFrame, isEnabled,
    }), [artifactColor, artifactRenderContext, artifactRenderState, fx, renderFrame, isEnabled]);
    const { presentation, onPrepared } = useArtifactPresentationCommit(requestedPresentation, { retained: retainsScene });

    return presentation.renderFrame(
        <ArtifactRenderStage
            artifactColor={presentation.artifactColor}
            artifactRenderContext={artifactRenderContext}
            presentationContext={presentation.artifactRenderContext}
            artifactRenderState={presentation.artifactRenderState}
            isComponentReady={isComponentReady}
            onClick={onClick}
            onReady={handleComponentReady}
            rendererFx={presentation.rendererFx}
            managesReadiness={retainsScene}
            synchronousPresentation={retainsScene}
        >
            {ArtifactComponent ? (
                <ArtifactComponent artifactRenderContext={artifactRenderContext} isEnabled={isEnabled}
                    onPrepared={retainsScene ? onPrepared : undefined}
                    onReady={handleComponentReady} />
            ) : (
                <MissingArtifactVisual
                    systemMode={systemMode}
                    visualKey={visualKey}
                    widgetName={widgetName}
                />
            )}
        </ArtifactRenderStage>
    );
}
