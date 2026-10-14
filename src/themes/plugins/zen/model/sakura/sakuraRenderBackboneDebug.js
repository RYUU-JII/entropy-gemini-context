import { SakuraTrunkSplineModel } from '../bonsai/generation/SakuraTrunkSplineModel';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import {
    clamp,
    wrapAngle,
} from './sakuraMath';

const collectMainTrunkData = (node, x, y, angle, depth = 1, out = { polyline: [], anchors: [] }) => {
    if (!node || node.type !== 'branch' || depth > 16) {
        return out;
    }

    const segment = BranchGeometryModel.createSegment({
        startX: x,
        startY: y,
        angle,
        length: node.length,
        curve: node.curve || 0,
        curveIn: node.curveIn,
        curveOut: node.curveOut,
        exactCubicControl: node.exactCubicControl,
    });

    out.anchors.push({
        depth,
        x,
        y,
        angle,
        length: Number(node.length) || 0,
    });

    const samples = Math.max(4, Math.min(12, Math.round((Number(node.length) || 0) / 6)));
    for (let i = 0; i <= samples; i += 1) {
        const t = i / Math.max(1, samples);
        const p = BranchGeometryModel.pointAt(segment, t);
        const last = out.polyline[out.polyline.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.6) {
            out.polyline.push({ x: p.x, y: p.y, depth });
        }
    }

    const branchChildren = Array.isArray(node.branches) ? node.branches : [];
    const continuationChild = branchChildren.find(
        (child) => child?.obj?.type === 'branch' && Number.isFinite(child?.t) && Number(child.t) >= 0.999,
    ) || branchChildren.find((child) => child?.obj?.type === 'branch');

    if (!continuationChild) {
        return out;
    }

    let childStartX = segment.endX;
    let childStartY = segment.endY;
    let childBaseAngle = angle;
    if (Number.isFinite(continuationChild?.t)) {
        const attach = BranchGeometryModel.pointAndAngleAt(
            segment,
            clamp(Number(continuationChild.t), 0, 1),
        );
        childStartX = attach.x;
        childStartY = attach.y;
        childBaseAngle = attach.angle;
    }

    const childAngle = childBaseAngle + Number(continuationChild?.angleOffset || 0);
    return collectMainTrunkData(
        continuationChild.obj,
        childStartX,
        childStartY,
        childAngle,
        depth + 1,
        out,
    );
};

