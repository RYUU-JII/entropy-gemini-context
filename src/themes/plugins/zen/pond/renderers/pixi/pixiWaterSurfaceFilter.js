import { Filter } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { ZEN_GRAPHICS_BUDGETS } from '../../../runtime/zenRenderQuality.js';
import {
    isZenWaterSurfaceFieldAlgorithm,
    normalizeZenWaterReflectionAlgorithm,
    resolveZenWaterReflectionAlgorithmMode,
    ZEN_WATER_REFLECTION_ALGORITHMS,
} from '../../contracts/zenWaterReflectionAlgorithms.js';
import {
    resolvePixiWaterSurfaceFragmentShader,
} from './pixiWaterSurfaceShaderSource.js';
import {
    resolvePixiWaterSurfaceFeatureUniforms,
    resolvePixiWaterSurfacePipelineMode,
} from './pixiWaterSurfaceFeatureUniforms.js';
import { applyPixiWaterSurfaceFilterUpdate } from './pixiWaterSurfaceUniformResolver.js';
import { resolveZenPixiOwnedShaderSources } from '../../../runtime/pixi/zenPixiOwnedShaderDialect.js';

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

export const PIXI_WATER_SURFACE_FILTER_RESOLUTION_SCALE = ZEN_GRAPHICS_BUDGETS.full.waterSurfaceResolutionScale;

export const resolvePixiWaterSurfaceFilterResolutionScale = (qualityProfile = null) => {
    if (qualityProfile === null) return PIXI_WATER_SURFACE_FILTER_RESOLUTION_SCALE;
    const scale = qualityProfile.waterSurfaceResolutionScale;
    if (!Number.isFinite(scale) || scale < 0.45 || scale > 1) {
        throw new Error('ZEN_WATER_SURFACE_RESOLUTION_REQUIRED');
    }
    return scale;
};

export class PixiWaterSurfaceFilter extends Filter {
    constructor(width = 800, height = 600, options = null) {
        const pipelineMode = resolvePixiWaterSurfacePipelineMode(
            options?.effectDebugToggles || options,
        );
        const waterReflectionAlgorithm = normalizeZenWaterReflectionAlgorithm(
            options?.waterReflectionAlgorithm ?? ZEN_WATER_REFLECTION_ALGORITHMS.PHASE_NOISE,
        );
        if (isZenWaterSurfaceFieldAlgorithm(waterReflectionAlgorithm)) {
            throw new Error('ZEN_PIXI_CANONICAL_SURFACE_FIELD_FILTER_REQUIRED');
        }
        const sources = resolveZenPixiOwnedShaderSources({
            programId: 'water_surface_comparison',
            webGLVersion: options?.webGLVersion,
            vertexSrc: null,
            defaultVertexSrc: Filter.defaultVertexSrc,
            fragmentSrc: resolvePixiWaterSurfaceFragmentShader(pipelineMode, waterReflectionAlgorithm),
        });
        super(sources.vertex, sources.fragment);

        // Initialize uniforms
        this.uniforms.uTime = 0.0;
        this.uniforms.uSpeed = [0.018, 0.024];
        this.uniforms.uScale = [0.015, 0.015];
        this.uniforms.uResolution = [Math.max(1, width), Math.max(1, height)];
        this.uniforms.uFilterOrigin = [0, 0];
        this.uniforms.uWorldResolution = [Math.max(1, width), Math.max(1, height)];
        this.uniforms.uWaterScale = 8.0;
        this.uniforms.uTurbulence = 0.45;
        this.uniforms.uCurrentDir = [0.866, 0.5];
        this.uniforms.uIrregularity = 0.85;
        this.uniforms.uRefractionMicroScale = 1.0;
        this.uniforms.uRefractionJitter = 1.0;
        this.uniforms.uRefractionDensity = 1.0;
        this.uniforms.uRefractionAnisotropy = 0.35;
        this.uniforms.uFlowMix = 0.0;
        this.uniforms.uFlowTransport = 0.34;
        this.uniforms.uSpectralSpread = 0.46;
        this.uniforms.uSpectralPeak = 0.92;
        this.uniforms.uSunDir = [0.24, 0.12, 0.96];
        this.uniforms.uSunColor = [5.8, 5.6, 5.2];
        this.uniforms.uYoonseulIntensity = 1.0;
        this.uniforms.uYoonseulSharpness = 1.1;
        this.uniforms.uYoonseulPatchScale = 1.0;
        this.uniforms.uYoonseulMotion = 1.0;
        this.uniforms.uYoonseulOpacity = 1.0;
        this.uniforms.uYoonseulTime = 0.0;
        this.uniforms.uYoonseulFlickerAmount = 0.45;
        this.uniforms.uYoonseulTemporalCoherence = 0.38;
        this.uniforms.uYoonseulLowBand = 0.5;
        this.uniforms.uYoonseulMicroBand = 0.5;
        this.uniforms.uYoonseulGlintStability = 0.62;
        this.uniforms.uYoonseulBeatDamping = 0.65;
        this.uniforms.uYoonseulAlgorithmMode = resolveZenWaterReflectionAlgorithmMode(
            waterReflectionAlgorithm,
        );
        this.uniforms.uYoonseulStability = 0.0;
        this.uniforms.uYoonseulSpatialStability = 0.0;
        this.uniforms.uYoonseulDetailStability = 0.0;
        this.uniforms.uYoonseulTemporalStability = 0.0;
        this.uniforms.uYoonseulSoftKnee = 0.0;
        this.uniforms.uFlowPulseAmount = 0.34;
        this.uniforms.uSurfaceReflectionColor = [0.64, 0.76, 0.86];
        this.uniforms.uSurfaceReflectionStrength = 0.055;
        this.uniforms.uSurfaceSheenColor = [1.0, 0.95, 0.82];
        this.uniforms.uSurfaceSheenIntensity = 0.0;
        this.uniforms.uSurfaceSheenClarity = 0.62;
        this.uniforms.uSurfaceGoldLift = 0.0;
        this.uniforms.uRefractionMix = 0.22;
        this.uniforms.uSurfaceOpticsEnabled = 0.0;
        this.uniforms.uSurfaceNormalEnabled = 0.0;
        this.uniforms.uScreenRefractionEnabled = 0.0;
        this.uniforms.uSurfaceReflectionEnabled = 0.0;
        this.uniforms.uRgbSplitEnabled = 0.0;
        this.uniforms.uYoonseulEnabled = 1.0;
        this.uniforms.uRefractionVisibility = 0.82;

        // Internal timing tracker
        this._timeCounter = 0;
        this._yoonseulTimeCounter = 0;
        this._smoothedFlowRate = 0.52;
        this._smoothedYoonseulRate = 0.5;
        this._cachedLightColorInput = '';
        this._cachedLightColor = null;
        this._surfaceUniformStaticSignature = '';
        this._surfaceUniformStaticApplied = false;
        this._lastSurfaceUniformFullUpdate = false;
        this.pipelineMode = pipelineMode;
        this.waterReflectionAlgorithm = waterReflectionAlgorithm;
        this.usesCanonicalSurfaceField = false;
        this._resolutionScale = this.setResolutionScale(
            resolvePixiWaterSurfaceFilterResolutionScale(),
        );
    }

