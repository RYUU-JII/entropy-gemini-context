import { isHostnameMatch, normalizeDomain } from '../../../lib/domain.js';
import { PERSONAL_BASELINE_STATUSES } from '../../../lib/personalBaselineContract.js';
import { getLocalDateStr } from '../../../lib/time.js';
import {
    STATS_PERSONAL_BASELINE_CORE_VERSION,
    STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS,
    STATS_PERSONAL_BASELINE_METRIC_GRAINS,
    STATS_PERSONAL_BASELINE_METRIC_KINDS,
    STATS_PERSONAL_BASELINE_ROLES,
    buildPersonalBaselineMetricProfile,
} from '../baseline/index.js';

const MINUTE_MS = 60_000;

export const USAGE_BASELINE_STATUS = PERSONAL_BASELINE_STATUSES;

export const USAGE_BASELINE_METRIC_VERSION = 'usage-daily-minutes-v2';
export const USAGE_BASELINE_POLICY_VERSION = 'usage-baseline-policy-v2';
export const USAGE_BASELINE_METRIC_IDS = Object.freeze({
    MANAGED_DAILY_MINUTES: 'managed_daily_usage_minutes',
    SITE_DAILY_MINUTES: 'site_daily_usage_minutes',
});

export const USAGE_BASELINE_POLICY = Object.freeze({
    version: USAGE_BASELINE_POLICY_VERSION,
    windowDays: 28,
    minSampleDays: 3,
    stableSampleDays: 14,
    confidenceGate: 0.25,
});

const UNOBSERVED_USAGE = Object.freeze({
    observed: false,
    eligible: false,
    value: null,
    exposure: 0,
});

const USAGE_BASELINE_PROFILE_KEYS = Object.freeze([
    'role', 'coreVersion', 'metricVersion', 'policyVersion', 'id', 'kind',
    'family', 'unit', 'grain', 'direction', 'scope', 'exposureUnit',
    'provenance', 'currentValue', 'currentObserved', 'currentEligible', 'currentExposure',
    'sample', 'stats', 'reference', 'anomaly', 'confidence',
    'confidenceGate', 'anomalyScore', 'status', 'observationValues',
]);
const USAGE_BASELINE_SAMPLE_KEYS = Object.freeze([
    'observedCount', 'eligibleCount', 'ineligibleCount', 'missingCount',
    'exposureTotal', 'positiveCount', 'valueTotal',
]);
const USAGE_BASELINE_STATS_KEYS = Object.freeze([
    'median', 'p25', 'p75', 'p90', 'positiveMedian', 'positiveP75', 'mad',
    'iqr', 'sigma', 'p75Reference', 'p90Reference',
]);

const isObjectRecord = (value) => (
    !!value && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value, key) => (
    isObjectRecord(value) && Object.prototype.hasOwnProperty.call(value, key)
);

const hasExactKeys = (value, expectedKeys) => (
    isObjectRecord(value)
    && Object.keys(value).length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
);

const hasExactValue = (left, right) => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((entry, index) => hasExactValue(entry, right[index]));
    }
    if (isObjectRecord(left) || isObjectRecord(right)) {
        if (!isObjectRecord(left) || !isObjectRecord(right)) return false;
        const leftKeys = Object.keys(left).sort();
        const rightKeys = Object.keys(right).sort();
        return leftKeys.length === rightKeys.length
            && leftKeys.every((key, index) => (
                key === rightKeys[index] && hasExactValue(left[key], right[key])
            ));
    }
    return false;
};

const isNonNegativeNumber = (value) => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const getCompletedLocalDateStr = (now, ageDays) => {
    const date = new Date(now);
    if (Number.isNaN(date.getTime())) throw new Error('USAGE_BASELINE_NOW_INVALID');
    date.setDate(date.getDate() - ageDays);
    return getLocalDateStr(date);
};

const normalizePattern = (value) => normalizeDomain(
    typeof value === 'string' ? value.replace(/^\*\./, '') : value,
);

const resolveUsageBaselineStatus = (eligibleCount) => {
    if (eligibleCount < USAGE_BASELINE_POLICY.minSampleDays) {
        return USAGE_BASELINE_STATUS.SPARSE;
    }
    if (eligibleCount < USAGE_BASELINE_POLICY.stableSampleDays) {
        return USAGE_BASELINE_STATUS.FORMING;
    }
    return USAGE_BASELINE_STATUS.STABLE;
};

