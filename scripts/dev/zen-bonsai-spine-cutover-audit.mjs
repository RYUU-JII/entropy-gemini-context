import { getDefaultPhenotype } from '../../src/themes/plugins/zen/model/BonsaiGenetics.js';
import { SeededRandom } from '../../src/themes/plugins/zen/model/SeededRandom.js';
import { SakuraSpecies } from '../../src/themes/plugins/zen/model/SakuraSpecies.js';
import { SakuraStructuralABSpecies } from '../../src/themes/plugins/zen/model/SakuraStructuralABSpecies.js';
import { CANONICAL_LEARNING_STAGE } from '../../src/themes/plugins/zen/model/ZenCoreConfig.js';
import { BranchGeometryModel } from '../../src/themes/plugins/zen/model/bonsai/geometry/branchGeometryModel.js';
import { SAKURA_BRANCH_ORDER } from '../../src/themes/plugins/zen/model/bonsai/generation/shapePriorModel.js';
import {
    createStructuralNodeRandom,
    resolveStructuralSeed,
} from '../../src/themes/plugins/zen/model/bonsai/random/StructuralHashRandom.js';
import { BonsaiFormClassifier } from '../../src/themes/plugins/zen/model/bonsai/morphology/BonsaiFormClassifier.js';
import { BonsaiStructuralDescriptorModel } from '../../src/themes/plugins/zen/model/bonsai/morphology/BonsaiStructuralDescriptorModel.js';
import { compileSakuraPhenotypeFromLatent } from '../../src/themes/plugins/zen/model/v2/SakuraCompiler.js';
import { getDefaultSakuraLatent } from '../../src/themes/plugins/zen/model/v2/SakuraLatentSchema.js';
import {
    resolveSakuraTrunkGeminiParamsFromGene,
    resolveSakuraTrunkGeminiRootAngle,
    resolveSakuraTrunkGeminiSegmentLength,
} from '../../src/themes/plugins/zen/model/sakura/sakuraTrunkGeminiParams.js';
import {
    createSakuraMacroSpineGuideV1,
    fitSakuraMacroSpineGuideC1V1,
    sampleSakuraMacroSpineShapeAtArcNorm,
} from '../../src/themes/plugins/zen/model/sakura/sakuraMacroSpineGuide.js';
import {
    analyzeSakuraMacroSpineNaturalnessV1,
} from '../../src/themes/plugins/zen/model/sakura/sakuraSpineNaturalnessAnalysis.js';
import {
    createSakuraSpineReferenceFamilyV1,
    sampleSakuraSpineReferenceFamilyV1,
} from '../../src/themes/plugins/zen/model/sakura/sakuraSpineReferenceFamily.js';
import {
    createSakuraTrunkPathPlanV1,
    SAKURA_TRUNK_LATENT_INTEGRATION_STEPS,
} from '../../src/themes/plugins/zen/model/sakura/sakuraTrunkPathPlan.js';

const DEFAULT_SEED_COUNT = 8;
const SEED_BASE = 20260721;
const TOPOLOGY_HEIGHT = 360;
const STAGE = Object.freeze({ ...CANONICAL_LEARNING_STAGE, depth: 6 });
const POT_HEIGHT = Number(SakuraSpecies.getPotDimensions(getDefaultPhenotype('sakura')).height);

