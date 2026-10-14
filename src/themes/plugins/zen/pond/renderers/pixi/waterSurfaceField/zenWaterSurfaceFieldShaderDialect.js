import { zenWaterSurfaceFieldFragmentShader } from './zenWaterSurfaceFieldShader.js';

// Keep the supported WebGL1 source byte-for-byte identical to the original field.
export const zenWaterSurfaceFieldVertexShader = `
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

const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_water_surface_field\n';

// These locations preserve Pixi 7's alphabetically bound GLSL100 locations.
const vertex300 = GLSL_300_HEADER + zenWaterSurfaceFieldVertexShader
    .replace('attribute vec2 aVertexPosition;', 'layout(location = 1) in vec2 aVertexPosition;')
    .replace('attribute vec2 aTextureCoord;', 'layout(location = 0) in vec2 aTextureCoord;')
    .replace('varying vec2 vTextureCoord;', 'out vec2 vTextureCoord;');

// Only this authored field is adapted: the arithmetic and uniform contract stay
// identical. `sample` and `active` are reserved identifiers in GLSL ES 3.00.
const fragment300 = GLSL_300_HEADER + zenWaterSurfaceFieldFragmentShader
    .replace('varying vec2 vTextureCoord;', 'in vec2 vTextureCoord;\nlayout(location = 0) out vec4 wsFragColor;')
    .replace(/\bgl_FragColor\b/g, 'wsFragColor')
    .replace(/\bsample\b/g, 'wsSample')
    .replace(/\bactive\b/g, 'wsActive');

const sources100 = Object.freeze({
    vertex: zenWaterSurfaceFieldVertexShader,
    fragment: zenWaterSurfaceFieldFragmentShader,
    dialect: 'glsl_es_100',
});
const sources300 = Object.freeze({
    vertex: vertex300,
    fragment: fragment300,
    dialect: 'glsl_es_300',
});

// Pixi owns context creation. Select once from its actual admitted context;
// missing capability is an error rather than an inferred platform substitution.
export const resolveZenWaterSurfaceFieldShaderSources = (webGLVersion) => {
    if (webGLVersion === 1) return sources100;
    if (webGLVersion === 2) return sources300;
    throw new Error('ZEN_WATER_SURFACE_FIELD_WEBGL_VERSION_INVALID');
};
