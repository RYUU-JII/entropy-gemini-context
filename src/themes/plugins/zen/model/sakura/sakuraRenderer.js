import {
    beginZenPotShapePath,
    DEFAULT_ZEN_BONSAI_POT_STYLE,
    drawGlazedPot,
    drawGlazedPotFrontOverlay,
    resolveZenPotRenderModel,
} from '../ZenPotRenderer';
import {
    resolveZenHomeGardenBedDeviceMesh,
    ZEN_HOME_GARDEN_BED_COLORS,
} from '../bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    drawZenHomeGardenBedBackLayer,
    drawZenHomeGardenBedContactShadow,
    drawZenHomeGardenBedFrontLayer,
} from '../bonsai/rendering/zenHomeGardenBedRenderer.js';
import { BranchGeometryModel } from '../bonsai/geometry/branchGeometryModel';
import { SAKURA_BRANCH_ORDER } from '../bonsai/generation/shapePriorModel';
import {
    createSakuraBranchLayerRenderer,
    SAKURA_TREE_CONTENT_LAYERS,
} from './sakuraRenderBranchLayer';
import { drawSakuraBackboneDebugOverlay } from './sakuraRenderBackboneDebug';
import { createSakuraBarkGrainPattern } from './sakuraBarkGrain';
import {
    resolveSakuraLifeAppearanceProfile,
    resolveSakuraLifeMood,
} from './sakuraLifeMood';
import { resolveSakuraRenderLighting, withAlphaColor } from './sakuraRenderLighting';
import { requireSakuraRenderPlanV1 } from './sakuraRenderPlan.js';
import { resolveZenAmbientPalette } from '../../runtime/environment/zenWorldMaterialPalette.js';
import { resolveZenBonsaiWindState } from '../zenBonsaiSceneEnvironment.js';
import { drawZenBonsaiRainCanvas } from '../../runtime/rain/zenRainCanvas.js';
import { resolveZenBonsaiRainPresentation } from '../../runtime/rain/zenRainStreakRuntime.js';
import { hashStringFNV1a } from '../../shared/zenSeededRandom.js';
import {
    normalizeZenBonsaiGrowthProjection,
    ZEN_BONSAI_MOSS_STATES,
} from '../ZenBonsaiGrowthProjection.js';

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
const clampRange = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
const smoothstep01 = (value) => {
    const t = clamp01(value);
    return t * t * (3 - (2 * t));
};
const smoothstepRange = (value, min, max) => {
    const span = Number(max) - Number(min);
    if (!Number.isFinite(span) || span <= 0) {
        return value >= max ? 1 : 0;
    }
    return smoothstep01((value - min) / span);
};
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const EPS = 1e-6;

const hashUnit = (value = '') => {
    const source = String(value);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000003) / 1000003;
};

const shadeHexColor = (hex, factor = 1) => {
    const raw = typeof hex === 'string' ? hex.trim().replace('#', '') : '';
    if (raw.length !== 6) {
        return hex;
    }
    const channel = (offset) => Math.min(
        255,
        Math.max(0, Math.round(Number.parseInt(raw.slice(offset, offset + 2), 16) * factor)),
    );
    return `rgb(${channel(0)},${channel(2)},${channel(4)})`;
};

const mixHexColor = (from, to, amount = 0) => {
    const parse = (value) => {
        const raw = typeof value === 'string' ? value.trim().replace('#', '') : '';
        if (!/^[\da-f]{6}$/iu.test(raw)) return null;
        return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16));
    };
    const start = parse(from);
    const end = parse(to);
    if (!start || !end) return from;
    const t = clamp01(amount);
    const channel = (index) => Math.round(start[index] + ((end[index] - start[index]) * t))
        .toString(16)
        .padStart(2, '0');
    return `#${channel(0)}${channel(1)}${channel(2)}`;
};

export const SAKURA_RENDER_LAYERS = Object.freeze({
    FULL: 'full',
    BACK: 'back',
    TREE: 'tree',
    FRONT: 'front',
});
const SAKURA_RENDER_LAYER_VALUES = new Set(Object.values(SAKURA_RENDER_LAYERS));

const resolveSakuraRenderLayer = (value) => {
    const layer = typeof value === 'string' && value.trim()
        ? value.trim()
        : SAKURA_RENDER_LAYERS.FULL;
    if (!SAKURA_RENDER_LAYER_VALUES.has(layer)) {
        throw new Error(`ZEN_SAKURA_RENDER_LAYER_INVALID:${layer}`);
    }
    return layer;
};

const resolveSakuraWindState = (wind, environmentState, frameCount = 0) => (
    wind && typeof wind === 'object'
        ? wind
        : resolveZenBonsaiWindState({
            environmentState,
            frameCount,
        })
);

const resolvePotPalette = (topology, currentStage) => {
    void topology;
    void currentStage;
    return DEFAULT_ZEN_BONSAI_POT_STYLE;
};

const resolvePotShadowScreenMetrics = ({
    centerX,
    bottomY,
    potModel,
    cameraScale = 1,
    scaledPotWidth = 80,
    scaledPotHeight = 32,
} = {}) => {
    const scale = Math.max(0.01, Number(cameraScale) || 1);
    const shadowShape = potModel?.shapes?.shadowShape;
    if (shadowShape?.kind === 'ellipse') {
        return {
            anchorX: centerX + (shadowShape.cx * scale),
            anchorY: bottomY + (shadowShape.cy * scale),
            radiusX: Math.max(10, shadowShape.rx * scale),
            radiusY: Math.max(4, shadowShape.ry * scale),
        };
    }

    const shadowBounds = potModel?.shadowBounds;
    if (shadowBounds && typeof shadowBounds === 'object') {
        return {
            anchorX: centerX + (((shadowBounds.minX + shadowBounds.maxX) * 0.5) * scale),
            anchorY: bottomY + (((shadowBounds.minY + shadowBounds.maxY) * 0.5) * scale),
            radiusX: Math.max(10, (shadowBounds.width * 0.5) * scale),
            radiusY: Math.max(4, (shadowBounds.height * 0.5) * scale),
        };
    }

    return {
        anchorX: centerX,
        anchorY: bottomY + Math.max(8, scaledPotHeight * 0.14),
        radiusX: Math.max(18, scaledPotWidth * 0.42),
        radiusY: Math.max(6, scaledPotHeight * 0.12),
    };
};

const resolvePotShadowWorldMetrics = (potModel = null) => {
    const shadowShape = potModel?.shapes?.shadowShape;
    if (shadowShape?.kind === 'ellipse') {
        return {
            anchorX: Number(shadowShape.cx) || 0,
            anchorY: Number(shadowShape.cy) || 0,
            radiusX: Math.max(1, Number(shadowShape.rx) || 0),
            radiusY: Math.max(1, Number(shadowShape.ry) || 0),
        };
    }

    const shadowBounds = potModel?.shadowBounds;
    if (shadowBounds && typeof shadowBounds === 'object') {
        return {
            anchorX: ((Number(shadowBounds.minX) || 0) + (Number(shadowBounds.maxX) || 0)) * 0.5,
            anchorY: ((Number(shadowBounds.minY) || 0) + (Number(shadowBounds.maxY) || 0)) * 0.5,
            radiusX: Math.max(1, (Number(shadowBounds.width) || 0) * 0.5),
            radiusY: Math.max(1, (Number(shadowBounds.height) || 0) * 0.5),
        };
    }

    return {
        anchorX: 0,
        anchorY: Math.max(3, (Number(potModel?.baseHeight) || 32) * 0.12),
        radiusX: Math.max(8, (Number(potModel?.baseWidth) || 80) * 0.42),
        radiusY: Math.max(2, (Number(potModel?.baseHeight) || 32) * 0.08),
    };
};

const projectWorldPointToGroundShadow = ({
    x = 0,
    y = 0,
    groundY = 0,
    lighting = null,
    potHeight = 32,
} = {}) => {
    const resolvedLighting = lighting || resolveSakuraRenderLighting(null);
    const heightAboveGround = Math.max(0, groundY - (Number(y) || 0));
    const reachFactor = resolvedLighting.shadowReach / Math.max(18, (Number(potHeight) || 32) * 1.9);
    const offsetMagnitude = heightAboveGround * reachFactor;
    const lateralStretch = 0.92 + ((resolvedLighting.shadowStretch - 1) * 0.8);
    const verticalCompression = 0.18 + ((resolvedLighting.shadowStretch - 1) * 0.12);

    return {
        x: (Number(x) || 0) + (resolvedLighting.shadowDirX * offsetMagnitude * lateralStretch),
        y: groundY + (resolvedLighting.shadowDirY * offsetMagnitude * verticalCompression),
        heightAboveGround,
    };
};

