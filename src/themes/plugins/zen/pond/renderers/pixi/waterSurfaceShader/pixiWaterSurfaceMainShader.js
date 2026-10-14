// Fragment main: frame-space setup, surface normal preparation, and composition orchestration.
export const pixiWaterSurfaceMainShader = `
void main(void) {
    vec2 uv = vTextureCoord;
    
    // Pixel-world domain: viewport crops add/remove coverage, not rescale or re-anchor water.
    vec2 filterPixel = uv * inputSize.xy;
    vec2 worldPixel = uFilterOrigin + filterPixel;
    vec2 worldResolution = max(uWorldResolution, vec2(1.0));
    vec2 worldUv = clamp(worldPixel / worldResolution, vec2(0.0), vec2(1.0));
    vec2 p = worldPixel * (uWaterScale / 960.0);
    
    // Keep macro domain world-anchored. Flow advection is handled inside water/ys height fields.
    
    float patchScale = clamp(uYoonseulPatchScale, 0.5, 2.6);
    float motionScale = clamp(uYoonseulMotion, 0.2, 2.8);
    float sharp = clamp(uYoonseulSharpness, 0.4, 2.4);
    float beatDamping = clamp(uYoonseulBeatDamping, 0.0, 1.0);
    float flickerAmount = clamp(uYoonseulFlickerAmount, 0.0, 1.4);
    float temporalCoherence = clamp(uYoonseulTemporalCoherence, 0.0, 1.0);
    float temporalLowBand = clamp(uYoonseulLowBand, 0.02, 0.98);
    float temporalMicroBand = clamp(uYoonseulMicroBand, 0.02, 0.98);
    float glintStability = clamp(uYoonseulGlintStability, 0.0, 1.0);
    float reflectionAlgorithmMode = floor(clamp(uYoonseulAlgorithmMode, 0.0, 6.0) + 0.5);
    float reflectionStability = clamp(uYoonseulStability, 0.0, 1.0);
    float reflectionTemporalStability = clamp(uYoonseulTemporalStability, 0.0, 1.0);
    float reflectionSoftKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    beatDamping = clamp(max(beatDamping, reflectionTemporalStability * 0.78), 0.0, 1.0);
    flickerAmount *= mix(1.0, 0.42, reflectionTemporalStability);
    glintStability = clamp(max(glintStability, reflectionTemporalStability * 0.86), 0.0, 1.0);
    float yTime = uYoonseulTime * (0.82 + motionScale * 0.28);
    float ysTime = mix(uYoonseulTime, yTime, temporalCoherence);
    // Keep yoonseul frequency stable against water-scale changes (small pond should not get finer highlights).
    float scaleInvariant = 8.0 / max(1.0, uWaterScale);
    float nonGgxReflection = step(0.5, reflectionAlgorithmMode);
    float yoonseulDomainGain = ((0.20 * mix(1.0, 1.34, nonGgxReflection)) / patchScale) * scaleInvariant;
    vec2 yp = p * yoonseulDomainGain;
    vec2 ysFlow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 ysCross = vec2(-ysFlow.y, ysFlow.x);

    vec3 normal = vec3(0.0, 0.0, 1.0);
    float h = 0.0;
    float surfaceNormalReady = 0.0;
    if (uSurfaceNormalEnabled > 0.5) {
        // Default surface physics now reuses the cheaper phase-noise water basis.
        // The 5% domain/time offset keeps refraction from exactly tracing the yoonseul mask.
        vec2 surfaceP = (yp * 0.95)
            + ysFlow * (0.05 + ysTime * 0.012)
            - ysCross * (0.035 + sin(ysTime * 0.19) * 0.015);
        float surfaceTime = ysTime * 0.94 + dot(yp, ysCross) * 0.018;
        float surfaceMotion = clamp(motionScale * 0.82 + 0.18, 0.2, 2.4);
        h = ys_phase_noise_height(surfaceP, surfaceTime, surfaceMotion);
        vec3 phaseSurfaceNormal = ys_surface_normal_from_h(
            surfaceP,
            h,
            surfaceTime,
            surfaceMotion,
            max(0.58, sharp * 0.72),
            2.0
        );
        normal = phaseSurfaceNormal;
        surfaceNormalReady = 1.0;
    }
    
    // Derive surface normal
    vec2 grad = normal.xy * 0.06;
    // Suppress derivative spikes at high ripple density to avoid "split line / broken glass" artifacts.
    grad /= (1.0 + length(grad) * 1.9);
    normal = normalize(vec3(normal.xy, max(0.24, normal.z)));
    
    // Refraction (screen-space distortion) + slight tangent swirl
    vec2 swirl = vec2(normal.y, -normal.x) * (uScale * (uTurbulence * (0.018 + uIrregularity * 0.016)));
    float detailScale = max(0.4, uRefractionMicroScale);
    float detailJitter = clamp(uRefractionJitter, 0.0, 2.5);
    vec2 distort = normal.xy * uScale * (0.46 + uTurbulence * 0.24 + uIrregularity * 0.06) + (swirl * 0.56);
    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    float maxDistortPx = 1.45
        + clamp(detailJitter, 0.0, 2.5) * 0.58
        + max(0.0, detailScale - 1.0) * 0.35;
    float distortLen = length(distort);
    float maxDistortLen = length(texel * maxDistortPx);
    if (distortLen > maxDistortLen) {
        distort *= maxDistortLen / max(distortLen, 1e-6);
    }

    // Clamp/limit against Pixi's valid input rect (excludes filter padding/undefined texels).
    vec2 baseClampMin = inputClamp.xy + (texel * 0.5);
    vec2 baseClampMax = inputClamp.zw - (texel * 0.5);
    baseClampMin = min(baseClampMin, baseClampMax - texel);
    baseClampMax = max(baseClampMax, baseClampMin + texel);
    vec2 clampMin = inputClamp.xy + (texel * 4.0);
    vec2 clampMax = inputClamp.zw - (texel * 4.0);
    clampMin = min(clampMin, clampMax - texel);
    clampMax = max(clampMax, clampMin + texel);
    vec2 edgeDist = min(uv - clampMin, clampMax - uv);
    float edgePx = min(edgeDist.x / max(texel.x, 1e-6), edgeDist.y / max(texel.y, 1e-6));
    float edgeFade = smoothstep(0.0, 8.0, edgePx);
    distort *= edgeFade;

    vec2 edgeRoom = max(min(uv - clampMin, clampMax - uv), vec2(0.0));
    vec2 limit = max(edgeRoom, texel * 2.0);
    vec2 safeDistort = distort / (1.0 + (abs(distort) / limit));
    
    vec4 color = ws_compose_screen_refraction(
        uv,
        safeDistort,
        clampMin,
        clampMax,
        baseClampMin,
        baseClampMax,
        detailScale,
        detailJitter
    );
    color.rgb = ws_apply_surface_reflection(color.rgb, worldUv, worldResolution, normal, h);
    color.rgb = ws_apply_surface_sheen(color.rgb, worldUv);
    color.rgb = ys_apply_yoonseul_composition(
        color.rgb,
        worldPixel,
        worldUv,
        worldResolution,
        yp,
        ysFlow,
        ysCross,
        ysTime,
        motionScale,
        sharp,
        beatDamping,
        flickerAmount,
        temporalLowBand,
        temporalMicroBand,
        glintStability,
        reflectionAlgorithmMode,
        reflectionStability,
        reflectionSoftKnee,
        nonGgxReflection,
        normal,
        h,
        surfaceNormalReady
    );
    gl_FragColor = color;
}
`;
