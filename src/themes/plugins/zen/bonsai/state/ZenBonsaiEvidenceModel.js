import {
    buildZenBonsaiLifecycleInputSignature,
} from '../../model/ZenBonsaiLifecycle.js';
import {
    isZenBonsaiEphemeralPresentationScene,
    isZenBonsaiFirstVisionPresentation,
} from '../../model/ZenBonsaiPresentationPolicy.js';

const isPlainObject = (value) => (
    value !== null
    && value !== undefined
    && typeof value === 'object'
    && !Array.isArray(value)
);

const hasTrustedEvidenceFlag = (input = null) => (
    input?.bonsaiEvidenceReady === true
);

export const hasAuthoritativeZenBonsaiEvidence = (input = null) => {
    if (!isPlainObject(input)) {
        return false;
    }
    if (
        isZenBonsaiFirstVisionPresentation(input)
        || isZenBonsaiEphemeralPresentationScene(input)
    ) {
        return true;
    }
    return hasTrustedEvidenceFlag(input);
};

export const buildZenBonsaiEvidenceSignature = (input = null) => (
    hasAuthoritativeZenBonsaiEvidence(input)
        ? buildZenBonsaiLifecycleInputSignature(input)
        : 'zen_bonsai_evidence:none'
);

export const buildZenBonsaiCultivationSiteSignature = (input = {}) => {
    if (typeof input?.registeredSiteSignature === 'string' && input.registeredSiteSignature.trim()) {
        return input.registeredSiteSignature.trim();
    }
    const explicitDomains = Array.isArray(input?.registeredSiteDomains)
        ? input.registeredSiteDomains
        : [];
    const domains = explicitDomains
        .map((domain) => (typeof domain === 'string' ? domain.trim().toLowerCase() : ''))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
    if (domains.length) {
        return domains.join(',');
    }
    return [
        Number(input?.registeredSiteGoalCount) || 0,
        Number(input?.registeredSiteRuleCount) || 0,
    ].join(':');
};

export const resolveZenBonsaiEvidenceModel = (input = null) => Object.freeze({
    authoritative: hasAuthoritativeZenBonsaiEvidence(input),
    signature: buildZenBonsaiEvidenceSignature(input),
    siteSignature: buildZenBonsaiCultivationSiteSignature(input || {}),
    input: hasAuthoritativeZenBonsaiEvidence(input) ? input : null,
});

export default resolveZenBonsaiEvidenceModel;
