export class HardConstraintModel {
    static clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    static resolveStageDepth(stageDepth, fallback = 6) {
        const safe = Number.isFinite(stageDepth) ? stageDepth : fallback;
        return Math.max(1, Math.round(safe));
    }

    static resolveTrunkSegmentLimit({
        trunkSegmentCount,
        maxDepth = null,
        stageDepth = null,
        fallback = 3,
        min = 1,
        headroom = 1,
    } = {}) {
        const resolvedDepth = Number.isFinite(maxDepth)
            ? Math.max(1, Math.round(maxDepth))
            : HardConstraintModel.resolveStageDepth(stageDepth, 6);
        const maxLimit = Math.max(min, resolvedDepth - Math.max(0, Math.round(headroom)));
        const target = Number.isFinite(trunkSegmentCount) ? trunkSegmentCount : fallback;
        return HardConstraintModel.clamp(
            Math.round(target),
            min,
            maxLimit,
        );
    }
}
