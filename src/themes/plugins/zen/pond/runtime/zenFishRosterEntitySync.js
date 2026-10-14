import { KoiSimulationFish } from '../model/koi/KoiSimulationFish.js';
import { beginZenKoiRosterEntry, beginZenKoiRosterExit } from './zenKoiRosterTransit.js';
import { resolveZenInvitationKoiBounds } from './zenInvitationKoiPresentation.js';
import { beginZenFirstSiteKoiReveal } from './zenFirstSiteKoiReveal.js';
import {
    applyZenKoiFormationSpawn,
    buildZenKoiFormationProfileSignature,
    normalizeZenKoiFormationProfile,
} from '../model/koi/zenKoiFormationProfile.js';
import {
    normalizeZenKoiExpressionProfile,
} from '../roster/zenKoiExpressionProfile.js';

export const normalizeZenFishPresenceState = (value) => {
    if (typeof value !== 'string') return 'active';
    const normalized = value.trim().toLowerCase();
    return normalized === 'linger' || normalized === 'retiring' || normalized === 'active'
        ? normalized
        : 'active';
};

const normalizeSlot = (value) => {
    if (typeof value !== 'string') return 'resident';
    const normalized = value.trim().toLowerCase();
    return normalized === 'hero'
        || normalized === 'guardian'
        || normalized === 'resident'
        || normalized === 'scout'
        ? normalized
        : 'resident';
};

const applyRosterEntryToFish = ({
    fish,
    entry,
    applyDomainAppearanceToFish,
    isNewFish = false,
    width,
    height,
    spawnBounds = null,
} = {}) => {
    if (!fish || !entry) return fish;
    const presenceState = normalizeZenFishPresenceState(entry.presenceState);
    const nextDomain = typeof entry.domain === 'string' && entry.domain.trim()
        ? entry.domain.trim()
        : null;
    fish.entityId = typeof entry.entityId === 'string' && entry.entityId.trim()
        ? entry.entityId.trim()
        : (nextDomain
            ? nextDomain
            : fish.entityId || null);
    fish.domain = presenceState === 'retiring' ? null : nextDomain;
    fish.entityKind = typeof entry.entityKind === 'string' && entry.entityKind.trim()
        ? entry.entityKind.trim()
        : 'site';
    fish.interactionAction = typeof entry.interactionAction === 'string' && entry.interactionAction.trim()
        ? entry.interactionAction.trim()
        : null;
    if (presenceState !== 'retiring') {
        fish.retiringDomain = null;
        fish.visualLifecycleState = fish.rosterTransit?.kind === 'entering' ? 'entering' : 'active';
    } else if (nextDomain) {
        fish.retiringDomain = nextDomain;
        fish.visualLifecycleState = 'exiting';
    }
    fish.slot = normalizeSlot(entry.slot);
    if (typeof fish.applySlotMotionProfile === 'function') {
        fish.applySlotMotionProfile();
    }
    fish.presenceState = presenceState;
    fish.priority = Number.isFinite(Number(entry.priority))
        ? Number(entry.priority)
        : 0;
    fish.targetRisk = Number.isFinite(Number(entry.risk))
        ? Number(entry.risk)
        : fish.targetRisk;
    fish.status = typeof entry.status === 'string' && entry.status.trim()
        ? entry.status.trim()
        : fish.status;
    fish.expressionProfile = normalizeZenKoiExpressionProfile(entry.expressionProfile);
    const formationProfile = normalizeZenKoiFormationProfile(entry.formationProfile);
    const formationSignature = buildZenKoiFormationProfileSignature(formationProfile);
    fish.formationProfile = formationProfile;
    if (!formationProfile) {
        fish.formationSpawnSignature = '';
    }
    fish.opacity = fish.targetOpacity = 1;
    fish.opacityTransition = null;
    if (
        formationProfile
        && (isNewFish || fish.formationSpawnSignature !== formationSignature)
        && Number.isFinite(Number(width))
        && Number.isFinite(Number(height))
    ) {
        if (applyZenKoiFormationSpawn({ fish, width, height, frameCount: 0, spawnBounds })) {
            fish.formationSpawnSignature = formationSignature;
        }
    }
    if (entry.appearanceProfile && typeof fish.setAppearanceProfile === 'function') {
        fish.setAppearanceProfile(entry.appearanceProfile);
    } else if (typeof applyDomainAppearanceToFish === 'function' && fish.domain) {
        applyDomainAppearanceToFish(fish);
    }
    if (typeof fish.updateColor === 'function') {
        fish.updateColor();
    }
    return fish;
};

const matches = (fish, entry) => fish.entityId === (entry.entityId || entry.domain);
const spawnRosterFish = (entry, config, bounds, entering) => {
    const spawnBounds = entry.entityKind === 'invitation' ? resolveZenInvitationKoiBounds(bounds) : bounds;
    const fish = new KoiSimulationFish(config.width, config.height, entry.domain,
        entry.risk, entry.status, config.tuning, spawnBounds);
    applyRosterEntryToFish({ fish, entry, ...config, spawnBounds: bounds, isNewFish: true });
    fish.zenInvitationPondPatrol = entry.entityKind === 'invitation' && entering;
    if (entering && !fish.formationProfile) beginZenKoiRosterEntry(fish, bounds,
        entry.entityKind === 'invitation' ? { arrivalIdentity: `shadow:${fish.uid}` } : {});
    return fish;
};

