import {
    createCanvas2d,
} from '../waterEffects/textureBake/canvas2d.js';
import {
    createZenSeededRandom,
} from '../../../../shared/zenSeededRandom.js';

const TAU = Math.PI * 2;
const MINERAL_SEED_CONTRACT =
    'entropy.zen.pond-benthic-mineral-grain-v1';
const DEPTH_SEED_CONTRACT =
    'entropy.zen.pond-benthic-depth-pockets-v1';

const normalizeStyle = (options = {}) => (
    typeof options?.style === 'string' && options.style.trim()
        ? options.style.trim().toLowerCase()
        : 'primary'
);

const resolveWrappedOffsets = (coordinate, radius, size) => {
    const offsets = [0];
    if ((coordinate - radius) < 0) offsets.push(size);
    if ((coordinate + radius) > size) offsets.push(-size);
    return offsets;
};

const forEachWrappedPosition = ({
    x,
    y,
    radius,
    size,
    draw,
}) => {
    const xOffsets = resolveWrappedOffsets(x, radius, size);
    const yOffsets = resolveWrappedOffsets(y, radius, size);
    for (let xIndex = 0; xIndex < xOffsets.length; xIndex += 1) {
        for (let yIndex = 0; yIndex < yOffsets.length; yIndex += 1) {
            draw(
                x + xOffsets[xIndex],
                y + yOffsets[yIndex],
            );
        }
    }
};

const buildStoneShape = ({
    random,
    radius,
    stretchX,
    stretchY,
    rotation,
}) => {
    const pointCount = 5 + Math.floor(random() * 4);
    const points = [];
    for (let index = 0; index < pointCount; index += 1) {
        const angle = rotation + (index / pointCount) * TAU;
        const radialJitter = 0.76 + random() * 0.34;
        points.push([
            Math.cos(angle) * radius * stretchX * radialJitter,
            Math.sin(angle) * radius * stretchY * radialJitter,
        ]);
    }
    return points;
};

const traceStone = (ctx, points, x, y, offsetX = 0, offsetY = 0) => {
    ctx.beginPath();
    ctx.moveTo(
        x + points[0][0] + offsetX,
        y + points[0][1] + offsetY,
    );
    for (let index = 1; index < points.length; index += 1) {
        ctx.lineTo(
            x + points[index][0] + offsetX,
            y + points[index][1] + offsetY,
        );
    }
    ctx.closePath();
};

const drawMineralStone = ({
    ctx,
    size,
    x,
    y,
    radius,
    random,
    tone,
    relief,
}) => {
    const stretchX = 0.72 + random() * 0.64;
    const stretchY = 0.68 + random() * 0.62;
    const rotation = random() * TAU;
    const points = buildStoneShape({
        random,
        radius,
        stretchX,
        stretchY,
        rotation,
    });
    const boundsRadius = radius * Math.max(stretchX, stretchY) * 1.25;
    forEachWrappedPosition({
        x,
        y,
        radius: boundsRadius,
        size,
        draw: (wrappedX, wrappedY) => {
            traceStone(
                ctx,
                points,
                wrappedX,
                wrappedY,
                radius * 0.16,
                radius * 0.2,
            );
            ctx.fillStyle = `rgba(4, 4, 3, ${relief.shadowAlpha})`;
            ctx.fill();

            traceStone(ctx, points, wrappedX, wrappedY);
            ctx.fillStyle = tone;
            ctx.fill();

            ctx.save();
            traceStone(ctx, points, wrappedX, wrappedY);
            ctx.clip();
            const highlight = ctx.createLinearGradient(
                wrappedX - radius,
                wrappedY - radius,
                wrappedX + radius * 0.4,
                wrappedY + radius * 0.5,
            );
            highlight.addColorStop(
                0,
                `rgba(255, 249, 235, ${relief.highlightAlpha})`,
            );
            highlight.addColorStop(
                0.46,
                `rgba(255, 249, 235, ${relief.highlightAlpha * 0.2})`,
            );
            highlight.addColorStop(1, 'rgba(255, 249, 235, 0)');
            ctx.fillStyle = highlight;
            ctx.fillRect(
                wrappedX - boundsRadius,
                wrappedY - boundsRadius,
                boundsRadius * 2,
                boundsRadius * 2,
            );
            ctx.restore();
        },
    });
};

