import {
    ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL,
} from '../../../contracts/zenWaterSurfaceFieldYoonseulModel.js';

const toShaderFloat = (value) => Number(value).toFixed(3);

export const pixiWaterSurfaceFieldYoonseulOnlyBaseShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputClamp;
uniform vec4 inputSize;
uniform vec2 uResolution;
uniform vec2 uFilterOrigin;
uniform vec2 uWorldResolution;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSurfaceReflectionStrength;
uniform vec3 uSurfaceSheenColor;
uniform float uYoonseulEnabled;
uniform float uYoonseulIntensity;
uniform float uYoonseulOpacity;
uniform float uYoonseulFocus;
uniform float uSurfaceRoughness;
uniform float uRefractionVisibility;
uniform float uRainRippleVisibilityDrive;
uniform sampler2D uSurfaceField;
uniform float uSurfaceFieldReady;

const float PI = 3.14159265359;
`;

export const pixiWaterSurfaceFieldOpticsBaseShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputClamp;
uniform vec4 inputSize;
uniform vec2 uResolution;
uniform vec2 uFilterOrigin;
uniform vec2 uWorldResolution;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSurfaceReflectionColor;
uniform float uSurfaceReflectionStrength;
uniform vec3 uSurfaceSheenColor;
uniform float uRefractionMix;
uniform float uScreenRefractionEnabled;
uniform float uSurfaceReflectionEnabled;
uniform float uRgbSplitEnabled;
uniform float uYoonseulEnabled;
uniform float uYoonseulIntensity;
uniform float uYoonseulOpacity;
uniform float uYoonseulFocus;
uniform float uSurfaceRoughness;
uniform float uRefractionVisibility;
uniform float uRainRippleVisibilityDrive;
uniform sampler2D uSurfaceField;
uniform float uSurfaceFieldReady;

const float PI = 3.14159265359;
`;

