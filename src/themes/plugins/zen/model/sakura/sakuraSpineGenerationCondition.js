import {
    validateSakuraSpineGenerationConditionIdV1,
} from '../../contracts/SakuraSpineGenerationConditionContract.js';
import {
    createSakuraMacroSpineGuideConditionV1,
} from './sakuraMacroSpineGuideCondition.js';
import {
    createSakuraSpineReferenceFamilyConditionV1,
} from './sakuraSpineReferenceFamilyCondition.js';

export const resolveSakuraSpineGenerationConditionIdV1 = ({
    spineGuide = null,
    spineReferenceFamily = null,
} = {}) => {
    if (spineGuide && spineReferenceFamily) {
        throw new Error('ZEN_SAKURA_SPINE_GENERATION_CONDITION_CONFLICT');
    }
    const conditionId = spineReferenceFamily
        ? createSakuraSpineReferenceFamilyConditionV1(spineReferenceFamily).conditionId
        : (spineGuide
            ? createSakuraMacroSpineGuideConditionV1(spineGuide).conditionId
            : null);
    if (!validateSakuraSpineGenerationConditionIdV1(conditionId)) {
        throw new Error('ZEN_SAKURA_SPINE_GENERATION_CONDITION_ID_INVALID');
    }
    return conditionId;
};