const drawSubstrateWash = ({
    ctx,
    size,
    random,
    isDetailStyle,
}) => {
    const washCount = isDetailStyle ? 20 : 16;
    for (let index = 0; index < washCount; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = size * (0.1 + random() * 0.13);
        const stretchX = 0.72 + random() * 0.9;
        const stretchY = 0.68 + random() * 0.82;
        const rotation = random() * TAU;
        const dark = random() < 0.56;
        forEachWrappedPosition({
            x,
            y,
            radius: radius * Math.max(stretchX, stretchY),
            size,
            draw: (wrappedX, wrappedY) => {
                ctx.save();
                ctx.translate(wrappedX, wrappedY);
                ctx.rotate(rotation);
                ctx.scale(stretchX, stretchY);
                const gradient = ctx.createRadialGradient(
                    0,
                    0,
                    radius * 0.08,
                    0,
                    0,
                    radius,
                );
                gradient.addColorStop(
                    0,
                    dark
                        ? 'rgba(7, 6, 5, 0.045)'
                        : 'rgba(237, 221, 190, 0.028)',
                );
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.fill();
                ctx.restore();
            },
        });
    }
};

const drawMineralLayer = ({
    ctx,
    size,
    random,
    layer,
}) => {
    const sizeScale = size / 512;
    const count = Math.round(layer.count * sizeScale * sizeScale);
    for (let index = 0; index < count; index += 1) {
        const radius = (
            layer.radiusMin
            + random() * (layer.radiusMax - layer.radiusMin)
        ) * sizeScale;
        drawMineralStone({
            ctx,
            size,
            x: random() * size,
            y: random() * size,
            radius,
            random,
            tone: layer.tones[
                Math.floor(random() * layer.tones.length)
            ],
            relief: layer.relief,
        });
    }
};

const drawFineSediment = ({
    ctx,
    size,
    random,
    isDetailStyle,
}) => {
    const sizeScale = size / 512;
    const count = Math.round(
        (isDetailStyle ? 1450 : 1050) * sizeScale * sizeScale,
    );
    for (let index = 0; index < count; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = (0.22 + random() * 0.68) * sizeScale;
        const warm = random() < 0.44;
        ctx.fillStyle = warm
            ? `rgba(238, 218, 179, ${0.025 + random() * 0.026})`
            : `rgba(9, 8, 7, ${0.018 + random() * 0.022})`;
        forEachWrappedPosition({
            x,
            y,
            radius,
            size,
            draw: (wrappedX, wrappedY) => {
                ctx.beginPath();
                ctx.arc(
                    wrappedX,
                    wrappedY,
                    radius,
                    0,
                    TAU,
                );
                ctx.fill();
            },
        });
    }
};

const createMineralGrainTexture = ({
    size,
    style,
}) => {
    const { canvas, ctx } = createCanvas2d(size, size, { alpha: false });
    if (!canvas || !ctx) return null;
    const isDetailStyle = style === 'detail' || style === 'micro';
    const random = createZenSeededRandom(
        [
            MINERAL_SEED_CONTRACT,
            size,
            style,
        ].join('|'),
    );

    ctx.fillStyle = isDetailStyle ? '#29241f' : '#302a23';
    ctx.fillRect(0, 0, size, size);
    drawSubstrateWash({
        ctx,
        size,
        random,
        isDetailStyle,
    });

    const mediumLayer = isDetailStyle
        ? {
            count: 160,
            radiusMin: 2.4,
            radiusMax: 7.2,
            tones: ['#312b25', '#3b352d', '#474038', '#28231e'],
            relief: {
                shadowAlpha: 0.12,
                highlightAlpha: 0.075,
            },
        }
        : {
            count: 118,
            radiusMin: 4.2,
            radiusMax: 12.5,
            tones: ['#393229', '#463e33', '#554c40', '#302a23'],
            relief: {
                shadowAlpha: 0.14,
                highlightAlpha: 0.09,
            },
        };
    const grainLayer = isDetailStyle
        ? {
            count: 860,
            radiusMin: 0.65,
            radiusMax: 2.6,
            tones: ['#342e28', '#403931', '#4d463c', '#2b2621'],
            relief: {
                shadowAlpha: 0.08,
                highlightAlpha: 0.045,
            },
        }
        : {
            count: 620,
            radiusMin: 1.1,
            radiusMax: 4.1,
            tones: ['#3a332b', '#484037', '#584f43', '#302a24'],
            relief: {
                shadowAlpha: 0.09,
                highlightAlpha: 0.055,
            },
        };

    drawMineralLayer({
        ctx,
        size,
        random,
        layer: mediumLayer,
    });
    drawMineralLayer({
        ctx,
        size,
        random,
        layer: grainLayer,
    });
    drawFineSediment({
        ctx,
        size,
        random,
        isDetailStyle,
    });
    return canvas;
};

