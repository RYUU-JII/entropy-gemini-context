import { createZenDecorMaterialRecord } from '../pixiSceneTextureFactories.js';
import {
    hashStringFNV1a,
} from '../../../../shared/zenSeededRandom.js';

const TAU = Math.PI * 2;

const ROCK_VARIANT_PROFILES = Object.freeze({
    hero: Object.freeze({
        widthGain: 0.82,
        heightGain: 1.18,
        nodeCount: 9,
        lowFrequency: 2,
    }),
    slab: Object.freeze({
        widthGain: 1.18,
        heightGain: 0.82,
        nodeCount: 8,
        lowFrequency: 2,
    }),
    flat: Object.freeze({
        widthGain: 1.16,
        heightGain: 0.68,
        nodeCount: 8,
        lowFrequency: 2,
    }),
    ridge: Object.freeze({
        widthGain: 0.92,
        heightGain: 1.24,
        nodeCount: 10,
        lowFrequency: 3,
    }),
    cluster: Object.freeze({
        widthGain: 0.98,
        heightGain: 1.04,
        nodeCount: 11,
        lowFrequency: 3,
    }),
});

const SIGNATURE_FIELD_SCALES = Object.freeze([
    Object.freeze(['size', 100]),
    Object.freeze(['tilt', 1000]),
    Object.freeze(['noiseSeed', 1000]),
    Object.freeze(['highlightBias', 1000]),
    Object.freeze(['roughness', 1000]),
    Object.freeze(['ridgeStrength', 1000]),
    Object.freeze(['edgeChip', 1000]),
    Object.freeze(['patternStrength', 1000]),
    Object.freeze(['angularity', 1000]),
    Object.freeze(['chunkiness', 1000]),
    Object.freeze(['asymmetry', 1000]),
    Object.freeze(['profileAxis', 1000]),
    Object.freeze(['tone', 1000]),
]);

export const ZEN_POND_ROCK_NATURALISM_MODES = Object.freeze({
    CONTROL: 'control',
    MORPHOLOGY: 'morphology',
    MATERIAL: 'material',
    COMPOSITE: 'composite',
});

const fail = (detail) => {
    throw new Error(`ZEN_POND_ROCK_NATURALISM_INVALID:${detail}`);
};

const clamp = (value, min, max) => (
    Math.min(max, Math.max(min, value))
);

const requireMode = (mode) => {
    if (!Object.values(ZEN_POND_ROCK_NATURALISM_MODES).includes(mode)) {
        fail(`mode:${String(mode)}`);
    }
    return mode;
};

const requireRock = (rock) => {
    if (!rock || typeof rock !== 'object' || Array.isArray(rock)) {
        fail('rock_record');
    }
    if (!ROCK_VARIANT_PROFILES[rock.variant]) {
        fail(`rock_variant:${String(rock.variant)}`);
    }
    if (typeof rock.draw !== 'function') {
        fail('rock_draw_contract');
    }
    for (let index = 0; index < SIGNATURE_FIELD_SCALES.length; index += 1) {
        const [field] = SIGNATURE_FIELD_SCALES[index];
        if (!Number.isFinite(Number(rock[field]))) {
            fail(`rock_${field}_finite`);
        }
    }
    if (Number(rock.size) < 32) {
        fail('rock_size_minimum');
    }
    return rock;
};

const quantizeSignatureField = (rock, field, scale) => (
    Math.round(Number(rock[field]) * scale)
);

const buildRockSignatureSeed = (rock) => (
    [
        'rock-naturalism-v2',
        rock.variant,
        ...SIGNATURE_FIELD_SCALES.map(([field, scale]) => (
            `${field}:${quantizeSignatureField(rock, field, scale)}`
        )),
    ].join('|')
);

const deterministicUnit = (seed, lane) => (
    hashStringFNV1a(`${seed}|${lane}`) / 4294967295
);

