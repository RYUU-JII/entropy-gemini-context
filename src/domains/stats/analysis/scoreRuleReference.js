import { PERSONAL_BASELINE_REFERENCE_MODES } from '../../../lib/personalBaselineContract.js';
import {
    USAGE_BASELINE_STATUS,
    readUsageObservedBaseline,
} from './usageBaseline.js';

export const SCORE_RULE_REFERENCE_MODE = PERSONAL_BASELINE_REFERENCE_MODES;

export const SCORE_RULE_REFERENCE_REASON = Object.freeze({
    BASELINE_NOT_PROVIDED: 'observed_baseline_not_provided',
    BASELINE_SPARSE: 'observed_baseline_sparse',
    BASELINE_USABLE: 'observed_baseline_usable',
});

export const SCORE_RULE_REFERENCE_POLICY = Object.freeze({
    creditBaselineMultiplier: 1,
    deductBaselineMultiplier: 0.7,
    // A descriptive history can soften a difficult reset, but it cannot move
    // the deduction line beyond twice the user's authoritative goal.
    deductGoalMultiplierMax: 2,
    creditRatioMax: 0.95,
    graceRatioMax: 1.15,
    catastropheRatioMin: 1.5,
});

const createNormativeOnlyReference = ({
    goalMinutes,
    observedBaseline,
    reason,
}) => ({
    mode: SCORE_RULE_REFERENCE_MODE.NORMATIVE_ONLY,
    reason,
    baselineMinutes: null,
    baselineStatus: observedBaseline?.status ?? null,
    creditRefMinutes: goalMinutes,
    deductRefMinutes: goalMinutes,
    deductRefCapMinutes: null,
    deductRefCapApplied: false,
});

export function resolveScoreRuleReference({
    goalMinutes,
    usageBaseline = null,
    baselineMetricId,
    baselineScope,
} = {}) {
    const goal = Number(goalMinutes);
    if (!Number.isFinite(goal) || goal <= 0) {
        throw new Error('SCORE_RULE_NORMATIVE_ANCHOR_INVALID');
    }
    const normalizedGoal = goal;
    const observedBaseline = readUsageObservedBaseline(usageBaseline, {
        metricId: baselineMetricId,
        scope: baselineScope,
    });
    if (!observedBaseline) {
        return createNormativeOnlyReference({
            goalMinutes: normalizedGoal,
            observedBaseline: null,
            reason: SCORE_RULE_REFERENCE_REASON.BASELINE_NOT_PROVIDED,
        });
    }
    if (observedBaseline.status === USAGE_BASELINE_STATUS.SPARSE) {
        return createNormativeOnlyReference({
            goalMinutes: normalizedGoal,
            observedBaseline,
            reason: SCORE_RULE_REFERENCE_REASON.BASELINE_SPARSE,
        });
    }

    const baselineMinutes = observedBaseline.stats.median;
    const deductBaselineCandidateMinutes = baselineMinutes
        * SCORE_RULE_REFERENCE_POLICY.deductBaselineMultiplier;
    const deductRefCapMinutes = normalizedGoal
        * SCORE_RULE_REFERENCE_POLICY.deductGoalMultiplierMax;
    const deductRefCapApplied = deductBaselineCandidateMinutes > deductRefCapMinutes;
    const creditRefMinutes = Math.min(
        normalizedGoal,
        baselineMinutes * SCORE_RULE_REFERENCE_POLICY.creditBaselineMultiplier,
    );
    const deductRefMinutes = Math.max(
        normalizedGoal,
        Math.min(deductBaselineCandidateMinutes, deductRefCapMinutes),
    );
    return {
        mode: SCORE_RULE_REFERENCE_MODE.BOUNDED_ADAPTIVE,
        reason: SCORE_RULE_REFERENCE_REASON.BASELINE_USABLE,
        baselineMinutes,
        baselineStatus: observedBaseline.status,
        creditRefMinutes,
        deductRefMinutes,
        deductRefCapMinutes,
        deductRefCapApplied,
    };
}

export default resolveScoreRuleReference;
