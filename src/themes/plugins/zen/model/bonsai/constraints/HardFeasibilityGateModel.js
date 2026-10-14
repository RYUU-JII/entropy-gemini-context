const EPS = 1e-6;

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const degToRad = (deg) => (deg * Math.PI) / 180;
const radToDeg = (rad) => (rad * 180) / Math.PI;
const round = (value, digits = 4) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const readNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const DEFAULT_HARD_FEASIBILITY_RULES = Object.freeze({
    maxMajorOffsetDeg: 72,
    maxReversalRate: 0.26,
    maxReversalCount: 3,
    maxContinuationDownwardRate: 0.68,
    maxTrunkDownwardRate: 0.42,

    minTaperContinuity: 0.2,
    minTaperStability: 0.16,
    minPrimaryBranchLift: 0.08,
    minSilhouetteFill: 0.14,
    minStructuralComplexity: 0.08,
    minMassBalance: 0.1,
    minBranchCrossingScore: 0.08,
    maxCrossingRate: 0.34,

    minBranchCount: 6,
    maxBranchCount: 240,
    deepSparseDepth: 6,
    deepSparseMinBranches: 10,
    shallowNoisyDepth: 3,
    shallowNoisyMaxBranches: 120,
    maxMassOffsetRatio: 0.46,

    minFlowersWhenBloomStage: 1,
    denseFlowerCount: 8,
    minBloomClusteringWhenDense: 0.04,

    preflightMinContinuityScore: 0.1,
    preflightMaxAngleDispersion: 2.2,
    preflightMaxDroopMagnitude: 1.4,
    preflightMinSparsePotential: 0.05,
    preflightMaxDensityBurst: 0.7,
    preflightMinBloomPotential: 0.02,
    preflightMinBloomDensity: 0.1,
});

const resolveContinuationChildren = (branches = []) => {
    const candidates = (Array.isArray(branches) ? branches : []).filter((entry) => entry?.obj);
    if (!candidates.length) {
        return new Set();
    }
    const strict = candidates.filter((entry) => readNumber(entry?.t, -1) >= 0.985);
    if (strict.length) {
        return new Set(strict);
    }
    let best = null;
    let bestT = -Infinity;
    candidates.forEach((entry) => {
        const t = readNumber(entry?.t, -1);
        if (t > bestT) {
            bestT = t;
            best = entry;
        }
    });
    if (best && bestT >= 0.92) {
        return new Set([best]);
    }
    return new Set();
};

const collectTopologySignals = (topology) => {
    if (!topology || topology.type !== 'branch') {
        return {
            branchEdgeCount: 0,
            continuationCount: 0,
            trunkContinuationCount: 0,
            continuationDownwardCount: 0,
            trunkDownwardCount: 0,
            reversalCount: 0,
            majorOffsetViolations: 0,
            maxAbsOffsetDeg: 0,
            continuationDownwardRate: 0,
            trunkDownwardRate: 0,
            reversalRate: 0,
        };
    }

    let branchEdgeCount = 0;
    let continuationCount = 0;
    let trunkContinuationCount = 0;
    let continuationDownwardCount = 0;
    let trunkDownwardCount = 0;
    let reversalCount = 0;
    let majorOffsetViolations = 0;
    let maxAbsOffset = 0;

    const walk = (
        node,
        absoluteAngle,
        depth = 1,
        parentOffset = 0,
        parentSign = 0,
        parentWasContinuation = false,
    ) => {
        if (!node || node.type !== 'branch') {
            return;
        }
        const children = Array.isArray(node.branches) ? node.branches.filter((entry) => entry?.obj) : [];
        const continuationSet = resolveContinuationChildren(children);

        children.forEach((child) => {
            const offset = readNumber(child?.angleOffset, 0);
            const absOffset = Math.abs(offset);
            const sign = Math.sign(offset);
            const isContinuation = continuationSet.has(child);
            const childAngle = absoluteAngle + offset;
            const isMajorPath = depth <= 3 || isContinuation;

            branchEdgeCount += 1;
            maxAbsOffset = Math.max(maxAbsOffset, absOffset);

            if (isMajorPath && absOffset > degToRad(70)) {
                majorOffsetViolations += 1;
            }
            if (
                parentWasContinuation
                && isContinuation
                && parentSign !== 0
                && sign !== 0
                && parentSign !== sign
                && Math.abs(parentOffset) > degToRad(34)
                && absOffset > degToRad(34)
            ) {
                reversalCount += 1;
            }
            if (isContinuation) {
                continuationCount += 1;
                if (Math.sin(childAngle) > 0.18) {
                    continuationDownwardCount += 1;
                }
                if (depth <= 2) {
                    trunkContinuationCount += 1;
                    if (Math.sin(childAngle) > 0.12) {
                        trunkDownwardCount += 1;
                    }
                }
            }

            walk(child.obj, childAngle, depth + 1, offset, sign, isContinuation);
        });
    };

    const rootAngle = readNumber(topology?.initialAngle, -Math.PI / 2);
    walk(topology, rootAngle, 1, 0, 0, false);

    const continuationDownwardRate = continuationCount > 0
        ? continuationDownwardCount / continuationCount
        : 0;
    const trunkDownwardRate = trunkContinuationCount > 0
        ? trunkDownwardCount / trunkContinuationCount
        : 0;
    const reversalRate = continuationCount > 1
        ? reversalCount / (continuationCount - 1)
        : 0;

    return {
        branchEdgeCount,
        continuationCount,
        trunkContinuationCount,
        continuationDownwardCount,
        trunkDownwardCount,
        reversalCount,
        majorOffsetViolations,
        maxAbsOffsetDeg: radToDeg(maxAbsOffset),
        continuationDownwardRate,
        trunkDownwardRate,
        reversalRate,
    };
};

