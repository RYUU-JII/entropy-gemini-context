import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import { SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import {
    ZEN_BONSAI_SURFACE_FEEDBACK_KINDS,
} from '../ZenBonsaiGrowthProjection.js';
import {
    clamp,
    lerp,
} from './sakuraMath';
import {
    SAKURA_BRANCH_RUNTIME_MOTION,
    resolveSakuraBranchLifeSag,
    resolveSakuraBranchRenderDynamics,
    resolveSakuraEffectiveBranchWindState,
} from './sakuraBranchMotionModel';
import {
    normalizeZenBonsaiActivationPresentation,
    resolveZenBonsaiActivationPresentationSignal,
} from '../bonsai/presentation/ZenBonsaiActivationPresentation.js';
import { resolveSakuraRenderLighting, withAlphaColor } from './sakuraRenderLighting';
import { SAKURA_TERMINAL_PAINT_METRICS } from './sakuraRenderPaintMetrics.js';
import {
    resolveSakuraTerminalDisplayScale,
    resolveSakuraTerminalRenderDistance,
} from './sakuraTerminalPresentation.js';
import {
    requireSakuraRenderPlanV1,
    resolveSakuraRenderPlanRecordPoseV1,
    SAKURA_RENDER_PLAN_MOTION_MODE,
} from './sakuraRenderPlan.js';

const TWO_PI = Math.PI * 2;
const clamp01 = (value) => clamp(Number(value) || 0, 0, 1);
export {
    SAKURA_BRANCH_RUNTIME_MOTION,
    resolveSakuraBranchLifeSag,
    resolveSakuraBranchRenderDynamics,
} from './sakuraBranchMotionModel';
export {
    resolveSakuraActivationBloomStage,
    resolveSakuraTerminalDisplayScale,
    resolveSakuraTerminalRenderDistance,
} from './sakuraTerminalPresentation.js';

const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};

/**
 * Resolves a short-lived blossom cue for a committed Classic2 shoot frontier.
 * This remains presentation-only: current activation never creates a lineage
 * terminal and the cue hands off to structural carriers as the shoot matures.
 */
export const resolveSakuraFrontierBloomCue = ({
    lifeGrowth,
    activationPresentation = null,
    cohort = 0,
} = {}) => {
    const activation = normalizeZenBonsaiActivationPresentation(activationPresentation);
    if (!activation) {
        return null;
    }
    const normalizedGrowth = Number(lifeGrowth);
    const normalizedCohort = Number(cohort);
    if (!Number.isFinite(normalizedGrowth) || normalizedGrowth < 0 || normalizedGrowth > 1) {
        throw new Error('ZEN_SAKURA_FRONTIER_BLOOM_GROWTH_INVALID');
    }
    if (!Number.isFinite(normalizedCohort) || normalizedCohort < 0 || normalizedCohort > 1) {
        throw new Error('ZEN_SAKURA_FRONTIER_BLOOM_COHORT_INVALID');
    }

    const emergence = smoothstep01((normalizedGrowth - 0.48) / 0.08);
    const structuralHandoff = 1 - smoothstep01((normalizedGrowth - 0.64) / 0.08);
    const handoffWindow = emergence * structuralHandoff;
    if (handoffWindow <= 0.02) {
        return null;
    }

    const activationSignal = resolveZenBonsaiActivationPresentationSignal(activation);
    const visibleCohort = handoffWindow * clamp(
        0.015 + (0.3 * (activationSignal ** 1.4)),
        0.015,
        0.32,
    );
    if (normalizedCohort > visibleCohort) {
        return null;
    }
    return 'half_open';
};

export const resolveSakuraBranchTaperSampleWidth = (widthProfile = {}, t = 0, fallbackWidth = 1) => {
    const safeFallback = Math.max(0.01, Number(fallbackWidth) || 0.01);
    const baseWidth = Math.max(0.01, Number(widthProfile?.baseWidth) || safeFallback);
    const shoulderT = clamp(Number(widthProfile?.shoulderT ?? 0.64), 0.05, 0.94);
    const tipStartT = clamp(Number(widthProfile?.tipStartT ?? 0.8), shoulderT, 0.98);
    const shoulderWidth = Math.max(
        0.01,
        Number(widthProfile?.shoulderWidth) || baseWidth,
    );
    const tipWidth = Math.max(
        0.01,
        Number(widthProfile?.tipWidth) || Math.min(shoulderWidth, baseWidth),
    );
    const safeT = clamp01(t);
    if (safeT <= shoulderT) {
        return lerp(baseWidth, shoulderWidth, smoothstep01(safeT / Math.max(0.001, shoulderT)));
    }
    if (safeT <= tipStartT) {
        return shoulderWidth;
    }
    return lerp(
        shoulderWidth,
        tipWidth,
        smoothstep01((safeT - tipStartT) / Math.max(0.001, 1 - tipStartT)),
    );
};

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const nodeHashUnit = (node = {}, salt = 'default') => hashUnit([
    node?.nodeId || 'node',
    node?.branchOrderName || '',
    Number(node?.branchOrder) || 0,
    Math.round((Number(node?.length) || 0) * 100),
    Math.round((Number(node?.width) || 0) * 100),
    salt,
].join('|'));

const mixHexColor = (hexA, hexB, amount = 0) => {
    const a = String(hexA || '').replace('#', '');
    const b = String(hexB || '').replace('#', '');
    if (a.length !== 6 || b.length !== 6) {
        return hexA;
    }
    const t = clamp01(amount);
    const channel = (start, end) => Math.round(lerp(start, end, t)).toString(16).padStart(2, '0');
    const ar = Number.parseInt(a.slice(0, 2), 16);
    const ag = Number.parseInt(a.slice(2, 4), 16);
    const ab = Number.parseInt(a.slice(4, 6), 16);
    const br = Number.parseInt(b.slice(0, 2), 16);
    const bg = Number.parseInt(b.slice(2, 4), 16);
    const bb = Number.parseInt(b.slice(4, 6), 16);
    return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
};

export const resolveSakuraBarkTexturePlan = (node = {}, depth = 1) => {
    const branchOrder = Number.isFinite(Number(node?.branchOrder))
        ? Number(node.branchOrder)
        : SAKURA_BRANCH_ORDER.TRUNK;
    const width = Math.max(0, Number(node?.width) || 0);
    const length = Math.max(0, Number(node?.length) || 0);
    const isMatureWood = (
        depth <= 4
        && width > 3.4
        && (
            branchOrder === SAKURA_BRANCH_ORDER.TRUNK
            || branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
        )
    );
    if (!isMatureWood) {
        return [];
    }
    const count = Math.max(1, Math.min(8, Math.round((length * 0.045) + (width * 0.18))));
    return Array.from({ length: count }, (_, index) => {
        const t = 0.1 + (nodeHashUnit(node, `bark_t_${index}`) * 0.78);
        const side = nodeHashUnit(node, `bark_side_${index}`) >= 0.5 ? 1 : -1;
        return {
            t,
            spanT: lerp(0.016, 0.046, nodeHashUnit(node, `bark_span_${index}`)),
            offset: side * width * lerp(0.12, 0.34, nodeHashUnit(node, `bark_offset_${index}`)),
            alpha: lerp(0.038, 0.105, nodeHashUnit(node, `bark_alpha_${index}`)),
            width: Math.max(0.18, width * lerp(0.025, 0.055, nodeHashUnit(node, `bark_width_${index}`))),
            span: width * lerp(0.34, 0.64, nodeHashUnit(node, `bark_band_span_${index}`)),
            tilt: lerp(-0.14, 0.14, nodeHashUnit(node, `bark_band_tilt_${index}`)),
            tone: nodeHashUnit(node, `bark_tone_${index}`) > 0.54 ? 'highlight' : 'shadow',
        };
    });
};

export const SAKURA_TREE_CONTENT_LAYERS = Object.freeze({
    ALL: 'all',
    WOOD: 'wood',
    TERMINALS: 'terminals',
});
const SAKURA_TREE_CONTENT_LAYER_VALUES = new Set(Object.values(SAKURA_TREE_CONTENT_LAYERS));

