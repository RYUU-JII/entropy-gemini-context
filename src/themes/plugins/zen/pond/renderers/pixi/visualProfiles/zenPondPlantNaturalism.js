const TAU = Math.PI * 2;

export const ZEN_POND_PLANT_NATURALISM_MODES = Object.freeze({
    MORPHOLOGY: 'morphology',
    MATERIAL: 'material',
    COMPOSITE: 'composite',
});

const PLANT_NATURALISM_MODE_SET = new Set(
    Object.values(ZEN_POND_PLANT_NATURALISM_MODES),
);

const fail = (detail) => {
    throw new Error(`ZEN_POND_PLANT_NATURALISM_INVALID:${detail}`);
};

const clamp = (value, min, max) => (
    Math.max(min, Math.min(max, Number(value)))
);

const requireFinite = (value, label) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        fail(`${label}_finite`);
    }
    return numeric;
};

const finiteOr = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const signatureNumber = (value, scale, label) => (
    Math.round(requireFinite(value, label) * scale)
);

const fract = (value) => value - Math.floor(value);

const deterministicUnit = (seed, channel) => (
    fract(
        Math.sin(
            (requireFinite(seed, 'seed') * 12.9898)
            + (requireFinite(channel, 'channel') * 78.233)
            + 37.719,
        ) * 43758.5453123,
    )
);

const wrapAngle = (angle) => {
    const wrapped = requireFinite(angle, 'angle') % TAU;
    return wrapped < 0 ? wrapped + TAU : wrapped;
};

const circularDistance = (a, b) => {
    const delta = Math.abs(wrapAngle(a) - wrapAngle(b));
    return Math.min(delta, TAU - delta);
};

const requireMode = (mode) => {
    if (!PLANT_NATURALISM_MODE_SET.has(mode)) {
        fail(`mode:${String(mode)}`);
    }
    return mode;
};

const requireEntity = (entity, label) => {
    if (!entity || typeof entity !== 'object') {
        fail(`${label}_entity`);
    }
    if (typeof entity.draw !== 'function') {
        fail(`${label}_draw_contract`);
    }
    return entity;
};

const requireFactory = (factory, label) => {
    if (typeof factory !== 'function') {
        fail(`${label}_factory`);
    }
    return factory;
};

const requireFallbackTexture = (fallbackTexture, label) => {
    if (!fallbackTexture || typeof fallbackTexture !== 'object') {
        fail(`${label}_fallback_texture_contract`);
    }
    return fallbackTexture;
};

const requireTextureResult = ({
    result,
    fallbackTexture,
    label,
}) => {
    if (
        !result
        || typeof result !== 'object'
        || !result.texture
    ) {
        fail(`${label}_texture_result_contract`);
    }
    if (result.texture === fallbackTexture) {
        fail(`${label}_texture_fallback`);
    }
    return result;
};

const resolveSignaturePhaseBucket = (value) => (
    Math.round((wrapAngle(value) / TAU) * 12) % 12
);

const resolvePadSize = (lilyPad) => (
    Math.max(
        12,
        signatureNumber(lilyPad?.size, 100, 'lily_pad_size') / 100,
    )
);

const resolveSeed = (lilyPad) => (
    signatureNumber(
        lilyPad?.edgeRippleSeed,
        1000,
        'lily_pad_edge_ripple_seed',
    ) * 0.001731
    + signatureNumber(
        lilyPad?.notchAngle,
        1000,
        'lily_pad_notch_angle',
    ) * 0.000917
    + signatureNumber(
        lilyPad?.size,
        100,
        'lily_pad_size',
    ) * 0.00071
    + signatureNumber(
        lilyPad?.rimLiftBias,
        1000,
        'lily_pad_rim_lift_bias',
    ) * 0.002113
    + signatureNumber(
        lilyPad?.edgeLobeA,
        1000,
        'lily_pad_edge_lobe_a',
    ) * 0.000347
);

const PAD_PALETTES = Object.freeze([
    Object.freeze({
        highlight: '#779b70',
        mid: '#47734c',
        edge: '#274d38',
        basin: 'rgba(20, 55, 36, 0.2)',
        stain: 'rgba(154, 139, 69, 0.115)',
        vein: 'rgba(185, 211, 165, 0.245)',
        veinShade: 'rgba(16, 48, 31, 0.245)',
    }),
    Object.freeze({
        highlight: '#6f9a78',
        mid: '#3c7055',
        edge: '#234a3d',
        basin: 'rgba(17, 52, 41, 0.21)',
        stain: 'rgba(117, 133, 75, 0.105)',
        vein: 'rgba(174, 211, 176, 0.235)',
        veinShade: 'rgba(13, 47, 38, 0.25)',
    }),
    Object.freeze({
        highlight: '#899b6b',
        mid: '#5a7449',
        edge: '#354b37',
        basin: 'rgba(43, 58, 32, 0.2)',
        stain: 'rgba(167, 130, 66, 0.13)',
        vein: 'rgba(203, 211, 162, 0.225)',
        veinShade: 'rgba(38, 50, 29, 0.24)',
    }),
    Object.freeze({
        highlight: '#82aa76',
        mid: '#527f50',
        edge: '#2e593e',
        basin: 'rgba(25, 62, 38, 0.18)',
        stain: 'rgba(173, 157, 76, 0.1)',
        vein: 'rgba(199, 225, 177, 0.235)',
        veinShade: 'rgba(20, 55, 33, 0.235)',
    }),
]);

