import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {lateralOpportunity,lateralFraction as resolveFamilyLateralFraction} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
import {familyCadence} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
import {factorExtension} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
/**
 * G15.4 longitudinal construction account.
 *
 * This owner is deliberately narrower than the resource economy. Resource
 * reserve describes whether an axis can maintain living tissue; construction
 * reserve is the finite stock from which woody length is actually built. A
 * fork may redistribute that stock, but no child receives an implicit refill.
 *
 * Internode character remains stochastic and field-driven, but an axis now
 * receives a finite construction portfolio when it is born. The portfolio
 * separates the present axis, future descendants, and live lateral development.
 * A current internode can therefore no longer spend the construction that was
 * reserved for a later fork and then expose the shortage as a microscopic tip.
 */
import { zenG15ProportionLengthScale, zenG15ProportionCount } from './ZenBonsaiG15ProportionStudy.js';
import { resolveZenG15DistalExtension } from './ZenBonsaiG15DistalCrown.js';
import {zenG15CompositionLengthScale} from './ZenBonsaiG15ComposedCrown.js';
import {zenG15ExtensionDemand,recordZenG15Decision} from './ZenBonsaiG15DevelopmentDecisions.js';
import {resolveZenG15AxisHorizon} from './ZenBonsaiG15AxisHorizon.js';
import { planZenG15ApicalSuccession } from './ZenBonsaiG15ApicalPlanning.js';
import { bindZenG15AxisDevelopment } from './ZenBonsaiG15AxisDevelopment.js';
(function installTypedAxisConstructionAccount(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const maturationField = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMaturationField;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    if (!programs || !maturationField || !architectureOwner) {
        throw new Error(
            '[G15.4_CONSTRUCTION] programs, maturation field, and crown architecture owners must load first.',
        );
    }

    const { TIERS, clamp, magnitude, rounded } = programs;
    const {
        resolveOntogeneticCoordinates,
        resolveExtensionMaturation,
    } = maturationField;
    const { resolveCrownArchitectureProfile } = architectureOwner;

    const PORTFOLIO_SEMANTICS = 'phyllotactic_continuous_axis_portfolio_v10';
    const PENDING_FORK_CONSTRUCTION_CARRY_SEMANTICS =
        'pending_fork_construction_carry_v2';

    function normalizeWeights(weights) {
        const total = weights.reduce((sum, value) => sum + value, 0);
        return weights.map((value) => value / Math.max(1e-8, total));
    }

    function resolveConstructionReiterationCommitment(
        descendantConstructionBudget,
        familyConstructionGrant,
    ) {
        return clamp(
            Number(descendantConstructionBudget || 0)
                / Math.max(1e-8, Number(familyConstructionGrant || 0))
                / 0.38,
            0,
            1,
        );
    }

    function createAxisConstructionPortfolio(context, spec) {
        if (!spec.origin || !['x', 'y', 'z'].every(axis => Number.isFinite(spec.origin[axis]))) {
            throw new Error('ZEN_G15_CONSTRUCTION_ORIGIN_REQUIRED');
        }
        const tier = clamp(Math.round(Number(spec.tier || 0)), 0, 2);
        const temperament = spec.temperament || {};
        const developmentState = spec.developmentState || null;
        const lineageResponse = temperament.lineageResponse || {};
        const familyConstructionGrant = Math.max(
            0,
            Number(spec.familyConstructionGrant || 0),
        );
        let anticipatesStructuralFork = Boolean(spec.anticipatesStructuralFork);
        const reiterationCommitment = clamp(
            Number(spec.reiterationCommitment ?? 0),
            0,
            1,
        );
        const generationDepth = Math.max(0, Number(spec.generationDepth || 0));
        const birthOntogeneticCoordinates = resolveOntogeneticCoordinates(
            context,
            {
                axisAge: 0,
                axisStepLimit: 1,
                generationDepth,
            },
            spec.origin,
        );
        const architectureProfile = resolveCrownArchitectureProfile(
            context,
            {
                ...spec,
                tier,
                axisOrder: spec.axisOrder ?? tier,
                axisAge: 0,
                axisStepLimit: 1,
                generationDepth,
            },
            spec.origin,
        );
        // Distal axes do not need to imitate the large basal axis's clock.
        // Height, transport and developmental depth continuously compress the
        // next flush into fewer, smaller internodes in proportion to inherited
        // reiteration capacity. This does not require a binary birth forecast:
        // a modest axis may accumulate the remaining competence while growing.
        const distalCadencePressure = clamp(
            (birthOntogeneticCoordinates.progress - 0.42) / 0.72,
            0,
            1,
        );
        const forkCadenceCompression = distalCadencePressure * clamp(
            0.32 + reiterationCommitment * 0.88,
            0,
            1,
        );
        const persistence = clamp(
            context.phenotype.secondaryAxisPersistence
                * 0.3
                + Number(spec.extensionCapacity ?? 0.5) * 0.2
                + Number(temperament.axisExtentScale ?? 1) * 0.18
                + Number(developmentState?.apicalContinuity
                    ?? (tier === 0 ? 0.9 : 0.42)) * 0.18
                + Number(developmentState?.extensionDrive ?? 0.5) * 0.14,
            0,
            1.4,
        );
        const countWave = Math.sin(
            Number(temperament.developmentalPhase || 0) * 2.73
                + Number(temperament.resourceBias || 0.5) * 1.91
                + Number(temperament.clusterSlot || 0.5) * 1.17,
        );
        const minimumCount = clamp(
            Math.round(Number(spec.minimumInternodeCount ?? 3)),
            1,
            7,
        );
        const continuity = clamp(
            Number(developmentState?.apicalContinuity
                ?? (tier === 0 ? 0.9 : 0.42)),
            0,
            1,
        );
        const extensionDrive = clamp(
            Number(developmentState?.extensionDrive
                ?? spec.extensionCapacity
                ?? 0.5),
            0,
            1.2,
        );
        const maximumCount = clamp(
            Math.round(Number(spec.maximumInternodeCount ?? (
                4.4 + continuity * 1.6 + extensionDrive * 1.05
            ))),
            minimumCount,
            7,
        );
        const forkRhythmScale = clamp(
            Number(spec.forkIntervalScale
                ?? temperament.forkIntervalScale
                ?? 1),
            0.72,
            1.32,
        );
        const lateralHorizonScale = clamp(
            0.9
                + (Number(spec.lateralInvestmentScale ?? 1) - 1) * 0.28
                + (continuity - 0.5) * 0.12,
            0.78,
            1.22,
        );
        const requestedCount = (
            Number.isFinite(spec.plannedInternodeCount)
                ? Number(spec.plannedInternodeCount)
                : (4.35 + persistence * 1.25 + countWave * 0.55)
                    * forkRhythmScale
                    * lateralHorizonScale
        ) - forkCadenceCompression * 1.3;
        let plannedInternodeCount = clamp(
            Math.round(zenG15ProportionCount(context.proportionProfile, requestedCount, tier, spec.root)),
            minimumCount,
            maximumCount,
        );
        const extensionCharacter = clamp(
            0.92 + Number(spec.extensionCapacity ?? 0.5) * 0.14
                + Number(lineageResponse.axis_extent || 0) * 0.06,
            0.88,
            1.1,
        );
        // Height, transport distance, axis maturity and accumulated burden are
        // already owned by growth-maturation-field. Reapplying a 0.72-0.84
        // multiplier at every topological generation made a late scaffold
        // microscopic even when it emerged into open space with good supply.
        // Keep only a mild inherited construction character here; it describes
        // family taper without turning generationDepth into a second resource
        // economy.
        const structuralDecayBase = clamp(
            0.985
                - continuity * 0.1
                + (0.5 - context.phenotype.distalAttenuation) * 0.035
                + (Number(temperament.axisReachScale ?? 1) - 1) * 0.035,
            0.86,
            0.98,
        );
        const growthCycle = Math.max(0, Math.round(Number(spec.growthCycle || 0)));
        const renewalScale = growthCycle > 0
            ? 0.97 ** growthCycle * (spec.renewalMode === 'terminal_taper' ? 0.92 : 1)
            : 1;
        const plannedLengthScale = spec.root
            ? 1
            : clamp(
                (0.72 + continuity * 0.18 + extensionDrive * 0.1)
                    * structuralDecayBase ** Math.max(0, generationDepth - 1)
                    * extensionCharacter
                    * renewalScale,
                0.5,
                1.08,
            );
        // Future construction is a continuous option, not a binary bet made at
        // axis birth. A weak axis may earn reiteration later, while terminal
        // history can gradually release this reserve back to current growth.
        let descendantFraction = clamp(
            (spec.root ? 0.5 : 0.045)
                + reiterationCommitment * (spec.root ? 0.16 : 0.31)
                + (spec.root
                    ? 0
                    : architectureProfile.descendantConstructionShift),
            spec.root ? 0.5 : 0,
            spec.root ? 0.68 : 0.43,
        );
        const lateralInvestmentScale = clamp(
            Number(spec.lateralInvestmentScale ?? 1),
            0.58,
            1.62,
        );
        const lateralCompetence = clamp(
            Number(developmentState?.lateralCompetence
                ?? (tier <= 1 ? 0.48 : 0.12)),
            0,
            1.2,
        );
        const longitudinalOpportunity = clamp(
            (plannedInternodeCount - 3) / 4,
            0,
            1,
        );
        let lateralExpectedCount = context.researchControls?.liveSecondaryAxes !== false
            ? clamp(
                0.04
                    + lateralCompetence * 0.72
                    + context.phenotype.ramificationTempo * 0.28
                    // The investment field changes branching likelihood, but
                    // it no longer overwhelms every other source of evidence
                    // at the root or crown edge. A long-lived axis also earns
                    // more sites simply because it presents more distinct
                    // nodes to the phyllotactic field.
                    + (lateralInvestmentScale - 1) * 1.05
                    + longitudinalOpportunity * 0.22
                    + context.phenotype.lateralEmissionBias * 0.3
                    // Frequency and station timing are separate specimen
                    // signals. A seed can therefore initiate few early sites,
                    // many late sites, or the converse without one global
                    // "spread" latent forcing both decisions together.
                    + Number(context.phenotype.lateralInitiationBias || 0) * 0.5
                    + Number(lineageResponse.lateral_competence || 0) * 0.18
                    + architectureProfile.lateralOpportunityShift
                    // Lateral release and later reiteration are compatible
                    // developmental outcomes. Treating them as alternatives
                    // made long order-one axes empty until their terminal Y.
                    - reiterationCommitment * 0.05,
                0,
                2.45,
            )
            : 0;
        const lateralOpportunityReceipt=lateralOpportunity(context,spec,lateralExpectedCount);
        if(lateralOpportunityReceipt)lateralExpectedCount=lateralOpportunityReceipt.result;
        const lateralBaseCount = Math.floor(lateralExpectedCount);
        // A lateral site locally inhibits the immediately adjacent node. This
        // is a length-derived phyllotactic capacity, not a tier quota: longer
        // axes can still carry more sites, while a four-internode axis cannot
        // reserve two consecutive emissions before its first fork.
        const maximumReleaseStation = Math.max(1, plannedInternodeCount - 1);
        const minimumReleaseStation = generationDepth === 0
            ? Math.max(2, Math.ceil(plannedInternodeCount * 0.5))
            : 2;
        const maximumSpacedReleaseCount = maximumReleaseStation
            >= minimumReleaseStation
            ? Math.floor(
                (maximumReleaseStation - minimumReleaseStation) / 2,
            ) + 1
            : 0;
        const lateralOpportunitySample = context.rng.next();
        let lateralReleaseCapacity = clamp(
            tier === 0
                ? (lateralExpectedCount > 0.08
                    ? Math.max(1, Math.ceil(lateralExpectedCount - 0.08))
                    : 0)
                : lateralBaseCount + (
                    lateralOpportunitySample < lateralExpectedCount - lateralBaseCount
                        ? 1
                        : 0
                ),
            0,
            Math.min(
                maximumSpacedReleaseCount,
                plannedInternodeCount >= 7 && lateralCompetence >= 0.72 ? 3 : 2,
            ),
        );
        const resolveLateralFraction = releaseCount => resolveFamilyLateralFraction(tier,familyConstructionGrant,releaseCount,originalLateralFraction(releaseCount));
        const originalLateralFraction = (releaseCount) => (
            releaseCount > 0
                ? clamp(
                    0.1
                        + releaseCount * 0.065
                        + context.phenotype.lateralEmissionBias * 0.035
                        + (lateralInvestmentScale - 1) * 0.06,
                    0.14,
                    0.3,
                )
                : 0
        );
        let lateralFraction = resolveLateralFraction(lateralReleaseCapacity);
        // Viability is resolved once, when the axis portfolio is born. A site
        // is not registered and then rejected later by an unrelated minimum
        // clamp. If the reserved family stock cannot fund every sampled site,
        // reduce the commitment here and return the fraction to the axis.
        while (
            lateralReleaseCapacity > 0
            && familyConstructionGrant * lateralFraction
                / lateralReleaseCapacity < 0.055
        ) {
            lateralReleaseCapacity -= 1;
            lateralFraction = resolveLateralFraction(lateralReleaseCapacity);
        }
        const familyCadenceReceipt=familyCadence(context,spec,requestedCount,lateralReleaseCapacity);
        if(familyCadenceReceipt)plannedInternodeCount=clamp(Math.round(zenG15ProportionCount(context.proportionProfile,familyCadenceReceipt.count,tier,spec.root)),Math.max(minimumCount,lateralReleaseCapacity+1),maximumCount);
        const apicalSuccessionPlan = planZenG15ApicalSuccession(
            context, spec, plannedInternodeCount, lateralFraction,
        );
        if (apicalSuccessionPlan) {
            descendantFraction = Math.max(descendantFraction,
                apicalSuccessionPlan.reservedConstruction / familyConstructionGrant);
            anticipatesStructuralFork = true;
        }
        const stationPhase = context.rng.next();
        // An axis which already owns a later structural meristem samples its
        // lateral station from an earlier-skewed continuous phase. This leaves
        // physical arc length between the two events without prohibiting a
        // late lateral when the sampled phase strongly supports one.
        const structuralClearanceBias = anticipatesStructuralFork
            ? clamp(0.45 + reiterationCommitment * 0.5, 0.45, 0.95)
            : 0;
        const lateralTimingBias = clamp(
            Number(context.phenotype.lateralTimingBias || 0),
            -0.5,
            0.5,
        );
        const timingExponent = Math.exp(-lateralTimingBias * 0.92);
        const structurallyPhasedStation = stationPhase
            ** ((1 + structuralClearanceBias) * timingExponent);
        const birthJunctionInvestment = clamp(
            Number(spec.birthJunctionInvestment || 0),
            0,
            1,
        );
        const birthJunctionKind = spec.birthJunctionKind || null;
        // A lateral-born axis begins beside an already committed continuation.
        // That occupied junction is developmental history, not a completed-
        // silhouette correction. Let it push the sampled first release phase
        // distally, while retaining the entire station range and allowing the
        // structural-fork tendency above to pull in the opposite direction.
        const birthJunctionClearanceBias = birthJunctionKind
            ? clamp(
                0.18
                    + birthJunctionInvestment * 0.58
                    + (1 - continuity) * 0.08,
                0.18,
                0.82,
            )
            : 0;
        const cadenceStationPhase = structurallyPhasedStation
            + (1 - structurallyPhasedStation)
                * birthJunctionClearanceBias;
        const fixedStationCapacity = tier === 0 ? 0 : lateralReleaseCapacity;
        const lateralReleaseStations = new Array(fixedStationCapacity)
            .fill(0)
            .map((_, index) => {
                if (fixedStationCapacity === 1) {
                    return clamp(
                        Math.round(
                            minimumReleaseStation
                                + (maximumReleaseStation - minimumReleaseStation)
                                    * (0.06 + cadenceStationPhase * 0.88),
                        ),
                        minimumReleaseStation,
                        maximumReleaseStation,
                    );
                }
                const progress = index / (fixedStationCapacity - 1);
                return Math.round(
                    minimumReleaseStation
                        + (maximumReleaseStation - minimumReleaseStation) * progress,
                );
            });
        const lateralReleaseProgresses = lateralReleaseStations.map(
            (station) => station / plannedInternodeCount,
        );
        const reservedFraction = descendantFraction + lateralFraction;
        if (reservedFraction > 0.68) {
            descendantFraction = Math.max(0, 0.68 - lateralFraction);
        }
        const axisFraction = 1 - descendantFraction - lateralFraction;
        const axisConstructionBudget = familyConstructionGrant * axisFraction;
        const descendantConstructionBudget = familyConstructionGrant
            * descendantFraction;
        const lateralConstructionBudget = familyConstructionGrant
            * lateralFraction;
        const slope = clamp(
            Number(lineageResponse.axis_extent || 0) * 0.14
                + (Number(temperament.axisReachScale ?? 1) - 1) * 0.18
                - context.phenotype.distalAttenuation * 0.07,
            -0.22,
            0.16,
        );
        const rhythmAmplitude = clamp(
            0.045
                + Math.abs(Number(temperament.internodeRhythm ?? 1) - 1) * 0.12,
            0.035,
            0.11,
        );
        const rawWeights = new Array(plannedInternodeCount).fill(0).map((_, index) => {
            const progress = plannedInternodeCount <= 1
                ? 0
                : index / (plannedInternodeCount - 1);
            const rhythm = Math.sin(
                (index + 1) * 1.37
                    + Number(temperament.developmentalPhase || 0) * 2.11,
            ) * rhythmAmplitude;
            return clamp(1 + slope * (progress * 2 - 1) + rhythm, 0.72, 1.28);
        });
        const plannedStepBudgets = normalizeWeights(rawWeights).map(
            (weight) => axisConstructionBudget * weight,
        );
        return Object.freeze({
            semantics: PORTFOLIO_SEMANTICS,
            ...(lateralOpportunityReceipt ? {lateralOpportunity:lateralOpportunityReceipt} : {}),
            ...(familyCadenceReceipt ? {familyCadence:familyCadenceReceipt} : {}),
            ...(apicalSuccessionPlan ? { apicalSuccessionPlan } : {}),
            familyConstructionGrant: rounded(familyConstructionGrant),
            axisConstructionBudget: rounded(axisConstructionBudget),
            descendantConstructionBudget: rounded(descendantConstructionBudget),
            lateralConstructionBudget: rounded(lateralConstructionBudget),
            lateralTimingMode: tier === 0
                ? 'inherited_axis_family_arc_readiness'
                : 'local_fixed_station',
            lateralOpportunityPotential: rounded(lateralExpectedCount),
            lateralOpportunitySample: rounded(lateralOpportunitySample),
            lateralReleaseCapacity,
            lateralReleaseProgresses: Object.freeze(
                lateralReleaseProgresses.map((value) => rounded(value)),
            ),
            lateralReleaseStations: Object.freeze([...lateralReleaseStations]),
            lateralStationPhase: rounded(stationPhase),
            lateralTimingBias: rounded(lateralTimingBias),
            lateralTimingExponent: rounded(timingExponent),
            cadenceStationPhase: rounded(cadenceStationPhase),
            structuralClearanceBias: rounded(structuralClearanceBias),
            birthJunctionKind,
            birthJunctionInvestment: rounded(birthJunctionInvestment),
            birthJunctionClearanceBias: rounded(
                birthJunctionClearanceBias,
            ),
            lateralReleasesCommitted: 0,
            lastLateralSide: 0,
            lastLateralProgress: null,
            plannedInternodeCount,
            generationDepth: rounded(generationDepth),
            birthOntogeneticCoordinates,
            architectureProfile,
            forkCadenceCompression: rounded(forkCadenceCompression),
            plannedLengthScale: rounded(clamp(plannedLengthScale, 0.34, 1.08)),
            plannedStepBudgets: Object.freeze(plannedStepBudgets.map(
                (value) => rounded(value),
            )),
            cursor: 0,
            carriedConstruction: 0,
            adaptiveConstruction: 0,
            anticipatesStructuralFork,
            reiterationCommitment: rounded(reiterationCommitment),
            forkRhythmScale: rounded(forkRhythmScale),
            lateralHorizonScale: rounded(lateralHorizonScale),
            lateralInvestmentScale: rounded(lateralInvestmentScale),
            growthCycle,
            renewalScore: rounded(clamp(Number(spec.renewalScore || 0), 0, 1.4)),
            renewalMode: spec.renewalMode || 'initial_portfolio',
            allocation: Object.freeze({
                axisFraction: rounded(axisFraction),
                descendantFraction: rounded(descendantFraction),
                lateralFraction: rounded(lateralFraction),
            }),
        });
    }

    function plannedSpendAllowance(portfolio) {
        if (!portfolio || portfolio.cursor >= portfolio.plannedInternodeCount) return 0;
        const remainingSteps = Math.max(
            1,
            portfolio.plannedInternodeCount - portfolio.cursor,
        );
        const scheduled = Number(
            portfolio.plannedStepBudgets[portfolio.cursor] || 0,
        );
        return Math.max(
            0,
            scheduled
                + Number(portfolio.carriedConstruction || 0) * 0.34
                + Number(portfolio.adaptiveConstruction || 0) / remainingSteps,
        );
    }

    function spendAxisConstructionPortfolio(portfolio, allowance, cost) {
        if (!portfolio) return null;
        const remainingSteps = Math.max(
            1,
            portfolio.plannedInternodeCount - portfolio.cursor,
        );
        const adaptiveShare = Number(portfolio.adaptiveConstruction || 0)
            / remainingSteps;
        const unused = Math.max(0, allowance - cost);
        return Object.freeze({
            ...portfolio,
            cursor: Math.min(
                portfolio.plannedInternodeCount,
                portfolio.cursor + 1,
            ),
            carriedConstruction: rounded(
                Number(portfolio.carriedConstruction || 0) * 0.66 + unused,
            ),
            adaptiveConstruction: rounded(Math.max(
                0,
                Number(portfolio.adaptiveConstruction || 0) - adaptiveShare,
            )),
        });
    }

    function creditAxisConstructionPortfolio(portfolio, constructionIncome) {
        if (!portfolio || constructionIncome <= 0) return portfolio;
        return Object.freeze({
            ...portfolio,
            adaptiveConstruction: rounded(
                Number(portfolio.adaptiveConstruction || 0)
                    + constructionIncome,
            ),
        });
    }

    function commitLateralConstructionPortfolio(portfolio, amount, metadata = {}) {
        if (!portfolio || amount <= 0) return portfolio;
        const side = Math.sign(Number(metadata.side || 0));
        const progress = Number(metadata.progress);
        const physicalTiming = portfolio.lateralTimingMode === 'physical_axis_distance';
        if (physicalTiming && !(Number.isFinite(metadata.distance) && metadata.distance > portfolio.lastLateralDistance)) {
            throw new Error('ZEN_G15_AXIS_LATERAL_DISTANCE_REQUIRED');
        }
        return Object.freeze({
            ...portfolio,
            ...(physicalTiming ? {lastLateralDistance:metadata.distance} : {}),
            lateralConstructionBudget: rounded(Math.max(
                0,
                Number(portfolio.lateralConstructionBudget || 0) - amount,
            )),
            lateralReleasesCommitted: Math.min(
                Number(portfolio.lateralReleaseCapacity || 0),
                Number(portfolio.lateralReleasesCommitted || 0) + 1,
            ),
            lastLateralSide: side || Number(portfolio.lastLateralSide || 0),
            lastLateralProgress: Number.isFinite(progress)
                ? rounded(clamp(progress, 0, 1))
                : portfolio.lastLateralProgress,
        });
    }

    function reconcileAxisConstructionCommitments(portfolio, developmentState) {
        if (
            !portfolio
            || Number(portfolio.descendantConstructionBudget || 0) <= 0
        ) return portfolio;
        const state = developmentState || {};
        const terminal = clamp(Number(state.terminalAffinity || 0), 0, 1);
        const maturity = clamp(Number(state.maturity || 0), 0, 1.25);
        const credit = clamp(Number(state.reiterationCredit || 0), 0, 2.2);
        const stress = clamp(Number(state.stressMemory || 0), 0, 1);
        const releasePressure = clamp(
            Math.max(0, terminal - 0.42) * 1.35
                + Math.max(0, maturity - 0.82) * 0.5
                + Math.max(0, 0.46 - credit) * 0.55
                + stress * 0.24,
            0,
            1,
        );
        if (releasePressure < 0.24) return portfolio;
        const available = Number(portfolio.descendantConstructionBudget || 0);
        const uncommitted = Math.max(0, available
            - (portfolio.apicalSuccessionPlan?.reservedConstruction ?? 0));
        const released = uncommitted * clamp(
            0.12 + (releasePressure - 0.24) * 0.72,
            0.12,
            0.68,
        );
        const remaining = Math.max(0, available - released);
        const allocation = portfolio.allocation || {};
        const grant = Math.max(1e-8, Number(portfolio.familyConstructionGrant || 0));
        return Object.freeze({
            ...portfolio,
            axisConstructionBudget: rounded(
                Number(portfolio.axisConstructionBudget || 0) + released,
            ),
            descendantConstructionBudget: rounded(remaining),
            adaptiveConstruction: rounded(
                Number(portfolio.adaptiveConstruction || 0) + released,
            ),
            anticipatesStructuralFork: remaining > grant * 0.04,
            reiterationCommitment: rounded(
                resolveConstructionReiterationCommitment(remaining, grant),
            ),
            allocation: Object.freeze({
                ...allocation,
                axisFraction: rounded(
                    Number(allocation.axisFraction || 0)
                        + released / grant,
                ),
                descendantFraction: rounded(remaining / grant),
            }),
            lastCommitmentReconciliation: Object.freeze({
                kind: 'history_released_descendant_construction',
                releasedConstruction: rounded(released),
                remainingConstruction: rounded(remaining),
                releasePressure: rounded(releasePressure),
            }),
        });
    }

    function renewAxisConstructionPortfolio(
        context,
        frontier,
        developmentState,
        options = {},
    ) {
        if (!['baseline', 'candidate'].includes(context.constructionTreatment)) {
            throw new Error('ZEN_G15_CONSTRUCTION_TREATMENT_INVALID');
        }
        const portfolio = frontier.constructionPortfolio;
        if (
            !portfolio
            || portfolio.cursor < portfolio.plannedInternodeCount
        ) return null;
        const state = developmentState || frontier.developmentState;
        const continuity = clamp(Number(state?.apicalContinuity || 0), 0, 1);
        const extension = clamp(Number(state?.extensionDrive || 0), 0, 1.2);
        const support = clamp(Number(state?.supportInvestment || 0), 0, 1.2);
        const terminal = clamp(Number(state?.terminalAffinity || 0), 0, 1);
        const stress = clamp(Number(state?.stressMemory || 0), 0, 1);
        const constructionGrant = Math.max(
            0,
            Number(frontier.constructionReserve || 0),
        );
        const unitCost = unitConstructionCost(context, {
            ...frontier,
            developmentState: state,
        });
        const localLength = Math.max(
            8,
            Number(frontier.previousInternodeLength || TIERS[frontier.tier].meanLength),
        );
        const constructionCoverage = clamp(
            constructionGrant / Math.max(1e-8, unitCost * localLength * 2.1),
            0,
            1.3,
        );
        const exposure = clamp(Number(state?.exposureMemory || 0.5), 0, 1.2);
        const transport = clamp(Number(state?.transportBurden || 0), 0, 1.8);
        const continuationCredit = clamp(
            Number(state?.continuationCredit || 0),
            0,
            1.4,
        );
        const growthCycle = Number(portfolio.growthCycle || 0);
        const resourceCondition = clamp(
            Number(frontier.resourceReserve || 0) / 0.72,
            0,
            1.2,
        );
        const horizon=resolveZenG15AxisHorizon(context,frontier);
        const continuationDemand = horizon ? null : resolveZenG15DistalExtension(context, frontier);
        const continuationScore = clamp(
            continuationCredit * 0.32
                + continuity * 0.13
                + extension * 0.14
                + support * 0.09
                + exposure * 0.09
                + constructionCoverage * 0.16
                + resourceCondition * 0.1
                - terminal * 0.12
                - stress * 0.15
                - transport * 0.1
                - growthCycle * 0.055,
            0,
            1.25,
        ) * (horizon ? horizon.continuationScale : continuationDemand ? continuationDemand.lengthScale : 1);
        if (continuationScore < 0.25 || constructionCoverage < 0.1) return null;
        const terminalTaper = continuationScore < 0.38;
        const plannedInternodeCount = clamp(
            terminalTaper
                ? 2
                : Math.round(
                    1.55
                        + continuationScore * 2.15
                        + continuationCredit * 0.35,
                ),
            2,
            4,
        );
        const reiterationCommitment = clamp(
            Number(state?.reiterationCredit || 0) / 1.18,
            0,
            1,
        );
        // Explicit historical experiment: the baseline intentionally replays
        // the pre-patch root placement and unspecified role/radius projection.
        // It is never selected because canonical coordinates are missing.
        const renewalPlacement = context.constructionTreatment === 'baseline'
            ? { origin: { x: 0, y: 0, z: 0 } }
            : { origin: options.origin, axisOrder: frontier.axisOrder,
                tierRole: frontier.tierRole, radius: frontier.radius };
        if (context.constructionTreatment === 'candidate' && (
            !Number.isInteger(frontier.axisOrder) || frontier.axisOrder < 0 || frontier.axisOrder > 2
            || typeof frontier.tierRole !== 'string' || frontier.tierRole.length === 0
            || !Number.isFinite(frontier.radius) || frontier.radius <= 0
        )) throw new Error('ZEN_G15_CONSTRUCTION_RENEWAL_ROLE_REQUIRED');
        const renewed = bindZenG15AxisDevelopment(context, createAxisConstructionPortfolio(context, {
            tier: frontier.tier,
            ...renewalPlacement,
            generationDepth: frontier.generationDepth,
            familyConstructionGrant: constructionGrant,
            minimumInternodeCount: 2,
            maximumInternodeCount: 4,
            plannedInternodeCount,
            anticipatesStructuralFork: reiterationCommitment >= 0.72,
            reiterationCommitment,
            extensionCapacity: extension,
            lateralInvestmentScale: clamp(
                0.78 + Number(state?.lateralCompetence || 0) * 0.54,
                0.68,
                1.34,
            ),
            developmentState: state,
            temperament: frontier.temperament,
            growthCycle: growthCycle + 1,
            renewalScore: continuationScore,
            renewalMode: terminalTaper ? 'terminal_taper' : 'history_continuation',
        }), {tier:frontier.tier,radius:frontier.radius,referenceLength:frontier.previousInternodeLength,startAxisAge:frontier.axisAge});
        if (!options.preservePendingForkConstruction) return renewed;
        const preservedDescendant = Math.max(
            0,
            Number(portfolio.descendantConstructionBudget || 0),
        );
        const preservedUnusedLateral = Math.max(
            0,
            Number(portfolio.lateralConstructionBudget || 0),
        );
        const preservedCommitment = preservedDescendant
            + preservedUnusedLateral;
        if (preservedCommitment <= 0) return renewed;
        const familyConstructionGrant = Number(
            renewed.familyConstructionGrant || 0,
        ) + preservedCommitment;
        const descendantConstructionBudget = Number(
            renewed.descendantConstructionBudget || 0,
        ) + preservedCommitment;
        const axisConstructionBudget = Number(
            renewed.axisConstructionBudget || 0,
        );
        const lateralConstructionBudget = Number(
            renewed.lateralConstructionBudget || 0,
        );
        const allocation = renewed.allocation || {};
        const carriedReiterationCommitment =
            resolveConstructionReiterationCommitment(
                descendantConstructionBudget,
                familyConstructionGrant,
            );
        const carriedAllocation = Object.freeze({
            axisFraction: rounded(
                axisConstructionBudget
                    / Math.max(1e-8, familyConstructionGrant),
            ),
            descendantFraction: rounded(
                descendantConstructionBudget
                    / Math.max(1e-8, familyConstructionGrant),
            ),
            lateralFraction: rounded(
                lateralConstructionBudget
                    / Math.max(1e-8, familyConstructionGrant),
            ),
        });
        return Object.freeze({
            ...renewed,
            familyConstructionGrant: rounded(familyConstructionGrant),
            descendantConstructionBudget: rounded(
                descendantConstructionBudget,
            ),
            anticipatesStructuralFork: true,
            // The planning value above shaped this renewal's sampled
            // internodes. Once an already-owned pending-fork commitment is
            // carried into the new family grant, the exported portfolio must
            // report the realized construction commitment instead of leaving
            // that pre-carry planning value beside a different allocation.
            reiterationCommitment: rounded(carriedReiterationCommitment),
            allocation: carriedAllocation,
            pendingForkConstructionCarry: Object.freeze({
                semantics: PENDING_FORK_CONSTRUCTION_CARRY_SEMANTICS,
                descendantConstruction: rounded(preservedDescendant),
                unusedLateralConstruction: rounded(preservedUnusedLateral),
                total: rounded(preservedCommitment),
                familyConstructionGrantBefore: rounded(
                    renewed.familyConstructionGrant,
                ),
                familyConstructionGrantAfter: rounded(
                    familyConstructionGrant,
                ),
                descendantConstructionBefore: rounded(
                    renewed.descendantConstructionBudget,
                ),
                descendantConstructionAfter: rounded(
                    descendantConstructionBudget,
                ),
                reiterationCommitmentBefore: rounded(
                    renewed.reiterationCommitment,
                ),
                reiterationCommitmentAfter: rounded(
                    carriedReiterationCommitment,
                ),
                allocationBefore: allocation,
                allocationAfter: carriedAllocation,
            }),
        });
    }

    function unitConstructionCost(context, frontier) {
        const tier = TIERS[frontier.tier];
        const referenceRadius = Math.max(1, 18.5 * context.vigor);
        const relativeRadius = clamp(frontier.radius / referenceRadius, 0.06, 1.5);
        const origin = frontier.point
            || context.nodeIndex?.get(frontier.nodeId)?.point
            || { x: 0, y: 0, z: 0 };
        const transportScale = Math.max(
            120,
            280
                * context.form.heightScale
                * context.preset.statureScale
                * context.phenotype.stature,
        );
        const transportPressure = clamp(magnitude(origin) / transportScale, 0, 1.5);
        return (0.035 + relativeRadius ** 2 * 0.075)
            * (1 + transportPressure * 0.22)
            / Math.max(1, tier.meanLength);
    }

    function constructionCost(context, frontier, runLength) {
        return Math.max(0, runLength) * unitConstructionCost(context, frontier);
    }

    function affordableLength(context, frontier) {
        const stock = Math.max(0, Number(frontier.constructionReserve || 0));
        const allowance = frontier.constructionPortfolio
            ? Math.min(stock, plannedSpendAllowance(frontier.constructionPortfolio))
            : stock;
        return allowance
            / Math.max(1e-8, unitConstructionCost(context, frontier));
    }

    function minimumViableInternode(context, frontier) {
        const tier = TIERS[frontier.tier];
        const prior = Number(frontier.previousInternodeLength || 0);
        const localReference = prior > 0
            ? prior
            : tier.meanLength * context.preset.statureScale;
        const extensionDrive = clamp(
            Number(frontier.developmentState?.extensionDrive ?? 0.5),
            0,
            1,
        );
        return Math.max(4, localReference * (0.29 + extensionDrive * 0.06));
    }

    function canConstructInternode(context, frontier) {
        if (
            frontier.constructionPortfolio
            && frontier.constructionPortfolio.cursor
                >= frontier.constructionPortfolio.plannedInternodeCount
        ) return false;
        return affordableLength(context, frontier)
            >= minimumViableInternode(context, frontier);
    }

    function resolveInternodeConstruction(
        context,
        frontier,
        episode,
        options = {},
    ) {
        const config = TIERS[frontier.tier];
        const origin = frontier.point
            || options.origin
            || { x: 0, y: 0, z: 0 };
        const maturation = resolveExtensionMaturation(context, frontier, origin);
        const correlatedPhase = Math.sin(
            ((frontier.axisAge ?? 0) + 1) * 1.19
                + frontier.temperament.resourceBias * 3.1
                + (episode.birthEvent ?? 0) * 0.17,
        );
        const rhythm = frontier.temperament.internodeRhythm ?? 1;
        const variation = 1 + correlatedPhase
            * config.lengthVariation
            * 0.54
            * rhythm;
        const vigorScale = clamp(0.82 + frontier.vigor * 0.18, 0.78, 1.12);
        const regrowthScale = frontier.maturationState === 'resting_support_build'
            ? 1.08 + Math.min(0.08, (frontier.regrowthPulseCount || 0) * 0.04)
            : 1;
        const maturationAge = Math.max(
            0,
            frontier.axisAge - frontier.axisStepLimit + 1,
        );
        const terminalReachScale = frontier.tier <= 1
            ? 0.88 ** maturationAge
            : 0.9 ** maturationAge;
        const developmentalCharacter = clamp(
            0.82 + Math.sqrt(clamp(
                Number(frontier.developmentalCapacity ?? 1),
                0.02,
                1,
            )) * 0.18,
            0.84,
            1,
        );
        const horizon=resolveZenG15AxisHorizon(context,frontier);
        const distalExtension = horizon ? null : resolveZenG15DistalExtension(context, frontier);
        const factors = [
            ...(horizon ? [['horizon',horizon.extensionScale]] : [
                ['composition',zenG15CompositionLengthScale(context.compositionPlan,origin,frontier.tier)],
                ['distalRun',distalExtension ? distalExtension.lengthScale : 1],
                ['proportion',zenG15ProportionLengthScale(context.proportionProfile, frontier.tier, maturation.coordinates)],
            ]),
            ['stature',context.preset.statureScale],
            ['lengthTrait',frontier.temperament.lengthScale],
            ['extentTrait',frontier.temperament.axisExtentScale ?? 1],
            ['reachTrait',frontier.temperament.axisReachScale],
            ['episode',episode.segmentLengthScale],
            ['rhythm',variation],['vigor',vigorScale],['regrowth',regrowthScale],
            ...(horizon ? [['trajectory',maturation.developmentalTrajectory.effect.internodeScale]]
                : [['maturation',maturation.lengthScale],['axisAge',terminalReachScale]]),
            ['capacity',developmentalCharacter],
            ['portfolio',Number(frontier.constructionPortfolio?.plannedLengthScale || 1)],
            ['terminalAffinity',frontier.cluster
                ? 1 - Number(frontier.developmentState?.terminalAffinity || 0) * 0.16
                : 1],
            ['emergence',clamp(Number(options.emergenceScale ?? 1), 0.55, 1.08)],
        ];
        const rawRequest=zenG15ExtensionDemand(config.meanLength,factors);
        const factorExtensionReceipt=factorExtension(context,frontier,rawRequest);
        const requestedBeforeContinuity=factorExtensionReceipt ? factorExtensionReceipt.result : rawRequest;
        if(factorExtensionReceipt)factors.push(['calibreAttenuation',requestedBeforeContinuity/rawRequest]);
        const previousInternodeLength = Number(
            frontier.previousInternodeLength || 0,
        );
        const continuityWeight = previousInternodeLength > 0
            ? (options.birth
                ? (frontier.constructionPortfolio
                    ? clamp(
                        0.26
                            + Number(
                                frontier.developmentState?.apicalContinuity || 0,
                            ) * 0.16,
                        0.26,
                        0.44,
                    )
                    : 0.68)
                : clamp(
                    0.44
                        + Number(frontier.developmentState?.apicalContinuity || 0)
                            * 0.14,
                    0.44,
                    0.6,
                ))
            : 0;
        const requestedLength = previousInternodeLength > 0
            ? previousInternodeLength * continuityWeight
                + requestedBeforeContinuity * (1 - continuityWeight)
            : requestedBeforeContinuity;
        const constructionReserve = Math.max(
            0,
            Number(frontier.constructionReserve || 0),
        );
        const plannedAllowance = frontier.constructionPortfolio
            ? plannedSpendAllowance(frontier.constructionPortfolio)
            : constructionReserve;
        const availableSpend = Math.min(constructionReserve, plannedAllowance);
        const availableLength = availableSpend
            / Math.max(1e-8, unitConstructionCost(context, frontier));
        const realizedLength = Math.max(0, Math.min(requestedLength, availableLength));
        recordZenG15Decision(context,{kind:'extension',lineageId:frontier.lineageId,axisAge:frontier.axisAge,tier:frontier.tier,
            base:config.meanLength,factors:Object.fromEntries(factors),requestedBeforeContinuity,
            previousInternodeLength,continuityWeight,requestedLength,availableLength,realizedLength,horizon});
        const cost = constructionCost(context, frontier, realizedLength);
        const portfolioAfterConstruction = spendAxisConstructionPortfolio(
            frontier.constructionPortfolio,
            plannedAllowance,
            cost,
        );

        return Object.freeze({
            semantics: 'soft_supply_demand_construction_account_v3',
            ...(factorExtensionReceipt ? {factorExtension:factorExtensionReceipt} : {}),
            ...(distalExtension ? { distalExtension } : {}),
            requestedBeforeContinuity: rounded(requestedBeforeContinuity),
            previousInternodeLength: rounded(previousInternodeLength),
            continuityWeight: rounded(continuityWeight),
            requestedLength: rounded(requestedLength),
            affordableLength: rounded(availableLength),
            totalStockAffordableLength: rounded(
                constructionReserve
                    / Math.max(1e-8, unitConstructionCost(context, frontier)),
            ),
            realizedLength: rounded(realizedLength),
            unitCost: rounded(unitConstructionCost(context, frontier), 8),
            constructionCost: rounded(cost),
            reserveBefore: rounded(constructionReserve),
            reserveAfterConstruction: rounded(Math.max(
                0,
                Number(frontier.constructionReserve || 0) - cost,
            )),
            budgetLimited: realizedLength + 1e-6 < requestedLength,
            portfolioLimited: Boolean(frontier.constructionPortfolio)
                && plannedAllowance + 1e-8 < constructionReserve,
            plannedSpendAllowance: rounded(plannedAllowance),
            constructionPortfolioBefore: frontier.constructionPortfolio || null,
            portfolioAfterConstruction,
            maturation,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerConstructionAccount = Object.freeze({
        unitConstructionCost,
        constructionCost,
        affordableLength,
        minimumViableInternode,
        canConstructInternode,
        createAxisConstructionPortfolio,
        plannedSpendAllowance,
        creditAxisConstructionPortfolio,
        commitLateralConstructionPortfolio,
        reconcileAxisConstructionCommitments,
        renewAxisConstructionPortfolio,
        resolveInternodeConstruction,
    });
}(zenPlumeKernelRealm));
