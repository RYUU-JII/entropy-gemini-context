import {
    buildStructuralNodeId,
    sampleStructuralRandom,
} from '../../bonsai/random/StructuralHashRandom';
import { BudQueue } from './BudQueue';
import { TreeGraph } from './TreeGraph';
import {
    getDefaultFactorVectorV1,
    normalizeFactorVectorV1,
} from '../factors/FactorSchemaV1';
import {
    resolveRuntimeParamsFromFactorsV1,
    scoreActionCandidatesV1,
} from '../policy/UtilityScorerV1';
import {
    OccupancyFieldModel,
    LightFieldModel,
    StyleFieldModel,
} from '../fields/index';
import {
    ProvenanceRecorderV1,
} from '../trace/index';
import { resolveVNextMorphologyFeatures } from './VNextMorphologyFeatures';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const lerp = (a, b, t) => a + ((b - a) * clamp01(t));
const toNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value, digits = 6) => Number((Number.isFinite(value) ? value : 0).toFixed(digits));
const vec3 = (x = 0, y = 0, z = 0) => [Number(x), Number(y), Number(z)];
const vecLength = (v = [0, 0, 0]) => Math.sqrt((v[0] * v[0]) + (v[1] * v[1]) + (v[2] * v[2]));
const vecNormalize = (v = [0, 1, 0]) => {
    const len = Math.max(1e-9, vecLength(v));
    return [v[0] / len, v[1] / len, v[2] / len];
};
const vecAdd = (a = [0, 0, 0], b = [0, 0, 0]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vecScale = (v = [0, 0, 0], k = 1) => [v[0] * k, v[1] * k, v[2] * k];

const rotate2D = (direction = [0, 1, 0], radians = 0) => {
    const x = direction[0];
    const y = direction[1];
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return vecNormalize([
        (x * cos) - (y * sin),
        (x * sin) + (y * cos),
        direction[2] || 0,
    ]);
};

const DEFAULT_CONSTRAINTS = Object.freeze({
    maxNodes: 220,
    maxSteps: 26,
    maxDepth: 8,
    bounds: {
        width: 420,
        height: 420,
        depth: 420,
    },
});

const DEFAULT_OPTIONS = Object.freeze({
    enableDeadwood: true,
    enableCollisionPrune: true,
    enableSelfPrune: true,
    traceLevel: 'compact',
    utilitySoftmaxTemp: 0.36,
    stallScoreThreshold: 0.02,
    stallLimit: 2,
    minPruneStep: 6,
    minTerminateStep: 8,
    minDeadwoodStep: 10,
    deadwoodMinBranchOrder: 1,
    maxProvenanceEvents: 4096,
});

const resolveOptions = (options = {}) => ({
    ...DEFAULT_OPTIONS,
    ...(options || {}),
});

const resolveConstraints = (constraints = {}) => {
    const merged = {
        ...DEFAULT_CONSTRAINTS,
        ...(constraints || {}),
        bounds: {
            ...DEFAULT_CONSTRAINTS.bounds,
            ...(constraints?.bounds || {}),
        },
    };
    return {
        maxNodes: Math.max(20, Math.floor(toNumber(merged.maxNodes, DEFAULT_CONSTRAINTS.maxNodes))),
        maxSteps: Math.max(1, Math.floor(toNumber(merged.maxSteps, DEFAULT_CONSTRAINTS.maxSteps))),
        maxDepth: Math.max(1, Math.floor(toNumber(merged.maxDepth, DEFAULT_CONSTRAINTS.maxDepth))),
        bounds: {
            width: Math.max(40, toNumber(merged.bounds.width, DEFAULT_CONSTRAINTS.bounds.width)),
            height: Math.max(40, toNumber(merged.bounds.height, DEFAULT_CONSTRAINTS.bounds.height)),
            depth: Math.max(40, toNumber(merged.bounds.depth, DEFAULT_CONSTRAINTS.bounds.depth)),
        },
    };
};

const softmaxPick = ({
    entries = [],
    temperature = 0.36,
    randomValue = 0.5,
}) => {
    if (!entries.length) {
        return null;
    }
    const temp = Math.max(1e-4, toNumber(temperature, 0.36));
    const maxScore = entries.reduce((acc, entry) => Math.max(acc, toNumber(entry?.score?.total, -Infinity)), -Infinity);
    const exps = entries.map((entry) => Math.exp((toNumber(entry?.score?.total) - maxScore) / temp));
    const sumExp = exps.reduce((acc, value) => acc + value, 0);
    if (!Number.isFinite(sumExp) || sumExp <= 0) {
        return entries[0];
    }
    const roll = clamp01(toNumber(randomValue, 0.5));
    let cursor = 0;
    for (let index = 0; index < entries.length; index += 1) {
        cursor += (exps[index] / sumExp);
        if (roll <= cursor || index === entries.length - 1) {
            return entries[index];
        }
    }
    return entries[entries.length - 1];
};

const resolveNodeRole = (branchOrder = 0) => {
    if (branchOrder <= 0) {
        return 'trunk';
    }
    if (branchOrder >= 3) {
        return 'twig';
    }
    return 'branch';
};

const createActionCounter = () => ({
    extend: 0,
    split: 0,
    redirect: 0,
    prune: 0,
    terminate: 0,
    deadwoodize: 0,
});

export class GrowthVM {
    constructor({
        seed = 0,
        factors = {},
        stage = 'mature',
        presetId = null,
        constraints = {},
        options = {},
    } = {}) {
        this.seed = Math.floor(toNumber(seed, 0));
        this.stage = typeof stage === 'string' ? stage : 'mature';
        this.presetId = typeof presetId === 'string' ? presetId : null;
        this.constraints = resolveConstraints(constraints);
        this.options = resolveOptions(options);
        this.factorVector = normalizeFactorVectorV1({
            ...getDefaultFactorVectorV1(),
            ...(factors || {}),
        });
        this.runtime = resolveRuntimeParamsFromFactorsV1(this.factorVector);
        this.tree = new TreeGraph({ seed: this.seed });
        this.budQueue = new BudQueue();
        this.provenanceRecorder = new ProvenanceRecorderV1({
            seed: this.seed,
            traceLevel: this.options.traceLevel,
            capacity: Math.max(16, Math.floor(toNumber(this.options.maxProvenanceEvents, 4096))),
        });
        const trace = this.runtime?.traceInputs || {};
        this.occupancyField = new OccupancyFieldModel({
            cellSize: lerp(18, 36, clamp01(this.factorVector.pad_separation_target)),
            queryRadius: lerp(24, 72, clamp01(this.factorVector.pad_separation_target)),
            saturationCount: Math.round(lerp(6, 18, clamp01(this.factorVector.branch_density))),
        });
        this.lightField = new LightFieldModel({
            topLightDir: [0, 1],
            sideLightDir: [toNumber(trace.style_windswept_bias, 0) * 0.48, 0.88],
            topLightWeight: clamp01(lerp(0.58, 0.88, clamp01(this.factorVector.phototropism_gain))),
            sideLightWeight: clamp01(lerp(0.14, 0.38, clamp01(this.factorVector.windswept_bias))),
        });
        this.styleField = new StyleFieldModel({
            cascadeBias: clamp01(toNumber(trace.style_cascade_bias, this.factorVector.cascade_bias)),
            windsweptBias: clamp(toNumber(trace.style_windswept_bias, ((this.factorVector.windswept_bias * 2) - 1)), -1, 1),
            canopyEnvelopeBias: clamp(toNumber(trace.canopy_envelope_bias, ((this.factorVector.canopy_envelope_bias * 2) - 1)), -1, 1),
            padSeparationTarget: clamp01(this.factorVector.pad_separation_target),
            negativeSpaceTarget: clamp01(this.factorVector.negative_space_target),
            massBalanceGain: clamp01(this.factorVector.mass_balance_gain),
        });
        this.styleProfile = this.resolveStyleProfile();
        this.diagnostics = {
            nodeCount: 0,
            stepCount: 0,
            pruneCount: 0,
            deadwoodCount: 0,
            stallGuardCount: 0,
            warnings: [],
            actionCounts: {
                extend: 0,
                split: 0,
                redirect: 0,
                prune: 0,
                terminate: 0,
                deadwoodize: 0,
            },
            phaseSelectionCounts: {
                trunk: 0,
                scaffold: 0,
                twig: 0,
            },
            phaseActionCounts: {
                trunk: createActionCounter(),
                scaffold: createActionCounter(),
                twig: createActionCounter(),
            },
            styleProfile: null,
        };
        this.diagnostics.styleProfile = {
            ...(this.styleProfile || {}),
        };
        this.budNodeSlotCounter = new Map();
        this.nodeLateralSign = new Map();
        this.initialize();
    }

    pushEvent(step, eventType, payload = {}, {
        nodeId = null,
        budId = null,
        seedKey = null,
        randomValue = null,
        contributions = null,
    } = {}) {
        this.provenanceRecorder.record({
            step,
            eventType,
            nodeId,
            budId,
            seedKey: typeof seedKey === 'string' ? seedKey : '',
            randomValue: Number.isFinite(Number(randomValue)) ? Number(randomValue) : null,
            payload,
            contributions: contributions && typeof contributions === 'object'
                ? contributions
                : null,
        });
    }

    resolveSlot(parentNodeId) {
        const key = typeof parentNodeId === 'string' ? parentNodeId : 'root';
        const next = this.budNodeSlotCounter.get(key) || 0;
        this.budNodeSlotCounter.set(key, next + 1);
        return next;
    }

    sampleRandom(nodeId, decisionType, index = 0) {
        return sampleStructuralRandom({
            seed: this.seed,
            nodeId,
            decisionType,
            index,
        });
    }

    resolveStyleProfile() {
        const windCentered = clamp((toNumber(this.factorVector.windswept_bias, 0.5) * 2) - 1, -1, 1);
        const windSign = windCentered >= 0 ? 1 : -1;
        const windAbs = Math.abs(windCentered);
        const modeRoll = this.sampleRandom('root', 'style_profile_mode', 0);
        let lateralMode = 'freeform';
        if (modeRoll <= 0.25) {
            lateralMode = 'alternating';
        } else if (modeRoll <= 0.5) {
            lateralMode = windAbs >= 0.16 ? 'windward' : 'alternating';
        } else if (modeRoll <= 0.75) {
            lateralMode = windAbs >= 0.16 ? 'counterwind' : 'freeform';
        }
        const splitStepOffset = Math.round(((this.sampleRandom('root', 'style_profile_split_step', 0) * 2) - 1) * 2);
        const splitHeightOffset = ((this.sampleRandom('root', 'style_profile_split_height', 0) * 2) - 1) * 14;
        const phaseDrift = ((this.sampleRandom('root', 'style_profile_phase', 0) * 2) - 1) * 0.12;
        const antiDirectionRate = clamp01(
            (toNumber(this.factorVector.trunk_apex_substitution_rate, 0.2) * 0.44)
            + (this.sampleRandom('root', 'style_profile_anti', 0) * 0.22),
        );
        const lateralVarianceGain = lerp(
            0.8,
            1.34,
            this.sampleRandom('root', 'style_profile_var', 0),
        );
        const trunkSplitDrift = ((this.sampleRandom('root', 'style_profile_trunk_split', 0) * 2) - 1) * 0.14;

        return {
            lateralMode,
            windSign,
            splitStepOffset,
            splitHeightOffset: round(splitHeightOffset, 4),
            phaseDrift: round(phaseDrift, 4),
            antiDirectionRate: round(antiDirectionRate, 4),
            lateralVarianceGain: round(lateralVarianceGain, 4),
            trunkSplitDrift: round(trunkSplitDrift, 4),
        };
    }

    initialize() {
        const trunkCount = Math.max(1, Math.floor(toNumber(this.factorVector.trunk_count, 1)));
        const spread = toNumber(this.factorVector.trunk_base_spread, 0.2);
        const leanCentered = ((toNumber(this.factorVector.trunk_lean, 0.5) * 2) - 1) * 0.52;
        const baseLength = 28 + (toNumber(this.factorVector.trunk_height_bias, 0.5) * 24);
        const depthBudgetScale = lerp(0.68, 1.34, clamp01(this.factorVector.branch_depth_budget));
        const rootDepthRemaining = Math.max(
            1,
            Math.floor(this.constraints.maxDepth * depthBudgetScale),
        );
        for (let index = 0; index < trunkCount; index += 1) {
            const t = trunkCount <= 1 ? 0.5 : (index / (trunkCount - 1));
            const xOffset = (t - 0.5) * spread * 64;
            const heading = vecNormalize([leanCentered + ((t - 0.5) * 0.14), 1, 0]);
            const p0 = vec3(xOffset, 0, 0);
            const p1 = vecAdd(p0, vecScale(heading, baseLength));
            const nodeId = buildStructuralNodeId({
                parentNodeId: 'root',
                depth: 0,
                nodeRole: 'trunk',
                nodeSlot: index,
                decisionType: 'init',
            });
            this.tree.addNode({
                id: nodeId,
                parentId: null,
                depth: 0,
                order: 0,
                role: 'trunk',
                p0,
                p1,
                dir: heading,
                length: baseLength,
                radius0: 7.6,
                radius1: 7.2,
                age: 0,
                vigor: clamp01(toNumber(this.factorVector.apical_dominance, 0.6)),
                lightBudget: 0.5,
                resourceBudget: 0.5,
                liveVeinRatio: 1,
                sapFlow: 0.5,
                tags: ['root_trunk'],
            });
            this.nodeLateralSign.set(nodeId, heading[0] >= 0 ? 1 : -1);
            this.occupancyField.addSegment(p0, p1, {
                nodeId,
                action: 'init',
            });
            this.budQueue.add({
                id: `bud_${nodeId}`,
                nodeId,
                position: p1,
                heading,
                depthRemaining: rootDepthRemaining,
                branchOrder: 0,
                vigor: clamp01(toNumber(this.factorVector.apical_dominance, 0.6)),
                dormancy: 0,
                active: true,
            });
        }
    }

    resolveFirstSplitMinHeight() {
        const ratio = clamp01(toNumber(this.factorVector.first_split_height_ratio, 0.42));
        const drift = toNumber(this.styleProfile?.splitHeightOffset, 0);
        return clamp(lerp(4, 60, ratio) + drift, 2, 96);
    }

    resolveFirstSplitMinStep() {
        const ratio = clamp01(toNumber(this.factorVector.first_split_height_ratio, 0.42));
        const drift = Math.floor(toNumber(this.styleProfile?.splitStepOffset, 0));
        return Math.max(1, Math.floor(lerp(1, 4, ratio)) + drift);
    }

    hasPrimaryBranch() {
        if (!this.tree || !this.tree.nodesById || typeof this.tree.nodesById.values !== 'function') {
            return false;
        }
        for (const node of this.tree.nodesById.values()) {
            if (toNumber(node?.order, 0) >= 1) {
                return true;
            }
        }
        return false;
    }

    resolveGrowthPhase(bud, step) {
        if (!bud) {
            return 'twig';
        }
        const order = toNumber(bud.branchOrder, 0);
        const hasPrimaryBranch = this.hasPrimaryBranch();
        const progress = clamp01(step / Math.max(1, this.constraints.maxSteps));
        const phaseDrift = toNumber(this.styleProfile?.phaseDrift, 0);
        const scaffoldGateA = clamp(0.72 + phaseDrift, 0.56, 0.86);
        const scaffoldGateB = clamp(0.82 + (phaseDrift * 0.82), 0.64, 0.92);
        if (order <= 0 && !hasPrimaryBranch) {
            return 'trunk';
        }
        if (order <= 1 && progress < scaffoldGateA && bud.depthRemaining > 0) {
            return 'scaffold';
        }
        if (order <= 2 && progress < scaffoldGateB && bud.depthRemaining > 1) {
            return 'scaffold';
        }
        return 'twig';
    }

    resolveAlternationPreferredSign(bud, step) {
        const nodeId = bud?.nodeId || 'node_00000000';
        const baseSign = this.nodeLateralSign.get(nodeId)
            || (this.sampleRandom(nodeId, `alt_base_${step}`, 0) < 0.5 ? -1 : 1);
        const alternationStrength = clamp01(toNumber(this.factorVector.alternation_bias, 0.5));
        const lateralMode = String(this.styleProfile?.lateralMode || 'alternating');
        const windSign = toNumber(this.styleProfile?.windSign, 1) >= 0 ? 1 : -1;
        let preferred = baseSign;
        if (lateralMode === 'alternating') {
            const prefersAlternation = this.sampleRandom(nodeId, `alt_choice_${step}`, 0) <= alternationStrength;
            preferred = prefersAlternation ? -baseSign : baseSign;
        } else if (lateralMode === 'windward') {
            preferred = this.sampleRandom(nodeId, `alt_windward_${step}`, 0) <= 0.74
                ? windSign
                : (this.sampleRandom(nodeId, `alt_windward_mix_${step}`, 0) < 0.5 ? -1 : 1);
        } else if (lateralMode === 'counterwind') {
            preferred = this.sampleRandom(nodeId, `alt_counter_${step}`, 0) <= 0.74
                ? -windSign
                : (this.sampleRandom(nodeId, `alt_counter_mix_${step}`, 0) < 0.5 ? -1 : 1);
        } else {
            preferred = this.sampleRandom(nodeId, `alt_freeform_${step}`, 0) < 0.5 ? -1 : 1;
        }
        const antiDirectionRate = clamp01(toNumber(this.styleProfile?.antiDirectionRate, 0));
        if (this.sampleRandom(nodeId, `alt_antidirection_${step}`, 0) <= antiDirectionRate) {
            preferred *= -1;
        }
        return preferred >= 0 ? 1 : -1;
    }

    canSplitBud(bud, step, phase = null) {
        if (!bud || bud.branchOrder >= 4) {
            return false;
        }
        const isTrunkBud = toNumber(bud.branchOrder, 0) <= 0;
        const hasPrimaryBranch = this.hasPrimaryBranch();
        const resolvedPhase = typeof phase === 'string' ? phase : this.resolveGrowthPhase(bud, step);
        if (resolvedPhase === 'twig') {
            if (bud.depthRemaining <= 2) {
                return false;
            }
            const splitChance = lerp(0.08, 0.34, clamp01(this.factorVector.branch_density));
            const splitRoll = this.sampleRandom(bud.nodeId, `split_gate_twig_${step}`, 0);
            return splitRoll <= splitChance;
        }
        if (isTrunkBud && !hasPrimaryBranch) {
            if (bud.depthRemaining <= 0) {
                return false;
            }
            let splitChance = lerp(0.42, 0.94, clamp01(this.factorVector.trunk_split_bias));
            splitChance = clamp01(splitChance + toNumber(this.styleProfile?.trunkSplitDrift, 0));
            const splitRoll = this.sampleRandom(bud.nodeId, `split_gate_trunk_${step}`, 0);
            const minStep = this.resolveFirstSplitMinStep();
            const minHeight = this.resolveFirstSplitMinHeight();
            const y = toNumber(bud?.position?.[1], 0);
            const stepEase = clamp01((step - minStep + 2) / 4);
            const heightEase = clamp01((y - minHeight + 14) / 26);
            const readiness = clamp01(Math.max(stepEase, heightEase));
            const gatedChance = splitChance * (0.2 + (readiness * 0.8));
            if (step >= minStep && bud.depthRemaining <= 2 && splitRoll <= Math.max(0.82, gatedChance)) {
                return true;
            }
            return splitRoll <= gatedChance;
        }
        if (bud.depthRemaining <= 1) {
            return false;
        }
        if (!isTrunkBud) {
            const branchSplitChance = lerp(0.32, 0.9, clamp01(this.factorVector.branch_density));
            const branchSplitRoll = this.sampleRandom(bud.nodeId, `split_gate_branch_${step}`, 0);
            return branchSplitRoll <= branchSplitChance;
        }
        let splitChance = lerp(0.28, 0.9, clamp01(this.factorVector.trunk_split_bias));
        splitChance = clamp01(splitChance + toNumber(this.styleProfile?.trunkSplitDrift, 0));
        const splitRoll = this.sampleRandom(bud.nodeId, `split_gate_trunk_${step}`, 0);
        const minStep = this.resolveFirstSplitMinStep();
        const minHeight = this.resolveFirstSplitMinHeight();
        const y = toNumber(bud?.position?.[1], 0);
        if (!hasPrimaryBranch && step >= (minStep + 1) && y >= minHeight) {
            splitChance = Math.max(splitChance, 0.72);
        }
        return step >= minStep && y >= minHeight && splitRoll <= splitChance;
    }

    resolveMorphologyFeatures(topology = null) {
        return resolveVNextMorphologyFeatures(topology);
    }

    resolveCandidateSignals(bud, action, step, phase = 'scaffold') {
        const bounds = this.constraints.bounds;
        const hasPrimaryBranch = this.hasPrimaryBranch();
        const occupancyRadius = lerp(26, 78, clamp01(this.factorVector.pad_separation_target));
        const occupancy = this.occupancyField.sampleDensity(bud.position, occupancyRadius);
        const spaceClearanceRaw = this.occupancyField.sampleClearance(bud.position, occupancyRadius);
        const targetDensity = lerp(0.58, 0.22, clamp01(this.factorVector.negative_space_target));
        const densityMatch = clamp01(1 - (Math.abs(occupancy - targetDensity) / Math.max(0.22, targetDensity + 0.22)));

        const light = this.lightField.sampleWithPhototropism({
            position: bud.position,
            heading: bud.heading,
            bounds,
            phototropismGain: clamp01(this.factorVector.phototropism_gain),
        });
        const style = this.styleField.sample({
            position: bud.position,
            heading: bud.heading,
            bounds,
        });
        const continuityBase = clamp01(
            (toNumber(bud.vigor, 0.5) * 0.62)
            + (toNumber(this.factorVector.apical_dominance, 0.6) * 0.3)
            + (toNumber(this.factorVector.trunk_taper_strength, 0.6) * 0.08),
        );

        const base = {
            lightAlign: clamp01((light.lightAlign * 0.76) + (light.openSkyGain * 0.24)),
            spaceClearance: clamp01((spaceClearanceRaw * 0.72) + (densityMatch * 0.28)),
            styleAlign: clamp01((style.styleAlign * 0.84) + (style.directionalAlign * 0.16)),
            massBalance: clamp01((style.massBalance * 0.86) + (densityMatch * 0.14)),
            continuity: continuityBase,
        };
        const stepProgress = clamp01(step / Math.max(1, this.constraints.maxSteps));
        const penalties = {
            collision: clamp01(occupancy * lerp(0.84, 1.08, clamp01(this.factorVector.collision_prune_gain))),
            resourceCost: clamp01(
                (stepProgress * 0.34)
                + (clamp01(this.factorVector.branch_density) * 0.24)
                + ((1 - clamp01(toNumber(bud.vigor, 0.5))) * 0.16),
            ),
        };

        if (action === 'split') {
            base.styleAlign = clamp01(base.styleAlign + 0.08 + (style.padBandAlign * 0.05));
            base.continuity = clamp01(base.continuity - 0.1 - (bud.branchOrder <= 0 ? 0.1 : 0));
            penalties.resourceCost = clamp01(penalties.resourceCost + 0.11 + (bud.branchOrder <= 0 ? 0.04 : 0));
            if (bud.branchOrder <= 0 && !hasPrimaryBranch) {
                base.styleAlign = clamp01(base.styleAlign + 0.16);
                base.continuity = clamp01(base.continuity + 0.16);
                penalties.resourceCost = clamp01(penalties.resourceCost - 0.08);
            }
            if (phase === 'twig') {
                base.continuity = clamp01(base.continuity - 0.08);
                penalties.resourceCost = clamp01(penalties.resourceCost + 0.08);
            }
        } else if (action === 'redirect') {
            base.styleAlign = clamp01(base.styleAlign + 0.04);
            base.continuity = clamp01(base.continuity - 0.08 + (phase === 'scaffold' ? 0.04 : 0));
            penalties.resourceCost = clamp01(penalties.resourceCost + 0.07);
        } else if (action === 'extend') {
            base.continuity = clamp01(base.continuity + 0.06 + (bud.branchOrder <= 0 ? 0.08 : 0));
            base.styleAlign = clamp01(base.styleAlign + 0.02 + (bud.branchOrder <= 0 ? 0.03 : 0) + (phase === 'twig' ? 0.02 : 0));
        } else if (action === 'prune' || action === 'terminate') {
            base.continuity = clamp01(base.continuity - 0.34);
            penalties.resourceCost = clamp01(penalties.resourceCost + 0.08);
        } else if (action === 'deadwoodize') {
            base.styleAlign = clamp01(base.styleAlign + (0.08 * clamp01(this.factorVector.jin_rate + this.factorVector.shari_rate)));
            base.continuity = clamp01(base.continuity - 0.42);
            penalties.resourceCost = clamp01(penalties.resourceCost + 0.16);
        }

        return {
            signals: base,
            penalties,
        };
    }

    buildActionCandidates(bud, step) {
        const candidates = [];
        const phase = this.resolveGrowthPhase(bud, step);
        const isTrunkBud = toNumber(bud?.branchOrder, 0) <= 0;
        const hasPrimaryBranch = this.hasPrimaryBranch();
        const pushCandidate = (action) => {
            const io = this.resolveCandidateSignals(bud, action, step, phase);
            candidates.push({
                id: `${action}_${bud.id}_${step}`,
                action,
                phase,
                signals: io.signals,
                penalties: io.penalties,
            });
        };

        if (bud.depthRemaining > 0) {
            pushCandidate('extend');
            if (phase !== 'trunk' || hasPrimaryBranch) {
                pushCandidate('redirect');
            }
        }
        if (this.canSplitBud(bud, step, phase)) {
            pushCandidate('split');
        }

        const minTrunkPruneStep = this.resolveFirstSplitMinStep() + 2;
        const minTrunkTerminateStep = this.resolveFirstSplitMinStep() + 3;
        const canPrune = (
            step >= Math.max(0, Math.floor(toNumber(this.options.minPruneStep, DEFAULT_OPTIONS.minPruneStep)))
            || bud.depthRemaining <= 1
            || bud.branchOrder >= 2
        ) && (!isTrunkBud || (step >= minTrunkPruneStep && (hasPrimaryBranch || bud.depthRemaining <= 0)));
        const canTerminate = (
            step >= Math.max(0, Math.floor(toNumber(this.options.minTerminateStep, DEFAULT_OPTIONS.minTerminateStep)))
            || bud.depthRemaining <= 1
            || bud.branchOrder >= 3
        ) && (!isTrunkBud || (step >= minTrunkTerminateStep && (hasPrimaryBranch || bud.depthRemaining <= 0)));
        const canDeadwood = (
            this.options.enableDeadwood
            && step >= Math.max(0, Math.floor(toNumber(this.options.minDeadwoodStep, DEFAULT_OPTIONS.minDeadwoodStep)))
            && bud.branchOrder >= Math.max(0, Math.floor(toNumber(this.options.deadwoodMinBranchOrder, DEFAULT_OPTIONS.deadwoodMinBranchOrder)))
        );

        if (canPrune) {
            pushCandidate('prune');
        }
        const shouldForceTerminate = phase === 'twig' && bud.depthRemaining <= 1;
        if (canTerminate || shouldForceTerminate || !candidates.length) {
            pushCandidate('terminate');
        }
        if (canDeadwood) {
            pushCandidate('deadwoodize');
        }
        return {
            phase,
            candidates,
        };
    }

    resolveHeadingForAction(bud, action, step, slotOffset = 0, phase = 'scaffold') {
        const base = vecNormalize(bud.heading);
        const nodeId = bud.nodeId || 'node_00000000';
        const branchMeanDeg = lerp(10, 58, clamp01(this.factorVector.branch_angle_mean));
        const branchVarDeg = lerp(1, 34, clamp01(this.factorVector.branch_angle_var));
        const varianceGain = toNumber(this.styleProfile?.lateralVarianceGain, 1);
        const r = this.sampleRandom(
            nodeId,
            `${action}_heading_${step}`,
            slotOffset,
        );
        const signed = ((r * 2) - 1);
        let angleDeg = signed * branchVarDeg * varianceGain;
        if (action === 'split') {
            const preferredSign = this.resolveAlternationPreferredSign(bud, step);
            const splitSign = slotOffset === 0 ? preferredSign : -preferredSign;
            const splitAmp = phase === 'twig'
                ? (branchMeanDeg * 0.78)
                : branchMeanDeg;
            angleDeg += splitSign * splitAmp;
        } else if (action === 'redirect') {
            angleDeg += signed * (branchMeanDeg * (phase === 'trunk' ? 0.3 : 0.7));
            if (phase === 'scaffold') {
                angleDeg += this.resolveAlternationPreferredSign(bud, step) * (branchMeanDeg * 0.12);
            }
        }
        return rotate2D(base, (angleDeg * Math.PI) / 180);
    }

    resolveSegmentLength(bud, action) {
        const depthRatio = clamp01(bud.depthRemaining / Math.max(1, this.constraints.maxDepth));
        const baseLength = lerp(8, 26, depthRatio);
        const decay = lerp(0.55, 0.92, clamp01(1 - this.factorVector.branch_length_decay));
        const trunkBoost = bud.branchOrder <= 0
            ? lerp(1.24, 1.72, clamp01(this.factorVector.trunk_height_bias))
            : 1;
        const splitPenalty = action === 'split' ? 0.82 : 1;
        return Math.max(1.6, baseLength * decay * trunkBoost * splitPenalty);
    }

    resolveRadiusFromParent(parentNode, bud, action) {
        const parentR = Math.max(0.2, toNumber(parentNode?.radius1, parentNode?.radius0 || 0.8));
        const decay = lerp(0.62, 0.95, clamp01(1 - this.factorVector.branch_radius_decay));
        const splitPenalty = action === 'split' ? 0.86 : 1;
        const vigorScale = lerp(0.72, 1.08, clamp01(bud.vigor));
        const r1 = Math.max(0.12, parentR * decay * splitPenalty * vigorScale);
        const taper = lerp(0.78, 0.97, clamp01(this.factorVector.trunk_taper_strength));
        return {
            radius0: Math.max(0.12, r1),
            radius1: Math.max(0.1, r1 * taper),
        };
    }

    appendSegmentFromBud(bud, action, step, slot, phase = 'scaffold') {
        const parentNode = this.tree.getNode(bud.nodeId);
        if (!parentNode) {
            return null;
        }
        const childOrder = action === 'split'
            ? Math.min(4, bud.branchOrder + 1)
            : bud.branchOrder;
        const heading = this.resolveHeadingForAction(bud, action, step, slot, phase);
        const length = this.resolveSegmentLength(bud, action);
        const p0 = [...bud.position];
        const p1 = vecAdd(p0, vecScale(heading, length));
        const radii = this.resolveRadiusFromParent(parentNode, bud, action);
        const nodeId = buildStructuralNodeId({
            parentNodeId: parentNode.id,
            depth: parentNode.depth + 1,
            nodeRole: resolveNodeRole(childOrder),
            nodeSlot: this.resolveSlot(parentNode.id),
            decisionType: `${action}_emit`,
        });

        const node = this.tree.addNode({
            id: nodeId,
            parentId: parentNode.id,
            depth: parentNode.depth + 1,
            order: childOrder,
            role: resolveNodeRole(childOrder),
            p0,
            p1,
            dir: heading,
            length,
            radius0: radii.radius0,
            radius1: radii.radius1,
            age: parentNode.age + 1,
            vigor: clamp01(toNumber(bud.vigor, 0.5) * lerp(0.78, 1.02, this.factorVector.apical_dominance)),
            lightBudget: clamp01(0.5 + (heading[1] * 0.3)),
            resourceBudget: clamp01(toNumber(parentNode.resourceBudget, 0.5) * 0.94),
            liveVeinRatio: clamp01(toNumber(parentNode.liveVeinRatio, 1) * 0.98),
            sapFlow: clamp01(toNumber(parentNode.sapFlow, 0.5) * 0.96),
            tags: [action, `phase:${phase}`],
        });
        if (!node) {
            return null;
        }
        this.nodeLateralSign.set(node.id, heading[0] >= 0 ? 1 : -1);
        this.occupancyField.addSegment(p0, p1, {
            nodeId: node.id,
            action,
        });
        return {
            node,
            bud: {
                id: `bud_${node.id}`,
                nodeId: node.id,
                position: p1,
                heading,
                depthRemaining: Math.max(0, bud.depthRemaining - 1),
                branchOrder: childOrder,
                vigor: clamp01(node.vigor),
                dormancy: 0,
                active: true,
            },
        };
    }

    processBud(bud, step) {
        const selection = this.buildActionCandidates(bud, step);
        const phase = selection?.phase || this.resolveGrowthPhase(bud, step);
        const candidates = Array.isArray(selection?.candidates)
            ? selection.candidates
            : [];
        if (!candidates.length) {
            this.budQueue.deactivate(bud.id);
            return;
        }
        const noiseByCandidateId = {};
        candidates.forEach((candidate, index) => {
            noiseByCandidateId[candidate.id] = (
                this.sampleRandom(
                    bud.nodeId,
                    `noise_${step}_${candidate.action}`,
                    index,
                ) - 0.5
            ) * 0.03;
        });
        const scored = scoreActionCandidatesV1({
            factors: this.factorVector,
            runtime: this.runtime,
            candidates,
            noiseByCandidateId,
        });
        const pickRandom = this.sampleRandom(
            bud.nodeId,
            `action_pick_${step}`,
            0,
        );
        const selected = softmaxPick({
            entries: scored.scored,
            temperature: this.options.utilitySoftmaxTemp,
            randomValue: pickRandom,
        }) || scored.best;
        if (!selected) {
            this.budQueue.deactivate(bud.id);
            return;
        }

        const bestTotal = toNumber(selected?.score?.total, 0);
        if (bestTotal < this.options.stallScoreThreshold) {
            const nextDormancy = (bud.dormancy || 0) + 1;
            if (nextDormancy >= this.options.stallLimit) {
                this.budQueue.deactivate(bud.id);
            } else {
                this.budQueue.update(bud.id, {
                    dormancy: nextDormancy,
                });
            }
            this.diagnostics.stallGuardCount += 1;
            this.pushEvent(step, 'STALL_GUARD_TRIGGERED', {
                threshold: this.options.stallScoreThreshold,
                selectedScore: bestTotal,
                nextDormancy,
            }, {
                nodeId: bud.nodeId,
                budId: bud.id,
                seedKey: `action_pick_${step}`,
                randomValue: pickRandom,
            });
            return;
        }

        const selectedAction = String(selected.action || 'terminate');
        this.pushEvent(step, 'ACTION_SELECTED', {
            action: selectedAction,
            phase,
            candidateCount: scored.scored.length,
            scoreTotal: bestTotal,
            topPositive: selected?.score?.topPositive || [],
            topNegative: selected?.score?.topNegative || [],
        }, {
            nodeId: bud.nodeId,
            budId: bud.id,
            seedKey: `action_pick_${step}`,
            randomValue: pickRandom,
            contributions: selected?.score?.contributions || null,
        });

        this.diagnostics.actionCounts[selectedAction] = (
            (this.diagnostics.actionCounts[selectedAction] || 0) + 1
        );
        const phaseKey = phase === 'trunk' || phase === 'twig' ? phase : 'scaffold';
        this.diagnostics.phaseSelectionCounts[phaseKey] = (
            (this.diagnostics.phaseSelectionCounts[phaseKey] || 0) + 1
        );
        const phaseBucket = this.diagnostics.phaseActionCounts?.[phaseKey];
        if (phaseBucket && Object.prototype.hasOwnProperty.call(phaseBucket, selectedAction)) {
            phaseBucket[selectedAction] += 1;
        }

        if (selectedAction === 'prune' || selectedAction === 'terminate') {
            this.budQueue.deactivate(bud.id);
            if (selectedAction === 'prune') {
                this.diagnostics.pruneCount += 1;
            }
            return;
        }
        if (selectedAction === 'deadwoodize') {
            this.tree.markNodeRole(bud.nodeId, 'deadwood');
            this.budQueue.deactivate(bud.id);
            this.diagnostics.deadwoodCount += 1;
            this.pushEvent(step, 'DEADWOOD_APPLIED', {
                nodeId: bud.nodeId,
            }, {
                nodeId: bud.nodeId,
                budId: bud.id,
            });
            return;
        }

        this.budQueue.deactivate(bud.id);
        const spawnCount = selectedAction === 'split' ? 2 : 1;
        const nextBuds = [];
        for (let slot = 0; slot < spawnCount; slot += 1) {
            if (this.tree.nodeCount() >= this.constraints.maxNodes) {
                break;
            }
            const appended = this.appendSegmentFromBud(bud, selectedAction, step, slot, phase);
            if (appended?.node && appended?.bud) {
                nextBuds.push(appended.bud);
                this.pushEvent(step, 'SEGMENT_EMITTED', {
                    action: selectedAction,
                    phase,
                    nodeId: appended.node.id,
                    parentId: appended.node.parentId,
                    length: round(appended.node.length, 4),
                    order: appended.node.order,
                }, {
                    nodeId: appended.node.id,
                    budId: appended.bud.id,
                });
            }
        }
        this.budQueue.addMany(nextBuds);
    }

    run() {
        for (let step = 0; step < this.constraints.maxSteps; step += 1) {
            if (this.tree.nodeCount() >= this.constraints.maxNodes) {
                this.diagnostics.warnings.push('NODE_CAP_REACHED');
                break;
            }
            const active = this.budQueue.listActive();
            if (!active.length) {
                break;
            }
            this.pushEvent(step, 'STEP_START', {
                activeBudCount: active.length,
                nodeCount: this.tree.nodeCount(),
            });
            active.forEach((bud) => {
                this.processBud(bud, step);
            });
            this.pushEvent(step, 'STEP_END', {
                activeBudCount: this.budQueue.activeCount(),
                nodeCount: this.tree.nodeCount(),
            });
            this.diagnostics.stepCount = step + 1;
        }

        this.diagnostics.nodeCount = this.tree.nodeCount();
        this.pushEvent(this.diagnostics.stepCount, 'RUN_END', {
            diagnostics: {
                ...this.diagnostics,
            },
        });

        const topology = this.tree.toSerializable();
        const morphology = this.resolveMorphologyFeatures(topology);
        return {
            factorVector: {
                ...this.factorVector,
            },
            runtime: {
                ...(this.runtime || {}),
            },
            topology,
            provenance: this.provenanceRecorder.toSerializable(),
            features: {
                nodeCount: this.tree.nodeCount(),
                activeBudCount: this.budQueue.activeCount(),
                deadwoodRatio: round(
                    topology.nodes
                        .filter((node) => node.role === 'deadwood').length
                    / Math.max(1, this.tree.nodeCount()),
                    6,
                ),
                ...morphology,
            },
            diagnostics: {
                ...this.diagnostics,
            },
        };
    }
}

export const runGrowthVMV1 = (input = {}) => {
    const vm = new GrowthVM(input);
    return vm.run();
};