export const SAKURA_BRANCH_DETAIL_PROFILES = Object.freeze({
    FULL: 'full',
    TWIG_SILHOUETTE: 'twig_silhouette',
});
const SAKURA_BRANCH_DETAIL_PROFILE_VALUES = new Set(Object.values(SAKURA_BRANCH_DETAIL_PROFILES));

const resolveSakuraTreeContentLayer = (value) => {
    const layer = typeof value === 'string' && value.trim()
        ? value.trim()
        : SAKURA_TREE_CONTENT_LAYERS.ALL;
    if (!SAKURA_TREE_CONTENT_LAYER_VALUES.has(layer)) {
        throw new Error(`ZEN_SAKURA_TREE_CONTENT_LAYER_INVALID:${layer}`);
    }
    return layer;
};

const resolveSakuraBranchDetailProfile = (value) => {
    const profile = typeof value === 'string' && value.trim()
        ? value.trim()
        : SAKURA_BRANCH_DETAIL_PROFILES.FULL;
    if (!SAKURA_BRANCH_DETAIL_PROFILE_VALUES.has(profile)) {
        throw new Error(`ZEN_SAKURA_BRANCH_DETAIL_PROFILE_INVALID:${profile}`);
    }
    return profile;
};

export const createSakuraBranchLayerRenderer = ({
    ctx,
    assetCache,
    config,
    showBranchTierDebug = false,
    frameCount = 0,
    wind = 0,
    lighting = null,
    renderTreeContent = SAKURA_TREE_CONTENT_LAYERS.ALL,
    freezeBranchMotion = false,
    deferBranchSagToRuntime = false,
    lifeState = null,
    activationPresentation = null,
    branchDetailProfile = SAKURA_BRANCH_DETAIL_PROFILES.FULL,
    renderPlan = null,
    renderPlanRoot = null,
    renderPlanPresentation = 'runtime',
}) => {
    const lightingState = lighting || resolveSakuraRenderLighting(null);
    const resolvedTreeContent = resolveSakuraTreeContentLayer(renderTreeContent);
    const resolvedBranchDetailProfile = resolveSakuraBranchDetailProfile(branchDetailProfile);
    const useTwigSilhouetteProfile = (
        resolvedBranchDetailProfile === SAKURA_BRANCH_DETAIL_PROFILES.TWIG_SILHOUETTE
    );
    const renderWood = (
        resolvedTreeContent === SAKURA_TREE_CONTENT_LAYERS.ALL
        || resolvedTreeContent === SAKURA_TREE_CONTENT_LAYERS.WOOD
    );
    const renderTerminals = (
        resolvedTreeContent === SAKURA_TREE_CONTENT_LAYERS.ALL
        || resolvedTreeContent === SAKURA_TREE_CONTENT_LAYERS.TERMINALS
    );
    const toNumber = (value, fallback = 0) => (
        Number.isFinite(Number(value)) ? Number(value) : fallback
    );
    const resolvedRenderPlan = requireSakuraRenderPlanV1(renderPlan);
    const plannedRoot = renderPlanRoot || resolvedRenderPlan.root;
    if (!plannedRoot || plannedRoot.node?.type !== 'branch') {
        throw new Error('ZEN_SAKURA_BRANCH_RENDER_PLAN_ROOT_REQUIRED');
    }
    if (renderPlanPresentation !== 'runtime' && renderPlanPresentation !== 'bake') {
        throw new Error('ZEN_SAKURA_BRANCH_RENDER_PLAN_PRESENTATION_INVALID');
    }
    const plannedPresentation = resolvedRenderPlan.presentation[renderPlanPresentation];
    const terminalPresentationContext = plannedPresentation.context;
    const {
        growthPlan,
        growthPlanActive,
        imprintGravityBias,
        lifeAppearance,
        lifeGrowth,
        lifeMood,
        lifeVitality,
    } = terminalPresentationContext;
    const lifeBranchSag = deferBranchSagToRuntime
        ? 0
        : Number(plannedPresentation.lifeBranchSag);
    const branchMotionWindState = resolveSakuraEffectiveBranchWindState({
        wind,
        lifeState,
        freezeBranchMotion,
    });
    const branchMotionFrameCount = freezeBranchMotion ? 0 : frameCount;
    const lifeBarkColor = mixHexColor(config.barkColor, '#655443', lifeMood.wither * 0.64);
    const lifeBarkShadow = mixHexColor(config.barkShadow, '#443832', lifeMood.wither * 0.52);
    const lifeBarkHighlight = mixHexColor(config.barkHighlight, '#8A785F', lifeMood.wither * 0.6);
    const shouldUseTwigSilhouette = (node = {}) => (
        useTwigSilhouetteProfile
        && Number(node?.branchOrder) === SAKURA_BRANCH_ORDER.TERMINAL_TWIG
    );
    const hasRenderableWidthProfile = (node = {}) => (
        node?.widthProfile
        && Number.isFinite(Number(node.widthProfile.baseWidth))
        && Number.isFinite(Number(node.widthProfile.tipWidth))
    );
    const drawTaperedBranchShape = ({
        node = {},
        segment,
        renderWidth = 1,
        fillStyle,
        offsetX = 0,
        offsetY = 0,
    } = {}) => {
        const widthProfile = node?.widthProfile;
        const profileBaseWidth = Math.max(0.01, Number(widthProfile?.baseWidth) || Math.max(0.01, Number(node?.width) || 0.01));
        const widthScale = Math.max(0.01, Number(renderWidth) || 0.01) / profileBaseWidth;
        const left = [];
        const right = [];
        const sampleCount = 8;
        for (let index = 0; index <= sampleCount; index += 1) {
            const t = index / sampleCount;
            const point = BranchGeometryModel.pointAt(segment, t);
            const normalAngle = BranchGeometryModel.angleAt(segment, t) + (Math.PI / 2);
            const halfWidth = Math.max(
                0.035,
                resolveSakuraBranchTaperSampleWidth(widthProfile, t, profileBaseWidth) * widthScale * 0.5,
            );
            const normalX = Math.cos(normalAngle) * halfWidth;
            const normalY = Math.sin(normalAngle) * halfWidth;
            left.push({ x: point.x + normalX + offsetX, y: point.y + normalY + offsetY });
            right.push({ x: point.x - normalX + offsetX, y: point.y - normalY + offsetY });
        }
        ctx.save();
        ctx.fillStyle = fillStyle;
        ctx.beginPath();
        left.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        for (let index = right.length - 1; index >= 0; index -= 1) {
            ctx.lineTo(right[index].x, right[index].y);
        }
        ctx.closePath();
        ctx.fill();
        [0, 1].forEach((t) => {
            const point = BranchGeometryModel.pointAt(segment, t);
            const tangentAngle = BranchGeometryModel.angleAt(segment, t);
            const halfWidth = Math.max(
                0.035,
                resolveSakuraBranchTaperSampleWidth(widthProfile, t, profileBaseWidth) * widthScale * 0.5,
            );
            ctx.save();
            ctx.translate(point.x + offsetX, point.y + offsetY);
            ctx.rotate(tangentAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, Math.max(0.04, halfWidth * 0.74), halfWidth, 0, 0, TWO_PI);
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    };
    const hexToRgba = (hex, alpha = 1) => {
        const value = String(hex || '').replace('#', '');
        if (value.length !== 6) {
            return `rgba(255,255,255,${alpha})`;
        }
        const r = Number.parseInt(value.slice(0, 2), 16);
        const g = Number.parseInt(value.slice(2, 4), 16);
        const b = Number.parseInt(value.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const resolveBranchTierDebugColor = (node) => {
        if (!showBranchTierDebug) {
            return null;
        }
        if (node?.branchOrder === SAKURA_BRANCH_ORDER.TRUNK) {
            return '#000000';
        }
        if (
            node?.branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
            || node?.branchOrder === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH
        ) {
            return '#FF0000';
        }
        if (node?.branchOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
            return '#0000FF';
        }
        return '#FF0000';
    };

    const resolveTerminalSprite = (child) => {
        if (!child) {
            return null;
        }
        if (child.type === 'flower') {
            return typeof assetCache?.resolveFlowerSprite === 'function'
                ? assetCache.resolveFlowerSprite(child)
                : null;
        }
        return typeof assetCache?.resolveLeafSprite === 'function'
            ? assetCache.resolveLeafSprite(child)
            : null;
    };

    const drawTerminal = (child, tipX, tipY, tipAngle, sprite, lifeVisual = null) => {
        const isFlower = child.type === 'flower';
        const bloomStage = isFlower
            ? (lifeVisual?.presentationBloomStage || child?.blossom?.bloomStage)
            : null;
        const blossomLayers = isFlower ? Math.max(1, Number(child?.blossom?.layers) || 1) : 1;
        const developmentalBloomScale = bloomStage === 'bud'
            ? 0.72
            : (bloomStage === 'half_open' ? 0.88 : 1);
        const activationBloomScale = bloomStage === 'bud'
            ? lifeAppearance.budSwelling
            : lifeAppearance.blossomOpenness;
        const bloomStageScale = isFlower
            ? developmentalBloomScale * activationBloomScale
            : 1;
        const petalFall = isFlower ? clamp(Number(child?.blossom?.petalFall) || 0, 0, 1) : 0;
        if (!sprite) {
            return;
        }
        const scale = resolveSakuraTerminalDisplayScale(child, lifeVisual);
        const terminalPhase = hashUnit([
            child?.type || 'terminal',
            child?.color || '',
            Number(child?.angle) || 0,
            Number(child?.dist) || 0,
            Number(child?.scale) || 1,
            child?.blossom?.bloomStage || '',
        ].join('|')) * TWO_PI;
        const terminalFlutter = (
            Math.sin((toNumber(frameCount, 0) * (isFlower ? 0.026 : 0.034)) + terminalPhase)
            * (isFlower ? SAKURA_BRANCH_RUNTIME_MOTION.terminalFlowerFlutter : SAKURA_BRANCH_RUNTIME_MOTION.terminalLeafFlutter)
            * (0.34 + (toNumber(branchMotionWindState.intensity, 0) * SAKURA_BRANCH_RUNTIME_MOTION.terminalWindIntensityGain))
        ) + (
            toNumber(branchMotionWindState.flutter, 0) * (
                isFlower
                    ? SAKURA_BRANCH_RUNTIME_MOTION.terminalFlowerWindFlutter
                    : SAKURA_BRANCH_RUNTIME_MOTION.terminalLeafWindFlutter
            )
        );
        const terminalDroop = lifeAppearance.terminalDroop
            * (isFlower ? 0.14 : 0.22)
            * Math.sin((Math.PI / 2) - tipAngle);
        const structuralTilt = growthPlanActive
            ? clamp(Number(child?.structuralGravityTilt ?? 0), -0.18, 0.22)
            : 0;
        const activationLeafTilt = isFlower
            ? 0
            : lifeAppearance.leafTilt * lerp(
                0.72,
                1,
                hashUnit(`${child?.type || 'terminal'}|${child?.angle || 0}|activation_tilt`),
            );
        const rotationOffset = (
            (isFlower ? (Number(child?.blossom?.tilt) || 0) : 0)
            + terminalFlutter
            + terminalDroop
            + structuralTilt
            + activationLeafTilt
        );
        ctx.save();
        ctx.globalAlpha *= clamp(Number(lifeVisual?.alpha ?? 1), 0.05, 1);
        ctx.translate(tipX, tipY);
        ctx.rotate(tipAngle + rotationOffset);
        const lineagedFlowerAge = isFlower && child?.classic2Development?.lineage === true
            ? clamp01(child?.classic2Development?.age)
            : 1;
        const lineagedFlowerEmergence = isFlower && child?.classic2Development?.lineage === true
            ? lerp(0.08, 1, lineagedFlowerAge ** 1.8)
            : 1;
        if (lineagedFlowerEmergence < 1) {
            ctx.globalAlpha *= lerp(0.24, 1, lineagedFlowerAge);
            ctx.scale(lineagedFlowerEmergence, lineagedFlowerEmergence);
        }
        const terminalShadowReach = (
            isFlower
                ? SAKURA_TERMINAL_PAINT_METRICS.flowerShadowOffset
                : SAKURA_TERMINAL_PAINT_METRICS.leafShadowOffset
        ) * scale;
        if (!useTwigSilhouetteProfile) {
            ctx.save();
            ctx.translate(
                lightingState.shadowDirX * terminalShadowReach,
                lightingState.shadowDirY * terminalShadowReach,
            );
            if (isFlower) {
                const shadowRadiusX = SAKURA_TERMINAL_PAINT_METRICS.flowerShadowRadius
                    * scale
                    * bloomStageScale
                    * (1 + ((blossomLayers - 1) * 0.02));
                const shadowRadiusY = 0.96 * scale * (1 + (petalFall * 0.04));
                const shadowGradient = ctx.createRadialGradient(
                    0.2,
                    1.5 * scale,
                    0.4 * scale,
                    0.2,
                    1.5 * scale,
                    shadowRadiusX,
                );
                shadowGradient.addColorStop(
                    0,
                    withAlphaColor(
                        '#4A312B',
                        Math.max(0.01, (lightingState.blossomShadowAlpha * 0.26) + (petalFall * 0.01)),
                    ),
                );
                shadowGradient.addColorStop(
                    0.72,
                    withAlphaColor('#4A312B', Math.max(0.004, lightingState.blossomShadowAlpha * 0.08)),
                );
                shadowGradient.addColorStop(1, 'rgba(74,49,43,0)');
                ctx.fillStyle = shadowGradient;
                ctx.beginPath();
                ctx.ellipse(
                    0,
                    1.5 * scale,
                    shadowRadiusX,
                    shadowRadiusY,
                    0,
                    0,
                    Math.PI * 2,
                );
                ctx.fill();
            } else {
                ctx.fillStyle = withAlphaColor(
                    '#304425',
                    Math.max(0.08, lightingState.shadowAlpha * 0.84),
                );
                ctx.beginPath();
                ctx.ellipse(
                    0,
                    1.4 * scale,
                    SAKURA_TERMINAL_PAINT_METRICS.leafShadowRadius * scale,
                    1.6 * scale,
                    0,
                    0,
                    Math.PI * 2,
                );
                ctx.fill();
            }
            ctx.restore();
        }
        if (isFlower && !useTwigSilhouetteProfile) {
            ctx.strokeStyle = 'rgba(106, 82, 62, 0.24)';
            ctx.lineWidth = Math.max(0.2, 0.28 * scale * (bloomStage === 'bud' ? 0.88 : 1));
            ctx.beginPath();
            ctx.moveTo(-0.04, 0.72);
            ctx.quadraticCurveTo(-0.18, 1.92, -0.58, bloomStage === 'bud' ? 4.02 : 3.46);
            ctx.stroke();
            ctx.fillStyle = 'rgba(118,148,86,0.24)';
            ctx.beginPath();
            ctx.ellipse(
                -0.04,
                2.36,
                Math.max(0.3, 0.56 * scale),
                Math.max(0.18, 0.3 * scale),
                -0.16,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
        const sourceSize = Math.max(1, Number(sprite?.width) || Number(assetCache?.assetSize) || 64);
        const logicalSize = Math.max(
            1,
            Number(assetCache?.logicalAssetSize)
                || SAKURA_TERMINAL_PAINT_METRICS.logicalAssetSize,
        );
        const spriteScale = ((
            isFlower
                ? SAKURA_TERMINAL_PAINT_METRICS.flowerBitmapScale * bloomStageScale
                : SAKURA_TERMINAL_PAINT_METRICS.leafBitmapScale
        ) * scale * logicalSize) / sourceSize;
        const halfSize = sprite.width / 2;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
            ctx.imageSmoothingQuality = 'high';
        }
        if ('filter' in ctx) {
            const saturation = isFlower
                ? lifeAppearance.flowerSaturation
                : lifeAppearance.leafSaturation;
            ctx.filter = `saturate(${saturation.toFixed(3)}) brightness(${lifeAppearance.terminalBrightness.toFixed(3)})`;
        }
        ctx.scale(spriteScale, spriteScale);
        ctx.drawImage(sprite, -halfSize, -halfSize);
        ctx.restore();
        if (!useTwigSilhouetteProfile && isFlower && lifeAppearance.blossomWilt > 0.22) {
            ctx.fillStyle = withAlphaColor('#A97858', Math.min(0.2, lifeAppearance.blossomWilt * 0.2));
            ctx.beginPath();
            ctx.ellipse(
                0,
                0.38 * scale,
                Math.max(
                    1.6,
                    SAKURA_TERMINAL_PAINT_METRICS.flowerLifeOverlayRadius
                        * scale
                        * bloomStageScale,
                ),
                Math.max(0.58, 1.72 * scale),
                0.08,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
        if (!useTwigSilhouetteProfile && !isFlower && lifeMood.leafFade > 0.28) {
            ctx.fillStyle = withAlphaColor('#8A6C45', Math.min(0.16, lifeMood.leafFade * 0.16));
            ctx.beginPath();
            ctx.ellipse(
                0,
                0.6 * scale,
                Math.max(
                    1.4,
                    SAKURA_TERMINAL_PAINT_METRICS.leafLifeOverlayRadius * scale,
                ),
                Math.max(0.45, 1.2 * scale),
                -0.18,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
        ctx.restore();
    };

    const adjustColor = (hex, factor) => {
        const r = Math.min(255, Math.floor(parseInt(hex.slice(1, 3), 16) * factor));
        const g = Math.min(255, Math.floor(parseInt(hex.slice(3, 5), 16) * factor));
        const b = Math.min(255, Math.floor(parseInt(hex.slice(5, 7), 16) * factor));
        return `rgb(${r},${g},${b})`;
    };

    const drawFlowerPedicel = ({
        baseX,
        baseY,
        tipX,
        tipY,
        tangentAngle,
        child,
        presentationBloomStage = null,
    }) => {
        const scale = Number(child?.scale) || 1;
        const lineagedAge = child?.classic2Development?.lineage === true
            ? clamp01(child?.classic2Development?.age)
            : 1;
        const emergence = child?.classic2Development?.lineage === true
            ? lerp(0.08, 1, lineagedAge ** 1.8)
            : 1;
        const bloomStage = presentationBloomStage || child?.blossom?.bloomStage;
        const bloomStageScale = bloomStage === 'bud'
            ? 0.72
            : (bloomStage === 'half_open' ? 0.88 : 1);
        const dx = tipX - baseX;
        const dy = tipY - baseY;
        const dist = Math.hypot(dx, dy);
        if (dist <= 0.2) {
            return;
        }

        const dirX = dx / dist;
        const dirY = dy / dist;
        const normalX = -dirY;
        const normalY = dirX;
        const blossomInset = Math.min(dist * 0.12, (0.7 + (scale * 0.34)) * bloomStageScale);
        const targetPedicelLength = Number(child?.pedicelLength);
        const minimumPedicelLength = 0.8 * emergence;
        const pedicelLength = Number.isFinite(targetPedicelLength)
            ? clamp(targetPedicelLength, minimumPedicelLength, Math.max(minimumPedicelLength, dist - (blossomInset * 0.2)))
            : Math.max(minimumPedicelLength, dist - blossomInset);
        const bend = (
            clamp(Number(child?.angle) || 0, -1.1, 1.1) * Math.min(1.4, dist * 0.16)
        ) + (
                clamp(Number(child?.pedicelBend) || 0, -0.8, 0.8) * Math.min(1.6, dist * 0.22)
            );
        const controlLead = Math.min(pedicelLength * 0.72, 4.2 + (scale * 1.8));
        const endX = baseX + (dirX * pedicelLength);
        const endY = baseY + (dirY * pedicelLength);
        const controlX = baseX
            + (Math.cos(tangentAngle) * controlLead)
            + (normalX * bend);
        const controlY = baseY
            + (Math.sin(tangentAngle) * controlLead)
            + (normalY * bend);

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = withAlphaColor(
            mixHexColor('#766250', '#8D704B', lifeAppearance.pedicelDryness),
            Math.max(0.02, (0.24 + (lightingState.shadowAlpha * 0.22)) * emergence),
        );
        ctx.lineWidth = Math.max(0.02, 0.28 * scale * bloomStageScale * emergence);
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();

        ctx.strokeStyle = withAlphaColor(
            mixHexColor('#BFD5A9', '#A38B62', lifeAppearance.pedicelDryness),
            Math.max(0.01, (0.12 + (lightingState.highlightAlpha * 0.08)) * emergence),
        );
        ctx.lineWidth = Math.max(0.01, 0.12 * scale * bloomStageScale * emergence);
        ctx.beginPath();
        ctx.moveTo(baseX + (normalX * 0.12), baseY + (normalY * 0.12));
        ctx.quadraticCurveTo(
            controlX + (normalX * 0.12),
            controlY + (normalY * 0.12),
            endX + (normalX * 0.12),
            endY + (normalY * 0.12),
        );
        ctx.stroke();

        ctx.fillStyle = withAlphaColor(
            mixHexColor('#7FA06B', '#9A7A4F', lifeAppearance.pedicelDryness),
            (0.22 + (lightingState.highlightAlpha * 0.06)) * emergence,
        );
        ctx.beginPath();
        ctx.ellipse(
            endX - (dirX * 0.16),
            endY - (dirY * 0.16),
            Math.max(0.02, 0.34 * scale * emergence),
            Math.max(0.012, 0.2 * scale * emergence),
            Math.atan2(dirY, dirX),
            0,
            Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
    };

    const drawBarkTexture = (node, depth, getBezierXY, getBezierAngle, widthScale = 1) => {
        if (showBranchTierDebug) {
            return;
        }
        const marks = resolveSakuraBarkTexturePlan(node, depth);
        if (!marks.length) {
            return;
        }
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        marks.forEach((mark) => {
            const center = getBezierXY(mark.t);
            const angle = getBezierAngle(mark.t);
            const normalAngle = angle + (Math.PI / 2);
            const offsetX = Math.cos(normalAngle) * mark.offset * widthScale;
            const offsetY = Math.sin(normalAngle) * mark.offset * widthScale;
            const bandAngle = normalAngle + (toNumber(mark.tilt, 0) * 0.6);
            const halfSpan = clamp(
                toNumber(mark.span, 0) * widthScale * 0.5,
                Math.max(0.28, (Number(node?.width) || 0) * widthScale * 0.12),
                Math.max(0.44, (Number(node?.width) || 0) * widthScale * 0.46),
            );
            const bandX = Math.cos(bandAngle);
            const bandY = Math.sin(bandAngle);
            const startX = center.x + offsetX - (bandX * halfSpan);
            const startY = center.y + offsetY - (bandY * halfSpan);
            const endX = center.x + offsetX + (bandX * halfSpan);
            const endY = center.y + offsetY + (bandY * halfSpan);
            const offsetSign = Math.sign(mark.offset) || 1;
            const lightSide = Math.sign(
                (Math.cos(normalAngle) * offsetSign * lightingState.lightDirX)
                + (Math.sin(normalAngle) * offsetSign * lightingState.lightDirY),
            ) || 1;
            const dryEmphasis = lifeAppearance.barkTextureScale;
            const alpha = mark.tone === 'highlight'
                ? mark.alpha * dryEmphasis * (0.62 + (lightingState.highlightAlpha * 1.16))
                : mark.alpha * dryEmphasis * (0.72 + (lightingState.shadowAlpha * 1.92));
            ctx.strokeStyle = mark.tone === 'highlight' && lightSide > 0
                ? withAlphaColor(lifeBarkHighlight, alpha)
                : withAlphaColor(lifeBarkShadow, alpha);
            ctx.lineWidth = Math.max(0.1, mark.width * widthScale);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        });
        ctx.restore();
    };

    const drawBranchCollar = ({
        x,
        y,
        attachAngle,
        childAngleOffset,
        childNode,
    }) => {
        if (showBranchTierDebug || !childNode || childNode.type !== 'branch') {
            return;
        }
        const childWidth = Math.max(0, Number(childNode?.width) || 0) * lifeAppearance.branchWidthScale;
        if (childWidth < 2.6) {
            return;
        }
        const order = Number(childNode?.branchOrder);
        const structuralWeight = order === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
            ? 1
            : (order === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH ? 0.72 : 0.46);
        const angle = (Number(attachAngle) || 0) + (Number(childAngleOffset) || 0);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const collarLength = childWidth * lerp(0.52, 0.78, structuralWeight);
        const collarLift = Math.max(0.22, childWidth * 0.12 * structuralWeight);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = withAlphaColor(lifeBarkShadow, 0.055 + (lightingState.shadowAlpha * 0.28));
        ctx.lineWidth = Math.max(0.24, childWidth * 0.11 * structuralWeight);
        ctx.beginPath();
        ctx.moveTo(-collarLength * 0.48, collarLift * 0.42);
        ctx.quadraticCurveTo(0, -collarLift * 0.42, collarLength * 0.56, collarLift * 0.16);
        ctx.stroke();
        ctx.strokeStyle = withAlphaColor(lifeBarkHighlight, 0.028 + (lightingState.highlightAlpha * 0.05));
        ctx.lineWidth = Math.max(0.12, childWidth * 0.045 * structuralWeight);
        ctx.beginPath();
        ctx.moveTo(-collarLength * 0.2, -collarLift * 0.38);
        ctx.quadraticCurveTo(collarLength * 0.14, -collarLift * 0.74, collarLength * 0.4, -collarLift * 0.28);
        ctx.stroke();
        ctx.restore();
    };

    const isSameOrderContinuation = (parentNode = {}, child = {}) => {
        const attachT = Number.isFinite(Number(child?.t)) ? Number(child.t) : 1;
        return attachT >= 0.985
            && Number(child?.obj?.branchOrder) === Number(parentNode?.branchOrder);
    };

    const getNodeGrowthKey = (node = {}, depth = 1) => [
        node?.nodeId || 'node',
        depth,
        Number(node?.length) || 0,
        Number(node?.width) || 0,
        Number(node?.branchOrder) || 0,
    ].join('|');

    const surfaceFeedbackKind = Object.values(ZEN_BONSAI_SURFACE_FEEDBACK_KINDS).includes(growthPlan.surfaceFeedbackKind)
        ? growthPlan.surfaceFeedbackKind
        : ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE;
    const surfaceFeedbackStrength = surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE
        ? 0
        : clamp01(growthPlan.surfaceFeedbackStrength ?? 0);
    const surfaceFeedbackSeed = growthPlan.surfaceFeedbackSeed || 'none';
    const surfaceFeedbackActive = surfaceFeedbackStrength > 0
        && surfaceFeedbackKind !== ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.NONE;

    const drawDewGlint = ({ x, y, angle, seed, scale = 1 }) => {
        const phase = hashUnit(`${seed}|phase`);
        const span = lerp(1.2, 2.2, phase) * scale;
        const alpha = clamp(0.16 + (surfaceFeedbackStrength * 0.36), 0.12, 0.52);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + (hashUnit(`${seed}|tilt`) - 0.5) * 0.6);
        ctx.lineCap = 'round';
        ctx.strokeStyle = withAlphaColor('#F7FFF2', alpha);
        ctx.lineWidth = Math.max(0.16, 0.28 * scale);
        ctx.beginPath();
        ctx.moveTo(-span, 0);
        ctx.lineTo(span, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -span * 0.68);
        ctx.lineTo(0, span * 0.68);
        ctx.stroke();
        ctx.fillStyle = withAlphaColor('#BFE9CF', alpha * 0.42);
        ctx.beginPath();
        ctx.ellipse(0, 0, span * 0.34, span * 0.22, 0, 0, TWO_PI);
        ctx.fill();
        ctx.restore();
    };

    const drawFallingLeafCue = ({ x, y, angle, seed, scale = 1 }) => {
        const leafLength = lerp(3.4, 4.8, hashUnit(`${seed}|len`)) * scale;
        const leafWidth = lerp(0.74, 1.05, hashUnit(`${seed}|width`)) * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = withAlphaColor('#A98558', clamp(0.24 + (surfaceFeedbackStrength * 0.28), 0.18, 0.5));
        ctx.beginPath();
        ctx.moveTo(-leafLength, 0);
        ctx.bezierCurveTo(
            -leafLength * 0.36,
            -leafWidth,
            leafLength * 0.58,
            -leafWidth * 0.8,
            leafLength,
            0,
        );
        ctx.bezierCurveTo(
            leafLength * 0.58,
            leafWidth * 0.8,
            -leafLength * 0.36,
            leafWidth,
            -leafLength,
            0,
        );
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = withAlphaColor('#6E5A3B', 0.18 + (surfaceFeedbackStrength * 0.18));
        ctx.lineWidth = Math.max(0.14, 0.24 * scale);
        ctx.beginPath();
        ctx.moveTo(-leafLength * 0.66, 0);
        ctx.lineTo(leafLength * 0.64, 0);
        ctx.stroke();
        ctx.restore();
    };

    const drawSurfaceFeedbackAtTip = ({
        node = {},
        endX,
        endY,
        tangentAngle,
        depth = 1,
    } = {}) => {
        if (!surfaceFeedbackActive || !renderTerminals) {
            return;
        }
        if (depth < Math.max(1, growthPlan.visibleDepth - 1)) {
            return;
        }
        const tipSeed = `${getNodeGrowthKey(node, depth)}|surface|${surfaceFeedbackSeed}`;
        const selection = hashUnit(`${tipSeed}|select`);
        if (surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.DEW_GLINT) {
            if (selection > lerp(0.24, 0.56, surfaceFeedbackStrength)) {
                return;
            }
            const count = surfaceFeedbackStrength > 0.82 && hashUnit(`${tipSeed}|count`) > 0.46 ? 2 : 1;
            for (let index = 0; index < count; index += 1) {
                const side = index % 2 === 0 ? -1 : 1;
                const angle = tangentAngle + (side * lerp(0.16, 0.42, hashUnit(`${tipSeed}|a|${index}`)));
                const dist = lerp(1.8, 5.6, hashUnit(`${tipSeed}|d|${index}`));
                drawDewGlint({
                    x: endX + (Math.cos(angle) * dist),
                    y: endY + (Math.sin(angle) * dist),
                    angle,
                    seed: `${tipSeed}|dew|${index}`,
                    scale: lerp(0.72, 1.08, surfaceFeedbackStrength),
                });
            }
            return;
        }
        if (surfaceFeedbackKind === ZEN_BONSAI_SURFACE_FEEDBACK_KINDS.LEAF_FALL) {
            if (selection > lerp(0.12, 0.34, surfaceFeedbackStrength)) {
                return;
            }
            const side = hashUnit(`${tipSeed}|side`) > 0.5 ? 1 : -1;
            const drift = lerp(3.2, 9.5, hashUnit(`${tipSeed}|drift`)) * side;
            const drop = lerp(7.4, 16.5, hashUnit(`${tipSeed}|drop`));
            drawFallingLeafCue({
                x: endX + drift,
                y: endY + drop,
                angle: tangentAngle + (side * lerp(0.7, 1.4, hashUnit(`${tipSeed}|rot`))),
                seed: `${tipSeed}|leaf`,
                scale: lerp(0.72, 1, surfaceFeedbackStrength),
            });
        }
    };

    const drawGrowthTip = ({
        node = {},
        endX,
        endY,
        tangentAngle,
        depth = 1,
    } = {}) => {
        if (!growthPlanActive || growthPlan.growthTipScale <= 0 || !renderTerminals) {
            return;
        }
        const lineageFrontier = node?.classic2Development?.lineageFrontier === true;
        if (!lineageFrontier && depth < Math.max(1, growthPlan.visibleDepth - 1)) {
            return;
        }
        const tipSeed = `${getNodeGrowthKey(node, depth)}|growth_tip`;
        const eventStrength = clamp01(growthPlan.growthEventStrength ?? 0);
        const eventKind = typeof growthPlan.growthEventKind === 'string'
            ? growthPlan.growthEventKind
            : 'none';
        const eventSeed = `${tipSeed}|event|${growthPlan.growthEventSeed || 'none'}`;
        const eventActive = eventKind !== 'none'
            && eventStrength > 0
            && hashUnit(eventSeed) <= lerp(0.28, 0.72, eventStrength);
        const activationTipFloor = lifeAppearance.hasActivationPresentation
            ? lerp(0.28, 0.58, lifeAppearance.activationRatio)
                * lifeAppearance.activationExpressionStrength
            : 0;
        const presentedGrowthTipScale = Math.max(
            growthPlan.growthTipScale,
            activationTipFloor,
        );
        let frontierBloomPresentation = null;
        if (lineageFrontier && lifeAppearance.hasActivationPresentation) {
            const budScale = Math.max(
                0.24,
                presentedGrowthTipScale * lifeAppearance.tipBudScale,
            );
            const budAngle = tangentAngle + lerp(
                -0.08,
                0.08,
                hashUnit(`${tipSeed}|activation_bud_angle`),
            );
            const budDistance = lerp(0.7, 1.35, hashUnit(`${tipSeed}|activation_bud_dist`)) * budScale;
            ctx.save();
            ctx.translate(
                endX + (Math.cos(budAngle) * budDistance),
                endY + (Math.sin(budAngle) * budDistance),
            );
            ctx.rotate(budAngle);
            if (lifeAppearance.recoveryAccent > 0.04) {
                const glowRadius = (
                    2.4 + (lifeAppearance.recoveryAccent * 4.6)
                ) * Math.max(0.72, budScale);
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
                glow.addColorStop(
                    0,
                    withAlphaColor('#DDEBC4', 0.16 + (lifeAppearance.recoveryAccent * 0.18)),
                );
                glow.addColorStop(1, 'rgba(221,235,196,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.ellipse(0, 0, glowRadius, glowRadius * 0.72, 0, 0, TWO_PI);
                ctx.fill();
            }
            ctx.globalAlpha *= lifeAppearance.tipBudAlpha;
            ctx.fillStyle = mixHexColor(
                '#73815B',
                '#A7C67A',
                lifeAppearance.activationRatio,
            );
            ctx.beginPath();
            ctx.ellipse(
                0,
                0,
                1.35 * budScale,
                0.72 * budScale,
                0,
                0,
                TWO_PI,
            );
            ctx.fill();
            if (lifeAppearance.recoveryAccent > 0.08) {
                ctx.fillStyle = withAlphaColor(
                    '#F3F0D2',
                    0.18 + (lifeAppearance.recoveryAccent * 0.34),
                );
                ctx.beginPath();
                ctx.ellipse(
                    -0.28 * budScale,
                    -0.2 * budScale,
                    0.28 * budScale,
                    0.16 * budScale,
                    -0.3,
                    0,
                    TWO_PI,
                );
                ctx.fill();
            }
            ctx.restore();

            const frontierBloomStage = resolveSakuraFrontierBloomCue({
                lifeGrowth,
                activationPresentation,
                cohort: hashUnit(`${tipSeed}|activation_frontier_bloom`),
            });
            if (frontierBloomStage) {
                const flowerAngle = tangentAngle + lerp(
                    -0.2,
                    0.2,
                    hashUnit(`${tipSeed}|activation_frontier_bloom_angle`),
                );
                const flowerColors = Array.isArray(config.flowerColors) && config.flowerColors.length
                    ? config.flowerColors
                    : ['#F6C8D8'];
                const flower = {
                    type: 'flower',
                    color: flowerColors[
                        Math.floor(
                            hashUnit(`${tipSeed}|activation_frontier_bloom_color`)
                            * flowerColors.length
                        )
                    ] || flowerColors[0],
                    angle: flowerAngle - tangentAngle,
                    dist: lerp(
                        1,
                        2,
                        hashUnit(`${tipSeed}|activation_frontier_bloom_dist`),
                    ),
                    scale: Math.max(0.24, presentedGrowthTipScale * 0.68),
                    blossom: {
                        bloomStage: frontierBloomStage,
                        form: frontierBloomStage === 'full' ? 'open' : 'cupped',
                        openness: 0.62,
                        layers: 1,
                    },
                };
                const flowerSprite = resolveTerminalSprite(flower);
                if (flowerSprite) {
                    const flowerDist = resolveSakuraTerminalRenderDistance(flower, {
                        reach: 0.64,
                    });
                    frontierBloomPresentation = {
                        flower,
                        tipX: endX + (Math.cos(flowerAngle) * flowerDist),
                        tipY: endY + (Math.sin(flowerAngle) * flowerDist),
                        flowerAngle,
                        flowerSprite,
                        lifeVisual: {
                            scale: lifeAppearance.flowerScale,
                            alpha: lifeAppearance.flowerAlpha,
                            reach: 0.64,
                            minimumScale: 0.22,
                            presentationBloomStage: frontierBloomStage,
                        },
                    };
                }
            }
        }
        const baseLeafCount = growthPlan.phase === 'sprout' ? 2 : 1 + Math.round(hashUnit(`${tipSeed}|count`) * 1.2);
        const activationLeafBonus = lifeAppearance.hasActivationPresentation
            ? Math.floor(smoothstep01((lifeAppearance.activationRatio - 0.28) / 0.58) * 2.4)
            : 0;
        const leafCount = baseLeafCount
            + activationLeafBonus
            + (eventActive ? (eventKind === 'milestone_shoot' ? 2 : 1) : 0);
        for (let index = 0; index < leafCount; index += 1) {
            const side = index % 2 === 0 ? -1 : 1;
            const eventLeaf = eventActive && index >= baseLeafCount;
            const spread = lerp(
                eventLeaf ? 0.16 : 0.22,
                eventLeaf ? 0.36 : 0.48,
                hashUnit(`${tipSeed}|spread|${index}`),
            ) * side;
            const scale = presentedGrowthTipScale
                * lerp(eventLeaf ? 0.82 : 0.66, eventLeaf ? 1.08 : 0.92, hashUnit(`${tipSeed}|scale|${index}`))
                * (eventLeaf ? lerp(1.04, 1.18, eventStrength) : 1);
            const colorIndex = Math.floor(hashUnit(`${tipSeed}|color|${index}`) * config.leafColors.length);
            const child = {
                type: 'leaf',
                color: config.leafColors[colorIndex] || config.leafColors[0],
                leafTemplateId: index % 3,
                angle: spread,
                dist: lerp(eventLeaf ? 2.4 : 1.8, eventLeaf ? 4.6 : 3.8, hashUnit(`${tipSeed}|dist|${index}`)),
                scale,
            };
            const sprite = resolveTerminalSprite(child);
            if (!sprite) {
                continue;
            }
            const tipAngle = tangentAngle + spread;
            const tipX = endX + Math.cos(tipAngle) * child.dist;
            const tipY = endY + Math.sin(tipAngle) * child.dist;
            drawTerminal(child, tipX, tipY, tipAngle, sprite, {
                scale: clamp(
                    (0.72 + (lifeVitality * 0.28)) * lifeAppearance.tipBudScale,
                    0.5,
                    1.16,
                ),
                alpha: clamp(
                    (0.54 + (lifeVitality * 0.38) - (lifeMood.leafFade * 0.18))
                    * lifeAppearance.tipBudAlpha,
                    0.28,
                    1,
                ),
            });
        }
        if (frontierBloomPresentation) {
            drawTerminal(
                frontierBloomPresentation.flower,
                frontierBloomPresentation.tipX,
                frontierBloomPresentation.tipY,
                frontierBloomPresentation.flowerAngle,
                frontierBloomPresentation.flowerSprite,
                frontierBloomPresentation.lifeVisual,
            );
        }
    };

    const drawSegment = (plannedRecord, x, y, angle, _accumulatedAngle = angle, depth = 1) => {
        if (!plannedRecord || plannedRecord.node?.type !== 'branch') {
            throw new Error('ZEN_SAKURA_BRANCH_RENDER_PLAN_RECORD_REQUIRED');
        }
        const node = plannedRecord.node;
        const pose = resolveSakuraRenderPlanRecordPoseV1({
            record: plannedRecord,
            startX: x,
            startY: y,
            baseAngle: angle,
            frameCount: branchMotionFrameCount,
            windState: branchMotionWindState,
            lifeBranchSag,
            motionMode: SAKURA_RENDER_PLAN_MOTION_MODE.CURRENT,
        });
        const segment = pose.segment;
        const endX = segment.endX;
        const endY = segment.endY;
        const cp1X = segment.cp1X;
        const cp1Y = segment.cp1Y;
        const cp2X = segment.cp2X;
        const cp2Y = segment.cp2Y;

        const getBezierXY = (t) => BranchGeometryModel.pointAt(segment, t);
        const getBezierAngle = (t) => BranchGeometryModel.angleAt(segment, t);
        const visibleBranches = plannedRecord.children.map((link) => ({
            t: link.hasAttachT ? link.attachT : null,
            angleOffset: link.angleOffset,
            obj: link.child.node,
            plannedRecord: link.child,
        }));
        const visibleGrowthChildBranchCount = Math.max(
            visibleBranches.length,
            Math.floor(Number(node?.visibleGrowthChildBranchCount) || 0),
        );

        if (renderWood) {
            const renderWidth = Math.max(0.08, node.width * lifeAppearance.branchWidthScale);
            const useTwigSilhouette = shouldUseTwigSilhouette(node);
            const useTaperedBody = hasRenderableWidthProfile(node)
                && (
                    useTwigSilhouette
                    || visibleGrowthChildBranchCount <= 0
                );
            const barkVarianceSeed = Math.abs(Math.sin(
                (depth * 0.83)
                + (toNumber(node?.branchOrder, 0) * 1.11)
                + (toNumber(node?.width, 1) * 0.34)
                + (toNumber(node?.length, 1) * 0.08)
            ));
            const shade = lerp(0.95, 1.05, barkVarianceSeed);
            const tierDebugColor = resolveBranchTierDebugColor(node);
            const currentBarkColor = tierDebugColor || adjustColor(lifeBarkColor, shade);
            if (!useTwigSilhouetteProfile) {
                visibleBranches.forEach((child) => {
                    if (isSameOrderContinuation(node, child)) {
                        return;
                    }
                    const attachT = Number.isFinite(Number(child?.t))
                        ? clamp(Number(child.t), 0, 1)
                        : 1;
                    const pos = BranchGeometryModel.pointAt(segment, attachT);
                    drawBranchCollar({
                        x: pos.x,
                        y: pos.y,
                        attachAngle: BranchGeometryModel.angleAt(segment, attachT),
                        childAngleOffset: child.angleOffset,
                        childNode: child.obj,
                    });
                });
            }
            if (useTwigSilhouette) {
                drawTaperedBranchShape({
                    node,
                    segment,
                    renderWidth: Math.max(0.18, renderWidth * 0.72),
                    fillStyle: withAlphaColor(
                        currentBarkColor,
                        showBranchTierDebug ? 0.52 : clamp(0.5 + (lifeVitality * 0.2) - (lifeMood.wither * 0.16), 0.34, 0.76),
                    ),
                });
                if (!showBranchTierDebug && renderWidth > 0.42) {
                    ctx.save();
                    ctx.strokeStyle = withAlphaColor(
                        lifeBarkHighlight,
                        Math.max(0.035, lightingState.highlightAlpha * 0.16 * (1 - (lifeMood.wither * 0.3))),
                    );
                    ctx.lineWidth = Math.max(0.08, renderWidth * 0.08);
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
                    ctx.stroke();
                    ctx.restore();
                }
            } else {
                const midPoint = getBezierXY(0.52);
                const midTangentAngle = getBezierAngle(0.52);
                const normalAngle = midTangentAngle + (Math.PI / 2);
                const normalX = Math.cos(normalAngle);
                const normalY = Math.sin(normalAngle);
                const lightDot = (normalX * lightingState.lightDirX) + (normalY * lightingState.lightDirY);
                const lightSideSign = lightDot >= 0 ? 1 : -1;
                const lightOffset = renderWidth * 0.13 * lightSideSign;
                const barkGradientHalfWidth = Math.max(1.2, renderWidth * 0.74);
                const barkGradient = ctx.createLinearGradient(
                    midPoint.x - (normalX * barkGradientHalfWidth * lightSideSign),
                    midPoint.y - (normalY * barkGradientHalfWidth * lightSideSign),
                    midPoint.x + (normalX * barkGradientHalfWidth * lightSideSign),
                    midPoint.y + (normalY * barkGradientHalfWidth * lightSideSign),
                );
                barkGradient.addColorStop(0, tierDebugColor || adjustColor(lifeBarkShadow, shade * 1.01));
                barkGradient.addColorStop(0.52, currentBarkColor);
                barkGradient.addColorStop(0.9, tierDebugColor || adjustColor(lifeBarkHighlight, Math.min(1.08, shade * 1.02)));
                barkGradient.addColorStop(1, tierDebugColor || adjustColor(lifeBarkHighlight, Math.min(1.04, shade * 1.01)));

                const shadowOffsetX = lightingState.shadowDirX * Math.max(0.35, renderWidth * 0.11);
                const shadowOffsetY = lightingState.shadowDirY * Math.max(0.5, renderWidth * 0.15);
                if (useTaperedBody) {
                    drawTaperedBranchShape({
                        node,
                        segment,
                        renderWidth: Math.max(0.8, renderWidth * 1.12),
                        offsetX: shadowOffsetX,
                        offsetY: shadowOffsetY,
                        fillStyle: hexToRgba(
                            lifeBarkShadow,
                            showBranchTierDebug ? 0.1 : Math.max(0.1, lightingState.shadowAlpha * 0.78),
                        ),
                    });
                } else {
                    ctx.save();
                    ctx.strokeStyle = hexToRgba(
                        lifeBarkShadow,
                        showBranchTierDebug ? 0.1 : Math.max(0.1, lightingState.shadowAlpha * 0.78),
                    );
                    ctx.lineWidth = Math.max(0.8, renderWidth * 1.12);
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(x + shadowOffsetX, y + shadowOffsetY);
                    ctx.bezierCurveTo(
                        cp1X + shadowOffsetX,
                        cp1Y + shadowOffsetY,
                        cp2X + shadowOffsetX,
                        cp2Y + shadowOffsetY,
                        endX + shadowOffsetX,
                        endY + shadowOffsetY,
                    );
                    ctx.stroke();
                    ctx.restore();
                }

                if (useTaperedBody) {
                    drawTaperedBranchShape({
                        node,
                        segment,
                        renderWidth: Math.max(0.4, renderWidth),
                        fillStyle: barkGradient,
                    });
                } else {
                    ctx.strokeStyle = barkGradient;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
                    ctx.lineWidth = Math.max(0.4, renderWidth);
                    ctx.lineJoin = 'round';
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }

                drawBarkTexture(node, depth, getBezierXY, getBezierAngle, lifeAppearance.branchWidthScale);

                // Increase the minimum width threshold for drawing bark detail (lenticels)
                // so that they don't clutter the finer canopy twigs.
                const showBarkDetail = !showBranchTierDebug
                    && depth <= 3
                    && renderWidth > 4.4
                    && (
                        node?.branchOrder === SAKURA_BRANCH_ORDER.TRUNK
                        || node?.branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
                    );
                if (showBarkDetail) {
                    if (node.lenticels && node.lenticels.length > 0) {
                        ctx.save();
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        node.lenticels.forEach((l, index) => {
                            const pos = getBezierXY(l.t);
                            const tangentAngle = getBezierAngle(l.t);
                            const normalAngle = tangentAngle + Math.PI / 2;
                            const lateralAngle = normalAngle + (toNumber(l.tilt, 0) * 0.48);
                            const patchSpan = clamp(
                                toNumber(l.span, renderWidth * 0.28),
                                Math.max(0.32, renderWidth * 0.16),
                                Math.max(0.48, renderWidth * 0.42),
                            );
                            const halfSpan = patchSpan * 0.5;
                            const offset = toNumber(l.offset, 0);
                            const centerX = pos.x + Math.cos(normalAngle) * offset;
                            const centerY = pos.y + Math.sin(normalAngle) * offset;
                            const startX = centerX - Math.cos(lateralAngle) * halfSpan;
                            const startY = centerY - Math.sin(lateralAngle) * halfSpan;
                            const finalX = centerX + Math.cos(lateralAngle) * halfSpan;
                            const finalY = centerY + Math.sin(lateralAngle) * halfSpan;
                            const highlightLift = Math.max(0.08, renderWidth * 0.015);

                            const baseAlpha = clamp(toNumber(l.alpha, 0.08), 0.045, 0.12);
                            ctx.globalAlpha = baseAlpha;
                            ctx.strokeStyle = adjustColor(lifeBarkShadow, 0.94);
                            ctx.lineWidth = Math.max(0.18, toNumber(l.w, renderWidth * 0.04));
                            ctx.beginPath();
                            ctx.moveTo(startX, startY);
                            ctx.lineTo(finalX, finalY);
                            ctx.stroke();

                            if (index % 2 === 0) {
                                ctx.globalAlpha = baseAlpha * 0.46;
                                ctx.strokeStyle = adjustColor(lifeBarkHighlight, 1.02);
                                ctx.lineWidth = Math.max(0.12, toNumber(l.w, renderWidth * 0.04) * 0.48);
                                ctx.beginPath();
                                ctx.moveTo(
                                    startX + (Math.cos(tangentAngle) * highlightLift),
                                    startY + (Math.sin(tangentAngle) * highlightLift),
                                );
                                ctx.lineTo(
                                    finalX + (Math.cos(tangentAngle) * highlightLift),
                                    finalY + (Math.sin(tangentAngle) * highlightLift),
                                );
                                ctx.stroke();
                            }
                        });
                        ctx.restore();
                    }
                }

                if (!showBranchTierDebug && renderWidth > 1.4) {
                    ctx.save();
                    ctx.globalAlpha = 1;
                    const isTrunkWood = Number(node?.branchOrder) === SAKURA_BRANCH_ORDER.TRUNK;
                    ctx.strokeStyle = withAlphaColor(
                        lifeBarkHighlight,
                        Math.max(
                            0.022,
                            lightingState.highlightAlpha
                            * (isTrunkWood ? 0.12 : 0.2)
                            * (0.4 + (Math.abs(lightDot) * 0.18))
                            * (1 - (lifeMood.wither * 0.36)),
                        ),
                    );
                    ctx.lineWidth = Math.max(0.22, renderWidth * (isTrunkWood ? 0.18 : 0.12));
                    ctx.beginPath();
                    ctx.moveTo(x + (normalX * lightOffset), y + (normalY * lightOffset));
                    ctx.bezierCurveTo(
                        cp1X + (normalX * lightOffset),
                        cp1Y + (normalY * lightOffset),
                        cp2X + (normalX * lightOffset),
                        cp2Y + (normalY * lightOffset),
                        endX + (normalX * lightOffset),
                        endY + (normalY * lightOffset),
                    );
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        if (visibleBranches.length) {
            for (let i = 0; i < visibleBranches.length; i += 1) {
                const child = visibleBranches[i];

                let startX = endX;
                let startY = endY;
                let baseAngle = angle;
                if (Number.isFinite(child?.t)) {
                    const attachT = clamp(Number(child.t), 0, 1);
                    const pos = BranchGeometryModel.pointAt(segment, attachT);
                    startX = pos.x;
                    startY = pos.y;
                    baseAngle = BranchGeometryModel.angleAt(segment, attachT);
                }

                drawSegment(
                    child.plannedRecord,
                    startX,
                    startY,
                    baseAngle + child.angleOffset,
                    angle + child.angleOffset,
                    depth + 1,
                );
            }
        }

        let visibleTerminalCount = 0;
        if (renderTerminals && plannedRecord.terminals.length > 0) {
            for (let i = 0; i < plannedRecord.terminals.length; i += 1) {
                const terminalRecord = plannedRecord.terminals[i];
                const child = terminalRecord.terminal;
                const lifeVisual = renderPlanPresentation === 'bake'
                    ? terminalRecord.bakeLifeVisual
                    : terminalRecord.lifeVisual;
                if (!lifeVisual) {
                    continue;
                }
                const presentationBloomStage = child?.type === 'flower'
                    ? lifeVisual.presentationBloomStage
                    : null;
                const presentationChild = presentationBloomStage
                    && presentationBloomStage !== child?.blossom?.bloomStage
                    ? {
                        ...child,
                        blossom: {
                            ...(child?.blossom || {}),
                            bloomStage: presentationBloomStage,
                            form: presentationBloomStage === 'bud'
                                ? 'cupped'
                                : (child?.blossom?.form || 'open'),
                            openness: clamp(
                                Number(child?.blossom?.openness ?? 0.72)
                                * (presentationBloomStage === 'bud'
                                    ? 0.46
                                    : (presentationBloomStage === 'half_open' ? 0.78 : 1)),
                                0,
                                1,
                            ),
                        },
                    }
                    : child;
                const sprite = resolveTerminalSprite(presentationChild);
                if (!sprite) {
                    continue;
                }
                visibleTerminalCount += 1;
                const attachT = terminalRecord.attachT;
                const terminalBase = attachT >= 0.995
                    ? { x: endX, y: endY, angle: getBezierAngle(0.99) }
                    : BranchGeometryModel.pointAndAngleAt(segment, attachT);
                const dist = renderPlanPresentation === 'bake'
                    ? terminalRecord.bakeDistance
                    : terminalRecord.distance;
                const tipAngle = terminalBase.angle + presentationChild.angle;
                const tipX = terminalBase.x + Math.cos(tipAngle) * dist;
                const tipY = terminalBase.y + Math.sin(tipAngle) * dist;
                if (child?.type === 'flower' && !useTwigSilhouetteProfile) {
                    drawFlowerPedicel({
                        baseX: terminalBase.x,
                        baseY: terminalBase.y,
                        tipX,
                        tipY,
                        tangentAngle: terminalBase.angle,
                        child: presentationChild,
                        presentationBloomStage,
                    });
                }
                drawTerminal(presentationChild, tipX, tipY, tipAngle, sprite, lifeVisual);
            }
        }

        if (
            !visibleBranches.length
            && visibleTerminalCount <= 0
            && Number(node?.visibleGrowthChildBranchCount || 0) <= 0
        ) {
            drawGrowthTip({
                node,
                endX,
                endY,
                tangentAngle: getBezierAngle(0.99),
                depth,
            });
        }

        if (!visibleBranches.length) {
            drawSurfaceFeedbackAtTip({
                node,
                endX,
                endY,
                tangentAngle: getBezierAngle(0.99),
                depth,
            });
        }
    };

    drawSegment.renderPlanRoot = plannedRoot;
    return drawSegment;
};
