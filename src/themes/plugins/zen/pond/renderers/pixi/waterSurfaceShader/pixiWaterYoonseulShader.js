// Yoonseul height, normal, reflection algorithm, and glint-flake helper functions.
export const pixiWaterYoonseulShader = `
float ys_hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

vec2 ys_hash2(vec2 p) {
    return vec2(
        ys_hash(p + vec2(17.17, 91.43)),
        ys_hash(p + vec2(53.91, 11.29))
    );
}

mat2 ys_rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

float ys_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = ys_hash(i);
    float b = ys_hash(i + vec2(1.0, 0.0));
    float c = ys_hash(i + vec2(0.0, 1.0));
    float d = ys_hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float ys_fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 2; i++) {
        v += a * ys_noise(p);
        p = m * p;
        a *= 0.5;
    }
    return v;
}

float ys_wave(vec2 p, vec2 dir, float freq, float amp, float speed, float t) {
    return sin(dot(p, dir) * freq + t * speed) * amp;
}

float ys_height(vec2 p, float t, float motionScale) {
    float irregular = clamp(uIrregularity, 0.0, 2.0);
    float flowMix = clamp(uFlowMix, 0.0, 1.0);
    float flowTransport = clamp(uFlowTransport, 0.0, 1.0);
    float flowSpeedMix = flowTransport * 0.26;
    float spectralSpread = clamp(uSpectralSpread, 0.0, 1.0);
    float spectralPeak = clamp(uSpectralPeak, 0.55, 1.45);
    float spectralPeakNorm = clamp((spectralPeak - 0.55) / 0.9, 0.0, 1.0);
    float spectralLowFreq = mix(0.92, 0.78, spectralPeakNorm);
    float spectralHighFreq = mix(1.0, 1.36, spectralPeakNorm);
    float pulse = clamp(uYoonseulFlickerAmount, 0.0, 1.0);
    float pondWeight = 1.0 - flowMix;
    float tt = t
        * (0.72 + motionScale * (0.54 + flowSpeedMix * 0.22))
        * mix(0.94, 1.08, spectralPeakNorm);
    float gustA = mix(0.03, 0.11, pulse);
    float gustB = mix(0.02, 0.07, pulse);
    float gust = 0.9
        + sin(tt * 0.17) * gustA
        + sin(tt * 0.39 + 1.6) * gustB;
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);

    vec2 q = p;
    float advectAlong = (0.012 + motionScale * 0.012) * pondWeight + (0.05 + motionScale * 0.024) * flowTransport;
    float advectCross = (0.03 + motionScale * 0.012) * pondWeight + 0.038 * flowTransport;
    float advectCarrierA = ys_fbm(p * 0.42 + vec2(tt * 0.05, -tt * 0.04)) - 0.5;
    float advectCarrierB = ys_fbm((p.yx + vec2(5.3, -3.7)) * 0.36 + vec2(-tt * 0.04, tt * 0.03)) - 0.5;
    q += flow * advectCarrierA * advectAlong * (1.16 + flowTransport * 0.24);
    q += cross * advectCarrierB * advectCross * (0.92 + flowTransport * 0.2);

    float warpA = ys_fbm(q * 0.74 + vec2(tt * 0.07, -tt * 0.05));
    float warpB = ys_fbm(q * 0.68 + vec2(-tt * 0.06, tt * 0.08) + vec2(9.3, -6.7));
    vec2 warp = vec2(warpA, warpB) - 0.5;
    q += warp * (0.62 + irregular * 0.26);

    float localAngle = (ys_fbm(q * 0.32 + vec2(tt * 0.03, -tt * 0.025)) - 0.5)
        * (1.08 + irregular * 0.3);
    float ca = cos(localAngle);
    float sa = sin(localAngle);
    mat2 rot = mat2(ca, -sa, sa, ca);
    vec2 d1 = normalize(rot * normalize(flow * 0.68 + vec2(1.0, 0.35)));
    vec2 d2 = normalize(rot * normalize(cross * 0.78 + vec2(-0.25, 0.97)));
    vec2 d3 = normalize(rot * normalize(-flow * 0.48 + vec2(0.78, -0.62)));
    vec2 d4 = normalize(rot * normalize(-cross * 0.62 + vec2(-0.86, -0.40)));

    float h = 0.0;
    h += ys_wave(q, d1, 2.95 * spectralLowFreq, 0.13 * mix(1.06, 0.9, spectralSpread), 1.18 * gust, tt);
    h += ys_wave(q, d2, 4.25 * mix(spectralLowFreq, spectralHighFreq, 0.35), 0.095, 1.74 * gust, tt);
    h += ys_wave(q, d3, 5.65 * mix(spectralLowFreq, spectralHighFreq, 0.68), 0.066, 2.22 * gust, tt);
    h += ys_wave(q, d4, 7.95 * spectralHighFreq, 0.047 * mix(0.92, 1.08, spectralSpread), 2.86 * gust, tt);

    float r1 = ys_fbm(q * 8.4 - tt * 0.31);
    float r2 = ys_noise(q * 12.6 + tt * 0.48);
    h += (r1 - 0.5) * 0.095;
    h += (r2 - 0.5) * 0.038;

    float ringA = sin(length(q * 0.84 + warp * 0.75 - vec2(sin(tt * 0.19), cos(tt * 0.16)) * 1.45) * 8.6 - tt * 1.12);
    h += ringA * 0.007;

    float ch = sin(dot(q + warp * 0.6, vec2(7.2, 5.4)) + tt * 1.4);
    h += ch * 0.006;
    return h;
}

float ys_soft_limit(float value, float knee) {
    float resolvedKnee = mix(0.18, 1.12, clamp(knee, 0.0, 1.0));
    return value / (1.0 + abs(value) * resolvedKnee);
}

float ys_spatial_stability() {
    return clamp(uYoonseulSpatialStability, 0.0, 1.0);
}

float ys_detail_stability() {
    return clamp(uYoonseulDetailStability, 0.0, 1.0);
}

float ys_temporal_stability() {
    return clamp(uYoonseulTemporalStability, 0.0, 1.0);
}

vec2 ys_counterflow_offset(
    vec2 p,
    float t,
    vec2 flow,
    vec2 cross,
    float flowTransport,
    float spatialStability,
    float detailStability,
    float temporalStability
) {
    float cellA = ys_noise(p * mix(0.74, 0.52, spatialStability) + vec2(t * 0.09, -t * 0.07));
    float cellB = ys_noise(p.yx * mix(0.82, 0.58, spatialStability) + vec2(-t * 0.08, t * 0.11) + vec2(8.2, -4.6));
    float swirl = sin((cellA - cellB) * PI * 2.0 + t * 0.33);
    float shear = sin(dot(p, cross) * 0.73 - t * 0.27 + cellB * PI);
    float roll = sin(dot(p, flow) * 0.61 + t * 0.31 + cellA * PI);
    float loose = 1.0 - temporalStability * 0.45;
    float breakup = 1.0 - detailStability * 0.38;
    float amp = (0.075 + flowTransport * 0.085) * loose * breakup;
    return flow * (swirl * amp * 0.42 + shear * amp * 0.22)
        + cross * (roll * amp + (cellA - 0.5) * amp * 0.72);
}

float ys_looped_caustic_height(vec2 p, float t, float motionScale) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float cycleA = t * (PI * 2.0 / 96.0) * (0.72 + motionScale * 0.18) * mix(1.0, 0.72, temporalStability);
    float cycleB = t * (PI * 2.0 / 137.0) * (0.82 + motionScale * 0.12) * mix(1.0, 0.76, temporalStability);
    vec2 loopA = vec2(cos(cycleA), sin(cycleA));
    vec2 loopB = vec2(cos(cycleB + 1.91), sin(cycleB + 1.91));
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);
    vec2 q = p * mix(1.54, 1.22, spatialStability);
    vec2 counterflow = ys_counterflow_offset(
        q,
        t * (0.8 + motionScale * 0.12),
        flow,
        cross,
        clamp(uFlowTransport, 0.0, 1.0),
        spatialStability,
        detailStability,
        temporalStability
    );

    float plateA = ys_fbm(q * 1.82 + loopA * 1.12 + counterflow * 1.84 + flow * 0.22);
    float plateB = ys_fbm(q * 1.54 + loopB * 1.2 - counterflow.yx * 1.46 - cross * 0.18);
    float plateC = ys_noise(q * 3.15 + loopA * 0.38 - loopB * 0.26 + counterflow * 2.0);
    float ridge = 1.0 - abs(plateA - plateB);
    float caustic = smoothstep(
        mix(0.42, 0.54, spatialStability),
        mix(0.88, 0.96, spatialStability),
        ridge
    );
    float slowEnvelope = ys_fbm(q * 0.44 + counterflow * 0.92 + loopA * 0.36 + loopB * 0.18) - 0.5;
    float weave = sin(dot(q, normalize(flow * 0.72 + cross * 0.42)) * 4.6 + cycleA * 1.0)
        * sin(dot(q, normalize(flow * -0.38 + cross * 0.91)) * 3.7 - cycleB * 0.72);
    float h = (caustic - 0.44) * mix(0.13, 0.09, detailStability)
        + slowEnvelope * mix(0.062, 0.036, detailStability)
        + (plateC - 0.5) * mix(0.036, 0.024, detailStability)
        + weave * mix(0.018, 0.012, detailStability);
    return ys_soft_limit(h, softKnee);
}

float ys_phase_noise_height(vec2 p, float t, float motionScale) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float cycleA = t * (PI * 2.0 / 78.0) * (0.7 + motionScale * 0.2) * mix(1.0, 0.78, temporalStability);
    float cycleB = t * (PI * 2.0 / 115.0) * (0.76 + motionScale * 0.16) * mix(1.0, 0.82, temporalStability);
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);
    vec2 q = p * mix(1.96, 1.74, spatialStability);
    vec2 localDrift = ys_counterflow_offset(
        q,
        t * (0.92 + motionScale * 0.12),
        flow,
        cross,
        clamp(uFlowTransport, 0.0, 1.0),
        spatialStability,
        detailStability,
        temporalStability
    );
    float shearA = sin(dot(q, cross) * 0.42 + cycleB * 0.31) * 0.26;
    float shearB = sin(dot(q, flow) * 0.36 - cycleA * 0.27) * 0.22;
    vec2 driftA = flow * (cycleA * mix(0.48, 0.28, temporalStability))
        + cross * shearA
        + localDrift * 1.25;
    vec2 driftB = -flow * (cycleB * mix(0.36, 0.18, temporalStability))
        - cross * shearB
        - localDrift.yx * 0.92;

    float phaseA = ys_fbm(q * 2.32 - driftA + flow * 0.62);
    float phaseB = ys_fbm(q.yx * 2.18 - driftB.yx - cross * 0.54);
    float carrier = sin((phaseA - phaseB) * PI * 2.0 + cycleA * 0.37 - cycleB * 0.21);
    float counter = sin((phaseA + phaseB) * PI + dot(q, flow) * 0.52 + cycleB * 0.31);
    float envelope = smoothstep(
        mix(0.18, 0.3, spatialStability),
        mix(0.82, 0.9, spatialStability),
        ys_fbm(q * 0.94 - driftB * 0.22 - driftA * 0.12 + localDrift * 0.74)
    );
    float micro = ys_noise(q * 8.4 - driftA * 0.58 + driftB * 0.24) - 0.5;
    float h = carrier * (mix(0.075, 0.046, detailStability) + envelope * mix(0.034, 0.018, detailStability))
        + counter * mix(0.032, 0.018, detailStability)
        + micro * mix(0.026, 0.014, detailStability);
    return ys_soft_limit(h, softKnee);
}

float ys_limited_wave_height(vec2 p, float t, float motionScale) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float baseCycle = t * (PI * 2.0 / 128.0) * (0.74 + motionScale * 0.2) * mix(1.0, 0.8, temporalStability);
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);
    vec2 localDrift = ys_counterflow_offset(
        p * mix(1.0, 0.84, spatialStability),
        t * (0.72 + motionScale * 0.1),
        flow,
        cross,
        clamp(uFlowTransport, 0.0, 1.0),
        spatialStability,
        detailStability,
        temporalStability
    );
    vec2 q = p + localDrift;
    vec2 d1 = normalize(flow * 0.78 + cross * 0.31);
    vec2 d2 = normalize(flow * -0.42 + cross * 0.91);
    vec2 d3 = normalize(flow * 0.18 - cross * 0.98);
    vec2 d4 = normalize(flow * -0.86 - cross * 0.28);
    float a1 = 0.11;
    float a2 = 0.074;
    float a3 = 0.048;
    float a4 = 0.031;
    float h = 0.0;
    h += sin(dot(q, d1) * 2.15 + baseCycle * 1.0 + 0.17) * a1;
    h += sin(dot(q, d2) * 3.65 - baseCycle * 2.0 + 1.41) * a2;
    h += sin(dot(q, d3) * 5.9 + baseCycle * 3.0 + 2.73) * a3;
    h += sin(dot(q, d4) * 8.45 - baseCycle * 5.0 + 4.58) * a4;
    float rms = sqrt(a1 * a1 + a2 * a2 + a3 * a3 + a4 * a4);
    h = (h / max(rms, 0.0001)) * mix(0.105, 0.076, detailStability);
    float envelope = 0.94 + 0.06 * sin(baseCycle * 0.5 + ys_fbm(q * 0.36 + localDrift * 0.4) * PI);
    return ys_soft_limit(h * envelope, softKnee);
}

float ys_yoonseul_glint_height(vec2 p, float t, float motionScale) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float cycle = t * (0.72 + motionScale * 0.18) * mix(1.0, 0.78, temporalStability);
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);
    vec2 diagonal = normalize(flow * 0.64 + cross * 0.77);
    vec2 q = p * mix(1.28, 1.08, spatialStability);
    vec2 localDrift = ys_counterflow_offset(
        q,
        t * (0.86 + motionScale * 0.08),
        flow,
        cross,
        clamp(uFlowTransport, 0.0, 1.0),
        spatialStability,
        detailStability,
        temporalStability
    );
    q += localDrift;
    float longRipple = sin(dot(q, flow) * 1.34 + cycle * 0.82) * 0.046;
    float crossRipple = sin(dot(q, cross) * 2.26 - cycle * 1.16 + longRipple * 2.2) * 0.028;
    float fineRipple = sin(dot(q, diagonal) * 5.72 + cycle * 1.74) * 0.013;
    float h = (longRipple + crossRipple + fineRipple) * mix(0.86, 0.58, detailStability);
    return ys_soft_limit(h, softKnee);
}

void ys_slope_lobe_add_wave(
    vec2 p,
    vec2 dir,
    float freq,
    float amp,
    float speed,
    float phase,
    float t,
    inout float h,
    inout vec2 grad
) {
    float x = dot(p, dir) * freq + t * speed + phase;
    h += sin(x) * amp;
    grad += dir * (cos(x) * amp * freq);
}

void ys_slope_lobe_surface(
    vec2 p,
    float t,
    float motionScale,
    float sharpness,
    out float h,
    out vec3 normal
) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float irregular = clamp(uIrregularity, 0.0, 2.0);
    float flowTransport = clamp(uFlowTransport, 0.0, 1.0);
    float spectralSpread = clamp(uSpectralSpread, 0.0, 1.0);
    float spectralPeak = clamp(uSpectralPeak, 0.55, 1.45);
    float spectralPeakNorm = clamp((spectralPeak - 0.55) / 0.9, 0.0, 1.0);
    float sharpMix = clamp((sharpness - 0.4) / 2.0, 0.0, 1.0);
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    vec2 cross = vec2(-flow.y, flow.x);
    vec2 q = p * mix(1.66, 1.38, spatialStability) * mix(0.94, 1.12, spectralPeakNorm);
    float tt = t * (0.66 + motionScale * 0.26 + flowTransport * 0.08) * mix(1.0, 0.78, temporalStability);
    float localPhaseNoise = ys_noise(q * 0.38 + vec2(tt * 0.034, -tt * 0.027)) - 0.5;
    float localMicroPhase = ys_noise(q * 1.16 + vec2(-tt * 0.052, tt * 0.041) + vec2(7.1, -4.3)) - 0.5;
    float phaseJitter = (localPhaseNoise * 2.2 + localMicroPhase * 0.72)
        * mix(0.82, 0.36, detailStability)
        * (0.72 + irregular * 0.12);
    float localShear = sin(dot(q, cross) * 0.33 + tt * 0.21) * 0.26
        + sin(dot(q, flow) * 0.27 - tt * 0.17) * 0.18;
    vec2 counterflow = ys_counterflow_offset(
        q,
        tt * (0.9 + motionScale * 0.08),
        flow,
        cross,
        flowTransport,
        spatialStability,
        detailStability,
        temporalStability
    );
    vec2 drift = flow * (tt * mix(0.036, 0.018, temporalStability) * (1.0 + flowTransport * 0.32))
        + cross * localShear * (0.16 + flowTransport * 0.07)
        + counterflow * 1.36;
    vec2 s = q - drift;

    vec2 d1 = normalize(flow * 0.92 + cross * 0.32);
    vec2 d2 = normalize(flow * -0.36 + cross * 0.96);
    vec2 d3 = normalize(flow * 0.22 - cross * 0.98);
    vec2 d4 = normalize(flow * -0.88 - cross * 0.42);
    vec2 d5 = normalize(flow * 0.58 + cross * -0.82);
    float density = mix(0.96, 1.12, spectralPeakNorm) * mix(0.94, 1.08, spectralSpread);
    float calmAmp = mix(1.0, 0.68, detailStability);
    float detailAmp = mix(1.0, 0.54, detailStability);
    h = 0.0;
    vec2 grad = vec2(0.0);
    ys_slope_lobe_add_wave(s, d1, 1.73 * density, 0.072 * calmAmp, 0.58, phaseJitter + 0.19, tt, h, grad);
    ys_slope_lobe_add_wave(s, d2, 2.91 * density, 0.049 * calmAmp, -0.84, phaseJitter * -0.74 + 1.73, tt, h, grad);
    ys_slope_lobe_add_wave(s, d3, 4.86 * density, 0.030 * detailAmp, 1.17, phaseJitter * 0.56 + 3.21, tt, h, grad);
    ys_slope_lobe_add_wave(s, d4, 7.34 * density, 0.017 * detailAmp, -1.46, phaseJitter * -0.42 + 4.67, tt, h, grad);
    ys_slope_lobe_add_wave(s, d5, 10.9 * density, 0.008 * detailAmp, 1.82, phaseJitter * 0.31 + 5.41, tt, h, grad);

    float softKneeScale = mix(0.18, 1.12, softKnee);
    float softDenom = 1.0 + abs(h) * softKneeScale;
    h = h / softDenom;
    grad /= softDenom * softDenom;
    float px = 3.8 * (uWaterScale / 960.0);
    float strength = mix(30.0, 46.0, sharpMix) * mix(0.92, 0.72, detailStability);
    normal = normalize(vec3(-grad * px * strength, 0.30));
}

float ys_slope_lobe_height(vec2 p, float t, float motionScale) {
    float h = 0.0;
    vec3 normal = vec3(0.0, 0.0, 1.0);
    ys_slope_lobe_surface(p, t, motionScale, 1.0, h, normal);
    return h;
}

float ys_stochastic_slope_omega(float waveNumber) {
    float gravityTerm = 0.34 * waveNumber;
    float capillaryTerm = 0.0042 * waveNumber * waveNumber * waveNumber;
    return sqrt(max(0.0001, gravityTerm + capillaryTerm));
}

void ys_stochastic_slope_wave_state(
    vec2 p,
    vec2 flow,
    float t,
    float slotId,
    float epoch,
    float baseWaveNumber,
    float baseAmplitude,
    float directionOffset,
    float parameterJitter,
    out float waveHeight,
    out vec2 waveGradient
) {
    float seedKey = slotId * 37.17 + epoch * 113.91 + 5.3;
    float waveNumberJitter = mix(
        0.88,
        1.12,
        ys_hash(vec2(seedKey + 11.7, slotId + 3.1))
    );
    float directionJitter = (
        ys_hash(vec2(seedKey + 23.9, slotId + 7.4)) - 0.5
    ) * parameterJitter;
    float amplitudeJitter = mix(
        0.84,
        1.16,
        ys_hash(vec2(seedKey + 41.3, slotId + 13.8))
    );
    float phase = ys_hash(vec2(seedKey + 67.1, slotId + 19.2)) * PI * 2.0;
    float waveNumber = baseWaveNumber * waveNumberJitter;
    float amplitude = baseAmplitude * amplitudeJitter;
    vec2 direction = normalize(ys_rot(directionOffset + directionJitter) * flow);
    float omega = ys_stochastic_slope_omega(waveNumber);
    float x = dot(p, direction) * waveNumber - t * omega + phase;
    waveHeight = sin(x) * amplitude;
    waveGradient = direction * (cos(x) * amplitude * waveNumber);
}

void ys_stochastic_slope_add_turnover_wave(
    vec2 p,
    vec2 flow,
    float t,
    float slotId,
    float slotOffset,
    float baseWaveNumber,
    float baseAmplitude,
    float directionOffset,
    float parameterJitter,
    float bankPeriod,
    inout float h,
    inout vec2 grad
) {
    float clock = t / max(1.0, bankPeriod) + slotOffset;
    float epoch = floor(clock);
    float fade = smoothstep(0.89, 1.0, fract(clock));
    float heightA = 0.0;
    float heightB = 0.0;
    vec2 gradientA = vec2(0.0);
    vec2 gradientB = vec2(0.0);
    ys_stochastic_slope_wave_state(
        p,
        flow,
        t,
        slotId,
        epoch,
        baseWaveNumber,
        baseAmplitude,
        directionOffset,
        parameterJitter,
        heightA,
        gradientA
    );
    ys_stochastic_slope_wave_state(
        p,
        flow,
        t,
        slotId,
        epoch + 1.0,
        baseWaveNumber,
        baseAmplitude,
        directionOffset,
        parameterJitter,
        heightB,
        gradientB
    );
    float weightA = sqrt(max(0.0, 1.0 - fade));
    float weightB = sqrt(max(0.0, fade));
    h += heightA * weightA + heightB * weightB;
    grad += gradientA * weightA + gradientB * weightB;
}

void ys_stochastic_slope_spectrum_surface(
    vec2 p,
    float t,
    float motionScale,
    float sharpness,
    out float h,
    out vec3 normal
) {
    float spatialStability = ys_spatial_stability();
    float detailStability = ys_detail_stability();
    float temporalStability = ys_temporal_stability();
    float softKnee = clamp(uYoonseulSoftKnee, 0.0, 1.0);
    float irregular = clamp(uIrregularity, 0.0, 2.0);
    float flowTransport = clamp(uFlowTransport, 0.0, 1.0);
    float spectralSpread = clamp(uSpectralSpread, 0.0, 1.0);
    float spectralPeak = clamp(uSpectralPeak, 0.55, 1.45);
    float spectralPeakNorm = clamp((spectralPeak - 0.55) / 0.9, 0.0, 1.0);
    float sharpMix = clamp((sharpness - 0.4) / 2.0, 0.0, 1.0);
    vec2 flow = normalize(uCurrentDir + vec2(0.0001, 0.0001));
    float tt = t
        * (0.66 + motionScale * 0.24)
        * mix(1.0, 0.78, temporalStability);
    float density = mix(1.08, 0.94, spatialStability)
        * mix(0.96, 1.1, spectralPeakNorm);
    float directionSpread = mix(1.08, 0.9, flowTransport);
    float calmAmplitude = mix(1.0, 0.74, detailStability);
    float detailAmplitude = mix(1.0, 0.56, detailStability)
        * mix(0.92, 1.08, spectralSpread);
    float parameterJitter = mix(0.62, 0.34, detailStability)
        * (0.84 + irregular * 0.12);
    float bankPeriod = mix(62.0, 94.0, temporalStability);
    vec2 q = p * density;
    h = 0.0;
    vec2 grad = vec2(0.0);

    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 0.0, 0.0, 1.42, 0.078 * calmAmplitude, 0.12 * directionSpread, parameterJitter, bankPeriod, h, grad);
    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 1.0, 0.1666667, 2.15, 0.057 * calmAmplitude, -0.58 * directionSpread, parameterJitter, bankPeriod, h, grad);
    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 2.0, 0.3333333, 3.18, 0.041 * calmAmplitude, 0.82 * directionSpread, parameterJitter, bankPeriod, h, grad);
    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 3.0, 0.5, 4.72, 0.027 * detailAmplitude, -1.14 * directionSpread, parameterJitter, bankPeriod, h, grad);
    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 4.0, 0.6666667, 7.1, 0.016 * detailAmplitude, 1.38 * directionSpread, parameterJitter, bankPeriod, h, grad);
    ys_stochastic_slope_add_turnover_wave(q, flow, tt, 5.0, 0.8333333, 10.6, 0.009 * detailAmplitude, 2.36 * directionSpread, parameterJitter, bankPeriod, h, grad);

    float softKneeScale = mix(0.18, 1.12, softKnee);
    float softDenom = 1.0 + abs(h) * softKneeScale;
    h /= softDenom;
    grad /= softDenom * softDenom;
    float px = 3.8 * (uWaterScale / 960.0);
    float strength = mix(29.0, 43.0, sharpMix) * mix(0.96, 0.78, detailStability);
    normal = normalize(vec3(-grad * px * strength, 0.31));
}

float ys_stochastic_slope_spectrum_height(vec2 p, float t, float motionScale) {
    float h = 0.0;
    vec3 normal = vec3(0.0, 0.0, 1.0);
    ys_stochastic_slope_spectrum_surface(p, t, motionScale, 1.0, h, normal);
    return h;
}

float ys_glint_flake_layer(
    vec2 worldPixel,
    float t,
    float layerSeed,
    float cellPx,
    float density,
    float rMinPx,
    float rMaxPx,
    float speedBase
) {
    vec2 centerPixel = max(uWorldResolution, vec2(1.0)) * 0.5;
    vec2 pix = ys_rot(layerSeed * 1.731 + 0.37) * (worldPixel - centerPixel) + centerPixel;
    float temporalStability = ys_temporal_stability();
    float latticeTime = t * (0.24 + speedBase * 0.13);
    vec2 latticeWarp = vec2(
        sin((pix.y / max(1.0, cellPx)) * 0.47 + latticeTime + layerSeed * 1.7),
        cos((pix.x / max(1.0, cellPx)) * 0.39 - latticeTime * 1.13 + layerSeed * 2.3)
    ) * cellPx * mix(0.24, 0.08, temporalStability);
    pix += latticeWarp;
    vec2 x = pix / cellPx + vec2(19.71, 31.37) * layerSeed;
    vec2 cell = floor(x);
    vec2 f = fract(x);
    vec2 cellSeed = cell + vec2(103.7, 47.3) * layerSeed;
    float localSpeed = speedBase * mix(0.55, 1.65, ys_hash(cellSeed + vec2(1.1, 2.2)));
    float localPhase = ys_hash(cellSeed + vec2(3.3, 4.4)) * 7.0;
    float localTime = t * localSpeed + localPhase;
    float epoch = mod(floor(localTime), 256.0);
    float tau = fract(localTime);
    vec2 seed = cellSeed + vec2(37.17, 113.91) * epoch;
    float active = step(ys_hash(seed + vec2(5.1, 6.1)), clamp(density, 0.0, 1.0));
    float rPx = mix(rMinPx, rMaxPx, pow(ys_hash(seed + vec2(7.1, 8.1)), 2.35));
    float r = rPx / cellPx;
    float margin = clamp(max(0.18, r * 2.1), 0.18, 0.42);
    vec2 c = mix(vec2(margin), vec2(1.0 - margin), ys_hash2(seed + vec2(9.7, 10.4)));
    vec2 dA = normalize(ys_hash2(seed + vec2(11.2, 12.2)) * 2.0 - 1.0 + vec2(0.001));
    vec2 dB = normalize(ys_hash2(seed + vec2(13.2, 14.2)) * 2.0 - 1.0 + vec2(0.001));
    float ja = sin(t * mix(0.7, 1.9, ys_hash(seed + vec2(15.2, 16.2))) + ys_hash(seed + vec2(17.2, 18.2)) * PI * 2.0);
    float jb = sin(t * mix(1.3, 2.8, ys_hash(seed + vec2(19.2, 20.2))) + ys_hash(seed + vec2(21.2, 22.2)) * PI * 2.0);
    c += 0.045 * (dA * ja + 0.55 * dB * jb);
    c = clamp(c, vec2(margin), vec2(1.0 - margin));
    float ang = ys_hash(seed + vec2(23.2, 24.2)) * PI * 2.0;
    float aspect = mix(0.70, 1.95, ys_hash(seed + vec2(25.2, 26.2)));
    vec2 q = ys_rot(ang) * (f - c);
    q /= vec2(max(0.0001, r * aspect), max(0.0001, r));
    float dist = length(q);
    float core = pow(1.0 - smoothstep(0.55, 1.0, dist), 1.35);
    float halo = 0.22 * (1.0 - smoothstep(0.0, 2.2, dist));
    float blinkCenter = mix(0.25, 0.75, ys_hash(seed + vec2(27.2, 28.2)));
    float blinkWidth = mix(0.055, 0.165, ys_hash(seed + vec2(29.2, 30.2)));
    float rise = smoothstep(blinkCenter - blinkWidth, blinkCenter, tau);
    float fall = 1.0 - smoothstep(blinkCenter, blinkCenter + blinkWidth, tau);
    float env = pow(max(0.0, rise * fall), 1.6);
    float amp = 0.45 + 2.6 * pow(ys_hash(seed + vec2(45.2, 46.2)), 3.2);
    return active * amp * env * (core + halo);
}

float ys_yoonseul_glint_flakes(vec2 worldPixel, float t, float sharpMix, float intensityDrive) {
    float densityScale = clamp(intensityDrive * 0.7 + sharpMix * 0.24, 0.22, 1.8);
    float s = 0.0;
    s += ys_glint_flake_layer(worldPixel, t, 1.0, 13.0, 0.42 * densityScale, 2.0, 4.2, 1.05);
    s += 0.82 * ys_glint_flake_layer(worldPixel, t, 2.0, 19.0, 0.30 * densityScale, 2.6, 5.6, 0.78);
    s += 0.58 * ys_glint_flake_layer(worldPixel, t, 3.0, 29.0, 0.18 * densityScale, 3.2, 7.0, 0.52);
    return clamp(s, 0.0, 2.8);
}

float ys_surface_height(vec2 p, float t, float motionScale, float algorithmMode) {
    if (algorithmMode < 0.5) {
        return ys_height(p, t, motionScale);
    }
    if (algorithmMode < 1.5) {
        return ys_looped_caustic_height(p, t, motionScale);
    }
    if (algorithmMode < 2.5) {
        return ys_phase_noise_height(p, t, motionScale);
    }
    if (algorithmMode < 3.5) {
        return ys_limited_wave_height(p, t, motionScale);
    }
    if (algorithmMode < 4.5) {
        return ys_yoonseul_glint_height(p, t, motionScale);
    }
    if (algorithmMode < 5.5) {
        return ys_slope_lobe_height(p, t, motionScale);
    }
    return ys_stochastic_slope_spectrum_height(p, t, motionScale);
}

vec3 ys_normal(vec2 p, float t, float motionScale, float sharpness) {
    float px = 3.8 * (uWaterScale / 960.0);
    float h = ys_height(p, t, motionScale);
    float hx = ys_height(p + vec2(px, 0.0), t, motionScale) - h;
    float hy = ys_height(p + vec2(0.0, px), t, motionScale) - h;
    float sharpMix = clamp((sharpness - 0.4) / 2.0, 0.0, 1.0);
    float strength = mix(28.0, 46.0, sharpMix);
    return normalize(vec3(-hx * strength, -hy * strength, 0.27));
}

vec3 ys_normal_from_h(vec2 p, float h, float t, float motionScale, float sharpness) {
    float px = 3.8 * (uWaterScale / 960.0);
    float hx = ys_height(p + vec2(px, 0.0), t, motionScale) - h;
    float hy = ys_height(p + vec2(0.0, px), t, motionScale) - h;
    float sharpMix = clamp((sharpness - 0.4) / 2.0, 0.0, 1.0);
    float strength = mix(28.0, 46.0, sharpMix);
    return normalize(vec3(-hx * strength, -hy * strength, 0.27));
}

vec3 ys_surface_normal_from_h(vec2 p, float h, float t, float motionScale, float sharpness, float algorithmMode) {
    float px = 3.8 * (uWaterScale / 960.0);
    float hx = ys_surface_height(p + vec2(px, 0.0), t, motionScale, algorithmMode) - h;
    float hy = ys_surface_height(p + vec2(0.0, px), t, motionScale, algorithmMode) - h;
    float detailStability = ys_detail_stability();
    float sharpMix = clamp((sharpness - 0.4) / 2.0, 0.0, 1.0);
    float strength = mix(28.0, 46.0, sharpMix) * mix(1.0, 0.78, detailStability);
    return normalize(vec3(-hx * strength, -hy * strength, 0.27));
}
`;
