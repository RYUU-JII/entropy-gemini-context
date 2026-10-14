import { zenWaterSurfaceDomainShader } from './zenWaterOpticalDomain.js';
import { zenWaterLightTransportShader } from './zenWaterLightTransportShader.js';

// One refracted receiver projection shared by pond bottom and submerged bodies.
// Call only for visible receiver coverage; the caller owns material composition.
import { ZEN_WATER_AIR_TO_WATER_ETA } from '../../../contracts/zenWaterOptics.js';

export const zenWaterCausticReceiverShader = `
uniform sampler2D uSurfaceField;
uniform float uSurfaceFieldReady;
uniform vec2 uFieldTexel;
uniform vec3 uSunDir;
uniform vec3 uRefractedSun;
uniform vec3 uLightColor;
uniform float uCausticStrength;
uniform float uWorldAspect;
uniform float uTurbidity;
uniform float uOpticalDepthScale;
${zenWaterSurfaceDomainShader}
${zenWaterLightTransportShader}
const float AIR_TO_WATER_ETA = ${ZEN_WATER_AIR_TO_WATER_ETA};

vec3 resolveSurfaceNormal(vec4 fieldSample) {
    vec2 slope = (fieldSample.rg * 2.0 - 1.0) * 5.0;
    return normalize(vec3(-slope * 0.18, 1.0));
}

vec2 rayTravel(vec3 ray, float depth) {
    return ray.xy / max(0.16, -ray.z)
        * vec2(1.0 / uWorldAspect, 1.0) * depth * uOpticalDepthScale;
}

vec2 projectSurfaceRay(vec2 uv, vec4 fieldSample, float depth) {
    return uv + rayTravel(refract(-uSunDir, resolveSurfaceNormal(fieldSample), AIR_TO_WATER_ETA), depth);
}

vec2 resolveFlatSurfaceSource(vec2 receiverUv, float depth) {
    return receiverUv - rayTravel(uRefractedSun, depth);
}

float resolveProjectionConvergence(vec2 dx, vec2 dy) {
    // Principal contraction of the symmetric ray-map Jacobian in world metric.
    // abs(det J) lights BOTH zero crossings around an overfocused wave crest.
    // A monotone contraction response keeps one crest instead of tracing those
    // two edges. This is a bounded light-ridge approximation, not a fold solver.
    float xx = 1.0 - dx.x;
    float yy = 1.0 - dy.y;
    float xy = -0.5 * (dy.x * uWorldAspect + dx.y / uWorldAspect);
    float separation = length(vec2(xx - yy, 2.0 * xy));
    float contraction = max(0.0, 0.5 * (xx + yy + separation));
    // Preserve the authored ridge contrast independently of transport distance.
    // This gain is a presentation response, never a ray displacement or depth.
    float crest = min(contraction * (0.8 / uOpticalDepthScale), 8.0);
    float crestSquared = crest * crest;
    float core = crestSquared * crestSquared * crestSquared;
    // Reserve bright coverage for the strongly converging crest. The former
    // early saturation filled its shoulders into broad luminous sheets.
    // Keep the monotone single crest and the existing world-space aperture.
    return core / (64.0 + core);
}

vec4 sampleZenWaterCaustic(vec2 receiverUv, float depth, vec3 receiverNormal) {
    vec2 flatSource = resolveFlatSurfaceSource(receiverUv, depth);
    vec4 centerField = texture2D(uSurfaceField, surfaceFieldUv(flatSource));
    // One inverse-map correction makes the focused feature land on the
    // receiver. Reuse the existing fifth tap; there is no second surface solve.
    vec2 error = projectSurfaceRay(flatSource, centerField, depth) - receiverUv;
    vec2 source = flatSource - clamp(error, vec2(-0.012), vec2(0.012));
    float depthPhase = smoothstep(0.25, 1.0, depth);
    // The light footprint lives in world space, not a fixed count of field
    // texels. The existing broad surface height opens/closes the aperture, so
    // large and small creases coexist and breathe with the water. Fine glint
    // ripples remain intact in the shared field and its reflection consumer.
    float surfaceHeight = (centerField.b - 0.5) / 1.18;
    float aperturePhase = clamp(0.5 + surfaceHeight * 2.0, 0.0, 1.0);
    float aperture = 0.0055
        + depthPhase * mix(0.010, 0.018, aperturePhase)
        + uTurbidity * 0.007;
    vec2 stepUv = max(uFieldTexel * 1.25, vec2(aperture / uWorldAspect, aperture));
    vec2 xStep = vec2(stepUv.x, 0.0);
    vec2 yStep = vec2(0.0, stepUv.y);
    vec4 left = texture2D(uSurfaceField, surfaceFieldUv(source - xStep));
    vec4 right = texture2D(uSurfaceField, surfaceFieldUv(source + xStep));
    vec4 up = texture2D(uSurfaceField, surfaceFieldUv(source - yStep));
    vec4 down = texture2D(uSurfaceField, surfaceFieldUv(source + yStep));
    // Axis-aligned UV derivatives preserve unit area at every sun bearing and
    // world aspect. Rotating texel-scaled axes and dividing by their lengths
    // incorrectly changes that baseline on a non-square field.
    vec2 dx = (projectSurfaceRay(source + xStep, right, depth)
        - projectSurfaceRay(source - xStep, left, depth)) / (2.0 * stepUv.x);
    vec2 dy = (projectSurfaceRay(source + yStep, down, depth)
        - projectSurfaceRay(source - yStep, up, depth)) / (2.0 * stepUv.y);
    float focus = resolveProjectionConvergence(dx, dy);
    float light = focus * 1.85;
    float pathLength = depth / max(0.3, -uRefractedSun.z);
    float transmission = 1.0 / (1.0 + pathLength * (0.18 + uTurbidity * 2.8));
    float facing = max(0.0, dot(receiverNormal, -uRefractedSun));
    // Beam visibility belongs to the entry point, not the floor pixel. A
    // deeper/turbid path averages more of the prefiltered leaf aperture.
    vec4 entryLight = ws_sample_light_transport(source);
    vec4 receiverLight = ws_sample_light_transport(receiverUv);
    float spread = clamp(depthPhase * 0.65 + uTurbidity * 0.35, 0.0, 1.0);
    float beamVisibility = mix(entryLight.r, entryLight.g, spread);
    float amount = light * facing * transmission * uCausticStrength
        * ws_transport_response(beamVisibility, receiverLight.a);
    vec3 color = mix(uLightColor, uLightColor * vec3(0.82, 0.94, 1.0), depthPhase * 0.36);
    return vec4(color * amount, amount);
}
`;
