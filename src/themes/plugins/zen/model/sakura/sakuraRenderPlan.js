import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel.js';
import {
    resolveBonsaiSceneAnchor,
} from '../bonsai/rendering/measureBonsaiSceneBounds.js';
import {
    projectZenBonsaiGrowthNode,
    shouldRenderZenBonsaiGrowthNode,
    ZEN_BONSAI_SURFACE_FEEDBACK_KINDS,
} from '../ZenBonsaiGrowthProjection.js';
import {
    resolveZenBonsaiActivationBakePresentation,
} from '../bonsai/presentation/ZenBonsaiActivationPresentation.js';
import {
    resolveSakuraBranchLifeSag,
    resolveSakuraBranchMotion,
    resolveSakuraBranchMotionEnvelope,
} from './sakuraBranchMotionModel.js';
import { SAKURA_TERMINAL_PAINT_METRICS } from './sakuraRenderPaintMetrics.js';
import {
    resolveSakuraTerminalDisplayScale,
    resolveSakuraTerminalLifeVisual,
    resolveSakuraTerminalPresentationContext,
    resolveSakuraTerminalRenderDistance,
} from './sakuraTerminalPresentation.js';

export const ZEN_SAKURA_RENDER_PLAN_CONTRACT = 'zen-sakura-render-plan-v1';
export const ZEN_SAKURA_RENDER_PLAN_VERSION = 1;

export const SAKURA_RENDER_PLAN_MOTION_MODE = Object.freeze({
    NONE: 'none',
    CURRENT: 'current',
    MAXIMUM_RESERVE: 'maximum_reserve',
});

export const SAKURA_RENDER_PLAN_CALM_WIND_STATE = Object.freeze({
    intensity: 0,
    gustEnvelope: 0,
    direction: Math.PI * 0.58,
    dirX: Math.cos(Math.PI * 0.58),
    dirY: Math.sin(Math.PI * 0.58),
    sway: 0,
    gust: 0,
    flutter: 0,
    scalar: 0,
});

const MAX_GROWTH_CUE_RADIUS = 32;
const MAX_LEAF_FALL_CUE_RADIUS = 26;
const MAX_DEW_CUE_RADIUS = 9;
const VALID_MOTION_MODES = new Set(Object.values(SAKURA_RENDER_PLAN_MOTION_MODE));
const validatedRenderPlanIdentities = new WeakSet();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
const round = (value, digits = 6) => Number(toNumber(value, 0).toFixed(digits));

const cloneRenderValue = (value, seen = new Map()) => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SOURCE_CYCLE_INVALID');
    }
    const clone = Array.isArray(value) ? [] : {};
    seen.set(value, clone);
    if (Array.isArray(value)) {
        value.forEach((entry) => clone.push(cloneRenderValue(entry, seen)));
    } else {
        Object.entries(value).forEach(([key, entry]) => {
            if (typeof entry === 'function' || entry === undefined) return;
            clone[key] = cloneRenderValue(entry, seen);
        });
    }
    seen.delete(value);
    return clone;
};

const deepFreeze = (value, seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.values(value).forEach((entry) => deepFreeze(entry, seen));
    return Object.freeze(value);
};

const emitCanonicalRenderValue = ({
    value,
    write,
    path = 'plan',
    seen = new Set(),
}) => {
    if (value === null) {
        write('null');
        return;
    }
    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'boolean') {
        write(JSON.stringify(value));
        return;
    }
    if (valueType === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`ZEN_SAKURA_RENDER_PLAN_CANONICAL_NUMBER_INVALID:${path}`);
        }
        write(Object.is(value, -0) ? '0' : JSON.stringify(value));
        return;
    }
    if (valueType !== 'object') {
        throw new Error(`ZEN_SAKURA_RENDER_PLAN_CANONICAL_VALUE_INVALID:${path}`);
    }
    if (seen.has(value)) {
        throw new Error(`ZEN_SAKURA_RENDER_PLAN_CANONICAL_CYCLE_INVALID:${path}`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        throw new Error(`ZEN_SAKURA_RENDER_PLAN_CANONICAL_OBJECT_INVALID:${path}`);
    }
    seen.add(value);
    try {
        if (Array.isArray(value)) {
            write('[');
            for (let index = 0; index < value.length; index += 1) {
                if (index > 0) write(',');
                if (index in value) {
                    emitCanonicalRenderValue({
                        value: value[index],
                        write,
                        path: `${path}[${index}]`,
                        seen,
                    });
                }
            }
            write(']');
            return;
        }
        write('{');
        const keys = Object.keys(value).sort();
        keys.forEach((key, index) => {
            if (index > 0) write(',');
            write(JSON.stringify(key));
            write(':');
            emitCanonicalRenderValue({
                value: value[key],
                write,
                path: `${path}.${key}`,
                seen,
            });
        });
        write('}');
    } finally {
        seen.delete(value);
    }
};

const serializeCanonicalRenderValue = (value, path = 'plan') => {
    let serialized = '';
    emitCanonicalRenderValue({
        value,
        path,
        write: (chunk) => {
            serialized += chunk;
        },
    });
    return serialized;
};

