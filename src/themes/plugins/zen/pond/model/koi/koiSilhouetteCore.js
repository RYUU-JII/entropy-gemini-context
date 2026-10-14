import { resolveHeadwardAngleFromHistory } from './koiMotion.js';

export const DEFAULT_KOI_BODY_PROFILE = Object.freeze({
    headLen: 0.1,
    headWidth: 0.99,
    headMin: 0.22,
    shoulderMax: 0.85,
    shoulderPos: 0.31,
    midWidth: 0.75,
    midPos: 0.52,
    tailWidth: 0.12,
    tailCurve: 1.15,
});

function toFinite(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp01(value) {
    const n = toFinite(value, 0);
    return Math.max(0, Math.min(1, n));
}

function resolveBodyProfile(tuning = null) {
    if (!tuning || typeof tuning !== 'object') {
        return DEFAULT_KOI_BODY_PROFILE;
    }
    return {
        ...DEFAULT_KOI_BODY_PROFILE,
        ...tuning,
    };
}

function ensurePointBuffer(buffer, pointCount) {
    const points = Array.isArray(buffer) ? buffer : [];
    while (points.length < pointCount) {
        points.push({ x: 0, y: 0 });
    }
    points.length = pointCount;
    return points;
}

export function resolveKoiBodyRadius(t, size, tuning = null) {
    const cfg = resolveBodyProfile(tuning);
    const safeT = clamp01(t);
    const safeSize = Math.max(0, toFinite(size, 0));

    if (safeT < cfg.shoulderPos) {
        const headT = safeT / Math.max(1e-6, cfg.shoulderPos);
        const baseR = safeSize * (
            cfg.headMin * 0.6
            + (cfg.shoulderMax - cfg.headMin * 0.6) * Math.pow(headT, 0.4)
        );
        return baseR * cfg.headWidth;
    }

    if (safeT < cfg.midPos) {
        const ratio = (safeT - cfg.shoulderPos) / Math.max(1e-6, (cfg.midPos - cfg.shoulderPos));
        return safeSize * (cfg.shoulderMax - (cfg.shoulderMax - cfg.midWidth) * ratio);
    }

    const tailT = (safeT - cfg.midPos) / Math.max(1e-6, (1 - cfg.midPos));
    return safeSize * (cfg.midWidth - (cfg.midWidth - cfg.tailWidth) * Math.pow(tailT, cfg.tailCurve));
}

export function buildKoiBodyContour({
    history,
    size,
    tuning = null,
    segmentWave = null,
    leftPoints = null,
    rightPoints = null,
} = {}) {
    const spine = Array.isArray(history) ? history : [];
    const pointCount = spine.length;
    const cfg = resolveBodyProfile(tuning);
    const safeSize = Math.max(0, toFinite(size, 0));

    const resolvedLeft = ensurePointBuffer(leftPoints, pointCount);
    const resolvedRight = ensurePointBuffer(rightPoints, pointCount);

    if (pointCount <= 0) {
        return {
            history: spine,
            leftPoints: resolvedLeft,
            rightPoints: resolvedRight,
            size: safeSize,
            tuning: cfg,
            noseTipX: 0,
            noseTipY: 0,
        };
    }

    for (let i = 0; i < pointCount; i += 1) {
        const point = spine[i] || { x: 0, y: 0, angle: 0 };
        const px = toFinite(point.x, 0);
        const py = toFinite(point.y, 0);
        const t = pointCount > 1 ? (i / (pointCount - 1)) : 0;
        const radius = resolveKoiBodyRadius(t, safeSize, cfg);
        const wiggle = Array.isArray(segmentWave) ? toFinite(segmentWave[i], 0) : 0;
        const headwardAngle = resolveHeadwardAngleFromHistory(spine, i, toFinite(point.angle, 0));
        const sideAngle = headwardAngle + wiggle;
        const dx = Math.cos(sideAngle - Math.PI / 2);
        const dy = Math.sin(sideAngle - Math.PI / 2);

        resolvedLeft[i].x = px + dx * radius;
        resolvedLeft[i].y = py + dy * radius;
        resolvedRight[i].x = px - dx * radius;
        resolvedRight[i].y = py - dy * radius;
    }

    const nosePoint = spine[0] || { x: 0, y: 0, angle: 0 };
    const noseAngle = resolveHeadwardAngleFromHistory(spine, 0, toFinite(nosePoint.angle, 0));
    const noseRadius = resolveKoiBodyRadius(0, safeSize, cfg);
    const noseTipX = toFinite(nosePoint.x, 0) + Math.cos(noseAngle) * noseRadius * cfg.headLen;
    const noseTipY = toFinite(nosePoint.y, 0) + Math.sin(noseAngle) * noseRadius * cfg.headLen;

    return {
        history: spine,
        leftPoints: resolvedLeft,
        rightPoints: resolvedRight,
        size: safeSize,
        tuning: cfg,
        noseTipX,
        noseTipY,
    };
}

export function traceKoiBodyContourPath(pathLike, contour) {
    if (!pathLike || typeof pathLike.moveTo !== 'function') return pathLike;
    const leftPoints = Array.isArray(contour?.leftPoints) ? contour.leftPoints : [];
    const rightPoints = Array.isArray(contour?.rightPoints) ? contour.rightPoints : [];
    if (leftPoints.length === 0 || rightPoints.length === 0) return pathLike;

    pathLike.moveTo(rightPoints[0].x, rightPoints[0].y);
    pathLike.quadraticCurveTo(
        toFinite(contour?.noseTipX, rightPoints[0].x),
        toFinite(contour?.noseTipY, rightPoints[0].y),
        leftPoints[0].x,
        leftPoints[0].y,
    );

    for (let i = 0; i < leftPoints.length - 1; i += 1) {
        const xc = (leftPoints[i].x + leftPoints[i + 1].x) / 2;
        const yc = (leftPoints[i].y + leftPoints[i + 1].y) / 2;
        pathLike.quadraticCurveTo(leftPoints[i].x, leftPoints[i].y, xc, yc);
    }
    pathLike.lineTo(
        leftPoints[leftPoints.length - 1].x,
        leftPoints[leftPoints.length - 1].y,
    );

    pathLike.lineTo(
        rightPoints[rightPoints.length - 1].x,
        rightPoints[rightPoints.length - 1].y,
    );

    for (let i = rightPoints.length - 1; i > 0; i -= 1) {
        const xc = (rightPoints[i].x + rightPoints[i - 1].x) / 2;
        const yc = (rightPoints[i].y + rightPoints[i - 1].y) / 2;
        pathLike.quadraticCurveTo(rightPoints[i].x, rightPoints[i].y, xc, yc);
    }
    pathLike.closePath();
    return pathLike;
}

export function createKoiBodyPath2D(contour) {
    if (typeof Path2D !== 'function') return null;
    const path = new Path2D();
    traceKoiBodyContourPath(path, contour);
    return path;
}
