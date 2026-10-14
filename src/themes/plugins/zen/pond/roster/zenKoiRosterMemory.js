import { normalizeZenKoiRosterSnapshot } from './zenKoiRosterContract.js';
import {
    buildZenKoiExpressionProfileSignature,
    normalizeZenKoiExpressionProfile,
} from './zenKoiExpressionProfile.js';

export const DEFAULT_ZEN_KOI_PRESENCE_LINGER_MS = 30 * 60 * 1000;
export const DEFAULT_ZEN_KOI_PRESENCE_RETIRING_MS = 90 * 60 * 1000;
export const DEFAULT_ZEN_KOI_MEMORY_RETENTION_MS = 5 * 24 * 60 * 60 * 1000;
export const DEFAULT_ZEN_KOI_REENTRY_GAP_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_ZEN_KOI_PRESENCE_MEMORY_MAX = 4;

export const EMPTY_ZEN_KOI_ROSTER_MEMORY = Object.freeze({});

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const isDeepCanonicalEqual = (left, right) => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((entry, index) => isDeepCanonicalEqual(entry, right[index]));
    }
    if (!isObject(left) || !isObject(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => (
            Object.prototype.hasOwnProperty.call(right, key)
            && isDeepCanonicalEqual(left[key], right[key])
        ));
};

const toText = (value, fallback = '') => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized || fallback;
};

const toOptionalText = (value) => {
    const normalized = toText(value, '');
    return normalized || null;
};

const toTimestamp = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0
        ? Math.max(0, Math.trunc(numeric))
        : null;
};

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const roundNumber = (value, digits = 3, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const normalizeSlot = (value) => {
    const normalized = toText(value, 'resident').toLowerCase();
    return normalized === 'hero'
        || normalized === 'guardian'
        || normalized === 'scout'
        || normalized === 'resident'
        ? normalized
        : 'resident';
};

const normalizePresenceState = (value) => {
    const normalized = toText(value, 'active').toLowerCase();
    return normalized === 'linger' || normalized === 'retiring' || normalized === 'active'
        ? normalized
        : 'active';
};

const normalizePolicyStatus = (value) => {
    const normalized = toText(value, 'allowed').toLowerCase();
    return normalized || 'allowed';
};

const normalizeCohort = (value) => {
    const normalized = toText(value, 'managed').toLowerCase();
    return normalized || 'managed';
};

const normalizeSignals = (signals = null) => {
    if (!isObject(signals)) return null;
    const numericKeys = [
        'todayActiveMs',
        'windowActiveMs',
        'recentAverageMs',
        'goalMinutes',
        'volatility',
        'trendRatio',
        'streakDays',
        'overLimitDays',
        'activeDays',
        'weightedPressureMs',
        'rawWindowMs',
        'pressureShare',
        'pressureRank',
        'pressureWindowDays',
    ];
    const next = {};
    for (let index = 0; index < numericKeys.length; index += 1) {
        const key = numericKeys[index];
        const rawValue = signals?.[key];
        if (rawValue === null || rawValue === undefined) continue;
        if (typeof rawValue === 'string' && !rawValue.trim()) continue;
        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) continue;
        next[key] = key.endsWith('Days') || key === 'goalMinutes' || key === 'pressureRank'
            ? Math.max(0, Math.floor(numeric))
            : roundNumber(numeric, key === 'pressureShare' ? 4 : 3, 0);
    }
    const pressureBasis = toOptionalText(signals.pressureBasis);
    if (pressureBasis) next.pressureBasis = pressureBasis;
    if (typeof signals.hasPressureInput === 'boolean') {
        next.hasPressureInput = signals.hasPressureInput;
    }
    return Object.keys(next).length > 0 ? next : null;
};

const normalizeActivityProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const quantile = Number(profile.quantile);
    if (!Number.isFinite(quantile)) return null;
    return {
        persisted: profile.persisted !== false,
        quantile: roundNumber(clampNumber(quantile, 0.0005, 0.9995, 0.5), 4, 0.5),
        boundDayIndex: Number.isFinite(Number(profile.boundDayIndex))
            ? Math.trunc(Number(profile.boundDayIndex))
            : null,
        rebindCount: Math.max(0, Math.floor(Number(profile.rebindCount) || 0)),
    };
};