const hashCanonicalRenderValue = (value, path = 'plan') => {
    let hash = 2166136261;
    emitCanonicalRenderValue({
        value,
        path,
        write: (chunk) => {
            for (let index = 0; index < chunk.length; index += 1) {
                hash ^= chunk.charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
        },
    });
    return (hash >>> 0).toString(36);
};

const areCanonicalRenderValuesEqual = (left, right) => (
    serializeCanonicalRenderValue(left) === serializeCanonicalRenderValue(right)
);

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const requireFiniteNumber = (value, errorCode) => {
    if (!isFiniteNumber(value)) {
        throw new Error(errorCode);
    }
    return value;
};

const freezeBounds = (bounds = null) => {
    if (
        !isFiniteNumber(bounds?.minX)
        || !isFiniteNumber(bounds?.maxX)
        || !isFiniteNumber(bounds?.minY)
        || !isFiniteNumber(bounds?.maxY)
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BOUNDS_EMPTY');
    }
    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;
    return Object.freeze({
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
    });
};

const createBoundsAccumulator = () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    return {
        addRect(left, top, right, bottom) {
            minX = Math.min(minX, left);
            maxX = Math.max(maxX, right);
            minY = Math.min(minY, top);
            maxY = Math.max(maxY, bottom);
        },
        addPoint(x, y, radius = 0) {
            const safeRadius = Math.max(0, toNumber(radius, 0));
            this.addRect(x - safeRadius, y - safeRadius, x + safeRadius, y + safeRadius);
        },
        read() {
            return freezeBounds({ minX, maxX, minY, maxY });
        },
    };
};

const resolveCueRadius = (growthPlan = null) => {
    if (!growthPlan || growthPlan.active !== true) return 0;
    let radius = growthPlan.growthTipScale > 0 ? MAX_GROWTH_CUE_RADIUS : 0;
    if (growthPlan.surfaceFeedbackStrength > 0) {
        radius = Math.max(
            radius,
            growthPlan.surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.LEAF_FALL
                ? MAX_LEAF_FALL_CUE_RADIUS
                : MAX_DEW_CUE_RADIUS,
        );
    }
    return radius;
};

const resolveWoodPaintRadius = (node = {}) => {
    const width = Math.max(0.08, toNumber(node?.width, 0.08));
    const shadowHalfWidth = Math.max(0.8, width * 1.12) * 0.5;
    const shadowOffset = Math.max(0.5, width * 0.15);
    return shadowHalfWidth + shadowOffset + 0.75;
};

const resolveTerminalPaintRadius = (terminal = {}, lifeVisual = null, {
    maximum = false,
} = {}) => {
    const isFlower = terminal?.type === 'flower';
    const displayScale = maximum
        ? Math.max(
            Math.max(0.05, Math.abs(toNumber(terminal?.scale, 1)))
                * SAKURA_TERMINAL_PAINT_METRICS.maximumLifeScale,
            isFlower && terminal?.classic2Development?.lineage !== true ? 0.82 : 0,
        )
        : resolveSakuraTerminalDisplayScale(terminal, lifeVisual);
    const bloomScale = isFlower && maximum
        ? SAKURA_TERMINAL_PAINT_METRICS.maximumFlowerBloomScale
        : 1;
    const spriteHalfDiagonal = (
        (isFlower
            ? SAKURA_TERMINAL_PAINT_METRICS.flowerBitmapScale
            : SAKURA_TERMINAL_PAINT_METRICS.leafBitmapScale)
        * SAKURA_TERMINAL_PAINT_METRICS.logicalAssetSize
        * displayScale
        * bloomScale
        / Math.SQRT2
    );
    const shadowReach = isFlower
        ? (
            SAKURA_TERMINAL_PAINT_METRICS.flowerShadowOffset
            + (SAKURA_TERMINAL_PAINT_METRICS.flowerShadowRadius * bloomScale)
        ) * displayScale
        : (
            SAKURA_TERMINAL_PAINT_METRICS.leafShadowOffset
            + SAKURA_TERMINAL_PAINT_METRICS.leafShadowRadius
        ) * displayScale;
    const lifeOverlayReach = isFlower
        ? SAKURA_TERMINAL_PAINT_METRICS.flowerLifeOverlayRadius * displayScale * bloomScale
        : SAKURA_TERMINAL_PAINT_METRICS.leafLifeOverlayRadius * displayScale;
    return Math.max(spriteHalfDiagonal, shadowReach, lifeOverlayReach) + 1;
};

const stripRawChildGraph = (node = {}) => {
    const {
        branches: _branches,
        terminals: _terminals,
        ...paintNode
    } = node;
    return paintNode;
};

const freezeSurface = (surface = null) => {
    if (!surface || typeof surface !== 'object' || Array.isArray(surface)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SURFACE_INVALID');
    }
    const { pixelWidth, pixelHeight } = surface;
    if (!isFiniteNumber(pixelWidth) || !isFiniteNumber(pixelHeight) || pixelWidth <= 0 || pixelHeight <= 0) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SURFACE_SIZE_INVALID');
    }
    const treeViewport = surface.treeViewport === null || surface.treeViewport === undefined
        ? Object.freeze({ x: 0, y: 0, width: pixelWidth, height: pixelHeight })
        : Object.freeze({
            x: requireFiniteNumber(
                surface.treeViewport.x,
                'ZEN_SAKURA_RENDER_PLAN_SURFACE_VIEWPORT_INVALID',
            ),
            y: requireFiniteNumber(
                surface.treeViewport.y,
                'ZEN_SAKURA_RENDER_PLAN_SURFACE_VIEWPORT_INVALID',
            ),
            width: requireFiniteNumber(
                surface.treeViewport.width,
                'ZEN_SAKURA_RENDER_PLAN_SURFACE_VIEWPORT_INVALID',
            ),
            height: requireFiniteNumber(
                surface.treeViewport.height,
                'ZEN_SAKURA_RENDER_PLAN_SURFACE_VIEWPORT_INVALID',
            ),
        });
    if (treeViewport.width <= 0 || treeViewport.height <= 0) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SURFACE_VIEWPORT_INVALID');
    }
    return Object.freeze({
        coordinateSpace: 'viewport-device-pixel',
        pixelWidth,
        pixelHeight,
        treeViewport,
        clipTreePaint: surface.clipTreePaint === true,
        gardenBedGeometry: surface.gardenBedGeometry === undefined
            ? null
            : cloneRenderValue(surface.gardenBedGeometry),
    });
};

