import {
    requireSakuraRenderPlanV1,
    ZEN_SAKURA_RENDER_PLAN_CONTRACT,
} from '../../sakura/sakuraRenderPlan.js';
import {
    requireSakuraActualAlphaObservationV1,
} from './SakuraActualAlphaObservationContract.js';

export const ZEN_SAKURA_FULL_RENDER_BOUNDS_CONTRACT = 'zen-sakura-full-render-bounds-v1';

const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
const round = (value, digits = 3) => Number(toNumber(value, 0).toFixed(digits));

/**
 * Camera-facing projection over the canonical Sakura render plan.
 *
 * Growth visibility, projected nodes, terminal presentation, branch pose and
 * motion reserve are owned by the canonical render-plan builder. This function accepts
 * only that already-materialized plan so bounds can never become an implicit
 * second topology/projection owner.
 */
export function measureSakuraFullRenderBounds(providedRenderPlan) {
    const renderPlan = requireSakuraRenderPlanV1(providedRenderPlan);
    const currentPaint = renderPlan.bounds.currentPaint;
    return Object.freeze({
        ...currentPaint,
        trunkOffsetX: renderPlan.anchor.trunkOffsetX,
        trunkBaseY: renderPlan.anchor.trunkBaseY,
        potDims: renderPlan.anchor.potDims,
        contract: ZEN_SAKURA_FULL_RENDER_BOUNDS_CONTRACT,
        renderPlanContract: ZEN_SAKURA_RENDER_PLAN_CONTRACT,
        renderPlanSignature: renderPlan.signature,
        source: 'development-projected-render-topology',
        projectionSignature: renderPlan.source.projectionSignature,
        componentBounds: renderPlan.bounds.components,
        maximumMotionReserveBounds: renderPlan.bounds.maximumMotionReserve,
        envelope: Object.freeze({
            branchCount: renderPlan.envelope.branchCount,
            terminalCount: renderPlan.envelope.terminalCount,
            cueCount: renderPlan.envelope.cueCount,
            cueRadius: renderPlan.envelope.cueRadius,
            currentMotionAngle: round(renderPlan.bounds.currentMotionAngle, 6),
            maximumMotionAngle: round(renderPlan.bounds.maximumMotionAngle, 6),
            lifeBranchSag: round(renderPlan.presentation.runtime.lifeBranchSag, 6),
        }),
    });
}

