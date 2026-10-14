import { Geometry, Mesh, Shader, Texture } from './zenPondPixiRuntime.js';
import { resolveZenPondMaterialShaderSources } from './zenPondMaterialShaderDialect.js';
import { zenKoiShadowVertex, zenKoiShadowFragment } from './ZenKoiMaterialMesh.js';
import { writeZenKoiShadowWeights } from '../../contracts/zenKoiShadowMaterial.js';

// Four articulated quads share one atlas, one shader and one draw submission.
// Vertices reuse the actual fin sprites' pose; no second fin animation exists.
export class ZenKoiFinShadowMesh extends Mesh {
    constructor(webGLVersion) {
        const indices = [];
        for (let i = 0; i < 4; i++) {
            const v = i * 4;
            indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
        }
        const sources = resolveZenPondMaterialShaderSources({
            programId: 'koi_shadow', webGLVersion,
            vertexSrc: zenKoiShadowVertex, fragmentSrc: zenKoiShadowFragment,
        });
        super(new Geometry()
            .addAttribute('aVertexPosition', new Float32Array(32), 2)
            .addAttribute('aTextureCoord', new Float32Array(32), 2)
            .addIndex(indices), Shader.from(sources.vertex, sources.fragment, {
                uMaterial: Texture.EMPTY, uSoftWeights: [1, 0, 0], uAlpha: 0,
            }));
        this.size = 24;
        this.visible = false;
        this.frames = null;
    }

    setAtlas(texture, frames) {
        if (!texture || texture.destroyed || !Array.isArray(frames) || frames.length !== 2) {
            throw new Error('ZEN_KOI_FIN_SHADOW_ATLAS_REQUIRED');
        }
        if (frames.some(frame => !frame || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(frame[key]))
            || frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0
            || frame.x + frame.width > texture.width || frame.y + frame.height > texture.height)) {
            throw new Error('ZEN_KOI_FIN_SHADOW_FRAME_INVALID');
        }
        this.shader.uniforms.uMaterial = texture;
        this.frames = frames;
        const buffer = this.geometry.getBuffer('aTextureCoord');
        for (let i = 0; i < 4; i++) {
            const frame = frames[i < 2 ? 0 : 1];
            const left = frame.x / texture.width, right = (frame.x + frame.width) / texture.width;
            const top = frame.y / texture.height, bottom = (frame.y + frame.height) / texture.height;
            buffer.data.set([left, top, right, top, right, bottom, left, bottom], i * 8);
        }
        buffer.update();
    }

    setPenumbra(width) { writeZenKoiShadowWeights(this.shader.uniforms.uSoftWeights, width); }

    updatePose(fins, surface) {
        if (!this.frames || fins.length !== 4 || !surface?.anchor?.point) {
            throw new Error('ZEN_KOI_FIN_SHADOW_POSE_REQUIRED');
        }
        const { x: anchorX, y: anchorY } = surface.anchor.point;
        const { scale, offset } = surface;
        const buffer = this.geometry.getBuffer('aVertexPosition');
        for (let i = 0; i < 4; i++) {
            const fin = fins[i], frame = this.frames[i < 2 ? 0 : 1];
            const c = Math.cos(fin.rotation), s = Math.sin(fin.rotation);
            const x = anchorX + (fin.x - anchorX) * scale + offset.x;
            const y = anchorY + (fin.y - anchorY) * scale + offset.y;
            const halfWidth = frame.width * fin.scale.x * scale * 0.5;
            const halfHeight = frame.height * fin.scale.y * scale * 0.5;
            for (let corner = 0; corner < 4; corner++) {
                const lx = corner === 0 || corner === 3 ? -halfWidth : halfWidth;
                const ly = corner < 2 ? -halfHeight : halfHeight;
                const index = i * 8 + corner * 2;
                buffer.data[index] = x + lx * c - ly * s;
                buffer.data[index + 1] = y + lx * s + ly * c;
            }
        }
        buffer.update();
    }

    _render(renderer) {
        this.shader.uniforms.uAlpha = this.worldAlpha;
        super._render(renderer);
    }

    destroy(options) {
        const { shader, geometry } = this;
        super.destroy(options);
        shader.destroy(); geometry.destroy();
    }
}
