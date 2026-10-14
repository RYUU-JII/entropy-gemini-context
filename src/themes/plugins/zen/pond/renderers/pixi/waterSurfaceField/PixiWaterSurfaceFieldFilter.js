import { Filter, Texture, SCALE_MODES, WRAP_MODES, MIPMAP_MODES } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    normalizeZenWaterReflectionAlgorithm,
    ZEN_WATER_REFLECTION_ALGORITHMS,
} from '../../../contracts/zenWaterReflectionAlgorithms.js';
import {
    PIXI_WATER_SURFACE_PIPELINE_MODES,
    resolvePixiWaterSurfaceFeatureUniforms,
    resolvePixiWaterSurfacePipelineMode,
} from '../pixiWaterSurfaceFeatureUniforms.js';
import {
    pixiWaterSurfaceFieldFragmentShader,
    pixiWaterSurfaceFieldOpticsFragmentShader,
} from '../pixiWaterSurfaceShaderSource.js';
import { applyPixiWaterSurfaceFieldUniforms } from './pixiWaterSurfaceFieldUniformResolver.js';
import { createZenWaterLightTransportUniforms } from './ZenWaterLightTransport.js';
import {
    resolveZenWaterSurfaceFieldFilterShaderSources,
} from './zenWaterSurfaceFieldFilterShaderDialect.js';

import {
    buildZenWorldCloudFieldPixels,
    ZEN_WORLD_CLOUD_FIELD_SIZE,
} from '../../../../runtime/environment/zenWorldCloudField.js';

const DEFAULT_RESOLUTION_SCALE = 0.82;

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const buildPresentationSignature = ({
    width,
    height,
    intensityScale,
    filterRegion,
} = {}) => [
    Number(width),
    Number(height),
    Number(intensityScale),
    Number(filterRegion?.x) || 0,
    Number(filterRegion?.y) || 0,
    Number(filterRegion?.worldWidth) || 0,
    Number(filterRegion?.worldHeight) || 0,
].join('|');

