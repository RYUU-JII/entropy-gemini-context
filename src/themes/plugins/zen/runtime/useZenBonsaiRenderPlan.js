import { useLayoutEffect, useMemo, useRef } from 'react';
import {
    createZenBonsaiRenderPlanV1,
    isZenBonsaiG15Topology,
    isZenBonsaiPlumeTopology,
} from '../model/bonsai/rendering/zenBonsaiRenderPlan.js';

// The canonical activation producer returns these three frozen scalar fields.
// Reuse equivalent producer values without normalizing or dropping anything
// from arbitrary render input; unusual records keep normal factory validation.
const samePlumeActivation = (left, right) => {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object'
        || !Object.isFrozen(left) || !Object.isFrozen(right)
        || Object.getPrototypeOf(left) !== Object.prototype || Object.getPrototypeOf(right) !== Object.prototype) return false;
    const fields = ['ratio', 'band', 'reliability'];
    const leftKeys = Reflect.ownKeys(left), rightKeys = Reflect.ownKeys(right);
    return leftKeys.length === fields.length && rightKeys.length === fields.length && fields.every((key, index) => {
        const a = Object.getOwnPropertyDescriptor(left, key), b = Object.getOwnPropertyDescriptor(right, key);
        return leftKeys[index] === key && rightKeys[index] === key && a?.enumerable && b?.enumerable
            && Object.hasOwn(a, 'value') && Object.hasOwn(b, 'value') && Object.is(a.value, b.value);
    });
};

// A render plan follows model + device geometry. Home's boot-frame release
// creates fresh presentation objects even when those inputs are unchanged.
// G15 does not consume the Classic life/activation/growth projection fields.
export function useZenBonsaiRenderPlan({ enabled, topology, species, ...options }) {
    const g15 = isZenBonsaiG15Topology(topology);
    const plume = isZenBonsaiPlumeTopology(topology);
    const projectionKey = JSON.stringify({
        surface: options.surface,
        includePot: options.includePot,
        includeBackground: options.includeBackground,
        cameraAnchor: options.cameraAnchor,
        groundPlane: options.groundPlane,
        includeGroundShadow: options.includeGroundShadow,
        pixelRatio: options.pixelRatio,
    });
    const projection = useMemo(() => JSON.parse(projectionKey), [projectionKey]);
    const planSpecies = g15 || plume ? null : species;
    const growthProjection = g15 || plume ? null : options.growthProjection;
    const lifeState = g15 || plume ? null : options.lifeState;
    const activationRef = useRef(null);
    const requestedActivation = g15 ? null : options.activationPresentation;
    const activationPresentation = plume && samePlumeActivation(activationRef.current, requestedActivation)
        ? activationRef.current : requestedActivation;
    useLayoutEffect(() => {
        activationRef.current = plume ? activationPresentation : null;
    }, [plume, activationPresentation]);
    const potStyleOverride = g15 || plume ? null : options.potStyleOverride;
    const sourceTopologySignature = options.sourceTopologySignature;
    return useMemo(() => {
        if (!enabled || !topology || (!g15 && !plume && !planSpecies)) return null;
        return createZenBonsaiRenderPlanV1({
            ...projection,
            topology,
            species: planSpecies,
            sourceTopologySignature,
            growthProjection,
            lifeState,
            activationPresentation,
            potStyleOverride,
        });
    }, [enabled, topology, g15, plume, planSpecies, sourceTopologySignature, projection,
        growthProjection, lifeState, activationPresentation, potStyleOverride]);
}
