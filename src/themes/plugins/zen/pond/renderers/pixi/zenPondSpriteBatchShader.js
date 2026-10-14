const NATIVE_ATTRIBUTE_LOCATIONS = Object.freeze({
    aColor: 0,
    aTextureCoord: 1,
    aTextureId: 2,
    aVertexPosition: 3,
});
const NATIVE_ATTRIBUTE_TYPES = Object.freeze({
    aColor: 'vec4',
    aTextureCoord: 'vec2',
    aTextureId: 'float',
    aVertexPosition: 'vec2',
});

// Inputs are public Program-prepared sources, including native effective precision.
// Preserve the original sampler ladder and all math; adapt only the interface.
export const createZenPondSpriteBatchWebGL2Sources = ({ vertexSrc, fragmentSrc }) => {
    const attributes = [...vertexSrc.matchAll(/\battribute\s+(\w+)\s+(\w+)\s*;/gu)];
    if (attributes.length !== 4
        || new Set(attributes.map(([, , name]) => name)).size !== 4
        || attributes.some(([, type, name]) => !Object.hasOwn(NATIVE_ATTRIBUTE_LOCATIONS, name)
            || type !== NATIVE_ATTRIBUTE_TYPES[name])) {
        throw new Error('ZEN_POND_SPRITE_BATCH_ATTRIBUTE_LAYOUT_INVALID');
    }
    const vertex = vertexSrc
        .replace(/\battribute\s+(\w+)\s+(\w+)\s*;/gu,
            (_, type, name) => `layout(location = ${NATIVE_ATTRIBUTE_LOCATIONS[name]}) in ${type} ${name};`)
        .replace(/\bvarying\b/gu, 'out');
    const fragment = fragmentSrc
        .replace(/\bvarying\b/gu, 'in')
        .replace(/\bgl_FragColor\b/gu, 'zenPondBatchColor')
        .replace(/\bvoid\s+main\s*\(/u, 'layout(location = 0) out vec4 zenPondBatchColor;\nvoid main(');
    return { vertex: `#version 300 es\n${vertex}`, fragment: `#version 300 es\n${fragment}` };
};

// Native classes enter through the canonical worker adapter. Dialect selection
// happens in the public generation hook, after the actual context is admitted.
export const createZenPondSpriteBatchRendererClass = ({ BatchRenderer, BatchShaderGenerator, Program }) => {
    class ZenPondWebGL2BatchShaderGenerator extends BatchShaderGenerator {
        generateSampleSrc(maxTextures) {
            return super.generateSampleSrc(maxTextures).replaceAll('texture2D(', 'texture(');
        }
    }
    class ZenPondBatchShaderGenerator extends BatchShaderGenerator {
        constructor(vertex, fragment, renderer) {
            super(vertex, fragment);
            this.renderer = renderer;
            this.webGL2Generator = null;
        }
        generateShader(maxTextures) {
            const version = this.renderer.context.webGLVersion;
            if (version === 1) return super.generateShader(maxTextures);
            if (version !== 2) throw new Error('ZEN_POND_SPRITE_BATCH_WEBGL_VERSION_INVALID');
            if (this.webGL2Generator === null) {
                // Public Program performs the same native precision projection.
                // This source-only instance is never bound or compiled.
                const prepared = new Program(this.vertexSrc, this.fragTemplate);
                const sources = createZenPondSpriteBatchWebGL2Sources(prepared);
                this.webGL2Generator = new ZenPondWebGL2BatchShaderGenerator(sources.vertex, sources.fragment);
            }
            return this.webGL2Generator.generateShader(maxTextures);
        }
    }
    return class ZenPondSpriteBatchRenderer extends BatchRenderer {
        setShaderGenerator(options) {
            if (this.renderer.options.zenPondSpriteBatchDialect !== true) {
                super.setShaderGenerator(options);
                return;
            }
            const {
                vertex = BatchRenderer.defaultVertexSrc,
                fragment = BatchRenderer.defaultFragmentTemplate,
            } = options === undefined ? {} : options;
            this.shaderGenerator = new ZenPondBatchShaderGenerator(vertex, fragment, this.renderer);
        }
    };
};