const drawNeutralReliefWash = ({
    ctx,
    size,
    random,
    isDetailStyle,
}) => {
    const washCount = isDetailStyle ? 22 : 18;
    for (let index = 0; index < washCount; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = size * (0.075 + random() * 0.13);
        const stretchX = 0.64 + random() * 1.08;
        const stretchY = 0.62 + random() * 0.92;
        const rotation = random() * TAU;
        const lit = random() < 0.46;
        forEachWrappedPosition({
            x,
            y,
            radius: radius * Math.max(stretchX, stretchY),
            size,
            draw: (wrappedX, wrappedY) => {
                ctx.save();
                ctx.translate(wrappedX, wrappedY);
                ctx.rotate(rotation);
                ctx.scale(stretchX, stretchY);
                const gradient = ctx.createRadialGradient(
                    -radius * 0.12,
                    -radius * 0.08,
                    radius * 0.04,
                    0,
                    0,
                    radius,
                );
                gradient.addColorStop(
                    0,
                    lit
                        ? (
                            isDetailStyle
                                ? 'rgba(232, 236, 224, 0.052)'
                                : 'rgba(244, 237, 214, 0.064)'
                        )
                        : 'rgba(24, 37, 38, 0.07)',
                );
                gradient.addColorStop(
                    0.48,
                    lit
                        ? 'rgba(220, 226, 214, 0.018)'
                        : 'rgba(28, 42, 43, 0.026)',
                );
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.fill();
                ctx.restore();
            },
        });
    }
};

const drawNeutralReliefMica = ({
    ctx,
    size,
    random,
    isDetailStyle,
}) => {
    const sizeScale = size / 512;
    const count = Math.round(
        (isDetailStyle ? 420 : 310) * sizeScale * sizeScale,
    );
    ctx.save();
    ctx.lineCap = 'round';
    for (let index = 0; index < count; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const length = (
            isDetailStyle
                ? (0.45 + random() * 1.45)
                : (0.65 + random() * 2.1)
        ) * sizeScale;
        const angle = random() * TAU;
        const dx = Math.cos(angle) * length;
        const dy = Math.sin(angle) * length;
        const alpha = (
            isDetailStyle
                ? (0.045 + random() * 0.07)
                : (0.055 + random() * 0.085)
        );
        ctx.strokeStyle = random() < 0.78
            ? `rgba(255, 252, 236, ${alpha})`
            : `rgba(188, 226, 224, ${alpha * 0.72})`;
        ctx.lineWidth = Math.max(
            0.4,
            (0.32 + random() * 0.52) * sizeScale,
        );
        forEachWrappedPosition({
            x,
            y,
            radius: length + ctx.lineWidth,
            size,
            draw: (wrappedX, wrappedY) => {
                ctx.beginPath();
                ctx.moveTo(wrappedX - dx, wrappedY - dy);
                ctx.lineTo(wrappedX + dx, wrappedY + dy);
                ctx.stroke();
            },
        });
    }
    ctx.restore();
};

const createNeutralMineralReliefTexture = ({
    size,
    style,
}) => {
    const { canvas, ctx } = createCanvas2d(size, size, { alpha: false });
    if (!canvas || !ctx) return null;
    const isDetailStyle = style === 'detail' || style === 'micro';
    const random = createZenSeededRandom(
        [
            'entropy.zen.pond-benthic-neutral-relief-v1',
            size,
            style,
        ].join('|'),
    );

    // HARD_LIGHT treats 0.5 as the neutral source value. Keep most of the
    // receiver close to that point, then distribute sparse values to both
    // sides so the bake can express lit faces as well as pores.
    ctx.fillStyle = isDetailStyle ? '#6a7472' : '#6f736c';
    ctx.fillRect(0, 0, size, size);
    drawNeutralReliefWash({
        ctx,
        size,
        random,
        isDetailStyle,
    });

    const mediumLayer = isDetailStyle
        ? {
            count: 118,
            radiusMin: 2.0,
            radiusMax: 6.2,
            tones: [
                'rgba(61, 75, 75, 0.42)',
                'rgba(120, 125, 118, 0.48)',
                'rgba(154, 149, 132, 0.34)',
                'rgba(47, 67, 69, 0.36)',
            ],
            relief: {
                shadowAlpha: 0.12,
                highlightAlpha: 0.095,
            },
        }
        : {
            count: 86,
            radiusMin: 3.1,
            radiusMax: 8.9,
            tones: [
                'rgba(58, 72, 72, 0.46)',
                'rgba(119, 121, 112, 0.52)',
                'rgba(161, 151, 128, 0.36)',
                'rgba(44, 64, 67, 0.38)',
            ],
            relief: {
                shadowAlpha: 0.14,
                highlightAlpha: 0.115,
            },
        };
    const grainLayer = isDetailStyle
        ? {
            count: 760,
            radiusMin: 0.62,
            radiusMax: 2.45,
            tones: [
                'rgba(72, 84, 82, 0.48)',
                'rgba(126, 130, 122, 0.5)',
                'rgba(156, 151, 137, 0.32)',
                'rgba(55, 75, 75, 0.4)',
            ],
            relief: {
                shadowAlpha: 0.09,
                highlightAlpha: 0.065,
            },
        }
        : {
            count: 540,
            radiusMin: 0.95,
            radiusMax: 3.7,
            tones: [
                'rgba(70, 82, 79, 0.5)',
                'rgba(127, 128, 118, 0.52)',
                'rgba(158, 151, 134, 0.34)',
                'rgba(52, 72, 72, 0.42)',
            ],
            relief: {
                shadowAlpha: 0.1,
                highlightAlpha: 0.075,
            },
        };
    drawMineralLayer({
        ctx,
        size,
        random,
        layer: mediumLayer,
    });
    drawMineralLayer({
        ctx,
        size,
        random,
        layer: grainLayer,
    });
    drawFineSediment({
        ctx,
        size,
        random,
        isDetailStyle,
    });
    drawNeutralReliefMica({
        ctx,
        size,
        random,
        isDetailStyle,
    });
    return canvas;
};

