import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
    STRUCTURE_MODE,
    clampStructureDepth,
    getStructureDepthRange,
    validateStructureDepthForMode,
} from '../../model/ZenCoreConfig.js';
import { compileSakuraPhenotypeFromLatent } from '../../model/v2/SakuraCompiler.js';
import {
    validateSakuraLatent,
} from '../../model/v2/SakuraLatentSchema.js';
import {
    normalizeZenBonsaiProfileActiveIdentityInput,
    resolveZenBonsaiProfileActiveIdentityFingerprint,
} from '../../model/ZenBonsaiProfileAggregateModel.js';
import { useZenBonsaiActiveProfileState } from './useZenBonsaiActiveProfileState.js';

const stripIdentityRevision = (identity) => {
    const { identityRevision: _discardedRevision, ...identityInput } = identity;
    return identityInput;
};

const resolveNextValue = (nextValue, currentValue) => (
    typeof nextValue === 'function' ? nextValue(currentValue) : nextValue
);

const normalizeSeed = (value) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < 0) {
        throw new Error('ZEN_BONSAI_AUTHORING_DRAFT_TREE_SEED_INVALID');
    }
    return numeric;
};

export function useZenBonsaiAuthoringDraftState() {
    const activeProfile = useZenBonsaiActiveProfileState();
    const [draftIdentity, setDraftIdentity] = useState(() => (
        stripIdentityRevision(activeProfile.activeIdentity)
    ));
    const [learningAnchorLatent, setLearningAnchorLatent] = useState(
        () => activeProfile.sakuraV2Latent,
    );
    const [baseIdentityRevision, setBaseIdentityRevision] = useState(null);
    const [draftRevision, setDraftRevision] = useState(0);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!activeProfile.profileReady || initializedRef.current) return;
        initializedRef.current = true;
        setDraftIdentity(stripIdentityRevision(activeProfile.activeIdentity));
        setLearningAnchorLatent(activeProfile.sakuraV2Latent);
        setBaseIdentityRevision(activeProfile.identityRevision);
        setDraftRevision(0);
    }, [
        activeProfile.activeIdentity,
        activeProfile.identityRevision,
        activeProfile.profileReady,
        activeProfile.sakuraV2Latent,
    ]);

    const updateDraft = useCallback((resolver) => {
        setDraftIdentity((current) => {
            const next = normalizeZenBonsaiProfileActiveIdentityInput(resolver(current));
            if (JSON.stringify(next) === JSON.stringify(current)) return current;
            setDraftRevision((revision) => revision + 1);
            return next;
        });
    }, []);

    const setTreeSeed = useCallback((nextValue) => {
        updateDraft((current) => ({
            ...current,
            treeSeed: normalizeSeed(resolveNextValue(nextValue, current.treeSeed)),
        }));
    }, [updateDraft]);

    const setStructureMode = useCallback((nextValue) => {
        updateDraft((current) => {
            const mode = resolveNextValue(nextValue, current.structureMode);
            if (!Object.values(STRUCTURE_MODE).includes(mode)) {
                throw new Error('ZEN_BONSAI_AUTHORING_DRAFT_STRUCTURE_MODE_INVALID');
            }
            const range = getStructureDepthRange(mode);
            return {
                ...current,
                structureMode: mode,
                structureDepth: clampStructureDepth(
                    current.structureDepth,
                    range.min,
                    range.max,
                ),
            };
        });
    }, [updateDraft]);

    const setStructureDepth = useCallback((nextValue) => {
        updateDraft((current) => ({
            ...current,
            structureDepth: validateStructureDepthForMode(
                current.structureMode,
                resolveNextValue(nextValue, current.structureDepth),
            ),
        }));
    }, [updateDraft]);

    const commitSakuraV2Latent = useCallback((nextLatent, options = {}) => {
        const normalizedLatent = validateSakuraLatent(nextLatent, {
            code: 'ZEN_BONSAI_AUTHORING_DRAFT_LATENT_INVALID',
            label: 'Zen bonsai authoring draft latent',
        });
        updateDraft((current) => ({
            ...current,
            canonicalLatent: {
                version: current.canonicalLatent.version,
                values: normalizedLatent,
            },
        }));
        if (options?.syncLearningAnchor === true) {
            setLearningAnchorLatent(normalizedLatent);
        }
        return {
            version: draftIdentity.canonicalLatent.version,
            latent: normalizedLatent,
            learningAnchorLatent: options?.syncLearningAnchor === true
                ? normalizedLatent
                : learningAnchorLatent,
            updatedAt: Date.now(),
        };
    }, [draftIdentity.canonicalLatent.version, learningAnchorLatent, updateDraft]);

    const replaceDraftIdentity = useCallback((nextIdentity) => {
        const normalized = normalizeZenBonsaiProfileActiveIdentityInput(nextIdentity);
        setDraftIdentity(normalized);
        setLearningAnchorLatent(normalized.canonicalLatent.values);
        setDraftRevision((revision) => revision + 1);
        return normalized;
    }, []);

    const applyDraftToMain = useCallback(async ({
        generationInputs = draftIdentity.generationInputs,
        identity = draftIdentity,
    } = {}) => {
        if (!activeProfile.profileReady || baseIdentityRevision === null) {
            throw new Error('ZEN_BONSAI_AUTHORING_DRAFT_PROFILE_NOT_READY');
        }
        if (activeProfile.identityRevision !== baseIdentityRevision) {
            throw new Error('ZEN_BONSAI_AUTHORING_DRAFT_STALE');
        }
        const normalized = normalizeZenBonsaiProfileActiveIdentityInput({
            ...identity,
            generationInputs,
        });
        const candidateFingerprint = resolveZenBonsaiProfileActiveIdentityFingerprint({
            ...normalized,
            identityRevision: baseIdentityRevision,
        });
        if (candidateFingerprint === activeProfile.activeIdentityFingerprint) {
            return activeProfile.activeIdentity;
        }
        const committed = await activeProfile.commitActiveIdentity(normalized);
        initializedRef.current = true;
        setDraftIdentity(stripIdentityRevision(committed.activeIdentity));
        setLearningAnchorLatent(committed.activeIdentity.canonicalLatent.values);
        setBaseIdentityRevision(committed.identityRevision);
        setDraftRevision(0);
        return committed.activeIdentity;
    }, [
        activeProfile,
        baseIdentityRevision,
        draftIdentity,
    ]);

    const sakuraV2Latent = draftIdentity.canonicalLatent.values;
    const currentPhenotype = useMemo(
        () => compileSakuraPhenotypeFromLatent(sakuraV2Latent),
        [sakuraV2Latent],
    );
    const identityRevision = Math.max(
        1,
        Number(baseIdentityRevision || activeProfile.identityRevision || 1) + draftRevision,
    );

    return Object.freeze({
        profileReady: activeProfile.profileReady,
        profileEpoch: activeProfile.profileEpoch,
        baseIdentityRevision,
        draftRevision,
        treeType: draftIdentity.treeType,
        structureMode: draftIdentity.structureMode,
        setStructureMode,
        structureDepth: draftIdentity.structureDepth,
        setStructureDepth,
        treeSeed: draftIdentity.treeSeed,
        setTreeSeed,
        identityRevision,
        generationInputs: draftIdentity.generationInputs,
        sakuraV2LatentState: Object.freeze({
            version: draftIdentity.canonicalLatent.version,
            latent: sakuraV2Latent,
            learningAnchorLatent,
            updatedAt: 0,
        }),
        sakuraV2Latent,
        learningAnchorLatent,
        currentPhenotype,
        commitSakuraV2Latent,
        replaceDraftIdentity,
        applyDraftToMain,
    });
}

export default useZenBonsaiAuthoringDraftState;