const normalizeMemoryEntry = (domain, candidate = null) => {
    const normalizedDomain = toText(domain, '').toLowerCase();
    if (!normalizedDomain) return null;
    const source = isObject(candidate) ? candidate : {};
    return {
        domain: normalizedDomain,
        entityId: toOptionalText(source.entityId) || normalizedDomain,
        firstSeenAtMs: toTimestamp(source.firstSeenAtMs),
        lastRosterAtMs: toTimestamp(source.lastRosterAtMs),
        lastActiveAtMs: toTimestamp(source.lastActiveAtMs),
        lastSlot: normalizeSlot(source.lastSlot),
        lastCohort: normalizeCohort(source.lastCohort),
        lastPolicyStatus: normalizePolicyStatus(source.lastPolicyStatus),
        lastPresenceState: normalizePresenceState(source.lastPresenceState),
        lastRisk: roundNumber(clampNumber(source.lastRisk, 0, 1.2, 0), 3, 0),
        lastPriority: roundNumber(Number(source.lastPriority) || 0, 3, 0),
        lastSignals: normalizeSignals(source.lastSignals),
        lastActivityProfile: normalizeActivityProfile(source.lastActivityProfile),
        lastExpressionProfile: normalizeZenKoiExpressionProfile(source.lastExpressionProfile),
        reentryCount: Math.max(0, Math.floor(Number(source.reentryCount) || 0)),
    };
};

export const normalizeZenKoiRosterMemory = (candidate = null) => {
    if (!isObject(candidate)) return EMPTY_ZEN_KOI_ROSTER_MEMORY;
    const keys = Object.keys(candidate)
        .map((key) => toText(key, '').toLowerCase())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
    if (!keys.length) return EMPTY_ZEN_KOI_ROSTER_MEMORY;
    const next = {};
    for (let index = 0; index < keys.length; index += 1) {
        const domain = keys[index];
        const normalizedEntry = normalizeMemoryEntry(domain, candidate[domain]);
        if (!normalizedEntry) continue;
        next[domain] = normalizedEntry;
    }
    return Object.keys(next).length > 0 ? next : EMPTY_ZEN_KOI_ROSTER_MEMORY;
};

export const requireZenKoiRosterMemory = (candidate) => {
    if (!isObject(candidate)) {
        throw new Error('ZEN_KOI_ROSTER_MEMORY_STATE_INVALID');
    }
    const normalized = normalizeZenKoiRosterMemory(candidate);
    if (!isDeepCanonicalEqual(candidate, normalized)) {
        throw new Error('ZEN_KOI_ROSTER_MEMORY_STATE_INVALID');
    }
    return normalized;
};

export const buildZenKoiRosterMemorySignature = (candidate = null) => {
    const normalized = normalizeZenKoiRosterMemory(candidate);
    return Object.keys(normalized)
        .map((domain) => {
            const entry = normalized[domain];
            return [
                domain,
                entry.entityId || '',
                entry.firstSeenAtMs ?? '',
                entry.lastRosterAtMs ?? '',
                entry.lastActiveAtMs ?? '',
                entry.lastSlot,
                entry.lastCohort,
                entry.lastPolicyStatus,
                entry.lastPresenceState,
                roundNumber(entry.lastRisk, 3, 0),
                roundNumber(entry.lastPriority, 3, 0),
                entry.reentryCount,
                roundNumber(entry.lastActivityProfile?.quantile, 4, 0),
                entry.lastActivityProfile?.boundDayIndex ?? '',
                entry.lastActivityProfile?.rebindCount ?? '',
                buildZenKoiExpressionProfileSignature(entry.lastExpressionProfile),
            ].join(':');
        })
        .join('|');
};

const resolvePresenceState = ({
    ageMs,
    lingerMs,
    retiringMs,
} = {}) => {
    if (!Number.isFinite(ageMs) || ageMs < 0) return null;
    if (ageMs <= Math.max(0, Math.floor(Number(lingerMs) || 0))) return 'linger';
    if (ageMs <= Math.max(0, Math.floor(Number(lingerMs) || 0)) + Math.max(0, Math.floor(Number(retiringMs) || 0))) {
        return 'retiring';
    }
    return null;
};

const comparePresenceEntries = (left, right) => {
    const leftPresenceRank = left.presenceState === 'linger' ? 2 : 1;
    const rightPresenceRank = right.presenceState === 'linger' ? 2 : 1;
    const presenceDiff = rightPresenceRank - leftPresenceRank;
    if (presenceDiff !== 0) return presenceDiff;
    const priorityDiff = roundNumber(right.lastPriority, 3, 0) - roundNumber(left.lastPriority, 3, 0);
    if (priorityDiff !== 0) return priorityDiff;
    const activeDiff = (right.lastActiveAtMs || 0) - (left.lastActiveAtMs || 0);
    if (activeDiff !== 0) return activeDiff;
    const riskDiff = roundNumber(right.lastRisk, 3, 0) - roundNumber(left.lastRisk, 3, 0);
    if (riskDiff !== 0) return riskDiff;
    return String(left.domain || '').localeCompare(String(right.domain || ''));
};

