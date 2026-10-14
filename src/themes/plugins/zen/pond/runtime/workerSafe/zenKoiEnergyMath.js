import { clamp as clampValue } from '../../model/koi/koiMotion.js';

const KOI_INDIVIDUAL_ACTIVITY_MIN = 0.82;
const KOI_INDIVIDUAL_ACTIVITY_MAX = 1.18;
const KOI_ZSCORE_MIN = -1.3;
const KOI_ZSCORE_MAX = 1.3;
const KOI_ACTIVITY_QUANTILE_MIN = 0.0005;
const KOI_ACTIVITY_QUANTILE_MAX = 0.9995;

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const TEMPORAL_ENERGY_POINTS = Object.freeze([
    Object.freeze({ hour: 0, mean: 0.52, sigma: 0.06, period: 'deep_night' }),
    Object.freeze({ hour: 4.5, mean: 0.48, sigma: 0.06, period: 'deep_night' }),
    Object.freeze({ hour: 6.5, mean: 0.82, sigma: 0.08, period: 'dawn' }),
    Object.freeze({ hour: 9, mean: 1.08, sigma: 0.1, period: 'morning' }),
    Object.freeze({ hour: 11.5, mean: 1.0, sigma: 0.09, period: 'morning' }),
    Object.freeze({ hour: 13.5, mean: 0.94, sigma: 0.08, period: 'midday' }),
    Object.freeze({ hour: 16.5, mean: 0.9, sigma: 0.09, period: 'afternoon' }),
    Object.freeze({ hour: 19.25, mean: 0.98, sigma: 0.09, period: 'evening' }),
    Object.freeze({ hour: 21.5, mean: 0.72, sigma: 0.07, period: 'night' }),
    Object.freeze({ hour: 24, mean: 0.52, sigma: 0.06, period: 'deep_night' }),
]);

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const wrapHour = (value) => {
    const numeric = toFiniteNumber(value, 0);
    let wrapped = numeric % 24;
    if (wrapped < 0) wrapped += 24;
    return wrapped;
};

const resolveDayIndex = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const normalizeRisk = (value) => clampValue(toFiniteNumber(value, 0.5), 0, 1.2);