const resolveEffectiveMaxMassOffsetRatio = (rules, analysis) => {
    const structural = analysis?.structural || {};
    const factors = analysis?.factors || {};
    const branchCount = readNumber(structural?.branchCount, 0);
    const trunkNetLeanDeg = Math.abs(readNumber(factors?.trunkDynamics?.netLeanDeg, 0));
    const branchComplexityAllowance = clamp((branchCount - 100) / 140, 0, 1) * 0.08;
    const trunkLeanAllowance = clamp((trunkNetLeanDeg - 8) / 20, 0, 1) * 0.1;
    const totalAllowance = clamp(branchComplexityAllowance + trunkLeanAllowance, 0, 0.18);
    return rules.maxMassOffsetRatio + totalAllowance;
};

const computeSoftPenalty = (signals, analysis, rules) => {
    const features = analysis?.features || {};
    const factors = analysis?.factors || {};
    const structural = analysis?.structural || {};
    const width = Math.max(1, readNumber(structural?.width, 1));
    const centerOfMassX = Math.abs(readNumber(factors?.centerOfMassX, 0));
    const massOffsetRatio = centerOfMassX / Math.max(1, width * 0.5);
    const effectiveMaxMassOffsetRatio = resolveEffectiveMaxMassOffsetRatio(rules, analysis);
    const penalties = [
        clamp01((readNumber(signals?.maxAbsOffsetDeg, 0) - (rules.maxMajorOffsetDeg - 10)) / 28),
        clamp01((readNumber(signals?.reversalRate, 0) - (rules.maxReversalRate * 0.75)) / 0.4),
        clamp01((readNumber(signals?.continuationDownwardRate, 0) - (rules.maxContinuationDownwardRate * 0.82)) / 0.5),
        clamp01((rules.minTaperContinuity - readNumber(features?.taperQuality, 1)) / 0.26),
        clamp01((rules.minBranchCrossingScore - readNumber(features?.branchCrossing, 1)) / 0.26),
        clamp01((readNumber(factors?.crossingRate, 0) - (rules.maxCrossingRate * 0.72)) / 0.25),
        clamp01((rules.minMassBalance - readNumber(features?.massBalance, 1)) / 0.28),
        clamp01((massOffsetRatio - (effectiveMaxMassOffsetRatio * 0.82)) / 0.35),
    ];
    let penaltySum = 0;
    penalties.forEach((p) => {
        if (p > 0) penaltySum += p;
    });
    // Scale down penalty impact slightly so trees with minor flaws can survive and reproduce
    const meanPenalty = penaltySum / Math.max(1, penalties.filter((p) => p > 0).length || 1);
    return clamp01(meanPenalty * 0.75);
};

export class HardFeasibilityGateModel {
    constructor({
        treeType = 'sakura',
        rules = null,
    } = {}) {
        this.treeType = treeType;
        this.rules = {
            ...DEFAULT_HARD_FEASIBILITY_RULES,
            ...(rules || {}),
        };
    }

