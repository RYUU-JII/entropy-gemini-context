import {
    createStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    requireSakuraSpineReferenceFamilyV1,
} from './sakuraSpineReferenceFamily';
import {
    SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE,
} from '../../contracts/SakuraSpineGenerationConditionContract.js';

export const SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_VERSION = 1;
export const SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_CONTRACT = (
    'zen_sakura_spine_reference_family_condition_v1'
);
export const SAKURA_SPINE_REFERENCE_FAMILY_ROLE = 'fixed_generation_context';

export const createSakuraSpineReferenceFamilyConditionV1 = (value) => {
    const family = requireSakuraSpineReferenceFamilyV1(value);
    const likeness = Number(family.likeness);
    return Object.freeze({
        version: SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_VERSION,
        contract: SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_CONTRACT,
        role: SAKURA_SPINE_REFERENCE_FAMILY_ROLE,
        conditionId: createStructuralPlanIdV1(
            SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE,
            [
                family.familyId,
                family.referenceGuideId,
                Number(likeness.toFixed(7)),
                family.variationPolicyId,
            ],
        ),
        familyId: family.familyId,
        referenceGuideId: family.referenceGuideId,
        likeness,
        variationPolicyId: family.variationPolicyId,
    });
};

export const requireSakuraSpineReferenceFamilyConditionV1 = (value, family = null) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_REQUIRED');
    }
    if (
        value.version !== SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_VERSION
        || value.contract !== SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_CONTRACT
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_CONTRACT_INVALID');
    }
    const resolvedFamily = family ? requireSakuraSpineReferenceFamilyV1(family) : null;
    const canonical = resolvedFamily
        ? createSakuraSpineReferenceFamilyConditionV1(resolvedFamily)
        : null;
    if (
        !canonical
        || value.conditionId !== canonical.conditionId
        || value.role !== canonical.role
        || value.familyId !== canonical.familyId
        || value.referenceGuideId !== canonical.referenceGuideId
        || Number(value.likeness) !== canonical.likeness
        || value.variationPolicyId !== canonical.variationPolicyId
    ) {
        throw new Error('ZEN_SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_IDENTITY_INVALID');
    }
    return value;
};
