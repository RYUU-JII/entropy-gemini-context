import { ZEN_POND_CANOPY_CROWNS } from '../../../../contracts/zenPondCanopyMaterial.js';

const crownCount = ZEN_POND_CANOPY_CROWNS.length;

// WebGL1 retains the original authored inputs to native Shader.from byte-for-byte.
export const zenCanopyLightTransferVertexShader = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec4 aAtlasBounds;
attribute float aProjectionScale;
attribute float aCrownIndex;
uniform vec3 uCrownProjection[${crownCount}];
uniform vec2 uWindOffset;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vDirectUv;
varying vec2 vSkyUv;
varying vec4 vAtlasBounds;
varying float vSoftness;
void main(void) {
    vec3 crownProjection = uCrownProjection[int(aCrownIndex)];
    vDirectUv = aTextureCoord - (crownProjection.xy + uWindOffset) * aProjectionScale;
    vSkyUv = aTextureCoord - uWindOffset * aProjectionScale;
    vAtlasBounds = aAtlasBounds;
    vSoftness = crownProjection.z;
    vec3 p = projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0);
    gl_Position = vec4(p.xy, 0.0, 1.0);
}
`;

export const zenCanopyLightTransferFragmentShader = `
precision highp float;
varying vec2 vDirectUv;
varying vec2 vSkyUv;
varying vec4 vAtlasBounds;
varying float vSoftness;
uniform sampler2D uDirectOcclusion;
uniform sampler2D uSkyOcclusion;
uniform vec3 uDirectShare;
uniform vec3 uSkyShare;
uniform float uGapEnabled;
uniform float uTransferAmount;
float islandCoverage(vec2 uv) {
    vec2 inside = step(vAtlasBounds.xy, uv) * step(uv, vAtlasBounds.zw);
    return inside.x * inside.y;
}
void main(void) {
    // RG = crisp unpunched/punched; BA = soft unpunched/punched. One read
    // supplies both penumbras. Direct moves with the sun; diffuse stays put.
    vec4 leaf = texture2D(uDirectOcclusion, clamp(vDirectUv, vAtlasBounds.xy, vAtlasBounds.zw));
    vec2 visibility = mix(leaf.rg, leaf.ba, vSoftness);
    float directOcclusion = mix(visibility.x, visibility.y, uGapEnabled) * islandCoverage(vDirectUv);
    float skyOcclusion = texture2D(uSkyOcclusion, clamp(vSkyUv, vAtlasBounds.xy, vAtlasBounds.zw)).a * islandCoverage(vSkyUv);
    vec3 attenuation = directOcclusion * uDirectShare + skyOcclusion * uSkyShare;
    vec3 transfer = clamp(vec3(1.0) - attenuation * uTransferAmount, 0.0, 1.0);
    gl_FragColor = vec4(transfer, 1.0);
}
`;

const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_canopy_light_transfer\n';

// Preserve native Pixi's alphabetically bound GLSL100 attribute locations.
const vertex300 = GLSL_300_HEADER + zenCanopyLightTransferVertexShader
    .replace('attribute vec4 aAtlasBounds;', 'layout(location = 0) in vec4 aAtlasBounds;')
    .replace('attribute float aCrownIndex;', 'layout(location = 1) in float aCrownIndex;')
    .replace('attribute float aProjectionScale;', 'layout(location = 2) in float aProjectionScale;')
    .replace('attribute vec2 aTextureCoord;', 'layout(location = 3) in vec2 aTextureCoord;')
    .replace('attribute vec2 aVertexPosition;', 'layout(location = 4) in vec2 aVertexPosition;')
    .replace(/\bvarying\b/gu, 'out');

// Effective authored highp, both texture reads and all transfer math stay intact.
const fragment300 = GLSL_300_HEADER + zenCanopyLightTransferFragmentShader
    .replace(/\bvarying\b/gu, 'in')
    .replace(/\btexture2D\b/gu, 'texture')
    .replace(/\bgl_FragColor\b/gu, 'zenCanopyTransferColor')
    .replace('void main(void)', 'layout(location = 0) out vec4 zenCanopyTransferColor;\nvoid main(void)');

const sources100 = Object.freeze({
    vertex: zenCanopyLightTransferVertexShader,
    fragment: zenCanopyLightTransferFragmentShader,
    dialect: 'glsl_es_100',
});
const sources300 = Object.freeze({
    vertex: vertex300,
    fragment: fragment300,
    dialect: 'glsl_es_300',
});

// Select at creation from the actual admitted renderer; do not infer capability.
export const resolveZenCanopyLightTransferShaderSources = (webGLVersion) => {
    if (webGLVersion === 1) return sources100;
    if (webGLVersion === 2) return sources300;
    throw new Error('ZEN_CANOPY_LIGHT_TRANSFER_WEBGL_VERSION_INVALID');
};
