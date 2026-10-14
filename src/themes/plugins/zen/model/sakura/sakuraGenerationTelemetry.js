const resolveProd = () => {
    if (typeof import.meta !== 'undefined' && import.meta?.env) {
        return Boolean(import.meta.env.PROD);
    }
    if (typeof process !== 'undefined' && process?.env) {
        return process.env.NODE_ENV === 'production';
    }
    return false;
};

const makeNoopCollector = () => ({
    isEnabled: false,
    trackTrunkNode: () => {},
    trackScaffoldRoot: () => {},
    trackScaffoldNode: () => {},
    trackTwigSpawn: () => {},
    trackTwigBudget: () => {},
    snapshot: () => null,
});

export const createSakuraGenerationTelemetry = ({
    enabled = true,
} = {}) => {
    if (!enabled || resolveProd()) {
        return makeNoopCollector();
    }

    const scaffoldTurnStateCounts = new Map([
        ['straight', 0],
        ['sweep', 0],
        ['kink', 0],
        ['recover', 0],
    ]);

    const state = {
        trunkSegments: 0,
        scaffoldRoots: 0,
        scaffoldNodes: 0,
        scaffoldBendPressureSum: 0,
        scaffoldBendPressureMin: Number.POSITIVE_INFINITY,
        scaffoldBendPressureMax: 0,
        scaffoldProjectedLoadSum: 0,
        scaffoldDepthGravityGainSum: 0,
        scaffoldRigidCount: 0,
        scaffoldDroopyCount: 0,
        scaffoldTargetBandCount: 0,
        twigSpawnAttempts: 0,
        twigSpawnSuccess: 0,
        twigBudgetChecks: 0,
        twigBudgetExhausted: 0,
    };

    const trackTrunkNode = () => {
        state.trunkSegments += 1;
    };

    const trackScaffoldRoot = () => {
        state.scaffoldRoots += 1;
    };

    const trackScaffoldNode = ({
        turnState = null,
        bendPressure = null,
        projectedLoad = null,
        depthGravityGain = null,
    } = {}) => {
        state.scaffoldNodes += 1;
        if (typeof turnState === 'string' && scaffoldTurnStateCounts.has(turnState)) {
            scaffoldTurnStateCounts.set(
                turnState,
                (scaffoldTurnStateCounts.get(turnState) || 0) + 1,
            );
        }
        const safeBendPressure = Number(bendPressure);
        if (Number.isFinite(safeBendPressure)) {
            const clampedBend = Math.max(0, safeBendPressure);
            state.scaffoldBendPressureSum += clampedBend;
            state.scaffoldBendPressureMin = Math.min(state.scaffoldBendPressureMin, clampedBend);
            state.scaffoldBendPressureMax = Math.max(state.scaffoldBendPressureMax, clampedBend);
            if (clampedBend < 0.06) {
                state.scaffoldRigidCount += 1;
            }
            if (clampedBend > 0.92) {
                state.scaffoldDroopyCount += 1;
            }
            if (clampedBend >= 0.08 && clampedBend <= 0.55) {
                state.scaffoldTargetBandCount += 1;
            }
        }
        const safeProjectedLoad = Number(projectedLoad);
        if (Number.isFinite(safeProjectedLoad)) {
            state.scaffoldProjectedLoadSum += Math.max(0, safeProjectedLoad);
        }
        const safeDepthGravityGain = Number(depthGravityGain);
        if (Number.isFinite(safeDepthGravityGain)) {
            state.scaffoldDepthGravityGainSum += Math.max(0, safeDepthGravityGain);
        }
    };

    const trackTwigSpawn = ({
        success = false,
    } = {}) => {
        state.twigSpawnAttempts += 1;
        if (success) {
            state.twigSpawnSuccess += 1;
        }
    };

    const trackTwigBudget = ({
        exhausted = false,
    } = {}) => {
        state.twigBudgetChecks += 1;
        if (exhausted) {
            state.twigBudgetExhausted += 1;
        }
    };

    const snapshot = () => {
        const attemptDenom = Math.max(1, state.twigSpawnAttempts);
        const budgetDenom = Math.max(1, state.twigBudgetChecks);
        const scaffoldDenom = Math.max(1, state.scaffoldNodes);
        const avgBendPressure = state.scaffoldBendPressureSum / scaffoldDenom;
        const avgProjectedLoad = state.scaffoldProjectedLoadSum / scaffoldDenom;
        const avgDepthGravityGain = state.scaffoldDepthGravityGainSum / scaffoldDenom;
        const rigidRatio = state.scaffoldRigidCount / scaffoldDenom;
        const droopyRatio = state.scaffoldDroopyCount / scaffoldDenom;
        const targetBandRatio = state.scaffoldTargetBandCount / scaffoldDenom;
        return Object.freeze({
            trunkSegments: state.trunkSegments,
            scaffoldRoots: state.scaffoldRoots,
            scaffoldNodes: state.scaffoldNodes,
            scaffoldTurnStateCounts: Object.freeze(Object.fromEntries(scaffoldTurnStateCounts.entries())),
            gravityMetrics: Object.freeze({
                avgBendPressure,
                minBendPressure: Number.isFinite(state.scaffoldBendPressureMin)
                    ? state.scaffoldBendPressureMin
                    : 0,
                maxBendPressure: state.scaffoldBendPressureMax,
                avgProjectedLoad,
                avgDepthGravityGain,
                rigidRatio,
                droopyRatio,
                targetBandRatio,
            }),
            twigSpawnAttempts: state.twigSpawnAttempts,
            twigSpawnSuccess: state.twigSpawnSuccess,
            twigSpawnSuccessRatio: state.twigSpawnSuccess / attemptDenom,
            twigBudgetChecks: state.twigBudgetChecks,
            twigBudgetExhausted: state.twigBudgetExhausted,
            twigBudgetExhaustionRatio: state.twigBudgetExhausted / budgetDenom,
        });
    };

    return {
        isEnabled: true,
        trackTrunkNode,
        trackScaffoldRoot,
        trackScaffoldNode,
        trackTwigSpawn,
        trackTwigBudget,
        snapshot,
    };
};
