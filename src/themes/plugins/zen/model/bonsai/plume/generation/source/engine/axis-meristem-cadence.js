import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import { zenG15AxisForkGap } from './ZenBonsaiG15AxisDevelopment.js';
/**
 * G15.4 inherited visible-scaffold release cadence owner.
 *
 * A fork and a live lateral remain different graph mutations. They consume the
 * same permission only when they actually create an order-one scaffold on an
 * order-zero family. The route-neutral permission owns physical arc, target,
 * and intrinsic threshold. Lateral opportunity/construction and fork
 * reiteration/resources remain route-specific feasibility concerns.
 *
 * A co-retained order-zero succession does not spend that permission. Its one
 * accumulated release claim, including threshold and visible-release
 * provenance, follows one carrier while junction-local side pressure may still
 * respond to the newly created sibling. This owner cannot create a child,
 * change resource shares, or select a direction.
 */
(function installTypedAxisMeristemCadence(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const ontogenyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    const tierArchitectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    if (
        !programs
        || !ontogenyOwner
        || !architectureOwner
        || !tierArchitectureOwner
    ) {
        throw new Error(
            '[G15.4_MERISTEM_CADENCE] developmental programs, ontogeny, crown architecture, and tier architecture owners must load first.',
        );
    }

    const { clamp, signedPlanarAngle, rounded } = programs;
    const {
        ONTOGENY_SEMANTICS,
        createRootOntogeny,
        createInactiveOntogeny,
        advanceRootOntogeny,
        commitCrownFormation,
        resolveJuvenileShootOpportunity,
        commitJuvenileShoot,
        resolveCrownBaseCompetence,
    } = ontogenyOwner;
    const { resolveCrownArchitectureProfile } = architectureOwner;
    const { resolveScaffoldStationTrajectory } = tierArchitectureOwner;

    const MERISTEM_CADENCE_SEMANTICS =
        'conserved_visible_scaffold_release_cadence_v9';
    const VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS =
        'route_neutral_visible_scaffold_release_permission_v2';
    const VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS =
        'continuous_visible_scaffold_liveness_pressure_v1';
    const LIVE_LATERAL_FEASIBILITY_SEMANTICS =
        'live_lateral_release_feasibility_v3';
    const LIVENESS_SATURATION_EXCESS = 0.75;

    function deterministicPhase(frontier, sequence, salt = 0) {
        const temperament = frontier?.temperament || {};
        return (
            Math.sin(
                Number(temperament.developmentalPhase || 0) * 3.17
                    + Number(temperament.resourceBias || 0.5) * 2.31
                    + Number(temperament.clusterSlot || 0) * 1.73
                    + Number(sequence || 0) * 0.619
                    + salt,
            ) + 1
        ) * 0.5;
    }

    function stochasticRound(expectation, sample) {
        const lower = Math.floor(expectation);
        return lower + (sample < expectation - lower ? 1 : 0);
    }

    function validCadence(value) {
        return value?.semantics === MERISTEM_CADENCE_SEMANTICS;
    }

    function claimKey(spec = {}, ordinal = 0) {
        const familyId = String(
            spec.axisFamilyId
                || spec.lineageId
                || spec.parentLineageId
                || 'root-axis-family',
        );
        return `visible-claim:${familyId}:${Number(spec.sequence || 0)}:${ordinal}`;
    }

    function resolveTargetGap(spec = {}) {
        const referenceLength = Math.max(
            8,
            Number(spec.referenceLength || spec.birthLength || 32),
        );
        const lateralInvestmentScale = clamp(
            Number(spec.lateralInvestmentScale ?? 1),
            0.58,
            1.62,
        );
        const lateralTimingBias = clamp(
            Number(spec.lateralTimingBias || 0),
            -0.5,
            0.5,
        );
        const phase = deterministicPhase(spec, spec.sequence, 1.41);
        const gapInternodes = clamp(
            2.15
                + phase * 1.3
                - (lateralInvestmentScale - 1) * 0.52
                + lateralTimingBias * 0.42,
            1.75,
            4.05,
        );
        return Object.freeze({
            targetGapLength: rounded(referenceLength * gapInternodes),
            targetGapInternodes: rounded(gapInternodes),
            targetGapPhase: rounded(phase),
            referenceLength: rounded(referenceLength),
        });
    }

    function resolveThreshold(frontier, sequence) {
        return rounded(clamp(
            0.9 + deterministicPhase(frontier, sequence, 4.27) * 0.18,
            0.9,
            1.08,
        ));
    }

    function resolveVisibleScaffoldLivenessPressure(authorizationRatio = 0) {
        const numericRatio = Number(authorizationRatio);
        const resolvedAuthorizationRatio = Number.isFinite(numericRatio)
            ? Math.max(0, numericRatio)
            : 0;
        const authorizationExcess = Math.max(
            0,
            resolvedAuthorizationRatio - 1,
        );
        const normalizedExcess = clamp(
            authorizationExcess / LIVENESS_SATURATION_EXCESS,
            0,
            1,
        );
        // Smoothstep supplies a continuous, bounded scheduling observation. It
        // cannot make a claim eligible, allocate construction, or choose which
        // scaffold-producing transaction spends the claim.
        const pressure = normalizedExcess * normalizedExcess
            * (3 - 2 * normalizedExcess);
        return Object.freeze({
            semantics: VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
            authorizationRatio: rounded(resolvedAuthorizationRatio),
            authorizationExcess: rounded(authorizationExcess),
            normalizedExcess: rounded(normalizedExcess),
            saturationExcess: LIVENESS_SATURATION_EXCESS,
            pressure: rounded(clamp(pressure, 0, 1)),
        });
    }

    function createRootCadence(spec = {}) {
        const target = resolveTargetGap(spec);
        const claimOrdinal = 0;
        const ontogeny = spec.ontogeny?.semantics === ONTOGENY_SEMANTICS
            ? spec.ontogeny
            : (spec.root === true
                ? createRootOntogeny(spec)
                : createInactiveOntogeny(spec));
        return Object.freeze({
            semantics: MERISTEM_CADENCE_SEMANTICS,
            claimId: String(spec.claimId || claimKey(spec, claimOrdinal)),
            priorClaimId: null,
            claimOrdinal,
            claimOriginSequence: Number(spec.sequence || 0),
            lastEventKind: null,
            lastEventSequence: null,
            lastVisibleReleaseKind: null,
            lastVisibleReleaseSequence: null,
            lastJunctionKind: 'root_axis_family_origin',
            lastJunctionSequence: Number(spec.sequence || 0),
            arcSinceRelease: 0,
            targetGapLength: target.targetGapLength,
            targetGapInternodes: target.targetGapInternodes,
            targetGapPhase: target.targetGapPhase,
            referenceLength: target.referenceLength,
            releaseThreshold: resolveThreshold(spec, spec.sequence),
            occupiedSide: 0,
            investment: 0,
            strength: 0,
            clearanceLength: target.targetGapLength,
            sourceSegmentLength: target.referenceLength,
            sourceRadius: rounded(Number(spec.sourceRadius || 0)),
            lastRealizedGapLength: null,
            expectedForkGapInternodes: null,
            desiredForkGapInternodes: 0,
            timingSample: null,
            eventCount: 0,
            inheritanceRole: 'root_visible_release_history',
            releaseCommittedAtBirth: false,
            stationArchitectureProfile: null,
            stationBaseGapLength: target.targetGapLength,
            stationIndex: 0,
            stationTrajectory: null,
            ontogeny,
        });
    }

    function advanceMeristemCadence(cadence, distance) {
        if (!validCadence(cadence)) return cadence || null;
        return Object.freeze({
            ...cadence,
            arcSinceRelease: rounded(
                Math.max(0, Number(cadence.arcSinceRelease || 0))
                    + Math.max(0, Number(distance || 0)),
            ),
            ontogeny: advanceRootOntogeny(cadence.ontogeny, distance),
        });
    }

    function resolveMeristemCadenceInfluence(frontier) {
        const cadence = frontier?.meristemCadence || null;
        if (!validCadence(cadence)) {
            return Object.freeze({
                semantics: MERISTEM_CADENCE_SEMANTICS,
                active: false,
                lastEventKind: null,
                occupiedSide: 0,
                axisDistance: null,
                clearanceLength: null,
                pressure: 0,
                investment: 0,
                releaseReadiness: 0,
            });
        }
        const axisDistance = Math.max(0, Number(cadence.arcSinceRelease || 0));
        const clearanceLength = Math.max(
            1,
            Number(cadence.clearanceLength || cadence.targetGapLength || 1),
        );
        const pressure = clamp(
            Number(cadence.strength || 0)
                * Math.exp(-axisDistance / clearanceLength),
            0,
            1,
        );
        const targetGapLength = Math.max(
            1,
            Number(cadence.targetGapLength || clearanceLength),
        );
        return Object.freeze({
            semantics: MERISTEM_CADENCE_SEMANTICS,
            active: pressure >= 0.015,
            lastEventKind: cadence.lastEventKind,
            lastEventSequence: cadence.lastEventSequence,
            occupiedSide: Math.sign(Number(cadence.occupiedSide || 0)),
            axisDistance: rounded(axisDistance),
            arcSinceRelease: rounded(axisDistance),
            targetGapLength: rounded(targetGapLength),
            targetGapInternodes: cadence.targetGapInternodes,
            releaseThreshold: cadence.releaseThreshold,
            releaseReadiness: rounded(axisDistance / targetGapLength),
            clearanceLength: rounded(clearanceLength),
            pressure: rounded(pressure),
            investment: rounded(clamp(Number(cadence.investment || 0), 0, 1)),
            eventCount: Number(cadence.eventCount || 0),
        });
    }

    function resolveVisibleScaffoldReleasePermission(frontier) {
        const cadence = frontier?.meristemCadence;
        const crownBaseCompetence = resolveCrownBaseCompetence(frontier);
        if (Number(frontier?.axisOrder ?? frontier?.tier ?? 1) !== 0) {
            return Object.freeze({
                semantics: VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
                cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
                eligible: false,
                reason: 'non_order_zero_axis',
                claimId: cadence?.claimId ?? null,
                crownBaseCompetence,
                visibleScaffoldLiveness:
                    resolveVisibleScaffoldLivenessPressure(0),
            });
        }
        if (!validCadence(cadence)) {
            return Object.freeze({
                semantics: VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
                cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
                eligible: false,
                reason: 'missing_axis_family_history',
                claimId: null,
                crownBaseCompetence,
                visibleScaffoldLiveness:
                    resolveVisibleScaffoldLivenessPressure(0),
            });
        }
        const arcSinceRelease = Math.max(0, Number(cadence.arcSinceRelease || 0));
        const targetGapLength = Math.max(1, Number(cadence.targetGapLength || 1));
        const releaseRatio = arcSinceRelease / targetGapLength;
        const releaseThreshold = clamp(
            Number(cadence.releaseThreshold || 0.92),
            0.7,
            1.34,
        );
        const authorizationLength = targetGapLength * releaseThreshold;
        const authorizationRatio = arcSinceRelease / authorizationLength;
        const cadenceEligible = releaseRatio >= releaseThreshold;
        const eligible = cadenceEligible && crownBaseCompetence.eligible;
        const visibleScaffoldLiveness =
            resolveVisibleScaffoldLivenessPressure(
                crownBaseCompetence.eligible ? authorizationRatio : 0,
            );
        return Object.freeze({
            semantics: VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
            cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
            phase: 'pre_mutation',
            eligible,
            decision: eligible ? 'granted' : 'deferred',
            reason: eligible
                ? 'inherited_arc_permission_granted'
                : (crownBaseCompetence.eligible
                    ? 'release_threshold_not_reached'
                    : 'juvenile_crown_base_not_established'),
            claimId: cadence.claimId,
            claimOrdinal: Number(cadence.claimOrdinal || 0),
            arcSinceRelease: rounded(arcSinceRelease),
            targetGapLength: rounded(targetGapLength),
            releaseRatio: rounded(releaseRatio),
            releaseThreshold: rounded(releaseThreshold),
            authorizationLength: rounded(authorizationLength),
            authorizationRatio: rounded(authorizationRatio),
            distanceToAuthorization: rounded(Math.max(
                0,
                authorizationLength - arcSinceRelease,
            )),
            overshootLength: rounded(Math.max(
                0,
                arcSinceRelease - authorizationLength,
            )),
            readiness: rounded(clamp((releaseRatio - 0.28) / 0.92, 0, 1.35)),
            cadenceEligible,
            crownBaseCompetence,
            visibleScaffoldLiveness,
            lastVisibleReleaseKind: cadence.lastVisibleReleaseKind,
            lastVisibleReleaseSequence: cadence.lastVisibleReleaseSequence,
            lastJunctionKind: cadence.lastJunctionKind,
            lastJunctionSequence: cadence.lastJunctionSequence,
        });
    }

    function resolveLiveLateralReleaseFeasibility(frontier, portfolio = null) {
        const cadence = frontier?.meristemCadence;
        const constructionPortfolio = portfolio || frontier?.constructionPortfolio || {};
        const permission = resolveVisibleScaffoldReleasePermission(frontier);
        if (permission.reason === 'non_order_zero_axis') {
            return Object.freeze({
                semantics: LIVE_LATERAL_FEASIBILITY_SEMANTICS,
                cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
                eligible: false,
                reason: permission.reason,
                visibleScaffoldLiveness:
                    permission.visibleScaffoldLiveness,
                visibleScaffoldPermission: permission,
            });
        }
        if (permission.reason === 'missing_axis_family_history') {
            return Object.freeze({
                semantics: LIVE_LATERAL_FEASIBILITY_SEMANTICS,
                cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
                eligible: false,
                reason: permission.reason,
                visibleScaffoldLiveness:
                    permission.visibleScaffoldLiveness,
                visibleScaffoldPermission: permission,
            });
        }
        const arcSinceRelease = permission.arcSinceRelease;
        const targetGapLength = permission.targetGapLength;
        const releaseRatio = permission.releaseRatio;
        const opportunityPotential = clamp(
            Number(constructionPortfolio.lateralOpportunityPotential || 0),
            0,
            2.45,
        );
        const constructionBudget = Math.max(
            0,
            Number(constructionPortfolio.lateralConstructionBudget || 0),
        );
        const constructionCoverage = clamp(constructionBudget / 0.055, 0, 1);
        const threshold = clamp(
            Number(permission.releaseThreshold || 0.92)
                + Math.max(0, 0.58 - opportunityPotential) * 0.22,
            0.7,
            1.34,
        );
        const readiness = clamp((releaseRatio - 0.28) / 0.92, 0, 1.35);
        const eligible = permission.eligible
            && releaseRatio >= threshold
            && opportunityPotential > 0.08
            && constructionCoverage >= 0.999;
        return Object.freeze({
            semantics: LIVE_LATERAL_FEASIBILITY_SEMANTICS,
            cadenceSemantics: MERISTEM_CADENCE_SEMANTICS,
            eligible,
            reason: eligible
                ? 'inherited_arc_readiness_reached'
                : (!permission.crownBaseCompetence?.eligible
                    ? 'juvenile_crown_base_not_established'
                    : (constructionCoverage < 0.999
                    ? 'insufficient_lateral_construction'
                    : (opportunityPotential <= 0.08
                        ? 'insufficient_lateral_opportunity'
                        : 'release_threshold_not_reached'))),
            arcSinceRelease: rounded(arcSinceRelease),
            targetGapLength: rounded(targetGapLength),
            releaseRatio: rounded(releaseRatio),
            releaseThreshold: rounded(threshold),
            intrinsicReleaseThreshold: permission.releaseThreshold,
            authorizationLength: rounded(targetGapLength * threshold),
            intrinsicAuthorizationLength: permission.authorizationLength,
            overshootLength: rounded(Math.max(
                0,
                arcSinceRelease - targetGapLength * threshold,
            )),
            readiness: rounded(readiness),
            opportunityPotential: rounded(opportunityPotential),
            constructionBudget: rounded(constructionBudget),
            constructionCoverage: rounded(constructionCoverage),
            visibleScaffoldLiveness: permission.visibleScaffoldLiveness,
            crownBaseCompetence: permission.crownBaseCompetence,
            lastEventKind: cadence.lastEventKind,
            lastEventSequence: cadence.lastEventSequence,
            claimId: cadence.claimId,
            visibleScaffoldPermission: permission,
        });
    }

    function nextGapTarget(context, frontier, cadence, realizedGap, sequence) {
        const current = Math.max(
            12,
            Number(cadence?.targetGapLength
                || Number(frontier.previousInternodeLength || 28) * 2.6),
        );
        const architectureProfile = resolveCrownArchitectureProfile(
            context,
            frontier,
        );
        const referenceLength = Math.max(
            8,
            Number(frontier.previousInternodeLength || cadence?.referenceLength || 24),
        );
        const stationIndex = Number(cadence?.stationIndex || 0) + 1;
        const trajectory = resolveScaffoldStationTrajectory(
            context,
            frontier,
            {
                stationIndex,
                baseGapLength: cadence?.stationBaseGapLength || current,
                currentGapLength: current,
                referenceLength,
                architectureProfile,
            },
        );
        return Object.freeze({
            targetGapLength: trajectory.targetGapLength,
            stationBaseGapLength: trajectory.baseGapLength,
            stationIndex,
            stationTrajectory: trajectory,
            architectureProfile,
            realizedGapLength: rounded(realizedGap),
            realizedGapFeedback: 0,
        });
    }

    function commitLateralCadence(context, frontier, spec) {
        const cadence = validCadence(frontier.meristemCadence)
            ? frontier.meristemCadence
            : createRootCadence({
                ...frontier,
                sequence: spec.sequence,
                referenceLength: spec.sourceSegmentLength,
                sourceRadius: spec.sourceRadius,
            });
        const sourceSegmentLength = Math.max(
            1,
            Number(spec.sourceSegmentLength || frontier.previousInternodeLength || 1),
        );
        const investment = clamp(Number(spec.resourceShare || 0), 0.08, 0.48);
        const thickness = clamp(Number(spec.sourceRadius || frontier.radius || 0) / 18.5, 0, 1.4);
        const realizedGap = Math.max(0, Number(cadence.arcSinceRelease || 0));
        const nextGap = nextGapTarget(
            context,
            frontier,
            cadence,
            realizedGap,
            spec.sequence,
        );
        const targetGapLength = nextGap.targetGapLength;
        const strength = clamp(0.6 + investment * 0.72 + thickness * 0.06, 0.58, 0.94);
        const nextClaimOrdinal = Number(cadence.claimOrdinal || 0) + 1;
        const nextClaimId = claimKey({
            ...frontier,
            sequence: spec.sequence,
        }, nextClaimOrdinal);
        const expectedForkGap = clamp(
            targetGapLength / sourceSegmentLength * 0.72,
            1.2,
            3.2,
        );
        const timingSample = deterministicPhase(frontier, spec.sequence, 0.77);
        const desiredForkGapInternodes = clamp(
            stochasticRound(expectedForkGap, timingSample),
            1,
            3,
        );
        return Object.freeze({
            ...cadence,
            semantics: MERISTEM_CADENCE_SEMANTICS,
            claimId: nextClaimId,
            priorClaimId: cadence.claimId,
            claimOrdinal: nextClaimOrdinal,
            claimOriginSequence: Number(spec.sequence || 0),
            lastEventKind: 'live_lateral_emission',
            lastEventSequence: Number(spec.sequence || 0),
            lastVisibleReleaseKind: 'live_lateral_emission',
            lastVisibleReleaseSequence: Number(spec.sequence || 0),
            lastJunctionKind: 'live_lateral_emission',
            lastJunctionSequence: Number(spec.sequence || 0),
            arcSinceRelease: 0,
            targetGapLength,
            targetGapInternodes: rounded(targetGapLength / sourceSegmentLength),
            targetGapPhase: rounded(
                nextGap.stationTrajectory?.localPhase
                    ?? deterministicPhase(frontier, spec.sequence, 2.63),
            ),
            referenceLength: rounded(sourceSegmentLength),
            releaseThreshold: resolveThreshold(frontier, spec.sequence),
            occupiedSide: Math.sign(Number(spec.side || 0)),
            investment: rounded(investment),
            strength: rounded(strength),
            clearanceLength: targetGapLength,
            sourceSegmentLength: rounded(sourceSegmentLength),
            sourceRadius: rounded(Number(spec.sourceRadius || frontier.radius || 0)),
            lastRealizedGapLength: rounded(realizedGap),
            expectedForkGapInternodes: rounded(expectedForkGap),
            desiredForkGapInternodes,
            timingSample: rounded(timingSample),
            eventCount: Number(cadence.eventCount || 0) + 1,
            inheritanceRole: 'live_lateral_visible_release_commit',
            releaseCommittedAtBirth: true,
            stationArchitectureProfile: nextGap,
            stationBaseGapLength: nextGap.stationBaseGapLength,
            stationIndex: nextGap.stationIndex,
            stationTrajectory: nextGap.stationTrajectory,
            ontogeny: commitCrownFormation(cadence.ontogeny, {
                sequence: spec.sequence,
                kind: 'live_lateral_emission',
            }),
        });
    }

    function commitJuvenileShootCadence(frontier, spec = {}) {
        const cadence = validCadence(frontier.meristemCadence)
            ? frontier.meristemCadence
            : createRootCadence({
                ...frontier,
                sequence: spec.sequence,
                referenceLength: spec.sourceSegmentLength,
                sourceRadius: spec.sourceRadius,
            });
        const investment = clamp(Number(spec.resourceShare || 0), 0.04, 0.32);
        const thickness = clamp(
            Number(spec.sourceRadius || frontier.radius || 0) / 18.5,
            0,
            1.4,
        );
        return Object.freeze({
            ...cadence,
            semantics: MERISTEM_CADENCE_SEMANTICS,
            lastEventKind: 'juvenile_sacrifice_axis_emission',
            lastEventSequence: Number(spec.sequence || 0),
            lastJunctionKind: 'juvenile_sacrifice_axis_emission',
            lastJunctionSequence: Number(spec.sequence || 0),
            occupiedSide: Math.sign(Number(spec.side || 0)),
            investment: rounded(investment),
            strength: rounded(clamp(
                0.32 + investment * 0.54 + thickness * 0.04,
                0.32,
                0.62,
            )),
            sourceSegmentLength: rounded(Math.max(
                1,
                Number(spec.sourceSegmentLength
                    || frontier.previousInternodeLength
                    || 1),
            )),
            sourceRadius: rounded(Number(
                spec.sourceRadius || frontier.radius || 0,
            )),
            inheritanceRole:
                'temporary_juvenile_axis_without_visible_claim_spend',
            releaseCommittedAtBirth: false,
            ontogeny: commitJuvenileShoot(cadence.ontogeny, {
                sequence: spec.sequence,
                lineageId: spec.lineageId,
            }),
        });
    }

    function createJunctionCadence(context, spec) {
        const childHeading = spec.childHeading;
        const siblingHeading = spec.siblingHeading;
        const occupiedSide = Math.sign(Number(spec.occupiedSide || 0))
            || (childHeading && siblingHeading
                ? Math.sign(signedPlanarAngle(childHeading, siblingHeading))
                : 0);
        const birthLength = Math.max(1, Number(spec.birthLength || 1));
        const siblingInvestment = clamp(Number(spec.siblingShare || 0.5), 0.08, 0.92);
        const thickness = clamp(Number(spec.sourceRadius || 0) / 18.5, 0, 1.4);
        const inherited = validCadence(spec.inheritedCadence)
            ? spec.inheritedCadence
            : createRootCadence({ ...spec, referenceLength: birthLength });
        const realizedGap = Math.max(0, Number(inherited.arcSinceRelease || 0));
        const inheritAxisFamily = Boolean(spec.inheritAxisFamily);
        const releaseCommitted = Boolean(spec.releaseCommitted);
        const crownFormationCommitted = Boolean(
            spec.crownFormationCommitted || releaseCommitted,
        );
        const carriesUnspentReleaseClaim = inheritAxisFamily && !releaseCommitted;
        const inheritedOntogeny = spec.inheritedOntogeny?.semantics
            === ONTOGENY_SEMANTICS
            ? spec.inheritedOntogeny
            : inherited.ontogeny;
        const junctionOntogeny = crownFormationCommitted
            ? commitCrownFormation(inheritedOntogeny, {
                sequence: spec.sequence,
                kind: spec.kind,
            })
            : (carriesUnspentReleaseClaim
                ? advanceRootOntogeny(inheritedOntogeny, birthLength)
                : inheritedOntogeny);
        const nextGap = inheritAxisFamily && releaseCommitted
            ? nextGapTarget(context, spec, inherited, realizedGap, spec.sequence)
            : null;
        const targetGapLength = nextGap
            ? nextGap.targetGapLength
            : (carriesUnspentReleaseClaim
                ? Number(inherited.targetGapLength || birthLength * 2.6)
                : resolveTargetGap({ ...spec, referenceLength: birthLength }).targetGapLength);
        const arcSinceRelease = carriesUnspentReleaseClaim
            ? realizedGap + birthLength
            : birthLength;
        const eventCount = inheritAxisFamily
            ? Number(inherited.eventCount || 0) + (releaseCommitted ? 1 : 0)
            : 0;
        const nextClaimOrdinal = inheritAxisFamily && releaseCommitted
            ? Number(inherited.claimOrdinal || 0) + 1
            : (carriesUnspentReleaseClaim
                ? Number(inherited.claimOrdinal || 0)
                : 0);
        const nextClaimId = carriesUnspentReleaseClaim
            ? inherited.claimId
            : claimKey(spec, nextClaimOrdinal);
        const junctionKind = spec.kind || 'junction_birth';
        const visibleReleaseKind = releaseCommitted
            ? junctionKind
            : inherited.lastVisibleReleaseKind;
        const visibleReleaseSequence = releaseCommitted
            ? Number(spec.sequence || 0)
            : inherited.lastVisibleReleaseSequence;
        return Object.freeze({
            ...inherited,
            semantics: MERISTEM_CADENCE_SEMANTICS,
            claimId: nextClaimId,
            priorClaimId: carriesUnspentReleaseClaim
                ? inherited.priorClaimId
                : (inheritAxisFamily && releaseCommitted
                    ? inherited.claimId
                    : null),
            claimOrdinal: nextClaimOrdinal,
            claimOriginSequence: carriesUnspentReleaseClaim
                ? inherited.claimOriginSequence
                : Number(spec.sequence || 0),
            lastEventKind: carriesUnspentReleaseClaim
                ? inherited.lastEventKind
                : junctionKind,
            lastEventSequence: carriesUnspentReleaseClaim
                ? inherited.lastEventSequence
                : Number(spec.sequence || 0),
            lastVisibleReleaseKind: visibleReleaseKind,
            lastVisibleReleaseSequence: visibleReleaseSequence,
            lastJunctionKind: junctionKind,
            lastJunctionSequence: Number(spec.sequence || 0),
            arcSinceRelease: rounded(arcSinceRelease),
            targetGapLength: rounded(targetGapLength),
            targetGapInternodes: rounded(targetGapLength / birthLength),
            targetGapPhase: carriesUnspentReleaseClaim
                ? inherited.targetGapPhase
                : rounded(
                    nextGap?.stationTrajectory?.localPhase
                        ?? deterministicPhase(spec, spec.sequence, 2.63),
                ),
            referenceLength: rounded(birthLength),
            releaseThreshold: carriesUnspentReleaseClaim
                ? inherited.releaseThreshold
                : resolveThreshold(spec, spec.sequence),
            occupiedSide,
            investment: rounded(siblingInvestment),
            strength: rounded(clamp(
                0.48 + siblingInvestment * 0.42 + thickness * 0.05,
                0.5,
                0.9,
            )),
            clearanceLength: rounded(targetGapLength),
            sourceSegmentLength: rounded(birthLength),
            sourceRadius: rounded(Number(spec.sourceRadius || 0)),
            lastRealizedGapLength: carriesUnspentReleaseClaim
                ? inherited.lastRealizedGapLength
                : rounded(realizedGap),
            expectedForkGapInternodes: null,
            desiredForkGapInternodes: 0,
            timingSample: null,
            eventCount,
            inheritanceRole: spec.inheritanceRole || (
                carriesUnspentReleaseClaim
                    ? 'carried_unspent_visible_release_claim'
                    : (releaseCommitted
                        ? 'visible_release_commit'
                        : 'new_axis_family_phase')
            ),
            releaseCommittedAtBirth: releaseCommitted,
            stationArchitectureProfile: carriesUnspentReleaseClaim
                ? inherited.stationArchitectureProfile
                : nextGap,
            stationBaseGapLength: carriesUnspentReleaseClaim
                ? inherited.stationBaseGapLength
                : (nextGap?.stationBaseGapLength || targetGapLength),
            stationIndex: carriesUnspentReleaseClaim
                ? Number(inherited.stationIndex || 0)
                : (nextGap?.stationIndex || 0),
            stationTrajectory: carriesUnspentReleaseClaim
                ? inherited.stationTrajectory
                : (nextGap?.stationTrajectory || null),
            ontogeny: junctionOntogeny,
        });
    }

    function resolveNextForkCadence(frontier, cadence, constructionPortfolio) {
        const nextAxisAge = Number(frontier.axisAge || 0) + 1;
        if (!validCadence(cadence) || cadence.lastEventKind !== 'live_lateral_emission') {
            return Object.freeze({
                semantics: MERISTEM_CADENCE_SEMANTICS,
                active: false,
                nextForkAge: frontier.nextForkAge,
                desiredGapInternodes: 0,
                availableGapInternodes: 0,
                appliedGapInternodes: 0,
            });
        }
        const portfolio = constructionPortfolio || frontier.constructionPortfolio || {};
        const availableGapInternodes = Math.max(
            1,
            Number(portfolio.plannedInternodeCount || 0)
                - Number(portfolio.cursor || 0),
        );
        const desiredGapInternodes = clamp(
            Number(cadence.desiredForkGapInternodes || 1),
            1,
            3,
        );
        // The lateral release has already changed the developmental history.
        // Preserve its sampled interval even when the current local portfolio
        // ends sooner. The ordinary renewal owner may fund the remainder; an
        // axis without supply terminates instead of receiving a free spacer.
        const appliedGapInternodes = zenG15AxisForkGap(
            portfolio, frontier.previousInternodeLength, desiredGapInternodes,
        );
        return Object.freeze({
            semantics: MERISTEM_CADENCE_SEMANTICS,
            active: true,
            nextForkAge: nextAxisAge + appliedGapInternodes,
            desiredGapInternodes,
            availableGapInternodes,
            appliedGapInternodes,
            requiresPortfolioRenewal:
                appliedGapInternodes > availableGapInternodes,
            expectedGapInternodes: cadence.expectedForkGapInternodes,
            timingSample: cadence.timingSample,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence = Object.freeze({
        MERISTEM_CADENCE_SEMANTICS,
        VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
        VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
        LIVE_LATERAL_FEASIBILITY_SEMANTICS,
        ONTOGENY_SEMANTICS,
        createRootCadence,
        advanceMeristemCadence,
        resolveMeristemCadenceInfluence,
        resolveVisibleScaffoldReleasePermission,
        resolveCrownBaseCompetence,
        resolveVisibleScaffoldLivenessPressure,
        resolveLiveLateralReleaseFeasibility,
        resolveJuvenileShootOpportunity,
        commitLateralCadence,
        commitJuvenileShootCadence,
        createJunctionCadence,
        resolveNextForkCadence,
    });
}(zenPlumeKernelRealm));