const smoothstep = (edge0, edge1, x) => {
    if (edge0 === edge1) return x >= edge1 ? 1 : 0;
    const t = clampValue((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

const lerp = (start, end, alpha) => start + ((end - start) * alpha);

const resolveTemporalPointPair = (hour) => {
    for (let i = 0; i < TEMPORAL_ENERGY_POINTS.length - 1; i += 1) {
        const p0 = TEMPORAL_ENERGY_POINTS[i];
        const p1 = TEMPORAL_ENERGY_POINTS[i + 1];
        if (hour >= p0.hour && hour < p1.hour) {
            return { p0, p1 };
        }
    }
    return {
        p0: TEMPORAL_ENERGY_POINTS[0],
        p1: TEMPORAL_ENERGY_POINTS[1],
    };
};

const hashStringFNV1a = (value) => {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const hashToUnit = (seedText) => {
    const hash = hashStringFNV1a(seedText);
    const value = (hash + 0.5) / 4294967296;
    return clampValue(value, KOI_ACTIVITY_QUANTILE_MIN, KOI_ACTIVITY_QUANTILE_MAX);
};

// Acklam approximation for inverse standard normal CDF.
const inverseNormalCdf = (probability) => {
    const p = clampValue(
        toFiniteNumber(probability, 0.5),
        KOI_ACTIVITY_QUANTILE_MIN,
        KOI_ACTIVITY_QUANTILE_MAX,
    );
    const a1 = -39.6968302866538;
    const a2 = 220.946098424521;
    const a3 = -275.928510446969;
    const a4 = 138.357751867269;
    const a5 = -30.6647980661472;
    const a6 = 2.50662827745924;
    const b1 = -54.4760987982241;
    const b2 = 161.585836858041;
    const b3 = -155.698979859887;
    const b4 = 66.8013118877197;
    const b5 = -13.2806815528857;
    const c1 = -0.00778489400243029;
    const c2 = -0.322396458041136;
    const c3 = -2.40075827716184;
    const c4 = -2.54973253934373;
    const c5 = 4.37466414146497;
    const c6 = 2.93816398269878;
    const d1 = 0.00778469570904146;
    const d2 = 0.32246712907004;
    const d3 = 2.445134137142996;
    const d4 = 3.754408661907416;
    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6)
            / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    if (p <= pHigh) {
        const q = p - 0.5;
        const r = q * q;
        return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q
            / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6)
        / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
};

const resolveEphemeralQuantile = (fish) => {
    const uid = Number(fish?.uid);
    const flowSeed = toFiniteNumber(fish?.flowSeed, 0);
    const domain = typeof fish?.domain === 'string' ? fish.domain : '';
    const fallbackSeed = `${domain}|${uid}|${flowSeed.toFixed(6)}`;
    return hashToUnit(fallbackSeed);
};

const createActivityProfileSnapshotError = (code, domain, details = null) => {
    const normalizedDomain = typeof domain === 'string' && domain.trim()
        ? domain.trim()
        : 'unknown';
    const error = new Error(`${code}:${normalizedDomain}`);
    error.code = code;
    error.details = {
        domain: normalizedDomain,
        ...(isObject(details) ? details : {}),
    };
    return error;
};

export const requireKoiActivityProfileSnapshot = (
    candidate,
    {
        domain = '',
    } = {},
) => {
    if (!isObject(candidate)) {
        throw createActivityProfileSnapshotError(
            'ZEN_POND_WORKER_ACTIVITY_PROFILE_SNAPSHOT_REQUIRED',
            domain,
        );
    }
    const requiredFields = ['persisted', 'quantile', 'boundDayIndex', 'rebindCount'];
    const missingFields = requiredFields.filter((field) => !hasOwn(candidate, field));
    const quantile = Number(candidate.quantile);
    const boundDayIndex = candidate.boundDayIndex === null
        ? null
        : Number(candidate.boundDayIndex);
    const rebindCount = Number(candidate.rebindCount);
    const invalid = missingFields.length > 0
        || typeof candidate.persisted !== 'boolean'
        || !Number.isFinite(quantile)
        || quantile < KOI_ACTIVITY_QUANTILE_MIN
        || quantile > KOI_ACTIVITY_QUANTILE_MAX
        || (boundDayIndex !== null && !Number.isInteger(boundDayIndex))
        || !Number.isInteger(rebindCount)
        || rebindCount < 0;
    if (invalid) {
        throw createActivityProfileSnapshotError(
            'ZEN_POND_WORKER_ACTIVITY_PROFILE_SNAPSHOT_INVALID',
            domain,
            { missingFields },
        );
    }
    return {
        persisted: candidate.persisted,
        quantile,
        boundDayIndex,
        rebindCount,
    };
};

export const resolveKoiTemporalEnergyBand = (envState = null) => {
    const hour = wrapHour(envState?.time ?? envState?.hour ?? 12);
    const daylight = clampValue(toFiniteNumber(envState?.daylight, 0.5), 0, 1);
    const { p0, p1 } = resolveTemporalPointPair(hour);
    const segmentProgress = p1.hour > p0.hour
        ? (hour - p0.hour) / (p1.hour - p0.hour)
        : 0;
    const eased = smoothstep(0, 1, segmentProgress);
    const baseMean = lerp(p0.mean, p1.mean, eased);
    const baseSigma = lerp(p0.sigma, p1.sigma, eased);
    const daylightLift = (daylight - 0.5) * 0.08;
    const mean = clampValue(baseMean + daylightLift, 0.45, 1.14);
    const sigma = clampValue(baseSigma * (0.93 + (1 - daylight) * 0.05), 0.05, 0.1);
    return {
        period: p0.period,
        hour,
        daylight,
        mean,
        sigma,
    };
};

export const resolveKoiDomainEnergyProfile = ({
    domain = '',
    dayIndex = null,
    risk = 0.5,
    activityProfileSnapshot = null,
} = {}) => {
    const normalizedRisk = normalizeRisk(risk);
    const riskLift = clampValue((normalizedRisk - 0.5) * 0.1, -0.04, 0.06);
    if (typeof domain !== 'string' || !domain.trim()) {
        return {
            persisted: false,
            quantile: 0.5,
            zScore: 0,
            boundDayIndex: resolveDayIndex(dayIndex),
            rebindCount: 0,
            risk: normalizedRisk,
            riskLift: 0,
        };
    }

    const profile = requireKoiActivityProfileSnapshot(activityProfileSnapshot, { domain });
    const quantile = profile.quantile;
    const zScore = clampValue(inverseNormalCdf(quantile), KOI_ZSCORE_MIN, KOI_ZSCORE_MAX);
    return {
        persisted: profile.persisted,
        quantile,
        zScore,
        boundDayIndex: profile.boundDayIndex,
        rebindCount: profile.rebindCount,
        risk: normalizedRisk,
        riskLift,
    };
};

export const resolveKoiIndividualActivityScale = ({
    fish = null,
    envState = null,
    activityProfileSnapshot = null,
} = {}) => {
    const temporalBand = resolveKoiTemporalEnergyBand(envState);
    const risk = fish?.targetRisk ?? fish?.risk ?? 0.5;
    const dayIndex = resolveDayIndex(envState?.dayIndex);
    const domain = typeof fish?.domain === 'string' ? fish.domain : '';
    const isBoundDomain = !!domain.trim();
    const domainProfile = isBoundDomain
        ? resolveKoiDomainEnergyProfile({
            domain,
            dayIndex,
            risk,
            activityProfileSnapshot,
        })
        : {
            persisted: false,
            quantile: resolveEphemeralQuantile(fish),
            zScore: 0,
            boundDayIndex: dayIndex,
            rebindCount: 0,
            risk: normalizeRisk(risk),
            riskLift: 0,
        };
    const zScore = isBoundDomain
        ? domainProfile.zScore
        : clampValue(inverseNormalCdf(domainProfile.quantile), -1.2, 1.2);
    const rawScale = temporalBand.mean + domainProfile.riskLift + zScore * temporalBand.sigma;
    const individualActivityScale = clampValue(
        rawScale,
        KOI_INDIVIDUAL_ACTIVITY_MIN,
        KOI_INDIVIDUAL_ACTIVITY_MAX,
    );

    return {
        ...temporalBand,
        ...domainProfile,
        zScore,
        individualActivityScale,
    };
};

export {
    KOI_INDIVIDUAL_ACTIVITY_MIN,
    KOI_INDIVIDUAL_ACTIVITY_MAX,
};