export const resolveZenPondPlantNaturalismPhenotype = (lilyPad) => {
    requireEntity(lilyPad, 'lily_pad');
    const seed = resolveSeed(lilyPad);
    const size = resolvePadSize(lilyPad);
    const familyRoll = deterministicUnit(seed, 1);
    const family = (() => {
        if (size < 29) return 3;
        if (size >= 38 && familyRoll < 0.62) return 2;
        return familyRoll < 0.5 ? 0 : 1;
    })();
    const young = family === 3;
    const weathered = family === 2;
    const aspectX = clamp(
        (young ? 0.92 : 0.97)
        + deterministicUnit(seed, 2) * (young ? 0.08 : 0.1),
        0.9,
        1.07,
    );
    const aspectY = clamp(
        (young ? 1.02 : 0.94)
        + deterministicUnit(seed, 3) * (young ? 0.07 : 0.1),
        0.92,
        1.1,
    );
    const notchHalfAngle = clamp(
        (young ? 0.16 : 0.2)
        + deterministicUnit(seed, 4) * (weathered ? 0.26 : 0.2),
        0.14,
        0.46,
    );
    const notchRootRadius = clamp(
        (young ? 0.26 : 0.1)
        + deterministicUnit(seed, 5) * (young ? 0.14 : 0.2),
        0.08,
        0.4,
    );
    const notchRootOffset = (
        deterministicUnit(seed, 6) - 0.5
    ) * (weathered ? 0.14 : 0.09);
    const dentStrength = weathered
        ? 0.045 + deterministicUnit(seed, 7) * 0.035
        : deterministicUnit(seed, 7) * 0.025;
    const dentAngle = 1.35 + deterministicUnit(seed, 8) * 3.6;

    return Object.freeze({
        seed,
        family,
        familyId: [
            'mature_round',
            'mature_blue_green',
            'weathered_fold',
            'young_elliptic',
        ][family],
        aspectX,
        aspectY,
        notchHalfAngle,
        notchRootRadius,
        notchRootOffset,
        shoulderAsymmetry:
            (deterministicUnit(seed, 9) - 0.5) * 0.075,
        edgePhase: deterministicUnit(seed, 10) * TAU,
        dentStrength,
        dentAngle,
        veinCount: 5 + Math.floor(deterministicUnit(seed, 11) * 4),
        mottleCount: 7 + Math.floor(deterministicUnit(seed, 12) * 6),
        palette: PAD_PALETTES[family],
        young,
        weathered,
    });
};

const resolveBotanicalRadius = ({
    lilyPad,
    phenotype,
    angle,
    radiusScale,
}) => {
    const phase = phenotype.edgePhase;
    const broad = (
        Math.sin((angle * 2.13) + phase) * 0.026
        + Math.sin((angle * 3.71) - phase * 0.63) * 0.017
        + Math.sin((angle * 6.17) + phase * 1.31) * 0.009
    );
    const shoulder = (
        Math.sin(angle) * phenotype.shoulderAsymmetry
    );
    const dentDistance = circularDistance(angle, phenotype.dentAngle);
    const dent = phenotype.dentStrength
        * Math.exp(-((dentDistance / 0.19) ** 2));
    const radius = (
        resolvePadSize(lilyPad)
        * finiteOr(radiusScale, 1)
        * (1 + broad + shoulder - dent)
    );
    return Math.max(4, radius);
};

const resolveBotanicalPoint = ({
    lilyPad,
    phenotype,
    angle,
    radiusScale,
}) => {
    const radius = resolveBotanicalRadius({
        lilyPad,
        phenotype,
        angle,
        radiusScale,
    });
    return {
        x: Math.cos(angle) * radius * phenotype.aspectX,
        y: Math.sin(angle) * radius * phenotype.aspectY,
    };
};

export const buildZenPondPlantNaturalismPadPath = (
    lilyPad,
    phenotype,
    ctx,
    radiusScale = 1,
    step = 0.12,
) => {
    requireEntity(lilyPad, 'lily_pad');
    if (!ctx || typeof ctx.beginPath !== 'function') {
        fail('canvas_path_contract');
    }
    const size = resolvePadSize(lilyPad);
    const safeScale = clamp(finiteOr(radiusScale, 1), 0.7, 1.3);
    const safeStep = clamp(finiteOr(step, 0.12), 0.07, 0.2);
    const start = phenotype.notchHalfAngle;
    const end = TAU - phenotype.notchHalfAngle;
    const first = resolveBotanicalPoint({
        lilyPad,
        phenotype,
        angle: start,
        radiusScale: safeScale,
    });
    const last = resolveBotanicalPoint({
        lilyPad,
        phenotype,
        angle: end,
        radiusScale: safeScale,
    });
    const rootX = (
        size
        * safeScale
        * phenotype.notchRootRadius
        * phenotype.aspectX
    );
    const rootY = (
        size
        * safeScale
        * phenotype.notchRootOffset
    );

    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(
        rootX + (size * safeScale * 0.2),
        rootY + (size * safeScale * 0.08),
        first.x,
        first.y,
    );
    for (
        let angle = start + safeStep;
        angle < end;
        angle += safeStep
    ) {
        const point = resolveBotanicalPoint({
            lilyPad,
            phenotype,
            angle,
            radiusScale: safeScale,
        });
        ctx.lineTo(point.x, point.y);
    }
    ctx.lineTo(last.x, last.y);
    ctx.quadraticCurveTo(
        rootX + (size * safeScale * 0.18),
        rootY - (size * safeScale * 0.1),
        rootX,
        rootY,
    );
    ctx.closePath();
};

