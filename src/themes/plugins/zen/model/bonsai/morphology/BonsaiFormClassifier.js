import { BONSAI_STRUCTURAL_DESCRIPTOR_VERSION } from './BonsaiStructuralDescriptorModel';

export const BONSAI_FORM_CLASSIFIER_VERSION = 1;

export const BONSAI_FORM_ID = Object.freeze({
    FORMAL_UPRIGHT: 'formal_upright',
    UMBRELLA_CROWN: 'umbrella_crown',
    SLANTING: 'slanting',
    INFORMAL_UPRIGHT: 'informal_upright',
    LITERATI: 'literati',
    FULL_CASCADE: 'full_cascade',
    SEMI_CASCADE: 'semi_cascade',
    WEEPING: 'weeping',
    TWIN_TRUNK: 'twin_trunk',
    MULTI_TRUNK: 'multi_trunk',
});

export const BONSAI_FORM_CLASSIFICATION_THRESHOLD = 0.46;
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const round = (value, digits = 4) => Number((Number(value) || 0).toFixed(digits));
const rise = (value, low, high) => clamp01((Number(value) - low) / Math.max(1e-8, high - low));
const fall = (value, low, high) => 1 - rise(value, low, high);
const plateau = (value, enterLow, fullLow, fullHigh, exitHigh) => (
    Math.min(
        rise(value, enterLow, fullLow),
        fall(value, fullHigh, exitHigh),
    )
);
const weighted = (entries) => {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    return total > 0
        ? clamp01(entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / total)
        : 0;
};

const requireDescriptor = (descriptor) => {
    if (!descriptor || descriptor.version !== BONSAI_STRUCTURAL_DESCRIPTOR_VERSION) {
        throw new Error('ZEN_BONSAI_STRUCTURAL_DESCRIPTOR_VERSION_INVALID');
    }
    return descriptor;
};

