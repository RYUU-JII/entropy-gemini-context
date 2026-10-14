import {
    isProtectionRecommendedDomainCandidate,
    isVisibleProtectedDomainCandidate,
    selectVisibleDomainCandidates,
} from '@/domains/stats/analysis/index.js';
import { normalizeZenKoiRosterSnapshot } from './zenKoiRosterContract.js';
import { normalizeZenKoiInvitationAssignment } from './zenKoiInvitationAssignment.js';
import { normalizeZenKoiInvitationSlots } from './zenKoiInvitationSlots.js';
import { ZEN_SHADOW_SENTINEL_ROLE } from '../model/koi/zenKoiPresentationRole.js';
import {
    buildZenKoiDomainAppearanceIdentity,
} from './zenKoiDomainAppearanceIdentity.js';
import {
    ZEN_KOI_ENTITY_KINDS,
    ZEN_KOI_INTERACTION_ACTIONS,
} from './zenKoiRosterEntityKind.js';
import {
    buildZenKoiExpressionProfile,
    normalizeZenKoiExpressionProfile,
} from './zenKoiExpressionProfile.js';
import {
    requireKoiActivityProfileSnapshot,
} from '../runtime/workerSafe/zenKoiEnergyMath.js';

const DEFAULT_POLICY_ID = 'zen_koi_roster_policy_v1';
const BOOT_VISUAL_ROSTER_MEMORY_POLICY_ID = 'zen_koi_roster_boot_visual_roster_memory_v1';
const DEFAULT_INTERACTIVE_MAX = 5;
const ROSTER_SOURCE_STATS_DOMAIN_CANDIDATES = 'stats_domain_candidates';
const ROSTER_SOURCE_BOOT_VISUAL_ROSTER_MEMORY = 'boot_visual_roster_memory';
const ROSTER_SOURCE_EXPERIMENT_SYNTHETIC_DOMAIN_CANDIDATES = 'experiment_synthetic_domain_candidates';
const ROSTER_SOURCE_FIRST_VISION_PRESENTATION = 'first_vision_presentation';
const KNOWN_ROSTER_SOURCES = Object.freeze([
    ROSTER_SOURCE_BOOT_VISUAL_ROSTER_MEMORY,
    ROSTER_SOURCE_EXPERIMENT_SYNTHETIC_DOMAIN_CANDIDATES,
    ROSTER_SOURCE_FIRST_VISION_PRESENTATION,
    ROSTER_SOURCE_STATS_DOMAIN_CANDIDATES,
]);

const normalizeDomain = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const normalizeRosterSource = (value) => (
    KNOWN_ROSTER_SOURCES.includes(value)
        ? value
        : ROSTER_SOURCE_STATS_DOMAIN_CANDIDATES
);

const toNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const roundNumber = (value, digits = 3, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const clampNumber = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const isFiniteInput = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && !value.trim()) return false;
    return Number.isFinite(Number(value));
};