const collectDayDomainMinutes = (dayStats, matcher) => {
    const domains = dayStats?.domains;
    if (!isObjectRecord(domains)) {
        throw new Error('USAGE_BASELINE_DAY_DOMAINS_INVALID');
    }
    return Object.entries(domains).reduce((activeMs, [domain, data]) => {
        const hostname = normalizeDomain(domain);
        if (!hostname || !matcher(hostname)) return activeMs;
        if (!isObjectRecord(data)
            || !hasOwn(data, 'active')
            || typeof data.active !== 'number'
            || !Number.isFinite(data.active)
            || data.active < 0) {
            throw new Error(`USAGE_BASELINE_DAY_DOMAIN_ACTIVE_INVALID:${hostname}`);
        }
        return activeMs + data.active;
    }, 0) / MINUTE_MS;
};

const createUsageObservation = (dayStats, matcher) => {
    if (typeof dayStats === 'undefined') return UNOBSERVED_USAGE;
    if (!isObjectRecord(dayStats)) {
        throw new Error('USAGE_BASELINE_DAY_INVALID');
    }
    const minutes = collectDayDomainMinutes(dayStats, matcher);
    if (minutes <= 0) {
        return {
            observed: true,
            eligible: false,
            value: null,
            exposure: 0,
        };
    }
    return {
        observed: true,
        eligible: true,
        value: minutes,
        exposure: minutes,
    };
};

const buildUsageBaselineProfile = ({
    id,
    scope,
    observations,
}) => {
    const canonicalObservations = Object.freeze(observations.map((observation) => Object.freeze({
        observed: observation.observed,
        eligible: observation.eligible,
        value: observation.value,
        exposure: observation.exposure,
    })));
    const observationValues = Object.freeze(canonicalObservations.map((observation) => {
        if (!observation.observed) return null;
        return observation.eligible ? observation.value : 0;
    }));
    const profile = buildPersonalBaselineMetricProfile({
        id,
        kind: STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE,
        family: 'usage_duration',
        unit: 'minutes',
        grain: STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY,
        direction: STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS.HIGHER,
        scope,
        exposureUnit: 'minutes',
        observations: canonicalObservations,
        current: UNOBSERVED_USAGE,
        metricVersion: USAGE_BASELINE_METRIC_VERSION,
        policyVersion: USAGE_BASELINE_POLICY_VERSION,
        provenance: {
            source: 'stats_dates_domain_active',
            windowBasis: 'completed_day',
            excludeCurrent: true,
        },
        confidenceOptions: {
            targetDays: USAGE_BASELINE_POLICY.stableSampleDays,
        },
        confidenceGate: USAGE_BASELINE_POLICY.confidenceGate,
    });
    return Object.freeze({
        ...profile,
        status: resolveUsageBaselineStatus(profile.sample.eligibleCount),
        observationValues,
    });
};

const requireCanonicalUsageObservationValues = (observationValues) => {
    if (!Array.isArray(observationValues)
        || observationValues.length !== USAGE_BASELINE_POLICY.windowDays) {
        throw new Error('USAGE_BASELINE_OBSERVATION_VALUES_INVALID');
    }
    return observationValues.map((value) => {
        if (value === null) return { ...UNOBSERVED_USAGE };
        if (!isNonNegativeNumber(value) || Object.is(value, -0)) {
            throw new Error('USAGE_BASELINE_OBSERVATION_VALUES_INVALID');
        }
        if (value === 0) {
            return {
                observed: true,
                eligible: false,
                value: null,
                exposure: 0,
            };
        }
        return {
            observed: true,
            eligible: true,
            value,
            exposure: value,
        };
    });
};

const requireExpectedUsageBaselineIdentity = ({ metricId, scope } = {}) => {
    const managed = metricId === USAGE_BASELINE_METRIC_IDS.MANAGED_DAILY_MINUTES;
    const site = metricId === USAGE_BASELINE_METRIC_IDS.SITE_DAILY_MINUTES;
    const normalizedScope = managed ? scope : normalizeDomain(scope);
    if (
        (!managed && !site)
        || typeof scope !== 'string'
        || scope.length === 0
        || normalizedScope !== scope
        || (managed && scope !== 'managed')
    ) {
        throw new Error('USAGE_BASELINE_EXPECTED_IDENTITY_INVALID');
    }
    return { metricId, scope };
};

