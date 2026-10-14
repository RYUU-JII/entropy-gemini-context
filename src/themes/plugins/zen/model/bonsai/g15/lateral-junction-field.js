/**
 * G15.4 joint lateral-junction field.
 *
 * A live lateral is anatomically attached to a continuing axis, but it is not
 * free geometry. Both axes share one junction-area ledger and the lateral load
 * leaves a bounded reaction in the continuation heading and persistent axis
 * state. This owner is pure and never creates graph records.
 */
(function installTypedLateralJunctionField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const axisState = scope.ZenBonsaiTypedDevelopmentalSchedulerAxisState;
    if (!programs || !axisState) {
        throw new Error(
            '[G15.4_LATERAL_JUNCTION] programs and axis-state owners must load first.',
        );
    }

    const {
        clamp,
        rotateGrowthPlane,
        signedPlanarAngle,
        angularDistance,
        stabilizeOrderZeroHeading,
        rounded,
    } = programs;
    const { applyLateralJunction } = axisState;

    const LATERAL_JUNCTION_SEMANTICS =
        'joint_continuation_lateral_area_moment_v1';

    function resolveJointLateralJunction(context, spec) {
        const sourceRadius = Math.max(0.01, Number(spec.sourceRadius || 0));
        const childState = spec.childDevelopmentState;
        const emissionShare = clamp(Number(spec.emissionShare || 0.2), 0.04, 0.46);
        const support = clamp(Number(childState.supportInvestment || 0.3), 0.02, 1.2);
        const extension = clamp(Number(childState.extensionDrive || 0.4), 0.02, 1.2);
        const deflection = angularDistance(spec.parentHeading, spec.childHeading);
        const lever = clamp(Math.sin(Math.min(Math.PI / 2, deflection)), 0.08, 1);
        const lateralAreaFraction = clamp(
            emissionShare * (0.48 + support * 0.34 + extension * 0.08),
            0.075,
            0.3,
        );
        const areaGain = clamp(Number(context.forkAreaGain || 1), 0.98, 1.045);
        const totalArea = sourceRadius ** 2 * areaGain;
        const continuationRadius = Math.sqrt(
            totalArea * (1 - lateralAreaFraction),
        );
        const lateralRadius = Math.sqrt(totalArea * lateralAreaFraction);
        const side = Math.sign(
            signedPlanarAngle(spec.parentHeading, spec.childHeading),
        ) || Math.sign(spec.side) || 1;
        const lateralMoment = clamp(
            side
                * lateralAreaFraction
                * lever
                * (0.64 + extension * 0.36),
            -1,
            1,
        );
        const inheritedMoment = Number(
            spec.parentDevelopmentState?.loadMoment || 0,
        );
        const reactionRadians = clamp(
            -(lateralMoment * 0.46 + inheritedMoment * 0.035),
            -0.155,
            0.155,
        );
        let continuationHeading = rotateGrowthPlane(
            spec.parentHeading,
            reactionRadians,
        );
        if (Number(spec.parentAxisOrder || 0) === 0) {
            continuationHeading = stabilizeOrderZeroHeading(
                context,
                continuationHeading,
            );
        }
        const realizedReactionRadians = signedPlanarAngle(
            spec.parentHeading,
            continuationHeading,
        );
        const supportDemand = clamp(
            lateralAreaFraction * 1.8 + Math.abs(lateralMoment) * 0.8,
            0,
            1,
        );
        const continuationDevelopmentState = applyLateralJunction(
            spec.parentDevelopmentState,
            {
                lateralMoment,
                supportDemand,
                lateralAreaFraction,
            },
        );
        return Object.freeze({
            semantics: LATERAL_JUNCTION_SEMANTICS,
            sourceRadius: rounded(sourceRadius),
            sourceArea: rounded(sourceRadius ** 2),
            areaGain: rounded(areaGain),
            committedArea: rounded(totalArea),
            continuationArea: rounded(continuationRadius ** 2),
            lateralArea: rounded(lateralRadius ** 2),
            lateralAreaFraction: rounded(lateralAreaFraction),
            continuationRadius: rounded(continuationRadius),
            lateralRadius: rounded(lateralRadius),
            parentHeading: Object.freeze({ ...spec.parentHeading }),
            childHeading: Object.freeze({ ...spec.childHeading }),
            continuationHeading: Object.freeze({ ...continuationHeading }),
            childDeflectionRadians: rounded(deflection),
            requestedReactionRadians: rounded(reactionRadians),
            reactionRadians: rounded(realizedReactionRadians),
            lateralMoment: rounded(lateralMoment),
            inheritedMoment: rounded(inheritedMoment),
            supportDemand: rounded(supportDemand),
            continuationDevelopmentState,
            childDevelopmentState: childState,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerLateralJunction = Object.freeze({
        LATERAL_JUNCTION_SEMANTICS,
        resolveJointLateralJunction,
    });
}(globalThis));
