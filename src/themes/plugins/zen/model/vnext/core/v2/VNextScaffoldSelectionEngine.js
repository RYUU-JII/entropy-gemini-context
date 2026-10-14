import {
    buildTopContributions,
    clamp01,
    distance2,
    lerp,
    round,
    toNumber,
} from './VNextGrowthMath';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fitTarget = (value = 0, target = 0.5, radius = 0.2) => (
    clamp01(1 - (Math.abs(toNumber(value, target) - target) / Math.max(0.06, radius)))
);

const resolveSiteSign = (site = {}) => {
    const direct = Math.sign(toNumber(site?.sideSign, 0));
    if (direct !== 0) {
        return direct;
    }
    const lateral = Math.sign(toNumber(site?.position?.[0], 0));
    return lateral === 0 ? 1 : lateral;
};

const normalizeHeight = (site = {}, bounds = {}) => (
    clamp01(
        Number.isFinite(Number(site?.heightNorm))
            ? Number(site.heightNorm)
            : (toNumber(site?.position?.[1], 0) / Math.max(1, toNumber(bounds?.height, 420))),
    )
);

const normalizeReach = (site = {}, bounds = {}) => (
    clamp01(
        Number.isFinite(Number(site?.reachNorm))
            ? Number(site.reachNorm)
            : (Math.abs(toNumber(site?.position?.[0], 0)) / Math.max(24, toNumber(bounds?.width, 420) * 0.34)),
    )
);

const summarizeSelection = (selected = []) => {
    const xs = selected.map((entry) => toNumber(entry?.position?.[0], 0));
    const ys = selected.map((entry) => toNumber(entry?.position?.[1], 0));
    const positiveCount = selected.filter((entry) => resolveSiteSign(entry) > 0).length;
    const negativeCount = selected.filter((entry) => resolveSiteSign(entry) < 0).length;
    const uniqueParents = new Set(selected.map((entry) => String(entry?.parentNodeId || 'root'))).size;
    const uniqueTrunks = new Set(selected.map((entry) => String(entry?.trunkIndex ?? 0))).size;
    return {
        centroidX: xs.length ? (xs.reduce((acc, value) => acc + value, 0) / xs.length) : 0,
        xSpan: xs.length ? (Math.max(...xs) - Math.min(...xs)) : 0,
        ySpan: ys.length ? (Math.max(...ys) - Math.min(...ys)) : 0,
        positiveCount,
        negativeCount,
        uniqueParents,
        uniqueTrunks,
    };
};

const buildScaffoldRolePlan = ({
    maxRoots = 4,
    scaffold = {},
} = {}) => {
    const openness = clamp01(scaffold?.crownOpenness);
    const supportBias = clamp01(scaffold?.supportBias);
    const baseRoles = [
        {
            id: 'first_branch',
            baseId: 'first_branch',
            targetHeight: lerp(0.28, 0.34, supportBias),
            heightRadius: 0.18,
            targetReach: lerp(0.42, 0.32, openness),
            reachRadius: 0.28,
            sideMode: 'free',
        },
        {
            id: 'counter_branch',
            baseId: 'counter_branch',
            targetHeight: 0.42,
            heightRadius: 0.18,
            targetReach: 0.34,
            reachRadius: 0.26,
            sideMode: 'counter_first',
        },
        {
            id: 'apex_feeder',
            baseId: 'apex_feeder',
            targetHeight: lerp(0.64, 0.72, supportBias),
            heightRadius: 0.16,
            targetReach: 0.18,
            reachRadius: 0.2,
            sideMode: 'oppose_centroid',
        },
        {
            id: 'mid_support',
            baseId: 'mid_support',
            targetHeight: 0.54,
            heightRadius: 0.18,
            targetReach: 0.24,
            reachRadius: 0.22,
            sideMode: 'weaker_side',
        },
        {
            id: 'inner_balance',
            baseId: 'inner_balance',
            targetHeight: 0.48,
            heightRadius: 0.2,
            targetReach: 0.18,
            reachRadius: 0.18,
            sideMode: 'weaker_side',
        },
        {
            id: 'upper_balance',
            baseId: 'upper_balance',
            targetHeight: 0.62,
            heightRadius: 0.18,
            targetReach: 0.24,
            reachRadius: 0.22,
            sideMode: 'oppose_centroid',
        },
    ];
    const overflowRoles = [
        {
            id: 'outer_fill',
            baseId: 'outer_fill',
            targetHeight: 0.46,
            heightRadius: 0.2,
            targetReach: 0.34,
            reachRadius: 0.24,
            sideMode: 'weaker_side',
        },
        {
            id: 'upper_fill',
            baseId: 'upper_fill',
            targetHeight: 0.66,
            heightRadius: 0.18,
            targetReach: 0.22,
            reachRadius: 0.2,
            sideMode: 'oppose_centroid',
        },
        {
            id: 'inner_fill',
            baseId: 'inner_fill',
            targetHeight: 0.52,
            heightRadius: 0.18,
            targetReach: 0.16,
            reachRadius: 0.16,
            sideMode: 'weaker_side',
        },
    ];
    const plan = [];
    for (let index = 0; index < Math.max(1, Math.floor(toNumber(maxRoots, 4))); index += 1) {
        if (index < baseRoles.length) {
            plan.push({
                ...baseRoles[index],
                order: index,
            });
            continue;
        }
        const overflowIndex = index - baseRoles.length;
        const template = overflowRoles[overflowIndex % overflowRoles.length];
        plan.push({
            ...template,
            id: `${template.id}_${overflowIndex + 1}`,
            order: index,
        });
    }
    return plan;
};

