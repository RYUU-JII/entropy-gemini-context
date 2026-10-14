import { ShapePriorModel, SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import {
    createTrunkPathPlanV1,
    requireTrunkPathPlanV1,
} from '../bonsai/generation/trunkPathPlanV1';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import { sampleCenteredNoise } from './sakuraBranchDynamics';
import { normalizeAngle, shortestAngleDelta } from './sakuraAngleUtils';
import { clamp, lerp } from './sakuraMath';
import {
    createSakuraTrunkArticulatedBendFlowStateV1,
    resolveSakuraTrunkArticulatedBendStepV1,
} from './sakuraTrunkArticulatedBendFlow';
import {
    resolveSakuraTrunkGeminiTaperWidth,
    resolveSakuraTrunkTaperWidthAtArc,
} from './sakuraTrunkGeminiParams';
import {
    createSakuraMacroSpineGuideV1,
    requireSakuraMacroSpineGuideV1,
    sampleSakuraMacroSpineShapeAtArcNorm,
    simplifySakuraSpineStrokeToMacroGuideV1,
    subdivideSakuraMacroSpineShapeV1,
    SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY,
} from './sakuraMacroSpineGuide';
import {
    conditionSakuraMacroSpineIntentPlanV1,
    createSakuraMacroSpineIntentDiagnosticGuideV1,
    createSakuraMacroSpineIntentPlanV1,
    fitSakuraMacroSpineIntentPlanV1,
    SAKURA_MACRO_SPINE_INTENT_PLANNER_ID,
} from './sakuraMacroSpineIntentPlan';
import {
    requireSakuraSpineReferenceFamilyV1,
    sampleSakuraSpineReferenceFamilyV1,
} from './sakuraSpineReferenceFamily';

export const SAKURA_TRUNK_PATH_PLANNER_ID = SAKURA_MACRO_SPINE_INTENT_PLANNER_ID;
export const SAKURA_TRUNK_PATH_LEGACY_PLANNER_ID = 'sakura_segment_flow_proposal_v1';
export const SAKURA_TRUNK_LATENT_INTEGRATION_STEPS = 32;

const TWO_PI = Math.PI * 2;
const TRUNK_INTEGRATION_REFERENCE_STEPS = 100;
const CASCADE_SWEEP_RAD = (110 * Math.PI) / 180;
const MIN_TRUNK_CURVE_ANGLE_LIMIT = Math.PI / 24;
const MAX_TRUNK_CURVE_ANGLE_LIMIT = Math.PI / 8;
const MACRO_STATION_TURN_SAMPLE_ARC = 0.002;

const smoothstep = (edge0, edge1, value) => {
    const t = clamp((Number(value) - edge0) / Math.max(1e-8, edge1 - edge0), 0, 1);
    return t * t * (3 - (2 * t));
};

const createTrunkCurveFlow = ({
    geminiParams,
    gene,
    depthLimit = 12,
    rootAngle = -Math.PI / 2,
}) => {
    const resolved = geminiParams || {};
    const backboneTiltBias = clamp(Number(gene?.trunkBackboneTiltBias) || 0, -1, 1);
    return {
        tier: 'trunk',
        step: 0,
        depthLimit: Math.max(2, Math.round(Number(depthLimit) || 2)),
        currentAngle: Number.isFinite(Number(rootAngle)) ? Number(rootAngle) : -Math.PI / 2,
        mainCurve: Number(resolved.mainCurve) || 0,
        waveFreq: Math.max(0, Number(resolved.waveFreq) || 0),
        waveAmp: Math.max(0, Number(resolved.waveAmp) || 0),
        roughness: Math.max(0, Number(resolved.roughness) || 0),
        phase: Number(resolved.phase) || 0,
        kinkChance: clamp(Number(gene?.trunkKinkChance) || 0, 0, 1),
        kinkAngleRad: clamp(Number(gene?.trunkKinkAngle) || 0, 0, Math.PI * 0.48),
        trunkStyle: clamp(Number(gene?.trunkStyle) || 0, 0, 1),
        backboneLockStrength: clamp(
            Number.isFinite(Number(gene?.trunkBackboneLockStrength))
                ? Number(gene.trunkBackboneLockStrength)
                : 0.62,
            0,
            1,
        ),
        articulatedBendFlow: createSakuraTrunkArticulatedBendFlowStateV1(),
        descentIntensity: smoothstep(0.58, 0.9, Math.abs(backboneTiltBias)),
        descentDirection: Math.sign(backboneTiltBias) || 1,
    };
};

const resolveTrunkGeminiContinuation = ({
    flow,
    attachAngle = 0,
    localRandom = null,
}) => {
    const depthSpan = Math.max(1, Number(flow.depthLimit) || 1);
    const step = Math.max(1, (Number(flow.step) || 0) + 1);
    const t = clamp((step - 0.5) / depthSpan, 0, 1);
    const driftStepScale = TRUNK_INTEGRATION_REFERENCE_STEPS / depthSpan;
    const roughnessStepScale = Math.sqrt(Math.max(1e-6, driftStepScale));
    const baseAngle = Number.isFinite(Number(flow.currentAngle))
        ? Number(flow.currentAngle)
        : (Number.isFinite(Number(attachAngle)) ? Number(attachAngle) : -Math.PI / 2);
    const descentIntensity = clamp(Number(flow.descentIntensity) || 0, 0, 1);
    const curveForce = ((Number(flow.mainCurve) || 0) / 5000)
        * driftStepScale
        * (1 - (descentIntensity * 0.8));
    const waveForce = Math.sin(
        (t * TWO_PI * Math.max(0, Number(flow.waveFreq) || 0))
        + (Number(flow.phase) || 0),
    ) * ((Number(flow.waveAmp) || 0) / 1000) * driftStepScale;
    const noise = sampleCenteredNoise(
        localRandom,
        (Math.max(0, Number(flow.roughness) || 0) / 50) * roughnessStepScale,
        `trunk_gemini_noise_${step}`,
    );
    const articulatedBend = resolveSakuraTrunkArticulatedBendStepV1({
        bendFlow: flow.articulatedBendFlow,
        flow,
        step,
        depthSpan,
        localRandom,
    });
    const depthGravityGain = 0.52 + (Math.pow(t, 1.22) * 0.96);
    const descentDirection = Number(flow.descentDirection) < 0 ? -1 : 1;
    const gravityTargetAngle = (-Math.PI / 2)
        + (descentDirection * CASCADE_SWEEP_RAD * descentIntensity);
    // Extreme tilt is a posture latent, not a small local wobble. Give it enough
    // continuous attraction to cross horizontal and reach cascade space before
    // the macro guide is fitted; the C1 fit then removes integration chatter.
    const gravityStrength = 0.05 + (descentIntensity * 0.13);
    const gravityForce = shortestAngleDelta(gravityTargetAngle, baseAngle)
        * gravityStrength
        * depthGravityGain
        * driftStepScale;
    const turnDelta = curveForce
        + waveForce
        + noise
        + gravityForce
        + articulatedBend.turnDeltaRad;
    const nextAngle = normalizeAngle(baseAngle + turnDelta);
    const desiredRelativeOffset = shortestAngleDelta(nextAngle, attachAngle);

    return {
        desiredRelativeOffset,
        articulatedBend: articulatedBend.event ? Object.freeze({
            kind: articulatedBend.event.kind,
            supportStartArcNorm: articulatedBend.event.supportStartArcNorm,
            supportEndArcNorm: articulatedBend.event.supportEndArcNorm,
            totalAngleRad: articulatedBend.event.angleRad,
            stepTurnDeltaRad: articulatedBend.turnDeltaRad,
            started: articulatedBend.started,
            completed: articulatedBend.completed,
        }) : null,
        flow: {
            ...flow,
            step,
            currentAngle: normalizeAngle(attachAngle + desiredRelativeOffset),
            articulatedBendFlow: articulatedBend.flow,
        },
    };
};

const resolveTrunkCurveAngleLimit = ({
    trunkGeminiParams,
    trunkSegmentLimit,
    trunkMainDepth,
}) => {
    const params = trunkGeminiParams || {};
    const segments = Math.max(1, Number(trunkSegmentLimit) || 1);
    const mainCurveNorm = clamp(Math.abs(Number(params?.mainCurve) || 0) / 200, 0, 1);
    const waveAmpNorm = clamp(Math.max(0, Number(params?.waveAmp) || 0) / 140, 0, 1);
    const roughnessNorm = clamp(Math.max(0, Number(params?.roughness) || 0) / 45, 0, 1);
    const segmentDensityNorm = clamp((segments - 30) / 20, 0, 1);
    const depthNorm = clamp(
        (Math.max(1, Number(trunkMainDepth) || 1) - 1)
            / Math.max(1, (Number(trunkSegmentLimit) || 1) - 1),
        0,
        1,
    );
    const movementEnergy = clamp(
        (mainCurveNorm * 0.42)
        + (waveAmpNorm * 0.34)
        + (roughnessNorm * 0.24),
        0,
        1,
    );
    const expression = clamp((movementEnergy * 0.82) + (segmentDensityNorm * 0.18), 0, 1);
    const depthDamping = lerp(1, 0.82, Math.pow(depthNorm, 1.2));
    return lerp(
        MIN_TRUNK_CURVE_ANGLE_LIMIT,
        MAX_TRUNK_CURVE_ANGLE_LIMIT,
        expression,
    ) * depthDamping;
};

const resolveTrunkCurveIn = ({ length, angleDelta, curveAngleLimit }) => (
    Math.tan(clamp(Number(angleDelta) || 0, -curveAngleLimit, curveAngleLimit))
    * (Math.max(1e-3, Number(length) || 0) / 3)
);

const resolveTrunkCurveOut = ({ length, angleDelta, curveAngleLimit }) => (
    -Math.tan(clamp(Number(angleDelta) || 0, -curveAngleLimit, curveAngleLimit))
    * (Math.max(1e-3, Number(length) || 0) / 3)
);

const requireRootState = (state) => {
    if (!state || typeof state !== 'object') {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_ROOT_STATE_REQUIRED');
    }
    [
        'currentDepth',
        'currentX',
        'currentY',
        'length',
        'width',
        'parentAngle',
        'lastDir',
        'trunkMainDepth',
        'trunkBaseWidth',
        'trunkSegmentLength',
    ].forEach((field) => {
        if (!Number.isFinite(Number(state[field]))) {
            throw new Error(`ZEN_SAKURA_TRUNK_PATH_ROOT_STATE_INVALID:${field}`);
        }
    });
    return state;
};

const createLegacySakuraTrunkPathPlanV1 = ({
    gene,
    trunkGeminiParams,
    trunkSegmentLimit,
    structuralMaxDepth,
    rootState,
    rootNodeRandom,
} = {}) => {
    const initialState = requireRootState(rootState);
    if (!gene || typeof gene !== 'object') {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_GENE_REQUIRED');
    }
    if (!trunkGeminiParams || typeof trunkGeminiParams !== 'object') {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_GEMINI_PARAMS_REQUIRED');
    }
    if (typeof rootNodeRandom?.next !== 'function' || typeof rootNodeRandom?.fork !== 'function') {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_RANDOM_REQUIRED');
    }
    if (initialState.currentDepth !== 1 || initialState.trunkMainDepth !== 1) {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_ROOT_DEPTH_INVALID');
    }

    if (!Number.isSafeInteger(trunkSegmentLimit) || trunkSegmentLimit < 1) {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_SEGMENT_LIMIT_INVALID');
    }
    if (!Number.isSafeInteger(structuralMaxDepth) || structuralMaxDepth < 1) {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_STRUCTURAL_DEPTH_INVALID');
    }
    const resolvedTrunkSegmentLimit = trunkSegmentLimit;
    const resolvedStructuralMaxDepth = structuralMaxDepth;
    const spans = [];
    let state = {
        ...initialState,
        nodeRandom: rootNodeRandom,
        trunkFlow: createTrunkCurveFlow({
            geminiParams: trunkGeminiParams,
            gene,
            depthLimit: resolvedTrunkSegmentLimit,
            rootAngle: initialState.parentAngle,
        }),
        trunkCarryTurn: 0,
    };

    while (true) {
        const {
            currentDepth,
            currentX,
            currentY,
            length,
            width,
            parentAngle,
            lastDir,
            nodeRandom,
            trunkMainDepth,
            trunkFlow,
            trunkCarryTurn,
            trunkBaseWidth,
            trunkSegmentLength,
        } = state;
        const continuation = resolveTrunkGeminiContinuation({
            flow: trunkFlow,
            attachAngle: parentAngle,
            localRandom: nodeRandom,
        });
        const previewRelativeOffset = Number(continuation.desiredRelativeOffset) || 0;
        const curveAngleLimit = resolveTrunkCurveAngleLimit({
            trunkGeminiParams,
            trunkSegmentLimit: resolvedTrunkSegmentLimit,
            trunkMainDepth,
        });
        const curveIn = resolveTrunkCurveIn({
            length,
            angleDelta: (Number(trunkCarryTurn) || 0) * 0.3,
            curveAngleLimit,
        });
        const curveOut = resolveTrunkCurveOut({
            length,
            angleDelta: previewRelativeOffset * 0.62,
            curveAngleLimit,
        });
        const curve = (curveIn + curveOut) * 0.5;
        const branchSegment = BranchGeometryModel.createCubicSegment({
            startX: currentX,
            startY: currentY,
            angle: parentAngle,
            length,
            curveIn,
            curveOut,
        });
        const isTerminal = trunkMainDepth >= resolvedTrunkSegmentLimit;
        let childState = null;

        if (!isTerminal) {
            const nextLength = Math.max(0.08, Number(trunkSegmentLength) || 0.08);
            const nextWidth = resolveSakuraTrunkGeminiTaperWidth({
                baseWidth: trunkBaseWidth,
                segmentIndex: trunkMainDepth,
                segments: resolvedTrunkSegmentLimit,
                minWidth: 1,
            });
            const childAttach = BranchGeometryModel.pointAndAngleAt(branchSegment, 1);
            const desiredChildAbsoluteAngle = normalizeAngle(parentAngle + previewRelativeOffset);
            const finalRelativeOffset = shortestAngleDelta(
                desiredChildAbsoluteAngle,
                childAttach.angle,
            );
            const finalChildAngle = normalizeAngle(childAttach.angle + finalRelativeOffset);
            childState = {
                currentDepth: currentDepth + 1,
                currentX: childAttach.x,
                currentY: childAttach.y,
                length: nextLength,
                width: nextWidth,
                parentAngle: finalChildAngle,
                lastDir: Math.sign(finalRelativeOffset) || lastDir || 1,
                trunkMainDepth: trunkMainDepth + 1,
                angleOffset: finalRelativeOffset,
            };
        }

        spans.push({
            index: spans.length,
            currentDepth,
            currentX,
            currentY,
            length,
            width,
            parentAngle,
            lastDir,
            trunkMainDepth,
            trunkSegmentLength,
            curve,
            curveIn,
            curveOut,
            previewRelativeOffset,
            articulatedBend: continuation.articulatedBend,
            branchSegment,
            isTerminal,
            childState,
        });

        if (isTerminal) {
            break;
        }

        state = {
            ...childState,
            nodeRandom: nodeRandom.fork({
                depth: currentDepth + 1,
                nodeRole: ShapePriorModel.resolveSakuraOrderName(SAKURA_BRANCH_ORDER.TRUNK),
                nodeSlot: 0,
                decisionType: 'trunk_main',
            }),
            trunkFlow: continuation.flow,
            trunkCarryTurn: previewRelativeOffset * 0.42,
            trunkBaseWidth,
            trunkSegmentLength,
        };
    }

    return createTrunkPathPlanV1({
        plannerId: SAKURA_TRUNK_PATH_LEGACY_PLANNER_ID,
        trunkSegmentLimit: resolvedTrunkSegmentLimit,
        structuralMaxDepth: resolvedStructuralMaxDepth,
        spans,
    });
};

const resolveProceduralMacroGuide = ({ legacyPlan, trunkTargetHeight }) => {
    const scale = Math.max(1, Number(trunkTargetHeight) || 1);
    const points = [];
    legacyPlan.spans.forEach((span, index) => {
        if (index === 0) {
            points.push({
                x: span.branchSegment.startX / scale,
                y: span.branchSegment.startY / scale,
            });
        }
        const midpoint = BranchGeometryModel.pointAt(span.branchSegment, 0.5);
        points.push({ x: midpoint.x / scale, y: midpoint.y / scale });
        points.push({
            x: span.branchSegment.endX / scale,
            y: span.branchSegment.endY / scale,
        });
    });
    const articulatedSupports = legacyPlan.spans
        .filter((span) => span.articulatedBend?.started)
        .map((span) => ({
            startArcNorm: span.articulatedBend.supportStartArcNorm,
            endArcNorm: span.articulatedBend.supportEndArcNorm,
        }));
    const simplified = simplifySakuraSpineStrokeToMacroGuideV1({
        points,
        adherence: 0,
        articulatedSupports,
    });
    return createSakuraMacroSpineGuideV1({
        anchors: simplified.anchors,
        adherence: 0,
        source: 'procedural',
    });
};

export const createSakuraLegacyTrunkMacroGuideProposalV1 = ({
    gene,
    trunkGeminiParams,
    structuralMaxDepth,
    rootState,
    rootNodeRandom,
    trunkTargetHeight,
} = {}) => {
    const legacyPlan = createLegacySakuraTrunkPathPlanV1({
        gene,
        trunkGeminiParams,
        trunkSegmentLimit: SAKURA_TRUNK_LATENT_INTEGRATION_STEPS,
        structuralMaxDepth,
        rootState,
        rootNodeRandom,
    });
    const guide = resolveProceduralMacroGuide({ legacyPlan, trunkTargetHeight });
    return Object.freeze({
        plannerId: SAKURA_TRUNK_PATH_LEGACY_PLANNER_ID,
        role: 'proposal_ablation_only',
        legacyPlan,
        guide,
    });
};

const projectGuideCubicToBranchSegment = (geometry, scale, startOverride = null) => {
    const startX = Number.isFinite(startOverride?.x)
        ? startOverride.x
        : geometry.startX * scale;
    const startY = Number.isFinite(startOverride?.y)
        ? startOverride.y
        : geometry.startY * scale;
    const endX = geometry.endX * scale;
    const endY = geometry.endY * scale;
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const cp1X = geometry.cp1X * scale;
    const cp1Y = geometry.cp1Y * scale;
    const cp2X = geometry.cp2X * scale;
    const cp2Y = geometry.cp2Y * scale;
    const branchSegment = BranchGeometryModel.createExactCubicSegment({
        startX,
        startY,
        cp1X,
        cp1Y,
        cp2X,
        cp2Y,
        endX,
        endY,
    });
    return {
        angle,
        length,
        curveIn: branchSegment.curveIn,
        curveOut: branchSegment.curveOut,
        exactCubicControl: BranchGeometryModel.createExactCubicControl(branchSegment),
        branchSegment,
    };
};

const materializeAdaptiveTrunkSpans = ({
    adaptive,
    trunkTargetHeight,
    rootState,
}) => {
    const spanCount = adaptive.spans.length;
    const projected = [];
    adaptive.spans.forEach((span) => {
        const previousEnd = projected.length
            ? {
                x: projected.at(-1).projected.branchSegment.endX,
                y: projected.at(-1).projected.branchSegment.endY,
            }
            : null;
        projected.push({
            ...span,
            projected: projectGuideCubicToBranchSegment(
                span.geometry,
                trunkTargetHeight,
                previousEnd,
            ),
        });
    });
    const referenceSegmentLength = Math.max(0.08, trunkTargetHeight / 12);
    let carriedLastDir = rootState.lastDir || 1;
    return projected.map((entry, index) => {
        const { projected: geometry } = entry;
        const next = projected[index + 1]?.projected || null;
        const currentDepth = Number(rootState.currentDepth);
        const trunkMainDepth = index + 1;
        const isTerminal = index === spanCount - 1;
        const endTangent = BranchGeometryModel.pointAndAngleAt(geometry.branchSegment, 1);
        const finalRelativeOffset = next
            ? shortestAngleDelta(next.angle, endTangent.angle)
            : 0;
        const lastDir = carriedLastDir;
        const width = resolveSakuraTrunkTaperWidthAtArc({
            baseWidth: rootState.trunkBaseWidth,
            arcNorm: entry.arcStartNorm,
            minWidth: 1,
        });
        const arcEndWidth = resolveSakuraTrunkTaperWidthAtArc({
            baseWidth: rootState.trunkBaseWidth,
            arcNorm: entry.arcEndNorm,
            minWidth: 1,
        });
        const nextWidth = isTerminal
            ? width
            : resolveSakuraTrunkTaperWidthAtArc({
                baseWidth: rootState.trunkBaseWidth,
                arcNorm: projected[index + 1].arcStartNorm,
                minWidth: 1,
            });
        const childLastDir = Math.sign(finalRelativeOffset) || lastDir;
        const childState = isTerminal ? null : {
            currentDepth,
            currentX: geometry.branchSegment.endX,
            currentY: geometry.branchSegment.endY,
            length: next.length,
            width: nextWidth,
            parentAngle: next.angle,
            lastDir: childLastDir,
            trunkMainDepth: trunkMainDepth + 1,
            angleOffset: finalRelativeOffset,
        };
        const materializedSpan = {
            index,
            currentDepth,
            currentX: geometry.branchSegment.startX,
            currentY: geometry.branchSegment.startY,
            length: geometry.length,
            width,
            parentAngle: geometry.angle,
            lastDir,
            trunkMainDepth,
            trunkSegmentLength: referenceSegmentLength,
            curve: (geometry.curveIn + geometry.curveOut) * 0.5,
            curveIn: geometry.curveIn,
            curveOut: geometry.curveOut,
            exactCubicControl: geometry.exactCubicControl,
            previewRelativeOffset: finalRelativeOffset,
            branchSegment: geometry.branchSegment,
            arcStartNorm: entry.arcStartNorm,
            arcEndNorm: entry.arcEndNorm,
            arcEndWidth,
            guideSegmentIndex: entry.sourceSegmentIndex,
            isTerminal,
            childState,
        };
        carriedLastDir = childLastDir;
        return materializedSpan;
    });
};

export const resolveSakuraTrunkMacroPhysicalGeometrySpansV1 = (trunkPathPlan) => {
    const plan = requireTrunkPathPlanV1(trunkPathPlan);
    const targetHeight = Number(plan.trunkTargetHeight);
    if (
        typeof plan.guideShapeId !== 'string'
        || plan.shape?.shapeId !== plan.guideShapeId
        || plan.adaptiveDiscretization?.shapeId !== plan.guideShapeId
        || !Number.isFinite(targetHeight)
        || targetHeight <= 0
    ) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_PHYSICAL_GEOMETRY_SHAPE_MISMATCH');
    }
    const toPhysicalGeometrySpans = (spans) => spans.map((span, index) => ({
        index,
        entryAngle: index === 0
            ? span.parentAngle
            : spans[index - 1]?.childState?.angleOffset,
        length: span.length,
        width: span.width,
        curve: span.curve,
        curveIn: span.curveIn,
        curveOut: span.curveOut,
        arcStartNorm: span.arcStartNorm,
        arcEndNorm: span.arcEndNorm,
    }));
    const canonicalAdaptive = subdivideSakuraMacroSpineShapeV1(
        plan.shape,
        plan.adaptiveDiscretization?.policy,
    );
    const rootSpan = plan.spans[0];
    const canonicalSpans = materializeAdaptiveTrunkSpans({
        adaptive: canonicalAdaptive,
        trunkTargetHeight: targetHeight,
        rootState: {
            currentDepth: rootSpan.currentDepth,
            currentX: rootSpan.currentX,
            currentY: rootSpan.currentY,
            length: rootSpan.length,
            width: rootSpan.width,
            parentAngle: rootSpan.parentAngle,
            lastDir: rootSpan.lastDir,
            trunkMainDepth: rootSpan.trunkMainDepth,
            trunkBaseWidth: rootSpan.width,
            trunkSegmentLength: rootSpan.trunkSegmentLength,
        },
    });
    const actual = toPhysicalGeometrySpans(plan.spans);
    const canonical = toPhysicalGeometrySpans(canonicalSpans);
    if (actual.length !== canonical.length) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_PHYSICAL_GEOMETRY_SPAN_COUNT_DRIFT');
    }
    const fields = [
        'entryAngle',
        'length',
        'width',
        'curve',
        'curveIn',
        'curveOut',
        'arcStartNorm',
        'arcEndNorm',
    ];
    actual.forEach((span, index) => {
        fields.forEach((field) => {
            const actualValue = Number(span[field]);
            const canonicalValue = Number(canonical[index]?.[field]);
            if (
                !Number.isFinite(actualValue)
                || !Number.isFinite(canonicalValue)
                || Math.abs(actualValue - canonicalValue) > 1e-7
            ) {
                throw new Error(
                    `ZEN_SAKURA_TRUNK_MACRO_PHYSICAL_GEOMETRY_DRIFT:${index}.${field}`,
                );
            }
        });
        const actualControl = plan.spans[index]?.exactCubicControl;
        const canonicalControl = canonicalSpans[index]?.exactCubicControl;
        [
            'cp1Along',
            'cp1Normal',
            'cp2Along',
            'cp2Normal',
        ].forEach((field) => {
            const actualValue = Number(actualControl?.[field]);
            const canonicalValue = Number(canonicalControl?.[field]);
            if (
                actualControl?.version !== 1
                || canonicalControl?.version !== 1
                || !Number.isFinite(actualValue)
                || !Number.isFinite(canonicalValue)
                || Math.abs(actualValue - canonicalValue) > 1e-7
            ) {
                throw new Error(
                    `ZEN_SAKURA_TRUNK_MACRO_PHYSICAL_GEOMETRY_EXACT_CONTROL_DRIFT:${index}.${field}`,
                );
            }
        });
    });
    return Object.freeze(actual.map((span) => Object.freeze(span)));
};

