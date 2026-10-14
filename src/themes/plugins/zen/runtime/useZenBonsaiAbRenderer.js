import { useEffect } from 'react';
import { SeededRandom } from '../model/SeededRandom';
import {
    BONSAI_CANDIDATE_EVALUATION_PROFILE,
    assertBonsaiCandidateEvaluationProfile,
} from '../model/bonsai/evaluation/bonsaiCandidateEvaluationProfile.js';
import { SAKURA_BRANCH_ORDER } from '../model/bonsai/generation/shapePriorModel.js';
import {
    renderBonsaiStructuralPreview,
} from '../model/bonsai/rendering/renderBonsaiStructuralPreview.js';
import {
    resolveBonsaiCamera,
} from '../model/bonsai/rendering/resolveBonsaiCamera.js';
import { SAKURA_GENERATION_DETAIL } from '../model/sakura/sakuraGenerationDetail.js';
import {
    requireSakuraMacroSpineGuideV1,
} from '../model/sakura/sakuraMacroSpineGuide.js';
import {
    createSakuraMacroSpineGuideConditionV1,
} from '../model/sakura/sakuraMacroSpineGuideCondition.js';
import {
    requireSakuraSpineReferenceFamilyV1,
} from '../model/sakura/sakuraSpineReferenceFamily.js';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from '../model/sakura/sakuraSpineReferenceFamilyCondition.js';
import {
    requireSakuraSingleRootFormCompositionProvenanceV1,
} from '../model/sakura/sakuraSingleRootFormCompositionAdapter.js';
import {
    syncZenBonsaiCanvasBackingStore,
} from './zenBonsaiCanvasMetrics.js';

const MAX_RETRY_FRAMES = 24;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundDuration = (value) => Number(Math.max(0, Number(value) || 0).toFixed(3));

const resolveCanvasSize = (measuredWidth, measuredHeight) => ({
    width: Math.max(0, Math.floor(measuredWidth || 0)),
    height: Math.max(0, Math.floor(measuredHeight || 0)),
});