export function readUsageObservedBaseline(profile, expectedIdentity) {
    const expected = requireExpectedUsageBaselineIdentity(expectedIdentity);
    if (profile === null || typeof profile === 'undefined') return null;
    if (!hasExactKeys(profile, USAGE_BASELINE_PROFILE_KEYS)) {
        throw new Error('USAGE_BASELINE_PROFILE_SHAPE_INVALID');
    }
    const managed = profile.id === USAGE_BASELINE_METRIC_IDS.MANAGED_DAILY_MINUTES;
    const site = profile.id === USAGE_BASELINE_METRIC_IDS.SITE_DAILY_MINUTES;
    const scopeValid = managed
        ? profile.scope === 'managed'
        : site && normalizeDomain(profile.scope) === profile.scope;
    if (
        profile.role !== STATS_PERSONAL_BASELINE_ROLES.OBSERVED_BASELINE
        || profile.coreVersion !== STATS_PERSONAL_BASELINE_CORE_VERSION
        || profile.metricVersion !== USAGE_BASELINE_METRIC_VERSION
        || profile.policyVersion !== USAGE_BASELINE_POLICY_VERSION
        || (!managed && !site)
        || profile.kind !== STATS_PERSONAL_BASELINE_METRIC_KINDS.VALUE
        || profile.family !== 'usage_duration'
        || profile.unit !== 'minutes'
        || profile.grain !== STATS_PERSONAL_BASELINE_METRIC_GRAINS.DAY
        || profile.direction !== STATS_PERSONAL_BASELINE_METRIC_DIRECTIONS.HIGHER
        || !scopeValid
        || profile.exposureUnit !== 'minutes'
    ) {
        throw new Error('USAGE_BASELINE_IDENTITY_INVALID');
    }
    if (profile.id !== expected.metricId || profile.scope !== expected.scope) {
        throw new Error('USAGE_BASELINE_CONTEXT_MISMATCH');
    }
    if (
        !hasExactKeys(profile.provenance, ['source', 'windowBasis', 'excludeCurrent'])
        || profile.provenance.source !== 'stats_dates_domain_active'
        || profile.provenance.windowBasis !== 'completed_day'
        || profile.provenance.excludeCurrent !== true
    ) {
        throw new Error('USAGE_BASELINE_PROVENANCE_INVALID');
    }
    if (
        profile.currentValue !== null
        || profile.currentObserved !== false
        || profile.currentEligible !== false
        || profile.currentExposure !== 0
        || profile.anomalyScore !== 0
        || !hasExactKeys(profile.reference, [])
        || !hasExactKeys(profile.anomaly, ['score', 'ratio', 'robustZ'])
        || Object.values(profile.anomaly).some((value) => value !== 0)
    ) {
        throw new Error('USAGE_BASELINE_CURRENT_STATE_INVALID');
    }
    if (!hasExactKeys(profile.sample, USAGE_BASELINE_SAMPLE_KEYS)) {
        throw new Error('USAGE_BASELINE_SAMPLE_INVALID');
    }
    const sample = profile.sample;
    const countFields = [
        sample.observedCount,
        sample.eligibleCount,
        sample.ineligibleCount,
        sample.missingCount,
        sample.positiveCount,
    ];
    if (
        countFields.some((value) => !Number.isSafeInteger(value) || value < 0)
        || sample.observedCount + sample.missingCount !== USAGE_BASELINE_POLICY.windowDays
        || sample.eligibleCount + sample.ineligibleCount !== sample.observedCount
        || sample.positiveCount !== sample.eligibleCount
        || !isNonNegativeNumber(sample.exposureTotal)
        || !isNonNegativeNumber(sample.valueTotal)
        || sample.exposureTotal !== sample.valueTotal
        || (sample.eligibleCount > 0 && sample.valueTotal <= 0)
    ) {
        throw new Error('USAGE_BASELINE_SAMPLE_INVALID');
    }
    if (
        !hasExactKeys(profile.stats, USAGE_BASELINE_STATS_KEYS)
        || Object.values(profile.stats).some((value) => !isNonNegativeNumber(value))
    ) {
        throw new Error('USAGE_BASELINE_STATS_INVALID');
    }
    const stats = profile.stats;
    if (
        stats.p25 > stats.median
        || stats.median > stats.p75
        || stats.p75 > stats.p90
        || stats.positiveMedian !== stats.median
        || stats.positiveP75 !== stats.p75
        || stats.iqr !== stats.p75 - stats.p25
        || stats.p75Reference < stats.p75
        || stats.p90Reference < stats.p90
        || stats.p90Reference < stats.p75Reference
    ) {
        throw new Error('USAGE_BASELINE_STATS_RELATION_INVALID');
    }
    if (!Object.values(USAGE_BASELINE_STATUS).includes(profile.status)) {
        throw new Error('USAGE_BASELINE_STATUS_INVALID');
    }
    if (profile.status !== resolveUsageBaselineStatus(sample.eligibleCount)) {
        throw new Error('USAGE_BASELINE_STATUS_EVIDENCE_CONFLICT');
    }
    if (
        !isNonNegativeNumber(profile.confidence)
        || profile.confidence > 1
        || profile.confidenceGate !== USAGE_BASELINE_POLICY.confidenceGate
    ) {
        throw new Error('USAGE_BASELINE_CONFIDENCE_INVALID');
    }
    if (
        profile.status !== USAGE_BASELINE_STATUS.SPARSE
        && (!Number.isFinite(Number(profile.stats?.median)) || Number(profile.stats.median) <= 0)
    ) {
        throw new Error('USAGE_BASELINE_MEDIAN_INVALID');
    }
    const observations = requireCanonicalUsageObservationValues(profile.observationValues);
    const canonicalProfile = buildUsageBaselineProfile({
        id: expected.metricId,
        scope: expected.scope,
        observations,
    });
    if (!hasExactValue(profile, canonicalProfile)) {
        throw new Error('USAGE_BASELINE_DERIVATION_MISMATCH');
    }
    return profile;
}

