import { useMemo } from 'react';

import { compileSakuraPhenotypeFromLatent } from '../../model/v2/SakuraCompiler.js';
import {
    normalizeZenBonsaiProfileActiveIdentity,
    resolveZenBonsaiProfileActiveIdentityFingerprint,
} from '../../model/ZenBonsaiProfileAggregateModel.js';
import { useZenBonsaiProfileAggregateState } from './useZenBonsaiProfileAggregateState.js';

const rejectPresentationIdentityMutation = () => {
    throw new Error('ZEN_BONSAI_PRESENTATION_IDENTITY_MUTATION_FORBIDDEN');
};

export function useZenBonsaiActiveProfileState({
    durableProfileRequired = true,
    presentationIdentity = null,
} = {}) {
    if (typeof durableProfileRequired !== 'boolean') {
        throw new Error('ZEN_BONSAI_DURABLE_PROFILE_REQUIREMENT_INVALID');
    }
    const profile = useZenBonsaiProfileAggregateState({
        enabled: durableProfileRequired,
    });
    if (durableProfileRequired && presentationIdentity !== null) {
        throw new Error('ZEN_BONSAI_DURABLE_PROFILE_PRESENTATION_IDENTITY_FORBIDDEN');
    }
    if (!durableProfileRequired && presentationIdentity === null) {
        throw new Error('ZEN_BONSAI_PRESENTATION_IDENTITY_REQUIRED');
    }
    const activeIdentity = durableProfileRequired
        ? (profile.aggregate?.activeIdentity || null)
        : normalizeZenBonsaiProfileActiveIdentity(presentationIdentity);
    if (profile.ready && activeIdentity === null) {
        throw new Error('ZEN_BONSAI_DURABLE_ACTIVE_IDENTITY_REQUIRED');
    }
    const sakuraV2Latent = activeIdentity?.canonicalLatent.values || null;
    const currentPhenotype = useMemo(
        () => (
            sakuraV2Latent === null
                ? null
                : compileSakuraPhenotypeFromLatent(sakuraV2Latent)
        ),
        [sakuraV2Latent],
    );
    const activeIdentityFingerprint = activeIdentity === null
        ? null
        : (durableProfileRequired
            ? profile.aggregate?.activeIdentityFingerprint
            : resolveZenBonsaiProfileActiveIdentityFingerprint(activeIdentity));

    return Object.freeze({
        profileReady: durableProfileRequired ? profile.ready : true,
        profileStatus: durableProfileRequired ? profile.status : 'ephemeral_presentation',
        profileEpoch: durableProfileRequired ? (profile.aggregate?.profileEpoch ?? null) : null,
        profileStateRevision: durableProfileRequired
            ? (profile.aggregate?.stateRevision ?? null)
            : null,
        activeIdentityFingerprint,
        activeIdentity,
        treeType: activeIdentity?.treeType ?? null,
        structureMode: activeIdentity?.structureMode ?? null,
        structureDepth: activeIdentity?.structureDepth ?? null,
        treeSeed: activeIdentity?.treeSeed ?? null,
        identityRevision: activeIdentity?.identityRevision ?? null,
        generationInputs: activeIdentity?.generationInputs ?? null,
        sakuraV2LatentState: Object.freeze({
            version: activeIdentity?.canonicalLatent.version ?? null,
            latent: sakuraV2Latent,
            learningAnchorLatent: sakuraV2Latent,
            updatedAt: 0,
        }),
        sakuraV2Latent,
        learningAnchorLatent: sakuraV2Latent,
        currentPhenotype,
        commitActiveIdentity: durableProfileRequired
            ? profile.commitActiveIdentity
            : rejectPresentationIdentityMutation,
        commitActiveIdentityPatch: durableProfileRequired
            ? profile.commitActiveIdentityPatch
            : rejectPresentationIdentityMutation,
    });
}

export default useZenBonsaiActiveProfileState;