const createBakeRecordPayload = (record) => ({
    recordId: record.recordId,
    depth: record.depth,
    node: record.node,
    children: record.children.map((link) => ({
        hasAttachT: link.hasAttachT,
        attachT: link.attachT,
        angleOffset: link.angleOffset,
        child: createBakeRecordPayload(link.child),
    })),
    terminals: record.terminals.map((terminal) => ({
        sourceIndex: terminal.sourceIndex,
        terminal: terminal.terminal,
        bakeLifeVisual: terminal.bakeLifeVisual,
        attachT: terminal.attachT,
        bakeDistance: terminal.bakeDistance,
        bakeDisplayScale: terminal.bakeDisplayScale,
        bakePaintRadius: terminal.bakePaintRadius,
    })),
    tipCueRadius: record.tipCueRadius,
});

const createBakeSignaturePayload = (plan) => ({
    contract: plan.contract,
    version: plan.version,
    source: {
        projectionSignature: plan.source.projectionSignature,
    },
    presentation: {
        bake: {
            context: plan.presentation.bake.context,
        },
    },
    options: plan.options,
    rootAngle: plan.rootAngle,
    root: createBakeRecordPayload(plan.root),
});

const createFullSignaturePayload = (plan) => ({
    contract: plan.contract,
    version: plan.version,
    coordinateSpace: plan.coordinateSpace,
    source: plan.source,
    surface: plan.surface,
    anchor: plan.anchor,
    presentation: plan.presentation,
    options: plan.options,
    rootAngle: plan.rootAngle,
    root: plan.root,
});

const createBakeSignature = (plan) => (
    `sakura_render_plan_bake_v1:${hashCanonicalRenderValue(
        createBakeSignaturePayload(plan),
        'bakePlan',
    )}`
);

const createPlanSignature = (plan) => (
    `sakura_render_plan_v1:${hashCanonicalRenderValue(
        createFullSignaturePayload(plan),
        'fullPlan',
    )}`
);

export const resolveSakuraRenderPlanRecordPoseV1 = ({
    record,
    startX,
    startY,
    baseAngle,
    frameCount = 0,
    windState = SAKURA_RENDER_PLAN_CALM_WIND_STATE,
    lifeBranchSag = 0,
    motionMode = SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
    subtreeBaked = false,
} = {}) => {
    if (!record || typeof record !== 'object' || record.node?.type !== 'branch') {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_REQUIRED');
    }
    if (!VALID_MOTION_MODES.has(motionMode)) {
        throw new Error(`ZEN_SAKURA_RENDER_PLAN_MOTION_MODE_INVALID:${String(motionMode)}`);
    }
    const node = record.node;
    const currentMotion = motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT
        ? resolveSakuraBranchMotion({
            node,
            baseAngle,
            frameCount,
            windState,
            lifeBranchSag,
            depth: record.depth,
            subtreeBaked,
        })
        : { angleOffset: 0, curveShift: 0 };
    const motionEnvelope = motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
        ? resolveSakuraBranchMotionEnvelope({
            node,
            baseAngle,
            lifeBranchSag,
            depth: record.depth,
            subtreeBaked,
        })
        : { angleOffset: 0, curveShift: 0 };
    const resolvedAngle = baseAngle + currentMotion.angleOffset;
    const segment = BranchGeometryModel.createSegment({
        startX,
        startY,
        angle: resolvedAngle,
        length: node.length,
        curve: toNumber(node.curve, 0) + (currentMotion.curveShift * 0.5),
        curveIn: toNumber(node.curveIn, toNumber(node.curve, 0))
            + (currentMotion.curveShift * 0.7),
        curveOut: toNumber(node.curveOut, toNumber(node.curve, 0))
            + currentMotion.curveShift,
        exactCubicControl: node.exactCubicControl,
    });
    return Object.freeze({
        recordId: record.recordId,
        record,
        node,
        baseAngle,
        resolvedAngle,
        motion: Object.freeze({ ...currentMotion }),
        motionEnvelope: Object.freeze({ ...motionEnvelope }),
        segment: Object.freeze(segment),
    });
};

export const resolveSakuraRenderPlanAttachmentV1 = ({
    pose,
    attachT = 1,
    hasAttachT = true,
} = {}) => {
    if (!pose?.segment) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_POSE_REQUIRED');
    }
    if (hasAttachT !== true) {
        return Object.freeze({
            x: pose.segment.endX,
            y: pose.segment.endY,
            angle: pose.baseAngle,
            attachT: null,
        });
    }
    const safeT = clamp(toNumber(attachT, 1), 0, 1);
    if (safeT >= 0.995) {
        return Object.freeze({
            x: pose.segment.endX,
            y: pose.segment.endY,
            angle: BranchGeometryModel.angleAt(pose.segment, 0.99),
            attachT: safeT,
        });
    }
    const attachment = BranchGeometryModel.pointAndAngleAt(pose.segment, safeT);
    return Object.freeze({ ...attachment, attachT: safeT });
};

export const resolveSakuraRenderPlanTerminalPoseV1 = ({
    pose,
    terminalRecord,
    maximumReach = false,
} = {}) => {
    if (!terminalRecord || typeof terminalRecord !== 'object') {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_TERMINAL_REQUIRED');
    }
    const attach = resolveSakuraRenderPlanAttachmentV1({
        pose,
        attachT: terminalRecord.attachT,
        hasAttachT: true,
    });
    const distance = maximumReach
        ? terminalRecord.maximumDistance
        : terminalRecord.distance;
    const tipAngle = attach.angle + toNumber(terminalRecord.terminal?.angle, 0);
    return Object.freeze({
        attach,
        distance,
        tipAngle,
        tipX: attach.x + (Math.cos(tipAngle) * distance),
        tipY: attach.y + (Math.sin(tipAngle) * distance),
    });
};

