const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_water_surface_field_filter\n';

// Adapt the public native Filter vertex and the selected authored consumer only.
// Native filter UV/crop math and the complete fragment equations stay intact.
export const resolveZenWaterSurfaceFieldFilterShaderSources = ({
    webGLVersion,
    vertexSrc,
    fragmentSrc,
} = {}) => {
    if (webGLVersion === 1) {
        return Object.freeze({
            vertex: null,
            fragment: fragmentSrc,
            dialect: 'glsl_es_100',
        });
    }
    if (webGLVersion !== 2) {
        throw new Error('ZEN_WATER_SURFACE_FIELD_FILTER_WEBGL_VERSION_INVALID');
    }
    if (
        typeof vertexSrc !== 'string'
        || typeof fragmentSrc !== 'string'
        || !vertexSrc.includes('attribute vec2 aVertexPosition;')
        || !vertexSrc.includes('varying vec2 vTextureCoord;')
        || vertexSrc.match(/^\s*attribute\s+/gm)?.length !== 1
        || vertexSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || !fragmentSrc.trimStart().startsWith('precision highp float;')
        || !fragmentSrc.includes('varying vec2 vTextureCoord;')
        || fragmentSrc.match(/^\s*varying\s+/gm)?.length !== 1
        || !fragmentSrc.includes('gl_FragColor')
        || /^\s*#\s*version\b/m.test(vertexSrc)
        || /^\s*#\s*version\b/m.test(fragmentSrc)
    ) {
        throw new Error('ZEN_WATER_SURFACE_FIELD_FILTER_SHADER_SOURCE_INVALID');
    }

    // The native default vertex receives highp from Program preparation. The
    // authored fragment already declares highp after native's default precision.
    const vertex = GLSL_300_HEADER + 'precision highp float;\n' + vertexSrc
        .replace('attribute vec2 aVertexPosition;', 'layout(location = 0) in vec2 aVertexPosition;')
        .replace('varying vec2 vTextureCoord;', 'out vec2 vTextureCoord;');
    const fragment = GLSL_300_HEADER + fragmentSrc
        .replace('varying vec2 vTextureCoord;', 'in vec2 vTextureCoord;\nlayout(location = 0) out vec4 wsSurfaceFilterColor;')
        .replace(/\btexture2D\b/g, 'texture')
        .replace(/\bgl_FragColor\b/g, 'wsSurfaceFilterColor');

    return Object.freeze({ vertex, fragment, dialect: 'glsl_es_300' });
};