const resolveSideFit = ({
    role = {},
    siteSign = 1,
    selected = [],
    summary = {},
} = {}) => {
    switch (role?.sideMode) {
        case 'counter_first': {
            const firstBranch = selected.find((entry) => entry?.roleBase === 'first_branch');
            if (!firstBranch) {
                return 0.5;
            }
            return resolveSiteSign(firstBranch) === siteSign ? 0.14 : 1;
        }
        case 'weaker_side': {
            if (summary.positiveCount === summary.negativeCount) {
                return 0.66;
            }
            const desiredSign = summary.positiveCount > summary.negativeCount ? -1 : 1;
            return desiredSign === siteSign ? 1 : 0.24;
        }
        case 'oppose_centroid': {
            if (Math.abs(toNumber(summary.centroidX, 0)) < 6) {
                return 0.62;
            }
            const desiredSign = Math.sign(-toNumber(summary.centroidX, 0)) || 1;
            return desiredSign === siteSign ? 1 : 0.2;
        }
        case 'free':
        default:
            return 0.74;
    }
};

const resolveCounterSymmetryFit = ({
    role = {},
    siteReach = 0,
    siteSign = 1,
    selected = [],
} = {}) => {
    if (role?.baseId !== 'counter_branch') {
        return 0.5;
    }
    const firstBranch = selected.find((entry) => entry?.roleBase === 'first_branch');
    if (!firstBranch) {
        return 0.5;
    }
    const firstReach = normalizeReach(firstBranch, { width: 420 });
    const firstSign = resolveSiteSign(firstBranch);
    const reachFit = fitTarget(siteReach, firstReach, 0.34);
    const sideFit = firstSign === siteSign ? 0.12 : 1;
    return clamp01((reachFit * 0.58) + (sideFit * 0.42));
};

const selectBeamStates = ({
    states = [],
    beamWidth = 3,
} = {}) => {
    const unique = new Map();
    [...states]
        .sort((left, right) => Number(right?.beamScore || 0) - Number(left?.beamScore || 0))
        .forEach((state) => {
            const signature = Array.isArray(state?.selected)
                ? state.selected.map((entry) => entry.id).join('|')
                : '';
            if (!signature || unique.has(signature)) {
                return;
            }
            unique.set(signature, state);
        });
    return [...unique.values()].slice(0, Math.max(1, Math.floor(toNumber(beamWidth, 3))));
};