export function buildUsageBaselines({
    stats = null,
    blockedUrls = [],
    siteLimits = {},
    now = Date.now(),
} = {}) {
    if (stats !== null && typeof stats !== 'undefined' && !isObjectRecord(stats)) {
        throw new Error('USAGE_BASELINE_STATS_INVALID');
    }
    if (isObjectRecord(stats) && (!hasOwn(stats, 'dates') || !isObjectRecord(stats.dates))) {
        throw new Error('USAGE_BASELINE_STATS_DATES_INVALID');
    }
    const dates = stats?.dates || {};
    const blockedPatterns = Array.from(new Set(
        (Array.isArray(blockedUrls) ? blockedUrls : [])
            .map(normalizePattern)
            .filter(Boolean),
    ));
    const siteDomains = Array.from(new Set(
        Object.entries(siteLimits || {})
            .filter(([domain, minutes]) => normalizeDomain(domain) && Number(minutes) > 0)
            .map(([domain]) => normalizeDomain(domain)),
    ));
    const globalObservations = [];
    const siteObservations = Object.fromEntries(siteDomains.map((domain) => [domain, []]));

    // Observations are always the same completed-day window. Engaged days are
    // eligible; observed zero-use days remain explicit but do not define the
    // user's typical engaged-day usage.
    for (let ageDays = 1; ageDays <= USAGE_BASELINE_POLICY.windowDays; ageDays += 1) {
        const dateStr = getCompletedLocalDateStr(now, ageDays);
        const dayStats = dates[dateStr];
        if (blockedPatterns.length > 0) {
            globalObservations.push(createUsageObservation(
                dayStats,
                (hostname) => blockedPatterns.some((pattern) => isHostnameMatch(hostname, pattern)),
            ));
        }
        siteDomains.forEach((siteDomain) => {
            siteObservations[siteDomain].push(createUsageObservation(
                dayStats,
                (hostname) => isHostnameMatch(hostname, siteDomain),
            ));
        });
    }

    return {
        global: blockedPatterns.length > 0
            ? buildUsageBaselineProfile({
                id: USAGE_BASELINE_METRIC_IDS.MANAGED_DAILY_MINUTES,
                scope: 'managed',
                observations: globalObservations,
            })
            : null,
        sites: Object.fromEntries(siteDomains.map((domain) => [
            domain,
            buildUsageBaselineProfile({
                id: USAGE_BASELINE_METRIC_IDS.SITE_DAILY_MINUTES,
                scope: domain,
                observations: siteObservations[domain],
            }),
        ])),
    };
}

export default buildUsageBaselines;