const rankMemberships = (scores) => Object.entries(scores)
    .map(([id, score]) => ({ id, score: round(score) }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

export class BonsaiFormClassifier {
    static classify(rawDescriptor) {
        const descriptor = requireDescriptor(rawDescriptor);
        const { trunk, crown, structure, topology, bounds } = descriptor;
        const upright = weighted([
            { value: fall(trunk.netLeanDeg, 8, 28), weight: 0.62 },
            { value: fall(trunk.endpointLateralRatio, 0.12, 0.5), weight: 0.38 },
        ]);
        const rising = weighted([
            { value: fall(trunk.descendingPathRatio, 0.04, 0.42), weight: 0.55 },
            { value: rise(trunk.upwardRiseRatio, 0.35, 0.82), weight: 0.45 },
        ]);
        const straight = weighted([
            { value: fall(trunk.pathToChordRatio, 1.025, 1.24), weight: 0.52 },
            { value: fall(trunk.meanTurnDeg, 2.4, 9.5), weight: 0.48 },
        ]);
        const macroInflection = (
            rise(trunk.inflectionDensity, 0.08, 0.42)
            * rise(trunk.lateralExcursionRatio, 0.035, 0.18)
        );
        const curved = weighted([
            { value: rise(trunk.pathToChordRatio, 1.025, 1.2), weight: 0.35 },
            { value: rise(trunk.meanTurnDeg, 2.4, 9.5), weight: 0.38 },
            { value: macroInflection, weight: 0.27 },
        ]);
        const slanted = weighted([
            { value: plateau(trunk.netLeanDeg, 10, 22, 58, 78), weight: 0.62 },
            { value: rise(trunk.endpointLateralRatio, 0.12, 0.54), weight: 0.38 },
        ]);
        const fullCascade = weighted([
            { value: rise(trunk.lowestPointPotRatio, 0.82, 1.18), weight: 0.46 },
            { value: rise(trunk.endpointPotRatio, 0.55, 1.05), weight: 0.25 },
            { value: rise(trunk.descendingPathRatio, 0.2, 0.62), weight: 0.29 },
        ]);
        const semiCascade = weighted([
            {
                value: plateau(trunk.lowestPointPotRatio, 0.05, 0.24, 0.78, 1.08),
                weight: 0.48,
            },
            {
                value: plateau(trunk.endpointPotRatio, 0.02, 0.14, 0.68, 0.98),
                weight: 0.22,
            },
            { value: rise(trunk.descendingPathRatio, 0.1, 0.5), weight: 0.3 },
        ]);
        const treeAspect = bounds.height / Math.max(1e-8, bounds.width);
        const sparseCrown = weighted([
            { value: structure.sparseScaffoldRatio, weight: 0.56 },
            { value: fall(topology.primaryScaffoldCount, 3, 9), weight: 0.44 },
        ]);
        const crownWide = rise(crown.widthToTreeHeight, 0.32, 0.82);
        const crownHigh = rise(crown.firstAttachPathRatio, 0.32, 0.72);
        const crownCompact = fall(crown.heightToTreeHeight, 0.38, 0.82);
        const umbrellaCore = Math.cbrt(crownHigh * crownWide * crownCompact);
        const weeping = weighted([
            { value: rise(crown.droopingTipRatio, 0.22, 0.82), weight: 0.58 },
            { value: rise(crown.downwardScaffoldRatio, 0.22, 0.72), weight: 0.42 },
        ]);
        const formalCrown = weighted([
            { value: crown.triangularity, weight: 0.55 },
            { value: fall(crown.firstAttachPathRatio, 0.38, 0.72), weight: 0.25 },
            { value: crown.lateralMassBalance, weight: 0.2 },
        ]);

        const scores = {
            [BONSAI_FORM_ID.FORMAL_UPRIGHT]: weighted([
                { value: upright, weight: 0.23 },
                { value: straight, weight: 0.35 },
                { value: rising, weight: 0.12 },
                { value: formalCrown, weight: 0.3 },
            ]),
            [BONSAI_FORM_ID.UMBRELLA_CROWN]: weighted([
                { value: upright, weight: 0.1 },
                { value: umbrellaCore, weight: 0.58 },
                {
                    value: Math.max(crown.middleBandWidthRatio, crown.upperBandWidthRatio),
                    weight: 0.22,
                },
                { value: crown.lateralMassBalance, weight: 0.1 },
            ]),
            [BONSAI_FORM_ID.SLANTING]: weighted([
                { value: slanted, weight: 0.42 },
                { value: rising, weight: 0.21 },
                { value: trunk.dominantTurnRatio, weight: 0.13 },
                { value: fall(trunk.lowestPointPotRatio, 0.05, 0.35), weight: 0.14 },
                { value: crown.counterBalance, weight: 0.1 },
            ]),
            [BONSAI_FORM_ID.INFORMAL_UPRIGHT]: weighted([
                { value: curved, weight: 0.35 },
                { value: macroInflection, weight: 0.19 },
                { value: rising, weight: 0.19 },
                { value: trunk.apexReturnRatio, weight: 0.16 },
                { value: fall(trunk.netLeanDeg, 32, 72), weight: 0.11 },
            ]),
            [BONSAI_FORM_ID.LITERATI]: weighted([
                { value: rise(treeAspect, 1.65, 3.4), weight: 0.2 },
                { value: rise(trunk.slenderness, 10, 25), weight: 0.16 },
                { value: crownHigh, weight: 0.25 },
                { value: sparseCrown, weight: 0.27 },
                { value: crownCompact, weight: 0.12 },
            ]),
            [BONSAI_FORM_ID.FULL_CASCADE]: fullCascade,
            [BONSAI_FORM_ID.SEMI_CASCADE]: semiCascade * fall(fullCascade, 0.64, 0.9),
            [BONSAI_FORM_ID.WEEPING]: weeping,
            [BONSAI_FORM_ID.TWIN_TRUNK]: topology.trunkCount === 2 ? 1 : 0,
            [BONSAI_FORM_ID.MULTI_TRUNK]: topology.trunkCount >= 3 ? 1 : 0,
        };

        const memberships = rankMemberships(scores);
        const first = memberships[0];
        const second = memberships[1];
        const classified = first.score >= BONSAI_FORM_CLASSIFICATION_THRESHOLD;
        const margin = clamp01(first.score - (second?.score || 0));
        const evidence = clamp01(
            (topology.trunkSegmentCount / 6) * 0.45
            + (topology.scaffoldSegmentCount / 10) * 0.55,
        );

        return {
            version: BONSAI_FORM_CLASSIFIER_VERSION,
            primaryFormId: classified ? first.id : null,
            primaryScore: first.score,
            confidence: round(
                classified
                    ? first.score * 0.62 + margin * 0.23 + evidence * 0.15
                    : first.score * 0.5,
            ),
            secondaryFormIds: memberships
                .slice(1)
                .filter((entry) => (
                    entry.score >= BONSAI_FORM_CLASSIFICATION_THRESHOLD - 0.08
                ))
                .filter((entry) => first.score - entry.score <= 0.16)
                .map((entry) => entry.id),
            memberships,
            axes: {
                topology: {
                    singleTrunk: topology.trunkCount === 1 ? 1 : 0,
                    twinTrunk: topology.trunkCount === 2 ? 1 : 0,
                    multiTrunk: topology.trunkCount >= 3 ? 1 : 0,
                },
                trunkPosture: {
                    upright: round(upright),
                    slanted: round(slanted),
                    curved: round(curved),
                    semiCascade: round(semiCascade),
                    fullCascade: round(fullCascade),
                },
                crownBehavior: {
                    triangular: round(crown.triangularity),
                    umbrella: round(scores[BONSAI_FORM_ID.UMBRELLA_CROWN]),
                    sparse: round(sparseCrown),
                    weeping: round(weeping),
                },
            },
            threshold: BONSAI_FORM_CLASSIFICATION_THRESHOLD,
        };
    }
}