export class PixiWaterSurfaceFieldFilter extends Filter {
    constructor(width = 800, height = 600, options = null) {
        const pipelineMode = resolvePixiWaterSurfacePipelineMode(options?.effectDebugToggles || options);
        const algorithm = normalizeZenWaterReflectionAlgorithm(
            options?.waterReflectionAlgorithm ?? ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD,
        );
        if (algorithm !== ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD) {
            throw new Error('ZEN_PIXI_SURFACE_FIELD_FILTER_ALGORITHM_INVALID');
        }
        const fragmentShader = pipelineMode === PIXI_WATER_SURFACE_PIPELINE_MODES.OPTICS_EXPERIMENTAL
            ? pixiWaterSurfaceFieldOpticsFragmentShader
            : pixiWaterSurfaceFieldFragmentShader;
        const shaderSources = resolveZenWaterSurfaceFieldFilterShaderSources({
            webGLVersion: options?.webGLVersion,
            vertexSrc: Filter.defaultVertexSrc,
            fragmentSrc: fragmentShader,
        });
        if (shaderSources.dialect === 'glsl_es_100') {
            super(null, fragmentShader);
        } else {
            super(shaderSources.vertex, shaderSources.fragment);
        }

        this.uniforms.uResolution = [Math.max(1, width), Math.max(1, height)];
        this.uniforms.uFilterOrigin = [0, 0];
        this.uniforms.uWorldResolution = [Math.max(1, width), Math.max(1, height)];
        this.uniforms.uSunDir = [0.24, 0.12, 0.96];
        this.uniforms.uSunColor = [5.8, 5.6, 5.2];
        this.uniforms.uSurfaceReflectionColor = [0.64, 0.76, 0.86];
        this.uniforms.uSurfaceReflectionStrength = 0.055;
        this.uniforms.uSurfaceSheenColor = [1, 0.95, 0.82];
        this.uniforms.uRefractionMix = 0.2;
        this.uniforms.uRefractionVisibility = 0.82;
        this.uniforms.uSurfaceOpticsEnabled = 0;
        this.uniforms.uSurfaceNormalEnabled = 0;
        this.uniforms.uScreenRefractionEnabled = 0;
        this.uniforms.uSurfaceReflectionEnabled = 0;
        this.uniforms.uRgbSplitEnabled = 0;
        this.uniforms.uYoonseulEnabled = 1;
        this.uniforms.uYoonseulIntensity = 1;
        this.uniforms.uYoonseulOpacity = 1;
        this.uniforms.uYoonseulFocus = 0.5;
        this.uniforms.uSurfaceRoughness = 0.5;
        this.uniforms.uRainRippleVisibilityDrive = 0;
        this.uniforms.uSurfaceField = Texture.EMPTY;
        this.uniforms.uSurfaceFieldReady = 0;
        this.uniforms.uSurfaceFieldMap = [1, 1, 0, 0];
        Object.assign(this.uniforms, createZenWaterLightTransportUniforms());
        this.uniforms.uCloudField = Texture.EMPTY;
        this.uniforms.uCloudPhase = [0, 0];
        this.uniforms.uCloudThreshold = 1;
        this.uniforms.uCloudDensity = 0;
        this.uniforms.uCloudReflectionEnabled = 0;
        this.uniforms.uDiffuseSkylight = 0;
        this.uniforms.uAirHaze = 0;
        this.uniforms.uMaterialLight = [1, 1, 1];
        this.uniforms.uMoonlitMaterialMix = 0;
        this.uniforms.uMoonlitSkyStrength = 0;
        this.cloudFieldTexture = null;
        this.cloudFieldSeed = null;

        this.pipelineMode = pipelineMode;
        this.waterReflectionAlgorithm = algorithm;
        this.usesCanonicalSurfaceField = true;
        this.lastProbe = null;
        this.surfaceFieldCausticsEnabled = false;
        this._lastSurfaceUniformFullUpdate = false;
        this._lastPresentationFrameState = null;
        this._lastPresentationFrameChannels = null;
        this._lastPresentationSignature = '';
        this.setResolutionScale(DEFAULT_RESOLUTION_SCALE);
        this.applyFeatureToggleUniforms(options?.effectDebugToggles || options);
    }

    setResolutionScale(value) {
        const scale = clampNumber(value, 0.45, 1, DEFAULT_RESOLUTION_SCALE);
        this.resolution = scale;
        return scale;
    }

    applyFeatureToggleUniforms(effectDebugToggles = null) {
        const features = resolvePixiWaterSurfaceFeatureUniforms(effectDebugToggles);
        this.uniforms.uSurfaceOpticsEnabled = features.surfaceOpticsEnabled;
        this.uniforms.uSurfaceNormalEnabled = features.surfaceNormalEnabled;
        this.uniforms.uScreenRefractionEnabled = features.screenRefractionEnabled;
        this.uniforms.uSurfaceReflectionEnabled = features.surfaceReflectionEnabled;
        this.uniforms.uRgbSplitEnabled = features.rgbSplitEnabled;
        this.uniforms.uYoonseulEnabled = features.yoonseulEnabled;
        this.uniforms.uCloudReflectionEnabled = features.cloudReflectionEnabled;
        this.surfaceFieldCausticsEnabled = features.surfaceFieldCausticsEnabled > 0.5;
    }