const VARIANTS = Object.freeze([
    { id: 'formal_upright', patch: { trunk_curve_amp: 0, backbone_sway: 0 } },
    {
        id: 'informal_upright',
        patch: {
            trunk_curve_amp: 0.1,
            trunk_curve_freq: 1.37,
            backbone_tilt_bias: -0.09,
            backbone_sway: 0.41,
            trunk_kink_prob: 0.19,
            trunk_kink_angle_deg: 16,
        },
    },
    {
        id: 'arc_balance_stress',
        classifierId: 'informal_upright',
        patch: {
            trunk_curve_amp: 0.713125,
            trunk_curve_freq: 1.0098765432098764,
            backbone_tilt_bias: 0.7632000000000001,
            backbone_sway: 0.8720116618075802,
            trunk_kink_prob: 0.42595041322314053,
            trunk_kink_angle_deg: 46.59171597633136,
        },
    },
    { id: 'slanting', patch: { backbone_tilt_bias: 0.62 } },
    { id: 'literati', patch: { scaffold_first_attach_ratio: 0.9, scaffold_density: 0.12 } },
    { id: 'full_cascade', patch: { backbone_tilt_bias: 1 } },
    { id: 'semi_cascade', patch: { backbone_tilt_bias: 0.82 } },
    { id: 'weeping', patch: { scaffold_gravity_strength: 1 } },
    {
        id: 'low_triangle',
        classifierId: 'formal_upright',
        patch: {
            apical_dominance: 0.94,
            scaffold_shape_mode: 0,
            scaffold_global_pitch_deg: 26,
            scaffold_first_attach_ratio: 0.1,
            scaffold_density: 0.78,
            scaffold_upper_coverage: 0.24,
            scaffold_anchor_lower_bias: 0.92,
            scaffold_length_decay: 0.9,
        },
    },
]);

const resolveSeedCount = () => {
    const token = process.argv.slice(2).find((entry) => entry.startsWith('--seeds='));
    if (!token) return DEFAULT_SEED_COUNT;
    const count = Number(token.slice('--seeds='.length));
    if (!Number.isInteger(count) || count < 3 || count > 64) {
        throw new Error(`ZEN_BONSAI_SPINE_AUDIT_SEED_COUNT_INVALID:${String(token)}`);
    }
    return count;
};

const round = (value, digits = 4) => Number(Number(value).toFixed(digits));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const createRootNodeRandom = (seed) => {
    const topologyRandom = createStructuralNodeRandom({
        seed: resolveStructuralSeed(new SeededRandom(seed), 0),
        parentNodeId: 'root',
        depth: 0,
        nodeRole: 'topology',
        nodeSlot: 0,
        decisionType: 'sakura',
    });
    return topologyRandom.fork({
        depth: 1,
        nodeRole: 'trunk',
        nodeSlot: 0,
        decisionType: 'root_branch',
    });
};
const normalizeAngle = (value) => {
    let angle = Number(value) || 0;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
};

const inspectStructuralTopology = (topology) => {
    let node = topology;
    let startX = 0;
    let startY = 0;
    let angle = Number.isFinite(Number(topology?.initialAngle))
        ? Number(topology.initialAngle)
        : -Math.PI / 2;
    const jointDeltas = [];
    let trunkSegmentCount = 0;
    let terminalCount = 0;
    let nonStructuralBranchCount = 0;
    let firstAngle = angle;
    let endpoint = { x: 0, y: 0 };
    let maximumDrop = 0;
    const scan = (entry) => {
        terminalCount += Array.isArray(entry?.terminals) ? entry.terminals.length : 0;
        (Array.isArray(entry?.branches) ? entry.branches : []).forEach((child) => {
            if (Number(child?.obj?.branchOrder) > SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) {
                nonStructuralBranchCount += 1;
            }
            if (child?.obj) scan(child.obj);
        });
    };
    scan(topology);

    while (node?.type === 'branch' && Number(node.branchOrder) === SAKURA_BRANCH_ORDER.TRUNK) {
        const geometry = BranchGeometryModel.createSegment({
            startX,
            startY,
            angle,
            length: Number(node.length),
            curve: Number(node.curve) || 0,
            curveIn: node.curveIn,
            curveOut: node.curveOut,
            exactCubicControl: node.exactCubicControl,
        });
        if (trunkSegmentCount === 0) firstAngle = angle;
        endpoint = { x: geometry.endX, y: geometry.endY };
        maximumDrop = Math.max(
            maximumDrop,
            ...Array.from({ length: 9 }, (_, index) => (
                BranchGeometryModel.pointAt(geometry, index / 8).y
            )),
        );
        trunkSegmentCount += 1;
        const continuation = (node.branches || []).find((child) => (
            Number(child?.obj?.branchOrder) === SAKURA_BRANCH_ORDER.TRUNK
        ));
        if (!continuation) break;
        const attachT = Number.isFinite(Number(continuation.t)) ? Number(continuation.t) : 1;
        const attachment = BranchGeometryModel.pointAndAngleAt(geometry, attachT);
        const childAngle = attachment.angle + (Number(continuation.angleOffset) || 0);
        const childGeometry = BranchGeometryModel.createSegment({
            startX: attachment.x,
            startY: attachment.y,
            angle: childAngle,
            length: Number(continuation.obj.length),
            curve: Number(continuation.obj.curve) || 0,
            curveIn: continuation.obj.curveIn,
            curveOut: continuation.obj.curveOut,
            exactCubicControl: continuation.obj.exactCubicControl,
        });
        jointDeltas.push(Math.abs(normalizeAngle(
            BranchGeometryModel.angleAt(childGeometry, 0) - attachment.angle,
        )) * (180 / Math.PI));
        node = continuation.obj;
        startX = attachment.x;
        startY = attachment.y;
        angle = childAngle;
    }
    return {
        trunkSegmentCount,
        maxJointTangentDeltaDeg: jointDeltas.length ? Math.max(...jointDeltas) : 0,
        meanJointTangentDeltaDeg: jointDeltas.length ? mean(jointDeltas) : 0,
        terminalCount,
        nonStructuralBranchCount,
        guideId: topology?.trunkDepthModel?.trunkGuideId || null,
        firstAngle,
        endpoint,
        maximumDrop,
    };
};