const drawRoundedRect = (ctx, x, y, width, height, radius = 6) => {
    const r = Math.min(radius, Math.max(0, width * 0.5), Math.max(0, height * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const toSignedDegree = (rad) => Math.round((wrapAngle(Number(rad) || 0) * 180) / Math.PI);
const formatSigned = (value) => {
    const num = Math.round(Number(value) || 0);
    return `${num >= 0 ? '+' : ''}${num}`;
};

export const drawSakuraBackboneDebugOverlay = ({
    ctx,
    topology,
    trunkOffsetX,
    trunkBaseY,
    centerX,
    bottomY,
    compact = false,
    legendOrigin = null,
}) => {
    const trunkData = collectMainTrunkData(
        topology,
        trunkOffsetX,
        trunkBaseY,
        topology.initialAngle || -Math.PI / 2,
        1,
        { polyline: [], anchors: [] },
    );
    const polyline = Array.isArray(trunkData?.polyline) ? trunkData.polyline : [];
    const anchors = Array.isArray(trunkData?.anchors) ? trunkData.anchors : [];

    if (polyline.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.strokeStyle = '#0EA5E9';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i += 1) {
            ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    const trunkGuideSamples = Array.isArray(topology?.trunkSpline?.samples)
        ? topology.trunkSpline.samples
        : [];
    if (!anchors.length || !trunkGuideSamples.length) {
        return;
    }

    const trunkDepthLimit = Math.max(
        1,
        Number(
            topology?.trunkDepthModel?.trunkSegmentLimit
            || topology?.trunkSpline?.trunkSegmentLimit
            || anchors.length
            || 1,
        ),
    );

    const guidePoints = [];
    let gx = anchors[0].x;
    let gy = anchors[0].y;
    guidePoints.push({ x: gx, y: gy });
    for (let i = 0; i < anchors.length; i += 1) {
        const depth = i + 1;
        const targetAngle = SakuraTrunkSplineModel.resolveTargetAngle(
            topology.trunkSpline,
            depth,
            trunkDepthLimit,
        );
        const segLen = Math.max(6, Number(anchors[i]?.length || 0) * 0.86);
        if (!Number.isFinite(targetAngle)) {
            continue;
        }
        gx += Math.cos(targetAngle) * segLen;
        gy += Math.sin(targetAngle) * segLen;
        guidePoints.push({ x: gx, y: gy });
    }

    if (guidePoints.length > 1) {
        ctx.save();
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(guidePoints[0].x, guidePoints[0].y);
        for (let i = 1; i < guidePoints.length; i += 1) {
            ctx.lineTo(guidePoints[i].x, guidePoints[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = '#A855F7';
    ctx.fillStyle = '#A855F7';
    ctx.lineWidth = 1;
    for (let i = 0; i < anchors.length; i += 1) {
        const anchor = anchors[i];
        const targetAngle = SakuraTrunkSplineModel.resolveTargetAngle(
            topology.trunkSpline,
            anchor.depth + 1,
            trunkDepthLimit,
        );
        if (!Number.isFinite(targetAngle)) {
            continue;
        }
        const rayLen = clamp((Number(anchor.length) || 0) * 0.42, 8, 24);
        const rx = anchor.x + Math.cos(targetAngle) * rayLen;
        const ry = anchor.y + Math.sin(targetAngle) * rayLen;
        ctx.beginPath();
        ctx.moveTo(anchor.x, anchor.y);
        ctx.lineTo(rx, ry);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(anchor.x, anchor.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    const depthMetricLimit = compact ? 6 : 10;
    const depthMetrics = anchors
        .slice(0, depthMetricLimit)
        .map((anchor) => {
            const actualDeg = toSignedDegree(anchor.angle);
            const targetAngle = SakuraTrunkSplineModel.resolveTargetAngle(
                topology.trunkSpline,
                anchor.depth,
                trunkDepthLimit,
            );
            const hasTarget = Number.isFinite(targetAngle);
            const targetDeg = hasTarget ? toSignedDegree(targetAngle) : null;
            const errorDeg = hasTarget
                ? toSignedDegree(wrapAngle(anchor.angle - targetAngle))
                : null;
            return {
                depth: anchor.depth,
                x: anchor.x,
                y: anchor.y,
                actualDeg,
                targetDeg,
                errorDeg,
                hasTarget,
            };
        });

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.font = compact
        ? '700 7px ui-monospace, SFMono-Regular, Menlo, monospace'
        : '700 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';
    for (let i = 0; i < depthMetrics.length; i += 1) {
        const metric = depthMetrics[i];
        const side = metric.x >= 0 ? 1 : -1;
        const baseX = metric.x + (side * (compact ? 8 : 10));
        const baseY = metric.y + ((i % 2 === 0) ? (compact ? -8 : -10) : 2);
        const text = compact
            ? (metric.hasTarget
                ? `D${metric.depth} E${formatSigned(metric.errorDeg)}`
                : `D${metric.depth} n/a`)
            : (metric.hasTarget
                ? `D${metric.depth} A${formatSigned(metric.actualDeg)} T${formatSigned(metric.targetDeg)} E${formatSigned(metric.errorDeg)}`
                : `D${metric.depth} A${formatSigned(metric.actualDeg)} Tn/a`);
        const textWidth = ctx.measureText(text).width;
        const padX = compact ? 2 : 3;
        const labelWidth = textWidth + (padX * 2);
        const labelHeight = compact ? 9 : 11;
        const boxX = side > 0 ? baseX : (baseX - labelWidth);
        const boxY = baseY;
        const labelBg = metric.hasTarget
            ? (Math.abs(metric.errorDeg) <= 8 ? 'rgba(16,185,129,0.86)' : 'rgba(245,158,11,0.88)')
            : 'rgba(71,85,105,0.86)';
        ctx.fillStyle = labelBg;
        drawRoundedRect(ctx, boxX, boxY, labelWidth, labelHeight, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,23,42,0.8)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(text, boxX + padX, boxY + (compact ? 1 : 2));
    }
    ctx.restore();

    const legendLines = compact
        ? [
            'SPINE DEBUG (compact)',
            'cyan=actual, violet=target',
            'label: Dn E(error deg)',
        ]
        : [
            'SPINE DEBUG',
            'cyan dashed: rendered trunk path',
            'violet dashed: backbone target path',
            'violet rays: local tangent target',
            'label: Dn A(actual) T(target) E(error deg)',
        ];

    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.font = compact
        ? '700 7px ui-sans-serif, system-ui, sans-serif'
        : '700 8px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    const legendPaddingX = compact ? 5 : 6;
    const legendPaddingY = compact ? 5 : 6;
    const lineHeight = compact ? 9 : 11;
    const legendWidth = legendLines.reduce(
        (acc, line) => Math.max(acc, ctx.measureText(line).width),
        0,
    ) + (legendPaddingX * 2);
    const legendHeight = (legendLines.length * lineHeight) + (legendPaddingY * 2);
    const legendX = Number.isFinite(Number(legendOrigin?.x))
        ? Number(legendOrigin.x)
        : ((-centerX) + 8);
    const legendY = Number.isFinite(Number(legendOrigin?.y))
        ? Number(legendOrigin.y)
        : ((-bottomY) + 8);
    ctx.fillStyle = 'rgba(15,23,42,0.72)';
    drawRoundedRect(ctx, legendX, legendY, legendWidth, legendHeight, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.75)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    for (let i = 0; i < legendLines.length; i += 1) {
        const line = legendLines[i];
        ctx.fillStyle = i === 0 ? '#E2E8F0' : '#CBD5E1';
        ctx.fillText(
            line,
            legendX + legendPaddingX,
            legendY + legendPaddingY + (i * lineHeight),
        );
    }
    ctx.restore();
};
