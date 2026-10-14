import { BranchGeometryModel } from '../geometry/branchGeometryModel';
import {
    DEFAULT_ZEN_BONSAI_POT_STYLE,
    resolveZenPotRenderModel,
} from '../../ZenPotRenderer';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

const DEFAULT_SCENE_BOUNDS = Object.freeze({
    minX: -160,
    maxX: 160,
    minY: -360,
    maxY: 40,
    width: 320,
    height: 400,
    trunkOffsetX: 0,
    trunkBaseY: -33.5,
    potDims: { width: 80, height: 32 },
});

export const resolveBonsaiSceneAnchor = (topology, species, potStyleOverride = null) => {
    const rootVisual = topology?.visualPhenotype || {};
    const rawPotDims = typeof species?.getPotDimensions === 'function'
        ? species.getPotDimensions(rootVisual)
        : null;
    const potDims = {
        width: Math.max(0, toNumber(rawPotDims?.width, 80)),
        height: Math.max(0, toNumber(rawPotDims?.height, 32)),
    };
    const potModel = resolveZenPotRenderModel({
        width: potDims.width,
        height: potDims.height,
        type: typeof potStyleOverride === 'string' && potStyleOverride.trim()
            ? potStyleOverride.trim()
            : DEFAULT_ZEN_BONSAI_POT_STYLE,
    });

    return {
        potDims,
        potModel,
        trunkOffsetX: toNumber(rootVisual?.trunkOffsetX, 0) * potDims.width * 0.12,
        trunkBaseY: (-potDims.height) - 1.5,
    };
};

const resolveTerminalTipDistance = (terminal) => {
    if (Number.isFinite(Number(terminal?.dist))) {
        return Number(terminal.dist);
    }
    const scale = Math.max(0.2, toNumber(terminal?.scale, 1));
    return 4 + (scale * 7);
};

const resolveTerminalRadius = (terminal) => {
    const scale = Math.max(0.2, toNumber(terminal?.scale, 1));
    if (terminal?.type === 'flower') {
        return Math.max(5.5, scale * 6.6);
    }
    return Math.max(3.5, scale * 4.4);
};

export function measureBonsaiSceneBounds(topology, species, options = {}) {
    if (!topology || topology.type !== 'branch') {
        return DEFAULT_SCENE_BOUNDS;
    }

    const {
        includePot = true,
        includeGroundShadow = includePot,
        includeTerminals = true,
        maxBranchOrder = null,
        potStyleOverride = null,
    } = options;
    const hasMaxBranchOrder = maxBranchOrder !== null && maxBranchOrder !== undefined;
    if (hasMaxBranchOrder && (
        typeof maxBranchOrder !== 'number'
        || !Number.isFinite(maxBranchOrder)
    )) {
        throw new Error('ZEN_BONSAI_SCENE_BOUNDS_MAX_BRANCH_ORDER_INVALID');
    }
    const {
        potDims,
        potModel,
        trunkOffsetX,
        trunkBaseY,
    } = resolveBonsaiSceneAnchor(topology, species, potStyleOverride);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const updateBoundsWithRect = (left, top, right, bottom) => {
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, top);
        maxY = Math.max(maxY, bottom);
    };

    const updateBoundsWithPoint = (x, y, radius = 0) => {
        const safeRadius = Math.max(0, Number(radius) || 0);
        updateBoundsWithRect(
            x - safeRadius,
            y - safeRadius,
            x + safeRadius,
            y + safeRadius,
        );
    };

    const traverse = (rawNode, currentX, currentY, currentAngle, depth = 1) => {
        if (!rawNode || rawNode.type !== 'branch') {
            return;
        }
        const node = rawNode;
        if (
            hasMaxBranchOrder
            && Number(node?.branchOrder) > maxBranchOrder
        ) {
            return;
        }
        const segment = BranchGeometryModel.createSegment({
            startX: currentX,
            startY: currentY,
            angle: currentAngle,
            length: node.length,
            curve: node.curve || 0,
            curveIn: node.curveIn,
            curveOut: node.curveOut,
            exactCubicControl: node.exactCubicControl,
        });
        const branchRadius = Math.max(1.5, toNumber(node?.width, 1) * 0.72);
        const segmentBounds = BranchGeometryModel.getBounds(segment);
        updateBoundsWithRect(
            segmentBounds.minX - branchRadius,
            segmentBounds.minY - branchRadius,
            segmentBounds.maxX + branchRadius,
            segmentBounds.maxY + branchRadius,
        );

        const branchChildren = Array.isArray(node?.branches) ? node.branches : [];
        branchChildren.forEach((child) => {
            if (
                !child?.obj
                || child.obj.type !== 'branch'
                || (
                    hasMaxBranchOrder
                    && Number(child.obj.branchOrder) > maxBranchOrder
                )
            ) {
                return;
            }

            let childStartX = segment.endX;
            let childStartY = segment.endY;
            let childBaseAngle = currentAngle;
            if (Number.isFinite(child?.t)) {
                const attach = BranchGeometryModel.pointAndAngleAt(
                    segment,
                    clamp(Number(child.t), 0, 1),
                );
                childStartX = attach.x;
                childStartY = attach.y;
                childBaseAngle = attach.angle;
            }

            traverse(
                child.obj,
                childStartX,
                childStartY,
                childBaseAngle + toNumber(child?.angleOffset, 0),
                depth + 1,
            );
        });

        const terminalChildren = includeTerminals && Array.isArray(node?.terminals)
            ? node.terminals
            : [];
        if (!terminalChildren.length) {
            return;
        }

        terminalChildren.forEach((terminal) => {
            const attachT = Number.isFinite(Number(terminal?.attachT))
                ? clamp(Number(terminal.attachT), 0.08, 1)
                : 1;
            const terminalBase = attachT >= 0.995
                ? {
                    x: segment.endX,
                    y: segment.endY,
                    angle: BranchGeometryModel.angleAt(segment, 0.99),
                }
                : BranchGeometryModel.pointAndAngleAt(segment, attachT);
            const tipDistance = resolveTerminalTipDistance(terminal);
            const tipAngle = terminalBase.angle + toNumber(terminal?.angle, 0);
            const tipX = terminalBase.x + Math.cos(tipAngle) * tipDistance;
            const tipY = terminalBase.y + Math.sin(tipAngle) * tipDistance;
            updateBoundsWithPoint(tipX, tipY, resolveTerminalRadius(terminal));
        });
    };

    traverse(
        topology,
        trunkOffsetX,
        trunkBaseY,
        toNumber(topology?.initialAngle, -Math.PI / 2),
        1,
    );

    if (includePot && potModel?.potBounds) {
        updateBoundsWithRect(
            potModel.potBounds.minX,
            potModel.potBounds.minY,
            potModel.potBounds.maxX,
            potModel.potBounds.maxY,
        );
    }

    if (includeGroundShadow && potModel?.shadowBounds) {
        updateBoundsWithRect(
            potModel.shadowBounds.minX,
            potModel.shadowBounds.minY,
            potModel.shadowBounds.maxX,
            potModel.shadowBounds.maxY,
        );
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        return {
            ...DEFAULT_SCENE_BOUNDS,
            trunkOffsetX,
            trunkBaseY,
            potDims,
        };
    }

    return {
        minX,
        maxX,
        minY,
        maxY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
        trunkOffsetX,
        trunkBaseY,
        potDims,
    };
}

export const DEFAULT_BONSAI_SCENE_BOUNDS = DEFAULT_SCENE_BOUNDS;