export const pixiWaterSurfaceFieldConsumerShader = `
const float WS_SURFACE_FIELD_SLOPE_RANGE = 5.0;
// Peak displacement, in filter texels, applied to the single base sample so
// the benthic layer bends with the surface it is seen through.
const float WS_BENTHIC_REFRACTION_TEXELS = 7.4;

vec2 ws_decode_surface_field_slope(vec4 fieldSample) {
    return (fieldSample.rg * 2.0 - 1.0) * WS_SURFACE_FIELD_SLOPE_RANGE;
}

float ws_decode_surface_field_height(vec4 fieldSample) {
    return (fieldSample.b - 0.5) / 1.18;
}

float ws_decode_surface_field_curvature(vec4 fieldSample) {
    return fieldSample.a * 2.0 - 1.0;
}

vec3 ws_surface_field_normal(vec4 fieldSample) {
    vec2 slope = ws_decode_surface_field_slope(fieldSample);
    return normalize(vec3(-slope * 0.18, 1.0));
}

// Snell displacement of everything read through the surface, reusing the
// normal already decoded from the shared field. This adds no texture fetch:
// the one base sample simply moves. Without it the floor, rocks and koi stay
// rigid under a moving surface, which reads as a still image behind glass
// rather than as water.
vec2 ws_surface_field_benthic_offset(
    vec3 normal,
    vec2 uv,
    vec2 texel,
    vec2 clampMin,
    vec2 clampMax
) {
    float visibility = clamp(uRefractionVisibility, 0.0, 1.0);
    vec2 offset = normal.xy * texel * (WS_BENTHIC_REFRACTION_TEXELS * visibility);
    // Fade toward the sampler border so the clamp cannot smear the edge row
    // across the frame, then bound the step by the room actually left.
    vec2 edgeRoom = max(min(uv - clampMin, clampMax - uv), vec2(0.0));
    float edgeTexels = min(
        edgeRoom.x / max(texel.x, 1e-6),
        edgeRoom.y / max(texel.y, 1e-6)
    );
    offset *= smoothstep(0.0, 10.0, edgeTexels);
    vec2 limit = max(edgeRoom, texel * 2.0);
    return offset / (1.0 + abs(offset) / limit);
}

vec3 ws_surface_field_view(vec2 worldUv, vec2 worldResolution, vec4 fieldSample) {
    vec2 ndc = worldUv * 2.0 - 1.0;
    ndc.x *= worldResolution.x / max(worldResolution.y, 1.0);
    vec3 ro = vec3(0.0, 0.0, 2.25);
    vec3 rd = normalize(vec3(ndc, -1.55));
    float tHit = ro.z / max(0.0001, -rd.z);
    float height = ws_decode_surface_field_height(fieldSample);
    vec3 position = vec3((ro + rd * tHit).xy, height * 0.1);
    vec3 perspectiveView = normalize(ro - position);
    float viewObliqueness = clamp(1.0 - perspectiveView.z, 0.0, 1.0);
    // The pond is presented as a top-down world and Home uses a central crop.
    // Keep only a bounded trace of perspective so screen position cannot pin
    // the specular crossing to one edge.
    float topViewBlend = mix(
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.topViewBlendMin,
    )},
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.topViewBlendMax,
    )},
        smoothstep(0.06, 0.40, viewObliqueness)
    );
    vec3 view = normalize(mix(
        perspectiveView,
        vec3(0.0, 0.0, 1.0),
        topViewBlend
    ));
    return view;
}

vec3 ws_apply_surface_field_yoonseul(
    vec3 color,
    vec2 worldUv,
    vec2 worldResolution,
    vec4 fieldSample,
    vec3 normal,
    vec4 lightTransport
) {
    if (uYoonseulEnabled < 0.5) return color;
    vec3 view = ws_surface_field_view(worldUv, worldResolution, fieldSample);
    vec3 light = uSunDir;
    vec3 halfVector = normalize(light + view);
    float NoL = clamp(dot(normal, light), 0.0, 1.0);
    float NoV = clamp(dot(normal, view), 0.0, 1.0);
    float NoH = clamp(dot(normal, halfVector), 0.0, 1.0);
    float VoH = clamp(dot(view, halfVector), 0.0, 1.0);
    vec2 surfaceSlope = ws_decode_surface_field_slope(fieldSample);
    float curvature = abs(ws_decode_surface_field_curvature(fieldSample));
    float curvatureDetail = smoothstep(0.015, 0.42, curvature);
    float materialRoughness = mix(0.055, 0.18, clamp(uSurfaceRoughness, 0.0, 1.0));
    float roughness = materialRoughness
        * mix(1.08, 0.88, clamp(uYoonseulFocus, 0.0, 1.0))
        * mix(1.06, 1.18, curvatureDetail);
    roughness = clamp(roughness, 0.045, 0.2);

    // The field texture stores a resolved surface normal. A single narrow GGX
    // lobe leaves large regions with no subpixel slope capable of catching the
    // light, so represent the unresolved capillary population as a low-energy
    // shoulder around the same canonical normal. Both lobes share geometry and
    // Fresnel work, and the field still costs exactly one texture fetch.
    float coreAlpha = max(0.001, roughness * roughness);
    float coverageRoughness = clamp(
        roughness * ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessScale,
    )}
            + ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessBias,
    )},
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessMin,
    )},
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageRoughnessMax,
    )}
    );
    float coverageAlpha = max(0.001, coverageRoughness * coverageRoughness);
    float coreDistribution = D_GGX(NoH, coreAlpha);
    float coverageDistribution = D_GGX(NoH, coverageAlpha);
    float coverageWeight = mix(
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageWeightUnfocused,
    )},
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageWeightFocused,
    )},
        clamp(uYoonseulFocus, 0.0, 1.0)
    ) * mix(
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageCurvatureMin,
    )},
        ${toShaderFloat(
        ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.coverageCurvatureMax,
    )},
        curvatureDetail
    );
    float distribution = mix(coreDistribution, coverageDistribution, coverageWeight);
    float geometryK = (roughness + 1.0);
    geometryK = (geometryK * geometryK) / 8.0;
    float geometry = G_Smith(NoV, NoL, geometryK);
    vec3 fresnel = fresnelSchlick(VoH, vec3(0.02));
    vec3 specular = (distribution * geometry * fresnel)
        / max(0.0006, 4.0 * NoV * NoL);
    float specularLuma = dot(specular, vec3(0.2126, 0.7152, 0.0722));
    float crossing = smoothstep(
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.crossingLumaMin)},
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.crossingLumaMax)},
        specularLuma
    );
    float horizonMask = smoothstep(0.06, 0.4, NoV);
    // Overcast rain removes the direct-light drive that normally reveals the
    // canonical field. Restore only a bounded diffuse-sky response; the rain
    // rings are already encoded in the same low-resolution slope texture.
    float drive = clamp(
        uYoonseulIntensity * uYoonseulOpacity
        + uRainRippleVisibilityDrive,
        0.0,
        4.0
    );
    // Keep the broad capillary shoulder and lift real sun-aligned crossings.
    // A gentler peak compression gives these finite wave-shaped fragments a
    // bright center; no point mask, extra field sample or glint clock is used.
    float energyGuard = 1.0 / (1.0 + specularLuma
        * ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.peakCompression)});
    vec3 highlight = (
        specular * uSunColor
            * ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.specularGain)}
        + uSunColor * crossing * (
            ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.crossingBaseGain)}
            + curvature * ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.crossingCurvatureGain)}
        )
    ) * NoL * horizonMask * drive * energyGuard;
    // A narrow absolute BRDF crossing rarely fires at low sun angles. Compare
    // the existing coverage lobe against the flat surface under THIS same
    // sun/view half-vector. Only real sun-facing waves gain a bounded accent;
    // a flat surface remains below the crossing and cannot become a sheen.
    float flatCoverage = D_GGX(clamp(halfVector.z, 0.0, 1.0), coverageAlpha);
    float relativeShoulder = coverageDistribution / max(0.00001, flatCoverage);
    float obliqueResponse = smoothstep(
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.obliqueResponseStart)},
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.obliqueResponseFull)},
        1.0 - clamp(light.z, 0.0, 1.0)
    );
    float shoulderCrossing = smoothstep(
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.relativeShoulderMin)},
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.relativeShoulderMax)},
        relativeShoulder
    );
    // Curvature comes from the same animated field, so fragments turn over
    // with their wave instead of blinking on an unrelated time/patch mask.
    float shoulderShape = smoothstep(
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.shoulderCurvatureMin)},
        ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.shoulderCurvatureMax)},
        curvature
    );
    highlight += uSunColor * shoulderCrossing * shoulderShape * obliqueResponse
        * (
            ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.shoulderFragmentGain)}
            + curvature * ${toShaderFloat(ZEN_WATER_SURFACE_FIELD_YOONSEUL_MODEL.shoulderCurvatureGain)}
        ) * NoL * horizonMask * drive;
    float rainRing = 0.0;
    if (uRainRippleVisibilityDrive > 0.0001) {
        float rainVisibility = clamp(
            uRainRippleVisibilityDrive / 0.27,
            0.0,
            1.0
        );
        float rainSlopeEnergy = dot(surfaceSlope, surfaceSlope);
        rainRing = smoothstep(
            1.3225,
            5.5225,
            rainSlopeEnergy
        ) * rainVisibility;
    }
    vec3 rainSkyTint = mix(
        vec3(0.68, 0.76, 0.79),
        uSurfaceSheenColor,
        0.24
    );
    // Unresolved slopes average a slightly wider solar aperture. The broad
    // reflected sky and diffuse rain response retain their separate budget.
    float beamVisibility = mix(lightTransport.r, lightTransport.g, uSurfaceRoughness * 0.35);
    highlight *= ws_transport_response(beamVisibility, lightTransport.a);
    float skyVisibility = ws_transport_response(lightTransport.b, lightTransport.a);
    vec3 addedLight = max(highlight + rainSkyTint * rainRing * 0.075 * skyVisibility, vec3(0.0));
    // Shoulder only the added radiance. Zero highlights preserve the material.
    vec3 room = max(vec3(1.0) - color, vec3(0.0001));
    return clamp(color + room * (vec3(1.0) - exp(-addedLight / room)), 0.0, 1.0);
}
`;

