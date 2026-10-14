import { BONSAI_FORM_ID } from './BonsaiFormClassifier';
import {
    BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS,
    BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS,
} from './BonsaiFormReachabilityPolicy';

// This contract owns desired composition targets only. Classification remains a read model,
// and topology generators opt in through the explicit Sakura composition adapter seam.
export const BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_VERSION = 1;
export const BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_CONTRACT =
    'bonsai_single_root_form_composition_prior_v1';

export const BONSAI_SINGLE_ROOT_FORM_COMPOSITION_GROUP_KEYS = Object.freeze([
    'trunk',
    'scaffold',
    'crown',
    'negativeSpace',
]);

const PRIOR_KEYS = Object.freeze([
    'contract',
    'version',
    'formId',
    'variantSeed',
    ...BONSAI_SINGLE_ROOT_FORM_COMPOSITION_GROUP_KEYS,
]);
const GROUP_KEYS = Object.freeze({
    trunk: Object.freeze([
        'posture',
        'signedLeanDeg',
        'curvature',
        'descendingPathRatio',
        'slenderness',
    ]),
    scaffold: Object.freeze([
        'stationPattern',
        'firstAttachPathRatio',
        'density',
        'sideAsymmetry',
        'downwardRatio',
    ]),
    crown: Object.freeze([
        'envelope',
        'widthToTreeHeight',
        'heightToTreeHeight',
        'centroidHeightRatio',
        'triangularity',
        'droop',
    ]),
    negativeSpace: Object.freeze([
        'pattern',
        'openness',
        'asymmetry',
        'largestVoidRatio',
        'padSeparation',
    ]),
});

const scalar = (center, variation, minimum, maximum, { mirrored = false } = {}) => (
    Object.freeze({
        center,
        variation,
        minimum,
        maximum,
        mirrored,
    })
);
const freezeGroup = (group) => Object.freeze(group);
const freezeProfile = ({ trunk, scaffold, crown, negativeSpace }) => Object.freeze({
    trunk: freezeGroup(trunk),
    scaffold: freezeGroup(scaffold),
    crown: freezeGroup(crown),
    negativeSpace: freezeGroup(negativeSpace),
});