const drawSakuraLifeFloorDebris = (
    ctx,
    {
        floorCenterX,
        floorCenterY,
        floorRadiusX,
        floorRadiusY,
        lifeMood,
        seed = 'sakura',
    },
) => {
    const debris = clamp01(lifeMood?.floorDebris ?? 0);
    const petalLoss = clamp01(lifeMood?.petalLoss ?? 0);
    const recoveryGlow = clamp01(lifeMood?.recoveryGlow ?? 0);
    const count = Math.round((debris * 18) + (petalLoss * 8) + (recoveryGlow * 3));
    if (count <= 0) {
        return;
    }

    ctx.save();
    for (let index = 0; index < Math.min(28, count); index += 1) {
        const u = (hashUnit(`${seed}|debris_x|${index}`) - 0.5) * 2;
        const v = (hashUnit(`${seed}|debris_y|${index}`) - 0.5) * 2;
        const edgeFade = Math.max(0, 1 - ((u * u) + (v * v * 1.8)) * 0.42);
        if (edgeFade <= 0.08) {
            continue;
        }
        const isDryLeaf = hashUnit(`${seed}|debris_kind|${index}`) < (0.48 + (debris * 0.42));
        const x = floorCenterX + (u * floorRadiusX * 0.72);
        const y = floorCenterY + (v * floorRadiusY * 0.74);
        const scale = 0.7 + (hashUnit(`${seed}|debris_scale|${index}`) * 0.78);
        const angle = hashUnit(`${seed}|debris_angle|${index}`) * Math.PI * 2;
        const alpha = edgeFade * (
            isDryLeaf
                ? (0.045 + (debris * 0.085))
                : (0.035 + (petalLoss * 0.07) + (recoveryGlow * 0.018))
        );
        const leafLength = (isDryLeaf ? 3.4 : 2.7) * scale;
        const leafWidth = (isDryLeaf ? 0.58 : 0.72) * scale;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = isDryLeaf
            ? withAlphaColor('#A6875B', alpha)
            : withAlphaColor('#E7AEB8', alpha);
        ctx.beginPath();
        ctx.moveTo(-leafLength, 0);
        ctx.bezierCurveTo(
            -leafLength * 0.38,
            -leafWidth,
            leafLength * 0.54,
            -leafWidth * 0.82,
            leafLength,
            0,
        );
        ctx.bezierCurveTo(
            leafLength * 0.54,
            leafWidth * 0.82,
            -leafLength * 0.38,
            leafWidth,
            -leafLength,
            0,
        );
        ctx.closePath();
        ctx.fill();
        if (isDryLeaf) {
            ctx.strokeStyle = withAlphaColor('#7B6445', alpha * 0.62);
            ctx.lineWidth = Math.max(0.18, 0.28 * scale);
            ctx.beginPath();
            ctx.moveTo(-leafLength * 0.62, 0);
            ctx.lineTo(leafLength * 0.62, 0);
            ctx.stroke();
        }
        ctx.restore();
    }
    ctx.restore();
};

const OPEN_AIR_STAGE_PROFILES = Object.freeze({
    clear_air: Object.freeze({
        id: 'clear_air',
        skyTop: '#FFFDF6',
        skyMid: '#F6F4EC',
        skyBloomMid: '#FFF1F4',
        skyLow: '#EFE2D0',
        horizonColor: '#DEC9B2',
        horizonGlow: '#FFF2D8',
        airLineColor: '#FFFFFF',
        floorColor: '#DECEB7',
        floorCore: '#FFFFF8',
        vignetteColor: '#A58662',
        hazeAlpha: 0.1,
        mistAlpha: 0.15,
        airAlpha: 0.018,
        floorAlpha: 0.18,
        floorCoreAlpha: 0.16,
        vignetteAlpha: 0.045,
    }),
    soft_mist: Object.freeze({
        id: 'soft_mist',
        skyTop: '#F7F7F1',
        skyMid: '#F0EEE6',
        skyBloomMid: '#F8ECEF',
        skyLow: '#E7DCD0',
        horizonColor: '#D3CEC3',
        horizonGlow: '#FAF6EC',
        airLineColor: '#FFFFFF',
        floorColor: '#D8CAB9',
        floorCore: '#FEFBF1',
        vignetteColor: '#92806C',
        hazeAlpha: 0.18,
        mistAlpha: 0.28,
        airAlpha: 0.014,
        floorAlpha: 0.18,
        floorCoreAlpha: 0.14,
        vignetteAlpha: 0.048,
    }),
    golden_air: Object.freeze({
        id: 'golden_air',
        skyTop: '#FAF2E2',
        skyMid: '#F4E2BE',
        skyBloomMid: '#F6DCC4',
        skyLow: '#E5CBA5',
        horizonColor: '#D6B27A',
        horizonGlow: '#FFE9BD',
        airLineColor: '#FFF5D6',
        floorColor: '#D4B88D',
        floorCore: '#FFF2CE',
        vignetteColor: '#816341',
        hazeAlpha: 0.16,
        mistAlpha: 0.22,
        airAlpha: 0.024,
        floorAlpha: 0.24,
        floorCoreAlpha: 0.2,
        vignetteAlpha: 0.075,
    }),
    moon_air: Object.freeze({
        id: 'moon_air',
        skyTop: '#202634',
        skyMid: '#343B4D',
        skyBloomMid: '#3A4052',
        skyLow: '#626B80',
        horizonColor: '#747F99',
        horizonGlow: '#A3AEC8',
        airLineColor: '#E1E7FF',
        floorColor: '#5D6071',
        floorCore: '#8A93A8',
        vignetteColor: '#1C2230',
        hazeAlpha: 0.12,
        mistAlpha: 0.16,
        airAlpha: 0.016,
        floorAlpha: 0.14,
        floorCoreAlpha: 0.1,
        vignetteAlpha: 0.16,
    }),
});

const OPEN_AIR_COLOR_FIELDS = Object.freeze([
    'skyTop',
    'skyMid',
    'skyBloomMid',
    'skyLow',
    'horizonColor',
    'horizonGlow',
    'airLineColor',
    'floorColor',
    'floorCore',
    'vignetteColor',
]);

const OPEN_AIR_ALPHA_FIELDS = Object.freeze([
    'hazeAlpha',
    'mistAlpha',
    'airAlpha',
    'floorAlpha',
    'floorCoreAlpha',
    'vignetteAlpha',
]);

const blendOpenAirStageProfiles = (dayStage, nightStage, nightBlend) => {
    const blend = clamp01(nightBlend);
    const next = {
        id: blend >= 0.995 ? nightStage.id : `${dayStage.id}_to_${nightStage.id}`,
    };
    OPEN_AIR_COLOR_FIELDS.forEach((field) => {
        next[field] = mixHexColor(dayStage[field], nightStage[field], blend);
    });
    OPEN_AIR_ALPHA_FIELDS.forEach((field) => {
        next[field] = lerp(dayStage[field], nightStage[field], blend);
    });
    return next;
};

export const resolveOpenAirStageProfile = ({
    lighting,
    environmentState = null,
    lifeMood = null,
}) => {
    const cloudCover = clamp01(environmentState?.cloudCover ?? 0.35);
    const ambientPalette = resolveZenAmbientPalette(
        environmentState?.ambientChromaticState || {
            hour: environmentState?.time,
            sunriseHour: environmentState?.sunriseHour,
            sunsetHour: environmentState?.sunsetHour,
            daylight: lighting.daylight,
            nightDepth: lighting.night,
            solarElevation: lighting.solarElevation,
        },
    );
    const lowSun = ambientPalette.lowSun;
    const dimAir = clamp01(((1 - lighting.lightIntensity) * 0.55) + (cloudCover * 0.42) + (clamp01(lifeMood?.ambientDim ?? 0) * 0.18));
    let dayProfile = OPEN_AIR_STAGE_PROFILES.clear_air;
    if (lowSun > 0.42) {
        dayProfile = OPEN_AIR_STAGE_PROFILES.golden_air;
    } else if (dimAir > 0.48) {
        dayProfile = OPEN_AIR_STAGE_PROFILES.soft_mist;
    }
    const moonBlend = smoothstepRange(Math.max(lighting.night, 1 - lighting.daylight), 0.18, 0.82);
    const profile = blendOpenAirStageProfiles(
        dayProfile,
        OPEN_AIR_STAGE_PROFILES.moon_air,
        moonBlend,
    );

    return Object.freeze({
        ...profile,
        skyTop: ambientPalette.bonsai.skyTop,
        skyMid: ambientPalette.bonsai.skyMid,
        skyBloomMid: mixHexColor(ambientPalette.bonsai.skyMid, profile.skyBloomMid, 0.26),
        skyLow: ambientPalette.bonsai.skyLow,
        floorColor: ambientPalette.bonsai.floor,
        cloudCover,
        lowSun,
        moonBlend,
        airDepth: clamp01((profile.hazeAlpha * 2.2) + (cloudCover * 0.16) + (lowSun * 0.08)),
    });
};

const drawOpenAirSky = ({
    ctx,
    canvasWidth,
    canvasHeight,
    stage,
    moodBloomWeight,
}) => {
    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    skyGradient.addColorStop(0, stage.skyTop);
    skyGradient.addColorStop(0.4, moodBloomWeight > 0.55 ? stage.skyBloomMid : stage.skyMid);
    skyGradient.addColorStop(1, stage.skyLow);
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
};

const drawOpenAirAtmosphericDepth = ({
    ctx,
    canvasWidth,
    canvasHeight,
    bottomY,
    sunX,
    stage,
    lighting,
}) => {
    const horizonY = clampRange(bottomY - (canvasHeight * 0.22), canvasHeight * 0.46, canvasHeight * 0.78);
    const bandHeight = Math.max(72, canvasHeight * 0.28);
    const hazeAlpha = clampRange(
        stage.hazeAlpha + (stage.cloudCover * 0.08) + (stage.lowSun * 0.05),
        0.05,
        0.32,
    );

    const distantHaze = ctx.createLinearGradient(0, horizonY - bandHeight, 0, horizonY + bandHeight);
    distantHaze.addColorStop(0, 'rgba(255,255,255,0)');
    distantHaze.addColorStop(0.48, withAlphaColor(stage.horizonColor, hazeAlpha));
    distantHaze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = distantHaze;
    ctx.fillRect(0, Math.max(0, horizonY - bandHeight), canvasWidth, bandHeight * 2);

    const horizonGlow = ctx.createRadialGradient(
        sunX,
        horizonY - (bandHeight * 0.2),
        canvasWidth * 0.04,
        sunX,
        horizonY,
        canvasWidth * (lighting.night > 0.5 ? 0.52 : 0.68),
    );
    horizonGlow.addColorStop(0, withAlphaColor(stage.horizonGlow, clampRange(hazeAlpha * 0.58, 0.04, 0.18)));
    horizonGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
};