const inspectPathPlan = ({ seed, phenotype, spineReferenceFamily = null }) => {
    const params = resolveSakuraTrunkGeminiParamsFromGene(phenotype);
    const targetHeight = Number(params.maxHeight);
    const segmentLength = resolveSakuraTrunkGeminiSegmentLength({
        targetHeight,
        segments: SAKURA_TRUNK_LATENT_INTEGRATION_STEPS,
    });
    const rootRandom = createRootNodeRandom(seed);
    const rootAngle = resolveSakuraTrunkGeminiRootAngle(params);
    const plan = createSakuraTrunkPathPlanV1({
        gene: phenotype,
        trunkGeminiParams: params,
        structuralMaxDepth: SAKURA_TRUNK_LATENT_INTEGRATION_STEPS + 2,
        rootState: {
            currentDepth: 1,
            currentX: 0,
            currentY: 0,
            length: segmentLength,
            width: 10,
            parentAngle: rootAngle,
            lastDir: 1,
            trunkMainDepth: 1,
            trunkBaseWidth: 10,
            trunkSegmentLength: segmentLength,
        },
        rootNodeRandom: rootRandom,
        trunkTargetHeight: targetHeight,
        spineReferenceFamily,
    });
    const naturalness = analyzeSakuraMacroSpineNaturalnessV1({
        shape: plan.shape,
        emittedSpans: plan.spans,
        emittedScale: targetHeight,
    });
    const singleSampleImpulses = naturalness.turnEvents.filter(
        (event) => event.classification === 'single_sample_impulse',
    );
    const alternatingEqualZigzag = naturalness.alternatingEqualZigzag.detected
        ? {
            ...naturalness.alternatingEqualZigzag,
            turnEvents: naturalness.turnEvents.filter((event) => (
                event.highTurn
                && event.centerArcNorm
                    >= naturalness.alternatingEqualZigzag.startArcNorm - 1e-8
                && event.centerArcNorm
                    <= naturalness.alternatingEqualZigzag.endArcNorm + 1e-8
            )),
        }
        : null;
    const end = plan.guide.anchors.at(-1);
    return {
        guideAnchorCount: plan.guide.anchors.length,
        guideId: plan.guideId,
        adaptiveSpanCount: plan.adaptiveDiscretization.spanCount,
        targetAdjacentArcRatio: plan.adaptiveDiscretization.targetAdjacentArcRatio,
        achievedMaxAdjacentArcRatio: plan.adaptiveDiscretization.achievedMaxAdjacentArcRatio,
        arcBalanceLimitedByHardCap: plan.adaptiveDiscretization.arcBalanceLimitedByHardCap,
        guideEndpoint: { x: end.x, y: end.y },
        guideMaximumDrop: Math.max(0, ...plan.guide.anchors.map((anchor) => anchor.y)),
        firstSpanAngle: plan.spans[0].parentAngle,
        spanEndpoint: {
            x: plan.spans.at(-1).branchSegment.endX / targetHeight,
            y: plan.spans.at(-1).branchSegment.endY / targetHeight,
        },
        naturalness: {
            finiteSupportJointCount: naturalness.finiteSupportJointCount,
            singleSampleImpulseCount: naturalness.singleSampleImpulseCount,
            turnConcentration: naturalness.turnConcentration.maxWindowTurnShare,
            longestStraightAfterHighTurnArcRatio:
                naturalness.straightAfterHighTurn.arcRatio,
            sharpStraightSharpDetected:
                naturalness.flags.sharpStraightSharpDetected,
            alternatingEqualZigzagDetected:
                naturalness.flags.alternatingEqualZigzagDetected,
            curvatureRateAbsP95:
                naturalness.curvatureDynamics.curvatureRateAbsP95,
            curvatureJerkAbsP95:
                naturalness.curvatureDynamics.curvatureJerkAbsP95,
            guideEmissionPointRmsNorm: naturalness.fidelity.pointRmsNorm,
            guideEmissionPointMaxNorm: naturalness.fidelity.pointMaxNorm,
            guideEmissionTangentRmsDeg: naturalness.fidelity.tangentRmsDeg,
            guideEmissionTangentMaxDeg: naturalness.fidelity.tangentMaxDeg,
            guideEmissionDriftDetected: naturalness.fidelity.driftDetected,
            singleSampleImpulses,
            alternatingEqualZigzag,
            proceduralBendEvents: plan.proceduralBendEvents,
            guideAnchors: plan.guide.anchors.map(({ x, y }) => ({ x, y })),
        },
        spineReferenceFamily: plan.spineReferenceFamily || null,
    };
};

