import { zenWaterCausticReceiverShader } from './zenWaterCausticReceiverShader.js';
import { ZEN_POND_SHADOW_DEPTH_WORLD_UNITS } from '../../../contracts/zenPondShadowGeometry.js';
import { createZenWaterLightTransportUniforms } from './ZenWaterLightTransport.js';
import { Shader, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    ZenWaterBenthicCausticOverlay,
} from './ZenWaterBenthicCausticOverlay.js';
import {
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS,
} from '../../../contracts/zenPondCausticPresentation.js';
import {
    createZenPondBenthicReceiverTexture,
} from './ZenPondBenthicReceiverTexture.js';
import {
    resolveZenWaterConnectedCausticShaderSources,
} from './zenWaterConnectedCausticShaderDialect.js';

const CONNECTED_CAUSTIC_MODEL_ID =
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_IDS.CONNECTED_SUNWEB;

const requireTextureExtent = (texture, axis) => {
    const numeric = Number(texture?.[axis]);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(
            `ZEN_CONNECTED_CAUSTIC_SURFACE_FIELD_${axis.toUpperCase()}_INVALID`,
        );
    }
    return numeric;
};

const VERTEX_SHADER = `
precision highp float;

attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vTextureCoord;

void main(void) {
    vTextureCoord = aTextureCoord;
    vec3 position = projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0);
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const zenWaterConnectedCausticFragmentShader = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uBenthicReceiver;
uniform float uBenthicReceiverReady;
${zenWaterCausticReceiverShader}

vec3 decodeReceiverNormal(vec4 receiverSample) {
    vec2 xy = receiverSample.gb * 2.0 - 1.0;
    return normalize(vec3(xy, sqrt(max(0.08, 1.0 - dot(xy, xy)))));
}

void main(void) {
    if (uSurfaceFieldReady < 0.5 || uBenthicReceiverReady < 0.5 || uCausticStrength <= 0.0001) {
        gl_FragColor = vec4(0.0);
        return;
    }
    vec4 receiver = texture2D(uBenthicReceiver, vTextureCoord);
    if (receiver.a <= 0.001) { gl_FragColor = vec4(0.0); return; }
    gl_FragColor = sampleZenWaterCaustic(vTextureCoord, receiver.r, decodeReceiverNormal(receiver)) * receiver.a;
}
`;

export class ZenWaterConnectedCausticOverlay extends ZenWaterBenthicCausticOverlay {
    constructor(options = {}) {
        const shaderSources = resolveZenWaterConnectedCausticShaderSources({
            webGLVersion: options.webGLVersion,
            vertexSrc: VERTEX_SHADER,
            fragmentSrc: zenWaterConnectedCausticFragmentShader,
        });
        super(options);
        const width = Math.max(1, Number(options.width) || 1);
        const height = Math.max(1, Number(options.height) || 1);
        this.benthicReceiver =
            createZenPondBenthicReceiverTexture({
                bathymetryField: options.bathymetryField,
            });
        const productShader = this.shader;
        this.shader = Shader.from(
            shaderSources.vertex,
            shaderSources.fragment,
            {
                uSurfaceField: Texture.EMPTY,
                uSurfaceFieldReady: 0,
                uFieldTexel: [1 / width, 1 / height],
                uBenthicReceiver:
                    this.benthicReceiver.texture,
                uBenthicReceiverReady: 1,
                uSunDir: [0.24, 0.12, 0.96],
                uLightColor: [1, 0.93, 0.7],
                uCausticStrength: 0,
                uWorldAspect: width / height,
                uRefractedSun: [0, 0, -1],
                uTurbidity: 0,
                uOpticalDepthScale: ZEN_POND_SHADOW_DEPTH_WORLD_UNITS / height,
                uSurfaceFieldMap: [1, 1, 0, 0],
                ...createZenWaterLightTransportUniforms(),
            },
        );
        this.mesh.shader = this.shader;
        productShader.destroy();
    }

    update(options = {}) {
        const probe = super.update(options);
        if (probe.active !== true) {
            return {
                ...probe,
                modelId: CONNECTED_CAUSTIC_MODEL_ID,
                receiverModelId:
                    this.benthicReceiver.metadata.modelId,
                receiverTextureFetchesPerPixel: 0,
                totalTextureFetchesPerPixel: 0,
            };
        }
        const fieldWidth = requireTextureExtent(
            options.texture,
            'width',
        );
        const fieldHeight = requireTextureExtent(
            options.texture,
            'height',
        );
        const uniforms = this.shader.uniforms;
        const turbidity = options.frameState.channels.waterMedium.turbidity;
        if (!Number.isFinite(turbidity)) throw new Error('ZEN_CONNECTED_CAUSTIC_TURBIDITY_INVALID');
        uniforms.uTurbidity = Math.min(1, Math.max(0, turbidity));
        const light = options.frameChannels.shadowLight;
        if (!Number.isFinite(light?.submergedSunX) || !Number.isFinite(light?.submergedSunY) || !Number.isFinite(light?.submergedSunZ)) {
            throw new Error('ZEN_CONNECTED_CAUSTIC_REFRACTION_REQUIRED');
        }
        uniforms.uRefractedSun[0] = -light.submergedSunX;
        uniforms.uRefractedSun[1] = -light.submergedSunY;
        uniforms.uRefractedSun[2] = -light.submergedSunZ;
        this.shader.uniforms.uFieldTexel[0] = 1 / (fieldWidth * uniforms.uSurfaceFieldMap[0]);
        this.shader.uniforms.uFieldTexel[1] = 1 / (fieldHeight * uniforms.uSurfaceFieldMap[1]);
        const strength = Math.min(0.165, Math.max(0, Number(probe.strength) || 0) * 1.6);
        this.shader.uniforms.uCausticStrength = strength;
        return {
            ...probe,
            modelId: CONNECTED_CAUSTIC_MODEL_ID,
            strength,
            fieldTextureFetchesPerPixel: 5,
            receiverModelId:
                this.benthicReceiver.metadata.modelId,
            receiverTextureFetchesPerPixel: 1,
            totalTextureFetchesPerPixel: 6,
        };
    }

    destroy() {
        if (this.benthicReceiver) {
            this.shader.uniforms.uBenthicReceiver =
                Texture.EMPTY;
            this.shader.uniforms.uBenthicReceiverReady = 0;
            this.benthicReceiver.texture.destroy(true);
            this.benthicReceiver = null;
        }
        super.destroy();
    }
}
