import {
    ensureZenKoiActivityProfile,
    maybeRebindZenKoiActivityProfile,
} from '../storage/zenPondStorage/activityProfileStore.js';
import {
    KOI_INDIVIDUAL_ACTIVITY_MAX,
    KOI_INDIVIDUAL_ACTIVITY_MIN,
    requireKoiActivityProfileSnapshot,
    resolveKoiDomainEnergyProfile as resolveWorkerSafeKoiDomainEnergyProfile,
    resolveKoiIndividualActivityScale as resolveWorkerSafeKoiIndividualActivityScale,
    resolveKoiTemporalEnergyBand,
} from './workerSafe/zenKoiEnergyMath.js';

const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const resolveDayIndex = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const buildCanonicalActivityProfileSnapshot = (profile, domain) => (
    requireKoiActivityProfileSnapshot({
        persisted: profile?.persisted !== false,
        quantile: profile?.quantile,
        boundDayIndex: resolveDayIndex(profile?.boundDayIndex),
        rebindCount: Math.max(0, Math.floor(Number(profile?.rebindCount) || 0)),
    }, { domain })
);

const resolveStorageBackedActivityProfileSnapshot = ({
    domain = '',
    dayIndex = null,
    risk = 0.5,
} = {}) => {
    const normalizedDayIndex = resolveDayIndex(dayIndex);
    const profile = normalizedDayIndex === null
        ? ensureZenKoiActivityProfile(domain, { dayIndex: null, risk })
        : maybeRebindZenKoiActivityProfile(domain, { dayIndex: normalizedDayIndex, risk });
    return buildCanonicalActivityProfileSnapshot(profile, domain);
};

export const resolveKoiDomainEnergyProfile = ({
    domain = '',
    dayIndex = null,
    risk = 0.5,
    activityProfileSnapshot = null,
} = {}) => {
    const hasBoundDomain = typeof domain === 'string' && domain.trim();
    const snapshot = hasBoundDomain
        ? (isObject(activityProfileSnapshot)
            ? requireKoiActivityProfileSnapshot(activityProfileSnapshot, { domain })
            : resolveStorageBackedActivityProfileSnapshot({ domain, dayIndex, risk }))
        : null;
    return resolveWorkerSafeKoiDomainEnergyProfile({
        domain,
        dayIndex,
        risk,
        activityProfileSnapshot: snapshot,
    });
};

export const buildKoiDomainActivityProfileSnapshot = ({
    domain = '',
    dayIndex = null,
    risk = 0.5,
} = {}) => {
    const resolved = resolveKoiDomainEnergyProfile({
        domain,
        dayIndex,
        risk,
    });
    return {
        persisted: resolved.persisted !== false,
        quantile: resolved.quantile,
        boundDayIndex: resolved.boundDayIndex,
        rebindCount: resolved.rebindCount,
    };
};

export const resolveKoiIndividualActivityScale = ({
    fish = null,
    envState = null,
    activityProfileSnapshot = null,
} = {}) => {
    const domain = typeof fish?.domain === 'string' ? fish.domain : '';
    const dayIndex = resolveDayIndex(envState?.dayIndex);
    const risk = fish?.targetRisk ?? fish?.risk ?? 0.5;
    const snapshot = domain.trim()
        ? (isObject(activityProfileSnapshot)
            ? requireKoiActivityProfileSnapshot(activityProfileSnapshot, { domain })
            : resolveStorageBackedActivityProfileSnapshot({ domain, dayIndex, risk }))
        : null;
    return resolveWorkerSafeKoiIndividualActivityScale({
        fish,
        envState,
        activityProfileSnapshot: snapshot,
    });
};

export {
    KOI_INDIVIDUAL_ACTIVITY_MIN,
    KOI_INDIVIDUAL_ACTIVITY_MAX,
    resolveKoiTemporalEnergyBand,
};