const buildMorphologyPoints = ({
    profile,
    radiusX,
    radiusY,
    signatureSeed,
    asymmetry,
    profileAxis,
    angularity,
    chunkiness,
    edgeChip,
}) => {
    const points = [];
    const phase = deterministicUnit(signatureSeed, 'phase') * TAU;
    const secondaryPhase =
        deterministicUnit(signatureSeed, 'secondary-phase') * TAU;
    const clippedAngularity = clamp(angularity, 0, 1);
    const clippedChunkiness = clamp(chunkiness, 0, 1);
    const clippedEdgeChip = clamp(edgeChip, 0, 1);
    const primaryChipIndex = Math.floor(
        deterministicUnit(signatureSeed, 'primary-chip')
        * profile.nodeCount,
    );
    const secondaryChipIndex = (
        primaryChipIndex
        + Math.max(2, Math.floor(profile.nodeCount * 0.43))
    ) % profile.nodeCount;
    let radialEnergy = 0;

    for (let index = 0; index < profile.nodeCount; index += 1) {
        const baseAngle = (index / profile.nodeCount) * TAU;
        const angleJitter = (
            deterministicUnit(signatureSeed, `angle:${index}`) - 0.5
        ) * 0.07;
        const angle = baseAngle + angleJitter;
        const broadLobe = Math.sin(
            angle * profile.lowFrequency + phase,
        ) * (0.055 + clippedChunkiness * 0.04);
        const secondaryLobe = Math.cos(
            angle * (profile.lowFrequency + 1) + secondaryPhase,
        ) * (0.02 + clippedAngularity * 0.03);
        const localVariation = (
            deterministicUnit(signatureSeed, `radius:${index}`) - 0.5
        ) * (0.05 + clippedEdgeChip * 0.12);
        const directionalBias = (
            Math.cos(angle - profileAxis)
            * (0.015 + clamp(asymmetry, 0, 1) * 0.07)
        );
        const chipDepth = index === primaryChipIndex
            ? 0.055 + clippedEdgeChip * 0.095
            : index === secondaryChipIndex
                ? 0.025 + clippedEdgeChip * 0.055
                : 0;
        const radial = clamp(
            1
            + broadLobe
            + secondaryLobe
            + localVariation
            + directionalBias
            - chipDepth,
            0.78,
            1.2,
        );
        radialEnergy += radial * radial;
        points.push({
            angle,
            radial,
        });
    }

    const normalization = Math.sqrt(
        profile.nodeCount / Math.max(0.0001, radialEnergy),
    );
    return points.map(({ angle, radial }) => {
        const normalizedRadial = radial * normalization;
        return Object.freeze({
            x: Math.cos(angle) * radiusX * normalizedRadial,
            y: Math.sin(angle) * radiusY * normalizedRadial,
        });
    });
};

export const resolveZenPondRockNaturalismPhenotype = (rock) => {
    const source = requireRock(rock);
    const profile = ROCK_VARIANT_PROFILES[source.variant];
    const signatureSeed = buildRockSignatureSeed(source);
    const size = quantizeSignatureField(source, 'size', 100) / 100;
    const tilt = quantizeSignatureField(source, 'tilt', 1000) / 1000;
    const asymmetry =
        quantizeSignatureField(source, 'asymmetry', 1000) / 1000;
    const profileAxis =
        quantizeSignatureField(source, 'profileAxis', 1000) / 1000;
    const angularity =
        quantizeSignatureField(source, 'angularity', 1000) / 1000;
    const chunkiness =
        quantizeSignatureField(source, 'chunkiness', 1000) / 1000;
    const edgeChip =
        quantizeSignatureField(source, 'edgeChip', 1000) / 1000;
    const patternStrength =
        quantizeSignatureField(source, 'patternStrength', 1000) / 1000;
    const ridgeStrength =
        quantizeSignatureField(source, 'ridgeStrength', 1000) / 1000;
    const roughness =
        quantizeSignatureField(source, 'roughness', 1000) / 1000;
    const radiusX = size * (0.46 + profile.widthGain * 0.12);
    const radiusY = (
        size
        * (0.27 + profile.heightGain * 0.1)
        * tilt
    );
    const points = buildMorphologyPoints({
        profile,
        radiusX,
        radiusY,
        signatureSeed,
        asymmetry,
        profileAxis,
        angularity,
        chunkiness,
        edgeChip,
    });
    const facetCount = 3 + Math.floor(
        deterministicUnit(signatureSeed, 'facet-count') * 2
        + clamp(angularity, 0, 1) * 1.5,
    );
    const fractureCount = 1 + Math.floor(
        deterministicUnit(signatureSeed, 'fracture-count') * 2
        + clamp(ridgeStrength, 0, 1) * 1.25,
    );

    return Object.freeze({
        contract: 'entropy.zen.pond-rock-naturalism-phenotype',
        version: 2,
        signatureSeed,
        variant: source.variant,
        size,
        radiusX,
        radiusY,
        points: Object.freeze(points),
        facetCount,
        fractureCount,
        angularity,
        edgeChip,
        patternStrength,
        ridgeStrength,
        roughness,
        cornerRounding: clamp(
            0.24
            - clamp(angularity, 0, 1) * 0.12
            - clamp(edgeChip, 0, 1) * 0.04,
            0.075,
            0.22,
        ),
        mineralWarmth:
            deterministicUnit(signatureSeed, 'mineral-warmth'),
        materialPhase:
            deterministicUnit(signatureSeed, 'material-phase') * TAU,
    });
};

