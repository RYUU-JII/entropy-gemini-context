const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + ((b - a) * t);
const degToRad = (deg) => (deg * Math.PI) / 180;
const TWO_PI = Math.PI * 2;
const EPS = 1e-6;

const nextRandom = (rng, decisionType) => {
    if (typeof rng?.next === 'function') {
        const value = Number(rng.next(decisionType));
        if (Number.isFinite(value)) {
            return value;
        }
    }
    // Canonical path must stay deterministic under CRN.
    return 0.5;
};

const wrapAngle = (angle) => {
    let out = Number.isFinite(angle) ? angle : 0;
    while (out <= -Math.PI) out += TWO_PI;
    while (out > Math.PI) out -= TWO_PI;
    return out;
};

const alignAngleToReference = (angle, reference) => {
    let out = Number.isFinite(angle) ? angle : 0;
    const ref = Number.isFinite(reference) ? reference : 0;
    while (out - ref <= -Math.PI) out += TWO_PI;
    while (out - ref > Math.PI) out -= TWO_PI;
    return out;
};

const clampAngleAroundReference = (angle, reference, spreadRad) => {
    const ref = Number.isFinite(reference) ? reference : 0;
    const spread = Math.max(1e-4, Number(spreadRad) || 0);
    const aligned = alignAngleToReference(angle, ref);
    return clamp(aligned, ref - spread, ref + spread);
};

const smoothstep = (x) => {
    const t = clamp(x, 0, 1);
    return t * t * (3 - (2 * t));
};

const toControlIndex = (idx, count) => clamp(idx, 0, Math.max(0, count - 1));

const catmullRom = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1)
        + ((-p0 + p2) * t)
        + ((2 * p0 - (5 * p1) + (4 * p2) - p3) * t2)
        + ((-p0 + (3 * p1) - (3 * p2) + p3) * t3)
    );
};

const catmullRomDeriv = (p0, p1, p2, p3, t) => {
    const t2 = t * t;
    return 0.5 * (
        (-p0 + p2)
        + (2 * (2 * p0 - (5 * p1) + (4 * p2) - p3) * t)
        + (3 * (-p0 + (3 * p1) - (3 * p2) + p3) * t2)
    );
};

const catmullRomSecondDeriv = (p0, p1, p2, p3, t) => 0.5 * (
    (2 * (2 * p0 - (5 * p1) + (4 * p2) - p3))
    + (6 * (-p0 + (3 * p1) - (3 * p2) + p3) * t)
);

const evaluateSpline = (controlPoints, u) => {
    const points = Array.isArray(controlPoints) ? controlPoints : [];
    if (points.length < 2) {
        return null;
    }
    const clampedU = clamp(Number(u) || 0, 0, 1);
    const segmentCount = points.length - 1;
    const scaled = clampedU * segmentCount;
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaled));
    const localT = scaled - segmentIndex;
    const p0 = points[toControlIndex(segmentIndex - 1, points.length)];
    const p1 = points[toControlIndex(segmentIndex, points.length)];
    const p2 = points[toControlIndex(segmentIndex + 1, points.length)];
    const p3 = points[toControlIndex(segmentIndex + 2, points.length)];
    const scale = segmentCount;
    const scaleSq = scale * scale;
    const x = catmullRom(p0.x, p1.x, p2.x, p3.x, localT);
    const y = catmullRom(p0.y, p1.y, p2.y, p3.y, localT);
    const dx = catmullRomDeriv(p0.x, p1.x, p2.x, p3.x, localT) * scale;
    const dy = catmullRomDeriv(p0.y, p1.y, p2.y, p3.y, localT) * scale;
    const ddx = catmullRomSecondDeriv(p0.x, p1.x, p2.x, p3.x, localT) * scaleSq;
    const ddy = catmullRomSecondDeriv(p0.y, p1.y, p2.y, p3.y, localT) * scaleSq;
    return {
        t: clampedU,
        x,
        y,
        dx,
        dy,
        ddx,
        ddy,
    };
};