export const buildZenKoiPresenceMemoryItems = ({
    memoryByDomain = null,
    activeDomains = null,
    nowMs = Date.now(),
    lingerMs = DEFAULT_ZEN_KOI_PRESENCE_LINGER_MS,
    retiringMs = DEFAULT_ZEN_KOI_PRESENCE_RETIRING_MS,
    maxCount = DEFAULT_ZEN_KOI_PRESENCE_MEMORY_MAX,
} = {}) => {
    const normalizedMemory = normalizeZenKoiRosterMemory(memoryByDomain);
    const activeDomainSet = activeDomains instanceof Set
        ? activeDomains
        : new Set(Array.isArray(activeDomains) ? activeDomains : []);
    const safeNowMs = toTimestamp(nowMs) || Date.now();
    const safeMaxCount = Math.max(0, Math.floor(Number(maxCount) || 0));
    if (!safeMaxCount) return [];

    const candidates = [];
    for (const domain of Object.keys(normalizedMemory)) {
        if (activeDomainSet.has(domain)) continue;
        const entry = normalizedMemory[domain];
        if (!entry) continue;
        const memorySlot = entry.lastSlot === 'scout'
            ? 'scout'
            : (entry.lastSlot === 'resident' || entry.lastSlot === 'hero'
                ? 'resident'
                : null);
        if (!memorySlot) continue;
        const ageMs = Number.isFinite(entry.lastActiveAtMs)
            ? Math.max(0, safeNowMs - entry.lastActiveAtMs)
            : Number.NaN;
        const presenceState = resolvePresenceState({
            ageMs,
            lingerMs,
            retiringMs,
        });
        if (!presenceState) continue;
        candidates.push({
            ...entry,
            slot: memorySlot,
            presenceState,
        });
    }

    return candidates
        .sort(comparePresenceEntries)
        .slice(0, safeMaxCount)
        .map((entry) => ({
            entityId: entry.entityId || entry.domain,
            domain: entry.domain,
            slot: entry.slot,
            cohort: entry.lastCohort,
            policyStatus: entry.lastPolicyStatus,
            presenceState: entry.presenceState,
            priority: roundNumber(
                entry.lastPriority * (entry.presenceState === 'linger' ? 0.72 : 0.38),
                3,
                0,
            ),
            risk: roundNumber(
                clampNumber(
                    entry.lastRisk * (entry.presenceState === 'linger' ? 0.92 : 0.62),
                    0,
                    1.2,
                    0,
                ),
                3,
                0,
            ),
            signals: entry.lastSignals,
            activityProfile: entry.lastActivityProfile,
            expressionProfile: entry.lastExpressionProfile,
        }));
};

const compareBootVisualMemoryEntries = (left, right) => {
    const rosterDiff = (right.lastRosterAtMs || 0) - (left.lastRosterAtMs || 0);
    if (rosterDiff !== 0) return rosterDiff;
    const priorityDiff = roundNumber(right.lastPriority, 3, 0) - roundNumber(left.lastPriority, 3, 0);
    if (priorityDiff !== 0) return priorityDiff;
    const activeDiff = (right.lastActiveAtMs || 0) - (left.lastActiveAtMs || 0);
    if (activeDiff !== 0) return activeDiff;
    return String(left.domain || '').localeCompare(String(right.domain || ''));
};