const requirePath2D = () => {
    if (typeof Path2D !== 'function') {
        fail('path2d_contract');
    }
    return Path2D;
};

const buildRoundedRockPath = (phenotype) => {
    const Path2DContract = requirePath2D();
    const path = new Path2DContract();
    const points = phenotype.points;
    if (!Array.isArray(points) || points.length < 8) {
        fail('morphology_point_contract');
    }
    const rounding = phenotype.cornerRounding;
    for (let index = 0; index < points.length; index += 1) {
        const previous = points[
            (index - 1 + points.length) % points.length
        ];
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const entryX = (
            current.x
            + (previous.x - current.x) * rounding
        );
        const entryY = (
            current.y
            + (previous.y - current.y) * rounding
        );
        const exitX = (
            current.x
            + (next.x - current.x) * rounding
        );
        const exitY = (
            current.y
            + (next.y - current.y) * rounding
        );
        if (index === 0) {
            path.moveTo(entryX, entryY);
        } else {
            path.lineTo(entryX, entryY);
        }
        path.quadraticCurveTo(
            current.x,
            current.y,
            exitX,
            exitY,
        );
    }
    path.closePath();
    return path;
};

const createSilhouetteInterceptContext = ({
    ctx,
    replacementPath,
    submergedVeilAlphaScale,
    onCapture,
    onBeforeSubmergedVeil,
    neutralLighting,
}) => {
    if (!ctx || typeof ctx !== 'object') {
        fail('canvas_context');
    }
    if (typeof onCapture !== 'function') {
        fail('silhouette_capture_callback');
    }
    if (
        onBeforeSubmergedVeil !== null
        && typeof onBeforeSubmergedVeil !== 'function'
    ) {
        fail('submerged_veil_callback');
    }
    const expectedPathLedger = Object.freeze(neutralLighting
        ? ['fill', 'clip', 'clip', 'stroke']
        : ['fill', 'clip', 'clip', 'fill', 'stroke']);
    let sourcePath = null;
    let saveDepth = 0;
    let silhouetteClipCount = 0;
    let submergedVeilDepth = null;
    let productFillRectCount = 0;
    let submergedVeilFillRectCount = 0;
    let pathLedgerIndex = 0;
    const mapPath = (value, operation) => {
        if (!value || typeof value !== 'object') {
            return value;
        }
        if (!sourcePath) {
            if (
                operation !== expectedPathLedger[0]
                || pathLedgerIndex !== 0
            ) {
                fail(`product_path_ledger_start:${operation}`);
            }
            sourcePath = value;
            onCapture(value);
        }
        if (value !== sourcePath) {
            fail(`product_path_identity:${operation}`);
        }
        const expectedOperation =
            expectedPathLedger[pathLedgerIndex];
        if (operation !== expectedOperation) {
            fail(
                `product_path_ledger:${pathLedgerIndex}:`
                + `${String(expectedOperation)}:${operation}`,
            );
        }
        pathLedgerIndex += 1;
        return (
            value === sourcePath
            && replacementPath
        )
            ? replacementPath
            : value;
    };
    const proxy = new Proxy(ctx, {
        get(target, property) {
            if (property === 'save') {
                return () => {
                    saveDepth += 1;
                    return Reflect.apply(target.save, target, []);
                };
            }
            if (property === 'restore') {
                return () => {
                    if (saveDepth <= 0) {
                        fail('product_save_restore_underflow');
                    }
                    if (submergedVeilDepth === saveDepth) {
                        if (submergedVeilFillRectCount !== 1) {
                            fail(
                                'product_submerged_veil_fill_rect_count:'
                                + submergedVeilFillRectCount,
                            );
                        }
                        submergedVeilDepth = null;
                    }
                    const result = Reflect.apply(
                        target.restore,
                        target,
                        [],
                    );
                    saveDepth -= 1;
                    return result;
                };
            }
            if (property === 'fillRect') {
                return (...args) => {
                    productFillRectCount += 1;
                    if (submergedVeilDepth !== saveDepth) {
                        fail('product_fill_rect_outside_submerged_veil');
                    }
                    submergedVeilFillRectCount += 1;
                    if (submergedVeilFillRectCount > 1) {
                        fail(
                            'product_submerged_veil_fill_rect_count:'
                            + submergedVeilFillRectCount,
                        );
                    }
                    if (submergedVeilAlphaScale < 1) {
                        const previousAlpha = Number(target.globalAlpha);
                        const safePreviousAlpha = Number.isFinite(
                            previousAlpha,
                        )
                            ? previousAlpha
                            : 1;
                        target.globalAlpha = (
                            safePreviousAlpha
                            * submergedVeilAlphaScale
                        );
                        try {
                            return Reflect.apply(
                                target.fillRect,
                                target,
                                args,
                            );
                        } finally {
                            target.globalAlpha = safePreviousAlpha;
                        }
                    }
                    return Reflect.apply(
                        target.fillRect,
                        target,
                        args,
                    );
                };
            }
            if (
                property === 'fill'
                || property === 'clip'
                || property === 'stroke'
            ) {
                return (...args) => {
                    const incomingPath = args[0];
                    const nextArgs = args.length > 0
                        ? [
                            mapPath(args[0], property),
                            ...args.slice(1),
                        ]
                        : args;
                    if (
                        property === 'clip'
                        && incomingPath
                        && incomingPath === sourcePath
                    ) {
                        silhouetteClipCount += 1;
                        if (silhouetteClipCount === 2) {
                            if (submergedVeilDepth !== null) {
                                fail('product_submerged_veil_reentry');
                            }
                            if (onBeforeSubmergedVeil) {
                                onBeforeSubmergedVeil({
                                    ctx: target,
                                    path: nextArgs[0],
                                });
                            }
                            submergedVeilDepth = saveDepth;
                        }
                    }
                    return Reflect.apply(
                        target[property],
                        target,
                        nextArgs,
                    );
                };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function'
                ? value.bind(target)
                : value;
        },
        set(target, property, value) {
            return Reflect.set(target, property, value, target);
        },
    });
    return Object.freeze({
        context: proxy,
        assertComplete() {
            if (!sourcePath) {
                fail('product_silhouette_capture');
            }
            if (pathLedgerIndex !== expectedPathLedger.length) {
                fail(
                    'product_path_ledger_incomplete:'
                    + `${pathLedgerIndex}:`
                    + `${expectedPathLedger.length}`,
                );
            }
            if (silhouetteClipCount !== 2) {
                fail(
                    'product_silhouette_clip_count:'
                    + silhouetteClipCount,
                );
            }
            if (
                productFillRectCount !== 1
                || submergedVeilFillRectCount !== 1
            ) {
                fail(
                    'product_submerged_veil_fill_rect_count:'
                    + `${productFillRectCount}:`
                    + submergedVeilFillRectCount,
                );
            }
            if (submergedVeilDepth !== null) {
                fail('product_submerged_veil_restore');
            }
            if (saveDepth !== 0) {
                fail(`product_save_restore_balance:${saveDepth}`);
            }
        },
    });
};

const drawMesosurfaceMaterial = ({
    ctx,
    path,
    phenotype,
}) => {
    if (!path || typeof path !== 'object') {
        fail('product_silhouette_capture');
    }
    const size = phenotype.size;
    const radiusX = phenotype.radiusX;
    const radiusY = phenotype.radiusY;
    const warmth = phenotype.mineralWarmth;
    const phase = phenotype.materialPhase;
    const highR = Math.round(188 + warmth * 18);
    const highG = Math.round(188 + warmth * 8);
    const highB = Math.round(178 - warmth * 12);

    ctx.save();
    ctx.clip(path);

    const illumination = ctx.createLinearGradient(
        -radiusX * 0.72,
        -radiusY * 0.74,
        radiusX * 0.72,
        radiusY * 0.82,
    );
    illumination.addColorStop(
        0,
        `rgba(${highR}, ${highG}, ${highB}, 0.215)`,
    );
    illumination.addColorStop(
        0.46,
        'rgba(126, 137, 132, 0.045)',
    );
    illumination.addColorStop(
        1,
        'rgba(24, 42, 42, 0.225)',
    );
    ctx.fillStyle = illumination;
    ctx.fillRect(
        -radiusX * 1.2,
        -radiusY * 1.2,
        radiusX * 2.4,
        radiusY * 2.4,
    );

    for (let index = 0; index < phenotype.facetCount; index += 1) {
        const laneUnit = deterministicUnit(
            phenotype.signatureSeed,
            `facet:${index}`,
        );
        const angle = (
            phase
            + index * (TAU / phenotype.facetCount)
            + (laneUnit - 0.5) * 0.52
        );
        const offsetX = Math.cos(angle) * radiusX * 0.22;
        const offsetY = Math.sin(angle) * radiusY * 0.2;
        const spanX = radiusX * (0.42 + laneUnit * 0.18);
        const spanY = radiusY * (0.34 + laneUnit * 0.16);
        ctx.beginPath();
        ctx.moveTo(
            offsetX - spanX,
            offsetY - spanY * 0.22,
        );
        ctx.lineTo(
            offsetX + spanX * 0.22,
            offsetY - spanY,
        );
        ctx.lineTo(
            offsetX + spanX,
            offsetY + spanY * 0.18,
        );
        ctx.lineTo(
            offsetX - spanX * 0.12,
            offsetY + spanY,
        );
        ctx.closePath();
        const facetAlpha = (
            0.078
            + clamp(phenotype.angularity, 0, 1) * 0.025
            + clamp(phenotype.patternStrength, 0, 1) * 0.02
        );
        ctx.fillStyle = index % 2 === 0
            ? `rgba(202, 198, 178, ${facetAlpha})`
            : `rgba(35, 58, 57, ${facetAlpha + 0.018})`;
        ctx.fill();
    }

    const mottleCount = 4 + Math.floor(
        clamp(phenotype.roughness, 0, 1) * 5,
    );
    for (let index = 0; index < mottleCount; index += 1) {
        const xUnit = deterministicUnit(
            phenotype.signatureSeed,
            `mottle-x:${index}`,
        );
        const yUnit = deterministicUnit(
            phenotype.signatureSeed,
            `mottle-y:${index}`,
        );
        const sizeUnit = deterministicUnit(
            phenotype.signatureSeed,
            `mottle-size:${index}`,
        );
        const centerX = (xUnit - 0.5) * radiusX * 1.32;
        const centerY = (yUnit - 0.5) * radiusY * 1.18;
        const mottleRadiusX = radiusX * (0.08 + sizeUnit * 0.13);
        const mottleRadiusY = radiusY * (0.09 + sizeUnit * 0.16);
        const mottleAlpha = (
            0.055
            + clamp(phenotype.patternStrength, 0, 1) * 0.035
        );
        const mottle = ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            Math.max(mottleRadiusX, mottleRadiusY),
        );
        mottle.addColorStop(
            0,
            index % 3 === 0
                ? `rgba(${highR}, ${highG}, ${highB}, ${mottleAlpha})`
                : `rgba(24, 43, 42, ${mottleAlpha + 0.012})`,
        );
        mottle.addColorStop(1, 'rgba(24, 43, 42, 0)');
        ctx.fillStyle = mottle;
        ctx.beginPath();
        ctx.ellipse(
            centerX,
            centerY,
            mottleRadiusX,
            mottleRadiusY,
            (xUnit - yUnit) * 0.8,
            0,
            TAU,
        );
        ctx.fill();
    }

    for (let index = 0; index < phenotype.fractureCount; index += 1) {
        const laneUnit = deterministicUnit(
            phenotype.signatureSeed,
            `fracture:${index}`,
        );
        const y = (
            (laneUnit - 0.5) * radiusY * 0.72
            + (index - 0.5) * radiusY * 0.12
        );
        const bend = (
            deterministicUnit(
                phenotype.signatureSeed,
                `fracture-bend:${index}`,
            ) - 0.5
        ) * radiusY * 0.22;
        ctx.beginPath();
        ctx.moveTo(-radiusX * 0.58, y - bend * 0.35);
        ctx.bezierCurveTo(
            -radiusX * 0.18,
            y - bend,
            radiusX * 0.24,
            y + bend,
            radiusX * 0.62,
            y + bend * 0.28,
        );
        ctx.strokeStyle = index % 2 === 0
            ? 'rgba(25, 45, 44, 0.145)'
            : 'rgba(218, 211, 190, 0.108)';
        ctx.lineWidth = clamp(size * 0.011, 1.15, 2.0);
        ctx.stroke();
    }
    ctx.restore();
};

