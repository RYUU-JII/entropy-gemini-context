import { normalizeZenKoiPresentationRole } from '../model/koi/zenKoiPresentationRole.js';
import { normalizeZenKoiInvitationAssignment } from './zenKoiInvitationAssignment.js';
import { normalizeZenKoiInvitationArrivalMode } from './zenKoiInvitationSlots.js';
import {
    buildZenKoiFormationProfileSignature,
    normalizeZenKoiFormationProfile,
} from '../model/koi/zenKoiFormationProfile.js';
import {
    buildZenKoiExpressionProfileSignature,
    normalizeZenKoiExpressionProfile,
} from './zenKoiExpressionProfile.js';
import {
    normalizeZenKoiEntityKind,
    normalizeZenKoiInteractionAction,
    ZEN_KOI_ENTITY_KINDS,
} from './zenKoiRosterEntityKind.js';

const DEFAULT_ZEN_KOI_ROSTER_POLICY_ID = 'zen_koi_roster_snapshot_v1';
const DEFAULT_KOI_SLOT = 'resident';
const DEFAULT_POLICY_STATUS = 'allowed';
const DEFAULT_PRESENCE_STATE = 'active';
const DEFAULT_COHORT = 'managed';
const EMPTY_ITEMS = Object.freeze([]);
const EMPTY_CAPACITY = Object.freeze({
    interactiveTarget: 0,
    interactiveMax: 0,
});

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toNullableText = (value) => {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text || null;
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

const toOptionalInteger = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
};

const normalizeSlot = (value) => (
    toNullableText(value) || DEFAULT_KOI_SLOT
);

const normalizePolicyStatus = (value) => (
    toNullableText(value) || DEFAULT_POLICY_STATUS
);

const normalizePresenceState = (value) => (
    toNullableText(value) || DEFAULT_PRESENCE_STATE
);

const normalizeCohort = (value) => (
    toNullableText(value) || DEFAULT_COHORT
);

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
    const pressureBasis = toNullableText(signals.pressureBasis);
    if (pressureBasis) next.pressureBasis = pressureBasis;
    if (typeof signals.hasPressureInput === 'boolean') {
        next.hasPressureInput = signals.hasPressureInput;
    }
    return Object.keys(next).length > 0 ? next : null;
};

const normalizeAppearanceProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const seed = Number(profile.seed);
    if (!Number.isFinite(seed)) return null;
    const paletteIndex = Number(profile.paletteIndex);
    const colorMix = Array.isArray(profile.colorMix)
        ? profile.colorMix
            .map((entry) => {
                if (!isObject(entry)) return null;
                const hex = toNullableText(entry.hex);
                if (!hex) return null;
                return {
                    hex,
                    weight: roundNumber(clampNumber(entry.weight, 0, 1, 1), 3, 1),
                };
            })
            .filter(Boolean)
        : [];
    const breedMatch = isObject(profile.breedMatch)
        ? {
            id: toNullableText(profile.breedMatch.id),
            score: roundNumber(clampNumber(profile.breedMatch.score, 0, 1, 0), 3, 0),
            algoVersion: toNullableText(profile.breedMatch.algoVersion),
        }
        : null;
    return {
        seed: seed >>> 0,
        paletteIndex: Number.isFinite(paletteIndex) ? Math.max(0, Math.floor(paletteIndex)) : 0,
        appearanceMode: toNullableText(profile.appearanceMode),
        presentationRole: normalizeZenKoiPresentationRole(profile.presentationRole),
        colorMix,
        breedMatch,
    };
};

const normalizeActivityProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const quantile = Number(profile.quantile);
    if (!Number.isFinite(quantile)) return null;
    return {
        persisted: profile.persisted !== false,
        quantile: roundNumber(clampNumber(quantile, 0.0005, 0.9995, 0.5), 4, 0.5),
        boundDayIndex: toOptionalInteger(profile.boundDayIndex),
        rebindCount: Math.max(0, Math.floor(Number(profile.rebindCount) || 0)),
    };
};

const normalizeCapacity = (capacity = null, itemCount = 0) => {
    const safeCount = Math.max(0, Math.floor(Number(itemCount) || 0));
    if (!isObject(capacity)) {
        return {
            interactiveTarget: safeCount,
            interactiveMax: safeCount,
        };
    }
    const rawInteractiveTarget = Number(capacity.interactiveTarget);
    const rawInteractiveMax = Number(capacity.interactiveMax);
    return {
        interactiveTarget: Number.isFinite(rawInteractiveTarget)
            ? Math.max(0, Math.floor(rawInteractiveTarget))
            : safeCount,
        interactiveMax: Number.isFinite(rawInteractiveMax)
            ? Math.max(0, Math.floor(rawInteractiveMax))
            : safeCount,
    };
};

