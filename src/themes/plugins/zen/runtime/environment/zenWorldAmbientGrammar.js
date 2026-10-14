export const ZEN_WORLD_AMBIENT_GRAMMAR_VERSION = 1;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const smoothstep = (edge0, edge1, value) => {
    const span = edge1 - edge0;
    if (Math.abs(span) < 1e-6) return value >= edge1 ? 1 : 0;
    const t = clamp01((Number(value) - edge0) / span);
    return t * t * (3 - (2 * t));
};

const normalizeHour = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 12;
    return ((numeric % 24) + 24) % 24;
};

const circularHourDistance = (hour, target) => {
    const delta = Math.abs(normalizeHour(hour) - normalizeHour(target));
    return Math.min(delta, 24 - delta);
};

const resolveTransitionWeight = (hour, targetHour, radiusHours) => (
    1 - smoothstep(0, radiusHours, circularHourDistance(hour, targetHour))
);

export function resolveZenWorldAmbientGrammar({
    hour = 12,
    sunriseHour = 6,
    sunsetHour = 18,
    daylight = 1,
    nightDepth = 0,
    solarElevation = 1,
    noonWeight = 0,
} = {}) {
    const resolvedDaylight = clamp01(daylight);
    const resolvedNightDepth = clamp01(nightDepth);
    const dawnWeight = sunriseHour === null ? 0 : resolveTransitionWeight(hour, sunriseHour, 2.15);
    const duskWeight = sunsetHour === null ? 0 : resolveTransitionWeight(hour, sunsetHour, 2.25);
    const warmth = clamp01((dawnWeight * 0.54) + (duskWeight * 0.78));
    const lowSun = clamp01(
        (1 - clamp01(solarElevation)) * (0.18 + (resolvedDaylight * 0.82)),
    );

    return Object.freeze({
        version: ZEN_WORLD_AMBIENT_GRAMMAR_VERSION,
        daylight: resolvedDaylight,
        nightDepth: resolvedNightDepth,
        dawnWeight,
        duskWeight,
        warmth,
        lowSun,
        noonWeight: clamp01(noonWeight),
        twilightWeight: smoothstep(0.08, 0.72, resolvedNightDepth),
        nightWeight: smoothstep(0.70, 0.98, resolvedNightDepth),
    });
}

export const normalizeZenWorldAmbientGrammar = (candidate = {}) => {
    const requiredFields = [
        'daylight',
        'nightDepth',
        'dawnWeight',
        'duskWeight',
        'warmth',
        'lowSun',
        'noonWeight',
        'twilightWeight',
        'nightWeight',
    ];
    if (requiredFields.every((fieldName) => Number.isFinite(Number(candidate?.[fieldName])))) {
        return Object.freeze({
            version: ZEN_WORLD_AMBIENT_GRAMMAR_VERSION,
            ...Object.fromEntries(
                requiredFields.map((fieldName) => [fieldName, clamp01(candidate[fieldName])]),
            ),
        });
    }
    return resolveZenWorldAmbientGrammar(candidate);
};

export const resolveZenAmbientChromaticState = resolveZenWorldAmbientGrammar;

export const requireZenWorldAmbientGrammar = (candidate) => {
    const fields = ['daylight', 'nightDepth', 'dawnWeight', 'duskWeight', 'warmth',
        'lowSun', 'noonWeight', 'twilightWeight', 'nightWeight'];
    if (!candidate || fields.some((field) => !Number.isFinite(candidate[field]))) {
        throw new Error('ZEN_WORLD_AMBIENT_GRAMMAR_REQUIRED');
    }
    return candidate;
};