const finalizeScaffoldState = ({
    state = {},
    rolePlan = [],
    bounds = {},
} = {}) => {
    const selected = Array.isArray(state?.selected) ? state.selected : [];
    const summary = summarizeSelection(selected);
    const sideBalance = selected.length > 1
        ? clamp01(1 - (Math.abs(summary.positiveCount - summary.negativeCount) / selected.length))
        : 0.5;
    const xCoverage = clamp01(summary.xSpan / Math.max(24, toNumber(bounds?.width, 420) * 0.42));
    const yCoverage = clamp01(summary.ySpan / Math.max(40, toNumber(bounds?.height, 420) * 0.38));
    const parentDiversity = selected.length
        ? clamp01(summary.uniqueParents / selected.length)
        : 0;
    const trunkDiversity = selected.length
        ? clamp01(summary.uniqueTrunks / selected.length)
        : 0;
    const completion = rolePlan.length
        ? clamp01(selected.length / rolePlan.length)
        : 0;
    return round(
        toNumber(state?.totalScore, 0)
        + (sideBalance * 0.14)
        + (xCoverage * 0.1)
        + (yCoverage * 0.08)
        + (parentDiversity * 0.06)
        + (trunkDiversity * 0.04)
        + (completion * 0.08),
        6,
    );
};

const serializeRolePlanEntry = (entry = {}) => ({
    id: entry?.id || 'role',
    baseId: entry?.baseId || entry?.id || 'role',
    targetHeight: round(toNumber(entry?.targetHeight, 0), 6),
    targetReach: round(toNumber(entry?.targetReach, 0), 6),
    sideMode: entry?.sideMode || 'free',
});

const serializeSelectedScaffold = (entry = {}) => ({
    id: entry?.id || 'site',
    role: entry?.role || 'role',
    roleBase: entry?.roleBase || entry?.role || 'role',
    parentNodeId: entry?.parentNodeId || 'root',
    trunkIndex: Math.max(0, Math.floor(toNumber(entry?.trunkIndex, 0))),
    segmentIndex: Math.max(0, Math.floor(toNumber(entry?.segmentIndex, 0))),
    sideSign: resolveSiteSign(entry),
    quality: round(toNumber(entry?.quality, 0), 6),
    selectionScore: round(toNumber(entry?.selectionScore, 0), 6),
    heightNorm: round(toNumber(entry?.heightNorm, 0), 6),
    reachNorm: round(toNumber(entry?.reachNorm, 0), 6),
    position: [
        round(toNumber(entry?.position?.[0], 0), 4),
        round(toNumber(entry?.position?.[1], 0), 4),
        0,
    ],
    contributions: entry?.selectionContributions || {},
});

