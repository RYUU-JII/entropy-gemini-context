import {
    computeTailJointPose,
    resolveHeadwardAngleFromHistory,
    wrapAngle,
} from './koiMotion.js';
import { resolveKoiBodyRadius } from './koiSilhouetteCore.js';

const DEFAULT_NECK_INDEX_RATIO = 4 / 30;

export const DEFAULT_KOI_APPENDAGE_PROFILE = Object.freeze({
    pectoralSize: 1.5,
    pectoralAngle: 0.08,
    pectoralPosShift: -1,
    pectoralPosSide: 0.5,
    pectoralWidthScale: 1.2,
    pectoralTipRoundness: 0.6,
    pectoralLeadingCurvature: 0.15,
    pectoralTrailingCurvature: 0,
    ventralSize: 1.15,
    ventralAngle: 0.65,
    ventralPosShift: -1,
    ventralPosSide: 0.75,
    tailFinSize: 1.6,
    tailFinSpread: 0.27,
    tailFinNotchDepth: 0.77,
    tailFinBaseWidth: 1.33,
    tailFinRoundness: 1.45,
    tailFinEdgeSharpness: 2,
    tailFinRootOffset: 0.55,
    tailFinVeinAlpha: 1.42,
    tailFinTurnSpreadGain: 1.8,
});

function toFinite(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, minimum, maximum, fallback) {
    return Math.max(minimum, Math.min(maximum, toFinite(value, fallback)));
}

function clampIndex(value, minimum, maximum, fallback) {
    return Math.max(
        minimum,
        Math.min(maximum, Math.round(toFinite(value, fallback))),
    );
}

function freezePoint(point) {
    return Object.freeze({
        x: toFinite(point?.x, 0),
        y: toFinite(point?.y, 0),
    });
}

export function normalizeKoiAppendageProfile(candidate = null) {
    if (
        candidate === null
        || candidate === undefined
        || candidate === DEFAULT_KOI_APPENDAGE_PROFILE
    ) {
        return DEFAULT_KOI_APPENDAGE_PROFILE;
    }
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const defaults = DEFAULT_KOI_APPENDAGE_PROFILE;
    return Object.freeze({
        pectoralSize: clamp(source.pectoralSize, 0.1, 4, defaults.pectoralSize),
        pectoralAngle: clamp(source.pectoralAngle, -1.4, 2.2, defaults.pectoralAngle),
        pectoralPosShift: clampIndex(source.pectoralPosShift, -32, 32, defaults.pectoralPosShift),
        pectoralPosSide: clamp(source.pectoralPosSide, 0.1, 2, defaults.pectoralPosSide),
        pectoralWidthScale: clamp(
            source.pectoralWidthScale,
            0.1,
            3,
            defaults.pectoralWidthScale,
        ),
        pectoralTipRoundness: clamp(
            source.pectoralTipRoundness,
            0.1,
            3,
            defaults.pectoralTipRoundness,
        ),
        pectoralLeadingCurvature: clamp(
            source.pectoralLeadingCurvature,
            -2,
            2,
            defaults.pectoralLeadingCurvature,
        ),
        pectoralTrailingCurvature: clamp(
            source.pectoralTrailingCurvature,
            -2,
            2,
            defaults.pectoralTrailingCurvature,
        ),
        ventralSize: clamp(source.ventralSize, 0.1, 4, defaults.ventralSize),
        ventralAngle: clamp(source.ventralAngle, -1.4, 2.2, defaults.ventralAngle),
        ventralPosShift: clampIndex(source.ventralPosShift, -32, 32, defaults.ventralPosShift),
        ventralPosSide: clamp(source.ventralPosSide, 0.1, 2, defaults.ventralPosSide),
        tailFinSize: clamp(source.tailFinSize, 0.1, 4, defaults.tailFinSize),
        tailFinSpread: clamp(source.tailFinSpread, 0.12, 1.2, defaults.tailFinSpread),
        tailFinNotchDepth: clamp(
            source.tailFinNotchDepth,
            0.45,
            0.95,
            defaults.tailFinNotchDepth,
        ),
        tailFinBaseWidth: clamp(
            source.tailFinBaseWidth,
            0.35,
            2,
            defaults.tailFinBaseWidth,
        ),
        tailFinRoundness: clamp(
            source.tailFinRoundness,
            0.35,
            2,
            defaults.tailFinRoundness,
        ),
        tailFinEdgeSharpness: clamp(
            source.tailFinEdgeSharpness,
            0.4,
            2,
            defaults.tailFinEdgeSharpness,
        ),
        tailFinRootOffset: clamp(
            source.tailFinRootOffset,
            0,
            0.55,
            defaults.tailFinRootOffset,
        ),
        tailFinVeinAlpha: clamp(
            source.tailFinVeinAlpha,
            0,
            2,
            defaults.tailFinVeinAlpha,
        ),
        tailFinTurnSpreadGain: clamp(
            source.tailFinTurnSpreadGain,
            0,
            2,
            defaults.tailFinTurnSpreadGain,
        ),
    });
}

