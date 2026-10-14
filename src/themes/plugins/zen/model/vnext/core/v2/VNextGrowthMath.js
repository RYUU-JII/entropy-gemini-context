export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
export const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
export const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);
export const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));

export const vec3 = (x = 0, y = 0, z = 0) => [Number(x), Number(y), Number(z)];
export const vecAdd = (a = [0, 0, 0], b = [0, 0, 0]) => [
    toNumber(a?.[0]) + toNumber(b?.[0]),
    toNumber(a?.[1]) + toNumber(b?.[1]),
    toNumber(a?.[2]) + toNumber(b?.[2]),
];
export const vecScale = (value = [0, 0, 0], scalar = 1) => [
    toNumber(value?.[0]) * toNumber(scalar, 1),
    toNumber(value?.[1]) * toNumber(scalar, 1),
    toNumber(value?.[2]) * toNumber(scalar, 1),
];
export const vecLerp = (a = [0, 0, 0], b = [0, 0, 0], t = 0.5) => [
    lerp(toNumber(a?.[0]), toNumber(b?.[0]), t),
    lerp(toNumber(a?.[1]), toNumber(b?.[1]), t),
    lerp(toNumber(a?.[2]), toNumber(b?.[2]), t),
];

export const vecLength2 = (value = [0, 1, 0]) => (
    Math.sqrt((toNumber(value?.[0]) ** 2) + (toNumber(value?.[1]) ** 2))
);

export const vecNormalize2 = (value = [0, 1, 0]) => {
    const length = Math.max(1e-9, vecLength2(value));
    return [
        toNumber(value?.[0]) / length,
        toNumber(value?.[1]) / length,
        0,
    ];
};

export const rotate2D = (direction = [0, 1, 0], radians = 0) => {
    const x = toNumber(direction?.[0], 0);
    const y = toNumber(direction?.[1], 1);
    const cos = Math.cos(toNumber(radians, 0));
    const sin = Math.sin(toNumber(radians, 0));
    return vecNormalize2([
        (x * cos) - (y * sin),
        (x * sin) + (y * cos),
        0,
    ]);
};

export const signedCentered = (value = 0.5) => (
    (clamp01(toNumber(value, 0.5)) * 2) - 1
);

export const distance2 = (a = [0, 0, 0], b = [0, 0, 0]) => (
    Math.sqrt(
        ((toNumber(a?.[0]) - toNumber(b?.[0])) ** 2)
        + ((toNumber(a?.[1]) - toNumber(b?.[1])) ** 2),
    )
);

export const buildTopContributions = (contributions = {}, {
    positive = true,
    limit = 3,
} = {}) => (
    Object.entries(contributions)
        .filter(([, value]) => (
            positive
                ? Number(value) > 0
                : Number(value) < 0
        ))
        .sort((left, right) => (
            positive
                ? Number(right[1]) - Number(left[1])
                : Number(left[1]) - Number(right[1])
        ))
        .slice(0, Math.max(1, Math.floor(limit)))
        .map(([key, value]) => ({
            key,
            value: round(Number(value), 6),
        }))
);
