import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {familyCompletion} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
/**
 * G15.4 role-authoritative three-tier developmental architecture.
 *
 * This owner is deliberately smaller than a silhouette planner. It owns the
 * meanings of the three developmental tiers, the route-neutral frame used by
 * visible tier-zero scaffold stations, and a scale-relative differentiation
 * potential. Resource owners still decide how much can be built; fork and
 * lateral owners still perform their distinct graph mutations.
 */
import {resolveZenG15AxisHorizon} from './ZenBonsaiG15AxisHorizon.js';
(function installTypedDevelopmentalTierArchitecture(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const crownArchitecture = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    if (!programs || !crownArchitecture) {
        throw new Error(
            '[G15.4_TIER_ARCHITECTURE] programs and crown architecture must load first.',
        );
    }

    const {
        clamp,
        normalize,
        mixDirection,
        rotateGrowthPlane,
        directionAzimuth,
        directionElevation,
        directionFromAzimuthElevation,
        signedPlanarAngle,
        rounded,
    } = programs;
    const { resolveCrownArchitectureProfile } = crownArchitecture;

    const TIER_ARCHITECTURE_SEMANTICS =
        'role_authoritative_three_tier_development_v1';
    const STRUCTURAL_STATION_SEMANTICS =
        'route_neutral_tier_zero_structural_station_v1';
    const STATION_TRAJECTORY_SEMANTICS =
        'asymptotic_scaffold_station_trajectory_v1';
    const RELATIVE_DIFFERENTIATION_SEMANTICS =
        'tier_local_relative_differentiation_potential_v1';

    const TIER_ROLES = Object.freeze([
        'structural_framework',
        'scaffold_family',
        'terminal_ramification',
    ]);

    const smoothstep = (value) => {
        const progress = clamp(Number(value || 0), 0, 1);
        return progress * progress * (3 - 2 * progress);
    };

    function tierFor(value) {
        return clamp(Math.round(Number(value || 0)), 0, 2);
    }

    function tierRoleFor(value) {
        return TIER_ROLES[tierFor(value)];
    }

    function phaseFor(frontier, ordinal = 0, salt = 0) {
        const temperament = frontier?.temperament || {};
        return (
            Math.sin(
                Number(temperament.developmentalPhase || 0) * 3.71
                    + Number(temperament.resourceBias || 0.5) * 2.17
                    + Number(temperament.clusterSlot || 0) * 1.43
                    + Number(ordinal || 0) * 1.19
                    + salt,
            ) + 1
        ) * 0.5;
    }

    /**
     * Project continuous family responsibilities onto three explicit roles.
     * One child remains in the parent's role when that role is still active;
     * balanced siblings may both retain it. Tier two is terminal in role, not
     * in length: it may keep ramifying without inventing order 3, 4, ... .
     */
    function resolveChildTierRoles(context, frontier, drafts) {
        if (!Array.isArray(drafts) || drafts.length < 2) {
            throw new TypeError(
                '[G15.4_TIER_ARCHITECTURE] Child role drafts are required.',
            );
        }
        const parentTier = tierFor(frontier.axisOrder ?? frontier.tier);
        const strongestPotential = Math.max(...drafts.map(
            (draft) => Number(draft.retentionPotential || 0),
        ));
        // A funded upper-axis transition can complete the framework role.
        // Previously the strongest child retained it even when no child met
        // the identity threshold: a main trunk label could persist forever.
        // Use local calibre relative to the root, not a finished silhouette.
        const horizon=resolveZenG15AxisHorizon(context,frontier);
        const apicalCompletionPressure = horizon && frontier.constructionPortfolio?.apicalSuccessionPlan
            ? horizon.completionPressure : frontier.constructionPortfolio?.apicalSuccessionPlan
            && parentTier === 0
            ? smoothstep((.38 - frontier.radius / (18.5 * context.vigor)) / .18)
            : 0;
        const familyCompletionReceipt=familyCompletion(context,frontier);
        const completionPressure=familyCompletionReceipt ? Math.max(apicalCompletionPressure,familyCompletionReceipt.pressure) : apicalCompletionPressure;
        const naturallyRetained = drafts.map((draft) => (
            Number(draft.retentionPotential || 0) * (1 - completionPressure)
                >= Number(draft.identityThreshold || 1)
        ));
        if (parentTier < 2 && completionPressure < .5 && !naturallyRetained.some(Boolean)) {
            const strongestIndex = drafts.findIndex((draft) => (
                Math.abs(
                    Number(draft.retentionPotential || 0) - strongestPotential,
                ) <= 1e-10
            ));
            naturallyRetained[strongestIndex] = true;
        }
        const childTiers = drafts.map((draft, index) => (
            parentTier === 2
                ? 2
                : (naturallyRetained[index] ? parentTier : parentTier + 1)
        ));
        const retainedCount = childTiers.filter(
            (childTier) => childTier === parentTier,
        ).length;
        const outcome = parentTier === 0
            ? (retainedCount === 0 ? 'framework_completed_into_crown_axes' : retainedCount >= 2
                ? 'co_structural_bifurcation'
                : 'structural_succession_release')
            : (parentTier === 1
                ? (retainedCount >= 2
                    ? 'scaffold_family_bifurcation'
                    : 'scaffold_terminal_release')
                : 'terminal_family_ramification');
        return Object.freeze({
            semantics: TIER_ARCHITECTURE_SEMANTICS,
            ...(apicalCompletionPressure > 0 ? { apicalCompletionPressure: rounded(apicalCompletionPressure) } : {}),
            parentTier,
            parentRole: tierRoleFor(parentTier),
            ...(familyCompletionReceipt ? {familyCompletion:familyCompletionReceipt} : {}),
            familyOutcome: outcome,
            retainedCount,
            childTiers: Object.freeze(childTiers),
            childRoles: Object.freeze(childTiers.map(tierRoleFor)),
            topologyAuthority: 'continuous_family_responsibility_projected_to_roles',
            resourceAuthority: false,
            directionAuthority: false,
        });
    }

    function resolveRelativeDifferentiationPotential(
        context,
        frontier,
        spec = {},
    ) {
        const tier = tierFor(spec.tier ?? spec.axisOrder ?? frontier.tier);
        const architectureProfile = spec.architectureProfile
            || resolveCrownArchitectureProfile(context, frontier, spec.point);
        const relativeShare = clamp(Number(spec.resourceShare ?? 0.5), 0.04, 1);
        const extension = clamp(Number(spec.extensionCapacity ?? 0.5), 0, 1);
        const support = clamp(Number(spec.supportCapacity ?? 0.5), 0, 1);
        const localScale = Math.sqrt(relativeShare);
        const roleBase = tier === 0 ? 0.82 : (tier === 1 ? 0.63 : 0.4);
        const upperSupport = architectureProfile.upperComplexityPressure
            * (tier === 1 ? 0.19 : 0.13);
        const potential = clamp(
            roleBase
                + localScale * 0.13
                + extension * 0.1
                + support * 0.06
                + upperSupport
                + (phaseFor(frontier, tier, 2.41) - 0.5) * 0.08,
            tier === 0 ? 0.5 : (tier === 1 ? 0.38 : 0.22),
            tier === 0 ? 1 : (tier === 1 ? 0.94 : 0.74),
        );
        return Object.freeze({
            semantics: RELATIVE_DIFFERENTIATION_SEMANTICS,
            tier,
            role: tierRoleFor(tier),
            potential: rounded(potential),
            relativeShare: rounded(relativeShare),
            localScale: rounded(localScale),
            extension: rounded(extension),
            support: rounded(support),
            upperSupport: rounded(upperSupport),
            architectureProfile,
            absoluteCapacityAuthority: false,
        });
    }

    /**
     * A non-linear station sequence: the first reduction is meaningful, then
     * the rate itself eases toward an asymptote. Realized internode overshoot
     * is observed by cadence but never fed back into the next target.
     */
    function resolveScaffoldStationTrajectory(context, frontier, spec = {}) {
        const architectureProfile = spec.architectureProfile
            || resolveCrownArchitectureProfile(context, frontier, spec.point);
        const stationIndex = Math.max(0, Math.round(Number(spec.stationIndex || 0)));
        const referenceLength = Math.max(8, Number(spec.referenceLength || 24));
        const baseGapLength = Math.max(
            referenceLength * 1.5,
            Number(spec.baseGapLength || spec.currentGapLength || referenceLength * 2.6),
        );
        const compression = clamp(
            Number(context.architectureControls?.scaffoldStationCompression ?? 0.72),
            0,
            1.4,
        );
        const asymptoteRatio = clamp(0.52 - compression * 0.1, 0.36, 0.52);
        const rate = 0.62 + compression * 0.28;
        const power = 1.08 + compression * 0.08;
        const trajectoryRatio = asymptoteRatio
            + (1 - asymptoteRatio)
                / ((1 + rate * stationIndex) ** power);
        const localPhase = phaseFor(frontier, stationIndex, 4.67);
        const phaseScale = 0.97 + localPhase * 0.06;
        // Plan the next claim at the current branch scale. Keeping the basal
        // separation all the way to a slender apical cohort makes a ready,
        // funded bud wait through several otherwise empty internodes. This
        // only sets a new claim; it never changes an active permission target.
        const calibreScale = frontier.constructionPortfolio?.apicalSuccessionPlan
            ? .45 + .55 * Math.sqrt(clamp(frontier.radius / (18.5 * context.vigor), 0, 1))
            : 1;
        const trajectoryTarget = Math.max(
            referenceLength * 1.18,
            baseGapLength * trajectoryRatio * phaseScale * calibreScale,
        );
        const priorTarget = Math.max(
            referenceLength,
            Number(spec.currentGapLength || baseGapLength),
        );
        // Segment length remains free to overshoot the authorization target,
        // but a new claim must not reinterpret a locally long internode as a
        // reason to reverse the distal station trajectory.
        const targetGapLength = Math.min(
            trajectoryTarget,
            priorTarget * 1.04,
        );
        return Object.freeze({
            semantics: STATION_TRAJECTORY_SEMANTICS,
            ...(calibreScale < 1 ? { calibreScale: rounded(calibreScale) } : {}),
            stationIndex,
            baseGapLength: rounded(baseGapLength),
            referenceLength: rounded(referenceLength),
            compression: rounded(compression),
            asymptoteRatio: rounded(asymptoteRatio),
            rate: rounded(rate),
            power: rounded(power),
            trajectoryRatio: rounded(trajectoryRatio),
            localPhase: rounded(localPhase),
            phaseScale: rounded(phaseScale),
            priorTarget: rounded(priorTarget),
            maximumLocalExpansionRatio: 1.04,
            targetGapLength: rounded(targetGapLength),
            realizedGapFeedback: 0,
            architectureProfile,
        });
    }

    /**
     * Give structural forks and live laterals one station frame. The existing
     * route-specific direction remains a proposal and is blended with the
     * shared frame, so spatial feasibility and variety survive. Balance and a
     * center-directed continuation are probabilities, never a forced spine.
     */
    function resolveTierZeroStructuralStation(context, frontier, spec = {}) {
        const parentHeading = normalize(spec.parentHeading || frontier.heading);
        const scaffoldProposal = normalize(spec.scaffoldDirection);
        const continuationProposal = spec.continuationDirection
            ? normalize(spec.continuationDirection)
            : null;
        const origin = spec.origin || { x: 0, y: 0, z: 0 };
        const side = Math.sign(Number(spec.side || 0))
            || Math.sign(signedPlanarAngle(parentHeading, scaffoldProposal))
            || 1;
        const stationOrdinal = Number(
            spec.stationOrdinal
                ?? frontier.meristemCadence?.eventCount
                ?? 0,
        );
        const phase = phaseFor(frontier, stationOrdinal, 6.13);
        const targetDeflection = clamp(
            0.58 + phase * 0.22
                + (Number(context.phenotype.releaseAngle || 1) - 1) * 0.08,
            0.48,
            0.88,
        );
        const planarStation = rotateGrowthPlane(
            parentHeading,
            side * targetDeflection,
        );
        const parentElevation = directionElevation(parentHeading);
        const targetElevation = clamp(
            parentElevation * 0.3 + 0.19 + (phase - 0.5) * 0.1,
            0.04,
            0.52,
        );
        const gravityStation = directionFromAzimuthElevation(
            directionAzimuth(planarStation),
            targetElevation,
        );
        const sharedStationDirection = mixDirection(
            planarStation,
            gravityStation,
            0.3,
        );
        const scaffoldBlend = clamp(0.58 + phase * 0.12, 0.58, 0.7);
        const scaffoldDirection = mixDirection(
            scaffoldProposal,
            sharedStationDirection,
            scaffoldBlend,
        );

        const balanceField = spec.balanceField || {};
        const radial = Math.hypot(Number(origin.x || 0), Number(origin.z || 0));
        const centerDirection = radial > 1e-6
            ? normalize({
                x: -Number(origin.x || 0),
                y: Math.max(20, radial * 0.72),
                z: -Number(origin.z || 0),
            })
            : parentHeading;
        const pressureDirection = normalize({
            x: Number(balanceField.pressureX || 0) * 4.2,
            y: 1,
            z: Number(balanceField.pressureZ || 0) * 4.2,
        });
        const centerPressure = clamp(radial / 260, 0, 1);
        const balanceAgreement = Math.sign(Number(balanceField.pressureX || 0))
            === Math.sign(-Number(origin.x || 0));
        const centerAffinity = clamp(
            0.08
                + centerPressure * 0.12
                + (balanceAgreement ? 0.06 : 0)
                + (phase - 0.5) * 0.06,
            0.04,
            0.25,
        );
        const balanceTarget = mixDirection(centerDirection, pressureDirection, 0.42);
        let continuationDirection = continuationProposal;
        let returnTurnRadians = 0;
        if (continuationProposal) {
            const architectureProfile = resolveCrownArchitectureProfile(
                context,
                frontier,
                origin,
            );
            const returnPotential = smoothstep(
                architectureProfile.successionReturn / 1.5 * 0.72
                    + phase * 0.28,
            );
            returnTurnRadians = -side * clamp(
                (targetDeflection - 0.5) * returnPotential * 0.42,
                0,
                0.18,
            );
            continuationDirection = rotateGrowthPlane(
                continuationProposal,
                returnTurnRadians,
            );
            continuationDirection = mixDirection(
                continuationDirection,
                balanceTarget,
                centerAffinity,
            );
        }
        return Object.freeze({
            semantics: STRUCTURAL_STATION_SEMANTICS,
            routeKind: String(spec.routeKind || 'unknown'),
            parentTier: tierFor(frontier.axisOrder ?? frontier.tier),
            stationOrdinal,
            side,
            phase: rounded(phase),
            targetDeflectionRadians: rounded(targetDeflection),
            targetElevationRadians: rounded(targetElevation),
            scaffoldBlend: rounded(scaffoldBlend),
            scaffoldDirection: Object.freeze({ ...scaffoldDirection }),
            continuationDirection: continuationDirection
                ? Object.freeze({ ...continuationDirection })
                : null,
            centerAffinity: rounded(centerAffinity),
            centerPressure: rounded(centerPressure),
            balanceAgreement,
            returnTurnRadians: rounded(returnTurnRadians),
            flowAndBalanceAreProbabilistic: true,
            routeOwnsMutationOnly: true,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture = Object.freeze({
        TIER_ARCHITECTURE_SEMANTICS,
        STRUCTURAL_STATION_SEMANTICS,
        STATION_TRAJECTORY_SEMANTICS,
        RELATIVE_DIFFERENTIATION_SEMANTICS,
        TIER_ROLES,
        tierFor,
        tierRoleFor,
        resolveChildTierRoles,
        resolveRelativeDifferentiationPotential,
        resolveScaffoldStationTrajectory,
        resolveTierZeroStructuralStation,
    });
}(zenPlumeKernelRealm));