const PROFILE_BY_FORM_ID = Object.freeze({
    [BONSAI_FORM_ID.FORMAL_UPRIGHT]: freezeProfile({
        trunk: {
            posture: 'formal_upright',
            signedLeanDeg: scalar(0, 4, -6, 6),
            curvature: scalar(0.12, 0.05, 0, 1),
            descendingPathRatio: scalar(0.025, 0.02, 0, 1),
            slenderness: scalar(14, 2, 1, 40),
        },
        scaffold: {
            stationPattern: 'tiered_alternating',
            firstAttachPathRatio: scalar(0.22, 0.04, 0, 1),
            density: scalar(0.68, 0.08, 0, 1),
            sideAsymmetry: scalar(0.16, 0.08, 0, 1),
            downwardRatio: scalar(0.14, 0.05, 0, 1),
        },
        crown: {
            envelope: 'low_triangle',
            widthToTreeHeight: scalar(0.56, 0.06, 0.1, 1.5),
            heightToTreeHeight: scalar(0.72, 0.07, 0.1, 1.2),
            centroidHeightRatio: scalar(0.55, 0.04, 0, 1),
            triangularity: scalar(0.86, 0.06, 0, 1),
            droop: scalar(0.08, 0.04, 0, 1),
        },
        negativeSpace: {
            pattern: 'tiered_windows',
            openness: scalar(0.38, 0.07, 0, 1),
            asymmetry: scalar(0.16, 0.07, 0, 1),
            largestVoidRatio: scalar(0.28, 0.05, 0, 1),
            padSeparation: scalar(0.7, 0.08, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.UMBRELLA_CROWN]: freezeProfile({
        trunk: {
            posture: 'upright',
            signedLeanDeg: scalar(0, 6, -8, 8),
            curvature: scalar(0.18, 0.06, 0, 1),
            descendingPathRatio: scalar(0.03, 0.02, 0, 1),
            slenderness: scalar(12, 1.8, 1, 40),
        },
        scaffold: {
            stationPattern: 'radial_upper',
            firstAttachPathRatio: scalar(0.54, 0.06, 0, 1),
            density: scalar(0.74, 0.08, 0, 1),
            sideAsymmetry: scalar(0.12, 0.07, 0, 1),
            downwardRatio: scalar(0.12, 0.05, 0, 1),
        },
        crown: {
            envelope: 'umbrella_dome',
            widthToTreeHeight: scalar(0.84, 0.08, 0.1, 1.5),
            heightToTreeHeight: scalar(0.46, 0.06, 0.1, 1.2),
            centroidHeightRatio: scalar(0.72, 0.05, 0, 1),
            triangularity: scalar(0.18, 0.07, 0, 1),
            droop: scalar(0.12, 0.05, 0, 1),
        },
        negativeSpace: {
            pattern: 'open_under_crown',
            openness: scalar(0.46, 0.07, 0, 1),
            asymmetry: scalar(0.12, 0.06, 0, 1),
            largestVoidRatio: scalar(0.5, 0.07, 0, 1),
            padSeparation: scalar(0.48, 0.08, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.SLANTING]: freezeProfile({
        trunk: {
            posture: 'slanting',
            signedLeanDeg: scalar(34, 7, 20, 50, { mirrored: true }),
            curvature: scalar(0.24, 0.08, 0, 1),
            descendingPathRatio: scalar(0.06, 0.035, 0, 1),
            slenderness: scalar(13, 2, 1, 40),
        },
        scaffold: {
            stationPattern: 'counterbalanced',
            firstAttachPathRatio: scalar(0.26, 0.05, 0, 1),
            density: scalar(0.58, 0.09, 0, 1),
            sideAsymmetry: scalar(0.56, 0.09, 0, 1),
            downwardRatio: scalar(0.15, 0.06, 0, 1),
        },
        crown: {
            envelope: 'offset_triangle',
            widthToTreeHeight: scalar(0.62, 0.08, 0.1, 1.5),
            heightToTreeHeight: scalar(0.58, 0.07, 0.1, 1.2),
            centroidHeightRatio: scalar(0.57, 0.06, 0, 1),
            triangularity: scalar(0.66, 0.08, 0, 1),
            droop: scalar(0.1, 0.05, 0, 1),
        },
        negativeSpace: {
            pattern: 'counterbalance_window',
            openness: scalar(0.42, 0.08, 0, 1),
            asymmetry: scalar(0.58, 0.09, 0, 1),
            largestVoidRatio: scalar(0.4, 0.07, 0, 1),
            padSeparation: scalar(0.62, 0.08, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.INFORMAL_UPRIGHT]: freezeProfile({
        trunk: {
            posture: 'informal_upright',
            signedLeanDeg: scalar(10, 6, 2, 22, { mirrored: true }),
            curvature: scalar(0.58, 0.1, 0, 1),
            descendingPathRatio: scalar(0.08, 0.04, 0, 1),
            slenderness: scalar(14.5, 2.5, 1, 40),
        },
        scaffold: {
            stationPattern: 'alternating_asymmetric',
            firstAttachPathRatio: scalar(0.3, 0.06, 0, 1),
            density: scalar(0.58, 0.1, 0, 1),
            sideAsymmetry: scalar(0.45, 0.1, 0, 1),
            downwardRatio: scalar(0.18, 0.07, 0, 1),
        },
        crown: {
            envelope: 'irregular_triangle',
            widthToTreeHeight: scalar(0.63, 0.09, 0.1, 1.5),
            heightToTreeHeight: scalar(0.68, 0.08, 0.1, 1.2),
            centroidHeightRatio: scalar(0.57, 0.06, 0, 1),
            triangularity: scalar(0.61, 0.1, 0, 1),
            droop: scalar(0.14, 0.06, 0, 1),
        },
        negativeSpace: {
            pattern: 'alternating_pockets',
            openness: scalar(0.48, 0.09, 0, 1),
            asymmetry: scalar(0.46, 0.1, 0, 1),
            largestVoidRatio: scalar(0.37, 0.08, 0, 1),
            padSeparation: scalar(0.66, 0.09, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.LITERATI]: freezeProfile({
        trunk: {
            posture: 'literati',
            signedLeanDeg: scalar(14, 9, 3, 34, { mirrored: true }),
            curvature: scalar(0.48, 0.12, 0, 1),
            descendingPathRatio: scalar(0.1, 0.05, 0, 1),
            slenderness: scalar(24, 4, 1, 40),
        },
        scaffold: {
            stationPattern: 'sparse_upper',
            firstAttachPathRatio: scalar(0.65, 0.08, 0, 1),
            density: scalar(0.2, 0.07, 0, 1),
            sideAsymmetry: scalar(0.58, 0.12, 0, 1),
            downwardRatio: scalar(0.12, 0.06, 0, 1),
        },
        crown: {
            envelope: 'sparse_high',
            widthToTreeHeight: scalar(0.32, 0.07, 0.1, 1.5),
            heightToTreeHeight: scalar(0.3, 0.07, 0.1, 1.2),
            centroidHeightRatio: scalar(0.82, 0.06, 0, 1),
            triangularity: scalar(0.18, 0.09, 0, 1),
            droop: scalar(0.1, 0.06, 0, 1),
        },
        negativeSpace: {
            pattern: 'dominant_open_field',
            openness: scalar(0.8, 0.08, 0, 1),
            asymmetry: scalar(0.62, 0.11, 0, 1),
            largestVoidRatio: scalar(0.7, 0.09, 0, 1),
            padSeparation: scalar(0.78, 0.08, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.FULL_CASCADE]: freezeProfile({
        trunk: {
            posture: 'full_cascade',
            signedLeanDeg: scalar(54, 9, 32, 72, { mirrored: true }),
            curvature: scalar(0.58, 0.1, 0, 1),
            descendingPathRatio: scalar(0.76, 0.09, 0, 1),
            slenderness: scalar(16, 2.5, 1, 40),
        },
        scaffold: {
            stationPattern: 'cascade_following',
            firstAttachPathRatio: scalar(0.22, 0.05, 0, 1),
            density: scalar(0.48, 0.09, 0, 1),
            sideAsymmetry: scalar(0.7, 0.1, 0, 1),
            downwardRatio: scalar(0.68, 0.1, 0, 1),
        },
        crown: {
            envelope: 'descending_stream',
            widthToTreeHeight: scalar(0.48, 0.08, 0.1, 1.5),
            heightToTreeHeight: scalar(0.9, 0.1, 0.1, 1.2),
            centroidHeightRatio: scalar(0.34, 0.07, 0, 1),
            triangularity: scalar(0.22, 0.09, 0, 1),
            droop: scalar(0.66, 0.1, 0, 1),
        },
        negativeSpace: {
            pattern: 'cascade_corridor',
            openness: scalar(0.58, 0.09, 0, 1),
            asymmetry: scalar(0.76, 0.09, 0, 1),
            largestVoidRatio: scalar(0.54, 0.08, 0, 1),
            padSeparation: scalar(0.58, 0.09, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.SEMI_CASCADE]: freezeProfile({
        trunk: {
            posture: 'semi_cascade',
            signedLeanDeg: scalar(43, 8, 25, 62, { mirrored: true }),
            curvature: scalar(0.5, 0.1, 0, 1),
            descendingPathRatio: scalar(0.48, 0.09, 0, 1),
            slenderness: scalar(15, 2.5, 1, 40),
        },
        scaffold: {
            stationPattern: 'counterweighted_cascade',
            firstAttachPathRatio: scalar(0.24, 0.05, 0, 1),
            density: scalar(0.54, 0.09, 0, 1),
            sideAsymmetry: scalar(0.64, 0.1, 0, 1),
            downwardRatio: scalar(0.48, 0.1, 0, 1),
        },
        crown: {
            envelope: 'lateral_cascade',
            widthToTreeHeight: scalar(0.68, 0.09, 0.1, 1.5),
            heightToTreeHeight: scalar(0.64, 0.08, 0.1, 1.2),
            centroidHeightRatio: scalar(0.45, 0.07, 0, 1),
            triangularity: scalar(0.34, 0.09, 0, 1),
            droop: scalar(0.46, 0.1, 0, 1),
        },
        negativeSpace: {
            pattern: 'edge_corridor',
            openness: scalar(0.52, 0.09, 0, 1),
            asymmetry: scalar(0.7, 0.09, 0, 1),
            largestVoidRatio: scalar(0.48, 0.08, 0, 1),
            padSeparation: scalar(0.6, 0.09, 0, 1),
        },
    }),
    [BONSAI_FORM_ID.WEEPING]: freezeProfile({
        trunk: {
            posture: 'upright_support',
            signedLeanDeg: scalar(0, 8, -10, 10),
            curvature: scalar(0.32, 0.09, 0, 1),
            descendingPathRatio: scalar(0.16, 0.06, 0, 1),
            slenderness: scalar(13, 2, 1, 40),
        },
        scaffold: {
            stationPattern: 'radial_drooping',
            firstAttachPathRatio: scalar(0.3, 0.06, 0, 1),
            density: scalar(0.7, 0.09, 0, 1),
            sideAsymmetry: scalar(0.22, 0.09, 0, 1),
            downwardRatio: scalar(0.78, 0.09, 0, 1),
        },
        crown: {
            envelope: 'weeping_curtain',
            widthToTreeHeight: scalar(0.68, 0.08, 0.1, 1.5),
            heightToTreeHeight: scalar(0.78, 0.09, 0.1, 1.2),
            centroidHeightRatio: scalar(0.48, 0.06, 0, 1),
            triangularity: scalar(0.3, 0.09, 0, 1),
            droop: scalar(0.82, 0.08, 0, 1),
        },
        negativeSpace: {
            pattern: 'curtain_gaps',
            openness: scalar(0.42, 0.08, 0, 1),
            asymmetry: scalar(0.24, 0.09, 0, 1),
            largestVoidRatio: scalar(0.32, 0.07, 0, 1),
            padSeparation: scalar(0.52, 0.09, 0, 1),
        },
    }),
});

const fail = (field) => {
    throw new Error(`ZEN_BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_INVALID:${field}`);
};

const hasExactKeys = (value, expectedKeys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...expectedKeys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const requireSupportedFormId = (formId) => {
    if (BONSAI_SINGLE_ROOT_UNSUPPORTED_FORM_IDS.includes(formId)) {
        fail(`formId.unsupported:${formId}`);
    }
    if (!BONSAI_SINGLE_ROOT_SUPPORTED_FORM_IDS.includes(formId)) {
        fail(`formId:${String(formId)}`);
    }
    return formId;
};

const requireVariantSeed = (variantSeed) => {
    if (!Number.isSafeInteger(variantSeed) || variantSeed < 0) {
        fail(`variantSeed:${String(variantSeed)}`);
    }
    return variantSeed;
};

const sampleUnit = ({ formId, variantSeed, field }) => {
    const input = `${BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_CONTRACT}`
        + `:${formId}:${variantSeed}:${field}`;
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
};

const round = (value) => Number(value.toFixed(6));
const sampleScalar = ({ formId, variantSeed, field, definition }) => {
    const unit = sampleUnit({ formId, variantSeed, field });
    const magnitude = Math.min(
        definition.maximum,
        Math.max(
            definition.minimum,
            definition.center + (((unit * 2) - 1) * definition.variation),
        ),
    );
    if (!definition.mirrored) return round(magnitude);
    const direction = sampleUnit({
        formId,
        variantSeed,
        field: `${field}.direction`,
    }) < 0.5 ? -1 : 1;
    return round(magnitude * direction);
};

const resolveGroup = ({ formId, variantSeed, groupKey, definition }) => Object.freeze(
    Object.fromEntries(GROUP_KEYS[groupKey].map((field) => {
        const fieldDefinition = definition[field];
        if (typeof fieldDefinition === 'string') return [field, fieldDefinition];
        return [field, sampleScalar({
            formId,
            variantSeed,
            field: `${groupKey}.${field}`,
            definition: fieldDefinition,
        })];
    })),
);

const resolveCanonicalGroups = ({ formId, variantSeed }) => {
    const profile = PROFILE_BY_FORM_ID[formId];
    if (!profile) fail(`profile:${formId}`);
    return Object.fromEntries(BONSAI_SINGLE_ROOT_FORM_COMPOSITION_GROUP_KEYS.map(
        (groupKey) => [groupKey, resolveGroup({
            formId,
            variantSeed,
            groupKey,
            definition: profile[groupKey],
        })],
    ));
};

const requireCanonicalGroup = ({ value, expected, groupKey }) => {
    if (!hasExactKeys(value, GROUP_KEYS[groupKey])) fail(`${groupKey}.shape`);
    GROUP_KEYS[groupKey].forEach((field) => {
        if (value[field] !== expected[field]) fail(`${groupKey}.${field}`);
    });
    return value;
};

export const requireBonsaiSingleRootFormCompositionPrior = (value) => {
    if (!hasExactKeys(value, PRIOR_KEYS)) fail('shape');
    if (value.contract !== BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_CONTRACT) {
        fail('contract');
    }
    if (value.version !== BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_VERSION) {
        fail('version');
    }
    const formId = requireSupportedFormId(value.formId);
    const variantSeed = requireVariantSeed(value.variantSeed);
    const expectedGroups = resolveCanonicalGroups({ formId, variantSeed });
    BONSAI_SINGLE_ROOT_FORM_COMPOSITION_GROUP_KEYS.forEach((groupKey) => {
        requireCanonicalGroup({
            value: value[groupKey],
            expected: expectedGroups[groupKey],
            groupKey,
        });
    });
    return value;
};

export const createBonsaiSingleRootFormCompositionPrior = ({
    formId,
    variantSeed,
} = {}) => {
    const resolvedFormId = requireSupportedFormId(formId);
    const resolvedVariantSeed = requireVariantSeed(variantSeed);
    const groups = resolveCanonicalGroups({
        formId: resolvedFormId,
        variantSeed: resolvedVariantSeed,
    });
    return requireBonsaiSingleRootFormCompositionPrior(Object.freeze({
        contract: BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_CONTRACT,
        version: BONSAI_SINGLE_ROOT_FORM_COMPOSITION_PRIOR_VERSION,
        formId: resolvedFormId,
        variantSeed: resolvedVariantSeed,
        ...groups,
    }));
};
