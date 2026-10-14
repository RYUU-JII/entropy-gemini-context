import { DEFAULT_KOI_TUNING } from './constants.js';

const TWO_PI = Math.PI * 2;

const clamp = (value, min, max) => (
    Math.min(max, Math.max(min, value))
);

const toPositiveNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const resolveKoiSpatialDimensions = (tuning = DEFAULT_KOI_TUNING) => {
    const source = tuning && typeof tuning === 'object' ? tuning : DEFAULT_KOI_TUNING;
    const baseSize = toPositiveNumber(source.baseSize, DEFAULT_KOI_TUNING.baseSize);
    const historyLength = Math.max(1, Math.round(
        toPositiveNumber(source.historyLength, DEFAULT_KOI_TUNING.historyLength),
    ));
    const segmentSpacing = baseSize * 0.21;
    const spineLength = Math.max(0, historyLength - 1) * segmentSpacing;
    const lateralMargin = Math.max(18, baseSize * 2.8);
    const headMargin = Math.max(12, baseSize * 1.6);
    return {
        baseSize,
        historyLength,
        segmentSpacing,
        spineLength,
        lateralMargin,
        headMargin,
    };
};

const resolveAxisRangeForKoiPose = ({
    origin = 0,
    extent,
    axisDirection,
    spineLength,
    margin,
} = {}) => {
    const safeOrigin = Number.isFinite(Number(origin)) ? Number(origin) : 0;
    const safeExtent = Math.max(1, Number(extent) || 1);
    const direction = Number(axisDirection);
    const projectedSpine = (Number.isFinite(direction) ? direction : 0) * Math.max(0, Number(spineLength) || 0);
    const safeMargin = Math.max(1, Number(margin) || 1);
    const min = safeOrigin + safeMargin + Math.max(0, projectedSpine);
    const max = safeOrigin + safeExtent - safeMargin + Math.min(0, projectedSpine);
    if (min <= max) {
        return { min, max, constrained: false };
    }
    const center = safeOrigin + (safeExtent * 0.5);
    return { min: center, max: center, constrained: true };
};

export const buildKoiSpawnHistory = ({
    x,
    y,
    angle,
    historyLength,
    segmentSpacing,
} = {}) => {
    const safeLength = Math.max(1, Math.round(Number(historyLength) || 1));
    const safeSpacing = Math.max(0, Number(segmentSpacing) || 0);
    const safeAngle = Number.isFinite(Number(angle)) ? Number(angle) : 0;
    const headX = Number.isFinite(Number(x)) ? Number(x) : 0;
    const headY = Number.isFinite(Number(y)) ? Number(y) : 0;
    return Array.from({ length: safeLength }, (_, index) => ({
        x: headX - Math.cos(safeAngle) * index * safeSpacing,
        y: headY - Math.sin(safeAngle) * index * safeSpacing,
        angle: safeAngle,
    }));
};

export const clampKoiPoseInsideBounds = ({
    x,
    y,
    angle,
    width,
    height,
    originX = 0,
    originY = 0,
    tuning = DEFAULT_KOI_TUNING,
    segmentSpacing = null,
    historyLength = null,
} = {}) => {
    const dimensions = resolveKoiSpatialDimensions(tuning);
    const resolvedSegmentSpacing = toPositiveNumber(segmentSpacing, dimensions.segmentSpacing);
    const resolvedHistoryLength = Math.max(1, Math.round(
        toPositiveNumber(historyLength, dimensions.historyLength),
    ));
    const spineLength = Math.max(0, resolvedHistoryLength - 1) * resolvedSegmentSpacing;
    const safeAngle = Number.isFinite(Number(angle)) ? Number(angle) : 0;
    const margin = Math.max(dimensions.lateralMargin, dimensions.headMargin);
    const xRange = resolveAxisRangeForKoiPose({
        origin: originX,
        extent: width,
        axisDirection: Math.cos(safeAngle),
        spineLength,
        margin,
    });
    const yRange = resolveAxisRangeForKoiPose({
        origin: originY,
        extent: height,
        axisDirection: Math.sin(safeAngle),
        spineLength,
        margin,
    });
    return {
        x: clamp(Number(x) || 0, xRange.min, xRange.max),
        y: clamp(Number(y) || 0, yRange.min, yRange.max),
        angle: safeAngle,
        historyLength: resolvedHistoryLength,
        segmentSpacing: resolvedSegmentSpacing,
        constrained: xRange.constrained || yRange.constrained,
    };
};

export const resolveKoiMovementBoundsFrame = ({
    bounds = null,
    width,
    height,
    hardPad = 0,
} = {}) => {
    const safeWorldWidth = Math.max(1, Number(width) || 1);
    const safeWorldHeight = Math.max(1, Number(height) || 1);
    const safeBounds = bounds && typeof bounds === 'object' ? bounds : null;
    const originX = toFiniteNumber(safeBounds?.x, 0);
    const originY = toFiniteNumber(safeBounds?.y, 0);
    const extentWidth = toPositiveNumber(safeBounds?.width, safeWorldWidth);
    const extentHeight = toPositiveNumber(safeBounds?.height, safeWorldHeight);
    const pad = Math.max(0, Number(hardPad) || 0);
    const candidateMinX = originX + pad;
    const candidateMaxX = originX + extentWidth - pad;
    const candidateMinY = originY + pad;
    const candidateMaxY = originY + extentHeight - pad;
    const centerX = originX + extentWidth * 0.5;
    const centerY = originY + extentHeight * 0.5;
    return {
        x: originX,
        y: originY,
        width: extentWidth,
        height: extentHeight,
        minX: candidateMinX <= candidateMaxX ? candidateMinX : centerX,
        maxX: candidateMinX <= candidateMaxX ? candidateMaxX : centerX,
        minY: candidateMinY <= candidateMaxY ? candidateMinY : centerY,
        maxY: candidateMinY <= candidateMaxY ? candidateMaxY : centerY,
        centerX,
        centerY,
    };
};

export const sampleKoiSpawnPoseInsideBounds = ({
    width,
    height,
    originX = 0,
    originY = 0,
    tuning = DEFAULT_KOI_TUNING,
    random = Math.random,
} = {}) => {
    const rng = typeof random === 'function' ? random : Math.random;
    const dimensions = resolveKoiSpatialDimensions(tuning);
    const angle = rng() * TWO_PI;
    const margin = Math.max(dimensions.lateralMargin, dimensions.headMargin);
    const xRange = resolveAxisRangeForKoiPose({
        origin: originX,
        extent: width,
        axisDirection: Math.cos(angle),
        spineLength: dimensions.spineLength,
        margin,
    });
    const yRange = resolveAxisRangeForKoiPose({
        origin: originY,
        extent: height,
        axisDirection: Math.sin(angle),
        spineLength: dimensions.spineLength,
        margin,
    });
    return {
        x: xRange.min + (xRange.max - xRange.min) * rng(),
        y: yRange.min + (yRange.max - yRange.min) * rng(),
        angle,
        historyLength: dimensions.historyLength,
        segmentSpacing: dimensions.segmentSpacing,
        constrained: xRange.constrained || yRange.constrained,
    };
};
