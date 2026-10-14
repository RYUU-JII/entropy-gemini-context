import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {factorGraphSupport} from "../research/factor-growth-4/ZenG15ReleaseGrowth.js";
import {validJointFrameReceipt} from "../research/joint-frame/ZenG15FlowJointFrame.js";
import {validZenG15ForkFlowPlan,ZEN_G15_JOINT_FLOW,ZEN_G15_SEPARATE_FLOW} from './ZenBonsaiG15ForkAllocation.js';
/**
 * G15.4 graph inspection owner.
 *
 * Validation rejects graph/ledger/referential corruption and explicit active
 * contract violations only. Morphology ranges remain diagnostics: a plausible
 * new direction or cohort distribution must not become an invalid graph merely
 * because it crosses an earlier visual hypothesis. This owner never repairs or
 * participates in growth.
 */
import { validZenG15AxisDevelopment } from './ZenBonsaiG15AxisDevelopment.js';
(function installTypedDevelopmentalGraphInspector(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    const architectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownArchitecture;
    const tierArchitectureOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerTierArchitecture;
    const compositionOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerCrownComposition;
    const growthUnitOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerGrowthUnit;
    const axisStateOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState;
    const meristemCadenceOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerMeristemCadence;
    const ontogenyOwner = scope.ZenBonsaiTypedDevelopmentalSchedulerOntogeny;
    const successionKinkOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerSuccessionKinkField;
    const lateralJunctionOwner = scope
        .ZenBonsaiTypedDevelopmentalSchedulerLateralJunction;
    if (
        !programs
        || !strategyOwner
        || !architectureOwner
        || !tierArchitectureOwner
        || !compositionOwner
        || !growthUnitOwner
        || !axisStateOwner
        || !meristemCadenceOwner
        || !ontogenyOwner
        || !successionKinkOwner
        || !lateralJunctionOwner
    ) {
        throw new Error(
            '[G15.4_INSPECTOR] programs, strategy, crown architecture, tier architecture, crown composition, growth-unit, axis-state, ontogeny, cadence, succession-kink, and lateral-junction owners must load first.',
        );
    }
    const {
        TIER_NAMES,
        AXIS_ORDER_NAMES,
        axisOrderNameFor,
        AXIS_ORDER_SEMANTICS,
        BIRTH_MODE_SEMANTICS,
        NODE_MERISTEM_SEMANTICS,
        LINEAGE_RESPONSE_SEMANTICS,
        TIERS,
        ANGLE_SEMANTICS,
        EPISODE_SEMANTICS,
        PHENOTYPE_SEMANTICS,
        OCCUPANCY_SEMANTICS,
        RESOURCE_ECONOMY_SEMANTICS,
        CLUSTER_SEMANTICS,
        BALANCE_SEMANTICS,
        AXIS_SUCCESSION_SEMANTICS,
        ORDER_ZERO_SUPPORT_SEMANTICS,
        COMPLETION_SEMANTICS,
        LATERAL_MERISTEM_SEMANTICS,
        CROWN_INTERIOR_EXPOSURE_SEMANTICS,
        SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
        SCHEDULER_SEMANTICS,
        AXIS_LIFECYCLE_SEMANTICS,
        FORK_POTENTIAL_SEMANTICS,
        PRESETS,
        angularDistance,
        clamp,
        dot,
        normalize,
        rounded,
        subtract,
        sum,
        resolveScaffoldFamilyDominance,
    } = programs;
    const { AXIS_DEVELOPMENT_STATE_SEMANTICS } = axisStateOwner;
    const {
        MERISTEM_CADENCE_SEMANTICS,
        VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS,
        VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
        LIVE_LATERAL_FEASIBILITY_SEMANTICS,
    } = meristemCadenceOwner;
    const { LATERAL_JUNCTION_SEMANTICS } = lateralJunctionOwner;
    const {
        CROWN_COMPOSITION_SEMANTICS,
        SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
        CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
        projectDirection,
    } = compositionOwner;
    const { SUCCESSION_KINK_STATE_SEMANTICS } = successionKinkOwner;
    const SUCCESSION_KINK_SEMANTICS = successionKinkOwner.semantics;
    const {
        ONTOGENY_SEMANTICS,
        CROWN_BASE_COMPETENCE_SEMANTICS,
        JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS,
        JUVENILE_AXIS_RETIREMENT_SEMANTICS,
    } = ontogenyOwner;
    const {
        STRATEGY_SEMANTICS,
        BASIS_SEMANTICS,
        STRATEGY_AXIS_IDS,
    } = strategyOwner;
    const {
        CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
        CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
        validArchitectureControls,
        validCrownArchitectureProfile,
        architectureProfileMatchesControls,
    } = architectureOwner;
    const {
        TIER_ARCHITECTURE_SEMANTICS,
        STRUCTURAL_STATION_SEMANTICS,
        STATION_TRAJECTORY_SEMANTICS,
        RELATIVE_DIFFERENTIATION_SEMANTICS,
        tierRoleFor,
    } = tierArchitectureOwner;
    const {
        GROWTH_UNIT_SEMANTICS,
        GROWTH_UNIT_RECEIPT_SEMANTICS,
        APICAL_DIFFERENTIATION_SEMANTICS,
        validGrowthUnit,
    } = growthUnitOwner;

    const FORK_IDENTITY_INTENT_SEMANTICS =
        'immutable_fork_identity_intent_v2';

    const nonEmptyString = (value) => (
        typeof value === 'string' && value.length > 0
    );
    const vectorValid = (vector) => vector
        && ['x', 'y', 'z'].every((key) => Number.isFinite(vector[key]));

    function validSuccessionKink(value, childCount) {
        if (
            value?.semantics !== SUCCESSION_KINK_SEMANTICS
            || value.stateSemantics !== SUCCESSION_KINK_STATE_SEMANTICS
            || value.dependencySemantics
                !== 'past_order_zero_history_and_live_fork_aperture_to_one_selected_child_direction_only'
            || !validCrownArchitectureProfile(value.architectureProfile)
            || !['enabled', 'eligible', 'activated', 'alternated'].every(
                (key) => typeof value[key] === 'boolean',
            )
            || ![
                'phase',
                'probability',
                'opportunity',
                'cooldown',
                'alternationPhase',
                'apertureRadians',
                'wideForkPressure',
                'counterTurnPhase',
                'requestedTurnRadians',
                'connectorLengthScale',
                'realizedTurnRadians',
                'realizedTurnDegrees',
            ].every((key) => Number.isFinite(value[key]))
            || value.phase < 0
            || value.phase > 1
            || value.probability < 0
            || value.probability > 0.56 + 1e-8
            || value.wideForkPressure < 0
            || value.wideForkPressure > 1
            || value.counterTurnPhase < 0
            || value.counterTurnPhase > 1
            || value.apertureRadians < 0
            || value.apertureRadians > Math.PI
            || value.connectorLengthScale < 0.69 - 1e-8
            || value.connectorLengthScale > 0.85 + 1e-8
        ) return false;
        const wideForkProgress = clamp(
            (value.apertureRadians - 0.78) / 0.72,
            0,
            1,
        );
        const expectedWideForkPressure = wideForkProgress * wideForkProgress
            * (3 - 2 * wideForkProgress);
        if (Math.abs(value.wideForkPressure - expectedWideForkPressure) > 2e-6) {
            return false;
        }
        if (!value.activated) {
            return value.application === null
                && value.realizedTurnRadians === 0
                && value.realizedTurnDegrees === 0;
        }
        const application = value.application;
        if (
            !value.eligible
            || !Number.isInteger(value.successorIndex)
            || value.successorIndex < 0
            || value.successorIndex >= childCount
            || !application
            || typeof application.counterTurnEligible !== 'boolean'
            || typeof application.counterTurnSelected !== 'boolean'
            || !Number.isFinite(application.originalTurnRadians)
            || !Number.isFinite(application.sampledTurnSign)
            || !Number.isFinite(application.appliedTurnSign)
            || !Number.isFinite(application.counterTurnProbability)
            || application.counterTurnProbability < 0
            || application.counterTurnProbability > 0.9 + 1e-8
        ) return false;
        if (
            application.counterTurnSelected
            && (
                !application.counterTurnEligible
                || Math.sign(application.originalTurnRadians)
                    * Math.sign(application.appliedTurnSign) !== -1
            )
        ) return false;
        return true;
    }

    function validStationArchitectureReceipt(value) {
        if (value === null) return true;
        const trajectory = value?.stationTrajectory;
        return Boolean(
            !value
                ? false
                : validCrownArchitectureProfile(value.architectureProfile)
                    && Number.isFinite(value.targetGapLength)
                    && value.targetGapLength > 0
                    && Number.isInteger(value.stationIndex)
                    && value.stationIndex >= 1
                    && Number.isFinite(value.stationBaseGapLength)
                    && value.stationBaseGapLength > 0
                    && value.realizedGapFeedback === 0
                    && trajectory?.semantics === STATION_TRAJECTORY_SEMANTICS
                    && trajectory.stationIndex === value.stationIndex
                    && trajectory.realizedGapFeedback === 0
                    && trajectory.maximumLocalExpansionRatio === 1.04
                    && trajectory.targetGapLength
                        <= trajectory.priorTarget * 1.04 + 2e-5
                    && Math.abs(
                        trajectory.targetGapLength - value.targetGapLength,
                    ) <= 2e-5,
        );
    }

    function validStructuralStation(value, routeKind) {
        if (!value) return false;
        return value.semantics === STRUCTURAL_STATION_SEMANTICS
            && value.routeKind === routeKind
            && value.parentTier === 0
            && Number.isInteger(value.stationOrdinal)
            && value.stationOrdinal >= 0
            && [-1, 1].includes(value.side)
            && Number.isFinite(value.targetDeflectionRadians)
            && value.targetDeflectionRadians >= 0.48
            && value.targetDeflectionRadians <= 0.88
            && Number.isFinite(value.targetElevationRadians)
            && Number.isFinite(value.centerAffinity)
            && value.centerAffinity >= 0.04
            && value.centerAffinity <= 0.25
            && Number.isFinite(value.returnTurnRadians)
            && vectorValid(value.scaffoldDirection)
            && vectorValid(value.continuationDirection)
            && value.flowAndBalanceAreProbabilistic === true
            && value.routeOwnsMutationOnly === true;
    }

    function validRelativeDifferentiation(value, axisOrder) {
        return value?.semantics === RELATIVE_DIFFERENTIATION_SEMANTICS
            && value.tier === axisOrder
            && value.role === tierRoleFor(axisOrder)
            && Number.isFinite(value.potential)
            && value.potential >= 0
            && value.potential <= 1
            && value.absoluteCapacityAuthority === false;
    }

    function validCrownInteriorExposure(value) {
        if (
            value?.semantics !== CROWN_INTERIOR_EXPOSURE_SEMANTICS
            || typeof value.applicable !== 'boolean'
            || !Number.isInteger(value.parentAxisOrder)
            || value.parentAxisOrder < 0
            || !Number.isFinite(value.referenceLength)
            || value.referenceLength < 0
            || !Number.isInteger(value.supportSampleCount)
            || value.supportSampleCount < 0
            || !Number.isFinite(value.normalizedVerticalExposure)
            || value.normalizedVerticalExposure < 0
            || value.normalizedVerticalExposure > 1
            || !Number.isFinite(value.normalizedHorizontalSeparation)
            || value.normalizedHorizontalSeparation < 0
            || value.normalizedHorizontalSeparation > 1
            || !Number.isFinite(value.pressure)
            || value.pressure < 0
            || value.pressure > 1
            || !validCrownArchitectureProfile(value.architectureProfile)
        ) return false;
        if (!value.applicable) {
            return value.pressure === 0
                && value.bridgeDirection === null
                && value.targetScaffoldLineageId === null;
        }
        if (
            value.parentAxisOrder !== 1
            || !nonEmptyString(value.sourceScaffoldLineageId)
            || !nonEmptyString(value.targetScaffoldLineageId)
            || value.sourceScaffoldLineageId === value.targetScaffoldLineageId
            || value.supportSampleCount < 1
            || !Number.isFinite(value.crownBaseHeight)
            || !Number.isFinite(value.verticalGap)
            || value.verticalGap <= 0
            || !Number.isFinite(value.horizontalGap)
            || value.horizontalGap <= 0
            || !Number.isFinite(value.threeDimensionalGap)
            || value.threeDimensionalGap <= 0
            || value.pressure <= 0
            || !value.bridgeDirection
            || !value.targetPoint
        ) return false;
        const direction = value.bridgeDirection;
        const target = value.targetPoint;
        if (
            !['x', 'y', 'z'].every((key) => Number.isFinite(direction[key]))
            || !['x', 'y', 'z'].every((key) => Number.isFinite(target[key]))
        ) return false;
        return Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1)
            <= 2e-5;
    }

    function validScaffoldFamilyGesture(value, axisOrder = null) {
        if (value === null || value === undefined) return axisOrder === 0;
        if (
            value.semantics !== SCAFFOLD_FAMILY_GESTURE_SEMANTICS
            || value.compositionSemantics !== CROWN_COMPOSITION_SEMANTICS
            || !nonEmptyString(value.gestureId)
            || !nonEmptyString(value.sourceLineageKey)
            || !nonEmptyString(value.carrierLineageKey)
            || !Number.isInteger(value.generation)
            || value.generation < 0
            || !['near', 'middle', 'far'].includes(value.depthLayer)
            || !Number.isFinite(value.desiredDepth)
            || Math.abs(value.desiredDepth) > 0.38 + 1e-8
            || !Number.isFinite(value.minimumProjectedPresence)
            || value.minimumProjectedPresence < 0.5
            || value.minimumProjectedPresence > 0.8
            || !Number.isFinite(value.angularBandwidth)
            || value.angularBandwidth <= 0
            || value.authority !== 'birth_frame_and_cluster_envelope_only'
        ) return false;
        return ['flowDirection', 'padAxis', 'viewDepth'].every((field) => (
            vectorValid(value[field])
            && Math.abs(Math.hypot(
                value[field].x,
                value[field].y,
                value[field].z,
            ) - 1) <= 2e-5
        ));
    }

    function validCrownBirthOpportunity(value, familyGesture = null) {
        if (!value) return false;
        if (
            value.semantics !== CROWN_BIRTH_OPPORTUNITY_SEMANTICS
            || value.compositionSemantics !== CROWN_COMPOSITION_SEMANTICS
            || !Number.isInteger(value.childAxisOrder)
            || value.childAxisOrder < 1
            || !Number.isFinite(value.interiorBlend)
            || value.interiorBlend < 0
            || value.interiorBlend > 0.14 + 1e-8
            || !['none', 'forward_vector_blend', 'screen_plane_side_turn']
                .includes(value.interiorMode)
            || !Number.isFinite(value.projectedSideTurnRadians)
            || Math.abs(value.projectedSideTurnRadians) > 0.095 + 1e-8
            || (value.interiorMode === 'none'
                && (value.interiorBlend !== 0
                    || value.projectedSideTurnRadians !== 0))
            || !Number.isFinite(value.depthAuthority)
            || value.depthAuthority < 0
            || value.depthAuthority > 0.5
            || !Number.isFinite(value.minimumProjectedPresence)
            || value.authority !== 'one_shot_birth_direction_only'
            || !vectorValid(value.directionBefore)
            || !vectorValid(value.directionAfter)
            || (familyGesture
                && value.familyGestureId !== familyGesture.gestureId)
        ) return false;
        const projected = projectDirection(value.directionAfter);
        return projected.projectedMagnitude + 2e-5
            >= value.minimumProjectedPresence;
    }

    function validScaffoldFamilyDominanceClaim(value) {
        if (value === null || value === undefined) return true;
        if (
            value.semantics !== SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS
            || !nonEmptyString(value.claimId)
            || !['live_lateral_emission', 'structural_fork']
                .includes(value.sourceKind)
            || !Number.isInteger(value.sourceSequence)
            || value.sourceSequence < 0
            || !nonEmptyString(value.sourceScaffoldLineageId)
            || !nonEmptyString(value.subordinateRootLineageId)
            || !nonEmptyString(value.carrierLineageId)
            || !nonEmptyString(value.sourceNodeId)
            || value.sourceAxisOrder !== 1
            || !Number.isInteger(value.childAxisOrder)
            || value.childAxisOrder <= value.sourceAxisOrder
            || !Number.isFinite(value.sourceAreaFraction)
            || value.sourceAreaFraction < 0.02
            || value.sourceAreaFraction > 0.49
            || !Number.isFinite(value.sourceResourceShare)
            || value.sourceResourceShare < 0.02
            || value.sourceResourceShare > 0.49
            || !Number.isFinite(value.sourceDeflectionRadians)
            || value.sourceDeflectionRadians < 0
            || value.sourceDeflectionRadians > Math.PI
            || !Number.isFinite(value.sourceForwardDot)
            || Math.abs(
                value.sourceForwardDot - Math.cos(value.sourceDeflectionRadians)
            ) > 2e-5
            || ![
                value.areaSubordination,
                value.resourceSubordination,
                value.deflectionSubordination,
                value.hierarchyStrength,
            ].every((entry) => Number.isFinite(entry) && entry >= 0 && entry <= 1)
            || !Number.isFinite(value.reiterationThresholdBoost)
            || value.reiterationThresholdBoost < 0.06
            || value.reiterationThresholdBoost > 0.25
            || !Number.isFinite(value.terminalLoadScale)
            || value.terminalLoadScale < 0.78
            || value.terminalLoadScale > 1
            || value.replacementState !== 'subordinate'
            || value.replacementCause !== null
            || value.explicitReplacementRequired !== true
            || !Number.isInteger(value.carriedThroughForkCount)
            || value.carriedThroughForkCount < 0
            || value.authority
                !== 'branching_and_terminal_load_modulation_only'
            || value.createsGeometry !== false
            || value.createsConstruction !== false
            || (value.inheritedFromClaimId === null
                && (
                    value.carrierLineageId !== value.subordinateRootLineageId
                    || value.carriedAtSequence !== null
                ))
            || (value.inheritedFromClaimId !== null
                && (
                    value.inheritedFromClaimId !== value.claimId
                    || !Number.isInteger(value.carriedAtSequence)
                    || value.carriedAtSequence < value.sourceSequence
                ))
        ) return false;
        const expectedAreaSubordination = clamp(
            (0.34 - value.sourceAreaFraction) / 0.24,
            0,
            1,
        );
        const expectedResourceSubordination = clamp(
            (0.42 - value.sourceResourceShare) / 0.28,
            0,
            1,
        );
        const expectedDeflectionSubordination = clamp(
            (value.sourceDeflectionRadians - 0.28) / 0.62,
            0,
            1,
        );
        const expectedHierarchyStrength = clamp(
            expectedAreaSubordination * 0.48
                + expectedResourceSubordination * 0.28
                + expectedDeflectionSubordination * 0.24,
            0,
            1,
        );
        const expectedThresholdBoost = clamp(
            0.06 + expectedHierarchyStrength * 0.19,
            0.06,
            0.25,
        );
        const expectedTerminalLoadScale = clamp(
            1 - expectedHierarchyStrength * 0.22,
            0.78,
            1,
        );
        return Math.abs(
            expectedAreaSubordination - value.areaSubordination
        ) <= 2e-5
            && Math.abs(
                expectedResourceSubordination - value.resourceSubordination
            ) <= 2e-5
            && Math.abs(
                expectedDeflectionSubordination - value.deflectionSubordination
            ) <= 2e-5
            && Math.abs(
                expectedHierarchyStrength - value.hierarchyStrength
            ) <= 2e-5
            && Math.abs(
                expectedThresholdBoost - value.reiterationThresholdBoost
            ) <= 2e-5
            && Math.abs(
                expectedTerminalLoadScale - value.terminalLoadScale
            ) <= 2e-5;
    }

    function validVisibleScaffoldLiveness(value) {
        if (
            value?.semantics !== VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS
            || !Number.isFinite(value.authorizationRatio)
            || value.authorizationRatio < 0
            || !Number.isFinite(value.authorizationExcess)
            || value.authorizationExcess < 0
            || !Number.isFinite(value.normalizedExcess)
            || value.normalizedExcess < 0
            || value.normalizedExcess > 1
            || value.saturationExcess !== 0.75
            || !Number.isFinite(value.pressure)
            || value.pressure < 0
            || value.pressure > 1
        ) return false;
        const expectedExcess = Math.max(0, value.authorizationRatio - 1);
        const expectedNormalized = clamp(expectedExcess / 0.75, 0, 1);
        const expectedPressure = expectedNormalized * expectedNormalized
            * (3 - 2 * expectedNormalized);
        return Math.abs(value.authorizationExcess - expectedExcess) <= 2e-5
            && Math.abs(value.normalizedExcess - expectedNormalized) <= 2e-5
            && Math.abs(value.pressure - expectedPressure) <= 2e-5;
    }

    function validCrownBaseCompetence(value) {
        if (
            value?.semantics !== CROWN_BASE_COMPETENCE_SEMANTICS
            || typeof value.eligible !== 'boolean'
            || typeof value.applicable !== 'boolean'
            || !Number.isFinite(value.progress)
            || value.progress < 0
            || value.progress > 1
            || typeof value.crownBaseEstablished !== 'boolean'
        ) return false;
        if (!value.applicable) {
            return value.eligible
                && value.realizedArcLength === null
                && value.targetArcLength === null;
        }
        if (
            !Number.isFinite(value.realizedArcLength)
            || value.realizedArcLength < 0
            || !Number.isFinite(value.targetArcLength)
            || value.targetArcLength <= 0
            || !Number.isFinite(value.targetInternodes)
            || value.targetInternodes <= 0
        ) return false;
        const expectedEligible = value.crownBaseEstablished
            || value.realizedArcLength + 2e-5 >= value.targetArcLength;
        return value.eligible === expectedEligible;
    }

    function validLiveLateralFeasibility(value) {
        if (!value) return true;
        const permission = value.visibleScaffoldPermission;
        const constructionCoverage = clamp(
            Number(value.constructionBudget) / 0.055,
            0,
            1,
        );
        const expectedThreshold = clamp(
            Number(value.intrinsicReleaseThreshold)
                + Math.max(0, 0.58 - Number(value.opportunityPotential)) * 0.22,
            0.7,
            1.34,
        );
        const expectedEligible = permission?.eligible === true
            && Number(value.releaseRatio) >= expectedThreshold
            && Number(value.opportunityPotential) > 0.08
            && constructionCoverage >= 0.999;
        return value.semantics === LIVE_LATERAL_FEASIBILITY_SEMANTICS
            && value.cadenceSemantics === MERISTEM_CADENCE_SEMANTICS
            && permission?.semantics
                === VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS
            && validCrownBaseCompetence(
                permission.crownBaseCompetence,
            )
            && JSON.stringify(value.crownBaseCompetence)
                === JSON.stringify(permission.crownBaseCompetence)
            && validVisibleScaffoldLiveness(value.visibleScaffoldLiveness)
            && validVisibleScaffoldLiveness(
                permission.visibleScaffoldLiveness,
            )
            && JSON.stringify(value.visibleScaffoldLiveness)
                === JSON.stringify(permission.visibleScaffoldLiveness)
            && value.claimId === permission.claimId
            && Number.isFinite(value.releaseRatio)
            && Number.isFinite(value.intrinsicReleaseThreshold)
            && Number.isFinite(value.releaseThreshold)
            && Number.isFinite(value.opportunityPotential)
            && Number.isFinite(value.constructionBudget)
            && value.constructionBudget >= 0
            && Number.isFinite(value.constructionCoverage)
            && Math.abs(value.constructionCoverage - constructionCoverage)
                <= 2e-5
            && Math.abs(value.releaseThreshold - expectedThreshold) <= 2e-5
            && value.eligible === expectedEligible;
    }

    function validJuvenileShootOpportunity(value) {
        if (!value) return false;
        const expectedEligible = value.applicable
            && value.progress + 2e-5 >= value.triggerProgress
            && value.progress < 0.82
            && value.shootCount < value.maximumShootCount
            && value.constructionBudget >= 0.055
            && value.opportunityPotential > 0.08;
        return value.semantics === JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS
            && typeof value.eligible === 'boolean'
            && typeof value.applicable === 'boolean'
            && Number.isFinite(value.progress)
            && value.progress >= 0
            && value.progress <= 1
            && Number.isFinite(value.triggerProgress)
            && value.triggerProgress >= 0
            && value.triggerProgress <= 1
            && Number.isInteger(value.shootCount)
            && value.shootCount >= 0
            && Number.isInteger(value.maximumShootCount)
            && value.maximumShootCount >= 0
            && Number.isFinite(value.constructionBudget)
            && value.constructionBudget >= 0
            && Number.isFinite(value.opportunityPotential)
            && value.opportunityPotential >= 0
            && value.eligible === expectedEligible;
    }

    function hashText(value) {
        const source = String(value);
        let hash = 2166136261;
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }

    function exactOrderedValues(actual, expected) {
        return actual.length === expected.length
            && actual.every((value, index) => value === expected[index]);
    }

    function canonicalForkIntentSignature(intent) {
        const decisions = Array.from(intent?.identityDecisions || []);
        return Object.freeze({
            parentAxisOrder: Number(intent?.parentAxisOrder),
            arity: Number(intent?.arity),
            orderedResourceShares: Object.freeze(
                Array.from(intent?.orderedResourceShares || []).map(
                    (share) => rounded(share),
                ),
            ),
            childAxisOrders: Object.freeze(decisions.map(
                (decision) => Number(decision?.axisOrder),
            )),
            orderRetention: Object.freeze(decisions.map(
                (decision) => Boolean(decision?.orderRetained),
            )),
            identityResponsibilities: Object.freeze(decisions.map(
                (decision) => rounded(decision?.identityResponsibility),
            )),
            identityThresholds: Object.freeze(decisions.map(
                (decision) => rounded(decision?.identityThreshold),
            )),
            completionFork: Boolean(intent?.completionFork),
        });
    }

    function exactForkIntentSignature(actual, expected) {
        return actual?.parentAxisOrder === expected.parentAxisOrder
            && actual?.arity === expected.arity
            && exactOrderedValues(
                Array.from(actual?.orderedResourceShares || []),
                expected.orderedResourceShares,
            )
            && exactOrderedValues(
                Array.from(actual?.childAxisOrders || []),
                expected.childAxisOrders,
            )
            && exactOrderedValues(
                Array.from(actual?.orderRetention || []),
                expected.orderRetention,
            )
            && exactOrderedValues(
                Array.from(actual?.identityResponsibilities || []),
                expected.identityResponsibilities,
            )
            && exactOrderedValues(
                Array.from(actual?.identityThresholds || []),
                expected.identityThresholds,
            )
            && actual?.completionFork === expected.completionFork;
    }

    function canonicalForkIntentPlanHash(intent) {
        return `fork-plan-${hashText(JSON.stringify({
            lineageId: intent?.preparedAtLineageId,
            cadenceClaimId: intent?.cadenceClaimId,
            signature: canonicalForkIntentSignature(intent),
            resourceContrastDamping:
                intent?.resourceContrastProfile?.damping,
            flowDirectionWeights: intent?.flowDirectionPlan?.weights,
        }))}`;
    }

    function validForkIntentShape(intent) {
        const signature = intent?.signature;
        const canonicalSignature = canonicalForkIntentSignature(intent);
        const arity = Number(intent?.arity);
        const shares = Array.from(intent?.orderedResourceShares || []);
        const decisions = Array.from(intent?.identityDecisions || []);
        const childAxisOrders = Array.from(signature?.childAxisOrders || []);
        const orderRetention = Array.from(signature?.orderRetention || []);
        const responsibilities = Array.from(
            signature?.identityResponsibilities || [],
        );
        const thresholds = Array.from(signature?.identityThresholds || []);
        const flowDirectionWeights = Array.from(
            intent?.flowDirectionPlan?.weights || [],
        );
        return intent?.semantics === FORK_IDENTITY_INTENT_SEMANTICS
            && nonEmptyString(intent.id)
            && nonEmptyString(intent.planHash)
            && intent.phase === 'prepared_before_graph_mutation'
            && nonEmptyString(intent.preparedAtFrontierId)
            && nonEmptyString(intent.preparedAtLineageId)
            && Number.isInteger(intent.preparedAtSequence)
            && intent.preparedAtSequence >= 0
            && Number.isInteger(intent.preparedAtAxisAge)
            && intent.preparedAtAxisAge >= 0
            && Number.isInteger(intent.parentAxisOrder)
            && intent.parentAxisOrder >= 0
            && intent.parentAxisOrder <= 2
            && [2, 3].includes(arity)
            && shares.length === arity
            && shares.every((share) => Number.isFinite(share) && share > 0)
            && Math.abs(sum(shares) - 1) <= 1e-7
            && intent.resourceContrastProfile?.semantics
                === 'distal_resource_contrast_damping_v1'
            && validCrownArchitectureProfile(
                intent.resourceContrastProfile.architectureProfile,
            )
            && Number.isFinite(intent.resourceContrastProfile.damping)
            && intent.resourceContrastProfile.damping >= 0
            && intent.resourceContrastProfile.damping <= 0.42
            && validZenG15ForkFlowPlan(intent.flowDirectionPlan,shares)
            && flowDirectionWeights.length === arity
            && flowDirectionWeights.every((weight) => (
                Number.isFinite(weight) && weight > 0
            ))
            && Math.abs(sum(flowDirectionWeights) - 1) <= 1e-7
            && decisions.length === arity
            && decisions.every((decision) => (
                Number.isInteger(decision?.axisOrder)
                && decision.axisOrder >= intent.parentAxisOrder
                && decision.axisOrder <= 2
                && decision.tierRole === tierRoleFor(decision.axisOrder)
                && decision.tierArchitecture?.semantics
                    === TIER_ARCHITECTURE_SEMANTICS
                && decision.relativeDifferentiation?.semantics
                    === RELATIVE_DIFFERENTIATION_SEMANTICS
                && typeof decision.orderRetained === 'boolean'
                && Number.isFinite(decision.identityResponsibility)
                && Number.isFinite(decision.identityThreshold)
            ))
            && exactForkIntentSignature(signature, canonicalSignature)
            && childAxisOrders.length === arity
            && orderRetention.length === arity
            && responsibilities.length === arity
            && thresholds.length === arity
            && childAxisOrders.every((axisOrder, index) => (
                axisOrder === decisions[index]?.axisOrder
                && orderRetention[index] === decisions[index]?.orderRetained
            ))
            && responsibilities.every(Number.isFinite)
            && thresholds.every(Number.isFinite)
            && typeof intent.completionFork === 'boolean'
            && intent.planHash === canonicalForkIntentPlanHash(intent)
            && typeof intent.visibleScaffoldReleasePlanned === 'boolean'
            && intent.visibleScaffoldReleasePlanned === (
                intent.parentAxisOrder === 0
                && childAxisOrders.some((axisOrder) => axisOrder > 0)
            )
            && (
                intent.visibleScaffoldReleasePlanned
                    ? nonEmptyString(intent.cadenceClaimId)
                    : intent.cadenceClaimId === null
            )
            && intent.rngReserved === true
            && Number.isInteger(intent.reservedAtSequence)
            && intent.reservedAtSequence >= intent.preparedAtSequence;
    }

    function inspectVisibleScaffoldAuthority(graph) {
        const permissionReceipts = Array.isArray(
            graph?.visibleScaffoldPermissionReceipts,
        ) ? graph.visibleScaffoldPermissionReceipts : [];
        const intentReceipts = Array.isArray(
            graph?.forkIdentityIntentReceipts,
        ) ? graph.forkIdentityIntentReceipts : [];
        const permissionViolations = [];
        const intentViolations = [];
        const frontiers = new Map((graph?.frontiers || []).map(
            (frontier) => [frontier.id, frontier],
        ));
        const lineages = new Map((graph?.lineages || []).map(
            (lineage) => [lineage.id, lineage],
        ));
        const events = new Map((graph?.events || []).map(
            (event) => [event.sequence, event],
        ));
        const permissionIds = new Set();
        const permissionByReleaseKey = new Map();
        let priorPermissionSequence = -1;

        if (!Array.isArray(graph?.visibleScaffoldPermissionReceipts)) {
            permissionViolations.push('missing_visible_scaffold_permission_ledger');
        }
        if (!Array.isArray(graph?.forkIdentityIntentReceipts)) {
            intentViolations.push('missing_fork_identity_intent_ledger');
        }

        permissionReceipts.forEach((receipt, index) => {
            const releaseKey = [
                receipt.sequence,
                receipt.candidateKind,
                receipt.frontierId,
            ].join(':');
            const expectedId = `permission-${String(index + 1).padStart(4, '0')}`;
            const decisionValid = receipt.decision === 'granted'
                || receipt.decision === 'deferred'
                || receipt.decision === 'not_required_order_zero_succession'
                || receipt.decision === 'not_required_non_order_zero_fork'
                || receipt.decision === 'not_required_non_order_zero_lateral'
                || receipt.decision === 'not_required_temporary_juvenile_axis';
            const requiredShapeValid = receipt.required
                ? nonEmptyString(receipt.claimId)
                    && ['granted', 'deferred'].includes(receipt.decision)
                : receipt.decision?.startsWith('not_required_')
                    && (receipt.claimId === null || nonEmptyString(receipt.claimId))
                    && receipt.committed;
            if (
                (receipt.required
                    ? receipt.semantics !== VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS
                    : receipt.semantics !== undefined
                        && receipt.semantics !== VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS)
                || receipt.id !== expectedId
                || permissionIds.has(receipt.id)
                || !Number.isInteger(receipt.sequence)
                || receipt.sequence < 0
                || receipt.sequence < priorPermissionSequence
                || receipt.phase !== 'pre_mutation'
                || !['structural_fork', 'live_lateral_emission'].includes(
                    receipt.candidateKind,
                )
                || !frontiers.has(receipt.frontierId)
                || !lineages.has(receipt.lineageId)
                || frontiers.get(receipt.frontierId)?.lineageId !== receipt.lineageId
                || !Array.isArray(receipt.plannedChildOrders)
                || receipt.plannedChildOrders.some((axisOrder) => (
                    !Number.isInteger(axisOrder) || axisOrder < 0
                ))
                || typeof receipt.required !== 'boolean'
                || typeof receipt.committed !== 'boolean'
                || (receipt.required
                    ? typeof receipt.eligible !== 'boolean'
                    : receipt.eligible !== undefined
                        && typeof receipt.eligible !== 'boolean')
                || !decisionValid
                || !requiredShapeValid
                || (receipt.decision === 'granted'
                    && (!receipt.eligible || !receipt.committed))
                || (receipt.decision === 'deferred'
                    && (receipt.eligible || receipt.committed))
                || (receipt.candidateKind === 'live_lateral_emission'
                    && ![
                        'granted',
                        'not_required_non_order_zero_lateral',
                        'not_required_temporary_juvenile_axis',
                    ].includes(receipt.decision))
                || (receipt.forkIntentId !== null
                    && !nonEmptyString(receipt.forkIntentId))
                || (receipt.planHash !== null && !nonEmptyString(receipt.planHash))
                || (Boolean(receipt.forkIntentId) !== Boolean(receipt.planHash))
                || !validVisibleScaffoldLiveness(
                    receipt.visibleScaffoldLiveness,
                )
                || !validCrownBaseCompetence(
                    receipt.crownBaseCompetence,
                )
                || (Number.isFinite(receipt.authorizationRatio)
                    && Math.abs(
                        receipt.visibleScaffoldLiveness.authorizationRatio
                            - (receipt.crownBaseCompetence?.eligible
                                ? receipt.authorizationRatio
                                : 0),
                    ) > 2e-5)
                || (receipt.decision === 'deferred'
                    && receipt.visibleScaffoldLiveness.pressure > 2e-5)
            ) {
                permissionViolations.push(
                    `invalid_visible_scaffold_permission_receipt:${receipt.id || index}`,
                );
            }
            permissionIds.add(receipt.id);
            priorPermissionSequence = Math.max(
                priorPermissionSequence,
                Number(receipt.sequence || 0),
            );
            const releases = permissionByReleaseKey.get(releaseKey) || [];
            releases.push(receipt);
            permissionByReleaseKey.set(releaseKey, releases);
        });

        const planHashByIntent = new Map();
        const intentLifecycle = new Map();
        const observePlanHash = (forkIntentId, planHash, source) => {
            if (!forkIntentId && !planHash) return;
            if (!nonEmptyString(forkIntentId) || !nonEmptyString(planHash)) {
                intentViolations.push(`invalid_fork_intent_reference:${source}`);
                return;
            }
            const expected = planHashByIntent.get(forkIntentId);
            if (expected && expected !== planHash) {
                intentViolations.push(`fork_intent_plan_hash_drift:${forkIntentId}`);
            } else if (!expected) {
                planHashByIntent.set(forkIntentId, planHash);
            }
        };
        let priorIntentSequence = -1;
        intentReceipts.forEach((receipt, index) => {
            const lifecycle = intentLifecycle.get(receipt.forkIntentId) || {
                initiated: [],
                committed: [],
                cancelled: [],
            };
            if (lifecycle[receipt.phase]) lifecycle[receipt.phase].push(receipt);
            intentLifecycle.set(receipt.forkIntentId, lifecycle);
            const phaseValid = ['initiated', 'committed', 'cancelled'].includes(
                receipt.phase,
            );
            const initiatedShapeValid = receipt.phase !== 'initiated' || (
                receipt.signature
                && Array.isArray(receipt.signature.childAxisOrders)
                && [2, 3].includes(receipt.signature.arity)
                && receipt.signature.childAxisOrders.length
                    === receipt.signature.arity
                && typeof receipt.visibleScaffoldReleasePlanned === 'boolean'
            );
            if (
                receipt.semantics !== FORK_IDENTITY_INTENT_SEMANTICS
                || !phaseValid
                || !nonEmptyString(receipt.forkIntentId)
                || !nonEmptyString(receipt.planHash)
                || !Number.isInteger(receipt.sequence)
                || receipt.sequence < 0
                || receipt.sequence < priorIntentSequence
                || !lineages.has(receipt.lineageId)
                || (receipt.cadenceClaimId !== null
                    && !nonEmptyString(receipt.cadenceClaimId))
                || !initiatedShapeValid
            ) {
                intentViolations.push(
                    `invalid_fork_identity_intent_receipt:${receipt.forkIntentId || index}`,
                );
            }
            observePlanHash(
                receipt.forkIntentId,
                receipt.planHash,
                `receipt:${index}`,
            );
            priorIntentSequence = Math.max(
                priorIntentSequence,
                Number(receipt.sequence || 0),
            );
        });

        intentLifecycle.forEach((lifecycle, forkIntentId) => {
            const terminalCount = lifecycle.committed.length + lifecycle.cancelled.length;
            if (
                lifecycle.initiated.length !== 1
                || terminalCount > 1
                || (terminalCount > 0 && lifecycle.initiated[0]?.sequence > (
                    lifecycle.committed[0]?.sequence
                    ?? lifecycle.cancelled[0]?.sequence
                    ?? -1
                ))
            ) intentViolations.push(`invalid_fork_intent_lifecycle:${forkIntentId}`);
        });

        permissionReceipts.forEach((receipt) => observePlanHash(
            receipt.forkIntentId,
            receipt.planHash,
            `permission:${receipt.id}`,
        ));

        (graph?.frontiers || []).forEach((frontier) => {
            const intent = frontier.pendingForkIntent;
            if (!intent) return;
            if (
                !validForkIntentShape(intent)
                || intent.preparedAtLineageId !== frontier.lineageId
                || intent.parentAxisOrder
                    !== Number(frontier.axisOrder ?? frontier.tier ?? 0)
                || (intent.visibleScaffoldReleasePlanned
                    && intent.cadenceClaimId !== frontier.meristemCadence?.claimId)
            ) {
                intentViolations.push(
                    `invalid_pending_fork_identity_intent:${frontier.id}`,
                );
            }
            observePlanHash(intent.id, intent.planHash, `frontier:${frontier.id}`);
        });

        const splitsByIntent = new Map();
        (graph?.splits || []).forEach((split) => {
            const intent = split.forkIdentityIntent;
            if (!intent) {
                intentViolations.push(
                    `missing_committed_fork_identity_intent:${split.id}`,
                );
                return;
            }
            const matchingSplits = splitsByIntent.get(intent.id) || [];
            matchingSplits.push(split);
            splitsByIntent.set(intent.id, matchingSplits);
            const splitShares = Array.from(split.resourceShares || []);
            const splitChildOrders = Array.from(split.children || []).map(
                (child) => Number(child.axisOrder ?? child.tier),
            );
            const forkEvent = events.get(split.sequence);
            const realizedDecisions = Array.from(forkEvent?.tierDecisions || []);
            const realizedRetention = realizedDecisions.map(
                (decision) => Boolean(decision?.orderRetained),
            );
            if (
                !validForkIntentShape(intent)
                || intent.preparedAtLineageId !== split.parentLineageId
                || intent.parentAxisOrder !== Number(
                    frontiers.get(split.parentFrontierId)?.axisOrder
                        ?? split.parentTier,
                )
                || intent.arity !== splitChildOrders.length
                || intent.completionFork !== Boolean(split.completionFork)
                || !exactOrderedValues(
                    Array.from(intent.orderedResourceShares || []),
                    splitShares,
                )
                || !exactOrderedValues(
                    Array.from(intent.signature?.childAxisOrders || []),
                    splitChildOrders,
                )
                || forkEvent?.kind !== 'fork'
                || forkEvent.consumedFrontierId !== split.parentFrontierId
                || forkEvent.forkIdentityIntent?.id !== intent.id
                || forkEvent.forkIdentityIntent?.planHash !== intent.planHash
                || !exactOrderedValues(
                    Array.from(intent.signature?.childAxisOrders || []),
                    realizedDecisions.map((decision) => Number(decision?.axisOrder)),
                )
                || !exactOrderedValues(
                    Array.from(intent.signature?.orderRetention || []),
                    realizedRetention,
                )
            ) {
                intentViolations.push(
                    `committed_fork_identity_intent_mismatch:${split.id}`,
                );
            }
            observePlanHash(intent.id, intent.planHash, `split:${split.id}`);
        });

        intentLifecycle.forEach((lifecycle, forkIntentId) => {
            const committed = lifecycle.committed;
            const cancelled = lifecycle.cancelled;
            const matchingSplits = splitsByIntent.get(forkIntentId) || [];
            if (committed.length === 0 && matchingSplits.length === 0) return;
            const receipt = committed[0];
            const split = matchingSplits[0];
            const intent = split?.forkIdentityIntent;
            if (
                committed.length !== 1
                || cancelled.length !== 0
                || matchingSplits.length !== 1
                || receipt.sequence !== split?.sequence
                || receipt.lineageId !== split?.parentLineageId
                || receipt.planHash !== intent?.planHash
                || receipt.cadenceClaimId !== intent?.cadenceClaimId
                || receipt.visibleScaffoldReleasePlanned
                    !== intent?.visibleScaffoldReleasePlanned
                || !exactForkIntentSignature(
                    lifecycle.initiated[0]?.signature,
                    canonicalForkIntentSignature(intent),
                )
            ) {
                intentViolations.push(
                    `fork_intent_commit_split_bijection:${forkIntentId}`,
                );
            }
        });
        splitsByIntent.forEach((matchingSplits, forkIntentId) => {
            if (intentLifecycle.has(forkIntentId)) return;
            intentViolations.push(
                `fork_intent_commit_split_bijection:${forkIntentId}`,
            );
        });

        const visibleReleases = [
            ...(graph?.splits || [])
                .filter((split) => (
                    split.parentTier === 0
                    && split.children.some((child) => (
                        Number(child.axisOrder ?? child.tier) > 0
                    ))
                ))
                .map((split) => ({
                    kind: 'structural_fork',
                    sequence: split.sequence,
                    frontierId: split.parentFrontierId,
                    lineageId: split.parentLineageId,
                    childAxisOrders: split.children.map(
                        (child) => Number(child.axisOrder ?? child.tier),
                    ),
                    embeddedPermission: split.visibleScaffoldPermission,
                    forkIntent: split.forkIdentityIntent,
                })),
            ...(graph?.lateralMeristems || [])
                .filter((meristem) => (
                    meristem.status === 'emitted'
                    && !meristem.temporaryAxis
                    && meristem.parentTier === 0
                    && Number(meristem.childAxisOrder ?? meristem.childTier) > 0
                ))
                .map((meristem) => ({
                    kind: 'live_lateral_emission',
                    sequence: meristem.emittedAtEvent,
                    frontierId: meristem.sourceFrontierId,
                    lineageId: meristem.parentLineageId,
                    childAxisOrders: [
                        Number(meristem.childAxisOrder ?? meristem.childTier),
                    ],
                    embeddedPermission: events.get(meristem.emittedAtEvent)
                        ?.steering?.visibleScaffoldPermission,
                    forkIntent: null,
                    readinessPermission: meristem.structuralReleaseReadiness
                        ?.visibleScaffoldPermission,
                })),
        ];
        const matchedCommittedPermissionIds = new Set();
        visibleReleases.forEach((release) => {
            const key = [release.sequence, release.kind, release.frontierId].join(':');
            const matches = (permissionByReleaseKey.get(key) || []).filter(
                (receipt) => (
                    receipt.required
                    && receipt.committed
                    && receipt.eligible
                    && receipt.decision === 'granted'
                ),
            );
            const receipt = matches[0];
            const parentClaimId = frontiers.get(release.frontierId)
                ?.meristemCadence?.claimId;
            const embedded = release.embeddedPermission;
            if (
                matches.length !== 1
                || !receipt
                || receipt.phase !== 'pre_mutation'
                || receipt.lineageId !== release.lineageId
                || receipt.claimId !== parentClaimId
                || receipt.id !== embedded?.id
                || receipt.claimId !== embedded?.claimId
                || receipt.decision !== embedded?.decision
                || receipt.crownBaseCompetence?.eligible !== true
                || (release.kind === 'structural_fork'
                    && receipt.planHash !== (release.forkIntent?.planHash || null))
                || (release.kind === 'structural_fork'
                    && receipt.forkIntentId !== (release.forkIntent?.id || null))
                || receipt.plannedChildOrders.length !== release.childAxisOrders.length
                || receipt.plannedChildOrders.some((axisOrder, index) => (
                    axisOrder !== release.childAxisOrders[index]
                ))
                || (release.forkIntent
                    && receipt.claimId !== release.forkIntent.cadenceClaimId)
                || (release.readinessPermission
                    && receipt.claimId !== release.readinessPermission.claimId)
            ) {
                permissionViolations.push(
                    `visible_scaffold_release_permission_mismatch:${release.kind}:${release.sequence}`,
                );
            }
            if (receipt) matchedCommittedPermissionIds.add(receipt.id);
        });

        (graph?.splits || []).filter((split) => !(
            split.parentTier === 0
            && split.children.some((child) => (
                Number(child.axisOrder ?? child.tier) > 0
            ))
        )).forEach((split) => {
            const key = [
                split.sequence,
                'structural_fork',
                split.parentFrontierId,
            ].join(':');
            const matches = (permissionByReleaseKey.get(key) || []).filter(
                (receipt) => receipt.committed,
            );
            const receipt = matches[0];
            const expectedDecision = split.parentTier === 0
                ? 'not_required_order_zero_succession'
                : 'not_required_non_order_zero_fork';
            if (
                matches.length !== 1
                || !receipt
                || receipt.required
                || receipt.decision !== expectedDecision
                || receipt.id !== split.visibleScaffoldPermission?.id
                || (split.parentTier === 0
                    && receipt.claimId !== frontiers.get(split.parentFrontierId)
                        ?.meristemCadence?.claimId)
                || (split.parentTier === 0
                    && receipt.crownBaseCompetence?.eligible !== true)
                || receipt.forkIntentId !== split.forkIdentityIntent?.id
                || receipt.planHash !== split.forkIdentityIntent?.planHash
            ) {
                permissionViolations.push(
                    `non_release_fork_permission_mismatch:${split.sequence}`,
                );
            }
            if (receipt) matchedCommittedPermissionIds.add(receipt.id);
        });

        (graph?.lateralMeristems || []).filter((meristem) => (
            meristem.status === 'emitted'
            && meristem.parentTier !== 0
        )).forEach((meristem) => {
            const key = [
                meristem.emittedAtEvent,
                'live_lateral_emission',
                meristem.sourceFrontierId,
            ].join(':');
            const matches = (permissionByReleaseKey.get(key) || []).filter(
                (receipt) => receipt.committed,
            );
            const receipt = matches[0];
            const embedded = events.get(meristem.emittedAtEvent)
                ?.steering?.visibleScaffoldPermission;
            if (
                matches.length !== 1
                || !receipt
                || receipt.required
                || receipt.decision !== 'not_required_non_order_zero_lateral'
                || receipt.claimId !== null
                || receipt.id !== embedded?.id
            ) {
                permissionViolations.push(
                    `non_order_zero_lateral_permission_mismatch:${meristem.emittedAtEvent}`,
                );
            }
            if (receipt) matchedCommittedPermissionIds.add(receipt.id);
        });

        (graph?.lateralMeristems || []).filter((meristem) => (
            meristem.status === 'emitted'
            && meristem.parentTier === 0
            && meristem.temporaryAxis
        )).forEach((meristem) => {
            const key = [
                meristem.emittedAtEvent,
                'live_lateral_emission',
                meristem.sourceFrontierId,
            ].join(':');
            const matches = (permissionByReleaseKey.get(key) || []).filter(
                (receipt) => receipt.committed,
            );
            const receipt = matches[0];
            const embedded = events.get(meristem.emittedAtEvent)
                ?.steering?.visibleScaffoldPermission;
            if (
                matches.length !== 1
                || !receipt
                || receipt.required
                || receipt.decision
                    !== 'not_required_temporary_juvenile_axis'
                || receipt.claimId !== null
                || receipt.id !== embedded?.id
                || !validJuvenileShootOpportunity(
                    receipt.juvenileShootOpportunity,
                )
            ) {
                permissionViolations.push(
                    `temporary_juvenile_axis_permission_mismatch:${meristem.emittedAtEvent}`,
                );
            }
            if (receipt) matchedCommittedPermissionIds.add(receipt.id);
        });

        const committedPermissionByClaim = new Map();
        permissionReceipts.filter((receipt) => (
            receipt.required
            && receipt.committed
            && receipt.eligible
            && receipt.decision === 'granted'
        )).forEach((receipt) => {
            const prior = committedPermissionByClaim.get(receipt.claimId);
            if (prior) {
                permissionViolations.push(
                    `duplicate_visible_scaffold_claim_spend:${receipt.claimId}`,
                );
            } else {
                committedPermissionByClaim.set(receipt.claimId, receipt.id);
            }
        });
        permissionReceipts.filter((receipt) => receipt.committed).forEach((receipt) => {
            if (matchedCommittedPermissionIds.has(receipt.id)) return;
            permissionViolations.push(
                `orphan_visible_scaffold_permission_commit:${receipt.id}`,
            );
        });

        const finalActiveFrontierIds = new Set(
            graph?.events?.at(-1)?.activeFrontierIdsAfter || [],
        );
        return Object.freeze({
            permissionReceipts: Object.freeze([...permissionReceipts]),
            intentReceipts: Object.freeze([...intentReceipts]),
            permissionViolations: Object.freeze(permissionViolations),
            intentViolations: Object.freeze(intentViolations),
            violations: Object.freeze([
                ...permissionViolations,
                ...intentViolations,
            ]),
            permissionReceiptCount: permissionReceipts.length,
            grantedPermissionCount: permissionReceipts.filter(
                (receipt) => receipt.decision === 'granted',
            ).length,
            deferredPermissionCount: permissionReceipts.filter(
                (receipt) => receipt.decision === 'deferred',
            ).length,
            notRequiredPermissionCount: permissionReceipts.filter(
                (receipt) => receipt.decision?.startsWith('not_required_'),
            ).length,
            committedVisibleReleaseCount: committedPermissionByClaim.size,
            forkPermissionCommitCount: permissionReceipts.filter((receipt) => (
                receipt.candidateKind === 'structural_fork'
                && receipt.required
                && receipt.committed
                && receipt.decision === 'granted'
            )).length,
            liveLateralPermissionCommitCount: permissionReceipts.filter((receipt) => (
                receipt.candidateKind === 'live_lateral_emission'
                && receipt.required
                && receipt.committed
                && receipt.decision === 'granted'
            )).length,
            intentReceiptCount: intentReceipts.length,
            intentCount: intentLifecycle.size,
            initiatedIntentCount: intentReceipts.filter(
                (receipt) => receipt.phase === 'initiated',
            ).length,
            committedIntentCount: intentReceipts.filter(
                (receipt) => receipt.phase === 'committed',
            ).length,
            cancelledIntentCount: intentReceipts.filter(
                (receipt) => receipt.phase === 'cancelled',
            ).length,
            pendingFrontierStateCount: (graph?.frontiers || []).filter(
                (frontier) => Boolean(frontier.pendingForkIntent),
            ).length,
            pendingFrontierCount: (graph?.frontiers || []).filter(
                (frontier) => (
                    finalActiveFrontierIds.has(frontier.id)
                    && Boolean(frontier.pendingForkIntent)
                ),
            ).length,
        });
    }

    function validateGraph(graph) {
        const failures = [];
        if (!graph?.contract || !Array.isArray(graph.events)) {
            return Object.freeze(['missing_graph_contract']);
        }
        const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
        const events = new Map(graph.events.map((event) => [event.sequence, event]));
        const segments = new Map(graph.segments.map((segment) => [segment.id, segment]));
        const frontiers = new Map(graph.frontiers.map((frontier) => [frontier.id, frontier]));
        const lineages = new Map(graph.lineages.map((lineage) => [lineage.id, lineage]));
        const corridors = new Map(graph.corridors.map((corridor) => [corridor.id, corridor]));
        const clusters = new Map(graph.clusters.map((cluster) => [cluster.id, cluster]));
        const visibleScaffoldAuthority = inspectVisibleScaffoldAuthority(graph);
        failures.push(...visibleScaffoldAuthority.violations);
        const active = new Set();
        const activeCorridors = new Set();
        graph.events.forEach((event) => {
            if (event.kind !== 'emerge') {
                if (!active.has(event.consumedFrontierId)) {
                    failures.push(`consumed_inactive_frontier:${event.id}`);
                }
                active.delete(event.consumedFrontierId);
            }
            (event.releasedCorridorIds || []).forEach((corridorId) => {
                const corridor = corridors.get(corridorId);
                if (!activeCorridors.has(corridorId)) {
                    failures.push(`released_inactive_corridor:${event.id}:${corridorId}`);
                }
                if (corridor?.releasedAtEvent !== event.sequence) {
                    failures.push(`corridor_release_mismatch:${event.id}:${corridorId}`);
                }
                activeCorridors.delete(corridorId);
            });
            const consumed = event.consumedFrontierId
                ? frontiers.get(event.consumedFrontierId)
                : null;
            const lateralEmission = event.steering?.lateralEmission || null;
            if (lateralEmission) {
                const meristem = graph.lateralMeristems.find(
                    (candidate) => candidate.id === lateralEmission.meristemId,
                );
                const emittedFrontier = frontiers.get(lateralEmission.frontierId);
                if (
                    event.kind !== 'advance'
                    || !meristem
                    || meristem.status !== 'emitted'
                    || meristem.emittedAtEvent !== event.sequence
                    || meristem.emissionLineageId !== lateralEmission.lineageId
                    || !event.createdNodeIds.includes(lateralEmission.nodeId)
                    || !event.createdSegmentIds.includes(lateralEmission.segmentId)
                    || !event.createdFrontierIds.includes(lateralEmission.frontierId)
                    || emittedFrontier?.birthMode !== 'live_lateral_emission'
                    || lateralEmission.orientationPlan?.semantics
                        !== 'family_composed_gravity_visible_lateral_frame_v7'
                    || !Number.isFinite(
                        lateralEmission.orientationPlan?.gravityBlend,
                    )
                    || !Number.isFinite(
                        lateralEmission.orientationPlan
                            ?.screenPlaneElevationRadians,
                    )
                    || !Number.isFinite(
                        lateralEmission.orientationPlan
                            ?.realizedBaseElevationRadians,
                    )
                    || !validCrownInteriorExposure(
                        lateralEmission.orientationPlan
                            ?.crownInteriorExposure,
                    )
                    || !Number.isFinite(
                        lateralEmission.orientationPlan?.interiorBridgeBlend,
                    )
                    || lateralEmission.orientationPlan.interiorBridgeBlend < 0
                    || lateralEmission.orientationPlan.interiorBridgeBlend
                        > 0.14 + 1e-8
                    || !validScaffoldFamilyGesture(
                        lateralEmission.scaffoldFamilyGesture,
                        emittedFrontier?.axisOrder,
                    )
                    || lateralEmission.scaffoldFamilyGesture?.gestureId
                        !== emittedFrontier?.scaffoldFamilyGesture?.gestureId
                    || !validCrownBirthOpportunity(
                        lateralEmission.crownBirthOpportunity,
                        lateralEmission.scaffoldFamilyGesture,
                    )
                ) failures.push(`invalid_atomic_lateral_emission:${event.id}`);
            }
            event.createdSegmentIds.forEach((segmentId) => {
                const segment = segments.get(segmentId);
                if (!segment) {
                    failures.push(`missing_segment:${event.id}:${segmentId}`);
                    return;
                }
                if (
                    segment.birthEvent !== event.sequence
                    || segment.registeredAtEvent !== event.sequence
                    || (
                        consumed
                        && segment.fromNodeId !== consumed.nodeId
                        && !(
                            segment.birthMode === 'live_lateral_emission'
                            && event.createdNodeIds.includes(segment.fromNodeId)
                        )
                    )
                    || !event.createdNodeIds.includes(segment.toNodeId)
                ) {
                    failures.push(`non_atomic_geometry:${segmentId}`);
                }
            });
            if (event.kind === 'fork') {
                if (
                    ![2, 3].includes(event.splitArity)
                    || event.createdNodeIds.length !== event.splitArity
                    || event.createdSegmentIds.length !== event.splitArity
                    || event.createdFrontierIds.length !== event.splitArity
                    || new Set(event.createdNodeIds).size !== event.splitArity
                ) failures.push(`invalid_atomic_fork:${event.id}`);
                if (Math.abs(sum(event.resourceShares) - 1) > 1e-9) {
                    failures.push(`resource_sum_mismatch:${event.id}`);
                }
                const childBudget = event.childDevelopmentBudget;
                const budgetChildren = Array.from(childBudget?.children || []);
                const tierDecisions = Array.from(event.tierDecisions || []);
                const tierZeroStationTransition = consumed?.axisOrder === 0
                    && tierDecisions.some((decision) => decision.axisOrder === 0)
                    && tierDecisions.some((decision) => decision.axisOrder === 1);
                if (
                    childBudget?.semantics !== 'absolute_family_capacity_composition_v4'
                    || budgetChildren.length !== event.splitArity
                    || childBudget.tierArchitecture?.semantics
                        !== TIER_ARCHITECTURE_SEMANTICS
                    || !validCrownArchitectureProfile(
                        childBudget?.architectureProfile,
                    )
                    || !Number.isFinite(childBudget.family?.parentCapacity)
                    || !Number.isFinite(childBudget.allocatedCapacity)
                    || childBudget.allocatedCapacity
                        > childBudget.family.parentCapacity + 1e-6
                ) {
                    failures.push(`absolute_child_budget_mismatch:${event.id}`);
                }
                budgetChildren.forEach((child, childIndex) => {
                    const composition = child.supportFraction
                        + child.extensionFraction
                        + child.reiterationFraction;
                    const allocated = child.supportBudget
                        + child.extensionBudget
                        + child.reiterationBudget;
                    if (
                        !Number.isFinite(child.absoluteCapacity)
                        || child.absoluteCapacity <= 0
                        || !validCrownArchitectureProfile(
                            child.architectureProfile,
                        )
                        || !validRelativeDifferentiation(
                            child.relativeDifferentiation,
                            tierDecisions[childIndex]?.axisOrder,
                        )
                        || Math.abs(composition - 1) > 1e-6
                        || Math.abs(allocated - child.absoluteCapacity) > 2e-6
                    ) failures.push(`child_budget_composition_mismatch:${event.id}:${childIndex}`);
                });
                if (
                    !graph.contract.jointFrame && tierZeroStationTransition
                    && !validStructuralStation(
                        event.steering?.structuralStation,
                        'structural_fork',
                    )
                ) failures.push(`invalid_structural_station:${event.id}`);
                if (graph.contract.jointFrame && !validJointFrameReceipt(
                    graph.contract.jointFrame, event.steering?.jointFrame,
                    event, consumed, nodes, segments, frontiers,
                )) failures.push(`invalid_joint_frame:${event.id}`);
                if (
                    Math.abs(sum(event.junctionAreaShares || []) - 1) > 1e-6
                    || Math.abs(sum(event.junctionMassShares || []) - 1) > 1e-6
                    || Math.abs(sum(event.growthAllocationShares || []) - 1) > 1e-6
                    || Math.abs(sum(event.supportAllocationShares || []) - 1) > 1e-6
                    || Math.abs(sum(event.reiterationAllocationShares || []) - 1) > 1e-6
                    || Math.abs(sum(event.angleShares || []) - 1) > 1e-6
                ) failures.push(`allocation_ledger_sum_mismatch:${event.id}`);
                const flowDirectionPlan = event.flowDirectionPlan;
                const flowDirectionWeights = Array.from(
                    flowDirectionPlan?.weights || [],
                );
                if (
                    !validZenG15ForkFlowPlan(flowDirectionPlan,event.resourceShares)
                    || flowDirectionPlan?.semantics !== graph.contract.forkFlowDirectionSemantics
                    || (flowDirectionPlan?.semantics===ZEN_G15_JOINT_FLOW
                        && flowDirectionPlan.allocation.strength!==graph.contract.forkAllocationStrength)
                    || flowDirectionWeights.length !== event.splitArity
                    || flowDirectionWeights.some((weight) => (
                        !Number.isFinite(weight) || weight <= 0
                    ))
                    || Math.abs(sum(flowDirectionWeights) - 1) > 1e-7
                    || !exactOrderedValues(
                        flowDirectionWeights,
                        event.forkIdentityIntent?.flowDirectionPlan?.weights,
                    )
                ) failures.push(`fork_flow_direction_plan_mismatch:${event.id}`);
                if (
                    !Number.isFinite(event.steering?.weightedMeanAngleDegrees)
                ) failures.push(`fork_reference_error_unbounded:${event.id}`);
                const expectedDecisions = Array.from(event.tierDecisions || []);
                const identitySignals = Array.from(event.axisIdentitySignals || []);
                if (
                    expectedDecisions.length !== event.splitArity
                    || identitySignals.length !== event.splitArity
                ) {
                    failures.push(`axis_identity_receipt_mismatch:${event.id}`);
                }
                expectedDecisions.forEach((decision, childIndex) => {
                    const signal = identitySignals[childIndex];
                    const validTransition = consumed && (
                        decision.tier === consumed.tier
                        || decision.tier === Math.min(2, consumed.tier + 1)
                    );
                    if (
                        !validTransition
                        || !Number.isFinite(decision.retentionPotential)
                        || decision.retentionPotential < 0
                        || decision.retentionPotential > 1
                        || !Number.isFinite(signal?.retentionPotential)
                        || !Number.isFinite(signal?.identityResponsibility)
                        || !Number.isFinite(signal?.identityThreshold)
                        || signal.identityThreshold < 0
                        || signal.identityThreshold > 1
                        || Math.abs(
                            signal.retentionPotential - decision.retentionPotential
                        ) > 1e-8
                        || Math.abs(
                            signal.identityResponsibility - decision.retentionPotential
                        ) > 1e-8
                    ) failures.push(`invalid_axis_identity_transition:${event.id}:${childIndex}`);
                });
                const separationPlan = event.steering?.siblingSeparationPlan;
                if (
                    event.splitArity === 2
                    && (
                        !separationPlan?.eligible
                        || separationPlan.semantics
                            !== 'joint_sibling_separation_projection_v2'
                        || separationPlan.resourceShareAuthority !== false
                        || !Number.isFinite(separationPlan.proposedSeparationRadians)
                        || !Number.isFinite(separationPlan.afterSeparationRadians)
                    )
                ) failures.push(`sibling_separation_receipt_mismatch:${event.id}`);
                const rawCubicMass = (event.junctionAreaShares || []).map(
                    (share) => share ** 1.5,
                );
                const cubicMassTotal = sum(rawCubicMass);
                (event.junctionMassShares || []).forEach((share, childIndex) => {
                    if (
                        Math.abs(share - rawCubicMass[childIndex] / cubicMassTotal) > 1e-5
                    ) failures.push(`junction_cubic_mass_mismatch:${event.id}:${childIndex}`);
                    if (
                        Math.abs(
                            event.junctionAreaShares[childIndex]
                                - event.supportAllocationShares[childIndex]
                        ) > 1e-5
                    ) failures.push(`support_area_ledger_mismatch:${event.id}:${childIndex}`);
                });
                event.createdSegmentIds.forEach((segmentId, childIndex) => {
                    const segment = segments.get(segmentId);
                    if (segment?.tier !== expectedDecisions[childIndex]?.tier) {
                        failures.push(`axis_order_decision_mismatch:${event.id}:${childIndex}`);
                    }
                });
                if (consumed) {
                    const realizedAreaGain = sum(event.createdSegmentIds.map(
                        (segmentId) => segments.get(segmentId)?.startRadius ** 2 || 0,
                    )) / (consumed.radius ** 2);
                    if (
                        !Number.isFinite(event.areaGain)
                        || event.areaGain <= 0
                        || Math.abs(realizedAreaGain - event.areaGain) > 1e-5
                    ) failures.push(`fork_area_gain_mismatch:${event.id}`);
                    const referenceHeading = event.steering?.referenceFrame?.heading
                        || consumed.heading;
                    const childAngles = event.createdSegmentIds.map((segmentId) => {
                        const segment = segments.get(segmentId);
                        const start = nodes.get(segment.fromNodeId)?.point;
                        const end = nodes.get(segment.toNodeId)?.point;
                        const heading = normalize(subtract(end, start));
                        return {
                            angle: angularDistance(referenceHeading, heading),
                            parentAngle: angularDistance(consumed.heading, heading),
                            worldLean: angularDistance({ x: 0, y: 1, z: 0 }, heading),
                            forwardDot: dot(consumed.heading, heading),
                        };
                    });
                    const support = factorGraphSupport(PRESETS[graph.preset]?.orderZeroSupport,graph);
                    if (consumed.tier === 0 && support) {
                        const orderZeroChildCount = expectedDecisions.filter(
                            (decision) => decision.tier === 0,
                        ).length;
                        const realizedSupport = event.steering
                            ?.supportedForkPlan?.support;
                        const maximumTurn = orderZeroChildCount > 1
                            ? Number(
                                event.steering?.supportedForkPlan
                                    ?.maximumTurnRadians
                                    ?? realizedSupport?.codominantTurnRadians,
                            )
                            : Number(
                                realizedSupport?.continuationTurnRadians
                                    ?? support.continuationTurnDegrees * Math.PI / 180,
                            );
                        const maximumWorldLean = Number(
                            realizedSupport?.maximumLeanRadians
                                ?? event.steering?.supportedForkPlan
                                    ?.maximumWorldLeanRadians
                                ?? support.maximumLeanDegrees * Math.PI / 180,
                        );
                        event.createdSegmentIds.forEach((segmentId, childIndex) => {
                            if (expectedDecisions[childIndex]?.tier !== 0) return;
                            if (
                                childAngles[childIndex].worldLean
                                    > maximumWorldLean + 1e-6
                                || childAngles[childIndex].parentAngle > maximumTurn + 1e-6
                            ) failures.push(
                                `order_zero_fork_support_violation:${event.id}:${childIndex}`
                                    + `:lean=${rounded(childAngles[childIndex].worldLean)}`
                                    + `/${rounded(maximumWorldLean)}`
                                    + `:turn=${rounded(childAngles[childIndex].parentAngle)}`
                                    + `/${rounded(maximumTurn)}`,
                            );
                        });
                    }
                }
            }
            event.createdFrontierIds.forEach((frontierId) => {
                const frontier = frontiers.get(frontierId);
                if (!frontier) {
                    failures.push(`missing_frontier:${event.id}:${frontierId}`);
                    return;
                }
                if (!event.createdNodeIds.includes(frontier.nodeId)) {
                    failures.push(`frontier_without_created_node:${frontier.id}`);
                }
                if (
                    event.kind === 'fork'
                    && lineages.get(frontier.lineageId)?.parentLineageId
                        !== consumed?.lineageId
                ) failures.push(`fork_lineage_parent_mismatch:${frontier.id}`);
                if (
                    frontier.birthMode === 'live_lateral_emission'
                    && lineages.get(frontier.lineageId)?.birthEvent
                        === event.sequence
                    && lineages.get(frontier.lineageId)?.parentLineageId
                        !== consumed?.lineageId
                ) failures.push(`lateral_lineage_parent_mismatch:${frontier.id}`);
                if (
                    !Number.isInteger(frontier.episode.commitmentDuration)
                    || frontier.episode.commitmentDuration < 1
                    || frontier.episode.semantics !== EPISODE_SEMANTICS
                ) failures.push(`invalid_episode:${frontier.id}`);
                if (
                    !Number.isInteger(frontier.axisStepLimit)
                    || frontier.axisStepLimit < (
                        frontier.maturationState === 'pruned_meristem_trace' ? 1 : 2
                    )
                    || !Number.isInteger(frontier.axisHardLimit)
                    || frontier.axisHardLimit < frontier.axisStepLimit
                    || frontier.axisAge > frontier.axisHardLimit
                ) failures.push(`invalid_axis_lifecycle_limit:${frontier.id}`);
                if (!validScaffoldFamilyGesture(
                    frontier.scaffoldFamilyGesture,
                    frontier.axisOrder,
                )) failures.push(`invalid_scaffold_family_gesture:${frontier.id}`);
                if (
                    !validScaffoldFamilyDominanceClaim(
                        frontier.scaffoldFamilyDominanceClaim,
                    )
                    || (frontier.scaffoldFamilyDominanceClaim
                        && (
                            frontier.axisOrder < 2
                            || frontier.scaffoldFamilyDominanceClaim
                                .carrierLineageId !== frontier.lineageId
                            || lineages.get(frontier.lineageId)
                                ?.scaffoldFamilyDominanceClaim?.claimId
                                    !== frontier.scaffoldFamilyDominanceClaim.claimId
                        ))
                ) failures.push(
                    `invalid_scaffold_family_dominance_claim:${frontier.id}`,
                );
                if (
                    !Number.isFinite(frontier.resourceReserve)
                    || frontier.resourceReserve < 0
                    || !Number.isFinite(frontier.reiterationReserve)
                    || frontier.reiterationReserve < 0
                    || !Number.isFinite(frontier.constructionReserve)
                    || frontier.constructionReserve < 0
                    || !Number.isInteger(frontier.forkDeferralCount)
                    || frontier.forkDeferralCount < 0
                    || !Number.isFinite(frontier.maintenanceDebt)
                    || frontier.maintenanceDebt < 0
                    || !Number.isFinite(frontier.developmentalCapacity)
                    || frontier.developmentalCapacity <= 0
                    || !Number.isFinite(frontier.supportAllocation)
                    || frontier.supportAllocation <= 0
                    || !Number.isFinite(frontier.extensionAllocation)
                    || frontier.extensionAllocation <= 0
                    || !Number.isFinite(frontier.lateralMeristemReserve)
                    || frontier.lateralMeristemReserve < 0
                    || !Number.isFinite(frontier.reiterationPotential)
                    || frontier.reiterationPotential <= 0
                    || !Number.isFinite(frontier.restUntilEvent)
                ) failures.push(`invalid_resource_account:${frontier.id}`);
                const state = frontier.developmentState;
                if (
                    !state
                    || state.semantics !== AXIS_DEVELOPMENT_STATE_SEMANTICS
                    || !Number.isFinite(state.reiterationCredit)
                    || state.reiterationCredit < 0
                    || state.reiterationCredit > 2.2
                    || !Number.isFinite(state.continuationCredit)
                    || state.continuationCredit < 0
                    || state.continuationCredit > 1.4
                    || !Number.isFinite(state.transportBurden)
                    || state.transportBurden < 0
                    || state.transportBurden > 1.8
                    || !Number.isFinite(state.familyFlowMemory)
                    || state.familyFlowMemory < -1
                    || state.familyFlowMemory > 1
                ) failures.push(`invalid_axis_development_state:${frontier.id}`);
                if (
                    !validGrowthUnit(frontier.growthUnit)
                    || frontier.growthUnit.lineageId !== frontier.lineageId
                    || frontier.growthUnit.tier !== frontier.axisOrder
                    || frontier.growthUnit.relativeDifferentiation?.semantics
                        !== RELATIVE_DIFFERENTIATION_SEMANTICS
                ) failures.push(`invalid_growth_unit:${frontier.id}`);
                const meristemCadence = frontier.meristemCadence;
                if (
                    meristemCadence
                    && (
                        meristemCadence.semantics
                            !== MERISTEM_CADENCE_SEMANTICS
                        || !Number.isFinite(meristemCadence.arcSinceRelease)
                        || meristemCadence.arcSinceRelease < 0
                        || !Number.isFinite(meristemCadence.targetGapLength)
                        || meristemCadence.targetGapLength <= 0
                        || !Number.isFinite(meristemCadence.releaseThreshold)
                        || meristemCadence.releaseThreshold <= 0
                        || ![-1, 0, 1].includes(meristemCadence.occupiedSide)
                        || !Number.isFinite(meristemCadence.investment)
                        || meristemCadence.investment < 0
                        || meristemCadence.investment > 1
                        || !Number.isFinite(meristemCadence.strength)
                        || meristemCadence.strength < 0
                        || meristemCadence.strength > 1
                        || !Number.isFinite(meristemCadence.clearanceLength)
                        || meristemCadence.clearanceLength <= 0
                        || meristemCadence.ontogeny?.semantics
                            !== ONTOGENY_SEMANTICS
                        || !validStationArchitectureReceipt(
                            meristemCadence.stationArchitectureProfile,
                        )
                    )
                ) failures.push(`invalid_meristem_cadence:${frontier.id}`);
                const portfolio = frontier.constructionPortfolio;
                if (
                    !portfolio
                    || portfolio.semantics
                        !== 'phyllotactic_continuous_axis_portfolio_v10'
                    || !validCrownArchitectureProfile(
                        portfolio.architectureProfile,
                    )
                    || !Number.isInteger(portfolio.plannedInternodeCount)
                    || portfolio.plannedInternodeCount < 1
                    || !Number.isInteger(portfolio.cursor)
                    || portfolio.cursor < 0
                    || portfolio.cursor > portfolio.plannedInternodeCount
                    || !Array.isArray(portfolio.plannedStepBudgets)
                    || portfolio.plannedStepBudgets.length
                        !== portfolio.plannedInternodeCount
                    || portfolio.plannedStepBudgets.some(
                        (budget) => !Number.isFinite(budget) || budget < 0,
                    )
                    || !Number.isFinite(portfolio.descendantConstructionBudget)
                    || portfolio.descendantConstructionBudget < 0
                    || !Number.isFinite(portfolio.lateralConstructionBudget)
                    || portfolio.lateralConstructionBudget < 0
                    || !Number.isFinite(portfolio.birthJunctionInvestment)
                    || portfolio.birthJunctionInvestment < 0
                    || portfolio.birthJunctionInvestment > 1
                    || !Number.isFinite(
                        portfolio.birthJunctionClearanceBias,
                    )
                    || portfolio.birthJunctionClearanceBias < 0
                    || portfolio.birthJunctionClearanceBias > 1
                    || !Number.isInteger(portfolio.lateralReleaseCapacity)
                    || portfolio.lateralReleaseCapacity < 0
                    || !Number.isInteger(portfolio.lateralReleasesCommitted)
                    || portfolio.lateralReleasesCommitted < 0
                    || portfolio.lateralReleasesCommitted
                        > portfolio.lateralReleaseCapacity
                ) failures.push(`invalid_construction_portfolio:${frontier.id}`);
                const releaseStations = Array.isArray(
                    portfolio?.lateralReleaseStations,
                ) ? [...portfolio.lateralReleaseStations].sort(
                        (left, right) => left - right,
                    ) : [];
                const releaseProgresses = portfolio?.lateralReleaseProgresses;
                const inheritedArcTiming = portfolio?.lateralTimingMode
                    === 'inherited_axis_family_arc_readiness';
                const physicalAxisTiming = portfolio?.lateralTimingMode === 'physical_axis_distance';
                if (
                    (!inheritedArcTiming
                        && !physicalAxisTiming
                        && releaseStations.length !== portfolio?.lateralReleaseCapacity)
                    || (inheritedArcTiming && releaseStations.length !== 0)
                    || (physicalAxisTiming && (releaseStations.length !== 0 || !validZenG15AxisDevelopment(portfolio)))
                    || !Array.isArray(releaseProgresses)
                    || releaseProgresses.length !== releaseStations.length
                    || releaseStations.some((station, index) => (
                        !Number.isInteger(station)
                        || station < 2
                        || station >= portfolio.plannedInternodeCount
                        || (index > 0 && station - releaseStations[index - 1] < 2)
                        || Math.abs(
                            releaseProgresses[index]
                                - station / portfolio.plannedInternodeCount
                        ) > 1e-7
                    ))
                    || ![-1, 0, 1].includes(portfolio?.lastLateralSide)
                    || (
                        portfolio?.lastLateralProgress !== null
                        && (
                            !Number.isFinite(portfolio.lastLateralProgress)
                            || portfolio.lastLateralProgress < 0
                            || portfolio.lastLateralProgress > 1
                        )
                    )
                    || (
                        Number(portfolio?.growthCycle || 0) > 0
                        && portfolio.plannedInternodeCount < 2
                    )
                ) failures.push(`invalid_phyllotactic_portfolio:${frontier.id}`);
                active.add(frontierId);
            });
            (event.createdCorridorIds || []).forEach((corridorId) => {
                const corridor = corridors.get(corridorId);
                if (!corridor) {
                    failures.push(`missing_corridor:${event.id}:${corridorId}`);
                    return;
                }
                if (
                    corridor.reservedAtEvent !== event.sequence
                    || !Number.isInteger(corridor.horizon)
                    || corridor.horizon < 1
                    || corridor.points.length !== corridor.horizon + 1
                    || !event.createdFrontierIds.includes(corridor.frontierId)
                ) failures.push(`invalid_prospective_corridor:${corridorId}`);
                activeCorridors.add(corridorId);
            });
            if (event.createdFrontierIds.length !== (event.createdCorridorIds || []).length) {
                failures.push(`frontier_corridor_atomicity:${event.id}`);
            }
            if (JSON.stringify([...active].sort())
                !== JSON.stringify(event.activeFrontierIdsAfter)) {
                failures.push(`active_snapshot_mismatch:${event.id}`);
            }
            if (JSON.stringify([...activeCorridors].sort())
                !== JSON.stringify(event.activeCorridorIdsAfter || [])) {
                failures.push(`active_corridor_snapshot_mismatch:${event.id}`);
            }
        });
        graph.occupancy.forEach((occupied) => {
            const segment = segments.get(occupied.segmentId);
            if (!segment || occupied.registeredAtEvent !== segment.birthEvent) {
                failures.push(`occupancy_not_atomic:${occupied.segmentId}`);
            }
        });
        const orderZeroSupport = factorGraphSupport(PRESETS[graph.preset]?.orderZeroSupport,graph);
        if (orderZeroSupport) {
            const resolvedMaximumLeanRadians = Number(
                graph.contract.orderZeroSupportResolvedMaximumLeanDegrees,
            ) * Math.PI / 180;
            graph.segments.filter((segment) => segment.axisOrder === 0).forEach((segment) => {
                const start = nodes.get(segment.fromNodeId)?.point;
                const end = nodes.get(segment.toNodeId)?.point;
                if (!start || !end) return;
                const heading = normalize(subtract(end, start));
                if (
                    angularDistance({ x: 0, y: 1, z: 0 }, heading)
                        > resolvedMaximumLeanRadians + 1e-6
                ) failures.push(`order_zero_gravity_support_violation:${segment.id}`);
            });
        }
        graph.clusters.forEach((cluster) => {
            if (
                cluster.semantics !== CLUSTER_SEMANTICS
                || !Number.isFinite(cluster.radius)
                || cluster.radius <= 0
                || !cluster.center
                || !Number.isInteger(cluster.capacity)
                || cluster.capacity < 1
                || !validScaffoldFamilyGesture(
                    cluster.familyGesture,
                    cluster.tier,
                )
                || !cluster.envelope
                || !vectorValid(cluster.envelope.majorAxis)
                || !vectorValid(cluster.envelope.flowAxis)
                || !vectorValid(cluster.envelope.depthAxis)
                || !Number.isFinite(cluster.envelope.majorRadius)
                || !Number.isFinite(cluster.envelope.minorRadius)
                || !Number.isFinite(cluster.envelope.depthRadius)
                || cluster.envelope.majorRadius <= cluster.envelope.minorRadius
                || cluster.envelope.minorRadius <= 0
                || cluster.envelope.depthRadius <= 0
            ) failures.push(`invalid_terminal_cluster:${cluster.id}`);
        });
        graph.lateralMeristems.forEach((meristem) => {
            const temporaryShapeValid = meristem.temporaryAxis
                ? meristem.developmentalRole === 'juvenile_sacrifice_axis'
                    && validJuvenileShootOpportunity(
                        meristem.juvenileShootOpportunity,
                    )
                    && meristem.juvenileShootOpportunity.eligible
                    && meristem.structuralReleaseReadiness?.eligible === false
                : meristem.developmentalRole === 'permanent_scaffold_axis';
            if (
                meristem.semantics !== LATERAL_MERISTEM_SEMANTICS
                || !nodes.has(meristem.nodeId)
                || !lineages.has(meristem.parentLineageId)
                || !['registered', 'emitted', 'suppressed'].includes(meristem.status)
                || (meristem.status === 'emitted' && !meristem.emissionLineageId)
                || !validLiveLateralFeasibility(
                    meristem.structuralReleaseReadiness,
                )
                || !validCrownInteriorExposure(
                    meristem.crownInteriorExposure,
                )
                || (meristem.crownInteriorExposure.applicable
                    && meristem.childAxisOrder !== 2)
                || !temporaryShapeValid
            ) failures.push(`invalid_lateral_meristem:${meristem.id}`);
        });
        const juvenileRetirements = Array.isArray(
            graph.juvenileAxisRetirements,
        ) ? graph.juvenileAxisRetirements : [];
        if (!Array.isArray(graph.juvenileAxisRetirements)) {
            failures.push('missing_juvenile_axis_retirement_ledger');
        }
        const retirementByLineage = new Map();
        juvenileRetirements.forEach((retirement) => {
            const lineage = lineages.get(retirement.lineageId);
            const sourceMeristem = graph.lateralMeristems.find(
                (meristem) => meristem.id === retirement.sourceMeristemId,
            );
            const exactSegmentIds = lineage?.segmentIds || [];
            const exactSegments = exactSegmentIds.map(
                (segmentId) => segments.get(segmentId),
            ).filter(Boolean);
            const exactTotalLength = sum(exactSegments.map(
                (segment) => Number(segment.length || 0),
            ));
            const expectedCambialContribution = clamp(
                exactTotalLength * Number(lineage?.birthResourceShare || 0.14)
                    / 140,
                0.035,
                0.18,
            );
            const retirementEvent = events.get(retirement.retiredAtEvent);
            if (
                retirement.semantics !== JUVENILE_AXIS_RETIREMENT_SEMANTICS
                || retirementByLineage.has(retirement.lineageId)
                || lineage?.temporaryAxis !== true
                || lineage.developmentalRole !== 'juvenile_sacrifice_axis'
                || lineage.parentLineageId !== retirement.parentLineageId
                || lineage.endEvent !== retirement.retiredAtEvent
                || lineage.endKind !== retirement.reason
                || retirement.reason !== 'juvenile_axis_training_retirement'
                || retirement.retiredAtEvent <= retirement.emittedAtEvent
                || !Array.isArray(retirement.segmentIds)
                || retirement.segmentIds.length !== exactSegmentIds.length
                || retirement.segmentIds.some(
                    (segmentId, index) => segmentId !== exactSegmentIds[index],
                )
                || exactSegments.some((segment) => (
                    !segment.temporaryAxis
                    || segment.developmentalRole
                        !== 'juvenile_sacrifice_axis'
                ))
                || sourceMeristem?.emissionLineageId !== retirement.lineageId
                || sourceMeristem?.retiredAtEvent !== retirement.retiredAtEvent
                || !Number.isFinite(retirement.totalLength)
                || retirement.totalLength <= 0
                || Math.abs(retirement.totalLength - exactTotalLength) > 2e-5
                || !Number.isFinite(retirement.cambialContribution)
                || retirement.cambialContribution < 0.035
                || retirement.cambialContribution > 0.18
                || Math.abs(
                    retirement.cambialContribution
                        - expectedCambialContribution,
                ) > 2e-5
                || retirementEvent?.kind !== 'terminate'
                || retirementEvent.reason
                    !== 'juvenile_axis_training_retirement'
                || retirementEvent.juvenileAxisRetirement?.lineageId
                    !== retirement.lineageId
            ) failures.push(
                `invalid_juvenile_axis_retirement:${retirement.lineageId}`,
            );
            retirementByLineage.set(retirement.lineageId, retirement);
        });
        graph.lineages.filter((lineage) => lineage.temporaryAxis).forEach(
            (lineage) => {
                const matching = retirementByLineage.get(lineage.id);
                if (
                    lineage.endKind === 'juvenile_axis_training_retirement'
                    && !matching
                ) failures.push(
                    `missing_juvenile_axis_retirement:${lineage.id}`,
                );
                if (
                    graph.splits.some(
                        (split) => split.parentLineageId === lineage.id,
                    )
                    || graph.lateralMeristems.some(
                        (meristem) => meristem.parentLineageId === lineage.id,
                    )
                ) failures.push(
                    `juvenile_axis_created_descendant:${lineage.id}`,
                );
            },
        );
        (graph.nodeMeristemSites || []).forEach((site) => {
            if (
                site.semantics !== NODE_MERISTEM_SEMANTICS
                || !nodes.has(site.nodeId)
                || (
                    site.structuralForkEvent !== null
                    && site.emittedLateralMeristemId !== null
                )
                || site.suppressedLateralMeristemIds.some((meristemId) => (
                    !graph.lateralMeristems.some((meristem) => (
                        meristem.id === meristemId
                        && meristem.status === 'suppressed'
                    ))
                ))
            ) failures.push(`invalid_node_meristem_site:${site.nodeId}`);
        });
        graph.frontiers.forEach((frontier) => {
            if (frontier.clusterId && !clusters.has(frontier.clusterId)) {
                failures.push(`missing_frontier_cluster:${frontier.id}`);
            }
            const state = frontier.developmentState;
            const continuousFields = [
                'apicalContinuity',
                'supportInvestment',
                'extensionDrive',
                'reiterationReadiness',
                'reiterationThreshold',
                'lateralCompetence',
                'loadMoment',
                'accumulatedLength',
                'maturity',
                'stressMemory',
                'exposureMemory',
                'terminalAffinity',
            ];
            if (
                !state
                || state.semantics !== AXIS_DEVELOPMENT_STATE_SEMANTICS
                || state.axisOrder !== frontier.axisOrder
                || continuousFields.some((field) => !Number.isFinite(state[field]))
            ) failures.push(`invalid_axis_development_state:${frontier.id}`);
            if (
                !validScaffoldFamilyDominanceClaim(
                    frontier.scaffoldFamilyDominanceClaim,
                )
                || (frontier.scaffoldFamilyDominanceClaim
                    && frontier.scaffoldFamilyDominanceClaim.carrierLineageId
                        !== frontier.lineageId)
            ) failures.push(
                `invalid_scaffold_family_dominance_claim:${frontier.id}`,
            );
        });
        graph.lineages.forEach((lineage) => {
            if (lineage.clusterId && !clusters.has(lineage.clusterId)) {
                failures.push(`missing_lineage_cluster:${lineage.id}`);
            }
            const dominanceClaim = lineage.scaffoldFamilyDominanceClaim;
            const sourceScaffold = dominanceClaim
                ? lineages.get(dominanceClaim.sourceScaffoldLineageId)
                : null;
            const subordinateRoot = dominanceClaim
                ? lineages.get(dominanceClaim.subordinateRootLineageId)
                : null;
            let familyCursor = lineage;
            let belongsToSubordinateFamily = !dominanceClaim;
            while (dominanceClaim && familyCursor) {
                if (familyCursor.id === dominanceClaim.subordinateRootLineageId) {
                    belongsToSubordinateFamily = true;
                    break;
                }
                familyCursor = lineages.get(familyCursor.parentLineageId);
            }
            if (
                !validScaffoldFamilyDominanceClaim(
                    dominanceClaim,
                )
                || (dominanceClaim
                    && (
                        dominanceClaim.carrierLineageId !== lineage.id
                        || sourceScaffold?.axisOrder !== 1
                        || subordinateRoot?.parentLineageId
                            !== sourceScaffold?.id
                        || subordinateRoot?.axisOrder
                            <= sourceScaffold?.axisOrder
                        || !belongsToSubordinateFamily
                    ))
            ) failures.push(
                `invalid_scaffold_family_dominance_claim:${lineage.id}`,
            );
        });
        graph.segments.forEach((segment) => {
            const lineageClaim = lineages.get(segment.lineageId)
                ?.scaffoldFamilyDominanceClaim || null;
            const expectedScale = resolveScaffoldFamilyDominance(lineageClaim)
                ?.terminalLoadScale ?? 1;
            if (
                segment.scaffoldFamilyDominanceClaimId
                    !== (lineageClaim?.claimId || null)
                || !Number.isFinite(segment.scaffoldFamilyTerminalLoadScale)
                || Math.abs(
                    segment.scaffoldFamilyTerminalLoadScale - expectedScale
                ) > 2e-5
            ) failures.push(
                `invalid_scaffold_family_segment_continuity:${segment.id}`,
            );
        });
        graph.lineages.forEach((lineage) => {
            if (!validScaffoldFamilyGesture(
                lineage.scaffoldFamilyGesture,
                lineage.axisOrder,
            )) failures.push(`invalid_lineage_family_gesture:${lineage.id}`);
            const lineageFrontiers = graph.frontiers.filter(
                (frontier) => frontier.lineageId === lineage.id,
            );
            if (lineageFrontiers.some((frontier) => (
                (frontier.scaffoldFamilyGesture?.gestureId || null)
                    !== (lineage.scaffoldFamilyGesture?.gestureId || null)
            ))) failures.push(`scaffold_family_gesture_drift:${lineage.id}`);
        });
        [...graph.segments, ...graph.frontiers, ...graph.lineages].forEach((record) => {
            if (
                !Number.isInteger(record.axisOrder)
                || record.axisOrder < 0
                || record.axisOrder > 2
                || record.tier !== record.axisOrder
                || record.axisOrderName !== axisOrderNameFor(record.axisOrder)
                || record.tierRole !== tierRoleFor(record.axisOrder)
                || !record.birthMode
                || (record.temporaryAxis
                    && record.developmentalRole
                        !== 'juvenile_sacrifice_axis')
            ) failures.push(`invalid_axis_identity:${record.id}`);
        });
        graph.developmentReceipts
            .filter((receipt) => receipt.kind === 'live_lateral_axis_emission')
            .forEach((receipt) => {
                const junction = receipt.junctionPlan;
                const meristem = graph.lateralMeristems.find(
                    (candidate) => candidate.id === receipt.meristemId,
                );
                const requiresStructuralStation = meristem?.parentTier === 0
                    && meristem.childAxisOrder === 1
                    && !meristem.temporaryAxis;
                const interiorExposure = receipt.crownInteriorExposure;
                const familyGesture = receipt.scaffoldFamilyGesture || null;
                const crownBirthOpportunity =
                    receipt.crownBirthOpportunity || null;
                const scaffoldDominanceClaim =
                    receipt.scaffoldFamilyDominanceClaim || null;
                const scaffoldDominance = resolveScaffoldFamilyDominance(
                    scaffoldDominanceClaim,
                );
                if (
                    !junction
                    || junction.semantics !== LATERAL_JUNCTION_SEMANTICS
                    || Math.abs(
                        junction.continuationArea + junction.lateralArea
                            - junction.committedArea,
                    ) > Math.max(1e-5, junction.committedArea * 1e-5)
                    || junction.continuationRadius <= 0
                    || junction.lateralRadius <= 0
                    || !validCrownInteriorExposure(interiorExposure)
                    || !Number.isFinite(receipt.interiorBridgeBlend)
                    || receipt.interiorBridgeBlend < 0
                    || receipt.interiorBridgeBlend > 0.14 + 1e-8
                    || (receipt.interiorBridgeBlend > 0
                        && !interiorExposure.applicable)
                    || !validScaffoldFamilyGesture(
                        familyGesture,
                        receipt.developmentState?.axisOrder,
                    )
                    || !validCrownBirthOpportunity(
                        crownBirthOpportunity,
                        familyGesture,
                    )
                    || crownBirthOpportunity.interiorBlend
                        !== receipt.interiorBridgeBlend
                    || !validScaffoldFamilyDominanceClaim(
                        scaffoldDominanceClaim,
                    )
                    || (scaffoldDominanceClaim
                        && scaffoldDominanceClaim.carrierLineageId
                            !== receipt.lineageId)
                    || receipt.scaffoldFamilyDominance?.claimId
                        !== (scaffoldDominance?.claimId || undefined)
                    || !validRelativeDifferentiation(
                        receipt.relativeDifferentiation,
                        receipt.developmentState?.axisOrder,
                    )
                    || (requiresStructuralStation
                        && !validStructuralStation(
                            receipt.structuralStation,
                            'live_lateral',
                        ))
                ) failures.push(`invalid_lateral_junction:${receipt.meristemId}`);
            });
        graph.developmentReceipts
            .filter((receipt) => receipt.kind === 'extension_maturation')
            .forEach((receipt) => {
                const consumedFrontier = frontiers.get(receipt.frontierId);
                const expectedDominance = resolveScaffoldFamilyDominance(
                    consumedFrontier?.scaffoldFamilyDominanceClaim,
                );
                const readiness = receipt.reiterationReadiness;
                if (
                    receipt.scaffoldFamilyDominance?.claimId
                        !== (expectedDominance?.claimId || undefined)
                    || !readiness
                    || readiness.semantics
                        !== 'scaffold_dominance_aware_reiteration_readiness_v1'
                    || readiness.scaffoldFamilyDominance?.claimId
                        !== (expectedDominance?.claimId || undefined)
                    || !Number.isFinite(readiness.historyAdjustedThreshold)
                    || !Number.isFinite(readiness.effectiveThreshold)
                    || !Number.isFinite(readiness.thresholdIncrease)
                    || Math.abs(
                        readiness.effectiveThreshold
                            - readiness.historyAdjustedThreshold
                            - readiness.thresholdIncrease
                    ) > 2e-5
                    || Math.abs(
                        readiness.thresholdIncrease
                            - Number(
                                expectedDominance?.reiterationThresholdBoost || 0,
                            )
                    ) > 2e-5
                ) failures.push(
                    `invalid_scaffold_dominance_readiness:${receipt.frontierId}`,
                );
                const priorNextForkAge = Number(receipt.priorNextForkAge);
                const resolvedNextForkAge = Number(receipt.resolvedNextForkAge);
                const cadence = receipt.forkCadence;
                const cadenceActive = cadence?.active === true;
                const event = events.get(receipt.sequence);
                const continuation = (event?.createdFrontierIds || [])
                    .map((frontierId) => frontiers.get(frontierId))
                    .find((frontier) => (
                        frontier?.lineageId === receipt.lineageId
                    ));
                let clockValid = Number.isInteger(priorNextForkAge)
                    && priorNextForkAge >= 0
                    && Number.isInteger(resolvedNextForkAge)
                    && resolvedNextForkAge >= 0
                    && event?.consumedFrontierId === receipt.frontierId
                    && continuation?.nextForkAge === resolvedNextForkAge;
                if (cadenceActive) {
                    const cadenceNextForkAge = Number(
                        receipt.cadenceNextForkAge,
                    );
                    clockValid = clockValid
                        && cadence.semantics === MERISTEM_CADENCE_SEMANTICS
                        && cadence.clockOwner
                            === 'post_lateral_visible_scaffold_cadence'
                        && cadence.resolution
                            === 'post_lateral_cadence_replaced_prior_schedule'
                        && receipt.forkClockOwner === cadence.clockOwner
                        && receipt.forkClockResolution === cadence.resolution
                        && Number.isInteger(cadenceNextForkAge)
                        && cadenceNextForkAge === cadence.nextForkAge
                        && cadenceNextForkAge === cadence.resolvedNextForkAge
                        && cadenceNextForkAge === resolvedNextForkAge
                        && cadence.priorNextForkAge === priorNextForkAge
                        && cadenceNextForkAge === continuation.axisAge
                            + cadence.appliedGapInternodes;
                } else {
                    const expectedResolvedAge = priorNextForkAge
                        + (receipt.forkDeferred ? 1 : 0);
                    const expectedResolution = receipt.forkDeferred
                        ? 'prior_axis_clock_deferred'
                        : 'prior_axis_clock_retained';
                    clockValid = clockValid
                        && receipt.cadenceNextForkAge === null
                        && receipt.forkClockOwner === 'prior_axis_schedule'
                        && receipt.forkClockResolution === expectedResolution
                        && resolvedNextForkAge === expectedResolvedAge
                        && (!cadence || (
                            cadence.semantics === MERISTEM_CADENCE_SEMANTICS
                            && cadence.active === false
                            && cadence.clockOwner === 'prior_axis_schedule'
                            && cadence.resolution === expectedResolution
                            && cadence.resolvedNextForkAge
                                === resolvedNextForkAge
                        ));
                }
                if (!clockValid) {
                    failures.push(
                        `invalid_visible_scaffold_fork_clock:${receipt.sequence}`,
                    );
                }
            });
        graph.splits.forEach((split) => {
            const parentLineage = lineages.get(split.parentLineageId);
            if (!parentLineage) failures.push(`missing_split_parent:${split.id}`);
            if (!validSuccessionKink(split.successionKink, split.children.length)) {
                failures.push(`invalid_succession_kink_receipt:${split.id}`);
            }
            split.children.forEach((child) => {
                const childLineage = lineages.get(child.lineageId);
                if (childLineage?.parentLineageId !== split.parentLineageId) {
                    failures.push(`split_child_lineage_mismatch:${split.id}:${child.lineageId}`);
                }
                if (
                    !validScaffoldFamilyGesture(
                        child.scaffoldFamilyGesture,
                        child.axisOrder,
                    )
                    || (child.axisOrder > 0
                        && !validCrownBirthOpportunity(
                            child.crownBirthOpportunity,
                            child.scaffoldFamilyGesture,
                        ))
                    || (child.scaffoldFamilyGesture?.gestureId || null)
                        !== (childLineage?.scaffoldFamilyGesture?.gestureId || null)
                ) failures.push(
                    `invalid_split_crown_composition:${split.id}:${child.lineageId}`,
                );
                const actuallyReforked = graph.events.some((event) => (
                    event.kind === 'fork'
                    && frontiers.get(event.consumedFrontierId)?.lineageId === child.lineageId
                ));
                if (actuallyReforked !== child.laterReforked) {
                    failures.push(`refork_receipt_mismatch:${split.id}:${child.lineageId}`);
                }
            });
        });
        if (graph.contract.precomputedRoute !== false) {
            failures.push('precomputed_route_enabled');
        }
        if (graph.phenotype.semantics !== PHENOTYPE_SEMANTICS) {
            failures.push('missing_seed_once_phenotype');
        }
        if (
            graph.strategy?.semantics !== STRATEGY_SEMANTICS
            || graph.contract.strategySemantics !== STRATEGY_SEMANTICS
            || graph.contract.strategyBasisSemantics !== BASIS_SEMANTICS
        ) failures.push('missing_developmental_strategy_semantics');
        if (
            !validArchitectureControls(graph.architectureControls)
            || graph.contract.crownArchitectureControlSemantics
                !== CROWN_ARCHITECTURE_CONTROL_SEMANTICS
            || graph.contract.crownArchitectureProfileSemantics
                !== CROWN_ARCHITECTURE_PROFILE_SEMANTICS
        ) failures.push('invalid_crown_architecture_controls');
        const architectureProfiles = [
            ...graph.frontiers.flatMap((frontier) => [
                frontier.constructionPortfolio?.architectureProfile,
                frontier.meristemCadence?.stationArchitectureProfile
                    ?.architectureProfile,
            ]),
            ...graph.splits.flatMap((split) => [
                split.childDevelopmentBudget?.architectureProfile,
                split.successionKink?.architectureProfile,
                ...Array.from(split.childDevelopmentBudget?.children || [])
                    .map((child) => child.architectureProfile),
            ]),
            ...graph.lateralMeristems.flatMap((meristem) => [
                meristem.crownInteriorExposure?.architectureProfile,
            ]),
        ].filter(Boolean);
        if (architectureProfiles.some((profile) => (
            !architectureProfileMatchesControls(
                graph.architectureControls,
                profile,
            )
        ))) failures.push('crown_architecture_profile_control_mismatch');
        const knownStrategyAxes = new Set(STRATEGY_AXIS_IDS);
        if (
            !Array.isArray(graph.strategy?.enabledAxes)
            || graph.strategy.enabledAxes.some((axisId) => !knownStrategyAxes.has(axisId))
        ) failures.push('invalid_developmental_strategy_axes');
        (graph.strategyReceipts || []).forEach((receipt, index) => {
            const field = receipt.field;
            if (
                receipt.kind !== 'fork_schedule'
                || !field
                || field.semantics !== STRATEGY_SEMANTICS
                || field.axisId !== 'fork_rhythm'
                || !Number.isInteger(receipt.scheduledAge)
                || !Object.values(field.effect || {}).every(Number.isFinite)
            ) failures.push(`invalid_strategy_receipt:${index}`);
        });
        if (graph.contract.resourceEconomySemantics !== RESOURCE_ECONOMY_SEMANTICS) {
            failures.push('missing_resource_economy');
        }
        if (
            graph.contract.meristemCadenceSemantics
                !== MERISTEM_CADENCE_SEMANTICS
            || graph.contract.visibleScaffoldPermissionSemantics
                !== VISIBLE_SCAFFOLD_PERMISSION_SEMANTICS
            || graph.contract.visibleScaffoldLivenessSemantics
                !== VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS
            || graph.contract.liveLateralFeasibilitySemantics
                !== LIVE_LATERAL_FEASIBILITY_SEMANTICS
            || graph.contract.ontogenySemantics !== ONTOGENY_SEMANTICS
            || graph.contract.crownBaseCompetenceSemantics
                !== CROWN_BASE_COMPETENCE_SEMANTICS
            || graph.contract.juvenileShootOpportunitySemantics
                !== JUVENILE_SHOOT_OPPORTUNITY_SEMANTICS
            || graph.contract.juvenileAxisRetirementSemantics
                !== JUVENILE_AXIS_RETIREMENT_SEMANTICS
            || graph.contract.visibleScaffoldLivenessMaximumScoreBoost !== 0.25
            || graph.contract.visibleScaffoldDeferredServicePolicy
                !== 'preserve_due_fork_priority_while_permission_defers_mutation'
        ) failures.push('missing_visible_scaffold_liveness_semantics');
        if (
            graph.contract.tierArchitectureSemantics
                !== TIER_ARCHITECTURE_SEMANTICS
            || graph.contract.structuralStationSemantics
                !== STRUCTURAL_STATION_SEMANTICS
            || graph.contract.scaffoldStationTrajectorySemantics
                !== STATION_TRAJECTORY_SEMANTICS
            || graph.contract.relativeDifferentiationSemantics
                !== RELATIVE_DIFFERENTIATION_SEMANTICS
            || graph.contract.axisOrderAuthority
                !== 'role_authoritative_three_tier'
        ) failures.push('missing_three_tier_architecture_semantics');
        if (
            graph.contract.growthUnitSemantics !== GROWTH_UNIT_SEMANTICS
            || graph.contract.growthUnitReceiptSemantics
                !== GROWTH_UNIT_RECEIPT_SEMANTICS
            || graph.contract.apicalDifferentiationSemantics
                !== APICAL_DIFFERENTIATION_SEMANTICS
            || !Array.isArray(graph.growthUnitReceipts)
        ) failures.push('missing_growth_unit_semantics');
        if (
            graph.contract.resourceContrastDampingSemantics
                !== 'distal_resource_contrast_damping_v1'
            || (Object.hasOwn(graph.contract,'forkAllocationStrength')
                ? !(Number.isFinite(graph.contract.forkAllocationStrength)
                    && graph.contract.forkAllocationStrength>0&&graph.contract.forkAllocationStrength<=1
                    && graph.contract.forkFlowDirectionSemantics===ZEN_G15_JOINT_FLOW)
                : graph.contract.forkFlowDirectionSemantics!==ZEN_G15_SEPARATE_FLOW)
        ) failures.push('missing_resource_direction_separation_semantics');
        if (Array.isArray(graph.growthUnitReceipts)) {
            const createdByUnit = new Map();
            const closedByUnit = new Map();
            graph.growthUnitReceipts.forEach((receipt) => {
                if (
                    receipt.semantics !== GROWTH_UNIT_RECEIPT_SEMANTICS
                    || !nonEmptyString(receipt.growthUnitId)
                    || !nonEmptyString(receipt.lineageId)
                    || !['created', 'completed', 'terminalized']
                        .includes(receipt.phase)
                    || !Number.isInteger(receipt.sequence)
                    || receipt.sequence < 0
                    || !Number.isInteger(receipt.ordinal)
                    || receipt.ordinal < 0
                    || !Number.isInteger(receipt.tier)
                    || receipt.tier < 0
                    || receipt.tier > 2
                    || !Number.isInteger(receipt.plannedInternodeCount)
                    || receipt.plannedInternodeCount < 1
                    || !Number.isInteger(receipt.realizedInternodeCount)
                    || receipt.realizedInternodeCount < 0
                    || !Number.isFinite(receipt.realizedLength)
                    || receipt.realizedLength < 0
                    || !Number.isFinite(receipt.differentiationCredit)
                    || !Number.isFinite(receipt.differentiationThreshold)
                    || !Number.isFinite(receipt.reservedDescendantConstruction)
                    || receipt.reservedDescendantConstruction < 0
                    || !(
                        receipt.pendingApicalIntentId === null
                        || nonEmptyString(receipt.pendingApicalIntentId)
                    )
                    || !nonEmptyString(receipt.endpointFate)
                ) failures.push(`invalid_growth_unit_receipt:${receipt.growthUnitId}`);
                const target = receipt.phase === 'created'
                    ? createdByUnit
                    : closedByUnit;
                if (target.has(receipt.growthUnitId)) {
                    failures.push(`duplicate_growth_unit_${receipt.phase}:${receipt.growthUnitId}`);
                }
                target.set(receipt.growthUnitId, receipt);
            });
            graph.frontiers.forEach((frontier) => {
                if (!createdByUnit.has(frontier.growthUnit?.id)) {
                    failures.push(`missing_growth_unit_creation:${frontier.id}`);
                }
            });
            const finalActiveIds = new Set(
                graph.events.at(-1)?.activeFrontierIdsAfter || [],
            );
            finalActiveIds.forEach((frontierId) => {
                const frontier = frontiers.get(frontierId);
                if (closedByUnit.has(frontier?.growthUnit?.id)) {
                    failures.push(`closed_active_growth_unit:${frontierId}`);
                }
            });
            graph.events.forEach((event) => {
                if (event.kind === 'emerge') return;
                const consumed = frontiers.get(event.consumedFrontierId);
                const continuation = event.kind === 'advance'
                    ? event.createdFrontierIds
                        .map((frontierId) => frontiers.get(frontierId))
                        .find((frontier) => (
                            frontier?.lineageId === consumed?.lineageId
                        ))
                    : null;
                const unitEnded = event.kind === 'fork'
                    || event.kind === 'terminate'
                    || (continuation && continuation.growthUnit.id
                        !== consumed?.growthUnit?.id);
                const closure = closedByUnit.get(consumed?.growthUnit?.id);
                if (
                    unitEnded
                    && (
                        !closure
                        || closure.sequence !== event.sequence
                    )
                ) failures.push(`unclosed_growth_unit:${event.id}`);
            });
        }
        if (graph.contract.clusterSemantics !== CLUSTER_SEMANTICS) {
            failures.push('missing_terminal_cluster_semantics');
        }
        if (graph.contract.angleSemantics !== ANGLE_SEMANTICS) {
            failures.push('missing_mass_partition_angle_semantics');
        }
        if (graph.contract.balanceSemantics !== BALANCE_SEMANTICS) {
            failures.push('missing_future_balance_semantics');
        }
        if (
            graph.contract.crownInteriorExposureSemantics
                !== CROWN_INTERIOR_EXPOSURE_SEMANTICS
        ) failures.push('missing_crown_interior_exposure_semantics');
        if (
            graph.contract.crownCompositionSemantics
                !== CROWN_COMPOSITION_SEMANTICS
            || graph.contract.scaffoldFamilyGestureSemantics
                !== SCAFFOLD_FAMILY_GESTURE_SEMANTICS
            || graph.contract.crownBirthOpportunitySemantics
                !== CROWN_BIRTH_OPPORTUNITY_SEMANTICS
        ) failures.push('missing_crown_composition_semantics');
        if (
            graph.contract.scaffoldFamilyDominanceSemantics
                !== SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS
        ) failures.push('missing_scaffold_family_dominance_semantics');
        if (graph.contract.completionSemantics !== COMPLETION_SEMANTICS) {
            failures.push('missing_crown_completion_semantics');
        }
        if (graph.contract.axisSuccessionSemantics !== AXIS_SUCCESSION_SEMANTICS) {
            failures.push('missing_axis_succession_semantics');
        }
        if (graph.contract.orderZeroSupportSemantics !== ORDER_ZERO_SUPPORT_SEMANTICS) {
            failures.push('missing_order_zero_support_semantics');
        }
        if (
            graph.contract.lateralMeristemSemantics
                !== LATERAL_MERISTEM_SEMANTICS
        ) {
            failures.push('missing_live_lateral_meristem_semantics');
        }
        if (graph.contract.schedulerSemantics !== SCHEDULER_SEMANTICS) {
            failures.push('missing_typed_scheduler_semantics');
        }
        if (
            graph.contract.axisLifecycleSemantics !== AXIS_LIFECYCLE_SEMANTICS
            || graph.contract.schedulerOwnsAxisOutcome !== false
        ) failures.push('missing_local_axis_lifecycle_semantics');
        if (
            graph.contract.forkPotentialSemantics !== FORK_POTENTIAL_SEMANTICS
            || graph.contract.completionAuthority !== 'global_stop_only'
        ) failures.push('invalid_global_completion_authority');
        if (
            graph.contract.nodeMeristemSemantics !== NODE_MERISTEM_SEMANTICS
            || graph.contract.lineageResponseSemantics !== LINEAGE_RESPONSE_SEMANTICS
            || graph.contract.axisOrderSemantics !== AXIS_ORDER_SEMANTICS
            || graph.contract.axisDevelopmentStateSemantics
                !== AXIS_DEVELOPMENT_STATE_SEMANTICS
            || graph.contract.lateralJunctionSemantics
                !== LATERAL_JUNCTION_SEMANTICS
            || graph.contract.birthModeSemantics !== BIRTH_MODE_SEMANTICS
        ) failures.push('missing_axis_identity_or_meristem_semantics');
        if (
            graph.contract.familyResourceFlowSemantics
                !== 'conserved_parent_lineage_assimilate_flow_v1'
            || !Array.isArray(graph.familyResourceReceipts)
            || !Array.isArray(graph.familyResourceLedgers)
        ) {
            failures.push('missing_family_resource_flow_semantics');
        } else {
            const ledgerByLineage = new Map(graph.familyResourceLedgers.map(
                (entry) => [entry.lineageId, Number(entry.constructionReserve)],
            ));
            graph.familyResourceReceipts.forEach((receipt) => {
                if (
                    receipt.semantics
                        !== 'conserved_parent_lineage_assimilate_flow_v1'
                    || !Number.isInteger(receipt.sequence)
                    || receipt.sequence < 1
                    || !frontiers.has(receipt.frontierId)
                    || !lineages.has(receipt.lineageId)
                    || receipt.contribution < 0
                    || receipt.withdrawal < 0
                ) failures.push(`invalid_family_resource_receipt:${receipt.lineageId}`);
            });
            lineages.forEach((_, lineageId) => {
                const contributed = graph.familyResourceReceipts.reduce(
                    (total, receipt) => total + (
                        receipt.lineageId === lineageId
                            ? Number(receipt.contribution || 0)
                            : 0
                    ),
                    0,
                );
                const withdrawn = graph.familyResourceReceipts.reduce(
                    (total, receipt) => total + (
                        receipt.parentPoolId === lineageId
                            ? Number(receipt.withdrawal || 0)
                            : 0
                    ),
                    0,
                );
                const expected = Math.max(0, contributed - withdrawn);
                const actual = Number(ledgerByLineage.get(lineageId));
                if (
                    !Number.isFinite(actual)
                    || actual < 0
                    || Math.abs(actual - expected) > 2e-5
                ) failures.push(`family_resource_conservation_error:${lineageId}`);
            });
        }
        if (
            graph.proposalReceipts.length !== Math.max(0, graph.events.length - 1)
            || graph.proposalReceipts.some((receipt, index) => (
                receipt.sequence !== index + 1
                || receipt.semantics !== SCHEDULER_SEMANTICS
                || !Number.isFinite(receipt.score)
                || !Number.isFinite(receipt.scoreBeforeLiveness)
                || !Number.isFinite(receipt.visibleScaffoldLivenessPressure)
                || receipt.visibleScaffoldLivenessPressure < 0
                || receipt.visibleScaffoldLivenessPressure > 1
                || !Number.isFinite(receipt.visibleScaffoldLivenessScoreBoost)
                || receipt.visibleScaffoldLivenessScoreBoost < 0
                || receipt.visibleScaffoldLivenessScoreBoost
                    > graph.contract.visibleScaffoldLivenessMaximumScoreBoost
                || Math.abs(
                    receipt.score - (
                        receipt.scoreBeforeLiveness
                        + receipt.visibleScaffoldLivenessScoreBoost
                    ),
                ) > 2e-5
                || (receipt.visibleScaffoldLiveness
                    ? (
                        !validVisibleScaffoldLiveness(
                            receipt.visibleScaffoldLiveness,
                        )
                        || Math.abs(
                            receipt.visibleScaffoldLivenessPressure
                                - receipt.visibleScaffoldLiveness.pressure,
                        ) > 2e-5
                    )
                    : receipt.visibleScaffoldLivenessPressure !== 0
                        || receipt.visibleScaffoldLivenessScoreBoost !== 0)
                || (receipt.visibleScaffoldPermissionDecision === 'deferred'
                    && (
                        receipt.visibleScaffoldLivenessPressure > 2e-5
                        || receipt.visibleScaffoldLivenessScoreBoost > 2e-5
                    ))
                || (receipt.crownBaseCompetence !== null
                    && receipt.crownBaseCompetence !== undefined
                    && !validCrownBaseCompetence(
                        receipt.crownBaseCompetence,
                    ))
                || receipt.crownBaseDeferred !== Boolean(
                    receipt.crownFormationRequired
                    && receipt.crownBaseCompetence?.eligible === false,
                )
                || (receipt.crownBaseDeferred
                    && (
                        receipt.action !== 'advance_frontier'
                        || !receipt.forkIntentId
                        || receipt.crownBaseCompetence?.applicable !== true
                        || receipt.crownBaseCompetence?.eligible !== false
                        || receipt.visibleScaffoldLivenessPressure > 2e-5
                        || receipt.visibleScaffoldLivenessScoreBoost > 2e-5
                        || !Array.isArray(receipt.reasons)
                        || !receipt.reasons.includes(
                            'juvenile_crown_base_competence_deferred',
                        )
                    ))
                || ((receipt.visibleScaffoldPermissionDecision === 'deferred'
                    || receipt.crownBaseDeferred)
                    && receipt.action === 'advance_frontier'
                    && receipt.forkIntentId
                    && (
                        !Array.isArray(receipt.reasons)
                        || !receipt.reasons.includes(
                            'fork_due_priority_while_development_defers_mutation',
                        )
                    ))
                || (receipt.visibleScaffoldLivenessScoreBoost > 2e-5
                    && (
                        receipt.action !== 'fork_frontier'
                        || receipt.visibleScaffoldPermissionDecision
                            !== 'granted'
                        || receipt.visibleScaffoldPermissionEligible !== true
                    ))
                || !Number.isFinite(receipt.serviceAge)
                || receipt.serviceAge < 0
                || !Number.isFinite(receipt.expectedServiceGap)
                || receipt.expectedServiceGap <= 0
                || !Number.isFinite(receipt.servicePressure)
                || receipt.servicePressure < 0
                || !Number.isFinite(receipt.meristemEstablishmentLoad)
                || receipt.meristemEstablishmentLoad < 0
                || !Number.isFinite(receipt.upperEstablishmentPressure)
                || receipt.upperEstablishmentPressure < 0
                || receipt.upperEstablishmentPressure > 1.4
                || !Number.isFinite(receipt.upperEstablishmentScoreBoost)
                || Math.abs(
                    receipt.upperEstablishmentScoreBoost
                        - receipt.upperEstablishmentPressure * 0.58
                ) > 2e-5
            ))
        ) failures.push('invalid_proposal_receipt_sequence');
        return Object.freeze(failures);
    }

    function buildDiagnostics(graph) {
        const nodeYs = graph.nodes.map((node) => node.point.y);
        const nodeXs = graph.nodes.map((node) => node.point.x);
        const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
        const frontierById = new Map(graph.frontiers.map(
            (frontier) => [frontier.id, frontier],
        ));
        const eventBySequence = new Map(graph.events.map(
            (event) => [event.sequence, event],
        ));
        const visibleScaffoldAuthority = inspectVisibleScaffoldAuthority(graph);
        const permissionById = new Map(
            visibleScaffoldAuthority.permissionReceipts.map(
                (receipt) => [receipt.id, receipt],
            ),
        );
        const permissionFor = (kind, sequence, frontierId, embedded = null) => (
            permissionById.get(embedded?.id)
            || visibleScaffoldAuthority.permissionReceipts.find((receipt) => (
                receipt.candidateKind === kind
                && receipt.sequence === sequence
                && receipt.frontierId === frontierId
                && receipt.committed
            ))
            || null
        );
        const orderZeroForkCadence = graph.splits
            .filter((split) => split.parentTier === 0)
            .map((split) => {
                    const cadence = frontierById.get(
                        split.parentFrontierId,
                    )?.meristemCadence;
                    const permission = permissionFor(
                        'structural_fork',
                        split.sequence,
                        split.parentFrontierId,
                        split.visibleScaffoldPermission,
                    );
                    const realizedGap = Number(cadence?.arcSinceRelease || 0);
                    const targetGap = Number(cadence?.targetGapLength || 0);
                    const point = nodeById.get(split.originNodeId)?.point || null;
                    const visibleChildLineageIds = split.children
                        .filter((child) => Number(child.axisOrder ?? child.tier) > 0)
                        .map((child) => child.lineageId);
                    return Object.freeze({
                        kind: 'structural_fork',
                        releaseClass: visibleChildLineageIds.length
                            ? 'visible_scaffold_release'
                            : 'order_zero_axis_succession',
                        sequence: split.sequence,
                        nodeId: split.originNodeId,
                        point,
                        height: point?.y ?? null,
                        parentLineageId: split.parentLineageId,
                        visibleChildLineageIds: Object.freeze(visibleChildLineageIds),
                        childAxisOrders: Object.freeze(split.children.map(
                            (child) => Number(child.axisOrder ?? child.tier),
                        )),
                        childCadenceInheritance: Object.freeze(split.children.map(
                            (child) => Object.freeze({
                                lineageId: child.lineageId,
                                role: child.meristemCadence?.inheritanceRole ?? null,
                                arcSinceRelease:
                                    child.meristemCadence?.arcSinceRelease ?? null,
                                releaseCommittedAtBirth:
                                    child.meristemCadence?.releaseCommittedAtBirth ?? null,
                            }),
                        )),
                        realizedGap: rounded(realizedGap),
                        targetGap: rounded(targetGap),
                        releaseRatio: rounded(
                            targetGap > 0 ? realizedGap / targetGap : 0,
                        ),
                        releaseThreshold: cadence?.releaseThreshold ?? null,
                        priorReleaseKind:
                            cadence?.lastVisibleReleaseKind ?? null,
                        priorReleaseSequence:
                            cadence?.lastVisibleReleaseSequence ?? null,
                        cadenceEventCount: cadence?.eventCount ?? 0,
                        claimId: permission?.claimId ?? cadence?.claimId ?? null,
                        permissionReceiptId: permission?.id ?? null,
                        permissionPhase: permission?.phase ?? null,
                        permissionDecision: permission?.decision ?? null,
                        permissionEligible: permission?.eligible ?? null,
                        forkIntentId: permission?.forkIntentId
                            ?? split.forkIdentityIntent?.id
                            ?? null,
                        planHash: permission?.planHash
                            ?? split.forkIdentityIntent?.planHash
                            ?? null,
                    });
                });
        const orderZeroLateralCadence = graph.lateralMeristems
                .filter((meristem) => (
                    meristem.status === 'emitted'
                    && !meristem.temporaryAxis
                    && meristem.parentTier === 0
                ))
                .map((meristem) => {
                    const readiness = meristem.structuralReleaseReadiness || {};
                    const eventPermission = eventBySequence.get(
                        meristem.emittedAtEvent,
                    )?.steering?.visibleScaffoldPermission;
                    const permission = permissionFor(
                        'live_lateral_emission',
                        meristem.emittedAtEvent,
                        meristem.sourceFrontierId,
                        eventPermission,
                    );
                    const point = nodeById.get(meristem.nodeId)?.point || null;
                    return Object.freeze({
                        kind: 'live_lateral_emission',
                        releaseClass: 'visible_scaffold_release',
                        sequence: meristem.emittedAtEvent,
                        nodeId: meristem.nodeId,
                        point,
                        height: point?.y ?? null,
                        parentLineageId: meristem.parentLineageId,
                        visibleChildLineageIds: Object.freeze([
                            meristem.emissionLineageId,
                        ].filter(Boolean)),
                        childAxisOrders: Object.freeze([meristem.childAxisOrder]),
                        realizedGap: readiness.arcSinceRelease ?? null,
                        targetGap: readiness.targetGapLength ?? null,
                        releaseRatio: readiness.releaseRatio ?? null,
                        releaseThreshold: readiness.releaseThreshold ?? null,
                        priorReleaseKind: readiness.visibleScaffoldPermission
                            ?.lastVisibleReleaseKind ?? null,
                        priorReleaseSequence:
                            readiness.visibleScaffoldPermission
                                ?.lastVisibleReleaseSequence ?? null,
                        cadenceEventCount: null,
                        claimId: permission?.claimId
                            ?? readiness.visibleScaffoldPermission?.claimId
                            ?? readiness.claimId
                            ?? null,
                        permissionReceiptId: permission?.id ?? null,
                        permissionPhase: permission?.phase ?? null,
                        permissionDecision: permission?.decision ?? null,
                        permissionEligible: permission?.eligible ?? null,
                        forkIntentId: permission?.forkIntentId ?? null,
                        planHash: permission?.planHash ?? null,
                    });
                });
        const structuralReleaseCadence = [
            ...orderZeroForkCadence,
            ...orderZeroLateralCadence,
        ].sort((left, right) => left.sequence - right.sequence);
        const visibleScaffoldReleases = structuralReleaseCadence
            .filter((release) => release.releaseClass === 'visible_scaffold_release');
        const heightOrderedVisibleScaffoldReleases = [...visibleScaffoldReleases]
            .sort((left, right) => (
                Number(left.height || 0) - Number(right.height || 0)
                    || left.sequence - right.sequence
            ))
            .map((release, index, ordered) => Object.freeze({
                ...release,
                heightGapFromPrevious: index > 0
                    ? rounded(Number(release.height || 0) - Number(ordered[index - 1].height || 0))
                    : null,
            }));
        const realizedVisibleScaffoldGaps = visibleScaffoldReleases
            .map((release) => Number(release.realizedGap))
            .filter((value) => Number.isFinite(value) && value > 0);
        const meanVisibleScaffoldGap = realizedVisibleScaffoldGaps.length
            ? sum(realizedVisibleScaffoldGaps) / realizedVisibleScaffoldGaps.length
            : 0;
        const visibleScaffoldHeightGaps = heightOrderedVisibleScaffoldReleases
            .slice(1)
            .map((release) => Number(release.heightGapFromPrevious))
            .filter((value) => Number.isFinite(value));
        const axisSuccessionJunctions = orderZeroForkCadence.filter(
            (release) => release.releaseClass === 'order_zero_axis_succession',
        );
        const realizedStructuralGaps = structuralReleaseCadence
            .map((release) => Number(release.realizedGap))
            .filter((value) => Number.isFinite(value) && value > 0);
        const meanStructuralGap = realizedStructuralGaps.length
            ? sum(realizedStructuralGaps) / realizedStructuralGaps.length
            : 0;
        const episodeIds = new Set(graph.segments.map((segment) => segment.episodeId));
        const episodeArchetypes = new Set(graph.frontiers.map(
            (frontier) => frontier.episode.archetype,
        ));
        const tierLineageCounts = TIER_NAMES.map((_, tier) => (
            graph.lineages.filter((lineage) => lineage.tier === tier).length
        ));
        const tierSegmentCounts = TIER_NAMES.map((_, tier) => (
            graph.segments.filter((segment) => segment.tier === tier).length
        ));
        const rootForks = graph.splits.filter((split) => split.parentTier === 0);
        const firstForkSequence = Number(
            graph.splits[0]?.sequence ?? Number.POSITIVE_INFINITY,
        );
        const successionKinkTurns = graph.splits.map((split) => Number(
            split.successionKink?.realizedTurnDegrees || 0,
        ));
        const architectureProfiles = [
            ...graph.frontiers.map(
                (frontier) => frontier.constructionPortfolio?.architectureProfile,
            ),
            ...graph.splits.map(
                (split) => split.childDevelopmentBudget?.architectureProfile,
            ),
        ].filter(validCrownArchitectureProfile);
        const upperArchitectureProfiles = architectureProfiles.filter(
            (profile) => profile.upperProgress > 0,
        );
        const lineageById = new Map(graph.lineages.map(
            (lineage) => [lineage.id, lineage],
        ));
        const scaffoldFamilyRoots = graph.lineages.filter((lineage) => {
            const parent = lineageById.get(lineage.parentLineageId);
            return !lineage.temporaryAxis
                && lineage.axisOrder === 1
                && parent?.axisOrder === 0;
        });
        const scaffoldFamilyFor = (lineage) => {
            let current = lineage;
            while (current) {
                if (scaffoldFamilyRoots.some(
                    (root) => root.id === current.id,
                )) return current.id;
                current = lineageById.get(current.parentLineageId);
            }
            return null;
        };
        const minimumY = Math.min(...nodeYs);
        const maximumY = Math.max(...nodeYs);
        const heightSpan = Math.max(1e-8, maximumY - minimumY);
        const scaffoldFamilyDevelopment = scaffoldFamilyRoots.map((root) => {
            const members = graph.lineages.filter(
                (lineage) => scaffoldFamilyFor(lineage) === root.id,
            );
            const firstSegment = graph.segments.find(
                (segment) => segment.id === root.segmentIds[0],
            );
            const birthPoint = nodeById.get(firstSegment?.fromNodeId)?.point
                || null;
            const maximumAxisOrder = Math.max(
                root.axisOrder,
                ...members.map((lineage) => lineage.axisOrder),
            );
            return Object.freeze({
                lineageId: root.id,
                birthEvent: root.birthEvent,
                birthMode: root.birthMode,
                birthHeight: birthPoint ? rounded(birthPoint.y) : null,
                heightProgress: birthPoint
                    ? rounded((birthPoint.y - minimumY) / heightSpan)
                    : null,
                lineageCount: members.length,
                segmentCount: sum(members.map(
                    (lineage) => lineage.segmentIds.length,
                )),
                maximumAxisOrder,
                differentiationDepth: maximumAxisOrder - root.axisOrder,
            });
        }).sort((left, right) => (
            Number(left.heightProgress || 0) - Number(right.heightProgress || 0)
                || left.birthEvent - right.birthEvent
        ));
        const proposalActions = graph.proposalReceipts.reduce((counts, receipt) => {
            counts[receipt.action] = (counts[receipt.action] || 0) + 1;
            return counts;
        }, {});
        const crownInteriorBridges = graph.lateralMeristems.filter(
            (meristem) => meristem.crownInteriorExposure?.applicable,
        );
        const crownBirthOpportunities = [
            ...graph.developmentReceipts
                .filter((receipt) => receipt.kind === 'live_lateral_axis_emission')
                .map((receipt) => receipt.crownBirthOpportunity)
                .filter(Boolean),
            ...graph.splits.flatMap((split) => split.children
                .map((child) => child.crownBirthOpportunity)
                .filter(Boolean)),
        ];
        const scaffoldFamilyGestures = new Map();
        graph.frontiers.forEach((frontier) => {
            const gesture = frontier.scaffoldFamilyGesture;
            if (gesture) scaffoldFamilyGestures.set(gesture.gestureId, gesture);
        });
        const scaffoldFamilyDominanceClaims = new Map();
        graph.lineages.forEach((lineage) => {
            const claim = lineage.scaffoldFamilyDominanceClaim;
            if (!claim) return;
            const observed = scaffoldFamilyDominanceClaims.get(claim.claimId);
            if (
                !observed
                || claim.carriedThroughForkCount
                    > observed.carriedThroughForkCount
            ) scaffoldFamilyDominanceClaims.set(claim.claimId, claim);
        });
        const scaffoldFamilyDominanceReceipts = graph.developmentReceipts
            .filter((receipt) => receipt.scaffoldFamilyDominance);
        return Object.freeze({
            eventCount: graph.events.length,
            advanceCount: graph.events.filter((event) => event.kind === 'advance').length,
            forkCount: graph.splits.length,
            threeWayForkCount: graph.splits.filter(
                (split) => split.children.length === 3,
            ).length,
            segmentCount: graph.segments.length,
            lineageCount: graph.lineages.length,
            activeFrontierCount: graph.events.at(-1)?.activeFrontierIdsAfter.length || 0,
            tierLineageCounts: Object.freeze(tierLineageCounts),
            tierSegmentCounts: Object.freeze(tierSegmentCounts),
            orderZeroAxisCount: tierLineageCounts[0],
            balancedTrunkForkCount: rootForks.filter((split) => (
                Math.max(...split.resourceShares) - Math.min(...split.resourceShares) <= 0.12
                && split.children.filter((child) => child.tier === split.parentTier).length >= 2
            )).length,
            coRetainedForkCount: graph.splits.filter((split) => (
                split.children.filter(
                    (child) => child.tier === split.parentTier,
                ).length >= 2
            )).length,
            preFirstForkLateralEmissionCount: graph.lateralMeristems.filter(
                (meristem) => (
                    meristem.status === 'emitted'
                    && Number(meristem.emittedAtEvent) < firstForkSequence
                ),
            ).length,
            successionKinkCount: successionKinkTurns.filter(
                (turn) => Math.abs(turn) > 1e-6,
            ).length,
            meanAbsoluteSuccessionKinkDegrees: successionKinkTurns.length
                ? rounded(
                    sum(successionKinkTurns.map(Math.abs))
                        / successionKinkTurns.length,
                    3,
                )
                : 0,
            maximumAbsoluteSuccessionKinkDegrees: rounded(
                Math.max(0, ...successionKinkTurns.map(Math.abs)),
                3,
            ),
            successionCounterTurnCount: graph.splits.filter(
                (split) => split.successionKink?.application
                    ?.counterTurnSelected,
            ).length,
            crownArchitecture: Object.freeze({
                semantics: CROWN_ARCHITECTURE_PROFILE_SEMANTICS,
                controlSemantics: CROWN_ARCHITECTURE_CONTROL_SEMANTICS,
                controls: graph.architectureControls,
                observationCount: architectureProfiles.length,
                upperObservationCount: upperArchitectureProfiles.length,
                meanUpperComplexityPressure: upperArchitectureProfiles.length
                    ? rounded(sum(upperArchitectureProfiles.map(
                        (profile) => profile.upperComplexityPressure,
                    )) / upperArchitectureProfiles.length)
                    : 0,
                minimumScaffoldStationScale: rounded(Math.min(
                    1,
                    ...upperArchitectureProfiles.map(
                        (profile) => profile.scaffoldStationScale,
                    ),
                )),
                scaffoldFamilyDevelopment: Object.freeze(
                    scaffoldFamilyDevelopment,
                ),
                authority: 'diagnostic_only',
            }),
            reforkedChildCount: sum(graph.splits.map((split) => (
                split.children.filter((child) => child.laterReforked).length
            ))),
            episodeCount: episodeIds.size,
            episodeTransitionCount: graph.events.filter(
                (event) => event.kind === 'advance' && event.steering.episodeTransitioned,
            ).length,
            weepingChildCount: sum(graph.splits.map((split) => (
                split.children.filter((child) => child.sagActive).length
            ))),
            corridorCount: graph.corridors.length,
            activeCorridorCount: graph.events.at(-1)?.activeCorridorIdsAfter.length || 0,
            maximumCorridorHorizon: Math.max(...graph.corridors.map(
                (corridor) => corridor.horizon,
            )),
            episodeArchetypeCount: episodeArchetypes.size,
            maintenanceCompetitionCount: graph.events.filter(
                (event) => event.kind === 'terminate'
                    && event.reason === 'maintenance_competition',
            ).length,
            clusterCount: graph.clusters.length,
            clusteredSegmentCount: graph.segments.filter(
                (segment) => Boolean(segment.clusterId),
            ).length,
            eccentricForkCount: graph.splits.filter(
                (split) => Math.max(...split.resourceShares) >= 0.74,
            ).length,
            extremeAllocationForkCount: graph.splits.filter(
                (split) => Math.max(...split.resourceShares) >= 0.88,
            ).length,
            completionForkCount: graph.splits.filter(
                (split) => split.completionFork,
            ).length,
            horizontalReleaseCount: sum(graph.splits.map((split) => (
                split.children.filter((child) => child.horizontalRelease).length
            ))),
            lateralMeristemCount: graph.lateralMeristems.length,
            lateralEmissionCount: graph.lateralMeristems.filter(
                (meristem) => meristem.status === 'emitted',
            ).length,
            suppressedLateralMeristemCount: graph.lateralMeristems.filter(
                (meristem) => meristem.status === 'suppressed',
            ).length,
            meristemSiteCount: graph.nodeMeristemSites.length,
            birthModeCounts: Object.freeze(graph.lineages.reduce((counts, lineage) => {
                counts[lineage.birthMode] = (counts[lineage.birthMode] || 0) + 1;
                return counts;
            }, {})),
            uniqueLateralEmissionNodeCount: new Set(graph.lateralMeristems
                .filter((meristem) => meristem.status === 'emitted')
                .map((meristem) => meristem.nodeId)).size,
            axisSuccessionCount: graph.splits.filter(
                (split) => split.parentTier === 0,
            ).length,
            structuralLateralEmissionCount: graph.lateralMeristems.filter(
                (meristem) => (
                    meristem.status === 'emitted'
                    && !meristem.temporaryAxis
                    && meristem.parentTier === 0
                ),
            ).length,
            juvenileSacrificeAxisEmissionCount: graph.lateralMeristems.filter(
                (meristem) => meristem.status === 'emitted'
                    && meristem.temporaryAxis,
            ).length,
            juvenileSacrificeAxisRetirementCount:
                (graph.juvenileAxisRetirements || []).length,
            juvenileCambialContribution: rounded(sum(
                (graph.juvenileAxisRetirements || []).map(
                    (retirement) => Number(retirement.cambialContribution || 0),
                ),
            )),
            crownInteriorContinuity: Object.freeze({
                semantics: CROWN_INTERIOR_EXPOSURE_SEMANTICS,
                note: 'A live 3D observation may steer an already-funded order-2 lateral. It cannot create, fund, or authorize an axis.',
                bridgeCount: crownInteriorBridges.length,
                maximumPressure: rounded(Math.max(
                    0,
                    ...crownInteriorBridges.map(
                        (meristem) => meristem.crownInteriorExposure.pressure,
                    ),
                )),
                bridges: Object.freeze(crownInteriorBridges.map(
                    (meristem) => Object.freeze({
                        sequence: meristem.createdAtEvent,
                        meristemId: meristem.id,
                        parentLineageId: meristem.parentLineageId,
                        emissionLineageId: meristem.emissionLineageId,
                        sourceScaffoldLineageId:
                            meristem.crownInteriorExposure
                                .sourceScaffoldLineageId,
                        targetScaffoldLineageId:
                            meristem.crownInteriorExposure
                                .targetScaffoldLineageId,
                        verticalGap: meristem.crownInteriorExposure.verticalGap,
                        horizontalGap:
                            meristem.crownInteriorExposure.horizontalGap,
                        threeDimensionalGap:
                            meristem.crownInteriorExposure
                                .threeDimensionalGap,
                        pressure: meristem.crownInteriorExposure.pressure,
                    })),
                ),
            }),
            crownComposition: Object.freeze({
                semantics: CROWN_COMPOSITION_SEMANTICS,
                familyGestureSemantics:
                    SCAFFOLD_FAMILY_GESTURE_SEMANTICS,
                birthOpportunitySemantics:
                    CROWN_BIRTH_OPPORTUNITY_SEMANTICS,
                note: 'Projected interior and depth observations affect an already-funded child once at birth. Descendants inherit a family frame; no established axis pursues a correction target.',
                familyGestureCount: scaffoldFamilyGestures.size,
                birthOpportunityCount: crownBirthOpportunities.length,
                interiorOpportunityCount: crownBirthOpportunities.filter(
                    (opportunity) => opportunity.interiorBlend > 0,
                ).length,
                maximumInteriorBlend: rounded(Math.max(
                    0,
                    ...crownBirthOpportunities.map(
                        (opportunity) => opportunity.interiorBlend,
                    ),
                )),
                repeatedInternodeSteeringCount: 0,
                gestures: Object.freeze([...scaffoldFamilyGestures.values()]),
            }),
            scaffoldFamilyDominance: Object.freeze({
                semantics: SCAFFOLD_FAMILY_DOMINANCE_SEMANTICS,
                note: 'A small oblique order-1 junction keeps a soft recursive and terminal-load hierarchy. It changes no existing geometry or construction grant, and leader replacement requires a named causal event.',
                claimCount: scaffoldFamilyDominanceClaims.size,
                observationCount: scaffoldFamilyDominanceReceipts.length,
                replacementCount: [...scaffoldFamilyDominanceClaims.values()]
                    .filter((claim) => claim.replacementState
                        === 'leader_replacement').length,
                maximumHierarchyStrength: rounded(Math.max(
                    0,
                    ...[...scaffoldFamilyDominanceClaims.values()].map(
                        (claim) => claim.hierarchyStrength,
                    ),
                )),
                maximumReiterationThresholdBoost: rounded(Math.max(
                    0,
                    ...[...scaffoldFamilyDominanceClaims.values()].map(
                        (claim) => claim.reiterationThresholdBoost,
                    ),
                )),
                minimumTerminalLoadScale: rounded(Math.min(
                    1,
                    ...[...scaffoldFamilyDominanceClaims.values()].map(
                        (claim) => claim.terminalLoadScale,
                    ),
                )),
                claims: Object.freeze([...scaffoldFamilyDominanceClaims.values()]),
            }),
            visibleScaffoldLiveness: Object.freeze({
                semantics: VISIBLE_SCAFFOLD_LIVENESS_SEMANTICS,
                note: 'Continuous over-readiness is scheduling evidence only. It cannot grant permission, fund a lateral, or alter fork identity.',
                proposalObservationCount: graph.proposalReceipts.filter(
                    (receipt) => receipt.visibleScaffoldLiveness,
                ).length,
                positiveBoostCount: graph.proposalReceipts.filter(
                    (receipt) => receipt.visibleScaffoldLivenessScoreBoost > 0,
                ).length,
                maximumPressure: rounded(Math.max(
                    0,
                    ...graph.proposalReceipts.map(
                        (receipt) => receipt.visibleScaffoldLivenessPressure || 0,
                    ),
                )),
                maximumScoreBoost: rounded(Math.max(
                    0,
                    ...graph.proposalReceipts.map(
                        (receipt) => receipt.visibleScaffoldLivenessScoreBoost || 0,
                    ),
                )),
                postLateralForkClockReplacementCount:
                    graph.developmentReceipts.filter((receipt) => (
                        receipt.forkClockOwner
                            === 'post_lateral_visible_scaffold_cadence'
                    )).length,
            }),
            visibleScaffoldPermissionLedger: Object.freeze({
                semantics: 'append_only_visible_scaffold_permission_ledger_v1',
                note: 'Each entry records a route-neutral pre-mutation permission decision. Violations are causal contract failures, not spacing acceptance thresholds.',
                receipts: visibleScaffoldAuthority.permissionReceipts,
                receiptCount: visibleScaffoldAuthority.permissionReceiptCount,
                grantedCount: visibleScaffoldAuthority.grantedPermissionCount,
                deferredCount: visibleScaffoldAuthority.deferredPermissionCount,
                notRequiredCount:
                    visibleScaffoldAuthority.notRequiredPermissionCount,
                committedVisibleReleaseCount:
                    visibleScaffoldAuthority.committedVisibleReleaseCount,
                forkCommitCount:
                    visibleScaffoldAuthority.forkPermissionCommitCount,
                liveLateralCommitCount:
                    visibleScaffoldAuthority.liveLateralPermissionCommitCount,
                violationCount:
                    visibleScaffoldAuthority.permissionViolations.length,
                violations: visibleScaffoldAuthority.permissionViolations,
            }),
            forkIdentityIntentLedger: Object.freeze({
                semantics: 'append_only_immutable_fork_identity_intent_ledger_v1',
                note: 'Lifecycle receipts preserve one stochastic/topological fork plan across permission deferral; geometry may still adapt at commit.',
                receipts: visibleScaffoldAuthority.intentReceipts,
                receiptCount: visibleScaffoldAuthority.intentReceiptCount,
                intentCount: visibleScaffoldAuthority.intentCount,
                initiatedCount: visibleScaffoldAuthority.initiatedIntentCount,
                committedCount: visibleScaffoldAuthority.committedIntentCount,
                cancelledCount: visibleScaffoldAuthority.cancelledIntentCount,
                pendingFrontierStateCount:
                    visibleScaffoldAuthority.pendingFrontierStateCount,
                pendingFrontierCount:
                    visibleScaffoldAuthority.pendingFrontierCount,
                violationCount: visibleScaffoldAuthority.intentViolations.length,
                violations: visibleScaffoldAuthority.intentViolations,
            }),
            visibleScaffoldAuthorityViolationCount:
                visibleScaffoldAuthority.violations.length,
            visibleScaffoldAuthorityViolations:
                visibleScaffoldAuthority.violations,
            structuralReleaseCadence: Object.freeze({
                semantics:
                    'descriptive_order_zero_junction_and_release_ledger_v2',
                note: 'This compatibility ledger contains both visible scaffold releases and order-zero-only succession junctions. Use visibleScaffoldCadence for visible spacing; neither ledger repairs morphology.',
                releases: Object.freeze(structuralReleaseCadence),
                realizedGapCount: realizedStructuralGaps.length,
                meanRealizedGap: rounded(meanStructuralGap),
                minimumRealizedGap: rounded(realizedStructuralGaps.length
                    ? Math.min(...realizedStructuralGaps)
                    : 0),
                maximumRealizedGap: rounded(realizedStructuralGaps.length
                    ? Math.max(...realizedStructuralGaps)
                    : 0),
                maximumToMeanGapRatio: rounded(
                    meanStructuralGap > 0
                        ? Math.max(...realizedStructuralGaps, 0)
                            / meanStructuralGap
                        : 0,
                ),
            }),
            visibleScaffoldCadence: Object.freeze({
                semantics: 'descriptive_visible_order_one_release_ledger_v2',
                note: 'Only order-zero events that actually create an order-one axis appear here. Causal gaps use inherited arc; height gaps are descriptive world-space observations.',
                releases: Object.freeze(visibleScaffoldReleases),
                heightOrderedReleases: Object.freeze(
                    heightOrderedVisibleScaffoldReleases,
                ),
                releaseCount: visibleScaffoldReleases.length,
                forkReleaseCount: visibleScaffoldReleases.filter(
                    (release) => release.kind === 'structural_fork',
                ).length,
                liveLateralReleaseCount: visibleScaffoldReleases.filter(
                    (release) => release.kind === 'live_lateral_emission',
                ).length,
                realizedGapCount: realizedVisibleScaffoldGaps.length,
                meanRealizedGap: rounded(meanVisibleScaffoldGap),
                minimumRealizedGap: rounded(realizedVisibleScaffoldGaps.length
                    ? Math.min(...realizedVisibleScaffoldGaps)
                    : 0),
                maximumRealizedGap: rounded(realizedVisibleScaffoldGaps.length
                    ? Math.max(...realizedVisibleScaffoldGaps)
                    : 0),
                heightGapCount: visibleScaffoldHeightGaps.length,
                meanHeightGap: rounded(visibleScaffoldHeightGaps.length
                    ? sum(visibleScaffoldHeightGaps)
                        / visibleScaffoldHeightGaps.length
                    : 0),
                minimumHeightGap: rounded(visibleScaffoldHeightGaps.length
                    ? Math.min(...visibleScaffoldHeightGaps)
                    : 0),
                maximumHeightGap: rounded(visibleScaffoldHeightGaps.length
                    ? Math.max(...visibleScaffoldHeightGaps)
                    : 0),
            }),
            orderZeroAxisSuccessionCadence: Object.freeze({
                semantics: 'descriptive_order_zero_succession_claim_ledger_v1',
                note: 'These junctions create no visible order-one scaffold and therefore do not spend the visible-release clock.',
                junctions: Object.freeze(axisSuccessionJunctions),
                junctionCount: axisSuccessionJunctions.length,
            }),
            proposalActions: Object.freeze({ ...proposalActions }),
            structuralCost: graph.completionStatus.structuralCost,
            scaffoldAttachmentCount: graph.completionStatus.scaffoldAttachmentCount,
            scaffoldBandCount: graph.completionStatus.scaffoldBandCount,
            terminalLobeCount: graph.completionStatus.terminalLobeCount,
            terminalRamificationCount: graph.completionStatus.terminalRamificationCount,
            maximumWeightedReferenceErrorDegrees: Math.max(
                0,
                ...graph.splits.map((split) => split.weightedMeanAngleDegrees),
            ),
            firstForkShares: Object.freeze([...(graph.splits[0]?.resourceShares || [])]),
            firstForkTiers: Object.freeze(graph.splits[0]?.children.map(
                (child) => child.tier,
            ) || []),
            bounds: Object.freeze({
                minimumX: Math.min(...nodeXs),
                maximumX: Math.max(...nodeXs),
                minimumY: Math.min(...nodeYs),
                maximumY: Math.max(...nodeYs),
            }),
        });
    }


    scope.ZenBonsaiTypedDevelopmentalSchedulerGraphInspector = Object.freeze({
        validateGraph,
        buildDiagnostics,
    });
}(zenPlumeKernelRealm));