export const resolveSakuraTrunkMacroStationGeometryV1 = ({
    trunkPathPlan,
    trunkTargetHeight,
    arcNorm,
} = {}) => {
    const plan = requireTrunkPathPlanV1(trunkPathPlan);
    const targetHeight = Number(trunkTargetHeight);
    const stationArcNorm = Number(arcNorm);
    if (!Number.isFinite(targetHeight) || targetHeight <= 0) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_STATION_TARGET_HEIGHT_INVALID');
    }
    if (!Number.isFinite(stationArcNorm) || stationArcNorm < 0 || stationArcNorm > 1) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_STATION_ARC_INVALID');
    }
    if (
        !plan.shape
        || typeof plan.shape !== 'object'
        || plan.shape.shapeId !== plan.guideShapeId
        || plan.adaptiveDiscretization?.shapeId !== plan.guideShapeId
    ) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_STATION_SHAPE_MISMATCH');
    }
    const baseWidth = Number(plan.spans[0]?.width);
    if (!Number.isFinite(baseWidth) || baseWidth <= 0) {
        throw new Error('ZEN_SAKURA_TRUNK_MACRO_STATION_BASE_WIDTH_INVALID');
    }

    const station = sampleSakuraMacroSpineShapeAtArcNorm(plan.shape, stationArcNorm);
    const before = sampleSakuraMacroSpineShapeAtArcNorm(
        plan.shape,
        Math.max(0, stationArcNorm - MACRO_STATION_TURN_SAMPLE_ARC),
    );
    const after = sampleSakuraMacroSpineShapeAtArcNorm(
        plan.shape,
        Math.min(1, stationArcNorm + MACRO_STATION_TURN_SAMPLE_ARC),
    );
    const turnSign = Math.sign(shortestAngleDelta(after.angle, before.angle))
        || Math.sign(Number(plan.spans[0]?.lastDir) || 1)
        || 1;

    return Object.freeze({
        x: station.x * targetHeight,
        y: station.y * targetHeight,
        angle: station.angle,
        arcNorm: stationArcNorm,
        width: resolveSakuraTrunkTaperWidthAtArc({
            baseWidth,
            arcNorm: stationArcNorm,
            minWidth: 1,
        }),
        turnSign,
    });
};