const resolveSegmentReach = (segment = null) => {
    if (!segment) return 0;
    return Math.max(
        Math.hypot(segment.cp1X - segment.startX, segment.cp1Y - segment.startY),
        Math.hypot(segment.cp2X - segment.startX, segment.cp2Y - segment.startY),
        Math.hypot(segment.endX - segment.startX, segment.endY - segment.startY),
    );
};

const resolveRotationDisplacement = (radius, angleEnvelope) => (
    2
    * Math.max(0, toNumber(radius, 0))
    * Math.sin(Math.min(Math.PI, Math.max(0, toNumber(angleEnvelope, 0))) * 0.5)
);

const measureSakuraRenderPlanBoundsUnchecked = (resolvedPlan) => {
    const { anchor, presentation } = resolvedPlan;
    const measurePass = ({
        motionMode,
        includeWoodPaint,
        includeTerminalPaint,
        includeCuePaint,
        lifeBranchSag = presentation.runtime.lifeBranchSag,
    }) => {
        const bounds = createBoundsAccumulator();
        if (anchor.includeWorldPot && anchor.potModel?.potBounds) {
            bounds.addRect(
                anchor.potModel.potBounds.minX,
                anchor.potModel.potBounds.minY,
                anchor.potModel.potBounds.maxX,
                anchor.potModel.potBounds.maxY,
            );
        }
        if (anchor.includeGroundShadow && anchor.potModel?.shadowBounds) {
            bounds.addRect(
                anchor.potModel.shadowBounds.minX,
                anchor.potModel.shadowBounds.minY,
                anchor.potModel.shadowBounds.maxX,
                anchor.potModel.shadowBounds.maxY,
            );
        }
        let maximumMotionAngle = 0;
        const walk = (
            record,
            startX,
            startY,
            baseAngle,
            anchorDisplacement = 0,
            inheritedAngleEnvelope = 0,
        ) => {
            const pose = resolveSakuraRenderPlanRecordPoseV1({
                record,
                startX,
                startY,
                baseAngle,
                frameCount: 0,
                windState: SAKURA_RENDER_PLAN_CALM_WIND_STATE,
                lifeBranchSag,
                motionMode,
            });
            const reserveMotion = pose.motionEnvelope;
            const totalAngleEnvelope = motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                ? Math.min(Math.PI, inheritedAngleEnvelope + reserveMotion.angleOffset)
                : 0;
            const segmentReach = resolveSegmentReach(pose.segment);
            const segmentMotionDisplacement = motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                ? anchorDisplacement
                    + resolveRotationDisplacement(segmentReach, totalAngleEnvelope)
                    + Math.abs(reserveMotion.curveShift)
                : 0;
            const paintRadius = includeWoodPaint ? resolveWoodPaintRadius(record.node) : 0;
            const segmentBounds = BranchGeometryModel.getBounds(pose.segment);
            const inflation = segmentMotionDisplacement + paintRadius;
            bounds.addRect(
                segmentBounds.minX - inflation,
                segmentBounds.minY - inflation,
                segmentBounds.maxX + inflation,
                segmentBounds.maxY + inflation,
            );
            maximumMotionAngle = Math.max(
                maximumMotionAngle,
                motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                    ? totalAngleEnvelope
                    : Math.abs(pose.motion.angleOffset),
            );
            const curveTangentEnvelope = motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                ? Math.min(
                    0.35,
                    (Math.abs(reserveMotion.curveShift) / Math.max(1, segmentReach)) * 4,
                )
                : 0;
            const childAngleEnvelope = Math.min(
                Math.PI,
                totalAngleEnvelope + curveTangentEnvelope,
            );
            const resolveDisplacement = (attach) => {
                if (motionMode !== SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE) return 0;
                const attachReach = Math.hypot(
                    attach.x - pose.segment.startX,
                    attach.y - pose.segment.startY,
                );
                return anchorDisplacement
                    + resolveRotationDisplacement(attachReach, totalAngleEnvelope)
                    + Math.abs(reserveMotion.curveShift);
            };
            record.children.forEach((link) => {
                const attach = resolveSakuraRenderPlanAttachmentV1({
                    pose,
                    attachT: link.attachT,
                    hasAttachT: link.hasAttachT,
                });
                walk(
                    link.child,
                    attach.x,
                    attach.y,
                    attach.angle + link.angleOffset,
                    resolveDisplacement(attach),
                    link.hasAttachT ? childAngleEnvelope : inheritedAngleEnvelope,
                );
            });
            if (includeTerminalPaint && resolvedPlan.options.includeTerminals) {
                record.terminals.forEach((terminal) => {
                    if (
                        motionMode !== SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                        && terminal.lifeVisual === null
                    ) {
                        return;
                    }
                    const terminalPose = resolveSakuraRenderPlanTerminalPoseV1({
                        pose,
                        terminalRecord: terminal,
                        maximumReach: motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE,
                    });
                    const terminalMotionDisplacement = resolveDisplacement(terminalPose.attach)
                        + (motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                            ? resolveRotationDisplacement(
                                terminalPose.distance,
                                childAngleEnvelope,
                            )
                            : 0);
                    bounds.addPoint(
                        terminalPose.tipX,
                        terminalPose.tipY,
                        terminalMotionDisplacement + (
                            motionMode === SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE
                                ? terminal.maximumPaintRadius
                                : terminal.paintRadius
                        ),
                    );
                });
            }
            if (includeCuePaint && record.children.length === 0 && record.tipCueRadius > 0) {
                const attach = resolveSakuraRenderPlanAttachmentV1({
                    pose,
                    attachT: 1,
                    hasAttachT: true,
                });
                bounds.addPoint(
                    pose.segment.endX,
                    pose.segment.endY,
                    resolveDisplacement(attach) + record.tipCueRadius,
                );
            }
        };
        walk(
            resolvedPlan.root,
            anchor.trunkOffsetX,
            anchor.trunkBaseY,
            resolvedPlan.rootAngle,
        );
        return Object.freeze({
            bounds: bounds.read(),
            maximumMotionAngle,
        });
    };
    const centerline = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.NONE,
        includeWoodPaint: false,
        includeTerminalPaint: false,
        includeCuePaint: false,
    });
    const wood = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.NONE,
        includeWoodPaint: true,
        includeTerminalPaint: false,
        includeCuePaint: false,
    });
    const ambientMotion = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        includeWoodPaint: true,
        includeTerminalPaint: false,
        includeCuePaint: false,
        lifeBranchSag: 0,
    });
    const currentSag = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        includeWoodPaint: true,
        includeTerminalPaint: false,
        includeCuePaint: false,
    });
    const terminals = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        includeWoodPaint: true,
        includeTerminalPaint: true,
        includeCuePaint: false,
    });
    const cues = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        includeWoodPaint: true,
        includeTerminalPaint: true,
        includeCuePaint: true,
    });
    const maximumMotionReserve = measurePass({
        motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.MAXIMUM_RESERVE,
        includeWoodPaint: true,
        includeTerminalPaint: true,
        includeCuePaint: true,
    });
    return Object.freeze({
        currentPaint: cues.bounds,
        components: Object.freeze({
            centerline: centerline.bounds,
            wood: wood.bounds,
            ambientMotion: ambientMotion.bounds,
            currentSag: currentSag.bounds,
            terminals: terminals.bounds,
            cues: cues.bounds,
            maximumMotionReserve: maximumMotionReserve.bounds,
        }),
        maximumMotionReserve: maximumMotionReserve.bounds,
        currentMotionAngle: round(cues.maximumMotionAngle),
        maximumMotionAngle: round(maximumMotionReserve.maximumMotionAngle),
    });
};

