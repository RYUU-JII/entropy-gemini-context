// RG: narrow/broad direct transmission; B: sky transmission;
// A: the luminance transfer already applied by the final canopy composite.
// The disabled state is the identity, including before the canopy is admitted.
export const zenWaterLightTransportShader = `
uniform sampler2D uWaterLightTransport;
uniform float uWaterLightTransportReady;
uniform vec4 uWaterLightBounds;
vec4 ws_sample_light_transport(vec2 worldUv) {
    if (uWaterLightTransportReady < 0.5) return vec4(1.0);
    vec2 uv = (worldUv - uWaterLightBounds.xy) / uWaterLightBounds.zw;
    // The map includes a guard around the visible canopy. Beyond that finite
    // foliage support there is open light, not a repeated/clamped shadow edge.
    if (min(uv.x, uv.y) < 0.0 || max(uv.x, uv.y) > 1.0) return vec4(1.0);
    return texture2D(uWaterLightTransport, uv);
}
float ws_transport_response(float visibility, float compositeTransfer) {
    // Replace the canopy's generic material attenuation for this light term.
    // Without the divisor the same foliage would darken optical light twice.
    // Only the optical contribution uses this bounded, achromatic correction.
    return clamp(visibility / max(0.08, compositeTransfer), 0.0, 2.5);
}
`;