const resolveShapeRmsDistance = (leftGuide, rightGuide) => {
    const leftShape = fitSakuraMacroSpineGuideC1V1(leftGuide);
    const rightShape = fitSakuraMacroSpineGuideC1V1(rightGuide);
    const squaredDistances = Array.from({ length: 33 }, (_, index) => {
        const arcNorm = index / 32;
        const left = sampleSakuraMacroSpineShapeAtArcNorm(leftShape, arcNorm);
        const right = sampleSakuraMacroSpineShapeAtArcNorm(rightShape, arcNorm);
        return ((right.x - left.x) ** 2) + ((right.y - left.y) ** 2);
    });
    return Math.sqrt(mean(squaredDistances));
};

const createReferenceFamilyAudit = ({ seeds: auditSeeds }) => {
    const referenceGuide = createSakuraMacroSpineGuideV1({
        anchors: [
            { x: 0, y: 0 },
            { x: 0.18, y: -0.26 },
            { x: -0.1, y: -0.57 },
            { x: 0.22, y: -0.86 },
        ],
        adherence: 1,
        source: 'authored',
    });
    const basePhenotype = compileSakuraPhenotypeFromLatent(baseLatent);
    const contrastPhenotype = compileSakuraPhenotypeFromLatent({
        ...baseLatent,
        backbone_tilt_bias: 1,
        trunk_curve_amp: 0.83,
        trunk_curve_freq: 1.75,
        trunk_kink_prob: 0.76,
    });
    const levels = [0.35, 0.72, 0.9, 1].map((likeness) => {
        const family = createSakuraSpineReferenceFamilyV1({
            referenceGuide,
            likeness,
        });
        const samples = auditSeeds.map((seed) => {
            const sample = sampleSakuraSpineReferenceFamilyV1({
                family,
                structuralRandom: createRootNodeRandom(seed),
            });
            const repeated = sampleSakuraSpineReferenceFamilyV1({
                family,
                structuralRandom: createRootNodeRandom(seed),
            });
            const basePlan = inspectPathPlan({
                seed,
                phenotype: basePhenotype,
                spineReferenceFamily: family,
            });
            const contrastPlan = inspectPathPlan({
                seed,
                phenotype: contrastPhenotype,
                spineReferenceFamily: family,
            });
            const topology = SakuraStructuralABSpecies.generateStructuralTopology(
                new SeededRandom(seed),
                STAGE,
                TOPOLOGY_HEIGHT,
                basePhenotype,
                { spineReferenceFamily: family },
            );
            const topologyInspection = inspectStructuralTopology(topology);
            return {
                variantGuideId: sample.variantGuideId,
                rmsDistance: resolveShapeRmsDistance(referenceGuide, sample.guide),
                deterministic: repeated.variantGuideId === sample.variantGuideId,
                sameVariantAcrossPhenotypes: (
                    basePlan.spineReferenceFamily?.variantGuideId
                    === contrastPlan.spineReferenceFamily?.variantGuideId
                ),
                topologyProvenanceMatches: (
                    topology?.trunkDepthModel?.spineReferenceVariantGuideId
                    === basePlan.spineReferenceFamily?.variantGuideId
                ),
                structuralOnly: topologyInspection.terminalCount === 0
                    && topologyInspection.nonStructuralBranchCount === 0,
                spanCount: topologyInspection.trunkSegmentCount,
            };
        });
        return {
            likeness,
            familyId: family.familyId,
            sampleCount: samples.length,
            uniqueVariantCount: new Set(samples.map((sample) => sample.variantGuideId)).size,
            rmsDistanceMean: round(mean(samples.map((sample) => sample.rmsDistance)), 6),
            rmsDistanceMax: round(Math.max(...samples.map((sample) => sample.rmsDistance)), 6),
            deterministic: samples.every((sample) => sample.deterministic),
            sameVariantAcrossPhenotypes: samples.every(
                (sample) => sample.sameVariantAcrossPhenotypes,
            ),
            topologyProvenanceMatches: samples.every(
                (sample) => sample.topologyProvenanceMatches,
            ),
            structuralOnly: samples.every((sample) => sample.structuralOnly),
            spanCountRange: [
                Math.min(...samples.map((sample) => sample.spanCount)),
                Math.max(...samples.map((sample) => sample.spanCount)),
            ],
        };
    });
    const checks = {
        stableFamilyIdentityAcrossLikeness: new Set(
            levels.map((entry) => entry.familyId),
        ).size === 1,
        likenessContractsTowardReference: levels.every((entry, index) => (
            index === 0
            || entry.rmsDistanceMean <= levels[index - 1].rmsDistanceMean + 1e-8
        )),
        exactAtOne: levels.at(-1).rmsDistanceMax === 0,
        seededVariationPresent: levels.find((entry) => entry.likeness === 0.72)
            ?.uniqueVariantCount > 1,
        deterministic: levels.every((entry) => entry.deterministic),
        sameVariantAcrossPhenotypes: levels.every(
            (entry) => entry.sameVariantAcrossPhenotypes,
        ),
        topologyProvenanceMatches: levels.every(
            (entry) => entry.topologyProvenanceMatches,
        ),
        structuralOnly: levels.every((entry) => entry.structuralOnly),
        adaptiveSpanBounds: levels.every((entry) => (
            entry.spanCountRange[0] >= 8 && entry.spanCountRange[1] <= 48
        )),
    };
    return {
        referenceGuideId: referenceGuide.guideId,
        levels,
        checks,
        passed: Object.values(checks).every(Boolean),
    };
};

