import {
    ZEN_WORLD_CLOUD_PROJECTION_SCALE,
    ZEN_WORLD_CLOUD_HORIZON_FLOOR,
    ZEN_WORLD_CLOUD_EDGE_WIDTH,
} from '../../../../runtime/environment/zenWorldCloudField.js';

// Same angular field and bilinear density lookup as the world's sun ray.
// Reflection samples reflect(-V,N); it is never refracted with the pond floor.
export const pixiWaterSkyReflectionShader = `
uniform sampler2D uCloudField;
uniform vec2 uCloudPhase;
uniform float uCloudThreshold;
uniform float uCloudDensity;
uniform float uCloudReflectionEnabled;
uniform float uDiffuseSkylight;
uniform float uAirHaze;
uniform vec3 uMaterialLight;
uniform float uMoonlitMaterialMix;
uniform float uMoonlitSkyStrength;

vec3 ws_srgb_to_linear(vec3 color) {
    return mix(color / 12.92, pow((color + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), color));
}
vec3 ws_linear_to_srgb(vec3 color) {
    color = max(color, vec3(0.0));
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}
vec3 ws_illuminate_material(vec3 color) {
    vec3 pigment = ws_srgb_to_linear(color);
    float luminance = dot(pigment, vec3(0.2126, 0.7152, 0.0722));
    // Preserve material contrast while the shared night light sets indigo chroma.
    pigment = mix(pigment, vec3(luminance), uMoonlitMaterialMix);
    return ws_linear_to_srgb(pigment * uMaterialLight);
}

vec2 ws_cloud_uv(vec3 direction) {
    return direction.xy / max(direction.z, ${ZEN_WORLD_CLOUD_HORIZON_FLOOR.toFixed(4)})
        * ${ZEN_WORLD_CLOUD_PROJECTION_SCALE.toFixed(4)} + uCloudPhase;
}

float ws_cloud_density(vec2 uv) {
    float noise = texture2D(uCloudField, fract(uv)).r;
    return smoothstep(uCloudThreshold - ${ZEN_WORLD_CLOUD_EDGE_WIDTH.toFixed(4)},
        uCloudThreshold + ${ZEN_WORLD_CLOUD_EDGE_WIDTH.toFixed(4)}, noise) * uCloudDensity;
}

vec3 ws_apply_sky_reflection(vec3 color, vec3 view, vec3 normal, vec4 lightTransport) {
    if (uCloudReflectionEnabled < 0.5) return color;
    vec3 reflected = reflect(-view, normal);
    vec2 cloudUv = ws_cloud_uv(reflected);
    // Unresolved slopes widen the angular footprint. They soften clouds, not
    // amplify them into a white top-view decal. Resolved ripples use N above.
    float footprint = 0.004 + uSurfaceRoughness * 0.038;
    float clouds = ws_cloud_density(cloudUv) * 0.4;
    clouds += ws_cloud_density(cloudUv + vec2(footprint, 0.0)) * 0.15;
    clouds += ws_cloud_density(cloudUv - vec2(footprint, 0.0)) * 0.15;
    clouds += ws_cloud_density(cloudUv + vec2(0.0, footprint)) * 0.15;
    clouds += ws_cloud_density(cloudUv - vec2(0.0, footprint)) * 0.15;
    vec3 clearSky = vec3(0.30, 0.50, 0.72);
    vec3 cloudSky = vec3(0.86, 0.88, 0.90);
    vec3 sky = mix(clearSky, cloudSky, clamp(clouds, 0.0, 1.0));
    sky = mix(sky, vec3(0.66, 0.71, 0.75), clamp(uAirHaze, 0.0, 1.0) * 0.45);
    // Chroma follows the same world light palette as the other materials.
    sky *= mix(vec3(1.0), uSurfaceSheenColor, 0.65);
    sky *= clamp(uDiffuseSkylight * 2.3 + uMoonlitSkyStrength, 0.025, 1.2);
    float NoV = clamp(dot(normal, view), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
    float reflection = clamp(fresnel * (1.0 + uSurfaceReflectionStrength), 0.0, 0.28);
    // A leaf blocking the sun does not block the whole sky hemisphere. Broad
    // reflection uses sky visibility, never the direct-beam aperture.
    reflection *= ws_transport_response(lightTransport.b, lightTransport.a);
    return ws_linear_to_srgb(mix(ws_srgb_to_linear(color), ws_srgb_to_linear(sky), reflection));
}
`;