export const createSakuraTrunkPathPlanV1 = ({
    gene,
    trunkGeminiParams,
    trunkSegmentLimit: compatibilitySegmentLimit = null,
    structuralMaxDepth,
    rootState,
    rootNodeRandom,
    trunkTargetHeight = null,
    spineGuide = null,
    spineReferenceFamily = null,
    formTrunkIntentConstraint = null,
    adaptiveSubdivisionPolicy = SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY,
} = {}) => {
    if (spineGuide && spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_TRUNK_SPINE_INPUT_AMBIGUOUS');
    }
    if (
        compatibilitySegmentLimit !== null
        && (
            !Number.isSafeInteger(compatibilitySegmentLimit)
            || compatibilitySegmentLimit < 1
        )
    ) {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_COMPAT_SEGMENT_LIMIT_INVALID');
    }
    if (!Number.isSafeInteger(structuralMaxDepth) || structuralMaxDepth < 1) {
        throw new Error('ZEN_SAKURA_TRUNK_PATH_STRUCTURAL_DEPTH_INVALID');
    }
    const resolvedTargetHeight = (
        typeof trunkTargetHeight === 'number'
        && Number.isFinite(trunkTargetHeight)
        && trunkTargetHeight > 0
    )
        ? trunkTargetHeight
        : Math.max(
            1,
            Number(rootState?.trunkSegmentLength || rootState?.length || 1)
                * SAKURA_TRUNK_ADAPTIVE_SUBDIVISION_POLICY.base,
        );
    const referenceFamily = spineReferenceFamily
        ? requireSakuraSpineReferenceFamilyV1(spineReferenceFamily)
        : null;
    const referenceSample = referenceFamily
        ? sampleSakuraSpineReferenceFamilyV1({
            family: referenceFamily,
            structuralRandom: rootNodeRandom,
        })
        : null;
    const intentRandom = rootNodeRandom?.fork({
        depth: 1,
        nodeRole: 'trunk_macro_intent',
        nodeSlot: 0,
        decisionType: 'macro_spine_intent_v1',
    });
    const proceduralIntentPlan = createSakuraMacroSpineIntentPlanV1({
        gene,
        trunkGeminiParams,
        rootHeadingRad: requireRootState(rootState).parentAngle,
        structuralRandom: intentRandom,
        formTrunkIntentConstraint,
    });
    const conditioningGuide = spineGuide
        ? requireSakuraMacroSpineGuideV1(spineGuide)
        : (referenceSample?.guide || null);
    const activeIntentPlan = conditioningGuide
        ? conditionSakuraMacroSpineIntentPlanV1({
            plan: proceduralIntentPlan,
            guide: conditioningGuide,
        })
        : proceduralIntentPlan;
    const spineShape = fitSakuraMacroSpineIntentPlanV1(activeIntentPlan);
    const activeGuide = createSakuraMacroSpineIntentDiagnosticGuideV1(activeIntentPlan);
    if (activeGuide.guideId !== spineShape.guideId) {
        throw new Error('ZEN_SAKURA_TRUNK_INTENT_GUIDE_SIGNATURE_MISMATCH');
    }
    const adaptive = subdivideSakuraMacroSpineShapeV1(
        spineShape,
        adaptiveSubdivisionPolicy,
    );
    const resolvedStructuralMaxDepth = structuralMaxDepth;
    const spans = materializeAdaptiveTrunkSpans({
        adaptive,
        trunkTargetHeight: resolvedTargetHeight,
        rootState: requireRootState(rootState),
    });
    const plan = createTrunkPathPlanV1({
        plannerId: SAKURA_TRUNK_PATH_PLANNER_ID,
        trunkSegmentLimit: spans.length,
        structuralMaxDepth: resolvedStructuralMaxDepth,
        spans,
    });
    plan.guideId = spineShape.guideId;
    plan.guideShapeId = spineShape.shapeId;
    plan.guide = activeGuide;
    plan.shape = spineShape;
    plan.trunkTargetHeight = resolvedTargetHeight;
    plan.adaptiveDiscretization = adaptive;
    plan.morphologyIntentPlan = activeIntentPlan;
    plan.morphologyIntentPlanId = activeIntentPlan.planId;
    plan.morphologyIntentPlannerId = activeIntentPlan.plannerId;
    plan.legacyPlannerId = SAKURA_TRUNK_PATH_LEGACY_PLANNER_ID;
    plan.legacyPlannerRole = 'proposal_ablation_only';
    plan.proceduralBendEvents = activeIntentPlan.events;
    if (referenceSample) {
        plan.spineReferenceFamily = Object.freeze({
            version: referenceSample.version,
            contract: referenceSample.contract,
            familyId: referenceSample.familyId,
            referenceGuideId: referenceSample.referenceGuideId,
            likeness: referenceSample.likeness,
            variationPolicyId: referenceSample.variationPolicyId,
            variantGuideId: referenceSample.variantGuideId,
            variationStrength: referenceSample.variationStrength,
            amplitudeScale: referenceSample.amplitudeScale,
        });
    }
    return plan;
};