export function resolveKoiAppendageIndices({
    historyLength = 0,
    neckIndex = null,
    tuning = null,
} = {}) {
    const length = Math.max(0, Math.floor(Number(historyLength) || 0));
    if (length <= 0) {
        return Object.freeze({
            pectoralIndex: 0,
            ventralIndex: 0,
        });
    }

    const profile = normalizeKoiAppendageProfile(tuning);
    const maxBodyIndex = Math.max(0, length - 2);
    const proportionalNeckIndex = Math.round((length - 1) * DEFAULT_NECK_INDEX_RATIO);
    const baseNeckIndex = clampIndex(
        neckIndex,
        0,
        maxBodyIndex,
        proportionalNeckIndex,
    );
    const rawPectoralIndex = Math.round(length * 0.3) + profile.pectoralPosShift;
    const pectoralIndex = Math.max(
        0,
        Math.min(maxBodyIndex, Math.max(baseNeckIndex + 1, rawPectoralIndex)),
    );
    const rawVentralIndex = Math.round(length * 0.55) + profile.ventralPosShift;
    const ventralIndex = Math.max(
        0,
        Math.min(maxBodyIndex, Math.max(pectoralIndex + 2, rawVentralIndex)),
    );
    return Object.freeze({ pectoralIndex, ventralIndex });
}

export function resolveKoiFlowingFinPathGeometry({
    finSize,
    tuning = null,
} = {}) {
    const profile = normalizeKoiAppendageProfile(tuning);
    const size = Math.max(0, toFinite(finSize, 0));
    if (size <= 0) {
        throw new Error('ZEN_KOI_FIN_GEOMETRY_SIZE_REQUIRED');
    }
    return Object.freeze({
        kind: 'fin_path',
        root: freezePoint({ x: 0, y: 0 }),
        leadingControl: freezePoint({
            x: size * (0.1 + profile.pectoralLeadingCurvature),
            y: size * 0.4,
        }),
        tip: freezePoint({ x: -size * 0.3, y: size }),
        trailingControlA: freezePoint({
            x: -size * (0.5 * profile.pectoralWidthScale * profile.pectoralTipRoundness),
            y: size * 0.9,
        }),
        trailingControlB: freezePoint({
            x: -size * ((0.75 * profile.pectoralWidthScale) + profile.pectoralTrailingCurvature),
            y: size * 0.4,
        }),
    });
}

function transformFinPoint(point, {
    angle,
    finAngle,
    origin,
    side,
    sideOffset,
}) {
    const finCos = Math.cos(finAngle);
    const finSin = Math.sin(finAngle);
    const finX = (point.x * finCos) - (point.y * finSin);
    const finY = ((point.x * finSin) + (point.y * finCos)) * (side < 0 ? -1 : 1);
    const offsetY = finY + sideOffset * side;
    const bodyCos = Math.cos(angle);
    const bodySin = Math.sin(angle);
    return freezePoint({
        x: origin.x + (finX * bodyCos) - (offsetY * bodySin),
        y: origin.y + (finX * bodySin) + (offsetY * bodyCos),
    });
}

