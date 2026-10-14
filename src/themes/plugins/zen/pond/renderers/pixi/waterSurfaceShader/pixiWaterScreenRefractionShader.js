// Screen-space refraction sampling and surface reflection composition.
export const pixiWaterScreenRefractionShader = `
vec4 ws_compose_screen_refraction(
    vec2 uv,
    vec2 safeDistort,
    vec2 clampMin,
    vec2 clampMax,
    vec2 baseClampMin,
    vec2 baseClampMax,
    float detailScale,
    float detailJitter
) {
    // Cheap Chromatic Aberration (RGB split refraction)
    // Scale spread by distortion intensity to look natural and avoid flat-water fringes.
    vec4 baseColor = texture2D(uSampler, clamp(uv, baseClampMin, baseClampMax));
    vec4 result = baseColor;
    if (uScreenRefractionEnabled > 0.5) {
        vec2 uvG = clamp(uv + safeDistort, clampMin, clampMax);
        vec4 texG = texture2D(uSampler, uvG);
        vec4 refractedColor = texG;
        if (uRgbSplitEnabled > 0.5) {
            float caSpread = clamp(
                length(safeDistort) * 22.0
                    * (1.0 / (1.0 + max(0.0, detailScale - 1.0) * 0.8 + detailJitter * 0.2)),
                0.0,
                0.16
            );
            vec3 chromaLean = vec3(
                mix(texG.r, baseColor.r, caSpread),
                texG.g,
                clamp(texG.b + (texG.b - baseColor.b) * caSpread * 0.72, 0.0, 1.0)
            );
            refractedColor = vec4(chromaLean, texG.a);
        }
        float refractionVisibility = clamp(uRefractionVisibility, 0.0, 1.0);
        float refractionMix = clamp(
            uRefractionMix * (0.86 + (1.0 - refractionVisibility) * 0.18),
            0.08,
            0.42
        );
        result = mix(baseColor, refractedColor, refractionMix);
    }
    return result;
}

vec3 ws_apply_surface_reflection(vec3 color, vec2 worldUv, vec2 worldResolution, vec3 normal, float h) {
    vec3 result = color;
    if (uSurfaceReflectionEnabled > 0.5) {
        vec2 ndcOptics = worldUv * 2.0 - 1.0;
        ndcOptics.x *= worldResolution.x / max(worldResolution.y, 1.0);
        vec3 viewOptics = normalize(vec3(-ndcOptics * 0.36, 1.0));
        float opticsNoV = clamp(dot(normal, viewOptics), 0.0, 1.0);
        float fresnel = pow(1.0 - opticsNoV, 5.0);
        float rippleSheen = clamp(length(normal.xy) * 1.18 + abs(h) * 0.72, 0.0, 1.0);
        float reflectionMix = clamp(
            uSurfaceReflectionStrength
            * (0.38 + fresnel * 1.36 + rippleSheen * 0.32),
            0.0,
            0.18
        );
        vec3 reflectedWater = mix(result, uSurfaceReflectionColor, reflectionMix);
        result = mix(result, reflectedWater, smoothstep(0.0, 0.04, reflectionMix));
    }
    return result;
}
`;
