import { Filter, Matrix } from './zenPondPixiRuntime.js';
import { resolveZenPondMaterialShaderSources } from './zenPondMaterialShaderDialect.js';

// The relief textures are material contrast around neutral 0.5. Pixi 7's
// WebGL blend table maps HARD_LIGHT/SOFT_LIGHT to NORMAL, so the actual floor
// backdrop must be sampled before applying these operations.
export const zenBenthicMaterialBlendShader = `
float zen_floor_hard_light(float b, float s) {
    if (s <= 0.5) return 2.0 * b * s;
    return 1.0 - 2.0 * (1.0 - b) * (1.0 - s);
}
float zen_floor_soft_light(float b, float s) {
    if (s <= 0.5) return b - (1.0 - 2.0 * s) * b * (1.0 - b);
    float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
    return b + (2.0 * s - 1.0) * (d - b);
}
float zen_floor_relief_channel(float premultipliedBase, float alpha, float s, float amount, float soft) {
    if (alpha <= 0.0) return premultipliedBase;
    float b = clamp(premultipliedBase / alpha, 0.0, 1.0);
    float blended = soft > 0.5 ? zen_floor_soft_light(b, s) : zen_floor_hard_light(b, s);
    return (b + (blended - b) * amount) * alpha;
}
`;

export const zenBenthicMaterialFragmentShader = `
precision highp float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputClamp;
uniform sampler2D uPrimaryTexture;
uniform sampler2D uDetailTexture;
uniform mat3 uPrimaryUv;
uniform mat3 uDetailUv;
uniform vec4 uPrimaryColor;
uniform vec4 uDetailColor;
uniform vec2 uSourcePremultiplied;
${zenBenthicMaterialBlendShader}
vec3 zen_floor_source(vec4 sampleColor, float premultiplied, vec3 tint) {
    float divisor = mix(1.0, max(sampleColor.a, 0.000001), premultiplied);
    return clamp(sampleColor.rgb / divisor * tint, 0.0, 1.0);
}
void main(void) {
    vec4 backdrop = texture2D(uSampler, clamp(vTextureCoord, inputClamp.xy, inputClamp.zw));
    // Material contrast cannot create color or coverage outside the floor.
    if (backdrop.a <= 0.0) { gl_FragColor = backdrop; return; }
    // REPEAT belongs to the sampler. Keeping UVs continuous preserves mip derivatives.
    vec4 primary = texture2D(uPrimaryTexture, (uPrimaryUv * vec3(vTextureCoord, 1.0)).xy);
    vec3 p = zen_floor_source(primary, uSourcePremultiplied.x, uPrimaryColor.rgb);
    float primaryAmount = primary.a * uPrimaryColor.a;
    vec3 base = vec3(
        zen_floor_relief_channel(backdrop.r, backdrop.a, p.r, primaryAmount, 0.0),
        zen_floor_relief_channel(backdrop.g, backdrop.a, p.g, primaryAmount, 0.0),
        zen_floor_relief_channel(backdrop.b, backdrop.a, p.b, primaryAmount, 0.0)
    );
    vec4 detail = texture2D(uDetailTexture, (uDetailUv * vec3(vTextureCoord, 1.0)).xy);
    vec3 d = zen_floor_source(detail, uSourcePremultiplied.y, uDetailColor.rgb);
    float detailAmount = detail.a * uDetailColor.a;
    base = vec3(
        zen_floor_relief_channel(base.r, backdrop.a, d.r, detailAmount, 1.0),
        zen_floor_relief_channel(base.g, backdrop.a, d.g, detailAmount, 1.0),
        zen_floor_relief_channel(base.b, backdrop.a, d.b, detailAmount, 1.0)
    );
    gl_FragColor = vec4(base, backdrop.a);
}
`;

