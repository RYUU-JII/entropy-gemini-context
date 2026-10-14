import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 continuous axis-development state owner.
 *
 * Tier is an explicit developmental role. It must not decide, by itself, whether
 * an axis is long, thick, terminal, or allowed to reiterate. This owner keeps
 * the persistent biological state that does make those decisions and evolves
 * it from geometry and resource history after every constructed internode.
 */
(function installTypedAxisDevelopmentState(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    if (!programs) {
        throw new Error(
            '[G15.4_AXIS_STATE] developmental-programs.js must load first.',
        );
    }

    const {
        clamp,
        rounded,
        resolveCrownRadius,
        resolveRadialDistance,
        resolveScaffoldFamilyDominance,
    } = programs;

    const AXIS_DEVELOPMENT_STATE_SEMANTICS =
        'single_route_child_axis_development_v5';

    const smoothstep = (minimum, maximum, value) => {
        const progress = clamp((value - minimum) / (maximum - minimum), 0, 1);
        return progress * progress * (3 - 2 * progress);
    };

    function phaseWave(temperament, offset = 0) {
        return (
            Math.sin(
                Number(temperament?.developmentalPhase || 0) * 3.73
                    + Number(temperament?.resourceBias || 0.5) * 2.11
                    + Number(temperament?.clusterSlot || 0.5) * 1.37
                    + Number(
                        temperament?.lineageResponse?.axis_extent || 0,
                    ) * 1.91
                    + offset,
            ) + 1
        ) * 0.5;
    }

    function freezeState(spec) {
        return Object.freeze({
            semantics: AXIS_DEVELOPMENT_STATE_SEMANTICS,
            revision: Math.max(0, Math.round(Number(spec.revision || 0))),
            axisOrder: Math.max(0, Math.round(Number(spec.axisOrder || 0))),
            birthMode: spec.birthMode,
            apicalContinuity: rounded(clamp(spec.apicalContinuity, 0, 1)),
            supportInvestment: rounded(clamp(spec.supportInvestment, 0.02, 1.2)),
            extensionDrive: rounded(clamp(spec.extensionDrive, 0.02, 1.2)),
            reiterationReadiness: rounded(clamp(spec.reiterationReadiness, 0, 1.25)),
            reiterationThreshold: rounded(clamp(spec.reiterationThreshold, 0.48, 0.94)),
            reiterationCredit: rounded(clamp(spec.reiterationCredit, 0, 2.2)),
            continuationCredit: rounded(clamp(spec.continuationCredit, 0, 1.4)),
            lateralCompetence: rounded(clamp(spec.lateralCompetence, 0, 1.2)),
            loadMoment: rounded(clamp(spec.loadMoment, -1.4, 1.4)),
            transportBurden: rounded(clamp(spec.transportBurden, 0, 1.8)),
            familyFlowMemory: rounded(clamp(spec.familyFlowMemory, -1, 1)),
            accumulatedLength: rounded(Math.max(0, spec.accumulatedLength || 0)),
            accumulatedConstruction: rounded(Math.max(
                0,
                spec.accumulatedConstruction || 0,
            )),
            maturity: rounded(clamp(spec.maturity, 0, 1.25)),
            stressMemory: rounded(clamp(spec.stressMemory, 0, 1)),
            exposureMemory: rounded(clamp(spec.exposureMemory, 0, 1.2)),
            junctionCount: Math.max(0, Math.round(Number(spec.junctionCount || 0))),
            lateralChildCount: Math.max(
                0,
                Math.round(Number(spec.lateralChildCount || 0)),
            ),
            terminalAffinity: rounded(clamp(spec.terminalAffinity, 0, 1)),
            reiterationSample: spec.reiterationSample === null
                || spec.reiterationSample === undefined
                ? null
                : rounded(clamp(spec.reiterationSample, 0, 1)),
            relativeDifferentiation: spec.relativeDifferentiation
                ? Object.freeze({ ...spec.relativeDifferentiation })
                : null,
        });
    }

    function createRootDevelopmentState(context, spec) {
        const wave = phaseWave(spec.temperament, 0.41);
        return freezeState({
            revision: 0,
            axisOrder: 0,
            birthMode: 'root_emergence',
            apicalContinuity: 0.9 + context.phenotype.dominantAxisPersistence * 0.1,
            supportInvestment: 1,
            extensionDrive: 0.94 + context.phenotype.stature * 0.04,
            reiterationReadiness: clamp(
                Number(spec.reiterationReadiness ?? 0.82),
                0.72,
                1.12,
            ),
            reiterationThreshold: 0.58 + wave * 0.08,
            reiterationCredit: clamp(
                0.7
                    + context.phenotype.ramificationTempo * 0.12
                    + context.phenotype.secondaryAxisPersistence * 0.06,
                0.72,
                0.94,
            ),
            continuationCredit: 0.92,
            lateralCompetence: clamp(
                0.36
                    + context.phenotype.ramificationTempo * 0.32
                    + context.phenotype.lateralEmissionBias * 0.12,
                0.3,
                0.92,
            ),
            loadMoment: 0,
            transportBurden: 0,
            familyFlowMemory: 0,
            accumulatedLength: Number(spec.birthLength || 0),
            accumulatedConstruction: Number(spec.birthConstructionCost || 0),
            maturity: clamp(
                Number(spec.birthLength || 0) > 0
                    ? 1 / Math.max(4, Number(spec.plannedInternodeCount || 5))
                    : 0,
                0,
                0.3,
            ),
            stressMemory: 0,
            exposureMemory: 1,
            junctionCount: 0,
            lateralChildCount: 0,
            terminalAffinity: 0.02,
            reiterationSample: spec.reiterationSample ?? phaseWave(
                spec.temperament,
                4.19,
            ),
        });
    }

    function createForkChildDevelopmentState(context, parent, spec) {
        const parentState = parent.developmentState;
        const retention = clamp(Number(spec.retentionPotential ?? 0.5), 0, 1);
        const support = clamp(Number(spec.supportInvestment ?? 0.5), 0.02, 1.2);
        const extension = clamp(Number(spec.extensionDrive ?? 0.5), 0.02, 1.2);
        const reiterationPotential = clamp(
            Number(spec.reiterationPotential ?? 0.35),
            0,
            1,
        );
        const response = Number(
            spec.temperament?.lineageResponse?.lateral_competence || 0,
        );
        const wave = phaseWave(spec.temperament, 1.17);
        const axisOrder = Math.max(
            0,
            Math.round(Number(spec.axisOrder ?? spec.tier ?? parent.axisOrder ?? 0)),
        );
        const differentiationPotential = clamp(Number(
            spec.relativeDifferentiation?.potential || 0,
        ), 0, 1);
        const inheritedLoad = Number(parentState?.loadMoment || 0) * (
            0.18 + retention * 0.3
        );
        const readiness = clamp(
            Number(spec.reiterationReadiness ?? 0) * 0.7
                + reiterationPotential * 0.24
                + extension * 0.08
                + differentiationPotential * (axisOrder === 1 ? 0.1 : 0.045),
            0.04,
            1.1,
        );
        const threshold = clamp(
            0.57
                + wave * 0.16
                - support * 0.055
                - reiterationPotential * 0.045
                - differentiationPotential * (axisOrder === 1 ? 0.045 : 0.02),
            0.5,
            0.86,
        );
        const apicalContinuity = clamp(
            Number(parentState?.apicalContinuity ?? 0.72) * 0.26
                + retention * 0.46
                + support * 0.12
                + extension * 0.16,
            0.1,
            1,
        );
        return freezeState({
            revision: 0,
            axisOrder,
            birthMode: spec.birthMode || 'recursive_fork_child',
            apicalContinuity,
            supportInvestment: support,
            extensionDrive: extension,
            reiterationReadiness: readiness,
            reiterationThreshold: threshold,
            reiterationCredit: clamp(
                readiness / Math.max(0.48, threshold) * 0.34
                    + reiterationPotential * 0.18
                    + support * 0.1
                    + extension * 0.1
                    + differentiationPotential * 0.09,
                0.16,
                0.9,
            ),
            continuationCredit: clamp(
                0.12
                    + apicalContinuity * 0.28
                    + support * 0.2
                    + extension * 0.24,
                0.18,
                0.92,
            ),
            lateralCompetence: clamp(
                0.14
                    + extension * 0.18
                    + support * 0.08
                    + context.phenotype.ramificationTempo * 0.28
                    + response * 0.12
                    + differentiationPotential * 0.12,
                0.08,
                0.92,
            ),
            loadMoment: inheritedLoad,
            transportBurden: Number(parentState?.transportBurden || 0) * (
                0.58 + retention * 0.24
            ),
            familyFlowMemory: Number(parentState?.familyFlowMemory || 0) * 0.24,
            accumulatedLength: Number(spec.birthLength || 0),
            accumulatedConstruction: Number(spec.birthConstructionCost || 0),
            maturity: clamp(1 / Math.max(4, spec.plannedInternodeCount || 5), 0, 0.3),
            stressMemory: Number(parentState?.stressMemory || 0) * 0.3,
            exposureMemory: Number(spec.spatialExposure ?? 0.6),
            junctionCount: 0,
            lateralChildCount: 0,
            terminalAffinity: clamp(
                0.48
                    - retention * 0.24
                    - reiterationPotential * 0.16
                    + (1 - extension) * 0.12,
                0.04,
                0.68,
            ),
            reiterationSample: spec.reiterationSample ?? phaseWave(
                spec.temperament,
                4.83,
            ),
            relativeDifferentiation: spec.relativeDifferentiation || null,
        });
    }

    function createLateralChildDevelopmentState(context, parent, spec) {
        const parentState = parent.developmentState;
        const support = clamp(Number(spec.supportInvestment ?? 0.32), 0.02, 1.1);
        const extension = clamp(Number(spec.extensionDrive ?? 0.4), 0.02, 1.1);
        const capacity = clamp(Number(spec.developmentalCapacity ?? 0.16), 0.02, 1);
        const constructionViability = smoothstep(
            0.07,
            0.72,
            Number(spec.constructionGrant || 0),
        );
        const centralAffinity = clamp(Number(spec.centralAffinity ?? 0.45), 0, 1);
        const response = Number(
            spec.temperament?.lineageResponse?.lateral_competence || 0,
        );
        const wave = phaseWave(spec.temperament, 2.31);
        const differentiationPotential = clamp(Number(
            spec.relativeDifferentiation?.potential || 0,
        ), 0, 1);
        const readiness = clamp(
            0.16
                + capacity * 0.24
                + extension * 0.16
                + support * 0.12
                + constructionViability * 0.16
                + centralAffinity * 0.08
                + wave * 0.06
                + differentiationPotential * 0.11,
            0.12,
            0.84,
        );
        const threshold = clamp(
            0.6
                + wave * 0.17
                - constructionViability * 0.06
                - support * 0.035
                - differentiationPotential * 0.04,
            0.52,
            0.88,
        );
        const terminalAffinity = clamp(
            0.66
                - constructionViability * 0.24
                - extension * 0.17
                - readiness * 0.14
                + Number(parentState?.maturity || 0) * 0.08,
            0.08,
            0.82,
        );
        const apicalContinuity = clamp(
            0.16
                + support * 0.2
                + extension * 0.18
                + centralAffinity * 0.18
                + capacity * 0.12,
            0.12,
            0.78,
        );
        return freezeState({
            revision: 0,
            axisOrder: Math.max(0, Math.round(Number(spec.axisOrder || 1))),
            birthMode: 'live_lateral_emission',
            apicalContinuity,
            supportInvestment: support,
            extensionDrive: extension,
            reiterationReadiness: readiness,
            reiterationThreshold: threshold,
            reiterationCredit: clamp(
                readiness / Math.max(0.48, threshold) * 0.32
                    + capacity * 0.16
                    + constructionViability * 0.12
                    + support * 0.08
                    + extension * 0.08,
                0.12,
                0.78,
            ),
            continuationCredit: clamp(
                0.1
                    + apicalContinuity * 0.24
                    + support * 0.2
                    + extension * 0.24
                    + constructionViability * 0.12,
                0.14,
                0.84,
            ),
            lateralCompetence: clamp(
                0.08
                    + extension * 0.12
                    + context.phenotype.ramificationTempo * 0.18
                    + response * 0.1
                    - terminalAffinity * 0.1
                    + differentiationPotential * 0.1,
                0.03,
                0.58,
            ),
            loadMoment: Number(parentState?.loadMoment || 0) * 0.12,
            transportBurden: Number(parentState?.transportBurden || 0) * 0.48,
            familyFlowMemory: Number(parentState?.familyFlowMemory || 0) * 0.18,
            accumulatedLength: 0,
            accumulatedConstruction: 0,
            maturity: 0,
            stressMemory: Number(parentState?.stressMemory || 0) * 0.24,
            exposureMemory: Number(spec.spatialExposure ?? 0.6),
            junctionCount: 0,
            lateralChildCount: 0,
            terminalAffinity,
            reiterationSample: spec.reiterationSample ?? null,
            relativeDifferentiation: spec.relativeDifferentiation || null,
        });
    }

    function createChildDevelopmentState(context, parent, spec = {}) {
        if (
            spec.relativeDifferentiation?.semantics
                !== 'tier_local_relative_differentiation_potential_v1'
        ) {
            throw new Error(
                '[G15.4_AXIS_STATE] Every permanent child birth requires one canonical relative-differentiation state.',
            );
        }
        if (!Number.isInteger(Number(spec.axisOrder))) {
            throw new TypeError(
                '[G15.4_AXIS_STATE] Every child birth requires an explicit axis order.',
            );
        }
        if (spec.route === 'structural_fork') {
            return createForkChildDevelopmentState(context, parent, spec);
        }
        if (spec.route === 'live_lateral_emission') {
            return createLateralChildDevelopmentState(context, parent, spec);
        }
        throw new RangeError(
            `[G15.4_AXIS_STATE] Unknown child birth route: ${String(spec.route)}`,
        );
    }

    function evolveAfterInternode(context, frontier, evidence) {
        const state = frontier.developmentState;
        if (!state || state.semantics !== AXIS_DEVELOPMENT_STATE_SEMANTICS) {
            throw new Error(
                `[G15.4_AXIS_STATE] Frontier ${frontier.id} has no canonical development state.`,
            );
        }
        const origin = evidence.origin || { x: 0, y: 0, z: 0 };
        const target = evidence.target || origin;
        const crownRadius = Math.max(24, resolveCrownRadius(context));
        const radialDelta = clamp(
            (resolveRadialDistance(origin) - resolveRadialDistance(target))
                / crownRadius,
            -0.35,
            0.35,
        );
        const verticalAffinity = clamp(Number(evidence.heading?.y || 0), -1, 1);
        const stress = clamp(Number(evidence.stress || 0), 0, 1);
        const exposure = clamp(Number(evidence.exposure ?? 0.5), 0, 1.2);
        const balance = clamp(Number(evidence.resourceBalance || 0) / 0.18, -1, 1);
        const transportPressure = clamp(
            Number(evidence.transportPressure || 0),
            0,
            1.5,
        );
        const familyFlow = clamp(Number(evidence.familyFlowNet || 0) / 0.12, -1, 1);
        const plannedCount = Math.max(
            1,
            Number(frontier.constructionPortfolio?.plannedInternodeCount
                || frontier.axisStepLimit
                || 1),
        );
        const nextCycleAge = Number(
            frontier.constructionPortfolio?.cursor ?? frontier.axisAge ?? 0,
        ) + 1;
        const maturity = clamp(nextCycleAge / plannedCount, 0, 1.25);
        const exposureMemory = state.exposureMemory * 0.72 + exposure * 0.28;
        const stressMemory = clamp(
            state.stressMemory * 0.76 + stress * 0.24,
            0,
            1,
        );
        const supportTarget = clamp(
            Number(frontier.supportAllocation || state.supportInvestment)
                * (0.86 + Math.abs(state.loadMoment) * 0.12)
                * (1 + Math.max(0, balance) * 0.05),
            0.02,
            1.2,
        );
        const extensionTarget = clamp(
            Number(frontier.extensionAllocation || state.extensionDrive)
                * (0.76 + exposureMemory * 0.24)
                * (1 - stressMemory * 0.22),
            0.02,
            1.2,
        );
        const apicalTarget = clamp(
            extensionTarget * 0.35
                + supportTarget * 0.2
                + Math.max(0, verticalAffinity) * 0.18
                + clamp(0.5 + radialDelta * 3.2, 0, 1) * 0.17
                + state.apicalContinuity * 0.1,
            0,
            1,
        );
        const readinessGain = (
            0.018
                + Math.max(0, balance) * 0.045
                + supportTarget * 0.018
                + extensionTarget * 0.014
                + exposureMemory * 0.012
        ) * (0.62 + maturity * 0.38);
        const readinessLoss = stressMemory * 0.052
            + Math.max(0, -balance) * 0.035;
        const reiterationReadiness = clamp(
            state.reiterationReadiness + readinessGain - readinessLoss,
            0,
            1.25,
        );
        const lateralCompetence = clamp(
            state.lateralCompetence * 0.94
                + context.phenotype.ramificationTempo * 0.018
                + exposureMemory * 0.012
                - stressMemory * 0.028,
            0,
            1.2,
        );
        const terminalAffinity = clamp(
            state.terminalAffinity * 0.58
                + maturity * 0.16
                + stressMemory * 0.14
                + (1 - clamp(extensionTarget, 0, 1)) * 0.09
                + (reiterationReadiness < state.reiterationThreshold ? 0.03 : 0),
            0,
            1,
        );
        const normalizedRunLength = clamp(
            Number(evidence.runLength || 0) / Math.max(28, crownRadius * 0.42),
            0,
            1.8,
        );
        const inheritedTransportBurden = clamp(
            state.transportBurden * 0.86
                + normalizedRunLength * (
                    0.035 + Math.max(0, verticalAffinity) ** 2 * 0.085
                )
                + transportPressure * 0.035,
            0,
            1.8,
        );
        const reiterationCreditGain = (
            0.03
                + supportTarget * 0.028
                + extensionTarget * 0.032
                + exposureMemory * 0.018
                + Math.max(0, balance) * 0.045
                + Math.max(0, familyFlow) * 0.025
        ) * (0.72 + maturity * 0.28);
        const reiterationCreditLoss = stressMemory * 0.052
            + terminalAffinity * 0.012
            + Math.max(0, -familyFlow) * 0.02;
        const reiterationCredit = clamp(
            state.reiterationCredit
                + reiterationCreditGain
                - reiterationCreditLoss,
            0,
            2.2,
        );
        const continuationSignal = clamp(
            0.08
                + apicalTarget * 0.24
                + supportTarget * 0.17
                + extensionTarget * 0.22
                + exposureMemory * 0.13
                + Math.max(0, balance) * 0.1
                + Math.max(0, familyFlow) * 0.07
                - terminalAffinity * 0.24
                - stressMemory * 0.26
                - inheritedTransportBurden * 0.13,
            0,
            1.25,
        );
        const continuationCredit = clamp(
            state.continuationCredit * 0.64 + continuationSignal * 0.36,
            0,
            1.4,
        );
        return freezeState({
            ...state,
            revision: state.revision + 1,
            apicalContinuity: state.apicalContinuity * 0.7 + apicalTarget * 0.3,
            supportInvestment: state.supportInvestment * 0.76 + supportTarget * 0.24,
            extensionDrive: state.extensionDrive * 0.72 + extensionTarget * 0.28,
            reiterationReadiness,
            reiterationCredit,
            continuationCredit,
            lateralCompetence,
            loadMoment: state.loadMoment * (0.9 - maturity * 0.04),
            accumulatedLength: state.accumulatedLength
                + Math.max(0, Number(evidence.runLength || 0)),
            accumulatedConstruction: state.accumulatedConstruction
                + Math.max(0, Number(evidence.constructionCost || 0)),
            maturity,
            stressMemory,
            exposureMemory,
            terminalAffinity,
            transportBurden: inheritedTransportBurden,
            familyFlowMemory: state.familyFlowMemory * 0.72 + familyFlow * 0.28,
        });
    }

    function applyLateralJunction(state, junction) {
        const lateralMoment = clamp(Number(junction.lateralMoment || 0), -1, 1);
        const supportDemand = clamp(Number(junction.supportDemand || 0), 0, 1);
        return freezeState({
            ...state,
            revision: state.revision + 1,
            apicalContinuity: state.apicalContinuity
                * (1 - Number(junction.lateralAreaFraction || 0) * 0.12),
            supportInvestment: state.supportInvestment * 0.9
                + supportDemand * 0.1,
            extensionDrive: state.extensionDrive
                * (1 - Number(junction.lateralAreaFraction || 0) * 0.08),
            reiterationCredit: state.reiterationCredit
                * (1 - Number(junction.lateralAreaFraction || 0) * 0.06),
            continuationCredit: state.continuationCredit
                * (1 - Number(junction.lateralAreaFraction || 0) * 0.08),
            loadMoment: clamp(
                state.loadMoment * 0.74 + lateralMoment * 0.52,
                -1.4,
                1.4,
            ),
            lateralCompetence: state.lateralCompetence * 0.82,
            junctionCount: state.junctionCount + 1,
            lateralChildCount: state.lateralChildCount + 1,
        });
    }

    function resolveReiterationReadiness(frontier) {
        const state = frontier.developmentState;
        if (!state) return null;
        const sample = state.reiterationSample ?? 0.5;
        // Birth establishes a lineage-specific competence threshold. History
        // may then move the axis across it; a second unrelated threshold near
        // 1.0 previously discarded that information and suppressed otherwise
        // mature lateral families. The sample now perturbs timing around the
        // inherited threshold instead of acting as a disguised permission bit.
        const historyAdjustedThreshold = clamp(
            Number(state.reiterationThreshold || 0.68)
                + (sample - 0.5) * 0.16
                + state.terminalAffinity * 0.08
                + state.stressMemory * 0.11
                + state.transportBurden * 0.07
                - state.apicalContinuity * 0.045
                - state.continuationCredit * 0.025,
            0.52,
            1.08,
        );
        const scaffoldFamilyDominance = resolveScaffoldFamilyDominance(
            frontier.scaffoldFamilyDominanceClaim,
        );
        const effectiveThreshold = clamp(
            historyAdjustedThreshold
                + Number(
                    scaffoldFamilyDominance?.reiterationThresholdBoost || 0,
                ),
            0.52,
            1.3,
        );
        return Object.freeze({
            semantics: 'scaffold_dominance_aware_reiteration_readiness_v1',
            eligible: state.reiterationCredit >= effectiveThreshold,
            reiterationCredit: rounded(state.reiterationCredit),
            historyAdjustedThreshold: rounded(historyAdjustedThreshold),
            scaffoldFamilyDominance,
            effectiveThreshold: rounded(effectiveThreshold),
            thresholdIncrease: rounded(
                effectiveThreshold - historyAdjustedThreshold,
            ),
        });
    }

    function reiterationDue(frontier) {
        return Boolean(resolveReiterationReadiness(frontier)?.eligible);
    }

    function resolveAxisRadiusProfile(state) {
        if (!state || state.semantics !== AXIS_DEVELOPMENT_STATE_SEMANTICS) {
            throw new Error('[G15.4_AXIS_STATE] Radius profile requires canonical state.');
        }
        const support = clamp(state.supportInvestment, 0, 1);
        const continuity = clamp(state.apicalContinuity, 0, 1);
        const terminal = clamp(state.terminalAffinity, 0, 1);
        return Object.freeze({
            taper: rounded(clamp(
                0.956 + support * 0.016 + continuity * 0.006 - terminal * 0.004,
                0.948,
                0.98,
            )),
            minimumRadius: rounded(
                0.55 + support * 2.1 + continuity * 0.25,
            ),
            maturationPressure: rounded(
                0.035 + terminal * 0.045 + (1 - support) * 0.018,
            ),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState = Object.freeze({
        AXIS_DEVELOPMENT_STATE_SEMANTICS,
        createRootDevelopmentState,
        createChildDevelopmentState,
        evolveAfterInternode,
        applyLateralJunction,
        resolveReiterationReadiness,
        reiterationDue,
        resolveAxisRadiusProfile,
    });
}(zenPlumeKernelRealm));
