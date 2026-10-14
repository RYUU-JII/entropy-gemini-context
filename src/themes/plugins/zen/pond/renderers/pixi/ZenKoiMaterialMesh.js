import { zenWaterCausticReceiverShader } from './waterSurfaceField/zenWaterCausticReceiverShader.js';
import { createZenWaterLightTransportUniforms } from './waterSurfaceField/ZenWaterLightTransport.js';
import { ZEN_POND_SHADOW_DEPTH_WORLD_UNITS } from '../../contracts/zenPondShadowGeometry.js';
import { ZEN_KOI_SHADOW_PADDING, writeZenKoiShadowWeights } from '../../contracts/zenKoiShadowMaterial.js';
import { Geometry, Mesh, Point, Shader, SimpleRope, Texture } from './zenPondPixiRuntime.js';
import { resolveZenKoiMaterialShaderSources } from './zenKoiMaterialShaderDialect.js';
import { resolveZenPondMaterialShaderSources } from './zenPondMaterialShaderDialect.js';

// An authored, pond-space upper-left key, not an astronomical moon position.
// The same unit direction serves the vertex half vector and curved body normal.
const moonKeyShader = 'const vec3 KOI_MOON_KEY = vec3(-0.36, -0.48, 0.8);';

export const zenKoiMaterialVertex = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
attribute vec2 aKoiAcross;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform vec3 uSun;
uniform vec4 uReceiverMap;
varying vec2 vUv;
varying vec2 vAcross;
varying vec3 vHalfLight;
varying vec3 vMoonHalfLight;
varying vec2 vReceiverUv;
${moonKeyShader}
void main() {
    vUv = aTextureCoord;
    vReceiverUv = aVertexPosition * uReceiverMap.xy + uReceiverMap.zw;
    vAcross = aKoiAcross;
    vHalfLight = normalize(uSun + vec3(0.0, 0.0, 1.0));
    vMoonHalfLight = normalize(KOI_MOON_KEY + vec3(0.0, 0.0, 1.0));
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

export const zenKoiMaterialFragment = `
precision highp float;
varying vec2 vUv;
varying vec2 vAcross;
varying vec3 vHalfLight;
varying vec3 vMoonHalfLight;
varying vec2 vReceiverUv;
uniform sampler2D uMaterial;
uniform sampler2D uForm;
uniform vec3 uSun;
uniform vec3 uDirectShare;
uniform vec3 uHighlightTint;
uniform vec4 uTintAlpha;
uniform vec2 uBodyDepth;
uniform float uMoonlitPresence;
uniform float uDepthHaze;
${moonKeyShader}
${zenWaterCausticReceiverShader}
void main() {
    vec4 pigment = texture2D(uMaterial, vUv);
    vec3 form = texture2D(uForm, vUv).rgb;
    vec2 across = vAcross * inversesqrt(max(dot(vAcross, vAcross), 0.00001));
    vec3 normal = normalize(vec3(across * (form.r * 2.0 - 1.0), form.g));
    float facing = max(0.0, dot(normal, uSun));
    vec3 diffuse = (0.94 + 0.06 * normal.z) * (vec3(1.0) - uDirectShare * (1.0 - facing) * 0.38 * (1.0 - uDepthHaze * 0.45));
    float shine = max(0.0, dot(normal, vHalfLight));
    shine *= shine; shine *= shine; shine *= shine; shine *= shine;
    // Broad wet-skin sheen with a sparse baked scale response. No sparkle clock,
    // normal reconstruction, noise loop or per-scale draw in the frame path.
    vec3 specular = uDirectShare * uHighlightTint * shine * (0.06 + form.b * 0.16) * (1.0 - uDepthHaze * 0.5);
    vec3 color = pigment.rgb * uTintAlpha.rgb * diffuse + pigment.a * specular;
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(color, vec3(luminance), uDepthHaze * 0.35);
    if (uMoonlitPresence > 0.0001) {
        float moonFacing = max(0.0, dot(normal, KOI_MOON_KEY));
        float moonShine = max(0.0, dot(normal, vMoonHalfLight));
        moonShine *= moonShine; moonShine *= moonShine; moonShine *= moonShine;
        // The moving cross-axis reveals a broad silver sheen. Keep the pigment
        // and alpha; the canonical surface pass still illuminates this material.
        color *= 1.0 - uMoonlitPresence * (1.0 - moonFacing) * 0.4;
        color += pigment.a * vec3(0.88, 0.94, 1.0) * uMoonlitPresence
            * moonShine * (0.12 + form.b * 0.24);
    }
    if (uSurfaceFieldReady > 0.5 && uCausticStrength > 0.0001 && pigment.a > 0.01) {
        // Canonical fish depth locates the back. Sides of the cached curved
        // cross-section sit deeper; no flat bottom UV or camera transform is used.
        float depth = min(1.0, uBodyDepth.x + (1.0 - form.g) * uBodyDepth.y);
        vec3 caustic = sampleZenWaterCaustic(vReceiverUv, depth, normal).rgb;
        color += pigment.rgb * uTintAlpha.rgb * caustic;
    }
    gl_FragColor = vec4(color, pigment.a) * uTintAlpha.a;
}`;

export const zenKoiShadowVertex = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
varying vec2 vUv;
void main() {
    vUv = aTextureCoord;
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

export const zenKoiShadowFragment = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMaterial;
uniform vec3 uSoftWeights;
uniform float uAlpha;
void main() {
    // One read interpolates three prefiltered masks, including the core.
    float coverage = dot(texture2D(uMaterial, vUv).rgb, uSoftWeights);
    gl_FragColor = vec4(0.0, 0.0, 0.0, coverage * uAlpha);
}`;

const writeTint = (target, tint) => {
    target[0] = (tint >> 16 & 255) / 255;
    target[1] = (tint >> 8 & 255) / 255;
    target[2] = (tint & 255) / 255;
};
const createShader = (texture, body, form, shaderSources) => {
    const shader = Shader.from(shaderSources.vertex, shaderSources.fragment,
        body ? { uMaterial: texture, uForm: form, uSun: [0, 0, 1], uDirectShare: [0, 0, 0],
            uHighlightTint: [1, 1, 1], uTintAlpha: [1, 1, 1, 1], uMoonlitPresence: 0, uDepthHaze: 0,
            uSurfaceField: Texture.EMPTY, uSurfaceFieldReady: 0, uFieldTexel: [1, 1],
            uSunDir: [0, 0, 1], uRefractedSun: [0, 0, -1], uLightColor: [1, 1, 1],
            uCausticStrength: 0, uWorldAspect: 1, uTurbidity: 0,
            uOpticalDepthScale: 1, uSurfaceFieldMap: [1, 1, 0, 0],
            ...createZenWaterLightTransportUniforms(),
            uReceiverMap: [0, 0, 0, 0], uBodyDepth: [0, 0] }
            : { uMaterial: texture, uSoftWeights: [1, 0, 0], uAlpha: 1 });
    // Mesh.texture and SimpleRope use this canonical shader property.
    Object.defineProperty(shader, 'texture', { get() { return this.uniforms.uMaterial; }, set(value) { this.uniforms.uMaterial = value; } });
    shader.tint = 0xffffff;
    return shader;
};

export class ZenKoiMaterialRope extends SimpleRope {
    constructor(texture, points, form, webGLVersion) {
        if (!form) throw new Error('ZEN_KOI_FORM_TEXTURE_REQUIRED');
        const bodyShaderSources = resolveZenKoiMaterialShaderSources({
            webGLVersion,
            vertexSrc: zenKoiMaterialVertex,
            fragmentSrc: zenKoiMaterialFragment,
        });
        super(texture, points);
        this.shader.destroy();
        this.shader = createShader(texture, true, form, bodyShaderSources);
        this.geometry.addAttribute('aKoiAcross', new Float32Array(points.length * 4), 2);
    }

    setFormTexture(texture) {
        if (!texture) throw new Error('ZEN_KOI_FORM_TEXTURE_REQUIRED');
        this.shader.uniforms.uForm = texture;
    }

    setWorldLight(light) {
        if (!Number.isFinite(light?.submergedSunX) || !Number.isFinite(light?.submergedSunY)
            || !Number.isFinite(light?.submergedSunZ) || light.directShare?.length !== 3) {
            throw new Error('ZEN_KOI_MATERIAL_LIGHT_REQUIRED');
        }
        const u = this.shader.uniforms;
        u.uSun[0] = light.submergedSunX; u.uSun[1] = light.submergedSunY; u.uSun[2] = light.submergedSunZ;
        for (let i = 0; i < 3; i++) u.uDirectShare[i] = light.directShare[i];
    }

    setWaterHaze(haze) {
        if (!Number.isFinite(haze) || haze < 0 || haze > 1) throw new Error('ZEN_KOI_WATER_HAZE_REQUIRED');
        this.shader.uniforms.uDepthHaze = haze;
    }

    setMoonlightPresence(lighting, depth) {
        // null explicitly disables this presentation for standalone callers.
        if (lighting === null) { this.shader.uniforms.uMoonlitPresence = 0; return; }
        const strength = lighting?.moonlitPresence;
        if (!Number.isFinite(strength) || strength < 0 || strength > 1
            || !Number.isFinite(depth) || depth < 0 || depth > 1) {
            throw new Error('ZEN_KOI_MOONLIGHT_PRESENTATION_REQUIRED');
        }
        this.shader.uniforms.uMoonlitPresence = strength * (1 - depth * 0.5);
    }

    setCausticReceiver(receiver, depth, size) {
        const u = this.shader.uniforms;
        if (receiver === null || receiver.active === false) {
            u.uSurfaceFieldReady = 0; u.uCausticStrength = 0; u.uSurfaceField = Texture.EMPTY;
            u.uWaterLightTransportReady = 0; u.uWaterLightTransport = Texture.EMPTY;
            return;
        }
        if (receiver.active !== true || !receiver.texture || receiver.texture.destroyed || !receiver.uniforms
            || !Number.isFinite(receiver.width) || !Number.isFinite(receiver.height)
            || !(receiver.width > 0 && receiver.height > 0)
            || !Number.isFinite(depth) || depth < 0 || depth > 1 || !Number.isFinite(size) || size <= 0) {
            throw new Error('ZEN_KOI_CAUSTIC_RECEIVER_INVALID');
        }
        const shared = receiver.uniforms;
        if (!Number.isFinite(shared.uOpticalDepthScale) || shared.uOpticalDepthScale <= 0
            || shared.uSurfaceFieldMap?.length !== 4
            || (shared.uWaterLightTransportReady !== 0 && shared.uWaterLightTransportReady !== 1)) {
            throw new Error('ZEN_KOI_CAUSTIC_OPTICAL_DOMAIN_INVALID');
        }
        u.uSurfaceField = receiver.texture; u.uSurfaceFieldReady = 1;
        u.uFieldTexel = shared.uFieldTexel; u.uSunDir = shared.uSunDir;
        u.uRefractedSun = shared.uRefractedSun; u.uLightColor = shared.uLightColor;
        u.uCausticStrength = shared.uCausticStrength; u.uWorldAspect = shared.uWorldAspect;
        u.uTurbidity = shared.uTurbidity;
        u.uOpticalDepthScale = shared.uOpticalDepthScale;
        u.uSurfaceFieldMap = shared.uSurfaceFieldMap;
        u.uWaterLightTransport = shared.uWaterLightTransport;
        u.uWaterLightTransportReady = shared.uWaterLightTransportReady;
        u.uWaterLightBounds = shared.uWaterLightBounds;
        // Rope coordinates are in pond space. Apply only its local visual
        // scale/pivot; the ancestor camera/viewport transform must not move light.
        u.uReceiverMap[0] = this.scale.x / receiver.width;
        u.uReceiverMap[1] = this.scale.y / receiver.height;
        u.uReceiverMap[2] = (this.position.x - this.pivot.x * this.scale.x) / receiver.width;
        u.uReceiverMap[3] = (this.position.y - this.pivot.y * this.scale.y) / receiver.height;
        u.uBodyDepth[0] = depth;
        u.uBodyDepth[1] = size * this.scale.x * 0.22 / ZEN_POND_SHADOW_DEPTH_WORLD_UNITS;
    }

    setHighlightTint(tint) {
        if (this._highlightTint === tint) return 0;
        writeTint(this.shader.uniforms.uHighlightTint, tint); this._highlightTint = tint;
        return 1;
    }

    updateMaterialGeometry() {
        const geometry = this.geometry;
        geometry._width = this.texture.height;
        geometry.update();
        const positions = geometry.getBuffer('aVertexPosition').data;
        const buffer = geometry.getBuffer('aKoiAcross');
        if (buffer.data.length !== positions.length) buffer.data = new Float32Array(positions.length);
        const across = buffer.data;
        // UV y increases from the first edge to the second. Reuse the already
        // calculated rope cross-axis; no second spine solver or trigonometry.
        const inverseWidth = 1 / Math.max(0.001, geometry._width);
        for (let i = 0; i < positions.length; i += 4) {
            across[i] = across[i + 2] = (positions[i + 2] - positions[i]) * inverseWidth;
            across[i + 1] = across[i + 3] = (positions[i + 3] - positions[i + 1]) * inverseWidth;
        }
        buffer.update();
    }

    _render(renderer) {
        this.updateMaterialGeometry();
        const tint = this.shader.uniforms.uTintAlpha;
        writeTint(tint, this.tint); tint[3] = this.worldAlpha;
        Mesh.prototype._render.call(this, renderer);
    }

    destroy(options) { const shader = this.shader; super.destroy(options); shader.destroy(); }
}

export class ZenKoiShadowRope extends SimpleRope {
    constructor(texture, points, webGLVersion) {
        const shaderSources = resolveZenPondMaterialShaderSources({
            programId: 'koi_shadow', webGLVersion,
            vertexSrc: zenKoiShadowVertex, fragmentSrc: zenKoiShadowFragment,
        });
        super(texture, [new Point(), ...points, new Point()]);
        this.sourcePoints = points;
        this.shader.destroy(); this.shader = createShader(texture, false, undefined, shaderSources);
    }
    setPenumbra(width) { writeZenKoiShadowWeights(this.shader.uniforms.uSoftWeights, width); }
    updateShadowGeometry() {
        const points = this.sourcePoints, geometry = this.geometry;
        const pad = ZEN_KOI_SHADOW_PADDING;
        const first = points[0], next = points[1], last = points.at(-1), previous = points.at(-2);
        const headLength = Math.hypot(first.x - next.x, first.y - next.y);
        const tailLength = Math.hypot(last.x - previous.x, last.y - previous.y);
        const extension = pad * headLength * (points.length - 1) / Math.max(1, this.texture.width - pad * 2);
        geometry.points[0].set(first.x + (first.x - next.x) * extension / Math.max(0.001, headLength), first.y + (first.y - next.y) * extension / Math.max(0.001, headLength));
        geometry.points.at(-1).set(last.x + (last.x - previous.x) * extension / Math.max(0.001, tailLength), last.y + (last.y - previous.y) * extension / Math.max(0.001, tailLength));
        geometry._width = this.texture.height;
        geometry.update();
        const bounds = this.texture.zenKoiShadowBounds;
        if (!bounds) throw new Error('ZEN_KOI_SHADOW_COVERAGE_BOUNDS_REQUIRED');
        const weights = this.shader.uniforms.uSoftWeights;
        const band = weights[2] > 0 ? 2 : weights[1] > 0 ? 1 : 0;
        if (this._shadowBounds !== bounds || this._shadowBand !== band) {
            const buffer = geometry.getBuffer('aTextureCoord');
            const width = this.texture.width;
            for (let i = 0; i < geometry.points.length; i++) {
                const u = i === 0 ? 0 : i === geometry.points.length - 1 ? 1
                    : (pad + (i - 1) / (points.length - 1) * (width - 2 * pad)) / width;
                const col = Math.max(0, Math.min(width - 1, Math.floor(u * width)));
                const left = Math.max(0, col - 1) * 6 + band * 2;
                const right = Math.min(width - 1, col + 1) * 6 + band * 2;
                buffer.data[i * 4] = buffer.data[i * 4 + 2] = u;
                buffer.data[i * 4 + 1] = Math.min(bounds[left], bounds[col * 6 + band * 2], bounds[right]);
                buffer.data[i * 4 + 3] = Math.max(bounds[left + 1], bounds[col * 6 + band * 2 + 1], bounds[right + 1]);
            }
            buffer.update(); this._shadowBounds = bounds; this._shadowBand = band;
        }
        const vertices = geometry.getBuffer('aVertexPosition'), uv = geometry.getBuffer('aTextureCoord').data;
        for (let i = 0; i < vertices.data.length; i += 4) {
            const x = vertices.data[i], y = vertices.data[i + 1];
            const dx = vertices.data[i + 2] - x, dy = vertices.data[i + 3] - y;
            vertices.data[i] = x + dx * uv[i + 1]; vertices.data[i + 1] = y + dy * uv[i + 1];
            vertices.data[i + 2] = x + dx * uv[i + 3]; vertices.data[i + 3] = y + dy * uv[i + 3];
        }
        vertices.update();
    }
    _render(renderer) {
        this.updateShadowGeometry(); this.shader.uniforms.uAlpha = this.worldAlpha;
        Mesh.prototype._render.call(this, renderer);
    }
    destroy(options) { const shader = this.shader; super.destroy(options); shader.destroy(); }
}

// A four-vertex tail with the Sprite anchor/transform contract, using the same
// one-read shadow material as the body. It adds no filter or offscreen target.
export class ZenKoiShadowTail extends Mesh {
    constructor(texture, webGLVersion) {
        const shaderSources = resolveZenPondMaterialShaderSources({
            programId: 'koi_shadow', webGLVersion,
            vertexSrc: zenKoiShadowVertex, fragmentSrc: zenKoiShadowFragment,
        });
        super(new Geometry().addAttribute('aVertexPosition', new Float32Array(8), 2)
            .addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]), createShader(texture, false, undefined, shaderSources));
        this.anchor = new Point(0.5, 0.5);
        this.size = 6;
        this._tailWidth = this._tailHeight = this._tailAnchorX = this._tailAnchorY = Number.NaN;
    }
    setPenumbra(width) { writeZenKoiShadowWeights(this.shader.uniforms.uSoftWeights, width); }
    updateTailGeometry() {
        const { width, height } = this.texture;
        if (width !== this._tailWidth || height !== this._tailHeight
            || this.anchor.x !== this._tailAnchorX || this.anchor.y !== this._tailAnchorY) {
            const x = -this.anchor.x * width, y = -this.anchor.y * height;
            const buffer = this.geometry.getBuffer('aVertexPosition');
            buffer.data.set([x, y, x + width, y, x + width, y + height, x, y + height]); buffer.update();
            this._tailWidth = width; this._tailHeight = height;
            this._tailAnchorX = this.anchor.x; this._tailAnchorY = this.anchor.y;
        }
    }
    _calculateBounds() { this.updateTailGeometry(); super._calculateBounds(); }
    _render(renderer) {
        this.updateTailGeometry();
        this.shader.uniforms.uAlpha = this.worldAlpha;
        super._render(renderer);
    }
    destroy(options) { const shader = this.shader; super.destroy(options); shader.destroy(); }
}
