// A pre-mutation fork proposal shares responsibility between developmental
// demand and inherited flow. These are dimensionless priorities, not carbon.
export const ZEN_G15_JOINT_FLOW = 'joint_fork_allocation_flow_v1';
export const ZEN_G15_SEPARATE_FLOW = 'resource_independent_fork_flow_direction_v1';

export function resolveZenG15ForkAllocationStrength(value = 0) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error('ZEN_G15_FORK_ALLOCATION_STRENGTH_INVALID');
    }
    return value;
}

const distribution = values => Array.isArray(values) && [2, 3].includes(values.length)
    && values.every(v => Number.isFinite(v) && v > 0)
    && Math.abs(values.reduce((a, b) => a + b, 0) - 1) <= 1e-7;
const normalize = values => {
    const total = values.reduce((a, b) => a + b, 0);
    return Object.freeze(values.map(v => v / total));
};
const blend = (a, b, t) => normalize(a.map((v, i) => Math.exp((1 - t) * Math.log(v) + t * Math.log(b[i]))));

export function planZenG15ForkAllocation(resourcePrior, flowPrior, strength) {
    resolveZenG15ForkAllocationStrength(strength);
    if (!distribution(resourcePrior) || !distribution(flowPrior) || resourcePrior.length !== flowPrior.length) {
        throw new Error('ZEN_G15_FORK_ALLOCATION_PRIORS_REQUIRED');
    }
    // Both claims move toward their normalized geometric mean. At 1 the same
    // responsibility vector owns resource priority and flow; at 0 each retains
    // its old authority. No child is zeroed and no stock or permission is added.
    const resourceShares = strength === 0 ? resourcePrior : blend(resourcePrior, flowPrior, strength / 2);
    const flowWeights = strength === 0 ? flowPrior : blend(flowPrior, resourcePrior, strength / 2);
    return Object.freeze({strength,resourcePrior:Object.freeze([...resourcePrior]),
        flowPrior:Object.freeze([...flowPrior]),resourceShares,flowWeights});
}

export function validZenG15ForkFlowPlan(plan, shares) {
    if (!plan) return false;
    if (plan.semantics === ZEN_G15_SEPARATE_FLOW) return plan.resourceShareAuthority === false;
    const claim = plan.allocation;
    if (plan.semantics !== ZEN_G15_JOINT_FLOW || plan.resourceShareAuthority !== true
        || !claim || !(claim.strength > 0 && claim.strength <= 1)
        || !distribution(claim.resourcePrior) || !distribution(claim.flowPrior)
        || claim.resourcePrior.length !== claim.flowPrior.length
        || !distribution(shares) || !distribution(plan.weights)) return false;
    const expected = planZenG15ForkAllocation(claim.resourcePrior, claim.flowPrior, claim.strength);
    const match = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= 1e-7);
    return match(shares, expected.resourceShares) && match(plan.weights, expected.flowWeights)
        && match(claim.resourceShares, expected.resourceShares) && match(claim.flowWeights, expected.flowWeights);
}
