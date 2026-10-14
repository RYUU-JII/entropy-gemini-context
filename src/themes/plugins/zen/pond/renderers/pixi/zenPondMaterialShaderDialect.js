const MATERIAL_PROGRAMS = Object.freeze({
    decor_material: Object.freeze({
        name: 'zen_decor_material',
        output: 'zenDecorMaterialColor',
        attributes: ['aTextureCoord', 'aVertexPosition'],
        vertexVaryings: ['vUv', 'vLocal', 'vWorld'],
        fragmentVaryings: ['vUv', 'vLocal', 'vWorld'],
        nativeFilterVertex: false,
    }),
    decor_shadow: Object.freeze({
        name: 'zen_decor_shadow',
        output: 'zenDecorShadowColor',
        attributes: ['aTextureCoord', 'aVertexPosition'],
        vertexVaryings: ['vUv', 'vLocal', 'vWorld'],
        fragmentVaryings: ['vLocal'],
        nativeFilterVertex: false,
    }),
    koi_shadow: Object.freeze({
        name: 'zen_koi_shadow',
        output: 'zenKoiShadowColor',
        attributes: ['aTextureCoord', 'aVertexPosition'],
        vertexVaryings: ['vUv'],
        fragmentVaryings: ['vUv'],
        nativeFilterVertex: false,
    }),
    benthic_material: Object.freeze({
        name: 'zen_benthic_material',
        output: 'zenBenthicMaterialColor',
        attributes: ['aVertexPosition'],
        vertexVaryings: ['vTextureCoord'],
        fragmentVaryings: ['vTextureCoord'],
        nativeFilterVertex: true,
    }),
});

const hasDeclarations = (source, keyword, names) => (
    source.match(new RegExp(`^\\s*${keyword}\\s+`, 'gm'))?.length === names.length
    && names.every(name => source.includes(`${keyword} vec2 ${name};`))
);

// These four owned materials only change their shader interface. Pixi retains
// compilation, reflection, context caches, binding and GL-program lifetime.
export const resolveZenPondMaterialShaderSources = ({
    programId,
    webGLVersion,
    vertexSrc,
    fragmentSrc,
} = {}) => {
    if (webGLVersion !== 1 && webGLVersion !== 2) {
        throw new Error('ZEN_POND_MATERIAL_WEBGL_VERSION_INVALID');
    }
    if (typeof programId !== 'string' || !Object.hasOwn(MATERIAL_PROGRAMS, programId)) {
        throw new Error('ZEN_POND_MATERIAL_PROGRAM_ID_INVALID');
    }
    const program = MATERIAL_PROGRAMS[programId];
    if (
        typeof vertexSrc !== 'string'
        || typeof fragmentSrc !== 'string'
        || (program.nativeFilterVertex
            ? /\bprecision\b/.test(vertexSrc)
            : !vertexSrc.trimStart().startsWith('precision highp float;'))
        || !fragmentSrc.trimStart().startsWith('precision highp float;')
        || !hasDeclarations(vertexSrc, 'attribute', program.attributes)
        || !hasDeclarations(vertexSrc, 'varying', program.vertexVaryings)
        || !hasDeclarations(fragmentSrc, 'varying', program.fragmentVaryings)
        || !/\bvoid\s+main\s*\(/.test(vertexSrc)
        || !/\bvoid\s+main\s*\(/.test(fragmentSrc)
        || !fragmentSrc.includes('gl_FragColor')
        || /^\s*#\s*version\b/m.test(vertexSrc)
        || /^\s*#\s*version\b/m.test(fragmentSrc)
    ) {
        throw new Error('ZEN_POND_MATERIAL_SHADER_SOURCE_INVALID');
    }
    if (webGLVersion === 1) {
        return Object.freeze({
            vertex: program.nativeFilterVertex ? null : vertexSrc,
            fragment: fragmentSrc,
            dialect: 'glsl_es_100',
        });
    }

    const header = `#version 300 es\n#define SHADER_NAME ${program.name}\n`;
    let vertex = vertexSrc;
    program.attributes.forEach((name, location) => {
        vertex = vertex.replace(
            `attribute vec2 ${name};`,
            `layout(location = ${location}) in vec2 ${name};`,
        );
    });
    // Public Filter.defaultVertexSrc receives highp during native preparation.
    // Mesh sources already declare their effective highp precision explicitly.
    vertex = header + (program.nativeFilterVertex ? 'precision highp float;\n' : '')
        + vertex.replace(/\bvarying\b/g, 'out');
    const fragment = header + fragmentSrc
        .replace(/\bvarying\b/g, 'in')
        .replace(/\bvoid\s+main\s*\(/, `layout(location = 0) out vec4 ${program.output};\n$&`)
        .replace(/\btexture2D\b/g, 'texture')
        .replace(/\bgl_FragColor\b/g, program.output);

    return Object.freeze({ vertex, fragment, dialect: 'glsl_es_300' });
};