    setResolutionScale(value) {
        const resolutionScale = clampNumber(value, 0.45, 1, PIXI_WATER_SURFACE_FILTER_RESOLUTION_SCALE);
        this._resolutionScale = resolutionScale;
        this.resolution = resolutionScale;
        return resolutionScale;
    }

    applyFeatureToggleUniforms(effectDebugToggles = null) {
        const featureUniforms = resolvePixiWaterSurfaceFeatureUniforms(effectDebugToggles);
        this.uniforms.uSurfaceOpticsEnabled = featureUniforms.surfaceOpticsEnabled;
        this.uniforms.uSurfaceNormalEnabled = featureUniforms.surfaceNormalEnabled;
        this.uniforms.uScreenRefractionEnabled = featureUniforms.screenRefractionEnabled;
        this.uniforms.uSurfaceReflectionEnabled = featureUniforms.surfaceReflectionEnabled;
        this.uniforms.uRgbSplitEnabled = featureUniforms.rgbSplitEnabled;
        this.uniforms.uYoonseulEnabled = featureUniforms.yoonseulEnabled;
    }

    /**
     * Updates the filter's parameters based on application state.
     * @param {number} deltaMs - Elapsed milliseconds since the previous frame
     * @param {number} width - Current screen width
     * @param {number} height - Current screen height
     * @param {Object} currentTuning - Current visual tuning data
     * @param {number} intensityScale - Visual intensity multiplier (0 to 2)
     * @param {Object} frameState - Authoritative pre-resolved frame state bundle
     * @param {Object} frameChannels - Shared per-frame channels from the same frame state
     * @param {Object|null} effectDebugToggles - Optional debug feature toggles
     * @param {Object|null} filterRegion - World-space filter area metadata
     * @param {Object|null} updateOptions - Optional cadence controls for slow uniform groups
     */
    update(
        deltaMs,
        width,
        height,
        currentTuning,
        intensityScale = 1.0,
        frameState = null,
        frameChannels = null,
        effectDebugToggles = null,
        filterRegion = null,
        updateOptions = null,
    ) {
        applyPixiWaterSurfaceFilterUpdate.call(
            this,
            deltaMs,
            width,
            height,
            currentTuning,
            intensityScale,
            frameState,
            frameChannels,
            effectDebugToggles,
            filterRegion,
            updateOptions,
        );
        const requestedWaterReflectionAlgorithm = Object.prototype.hasOwnProperty.call(
            currentTuning || {},
            'waterReflectionAlgorithm',
        )
            ? currentTuning.waterReflectionAlgorithm
            : this.waterReflectionAlgorithm;
        const resolvedAlgorithmMode = resolveZenWaterReflectionAlgorithmMode(
            requestedWaterReflectionAlgorithm,
        );
        if (resolvedAlgorithmMode !== resolveZenWaterReflectionAlgorithmMode(this.waterReflectionAlgorithm)) {
            throw new Error('ZEN_PIXI_WATER_SURFACE_SHADER_VARIANT_STALE');
        }
    }

    apply(filterManager, input, output, clearMode) {
        super.apply(filterManager, input, output, clearMode);
    }

    destroy() {
        super.destroy();
    }
}