const materializeInvitationAssignment = (fishRef, bounds) => {
    const state = fishRef.rosterLifecycle;
    const entry = state.entries.find(candidate => candidate.invitationAssignment
        && candidate.invitationAssignment.receiptId !== state.lastInvitationAssignmentReceiptId);
    const shadow = entry && fishRef.current.find(fish => fish.entityKind === 'invitation'
        && fish.entityId === entry.invitationAssignment.invitationEntityId
        && fish.rosterTransit?.kind !== 'exiting');
    if (!entry || !shadow) return;
    // A roster update may arrive before the command ACK. Remove that provisional
    // site fish, so the acknowledged site is revealed at the actual shadow pose.
    fishRef.current = fishRef.current.filter(fish => fish === shadow || !matches(fish, entry));
    applyRosterEntryToFish({ fish: shadow, entry, ...state.config, spawnBounds: bounds });
    shadow.zenKoiBehaviorMemory = null;
    shadow.zenKoiBehaviorMicroGoal = null;
    beginZenFirstSiteKoiReveal(shadow);
    state.lastInvitationAssignmentReceiptId = entry.invitationAssignment.receiptId;
};

// Desired membership is the latest worker roster, while crossing fish remain
// locally alive until their complete silhouette has crossed the bank.
export function advanceZenFishRosterLifecycle(fishRef, bounds, dimensions) {
    const state = fishRef.rosterLifecycle;
    if (!state) return;
    Object.assign(state.config, dimensions);
    if (fishRef.current.some(fish => fish.rosterTransit?.complete)) {
        fishRef.current = fishRef.current.filter(fish => !fish.rosterTransit?.complete);
    }
    if (fishRef.current.some(fish => fish.rosterTransit)) return;
    materializeInvitationAssignment(fishRef, bounds);
    const incoming = state.entries.find(entry => !fishRef.current.some(fish => matches(fish, entry)));
    if (incoming && fishRef.current.length < state.entries.length) {
        fishRef.current.push(spawnRosterFish(incoming, state.config, bounds, true));
        return;
    }
    const outgoing = fishRef.current.find(fish => !state.entries.some(entry => matches(fish, entry)));
    if (outgoing) {
        beginZenKoiRosterExit(outgoing, bounds);
        return;
    }
}

export const syncFishRoster = ({
    width, height, spawnBounds = null, fishRoster, tuning, fishRef,
    activityProfileByDomainRef, dummyFishRef, selectedFishUid,
    setSelectedFishUid, applyDomainAppearanceToFish,
    replacePopulation = false,
} = {}) => {
    if (!width || !height) return;
    const roster = Array.isArray(fishRoster) ? fishRoster : [];
    const entries = roster.filter(entry => normalizeZenFishPresenceState(entry.presenceState) !== 'retiring');
    const bounds = spawnBounds || { x: 0, y: 0, width, height, padding: 58 };
    const config = { width, height, tuning, applyDomainAppearanceToFish };
    const firstPopulation = !fishRef.rosterLifecycle && fishRef.current.length === 0;
    if (replacePopulation) fishRef.current = [];
    const lastInvitationAssignmentReceiptId = fishRef.rosterLifecycle?.lastInvitationAssignmentReceiptId ?? null;
    fishRef.rosterLifecycle = { entries, config, lastInvitationAssignmentReceiptId };
    if (activityProfileByDomainRef) {
        activityProfileByDomainRef.current = new Map(entries.filter(entry => entry.domain)
            .map(entry => [entry.domain, entry.activityProfile || null]));
    }
    // Only an explicit Main registration ACK assigns a shadow to a site.
    if (!firstPopulation && !replacePopulation) materializeInvitationAssignment(fishRef, bounds);
    for (const fish of fishRef.current) {
        if (fish.rosterTransit?.kind === 'exiting') continue;
        const entry = entries.find(candidate => matches(fish, candidate));
        if (entry) applyRosterEntryToFish({ fish, entry, ...config, spawnBounds: bounds });
        else {
            const retiringEntry = roster.find(candidate => matches(fish, candidate));
            if (retiringEntry) applyRosterEntryToFish({ fish, entry: retiringEntry, ...config, spawnBounds: bounds });
            if (fish.domain) fish.retiringDomain = fish.domain;
            fish.domain = null;
            fish.presenceState = 'retiring';
            if (!fish.rosterTransit) fish.visualLifecycleState = 'queued_exit';
            fish.labelOpacity = 0;
        }
    }
    // Opening an established pond keeps its initial composition. Live additions
    // are serialized offscreen, so only one new texture bundle needs admission.
    if (firstPopulation || replacePopulation) {
        fishRef.current = entries.filter(entry => entry.entityKind !== 'invitation'
            || entry.invitationArrivalMode === 'resident')
            .map(entry => spawnRosterFish(entry, config, bounds, false));
        // Covered scene reconstruction is not a new live registration event.
        const assignment = entries.find(entry => entry.invitationAssignment)?.invitationAssignment;
        if (assignment) fishRef.rosterLifecycle.lastInvitationAssignmentReceiptId = assignment.receiptId;
        advanceZenFishRosterLifecycle(fishRef, bounds, { width, height });
    } else {
        advanceZenFishRosterLifecycle(fishRef, bounds, { width, height });
    }
    dummyFishRef.current = [];
    if (selectedFishUid !== null && !fishRef.current.some(fish =>
        fish.uid === selectedFishUid && entries.some(entry => matches(fish, entry)))) {
        setSelectedFishUid(null);
    }
};
