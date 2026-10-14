import {
    createSakuraRenderPlanV1,
    measureSakuraRenderPlanBoundsV1,
    requireSakuraRenderPlanV1,
    ZEN_SAKURA_RENDER_PLAN_CONTRACT,
} from '../../sakura/sakuraRenderPlan.js';
import {
    createZenBonsaiG15RenderPlanV1,
    requireZenBonsaiG15RenderPlanV1,
    ZEN_BONSAI_G15_CAMERA_FIT_MODES,
    ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES,
    ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT,
} from '../g15/ZenBonsaiG15RenderPlan.js';
import {createZenBonsaiPlumeRenderPlanV1,requireZenBonsaiPlumeRenderPlanV1,ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT} from '../plume/ZenBonsaiPlumeRenderPlan.js';

export const isZenBonsaiPlumeTopology = topology => topology?.isPlume === true && topology?.engine === 'plume';

export const isZenBonsaiG15Topology = (topology) => Boolean(
    topology?.isG15 === true && topology?.engine === 'g15_4',
);

export const createZenBonsaiRenderPlanV1 = (options = {}) => (
    isZenBonsaiPlumeTopology(options?.topology)
        ? createZenBonsaiPlumeRenderPlanV1(options)
        : isZenBonsaiG15Topology(options?.topology)
        ? createZenBonsaiG15RenderPlanV1(options)
        : createSakuraRenderPlanV1(options)
);

export const requireZenBonsaiRenderPlanV1 = (plan, {
    topology = null,
} = {}) => {
    if (plan?.contract === ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT) {
        return requireZenBonsaiPlumeRenderPlanV1(plan, { topology });
    }
    if (plan?.contract === ZEN_SAKURA_RENDER_PLAN_CONTRACT) {
        return requireSakuraRenderPlanV1(plan);
    }
    if (plan?.contract === ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT) {
        return requireZenBonsaiG15RenderPlanV1(plan, { topology });
    }
    throw new Error('ZEN_BONSAI_RENDER_PLAN_CONTRACT_INVALID');
};

export const measureZenBonsaiRenderPlanBoundsV1 = (plan, {
    topology = null,
} = {}) => {
    const resolved = requireZenBonsaiRenderPlanV1(plan, { topology });
    return isZenBonsaiIntrinsicCanvasRenderPlan(resolved)
        ? resolved.bounds
        : measureSakuraRenderPlanBoundsV1(resolved);
};

export const isZenBonsaiIntrinsicCanvasRenderPlan = (plan) => (
    plan?.contract === ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT || plan?.contract === ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT
);

export const supportsZenBonsaiActualAlphaObservation = (plan) => (
    plan?.contract === ZEN_SAKURA_RENDER_PLAN_CONTRACT
);

export {
    ZEN_BONSAI_PLUME_RENDER_PLAN_CONTRACT,
    ZEN_BONSAI_G15_CAMERA_FIT_MODES,
    ZEN_BONSAI_G15_HORIZONTAL_COMPOSITION_MODES,
    ZEN_BONSAI_G15_RENDER_PLAN_CONTRACT,
    ZEN_SAKURA_RENDER_PLAN_CONTRACT,
};
