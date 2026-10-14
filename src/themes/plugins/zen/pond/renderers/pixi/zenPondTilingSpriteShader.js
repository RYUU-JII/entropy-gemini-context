const NATIVE_ATTRIBUTE_LOCATIONS = Object.freeze({
    aTextureCoord: 0,
    aVertexPosition: 1,
});

// Public native Program sources already carry explicit lowp precision and a
// version row. Keep sampling, transforms and color math byte-for-byte intact.
export const createZenPondTilingSpriteWebGL2Sources = ({ vertexSrc, fragmentSrc }) => {
    const invalid = () => { throw new Error('ZEN_POND_TILING_SPRITE_SOURCE_INVALID'); };
    for (const source of [vertexSrc, fragmentSrc]) {
        if (typeof source !== 'string'
            || !/^#version[ \t]+100[ \t]*\r?\n/u.test(source)
            || [...source.matchAll(/^\s*#version\b/gmu)].length !== 1
            || [...source.matchAll(/\bprecision\s+\w+\s+float\s*;/gu)].length !== 1
            || !/\bprecision\s+lowp\s+float\s*;/u.test(source)
            || [...source.matchAll(/\bvoid\s+main\s*\(/gu)].length !== 1) invalid();
        const varyings = [...source.matchAll(/\bvarying\s+(\w+)\s+(\w+)\s*;/gu)];
        if (varyings.length !== 1 || varyings[0][1] !== 'vec2' || varyings[0][2] !== 'vTextureCoord') invalid();
    }
    const attributes = [...vertexSrc.matchAll(/\battribute\s+(\w+)\s+(\w+)\s*;/gu)];
    if (attributes.length !== 2
        || new Set(attributes.map(([, , name]) => name)).size !== 2
        || attributes.some(([, type, name]) => type !== 'vec2' || !Object.hasOwn(NATIVE_ATTRIBUTE_LOCATIONS, name))
        || /\battribute\b/u.test(fragmentSrc)
        || [...fragmentSrc.matchAll(/\bgl_FragColor\b/gu)].length !== 1
        || [...fragmentSrc.matchAll(/\btexture2D\s*\(/gu)].length !== 1) invalid();

    const vertex = vertexSrc
        .replace(/^#version[ \t]+100\b/u, '#version 300 es')
        .replace(/\battribute\s+(\w+)\s+(\w+)\s*;/gu,
            (_, type, name) => `layout(location = ${NATIVE_ATTRIBUTE_LOCATIONS[name]}) in ${type} ${name};`)
        .replace(/\bvarying\b/gu, 'out');
    const fragment = fragmentSrc
        .replace(/^#version[ \t]+100\b/u, '#version 300 es')
        .replace(/\bvarying\b/gu, 'in')
        .replace(/\btexture2D\b/gu, 'texture')
        .replace(/\bgl_FragColor\b/gu, 'zenPondTilingColor')
        .replace(/\bvoid\s+main\s*\(/u, 'layout(location = 0) out vec4 zenPondTilingColor;\nvoid main(');
    return { vertex, fragment };
};

// The canonical worker adapter injects native public classes. Native context
// setup and render/quad/blend/lifetime ownership remain in TilingSpriteRenderer.
export const createZenPondTilingSpriteRendererClass = ({ TilingSpriteRenderer, Shader }) => (
    class ZenPondTilingSpriteRenderer extends TilingSpriteRenderer {
        contextChange() {
            const enabled = this.renderer.options.zenPondTilingSpriteDialect === true;
            const version = this.renderer.context.webGLVersion;
            if (enabled && version !== 1 && version !== 2) {
                throw new Error('ZEN_POND_TILING_SPRITE_WEBGL_VERSION_INVALID');
            }
            super.contextChange();
            if (!enabled || version === 1) return;
            const previous = this.simpleShader;
            const sources = createZenPondTilingSpriteWebGL2Sources(previous.program);
            this.simpleShader = Shader.from(sources.vertex, sources.fragment, previous.uniformGroup);
            previous.destroy();
        }
    }
);