export const projectZenPondRockNaturalismRock = (
    rock,
    mode,
) => {
    const source = requireRock(rock);
    const resolvedMode = requireMode(mode);
    if (resolvedMode === ZEN_POND_ROCK_NATURALISM_MODES.CONTROL) {
        return source;
    }
    const phenotype = resolveZenPondRockNaturalismPhenotype(source);
    const morphologyChanged = (
        resolvedMode === ZEN_POND_ROCK_NATURALISM_MODES.MORPHOLOGY
        || resolvedMode === ZEN_POND_ROCK_NATURALISM_MODES.COMPOSITE
    );
    const materialChanged = (
        resolvedMode === ZEN_POND_ROCK_NATURALISM_MODES.MATERIAL
        || resolvedMode === ZEN_POND_ROCK_NATURALISM_MODES.COMPOSITE
    );
    const proto = Object.getPrototypeOf(source);
    if (!proto) {
        fail('rock_prototype_contract');
    }
    const projected = Object.assign(Object.create(proto), source);
    const productDraw = source.draw;

    projected.draw = function drawRockNaturalism(
        ctx,
        envState = null,
        options = null,
    ) {
        let productSilhouette = null;
        const candidateSilhouette = morphologyChanged
            ? buildRoundedRockPath(phenotype)
            : null;
        if (options?.renderSilhouette === true) {
            if (candidateSilhouette) {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation);
                ctx.fillStyle = '#ffffff';
                ctx.fill(candidateSilhouette);
                ctx.restore();
                return;
            }
            return Reflect.apply(productDraw, this, [ctx, envState, options]);
        }
        const drawIntercept = createSilhouetteInterceptContext({
            ctx,
            neutralLighting: options?.neutralLighting === true,
            replacementPath: candidateSilhouette,
            submergedVeilAlphaScale: materialChanged
                ? 0.28
                : 1,
            onCapture: (path) => {
                productSilhouette = path;
            },
            onBeforeSubmergedVeil: materialChanged
                ? ({ ctx: localContext, path }) => {
                    drawMesosurfaceMaterial({
                        ctx: localContext,
                        path,
                        phenotype,
                    });
                }
                : null,
        });
        const result = Reflect.apply(
            productDraw,
            this,
            [drawIntercept.context, envState, options],
        );
        if (!productSilhouette) {
            fail('product_silhouette_capture');
        }
        drawIntercept.assertComplete();
        return result;
    };
    return projected;
};

