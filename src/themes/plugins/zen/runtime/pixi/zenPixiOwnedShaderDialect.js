const FILTER_ATTRIBUTES = Object.freeze([Object.freeze(['vec2', 'aVertexPosition'])]);
const QUAD_ATTRIBUTES = Object.freeze([
    Object.freeze(['vec2', 'aTextureCoord']), Object.freeze(['vec2', 'aVertexPosition']),
]);
const FILTER_VARYING = Object.freeze(['vec2', 'vTextureCoord']);
const PROGRAMS = Object.freeze({
    shoji: Object.freeze({ attributes: Object.freeze([
        Object.freeze(['vec3', 'aProjectiveUV']), Object.freeze(['vec2', 'aVertexPosition']),
    ]), varying: Object.freeze(['vec3', 'vProjectiveUV']), vertexPrecision: 'highp', fragmentPrecision: 'highp', filter: false }),
    great_wave: Object.freeze({ attributes: FILTER_ATTRIBUTES, varying: FILTER_VARYING, vertexPrecision: null, fragmentPrecision: 'highp', filter: true }),
    shishi_water: Object.freeze({ attributes: QUAD_ATTRIBUTES, varying: Object.freeze(['vec2', 'vUv']), vertexPrecision: null, fragmentPrecision: 'mediump', filter: false }),
    bonsai_paper: Object.freeze({ attributes: FILTER_ATTRIBUTES, varying: FILTER_VARYING, vertexPrecision: null, fragmentPrecision: 'highp', filter: true }),
    water_surface_comparison: Object.freeze({ attributes: FILTER_ATTRIBUTES, varying: FILTER_VARYING, vertexPrecision: null, fragmentPrecision: 'highp', filter: true }),
    benthic_caustic_comparison: Object.freeze({ attributes: QUAD_ATTRIBUTES, varying: FILTER_VARYING, vertexPrecision: 'highp', fragmentPrecision: 'highp', filter: false }),
});

export const requireZenPixiOwnedShaderWebGLVersion = (webGLVersion) => {
    if (webGLVersion !== 1 && webGLVersion !== 2) {
        throw new Error('ZEN_PIXI_OWNED_SHADER_WEBGL_VERSION_INVALID');
    }
    return webGLVersion;
};

const codeOnly = source => source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\r\n]*/gu, '');
const declarations = (source, keyword) => [...source.matchAll(new RegExp(`\\b${keyword}\\s+(\\w+)\\s+(\\w+)\\s*;`, 'gu'))]
    .map(([, type, name]) => [type, name]);
const sameDeclarations = (actual, expected) => actual.length === expected.length
    && expected.every(([type, name]) => actual.some(([foundType, foundName]) => type === foundType && name === foundName));
const hasPrecision = (code, expected) => {
    const values = [...code.matchAll(/\bprecision\s+(\w+)\s+float\s*;/gu)].map(([, value]) => value);
    return expected === null ? values.length === 0 : values.length === 1 && values[0] === expected;
};

// Six declared Zen owners only. Numeric context selection and source validation
// precede allocation; native Shader/Filter still own compilation and caches.
export const resolveZenPixiOwnedShaderSources = ({
    programId, webGLVersion, vertexSrc, fragmentSrc, defaultVertexSrc,
} = {}) => {
    requireZenPixiOwnedShaderWebGLVersion(webGLVersion);
    if (typeof programId !== 'string' || !Object.hasOwn(PROGRAMS, programId)) throw new Error('ZEN_PIXI_OWNED_SHADER_PROGRAM_INVALID');
    const descriptor = PROGRAMS[programId];
    const vertex = descriptor.filter ? defaultVertexSrc : vertexSrc;
    const invalid = () => { throw new Error(`ZEN_PIXI_OWNED_SHADER_SOURCE_INVALID:${programId}`); };
    if (typeof vertex !== 'string' || typeof fragmentSrc !== 'string'
        || (descriptor.filter && vertexSrc !== null)) invalid();
    const vertexCode = codeOnly(vertex), fragmentCode = codeOnly(fragmentSrc);
    for (const code of [vertexCode, fragmentCode]) {
        if (/^\s*#\s*version\b/mu.test(code)
            || [...code.matchAll(/\bvoid\s+main\s*\(/gu)].length !== 1) invalid();
    }
    if (!sameDeclarations(declarations(vertexCode, 'attribute'), descriptor.attributes)
        || declarations(fragmentCode, 'attribute').length !== 0
        || !sameDeclarations(declarations(vertexCode, 'varying'), [descriptor.varying])
        || !sameDeclarations(declarations(fragmentCode, 'varying'), [descriptor.varying])
        || !hasPrecision(vertexCode, descriptor.vertexPrecision)
        || !hasPrecision(fragmentCode, descriptor.fragmentPrecision)
        || !/\bgl_FragColor\b/u.test(fragmentCode)) invalid();

    if (webGLVersion === 1) {
        return Object.freeze({ vertex: descriptor.filter ? null : vertexSrc, fragment: fragmentSrc, dialect: 'glsl_es_100' });
    }
    const header = `#version 300 es\n#define SHADER_NAME zen_owned_${programId}\n`;
    let modernVertex = vertex;
    descriptor.attributes.forEach(([type, name], location) => {
        modernVertex = modernVertex.replace(new RegExp(`\\battribute\\s+${type}\\s+${name}\\s*;`, 'u'),
            `layout(location = ${location}) in ${type} ${name};`);
    });
    // Public Filter.defaultVertexSrc and Shishi's authored vertex receive highp
    // during native Program preparation. Make that same precision explicit.
    modernVertex = header + (descriptor.vertexPrecision === null ? 'precision highp float;\n' : '')
        + modernVertex.replace(/\bvarying\b/gu, 'out');
    const modernFragment = header + fragmentSrc
        .replace(/\bvarying\b/gu, 'in')
        .replace(/\btexture2D\b/gu, 'texture')
        .replace(/\bgl_FragColor\b/gu, 'zenOwnedShaderColor')
        .replace(/\bvoid(?=\s+main\s*\()/u, 'layout(location = 0) out vec4 zenOwnedShaderColor;\nvoid');
    return Object.freeze({ vertex: modernVertex, fragment: modernFragment, dialect: 'glsl_es_300' });
};