export const selectVNextScaffoldRoots = ({
    budSites = [],
    runtime,
    bounds,
    pushEvent,
} = {}) => {
    const scaffold = runtime?.scaffold || {};
    const backbone = runtime?.backbone || {};
    const maxRoots = Math.max(2, Math.floor(toNumber(scaffold.maxRoots, 5)));
    const minSpacing = lerp(18, 48, clamp01(scaffold.crownOpenness));
    const beamWidth = clamp(
        Math.round(lerp(2, 4, (clamp01(scaffold.supportBias) * 0.56) + (clamp01(scaffold.crownOpenness) * 0.44))),
        2,
        4,
    );
    const rolePlan = buildScaffoldRolePlan({
        maxRoots,
        scaffold,
    });
    const candidatePool = (Array.isArray(budSites) ? budSites : [])
        .slice(0, Math.max(12, maxRoots * 6))
        .map((site) => ({
            ...site,
            heightNorm: normalizeHeight(site, bounds),
            reachNorm: normalizeReach(site, bounds),
        }));

    let beam = [{
        selected: [],
        totalScore: 0,
        beamScore: 0,
    }];

    rolePlan.forEach((role) => {
        const expandedStates = [];

        beam.forEach((state) => {
            const selected = Array.isArray(state?.selected) ? state.selected : [];
            const summary = summarizeSelection(selected);

            candidatePool.forEach((site) => {
                if (selected.some((entry) => entry.id === site.id)) {
                    return;
                }
                const nearestDistance = selected.length
                    ? selected.reduce(
                        (nearest, entry) => Math.min(nearest, distance2(entry.position, site.position)),
                        Number.POSITIVE_INFINITY,
                    )
                    : Number.POSITIVE_INFINITY;
                const spacingFloor = role.baseId === 'apex_feeder' ? 0.15 : 0.2;
                const spacingScore = clamp01(nearestDistance / Math.max(1, minSpacing));
                if (selected.length && spacingScore < spacingFloor) {
                    return;
                }
                if (selected.some((entry) => entry.parentNodeId === site.parentNodeId && Math.abs(toNumber(entry.segmentIndex, 0) - toNumber(site.segmentIndex, 0)) <= 1)) {
                    return;
                }

                const siteSign = resolveSiteSign(site);
                const heightFit = fitTarget(site.heightNorm, role.targetHeight, role.heightRadius);
                const reachFit = fitTarget(site.reachNorm, role.targetReach, role.reachRadius);
                const sideFit = resolveSideFit({
                    role,
                    siteSign,
                    selected,
                    summary,
                });
                const apexSupport = fitTarget(site.heightNorm, 0.64, 0.2);
                const counterSymmetry = resolveCounterSymmetryFit({
                    role,
                    siteReach: site.reachNorm,
                    siteSign,
                    selected,
                });
                const parentDiversity = selected.some((entry) => entry.parentNodeId === site.parentNodeId) ? 0 : 1;
                const trunkDiversity = Math.max(1, Math.floor(toNumber(backbone.trunkCount, 1))) > 1
                    ? (selected.some((entry) => entry.trunkIndex !== site.trunkIndex) ? 1 : 0.28)
                    : 0.72;
                const currentSummary = summary;
                const nextSummary = summarizeSelection([...selected, site]);
                const coverageGain = clamp01(
                    (
                        ((nextSummary.xSpan - currentSummary.xSpan) / Math.max(10, minSpacing))
                        + (((nextSummary.ySpan - currentSummary.ySpan) / Math.max(18, toNumber(bounds?.height, 420) * 0.18)) * 0.38)
                    ) * 0.82,
                );
                const centroidBalance = selected.length
                    ? clamp01(
                        (Math.abs(toNumber(currentSummary.centroidX, 0)) - Math.abs(toNumber(nextSummary.centroidX, 0)) + Math.max(8, toNumber(bounds?.width, 420) * 0.06))
                        / Math.max(16, toNumber(bounds?.width, 420) * 0.16),
                    )
                    : 0.56;
                const lastTwo = selected.slice(-2);
                const sideRunPenalty = lastTwo.length === 2 && lastTwo.every((entry) => resolveSiteSign(entry) === siteSign)
                    ? 0.14
                    : 0;
                const roleSpecific = (() => {
                    switch (role.baseId) {
                        case 'first_branch':
                            return {
                                scaffold_role_height: round(heightFit * 0.16, 6),
                                scaffold_role_reach: round(reachFit * 0.18, 6),
                                scaffold_role_lower_bias: round(clamp01(1 - (site.heightNorm / 0.56)) * 0.12, 6),
                                scaffold_role_side: round(sideFit * 0.06, 6),
                            };
                        case 'counter_branch':
                            return {
                                scaffold_role_height: round(heightFit * 0.14, 6),
                                scaffold_role_reach: round(reachFit * 0.1, 6),
                                scaffold_role_side: round(sideFit * 0.16, 6),
                                scaffold_role_symmetry: round(counterSymmetry * 0.12, 6),
                            };
                        case 'apex_feeder':
                            return {
                                scaffold_role_height: round(heightFit * 0.18, 6),
                                scaffold_role_inner_support: round(reachFit * 0.14, 6),
                                scaffold_role_apex_support: round(apexSupport * 0.14, 6),
                                scaffold_role_side: round(sideFit * 0.08, 6),
                            };
                        case 'mid_support':
                            return {
                                scaffold_role_height: round(heightFit * 0.14, 6),
                                scaffold_role_reach: round(reachFit * 0.1, 6),
                                scaffold_role_side: round(sideFit * 0.12, 6),
                                scaffold_role_balance: round(centroidBalance * 0.1, 6),
                            };
                        case 'inner_balance':
                        case 'inner_fill':
                            return {
                                scaffold_role_height: round(heightFit * 0.12, 6),
                                scaffold_role_inner_support: round(reachFit * 0.14, 6),
                                scaffold_role_side: round(sideFit * 0.12, 6),
                                scaffold_role_balance: round(centroidBalance * 0.08, 6),
                            };
                        case 'upper_balance':
                        case 'upper_fill':
                            return {
                                scaffold_role_height: round(heightFit * 0.16, 6),
                                scaffold_role_reach: round(reachFit * 0.1, 6),
                                scaffold_role_side: round(sideFit * 0.12, 6),
                                scaffold_role_balance: round(centroidBalance * 0.08, 6),
                            };
                        case 'outer_fill':
                        default:
                            return {
                                scaffold_role_height: round(heightFit * 0.12, 6),
                                scaffold_role_reach: round(reachFit * 0.12, 6),
                                scaffold_role_side: round(sideFit * 0.1, 6),
                                scaffold_role_balance: round(centroidBalance * 0.08, 6),
                            };
                    }
                })();

                const contributions = {
                    scaffold_quality: round(toNumber(site.quality, 0) * 0.3, 6),
                    scaffold_spacing: round(spacingScore * 0.18, 6),
                    scaffold_coverage: round(coverageGain * 0.12, 6),
                    scaffold_parent_diversity: round(parentDiversity * 0.06, 6),
                    scaffold_trunk_diversity: round(trunkDiversity * 0.06, 6),
                    scaffold_support_bias: round(clamp01(scaffold.supportBias) * 0.06, 6),
                    ...roleSpecific,
                    scaffold_side_run_penalty: round(-sideRunPenalty, 6),
                };
                const total = Object.values(contributions).reduce((acc, value) => acc + Number(value || 0), 0);
                if ((total + 0.12) < 0.34) {
                    return;
                }
                const nextSelected = [
                    ...selected,
                    {
                        ...site,
                        role: role.id,
                        roleBase: role.baseId,
                        selectionScore: round(total, 6),
                        selectionContributions: contributions,
                    },
                ];
                const nextState = {
                    selected: nextSelected,
                    totalScore: round(toNumber(state.totalScore, 0) + total, 6),
                };
                const nextStateSummary = summarizeSelection(nextSelected);
                const partialBalance = nextSelected.length > 1
                    ? clamp01(1 - (Math.abs(nextStateSummary.positiveCount - nextStateSummary.negativeCount) / nextSelected.length))
                    : 0.5;
                nextState.beamScore = round(
                    toNumber(nextState.totalScore, 0)
                    + (partialBalance * 0.08)
                    + (clamp01(nextStateSummary.xSpan / Math.max(24, toNumber(bounds?.width, 420) * 0.38)) * 0.06),
                    6,
                );
                expandedStates.push(nextState);
            });
        });

        if (expandedStates.length) {
            beam = selectBeamStates({
                states: expandedStates,
                beamWidth,
            });
        }
    });

    const finalized = beam.map((state) => ({
        ...state,
        finalScore: finalizeScaffoldState({
            state,
            rolePlan,
            bounds,
        }),
    }));
    finalized.sort((left, right) => Number(right?.finalScore || 0) - Number(left?.finalScore || 0));
    const best = finalized[0] || {
        selected: [],
        totalScore: 0,
        finalScore: 0,
    };

    best.selected.forEach((site) => {
        const contributions = site.selectionContributions || {};
        pushEvent?.(Math.floor(toNumber(site.segmentIndex, 0)), 'ACTION_SELECTED', {
            action: `select_scaffold_${site.roleBase || site.role || 'root'}`,
            phase: 'scaffold',
            candidateCount: Math.max(1, candidatePool.length),
            scoreTotal: round(toNumber(site.selectionScore, 0), 6),
            topPositive: buildTopContributions(contributions, { positive: true }),
            topNegative: buildTopContributions(contributions, { positive: false }),
        }, {
            nodeId: site.parentNodeId,
            budId: site.id,
            contributions,
        });
    });

    return {
        selected: best.selected,
        debug: {
            beamWidth,
            candidateCount: candidatePool.length,
            rolePlan: rolePlan.map((entry) => serializeRolePlanEntry(entry)),
            selected: best.selected.map((entry) => serializeSelectedScaffold(entry)),
        },
    };
};