const requireFactory = (factory) => {
    if (typeof factory !== 'function') {
        fail('product_rock_texture_factory');
    }
    return factory;
};

const requireFallbackTexture = (texture) => {
    if (!texture || typeof texture !== 'object') {
        fail('fallback_texture_contract');
    }
    return texture;
};

const requireTextureResult = ({
    result,
    fallbackTexture,
    ownedTextures,
}) => {
    if (!result || typeof result !== 'object' || !result.texture) {
        fail('rock_texture_result');
    }
    if (result.texture === fallbackTexture) {
        fail('rock_texture_fallback');
    }
    if (!ownedTextures.has(result.texture)) {
        fail('rock_texture_ownership');
    }
    return result;
};

export const createZenPondRockNaturalismTextureFactory = ({
    createProductRockTexture,
    fallbackTexture,
    mode,
}) => {
    const productFactory = requireFactory(createProductRockTexture);
    const rejectedFallbackTexture =
        requireFallbackTexture(fallbackTexture);
    const resolvedMode = requireMode(mode);

    return (ownedTextures, rock) => {
        if (!(ownedTextures instanceof Set)) {
            fail('owned_textures_set');
        }
        const source = requireRock(rock);
        const projected = projectZenPondRockNaturalismRock(
            source,
            resolvedMode,
        );
        return requireTextureResult({
            result: productFactory(ownedTextures, projected),
            fallbackTexture: rejectedFallbackTexture,
            ownedTextures,
        });
    };
};