    setCloudFieldSeed(seed) {
        if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
            throw new Error('ZEN_PIXI_CLOUD_FIELD_SEED_REQUIRED');
        }
        if (this.cloudFieldSeed === seed) return;
        const texture = Texture.fromBuffer(
            buildZenWorldCloudFieldPixels(seed),
            ZEN_WORLD_CLOUD_FIELD_SIZE,
            ZEN_WORLD_CLOUD_FIELD_SIZE,
            { scaleMode: SCALE_MODES.LINEAR, wrapMode: WRAP_MODES.REPEAT, mipmap: MIPMAP_MODES.OFF },
        );
        const previous = this.cloudFieldTexture;
        this.cloudFieldTexture = texture;
        this.cloudFieldSeed = seed;
        this.uniforms.uCloudField = texture;
        if (previous) previous.destroy(true);
    }

    setSurfaceFieldTexture(texture) {
        if (!texture || texture.destroyed === true) {
            throw new Error('ZEN_PIXI_WATER_SURFACE_FIELD_TEXTURE_MISSING');
        }
        this.uniforms.uSurfaceField = texture;
        this.uniforms.uSurfaceFieldReady = 1;
    }

    clearSurfaceFieldTexture() {
        this.uniforms.uSurfaceField = Texture.EMPTY;
        this.uniforms.uSurfaceFieldReady = 0;
    }

    update(
        deltaMs,
        width,
        height,
        currentTuning,
        intensityScale = 1,
        frameState = null,
        frameChannels = null,
        effectDebugToggles = null,
        filterRegion = null,
        updateOptions = null,
    ) {
        void deltaMs;
        const algorithm = normalizeZenWaterReflectionAlgorithm(currentTuning?.waterReflectionAlgorithm);
        if (algorithm !== ZEN_WATER_REFLECTION_ALGORITHMS.SURFACE_FIELD) {
            throw new Error('ZEN_PIXI_WATER_SURFACE_SHADER_VARIANT_STALE');
        }
        if (this.uniforms.uSurfaceFieldReady < 0.5) {
            throw new Error('ZEN_PIXI_WATER_SURFACE_FIELD_REQUIRED');
        }
        this.applyFeatureToggleUniforms(effectDebugToggles);
        const presentationSignature = buildPresentationSignature({
            width,
            height,
            intensityScale,
            filterRegion,
        });
        const requiresFullUpdate = (
            !this.lastProbe
            || updateOptions?.fullUpdate !== false
            || frameState !== this._lastPresentationFrameState
            || frameChannels !== this._lastPresentationFrameChannels
            || presentationSignature !== this._lastPresentationSignature
        );
        if (!requiresFullUpdate) {
            this.lastProbe.cloudReflectionEnabled = this.uniforms.uCloudReflectionEnabled > 0.5;
            this.lastProbe.yoonseulEnabled = this.uniforms.uYoonseulEnabled > 0.5;
            this.lastProbe.surfaceOpticsEnabled = this.uniforms.uSurfaceOpticsEnabled > 0.5;
            this.lastProbe.surfaceNormalEnabled = this.uniforms.uSurfaceNormalEnabled > 0.5;
            this.lastProbe.screenRefractionEnabled = this.uniforms.uScreenRefractionEnabled > 0.5;
            this.lastProbe.surfaceReflectionEnabled = this.uniforms.uSurfaceReflectionEnabled > 0.5;
            this.lastProbe.rgbSplitEnabled = this.uniforms.uRgbSplitEnabled > 0.5;
            this.lastProbe.surfaceFieldReady = true;
            this.lastProbe.surfaceFieldCausticsEnabled = this.surfaceFieldCausticsEnabled;
            this._lastSurfaceUniformFullUpdate = false;
            return this.lastProbe;
        }
        this.setCloudFieldSeed(frameState.frameEnv.cloudSeed);
        this.lastProbe = applyPixiWaterSurfaceFieldUniforms(this, {
            width,
            height,
            currentTuning,
            intensityScale,
            frameState,
            frameChannels,
            filterRegion,
        });
        this._lastPresentationFrameState = frameState;
        this._lastPresentationFrameChannels = frameChannels;
        this._lastPresentationSignature = presentationSignature;
        this._lastSurfaceUniformFullUpdate = true;
        return this.lastProbe;
    }

    destroy() {
        this.clearSurfaceFieldTexture();
        if (this.cloudFieldTexture) this.cloudFieldTexture.destroy(true);
        this.cloudFieldTexture = null;
        this.cloudFieldSeed = null;
        this.uniforms.uCloudField = Texture.EMPTY;
        this.lastProbe = null;
        this._lastPresentationFrameState = null;
        this._lastPresentationFrameChannels = null;
        this._lastPresentationSignature = '';
        super.destroy();
    }
}
