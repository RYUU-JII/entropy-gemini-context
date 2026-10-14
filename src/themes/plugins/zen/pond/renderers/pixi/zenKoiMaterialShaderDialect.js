const GLSL_300_HEADER = '#version 300 es\n#define SHADER_NAME zen_koi_material\n';
const BODY_ATTRIBUTES = ['aKoiAcross', 'aTextureCoord', 'aVertexPosition'];
const BODY_VARYINGS = [
    ['vec2', 'vUv'],
    ['vec2', 'vAcross'],
    ['vec3', 'vHalfLight'],
    ['vec3', 'vMoonHalfLight'],
    ['vec2', 'vReceiverUv'],
];

export const requireZenKoiMaterialWebGLVersion = (webGLVersion) => {
    if (webGLVersion !== 1 && webGLVersion !== 2) {
        throw new Error('ZEN_KOI_MATERIAL_WEBGL_VERSION_INVALID');
    }
    return webGLVersion;
};

// Only the body material is adapted. Shadow shaders retain their native source
// path; all body arithmetic, UVs, uniforms and texture reads remain authored.
export const resolveZenKoiMaterialShaderSources = ({
    webGLVersion,
    vertexSrc,
    fragmentSrc,
} = {}) => {
    requireZenKoiMaterialWebGLVersion(webGLVersion);
    if (webGLVersion === 1) {
        return Object.freeze({
            vertex: vertexSrc,
            fragment: fragmentSrc,
            dialect: 'glsl_es_100',
        });
    }
    if (
        typeof vertexSrc !== 'string'
        || typeof fragmentSrc !== 'string'
        || !vertexSrc.trimStart().startsWith('precision highp float;')
        || !fragmentSrc.trimStart().startsWith('precision highp float;')
        || vertexSrc.match(/^\s*attribute\s+/gm)?.length !== BODY_ATTRIBUTES.length
        || vertexSrc.match(/^\s*varying\s+/gm)?.length !== BODY_VARYINGS.length
        || fragmentSrc.match(/^\s*varying\s+/gm)?.length !== BODY_VARYINGS.length
        || !BODY_ATTRIBUTES.every(name => vertexSrc.includes(`attribute vec2 ${name};`))
        || !BODY_VARYINGS.every(([type, name]) => (
            vertexSrc.includes(`varying ${type} ${name};`)
            && fragmentSrc.includes(`varying ${type} ${name};`)
        ))
        || !fragmentSrc.includes('void main()')
        || !fragmentSrc.includes('gl_FragColor')
        || /^\s*#\s*version\b/m.test(vertexSrc)
        || /^\s*#\s*version\b/m.test(fragmentSrc)
    ) {
        throw new Error('ZEN_KOI_MATERIAL_SHADER_SOURCE_INVALID');
    }

    // Preserve Pixi 7's alphabetical native GLSL100 attribute locations.
    let vertex = vertexSrc;
    BODY_ATTRIBUTES.forEach((name, location) => {
        vertex = vertex.replace(
            `attribute vec2 ${name};`,
            `layout(location = ${location}) in vec2 ${name};`,
        );
    });
    vertex = GLSL_300_HEADER + vertex.replace(/\bvarying\b/g, 'out');
    const fragment = GLSL_300_HEADER + fragmentSrc
        .replace(/\bvarying\b/g, 'in')
        .replace('void main()', 'layout(location = 0) out vec4 zenKoiMaterialColor;\nvoid main()')
        .replace(/\btexture2D\b/g, 'texture')
        .replace(/\bgl_FragColor\b/g, 'zenKoiMaterialColor');

    return Object.freeze({ vertex, fragment, dialect: 'glsl_es_300' });
};