const interpolateSample = (a, b, mix, arcNorm) => {
    if (!a && !b) return null;
    if (!a) return { ...b, arcNorm };
    if (!b) return { ...a, arcNorm };
    const m = clamp(Number(mix) || 0, 0, 1);
    const baseAngle = Number(a.angle) || 0;
    const alignedAngleB = alignAngleToReference(Number(b.angle) || 0, baseAngle);
    const angle = wrapAngle(lerp(baseAngle, alignedAngleB, m));
    return {
        t: lerp(a.t, b.t, m),
        x: lerp(a.x, b.x, m),
        y: lerp(a.y, b.y, m),
        angle,
        curvature: lerp(a.curvature, b.curvature, m),
        axisSpread: lerp(a.axisSpread, b.axisSpread, m),
        curveGain: lerp(a.curveGain, b.curveGain, m),
        alignmentWeight: lerp(a.alignmentWeight, b.alignmentWeight, m),
        curveRatio: lerp(a.curveRatio, b.curveRatio, m),
        lengthScale: lerp(a.lengthScale, b.lengthScale, m),
        arcNorm,
    };
};

export class SakuraTrunkSplineModel {
    static create({
        gene,
        maxDepth = 7,
        trunkSegmentLimit = 3,
        rng = null,
    } = {}) {
        const style = clamp(Number(gene?.trunkStyle ?? 0.5), 0, 1);
        const chaos = clamp(Number(gene?.branchChaos ?? 0.5), 0, 1);
        const curveStrengthNorm = clamp(Number(gene?.curvatureStrength ?? 0.5) / 2.5, 0, 1);
        const frequency = clamp(Number(gene?.curvatureFreq ?? 0.5), 0.1, 2.2);
        const kinkChance = clamp(Number(gene?.trunkKinkChance ?? 0), 0, 1);
        const kinkAngleNorm = clamp(Number(gene?.trunkKinkAngle ?? 0.5) / 1.5, 0, 1);
        const curvedStyleIntent = clamp((style - 0.55) / 0.45, 0, 1);
        const kinkIntent = clamp((kinkChance * 0.74) + (kinkAngleNorm * 0.26), 0, 1);
        const projectionIntent = clamp((curvedStyleIntent * 0.7) + (kinkIntent * 0.3), 0, 1);
        const backboneTiltBias = clamp(Number(gene?.trunkBackboneTiltBias ?? 0), -1, 1);
        const backboneAmpScale = clamp(Number(gene?.trunkBackboneAmp ?? 1), 0.4, 1.8);
        const backboneFreqScale = clamp(Number(gene?.trunkBackboneFreqScale ?? 1), 0.6, 1.8);
        const backboneDepthDecay = clamp(Number(gene?.trunkBackboneDepthDecay ?? 0.9), 0.55, 1.15);
        const backboneLockStrength = clamp(Number(gene?.trunkBackboneLockStrength ?? 0.62), 0, 1);
        const trunkSpan = Math.max(1, Number(trunkSegmentLimit) || 1);
        const horizon = Math.max(Math.round(Number(maxDepth) || 1) + 2, trunkSpan + 5);

        const continuitySignal = clamp(
            (style * 0.42) + (curveStrengthNorm * 0.38) + (chaos * 0.2),
            0,
            1,
        );
        const controlCount = clamp(
            Math.round(lerp(6, 14, continuitySignal) + (trunkSpan * 0.08)),
            6,
            18,
        );
        const phaseA = nextRandom(rng, 'trunk_spline_phase_a') * TWO_PI;
        const phaseB = nextRandom(rng, 'trunk_spline_phase_b') * TWO_PI;
        const phaseC = nextRandom(rng, 'trunk_spline_phase_c') * TWO_PI;
        const sweepPhase = nextRandom(rng, 'trunk_spline_sweep_phase') * TWO_PI;
        const sweepSign = nextRandom(rng, 'trunk_spline_sweep_sign') < 0.5 ? -1 : 1;
        const sweepFreq = lerp(0.74, 1.38, nextRandom(rng, 'trunk_spline_sweep_freq'));
        const tiltRandomRange = lerp(0.02, 0.16, style) * lerp(0.72, 1.04, chaos);
        const tiltBiasRange = lerp(0.04, 0.2, style);
        const tilt = (
            backboneTiltBias * tiltBiasRange
            + (nextRandom(rng, 'trunk_spline_tilt') - 0.5) * tiltRandomRange
        );
        const ampBase = (
            lerp(0.05, 0.26, curveStrengthNorm)
            * lerp(0.72, 1.44, style)
            * lerp(1, 1.36, projectionIntent)
            * backboneAmpScale
        );
        const ampChaos = lerp(0.28, 1.08, chaos);
        const ampA = ampBase * (0.9 + nextRandom(rng, 'trunk_spline_amp_a') * 0.86) * ampChaos;
        const ampB = ampBase * (0.22 + nextRandom(rng, 'trunk_spline_amp_b') * 0.64) * ampChaos;
        const ampC = ampBase * (0.06 + nextRandom(rng, 'trunk_spline_amp_c') * 0.22) * ampChaos;
        const sweepAmp = ampBase
            * (0.24 + nextRandom(rng, 'trunk_spline_amp_sweep') * 0.64)
            * lerp(1, 1.22, projectionIntent);
        const corridorStepAmp = ampBase
            * lerp(0.18, 0.48, 1 - backboneLockStrength)
            * lerp(1, 1.52, projectionIntent);
        const backboneFrequency = clamp(frequency * backboneFreqScale, 0.08, 2.2);
        const freqA = clamp(backboneFrequency * lerp(0.36, 0.88, 1 - chaos), 0.08, 1.8);
        const freqB = clamp(backboneFrequency * lerp(0.54, 1.16, chaos), 0.1, 2);
        const freqC = clamp(backboneFrequency * lerp(0.72, 1.46, chaos), 0.14, 2.2);
        const corridorClamp = lerp(0.44, 0.68, projectionIntent);
        const xClamp = lerp(0.62, 0.86, projectionIntent);

        const controlPoints = [];
        let corridorOffset = 0;
        for (let i = 0; i < controlCount; i += 1) {
            const t = i / Math.max(1, controlCount - 1);
            const n = smoothstep(t);
            const y = -t;
            const sA = Math.sin((t * TWO_PI * freqA) + phaseA);
            const sB = Math.sin((t * TWO_PI * freqB) + phaseB);
            const sC = Math.sin((t * TWO_PI * freqC) + phaseC);
            const sSweep = Math.sin((t * Math.PI * sweepFreq) + sweepPhase);
            const depthSwayEnvelope = clamp(
                Math.pow(backboneDepthDecay, t * 2.2),
                0.52,
                1.82,
            );
            if (i > 0 && i < controlCount - 1) {
                corridorOffset = clamp(
                    corridorOffset + (nextRandom(rng, `trunk_spline_corridor_${i}`) - 0.5) * corridorStepAmp,
                    -corridorClamp,
                    corridorClamp,
                );
            } else {
                corridorOffset *= 0.4;
            }
            const x = clamp(
                (
                    tilt * (t - 0.5)
                    + (sA * ampA * (0.32 + n * 0.78) * depthSwayEnvelope)
                    + (sB * ampB * (0.2 + n * 0.82) * depthSwayEnvelope)
                    + (sC * ampC * (0.14 + n * 0.84) * depthSwayEnvelope)
                    + (sSweep * sweepAmp * sweepSign * (0.34 + n * 0.9) * depthSwayEnvelope)
                    + (corridorOffset * (0.22 + (1 - Math.abs(t - 0.5)) * 0.78))
                ),
                -xClamp,
                xClamp,
            );
            controlPoints.push({ t, x, y });
        }

        for (let pass = 0; pass < 2; pass += 1) {
            for (let i = 1; i < controlPoints.length - 1; i += 1) {
                controlPoints[i].x = (
                    (controlPoints[i - 1].x * 0.22)
                    + (controlPoints[i].x * 0.56)
                    + (controlPoints[i + 1].x * 0.22)
                );
            }
        }
        controlPoints[0].x = 0;
        controlPoints[controlPoints.length - 1].x = (
            controlPoints[controlPoints.length - 1].x * 0.82
            + (tilt * 0.22)
        );

        const sampleCount = Math.max(160, horizon * 18);
        const rawSamples = [];
        let arcLength = 0;
        let prev = null;
        for (let i = 0; i < sampleCount; i += 1) {
            const t = i / Math.max(1, sampleCount - 1);
            const point = evaluateSpline(controlPoints, t);
            if (!point) continue;
            if (prev) {
                arcLength += Math.hypot(point.x - prev.x, point.y - prev.y);
            }
            rawSamples.push({
                ...point,
                arcLen: arcLength,
            });
            prev = point;
        }
        const safeArcLength = Math.max(EPS, arcLength);

        const axisBase = degToRad(lerp(10, 24, chaos) * lerp(1, 1.08, projectionIntent));
        const axisGrowth = degToRad(lerp(10, 22, style) * lerp(1, 1.24, projectionIntent));
        const curveRatioBase = lerp(0.04, 0.16, curveStrengthNorm) * lerp(0.84, 1.2, style);
        const lowPassAlpha = lerp(0.1, 0.26, 1 - backboneLockStrength);
        const lowPassStepCap = degToRad(
            lerp(2.2, 9.6, 1 - backboneLockStrength) * lerp(1, 1.34, projectionIntent),
        );
        let previousAngle = null;
        let previousStep = 0;
        const samples = rawSamples.map((sample) => {
            const arcNorm = clamp(sample.arcLen / safeArcLength, 0, 1);
            const depthNorm = clamp(arcNorm * (horizon / Math.max(1, trunkSpan)), 0, 1.6);
            const axisSpread = axisBase + (axisGrowth * depthNorm);
            const tangentAngle = Math.atan2(sample.dy, sample.dx);
            let smoothedAngle = clampAngleAroundReference(
                tangentAngle,
                -Math.PI / 2,
                axisSpread * 1.14,
            );
            if (Number.isFinite(previousAngle) && Number.isFinite(smoothedAngle)) {
                const aligned = alignAngleToReference(smoothedAngle, previousAngle);
                let rawStep = aligned - previousAngle;
                const signFlip = previousStep !== 0
                    && rawStep !== 0
                    && Math.sign(previousStep) !== Math.sign(rawStep);
                if (signFlip) {
                    rawStep *= lerp(0.18, 0.44, 1 - backboneLockStrength);
                }
                rawStep = clamp(rawStep, -lowPassStepCap, lowPassStepCap);
                const blendedStep = (previousStep * (1 - lowPassAlpha)) + (rawStep * lowPassAlpha);
                previousStep = blendedStep;
                smoothedAngle = previousAngle + blendedStep;
            } else {
                previousStep = 0;
            }
            smoothedAngle = clampAngleAroundReference(
                smoothedAngle,
                -Math.PI / 2,
                axisSpread * 1.08,
            );
            previousAngle = smoothedAngle;
            const velocityNorm = Math.hypot(sample.dx, sample.dy);
            const denom = Math.pow((velocityNorm * velocityNorm), 1.5) + EPS;
            const curvature = (
                (sample.dx * sample.ddy) - (sample.dy * sample.ddx)
            ) / denom;
            const curvatureAbs = Math.abs(curvature);
            const curveGain = clamp(
                0.74 + (curvatureAbs * lerp(0.68, 1.56, curveStrengthNorm)),
                0.58,
                1.48,
            );
            const baseAlignmentWeight = clamp(
                lerp(0.95, 0.42, depthNorm) + ((1 - style) * 0.06),
                0.24,
                0.98,
            );
            const alignmentWeight = clamp(
                baseAlignmentWeight * lerp(0.54, 1.32, backboneLockStrength),
                0.22,
                0.98,
            );
            const signedCurveRatio = clamp(
                curvature * curveRatioBase * lerp(0.66, 1.24, 1 - depthNorm * 0.42),
                -0.16,
                0.16,
            );
            const lengthScale = clamp(
                lerp(1.03, 0.72, depthNorm) * lerp(0.95, 1.12, 1 - style),
                0.64,
                1.12,
            );
            return {
                t: sample.t,
                x: sample.x,
                y: sample.y,
                angle: smoothedAngle,
                curvature,
                axisSpread,
                curveGain,
                alignmentWeight,
                curveRatio: signedCurveRatio,
                lengthScale,
                arcNorm,
            };
        });

        return {
            controlPoints,
            samples,
            arcLength: safeArcLength,
            trunkSegmentLimit: trunkSpan,
            maxDepth: horizon,
            params: {
                tiltBias: backboneTiltBias,
                amplitudeScale: backboneAmpScale,
                frequencyScale: backboneFreqScale,
                depthDecay: backboneDepthDecay,
                lockStrength: backboneLockStrength,
            },
        };
    }

