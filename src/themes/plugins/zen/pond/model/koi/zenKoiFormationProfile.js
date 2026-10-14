import { clamp as clampValue } from './koiMotion.js';
import {
    buildKoiSpawnHistory,
    clampKoiPoseInsideBounds,
} from './koiSpatialBounds.js';

export const ZEN_KOI_FORMATION_TYPES = Object.freeze({
    FIRST_VISION_ORBIT: 'first_vision_orbit',
});

const TWO_PI = Math.PI * 2;
const DEFAULT_FIRST_VISION_ORBIT_SLOT_COUNT = 6;

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toText = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const roundNumber = (value, digits = 4, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const clampInteger = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(numeric)));
};

const normalizeOrbitDirection = (value) => (
    toText(value).toLowerCase() === 'counterclockwise'
        ? 'counterclockwise'
        : 'clockwise'
);

export const normalizeZenKoiFormationProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const type = toText(profile.type);
    if (type !== ZEN_KOI_FORMATION_TYPES.FIRST_VISION_ORBIT) return null;

    const slotCount = clampInteger(profile.slotCount, 1, 32, DEFAULT_FIRST_VISION_ORBIT_SLOT_COUNT);
    const slotIndex = clampInteger(profile.slotIndex, 0, slotCount - 1, 0);

    return {
        type,
        slotIndex,
        slotCount,
        direction: normalizeOrbitDirection(profile.direction),
        centerX: roundNumber(clampValue(Number(profile.centerX), 0.22, 0.78), 4, 0.5),
        centerY: roundNumber(clampValue(Number(profile.centerY), 0.24, 0.76), 4, 0.52),
        radiusX: roundNumber(clampValue(Number(profile.radiusX), 0.12, 0.46), 4, 0.31),
        radiusY: roundNumber(clampValue(Number(profile.radiusY), 0.1, 0.38), 4, 0.23),
        angularSpeed: roundNumber(clampValue(Number(profile.angularSpeed), 0.001, 0.04), 5, 0.0075),
        phaseOffset: roundNumber(Number(profile.phaseOffset), 5, -Math.PI * 0.5),
        lookaheadRadians: roundNumber(clampValue(Number(profile.lookaheadRadians), 0.2, 1.2), 4, 0.72),
        spawnDepth: roundNumber(clampValue(Number(profile.spawnDepth), 0.06, 0.36), 4, 0.16),
    };
};

export const buildZenKoiFormationProfileSignature = (profile = null) => {
    const normalized = normalizeZenKoiFormationProfile(profile);
    if (!normalized) return '';
    return [
        normalized.type,
        normalized.slotIndex,
        normalized.slotCount,
        normalized.direction,
        normalized.centerX,
        normalized.centerY,
        normalized.radiusX,
        normalized.radiusY,
        normalized.angularSpeed,
        normalized.phaseOffset,
        normalized.lookaheadRadians,
        normalized.spawnDepth,
    ].join(':');
};

const getDirectionSign = (profile) => (
    profile.direction === 'counterclockwise' ? -1 : 1
);

const resolveOrbitAngle = (profile, frameCount = 0) => (
    profile.phaseOffset
    + ((profile.slotIndex / Math.max(1, profile.slotCount)) * TWO_PI)
    + (getDirectionSign(profile) * Math.max(0, Number(frameCount) || 0) * profile.angularSpeed)
);

const resolveOrbitPoint = (profile, width, height, angle, bounds = null) => {
    const safeBounds = isObject(bounds) ? bounds : null;
    const originX = Number.isFinite(Number(safeBounds?.x)) ? Number(safeBounds.x) : 0;
    const originY = Number.isFinite(Number(safeBounds?.y)) ? Number(safeBounds.y) : 0;
    const safeWidth = Math.max(1, Number(safeBounds?.width ?? width) || 1);
    const safeHeight = Math.max(1, Number(safeBounds?.height ?? height) || 1);
    const pad = Math.max(32, Math.min(safeWidth, safeHeight) * 0.08);
    const centerX = originX + safeWidth * profile.centerX;
    const centerY = originY + safeHeight * profile.centerY;
    const circularRadius = Math.min(safeWidth, safeHeight) * ((profile.radiusX + profile.radiusY) * 0.5);
    const maxSafeRadius = Math.max(1, Math.min(
        centerX - (originX + pad),
        originX + safeWidth - pad - centerX,
        centerY - (originY + pad),
        originY + safeHeight - pad - centerY,
    ));
    const radiusFloor = Math.min(maxSafeRadius, Math.min(safeWidth, safeHeight) * 0.22);
    const radius = clampValue(circularRadius, radiusFloor, maxSafeRadius);
    const radiusX = radius;
    const radiusY = radius;
    return {
        x: clampValue(centerX + Math.cos(angle) * radiusX, originX + pad, originX + safeWidth - pad),
        y: clampValue(centerY + Math.sin(angle) * radiusY, originY + pad, originY + safeHeight - pad),
        centerX,
        centerY,
        radiusX,
        radiusY,
    };
};

