import { clamp as clampValue } from '../model/koi/koiMotion.js';

const KOI_GLOBAL_ACTIVITY_MIN = 0.35;
const KOI_GLOBAL_ACTIVITY_MAX = 1.85;
const KOI_SLEEP_MULTIPLIER_MIN = 0.06;
const KOI_SLEEP_MULTIPLIER_MAX = 1.0;
const KOI_INDIVIDUAL_ACTIVITY_MIN = 0.82;
const KOI_INDIVIDUAL_ACTIVITY_MAX = 1.18;
const KOI_FINAL_ACTIVITY_MIN = 0.06;
const KOI_FINAL_ACTIVITY_MAX = KOI_GLOBAL_ACTIVITY_MAX;

const clampUnit = (value) => clampValue(value, 0, 1);

const toNumberOrFallback = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export function resolveKoiGlobalActivityScale(envState = null) {
    return clampValue(
        toNumberOrFallback(envState?.koiActivity, 1),
        KOI_GLOBAL_ACTIVITY_MIN,
        KOI_GLOBAL_ACTIVITY_MAX,
    );
}

export function resolveKoiActivationScore({
    globalActivityScale = 1,
    sleepBlend = 0,
    sleepActivityMultiplier = null,
    individualActivityScale = 1,
} = {}) {
    const globalActivity = clampValue(
        toNumberOrFallback(globalActivityScale, 1),
        KOI_GLOBAL_ACTIVITY_MIN,
        KOI_GLOBAL_ACTIVITY_MAX,
    );
    const normalizedSleepBlend = clampUnit(toNumberOrFallback(sleepBlend, 0));
    const inferredSleepMultiplier = clampValue(
        1 - normalizedSleepBlend * 0.92,
        KOI_SLEEP_MULTIPLIER_MIN,
        KOI_SLEEP_MULTIPLIER_MAX,
    );
    const resolvedSleepMultiplier = sleepActivityMultiplier === null || sleepActivityMultiplier === undefined
        ? inferredSleepMultiplier
        : clampValue(
            toNumberOrFallback(sleepActivityMultiplier, inferredSleepMultiplier),
            KOI_SLEEP_MULTIPLIER_MIN,
            KOI_SLEEP_MULTIPLIER_MAX,
        );
    const resolvedIndividualActivityScale = clampValue(
        toNumberOrFallback(individualActivityScale, 1),
        KOI_INDIVIDUAL_ACTIVITY_MIN,
        KOI_INDIVIDUAL_ACTIVITY_MAX,
    );
    const finalActivity = clampValue(
        globalActivity * resolvedSleepMultiplier * resolvedIndividualActivityScale,
        KOI_FINAL_ACTIVITY_MIN,
        KOI_FINAL_ACTIVITY_MAX,
    );

    return {
        globalActivity,
        sleepBlend: normalizedSleepBlend,
        sleepActivityMultiplier: resolvedSleepMultiplier,
        individualActivityScale: resolvedIndividualActivityScale,
        activationScore: finalActivity,
    };
}

export {
    KOI_GLOBAL_ACTIVITY_MIN,
    KOI_GLOBAL_ACTIVITY_MAX,
    KOI_SLEEP_MULTIPLIER_MIN,
    KOI_SLEEP_MULTIPLIER_MAX,
    KOI_INDIVIDUAL_ACTIVITY_MIN,
    KOI_INDIVIDUAL_ACTIVITY_MAX,
    KOI_FINAL_ACTIVITY_MIN,
    KOI_FINAL_ACTIVITY_MAX,
};
