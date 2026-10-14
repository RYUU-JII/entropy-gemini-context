import { buildKoiDomainActivityProfileSnapshot } from '../runtime/zenKoiEnergyProfile.js';
import { normalizeZenKoiRosterSnapshot } from './zenKoiRosterContract.js';
import { normalizeZenKoiFormationProfile } from '../model/koi/zenKoiFormationProfile.js';
import { normalizeZenKoiExpressionProfile } from './zenKoiExpressionProfile.js';
import { ZEN_KOI_ENTITY_KINDS } from './zenKoiRosterEntityKind.js';
import { normalizeZenKoiInvitationAssignment } from './zenKoiInvitationAssignment.js';
import { normalizeZenKoiPresentationRole } from '../model/koi/zenKoiPresentationRole.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

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

const normalizeAppearanceProfile = (profile = null) => {
    if (!isObject(profile)) return null;
    const seed = Number(profile.seed);
    if (!Number.isFinite(seed)) return null;
    const paletteIndex = Number(profile.paletteIndex);
    return {
        seed: seed >>> 0,
        paletteIndex: Number.isFinite(paletteIndex) ? Math.max(0, Math.floor(paletteIndex)) : 0,
        appearanceMode: typeof profile.appearanceMode === 'string' ? profile.appearanceMode : null,
        presentationRole: normalizeZenKoiPresentationRole(profile.presentationRole),
        colorMix: Array.isArray(profile.colorMix)
            ? profile.colorMix
                .filter((entry) => isObject(entry) && typeof entry.hex === 'string')
                .map((entry) => ({
                    hex: entry.hex.trim(),
                    weight: roundNumber(clampNumber(entry.weight, 0, 1, 1), 3, 1),
                }))
            : [],
        breedMatch: isObject(profile.breedMatch)
            ? {
                id: typeof profile.breedMatch.id === 'string' ? profile.breedMatch.id : null,
                score: roundNumber(clampNumber(profile.breedMatch.score, 0, 1, 0), 3, 0),
                algoVersion: typeof profile.breedMatch.algoVersion === 'string'
                    ? profile.breedMatch.algoVersion
                    : null,
            }
            : null,
    };
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

export const projectZenKoiRosterSnapshotToWorkerFishRoster = ({
    rosterSnapshot = null,
    appearanceMap = null,
    dayIndex = null,
    maxFishCount = 72,
} = {}) => {
    const snapshot = normalizeZenKoiRosterSnapshot(rosterSnapshot);
    if (!snapshot.items.length) return [];
    const fishRoster = [];
    for (let i = 0; i < snapshot.items.length; i += 1) {
        const item = snapshot.items[i];
        const domain = typeof item.domain === 'string' ? item.domain.trim() : '';
        const isInvitation = item.entityKind === ZEN_KOI_ENTITY_KINDS.INVITATION;
        if (!domain && !isInvitation) continue;
        const risk = roundNumber(clampNumber(item.risk, 0, 1.2, 0), 3, 0);
        const appearanceFromMap = domain && isObject(appearanceMap?.[domain]) ? appearanceMap[domain] : null;
        fishRoster.push({
            entityId: item.entityId,
            domain: domain || null,
            entityKind: item.entityKind,
            ...(item.invitationAssignment ? { invitationAssignment: normalizeZenKoiInvitationAssignment(item.invitationAssignment) } : {}),
            ...(isInvitation ? { invitationArrivalMode: item.invitationArrivalMode } : {}),
            interactionAction: item.interactionAction,
            slot: item.slot,
            presenceState: item.presenceState,
            priority: roundNumber(item.priority, 3, 0),
            risk,
            status: typeof item.policyStatus === 'string' && item.policyStatus.trim()
                ? item.policyStatus.trim()
                : 'allowed',
            appearanceProfile: normalizeAppearanceProfile(appearanceFromMap || item.appearanceProfile),
            activityProfile: normalizeActivityProfile(item.activityProfile)
                || (domain ? buildKoiDomainActivityProfileSnapshot({
                    domain,
                    dayIndex,
                    risk,
                }) : null),
            expressionProfile: normalizeZenKoiExpressionProfile(item.expressionProfile),
            formationProfile: normalizeZenKoiFormationProfile(item.formationProfile),
        });
        if (fishRoster.length >= Math.max(1, Math.floor(Number(maxFishCount) || 72))) {
            break;
        }
    }
    return fishRoster;
};
