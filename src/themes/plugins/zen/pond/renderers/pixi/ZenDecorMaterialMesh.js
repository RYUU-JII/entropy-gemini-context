import { BLEND_MODES, Geometry, Mesh, Shader, Texture } from './zenPondPixiRuntime.js';
import { ZEN_ROCK_MINERAL_MATERIAL_VERSION } from './zenRockMineralMaterial.js';
import { resolveZenPondMaterialShaderSources } from './zenPondMaterialShaderDialect.js';

const vertex = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
varying vec2 vLocal;
varying vec2 vWorld;
void main() {
    vUv = aTextureCoord;
    vLocal = aVertexPosition;
    vec3 world = translationMatrix * vec3(aVertexPosition, 1.0);
    vWorld = world.xy;
    gl_Position = vec4((projectionMatrix * world).xy, 0.0, 1.0);
}`;

export const zenDecorMaterialFragment = `
precision highp float;
varying vec2 vUv;
varying vec2 vLocal;
varying vec2 vWorld;
uniform sampler2D uMaterial;
uniform vec4 uTintAlpha;
uniform vec2 uFormCenter;
uniform vec2 uFormRadius;
uniform vec3 uLocalSun;
uniform vec3 uDirectShare;
uniform float uFormStrength;
uniform sampler2D uFormCoverage;
uniform float uMaskSize;
uniform float uMappedForm;
uniform float uFormAttenuation;
uniform float uNightChromaMix;
uniform float uNightFormShade;
uniform sampler2D uReceiverCast;
uniform vec3 uReceiverU;
uniform vec3 uReceiverV;
uniform float uReceiverEnabled;
void main() {
    vec4 material = texture2D(uMaterial, vUv);
    vec2 slope = (vLocal - uFormCenter) / uFormRadius;
    vec3 normal = normalize(vec3(slope * uFormStrength, 1.0));
    if (uMappedForm > 0.5) {
        vec4 form = texture2D(uFormCoverage, vLocal / uMaskSize + 0.5);
        // Canvas textures arrive premultiplied. Decode straight normal RGB so
        // fractional edge coverage does not bend the stone's surface direction.
        normal = normalize(clamp(form.rgb / max(form.a, 0.0001) * 2.0 - 1.0, -1.0, 1.0));
    }
    float facing = max(0.0, dot(normal, uLocalSun));
    // Pigment and local crease AO are static. Directional form follows the sun.
    // The night sky reveals convex form without inventing a moon bearing.
    vec3 transfer = vec3(1.0) - uDirectShare * (1.0 - facing) * uFormAttenuation;
    float pigmentValue = dot(material.rgb, vec3(0.2126, 0.7152, 0.0722));
    material.rgb = mix(material.rgb, vec3(pigmentValue), uNightChromaMix);
    float skyEdge = uMappedForm > 0.5 ? clamp((1.0 - normal.z) * 2.4, 0.0, 1.0) : clamp(dot(slope, slope), 0.0, 1.0);
    transfer *= 1.0 - uNightFormShade * skyEdge;
    vec3 wp = vec3(vLocal, 1.0);
    vec2 castUv = vec2(dot(uReceiverU, wp), dot(uReceiverV, wp));
    float inside = step(0.0, castUv.x) * step(0.0, castUv.y)
        * step(castUv.x, 1.0) * step(castUv.y, 1.0);
    if (uReceiverEnabled > 0.5) {
        float castCoverage = texture2D(uReceiverCast, clamp(castUv, 0.0, 1.0)).a * inside;
        transfer *= vec3(1.0) - uDirectShare * castCoverage * 0.58;
    }
    gl_FragColor = material * vec4(uTintAlpha.rgb * transfer, 1.0) * uTintAlpha.a;
}`;

const quad = (left, top, right, bottom) => [left, top, right, top, right, bottom, left, bottom];
const makeGeometry = () => new Geometry()
    .addAttribute('aVertexPosition', quad(-1, -1, 1, 1), 2)
    .addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2)
    .addIndex([0, 1, 2, 0, 2, 3]);

export class ZenDecorMaterialMesh extends Mesh {
    constructor(record, webGLVersion) {
        const shaderSources = resolveZenPondMaterialShaderSources({
            programId: 'decor_material', webGLVersion,
            vertexSrc: vertex, fragmentSrc: zenDecorMaterialFragment,
        });
        super(makeGeometry(), Shader.from(shaderSources.vertex, shaderSources.fragment, {
            uMaterial: record.texture, uTintAlpha: [1, 1, 1, 1],
            uFormCenter: [0, 0], uFormRadius: [1, 1], uLocalSun: [0, 0, 1],
            uDirectShare: [0, 0, 0], uFormStrength: 0,
            uFormCoverage: record.silhouetteTexture, uMaskSize: 1, uMappedForm: 0, uFormAttenuation: 0.34,
            uNightChromaMix: 0, uNightFormShade: 0,
            uReceiverCast: Texture.WHITE, uReceiverU: [0, 0, 0],
            uReceiverV: [0, 0, 0], uReceiverEnabled: 0,
        }));
        this.size = 6;
        this.tint = 0xffffff;
        this.setMaterialRecord(record);
    }

    setMaterialRecord(record) {
        if (!record?.materialGeometry || !record.silhouetteTexture) throw new Error('ZEN_DECOR_MATERIAL_GEOMETRY_REQUIRED');
        this.materialRecord = record;
        const { texture, materialGeometry: form } = record;
        this.shader.uniforms.uMaterial = texture;
        this.shader.uniforms.uFormCenter = [form.centerX, form.centerY];
        this.shader.uniforms.uFormRadius = [form.radiusX, form.radiusY];
        this.shader.uniforms.uFormStrength = form.kind === 'rock' ? 0.9 : form.kind === 'flower' ? 0.65 : 0.12;
        if (form.surfaceFormEncoding !== 'analytic' && form.surfaceFormEncoding !== ZEN_ROCK_MINERAL_MATERIAL_VERSION) {
            throw new Error('ZEN_DECOR_FORM_ENCODING_REQUIRED');
        }
        this.shader.uniforms.uFormCoverage = record.silhouetteTexture;
        this.shader.uniforms.uMaskSize = form.maskSize;
        this.shader.uniforms.uMappedForm = form.surfaceFormEncoding === ZEN_ROCK_MINERAL_MATERIAL_VERSION ? 1 : 0;
        this.shader.uniforms.uFormAttenuation = this.shader.uniforms.uMappedForm === 1 ? 0.68 : 0.34;
        const [left, top, right, bottom] = form.bodyBounds;
        this.geometry.getBuffer('aVertexPosition').update(new Float32Array(quad(left, top, right, bottom)));
        this.geometry.getBuffer('aTextureCoord').update(new Float32Array(quad(
            0.5 + left / texture.width, 0.5 + top / texture.height,
            0.5 + right / texture.width, 0.5 + bottom / texture.height,
        )));
    }

    get texture() { return this.shader.uniforms.uMaterial; }
    set texture(texture) { this.shader.uniforms.uMaterial = texture; }

    setWorldLight(light) {
        const c = Math.cos(this.rotation);
        const s = Math.sin(this.rotation);
        const submerged = this.materialRecord.materialGeometry.kind === 'rock';
        const x = submerged ? light.submergedSunX : light.sunX;
        const y = submerged ? light.submergedSunY : light.sunY;
        const z = submerged ? light.submergedSunZ : light.sunZ;
        if (![x, y, z].every(Number.isFinite)) throw new Error('ZEN_DECOR_MATERIAL_LIGHT_REQUIRED');
        this.shader.uniforms.uLocalSun = [x * c + y * s, -x * s + y * c, Math.max(0, z)];
        this.shader.uniforms.uDirectShare = light.directShare;
    }

    setNightMaterial(chromaMix, formShade) {
        for (const value of [chromaMix, formShade]) {
            if (!Number.isFinite(value) || value < 0 || value > 1) {
                throw new Error('ZEN_DECOR_NIGHT_MATERIAL_INVALID');
            }
        }
        this.shader.uniforms.uNightChromaMix = chromaMix;
        this.shader.uniforms.uNightFormShade = formShade;
    }

    getBakeContentSignature() {
        const u = this.shader.uniforms;
        return JSON.stringify([
            ...this.geometry.getBuffer('aVertexPosition').data,
            ...this.geometry.getBuffer('aTextureCoord').data,
            u.uMaterial.baseTexture.uid, u.uMaterial._updateID,
            u.uFormCenter, u.uFormRadius, u.uFormStrength, u.uLocalSun, u.uDirectShare,
            u.uFormCoverage.baseTexture.uid, u.uFormCoverage._updateID,
            u.uMaskSize, u.uMappedForm, u.uFormAttenuation,
            u.uNightChromaMix, u.uNightFormShade,
            u.uReceiverCast.baseTexture.uid, u.uReceiverCast._updateID,
            u.uReceiverU, u.uReceiverV, u.uReceiverEnabled,
        ]);
    }

    clearReceiverShadow() {
        this.shader.uniforms.uReceiverEnabled = 0;
        this.shader.uniforms.uReceiverCast = Texture.WHITE;
        this.receiverShadowDistance = Infinity;
        this.receiverShadowSource = null;
    }

    setReceiverShadow({ record, x, y, rotation, scale, light }) {
        const extent = record.materialGeometry.maskSize * scale;
        const c = Math.cos(rotation) / extent;
        const s = Math.sin(rotation) / extent;
        this.shader.uniforms.uReceiverCast = record.silhouetteTexture;
        const receiverCos = Math.cos(this.rotation);
        const receiverSin = Math.sin(this.rotation);
        const dx = this.x - x;
        const dy = this.y - y;
        // Both geometries use scene coordinates. Camera/canvas transforms must
        // not change which part of a leaf receives a flower's shadow.
        this.shader.uniforms.uReceiverU = [
            (c * receiverCos + s * receiverSin) * this.scale.x,
            (-c * receiverSin + s * receiverCos) * this.scale.y,
            0.5 + c * dx + s * dy,
        ];
        this.shader.uniforms.uReceiverV = [
            (-s * receiverCos + c * receiverSin) * this.scale.x,
            (s * receiverSin + c * receiverCos) * this.scale.y,
            0.5 - s * dx + c * dy,
        ];
        this.shader.uniforms.uReceiverEnabled = light.directStrength > 0 ? 1 : 0;
    }

    _render(renderer) {
        const tint = this.tint;
        this.shader.uniforms.uTintAlpha = [(tint >> 16 & 255) / 255, (tint >> 8 & 255) / 255, (tint & 255) / 255, this.worldAlpha];
        super._render(renderer);
    }

    destroy(options) {
        const { shader, geometry } = this;
        super.destroy(options);
        shader.destroy();
        geometry.destroy();
    }
}

export const hasZenDecorShadowLight = (light, grounded) => (
    light.directStrength > 0.001
    || (grounded && light.directShare.some((value, index) => value + light.skyShare[index] > 0.001))
);

export const zenDecorShadowFragment = `
precision highp float;
varying vec2 vLocal;
uniform sampler2D uSilhouette;
uniform float uMaskSize;
uniform vec2 uCastOffset;
uniform vec3 uGroundedWarp;
uniform vec3 uDirectShare;
uniform vec3 uContactShare;
uniform float uContactWidth;
uniform float uContactAmount;
uniform float uPenumbra;
uniform float uGrounded;
uniform float uAmount;
float maskAt(vec2 point) {
    vec2 uv = point / uMaskSize + 0.5;
    float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
    return texture2D(uSilhouette, clamp(uv, 0.0, 1.0)).a * inside;
}
float softMaskAt(vec2 point, float blur) {
    return maskAt(point) * 0.5
        + maskAt(point + vec2(blur, blur)) * 0.25
        + maskAt(point - vec2(blur, blur)) * 0.25;
}
float groundedMaskAt(vec2 point) {
    // Invert one continuous, monotonic stretch on the shadow-facing half.
    // The sun-facing half and base stay fixed; displacement never exceeds
    // the common solar projection. No translated footprint copies are unioned.
    float progress = clamp(dot(point, uGroundedWarp.xy) * uGroundedWarp.z, 0.0, 1.0);
    return maskAt(point - uCastOffset * progress);
}
float softGroundedMaskAt(vec2 point, float blur) {
    vec2 along = uGroundedWarp.xy * blur;
    vec2 across = vec2(-along.y, along.x);
    return groundedMaskAt(point) * 0.4
        + (groundedMaskAt(point + along) + groundedMaskAt(point - along)
            + groundedMaskAt(point + across) + groundedMaskAt(point - across)) * 0.15;
}
void main() {
    float coverage = 0.0;
    float contact = 0.0;
    if (uGrounded > 0.5) {
        // Contact is a one-world-pixel dilation of the fixed base, with the
        // interior subtracted. It never follows the displaced cast footprint.
        float base = maskAt(vLocal);
        float dilated = max(max(maskAt(vLocal + vec2(uContactWidth, 0.0)), maskAt(vLocal - vec2(uContactWidth, 0.0))),
            max(maskAt(vLocal + vec2(0.0, uContactWidth)), maskAt(vLocal - vec2(0.0, uContactWidth))));
        contact = max(0.0, dilated - base);
        if (uAmount > 0.0) {
            float progress = clamp(dot(vLocal, uGroundedWarp.xy) * uGroundedWarp.z, 0.0, 1.0);
            coverage = softGroundedMaskAt(vLocal, uPenumbra * (0.25 + 0.75 * progress));
        }
    } else {
        coverage = softMaskAt(vLocal - uCastOffset, uPenumbra);
    }
    vec3 transfer = vec3(1.0) - uDirectShare * coverage * uAmount
        - uContactShare * contact * uContactAmount;
    gl_FragColor = vec4(transfer, 1.0);
}`;

export class ZenDecorShadowMesh extends Mesh {
    constructor(webGLVersion) {
        const shaderSources = resolveZenPondMaterialShaderSources({
            programId: 'decor_shadow', webGLVersion,
            vertexSrc: vertex, fragmentSrc: zenDecorShadowFragment,
        });
        super(makeGeometry(), Shader.from(shaderSources.vertex, shaderSources.fragment, {
            uSilhouette: Texture.WHITE, uMaskSize: 1, uCastOffset: [0, 0], uGroundedWarp: [0, 0, 0],
            uDirectShare: [0, 0, 0], uContactShare: [0, 0, 0], uContactWidth: 1, uContactAmount: 0, uPenumbra: 0, uGrounded: 0, uAmount: 0,
        }));
        this.size = 6;
        this.blendMode = BLEND_MODES.MULTIPLY;
        this.coverage = 0;
        this.contactCoverage = 0;
        this.visible = false;
    }

    configure({ record, x, y, rotation, scale, projection, light, grounded, strength }) {
        if (!record?.silhouetteTexture) throw new Error('ZEN_DECOR_CAST_GEOMETRY_REQUIRED');
        const { maskSize } = record.materialGeometry;
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        const dx = (projection.offsetX * c + projection.offsetY * s) / scale;
        const dy = (-projection.offsetX * s + projection.offsetY * c) / scale;
        const reach = Math.hypot(dx, dy);
        const axisX = reach > 0 ? dx / reach : 0;
        const axisY = reach > 0 ? dy / reach : 0;
        const { radiusX, radiusY } = record.materialGeometry;
        if (grounded && (!Number.isFinite(radiusX) || radiusX <= 0 || !Number.isFinite(radiusY) || radiusY <= 0)) {
            throw new Error('ZEN_DECOR_GROUNDED_FORM_RADIUS_REQUIRED');
        }
        const radius = grounded ? Math.hypot(radiusX * axisX, radiusY * axisY) : 0;
        const pad = (projection.penumbra + 1) / scale + 1;
        const half = record.materialGeometry.maskExtent;
        this.geometry.getBuffer('aVertexPosition').update(new Float32Array(quad(
            -half + Math.min(0, dx) - pad, -half + Math.min(0, dy) - pad,
            half + Math.max(0, dx) + pad, half + Math.max(0, dy) + pad,
        )));
        Object.assign(this.shader.uniforms, {
            uSilhouette: record.silhouetteTexture, uMaskSize: maskSize,
            uCastOffset: [dx, dy], uDirectShare: light.directShare,
            uGroundedWarp: grounded && reach > 0 ? [axisX, axisY, 1 / (radius + reach)] : [0, 0, 0],
            uContactShare: grounded ? light.directShare.map((value, index) => value + light.skyShare[index]) : [0, 0, 0],
            uContactWidth: 1 / scale,
            uPenumbra: projection.penumbra / scale, uGrounded: grounded ? 1 : 0,
        });
        this.position.set(x, y);
        this.rotation = rotation;
        this.scale.set(scale);
        this.coverage = light.directStrength > 0.001 ? strength : 0;
        this.contactCoverage = grounded ? 0.14 : 0;
        this.alpha = 1;
        this.visible = hasZenDecorShadowLight(light, grounded) && (strength > 0 || grounded);
    }

    _render(renderer) {
        this.shader.uniforms.uAmount = this.coverage * this.worldAlpha;
        this.shader.uniforms.uContactAmount = this.contactCoverage * this.worldAlpha;
        super._render(renderer);
    }

    getBakeContentSignature() {
        const u = this.shader.uniforms;
        // Read inputs, not uAmount/uContactAmount last written during _render:
        // a cache hit deliberately skips _render.
        return JSON.stringify([
            ...this.geometry.getBuffer('aVertexPosition').data,
            u.uSilhouette.baseTexture.uid, u.uSilhouette._updateID,
            u.uMaskSize, u.uCastOffset, u.uGroundedWarp, u.uDirectShare, u.uContactShare,
            u.uContactWidth, u.uPenumbra, u.uGrounded, this.coverage, this.contactCoverage,
        ]);
    }

    destroy(options) {
        const { shader, geometry } = this;
        super.destroy(options);
        shader.destroy();
        geometry.destroy();
    }
}
