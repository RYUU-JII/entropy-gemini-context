import { resolveZenPondFieldSize } from '../../../runtime/zenPondViewportPolicy.js';
import { resolveZenWaterOpticalDomain } from './zenWaterOpticalDomain.js';
import {
    BLEND_MODES,
    Geometry,
    Mesh,
    RenderTexture,
    SCALE_MODES,
    Shader,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES } from './zenWaterSurfaceFieldShader.js';
import { resolveZenWaterSurfaceFieldShaderSources } from './zenWaterSurfaceFieldShaderDialect.js';
import {
    ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID,
} from '../../../contracts/zenWaterSurfaceFieldRainModel.js';
import {
    ZEN_SURFACE_DISTURBANCE_SOURCES,
    readZenSurfaceDisturbanceSource,
} from '../../../runtime/surface/zenSurfaceDisturbance.js';

const DEFAULT_FIELD_LONG_EDGE = 384;
const DEFAULT_RAIN_RIPPLE_BUDGET = 36;
const FIELD_TIME_WRAP_SECONDS = 4096;
const FRAME_MS_BASE = 16.6667;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const requireFiniteChannel = (value, name) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_WATER_SURFACE_FIELD_CHANNEL_MISSING:${name}`);
    }
    return numeric;
};

export const resolveZenWaterSurfaceFieldLongEdge = (qualityProfile = null) => {
    const longEdge = Math.floor(Number(qualityProfile?.surfaceFieldLongEdge));
    if (!Number.isFinite(longEdge)) return DEFAULT_FIELD_LONG_EDGE;
    return Math.min(DEFAULT_FIELD_LONG_EDGE, Math.max(192, longEdge));
};

export const resolveZenWaterSurfaceFieldSize = ({
    width,
    height,
    qualityProfile = null,
} = {}) => {
    const sceneWidth = Math.max(1, Math.round(Number(width) || 0));
    const sceneHeight = Math.max(1, Math.round(Number(height) || 0));
    if (sceneWidth <= 1 || sceneHeight <= 1) {
        throw new Error('ZEN_WATER_SURFACE_FIELD_SIZE_INVALID');
    }
    const longEdge = resolveZenWaterSurfaceFieldLongEdge(qualityProfile);
    return resolveZenPondFieldSize({ width: sceneWidth, height: sceneHeight, longEdge });
};

export const resolveZenWaterSurfaceFieldRainGrid = ({
    qualityProfile = null,
    aspect = 1,
} = {}) => {
    const targetBudget = Math.floor(Number(qualityProfile?.rainRippleBudget));
    const budget = Number.isFinite(targetBudget)
        ? Math.min(DEFAULT_RAIN_RIPPLE_BUDGET, Math.max(8, targetBudget))
        : DEFAULT_RAIN_RIPPLE_BUDGET;
    const safeAspect = clampNumber(aspect, 0.5, 3, 1);
    const cellsPerLayer = budget * 0.5;
    const rows = Math.max(2, Math.round(Math.sqrt(cellsPerLayer / safeAspect)));
    const columns = Math.max(2, Math.round(cellsPerLayer / rows));
    return Object.freeze({
        columns,
        rows,
        targetBudget: budget,
        cellCount: columns * rows * 2,
        candidateEvaluationsPerPixel: 2,
    });
};

const requireDisturbanceNumber = (disturbance, fieldName, sourceIndex) => {
    const numeric = Number(disturbance?.[fieldName]);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_WATER_SURFACE_FIELD_DISTURBANCE_INVALID:${sourceIndex}:${fieldName}`);
    }
    return numeric;
};

const resolveDisturbanceStrength = (disturbance, sourceIndex) => {
    const amplitude = Number(disturbance?.amplitude);
    const priority = Number(disturbance?.priority);
    if (!Number.isFinite(amplitude)) {
        throw new Error(`ZEN_WATER_SURFACE_FIELD_DISTURBANCE_INVALID:${sourceIndex}:amplitude`);
    }
    if (amplitude <= 0) return 0;
    if (!Number.isFinite(priority)) {
        throw new Error(`ZEN_WATER_SURFACE_FIELD_DISTURBANCE_INVALID:${sourceIndex}:priority`);
    }
    return amplitude * priority;
};

const createDisturbanceSourceCounts = () => ({
    [ZEN_SURFACE_DISTURBANCE_SOURCES.TAP]: 0,
    [ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE]: 0,
    [ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL]: 0,
});