const normalizeRosterItem = (candidate, index) => {
    if (!isObject(candidate)) return null;
    const inferredEntityKind = candidate.cohort === 'vision'
        ? ZEN_KOI_ENTITY_KINDS.VISION
        : ZEN_KOI_ENTITY_KINDS.SITE;
    const entityKind = normalizeZenKoiEntityKind(candidate.entityKind, {
        fallback: inferredEntityKind,
    });
    const isInvitation = entityKind === ZEN_KOI_ENTITY_KINDS.INVITATION;
    const domain = toNullableText(candidate.domain);
    if (!domain && !isInvitation) return null;
    if (isInvitation && !toNullableText(candidate.entityId)) throw new Error('ZEN_KOI_INVITATION_ENTITY_ID_REQUIRED');
    const entityId = toNullableText(candidate.entityId)
        || `${domain}#${Math.max(0, Math.floor(Number(index) || 0))}`;
    const resonanceDomain = toNullableText(candidate.resonanceDomain);
    const item = {
        entityId,
        domain,
        entityKind,
        interactionAction: normalizeZenKoiInteractionAction(candidate.interactionAction),
        slot: normalizeSlot(candidate.slot),
        cohort: normalizeCohort(candidate.cohort),
        policyStatus: normalizePolicyStatus(candidate.policyStatus ?? candidate.status),
        presenceState: normalizePresenceState(candidate.presenceState),
        priority: roundNumber(Number(candidate.priority) || 0, 3, 0),
        risk: roundNumber(clampNumber(candidate.risk, 0, 1.2, 0), 3, 0),
        signals: normalizeSignals(candidate.signals),
        appearanceProfile: normalizeAppearanceProfile(candidate.appearanceProfile),
        activityProfile: normalizeActivityProfile(candidate.activityProfile),
        expressionProfile: normalizeZenKoiExpressionProfile(candidate.expressionProfile),
        formationProfile: normalizeZenKoiFormationProfile(candidate.formationProfile),
    };
    if (resonanceDomain) item.resonanceDomain = resonanceDomain;
    if (isInvitation) item.invitationArrivalMode = normalizeZenKoiInvitationArrivalMode(candidate.invitationArrivalMode);
    const assignment = normalizeZenKoiInvitationAssignment(candidate.invitationAssignment);
    if (assignment) {
        if (entityKind !== 'site' || assignment.domain !== domain) throw new Error('ZEN_KOI_INVITATION_ASSIGNMENT_SITE_MISMATCH');
        item.invitationAssignment = assignment;
    }
    return item;
};

const normalizeSnapshotCore = (candidate = null) => {
    if (!isObject(candidate)) {
        return {
            version: 1,
            snapshotId: '',
            policyId: DEFAULT_ZEN_KOI_ROSTER_POLICY_ID,
            focusDomain: null,
            capacity: EMPTY_CAPACITY,
            items: EMPTY_ITEMS,
        };
    }
    const items = Array.isArray(candidate.items)
        ? candidate.items
            .map((item, index) => normalizeRosterItem(item, index))
            .filter(Boolean)
        : [];
    return {
        version: 1,
        snapshotId: toNullableText(candidate.snapshotId) || '',
        policyId: toNullableText(candidate.policyId) || DEFAULT_ZEN_KOI_ROSTER_POLICY_ID,
        focusDomain: toNullableText(candidate.focusDomain),
        capacity: normalizeCapacity(candidate.capacity, items.length),
        items,
    };
};

const buildSignatureFromNormalizedSnapshot = (snapshot) => {
    const itemsSignature = Array.isArray(snapshot?.items)
        ? snapshot.items
            .map((item) => {
                const appearanceProfile = item?.appearanceProfile || null;
                const activityProfile = item?.activityProfile || null;
                return [
                    item?.entityId || '',
                    item?.domain || '',
                    item?.entityKind || '',
                    item?.interactionAction || '',
                    item?.slot || '',
                    item?.cohort || '',
                    item?.policyStatus || '',
                    item?.presenceState || '',
                    roundNumber(item?.priority, 3, 0),
                    roundNumber(item?.risk, 3, 0),
                    Number(appearanceProfile?.seed) || 0,
                    appearanceProfile?.presentationRole ?? '',
                    Number.isFinite(Number(appearanceProfile?.paletteIndex))
                        ? Math.max(0, Math.floor(Number(appearanceProfile.paletteIndex)))
                        : '',
                    roundNumber(activityProfile?.quantile, 4, 0),
                    activityProfile?.boundDayIndex ?? '',
                    Math.max(0, Math.floor(Number(activityProfile?.rebindCount) || 0)),
                    buildZenKoiExpressionProfileSignature(item?.expressionProfile),
                    buildZenKoiFormationProfileSignature(item?.formationProfile),
                    item?.invitationAssignment?.receiptId ?? '',
                    item?.invitationAssignment?.invitationEntityId ?? '',
                    item?.invitationArrivalMode ?? '',
                ].join(':');
            })
            .join('|')
        : '';
    return [
        `policy:${snapshot?.policyId || DEFAULT_ZEN_KOI_ROSTER_POLICY_ID}`,
        `focus:${snapshot?.focusDomain || ''}`,
        `target:${Math.max(0, Math.floor(Number(snapshot?.capacity?.interactiveTarget) || 0))}`,
        `max:${Math.max(0, Math.floor(Number(snapshot?.capacity?.interactiveMax) || 0))}`,
        `items:${itemsSignature}`,
    ].join('|');
};

export const buildZenKoiRosterSnapshotSignature = (candidate = null) => (
    buildSignatureFromNormalizedSnapshot(normalizeSnapshotCore(candidate))
);

export const normalizeZenKoiRosterSnapshot = (candidate = null) => {
    const normalized = normalizeSnapshotCore(candidate);
    const signature = buildSignatureFromNormalizedSnapshot(normalized);
    return {
        ...normalized,
        snapshotId: normalized.snapshotId || signature || 'zen_koi_roster:empty',
        signature: signature || 'zen_koi_roster:empty',
    };
};

export const EMPTY_ZEN_KOI_ROSTER_SNAPSHOT = Object.freeze(
    normalizeZenKoiRosterSnapshot({
        snapshotId: 'zen_koi_roster:empty',
        items: [],
        capacity: EMPTY_CAPACITY,
    }),
);

export const resolveZenKoiRosterSnapshotDomains = (snapshot = null) => {
    const normalized = normalizeZenKoiRosterSnapshot(snapshot);
    return normalized.items.map((item) => item.domain).filter(Boolean);
};

export {
    DEFAULT_ZEN_KOI_ROSTER_POLICY_ID,
};
