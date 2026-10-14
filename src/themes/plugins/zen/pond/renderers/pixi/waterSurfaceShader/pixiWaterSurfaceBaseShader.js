// Uniform declarations, shared water-domain helpers, and the screen-refraction height basis.
export const pixiWaterSurfaceBaseShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputClamp;
uniform vec4 inputSize;

// Custom Uniforms
uniform float uTime;
uniform vec2 uSpeed;
uniform vec2 uScale;
uniform vec2 uResolution;
uniform vec2 uFilterOrigin;
uniform vec2 uWorldResolution;
uniform float uWaterScale;
uniform float uTurbulence;
uniform vec2 uCurrentDir;
uniform float uIrregularity;
uniform float uRefractionMicroScale;
uniform float uRefractionJitter;
uniform float uRefractionDensity;
uniform float uRefractionAnisotropy;
uniform float uFlowMix;
uniform float uFlowTransport;
uniform float uSpectralSpread;
uniform float uSpectralPeak;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uYoonseulIntensity;
uniform float uYoonseulSharpness;
uniform float uYoonseulPatchScale;
uniform float uYoonseulMotion;
uniform float uYoonseulOpacity;
uniform float uYoonseulTime;
uniform float uYoonseulFlickerAmount;
uniform float uYoonseulTemporalCoherence;
uniform float uYoonseulLowBand;
uniform float uYoonseulMicroBand;
uniform float uYoonseulGlintStability;
uniform float uYoonseulBeatDamping;
uniform float uYoonseulAlgorithmMode;
uniform float uYoonseulStability;
uniform float uYoonseulSpatialStability;
uniform float uYoonseulDetailStability;
uniform float uYoonseulTemporalStability;
uniform float uYoonseulSoftKnee;
uniform float uFlowPulseAmount;
uniform vec3 uSurfaceReflectionColor;
uniform float uSurfaceReflectionStrength;
uniform vec3 uSurfaceSheenColor;
uniform float uSurfaceSheenIntensity;
uniform float uSurfaceSheenClarity;
uniform float uSurfaceGoldLift;
uniform float uRefractionMix;
uniform float uSurfaceNormalEnabled;
uniform float uScreenRefractionEnabled;
uniform float uSurfaceReflectionEnabled;
uniform float uRgbSplitEnabled;
uniform float uYoonseulEnabled;
uniform float uRefractionVisibility;

const float PI = 3.14159265359;

float trigNoise(vec2 p) {
    float n = 0.0;
    n += sin(dot(p, vec2(1.11, 1.73)));
    n += sin(dot(p, vec2(-1.39, 0.91)) + 1.7);
    n += sin(dot(p, vec2(0.83, -1.27)) - 0.9);
    return n / 3.0;
}

float fbmTrig(vec2 p) {
    float v = 0.0;
    float a = 0.56;
    mat2 m = mat2(1.62, 1.18, -1.18, 1.62);
    for (int i = 0; i < 3; i++) {
        v += trigNoise(p) * a;
        p = (m * p) * 0.67 + vec2(17.1, 11.7);
        a *= 0.5;
    }
    return (v * 0.5) + 0.5;
}

vec2 warpField(vec2 p, float t) {
    float n1 = fbmTrig(p * 0.68 + vec2(t * 0.08, -t * 0.05)) * 2.0 - 1.0;
    float n2 = fbmTrig(p * 0.68 + vec2(-t * 0.06, t * 0.04) + vec2(31.7, -19.4)) * 2.0 - 1.0;
    float wx = sin(dot(p, vec2(0.9, 1.3)) + t * 0.63)
        + sin(dot(p, vec2(-1.4, 0.7)) - t * 0.39) * 0.6;
    float wy = sin(dot(p, vec2(-0.8, 1.1)) - t * 0.58)
        + sin(dot(p, vec2(1.2, 1.7)) + t * 0.31) * 0.6;
    vec2 periodic = vec2(wx, wy);
    vec2 noiseWarp = vec2(n1, n2);
    float irregularMix = clamp(uIrregularity * 0.45, 0.0, 0.62);
    return mix(periodic, periodic * 0.62 + noiseWarp * 0.78, irregularMix);
}

float waveTrain(vec2 p, vec2 dir, float freq, float speed, float phase, float choppy) {
    float x = dot(p, dir) * freq + uTime * speed + phase;
    float baseWave = sin(x) + sin(x * 0.47 + phase * 1.73) * 0.35;
    float crestExp = mix(1.0, 0.84, choppy);
    float crest = sign(baseWave) * pow(abs(baseWave), crestExp);
    return mix(baseWave, crest, choppy);
}