    static resolveDepthNorm(depth = 1, depthLimit = 1) {
        const limit = Math.max(1, Math.round(Number(depthLimit) || 1));
        const d = clamp(Number(depth) || 1, 1, limit);
        return clamp((d - 1) / Math.max(1, limit - 1), 0, 1);
    }

    static sampleAtArcNorm(spline, arcNorm = 0) {
        const samples = Array.isArray(spline?.samples) ? spline.samples : [];
        if (!samples.length) {
            return null;
        }
        const target = clamp(Number(arcNorm) || 0, 0, 1);
        if (samples.length === 1) {
            return {
                ...samples[0],
                arcNorm: target,
            };
        }
        if (target <= samples[0].arcNorm + EPS) {
            return {
                ...samples[0],
                arcNorm: target,
            };
        }
        const last = samples[samples.length - 1];
        if (target >= last.arcNorm - EPS) {
            return {
                ...last,
                arcNorm: target,
            };
        }
        let lo = 0;
        let hi = samples.length - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            const value = Number(samples[mid]?.arcNorm || 0);
            if (value < target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        const upper = samples[Math.min(samples.length - 1, lo)];
        const lower = samples[Math.max(0, lo - 1)];
        if (!lower || !upper) {
            return upper || lower || null;
        }
        const span = Math.max(EPS, Number(upper.arcNorm) - Number(lower.arcNorm));
        const mix = clamp((target - Number(lower.arcNorm)) / span, 0, 1);
        return interpolateSample(lower, upper, mix, target);
    }

    static sampleAtDepth(spline, depth = 1, depthLimit = null) {
        const resolvedDepthLimit = Math.max(
            1,
            Number.isFinite(Number(depthLimit))
                ? Math.round(Number(depthLimit))
                : Math.round(Number(spline?.trunkSegmentLimit || 1)),
        );
        const arcNorm = SakuraTrunkSplineModel.resolveDepthNorm(depth, resolvedDepthLimit);
        return SakuraTrunkSplineModel.sampleAtArcNorm(spline, arcNorm);
    }

    static resolveTargetAngle(spline, depth = 1, depthLimit = null) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        return Number.isFinite(sample?.angle) ? sample.angle : null;
    }