export const encodeZenWaterSurfaceFieldDisturbances = ({
    disturbances = [],
    sceneWidth,
    sceneHeight,
    disturbanceData = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES * 4),
    disturbanceMeta = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES * 4),
    selectedIndices = new Int16Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES),
    selectedStrengths = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES),
} = {}) => {
    const width = Math.max(1, Number(sceneWidth) || 0);
    const height = Math.max(1, Number(sceneHeight) || 0);
    if (width <= 1 || height <= 1) {
        throw new Error('ZEN_WATER_SURFACE_FIELD_DISTURBANCE_SPACE_INVALID');
    }
    disturbanceData.fill(0);
    disturbanceMeta.fill(0);
    selectedIndices.fill(-1);
    selectedStrengths.fill(0);
    const source = Array.isArray(disturbances) ? disturbances : [];
    let selectedCount = 0;
    let candidateCount = 0;
    const candidateSourceCounts =
        createDisturbanceSourceCounts();
    const selectedSourceCounts =
        createDisturbanceSourceCounts();
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
        const disturbance = source[sourceIndex];
        const disturbanceSource =
            readZenSurfaceDisturbanceSource(
                disturbance?.source,
            );
        const strength = resolveDisturbanceStrength(disturbance, sourceIndex);
        if (strength <= 0.0001) continue;
        requireDisturbanceNumber(disturbance, 'x', sourceIndex);
        requireDisturbanceNumber(disturbance, 'y', sourceIndex);
        requireDisturbanceNumber(disturbance, 'radiusPx', sourceIndex);
        requireDisturbanceNumber(disturbance, 'widthPx', sourceIndex);
        candidateCount += 1;
        candidateSourceCounts[disturbanceSource] += 1;
        let insertAt = selectedCount;
        while (insertAt > 0 && strength >= selectedStrengths[insertAt - 1]) {
            insertAt -= 1;
        }
        if (insertAt >= ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES) continue;
        const nextCount = Math.min(
            ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES,
            selectedCount + 1,
        );
        for (let index = nextCount - 1; index > insertAt; index -= 1) {
            selectedIndices[index] = selectedIndices[index - 1];
            selectedStrengths[index] = selectedStrengths[index - 1];
        }
        selectedIndices[insertAt] = sourceIndex;
        selectedStrengths[insertAt] = strength;
        selectedCount = nextCount;
    }

    for (let index = 0; index < selectedCount; index += 1) {
        const disturbance = source[selectedIndices[index]];
        const disturbanceSource =
            readZenSurfaceDisturbanceSource(
                disturbance?.source,
            );
        selectedSourceCounts[disturbanceSource] += 1;
        const offset = index * 4;
        const radiusPx = Math.max(0, Number(disturbance.radiusPx) || 0);
        const widthPx = Math.max(0.8, Number(disturbance.widthPx) || 1);
        const secondaryOffsetPx = Number(disturbance.secondaryOffsetPx);
        const secondaryAmplitudeRatio = clampNumber(
            disturbance.secondaryAmplitudeRatio,
            0,
            1,
            0,
        );
        const amplitude = Math.max(0, Number(disturbance.amplitude) || 0);
        disturbanceData[offset] = clampNumber(Number(disturbance.x) / width, 0, 1, 0.5);
        disturbanceData[offset + 1] = clampNumber(Number(disturbance.y) / height, 0, 1, 0.5);
        disturbanceData[offset + 2] = radiusPx / height;
        disturbanceData[offset + 3] = amplitude;
        disturbanceMeta[offset] = widthPx / height;
        disturbanceMeta[offset + 1] = (
            Number.isFinite(secondaryOffsetPx)
            && secondaryOffsetPx > 0
            && secondaryAmplitudeRatio > 0.0001
            && radiusPx > secondaryOffsetPx + 2
        )
            ? Math.max(0, radiusPx - secondaryOffsetPx) / height
            : 0;
        disturbanceMeta[offset + 2] = disturbanceMeta[offset + 1] > 0
            ? amplitude * secondaryAmplitudeRatio
            : 0;
        disturbanceMeta[offset + 3] = clampNumber(
            disturbance.trailingWaveStrength,
            0,
            1,
            0,
        );
    }

    const droppedSourceCounts =
        createDisturbanceSourceCounts();
    Object.values(ZEN_SURFACE_DISTURBANCE_SOURCES).forEach(
        (disturbanceSource) => {
            droppedSourceCounts[disturbanceSource] =
                candidateSourceCounts[disturbanceSource]
                - selectedSourceCounts[disturbanceSource];
        },
    );

    return {
        count: selectedCount,
        candidateCount,
        droppedCount: Math.max(0, candidateCount - selectedCount),
        sourceCounts: Object.freeze({
            candidate: Object.freeze(
                candidateSourceCounts,
            ),
            selected: Object.freeze(
                selectedSourceCounts,
            ),
            dropped: Object.freeze(
                droppedSourceCounts,
            ),
        }),
        disturbanceData,
        disturbanceMeta,
    };
};

