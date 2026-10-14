const WATER_LILY_STAGE_BUD = 'bud';
const WATER_LILY_STAGE_OPENING = 'opening';
const WATER_LILY_STAGE_BLOOM = 'bloom';

const TAU = Math.PI * 2;
const LAYER_ROLE_OUTER = 'outer';
const LAYER_ROLE_MIDDLE = 'middle';
const LAYER_ROLE_INNER = 'inner';

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + ((b - a) * t);
const smoothstep = (edge0, edge1, x) => {
    const denom = edge1 - edge0;
    const t = denom === 0 ? (x < edge0 ? 0 : 1) : clampNumber((x - edge0) / denom, 0, 1);
    return t * t * (3 - (2 * t));
};

// The pond renders top-down, so a rosette has no perspective to give it form:
// the only thing separating a flower from a pompom is where the light comes
// from. The lily pad is lit from the upper left (see the rim lift and body
// gradients in decorLilyPad.js), so the bloom sitting on it has to agree, or
// the two read as objects from different scenes.
const WATER_LILY_LIGHT_DIR = Object.freeze({ x: -0.7071, y: -0.7071 });

// Golden angle (~137.5deg): the divergence angle real spiral phyllotaxis
// (Vogel's model) uses to pack organs from a central growth point. The refined
// lily uses only a restrained fraction between whorls: enough to interleave the
// petals, never enough to turn the flower into a mechanical pinwheel.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const REFINED_OPENING_AMOUNT = 0.42;

// One organ identity is shared by the half-open and full flower. Opening only
// changes attitude, reach, and cup depth; it never swaps in a second starburst.
const REFINED_WATER_LILY_TIERS = Object.freeze([
    Object.freeze({
        count: 9,
        closed: Object.freeze({ length: 0.98, width: 0.29, tilt: 0.44, sweep: 0.075, baseShift: 0.07 }),
        open: Object.freeze({ length: 1.18, width: 0.33, tilt: 0.08, sweep: 0.018, baseShift: 0.09 }),
        tPetal: 0,
    }),
    Object.freeze({
        count: 8,
        closed: Object.freeze({ length: 0.86, width: 0.27, tilt: 0.68, sweep: 0.15, baseShift: 0.042 }),
        open: Object.freeze({ length: 1.02, width: 0.30, tilt: 0.26, sweep: 0.065, baseShift: 0.06 }),
        tPetal: 0.34,
    }),
    Object.freeze({
        count: 7,
        closed: Object.freeze({ length: 0.74, width: 0.23, tilt: 0.94, sweep: 0.23, baseShift: 0.018 }),
        open: Object.freeze({ length: 0.85, width: 0.26, tilt: 0.52, sweep: 0.12, baseShift: 0.03 }),
        tPetal: 0.68,
    }),
    Object.freeze({
        count: 5,
        closed: Object.freeze({ length: 0.58, width: 0.18, tilt: 1.16, sweep: 0.29, baseShift: 0 }),
        open: Object.freeze({ length: 0.66, width: 0.21, tilt: 0.84, sweep: 0.18, baseShift: 0 }),
        tPetal: 1,
        staminode: 0.58,
    }),
]);

function pseudoRandom(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
}

