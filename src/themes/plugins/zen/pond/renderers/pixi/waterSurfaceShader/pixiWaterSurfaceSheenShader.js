// Surface sheen and warm gold-lift composition.
export const pixiWaterSurfaceSheenShader = `
vec3 ws_apply_surface_sheen(vec3 color, vec2 worldUv) {
    vec3 result = color;
    float surfaceSheenIntensity = clamp(uSurfaceSheenIntensity, 0.0, 1.6);
    if (surfaceSheenIntensity > 0.0001) {
        float sheenClarity = clamp(uSurfaceSheenClarity, 0.0, 1.0);
        float basinLight = clamp(0.46 + worldUv.y * 0.16 + sheenClarity * 0.28, 0.0, 1.0);
        float opticalRoom = clamp(0.52 + uRefractionVisibility * 0.32 + uSurfaceReflectionStrength * 1.4, 0.0, 1.0);
        // Material illumination already carries the broad daylight response.
        // Keep this art sheen subordinate to local specular/caustic contrast.
        float sheenAmount = clamp(surfaceSheenIntensity * basinLight * opticalRoom * 0.35, 0.0, 1.0);
        vec3 sheenScreen = 1.0 - (1.0 - result) * (1.0 - uSurfaceSheenColor * sheenAmount * 0.18);
        result = mix(result, sheenScreen, clamp(0.34 + sheenClarity * 0.22, 0.0, 0.62));
        result += uSurfaceSheenColor * sheenAmount * 0.018;

        float goldLift = clamp(uSurfaceGoldLift, 0.0, 1.2);
        if (goldLift > 0.0001) {
            vec3 goldColor = vec3(1.0, 0.82, 0.42);
            float goldAmount = clamp(goldLift * (0.5 + basinLight * 0.24 + sheenClarity * 0.18), 0.0, 1.0);
            vec3 goldScreen = 1.0 - (1.0 - result) * (1.0 - goldColor * goldAmount * 0.24);
            result = mix(result, goldScreen, clamp(0.18 + goldLift * 0.24, 0.0, 0.44));
            result += goldColor * goldAmount * 0.026;
        }
    }
    return result;
}
`;