export function resolveSakuraFullRenderBoundsDiagnostics({
    sceneBounds = null,
    camera = null,
    viewportWidth = 0,
    viewportHeight = 0,
    clipEnforced = false,
    paintObservation = null,
} = {}) {
    if (
        !sceneBounds
        || typeof camera?.worldToScreen !== 'function'
        || !Number.isFinite(Number(viewportWidth))
        || !Number.isFinite(Number(viewportHeight))
        || Number(viewportWidth) <= 0
        || Number(viewportHeight) <= 0
    ) {
        return null;
    }
    const resolvedPaintObservation = paintObservation === null
        ? null
        : requireSakuraActualAlphaObservationV1(paintObservation);
    if (resolvedPaintObservation && (
        resolvedPaintObservation.identity.renderPlanSignature
            !== sceneBounds.renderPlanSignature
        || resolvedPaintObservation.identity.surface.width !== Number(viewportWidth)
        || resolvedPaintObservation.identity.surface.height !== Number(viewportHeight)
    )) {
        throw new Error('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_IDENTITY_MISMATCH');
    }
    const resolveScreenProjection = (bounds) => {
        const topLeft = camera.worldToScreen({
            x: bounds.minX,
            y: bounds.minY,
        });
        const bottomRight = camera.worldToScreen({
            x: bounds.maxX,
            y: bounds.maxY,
        });
        const screenBounds = {
            minX: Math.min(topLeft.x, bottomRight.x),
            maxX: Math.max(topLeft.x, bottomRight.x),
            minY: Math.min(topLeft.y, bottomRight.y),
            maxY: Math.max(topLeft.y, bottomRight.y),
        };
        const overflow = {
            left: Math.max(0, -screenBounds.minX),
            right: Math.max(0, screenBounds.maxX - Number(viewportWidth)),
            top: Math.max(0, -screenBounds.minY),
            bottom: Math.max(0, screenBounds.maxY - Number(viewportHeight)),
        };
        return {
            screenBounds,
            overflow,
        };
    };
    const resolveFitScale = (bounds) => {
        const padding = camera?.padding || {};
        const contentWidth = Math.max(
            1,
            Number(viewportWidth)
                - toNumber(padding.left, 0)
                - toNumber(padding.right, 0),
        );
        const contentHeight = Math.max(
            1,
            Number(viewportHeight)
                - toNumber(padding.top, 0)
                - toNumber(padding.bottom, 0),
        );
        if (Number.isFinite(Number(camera?.naturalScale))) {
            return Math.min(
                contentWidth / Math.max(1, bounds.width),
                contentHeight / Math.max(1, bounds.height),
            );
        }
        const worldAnchor = {
            x: toNumber(sceneBounds.trunkOffsetX, 0),
            y: toNumber(sceneBounds.trunkBaseY, 0),
        };
        const viewportAnchor = camera.worldToScreen(worldAnchor);
        const candidates = [
            [viewportAnchor.x - toNumber(padding.left, 0), worldAnchor.x - bounds.minX],
            [
                Number(viewportWidth) - toNumber(padding.right, 0) - viewportAnchor.x,
                bounds.maxX - worldAnchor.x,
            ],
            [viewportAnchor.y - toNumber(padding.top, 0), worldAnchor.y - bounds.minY],
            [
                Number(viewportHeight) - toNumber(padding.bottom, 0) - viewportAnchor.y,
                bounds.maxY - worldAnchor.y,
            ],
        ]
            .filter(([, worldSpan]) => worldSpan > 1e-6)
            .map(([screenSpan, worldSpan]) => screenSpan / worldSpan)
            .filter((value) => Number.isFinite(value) && value > 0);
        return candidates.length ? Math.min(...candidates) : Number(camera.scale);
    };
    const componentOrder = [
        'centerline',
        'wood',
        'ambientMotion',
        'currentSag',
        'terminals',
        'cues',
        'maximumMotionReserve',
    ];
    let previousFitScale = null;
    let previousScreenWidth = null;
    let previousScreenHeight = null;
    const componentDiagnostics = Object.freeze(Object.fromEntries(
        componentOrder
            .filter((key) => sceneBounds.componentBounds?.[key])
            .map((key) => {
                const bounds = sceneBounds.componentBounds[key];
                const projection = resolveScreenProjection(bounds);
                const screenWidth = projection.screenBounds.maxX - projection.screenBounds.minX;
                const screenHeight = projection.screenBounds.maxY - projection.screenBounds.minY;
                const fitScale = resolveFitScale(bounds);
                const entry = Object.freeze({
                    worldWidth: round(bounds.width),
                    worldHeight: round(bounds.height),
                    screenWidth: round(screenWidth),
                    screenHeight: round(screenHeight),
                    screenWidthDelta: round(
                        previousScreenWidth === null ? 0 : screenWidth - previousScreenWidth,
                    ),
                    screenHeightDelta: round(
                        previousScreenHeight === null ? 0 : screenHeight - previousScreenHeight,
                    ),
                    fitScale: round(fitScale, 6),
                    fitScaleRatioToPrevious: round(
                        previousFitScale === null || previousFitScale <= 0
                            ? 1
                            : fitScale / previousFitScale,
                        6,
                    ),
                    predictedOverflowPx: Object.freeze({
                        left: round(projection.overflow.left),
                        right: round(projection.overflow.right),
                        top: round(projection.overflow.top),
                        bottom: round(projection.overflow.bottom),
                    }),
                });
                previousFitScale = fitScale;
                previousScreenWidth = screenWidth;
                previousScreenHeight = screenHeight;
                return [key, entry];
            }),
    ));
    const currentProjection = resolveScreenProjection(sceneBounds);
    const reserveProjection = sceneBounds.maximumMotionReserveBounds
        ? resolveScreenProjection(sceneBounds.maximumMotionReserveBounds)
        : currentProjection;
    const observedAlphaBounds = resolvedPaintObservation?.status === 'observed'
        ? resolvedPaintObservation.observedAlphaBounds
        : null;
    const observedAlphaBoundsStatus = typeof resolvedPaintObservation?.status === 'string'
        ? resolvedPaintObservation.status
        : 'not-sampled';

    return Object.freeze({
        contract: sceneBounds.contract || null,
        renderPlanContract: sceneBounds.renderPlanContract || null,
        renderPlanSignature: sceneBounds.renderPlanSignature || null,
        source: sceneBounds.source || null,
        evidenceKind: observedAlphaBounds
            ? 'predicted-envelope-with-observed-tree-alpha'
            : 'predicted-render-plan-envelope',
        worldCoordinateSpace: 'bonsai-world',
        screenCoordinateSpace: 'viewport-device-pixel',
        measuredBounds: Object.freeze({
            minX: round(sceneBounds.minX),
            maxX: round(sceneBounds.maxX),
            minY: round(sceneBounds.minY),
            maxY: round(sceneBounds.maxY),
        }),
        projectedRenderPlanBounds: Object.freeze({
            minX: round(currentProjection.screenBounds.minX),
            maxX: round(currentProjection.screenBounds.maxX),
            minY: round(currentProjection.screenBounds.minY),
            maxY: round(currentProjection.screenBounds.maxY),
        }),
        observedAlphaBounds,
        observedAlphaBoundsStatus,
        observedAlphaOverflowPx: resolvedPaintObservation?.overflowPx || null,
        observedAlphaCensoredEdges: resolvedPaintObservation?.censoredEdges || null,
        viewport: Object.freeze({
            width: Number(viewportWidth),
            height: Number(viewportHeight),
        }),
        predictedOverflowPx: Object.freeze({
            left: round(currentProjection.overflow.left),
            right: round(currentProjection.overflow.right),
            top: round(currentProjection.overflow.top),
            bottom: round(currentProjection.overflow.bottom),
        }),
        predictedMaximumMotionReserveOverflowPx: Object.freeze({
            left: round(reserveProjection.overflow.left),
            right: round(reserveProjection.overflow.right),
            top: round(reserveProjection.overflow.top),
            bottom: round(reserveProjection.overflow.bottom),
        }),
        clipEnforced: clipEnforced === true,
        envelope: sceneBounds.envelope || null,
        components: componentDiagnostics,
    });
}

export default measureSakuraFullRenderBounds;