float waterHeight(vec2 p) {
    float t = uTime;
    float irregularity = clamp(uIrregularity, 0.0, 2.0);
    float flowMix = clamp(uFlowMix, 0.0, 1.0);
    float flowTransport = clamp(uFlowTransport, 0.0, 1.0);
    float flowSpeedMix = flowTransport * 0.22;
    float spectralSpread = clamp(uSpectralSpread, 0.0, 1.0);
    float spectralPeak = clamp(uSpectralPeak, 0.55, 1.45);
    float spectralPeakNorm = clamp((spectralPeak - 0.55) / 0.9, 0.0, 1.0);
    float spectralLow = mix(1.12, 0.86, spectralPeakNorm);
    float spectralMid = mix(0.94, 1.08, spectralPeakNorm);
    float spectralHigh = mix(0.82, 1.2, spectralPeakNorm);
    float pulse = clamp(uFlowPulseAmount, 0.0, 1.4);
    float microScale = max(0.35, uRefractionMicroScale);
    float jitter = clamp(uRefractionJitter, 0.0, 2.5);
    float density = clamp(uRefractionDensity, 0.55, 2.4);
    float anisotropy = clamp(uRefractionAnisotropy, 0.0, 1.0);
    float densityNorm = clamp((density - 0.55) / 1.85, 0.0, 1.0);
    float freqMul = mix(0.76, 1.58, densityNorm);
    float microFreqMul = mix(0.84, 1.92, densityNorm);
    freqMul *= mix(0.92, 1.12, spectralPeakNorm);
    microFreqMul *= mix(0.84, 1.22, spectralSpread);
    float densityAmp = mix(1.04, 0.8, densityNorm);
    float along = mix(0.58, 1.0, anisotropy);
    float across = mix(1.0, 0.72, anisotropy);
    vec2 current = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-current.y, current.x);

    vec2 warp = warpField(p * mix(0.98, 0.9, flowMix), t);
    float spacingA = fbmTrig(p * 0.33 * mix(0.9, 1.16, densityNorm) + vec2(t * 0.03, -t * 0.02));
    float spacingB = fbmTrig(p * 0.21 * mix(0.88, 1.24, densityNorm) + vec2(-t * 0.05, t * 0.04) + vec2(17.7, -9.3));
    float localStretch = mix(0.92, 1.24, spacingA) * mix(0.94, 1.12, spectralSpread);
    float gustA = mix(0.03, 0.16, pulse / 1.4);
    float gustB = mix(0.02, 0.1, pulse / 1.4);
    float gust = 0.84
        + gustA * sin(t * 0.31)
        + gustB * sin(t * 0.13 + dot(p, vec2(0.05, -0.04)));
    float turbulence = clamp(uTurbulence * gust * (0.84 + irregularity * 0.16), 0.02, 1.0);

    vec2 advected = p;
    float alongCarry = mix(0.02, 0.11, flowTransport) * mix(0.74, 1.0, anisotropy);
    float alongCarrier = fbmTrig(p * (0.24 * freqMul) + vec2(t * 0.06, -t * 0.04));
    advected += current
        * (spacingB - 0.5)
        * alongCarry
        * (0.72 + alongCarrier * 0.56);
    advected += cross
        * (spacingA - 0.5)
        * mix(0.02 + irregularity * 0.02, 0.09 + irregularity * 0.08, flowTransport)
        * mix(1.12, 0.74, anisotropy);
    advected += warp * mix(
        0.04 + turbulence * (0.08 + irregularity * 0.04),
        0.09 + turbulence * (0.19 + irregularity * 0.1),
        flowTransport
    );

    float localAngle = (fbmTrig(advected * 0.24 + vec2(t * 0.04, -t * 0.03)) - 0.5)
        * (0.82 + irregularity * 0.42 + flowMix * 0.08 + flowTransport * 0.1)
        * mix(1.18, 0.74, anisotropy);
    float ca = cos(localAngle);
    float sa = sin(localAngle);
    mat2 localRot = mat2(ca, -sa, sa, ca);
    vec2 q = localRot * advected * mix(0.92, 1.24, densityNorm);
    vec2 flowDir = normalize(localRot * current + vec2(0.0001, 0.0001));
    vec2 sideDir = vec2(-flowDir.y, flowDir.x);

    float h = 0.0;
    float swellScale = localStretch * mix(1.0, 0.86, flowMix);
    h += waveTrain(
        q,
        flowDir,
        mix(1.62, 1.2, flowMix) * swellScale * freqMul,
        mix(0.44, 0.78, flowSpeedMix),
        0.17,
        turbulence * mix(0.32, 0.4, flowMix)
    ) * mix(0.26, 0.31, flowMix) * densityAmp * spectralLow * mix(1.02, 0.86, spectralSpread);
    h += waveTrain(
        q + warp * 0.4,
        normalize(flowDir * (0.82 * along) + sideDir * (0.57 * across)),
        mix(2.08, 1.55, flowMix) * mix(0.92, 1.16, spacingB) * freqMul,
        mix(-0.56, -0.98, flowSpeedMix),
        1.27,
        turbulence * mix(0.36, 0.46, flowMix)
    ) * mix(0.18, 0.21, flowMix) * densityAmp * spectralMid;
    h += waveTrain(
        q - warp * 0.28,
        normalize(flowDir * (0.34 * along) + sideDir * (0.94 * across)),
        mix(2.86, 2.05, flowMix) * freqMul,
        mix(0.7, 1.08, flowSpeedMix),
        2.73,
        turbulence * mix(0.4, 0.52, flowMix)
    ) * mix(0.13, 0.16, flowMix) * densityAmp * mix(spectralMid, spectralHigh, 0.5);
    h += waveTrain(
        q + warp * 0.24,
        normalize(-flowDir * (0.24 * along) + sideDir * (0.97 * across)),
        mix(3.44, 2.52, flowMix) * freqMul,
        mix(-0.84, -1.22, flowSpeedMix),
        4.58,
        turbulence * mix(0.42, 0.54, flowMix)
    ) * mix(0.1, 0.13, flowMix) * densityAmp * spectralHigh;
    h += waveTrain(
        q * mix(1.18, 1.06, flowMix) - warp * 0.17,
        normalize(-flowDir * (0.74 * along) + sideDir * (0.67 * across)),
        mix(2.28, 1.68, flowMix) * freqMul,
        mix(0.52, 0.86, flowSpeedMix),
        5.17,
        turbulence * mix(0.34, 0.44, flowMix)
    ) * mix(0.08, 0.1, flowMix) * densityAmp;
    h += waveTrain(
        q * mix(1.22, 1.1, flowMix) + warp * 0.14,
        normalize(-flowDir * (0.95 * along) - sideDir * (0.3 * across)),
        mix(1.92, 1.4, flowMix) * freqMul,
        mix(-0.48, -0.74, flowSpeedMix),
        3.87,
        turbulence * mix(0.28, 0.36, flowMix)
    ) * mix(0.07, 0.09, flowMix) * densityAmp;

    float billow = fbmTrig(q * (0.58 * freqMul) + warp * 0.22 + vec2(t * 0.04, -t * 0.03)) * 2.0 - 1.0;
    h += billow
        * (0.05 + irregularity * (0.014 + flowMix * 0.01))
        * (0.66 + turbulence * 0.42)
        * densityAmp;

    float microAmp = (0.016 + jitter * 0.006)
        * (1.02 - clamp((microScale - 1.0) * 0.2, -0.08, 0.28))
        * mix(1.0, 0.84, densityNorm)
        * mix(0.86, 1.18, spectralSpread)
        * mix(0.92, 1.08, spectralPeakNorm);
    h += waveTrain(
        q * (1.68 * microScale) + warp * (0.2 + jitter * 0.08),
        normalize(flowDir * (0.3 * along) + sideDir * (0.95 * across)),
        6.9 * microScale * microFreqMul,
        mix(-0.56, -0.34, flowSpeedMix),
        3.08 + jitter * 0.3,
        turbulence * mix(0.5, 0.62, flowMix)
    ) * microAmp;
    h += waveTrain(
        q * (1.94 * microScale) - warp * (0.16 + jitter * 0.05),
        normalize(flowDir * (0.88 * along) - sideDir * (0.47 * across)),
        8.05 * microScale * microFreqMul,
        mix(0.5, 0.74, flowSpeedMix),
        1.91 + jitter * 0.16,
        turbulence * mix(0.46, 0.58, flowMix)
    ) * (microAmp * 0.72);

    float gran = trigNoise(q * (5.1 * microScale * microFreqMul) + vec2(t * (0.82 + jitter * 0.25), -t * (0.7 + jitter * 0.18)));
    float granB = trigNoise((q.yx + vec2(13.9, -9.6)) * (4.4 * microScale * microFreqMul) + vec2(-t * (0.69 + jitter * 0.2), t * (0.87 + jitter * 0.22)));
    h += (gran + granB) * 0.5
        * (0.008 + jitter * 0.005)
        * (0.6 + turbulence * 0.42)
        * (0.7 + irregularity * 0.18);

    float flowEnvelope = mix(0.92, 0.9, flowMix)
        + (fbmTrig(q * (0.16 * freqMul) + current * (t * 0.08)) - 0.5) * mix(0.11, 0.17, flowMix);
    h *= flowEnvelope;
    return h;
}
`;