const deriveSakuraRenderPlanEnvelopeV1 = (root) => {
    const envelope = {
        branchCount: 0,
        terminalCount: 0,
        reserveTerminalCount: 0,
        cueCount: 0,
        cueRadius: 0,
    };
    const walk = (record) => {
        envelope.branchCount += 1;
        envelope.terminalCount += record.terminals.reduce(
            (count, terminal) => count + (terminal.lifeVisual === null ? 0 : 1),
            0,
        );
        envelope.reserveTerminalCount += record.terminals.length;
        if (record.tipCueRadius > 0) {
            envelope.cueCount += 1;
            envelope.cueRadius = Math.max(envelope.cueRadius, record.tipCueRadius);
        }
        record.children.forEach((link) => walk(link.child));
    };
    walk(root);
    return envelope;
};

export const createSakuraRenderPlanV1 = ({
    topology,
    species,
    sourceTopologySignature = '',
    surface = null,
    includePot = true,
    includeGroundShadow = includePot,
    includeTerminals = true,
    potStyleOverride = null,
    growthProjection = null,
    activationPresentation = null,
    lifeState = null,
} = {}) => {
    const runtimePresentationContext = resolveSakuraTerminalPresentationContext({
        lifeState,
        activationPresentation,
        growthProjection,
    });
    const bakePresentationContext = resolveSakuraTerminalPresentationContext({
        lifeState,
        activationPresentation: resolveZenBonsaiActivationBakePresentation(
            activationPresentation,
        ),
        growthProjection,
    });
    const growthPlan = runtimePresentationContext.growthPlan;
    const lifeBranchSag = resolveSakuraBranchLifeSag({
        lifeState,
        imprintGravityBias: growthPlan.active === true ? growthPlan.gravityBias : 0,
        activationDroop: runtimePresentationContext.lifeAppearance.activationDroop,
    });
    const bakeLifeBranchSag = resolveSakuraBranchLifeSag({
        lifeState,
        imprintGravityBias: growthPlan.active === true ? growthPlan.gravityBias : 0,
        activationDroop: bakePresentationContext.lifeAppearance.activationDroop,
    });
    const sceneAnchor = resolveBonsaiSceneAnchor(topology, species, potStyleOverride);
    const cueRadius = resolveCueRadius(growthPlan);
    const buildRecord = (rawNode, depth = 1, recordId = 'root') => {
        if (
            !rawNode
            || rawNode.type !== 'branch'
            || !shouldRenderZenBonsaiGrowthNode(growthPlan, rawNode, depth)
        ) {
            return null;
        }
        const projectedNode = projectZenBonsaiGrowthNode(rawNode, growthPlan, depth);
        const rawChildren = Array.isArray(projectedNode?.branches)
            ? projectedNode.branches
            : [];
        const children = rawChildren
            .map((link, index) => {
                const child = buildRecord(link?.obj, depth + 1, `${recordId}.${index}`);
                if (!child) return null;
                const hasAttachT = typeof link?.t === 'number' && Number.isFinite(link.t);
                return {
                    hasAttachT,
                    attachT: hasAttachT ? clamp(Number(link.t), 0, 1) : null,
                    angleOffset: toNumber(link?.angleOffset, 0),
                    child,
                };
            })
            .filter(Boolean);
        const projectedTerminals = Array.isArray(projectedNode?.terminals)
            ? projectedNode.terminals
            : [];
        const terminals = projectedTerminals.map((terminal, sourceIndex) => {
            const lifeVisual = resolveSakuraTerminalLifeVisual({
                child: terminal,
                node: projectedNode,
                depth,
                index: sourceIndex,
                presentationContext: runtimePresentationContext,
            });
            const bakeLifeVisual = resolveSakuraTerminalLifeVisual({
                child: terminal,
                node: projectedNode,
                depth,
                index: sourceIndex,
                presentationContext: bakePresentationContext,
            });
            const hasAttachT = (
                typeof terminal?.attachT === 'number'
                && Number.isFinite(terminal.attachT)
            );
            return {
                sourceIndex,
                terminal: cloneRenderValue(terminal),
                lifeVisual,
                bakeLifeVisual,
                attachT: hasAttachT ? clamp(Number(terminal.attachT), 0.08, 1) : 1,
                distance: lifeVisual
                    ? resolveSakuraTerminalRenderDistance(terminal, lifeVisual)
                    : 0,
                bakeDistance: bakeLifeVisual
                    ? resolveSakuraTerminalRenderDistance(terminal, bakeLifeVisual)
                    : 0,
                maximumDistance: Math.max(
                    0,
                    toNumber(terminal?.dist, 0)
                        * SAKURA_TERMINAL_PAINT_METRICS.maximumReach,
                    terminal?.type === 'flower'
                        && terminal?.classic2Development?.lineage !== true
                        ? 3.4
                        : 0,
                ),
                displayScale: lifeVisual
                    ? resolveSakuraTerminalDisplayScale(terminal, lifeVisual)
                    : 0,
                bakeDisplayScale: bakeLifeVisual
                    ? resolveSakuraTerminalDisplayScale(terminal, bakeLifeVisual)
                    : 0,
                paintRadius: lifeVisual
                    ? resolveTerminalPaintRadius(terminal, lifeVisual)
                    : 0,
                bakePaintRadius: bakeLifeVisual
                    ? resolveTerminalPaintRadius(terminal, bakeLifeVisual)
                    : 0,
                maximumPaintRadius: resolveTerminalPaintRadius(
                    terminal,
                    null,
                    { maximum: true },
                ),
            };
        });
        const paintNode = {
            ...cloneRenderValue(stripRawChildGraph(projectedNode)),
            visibleGrowthChildBranchCount: Math.max(
                children.length,
                Math.floor(Number(projectedNode?.visibleGrowthChildBranchCount) || 0),
            ),
        };
        const tipCueRadius = children.length === 0 ? cueRadius : 0;
        return {
            recordId,
            depth,
            node: paintNode,
            children,
            terminals,
            tipCueRadius,
            motionEnvelope: resolveSakuraBranchMotionEnvelope({
                node: paintNode,
                baseAngle: -Math.PI / 2,
                lifeBranchSag,
                depth,
            }),
        };
    };

    const root = topology?.type === 'branch' ? buildRecord(topology, 1, 'root') : null;
    if (!root) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_ROOT_REQUIRED');
    }
    const anchor = {
        potDims: cloneRenderValue(sceneAnchor.potDims),
        potModel: cloneRenderValue(sceneAnchor.potModel),
        potStyle: potStyleOverride,
        trunkOffsetX: sceneAnchor.trunkOffsetX,
        trunkBaseY: sceneAnchor.trunkBaseY,
        includeWorldPot: includePot === true,
        includeGroundShadow: includeGroundShadow === true,
    };
    const options = {
        includeTerminals: includeTerminals === true,
    };
    const presentation = {
        runtime: {
            context: cloneRenderValue(runtimePresentationContext),
            lifeBranchSag,
        },
        bake: {
            context: cloneRenderValue(bakePresentationContext),
            lifeBranchSag: bakeLifeBranchSag,
        },
    };
    const resolvedSurface = freezeSurface(surface);
    const rootAngle = toNumber(topology?.initialAngle, -Math.PI / 2);
    const basePlan = {
        contract: ZEN_SAKURA_RENDER_PLAN_CONTRACT,
        version: ZEN_SAKURA_RENDER_PLAN_VERSION,
        coordinateSpace: 'bonsai-world',
        source: {
            topologySignature: sourceTopologySignature || null,
            projectionSignature: growthPlan.signature,
        },
        surface: resolvedSurface,
        anchor,
        presentation,
        options,
        rootAngle,
        root,
    };
    const envelope = deriveSakuraRenderPlanEnvelopeV1(root);
    const planWithEnvelope = {
        ...basePlan,
        envelope,
    };
    const bounds = measureSakuraRenderPlanBoundsUnchecked(planWithEnvelope);
    const planWithDerivedPayload = {
        ...planWithEnvelope,
        bounds,
    };
    const completePlan = {
        ...planWithDerivedPayload,
        bakeSignature: createBakeSignature(planWithDerivedPayload),
        signature: createPlanSignature(planWithDerivedPayload),
    };
    return finalizeCreatedSakuraRenderPlanV1(completePlan);
};

