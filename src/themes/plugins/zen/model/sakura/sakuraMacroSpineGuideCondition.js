import {
    createStructuralPlanIdV1,
} from '../bonsai/generation/structuralPlanIdentityV1';
import {
    requireSakuraMacroSpineGuideV1,
} from './sakuraMacroSpineGuide';
import {
    SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE,
} from '../../contracts/SakuraSpineGenerationConditionContract.js';

export const SAKURA_MACRO_SPINE_GUIDE_CONDITION_VERSION = 1;
export const SAKURA_MACRO_SPINE_GUIDE_CONDITION_CONTRACT = (
    'zen_sakura_macro_spine_guide_condition_v1'
);
export const SAKURA_MACRO_SPINE_GUIDE_ROLE = 'fixed_generation_context';

export const createSakuraMacroSpineGuideConditionV1 = (value) => {
    const guide = requireSakuraMacroSpineGuideV1(value);
    const adherence = Number(guide.adherence);
    return Object.freeze({
        version: SAKURA_MACRO_SPINE_GUIDE_CONDITION_VERSION,
        contract: SAKURA_MACRO_SPINE_GUIDE_CONDITION_CONTRACT,
        role: SAKURA_MACRO_SPINE_GUIDE_ROLE,
        conditionId: createStructuralPlanIdV1(
            SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE,
            [
                guide.guideId,
                Number(adherence.toFixed(7)),
            ],
        ),
        guideId: guide.guideId,
        adherence,
    });
};

export const requireSakuraMacroSpineGuideConditionV1 = (value, guide = null) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_CONDITION_REQUIRED');
    }
    if (
        value.version !== SAKURA_MACRO_SPINE_GUIDE_CONDITION_VERSION
        || value.contract !== SAKURA_MACRO_SPINE_GUIDE_CONDITION_CONTRACT
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_CONDITION_CONTRACT_INVALID');
    }
    const resolvedGuide = guide ? requireSakuraMacroSpineGuideV1(guide) : null;
    const canonical = resolvedGuide
        ? createSakuraMacroSpineGuideConditionV1(resolvedGuide)
        : null;
    if (
        !canonical
        || value.conditionId !== canonical.conditionId
        || value.guideId !== canonical.guideId
        || Number(value.adherence) !== canonical.adherence
    ) {
        throw new Error('ZEN_SAKURA_MACRO_SPINE_GUIDE_CONDITION_IDENTITY_INVALID');
    }
    return value;
};