const requireTopologyRenderInput = (candidate = null) => {
    const render = candidate?.render && typeof candidate.render === 'object'
        ? candidate.render
        : null;
    if (!render) {
        throw new Error('ZEN_AB_PREVIEW_RENDER_PROVENANCE_REQUIRED');
    }
    const evaluationProfile = assertBonsaiCandidateEvaluationProfile(render.evaluationProfile);
    if (evaluationProfile === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT) {
        if (render.generationDetail !== SAKURA_GENERATION_DETAIL.STRUCTURAL_SCOUT) {
            throw new Error('ZEN_AB_PREVIEW_STRUCTURAL_GENERATION_DETAIL_REQUIRED');
        }
        if (!Number.isFinite(Number(render.topologySeed))) {
            throw new Error('ZEN_AB_PREVIEW_TOPOLOGY_SEED_REQUIRED');
        }
        if (!render.stage || typeof render.stage !== 'object') {
            throw new Error('ZEN_AB_PREVIEW_STAGE_REQUIRED');
        }
        if (!Number.isFinite(Number(render.topologyReferenceHeight))) {
            throw new Error('ZEN_AB_PREVIEW_REFERENCE_HEIGHT_REQUIRED');
        }
    }
    const spineGuide = render.spineGuide
        ? requireSakuraMacroSpineGuideV1(render.spineGuide)
        : null;
    const spineReferenceFamily = render.spineReferenceFamily
        ? requireSakuraSpineReferenceFamilyV1(render.spineReferenceFamily)
        : null;
    const formComposition = render.formComposition
        ? requireSakuraSingleRootFormCompositionProvenanceV1(render.formComposition)
        : null;
    if (spineGuide && spineReferenceFamily) {
        throw new Error('ZEN_AB_PREVIEW_SPINE_CONDITION_CONFLICT');
    }
    if (spineGuide) {
        const condition = createSakuraMacroSpineGuideConditionV1(spineGuide);
        if (
            render.spineGuideConditionId !== condition.conditionId
            || render.spineGuideRole !== condition.role
            || render.spineGuideId !== condition.guideId
            || Number(render.spineGuideAdherence) !== condition.adherence
        ) {
            throw new Error('ZEN_AB_PREVIEW_SPINE_GUIDE_CONDITION_MISMATCH');
        }
    } else if (
        Object.prototype.hasOwnProperty.call(render, 'spineGuideConditionId')
        || Object.prototype.hasOwnProperty.call(render, 'spineGuideRole')
        || Object.prototype.hasOwnProperty.call(render, 'spineGuideId')
        || Object.prototype.hasOwnProperty.call(render, 'spineGuideAdherence')
    ) {
        throw new Error('ZEN_AB_PREVIEW_SPINE_GUIDE_PROVENANCE_INVALID');
    }
    if (spineReferenceFamily) {
        const condition = createSakuraSpineReferenceFamilyConditionV1(
            spineReferenceFamily,
        );
        if (
            render.spineReferenceFamilyConditionId !== condition.conditionId
            || render.spineReferenceFamilyRole !== condition.role
            || render.spineReferenceFamilyId !== condition.familyId
            || render.spineReferenceGuideId !== condition.referenceGuideId
            || Number(render.spineReferenceLikeness) !== condition.likeness
            || render.spineReferenceVariationPolicyId !== condition.variationPolicyId
        ) {
            throw new Error('ZEN_AB_PREVIEW_SPINE_REFERENCE_FAMILY_CONDITION_MISMATCH');
        }
        if (
            typeof render.spineReferenceVariantGuideId !== 'string'
            || !render.spineReferenceVariantGuideId.trim()
        ) {
            throw new Error('ZEN_AB_PREVIEW_SPINE_REFERENCE_VARIANT_ID_REQUIRED');
        }
    } else if (
        Object.prototype.hasOwnProperty.call(render, 'spineReferenceFamilyConditionId')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceFamilyRole')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceFamilyId')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceGuideId')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceLikeness')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceVariationPolicyId')
        || Object.prototype.hasOwnProperty.call(render, 'spineReferenceVariantGuideId')
    ) {
        throw new Error('ZEN_AB_PREVIEW_SPINE_REFERENCE_FAMILY_PROVENANCE_INVALID');
    }
    return {
        evaluationProfile,
        topologySeed: Number(render.topologySeed),
        stage: render.stage,
        referenceHeight: Number(render.topologyReferenceHeight),
        spineGuide,
        spineReferenceFamily,
        spineReferenceVariantGuideId: render.spineReferenceVariantGuideId || null,
        formComposition,
    };
};

const createSkippedCandidateResult = (reason, width, height) => ({
    rendered: false,
    reason,
    width,
    height,
    usedFallback: false,
    fallbackWidth: 0,
    fallbackHeight: 0,
});

