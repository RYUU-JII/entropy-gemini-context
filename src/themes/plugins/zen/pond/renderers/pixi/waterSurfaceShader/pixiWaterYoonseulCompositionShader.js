// Final yoonseul specular, mask, flicker, and glint color composition.
export const pixiWaterYoonseulCompositionShader = `
vec3 ys_apply_yoonseul_composition(
    vec3 color,
    vec2 worldPixel,
    vec2 worldUv,
    vec2 worldResolution,
    vec2 yp,
    vec2 ysFlow,
    vec2 ysCross,
    float ysTime,
    float motionScale,
    float sharp,
    float beatDamping,
    float flickerAmount,
    float temporalLowBand,
    float temporalMicroBand,
    float glintStability,
    float reflectionAlgorithmMode,
    float reflectionStability,
    float reflectionSoftKnee,
    float nonGgxReflection,
    vec3 surfaceNormal,
    float surfaceHeight,
    float surfaceNormalReady
) {
    vec3 result = color;
    if (uYoonseulEnabled > 0.5) {
        // Yoonseul near-port:
        // reuse the shifted phase-noise surface in the default path, while keeping
        // patch and flicker masks separate from refraction.
        vec2 ndc = worldUv * 2.0 - 1.0;
        ndc.x *= worldResolution.x / max(worldResolution.y, 1.0);
        vec3 ro = vec3(0.0, 0.0, 2.25);
        float focal = 1.55;
        vec3 rd = normalize(vec3(ndc, -focal));
        float tHit = ro.z / max(0.0001, -rd.z);
        vec3 hit = ro + rd * tHit;
        float reflectionSpatialStability = ys_spatial_stability();
        float reflectionDetailStability = ys_detail_stability();
        float reflectionTemporalStability = ys_temporal_stability();
        float stochasticSlopeReflection = step(5.5, reflectionAlgorithmMode);
        float slopeLobeReflection = step(4.5, reflectionAlgorithmMode)
            * (1.0 - stochasticSlopeReflection);
        float yoonseulGlintReflection = step(3.5, reflectionAlgorithmMode)
            * (1.0 - step(4.5, reflectionAlgorithmMode));
        vec2 patchDrift = vec2(0.0);
        float rBase = 0.5;
        float rMicro = 0.5;
        if (stochasticSlopeReflection < 0.5) {
            vec2 patchCounterflow = ys_counterflow_offset(
                yp * 1.18 + vec2(3.7, -2.1),
                ysTime * (0.94 + motionScale * 0.09),
                ysFlow,
                ysCross,
                clamp(uFlowTransport, 0.0, 1.0),
                reflectionSpatialStability,
                reflectionDetailStability,
                reflectionTemporalStability
            );
            patchDrift = ysFlow * (ysTime * mix(0.038, 0.016, reflectionTemporalStability))
                + ysCross * (
                    sin(dot(yp, ysFlow) * 1.1 + ysTime * 0.073) * mix(0.16, 0.07, reflectionTemporalStability)
                    + sin(dot(yp, ysCross) * 0.74 - ysTime * 0.052) * mix(0.08, 0.035, reflectionTemporalStability)
                )
                + patchCounterflow * (0.92 + motionScale * 0.18);
            rBase = ys_fbm(
                yp * mix(2.28, 2.02, reflectionSpatialStability) - patchDrift
            );
            rMicro = ys_noise(
                yp * mix(12.6, 10.2, reflectionDetailStability) - patchDrift * 1.55
                + vec2(13.7, -9.2)
            );
        }
        float yh = 0.0;
        vec3 N = vec3(0.0, 0.0, 1.0);
        if (reflectionAlgorithmMode < 0.5) {
            yh = ys_height(yp, ysTime, motionScale);
            N = ys_normal_from_h(yp, yh, ysTime, motionScale, sharp);
        } else if (reflectionAlgorithmMode >= 1.5 && reflectionAlgorithmMode < 2.5 && surfaceNormalReady > 0.5) {
            yh = surfaceHeight;
            float glintNormalGain = (0.13 + flickerAmount * 0.16)
                * (1.0 - glintStability * 0.42)
                * (1.0 - beatDamping * 0.28);
            float glintPhaseA = sin(dot(yp, ysCross) * 1.82 + ysTime * (1.6 + motionScale * 0.42));
            float glintPhaseB = sin(dot(yp, ysFlow) * 2.18 - ysTime * (1.9 + motionScale * 0.36));
            vec2 glintNormalOffset = ysFlow * ((rBase - 0.5) + glintPhaseA * 0.18)
                + ysCross * ((rMicro - 0.5) + glintPhaseB * 0.14);
            N = normalize(vec3(surfaceNormal.xy + glintNormalOffset * glintNormalGain, surfaceNormal.z));
        } else if (stochasticSlopeReflection > 0.5) {
            ys_stochastic_slope_spectrum_surface(yp, ysTime, motionScale, sharp, yh, N);
        } else if (slopeLobeReflection > 0.5) {
            ys_slope_lobe_surface(yp, ysTime, motionScale, sharp, yh, N);
        } else if (yoonseulGlintReflection > 0.5) {
            yh = ys_yoonseul_glint_height(yp, ysTime, motionScale);
            N = ys_surface_normal_from_h(yp, yh, ysTime, motionScale, sharp, reflectionAlgorithmMode);
        } else {
            yh = ys_surface_height(yp, ysTime, motionScale, reflectionAlgorithmMode);
            N = ys_surface_normal_from_h(yp, yh, ysTime, motionScale, sharp, reflectionAlgorithmMode);
        }
        vec3 P = vec3(hit.xy, yh * 0.10);
        vec3 V = normalize(ro - P);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);
        float NoL = clamp(dot(N, L), 0.0, 1.0);
        float NoV = clamp(dot(N, V), 0.0, 1.0);
        float NoH = clamp(dot(N, H), 0.0, 1.0);
        float VoH = clamp(dot(V, H), 0.0, 1.0);

        float sharpMix = clamp((sharp - 0.4) / 2.0, 0.0, 1.0);
        float advectedRoughness = mix(0.055, 0.25, rBase);
        advectedRoughness = clamp(advectedRoughness * mix(0.78, 1.22, rMicro), 0.04, 0.26);
        float stochasticSlopeRoughness = mix(0.13, 0.058, sharpMix)
            * mix(1.04, 0.9, reflectionDetailStability);
        float rough = mix(advectedRoughness, stochasticSlopeRoughness, stochasticSlopeReflection);
        rough = clamp(rough, 0.04, 0.26);
        float a = max(0.001, rough * rough);

        vec3 F0 = vec3(0.020);
        float D = D_GGX(NoH, a);
        float k = (rough + 1.0);
        k = (k * k) / 8.0;
        float G = G_Smith(NoV, NoL, k);
        vec3 F = fresnelSchlick(VoH, F0);
        vec3 spec = (D * G * F) / max(0.0006, 4.0 * NoV * NoL);
        float specLuma = dot(spec, vec3(0.2126, 0.7152, 0.0722));
        float horizonMask = smoothstep(0.08, 0.42, NoV);

        float sparkleSeed = clamp(spec.r * mix(24.0, 38.0, sharpMix), 0.0, 1.0);
        float sparkleAa = mix(0.02, 0.06, (1.0 - glintStability) * (0.5 + sharpMix * 0.5));
        float sparkleThreshold = mix(0.26, 0.18, sharpMix);
        float sparkle = smoothstep(
            sparkleThreshold - sparkleAa,
            sparkleThreshold + sparkleAa,
            sparkleSeed
        );
        sparkle = pow(sparkle, mix(1.45, 1.08, sharpMix));
        float advectedGlintPulse = smoothstep(
            0.56,
            0.94,
            0.5 + 0.5 * sin(
                ysTime * (2.1 + motionScale * 0.54)
                + rMicro * PI * 2.0
                + dot(yp, ysCross) * 0.72
            )
        );
        float glintPulse = advectedGlintPulse * (1.0 - stochasticSlopeReflection);
        sparkle = clamp(
            sparkle + glintPulse * (0.08 + flickerAmount * 0.16)
                * (1.0 - glintStability * 0.48)
                * (1.0 - beatDamping * 0.34)
                * mix(1.0, 0.62, slopeLobeReflection),
            0.0,
            1.24
        );
        float patchNoise = rBase * 0.56 + rMicro * 0.44;
        float advectedPatchMask = smoothstep(
            mix(0.32, 0.42, beatDamping),
            mix(0.88, 0.95, beatDamping),
            patchNoise
        );
        float lowBandMask = smoothstep(temporalLowBand - 0.2, temporalLowBand + 0.16, rBase);
        float microBandMask = smoothstep(temporalMicroBand - 0.24, temporalMicroBand + 0.18, rMicro);
        float bandMask = clamp(lowBandMask * 0.64 + microBandMask * 0.36, 0.0, 1.0);
        advectedPatchMask = clamp(advectedPatchMask * mix(0.72, 1.12, bandMask), 0.0, 1.0);
        float stochasticSlopeSpecularGate = smoothstep(0.008, 0.11, specLuma);
        float patchMask = mix(
            advectedPatchMask,
            stochasticSlopeSpecularGate,
            stochasticSlopeReflection
        );
        float advectedFlicker = 1.0;
        if (stochasticSlopeReflection < 0.5) {
            float flickerNoise = ys_fbm(yp * 1.72 - patchDrift * 0.82);
            float flickerMicro = ys_noise(yp * 3.6 - patchDrift * 1.18 + vec2(5.1, -2.9));
            float flickerWave = ((flickerNoise * 0.7) + (flickerMicro * 0.3)) * 2.0 - 1.0;
            float flickerStrength = (0.14 * flickerAmount * (1.0 - beatDamping * 0.72))
                * (1.0 - glintStability * 0.58);
            advectedFlicker = 1.0 + (flickerWave * flickerStrength);
        }
        float flicker = mix(advectedFlicker, 1.0, stochasticSlopeReflection);

        float yoonseulDrive = clamp(uYoonseulIntensity * uYoonseulOpacity, 0.0, 4.0);
        float glintFlakeEvent = 0.0;
        if (yoonseulGlintReflection > 0.5) {
            glintFlakeEvent = ys_yoonseul_glint_flakes(
                worldPixel,
                ysTime * (0.92 + motionScale * 0.12),
                sharpMix,
                yoonseulDrive
            );
        } else if (slopeLobeReflection > 0.5) {
            float slopeFlakeEvent = ys_yoonseul_glint_flakes(
                worldPixel,
                ysTime * (0.68 + motionScale * 0.08),
                sharpMix,
                yoonseulDrive * 0.42
            );
            float slopeLobeSpecularGate = smoothstep(0.018, 0.14, specLuma)
                * smoothstep(0.08, 0.42, NoL)
                * patchMask
                * horizonMask;
            float slopeLobePulseGate = smoothstep(0.38, 0.96, sparkleSeed + glintPulse * 0.18);
            glintFlakeEvent = slopeFlakeEvent
                * slopeLobeSpecularGate
                * slopeLobePulseGate
                * (0.34 + 0.28 * (1.0 - glintStability));
        }
        float glintEventSparkleGain = mix(
            0.36 + sharpMix * 0.22,
            0.18 + sharpMix * 0.12,
            slopeLobeReflection
        );
        float glintEventSparkleCeiling = mix(1.7, 1.34, slopeLobeReflection);
        sparkle = clamp(
            sparkle + glintFlakeEvent * glintEventSparkleGain,
            0.0,
            glintEventSparkleCeiling
        );
        float energyGuard = 1.0 / (
            1.0
            + specLuma
                * mix(2.2, 5.4, beatDamping)
                * mix(1.0, 0.82, glintStability)
                * mix(1.0, 1.7, reflectionStability)
        );
        vec3 yoonseul = spec * uSunColor * (1.0 + 4.2 * sparkle) * energyGuard;
        float softGlow = pow(clamp(dot(N, H), 0.0, 1.0), 17.0) * (0.11 + 0.09 * (1.0 - glintStability));
        float eventHighlightGain = mix(
            0.14 + sharpMix * 0.18,
            0.045 + sharpMix * 0.07,
            slopeLobeReflection
        );
        vec3 eventHighlight = uSunColor * glintFlakeEvent * eventHighlightGain * NoL;
        vec3 highlight = (
                (yoonseul * NoL + uSunColor * softGlow * NoL)
                    * patchMask
                    * flicker
                + eventHighlight
            )
            * yoonseulDrive
            * horizonMask;
        vec3 boosted = result + highlight;
        float compressionCurve = mix(0.32, mix(0.24, 0.62, reflectionSoftKnee), nonGgxReflection);
        float compressionAmount = mix(0.74, mix(0.62, 0.9, reflectionSoftKnee), nonGgxReflection);
        vec3 compressed = boosted / (1.0 + boosted * compressionCurve);
        result = clamp(mix(boosted, compressed, compressionAmount), 0.0, 1.0);
    }
    return result;
}
`;