    evaluate({
        topology = null,
        analysis = null,
        stage = null,
    } = {}) {
        const failedRules = [];
        const pushFailure = (id, detail = {}) => {
            failedRules.push({
                id,
                ...detail,
            });
        };

        if (!topology || !analysis) {
            pushFailure('missing_topology_or_analysis');
            return {
                pass: false,
                passProbability: 0.05,
                failedRules,
                signals: null,
            };
        }

        const features = analysis?.features || {};
        const structural = analysis?.structural || {};
        const factors = analysis?.factors || {};
        const density = analysis?.density || {};
        const rules = this.rules;
        const topologySignals = collectTopologySignals(topology);

        const branchCount = readNumber(structural?.branchCount, 0);
        const maxDepth = readNumber(structural?.maxDepth, 0);
        const taperQuality = readNumber(features?.taperQuality, 0);
        const taperStability = readNumber(features?.taperStability, 0);
        const primaryBranchLift = readNumber(features?.primaryBranchLift, 0);
        const silhouetteFill = readNumber(features?.silhouetteFill, 0);
        const structuralComplexity = readNumber(features?.structuralComplexity, 0);
        const massBalance = readNumber(features?.massBalance, 0);
        const branchCrossing = readNumber(features?.branchCrossing, 0);
        const crossingRate = readNumber(factors?.crossingRate, 0);
        const bloomClustering = readNumber(features?.bloomClustering, 0);
        const flowerCount = readNumber(density?.flowers, 0);
        const width = Math.max(1, readNumber(structural?.width, 1));
        const centerOfMassX = Math.abs(readNumber(factors?.centerOfMassX, 0));
        const massOffsetRatio = centerOfMassX / Math.max(1, width * 0.5);
        const effectiveMaxMassOffsetRatio = resolveEffectiveMaxMassOffsetRatio(rules, analysis);
        const stageFlowerChance = clamp01(readNumber(stage?.flowerChance, 0));
        const expectsBloom = stageFlowerChance >= 0.55;

        if (branchCount <= 0 || maxDepth <= 0) {
            pushFailure('invalid_structure', {
                branchCount,
                maxDepth,
            });
            return { // Immediate critical failure
                pass: false,
                passProbability: 0,
                failedRules,
                warningScore: 1,
                signals: null,
            };
        }
        if (readNumber(topologySignals.maxAbsOffsetDeg, 0) > rules.maxMajorOffsetDeg + EPS) {
            pushFailure('major_bend_overflow', {
                observed: round(topologySignals.maxAbsOffsetDeg, 3),
                threshold: round(rules.maxMajorOffsetDeg, 3),
            });
        }
        if (
            topologySignals.reversalCount > rules.maxReversalCount
            || topologySignals.reversalRate > rules.maxReversalRate
        ) {
            pushFailure('direction_reversal_chain', {
                reversalCount: topologySignals.reversalCount,
                reversalRate: round(topologySignals.reversalRate, 4),
                maxReversalRate: rules.maxReversalRate,
            });
        }
        if (
            topologySignals.continuationCount >= 4
            && topologySignals.continuationDownwardRate > rules.maxContinuationDownwardRate
        ) {
            pushFailure('continuation_downward_overload', {
                downwardRate: round(topologySignals.continuationDownwardRate, 4),
                maxDownwardRate: rules.maxContinuationDownwardRate,
            });
        }
        if (
            topologySignals.trunkContinuationCount >= 2
            && topologySignals.trunkDownwardRate > rules.maxTrunkDownwardRate
        ) {
            pushFailure('trunk_downward_overload', {
                downwardRate: round(topologySignals.trunkDownwardRate, 4),
                maxDownwardRate: rules.maxTrunkDownwardRate,
            });
        }

        if (taperQuality < rules.minTaperContinuity) {
            pushFailure('taper_continuity_breakdown', {
                observed: round(taperQuality, 4),
                threshold: rules.minTaperContinuity,
            });
        }
        if (taperStability < rules.minTaperStability) {
            pushFailure('taper_stability_breakdown', {
                observed: round(taperStability, 4),
                threshold: rules.minTaperStability,
            });
        }
        if (branchCrossing < rules.minBranchCrossingScore || crossingRate > rules.maxCrossingRate) {
            pushFailure('major_crossing_overload', {
                branchCrossing: round(branchCrossing, 4),
                crossingRate: round(crossingRate, 4),
                minBranchCrossingScore: rules.minBranchCrossingScore,
                maxCrossingRate: rules.maxCrossingRate,
            });
        }

        if (branchCount < rules.minBranchCount || branchCount > rules.maxBranchCount) {
            pushFailure('branch_count_out_of_band', {
                branchCount,
                minBranchCount: rules.minBranchCount,
                maxBranchCount: rules.maxBranchCount,
            });
        }
        if (maxDepth >= rules.deepSparseDepth && branchCount < rules.deepSparseMinBranches) {
            pushFailure('deep_structure_sparse_terminal', {
                maxDepth,
                branchCount,
                minBranchesAtDepth: rules.deepSparseMinBranches,
            });
        }
        if (maxDepth <= rules.shallowNoisyDepth && branchCount > rules.shallowNoisyMaxBranches) {
            pushFailure('shallow_structure_overdense', {
                maxDepth,
                branchCount,
                maxBranchesAtDepth: rules.shallowNoisyMaxBranches,
            });
        }

        if (silhouetteFill < rules.minSilhouetteFill) {
            pushFailure('silhouette_underfill', {
                observed: round(silhouetteFill, 4),
                threshold: rules.minSilhouetteFill,
            });
        }
        if (structuralComplexity < rules.minStructuralComplexity) {
            pushFailure('structural_complexity_underflow', {
                observed: round(structuralComplexity, 4),
                threshold: rules.minStructuralComplexity,
            });
        }
        if (primaryBranchLift < rules.minPrimaryBranchLift) {
            pushFailure('primary_lift_collapse', {
                observed: round(primaryBranchLift, 4),
                threshold: rules.minPrimaryBranchLift,
            });
        }
        if (massBalance < rules.minMassBalance || massOffsetRatio > effectiveMaxMassOffsetRatio) {
            pushFailure('mass_balance_drift', {
                massBalance: round(massBalance, 4),
                massOffsetRatio: round(massOffsetRatio, 4),
                minMassBalance: rules.minMassBalance,
                maxMassOffsetRatio: round(effectiveMaxMassOffsetRatio, 4),
                baseMaxMassOffsetRatio: rules.maxMassOffsetRatio,
            });
        }

        if (expectsBloom && flowerCount < rules.minFlowersWhenBloomStage) {
            pushFailure('bloom_presence_missing', {
                flowerCount,
                minFlowersWhenBloomStage: rules.minFlowersWhenBloomStage,
                stageFlowerChance: round(stageFlowerChance, 4),
            });
        }
        if (
            flowerCount >= rules.denseFlowerCount
            && bloomClustering < rules.minBloomClusteringWhenDense
        ) {
            pushFailure('bloom_cluster_scatter', {
                flowerCount,
                bloomClustering: round(bloomClustering, 4),
                minBloomClusteringWhenDense: rules.minBloomClusteringWhenDense,
            });
        }

        // Instead of binary pass/fail based on failedRules length, we ALWAYS pass the topology evaluation natively.
        // The *quality* of the candidate will be degraded heavily via `warningScore`.
        // This converts hard constraints into soft penalties.
        const pass = true; // Always true to avoid cold-start dropping.
        const softPenalty = computeSoftPenalty(topologySignals, analysis, rules);
        const ruleFailurePenalty = failedRules.length > 0 ? clamp01(failedRules.length * 0.15) : 0;
        const totalWarning = clamp01(softPenalty + ruleFailurePenalty);

        const passProbability = clamp(1.0 - (totalWarning * 0.9), 0.1, 1);

        return {
            pass,
            passProbability: round(passProbability, 4),
            failedRules,
            warningScore: round(softPenalty, 4),
            signals: {
                ...topologySignals,
                massOffsetRatio: round(massOffsetRatio, 4),
                taperQuality: round(taperQuality, 4),
                taperStability: round(taperStability, 4),
                branchCrossing: round(branchCrossing, 4),
                crossingRate: round(crossingRate, 4),
                primaryBranchLift: round(primaryBranchLift, 4),
                silhouetteFill: round(silhouetteFill, 4),
                structuralComplexity: round(structuralComplexity, 4),
                massBalance: round(massBalance, 4),
                flowerCount,
                bloomClustering: round(bloomClustering, 4),
            },
        };
    }