const readRelativeCoverage = (sprite, floor) => {
    let coverage = 1;
    let node = sprite;
    while (node && node !== floor) {
        if (!node.visible) return 0;
        coverage *= node.alpha;
        node = node.parent;
    }
    if (node !== floor) throw new Error('ZEN_BENTHIC_SOURCE_OUTSIDE_FLOOR');
    return coverage;
};

export const updateZenBenthicSourceUniforms = ({ filterManager, sprite, floor, uv, color }) => {
    const texture = sprite.texture;
    if (!texture?.valid || sprite.tileScale.x === 0 || sprite.tileScale.y === 0) {
        throw new Error('ZEN_BENTHIC_SOURCE_TEXTURE_OR_TILING_INVALID');
    }
    if (sprite.tileTransform.rotation !== 0 || sprite.tileTransform.skew.x !== 0 || sprite.tileTransform.skew.y !== 0) {
        throw new Error('ZEN_BENTHIC_TILE_ROTATION_UNSUPPORTED');
    }
    // Pixi's mapping includes the pooled input texture size, capture origin,
    // source world transform and texture extent. Never normalize to viewport
    // dimensions: filter inputs may be padded or cropped.
    filterManager.calculateSpriteMatrix(uv, sprite);
    const anchorX = sprite.anchor.x;
    const anchorY = sprite.anchor.y;
    uv.translate(
        sprite.uvRespectAnchor ? -anchorX : anchorX * (sprite._width / texture.orig.width - 1),
        sprite.uvRespectAnchor ? -anchorY : anchorY * (sprite._height / texture.orig.height - 1),
    );
    uv.scale(1 / sprite.tileScale.x, 1 / sprite.tileScale.y);
    uv.translate(
        -sprite.tilePosition.x / (texture.orig.width * sprite.tileScale.x),
        -sprite.tilePosition.y / (texture.orig.height * sprite.tileScale.y),
    );
    color[0] = ((sprite.tint >>> 16) & 255) / 255;
    color[1] = ((sprite.tint >>> 8) & 255) / 255;
    color[2] = (sprite.tint & 255) / 255;
    color[3] = readRelativeCoverage(sprite, floor);
};

export class ZenBenthicMaterialFilter extends Filter {
    constructor({ floor, primary, detail, webGLVersion }) {
        if (!floor || !primary || !detail) throw new Error('ZEN_BENTHIC_MATERIAL_SOURCES_REQUIRED');
        const shaderSources = resolveZenPondMaterialShaderSources({
            programId: 'benthic_material', webGLVersion,
            vertexSrc: Filter.defaultVertexSrc, fragmentSrc: zenBenthicMaterialFragmentShader,
        });
        super(shaderSources.vertex, shaderSources.fragment, {
            uPrimaryTexture: primary.texture,
            uDetailTexture: detail.texture,
            uPrimaryUv: new Matrix(),
            uDetailUv: new Matrix(),
            uPrimaryColor: new Float32Array(4),
            uDetailColor: new Float32Array(4),
            uSourcePremultiplied: new Float32Array(2),
        });
        this.floor = floor;
        this.sources = [primary, detail];
        this.padding = 0;
        this.resolution = 1;
    }

    apply(filterManager, input, output, clearMode) {
        for (let index = 0; index < this.sources.length; index += 1) {
            const sprite = this.sources[index];
            const prefix = index === 0 ? 'uPrimary' : 'uDetail';
            updateZenBenthicSourceUniforms({
                filterManager,
                sprite,
                floor: this.floor,
                uv: this.uniforms[`${prefix}Uv`],
                color: this.uniforms[`${prefix}Color`],
            });
            this.uniforms[`${prefix}Texture`] = sprite.texture;
            this.uniforms.uSourcePremultiplied[index] = Number(sprite.texture.baseTexture.alphaMode > 0);
        }
        filterManager.applyFilter(this, input, output, clearMode);
    }

    destroy() {
        // The layer texture cache owns both source textures; FilterSystem owns
        // the temporary input render texture. Neither belongs to this filter.
        this.sources = null;
        this.floor = null;
        super.destroy();
    }
}