const normalizeCandidate = (
    candidate = null,
    {
        requireSyntheticActivityProfile = false,
    } = {},
) => {
    const domain = normalizeDomain(candidate?.domain);
    if (!domain) return null;
    const cohort = typeof candidate?.cohort === 'string' && candidate.cohort.trim()
        ? candidate.cohort.trim()
        : 'managed';
    const explicitHasPressureInput = typeof candidate?.hasPressureInput === 'boolean'
        ? candidate.hasPressureInput
        : null;
    const inferredHasPressureInput = isFiniteInput(candidate?.weightedPressureMs)
        || isFiniteInput(candidate?.pressureShare)
        || isFiniteInput(candidate?.pressureRank);
    const hasPressureInput = explicitHasPressureInput ?? inferredHasPressureInput;
    const pressureRank = hasPressureInput && isFiniteInput(candidate?.pressureRank)
        ? Math.max(1, Math.floor(Number(candidate.pressureRank)))
        : null;
    const activityProfile = requireSyntheticActivityProfile
        ? requireKoiActivityProfileSnapshot(candidate?.activityProfile, {
            domain,
        })
        : null;
    return {
        domain,
        cohort,
        policyStatus: candidate?.policyStatus === 'blocked' ? 'blocked' : 'allowed',
        blocked: candidate?.blocked === true || cohort === 'blocked',
        managed: candidate?.managed !== false || cohort !== 'unmanaged',
        windowActiveMs: Math.max(0, toNumber(candidate?.windowActiveMs)),
        todayActiveMs: Math.max(0, toNumber(candidate?.todayActiveMs)),
        recentAverageMs: Math.max(0, toNumber(candidate?.recentAverageMs)),
        goalMinutes: Math.max(0, Math.floor(toNumber(candidate?.goalMinutes))),
        risk: roundNumber(clampNumber(candidate?.risk, 0, 1.2, 0), 3, 0),
        trendRatio: roundNumber(Math.max(0, toNumber(candidate?.trendRatio)), 3, 0),
        volatility: roundNumber(clampNumber(candidate?.volatility, 0, 1.5, 0), 3, 0),
        activeDays: Math.max(0, Math.floor(toNumber(candidate?.activeDays))),
        streakDays: Math.max(0, Math.floor(toNumber(candidate?.streakDays))),
        overLimitDays: Math.max(0, Math.floor(toNumber(candidate?.overLimitDays))),
        selectionScore: roundNumber(Math.max(0, toNumber(candidate?.selectionScore)), 4, 0),
        visibleUsageMs: Math.max(0, toNumber(candidate?.visibleUsageMs)),
        weightedPressureMs: Math.max(0, toNumber(candidate?.weightedPressureMs)),
        rawWindowMs: Math.max(0, toNumber(candidate?.rawWindowMs)),
        pressureShare: roundNumber(clampNumber(candidate?.pressureShare, 0, 1, 0), 4, 0),
        pressureRank,
        pressureBasis: hasPressureInput && typeof candidate?.pressureBasis === 'string' && candidate.pressureBasis.trim()
            ? candidate.pressureBasis.trim()
            : null,
        pressureWindowDays: hasPressureInput
            ? Math.max(0, Math.floor(toNumber(candidate?.pressureWindowDays)))
            : 0,
        hasPressureInput,
        activityProfile,
        // Stamped by selectVisibleDomainCandidates; its presence marks an
        // already-resolved canonical list so we don't select a second time.
        visibleRank: Number.isFinite(Number(candidate?.visibleRank))
            ? Math.max(1, Math.floor(Number(candidate.visibleRank)))
            : null,
    };
};

const resolveRosterSlot = (candidate = null, focusDomain = '') => {
    if (candidate?.domain === focusDomain) return 'hero';
    if (isVisibleProtectedDomainCandidate(candidate)) return 'guardian';
    if (isProtectionRecommendedDomainCandidate(candidate)) return 'scout';
    return 'resident';
};

const resolveRosterPriorityBoost = (candidate = null, focusDomain = '') => {
    if (candidate?.domain === focusDomain) return 100;
    if (isVisibleProtectedDomainCandidate(candidate)) return 30;
    if (isProtectionRecommendedDomainCandidate(candidate)) return 4;
    return 0;
};

const buildRosterItem = (candidate, {
    slot = 'resident',
    priorityBoost = 0,
    presenceState = 'active',
    entityId = candidate.domain,
    signals = null,
    activityProfile = null,
    expressionProfile = null,
} = {}) => ({
    entityId,
    domain: candidate.domain,
    entityKind: ZEN_KOI_ENTITY_KINDS.SITE,
    slot,
    cohort: candidate.cohort,
    policyStatus: candidate.policyStatus,
    presenceState,
    priority: roundNumber(candidate.selectionScore + priorityBoost, 4, 0),
    risk: candidate.risk,
    appearanceProfile: buildZenKoiDomainAppearanceIdentity(candidate.domain),
    signals: signals || {
        todayActiveMs: candidate.todayActiveMs,
        windowActiveMs: candidate.windowActiveMs,
        recentAverageMs: candidate.recentAverageMs,
        goalMinutes: candidate.goalMinutes,
        volatility: candidate.volatility,
        trendRatio: candidate.trendRatio,
        streakDays: candidate.streakDays,
        overLimitDays: candidate.overLimitDays,
        activeDays: candidate.activeDays,
        weightedPressureMs: candidate.weightedPressureMs,
        rawWindowMs: candidate.rawWindowMs,
        pressureShare: candidate.pressureShare,
        pressureRank: candidate.pressureRank,
        pressureBasis: candidate.pressureBasis,
        pressureWindowDays: candidate.pressureWindowDays,
        hasPressureInput: candidate.hasPressureInput,
    },
    activityProfile,
    expressionProfile: normalizeZenKoiExpressionProfile(expressionProfile),
});

const buildInvitationKoiRosterItem = ({ entityId, arrivalMode, interactionEnabled = true }) => ({
    entityId,
    invitationArrivalMode: arrivalMode,
    domain: null,
    entityKind: ZEN_KOI_ENTITY_KINDS.INVITATION,
    interactionAction: interactionEnabled
        ? ZEN_KOI_INTERACTION_ACTIONS.REGISTER_PROTECTED_SITE
        : null,
    slot: 'hero',
    cohort: 'invitation',
    policyStatus: 'invitation',
    presenceState: 'active',
    priority: 100,
    risk: 0.08,
    appearanceProfile: {
        seed: 0x15201E,
        paletteIndex: 0,
        presentationRole: ZEN_SHADOW_SENTINEL_ROLE,
        appearanceMode: 'off',
        colorMix: [],
        breedMatch: null,
    },
    activityProfile: {
        persisted: false,
        quantile: 0.56,
        boundDayIndex: null,
        rebindCount: 0,
    },
});