const drawDepthPockets = ({
    canvas,
    size,
    style,
    strength,
    seedRole,
}) => {
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return canvas;
    const isDetailStyle = style === 'detail' || style === 'micro';
    const random = createZenSeededRandom(
        [
            DEPTH_SEED_CONTRACT,
            seedRole,
            size,
            style,
        ].join('|'),
    );
    const pocketCount = isDetailStyle ? 13 : 9;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let index = 0; index < pocketCount; index += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = size * (
            isDetailStyle
                ? (0.09 + random() * 0.1)
                : (0.13 + random() * 0.14)
        );
        const stretchX = 0.72 + random() * 1.15;
        const stretchY = 0.66 + random() * 0.92;
        const rotation = random() * TAU;
        forEachWrappedPosition({
            x,
            y,
            radius: radius * Math.max(stretchX, stretchY),
            size,
            draw: (wrappedX, wrappedY) => {
                ctx.save();
                ctx.translate(wrappedX, wrappedY);
                ctx.rotate(rotation);
                ctx.scale(stretchX, stretchY);
                const gradient = ctx.createRadialGradient(
                    -radius * 0.12,
                    -radius * 0.08,
                    radius * 0.08,
                    0,
                    0,
                    radius,
                );
                gradient.addColorStop(
                    0,
                    `rgba(13, 14, 12, ${strength})`,
                );
                gradient.addColorStop(
                    0.42,
                    `rgba(18, 18, 15, ${strength * 0.62})`,
                );
                gradient.addColorStop(1, 'rgba(28, 27, 22, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, TAU);
                ctx.fill();
                ctx.restore();
            },
        });
    }
    ctx.restore();
    return canvas;
};

const validateProfile = (profile, label = 'visual_profile') => {
    if (!profile || typeof profile !== 'object') {
        throw new Error(
            `ZEN_POND_BENTHIC_PROFILE_REQUIRED:${label}`,
        );
    }
    if (
        profile.baseMorphology !== 'product_pebble'
        && profile.baseMorphology !== 'mineral_grain'
        && profile.baseMorphology !== 'neutral_mineral_relief'
    ) {
        throw new Error(
            `ZEN_POND_BENTHIC_BASE_MORPHOLOGY_INVALID:${label}`,
        );
    }
};

export const createBenthicMaterialTextureGenerator = ({
    descriptor,
    profile,
    productGeneratePebbleTexture = null,
} = {}) => {
    const profileLabel = descriptor?.id || 'visual_profile';
    validateProfile(profile, profileLabel);
    if (
        profile.baseMorphology === 'product_pebble'
        && typeof productGeneratePebbleTexture !== 'function'
    ) {
        throw new Error(
            `ZEN_POND_BENTHIC_PRODUCT_GENERATOR_REQUIRED:${profileLabel}`,
        );
    }
    return (size = 512, options = {}) => {
        const safeSize = Math.max(1, Math.round(Number(size) || 512));
        const style = normalizeStyle(options);
        let canvas = null;
        if (profile.baseMorphology === 'product_pebble') {
            canvas = productGeneratePebbleTexture(safeSize, options);
        } else if (profile.baseMorphology === 'mineral_grain') {
            canvas = createMineralGrainTexture({
                size: safeSize,
                style,
            });
        } else {
            canvas = createNeutralMineralReliefTexture({
                size: safeSize,
                style,
            });
        }
        if (!canvas || profile.depthPocketStrength <= 0) return canvas;
        return drawDepthPockets({
            canvas,
            size: safeSize,
            style,
            strength: profile.depthPocketStrength * (
                style === 'detail' || style === 'micro'
                    ? 0.72
                    : 1
            ),
            seedRole: profile.depthSeedRole,
        });
    };
};