const seedCount = resolveSeedCount();
const seeds = Array.from({ length: seedCount }, (_, index) => SEED_BASE + (index * 104729));
const baseLatent = getDefaultSakuraLatent();
const variants = VARIANTS.map((variant) => {
    const latent = { ...baseLatent, ...variant.patch };
    const phenotype = compileSakuraPhenotypeFromLatent(latent);
    const samples = seeds.map((seed) => {
        const topology = SakuraSpecies.generateStructuralTopology(
            new SeededRandom(seed),
            STAGE,
            TOPOLOGY_HEIGHT,
            phenotype,
        );
        const descriptor = BonsaiStructuralDescriptorModel.analyze(topology, {
            potHeight: POT_HEIGHT,
        });
        const classification = BonsaiFormClassifier.classify(descriptor);
        const targetId = variant.classifierId || variant.id;
        const targetScore = classification.memberships.find((entry) => entry.id === targetId)?.score || 0;
        return {
            seed,
            descriptor,
            classification,
            targetScore,
            plan: inspectPathPlan({ seed, phenotype }),
            topology: inspectStructuralTopology(topology),
        };
    });
    return {
        id: variant.id,
        classifierId: variant.classifierId || variant.id,
        sampleCount: samples.length,
        targetScore: {
            mean: round(mean(samples.map((sample) => sample.targetScore))),
            max: round(Math.max(...samples.map((sample) => sample.targetScore))),
        },
        primaryRate: round(samples.filter((sample) => (
            sample.classification.primaryFormId === (variant.classifierId || variant.id)
        )).length / samples.length),
        composition: {
            crownTriangularityMean: round(mean(samples.map(
                (sample) => sample.descriptor.crown.triangularity,
            ))),
            crownTriangularityMax: round(Math.max(...samples.map(
                (sample) => sample.descriptor.crown.triangularity,
            ))),
            treeWidthToHeightMean: round(mean(samples.map((sample) => (
                sample.descriptor.bounds.width
                / Math.max(1e-8, sample.descriptor.bounds.height)
            )))),
            treeWidthToHeightMax: round(Math.max(...samples.map((sample) => (
                sample.descriptor.bounds.width
                / Math.max(1e-8, sample.descriptor.bounds.height)
            )))),
            crownWidthToTreeHeightMean: round(mean(samples.map(
                (sample) => sample.descriptor.crown.widthToTreeHeight,
            ))),
            crownFirstAttachPathRatioMean: round(mean(samples.map(
                (sample) => sample.descriptor.crown.firstAttachPathRatio,
            ))),
            crownHeightToTreeHeightMean: round(mean(samples.map(
                (sample) => sample.descriptor.crown.heightToTreeHeight,
            ))),
        },
        trunk: {
            spanCountMin: Math.min(...samples.map((sample) => sample.topology.trunkSegmentCount)),
            spanCountMax: Math.max(...samples.map((sample) => sample.topology.trunkSegmentCount)),
            targetAdjacentArcRatio: samples[0].plan.targetAdjacentArcRatio,
            achievedMaxAdjacentArcRatio: round(Math.max(...samples.map(
                (sample) => sample.plan.achievedMaxAdjacentArcRatio,
            ))),
            arcBalanceHardCapLimitedCount: samples.filter(
                (sample) => sample.plan.arcBalanceLimitedByHardCap,
            ).length,
            maxJointTangentDeltaDeg: round(Math.max(...samples.map(
                (sample) => sample.topology.maxJointTangentDeltaDeg,
            ))),
            meanJointTangentDeltaDeg: round(mean(samples.map(
                (sample) => sample.topology.meanJointTangentDeltaDeg,
            ))),
            signedNetLeanDegRange: [
                round(Math.min(...samples.map((sample) => sample.descriptor.trunk.signedNetLeanDeg))),
                round(Math.max(...samples.map((sample) => sample.descriptor.trunk.signedNetLeanDeg))),
            ],
            lowestPointPotRatioMax: round(Math.max(...samples.map(
                (sample) => sample.descriptor.trunk.lowestPointPotRatio,
            ))),
            descendingPathRatioMax: round(Math.max(...samples.map(
                (sample) => sample.descriptor.trunk.descendingPathRatio,
            ))),
            guideEndpointXRange: [
                round(Math.min(...samples.map((sample) => sample.plan.guideEndpoint.x))),
                round(Math.max(...samples.map((sample) => sample.plan.guideEndpoint.x))),
            ],
            guideEndpointYRange: [
                round(Math.min(...samples.map((sample) => sample.plan.guideEndpoint.y))),
                round(Math.max(...samples.map((sample) => sample.plan.guideEndpoint.y))),
            ],
            guideMaximumDrop: round(Math.max(...samples.map(
                (sample) => sample.plan.guideMaximumDrop,
            ))),
            firstAngleDeltaDegMax: round(Math.max(...samples.map((sample) => (
                Math.abs(normalizeAngle(
                    sample.topology.firstAngle - sample.plan.firstSpanAngle,
                )) * (180 / Math.PI)
            )))),
            topologyEndpointYMax: round(Math.max(...samples.map(
                (sample) => sample.topology.endpoint.y / TOPOLOGY_HEIGHT,
            ))),
            planEndpointYMax: round(Math.max(...samples.map(
                (sample) => sample.plan.spanEndpoint.y,
            ))),
            guideIdentityMatches: samples.every((sample) => (
                sample.topology.guideId === sample.plan.guideId
            )),
            naturalness: {
                finiteSupportJointCountMean: round(mean(samples.map(
                    (sample) => sample.plan.naturalness.finiteSupportJointCount,
                ))),
                singleSampleImpulseCount: samples.reduce((sum, sample) => (
                    sum + sample.plan.naturalness.singleSampleImpulseCount
                ), 0),
                singleSampleImpulseCases: samples.flatMap((sample) => (
                    sample.plan.naturalness.singleSampleImpulses.map((event) => ({
                        seed: sample.seed,
                        event,
                        proceduralBendEvents:
                            sample.plan.naturalness.proceduralBendEvents,
                        guideAnchors: sample.plan.naturalness.guideAnchors,
                    }))
                )),
                turnConcentrationMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.turnConcentration,
                )), 6),
                longestStraightAfterHighTurnArcRatioMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.longestStraightAfterHighTurnArcRatio,
                )), 6),
                sharpStraightSharpCount: samples.filter(
                    (sample) => sample.plan.naturalness.sharpStraightSharpDetected,
                ).length,
                alternatingEqualZigzagCount: samples.filter(
                    (sample) => sample.plan.naturalness.alternatingEqualZigzagDetected,
                ).length,
                alternatingEqualZigzagCases: samples.flatMap((sample) => (
                    sample.plan.naturalness.alternatingEqualZigzag
                        ? [{
                            seed: sample.seed,
                            event: sample.plan.naturalness.alternatingEqualZigzag,
                            proceduralBendEvents:
                                sample.plan.naturalness.proceduralBendEvents,
                            guideAnchors: sample.plan.naturalness.guideAnchors,
                        }]
                        : []
                )),
                curvatureRateAbsP95Max: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.curvatureRateAbsP95,
                )), 6),
                curvatureJerkAbsP95Max: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.curvatureJerkAbsP95,
                )), 6),
                guideEmissionPointRmsNormMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.guideEmissionPointRmsNorm,
                )), 8),
                guideEmissionPointMaxNormMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.guideEmissionPointMaxNorm,
                )), 8),
                guideEmissionTangentRmsDegMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.guideEmissionTangentRmsDeg,
                )), 6),
                guideEmissionTangentMaxDegMax: round(Math.max(...samples.map(
                    (sample) => sample.plan.naturalness.guideEmissionTangentMaxDeg,
                )), 6),
                guideEmissionDriftCount: samples.filter(
                    (sample) => sample.plan.naturalness.guideEmissionDriftDetected,
                ).length,
            },
        },
        structuralOnly: samples.every((sample) => (
            sample.topology.terminalCount === 0
            && sample.topology.nonStructuralBranchCount === 0
        )),
    };
});

const referenceFamily = createReferenceFamilyAudit({ seeds });

process.stdout.write(`${JSON.stringify({
    version: 1,
    source: 'zen_bonsai_spine_cutover_audit_v1',
    seedCount,
    topologyHeight: TOPOLOGY_HEIGHT,
    renderUsed: false,
    variants,
    referenceFamily,
}, null, 2)}\n`);

if (!referenceFamily.passed) {
    throw new Error('ZEN_BONSAI_SPINE_REFERENCE_FAMILY_AUDIT_FAILED');
}