export const pixiWaterSurfaceFieldYoonseulOnlyMainShader = `
void main(void) {
    if (uSurfaceFieldReady < 0.5) {
        gl_FragColor = vec4(1.0, 0.0, 0.2, 1.0);
        return;
    }
    vec2 uv = vTextureCoord;
    // Pixi allocates pooled filter inputs at power-of-two dimensions, so the
    // valid source rect usually occupies only part of the sampler. Recover
    // filter-local pixels from the sampler extent before adding world origin.
    vec2 filterPixel = uv * inputSize.xy;
    vec2 worldPixel = uFilterOrigin + filterPixel;
    vec2 worldResolution = max(uWorldResolution, vec2(1.0));
    vec2 worldUv = clamp(worldPixel / worldResolution, vec2(0.0), vec2(1.0));
    vec4 fieldSample = texture2D(uSurfaceField, surfaceFieldUv(worldUv));
    vec4 lightTransport = ws_sample_light_transport(worldUv);
    vec3 normal = ws_surface_field_normal(fieldSample);
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec2 baseClampMin = inputClamp.xy + texel * 0.5;
    vec2 baseClampMax = inputClamp.zw - texel * 0.5;
    baseClampMin = min(baseClampMin, baseClampMax - texel);
    baseClampMax = max(baseClampMax, baseClampMin + texel);
    vec2 benthicOffset = ws_surface_field_benthic_offset(
        normal,
        uv,
        texel,
        baseClampMin,
        baseClampMax
    );
    vec4 color = texture2D(uSampler, clamp(uv + benthicOffset, baseClampMin, baseClampMax));
    color.rgb = ws_illuminate_material(color.rgb);
    color.rgb = ws_apply_sky_reflection(color.rgb,
        ws_surface_field_view(worldUv, worldResolution, fieldSample), normal, lightTransport);
    color.rgb = ws_apply_surface_field_yoonseul(
        color.rgb,
        worldUv,
        worldResolution,
        fieldSample,
        normal,
        lightTransport
    );
    gl_FragColor = color;
}
`;