const drawOpenAirDrift = ({
    ctx,
    canvasWidth,
    canvasHeight,
    stage,
    environmentState = null,
    seed = 'open_air',
}) => {
    const windIntensity = clampRange(environmentState?.windIntensity ?? 0.28, 0, 1);
    const alpha = clampRange(stage.airAlpha * (0.72 + (windIntensity * 0.74)), 0, 0.036);
    if (alpha <= 0.004) {
        return;
    }

    const direction = Number.isFinite(Number(environmentState?.windDirection))
        ? Number(environmentState.windDirection)
        : Math.PI * 0.58;
    const dirX = Math.cos(direction);
    const dirY = Math.sin(direction) * 0.22;
    const count = 5 + Math.round(windIntensity * 4);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let index = 0; index < count; index += 1) {
        const lane = hashUnit(`${seed}|air_lane|${index}`);
        const x = canvasWidth * (0.12 + (hashUnit(`${seed}|air_x|${index}`) * 0.78));
        const y = canvasHeight * (0.18 + (lane * 0.52));
        const span = canvasWidth * (0.12 + (hashUnit(`${seed}|air_span|${index}`) * 0.14));
        const lift = (hashUnit(`${seed}|air_lift|${index}`) - 0.5) * canvasHeight * 0.025;
        const lineAlpha = alpha * (0.32 + (hashUnit(`${seed}|air_alpha|${index}`) * 0.68));

        ctx.strokeStyle = withAlphaColor(stage.airLineColor, lineAlpha);
        ctx.lineWidth = 0.45 + (hashUnit(`${seed}|air_width|${index}`) * 0.45);
        ctx.beginPath();
        ctx.moveTo(x - (dirX * span * 0.36), y - (dirY * span * 0.22));
        ctx.bezierCurveTo(
            x - (dirX * span * 0.08),
            y + lift - (dirY * span * 0.1),
            x + (dirX * span * 0.28),
            y - lift + (dirY * span * 0.16),
            x + (dirX * span * 0.62),
            y + (dirY * span * 0.26),
        );
        ctx.stroke();
    }
    ctx.restore();
};

const drawSakuraBackdrop = (
    ctx,
    topology,
    centerX,
    bottomY,
    currentStage,
    trunkOffsetX = 0,
    potModel = null,
    cameraScale = 1,
    environmentState = null,
    lifeState = null,
    sceneViewport = null,
) => {
    const viewportX = Math.max(0, Number(sceneViewport?.x) || 0);
    const viewportY = Math.max(0, Number(sceneViewport?.y) || 0);
    const canvasWidth = Math.max(
        1,
        Number(sceneViewport?.width) || Number(ctx?.canvas?.width || (centerX * 2)),
    );
    const canvasHeight = Math.max(
        1,
        Number(sceneViewport?.height) || Number(ctx?.canvas?.height || bottomY),
    );
    const backdropCenterX = centerX;
    const backdropBottomY = bottomY;
    const potVisualBounds = potModel?.visualBounds && typeof potModel.visualBounds === 'object'
        ? potModel.visualBounds
        : { width: 80, height: 32 };
    const scaledPotWidth = Math.max(48, potVisualBounds.width * Math.max(0.01, Number(cameraScale) || 1));
    const scaledPotHeight = Math.max(18, potVisualBounds.height * Math.max(0.01, Number(cameraScale) || 1));
    const potShadowMetrics = resolvePotShadowScreenMetrics({
        centerX: backdropCenterX,
        bottomY: backdropBottomY,
        potModel,
        cameraScale,
        scaledPotWidth,
        scaledPotHeight,
    });
    const bloomPeak = clamp01(topology?.geneProfile?.bloomPeak ?? 0.5);
    const lifeBloom = clamp01(lifeState?.bloom ?? 1);
    const lifeDryness = clamp01(lifeState?.dryness ?? 0);
    const lifeMood = resolveSakuraLifeMood(lifeState);
    const bloomWeight = clamp01(
        ((currentStage?.flowerChance ?? 0.8) * 0.44)
        + ((topology?.geneProfile?.seasonalBloomBias ?? 0.5) * 0.24)
        + (bloomPeak * 0.32),
    );
    const moodBloomWeight = clamp01((bloomWeight * (0.42 + (lifeBloom * 0.58))) - (lifeDryness * 0.08));
    const speciesCharacter = clamp01(topology?.geneProfile?.speciesCharacter ?? 0.5);
    const lighting = resolveSakuraRenderLighting(environmentState);
    const openAirStage = resolveOpenAirStageProfile({
        lighting,
        environmentState,
        lifeMood,
    });
    const sunX = (canvasWidth * lighting.sunPositionX)
        + (trunkOffsetX * 0.28)
        + ((speciesCharacter - 0.5) * canvasWidth * 0.05);
    const sunY = canvasHeight * lighting.sunPositionY;

    ctx.save();
    ctx.translate(viewportX, viewportY);
    ctx.beginPath();
    ctx.rect(0, 0, canvasWidth, canvasHeight);
    ctx.clip();

    drawOpenAirSky({
        ctx,
        canvasWidth,
        canvasHeight,
        stage: openAirStage,
        moodBloomWeight,
    });

    const directionalWash = ctx.createLinearGradient(
        sunX - (canvasWidth * 0.12),
        sunY,
        canvasWidth - (sunX * 0.18),
        canvasHeight,
    );
    directionalWash.addColorStop(
        0,
        withAlphaColor(
            lighting.lightColor,
            lighting.ambientWashAlpha + (moodBloomWeight * 0.04),
        ),
    );
    directionalWash.addColorStop(0.45, 'rgba(255,255,255,0)');
    directionalWash.addColorStop(
        1,
        lighting.night > 0.44
            ? 'rgba(72,79,106,0.09)'
            : 'rgba(150,122,92,0.05)',
    );
    ctx.fillStyle = directionalWash;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const bloomHalo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, canvasWidth * 0.42);
    bloomHalo.addColorStop(
        0,
        moodBloomWeight > 0.5
            ? withAlphaColor(
                lighting.lightColor,
                Math.min(0.84, lighting.glowAlpha + 0.16),
            )
            : withAlphaColor(lighting.lightColor, Math.max(0.36, lighting.glowAlpha)),
    );
    bloomHalo.addColorStop(
        0.52,
        withAlphaColor(
            lighting.night > 0.3 ? '#9AA8C9' : lighting.lightColor,
            lighting.night > 0.3 ? 0.08 : 0.14,
        ),
    );
    bloomHalo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bloomHalo;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawOpenAirAtmosphericDepth({
        ctx,
        canvasWidth,
        canvasHeight,
        bottomY: backdropBottomY,
        sunX,
        stage: openAirStage,
        lighting,
    });
    drawOpenAirDrift({
        ctx,
        canvasWidth,
        canvasHeight,
        stage: openAirStage,
        environmentState,
        seed: `${openAirStage.id}|${Math.round(lighting.sunAngle * 100)}|${Math.round((environmentState?.windDirection ?? 0) * 100)}`,
    });

    const mistGradient = ctx.createLinearGradient(
        0,
        backdropBottomY - 140,
        0,
        backdropBottomY + 20,
    );
    mistGradient.addColorStop(0, 'rgba(255,255,255,0)');
    mistGradient.addColorStop(0.46, withAlphaColor(openAirStage.horizonGlow, openAirStage.mistAlpha));
    mistGradient.addColorStop(1, withAlphaColor(openAirStage.skyLow, clampRange(openAirStage.mistAlpha + 0.34, 0.3, 0.66)));
    ctx.fillStyle = mistGradient;
    ctx.fillRect(0, Math.max(0, backdropBottomY - 140), canvasWidth, 180);

    // Anchor the floor treatment to the actual pot shadow footprint so the
    // backdrop and world-space pot remain visually locked together.
    const floorCenterX = potShadowMetrics.anchorX;
    const floorCenterY = potShadowMetrics.anchorY + Math.max(2, potShadowMetrics.radiusY * 0.34);
    const floorRadiusX = Math.max(canvasWidth * 0.16, potShadowMetrics.radiusX * 2.24);
    const floorRadiusY = Math.max(14, potShadowMetrics.radiusY * 5.1);

    const floorWash = ctx.createLinearGradient(0, floorCenterY - (floorRadiusY * 3.4), 0, canvasHeight);
    floorWash.addColorStop(0, 'rgba(255,255,255,0)');
    floorWash.addColorStop(
        0.58,
        withAlphaColor(openAirStage.floorColor, lighting.night > 0.48 ? 0.04 : 0.055),
    );
    floorWash.addColorStop(
        1,
        withAlphaColor(openAirStage.floorColor, openAirStage.floorAlpha),
    );
    ctx.fillStyle = floorWash;
    ctx.fillRect(0, Math.max(0, floorCenterY - (floorRadiusY * 3.4)), canvasWidth, canvasHeight);

    const floorPlane = ctx.createRadialGradient(
        floorCenterX,
        floorCenterY - (floorRadiusY * 0.24),
        floorRadiusX * 0.14,
        floorCenterX,
        floorCenterY,
        floorRadiusX * 1.08,
    );
    floorPlane.addColorStop(0, withAlphaColor(openAirStage.floorCore, openAirStage.floorCoreAlpha));
    floorPlane.addColorStop(
        0.46,
        withAlphaColor(openAirStage.floorColor, lighting.night > 0.48 ? 0.1 : 0.15),
    );
    floorPlane.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = floorPlane;
    ctx.beginPath();
    ctx.ellipse(floorCenterX, floorCenterY, floorRadiusX, floorRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    drawSakuraLifeFloorDebris(ctx, {
        floorCenterX,
        floorCenterY,
        floorRadiusX,
        floorRadiusY,
        lifeMood,
        seed: `${Math.round(trunkOffsetX * 100)}|${Math.round(scaledPotWidth)}|${Math.round(lifeMood.floorDebris * 100)}`,
    });

    const castShadowOffsetX = (trunkOffsetX * 0.28)
        + (lighting.shadowDirX * Math.max(potShadowMetrics.radiusX * 0.48, scaledPotWidth * 0.1));
    const castShadowOffsetY = Math.max(1.5, potShadowMetrics.radiusY * 0.22)
        + (lighting.shadowDirY * Math.max(potShadowMetrics.radiusY * 2.2, scaledPotHeight * 0.08));
    const castShadowCenterX = potShadowMetrics.anchorX + castShadowOffsetX;
    const castShadowCenterY = potShadowMetrics.anchorY + castShadowOffsetY;
    const castShadowRadiusX = Math.max(
        potShadowMetrics.radiusX * (1.22 + ((lighting.shadowStretch - 1) * 0.72)),
        scaledPotWidth * 0.24,
    );
    const castShadowRadiusY = Math.max(
        potShadowMetrics.radiusY * (1.32 + ((lighting.shadowStretch - 1) * 0.36)),
        scaledPotHeight * 0.09,
    );
    const castShadow = ctx.createRadialGradient(
        castShadowCenterX - (lighting.shadowDirX * castShadowRadiusX * 0.24),
        castShadowCenterY - (lighting.shadowDirY * castShadowRadiusY * 0.16),
        Math.max(1, castShadowRadiusY * 0.28),
        castShadowCenterX,
        castShadowCenterY,
        castShadowRadiusX,
    );
    castShadow.addColorStop(
        0,
        lighting.night > 0.48
            ? 'rgba(16,18,26,0.14)'
            : 'rgba(96,78,58,0.15)',
    );
    castShadow.addColorStop(
        0.62,
        lighting.night > 0.48
            ? 'rgba(20,22,32,0.07)'
            : 'rgba(104,84,62,0.08)',
    );
    castShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = castShadow;
    ctx.beginPath();
    ctx.ellipse(
        castShadowCenterX,
        castShadowCenterY,
        castShadowRadiusX,
        castShadowRadiusY,
        lighting.shadowDirX * 0.08,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    if (lifeMood.ambientDim > 0.015) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = withAlphaColor('#8A7760', Math.min(0.18, lifeMood.ambientDim * 0.22));
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();

        ctx.save();
        const dryHaze = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        dryHaze.addColorStop(0, withAlphaColor('#6E655D', lifeMood.ambientDim * 0.08));
        dryHaze.addColorStop(0.58, withAlphaColor('#9A8468', lifeMood.ambientDim * 0.06));
        dryHaze.addColorStop(1, withAlphaColor('#7A6040', lifeMood.ambientDim * 0.08));
        ctx.fillStyle = dryHaze;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
    }

    if (lifeMood.recoveryGlow > 0.36 && lifeMood.wither < 0.42) {
        const recoveryHalo = ctx.createRadialGradient(
            floorCenterX,
            floorCenterY - (floorRadiusY * 2.2),
            floorRadiusY * 0.8,
            floorCenterX,
            floorCenterY - (floorRadiusY * 2.2),
            Math.max(floorRadiusX * 1.5, canvasWidth * 0.34),
        );
        recoveryHalo.addColorStop(0, withAlphaColor('#FFF3D2', Math.min(0.18, lifeMood.recoveryGlow * 0.12)));
        recoveryHalo.addColorStop(0.44, withAlphaColor('#FFE7EE', Math.min(0.08, lifeMood.recoveryGlow * 0.05)));
        recoveryHalo.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = recoveryHalo;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const vignette = ctx.createRadialGradient(
        backdropCenterX,
        canvasHeight * 0.42,
        canvasWidth * 0.18,
        backdropCenterX,
        canvasHeight * 0.42,
        canvasWidth * 0.72,
    );
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, withAlphaColor(openAirStage.vignetteColor, openAirStage.vignetteAlpha + (lifeMood.ambientDim * 0.12)));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
};

