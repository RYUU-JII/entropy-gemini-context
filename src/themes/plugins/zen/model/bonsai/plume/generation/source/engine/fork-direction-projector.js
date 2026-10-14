import {zenPlumeKernelRealm} from "../../kernelRealm.js";
import {sharedReleaseFrame,sharedProjectionFrame} from "../research/joint-frame/ZenG15FlowJointFrame.js";
/**
 * G15.4 realized-fork direction projector.
 *
 * Developmental fields propose child directions. This owner performs the one
 * explicit projection boundary before geometry is born: sibling-frame
 * reconciliation, forward viability, radial restraint, and preset-owned
 * order-0 support. It records corrections but never mutates graph state.
 */
(function installTypedDevelopmentalForkDirectionProjector(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategy = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    if (!programs || !strategy) {
        throw new Error(
            '[G15.4_FORK_PROJECTOR] programs and developmental strategy must load first.',
        );
    }
    const {
        clamp,
        add,
        scale,
        dot,
        normalize,
        mixDirection,
        pointAt,
        rotateGrowthPlane,
        tiltDepth,
        angularDistance,
        constrainDirectionToCone,
        resolveOrderZeroSupport,
        stabilizeOrderZeroHeading,
        signedPlanarAngle,
        directionAzimuth,
        directionElevation,
        directionFromAzimuthElevation,
        rounded,
        resolveCrownRadius,
        resolveRadialDistance,
    } = programs;
    const { evaluateStrategyAxis } = strategy;

    function constrainOrderZeroForkDirection(
        context,
        frontier,
        direction,
        codominant,
    ) {
        const support = resolveOrderZeroSupport(context);
        if (!support || frontier.tier !== 0) {
            return Object.freeze({
                direction: normalize(direction),
                correctionRadians: 0,
                support,
            });
        }
        const original = normalize(direction);
        const maximumTurn = codominant
            ? support.codominantTurnRadians
            : support.continuationTurnRadians;
        let constrained = original;
        for (let pass = 0; pass < 2; pass += 1) {
            constrained = constrainDirectionToCone(
                constrained,
                frontier.heading,
                maximumTurn,
            );
            constrained = stabilizeOrderZeroHeading(context, constrained);
        }
        return Object.freeze({
            direction: constrained,
            correctionRadians: rounded(angularDistance(original, constrained)),
            support,
            maximumTurnRadians: rounded(maximumTurn),
        });
    }

    function constrainStructuralOutwardTurn(
        context,
        frontier,
        origin,
        referenceHeading,
        direction,
        runLength,
        tier,
    ) {
        if (tier >= 2) {
            return Object.freeze({ direction, applied: false, radialPressure: 0 });
        }
        const crownRadius = resolveCrownRadius(context);
        const radialDistance = resolveRadialDistance(origin);
        const radialPressure = clamp(radialDistance / Math.max(24, crownRadius), 0, 1);
        const lateralField = evaluateStrategyAxis(
            context,
            'lateral_investment',
            frontier,
            origin,
        );
        const lateralAllowance = clamp(
            lateralField.effect.lateralInvestmentScale
                * Math.exp(
                    (frontier.temperament?.lineageResponse?.lateral_investment || 0)
                        * 0.16,
                ),
            0.58,
            1.62,
        );
        if (radialPressure <= 0.08) {
            return Object.freeze({
                direction,
                applied: false,
                radialPressure: rounded(radialPressure),
                crownRadius: rounded(crownRadius),
                lateralAllowance: rounded(lateralAllowance),
                lateralField,
            });
        }
        const turn = signedPlanarAngle(referenceHeading, direction);
        const candidateTarget = pointAt(origin, direction, runLength);
        const referenceTarget = pointAt(origin, referenceHeading, runLength);
        const candidateRadius = resolveRadialDistance(candidateTarget);
        const referenceRadius = resolveRadialDistance(referenceTarget);
        const outward = candidateRadius > referenceRadius + runLength * 0.015;
        const baseLimit = tier === 0 ? 0.58 : 0.78;
        const restraintStrength = clamp(0.66 / lateralAllowance, 0.34, 0.92);
        const turnLimit = Math.max(
            (tier === 0 ? 0.17 : 0.24) * clamp(lateralAllowance, 0.82, 1.22),
            baseLimit * (1 - radialPressure * restraintStrength),
        );
        if (!outward || Math.abs(turn) <= turnLimit) {
            return Object.freeze({
                direction,
                applied: false,
                outward,
                radialPressure: rounded(radialPressure),
                turnBeforeRadians: rounded(turn),
                turnAfterRadians: rounded(turn),
                turnLimitRadians: rounded(turnLimit),
                crownRadius: rounded(crownRadius),
                lateralAllowance: rounded(lateralAllowance),
                lateralField,
            });
        }
        let constrained = rotateGrowthPlane(
            referenceHeading,
            Math.sign(turn) * turnLimit,
        );
        constrained = tiltDepth(
            constrained,
            clamp(direction.z - constrained.z, -0.12, 0.12),
        );
        return Object.freeze({
            direction: constrained,
            applied: true,
            outward,
            radialPressure: rounded(radialPressure),
            turnBeforeRadians: rounded(turn),
            turnAfterRadians: rounded(signedPlanarAngle(referenceHeading, constrained)),
            turnLimitRadians: rounded(turnLimit),
            crownRadius: rounded(crownRadius),
            lateralAllowance: rounded(lateralAllowance),
            lateralField,
        });
    }

    function constrainReleasedAxisElevation(context, frontier, child) {
        const releasedOrder = child.tier > frontier.tier;
        const gravityOwned = context.presetId === 'kengai'
            || context.form.kind === 'weeping_release'
            || context.traitId === 'weeping_temperament';
        const original = normalize(child.direction);
        const before = directionElevation(original);
        if (sharedReleaseFrame() && releasedOrder && !gravityOwned) {
            return Object.freeze({semantics:'shared_fork_release_frame_v1',direction:original,
                applied:false,releasedOrder,gravityOwned,elevationBeforeRadians:rounded(before),
                elevationAfterRadians:rounded(before),owner:'joint_frame_experiment'});
        }
        if (!releasedOrder || gravityOwned) {
            return Object.freeze({
                semantics: 'released_axis_world_elevation_band_v1',
                direction: original,
                applied: false,
                releasedOrder,
                gravityOwned,
                elevationBeforeRadians: rounded(before),
                elevationAfterRadians: rounded(before),
            });
        }
        const relativeDeflection = angularDistance(frontier.heading, original);
        const wideRelease = relativeDeflection >= 0.72;
        const minimumElevation = -0.07;
        const maximumElevation = wideRelease
            ? 0.42
            : (child.tier === 1 ? 0.84 : 0.66);
        const after = clamp(before, minimumElevation, maximumElevation);
        const direction = directionFromAzimuthElevation(
            directionAzimuth(original),
            after,
        );
        return Object.freeze({
            semantics: 'released_axis_world_elevation_band_v1',
            direction,
            applied: Math.abs(after - before) > 1e-8,
            releasedOrder,
            gravityOwned,
            wideRelease,
            relativeDeflectionRadians: rounded(relativeDeflection),
            minimumElevationRadians: rounded(minimumElevation),
            maximumElevationRadians: rounded(maximumElevation),
            elevationBeforeRadians: rounded(before),
            elevationAfterRadians: rounded(after),
        });
    }

    function observeSiblingSeparation(
        referenceFrame,
        childDrafts,
        proposedSeparationRadians,
    ) {
        if (childDrafts.length !== 2 || proposedSeparationRadians <= 1e-8) {
            return Object.freeze({
                semantics: 'sibling_separation_observation_v1',
                applied: false,
                eligible: false,
                reason: childDrafts.length !== 2
                    ? 'non_binary_fork'
                    : 'zero_proposed_separation',
            });
        }
        const realizedSeparationRadians = Math.abs(signedPlanarAngle(
            childDrafts[0].direction,
            childDrafts[1].direction,
        ));
        const proposedDirections = childDrafts.map((child) => (
            rotateGrowthPlane(referenceFrame.heading, child.offset)
        ));
        const childCorrectionRadians = childDrafts.map((child, index) => rounded(
            angularDistance(proposedDirections[index], child.direction),
        ));
        return Object.freeze({
            semantics: 'sibling_separation_observation_v1',
            applied: false,
            eligible: true,
            proposedSeparationRadians: rounded(proposedSeparationRadians),
            afterSeparationRadians: rounded(realizedSeparationRadians),
            retainedRatio: rounded(clamp(
                realizedSeparationRadians / Math.max(1e-8, proposedSeparationRadians),
                0,
                4,
            )),
            childCorrectionRadians: Object.freeze(childCorrectionRadians),
            wideProposalScreenCollapse: proposedSeparationRadians >= 25 * Math.PI / 180
                && realizedSeparationRadians < 12 * Math.PI / 180,
        });
    }

    function reconcileSiblingSeparation(
        context,
        frontier,
        referenceFrame,
        childDrafts,
        proposedSeparationRadians,
    ) {
        const before = observeSiblingSeparation(
            referenceFrame,
            childDrafts,
            proposedSeparationRadians,
        );
        if (!before.eligible) return before;
        const flowContrast = Math.abs(
            childDrafts[0].flowDirectionWeight
                - childDrafts[1].flowDirectionWeight,
        );
        const codominance = clamp(1 - flowContrast / 0.5, 0, 1);
        const retainedFraction = 0.52 + codominance * 0.14;
        const minimumDistinctSeparation = Math.min(
            proposedSeparationRadians,
            Math.max(9 * Math.PI / 180, proposedSeparationRadians * retainedFraction),
        );
        if (before.afterSeparationRadians >= minimumDistinctSeparation) {
            return Object.freeze({
                ...before,
                semantics: 'joint_sibling_separation_projection_v2',
                minimumDistinctSeparationRadians: rounded(
                    minimumDistinctSeparation,
                ),
                retainedFraction: rounded(retainedFraction),
                flowContrast: rounded(flowContrast),
                resourceShareAuthority: false,
            });
        }

        const weights = childDrafts.map((child) => Math.max(
            0.05,
            Number(child.flowDirectionWeight || 0.5),
        ));
        const weightTotal = weights[0] + weights[1];
        const center = normalize(add(
            scale(childDrafts[0].direction, weights[0]),
            scale(childDrafts[1].direction, weights[1]),
        ));
        const proposedDirections = childDrafts.map((child) => (
            rotateGrowthPlane(referenceFrame.heading, child.offset)
        ));
        const separationSign = Math.sign(signedPlanarAngle(
            proposedDirections[0],
            proposedDirections[1],
        )) || 1;
        const orderZeroIndex = childDrafts.findIndex((child) => child.tier === 0);
        const releasedIndex = orderZeroIndex >= 0 ? 1 - orderZeroIndex : -1;
        const pairOffsets = [
            -separationSign * minimumDistinctSeparation * weights[1] / weightTotal,
            separationSign * minimumDistinctSeparation * weights[0] / weightTotal,
        ];
        childDrafts.forEach((child, index) => {
            let direction;
            if (orderZeroIndex >= 0) {
                if (index === orderZeroIndex) {
                    direction = child.direction;
                } else {
                    const anchor = childDrafts[orderZeroIndex].direction;
                    const proposedFromAnchor = signedPlanarAngle(
                        proposedDirections[orderZeroIndex],
                        proposedDirections[releasedIndex],
                    );
                    direction = rotateGrowthPlane(
                        anchor,
                        (Math.sign(proposedFromAnchor) || separationSign)
                            * minimumDistinctSeparation,
                    );
                }
            } else {
                direction = rotateGrowthPlane(center, pairOffsets[index]);
            }
            direction = tiltDepth(
                direction,
                clamp(child.direction.z - direction.z, -0.1, 0.1),
            );
            const releasedOrder = child.tier > frontier.tier;
            const gravityOwned = context.presetId === 'kengai'
                || context.form.kind === 'weeping_release'
                || context.traitId === 'weeping_temperament';
            if (releasedOrder && !gravityOwned && direction.y < -0.07) {
                direction = normalize({ ...direction, y: -0.07 });
            }
            if (child.tier === 0) {
                direction = constrainOrderZeroForkDirection(
                    context,
                    frontier,
                    direction,
                    childDrafts.filter((candidate) => candidate.tier === 0).length > 1,
                ).direction;
            }
            child.direction = direction;
        });
        const after = observeSiblingSeparation(
            referenceFrame,
            childDrafts,
            proposedSeparationRadians,
        );
        return Object.freeze({
            ...after,
            semantics: 'joint_sibling_separation_projection_v2',
            applied: true,
            separationBeforeRadians: before.afterSeparationRadians,
            minimumDistinctSeparationRadians: rounded(minimumDistinctSeparation),
            retainedFraction: rounded(retainedFraction),
            flowContrast: rounded(flowContrast),
            resourceShareAuthority: false,
            wideProposalScreenCollapse: after.wideProposalScreenCollapse,
        });
    }

    function projectForkDirections(
        context,
        frontier,
        origin,
        referenceFrame,
        childDrafts,
        horizontalRelease,
    ) {
        const proposedSeparationRadians = childDrafts.length === 2
            ? Math.abs(signedPlanarAngle(
                rotateGrowthPlane(referenceFrame.heading, childDrafts[0].offset),
                rotateGrowthPlane(referenceFrame.heading, childDrafts[1].offset),
            ))
            : 0;
        const selectedWeightedDirection = normalize(childDrafts.reduce(
            (vector, child) => add(vector, scale(child.direction, child.angleShare)),
            { x: 0, y: 0, z: 0 },
        ));
        const hasOrderZeroChild = childDrafts.some((child) => child.tier === 0);
        // Order-0 support was already solved jointly with aperture in the fork
        // law. Re-centering each selected pair afterward made that upstream
        // solution invalid and forced a second support correction. Preserve
        // the committed support frame; lower orders may still reconcile the
        // small spatial-selection drift as one rigid pair.
        const rigidFrameCorrection = hasOrderZeroChild
            ? 0
            : signedPlanarAngle(
                selectedWeightedDirection,
                referenceFrame.heading,
            );
        childDrafts.forEach((child) => {
            child.direction = rotateGrowthPlane(child.direction, rigidFrameCorrection);
        });
        let rigidDepthCorrection = 0;
        if (!hasOrderZeroChild) {
            for (let pass = 0; pass < 2; pass += 1) {
                const weightedDirection = normalize(childDrafts.reduce(
                    (vector, child) => add(vector, scale(child.direction, child.angleShare)),
                    { x: 0, y: 0, z: 0 },
                ));
                const depthCorrection = clamp(
                    referenceFrame.heading.z - weightedDirection.z,
                    -0.16,
                    0.16,
                );
                rigidDepthCorrection += depthCorrection;
                childDrafts.forEach((child) => {
                    child.direction = tiltDepth(child.direction, depthCorrection);
                });
            }
        }
        if (horizontalRelease) {
            const minor = childDrafts[horizontalRelease.minorIndex];
            const major = childDrafts[horizontalRelease.majorIndex];
            minor.direction = horizontalRelease.minorHeading;
            major.direction = rotateGrowthPlane(
                referenceFrame.heading,
                horizontalRelease.offsets[horizontalRelease.majorIndex],
            );
            minor.offset = signedPlanarAngle(referenceFrame.heading, minor.direction);
            major.offset = signedPlanarAngle(referenceFrame.heading, major.direction);
        }
        const forkForwardFloor = frontier.tier === 0 ? 0.08 : 0.34;
        childDrafts.forEach((child) => {
            let pass = 0;
            while (dot(frontier.heading, child.direction) < forkForwardFloor && pass < 8) {
                child.direction = mixDirection(child.direction, frontier.heading, 0.12);
                pass += 1;
            }
        });
        childDrafts.forEach((child) => {
            const radialConstraint = child.horizontalRelease
                ? Object.freeze({
                    semantics: 'committed_horizontal_release_radial_bypass_v1',
                    direction: child.direction,
                    applied: false,
                    bypassed: true,
                    radialPressure: 0,
                    reason: 'horizontal_release_owns_world_direction',
                })
                : constrainStructuralOutwardTurn(
                    context,
                    frontier,
                    origin,
                    referenceFrame.heading,
                    child.direction,
                    child.runLength,
                    child.tier,
                );
            child.direction = radialConstraint.direction;
            child.radialConstraint = radialConstraint;
        });
        childDrafts.forEach((child) => {
            const elevationConstraint = constrainReleasedAxisElevation(
                context,
                frontier,
                child,
            );
            child.direction = elevationConstraint.direction;
            child.lateralGravityFrame = elevationConstraint;
        });
        // Radial projection can move the rotated order-zero proposal beyond its
        // support cone. The direction owner enforces the existing support law
        // after those fields, before its ordinary sibling reconciliation.
        if (sharedProjectionFrame()) childDrafts.forEach(child => {
            if (child.tier !== 0) return;
            const support = constrainOrderZeroForkDirection(context, frontier, child.direction,
                childDrafts.filter(candidate => candidate.tier === 0).length > 1);
            child.direction = support.direction;
            child.orderZeroSupportCorrectionRadians = support.correctionRadians;
        });
        const siblingSeparationPlan = reconcileSiblingSeparation(
            context,
            frontier,
            referenceFrame,
            childDrafts,
            proposedSeparationRadians,
        );
        return Object.freeze({
            childDrafts,
            rigidFrameCorrection,
            rigidDepthCorrection,
            siblingSeparationPlan,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerForkDirectionProjector = Object.freeze({
        constrainOrderZeroForkDirection,
        constrainStructuralOutwardTurn,
        constrainReleasedAxisElevation,
        observeSiblingSeparation,
        reconcileSiblingSeparation,
        projectForkDirections,
    });
}(zenPlumeKernelRealm));