function placeFinGeometry({
    history,
    index,
    role,
    side,
    size,
    bodyTuning,
    profile,
    angleOffset,
}) {
    const point = history[index];
    const progress = index / Math.max(1, history.length - 1);
    const radius = resolveKoiBodyRadius(progress, size, bodyTuning);
    const bodyAngle = resolveHeadwardAngleFromHistory(history, index, point?.angle);
    const isPectoral = role === 'pectoral';
    const finSize = size
        * (isPectoral ? profile.pectoralSize : profile.ventralSize);
    const localPath = resolveKoiFlowingFinPathGeometry({
        finSize,
        tuning: profile,
    });
    const transform = (value) => transformFinPoint(value, {
        angle: bodyAngle,
        finAngle: (isPectoral ? profile.pectoralAngle : profile.ventralAngle)
            + toFinite(angleOffset, 0),
        origin: point,
        side,
        sideOffset: radius * (isPectoral ? profile.pectoralPosSide : profile.ventralPosSide),
    });
    return Object.freeze({
        kind: 'fin',
        role,
        side,
        index,
        root: transform(localPath.root),
        leadingControl: transform(localPath.leadingControl),
        tip: transform(localPath.tip),
        trailingControlA: transform(localPath.trailingControlA),
        trailingControlB: transform(localPath.trailingControlB),
    });
}

function interpolateAngle(left, right, amount) {
    return left + (wrapAngle(right - left) * amount);
}

