import { SAKURA_BRANCH_ORDER } from '../generation/shapePriorModel';
import { BranchGeometryModel } from '../geometry/branchGeometryModel';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toFinite = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const requireCamera = (camera) => {
    if (
        !camera
        || !Number.isFinite(Number(camera.scale))
        || Number(camera.scale) <= 0
        || !Number.isFinite(Number(camera.offsetX))
        || !Number.isFinite(Number(camera.offsetY))
    ) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_CAMERA_REQUIRED');
    }
    return camera;
};

export const collectBonsaiStructuralPreviewSegments = (
    topology,
    sceneBounds,
    strictStructural = true,
) => {
    if (!topology || topology.type !== 'branch') {
        throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_TOPOLOGY_REQUIRED');
    }
    const segments = [];

    const visit = (node, startX, startY, angle) => {
        if (!node || node.type !== 'branch') {
            throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_BRANCH_INVALID');
        }
        const branchOrder = Number(node.branchOrder);
        const isStructuralOrder = Number.isInteger(branchOrder)
            && branchOrder <= SAKURA_BRANCH_ORDER.SECONDARY_BRANCH;
        if (!isStructuralOrder) {
            if (strictStructural) {
                throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_NON_STRUCTURAL_BRANCH');
            }
            return;
        }
        if (strictStructural && Array.isArray(node.terminals) && node.terminals.length) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_TERMINAL_FORBIDDEN');
        }

        const length = Number(node.length);
        const width = Number(node.width);
        if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(width) || width <= 0) {
            throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_GEOMETRY_INVALID');
        }
        const geometry = BranchGeometryModel.createSegment({
            startX,
            startY,
            angle,
            length,
            curve: Number(node.curve) || 0,
            curveIn: node.curveIn,
            curveOut: node.curveOut,
            exactCubicControl: node.exactCubicControl,
        });
        segments.push({
            geometry,
            branchOrder,
            width,
            traversalIndex: segments.length,
        });

        const children = Array.isArray(node.branches) ? node.branches : [];
        children.forEach((child) => {
            if (!child?.obj || child.obj.type !== 'branch') {
                if (strictStructural) {
                    throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_CHILD_INVALID');
                }
                return;
            }
            const childOrder = Number(child.obj.branchOrder);
            if (childOrder > SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
                if (strictStructural) {
                    throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_NON_STRUCTURAL_BRANCH');
                }
                return;
            }
            const attachT = Number.isFinite(Number(child.t))
                ? clamp(Number(child.t), 0, 1)
                : 1;
            const attachment = BranchGeometryModel.pointAndAngleAt(geometry, attachT);
            visit(
                child.obj,
                attachment.x,
                attachment.y,
                attachment.angle + toFinite(child.angleOffset, 0),
            );
        });
    };

    visit(
        topology,
        toFinite(sceneBounds?.trunkOffsetX, 0),
        toFinite(sceneBounds?.trunkBaseY, 0),
        toFinite(topology.initialAngle, -Math.PI / 2),
    );
    return segments.sort((left, right) => (
        right.branchOrder - left.branchOrder
        || left.width - right.width
    ));
};

const drawReferencePot = (ctx, sceneBounds, options) => {
    if (options.hidePot) {
        return;
    }
    const width = Math.max(1, toFinite(sceneBounds?.potDims?.width, 80));
    const height = Math.max(1, toFinite(sceneBounds?.potDims?.height, 32));
    const rimY = -height;
    const topHalf = width * 0.5;
    const bottomHalf = width * 0.38;

    ctx.save();
    ctx.fillStyle = options.potFill || 'rgba(91, 98, 94, 0.13)';
    ctx.strokeStyle = options.potStroke || 'rgba(76, 83, 79, 0.52)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-topHalf, rimY);
    ctx.lineTo(topHalf, rimY);
    ctx.lineTo(bottomHalf, 0);
    ctx.lineTo(-bottomHalf, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
};

export const renderBonsaiStructuralPreview = ({
    ctx,
    topology,
    camera,
    sceneBounds,
    strictStructural = true,
    options = {},
} = {}) => {
    if (!ctx || typeof ctx.save !== 'function') {
        throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_CONTEXT_REQUIRED');
    }
    const resolvedCamera = requireCamera(camera);
    const segments = collectBonsaiStructuralPreviewSegments(
        topology,
        sceneBounds,
        strictStructural,
    );
    if (!segments.length) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_PREVIEW_SEGMENTS_REQUIRED');
    }

    ctx.save();
    ctx.setTransform(
        resolvedCamera.scale,
        0,
        0,
        resolvedCamera.scale,
        resolvedCamera.offsetX,
        resolvedCamera.offsetY,
    );
    drawReferencePot(ctx, sceneBounds, options);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    segments.forEach(({ geometry, branchOrder, width }) => {
        const isTrunk = branchOrder === SAKURA_BRANCH_ORDER.TRUNK;
        ctx.strokeStyle = options.showBranchTierDebug
            ? (isTrunk ? '#25231f' : '#8b4c3e')
            : (isTrunk ? '#51483e' : '#71665a');
        ctx.lineWidth = Math.max(0.55, width);
        ctx.beginPath();
        ctx.moveTo(geometry.startX, geometry.startY);
        ctx.bezierCurveTo(
            geometry.cp1X,
            geometry.cp1Y,
            geometry.cp2X,
            geometry.cp2Y,
            geometry.endX,
            geometry.endY,
        );
        ctx.stroke();
    });
    ctx.restore();

    return {
        profile: 'structural_line_preview_v1',
        segmentCount: segments.length,
        trunkSegmentCount: segments.filter((entry) => (
            entry.branchOrder === SAKURA_BRANCH_ORDER.TRUNK
        )).length,
        scaffoldSegmentCount: segments.filter((entry) => (
            entry.branchOrder !== SAKURA_BRANCH_ORDER.TRUNK
        )).length,
    };
};