const requireConstructor = (value, label) => {
    if (typeof value !== 'function') {
        fail(`${label}_constructor`);
    }
    return value;
};

const drawCompactRockContactAo = ({
    ctx,
    centerX,
    centerY,
    size,
}) => {
    const contactCenterY = centerY + size * 0.045;
    const contactAo = ctx.createRadialGradient(
        centerX,
        contactCenterY,
        size * 0.035,
        centerX,
        contactCenterY,
        size * 0.54,
    );
    contactAo.addColorStop(0, 'rgba(2, 12, 11, 0.13)');
    contactAo.addColorStop(0.58, 'rgba(2, 12, 11, 0.052)');
    contactAo.addColorStop(1, 'rgba(2, 12, 11, 0)');
    ctx.fillStyle = contactAo;
    ctx.beginPath();
    ctx.ellipse(
        centerX,
        contactCenterY,
        size * 0.55,
        size * 0.27,
        0,
        0,
        TAU,
    );
    ctx.fill();
};

export const createZenPondRockContactTextureFactory = ({
    BaseTextureConstructor,
    TextureConstructor,
    mode,
}) => {
    const BaseTextureContract = requireConstructor(
        BaseTextureConstructor,
        'base_texture',
    );
    const TextureContract = requireConstructor(
        TextureConstructor,
        'texture',
    );
    const resolvedMode = requireMode(mode);

    return (ownedTextures, rock) => {
        if (!(ownedTextures instanceof Set)) {
            fail('owned_textures_set');
        }
        const source = requireRock(rock);
        if (
            typeof document === 'undefined'
            || typeof document.createElement !== 'function'
        ) {
            fail('document_canvas_contract');
        }
        const rockSize = Math.max(40, Number(source.size));
        const textureWidth = Math.ceil(rockSize * 2.7);
        const textureHeight = Math.ceil(rockSize * 2.45);
        const canvas = document.createElement('canvas');
        if (!canvas || typeof canvas.getContext !== 'function') {
            fail('rock_canvas_contract');
        }
        canvas.width = textureWidth;
        canvas.height = textureHeight;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            fail('rock_canvas_context');
        }
        const centerX = textureWidth * 0.5;
        const centerY = textureHeight * 0.5;
        drawCompactRockContactAo({
            ctx,
            centerX,
            centerY,
            size: rockSize,
        });

        const projected = projectZenPondRockNaturalismRock(
            source,
            resolvedMode,
        );
        const proto = Object.getPrototypeOf(projected);
        if (!proto) {
            fail('rock_prototype_contract');
        }
        const bakeRock = Object.assign(
            Object.create(proto),
            projected,
            {
                x: centerX,
                y: centerY,
                rotation: 0,
            },
        );
        try {
            bakeRock.draw(ctx, null, {
                renderContactShadow: false,
                neutralLighting: true,
            });
        } catch (error) {
            const wrapped = new Error(
                'ZEN_POND_ROCK_NATURALISM_INVALID:'
                + 'rock_contact_texture_draw',
            );
            wrapped.cause = error;
            throw wrapped;
        }

        let baseTexture = null;
        let texture;
        try {
            baseTexture = new BaseTextureContract(canvas);
            if (
                !baseTexture
                || typeof baseTexture !== 'object'
                || typeof baseTexture.destroy !== 'function'
            ) {
                fail('rock_contact_base_texture_result');
            }
            texture = new TextureContract(baseTexture);
        } catch (error) {
            let cleanupError = null;
            if (
                baseTexture
                && typeof baseTexture.destroy === 'function'
            ) {
                try {
                    baseTexture.destroy();
                } catch (destroyError) {
                    cleanupError = destroyError;
                }
            }
            const wrapped = new Error(
                'ZEN_POND_ROCK_NATURALISM_INVALID:'
                + 'rock_contact_texture_creation',
            );
            wrapped.cause = error;
            if (cleanupError) {
                wrapped.cleanupCause = cleanupError;
            }
            throw wrapped;
        }
        if (!texture || typeof texture !== 'object') {
            fail('rock_contact_texture_result');
        }
        ownedTextures.add(texture);
        if (!ownedTextures.has(texture)) {
            fail('rock_contact_texture_ownership');
        }
        return createZenDecorMaterialRecord({ ownedTextures, texture, entity: projected, kind: 'rock' });
    };
};