export function useZenBonsaiAbRenderer({
    enabled = true,
    isCollectionMode,
    abPair,
    abCanvasRefA,
    abCanvasRefB,
    abWidthA,
    abHeightA,
    abWidthB,
    abHeightB,
    species,
    minABRenderSize,
    abRenderVersion = 0,
    onRenderDebugEvent = null,
    hidePot = false,
    showBranchTierDebug = false,
    canvasPixelRatio,
}) {
    useEffect(() => {
        if (!enabled || !isCollectionMode) {
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'ab',
                    status: 'idle',
                    reason: enabled ? 'collection_mode_inactive' : 'ab_preview_runtime_disabled',
                    timestamp: Date.now(),
                });
            }
            return undefined;
        }

        if (!abPair?.A || !abPair?.B) {
            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'ab',
                    status: 'waiting',
                    reason: 'ab_pair_not_ready',
                    timestamp: Date.now(),
                });
            }
            return undefined;
        }

        let retryFrameId = null;

        const prepareCandidate = (candidate, canvas, size) => {
            const totalStartedAt = nowMs();
            const safeW = size.width;
            const safeH = size.height;

            if (!candidate || !canvas) {
                return createSkippedCandidateResult('canvas_not_ready', safeW, safeH);
            }

            if (safeW < minABRenderSize || safeH < minABRenderSize) {
                return createSkippedCandidateResult('canvas_too_small', safeW, safeH);
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return createSkippedCandidateResult('ab_context_unavailable', safeW, safeH);
            }

            const renderInput = requireTopologyRenderInput(candidate);
            const isStructuralScout = (
                renderInput.evaluationProfile
                === BONSAI_CANDIDATE_EVALUATION_PROFILE.STRUCTURAL_SCOUT
            );
            const generationStartedAt = nowMs();
            const topology = isStructuralScout
                ? (() => {
                    if (typeof species?.generateStructuralTopology !== 'function') {
                        throw new Error('ZEN_AB_PREVIEW_STRUCTURAL_GENERATOR_REQUIRED');
                    }
                    const rng = new SeededRandom(renderInput.topologySeed);
                    return species.generateStructuralTopology(
                        rng,
                        renderInput.stage,
                        renderInput.referenceHeight,
                        candidate.phenotype,
                        {
                            ...(renderInput.spineGuide
                                ? { spineGuide: renderInput.spineGuide }
                                : {}),
                            ...(renderInput.spineReferenceFamily
                                ? { spineReferenceFamily: renderInput.spineReferenceFamily }
                                : {}),
                            ...(renderInput.formComposition
                                ? {
                                    formId: renderInput.formComposition.formId,
                                    formVariantSeed: renderInput.formComposition.variantSeed,
                                }
                                : {}),
                        },
                    );
                })()
                : candidate?.topology;
            const generationCompletedAt = nowMs();
            if (!topology || topology.type !== 'branch') {
                throw new Error('ZEN_AB_PREVIEW_MATERIALIZED_TOPOLOGY_REQUIRED');
            }
            if (renderInput.spineReferenceFamily) {
                const replayVariantGuideId = (
                    topology?.trunkDepthModel?.spineReferenceVariantGuideId
                );
                if (
                    typeof replayVariantGuideId !== 'string'
                    || !replayVariantGuideId.trim()
                    || (
                        renderInput.spineReferenceVariantGuideId
                        && replayVariantGuideId
                            !== renderInput.spineReferenceVariantGuideId
                    )
                ) {
                    throw new Error('ZEN_AB_PREVIEW_SPINE_REFERENCE_VARIANT_REPLAY_MISMATCH');
                }
            }
            if (renderInput.formComposition) {
                const replayForm = topology?.formCompositionProvenance;
                if (
                    !replayForm
                    || replayForm.planId !== renderInput.formComposition.planId
                    || replayForm.formId !== renderInput.formComposition.formId
                    || replayForm.variantSeed !== renderInput.formComposition.variantSeed
                ) {
                    throw new Error('ZEN_AB_PREVIEW_FORM_COMPOSITION_REPLAY_MISMATCH');
                }
            } else if (topology?.formCompositionProvenance) {
                throw new Error('ZEN_AB_PREVIEW_FORM_COMPOSITION_PROVENANCE_UNDECLARED');
            }
            const canvasMetrics = syncZenBonsaiCanvasBackingStore(canvas, safeW, safeH, canvasPixelRatio);
            const boundsStartedAt = nowMs();
            const candidateSceneBounds = typeof species?.measureSceneBounds === 'function'
                ? species.measureSceneBounds(topology, {
                    includePot: !hidePot,
                    includeGroundShadow: !hidePot,
                    includeTerminals: false,
                    maxBranchOrder: SAKURA_BRANCH_ORDER.SECONDARY_BRANCH,
                })
                : (() => {
                    throw new Error('ZEN_AB_PREVIEW_SCENE_BOUNDS_REQUIRED');
                })();
            const boundsCompletedAt = nowMs();
            const fitCamera = resolveBonsaiCamera({
                viewportWidth: canvasMetrics.pixelWidth,
                viewportHeight: canvasMetrics.pixelHeight,
                sceneBounds: candidateSceneBounds,
                preset: 'ab',
            });

            return {
                prepared: true,
                totalStartedAt,
                safeW,
                safeH,
                ctx,
                canvasMetrics,
                topology,
                sceneBounds: candidateSceneBounds,
                fitCamera,
                evaluationProfile: renderInput.evaluationProfile,
                isStructuralScout,
                topologyGenerationMs: roundDuration(
                    generationCompletedAt - generationStartedAt,
                ),
                sceneBoundsMs: roundDuration(boundsCompletedAt - boundsStartedAt),
            };
        };

        const drawPreparedCandidate = (prepared, sharedScale) => {
            const {
                totalStartedAt,
                safeW,
                safeH,
                ctx,
                canvasMetrics,
                topology,
                sceneBounds,
                evaluationProfile,
                isStructuralScout,
                topologyGenerationMs,
                sceneBoundsMs,
            } = prepared;
            const candidateCamera = resolveBonsaiCamera({
                viewportWidth: canvasMetrics.pixelWidth,
                viewportHeight: canvasMetrics.pixelHeight,
                sceneBounds,
                preset: 'ab',
                scaleCap: sharedScale,
            });
            ctx.clearRect(0, 0, canvasMetrics.pixelWidth, canvasMetrics.pixelHeight);
            const drawStartedAt = nowMs();
            const preview = renderBonsaiStructuralPreview({
                ctx,
                topology,
                camera: candidateCamera,
                sceneBounds,
                strictStructural: isStructuralScout,
                options: {
                    hidePot,
                    showBranchTierDebug,
                },
            });
            const drawCompletedAt = nowMs();

            return {
                rendered: true,
                reason: 'rendered',
                width: safeW,
                height: safeH,
                pixelWidth: canvasMetrics.pixelWidth,
                pixelHeight: canvasMetrics.pixelHeight,
                usedFallback: false,
                fallbackWidth: 0,
                fallbackHeight: 0,
                evaluationProfile,
                preview,
                camera: {
                    scale: candidateCamera.scale,
                    naturalScale: candidateCamera.naturalScale,
                    pairScaleLocked: true,
                },
                timing: {
                    topologyGenerationMs,
                    sceneBoundsMs,
                    drawMs: roundDuration(drawCompletedAt - drawStartedAt),
                    totalMs: roundDuration(drawCompletedAt - totalStartedAt),
                },
            };
        };

        const renderWithRetry = (attempt = 0) => {
            const canvasA = abCanvasRefA.current;
            const canvasB = abCanvasRefB.current;
            const resolvedSizeA = resolveCanvasSize(abWidthA, abHeightA);
            const resolvedSizeB = resolveCanvasSize(abWidthB, abHeightB);
            const isCanvasReady = Boolean(canvasA && canvasB);
            const isSizeReadyA = resolvedSizeA.width >= minABRenderSize && resolvedSizeA.height >= minABRenderSize;
            const isSizeReadyB = resolvedSizeB.width >= minABRenderSize && resolvedSizeB.height >= minABRenderSize;
            const areBothSizesReady = isSizeReadyA && isSizeReadyB;

            if (!isCanvasReady || !areBothSizesReady) {
                const waitReason = !isCanvasReady
                    ? 'canvas_not_ready'
                    : 'observer_size_not_ready';
                if (attempt < MAX_RETRY_FRAMES) {
                    if (onRenderDebugEvent && (attempt === 0 || attempt === 6 || attempt === 12)) {
                        onRenderDebugEvent({
                            channel: 'ab',
                            status: 'waiting',
                            reason: waitReason,
                            attempt: attempt + 1,
                            observerSizeA: { width: Math.floor(abWidthA || 0), height: Math.floor(abHeightA || 0) },
                            observerSizeB: { width: Math.floor(abWidthB || 0), height: Math.floor(abHeightB || 0) },
                            resolvedSizeA,
                            resolvedSizeB,
                            usedFallback: false,
                            timestamp: Date.now(),
                        });
                    }
                    retryFrameId = requestAnimationFrame(() => renderWithRetry(attempt + 1));
                    return;
                }

                if (onRenderDebugEvent) {
                    onRenderDebugEvent({
                        channel: 'ab',
                        status: 'skipped',
                        reason: waitReason,
                        attempt: attempt + 1,
                        observerSizeA: { width: Math.floor(abWidthA || 0), height: Math.floor(abHeightA || 0) },
                        observerSizeB: { width: Math.floor(abWidthB || 0), height: Math.floor(abHeightB || 0) },
                        resolvedSizeA,
                        resolvedSizeB,
                        usedFallback: false,
                        timestamp: Date.now(),
                    });
                }
                return;
            }

            const preparedA = prepareCandidate(abPair.A, canvasA, resolvedSizeA);
            const preparedB = prepareCandidate(abPair.B, canvasB, resolvedSizeB);
            const bothPrepared = preparedA.prepared === true && preparedB.prepared === true;
            // Compare morphology at one physical scale; per-candidate auto-fit
            // would erase relative height, mass, and pot/tree proportion.
            const sharedScale = bothPrepared
                ? Math.min(preparedA.fitCamera.scale, preparedB.fitCamera.scale)
                : null;
            const resultA = bothPrepared
                ? drawPreparedCandidate(preparedA, sharedScale)
                : preparedA;
            const resultB = bothPrepared
                ? drawPreparedCandidate(preparedB, sharedScale)
                : preparedB;
            const bothRendered = resultA.rendered && resultB.rendered;

            if (bothRendered) {
                if (onRenderDebugEvent) {
                    onRenderDebugEvent({
                        channel: 'ab',
                        status: 'rendered',
                        reason: 'rendered',
                        attempt: attempt + 1,
                        observerSizeA: { width: Math.floor(abWidthA || 0), height: Math.floor(abHeightA || 0) },
                        observerSizeB: { width: Math.floor(abWidthB || 0), height: Math.floor(abHeightB || 0) },
                        resolvedSizeA,
                        resolvedSizeB,
                        candidateA: {
                            evaluationProfile: resultA.evaluationProfile,
                            preview: resultA.preview,
                            camera: resultA.camera,
                            timing: resultA.timing,
                        },
                        candidateB: {
                            evaluationProfile: resultB.evaluationProfile,
                            preview: resultB.preview,
                            camera: resultB.camera,
                            timing: resultB.timing,
                        },
                        usedFallback: false,
                        timestamp: Date.now(),
                    });
                }
                return;
            }

            if (attempt < MAX_RETRY_FRAMES) {
                if (onRenderDebugEvent && (attempt === 0 || attempt === 6 || attempt === 12)) {
                    onRenderDebugEvent({
                        channel: 'ab',
                        status: 'waiting',
                        reason: `${resultA.reason}|${resultB.reason}`,
                        attempt: attempt + 1,
                        observerSizeA: { width: Math.floor(abWidthA || 0), height: Math.floor(abHeightA || 0) },
                        observerSizeB: { width: Math.floor(abWidthB || 0), height: Math.floor(abHeightB || 0) },
                        resolvedSizeA,
                        resolvedSizeB,
                        usedFallback: false,
                        timestamp: Date.now(),
                    });
                }
                retryFrameId = requestAnimationFrame(() => renderWithRetry(attempt + 1));
                return;
            }

            if (onRenderDebugEvent) {
                onRenderDebugEvent({
                    channel: 'ab',
                    status: 'skipped',
                    reason: `${resultA.reason}|${resultB.reason}`,
                    attempt: attempt + 1,
                    observerSizeA: { width: Math.floor(abWidthA || 0), height: Math.floor(abHeightA || 0) },
                    observerSizeB: { width: Math.floor(abWidthB || 0), height: Math.floor(abHeightB || 0) },
                    resolvedSizeA,
                    resolvedSizeB,
                    usedFallback: false,
                    timestamp: Date.now(),
                });
            }
        };

        renderWithRetry();

        return () => {
            if (retryFrameId) {
                cancelAnimationFrame(retryFrameId);
                retryFrameId = null;
            }
        };
    }, [
        enabled,
        isCollectionMode,
        abPair,
        abWidthA,
        abHeightA,
        abWidthB,
        abHeightB,
        species,
        minABRenderSize,
        abCanvasRefA,
        abCanvasRefB,
        abRenderVersion,
        onRenderDebugEvent,
        hidePot,
        showBranchTierDebug,
        canvasPixelRatio,
    ]);
}