export const buildZenKoiRosterSnapshot = ({
    domainCandidates = [],
    focusDomain = null,
    interactiveMax = DEFAULT_INTERACTIVE_MAX,
    memoryByDomain = null,
    nowMs = Date.now(),
    rosterSource = 'stats_domain_candidates',
    invitationSlots = [],
    invitationInteractionEnabled = true,
    invitationAssignment = null,
} = {}) => {
    const normalizedRosterSource = normalizeRosterSource(rosterSource);
    const assignment = normalizeZenKoiInvitationAssignment(invitationAssignment);
    const slots = normalizeZenKoiInvitationSlots(invitationSlots);
    const useExperimentSynthetic = (
        normalizedRosterSource
        === ROSTER_SOURCE_EXPERIMENT_SYNTHETIC_DOMAIN_CANDIDATES
    );
    const normalizedCandidates = Array.isArray(domainCandidates)
        ? domainCandidates
            .map((candidate) => normalizeCandidate(candidate, {
                requireSyntheticActivityProfile: useExperimentSynthetic,
            }))
            .filter(Boolean)
        : [];
    const normalizedFocusDomain = normalizeDomain(focusDomain);
    const numericInteractiveMax = Number(interactiveMax);
    const maxCount = Number.isFinite(numericInteractiveMax)
        ? Math.max(0, Math.floor(numericInteractiveMax))
        : DEFAULT_INTERACTIVE_MAX;

    const isPreselected = normalizedCandidates.length > 0
        && normalizedCandidates.every((candidate) => Number.isFinite(candidate.visibleRank));
    const selectedCandidates = isPreselected
        ? normalizedCandidates
            .slice()
            .sort((left, right) => left.visibleRank - right.visibleRank)
            .slice(0, maxCount)
        : selectVisibleDomainCandidates(normalizedCandidates, {
            maxCount,
            focusDomain: normalizedFocusDomain,
        });
    const memorySource = memoryByDomain && typeof memoryByDomain === 'object'
        ? memoryByDomain
        : {};
    const useBootVisualMemory = normalizedRosterSource === ROSTER_SOURCE_BOOT_VISUAL_ROSTER_MEMORY;

    const siteItems = selectedCandidates.map((candidate) => {
        const previousMemory = memorySource?.[candidate.domain] || null;
        const previousExpressionProfile = normalizeZenKoiExpressionProfile(
            previousMemory?.lastExpressionProfile,
        );
        const visualCandidate = useBootVisualMemory && previousMemory
            ? {
                ...candidate,
                risk: previousMemory.lastRisk,
                selectionScore: Math.max(candidate.selectionScore, previousMemory.lastPriority),
            }
            : candidate;
        return buildRosterItem(visualCandidate, {
            slot: resolveRosterSlot(visualCandidate, normalizedFocusDomain),
            priorityBoost: resolveRosterPriorityBoost(visualCandidate, normalizedFocusDomain),
            entityId: previousMemory?.entityId || visualCandidate.domain,
            signals: useBootVisualMemory ? previousMemory?.lastSignals : null,
            activityProfile: useExperimentSynthetic
                ? visualCandidate.activityProfile
                : (previousMemory?.lastActivityProfile || null),
            expressionProfile: buildZenKoiExpressionProfile({
                candidate: visualCandidate,
                previousExpressionProfile,
                nowMs,
            }),
        });
    });

    const assignedSiteItems = siteItems.map(item => assignment?.domain === item.domain
        ? { ...item, invitationAssignment: assignment } : item);
    const items = [...assignedSiteItems, ...slots.map(slot => buildInvitationKoiRosterItem({
        ...slot, interactionEnabled: invitationInteractionEnabled,
    }))];
    const activeItemCount = items.length;

    return normalizeZenKoiRosterSnapshot({
        policyId: useBootVisualMemory ? BOOT_VISUAL_ROSTER_MEMORY_POLICY_ID : DEFAULT_POLICY_ID,
        focusDomain: normalizedFocusDomain || null,
        capacity: {
            interactiveTarget: activeItemCount,
            // Representative sites and the currently unused registration slots.
            interactiveMax: maxCount + slots.length,
        },
        items,
    });
};