const drawGroundShadowPolyline = (
    ctx,
    points,
    strokeStyle,
    lineWidth,
) => {
    if (!ctx || !Array.isArray(points) || points.length < 2) {
        return;
    }

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(points[index].x, points[index].y);
    }
    ctx.stroke();
};

const drawSakuraGroundShadow = (
    ctx,
    topology,
    trunkOffsetX,
    trunkBaseY,
    potModel,
    config,
    environmentState = null,
    lifeState = null,
) => {
    if (!ctx || !topology || topology.type !== 'branch') {
        return;
    }

    const lighting = resolveSakuraRenderLighting(environmentState);
    const lifeMood = resolveSakuraLifeMood(lifeState);
    const potHeight = Math.max(8, Number(potModel?.baseHeight || 32));
    const potWidth = Math.max(12, Number(potModel?.baseWidth || 80));
    const potVisualWidth = Math.max(potWidth, Number(potModel?.visualBounds?.width || potWidth));
    const shadowMetrics = resolvePotShadowWorldMetrics(potModel);
    const groundY = shadowMetrics.anchorY;
    const clipTopY = groundY - Math.max(2, potHeight * 0.18);
    const clipHeight = Math.max(potHeight * 3.8, 72);
    const clipWidth = Math.max(potVisualWidth * 4.6, 280);
    const shadowCeilingY = trunkBaseY - (potHeight * 1.65);
    const ceilingBand = Math.max(8, potHeight * 0.4);
    const barkShadowColor = typeof config?.barkShadow === 'string' && config.barkShadow.trim()
        ? config.barkShadow
        : '#2D1D1A';

    ctx.save();
    ctx.beginPath();
    ctx.rect(-clipWidth * 0.5, clipTopY, clipWidth, clipHeight);
    ctx.clip();

    const traverseShadow = (node, currentX, currentY, currentAngle) => {
        if (!node || node.type !== 'branch') {
            return;
        }

        const branchOrder = Number.isFinite(Number(node?.branchOrder))
            ? Number(node.branchOrder)
            : SAKURA_BRANCH_ORDER.TRUNK;
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
        const branchWidth = Math.max(0.8, Number(node?.width) || 0);
        const drawEligible = (
            branchWidth > 1.8
            && (
                branchOrder === SAKURA_BRANCH_ORDER.TRUNK
                || branchOrder === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
            )
        );

        if (drawEligible) {
            const centerPoint = BranchGeometryModel.pointAt(segment, 0.5);
            const centerBlend = (centerPoint.y - (shadowCeilingY - ceilingBand)) / ceilingBand;
            const ceilingFade = Math.min(1, Math.max(0, centerBlend));
            if (ceilingFade > 0) {
                const sampleCount = Math.min(16, Math.max(7, Math.round((Number(node?.length) || 0) / 4)));
                const projectedPoints = [];
                for (let step = 0; step <= sampleCount; step += 1) {
                    const point = BranchGeometryModel.pointAt(segment, step / sampleCount);
                    if (point.y < (shadowCeilingY - (ceilingBand * 0.2))) {
                        continue;
                    }
                    projectedPoints.push(projectWorldPointToGroundShadow({
                        x: point.x,
                        y: point.y,
                        groundY,
                        lighting,
                        potHeight,
                    }));
                }

                if (projectedPoints.length >= 2) {
                    const orderWeight = branchOrder === SAKURA_BRANCH_ORDER.TRUNK ? 1 : 0.72;
                    const softAlpha = Math.max(0.03, lighting.shadowAlpha * 0.5 * orderWeight * ceilingFade * lifeMood.shadowWeight);
                    const coreAlpha = Math.max(0.04, lighting.shadowAlpha * 0.82 * orderWeight * ceilingFade * lifeMood.shadowWeight);
                    drawGroundShadowPolyline(
                        ctx,
                        projectedPoints,
                        withAlphaColor(barkShadowColor, softAlpha),
                        Math.max(1.2, branchWidth * (1.5 + ((lighting.shadowStretch - 1) * 0.44)) * orderWeight),
                    );
                    drawGroundShadowPolyline(
                        ctx,
                        projectedPoints,
                        withAlphaColor(barkShadowColor, coreAlpha),
                        Math.max(0.9, branchWidth * (0.88 + ((lighting.shadowStretch - 1) * 0.18)) * orderWeight),
                    );
                }
            }
        }

        const branchChildren = Array.isArray(node?.branches) ? node.branches : [];
        branchChildren.forEach((child) => {
            if (!child?.obj || child.obj.type !== 'branch') {
                return;
            }

            let childStartX = segment.endX;
            let childStartY = segment.endY;
            let childBaseAngle = currentAngle;
            if (Number.isFinite(child?.t)) {
                const attach = BranchGeometryModel.pointAndAngleAt(
                    segment,
                    Math.min(1, Math.max(0, Number(child.t))),
                );
                childStartX = attach.x;
                childStartY = attach.y;
                childBaseAngle = attach.angle;
            }

            traverseShadow(
                child.obj,
                childStartX,
                childStartY,
                childBaseAngle + (Number(child?.angleOffset) || 0),
            );
        });
    };

    traverseShadow(
        topology,
        trunkOffsetX,
        trunkBaseY,
        Number.isFinite(Number(topology?.initialAngle))
            ? Number(topology.initialAngle)
            : (-Math.PI / 2),
    );

    ctx.restore();
};

const cubicBezierPoint = (p0, p1, p2, p3, t) => {
    const inv = 1 - t;
    const inv2 = inv * inv;
    const t2 = t * t;
    return {
        x: (p0.x * inv2 * inv) + (p1.x * 3 * inv2 * t) + (p2.x * 3 * inv * t2) + (p3.x * t2 * t),
        y: (p0.y * inv2 * inv) + (p1.y * 3 * inv2 * t) + (p2.y * 3 * inv * t2) + (p3.y * t2 * t),
    };
};

const cubicBezierTangent = (p0, p1, p2, p3, t) => {
    const inv = 1 - t;
    return {
        x: (3 * inv * inv * (p1.x - p0.x)) + (6 * inv * t * (p2.x - p1.x)) + (3 * t * t * (p3.x - p2.x)),
        y: (3 * inv * inv * (p1.y - p0.y)) + (6 * inv * t * (p2.y - p1.y)) + (3 * t * t * (p3.y - p2.y)),
    };
};

const resolveNebariIdentityNumber = (value, fallback = 0) => (
    Math.round((Number.isFinite(Number(value)) ? Number(value) : fallback) * 1000)
);