    static resolveAxisSpread(spline, depth = 1, depthLimit = null) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        return Number.isFinite(sample?.axisSpread)
            ? sample.axisSpread
            : degToRad(24);
    }

    static resolveCurveGain(spline, depth = 1, depthLimit = null) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        return Number.isFinite(sample?.curveGain) ? sample.curveGain : 1;
    }

    static resolveAlignmentWeight(spline, depth = 1, depthLimit = null) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        return Number.isFinite(sample?.alignmentWeight) ? sample.alignmentWeight : 0.5;
    }

    static resolveCurveForLength(
        spline,
        depth = 1,
        length = 0,
        fallbackCurve = 0,
        depthLimit = null,
    ) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        if (!sample || !Number.isFinite(length)) {
            return Number.isFinite(fallbackCurve) ? fallbackCurve : 0;
        }
        const ratio = Number.isFinite(sample.curveRatio) ? sample.curveRatio : 0;
        return ratio * Math.max(0, Number(length) || 0);
    }

    static resolveLengthScale(spline, depth = 1, depthLimit = null) {
        const sample = SakuraTrunkSplineModel.sampleAtDepth(spline, depth, depthLimit);
        return Number.isFinite(sample?.lengthScale) ? sample.lengthScale : 1;
    }

    static resolveContinuationOffset({
        spline,
        childDepth = 1,
        attachAngle = -Math.PI / 2,
        depthLimit = null,
    } = {}) {
        const target = SakuraTrunkSplineModel.resolveTargetAngle(
            spline,
            childDepth,
            depthLimit,
        );
        if (!Number.isFinite(target)) return 0;
        return wrapAngle(target - (Number.isFinite(attachAngle) ? attachAngle : -Math.PI / 2));
    }
}