    evaluatePreflightPhenotype({
        phenotype = null,
        stage = null,
        continuityFeasibility = null,
    } = {}) {
        if (!phenotype || typeof phenotype !== 'object') {
            return {
                pass: true,
                passProbability: 1,
                failedRules: [],
                signals: null,
            };
        }

        const rules = this.rules;
        const failedRules = [];
        const pushFailure = (id, detail = {}) => {
            failedRules.push({ id, ...detail });
        };

        const branchAngleVar = readNumber(phenotype.branchAngleVar, 0.35);
        const branchChaos = readNumber(phenotype.branchChaos, 0.5);
        const curvatureStrength = readNumber(phenotype.curvatureStrength, 0.5);
        const droopMiddle = readNumber(phenotype.droopMiddle, 0);
        const droopTip = readNumber(phenotype.droopTip, 0);
        const branchingProb = readNumber(phenotype.branchingProb, 0.62);
        const twigTierBranchingProb = readNumber(phenotype.twigTierBranchingProb, 0.35);
        const lengthBase = readNumber(phenotype.lengthBase, 0.8);
        const scaffoldStrength = readNumber(phenotype.scaffoldStrength, 0.7);
        const widthTaper = readNumber(phenotype.widthTaper, 0.75);
        const flowerChance = readNumber(phenotype.flowerChance, 0.64);
        const canopyBloomDensity = readNumber(phenotype.canopyBloomDensity, 0.86);

        const angleDispersion = (
            Math.abs(branchAngleVar)
            + (Math.abs(branchChaos) * 0.75)
            + (Math.max(0, curvatureStrength) * 0.16)
        );
        const droopMagnitude = Math.abs(droopMiddle) + Math.abs(droopTip);
        const sparsePotential = (
            Math.max(0, branchingProb)
            * Math.max(0.12, twigTierBranchingProb)
            * Math.max(0.2, lengthBase)
            * Math.max(0.24, scaffoldStrength + 0.18)
        );
        const densityBurst = (
            Math.max(0, branchingProb)
            * Math.max(0, twigTierBranchingProb)
            * Math.max(0.1, 1 - widthTaper)
            * (0.6 + clamp01(branchChaos) * 0.4)
        );

        const stageDepth = readNumber(stage?.depth, 0);
        const stageFlowerChance = clamp01(readNumber(stage?.flowerChance, 0));
        const expectsBloom = stageFlowerChance >= 0.55;

        if (continuityFeasibility && typeof continuityFeasibility === 'object') {
            const continuityPass = Boolean(continuityFeasibility.pass);
            const continuityScore = readNumber(continuityFeasibility.continuityScore, 1);
            if (
                !continuityPass
                && continuityScore < rules.preflightMinContinuityScore
            ) {
                pushFailure('preflight_continuity_far', {
                    continuityScore: round(continuityScore, 4),
                    minContinuityScore: round(rules.preflightMinContinuityScore, 4),
                });
            }
        }
        if (angleDispersion > rules.preflightMaxAngleDispersion) {
            pushFailure('preflight_angle_dispersion_overflow', {
                angleDispersion: round(angleDispersion, 4),
                threshold: round(rules.preflightMaxAngleDispersion, 4),
            });
        }
        if (droopMagnitude > rules.preflightMaxDroopMagnitude) {
            pushFailure('preflight_droop_overflow', {
                droopMagnitude: round(droopMagnitude, 4),
                threshold: round(rules.preflightMaxDroopMagnitude, 4),
            });
        }
        if (stageDepth >= 5 && sparsePotential < rules.preflightMinSparsePotential) {
            pushFailure('preflight_sparse_structure_risk', {
                sparsePotential: round(sparsePotential, 4),
                threshold: round(rules.preflightMinSparsePotential, 4),
                stageDepth,
            });
        }
        if (densityBurst > rules.preflightMaxDensityBurst && branchAngleVar > 0.62) {
            pushFailure('preflight_density_burst_risk', {
                densityBurst: round(densityBurst, 4),
                threshold: round(rules.preflightMaxDensityBurst, 4),
                branchAngleVar: round(branchAngleVar, 4),
            });
        }
        if (
            expectsBloom
            && flowerChance < rules.preflightMinBloomPotential
            && canopyBloomDensity < rules.preflightMinBloomDensity
        ) {
            pushFailure('preflight_bloom_potential_missing', {
                flowerChance: round(flowerChance, 4),
                canopyBloomDensity: round(canopyBloomDensity, 4),
                minBloomPotential: round(rules.preflightMinBloomPotential, 4),
                minBloomDensity: round(rules.preflightMinBloomDensity, 4),
                stageFlowerChance: round(stageFlowerChance, 4),
            });
        }

        // Preflight also uses soft penalties to prevent dropping gen 0 randomly.
        const pass = true;
        const passProbability = failedRules.length === 0
            ? 1
            : clamp(1 - (failedRules.length * 0.2), 0.1, 0.9);

        return {
            pass,
            passProbability: round(passProbability, 4),
            failedRules,
            signals: {
                angleDispersion: round(angleDispersion, 4),
                droopMagnitude: round(droopMagnitude, 4),
                sparsePotential: round(sparsePotential, 4),
                densityBurst: round(densityBurst, 4),
                stageDepth: round(stageDepth, 3),
                stageFlowerChance: round(stageFlowerChance, 4),
                flowerChance: round(flowerChance, 4),
                canopyBloomDensity: round(canopyBloomDensity, 4),
            },
        };
    }
}