const resolveNebariGeometrySeed = (topology, potModel) => {
    const rootNodeId = typeof topology?.nodeId === 'string' && topology.nodeId.trim()
        ? topology.nodeId.trim()
        : 'root';
    const morphology = topology?.visualPhenotype?.morphologyProfile || {};
    return [
        'nebari_geometry_v1',
        rootNodeId,
        resolveNebariIdentityNumber(topology?.initialAngle),
        resolveNebariIdentityNumber(topology?.visualPhenotype?.trunkOffsetX),
        resolveNebariIdentityNumber(topology?.geneProfile?.speciesCharacter, 0.5),
        resolveNebariIdentityNumber(topology?.geneProfile?.silhouetteTarget, 0.5),
        resolveNebariIdentityNumber(topology?.geneProfile?.seasonalBloomBias, 0.5),
        resolveNebariIdentityNumber(morphology.trunkMass, 0.5),
        resolveNebariIdentityNumber(morphology.taperStrength, 0.5),
        resolveNebariIdentityNumber(morphology.branchFineness, 0.5),
        resolveNebariIdentityNumber(morphology.branchStraightness, 0.5),
        resolveNebariIdentityNumber(morphology.twigStartShortness, 0.5),
        resolveNebariIdentityNumber(morphology.twigPersistence, 0.5),
        potModel?.styleKey || potModel?.family || 'pot',
    ].join('|');
};

const resolveNebariSurfaceSeed = (geometrySeed, growthProjection = null) => {
    const plan = normalizeZenBonsaiGrowthProjection(growthProjection);
    return [
        `${geometrySeed}|nebari_surface_v1`,
        plan.mossState,
        Math.round(clamp01(plan.mossSaturation ?? 1) * 12),
    ].join('|');
};

export const resolveNebariSeedPlan = ({
    topology = null,
    potModel = null,
    growthProjection = null,
} = {}) => {
    const geometrySeed = resolveNebariGeometrySeed(topology, potModel);
    return Object.freeze({
        geometrySeed,
        surfaceSeed: resolveNebariSurfaceSeed(geometrySeed, growthProjection),
    });
};

