import { createZenSeededRandom } from '../../../shared/zenSeededRandom.js';

const clampValue = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(max, Math.max(min, numeric));
};

const lerp = (a, b, t) => a + ((b - a) * t);

const mixRgb = (a, b, ratio) => {
    const t = clampValue(ratio, 0, 1);
    return {
        r: lerp(a.r, b.r, t),
        g: lerp(a.g, b.g, t),
        b: lerp(a.b, b.b, t),
    };
};

const toRgba = (rgb, alpha) => {
    const a = clampValue(alpha, 0, 1);
    return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`;
};

const VARIANT_PROFILES = Object.freeze({
    hero: Object.freeze({
        widthGain: 0.82,
        heightGain: 1.18,
        noiseGain: 1.0,
        ridgeBase: 3,
        lobeGain: 1.0,
        coolBias: 0.36,
        patternGain: 0.4,
        angularityBase: 0.26,
        chunkinessBase: 0.28,
        asymmetryBase: 0.11,
    }),
    slab: Object.freeze({
        widthGain: 1.18,
        heightGain: 0.82,
        noiseGain: 0.68,
        ridgeBase: 2,
        lobeGain: 0.44,
        coolBias: 0.22,
        patternGain: 0.22,
        angularityBase: 0.14,
        chunkinessBase: 0.14,
        asymmetryBase: 0.08,
    }),
    flat: Object.freeze({
        widthGain: 1.16,
        heightGain: 0.68,
        noiseGain: 0.58,
        ridgeBase: 2,
        lobeGain: 0.35,
        coolBias: 0.18,
        patternGain: 0.15,
        angularityBase: 0.1,
        chunkinessBase: 0.12,
        asymmetryBase: 0.07,
    }),
    ridge: Object.freeze({
        widthGain: 0.92,
        heightGain: 1.24,
        noiseGain: 1.15,
        ridgeBase: 4,
        lobeGain: 1.2,
        coolBias: 0.42,
        patternGain: 0.76,
        angularityBase: 0.42,
        chunkinessBase: 0.46,
        asymmetryBase: 0.17,
    }),
    cluster: Object.freeze({
        widthGain: 0.98,
        heightGain: 1.04,
        noiseGain: 1.28,
        ridgeBase: 5,
        lobeGain: 1.32,
        coolBias: 0.34,
        patternGain: 0.58,
        angularityBase: 0.5,
        chunkinessBase: 0.62,
        asymmetryBase: 0.2,
    }),
});

const resolveVariant = (variant) => {
    if (typeof variant !== 'string') return 'hero';
    const normalized = variant.trim().toLowerCase();
    return VARIANT_PROFILES[normalized] ? normalized : 'hero';
};

const ROCK_FOOTPRINT_MULTIPLIER = Object.freeze({
    hero: 0.72, slab: 0.76, flat: 0.78, ridge: 0.8, cluster: 0.82,
});
const SHAPE_FAMILIES = Object.freeze({
    waterworn: { width: 0.94, height: 1.08, shoulder: 0.025, lean: 0.05, cuts: 0 },
    elongated: { width: 1.22, height: 0.78, shoulder: 0.04, lean: 0.12, cuts: 0 },
    slab: { width: 1.18, height: 0.82, shoulder: 0.035, lean: 0.14, cuts: 1 },
    wedge: { width: 1.07, height: 0.97, shoulder: 0.065, lean: 0.18, cuts: 1 },
    fractured: { width: 1.02, height: 1.02, shoulder: 0.06, lean: 0.1, cuts: 1 },
    shouldered: { width: 1.02, height: 1.02, shoulder: 0.085, lean: 0.08, cuts: 0 },
});
const SHAPE_FAMILY_WEIGHTS = Object.freeze({
    hero: [3, 2, 1, 2, 2, 1],
    slab: [1, 3, 4, 1, 2, 1],
    flat: [2, 3, 4, 1, 1, 1],
    ridge: [1, 2, 1, 3, 3, 2],
    cluster: [2, 1, 1, 2, 3, 4],
});
const SHAPE_FAMILY_IDS = Object.freeze(Object.keys(SHAPE_FAMILIES));

export const getZenRockCollisionRadius = (size, variant) => {
    if (!Number.isFinite(size) || size <= 0 || !Object.hasOwn(ROCK_FOOTPRINT_MULTIPLIER, variant)) {
        throw new Error('ZEN_ROCK_FOOTPRINT_INPUT_INVALID');
    }
    const safeSize = Math.max(24, size);
    const smallRockCompaction = clampValue(0.84 + (safeSize / 140) * 0.22, 0.78, 1.06);
    return safeSize * ROCK_FOOTPRINT_MULTIPLIER[variant] * smallRockCompaction;
};

export const buildZenRockShapeSeedKey = (rock) => {
    if (!rock || !Object.hasOwn(VARIANT_PROFILES, rock.variant) || !Number.isFinite(rock.noiseSeed)) {
        throw new Error('ZEN_ROCK_SHAPE_SEED_INVALID');
    }
    return `zen-rock-shape-v1|${rock.variant}|${rock.noiseSeed.toFixed(6)}`;
};

// One organic outline owns the pigment fill, clipping, edge and geometry mask.
// Shape-family variation has its own deterministic stream; it never consumes layout RNG.
export const resolveZenRockShape = (rock) => {
    const profile = VARIANT_PROFILES[rock.variant];
    const shapeFields = ['noiseSeed', 'size', 'tilt', 'patternStrength', 'roughness', 'edgeChip', 'ridgeStrength', 'angularity', 'profileAxis', 'chunkiness', 'asymmetry'];
    if (!profile || shapeFields.some((key) => !Number.isFinite(rock[key])) || rock.size <= 0) {
        throw new Error('ZEN_ROCK_SHAPE_INPUT_INVALID');
    }
    const rng = createZenSeededRandom(buildZenRockShapeSeedKey(rock));
    const weights = SHAPE_FAMILY_WEIGHTS[rock.variant];
    let familyIndex = 0;
    let choice = rng() * weights.reduce((sum, weight) => sum + weight, 0);
    while (familyIndex < weights.length - 1 && choice >= weights[familyIndex]) {
        choice -= weights[familyIndex];
        familyIndex += 1;
    }
    const family = SHAPE_FAMILY_IDS[familyIndex];
    const form = SHAPE_FAMILIES[family];
    const radiusX = rock.size * (0.46 + profile.widthGain * 0.12) * form.width * (0.95 + rng() * 0.1);
    const radiusY = rock.size * (0.27 + profile.heightGain * 0.1) * rock.tilt * form.height * (0.94 + rng() * 0.12);
    const shoulderPhase = rng() * Math.PI * 2;
    const lean = (rng() - 0.5) * form.lean * 2;
    const broadAsymmetry = (0.04 + rng() * 0.12) * (family === 'wedge' ? 1.6 : 1);
    const cutAngle = family === 'slab' ? Math.PI * 0.5 + (rng() - 0.5) * 0.3 : shoulderPhase;
    const cutOffset = family === 'wedge' ? 0.70 + rng() * 0.12
        : family === 'slab' ? 0.85 + rng() * 0.07 : 0.79 + rng() * 0.12;
    const envelope = getZenRockCollisionRadius(rock.size, rock.variant) * 0.94;
    const effectivePattern = clampValue(rock.patternStrength * profile.patternGain, 0, 1.2);
    const points = [];
    for (let i = 0; i < 44; i += 1) {
        const angle = i / 44 * Math.PI * 2;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);
        const superX = Math.sign(cosA) * Math.pow(Math.abs(cosA), 1 + rock.angularity * 0.68);
        const superY = Math.sign(sinA) * Math.pow(Math.abs(sinA), 1 - rock.angularity * 0.26);
        const basePhase = rock.noiseSeed;
        const lowWave = Math.sin(angle * 2.6 + basePhase) * (0.03 + rock.roughness * 0.06 * profile.noiseGain);
        const midWave = Math.cos(angle * 4.4 + basePhase * 1.43) * (0.02 + rock.roughness * 0.05);
        const highWave = Math.sin(angle * 7.8 + basePhase * 0.66) * (0.005 + rock.edgeChip * 0.032 * profile.noiseGain);
        const ridgeWave = Math.sin(angle * 3.7 + basePhase * 1.1) * (0.018 * rock.ridgeStrength * profile.lobeGain * (0.25 + effectivePattern * 0.75));
        const facetWave = Math.sin(angle * (3 + Math.round(profile.lobeGain * 2.2)) + basePhase * 0.84);
        const facetShape = Math.sign(facetWave) * Math.pow(Math.abs(facetWave), 1.85 - rock.angularity * 0.55);
        const facet = facetShape * (0.007 + rock.angularity * 0.032);
        const axial = Math.cos(angle - rock.profileAxis), lateral = Math.sin(angle - rock.profileAxis);
        const chunkWave = Math.sin((angle + rock.profileAxis * 0.58) * (1.8 + rock.chunkiness * 2.4) + basePhase * 0.54) * (0.008 + rock.chunkiness * 0.034);
        const shoulder = Math.cos(angle * (family === 'shouldered' ? 3 : 2) + shoulderPhase) * form.shoulder;
        const radialNoise = clampValue(1 + lowWave + midWave + highWave + ridgeWave + facet + chunkWave + shoulder, 0.78, 1.24);
        const axisShape = clampValue(1 + axial * rock.asymmetry + lateral * rock.chunkiness * 0.18 + Math.cos(angle - shoulderPhase) * broadAsymmetry, 0.76, 1.24);
        let x = superX * radiusX * radialNoise * axisShape;
        let y = superY * radiusY * radialNoise * (1 + ridgeWave * 0.55 - axial * rock.asymmetry * 0.08);
        x += y * lean;
        for (let cut = 0; cut < form.cuts; cut += 1) {
            const normalAngle = cutAngle + cut * Math.PI;
            const projection = x / radiusX * Math.cos(normalAngle) + y / radiusY * Math.sin(normalAngle);
            const limit = cutOffset + cut * 0.06;
            if (projection > limit) {
                const clipGain = limit / projection;
                x *= clipGain; y *= clipGain;
            }
        }
        const distance = Math.hypot(x, y);
        if (distance > envelope) { x *= envelope / distance; y *= envelope / distance; }
        points.push({ x, y });
    }
    // Preserve the existing softened edges; broad fractures must not become spikes.
    for (let pass = 0; pass < 3; pass += 1) {
        for (let i = 0; i < points.length; i += 1) {
            const prev = points[(i - 1 + points.length) % points.length], curr = points[i], next = points[(i + 1) % points.length];
            const v1x = curr.x - prev.x, v1y = curr.y - prev.y, v2x = next.x - curr.x, v2y = next.y - curr.y;
            const turnRad = Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
            if (Math.hypot(v1x, v1y) < 1e-4 || Math.hypot(v2x, v2y) < 1e-4 || turnRad <= 0.58) continue;
            const exceed = clampValue((turnRad - 0.58) / turnRad, 0, 1);
            const soften = clampValue(0.3 + exceed * 0.56, 0, 0.86);
            curr.x = lerp(curr.x, (prev.x + next.x) * 0.5, soften);
            curr.y = lerp(curr.y, (prev.y + next.y) * 0.5, soften);
        }
    }
    return { family, radiusX, radiusY, points };
};

class HeroRock {
    constructor(x, y, size = 120, options = null) {
        const random = typeof options?.random === 'function'
            ? options.random
            : Math.random;
        this.x = Number.isFinite(x) ? x : 0;
        this.y = Number.isFinite(y) ? y : 0;
        this.size = Math.max(32, Number.isFinite(size) ? size : 120);
        this.rotation = random() * Math.PI * 2;
        this.variant = resolveVariant(options?.variant);
        const profile = VARIANT_PROFILES[this.variant] || VARIANT_PROFILES.hero;
        this.tilt = clampValue(
            Number(options?.flattening ?? (0.86 + random() * 0.28)),
            0.55,
            1.6,
        );
        this.noiseSeed = Number.isFinite(Number(options?.shapeSeed))
            ? Number(options.shapeSeed)
            : random() * Math.PI * 2;
        this.shadowOffset = 16 + random() * 22;
        this.highlightBias = 0.15 + random() * 0.28;
        this.roughness = clampValue(
            Number(options?.roughness ?? (0.45 + random() * 0.5)),
            0.15,
            0.95,
        );
        this.ridgeStrength = clampValue(
            Number(options?.ridgeStrength ?? (0.32 + random() * 0.62)),
            0,
            0.9,
        );
        this.edgeChip = clampValue(
            Number(options?.edgeChip ?? (0.22 + random() * 0.56)),
            0,
            0.55,
        );
        this.patternStrength = clampValue(
            Number(options?.patternStrength ?? (0.18 + random() * 0.28)),
            0,
            1.2,
        );
        this.angularity = clampValue(
            Number(options?.angularity ?? (profile.angularityBase + random() * 0.2)),
            0,
            0.7,
        );
        this.chunkiness = clampValue(
            Number(options?.chunkiness ?? (profile.chunkinessBase + random() * 0.18)),
            0,
            0.78,
        );
        this.asymmetry = clampValue(
            Number(options?.asymmetry ?? (profile.asymmetryBase + random() * 0.12)),
            0,
            0.28,
        );
        this.profileAxis = Number.isFinite(Number(options?.profileAxis))
            ? Number(options.profileAxis)
            : (random() * Math.PI * 2);
        this.tone = clampValue(
            Number(options?.tone ?? random()),
            0,
            1,
        );
    }

    draw(ctx, envState = null, options = null) {
        const profile = VARIANT_PROFILES[this.variant] || VARIANT_PROFILES.hero;
        const renderContactShadow = options?.renderContactShadow !== false;
        const effectivePattern = clampValue(
            this.patternStrength * (profile.patternGain ?? 1),
            0,
            1.2,
        );
        const { radiusX, radiusY, points: rawPoints } = resolveZenRockShape(this);
        const basePhase = this.noiseSeed;

        const warmBase = { r: 136, g: 122, b: 103 };
        const coolBase = { r: 88, g: 105, b: 116 };
        const warmHighlight = { r: 188, g: 175, b: 151 };
        const coolHighlight = { r: 152, g: 176, b: 187 };
        const coolBlend = clampValue(this.tone * 0.72 + profile.coolBias * 0.28, 0, 1);
        const bodyLow = mixRgb(warmBase, coolBase, coolBlend);
        const bodyMid = mixRgb({ r: 92, g: 79, b: 64 }, bodyLow, 0.66);
        const bodyHigh = mixRgb(warmHighlight, coolHighlight, coolBlend);
        const ridgeColor = mixRgb(bodyMid, { r: 208, g: 203, b: 193 }, 0.26 + this.ridgeStrength * 0.22);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (renderContactShadow) {
            // Soft contact shadow keeps rocks submerged without harsh edges.
            ctx.save();
            const shadowLen = envState ? envState.shadowLength : this.shadowOffset * 0.76;
            const sunAngleOffset = envState ? envState.sunAngle : Math.PI * 0.75;
            const sx = Math.cos(sunAngleOffset) * shadowLen;
            const sy = Math.sin(sunAngleOffset) * shadowLen;
            ctx.translate(sx, sy);
            ctx.scale(1.03 + profile.widthGain * 0.1, 0.72 + profile.heightGain * 0.12);
            const shadow = ctx.createRadialGradient(0, 0, radiusX * 0.16, 0, 0, radiusX * 1.22);
            shadow.addColorStop(0, 'rgba(0, 10, 8, 0.25)');
            shadow.addColorStop(1, 'rgba(0, 10, 8, 0)');
            ctx.fillStyle = shadow;
            ctx.beginPath();
            ctx.ellipse(0, 0, radiusX * 1.16, radiusY * 1.05, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const silhouette = new Path2D();
        if (rawPoints.length > 0) {
            silhouette.moveTo(rawPoints[0].x, rawPoints[0].y);
            for (let i = 1; i < rawPoints.length; i += 1) {
                silhouette.lineTo(rawPoints[i].x, rawPoints[i].y);
            }
        }
        silhouette.closePath();

        if (options?.renderSilhouette === true) {
            ctx.fillStyle = '#ffffff';
            ctx.fill(silhouette);
            ctx.restore();
            return;
        }
        const neutralLighting = options?.neutralLighting === true;
        const body = neutralLighting
            ? ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX)
            : ctx.createLinearGradient(-radiusX, -radiusY, radiusX, radiusY);
        body.addColorStop(0, toRgba(neutralLighting ? bodyLow : bodyHigh, 1));
        body.addColorStop(0.44, toRgba(bodyLow, 1));
        body.addColorStop(1, toRgba(bodyMid, 1));
        ctx.fillStyle = body;
        ctx.fill(silhouette);

        ctx.save();
        ctx.clip(silhouette);
        const ridgeCount = effectivePattern > 0.05
            ? Math.max(1, Math.round(1 + (profile.ridgeBase - 1) * effectivePattern + this.ridgeStrength * 2.2 * effectivePattern))
            : 0;
        for (let i = 0; i < ridgeCount; i += 1) {
            const offset = lerp(-radiusY * 0.45, radiusY * 0.5, (i + 0.5) / ridgeCount);
            const bend = (Math.sin(i * 0.92 + basePhase * 0.6) * radiusX * 0.12) * (0.3 + profile.lobeGain * 0.34);
            const amp = (0.14 + this.ridgeStrength * 0.32) * (0.7 + Math.sin(i + basePhase) * 0.2) * effectivePattern;
            ctx.strokeStyle = toRgba(ridgeColor, clampValue(0.015 + amp * 0.085, 0.01, 0.14));
            ctx.lineWidth = Math.max(0.42, this.size * 0.0052 * (0.8 + this.ridgeStrength * 0.22) * (0.7 + effectivePattern * 0.3));
            ctx.beginPath();
            ctx.moveTo(-radiusX * 0.92, offset - bend * 0.15);
            ctx.bezierCurveTo(
                -radiusX * 0.36,
                offset - bend,
                radiusX * 0.28,
                offset + bend,
                radiusX * 0.94,
                offset + bend * 0.15,
            );
            ctx.stroke();
        }
        ctx.restore();

        // Submerged color veil (opaque tinting, no transparency tricks).
        ctx.save();
        ctx.clip(silhouette);
        const submergedVeil = ctx.createLinearGradient(0, -radiusY * 0.44, 0, radiusY * 1.06);
        submergedVeil.addColorStop(0, 'rgba(28, 62, 70, 0.08)');
        submergedVeil.addColorStop(0.56, 'rgba(34, 74, 82, 0.16)');
        submergedVeil.addColorStop(1, 'rgba(42, 90, 98, 0.24)');
        ctx.fillStyle = submergedVeil;
        ctx.fillRect(-radiusX * 1.3, -radiusY * 1.2, radiusX * 2.6, radiusY * 2.7);
        ctx.restore();

        if (!neutralLighting) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const highlight = ctx.createRadialGradient(
            -radiusX * (0.34 + this.highlightBias * 0.36),
            -radiusY * 0.42,
            0,
            -radiusX * (0.34 + this.highlightBias * 0.36),
            -radiusY * 0.42,
            radiusX * 1.08,
        );
        highlight.addColorStop(0, toRgba(bodyHigh, 0.16));
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlight;
        ctx.fill(silhouette);
        ctx.restore();

        }

        ctx.strokeStyle = toRgba(mixRgb(bodyHigh, { r: 188, g: 204, b: 212 }, 0.24), 0.14);
        ctx.lineWidth = Math.max(0.9, this.size * 0.01);
        ctx.stroke(silhouette);
        ctx.restore();
    }
}

export { HeroRock };