const validateExactCubicControl = (exactCubicControl) => {
    if (exactCubicControl === null || exactCubicControl === undefined) return;
    if (
        !exactCubicControl
        || typeof exactCubicControl !== 'object'
        || Array.isArray(exactCubicControl)
        || exactCubicControl.version !== 1
        || !isFiniteNumber(exactCubicControl.cp1Along)
        || !isFiniteNumber(exactCubicControl.cp1Normal)
        || !isFiniteNumber(exactCubicControl.cp2Along)
        || !isFiniteNumber(exactCubicControl.cp2Normal)
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_EXACT_CUBIC_INVALID');
    }
};

const validatePlanNode = (record, seenRecordIds, seenNodeIds) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_INVALID');
    }
    if (
        typeof record.recordId !== 'string'
        || !record.recordId
        || seenRecordIds.has(record.recordId)
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_ID_INVALID');
    }
    seenRecordIds.add(record.recordId);
    if (
        record.node?.type !== 'branch'
        || typeof record.node.nodeId !== 'string'
        || !record.node.nodeId
        || seenNodeIds.has(record.node.nodeId)
        || !Number.isInteger(record.depth)
        || record.depth < 1
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_SHAPE_INVALID');
    }
    seenNodeIds.add(record.node.nodeId);
    if (
        !isFiniteNumber(record.node.length)
        || record.node.length <= 0
        || !isFiniteNumber(record.node.width)
        || record.node.width <= 0
        || !isFiniteNumber(record.node.curve)
        || !isFiniteNumber(record.node.curveIn)
        || !isFiniteNumber(record.node.curveOut)
        || !Number.isInteger(record.node.visibleGrowthChildBranchCount)
        || record.node.visibleGrowthChildBranchCount < 0
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_NODE_GEOMETRY_INVALID');
    }
    validateExactCubicControl(record.node.exactCubicControl);
    if (!Array.isArray(record.children) || !Array.isArray(record.terminals)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_CHILDREN_INVALID');
    }
    if (
        !isFiniteNumber(record.tipCueRadius)
        || record.tipCueRadius < 0
        || !record.motionEnvelope
        || !isFiniteNumber(record.motionEnvelope.angleOffset)
        || !isFiniteNumber(record.motionEnvelope.curveShift)
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_RECORD_ENVELOPE_INVALID');
    }
    record.children.forEach((link) => {
        if (!link || typeof link !== 'object' || !isFiniteNumber(link.angleOffset)) {
            throw new Error('ZEN_SAKURA_RENDER_PLAN_CHILD_LINK_INVALID');
        }
        if (link.child?.depth !== record.depth + 1) {
            throw new Error('ZEN_SAKURA_RENDER_PLAN_CHILD_DEPTH_INVALID');
        }
        if (
            typeof link.hasAttachT !== 'boolean'
            || (link.hasAttachT && (
                !isFiniteNumber(link.attachT)
                || link.attachT < 0
                || link.attachT > 1
            ))
            || (!link.hasAttachT && link.attachT !== null)
        ) {
            throw new Error('ZEN_SAKURA_RENDER_PLAN_CHILD_ATTACH_INVALID');
        }
        validatePlanNode(link.child, seenRecordIds, seenNodeIds);
    });
    const terminalIndices = new Set();
    record.terminals.forEach((terminal) => {
        if (
            !terminal
            || typeof terminal !== 'object'
            || !Number.isInteger(terminal.sourceIndex)
            || terminal.sourceIndex < 0
            || terminalIndices.has(terminal.sourceIndex)
            || !terminal.terminal
            || typeof terminal.terminal !== 'object'
            || Array.isArray(terminal.terminal)
            || !isFiniteNumber(terminal.attachT)
            || terminal.attachT < 0
            || terminal.attachT > 1
            || !isFiniteNumber(terminal.distance)
            || terminal.distance < 0
            || !isFiniteNumber(terminal.bakeDistance)
            || terminal.bakeDistance < 0
            || !isFiniteNumber(terminal.maximumDistance)
            || terminal.maximumDistance < 0
            || !isFiniteNumber(terminal.displayScale)
            || terminal.displayScale < 0
            || !isFiniteNumber(terminal.bakeDisplayScale)
            || terminal.bakeDisplayScale < 0
            || !isFiniteNumber(terminal.paintRadius)
            || terminal.paintRadius < 0
            || !isFiniteNumber(terminal.bakePaintRadius)
            || terminal.bakePaintRadius < 0
            || !isFiniteNumber(terminal.maximumPaintRadius)
            || terminal.maximumPaintRadius < 0
            || (terminal.lifeVisual !== null && (
                !terminal.lifeVisual
                || typeof terminal.lifeVisual !== 'object'
                || Array.isArray(terminal.lifeVisual)
            ))
            || (terminal.bakeLifeVisual !== null && (
                !terminal.bakeLifeVisual
                || typeof terminal.bakeLifeVisual !== 'object'
                || Array.isArray(terminal.bakeLifeVisual)
            ))
        ) {
            throw new Error('ZEN_SAKURA_RENDER_PLAN_TERMINAL_INVALID');
        }
        terminalIndices.add(terminal.sourceIndex);
    });
};