// Accepts both '#rrggbb' hex and 'rgb(r, g, b)' (the latter is what
// lerpColorHex itself emits, so blend chains like sampleGradientStops ->
// staminode-blend can feed a previously-blended color back in).
function parseColorChannels(color) {
    if (color.startsWith('rgb')) {
        const parts = color.match(/[\d.]+/g) || [0, 0, 0];
        return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    }
    const bigint = parseInt(color.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function lerpColorHex(colorA, colorB, t) {
    const a = parseColorChannels(colorA);
    const b = parseColorChannels(colorB);
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const bch = Math.round(lerp(a[2], b[2], t));
    return `rgb(${r}, ${g}, ${bch})`;
}

function sampleGradientStops(stops, t) {
    const clamped = clampNumber(t, 0, 1);
    const scaled = clamped * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(scaled));
    const localT = scaled - idx;
    const a = stops[idx];
    const b = stops[idx + 1];
    return {
        base: lerpColorHex(a.base, b.base, localT),
        mid: lerpColorHex(a.mid, b.mid, localT),
        tip: lerpColorHex(a.tip, b.tip, localT),
        glow: a.glow && b.glow ? lerpColorHex(a.glow, b.glow, localT) : (a.glow || b.glow || '#ffd54f'),
    };
}

const normalizeWaterLilyStage = (value) => {
    if (typeof value !== 'string') return null;
    const raw = value.trim().toLowerCase();
    if (raw === 'seedpod') return WATER_LILY_STAGE_BLOOM;
    if (
        raw === WATER_LILY_STAGE_BUD
        || raw === WATER_LILY_STAGE_OPENING
        || raw === WATER_LILY_STAGE_BLOOM
    ) {
        return raw;
    }
    return null;
};

// A real colony is never all-open at once: buds and half-open cups outnumber
// full blooms at any given moment, and they add life without eating surface
// the way a full bloom does.
const pickWaterLilyStage = (rng = Math.random) => {
    const roll = (typeof rng === 'function' ? rng : Math.random)();
    if (roll < 0.28) return WATER_LILY_STAGE_BUD;
    if (roll < 0.56) return WATER_LILY_STAGE_OPENING;
    return WATER_LILY_STAGE_BLOOM;
};

// ============================================================
// REFINED PALETTES & DEFINITIONS (Sakura Pink & Buttercream Gold)
// ============================================================

// Sakura / Soft Pastel Pink Palette System (Matching Bonsai Sakura tones)
const REFINED_SAKURA_PINK_PALETTES = {
    [WATER_LILY_STAGE_BLOOM]: [
        { base: '#f48fb1', mid: '#fce4ec', tip: '#fff5f8', glow: '#ffe0b2' },
        { base: '#f8bbd0', mid: '#fdecf2', tip: '#fff8fa', glow: '#ffd54f' },
        { base: '#ffcdd2', mid: '#fff0f5', tip: '#ffffff', glow: '#ffca28' },
        { base: '#ffe0b2', mid: '#fce4ec', tip: '#fff9fb', glow: '#ffb300' },
    ],
    [WATER_LILY_STAGE_OPENING]: [
        { base: '#f48fb1', mid: '#fce4ec', tip: '#fff5f8', glow: '#ffe0b2' },
        { base: '#f8bbd0', mid: '#fdecf2', tip: '#fff8fa', glow: '#ffd54f' },
        { base: '#ffcdd2', mid: '#fff0f5', tip: '#ffffff', glow: '#ffca28' },
    ],
    [WATER_LILY_STAGE_BUD]: [
        { base: '#f06292', mid: '#f8bbd0', tip: '#fce4ec', glow: '#ffe0b2' },
        { base: '#f48fb1', mid: '#ffcdd2', tip: '#fff0f5', glow: '#ffd54f' },
        { base: '#f8bbd0', mid: '#fce4ec', tip: '#ffffff', glow: '#ffca28' },
    ],
};

// Soft Peach Apricot Pink Palette System (Matching Photo 2)
const REFINED_PEACH_PINK_PALETTES = {
    [WATER_LILY_STAGE_BLOOM]: [
        { base: '#f8bbd0', mid: '#fde8ee', tip: '#fff8fa', glow: '#ffe082' },
        { base: '#ffd1dc', mid: '#fef0f4', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#ffe4e1', mid: '#fff5f7', tip: '#ffffff', glow: '#ffca28' },
        { base: '#ffe0b2', mid: '#fce4ec', tip: '#fff9fb', glow: '#ffb300' },
    ],
    [WATER_LILY_STAGE_OPENING]: [
        { base: '#f8bbd0', mid: '#fde8ee', tip: '#fff8fa', glow: '#ffe082' },
        { base: '#ffd1dc', mid: '#fef0f4', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#ffe4e1', mid: '#fff5f7', tip: '#ffffff', glow: '#ffca28' },
    ],
    [WATER_LILY_STAGE_BUD]: [
        { base: '#f48fb1', mid: '#f8bbd0', tip: '#fce4ec', glow: '#ffe082' },
        { base: '#f8bbd0', mid: '#ffd1dc', tip: '#fef0f4', glow: '#ffd54f' },
        { base: '#ffd1dc', mid: '#ffe4e1', tip: '#ffffff', glow: '#ffca28' },
    ],
};

// Buttercream Gold White Palette System (Matching Photo 1)
const REFINED_BUTTERCREAM_WHITE_PALETTES = {
    [WATER_LILY_STAGE_BLOOM]: [
        { base: '#ffe082', mid: '#fff8e7', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#ffd54f', mid: '#fff3d0', tip: '#fffdf5', glow: '#ffca28' },
        { base: '#ffca28', mid: '#ffecb3', tip: '#fff8e1', glow: '#ffb300' },
        { base: '#ffb300', mid: '#ffe082', tip: '#fff3d0', glow: '#ffa000' },
    ],
    [WATER_LILY_STAGE_OPENING]: [
        { base: '#ffe082', mid: '#fff8e7', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#ffd54f', mid: '#fff3d0', tip: '#fffdf5', glow: '#ffca28' },
        { base: '#ffca28', mid: '#ffecb3', tip: '#fff8e1', glow: '#ffb300' },
    ],
    [WATER_LILY_STAGE_BUD]: [
        { base: '#ffd54f', mid: '#ffecb3', tip: '#fff8e7', glow: '#ffca28' },
        { base: '#ffe082', mid: '#fff3d0', tip: '#fffdf5', glow: '#ffd54f' },
        { base: '#ffecb3', mid: '#fff8e7', tip: '#ffffff', glow: '#ffe082' },
    ],
};

// Alabaster Pearl Ivory White Palette System
const REFINED_ALABASTER_WHITE_PALETTES = {
    [WATER_LILY_STAGE_BLOOM]: [
        { base: '#f5eedc', mid: '#fdfbf7', tip: '#ffffff', glow: '#ffe082' },
        { base: '#ece3ce', mid: '#faf7f0', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#e5dcbe', mid: '#f8f4e8', tip: '#ffffff', glow: '#ffca28' },
        { base: '#dfd2ad', mid: '#f6f0dd', tip: '#fffdf5', glow: '#ffb300' },
    ],
    [WATER_LILY_STAGE_OPENING]: [
        { base: '#f5eedc', mid: '#fdfbf7', tip: '#ffffff', glow: '#ffe082' },
        { base: '#ece3ce', mid: '#faf7f0', tip: '#ffffff', glow: '#ffd54f' },
        { base: '#e5dcbe', mid: '#f8f4e8', tip: '#ffffff', glow: '#ffca28' },
    ],
    [WATER_LILY_STAGE_BUD]: [
        { base: '#d8ccaa', mid: '#ece3ce', tip: '#fdfbf7', glow: '#ffd54f' },
        { base: '#e5dcbe', mid: '#f5eedc', tip: '#ffffff', glow: '#ffe082' },
        { base: '#ece3ce', mid: '#faf7f0', tip: '#ffffff', glow: '#ffecb3' },
    ],
};

// Public backward-compatible palette aliases
const REFINED_PINK_PALETTES = REFINED_SAKURA_PINK_PALETTES;
const REFINED_WHITE_PALETTES = REFINED_BUTTERCREAM_WHITE_PALETTES;

function resolveWaterLilyVariant(self, stage = WATER_LILY_STAGE_BLOOM, isPinkInput = true) {
    const rawColor = typeof self?.flowerColor === 'string' ? self.flowerColor.trim().toLowerCase() : null;
    const phase = Number(self?.flowerPhase) || 0;
    const seed = pseudoRandom((phase * 29.3) + 11.7);

    if (rawColor === 'peach' || rawColor === 'apricot') {
        return {
            isPink: true,
            palette: REFINED_PEACH_PINK_PALETTES[stage] || REFINED_PEACH_PINK_PALETTES[WATER_LILY_STAGE_BLOOM],
        };
    }
    if (rawColor === 'sakura' || rawColor === 'rose') {
        return {
            isPink: true,
            palette: REFINED_SAKURA_PINK_PALETTES[stage] || REFINED_SAKURA_PINK_PALETTES[WATER_LILY_STAGE_BLOOM],
        };
    }
    if (rawColor === 'buttercream' || rawColor === 'cream') {
        return {
            isPink: false,
            palette: REFINED_BUTTERCREAM_WHITE_PALETTES[stage] || REFINED_BUTTERCREAM_WHITE_PALETTES[WATER_LILY_STAGE_BLOOM],
        };
    }
    if (rawColor === 'alabaster' || rawColor === 'ivory') {
        return {
            isPink: false,
            palette: REFINED_ALABASTER_WHITE_PALETTES[stage] || REFINED_ALABASTER_WHITE_PALETTES[WATER_LILY_STAGE_BLOOM],
        };
    }

    const resolvedIsPink = rawColor === 'pink' ? true : (rawColor === 'white' ? false : Boolean(isPinkInput));

    if (resolvedIsPink) {
        const palette = seed > 0.45
            ? REFINED_SAKURA_PINK_PALETTES[stage]
            : REFINED_PEACH_PINK_PALETTES[stage];
        return { isPink: true, palette: palette || REFINED_SAKURA_PINK_PALETTES[WATER_LILY_STAGE_BLOOM] };
    }

    const palette = seed > 0.45
        ? REFINED_BUTTERCREAM_WHITE_PALETTES[stage]
        : REFINED_ALABASTER_WHITE_PALETTES[stage];
    return { isPink: false, palette: palette || REFINED_BUTTERCREAM_WHITE_PALETTES[WATER_LILY_STAGE_BLOOM] };
}

// ============================================================
// REFINED WATER LILY DRAWING ENGINE
// ============================================================

// A spoon-shaped Nymphaea petal: a narrow attachment, a generous middle body,
// then a long taper into a small rounded apex. The upper third stays narrow
// enough to feel elegant, but the apex has enough radius to avoid a quill-like
// hedgehog silhouette when many petals overlap.
function traceRefinedPetalOutline(ctx, length, width, sweep = 0) {
    const tipHalf = Math.max(0.30, width * 0.08);
    const baseHalf = Math.max(0.38, width * 0.15);
    const tipX = length * sweep;
    const mid = (t) => tipX * (t * t);

    ctx.moveTo(-baseHalf, 0);
    // The broadest shoulder lives near the middle rather than close to the
    // root, so the petal reads as a floating blade instead of a teardrop.
    ctx.bezierCurveTo(
        mid(0.20) - (width * 0.62), -length * 0.18,
        mid(0.48) - (width * 0.84), -length * 0.46,
        mid(0.70) - (width * 0.62), -length * 0.73,
    );
    ctx.bezierCurveTo(
        mid(0.84) - (width * 0.42), -length * 0.88,
        mid(0.96) - (width * 0.18), -length * 0.98,
        mid(1.00) - tipHalf, -length * 0.995,
    );
    // A very small rounded cap: neither a needle nor a blunt oval.
    ctx.quadraticCurveTo(
        mid(1.015), -length * 1.012,
        mid(1.00) + tipHalf, -length * 0.995,
    );
    ctx.bezierCurveTo(
        mid(0.96) + (width * 0.18), -length * 0.98,
        mid(0.84) + (width * 0.42), -length * 0.88,
        mid(0.70) + (width * 0.62), -length * 0.73,
    );
    ctx.bezierCurveTo(
        mid(0.48) + (width * 0.84), -length * 0.46,
        mid(0.20) + (width * 0.62), -length * 0.18,
        baseHalf, 0,
    );
    ctx.quadraticCurveTo(0, length * 0.02, -baseHalf, 0);
    ctx.closePath();
}

// A raised blade throws a soft shadow onto the flatter whorl beneath.
function drawPetalCastShadow(ctx, length, width, tilt, lightLocal, isPink, sweep = 0) {
    if (!lightLocal) return;
    const rise = Math.sin(clampNumber(tilt, 0, Math.PI * 0.5));
    if (rise < 0.38) return;
    const drop = length * (0.12 + (rise * 0.38));
    ctx.save();
    ctx.globalAlpha = clampNumber(0.08 + (rise * 0.16), 0, 0.24);
    ctx.filter = `blur(${Math.max(0.6, length * 0.05).toFixed(2)}px)`;
    ctx.translate(-lightLocal.x * drop, -lightLocal.y * drop);
    ctx.beginPath();
    traceRefinedPetalOutline(ctx, length * 1.02, width * 1.04, sweep);
    ctx.fillStyle = isPink ? '#6a2a44' : '#544634';
    ctx.fill();
    ctx.restore();
}

// Soft, luminous form lighting across the rosette without muddy dark washes.
function applyRosetteFormLight(ctx, organs, size, isPink) {
    if (!organs.length) return;
    const reach = size * 1.06;
    const lx = WATER_LILY_LIGHT_DIR.x;
    const ly = WATER_LILY_LIGHT_DIR.y;

    const buildUnionPath = () => {
        ctx.beginPath();
        for (let i = 0; i < organs.length; i += 1) {
            const organ = organs[i];
            ctx.save();
            ctx.rotate(organ.angle);
            ctx.translate(0, organ.baseShift);
            traceRefinedPetalOutline(ctx, organ.length, organ.width, organ.sweep);
            ctx.restore();
        }
    };

    ctx.save();

    // Very soft body shadow across the bloom away from the light
    const across = ctx.createLinearGradient(lx * reach, ly * reach, -lx * reach, -ly * reach);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.55, isPink ? 'rgba(120, 50, 75, 0.02)' : 'rgba(95, 80, 58, 0.02)');
    across.addColorStop(1, isPink ? 'rgba(110, 42, 68, 0.07)' : 'rgba(85, 70, 48, 0.06)');
    buildUnionPath();
    ctx.fillStyle = across;
    ctx.fill('nonzero');

    // Androecium boss soft warm depression shadow
    const bossX = -lx * size * 0.20;
    const bossY = -ly * size * 0.20;
    const boss = ctx.createRadialGradient(bossX, bossY, size * 0.04, bossX, bossY, size * 0.54);
    boss.addColorStop(0, isPink ? 'rgba(110, 40, 65, 0.08)' : 'rgba(90, 68, 40, 0.07)');
    boss.addColorStop(0.50, isPink ? 'rgba(110, 40, 65, 0.03)' : 'rgba(90, 68, 40, 0.02)');
    boss.addColorStop(1, 'rgba(0,0,0,0)');
    buildUnionPath();
    ctx.fillStyle = boss;
    ctx.fill('nonzero');

    // Sunlit shoulder on the near side
    ctx.globalCompositeOperation = 'screen';
    const lit = ctx.createLinearGradient(lx * reach, ly * reach, -lx * reach * 0.2, -ly * reach * 0.2);
    lit.addColorStop(0, 'rgba(255, 252, 242, 0.22)');
    lit.addColorStop(0.5, 'rgba(255, 250, 240, 0.06)');
    lit.addColorStop(1, 'rgba(255,255,255,0)');
    buildUnionPath();
    ctx.fillStyle = lit;
    ctx.fill('nonzero');

    ctx.restore();
}

// 3D Scoop Petal Renderer:
// Combines longitudinal translucency, transverse U-channel scoop trough,
// directional form light, and dual-edge rolled margin specular highlights.
function drawPetal(
    ctx,
    length,
    width,
    colors,
    opacity = 1,
    tipSoftness = 1,
    isPink = true,
    staminode = 0,
    lightLocal = null,
    tilt = 0,
    sweep = 0,
) {
    ctx.save();
    ctx.globalAlpha = opacity;

    const lateral = lightLocal ? clampNumber(lightLocal.x, -1, 1) : 0;
    const facing = lightLocal ? clampNumber(-lightLocal.y, -1, 1) : 0;

    // Staminode color blending
    const blendedBase = staminode > 0 ? lerpColorHex(colors.base, '#eddcb4', staminode * 0.16) : colors.base;
    const blendedMid = staminode > 0 ? lerpColorHex(colors.mid, '#f5dba0', staminode * 0.26) : colors.mid;
    const blendedTip = staminode > 0 ? lerpColorHex(colors.tip, '#f0ce80', staminode * 0.44) : colors.tip;
    const apexColor = isPink
        ? lerpColorHex(colors.tip, '#fff9fb', 0.70)
        : lerpColorHex(colors.tip, '#ffffff', 0.70);
    const rootGlow = colors.glow || (isPink ? '#ffe0b2' : '#ffd54f');

    // 1. Trace petal outline and CLIP interior for flawless organic rendering
    ctx.save();
    ctx.beginPath();
    traceRefinedPetalOutline(ctx, length, width, sweep);
    ctx.clip();

    // 2. Base longitudinal gradient (warm root glow -> base -> mid -> tip -> apex)
    const gradient = ctx.createLinearGradient(0, 4, 0, -length);
    gradient.addColorStop(0, lerpColorHex(blendedBase, rootGlow, 0.50));
    gradient.addColorStop(0.15, blendedBase);
    gradient.addColorStop(0.50, blendedMid);
    gradient.addColorStop(0.85, blendedTip);
    gradient.addColorStop(1, staminode > 0 ? lerpColorHex(apexColor, '#f4d288', staminode * 0.45) : apexColor);

    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Base receptacle ambient glow (warm golden translucency at petal attachment)
    const baseShade = ctx.createRadialGradient(
        0, -length * 0.05, 0,
        0, -length * 0.05, width * 1.5,
    );
    baseShade.addColorStop(0, isPink ? 'rgba(245, 140, 160, 0.26)' : 'rgba(240, 175, 45, 0.28)');
    baseShade.addColorStop(0.5, isPink ? 'rgba(245, 140, 160, 0.08)' : 'rgba(240, 175, 45, 0.08)');
    baseShade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = baseShade;
    ctx.fill();

    // 4. Standing whorl sky-exposure adjustment
    const skyFacing = Math.cos(clampNumber(tilt, 0, Math.PI * 0.5));
    if (skyFacing < 0.985) {
        ctx.fillStyle = isPink
            ? `rgba(90, 36, 60, ${((1 - skyFacing) * 0.14).toFixed(3)})`
            : `rgba(75, 60, 40, ${((1 - skyFacing) * 0.12).toFixed(3)})`;
        ctx.fill();
    }

    // 5. 3D Scoop Trough - Smooth parabolic U-channel
    // The concave central trough collects light while rolled margins catch subtle shade and specular
    const wReach = width * 1.0;
    const channel = ctx.createLinearGradient(-wReach, 0, wReach, 0);
    const edgeShade = isPink ? 'rgba(180, 85, 120, 0.18)' : 'rgba(160, 130, 85, 0.16)';
    channel.addColorStop(0, edgeShade);
    channel.addColorStop(0.20, 'rgba(255, 255, 255, 0.02)');
    channel.addColorStop(0.50, 'rgba(255, 255, 252, 0.22)');
    channel.addColorStop(0.80, 'rgba(255, 255, 255, 0.02)');
    channel.addColorStop(1, edgeShade);
    ctx.fillStyle = channel;
    ctx.fill();

    // 6. Directional across-blade form light (soft light & shadow on the scoop walls)
    if (lightLocal) {
        const litSign = lateral >= 0 ? 1 : -1;
        const cross = ctx.createLinearGradient(
            -wReach * litSign, 0,
            wReach * litSign, 0,
        );
        const highlight = 0.04 + (Math.abs(lateral) * 0.14);
        const depth = 0.03 + (Math.abs(lateral) * 0.12);
        cross.addColorStop(0, `rgba(255, 255, 250, ${highlight.toFixed(3)})`);
        cross.addColorStop(0.48, 'rgba(255, 255, 255, 0)');
        cross.addColorStop(
            1,
            isPink
                ? `rgba(135, 45, 80, ${depth.toFixed(3)})`
                : `rgba(115, 88, 55, ${depth.toFixed(3)})`,
        );
        ctx.fillStyle = cross;
        ctx.fill();

        if (facing < 0) {
            const away = Math.min(1, -facing);
            ctx.fillStyle = isPink
                ? `rgba(75, 25, 45, ${(away * 0.07).toFixed(3)})`
                : `rgba(60, 48, 32, ${(away * 0.06).toFixed(3)})`;
            ctx.fill();
        }
    }

    // 7. Refined Apex Glow (soft, inside tip)
    const tipGlowAlpha = 0.20 * (lightLocal ? clampNumber((facing * 0.6) + 0.4, 0, 1) : 0.7);
    ctx.globalCompositeOperation = 'screen';
    const tipGlow = ctx.createRadialGradient(
        0, -length * 0.88, 0,
        0, -length * 0.88, width * tipSoftness * 0.8,
    );
    tipGlow.addColorStop(0, `rgba(255, 255, 250, ${(tipGlowAlpha * 0.65).toFixed(3)})`);
    tipGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = tipGlow;
    ctx.beginPath();
    ctx.arc(0, -length * 0.88, width * tipSoftness * 0.8, 0, TAU);
    ctx.fill();

    // 8. Staminode Anther Crest
    if (staminode > 0.75) {
        const antherStrength = clampNumber((staminode - 0.75) / 0.25, 0, 1);
        ctx.globalAlpha = opacity * antherStrength * 0.9;
        const antherRx = Math.max(0.5, width * 0.28 * antherStrength);
        const antherRy = Math.max(0.7, length * 0.085 * antherStrength);
        const antherGrad = ctx.createLinearGradient(0, -length * 0.98, 0, -length * 0.74);
        antherGrad.addColorStop(0, '#ffe082');
        antherGrad.addColorStop(0.5, '#f5b026');
        antherGrad.addColorStop(1, '#d98205');
        ctx.fillStyle = antherGrad;
        ctx.beginPath();
        ctx.ellipse(0, -length * 0.88, antherRx, antherRy, 0, 0, TAU);
        ctx.fill();
    }

    ctx.restore(); // end clipping

    // 9. Soft, precise outline stroke
    ctx.beginPath();
    traceRefinedPetalOutline(ctx, length, width, sweep);
    ctx.strokeStyle = isPink ? 'rgba(220, 155, 180, 0.26)' : 'rgba(215, 200, 170, 0.26)';
    ctx.lineWidth = 0.55;
    ctx.stroke();

    // 10. Specular rim highlight along lit margin
    if (lightLocal) {
        const litEdgeAlpha = 0.28 * clampNumber(0.3 + (Math.abs(lateral) * 0.7), 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(255, 255, 250, ${litEdgeAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}

function drawInwardBlade(ctx, rimRadius, length, width, colors, isPink, lean, opacity = 1) {
    ctx.save();
    ctx.translate(0, -rimRadius);
    ctx.rotate(Math.PI + lean);
    drawPetal(ctx, length, width, colors, opacity, 0.8, isPink, 0);
    ctx.restore();
}

function drawSepal(ctx, length, width, isPink = true) {
    ctx.save();
    ctx.beginPath();
    const baseHalf = Math.max(0.4, width * 0.2);
    ctx.moveTo(-baseHalf, 2);
    ctx.bezierCurveTo(
        -width * 0.85, -length * 0.30,
        -width * 0.65, -length * 0.75,
        0, -length,
    );
    ctx.bezierCurveTo(
        width * 0.65, -length * 0.75,
        width * 0.85, -length * 0.30,
        baseHalf, 2,
    );
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 4, 0, -length);
    gradient.addColorStop(0, '#224019');
    gradient.addColorStop(0.35, '#3a5f27');
    gradient.addColorStop(0.72, '#5d8a45');
    gradient.addColorStop(1, isPink ? '#a5b58d' : '#9bb084');

    ctx.fillStyle = gradient;
    ctx.fill();

    const baseShade = ctx.createRadialGradient(
        0, -length * 0.05, 0,
        0, -length * 0.05, width * 1.5,
    );
    baseShade.addColorStop(0, 'rgba(8, 22, 6, 0.35)');
    baseShade.addColorStop(1, 'rgba(8, 22, 6, 0)');
    ctx.fillStyle = baseShade;
    ctx.fill();

    ctx.strokeStyle = 'rgba(155, 205, 135, 0.35)';
    ctx.lineWidth = 0.75;
    ctx.stroke();

    // Central sepal ridge
    ctx.strokeStyle = 'rgba(215, 245, 195, 0.28)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -length * 0.06);
    ctx.quadraticCurveTo(-width * 0.03, -length * 0.5, 0, -length * 0.92);
    ctx.stroke();

    ctx.restore();
}

function resolveRefinedOpenAmount(self, stage) {
    const explicit = Number(self?.flowerOpenAmount);
    if (Number.isFinite(explicit)) return clampNumber(explicit, 0, 1);
    return stage === WATER_LILY_STAGE_OPENING ? REFINED_OPENING_AMOUNT : 1;
}

function resolveRefinedTier(tier, size, openAmount) {
    const opening = smoothstep(0, 1, openAmount);
    return {
        count: tier.count,
        length: size * lerp(tier.closed.length, tier.open.length, opening),
        width: size * lerp(tier.closed.width, tier.open.width, opening),
        tilt: lerp(tier.closed.tilt, tier.open.tilt, opening),
        sweep: lerp(tier.closed.sweep, tier.open.sweep, opening),
        baseShift: size * lerp(tier.closed.baseShift, tier.open.baseShift, opening),
        tPetal: tier.tPetal,
        staminode: tier.staminode || 0,
    };
}

function drawRefinedWaterLily(self, ctx, size, isPinkInput = true, stage = WATER_LILY_STAGE_BLOOM) {
    if (!ctx || size <= 0) return;
    const isBud = stage === WATER_LILY_STAGE_BUD;
    const openAmount = isBud ? 0 : resolveRefinedOpenAmount(self, stage);
    const flowerPhase = Number(self?.flowerPhase) || 0;

    const variant = resolveWaterLilyVariant(self, stage, isPinkInput);
    const isPink = variant.isPink;
    const palettes = variant.palette;

    ctx.save();

    if (!self?.zenMaterialBake && ctx.zenGeometryMask !== true) {
    // Base contact drop shadow (soft, directional)
    ctx.save();
    const shadowX = -WATER_LILY_LIGHT_DIR.x * size * 0.09;
    const shadowY = (-WATER_LILY_LIGHT_DIR.y * size * 0.09) + (size * 0.06);
    const baseShadow = ctx.createRadialGradient(
        shadowX, shadowY, 0,
        shadowX, shadowY, size * 0.82,
    );
    baseShadow.addColorStop(0, 'rgba(0,16,12,0.18)');
    baseShadow.addColorStop(0.5, 'rgba(0,16,12,0.06)');
    baseShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baseShadow;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, size * 0.70, size * 0.46, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    }

    if (isBud) {
        // ==================== BUD STAGE ====================
        // A closed cup shares one apex and the existing stem socket. Its
        // petals carry the body; the calyx is a narrow rim, not a green disc.
        ctx.save();
        ctx.translate(0, size * 0.298);
        ctx.rotate(Math.sin(flowerPhase) * 0.24);

        const calyx = ctx.createLinearGradient(0, 0, 0, -size * 0.74);
        calyx.addColorStop(0, '#365b35');
        calyx.addColorStop(0.48, '#5f8150');
        calyx.addColorStop(1, '#90aa72');
        ctx.beginPath();
        traceRefinedPetalOutline(ctx, size * 0.74, size * 0.43, 0);
        ctx.fillStyle = calyx;
        ctx.fill();

        // The overlapping faces meet at the tip instead of radiating into
        // the star-shaped centre used by an open flower.
        for (let i = 0; i < 2; i++) {
            const offset = size * (i === 0 ? -0.035 : 0.035);
            const length = size * 0.72;
            ctx.save();
            ctx.translate(offset, 0);
            drawPetal(ctx, length, size * 0.30, palettes[i], 1, 0.8, isPink, 0, null, 0, -offset / length);
            ctx.restore();
        }
        drawPetal(ctx, size * 0.725, size * 0.18, palettes[2], 1, 0.8, isPink);

        // Two front sepals wrap only the lower shoulders of the folded cup.
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.rotate(i === 0 ? -0.48 : 0.48);
            drawSepal(ctx, size * 0.35, size * 0.11, isPink);
            ctx.restore();
        }
        ctx.restore();

        ctx.shadowColor = 'transparent';
        ctx.restore();
        return;
    }

    // ==================== OPENING & BLOOM STAGES ====================
    // 1. Calyx Sepals (4 base sepals)
    const sepalCount = 4;
    const sepalLen = size * lerp(0.72, 0.82, openAmount);
    const sepalWidth = size * lerp(0.15, 0.17, openAmount);
    const sepalShift = size * lerp(0.065, 0.09, openAmount);

    for (let i = 0; i < sepalCount; i++) {
        const baseAngle = (TAU / sepalCount) * i;
        const angleVariation = (pseudoRandom(13 + (i * 7) + (flowerPhase * 8)) - 0.5) * 0.04;
        ctx.save();
        ctx.rotate(baseAngle + angleVariation);
        ctx.translate(0, sepalShift);
        drawSepal(ctx, sepalLen, sepalWidth, isPink);
        ctx.restore();
    }

    // 2. Four interleaved whorls. The golden-angle fraction is a quiet overlap
    // rule, not a visible spiral generator. Broad middle bodies close the gaps
    // while the restrained counts preserve air between individual petals.
    const tiers = REFINED_WATER_LILY_TIERS.map((tier) => (
        resolveRefinedTier(tier, size, openAmount)
    ));

    const petalOrgans = [];
    let globalPetalIndex = 0;

    tiers.forEach((tier, tierIdx) => {
        const step = TAU / tier.count;
        const offsetAngle = (tierIdx * GOLDEN_ANGLE * 0.15) + (flowerPhase * 0.015);
        for (let i = 0; i < tier.count; i++) {
            const angleJitter = (pseudoRandom((globalPetalIndex * 17.3) + flowerPhase) - 0.5) * 0.032;
            const angle = (step * i) + offsetAngle + angleJitter;
            const lengthVar = 0.97 + (pseudoRandom((globalPetalIndex * 7.1) + 3) * 0.06);
            const widthVar = 0.975 + (pseudoRandom((globalPetalIndex * 5.3) + 9) * 0.05);
            const foreshorten = Math.cos(tier.tilt);

            // A barely perceptible colony irregularity, kept below the shape
            // signal so the rim stays painterly rather than visibly random.
            const rimLobe = 1 + (
                (Math.sin((angle * 3) + 0.9) * 0.018)
                + (Math.sin((angle * 2) - 2.1) * 0.012)
            ) * (1 - smoothstep(0, 3, tierIdx));

            petalOrgans.push({
                kind: 'petal',
                angle,
                tilt: tier.tilt,
                sweep: tier.sweep * (0.85 + (pseudoRandom((globalPetalIndex * 4.3) + 31) * 0.30)),
                length: tier.length * foreshorten * lengthVar * rimLobe,
                width: tier.width * widthVar,
                baseShift: tier.baseShift,
                colors: sampleGradientStops(palettes, tier.tPetal),
                opacity: lerp(0.96, 1.0, tier.tPetal),
                staminode: tier.staminode ? tier.staminode * (0.8 + (pseudoRandom(globalPetalIndex * 3.7) * 0.2)) : 0,
            });
            globalPetalIndex += 1;
        }
    });

    // 3. Render Petals & Cast Shadows within Bloom Disc
    let bloomReach = 0;
    for (let i = 0; i < petalOrgans.length; i += 1) {
        const organ = petalOrgans[i];
        bloomReach = Math.max(bloomReach, organ.length - organ.baseShift);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, bloomReach * 1.05, 0, TAU);
    ctx.clip();

    petalOrgans.forEach((organ) => {
        const cosA = Math.cos(organ.angle);
        const sinA = Math.sin(organ.angle);
        const lightLocal = {
            x: (WATER_LILY_LIGHT_DIR.x * cosA) + (WATER_LILY_LIGHT_DIR.y * sinA),
            y: (WATER_LILY_LIGHT_DIR.y * cosA) - (WATER_LILY_LIGHT_DIR.x * sinA),
        };
        ctx.save();
        ctx.rotate(organ.angle);
        ctx.translate(0, organ.baseShift);
        if (ctx.zenGeometryMask !== true) drawPetalCastShadow(
            ctx,
            organ.length,
            organ.width,
            organ.tilt,
            self?.zenMaterialBake ? { x: 0, y: 0 } : lightLocal,
            isPink,
            organ.sweep,
        );
        drawPetal(
            ctx,
            organ.length,
            organ.width,
            organ.colors,
            organ.opacity,
            0.9,
            isPink,
            organ.staminode,
            self?.zenMaterialBake ? null : lightLocal,
            organ.tilt,
            organ.sweep,
        );
        ctx.restore();
    });

    if (!self?.zenMaterialBake && ctx.zenGeometryMask !== true) applyRosetteFormLight(ctx, petalOrgans, size, isPink);
    ctx.restore();

    ctx.shadowColor = 'transparent';

    // 4. Golden Crown Androecium & Pistil Well
    ctx.save();
    const bossRadius = size * lerp(0.145, 0.195, openAmount);
    const crownReveal = smoothstep(0.18, 0.78, openAmount);
    const litX = WATER_LILY_LIGHT_DIR.x * bossRadius * 0.30;
    const litY = WATER_LILY_LIGHT_DIR.y * bossRadius * 0.30;

    // Ambient seat ring under the boss
    const seat = ctx.createRadialGradient(0, 0, bossRadius * 0.65, 0, 0, bossRadius * 1.20);
    seat.addColorStop(0, 'rgba(80, 40, 10, 0)');
    seat.addColorStop(0.65, 'rgba(80, 40, 10, 0.12)');
    seat.addColorStop(1, 'rgba(80, 40, 10, 0)');
    ctx.fillStyle = seat;
    ctx.beginPath();
    ctx.arc(0, 0, bossRadius * 1.20, 0, TAU);
    ctx.fill();

    // Radiant Golden Boss Cushion
    const boss = ctx.createRadialGradient(0, 0, bossRadius * 0.04, 0, 0, bossRadius);
    boss.addColorStop(0, 'rgba(196, 103, 20, 0.96)');
    boss.addColorStop(0.30, 'rgba(224, 137, 26, 0.95)');
    boss.addColorStop(0.60, 'rgba(247, 190, 54, 0.92)');
    boss.addColorStop(0.82, 'rgba(255, 219, 104, 0.66)');
    boss.addColorStop(0.95, 'rgba(255, 236, 159, 0.20)');
    boss.addColorStop(1, 'rgba(255, 245, 185, 0)');
    ctx.fillStyle = boss;
    ctx.beginPath();
    ctx.arc(0, 0, bossRadius, 0, TAU);
    ctx.fill();

    // Lit shoulder
    ctx.globalCompositeOperation = 'screen';
    const shoulder = ctx.createRadialGradient(
        litX, litY, 0,
        litX, litY, bossRadius * 0.85,
    );
    shoulder.addColorStop(0, 'rgba(255, 245, 195, 0.16)');
    shoulder.addColorStop(1, 'rgba(255, 245, 195, 0)');
    ctx.fillStyle = shoulder;
    ctx.beginPath();
    ctx.arc(litX, litY, bossRadius * 0.85, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 5. Restrained golden crown. Fewer stamens stop the center becoming a
    // glossy orange badge at the 20-40px sizes used by the pond and Furin.
    const rings = [
        { count: 18, radius: bossRadius * 0.78, width: size * 0.012, filColor: '#e79a20', antherColor: '#f9df8c' },
        { count: 12, radius: bossRadius * 0.51, width: size * 0.010, filColor: '#d77a18', antherColor: '#f3c854' },
        { count: 7, radius: bossRadius * 0.28, width: size * 0.008, filColor: '#b95e18', antherColor: '#eeb437' },
    ];

    rings.forEach((ring, rIdx) => {
        const step = TAU / ring.count;
        const offset = (rIdx * 0.45) + (flowerPhase * 0.02);
        for (let s = 0; s < ring.count; s++) {
            const sAngle = (step * s) + offset + ((pseudoRandom((s * 7.7) + (rIdx * 13.1) + flowerPhase) - 0.5) * 0.05);
            const sLen = ring.radius * (0.95 + (pseudoRandom((s * 3.3) + (rIdx * 5.1)) * 0.10));

            ctx.save();
            ctx.globalAlpha = 0.52 + (crownReveal * 0.38);
            ctx.rotate(sAngle);
            ctx.strokeStyle = ring.filColor;
            ctx.lineWidth = ring.width;
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.008);
            ctx.quadraticCurveTo(size * 0.008, -sLen * 0.50, 0, -sLen);
            ctx.stroke();

            // Cupped anther tip
            ctx.fillStyle = ring.antherColor;
            ctx.beginPath();
            ctx.ellipse(
                0, -sLen,
                Math.max(0.55, ring.width * 0.65),
                Math.max(0.75, ring.width * 0.95),
                0, 0, TAU,
            );
            ctx.fill();

            // A muted glint keeps the crown alive without reading as pixels.
            ctx.fillStyle = 'rgba(255, 252, 226, 0.54)';
            ctx.beginPath();
            ctx.arc(0, -sLen - 0.15, Math.max(0.20, ring.width * 0.24), 0, TAU);
            ctx.fill();

            ctx.restore();
        }
    });

    // 6. Deep Amber Pistil Core (Nectar Well)
    const coreRadius = size * lerp(0.040, 0.052, openAmount);
    const core = ctx.createRadialGradient(
        -size * 0.012, -size * 0.016, 1,
        0, 0, coreRadius,
    );
    core.addColorStop(0, '#ffe082');
    core.addColorStop(0.35, '#ff9800');
    core.addColorStop(0.75, '#e65100');
    core.addColorStop(1, '#bf360c');

    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, TAU);
    ctx.fill();

    const veilAlpha = 1 - smoothstep(0.38, 0.82, openAmount);
    if (veilAlpha > 0.01) {
        // The same inner organs remain cupped over the crown early in opening,
        // then recede continuously instead of cross-fading to another flower.
        const veilColors = isPink
            ? { base: '#f8bbd0', mid: '#fdecf2', tip: '#fff5f8', glow: '#ffe0b2' }
            : { base: '#ffe082', mid: '#fff8e7', tip: '#ffffff', glow: '#ffd54f' };
        const veilCount = 5;
        const veilStep = TAU / veilCount;
        for (let i = 0; i < veilCount; i++) {
            const jitter = (pseudoRandom((i * 19.7) + (flowerPhase * 3)) - 0.5) * 0.06;
            ctx.save();
            ctx.rotate((veilStep * i) + (GOLDEN_ANGLE * 0.12) + (flowerPhase * 0.025) + jitter);
            drawInwardBlade(
                ctx,
                size * 0.29,
                size * 0.31,
                size * 0.125,
                veilColors,
                isPink,
                0.20,
                0.86 * veilAlpha,
            );
            ctx.restore();
        }
    }

    ctx.restore();
}

// ============================================================
// SPRITE BUILDER & DISPATCHER
// ============================================================

const buildRefinedWaterLilySprite = (self, stage, size, isPink, openAmount) => {
    if (typeof document === 'undefined') return null;

    const spriteCanvas = document.createElement('canvas');
    const spriteSize = Math.ceil(Math.max(12, size) * 3.6);
    spriteCanvas.width = spriteSize;
    spriteCanvas.height = spriteSize;

    const spriteCtx = spriteCanvas.getContext('2d', { alpha: true });
    if (!spriteCtx) return null;

    spriteCtx.translate(spriteSize * 0.5, spriteSize * 0.5);
    drawRefinedWaterLily({
        zenMaterialBake: self?.zenMaterialBake === true,
        flowerColor: self?.flowerColor,
        flowerOpenAmount: openAmount,
        flowerPhase: self?.flowerPhase,
    }, spriteCtx, size, isPink, stage);
    return spriteCanvas;
};

const drawWaterLilyRefined = (self, ctx, size, renderScale = 1) => {
    const stage = normalizeWaterLilyStage(self?.flowerStage) || WATER_LILY_STAGE_BLOOM;
    if (ctx.zenGeometryMask === true) {
        drawRefinedWaterLily(self, ctx, size, self?.flowerColor !== 'white', stage);
        return;
    }
    const isPink = self?.flowerColor === 'pink' || self?.flowerColor !== 'white';
    const safeRenderScale = clampNumber(
        Number.isFinite(renderScale) ? renderScale : 1,
        0.82,
        1.2,
    );

    const sizeBucket = Math.round(Math.max(8, size) * 2) / 2;
    const phaseBucket = Math.round((self?.flowerPhase || 0) * 40) / 40;
    const openAmount = stage === WATER_LILY_STAGE_BUD
        ? null
        : resolveRefinedOpenAmount(self, stage);
    const openBucket = openAmount === null ? null : Math.round(openAmount * 20) / 20;
    const colorKey = typeof self?.flowerColor === 'string' ? self.flowerColor : (isPink ? 'pink' : 'white');
    const spriteKey = `refined_v6|${self?.zenMaterialBake === true ? 'material' : 'painted'}|${stage}|${colorKey}|${sizeBucket}|${phaseBucket}|${openBucket ?? 'bud'}`;

    if (self && self._waterLilySpriteKey !== spriteKey) {
        self._waterLilySpriteCanvas = buildRefinedWaterLilySprite(
            self,
            stage,
            sizeBucket,
            isPink,
            openBucket,
        );
        self._waterLilySpriteKey = spriteKey;
    }

    if (self && self._waterLilySpriteCanvas) {
        const sprite = self._waterLilySpriteCanvas;
        ctx.save();
        if (Math.abs(safeRenderScale - 1) > 0.0001) {
            ctx.scale(safeRenderScale, safeRenderScale);
        }
        ctx.drawImage(sprite, -sprite.width * 0.5, -sprite.height * 0.5);
        ctx.restore();
        return;
    }

    ctx.save();
    if (Math.abs(safeRenderScale - 1) > 0.0001) {
        ctx.scale(safeRenderScale, safeRenderScale);
    }
    drawRefinedWaterLily(self, ctx, size, isPink, stage);
    ctx.restore();
};

// ============================================================
// CLASSIC WATER LILY (PRESERVED VERSION)
// ============================================================

const WATER_LILY_ROLE_DYNAMICS = {
    [LAYER_ROLE_OUTER]: {
        jitterBase: 0.018,
        jitterRotationGain: 0.04,
        jitterDepthGain: 0.003,
        minGapBase: 0.88,
        minGapRotationPenalty: 0.03,
        minGapDepthPenalty: 0.004,
        spacingBase: 0.14,
        spacingDepthGain: 0.02,
        asymmetryBase: 0.005,
        asymmetryDepthGain: 0.006,
    },
    [LAYER_ROLE_MIDDLE]: {
        jitterBase: 0.04,
        jitterRotationGain: 0.07,
        jitterDepthGain: 0.006,
        minGapBase: 0.82,
        minGapRotationPenalty: 0.05,
        minGapDepthPenalty: 0.006,
        spacingBase: 0.26,
        spacingDepthGain: 0.03,
        asymmetryBase: 0.02,
        asymmetryDepthGain: 0.015,
    },
    [LAYER_ROLE_INNER]: {
        jitterBase: 0.06,
        jitterRotationGain: 0.09,
        jitterDepthGain: 0.01,
        minGapBase: 0.75,
        minGapRotationPenalty: 0.06,
        minGapDepthPenalty: 0.008,
        spacingBase: 0.34,
        spacingDepthGain: 0.03,
        asymmetryBase: 0.06,
        asymmetryDepthGain: 0.03,
    },
};

const WATER_LILY_STAGE_PROFILES = {
    [WATER_LILY_STAGE_BUD]: {
        sepalCount: 5,
        layerOptions: {
            shadowAlpha: 0.16,
            shadowScaleX: 0.4,
            shadowScaleY: 0.24,
            shadowOffsetY: 0.05,
            rotationJitter: 0.11,
            outlineAlphaPink: 0.12,
            outlineAlphaWhite: 0.12,
            petalWidthFloor: 1,
            petalLengthFloor: 0.94,
            veinPasses: 0,
            gapScaleMin: 0.9,
            gapScaleMax: 1.08,
        },
        layers: [
            {
                role: LAYER_ROLE_OUTER,
                count: 3,
                baseOffset: 0.024,
                length: 0.58,
                width: 0.38,
                lift: 0.9,
                tipSharp: 1.06,
                alpha: 0.98,
                shoulder: 0.37,
                tipWidthRatio: 0.19,
                jitterStrength: 0.018,
                minGapRatio: 0.91,
                spacingImpact: 0.08,
                asymmetry: 0.005,
            },
            {
                role: LAYER_ROLE_MIDDLE,
                count: 4,
                baseOffset: 0.018,
                length: 0.5,
                width: 0.33,
                lift: 0.95,
                tipSharp: 1.1,
                alpha: 0.99,
                shoulder: 0.34,
                tipWidthRatio: 0.17,
                jitterStrength: 0.024,
                minGapRatio: 0.92,
                spacingImpact: 0.09,
                asymmetry: 0.008,
            },
            {
                role: LAYER_ROLE_INNER,
                count: 3,
                baseOffset: 0.014,
                length: 0.42,
                width: 0.26,
                lift: 0.98,
                tipSharp: 1.14,
                alpha: 1,
                shoulder: 0.31,
                tipWidthRatio: 0.14,
                jitterStrength: 0.028,
                minGapRatio: 0.93,
                spacingImpact: 0.1,
                asymmetry: 0.012,
            },
        ],
        stamen: {
            sizeScale: 0,
            count: 0,
        },
        core: {
            enabled: false,
            radiusScale: 0,
            seedCount: 0,
            seedRingScale: 0,
            seedSizeScale: 0,
        },
    },
    [WATER_LILY_STAGE_OPENING]: {
        sepalCount: 0,
        layerOptions: {
            shadowAlpha: 0.16,
            shadowScaleX: 0.62,
            shadowScaleY: 0.36,
            shadowOffsetY: 0.072,
            rotationJitter: 0.28,
            outlineAlphaPink: 0.15,
            outlineAlphaWhite: 0.15,
            petalWidthFloor: 0.9,
            petalLengthFloor: 0.8,
            veinPasses: 1,
            gapScaleMin: 0.85,
            gapScaleMax: 1.16,
        },
        layers: [
            {
                role: LAYER_ROLE_OUTER,
                count: 5,
                baseOffset: 0.118,
                length: 1.0,
                width: 0.68,
                lift: 0.14,
                tipSharp: 0.8,
                alpha: 0.92,
                shoulder: 0.44,
                tipWidthRatio: 0.21,
                jitterStrength: 0.045,
                minGapRatio: 0.84,
                spacingImpact: 0.2,
                asymmetry: 0.02,
            },
            {
                role: LAYER_ROLE_MIDDLE,
                count: 7,
                baseOffset: 0.1,
                length: 0.9,
                width: 0.58,
                lift: 0.28,
                tipSharp: 0.88,
                alpha: 0.95,
                shoulder: 0.42,
                tipWidthRatio: 0.2,
                jitterStrength: 0.065,
                minGapRatio: 0.8,
                spacingImpact: 0.28,
                asymmetry: 0.03,
            },
            {
                role: LAYER_ROLE_MIDDLE,
                count: 6,
                baseOffset: 0.082,
                length: 0.8,
                width: 0.5,
                lift: 0.43,
                tipSharp: 0.95,
                alpha: 0.97,
                shoulder: 0.4,
                tipWidthRatio: 0.19,
                jitterStrength: 0.062,
                minGapRatio: 0.81,
                spacingImpact: 0.27,
                asymmetry: 0.035,
            },
            {
                role: LAYER_ROLE_INNER,
                count: 5,
                baseOffset: 0.064,
                length: 0.69,
                width: 0.41,
                lift: 0.6,
                tipSharp: 1.02,
                alpha: 0.99,
                shoulder: 0.38,
                tipWidthRatio: 0.17,
                jitterStrength: 0.068,
                minGapRatio: 0.78,
                spacingImpact: 0.32,
                asymmetry: 0.07,
            },
            {
                role: LAYER_ROLE_INNER,
                count: 4,
                baseOffset: 0.048,
                length: 0.57,
                width: 0.32,
                lift: 0.76,
                tipSharp: 1.08,
                alpha: 1,
                shoulder: 0.35,
                tipWidthRatio: 0.16,
                jitterStrength: 0.074,
                minGapRatio: 0.75,
                spacingImpact: 0.36,
                asymmetry: 0.1,
            },
        ],
        stamen: {
            sizeScale: 1,
            count: 18,
        },
        core: {
            radiusScale: 0.24,
            seedCount: 6,
            seedRingScale: 0.4,
            seedSizeScale: 0.04,
        },
    },
    [WATER_LILY_STAGE_BLOOM]: {
        sepalCount: 0,
        layerOptions: {
            shadowAlpha: 0.15,
            shadowScaleX: 0.72,
            shadowScaleY: 0.45,
            shadowOffsetY: 0.082,
            rotationJitter: 0.3,
            outlineAlphaPink: 0.16,
            outlineAlphaWhite: 0.15,
            petalWidthFloor: 0.88,
            petalLengthFloor: 0.78,
            veinPasses: 1,
            gapScaleMin: 0.85,
            gapScaleMax: 1.16,
        },
        layers: [
            {
                role: LAYER_ROLE_OUTER,
                count: 5,
                baseOffset: 0.145,
                length: 1.12,
                width: 0.72,
                lift: 0.1,
                tipSharp: 0.78,
                alpha: 0.9,
                shoulder: 0.45,
                tipWidthRatio: 0.21,
                jitterStrength: 0.05,
                minGapRatio: 0.83,
                spacingImpact: 0.22,
                asymmetry: 0.02,
            },
            {
                role: LAYER_ROLE_MIDDLE,
                count: 8,
                baseOffset: 0.122,
                length: 0.98,
                width: 0.61,
                lift: 0.24,
                tipSharp: 0.86,
                alpha: 0.93,
                shoulder: 0.43,
                tipWidthRatio: 0.2,
                jitterStrength: 0.07,
                minGapRatio: 0.79,
                spacingImpact: 0.29,
                asymmetry: 0.035,
            },
            {
                role: LAYER_ROLE_MIDDLE,
                count: 7,
                baseOffset: 0.098,
                length: 0.86,
                width: 0.52,
                lift: 0.4,
                tipSharp: 0.94,
                alpha: 0.96,
                shoulder: 0.4,
                tipWidthRatio: 0.18,
                jitterStrength: 0.068,
                minGapRatio: 0.8,
                spacingImpact: 0.28,
                asymmetry: 0.04,
            },
            {
                role: LAYER_ROLE_INNER,
                count: 6,
                baseOffset: 0.076,
                length: 0.73,
                width: 0.43,
                lift: 0.58,
                tipSharp: 1.02,
                alpha: 0.98,
                shoulder: 0.38,
                tipWidthRatio: 0.17,
                jitterStrength: 0.074,
                minGapRatio: 0.77,
                spacingImpact: 0.34,
                asymmetry: 0.08,
            },
            {
                role: LAYER_ROLE_INNER,
                count: 5,
                baseOffset: 0.056,
                length: 0.61,
                width: 0.34,
                lift: 0.74,
                tipSharp: 1.1,
                alpha: 1,
                shoulder: 0.35,
                tipWidthRatio: 0.16,
                jitterStrength: 0.08,
                minGapRatio: 0.74,
                spacingImpact: 0.38,
                asymmetry: 0.12,
            },
        ],
        stamen: {
            sizeScale: 1,
            count: 20,
        },
        core: {
            radiusScale: 0.27,
            seedCount: 8,
            seedRingScale: 0.45,
            seedSizeScale: 0.048,
        },
    },
};

const drawClassicWaterLilySepals = (self, ctx, size, count = 5) => {
    const safeCount = Math.max(3, Math.floor(count));
    for (let i = 0; i < safeCount; i += 1) {
        const angle = (i / safeCount) * TAU + ((self.flowerPhase || 0) * 0.18);
        const base = size * 0.012;
        const length = size * 0.25;
        const halfWidth = size * 0.068;
        const tip = base + length;

        ctx.save();
        ctx.rotate(angle);

        const gradient = ctx.createLinearGradient(base, 0, tip, 0);
        gradient.addColorStop(0, '#6A8F51');
        gradient.addColorStop(0.7, '#5D7F44');
        gradient.addColorStop(1, '#4A6D35');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.86;

        ctx.beginPath();
        ctx.moveTo(base, 0);
        ctx.bezierCurveTo(base + (length * 0.2), -halfWidth, base + (length * 0.86), -halfWidth * 0.16, tip, 0);
        ctx.bezierCurveTo(base + (length * 0.86), halfWidth * 0.16, base + (length * 0.2), halfWidth, base, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
};

const drawClassicWaterLilyBud = (self, ctx, size, isPink) => {
    if (!Number.isFinite(size) || size <= 0) return;
    if (!ctx || typeof ctx.beginPath !== 'function') return;

    const phase = self.flowerPhase || 0;
    const sway = Math.sin(phase * 1.27) * 0.024;
    const microWave = (index, offset = 0) => (
        (Math.sin((index * 1.71) + (phase * 2.3) + offset) * 0.62)
        + (Math.sin((index * 2.93) - (phase * 1.57) - (offset * 0.7)) * 0.38)
    );
    const palette = isPink
        ? { tip: '#FFF8FC', mid: '#F7CCE0', base: '#DD9BBC', seam: 'rgba(170, 92, 130, 0.28)' }
        : { tip: '#FFFFFF', mid: '#F4EFE7', base: '#DCCFBA', seam: 'rgba(136, 120, 96, 0.28)' };
    const calyxPalette = { hi: '#90B36F', mid: '#6D9050', low: '#4A6A37' };

    ctx.save();
    ctx.rotate(sway);

    ctx.fillStyle = 'rgba(16, 10, 11, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.11, size * 0.37, size * 0.23, 0, 0, TAU);
    ctx.fill();

    const cupRx = size * 0.32;
    const cupRy = size * 0.255;
    const cupGrad = ctx.createRadialGradient(
        -cupRx * 0.2,
        -cupRy * 0.28,
        cupRx * 0.08,
        0,
        0,
        cupRx * 1.05,
    );
    cupGrad.addColorStop(0, calyxPalette.hi);
    cupGrad.addColorStop(0.58, calyxPalette.mid);
    cupGrad.addColorStop(1, calyxPalette.low);
    ctx.fillStyle = cupGrad;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.03, cupRx, cupRy, 0, 0, TAU);
    ctx.fill();

    const sepalCount = 5;
    for (let i = 0; i < sepalCount; i += 1) {
        const angle = (i / sepalCount) * TAU + (phase * 0.11);
        const baseR = size * 0.2;
        const sepalWave = microWave(i, 0.4);
        const tipR = size * (0.445 + (sepalWave * 0.015));
        const halfW = size * (0.058 + (Math.abs(sepalWave) * 0.006));
        const depthAlpha = 0.62 + (Math.sin(angle - (Math.PI * 0.5)) * 0.18);

        ctx.save();
        ctx.rotate(angle);
        ctx.globalAlpha = Math.max(0.46, depthAlpha);
        const leafGrad = ctx.createLinearGradient(baseR, 0, tipR, 0);
        leafGrad.addColorStop(0, '#789A59');
        leafGrad.addColorStop(1, '#4C6C39');
        ctx.fillStyle = leafGrad;

        ctx.beginPath();
        ctx.moveTo(baseR, -halfW);
        ctx.bezierCurveTo(baseR + (size * 0.12), -halfW * 1.2, tipR - (size * 0.05), -halfW * 0.4, tipR, 0);
        ctx.bezierCurveTo(tipR - (size * 0.05), halfW * 0.4, baseR + (size * 0.12), halfW * 1.2, baseR, halfW);
        ctx.quadraticCurveTo(baseR - (size * 0.05), 0, baseR, -halfW);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(210, 232, 192, 0.18)';
        ctx.lineWidth = Math.max(0.38, size * 0.009);
        ctx.beginPath();
        ctx.moveTo(baseR + (size * 0.03), 0);
        ctx.quadraticCurveTo((baseR + tipR) * 0.56, 0, tipR - (size * 0.025), 0);
        ctx.stroke();
        ctx.restore();
    }

    const petalCount = 5;
    for (let i = petalCount - 1; i >= 0; i -= 1) {
        const petalWave = microWave(i + 11, -0.2);
        const angle = (i / petalCount) * TAU + (phase * 0.06) + (petalWave * 0.01);
        const baseR = size * (0.266 + (petalWave * 0.008));
        const tipR = size * (0.061 + (Math.abs(petalWave) * 0.004));
        const halfW = size * (0.116 + ((i % 2) * 0.011) + (Math.abs(petalWave) * 0.005));
        const depth = 0.72 + (Math.sin(angle - (Math.PI * 0.5)) * 0.16);

        ctx.save();
        ctx.rotate(angle + (Math.sin((phase * 0.23) + i) * 0.016));
        ctx.globalAlpha = Math.max(0.62, depth);

        const grad = ctx.createLinearGradient(tipR, 0, baseR, 0);
        grad.addColorStop(0, palette.tip);
        grad.addColorStop(0.56, palette.mid);
        grad.addColorStop(1, palette.base);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.moveTo(baseR, -halfW * 0.62);
        ctx.bezierCurveTo(
            baseR - (size * 0.08), -halfW,
            tipR + (size * 0.04), -halfW * 0.42,
            tipR,
            0,
        );
        ctx.bezierCurveTo(
            tipR + (size * 0.04), halfW * 0.42,
            baseR - (size * 0.08), halfW,
            baseR,
            halfW * 0.62,
        );
        ctx.quadraticCurveTo(baseR + (size * 0.045), 0, baseR, -halfW * 0.62);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = palette.seam;
        ctx.lineWidth = Math.max(0.45, size * 0.01);
        ctx.beginPath();
        ctx.moveTo(baseR - (size * 0.02), 0);
        ctx.quadraticCurveTo((baseR + tipR) * 0.5, 0, tipR + (size * 0.012), 0);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = Math.max(0.34, size * 0.008);
        ctx.beginPath();
        ctx.moveTo(baseR - (size * 0.03), halfW * 0.24);
        ctx.quadraticCurveTo(baseR * 0.52, halfW * 0.18, tipR + (size * 0.016), 0);
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = 'rgba(74, 105, 54, 0.92)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.3, size * 0.19, size * 0.085, 0, 0, TAU);
    ctx.fill();

    const knotGrad = ctx.createRadialGradient(0, -size * 0.07, 0, 0, -size * 0.07, size * 0.11);
    knotGrad.addColorStop(0, 'rgba(255,255,255,0.32)');
    knotGrad.addColorStop(0.45, 'rgba(247,224,231,0.46)');
    knotGrad.addColorStop(1, 'rgba(210,166,188,0.24)');
    ctx.fillStyle = knotGrad;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.07, size * 0.11, size * 0.082, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
};

const drawClassicWaterLilyLayerSet = (self, ctx, size, layerSpecs, petalPalette, isPink, options = {}) => {
    const shadowAlpha = options.shadowAlpha ?? 0.14;
    const shadowScaleX = options.shadowScaleX ?? 0.58;
    const shadowScaleY = options.shadowScaleY ?? 0.36;
    const shadowOffsetY = options.shadowOffsetY ?? 0.08;
    const rotationJitter = options.rotationJitter ?? 0.43;
    const outlineAlphaPink = options.outlineAlphaPink ?? 0.16;
    const outlineAlphaWhite = options.outlineAlphaWhite ?? 0.1;
    const petalWidthFloor = options.petalWidthFloor ?? 0.9;
    const petalLengthFloor = options.petalLengthFloor ?? 0.78;
    const gapScaleMin = options.gapScaleMin ?? 0.84;
    const gapScaleMax = options.gapScaleMax ?? 1.16;
    const veinPasses = Math.max(0, Math.floor(options.veinPasses ?? 1));

    ctx.save();
    ctx.fillStyle = `rgba(18, 8, 10, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, size * shadowOffsetY, size * shadowScaleX, size * shadowScaleY, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (let layerIndex = 0; layerIndex < layerSpecs.length; layerIndex += 1) {
        const layer = layerSpecs[layerIndex];
        const palette = petalPalette[Math.min(layerIndex, petalPalette.length - 1)];
        const built = buildLayerPetals(layer, layerIndex, self.flowerPhase || 0, rotationJitter);
        const petals = built.petals;
        const layerStep = TAU / Math.max(1, petals.length);
        const spacingImpact = clampNumber(
            Number.isFinite(layer?.spacingImpact) ? layer.spacingImpact : built.spacingImpact,
            0,
            1,
        );

        for (let i = 0; i < petals.length; i += 1) {
            const petal = petals[i];
            const prev = petals[(i - 1 + petals.length) % petals.length];
            const next = petals[(i + 1) % petals.length];
            const prevGap = circularGap(prev.angle, petal.angle);
            const nextGap = circularGap(petal.angle, next.angle);
            const localGap = Math.min(prevGap, nextGap);
            const localGapScale = clampNumber(localGap / Math.max(0.0001, layerStep), gapScaleMin, gapScaleMax);
            const gapScale = 1 + ((localGapScale - 1) * spacingImpact);

            const safeLift = Math.max(0, Math.min(1, Number(layer.lift) || 0));
            const liftFactor = Math.cos(safeLift * Math.PI * 0.5);
            const widthDistortion = petalWidthFloor + ((1 - petalWidthFloor) * liftFactor);
            const lengthDistortion = petalLengthFloor + ((1 - petalLengthFloor) * liftFactor);

            const halfWidth = (layer.width / 2) * widthDistortion * gapScale;
            const petalLength = layer.length * lengthDistortion * (1 + ((gapScale - 1) * 0.24));

            const base = layer.baseOffset;
            const tip = base + petalLength;
            const sideBulge = Number.isFinite(layer.shoulder)
                ? layer.shoulder
                : (0.42 + ((1 - safeLift) * 0.06));
            const tipControl = 0.66 + ((Number(layer.tipSharp) || 0.9) * 0.1);
            const tipWidth = Math.max(
                size * 0.012,
                halfWidth * (Number.isFinite(layer.tipWidthRatio) ? layer.tipWidthRatio : 0.16),
            );

            ctx.save();
            ctx.rotate(petal.angle);
            ctx.globalAlpha = clampNumber(Number(layer.alpha) || 1, 0, 1);

            const gradient = ctx.createLinearGradient(base, 0, tip, 0);
            gradient.addColorStop(0, palette.base);
            gradient.addColorStop(0.5, palette.mid);
            gradient.addColorStop(0.9, palette.tip);
            gradient.addColorStop(1, isPink ? '#D88AAD' : '#E6DCC3');
            ctx.fillStyle = gradient;

            ctx.beginPath();
            const baseHalf = halfWidth * 0.56;
            ctx.moveTo(base, -baseHalf);
            ctx.bezierCurveTo(
                base + (petalLength * sideBulge), -halfWidth,
                base + (petalLength * tipControl), -halfWidth * 0.78,
                tip - (tipWidth * 0.7), -tipWidth,
            );
            ctx.quadraticCurveTo(tip + (petalLength * 0.05), 0, tip - (tipWidth * 0.7), tipWidth);
            ctx.bezierCurveTo(
                base + (petalLength * tipControl), halfWidth * 0.78,
                base + (petalLength * sideBulge), halfWidth,
                base,
                baseHalf,
            );
            ctx.quadraticCurveTo(base - (petalLength * 0.08), 0, base, -baseHalf);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }
};

const drawClassicWaterLilyStamens = (ctx, size, count) => {
    ctx.save();
    const rawCount = Number(count);
    const requestedCount = Number.isFinite(rawCount) ? Math.floor(rawCount) : 18;
    if (requestedCount <= 0) {
        ctx.restore();
        return;
    }
    const safeCount = Math.max(3, requestedCount);
    const baseOffset = size * 0.2;
    const maxLength = size * 0.35;

    for (let i = 0; i < safeCount; i += 1) {
        const angle = (i / safeCount) * TAU + (Math.sin(i * 10) * 0.2);
        const lengthWave = (Math.sin((i * 1.73) + 0.8) * 0.5)
            + (Math.sin((i * 0.93) + 1.2) * 0.5);
        const length = baseOffset + (maxLength - baseOffset) * clampNumber(0.72 + (lengthWave * 0.16), 0.56, 1);

        ctx.save();
        ctx.rotate(angle);

        const grad = ctx.createLinearGradient(baseOffset, 0, length, 0);
        grad.addColorStop(0, '#FFD54F');
        grad.addColorStop(1, '#FF8F00');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(baseOffset, 0);
        ctx.quadraticCurveTo(baseOffset + ((length - baseOffset) * 0.5), length * 0.1, length, 0);
        ctx.stroke();

        ctx.fillStyle = '#FFE082';
        ctx.beginPath();
        ctx.ellipse(length, 0, size * 0.02, size * 0.012, 0, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    ctx.restore();
};

const drawClassicWaterLilyCore = (self, ctx, size, options = {}) => {
    if (options.enabled === false) return;
    const rawRadiusScale = Number(options.radiusScale);
    const radiusScale = Number.isFinite(rawRadiusScale) ? rawRadiusScale : 0.2;
    if (radiusScale <= 0) return;
    const coreRadius = size * radiusScale;
    if (coreRadius <= 0.5) return;

    ctx.save();
    const coreGradient = ctx.createRadialGradient(
        -coreRadius * 0.22,
        -coreRadius * 0.2,
        coreRadius * 0.05,
        0,
        0,
        coreRadius,
    );
    coreGradient.addColorStop(0, '#FFF59D');
    coreGradient.addColorStop(0.3, '#FDD835');
    coreGradient.addColorStop(0.8, '#F57F17');
    coreGradient.addColorStop(1, '#E65100');

    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, coreRadius, coreRadius * 0.95, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
};

const scaleClassicStageLayerSpecs = (size, stageProfile) => stageProfile.layers.map((layer) => ({
    ...layer,
    baseOffset: size * layer.baseOffset,
    length: size * layer.length,
    width: size * layer.width,
}));

const renderClassicWaterLilyByProfile = (stage, self, ctx, size, petalPalette, isPink) => {
    if (stage === WATER_LILY_STAGE_BUD) {
        drawClassicWaterLilyBud(self, ctx, size, isPink);
        return;
    }

    const profile = WATER_LILY_STAGE_PROFILES[stage] || WATER_LILY_STAGE_PROFILES[WATER_LILY_STAGE_BLOOM];
    if ((profile.sepalCount || 0) > 0) {
        drawClassicWaterLilySepals(self, ctx, size, profile.sepalCount);
    }

    const layerSpecs = scaleClassicStageLayerSpecs(size, profile);
    drawClassicWaterLilyLayerSet(self, ctx, size, layerSpecs, petalPalette, isPink, profile.layerOptions || {});

    const stamenSizeScale = profile.stamen?.sizeScale ?? 1;
    const stamenCount = profile.stamen?.count ?? 18;
    drawClassicWaterLilyStamens(ctx, size * stamenSizeScale, stamenCount);

    drawClassicWaterLilyCore(self, ctx, size, profile.core || {});
};

const drawWaterLilyClassic = (self, ctx, size, renderScale = 1) => {
    const stage = normalizeWaterLilyStage(self.flowerStage) || WATER_LILY_STAGE_BLOOM;
    const isPink = self.flowerColor === 'pink';
    const safeRenderScale = clampNumber(
        Number.isFinite(renderScale) ? renderScale : 1,
        0.82,
        1.2,
    );

    const petalPalette = isPink
        ? [
            { base: '#FFEAF2', mid: '#F8CADB', tip: '#E7AFC5' },
            { base: '#FFF0F6', mid: '#F3BED4', tip: '#DC97B6' },
            { base: '#FFF7FB', mid: '#F8DFEA', tip: '#EEC8D9' },
        ]
        : [
            { base: '#FFFFFF', mid: '#F4F0E8', tip: '#D9CEBC' },
            { base: '#FFFDF8', mid: '#F1EBDF', tip: '#D3C8B5' },
            { base: '#FFFEFA', mid: '#F7F2E8', tip: '#DDD1BC' },
        ];

    ctx.save();
    if (Math.abs(safeRenderScale - 1) > 0.0001) {
        ctx.scale(safeRenderScale, safeRenderScale);
    }
    renderClassicWaterLilyByProfile(stage, self, ctx, size, petalPalette, isPink);
    ctx.restore();
};

// ============================================================
// PUBLIC EXPORTS
// ============================================================

// Default active water lily is the refined renderer
const drawWaterLily = drawWaterLilyRefined;

export {
    WATER_LILY_STAGE_BUD,
    WATER_LILY_STAGE_OPENING,
    WATER_LILY_STAGE_BLOOM,
    WATER_LILY_STAGE_PROFILES,
    normalizeWaterLilyStage,
    pickWaterLilyStage,
    drawPetal,
    drawWaterLily,
    drawWaterLilyRefined,
    drawWaterLilyClassic,
};
