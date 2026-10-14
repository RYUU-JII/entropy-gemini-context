import {zenPlumeKernelRealm} from "../../kernelRealm.js";
/**
 * G15.4 specimen developmental-trajectory field.
 *
 * Each specimen owns continuous, seed-sampled curves for resource contrast,
 * fork aperture, internode extension, and axis persistence. The curves are
 * evaluated before geometry or topology is committed. They never inspect a
 * completed silhouette and never select a named tree form.
 */
(function installTypedDevelopmentalTrajectoryField(scope) {
    'use strict';

    const programs = scope.ZenBonsaiTypedDevelopmentalSchedulerPrograms;
    const strategy = scope.ZenBonsaiTypedDevelopmentalSchedulerStrategy;
    if (!programs || !strategy) {
        throw new Error(
            '[G15.4_TRAJECTORY] developmental-programs.js and developmental-strategy.js must load first.',
        );
    }
    const { clamp, rounded } = programs;
    const {
        DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
        DEVELOPMENTAL_TRAJECTORY_IDS,
        resolveStrategyCoordinates,
    } = strategy;

    function curveValue(profile, progress) {
        const centered = progress - 0.5;
        const middleArc = 1 - 4 * centered ** 2;
        return clamp(
            profile.intercept
                + profile.slope * centered * 1.25
                + profile.bend * middleArc,
            -1,
            1,
        );
    }

    function resolveTrajectoryProgress(context, frontier, point, profile) {
        const coordinates = resolveStrategyCoordinates(context, frontier, point);
        const generation = clamp(Number(frontier?.generationDepth || 0) / 4, 0, 1);
        const progress = clamp(
            coordinates.height * profile.heightWeight
                + coordinates.rootDistance * profile.transportWeight
                + coordinates.maturity * profile.maturityWeight
                + generation * profile.generationWeight,
            0,
            1,
        );
        return Object.freeze({
            coordinates,
            generation: rounded(generation),
            progress: rounded(progress),
        });
    }

    function trajectoryEffect(id, value) {
        if (id === 'resource_contrast') {
            // Allocation is bounded downstream, so a trajectory must retain
            // enough authority to counter inherited hierarchy as well as to
            // reinforce it. A weak postscript here cannot express a specimen
            // that becomes progressively more balanced.
            return Object.freeze({ resourceContrastShift: rounded(value * 0.68) });
        }
        if (id === 'fork_aperture') {
            return Object.freeze({ apertureScale: rounded(Math.exp(value * 0.36)) });
        }
        if (id === 'internode_extension') {
            return Object.freeze({ internodeScale: rounded(Math.exp(value * 0.34)) });
        }
        if (id === 'axis_persistence') {
            return Object.freeze({ persistenceScale: rounded(Math.exp(value * 0.42)) });
        }
        throw new RangeError(`[G15.4_TRAJECTORY] Unknown trajectory: ${id}`);
    }

    function neutralEffect(id) {
        if (id === 'resource_contrast') return Object.freeze({ resourceContrastShift: 0 });
        if (id === 'fork_aperture') return Object.freeze({ apertureScale: 1 });
        if (id === 'internode_extension') return Object.freeze({ internodeScale: 1 });
        if (id === 'axis_persistence') return Object.freeze({ persistenceScale: 1 });
        throw new RangeError(`[G15.4_TRAJECTORY] Unknown trajectory: ${id}`);
    }

    function evaluateDevelopmentalTrajectory(context, id, frontier, point) {
        if (!DEVELOPMENTAL_TRAJECTORY_IDS.includes(id)) {
            throw new RangeError(`[G15.4_TRAJECTORY] Unknown trajectory: ${id}`);
        }
        const profile = context.strategy?.developmentalTrajectories?.[id];
        if (!profile) {
            throw new Error(`[G15.4_TRAJECTORY] Context is missing trajectory ${id}.`);
        }
        const resolved = resolveTrajectoryProgress(context, frontier, point, profile);
        const enabled = profile.enabled
            && context.researchControls?.developmentalTrajectories !== false;
        const value = enabled ? curveValue(profile, resolved.progress) : 0;
        const earlyValue = curveValue(profile, 0.15);
        const lateValue = curveValue(profile, 0.85);
        const delta = lateValue - earlyValue;
        return Object.freeze({
            semantics: DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
            id,
            enabled,
            profile,
            coordinates: resolved.coordinates,
            generation: resolved.generation,
            progress: resolved.progress,
            earlyValue: rounded(earlyValue),
            lateValue: rounded(lateValue),
            trend: Math.abs(delta) < 0.12
                ? 'approximately_stable'
                : (delta > 0 ? 'increasing' : 'decreasing'),
            value: rounded(value),
            effect: enabled ? trajectoryEffect(id, value) : neutralEffect(id),
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerTrajectoryField = Object.freeze({
        DEVELOPMENTAL_TRAJECTORY_SEMANTICS,
        evaluateDevelopmentalTrajectory,
    });
}(zenPlumeKernelRealm));