export const pixiWaterSurfaceFieldOpticsMainShader = `
void main(void) {
    if (uSurfaceFieldReady < 0.5) {
        gl_FragColor = vec4(1.0, 0.0, 0.2, 1.0);
        return;
    }
    vec2 uv = vTextureCoord;
    vec2 filterPixel = uv * inputSize.xy;
    vec2 worldPixel = uFilterOrigin + filterPixel;
    vec2 worldResolution = max(uWorldResolution, vec2(1.0));
    vec2 worldUv = clamp(worldPixel / worldResolution, vec2(0.0), vec2(1.0));
    vec4 fieldSample = texture2D(uSurfaceField, surfaceFieldUv(worldUv));
    vec4 lightTransport = ws_sample_light_transport(worldUv);
    vec3 normal = ws_surface_field_normal(fieldSample);

    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec2 baseClampMin = inputClamp.xy + texel * 0.5;
    vec2 baseClampMax = inputClamp.zw - texel * 0.5;
    baseClampMin = min(baseClampMin, baseClampMax - texel);
    baseClampMax = max(baseClampMax, baseClampMin + texel);
    vec2 clampMin = inputClamp.xy + texel * 4.0;
    vec2 clampMax = inputClamp.zw - texel * 4.0;
    clampMin = min(clampMin, clampMax - texel);
    clampMax = max(clampMax, clampMin + texel);
    vec2 distort = normal.xy * texel * 2.35;
    vec2 edgeDist = min(uv - clampMin, clampMax - uv);
    float edgePx = min(edgeDist.x / max(texel.x, 1e-6), edgeDist.y / max(texel.y, 1e-6));
    distort *= smoothstep(0.0, 8.0, edgePx);
    vec2 edgeRoom = max(min(uv - clampMin, clampMax - uv), vec2(0.0));
    vec2 limit = max(edgeRoom, texel * 2.0);
    vec2 safeDistort = distort / (1.0 + abs(distort) / limit);
    vec4 color = ws_compose_screen_refraction(
        uv,
        safeDistort,
        clampMin,
        clampMax,
        baseClampMin,
        baseClampMax,
        1.0,
        0.0
    );
    color.rgb = ws_illuminate_material(color.rgb);
    color.rgb = ws_apply_sky_reflection(color.rgb,
        ws_surface_field_view(worldUv, worldResolution, fieldSample), normal, lightTransport);
    color.rgb = ws_apply_surface_field_yoonseul(
        color.rgb,
        worldUv,
        worldResolution,
        fieldSample,
        normal,
        lightTransport
    );
    gl_FragColor = color;
}
`;
