import { buildZenFirstVisionKoiRosterSnapshot } from './zenFirstVisionKoiRoster.js';
import { buildZenKoiRosterSnapshot } from './zenKoiRosterPolicy.js';

export const ZEN_KOI_PRESENTATION_MODE = Object.freeze({
    REALITY: 'reality',
    FIRST_VISION: 'first-vision',
});

export const normalizeZenKoiPresentationMode = (value) => (
    Object.values(ZEN_KOI_PRESENTATION_MODE).includes(value)
        ? value
        : ZEN_KOI_PRESENTATION_MODE.REALITY
);

export const shouldObserveZenKoiRosterMemory = (presentationMode) => (
    normalizeZenKoiPresentationMode(presentationMode) === ZEN_KOI_PRESENTATION_MODE.REALITY
);

export const buildZenKoiRosterFrame = ({
    domainCandidates = [],
    focusDomain = null,
    memoryByDomain = null,
    nowMs = Date.now(),
    presentationMode = ZEN_KOI_PRESENTATION_MODE.REALITY,
    rosterSource = 'stats_domain_candidates',
    invitationSlots = [],
    invitationInteractionEnabled = true,
    invitationAssignment = null,
} = {}) => {
    const resolvedPresentationMode = normalizeZenKoiPresentationMode(presentationMode);
    if (resolvedPresentationMode === ZEN_KOI_PRESENTATION_MODE.FIRST_VISION) {
        return buildZenFirstVisionKoiRosterSnapshot();
    }
    return buildZenKoiRosterSnapshot({
        domainCandidates,
        focusDomain,
        memoryByDomain,
        nowMs,
        rosterSource,
        invitationSlots,
        invitationInteractionEnabled,
        invitationAssignment,
    });
};