const validateBoundsRect = (bounds, errorCode) => {
    if (
        !bounds
        || typeof bounds !== 'object'
        || Array.isArray(bounds)
        || !isFiniteNumber(bounds.minX)
        || !isFiniteNumber(bounds.maxX)
        || !isFiniteNumber(bounds.minY)
        || !isFiniteNumber(bounds.maxY)
        || !isFiniteNumber(bounds.width)
        || !isFiniteNumber(bounds.height)
        || bounds.maxX < bounds.minX
        || bounds.maxY < bounds.minY
        || bounds.width !== Math.max(1, bounds.maxX - bounds.minX)
        || bounds.height !== Math.max(1, bounds.maxY - bounds.minY)
    ) {
        throw new Error(errorCode);
    }
};

const validateSakuraRenderPlanBounds = (bounds) => {
    if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BOUNDS_REQUIRED');
    }
    validateBoundsRect(bounds.currentPaint, 'ZEN_SAKURA_RENDER_PLAN_BOUNDS_INVALID');
    validateBoundsRect(
        bounds.maximumMotionReserve,
        'ZEN_SAKURA_RENDER_PLAN_BOUNDS_INVALID',
    );
    const componentKeys = [
        'centerline',
        'wood',
        'ambientMotion',
        'currentSag',
        'terminals',
        'cues',
        'maximumMotionReserve',
    ];
    if (!bounds.components || typeof bounds.components !== 'object') {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BOUNDS_INVALID');
    }
    componentKeys.forEach((key) => validateBoundsRect(
        bounds.components[key],
        'ZEN_SAKURA_RENDER_PLAN_BOUNDS_INVALID',
    ));
    if (
        !isFiniteNumber(bounds.currentMotionAngle)
        || !isFiniteNumber(bounds.maximumMotionAngle)
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BOUNDS_INVALID');
    }
};