const drawMottling = ({
    phenotype,
    ctx,
    size,
}) => {
    for (let i = 0; i < phenotype.mottleCount; i += 1) {
        const angle = (
            phenotype.notchHalfAngle
            + 0.28
            + deterministicUnit(phenotype.seed, 30 + i * 4)
            * (TAU - phenotype.notchHalfAngle * 2 - 0.56)
        );
        const radius = (
            size
            * (0.2 + deterministicUnit(
                phenotype.seed,
                31 + i * 4,
            ) * 0.62)
        );
        const x = Math.cos(angle) * radius * phenotype.aspectX;
        const y = Math.sin(angle) * radius * phenotype.aspectY;
        const rx = size * (
            0.055
            + deterministicUnit(phenotype.seed, 32 + i * 4) * 0.13
        );
        const ry = size * (
            0.035
            + deterministicUnit(phenotype.seed, 33 + i * 4) * 0.085
        );
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(
            angle
            + (deterministicUnit(phenotype.seed, 34 + i * 4) - 0.5)
            * 1.1,
        );
        ctx.fillStyle = i % 3 === 0
            ? phenotype.palette.stain
            : 'rgba(205, 222, 174, 0.065)';
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    if (phenotype.weathered) {
        const foldAngle = phenotype.dentAngle - 0.16;
        const foldStart = size * 0.46;
        const foldEnd = size * 0.86;
        ctx.strokeStyle = 'rgba(202, 191, 132, 0.13)';
        ctx.lineWidth = Math.max(0.65, size * 0.018);
        ctx.beginPath();
        ctx.moveTo(
            Math.cos(foldAngle) * foldStart,
            Math.sin(foldAngle) * foldStart,
        );
        ctx.quadraticCurveTo(
            Math.cos(foldAngle + 0.07) * size * 0.67,
            Math.sin(foldAngle + 0.07) * size * 0.67,
            Math.cos(foldAngle) * foldEnd,
            Math.sin(foldAngle) * foldEnd,
        );
        ctx.stroke();
    }
};

const drawBranchingVeins = ({
    phenotype,
    ctx,
    size,
}) => {
    const start = phenotype.notchHalfAngle + 0.27;
    const span = TAU - (phenotype.notchHalfAngle * 2) - 0.54;
    const hubX = size * (
        phenotype.notchRootRadius + 0.025
    );
    const hubY = size * phenotype.notchRootOffset;

    for (let i = 0; i < phenotype.veinCount; i += 1) {
        const progress = (i + 0.52) / phenotype.veinCount;
        const jitter = (
            deterministicUnit(phenotype.seed, 70 + i * 5) - 0.5
        ) * (span / phenotype.veinCount) * 0.58;
        const angle = start + span * progress + jitter;
        const endRadius = size * (
            0.7
            + deterministicUnit(phenotype.seed, 71 + i * 5) * 0.2
        );
        const curve = (
            deterministicUnit(phenotype.seed, 72 + i * 5) - 0.5
        ) * 0.31;
        const cpRadius = endRadius * (
            0.46
            + deterministicUnit(phenotype.seed, 73 + i * 5) * 0.12
        );
        const cpX = Math.cos(angle + curve) * cpRadius;
        const cpY = Math.sin(angle + curve) * cpRadius;
        const endX = Math.cos(angle) * endRadius;
        const endY = Math.sin(angle) * endRadius;

        ctx.strokeStyle = phenotype.palette.veinShade;
        ctx.lineWidth = Math.max(0.65, size * 0.025);
        ctx.beginPath();
        ctx.moveTo(hubX, hubY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        ctx.strokeStyle = phenotype.palette.vein;
        ctx.lineWidth = Math.max(0.42, size * 0.011);
        ctx.beginPath();
        ctx.moveTo(hubX - size * 0.008, hubY - size * 0.006);
        ctx.quadraticCurveTo(
            cpX - size * 0.006,
            cpY - size * 0.008,
            endX,
            endY,
        );
        ctx.stroke();

        if (size >= 30 && i % 2 === (phenotype.family % 2)) {
            const branchDirection = i % 3 === 0 ? -1 : 1;
            const branchStartRadius = endRadius * (
                0.43
                + deterministicUnit(phenotype.seed, 74 + i * 5) * 0.12
            );
            const branchAngle = angle + branchDirection * (
                0.18
                + deterministicUnit(phenotype.seed, 75 + i * 5) * 0.14
            );
            const branchEndRadius = endRadius * 0.73;
            const branchStartX = Math.cos(angle + curve * 0.5)
                * branchStartRadius;
            const branchStartY = Math.sin(angle + curve * 0.5)
                * branchStartRadius;
            ctx.strokeStyle = 'rgba(179, 207, 161, 0.115)';
            ctx.lineWidth = Math.max(0.38, size * 0.008);
            ctx.beginPath();
            ctx.moveTo(branchStartX, branchStartY);
            ctx.quadraticCurveTo(
                Math.cos(branchAngle - branchDirection * 0.05)
                    * branchEndRadius * 0.86,
                Math.sin(branchAngle - branchDirection * 0.05)
                    * branchEndRadius * 0.86,
                Math.cos(branchAngle) * branchEndRadius,
                Math.sin(branchAngle) * branchEndRadius,
            );
            ctx.stroke();
        }
    }

    const basin = ctx.createRadialGradient(
        hubX,
        hubY,
        0,
        hubX,
        hubY,
        size * 0.24,
    );
    basin.addColorStop(0, phenotype.palette.basin);
    basin.addColorStop(1, 'rgba(20, 55, 36, 0)');
    ctx.fillStyle = basin;
    ctx.beginPath();
    ctx.arc(hubX, hubY, size * 0.24, 0, TAU);
    ctx.fill();
};

const drawBotanicalLilyPad = ({
    lilyPad,
    phenotype,
    ctx,
    envState,
    options,
}) => {
    if (!ctx || typeof ctx.save !== 'function') {
        fail('canvas_draw_contract');
    }
    const size = resolvePadSize(lilyPad);
    const sunAngle = finiteOr(envState?.sunAngle, Math.PI * 0.75);
    const sunX = Math.cos(sunAngle);
    const sunY = Math.sin(sunAngle);

    ctx.save();
    ctx.translate(
        finiteOr(lilyPad.x, 0),
        finiteOr(lilyPad.y, 0),
    );
    ctx.rotate(finiteOr(lilyPad.currentRotation, 0));

    if (options?.renderGroundShadow !== false) {
        ctx.save();
        ctx.translate(sunX * size * 0.08, sunY * size * 0.08);
        ctx.fillStyle = 'rgba(3, 14, 11, 0.08)';
        ctx.shadowColor = 'rgba(2, 10, 8, 0.12)';
        ctx.shadowBlur = Math.max(2, size * 0.12);
        lilyPad.buildPadPath(ctx, 1.01, 0.13);
        ctx.fill();
        ctx.restore();
    }

    const body = ctx.createRadialGradient(
        envState?.zenMaterialBake === true ? 0 : -sunX * size * 0.28,
        envState?.zenMaterialBake === true ? 0 : -sunY * size * 0.24,
        size * 0.04,
        size * 0.04,
        size * 0.06,
        size * 1.13,
    );
    body.addColorStop(0, phenotype.palette.highlight);
    body.addColorStop(0.48, phenotype.palette.mid);
    body.addColorStop(1, phenotype.palette.edge);
    ctx.fillStyle = body;
    lilyPad.buildPadPath(ctx, 1, 0.1);
    ctx.fill();

    ctx.save();
    lilyPad.buildPadPath(ctx, 0.995, 0.1);
    ctx.clip();

    const planeLight = ctx.createLinearGradient(
        -sunX * size,
        -sunY * size,
        sunX * size,
        sunY * size,
    );
    planeLight.addColorStop(0, 'rgba(224, 235, 194, 0.125)');
    planeLight.addColorStop(0.46, 'rgba(198, 220, 181, 0.025)');
    planeLight.addColorStop(1, 'rgba(12, 35, 27, 0.115)');
    ctx.fillStyle = planeLight;
    ctx.fillRect(-size * 1.3, -size * 1.3, size * 2.6, size * 2.6);

    const waxyLift = ctx.createRadialGradient(
        -sunX * size * 0.38,
        -sunY * size * 0.32,
        size * 0.02,
        -sunX * size * 0.28,
        -sunY * size * 0.24,
        size * 0.52,
    );
    waxyLift.addColorStop(0, 'rgba(234, 240, 207, 0.085)');
    waxyLift.addColorStop(0.52, 'rgba(218, 232, 194, 0.035)');
    waxyLift.addColorStop(1, 'rgba(218, 232, 194, 0)');
    ctx.fillStyle = waxyLift;
    ctx.fillRect(-size, -size, size * 2, size * 2);

    drawMottling({
        phenotype,
        ctx,
        size,
    });
    drawBranchingVeins({
        phenotype,
        ctx,
        size,
    });
    ctx.restore();

    const rim = ctx.createLinearGradient(
        -sunX * size,
        -sunY * size,
        sunX * size,
        sunY * size,
    );
    rim.addColorStop(0, 'rgba(203, 224, 180, 0.24)');
    rim.addColorStop(0.38, 'rgba(148, 190, 136, 0.1)');
    rim.addColorStop(0.72, 'rgba(26, 66, 43, 0.16)');
    rim.addColorStop(1, 'rgba(13, 43, 34, 0.24)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(0.85, size * 0.038);
    lilyPad.buildPadPath(ctx, 0.995, 0.1);
    ctx.stroke();

    ctx.restore();
};

const projectLilyPad = ({
    lilyPad,
    mode,
}) => {
    requireMode(mode);
    requireEntity(lilyPad, 'lily_pad');
    if (typeof lilyPad.buildPadPath !== 'function') {
        fail('lily_pad_path_contract');
    }
    const phenotype = resolveZenPondPlantNaturalismPhenotype(lilyPad);
    const proto = Object.getPrototypeOf(lilyPad) || Object.prototype;
    const projected = Object.assign(Object.create(proto), lilyPad);

    if (
        mode === ZEN_POND_PLANT_NATURALISM_MODES.MORPHOLOGY
        || mode === ZEN_POND_PLANT_NATURALISM_MODES.COMPOSITE
    ) {
        projected.buildPadPath = function buildPlantNaturalismPath(
            ctx,
            radiusScale = 1,
            step = 0.12,
        ) {
            return buildZenPondPlantNaturalismPadPath(
                this,
                phenotype,
                ctx,
                radiusScale,
                step,
            );
        };
    }

    if (
        mode === ZEN_POND_PLANT_NATURALISM_MODES.MATERIAL
        || mode === ZEN_POND_PLANT_NATURALISM_MODES.COMPOSITE
    ) {
        projected.draw = function drawPlantNaturalismMaterial(
            ctx,
            envState = null,
            options = null,
        ) {
            return drawBotanicalLilyPad({
                lilyPad: this,
                phenotype,
                ctx,
                envState,
                options,
            });
        };
    }

    return projected;
};

export const projectZenPondPlantNaturalismLilyPad = (
    lilyPad,
    mode,
) => projectLilyPad({
    lilyPad,
    mode,
});

export const createZenPondPlantNaturalismLilyTextureFactory = ({
    createProductLilyPadTexture,
    fallbackTexture,
    mode,
}) => {
    const productFactory = requireFactory(
        createProductLilyPadTexture,
        'lily_pad',
    );
    const rejectedFallbackTexture = requireFallbackTexture(
        fallbackTexture,
        'lily_pad',
    );
    const resolvedMode = requireMode(mode);
    return (ownedTextures, lilyPad) => {
        const projectedLilyPad = projectLilyPad({
            lilyPad,
            mode: resolvedMode,
        });
        return requireTextureResult({
            result: productFactory(
                ownedTextures,
                projectedLilyPad,
            ),
            fallbackTexture: rejectedFallbackTexture,
            label: 'lily_pad',
        });
    };
};

const WATER_LILY_STAGE_BUD = 'bud';
const WATER_LILY_STAGE_OPENING = 'opening';
const WATER_LILY_STAGE_BLOOM = 'bloom';

const WATER_LILY_PALETTES = Object.freeze({
    dusty_pink: Object.freeze({
        outerBase: '#c989a2',
        outerMid: '#e1afc0',
        outerTip: '#f4d8e1',
        innerBase: '#d89ab1',
        innerMid: '#edc2d0',
        innerTip: '#fae5eb',
        outline: 'rgba(126, 75, 92, 0.22)',
        crease: 'rgba(255, 247, 247, 0.24)',
    }),
    ivory_blush: Object.freeze({
        outerBase: '#cdbfb4',
        outerMid: '#e9dfd5',
        outerTip: '#f8f3eb',
        innerBase: '#d8c9c0',
        innerMid: '#eee5dc',
        innerTip: '#fffaf1',
        outline: 'rgba(112, 98, 82, 0.18)',
        crease: 'rgba(255, 255, 250, 0.28)',
    }),
    ivory: Object.freeze({
        outerBase: '#c7bda9',
        outerMid: '#e5dfd2',
        outerTip: '#f7f4ea',
        innerBase: '#d4cbb8',
        innerMid: '#eee9dc',
        innerTip: '#fffdf5',
        outline: 'rgba(105, 96, 73, 0.18)',
        crease: 'rgba(255, 255, 250, 0.3)',
    }),
});

const resolveBloomSize = (waterLilyBloom) => (
    Math.max(
        8,
        signatureNumber(
            waterLilyBloom?.size,
            100,
            'water_lily_size',
        ) / 100,
    )
);

const resolveBloomSeed = (waterLilyBloom) => (
    resolveSignaturePhaseBucket(
        requireFinite(
            waterLilyBloom?.flowerPhase,
            'water_lily_flower_phase',
        ),
    ) * 1.937
    + signatureNumber(
        waterLilyBloom?.size,
        100,
        'water_lily_size',
    ) * 0.00113
    + signatureNumber(
        waterLilyBloom?.stemAngle,
        1000,
        'water_lily_stem_angle',
    ) * 0.000719
    + signatureNumber(
        waterLilyBloom?.stemLength,
        100,
        'water_lily_stem_length',
    ) * 0.000281
    + signatureNumber(
        waterLilyBloom?.stemCurve,
        1000,
        'water_lily_stem_curve',
    ) * 0.000047
);

export const resolveZenPondWaterLilyNaturalismPhenotype = (
    waterLilyBloom,
) => {
    requireEntity(waterLilyBloom, 'water_lily');
    const seed = resolveBloomSeed(waterLilyBloom);
    const stage = String(waterLilyBloom.flowerStage);
    if (
        stage !== WATER_LILY_STAGE_BUD
        && stage !== WATER_LILY_STAGE_OPENING
        && stage !== WATER_LILY_STAGE_BLOOM
    ) {
        fail(`water_lily_stage:${stage}`);
    }
    if (
        waterLilyBloom.flowerColor !== 'white'
        && waterLilyBloom.flowerColor !== 'pink'
    ) {
        fail(`water_lily_color:${String(waterLilyBloom.flowerColor)}`);
    }
    const sourceColor = waterLilyBloom.flowerColor;
    const paletteId = sourceColor === 'white'
        ? 'ivory'
        : (
            deterministicUnit(seed, 201) < 0.34
                ? 'ivory_blush'
                : 'dusty_pink'
        );

    return Object.freeze({
        seed,
        stage,
        paletteId,
        palette: WATER_LILY_PALETTES[paletteId],
        rotation:
            (deterministicUnit(seed, 202) - 0.5) * 0.42,
        aspectX:
            0.96 + deterministicUnit(seed, 203) * 0.12,
        aspectY:
            0.84 + deterministicUnit(seed, 204) * 0.11,
        sepalCount:
            4 + Math.floor(deterministicUnit(seed, 205) * 2),
    });
};

const drawWaterLilyPetal = ({
    ctx,
    size,
    angle,
    baseRadius,
    length,
    width,
    bend,
    palette,
    inner,
    alpha,
}) => {
    const base = size * baseRadius;
    const tip = base + size * length;
    const halfWidth = size * width * 0.5;
    const shoulder = base + (tip - base) * 0.48;

    ctx.save();
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    const gradient = ctx.createLinearGradient(base, 0, tip, 0);
    gradient.addColorStop(
        0,
        inner ? palette.innerBase : palette.outerBase,
    );
    gradient.addColorStop(
        0.55,
        inner ? palette.innerMid : palette.outerMid,
    );
    gradient.addColorStop(
        1,
        inner ? palette.innerTip : palette.outerTip,
    );
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(base, -halfWidth * 0.48);
    ctx.bezierCurveTo(
        shoulder,
        -halfWidth,
        tip - size * length * 0.18,
        (-halfWidth * 0.46) + bend,
        tip,
        bend * 0.2,
    );
    ctx.bezierCurveTo(
        tip - size * length * 0.18,
        (halfWidth * 0.46) + bend,
        shoulder,
        halfWidth,
        base,
        halfWidth * 0.48,
    );
    ctx.quadraticCurveTo(
        base - size * length * 0.055,
        0,
        base,
        -halfWidth * 0.48,
    );
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = Math.max(0.42, size * 0.011);
    ctx.stroke();

    ctx.strokeStyle = palette.crease;
    ctx.lineWidth = Math.max(0.36, size * 0.009);
    ctx.beginPath();
    ctx.moveTo(base + size * length * 0.08, 0);
    ctx.quadraticCurveTo(
        base + size * length * 0.5,
        bend * 0.35,
        tip - size * length * 0.14,
        bend * 0.12,
    );
    ctx.stroke();
    ctx.restore();
};

const drawWaterLilyPetalLayer = ({
    ctx,
    size,
    phenotype,
    layerIndex,
    count,
    baseRadius,
    length,
    width,
    inner,
}) => {
    const step = TAU / count;
    const layerRotation = (
        phenotype.rotation
        + (layerIndex % 2 ? step * 0.48 : 0)
    );
    for (let i = 0; i < count; i += 1) {
        const unitBase = 240 + layerIndex * 60 + i * 5;
        const angle = (
            layerRotation
            + i * step
            + (deterministicUnit(
                phenotype.seed,
                unitBase,
            ) - 0.5) * step * 0.32
        );
        const petalLength = length * (
            0.86
            + deterministicUnit(
                phenotype.seed,
                unitBase + 1,
            ) * 0.24
        );
        const petalWidth = width * (
            0.84
            + deterministicUnit(
                phenotype.seed,
                unitBase + 2,
            ) * 0.26
        );
        const bend = size * (
            deterministicUnit(
                phenotype.seed,
                unitBase + 3,
            ) - 0.5
        ) * 0.045;
        const alpha = (
            0.9
            + deterministicUnit(
                phenotype.seed,
                unitBase + 4,
            ) * 0.1
        );
        drawWaterLilyPetal({
            ctx,
            size,
            angle,
            baseRadius,
            length: petalLength,
            width: petalWidth,
            bend,
            palette: phenotype.palette,
            inner,
            alpha,
        });
    }
};

const drawWaterLilySepals = ({
    ctx,
    size,
    phenotype,
    scale = 1,
}) => {
    for (let i = 0; i < phenotype.sepalCount; i += 1) {
        const step = TAU / phenotype.sepalCount;
        const angle = (
            phenotype.rotation
            + i * step
            + (deterministicUnit(
                phenotype.seed,
                330 + i,
            ) - 0.5) * step * 0.22
        );
        const length = size * scale * (
            0.49
            + deterministicUnit(
                phenotype.seed,
                340 + i,
            ) * 0.11
        );
        const width = size * scale * 0.17;
        ctx.save();
        ctx.rotate(angle);
        const gradient = ctx.createLinearGradient(0, 0, length, 0);
        gradient.addColorStop(0, '#668052');
        gradient.addColorStop(1, '#405f3c');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -width * 0.45);
        ctx.quadraticCurveTo(
            length * 0.55,
            -width,
            length,
            0,
        );
        ctx.quadraticCurveTo(
            length * 0.55,
            width,
            0,
            width * 0.45,
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
};

const drawWaterLilyCenter = ({
    ctx,
    size,
    phenotype,
    opening,
}) => {
    const stamenCount = opening ? 9 : 13;
    const radius = size * (opening ? 0.14 : 0.18);
    for (let i = 0; i < stamenCount; i += 1) {
        const angle = (
            (i / stamenCount) * TAU
            + phenotype.rotation * 0.4
            + (deterministicUnit(
                phenotype.seed,
                380 + i,
            ) - 0.5) * 0.22
        );
        const distance = radius * (
            0.58
            + deterministicUnit(
                phenotype.seed,
                400 + i,
            ) * 0.48
        );
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        ctx.fillStyle = i % 3 === 0
            ? '#c98b28'
            : '#e8b84f';
        ctx.beginPath();
        ctx.ellipse(
            x,
            y,
            Math.max(0.55, size * 0.025),
            Math.max(0.42, size * 0.016),
            angle,
            0,
            TAU,
        );
        ctx.fill();
    }

    const core = ctx.createRadialGradient(
        -size * 0.025,
        -size * 0.035,
        0,
        0,
        0,
        size * 0.13,
    );
    core.addColorStop(0, '#f3d56c');
    core.addColorStop(0.62, '#d7a53a');
    core.addColorStop(1, '#8c692c');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(
        0,
        0,
        size * 0.13,
        size * 0.105,
        phenotype.rotation,
        0,
        TAU,
    );
    ctx.fill();
};

const drawWaterLilyBud = ({
    ctx,
    size,
    phenotype,
}) => {
    ctx.save();
    ctx.rotate(phenotype.rotation);

    const calyx = ctx.createLinearGradient(
        0,
        size * 0.42,
        0,
        -size * 0.34,
    );
    calyx.addColorStop(0, '#405d3b');
    calyx.addColorStop(0.5, '#607d4e');
    calyx.addColorStop(1, '#83966a');
    ctx.fillStyle = calyx;
    ctx.beginPath();
    ctx.moveTo(-size * 0.31, size * 0.3);
    ctx.bezierCurveTo(
        -size * 0.42,
        size * 0.02,
        -size * 0.23,
        -size * 0.4,
        0,
        -size * 0.48,
    );
    ctx.bezierCurveTo(
        size * 0.23,
        -size * 0.4,
        size * 0.42,
        size * 0.02,
        size * 0.31,
        size * 0.3,
    );
    ctx.quadraticCurveTo(0, size * 0.45, -size * 0.31, size * 0.3);
    ctx.closePath();
    ctx.fill();

    const petalGradient = ctx.createLinearGradient(
        0,
        size * 0.28,
        0,
        -size * 0.42,
    );
    petalGradient.addColorStop(0, phenotype.palette.innerBase);
    petalGradient.addColorStop(0.54, phenotype.palette.innerMid);
    petalGradient.addColorStop(1, phenotype.palette.innerTip);
    const offsets = [-0.16, -0.07, 0, 0.08, 0.17];
    for (let i = 0; i < offsets.length; i += 1) {
        const offsetX = offsets[i] * size;
        const width = size * (i === 2 ? 0.2 : 0.16);
        const tipY = -size * (
            i === 2
                ? 0.48
                : 0.4 + deterministicUnit(
                    phenotype.seed,
                    430 + i,
                ) * 0.045
        );
        ctx.fillStyle = petalGradient;
        ctx.beginPath();
        ctx.moveTo(offsetX - width, size * 0.25);
        ctx.bezierCurveTo(
            offsetX - width * 1.16,
            -size * 0.02,
            offsetX - width * 0.54,
            tipY + size * 0.08,
            offsetX,
            tipY,
        );
        ctx.bezierCurveTo(
            offsetX + width * 0.54,
            tipY + size * 0.08,
            offsetX + width * 1.16,
            -size * 0.02,
            offsetX + width,
            size * 0.25,
        );
        ctx.quadraticCurveTo(
            offsetX,
            size * 0.34,
            offsetX - width,
            size * 0.25,
        );
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = phenotype.palette.outline;
        ctx.lineWidth = Math.max(0.38, size * 0.009);
        ctx.stroke();
    }

    ctx.strokeStyle = phenotype.palette.crease;
    ctx.lineWidth = Math.max(0.4, size * 0.01);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.22);
    ctx.quadraticCurveTo(
        -size * 0.035,
        -size * 0.08,
        0,
        -size * 0.4,
    );
    ctx.stroke();
    ctx.restore();
};

const drawBotanicalWaterLily = ({
    waterLilyBloom,
    phenotype,
    ctx,
    size,
    renderScale,
}) => {
    if (!ctx || typeof ctx.save !== 'function') {
        fail('water_lily_canvas_contract');
    }
    requireFinite(size, 'water_lily_draw_size');
    const safeSize = resolveBloomSize(waterLilyBloom);
    const safeScale = clamp(
        requireFinite(renderScale, 'water_lily_render_scale'),
        0.82,
        1.2,
    );
    ctx.save();
    ctx.scale(
        safeScale * phenotype.aspectX,
        safeScale * phenotype.aspectY,
    );
    ctx.rotate(phenotype.rotation * 0.24);
    if (waterLilyBloom.zenMaterialBake !== true && ctx.zenGeometryMask !== true) {
    ctx.fillStyle = 'rgba(31, 23, 20, 0.12)';
    ctx.beginPath();
    ctx.ellipse(
        0,
        safeSize * 0.07,
        safeSize * 0.82,
        safeSize * 0.42,
        0,
        0,
        TAU,
    );
    ctx.fill();

    }

    if (phenotype.stage === WATER_LILY_STAGE_BUD) {
        drawWaterLilyBud({
            ctx,
            size: safeSize,
            phenotype,
        });
        ctx.restore();
        return;
    }

    drawWaterLilySepals({
        ctx,
        size: safeSize,
        phenotype,
        scale: phenotype.stage === WATER_LILY_STAGE_OPENING
            ? 0.92
            : 1,
    });
    if (phenotype.stage === WATER_LILY_STAGE_OPENING) {
        drawWaterLilyPetalLayer({
            ctx,
            size: safeSize,
            phenotype,
            layerIndex: 0,
            count: 7,
            baseRadius: 0.055,
            length: 0.96,
            width: 0.54,
            inner: false,
        });
        drawWaterLilyPetalLayer({
            ctx,
            size: safeSize,
            phenotype,
            layerIndex: 1,
            count: 6,
            baseRadius: 0.035,
            length: 0.68,
            width: 0.43,
            inner: true,
        });
        drawWaterLilyCenter({
            ctx,
            size: safeSize,
            phenotype,
            opening: true,
        });
        ctx.restore();
        return;
    }

    drawWaterLilyPetalLayer({
        ctx,
        size: safeSize,
        phenotype,
        layerIndex: 0,
        count: 8,
        baseRadius: 0.065,
        length: 1.05,
        width: 0.54,
        inner: false,
    });
    drawWaterLilyPetalLayer({
        ctx,
        size: safeSize,
        phenotype,
        layerIndex: 1,
        count: 8,
        baseRadius: 0.045,
        length: 0.82,
        width: 0.45,
        inner: false,
    });
    drawWaterLilyPetalLayer({
        ctx,
        size: safeSize,
        phenotype,
        layerIndex: 2,
        count: 6,
        baseRadius: 0.025,
        length: 0.58,
        width: 0.34,
        inner: true,
    });
    drawWaterLilyCenter({
        ctx,
        size: safeSize,
        phenotype,
        opening: false,
    });
    ctx.restore();
};

const projectWaterLilyBloom = (waterLilyBloom) => {
    requireEntity(waterLilyBloom, 'water_lily');
    if (typeof waterLilyBloom.drawWaterLily !== 'function') {
        fail('water_lily_petals_contract');
    }
    const phenotype =
        resolveZenPondWaterLilyNaturalismPhenotype(waterLilyBloom);
    const proto = Object.getPrototypeOf(waterLilyBloom)
        || Object.prototype;
    const projected = Object.assign(
        Object.create(proto),
        waterLilyBloom,
        {
            flowerStage: phenotype.stage,
            flowerColor: phenotype.paletteId === 'dusty_pink'
                ? 'pink'
                : 'white',
        },
    );
    projected.drawWaterLily = function drawPlantNaturalismWaterLily(
        ctx,
        size,
        renderScale = 1,
    ) {
        return drawBotanicalWaterLily({
            waterLilyBloom: this,
            phenotype,
            ctx,
            size,
            renderScale,
        });
    };
    return projected;
};

export const projectZenPondWaterLilyNaturalismBloom = (
    waterLilyBloom,
) => projectWaterLilyBloom(waterLilyBloom);

export const createZenPondWaterLilyNaturalismTextureFactory = ({
    createProductWaterLilyBloomTexture,
    fallbackTexture,
}) => {
    const productFactory = requireFactory(
        createProductWaterLilyBloomTexture,
        'water_lily',
    );
    const rejectedFallbackTexture = requireFallbackTexture(
        fallbackTexture,
        'water_lily',
    );
    return (ownedTextures, waterLilyBloom) => (
        requireTextureResult({
            result: productFactory(
                ownedTextures,
                projectWaterLilyBloom(waterLilyBloom),
            ),
            fallbackTexture: rejectedFallbackTexture,
            label: 'water_lily',
        })
    );
};