export const buildZenKoiBootVisualMemoryCandidates = ({
    memoryByDomain = null,
    maxCount = 6,
} = {}) => {
    const normalizedMemory = normalizeZenKoiRosterMemory(memoryByDomain);
    const entries = Object.keys(normalizedMemory)
        .map((domain) => normalizedMemory[domain])
        .filter((entry) => (
            entry?.domain
            && entry.domain !== 'self.entropy'
            && entry.entityId !== 'zen_self_core'
            && Number.isFinite(Number(entry.lastRosterAtMs))
        ));
    if (!entries.length) return [];
    const latestRosterAtMs = entries.reduce(
        (latest, entry) => Math.max(latest, Number(entry.lastRosterAtMs) || 0),
        0,
    );
    if (latestRosterAtMs <= 0) return [];
    const safeMaxCount = Math.max(0, Math.floor(Number(maxCount) || 0));
    if (!safeMaxCount) return [];

    return entries
        .filter((entry) => Number(entry.lastRosterAtMs) === latestRosterAtMs)
        .sort(compareBootVisualMemoryEntries)
        .slice(0, safeMaxCount)
        .map((entry, index) => ({
            domain: entry.domain,
            cohort: entry.lastCohort,
            policyStatus: entry.lastPolicyStatus,
            managed: entry.lastCohort !== 'unmanaged',
            blocked: entry.lastPolicyStatus === 'blocked' || entry.lastCohort === 'blocked',
            risk: entry.lastRisk,
            selectionScore: entry.lastPriority,
            visibleRank: index + 1,
            ...(entry.lastSignals || {}),
            hasPressureInput: entry.lastSignals?.hasPressureInput === true,
            pressureBasis: entry.lastSignals?.pressureBasis || 'boot_visual_roster_memory',
        }));
};

export const reconcileZenKoiRosterMemory = ({
    memoryByDomain = null,
    rosterSnapshot = null,
    nowMs = Date.now(),
    retentionMs = DEFAULT_ZEN_KOI_MEMORY_RETENTION_MS,
    reentryGapMs = DEFAULT_ZEN_KOI_REENTRY_GAP_MS,
} = {}) => {
    const normalizedMemory = normalizeZenKoiRosterMemory(memoryByDomain);
    const snapshot = normalizeZenKoiRosterSnapshot(rosterSnapshot);
    const safeNowMs = toTimestamp(nowMs) || Date.now();
    const safeRetentionMs = Math.max(0, Math.floor(Number(retentionMs) || 0));
    const safeReentryGapMs = Math.max(0, Math.floor(Number(reentryGapMs) || 0));
    const next = { ...normalizedMemory };

    for (let index = 0; index < snapshot.items.length; index += 1) {
        const item = snapshot.items[index];
        const domain = toText(item?.domain, '').toLowerCase();
        if (!domain) continue;
        const isActive = item?.presenceState === 'active';
        if (!isActive) continue;
        const previous = normalizeMemoryEntry(domain, next[domain]) || normalizeMemoryEntry(domain, null);
        const hadPreviousActive = Number.isFinite(previous?.lastActiveAtMs);
        const isReentry = Boolean(
            isActive
            && hadPreviousActive
            && previous.lastActiveAtMs !== null
            && (safeNowMs - previous.lastActiveAtMs) >= safeReentryGapMs,
        );
        next[domain] = normalizeMemoryEntry(domain, {
            ...previous,
            entityId: toOptionalText(item?.entityId) || previous?.entityId || domain,
            firstSeenAtMs: previous?.firstSeenAtMs || safeNowMs,
            lastRosterAtMs: safeNowMs,
            lastActiveAtMs: isActive ? safeNowMs : previous?.lastActiveAtMs,
            lastSlot: item?.slot || previous?.lastSlot,
            lastCohort: item?.cohort || previous?.lastCohort,
            lastPolicyStatus: item?.policyStatus || previous?.lastPolicyStatus,
            lastPresenceState: item?.presenceState || previous?.lastPresenceState,
            lastRisk: Number.isFinite(Number(item?.risk)) ? item.risk : previous?.lastRisk,
            lastPriority: Number.isFinite(Number(item?.priority)) ? item.priority : previous?.lastPriority,
            lastSignals: item?.signals || previous?.lastSignals,
            lastActivityProfile: item?.activityProfile || previous?.lastActivityProfile,
            lastExpressionProfile: item?.expressionProfile || previous?.lastExpressionProfile,
            reentryCount: Math.max(0, Math.floor(Number(previous?.reentryCount) || 0)) + (isReentry ? 1 : 0),
        });
    }

    const pruned = {};
    const cutoffNow = safeNowMs;
    for (const domain of Object.keys(next)) {
        const entry = normalizeMemoryEntry(domain, next[domain]);
        if (!entry) continue;
        const lastTouchedAtMs = Math.max(
            entry.lastActiveAtMs || 0,
            entry.lastRosterAtMs || 0,
            entry.firstSeenAtMs || 0,
        );
        if (safeRetentionMs > 0 && lastTouchedAtMs > 0 && (cutoffNow - lastTouchedAtMs) > safeRetentionMs) {
            continue;
        }
        pruned[domain] = entry;
    }

    return normalizeZenKoiRosterMemory(pruned);
};
