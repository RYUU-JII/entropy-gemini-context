import { useMemo } from 'react';

import {
    resolveZenBonsaiGrowthProjection,
} from '../../model/ZenBonsaiGrowthProjection.js';
import {
    resolveZenBonsaiActionPolicy,
} from '../state/ZenBonsaiActionPolicy.js';
import {
    resolveZenBonsaiExperienceModel,
} from '../state/ZenBonsaiExperienceModel.js';

export function useZenBonsaiRenderSystem({
    lifecycleInput = null,
    lifeState = null,
    targetLifeState = null,
    habitSignal = null,
    structureDepth = 1,
    actionPolicyInput = null,
} = {}) {
    const currentProjection = useMemo(() => resolveZenBonsaiGrowthProjection({
        lifeState,
        structureDepth,
    }), [lifeState, structureDepth]);
    const targetProjection = useMemo(() => resolveZenBonsaiGrowthProjection({
        lifeState: targetLifeState,
        structureDepth,
    }), [targetLifeState, structureDepth]);
    const experience = useMemo(() => resolveZenBonsaiExperienceModel({
        input: lifecycleInput,
        lifeState,
        targetLifeState,
        currentProjection,
        targetProjection,
        habitSignal,
    }), [
        lifecycleInput,
        lifeState,
        targetLifeState,
        currentProjection,
        targetProjection,
        habitSignal,
    ]);
    const actionPolicy = useMemo(
        () => resolveZenBonsaiActionPolicy(actionPolicyInput || {}),
        [actionPolicyInput],
    );

    return useMemo(() => ({
        experience,
        activationDebug: experience.diagnostics.activationDebug,
        activationPresentation: experience.presentation.activationPresentation,
        actionPolicy,
    }), [
        actionPolicy,
        experience,
    ]);
}

export default useZenBonsaiRenderSystem;
