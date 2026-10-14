export const SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE = (
    'sakura_macro_spine_guide_condition_v1'
);
export const SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE = (
    'sakura_spine_reference_family_condition_v1'
);

const CONDITION_ID_PATTERN = new RegExp(
    `^(?:${SAKURA_MACRO_SPINE_GUIDE_CONDITION_ID_NAMESPACE}`
    + `|${SAKURA_SPINE_REFERENCE_FAMILY_CONDITION_ID_NAMESPACE})_[0-9a-f]{8}$`,
);

export const isSakuraSpineGenerationConditionIdV1 = (value) => (
    typeof value === 'string' && CONDITION_ID_PATTERN.test(value)
);

export const validateSakuraSpineGenerationConditionIdV1 = (value) => (
    value === null || isSakuraSpineGenerationConditionIdV1(value)
);