const drawNebariSoilJoin = ({
    ctx,
    trunkOffsetX,
    trunkBaseY,
    trunkWidth,
    rimY,
    soilRy,
    config,
    lifeMood,
    developmentProfile = null,
}) => {
    const profile = developmentProfile && typeof developmentProfile === 'object'
        ? developmentProfile
        : { rootAlpha: 1, soilJoinAlpha: 1 };
    const contactY = Math.min(
        trunkBaseY + (soilRy * 0.08),
        rimY + (soilRy * 0.32),
    );
    const contactHalf = Math.max(0.8, trunkWidth * 0.62);
    ctx.save();
    ctx.globalAlpha *= clampRange(profile.rootAlpha, 0.18, 1);
    ctx.fillStyle = withAlphaColor(
        config.barkShadow,
        (0.055 + (lifeMood.shadowWeight * 0.025))
            * clampRange(profile.soilJoinAlpha, 0.3, 1),
    );
    ctx.beginPath();
    ctx.ellipse(
        trunkOffsetX,
        contactY,
        contactHalf,
        Math.max(0.34, soilRy * 0.2),
        0,
        0,
        Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
};

const createNebariRootSpecs = ({
    seed,
    topology,
    trunkOffsetX,
    trunkBaseY,
    rimY,
    soilRx,
    soilRy,
    potHeight,
    rootBaseWidth,
    rootBias,
    rootLengthScale = 1,
    developmentProfile = null,
}) => {
    void potHeight;
    const speciesCharacter = clamp01(topology?.geneProfile?.speciesCharacter ?? 0.5);
    const widthFloors = resolveNebariRootWidthFloors(developmentProfile);
    const slots = [-0.82, -0.34, 0.31, 0.79];
    return slots
        .map((slot, index) => {
            const jitter = (hashUnit(`${seed}|slot_jitter|${index}`) - 0.5) * 0.09;
            const drift = (hashUnit(`${seed}|slot_drift|${index}`) - 0.5) * soilRx * 0.08;
            const naturalSlot = Math.max(-1.08, Math.min(1.08, slot + jitter + (rootBias * 0.22)));
            const slotAbs = Math.abs(naturalSlot);
            const anchorWeight = slotAbs > 0.58 ? 1.14 : 1;
            const centralWeight = 1 - (slotAbs * 0.32);
            const rootLength = Math.min(
                soilRx * 0.48,
                rootBaseWidth
                    * lerp(1.08, 2.72, clampRange(rootLengthScale, 0.28, 1.08))
                    * (0.82 + (slotAbs * 0.22) + (hashUnit(`${seed}|length|${index}`) * 0.14)),
            );
            const startX = trunkOffsetX + (naturalSlot * rootBaseWidth * (0.12 + (hashUnit(`${seed}|start_x|${index}`) * 0.06)));
            const startY = trunkBaseY + (rootBaseWidth * 0.02) + ((hashUnit(`${seed}|start_y|${index}`) - 0.5) * soilRy * 0.16);
            const endX = trunkOffsetX + (naturalSlot * rootLength) + (rootBias * soilRx * 0.18) + drift;
            const endY = rimY + (soilRy * (0.12 + (slotAbs * 0.22) + (hashUnit(`${seed}|end_y|${index}`) * 0.1)));
            const bend = (hashUnit(`${seed}|bend|${index}`) - 0.5) * soilRx * 0.16;
            const sag = soilRy * (0.12 + (slotAbs * 0.14));
            const startWidth = Math.max(
                widthFloors.startMinWidth,
                rootBaseWidth * (0.2 + (centralWeight * 0.1) + (hashUnit(`${seed}|start_w|${index}`) * 0.05)) * anchorWeight,
            );
            const endWidth = Math.max(
                widthFloors.endMinWidth,
                startWidth * (0.17 + (hashUnit(`${seed}|end_w|${index}`) * 0.08)),
            );
            return {
                seed: `${seed}|root|${index}`,
                start: { x: startX, y: startY },
                c1: {
                    x: startX + (naturalSlot * rootLength * 0.18) + (bend * 0.24),
                    y: rimY - (soilRy * (0.22 + (speciesCharacter * 0.05))),
                },
                c2: {
                    x: trunkOffsetX + (naturalSlot * rootLength * 0.58) + bend,
                    y: rimY + (sag * 0.32),
                },
                end: { x: endX, y: endY },
                startWidth,
                midWidth: startWidth * (0.62 + (hashUnit(`${seed}|mid_w|${index}`) * 0.16)),
                endWidth,
                slot: naturalSlot,
                index,
            };
        })
        .sort((a, b) => a.start.y - b.start.y);
};

const drawTaperedNebariRoot = ({
    ctx,
    spec,
    config,
    lighting,
    lifeMood,
    potPalette = null,
    depthShade = 1,
    grainPattern = null,
}) => {
    const sampleCount = 18;
    const left = [];
    const right = [];
    const center = [];
    for (let step = 0; step <= sampleCount; step += 1) {
        const t = step / sampleCount;
        const point = cubicBezierPoint(spec.start, spec.c1, spec.c2, spec.end, t);
        const tangent = cubicBezierTangent(spec.start, spec.c1, spec.c2, spec.end, t);
        const mag = Math.max(0.001, Math.hypot(tangent.x, tangent.y));
        const nx = -tangent.y / mag;
        const ny = tangent.x / mag;
        const taper = Math.pow(1 - t, 1.04);
        const belly = Math.sin(Math.PI * t);
        const width = Math.max(
            spec.endWidth,
            (spec.startWidth * taper) + (spec.endWidth * t) + (spec.midWidth * belly * 0.26),
        );
        const edgeRoughness = (hashUnit(`${spec.seed}|edge|${step}`) - 0.5) * width * 0.18;
        const leftWidth = (width * (0.52 + (hashUnit(`${spec.seed}|left|${step}`) * 0.1))) + edgeRoughness;
        const rightWidth = (width * (0.48 + (hashUnit(`${spec.seed}|right|${step}`) * 0.1))) - (edgeRoughness * 0.56);
        left.push({ x: point.x + (nx * leftWidth), y: point.y + (ny * leftWidth) });
        right.push({ x: point.x - (nx * rightWidth), y: point.y - (ny * rightWidth) });
        center.push({ ...point, nx, ny, width, t });
    }

    const traceRibbonPath = () => {
        ctx.beginPath();
        left.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        right.slice().reverse().forEach((point) => {
            ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
    };

    const nightDim = lighting.night > 0.48;

    ctx.save();
    // Contact shadow only along the outer half; near the trunk every root
    // overlaps and the stacked shadows used to pool into a black puddle.
    const shadowFromIndex = Math.round(sampleCount * 0.48);
    ctx.fillStyle = withAlphaColor(config.barkShadow, 0.06 + (lifeMood.shadowWeight * 0.035));
    ctx.beginPath();
    left.forEach((point, index) => {
        if (index < shadowFromIndex) {
            return;
        }
        const y = point.y + Math.max(0.45, spec.startWidth * 0.12);
        if (index === shadowFromIndex) {
            ctx.moveTo(point.x, y);
        } else {
            ctx.lineTo(point.x, y);
        }
    });
    right.slice().reverse().forEach((point, reverseIndex) => {
        if ((sampleCount - reverseIndex) < shadowFromIndex) {
            return;
        }
        ctx.lineTo(point.x, point.y + Math.max(0.45, spec.startWidth * 0.12));
    });
    ctx.closePath();
    ctx.fill();

    const rootGradient = ctx.createLinearGradient(
        spec.start.x - (spec.startWidth * 0.4),
        spec.start.y - spec.startWidth,
        spec.end.x,
        spec.end.y + spec.startWidth,
    );
    rootGradient.addColorStop(
        0,
        withAlphaColor(shadeHexColor(config.barkHighlight, depthShade), nightDim ? 0.38 : 0.52),
    );
    rootGradient.addColorStop(0.34, withAlphaColor(shadeHexColor(config.barkColor, depthShade), 0.84));
    rootGradient.addColorStop(
        0.78,
        withAlphaColor(shadeHexColor(config.barkShadow, depthShade * 1.06), 0.74 + (lifeMood.wither * 0.05)),
    );
    rootGradient.addColorStop(1, withAlphaColor(shadeHexColor(config.barkShadow, depthShade), 0.32));

    ctx.fillStyle = rootGradient;
    traceRibbonPath();
    ctx.fill();

    if (grainPattern) {
        ctx.save();
        traceRibbonPath();
        ctx.clip();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = grainPattern;
        const pad = spec.startWidth * 2;
        const minX = Math.min(spec.start.x, spec.end.x) - pad;
        const maxX = Math.max(spec.start.x, spec.end.x) + pad;
        const minY = Math.min(spec.start.y, spec.end.y) - pad;
        const maxY = Math.max(spec.start.y, spec.end.y) + pad;
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        ctx.restore();
    }

    // Lit top edge / shaded underside instead of a full perimeter outline.
    const meanLeftY = left.reduce((sum, point) => sum + point.y, 0) / left.length;
    const meanRightY = right.reduce((sum, point) => sum + point.y, 0) / right.length;
    const topEdge = meanLeftY <= meanRightY ? left : right;
    const underEdge = meanLeftY <= meanRightY ? right : left;
    const strokeEdge = (points, color, alpha, widthFactor, fromT = 0.06, toT = 0.94) => {
        ctx.strokeStyle = withAlphaColor(color, alpha);
        ctx.lineWidth = Math.max(0.3, spec.startWidth * widthFactor);
        ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false;
        points.forEach((point, index) => {
            const t = index / sampleCount;
            if (t < fromT || t > toT) {
                return;
            }
            if (!started) {
                ctx.moveTo(point.x, point.y);
                started = true;
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.stroke();
    };
    strokeEdge(topEdge, config.barkHighlight, nightDim ? 0.16 : 0.26, 0.05, 0.04, 0.8);
    strokeEdge(underEdge, config.barkShadow, 0.22, 0.06);

    // Two long grain ridges with smooth low-frequency drift.
    [-0.26, 0.2].forEach((offset, ridgeIndex) => {
        const controls = Array.from({ length: 4 }, (_, controlIndex) => (
            (hashUnit(`${spec.seed}|ridge_ctrl|${ridgeIndex}|${controlIndex}`) - 0.5) * 0.14
        ));
        const driftAt = (t) => {
            const scaled = clamp01(t) * 3;
            const lower = Math.min(2, Math.floor(scaled));
            const mix = smoothstep01(scaled - lower);
            return controls[lower] + ((controls[lower + 1] - controls[lower]) * mix);
        };
        ctx.strokeStyle = ridgeIndex === 0
            ? withAlphaColor(config.barkShadow, 0.16)
            : withAlphaColor(config.barkHighlight, nightDim ? 0.1 : 0.16);
        ctx.lineWidth = Math.max(0.26, spec.startWidth * (ridgeIndex === 0 ? 0.05 : 0.04));
        ctx.beginPath();
        center.forEach((point, index) => {
            const u = offset + driftAt(point.t);
            const ridgeX = point.x + (point.nx * point.width * u);
            const ridgeY = point.y + (point.ny * point.width * u);
            if (index === 0) {
                ctx.moveTo(ridgeX, ridgeY);
            } else {
                ctx.lineTo(ridgeX, ridgeY);
            }
        });
        ctx.stroke();
    });

    for (let mark = 0; mark < 4; mark += 1) {
        if (hashUnit(`${spec.seed}|fissure_gate|${mark}`) < 0.34) {
            continue;
        }
        const t = 0.16 + (mark * 0.18) + (hashUnit(`${spec.seed}|fissure_t|${mark}`) * 0.08);
        const index = Math.min(center.length - 2, Math.max(1, Math.round(t * sampleCount)));
        const point = center[index];
        const length = point.width * (0.3 + (hashUnit(`${spec.seed}|fissure_len|${mark}`) * 0.34));
        const tilt = (hashUnit(`${spec.seed}|fissure_tilt|${mark}`) - 0.5) * 0.65;
        ctx.strokeStyle = withAlphaColor(
            config.barkShadow,
            0.08 + (hashUnit(`${spec.seed}|fissure_a|${mark}`) * 0.1),
        );
        ctx.lineWidth = Math.max(0.22, point.width * 0.034);
        ctx.beginPath();
        ctx.moveTo(
            point.x - (point.nx * length * 0.5) + (point.ny * tilt),
            point.y - (point.ny * length * 0.5) - (point.nx * tilt),
        );
        ctx.quadraticCurveTo(
            point.x + (point.ny * tilt * 0.4),
            point.y - (point.nx * tilt * 0.4),
            point.x + (point.nx * length * 0.5) + (point.ny * tilt),
            point.y + (point.ny * length * 0.5) - (point.nx * tilt),
        );
        ctx.stroke();
    }

    // Root tip grips the soil: contact shadow plus a raised-soil fleck.
    const tip = center[center.length - 1];
    const prev = center[Math.max(0, center.length - 3)];
    const tipDx = tip.x - prev.x;
    const tipDy = tip.y - prev.y;
    const tipMag = Math.max(0.001, Math.hypot(tipDx, tipDy));
    ctx.fillStyle = withAlphaColor(config.barkShadow, 0.1);
    ctx.beginPath();
    ctx.ellipse(
        tip.x,
        tip.y + Math.max(0.4, spec.endWidth * 0.7),
        Math.max(1, spec.endWidth * 2.4),
        Math.max(0.5, spec.endWidth * 0.9),
        0,
        0,
        Math.PI * 2,
    );
    ctx.fill();
    if (potPalette?.soilLight) {
        ctx.fillStyle = withAlphaColor(potPalette.soilLight, 0.2);
        ctx.beginPath();
        ctx.ellipse(
            tip.x + ((tipDx / tipMag) * spec.endWidth * 1.6),
            tip.y + ((tipDy / tipMag) * spec.endWidth * 0.7),
            Math.max(0.7, spec.endWidth * 1.3),
            Math.max(0.35, spec.endWidth * 0.55),
            0,
            0,
            Math.PI * 2,
        );
        ctx.fill();
    }
    ctx.restore();

    return center;
};

const drawNebariSoilTexture = ({
    ctx,
    seed,
    trunkOffsetX,
    rimY,
    soilRx,
    soilRy,
    rootBaseWidth,
    potPalette,
    growthProjection,
}) => {
    const mossPlan = resolveNebariMossVisualPlan(growthProjection);
    const mossSignal = resolveNebariMossPresence(growthProjection) * mossPlan.signalScale;
    const soilColors = [
        potPalette?.soilLight || '#6E5440',
        potPalette?.soilMid || '#4B392B',
        potPalette?.soilDark || '#2F241B',
    ];
    const granuleCount = 34 + Math.round(mossSignal * 12);

    ctx.save();
    for (let index = 0; index < granuleCount; index += 1) {
        const u = (hashUnit(`${seed}|soil_u|${index}`) - 0.5) * 2;
        const v = (hashUnit(`${seed}|soil_v|${index}`) - 0.5) * 2;
        const radius = (u * u) + ((v * v) * 1.8);
        if (radius > 1.12) {
            continue;
        }
        const nearRoot = Math.exp(-Math.abs(u) * 1.85) * (0.65 + (hashUnit(`${seed}|soil_near|${index}`) * 0.35));
        const x = trunkOffsetX + (u * soilRx * 0.86);
        const y = rimY + (soilRy * (0.02 + (v * 0.56))) + (nearRoot * soilRy * 0.24);
        if (Math.abs(x - trunkOffsetX) < rootBaseWidth * 1.05 && y < rimY + (soilRy * 0.45)) {
            continue;
        }
        const scale = 0.46 + (hashUnit(`${seed}|soil_scale|${index}`) * 0.9);
        const isMoss = mossSignal > 0.28 && hashUnit(`${seed}|soil_moss|${index}`) < mossSignal * 0.68;
        const alpha = isMoss ? 0.16 + (mossSignal * 0.16) : 0.08 + ((1 - radius) * 0.08);
        ctx.fillStyle = isMoss
            ? withAlphaColor(
                hashUnit(`${seed}|soil_moss_tone|${index}`) > 0.42
                    ? mossPlan.soilToneA
                    : mossPlan.soilToneB,
                alpha * mossPlan.alphaScale,
            )
            : withAlphaColor(soilColors[index % soilColors.length], alpha);
        ctx.beginPath();
        ctx.ellipse(
            x,
            y,
            Math.max(0.32, scale * rootBaseWidth * 0.038),
            Math.max(0.18, scale * rootBaseWidth * 0.022),
            hashUnit(`${seed}|soil_angle|${index}`) * Math.PI,
            0,
            Math.PI * 2,
        );
        ctx.fill();
    }
    ctx.restore();
};

const resolveNebariMossVisualPlan = (growthProjection = null) => {
    const plan = normalizeZenBonsaiGrowthProjection(growthProjection);
    const saturation = clamp01(plan.mossSaturation ?? 1);
    if (plan.mossState === ZEN_BONSAI_MOSS_STATES.DRY) {
        return {
            state: plan.mossState,
            saturation,
            signalScale: 0.42 + (saturation * 0.28),
            presenceBias: -0.16,
            alphaScale: 0.54,
            soilToneA: '#8A7B58',
            soilToneB: '#6F664C',
            patchToneA: '#827A5E',
            patchToneB: '#70694F',
            patchToneC: '#5F5A45',
        };
    }
    if (plan.mossState === ZEN_BONSAI_MOSS_STATES.PALE) {
        return {
            state: plan.mossState,
            saturation,
            signalScale: 0.68 + (saturation * 0.32),
            presenceBias: -0.07,
            alphaScale: 0.76,
            soilToneA: '#78815D',
            soilToneB: '#66724F',
            patchToneA: '#8A926A',
            patchToneB: '#737F5B',
            patchToneC: '#5F704B',
        };
    }
    if (plan.mossState === ZEN_BONSAI_MOSS_STATES.SATURATED) {
        return {
            state: plan.mossState,
            saturation,
            signalScale: 1.08 + (saturation * 0.18),
            presenceBias: 0.08,
            alphaScale: 1.16,
            soilToneA: '#6F8653',
            soilToneB: '#536D42',
            patchToneA: '#7F925E',
            patchToneB: '#667C4E',
            patchToneC: '#4F6840',
        };
    }
    return {
        state: ZEN_BONSAI_MOSS_STATES.NORMAL,
        saturation,
        signalScale: 0.92 + (saturation * 0.16),
        presenceBias: 0,
        alphaScale: 1,
        soilToneA: '#66794B',
        soilToneB: '#53683F',
        patchToneA: '#748457',
        patchToneB: '#607447',
        patchToneC: '#4D603B',
    };
};

const resolveNebariMossPresence = (growthProjection = null) => {
    const mossPlan = resolveNebariMossVisualPlan(growthProjection);
    const basePresence = {
        [ZEN_BONSAI_MOSS_STATES.DRY]: 0.2,
        [ZEN_BONSAI_MOSS_STATES.PALE]: 0.42,
        [ZEN_BONSAI_MOSS_STATES.NORMAL]: 0.68,
        [ZEN_BONSAI_MOSS_STATES.SATURATED]: 0.88,
    }[mossPlan.state] ?? 0.68;
    return clamp01(
        (basePresence * (0.74 + (mossPlan.saturation * 0.32)))
        + mossPlan.presenceBias,
    );
};

export const resolveNebariDevelopmentProfile = (growthProjection = null, topology = null) => {
    const plan = normalizeZenBonsaiGrowthProjection(growthProjection);
    const rootDevelopment = topology?.classic2Development;
    const lineagedRoot = rootDevelopment?.lineage === true;
    if (lineagedRoot && (
        !Number.isFinite(Number(rootDevelopment.age))
        || !Number.isFinite(Number(rootDevelopment.girthAge))
    )) {
        throw new Error('ZEN_SAKURA_CLASSIC2_NEBARI_ROOT_DEVELOPMENT_REQUIRED');
    }
    if (plan.active !== true) {
        return Object.freeze({
            rootBaseScale: 1,
            rootReachScale: 1,
            rootWidthFloorScale: 1,
            rootTipWidthFloorScale: 1,
            rootAlpha: 1,
            soilJoinAlpha: 1,
            clockSource: 'static',
        });
    }
    const progress = lineagedRoot
        ? clamp01(rootDevelopment.age)
        : clamp01(plan.progress ?? 1);
    const girthProgress = lineagedRoot
        ? clamp01(rootDevelopment.girthAge)
        : progress;
    const rootSpread = smoothstepRange(lineagedRoot ? girthProgress : progress, 0.28, 0.88);
    const rootMass = smoothstepRange(girthProgress, 0.2, 0.96);
    return Object.freeze({
        rootBaseScale: lerp(0.52, 1, rootMass),
        rootReachScale: lerp(0.28, 1, rootSpread),
        rootWidthFloorScale: lerp(0.3, 1, rootMass),
        rootTipWidthFloorScale: lerp(0.28, 1, rootMass),
        rootAlpha: lerp(0.72, 0.94, rootMass),
        soilJoinAlpha: lerp(0.58, 1, rootMass),
        clockSource: lineagedRoot ? 'classic2_root_development' : 'growth_projection',
    });
};

export const resolveNebariRootWidthFloors = (developmentProfile = null) => {
    const profile = developmentProfile && typeof developmentProfile === 'object'
        ? developmentProfile
        : {};
    const baseScale = clampRange(profile.rootWidthFloorScale, 0.28, 1.08);
    const tipScale = clampRange(profile.rootTipWidthFloorScale, 0.24, 1.08);
    return Object.freeze({
        startMinWidth: lerp(0.52, 1.5, baseScale),
        endMinWidth: lerp(0.16, 0.46, tipScale),
    });
};

export const resolveNebariTrunkWidth = ({ topology = null, lifeState = null } = {}) => {
    const lifeAppearance = resolveSakuraLifeAppearanceProfile(lifeState);
    return Math.max(
        0.8,
        (Number(topology?.width) || 1) * lifeAppearance.branchWidthScale,
    );
};

export const resolveNebariRootBaseWidth = ({
    trunkWidth,
    developmentProfile = null,
} = {}) => {
    const width = Math.max(0.8, Number(trunkWidth) || 0.8);
    const rootBaseScale = clampRange(
        developmentProfile?.rootBaseScale,
        0.28,
        1.08,
    );
    return Math.max(0.9, width * (0.9 + (rootBaseScale * 0.38)));
};

const drawNebariMossSurface = ({
    ctx,
    seed,
    trunkOffsetX,
    rimY,
    soilRx,
    soilRy,
    rootBaseWidth,
    growthProjection,
}) => {
    const mossPlan = resolveNebariMossVisualPlan(growthProjection);
    const mossPresence = resolveNebariMossPresence(growthProjection);
    const mossSlots = [
        { id: 'left_rear', u: -0.54, v: 0.04, scale: 0.98, count: 4 },
        { id: 'right_rear', u: 0.58, v: 0.07, scale: 0.94, count: 4 },
        { id: 'left_front', u: -0.36, v: 0.32, scale: 0.66, count: 2 },
        { id: 'right_front', u: 0.38, v: 0.34, scale: 0.64, count: 2 },
    ];

    ctx.save();
    mossSlots.forEach((slot) => {
        const driftX = (hashUnit(`${seed}|moss_slot_x|${slot.id}`) - 0.5) * soilRx * 0.1;
        const driftY = (hashUnit(`${seed}|moss_slot_y|${slot.id}`) - 0.5) * soilRy * 0.32;
        const baseX = trunkOffsetX + (slot.u * soilRx) + driftX;
        const baseY = rimY + (soilRy * (0.3 + slot.v)) + driftY;
        const mossAlpha = (0.055 + (mossPresence * 0.095)) * mossPlan.alphaScale;

        for (let patchIndex = 0; patchIndex < slot.count; patchIndex += 1) {
            const patchAngle = hashUnit(`${seed}|moss_angle|${slot.id}|${patchIndex}`) * Math.PI * 2;
            const patchRadius = soilRx * (0.034 + (hashUnit(`${seed}|moss_radius|${slot.id}|${patchIndex}`) * 0.052));
            const x = baseX + (Math.cos(patchAngle) * patchRadius);
            const y = Math.max(
                rimY + (soilRy * 0.28),
                baseY + (Math.sin(patchAngle) * soilRy * 0.2),
            );
            if (Math.abs(x - trunkOffsetX) < rootBaseWidth * 0.72 && y < rimY + (soilRy * 0.44)) {
                continue;
            }
            const scale = slot.scale * (0.7 + (hashUnit(`${seed}|moss_scale|${slot.id}|${patchIndex}`) * 0.9));
            const tone = hashUnit(`${seed}|moss_tone|${slot.id}|${patchIndex}`);
            ctx.fillStyle = withAlphaColor('#2C241B', 0.035 + (mossPresence * 0.035));
            ctx.beginPath();
            ctx.ellipse(
                x,
                y + Math.max(0.16, rootBaseWidth * 0.018 * scale),
                Math.max(0.8, rootBaseWidth * 0.15 * scale),
                Math.max(0.22, rootBaseWidth * 0.036 * scale),
                patchAngle,
                0,
                Math.PI * 2,
            );
            ctx.fill();

            ctx.fillStyle = withAlphaColor(
                tone > 0.66 ? mossPlan.patchToneA : tone > 0.34 ? mossPlan.patchToneB : mossPlan.patchToneC,
                mossAlpha * (0.52 + (patchIndex / Math.max(1, slot.count - 1)) * 0.26),
            );
            ctx.beginPath();
            ctx.ellipse(
                x,
                y,
                Math.max(0.8, rootBaseWidth * 0.16 * scale),
                Math.max(0.22, rootBaseWidth * 0.032 * scale),
                patchAngle,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
    });
    ctx.restore();
};

const drawSakuraNebari = (
    ctx,
    topology,
    trunkOffsetX,
    trunkBaseY,
    potModel,
    config,
    environmentState = null,
    lifeState = null,
    growthProjection = null,
) => {
    const lighting = resolveSakuraRenderLighting(environmentState);
    const lifeMood = resolveSakuraLifeMood(lifeState);
    const nebariDevelopment = resolveNebariDevelopmentProfile(growthProjection, topology);
    const fallbackPotHeight = Math.max(8, Number(potModel?.baseHeight || 32));
    const rimY = Number(
        potModel?.rootZone?.rimY ?? (-fallbackPotHeight),
    );
    const soilRx = Math.max(12, Number(potModel?.rootZone?.spreadX ?? (potModel?.baseWidth || 80) * 0.42));
    const soilRy = Math.max(4.6, Number(potModel?.rootZone?.spreadY ?? (potModel?.baseHeight || 32) * 0.105));
    const potHeight = fallbackPotHeight;
    const trunkWidth = resolveNebariTrunkWidth({ topology, lifeState });
    const rootBaseWidth = resolveNebariRootBaseWidth({
        trunkWidth,
        developmentProfile: nebariDevelopment,
    });
    const speciesCharacter = clamp01(topology?.geneProfile?.speciesCharacter ?? 0.5);
    const rootBias = ((topology?.visualPhenotype?.trunkOffsetX ?? 0) * 0.14) + ((speciesCharacter - 0.5) * 0.12);
    const { geometrySeed, surfaceSeed } = resolveNebariSeedPlan({
        topology,
        potModel,
        growthProjection,
    });
    const grainPattern = createSakuraBarkGrainPattern(ctx);
    const rootSpecs = createNebariRootSpecs({
        seed: geometrySeed,
        topology,
        trunkOffsetX,
        trunkBaseY,
        rimY,
        soilRx,
        soilRy,
        potHeight,
        rootBaseWidth,
        rootBias,
        rootLengthScale: nebariDevelopment.rootReachScale,
        developmentProfile: nebariDevelopment,
    });

    ctx.save();
    beginZenPotShapePath(
        ctx,
        potModel?.rootZone?.clipShape || {
            kind: 'ellipse',
            cx: 0,
            cy: rimY + (soilRy * 0.08),
            rx: soilRx,
            ry: soilRy * 1.38,
        },
    );
    ctx.clip();
    ctx.beginPath();
    ctx.rect(-soilRx * 1.22, rimY - (soilRy * 1.22), soilRx * 2.44, soilRy * 2.9);
    ctx.clip();

    drawNebariSoilTexture({
        ctx,
        seed: surfaceSeed,
        trunkOffsetX,
        rimY,
        soilRx,
        soilRy,
        rootBaseWidth,
        potPalette: potModel?.palette,
        growthProjection,
    });

    drawNebariMossSurface({
        ctx,
        seed: surfaceSeed,
        trunkOffsetX,
        rimY,
        soilRx,
        soilRy,
        rootBaseWidth,
        growthProjection,
    });

    const specCount = rootSpecs.length;
    ctx.save();
    ctx.globalAlpha *= nebariDevelopment.rootAlpha;
    rootSpecs.forEach((spec, index) => {
        const frontness = specCount > 1 ? index / (specCount - 1) : 1;
        drawTaperedNebariRoot({
            ctx,
            spec,
            config,
            lighting,
            lifeMood,
            potPalette: potModel?.palette,
            depthShade: 0.86 + (frontness * 0.2),
            grainPattern,
        });
    });
    ctx.restore();

    ctx.restore();

    drawNebariSoilJoin({
        ctx,
        trunkOffsetX,
        trunkBaseY,
        trunkWidth,
        rimY,
        soilRy,
        config,
        lifeMood,
        developmentProfile: nebariDevelopment,
    });
};

const resolveFallbackCamera = (ctx) => {
    const canvasWidth = Math.max(1, Number(ctx?.canvas?.width || 1));
    const canvasHeight = Math.max(1, Number(ctx?.canvas?.height || 1));
    const offsetX = canvasWidth * 0.5;
    const offsetY = Math.max(32, canvasHeight - 44);
    return {
        viewportWidth: canvasWidth,
        viewportHeight: canvasHeight,
        scale: 1,
        offsetX,
        offsetY,
        originScreen: { x: offsetX, y: offsetY },
        screenToWorld: ({ x = 0, y = 0 } = {}) => ({
            x: Number(x) - offsetX,
            y: Number(y) - offsetY,
        }),
    };
};

const applyCameraTransform = (ctx, camera) => {
    ctx.translate(camera.offsetX, camera.offsetY);
    if (Math.abs((Number(camera.scale) || 1) - 1) > EPS) {
        ctx.scale(camera.scale, camera.scale);
    }
};

export const renderSakuraPot = ({ ctx, topology, species, potType = DEFAULT_ZEN_BONSAI_POT_STYLE }) => {
    if (!topology) {
        return;
    }

    const potDims = species.getPotDimensions(topology.visualPhenotype);
    drawGlazedPot(ctx, 0, 0, potDims.width, potDims.height, potType);
};

export const renderSakura = ({
    ctx,
    topology,
    frameCount = 0,
    currentStage,
    assetCache,
    wind,
    camera = null,
    options = {},
    species,
    config,
    pixelRatio = 1,
}) => {
    if (!topology) {
        return;
    }

    const {
        skipPot = false,
        potStyleOverride = null,
        showBackboneDebug = false,
        showBranchTierDebug = false,
        backboneDebugCompact = false,
        renderMode = 'full',
        environmentState = null,
        renderLayer = SAKURA_RENDER_LAYERS.FULL,
        renderTreeContent = SAKURA_TREE_CONTENT_LAYERS.ALL,
        renderBackdrop = true,
        freezeBranchMotion = false,
        showGroundBranchShadow = false,
        lifeState = null,
        activationPresentation = null,
        growthProjection = null,
        homeGardenBedProjection = null,
        gardenBedMaterialStyle = null,
        renderPlan = null,
        treePaintObservationMode = false,
    } = options;
    const resolvedRenderPlan = requireSakuraRenderPlanV1(renderPlan);
    const resolvedRenderLayer = resolveSakuraRenderLayer(renderLayer);
    const renderBackLayer = (
        resolvedRenderLayer === SAKURA_RENDER_LAYERS.FULL
        || resolvedRenderLayer === SAKURA_RENDER_LAYERS.BACK
    );
    const renderTreeLayer = (
        resolvedRenderLayer === SAKURA_RENDER_LAYERS.FULL
        || resolvedRenderLayer === SAKURA_RENDER_LAYERS.TREE
    );
    const renderFrontLayer = (
        resolvedRenderLayer === SAKURA_RENDER_LAYERS.FULL
        || resolvedRenderLayer === SAKURA_RENDER_LAYERS.FRONT
    );

    const potType = typeof potStyleOverride === 'string' && potStyleOverride.trim()
        ? potStyleOverride.trim()
        : resolvePotPalette(topology, currentStage);
    const resolvedCamera = camera || resolveFallbackCamera(ctx);
    const originScreen = resolvedCamera?.originScreen || {
        x: Number(resolvedCamera?.offsetX) || 0,
        y: Number(resolvedCamera?.offsetY) || 0,
    };

    const potDims = resolvedRenderPlan.anchor.potDims;
    const trunkOffsetX = resolvedRenderPlan.anchor.trunkOffsetX;
    const trunkBaseY = resolvedRenderPlan.anchor.trunkBaseY;
    const potModel = resolveZenPotRenderModel({
        width: potDims.width,
        height: potDims.height,
        type: potType,
    });
    if (
        potModel.family === 'frame_bed'
        && homeGardenBedProjection === null
        && treePaintObservationMode !== true
    ) {
        throw new Error('ZEN_HOME_GARDEN_BED_PROJECTION_REQUIRED');
    }
    const lighting = resolveSakuraRenderLighting(environmentState);
    const windState = resolveSakuraWindState(wind, environmentState, frameCount);
    const resolvedGrowthProjection = growthProjection || currentStage?.growthProjection || null;
    const homeGardenBedGeometry = potModel.family === 'frame_bed'
        && treePaintObservationMode !== true
        ? resolveZenHomeGardenBedDeviceMesh({
            projection: homeGardenBedProjection,
        })
        : null;

    if (renderBackLayer && renderMode !== 'trunk_sandbox') {
        if (renderBackdrop !== false) {
            drawSakuraBackdrop(
                ctx,
                topology,
                originScreen.x,
                originScreen.y,
                currentStage,
                trunkOffsetX * (Number(resolvedCamera?.scale) || 1),
                potModel,
                Number(resolvedCamera?.scale) || 1,
                environmentState,
                lifeState,
                homeGardenBedGeometry?.sceneViewport || null,
            );
        }
        if (!skipPot && homeGardenBedGeometry) {
            drawZenHomeGardenBedBackLayer(ctx, {
                geometry: homeGardenBedGeometry,
                palette: potModel.palette,
                materialStyle: gardenBedMaterialStyle || potModel.materialStyle,
            });
            drawZenHomeGardenBedContactShadow(ctx, {
                geometry: homeGardenBedGeometry,
                lighting,
            });
        }
    }

    // BACK is also the Pixi texture-bake entry. Dynamic weather belongs only
    // to the explicit full Canvas scene, never to a cached back texture.
    if (resolvedRenderLayer === SAKURA_RENDER_LAYERS.FULL) {
        drawZenBonsaiRainCanvas(ctx, {
            presentation: resolveZenBonsaiRainPresentation(homeGardenBedGeometry, ctx.canvas.width, ctx.canvas.height),
            seed: hashStringFNV1a(resolvedRenderPlan.source.topologySignature), options, pixelRatio,
            activeTimeSec: frameCount / 60,
        });
    }

    ctx.save();
    if (homeGardenBedGeometry) {
        ctx.translate(
            homeGardenBedGeometry.sceneViewport.x,
            homeGardenBedGeometry.sceneViewport.y,
        );
        ctx.beginPath();
        ctx.rect(
            0,
            0,
            homeGardenBedGeometry.sceneViewport.width,
            homeGardenBedGeometry.sceneViewport.height,
        );
        ctx.clip();
    }
    applyCameraTransform(ctx, resolvedCamera);
    ctx.strokeStyle = config.barkColor;
    ctx.lineCap = 'round';

    if (renderBackLayer && !skipPot) {
        if (showGroundBranchShadow) {
            drawSakuraGroundShadow(
                ctx,
                topology,
                trunkOffsetX,
                trunkBaseY,
                potModel,
                config,
                environmentState,
                lifeState,
            );
        }
        renderSakuraPot({
            ctx,
            topology,
            species,
            potType,
        });
        drawSakuraNebari(
            ctx,
            topology,
            trunkOffsetX,
            trunkBaseY,
            potModel,
            config,
            environmentState,
            lifeState,
            resolvedGrowthProjection,
        );
    }

    if (renderTreeLayer) {
        const drawSegment = createSakuraBranchLayerRenderer({
            ctx,
            assetCache,
            config,
            showBranchTierDebug,
            frameCount,
            wind: windState,
            lighting,
            renderTreeContent,
            freezeBranchMotion,
            lifeState,
            activationPresentation,
            growthProjection: resolvedGrowthProjection,
            renderPlan: resolvedRenderPlan,
            renderPlanRoot: resolvedRenderPlan.root,
        });
        drawSegment(
            resolvedRenderPlan.root,
            trunkOffsetX,
            trunkBaseY,
            resolvedRenderPlan.rootAngle,
            resolvedRenderPlan.rootAngle,
            resolvedRenderPlan.root.depth,
        );
    }

    if (renderFrontLayer && !skipPot) {
        drawGlazedPotFrontOverlay(ctx, 0, 0, potDims.width, potDims.height, potType);
    }

    if (renderFrontLayer && showBackboneDebug) {
        drawSakuraBackboneDebugOverlay({
            ctx,
            topology,
            trunkOffsetX,
            trunkBaseY,
            centerX: 0,
            bottomY: 0,
            compact: backboneDebugCompact,
            legendOrigin: typeof resolvedCamera?.screenToWorld === 'function'
                ? resolvedCamera.screenToWorld({ x: 8, y: 8 })
                : null,
        });
    }

    ctx.restore();

    if (renderFrontLayer && !skipPot && homeGardenBedGeometry) {
        drawZenHomeGardenBedFrontLayer(ctx, {
            geometry: homeGardenBedGeometry,
            palette: potModel.palette,
            frontColor: ZEN_HOME_GARDEN_BED_COLORS.frameFront,
            materialStyle: gardenBedMaterialStyle || potModel.materialStyle,
        });
    }
};
