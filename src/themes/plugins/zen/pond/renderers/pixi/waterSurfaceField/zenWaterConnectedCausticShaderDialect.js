const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_water_connected_caustic\n';

// The connected bottom receiver alone owns this representation change. Shared
// caustic equations, uniforms, UV projection and texture reads stay identical.
export const resolveZenWaterConnectedCausticShaderSources = ({
    webGLVersion,
    vertexSrc,
    fragmentSrc,
} = {}) => {
    if (webGLVersion !== 1 && webGLVersion !== 2) {
        throw new Error('ZEN_CONNECTED_CAUSTIC_WEBGL_VERSION_INVALID');
    }
    if (
        typeof vertexSrc !== 'string'
        || typeof fragmentSrc !== 'string'
        || !vertexSrc.trimStart().startsWith('precision highp float;')
        || !fragmentSrc.trimStart().startsWith('precision highp float;')
        || !vertexSrc.includes('attribute vec2 aVertexPosition;')
        || !vertexSrc.includes('attribute vec2 aTextureCoord;')
        || vertexSrc.match(/^\s*attribute\s+/gm)?.length !== 2
        || !vertexSrc.includes('varying vec2 vTextureCoord;')
        || !fragmentSrc.includes('varying vec2 vTextureCoord;')
        || vertexSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || fragmentSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || !fragmentSrc.includes('gl_FragColor')
        || /^\s*#\s*version\b/m.test(vertexSrc)
        || /^\s*#\s*version\b/m.test(fragmentSrc)
    ) {
        throw new Error('ZEN_CONNECTED_CAUSTIC_SHADER_SOURCE_INVALID');
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
        .replace('varying vec2 vTextureCoord;', 'out vec2 vTextureCoord;');
    const fragment = GLSL_300_HEADER + fragmentSrc
        .replace('varying vec2 vTextureCoord;', 'in vec2 vTextureCoord;\nlayout(location = 0) out vec4 zenConnectedCausticColor;')
        .replace(/\btexture2D\b/g, 'texture')
        .replace(/\bgl_FragColor\b/g, 'zenConnectedCausticColor');

    return Object.freeze({ vertex, fragment, dialect: 'glsl_es_300' });
};
