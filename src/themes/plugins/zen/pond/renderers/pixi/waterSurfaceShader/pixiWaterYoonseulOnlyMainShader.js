// Fragment main for the canonical yoonseul-only pipeline.
export const pixiWaterYoonseulOnlyMainShader = `
void main(void) {
    vec2 uv = vTextureCoord;
    vec2 filterPixel = uv * inputSize.xy;
    vec2 worldPixel = uFilterOrigin + filterPixel;
    vec2 worldResolution = max(uWorldResolution, vec2(1.0));
    vec2 worldUv = clamp(worldPixel / worldResolution, vec2(0.0), vec2(1.0));
    vec2 p = worldPixel * (uWaterScale / 960.0);

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
    float scaleInvariant = 8.0 / max(1.0, uWaterScale);
    float nonGgxReflection = step(0.5, reflectionAlgorithmMode);
    float yoonseulDomainGain = ((0.20 * mix(1.0, 1.34, nonGgxReflection)) / patchScale) * scaleInvariant;
    vec2 yp = p * yoonseulDomainGain;
    vec2 ysFlow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 ysCross = vec2(-ysFlow.y, ysFlow.x);

    vec2 texel = 1.0 / max(uResolution, vec2(1.0));
    vec2 baseClampMin = inputClamp.xy + (texel * 0.5);
    vec2 baseClampMax = inputClamp.zw - (texel * 0.5);
    baseClampMin = min(baseClampMin, baseClampMax - texel);
    baseClampMax = max(baseClampMax, baseClampMin + texel);
    vec4 color = texture2D(uSampler, clamp(uv, baseClampMin, baseClampMax));

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
        vec3(0.0, 0.0, 1.0),
        0.0,
        0.0
    );
    gl_FragColor = color;
}
`;
