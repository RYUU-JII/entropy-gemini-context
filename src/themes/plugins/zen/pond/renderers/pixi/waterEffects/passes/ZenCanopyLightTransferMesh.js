import { BLEND_MODES, Geometry, Mesh, Shader } from '../../zenPondPixiRuntime.js';
import { ZEN_POND_CANOPY_CROWNS, ZEN_POND_CANOPY_PROJECTION_LIMIT, ZEN_POND_CANOPY_TEXTURE_SIZE, ZEN_POND_CANOPY_INNER_FADE } from '../../../../contracts/zenPondCanopyMaterial.js';
import { projectZenPondShadow } from '../../../../runtime/zenPondShadowProjection.js';
import { resolveZenCanopyLightTransferShaderSources } from './zenCanopyLightTransferShaderDialect.js';

export { zenCanopyLightTransferFragmentShader } from './zenCanopyLightTransferShaderDialect.js';

const crownCount = ZEN_POND_CANOPY_CROWNS.length;
const quadCount = ZEN_POND_CANOPY_CROWNS.reduce((sum, crown) => sum + (crown.edgeY === 0 ? 1 : 2), 0);
const highestCrown = Math.max(...ZEN_POND_CANOPY_CROWNS.map((crown) => crown.height));
const projectionLimit = (crown) => ZEN_POND_CANOPY_PROJECTION_LIMIT * Math.sqrt(crown.height / highestCrown);

export const resolveZenCanopyProjection = (light, extent, crown) => {
    if (!Number.isFinite(extent) || extent <= 0) throw new Error('ZEN_CANOPY_PROJECTION_EXTENT_INVALID');
    const projection = projectZenPondShadow({
        light, heightAboveReceiver: extent * crown.height, maxReach: extent * projectionLimit(crown),
    });
    // The optical footprint selects two bounded, preblurred material masks.
    // Higher branches and a longer cast soften more; weather stays in light shares.
    const t = Math.max(0, Math.min(1, (projection.penumbra / extent - 0.001) / 0.0046));
    return { ...projection, softness: 0.12 + 0.88 * t * t * (3 - 2 * t) };
};

export const resolveZenCanopyLayout = (bounds) => {
    for (const key of ['x', 'y', 'width', 'height']) {
        if (!Number.isFinite(bounds?.[key]) || ((key === 'width' || key === 'height') && bounds[key] <= 0)) {
            throw new Error(`ZEN_CANOPY_VISIBLE_BOUNDS_INVALID:${key}`);
        }
    }
    const extent = Math.min(bounds.width, bounds.height);
    return ZEN_POND_CANOPY_CROWNS.map((crown) => {
        const size = extent * crown.size;
        return {
            id: crown.id,
            atlas: crown.atlas,
            x: bounds.x + (bounds.width - size) * crown.anchorX + extent * crown.offsetX,
            y: bounds.y + (bounds.height - size) * crown.anchorY + extent * crown.offsetY,
            size,
            // Include one world-space texel for linear filtering at the baked
            // inner fade, in addition to the bounded subpixel branch sway.
            padding: extent * projectionLimit(crown) + 3 + size / ((crown.atlas[2] - crown.atlas[0]) * ZEN_POND_CANOPY_TEXTURE_SIZE),
            edgeX: crown.edgeX, edgeY: crown.edgeY,
        };
    });
};

export class ZenCanopyLightTransferMesh extends Mesh {
    constructor({ width, height, directOcclusionTexture, skyOcclusionTexture, webGLVersion }) {
        if (!directOcclusionTexture || !skyOcclusionTexture) throw new Error('ZEN_CANOPY_VISIBILITY_TEXTURES_REQUIRED');
        const shaderSources = resolveZenCanopyLightTransferShaderSources(webGLVersion);
        const geometry = new Geometry()
            .addAttribute('aVertexPosition', new Float32Array(quadCount * 8), 2)
            .addAttribute('aTextureCoord', new Float32Array(quadCount * 8), 2)
            .addAttribute('aAtlasBounds', new Float32Array(quadCount * 16), 4)
            .addAttribute('aProjectionScale', new Float32Array(quadCount * 4), 1)
            .addAttribute('aCrownIndex', new Float32Array(ZEN_POND_CANOPY_CROWNS.flatMap((crown, index) => Array(crown.edgeY === 0 ? 4 : 8).fill(index))), 1)
            .addIndex(Array.from({ length: quadCount }, (_, index) => [0, 1, 2, 0, 2, 3].map((vertex) => vertex + index * 4)).flat());
        const shader = Shader.from(shaderSources.vertex, shaderSources.fragment, {
            uDirectOcclusion: directOcclusionTexture, uSkyOcclusion: skyOcclusionTexture,
            uDirectShare: [0, 0, 0], uSkyShare: [0, 0, 0],
            uCrownProjection: new Float32Array(crownCount * 3), uWindOffset: new Float32Array(2), uGapEnabled: 1, uTransferAmount: 0,
        });
        super(geometry, shader);
        this.size = quadCount * 6;
        this.blendMode = BLEND_MODES.MULTIPLY;
        this.visible = false;
        this.alpha = 0;
        this.canopyLayoutKey = '';
        this.setCanopyLayout({ x: 0, y: 0, width, height });
    }