function resolveKoiTailPathGeometry({
    history,
    size,
    tuning,
    bodyTuning,
    variant,
    turnRate,
    bank,
}) {
    const profile = normalizeKoiAppendageProfile(tuning);
    const tip = history[history.length - 1];
    const tailPose = computeTailJointPose({
        history,
        tipPos: tip,
        turnRate,
        bank,
        tailTurnSpreadGain: profile.tailFinTurnSpreadGain,
    });
    const jointRootAngle = tailPose.jointRootAngle;
    const jointTipAngle = tailPose.jointTipAngle;
    const bodyForwardAngle = tailPose.bodyForwardAngle;
    const forwardX = Math.cos(bodyForwardAngle);
    const forwardY = Math.sin(bodyForwardAngle);
    const root = {
        x: tip.x + (forwardX * size * profile.tailFinRootOffset),
        y: tip.y + (forwardY * size * profile.tailFinRootOffset),
    };
    const tailLength = size * (variant === 'elegant' ? 1.1 : 0.9) * profile.tailFinSize;
    const baseWidth = resolveKoiBodyRadius(0.98, size, bodyTuning)
        * 0.4
        * profile.tailFinBaseWidth;
    const turnAbs = Math.abs(turnRate);
    const spreadAngle = clamp(
        profile.tailFinSpread + (turnAbs * 1.55 * profile.tailFinTurnSpreadGain),
        0.12,
        1.25,
        profile.tailFinSpread,
    );
    const sideDrag = turnRate * 0.75;
    const rootAngle = jointRootAngle - (sideDrag * 0.45);
    const tipAngle = jointTipAngle - (sideDrag * 0.88);
    const forwardAngle = interpolateAngle(rootAngle, tipAngle, 0.54);
    const rootNormalX = Math.cos(rootAngle - (Math.PI / 2));
    const rootNormalY = Math.sin(rootAngle - (Math.PI / 2));
    const tipNormalX = Math.cos(tipAngle - (Math.PI / 2));
    const tipNormalY = Math.sin(tipAngle - (Math.PI / 2));
    const leftBase = {
        x: root.x - (forwardX * size * 0.08) + (rootNormalX * baseWidth),
        y: root.y - (forwardY * size * 0.08) + (rootNormalY * baseWidth),
    };
    const rightBase = {
        x: root.x - (forwardX * size * 0.08) - (rootNormalX * baseWidth),
        y: root.y - (forwardY * size * 0.08) - (rootNormalY * baseWidth),
    };
    const leftTip = {
        x: root.x + (Math.cos(tipAngle - spreadAngle) * tailLength),
        y: root.y + (Math.sin(tipAngle - spreadAngle) * tailLength),
    };
    const rightTip = {
        x: root.x + (Math.cos(tipAngle + spreadAngle) * tailLength),
        y: root.y + (Math.sin(tipAngle + spreadAngle) * tailLength),
    };
    const centerTip = {
        x: root.x + (Math.cos(forwardAngle) * tailLength * profile.tailFinNotchDepth),
        y: root.y + (Math.sin(forwardAngle) * tailLength * profile.tailFinNotchDepth),
    };
    const edgeLinearity = clamp(0.4 / profile.tailFinEdgeSharpness, 0.22, 0.58, 0.4);
    const edgeBulgeMain = size * 0.1 * profile.tailFinRoundness;
    const edgeBulgeTip = size * 0.15 * profile.tailFinRoundness;
    const notchBlend = size * 0.15 * profile.tailFinRoundness;
    const notchSideAngle = 0.3 + ((profile.tailFinRoundness - 1) * 0.08);

    return Object.freeze({
        kind: 'tail',
        root: freezePoint(root),
        leftBase: freezePoint(leftBase),
        leftOuterControlA: freezePoint({
            x: leftBase.x + ((leftTip.x - leftBase.x) * edgeLinearity)
                + (rootNormalX * edgeBulgeMain),
            y: leftBase.y + ((leftTip.y - leftBase.y) * edgeLinearity)
                + (rootNormalY * edgeBulgeMain),
        }),
        leftOuterControlB: freezePoint({
            x: leftTip.x + (tipNormalX * edgeBulgeTip),
            y: leftTip.y + (tipNormalY * edgeBulgeTip),
        }),
        leftTip: freezePoint(leftTip),
        leftNotchControlA: freezePoint({
            x: leftTip.x - (tipNormalX * size * 0.05 * profile.tailFinRoundness),
            y: leftTip.y - (tipNormalY * size * 0.05 * profile.tailFinRoundness),
        }),
        leftNotchControlB: freezePoint({
            x: centerTip.x + (Math.cos(tipAngle - notchSideAngle) * notchBlend),
            y: centerTip.y + (Math.sin(tipAngle - notchSideAngle) * notchBlend),
        }),
        centerTip: freezePoint(centerTip),
        rightNotchControlA: freezePoint({
            x: centerTip.x + (Math.cos(tipAngle + notchSideAngle) * notchBlend),
            y: centerTip.y + (Math.sin(tipAngle + notchSideAngle) * notchBlend),
        }),
        rightNotchControlB: freezePoint({
            x: rightTip.x + (tipNormalX * size * 0.05 * profile.tailFinRoundness),
            y: rightTip.y + (tipNormalY * size * 0.05 * profile.tailFinRoundness),
        }),
        rightTip: freezePoint(rightTip),
        rightOuterControlA: freezePoint({
            x: rightTip.x - (tipNormalX * edgeBulgeTip),
            y: rightTip.y - (tipNormalY * edgeBulgeTip),
        }),
        rightOuterControlB: freezePoint({
            x: rightBase.x + ((rightTip.x - rightBase.x) * edgeLinearity)
                - (rootNormalX * edgeBulgeMain),
            y: rightBase.y + ((rightTip.y - rightBase.y) * edgeLinearity)
                - (rootNormalY * edgeBulgeMain),
        }),
        rightBase: freezePoint(rightBase),
        rootCloseControlA: freezePoint({
            x: root.x - (rootNormalX * baseWidth),
            y: root.y - (rootNormalY * baseWidth),
        }),
        rootCloseControlB: freezePoint({
            x: root.x + (rootNormalX * baseWidth),
            y: root.y + (rootNormalY * baseWidth),
        }),
        tailLength,
        veinAlpha: profile.tailFinVeinAlpha,
    });
}