const validateSakuraRenderPlanSurface = (surface) => {
    if (
        !surface
        || typeof surface !== 'object'
        || Array.isArray(surface)
        || surface.coordinateSpace !== 'viewport-device-pixel'
        || !isFiniteNumber(surface.pixelWidth)
        || surface.pixelWidth <= 0
        || !isFiniteNumber(surface.pixelHeight)
        || surface.pixelHeight <= 0
        || typeof surface.clipTreePaint !== 'boolean'
        || !surface.treeViewport
        || !isFiniteNumber(surface.treeViewport.x)
        || surface.treeViewport.x < 0
        || !isFiniteNumber(surface.treeViewport.y)
        || surface.treeViewport.y < 0
        || !isFiniteNumber(surface.treeViewport.width)
        || surface.treeViewport.width <= 0
        || !isFiniteNumber(surface.treeViewport.height)
        || surface.treeViewport.height <= 0
        || surface.treeViewport.x + surface.treeViewport.width > surface.pixelWidth
        || surface.treeViewport.y + surface.treeViewport.height > surface.pixelHeight
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SURFACE_INVALID');
    }
};

const validateSakuraRenderPlanEnvelope = (envelope) => {
    if (
        !envelope
        || typeof envelope !== 'object'
        || Array.isArray(envelope)
        || !Number.isInteger(envelope.branchCount)
        || envelope.branchCount < 1
        || !Number.isInteger(envelope.terminalCount)
        || envelope.terminalCount < 0
        || !Number.isInteger(envelope.reserveTerminalCount)
        || envelope.reserveTerminalCount < 0
        || !Number.isInteger(envelope.cueCount)
        || envelope.cueCount < 0
        || !isFiniteNumber(envelope.cueRadius)
        || envelope.cueRadius < 0
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_ENVELOPE_INVALID');
    }
};

const validateSakuraRenderPlanStructure = (plan) => {
    if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_REQUIRED');
    }
    if (
        plan.contract !== ZEN_SAKURA_RENDER_PLAN_CONTRACT
        || plan.version !== ZEN_SAKURA_RENDER_PLAN_VERSION
        || plan.coordinateSpace !== 'bonsai-world'
        || typeof plan.signature !== 'string'
        || !plan.signature.startsWith('sakura_render_plan_v1:')
        || typeof plan.bakeSignature !== 'string'
        || !plan.bakeSignature.startsWith('sakura_render_plan_bake_v1:')
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_CONTRACT_INVALID');
    }
    if (
        !plan.source
        || !(
            plan.source.topologySignature === null
            || typeof plan.source.topologySignature === 'string'
        )
        || typeof plan.source.projectionSignature !== 'string'
        || !plan.source.projectionSignature
        || !plan.anchor
        || !isFiniteNumber(plan.anchor.trunkOffsetX)
        || !isFiniteNumber(plan.anchor.trunkBaseY)
        || !plan.anchor.potDims
        || !isFiniteNumber(plan.anchor.potDims.width)
        || plan.anchor.potDims.width < 0
        || !isFiniteNumber(plan.anchor.potDims.height)
        || plan.anchor.potDims.height < 0
        || typeof plan.anchor.includeWorldPot !== 'boolean'
        || typeof plan.anchor.includeGroundShadow !== 'boolean'
        || !plan.presentation?.runtime?.context
        || typeof plan.presentation.runtime.context !== 'object'
        || !isFiniteNumber(plan.presentation.runtime.lifeBranchSag)
        || !plan.presentation?.bake?.context
        || typeof plan.presentation.bake.context !== 'object'
        || !isFiniteNumber(plan.presentation.bake.lifeBranchSag)
        || !plan.options
        || typeof plan.options.includeTerminals !== 'boolean'
        || !isFiniteNumber(plan.rootAngle)
        || !plan.root
    ) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SHAPE_INVALID');
    }
    validateSakuraRenderPlanSurface(plan.surface);
    validateSakuraRenderPlanEnvelope(plan.envelope);
    validateSakuraRenderPlanBounds(plan.bounds);
    validatePlanNode(plan.root, new Set(), new Set());
};

const validateSakuraRenderPlanSignatures = (plan) => {
    if (plan.signature !== createPlanSignature(plan)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_SIGNATURE_INVALID');
    }
    if (plan.bakeSignature !== createBakeSignature(plan)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BAKE_SIGNATURE_INVALID');
    }
};

const freezeAndRememberSakuraRenderPlanV1 = (plan) => {
    const frozenPlan = deepFreeze(plan);
    validatedRenderPlanIdentities.add(frozenPlan);
    return frozenPlan;
};

function finalizeCreatedSakuraRenderPlanV1(plan) {
    validateSakuraRenderPlanStructure(plan);
    const expectedEnvelope = deriveSakuraRenderPlanEnvelopeV1(plan.root);
    if (!areCanonicalRenderValuesEqual(plan.envelope, expectedEnvelope)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_ENVELOPE_DERIVATION_INVALID');
    }
    // Both signatures were just streamed from this exact in-memory plan. Recomputing them here
    // performed two more full graph traversals on every Bonsai boot without adding a trust check.
    return freezeAndRememberSakuraRenderPlanV1(plan);
}

export const requireSakuraRenderPlanV1 = (plan) => {
    if (validatedRenderPlanIdentities.has(plan)) {
        return plan;
    }
    validateSakuraRenderPlanStructure(plan);
    validateSakuraRenderPlanSignatures(plan);
    const expectedEnvelope = deriveSakuraRenderPlanEnvelopeV1(plan.root);
    if (!areCanonicalRenderValuesEqual(plan.envelope, expectedEnvelope)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_ENVELOPE_DERIVATION_INVALID');
    }
    const expectedBounds = measureSakuraRenderPlanBoundsUnchecked(plan);
    if (!areCanonicalRenderValuesEqual(plan.bounds, expectedBounds)) {
        throw new Error('ZEN_SAKURA_RENDER_PLAN_BOUNDS_DERIVATION_INVALID');
    }
    return freezeAndRememberSakuraRenderPlanV1(plan);
};

export const measureSakuraRenderPlanBoundsV1 = (plan) => (
    measureSakuraRenderPlanBoundsUnchecked(requireSakuraRenderPlanV1(plan))
);

export default createSakuraRenderPlanV1;