const resolveOrbitTangent = (profile, radiusX, radiusY, angle) => {
    const sign = getDirectionSign(profile);
    const dx = -Math.sin(angle) * Math.max(1, radiusX) * sign;
    const dy = Math.cos(angle) * Math.max(1, radiusY) * sign;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude <= 1e-6) {
        return { x: 1, y: 0, angle: 0 };
    }
    const tangentX = dx / magnitude;
    const tangentY = dy / magnitude;
    return {
        x: tangentX,
        y: tangentY,
        angle: Math.atan2(tangentY, tangentX),
    };
};

export const resolveZenKoiFormationTarget = ({
    fish = null,
    width,
    height,
    frameCount = 0,
    bounds = null,
} = {}) => {
    const profile = normalizeZenKoiFormationProfile(fish?.formationProfile);
    if (!profile) return null;

    const slotAngle = resolveOrbitAngle(profile, frameCount);
    const targetAngle = slotAngle + (getDirectionSign(profile) * profile.lookaheadRadians);
    const currentPoint = resolveOrbitPoint(profile, width, height, slotAngle, bounds);
    const targetPoint = resolveOrbitPoint(profile, width, height, targetAngle, bounds);
    const tangent = resolveOrbitTangent(profile, currentPoint.radiusX, currentPoint.radiusY, slotAngle);
    return {
        x: targetPoint.x,
        y: targetPoint.y,
        currentX: currentPoint.x,
        currentY: currentPoint.y,
        tangentX: tangent.x,
        tangentY: tangent.y,
        tangentAngle: tangent.angle,
        radiusReference: Math.max(1, Math.min(currentPoint.radiusX, currentPoint.radiusY)),
    };
};

export const applyZenKoiFormationSpawn = ({
    fish = null,
    width,
    height,
    frameCount = 0,
    spawnBounds = null,
} = {}) => {
    if (!fish) return false;
    const target = resolveZenKoiFormationTarget({ fish, width, height, frameCount, bounds: spawnBounds });
    if (!target) return false;
    const safePose = clampKoiPoseInsideBounds({
        x: target.currentX,
        y: target.currentY,
        angle: target.tangentAngle,
        originX: Number(spawnBounds?.x) || 0,
        originY: Number(spawnBounds?.y) || 0,
        width: Number(spawnBounds?.width) > 0 ? spawnBounds.width : width,
        height: Number(spawnBounds?.height) > 0 ? spawnBounds.height : height,
        tuning: fish.tuning,
        segmentSpacing: fish.segmentSpacing,
        historyLength: Array.isArray(fish.history) ? fish.history.length : fish.historyLength,
    });
    fish.x = safePose.x;
    fish.y = safePose.y;
    fish.eventBodyFrame = null;
    fish.angle = safePose.angle;
    fish.bodyHeading = target.tangentAngle;
    fish.propulsionDir = target.tangentAngle;
    fish.targetAngle = target.tangentAngle;
    fish.steerTargetAngle = target.tangentAngle;
    fish.aiHeadingFiltered = target.tangentAngle;
    fish.velocity = {
        x: target.tangentX * 0.08,
        y: target.tangentY * 0.08,
    };
    fish.depth = normalizeZenKoiFormationProfile(fish.formationProfile)?.spawnDepth ?? fish.depth;
    if (Array.isArray(fish.history)) {
        const nextHistory = buildKoiSpawnHistory({
            x: fish.x,
            y: fish.y,
            angle: fish.angle,
            historyLength: fish.history.length,
            segmentSpacing: fish.segmentSpacing,
        });
        for (let i = 0; i < fish.history.length; i += 1) {
            fish.history[i].x = nextHistory[i].x;
            fish.history[i].y = nextHistory[i].y;
            fish.history[i].angle = nextHistory[i].angle;
        }
    }
    return true;
};

export default normalizeZenKoiFormationProfile;
