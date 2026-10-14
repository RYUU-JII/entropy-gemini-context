export const SAKURA_BRANCH_ORDER = Object.freeze({
    TRUNK: 0,
    PRIMARY_BRANCH: 1,
    SECONDARY_BRANCH: 2,
    TERMINAL_TWIG: 3,
});
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const sigmoid = (value) => 1 / (1 + Math.exp(-value));
const resolveSoftTransitionProbability = ({
    progress = 0,
    band = 1,
    slope = 2.2,
    floor = 0,
    ceil = 1,
} = {}) => {
    const safeBand = Math.max(1e-4, Number(band) || 1);
    const z = (Number(progress) || 0) / safeBand;
    const prob = sigmoid(z * (Number(slope) || 1));
    return lerp(clamp01(floor), clamp01(ceil), clamp01(prob));
};

export class ShapePriorModel {
    static resolveCurvePhase(currentDepth) {
        return currentDepth % 2 === 0 ? 1 : -1;
    }

    static resolveSakuraOrderName(order = 0) {
        // Keep RNG labels stable to preserve reproducible topology across versions.
        if (order === SAKURA_BRANCH_ORDER.TRUNK) return 'trunk';
        if (order === SAKURA_BRANCH_ORDER.PRIMARY_BRANCH) return 'main';
        if (order === SAKURA_BRANCH_ORDER.SECONDARY_BRANCH) return 'lateral';
        return 'twig';
    }

    static resolveSakuraChildOrder({
        currentOrder = SAKURA_BRANCH_ORDER.TRUNK,
        currentDepth = 1,
        trunkSegmentLimit = 3,
        orderRunDepth = 0,
        primaryToTwigDepth = 1,
        isContinuationChild = true,
        forceTerminalTwig = false,
        transitionSample = 0.5,
    } = {}) {
        const safeTrunkLimit = Math.max(1, Number(trunkSegmentLimit || 0));
        const nextDepth = Number(currentDepth || 0) + 1;
        const trunkMustContinue = (
            currentOrder === SAKURA_BRANCH_ORDER.TRUNK
            && isContinuationChild
            && nextDepth <= safeTrunkLimit
        );
        if (trunkMustContinue) {
            return SAKURA_BRANCH_ORDER.TRUNK;
        }
        if (forceTerminalTwig) {
            return SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
        }
        if (currentOrder === SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
            return SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
        }
        if (currentOrder === SAKURA_BRANCH_ORDER.TRUNK) {
            if (!isContinuationChild) {
                return SAKURA_BRANCH_ORDER.SECONDARY_BRANCH;
            }
            const trunkSoftBand = 0.72;
            const trunkProgress = nextDepth - safeTrunkLimit;
            if (trunkProgress <= -1.25) {
                return SAKURA_BRANCH_ORDER.TRUNK;
            }
            if (trunkProgress >= 1.05) {
                return SAKURA_BRANCH_ORDER.PRIMARY_BRANCH;
            }
            const t = resolveSoftTransitionProbability({
                progress: trunkProgress,
                band: trunkSoftBand,
                slope: 3.2,
                floor: 0.001,
                ceil: 0.999,
            });
            return clamp01(transitionSample) < t
                ? SAKURA_BRANCH_ORDER.PRIMARY_BRANCH
                : SAKURA_BRANCH_ORDER.TRUNK;
        }
        if (!isContinuationChild) {
            return SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
        }
        const twigSoftBand = 0.72;
        const twigProgress = Number(orderRunDepth || 0) - Number(primaryToTwigDepth || 0);
        if (twigProgress <= -1.2) {
            return currentOrder;
        }
        if (twigProgress >= 1.0) {
            return SAKURA_BRANCH_ORDER.TERMINAL_TWIG;
        }
        const t = resolveSoftTransitionProbability({
            progress: twigProgress,
            band: twigSoftBand,
            slope: 3.0,
            floor: 0.002,
            ceil: 0.999,
        });
        return clamp01(transitionSample) < t
            ? SAKURA_BRANCH_ORDER.TERMINAL_TWIG
            : currentOrder;
    }

    static resolveSakuraDepthEnvelope({
        currentDepth = 1,
        maxDepth = 5,
        width = 1,
        forceSample = null,
        stopSample = null,
    } = {}) {
        const depth = Number.isFinite(currentDepth) ? currentDepth : 1;
        const max = Math.max(1, Number(maxDepth) || 1);
        const widthValue = Math.max(0, Number(width) || 0);
        const absoluteStopDepth = max + 2;
        const depthPressure = clamp01((depth - (max - 1)) / 2.5);
        const widthFloor = lerp(0.12, 0.18, depthPressure);
        const forceDepthProgress = depth - (max - 1);
        const forceDepthChance = resolveSoftTransitionProbability({
            progress: forceDepthProgress,
            band: 0.72,
            slope: 3.2,
            floor: 0.03,
            ceil: 0.995,
        });
        const forceWidthProgress = widthFloor - widthValue;
        const forceWidthBoost = resolveSoftTransitionProbability({
            progress: forceWidthProgress,
            band: 0.08,
            slope: 2.4,
            floor: 0,
            ceil: 0.55,
        });
        const forceTerminalTwigChance = clamp01(forceDepthChance + forceWidthBoost);

        const stopDepthProgress = depth - (max + 0.1);
        const depthStopChance = resolveSoftTransitionProbability({
            progress: stopDepthProgress,
            band: 0.72,
            slope: 3.4,
            floor: 0.02,
            ceil: 0.998,
        });
        const widthStopChance = resolveSoftTransitionProbability({
            progress: forceWidthProgress,
            band: 0.08,
            slope: 2.8,
            floor: 0,
            ceil: 0.995,
        });
        const stopChance = clamp01(1 - ((1 - depthStopChance) * (1 - widthStopChance)));
        const forceSampleValue = Number(forceSample);
        const stopSampleValue = Number(stopSample);
        const forceTerminalTwig = depth >= (max + 1)
            || (
                Number.isFinite(forceSampleValue)
                    ? clamp01(forceSampleValue) < forceTerminalTwigChance
                    : forceTerminalTwigChance >= 0.5
            );
        const shouldStop = depth >= absoluteStopDepth
            || (
                Number.isFinite(stopSampleValue)
                    ? clamp01(stopSampleValue) < stopChance
                    : stopChance >= 0.5
            );
        return {
            forceTerminalTwig,
            shouldStop,
            absoluteStopDepth,
            widthFloor,
            depthPressure,
            forceTerminalTwigChance,
            stopChance,
        };
    }
}
