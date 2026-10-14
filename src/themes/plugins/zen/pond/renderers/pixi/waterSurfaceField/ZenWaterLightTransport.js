import { BLEND_MODES, Geometry, Mesh, RenderTexture, SCALE_MODES, Shader, Texture } from '../zenPondPixiRuntime.js';
import {
    ZEN_POND_CANOPY_CROWNS, ZEN_POND_CANOPY_DIRECT_OCCLUSION,
    ZEN_POND_CANOPY_SKY_OCCLUSION, ZEN_POND_CANOPY_TEXTURE_SIZE,
} from '../../../contracts/zenPondCanopyMaterial.js';
import { resolveZenWaterLightTransportShaderSources } from './zenWaterLightTransportShaderDialect.js';

const count = ZEN_POND_CANOPY_CROWNS.length;
const vertex = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main() {
    vUv = aTextureCoord;
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

export const zenWaterLightTransportFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uDirectOcclusion;
uniform sampler2D uSkyOcclusion;
uniform vec4 uBounds;
uniform vec4 uLayout[${count}];
uniform vec3 uCrownProjection[${count}];
uniform vec2 uWindOffset;
uniform vec3 uDirectShare;
uniform vec3 uSkyShare;
uniform float uGapEnabled;
uniform float uAmount;
void main() {
    vec2 world = uBounds.xy + vUv * uBounds.zw;
    vec3 transmission = vec3(1.0);
    vec3 composite = vec3(1.0);
    ${ZEN_POND_CANOPY_CROWNS.map((crown, i) => {
        const half = 0.5 / ZEN_POND_CANOPY_TEXTURE_SIZE;
        const bounds = crown.atlas.map((v, j) => (v + (j < 2 ? half : -half)).toFixed(8));
        return `{
        vec4 atlas = vec4(${bounds.join(', ')});
        vec2 uv = (world - uLayout[${i}].xy) * uLayout[${i}].z + uLayout[${i}].ww;
        // Layout.w stores only U; V is authored separately for each island.
        uv.y += ${(crown.atlas[1] - crown.atlas[0]).toFixed(8)};
        vec2 directUv = uv - (uCrownProjection[${i}].xy + uWindOffset) * uLayout[${i}].z;
        vec2 skyUv = uv - uWindOffset * uLayout[${i}].z;
        vec2 directInside = step(atlas.xy, directUv) * step(directUv, atlas.zw);
        vec2 skyInside = step(atlas.xy, skyUv) * step(skyUv, atlas.zw);
        float directMask = 0.0;
        float broadMask = 0.0;
        float skyMask = 0.0;
        if (directInside.x * directInside.y > 0.5) {
            vec4 leaf = texture2D(uDirectOcclusion, clamp(directUv, atlas.xy, atlas.zw));
            vec2 penumbra = mix(leaf.rg, leaf.ba, uCrownProjection[${i}].z);
            directMask = mix(penumbra.x, penumbra.y, uGapEnabled);
            broadMask = mix(leaf.b, leaf.a, uGapEnabled);
        }
        if (skyInside.x * skyInside.y > 0.5) {
            skyMask = texture2D(uSkyOcclusion, clamp(skyUv, atlas.xy, atlas.zw)).a;
        }
        transmission *= vec3(1.0) - vec3(directMask, broadMask, skyMask)
            * vec3(${ZEN_POND_CANOPY_DIRECT_OCCLUSION}, ${ZEN_POND_CANOPY_DIRECT_OCCLUSION}, ${ZEN_POND_CANOPY_SKY_OCCLUSION}) * uAmount;
        composite *= vec3(1.0) - (directMask * uDirectShare + skyMask * uSkyShare) * uAmount;
    }`;
    }).join('\n')}
    gl_FragColor = vec4(transmission, dot(composite, vec3(0.2126, 0.7152, 0.0722)));
}`;

export const createZenWaterLightTransportUniforms = () => ({
    uWaterLightTransport: Texture.EMPTY,
    uWaterLightTransportReady: 0,
    uWaterLightBounds: new Float32Array([0, 0, 1, 1]),
});

export const bindZenWaterLightTransport = (uniforms, transport) => {
    uniforms.uWaterLightTransportReady = transport?.active === true ? 1 : 0;
    uniforms.uWaterLightTransport = transport?.active === true ? transport.texture : Texture.EMPTY;
    if (transport?.active === true) uniforms.uWaterLightBounds = transport.worldBounds;
};

// One 256-long-edge RGBA8 map, refreshed only when the existing canopy pass
// changes its presentation. No new clock, readback, foliage bake or blur pass.
export class ZenWaterLightTransport {
    constructor(renderer) {
        const sources = resolveZenWaterLightTransportShaderSources({
            webGLVersion: renderer?.context?.webGLVersion,
            vertexSrc: vertex,
            fragmentSrc: zenWaterLightTransportFragment,
        });
        this.renderer = renderer;
        this.texture = RenderTexture.create({ width: 1, height: 1, resolution: 1 });
        this.texture.baseTexture.scaleMode = SCALE_MODES.LINEAR;
        this.geometry = new Geometry()
            .addAttribute('aVertexPosition', [0, 0, 1, 0, 1, 1, 0, 1], 2)
            .addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2)
            .addIndex([0, 1, 2, 0, 2, 3]);
        this.shader = Shader.from(sources.vertex, sources.fragment, {
            uDirectOcclusion: Texture.EMPTY, uSkyOcclusion: Texture.EMPTY,
            uBounds: new Float32Array(4), uLayout: new Float32Array(count * 4),
            uCrownProjection: new Float32Array(count * 3), uWindOffset: [0, 0],
            uDirectShare: [0, 0, 0], uSkyShare: [0, 0, 0], uGapEnabled: 0, uAmount: 0,
        });
        this.mesh = new Mesh(this.geometry, this.shader);
        this.mesh.size = 6;
        this.mesh.blendMode = BLEND_MODES.NONE;
        this.worldBounds = new Float32Array(4);
        this.active = false;
        this.signature = '';
        this.source = null;
        this.drawCount = 0;
    }

    update(source, bounds, worldWidth, worldHeight) {
        this.drawCount = 0;
        this.active = false;
        if (source === null || source.visible === false) return;
        const state = source.shader?.uniforms;
        if (!state?.uDirectOcclusion || !state?.uSkyOcclusion || !state?.uCrownProjection
            || source.canopyLayouts?.length !== count) {
            throw new Error('ZEN_WATER_CANOPY_OPTICAL_SOURCE_INVALID');
        }
        let amount = 1;
        for (let node = source; node; node = node.parent) {
            if (!node.visible || !node.renderable) return;
            amount *= node.alpha;
        }
        if (amount <= 0.001) return;
        const signature = [source.canopyLayoutKey, bounds.x, bounds.y, bounds.width, bounds.height, worldWidth, worldHeight,
            amount, state.uGapEnabled, ...state.uCrownProjection, ...state.uWindOffset,
            ...state.uDirectShare, ...state.uSkyShare].join('|');
        this.active = true;
        if (this.source === source && this.signature === signature
            && this.shader.uniforms.uDirectOcclusion === state.uDirectOcclusion
            && this.shader.uniforms.uSkyOcclusion === state.uSkyOcclusion) return;
        const layouts = source.canopyLayouts;
        const guard = 64 + Math.min(bounds.width, bounds.height) * 0.16;
        const width = bounds.width + guard * 2;
        const height = bounds.height + guard * 2;
        const scale = 256 / Math.max(width, height);
        const w = Math.ceil(width * scale), h = Math.ceil(height * scale);
        if (this.texture.width !== w || this.texture.height !== h) {
            this.texture.resize(w, h, true);
            this.geometry.getBuffer('aVertexPosition').update(new Float32Array([0, 0, w, 0, w, h, 0, h]));
        }
        const u = this.shader.uniforms;
        u.uBounds.set([bounds.x - guard, bounds.y - guard, width, height]);
        this.worldBounds.set([(bounds.x - guard) / worldWidth, (bounds.y - guard) / worldHeight,
            width / worldWidth, height / worldHeight]);
        layouts.forEach((layout, i) => {
            u.uLayout.set([layout.x, layout.y, (layout.atlas[2] - layout.atlas[0]) / layout.size, layout.atlas[0]], i * 4);
        });
        u.uDirectOcclusion = state.uDirectOcclusion;
        u.uSkyOcclusion = state.uSkyOcclusion;
        u.uCrownProjection = state.uCrownProjection;
        u.uWindOffset = state.uWindOffset;
        u.uDirectShare = state.uDirectShare;
        u.uSkyShare = state.uSkyShare;
        u.uGapEnabled = state.uGapEnabled;
        u.uAmount = amount;
        this.renderer.render(this.mesh, { renderTexture: this.texture, clear: true });
        this.source = source;
        this.signature = signature;
        this.drawCount = 1;
    }

    destroy() {
        this.active = false;
        this.mesh.destroy();
        this.shader.destroy();
        this.geometry.destroy();
        this.texture.destroy(true);
        this.source = null;
    }
}