export class ZenWaterSurfaceField {
    constructor({ renderer, width, height, qualityProfile = null } = {}) {
        if (!renderer || typeof renderer.render !== 'function') {
            throw new Error('ZEN_WATER_SURFACE_FIELD_RENDERER_MISSING');
        }
        const shaderSources = resolveZenWaterSurfaceFieldShaderSources(renderer.context?.webGLVersion);
        this.renderer = renderer;
        this.shaderDialect = shaderSources.dialect;
        this.qualityProfile = qualityProfile;
        this.sceneWidth = Math.max(1, Math.round(Number(width) || 0));
        this.sceneHeight = Math.max(1, Math.round(Number(height) || 0));
        this.fieldSize = resolveZenWaterSurfaceFieldSize({
            width: this.sceneWidth,
            height: this.sceneHeight,
            qualityProfile,
        });
        this.cadenceTier = typeof qualityProfile?.cadenceTier === 'string'
            ? qualityProfile.cadenceTier
            : 'canonical';
        this.rainGrid = resolveZenWaterSurfaceFieldRainGrid({
            qualityProfile,
            aspect: this.sceneWidth / this.sceneHeight,
        });
        this.timeSeconds = 0;
        this.domain = resolveZenWaterOpticalDomain(this.sceneWidth, this.sceneHeight, this.fieldSize);
        this.disposed = false;
        this.disturbanceData = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES * 4);
        this.disturbanceMeta = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES * 4);
        this.selectedDisturbanceIndices = new Int16Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES);
        this.selectedDisturbanceStrengths = new Float32Array(ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES);
        this.renderTexture = RenderTexture.create({
            width: this.domain.width,
            height: this.domain.height,
            resolution: 1,
        });
        this.renderTexture.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        this.geometry = new Geometry()
            .addAttribute('aVertexPosition', [
                0, 0,
                this.domain.width, 0,
                this.domain.width, this.domain.height,
                0, this.domain.height,
            ], 2)
            .addAttribute('aTextureCoord', [
                0, 0,
                1, 0,
                1, 1,
                0, 1,
            ], 2)
            .addIndex([0, 1, 2, 0, 2, 3]);
        this.shader = Shader.from(shaderSources.vertex, shaderSources.fragment, {
            uTime: 0,
            uFieldResolution: [this.fieldSize.width, this.fieldSize.height],
            uSurfaceFieldMap: this.domain.map,
            uAspect: this.sceneWidth / this.sceneHeight,
            uWindDir: [1, 0],
            uGravityWaveEnergy: 0.5,
            uCapillaryWaveEnergy: 0.5,
            uDirectionalSpread: 0.5,
            uGustEnvelope: 0.5,
            uSpatialStability: 0,
            uDetailStability: 0,
            uTemporalStability: 0,
            uRainIntensity: 0,
            uRainGrid: [this.rainGrid.columns, this.rainGrid.rows],
            uDisturbanceCount: 0,
            uDisturbanceData: this.disturbanceData,
            uDisturbanceMeta: this.disturbanceMeta,
        });
        this.mesh = new Mesh(this.geometry, this.shader);
        this.mesh.size = 6;
        this.mesh.blendMode = BLEND_MODES.NONE;
        this.lastProbe = null;
    }

    resize(width, height) {
        this.sceneWidth = width;
        this.sceneHeight = height;
        this.fieldSize = resolveZenWaterSurfaceFieldSize({ width, height, qualityProfile: this.qualityProfile });
        this.rainGrid = resolveZenWaterSurfaceFieldRainGrid({ qualityProfile: this.qualityProfile, aspect: width / height });
        this.domain = resolveZenWaterOpticalDomain(width, height, this.fieldSize);
        const { width: w, height: h } = this.domain;
        this.renderTexture.resize(w, h, true);
        this.geometry.getBuffer('aVertexPosition').update(new Float32Array([0, 0, w, 0, w, h, 0, h]));
        Object.assign(this.shader.uniforms, {
            uFieldResolution: [this.fieldSize.width, this.fieldSize.height], uAspect: width / height,
            uSurfaceFieldMap: this.domain.map,
            uRainGrid: [this.rainGrid.columns, this.rainGrid.rows],
        });
    }

    update({
        deltaMs = FRAME_MS_BASE,
        frameCount = 0,
        frameState = null,
        frameChannels = null,
        disturbances = [],
    } = {}) {
        if (this.disposed) {
            throw new Error('ZEN_WATER_SURFACE_FIELD_DISPOSED');
        }
        if (!frameState?.channels || frameChannels?.channels !== frameState.channels) {
            throw new Error('ZEN_WATER_SURFACE_FIELD_FRAME_CONTRACT_MISSING');
        }
        const atmosphere = frameState.channels.atmosphere;
        const surface = frameState.channels.surface;
        const windDirection = requireFiniteChannel(atmosphere?.windDirection, 'atmosphere.windDirection');
        const phaseRate = requireFiniteChannel(surface?.phaseRate, 'surface.phaseRate');
        const gravityWaveEnergy = requireFiniteChannel(
            surface?.gravityWaveEnergy,
            'surface.gravityWaveEnergy',
        );
        const capillaryWaveEnergy = requireFiniteChannel(
            surface?.capillaryWaveEnergy,
            'surface.capillaryWaveEnergy',
        );
        const directionalSpread = requireFiniteChannel(
            surface?.directionalSpread,
            'surface.directionalSpread',
        );
        const gustEnvelope = requireFiniteChannel(atmosphere?.gustEnvelope, 'atmosphere.gustEnvelope');
        const rainIntensity = requireFiniteChannel(
            atmosphere?.rainIntensity,
            'atmosphere.rainIntensity',
        );
        const safeDeltaMs = clampNumber(deltaMs, 0, 66.6667, FRAME_MS_BASE);
        this.timeSeconds = (
            this.timeSeconds + safeDeltaMs * 0.001 * clampNumber(phaseRate, 0.24, 1.5, 0.5)
        ) % FIELD_TIME_WRAP_SECONDS;
        const encodedDisturbances = encodeZenWaterSurfaceFieldDisturbances({
            disturbances,
            sceneWidth: this.sceneWidth,
            sceneHeight: this.sceneHeight,
            disturbanceData: this.disturbanceData,
            disturbanceMeta: this.disturbanceMeta,
            selectedIndices: this.selectedDisturbanceIndices,
            selectedStrengths: this.selectedDisturbanceStrengths,
        });
        const uniforms = this.shader.uniforms;
        uniforms.uTime = this.timeSeconds;
        uniforms.uWindDir[0] = Math.cos(windDirection);
        uniforms.uWindDir[1] = Math.sin(windDirection);
        uniforms.uGravityWaveEnergy = clampNumber(gravityWaveEnergy, 0, 1, 0.5);
        uniforms.uCapillaryWaveEnergy = clampNumber(capillaryWaveEnergy, 0, 1, 0.5);
        uniforms.uDirectionalSpread = clampNumber(directionalSpread, 0, 1, 0.5);
        uniforms.uGustEnvelope = clampNumber(gustEnvelope, 0, 1, 0.5);
        uniforms.uRainIntensity = clampNumber(rainIntensity, 0, 1, 0);
        uniforms.uSpatialStability = requireFiniteChannel(
            surface?.spatialStability,
            'surface.spatialStability',
        );
        uniforms.uDetailStability = requireFiniteChannel(
            surface?.detailStability,
            'surface.detailStability',
        );
        uniforms.uTemporalStability = requireFiniteChannel(
            surface?.temporalStability,
            'surface.temporalStability',
        );
        uniforms.uDisturbanceCount = encodedDisturbances.count;

        const submitStartedMs = nowMs();
        this.renderer.render(this.mesh, {
            renderTexture: this.renderTexture,
            clear: true,
        });
        const submitMs = Math.max(0, nowMs() - submitStartedMs);
        this.lastProbe = {
            active: true,
            rainModelId: ZEN_WATER_SURFACE_FIELD_RAIN_MODEL_ID,
            width: this.fieldSize.width,
            height: this.fieldSize.height,
            textureWidth: this.domain.width,
            textureHeight: this.domain.height,
            cadenceTier: this.cadenceTier,
            disturbanceCount: encodedDisturbances.count,
            disturbanceCandidateCount: encodedDisturbances.candidateCount,
            disturbanceDroppedCount: encodedDisturbances.droppedCount,
            disturbanceSourceCounts:
                encodedDisturbances.sourceCounts,
            rainIntensity: Number(uniforms.uRainIntensity.toFixed(4)),
            rainRippleTargetBudget: this.rainGrid.targetBudget,
            rainRippleCellCount: this.rainGrid.cellCount,
            rainCandidateEvaluationsPerPixel: this.rainGrid.candidateEvaluationsPerPixel,
            frameCount: Math.max(0, Math.floor(Number(frameCount) || 0)),
            time: Number(this.timeSeconds.toFixed(4)),
            submitMs: Number(submitMs.toFixed(4)),
        };
        return this.lastProbe;
    }

    get texture() {
        if (this.disposed) {
            throw new Error('ZEN_WATER_SURFACE_FIELD_DISPOSED');
        }
        return this.renderTexture;
    }

    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        this.mesh.destroy();
        this.shader.destroy();
        this.geometry.destroy();
        this.renderTexture.destroy(true);
        this.lastProbe = null;
    }
}
