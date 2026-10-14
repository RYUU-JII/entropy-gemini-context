import {
    BLEND_MODES,
    Geometry,
    Mesh,
    Shader,
    Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    ZEN_POND_CAUSTIC_FOCUS_RESPONSE,
    ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF,
    ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON,
    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID,
    ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_CAP,
    ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_SCALE,
    resolveZenPondCausticPresentationGate,
    resolveZenPondCausticCurvatureScale,
} from '../../../contracts/zenPondCausticPresentation.js';
import { assertPixiFrameContract } from '../pixiFrameChannels.js';
import { zenWaterSurfaceDomainShader } from './zenWaterOpticalDomain.js';
import { resolveZenPixiOwnedShaderSources } from '../../../../runtime/pixi/zenPixiOwnedShaderDialect.js';

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

export const zenWaterBenthicCausticFragmentShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSurfaceField;
uniform float uSurfaceFieldReady;
uniform vec3 uSunDir;
uniform vec3 uLightColor;
uniform float uCausticStrength;
uniform float uCurvatureScale;
${zenWaterSurfaceDomainShader}

const float WS_SLOPE_RANGE = 5.0;

void main(void) {
    if (uSurfaceFieldReady < 0.5 || uCausticStrength <= 0.0001) {
        gl_FragColor = vec4(0.0);
        return;
    }
    vec4 fieldSample = texture2D(uSurfaceField, surfaceFieldUv(vTextureCoord));
    vec2 slope = (fieldSample.rg * 2.0 - 1.0) * WS_SLOPE_RANGE;
    vec3 normal = normalize(vec3(-slope * 0.18, 1.0));
    // Recover the calibrated curvature before the focus ramp. The field owns
    // texel-scaled encoding; increasing a square field from 216 to 288 must not
    // reduce these underwater filaments to 56% of their original input.
    float curvature = (fieldSample.a * 2.0 - 1.0) * uCurvatureScale;
    // Negative height curvature converges the downward refracted rays.
    float ridge = smoothstep(${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.ridgeStart}, ${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.ridgeEnd}, -curvature);
    // Lift only coherent filament cores. The weak halo and empty/divergent
    // water keep the same response, separating bottom bands from surface glints
    // without another sample, a broad light wash or an independent motion clock.
    float coreFilament = smoothstep(${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.coreStart}, ${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.coreEnd}, ridge);
    float focusedCore = coreFilament * coreFilament;
    float haloSupport = ridge * ${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.haloWeight};
    float troughFocus = focusedCore * ${ZEN_POND_CAUSTIC_FOCUS_RESPONSE.coreWeight} + haloSupport;
    float facingLight = smoothstep(0.06, 0.66, dot(normal, uSunDir));
    float amount = troughFocus * facingLight * uCausticStrength;
    vec3 causticColor = mix(vec3(0.78, 0.9, 1.0), uLightColor, facingLight);
    gl_FragColor = vec4(causticColor * amount, amount);
}
`;

const requireFinite = (value, fieldName) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`ZEN_BENTHIC_CAUSTIC_CHANNEL_MISSING:${fieldName}`);
    }
    return numeric;
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeVec3 = (x, y, z) => {
    const length = Math.hypot(x, y, z);
    if (!Number.isFinite(length) || length <= 1e-6) {
        throw new Error('ZEN_BENTHIC_CAUSTIC_SUN_DIRECTION_INVALID');
    }
    return [x / length, y / length, z / length];
};

export class ZenWaterBenthicCausticOverlay {
    constructor({ container, width, height, webGLVersion } = {}) {
        const sources = resolveZenPixiOwnedShaderSources({
            programId: 'benthic_caustic_comparison',
            webGLVersion,
            vertexSrc: VERTEX_SHADER,
            fragmentSrc: zenWaterBenthicCausticFragmentShader,
        });
        if (!container || typeof container.addChild !== 'function') {
            throw new Error('ZEN_BENTHIC_CAUSTIC_CONTAINER_MISSING');
        }
        const sceneWidth = Math.max(1, Math.round(requireFinite(width, 'width')));
        const sceneHeight = Math.max(1, Math.round(requireFinite(height, 'height')));
        this.geometry = new Geometry()
            .addAttribute('aVertexPosition', [
                0, 0,
                sceneWidth, 0,
                sceneWidth, sceneHeight,
                0, sceneHeight,
            ], 2)
            .addAttribute('aTextureCoord', [
                0, 0,
                1, 0,
                1, 1,
                0, 1,
            ], 2)
            .addIndex([0, 1, 2, 0, 2, 3]);
        this.shader = Shader.from(sources.vertex, sources.fragment, {
            uSurfaceField: Texture.EMPTY,
            uSurfaceFieldReady: 0,
            uSurfaceFieldMap: [1, 1, 0, 0],
            uSunDir: [0.24, 0.12, 0.96],
            uLightColor: [1, 0.93, 0.7],
            uCausticStrength: 0,
            uCurvatureScale: 1,
        });
        this.mesh = new Mesh(this.geometry, this.shader);
        this.mesh.size = 6;
        this.mesh.blendMode = BLEND_MODES.SCREEN;
        this.mesh.visible = false;
        container.addChild(this.mesh);
        this.presentationVisible = null;
        this.presentationTransitionCount = 0;
        this.disposed = false;
    }

    disable() {
        if (this.disposed) {
            throw new Error(
                'ZEN_BENTHIC_CAUSTIC_OVERLAY_DISPOSED',
            );
        }
        this.presentationVisible = null;
        this.mesh.visible = false;
        this.shader.uniforms.uSurfaceFieldReady = 0;
        this.shader.uniforms.uCausticStrength = 0;
    }

    update({
        texture,
        frameState,
        frameChannels,
        enabled = false,
        intensityScale = 1,
    } = {}) {
        if (this.disposed) throw new Error('ZEN_BENTHIC_CAUSTIC_OVERLAY_DISPOSED');
        const resolvedFrameState = assertPixiFrameContract(frameState);
        if (!frameChannels || frameChannels.channels !== resolvedFrameState.channels) {
            throw new Error('ZEN_BENTHIC_CAUSTIC_FRAME_CONTRACT_MISSING');
        }
        if (!texture || texture.destroyed === true) {
            throw new Error('ZEN_BENTHIC_CAUSTIC_SURFACE_FIELD_MISSING');
        }
        const requested = enabled === true;
        if (!requested) {
            this.disable();
            return {
                modelId:
                    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID,
                requested: false,
                active: false,
                suppressed: false,
                requestedStrength: 0,
                strength: 0,
                drawCount: 0,
                fieldTextureFetchesPerPixel: 0,
                gateOff:
                    ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF,
                gateOn:
                    ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON,
                gateTransitionCount:
                    this.presentationTransitionCount,
            };
        }

        const requestedStrength = clampNumber(
            requireFinite(resolvedFrameState.channels.lighting.causticStrength, 'lighting.causticStrength')
            * clampNumber(requireFinite(intensityScale, 'intensityScale'), 0, 2)
            * ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_SCALE,
            0,
            ZEN_POND_CAUSTIC_PRESENTATION_STRENGTH_CAP,
        );
        const previousVisible = this.presentationVisible;
        const gate = resolveZenPondCausticPresentationGate({
            previousVisible,
            requestedStrength,
        });
        this.presentationVisible = gate.visible;
        if (gate.transitioned) {
            this.presentationTransitionCount += 1;
        }
        const active = this.presentationVisible === true;
        if (!active) {
            this.mesh.visible = false;
            this.shader.uniforms.uSurfaceFieldReady = 0;
            this.shader.uniforms.uCausticStrength = 0;
            return {
                modelId:
                    ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID,
                requested: true,
                active: false,
                suppressed: true,
                requestedStrength,
                strength: 0,
                drawCount: 0,
                fieldTextureFetchesPerPixel: 0,
                gateOff:
                    ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF,
                gateOn:
                    ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON,
                gateTransitionCount:
                    this.presentationTransitionCount,
            };
        }

        const sunDirection = normalizeVec3(
            requireFinite(resolvedFrameState.frameEnv.sunDirectionX, 'frameEnv.sunDirectionX'),
            requireFinite(resolvedFrameState.frameEnv.sunDirectionY, 'frameEnv.sunDirectionY'),
            requireFinite(resolvedFrameState.frameEnv.sunDirectionZ, 'frameEnv.sunDirectionZ'),
        );
        const lightChannels = frameChannels.lightChannels;
        const uniforms = this.shader.uniforms;
        // The connected receiver replaces this shader and derives convergence
        // directly from normals; only the product curvature projection uses it.
        if (uniforms.uCurvatureScale !== undefined) {
            uniforms.uCurvatureScale = resolveZenPondCausticCurvatureScale(texture.height * uniforms.uSurfaceFieldMap[1]);
        }
        this.mesh.visible = true;
        uniforms.uSurfaceField = texture;
        uniforms.uSurfaceFieldReady = 1;
        uniforms.uSunDir[0] = sunDirection[0];
        uniforms.uSunDir[1] = sunDirection[1];
        uniforms.uSunDir[2] = sunDirection[2];
        uniforms.uLightColor[0] = clampNumber(
            requireFinite(lightChannels?.r, 'lightChannels.r') / 255,
            0,
            1.2,
        );
        uniforms.uLightColor[1] = clampNumber(
            requireFinite(lightChannels?.g, 'lightChannels.g') / 255,
            0,
            1.2,
        );
        uniforms.uLightColor[2] = clampNumber(
            requireFinite(lightChannels?.b, 'lightChannels.b') / 255,
            0,
            1.2,
        );
        uniforms.uCausticStrength = requestedStrength;
        return {
            modelId: ZEN_POND_CAUSTIC_PRESENTATION_MODEL_ID,
            requested: true,
            active: true,
            suppressed: false,
            requestedStrength,
            strength: requestedStrength,
            drawCount: 1,
            fieldTextureFetchesPerPixel: 1,
            gateOff: ZEN_POND_CAUSTIC_PRESENTATION_GATE_OFF,
            gateOn: ZEN_POND_CAUSTIC_PRESENTATION_GATE_ON,
            gateTransitionCount:
                this.presentationTransitionCount,
        };
    }

    destroy() {
        if (this.disposed) return;
        this.disposed = true;
        this.mesh.parent?.removeChild(this.mesh);
        this.mesh.destroy();
        this.shader.destroy();
        this.geometry.destroy();
    }
}
