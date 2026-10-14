const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_water_light_transport\n';

// Only the canopy-to-water map changes representation. The authored crown
// expansion, atlas samples, precision and transmission equations stay intact.
export const resolveZenWaterLightTransportShaderSources = ({
    webGLVersion,
    vertexSrc,
    fragmentSrc,
} = {}) => {
    if (webGLVersion !== 1 && webGLVersion !== 2) {
        throw new Error('ZEN_WATER_LIGHT_TRANSPORT_WEBGL_VERSION_INVALID');
    }
    if (
        typeof vertexSrc !== 'string'
        || typeof fragmentSrc !== 'string'
        || !vertexSrc.trimStart().startsWith('precision highp float;')
        || !fragmentSrc.trimStart().startsWith('precision highp float;')
        || !vertexSrc.includes('attribute vec2 aVertexPosition;')
        || !vertexSrc.includes('attribute vec2 aTextureCoord;')
        || vertexSrc.match(/^\s*attribute\s+/gm)?.length !== 2
        || !vertexSrc.includes('varying vec2 vUv;')
        || !fragmentSrc.includes('varying vec2 vUv;')
        || vertexSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || fragmentSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || !fragmentSrc.includes('gl_FragColor')
        || /^\s*#\s*version\b/m.test(vertexSrc)
        || /^\s*#\s*version\b/m.test(fragmentSrc)
    ) {
        throw new Error('ZEN_WATER_LIGHT_TRANSPORT_SHADER_SOURCE_INVALID');
    }
    if (webGLVersion === 1) {
        return Object.freeze({
            vertex: vertexSrc,
            fragment: fragmentSrc,
            dialect: 'glsl_es_100',
        });
    }

    // Match Pixi 7's existing alphabetical GLSL100 attribute locations.
    const vertex = GLSL_300_HEADER + vertexSrc
        .replace('attribute vec2 aTextureCoord;', 'layout(location = 0) in vec2 aTextureCoord;')
        .replace('attribute vec2 aVertexPosition;', 'layout(location = 1) in vec2 aVertexPosition;')
        .replace('varying vec2 vUv;', 'out vec2 vUv;');
    const fragment = GLSL_300_HEADER + fragmentSrc
        .replace('varying vec2 vUv;', 'in vec2 vUv;\nlayout(location = 0) out vec4 zenWaterLightTransportColor;')
        .replace(/\btexture2D\b/g, 'texture')
        .replace(/\bgl_FragColor\b/g, 'zenWaterLightTransportColor');

    return Object.freeze({ vertex, fragment, dialect: 'glsl_es_300' });
};