    setCanopyLayout(bounds) {
        const key = `${bounds.x}|${bounds.y}|${bounds.width}|${bounds.height}`;
        if (key === this.canopyLayoutKey) return;
        const layouts = resolveZenCanopyLayout(bounds);
        // Read-only optical consumers reuse the exact admitted placement;
        // a viewport change must not invent a second canopy before this pass.
        this.canopyLayouts = layouts;
        const positions = [];
        const uvs = [];
        const atlasBounds = [];
        const projectionScales = [];
        layouts.forEach(({ x, y, size, padding, atlas, edgeX, edgeY }) => {
            const [u0, v0, u1, v1] = atlas;
            const worldToUv = (u1 - u0) / size;
            // The coverage envelope is an L, expanded by the maximum solar/wind
            // displacement. Two disjoint strips omit its empty centre without
            // per-pixel discard or an extra draw. Side crowns need one strip.
            const support = Math.min(size, Math.min(bounds.width, bounds.height) * ZEN_POND_CANOPY_INNER_FADE[1]);
            const outerLeft = x - padding, outerRight = x + size + padding;
            const stripLeft = edgeX > 0 ? outerLeft : x + size - support - padding;
            const stripRight = edgeX > 0 ? x + support + padding : outerRight;
            const regions = [[stripLeft, y - padding, stripRight, y + size + padding]];
            if (edgeY !== 0) regions.push([
                edgeX > 0 ? stripRight : outerLeft,
                edgeY > 0 ? y - padding : y + size - support - padding,
                edgeX > 0 ? outerRight : stripLeft,
                edgeY > 0 ? y + support + padding : y + size + padding,
            ]);
            const clipX = (value) => Math.max(bounds.x, Math.min(bounds.x + bounds.width, value));
            const clipY = (value) => Math.max(bounds.y, Math.min(bounds.y + bounds.height, value));
            regions.forEach(([l, t, r, b]) => {
                const left = clipX(l), right = clipX(r), top = clipY(t), bottom = clipY(b);
                positions.push(left, top, right, top, right, bottom, left, bottom);
                const ul = u0 + (left - x) * worldToUv, ur = u0 + (right - x) * worldToUv;
                const vt = v0 + (top - y) * worldToUv, vb = v0 + (bottom - y) * worldToUv;
                uvs.push(ul, vt, ur, vt, ur, vb, ul, vb);
                for (let vertex = 0; vertex < 4; vertex += 1) {
                    const halfTexel = 0.5 / ZEN_POND_CANOPY_TEXTURE_SIZE;
                    atlasBounds.push(u0 + halfTexel, v0 + halfTexel, u1 - halfTexel, v1 - halfTexel);
                    projectionScales.push(worldToUv);
                }
            });
        });
        this.geometry.getBuffer('aVertexPosition').update(new Float32Array(positions));
        this.geometry.getBuffer('aTextureCoord').update(new Float32Array(uvs));
        this.geometry.getBuffer('aAtlasBounds').update(new Float32Array(atlasBounds));
        this.geometry.getBuffer('aProjectionScale').update(new Float32Array(projectionScales));
        this.canopyLayoutKey = key;
    }

    setProjection({ shadowLight, extent, windX, windY }) {
        const light = shadowLight;
        const uniforms = this.shader.uniforms;
        uniforms.uWindOffset[0] = windX;
        uniforms.uWindOffset[1] = windY;
        if (this.projectionSunX === light.sunX && this.projectionSunY === light.sunY
            && this.projectionSunZ === light.sunZ && this.projectionExtent === extent) return;
        ZEN_POND_CANOPY_CROWNS.forEach((crown, index) => {
            const cast = resolveZenCanopyProjection(light, extent, crown);
            uniforms.uCrownProjection[index * 3] = cast.offsetX;
            uniforms.uCrownProjection[index * 3 + 1] = cast.offsetY;
            uniforms.uCrownProjection[index * 3 + 2] = cast.softness;
        });
        this.projectionSunX = light.sunX;
        this.projectionSunY = light.sunY;
        this.projectionSunZ = light.sunZ;
        this.projectionExtent = extent;
    }

    setLightTransfer({ directShare, skyShare, gapEnabled, amount }) {
        this.shader.uniforms.uDirectShare = directShare;
        this.shader.uniforms.uSkyShare = skyShare;
        this.shader.uniforms.uGapEnabled = gapEnabled ? 1 : 0;
        this.shader.uniforms.uTransferAmount = amount;
        this.alpha = amount;
        this.visible = amount > 0.001 && directShare.some((value, index) => value + skyShare[index] > 0.001);
    }

    _render(renderer) {
        this.shader.uniforms.uTransferAmount = this.worldAlpha;
        super._render(renderer);
    }

    destroy(options) {
        const shader = this.shader;
        const geometry = this.geometry;
        super.destroy(options);
        shader.destroy();
        geometry.destroy();
    }
}