export function buildCanonicalKoiAppendageGeometry({
    history = null,
    size = 0,
    tuning = null,
    bodyTuning = tuning,
    variant = 'elegant',
    neckIndex = null,
    finAngleOffset = 0,
    turnRate = 0,
    bank = 0,
} = {}) {
    if (!Array.isArray(history) || history.length < 3) {
        throw new Error('ZEN_KOI_APPENDAGE_HISTORY_REQUIRED');
    }
    const resolvedSize = Math.max(0, toFinite(size, 0));
    if (resolvedSize <= 0) {
        throw new Error('ZEN_KOI_APPENDAGE_SIZE_REQUIRED');
    }
    const profile = normalizeKoiAppendageProfile(tuning);
    const indices = resolveKoiAppendageIndices({
        historyLength: history.length,
        neckIndex,
        tuning: profile,
    });
    const fins = [];
    for (const side of [-1, 1]) {
        fins.push(placeFinGeometry({
            history,
            index: indices.pectoralIndex,
            role: 'pectoral',
            side,
            size: resolvedSize,
            bodyTuning,
            profile,
            angleOffset: finAngleOffset,
        }));
        fins.push(placeFinGeometry({
            history,
            index: indices.ventralIndex,
            role: 'ventral',
            side,
            size: resolvedSize,
            bodyTuning,
            profile,
            angleOffset: finAngleOffset * 0.36,
        }));
    }

    return Object.freeze({
        contract: 'canonical_koi_appendage_geometry_v1',
        profile,
        indices,
        fins: Object.freeze(fins),
        tail: resolveKoiTailPathGeometry({
            history,
            size: resolvedSize,
            tuning: profile,
            bodyTuning,
            variant,
            turnRate: toFinite(turnRate, 0),
            bank: toFinite(bank, 0),
        }),
    });
}

export function traceKoiAppendagePath(pathLike, geometry) {
    if (!pathLike || typeof pathLike.moveTo !== 'function') return pathLike;
    if (geometry?.kind === 'fin') {
        pathLike.moveTo(geometry.root.x, geometry.root.y);
        pathLike.quadraticCurveTo(
            geometry.leadingControl.x,
            geometry.leadingControl.y,
            geometry.tip.x,
            geometry.tip.y,
        );
        pathLike.bezierCurveTo(
            geometry.trailingControlA.x,
            geometry.trailingControlA.y,
            geometry.trailingControlB.x,
            geometry.trailingControlB.y,
            geometry.root.x,
            geometry.root.y,
        );
        pathLike.closePath();
        return pathLike;
    }
    if (geometry?.kind !== 'tail') return pathLike;

    pathLike.moveTo(geometry.leftBase.x, geometry.leftBase.y);
    pathLike.bezierCurveTo(
        geometry.leftOuterControlA.x,
        geometry.leftOuterControlA.y,
        geometry.leftOuterControlB.x,
        geometry.leftOuterControlB.y,
        geometry.leftTip.x,
        geometry.leftTip.y,
    );
    pathLike.bezierCurveTo(
        geometry.leftNotchControlA.x,
        geometry.leftNotchControlA.y,
        geometry.leftNotchControlB.x,
        geometry.leftNotchControlB.y,
        geometry.centerTip.x,
        geometry.centerTip.y,
    );
    pathLike.bezierCurveTo(
        geometry.rightNotchControlA.x,
        geometry.rightNotchControlA.y,
        geometry.rightNotchControlB.x,
        geometry.rightNotchControlB.y,
        geometry.rightTip.x,
        geometry.rightTip.y,
    );
    pathLike.bezierCurveTo(
        geometry.rightOuterControlA.x,
        geometry.rightOuterControlA.y,
        geometry.rightOuterControlB.x,
        geometry.rightOuterControlB.y,
        geometry.rightBase.x,
        geometry.rightBase.y,
    );
    pathLike.bezierCurveTo(
        geometry.rootCloseControlA.x,
        geometry.rootCloseControlA.y,
        geometry.rootCloseControlB.x,
        geometry.rootCloseControlB.y,
        geometry.leftBase.x,
        geometry.leftBase.y,
    );
    pathLike.closePath();
    return pathLike;
}
